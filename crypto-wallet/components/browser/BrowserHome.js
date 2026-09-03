import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import ChainIcon from "../common/ChainIcon";
import { useTheme } from "../../contexts/ThemeContext";
import { fetchTrendingCoins, getTopGainers } from "../../services/CoinGeckoService";

const dAppSections = {
  NFT: {
    icon: "image-outline",
    items: [
      { name: "OpenSea", url: "https://opensea.io", logo: require("../../assets/opensea.png") },
      { name: "Blur", url: "https://blur.io", logo: require("../../assets/blur.png") },
      { name: "Magic Eden", url: "https://magiceden.io", logo: require("../../assets/magic.png") },
    ],
  },
  DEX: {
    icon: "swap-horizontal-outline",
    items: [
      { name: "SushiSwap", url: "https://sushi.com", logo: require("../../assets/sushi.jpg") },
      { name: "QuickSwap", url: "https://dapp.quickswap.exchange/", logo: require("../../assets/quickswap.png") },
      { name: "PancakeSwap", url: "https://pancakeswap.finance", logo: require("../../assets/pancake.png") },
    ],
  },
  Data: {
    icon: "bar-chart-outline",
    items: [
      { name: "CoinGecko", url: "https://coingecko.com", logo: require("../../assets/gecko.png") },
      { name: "CoinMarketCap", url: "https://coinmarketcap.com", logo: require("../../assets/cmc.png") },
    ],
  },
  Analytics: {
    icon: "analytics-outline",
    items: [
      { name: "GeckoTerminal", url: "https://www.geckoterminal.com", logo: require("../../assets/terminal.png") },
      { name: "DexScreener", url: "https://dexscreener.com/", logo: require("../../assets/dex.png") },
    ],
  },
};

