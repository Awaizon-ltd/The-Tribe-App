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
}) => {
  const { COLORS, SPACING, FONTS, BORDER_RADIUS } = useTheme();
  const [trendingCoins, setTrendingCoins] = useState([]);
  const [topGainers, setTopGainers] = useState([]);
  const [loadingCoins, setLoadingCoins] = useState(true);

  const dAppSections = {
    "🎨 NFT": [
      {
        name: "OpenSea",
        url: "https://opensea.io",
        logo: require("../../assets/opensea.png"),
      },
      {
        name: "Blur",
        url: "https://blur.io",
        logo: require("../../assets/blur.png"),
      },
      {
        name: "Magic Eden",
        url: "https://magiceden.io",
        logo: require("../../assets/magic.png"),
      },
    ],
    "🔄 DEX": [
      {
        name: "SushiSwap",
        url: "https://sushi.com",
        logo: require("../../assets/sushi.jpg"),
      },
      {
        name: "QuickSwap",
        url: "https://dapp.quickswap.exchange/",
        logo: require("../../assets/quickswap.png"),
      },
      {
        name: "PancakeSwap",
        url: "https://pancakeswap.finance",
        logo: require("../../assets/pancake.png"),
      },
    ],
    "📊 Data": [
      {
        name: "CoinGecko",
        url: "https://coingecko.com",
        logo: require("../../assets/gecko.png"),
      },
      {
        name: "CoinMarketCap",
        url: "https://coinmarketcap.com",
        logo: require("../../assets/cmc.png"),
      },
    ],
    "📈 Analytics": [
      {
        name: "GeckoTerminal",
        url: "https://www.geckoterminal.com",
        logo: require("../../assets/terminal.png"),
      },
      {
        name: "DexScreener",
        url: "https://dexscreener.com/",
        logo: require("../../assets/dex.png"),
      },
    ],
  };

  useEffect(() => {
    fetchCryptoData();
  }, []);

  const fetchCryptoData = async () => {
    setLoadingCoins(true);
    try {
      const trendingResponse = await fetch(
        "https://api.coingecko.com/api/v3/search/trending",
      );
      const trendingData = await trendingResponse.json();
      setTrendingCoins(trendingData.coins.slice(0, 5));

      const gainersResponse = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h",
      );
      const gainersData = await gainersResponse.json();

      const sortedGainers = gainersData
        .filter((coin) => coin.price_change_percentage_24h > 0)
        .sort(
          (a, b) =>
            b.price_change_percentage_24h - a.price_change_percentage_24h,
        )
        .slice(0, 5);

      setTopGainers(sortedGainers);
    } catch (error) {
      console.error("Error fetching crypto data:", error);
    } finally {
      setLoadingCoins(false);
    }
  };

  const styles = createStyles(COLORS, SPACING, FONTS, BORDER_RADIUS);

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
          placeholder="Search or URL…"
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
            <Ionicons
              name="close-circle"
              size={16}
              color={COLORS.textTertiary}
            />
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

  // ── Compact dApp row ──────────────────────────────────────────────────────
  const renderDAppSection = (section, dApps) => (
    <View key={section} style={styles.sectionRow}>
      <Text style={styles.sectionLabel}>{section}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hScroll}
        decelerationRate="fast"
        snapToInterval={72}
      >
        {dApps.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={styles.appChip}
            onPress={() => handleNavigate(item.url)}
            activeOpacity={0.75}
          >
            <Image source={item.logo} style={styles.appChipLogo} />
            <Text style={styles.appChipText} numberOfLines={1}>
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ── Compact coin chip ─────────────────────────────────────────────────────
  const renderCoinChip = (coin, index, isTrending = false) => {
    const coinData = isTrending ? coin.item : coin;
    const priceChange = isTrending
      ? coinData.data?.price_change_percentage_24h?.usd
      : coinData.price_change_percentage_24h;
    const currentPrice = isTrending
      ? coinData.data?.price
      : coinData.current_price;
    const isPositive = priceChange >= 0;

    return (
      <TouchableOpacity
        key={index}
        style={styles.coinChip}
        activeOpacity={0.75}
        onPress={() =>
          handleNavigate(`https://www.coingecko.com/en/coins/${coinData.id}`)
        }
      >
        <Image
          source={{ uri: isTrending ? coinData.large : coinData.image }}
          style={styles.coinLogo}
        />
        <View style={styles.coinInfo}>
          <Text style={styles.coinSymbol}>{coinData.symbol.toUpperCase()}</Text>
          {currentPrice != null && (
            <Text style={styles.coinPrice}>
              $
              {currentPrice >= 1
                ? currentPrice.toFixed(2)
                : currentPrice.toFixed(5)}
            </Text>
          )}
        </View>
        {priceChange != null && (
          <View
            style={[
              styles.changeBadge,
              isPositive ? styles.posBadge : styles.negBadge,
            ]}
          >
            <Text
              style={[
                styles.changeText,
                isPositive ? styles.posText : styles.negText,
              ]}
            >
              {isPositive ? "+" : ""}
              {priceChange.toFixed(1)}%
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── Quick-access strip ───────────────────────────────────────────────────
  const renderQuickAccess = () => (
    <View style={styles.quickRow}>
      {[
        {
          label: "Uniswap",
          url: "https://app.uniswap.org",
          icon: "swap-horizontal",
        },
        { label: "Markets", url: "https://coingecko.com", icon: "trending-up" },
        { label: "Trade", url: "https://sushi.com", icon: "repeat" },
        {
          label: "Explorer",
          url: activeChain.explorerUrl || "https://basescan.org",
          icon: "earth",
        },
      ].map((item, i) => (
        <TouchableOpacity
          key={i}
          style={styles.quickBtn}
          onPress={() => handleNavigate(item.url)}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons
            name={item.icon}
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.quickLabel}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: COLORS.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {renderHeader()}

      {/* Quick Access */}
      {renderQuickAccess()}

      <View style={[styles.divider, { backgroundColor: COLORS.border }]} />

      {/* dApp Sections */}
      {Object.entries(dAppSections).map(([section, dApps]) =>
        renderDAppSection(section, dApps),
      )}

      <View style={[styles.divider, { backgroundColor: COLORS.border }]} />

      {/* Trending */}
      <View style={styles.sectionRow}>
        <View style={styles.sectionLabelRow}>
          <Ionicons name="flame" size={15} color={COLORS.warning} />
          <Text style={styles.sectionLabel}> Trending</Text>
          <TouchableOpacity
            onPress={fetchCryptoData}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{ marginLeft: "auto" }}
          >
            <Ionicons name="refresh" size={15} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        {loadingCoins ? (
          <ActivityIndicator
            size="small"
            color={COLORS.primary}
            style={{ marginVertical: 8 }}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {trendingCoins.map((c, i) => renderCoinChip(c, i, true))}
          </ScrollView>
        )}
      </View>

      {/* Top Gainers */}
      <View style={styles.sectionRow}>
        <View style={styles.sectionLabelRow}>
          <Ionicons name="trending-up" size={15} color={COLORS.success} />
          <Text style={styles.sectionLabel}> Gainers 24h</Text>
        </View>
        {loadingCoins ? (
          <ActivityIndicator
            size="small"
            color={COLORS.primary}
            style={{ marginVertical: 8 }}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {topGainers.map((c, i) => renderCoinChip(c, i, false))}
          </ScrollView>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <MaterialCommunityIcons
          name="shield-check"
          size={13}
          color={COLORS.textTertiary}
        />
        <Text style={styles.footerText}> Secured · Web3</Text>
      </View>
    </ScrollView>
  );
};

const createStyles = (COLORS, SPACING, FONTS, BORDER_RADIUS) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: { paddingBottom: 24 },

    // ── Header ──────────────────────────────────────────────────────────────
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 8,
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
      height: 38,
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
      height: 38,
    },
    chainIcon: { width: 20, height: 20, borderRadius: 10 },
    walletPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: COLORS.success + "18",
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 9,
      height: 38,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: COLORS.success,
    },
    walletPillText: {
      fontSize: 12,
      color: COLORS.success,
      fontFamily: "monospace",
      fontWeight: "600",
    },
    connectPill: {
      backgroundColor: COLORS.primary,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 12,
      height: 38,
      justifyContent: "center",
    },
    connectPillText: {
      fontSize: 13,
      color: COLORS.background,
      fontWeight: "700",
    },

    // ── Quick Access ────────────────────────────────────────────────────────
    quickRow: {
      flexDirection: "row",
      paddingHorizontal: 12,
      gap: 8,
      marginBottom: 10,
    },
    quickBtn: {
      flex: 1,
      alignItems: "center",
      gap: 4,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: BORDER_RADIUS.md,
      paddingVertical: 10,
    },
    quickLabel: { fontSize: 11, color: COLORS.text, fontWeight: "500" },

    // ── Divider ─────────────────────────────────────────────────────────────
    divider: { height: 1, marginHorizontal: 12, marginVertical: 6 },

    // ── Section row ─────────────────────────────────────────────────────────
    sectionRow: { marginBottom: 6 },
    sectionLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      marginBottom: 6,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: COLORS.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: 12,
      paddingTop: 9,
      paddingBottom: 6,
    },
    hScroll: { paddingHorizontal: 12, gap: 8 },

    // ── App chip ────────────────────────────────────────────────────────────
    appChip: {
      alignItems: "center",
      gap: 5,
      width: 70,
    },
    appChipLogo: {
      width: 46,
      height: 46,
      borderRadius: BORDER_RADIUS.md,
    },
    appChipText: {
      fontSize: 11,
      color: COLORS.text,
      fontWeight: "500",
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
      minWidth: 145,
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
    posBadge: { backgroundColor: COLORS.success + "18" },
    negBadge: { backgroundColor: COLORS.error + "18" },
    changeText: { fontSize: 11, fontWeight: "700" },
    posText: { color: COLORS.success },
    negText: { color: COLORS.error },

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
