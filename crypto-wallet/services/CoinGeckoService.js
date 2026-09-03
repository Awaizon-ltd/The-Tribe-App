// services/CoinGeckoService.js
// Consolidated CoinGecko client, routed through the backend proxy
// (backend/src/controllers/coingeckoController.js) instead of calling
// api.coingecko.com directly from the device — same reasoning as LI.FI/0x:
// a shared server-side cache absorbs simultaneous callers instead of every
// device individually risking the free tier's 429 rate limit, and it leaves
// room to add a Pro key later with no app update.
//
// This is currently wired into HomeScreen.js and PortfolioSummary.js only.
// services/coingecko.js, services/coingec.js, services/NewCoinGecko.js, and
// hooks/useTokenPrice.js are older, still-live, direct-to-CoinGecko clients
// used by other screens — left as-is for now rather than migrated in one
// flag-day rewrite; see the wallet-mode redesign plan for the phased
// migration rationale.
import { API_CONFIG } from "../config/api";

const API_BASE_URL = API_CONFIG.BASE_URL;

// Light client-side cache on top of the backend's own 60s cache — several
// components can mount around the same time (Home's hero + trending row)
// and this avoids firing duplicate requests for the same data within a
// render burst.
const _cache = new Map(); // key -> { ts, data }
const CACHE_TTL_MS = 30_000;

const cached = async (key, fetcher) => {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  const data = await fetcher();
  _cache.set(key, { ts: Date.now(), data });
  return data;
};

const getJson = async (path, params) => {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  const response = await fetch(`${API_BASE_URL}${path}${query}`);
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(json.error || `CoinGecko proxy request failed (${response.status})`);
  }
  return json.data;
};

/**
 * Get prices keyed by chain ID (avoids ETH symbol collision across
 * Eth/Base/Arbitrum/Robinhood Chain). Returns { [chainId]: { usd, usd_24h_change, ... } }.
 */
export const getAllNativePricesByChainId = async () => {
  try {
    return await cached("native-prices", () =>
      getJson(API_CONFIG.ENDPOINTS.COINGECKO_NATIVE_PRICES),
    );
  } catch (error) {
    console.error("[CoinGeckoService] getAllNativePricesByChainId error:", error);
    return {};
  }
};

/**
 * Get current prices for arbitrary CoinGecko coin IDs.
 * Returns { [coinId]: { usd, usd_24h_change, ... } }.
 */
export const getCoinPrices = async (coinIds) => {
  const sorted = (Array.isArray(coinIds) ? [...coinIds] : [coinIds]).sort();
  try {
    return await cached(`simple-price:${sorted.join(",")}`, () =>
      getJson(API_CONFIG.ENDPOINTS.COINGECKO_SIMPLE_PRICE, { ids: sorted.join(",") }),
    );
  } catch (error) {
    console.error("[CoinGeckoService] getCoinPrices error:", error);
    return {};
  }
};

/**
 * Fetch the top trending / high-volume coins with 24h price change + a
 * sampled 7-day sparkline. Returns
 * [{ id, symbol, name, image, price, change24h, sparkline }].
 */
export const fetchTrendingCoins = async (limit = 12) => {
  try {
    return await cached(`trending:${limit}`, () =>
      getJson(API_CONFIG.ENDPOINTS.COINGECKO_TRENDING, { limit }),
    );
  } catch (error) {
    console.error("[CoinGeckoService] fetchTrendingCoins error:", error);
    return [];
  }
};

/**
 * The canonical "all markets" list, ordered by market cap — CoinGecko's
 * default free-tier /coins/markets view. Powers the Markets screen's main
 * list. Returns [{ id, symbol, name, image, price, change24h, marketCap,
 * marketCapRank, volume24h, sparkline }].
 */
export const getMarkets = async (limit = 50, page = 1) => {
  try {
    return await cached(`markets:${limit}:${page}`, () =>
      getJson(API_CONFIG.ENDPOINTS.COINGECKO_MARKETS, { limit, page }),
    );
  } catch (error) {
    console.error("[CoinGeckoService] getMarkets error:", error);
    return [];
  }
};

/**
 * Top 24h movers among the top 100 coins by market cap.
 * Returns [{ id, symbol, name, image, price, change24h }].
 */
export const getTopGainers = async (limit = 5) => {
  try {
    return await cached(`gainers:${limit}`, () =>
      getJson(API_CONFIG.ENDPOINTS.COINGECKO_GAINERS, { limit }),
    );
  } catch (error) {
    console.error("[CoinGeckoService] getTopGainers error:", error);
    return [];
  }
};

/**
 * Top tokens by trading volume within a chain's CoinGecko ecosystem category.
 * Returns [] for chains with no mapped category. Powers Swap's "Top Traded"
 * list. Returns [{ id, symbol, name, image, price, change24h, sparkline }].
 */
export const getTopTradedByChain = async (chainId, limit = 10) => {
  if (!chainId) return [];
  try {
    return await cached(`top-by-chain:${chainId}:${limit}`, () =>
      getJson(API_CONFIG.ENDPOINTS.COINGECKO_TOP_BY_CHAIN, { chainId, limit }),
    );
  } catch (error) {
    console.error("[CoinGeckoService] getTopTradedByChain error:", error);
    return [];
  }
};

/**
 * Full coin detail (platforms/contract addresses included), used to resolve
 * a token's contract address on a given chain before setting it as a swap
 * side. Returns { id, symbol, name, image, platforms, detailPlatforms } or
 * null on failure.
 */
export const getCoinDetail = async (coinId) => {
  if (!coinId) return null;
  try {
    return await cached(`coin-detail:${coinId}`, () =>
      getJson(API_CONFIG.ENDPOINTS.COINGECKO_COIN_DETAIL, { id: coinId }),
    );
  } catch (error) {
    console.error("[CoinGeckoService] getCoinDetail error:", error);
    return null;
  }
};

/**
 * Free-text coin search (name/symbol/id), for finding tokens beyond the
 * app's static local token lists (utils/token/TokenListUtil.js).
 * Returns [{ id, name, symbol, thumb, marketCapRank }].
 */
export const searchCoins = async (query) => {
  const trimmed = (query || "").trim();
  if (!trimmed) return [];
  try {
    return await cached(`search:${trimmed.toLowerCase()}`, () =>
      getJson(API_CONFIG.ENDPOINTS.COINGECKO_SEARCH, { query: trimmed }),
    );
  } catch (error) {
    console.error("[CoinGeckoService] searchCoins error:", error);
    return [];
  }
};

/**
 * Format a 24h price-change percentage for display. Pure function, no
 * network dependency — copied verbatim from services/coingecko.js.
 */
export const formatPriceChange = (change) => {
  if (!change) return { text: "0.00%", isPositive: true };

  const isPositive = change >= 0;
  const formatted = Math.abs(change).toFixed(2);

  return {
    text: `${isPositive ? "+" : "-"}${formatted}%`,
    isPositive,
    value: change,
  };
};

export default {
  getAllNativePricesByChainId,
  getCoinPrices,
  fetchTrendingCoins,
  getMarkets,
  getTopGainers,
  getTopTradedByChain,
  getCoinDetail,
  searchCoins,
  formatPriceChange,
};
