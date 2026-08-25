import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/GuildApiService';
import {
  getUserGuilds  as dbGetUserGuilds,
  saveGuildToCache,
  togglePinGuild as dbTogglePin,
} from '../utils/Database';

// Normalise a backend guild object into the shape SQLite expects.
// Backend returns snake_case; SQLite columns match; tokenGating lives in JSONB.
function toDbShape(guild) {
  return {
    ...guild,
    // saveGuildToCache reads guildData.tokenGating (camelCase)
    tokenGating: guild.token_gating || guild.tokenGating || {},
  };
}

export const useGuilds = () => {
  const { user } = useAuth();
  const [guilds, setGuilds]   = useState([]);
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
      const cached = await dbGetUserGuilds();
      if (cached.length > 0) setGuilds(applyPins(cached));
    } catch {
      // SQLite read failure is non-fatal — we continue to API fetch
    }

    // 2. Fetch fresh list from backend
    setSyncing(true);
    try {
      const fresh = await api.getMyGuilds();
      if (!Array.isArray(fresh)) return;

      // 3. Persist every guild into SQLite (upsert)
      await Promise.all(
        fresh.map(g => saveGuildToCache(toDbShape(g), true).catch(() => {}))
      );

      // 4. Re-read from SQLite so pin order is authoritative
      const updated = await dbGetUserGuilds().catch(() => fresh);
      setGuilds(applyPins(updated));
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
  const togglePin = useCallback(async (guildId) => {
    // Optimistic UI update
    setGuilds(prev => {
      const guild = prev.find(g => g.id === guildId);
      if (!guild) return prev;
      const newPinned = !(guild.is_pinned === 1);
      const updated   = prev.map(g =>
        g.id === guildId ? { ...g, is_pinned: newPinned ? 1 : 0 } : g,
      );
      return applyPins(updated);
    });

    // Persist to SQLite
    try {
      await dbTogglePin(guildId);
      // Re-read to get correct pin_order values
      const persisted = await dbGetUserGuilds();
      setGuilds(applyPins(persisted));
    } catch (e) {
      console.warn('[useGuilds] togglePin persist failed:', e.message);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user]);

  return { guilds, loading, syncing, error, refresh, togglePin, syncGuilds: load };
};

export const useGuildSearch = () => {
  const [topGuilds, setTopGuilds]         = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);

  const loadTopGuilds = useCallback(async () => {
    try {
      const data = await api.getTopGuilds(5);
      setTopGuilds(data || []);
    } catch {
      // non-fatal
    }
  }, []);

  const search = useCallback(async (query, genre = null) => {
    if (!query.trim()) { setSearchResults([]); return; }
    setLoading(true);
    try {
      const results = await api.searchGuilds(query.trim(), genre || undefined);
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

  useEffect(() => { loadTopGuilds(); }, []);

  return { topGuilds, searchResults, loading, error, search, clearSearch };
};
