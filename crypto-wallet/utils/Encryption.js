import { Buffer } from "buffer";
import {
  randomBytes,
  pbkdf2Sync,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from "react-native-quick-crypto";
import CryptoJS from "crypto-js"; // Only for v1 backward compatibility
import { APP_CONFIG } from "../constants/Config";

// Verify imports are available
if (!randomBytes || !pbkdf2Sync || !scryptSync || !createCipheriv || !createDecipheriv) {
  throw new Error(
    "React Native Quick Crypto is not properly installed!\n" +
      "Run: npm install react-native-quick-crypto\n" +
      "iOS: cd ios && pod install\n" +
      "Then: npx react-native start --reset-cache",
  );
}

if (typeof Buffer === "undefined") {
  throw new Error(
    "Buffer is not available! Install: npm install buffer\n" +
      'Then add to your app entry: import { Buffer } from "buffer"; global.Buffer = Buffer;',
  );
}

// Encryption version constants
export const ENCRYPTION_VERSION = {
  V1: 1, // Legacy CryptoJS
  V2: 2, // React Native Quick Crypto, PBKDF2-SHA256 (production-grade, superseded)
  V3: 3, // React Native Quick Crypto, scrypt (memory-hard KDF + real AAD binding)
};

const CURRENT_VERSION = ENCRYPTION_VERSION.V3;

// V2 Configuration (legacy — kept only to decrypt/migrate existing V2 wallets)
const V2_CONFIG = {
  ITERATIONS: 210000, // OWASP recommended minimum for PBKDF2-SHA256
  KEY_LENGTH: 32, // 256 bits
  SALT_LENGTH: 16, // 128 bits
  IV_LENGTH: 16, // 128 bits for AES-GCM
  TAG_LENGTH: 16, // 128 bits authentication tag
  ALGORITHM: "aes-256-gcm",
  HASH: "sha256",
};

// V3 Configuration — scrypt is memory-hard, a meaningfully stronger defense
// against GPU/ASIC brute-force than PBKDF2, which matters most for the local
// wallet since it's protected by only a 6-digit PIN (~1M possible values).
// Two cost profiles: LOCAL stays interactive (PIN unlock happens on every
// app open, must not feel slow), CLOUD can afford a higher cost since the
// Wallet Backup Password is only entered on cross-device restore, a rare
// operation. The chosen N is stored in the payload itself (`scryptN`) so
// decrypt never has to guess or be told which profile was used to create it.
const V3_CONFIG = {
  KEY_LENGTH: 32, // 256 bits
  SALT_LENGTH: 16, // 128 bits
  IV_LENGTH: 16, // 128 bits for AES-GCM
  TAG_LENGTH: 16, // 128 bits authentication tag
  ALGORITHM: "aes-256-gcm",
  SCRYPT_R: 8,
  SCRYPT_P: 1,
  SCRYPT_N_LOCAL: 65536, // 2^16 — interactive (local PIN)
  SCRYPT_N_CLOUD: 131072, // 2^17 — infrequent (cloud / Wallet Backup Password)
  // scrypt's peak memory use is ~128*N*r bytes (128*131072*8 = 128MiB at the
  // CLOUD profile) — react-native-quick-crypto's default maxmem ceiling is
  // lower than that, so it must be raised explicitly or scrypt throws.
  SCRYPT_MAXMEM: 256 * 1024 * 1024,
};

export const SCRYPT_N_LOCAL = V3_CONFIG.SCRYPT_N_LOCAL;
export const SCRYPT_N_CLOUD = V3_CONFIG.SCRYPT_N_CLOUD;

/**
 * V1 Legacy Functions (CryptoJS - Backward Compatibility Only)
 */
const V1_Crypto = {
  deriveKey: (password, salt) => {
    return CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: APP_CONFIG.ENCRYPTION_ITERATIONS || 10000,
    }).toString();
  },

  decrypt: (encryptedData, password, salt) => {
    try {
      const key = V1_Crypto.deriveKey(password, salt);
      const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
      const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);

      if (!decryptedStr) {
        throw new Error("Invalid password or corrupted data");
      }

      return decryptedStr;
    } catch (error) {
      console.error("V1 decryption error:", error);
      throw new Error("Failed to decrypt data - invalid password");
    }
  },
};

