// utils/DaoDatabase.js
import { getDatabase } from './Database';

/**
 * Format DAO data for database storage
 */
const formatDAOForDB = (dao, chainId, chainName) => {
  return {
    daoAddress: dao.daoAddress || dao.address || dao.dao_address,
    tokenAddress: dao.tokenAddress || dao.token_address,
    chainId: chainId,
    chainName: chainName,
    genre: dao.genre,
    genreId: dao.genreId !== undefined ? dao.genreId : (dao.genre_id !== undefined ? dao.genre_id : parseInt(dao.genre)),
    daoName: dao.daoName || dao.dao_name,
    imageUrl: dao.imageUrl || dao.image_url || null,
    threshold: dao.threshold?.toString() || dao.threshold,
    quorum: dao.quorum,
    votingPeriodHours: dao.votingPeriodHours || dao.voting_period_hours,
    timelockPeriodHours: dao.timelockPeriodHours || dao.timelock_period_hours,
    createdAt: dao.createdAt || dao.created_at,
    createdAtDate: dao.createdAtDate || dao.created_at_date || new Date((dao.createdAt || dao.created_at) * 1000).toISOString(),
  };
};

/**
 * Format DAO data from database
 */
const formatDAOFromDB = (row) => {
  return {
    daoAddress: row.dao_address,
    address: row.dao_address,
    tokenAddress: row.token_address,
    chainId: row.chain_id,
    chainName: row.chain_name,
    genre: row.genre,
    genreId: row.genre_id,
    daoName: row.dao_name,
    imageUrl: row.image_url,
    threshold: row.threshold,
    quorum: row.quorum,
    votingPeriodHours: row.voting_period_hours,
    timelockPeriodHours: row.timelock_period_hours,
    createdAt: row.created_at,
    createdAtDate: row.created_at_date,
    cachedAt: row.cached_at,
  };
};

/**
 * Save single DAO to cache
 */
