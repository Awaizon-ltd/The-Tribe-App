/**
 * TribeCache — Intelligent TTL-based SQLite cache for all tribe data.
 *
 * Cache hierarchy:
 *   L1  React state         managed by hooks, lives for one session
 *   L2  SQLite (this file)  persistent across restarts, TTL-gated
 *   L3  Backend API         only hit when L2 is missing or stale
 *
 * Every public getter returns { data, stale } so callers can:
 *   1. Render cached data immediately
 *   2. Decide whether to revalidate in the background
 *
 * Pattern used throughout hooks:
 *   const { data, stale } = await TribeCache.getMembers(tribeId);
 *   if (data.length) setState(data);           // show instantly
 *   if (stale) fetchFresh().then(save+set);    // silent background refresh
 */

import { withDB } from './DBManager';

// ─── TTLs (ms) ────────────────────────────────────────────────────────────────
export const TTL = {
  TRIBE:       10 * 60_000,  // tribe metadata — admin-only changes
  MEMBERS:      5 * 60_000,  // join/leave events expected
  MEMBERSHIP:   2 * 60_000,  // user's own status (after joining, we force-refresh)
  POSTS:        3 * 60_000,  // new posts arrive frequently
  FEED:         2 * 60_000,  // highest freshness requirement
  MODERATORS:  10 * 60_000,  // rare changes
  GOVERNANCE:   5 * 60_000,  // linked DAOs — changes only when tribe links a DAO
};

// ─── Bootstrap (lazy, safe to call many times) ────────────────────────────────
let _ready = false;

export async function init() {
  if (_ready) return;
  await withDB(async (db) => {
    await db.execAsync(`
      -- TTL + small JSON blobs (membership status, etc.)
      CREATE TABLE IF NOT EXISTS cache_meta (
        key        TEXT    PRIMARY KEY,
        fetched_at INTEGER NOT NULL,
        payload    TEXT
      );

      -- Flat member list per tribe
      CREATE TABLE IF NOT EXISTS cached_tribe_members (
        tribe_id       TEXT    NOT NULL,
        user_id        TEXT    NOT NULL,
        username       TEXT,
        display_name   TEXT,
        user_avatar    TEXT,
        wallet_address TEXT,
        status         TEXT,
        joined_at      INTEGER,
        PRIMARY KEY (tribe_id, user_id)
      );

      -- Tribe-specific posts (TribePostScreen)
      CREATE TABLE IF NOT EXISTS cached_tribe_posts (
        id             TEXT    PRIMARY KEY,
        tribe_id       TEXT    NOT NULL,
        user_id        TEXT,
        username       TEXT,
        user_avatar    TEXT,
        description    TEXT,
        image_url      TEXT,
        likes_count    INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        is_liked       INTEGER DEFAULT 0,
        created_at     INTEGER,
        updated_at     INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_cgp ON cached_tribe_posts(tribe_id, created_at DESC);

      -- Activity feed posts (ActivityFeedScreen)
      CREATE TABLE IF NOT EXISTS cached_feed_posts (
        id               TEXT    PRIMARY KEY,
        tribe_id         TEXT,
        tribe_name       TEXT,
        tribe_logo_url   TEXT,
        user_id          TEXT,
        username         TEXT,
        description      TEXT,
        image_url        TEXT,
        reaction_counts  TEXT,
        my_reaction      TEXT,
        comments_count   INTEGER DEFAULT 0,
        repost_count     INTEGER DEFAULT 0,
        has_reposted     INTEGER DEFAULT 0,
        visibility_score REAL    DEFAULT 0,
        timestamp        INTEGER,
        is_repost        INTEGER DEFAULT 0,
        repost_comment   TEXT,
        original_author  TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_cfp ON cached_feed_posts(timestamp DESC);
    `);
  });
  _ready = true;
}

// ─── Internal TTL helpers ─────────────────────────────────────────────────────