const BrowserHome = ({
  navigation,
  wallet,
  address,
  activeChain,
  inputUrl,
  setInputUrl,
  handleNavigate,
  handleUrlSubmit,
  onChainPress,
  accentColor,
}) => {
  const { COLORS, SPACING, FONTS, BORDER_RADIUS } = useTheme();
  const accent = accentColor || COLORS.primary;
  const [trendingCoins, setTrendingCoins] = useState([]);
  const [topGainers, setTopGainers] = useState([]);
  const [loadingCoins, setLoadingCoins] = useState(true);

  useEffect(() => {
    fetchCryptoData();
  }, []);

  // Both rows now go through the Phase-1 backend CoinGecko proxy (shared
  // 60s server cache) instead of hitting api.coingecko.com directly from the
  // device — same data source HomeScreen's own Trending row uses, so the
  // two never disagree.
  const fetchCryptoData = async () => {
    setLoadingCoins(true);
    try {
      const [trending, gainers] = await Promise.all([
        fetchTrendingCoins(6),
        getTopGainers(5),
      ]);
      setTrendingCoins(trending);
      setTopGainers(gainers);
    } catch (error) {
      console.error("Error fetching crypto data:", error);
    } finally {
      setLoadingCoins(false);
    }
  };

  const styles = createStyles(COLORS, SPACING, FONTS, BORDER_RADIUS, accent);

  // ── Title ──────────────────────────────────────────────────────────────────
  const renderTitle = () => (
    <View style={styles.titleRow}>
      <Text style={styles.title}>Discover</Text>
      <Text style={styles.subtitle}>Explore the onchain economy</Text>
    </View>
  );

  // ── Header bar: search + chain + wallet in one strip ──────────────────────
  const renderHeader = () => (
    <View style={styles.header}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={inputUrl}
          onChangeText={setInputUrl}
          onSubmitEditing={handleUrlSubmit}
          placeholder="Search or enter URL"
          placeholderTextColor={COLORS.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
        />
        {inputUrl ? (
          <TouchableOpacity
            onPress={() => setInputUrl("")}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Chain pill */}
      <TouchableOpacity onPress={onChainPress} style={styles.chainPill}>
        <ChainIcon chain={activeChain} size={20} style={styles.chainIcon} />
        <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Wallet pill */}
      {wallet ? (
        <View style={styles.walletPill}>
          <View style={styles.dot} />
          <Text style={styles.walletPillText}>
            {address?.substring(0, 4)}…{address?.substring(address.length - 3)}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.connectPill}
          onPress={() => navigation.navigate("CreateWallet")}
        >
          <Text style={styles.connectPillText}>Connect</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Quick-access strip ───────────────────────────────────────────────────
  const renderQuickAccess = () => (
    <View style={styles.quickRow}>
      {[
        { label: "Uniswap", url: "https://app.uniswap.org", icon: "swap-horizontal" },
        { label: "Markets", url: "https://coingecko.com", icon: "trending-up" },
        { label: "Trade", url: "https://sushi.com", icon: "repeat" },
        { label: "Explorer", url: activeChain.explorer || "https://basescan.org", icon: "earth" },
      ].map((item, i) => (
        <TouchableOpacity
          key={i}
          style={styles.quickBtn}
          onPress={() => handleNavigate(item.url)}
          activeOpacity={0.75}
        >
          <View style={styles.quickIconCircle}>
            <MaterialCommunityIcons name={item.icon} size={18} color={accent} />
          </View>
          <Text style={styles.quickLabel}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── dApp category card ────────────────────────────────────────────────────
  const renderDAppSection = (section, { icon, items }) => (
    <View key={section} style={styles.sectionBlock}>
      <View style={styles.sectionLabelRow}>
        <Ionicons name={icon} size={14} color={accent} />
        <Text style={styles.sectionLabel}>{section}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hScroll}
        decelerationRate="fast"
        snapToInterval={76}
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={styles.appChip}
            onPress={() => handleNavigate(item.url)}
            activeOpacity={0.75}
          >
            <View style={styles.appChipLogoWrap}>
              <Image source={item.logo} style={styles.appChipLogo} />
            </View>
            <Text style={styles.appChipText} numberOfLines={1}>
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ── Compact coin chip ─────────────────────────────────────────────────────
  const renderCoinChip = (coin) => {
    const isPositive = coin.change24h >= 0;
    return (
      <TouchableOpacity
        key={coin.id}
        style={styles.coinChip}
        activeOpacity={0.75}
        onPress={() => handleNavigate(`https://www.coingecko.com/en/coins/${coin.id}`)}
      >
        <Image source={{ uri: coin.image }} style={styles.coinLogo} />
        <View style={styles.coinInfo}>
          <Text style={styles.coinSymbol}>{coin.symbol.toUpperCase()}</Text>
          {coin.price != null && (
            <Text style={styles.coinPrice}>
              ${coin.price >= 1 ? coin.price.toFixed(2) : coin.price.toFixed(5)}
            </Text>
          )}
        </View>
        {coin.change24h != null && (
          <View style={[styles.changeBadge, isPositive ? styles.posBadge : styles.negBadge]}>
            <Text style={[styles.changeText, { color: isPositive ? accent : COLORS.error }]}>
              {isPositive ? "+" : ""}
              {coin.change24h.toFixed(1)}%
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: COLORS.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {renderTitle()}
      {renderHeader()}
      {renderQuickAccess()}

      <View style={styles.divider} />

      {Object.entries(dAppSections).map(([section, data]) => renderDAppSection(section, data))}

      <View style={styles.divider} />

      {/* Trending */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionLabelRow}>
          <Ionicons name="flame" size={15} color="#f97316" />
          <Text style={styles.sectionLabel}>Trending</Text>
          <TouchableOpacity
            onPress={fetchCryptoData}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{ marginLeft: "auto" }}
          >
            <Ionicons name="refresh" size={15} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        {loadingCoins ? (
          <ActivityIndicator size="small" color={accent} style={{ marginVertical: 8 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {trendingCoins.map((c) => renderCoinChip(c))}
          </ScrollView>
        )}
      </View>

      {/* Top Gainers */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionLabelRow}>
          <Ionicons name="trending-up" size={15} color={accent} />
          <Text style={styles.sectionLabel}>Gainers 24h</Text>
        </View>
        {loadingCoins ? (
          <ActivityIndicator size="small" color={accent} style={{ marginVertical: 8 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {topGainers.map((c) => renderCoinChip(c))}
          </ScrollView>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <MaterialCommunityIcons name="shield-check" size={13} color={COLORS.textTertiary} />
        <Text style={styles.footerText}> Secured · Web3</Text>
      </View>
    </ScrollView>
  );
};

const createStyles = (COLORS, SPACING, FONTS, BORDER_RADIUS, accent) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: { paddingBottom: 24 },

    // ── Title ───────────────────────────────────────────────────────────────
    titleRow: { paddingHorizontal: 16, paddingTop: 12, marginBottom: 12 },
    title: { fontSize: 24, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },

    // ── Header ──────────────────────────────────────────────────────────────
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    searchBar: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: COLORS.card,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 10,
      height: 40,
    },
    searchInput: {
      flex: 1,
      color: COLORS.text,
      fontSize: 13,
      paddingVertical: 0,
    },
    chainPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 9,
      height: 40,
    },
    chainIcon: { width: 20, height: 20, borderRadius: 10 },
    walletPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: accent + "18",
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 9,
      height: 40,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: accent,
    },
    walletPillText: {
      fontSize: 12,
      color: accent,
      fontFamily: "monospace",
      fontWeight: "600",
    },
    connectPill: {
      backgroundColor: accent,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 12,
      height: 40,
      justifyContent: "center",
    },
    connectPillText: {
      fontSize: 13,
      color: "#0a0a0a",
      fontWeight: "700",
    },

    // ── Quick Access ────────────────────────────────────────────────────────
    quickRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      gap: 8,
      marginBottom: 16,
    },
    quickBtn: {
      flex: 1,
      alignItems: "center",
      gap: 6,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: BORDER_RADIUS.lg,
      paddingVertical: 12,
    },
    quickIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: accent + "18",
      alignItems: "center",
      justifyContent: "center",
    },
    quickLabel: { fontSize: 11, color: COLORS.text, fontWeight: "600" },

    // ── Divider ─────────────────────────────────────────────────────────────
    divider: { height: 1, marginHorizontal: 16, marginVertical: 8, backgroundColor: COLORS.border },

    // ── Section block ───────────────────────────────────────────────────────
    sectionBlock: { marginBottom: 8 },
    sectionLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: COLORS.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    hScroll: { paddingHorizontal: 16, gap: 10 },

    // ── App chip ────────────────────────────────────────────────────────────
    appChip: {
      alignItems: "center",
      gap: 6,
      width: 72,
    },
    appChipLogoWrap: {
      width: 52,
      height: 52,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    appChipLogo: { width: 52, height: 52 },
    appChipText: {
      fontSize: 11,
      color: COLORS.text,
      fontWeight: "600",
      textAlign: "center",
    },

    // ── Coin chip ───────────────────────────────────────────────────────────
    coinChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 10,
      paddingVertical: 8,
      minWidth: 150,
    },
    coinLogo: { width: 30, height: 30, borderRadius: 15 },
    coinInfo: { flex: 1 },
    coinSymbol: { fontSize: 13, fontWeight: "700", color: COLORS.text },
    coinPrice: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
    changeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 5,
    },
    posBadge: { backgroundColor: accent + "18" },
    negBadge: { backgroundColor: COLORS.error + "18" },
    changeText: { fontSize: 11, fontWeight: "700" },

    // ── Footer ──────────────────────────────────────────────────────────────
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
    },
    footerText: { fontSize: 11, color: COLORS.textTertiary },
  });

export default BrowserHome;
