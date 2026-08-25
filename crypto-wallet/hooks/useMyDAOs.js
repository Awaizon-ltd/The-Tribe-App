// hooks/useMyDAOs.js
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useChain } from '../contexts/ChainContext';
import { useAuth } from '../contexts/AuthContext'; // ← ADD THIS
import { getUserByUid } from '../utils/Database'; // ← ADD THIS
import * as TokenDatabase from '../utils/TokenDatabase';
import * as DaoDatabase from '../utils/daoFactoryDB';

export const useMyDAOs = () => {
  const { address: walletAddress } = useWallet(); // Renamed for clarity
  const { chainId } = useChain();
  const { user } = useAuth(); // ← ADD THIS
  
  const [dbUserId, setDbUserId] = useState(null); // ← ADD THIS
  const [userTokens, setUserTokens] = useState([]);
  const [cachedDAOs, setCachedDAOs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Get database user ID
   */
  useEffect(() => {
    const loadDbUser = async () => {
      if (!user?.uid) {
        console.log('[useMyDAOs] ⚠️ No user UID');
        setDbUserId(null);
        return;
      }

      try {
        console.log('[useMyDAOs] 🔍 Getting database user for UID:', user.uid);
        const dbUser = await getUserByUid(user.uid);
        
        if (dbUser) {
          console.log('[useMyDAOs] ✅ DB User found:', {
            id: dbUser.id,
            uid: dbUser.uid,
            email: dbUser.email
          });
          setDbUserId(parseInt(dbUser.id));
        } else {
          console.error('[useMyDAOs] ❌ DB User not found for UID:', user.uid);
          setDbUserId(null);
          setError('User not found in database');
        }
      } catch (err) {
        console.error('[useMyDAOs] ❌ Error getting DB user:', err);
        setError('Failed to load user data');
      }
    };

    loadDbUser();
  }, [user?.uid]);

  /**
   * Load user's tokens from database
   */
  const loadUserTokens = useCallback(async () => {
    if (!dbUserId) {
      console.log('[useMyDAOs] ⚠️ No database user ID, skipping token load');
      setUserTokens([]);
      return [];
    }

    try {
      console.log('[useMyDAOs] 💰 ========== LOAD USER TOKENS START ==========');
      console.log('[useMyDAOs] 💰 DB User ID:', dbUserId, typeof dbUserId);
      console.log('[useMyDAOs] 💰 Chain ID:', chainId, typeof chainId);
      
      const tokens = await TokenDatabase.getTokensByChain(
        parseInt(dbUserId),
        parseInt(chainId)
      );
      
      console.log('[useMyDAOs] ✅ Loaded tokens:', tokens?.length || 0);
      console.log('[useMyDAOs] ✅ Token details:', tokens?.map(t => ({
        symbol: t.symbol,
        address: t.address.slice(0, 10) + '...'
      })));
      
      setUserTokens(tokens || []);
      console.log('[useMyDAOs] ✅ ========== LOAD USER TOKENS COMPLETE ==========');
      return tokens || [];
    } catch (err) {
      console.error('[useMyDAOs] ❌ Error loading tokens:', err);
      setError('Failed to load tokens');
      return [];
    }
  }, [dbUserId, chainId]);

  /**
   * Load cached DAOs from database
   */
  const loadCachedDAOs = useCallback(async () => {
    try {
      console.log('[useMyDAOs] 🏛️ ========== LOAD CACHED DAOS START ==========');
      console.log('[useMyDAOs] 🏛️ Chain ID:', chainId, typeof chainId);
      
      const daos = await DaoDatabase.getCachedDAOsByChain(parseInt(chainId));
      
      console.log('[useMyDAOs] ✅ Loaded DAOs:', daos?.length || 0);
      console.log('[useMyDAOs] ✅ ========== LOAD CACHED DAOS COMPLETE ==========');
      
      setCachedDAOs(daos || []);
      return daos || [];
    } catch (err) {
      console.error('[useMyDAOs] ❌ Error loading DAOs:', err);
      setError('Failed to load DAOs');
      return [];
    }
  }, [chainId]);

  /**
   * Initial load - wait for dbUserId before loading
   */
  useEffect(() => {
    const loadData = async () => {
      // Don't load if we don't have a db user ID yet
      if (dbUserId === null) {
        console.log('[useMyDAOs] ⏳ Waiting for database user ID...');
        return;
      }

      console.log('[useMyDAOs] 🔄 ========== INITIAL LOAD START ==========');
      setIsLoading(true);
      setError(null);

      try {
        await Promise.all([
          loadUserTokens(),
          loadCachedDAOs(),
        ]);
      } catch (err) {
        console.error('[useMyDAOs] ❌ Load error:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
      
      console.log('[useMyDAOs] ✅ ========== INITIAL LOAD COMPLETE ==========');
    };

    loadData();
  }, [dbUserId, loadUserTokens, loadCachedDAOs]);

  /**
   * Filter DAOs where user holds governance token
   */
  const myDAOs = useMemo(() => {
    console.log('[useMyDAOs] 🔍 ========== FILTERING MY DAOS ==========');
    console.log('[useMyDAOs] 🔍 Cached DAOs:', cachedDAOs?.length || 0);
    console.log('[useMyDAOs] 🔍 User Tokens:', userTokens?.length || 0);
    
    if (!cachedDAOs?.length || !userTokens?.length) {
      console.log('[useMyDAOs] ⚠️ No DAOs or tokens to filter');
      return [];
    }

    // Create a Set of user's token addresses (lowercase for comparison)
    const userTokenAddresses = new Set(
      userTokens.map(token => token.address.toLowerCase())
    );

    console.log('[useMyDAOs] 🔍 User token addresses:', 
      Array.from(userTokenAddresses).map(a => a.slice(0, 10) + '...')
    );
    console.log('[useMyDAOs] 🔍 Filtering', cachedDAOs.length, 'DAOs...');

    // Filter DAOs where governance token matches user's tokens
    const filtered = cachedDAOs.filter(dao => {
      const governanceToken = (dao.tokenAddress || '').toLowerCase();
      const hasToken = userTokenAddresses.has(governanceToken);
      
      if (hasToken) {
        console.log(`[useMyDAOs] ✅ Match: ${dao.daoName} (${governanceToken.slice(0, 8)}...)`);
      }
      
      return hasToken;
    });

    console.log('[useMyDAOs] 🎯 Filtered to:', filtered.length, 'DAOs');
    console.log('[useMyDAOs] ✅ ========== FILTERING COMPLETE ==========');

    return filtered;
  }, [cachedDAOs, userTokens]);

  /**
   * Get token info for a specific DAO
   */
  const getDAOTokenInfo = useCallback((daoAddress) => {
    const dao = cachedDAOs?.find(
      d => (d.daoAddress || d.address)?.toLowerCase() === daoAddress.toLowerCase()
    );
    
    if (!dao) return null;

    const tokenAddress = (dao.tokenAddress || '').toLowerCase();
    const token = userTokens.find(
      t => t.address.toLowerCase() === tokenAddress
    );

    return token || null;
  }, [cachedDAOs, userTokens]);

  /**
   * Refresh data
   */
  const refresh = useCallback(async () => {
    console.log('[useMyDAOs] 🔄 ========== REFRESH START ==========');
    setIsSyncing(true);
    setError(null);

    try {
      await Promise.all([
        loadUserTokens(),
        loadCachedDAOs(),
      ]);
    } catch (err) {
      console.error('[useMyDAOs] ❌ Refresh error:', err);
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
    
    console.log('[useMyDAOs] ✅ ========== REFRESH COMPLETE ==========');
  }, [loadUserTokens, loadCachedDAOs]);

  /**
   * Check if cache is stale
   */
  const checkCacheStale = useCallback(async () => {
    const isStale = await DaoDatabase.isCacheStale(chainId, 5 * 60 * 1000); // 5 minutes
    return isStale;
  }, [chainId]);

  return {
    // Data
    myDAOs,
    userTokens,
    cachedDAOs,
    
    // State
    isLoading,
    isSyncing,
    error,
    
    // Stats
    totalMyDAOs: myDAOs.length,
    totalTokens: userTokens.length,
    totalCachedDAOs: cachedDAOs.length,
    
    // Additional info
    hasDbUser: !!dbUserId,
    walletAddress,
    
    // Actions
    refresh,
    getDAOTokenInfo,
    checkCacheStale,
  };
};