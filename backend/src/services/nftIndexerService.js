// services/nftIndexerService.js
//
// Server-side NFT ownership indexer for chains Alchemy's NFT API doesn't
// cover — currently Robinhood Chain (4663) and Robinhood Chain Testnet
// (46630). Mirrors blockchainService.js's shape (client map, per-chain sync
// lock, cache-then-serve) but for NFT Transfer/TransferSingle/TransferBatch
// logs instead of the DAOFactory registry.
//
// Why this exists instead of scanning on the client: eth_getLogs against
// Alchemy's free tier on this chain is capped at a 10-block range per call,
// and the chain is already 113M+ blocks tall — a full-history backfill would
// take ~42 days at that rate (measured and documented in crypto-wallet/utils/
// blockchain/DirectNFTs.js). A live/incremental scan from a persisted cursor
// is feasible (~1.4 req/s needed to keep pace with ~14 blocks/sec), which is
// exactly what this service does, server-side, on a timer.
//
// Ownership state lands in Postgres (nft_holdings / nft_contracts /
// nft_sync_state — see db/migrations/005_create_nft_tables.sql) and is read
// back through getNFTsForOwner(), shaped to match the Alchemy-style object
// the mobile app's NFTScreen.js / NFTDetailScreen.js already know how to
// render (see DirectNFTs.js's formatNft for the same contract).
import { ethers } from 'ethers';
import { SUPPORTED_CHAINS } from '../config/chains.js';
import nftDb from '../db/nftDb.js';
import db from '../db/postgres.js';
import logger from '../utils/logger.js';

// Only chains without Alchemy NFT API coverage need indexing. Other chains
// (Base, Polygon, etc.) already get NFT data straight from Alchemy client-side.
const INDEXED_CHAIN_IDS = [4663, 46630];

const ERC721_TRANSFER_TOPIC          = ethers.id('Transfer(address,address,uint256)');
const ERC1155_TRANSFER_SINGLE_TOPIC  = ethers.id('TransferSingle(address,address,address,uint256,uint256)');
const ERC1155_TRANSFER_BATCH_TOPIC   = ethers.id('TransferBatch(address,address,address,uint256[],uint256[])');

const ERC721_ABI  = ['function name() view returns (string)', 'function symbol() view returns (string)'];
const ERC1155_ABI = ['function uri(uint256 id) view returns (string)'];

const DEFAULT_CHUNK_BLOCKS   = 2000;  // optimistic starting guess; shrinks on first 429/range error
const MAX_BLOCKS_PER_CYCLE   = 20_000; // cap catch-up work per poll tick so one cycle can't run forever
const INITIAL_LOOKBACK_BLOCKS = 5_000; // first run per chain: start slightly behind tip, not from genesis
const POLL_INTERVAL_MS       = 25_000;

// Parses Alchemy's "[0x.., 0x..]" suggested-range hint out of its error message,
// same helper as DirectNFTs.js — kept in sync manually since it's tiny.
function parseSuggestedRange(message) {
  if (!message) return null;
  const match = message.match(/\[0x([0-9a-fA-F]+),\s*0x([0-9a-fA-F]+)\]/);
  if (!match) return null;
  const from = parseInt(match[1], 16);
  const to = parseInt(match[2], 16);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  return to - from + 1;
}

const addrFromTopic = (topic) => ethers.getAddress(ethers.dataSlice(topic, 12));

class NftIndexerService {
  constructor() {
    this.providers = {};
    this.contractTypeCache = new Map(); // `${chainId}:${address}` -> { tokenType, name, symbol }
    this._syncLocks = {};
    this._pollTimer = null;
    this.initializeProviders();
  }

  initializeProviders() {
    for (const chainId of INDEXED_CHAIN_IDS) {
      const chainConfig = Object.values(SUPPORTED_CHAINS).find((c) => c.id === chainId);
      if (!chainConfig) {
        logger.warn(`NFT indexer: no chain config for ${chainId} — skipping`);
        continue;
      }
      try {
        this.providers[chainId] = new ethers.JsonRpcProvider(chainConfig.rpcUrl, {
          chainId,
          name: chainConfig.name,
        });
        logger.success(`NFT indexer: provider ready for ${chainConfig.name}`);
      } catch (error) {
        logger.error(`NFT indexer: failed to init provider for chain ${chainId}:`, error);
      }
    }
  }

