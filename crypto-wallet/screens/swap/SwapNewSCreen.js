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
import ChainIcon from "../../components/common/ChainIcon";
import Svg, { Polyline, Polygon, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";
import { useWallet } from "../../contexts/WalletContext";
import { useChain } from "../../contexts/ChainContext";
import { useSwap } from "../../hooks/useSwap";
import { TokenSelectorModal } from "../../components/swap/TokenSelectorModal";
import { SwapConfirmModal } from "../../components/swap/SwapConfirmModal";
import ChainSwitcher from "../../components/wallet/ChainSwitcher";
import TabHeader from "../../components/common/TabHeader";
// ✅ Pull balance utils directly — no WalletContext wrapper needed
import {
  getTokenBalance as fetchERC20Balance,
  getNativeBalance,
} from "../../utils/blockchain/Balances";
import { getAllNativePricesByChainId } from "../../services/coingecko";

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
// CoinGecko category slugs for chain-specific top-traded
const CHAIN_CATEGORY = {
  1:     'ethereum-ecosystem',
  137:   'polygon-ecosystem',
  42161: 'arbitrum-ecosystem',
  43114: 'avalanche-ecosystem',
  8453:  'base-ecosystem',
};

const fetchTopTokensByChain = async (chainId, limit = 10) => {
  const category = CHAIN_CATEGORY[chainId];
  if (!category) return [];
  const url =
    `https://api.coingecko.com/api/v3/coins/markets` +
    `?vs_currency=usd&category=${category}&order=volume_desc` +
    `&per_page=${limit}&page=1&sparkline=true&price_change_percentage=24h`;
  const res = await fetch(url);
  const raw = await res.json();
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => ({
    id:        c.id,
    symbol:    c.symbol,
    name:      c.name,
    image:     c.image,
    price:     c.current_price,
    change24h: c.price_change_percentage_24h,
    sparkline: c.sparkline_in_7d?.price ?? [],
  }));
};

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

// ─── TokenLogo ────────────────────────────────────────────────────────────────
const TokenLogo = memo(({ logoURI, symbol, size = 28, theme }) => {
  const [imgError, setImgError] = useState(false);
  const { COLORS } = theme;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        image: { width: size, height: size, borderRadius: size / 2 },
        fallback: {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS.primaryMuted,
          alignItems: "center",
          justifyContent: "center",
        },
        fallbackText: {
          fontSize: size * 0.4,
          fontWeight: "800",
          color: COLORS.primaryDark,
        },
      }),
    [size, COLORS],
  );

  if (logoURI && !imgError) {
    return (
      <Image
        source={{ uri: logoURI }}
        style={styles.image}
        onError={() => setImgError(true)}
        fadeDuration={0}
      />
    );
  }
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>{symbol?.charAt(0) ?? "?"}</Text>
    </View>
  );
});

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
          color: COLORS.background,
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

