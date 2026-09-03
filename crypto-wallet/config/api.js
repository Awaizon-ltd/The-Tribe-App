// API Configuration

import { APP_CONFIG } from "../constants/Config";

const API_BASE_URL = APP_CONFIG.BACKEND_URL;

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,

  // Endpoints
  ENDPOINTS: {
    TOKENS: "/tokens",
    CHAINS: "/tokens/chains",
    TOKEN_BY_CHAIN: (chainId) => `/tokens/chain/${chainId}`,
    TOKEN_BY_ADDRESS: (chainId, address) =>
      `/tokens/chain/${chainId}/address/${address}`,
    SEARCH: (query, chainId) =>
      `/tokens/search?query=${query}${chainId ? `&chainId=${chainId}` : ""}`,
    // Bridge
    BRIDGE_ASSETS: "/bridge/assets",
    BRIDGE_ESTIMATE_GAS: "/bridge/estimate-gas",
    BRIDGE_BUILD_TX: "/bridge/build-tx",
    BRIDGE_STATUS: (txHash) => `/bridge/status/${txHash}`,
    BRIDGE_BALANCE: "/bridge/balance",
    BRIDGE_PROVE_WITHDRAWAL: "/bridge/prove-withdrawal",
    BRIDGE_FINALIZE_WITHDRAWAL: "/bridge/finalize-withdrawal",

    // LI.FI — cross-chain swap/bridge aggregator (wallet mode + community mode)
    LIFI_CHAINS: "/lifi/chains",
    LIFI_QUOTE: "/lifi/quote",
    LIFI_STATUS: "/lifi/status",

    // CoinGecko — market-data proxy (key, if any, stays server-side)
    COINGECKO_NATIVE_PRICES: "/coingecko/native-prices",
    COINGECKO_SIMPLE_PRICE: "/coingecko/simple-price",
    COINGECKO_TRENDING: "/coingecko/trending",
    COINGECKO_SEARCH: "/coingecko/search",
    COINGECKO_GAINERS: "/coingecko/gainers",
    COINGECKO_TOP_BY_CHAIN: "/coingecko/top-by-chain",
    COINGECKO_COIN_DETAIL: "/coingecko/coin-detail",
    COINGECKO_MARKETS: "/coingecko/markets",
  },

  // Cache duration (1 hour)
  CACHE_DURATION: 60 * 60 * 1000,
};
