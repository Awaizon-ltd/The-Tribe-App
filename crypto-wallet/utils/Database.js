// utils/Database.js
import { getDB as _openDB, invalidateDB } from './DBManager';
import { APP_CONFIG } from '../constants/Config';

let db = null;

const isNullPtr = (err) =>
  err?.message?.includes('NullPointerException') ||
  err?.message?.includes('NativeDatabase.prepareAsync');

/**
 * Wraps the raw SQLite connection so every method auto-reconnects once
 * on Android NullPointerException without changing any caller code.
 */
const makeResilient = () => {
  const call = async (method, ...args) => {
    try {
      const raw = await _openDB();
      return await raw[method](...args);
    } catch (err) {
      if (isNullPtr(err)) {
        console.warn('[Database] Stale native handle — reconnecting...');
        invalidateDB();
        const raw = await _openDB();
        return await raw[method](...args);
      }
      throw err;
    }
  };

  return {
    runAsync: (...args) => call('runAsync', ...args),
    getAllAsync: (...args) => call('getAllAsync', ...args),
    getFirstAsync: (...args) => call('getFirstAsync', ...args),
    execAsync: (...args) => call('execAsync', ...args),
    withTransactionAsync: async (fn) => {
      try {
        const raw = await _openDB();
        return await raw.withTransactionAsync(fn);
      } catch (err) {
        if (isNullPtr(err)) {
          invalidateDB();
          const raw = await _openDB();
          return await raw.withTransactionAsync(fn);
        }
        throw err;
      }
    },
  };
};

// Database version for migrations
const CURRENT_DB_VERSION = 11; // Latest: Added wallet_address_cache table