export const cacheDAO = async (daoData, chainId, chainName) => {
  const db = getDatabase();
  
  try {
    const formattedDAO = formatDAOForDB(daoData, chainId, chainName);
    
    console.log('[DAO Cache] Saving DAO:', {
      name: formattedDAO.daoName,
      genre: formattedDAO.genre,
      genreId: formattedDAO.genreId,
    });
    
    await db.runAsync(
      `INSERT OR REPLACE INTO daos (
        dao_address, token_address, chain_id, chain_name, genre, genre_id,
        dao_name, image_url, threshold, quorum, voting_period_hours,
        timelock_period_hours, created_at, created_at_date, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        formattedDAO.daoAddress,
        formattedDAO.tokenAddress,
        formattedDAO.chainId,
        formattedDAO.chainName,
        formattedDAO.genre,
        formattedDAO.genreId,
        formattedDAO.daoName,
        formattedDAO.imageUrl,
        formattedDAO.threshold,
        formattedDAO.quorum,
        formattedDAO.votingPeriodHours,
        formattedDAO.timelockPeriodHours,
        formattedDAO.createdAt,
        formattedDAO.createdAtDate,
        Date.now(),
      ]
    );
    
    console.log(`[DAO Cache] ✅ Saved: ${formattedDAO.daoName}`);
  } catch (error) {
    console.error('[DAO Cache] ❌ Error saving DAO:', error);
    console.error('[DAO Cache] ❌ DAO data:', daoData);
    throw error;
  }
};

/**
 * Batch save DAOs
 */
export const batchCacheDAOs = async (daos, chainId, chainName) => {
  const db = getDatabase();
  try {
    // ✅ Atomic — either all DAOs save or none do
    await db.withTransactionAsync(async () => {
      for (const dao of daos) {
        await cacheDAO(dao, chainId, chainName);
      }
    });
    console.log(`[DAO Cache] ✅ Batch saved ${daos.length} DAOs`);
  } catch (error) {
    console.error("[DAO Cache] ❌ Batch save error:", error);
    throw error;
  }
};

/**
 * Get all cached DAOs for a chain
 */
export const getCachedDAOsByChain = async (chainId) => {
  const db = getDatabase();
  
  try {
    const daos = await db.getAllAsync(
      'SELECT * FROM daos WHERE chain_id = ? ORDER BY created_at DESC',
      [chainId]
    );
    
    return daos.map(formatDAOFromDB);
  } catch (error) {
    console.error('[DAO Cache] ❌ Error getting DAOs:', error);
    return [];
  }
};

/**
 * Get DAO by address
 */
export const getCachedDAOByAddress = async (chainId, daoAddress) => {
  const db = getDatabase();
  
  try {
    const result = await db.getAllAsync(
      'SELECT * FROM daos WHERE chain_id = ? AND dao_address = ? LIMIT 1',
      [chainId, daoAddress.toLowerCase()]
    );
    
    return result.length > 0 ? formatDAOFromDB(result[0]) : null;
  } catch (error) {
    console.error('[DAO Cache] ❌ Error getting DAO:', error);
    return null;
  }
};

/**
 * Search DAOs by name
 */
export const searchCachedDAOs = async (searchQuery, chainId = null) => {
  const db = getDatabase();
  
  try {
    let query = 'SELECT * FROM daos WHERE dao_name LIKE ?';
    const params = [`%${searchQuery}%`];
    
    if (chainId) {
      query += ' AND chain_id = ?';
      params.push(chainId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 50';
    
    const daos = await db.getAllAsync(query, params);
    return daos.map(formatDAOFromDB);
  } catch (error) {
    console.error('[DAO Cache] ❌ Error searching:', error);
    return [];
  }
};

/**
 * Get DAOs by genre
 */
export const getCachedDAOsByGenre = async (chainId, genreId) => {
  const db = getDatabase();
  
  try {
    const daos = await db.getAllAsync(
      'SELECT * FROM daos WHERE chain_id = ? AND genre_id = ? ORDER BY created_at DESC',
      [chainId, genreId]
    );
    
    return daos.map(formatDAOFromDB);
  } catch (error) {
    console.error('[DAO Cache] ❌ Error getting by genre:', error);
    return [];
  }
};

/**
 * Get DAO count
 */
export const getDAOCountByChain = async (chainId) => {
  const db = getDatabase();
  
  try {
    const result = await db.getAllAsync(
      'SELECT COUNT(*) as count FROM daos WHERE chain_id = ?',
      [chainId]
    );
    
    return result[0]?.count || 0;
  } catch (error) {
    console.error('[DAO Cache] ❌ Error getting count:', error);
    return 0;
  }
};

/**
 * Update sync state
 */
/**
 * Update sync state
 * ✅ FIX 2: accepts an optional serverTimestamp so we store the backend's
 * clock value rather than always using Date.now(). This prevents clock-drift
 * causing missed records on the next incremental sync.
 */
// utils/DaoDatabase.js
export const updateDAOSyncState = async (
  chainId, totalDAOs, error = null, serverTimestamp = null
) => {
  const db = getDatabase();
  try {
    // ✅ Always store in Unix SECONDS.
    //    serverTimestamp from the API is already seconds.
    //    Date.now() is ms → divide by 1000.
    const timestamp = serverTimestamp != null
      ? serverTimestamp
      : Math.floor(Date.now() / 1000); // ← was Date.now() (ms)

    await db.runAsync(
      `INSERT OR REPLACE INTO dao_sync_state (
        chain_id, last_sync_timestamp, total_daos, last_error
      ) VALUES (?, ?, ?, ?)`,
      [chainId, timestamp, totalDAOs, error]
    );
  } catch (err) {
    console.error('[DAO Sync] ❌ Error updating sync state:', err);
  }
};
/**
 * Get sync state
 */
export const getDAOSyncState = async (chainId) => {
  const db = getDatabase();
  
  try {
    const result = await db.getAllAsync(
      'SELECT * FROM dao_sync_state WHERE chain_id = ? LIMIT 1',
      [chainId]
    );
    
    if (result.length === 0) return null;
    
    return {
      chainId: result[0].chain_id,
      lastSyncTimestamp: result[0].last_sync_timestamp,
      totalDAOs: result[0].total_daos,
      lastError: result[0].last_error,
    };
  } catch (error) {
    console.error('[DAO Sync] ❌ Error getting sync state:', error);
    return null;
  }
};

/**
 * ✅ NEW: Get last sync timestamp for incremental sync
 */
export const getLastSyncTimestamp = async (chainId) => {
  const syncState = await getDAOSyncState(chainId);
  const ts = syncState?.lastSyncTimestamp || 0;
  // ✅ Migrate any legacy ms value (13 digits) stored before this fix
  return ts > 9_999_999_999 ? Math.floor(ts / 1000) : ts;
};

/**
 * Check if cache is stale
 */
export const isCacheStale = async (chainId, expiryMs = 5 * 60 * 1000) => {
  const syncState = await getDAOSyncState(chainId);
  
  if (!syncState) return true;
  
  const timeSinceSync = Date.now() - syncState.lastSyncTimestamp;
  return timeSinceSync > expiryMs;
};

/**
 * Clear cache for chain
 */
export const clearDAOCacheByChain = async (chainId) => {
  const db = getDatabase();
  
  try {
    await db.runAsync('DELETE FROM daos WHERE chain_id = ?', [chainId]);
    await db.runAsync('DELETE FROM dao_sync_state WHERE chain_id = ?', [chainId]);
    console.log(`[DAO Cache] ✅ Cleared cache for chain ${chainId}`);
  } catch (error) {
    console.error('[DAO Cache] ❌ Error clearing cache:', error);
  }
};

export default {
  cacheDAO,
  batchCacheDAOs,
  getCachedDAOsByChain,
  getCachedDAOByAddress,
  searchCachedDAOs,
  getCachedDAOsByGenre,
  getDAOCountByChain,
  updateDAOSyncState,
  getDAOSyncState,
  getLastSyncTimestamp,    // ✅ NEW
  isCacheStale,
  clearDAOCacheByChain,
};