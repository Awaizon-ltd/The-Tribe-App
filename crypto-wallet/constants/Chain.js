// constants/Chain.js - NO IMPORTS (except local image assets, which Metro
// resolves to a static id at bundle time rather than a real module import)

const ALCHEMY_KEY = "DNSsO2xFxmfxk92qoGfS1";
const ROBINHOOD_LOGO = require("../assets/robinhood.png");

/**
 * Supported EVM chains.
 * Add `nativeTokenName` so the UI can display "Ether", "POL", "AVAX" etc.
 * Add `coingeckoId` so price fetching works per-chain (avoids symbol collisions).
 * All native token decimals are 18 on EVM.
 */
// The app is Robinhood Chain-only for now — every other chain below is
// commented out (not deleted) so nothing in the app iterates them and calls
// out to their Alchemy RPC endpoints (each chain's rpcUrl bills against the
// same ALCHEMY_KEY, whether or not the chain is ever actually shown to a
// user). Uncomment an entry to bring that chain back.
export const SUPPORTED_CHAINS = {
  /* // ── Ethereum ────────────────────────────────────────────────────────────────
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
  */

  // ── Robinhood Chain ──────────────────────────────────────────────────────────
  // Verified against robinhood.com support docs + Alchemy's network page
  // (2026-08-28): chainId 4663, native gas ETH, RPC/explorer as below.
  ROBINHOOD: {
    id: 4663,
    name: "Robinhood Chain",
    nativeTokenName: "Ether",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: `https://robinhood-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    explorer: "https://robinhoodchain.blockscout.com",
    icon: ROBINHOOD_LOGO,
    coingeckoId: "ethereum", // gas token is ETH, same convention as BASE/ARBITRUM below
    testnet: false,
  },

  // ── Robinhood Chain Testnet ──────────────────────────────────────────────────
  ROBINHOOD_TESTNET: {
    id: 46630,
    name: "Robinhood Chain Testnet",
    nativeTokenName: "Ether",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: `https://robinhood-testnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    explorer: "https://robinhoodchain.blockscout.com",
    icon: ROBINHOOD_LOGO,
    coingeckoId: "ethereum",
    testnet: true,
  },

  /* // ── Polygon ─────────────────────────────────────────────────────────────────
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
  */

};

// Default chain — Robinhood Chain (community mode's home network)
export const DEFAULT_CHAIN = SUPPORTED_CHAINS.ROBINHOOD;

// All mainnet chain IDs (used by HomeScreen to decide default-visible rows)
export const MAINNET_CHAIN_IDS = Object.values(SUPPORTED_CHAINS)
  .filter((c) => !c.testnet)
  .map((c) => c.id);

// Testnets that stay reachable even in production builds — currently just
// Robinhood Chain Testnet, since Community mode is built around the
// Robinhood Chain ecosystem and needs a testnet its users can actually
// reach without a dev build. Single source of truth for this exception —
// ChainContext.js's switch/unlock guards and AssetsCard.js's testnet-row
// hiding both read it, so nothing re-derives its own copy of "which
// testnet is the exception."
export const PRODUCTION_ALLOWED_TESTNET_IDS = [SUPPORTED_CHAINS.ROBINHOOD_TESTNET.id];

export const isTestnetAllowedInProduction = (chainId) =>
  PRODUCTION_ALLOWED_TESTNET_IDS.includes(chainId);

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
