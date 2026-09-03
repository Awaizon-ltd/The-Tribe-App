// controllers/lifiController.js
// Cross-chain swap/bridge quotes via LI.FI (https://li.quest/v1). The API
// key, integrator string, and fee toggle stay server-side — the mobile app
// never sees them, matching how ZERO_EX_API_KEY is handled in
// swapController.js for same-chain swaps.
import axios from "axios";
import { env } from "../config/env.js";

const LIFI_BASE_URL = "https://li.quest/v1";

// Integrator fee (bps → decimal fraction) applied only when LIFI_FEE_ENABLED
// is truthy. Same 30 bps used for same-chain swaps in swapController.js,
// kept here as its own constant since LI.FI's fee revenue share is credited
// to whatever wallet is registered for LIFI_INTEGRATOR in LI.FI's partner
// portal — there's no per-request recipient address to pass, unlike 0x's
// swapFeeRecipient.
const LIFI_FEE_BPS = 30;
const LIFI_FEE_FRACTION = (LIFI_FEE_BPS / 10_000).toString(); // "0.003"

const getLifiHeaders = () => ({
  Accept: "application/json",
  ...(env.LIFI_API_KEY ? { "x-lifi-api-key": env.LIFI_API_KEY } : {}),
});

const extractLifiError = (data) => {
  if (!data) return "LI.FI request failed";
  if (typeof data === "string") return data;
  return data.message || data.error || "LI.FI request failed";
};

// GET /lifi/chains — pass-through list of chains LI.FI currently supports.
// Used by the app to decide which of our SUPPORTED_CHAINS can be offered as
// a cross-chain source/destination, without hand-maintaining that list.
export const getChains = async (req, res, next) => {
  try {
    const response = await axios.get(`${LIFI_BASE_URL}/chains`, {
      headers: getLifiHeaders(),
      timeout: 10000,
    });
    res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        success: false,
        error: extractLifiError(err.response.data),
        details: err.response.data,
      });
    }
    next(err);
  }
};

// GET /lifi/quote — one bridge/swap step, ready to sign.
// Query params: fromChain, toChain, fromToken, toToken, fromAmount,
// fromAddress, [toAddress], [slippage], [order]
export const getCrossChainQuote = async (req, res, next) => {
  try {
    const {
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount,
      fromAddress,
      toAddress,
      slippage = 0.01,
      order,
    } = req.query;

    if (!fromChain || !toChain || !fromToken || !toToken || !fromAmount || !fromAddress) {
      return res.status(400).json({
        success: false,
        error:
          "fromChain, toChain, fromToken, toToken, fromAmount, and fromAddress are required",
      });
    }

    const params = {
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount,
      fromAddress,
      slippage,
      integrator: env.LIFI_INTEGRATOR,
      ...(toAddress && { toAddress }),
      ...(order && { order }),
      ...(env.LIFI_FEE_ENABLED && { fee: LIFI_FEE_FRACTION }),
    };

    if (process.env.NODE_ENV !== "production") {
      console.log("\n[lifi getCrossChainQuote] ━━━ CALLING LI.FI /quote ━━━");
      console.log("[lifi getCrossChainQuote] params:", JSON.stringify(params, null, 2));
    }

    const response = await axios.get(`${LIFI_BASE_URL}/quote`, {
      params,
      headers: getLifiHeaders(),
      timeout: 15000,
    });

    res.json({ success: true, data: response.data });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[lifi getCrossChainQuote] error:", err.message);
    }
    if (err.response) {
      return res.status(err.response.status).json({
        success: false,
        error: extractLifiError(err.response.data),
        details: err.response.data,
      });
    }
    next(err);
  }
};

// GET /lifi/status — poll after the user signs the source-chain tx.
// Query params: txHash, [bridge], [fromChain], [toChain]
export const getCrossChainStatus = async (req, res, next) => {
  try {
    const { txHash, bridge, fromChain, toChain } = req.query;

    if (!txHash) {
      return res.status(400).json({ success: false, error: "txHash is required" });
    }

    const response = await axios.get(`${LIFI_BASE_URL}/status`, {
      params: { txHash, ...(bridge && { bridge }), ...(fromChain && { fromChain }), ...(toChain && { toChain }) },
      headers: getLifiHeaders(),
      timeout: 10000,
    });

    res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        success: false,
        error: extractLifiError(err.response.data),
        details: err.response.data,
      });
    }
    next(err);
  }
};
