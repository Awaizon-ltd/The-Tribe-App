import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth }     from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';
import api from '../services/GuildApiService';
import * as GuildCache from '../utils/GuildCache';
import { updateEngagement, subscribe as subscribeEngagement } from '../utils/PostEngagementStore';

const POSTS_PER_PAGE = 10;

export const useGuildPosts = (guildId) => {
  const { user }     = useAuth();
  const { userData } = useUserData();

  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadMore] = useState(false);
  const [hasMore, setHasMore]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [guildInfo, setGuildInfo] = useState(null);

  const oldestTs    = useRef(null);
  const likeDebounce = useRef({});

  // ── Cross-hook engagement sync ────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeEngagement((postId, patch) => {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const next = { ...p };
        if (patch.isLiked      !== undefined) next.isLiked      = patch.isLiked;
        if (patch.likesCount   !== undefined) next.likesCount   = patch.likesCount;
        if (patch.commentsCount !== undefined) next.commentsCount = patch.commentsCount;
        return next;
      }));
    });
    return unsub;
  }, []);

  // ── Initial load (cache-first) ────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    if (!guildId || !user) return;

    const init = async () => {
      // 1. Show SQLite cache immediately — zero network wait
      const { data: cached, stale } = await GuildCache.getPosts(guildId, POSTS_PER_PAGE);
      if (cached.length > 0 && mounted) {
        setPosts(cached);
        oldestTs.current = cached[cached.length - 1].createdAt;
        setLoading(false);
      }

      // 2. Fetch guild info (cheap, cached by useGuilds already)
      try {
        const guild = await api.getGuild(guildId);
        if (mounted && guild) {
          setGuildInfo({ name: guild.name, logoUrl: guild.logo_url || guild.logoUrl || null });
        }
      } catch {}

      // 3. Refresh posts from API only when stale
      if (!stale && cached.length > 0) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const fresh = await api.getPosts(guildId, POSTS_PER_PAGE);
        if (!mounted) return;
        const withLikes = fresh || [];
        setPosts(withLikes);
        if (withLikes.length > 0) oldestTs.current = withLikes[withLikes.length - 1].timestamp;
        setHasMore(withLikes.length === POSTS_PER_PAGE);
        // Persist to SQLite (replace first page)
        GuildCache.savePosts(guildId, withLikes).catch(() => {});
      } catch {
        // Keep showing cached data on API error
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();
    return () => { mounted = false; };
  }, [guildId, user]);

  // ── Load more (cache-first pagination) ────────────────────────────────────
  const loadMorePosts = useCallback(async () => {
    if (!hasMore || loadingMore || !oldestTs.current) return;
    setLoadMore(true);

    try {
      // Try SQLite first — it's instant
      const { data: cachedOlder } = await GuildCache.getPosts(
        guildId, POSTS_PER_PAGE, oldestTs.current,
      );

      if (cachedOlder.length >= POSTS_PER_PAGE) {
        // Full page from cache — no API call needed
        setPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...prev, ...cachedOlder.filter((p) => !ids.has(p.id))];
        });
        oldestTs.current = cachedOlder[cachedOlder.length - 1].createdAt;
        setHasMore(true);
        return;
      }

      // Partial or no cache — fetch from API
      const older = await api.getPosts(guildId, POSTS_PER_PAGE, oldestTs.current);
      if (!older?.length) { setHasMore(false); return; }

      setPosts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...older.filter((p) => !ids.has(p.id))];
      });
      oldestTs.current = older[older.length - 1].timestamp;
      setHasMore(older.length === POSTS_PER_PAGE);
      GuildCache.savePosts(guildId, older, { append: true }).catch(() => {});
    } catch {
      // ignore
    } finally {
      setLoadMore(false);
    }
  }, [guildId, hasMore, loadingMore]);

  // ── Create post ────────────────────────────────────────────────────────────
  // ── Create post ────────────────────────────────────────────────────────────
const createPost = useCallback(async (description, imageUrl = null) => {
  // Was: if (!description?.trim()) return; — this silently dropped
  // image-only posts (no caption) even though CreatePostModal explicitly
  // allows them. The modal is the single source of truth for what counts
  // as a valid post; this hook shouldn't re-validate and diverge from it.
  if (!description?.trim() && !imageUrl) return;

  setCreating(true);
  try {
    const post = await api.createPost(guildId, {
      description:  description?.trim() || '',
      imageUrl:     imageUrl || null,
      username:     userData?.username || user?.email?.split('@')[0] || 'Unknown',
      userAvatar:   userData?.profilePicture || null,
    });
    const newPost = { ...(post.data || post), isLiked: false };
    setPosts((prev) => [newPost, ...prev]);
    // Prepend to cache and invalidate feed (new post might surface there)
    GuildCache.savePosts(guildId, [newPost], { append: true }).catch(() => {});
    GuildCache.invalidateFeed().catch(() => {});
  } finally {
    setCreating(false);
  }
}, [guildId, user, userData]);

  // ── React to post — same emoji system as the activity feed ──────────────────
  const reactToPost = useCallback(async (postId, reactionType) => {
    let newCounts;
    let newReaction;

    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const wasMyReaction = p.myReaction;
      newCounts = { ...(p.reactionCounts || {}) };
      if (wasMyReaction) newCounts[wasMyReaction] = Math.max((newCounts[wasMyReaction] || 1) - 1, 0);
      const isToggle = wasMyReaction === reactionType;
      if (!isToggle) newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;
      newReaction = isToggle ? null : reactionType;
      return { ...p, myReaction: newReaction, reactionCounts: newCounts };
    }));

    updateEngagement(postId, { reactionCounts: newCounts, myReaction: newReaction });

    try {
      await api.reactToPost(guildId, postId, reactionType);
    } catch {
      // Reload on API error to get authoritative state
      const fresh = await api.getPosts(guildId, POSTS_PER_PAGE).catch(() => null);
      if (fresh) setPosts(fresh);
    }
  }, [guildId]);

  // ── Add comment (optimistic count) ────────────────────────────────────────
  const addComment = useCallback(async (postId, text) => {
    if (!text?.trim()) return;
    const comment = await api.addComment(guildId, postId, {
      text:       text.trim(),
      username:   userData?.username || user?.email?.split('@')[0] || 'Unknown',
      userAvatar: userData?.profilePicture || null,
    });
    setPosts((prev) => {
      const updated = prev.map((p) => p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p);
      const post = updated.find(p => p.id === postId);
      if (post) updateEngagement(postId, { commentsCount: post.commentsCount });
      return updated;
    });
    return comment.data || comment;
  }, [guildId, user, userData]);

  // ── Delete post ────────────────────────────────────────────────────────────
  const deletePost = useCallback(async (postId) => {
    await api.deletePost(guildId, postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    GuildCache.removePost(postId).catch(() => {});
    GuildCache.invalidateFeed().catch(() => {});
  }, [guildId]);

  const getPostLikesList = useCallback((postId) => api.getPostLikes(guildId, postId), [guildId]);
  const getPostComments  = useCallback((postId, limit = 30, skip = 0) =>
    api.getComments(guildId, postId, limit, skip), [guildId]);

  return {
    posts, loading, loadingMore, hasMore, creating, guildInfo,
    createPost, reactToPost, addComment, deletePost, loadMorePosts,
    getPostLikesList, getPostComments,
  };
};