/**
 * V2 Crypto Functions (React Native Quick Crypto, PBKDF2) — legacy, decrypt-only.
 * Kept solely so existing V2 wallets can be read and migrated to V3.
 */
const V2_Crypto = {
  generateRandomBytes: (length) => randomBytes(length),

  deriveKey: (password, salt) => {
    const saltBuffer = typeof salt === "string" ? Buffer.from(salt, "hex") : salt;
    return pbkdf2Sync(
      password,
      saltBuffer,
      V2_CONFIG.ITERATIONS,
      V2_CONFIG.KEY_LENGTH,
      V2_CONFIG.HASH,
    );
  },

  decrypt: async (encryptedData, password, salt, iv, authTag) => {
    try {
      const saltBuffer = Buffer.from(salt, "hex");
      const ivBuffer = Buffer.from(iv, "hex");
      const authTagBuffer = Buffer.from(authTag, "hex");
      const encryptedBuffer = Buffer.from(encryptedData, "hex");

      const key = V2_Crypto.deriveKey(password, saltBuffer);
      const decipher = createDecipheriv(V2_CONFIG.ALGORITHM, key, ivBuffer);
      decipher.setAuthTag(authTagBuffer);

      let decrypted = decipher.update(encryptedBuffer);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString("utf8");
    } catch (error) {
      console.error("V2 decryption error:", error);
      throw new Error(
        "Failed to decrypt data - invalid password or corrupted data",
      );
    }
  },
};

/**
 * V3 Crypto Functions (React Native Quick Crypto, scrypt + AES-256-GCM with AAD)
 */
