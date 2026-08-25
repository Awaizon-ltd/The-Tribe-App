// hooks/useDaoFactory.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useChain } from '../contexts/ChainContext';
import DaoApiService from '../services/api/daoAPI';
import * as DaoDatabase from '../utils/daoFactoryDB';

const POLL_MIN            = 20_000;   // baseline poll interval
const POLL_MAX            = 300_000;  // max backoff (5 min) when server unreachable
const FOREGROUND_DEBOUNCE = 10_000;   // don't re-fetch if we just did < 10 s ago

export const useDAOFactory = () => {
  const { activeChain, chainId, chainName } = useChain();

  const [deployedDAOs, setDeployedDAOs]               = useState([]);
  const [isLoading, setIsLoading]                      = useState(true);
  const [isSyncingBackground, setIsSyncingBackground]  = useState(false);
  const [totalDAOs, setTotalDAOs]                      = useState(0);
  const [error, setError]                              = useState(null);

  const isMountedRef    = useRef(true);
  const isFetchingRef   = useRef(false);     // prevents concurrent fetches
  const lastFetchMsRef  = useRef(0);         // wall-clock ms of last completed fetch
  const intervalRef     = useRef(null);
  const chainIdRef      = useRef(chainId);
  const chainNameRef    = useRef(chainName);
  const appStateRef     = useRef(AppState.currentState);
  const backoffMsRef    = useRef(POLL_MIN);  // current poll interval (grows on failure)

  useEffect(() => {
    chainIdRef.current   = chainId;
    chainNameRef.current = chainName;
  }, [chainId, chainName]);

  // ─── Read SQLite → update UI ──────────────────────────────────────────────
  const loadFromDatabase = useCallback(async (cid) => {
    try {
      const target = cid ?? chainIdRef.current;
      const [daos, count] = await Promise.all([
        DaoDatabase.getCachedDAOsByChain(target),
        DaoDatabase.getDAOCountByChain(target),
      ]);
      if (!isMountedRef.current) return [];
      setDeployedDAOs(daos);
      setTotalDAOs(count);
      setIsLoading(false);
      return daos;
    } catch (err) {
      if (isMountedRef.current) { setError(err.message); setIsLoading(false); }
      return [];
    }
  }, []);

  // ─── Full fetch from backend → write SQLite → refresh UI ─────────────────
  //
  // We deliberately do NOT use an incremental cursor here.
  //
  // The cursor approach breaks because:
  //   1. Every blockchain re-fetch sets updated_at = NOW().
  //   2. The server returns syncTimestamp = MAX(updated_at) ≈ NOW().
  //   3. The next query asks for updated_at > NOW() — always 0 results.
  //
  // A full fetch is simpler, provably correct, and costs nothing for
  // the DAO counts involved (6–200 rows ≈ a few KB per request).
  const fetchAndCache = useCallback(async () => {
    if (!isMountedRef.current || isFetchingRef.current) return;

    isFetchingRef.current = true;
    setIsSyncingBackground(true);

    const cid   = chainIdRef.current;
    const cname = chainNameRef.current;

    try {
      // fetchDAOsForChain: full list, no cursor — simple and correct
      const incoming = await DaoApiService.fetchDAOsForChain(cid, 500);
      if (!isMountedRef.current) return;

      if (incoming.length > 0) {
        await DaoDatabase.batchCacheDAOs(incoming, cid, cname);
        await loadFromDatabase(cid);
      } else {
        // Chain genuinely empty — still update count display
        if (isMountedRef.current) setTotalDAOs(0);
      }

      setError(null);
      lastFetchMsRef.current = Date.now();
      backoffMsRef.current = POLL_MIN; // reset backoff on success
    } catch (err) {
      console.error('[useDAOFactory] fetchAndCache failed:', err.message);
      // Surface connectivity errors so the UI can show a retry button
      if (isMountedRef.current) setError(err.message);
      // Double the poll interval up to POLL_MAX when server is unreachable
      backoffMsRef.current = Math.min(backoffMsRef.current * 2, POLL_MAX);
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) setIsSyncingBackground(false);
    }
  }, [loadFromDatabase]);

  // ─── Manual pull-to-refresh ───────────────────────────────────────────────
  const refresh = useCallback(async () => {
    isFetchingRef.current = false;   // force allow even if a poll is pending
    backoffMsRef.current  = POLL_MIN; // reset backoff on manual refresh
    await fetchAndCache();
  }, [fetchAndCache]);

  // ─── Search / genre filter (SQLite, no network) ───────────────────────────
  const searchDAOs = useCallback(async (query) => {
    try {
      if (!query.trim()) { await loadFromDatabase(); return; }
      const results = await DaoDatabase.searchCachedDAOs(query, chainIdRef.current);
      if (!isMountedRef.current) return;
      setDeployedDAOs(results);
      setTotalDAOs(results.length);
    } catch (err) {
      if (isMountedRef.current) setError(err.message);
    }
  }, [loadFromDatabase]);

  const fetchDAOsByGenre = useCallback(async (genreId) => {
    try {
      const results = await DaoDatabase.getCachedDAOsByGenre(chainIdRef.current, genreId);
      if (!isMountedRef.current) return [];
      setDeployedDAOs(results);
      setTotalDAOs(results.length);
      return results;
    } catch (err) {
      if (isMountedRef.current) setError(err.message);
      throw err;
    }
  }, []);

  const clearFilters = useCallback(() => loadFromDatabase(), [loadFromDatabase]);

  // ─── Main effect: runs whenever the active chain changes ──────────────────
  useEffect(() => {
    isMountedRef.current  = true;
    isFetchingRef.current = false;
    lastFetchMsRef.current = 0;
    backoffMsRef.current  = POLL_MIN;

    setDeployedDAOs([]);
    setIsLoading(true);
    setError(null);

    const schedulePoll = () => {
      if (!isMountedRef.current) return;
      intervalRef.current = setTimeout(async () => {
        await fetchAndCache();
        schedulePoll();
      }, backoffMsRef.current);
    };

    const boot = async () => {
      // 1. Paint cached SQLite data immediately (may be empty for a new chain)
      await loadFromDatabase(chainId);

      // 2. Fetch fresh from backend right away
      await fetchAndCache();

      // 3. Poll with exponential backoff (resets to POLL_MIN on success)
      schedulePoll();
    };

    boot();

    // 4. Re-fetch when app returns to foreground
    const onAppStateChange = (next) => {
      const wasBackground = appStateRef.current !== 'active';
      appStateRef.current = next;
      if (next === 'active' && wasBackground) {
        const elapsed = Date.now() - lastFetchMsRef.current;
        if (elapsed >= FOREGROUND_DEBOUNCE) fetchAndCache();
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      isMountedRef.current = false;
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
      sub.remove();
    };
  }, [chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    deployedDAOs,
    totalDAOs,
    isLoading,
    isSyncingBackground,
    error,
    chainId,
    chainName,
    activeChain,
    refresh,
    searchDAOs,
    fetchDAOsByGenre,
    clearFilters,
  };
};