// ─── TokenInputBox ────────────────────────────────────────────────────────────
const TokenInputBox = memo(
  ({
    label,
    token,
    amount,
    onAmountChange,
    onTokenPress,
    isReadOnly,
    isFetching,
    balance,
    usdPrice,
    onPercentPress,
    activePct,
    isNativeSell,
    theme,
  }) => {
    const { COLORS, SPACING, FONTS, BORDER_RADIUS, SHADOWS } = theme;

    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: { padding: SPACING.md },
          header: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: SPACING.sm,
          },
          label: {
            fontSize: FONTS.sizes.xs,
            fontWeight: "700",
            color: COLORS.textTertiary,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          },
          balanceCol: { alignItems: "flex-end", gap: 5 },
          balanceText: {
            fontSize: FONTS.sizes.xs,
            color: COLORS.textSecondary,
          },
          pctRow: {
            flexDirection: "row",
            gap: 4,
          },
          pctBtn: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: COLORS.background,
            borderWidth: 1,
            borderColor: COLORS.border,
          },
          pctBtnActive: {
            backgroundColor: COLORS.primaryMuted,
            borderColor: COLORS.primary,
          },
          pctBtnText: {
            fontSize: 11,
            fontWeight: "700",
            color: COLORS.textSecondary,
          },
          pctBtnTextActive: {
            color: COLORS.primaryDark,
          },
          gasNote: {
            fontSize: 10,
            color: COLORS.textTertiary,
            fontStyle: "italic",
          },
          body: { flexDirection: "row", alignItems: "center" },
          inputWrapper: { flex: 1 },
          input: {
            fontSize: FONTS.sizes.xxl,
            fontWeight: "700",
            color: COLORS.text,
            padding: 0,
            minHeight: 44,
          },
          inputReadOnly: { color: COLORS.textSecondary },
          usdLabel: {
            fontSize: FONTS.sizes.xs,
            color: COLORS.textTertiary,
            marginTop: 2,
          },
          tokenSelector: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: COLORS.card,
            borderRadius: BORDER_RADIUS.lg,
            paddingVertical: SPACING.sm,
            paddingHorizontal: SPACING.sm,
            gap: SPACING.xs,
            borderWidth: 1,
            borderColor: COLORS.borderStrong,
            minWidth: 100,
            ...SHADOWS.small,
          },
          tokenSymbol: {
            fontSize: FONTS.sizes.md,
            fontWeight: "700",
            color: COLORS.text,
          },
          tokenPlaceholder: {
            fontSize: FONTS.sizes.sm,
            color: COLORS.primary,
            fontWeight: "700",
          },
        }),
      [theme],
    );

    const usdLabel = useMemo(
      () => formatUsd(amount, usdPrice),
      [amount, usdPrice],
    );
    const balanceLabel = useMemo(() => formatBalance(balance), [balance]);
    const showPct = !isReadOnly && !!onPercentPress && safeFloat(balance) > 0 && !!token;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.label}>{label}</Text>
          {token && (
            <View style={styles.balanceCol}>
              <Text style={styles.balanceText}>Balance: {balanceLabel}</Text>
              {showPct && (
                <View style={styles.pctRow}>
                  {PCT_OPTIONS.map(({ label: pLabel, value }) => (
                    <TouchableOpacity
                      key={pLabel}
                      style={[styles.pctBtn, activePct === value && styles.pctBtnActive]}
                      onPress={() => onPercentPress(value)}
                      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                    >
                      <Text style={[styles.pctBtnText, activePct === value && styles.pctBtnTextActive]}>
                        {pLabel}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {showPct && isNativeSell && (
                <Text style={styles.gasNote}>⛽ MAX keeps ~1% for gas</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.inputWrapper}>
            {isFetching ? (
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
                style={{ alignSelf: "flex-start" }}
              />
            ) : (
              <>
                <TextInput
                  style={[styles.input, isReadOnly && styles.inputReadOnly]}
                  placeholder="0.0"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={onAmountChange}
                  editable={!isReadOnly}
                />
                {usdLabel ? (
                  <Text style={styles.usdLabel}>{usdLabel}</Text>
                ) : null}
              </>
            )}
          </View>

          <TouchableOpacity
            style={styles.tokenSelector}
            onPress={onTokenPress}
            activeOpacity={0.75}
          >
            {token ? (
              <>
                <TokenLogo
                  logoURI={token.logoURI}
                  symbol={token.symbol}
                  size={26}
                  theme={theme}
                />
                <Text style={styles.tokenSymbol}>{token.symbol}</Text>
              </>
            ) : (
              <Text style={styles.tokenPlaceholder}>Select</Text>
            )}
            <Ionicons
              name="chevron-down"
              size={14}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);

// ─── ChainButton ──────────────────────────────────────────────────────────────
const ChainButton = memo(({ chain, onPress, theme }) => {
  const { COLORS, SPACING, BORDER_RADIUS } = theme;
  const [iconError, setIconError] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        btn: {
          flexDirection: "row",
          alignItems: "center",
          gap: SPACING.xs,
          paddingVertical: SPACING.sm,
          paddingHorizontal: SPACING.sm,
          borderRadius: BORDER_RADIUS.md,
          backgroundColor: COLORS.surface,
          borderWidth: 1,
          borderColor: COLORS.border,
        },
        icon: { width: 18, height: 18, borderRadius: 9 },
        iconFallback: {
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: COLORS.primaryMuted,
          alignItems: "center",
          justifyContent: "center",
        },
        iconFallbackText: {
          fontSize: 9,
          fontWeight: "800",
          color: COLORS.primaryDark,
        },
      }),
    [theme],
  );

  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.75}>
      {true ? (
        <ChainIcon chain={chain} size={18} style={styles.icon} />
      ) : (
        <View style={styles.iconFallback}>
          <Text style={styles.iconFallbackText}>
            {chain?.name?.charAt(0) ?? "?"}
          </Text>
        </View>
      )}
      <Ionicons name="chevron-down" size={11} color={COLORS.textSecondary} />
    </TouchableOpacity>
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

// ─── SwapTokenCard ────────────────────────────────────────────────────────────
const SwapTokenCard = memo(({ token, priceUsd, change24h, onPress, isCurrent, isLast, theme }) => {
  const { COLORS, SPACING, FONTS, BORDER_RADIUS } = theme;
  const isPos = (change24h ?? 0) >= 0;

  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SPACING.md,
        paddingVertical: 11,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border + "60",
        opacity: isCurrent ? 0.4 : 1,
      }}
      onPress={onPress}
      disabled={isCurrent}
      activeOpacity={0.7}
    >
      <TokenLogo logoURI={token.logoURI} symbol={token.symbol} size={38} theme={theme} />

      <View style={{ flex: 1, marginLeft: SPACING.sm }}>
        <Text style={{ fontSize: FONTS.sizes.sm, fontWeight: "700", color: COLORS.text }}>
          {token.symbol}
        </Text>
        <Text style={{ fontSize: FONTS.sizes.xs, color: COLORS.textTertiary }} numberOfLines={1}>
          {token.name}
        </Text>
      </View>

      {priceUsd != null ? (
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Text style={{ fontSize: FONTS.sizes.sm, fontWeight: "600", color: COLORS.text }}>
            {priceUsd >= 1
              ? `$${priceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
              : `$${priceUsd.toFixed(4)}`}
          </Text>
          {change24h != null && (
            <Text style={{ fontSize: 11, fontWeight: "700", color: isPos ? COLORS.primary : COLORS.error }}>
              {isPos ? "+" : ""}{change24h.toFixed(2)}%
            </Text>
          )}
        </View>
      ) : (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 4,
          backgroundColor: COLORS.primaryMuted,
          borderRadius: BORDER_RADIUS.md,
          paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
        }}>
          <Ionicons name="add" size={13} color={COLORS.primaryDark} />
          <Text style={{ fontSize: FONTS.sizes.xs, fontWeight: "700", color: COLORS.primaryDark }}>
            Buy
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ─── SwapScreen ───────────────────────────────────────────────────────────────
export default function SwapScreen() {
  const theme = useTheme();
  const { COLORS, SPACING, FONTS, BORDER_RADIUS, SHADOWS } = theme;

  const { activeChain } = useChain();
  // ✅ Only need wallet.address from context — balance fetching goes direct to util
  const { wallet } = useWallet();
  const swap = useSwap();

  const [showSellSelector, setShowSellSelector] = useState(false);
  const [showBuySelector, setShowBuySelector] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChainSwitcher, setShowChainSwitcher] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sellBalance, setSellBalance] = useState("0");
  const [buyBalance, setBuyBalance] = useState("0");

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
    // Skip the very first mount — only show on actual switches.
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

        // Individual input card — borderless, slim
        inputCard: {
          backgroundColor: COLORS.surface,
          borderRadius: BORDER_RADIUS.xl,
          paddingHorizontal: 14,
          paddingTop: 8,
          paddingBottom: 8,
          ...SHADOWS.small,
        },
        inputCardRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        },
        inputLabel: {
          fontSize: FONTS.sizes.xs,
          fontWeight: "700",
          color: COLORS.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 0.9,
        },
        inputBalance: {
          fontSize: FONTS.sizes.xs,
          color: COLORS.textSecondary,
          marginTop: 4,
        },

        // Token chip
        tokenChip: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: COLORS.card,
          borderRadius: 24,
          paddingVertical: 6,
          paddingHorizontal: 10,
          gap: 5,
          ...SHADOWS.small,
        },
        tokenChipText: { fontSize: FONTS.sizes.sm, fontWeight: "800", color: COLORS.text },
        tokenChipSelect: { fontSize: FONTS.sizes.sm, fontWeight: "800", color: COLORS.primary },

        // PCT buttons row
        pctRow: { flexDirection: "row", gap: 5 },
        pctBtn: {
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: 7,
          backgroundColor: COLORS.background,
          borderWidth: 1,
          borderColor: COLORS.border,
        },
        pctBtnActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary },
        pctBtnText: { fontSize: 10, fontWeight: "700", color: COLORS.textSecondary },
        pctBtnTextActive: { color: COLORS.primaryDark },

        // Amount display
        amountBig: {
          fontSize: 34,
          fontWeight: "800",
          color: COLORS.text,
          letterSpacing: -1,
          includeFontPadding: false,
          marginBottom: 1,
        },
        amountUsd: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },
        fetchingText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
        gasNote: { fontSize: 10, color: COLORS.textTertiary, fontStyle: "italic", marginTop: 2 },

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
          backgroundColor: COLORS.primary,
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
          color: "#fff", letterSpacing: 0.3,
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
    [theme],
  );

  // ── Balance fetching ─────────────────────────────────────────────────────────
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
    fetchTopTokensByChain(activeChain.id)
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

  // ── Debounced price fetch ────────────────────────────────────────────────────
  const debouncedSellAmount = useDebounce(swap.sellAmount, 400);
  useEffect(() => {
    if (safeFloat(debouncedSellAmount) > 0 && swap.sellToken && swap.buyToken) {
      swap.fetchPrice?.();
    }
  }, [debouncedSellAmount, swap.sellToken?.address, swap.buyToken?.address]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSwapPress = useCallback(async () => {
    try {
      const quote = await swap.fetchQuote();
      setCurrentQuote(quote);
      setShowConfirm(true);
    } catch (err) {
      console.error("[SwapScreen] quote error:", err);
    }
  }, [swap.fetchQuote]);

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

  const handleSellTokenSelect = useCallback(
    (token) => {
      swap.setSellToken(token);
      if (swap.buyToken?.address === token.address) swap.setBuyToken(null);
      setShowSellSelector(false);
    },
    [swap.buyToken?.address],
  );

  const handleBuyTokenSelect = useCallback(
    (token) => {
      swap.setBuyToken(token);
      if (swap.sellToken?.address === token.address) swap.setSellToken(null);
      setShowBuySelector(false);
    },
    [swap.sellToken?.address],
  );

  const handleSellAmountChange = useCallback(
    (val) => { setActivePct(null); swap.setSellAmount(val); },
    [swap.setSellAmount],
  );

  const handleNumpadPress = useCallback((key) => {
    setActivePct(null);
    const prev = swap.sellAmount || "";
    if (key === "⌫") { swap.setSellAmount(prev.slice(0, -1)); return; }
    if (key === "." && prev.includes(".")) return;
    if (key === "." && prev === "") { swap.setSellAmount("0."); return; }
    if (prev === "0" && key !== ".") { swap.setSellAmount(key); return; }
    swap.setSellAmount(prev + key);
  }, [swap.sellAmount, swap.setSellAmount]);

  const handleTrendingTokenPress = useCallback(async (coin) => {
    const platform = CHAIN_PLATFORM[activeChain?.id];
    if (!platform) return;
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
      );
      const data = await res.json();
      const contractAddress =
        data.detail_platforms?.[platform]?.contract_address ||
        data.platforms?.[platform];
      if (contractAddress) {
        swap.setBuyToken({
          address: contractAddress,
          symbol: coin.symbol?.toUpperCase(),
          name: coin.name,
          logoURI: coin.image,
          decimals: data.detail_platforms?.[platform]?.decimal_place ?? 18,
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
  }, [activeChain?.id, swap.setBuyToken, swap.tokenList]);

  const handlePercentPress = useCallback(
    (pct) => {
      setActivePct(pct);
      const bal = safeFloat(sellBalance);
      if (pct === 1.0) {
        if (swap.sellToken?.isNative) {
          // Keep GAS_RESERVE_FRAC as a gas buffer
          const safe = Math.max(bal * (1 - GAS_RESERVE_FRAC), 0);
          swap.setSellAmount(safe > 0 ? safe.toFixed(6) : "0");
        } else {
          swap.setMaxAmount(sellBalance);
        }
      } else {
        swap.setSellAmount((bal * pct).toFixed(6).replace(/\.?0+$/, ""));
      }
    },
    [sellBalance, swap.sellToken?.isNative, swap.setSellAmount, swap.setMaxAmount],
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
    const amount = safeFloat(swap.sellAmount);
    const balance = safeFloat(sellBalance);
    return amount > 0 && amount > balance;
  }, [swap.sellAmount, sellBalance]);

  const swapBtnLabel = useMemo(() => {
    if (!swap.sellToken || !swap.buyToken) return "Select Tokens";
    if (safeFloat(swap.sellAmount) === 0) return "Enter Amount";
    if (isInsufficientBalance)
      return `Insufficient ${swap.sellToken.symbol} Balance`;
    if (swap.error) return "Invalid Swap";
    return "Swap";
  }, [
    swap.sellToken,
    swap.buyToken,
    swap.sellAmount,
    swap.error,
    isInsufficientBalance,
  ]);

  const sellUsdLabel = useMemo(
    () => formatUsd(swap.sellAmount, sellUsdPrice),
    [swap.sellAmount, sellUsdPrice],
  );
  const buyUsdLabel = useMemo(
    () => formatUsd(swap.buyAmountEstimate, buyUsdPrice),
    [swap.buyAmountEstimate, buyUsdPrice],
  );

  const showPriceInfo = !!(swap.priceInfo || swap.isFetchingPrice);
  const swapDisabled =
    !swap.isReadyToSwap || swap.isFetchingQuote || isInsufficientBalance;

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
              <TouchableOpacity
                style={[
                  { width: 34, height: 34, borderRadius: 8, justifyContent: "center", alignItems: "center" },
                  showSettings ? { backgroundColor: COLORS.primary + "20" } : { backgroundColor: COLORS.surface },
                ]}
                onPress={() => setShowSettings((v) => !v)}
              >
                <Ionicons name={showSettings ? "settings" : "settings-outline"} size={17} color={showSettings ? COLORS.primary : COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          ),
        }]}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
      >
        {/* Slippage */}
        {showSettings && <SlippageSelector slippage={swap.slippage} onSelect={swap.setSlippage} theme={theme} />}

        {/* ── Network-changed banner ── */}
        {bannerName ? (
          <Animated.View
            style={{
              opacity: bannerAnim,
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: COLORS.primaryMuted,
              borderRadius: BORDER_RADIUS.md,
              paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
              marginBottom: SPACING.sm,
            }}
          >
            <ChainIcon chain={activeChain} size={15} />
            <Text style={{ fontSize: FONTS.sizes.sm, fontWeight: "600", color: COLORS.primaryDark }}>
              Switched to {bannerName}
            </Text>
          </Animated.View>
        ) : null}

        {/* ── Swap widget ── */}
        <View style={styles.swapWidget}>

          {/* Sell card — slim: just label + chip + amount */}
          <View style={[
            styles.inputCard,
            { paddingBottom: 20 },
            showNumpad && { borderWidth: 1, borderColor: COLORS.primary },
          ]}>
            <View style={styles.inputCardRow}>
              <Text style={styles.inputLabel}>You Pay</Text>
              <TouchableOpacity style={styles.tokenChip} onPress={() => setShowSellSelector(true)} activeOpacity={0.75}>
                {swap.loadingTokens ? (
                  <>
                    <ActivityIndicator size={14} color={COLORS.primary} />
                    <Text style={styles.tokenChipSelect}>Loading…</Text>
                  </>
                ) : swap.sellToken ? (
                  <>
                    <TokenLogo logoURI={swap.sellToken.logoURI} symbol={swap.sellToken.symbol} size={20} theme={theme} />
                    <Text style={styles.tokenChipText}>{swap.sellToken.symbol}</Text>
                  </>
                ) : (
                  <Text style={styles.tokenChipSelect}>Select token</Text>
                )}
                <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Tapping the amount area opens the numpad */}
            <TouchableOpacity
              onPress={() => setShowNumpad(v => !v)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.amountBig} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.35}>
                  {swap.sellAmount || "0"}
                </Text>
                {showNumpad && (
                  <Animated.Text style={[styles.amountBig, { opacity: cursorAnim, marginLeft: 2 }]}>
                    |
                  </Animated.Text>
                )}
              </View>
              {sellUsdLabel ? <Text style={styles.amountUsd}>{sellUsdLabel}</Text> : null}
            </TouchableOpacity>
          </View>

          {/* Bridge — sits at the join of both cards */}
          <View style={styles.bridgeRow}>
            <TouchableOpacity style={styles.bridgeBtn} onPress={swap.flipTokens} activeOpacity={0.75}>
              <Ionicons name="swap-vertical" size={32} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Buy card — slim: label + chip + estimate */}
          <View style={[styles.inputCard, { paddingTop: 20 }]}>
            <View style={styles.inputCardRow}>
              <Text style={styles.inputLabel}>You Receive</Text>
              <TouchableOpacity style={styles.tokenChip} onPress={() => setShowBuySelector(true)} activeOpacity={0.75}>
                {swap.loadingTokens ? (
                  <>
                    <ActivityIndicator size={14} color={COLORS.primary} />
                    <Text style={styles.tokenChipSelect}>Loading…</Text>
                  </>
                ) : swap.buyToken ? (
                  <>
                    <TokenLogo logoURI={swap.buyToken.logoURI} symbol={swap.buyToken.symbol} size={20} theme={theme} />
                    <Text style={styles.tokenChipText}>{swap.buyToken.symbol}</Text>
                  </>
                ) : (
                  <Text style={styles.tokenChipSelect}>Select token</Text>
                )}
                <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {swap.isFetchingPrice ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 }}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.fetchingText}>Fetching best price…</Text>
              </View>
            ) : (
              <Text style={[styles.amountBig, { color: COLORS.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.35}>
                {swap.buyAmountEstimate || "0"}
              </Text>
            )}
            {buyUsdLabel ? <Text style={styles.amountUsd}>{buyUsdLabel}</Text> : null}
            {swap.buyToken && (
              <Text style={[styles.inputBalance, { marginTop: SPACING.xs }]}>
                Bal  {formatBalance(buyBalance)} {swap.buyToken.symbol}
              </Text>
            )}
          </View>
        </View>

        {/* Price info */}
        {showPriceInfo && (
          <PriceInfo isFetchingPrice={swap.isFetchingPrice} exchangeRate={exchangeRate} priceImpact={priceImpact} slippage={swap.slippage} impactColor={impactColor} theme={theme} />
        )}

        {/* Error */}
        {swap.error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={15} color={COLORS.error} />
            <Text style={styles.errorText}>{swap.error}</Text>
            <TouchableOpacity onPress={() => swap.setError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={15} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Balance + PCT quick-fill — sits above numpad ── */}
        <View style={styles.amountControls}>
          <Text style={styles.amountControlsBal}>
            {swap.sellToken
              ? `Bal  ${formatBalance(sellBalance)} ${swap.sellToken.symbol}`
              : "Select a token first"}
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
        {swap.sellToken?.isNative && (
          <Text style={[styles.gasNote, { marginBottom: SPACING.xs }]}>
            ⛽ MAX reserves ~1% for gas
          </Text>
        )}

        {/* ── In-screen numpad — only visible when amount field is tapped ── */}
        {showNumpad && <Numpad onPress={handleNumpadPress} theme={theme} />}

        {/* ── Swap action button ── */}
        <TouchableOpacity
          style={[
            styles.swapActionBtn,
            isInsufficientBalance ? styles.swapActionBtnInsufficient
              : swapDisabled ? styles.swapActionBtnDisabled : null,
          ]}
          onPress={handleSwapPress}
          disabled={swapDisabled}
          activeOpacity={0.85}
        >
          {swap.isFetchingQuote
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.swapActionBtnText}>{swapBtnLabel}</Text>}
        </TouchableOpacity>

        {/* Powered by */}
        <View style={styles.poweredBy}>
          <Text style={styles.poweredByText}>Powered by </Text>
          <Text style={styles.poweredByBrand}>0x Protocol</Text>
        </View>

        {/* ── Trending tokens (CoinGecko, no card/border) ── */}
        {trendingCoins.length > 0 && (
          <View style={styles.trendingSection}>
            <View style={styles.trendingHeader}>
              <Ionicons name="bar-chart-outline" size={14} color={COLORS.primary} />
              <Text style={styles.trendingTitle}>
                Top Traded{activeChain?.name ? ` on ${activeChain.name}` : ""}
              </Text>
              {loadingTrending && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: "auto" }} />}
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
                    <Text style={[styles.trendingItemChange, { color: isPos ? COLORS.primary : COLORS.error }]}>
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
      {showSellSelector && (
        <TokenSelectorModal visible onClose={() => setShowSellSelector(false)} onSelect={handleSellTokenSelect} tokens={swap.tokenList} selectedToken={swap.sellToken} excludeToken={swap.buyToken} title="You Pay" />
      )}
      {showBuySelector && (
        <TokenSelectorModal visible onClose={() => setShowBuySelector(false)} onSelect={handleBuyTokenSelect} tokens={swap.tokenList} selectedToken={swap.buyToken} excludeToken={swap.sellToken} title="You Receive" />
      )}
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
    </View>
  );
}
