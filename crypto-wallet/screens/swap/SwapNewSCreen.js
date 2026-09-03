// screens/SwapScreen.js
import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  memo,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Image,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatUnits } from "ethers";
import ChainIcon from "../../components/common/ChainIcon";
import Svg, { Polyline, Polygon, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";
import { useWallet } from "../../contexts/WalletContext";
import { useChain } from "../../contexts/ChainContext";
import { useAppMode } from "../../contexts/AppModeContext";
import { useSwap } from "../../hooks/useSwap";
import { useCrossChainSwap } from "../../hooks/useCrossChainSwap";
import AssetCard from "../../components/swap/AssetCard";
import AssetPickerModal from "../../components/swap/AssetPickerModal";
import { SwapConfirmModal } from "../../components/swap/SwapConfirmModal";
import CrossChainConfirmModal from "../../components/swap/CrossChainConfirmModal";
import ChainSwitcher from "../../components/wallet/ChainSwitcher";
import TabHeader from "../../components/common/TabHeader";
import { getMainnetChains } from "../../constants/Chain";
// ✅ Pull balance utils directly — no WalletContext wrapper needed
import {
  getTokenBalance as fetchERC20Balance,
  getNativeBalance,
} from "../../utils/blockchain/Balances";
import {
  getAllNativePricesByChainId,
  getTopTradedByChain,
  getCoinDetail,
} from "../../services/CoinGeckoService";

// ─── Constants ────────────────────────────────────────────────────────────────
const SLIPPAGE_OPTIONS = [0.005, 0.01, 0.02, 0.05];
const PCT_OPTIONS = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.50 },
  { label: '75%', value: 0.75 },
  { label: 'MAX', value: 1.0  },
];
// 1 % of native balance reserved for gas when tapping MAX
const GAS_RESERVE_FRAC = 0.01;
// CoinGecko platform IDs for contract-address lookup
const CHAIN_PLATFORM = {
  1:     'ethereum',
  137:   'polygon-pos',
  42161: 'arbitrum-one',
  43114: 'avalanche',
  8453:  'base',
};
// Top-traded-by-chain and coin-detail lookups are now proxied through the
// backend (services/CoinGeckoService.js's getTopTradedByChain/getCoinDetail)
// instead of hitting api.coingecko.com directly from the device — the
// CHAIN_CATEGORY→category-slug mapping this used to need client-side now
// lives server-side in backend/src/controllers/coingeckoController.js.

// ─── Helpers ──────────────────────────────────────────────────────────────────
const safeFloat = (val) => {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
};

const formatBalance = (val) => {
  const n = safeFloat(val);
  return n === 0 ? "0.0000" : n.toFixed(4);
};

