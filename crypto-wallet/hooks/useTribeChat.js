import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth }     from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';
import api from '../services/TribeApiService';
import {
  getCachedMessages,
  batchCacheMessages,
  cacheMessage,
  updateCachedMessage,
  deleteCachedMessage,
  deleteCachedUserMessages,
  getChatSettings  as dbGetSettings,
  saveChatSettings as dbSaveSettings,
  getSyncState,
  updateSyncState,
} from '../utils/Database';

const PAGE_SIZE  = 30;
const POLL_MS    = 3_000;
const EDIT_LIMIT = 15 * 60 * 1000;

// ─── Message normalisation ────────────────────────────────────────────────────
// Every message (API response or SQLite row) is coerced into one canonical shape
// before entering state. `timestamp` is always a plain ms-integer for easy sorting
// and cursor comparisons.
function norm(msg) {
  const ts =
    typeof msg.timestamp  === 'number'  ? msg.timestamp :
    msg.timestamp instanceof Date       ? msg.timestamp.getTime() :
    msg.createdAt instanceof Date       ? msg.createdAt.getTime() :
    typeof msg.createdAt  === 'number'  ? msg.createdAt :
    msg.created_at                      ? new Date(msg.created_at).getTime() :
    Date.now();

  return {
    id:          msg.id,
    text:        msg.text,
    userId:      msg.userId      || msg.user_id,
    username:    msg.username,
    displayName: msg.displayName || msg.display_name || null,
    userAvatar:  msg.userAvatar  || msg.user_avatar  || null,
    timestamp:   ts,
    createdAt:   msg.createdAt instanceof Date ? msg.createdAt : new Date(ts),
    isEdited:    !!msg.isEdited,
    editedAt:    msg.editedAt    || null,
    isPinned:    !!msg.isPinned,
    pinnedAt:    msg.pinnedAt    || null,
    pinnedBy:    msg.pinnedBy    || null,
    replyTo:     msg.replyTo     || null,
    _pending:    msg._pending    || false,
    _failed:     msg._failed     || false,
  };
}

