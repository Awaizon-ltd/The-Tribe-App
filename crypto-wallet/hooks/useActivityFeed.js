// hooks/useActivityFeed.js
// Drives both the Activity and Governance tabs of the feed screen.
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth }     from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';
import api from '../services/GuildApiService';
import * as GuildCache from '../utils/GuildCache';
import { updateEngagement, subscribe as subscribeEngagement } from '../utils/PostEngagementStore';

const POLL_MS   = 8_000;  // poll every 8 s — less aggressive than chat
const PAGE_SIZE = 20;

// ─── Activity feed ────────────────────────────────────────────────────────────

export const useActivityFeed = () => {
  const { user }     = useAuth();
  const { userData } = useUserData();

  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setMore]  = useState(false);
  const [hasMore, setHasMore]   = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [error, setError]       = useState(null);

  const pageRef   = useRef(1);
  const latestTs  = useRef(0);
  const pollTimer = useRef(null);
  const isActive  = useRef(true);

  // ── Initial load (cache-first) ──────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) { setRefresh(true); pageRef.current = 1; }
    else           { setLoading(true); }

    // 1. Show SQLite cache immediately
    if (!isRefresh) {
      const { data: cached, stale: feedStale } = await GuildCache.getFeed(PAGE_SIZE, 1);
      if (cached.length > 0) {
        setPosts(cached);
        latestTs.current = cached[0].timestamp || 0;
        setLoading(false);
        // If fresh enough, skip the API call
        if (!feedStale) { setRefresh(false); return; }
      }
    }

    // 2. Fetch fresh from API
    try {
      const data = await api.getFeed(1, PAGE_SIZE);
      if (!isActive.current) return;

      setPosts(data || []);
      pageRef.current = 1;
      setHasMore((data?.length || 0) === PAGE_SIZE);
      if (data?.length) latestTs.current = data[0].timestamp || 0;
      setError(null);

      // Persist (replaces page 1 in cache)
      GuildCache.saveFeed(data || [], { page: 1 }).catch(() => {});
    } catch (e) {
      setError(e.message);
      // Keep showing cached data — don't blank the list
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    isActive.current = true;
    if (user) load();
    return () => { isActive.current = false; clearInterval(pollTimer.current); };
  }, [user?.uid]);

  // ── Polling (background, silent) ───────────────────────────────────────
  useEffect(() => {
    if (!user || loading) return;

    const poll = async () => {
      if (!isActive.current) return;
      try {
        const fresh = await api.pollFeed(latestTs.current);
        if (!fresh?.length || !isActive.current) return;

        setPosts((prev) => {
          const ids  = new Set(prev.map((p) => p.id));
          const news = fresh.filter((p) => !ids.has(p.id));
          if (!news.length) return prev;
          latestTs.current = news[0].timestamp || latestTs.current;
          return [...news, ...prev];
        });

        // Prepend new posts to cache so the next cold open shows them
        GuildCache.saveFeed(fresh, { prepend: true }).catch(() => {});
      } catch {}
    };

    pollTimer.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollTimer.current);
  }, [user?.uid, loading]);

  // ── Cross-hook engagement sync ─────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeEngagement((postId, patch) => {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const next = { ...p };
        if (patch.isLiked      !== undefined) next.isLiked      = patch.isLiked;
        if (patch.likesCount   !== undefined) next.likesCount   = patch.likesCount;
        if (patch.reactionCounts !== undefined) next.reactionCounts = patch.reactionCounts;
        if (patch.myReaction   !== undefined) next.myReaction   = patch.myReaction;
        if (patch.commentsCount !== undefined) next.commentsCount = patch.commentsCount;
        return next;
      }));
    });
    return unsub;
  }, []);

  // ── Load more ─────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setMore(true);

    const nextPage = pageRef.current + 1;

    try {
      // Try SQLite page first
      const { data: cachedPage } = await GuildCache.getFeed(PAGE_SIZE, nextPage);
      if (cachedPage.length >= PAGE_SIZE) {
        setPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...prev, ...cachedPage.filter((p) => !ids.has(p.id))];
        });
        pageRef.current = nextPage;
        setHasMore(true);
        return;
      }

      // Not enough in cache — hit the API
      const data = await api.getFeed(nextPage, PAGE_SIZE);
      if (!data?.length) { setHasMore(false); return; }

      setPosts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...data.filter((p) => !ids.has(p.id))];
      });
      pageRef.current = nextPage;
      setHasMore(data.length === PAGE_SIZE);
      GuildCache.saveFeed(data, { page: nextPage }).catch(() => {});
    } catch {}
    finally { setMore(false); }
  }, [hasMore, loadingMore]);

  // ── Optimistic reaction ────────────────────────────────────────────────
  const handleReact = useCallback(async (postId, reactionType) => {
    if (!user) return;

    let guildId;
    let newCounts;
    let newReaction;

    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      guildId = p.guildId;
      const wasMyReaction = p.myReaction;
      newCounts = { ...(p.reactionCounts || {}) };
      if (wasMyReaction) newCounts[wasMyReaction] = Math.max((newCounts[wasMyReaction] || 1) - 1, 0);
      const isToggle = wasMyReaction === reactionType;
      if (!isToggle) newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;
      newReaction = isToggle ? null : reactionType;
      GuildCache.updateFeedReaction(postId, newReaction, newCounts).catch(() => {});
      return { ...p, myReaction: newReaction, reactionCounts: newCounts };
    }));

    // Publish to store so guild view can reflect the updated reaction counts
    updateEngagement(postId, { reactionCounts: newCounts, myReaction: newReaction });

    try {
      await api.reactToPost(guildId, postId, reactionType);
    } catch {
      load();
    }
  }, [user, load]);

  // ── Optimistic repost ─────────────────────────────────────────────────
  const handleRepost = useCallback(async (post, comment = null) => {
    if (!user) return;
    try {
      await api.repost(post.guildId, post.id, {
        username:   userData?.username || user.email?.split('@')[0],
        userAvatar: userData?.profilePicture || null,
        comment,
      });
      const newCount = (post.repostCount || 0) + 1;
      setPosts((prev) =>
        prev.map((p) => p.id === post.id
          ? { ...p, hasReposted: true, repostCount: newCount }
          : p,
        ),
      );
      GuildCache.markFeedReposted(post.id, newCount).catch(() => {});
    } catch (e) {
      throw e;
    }
  }, [user, userData]);

  return {
    posts, loading, loadingMore, hasMore, refreshing, error,
    refresh: () => load(true),
    loadMore,
    handleReact,
    handleRepost,
  };
};

// ─── Governance feed ──────────────────────────────────────────────────────────
//
// Cache-first: show SQLite data immediately, revalidate from API in background
// if the cache is stale (>5 min). The DAO list rarely changes so 5 min is fine.

export const useGovernanceFeed = () => {
  const { user } = useAuth();
  const [linkedDAOs, setLinkedDAOs] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      // 1. Show SQLite cache immediately (zero-latency paint)
      const { data: cached, stale } = await GuildCache.getGovernanceFeed();
      if (cached.length && active) {
        setLinkedDAOs(cached);
        setLoading(false);
        if (!stale) return; // fresh — skip network call
      }

      // 2. Fetch fresh from API (background if cache was already shown)
      try {
        const data = await api.getGovernanceFeed();
        if (!active) return;
        const daos = data?.linkedDAOs || [];
        setLinkedDAOs(daos);
        GuildCache.saveGovernanceFeed(daos).catch(() => {});
      } catch {
        // Silently keep cached data on failure
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [user?.uid]);

  return { linkedDAOs, loading };
};
