// utils/blockchain/Alchemy.js
import { Alchemy, Network } from "alchemy-sdk";

const ALCHEMY_API_KEY = "HbuLjJ4P7DfTF8UQBKwMY";

/**
 * Chain ID → Alchemy Network enum.
 * Chains not listed here fall through to a direct ethers JsonRpcProvider
 * (see getTransactionHistory in blockchain/index.js).
 */
export const ALCHEMY_NETWORK_MAP = {
  1: Network.ETH_MAINNET,       // Ethereum
  137: Network.MATIC_MAINNET,   // Polygon
  42161: Network.ARB_MAINNET,   // Arbitrum One
  8453: Network.BASE_MAINNET,   // Base
  84532: Network.BASE_SEPOLIA,  // Base Sepolia (testnet)
  // Avalanche (43114) is NOT in the Alchemy SDK Network enum;
  // callers that need Alchemy features should check isAlchemySupported() first.
};

// Cache for Alchemy instances (keyed by chainId)
const alchemyInstanceCache = new Map();

/**
 * Returns a cached Alchemy instance for the given chain.
 * Throws if the chain is not supported by the Alchemy SDK.
 * Use isAlchemySupported() to guard before calling.
 */
export const getAlchemyInstance = (chainId) => {
  const id = Number(chainId);
  console.log("[getAlchemyInstance] Received chainId:", id);

  if (alchemyInstanceCache.has(id)) {
    console.log("[getAlchemyInstance] Returning cached instance for chain:", id);
    return alchemyInstanceCache.get(id);
  }

  const network = ALCHEMY_NETWORK_MAP[id];
  if (!network) {
    throw new Error(
      `Alchemy SDK does not support chain ${id}. Use a direct JsonRpcProvider for this chain.`,
    );
  }

  console.log("[getAlchemyInstance] Creating Alchemy instance for network:", network);
  const instance = new Alchemy({ apiKey: ALCHEMY_API_KEY, network });
  alchemyInstanceCache.set(id, instance);
  return instance;
};

/** Returns true when the Alchemy SDK can be used for this chain. */
export const isAlchemySupported = (chainId) =>
  Object.prototype.hasOwnProperty.call(ALCHEMY_NETWORK_MAP, Number(chainId));

/** All chain IDs covered by the Alchemy SDK in this project. */
export const getAlchemySupportedChainIds = () =>
  Object.keys(ALCHEMY_NETWORK_MAP).map(Number);

/** Alchemy Network enum value for a chain, or null. */
export const getAlchemyNetwork = (chainId) =>
  ALCHEMY_NETWORK_MAP[Number(chainId)] ?? null;

/** Evict one or all cached instances (call after key rotation). */
export const clearAlchemyCache = (chainId = null) => {
  if (chainId !== null) {
    alchemyInstanceCache.delete(Number(chainId));
    console.log(`[clearAlchemyCache] Cleared cache for chain ${chainId}`);
  } else {
    alchemyInstanceCache.clear();
    console.log("[clearAlchemyCache] Cleared all cached instances");
  }
};
