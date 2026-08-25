// hooks/useTokenPrice.js
import { useState, useEffect, useCallback, useRef } from "react";

// CoinGecko API endpoint (free tier)
const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Price cache to avoid excessive API calls
const priceCache = new Map();
const CACHE_DURATION = 60000; // 1 minute

/**
 * Map chain IDs to CoinGecko platform IDs
 */
const CHAIN_TO_PLATFORM = {
  1: "ethereum",
  56: "binance-smart-chain",
  137: "polygon-pos",
  43114: "avalanche",
  42161: "arbitrum-one",
  8453: "base",
};

/**
 * Hook for fetching token prices from CoinGecko
 */
export function useTokenPrice(tokenAddress, chainId) {
  const [price, setPrice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortController = useRef(null);

  /**
   * Fetch price from CoinGecko
   */
  const fetchPrice = useCallback(async () => {
    if (!tokenAddress || !chainId) {
      return;
    }

    // Check cache first
    const cacheKey = `${chainId}-${tokenAddress.toLowerCase()}`;
    const cached = priceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setPrice(cached.price);
      return;
    }

    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }

    abortController.current = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const platform = CHAIN_TO_PLATFORM[chainId];

      if (!platform) {
        console.warn(
          "[useTokenPrice] Unsupported chain for CoinGecko:",
          chainId,
        );
        setPrice(null);
        return;
      }

      const url = `${COINGECKO_API}/simple/token_price/${platform}?contract_addresses=${tokenAddress}&vs_currencies=usd`;

      const response = await fetch(url, {
        signal: abortController.current.signal,
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      const tokenData = data[tokenAddress.toLowerCase()];

      if (tokenData && tokenData.usd) {
        const priceData = {
          usd: tokenData.usd,
          lastUpdated: Date.now(),
        };

        // Cache the result
        priceCache.set(cacheKey, {
          price: priceData,
          timestamp: Date.now(),
        });

        setPrice(priceData);
      } else {
        setPrice(null);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("[useTokenPrice] Error fetching price:", err);
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [tokenAddress, chainId]);

  useEffect(() => {
    fetchPrice();

    // Cleanup
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [fetchPrice]);

  return {
    price,
    isLoading,
    error,
    refresh: fetchPrice,
  };
}

/**
 * Hook for fetching multiple token prices at once
 */
export function useTokenPrices(tokens, chainId) {
  const [prices, setPrices] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortController = useRef(null);

  const fetchPrices = useCallback(async () => {
    if (!tokens || tokens.length === 0 || !chainId) {
      return;
    }

    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }

    abortController.current = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const platform = CHAIN_TO_PLATFORM[chainId];

      if (!platform) {
        console.warn(
          "[useTokenPrices] Unsupported chain for CoinGecko:",
          chainId,
        );
        setPrices({});
        return;
      }

      // Check cache first
      const uncachedTokens = [];
      const cachedPrices = {};

      tokens.forEach((token) => {
        const cacheKey = `${chainId}-${token.address.toLowerCase()}`;
        const cached = priceCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          cachedPrices[token.address.toLowerCase()] = cached.price;
        } else {
          uncachedTokens.push(token);
        }
      });

      // If all prices are cached, return immediately
      if (uncachedTokens.length === 0) {
        setPrices(cachedPrices);
        setIsLoading(false);
        return;
      }

      // Fetch uncached prices (max 100 addresses per request)
      const addresses = uncachedTokens
        .slice(0, 100)
        .map((t) => t.address)
        .join(",");
      const url = `${COINGECKO_API}/simple/token_price/${platform}?contract_addresses=${addresses}&vs_currencies=usd`;

      const response = await fetch(url, {
        signal: abortController.current.signal,
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      const newPrices = { ...cachedPrices };

      Object.keys(data).forEach((address) => {
        if (data[address] && data[address].usd) {
          const priceData = {
            usd: data[address].usd,
            lastUpdated: Date.now(),
          };

          newPrices[address] = priceData;

          // Cache the result
          const cacheKey = `${chainId}-${address}`;
          priceCache.set(cacheKey, {
            price: priceData,
            timestamp: Date.now(),
          });
        }
      });

      setPrices(newPrices);
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("[useTokenPrices] Error fetching prices:", err);
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [tokens, chainId]);

  useEffect(() => {
    fetchPrices();

    // Cleanup
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [fetchPrices]);

  return {
    prices,
    isLoading,
    error,
    refresh: fetchPrices,
  };
}

/**
 * Helper function to get price from cache synchronously
 */
export function getCachedPrice(tokenAddress, chainId) {
  const cacheKey = `${chainId}-${tokenAddress.toLowerCase()}`;
  const cached = priceCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price;
  }

  return null;
}

/**
 * Calculate USD value
 */
export function calculateUSDValue(amount, price) {
  if (!amount || !price || !price.usd) {
    return null;
  }

  const value = parseFloat(amount) * price.usd;

  if (value < 0.01) {
    return `$${value.toFixed(4)}`;
  } else if (value < 1) {
    return `$${value.toFixed(3)}`;
  } else {
    return `$${value.toFixed(2)}`;
  }
}
