import React, { useState, useEffect, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWallet } from "../../contexts/WalletContext";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { getUserByUid, deleteToken, hideToken, getDatabase } from "../../utils/Database";
import { getTokensByChain, getTokenBalanceCacheForChain, saveTokenBalanceCache } from "../../utils/TokenDatabase";
import coinGeckoService from "../../services/coingec";
import Alert from "../../utils/Alert";
import { getTokenBalanceFast } from "../../utils/blockchain";
import { getTokenByAddress as getBaseToken } from "../../utils/token/base";

// ─── Native asset map ─────────────────────────────────────────────────────────

const NATIVE_ASSETS = {
  1: {
    symbol: "ETH",
    name: "Ethereum",
    coingeckoId: "ethereum",
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  },
  5: {
    symbol: "ETH",
    name: "Ethereum (Goerli)",
    coingeckoId: "ethereum",
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  },
  11155111: {
    symbol: "ETH",
    name: "Ethereum (Sepolia)",
    coingeckoId: "ethereum",
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  },
  10: {
    symbol: "ETH",
    name: "Ethereum",
    coingeckoId: "ethereum",
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  },
  42161: {
    symbol: "ETH",
    name: "Ethereum",
    coingeckoId: "ethereum",
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  },
  8453: {
    symbol: "ETH",
    name: "Ethereum",
    coingeckoId: "ethereum",
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  },
  56: {
    symbol: "BNB",
    name: "BNB",
    coingeckoId: "binancecoin",
    logo: "https://assets.coingecko.com/coins/images/825/small/binance-coin-logo.png",
  },
  97: {
    symbol: "tBNB",
    name: "BNB (Testnet)",
    coingeckoId: "binancecoin",
    logo: "https://assets.coingecko.com/coins/images/825/small/binance-coin-logo.png",
  },
  137: {
    symbol: "POL",
    name: "Polygon",
    coingeckoId: "matic-network",
    logo: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
  },
  80001: {
    symbol: "MATIC",
    name: "Polygon (Mumbai)",
    coingeckoId: "matic-network",
    logo: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
  },
  43114: {
    symbol: "AVAX",
    name: "Avalanche",
    coingeckoId: "avalanche-2",
    logo: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  },
  250: {
    symbol: "FTM",
    name: "Fantom",
    coingeckoId: "fantom",
    logo: "https://assets.coingecko.com/coins/images/4001/small/Fantom_round.png",
  },
  100: {
    symbol: "xDAI",
    name: "Gnosis",
    coingeckoId: "xdai",
    logo: "https://assets.coingecko.com/coins/images/11062/small/Identity-Primary-DarkBG.png",
  },
  999: {
    symbol: "HYPE",
    name: "HYPE",
    coingeckoId: "hyperliquid",
    logo: "https://assets.coingecko.com/coins/images/36059/small/hyperliquid.png",
  },
};

const getNativeAsset = (chainId) =>
  NATIVE_ASSETS[parseInt(chainId)] || {
    symbol: "ETH",
    name: "Ethereum",
    coingeckoId: "ethereum",
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  };

// ─── CoinGecko native price ───────────────────────────────────────────────────

const fetchNativePrice = async (coingeckoId) => {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const entry = data[coingeckoId];
    if (!entry) return null;
    return { usd: entry.usd, usd_24h_change: entry.usd_24h_change };
  } catch {
    return null;
  }
};

// ─── Native balance via JSON-RPC ──────────────────────────────────────────────

const fetchNativeBalance = async (walletAddress, rpcUrl) => {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [walletAddress, "latest"],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || !data.result) return null;
    const wei = BigInt(data.result);
    const divisor = BigInt("1000000000000000000");
    const whole = wei / divisor;
    const frac = (wei % divisor).toString().padStart(18, "0").substring(0, 6);
    return `${whole}.${frac}`;
  } catch {
    return null;
  }
};

// ─── Token Logo ───────────────────────────────────────────────────────────────

