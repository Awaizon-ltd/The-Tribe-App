// constants/wsyn.js
// WSYN (WrappedSYN) token configuration.
// Keep in sync with backend WSYN_ADDRESSES in mintRoutes.js.
//
// TRIBE launches on Robinhood Chain, not Base — both slots are placeholder
// zero addresses until the contracts are actually deployed there (same
// "update before launch" pattern the old Base Mainnet slot used).

export const WSYN_CONTRACTS = {
  46630: "0x0000000000000000000000000000000000000000", // Robinhood Chain Testnet — update once deployed
  4663:  "0x0000000000000000000000000000000000000000", // Robinhood Chain (mainnet) — update before launch
};

// Chain IDs where WSYN is available (or will be)
export const SUPPORTED_WSYN_CHAIN_IDS = [46630, 4663];

export const WSYN_MINT_FEE_ETH = "0.0004";

// Robinhood Chain's explorer root for tx links (same URL for both
// mainnet/testnet — matches constants/Chain.js's ROBINHOOD/ROBINHOOD_TESTNET
// entries, which share the one Blockscout instance today).
export const WSYN_EXPLORER = {
  46630: "https://robinhoodchain.blockscout.com",
  4663:  "https://robinhoodchain.blockscout.com",
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
