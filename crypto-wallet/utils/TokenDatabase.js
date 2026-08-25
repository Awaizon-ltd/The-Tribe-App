// utils/TokenDatabase.js
/**
 * Additional Token Database Helpers
 * These functions extend the Database.js token operations
 * with more specific queries for chain-based token management
 */

import { getDatabase } from './Database';

/**
 * Get all tokens for a user on a specific chain
 */
export const getTokensByChain = async (userId, chainId) => {
  const db = getDatabase();
  
  try {
    // Ensure types are consistent
    const normalizedUserId = parseInt(userId);
    const normalizedChainId = parseInt(chainId);
    
    console.log('[TokenDB] 🔍 ========== GET TOKENS BY CHAIN ==========');
    console.log('[TokenDB] 🔍 Query params:', {
      userId: { original: userId, normalized: normalizedUserId, type: typeof normalizedUserId },
      chainId: { original: chainId, normalized: normalizedChainId, type: typeof normalizedChainId }
    });
    
    const tokens = await db.getAllAsync(
      `SELECT * FROM tokens 
       WHERE user_id = ? AND chain_id = ? AND is_visible = 1
       ORDER BY symbol ASC`,
      [normalizedUserId, normalizedChainId]
    );
    
    console.log('[TokenDB] ✅ Found tokens:', tokens?.length || 0);
    if (tokens && tokens.length > 0) {
      console.log('[TokenDB] ✅ Token details:', tokens.map(t => ({
        id: t.id, symbol: t.symbol, chainId: t.chain_id, isVisible: t.is_visible,
      })));
    }

    // Diagnostic: when 0 results, show everything in the table for this user
    // so we can see what chainId / is_visible values are actually stored.
    if (!tokens?.length) {
      const all = await db.getAllAsync(
        'SELECT id, symbol, chain_id, is_visible FROM tokens WHERE user_id = ?',
        [normalizedUserId],
      );
      if (all?.length) {
        console.warn('[TokenDB] ⚠️ 0 results for chain', normalizedChainId,
          'but found', all.length, 'token(s) under other chains:', all);
      } else {
        console.warn('[TokenDB] ⚠️ tokens table is completely empty for userId', normalizedUserId);
      }
    }

    return tokens || [];
  } catch (error) {
    console.error('[TokenDB] ❌ Error getting tokens by chain:', error);
    return [];
  }
};

/**
 * Get all tokens grouped by chain for a user
 */
export const getTokensGroupedByChain = async (userId) => {
  const db = getDatabase();
  
  try {
    const result = await db.getAllAsync(
      `SELECT 
        chain_id,
        COUNT(*) as token_count,
        json_group_array(
          json_object(
            'id', id,
            'address', address,
            'name', name,
            'symbol', symbol,
            'decimals', decimals,
            'logo', logo
          )
        ) as tokens
      FROM tokens 
      WHERE user_id = ? AND is_visible = 1
      GROUP BY chain_id
      ORDER BY chain_id`,
      [userId]
    );
    
    return result.map(row => ({
      chainId: row.chain_id,
      tokenCount: row.token_count,
      tokens: JSON.parse(row.tokens),
    }));
  } catch (error) {
    console.error('[TokenDB] ❌ Error getting tokens grouped by chain:', error);
    return [];
  }
};

/**
 * Get token count for a specific chain
 */
export const getTokenCountByChain = async (userId, chainId) => {
  const db = getDatabase();
  
  try {
    const result = await db.getFirstAsync(
      `SELECT COUNT(*) as count 
       FROM tokens 
       WHERE user_id = ? AND chain_id = ? AND is_visible = 1`,
      [userId, chainId]
    );
    
    return result?.count || 0;
  } catch (error) {
    console.error('[TokenDB] ❌ Error getting token count:', error);
    return 0;
  }
};

/**
 * Check if a token already exists for user on specific chain
 */
export const tokenExists = async (userId, chainId, tokenAddress) => {
  const db = getDatabase();
  
  try {
    const result = await db.getFirstAsync(
      `SELECT COUNT(*) as count 
       FROM tokens 
       WHERE user_id = ? AND chain_id = ? AND LOWER(address) = LOWER(?)`,
      [userId, chainId, tokenAddress]
    );
    
    return result.count > 0;
  } catch (error) {
    console.error('[TokenDB] ❌ Error checking token exists:', error);
    return false;
  }
};

/**
 * Get token by address on specific chain
 */
export const getTokenByAddress = async (userId, chainId, tokenAddress) => {
  const db = getDatabase();
  
  try {
    return await db.getFirstAsync(
      `SELECT * FROM tokens 
       WHERE user_id = ? AND chain_id = ? AND LOWER(address) = LOWER(?)`,
      [userId, chainId, tokenAddress]
    );
  } catch (error) {
    console.error('[TokenDB] ❌ Error getting token by address:', error);
    return null;
  }
};

/**
 * Get all unique chains where user has tokens
 */
