// services/TribeApiService.js
// Typed API client for all tribe endpoints.
// Handles Firebase ID token refresh automatically.
import axios from 'axios';
import { APP_CONFIG } from '../constants/Config';
// Use the same auth instance that was initialized with AsyncStorage persistence
// in Firebase.js. Calling getAuth() without arguments can resolve to a
// different instance on React Native and return currentUser = null even when
// the user is logged in.
import { auth } from './Firebase';

const BASE = APP_CONFIG.BACKEND_URL;

// ─── Auth header helper ───────────────────────────────────────────────────────

async function getToken(forceRefresh = false) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  return currentUser.getIdToken(forceRefresh);
}

async function authHeaders(forceRefresh = false) {
  const token = await getToken(forceRefresh);
  return { Authorization: `Bearer ${token}` };
}

// ─── Axios instance with automatic token-refresh retry on 401 ────────────────
// If the backend returns 401 (expired/stale token), we force-refresh the
// Firebase ID token once and replay the request. This covers the window where
// the cached token has expired but Firebase's background refresh hasn't fired.

const client = axios.create({ baseURL: BASE });

client.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const fresh = await getToken(true); // force-refresh from Firebase
        original.headers['Authorization'] = `Bearer ${fresh}`;
        return client.request(original);
      } catch {
        // force-refresh also failed — user session is genuinely gone
      }
    }
    return Promise.reject(err);
  },
);

async function get(path, params = {}) {
  const headers = await authHeaders();
  const res = await client.get(path, { params, headers });
  return res.data.data;
}

async function post(path, body = {}) {
  const headers = await authHeaders();
  const res = await client.post(path, body, { headers });
  return res.data;
}

async function put(path, body = {}) {
  const headers = await authHeaders();
  const res = await client.put(path, body, { headers });
  return res.data;
}

async function del(path, body = {}) {
  const headers = await authHeaders();
  const res = await client.delete(path, { data: body, headers });
  return res.data;
}

// Public get (no auth required)
async function publicGet(path, params = {}) {
  const res = await client.get(path, { params });
  return res.data.data;
}

// ─── Tribe CRUD ───────────────────────────────────────────────────────────────

export const getMyTribes     = ()                 => get('/guilds');
export const getTopTribes    = (limit = 10)       => publicGet('/guilds/top', { limit });
export const searchTribes    = (q, genre)         => publicGet('/guilds/search', { q, genre });
export const getTribe        = (tribeId)          => get(`/guilds/${tribeId}`);
export const createTribe     = (data)             => post('/guilds', data);
export const updateTribe     = (tribeId, data)    => put(`/guilds/${tribeId}`, data);
export const deleteTribe     = (tribeId)          => del(`/guilds/${tribeId}`);

// ─── Membership ───────────────────────────────────────────────────────────────

export const getMembers      = (tribeId)          => get(`/guilds/${tribeId}/members`);
export const getMembership   = (tribeId)          => get(`/guilds/${tribeId}/membership`);
export const joinTribe       = (tribeId, data)    => post(`/guilds/${tribeId}/join`, data);
export const leaveTribe      = (tribeId)          => post(`/guilds/${tribeId}/leave`);
export const banUser         = (tribeId, userId, username) =>
  post(`/guilds/${tribeId}/ban/${userId}`, { username });

// ─── Invite links ─────────────────────────────────────────────────────────────

export const getInviteByCode = (code)             => publicGet(`/guilds/invite/${code}`);
export const getInvites      = (tribeId)          => get(`/guilds/${tribeId}/invites`);
export const createInvite    = (tribeId, options) => post(`/guilds/${tribeId}/invites`, options);
export const deactivateInvite = (tribeId, inviteId) =>
  del(`/guilds/${tribeId}/invites/${inviteId}`);

// ─── Chat messages ────────────────────────────────────────────────────────────

export const getMessages     = (tribeId, limit, before) =>
  get(`/guilds/${tribeId}/messages`, { limit, before });

