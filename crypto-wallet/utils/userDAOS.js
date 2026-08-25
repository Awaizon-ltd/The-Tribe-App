// db/userDAOsDB.js - Multi-chain User DAOs Database
import * as SQLite from 'expo-sqlite';
import { APP_CONFIG } from '../constants/Config';

let db = null;

/**
 * Open database connection
 */
export const openDatabase = () => {
  if (!db) {
    db = SQLite.openDatabaseSync(APP_CONFIG.DB_NAME);
  }
  return db;
};

/**
 * Initialize User DAOs table with multi-chain support
 */
export const initUserDAOsTable = () => {
  const database = openDatabase();
  
  database.execSync(`
    CREATE TABLE IF NOT EXISTS user_daos (
      dao_address TEXT NOT NULL,
      chain_id TEXT NOT NULL,
      user_address TEXT NOT NULL,
      relationship_type TEXT NOT NULL,
      token_balance TEXT DEFAULT '0',
      token_decimals INTEGER DEFAULT 18,
      is_creator INTEGER DEFAULT 0,
      has_tokens INTEGER DEFAULT 0,
      token_address TEXT,
      dao_name TEXT,
      dao_genre TEXT,
      dao_image_url TEXT,
      threshold TEXT,
      quorum TEXT,
      voting_period_hours TEXT,
      timelock_period_hours TEXT,
      created_at TEXT,
      last_balance_check INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (dao_address, chain_id, user_address)
    );

    CREATE INDEX IF NOT EXISTS idx_user_daos_user_chain ON user_daos(user_address, chain_id);
    CREATE INDEX IF NOT EXISTS idx_user_daos_creator ON user_daos(is_creator, chain_id);
    CREATE INDEX IF NOT EXISTS idx_user_daos_holder ON user_daos(has_tokens, chain_id);
    CREATE INDEX IF NOT EXISTS idx_user_daos_relationship ON user_daos(relationship_type, chain_id);
    CREATE INDEX IF NOT EXISTS idx_user_daos_balance_check ON user_daos(last_balance_check);
  `);

 
};

// ==================== User DAOs Operations ====================

/**
 * Upsert a single user DAO
 */
