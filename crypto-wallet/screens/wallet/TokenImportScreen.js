import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Animated,
  Platform,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useWallet } from "../../contexts/WalletContext";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";

import {
  saveToken,
  getUserByUid,
  deleteToken,
  getDatabase,
} from "../../utils/Database";
import { getTokensByChain } from "../../utils/TokenDatabase";
import { validateAddress } from "../../utils/Validators";
import coinGeckoService from "../../services/coingec";
import Alert from "../../utils/Alert";
import { getTokenBalance, getTokenDetails } from "../../utils/blockchain";
import tokenApiService from "../../services/api/TokenApi";
import { getTokenListForChain } from "../../utils/token/TokenListUtil";

// ─── Multi-source logo fallback ───────────────────────────────────────────────
// Mirrors the same logic used in TokenSelectorModal for consistent icon display.
const NATIVE_SENTINEL = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

// SVG URLs fail silently in React Native Image — we immediately queue a PNG
// variant as src[1]. TrustWallet path uses `base` not `ethereum`. The old
// `coingecko/small/{address}` URL was invalid and has been removed.
const buildLogoSources = (logoURI, address, symbol) => {
  const sources = [];

  if (logoURI) {
    sources.push(logoURI);
    if (logoURI.endsWith(".svg")) {
      sources.push(logoURI.replace(".svg", ".png"));
    }
  }

  if (address && address.toLowerCase() !== NATIVE_SENTINEL) {
    const addrLower = address.toLowerCase();
    sources.push(`https://tokens.1inch.io/${addrLower}.png`);
    sources.push(
      `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${address}/logo.png`,
    );
    if (symbol) {
      sources.push(
        `https://ethereum-optimism.github.io/data/${symbol}/logo.png`,
      );
    }
  }

  return sources;
};

// ─── Token Logo with multi-source fallback ────────────────────────────────────
const TokenLogo = ({
  uri,
  address,
  symbol,
  size = 44,
  enabled = true,
  theme,
}) => {
  const sources = useMemo(
    () => buildLogoSources(uri, address, symbol),
    [uri, address, symbol],
  );
  const [srcIndex, setSrcIndex] = useState(0);

  // Reset index whenever the token changes
  useEffect(() => {
    setSrcIndex(0);
  }, [uri, address]);

  const currentSrc = sources[srcIndex];

  if (currentSrc) {
    return (
      <Image
        source={{ uri: currentSrc }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => {
          if (__DEV__)
            console.log(
              `[TokenLogo] ${symbol} src[${srcIndex}] failed: ${currentSrc}`,
            );
          setSrcIndex((i) => i + 1);
        }}
        fadeDuration={150}
      />
    );
  }

  // All sources exhausted — deterministic color avatar
  const colors = [
    "#6366f1",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#ef4444",
    "#8b5cf6",
    "#f97316",
  ];
  const idx = (symbol?.charCodeAt(0) || 0) % colors.length;
  const bg = enabled ? colors[idx] : theme.COLORS.border;

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

// ─── Animated Toggle ──────────────────────────────────────────────────────────
const ToggleSwitch = ({ value, onToggle, disabled, theme }) => {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      bounciness: 6,
      speed: 14,
    }).start();
  }, [value]);

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.COLORS.border, theme.COLORS.primary],
  });

  const thumbLeft = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onToggle}
      activeOpacity={0.85}
      style={{ opacity: disabled ? 0.35 : 1 }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View style={[toggleSt.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[toggleSt.thumb, { left: thumbLeft }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const toggleSt = StyleSheet.create({
  track: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
  },
  thumb: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
});

// ─── API Token Row ────────────────────────────────────────────────────────────
const ApiTokenRow = memo(
  ({ item, isEnabled, isToggling, onToggle, theme, index }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        delay: Math.min(index * 25, 400),
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        }}
      >
        <View
          style={[
            rowSt.container,
            {
              backgroundColor: isEnabled
                ? theme.COLORS.surface
                : theme.COLORS.background,
              borderColor: isEnabled
                ? theme.COLORS.primary + "40"
                : theme.COLORS.border,
            },
          ]}
        >
          <View style={rowSt.iconWrap}>
            <TokenLogo
              uri={item.logoURI || item.logo}
              address={item.address}
              symbol={item.symbol}
              size={36}
              enabled={isEnabled}
              theme={theme}
            />
          </View>

          <View style={rowSt.info}>
            <View style={rowSt.nameRow}>
              <Text
                style={[rowSt.symbol, { color: theme.COLORS.text }]}
                numberOfLines={1}
              >
                {item.symbol}
              </Text>
              {isEnabled && (
                <View
                  style={[
                    rowSt.activePill,
                    { backgroundColor: theme.COLORS.primary + "18" },
                  ]}
                >
                  <Text
                    style={[
                      rowSt.activePillText,
                      { color: theme.COLORS.primary },
                    ]}
                  >
                    Active
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[rowSt.name, { color: theme.COLORS.textSecondary }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text
              style={[rowSt.address, { color: theme.COLORS.textSecondary }]}
              numberOfLines={1}
            >
              {item.address
                ? `${item.address.substring(0, 8)}...${item.address.substring(item.address.length - 6)}`
                : ""}
            </Text>
          </View>

          <View style={rowSt.right}>
            {item.decimals !== undefined && (
              <Text
                style={[rowSt.decimals, { color: theme.COLORS.textSecondary }]}
              >
                {item.decimals}d
              </Text>
            )}
            {isToggling ? (
              <ActivityIndicator
                size="small"
                color={theme.COLORS.primary}
                style={{ width: 46 }}
              />
            ) : (
              <ToggleSwitch
                value={isEnabled}
                onToggle={onToggle}
                theme={theme}
              />
            )}
          </View>
        </View>
      </Animated.View>
    );
  },
);

const rowSt = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
  },
  info: { flex: 1, overflow: "hidden" },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 1,
  },
  symbol: { fontSize: 13, fontWeight: "700" },
  name: { fontSize: 11, marginBottom: 1 },
  address: {
    fontSize: 9,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  activePill: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  activePillText: { fontSize: 9, fontWeight: "700" },
  right: { alignItems: "flex-end", gap: 3, flexShrink: 0 },
  decimals: { fontSize: 9, fontWeight: "600" },
});

