// Add to your database.js - Posts System (Version 6)

import { getDatabase } from "./Database";

// Update CURRENT_DB_VERSION to 6


// ============ Post Operations ============

export const cachePost = async (tribeId, post) => {
  const db = getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO tribe_posts 
    (id, tribe_id, user_id, username, user_avatar, description, image_url, 
     link_preview, likes_count, comments_count, shares_count, created_at, updated_at, is_deleted) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      post.id,
      tribeId,
      post.userId,
      post.username,
      post.userAvatar || null,
      post.description,
      post.imageUrl || null,
      post.linkPreview ? JSON.stringify(post.linkPreview) : null,
      post.likesCount || 0,
      post.commentsCount || 0,
      post.sharesCount || 0,
      post.createdAt,
      post.updatedAt || null,
      post.isDeleted ? 1 : 0,
    ]
  );
};

export const batchCachePosts = async (tribeId, posts) => {
  const db = getDatabase();
  
  await db.withTransactionAsync(async () => {
    for (const post of posts) {
      await cachePost(tribeId, post);
    }
  });
};

export const getCachedPosts = async (tribeId, limit = 5, beforeTimestamp = null) => {
  const db = getDatabase();
  
  let query = `
    SELECT * FROM tribe_posts 
    WHERE tribe_id = ? AND is_deleted = 0
  `;
  const params = [tribeId];
  
  if (beforeTimestamp) {
    query += ' AND created_at < ?';
    params.push(beforeTimestamp);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  const results = await db.getAllAsync(query, params);
  
  return results.map(row => ({
    id: row.id,
    tribeId: row.tribe_id,
    userId: row.user_id,
    username: row.username,
    userAvatar: row.user_avatar,
    description: row.description,
    imageUrl: row.image_url,
    linkPreview: row.link_preview ? JSON.parse(row.link_preview) : null,
    likesCount: row.likes_count,
    commentsCount: row.comments_count,
    sharesCount: row.shares_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted === 1,
  }));
};

export const updatePostLikesCount = async (postId, increment = true) => {
  const db = getDatabase();
  
  await db.runAsync(
    `UPDATE tribe_posts 
     SET likes_count = likes_count + ? 
     WHERE id = ?`,
    [increment ? 1 : -1, postId]
  );
};

export const updatePostCommentsCount = async (postId, increment = true) => {
  const db = getDatabase();
  
  await db.runAsync(
    `UPDATE tribe_posts 
     SET comments_count = comments_count + ? 
     WHERE id = ?`,
    [increment ? 1 : -1, postId]
  );
};

export const deletePost = async (postId) => {
  const db = getDatabase();
  
  await db.runAsync(
    'UPDATE tribe_posts SET is_deleted = 1 WHERE id = ?',
    [postId]
  );
};

// ============ Like Operations ============

export const addLike = async (postId, tribeId, userId, username) => {
  const db = getDatabase();
  
  await db.runAsync(
    `INSERT OR IGNORE INTO post_likes 
    (post_id, tribe_id, user_id, username, liked_at) 
    VALUES (?, ?, ?, ?, ?)`,
    [postId, tribeId, userId, username, Date.now()]
  );
};

export const removeLike = async (postId, userId) => {
  const db = getDatabase();
  
  await db.runAsync(
    'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
    [postId, userId]
  );
};

export const isPostLiked = async (postId, userId) => {
  const db = getDatabase();
  
  const result = await db.getFirstAsync(
    'SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?',
    [postId, userId]
  );
  
  return !!result;
};

export const getPostLikes = async (postId) => {
  const db = getDatabase();
  
  const results = await db.getAllAsync(
    'SELECT * FROM post_likes WHERE post_id = ? ORDER BY liked_at DESC',
    [postId]
  );
  
  return results.map(row => ({
    userId: row.user_id,
    username: row.username,
    likedAt: row.liked_at,
  }));
};

// ============ Comment Operations ============

export const cacheComment = async (comment) => {
  const db = getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO post_comments 
    (id, post_id, tribe_id, user_id, username, user_avatar, comment_text, created_at, updated_at, is_deleted) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      comment.id,
      comment.postId,
      comment.tribeId,
      comment.userId,
      comment.username,
      comment.userAvatar || null,
      comment.commentText,
      comment.createdAt,
      comment.updatedAt || null,
      comment.isDeleted ? 1 : 0,
    ]
  );
};

export const getCachedComments = async (postId, limit = 20) => {
  const db = getDatabase();
  
  const results = await db.getAllAsync(
    `SELECT * FROM post_comments 
     WHERE post_id = ? AND is_deleted = 0 
     ORDER BY created_at ASC 
     LIMIT ?`,
    [postId, limit]
  );
  
  return results.map(row => ({
    id: row.id,
    postId: row.post_id,
    tribeId: row.tribe_id,
    userId: row.user_id,
    username: row.username,
    userAvatar: row.user_avatar,
    commentText: row.comment_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted === 1,
  }));
};

export const deleteComment = async (commentId) => {
  const db = getDatabase();
  
  await db.runAsync(
    'UPDATE post_comments SET is_deleted = 1 WHERE id = ?',
    [commentId]
  );
};

// ============ Sync State ============

export const getPostSyncState = async (tribeId) => {
  const db = getDatabase();
  
  const result = await db.getFirstAsync(
    'SELECT * FROM post_sync_state WHERE tribe_id = ?',
    [tribeId]
  );
  
  return result ? {
    lastSyncTimestamp: result.last_sync_timestamp,
    oldestPostTimestamp: result.oldest_post_timestamp,
  } : null;
};

export const updatePostSyncState = async (tribeId, timestamp) => {
  const db = getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO post_sync_state 
    (tribe_id, last_sync_timestamp) 
    VALUES (?, ?)`,
    [tribeId, timestamp]
  );
};

export const clearPostCache = async (tribeId) => {
  const db = getDatabase();
  
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM tribe_posts WHERE tribe_id = ?', [tribeId]);
    await db.runAsync('DELETE FROM post_likes WHERE tribe_id = ?', [tribeId]);
    await db.runAsync('DELETE FROM post_comments WHERE tribe_id = ?', [tribeId]);
    await db.runAsync('DELETE FROM post_sync_state WHERE tribe_id = ?', [tribeId]);
  });
};