async function isStale(key, ttl) {
  return withDB(async (db) => {
    const row = await db.getFirstAsync(
      'SELECT fetched_at FROM cache_meta WHERE key = ?', [key],
    );
    return !row || Date.now() - row.fetched_at > ttl;
  }).catch(() => true);
}

async function touch(key) {
  return withDB((db) =>
    db.runAsync(
      'INSERT OR REPLACE INTO cache_meta (key, fetched_at) VALUES (?, ?)',
      [key, Date.now()],
    ),
  ).catch(() => {});
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getMembers(tribeId) {
  await init();
  const stale = await isStale(`members:${tribeId}`, TTL.MEMBERS);
  const rows = await withDB((db) =>
    db.getAllAsync(
      `SELECT * FROM cached_tribe_members WHERE tribe_id = ?
       ORDER BY CASE status WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, username ASC`,
      [tribeId],
    ),
  ).catch(() => []);

  return {
    stale,
    data: rows.map((r) => ({
      id:            r.user_id,
      user_id:       r.user_id,
      username:      r.username,
      display_name:  r.display_name,
      userAvatar:    r.user_avatar,
      user_avatar:   r.user_avatar,
      walletAddress: r.wallet_address,
      status:        r.status,
      joined_at:     r.joined_at,
    })),
  };
}

export async function saveMembers(tribeId, members) {
  if (!members?.length) return;
  await init();
  await withDB(async (db) => {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM cached_tribe_members WHERE tribe_id = ?', [tribeId]);
      for (const m of members) {
        await db.runAsync(
          `INSERT OR REPLACE INTO cached_tribe_members
           (tribe_id, user_id, username, display_name, user_avatar, wallet_address, status, joined_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tribeId,
            m.user_id  || m.userId  || m.id,
            m.username,
            m.display_name || m.displayName || null,
            m.user_avatar  || m.userAvatar  || null,
            m.wallet_address || m.walletAddress || null,
            m.status,
            m.joined_at    || m.joinedAt    || null,
          ],
        );
      }
    });
    await db.runAsync(
      'INSERT OR REPLACE INTO cache_meta (key, fetched_at) VALUES (?, ?)',
      [`members:${tribeId}`, Date.now()],
    );
  }).catch(() => {});
}

// ─── Membership status (current user's status in a tribe) ─────────────────────

export async function getMembership(tribeId, userId) {
  await init();
  const key   = `membership:${tribeId}:${userId}`;
  const stale = await isStale(key, TTL.MEMBERSHIP);
  const row   = await withDB((db) =>
    db.getFirstAsync('SELECT payload FROM cache_meta WHERE key = ?', [key]),
  ).catch(() => null);

  return { stale, data: row?.payload ? JSON.parse(row.payload) : null };
}

export async function saveMembership(tribeId, userId, membership) {
  await init();
  const key = `membership:${tribeId}:${userId}`;
  await withDB((db) =>
    db.runAsync(
      'INSERT OR REPLACE INTO cache_meta (key, fetched_at, payload) VALUES (?, ?, ?)',
      [key, Date.now(), JSON.stringify(membership)],
    ),
  ).catch(() => {});
}

export async function clearMembership(tribeId, userId) {
  const key = `membership:${tribeId}:${userId}`;
  await withDB((db) =>
    db.runAsync('DELETE FROM cache_meta WHERE key = ?', [key]),
  ).catch(() => {});
}

// ─── Tribe posts ──────────────────────────────────────────────────────────────

export async function getPosts(tribeId, limit = 10, before = null) {
  await init();
  // Paginated requests never count as "fresh" — always let the caller decide
  const stale = before !== null ? true : await isStale(`posts:${tribeId}`, TTL.POSTS);

  const params = [tribeId];
  let   sql    = 'SELECT * FROM cached_tribe_posts WHERE tribe_id = ?';
  if (before) { sql += ' AND created_at < ?'; params.push(before); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const rows = await withDB((db) => db.getAllAsync(sql, params)).catch(() => []);
  return { stale, data: rows.map(normPostRow) };
}

export async function savePosts(tribeId, posts, { append = false } = {}) {
  if (!posts?.length) return;
  await init();
  await withDB(async (db) => {
    await db.withTransactionAsync(async () => {
      if (!append) await db.runAsync('DELETE FROM cached_tribe_posts WHERE tribe_id = ?', [tribeId]);
      for (const p of posts) {
        await db.runAsync(
          `INSERT OR REPLACE INTO cached_tribe_posts
           (id, tribe_id, user_id, username, user_avatar, description, image_url,
            likes_count, comments_count, is_liked, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id, tribeId,
            p.userId  || p.user_id,
            p.username,
            p.userAvatar || p.user_avatar || null,
            p.description,
            p.imageUrl   || p.image_url   || null,
            p.likesCount    || 0,
            p.commentsCount || 0,
            p.isLiked ? 1 : 0,
            p.timestamp || p.createdAt || Date.now(),
            Date.now(),
          ],
        );
      }
    });
    if (!append) {
      await db.runAsync(
        'INSERT OR REPLACE INTO cache_meta (key, fetched_at) VALUES (?, ?)',
        [`posts:${tribeId}`, Date.now()],
      );
    }
  }).catch(() => {});
}

