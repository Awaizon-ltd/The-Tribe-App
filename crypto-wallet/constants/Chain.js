// constants/Chain.js - NO IMPORTS

const ALCHEMY_KEY = "HbuLjJ4P7DfTF8UQBKwMY";

/**
 * Supported EVM chains.
 * Add `nativeTokenName` so the UI can display "Ether", "POL", "AVAX" etc.
 * Add `coingeckoId` so price fetching works per-chain (avoids symbol collisions).
 * All native token decimals are 18 on EVM.
 */
export const SUPPORTED_CHAINS = {
  // ── Ethereum ────────────────────────────────────────────────────────────────
  ETHEREUM: {
    id: 1,
    name: "Ethereum",
    nativeTokenName: "Ether",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    explorer: "https://etherscan.io",
    icon: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    coingeckoId: "ethereum",
    testnet: false,
  },
   // ── Base Mainnet ─────────────────────────────────────────────────────────────
  BASE: {
    id: 8453,
    name: "Base",
    nativeTokenName: "Ether",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    explorer: "https://basescan.org",
    icon: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRgJzE3esFDDQJwxXfIEQy-TlsXLnWvlEOyTQ&s",
    coingeckoId: "ethereum",
    testnet: false,
  },

  // ── Polygon ─────────────────────────────────────────────────────────────────
  POLYGON: {
    id: 137,
    name: "Polygon",
    nativeTokenName: "POL",
    symbol: "POL",
    decimals: 18,
    rpcUrl: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    explorer: "https://polygonscan.com",
    icon: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
    coingeckoId: "polygon-ecosystem-token",
    testnet: false,
  },

  // ── Arbitrum One ────────────────────────────────────────────────────────────
  ARBITRUM: {
    id: 42161,
    name: "Arbitrum",
    nativeTokenName: "Ether",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    explorer: "https://arbiscan.io",
    icon: "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg",
    coingeckoId: "ethereum",
    testnet: false,
  },

  // ── Avalanche C-Chain ────────────────────────────────────────────────────────
  AVALANCHE: {
    id: 43114,
    name: "Avalanche",
    nativeTokenName: "AVAX",
    symbol: "AVAX",
    decimals: 18,
    rpcUrl: `https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    // Public fallback: "https://api.avax.network/ext/bc/C/rpc"
    explorer: "https://snowtrace.io",
    icon: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
    coingeckoId: "avalanche-2",
    testnet: false,
  },

 

  // ── Hyperliquid (HyperEVM) ───────────────────────────────────────────────────
  HYPERLIQUID: {
    id: 999,
    name: "HyperEVM",
    nativeTokenName: "HYPE",
    symbol: "HYPE",
    decimals: 18,
    rpcUrl: "https://rpc.hyperliquid.xyz/evm",
    explorer: "https://purrsec.com",
    icon: "https://assets.coingecko.com/coins/images/36059/small/hyperliquid.png",
    coingeckoId: "hyperliquid",
    testnet: false,
  },

  // ── Base Sepolia (testnet) ────────────────────────────────────────────────────
  BASE_SEPOLIA: {
    id: 84532,
    name: "Base Sepolia",
    nativeTokenName: "Ether",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    explorer: "https://sepolia.basescan.org",
    icon: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRgJzE3esFDDQJwxXfIEQy-TlsXLnWvlEOyTQ&s",
    coingeckoId: "ethereum",
    testnet: true,
  },
};

// Default chain — Base mainnet for existing users
export const DEFAULT_CHAIN = SUPPORTED_CHAINS.BASE;

// All mainnet chain IDs (used by HomeScreen to decide default-visible rows)
export const MAINNET_CHAIN_IDS = Object.values(SUPPORTED_CHAINS)
  .filter((c) => !c.testnet)
  .map((c) => c.id);

// Lookup helpers
export const getChainById = (chainId) =>
  Object.values(SUPPORTED_CHAINS).find((chain) => chain.id === chainId);

export const getMainnetChains = () =>
  Object.values(SUPPORTED_CHAINS).filter((chain) => !chain.testnet);

export const getTestnetChains = () =>
  Object.values(SUPPORTED_CHAINS).filter((chain) => chain.testnet);

export const getChainByName = (name) =>
  Object.values(SUPPORTED_CHAINS).find(
    (chain) => chain.name.toLowerCase() === name.toLowerCase(),
  );
