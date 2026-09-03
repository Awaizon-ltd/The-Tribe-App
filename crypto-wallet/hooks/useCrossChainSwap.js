// hooks/useCrossChainSwap.js
// Cross-chain swap/bridge via LI.FI, proxied through the backend's /lifi/*
// endpoints (the API key/integrator/fee stay server-side — see
// backend/src/controllers/lifiController.js). Mirrors useSwap.js's
// conventions (AbortController per call, __DEV__ tracing) but for the
// two-chain case: fromChain/toChain can differ, unlike useSwap's single
// activeChain.
import { useState, useCallback, useRef } from "react";
import { parseUnits } from "ethers";
import { API_CONFIG } from "../config/api";

const API_BASE_URL = API_CONFIG.BASE_URL;
const DEFAULT_SLIPPAGE = 0.01;
// Internal token objects use the 0x-style 0xEeee…EEeE sentinel for native
// tokens (see useSwap.js). LI.FI's API instead expects the zero address for
// native tokens — resolveTokenAddress below maps to LI.FI's convention, not
// the app's internal one.
const LIFI_NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

// Bridges settle on the destination chain minutes after the source-chain tx
// is mined — poll rather than a single receipt wait.
const STATUS_POLL_INTERVAL_MS = 15000;
const STATUS_POLL_TIMEOUT_MS = 15 * 60 * 1000; // 15 min

const safeParseUnits = (amount, decimals) => {
  if (!amount || String(amount).trim() === "") throw new Error("Amount is empty");
  let cleaned = String(amount).trim();
  const commaCount = (cleaned.match(/,/g) || []).length;
  const hasDot = cleaned.includes(".");
  if (commaCount === 1 && !hasDot) cleaned = cleaned.replace(",", ".");
  else cleaned = cleaned.replace(/,/g, "");

  const num = Number(cleaned);
  if (isNaN(num) || !isFinite(num)) throw new Error("Invalid amount");

  const dec = parseInt(decimals, 10);
  if (isNaN(dec) || dec < 0) throw new Error("Invalid token decimals");

  const fixed = num.toFixed(dec);
  const [whole, frac] = fixed.split(".");
  const clamped = frac ? `${whole}.${frac.slice(0, dec)}` : whole;
  return parseUnits(clamped, dec);
};

const resolveTokenAddress = (token) =>
  token ? (token.isNative ? LIFI_NATIVE_TOKEN_ADDRESS : token.address) : null;

export function useCrossChainSwap() {
  const [fromChain, setFromChain] = useState(null);
  const [toChain, setToChain] = useState(null);
  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken] = useState(null);
  const [fromAmount, setFromAmount] = useState("");

  const [quote, setQuote] = useState(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [error, setError] = useState(null);

  const [txStatus, setTxStatus] = useState("idle"); // idle | pending | done | failed
  const [statusData, setStatusData] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  const quoteAbortRef = useRef(null);
  const pollCancelRef = useRef(false);

  const isCrossChain = !!fromChain && !!toChain && fromChain.id !== toChain.id;

  // ── Quote ─────────────────────────────────────────────────────────────────
  const fetchQuote = useCallback(
    async (fromAddress, toAddress) => {
      if (__DEV__) console.log("\n[useCrossChainSwap fetchQuote] ━━━ START ━━━");

      if (!fromChain || !toChain || !fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
        throw new Error("Invalid cross-chain swap parameters");
      }
      if (!fromAddress) throw new Error("Missing sender address");

      if (quoteAbortRef.current) quoteAbortRef.current.abort();
      quoteAbortRef.current = new AbortController();

      try {
        setIsFetchingQuote(true);
        setError(null);

        const fromAmountWei = safeParseUnits(fromAmount, fromToken.decimals).toString();

        const params = new URLSearchParams({
          fromChain: fromChain.id,
          toChain: toChain.id,
          fromToken: resolveTokenAddress(fromToken),
          toToken: resolveTokenAddress(toToken),
          fromAmount: fromAmountWei,
          fromAddress,
          slippage: DEFAULT_SLIPPAGE,
          ...(toAddress && { toAddress }),
        });

        const url = `${API_BASE_URL}${API_CONFIG.ENDPOINTS.LIFI_QUOTE}?${params}`;
        if (__DEV__) console.log("[useCrossChainSwap fetchQuote] URL:", url);

        const res = await fetch(url, { signal: quoteAbortRef.current.signal });
        const json = await res.json();

        if (!json.success) {
          throw new Error(json.error || "Failed to fetch cross-chain quote");
        }

        setQuote(json.data);
        if (__DEV__) console.log("[useCrossChainSwap fetchQuote] ✅ SUCCESS");
        return json.data;
      } catch (err) {
        if (err.name === "AbortError") return;
        if (__DEV__) console.error("[useCrossChainSwap fetchQuote] ❌ ERROR:", err.message);
        setError(err.message);
        throw err;
      } finally {
        setIsFetchingQuote(false);
      }
    },
    [fromChain, toChain, fromToken, toToken, fromAmount],
  );

  // ── Status polling ───────────────────────────────────────────────────────
  // Call after the source-chain tx from quote.transactionRequest is signed
  // and sent. Resolves once the bridge reports DONE or FAILED, or times out.
  const pollStatus = useCallback(async (txHash, { bridge, fromChainId, toChainId } = {}) => {
    pollCancelRef.current = false;
    setIsPolling(true);
    setTxStatus("pending");
    setStatusData(null);

    const startedAt = Date.now();

    try {
      while (!pollCancelRef.current) {
        if (Date.now() - startedAt > STATUS_POLL_TIMEOUT_MS) {
          setTxStatus("pending"); // still might complete — caller can keep checking manually
          throw new Error("Timed out waiting for bridge to complete. It may still finish — check status later.");
        }

        const params = new URLSearchParams({
          txHash,
          ...(bridge && { bridge }),
          ...(fromChainId && { fromChain: fromChainId }),
          ...(toChainId && { toChain: toChainId }),
        });

        const url = `${API_BASE_URL}${API_CONFIG.ENDPOINTS.LIFI_STATUS}?${params}`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.success) {
          setStatusData(json.data);
          if (json.data?.status === "DONE") {
            setTxStatus("done");
            return json.data;
          }
          if (json.data?.status === "FAILED") {
            setTxStatus("failed");
            throw new Error(json.data?.substatusMessage || "Bridge transfer failed");
          }
          // NOT_FOUND / PENDING → keep polling
        }

        await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS));
      }
      return null; // cancelled
    } finally {
      setIsPolling(false);
    }
  }, []);

  const cancelPolling = useCallback(() => {
    pollCancelRef.current = true;
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setQuote(null);
    setError(null);
    setTxStatus("idle");
    setStatusData(null);
    setFromAmount("");
  }, []);

  return {
    fromChain, setFromChain,
    toChain, setToChain,
    fromToken, setFromToken,
    toToken, setToToken,
    fromAmount, setFromAmount,
    isCrossChain,

    quote,
    fetchQuote,
    isFetchingQuote,
    error,
    setError,

    txStatus,
    statusData,
    isPolling,
    pollStatus,
    cancelPolling,

    reset,
  };
}