export async function updatePostLike(postId, isLiked, likesCount) {
  await withDB((db) =>
    db.runAsync(
      'UPDATE cached_tribe_posts SET is_liked = ?, likes_count = ? WHERE id = ?',
      [isLiked ? 1 : 0, likesCount, postId],
    ),
  ).catch(() => {});
}

export async function removePost(postId) {
  await withDB((db) =>
    db.runAsync('DELETE FROM cached_tribe_posts WHERE id = ?', [postId]),
  ).catch(() => {});
}

function normPostRow(r) {
  return {
    id:            r.id,
    userId:        r.user_id,
    username:      r.username,
    userAvatar:    r.user_avatar,
    description:   r.description,
    imageUrl:      r.image_url,
    likesCount:    r.likes_count,
    commentsCount: r.comments_count,
    isLiked:       r.is_liked === 1,
    timestamp:     r.created_at,
    createdAt:     r.created_at,
  };
}

// ─── Activity feed ────────────────────────────────────────────────────────────

export async function getFeed(limit = 20, page = 1) {
  await init();
  const stale  = page > 1 ? true : await isStale('feed', TTL.FEED);
  const offset = (page - 1) * limit;
  const rows   = await withDB((db) =>
    db.getAllAsync(
      'SELECT * FROM cached_feed_posts ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [limit, offset],
    ),
  ).catch(() => []);

  return { stale, data: rows.map(normFeedRow) };
}

