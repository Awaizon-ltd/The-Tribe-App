// screens/wallet/SearchScreen.js
// Global multichain search — the separate circular button next to wallet
// mode's pill nav. Pushed as a stack screen (not a tab), has its own back
// button. Classifies the query into one of three result types:
//   1. A raw address or an ENS name → resolves to a single "Address" card
//      with quick Copy/Send actions (same ENS resolution approach already
//      used in SendScreen.js).
//   2. A chain name/symbol match (e.g. "Ethereum", "AVAX") → a row per
//      matching chain, tapping opens the same TokenDetail flow Home's asset
//      list uses.
//   3. Otherwise, a token search: local static token lists
//      (utils/token/TokenListUtil.js, chain-tagged) plus CoinGecko's
//      /search (via the Phase-1 backend proxy) for anything beyond those
//      lists. Tapping opens an inline preview sheet rather than routing into
//      TokenDetailScreen, which only resolves prices by a small hardcoded
//      native-symbol map and would silently show blank data for arbitrary
//      ERC-20s or CoinGecko-only matches.
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { JsonRpcProvider } from 'ethers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../contexts/ThemeContext';
import { useWallet } from '../../contexts/WalletContext';
import AppHeader from '../../components/common/AppHeader';
import ChainIcon from '../../components/common/ChainIcon';
import { useAvailableChains } from '../../hooks/useAvailableChains';
import { validateAddress } from '../../utils/Validators';
import { formatAddress } from '../../utils/Wallet';
import { getTokenBalance } from '../../utils/blockchain';
import {
  searchTokens,
  hasTokensForChain,
} from '../../utils/token/TokenListUtil';
import {
  fetchTrendingCoins,
  searchCoins,
  getCoinPrices,
  getAllNativePricesByChainId,
} from '../../services/CoinGeckoService';
import Alert from '../../utils/Alert';

