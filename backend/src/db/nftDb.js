// db/nftDb.js
// Query helpers for the NFT indexer tables (nft_holdings / nft_contracts /
// nft_sync_state). Mirrors services/cacheService.js's style for the DAO tables.
import db from './postgres.js';
import logger from '../utils/logger.js';

class NftDb {
  // ─── Sync cursor ────────────────────────────────────────────────────────
  async getSyncState(chainId) {
    try {
      const result = await db.query(
        'SELECT * FROM nft_sync_state WHERE chain_id = $1',
        [chainId],
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error getting NFT sync state for chain ${chainId}:`, error);
      return null;
    }
  }

  async setSyncCursor(chainId, lastSyncedBlock, lastChunkSize = null, status = 'idle', errorMessage = null) {
    try {
      await db.query(
        `INSERT INTO nft_sync_state (chain_id, last_synced_block, last_chunk_size, sync_status, error_message, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (chain_id)
         DO UPDATE SET
           last_synced_block = EXCLUDED.last_synced_block,
           last_chunk_size   = COALESCE(EXCLUDED.last_chunk_size, nft_sync_state.last_chunk_size),
           sync_status       = EXCLUDED.sync_status,
           error_message     = EXCLUDED.error_message,
           updated_at        = NOW()`,
        [chainId, lastSyncedBlock, lastChunkSize, status, errorMessage],
      );
    } catch (error) {
      logger.error(`Error setting NFT sync cursor for chain ${chainId}:`, error);
      throw error;
    }
  }

  // ─── Contract metadata cache ────────────────────────────────────────────
  async getContract(chainId, contractAddress) {
    try {
      const result = await db.query(
        'SELECT * FROM nft_contracts WHERE chain_id = $1 AND contract_address = $2',
        [chainId, contractAddress.toLowerCase()],
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error getting NFT contract ${contractAddress}:`, error);
      return null;
    }
  }

  async upsertContract(chainId, contractAddress, tokenType, name, symbol) {
    try {
      const result = await db.query(
        `INSERT INTO nft_contracts (chain_id, contract_address, token_type, name, symbol, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (chain_id, contract_address)
         DO UPDATE SET
           token_type = EXCLUDED.token_type,
           name       = EXCLUDED.name,
           symbol     = EXCLUDED.symbol,
           updated_at = NOW()
         RETURNING *`,
        [chainId, contractAddress.toLowerCase(), tokenType, name, symbol],
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error upserting NFT contract ${contractAddress}:`, error);
      throw error;
    }
  }

  // ─── Ownership state ────────────────────────────────────────────────────
  // ERC-721: exactly one owner per tokenId. On transfer, drop the previous
  // owner's row (if any) and upsert the new owner with balance 1.
  async applyErc721Transfer(client, { chainId, contractAddress, tokenId, from, to, tokenUri, blockNumber }) {
    const addr = contractAddress.toLowerCase();
    const zero = '0x0000000000000000000000000000000000000000';

    if (from && from.toLowerCase() !== zero) {
      await client.query(
        `DELETE FROM nft_holdings
         WHERE chain_id = $1 AND contract_address = $2 AND token_id = $3 AND owner_address = $4`,
        [chainId, addr, tokenId, from.toLowerCase()],
      );
    }

    if (to && to.toLowerCase() !== zero) {
      await client.query(
        `INSERT INTO nft_holdings (chain_id, contract_address, token_id, owner_address, balance, token_uri, last_block, updated_at)
         VALUES ($1, $2, $3, $4, 1, $5, $6, NOW())
         ON CONFLICT (chain_id, contract_address, token_id, owner_address)
         DO UPDATE SET
           balance    = 1,
           token_uri  = COALESCE(EXCLUDED.token_uri, nft_holdings.token_uri),
           last_block = EXCLUDED.last_block,
           updated_at = NOW()`,
        [chainId, addr, tokenId, to.toLowerCase(), tokenUri || null, blockNumber],
      );
    }
  }

  // ERC-1155: decrement the sender's balance (dropping the row at zero),
  // increment the receiver's balance.
  async applyErc1155Transfer(client, { chainId, contractAddress, tokenId, from, to, value, tokenUri, blockNumber }) {
    const addr = contractAddress.toLowerCase();
    const zero = '0x0000000000000000000000000000000000000000';

    if (from && from.toLowerCase() !== zero) {
      await client.query(
        `UPDATE nft_holdings SET balance = balance - $5, last_block = $6, updated_at = NOW()
         WHERE chain_id = $1 AND contract_address = $2 AND token_id = $3 AND owner_address = $4`,
        [chainId, addr, tokenId, from.toLowerCase(), value, blockNumber],
      );
      await client.query(
        `DELETE FROM nft_holdings
         WHERE chain_id = $1 AND contract_address = $2 AND token_id = $3 AND owner_address = $4 AND balance <= 0`,
        [chainId, addr, tokenId, from.toLowerCase()],
      );
    }

    if (to && to.toLowerCase() !== zero) {
      await client.query(
        `INSERT INTO nft_holdings (chain_id, contract_address, token_id, owner_address, balance, token_uri, last_block, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (chain_id, contract_address, token_id, owner_address)
         DO UPDATE SET
           balance    = nft_holdings.balance + EXCLUDED.balance,
           token_uri  = COALESCE(EXCLUDED.token_uri, nft_holdings.token_uri),
           last_block = EXCLUDED.last_block,
           updated_at = NOW()`,
        [chainId, addr, tokenId, to.toLowerCase(), value, tokenUri || null, blockNumber],
      );
    }
  }

  // ─── Reads ───────────────────────────────────────────────────────────────
  async getHoldingsForOwner(chainId, ownerAddress, limit = 200) {
    try {
      const result = await db.query(
        `SELECT h.*, c.token_type, c.name AS contract_name, c.symbol AS contract_symbol
         FROM nft_holdings h
         LEFT JOIN nft_contracts c
           ON c.chain_id = h.chain_id AND c.contract_address = h.contract_address
         WHERE h.chain_id = $1 AND h.owner_address = $2 AND h.balance > 0
         ORDER BY h.updated_at DESC
         LIMIT $3`,
        [chainId, ownerAddress.toLowerCase(), limit],
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error getting NFT holdings for ${ownerAddress}:`, error);
      return [];
    }
  }

  async getOwnersForToken(chainId, contractAddress, tokenId) {
    try {
      const result = await db.query(
        `SELECT owner_address, balance FROM nft_holdings
         WHERE chain_id = $1 AND contract_address = $2 AND token_id = $3 AND balance > 0
         ORDER BY balance DESC`,
        [chainId, contractAddress.toLowerCase(), tokenId],
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error getting owners for ${contractAddress} #${tokenId}:`, error);
      return [];
    }
  }
}

export default new NftDb();
