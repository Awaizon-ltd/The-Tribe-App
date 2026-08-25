// utils/nativeTokens.js

/**
 * Special address used to represent native assets (ETH, BNB, MATIC, etc.)
 * This is not a real token address, just a marker for native assets
 */
export const NATIVE_TOKEN_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/**
 * WETH addresses for each chain
 * These are the wrapped versions used internally in swap paths
 */
export const WETH_ADDRESSES = {
  1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // Ethereum - WETH
  56: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // BSC - WBNB
  137: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // Polygon - WMATIC
  43114: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // Avalanche - WAVAX
  42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // Arbitrum - WETH
  8453: "0x4200000000000000000000000000000000000006", // Base - WETH
};

/**
 * Native token metadata for each chain
 */
export const NATIVE_TOKENS = {
  1: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    isNative: true,
  },
  56: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "BNB",
    name: "BNB",
    decimals: 18,
    logoURI:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png",
    isNative: true,
  },
  137: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "POL",
    name: "Polygon",
    decimals: 18,
    logoURI:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
    isNative: true,
  },
  43114: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "AVAX",
    name: "Avalanche",
    decimals: 18,
    logoURI:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png",
    isNative: true,
  },
  42161: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    isNative: true,
  },
  8453: {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    isNative: true,
  },
};

/**
 * Check if a token is a native asset
 * @param {object|string} token - Token object or address
 * @returns {boolean} True if native asset
 */
export function isNativeToken(token) {
  if (!token) return false;

  if (typeof token === "string") {
    return token.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
  }

  return (
    token.address?.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase() ||
    token.isNative === true
  );
}

/**
 * Get WETH address for a specific chain
 * @param {number} chainId - Chain ID
 * @returns {string} WETH address
 */
export function getWETHAddress(chainId) {
  const wethAddress = WETH_ADDRESSES[chainId];
  if (!wethAddress) {
    throw new Error(`No WETH address configured for chain ${chainId}`);
  }
  return wethAddress;
}

/**
 * Get native token metadata for a specific chain
 * @param {number} chainId - Chain ID
 * @returns {object} Native token object
 */
export function getNativeToken(chainId) {
  const nativeToken = NATIVE_TOKENS[chainId];
  if (!nativeToken) {
    throw new Error(`No native token configured for chain ${chainId}`);
  }
  return nativeToken;
}

/**
 * Build swap path with WETH abstraction
 * - If fromToken is native: [WETH, toToken]
 * - If toToken is native: [fromToken, WETH]
 * - If both native: Not possible (same token)
 * - If neither native: [fromToken, toToken]
 *
 * @param {object} fromToken - Source token
 * @param {object} toToken - Destination token
 * @param {number} chainId - Chain ID
 * @returns {string[]} Token path for swap
 */
export function buildSwapPath(fromToken, toToken, chainId) {
  const fromIsNative = isNativeToken(fromToken);
  const toIsNative = isNativeToken(toToken);
  const wethAddress = getWETHAddress(chainId);

  // Native to native doesn't make sense
  if (fromIsNative && toIsNative) {
    throw new Error("Cannot swap native token to itself");
  }

  // Native to Token: WETH → Token
  if (fromIsNative) {
    return [wethAddress, toToken.address];
  }

  // Token to Native: Token → WETH
  if (toIsNative) {
    return [fromToken.address, wethAddress];
  }

  // Token to Token: Token → Token (direct)
  // Note: Could be optimized with Token → WETH → Token for better liquidity
  return [fromToken.address, toToken.address];
}

/**
 * Determine which swap function to use
 * @param {object} fromToken - Source token
 * @param {object} toToken - Destination token
 * @returns {string} Swap function name
 */
export function getSwapFunction(fromToken, toToken) {
  const fromIsNative = isNativeToken(fromToken);
  const toIsNative = isNativeToken(toToken);

  if (fromIsNative && toIsNative) {
    throw new Error("Cannot swap native token to itself");
  }

  if (fromIsNative) {
    return "swapExactETHForTokens"; // Native → Token
  }

  if (toIsNative) {
    return "swapExactTokensForETH"; // Token → Native
  }

  return "swapExactTokensForTokens"; // Token → Token
}

/**
 * Check if approval is needed for a token
 * Native tokens never need approval
 * @param {object} token - Token to check
 * @returns {boolean} True if approval might be needed
 */
export function needsApproval(token) {
  return !isNativeToken(token);
}

/**
 * Format native token display
 * @param {number} chainId - Chain ID
 * @returns {string} Display name (e.g., "ETH", "BNB")
 */
export function getNativeSymbol(chainId) {
  return NATIVE_TOKENS[chainId]?.symbol || "ETH";
}

/**
 * Check if address is WETH on a specific chain
 * @param {string} address - Token address
 * @param {number} chainId - Chain ID
 * @returns {boolean} True if address is WETH
 */
export function isWETH(address, chainId) {
  const wethAddress = WETH_ADDRESSES[chainId];
  return address.toLowerCase() === wethAddress.toLowerCase();
}
