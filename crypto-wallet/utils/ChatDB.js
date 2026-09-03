// Add these operations to your existing database.js file

import { getDatabase } from "./Database";

// ============ Chat Message Operations (SQLite Cache) ============

export const initChatTables = async () => {
  const db = getDatabase();
  
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      tribe_id TEXT NOT NULL,
      text TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT,
      user_avatar TEXT,
      created_at INTEGER NOT NULL,
      edited_at INTEGER,
      is_edited INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      pinned_at INTEGER,
      pinned_by TEXT,
      reply_to TEXT,
      FOREIGN KEY (tribe_id) REFERENCES tribes (id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_chat_messages_tribe ON chat_messages(tribe_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(tribe_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_pinned ON chat_messages(tribe_id, is_pinned, created_at DESC);
    
    CREATE TABLE IF NOT EXISTS chat_settings (
      tribe_id TEXT PRIMARY KEY,
      is_locked INTEGER DEFAULT 0,
      message_delay INTEGER DEFAULT 0,
      updated_at INTEGER,
      updated_by TEXT,
      FOREIGN KEY (tribe_id) REFERENCES tribes (id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS chat_sync_state (
      tribe_id TEXT PRIMARY KEY,
      last_sync_timestamp INTEGER NOT NULL,
      oldest_message_timestamp INTEGER,
      FOREIGN KEY (tribe_id) REFERENCES tribes (id) ON DELETE CASCADE
    );
  `);
};

// Save message to cache
export const cacheMessage = async (tribeId, message) => {
  const db = getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO chat_messages 
    (id, tribe_id, text, user_id, username, display_name, user_avatar, created_at, edited_at, 
     is_edited, is_pinned, pinned_at, pinned_by, reply_to) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      tribeId,
      message.text,
      message.userId,
      message.username,
      message.displayName || null, // ADD THIS
      message.userAvatar || null,
      message.createdAt instanceof Date ? message.createdAt.getTime() : message.createdAt,
      message.editedAt ? (message.editedAt instanceof Date ? message.editedAt.getTime() : message.editedAt) : null,
      message.isEdited ? 1 : 0,
      message.isPinned ? 1 : 0,
      message.pinnedAt ? (message.pinnedAt instanceof Date ? message.pinnedAt.getTime() : message.pinnedAt) : null,
      message.pinnedBy || null,
      message.replyTo ? JSON.stringify(message.replyTo) : null,
    ]
  );
};

// Batch cache messages
export const batchCacheMessages = async (tribeId, messages) => {
  const db = getDatabase();
  
  await db.withTransactionAsync(async () => {
    for (const message of messages) {
      await cacheMessage(tribeId, message);
    }
  });
};

// Get cached messages (pagination)
export const getCachedMessages = async (tribeId, limit = 30, beforeTimestamp = null) => {
  const db = getDatabase();
  
  let query = `
    SELECT * FROM chat_messages 
    WHERE tribe_id = ?
  `;
  const params = [tribeId];
  
  if (beforeTimestamp) {
    query += ` AND created_at < ?`;
    params.push(beforeTimestamp);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  
  const results = await db.getAllAsync(query, params);
  
  return results.map(row => ({
    id: row.id,
    text: row.text,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name, // ADD THIS
    userAvatar: row.user_avatar,
    createdAt: new Date(row.created_at),
    editedAt: row.edited_at ? new Date(row.edited_at) : null,
    isEdited: row.is_edited === 1,
    isPinned: row.is_pinned === 1,
    pinnedAt: row.pinned_at ? new Date(row.pinned_at) : null,
    pinnedBy: row.pinned_by,
    replyTo: row.reply_to ? JSON.parse(row.reply_to) : null,
  }));
};

// Get pinned messages
export const getCachedPinnedMessages = async (tribeId) => {
  const db = getDatabase();
  
  const results = await db.getAllAsync(
    `SELECT * FROM chat_messages 
     WHERE tribe_id = ? AND is_pinned = 1 
     ORDER BY pinned_at DESC`,
    [tribeId]
  );
  
  return results.map(row => ({
    id: row.id,
    text: row.text,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name, // ADD THIS
    userAvatar: row.user_avatar,
    createdAt: new Date(row.created_at),
    editedAt: row.edited_at ? new Date(row.edited_at) : null,
    isEdited: row.is_edited === 1,
    isPinned: row.is_pinned === 1,
    pinnedAt: row.pinned_at ? new Date(row.pinned_at) : null,
    pinnedBy: row.pinned_by,
    replyTo: row.reply_to ? JSON.parse(row.reply_to) : null,
  }));
};

// Update cached message
export const updateCachedMessage = async (tribeId, messageId, updates) => {
  const db = getDatabase();
  const fields = [];
  const values = [];
  
  if (updates.text !== undefined) {
    fields.push('text = ?');
    values.push(updates.text);
  }
  if (updates.editedAt !== undefined) {
    fields.push('edited_at = ?');
    values.push(updates.editedAt instanceof Date ? updates.editedAt.getTime() : updates.editedAt);
    fields.push('is_edited = 1');
  }
  if (updates.isPinned !== undefined) {
    fields.push('is_pinned = ?');
    values.push(updates.isPinned ? 1 : 0);
  }
  if (updates.pinnedAt !== undefined) {
    fields.push('pinned_at = ?');
    values.push(updates.pinnedAt instanceof Date ? updates.pinnedAt.getTime() : updates.pinnedAt);
  }
  if (updates.pinnedBy !== undefined) {
    fields.push('pinned_by = ?');
    values.push(updates.pinnedBy);
  }
  
  if (fields.length === 0) return;
  
  values.push(tribeId, messageId);
  
  await db.runAsync(
    `UPDATE chat_messages SET ${fields.join(', ')} WHERE tribe_id = ? AND id = ?`,
    values
  );
};

// Delete cached message
export const deleteCachedMessage = async (tribeId, messageId) => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM chat_messages WHERE tribe_id = ? AND id = ?', [tribeId, messageId]);
};

// Delete all messages from a user
export const deleteCachedUserMessages = async (tribeId, userId) => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM chat_messages WHERE tribe_id = ? AND user_id = ?', [tribeId, userId]);
};

// Clear all cached messages for a tribe
export const clearCachedMessages = async (tribeId) => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM chat_messages WHERE tribe_id = ?', [tribeId]);
};

// Get chat settings
export const getChatSettings = async (tribeId) => {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT * FROM chat_settings WHERE tribe_id = ?',
    [tribeId]
  );
  
  if (!result) return null;
  
  return {
    isLocked: result.is_locked === 1,
    messageDelay: result.message_delay,
    updatedAt: result.updated_at ? new Date(result.updated_at) : null,
    updatedBy: result.updated_by,
  };
};

// Save chat settings
export const saveChatSettings = async (tribeId, settings) => {
  const db = getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO chat_settings 
    (tribe_id, is_locked, message_delay, updated_at, updated_by) 
    VALUES (?, ?, ?, ?, ?)`,
    [
      tribeId,
      settings.isLocked ? 1 : 0,
      settings.messageDelay || 0,
      Date.now(),
      settings.updatedBy,
    ]
  );
};

// Get sync state
export const getSyncState = async (tribeId) => {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT * FROM chat_sync_state WHERE tribe_id = ?',
    [tribeId]
  );
  
  if (!result) return null;
  
  return {
    lastSyncTimestamp: result.last_sync_timestamp,
    oldestMessageTimestamp: result.oldest_message_timestamp,
  };
};

// Update sync state
export const updateSyncState = async (tribeId, lastSyncTimestamp, oldestMessageTimestamp = null) => {
  const db = getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO chat_sync_state 
    (tribe_id, last_sync_timestamp, oldest_message_timestamp) 
    VALUES (?, ?, ?)`,
    [
      tribeId,
      lastSyncTimestamp,
      oldestMessageTimestamp || lastSyncTimestamp,
    ]
  );
};

// Get message count
export const getCachedMessageCount = async (tribeId) => {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM chat_messages WHERE tribe_id = ?',
    [tribeId]
  );
  return result.count;
};

// Check if message exists in cache
export const messageExistsInCache = async (tribeId, messageId) => {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM chat_messages WHERE tribe_id = ? AND id = ?',
    [tribeId, messageId]
  );
  return result.count > 0;
};