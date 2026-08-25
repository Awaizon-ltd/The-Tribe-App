// hooks/useUserDAOs.js - Multi-chain User DAOs Hook with Ethers v6
import { useState, useEffect, useRef, useCallback } from 'react';
import * as UserDAOsDB from '../utils/userDAOsDB';
import * as DAOFactoryDB from '../utils/daoFactoryDB';
import { useWallet } from '../contexts/WalletContext';
import { useChain } from '../contexts/ChainContext';
import { useDAOFactory } from './useDaoFactory';

const SYNC_INTERVAL = 10 * 60 * 1000;
const BALANCE_CHECK_INTERVAL = 5 * 60 * 1000;
const BALANCE_STALE_THRESHOLD = 5 * 60 * 1000;

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

export const useUserDAOs = () => {
  const { wallet, readContract } = useWallet();
  const { activeChain } = useChain();
  const { deployedDAOs, isSyncing: factorySyncing } = useDAOFactory();

  const [userDAOs, setUserDAOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshingBalances, setRefreshingBalances] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  const syncTimerRef = useRef(null);
  const balanceTimerRef = useRef(null);
  const lastSyncRef = useRef({});

  // Initialize user_daos table (schema lives in DBManager's shared connection)
  useEffect(() => {
    UserDAOsDB.initUserDAOsTable()
      .then(() => console.log('[useUserDAOs] user_daos table ready'))
      .catch((err) => console.error('[useUserDAOs] Table init failed:', err));
  }, []);

  // Load user DAOs from SQLite (chain-specific)
  const loadFromCache = useCallback(async () => {
    if (!wallet?.address) return false;

    try {
      console.log(`[useUserDAOs] Loading from cache for ${wallet.address} on ${activeChain.name}...`);
      setLoading(true);

      const [cachedDAOs, userStats] = await Promise.all([
        UserDAOsDB.getUserDAOsByChain(wallet.address, activeChain.id, 0, 100),
        UserDAOsDB.getUserDAOsStatsByChain(wallet.address, activeChain.id),
      ]);

      setUserDAOs(cachedDAOs);
      setStats(userStats);
      setLoading(false);
      console.log(`[useUserDAOs] Loaded ${cachedDAOs.length} DAOs from cache for ${activeChain.name}`);
      return cachedDAOs.length > 0;
    } catch (err) {
      console.error('[useUserDAOs] Load from cache failed:', err);
      setError(err.message);
      setLoading(false);
      return false;
    }
  }, [wallet?.address, activeChain.id, activeChain.name]);

  // Check token balance and decimals for a DAO using WalletContext
  const checkTokenBalance = useCallback(async (dao) => {
    if (!wallet?.address) return { balance: '0', hasTokens: false, decimals: 18 };

    try {
      const tokenAddress = dao.token_address || dao.tokenAddress;
      
      // Use readContract from WalletContext
      const [balance, decimals] = await Promise.all([
        readContract(tokenAddress, ERC20_ABI, 'balanceOf', [wallet.address], activeChain.id),
        readContract(tokenAddress, ERC20_ABI, 'decimals', [], activeChain.id)
      ]);
      
      const hasTokens = balance > 0n;

      console.log(`[useUserDAOs] Token ${tokenAddress} has ${decimals} decimals, balance: ${balance.toString()}`);

      return {
        balance: balance.toString(),
        hasTokens,
        decimals: Number(decimals)
      };
    } catch (err) {
      console.error('[useUserDAOs] Token balance check failed for', dao.dao_address || dao.address, err);
      return { balance: '0', hasTokens: false, decimals: 18 };
    }
  }, [wallet?.address, activeChain.id, readContract]);

  // Determine relationship type
  const determineRelationship = (dao, isCreator, hasTokens) => {
    if (isCreator && hasTokens) return 'both';
    if (isCreator) return 'creator';
    if (hasTokens) return 'token_holder';
    return 'unknown';
  };

  // Sync user's DAOs from blockchain (chain-specific)
  const syncUserDAOs = useCallback(async (forceSync = false) => {
    if (!wallet?.address) return;
    if (syncing) {
      console.log('[useUserDAOs] Sync already in progress');
      return;
    }

    const now = Date.now();
    const lastSyncForChain = lastSyncRef.current[activeChain.id] || 0;
    if (!forceSync && now - lastSyncForChain < SYNC_INTERVAL) {
      console.log(`[useUserDAOs] Sync not needed yet for ${activeChain.name}`);
      return;
    }

    try {
      console.log(`[useUserDAOs] Syncing user DAOs for ${wallet.address} on ${activeChain.name}...`);
      setSyncing(true);
      setError(null);

      // getCachedDAOsByChain is the correct async API in daoFactoryDB.js
      const allDAOs = await DAOFactoryDB.getCachedDAOsByChain(activeChain.id);
      console.log(`[useUserDAOs] Checking ${allDAOs.length} total DAOs on ${activeChain.name}`);

      const userDAOsToCache = [];
      let checkedCount = 0;
      let foundCount = 0;

      for (const dao of allDAOs) {
        checkedCount++;
        const isCreator = dao.creator?.toLowerCase() === wallet.address.toLowerCase();
        const { balance, hasTokens, decimals } = await checkTokenBalance(dao);

        if (isCreator || hasTokens) {
          foundCount++;
          userDAOsToCache.push({
            daoAddress: dao.address || dao.daoAddress,
            chainId: activeChain.id,
            userAddress: wallet.address,
            relationshipType: determineRelationship(dao, isCreator, hasTokens),
            tokenBalance: balance,
            tokenDecimals: decimals,
            isCreator,
            hasTokens,
            tokenAddress: dao.tokenAddress || dao.token_address,
            daoName: dao.daoName || dao.dao_name,
            daoGenre: dao.genre,
            daoImageUrl: dao.imageUrl || dao.image_url,
            threshold: dao.threshold,
            quorum: dao.quorum,
            votingPeriodHours: dao.votingPeriodHours || dao.voting_period_hours,
            timelockPeriodHours: dao.timelockPeriodHours || dao.timelock_period_hours,
            createdAt: dao.createdAt || dao.created_at,
            lastBalanceCheck: now,
          });
        }

        if (checkedCount % 10 === 0) {
          console.log(`[useUserDAOs] Progress: ${checkedCount}/${allDAOs.length} checked, ${foundCount} found`);
        }
      }

      console.log(`[useUserDAOs] Found ${userDAOsToCache.length} DAOs for user on ${activeChain.name}`);

      if (userDAOsToCache.length > 0) {
        await UserDAOsDB.clearUserDAOsByChain(wallet.address, activeChain.id);
        await UserDAOsDB.batchUpsertUserDAOs(userDAOsToCache);
      }

      await loadFromCache();
      lastSyncRef.current[activeChain.id] = now;
      console.log(`[useUserDAOs] Sync complete for ${activeChain.name}`);
    } catch (err) {
      console.error('[useUserDAOs] Sync failed:', err);
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }, [wallet?.address, activeChain.id, activeChain.name, checkTokenBalance, loadFromCache, syncing]);

  // Refresh token balances for existing DAOs (chain-specific)
  const refreshBalances = useCallback(async () => {
    if (!wallet?.address || refreshingBalances) return;

    try {
      console.log(`[useUserDAOs] Refreshing token balances on ${activeChain.name}`);
      setRefreshingBalances(true);

      const staleDAOs = await UserDAOsDB.getDAOsNeedingBalanceRefreshByChain(
        wallet.address,
        activeChain.id,
        BALANCE_STALE_THRESHOLD
      );

      console.log(`[useUserDAOs] Refreshing ${staleDAOs.length} stale balances on ${activeChain.name}`);

      for (const dao of staleDAOs) {
        const { balance, hasTokens, decimals } = await checkTokenBalance(dao);

        await UserDAOsDB.updateUserDAOBalance(
          wallet.address,
          dao.dao_address,
          activeChain.id,
          balance,
          hasTokens,
          decimals
        );

        if (!hasTokens && !dao.is_creator) {
          await UserDAOsDB.removeUserDAO(wallet.address, dao.dao_address, activeChain.id);
        }
      }

      // Reload from cache
      await loadFromCache();

      console.log(`[useUserDAOs] Balance refresh complete for ${activeChain.name}`);
    } catch (err) {
      console.error('[useUserDAOs] Balance refresh failed:', err);
    } finally {
      setRefreshingBalances(false);
    }
  }, [wallet?.address, activeChain.id, activeChain.name, checkTokenBalance, loadFromCache, refreshingBalances]);

  // Initial load and sync when chain changes
  useEffect(() => {
    const init = async () => {
      if (!wallet?.address) {
        setUserDAOs([]);
        setLoading(false);
        return;
      }

      // Reset state for new chain
      setUserDAOs([]);
      setStats(null);

      // Load from cache first
      const cacheLoaded = await loadFromCache();

      // Then sync in background
      if (cacheLoaded) {
        syncUserDAOs(false);
      } else {
        await syncUserDAOs(true);
      }
    };

    init();
  }, [wallet?.address, activeChain.id, loadFromCache, syncUserDAOs]);

  // Periodic sync every 10 minutes
  useEffect(() => {
    if (!wallet?.address) return;

    syncTimerRef.current = setInterval(() => {
      syncUserDAOs(false);
    }, SYNC_INTERVAL);

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, [wallet?.address, syncUserDAOs]);

  // Periodic balance refresh every 5 minutes
  useEffect(() => {
    if (!wallet?.address) return;

    balanceTimerRef.current = setInterval(() => {
      refreshBalances();
    }, BALANCE_CHECK_INTERVAL);

    return () => {
      if (balanceTimerRef.current) {
        clearInterval(balanceTimerRef.current);
      }
    };
  }, [wallet?.address, refreshBalances]);

  // Filter functions (chain-specific) — all async now
  const getCreatedDAOs = useCallback(async () => {
    if (!wallet?.address) return [];
    return UserDAOsDB.getUserCreatedDAOsByChain(wallet.address, activeChain.id);
  }, [wallet?.address, activeChain.id]);

  const getTokenHolderDAOs = useCallback(async () => {
    if (!wallet?.address) return [];
    return UserDAOsDB.getUserTokenHolderDAOsByChain(wallet.address, activeChain.id);
  }, [wallet?.address, activeChain.id]);

  const getDAOsByType = useCallback(async (type) => {
    if (!wallet?.address) return [];
    return UserDAOsDB.getUserDAOsByTypeAndChain(wallet.address, activeChain.id, type);
  }, [wallet?.address, activeChain.id]);

  const refresh = useCallback(async () => {
    await syncUserDAOs(true);
  }, [syncUserDAOs]);

  const hasDAO = useCallback(async (daoAddress) => {
    if (!wallet?.address) return false;
    return UserDAOsDB.hasUserDAOByChain(wallet.address, daoAddress, activeChain.id);
  }, [wallet?.address, activeChain.id]);

  const getChainsWithDAOs = useCallback(async () => {
    if (!wallet?.address) return [];
    return UserDAOsDB.getUserChainsWithDAOs(wallet.address);
  }, [wallet?.address]);

  return {
    userDAOs,
    loading,
    syncing,
    refreshingBalances,
    error,
    stats,
    refresh,
    refreshBalances,
    getCreatedDAOs,
    getTokenHolderDAOs,
    getDAOsByType,
    hasDAO,
    getChainsWithDAOs,
    activeChain,
    isReady: !loading && !!wallet?.address,
  };
};