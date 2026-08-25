import { Buffer } from "buffer";
import {
  randomBytes,
  pbkdf2Sync,
  createCipheriv,
  createDecipheriv,
} from "react-native-quick-crypto";
import CryptoJS from "crypto-js"; // Only for v1 backward compatibility
import { APP_CONFIG } from "../constants/Config";

// Verify imports are available
if (!randomBytes || !pbkdf2Sync || !createCipheriv || !createDecipheriv) {
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
  V2: 2, // React Native Quick Crypto (production-grade)
};

const CURRENT_VERSION = ENCRYPTION_VERSION.V2;

// V2 Configuration (Production-grade)
const V2_CONFIG = {
  ITERATIONS: 210000, // OWASP recommended minimum for PBKDF2-SHA256
  KEY_LENGTH: 32, // 256 bits
  SALT_LENGTH: 16, // 128 bits
  IV_LENGTH: 16, // 128 bits for AES-GCM
  TAG_LENGTH: 16, // 128 bits authentication tag
  ALGORITHM: "aes-256-gcm",
  HASH: "sha256",
};

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
 * V2 Modern Crypto Functions (React Native Quick Crypto)
 */
const V2_Crypto = {
  /**
   * Generates cryptographically secure random bytes
   */
  generateRandomBytes: (length) => {
    return randomBytes(length);
  },

  /**
   * Derives a key from password using PBKDF2
   * Uses higher iterations for better security
   */
  deriveKey: (password, salt) => {
    const saltBuffer =
      typeof salt === "string" ? Buffer.from(salt, "hex") : salt;

    // Use synchronous version for simplicity
    return pbkdf2Sync(
      password,
      saltBuffer,
      V2_CONFIG.ITERATIONS,
      V2_CONFIG.KEY_LENGTH,
      V2_CONFIG.HASH,
    );
  },

  /**
   * Encrypts data using AES-256-GCM (provides authentication)
   */
  encrypt: async (data, password) => {
    try {
      // Generate random salt and IV
      const salt = V2_Crypto.generateRandomBytes(V2_CONFIG.SALT_LENGTH);
      const iv = V2_Crypto.generateRandomBytes(V2_CONFIG.IV_LENGTH);

      // Derive key from password
      const key = V2_Crypto.deriveKey(password, salt);

      // Create cipher
      const cipher = createCipheriv(V2_CONFIG.ALGORITHM, key, iv);

      // Encrypt data in chunks for better performance
      const dataBuffer = Buffer.from(data, "utf8");
      let encrypted = cipher.update(dataBuffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Return all components as hex strings
      return {
        encrypted: encrypted.toString("hex"),
        salt: salt.toString("hex"),
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
        version: CURRENT_VERSION,
      };
    } catch (error) {
      console.error("V2 encryption error:", error);
      throw new Error("Failed to encrypt data");
    }
  },

  /**
   * Decrypts data using AES-256-GCM
   * Faster than V1 due to native implementation
   */
  decrypt: async (encryptedData, password, salt, iv, authTag) => {
    try {
      // Convert hex strings to buffers
      const saltBuffer = Buffer.from(salt, "hex");
      const ivBuffer = Buffer.from(iv, "hex");
      const authTagBuffer = Buffer.from(authTag, "hex");
      const encryptedBuffer = Buffer.from(encryptedData, "hex");

      // Derive key
      const key = V2_Crypto.deriveKey(password, saltBuffer);

      // Create decipher
      const decipher = createDecipheriv(V2_CONFIG.ALGORITHM, key, ivBuffer);

      // Set authentication tag
      decipher.setAuthTag(authTagBuffer);

      // Decrypt data in chunks
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
 * Unified Encryption API
 */

/**
 * Encrypts wallet data using V2 (always use latest version for new encryptions)
 */
export const encryptWallet = async (walletData, password) => {
  try {
    const dataStr = JSON.stringify(walletData);
    const result = await V2_Crypto.encrypt(dataStr, password);

    return {
      encrypted: result.encrypted,
      salt: result.salt,
      iv: result.iv,
      authTag: result.authTag,
      version: result.version,
    };
  } catch (error) {
    console.error("Wallet encryption error:", error);
    throw error;
  }
};

/**
 * Decrypts wallet data - automatically detects version
 */
export const decryptWallet = async (
  encryptedWallet,
  password,
  salt,
  iv = null,
  authTag = null,
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
      // Use modern Quick Crypto decryption
      console.log("Decrypting with V2 (modern)");
      decryptedStr = await V2_Crypto.decrypt(
        encryptedWallet.encrypted,
        password,
        salt,
        iv || encryptedWallet.iv,
        authTag || encryptedWallet.authTag,
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
 * Migrates wallet from V1 to V2 encryption
 * Call this after successfully decrypting a V1 wallet
 */
export const migrateWalletToV2 = async (walletData, password) => {
  try {
    console.log("Migrating wallet from V1 to V2...");

    // Re-encrypt with V2
    const newEncrypted = await encryptWallet(walletData, password);

    console.log("Migration completed successfully");
    return newEncrypted;
  } catch (error) {
    console.error("Migration error:", error);
    throw new Error("Failed to migrate wallet encryption");
  }
};

/**
 * Main unlock function with automatic migration
 * This is what you should call when user enters their password
 */
export const unlockWallet = async (storedWalletData, password) => {
  try {
    const { encrypted, salt, iv, authTag, version } = storedWalletData;

    // Decrypt the wallet
    const walletData = await decryptWallet(
      { encrypted, version },
      password,
      salt,
      iv,
      authTag,
    );

    // Check if migration is needed
    const needsMigration = !version || version === ENCRYPTION_VERSION.V1;

    if (needsMigration) {
      console.log("V1 wallet detected - migrating to V2...");

      // Migrate to V2
      const migratedData = await migrateWalletToV2(walletData, password);

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
export const encryptData = async (data, password) => {
  return await V2_Crypto.encrypt(data, password);
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
) => {
  return await V2_Crypto.decrypt(encryptedData, password, salt, iv, authTag);
};

/**
 * Generates a random salt (V2 format)
 */
export const generateSalt = () => {
  return V2_Crypto.generateRandomBytes(V2_CONFIG.SALT_LENGTH).toString("hex");
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
  return !version || version === ENCRYPTION_VERSION.V1;
};

export default {
  encryptWallet,
  decryptWallet,
  unlockWallet,
  migrateWalletToV2,
  encryptData,
  decryptData,
  generateSalt,
  validatePassword,
  checkMigrationNeeded,
  ENCRYPTION_VERSION,
};