export const getChainsWithTokens = async (userId) => {
  const db = getDatabase();
  
  try {
    const result = await db.getAllAsync(
      `SELECT DISTINCT chain_id, COUNT(*) as token_count
       FROM tokens 
       WHERE user_id = ? AND is_visible = 1
       GROUP BY chain_id
       ORDER BY chain_id`,
      [userId]
    );
    
    return result.map(row => ({
      chainId: row.chain_id,
      tokenCount: row.token_count,
    }));
  } catch (error) {
    console.error('[TokenDB] ❌ Error getting chains with tokens:', error);
    return [];
  }
};

/**
 * Get token addresses for user on specific chain (for DAO filtering)
 */
export const getUserTokenAddresses = async (userId, chainId) => {
  const db = getDatabase();
  
  try {
    const tokens = await db.getAllAsync(
      `SELECT address FROM tokens 
       WHERE user_id = ? AND chain_id = ? AND is_visible = 1`,
      [userId, chainId]
    );
    
    return tokens.map(t => t.address.toLowerCase());
  } catch (error) {
    console.error('[TokenDB] ❌ Error getting token addresses:', error);
    return [];
  }
};

/**
 * Bulk hide/show tokens
 */
export const toggleTokensVisibility = async (tokenIds, isVisible) => {
  const db = getDatabase();
  
  try {
    const placeholders = tokenIds.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE tokens SET is_visible = ? WHERE id IN (${placeholders})`,
      [isVisible ? 1 : 0, ...tokenIds]
    );
  } catch (error) {
    console.error('[TokenDB] ❌ Error toggling token visibility:', error);
    throw error;
  }
};

/**
 * Delete all tokens for a specific chain (for user)
 */
export const deleteAllChainTokens = async (userId, chainId) => {
  const db = getDatabase();
  
  try {
    await db.runAsync(
      'DELETE FROM tokens WHERE user_id = ? AND chain_id = ?',
      [userId, chainId]
    );
  } catch (error) {
    console.error('[TokenDB] ❌ Error deleting chain tokens:', error);
    throw error;
  }
};

/**
 * Get recently added tokens
 */
export const getRecentTokens = async (userId, limit = 5) => {
  const db = getDatabase();
  
  try {
    return await db.getAllAsync(
      `SELECT * FROM tokens 
       WHERE user_id = ? AND is_visible = 1
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
  } catch (error) {
    console.error('[TokenDB] ❌ Error getting recent tokens:', error);
    return [];
  }
};

/**
 * Search tokens across all chains
 */
