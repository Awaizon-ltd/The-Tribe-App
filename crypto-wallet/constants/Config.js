// constants/Config.js

export const APP_CONFIG = {
  APP_NAME: "Tribe",
  VERSION: "2.1.2",

  // Security
  MIN_PASSWORD_LENGTH: 8,
  ENCRYPTION_ITERATIONS: 10000,
  SALT_LENGTH: 32,

  // Wallet
  DERIVATION_PATH: "m/44'/60'/0'/0/0",
  MNEMONIC_STRENGTH: 128, // 12 words

  // Backend URL — set EXPO_PUBLIC_API_URL in your .env to override.
  // Falls back to the production URL when not set.
  BACKEND_URL: __DEV__
    ? "http://bsfc0ehgrxehbe5ereirbqzs.31.97.58.198.sslip.io/api/v1" // ⚠️ UPDATE THIS to your computer's IP
    : "http://bsfc0ehgrxehbe5ereirbqzs.31.97.58.198.sslip.io/api/v1",

  //     BACKEND_URL: __DEV__
  // ? "http://192.168.0.25:5000/api/v1" // ⚠️ UPDATE THIS to your computer's IP
  // : "https://backend.sysfidao.com/api/v1",

  // ✅ Cache configuration
  CACHE_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes

  CACHE_EXPIRY: {
    DAOS: 5 * 60 * 1000, // 5 minutes
    DAO_DETAIL: 10 * 60 * 1000, // 10 minutes
  },

  // Storage keys
  STORAGE_KEYS: {
    LOCAL_WALLET: "wallet_local_encrypted",
    USER_PREFERENCES: "@user_preferences",
    SELECTED_CHAIN: "@selected_chain",
    WALLET_ADDRESSES: "@wallet_addresses",
  },

  // Database
  DB_NAME: "Tribe.db",
  DB_VERSION: 1, // ✅ Updated to match latest migration
};

export const TRANSACTION_STATUS = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
};

export const WALLET_ACTIONS = {
  CREATE: "create",
  IMPORT: "import",
  RESTORE: "restore",
};