export const pollMessages    = (tribeId, since)   =>
  get(`/guilds/${tribeId}/messages/poll`, { since });

export const getPinnedMessages = (tribeId)        => get(`/guilds/${tribeId}/messages/pinned`);

export const sendMessage     = (tribeId, data)    => post(`/guilds/${tribeId}/messages`, data);

export const editMessage     = (tribeId, messageId, newText) =>
  put(`/guilds/${tribeId}/messages/${messageId}`, { newText });

export const deleteMessage   = (tribeId, messageId) =>
  del(`/guilds/${tribeId}/messages/${messageId}`);

export const pinMessage      = (tribeId, messageId) =>
  post(`/guilds/${tribeId}/messages/${messageId}/pin`);

export const unpinMessage    = (tribeId, messageId) =>
  del(`/guilds/${tribeId}/messages/${messageId}/pin`);

export const deleteAllUserMessages = (tribeId, userId) =>
  post(`/guilds/${tribeId}/messages/batch-delete`, { userId });

export const getUnreadCount  = (tribeId)          => get(`/guilds/${tribeId}/unread`);
export const resetUnread     = (tribeId)          => post(`/guilds/${tribeId}/unread/reset`);

// ─── Chat settings ────────────────────────────────────────────────────────────

export const getChatSettings    = (tribeId)       => get(`/guilds/${tribeId}/settings/chat`);
export const updateChatSettings = (tribeId, data) => put(`/guilds/${tribeId}/settings/chat`, data);

// ─── Posts ────────────────────────────────────────────────────────────────────

export const getPosts        = (tribeId, limit, before) =>
  get(`/guilds/${tribeId}/posts`, { limit, before });
export const getPost         = (tribeId, postId) =>
  get(`/guilds/${tribeId}/posts/${postId}`);

export const createPost      = (tribeId, data)    => post(`/guilds/${tribeId}/posts`, data);
export const deletePost      = (tribeId, postId)  => del(`/guilds/${tribeId}/posts/${postId}`);
export const toggleLike      = (tribeId, postId, username) =>
  post(`/guilds/${tribeId}/posts/${postId}/like`, { username });
export const getPostLikes    = (tribeId, postId)  => get(`/guilds/${tribeId}/posts/${postId}/likes`);
export const getComments     = (tribeId, postId, limit, skip) =>
  get(`/guilds/${tribeId}/posts/${postId}/comments`, { limit, skip });
export const addComment      = (tribeId, postId, data) =>
  post(`/guilds/${tribeId}/posts/${postId}/comments`, data);

// ─── Moderators ───────────────────────────────────────────────────────────────

export const getModerators   = (tribeId)          => get(`/guilds/${tribeId}/moderators`);
export const addModerator    = (tribeId, data)    => post(`/guilds/${tribeId}/moderators`, data);
export const removeModerator = (tribeId, userId)  => del(`/guilds/${tribeId}/moderators/${userId}`);
export const updateModeratorPerms = (tribeId, userId, permissions) =>
  put(`/guilds/${tribeId}/moderators/${userId}/permissions`, { permissions });

// ─── Feed ─────────────────────────────────────────────────────────────────────

export const getFeed            = (page = 1, limit = 20)  => get('/feed', { page, limit });
export const pollFeed           = (since)                  => get('/feed/poll', { since });
export const getGovernanceFeed  = ()                       => get('/feed/governance');

// ─── Reactions ────────────────────────────────────────────────────────────────

export const reactToPost        = (tribeId, postId, reactionType) =>
  post(`/guilds/${tribeId}/posts/${postId}/react`, { reactionType });

export const getReactions       = (tribeId, postId) =>
  get(`/guilds/${tribeId}/posts/${postId}/reactions`);

// ─── Reposts ──────────────────────────────────────────────────────────────────

export const repost             = (tribeId, postId, data) =>
  post(`/guilds/${tribeId}/posts/${postId}/repost`, data);

export const getRepostStatus    = (tribeId, postId) =>
  get(`/guilds/${tribeId}/posts/${postId}/repost-status`);

