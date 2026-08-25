// db/daoDatabase.js - Multi-chain DAO Interaction Database

import { getDatabase } from "./Database";

/**
 * Initialize DAO interaction tables with multi-chain support
 */
export const initDatabase = () => {
  const database = getDatabase();
  
  database.execSync(`
    -- DAO Details (chain-aware)
    CREATE TABLE IF NOT EXISTS dao_details (
      dao_address TEXT NOT NULL,
      chain_id TEXT NOT NULL,
      name TEXT NOT NULL,
      quorum TEXT NOT NULL,
      threshold TEXT NOT NULL,
      governance_token TEXT NOT NULL,
      voting_period_hours TEXT NOT NULL,
      timelock_period_hours TEXT NOT NULL,
      governance_token_symbol TEXT,
      token_decimals INTEGER DEFAULT 18,
      image_url TEXT,
      owner TEXT,
      last_synced INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (dao_address, chain_id)
    );

    -- Proposals (chain-aware)
    CREATE TABLE IF NOT EXISTS proposals (
      dao_address TEXT NOT NULL,
      chain_id TEXT NOT NULL,
      proposal_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      amount TEXT,
      recipient TEXT,
      proposal_type TEXT NOT NULL,
      protocol_action TEXT,
      new_value TEXT,
      new_token_address TEXT,
      for_votes TEXT NOT NULL,
      against_votes TEXT NOT NULL,
      abstain_votes TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      queued_timestamp TEXT,
      creator TEXT NOT NULL,
      last_synced INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (dao_address, chain_id, proposal_id)
    );

    -- User Balances (chain-aware)
    CREATE TABLE IF NOT EXISTS user_balances (
      dao_address TEXT NOT NULL,
      chain_id TEXT NOT NULL,
      user_address TEXT NOT NULL,
      token_address TEXT NOT NULL,
      raw_balance TEXT NOT NULL,
      formatted_balance TEXT NOT NULL,
      last_synced INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (dao_address, chain_id, user_address, token_address)
    );

    -- Delegation Info (chain-aware)
    CREATE TABLE IF NOT EXISTS delegation_info (
      dao_address TEXT NOT NULL,
      chain_id TEXT NOT NULL,
      user_address TEXT NOT NULL,
      delegated_to TEXT,
      delegated_amount TEXT,
      received_votes TEXT,
      delegator_count TEXT,
      last_synced INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (dao_address, chain_id, user_address)
    );

    CREATE INDEX IF NOT EXISTS idx_dao_details_chain ON dao_details(chain_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_dao_chain ON proposals(dao_address, chain_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status, chain_id);
    CREATE INDEX IF NOT EXISTS idx_user_balances_user ON user_balances(user_address, chain_id);
    CREATE INDEX IF NOT EXISTS idx_delegation_user ON delegation_info(user_address, chain_id);
  `);

  console.log('[DAODatabase] Multi-chain database initialized');
};

/**
 * Check if cache is fresh
 */
export const isCacheFresh = (lastSynced) => {
  if (!lastSynced) return false;
  const now = Math.floor(Date.now() / 1000);
  return (now - lastSynced) * 1000 < CACHE_FRESHNESS_MS;
};

// ==================== DAO Details Operations ====================

/**
 * Save DAO details
 */
export const saveDAODetails = (database, daoAddress, chainId, details) => {
  database.runSync(
    `INSERT OR REPLACE INTO dao_details (
      dao_address, chain_id, name, quorum, threshold, governance_token,
      voting_period_hours, timelock_period_hours, governance_token_symbol,
      token_decimals, image_url, owner, last_synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))`,
    [
      daoAddress,
      chainId,
      details.name,
      details.quorum,
      details.threshold,
      details.governanceToken,
      details.votingPeriodHours,
      details.timelockPeriodHours,
      details.governanceTokenSymbol || null,
      details.tokenDecimals || 18,
      details.imageUrl || null,
      details.owner || null,
    ]
  );
};

/**
 * Get DAO details
 */
