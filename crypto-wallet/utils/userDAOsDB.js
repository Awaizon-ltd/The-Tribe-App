// utils/userDAOsDB.js - Multi-chain User DAOs Database (async)
// Previously used openDatabaseSync() which opened a competing connection to the
// same file as Database.js's openDatabaseAsync(). On Android this invalidated the
// async connection's native pointer → NativeDatabase.prepareAsync NullPointerException.
// Now routes through DBManager so there is only ever ONE open connection.
import { withDB } from './DBManager';

/**
 * Initialize User DAOs table. Called once at app startup (after initDatabase).
 */
export const initUserDAOsTable = async () => {
  await withDB((db) =>
    db.execAsync(`
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
    `)
  );
};

// ==================== User DAOs Operations ====================

export const upsertUserDAO = async (userDAO) => {
  await withDB((db) =>
    db.runAsync(
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
        userDAO.lastBalanceCheck || Math.floor(Date.now() / 1000),
      ]
    )
  );
};

export const batchUpsertUserDAOs = async (userDAOs) => {
  if (!userDAOs || userDAOs.length === 0) return;
  await withDB((db) =>
    db.withTransactionAsync(async () => {
      for (const dao of userDAOs) {
        await db.runAsync(
          `INSERT OR REPLACE INTO user_daos (
            dao_address, chain_id, user_address, relationship_type, token_balance,
            token_decimals, is_creator, has_tokens, token_address, dao_name,
            dao_genre, dao_image_url, threshold, quorum, voting_period_hours,
            timelock_period_hours, created_at, last_balance_check
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            dao.daoAddress, dao.chainId, dao.userAddress, dao.relationshipType,
            dao.tokenBalance, dao.tokenDecimals, dao.isCreator ? 1 : 0,
            dao.hasTokens ? 1 : 0, dao.tokenAddress, dao.daoName,
            dao.daoGenre, dao.daoImageUrl, dao.threshold, dao.quorum,
            dao.votingPeriodHours, dao.timelockPeriodHours, dao.createdAt,
            dao.lastBalanceCheck || Math.floor(Date.now() / 1000),
          ]
        );
      }
    })
  );
};

export const getUserDAOsByChain = async (userAddress, chainId, offset = 0, limit = 100) => {
  return withDB((db) =>
    db.getAllAsync(
      `SELECT * FROM user_daos
       WHERE LOWER(user_address) = LOWER(?) AND chain_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userAddress, chainId, limit, offset]
    )
  );
};

export const getUserDAOs = async (userAddress, offset = 0, limit = 100) => {
  return withDB((db) =>
    db.getAllAsync(
      `SELECT * FROM user_daos
       WHERE LOWER(user_address) = LOWER(?)
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userAddress, limit, offset]
    )
  );
};

export const getUserCreatedDAOsByChain = async (userAddress, chainId) => {
  return withDB((db) =>
    db.getAllAsync(
      `SELECT * FROM user_daos
       WHERE LOWER(user_address) = LOWER(?) AND chain_id = ? AND is_creator = 1
       ORDER BY created_at DESC`,
      [userAddress, chainId]
    )
  );
};

export const getUserTokenHolderDAOsByChain = async (userAddress, chainId) => {
  return withDB((db) =>
    db.getAllAsync(
      `SELECT * FROM user_daos
       WHERE LOWER(user_address) = LOWER(?) AND chain_id = ? AND has_tokens = 1
       ORDER BY created_at DESC`,
      [userAddress, chainId]
    )
  );
};

export const getUserDAOsByTypeAndChain = async (userAddress, chainId, type) => {
  return withDB((db) =>
    db.getAllAsync(
      `SELECT * FROM user_daos
       WHERE LOWER(user_address) = LOWER(?) AND chain_id = ? AND relationship_type = ?
       ORDER BY created_at DESC`,
      [userAddress, chainId, type]
    )
  );
};

export const getDAOsNeedingBalanceRefreshByChain = async (userAddress, chainId, staleThreshold) => {
  const staleTime = Math.floor(Date.now() / 1000) - Math.floor(staleThreshold / 1000);
  return withDB((db) =>
    db.getAllAsync(
      `SELECT * FROM user_daos
       WHERE LOWER(user_address) = LOWER(?)
       AND chain_id = ?
       AND has_tokens = 1
       AND last_balance_check < ?`,
      [userAddress, chainId, staleTime]
    )
  );
};

export const updateUserDAOBalance = async (userAddress, daoAddress, chainId, balance, hasTokens, decimals) => {
  await withDB((db) =>
    db.runAsync(
      `UPDATE user_daos
       SET token_balance = ?, has_tokens = ?, token_decimals = ?, last_balance_check = strftime('%s', 'now')
       WHERE LOWER(user_address) = LOWER(?) AND dao_address = ? AND chain_id = ?`,
      [balance, hasTokens ? 1 : 0, decimals, userAddress, daoAddress, chainId]
    )
  );
};

export const hasUserDAOByChain = async (userAddress, daoAddress, chainId) => {
  const result = await withDB((db) =>
    db.getFirstAsync(
      `SELECT COUNT(*) as count FROM user_daos
       WHERE LOWER(user_address) = LOWER(?) AND dao_address = ? AND chain_id = ?`,
      [userAddress, daoAddress, chainId]
    )
  );
  return (result?.count || 0) > 0;
};

export const removeUserDAO = async (userAddress, daoAddress, chainId) => {
  await withDB((db) =>
    db.runAsync(
      'DELETE FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND dao_address = ? AND chain_id = ?',
      [userAddress, daoAddress, chainId]
    )
  );
};

export const clearUserDAOsByChain = async (userAddress, chainId) => {
  await withDB((db) =>
    db.runAsync(
      'DELETE FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND chain_id = ?',
      [userAddress, chainId]
    )
  );
};

export const getUserDAOsStatsByChain = async (userAddress, chainId) => {
  return withDB(async (db) => {
    const [total, created, tokenHolder, both] = await Promise.all([
      db.getFirstAsync(
        'SELECT COUNT(*) as count FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND chain_id = ?',
        [userAddress, chainId]
      ),
      db.getFirstAsync(
        'SELECT COUNT(*) as count FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND chain_id = ? AND is_creator = 1',
        [userAddress, chainId]
      ),
      db.getFirstAsync(
        'SELECT COUNT(*) as count FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND chain_id = ? AND has_tokens = 1',
        [userAddress, chainId]
      ),
      db.getFirstAsync(
        `SELECT COUNT(*) as count FROM user_daos WHERE LOWER(user_address) = LOWER(?) AND chain_id = ? AND relationship_type = 'both'`,
        [userAddress, chainId]
      ),
    ]);
    return {
      chainId,
      total: total?.count || 0,
      created: created?.count || 0,
      tokenHolder: tokenHolder?.count || 0,
      both: both?.count || 0,
    };
  });
};

export const getUserChainsWithDAOs = async (userAddress) => {
  return withDB((db) =>
    db.getAllAsync(
      `SELECT DISTINCT chain_id, COUNT(*) as dao_count
       FROM user_daos
       WHERE LOWER(user_address) = LOWER(?)
       GROUP BY chain_id
       ORDER BY dao_count DESC`,
      [userAddress]
    )
  );
};
