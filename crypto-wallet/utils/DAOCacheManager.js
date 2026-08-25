// utils/DAOCacheManager.js - Separate cache management layer
import * as DAOFactoryDB from './daoFactoryDB';

const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

class DAOCacheManager {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize the database
   */
  initialize() {
    if (this.initialized) return;
    
    try {
      this.db = DAOFactoryDB.openDatabase();
      DAOFactoryDB.initDatabase();
      this.initialized = true;
      console.log('[DAOCacheManager] Database initialized');
    } catch (error) {
      console.error('[DAOCacheManager] Failed to initialize database:', error);
      this.initialized = false;
    }
  }

  /**
   * Check if database is ready
   */
  isReady() {
    return this.initialized && this.db !== null;
  }

  /**
   * Check if cache needs sync for a specific chain
   */
  needsSync(chainId) {
    if (!this.isReady()) return true;
    return DAOFactoryDB.needsSync(this.db, STALE_THRESHOLD, chainId);
  }

  /**
   * Get factory metadata for a chain
   */
  getFactoryMetadata(chainId) {
    if (!this.isReady()) return null;

    try {
      const ethFee = DAOFactoryDB.getFactoryMetadata(this.db, `ethFee_${chainId}`);
      const tokenFee = DAOFactoryDB.getFactoryMetadata(this.db, `tokenFee_${chainId}`);
      const feeToken = DAOFactoryDB.getFactoryMetadata(this.db, `feeTokenAddress_${chainId}`);
      const minTimelock = DAOFactoryDB.getFactoryMetadata(this.db, `minTimelockHours_${chainId}`);

      return {
        ethFee,
        tokenFee,
        feeTokenAddress: feeToken,
        minTimelockHours: minTimelock,
      };
    } catch (error) {
      console.error('[DAOCacheManager] Failed to get factory metadata:', error);
      return null;
    }
  }

  /**
   * Save factory metadata for a chain
   */
  saveFactoryMetadata(chainId, metadata) {
    if (!this.isReady()) return false;

    try {
      const { ethFee, tokenFee, feeTokenAddress, minTimelockHours } = metadata;
      
      DAOFactoryDB.setFactoryMetadata(this.db, `ethFee_${chainId}`, ethFee);
      DAOFactoryDB.setFactoryMetadata(this.db, `tokenFee_${chainId}`, tokenFee);
      DAOFactoryDB.setFactoryMetadata(this.db, `feeTokenAddress_${chainId}`, feeTokenAddress);
      DAOFactoryDB.setFactoryMetadata(this.db, `minTimelockHours_${chainId}`, minTimelockHours);
      
      return true;
    } catch (error) {
      console.error('[DAOCacheManager] Failed to save factory metadata:', error);
      return false;
    }
  }

  /**
   * Get DAOs for a specific chain with pagination
   */
  getDAOs(chainId, offset = 0, limit = 50) {
    if (!this.isReady()) return [];

    try {
      return DAOFactoryDB.getDAOsByChain(this.db, chainId, offset, limit);
    } catch (error) {
      console.error('[DAOCacheManager] Failed to get DAOs:', error);
      return [];
    }
  }

  /**
   * Get total DAOs count for a chain
   */
  getTotalDAOs(chainId) {
    if (!this.isReady()) return 0;

    try {
      return DAOFactoryDB.getTotalDAOsByChain(this.db, chainId);
    } catch (error) {
      console.error('[DAOCacheManager] Failed to get total DAOs:', error);
      return 0;
    }
  }

  /**
   * Get a single DAO by address and chain
   */
  getDAO(address, chainId) {
    if (!this.isReady()) return null;

    try {
      return DAOFactoryDB.getDAOByAddress(this.db, address, chainId);
    } catch (error) {
      console.error('[DAOCacheManager] Failed to get DAO:', error);
      return null;
    }
  }

  /**
   * Save/update a single DAO
   */
  saveDAO(dao) {
    if (!this.isReady()) return false;

    try {
      DAOFactoryDB.upsertDAO(this.db, dao);
      return true;
    } catch (error) {
      console.error('[DAOCacheManager] Failed to save DAO:', error);
      return false;
    }
  }

  /**
   * Batch save/update multiple DAOs
   */
  saveDAOs(daos) {
    if (!this.isReady()) return false;

    try {
      DAOFactoryDB.batchUpsertDAOs(this.db, daos);
      return true;
    } catch (error) {
      console.error('[DAOCacheManager] Failed to batch save DAOs:', error);
      return false;
    }
  }

  /**
   * Get DAOs by genre for a specific chain
   */
  getDAOsByGenre(genre, chainId, offset = 0, limit = 50) {
    if (!this.isReady()) return [];

    try {
      return DAOFactoryDB.getDAOsByGenreAndChain(this.db, genre, chainId, offset, limit);
    } catch (error) {
      console.error('[DAOCacheManager] Failed to get DAOs by genre:', error);
      return [];
    }
  }

  /**
   * Search DAOs by name for a specific chain
   */
  searchDAOs(searchTerm, chainId, offset = 0, limit = 50) {
    if (!this.isReady()) return [];

    try {
      return DAOFactoryDB.searchDAOsByChain(this.db, searchTerm, chainId, offset, limit);
    } catch (error) {
      console.error('[DAOCacheManager] Failed to search DAOs:', error);
      return [];
    }
  }

  /**
   * Update last sync time for a chain
   */
  updateSyncTime(chainId) {
    if (!this.isReady()) return false;

    try {
      DAOFactoryDB.setLastSyncTime(this.db, chainId);
      return true;
    } catch (error) {
      console.error('[DAOCacheManager] Failed to update sync time:', error);
      return false;
    }
  }

  /**
   * Get database statistics for a chain
   */
  getStats(chainId) {
    if (!this.isReady()) return null;

    try {
      return DAOFactoryDB.getDatabaseStatsByChain(this.db, chainId);
    } catch (error) {
      console.error('[DAOCacheManager] Failed to get stats:', error);
      return null;
    }
  }

  /**
   * Clear cache for a specific chain
   */
  clearChainCache(chainId) {
    if (!this.isReady()) return false;

    try {
      // Implementation depends on your DB structure
      // You might need to add this function to daoFactoryDB.js
      console.log(`[DAOCacheManager] Clearing cache for chain ${chainId}`);
      return true;
    } catch (error) {
      console.error('[DAOCacheManager] Failed to clear cache:', error);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  clearAll() {
    if (!this.isReady()) return false;

    try {
      // Implementation depends on your DB structure
      console.log('[DAOCacheManager] Clearing all cache');
      return true;
    } catch (error) {
      console.error('[DAOCacheManager] Failed to clear all cache:', error);
      return false;
    }
  }
}

// Export singleton instance
export const daoCacheManager = new DAOCacheManager();