const NATIVE_SENTINEL = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const buildLogoSources = (logoURI, address, symbol) => {
  const sources = [];
  // A local bundled asset (require('...png'), e.g. a chain's native-token
  // logo pulled from SUPPORTED_CHAINS[...].icon) resolves to a number/object,
  // not a string — no .endsWith, and no CDN fallback chain makes sense for it.
  if (logoURI && typeof logoURI !== "string") return [logoURI];
  if (logoURI) {
    sources.push(logoURI);
    if (logoURI.endsWith(".svg")) sources.push(logoURI.replace(".svg", ".png"));
  }
  if (address && address.toLowerCase() !== NATIVE_SENTINEL) {
    const addrLower = address.toLowerCase();
    sources.push(`https://tokens.1inch.io/${addrLower}.png`);
    sources.push(
      `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${address}/logo.png`,
    );
    if (symbol) {
      sources.push(`https://ethereum-optimism.github.io/data/${symbol}/logo.png`);
    }
  }
  return sources;
};

const LOGO_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#d6ff00",
  "#f97316",
  "#06b6d4",
];

const TokenLogo = ({ uri, address, symbol, size = 44, theme }) => {
  const sources = React.useMemo(
    () => buildLogoSources(uri, address, symbol),
    [uri, address, symbol],
  );
  const [srcIndex, setSrcIndex] = React.useState(0);

  React.useEffect(() => {
    setSrcIndex(0);
  }, [uri, address]);

  const currentSrc = sources[srcIndex];

  if (currentSrc) {
    return (
      <Image
        source={typeof currentSrc === "string" ? { uri: currentSrc } : currentSrc}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setSrcIndex((i) => i + 1)}
        fadeDuration={150}
      />
    );
  }

  const bg = LOGO_COLORS[(symbol?.charCodeAt(0) || 0) % LOGO_COLORS.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.33, fontWeight: "800", color: "#fff" }}>
        {(symbol || "??").substring(0, 2).toUpperCase()}
      </Text>
    </View>
  );
};

// ─── Price change badge ───────────────────────────────────────────────────────

