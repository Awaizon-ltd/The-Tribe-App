-- NFT indexer tables.
--
-- Robinhood Chain (4663) and Robinhood Chain Testnet (46630) aren't covered by
-- Alchemy's NFT API (see crypto-wallet/utils/blockchain/Alchemy.js's
-- ALCHEMY_NETWORK_MAP), and a client-side eth_getLogs scan for "every NFT this
-- wallet owns" was proven infeasible there (Alchemy's free-tier RPC caps
-- eth_getLogs at a 10-block range on this chain; a full-history scan from
-- genesis would take ~42 days at that rate — see crypto-wallet/utils/
-- blockchain/DirectNFTs.js's module comment for the measured numbers).
--
-- This is the server-side fix: nftIndexerService.js watches Transfer /
-- TransferSingle / TransferBatch logs incrementally from a persisted cursor
-- (nft_sync_state), chunked to whatever range the RPC allows, and maintains
-- current ownership state here so clients get an instant DB read instead of
-- a live chain scan.

-- Per-chain contract metadata cache (token type / name / symbol), resolved
-- once per contract on first sighting instead of re-querying on every transfer.
CREATE TABLE IF NOT EXISTS nft_contracts (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  token_type VARCHAR(10) NOT NULL, -- 'ERC721' | 'ERC1155'
  name VARCHAR(255),
  symbol VARCHAR(50),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(chain_id, contract_address)
);

-- Current ownership state. One row per (chain, contract, tokenId, owner).
-- ERC-721: exactly one owner row per token (balance always 1) — the previous
-- owner's row is deleted on transfer. ERC-1155: multiple owners can hold the
-- same tokenId simultaneously, tracked via balance.
CREATE TABLE IF NOT EXISTS nft_holdings (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  token_id NUMERIC(78, 0) NOT NULL, -- uint256-safe
  owner_address VARCHAR(42) NOT NULL,
  balance NUMERIC(78, 0) NOT NULL DEFAULT 1,
  token_uri TEXT,
  last_block BIGINT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(chain_id, contract_address, token_id, owner_address)
);

-- Incremental scan cursor, one row per indexed chain.
CREATE TABLE IF NOT EXISTS nft_sync_state (
  chain_id INTEGER PRIMARY KEY,
  last_synced_block BIGINT NOT NULL DEFAULT 0,
  last_chunk_size INTEGER, -- last eth_getLogs range the RPC accepted (adaptive)
  sync_status VARCHAR(20) DEFAULT 'idle',
  error_message TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_holdings_owner ON nft_holdings(chain_id, owner_address);
CREATE INDEX IF NOT EXISTS idx_nft_holdings_contract ON nft_holdings(chain_id, contract_address, token_id);
CREATE INDEX IF NOT EXISTS idx_nft_contracts_lookup ON nft_contracts(chain_id, contract_address);