export const upsertUserDAO = (database, userDAO) => {
  database.runSync(
    `INSERT OR REPLACE INTO user_daos (
      dao_address, chain_id, user_address, relationship_type, token_balance,
      token_decimals, is_creator, has_tokens, token_address, dao_name,
      dao_genre, dao_image_url, threshold, quorum, voting_period_hours,
      timelock_period_hours, created_at, last_balance_check
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userDAO.daoAddress,
      userDAO.chainId,
      userDAO.userAddress,
      userDAO.relationshipType,
      userDAO.tokenBalance,
      userDAO.tokenDecimals,
      userDAO.isCreator ? 1 : 0,
      userDAO.hasTokens ? 1 : 0,
      userDAO.tokenAddress,
      userDAO.daoName,
      userDAO.daoGenre,
      userDAO.daoImageUrl,
      userDAO.threshold,
      userDAO.quorum,
      userDAO.votingPeriodHours,
      userDAO.timelockPeriodHours,
      userDAO.createdAt,
      userDAO.lastBalanceCheck || Math.floor(Date.now() / 1000)
    ]
  );
};

/**
 * Batch upsert user DAOs
 */
export const batchUpsertUserDAOs = (database, userDAOs) => {
  if (!userDAOs || userDAOs.length === 0) return;

  database.withTransactionSync(() => {
    userDAOs.forEach((dao) => upsertUserDAO(database, dao));
  });

};

/**
 * Get user DAOs for a specific chain with pagination
 */
export const getUserDAOsByChain = (database, userAddress, chainId, offset = 0, limit = 100) => {
  return database.getAllSync(
    `SELECT * FROM user_daos 
     WHERE LOWER(user_address) = LOWER(?) AND chain_id = ?
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`,
    [userAddress, chainId, limit, offset]
  );
};

/**
 * Get all user DAOs (across all chains) - backwards compatibility
 */
export const getUserDAOs = (database, userAddress, offset = 0, limit = 100) => {
  return database.getAllSync(
    `SELECT * FROM user_daos 
     WHERE LOWER(user_address) = LOWER(?)
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`,
    [userAddress, limit, offset]
  );
};

/**
 * Get user DAOs by creator status (chain-specific)
 */
export const getUserCreatedDAOsByChain = (database, userAddress, chainId) => {
  return database.getAllSync(
    `SELECT * FROM user_daos 
     WHERE LOWER(user_address) = LOWER(?) AND chain_id = ? AND is_creator = 1
     ORDER BY created_at DESC`,
    [userAddress, chainId]
  );
};

/**
 * Get user DAOs by creator status (all chains) - backwards compatibility
 */
export const getUserCreatedDAOs = (database, userAddress) => {
  return database.getAllSync(
    `SELECT * FROM user_daos 
     WHERE LOWER(user_address) = LOWER(?) AND is_creator = 1
     ORDER BY created_at DESC`,
    [userAddress]
  );
};

/**
 * Get user DAOs by token holder status (chain-specific)
 */
export const getUserTokenHolderDAOsByChain = (database, userAddress, chainId) => {
  return database.getAllSync(
    `SELECT * FROM user_daos 
     WHERE LOWER(user_address) = LOWER(?) AND chain_id = ? AND has_tokens = 1
     ORDER BY created_at DESC`,
    [userAddress, chainId]
  );
};

/**
 * Get user DAOs by token holder status (all chains) - backwards compatibility
 */
export const getUserTokenHolderDAOs = (database, userAddress) => {
  return database.getAllSync(
    `SELECT * FROM user_daos 
     WHERE LOWER(user_address) = LOWER(?) AND has_tokens = 1
     ORDER BY created_at DESC`,
    [userAddress]
  );
};

/**
 * Get user DAOs by relationship type (chain-specific)
 */
export const getUserDAOsByTypeAndChain = (database, userAddress, chainId, type) => {
  return database.getAllSync(
    `SELECT * FROM user_daos 
     WHERE LOWER(user_address) = LOWER(?) AND chain_id = ? AND relationship_type = ?
     ORDER BY created_at DESC`,
    [userAddress, chainId, type]
  );
};

/**
 * Get user DAOs by relationship type (all chains) - backwards compatibility
 */
export const getUserDAOsByType = (database, userAddress, type) => {
  return database.getAllSync(
    `SELECT * FROM user_daos 
     WHERE LOWER(user_address) = LOWER(?) AND relationship_type = ?
     ORDER BY created_at DESC`,
    [userAddress, type]
  );
};

/**
 * Get DAOs needing balance refresh (chain-specific)
 */
export const getDAOsNeedingBalanceRefreshByChain = (database, userAddress, chainId, staleThreshold) => {
  const now = Math.floor(Date.now() / 1000);
  const staleTime = now - Math.floor(staleThreshold / 1000);

  return database.getAllSync(
    `SELECT * FROM user_daos 
     WHERE LOWER(user_address) = LOWER(?) 
     AND chain_id = ?
     AND has_tokens = 1 
     AND last_balance_check < ?`,
    [userAddress, chainId, staleTime]
  );
};

/**
 * Get DAOs needing balance refresh (all chains) - backwards compatibility
 */
export const getDAOsNeedingBalanceRefresh = (database, userAddress, staleThreshold) => {
  const now = Math.floor(Date.now() / 1000);
  const staleTime = now - Math.floor(staleThreshold / 1000);

  return database.getAllSync(
    `SELECT * FROM user_daos 
     WHERE LOWER(user_address) = LOWER(?) 
     AND has_tokens = 1 
     AND last_balance_check < ?`,
    [userAddress, staleTime]
  );
};

/**
 * Update user DAO balance
 */
export const updateUserDAOBalance = (database, userAddress, daoAddress, chainId, balance, hasTokens, decimals) => {
  database.runSync(
    `UPDATE user_daos 
     SET token_balance = ?, has_tokens = ?, token_decimals = ?, last_balance_check = strftime('%s', 'now')
     WHERE LOWER(user_address) = LOWER(?) AND dao_address = ? AND chain_id = ?`,
    [balance, hasTokens ? 1 : 0, decimals, userAddress, daoAddress, chainId]
  );
};

/**
 * Check if user has a specific DAO (chain-specific)
 */
export const hasUserDAOByChain = (database, userAddress, daoAddress, chainId) => {
  const result = database.getFirstSync(
    `SELECT COUNT(*) as count FROM user_daos 
     WHERE LOWER(user_address) = LOWER(?) AND dao_address = ? AND chain_id = ?`,
    [userAddress, daoAddress, chainId]
  );
  return (result?.count || 0) > 0;
};

/**
 * Check if user has a specific DAO (any chain) - backwards compatibility
 */
export const hasUserDAO = (database, userAddress, daoAddress) => {
  const result = database.getFirstSync(
    `SELECT COUNT(*) as count FROM user_daos 
     WHERE LOWER(user_address) = LOWER(?) AND dao_address = ?`,
    [userAddress, daoAddress]
  );
  return (result?.count || 0) > 0;
};

/**
 * Remove user DAO
 */
export const removeUserDAO = (database, userAddress, daoAddress, chainId) => {
  database.runSync(
    'DELETE FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND dao_address = ? AND chain_id = ?',
    [userAddress, daoAddress, chainId]
  );
};

/**
 * Clear all user DAOs for a specific chain
 */
export const clearUserDAOsByChain = (database, userAddress, chainId) => {
  database.runSync(
    'DELETE FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND chain_id = ?',
    [userAddress, chainId]
  );

};

/**
 * Clear all user DAOs (all chains) - backwards compatibility
 */
export const clearUserDAOs = (database, userAddress) => {
  database.runSync(
    'DELETE FROM user_daos WHERE LOWER(user_address) = LOWER(?)',
    [userAddress]
  );

};

/**
 * Get user DAOs statistics (chain-specific)
 */
export const getUserDAOsStatsByChain = (database, userAddress, chainId) => {
  const total = database.getFirstSync(
    'SELECT COUNT(*) as count FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND chain_id = ?',
    [userAddress, chainId]
  )?.count || 0;

  const created = database.getFirstSync(
    'SELECT COUNT(*) as count FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND chain_id = ? AND is_creator = 1',
    [userAddress, chainId]
  )?.count || 0;

  const tokenHolder = database.getFirstSync(
    'SELECT COUNT(*) as count FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND chain_id = ? AND has_tokens = 1',
    [userAddress, chainId]
  )?.count || 0;

  const both = database.getFirstSync(
    'SELECT COUNT(*) as count FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND chain_id = ? AND relationship_type = "both"',
    [userAddress, chainId]
  )?.count || 0;

  return {
    chainId,
    total,
    created,
    tokenHolder,
    both,
  };
};

/**
 * Get user DAOs statistics (all chains) - backwards compatibility
 */
export const getUserDAOsStats = (database, userAddress) => {
  const total = database.getFirstSync(
    'SELECT COUNT(*) as count FROM user_daos WHERE LOWER(user_address) = LOWER(?)',
    [userAddress]
  )?.count || 0;

  const created = database.getFirstSync(
    'SELECT COUNT(*) as count FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND is_creator = 1',
    [userAddress]
  )?.count || 0;

  const tokenHolder = database.getFirstSync(
    'SELECT COUNT(*) as count FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND has_tokens = 1',
    [userAddress]
  )?.count || 0;

  const both = database.getFirstSync(
    'SELECT COUNT(*) as count FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND relationship_type = "both"',
    [userAddress]
  )?.count || 0;

  // Get stats per chain
  const byChain = database.getAllSync(`
    SELECT chain_id, COUNT(*) as count 
    FROM user_daos 
    WHERE LOWER(user_address) = LOWER(?)
    GROUP BY chain_id
  `, [userAddress]);

  return {
    total,
    created,
    tokenHolder,
    both,
    byChain,
  };
};

/**
 * Get chains where user has DAOs
 */
export const getUserChainsWithDAOs = (database, userAddress) => {
  return database.getAllSync(
    `SELECT DISTINCT chain_id, COUNT(*) as dao_count 
     FROM user_daos 
     WHERE LOWER(user_address) = LOWER(?)
     GROUP BY chain_id 
     ORDER BY dao_count DESC`,
    [userAddress]
  );
};