  // ─── Adaptive, gapless forward scan ─────────────────────────────────────
  // Unlike DirectNFTs.js's client-side scan (best-effort, backward from tip,
  // OK to give up early), this one must not skip blocks — ownership state
  // depends on seeing every transfer in order. It persists the cursor after
  // every chunk so a crash mid-catch-up loses at most one chunk of progress.
  async scanChunk(provider, fromBlock, toBlock, chunkSize) {
    const topics = [[ERC721_TRANSFER_TOPIC, ERC1155_TRANSFER_SINGLE_TOPIC, ERC1155_TRANSFER_BATCH_TOPIC]];
    let cur = fromBlock;
    let size = chunkSize;
    const logs = [];

    while (cur <= toBlock) {
      const chunkTo = Math.min(cur + size - 1, toBlock);
      try {
        const chunkLogs = await provider.getLogs({ fromBlock: cur, toBlock: chunkTo, topics });
        logs.push(...chunkLogs);
        cur = chunkTo + 1;
      } catch (err) {
        const suggested = parseSuggestedRange(err.shortMessage || err.message);
        if (suggested && suggested < size) {
          size = suggested; // shrink and retry the same range, don't advance cur
          continue;
        }
        throw err;
      }
    }

    return { logs, lastBlock: toBlock, chunkSize: size };
  }

  async resolveContractType(chainId, address, topic0) {
    const key = `${chainId}:${address.toLowerCase()}`;
    if (this.contractTypeCache.has(key)) return this.contractTypeCache.get(key);

    const cached = await nftDb.getContract(chainId, address);
    if (cached) {
      const info = { tokenType: cached.token_type, name: cached.name, symbol: cached.symbol };
      this.contractTypeCache.set(key, info);
      return info;
    }

    const provider = this.providers[chainId];
    const isErc1155 = topic0 === ERC1155_TRANSFER_SINGLE_TOPIC || topic0 === ERC1155_TRANSFER_BATCH_TOPIC;
    const tokenType = isErc1155 ? 'ERC1155' : 'ERC721';
    let name = null;
    let symbol = null;

    try {
      const contract = new ethers.Contract(address, ERC721_ABI, provider);
      name = await contract.name().catch(() => null);
      symbol = await contract.symbol().catch(() => null);
    } catch {
      // best-effort only — plenty of ERC-1155 contracts don't implement name()/symbol()
    }

    const info = { tokenType, name, symbol };
    this.contractTypeCache.set(key, info);
    await nftDb.upsertContract(chainId, address, tokenType, name, symbol).catch((err) =>
      logger.warn(`NFT indexer: failed to cache contract ${address}:`, err.message),
    );
    return info;
  }