// ─── Impressions ──────────────────────────────────────────────────────────────

export const trackImpression    = (tribeId, postId) =>
  post(`/guilds/${tribeId}/posts/${postId}/impression`);

// ─── DAO link ─────────────────────────────────────────────────────────────────

export const linkDao   = (tribeId, daoAddress, chainId) =>
  post(`/guilds/${tribeId}/dao`, { daoAddress, chainId });
export const unlinkDao = (tribeId) =>
  del(`/guilds/${tribeId}/dao`);

// ─── External links ───────────────────────────────────────────────────────────

export const getExternalLinks    = (tribeId)      => get(`/guilds/${tribeId}/settings/links`);
export const updateExternalLinks = (tribeId, data) => put(`/guilds/${tribeId}/settings/links`, data);

// ─── Mini-apps — directory + tribe installs ─────────────────────────────────
export const getMiniAppDirectory = (category, search) =>
  publicGet('/miniapps/directory', { category, search });
export const getMiniApp          = (miniAppId)    => get(`/miniapps/${miniAppId}`);
export const getTribeMiniApps    = (tribeId)      => get(`/guilds/${tribeId}/miniapps`);
export const installMiniApp      = (tribeId, miniAppId, scopes) =>
  post(`/guilds/${tribeId}/miniapps/${miniAppId}/install`, { scopes });
export const uninstallMiniApp    = (tribeId, miniAppId) =>
  del(`/guilds/${tribeId}/miniapps/${miniAppId}`);

// ─── Mini-apps — developer submissions ───────────────────────────────────────
export const getMyMiniApps       = ()             => get('/miniapps/mine');
export const submitMiniApp       = (manifest)     => post('/miniapps', manifest);
export const updateMiniApp       = (miniAppId, updates) => put(`/miniapps/${miniAppId}`, updates);
export const deleteMiniApp       = (miniAppId)    => del(`/miniapps/${miniAppId}`);

// ─── Mini-apps — admin review ────────────────────────────────────────────────
export const getPendingMiniApps  = ()             => get('/miniapps/admin/pending');
export const reviewMiniApp       = (miniAppId, status, reviewNotes) =>
  post(`/miniapps/${miniAppId}/review`, { status, reviewNotes });

// ─── Mini-apps — per-user save data (bridge storage.get/set) ────────────────
export const getMiniAppStorage   = (miniAppId, key) => get(`/miniapps/${miniAppId}/storage/${key}`);
export const setMiniAppStorage   = (miniAppId, key, value) =>
  put(`/miniapps/${miniAppId}/storage/${key}`, { value });


export default {
  getMyTribes, getTopTribes, searchTribes, getTribe, createTribe, updateTribe, deleteTribe,
  getMembers, getMembership, joinTribe, leaveTribe, banUser,
  getInviteByCode, getInvites, createInvite, deactivateInvite,
  getMessages, pollMessages, getPinnedMessages, sendMessage, editMessage,
  deleteMessage, pinMessage, unpinMessage, deleteAllUserMessages,
  getUnreadCount, resetUnread,
  getChatSettings, updateChatSettings,
  getPosts, getPost, createPost, deletePost, toggleLike, getPostLikes, getComments, addComment,
  getModerators, addModerator, removeModerator, updateModeratorPerms,
  getExternalLinks, updateExternalLinks,
  getFeed, pollFeed, getGovernanceFeed,
  reactToPost, getReactions,
  repost, getRepostStatus,
  trackImpression,
  linkDao, unlinkDao,
  // ← added: these existed as named exports above but were missing here,
  // which is why api.default.getMiniAppDirectory (and the other four) was undefined
  getMiniAppDirectory, getMiniApp, getTribeMiniApps, installMiniApp, uninstallMiniApp,
  getMyMiniApps, submitMiniApp, updateMiniApp, deleteMiniApp,
  getPendingMiniApps, reviewMiniApp,
  getMiniAppStorage, setMiniAppStorage,
};