export async function saveFeed(posts, { prepend = false, page = 1 } = {}) {
  if (!posts?.length) return;
  await init();
  await withDB(async (db) => {
    await db.withTransactionAsync(async () => {
      if (!prepend && page === 1) await db.runAsync('DELETE FROM cached_feed_posts');
      for (const p of posts) {
        await db.runAsync(
          `INSERT OR REPLACE INTO cached_feed_posts
           (id, tribe_id, tribe_name, tribe_logo_url, user_id, username,
            description, image_url, reaction_counts, my_reaction,
            comments_count, repost_count, has_reposted, visibility_score,
            timestamp, is_repost, repost_comment, original_author)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            p.tribeId          || p.tribe_id,
            p.tribeName        || p.tribe_name,
            p.tribeLogoUrl     || p.tribe_logo_url   || null,
            p.userId           || p.user_id,
            p.username,
            p.description,
            p.imageUrl         || p.image_url        || null,
            JSON.stringify(p.reactionCounts || {}),
            p.myReaction       || null,
            p.commentsCount    || 0,
            p.repostCount      || 0,
            p.hasReposted      ? 1 : 0,
            p.visibilityScore  || 0,
            p.timestamp        || Date.now(),
            p.isRepost         ? 1 : 0,
            p.repostComment    || null,
            p.originalAuthor   || null,
          ],
        );
      }
    });
    if (!prepend && page === 1) {
      await db.runAsync(
        'INSERT OR REPLACE INTO cache_meta (key, fetched_at) VALUES (?, ?)',
        ['feed', Date.now()],
      );
    }
  }).catch(() => {});
}

export async function updateFeedReaction(postId, myReaction, reactionCounts) {
  await withDB((db) =>
    db.runAsync(
      'UPDATE cached_feed_posts SET my_reaction = ?, reaction_counts = ? WHERE id = ?',
      [myReaction, JSON.stringify(reactionCounts || {}), postId],
    ),
  ).catch(() => {});
}

export async function markFeedReposted(postId, repostCount) {
  await withDB((db) =>
    db.runAsync(
      'UPDATE cached_feed_posts SET has_reposted = 1, repost_count = ? WHERE id = ?',
      [repostCount, postId],
    ),
  ).catch(() => {});
}

function normFeedRow(r) {
  return {
    id:              r.id,
    tribeId:         r.tribe_id,
    tribeName:       r.tribe_name,
    tribeLogoUrl:    r.tribe_logo_url,
    userId:          r.user_id,
    username:        r.username,
    description:     r.description,
    imageUrl:        r.image_url,
    reactionCounts:  tryParse(r.reaction_counts, {}),
    myReaction:      r.my_reaction,
    commentsCount:   r.comments_count,
    repostCount:     r.repost_count,
    hasReposted:     r.has_reposted === 1,
    visibilityScore: r.visibility_score,
    timestamp:       r.timestamp,
    isRepost:        r.is_repost === 1,
    repostComment:   r.repost_comment,
    originalAuthor:  r.original_author,
  };
}

// ─── Governance feed ─────────────────────────────────────────────────────────

/**
 * Returns cached linkedDAOs list and a staleness flag.
 * Payload is a JSON array stored in cache_meta under key 'governance'.
 */
export async function getGovernanceFeed() {
  await init();
  const stale = await isStale('governance', TTL.GOVERNANCE);
  const row   = await withDB((db) =>
    db.getFirstAsync('SELECT payload FROM cache_meta WHERE key = ?', ['governance']),
  ).catch(() => null);
  return { stale, data: row?.payload ? tryParse(row.payload, []) : [] };
}

/**
 * Persist the linkedDAOs list returned by the governance feed API.
 */
export async function saveGovernanceFeed(linkedDAOs) {
  if (!Array.isArray(linkedDAOs)) return;
  await init();
  await withDB((db) =>
    db.runAsync(
      'INSERT OR REPLACE INTO cache_meta (key, fetched_at, payload) VALUES (?, ?, ?)',
      ['governance', Date.now(), JSON.stringify(linkedDAOs)],
    ),
  ).catch(() => {});
}

// ─── Targeted invalidation ────────────────────────────────────────────────────

/** Call when a tribe is joined/left, renamed, or the member count changes. */
export async function invalidateTribe(tribeId) {
  await withDB(async (db) => {
    await db.runAsync(
      'DELETE FROM cache_meta WHERE key IN (?, ?)',
      [`members:${tribeId}`, `posts:${tribeId}`],
    );
    await db.runAsync('DELETE FROM cached_tribe_members WHERE tribe_id = ?', [tribeId]);
  }).catch(() => {});
}

/** Call after any post create/delete — next feed load will re-fetch. */
export async function invalidateFeed() {
  await withDB((db) =>
    db.runAsync("DELETE FROM cache_meta WHERE key = 'feed'"),
  ).catch(() => {});
}

/** Call when chat settings or moderators change. */
export async function invalidateMeta(...keys) {
  if (!keys.length) return;
  await withDB((db) =>
    db.runAsync(
      `DELETE FROM cache_meta WHERE key IN (${keys.map(() => '?').join(',')})`,
      keys,
    ),
  ).catch(() => {});
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function tryParse(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; }
  catch { return fallback; }
}