export const initDatabase = async () => {
  try {
    // Open via DBManager so all subsequent getDB() calls return the same handle.
    // makeResilient() wraps it so every db.* call auto-reconnects on NullPointerException.
    await _openDB();
    db = makeResilient();

    // Check current database version
    const versionResult = await db.getFirstAsync('PRAGMA user_version');
    const currentVersion = versionResult.user_version || 0;


    // Initial schema creation
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        encrypted_data TEXT NOT NULL,
        salt TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INTEGER NOT NULL,
        chain_id INTEGER NOT NULL,
        tx_hash TEXT NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        amount TEXT NOT NULL,
        gas_used TEXT,
        gas_price TEXT,
        status TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wallet_id) REFERENCES wallets (id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        chain_id INTEGER NOT NULL,
        address TEXT NOT NULL,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        decimals INTEGER NOT NULL,
        logo TEXT,
        is_visible INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, chain_id, address)
      );
      
      CREATE TABLE IF NOT EXISTS tribes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        genre TEXT,
        logo_url TEXT,
        banner_url TEXT,
        privacy TEXT,
        member_count INTEGER DEFAULT 0,
        created_by TEXT,
        created_at DATETIME,
        updated_at DATETIME,
        token_gating_type TEXT,
        token_gating_address TEXT,
        token_gating_amount TEXT,
        token_gating_name TEXT,
        token_gating_symbol TEXT,
        is_member INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        pin_order INTEGER,
        last_synced DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS tribe_members (
        tribe_id TEXT NOT NULL,
        user_uid TEXT NOT NULL,
        username TEXT,
        status TEXT,
        joined_at DATETIME,
        PRIMARY KEY (tribe_id, user_uid),
        FOREIGN KEY (tribe_id) REFERENCES tribes (id) ON DELETE CASCADE
      );
    `);
    
    // Run migrations
    await runMigrations(currentVersion);
    
    // Create indexes
    await createIndexes();
    return db;
  } catch (error) {
    console.error('[Database] ❌ Initialization error:', error);
    throw error;
  }
};

const runMigrations = async (currentVersion) => {
  
  try {
    // Migration to version 1
    if (currentVersion < 1) {
      await db.execAsync('PRAGMA user_version = 1');
    
    }
    
    // Migration to version 2: Add profile columns
    if (currentVersion < 2) {
    
      
      const tableInfo = await db.getAllAsync('PRAGMA table_info(users)');
      const columnNames = tableInfo.map(col => col.name);
      
      if (!columnNames.includes('username')) {
        await db.execAsync('ALTER TABLE users ADD COLUMN username TEXT');
      }
      
      if (!columnNames.includes('display_name')) {
        await db.execAsync('ALTER TABLE users ADD COLUMN display_name TEXT');
      }
      
      if (!columnNames.includes('bio')) {
        await db.execAsync('ALTER TABLE users ADD COLUMN bio TEXT');
      }
      
      if (!columnNames.includes('profile_image_url')) {
        await db.execAsync('ALTER TABLE users ADD COLUMN profile_image_url TEXT');
      }
      
      await db.execAsync('PRAGMA user_version = 2');
 
    }
    
    // Migration to version 3: Add chat tables
    if (currentVersion < 3) {

      
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          tribe_id TEXT NOT NULL,
          text TEXT NOT NULL,
          user_id TEXT NOT NULL,
          username TEXT NOT NULL,
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
      
      await db.execAsync('PRAGMA user_version = 3');

    }
    
    // Migration to version 4: Add unread tracking
    if (currentVersion < 4) {
 
      
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS chat_read_status (
          tribe_id TEXT NOT NULL,
          user_uid TEXT NOT NULL,
          last_read_timestamp INTEGER NOT NULL,
          last_read_message_id TEXT,
          PRIMARY KEY (tribe_id, user_uid),
          FOREIGN KEY (tribe_id) REFERENCES tribes (id) ON DELETE CASCADE
        );
      `);
      
      await db.execAsync('PRAGMA user_version = 4');

    }
    
    // Migration to version 5: Add tribe management tables
    if (currentVersion < 5) {
    
      
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tribe_moderators (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tribe_id TEXT NOT NULL,
          user_uid TEXT NOT NULL,
          username TEXT NOT NULL,
          user_avatar TEXT,
          role_name TEXT NOT NULL,
          can_lock_chat INTEGER DEFAULT 0,
          can_delete_messages INTEGER DEFAULT 0,
          can_pin_messages INTEGER DEFAULT 0,
          can_ban_members INTEGER DEFAULT 0,
          can_manage_members INTEGER DEFAULT 0,
          added_at INTEGER NOT NULL,
          added_by TEXT NOT NULL,
          UNIQUE(tribe_id, user_uid),
          FOREIGN KEY (tribe_id) REFERENCES tribes (id) ON DELETE CASCADE
        );
        
        CREATE TABLE IF NOT EXISTS tribe_invites (
          id TEXT PRIMARY KEY,
          tribe_id TEXT NOT NULL,
          code TEXT UNIQUE NOT NULL,
          created_by TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER,
          max_uses INTEGER,
          uses INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          FOREIGN KEY (tribe_id) REFERENCES tribes (id) ON DELETE CASCADE
        );
        
        CREATE TABLE IF NOT EXISTS tribe_external_links (
          tribe_id TEXT PRIMARY KEY,
          website_url TEXT,
          twitter_url TEXT,
          discord_url TEXT,
          telegram_url TEXT,
          other_links TEXT,
          updated_at INTEGER,
          updated_by TEXT,
          FOREIGN KEY (tribe_id) REFERENCES tribes (id) ON DELETE CASCADE
        );
      `);
      
      // Check if column exists before adding
      const tribeTableInfo = await db.getAllAsync('PRAGMA table_info(tribes)');
      const tribeColumns = tribeTableInfo.map(col => col.name);
      
      if (!tribeColumns.includes('settings_synced_at')) {
        await db.execAsync('ALTER TABLE tribes ADD COLUMN settings_synced_at INTEGER DEFAULT 0');
      }
      
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_tribe_moderators_tribe ON tribe_moderators(tribe_id);
        CREATE INDEX IF NOT EXISTS idx_tribe_moderators_user ON tribe_moderators(tribe_id, user_uid);
        CREATE INDEX IF NOT EXISTS idx_tribe_invites_code ON tribe_invites(code);
        CREATE INDEX IF NOT EXISTS idx_tribe_invites_tribe ON tribe_invites(tribe_id);
      `);
      
      await db.execAsync('PRAGMA user_version = 5');
      console.log('[Database] ✅ Migration 5 complete');
    }
    
    // Migration to version 6: Add posts system
    if (currentVersion < 6) {
     
      
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tribe_posts (
          id TEXT PRIMARY KEY,
          tribe_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          username TEXT NOT NULL,
          user_avatar TEXT,
          description TEXT NOT NULL,
          image_url TEXT,
          link_preview TEXT,
          likes_count INTEGER DEFAULT 0,
          comments_count INTEGER DEFAULT 0,
          shares_count INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (tribe_id) REFERENCES tribes (id) ON DELETE CASCADE
        );
        
        CREATE TABLE IF NOT EXISTS post_likes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id TEXT NOT NULL,
          tribe_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          username TEXT NOT NULL,
          liked_at INTEGER NOT NULL,
          UNIQUE(post_id, user_id),
          FOREIGN KEY (post_id) REFERENCES tribe_posts (id) ON DELETE CASCADE
        );
        
        CREATE TABLE IF NOT EXISTS post_comments (
          id TEXT PRIMARY KEY,
          post_id TEXT NOT NULL,
          tribe_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          username TEXT NOT NULL,
          user_avatar TEXT,
          comment_text TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (post_id) REFERENCES tribe_posts (id) ON DELETE CASCADE
        );
        
        CREATE TABLE IF NOT EXISTS post_sync_state (
          tribe_id TEXT PRIMARY KEY,
          last_sync_timestamp INTEGER NOT NULL,
          oldest_post_timestamp INTEGER
        );
        
        CREATE INDEX IF NOT EXISTS idx_tribe_posts_tribe ON tribe_posts(tribe_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_tribe_posts_user ON tribe_posts(user_id);
        CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
        CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);
        CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_post_comments_user ON post_comments(user_id);
      `);
      
      await db.execAsync('PRAGMA user_version = 6');

    }
    
    // Migration to version 7: Add DAO tables
    if (currentVersion < 7) {

      
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS daos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dao_address TEXT NOT NULL,
          token_address TEXT NOT NULL,
          chain_id INTEGER NOT NULL,
          chain_name TEXT NOT NULL,
          genre TEXT,
          genre_id INTEGER,
          dao_name TEXT NOT NULL,
          image_url TEXT,
          threshold TEXT NOT NULL,
          quorum INTEGER NOT NULL,
          voting_period_hours INTEGER NOT NULL,
          timelock_period_hours INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          created_at_date TEXT,
          cached_at INTEGER NOT NULL,
          UNIQUE(dao_address, chain_id)
        );
        
        CREATE TABLE IF NOT EXISTS dao_sync_state (
          chain_id INTEGER PRIMARY KEY,
          last_sync_timestamp INTEGER NOT NULL,
          total_daos INTEGER DEFAULT 0,
          last_error TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_daos_chain ON daos(chain_id);
        CREATE INDEX IF NOT EXISTS idx_daos_genre ON daos(genre_id);
        CREATE INDEX IF NOT EXISTS idx_daos_name ON daos(dao_name);
        CREATE INDEX IF NOT EXISTS idx_daos_address ON daos(dao_address);
        CREATE INDEX IF NOT EXISTS idx_daos_cached ON daos(cached_at);
      `);
      
      await db.execAsync('PRAGMA user_version = 7');

    }
    
    // Migration to version 8: Add proposal tables
    if (currentVersion < 8) {

      
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS proposals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          proposal_id INTEGER NOT NULL,
          dao_address TEXT NOT NULL,
          chain_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          amount TEXT,
          recipient TEXT,
          proposal_type INTEGER NOT NULL,
          protocol_action INTEGER,
          new_value TEXT,
          new_token_address TEXT,
          for_votes TEXT NOT NULL,
          against_votes TEXT NOT NULL,
          abstain_votes TEXT NOT NULL,
          status INTEGER NOT NULL,
          timestamp INTEGER NOT NULL,
          queued_timestamp INTEGER,
          creator TEXT NOT NULL,
          cached_at INTEGER NOT NULL,
          UNIQUE(dao_address, chain_id, proposal_id)
        );
        
        CREATE TABLE IF NOT EXISTS user_votes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dao_address TEXT NOT NULL,
          chain_id INTEGER NOT NULL,
          proposal_id INTEGER NOT NULL,
          user_address TEXT NOT NULL,
          vote_option INTEGER NOT NULL,
          vote_weight TEXT NOT NULL,
          voted_at INTEGER NOT NULL,
          UNIQUE(dao_address, chain_id, proposal_id, user_address)
        );
        
        CREATE TABLE IF NOT EXISTS proposal_sync_state (
          dao_address TEXT NOT NULL,
          chain_id INTEGER NOT NULL,
          last_sync_timestamp INTEGER NOT NULL,
          total_proposals INTEGER DEFAULT 0,
          last_error TEXT,
          PRIMARY KEY (dao_address, chain_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_proposals_dao ON proposals(dao_address, chain_id);
        CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
        CREATE INDEX IF NOT EXISTS idx_proposals_type ON proposals(proposal_type);
        CREATE INDEX IF NOT EXISTS idx_proposals_creator ON proposals(creator);
        CREATE INDEX IF NOT EXISTS idx_user_votes_user ON user_votes(user_address);
        CREATE INDEX IF NOT EXISTS idx_user_votes_dao ON user_votes(dao_address, chain_id);
      `);
      
      await db.execAsync('PRAGMA user_version = 8');
 
    }
    
    // Migration to version 9: Add proposal chat tables
    if (currentVersion < 9) {

      
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS proposal_messages (
          id TEXT PRIMARY KEY,
          proposal_id INTEGER NOT NULL,
          dao_address TEXT NOT NULL,
          chain_id INTEGER NOT NULL,
          sender TEXT NOT NULL,
          sender_name TEXT,
          sender_avatar TEXT,
          message TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          is_edited INTEGER DEFAULT 0,
          edited_at INTEGER,
          reply_to_id TEXT,
          cached_at INTEGER NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS chat_auth (
          proposal_key TEXT PRIMARY KEY,
          user_address TEXT NOT NULL,
          auth_signature TEXT NOT NULL,
          auth_message TEXT NOT NULL,
          authenticated_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS proposal_chat_sync (
          proposal_key TEXT PRIMARY KEY,
          last_sync_timestamp INTEGER NOT NULL,
          message_count INTEGER DEFAULT 0,
          last_error TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_proposal_messages_proposal 
          ON proposal_messages(dao_address, chain_id, proposal_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_proposal_messages_sender 
          ON proposal_messages(sender);
        CREATE INDEX IF NOT EXISTS idx_chat_auth_address 
          ON chat_auth(user_address);
      `);
      
      await db.execAsync('PRAGMA user_version = 9');

    }
    
    // Migration to version 10: Add display_name to chat_messages
    if (currentVersion < 10) {

      
      try {
        // Check if column exists first
        const chatTableInfo = await db.getAllAsync('PRAGMA table_info(chat_messages)');
        const chatColumns = chatTableInfo.map(col => col.name);
        
        if (!chatColumns.includes('display_name')) {
          await db.execAsync(`
            ALTER TABLE chat_messages ADD COLUMN display_name TEXT;
          `);
    
        } else {
          console.log('[Database] ℹ️  display_name column already exists in chat_messages');
        }
      } catch (error) {
        // Column might already exist if manually added
        if (!error.message.includes('duplicate column name')) {
          throw error;
        }
        console.log('[Database] ℹ️  display_name column already exists (caught error)');
      }
      
      await db.execAsync('PRAGMA user_version = 10');
      console.log('[Database] ✅ Migration 10 complete');
    }

    // Migration to version 11: Add wallet_address_cache for fast startup
    if (currentVersion < 11) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS wallet_address_cache (
          uid TEXT PRIMARY KEY,
          address TEXT NOT NULL,
          name TEXT,
          accounts TEXT,
          active_account_index INTEGER DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await db.execAsync('PRAGMA user_version = 11');
      console.log('[Database] ✅ Migration 11 complete');
    }

    // Migration to version 12: Token balance + price cache for stale-while-revalidate
    if (currentVersion < 12) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS token_balance_cache (
          cache_key        TEXT    PRIMARY KEY,
          balance          TEXT    NOT NULL DEFAULT '0',
          price_usd        REAL,
          price_change_24h REAL,
          fetched_at       INTEGER NOT NULL
        );
      `);
      await db.execAsync('PRAGMA user_version = 12');
      console.log('[Database] ✅ Migration 12 complete');
    }

    console.log('[Database] ✅ All migrations complete');
  } catch (error) {
    console.error('[Database] ❌ Migration error:', error);
    throw error;
  }
};

const createIndexes = async () => {
  try {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);
      CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
      CREATE INDEX IF NOT EXISTS idx_tokens_user_chain ON tokens(user_id, chain_id);
      CREATE INDEX IF NOT EXISTS idx_tribes_member ON tribes(is_member);
      CREATE INDEX IF NOT EXISTS idx_tribes_pinned ON tribes(is_pinned, pin_order);
      CREATE INDEX IF NOT EXISTS idx_tribes_genre ON tribes(genre);
      CREATE INDEX IF NOT EXISTS idx_tribes_updated ON tribes(updated_at);
      CREATE INDEX IF NOT EXISTS idx_tribe_members_tribe ON tribe_members(tribe_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_tribe ON chat_messages(tribe_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(tribe_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_pinned ON chat_messages(tribe_id, is_pinned, created_at DESC);
    `);
    console.log('[Database] ✅ Indexes created');
  } catch (error) {
    console.error('[Database] ❌ Error creating indexes:', error);
  }
};

