// controllers/coingeckoController.js
// Market-data proxy for CoinGecko. Mirrors lifiController.js's pattern:
// thin pass-through handlers, any key stays server-side, response shaped as
// { success, data }. Unlike LI.FI/0x, CoinGecko's free tier needs no key at
// all — the point of this proxy isn't auth, it's (a) a shared 60s cache so
// every device hitting the backend doesn't multiply into per-device
// rate-limit pressure on the free tier, and (b) a place to add a Pro key
// later (COINGECKO_API_KEY) without an app update.
import axios from "axios";
import { env } from "../config/env.js";

const COINGECKO_BASE_URL = env.COINGECKO_API_KEY
  ? "https://pro-api.coingecko.com/api/v3"
  : "https://api.coingecko.com/api/v3";

const getCoingeckoHeaders = () => ({
  Accept: "application/json",
  ...(env.COINGECKO_API_KEY ? { "x-cg-pro-api-key": env.COINGECKO_API_KEY } : {}),
});

// Chain ID → CoinGecko coin ID, for reliable per-chain native-price lookup
// (Ethereum/Base/Arbitrum all pay gas in ETH and share one price). Mirrors
// crypto-wallet/services/coingecko.js's CHAIN_COINGECKO_MAP exactly — kept as
// a separate copy since the app and backend are different runtimes/bundles,
// same as how SUPPORTED_CHAINS itself is defined separately on each side.
const CHAIN_COINGECKO_MAP = {
  1: "ethereum", // Ethereum mainnet
  137: "polygon-ecosystem-token", // Polygon (POL)
  42161: "ethereum", // Arbitrum (ETH)
  43114: "avalanche-2", // Avalanche
  8453: "ethereum", // Base (ETH)
  84532: "ethereum", // Base Sepolia (ETH)
  999: "hyperliquid", // HyperEVM
  4663: "ethereum", // Robinhood Chain (ETH gas)
  46630: "ethereum", // Robinhood Chain Testnet
};

// CoinGecko ecosystem-category slugs for chain-specific "top traded" lists.
// Mirrors CHAIN_CATEGORY in screens/swap/SwapNewSCreen.js exactly (same
// separate-copy reasoning as CHAIN_COINGECKO_MAP above). Chains with no
// category here simply return an empty top-traded list.
const CHAIN_CATEGORY = {
  1: "ethereum-ecosystem",
  137: "polygon-ecosystem",
  42161: "arbitrum-ecosystem",
  43114: "avalanche-ecosystem",
  8453: "base-ecosystem",
};

// In-memory cache shared across all requests this backend instance serves —
// same 60s TTL the client-side services used, just centralized now so N
// devices no longer each maintain their own copy of the same rate limit risk.
const _cache = new Map(); // key → { ts, data }
const CACHE_TTL_MS = 60_000;

const cached = async (key, fetcher) => {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  const data = await fetcher();
  _cache.set(key, { ts: Date.now(), data });
  return data;
};

const extractCoingeckoError = (data) => {
  if (!data) return "CoinGecko request failed";
  if (typeof data === "string") return data;
  return data.status?.error_message || data.error || "CoinGecko request failed";
};

// GET /coingecko/native-prices — prices for every chain's native gas token,
// keyed by chain ID (not symbol, to avoid ETH-on-Ethereum/Base/Arbitrum
// colliding). Mirrors getAllNativePricesByChainId() in the (now legacy,
// client-side) services/coingecko.js.
export const getNativePrices = async (req, res, next) => {
  try {
    const uniqueIds = [...new Set(Object.values(CHAIN_COINGECKO_MAP))];
    const raw = await cached(`native-prices:${uniqueIds.join(",")}`, async () => {
      const response = await axios.get(`${COINGECKO_BASE_URL}/simple/price`, {
        params: {
          ids: uniqueIds.join(","),
          vs_currencies: "usd",
          include_24hr_change: true,
          include_24hr_vol: true,
          include_market_cap: true,
        },
        headers: getCoingeckoHeaders(),
        timeout: 10000,
      });
      return response.data;
    });

    const result = {};
    Object.entries(CHAIN_COINGECKO_MAP).forEach(([chainId, coinId]) => {
      if (raw[coinId]) result[Number(chainId)] = raw[coinId];
    });

    res.json({ success: true, data: result });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        success: false,
        error: extractCoingeckoError(err.response.data),
        details: err.response.data,
      });
    }
    next(err);
  }
};

