// hooks/useTokenList.js
import { useState, useEffect, useCallback, useRef } from "react";
import TokenApiService from "../services/api/TokenApi";
import { getNativeToken } from "../utils/NativeTokens";

// Cache for token lists per chain
const tokenListCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for managing token lists with per-chain caching
 */
export function useTokenList(chainId) {
  const [tokens, setTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortController = useRef(null);

  /**
   * Fetch tokens for specific chain
   */
  const fetchTokens = useCallback(async () => {
    if (!chainId) {
      return;
    }

    // Check cache first
    const cacheKey = `chain-${chainId}`;
    const cached = tokenListCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log("[useTokenList] Using cached tokens for chain:", chainId);
      setTokens(cached.tokens);
      return;
    }

    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("[useTokenList] Fetching tokens for chain:", chainId);

      // Get native token for this chain
      const nativeToken = getNativeToken(chainId);

      // Fetch ERC20 tokens from API
      const fetchedTokens = await TokenApiService.getTokensByChain(chainId);

      // Combine: native token first, then all other tokens
      const allTokens = [nativeToken, ...fetchedTokens];

      // Cache the results
      tokenListCache.set(cacheKey, {
        tokens: allTokens,
        timestamp: Date.now(),
      });

      setTokens(allTokens);
      console.log(
        "[useTokenList] ✅ Loaded",
        allTokens.length,
        "tokens (including native)",
      );
    } catch (err) {
      console.error("[useTokenList] ❌ Error fetching tokens:", err);
      setError(err.message);

      // On error, at least show the native token
      try {
        const nativeToken = getNativeToken(chainId);
        setTokens([nativeToken]);
      } catch {
        setTokens([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    fetchTokens();

    // Cleanup
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [fetchTokens]);

  return {
    tokens,
    isLoading,
    error,
    refresh: fetchTokens,
  };
}

/**
 * Hook for searching tokens with debouncing
 */
export function useTokenSearch(chainId, searchQuery) {
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);

  const debounceTimer = useRef(null);
  const abortController = useRef(null);

  const search = useCallback(async () => {
    if (!chainId) {
      return;
    }

    // If query is empty, clear results
    if (!searchQuery || searchQuery.trim() === "") {
      setResults([]);
      return;
    }

    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }

    setIsSearching(true);
    setError(null);

    try {
      console.log("[useTokenSearch] Searching for:", searchQuery);

      const searchResults = await TokenApiService.searchTokens(
        searchQuery.trim(),
        chainId,
      );

      setResults(searchResults);
      console.log("[useTokenSearch] Found", searchResults.length, "results");
    } catch (err) {
      console.error("[useTokenSearch] ❌ Search error:", err);
      setError(err.message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [chainId, searchQuery]);

  // Debounced search
  useEffect(() => {
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // If query is empty, clear immediately
    if (!searchQuery || searchQuery.trim() === "") {
      setResults([]);
      return;
    }

    // Set new timer for 300ms delay
    debounceTimer.current = setTimeout(() => {
      search();
    }, 300);

    // Cleanup
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [search, searchQuery]);

  return {
    results,
    isSearching,
    error,
  };
}

/**
 * Get popular/common tokens for a chain (cached)
 */
export function usePopularTokens(chainId, limit = 10) {
  const { tokens, isLoading, error } = useTokenList(chainId);

  // Filter and sort popular tokens
  const popularTokens = tokens
    .filter((token) => token.logoURI) // Only tokens with logos
    .slice(0, limit);

  return {
    tokens: popularTokens,
    isLoading,
    error,
  };
}

/**
 * Clear token cache (useful for debugging or force refresh)
 */
export function clearTokenCache(chainId = null) {
  if (chainId) {
    tokenListCache.delete(`chain-${chainId}`);
    console.log("[useTokenList] Cleared cache for chain:", chainId);
  } else {
    tokenListCache.clear();
    console.log("[useTokenList] Cleared all token cache");
  }
}
