import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/TribeApiService';
import {
  getUserTribes  as dbGetUserTribes,
  saveTribeToCache,
  togglePinTribe as dbTogglePin,
} from '../utils/Database';

// Normalise a backend tribe object into the shape SQLite expects.
// Backend returns snake_case; SQLite columns match; tokenGating lives in JSONB.
function toDbShape(tribe) {
  return {
    ...tribe,
    // saveTribeToCache reads tribeData.tokenGating (camelCase)
    tokenGating: tribe.token_gating || tribe.tokenGating || {},
  };
}

export const useTribes = () => {
  const { user } = useAuth();
  const [tribes, setTribes]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError]     = useState(null);

  // ── Merge helper: apply cached pin state from DB rows ────────────────────────
  const applyPins = (rows) =>
    [...rows].sort((a, b) => (b.is_pinned || 0) - (a.is_pinned || 0));

  // ── Load: SQLite first, then API ─────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return;

    // 1. Show SQLite data immediately (zero network latency)
    try {
      const cached = await dbGetUserTribes();
      if (cached.length > 0) setTribes(applyPins(cached));
    } catch {
      // SQLite read failure is non-fatal — we continue to API fetch
    }

    // 2. Fetch fresh list from backend
    setSyncing(true);
    try {
      const fresh = await api.getMyTribes();
      if (!Array.isArray(fresh)) return;

      // 3. Persist every tribe into SQLite (upsert)
      await Promise.all(
        fresh.map(g => saveTribeToCache(toDbShape(g), true).catch(() => {}))
      );

      // 4. Re-read from SQLite so pin order is authoritative
      const updated = await dbGetUserTribes().catch(() => fresh);
      setTribes(applyPins(updated));
      setError(null);
    } catch (e) {
      setError(e.message);
      // Keep whatever SQLite had — don't blank the list
    } finally {
      setSyncing(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
    setLoading(false);
  }, [load]);

  // ── Toggle pin — persisted in SQLite ────────────────────────────────────────
  const togglePin = useCallback(async (tribeId) => {
    // Optimistic UI update
    setTribes(prev => {
      const tribe = prev.find(g => g.id === tribeId);
      if (!tribe) return prev;
      const newPinned = !(tribe.is_pinned === 1);
      const updated   = prev.map(g =>
        g.id === tribeId ? { ...g, is_pinned: newPinned ? 1 : 0 } : g,
      );
      return applyPins(updated);
    });

    // Persist to SQLite
    try {
      await dbTogglePin(tribeId);
      // Re-read to get correct pin_order values
      const persisted = await dbGetUserTribes();
      setTribes(applyPins(persisted));
    } catch (e) {
      console.warn('[useTribes] togglePin persist failed:', e.message);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user]);

  return { tribes, loading, syncing, error, refresh, togglePin, syncTribes: load };
};

export const useTribeSearch = () => {
  const [topTribes, setTopTribes]         = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);

  const loadTopTribes = useCallback(async () => {
    try {
      const data = await api.getTopTribes(5);
      setTopTribes(data || []);
    } catch {
      // non-fatal
    }
  }, []);

  const search = useCallback(async (query, genre = null) => {
    if (!query.trim()) { setSearchResults([]); return; }
    setLoading(true);
    try {
      const results = await api.searchTribes(query.trim(), genre || undefined);
      setSearchResults(results || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setError(null);
  }, []);

  useEffect(() => { loadTopTribes(); }, []);

  return { topTribes, searchResults, loading, error, search, clearSearch };
};
