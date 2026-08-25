import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Image,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import ChainIcon from "../../components/common/ChainIcon";
import Svg, {
  Polyline,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Polygon,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWallet } from "../../contexts/WalletContext";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import Card from "../../components/common/Card";
import ChainSwitcher from "../../components/wallet/ChainSwitcher";
import PortfolioSummary from "../../components/wallet/PortfolioSummary";
import AssetCard from "../../components/wallet/AssetsCard";
import WSYNCard from "../../components/wallet/WSYNCard";
import MembershipCardModal from "../../components/wallet/MembershipCardModal";
import { SPACING, FONTS } from "../../constants/Theme";
import { formatAddress } from "../../utils/Wallet";
import {
  getAllNativePricesByChainId,
  fetchTrendingCoins,
} from "../../services/coingecko";
import * as Clipboard from "expo-clipboard";
import { useChain } from "../../contexts/ChainContext";
import { SUPPORTED_CHAINS, MAINNET_CHAIN_IDS } from "../../constants/Chain";
import { useAppMode } from "../../contexts/AppModeContext";
import UserIcon from "../../components/common/UserIcon";
import Alert from "../../utils/Alert";
import { getAllNFTsAcrossChains } from "../../utils/blockchain";
import { useAvailableChains } from "../../hooks/useAvailableChains";
import QRScanner from "../../components/wallet/QRScanner";

const NFT_CARD_WIDTH = 130;
const BADGE_SIZE = 84;

const COMMUNITY_VISIBLE_CHAINS = [
  SUPPORTED_CHAINS.BASE.id,
  SUPPORTED_CHAINS.BASE_SEPOLIA.id,
];

// ─── Shared helpers ──────────────────────────────────────────────────────────

const getImageUrl = (nft) =>
  nft.image?.cachedUrl ||
  nft.image?.thumbnailUrl ||
  nft.image?.originalUrl ||
  nft.media?.[0]?.gateway ||
  nft.media?.[0]?.thumbnail ||
  null;

const fmt = (n, decimals = 2) =>
  n == null
    ? "0.00"
    : Number(n).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