export const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
};

// ============ USER OPERATIONS ============

export const saveUser = async (uid, email, profileData = {}) => {
  const db = getDatabase();
  
  console.log('[Database] 💾 Saving/updating user:', uid);
  
  // First, check if user exists
  const existingUser = await db.getFirstAsync(
    'SELECT * FROM users WHERE uid = ?',
    [uid]
  );
  
  if (existingUser) {
    console.log('[Database] ✅ User exists, updating:', existingUser.id);
    
    // Update existing user
    await db.runAsync(
      `UPDATE users 
       SET email = ?, 
           username = ?, 
           display_name = ?, 
           bio = ?, 
           profile_image_url = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE uid = ?`,
      [
        email,
        profileData.username || existingUser.username,
        profileData.displayName || existingUser.display_name,
        profileData.bio || existingUser.bio,
        profileData.profileImageUrl || existingUser.profile_image_url,
        uid
      ]
    );
    
    console.log('[Database] ✅ User updated, ID remains:', existingUser.id);
    return existingUser.id;
  } else {
    console.log('[Database] ➕ Creating new user');
    
    // Insert new user
    const result = await db.runAsync(
      `INSERT INTO users 
       (uid, email, username, display_name, bio, profile_image_url, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        uid,
        email,
        profileData.username || null,
        profileData.displayName || null,
        profileData.bio || null,
        profileData.profileImageUrl || null
      ]
    );
    
    console.log('[Database] ✅ New user created with ID:', result.lastInsertRowId);
    return result.lastInsertRowId;
  }
};

export const getUserByUid = async (uid) => {
  const db = getDatabase();
  
  console.log('[Database] 🔍 Getting user by UID:', uid);
  
  const user = await db.getFirstAsync(
    'SELECT * FROM users WHERE uid = ?',
    [uid]
  );
  
  if (user) {
    console.log('[Database] ✅ User found:', {
      id: user.id,
      uid: user.uid,
      email: user.email
    });
  } else {
    console.log('[Database] ⚠️ User not found for UID:', uid);
  }
  
  return user;
};

export const getUserByUsername = async (username) => {
  const db = getDatabase();
  return await db.getFirstAsync('SELECT * FROM users WHERE username = ?', [username]);
};

export const updateUserProfile = async (uid, profileData) => {
  const db = getDatabase();
  const fields = [];
  const values = [];
  
  if (profileData.username !== undefined) {
    fields.push('username = ?');
    values.push(profileData.username);
  }
  if (profileData.displayName !== undefined) {
    fields.push('display_name = ?');
    values.push(profileData.displayName);
  }
  if (profileData.bio !== undefined) {
    fields.push('bio = ?');
    values.push(profileData.bio);
  }
  if (profileData.profileImageUrl !== undefined) {
    fields.push('profile_image_url = ?');
    values.push(profileData.profileImageUrl);
  }
  
  if (fields.length === 0) return;
  
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(uid);
  
  await db.runAsync(
    `UPDATE users SET ${fields.join(', ')} WHERE uid = ?`,
    values
  );
};

export const checkLocalUsernameExists = async (username) => {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM users WHERE username = ?',
    [username]
  );
  return result.count > 0;
};

// ============ WALLET OPERATIONS ============

export const saveWallet = async (userId, name, address, encryptedData, salt, isPrimary = false) => {
  const db = getDatabase();
  
  if (isPrimary) {
    await db.runAsync('UPDATE wallets SET is_primary = 0 WHERE user_id = ?', [userId]);
  }
  
  const result = await db.runAsync(
    'INSERT INTO wallets (user_id, name, address, encrypted_data, salt, is_primary) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, name, address, encryptedData, salt, isPrimary ? 1 : 0]
  );
  return result.lastInsertRowId;
};

export const getWalletsByUserId = async (userId) => {
  const db = getDatabase();
  return await db.getAllAsync('SELECT * FROM wallets WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC', [userId]);
};

export const getPrimaryWallet = async (userId) => {
  const db = getDatabase();
  return await db.getFirstAsync('SELECT * FROM wallets WHERE user_id = ? AND is_primary = 1', [userId]);
};

export const updateWalletName = async (walletId, name) => {
  const db = getDatabase();
  await db.runAsync('UPDATE wallets SET name = ? WHERE id = ?', [name, walletId]);
};

export const deleteWallet = async (walletId) => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM wallets WHERE id = ?', [walletId]);
};

// ============ TRANSACTION OPERATIONS ============

export const saveTransaction = async (walletId, chainId, txData) => {
  const db = getDatabase();
  const result = await db.runAsync(
    'INSERT INTO transactions (wallet_id, chain_id, tx_hash, from_address, to_address, amount, gas_used, gas_price, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      walletId,
      chainId,
      txData.hash,
      txData.from,
      txData.to,
      txData.amount,
      txData.gasUsed || null,
      txData.gasPrice || null,
      txData.status,
    ]
  );
  return result.lastInsertRowId;
};

export const getTransactionsByWallet = async (walletId, limit = 50) => {
  const db = getDatabase();
  return await db.getAllAsync(
    'SELECT * FROM transactions WHERE wallet_id = ? ORDER BY timestamp DESC LIMIT ?',
    [walletId, limit]
  );
};

export const updateTransactionStatus = async (txHash, status, gasUsed, gasPrice) => {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE transactions SET status = ?, gas_used = ?, gas_price = ? WHERE tx_hash = ?',
    [status, gasUsed, gasPrice, txHash]
  );
};

// ============ CONTACT OPERATIONS ============

export const saveContact = async (userId, name, address) => {
  const db = getDatabase();
  const result = await db.runAsync(
    'INSERT INTO contacts (user_id, name, address) VALUES (?, ?, ?)',
    [userId, name, address]
  );
  return result.lastInsertRowId;
};

export const getContactsByUserId = async (userId) => {
  const db = getDatabase();
  return await db.getAllAsync('SELECT * FROM contacts WHERE user_id = ? ORDER BY name', [userId]);
};

export const deleteContact = async (contactId) => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM contacts WHERE id = ?', [contactId]);
};

// ============ TOKEN OPERATIONS ============
export const saveToken = async (userId, chainId, tokenData) => {
  const db = getDatabase();
  
  // Ensure types are consistent
  const normalizedUserId = parseInt(userId);
  const normalizedChainId = parseInt(chainId);
  const normalizedAddress = tokenData.address.toLowerCase();
  
  console.log('[Database] 💾 ========== SAVE TOKEN ==========');
  console.log('[Database] 💾 Input:', {
    userId: { original: userId, normalized: normalizedUserId, type: typeof normalizedUserId },
    chainId: { original: chainId, normalized: normalizedChainId, type: typeof normalizedChainId },
    address: normalizedAddress,
    symbol: tokenData.symbol
  });
  
  try {
    // Explicitly include is_visible = 1 so INSERT OR REPLACE never leaves it NULL.
    // Without this, the REPLACE path (delete + insert) can omit the DEFAULT on
    // some expo-sqlite versions, making the token invisible to is_visible = 1 queries.
    const result = await db.runAsync(
      `INSERT OR REPLACE INTO tokens
         (user_id, chain_id, address, name, symbol, decimals, logo, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        normalizedUserId,
        normalizedChainId,
        normalizedAddress,
        tokenData.name,
        tokenData.symbol,
        parseInt(tokenData.decimals),
        tokenData.logo || null,
      ]
    );

    // Verify the row landed correctly
    const saved = await db.getFirstAsync(
      'SELECT id, chain_id, is_visible FROM tokens WHERE user_id = ? AND chain_id = ? AND LOWER(address) = ?',
      [normalizedUserId, normalizedChainId, normalizedAddress],
    );
    console.log('[Database] ✅ Token saved:', { rowId: result.lastInsertRowId, verify: saved });
    return result.lastInsertRowId;
  } catch (error) {
    console.error('[Database] ❌ Error saving token:', error);
    throw error;
  }
};