export const getDAODetails = (database, daoAddress, chainId) => {
  return database.getFirstSync(
    'SELECT * FROM dao_details WHERE dao_address = ? AND chain_id = ?',
    [daoAddress, chainId]
  );
};

/**
 * Clear DAO details cache
 */
export const clearDAODetails = (database, daoAddress, chainId) => {
  database.runSync(
    'DELETE FROM dao_details WHERE dao_address = ? AND chain_id = ?',
    [daoAddress, chainId]
  );
};

// ==================== Proposals Operations ====================

/**
 * Save single proposal
 */
export const saveProposal = (database, daoAddress, chainId, proposal) => {
  database.runSync(
    `INSERT OR REPLACE INTO proposals (
      dao_address, chain_id, proposal_id, title, description, amount, recipient,
      proposal_type, protocol_action, new_value, new_token_address,
      for_votes, against_votes, abstain_votes, status, timestamp,
      queued_timestamp, creator, last_synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))`,
    [
      daoAddress,
      chainId,
      proposal.id,
      proposal.title,
      proposal.description,
      proposal.amount || null,
      proposal.recipient || null,
      proposal.proposalType,
      proposal.protocolAction || null,
      proposal.newValue || null,
      proposal.newTokenAddress || null,
      proposal.forVotes,
      proposal.againstVotes,
      proposal.abstainVotes,
      proposal.status,
      proposal.timestamp,
      proposal.queuedTimestamp || null,
      proposal.creator,
    ]
  );
};

/**
 * Save multiple proposals (batch)
 */
export const saveProposals = (database, daoAddress, chainId, proposals) => {
  if (!proposals || proposals.length === 0) return;

  database.withTransactionSync(() => {
    proposals.forEach((proposal) => saveProposal(database, daoAddress, chainId, proposal));
  });

  console.log(`[DAODatabase] Saved ${proposals.length} proposals for ${daoAddress} on chain ${chainId}`);
};

/**
 * Get all proposals for a DAO
 */
export const getProposals = (database, daoAddress, chainId) => {
  return database.getAllSync(
    `SELECT * FROM proposals 
     WHERE dao_address = ? AND chain_id = ? 
     ORDER BY CAST(proposal_id AS INTEGER) DESC`,
    [daoAddress, chainId]
  );
};

/**
 * Get single proposal
 */
export const getProposal = (database, daoAddress, chainId, proposalId) => {
  return database.getFirstSync(
    'SELECT * FROM proposals WHERE dao_address = ? AND chain_id = ? AND proposal_id = ?',
    [daoAddress, chainId, proposalId]
  );
};

/**
 * Clear proposals cache
 */
export const clearProposals = (database, daoAddress, chainId) => {
  database.runSync(
    'DELETE FROM proposals WHERE dao_address = ? AND chain_id = ?',
    [daoAddress, chainId]
  );
};

// ==================== User Balance Operations ====================

/**
 * Save user balance
 */
export const saveUserBalance = (database, daoAddress, chainId, userAddress, tokenAddress, rawBalance, formattedBalance) => {
  database.runSync(
    `INSERT OR REPLACE INTO user_balances (
      dao_address, chain_id, user_address, token_address, raw_balance, 
      formatted_balance, last_synced
    ) VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))`,
    [daoAddress, chainId, userAddress, tokenAddress, rawBalance, formattedBalance]
  );
};

/**
 * Get user balance
 */
export const getUserBalance = (database, daoAddress, chainId, userAddress, tokenAddress) => {
  return database.getFirstSync(
    `SELECT * FROM user_balances 
     WHERE dao_address = ? AND chain_id = ? AND user_address = ? AND token_address = ?`,
    [daoAddress, chainId, userAddress, tokenAddress]
  );
};

/**
 * Clear user balance cache
 */
export const clearUserBalance = (database, daoAddress, chainId, userAddress) => {
  database.runSync(
    'DELETE FROM user_balances WHERE dao_address = ? AND chain_id = ? AND user_address = ?',
    [daoAddress, chainId, userAddress]
  );
};