// ── Sparkline chart (SVG) — wallet mode only ─────────────────────────────────
const SparkLine = ({ data, positive, width = 130, height = 36 }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lineStr = pts.join(" ");
  const color = positive ? "#26cc6b" : "#FF5252";
  const gradId = positive ? "sparkUp" : "sparkDn";
  const fillPts = [
    `${pad},${height}`,
    ...pts,
    `${(width - pad).toFixed(1)},${height}`,
  ].join(" ");
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.35" />
          <Stop offset="1" stopColor={color} stopOpacity="0.0" />
        </SvgGradient>
      </Defs>
      <Polygon points={fillPts} fill={`url(#${gradId})`} />
      <Polyline
        points={lineStr}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

const fmtPrice = (n) => {
  if (n == null) return "—";
  if (n >= 1000)
    return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return "$" + n.toFixed(2);
  return "$" + n.toFixed(4);
};

// ─── Main component ───────────────────────────────────────────────────────────

const HomeScreen = ({ navigation }) => {
  const { COLORS, FONTS: F, SPACING: S } = useTheme();
  const { isWalletMode } = useAppMode();
  const { availableChains } = useAvailableChains();
  const { wallet, selectedChain, balances, refreshBalance, loading } =
    useWallet();
  const { user } = useAuth();
  const { activeChain, isProduction } = useChain();
  const insets = useSafeAreaInsets();

  const DEFAULT_VISIBLE_CHAINS = isWalletMode
    ? MAINNET_CHAIN_IDS
    : COMMUNITY_VISIBLE_CHAINS;

  const [refreshing, setRefreshing] = useState(false);
  const [showChainSwitcher, setShowChainSwitcher] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showMembershipCard, setShowMembershipCard] = useState(false);

  const handleScan = useCallback(
    (address) => {
      setShowScanner(false);
      navigation.navigate("Send", { recipient: address });
    },
    [navigation],
  );
  const [nfts, setNfts] = useState([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [totalNFTCount, setTotalNFTCount] = useState(0);
  const [prices, setPrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [trending, setTrending] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(false);

  useEffect(() => {
    if (wallet) {
      refreshBalance();
      loadNFTs();
      loadPrices();
    }
  }, [wallet, availableChains]);

  // Trending only shown in wallet mode — fetch once on mount
  useEffect(() => {
    if (!isWalletMode) return;
    let cancelled = false;
    setLoadingTrending(true);
    fetchTrendingCoins(12).then((coins) => {
      if (!cancelled) {
        setTrending(coins);
        setLoadingTrending(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isWalletMode]);

  const loadPrices = async () => {
    try {
      setLoadingPrices(true);
      setPrices(await getAllNativePricesByChainId());
    } catch (e) {
      console.error("Error loading prices:", e);
    } finally {
      setLoadingPrices(false);
    }
  };

  const loadNFTs = async () => {
    if (!wallet?.address) return;
    try {
      setLoadingNFTs(true);
      const result = await getAllNFTsAcrossChains(
        wallet.address,
        availableChains,
      );
      setNfts((result.nfts || []).slice(0, 10));
      setTotalNFTCount(result.totalCount || 0);
    } catch (e) {
      console.error("Error loading NFTs:", e);
    } finally {
      setLoadingNFTs(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshBalance(), loadNFTs(), loadPrices()]);
    setRefreshing(false);
  };

  const copyAddress = async () => {
    if (wallet?.address) {
      await Clipboard.setStringAsync(wallet.address);
      Alert.alert("Address copied!");
    }
  };

  const getAssetsWithPrices = () => {
    const chainsToShow = isProduction
      ? availableChains.filter((c) => !c.testnet)
      : availableChains;

    return chainsToShow
      .map((chain) => {
        const balance = balances[chain.id];
        const balanceValue = balance ? parseFloat(balance.formatted) : 0;
        const priceData = prices[chain.id];
        const price = priceData?.usd || 0;
        return {
          chain,
          balance: balanceValue.toString(),
          usdValue: balanceValue * price,
          price,
          priceChange24h: priceData?.usd_24h_change,
          isZeroBalance: balanceValue === 0,
          isTestnet: chain.testnet,
        };
      })
      .filter(
        (a) => DEFAULT_VISIBLE_CHAINS.includes(a.chain.id) || !a.isZeroBalance,
      )
      .sort((a, b) => {
        if (a.isZeroBalance !== b.isZeroBalance)
          return a.isZeroBalance ? 1 : -1;
        return b.usdValue - a.usdValue;
      });
  };

  const assets = getAssetsWithPrices();
  const totalValue = assets.reduce((s, a) => s + a.usdValue, 0);
  const includesTestnet = assets.some((a) => a.isTestnet);

  // Weighted average 24h change
  const totalWeight = assets.reduce(
    (s, a) => s + (a.usdValue > 0 ? a.usdValue : 0),
    0,
  );
  const totalChange24h =
    totalWeight > 0
      ? assets.reduce((s, a) => s + (a.priceChange24h || 0) * a.usdValue, 0) /
        totalWeight
      : 0;

  const changePositive = totalChange24h >= 0;

  // ─────────────────────────────────────────────────────────────────────────
  // WALLET MODE — multi-chain DeFi layout (UNCHANGED)
  // ─────────────────────────────────────────────────────────────────────────
  if (isWalletMode) {
    const wStyles = walletStyles(COLORS, F, S, insets);
    return (
      <View style={wStyles.root}>
        <ScrollView
          contentContainerStyle={wStyles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={[wStyles.header, { paddingTop: insets.top + 12 }]}>
            <UserIcon onPress={() => navigation.openDrawer()} />
            <Text style={wStyles.appName}>TRIBE</Text>
            <View style={wStyles.headerRight}>
              <TouchableOpacity
                onPress={() => setShowScanner(true)}
                style={wStyles.iconBtn}
              >
                <Ionicons name="scan-outline" size={22} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate("Settings")}
                style={wStyles.iconBtn}
              >
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Portfolio Hero ── */}
          <LinearGradient
            colors={[COLORS.card, COLORS.surface, COLORS.background]}
            style={wStyles.heroCard}
          >
            <View style={wStyles.heroTop}>
              <Text style={wStyles.heroLabel}>Total Portfolio</Text>
              <TouchableOpacity
                style={wStyles.chainCountPill}
                onPress={() => setShowChainSwitcher(true)}
              >
                <ChainIcon
                  chain={activeChain}
                  size={16}
                  style={wStyles.activeChainDot}
                />
                <Text style={wStyles.chainCountText}>{activeChain.name}</Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </View>

            <Text style={wStyles.heroValue}>
              ${loadingPrices ? "—" : fmt(totalValue)}
            </Text>

            <View style={wStyles.heroChangeRow}>
              <Ionicons
                name={changePositive ? "trending-up" : "trending-down"}
                size={16}
                color={changePositive ? COLORS.primary : COLORS.error}
              />
              <Text
                style={[
                  wStyles.heroChange,
                  { color: changePositive ? COLORS.primary : COLORS.error },
                ]}
              >
                {changePositive ? "+" : ""}
                {fmt(totalChange24h)}% (24h)
              </Text>
            </View>

            {/* Chain pips */}
            <View style={wStyles.chainRow}>
              {assets.map((a) => (
                <ChainIcon
                  key={a.chain.id}
                  chain={a.chain}
                  size={24}
                  style={[
                    wStyles.chainPip,
                    a.chain.id === activeChain.id && wStyles.chainPipActive,
                    a.isZeroBalance && { opacity: 0.35 },
                  ]}
                />
              ))}
            </View>
          </LinearGradient>

          {/* ── Quick Actions ── */}
          <View style={wStyles.actionsRow}>
            {[
              { icon: "paper-plane-outline", label: "Send", screen: "Send" },
              { icon: "barcode-outline", label: "Receive", screen: "Receive" },
              { icon: "repeat-outline", label: "Swap", screen: "SwapTab" },
              {
                icon: "time-outline",
                label: "History",
                screen: "Transactions",
              },
            ].map(({ icon, label, screen }) => (
              <TouchableOpacity
                key={label}
                style={wStyles.actionPill}
                onPress={() => navigation.navigate(screen)}
                activeOpacity={0.7}
              >
                <View style={wStyles.actionIcon}>
                  <Ionicons name={icon} size={28} color={COLORS.primary} />
                  <Text style={wStyles.actionLabel}>{label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Trending ── */}
          <View style={wStyles.trendingHeader}>
            <Ionicons name="flame" size={16} color="#f97316" />
            <Text style={wStyles.trendingTitle}>Trending</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={wStyles.trendingRow}
          >
            {loadingTrending
              ? Array.from({ length: 5 }).map((_, i) => (
                  <View
                    key={i}
                    style={[wStyles.trendingCard, wStyles.trendingCardSkeleton]}
                  />
                ))
              : trending.map((coin) => {
                  const up = coin.change24h >= 0;
                  const accentColor = up ? COLORS.primary : COLORS.error;
                  return (
                    <View
                      key={coin.id}
                      style={[
                        wStyles.trendingCard,
                        {
                          borderColor: accentColor + "55",
                          backgroundColor: accentColor + "0d",
                        },
                      ]}
                    >
                      <View style={wStyles.trendingTop}>
                        <Image
                          source={{ uri: coin.image }}
                          style={wStyles.trendingIcon}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={wStyles.trendingSymbol}
                            numberOfLines={1}
                          >
                            {coin.symbol.toUpperCase()}
                          </Text>
                          <Text style={wStyles.trendingName} numberOfLines={1}>
                            {coin.name}
                          </Text>
                        </View>
                        <View
                          style={[
                            wStyles.trendingChangePill,
                            { backgroundColor: accentColor + "22" },
                          ]}
                        >
                          <Ionicons
                            name={up ? "caret-up" : "caret-down"}
                            size={9}
                            color={accentColor}
                          />
                          <Text
                            style={[
                              wStyles.trendingChange,
                              { color: accentColor },
                            ]}
                          >
                            {fmt(Math.abs(coin.change24h), 1)}%
                          </Text>
                        </View>
                      </View>

                      <Text style={wStyles.trendingPrice} numberOfLines={1}>
                        {fmtPrice(coin.price)}
                      </Text>

                      <View style={wStyles.trendingChart}>
                        <SparkLine
                          data={coin.sparkline}
                          positive={up}
                          width={155}
                          height={44}
                        />
                      </View>
                    </View>
                  );
                })}
          </ScrollView>

          {/* ── Assets — Phantom-style column list ── */}
          <View style={wStyles.sectionHeader}>
            <TouchableOpacity onPress={() => navigation.navigate("Tokens")}>
              <Text style={wStyles.manageTokens}>Manage Tokens</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowChainSwitcher(true)}>
              <Text
                style={{
                  fontSize: F.sizes.sm,
                  color: COLORS.primary,
                  fontWeight: "500",
                }}
              >
                Switch
              </Text>
            </TouchableOpacity>
          </View>

          <View style={wStyles.assetList}>
            {assets.map((a) => {
              const isActive = a.chain.id === activeChain.id;
              const changePos = (a.priceChange24h ?? 0) >= 0;
              return (
                <TouchableOpacity
                  key={a.chain.id}
                  style={wStyles.assetRow}
                  onPress={() =>
                    navigation.navigate("TokenDetail", {
                      chain: a.chain,
                      balance: a.balance,
                      usdValue: a.usdValue,
                      price: a.price,
                      priceChange24h: a.priceChange24h,
                      walletAddress: wallet?.address,
                    })
                  }
                  activeOpacity={0.65}
                >
                  {isActive && <View style={wStyles.activeBar} />}

                  <View style={wStyles.assetIconWrap}>
                    <ChainIcon
                      chain={a.chain}
                      size={40}
                      style={wStyles.assetIcon}
                    />
                    {a.isTestnet && <View style={wStyles.testnetRing} />}
                  </View>

                  <View style={wStyles.assetLeft}>
                    <Text style={wStyles.assetName} numberOfLines={1}>
                      {a.chain.name}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Text style={wStyles.assetSymbol}>{a.chain.symbol}</Text>
                      {a.priceChange24h != null && (
                        <Text
                          style={[
                            wStyles.assetChange,
                            {
                              color: changePos ? COLORS.primary : COLORS.error,
                            },
                          ]}
                        >
                          {changePos ? "+" : ""}
                          {fmt(a.priceChange24h, 1)}%
                        </Text>
                      )}
                      {a.isTestnet && (
                        <Text style={wStyles.assetTestnet}>Testnet</Text>
                      )}
                    </View>
                  </View>

                  <View style={wStyles.assetRight}>
                    <Text style={wStyles.assetBalance} numberOfLines={1}>
                      {fmt(parseFloat(a.balance), 4)} {a.chain.symbol}
                    </Text>
                    {a.price > 0 && (
                      <Text style={wStyles.assetPrice} numberOfLines={1}>
                        {fmtPrice(a.price)}
                      </Text>
                    )}
                    <Text style={wStyles.assetUsd}>${fmt(a.usdValue)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <ChainSwitcher
          visible={showChainSwitcher}
          onClose={() => setShowChainSwitcher(false)}
        />

        <QRScanner
          visible={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={handleScan}
        />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMMUNITY MODE — Member Card layout
  //
  // Deliberately NOT a lighter wallet-mode: no chain switcher, no ticker,
  // no dense list rows. The hero is a membership card (same glow/gradient
  // language as the AirdropCard on ProfileScreen — same product family,
  // different screen), actions are warm filled pills instead of outlined
  // neutrals, and NFTs are round "Badges" instead of square trading cards.
  // Since this mode is always scoped to Base, there's nothing to switch —
  // that absence itself is the signal this is a different kind of screen.
  //
  // Header now also has a shareable-membership-card quick action (id-card
  // icon) next to Settings — opens the same MembershipCardModal used on
  // ProfileScreen, prefilled with what this screen already has in state.
  // ─────────────────────────────────────────────────────────────────────────
  const cStyles = communityStyles(COLORS, F, S, insets);
  const displayName = user?.displayName || wallet?.name || "My Wallet";
  const greeting = getGreeting();
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Member";

  return (
    <View style={cStyles.root}>
      <ScrollView
        contentContainerStyle={cStyles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={[cStyles.header, { paddingTop: insets.top + 12 }]}>
          <UserIcon onPress={() => navigation.openDrawer()} />
          <View style={{ flex: 1, marginLeft: S.sm }}>
            <Text style={cStyles.greeting}>{greeting}</Text>
            <Text style={cStyles.displayName} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
          <View style={cStyles.headerRight}>
            <TouchableOpacity
              onPress={() => setShowMembershipCard(true)}
              style={cStyles.iconBtn}
            >
              <Ionicons name="id-card-outline" size={20} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("Settings")}
              style={cStyles.iconBtn}
            >
              <Ionicons name="settings-outline" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Member Card ── */}
        <View style={cStyles.cardOuter}>
          <LinearGradient
            colors={[
              COLORS.primary + "20",
              COLORS.primary + "06",
              "transparent",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={cStyles.memberCard}
          >
            <View style={cStyles.cardTopRow}>
              <View style={cStyles.cardLabelWrap}>
                <View style={cStyles.cardDot} />
                <Text style={cStyles.cardLabel}>BALANCE</Text>
              </View>
              <View style={cStyles.networkChip}>
                <ChainIcon
                  chain={activeChain}
                  size={12}
                  style={{ marginRight: 4 }}
                />
                <Text style={cStyles.networkChipText}>{activeChain.name}</Text>
                {activeChain.testnet && <View style={cStyles.testnetDot} />}
              </View>
            </View>

            <Text style={cStyles.cardBalance}>
              ${loadingPrices ? "—" : fmt(totalValue)}
            </Text>

            <Pressable onPress={copyAddress} style={cStyles.cardAddressRow}>
              <Ionicons
                name="finger-print-outline"
                size={12}
                color={COLORS.textTertiary}
              />
              <Text style={cStyles.cardAddressText}>
                {formatAddress(wallet?.address, 6)}
              </Text>
              <Ionicons
                name="copy-outline"
                size={12}
                color={COLORS.textTertiary}
              />
            </Pressable>

            <View style={cStyles.cardStamp}>
              <Text style={cStyles.cardStampText}>MEMBER</Text>
            </View>
          </LinearGradient>
        </View>

        {/* ── Quick Actions — warm filled pills ── */}
        <View style={cStyles.actionsRow}>
          {[
            {
              icon: "paper-plane",
              label: "Send",
              screen: "Send",
              bg: COLORS.primary,
            },
            {
              icon: "qr-code",
              label: "Receive",
              screen: "Receive",
              bg: COLORS.primary,
            },
            {
              icon: "layers",
              label: "Assets",
              screen: "Tokens",
              bg: COLORS.primary,
            },
            {
              icon: "time",
              label: "Activity",
              screen: "Transactions",
              bg: COLORS.primary,
            },
          ].map(({ icon, label, screen, bg }) => (
            <Pressable
              key={label}
              style={cStyles.actionBtn}
              onPress={() => navigation.navigate(screen)}
            >
              <View style={[cStyles.actionIcon, { backgroundColor: bg }]}>
                <Ionicons name={icon} size={20} color="#fff" />
              </View>
              <Text style={cStyles.actionLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Badges (NFTs, reframed) ── */}
        <View style={{ marginBottom: S.lg }}>
          <View style={cStyles.sectionHeaderRow}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="ribbon-outline" size={18} color={COLORS.text} />
              <Text style={cStyles.sectionTitle}>Badges & NFTs</Text>
              {totalNFTCount > 0 && (
                <View style={cStyles.countPill}>
                  <Text style={cStyles.countPillText}>{totalNFTCount}</Text>
                </View>
              )}
            </View>
            <Pressable
              onPress={() => navigation.navigate("NFTs")}
              style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
            >
              <Text style={cStyles.viewAll}>View All</Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={COLORS.primary}
              />
            </Pressable>
          </View>

          {loadingNFTs ? (
            <Text
              style={{
                color: COLORS.textTertiary,
                fontSize: F.sizes.sm,
                marginLeft: 4,
              }}
            >
              Loading…
            </Text>
          ) : nfts.length === 0 ? (
            <View style={cStyles.emptyBadgeCard}>
              <Ionicons
                name="ribbon-outline"
                size={26}
                color={COLORS.textTertiary}
              />
              <Text style={cStyles.emptyBadgeText}>
                No badges yet — join a guild to start earning them
              </Text>
            </View>
          ) : (
            <FlatList
              horizontal
              data={nfts}
              keyExtractor={(item, i) =>
                `${item.contract?.address}-${item.tokenId}-${i}`
              }
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: S.md, paddingHorizontal: 4 }}
              renderItem={({ item }) => {
                const imgUrl = getImageUrl(item);
                return (
                  <Pressable
                    onPress={() => navigation.navigate("NFTs")}
                    style={cStyles.badgeItem}
                  >
                    <View style={cStyles.badgeRing}>
                      {imgUrl ? (
                        <Image
                          source={{ uri: imgUrl }}
                          style={cStyles.badgeImage}
                        />
                      ) : (
                        <View
                          style={[
                            cStyles.badgeImage,
                            cStyles.badgeImageFallback,
                          ]}
                        >
                          <Ionicons
                            name="ribbon-outline"
                            size={22}
                            color={COLORS.textTertiary}
                          />
                        </View>
                      )}
                    </View>
                    <Text style={cStyles.badgeName} numberOfLines={1}>
                      {item.name || item.title || `#${item.tokenId}`}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>

        {/* ── Community Rewards CTA ── */}
        <WSYNCard onMintPress={() => navigation.navigate("MintTRIBE")} />

        {/* ── Wallet strip (Base only) ── */}
        <View style={{ marginTop: S.lg }}>
          <View style={cStyles.sectionHeaderRow}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="wallet-outline" size={18} color={COLORS.text} />
              <Text style={cStyles.sectionTitle}>Your Base wallet</Text>
            </View>
          </View>
          <View style={cStyles.walletStripCard}>
            {assets.map((asset, i) => (
              <AssetCard
                key={asset.chain.id}
                asset={asset}
                onPress={() =>
                  navigation.navigate("TokenDetail", {
                    chain: asset.chain,
                    balance: asset.balance,
                    usdValue: asset.usdValue,
                    price: asset.price,
                    priceChange24h: asset.priceChange24h,
                    walletAddress: wallet?.address,
                  })
                }
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <ChainSwitcher
        visible={showChainSwitcher}
        onClose={() => setShowChainSwitcher(false)}
      />

      <MembershipCardModal
        visible={showMembershipCard}
        onClose={() => setShowMembershipCard(false)}
        COLORS={COLORS}
        appName="TRIBE"
        displayName={displayName}
        username={user?.username}
        avatarUri={user?.profilePicture}
        memberSince={memberSince}
        walletAddress={wallet?.address}
      />
    </View>
  );
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

// ─── Wallet Mode styles (UNCHANGED) ───────────────────────────────────────────
const walletStyles = (COLORS, F, S, insets) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.background },
    scroll: { paddingHorizontal: S.md, paddingBottom: 110 },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: S.md,
      paddingBottom: 12,
    },
    appName: {
      fontSize: F.sizes.xl,
      fontWeight: "700",
      color: COLORS.text,
      letterSpacing: 3,
    },
    headerRight: { flexDirection: "row", gap: 8 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: COLORS.surface,
      justifyContent: "center",
      alignItems: "center",
    },

    heroCard: {
      borderRadius: 20,
      padding: S.lg,
      marginBottom: S.lg,
    },
    heroTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: S.sm,
    },
    heroLabel: {
      fontSize: F.sizes.sm,
      color: COLORS.textTertiary,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    chainCountPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: COLORS.primary + "15",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    activeChainDot: { width: 16, height: 16, borderRadius: 8 },
    chainCountText: {
      fontSize: F.sizes.xs,
      color: COLORS.primary,
      fontWeight: "700",
    },
    heroValue: {
      fontSize: 42,
      fontWeight: "800",
      color: COLORS.text,
      letterSpacing: -1,
      marginBottom: 4,
    },
    heroChangeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: S.md,
    },
    heroChange: { fontSize: F.sizes.sm, fontWeight: "600" },
    chainRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    chainPip: { width: 24, height: 24, borderRadius: 12 },
    chainPipActive: { borderWidth: 2, borderColor: COLORS.primary },

    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: S.xl,
      gap: 6,
    },
    actionPill: { flex: 1 },
    actionIcon: {
      backgroundColor: COLORS.surface,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    actionLabel: {
      fontSize: F.sizes.xs,
      color: COLORS.textSecondary,
      fontWeight: "600",
      textAlign: "center",
    },

    trendingHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: S.sm,
    },
    trendingTitle: {
      fontSize: F.sizes.base,
      fontWeight: "700",
      color: COLORS.text,
    },
    trendingRow: {
      gap: S.sm,
      paddingRight: S.md,
      marginBottom: S.xl,
    },
    trendingCard: {
      width: 155,
      backgroundColor: COLORS.card,
      borderRadius: 16,
      padding: 10,
      paddingBottom: 0,
      borderWidth: 1,
      overflow: "hidden",
    },
    trendingCardSkeleton: {
      height: 140,
      opacity: 0.3,
    },
    trendingTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 6,
    },
    trendingIcon: { width: 28, height: 28, borderRadius: 14 },
    trendingSymbol: {
      fontSize: F.sizes.sm,
      fontWeight: "800",
      color: COLORS.text,
    },
    trendingName: {
      fontSize: 10,
      color: COLORS.textTertiary,
      fontWeight: "500",
    },
    trendingPrice: {
      fontSize: F.sizes.md,
      color: COLORS.text,
      fontWeight: "700",
    },
    trendingChangePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 5,
      paddingVertical: 3,
      borderRadius: 6,
    },
    trendingChange: {
      fontSize: 10,
      fontWeight: "700",
    },
    trendingChart: {
      marginHorizontal: -10,
      marginTop: 8,
      overflow: "hidden",
    },

    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: S.sm,
    },
    manageTokens: {
      fontSize: F.sizes.sm,
      fontWeight: "700",
      color: COLORS.text,
    },

    assetList: {
      marginBottom: S.xl,
    },
    assetRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 4,
      paddingVertical: 14,
      position: "relative",
    },
    assetRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border + "80",
    },
    activeBar: {
      position: "absolute",
      left: 0,
      top: 12,
      bottom: 12,
      width: 3,
      borderRadius: 2,
      backgroundColor: COLORS.primary,
    },
    assetIconWrap: {
      marginRight: S.md,
      position: "relative",
    },
    assetIcon: { width: 40, height: 40, borderRadius: 20 },
    testnetRing: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: COLORS.warning,
      borderWidth: 2,
      borderColor: COLORS.card,
    },
    assetLeft: { flex: 1, gap: 3 },
    assetName: {
      fontSize: F.sizes.base,
      fontWeight: "700",
      color: COLORS.text,
    },
    assetSymbol: {
      fontSize: F.sizes.xs,
      color: COLORS.textTertiary,
      fontWeight: "500",
    },
    assetChange: { fontSize: F.sizes.xs, fontWeight: "600" },
    assetTestnet: {
      fontSize: 9,
      fontWeight: "700",
      color: COLORS.warning,
      backgroundColor: COLORS.warning + "20",
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
    },
    assetRight: { alignItems: "flex-end", gap: 2 },
    assetBalance: {
      fontSize: F.sizes.sm,
      fontWeight: "700",
      color: COLORS.text,
    },
    assetPrice: {
      fontSize: F.sizes.xs,
      color: COLORS.primary,
      fontWeight: "600",
    },
    assetUsd: {
      fontSize: F.sizes.xs,
      color: COLORS.textTertiary,
      fontWeight: "500",
    },
  });

// ─── Community Mode styles — Member Card language ─────────────────────────────
const communityStyles = (COLORS, F, S, insets) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.background },
    scroll: { paddingHorizontal: S.md, paddingBottom: 110 },

    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: S.md,
      paddingBottom: 16,
    },
    greeting: {
      fontSize: F.sizes.xs,
      color: COLORS.textTertiary,
      fontWeight: "600",
    },
    displayName: {
      fontSize: F.sizes.lg,
      fontWeight: "800",
      color: COLORS.text,
      letterSpacing: -0.3,
      marginTop: 1,
    },
    headerRight: { flexDirection: "row", gap: 8 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: COLORS.surface,
      justifyContent: "center",
      alignItems: "center",
    },

    // Member card — same visual family as ProfileScreen's AirdropCard
    cardOuter: {
      marginBottom: S.lg,
      borderRadius: 22,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 6,
    },
    memberCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: COLORS.primary + "25",
      backgroundColor: COLORS.surface,
      padding: S.lg,
      overflow: "hidden",
    },
    cardTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: S.md,
    },
    cardLabelWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
    cardDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: COLORS.primary,
    },
    cardLabel: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.5,
      color: COLORS.primary,
    },
    networkChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: COLORS.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
    },
    networkChipText: {
      fontSize: 10,
      fontWeight: "700",
      color: COLORS.textSecondary,
    },
    testnetDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: COLORS.warning,
      marginLeft: 4,
    },
    cardBalance: {
      fontSize: 38,
      fontWeight: "900",
      color: COLORS.text,
      letterSpacing: -1,
      marginBottom: 12,
    },
    cardAddressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
    },
    cardAddressText: {
      fontSize: 11,
      fontWeight: "600",
      color: COLORS.textTertiary,
      fontFamily: "monospace",
    },
    cardStamp: {
      position: "absolute",
      top: 14,
      right: -28,
      backgroundColor: COLORS.primary,
      paddingHorizontal: 30,
      paddingVertical: 3,
      transform: [{ rotate: "35deg" }],
    },
    cardStampText: {
      fontSize: 9,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 1.5,
    },

    // Actions
    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: S.xl,
      gap: 6,
    },
    actionBtn: { flex: 1, alignItems: "center", gap: 6 },
    actionIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    actionLabel: {
      fontSize: F.sizes.xs,
      color: COLORS.text,
      fontWeight: "600",
    },

    // Section header
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: S.sm,
      paddingHorizontal: 4,
    },
    sectionTitle: {
      fontSize: F.sizes.base,
      fontWeight: "700",
      color: COLORS.text,
    },
    countPill: {
      backgroundColor: COLORS.primary + "20",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    countPillText: {
      fontSize: F.sizes.xs,
      color: COLORS.primary,
      fontWeight: "700",
    },
    viewAll: { fontSize: F.sizes.sm, color: COLORS.primary, fontWeight: "500" },

    // Badges (circular NFTs)
    badgeItem: { width: BADGE_SIZE + 12, alignItems: "center", gap: 6 },
    badgeRing: {
      width: BADGE_SIZE,
      height: BADGE_SIZE,
      borderRadius: BADGE_SIZE / 2,
      borderWidth: 2,
      borderColor: COLORS.primary + "40",
      padding: 3,
      backgroundColor: COLORS.surface,
    },
    badgeImage: {
      width: "100%",
      height: "100%",
      borderRadius: (BADGE_SIZE - 6) / 2,
    },
    badgeImageFallback: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: COLORS.card,
    },
    badgeName: {
      fontSize: F.sizes.xs,
      fontWeight: "600",
      color: COLORS.text,
      textAlign: "center",
    },
    emptyBadgeCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      padding: S.md,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    emptyBadgeText: {
      flex: 1,
      fontSize: F.sizes.sm,
      color: COLORS.textSecondary,
      lineHeight: 19,
    },

    // Wallet strip
    walletStripCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.border,
      overflow: "hidden",
    },
  });

export default HomeScreen;
