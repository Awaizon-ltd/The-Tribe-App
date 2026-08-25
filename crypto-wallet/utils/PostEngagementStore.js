// utils/PostEngagementStore.js
// Module-level engagement store.
// Lets useGuildPosts and useActivityFeed share like / reaction / comment
// state without a React context (avoids tree-wide re-renders).
//
// Both hooks publish patches here after every optimistic update.
// Both hooks subscribe and apply incoming patches to their own state.

const _store     = new Map();   // postId -> latest merged patch
const _listeners = new Set();   // (postId, patch) => void

const _notify = (postId) => {
  const patch = _store.get(postId);
  _listeners.forEach(fn => fn(postId, patch));
};

// Merge a partial patch into the store and notify all subscribers.
export const updateEngagement = (postId, patch) => {
  _store.set(postId, { ...(_store.get(postId) || {}), ...patch });
  _notify(postId);
};

// Read the current merged patch for a post (or null).
export const getEngagement = (postId) => _store.get(postId) || null;

// Subscribe to updates. Returns an unsubscribe function.
export const subscribe = (fn) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};

// Clear a post's cached engagement (e.g. on delete).
export const clearEngagement = (postId) => {
  _store.delete(postId);
};
