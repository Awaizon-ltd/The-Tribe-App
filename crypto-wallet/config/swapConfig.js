// config/swapConfig.js

/**
 * ✅ STANDARD UNISWAP V2 ROUTER ABI
 *
 * Note: Both ABIs provided are identical. Base chain uses the same standard
 * Uniswap V2 Router interface as all other chains.
 *
 * This ABI includes all swap and quote related functions needed for:
 * - Getting price quotes (getAmountsOut, getAmountsIn)
 * - Token-to-token swaps
 * - Native-to-token swaps (ETH, BNB, MATIC, etc.)
 * - Token-to-native swaps
 */
export const UNISWAP_V2_ROUTER_ABI = [
  // ========================================
  // QUOTE FUNCTIONS (for price estimation)
  // ========================================
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
    ],
    name: "getAmountsOut",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
    ],
    name: "getAmountsIn",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "reserveIn", type: "uint256" },
      { internalType: "uint256", name: "reserveOut", type: "uint256" },
    ],
    name: "getAmountOut",
    outputs: [{ internalType: "uint256", name: "amountOut", type: "uint256" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "uint256", name: "reserveIn", type: "uint256" },
      { internalType: "uint256", name: "reserveOut", type: "uint256" },
    ],
    name: "getAmountIn",
    outputs: [{ internalType: "uint256", name: "amountIn", type: "uint256" }],
    stateMutability: "pure",
    type: "function",
  },

  // ========================================
  // TOKEN-TO-TOKEN SWAP FUNCTIONS
  // ========================================
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForTokens",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "uint256", name: "amountInMax", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapTokensForExactTokens",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ========================================
  // NATIVE-TO-TOKEN SWAP FUNCTIONS (ETH, BNB, MATIC, etc.)
  // ========================================
  {
    inputs: [
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactETHForTokens",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapETHForExactTokens",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactETHForTokensSupportingFeeOnTransferTokens",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },

  // ========================================
  // TOKEN-TO-NATIVE SWAP FUNCTIONS
  // ========================================
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForETH",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "uint256", name: "amountInMax", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapTokensForExactETH",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForETHSupportingFeeOnTransferTokens",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ========================================
  // HELPER FUNCTIONS
  // ========================================
  {
    inputs: [],
    name: "WETH",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "factory",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

// SushiSwap Router addresses per chain
// All chains use the standard Uniswap V2 Router interface (same ABI)
export const SUSHI_ROUTER_ADDRESSES = {
  1: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", // Ethereum Mainnet
  56: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // BSC
  137: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // Polygon
  43114: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // Avalanche
  42161: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // Arbitrum
  8453: "0x6bded42c6da8fbf0d2ba55b2fa120c5e0c8d7891", // Base (uses same ABI)
};

// Human-readable chain names
export const CHAIN_NAMES = {
  1: "Ethereum",
  56: "BSC",
  137: "Polygon",
  43114: "Avalanche",
  42161: "Arbitrum",
  8453: "Base",
};

/**
 * Get router config for a specific chain
 *
 * @param {number} chainId - The chain ID
 * @returns {object} Configuration object with routerAddress, abi, and chainName
 *
 * @example
 * const config = getSwapConfig(1); // Ethereum
 * // Returns: { routerAddress: "0x...", abi: [...], chainName: "Ethereum" }
 */
export function getSwapConfig(chainId) {
  const routerAddress = SUSHI_ROUTER_ADDRESSES[chainId];
  const chainName = CHAIN_NAMES[chainId];

  if (!routerAddress) {
    throw new Error(
      `No SushiSwap router configured for chain ID: ${chainId}. ` +
        `Supported chains: ${Object.keys(SUSHI_ROUTER_ADDRESSES).join(", ")}`,
    );
  }

  return {
    routerAddress,
    abi: UNISWAP_V2_ROUTER_ABI,
    chainName,
  };
}

/**
 * Check if a chain is supported
 *
 * @param {number} chainId - The chain ID to check
 * @returns {boolean} True if the chain is supported
 */
export function isChainSupported(chainId) {
  return chainId in SUSHI_ROUTER_ADDRESSES;
}

/**
 * Get all supported chain IDs
 *
 * @returns {number[]} Array of supported chain IDs
 */
export function getSupportedChains() {
  return Object.keys(SUSHI_ROUTER_ADDRESSES).map(Number);
}