  async applyLogs(chainId, logs) {
    if (!logs.length) return;

    // Resolve any not-yet-seen contracts before opening the write transaction
    // (RPC calls shouldn't happen while holding a PG client from the pool).
    const seen = new Set();
    for (const log of logs) {
      const key = `${log.address.toLowerCase()}:${log.topics[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await this.resolveContractType(chainId, log.address, log.topics[0]);
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      for (const log of logs) {
        const topic0 = log.topics[0];
        const blockNumber = log.blockNumber;

        if (topic0 === ERC721_TRANSFER_TOPIC) {
          // Same event signature as ERC-20's Transfer(address,address,uint256) —
          // the only way to tell them apart is that ERC-721's tokenId is
          // indexed (4 topics total) while ERC-20's value is not (3 topics).
          if (log.topics.length !== 4) continue;
          const from = addrFromTopic(log.topics[1]);
          const to = addrFromTopic(log.topics[2]);
          const tokenId = BigInt(log.topics[3]).toString();
          await nftDb.applyErc721Transfer(client, {
            chainId, contractAddress: log.address, tokenId, from, to, blockNumber,
          });
        } else if (topic0 === ERC1155_TRANSFER_SINGLE_TOPIC) {
          const from = addrFromTopic(log.topics[2]);
          const to = addrFromTopic(log.topics[3]);
          const [id, value] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256'], log.data);
          await nftDb.applyErc1155Transfer(client, {
            chainId, contractAddress: log.address, tokenId: id.toString(), from, to,
            value: value.toString(), blockNumber,
          });
        } else if (topic0 === ERC1155_TRANSFER_BATCH_TOPIC) {
          const from = addrFromTopic(log.topics[2]);
          const to = addrFromTopic(log.topics[3]);
          const [ids, values] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256[]', 'uint256[]'], log.data);
          for (let i = 0; i < ids.length; i++) {
            await nftDb.applyErc1155Transfer(client, {
              chainId, contractAddress: log.address, tokenId: ids[i].toString(), from, to,
              value: values[i].toString(), blockNumber,
            });
          }
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async syncChain(chainId) {
    if (this._syncLocks[chainId]) return this._syncLocks[chainId];

    let resolveLock;
    this._syncLocks[chainId] = new Promise((r) => { resolveLock = r; });

    try {
      const provider = this.providers[chainId];
      if (!provider) return;

      const latest = await provider.getBlockNumber();
      const state = await nftDb.getSyncState(chainId);
      const fromBlock = state ? state.last_synced_block + 1 : Math.max(latest - INITIAL_LOOKBACK_BLOCKS, 0);

      if (fromBlock > latest) return; // fully caught up

      const toBlock = Math.min(latest, fromBlock + MAX_BLOCKS_PER_CYCLE - 1);
      const chunkSize = state?.last_chunk_size || DEFAULT_CHUNK_BLOCKS;

      logger.info(`NFT indexer: chain ${chainId} scanning blocks ${fromBlock}..${toBlock} (of ${latest})`);
      const { logs, lastBlock, chunkSize: usedChunkSize } = await this.scanChunk(provider, fromBlock, toBlock, chunkSize);

      if (logs.length) {
        await this.applyLogs(chainId, logs);
        logger.success(`NFT indexer: chain ${chainId} applied ${logs.length} transfer log(s) through block ${lastBlock}`);
      }

      await nftDb.setSyncCursor(chainId, lastBlock, usedChunkSize, 'idle', null);
    } catch (error) {
      logger.error(`NFT indexer: sync failed for chain ${chainId}:`, error.message);
      await nftDb.setSyncCursor(
        chainId,
        (await nftDb.getSyncState(chainId))?.last_synced_block ?? 0,
        null,
        'error',
        error.message,
      ).catch(() => {});
    } finally {
      resolveLock();
      delete this._syncLocks[chainId];
    }
  }

  async syncAll() {
    for (const chainId of INDEXED_CHAIN_IDS) {
      await this.syncChain(chainId);
    }
  }

  startPolling(intervalMs = POLL_INTERVAL_MS) {
    if (this._pollTimer) return;
    this.syncAll().catch((err) => logger.error('NFT indexer: initial sync failed:', err));
    this._pollTimer = setInterval(() => {
      this.syncAll().catch((err) => logger.error('NFT indexer: poll cycle failed:', err));
    }, intervalMs);
    logger.success(`NFT indexer polling started (every ${intervalMs / 1000}s, chains: ${INDEXED_CHAIN_IDS.join(', ')})`);
  }

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
      logger.info('NFT indexer polling stopped');
    }
  }

  isIndexed(chainId) {
    return INDEXED_CHAIN_IDS.includes(Number(chainId));
  }

  // ─── Reads ───────────────────────────────────────────────────────────────
  // Metadata (image/name/description) isn't fetched during indexing — that
  // would mean one extra RPC + one HTTP fetch per transfer ever seen on the
  // chain, most of which nobody will ever query. Instead it's resolved lazily
  // here, only for the page actually being returned, same trade-off
  // DirectNFTs.js made client-side.
  async getNFTsForOwner(chainId, ownerAddress, { limit = 100, resolveMetadata = true } = {}) {
    const rows = await nftDb.getHoldingsForOwner(chainId, ownerAddress, limit);
    const provider = this.providers[chainId];

    const nfts = await Promise.all(rows.map(async (row) => {
      let metadata = null;
      let tokenUri = row.token_uri;

      if (resolveMetadata && provider) {
        try {
          if (!tokenUri) {
            const abi = row.token_type === 'ERC1155'
              ? ERC1155_ABI
              : ['function tokenURI(uint256 tokenId) view returns (string)'];
            const fn = row.token_type === 'ERC1155' ? 'uri' : 'tokenURI';
            const contract = new ethers.Contract(row.contract_address, abi, provider);
            tokenUri = await contract[fn](row.token_id);
          }
          if (tokenUri) {
            const resolvedUri = tokenUri.startsWith('ipfs://')
              ? tokenUri.replace('ipfs://', 'https://ipfs.io/ipfs/')
              : tokenUri.replace('{id}', BigInt(row.token_id).toString(16).padStart(64, '0'));
            const res = await fetch(resolvedUri, { signal: AbortSignal.timeout(5000) });
            if (res.ok) metadata = await res.json();
          }
        } catch {
          // best-effort — a dead/slow metadata host shouldn't fail the whole list
        }
      }

      const image = metadata?.image?.startsWith('ipfs://')
        ? metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/')
        : metadata?.image || null;

      return {
        contract: {
          address: row.contract_address,
          name: row.contract_name,
          symbol: row.contract_symbol,
          tokenType: row.token_type,
        },
        tokenId: row.token_id,
        tokenType: row.token_type,
        balance: row.balance,
        name: metadata?.name || row.contract_name || null,
        title: metadata?.name || row.contract_name || null,
        description: metadata?.description || null,
        image: { cachedUrl: image, thumbnailUrl: image, originalUrl: image },
        media: image ? [{ gateway: image, thumbnail: image }] : [],
        raw: { tokenUri, metadata },
      };
    }));

    return { nfts, totalCount: nfts.length, unsupported: false };
  }
}

export default new NftIndexerService();