const V3_Crypto = {
  generateRandomBytes: (length) => randomBytes(length),

  /**
   * Derives a key from password using scrypt (memory-hard).
   * `N` must be supplied by the caller — encrypt() picks it from the
   * requested cost profile; decrypt() reads it back from the stored payload.
   */
  deriveKey: (password, salt, N) => {
    const saltBuffer = typeof salt === "string" ? Buffer.from(salt, "hex") : salt;
    return scryptSync(password, saltBuffer, V3_CONFIG.KEY_LENGTH, {
      N,
      r: V3_CONFIG.SCRYPT_R,
      p: V3_CONFIG.SCRYPT_P,
      maxmem: V3_CONFIG.SCRYPT_MAXMEM,
    });
  },

  /**
   * Encrypts data using AES-256-GCM. `aad` (Additional Authenticated Data),
   * when provided, cryptographically binds the ciphertext to it — e.g. the
   * wallet address, so swapping one user's encrypted blob for another's at
   * rest (Firestore/SecureStore) fails authentication instead of silently
   * decrypting under the wrong identity.
   */
  encrypt: async (data, password, aad, N) => {
    try {
      const salt = V3_Crypto.generateRandomBytes(V3_CONFIG.SALT_LENGTH);
      const iv = V3_Crypto.generateRandomBytes(V3_CONFIG.IV_LENGTH);
      const key = V3_Crypto.deriveKey(password, salt, N);

      const cipher = createCipheriv(V3_CONFIG.ALGORITHM, key, iv);
      if (aad) cipher.setAAD(Buffer.from(String(aad), "utf8"));

      const dataBuffer = Buffer.from(data, "utf8");
      let encrypted = cipher.update(dataBuffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const authTag = cipher.getAuthTag();

      return {
        encrypted: encrypted.toString("hex"),
        salt: salt.toString("hex"),
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
        version: ENCRYPTION_VERSION.V3,
        scryptN: N,
      };
    } catch (error) {
      console.error("V3 encryption error:", error);
      throw new Error("Failed to encrypt data");
    }
  },

  decrypt: async (encryptedData, password, salt, iv, authTag, aad, N) => {
    try {
      const saltBuffer = Buffer.from(salt, "hex");
      const ivBuffer = Buffer.from(iv, "hex");
      const authTagBuffer = Buffer.from(authTag, "hex");
      const encryptedBuffer = Buffer.from(encryptedData, "hex");

      const key = V3_Crypto.deriveKey(password, saltBuffer, N);
      const decipher = createDecipheriv(V3_CONFIG.ALGORITHM, key, ivBuffer);
      if (aad) decipher.setAAD(Buffer.from(String(aad), "utf8"));
      decipher.setAuthTag(authTagBuffer);

      let decrypted = decipher.update(encryptedBuffer);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString("utf8");
    } catch (error) {
      console.error("V3 decryption error:", error);
      throw new Error(
        "Failed to decrypt data - invalid password or corrupted data",
      );
    }
  },
};

/**
 * Unified Encryption API
 */

/**
 * Encrypts wallet data using V3 (current version).
 * @param {object} walletData - plaintext to encrypt (JSON-stringified internally)
 * @param {string} password - passphrase (local PIN or Wallet Backup Password)
 * @param {string|null} aad - Additional Authenticated Data (the wallet address),
 *   binding the ciphertext to it. Pass null/omit only for callers with no
 *   address available yet.
 * @param {number} scryptN - cost parameter; use the exported SCRYPT_N_CLOUD
 *   for Firestore/cloud payloads, SCRYPT_N_LOCAL (default) for the local
 *   SecureStore payload.
 */
export const encryptWallet = async (walletData, password, aad = null, scryptN = SCRYPT_N_LOCAL) => {
  try {
    const dataStr = JSON.stringify(walletData);
    const result = await V3_Crypto.encrypt(dataStr, password, aad, scryptN);

    return {
      encrypted: result.encrypted,
      salt: result.salt,
      iv: result.iv,
      authTag: result.authTag,
      version: result.version,
      scryptN: result.scryptN,
    };
  } catch (error) {
    console.error("Wallet encryption error:", error);
    throw error;
  }
};

/**
 * Decrypts wallet data - automatically detects version.
 * `aad` and `scryptN` are only meaningful for V3 payloads; pass them
 * whenever available (unlockWallet below always does).
 */
export const decryptWallet = async (
  encryptedWallet,
  password,
  salt,
  iv = null,
  authTag = null,
  aad = null,
  scryptN = null,
) => {
  try {
    // Detect version
    const version = encryptedWallet.version || ENCRYPTION_VERSION.V1;

    let decryptedStr;

    if (version === ENCRYPTION_VERSION.V1) {
      // Use legacy CryptoJS decryption
      console.log("Decrypting with V1 (legacy)");
      decryptedStr = V1_Crypto.decrypt(
        encryptedWallet.encrypted || encryptedWallet,
        password,
        salt,
      );
    } else if (version === ENCRYPTION_VERSION.V2) {
      // Use legacy Quick Crypto (PBKDF2) decryption
      console.log("Decrypting with V2 (legacy)");
      decryptedStr = await V2_Crypto.decrypt(
        encryptedWallet.encrypted,
        password,
        salt,
        iv || encryptedWallet.iv,
        authTag || encryptedWallet.authTag,
      );
    } else if (version === ENCRYPTION_VERSION.V3) {
      // Use current Quick Crypto (scrypt) decryption
      console.log("Decrypting with V3 (current)");
      decryptedStr = await V3_Crypto.decrypt(
        encryptedWallet.encrypted,
        password,
        salt,
        iv || encryptedWallet.iv,
        authTag || encryptedWallet.authTag,
        aad,
        scryptN || encryptedWallet.scryptN || SCRYPT_N_LOCAL,
      );
    } else {
      throw new Error(`Unsupported encryption version: ${version}`);
    }

    return JSON.parse(decryptedStr);
  } catch (error) {
    console.error("Wallet decryption error:", error);
    throw error;
  }
};

/**
 * Migrates wallet data to V3 encryption (scrypt).
 * Call this after successfully decrypting a V1 or V2 wallet.
 * `scryptN` should match the cost profile of the payload being replaced
 * (SCRYPT_N_LOCAL for the local SecureStore blob, SCRYPT_N_CLOUD for the
 * Firestore cloud blob) — see unlockWallet below.
 */
export const migrateWalletToV3 = async (walletData, password, aad, scryptN = SCRYPT_N_LOCAL) => {
  try {
    console.log("Migrating wallet to V3 (scrypt)...");
    const newEncrypted = await encryptWallet(walletData, password, aad, scryptN);
    console.log("Migration completed successfully");
    return newEncrypted;
  } catch (error) {
    console.error("Migration error:", error);
    throw new Error("Failed to migrate wallet encryption");
  }
};

/**
 * Main unlock function with automatic migration to the current version.
 * This is what you should call when user enters their password.
 *
 * @param {object} storedWalletData - the full stored payload (local
 *   SecureStore blob or Firestore cloud doc) — must include `address`,
 *   since it's used as AAD for V3 payloads and as the migration target's AAD.
 * @param {string} password
 * @param {number} migrationScryptN - cost profile to use IF a migration to V3
 *   happens during this call. Defaults to SCRYPT_N_LOCAL (correct for the two
 *   local-wallet call sites); pass SCRYPT_N_CLOUD explicitly when unlocking
 *   the Firestore cloud payload.
 */
export const unlockWallet = async (storedWalletData, password, migrationScryptN = SCRYPT_N_LOCAL) => {
  try {
    const { encrypted, salt, iv, authTag, version, scryptN, address } = storedWalletData;

    // V1/V2 payloads never had AAD applied (regardless of what any comment
    // elsewhere claims) — only pass AAD through for V3, or GCM's auth-tag
    // check fails even with the correct password.
    const aad = version === ENCRYPTION_VERSION.V3 ? address : null;

    // Decrypt the wallet
    const walletData = await decryptWallet(
      { encrypted, version, scryptN },
      password,
      salt,
      iv,
      authTag,
      aad,
      scryptN,
    );

    // Check if migration is needed — anything older than the current version.
    const needsMigration = !version || version < CURRENT_VERSION;

    if (needsMigration) {
      console.log(`Wallet v${version || 1} detected - migrating to v${CURRENT_VERSION}...`);

      const migratedData = await migrateWalletToV3(walletData, password, address, migrationScryptN);

      return {
        walletData,
        needsMigration: true,
        migratedEncryption: migratedData,
      };
    }

    return {
      walletData,
      needsMigration: false,
    };
  } catch (error) {
    console.error("Unlock error:", error);
    throw new Error("Failed to unlock wallet - invalid password");
  }
};

/**
 * Encrypts individual data (for other use cases)
 */
export const encryptData = async (data, password, aad = null, scryptN = SCRYPT_N_LOCAL) => {
  return await V3_Crypto.encrypt(data, password, aad, scryptN);
};

/**
 * Decrypts individual data
 */
export const decryptData = async (
  encryptedData,
  password,
  salt,
  iv,
  authTag,
  aad = null,
  scryptN = SCRYPT_N_LOCAL,
) => {
  return await V3_Crypto.decrypt(encryptedData, password, salt, iv, authTag, aad, scryptN);
};

/**
 * Generates a random salt (hex-encoded)
 */
export const generateSalt = () => {
  return V3_Crypto.generateRandomBytes(V3_CONFIG.SALT_LENGTH).toString("hex");
};

/**
 * Validates password strength
 */
export const validatePassword = (password) => {
  const minLength = APP_CONFIG.MIN_PASSWORD_LENGTH || 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const isValid =
    password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers;

  return {
    isValid,
    minLength: password.length >= minLength,
    hasUpperCase,
    hasLowerCase,
    hasNumbers,
    hasSpecialChar,
  };
};

/**
 * Utility to check if stored wallet needs migration
 */
export const checkMigrationNeeded = (storedWalletData) => {
  const version = storedWalletData.version;
  return !version || version < CURRENT_VERSION;
};

export default {
  encryptWallet,
  decryptWallet,
  unlockWallet,
  migrateWalletToV3,
  encryptData,
  decryptData,
  generateSalt,
  validatePassword,
  checkMigrationNeeded,
  ENCRYPTION_VERSION,
  SCRYPT_N_LOCAL,
  SCRYPT_N_CLOUD,
};