export const getTokensByChain = async (userId, chainId) => {
  const db = getDatabase();
  return await db.getAllAsync(
    'SELECT * FROM tokens WHERE user_id = ? AND chain_id = ? AND is_visible = 1 ORDER BY symbol',
    [userId, chainId]
  );
};

export const getAllTokens = async (userId) => {
  const db = getDatabase();
  return await db.getAllAsync(
    'SELECT * FROM tokens WHERE user_id = ? AND is_visible = 1 ORDER BY chain_id, symbol',
    [userId]
  );
};

export const deleteToken = async (tokenId) => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM tokens WHERE id = ?', [tokenId]);
};

export const hideToken = async (tokenId) => {
  const db = getDatabase();
  await db.runAsync('UPDATE tokens SET is_visible = 0 WHERE id = ?', [tokenId]);
};

export const showToken = async (tokenId) => {
  const db = getDatabase();
  await db.runAsync('UPDATE tokens SET is_visible = 1 WHERE id = ?', [tokenId]);
};

// ============ TRIBE OPERATIONS ============

export const saveTribeToCache = async (tribeData, isMember = false) => {
  const db = getDatabase();
  const tokenGating = tribeData.tokenGating || {};
  
  const result = await db.runAsync(
    `INSERT OR REPLACE INTO tribes (
      id, name, description, genre, logo_url, banner_url, privacy, member_count, 
      created_by, created_at, updated_at, token_gating_type, token_gating_address, 
      token_gating_amount, token_gating_name, token_gating_symbol, is_member, last_synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      tribeData.id,
      tribeData.name,
      tribeData.description,
      tribeData.genre,
      tribeData.logoUrl,
      tribeData.bannerUrl,
      tribeData.privacy,
      tribeData.memberCount,
      tribeData.createdBy,
      tribeData.createdAt instanceof Date ? tribeData.createdAt.toISOString() : tribeData.createdAt,
      tribeData.updatedAt instanceof Date ? tribeData.updatedAt.toISOString() : tribeData.updatedAt,
      tokenGating.tokenType || null,
      tokenGating.tokenAddress || null,
      tokenGating.minTokenAmount || null,
      tokenGating.name || null,
      tokenGating.symbol || null,
      isMember ? 1 : 0,
    ]
  );
  return result.lastInsertRowId;
};

export const getUserTribes = async (sortByRecent = true) => {
  const db = getDatabase();
  const orderBy = sortByRecent 
    ? 'is_pinned DESC, pin_order ASC, updated_at DESC' 
    : 'is_pinned DESC, pin_order ASC, name ASC';
  
  return await db.getAllAsync(
    `SELECT * FROM tribes WHERE is_member = 1 ORDER BY ${orderBy}`
  );
};

export const getTopTribes = async (limit = 5) => {
  const db = getDatabase();
  return await db.getAllAsync(
    'SELECT * FROM tribes ORDER BY member_count DESC LIMIT ?',
    [limit]
  );
};

export const searchTribes = async (query, genre = null) => {
  const db = getDatabase();
  let sql = 'SELECT * FROM tribes WHERE (name LIKE ? OR description LIKE ?)';
  const params = [`%${query}%`, `%${query}%`];
  
  if (genre) {
    sql += ' AND genre = ?';
    params.push(genre);
  }
  
  sql += ' ORDER BY member_count DESC LIMIT 20';
  
  return await db.getAllAsync(sql, params);
};

export const getTribeById = async (tribeId) => {
  const db = getDatabase();
  return await db.getFirstAsync('SELECT * FROM tribes WHERE id = ?', [tribeId]);
};

export const togglePinTribe = async (tribeId) => {
  const db = getDatabase();
  const tribe = await getTribeById(tribeId);
  if (!tribe) return;
  
  if (tribe.is_pinned) {
    await db.runAsync(
      'UPDATE tribes SET is_pinned = 0, pin_order = NULL WHERE id = ?',
      [tribeId]
    );
    await db.runAsync(
      'UPDATE tribes SET pin_order = pin_order - 1 WHERE is_pinned = 1 AND pin_order > ?',
      [tribe.pin_order]
    );
  } else {
    const pinned = await db.getAllAsync(
      'SELECT * FROM tribes WHERE is_pinned = 1 ORDER BY pin_order'
    );
    
    if (pinned.length >= 2) {
      throw new Error('Maximum 2 tribes can be pinned');
    }
    
    const nextOrder = pinned.length;
    await db.runAsync(
      'UPDATE tribes SET is_pinned = 1, pin_order = ? WHERE id = ?',
      [nextOrder, tribeId]
    );
  }
};

export const updateTribeMemberStatus = async (tribeId, isMember) => {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE tribes SET is_member = ? WHERE id = ?',
    [isMember ? 1 : 0, tribeId]
  );
};

export const deleteTribeFromCache = async (tribeId) => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM tribes WHERE id = ?', [tribeId]);
};

export const clearTribeCache = async () => {
  const db = getDatabase();
  await db.execAsync('DELETE FROM tribes; DELETE FROM tribe_members;');
};

// ============ CHAT MESSAGE OPERATIONS ============

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
      message.displayName || null, // ✅ ADDED
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

export const batchCacheMessages = async (tribeId, messages) => {
  const db = getDatabase();
  
  await db.withTransactionAsync(async () => {
    for (const message of messages) {
      await cacheMessage(tribeId, message);
    }
  });
};

export const getCachedMessages = async (tribeId, limit = 30, beforeTimestamp = null) => {
  const db = getDatabase();
  
  let query = 'SELECT * FROM chat_messages WHERE tribe_id = ?';
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
    text: row.text,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name, // ✅ ADDED
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
    displayName: row.display_name, // ✅ ADDED
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

export const deleteCachedMessage = async (tribeId, messageId) => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM chat_messages WHERE tribe_id = ? AND id = ?', [tribeId, messageId]);
};

export const deleteCachedUserMessages = async (tribeId, userId) => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM chat_messages WHERE tribe_id = ? AND user_id = ?', [tribeId, userId]);
};

export const clearCachedMessages = async (tribeId) => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM chat_messages WHERE tribe_id = ?', [tribeId]);
};

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

export const getCachedMessageCount = async (tribeId) => {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM chat_messages WHERE tribe_id = ?',
    [tribeId]
  );
  return result.count;
};

export const messageExistsInCache = async (tribeId, messageId) => {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM chat_messages WHERE tribe_id = ? AND id = ?',
    [tribeId, messageId]
  );
  return result.count > 0;
};

export const clearOldMessages = async (daysOld = 30) => {
  const db = getDatabase();
  const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  
  await db.runAsync(
    'DELETE FROM chat_messages WHERE created_at < ?',
    [cutoff]
  );
};

export const getCacheStats = async (tribeId) => {
  const db = getDatabase();
  
  const stats = await db.getFirstAsync(`
    SELECT 
      COUNT(*) as message_count,
      MIN(created_at) as oldest_message,
      MAX(created_at) as newest_message,
      SUM(LENGTH(text)) as total_size
    FROM chat_messages
    WHERE tribe_id = ?
  `, [tribeId]);
  
  return {
    messageCount: stats.message_count,
    oldestMessage: stats.oldest_message ? new Date(stats.oldest_message) : null,
    newestMessage: stats.newest_message ? new Date(stats.newest_message) : null,
    totalSize: stats.total_size ? `${(stats.total_size / 1024).toFixed(2)} KB` : '0 KB',
  };
};

// ============ WALLET ADDRESS CACHE ============
// Stores only public wallet data (address, name, accounts) keyed by Firebase UID.
// Lets WalletContext read the address from SQLite on startup without touching SecureStore.

export const saveWalletAddressCache = async (uid, address, name, accounts = [], activeIndex = 0) => {
  const db = getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO wallet_address_cache
       (uid, address, name, accounts, active_account_index, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [uid, address, name || null, JSON.stringify(accounts), activeIndex],
  );
};

export const getWalletAddressCache = async (uid) => {
  const db = getDatabase();
  const row = await db.getFirstAsync(
    'SELECT * FROM wallet_address_cache WHERE uid = ?',
    [uid],
  );
  if (!row) return null;
  return {
    address: row.address,
    name: row.name,
    accounts: row.accounts ? JSON.parse(row.accounts) : [],
    activeIndex: row.active_account_index ?? 0,
  };
};

export const clearWalletAddressCache = async (uid) => {
  const db = getDatabase();
  await db.runAsync('DELETE FROM wallet_address_cache WHERE uid = ?', [uid]);
};

// ============ UTILITY OPERATIONS ============

export const clearAllData = async () => {
  const db = getDatabase();
  await db.execAsync(`
    DELETE FROM tokens;
    DELETE FROM contacts;
    DELETE FROM transactions;
    DELETE FROM wallets;
    DELETE FROM users;
    DELETE FROM tribes;
    DELETE FROM tribe_members;
    DELETE FROM chat_messages;
    DELETE FROM chat_settings;
    DELETE FROM chat_sync_state;
    DELETE FROM daos;
    DELETE FROM dao_sync_state;
    DELETE FROM wallet_address_cache;
  `);
};

export default {
  initDatabase,
  getDatabase,
  saveUser,
  getUserByUid,
  getUserByUsername,
  updateUserProfile,
  checkLocalUsernameExists,
  saveWallet,
  getWalletsByUserId,
  getPrimaryWallet,
  updateWalletName,
  deleteWallet,
  saveTransaction,
  getTransactionsByWallet,
  updateTransactionStatus,
  saveContact,
  getContactsByUserId,
  deleteContact,
  saveToken,
  getTokensByChain,
  getAllTokens,
  deleteToken,
  hideToken,
  showToken,
  saveTribeToCache,
  getUserTribes,
  getTopTribes,
  searchTribes,
  getTribeById,
  togglePinTribe,
  updateTribeMemberStatus,
  deleteTribeFromCache,
  clearTribeCache,
  cacheMessage,
  batchCacheMessages,
  getCachedMessages,
  getCachedPinnedMessages,
  updateCachedMessage,
  deleteCachedMessage,
  deleteCachedUserMessages,
  clearCachedMessages,
  getChatSettings,
  saveChatSettings,
  getSyncState,
  updateSyncState,
  getCachedMessageCount,
  messageExistsInCache,
  clearOldMessages,
  getCacheStats,
  clearAllData,
  saveWalletAddressCache,
  getWalletAddressCache,
  clearWalletAddressCache,
};