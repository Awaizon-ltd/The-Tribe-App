// hooks/useSwapQuote.js
import { useState, useEffect, useCallback, useRef } from "react";
import { Contract, formatUnits, parseUnits } from "ethers";
import { useWallet } from "../contexts/WalletContext";
import { useChain } from "../contexts/ChainContext";
import { getSwapConfig } from "../config/swapConfig";
import { buildSwapPath, isNativeToken } from "../utils/NativeTokens";

/**
 * Hook for fetching swap quotes from SushiSwap
 * @param {string} fromToken - Token to swap from
 * @param {string} toToken - Token to swap to
 * @param {string} amountIn - Amount to swap
 * @param {number} slippageTolerance - Slippage tolerance (default 0.5%)
 */
export function useSwapQuote(
  fromToken,
  toToken,
  amountIn,
  slippageTolerance = 0.5,
) {
  const { provider } = useWallet();
  const { activeChain } = useChain();

  const [quote, setQuote] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [priceImpact, setPriceImpact] = useState(null);

  // Debounce timer
  const debounceTimer = useRef(null);

  /**
   * Calculate minimum amount out based on slippage
   */
  const calculateMinAmountOut = useCallback((amountOut, slippage) => {
    const slippageMultiplier = (100 - slippage) / 100;
    return (
      (BigInt(amountOut) * BigInt(Math.floor(slippageMultiplier * 10000))) /
      BigInt(10000)
    );
  }, []);

  /**
   * Calculate price impact
   */
  const calculatePriceImpact = useCallback(
    (amountIn, amountOut, fromDecimals, toDecimals) => {
      try {
        const inFloat = parseFloat(formatUnits(amountIn, fromDecimals));
        const outFloat = parseFloat(formatUnits(amountOut, toDecimals));

        if (inFloat === 0 || outFloat === 0) return 0;

        // Simple price impact calculation (this is approximate)
        const expectedOut = inFloat; // 1:1 baseline
        const actualOut = outFloat;
        const impact = ((expectedOut - actualOut) / expectedOut) * 100;

        return Math.abs(impact);
      } catch (err) {
        console.error("[useSwapQuote] Error calculating price impact:", err);
        return 0;
      }
    },
    [],
  );

  /**
   * Fetch swap quote from router
   */
  const fetchQuote = useCallback(async () => {
    // Validation
    if (!fromToken || !toToken || !amountIn || parseFloat(amountIn) <= 0) {
      setQuote(null);
      setError(null);
      return;
    }

    if (!provider) {
      setError({ message: "Wallet not connected" });
      return;
    }

    // Don't quote if tokens are the same
    if (isNativeToken(fromToken) && isNativeToken(toToken)) {
      setError({ message: "Cannot swap same token" });
      return;
    }

    if (
      !isNativeToken(fromToken) &&
      !isNativeToken(toToken) &&
      fromToken.address.toLowerCase() === toToken.address.toLowerCase()
    ) {
      setError({ message: "Cannot swap same token" });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const config = getSwapConfig(activeChain.id);
      const router = new Contract(config.routerAddress, config.abi, provider);

      // Parse amount with proper decimals
      const amountInWei = parseUnits(amountIn, fromToken.decimals);

      // Build path with WETH abstraction
      const path = buildSwapPath(fromToken, toToken, activeChain.id);

      console.log("[useSwapQuote] Fetching quote...");
      console.log(
        "[useSwapQuote] From:",
        fromToken.symbol,
        "(native:",
        isNativeToken(fromToken),
        ")",
      );
      console.log(
        "[useSwapQuote] To:",
        toToken.symbol,
        "(native:",
        isNativeToken(toToken),
        ")",
      );
      console.log("[useSwapQuote] Path:", path);
      console.log("[useSwapQuote] Amount:", amountInWei.toString());

      // Get amounts out
      const amounts = await router.getAmountsOut(amountInWei, path);
      const amountOut = amounts[amounts.length - 1];

      // Calculate minimum amount out with slippage
      const minAmountOut = calculateMinAmountOut(amountOut, slippageTolerance);

      // Calculate price impact
      const impact = calculatePriceImpact(
        amountInWei,
        amountOut,
        fromToken.decimals,
        toToken.decimals,
      );

      // Calculate rate
      const amountInFloat = parseFloat(
        formatUnits(amountInWei, fromToken.decimals),
      );
      const amountOutFloat = parseFloat(
        formatUnits(amountOut, toToken.decimals),
      );
      const rate = amountOutFloat / amountInFloat;

      const quoteData = {
        amountIn: amountInWei.toString(),
        amountOut: amountOut.toString(),
        amountOutFormatted: formatUnits(amountOut, toToken.decimals),
        minAmountOut: minAmountOut.toString(),
        minAmountOutFormatted: formatUnits(minAmountOut, toToken.decimals),
        path,
        rate,
        priceImpact: impact,
        slippage: slippageTolerance,
        isFromNative: isNativeToken(fromToken),
        isToNative: isNativeToken(toToken),
      };

      setQuote(quoteData);
      setPriceImpact(impact);
      setError(null);

      console.log("[useSwapQuote] ✅ Quote fetched:", quoteData);
    } catch (err) {
      console.error("[useSwapQuote] ❌ Error fetching quote:", err);

      let errorMessage = "Failed to fetch quote";

      if (err.message?.includes("INSUFFICIENT_LIQUIDITY")) {
        errorMessage = "Insufficient liquidity for this pair";
      } else if (err.message?.includes("INSUFFICIENT_INPUT_AMOUNT")) {
        errorMessage = "Amount too small";
      } else if (err.message?.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
        errorMessage = "Output amount too small";
      }

      setError({ message: errorMessage, original: err.message });
      setQuote(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    fromToken,
    toToken,
    amountIn,
    slippageTolerance,
    provider,
    activeChain,
    calculateMinAmountOut,
    calculatePriceImpact,
  ]);

  /**
   * Debounced fetch - waits 500ms after last input change
   */
  useEffect(() => {
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      fetchQuote();
    }, 500);

    // Cleanup
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [fetchQuote]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    fetchQuote();
  }, [fetchQuote]);

  return {
    quote,
    isLoading,
    error,
    priceImpact,
    refresh,
  };
}