const ChangeBadge = ({ change, theme }) => {
  if (change === undefined || change === null || !theme) return null;
  const pos = change >= 0;
  return (
    <View
      style={{
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 5,
        backgroundColor: theme.COLORS.surface,
        borderWidth: 1,
        borderColor: theme.COLORS.border,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: pos ? theme.COLORS.primary : theme.COLORS.error,
        }}
      >
        {pos ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
      </Text>
    </View>
  );
};

// ─── Format helpers ───────────────────────────────────────────────────────────

const fmtBalance = (val) => {
  const n = parseFloat(val || "0");
  if (n === 0) return "0";
  if (n < 1e-6) return "< 0.000001";
  if (n < 0.001) return n.toFixed(6);
  if (n < 1) return n.toFixed(4);
  if (n < 10000) return n.toFixed(4);
  if (n < 1e6) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${(n / 1e6).toFixed(2)}M`;
};

const fmtUSD = (val) => {
  if (!val || val === 0) return null;
  if (val < 0.01) return "< $0.01";
  if (val < 1000) return `$${val.toFixed(2)}`;
  if (val < 1e6)
    return `$${val.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${(val / 1e6).toFixed(2)}M`;
};

const fmtPrice = (p) => {
  if (!p) return null;
  if (p < 1e-6) return `$${p.toExponential(2)}`;
  if (p < 0.01) return `$${p.toFixed(6)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  if (p < 1000) return `$${p.toFixed(2)}`;
  return `$${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
};

// ─── Asset Row ────────────────────────────────────────────────────────────────

const AssetRow = ({ item, theme, onPress, onMenuPress, isNative, index }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const menuBtnRef = useRef(null);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay: Math.min(index * 45, 400),
      useNativeDriver: true,
      tension: 65,
      friction: 9,
    }).start();
  }, []);

  const bal = parseFloat(item.balance || "0");
  const hasBal = bal > 0;
  const usdValue = item.price?.usd ? bal * item.price.usd : 0;

  const handleMenuPress = () => {
    menuBtnRef.current?.measureInWindow((x, y, w, h) => {
      onMenuPress(item, { x, y, w, h });
    });
  };

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onPress(item)}
        style={[
          rowSt.card,
          {
            backgroundColor: theme.COLORS.surface,
            borderColor: isNative ? theme.COLORS.primary + "35" : theme.COLORS.border,
          },
          isNative && { borderWidth: 1.5 },
        ]}
      >
        <View style={rowSt.inner}>
          <TokenLogo
            uri={item.logo}
            address={item.address}
            symbol={item.symbol}
            size={36}
            theme={theme}
          />

          <View style={rowSt.info}>
            <View style={rowSt.topLine}>
              <Text style={[rowSt.symbol, { color: theme.COLORS.text }]} numberOfLines={1}>
                {item.symbol}
              </Text>
              {isNative && (
                <View style={[rowSt.nativePill, { backgroundColor: theme.COLORS.primary }]}>
                  <Text style={rowSt.nativePillTxt}>NATIVE</Text>
                </View>
              )}
              <ChangeBadge change={item.price?.usd_24h_change} theme={theme} />
            </View>
            <Text style={[rowSt.name, { color: theme.COLORS.textSecondary }]} numberOfLines={1}>
              {item.name}
            </Text>
          </View>

          {/* Balance column */}
          <View style={rowSt.right}>
            <Text
              style={[
                rowSt.balance,
                { color: hasBal ? theme.COLORS.text : theme.COLORS.textSecondary,
                  fontWeight: hasBal ? "700" : "400" },
              ]}
            >
              {fmtBalance(item.balance)}
            </Text>
            {usdValue > 0 && (
              <Text style={[rowSt.usd, { color: theme.COLORS.primary }]}>
                {fmtUSD(usdValue)}
              </Text>
            )}
          </View>

          {/* 3-dot menu — only for imported (non-native) tokens */}
          {!isNative ? (
            <TouchableOpacity
              ref={menuBtnRef}
              onPress={handleMenuPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={rowSt.menuBtn}
            >
              <Text style={[rowSt.menuDots, { color: theme.COLORS.textSecondary }]}>⋮</Text>
            </TouchableOpacity>
          ) : (
            <View style={rowSt.menuBtn} />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const rowSt = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  nativePill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  nativePillTxt: {
    fontSize: 7,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.6,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  info: { flex: 1, overflow: "hidden" },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  symbol: { fontSize: 13, fontWeight: "700" },
  name: { fontSize: 10 },
  right: { alignItems: "flex-end", minWidth: 58 },
  balance: { fontSize: 12 },
  usd: { fontSize: 9, fontWeight: "700", marginTop: 2 },
  menuBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  menuDots: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "700",
  },
});

// ─── Token options popup ──────────────────────────────────────────────────────

const TokenMenu = ({ activeMenu, onClose, onHide, onDelete, theme }) => {
  if (!activeMenu) return null;

  // Position the card below + right-aligned to the tapped button
  const menuTop = (activeMenu.y ?? 0) + (activeMenu.h ?? 0) + 4;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            menuSt.card,
            {
              top: menuTop,
              right: 16,
              backgroundColor: theme.COLORS.surface,
              borderColor: theme.COLORS.border,
            },
          ]}
        >
          <TouchableOpacity
            style={menuSt.option}
            onPress={() => { onHide(activeMenu.item); onClose(); }}
            activeOpacity={0.7}
          >
            <Text style={[menuSt.optionText, { color: theme.COLORS.text }]}>
              Hide Token
            </Text>
          </TouchableOpacity>

          <View style={[menuSt.sep, { backgroundColor: theme.COLORS.border }]} />

          <TouchableOpacity
            style={menuSt.option}
            onPress={() => { onDelete(activeMenu.item); onClose(); }}
            activeOpacity={0.7}
          >
            <Text style={[menuSt.optionText, { color: theme.COLORS.error }]}>
              Delete
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Pressable>
    </Modal>
  );
};

const menuSt = StyleSheet.create({
  card: {
    position: "absolute",
    width: 148,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 8,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  sep: {
    height: StyleSheet.hairlineWidth,
  },
});

// ─── Portfolio Header Card ────────────────────────────────────────────────────

const PortfolioCard = ({ totalUsd, assetCount, chainName, theme }) => {
  const fmt = (v) => {
    if (v === 0) return "$0.00";
    if (v < 0.01) return "< $0.01";
    if (v < 1e6)
      return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${(v / 1e6).toFixed(3)}M`;
  };
  return (
    <View style={[phSt.card, { backgroundColor: theme.COLORS.surface }]}>
      <View style={{ flex: 1 }}>
        <Text style={phSt.label}>Portfolio Value</Text>
        <Text style={phSt.value}>{fmt(totalUsd)}</Text>
        <Text style={phSt.sub}>
          {assetCount} {assetCount === 1 ? "asset" : "assets"} · {chainName}
        </Text>
      </View>
      <Ionicons name="wallet" size={40} color="rgba(255,255,255,0.2)" />
    </View>
  );
};

const phSt = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  label: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
    fontWeight: "600",
  },
  value: {
    fontSize: 32,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  sub: { fontSize: 11, color: "rgba(255,255,255,0.6)" },
});