export const searchTokens = async (userId, searchQuery) => {
  const db = getDatabase();
  
  try {
    return await db.getAllAsync(
      `SELECT * FROM tokens 
       WHERE user_id = ? 
       AND is_visible = 1
       AND (
         LOWER(name) LIKE LOWER(?) 
         OR LOWER(symbol) LIKE LOWER(?)
         OR LOWER(address) LIKE LOWER(?)
       )
       ORDER BY symbol`,
      [userId, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`]
    );
  } catch (error) {
    console.error('[TokenDB] ❌ Error searching tokens:', error);
    return [];
  }
};

/**
 * Get token statistics for a user
 */
export const getTokenStatistics = async (userId) => {
  const db = getDatabase();
  
  try {
    const stats = await db.getFirstAsync(`
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(DISTINCT chain_id) as chains_count,
        SUM(CASE WHEN is_visible = 1 THEN 1 ELSE 0 END) as visible_tokens,
        SUM(CASE WHEN is_visible = 0 THEN 1 ELSE 0 END) as hidden_tokens
      FROM tokens
      WHERE user_id = ?
    `, [userId]);
    
    return {
      totalTokens: stats?.total_tokens || 0,
      chainsCount: stats?.chains_count || 0,
      visibleTokens: stats?.visible_tokens || 0,
      hiddenTokens: stats?.hidden_tokens || 0,
    };
  } catch (error) {
    console.error('[TokenDB] ❌ Error getting token statistics:', error);
    return {
      totalTokens: 0,
      chainsCount: 0,
      visibleTokens: 0,
      hiddenTokens: 0,
    };
  }
};

/**
 * Update token logo
 */
export const updateTokenLogo = async (tokenId, logoUrl) => {
  const db = getDatabase();
  
  try {
    await db.runAsync(
      'UPDATE tokens SET logo = ? WHERE id = ?',
      [logoUrl, tokenId]
    );
  } catch (error) {
    console.error('[TokenDB] ❌ Error updating token logo:', error);
    throw error;
  }
};

/**
 * Batch update token logos
 */
export const batchUpdateTokenLogos = async (updates) => {
  const db = getDatabase();
  
  try {
    await db.withTransactionAsync(async () => {
      for (const { tokenId, logoUrl } of updates) {
        await db.runAsync(
          'UPDATE tokens SET logo = ? WHERE id = ?',
          [logoUrl, tokenId]
        );
      }
    });
  } catch (error) {
    console.error('[TokenDB] ❌ Error batch updating logos:', error);
    throw error;
  }
};

/**
 * Get hidden tokens
 */
export const getHiddenTokens = async (userId) => {
  const db = getDatabase();
  
  try {
    return await db.getAllAsync(
      `SELECT * FROM tokens 
       WHERE user_id = ? AND is_visible = 0
       ORDER BY symbol`,
      [userId]
    );
  } catch (error) {
    console.error('[TokenDB] ❌ Error getting hidden tokens:', error);
    return [];
  }
};

/**
 * Restore (unhide) a token
 */
export const restoreToken = async (tokenId) => {
  const db = getDatabase();
  
  try {
    await db.runAsync(
      'UPDATE tokens SET is_visible = 1 WHERE id = ?',
      [tokenId]
    );
  } catch (error) {
    console.error('[TokenDB] ❌ Error restoring token:', error);
    throw error;
  }
};

/**
 * Permanently delete hidden tokens older than X days
 */
export const cleanupOldHiddenTokens = async (userId, daysOld = 30) => {
  const db = getDatabase();
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    await db.runAsync(
      `DELETE FROM tokens 
       WHERE user_id = ? 
       AND is_visible = 0 
       AND created_at < ?`,
      [userId, cutoffDate.toISOString()]
    );
  } catch (error) {
    console.error('[TokenDB] ❌ Error cleaning up old tokens:', error);
    throw error;
  }
};

/**
 * Check if user holds a specific token
 */
export const userHoldsToken = async (userId, chainId, tokenAddress) => {
  const db = getDatabase();
  
  try {
    const result = await db.getFirstAsync(
      `SELECT COUNT(*) as count 
       FROM tokens 
       WHERE user_id = ? 
       AND chain_id = ? 
       AND LOWER(address) = LOWER(?)
       AND is_visible = 1`,
      [userId, chainId, tokenAddress]
    );
    
    return result.count > 0;
  } catch (error) {
    console.error('[TokenDB] ❌ Error checking if user holds token:', error);
    return false;
  }
};

// ─── Balance + price cache (stale-while-revalidate) ──────────────────────────

const BALANCE_TTL_MS = 60_000; // 60 s — fast enough for live feel, cheap on RPC

/**
 * Read cached balances/prices for every token on a chain.
 * Returns { data: { [address]: { balance, price } }, stale }
 */
export const getTokenBalanceCacheForChain = async (userId, chainId) => {
  const db = getDatabase();
  const prefix = `${userId}:${chainId}:`;
  try {
    const rows = await db.getAllAsync(
      `SELECT cache_key, balance, price_usd, price_change_24h, fetched_at
       FROM token_balance_cache WHERE cache_key LIKE ?`,
      [`${prefix}%`],
    );
    if (!rows.length) return { data: {}, stale: true };
    const now   = Date.now();
    const stale = rows.some((r) => now - r.fetched_at > BALANCE_TTL_MS);
    const data  = {};
    for (const row of rows) {
      const addr     = row.cache_key.slice(prefix.length);
      data[addr] = {
        balance: row.balance || '0',
        price:   row.price_usd != null
          ? { usd: row.price_usd, usd_24h_change: row.price_change_24h ?? 0 }
          : null,
      };
    }
    return { data, stale };
  } catch {
    return { data: {}, stale: true };
  }
};

/**
 * Persist enriched token list (with balance + price) to the cache.
 * `tokens` must each have: address, balance, price?.usd, price?.usd_24h_change
 */
export const saveTokenBalanceCache = async (userId, chainId, tokens) => {
  if (!tokens?.length) return;
  const db  = getDatabase();
  const now = Date.now();
  try {
    await db.withTransactionAsync(async () => {
      for (const t of tokens) {
        const key = `${userId}:${chainId}:${t.address.toLowerCase()}`;
        await db.runAsync(
          `INSERT OR REPLACE INTO token_balance_cache
           (cache_key, balance, price_usd, price_change_24h, fetched_at)
           VALUES (?, ?, ?, ?, ?)`,
          [key, t.balance ?? '0', t.price?.usd ?? null, t.price?.usd_24h_change ?? null, now],
        );
      }
    });
  } catch (err) {
    console.error('[TokenDB] saveTokenBalanceCache error:', err);
  }
};

// Default export with all functions
export default {
  getTokensByChain,
  getTokensGroupedByChain,
  getTokenCountByChain,
  tokenExists,
  getTokenByAddress,
  getChainsWithTokens,
  getUserTokenAddresses,
  toggleTokensVisibility,
  deleteAllChainTokens,
  getRecentTokens,
  searchTokens,
  getTokenStatistics,
  updateTokenLogo,
  batchUpdateTokenLogos,
  getHiddenTokens,
  restoreToken,
  cleanupOldHiddenTokens,
  userHoldsToken,
  getTokenBalanceCacheForChain,
  saveTokenBalanceCache,
};