// Merge two message arrays, deduplicate by id, sort DESC (newest first).
// Preserves _pending / _failed flags from existing messages when ids collide.
function merge(existing, incoming) {
  const map = new Map();
  for (const m of existing) map.set(m.id, m);
  for (const m of incoming) {
    // Incoming (real) message wins except for UI-only flags already on existing
    const prev = map.get(m.id);
    map.set(m.id, { ...m, _pending: false, _failed: prev?._failed || false });
  }
  return [...map.values()].sort((a, b) => b.timestamp - a.timestamp);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useTribeChat = (tribeId) => {
  const { user }     = useAuth();
  const { userData } = useUserData();

  // DESC order: messages[0] = newest, messages[last] = oldest
  const [messages, setMessages]         = useState([]);
  const [loading, setLoading]           = useState(true);   // initial empty-cache load
  const [loadingOlder, setLoadingOlder] = useState(false);  // paginating older messages
  const [sending, setSending]           = useState(false);
  const [hasMore, setHasMore]           = useState(true);
  const [isAdmin, setIsAdmin]           = useState(false);
  const [chatSettings, setChatSettings] = useState(null);

  // Cursors (ms integers). latestTimestamp = polling cursor (newest seen).
  // oldestTimestamp = pagination cursor (oldest loaded).
  const latestTs  = useRef(0);
  const oldestTs  = useRef(null);
  const apiEndRef = useRef(false);   // true once API said there are no more old msgs
  const isActiveRef   = useRef(true);
  const lastSendRef   = useRef(0);
  const pollTimerRef  = useRef(null);

  const refreshCursors = (msgs) => {
    if (!msgs.length) return;
    // msgs is DESC: msgs[0]=newest
    if (msgs[0].timestamp > latestTs.current) latestTs.current = msgs[0].timestamp;
    const oldest = msgs[msgs.length - 1].timestamp;
    if (oldestTs.current === null || oldest < oldestTs.current) oldestTs.current = oldest;
  };

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !tribeId) return;
    let mounted = true;

    const init = async () => {
      // 1. Show SQLite cache instantly — no network required.
      try {
        const cached = (await getCachedMessages(tribeId, PAGE_SIZE)).map(norm);
        if (cached.length > 0 && mounted) {
          setMessages(cached);
          refreshCursors(cached);
          setLoading(false); // chat is usable already
        }
      } catch { /* SQLite failure is non-fatal */ }

      // 2. Load settings from SQLite (instant) then refresh from API.
      try {
        const localSettings = await dbGetSettings(tribeId);
        if (localSettings && mounted) setChatSettings(localSettings);
      } catch {}

      // 3. Determine admin status.
      try {
        const tribe = await api.getTribe(tribeId);
        if (mounted) setIsAdmin(tribe?.created_by === user.uid || tribe?.createdBy === user.uid);
      } catch {}

      // 4. Fetch only the messages we don't have yet.
      //    If we have a sync state, poll from that cursor.
      //    If the cache was empty, do a full first-page fetch.
      try {
        const syncState = await getSyncState(tribeId).catch(() => null);
        const since     = syncState?.lastSyncTimestamp || latestTs.current;

        const fresh = since > 0
          ? await api.pollMessages(tribeId, since)
          : await api.getMessages(tribeId, PAGE_SIZE);

        if (fresh?.length > 0 && mounted) {
          const normed = fresh.map(norm);
          setMessages(prev => merge(prev, normed));
          refreshCursors(normed);
          batchCacheMessages(tribeId, normed).catch(() => {});
        }

        // Update sync cursor even when fresh is empty
        if (latestTs.current > 0) {
          updateSyncState(tribeId, latestTs.current, oldestTs.current).catch(() => {});
        }
      } catch { /* keep cached data on API error */ }

      // 5. Refresh settings from API.
      try {
        const s = await api.getChatSettings(tribeId);
        if (s && mounted) {
          const settings = s.data || s;
          setChatSettings(settings);
          dbSaveSettings(tribeId, settings).catch(() => {});
        }
      } catch {}

      if (mounted) setLoading(false);

      // 6. Mark messages as read.
      api.resetUnread(tribeId).catch(() => {});
    };

    init();
    return () => { mounted = false; };
  }, [tribeId, user]);

  // ── Polling ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !tribeId || loading) return;

    const poll = async () => {
      if (!isActiveRef.current) return;
      try {
        const fresh = await api.pollMessages(tribeId, latestTs.current);
        if (fresh?.length > 0) {
          const normed = fresh.map(norm);
          setMessages(prev => merge(prev, normed));
          // Update cursor to the newest message we just got
          const newest = normed.reduce((m, x) => x.timestamp > m ? x.timestamp : m, 0);
          if (newest > latestTs.current) {
            latestTs.current = newest;
            updateSyncState(tribeId, newest, oldestTs.current).catch(() => {});
          }
          batchCacheMessages(tribeId, normed).catch(() => {});
        }
      } catch { /* non-fatal */ }
    };

    pollTimerRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollTimerRef.current);
  }, [tribeId, user, loading]);

  useEffect(() => {
    isActiveRef.current = true;
    return () => { isActiveRef.current = false; };
  }, []);

  // ── Paginate older messages ───────────────────────────────────────────────────
  // Cache-first: ask SQLite before hitting the network.
  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || loadingOlder || oldestTs.current === null) return;
    setLoadingOlder(true);

    try {
      const before = oldestTs.current;

      // 1. SQLite (fast path) — never causes a network round-trip.
      const cached = (await getCachedMessages(tribeId, PAGE_SIZE, before)).map(norm);

      if (cached.length >= PAGE_SIZE) {
        // Full page from cache — show it and assume there may be more.
        setMessages(prev => merge(prev, cached));
        oldestTs.current = cached[cached.length - 1].timestamp;
        return; // don't touch the API
      }

      // Partial hit: show what we have then fetch from API to fill the gap.
      if (cached.length > 0) {
        setMessages(prev => merge(prev, cached));
        oldestTs.current = cached[cached.length - 1].timestamp;
      }

      // 2. API (only when SQLite cache is exhausted).
      if (apiEndRef.current) {
        setHasMore(false);
        return;
      }

      const apiOld = await api.getMessages(tribeId, PAGE_SIZE, before);
      if (!apiOld?.length) {
        apiEndRef.current = true;
        setHasMore(false);
        return;
      }

      const normed = apiOld.map(norm);
      setMessages(prev => merge(prev, normed));
      oldestTs.current = normed[normed.length - 1].timestamp;
      batchCacheMessages(tribeId, normed).catch(() => {});

      if (normed.length < PAGE_SIZE) {
        apiEndRef.current = true;
        setHasMore(false);
      }
    } catch { /* keep hasMore, user can retry */ }
    finally { setLoadingOlder(false); }
  }, [tribeId, hasMore, loadingOlder]);

  // ── Send (optimistic) ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text, replyTo = null) => {
    if (!text?.trim() || !user) return;
    if (chatSettings?.isLocked && !isAdmin) throw new Error('Chat is currently locked');
    if (chatSettings?.messageDelay > 0 && !isAdmin) {
      const wait = Math.ceil(
        (chatSettings.messageDelay * 1000 - (Date.now() - lastSendRef.current)) / 1000,
      );
      if (wait > 0) throw new Error(`Please wait ${wait}s before sending another message`);
    }

    const tempId  = `_tmp_${Date.now()}`;
    const tempMsg = norm({
      id:          tempId,
      text:        text.trim(),
      userId:      user.uid,
      username:    userData?.username    || user.email?.split('@')[0] || 'Unknown',
      displayName: userData?.displayName || null,
      userAvatar:  userData?.profilePicture || null,
      timestamp:   Date.now(),
      _pending:    true,
    });

    // Show instantly — prepend at front (newest at index 0 in DESC array)
    setMessages(prev => [tempMsg, ...prev]);
    setSending(true);

    try {
      const res  = await api.sendMessage(tribeId, {
        text:        text.trim(),
        username:    userData?.username    || user.email?.split('@')[0] || 'Unknown',
        displayName: userData?.displayName || null,
        userAvatar:  userData?.profilePicture || null,
        replyTo:     replyTo || null,
      });

      lastSendRef.current = Date.now();
      const real = norm(res.data || res);

      setMessages(prev => {
        const without = prev.filter(m => m.id !== tempId && m.id !== real.id);
        return [real, ...without].sort((a, b) => b.timestamp - a.timestamp);
      });

      if (real.timestamp > latestTs.current) latestTs.current = real.timestamp;
      cacheMessage(tribeId, real).catch(() => {});
      updateSyncState(tribeId, latestTs.current, oldestTs.current).catch(() => {});
    } catch (err) {
      // Mark as failed — user can tap to retry
      setMessages(prev =>
        prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m),
      );
      throw err;
    } finally {
      setSending(false);
    }
  }, [tribeId, user, userData, chatSettings, isAdmin]);

  // Retry a failed message
  const retrySend = useCallback(async (tempId) => {
    const msg = messages.find(m => m.id === tempId);
    if (!msg) return;
    setMessages(prev => prev.filter(m => m.id !== tempId));
    await sendMessage(msg.text, msg.replyTo);
  }, [messages, sendMessage]);

  // ── Edit (optimistic) ─────────────────────────────────────────────────────────
  const editMessage = useCallback(async (messageId, newText) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || msg.userId !== user?.uid) throw new Error('You can only edit your own messages');
    if (Date.now() - msg.timestamp > EDIT_LIMIT) throw new Error('Edit window expired (15 min)');

    const now = Date.now();
    setMessages(prev =>
      prev.map(m => m.id === messageId
        ? { ...m, text: newText.trim(), isEdited: true, editedAt: new Date(now) }
        : m),
    );
    updateCachedMessage(tribeId, messageId, { text: newText.trim(), isEdited: true, editedAt: now })
      .catch(() => {});

    await api.editMessage(tribeId, messageId, newText);
  }, [tribeId, user, messages]);

  // ── Delete (optimistic) ───────────────────────────────────────────────────────
  const deleteMessage = useCallback(async (messageId) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    deleteCachedMessage(tribeId, messageId).catch(() => {});
    await api.deleteMessage(tribeId, messageId);
  }, [tribeId]);

  // ── Delete all user messages ──────────────────────────────────────────────────
  const deleteAllUserMessages = useCallback(async (userId) => {
    if (!isAdmin) throw new Error('Only admins can delete all user messages');
    setMessages(prev => prev.filter(m => m.userId !== userId));
    deleteCachedUserMessages(tribeId, userId).catch(() => {});
    await api.deleteAllUserMessages(tribeId, userId);
  }, [tribeId, isAdmin]);

  // ── Ban ───────────────────────────────────────────────────────────────────────
  const banUser = useCallback(async (userId, username) => {
    if (!isAdmin) throw new Error('Only admins can ban users');
    await api.banUser(tribeId, userId, username);
    setMessages(prev => prev.filter(m => m.userId !== userId));
    deleteCachedUserMessages(tribeId, userId).catch(() => {});
  }, [tribeId, isAdmin]);

  // ── Pin / Unpin ───────────────────────────────────────────────────────────────
  const pinMessage = useCallback(async (messageId) => {
    if (!isAdmin) throw new Error('Only admins can pin messages');
    await api.pinMessage(tribeId, messageId);
    const now = Date.now();
    setMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, isPinned: true, pinnedAt: new Date(now) } : m),
    );
    updateCachedMessage(tribeId, messageId, { isPinned: true, pinnedAt: now }).catch(() => {});
  }, [tribeId, isAdmin]);

  const unpinMessage = useCallback(async (messageId) => {
    if (!isAdmin) throw new Error('Only admins can unpin messages');
    await api.unpinMessage(tribeId, messageId);
    setMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, isPinned: false } : m),
    );
    updateCachedMessage(tribeId, messageId, { isPinned: false }).catch(() => {});
  }, [tribeId, isAdmin]);

  // ── Chat settings ─────────────────────────────────────────────────────────────
  const updateChatSettings = useCallback(async (settings) => {
    if (!isAdmin) throw new Error('Only admins can update chat settings');
    const updated = await api.updateChatSettings(tribeId, settings);
    const s = updated.data || updated;
    setChatSettings(s);
    dbSaveSettings(tribeId, s).catch(() => {});
  }, [tribeId, isAdmin]);

  return {
    messages,
    loading,
    loadingOlder,
    sending,
    hasMore,
    isAdmin,
    chatSettings,
    sendMessage,
    editMessage,
    deleteMessage,
    deleteAllUserMessages,
    banUser,
    pinMessage,
    unpinMessage,
    updateChatSettings,
    loadMoreMessages,
    retrySend,
  };
};