// ─── Section Label ────────────────────────────────────────────────────────────

const SectionLabel = ({ label, count, theme }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 6,
      gap: 8,
    }}
  >
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        color: theme.COLORS.textSecondary,
        letterSpacing: 1.1,
        textTransform: "uppercase",
      }}
    >
      {label}
    </Text>
    {count !== undefined && (
      <View
        style={{
          backgroundColor: theme.COLORS.border,
          borderRadius: 8,
          paddingHorizontal: 6,
          paddingVertical: 1,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: theme.COLORS.textSecondary,
          }}
        >
          {count}
        </Text>
      </View>
    )}
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

const TokensScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const { selectedChain, wallet } = useWallet();
  const { user } = useAuth();

  const [nativeAsset, setNativeAsset] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null); // { item, y, h }

  // Sorts tokens: non-zero balance first, then alphabetically
  const sortTokens = useCallback((list) =>
    [...list].sort((a, b) => {
      const aHas = parseFloat(a.balance) > 0;
      const bHas = parseFloat(b.balance) > 0;
      if (aHas !== bHas) return bHas ? 1 : -1;
      return a.symbol.localeCompare(b.symbol);
    }), []);

  // Merge saved token metadata with a balance/price map
  const enrich = useCallback((savedTokens, balPriceMap) =>
    sortTokens(savedTokens.map((t) => ({
      ...t,
      balance: balPriceMap[t.address.toLowerCase()]?.balance ?? "0",
      price:   balPriceMap[t.address.toLowerCase()]?.price   ?? null,
      logo:    t.logo || getBaseToken(t.address)?.logoURI || null,
    }))), [sortTokens]);

  const loadAll = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else           setLoading(true);

      const dbUser = await getUserByUid(user.uid);
      if (!dbUser) throw new Error("User not found");

      const normalizedUserId  = parseInt(dbUser.id);
      const normalizedChainId = parseInt(selectedChain.id);
      const nativeInfo        = getNativeAsset(selectedChain.id);

      // ── 1. Saved token list (SQLite, instant) ────────────────────────────
      let savedTokens = await getTokensByChain(normalizedUserId, normalizedChainId);

      // One-time lazy migration: tokens incorrectly stamped chain_id=8453
      if (!savedTokens?.length && normalizedChainId !== 8453) {
        const db      = getDatabase();
        const orphans = await db.getAllAsync(
          'SELECT COUNT(*) as n FROM tokens WHERE user_id = ? AND chain_id = 8453',
          [normalizedUserId],
        );
        if (orphans?.[0]?.n > 0) {
          await db.runAsync(
            'UPDATE tokens SET chain_id = ? WHERE user_id = ? AND chain_id = 8453',
            [normalizedChainId, normalizedUserId],
          );
          savedTokens = await getTokensByChain(normalizedUserId, normalizedChainId);
        }
      }

      if (!savedTokens?.length) {
        setTokens([]);
        setNativeAsset(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // ── 2. Show cached balances instantly (stale-while-revalidate) ────────
      if (!isRefresh) {
        const { data: cached, stale } = await getTokenBalanceCacheForChain(
          normalizedUserId, normalizedChainId,
        );
        if (Object.keys(cached).length > 0) {
          setTokens(enrich(savedTokens, cached));
          setLoading(false);
          if (!stale) {
            setRefreshing(false);
            // Cache is fresh — still fetch native balance in background quietly
            Promise.allSettled([
              fetchNativePrice(nativeInfo.coingeckoId),
              wallet?.address && selectedChain.rpcUrl
                ? fetchNativeBalance(wallet.address, selectedChain.rpcUrl)
                : Promise.resolve(null),
            ]).then(([priceRes, balRes]) => {
              setNativeAsset({
                ...nativeInfo,
                id: "__native__", address: "__native__",
                balance: (balRes.status === "fulfilled" ? balRes.value : null) || "0",
                price:   priceRes.status === "fulfilled" ? priceRes.value : null,
              });
            });
            return;
          }
        }
      }

      // ── 3. Native price + balance (parallel with token fetch) ────────────
      const platform = coinGeckoService.getPlatformId(selectedChain.id);

      const [nativePriceRes, nativeBalRes, balRes, priceRes] =
        await Promise.allSettled([
          fetchNativePrice(nativeInfo.coingeckoId),
          wallet?.address && selectedChain.rpcUrl
            ? fetchNativeBalance(wallet.address, selectedChain.rpcUrl)
            : Promise.resolve(null),
          // ── 4. Token balances — 1 RPC call per token (uses stored decimals)
          Promise.all(
            savedTokens.map(async (t) => {
              if (!wallet?.address) return [t.address.toLowerCase(), "0"];
              try {
                const b = await getTokenBalanceFast(
                  t.address, wallet.address, selectedChain, t.decimals,
                );
                return [t.address.toLowerCase(), b?.formatted || "0"];
              } catch {
                return [t.address.toLowerCase(), "0"];
              }
            }),
          ),
          // ── 5. Prices (one CoinGecko call for all tokens)
          coinGeckoService.getMultipleTokenPrices(
            savedTokens.map((t) => t.address),
            platform,
          ),
        ]);

      setNativeAsset({
        ...nativeInfo,
        id: "__native__", address: "__native__",
        balance: (nativeBalRes.status === "fulfilled" ? nativeBalRes.value : null) || "0",
        price:   nativePriceRes.status === "fulfilled" ? nativePriceRes.value : null,
      });

      const balMap   = balRes.status   === "fulfilled" ? Object.fromEntries(balRes.value) : {};
      const priceMap = priceRes.status === "fulfilled" ? priceRes.value || {}              : {};

      const balPriceMap = Object.fromEntries(
        savedTokens.map((t) => [
          t.address.toLowerCase(),
          {
            balance: balMap[t.address.toLowerCase()]   || "0",
            price:   priceMap[t.address.toLowerCase()] || null,
          },
        ]),
      );

      const enriched = enrich(savedTokens, balPriceMap);
      setTokens(enriched);

      // ── 6. Persist fresh data to balance cache ────────────────────────────
      saveTokenBalanceCache(normalizedUserId, normalizedChainId, enriched).catch(() => {});
    } catch (err) {
      console.error("[TokensScreen] loadAll error:", err);
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedChain, wallet, user, enrich]);

  // Reload whenever this screen is focused — covers both initial mount
  // and navigating back from TokenImportScreen after toggling/importing tokens.
  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const onRefresh = () => {
    coinGeckoService.clearCache();
    loadAll(true);
  };

  const handleTokenPress = (item) => {
    navigation.navigate("TokenDetail", {
      chain: {
        symbol: item.symbol,
        name: item.name,
        logo: item.logo,
        coingeckoId: item.coingeckoId ?? null,
        address: item.address,
      },
      balance: item.balance || "0",
      usdValue: parseFloat(item.balance || "0") * (item.price?.usd ?? 0),
      price: item.price ?? null,
      priceChange24h: item.price?.usd_24h_change ?? null,
      walletAddress: wallet?.address ?? null,
    });
  };

  const handleMenuPress = (item, pos) => {
    setActiveMenu({ item, y: pos.y, h: pos.h });
  };

  const handleHide = async (token) => {
    try {
      await hideToken(token.id);
      setTokens((prev) => prev.filter((t) => t.id !== token.id));
    } catch {
      Alert.alert("Error", "Failed to hide token");
    }
  };

  const handleDelete = (token) => {
    Alert.alert(
      "Delete Token",
      `Remove ${token.symbol} from your list?\n\nYour tokens stay safe in your wallet.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteToken(token.id);
              setTokens((prev) => prev.filter((t) => t.id !== token.id));
            } catch {
              Alert.alert("Error", "Failed to delete token");
            }
          },
        },
      ],
    );
  };

  const totalUsd = (() => {
    let t = 0;
    if (nativeAsset?.price?.usd)
      t += parseFloat(nativeAsset.balance || "0") * nativeAsset.price.usd;
    tokens.forEach((tk) => {
      if (tk.price?.usd) t += parseFloat(tk.balance || "0") * tk.price.usd;
    });
    return t;
  })();

  const listData = [
    ...(nativeAsset ? [{ ...nativeAsset, _type: "native" }] : []),
    ...tokens.map((t) => ({ ...t, _type: "token" })),
  ];

  return (
    <View
      style={[styles.container, { backgroundColor: theme.COLORS.background }]}
    >
      {/* Top bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: theme.COLORS.surface,
            borderBottomColor: theme.COLORS.border,
          },
        ]}
      >
        <Text style={[styles.topBarTitle, { color: theme.COLORS.text }]}>
          Tokens
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {loading && !refreshing && (
            <ActivityIndicator size="small" color={theme.COLORS.primary} />
          )}
          <TouchableOpacity
            style={[
              styles.manageBtn,
              { backgroundColor: theme.COLORS.primaryLight },
            ]}
            onPress={() => navigation.navigate("TokenImport")}
          >
            <Ionicons
              name="settings-outline"
              size={14}
              color={theme.COLORS.primary}
            />
            <Text
              style={[styles.manageBtnTxt, { color: theme.COLORS.primary }]}
            >
              Manage
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && listData.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.COLORS.primary} />
          <Text
            style={[styles.loadingTxt, { color: theme.COLORS.textSecondary }]}
          >
            Loading assets...
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          renderItem={({ item, index }) => (
            <AssetRow
              item={item}
              theme={theme}
              onPress={handleTokenPress}
              onMenuPress={handleMenuPress}
              isNative={item._type === "native"}
              index={index}
            />
          )}
          keyExtractor={(item) => String(item.address || item.id)}
          ListHeaderComponent={
            <View>
              <PortfolioCard
                totalUsd={totalUsd}
                assetCount={listData.length}
                chainName={selectedChain.name}
                theme={theme}
              />
              <SectionLabel
                label="Assets"
                count={listData.length}
                theme={theme}
              />
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyWrap}>
                <Ionicons
                  name="wallet-outline"
                  size={48}
                  color={theme.COLORS.textSecondary}
                />
                <Text style={[styles.emptyTitle, { color: theme.COLORS.text }]}>
                  No tokens yet
                </Text>
                <Text
                  style={[
                    styles.emptySub,
                    { color: theme.COLORS.textSecondary },
                  ]}
                >
                  Add tokens via Manage to track them here
                </Text>
                <TouchableOpacity
                  style={[
                    styles.addBtn,
                    { backgroundColor: theme.COLORS.primary },
                  ]}
                  onPress={() => navigation.navigate("TokenImport")}
                >
                  <Ionicons name="add" size={16} color={theme.COLORS.onPrimary} />
                  <Text style={styles.addBtnTxt}>Manage Tokens</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 36 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Token options popup (hide / delete) */}
      <TokenMenu
        activeMenu={activeMenu}
        onClose={() => setActiveMenu(null)}
        onHide={handleHide}
        onDelete={handleDelete}
        theme={theme}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (theme) =>
  StyleSheet.create({
    container: { flex: 1 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderBottomWidth: 1,
    },
    topBarTitle: { fontSize: 18, fontWeight: "800" },
    manageBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    manageBtnTxt: { fontSize: 13, fontWeight: "700" },
    loadingWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
    },
    loadingTxt: { fontSize: 14 },
    emptyWrap: {
      alignItems: "center",
      paddingVertical: 60,
      paddingHorizontal: 32,
      gap: 8,
    },
    emptyTitle: { fontSize: 17, fontWeight: "800", marginTop: 10 },
    emptySub: { fontSize: 13, textAlign: "center", lineHeight: 18 },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      marginTop: 12,
    },
    addBtnTxt: { color: theme.COLORS.onPrimary, fontWeight: "700", fontSize: 14 },
  });

export default TokensScreen;