// GET /coingecko/simple-price?ids=ethereum,bitcoin — current price(s) for
// arbitrary CoinGecko coin IDs.
export const getSimplePrice = async (req, res, next) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ success: false, error: "ids is required" });
    }

    const sorted = String(ids).split(",").map((s) => s.trim()).filter(Boolean).sort();
    const cacheKey = `simple-price:${sorted.join(",")}`;

    const data = await cached(cacheKey, async () => {
      const response = await axios.get(`${COINGECKO_BASE_URL}/simple/price`, {
        params: {
          ids: sorted.join(","),
          vs_currencies: "usd",
          include_24hr_change: true,
          include_24hr_vol: true,
          include_market_cap: true,
        },
        headers: getCoingeckoHeaders(),
        timeout: 10000,
      });
      return response.data;
    });

    res.json({ success: true, data });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        success: false,
        error: extractCoingeckoError(err.response.data),
        details: err.response.data,
      });
    }
    next(err);
  }
};

// GET /coingecko/trending?limit=12 — top coins by CoinGecko's gecko_desc
// ranking, shaped down to exactly what the app renders (id/symbol/name/
// image/price/change24h/sparkline) rather than passing through CoinGecko's
// full, much larger /coins/markets payload. Mirrors fetchTrendingCoins() in
// the (now legacy, client-side) services/coingecko.js, sparkline sampling
// included.
export const getTrending = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
    const cacheKey = `trending:${limit}`;

    const data = await cached(cacheKey, async () => {
      const response = await axios.get(`${COINGECKO_BASE_URL}/coins/markets`, {
        params: {
          vs_currency: "usd",
          order: "gecko_desc",
          per_page: limit,
          page: 1,
          sparkline: true,
          price_change_percentage: "24h",
          locale: "en",
        },
        headers: getCoingeckoHeaders(),
        timeout: 10000,
      });

      return response.data.map((c) => {
        // Sample the 7-day sparkline down to ~14 points so the payload/chart
        // isn't unnecessarily dense.
        const raw = c.sparkline_in_7d?.price ?? [];
        const step = Math.max(1, Math.floor(raw.length / 14));
        const sparkline = raw.filter((_, i) => i % step === 0).slice(-14);
        return {
          id: c.id,
          symbol: c.symbol,
          name: c.name,
          image: c.image,
          price: c.current_price,
          change24h: c.price_change_percentage_24h ?? 0,
          sparkline,
        };
      });
    });

    res.json({ success: true, data });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        success: false,
        error: extractCoingeckoError(err.response.data),
        details: err.response.data,
      });
    }
    next(err);
  }
};

// GET /coingecko/markets?limit=50&page=1 — the canonical "all markets" list,
// ordered by market cap (CoinGecko's default free-tier /coins/markets view).
// Distinct from /trending (gecko_desc "trending score" ranking) and /gainers
// (24h-change-sorted subset of the top 100) — this is what the Markets
// screen's default tab shows.
export const getMarkets = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const cacheKey = `markets:${limit}:${page}`;

    const data = await cached(cacheKey, async () => {
      const response = await axios.get(`${COINGECKO_BASE_URL}/coins/markets`, {
        params: {
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: limit,
          page,
          sparkline: true,
          price_change_percentage: "24h",
        },
        headers: getCoingeckoHeaders(),
        timeout: 10000,
      });

      return response.data.map((c) => {
        const raw = c.sparkline_in_7d?.price ?? [];
        const step = Math.max(1, Math.floor(raw.length / 14));
        const sparkline = raw.filter((_, i) => i % step === 0).slice(-14);
        return {
          id: c.id,
          symbol: c.symbol,
          name: c.name,
          image: c.image,
          price: c.current_price,
          change24h: c.price_change_percentage_24h ?? 0,
          marketCap: c.market_cap,
          marketCapRank: c.market_cap_rank,
          volume24h: c.total_volume,
          sparkline,
        };
      });
    });

    res.json({ success: true, data });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        success: false,
        error: extractCoingeckoError(err.response.data),
        details: err.response.data,
      });
    }
    next(err);
  }
};