const formatUsd = (amount, price) => {
  if (!price) return null;
  const usd = safeFloat(amount) * safeFloat(price);
  if (usd === 0) return null;
  return `≈ $${usd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const fmtPrice = (n) => {
  if (n == null) return "—";
  if (n >= 1000) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1)    return "$" + n.toFixed(2);
  return "$" + n.toFixed(4);
};

// Cross-chain quotes only ever move native tokens (see AssetPickerModal's
// native-only bridging note), and the app's native-token convention is
// always 18 decimals (constants/Chain.js) — safe to hardcode here the same
// way the old CrossChainPanel did.
const getCrossChainReceiveEstimate = (quote) => {
  if (!quote?.estimate?.toAmount) return null;
  try {
    const val = parseFloat(formatUnits(String(quote.estimate.toAmount), 18));
    return val.toFixed(6);
  } catch {
    return null;
  }
};

const NUMPAD_KEYS = [["1","2","3"],["4","5","6"],["7","8","9"],[".","0","⌫"]];

// ─── useDebounce ──────────────────────────────────────────────────────────────
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── SlippageSelector ─────────────────────────────────────────────────────────
const SlippageSelector = memo(({ slippage, onSelect, theme }) => {
  const { COLORS, SPACING, FONTS, BORDER_RADIUS, SHADOWS } = theme;
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const isCustomActive = !SLIPPAGE_OPTIONS.includes(slippage);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: COLORS.surface,
          borderRadius: BORDER_RADIUS.lg,
          padding: SPACING.md,
          marginBottom: SPACING.md,
          borderWidth: 1,
          borderColor: COLORS.border,
          ...SHADOWS.small,
        },
        label: {
          fontSize: FONTS.sizes.xs,
          fontWeight: "700",
          color: COLORS.textSecondary,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          marginBottom: SPACING.sm,
        },
        row: { flexDirection: "row", gap: SPACING.xs },
        opt: {
          flex: 1,
          paddingVertical: SPACING.sm,
          borderRadius: BORDER_RADIUS.sm,
          alignItems: "center",
          borderWidth: 1,
          backgroundColor: COLORS.background,
          borderColor: COLORS.border,
        },
        optActive: {
          backgroundColor: COLORS.primaryMuted,
          borderColor: COLORS.primary,
        },
        optText: {
          fontSize: FONTS.sizes.xs,
          fontWeight: "600",
          color: COLORS.textSecondary,
        },
        optTextActive: { fontWeight: "700", color: COLORS.primaryDark },
        customRow: {
          flexDirection: "row",
          alignItems: "center",
          marginTop: SPACING.sm,
          gap: SPACING.sm,
        },
        customInput: {
          flex: 1,
          backgroundColor: COLORS.background,
          borderRadius: BORDER_RADIUS.md,
          paddingVertical: SPACING.sm,
          paddingHorizontal: SPACING.md,
          fontSize: FONTS.sizes.md,
          color: COLORS.text,
          borderWidth: 1,
          borderColor: COLORS.border,
        },
        customPct: {
          fontSize: FONTS.sizes.md,
          color: COLORS.textSecondary,
          fontWeight: "600",
        },
        confirmBtn: {
          backgroundColor: COLORS.primary,
          borderRadius: BORDER_RADIUS.md,
          paddingVertical: SPACING.sm,
          paddingHorizontal: SPACING.md,
        },
        confirmBtnText: {
          color: COLORS.onPrimary,
          fontWeight: "700",
          fontSize: FONTS.sizes.sm,
        },
      }),
    [theme],
  );

  const handleCustomConfirm = useCallback(() => {
    const val = parseFloat(custom) / 100;
    if (!isNaN(val) && val > 0 && val < 0.5) {
      onSelect(val);
      setShowCustom(false);
      setCustom("");
    }
  }, [custom, onSelect]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Slippage Tolerance</Text>
      <View style={styles.row}>
        {SLIPPAGE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.opt, slippage === opt && styles.optActive]}
            onPress={() => {
              onSelect(opt);
              setShowCustom(false);
            }}
          >
            <Text
              style={[styles.optText, slippage === opt && styles.optTextActive]}
            >
              {(opt * 100).toFixed(1)}%
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.opt, isCustomActive && styles.optActive]}
          onPress={() => setShowCustom((v) => !v)}
        >
          <Text
            style={[styles.optText, isCustomActive && styles.optTextActive]}
          >
            {isCustomActive ? `${(slippage * 100).toFixed(1)}%` : "Custom"}
          </Text>
        </TouchableOpacity>
      </View>

      {showCustom && (
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            placeholder="1.00"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="decimal-pad"
            value={custom}
            onChangeText={setCustom}
          />
          <Text style={styles.customPct}>%</Text>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleCustomConfirm}
          >
            <Text style={styles.confirmBtnText}>Set</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

// ─── PriceInfo ────────────────────────────────────────────────────────────────
const PriceInfo = memo(
  ({
    isFetchingPrice,
    exchangeRate,
    priceImpact,
    slippage,
    impactColor,
    theme,
  }) => {
    const { COLORS, SPACING, FONTS, BORDER_RADIUS } = theme;

    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
            backgroundColor: COLORS.surface,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.md,
            marginBottom: SPACING.sm,
            gap: SPACING.sm,
            borderWidth: 1,
            borderColor: COLORS.border,
          },
          loadingRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: SPACING.sm,
          },
          loadingText: {
            fontSize: FONTS.sizes.sm,
            color: COLORS.textSecondary,
          },
          row: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
          text: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
        }),
      [theme],
    );

    return (
      <View style={styles.container}>
        {isFetchingPrice ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Fetching best price...</Text>
          </View>
        ) : (
          <>
            {exchangeRate && (
              <View style={styles.row}>
                <Ionicons
                  name="swap-horizontal-outline"
                  size={13}
                  color={COLORS.textTertiary}
                />
                <Text style={styles.text}>{exchangeRate.formatted}</Text>
              </View>
            )}
            {priceImpact && (
              <View style={styles.row}>
                <Ionicons
                  name="trending-down-outline"
                  size={13}
                  color={impactColor}
                />
                <Text style={[styles.text, { color: impactColor }]}>
                  Price impact: {priceImpact.formatted}
                </Text>
              </View>
            )}
            <View style={styles.row}>
              <Ionicons
                name="shield-checkmark-outline"
                size={13}
                color={COLORS.textTertiary}
              />
              <Text style={styles.text}>
                Slippage: {(slippage * 100).toFixed(1)}% · 0x Protocol
              </Text>
            </View>
          </>
        )}
      </View>
    );
  },
);

// ─── MiniSparkLine ────────────────────────────────────────────────────────────
const MiniSparkLine = memo(({ data, positive, width = 64, height = 30 }) => {
  if (!data || data.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + ((1 - (v - min) / range) * (height - pad * 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color = positive ? "#26cc6b" : "#FF5252";
  const gradId = positive ? "ms_up" : "ms_dn";
  const fill = [`${pad},${height}`, ...pts, `${(width - pad).toFixed(1)},${height}`].join(" ");
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.3" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Polygon points={fill} fill={`url(#${gradId})`} />
      <Polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

// ─── Numpad ───────────────────────────────────────────────────────────────────
const Numpad = memo(({ onPress, theme }) => {
  const { COLORS } = theme;
  return (
    <View style={{ gap: 6, marginBottom: 12 }}>
      {NUMPAD_KEYS.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: 6 }}>
          {row.map((key) => {
            const isBack = key === "⌫";
            return (
              <TouchableOpacity
                key={key}
                style={{
                  flex: 1, height: 52, borderRadius: 12,
                  backgroundColor: isBack ? COLORS.primaryMuted : COLORS.surface,
                  alignItems: "center", justifyContent: "center",
                }}
                onPress={() => onPress(key)}
                activeOpacity={0.55}
              >
                {isBack
                  ? <Ionicons name="backspace-outline" size={22} color={COLORS.primaryDark} />
                  : <Text style={{ fontSize: 22, fontWeight: "600", color: COLORS.text }}>{key}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
});

// ─── SwapScreen ───────────────────────────────────────────────────────────────
export default function SwapScreen() {
  const theme = useTheme();
  const { COLORS, SPACING, FONTS, BORDER_RADIUS, SHADOWS } = theme;

  const { activeChain, switchChainById } = useChain();
  // ✅ Only need wallet.address from context — balance fetching goes direct to util
  const { wallet } = useWallet();
  const { isCommunityMode } = useAppMode();
  const swap = useSwap();
  const crossChainSwap = useCrossChainSwap();

  // One brand color everywhere — Robinhood lime, same in wallet and
  // community mode. accentMuted replaces the nonexistent
  // theme.COLORS.primaryMuted this file used throughout (that token was
  // never defined in constants/Theme.js, so every "active" pill/badge/
  // banner background using it was silently rendering with no background
  // fill at all — a real pre-existing bug, fixed as part of threading this
  // accent through).
  const accentColor = COLORS.primary;
  const accentMuted = accentColor + "18";
  // Sub-components below take a `theme` prop and read theme.COLORS.primary/
  // primaryMuted/primaryDark internally — passing this instead of the raw
  // `theme` object re-points those reads at the mode-correct accent without
  // touching any of those components' own code.
  const accentTheme = useMemo(
    () => ({
      ...theme,
      COLORS: { ...COLORS, primary: accentColor, primaryMuted: accentMuted, primaryDark: accentColor },
    }),
    [theme, accentColor, accentMuted],
  );

  const [showConfirm, setShowConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChainSwitcher, setShowChainSwitcher] = useState(false);
  const [showCrossChainConfirm, setShowCrossChainConfirm] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sellBalance, setSellBalance] = useState("0");
  const [buyBalance, setBuyBalance] = useState("0");

  // ── Unified from/to state ────────────────────────────────────────────────
  // "From" is never separate state — it IS activeChain (picking a different
  // chain on the From card switches the active chain immediately, see
  // handleFromAssetSelect below). "To" is the only genuinely new piece of
  // state; it starts equal to activeChain so the screen opens as a same-chain
  // swap, and only diverges once the user picks a different chain there.
  //
  // It deliberately does NOT auto-follow activeChain if that changes through
  // an unrelated path (the header network pill, ChainSwitcher) — collapsing
  // it on every unrelated chain change would silently discard an in-progress
  // bridge selection (e.g. the user taps the header to check another chain's
  // balance mid-bridge, then comes back).
  const [toChain, setToChain] = useState(() => activeChain);
  const fromChain = activeChain;
  const isCrossChainMode = !!fromChain && !!toChain && fromChain.id !== toChain.id;

  const [activePicker, setActivePicker] = useState(null); // 'from' | 'to' | null

  // Keep the LI.FI hook's native tokens in sync with the from/to chains —
  // covers paths that change them without going through the picker (the
  // flip button). AssetPickerModal also commits a native token directly on
  // pick, so this is a safety net, not the only place tokens get set.
  useEffect(() => {
    if (!fromChain || !toChain) return;
    crossChainSwap.setFromChain(fromChain);
    crossChainSwap.setToChain(toChain);
    crossChainSwap.setFromToken({
      name: fromChain.nativeTokenName ?? "Ether",
      symbol: fromChain.symbol,
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      decimals: 18,
      isNative: true,
      logoURI: fromChain.icon,
      chainId: fromChain.id,
    });
    crossChainSwap.setToToken({
      name: toChain.nativeTokenName ?? "Ether",
      symbol: toChain.symbol,
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      decimals: 18,
      isNative: true,
      logoURI: toChain.icon,
      chainId: toChain.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromChain?.id, toChain?.id]);

  // Native balance of the chain actually being spent from — distinct from
  // `sellBalance` below, which tracks whatever (possibly non-native)
  // swap.sellToken currently is.
  const [fromNativeBalance, setFromNativeBalance] = useState("0");
  useEffect(() => {
    let cancelled = false;
    if (!isCrossChainMode || !fromChain || !wallet?.address) return;
    getNativeBalance(wallet.address, fromChain)
      .then((bal) => { if (!cancelled) setFromNativeBalance(bal?.formatted ?? "0"); })
      .catch(() => { if (!cancelled) setFromNativeBalance("0"); });
    return () => { cancelled = true; };
  }, [isCrossChainMode, fromChain?.id, wallet?.address]);

  // Debounced cross-chain quote fetch (ported from the old CrossChainPanel,
  // which owned this itself — now that both modes share one widget, the
  // screen drives both engines' quote fetching).
  const ccQuoteDebounceRef = useRef(null);
  useEffect(() => {
    if (ccQuoteDebounceRef.current) clearTimeout(ccQuoteDebounceRef.current);
    if (!isCrossChainMode) return;
    const amt = crossChainSwap.fromAmount;
    if (!amt || parseFloat(amt) <= 0 || !wallet?.address || !fromChain || !toChain) return;
    ccQuoteDebounceRef.current = setTimeout(() => {
      crossChainSwap.fetchQuote(wallet.address).catch(() => {});
    }, 600);
    return () => clearTimeout(ccQuoteDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCrossChainMode, crossChainSwap.fromAmount, wallet?.address, fromChain?.id, toChain?.id]);

  // Full mainnet chain list for both pickers — deliberately unfiltered by
  // activeChain (unlike the old counterpart-only picker) so either card can
  // be set to match the other and collapse back into a same-chain swap.
  const pickerChains = useMemo(() => getMainnetChains(), []);

  // ── Numpad visibility ────────────────────────────────────────────────────────
  const [showNumpad, setShowNumpad] = useState(false);
  const cursorAnim = useRef(new Animated.Value(1)).current;

  // ── Percentage quick-fill ───────────────────────────────────────────────────
  const [activePct, setActivePct] = useState(null);

  // ── Network-changed banner ────────────────────────────────────────────────────
  const prevChainIdRef   = useRef(null);
  const [bannerName, setBannerName] = useState('');
  const bannerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Skip the very first mount — only show on actual switches. Fires
    // for every activeChain change regardless of source (header pill,
    // ChainSwitcher, or our own auto-switch below) — this is what the
    // From-card auto-switch relies on for its "toast".
    if (prevChainIdRef.current !== null && prevChainIdRef.current !== activeChain?.id) {
      setBannerName(activeChain?.name ?? '');
      Animated.timing(bannerAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      const t = setTimeout(() => {
        Animated.timing(bannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      }, 2500);
      return () => clearTimeout(t);
    }
    prevChainIdRef.current = activeChain?.id ?? null;
  }, [activeChain?.id]);

  // ── Trending + native prices ─────────────────────────────────────────────────
  const [nativePrices, setNativePrices] = useState({});
  const [trendingCoins, setTrendingCoins] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(false);

  const sellAbortRef = useRef(null);
  const buyAbortRef = useRef(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: { flex: 1, backgroundColor: COLORS.background },
        scroll: { paddingHorizontal: SPACING.md, paddingBottom: 110, paddingTop: SPACING.xs },

        // ── Swap widget ──────────────────────────────────────────────────────────
        swapWidget: { marginBottom: SPACING.xs, gap: 4 },

        // Bridge swap button — sits between the two cards, overlapping both
        bridgeRow: {
          alignItems: "center",
          marginVertical: -26,
          zIndex: 10,
        },
        bridgeBtn: {
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: COLORS.surface,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 3,
          borderColor: COLORS.background,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 10,
          elevation: 20,
        },

        // Amount controls row (balance + PCT) — above numpad
        amountControls: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
          marginTop: SPACING.sm,
        },
        amountControlsBal: {
          fontSize: FONTS.sizes.xs,
          color: COLORS.textSecondary,
        },
        pctRow: { flexDirection: "row", gap: 5 },
        pctBtn: {
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: 7,
          backgroundColor: COLORS.background,
          borderWidth: 1,
          borderColor: COLORS.border,
        },
        pctBtnActive: { backgroundColor: accentMuted, borderColor: accentColor },
        pctBtnText: { fontSize: 10, fontWeight: "700", color: COLORS.textSecondary },
        pctBtnTextActive: { color: accentColor },
        gasNote: { fontSize: 10, color: COLORS.textTertiary, fontStyle: "italic", marginTop: 2 },

        // Error banner
        errorBanner: {
          flexDirection: "row", alignItems: "center", gap: SPACING.sm,
          backgroundColor: `${COLORS.error}14`,
          borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
          marginBottom: SPACING.sm,
          borderWidth: 1, borderColor: `${COLORS.error}30`,
        },
        errorText: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.error },

        // Swap action button
        swapActionBtn: {
          backgroundColor: accentColor,
          borderRadius: BORDER_RADIUS.xl,
          paddingVertical: SPACING.md + 2,
          alignItems: "center", justifyContent: "center",
          marginBottom: SPACING.sm,
          ...SHADOWS.large,
        },
        swapActionBtnDisabled: { opacity: 0.4 },
        swapActionBtnInsufficient: { backgroundColor: COLORS.error },
        swapActionBtnText: {
          fontSize: FONTS.sizes.lg, fontWeight: "800",
          color: COLORS.onPrimary, letterSpacing: 0.3,
        },

        // Powered by
        poweredBy: {
          flexDirection: "row", justifyContent: "center", alignItems: "center",
          marginBottom: SPACING.xl,
        },
        poweredByText: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },
        poweredByBrand: { fontSize: FONTS.sizes.xs, fontWeight: "700", color: COLORS.textSecondary },

        // Trending section — no card, no border, same bg
        trendingSection: { marginTop: SPACING.xs },
        trendingHeader: {
          flexDirection: "row", alignItems: "center", gap: 6,
          marginBottom: SPACING.sm,
        },
        trendingTitle: { flex: 1, fontSize: FONTS.sizes.sm, fontWeight: "700", color: COLORS.text },
        trendingItem: {
          flexDirection: "row", alignItems: "center",
          paddingVertical: 9,
        },
        trendingItemIcon: { width: 36, height: 36, borderRadius: 18 },
        trendingItemSymbol: { fontSize: FONTS.sizes.sm, fontWeight: "700", color: COLORS.text },
        trendingItemName: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },
        trendingItemPrice: { fontSize: FONTS.sizes.sm, fontWeight: "600", color: COLORS.text },
        trendingItemChange: { fontSize: 11, fontWeight: "700" },
      }),
    [theme, accentColor, accentMuted],
  );

  // ── Balance fetching (same-chain widget) ─────────────────────────────────────
  const fetchBalance = useCallback(
    async (token, abortRef, setter) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!token || !wallet?.address || !activeChain) {
        setter("0");
        return;
      }

      try {
        let formatted;

        if (token.isNative) {
          // getNativeBalance(address, chain) → { formatted, wei, symbol, decimals }
          const result = await getNativeBalance(wallet.address, activeChain);
          formatted = result.formatted;
        } else {
          // getTokenBalance(tokenAddress, walletAddress, chain) → { formatted, wei, ... }
          const result = await fetchERC20Balance(
            token.address,
            wallet.address,
            activeChain,
          );
          formatted = result.formatted;
        }

        if (!controller.signal.aborted) {
          setter(safeFloat(formatted) > 0 ? formatted : "0");
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.warn("[SwapScreen] fetchBalance error:", err.message);
          setter("0");
        }
      }
    },
    // Re-runs when wallet address or chain changes (covers account switch + chain switch)
    [wallet?.address, activeChain],
  );

  // Re-fetch sell balance when token changes or wallet/chain context changes
  useEffect(() => {
    fetchBalance(swap.sellToken, sellAbortRef, setSellBalance);
  }, [swap.sellToken?.address, fetchBalance]);

  // Re-fetch buy balance when token changes or wallet/chain context changes
  useEffect(() => {
    fetchBalance(swap.buyToken, buyAbortRef, setBuyBalance);
  }, [swap.buyToken?.address, fetchBalance]);

  // Fetch all native prices; re-runs when chain changes so the active chain's
  // price is always fresh (used below as fallback for native-token USD display).
  useEffect(() => {
    getAllNativePricesByChainId().then((p) => setNativePrices(p)).catch(() => {});
  }, [activeChain?.id]);

  // Fetch chain-specific top traded tokens (re-runs when active chain changes)
  useEffect(() => {
    if (!activeChain?.id) return;
    let cancelled = false;
    setLoadingTrending(true);
    setTrendingCoins([]);
    getTopTradedByChain(activeChain.id)
      .then((coins) => { if (!cancelled) setTrendingCoins(coins); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingTrending(false); });
    return () => { cancelled = true; };
  }, [activeChain?.id]);

  // ── Cursor blink while numpad is open ───────────────────────────────────────
  useEffect(() => {
    if (!showNumpad) { cursorAnim.setValue(1); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(cursorAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [showNumpad]);

  // ── Debounced price fetch (same-chain / 0x) ──────────────────────────────────
  const debouncedSellAmount = useDebounce(swap.sellAmount, 400);
  useEffect(() => {
    if (isCrossChainMode) return;
    if (safeFloat(debouncedSellAmount) > 0 && swap.sellToken && swap.buyToken) {
      swap.fetchPrice?.();
    }
  }, [isCrossChainMode, debouncedSellAmount, swap.sellToken?.address, swap.buyToken?.address]);

  // ── From/To derived display state ───────────────────────────────────────────
  const fromToken = isCrossChainMode ? crossChainSwap.fromToken : swap.sellToken;
  const toToken = isCrossChainMode ? crossChainSwap.toToken : swap.buyToken;
  const fromAmount = isCrossChainMode ? crossChainSwap.fromAmount : swap.sellAmount;
  const toAmountEstimate = isCrossChainMode
    ? (getCrossChainReceiveEstimate(crossChainSwap.quote) ?? "")
    : swap.buyAmountEstimate;
  const fromBalance = isCrossChainMode ? fromNativeBalance : sellBalance;
  const isFetchingFromToken = isCrossChainMode ? false : swap.loadingTokens;
  const isFetchingToEstimate = isCrossChainMode ? crossChainSwap.isFetchingQuote : swap.isFetchingPrice;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleFromAssetSelect = useCallback(
    async (chain, token) => {
      if (chain.id !== activeChain.id) {
        try {
          await switchChainById(chain.id);
        } catch (err) {
          console.warn("[SwapScreen] chain switch failed:", err.message);
          return;
        }
      }
      if (chain.id === toChain.id) swap.setSellToken(token);
      else crossChainSwap.setFromToken(token);
    },
    [activeChain, toChain, switchChainById, swap, crossChainSwap],
  );

  const handleToAssetSelect = useCallback(
    (chain, token) => {
      setToChain(chain);
      if (chain.id === activeChain.id) swap.setBuyToken(token);
      else crossChainSwap.setToToken(token);
    },
    [activeChain, swap, crossChainSwap],
  );

  const handleFlip = useCallback(async () => {
    if (!isCrossChainMode) {
      swap.flipTokens();
      return;
    }
    const newActiveChainId = toChain.id; // pre-flip "to" becomes the new active/from chain
    const newToChain = fromChain;        // pre-flip active chain becomes the new "to"
    setToChain(newToChain);
    const estimate = getCrossChainReceiveEstimate(crossChainSwap.quote);
    crossChainSwap.setFromAmount(estimate ?? "");
    try {
      await switchChainById(newActiveChainId);
    } catch (err) {
      console.warn("[SwapScreen] flip chain switch failed:", err.message);
      setToChain(fromChain); // revert
    }
  }, [isCrossChainMode, toChain, fromChain, crossChainSwap, switchChainById]);

  const handleSwapPress = useCallback(async () => {
    try {
      const quote = await swap.fetchQuote();
      setCurrentQuote(quote);
      setShowConfirm(true);
    } catch (err) {
      console.error("[SwapScreen] quote error:", err);
    }
  }, [swap.fetchQuote]);

  const handleBridgePress = useCallback(() => {
    setShowCrossChainConfirm(true);
  }, []);

  const handleActionPress = isCrossChainMode ? handleBridgePress : handleSwapPress;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await swap.loadTokens();
    // Re-fetch both balances after a pull-to-refresh
    fetchBalance(swap.sellToken, sellAbortRef, setSellBalance);
    fetchBalance(swap.buyToken, buyAbortRef, setBuyBalance);
    setRefreshing(false);
  }, [swap.loadTokens, swap.sellToken, swap.buyToken, fetchBalance]);

  const handleSuccess = useCallback(() => {
    setShowConfirm(false);
    setCurrentQuote(null);
    swap.setSellAmount("");
    // Refresh both balances after a successful swap
    fetchBalance(swap.sellToken, sellAbortRef, setSellBalance);
    fetchBalance(swap.buyToken, buyAbortRef, setBuyBalance);
  }, [swap.setSellAmount, swap.sellToken, swap.buyToken, fetchBalance]);

  const handleFromAmountChange = useCallback(
    (val) => {
      setActivePct(null);
      if (isCrossChainMode) crossChainSwap.setFromAmount(val);
      else swap.setSellAmount(val);
    },
    [isCrossChainMode, crossChainSwap.setFromAmount, swap.setSellAmount],
  );

  const handleNumpadPress = useCallback((key) => {
    setActivePct(null);
    const prev = fromAmount || "";
    const setter = isCrossChainMode ? crossChainSwap.setFromAmount : swap.setSellAmount;
    if (key === "⌫") { setter(prev.slice(0, -1)); return; }
    if (key === "." && prev.includes(".")) return;
    if (key === "." && prev === "") { setter("0."); return; }
    if (prev === "0" && key !== ".") { setter(key); return; }
    setter(prev + key);
  }, [fromAmount, isCrossChainMode, crossChainSwap.setFromAmount, swap.setSellAmount]);

  const handleTrendingTokenPress = useCallback(async (coin) => {
    if (isCrossChainMode) return; // trending only shown in same-chain mode
    const platform = CHAIN_PLATFORM[activeChain?.id];
    if (!platform) return;
    try {
      const data = await getCoinDetail(coin.id);
      if (!data) return;
      const contractAddress =
        data.detailPlatforms?.[platform]?.contract_address ||
        data.platforms?.[platform];
      if (contractAddress) {
        swap.setBuyToken({
          address: contractAddress,
          symbol: coin.symbol?.toUpperCase(),
          name: coin.name,
          logoURI: coin.image,
          decimals: data.detailPlatforms?.[platform]?.decimal_place ?? 18,
          isNative: false,
        });
      } else {
        // Might be the native token itself
        const native = swap.tokenList?.find(
          (t) => t.isNative && t.symbol?.toLowerCase() === coin.symbol?.toLowerCase(),
        );
        if (native) swap.setBuyToken(native);
      }
    } catch { /* fail silently */ }
  }, [isCrossChainMode, activeChain?.id, swap.setBuyToken, swap.tokenList]);

  const handlePercentPress = useCallback(
    (pct) => {
      setActivePct(pct);
      const bal = safeFloat(fromBalance);
      const isNativeFrom = isCrossChainMode ? true : swap.sellToken?.isNative;
      const setter = isCrossChainMode ? crossChainSwap.setFromAmount : swap.setSellAmount;
      if (pct === 1.0) {
        if (isNativeFrom) {
          // Keep GAS_RESERVE_FRAC as a gas buffer
          const safe = Math.max(bal * (1 - GAS_RESERVE_FRAC), 0);
          setter(safe > 0 ? safe.toFixed(6) : "0");
        } else {
          swap.setMaxAmount(fromBalance);
        }
      } else {
        setter((bal * pct).toFixed(6).replace(/\.?0+$/, ""));
      }
    },
    [fromBalance, isCrossChainMode, swap.sellToken?.isNative, swap.setSellAmount, swap.setMaxAmount, crossChainSwap.setFromAmount],
  );

  // ── Derived values ───────────────────────────────────────────────────────────
  const exchangeRate = useMemo(
    () => swap.getExchangeRate(),
    [
      swap.sellAmount,
      swap.buyAmountEstimate,
      swap.sellToken?.symbol,
      swap.buyToken?.symbol,
    ],
  );

  const priceImpact = useMemo(() => swap.getPriceImpact(), [swap.priceInfo]);

  const nativeChainPrice = nativePrices[activeChain?.id]?.usd ?? null;

  const sellUsdPrice = useMemo(
    () => swap.getSellUsdPrice() ?? (swap.sellToken?.isNative ? nativeChainPrice : null),
    [swap.sellToken, swap.priceInfo, nativeChainPrice],
  );
  const buyUsdPrice = useMemo(
    () => swap.getBuyUsdPrice() ?? (swap.buyToken?.isNative ? nativeChainPrice : null),
    [swap.buyToken, swap.priceInfo, nativeChainPrice],
  );

  const impactColor = !priceImpact
    ? COLORS.textSecondary
    : priceImpact.severity === "low"
      ? COLORS.success
      : priceImpact.severity === "medium"
        ? COLORS.warning
        : COLORS.error;

  const isInsufficientBalance = useMemo(() => {
    const amount = safeFloat(fromAmount);
    const balance = safeFloat(fromBalance);
    return amount > 0 && amount > balance;
  }, [fromAmount, fromBalance]);

  const swapBtnLabel = useMemo(() => {
    if (isCrossChainMode) {
      if (!fromToken || !toToken) return "Select Assets";
      if (safeFloat(fromAmount) === 0) return "Enter Amount";
      if (isInsufficientBalance) return `Insufficient ${fromToken.symbol} Balance`;
      if (crossChainSwap.error) return "Invalid Transfer";
      return "Review Transfer";
    }
    if (!swap.sellToken || !swap.buyToken) return "Select Tokens";
    if (safeFloat(swap.sellAmount) === 0) return "Enter Amount";
    if (isInsufficientBalance)
      return `Insufficient ${swap.sellToken.symbol} Balance`;
    if (swap.error) return "Invalid Swap";
    return "Swap";
  }, [
    isCrossChainMode,
    fromToken,
    toToken,
    fromAmount,
    crossChainSwap.error,
    swap.sellToken,
    swap.buyToken,
    swap.sellAmount,
    swap.error,
    isInsufficientBalance,
  ]);

  const fromUsdLabel = useMemo(
    () => (isCrossChainMode ? null : formatUsd(swap.sellAmount, sellUsdPrice)),
    [isCrossChainMode, swap.sellAmount, sellUsdPrice],
  );
  const toUsdLabel = useMemo(
    () => (isCrossChainMode ? null : formatUsd(swap.buyAmountEstimate, buyUsdPrice)),
    [isCrossChainMode, swap.buyAmountEstimate, buyUsdPrice],
  );

  const toBalanceLabel = useMemo(() => {
    if (isCrossChainMode) return null; // no receive-side balance shown for bridges (matches old CrossChainPanel)
    if (!swap.buyToken) return null;
    return `Bal  ${formatBalance(buyBalance)} ${swap.buyToken.symbol}`;
  }, [isCrossChainMode, swap.buyToken, buyBalance]);

  const showPriceInfo = !isCrossChainMode && !!(swap.priceInfo || swap.isFetchingPrice);

  const actionDisabled = isCrossChainMode
    ? (!crossChainSwap.quote || crossChainSwap.isFetchingQuote || !!crossChainSwap.error || isInsufficientBalance)
    : (!swap.isReadyToSwap || swap.isFetchingQuote || isInsufficientBalance);

  const actionBusy = isCrossChainMode ? crossChainSwap.isFetchingQuote : swap.isFetchingQuote;
  const activeError = isCrossChainMode ? crossChainSwap.error : swap.error;
  const clearError = isCrossChainMode ? () => crossChainSwap.setError(null) : () => swap.setError(null);

  return (
    <View style={styles.safeArea}>
      <TabHeader
        title="Swap"
        rightActions={[{
          element: (
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              {/* Network pill — shows current chain + opens switcher */}
              <TouchableOpacity
                style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  backgroundColor: COLORS.surface,
                  paddingHorizontal: 10, paddingVertical: 7,
                  borderRadius: 8,
                }}
                onPress={() => setShowChainSwitcher(true)}
                activeOpacity={0.75}
              >
                <ChainIcon chain={activeChain} size={16} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.text }} numberOfLines={1}>
                  {activeChain?.name}
                </Text>
                <Ionicons name="chevron-down" size={11} color={COLORS.textSecondary} />
              </TouchableOpacity>
              {!isCrossChainMode && (
                <TouchableOpacity
                  style={[
                    { width: 34, height: 34, borderRadius: 8, justifyContent: "center", alignItems: "center" },
                    showSettings ? { backgroundColor: accentColor + "20" } : { backgroundColor: COLORS.surface },
                  ]}
                  onPress={() => setShowSettings((v) => !v)}
                >
                  <Ionicons name={showSettings ? "settings" : "settings-outline"} size={17} color={showSettings ? accentColor : COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          ),
        }]}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={accentColor} />}
      >
        {/* Slippage — 0x-specific, same-chain only */}
        {showSettings && !isCrossChainMode && (
          <SlippageSelector slippage={swap.slippage} onSelect={swap.setSlippage} theme={accentTheme} />
        )}

        {/* ── Network-changed banner ── */}
        {bannerName ? (
          <Animated.View
            style={{
              opacity: bannerAnim,
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: accentMuted,
              borderRadius: BORDER_RADIUS.md,
              paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
              marginBottom: SPACING.sm,
            }}
          >
            <ChainIcon chain={activeChain} size={15} />
            <Text style={{ fontSize: FONTS.sizes.sm, fontWeight: "600", color: accentColor }}>
              Switched to {bannerName}
            </Text>
          </Animated.View>
        ) : null}

        {/* ── Swap widget — one shared widget for both same-chain and
              cross-chain: picking a different chain on either card
              switches into the cross-chain (LI.FI) flow automatically. ── */}
        <View style={styles.swapWidget}>
          <AssetCard
            label="You Pay"
            side="from"
            chain={fromChain}
            token={fromToken}
            amount={fromAmount}
            isLoadingToken={isFetchingFromToken}
            usdLabel={fromUsdLabel}
            onPressChip={() => setActivePicker("from")}
            onPressAmount={() => setShowNumpad((v) => !v)}
            showCursor={showNumpad}
            cursorAnim={cursorAnim}
            numpadOpen={showNumpad}
            theme={accentTheme}
          />

          <View style={styles.bridgeRow}>
            <TouchableOpacity style={styles.bridgeBtn} onPress={handleFlip} activeOpacity={0.75}>
              <Ionicons name="swap-vertical" size={32} color={accentColor} />
            </TouchableOpacity>
          </View>

          <AssetCard
            label="You Receive"
            side="to"
            chain={toChain}
            token={toToken}
            amount={toAmountEstimate}
            isEstimate
            isFetchingEstimate={isFetchingToEstimate}
            balanceLabel={toBalanceLabel}
            usdLabel={toUsdLabel}
            onPressChip={() => setActivePicker("to")}
            theme={accentTheme}
          />
        </View>

        {/* Price info — 0x-specific, same-chain only */}
        {showPriceInfo && (
          <PriceInfo isFetchingPrice={swap.isFetchingPrice} exchangeRate={exchangeRate} priceImpact={priceImpact} slippage={swap.slippage} impactColor={impactColor} theme={accentTheme} />
        )}

        {/* Error */}
        {activeError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={15} color={COLORS.error} />
            <Text style={styles.errorText}>{activeError}</Text>
            <TouchableOpacity onPress={clearError} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={15} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Balance + PCT quick-fill — sits above numpad ── */}
        <View style={styles.amountControls}>
          <Text style={styles.amountControlsBal}>
            {fromToken
              ? `Bal  ${formatBalance(fromBalance)} ${fromToken.symbol}`
              : "Select an asset first"}
          </Text>
          <View style={styles.pctRow}>
            {PCT_OPTIONS.map(({ label, value }) => (
              <TouchableOpacity
                key={label}
                style={[styles.pctBtn, activePct === value && styles.pctBtnActive]}
                onPress={() => handlePercentPress(value)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text style={[styles.pctBtnText, activePct === value && styles.pctBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {(isCrossChainMode || fromToken?.isNative) && (
          <Text style={[styles.gasNote, { marginBottom: SPACING.xs }]}>
            ⛽ MAX reserves ~1% for gas
          </Text>
        )}

        {/* ── In-screen numpad — only visible when amount field is tapped ── */}
        {showNumpad && <Numpad onPress={handleNumpadPress} theme={accentTheme} />}

        {/* ── Action button ── */}
        <TouchableOpacity
          style={[
            styles.swapActionBtn,
            isInsufficientBalance ? styles.swapActionBtnInsufficient
              : actionDisabled ? styles.swapActionBtnDisabled : null,
          ]}
          onPress={handleActionPress}
          disabled={actionDisabled}
          activeOpacity={0.85}
        >
          {/* swapActionBtnInsufficient swaps the bg to COLORS.error, which is
              theme-inverted (black in light mode, white in dark) rather than
              part of the primary/lime family — COLORS.background gives the
              right contrast in both cases there, COLORS.onPrimary otherwise. */}
          {actionBusy
            ? <ActivityIndicator color={isInsufficientBalance ? COLORS.background : COLORS.onPrimary} />
            : <Text style={[styles.swapActionBtnText, isInsufficientBalance && { color: COLORS.background }]}>{swapBtnLabel}</Text>}
        </TouchableOpacity>

        {/* Powered by */}
        <View style={styles.poweredBy}>
          <Text style={styles.poweredByText}>Powered by </Text>
          <Text style={styles.poweredByBrand}>{isCrossChainMode ? "LI.FI" : "0x Protocol"}</Text>
        </View>

        {/* ── Trending tokens (CoinGecko, no card/border) — same-chain only ── */}
        {!isCrossChainMode && trendingCoins.length > 0 && (
          <View style={styles.trendingSection}>
            <View style={styles.trendingHeader}>
              <Ionicons name="bar-chart-outline" size={14} color={accentColor} />
              <Text style={styles.trendingTitle}>
                Top Traded{activeChain?.name ? ` on ${activeChain.name}` : ""}
              </Text>
              {loadingTrending && <ActivityIndicator size="small" color={accentColor} style={{ marginLeft: "auto" }} />}
            </View>

            {trendingCoins.map((coin) => {
              const isPos = (coin.change24h ?? 0) >= 0;
              return (
                <TouchableOpacity
                  key={coin.id}
                  style={styles.trendingItem}
                  onPress={() => handleTrendingTokenPress(coin)}
                  activeOpacity={0.7}
                >
                  <Image source={{ uri: coin.image }} style={styles.trendingItemIcon} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.trendingItemSymbol}>{coin.symbol?.toUpperCase()}</Text>
                    <Text style={styles.trendingItemName} numberOfLines={1}>{coin.name}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", marginRight: 8, gap: 2 }}>
                    <Text style={styles.trendingItemPrice}>{fmtPrice(coin.price)}</Text>
                    <Text style={[styles.trendingItemChange, { color: isPos ? accentColor : COLORS.error }]}>
                      {isPos ? "+" : ""}{coin.change24h?.toFixed(2)}%
                    </Text>
                  </View>
                  <MiniSparkLine data={coin.sparkline} positive={isPos} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <AssetPickerModal
        visible={activePicker === "from"}
        onClose={() => setActivePicker(null)}
        chains={pickerChains}
        currentChain={fromChain}
        activeChainId={activeChain?.id}
        otherSideChainId={toChain?.id}
        sameChainTokens={swap.tokenList}
        loadingSameChainTokens={swap.loadingTokens}
        selectedToken={fromToken}
        excludeToken={toToken}
        onCommit={handleFromAssetSelect}
        title="You Pay"
      />
      <AssetPickerModal
        visible={activePicker === "to"}
        onClose={() => setActivePicker(null)}
        chains={pickerChains}
        currentChain={toChain}
        activeChainId={activeChain?.id}
        otherSideChainId={activeChain?.id}
        sameChainTokens={swap.tokenList}
        loadingSameChainTokens={swap.loadingTokens}
        selectedToken={toToken}
        excludeToken={fromToken}
        onCommit={handleToAssetSelect}
        title="You Receive"
      />

      {currentQuote && (
        <SwapConfirmModal
          visible={showConfirm}
          onClose={() => { setShowConfirm(false); setCurrentQuote(null); }}
          onSuccess={handleSuccess}
          quote={currentQuote}
          sellToken={swap.sellToken}
          buyToken={swap.buyToken}
          sellAmount={swap.sellAmount}
          buyAmountEstimate={swap.buyAmountEstimate}
        />
      )}
      <ChainSwitcher visible={showChainSwitcher} onClose={() => setShowChainSwitcher(false)} />

      <CrossChainConfirmModal
        visible={showCrossChainConfirm}
        onClose={() => setShowCrossChainConfirm(false)}
        onSuccess={() => {
          setShowCrossChainConfirm(false);
          crossChainSwap.reset();
        }}
        crossChainSwap={crossChainSwap}
      />
    </View>
  );
}
