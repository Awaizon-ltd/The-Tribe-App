// services/GuildApiService.js
// Typed API client for all guild endpoints.
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

// ─── Guild CRUD ───────────────────────────────────────────────────────────────

export const getMyGuilds     = ()                 => get('/guilds');
export const getTopGuilds    = (limit = 10)       => publicGet('/guilds/top', { limit });
export const searchGuilds    = (q, genre)         => publicGet('/guilds/search', { q, genre });
export const getGuild        = (guildId)          => get(`/guilds/${guildId}`);
export const createGuild     = (data)             => post('/guilds', data);
export const updateGuild     = (guildId, data)    => put(`/guilds/${guildId}`, data);
export const deleteGuild     = (guildId)          => del(`/guilds/${guildId}`);

// ─── Membership ───────────────────────────────────────────────────────────────

export const getMembers      = (guildId)          => get(`/guilds/${guildId}/members`);
export const getMembership   = (guildId)          => get(`/guilds/${guildId}/membership`);
export const joinGuild       = (guildId, data)    => post(`/guilds/${guildId}/join`, data);
export const leaveGuild      = (guildId)          => post(`/guilds/${guildId}/leave`);
export const banUser         = (guildId, userId, username) =>
  post(`/guilds/${guildId}/ban/${userId}`, { username });

// ─── Invite links ─────────────────────────────────────────────────────────────

export const getInviteByCode = (code)             => publicGet(`/guilds/invite/${code}`);
export const getInvites      = (guildId)          => get(`/guilds/${guildId}/invites`);
export const createInvite    = (guildId, options) => post(`/guilds/${guildId}/invites`, options);
export const deactivateInvite = (guildId, inviteId) =>
  del(`/guilds/${guildId}/invites/${inviteId}`);

// ─── Chat messages ────────────────────────────────────────────────────────────

export const getMessages     = (guildId, limit, before) =>
  get(`/guilds/${guildId}/messages`, { limit, before });

export const pollMessages    = (guildId, since)   =>
  get(`/guilds/${guildId}/messages/poll`, { since });

export const getPinnedMessages = (guildId)        => get(`/guilds/${guildId}/messages/pinned`);

export const sendMessage     = (guildId, data)    => post(`/guilds/${guildId}/messages`, data);

export const editMessage     = (guildId, messageId, newText) =>
  put(`/guilds/${guildId}/messages/${messageId}`, { newText });

export const deleteMessage   = (guildId, messageId) =>
  del(`/guilds/${guildId}/messages/${messageId}`);

export const pinMessage      = (guildId, messageId) =>
  post(`/guilds/${guildId}/messages/${messageId}/pin`);

export const unpinMessage    = (guildId, messageId) =>
  del(`/guilds/${guildId}/messages/${messageId}/pin`);

export const deleteAllUserMessages = (guildId, userId) =>
  post(`/guilds/${guildId}/messages/batch-delete`, { userId });

export const getUnreadCount  = (guildId)          => get(`/guilds/${guildId}/unread`);
export const resetUnread     = (guildId)          => post(`/guilds/${guildId}/unread/reset`);

// ─── Chat settings ────────────────────────────────────────────────────────────

export const getChatSettings    = (guildId)       => get(`/guilds/${guildId}/settings/chat`);
export const updateChatSettings = (guildId, data) => put(`/guilds/${guildId}/settings/chat`, data);

// ─── Posts ────────────────────────────────────────────────────────────────────

export const getPosts        = (guildId, limit, before) =>
  get(`/guilds/${guildId}/posts`, { limit, before });
export const getPost         = (guildId, postId) =>
  get(`/guilds/${guildId}/posts/${postId}`);

export const createPost      = (guildId, data)    => post(`/guilds/${guildId}/posts`, data);
export const deletePost      = (guildId, postId)  => del(`/guilds/${guildId}/posts/${postId}`);
export const toggleLike      = (guildId, postId, username) =>
  post(`/guilds/${guildId}/posts/${postId}/like`, { username });
export const getPostLikes    = (guildId, postId)  => get(`/guilds/${guildId}/posts/${postId}/likes`);
export const getComments     = (guildId, postId, limit, skip) =>
  get(`/guilds/${guildId}/posts/${postId}/comments`, { limit, skip });
export const addComment      = (guildId, postId, data) =>
  post(`/guilds/${guildId}/posts/${postId}/comments`, data);

// ─── Moderators ───────────────────────────────────────────────────────────────

export const getModerators   = (guildId)          => get(`/guilds/${guildId}/moderators`);
export const addModerator    = (guildId, data)    => post(`/guilds/${guildId}/moderators`, data);
export const removeModerator = (guildId, userId)  => del(`/guilds/${guildId}/moderators/${userId}`);
export const updateModeratorPerms = (guildId, userId, permissions) =>
  put(`/guilds/${guildId}/moderators/${userId}/permissions`, { permissions });

// ─── Feed ─────────────────────────────────────────────────────────────────────

export const getFeed            = (page = 1, limit = 20)  => get('/feed', { page, limit });
export const pollFeed           = (since)                  => get('/feed/poll', { since });
export const getGovernanceFeed  = ()                       => get('/feed/governance');

// ─── Reactions ────────────────────────────────────────────────────────────────

export const reactToPost        = (guildId, postId, reactionType) =>
  post(`/guilds/${guildId}/posts/${postId}/react`, { reactionType });

export const getReactions       = (guildId, postId) =>
  get(`/guilds/${guildId}/posts/${postId}/reactions`);

// ─── Reposts ──────────────────────────────────────────────────────────────────

export const repost             = (guildId, postId, data) =>
  post(`/guilds/${guildId}/posts/${postId}/repost`, data);

export const getRepostStatus    = (guildId, postId) =>
  get(`/guilds/${guildId}/posts/${postId}/repost-status`);

// ─── Impressions ──────────────────────────────────────────────────────────────

export const trackImpression    = (guildId, postId) =>
  post(`/guilds/${guildId}/posts/${postId}/impression`);

// ─── DAO link ─────────────────────────────────────────────────────────────────

export const linkDao   = (guildId, daoAddress, chainId) =>
  post(`/guilds/${guildId}/dao`, { daoAddress, chainId });
export const unlinkDao = (guildId) =>
  del(`/guilds/${guildId}/dao`);

// ─── External links ───────────────────────────────────────────────────────────

export const getExternalLinks    = (guildId)      => get(`/guilds/${guildId}/settings/links`);
export const updateExternalLinks = (guildId, data) => put(`/guilds/${guildId}/settings/links`, data);

// GuildApiService.js additions
export const getMiniApps          = (guildId) => get(`/guilds/${guildId}/miniapps`);
export const installMiniApp       = (guildId, miniAppId, scopes) =>
  post(`/guilds/${guildId}/miniapps/${miniAppId}/install`, { scopes });
export const uninstallMiniApp     = (guildId, miniAppId) =>
  del(`/guilds/${guildId}/miniapps/${miniAppId}`);
export const getMiniAppDirectory  = () => publicGet('/miniapps/directory');

// ─── Mini-apps ──────────────────────────────────────────────────────────────
export const getGuildMiniApps    = (guildId)      => get(`/guilds/${guildId}/miniapps`);



export default {
  getMyGuilds, getTopGuilds, searchGuilds, getGuild, createGuild, updateGuild, deleteGuild,
  getMembers, getMembership, joinGuild, leaveGuild, banUser,
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
  getMiniApps, installMiniApp, uninstallMiniApp, getMiniAppDirectory, getGuildMiniApps,
};