// Same ENS approach as SendScreen.js — a dedicated public RPC, since ENS
// only resolves against Ethereum mainnet regardless of the wallet's active
// chain.
const ENS_SUFFIXES = ['.eth', '.xyz', '.app', '.luxe', '.art'];
const isEns = (s) => ENS_SUFFIXES.some((sfx) => s.toLowerCase().endsWith(sfx));
const resolveEns = async (name) => {
  try {
    const provider = new JsonRpcProvider('https://eth.llamarpc.com');
    return await provider.resolveName(name);
  } catch {
    return null;
  }
};

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const SearchScreen = ({ navigation }) => {
  const { COLORS, FONTS, SPACING } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(COLORS, FONTS, SPACING);
  const { wallet } = useWallet();
  const { availableChains } = useAvailableChains();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 350);
  const [searching, setSearching] = useState(false);

  const [addressResult, setAddressResult] = useState(null); // { address, ensName }
  const [ensNotFound, setEnsNotFound] = useState(false);
  const [chainMatches, setChainMatches] = useState([]);
  const [localTokenMatches, setLocalTokenMatches] = useState([]); // [{ ...token, chain }]
  const [remoteMatches, setRemoteMatches] = useState([]); // CoinGecko /search results

  const [trending, setTrending] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [nativePrices, setNativePrices] = useState({});

  const [previewItem, setPreviewItem] = useState(null); // { type, ... }

  // Empty-state trending row + native prices (for chain-match navigation),
  // fetched once — both already cache client- and server-side.
  useEffect(() => {
    let cancelled = false;
    fetchTrendingCoins(10).then((coins) => {
      if (!cancelled) {
        setTrending(coins);
        setLoadingTrending(false);
      }
    });
    getAllNativePricesByChainId().then((prices) => {
      if (!cancelled) setNativePrices(prices);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = debouncedQuery.trim();

    setAddressResult(null);
    setEnsNotFound(false);
    setChainMatches([]);
    setLocalTokenMatches([]);
    setRemoteMatches([]);

    if (!q) {
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const run = async () => {
      // 1. Raw address
      if (validateAddress(q).isValid) {
        if (!cancelled) setAddressResult({ address: q, ensName: null });
        if (!cancelled) setSearching(false);
        return;
      }

      // 2. ENS name
      if (isEns(q)) {
        const resolved = await resolveEns(q);
        if (cancelled) return;
        if (resolved) {
          setAddressResult({ address: resolved, ensName: q });
        } else {
          setEnsNotFound(true);
        }
        setSearching(false);
        return;
      }

      // 3. Chain name/symbol matches
      const lower = q.toLowerCase();
      const chains = availableChains.filter(
        (c) => c.name.toLowerCase().includes(lower) || c.symbol.toLowerCase().includes(lower),
      );
      if (!cancelled) setChainMatches(chains);

      // 4. Local token-list matches, tagged with their chain
      const local = availableChains
        .filter((c) => hasTokensForChain(c.id))
        .flatMap((c) => searchTokens(c.id, q).map((t) => ({ ...t, chain: c })))
        .slice(0, 25);
      if (!cancelled) setLocalTokenMatches(local);

      // 5. CoinGecko search, for tokens beyond the local static lists
      const remote = await searchCoins(q);
      if (!cancelled) {
        // Skip anything that's a duplicate of a symbol we already matched
        // locally, so the same token doesn't visually appear twice.
        const localSymbols = new Set(local.map((t) => t.symbol.toLowerCase()));
        setRemoteMatches(remote.filter((c) => !localSymbols.has(c.symbol.toLowerCase())));
        setSearching(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, availableChains]);

  const copyAddress = async (address) => {
    await Clipboard.setStringAsync(address);
    Alert.alert('Address copied!');
  };

  const openChainResult = (chain) => {
    const priceData = nativePrices[chain.id];
    navigation.navigate('TokenDetail', {
      chain,
      balance: '0',
      usdValue: 0,
      price: priceData?.usd || 0,
      priceChange24h: priceData?.usd_24h_change,
      walletAddress: wallet?.address,
    });
  };

  const hasQuery = debouncedQuery.trim().length > 0;
  const hasAnyResults =
    !!addressResult || chainMatches.length > 0 || localTokenMatches.length > 0 || remoteMatches.length > 0;

  return (
    <View style={styles.container}>
      <AppHeader title="Search" onBack={() => navigation.goBack()} />

      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tokens, addresses, or ENS names"
            placeholderTextColor={COLORS.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>
            )
          )}
        </View>
      </View>

      <ScrollView
        style={styles.results}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {!hasQuery && (
          <View style={styles.emptyState}>
            <Text style={styles.sectionLabel}>Trending</Text>
            {loadingTrending ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: SPACING.md }} />
            ) : (
              <View style={styles.trendingChips}>
                {trending.map((coin) => (
                  <TouchableOpacity
                    key={coin.id}
                    style={styles.trendingChip}
                    onPress={() => setQuery(coin.symbol.toUpperCase())}
                  >
                    <Image source={{ uri: coin.image }} style={styles.trendingChipIcon} />
                    <Text style={styles.trendingChipText}>{coin.symbol.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.emptyHint}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.textTertiary} />
              <Text style={styles.emptyHintText}>
                Paste an address or ENS name, or search any token or chain.
              </Text>
            </View>
          </View>
        )}

        {hasQuery && !searching && !hasAnyResults && !ensNotFound && (
          <View style={styles.noResults}>
            <Ionicons name="search-outline" size={32} color={COLORS.textTertiary} />
            <Text style={styles.noResultsText}>No results for "{debouncedQuery}"</Text>
          </View>
        )}

        {ensNotFound && (
          <View style={styles.noResults}>
            <Ionicons name="alert-circle-outline" size={32} color={COLORS.textTertiary} />
            <Text style={styles.noResultsText}>Couldn't resolve "{debouncedQuery}"</Text>
          </View>
        )}

        {addressResult && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Address</Text>
            <View style={styles.addressCard}>
              <View style={styles.addressIconCircle}>
                <Ionicons name="wallet-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                {addressResult.ensName && (
                  <Text style={styles.addressEns}>{addressResult.ensName}</Text>
                )}
                <Text style={styles.addressText} numberOfLines={1}>
                  {formatAddress(addressResult.address)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addressAction}
                onPress={() => copyAddress(addressResult.address)}
              >
                <Ionicons name="copy-outline" size={18} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addressAction, { backgroundColor: COLORS.primary }]}
                onPress={() => navigation.navigate('Send', { recipient: addressResult.address })}
              >
                <Ionicons name="paper-plane-outline" size={18} color="#0a0a0a" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {chainMatches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Chains</Text>
            {chainMatches.map((chain) => (
              <TouchableOpacity
                key={chain.id}
                style={styles.resultRow}
                onPress={() => openChainResult(chain)}
                activeOpacity={0.65}
              >
                <ChainIcon chain={chain} size={36} style={styles.resultIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{chain.name}</Text>
                  <Text style={styles.resultSub}>{chain.symbol}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {(localTokenMatches.length > 0 || remoteMatches.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tokens</Text>
            {localTokenMatches.map((t) => (
              <TouchableOpacity
                key={`${t.chain.id}-${t.address}`}
                style={styles.resultRow}
                onPress={() => setPreviewItem({ type: 'localToken', ...t })}
                activeOpacity={0.65}
              >
                {t.logoURI ? (
                  <Image source={{ uri: t.logoURI }} style={styles.resultIcon} />
                ) : (
                  <View style={[styles.resultIcon, styles.resultIconFallback]}>
                    <Text style={styles.resultIconFallbackText}>
                      {t.symbol?.charAt(0)?.toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{t.name}</Text>
                  <View style={styles.resultSubRow}>
                    <Text style={styles.resultSub}>{t.symbol}</Text>
                    <View style={styles.chainBadge}>
                      <ChainIcon chain={t.chain} size={12} style={{ borderRadius: 6 }} />
                      <Text style={styles.chainBadgeText}>{t.chain.name}</Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>
            ))}
            {remoteMatches.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.resultRow}
                onPress={() => setPreviewItem({ type: 'coingecko', ...c })}
                activeOpacity={0.65}
              >
                {c.thumb ? (
                  <Image source={{ uri: c.thumb }} style={styles.resultIcon} />
                ) : (
                  <View style={[styles.resultIcon, styles.resultIconFallback]}>
                    <Text style={styles.resultIconFallbackText}>
                      {c.symbol?.charAt(0)?.toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{c.name}</Text>
                  <Text style={styles.resultSub}>{c.symbol?.toUpperCase()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <TokenPreviewSheet
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        walletAddress={wallet?.address}
        styles={styles}
        COLORS={COLORS}
      />
    </View>
  );
};

// ─── Preview sheet ──────────────────────────────────────────────────────────
// Shown for search results that don't map to a real Home/TokenDetail flow —
// a local ERC-20 match (fetches live on-chain balance for the tapped token
// only) or a CoinGecko-only match (fetches its current price). Kept
// self-contained here rather than routed into TokenDetailScreen, which only
// resolves prices via a small hardcoded native-symbol map.
const TokenPreviewSheet = ({ item, onClose, walletAddress, styles, COLORS }) => {
  const [balance, setBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [price, setPrice] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  useEffect(() => {
    setBalance(null);
    setPrice(null);
    if (!item) return;

    if (item.type === 'localToken' && walletAddress) {
      setLoadingBalance(true);
      getTokenBalance(item.address, walletAddress, item.chain)
        .then((b) => setBalance(b))
        .catch(() => setBalance(null))
        .finally(() => setLoadingBalance(false));
    }

    if (item.type === 'coingecko') {
      setLoadingPrice(true);
      getCoinPrices(item.id)
        .then((p) => setPrice(p?.[item.id] || null))
        .catch(() => setPrice(null))
        .finally(() => setLoadingPrice(false));
    }
  }, [item]);

  if (!item) return null;

  const copy = async (text) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!');
  };

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            {item.logoURI || item.thumb ? (
              <Image source={{ uri: item.logoURI || item.thumb }} style={styles.sheetIcon} />
            ) : (
              <View style={[styles.sheetIcon, styles.resultIconFallback]}>
                <Text style={styles.resultIconFallbackText}>{item.symbol?.charAt(0)?.toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetName}>{item.name}</Text>
              <Text style={styles.sheetSymbol}>{item.symbol?.toUpperCase()}</Text>
            </View>
          </View>

          {item.type === 'localToken' && (
            <>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>Chain</Text>
                <View style={styles.chainBadge}>
                  <ChainIcon chain={item.chain} size={14} style={{ borderRadius: 7 }} />
                  <Text style={styles.chainBadgeText}>{item.chain.name}</Text>
                </View>
              </View>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>Your balance</Text>
                {loadingBalance ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.sheetRowValue}>
                    {balance ? `${parseFloat(balance.formatted).toFixed(4)} ${item.symbol}` : '—'}
                  </Text>
                )}
              </View>
              <TouchableOpacity style={styles.sheetCopyRow} onPress={() => copy(item.address)}>
                <Text style={styles.sheetCopyText} numberOfLines={1}>{item.address}</Text>
                <Ionicons name="copy-outline" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </>
          )}

          {item.type === 'coingecko' && (
            <>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>Price (USD)</Text>
                {loadingPrice ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.sheetRowValue}>
                    {price?.usd != null ? `$${price.usd.toLocaleString()}` : 'Unavailable'}
                  </Text>
                )}
              </View>
              {item.marketCapRank && (
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetRowLabel}>Market cap rank</Text>
                  <Text style={styles.sheetRowValue}>#{item.marketCapRank}</Text>
                </View>
              )}
              <Text style={styles.sheetFootnote}>
                Not on any of your available chains — informational only.
              </Text>
            </>
          )}

          <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
            <Text style={styles.sheetCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
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
      height: 46,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    searchInput: { flex: 1, fontSize: FONTS.sizes.md, color: COLORS.text },

    results: { flex: 1, paddingHorizontal: SPACING.md },

    section: { marginTop: SPACING.lg },
    sectionLabel: {
      fontSize: FONTS.sizes.xs,
      fontWeight: '700',
      color: COLORS.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: SPACING.sm,
    },

    emptyState: { marginTop: SPACING.md },
    trendingChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    trendingChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: COLORS.surface,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    trendingChipIcon: { width: 18, height: 18, borderRadius: 9 },
    trendingChipText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.text },
    emptyHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: SPACING.xl,
      paddingHorizontal: SPACING.xs,
    },
    emptyHintText: { flex: 1, fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, lineHeight: 17 },

    noResults: { alignItems: 'center', marginTop: SPACING.xxl, gap: SPACING.sm },
    noResultsText: { fontSize: FONTS.sizes.sm, color: COLORS.textTertiary },

    addressCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    addressIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: COLORS.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addressEns: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
    addressText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
    addressAction: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: COLORS.background,
      alignItems: 'center',
      justifyContent: 'center',
    },

    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: 10,
    },
    resultIcon: { width: 36, height: 36, borderRadius: 18 },
    resultIconFallback: { backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
    resultIconFallbackText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textSecondary },
    resultName: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
    resultSub: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: 2 },
    resultSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    chainBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: COLORS.background,
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    chainBadgeText: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },

    // ── Preview sheet ──
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
    sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
    sheetIcon: { width: 44, height: 44, borderRadius: 22 },
    sheetName: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text },
    sheetSymbol: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: 2 },
    sheetRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.divider,
    },
    sheetRowLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
    sheetRowValue: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
    sheetCopyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
      marginTop: SPACING.sm,
      backgroundColor: COLORS.background,
      borderRadius: 10,
      paddingHorizontal: SPACING.md,
      paddingVertical: 10,
    },
    sheetCopyText: { flex: 1, fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
    sheetFootnote: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: SPACING.sm, lineHeight: 17 },
    sheetCloseBtn: {
      marginTop: SPACING.lg,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: COLORS.background,
    },
    sheetCloseBtnText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
  });

export default SearchScreen;
