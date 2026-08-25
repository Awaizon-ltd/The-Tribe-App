// constants/wsyn.js
// WSYN (WrappedSYN) token configuration.
// Keep in sync with backend WSYN_ADDRESSES in mintRoutes.js.

export const WSYN_CONTRACTS = {
  84532: "0x3c181eaaB64052c726194Da6797EA06DD15e8E6B", // Base Sepolia (testnet)
  8453:  "0x0000000000000000000000000000000000000000",  // Base Mainnet — update before mainnet launch
};

// Chain IDs where WSYN is available (or will be)
export const SUPPORTED_WSYN_CHAIN_IDS = [84532, 8453];

export const WSYN_MINT_FEE_ETH = "0.0004";

// Basescan explorer roots for tx links
export const WSYN_EXPLORER = {
  84532: "https://sepolia.basescan.org",
  8453:  "https://basescan.org",
};

/**
 * Return the contract address for a given chainId, or null if not deployed.
 */
export const getWSYNAddress = (chainId) => {
  const addr = WSYN_CONTRACTS[chainId];
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return null;
  return addr;
};

/**
 * Return true if WSYN is deployed (non-zero address) on this chain.
 */
export const isWSYNDeployed = (chainId) => getWSYNAddress(chainId) !== null;