// ─── Section Label ────────────────────────────────────────────────────────────
const SectionLabel = ({ label, count, theme }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
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

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
const TabBar = ({ activeTab, onTabChange, theme }) => {
  const tabs = [
    { key: "list", label: "Token List", icon: "list-outline" },
    { key: "custom", label: "Custom Import", icon: "code-working-outline" },
  ];

  return (
    <View
      style={[
        tabSt.container,
        {
          backgroundColor: theme.COLORS.surface,
          borderColor: theme.COLORS.border,
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              tabSt.tab,
              isActive && {
                backgroundColor: theme.COLORS.primary,
              },
            ]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={tab.icon}
              size={15}
              color={isActive ? "#fff" : theme.COLORS.textSecondary}
            />
            <Text
              style={[
                tabSt.label,
                {
                  color: isActive ? "#fff" : theme.COLORS.textSecondary,
                  fontWeight: isActive ? "700" : "500",
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const tabSt = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  label: { fontSize: 13 },
});

// ─── Custom Import Panel ──────────────────────────────────────────────────────
const CustomImportPanel = ({
  theme,
  selectedChain,
  wallet,
  onRefreshList,
  navigation,
  user,
}) => {
  const styles = createCustomStyles(theme);

  const [customAddress, setCustomAddress] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customFetchingPrice, setCustomFetchingPrice] = useState(false);
  const [customTokenInfo, setCustomTokenInfo] = useState(null);
  const [customBalance, setCustomBalance] = useState(null);
  const [customPriceData, setCustomPriceData] = useState(null);
  const [customLogoUrl, setCustomLogoUrl] = useState(null);
  const [customError, setCustomError] = useState("");

  const handleFetchCustomToken = async () => {
    setCustomError("");
    setCustomTokenInfo(null);
    setCustomBalance(null);
    setCustomPriceData(null);
    setCustomLogoUrl(null);

    const addressValidation = validateAddress(customAddress);
    if (!addressValidation.isValid) {
      setCustomError("Invalid token contract address");
      return;
    }

    try {
      setCustomLoading(true);

      const details = await getTokenDetails(customAddress, selectedChain);
      setCustomTokenInfo(details);

      if (wallet?.address) {
        const tokenBalance = await getTokenBalance(
          customAddress,
          wallet.address,
          selectedChain,
        );
        setCustomBalance(tokenBalance);
      }

      setCustomFetchingPrice(true);
      try {
        const platform = coinGeckoService.getPlatformId(selectedChain.id);
        const [price, logo] = await Promise.allSettled([
          coinGeckoService.getTokenPrice(customAddress, platform),
          coinGeckoService.getTokenLogo(customAddress, platform),
        ]);
        if (price.status === "fulfilled" && price.value)
          setCustomPriceData(price.value);
        if (logo.status === "fulfilled" && logo.value)
          setCustomLogoUrl(logo.value);
      } catch (e) {
        console.warn("[TokenImport] CoinGecko fetch failed:", e.message);
      }
      setCustomFetchingPrice(false);
    } catch (err) {
      setCustomError(
        "Failed to fetch token. Please verify the address and network.",
      );
      setCustomFetchingPrice(false);
    } finally {
      setCustomLoading(false);
    }
  };

  const handleImportCustomToken = async () => {
    if (!customTokenInfo) return;

    try {
      setCustomLoading(true);

      const dbUser = await getUserByUid(user.uid);
      if (!dbUser) throw new Error("User not found");

      const normalizedUserId = parseInt(dbUser.id);
      const normalizedChainId = parseInt(selectedChain.id);

      const tokenData = {
        address: customTokenInfo.address.toLowerCase(),
        name: customTokenInfo.name,
        symbol: customTokenInfo.symbol,
        decimals: customTokenInfo.decimals,
        logo: customLogoUrl,
      };

      const existing = await getTokensByChain(
        normalizedUserId,
        normalizedChainId,
      );
      const alreadyExists = existing.some(
        (t) => t.address.toLowerCase() === tokenData.address,
      );

      if (alreadyExists) {
        Alert.alert(
          "Already Added",
          `${customTokenInfo.symbol} is already in your wallet`,
          [{ text: "OK", onPress: () => navigation.goBack() }],
        );
        return;
      }

      await saveToken(normalizedUserId, normalizedChainId, tokenData);

      await onRefreshList();

      Alert.alert(
        "Success! 🎉",
        `${customTokenInfo.symbol} has been added to your wallet`,
        [{ text: "View Tokens", onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      if (err.message?.includes("UNIQUE constraint failed")) {
        Alert.alert(
          "Already Added",
          `${customTokenInfo.symbol} is already in your wallet`,
          [{ text: "OK", onPress: () => navigation.goBack() }],
        );
      } else {
        Alert.alert("Error", `Failed to import token: ${err.message}`);
      }
    } finally {
      setCustomLoading(false);
    }
  };

  const formatBalance = (bal) => {
    if (!bal) return "0";
    const n = parseFloat(bal.formatted);
    if (n === 0) return "0";
    if (n < 0.0001) return "< 0.0001";
    return n.toFixed(6);
  };

  const formatUSD = (value) => {
    if (!value || value === 0) return "$0.00";
    if (value < 0.01) return "< $0.01";
    return `$${value.toFixed(2)}`;
  };

  return (
    <View style={styles.panel}>
      {/* Network badge — Base only */}
      <View
        style={[
          styles.networkBadge,
          { backgroundColor: theme.COLORS.surface, borderColor: theme.COLORS.border },
        ]}
      >
        <Image
          source={{ uri: selectedChain.icon }}
          style={styles.networkIcon}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.networkLabel, { color: theme.COLORS.textSecondary }]}>
            Network
          </Text>
          <Text style={[styles.networkName, { color: theme.COLORS.text }]}>
            {selectedChain.name}
          </Text>
        </View>
        <View style={[styles.basePill, { backgroundColor: theme.COLORS.primary + "18" }]}>
          <Ionicons name="checkmark-circle" size={13} color={theme.COLORS.primary} />
          <Text style={[styles.basePillText, { color: theme.COLORS.primary }]}>Active</Text>
        </View>
      </View>

      {/* Address input */}
      <Input
        label="Contract Address"
        value={customAddress}
        onChangeText={setCustomAddress}
        placeholder="0x..."
        error={customError}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Button
        title={customLoading ? "Fetching..." : "Look Up Token"}
        onPress={handleFetchCustomToken}
        loading={customLoading}
        disabled={!customAddress || customLoading}
        fullWidth
      />

      {/* Fetched token preview */}
      {customTokenInfo && (
        <View
          style={[
            styles.tokenPreview,
            {
              borderColor: theme.COLORS.border,
              backgroundColor: theme.COLORS.surface,
            },
          ]}
        >
          <View style={styles.previewHeader}>
            {/* Logo with multi-source fallback */}
            <View style={styles.previewLogoWrap}>
              <TokenLogo
                uri={customLogoUrl}
                address={customTokenInfo.address}
                symbol={customTokenInfo.symbol}
                size={48}
                enabled
                theme={theme}
              />
            </View>
            <View style={styles.previewInfo}>
              <Text style={[styles.previewName, { color: theme.COLORS.text }]}>
                {customTokenInfo.name}
              </Text>
              <Text
                style={[
                  styles.previewSymbol,
                  { color: theme.COLORS.textSecondary },
                ]}
              >
                {customTokenInfo.symbol}
              </Text>
            </View>
            {!customLoading && (
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={theme.COLORS.success}
              />
            )}
          </View>

          {customFetchingPrice ? (
            <View style={styles.priceLoading}>
              <ActivityIndicator size="small" color={theme.COLORS.primary} />
              <Text
                style={[
                  styles.priceLoadingText,
                  { color: theme.COLORS.textSecondary },
                ]}
              >
                Fetching price...
              </Text>
            </View>
          ) : (
            <>
              {customPriceData && (
                <View
                  style={[
                    styles.priceRow,
                    { backgroundColor: theme.COLORS.background },
                  ]}
                >
                  <Text
                    style={[
                      styles.priceLabel,
                      { color: theme.COLORS.textSecondary },
                    ]}
                  >
                    Price
                  </Text>
                  <View style={styles.priceRight}>
                    <Text
                      style={[styles.priceValue, { color: theme.COLORS.text }]}
                    >
                      ${customPriceData.usd.toFixed(6)}
                    </Text>
                    {customPriceData.usd_24h_change !== undefined && (
                      <Text
                        style={[
                          styles.priceChange,
                          {
                            color:
                              customPriceData.usd_24h_change >= 0
                                ? theme.COLORS.success
                                : theme.COLORS.error,
                          },
                        ]}
                      >
                        {customPriceData.usd_24h_change >= 0 ? "+" : ""}
                        {customPriceData.usd_24h_change.toFixed(2)}%
                      </Text>
                    )}
                  </View>
                </View>
              )}
              {customBalance && (
                <View
                  style={[
                    styles.priceRow,
                    { backgroundColor: theme.COLORS.primaryLight },
                  ]}
                >
                  <Text
                    style={[styles.priceLabel, { color: theme.COLORS.primary }]}
                  >
                    Balance
                  </Text>
                  <View style={styles.priceRight}>
                    <Text
                      style={[
                        styles.priceValue,
                        { color: theme.COLORS.primary },
                      ]}
                    >
                      {formatBalance(customBalance)} {customTokenInfo.symbol}
                    </Text>
                    {customPriceData && (
                      <Text
                        style={[
                          styles.priceChange,
                          { color: theme.COLORS.primary },
                        ]}
                      >
                        {formatUSD(
                          parseFloat(customBalance.formatted) *
                            customPriceData.usd,
                        )}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Details grid */}
          <View style={styles.detailsGrid}>
            {[
              ["Decimals", String(customTokenInfo.decimals)],
              ["Network", selectedChain.name],
              ["Address", `${customTokenInfo.address.substring(0, 10)}...`],
            ].map(([k, v]) => (
              <View key={k} style={styles.detailItem}>
                <Text
                  style={[
                    styles.detailKey,
                    { color: theme.COLORS.textSecondary },
                  ]}
                >
                  {k}
                </Text>
                <Text style={[styles.detailVal, { color: theme.COLORS.text }]}>
                  {v}
                </Text>
              </View>
            ))}
          </View>

          <Button
            title={`Import ${customTokenInfo.symbol}`}
            onPress={handleImportCustomToken}
            loading={customLoading}
            fullWidth
          />
        </View>
      )}

      {/* Security notice */}
      <View
        style={[
          styles.notice,
          {
            borderLeftColor: theme.COLORS.warning,
            backgroundColor: theme.COLORS.surface,
          },
        ]}
      >
        <Ionicons
          name="shield-checkmark-outline"
          size={14}
          color={theme.COLORS.warning}
          style={{ marginTop: 1 }}
        />
        <Text style={[styles.noticeText, { color: theme.COLORS.warning }]}>
          Only import tokens from trusted sources. Scam tokens can mimic
          legitimate names.
        </Text>
      </View>

    </View>
  );
};

const createCustomStyles = (theme) =>
  StyleSheet.create({
    panel: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 40,
      gap: 12,
    },
    networkBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
    },
    networkIcon: { width: 28, height: 28, borderRadius: 14 },
    networkLabel: { fontSize: 10, fontWeight: "600", marginBottom: 1 },
    networkName: { fontSize: 13, fontWeight: "700" },
    basePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    basePillText: { fontSize: 11, fontWeight: "700" },
    tokenPreview: {
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      gap: 10,
    },
    previewHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    previewLogoWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: "hidden",
    },
    previewInfo: { flex: 1 },
    previewName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
    previewSymbol: { fontSize: 12, fontWeight: "600" },
    priceLoading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
    },
    priceLoadingText: { fontSize: 12 },
    priceRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 10,
      borderRadius: 10,
    },
    priceLabel: { fontSize: 12, fontWeight: "600" },
    priceRight: { alignItems: "flex-end" },
    priceValue: { fontSize: 13, fontWeight: "700" },
    priceChange: { fontSize: 11, fontWeight: "600", marginTop: 1 },
    detailsGrid: { gap: 4 },
    detailItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 4,
    },
    detailKey: { fontSize: 12 },
    detailVal: { fontSize: 12, fontWeight: "600" },
    notice: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      borderLeftWidth: 3,
      paddingLeft: 10,
      paddingVertical: 8,
      paddingRight: 8,
      borderRadius: 4,
    },
    noticeText: { fontSize: 11, flex: 1, lineHeight: 16 },
  });

// ─── Token List Panel ─────────────────────────────────────────────────────────
const TokenListPanel = ({
  theme,
  apiTokens,
  enabledAddresses,
  togglingAddresses,
  loadingList,
  refreshing,
  listError,
  searchQuery,
  setSearchQuery,
  filteredTokens,
  enabledCount,
  onRefresh,
  onRetry,
  onToggle,
}) => {
  const renderItem = useCallback(
    ({ item, index }) => {
      const addr = item.address?.toLowerCase();
      const isEnabled = enabledAddresses.has(addr);
      const isToggling = togglingAddresses.has(addr);

      return (
        <ApiTokenRow
          item={item}
          isEnabled={isEnabled}
          isToggling={isToggling}
          onToggle={() => onToggle(item)}
          theme={theme}
          index={index}
        />
      );
    },
    [enabledAddresses, togglingAddresses, onToggle, theme],
  );

  const ListHeaderComponent = useMemo(
    () => (
      <View>
        {/* Summary strip */}
        {/* <View
          style={[
            listSt.summaryStrip,
            { backgroundColor: theme.COLORS.surface },
          ]}
        >
          <View style={listSt.summaryItem}>
            <Text style={listSt.summaryNum}>{enabledCount}</Text>
            <Text style={listSt.summaryLbl}>Active</Text>
          </View>
          <View style={listSt.summaryDivider} />
          <View style={listSt.summaryItem}>
            <Text style={listSt.summaryNum}>{apiTokens.length}</Text>
            <Text style={listSt.summaryLbl}>Available</Text>
          </View>
          <View style={listSt.summaryDivider} />
          <View style={listSt.summaryItem}>
            <Text style={listSt.summaryNum} numberOfLines={1}>Base</Text>
            <Text style={listSt.summaryLbl}>Network</Text>
          </View>
        </View> */}

        {/* Search bar */}
        <View
          style={[
            listSt.searchBar,
            {
              backgroundColor: theme.COLORS.surface,
              borderColor: theme.COLORS.border,
            },
          ]}
        >
          <Ionicons
            name="search"
            size={15}
            color={theme.COLORS.textSecondary}
          />
          <TextInput
            style={[listSt.searchInput, { color: theme.COLORS.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Search ${apiTokens.length} tokens...`}
            placeholderTextColor={theme.COLORS.textSecondary}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={15}
                color={theme.COLORS.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        <SectionLabel
          label={searchQuery ? "Search Results" : "Base Tokens"}
          count={filteredTokens.length}
          theme={theme}
        />
      </View>
    ),
    [enabledCount, apiTokens.length, searchQuery, filteredTokens.length, theme],
  );

  const ListEmptyComponent = !loadingList ? (
    <View style={listSt.emptyWrap}>
      {listError ? (
        <>
          <Ionicons
            name="cloud-offline-outline"
            size={40}
            color={theme.COLORS.textSecondary}
          />
          <Text style={[listSt.emptyTitle, { color: theme.COLORS.text }]}>
            Couldn't load tokens
          </Text>
          <Text
            style={[listSt.emptyText, { color: theme.COLORS.textSecondary }]}
          >
            {listError}
          </Text>
          <TouchableOpacity
            style={[listSt.retryBtn, { backgroundColor: theme.COLORS.primary }]}
            onPress={onRetry}
          >
            <Text style={listSt.retryText}>Retry</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Ionicons
            name="search-outline"
            size={40}
            color={theme.COLORS.textSecondary}
          />
          <Text style={[listSt.emptyTitle, { color: theme.COLORS.text }]}>
            No tokens found
          </Text>
          <Text
            style={[listSt.emptyText, { color: theme.COLORS.textSecondary }]}
          >
            {searchQuery
              ? "Try a different search term"
              : "No Base tokens available"}
          </Text>
        </>
      )}
    </View>
  ) : null;

  if (loadingList && apiTokens.length === 0) {
    return (
      <View style={listSt.loadingOverlay}>
        <ActivityIndicator size="large" color={theme.COLORS.primary} />
        <Text
          style={[listSt.loadingText, { color: theme.COLORS.textSecondary }]}
        >
          Loading Base tokens...
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredTokens}
      renderItem={renderItem}
      keyExtractor={(item) =>
        item.address || item.id?.toString() || item.symbol
      }
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.COLORS.primary}
        />
      }
      contentContainerStyle={listSt.listContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={20}
      maxToRenderPerBatch={15}
      windowSize={10}
    />
  );
};

const listSt = StyleSheet.create({
  summaryStrip: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryNum: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  summaryLbl: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
    fontWeight: "600",
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  listContent: { paddingBottom: 40 },
  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14 },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 8,
  },
  retryText: { color: "#fff", fontWeight: "700" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
const TokenImportScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { selectedChain, wallet } = useWallet();
  const { user } = useAuth();

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState("list");

  // ── Token list state ──
  const [apiTokens, setApiTokens] = useState([]);
  const [enabledAddresses, setEnabledAddresses] = useState(new Set());
  const [togglingAddresses, setTogglingAddresses] = useState(new Set());
  const [loadingList, setLoadingList] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [listError, setListError] = useState(null);

  // ── Load token list ──────────────────────────────────────────────────────────
  const loadTokenList = useCallback(async () => {
    try {
      setListError(null);
      setLoadingList(true);

      const dbUser = await getUserByUid(user.uid);
      if (!dbUser) throw new Error("User not found");

      const normalizedUserId = parseInt(dbUser.id);
      const normalizedChainId = parseInt(selectedChain?.id || 8453);

      const [apiResult, savedResult] = await Promise.allSettled([
        tokenApiService.getTokensByChain(normalizedChainId),
        getTokensByChain(normalizedUserId, normalizedChainId),
      ]);

      let saved =
        savedResult.status === "fulfilled" ? savedResult.value || [] : [];

      // Lazy migration: if nothing found for the current chain but tokens exist
      // under the old hardcoded chainId 8453, migrate them over.
      if (!saved.length && normalizedChainId !== 8453) {
        const db = getDatabase();
        const orphans = await db.getAllAsync(
          'SELECT COUNT(*) as n FROM tokens WHERE user_id = ? AND chain_id = 8453',
          [normalizedUserId],
        );
        if (orphans?.[0]?.n > 0) {
          console.log('[TokenImport] Migrating tokens from chain 8453 →', normalizedChainId);
          await db.runAsync(
            'UPDATE tokens SET chain_id = ? WHERE user_id = ? AND chain_id = 8453',
            [normalizedChainId, normalizedUserId],
          );
          saved = await getTokensByChain(normalizedUserId, normalizedChainId);
        }
      }

      let fetched =
        apiResult.status === "fulfilled" ? apiResult.value || [] : [];

      // API is the source of truth. Local list is a fallback only if the API
      // returns nothing (offline / backend down).
      if (!fetched.length) {
        fetched = getTokenListForChain(normalizedChainId).map((t) => ({
          ...t,
          logo: t.logoURI,
        }));
        if (apiResult.status === "rejected") {
          console.warn(
            "[TokenImport] API failed, using local list:",
            apiResult.reason?.message,
          );
        }
      }

      // Deduplicate by lowercase address — prevents React key collision errors
      // if the API or local list ever contains the same token twice.
      const seen = new Set();
      const deduped = fetched.filter((t) => {
        const key = t.address?.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const enabledSet = new Set(saved.map((t) => t.address.toLowerCase()));
      setEnabledAddresses(enabledSet);
      setApiTokens(deduped);
    } catch (err) {
      console.error("[TokenImport] loadTokenList error:", err);
      setListError(err.message);
    } finally {
      setLoadingList(false);
    }
  }, [user, selectedChain]);

  useEffect(() => {
    loadTokenList();
  }, [loadTokenList]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTokenList();
    setRefreshing(false);
  };

  // ── Toggle handler ───────────────────────────────────────────────────────────
  const handleToggle = useCallback(
    async (token) => {
      const addr = token.address.toLowerCase();
      const isCurrentlyEnabled = enabledAddresses.has(addr);

      setTogglingAddresses((prev) => new Set([...prev, addr]));

      // Optimistic update
      setEnabledAddresses((prev) => {
        const next = new Set(prev);
        isCurrentlyEnabled ? next.delete(addr) : next.add(addr);
        return next;
      });

      try {
        const dbUser = await getUserByUid(user.uid);
        if (!dbUser) throw new Error("User not found");

        const normalizedUserId = parseInt(dbUser.id);
        const normalizedChainId = parseInt(selectedChain?.id || 8453);

        if (isCurrentlyEnabled) {
          const saved = await getTokensByChain(
            normalizedUserId,
            normalizedChainId,
          );
          const match = saved.find((t) => t.address.toLowerCase() === addr);
          if (match) await deleteToken(match.id);
        } else {
          const existing = await getTokensByChain(
            normalizedUserId,
            normalizedChainId,
          );
          const alreadyExists = existing.some(
            (t) => t.address.toLowerCase() === addr,
          );

          if (!alreadyExists) {
            const tokenData = {
              address: addr,
              name: token.name,
              symbol: token.symbol,
              decimals: token.decimals ?? 18,
              logo: token.logoURI || token.logo || null,
            };
            await saveToken(normalizedUserId, normalizedChainId, tokenData);
          }
        }
      } catch (err) {
        console.error("[TokenImport] Toggle error:", err.message);
        if (!err.message?.includes("UNIQUE constraint")) {
          // Revert optimistic update on error
          setEnabledAddresses((prev) => {
            const next = new Set(prev);
            isCurrentlyEnabled ? next.add(addr) : next.delete(addr);
            return next;
          });
          Alert.alert("Error", `Failed to update token: ${err.message}`);
        }
      } finally {
        setTogglingAddresses((prev) => {
          const next = new Set(prev);
          next.delete(addr);
          return next;
        });
      }
    },
    [enabledAddresses, user, selectedChain],
  );

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filteredTokens = useMemo(
    () =>
      searchQuery.trim()
        ? apiTokens.filter(
            (t) =>
              t.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              t.address?.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : apiTokens,
    [apiTokens, searchQuery],
  );

  const enabledCount = enabledAddresses.size;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View
      style={[styles.container, { backgroundColor: theme.COLORS.background }]}
    >
      {/* Top bar */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: theme.COLORS.surface,
            borderBottomColor: theme.COLORS.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.COLORS.text }]}>
          Manage Tokens
        </Text>
        <TouchableOpacity
          onPress={onRefresh}
          disabled={refreshing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="refresh"
            size={20}
            color={refreshing ? theme.COLORS.border : theme.COLORS.text}
          />
        </TouchableOpacity>
      </View>

      {/* Tab bar — always visible at the top, no scrolling needed */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} theme={theme} />

      {/* Content */}
      {activeTab === "list" ? (
        <TokenListPanel
          theme={theme}
          apiTokens={apiTokens}
          enabledAddresses={enabledAddresses}
          togglingAddresses={togglingAddresses}
          loadingList={loadingList}
          refreshing={refreshing}
          listError={listError}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredTokens={filteredTokens}
          enabledCount={enabledCount}
          onRefresh={onRefresh}
          onRetry={loadTokenList}
          onToggle={handleToggle}
        />
      ) : (
        <CustomImportPanel
          theme={theme}
          selectedChain={selectedChain}
          wallet={wallet}
          onRefreshList={loadTokenList}
          navigation={navigation}
          user={user}
        />
      )}
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
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    topBarTitle: { fontSize: 17, fontWeight: "700" },
  });

export default TokenImportScreen;