// GET /coingecko/search?query=pepe — free-text coin search, used by the
// wallet's global Search screen to find tokens beyond the app's static local
// token lists. Shaped down to just the `coins` array (CoinGecko's raw
// response also carries exchanges/icos/categories/nfts matches, which the
// app never uses).
export const getSearchCoins = async (req, res, next) => {
  try {
    const query = (req.query.query || "").trim();
    if (!query) {
      return res.status(400).json({ success: false, error: "query is required" });
    }

    const cacheKey = `search:${query.toLowerCase()}`;

    const data = await cached(cacheKey, async () => {
      const response = await axios.get(`${COINGECKO_BASE_URL}/search`, {
        params: { query },
        headers: getCoingeckoHeaders(),
        timeout: 10000,
      });

      return (response.data.coins || []).slice(0, 20).map((c) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        thumb: c.thumb,
        marketCapRank: c.market_cap_rank ?? null,
      }));
    });

    res.json({ success: true, data });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        success: false,
        error: extractCoingeckoError(err.response.data),
        details: err.response.data,
      });
    }
    next(err);
  }
};

// GET /coingecko/gainers?limit=5 — top 24h movers among the top 100 coins by
// market cap, shaped the same as /trending (minus sparkline, which the
// Discover screen's gainers row doesn't render). A distinct query from
// /trending's gecko_desc ranking — this one is a real "biggest % gain today"
// list, sorted server-side so the client never has to fetch+filter+sort a
// 100-coin payload just to show 5 rows.
export const getGainers = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 25);
    const cacheKey = `gainers:${limit}`;

    const data = await cached(cacheKey, async () => {
      const response = await axios.get(`${COINGECKO_BASE_URL}/coins/markets`, {
        params: {
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: 100,
          page: 1,
          sparkline: false,
          price_change_percentage: "24h",
        },
        headers: getCoingeckoHeaders(),
        timeout: 10000,
      });

      return response.data
        .filter((c) => (c.price_change_percentage_24h ?? 0) > 0)
        .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
        .slice(0, limit)
        .map((c) => ({
          id: c.id,
          symbol: c.symbol,
          name: c.name,
          image: c.image,
          price: c.current_price,
          change24h: c.price_change_percentage_24h ?? 0,
        }));
    });

    res.json({ success: true, data });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        success: false,
        error: extractCoingeckoError(err.response.data),
        details: err.response.data,
      });
    }
    next(err);
  }
};

// GET /coingecko/top-by-chain?chainId=8453&limit=10 — top tokens by trading
// volume within a chain's CoinGecko ecosystem category. Powers the Swap
// screen's "Top Traded on {chain}" list. Chains with no mapped category
// (anything outside CHAIN_CATEGORY above) return an empty list rather than
// erroring, matching the client-side fallback this replaces.
export const getTopByChain = async (req, res, next) => {
  try {
    const chainId = parseInt(req.query.chainId, 10);
    const category = CHAIN_CATEGORY[chainId];
    if (!category) {
      return res.json({ success: true, data: [] });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 25);
    const cacheKey = `top-by-chain:${chainId}:${limit}`;

    const data = await cached(cacheKey, async () => {
      const response = await axios.get(`${COINGECKO_BASE_URL}/coins/markets`, {
        params: {
          vs_currency: "usd",
          category,
          order: "volume_desc",
          per_page: limit,
          page: 1,
          sparkline: true,
          price_change_percentage: "24h",
        },
        headers: getCoingeckoHeaders(),
        timeout: 10000,
      });

      return response.data.map((c) => ({
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        image: c.image,
        price: c.current_price,
        change24h: c.price_change_percentage_24h,
        sparkline: c.sparkline_in_7d?.price ?? [],
      }));
    });

    res.json({ success: true, data });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        success: false,
        error: extractCoingeckoError(err.response.data),
        details: err.response.data,
      });
    }
    next(err);
  }
};

// GET /coingecko/coin-detail?id=pepe — full coin detail (minus the heavy
// tickers/community/developer blocks the app never uses), used by the Swap
// screen to resolve a trending token's contract address on the active chain
// before setting it as the buy token.
export const getCoinDetail = async (req, res, next) => {
  try {
    const id = (req.query.id || "").trim();
    if (!id) {
      return res.status(400).json({ success: false, error: "id is required" });
    }

    const cacheKey = `coin-detail:${id}`;

    const data = await cached(cacheKey, async () => {
      const response = await axios.get(`${COINGECKO_BASE_URL}/coins/${id}`, {
        params: {
          localization: false,
          tickers: false,
          market_data: false,
          community_data: false,
          developer_data: false,
        },
        headers: getCoingeckoHeaders(),
        timeout: 10000,
      });

      const { id: coinId, symbol, name, image, platforms, detail_platforms } = response.data;
      return { id: coinId, symbol, name, image, platforms, detailPlatforms: detail_platforms };
    });

    res.json({ success: true, data });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        success: false,
        error: extractCoingeckoError(err.response.data),
        details: err.response.data,
      });
    }
    next(err);
  }
};
