// utils/alchemy.js
import { Alchemy, Network } from "alchemy-sdk";

const ALCHEMY_API_KEY = "HbuLjJ4P7DfTF8UQBKwMY";

// Map chain IDs to Alchemy Networks — Base mainnet + testnet only
export const ALCHEMY_NETWORK_MAP = {
  8453: Network.BASE_MAINNET,
  84532: Network.BASE_SEPOLIA,
};

// Cache for Alchemy instances
const alchemyInstanceCache = new Map();

/**
 * Get Alchemy instance for a specific chain (cached)
 */
export const getAlchemyInstance = (chainId) => {
  console.log(
    "[getAlchemyInstance] Received chainId:",
    chainId,
    "Type:",
    typeof chainId,
  );

  // Check cache first
  if (alchemyInstanceCache.has(chainId)) {
    console.log(
      "[getAlchemyInstance] Returning cached instance for chain:",
      chainId,
    );
    return alchemyInstanceCache.get(chainId);
  }

  const network = ALCHEMY_NETWORK_MAP[chainId];

  if (!network) {
    console.error(
      "[getAlchemyInstance] Available chain IDs:",
      Object.keys(ALCHEMY_NETWORK_MAP),
    );
    throw new Error(`Alchemy not supported for chain ${chainId}`);
  }

  const apiKey = ALCHEMY_API_KEY;
  console.log(
    "[getAlchemyInstance] Creating Alchemy instance for network:",
    network,
  );

  const instance = new Alchemy({
    apiKey,
    network,
  });

  // Cache the instance
  alchemyInstanceCache.set(chainId, instance);

  return instance;
};

/**
 * Clear Alchemy instance cache
 */
export const clearAlchemyCache = (chainId = null) => {
  if (chainId !== null) {
    alchemyInstanceCache.delete(chainId);
    console.log(`[clearAlchemyCache] Cleared cache for chain ${chainId}`);
  } else {
    alchemyInstanceCache.clear();
    console.log("[clearAlchemyCache] Cleared all cached instances");
  }
};

/**
 * Check if chain is supported by Alchemy
 */
export const isAlchemySupported = (chainId) => {
  return ALCHEMY_NETWORK_MAP.hasOwnProperty(chainId);
};

/**
 * Get all supported chain IDs
 */
export const getAlchemySupportedChainIds = () => {
  return Object.keys(ALCHEMY_NETWORK_MAP).map(Number);
};

/**
 * Get Alchemy network for chain ID
 */
export const getAlchemyNetwork = (chainId) => {
  return ALCHEMY_NETWORK_MAP[chainId] || null;
};