// ==================== Delegation Info Operations ====================

/**
 * Save delegation info
 */
export const saveDelegationInfo = (database, daoAddress, chainId, userAddress, info) => {
  database.runSync(
    `INSERT OR REPLACE INTO delegation_info (
      dao_address, chain_id, user_address, delegated_to, delegated_amount,
      received_votes, delegator_count, last_synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))`,
    [
      daoAddress,
      chainId,
      userAddress,
      info.delegatedTo || null,
      info.delegatedAmount || '0',
      info.receivedVotes || '0',
      info.delegatorCount || '0',
    ]
  );
};

/**
 * Get delegation info
 */
export const getDelegationInfo = (database, daoAddress, chainId, userAddress) => {
  return database.getFirstSync(
    'SELECT * FROM delegation_info WHERE dao_address = ? AND chain_id = ? AND user_address = ?',
    [daoAddress, chainId, userAddress]
  );
};

/**
 * Clear delegation info cache
 */
export const clearDelegationInfo = (database, daoAddress, chainId, userAddress) => {
  database.runSync(
    'DELETE FROM delegation_info WHERE dao_address = ? AND chain_id = ? AND user_address = ?',
    [daoAddress, chainId, userAddress]
  );
};

// ==================== Utility Operations ====================

/**
 * Clear all cache for a specific DAO on a specific chain
 */
export const clearDAOCache = (database, daoAddress, chainId) => {
  database.withTransactionSync(() => {
    clearDAODetails(database, daoAddress, chainId);
    clearProposals(database, daoAddress, chainId);
    // Note: We keep user balances and delegation info as they're user-specific
  });
  
  console.log(`[DAODatabase] Cleared cache for ${daoAddress} on chain ${chainId}`);
};

/**
 * Clear all data for a specific chain
 */
export const clearChainCache = (database, chainId) => {
  database.withTransactionSync(() => {
    database.runSync('DELETE FROM dao_details WHERE chain_id = ?', [chainId]);
    database.runSync('DELETE FROM proposals WHERE chain_id = ?', [chainId]);
    database.runSync('DELETE FROM user_balances WHERE chain_id = ?', [chainId]);
    database.runSync('DELETE FROM delegation_info WHERE chain_id = ?', [chainId]);
  });
  
  console.log(`[DAODatabase] Cleared all cache for chain ${chainId}`);
};

/**
 * Get database statistics
 */
export const getDatabaseStats = (database, chainId = null) => {
  if (chainId) {
    const daoCount = database.getFirstSync(
      'SELECT COUNT(*) as count FROM dao_details WHERE chain_id = ?',
      [chainId]
    )?.count || 0;
    
    const proposalCount = database.getFirstSync(
      'SELECT COUNT(*) as count FROM proposals WHERE chain_id = ?',
      [chainId]
    )?.count || 0;
    
    return {
      chainId,
      daoCount,
      proposalCount,
    };
  } else {
    // Global stats
    const totalDAOs = database.getFirstSync(
      'SELECT COUNT(*) as count FROM dao_details'
    )?.count || 0;
    
    const totalProposals = database.getFirstSync(
      'SELECT COUNT(*) as count FROM proposals'
    )?.count || 0;
    
    const chainStats = database.getAllSync(`
      SELECT chain_id, COUNT(*) as dao_count 
      FROM dao_details 
      GROUP BY chain_id
    `);
    
    return {
      totalDAOs,
      totalProposals,
      chainStats,
    };
  }
};

export const daoDatabase = {
  initDatabase,
  isCacheFresh,
  saveDAODetails,
  getDAODetails,
  clearDAODetails,
  saveProposal,
  saveProposals,
  getProposals,
  getProposal,
  clearProposals,
  saveUserBalance,
  getUserBalance,
  clearUserBalance,
  saveDelegationInfo,
  getDelegationInfo,
  clearDelegationInfo,
  clearDAOCache,
  clearChainCache,
  getDatabaseStats,
};