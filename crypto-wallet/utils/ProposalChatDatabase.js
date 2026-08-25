// utils/ProposalChatDatabase.js
import { getDatabase } from './Database';

/**
 * Get chat key for indexing
 */
const getChatKey = (daoAddress, chainId, proposalId) => 
  `${daoAddress.toLowerCase()}_${chainId}_${proposalId}`;

/**
 * Cache messages locally
 */
export const cacheMessages = async (daoAddress, chainId, proposalId, messages) => {
  if (!messages || messages.length === 0) return;
  
  const db = getDatabase();
  
  await db.withTransactionAsync(async () => {
    for (const msg of messages) {
      await db.runAsync(
        `INSERT OR REPLACE INTO proposal_messages 
         (id, proposal_id, dao_address, chain_id, sender, sender_name, sender_avatar, 
          message, timestamp, is_edited, edited_at, reply_to_id, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          msg.id,
          proposalId,
          daoAddress.toLowerCase(),
          chainId,
          msg.sender.toLowerCase(),
          msg.senderName || null,
          msg.senderAvatar || null,
          msg.message,
          msg.timestamp,
          msg.isEdited ? 1 : 0,
          msg.editedAt || null,
          msg.replyToId || null,
          Date.now(),
        ]
      );
    }
  });
  
  console.log(`[ProposalChatDB] 💾 Cached ${messages.length} messages`);
};

/**
 * Get cached messages
 */
export const getCachedMessages = async (daoAddress, chainId, proposalId, limit = 50) => {
  const db = getDatabase();
  
  const results = await db.getAllAsync(
    `SELECT * FROM proposal_messages 
     WHERE dao_address = ? AND chain_id = ? AND proposal_id = ?
     ORDER BY timestamp DESC LIMIT ?`,
    [daoAddress.toLowerCase(), chainId, proposalId, limit]
  );
  
  return results.map(row => ({
    id: row.id,
    sender: row.sender,
    senderName: row.sender_name,
    senderAvatar: row.sender_avatar,
    message: row.message,
    timestamp: row.timestamp,
    isEdited: row.is_edited === 1,
    editedAt: row.edited_at,
    replyToId: row.reply_to_id,
  })).reverse();
};

/**
 * Save authentication
 */
export const saveAuth = async (daoAddress, chainId, proposalId, userAddress, signature, message, expiresAt) => {
  const db = getDatabase();
  const chatKey = getChatKey(daoAddress, chainId, proposalId);
  
  await db.runAsync(
    `INSERT OR REPLACE INTO chat_auth 
     (proposal_key, user_address, auth_signature, auth_message, authenticated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [chatKey, userAddress.toLowerCase(), signature, message, Date.now(), expiresAt]
  );
};

/**
 * Get authentication
 */
export const getAuth = async (daoAddress, chainId, proposalId, userAddress) => {
  const db = getDatabase();
  const chatKey = getChatKey(daoAddress, chainId, proposalId);
  
  const result = await db.getFirstAsync(
    `SELECT * FROM chat_auth WHERE proposal_key = ? AND user_address = ?`,
    [chatKey, userAddress.toLowerCase()]
  );
  
  if (!result) return null;
  
  // Check if expired
  if (Date.now() > result.expires_at) {
    await db.runAsync('DELETE FROM chat_auth WHERE proposal_key = ?', [chatKey]);
    return null;
  }
  
  return {
    signature: result.auth_signature,
    message: result.auth_message,
    authenticatedAt: result.authenticated_at,
    expiresAt: result.expires_at,
  };
};

/**
 * Get sync state
 */
export const getSyncState = async (daoAddress, chainId, proposalId) => {
  const db = getDatabase();
  const chatKey = getChatKey(daoAddress, chainId, proposalId);
  
  const result = await db.getFirstAsync(
    'SELECT * FROM proposal_chat_sync WHERE proposal_key = ?',
    [chatKey]
  );
  
  return result ? {
    lastSyncTimestamp: result.last_sync_timestamp,
    messageCount: result.message_count,
  } : null;
};

/**
 * Update sync state
 */
export const updateSyncState = async (daoAddress, chainId, proposalId, lastTimestamp, count) => {
  const db = getDatabase();
  const chatKey = getChatKey(daoAddress, chainId, proposalId);
  
  await db.runAsync(
    `INSERT OR REPLACE INTO proposal_chat_sync 
     (proposal_key, last_sync_timestamp, message_count)
     VALUES (?, ?, ?)`,
    [chatKey, lastTimestamp, count]
  );
};

/**
 * Clear cache for proposal
 */
export const clearCache = async (daoAddress, chainId, proposalId) => {
  const db = getDatabase();
  
  await db.runAsync(
    'DELETE FROM proposal_messages WHERE dao_address = ? AND chain_id = ? AND proposal_id = ?',
    [daoAddress.toLowerCase(), chainId, proposalId]
  );
};