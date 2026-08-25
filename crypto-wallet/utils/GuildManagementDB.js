// Add these to your database.js file

import { getDatabase } from "./Database";



// ============ Guild Moderator Operations ============

export const addModerator = async (guildId, moderatorData) => {
  const db = getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO guild_moderators 
    (guild_id, user_uid, username, user_avatar, role_name, can_lock_chat, 
     can_delete_messages, can_pin_messages, can_ban_members, can_manage_members,
     added_at, added_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      guildId,
      moderatorData.userUid,
      moderatorData.username,
      moderatorData.userAvatar || null,
      moderatorData.roleName,
      moderatorData.permissions.canLockChat ? 1 : 0,
      moderatorData.permissions.canDeleteMessages ? 1 : 0,
      moderatorData.permissions.canPinMessages ? 1 : 0,
      moderatorData.permissions.canBanMembers ? 1 : 0,
      moderatorData.permissions.canManageMembers ? 1 : 0,
      Date.now(),
      moderatorData.addedBy,
    ]
  );
};

export const getModerators = async (guildId) => {
  const db = getDatabase();
  const results = await db.getAllAsync(
    'SELECT * FROM guild_moderators WHERE guild_id = ? ORDER BY added_at DESC',
    [guildId]
  );
  
  return results.map(row => ({
    id: row.id,
    userUid: row.user_uid,
    username: row.username,
    userAvatar: row.user_avatar,
    roleName: row.role_name,
    permissions: {
      canLockChat: row.can_lock_chat === 1,
      canDeleteMessages: row.can_delete_messages === 1,
      canPinMessages: row.can_pin_messages === 1,
      canBanMembers: row.can_ban_members === 1,
      canManageMembers: row.can_manage_members === 1,
    },
    addedAt: new Date(row.added_at),
    addedBy: row.added_by,
  }));
};

export const getModeratorRole = async (guildId, userUid) => {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT * FROM guild_moderators WHERE guild_id = ? AND user_uid = ?',
    [guildId, userUid]
  );
  
  if (!result) return null;
  
  return {
    roleName: result.role_name,
    permissions: {
      canLockChat: result.can_lock_chat === 1,
      canDeleteMessages: result.can_delete_messages === 1,
      canPinMessages: result.can_pin_messages === 1,
      canBanMembers: result.can_ban_members === 1,
      canManageMembers: result.can_manage_members === 1,
    },
  };
};

export const removeModerator = async (guildId, userUid) => {
  const db = getDatabase();
  await db.runAsync(
    'DELETE FROM guild_moderators WHERE guild_id = ? AND user_uid = ?',
    [guildId, userUid]
  );
};

export const updateModeratorPermissions = async (guildId, userUid, permissions) => {
  const db = getDatabase();
  
  await db.runAsync(
    `UPDATE guild_moderators 
    SET can_lock_chat = ?, can_delete_messages = ?, can_pin_messages = ?, 
        can_ban_members = ?, can_manage_members = ?
    WHERE guild_id = ? AND user_uid = ?`,
    [
      permissions.canLockChat ? 1 : 0,
      permissions.canDeleteMessages ? 1 : 0,
      permissions.canPinMessages ? 1 : 0,
      permissions.canBanMembers ? 1 : 0,
      permissions.canManageMembers ? 1 : 0,
      guildId,
      userUid,
    ]
  );
};

// ============ Guild Invite Link Operations ============

export const saveInviteLink = async (inviteData) => {
  const db = getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO guild_invites 
    (id, guild_id, code, created_by, created_at, expires_at, max_uses, uses, is_active) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inviteData.id,
      inviteData.guildId,
      inviteData.code,
      inviteData.createdBy,
      inviteData.createdAt,
      inviteData.expiresAt || null,
      inviteData.maxUses || null,
      inviteData.uses || 0,
      inviteData.isActive ? 1 : 0,
    ]
  );
};

export const getGuildInvites = async (guildId) => {
  const db = getDatabase();
  const results = await db.getAllAsync(
    `SELECT * FROM guild_invites 
     WHERE guild_id = ? AND is_active = 1 
     ORDER BY created_at DESC`,
    [guildId]
  );
  
  return results.map(row => ({
    id: row.id,
    guildId: row.guild_id,
    code: row.code,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    uses: row.uses,
    isActive: row.is_active === 1,
  }));
};

export const getInviteByCode = async (code) => {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT * FROM guild_invites WHERE code = ? AND is_active = 1',
    [code]
  );
  
  if (!result) return null;
  
  return {
    id: result.id,
    guildId: result.guild_id,
    code: result.code,
    createdBy: result.created_by,
    createdAt: result.created_at,
    expiresAt: result.expires_at,
    maxUses: result.max_uses,
    uses: result.uses,
    isActive: result.is_active === 1,
  };
};

export const incrementInviteUses = async (code) => {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE guild_invites SET uses = uses + 1 WHERE code = ?',
    [code]
  );
};

export const deactivateInvite = async (inviteId) => {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE guild_invites SET is_active = 0 WHERE id = ?',
    [inviteId]
  );
};

// ============ Guild External Links Operations ============

export const saveExternalLinks = async (guildId, links) => {
  const db = getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO guild_external_links 
    (guild_id, website_url, twitter_url, discord_url, telegram_url, other_links, updated_at, updated_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      guildId,
      links.website || null,
      links.twitter || null,
      links.discord || null,
      links.telegram || null,
      links.other ? JSON.stringify(links.other) : null,
      Date.now(),
      links.updatedBy,
    ]
  );
};

export const getExternalLinks = async (guildId) => {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT * FROM guild_external_links WHERE guild_id = ?',
    [guildId]
  );
  
  if (!result) return null;
  
  return {
    website: result.website_url,
    twitter: result.twitter_url,
    discord: result.discord_url,
    telegram: result.telegram_url,
    other: result.other_links ? JSON.parse(result.other_links) : null,
    updatedAt: result.updated_at ? new Date(result.updated_at) : null,
    updatedBy: result.updated_by,
  };
};

// ============ Guild Settings Sync ============

export const updateGuildName = async (guildId, newName) => {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE guilds SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newName, guildId]
  );
};

export const markGuildSettingsSynced = async (guildId) => {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE guilds SET settings_synced_at = ? WHERE id = ?',
    [Date.now(), guildId]
  );
};

export const needsSettingsSync = async (guildId) => {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT settings_synced_at FROM guilds WHERE id = ?',
    [guildId]
  );
  
  if (!result) return true;
  
  const lastSync = result.settings_synced_at || 0;
  const hourAgo = Date.now() - (60 * 60 * 1000);
  
  return lastSync < hourAgo; // Sync if older than 1 hour
};