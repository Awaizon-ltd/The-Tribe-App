const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

// Map native token symbols to CoinGecko coin IDs.
// POL is Polygon's rebranded symbol (was MATIC); CoinGecko still uses 'matic-network'.
const COIN_ID_MAP = {
  'ETH': 'ethereum',
  'POL': 'polygon-ecosystem-token', // Polygon native token (replaced MATIC Sept 2023)
  'MATIC': 'polygon-ecosystem-token', // backwards-compat alias
  'AVAX': 'avalanche-2',
  'BNB': 'binancecoin',
  'OP': 'optimism',
  'ARB': 'arbitrum',
  'HYPE': 'hyperliquid',    // HyperEVM native token
};

/**
 * Map chain ID → CoinGecko coin ID for reliable per-chain price lookup.
 * Ethereum, Base, and Arbitrum all use ETH as their native token but share
 * the same price, so they all map to 'ethereum'.
 */
export const CHAIN_COINGECKO_MAP = {
  1: 'ethereum',        // Ethereum mainnet
  137: 'polygon-ecosystem-token', // Polygon (POL)
  42161: 'ethereum',    // Arbitrum (ETH)
  43114: 'avalanche-2', // Avalanche
  8453: 'ethereum',     // Base (ETH)
  84532: 'ethereum',    // Base Sepolia (ETH)
  999: 'hyperliquid',   // HyperEVM
};

// In-memory cache — prevents hammering the free-tier API when multiple screens
// call getCoinPrices on mount simultaneously (would cause 429 rate-limit responses).
const _priceCache = new Map(); // cacheKey → { ts, data }
const CACHE_TTL_MS = 60_000;

/**
 * Get current prices for multiple coins.
 * Results are cached for 60 s to prevent simultaneous callers from triggering
 * CoinGecko free-tier rate limits (429 responses → empty price data).
 */
export const getCoinPrices = async (coinIds) => {
  const sorted = Array.isArray(coinIds) ? [...coinIds].sort() : [coinIds];
  const cacheKey = sorted.join(',');
  const cached = _priceCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  try {
    const response = await fetch(
      `${COINGECKO_API_BASE}/simple/price?ids=${sorted.join(',')}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko ${response.status}`);
    }

    const data = await response.json();
    _priceCache.set(cacheKey, { ts: Date.now(), data });
    return data;
  } catch (error) {
    console.error('Error fetching coin prices:', error);
    return {};
  }
};

/**
 * Get price for a single coin by symbol
 */
export const getCoinPriceBySymbol = async (symbol) => {
  const coinId = COIN_ID_MAP[symbol];
  if (!coinId) {
    console.warn(`No CoinGecko ID found for symbol: ${symbol}`);
    return null;
  }
  
  const prices = await getCoinPrices(coinId);
  return prices[coinId];
};

/**
 * Get prices for all supported native tokens
 */
export const getAllNativePrices = async () => {
  const coinIds = Object.values(COIN_ID_MAP);
  const prices = await getCoinPrices(coinIds);
  
  // Convert back to symbol-based object
  const pricesBySymbol = {};
  Object.entries(COIN_ID_MAP).forEach(([symbol, coinId]) => {
    if (prices[coinId]) {
      pricesBySymbol[symbol] = prices[coinId];
    }
  });
  
  return pricesBySymbol;
};

/**
 * Get prices keyed by chain ID (avoids ETH symbol collision across Eth/Base/Arbitrum).
 * Returns { [chainId]: { usd, usd_24h_change, ... } }
 */
export const getAllNativePricesByChainId = async () => {
  const uniqueIds = [...new Set(Object.values(CHAIN_COINGECKO_MAP))];
  const raw = await getCoinPrices(uniqueIds);
  const result = {};
  Object.entries(CHAIN_COINGECKO_MAP).forEach(([chainId, coinId]) => {
    if (raw[coinId]) result[Number(chainId)] = raw[coinId];
  });
  return result;
};

/**
 * Get detailed coin information
 */
export const getCoinDetails = async (coinId) => {
  try {
    const response = await fetch(
      `${COINGECKO_API_BASE}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch coin details');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching coin details:', error);
    return null;
  }
};

/**
 * Get coin market chart (price history)
 */
export const getCoinChart = async (coinId, days = 7) => {
  try {
    const response = await fetch(
      `${COINGECKO_API_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=${days === 1 ? 'hourly' : 'daily'}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch chart data');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching chart data:', error);
    return null;
  }
};

/**
 * Fetch the top trending / high-volume coins with 24h price change.
 * Uses the /coins/markets endpoint ordered by gecko score (trending rank).
 * Returns an array of { id, symbol, name, image, current_price, price_change_percentage_24h }.
 */
export const fetchTrendingCoins = async (limit = 12) => {
  try {
    const response = await fetch(
      `${COINGECKO_API_BASE}/coins/markets?vs_currency=usd&order=gecko_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=24h&locale=en`
    );
    if (!response.ok) throw new Error('Failed to fetch trending coins');
    const data = await response.json();
    return data.map((c) => {
      // Sample the 7-day sparkline to ~14 points so the chart isn't too dense
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
  } catch (error) {
    console.error('[CoinGecko] fetchTrendingCoins error:', error);
    return [];
  }
};

/**
 * Get CoinGecko ID from symbol
 */
export const getCoinIdFromSymbol = (symbol) => {
  return COIN_ID_MAP[symbol] || null;
};

/**
 * Format price change percentage
 */
export const formatPriceChange = (change) => {
  if (!change) return { text: '0.00%', isPositive: true };
  
  const isPositive = change >= 0;
  const formatted = Math.abs(change).toFixed(2);
  
  return {
    text: `${isPositive ? '+' : '-'}${formatted}%`,
    isPositive,
    value: change,
  };
};