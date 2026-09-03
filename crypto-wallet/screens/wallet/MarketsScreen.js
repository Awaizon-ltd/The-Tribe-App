// screens/wallet/MarketsScreen.js
// Wallet mode's "Markets" tab — live CoinGecko market data via the backend
// proxy (backend/src/controllers/coingeckoController.js), all of it on
// CoinGecko's free tier (no API key configured — verified live, since a
// paid-only endpoint would 401/403 without one). Three tabs share the same
// underlying data shape, just different orderings/filters CoinGecko already
// applies server-side:
//   All      → /coingecko/markets      (market_cap_desc, the default view)
//   Trending → /coingecko/trending     (CoinGecko's own gecko_desc ranking)
//   Gainers  → /coingecko/gainers      (biggest 24h % movers)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline, Polygon, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';
import AppHeader from '../../components/common/AppHeader';
import { getMarkets, fetchTrendingCoins, getTopGainers } from '../../services/CoinGeckoService';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'trending', label: 'Trending' },
  { key: 'gainers', label: 'Gainers' },
];

const fmtPrice = (n) => {
  if (n == null) return '—';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return '$' + n.toFixed(2);
  return '$' + n.toFixed(6);
};

const fmtCompact = (n) => {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
};

// ─── Sparkline ────────────────────────────────────────────────────────────────
const SparkLine = ({ data, positive, width = 64, height = 32 }) => {
  if (!data || data.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color = positive ? '#26cc6b' : '#FF5252';
  const gradId = positive ? 'mkt_up' : 'mkt_dn';
  const fill = [`${pad},${height}`, ...pts, `${(width - pad).toFixed(1)},${height}`].join(' ');
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.3" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Polygon points={fill} fill={`url(#${gradId})`} />
      <Polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

// ─── Coin row ─────────────────────────────────────────────────────────────────
const CoinRow = ({ coin, onPress, styles, COLORS }) => {
  const isPos = (coin.change24h ?? 0) >= 0;
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(coin)} activeOpacity={0.7}>
      {coin.marketCapRank != null && <Text style={styles.rank}>{coin.marketCapRank}</Text>}
      <Image source={{ uri: coin.image }} style={styles.rowIcon} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowSymbol}>{coin.symbol?.toUpperCase()}</Text>
        <Text style={styles.rowName} numberOfLines={1}>{coin.name}</Text>
      </View>
      {coin.sparkline?.length > 1 && (
        <SparkLine data={coin.sparkline} positive={isPos} />
      )}
      <View style={styles.rowRight}>
        <Text style={styles.rowPrice}>{fmtPrice(coin.price)}</Text>
        <View style={[styles.changePill, { backgroundColor: (isPos ? COLORS.primary : COLORS.error) + '18' }]}>
          <Ionicons name={isPos ? 'caret-up' : 'caret-down'} size={9} color={isPos ? COLORS.primary : COLORS.error} />
          <Text style={[styles.changeText, { color: isPos ? COLORS.primary : COLORS.error }]}>
            {Math.abs(coin.change24h ?? 0).toFixed(1)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Detail sheet ───────────────────────────────────────────────────────────
// Coins here are global market data, not necessarily on any chain the wallet
// holds a balance for — an inline sheet (not a push into TokenDetailScreen,
// which assumes a chain/balance context) is the honest way to show more
// without pretending there's a wallet position behind every row.
const CoinDetailSheet = ({ coin, onClose, styles, COLORS }) => {
  if (!coin) return null;
  const isPos = (coin.change24h ?? 0) >= 0;
  return (
    <Modal visible={!!coin} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Image source={{ uri: coin.image }} style={styles.sheetIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetName}>{coin.name}</Text>
              <Text style={styles.sheetSymbol}>{coin.symbol?.toUpperCase()}</Text>
            </View>
            {coin.marketCapRank != null && (
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>#{coin.marketCapRank}</Text>
              </View>
            )}
          </View>

          {coin.sparkline?.length > 1 && (
            <View style={styles.sheetChartWrap}>
              <SparkLine data={coin.sparkline} positive={isPos} width={280} height={80} />
            </View>
          )}

          <View style={styles.sheetPriceRow}>
            <Text style={styles.sheetPrice}>{fmtPrice(coin.price)}</Text>
            <View style={[styles.changePill, { backgroundColor: (isPos ? COLORS.primary : COLORS.error) + '18' }]}>
              <Ionicons name={isPos ? 'caret-up' : 'caret-down'} size={11} color={isPos ? COLORS.primary : COLORS.error} />
              <Text style={[styles.changeText, { fontSize: 13, color: isPos ? COLORS.primary : COLORS.error }]}>
                {Math.abs(coin.change24h ?? 0).toFixed(2)}% (24h)
              </Text>
            </View>
          </View>

          {(coin.marketCap != null || coin.volume24h != null) && (
            <View style={styles.statsRow}>
              {coin.marketCap != null && (
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Market Cap</Text>
                  <Text style={styles.statValue}>{fmtCompact(coin.marketCap)}</Text>
                </View>
              )}
              {coin.volume24h != null && (
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>24h Volume</Text>
                  <Text style={styles.statValue}>{fmtCompact(coin.volume24h)}</Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
            <Text style={styles.sheetCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
const MarketsScreen = () => {
  const { COLORS, FONTS, SPACING } = useTheme();
  const styles = createStyles(COLORS, FONTS, SPACING);

  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState(null);

  const load = useCallback(async (tab) => {
    if (tab === 'trending') return fetchTrendingCoins(30);
    if (tab === 'gainers') return getTopGainers(25);
    return getMarkets(60, 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load(activeTab).then((data) => {
      if (!cancelled) {
        setCoins(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    const data = await load(activeTab);
    setCoins(data);
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return coins;
    return coins.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.symbol?.toLowerCase().includes(q),
    );
  }, [coins, query]);

  return (
    <View style={styles.container}>
      <AppHeader title="Markets" />

      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search coins"
            placeholderTextColor={COLORS.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && { backgroundColor: COLORS.primary + '18' }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, active && { color: COLORS.primary, fontWeight: '700' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.loadingWrap}>
          <Ionicons name="search-outline" size={32} color={COLORS.textTertiary} />
          <Text style={styles.emptyText}>No coins match "{query}"</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CoinRow coin={item} onPress={setSelectedCoin} styles={styles} COLORS={COLORS} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        />
      )}

      <CoinDetailSheet coin={selectedCoin} onClose={() => setSelectedCoin(null)} styles={styles} COLORS={COLORS} />
    </View>
  );
};

const createStyles = (COLORS, FONTS, SPACING) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    searchBarWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      paddingHorizontal: SPACING.md,
      height: 42,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    searchInput: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.text },

    tabRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
    tab: {
      paddingHorizontal: SPACING.md,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: COLORS.surface,
    },
    tabText: { fontSize: FONTS.sizes.xs, fontWeight: '600', color: COLORS.textSecondary },

    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
    emptyText: { fontSize: FONTS.sizes.sm, color: COLORS.textTertiary },

    list: { paddingHorizontal: SPACING.md, paddingBottom: 110 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      gap: SPACING.sm,
    },
    rank: { width: 18, fontSize: 11, fontWeight: '600', color: COLORS.textTertiary, textAlign: 'center' },
    rowIcon: { width: 32, height: 32, borderRadius: 16 },
    rowInfo: { flex: 1 },
    rowSymbol: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
    rowName: { fontSize: 11, color: COLORS.textTertiary, marginTop: 1 },
    rowRight: { alignItems: 'flex-end', gap: 3, minWidth: 74 },
    rowPrice: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
    changePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    changeText: { fontSize: 10, fontWeight: '700' },

    // ── Detail sheet ──
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheetCard: {
      backgroundColor: COLORS.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: SPACING.lg,
      paddingBottom: SPACING.xl,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: COLORS.border,
      alignSelf: 'center',
      marginBottom: SPACING.md,
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
    sheetIcon: { width: 44, height: 44, borderRadius: 22 },
    sheetName: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text },
    sheetSymbol: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: 2 },
    rankBadge: {
      backgroundColor: COLORS.surface,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    rankBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
    sheetChartWrap: { alignItems: 'center', marginBottom: SPACING.md },
    sheetPriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    sheetPrice: { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
    statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
    statCard: {
      flex: 1,
      backgroundColor: COLORS.background,
      borderRadius: 12,
      padding: SPACING.sm,
    },
    statLabel: { fontSize: 11, color: COLORS.textTertiary, marginBottom: 2 },
    statValue: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
    sheetCloseBtn: {
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: COLORS.background,
    },
    sheetCloseBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
  });

export default MarketsScreen;
