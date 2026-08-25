// screens/dao/DAOListScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Text,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ChainIcon from '../../components/common/ChainIcon';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useChain } from '../../contexts/ChainContext';
import { useDAOFactory } from '../../hooks/useDaoFactory';
import TabHeader from '../../components/common/TabHeader';
import UserIcon   from '../../components/common/UserIcon';
import { SearchBar } from '../../components/dao/SearchDAO';
import { GenreFilter } from '../../components/dao/GenreFilter';
import { EmptyState } from '../../components/dao/EmptyState';
import { DAOCard } from '../../components/dao/DAOCard';
import ChainSwitcher from '../../components/wallet/ChainSwitcher';

const DAOListScreen = () => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const navigation = useNavigation();

  const { activeChain, isTestnet, chainName } = useChain();

  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedGenre, setSelectedGenre]       = useState(null);
  const [viewMode, setViewMode]                 = useState('list');
  const [showChainSwitcher, setShowChainSwitcher] = useState(false);

  const {
    deployedDAOs,
    totalDAOs,
    isLoading,
    isSyncingBackground,
    error,
    refresh,
    searchDAOs,
    fetchDAOsByGenre,
    clearFilters,
  } = useDAOFactory();

  // ─── Search (debounced) ───────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchDAOs(searchQuery);
      } else if (selectedGenre === null) {
        clearFilters();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ─── Genre filter ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedGenre !== null) {
      fetchDAOsByGenre(selectedGenre);
    } else if (!searchQuery.trim()) {
      clearFilters();
    }
  }, [selectedGenre]);

  // Reset filters when chain changes
  useEffect(() => {
    setSearchQuery('');
    setSelectedGenre(null);
  }, [activeChain.id]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleDAOPress = useCallback((dao) => {
    navigation.navigate('DAODetails', {
      daoAddress: dao.daoAddress || dao.address,
      chainId:    dao.chainId,
      daoGenre:   dao.genreId,
    });
  }, [navigation]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedGenre(null);
    clearFilters();
  }, [clearFilters]);

  // ─── Chain selector button ────────────────────────────────────────────────
  const ChainButton = (
    <TouchableOpacity
      style={[styles.chainBtn, isTestnet && styles.chainBtnTestnet]}
      onPress={() => setShowChainSwitcher(true)}
      activeOpacity={0.75}
    >
      <ChainIcon chain={activeChain} size={16} style={styles.chainIcon} />
      <Text style={[styles.chainBtnText, isTestnet && styles.chainBtnTextTestnet]}>
        {activeChain.symbol}
      </Text>
      {isTestnet && (
        <View style={styles.testnetPill}>
          <Text style={styles.testnetPillText}>TEST</Text>
        </View>
      )}
      <Ionicons
        name="chevron-down"
        size={12}
        color={isTestnet ? theme.COLORS.warning : theme.COLORS.textSecondary}
      />
    </TouchableOpacity>
  );

  // ─── Subtitle ─────────────────────────────────────────────────────────────
  const subtitle = (() => {
    const count = `${totalDAOs} ${totalDAOs === 1 ? 'community' : 'communities'}`;
    const chain = `on ${chainName}`;
    const syncing = isSyncingBackground ? ' · syncing…' : '';
    return `${count} ${chain}${syncing}`;
  })();

  // ─── Render item ──────────────────────────────────────────────────────────
  const renderDAO = useCallback(({ item }) => (
    <DAOCard
      dao={item}
      viewMode={viewMode}
      onPress={() => handleDAOPress(item)}
    />
  ), [viewMode, handleDAOPress]);

  const keyExtractor = useCallback((item, idx) =>
    `${item.daoAddress || item.address}-${idx}`,
  []);

  // ─── Loading screen ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <TabHeader
          title="Communities"
          subtitle={`Loading ${chainName}…`}
          border
          left={<UserIcon onPress={() => navigation.getParent('ProfileDrawer')?.openDrawer()} />}
          rightActions={[{ element: ChainButton }]}
        />
        <View style={styles.loadingBody}>
          <ActivityIndicator size="large" color={theme.COLORS.primary} />
          <Text style={styles.loadingText}>Loading communities…</Text>
        </View>
      </View>
    );
  }

  // ─── Error screen ─────────────────────────────────────────────────────────
  if (error && deployedDAOs.length === 0) {
    return (
      <View style={styles.container}>
        <TabHeader
          title="Communities"
          border
          left={<UserIcon onPress={() => navigation.getParent('ProfileDrawer')?.openDrawer()} />}
          rightActions={[{ element: ChainButton }]}
        />
        <View style={styles.errorBody}>
          <Ionicons name="cloud-offline-outline" size={56} color={theme.COLORS.textSecondary} />
          <Text style={styles.errorTitle}>Could not load communities</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.8}>
            <Ionicons name="refresh" size={16} color={theme.COLORS.surface} />
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Main view ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <TabHeader
        title="Community"
        // subtitle={subtitle}
        border
        left={
    <View style={{ transform: [{ scale: 0.8 }] }}>
      <UserIcon onPress={() => navigation.getParent('ProfileDrawer')?.openDrawer()} />
    </View>
  }
        rightActions={[
          {
            element: (
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
                >
                  <Ionicons
                    name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
                    size={18}
                    color={theme.COLORS.text}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.createBtn}
                  onPress={() => navigation.navigate('LaunchDAO')}
                >
                  <Ionicons name="add" size={20} color={theme.COLORS.surface} />
                </TouchableOpacity>

                {ChainButton}
              </View>
            ),
          },
        ]}
      />

      {/* Testnet banner */}
      {isTestnet && (
        <View style={styles.testnetBanner}>
          <Ionicons name="flask-outline" size={14} color={theme.COLORS.warning} />
          <Text style={styles.testnetBannerText}>
            Testnet — {chainName} · Communities here are for testing only
          </Text>
        </View>
      )}

      {/* Search */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={`Search communities on ${chainName}…`}
      />

      {/* Genre filter */}
      <GenreFilter
        selectedGenre={selectedGenre}
        onSelectGenre={setSelectedGenre}
      />

      {/* List */}
      <FlatList
        data={deployedDAOs}
        keyExtractor={keyExtractor}
        renderItem={renderDAO}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        contentContainerStyle={[
          styles.listContent,
          deployedDAOs.length === 0 && styles.listContentEmpty,
        ]}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : null}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            searchQuery={searchQuery}
            selectedGenre={selectedGenre}
            chainName={chainName}
            isTestnet={isTestnet}
            onClearFilters={handleClearFilters}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isSyncingBackground}
            onRefresh={refresh}
            tintColor={theme.COLORS.primary}
            colors={[theme.COLORS.primary]}
          />
        }
      />

      {/* Floating sync indicator — only while list has content */}
      {isSyncingBackground && deployedDAOs.length > 0 && (
        <View style={styles.syncBadge}>
          <ActivityIndicator size="small" color={theme.COLORS.primary} />
          <Text style={styles.syncBadgeText}>Syncing…</Text>
        </View>
      )}

      {/* Chain switcher modal */}
      <ChainSwitcher
        visible={showChainSwitcher}
        onClose={() => setShowChainSwitcher(false)}
      />
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
    },
    centered: {
      flex: 1,
    },

    // ─── Header actions ─────────────────────────────────────────────────────
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: theme.COLORS.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    createBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: theme.COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ─── Chain selector button ───────────────────────────────────────────────
    chainBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.COLORS.surface,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      gap: 4,
      height: 36,
    },
    chainBtnTestnet: {
      borderColor: theme.COLORS.warning + '60',
      backgroundColor: theme.COLORS.warning + '10',
    },
    chainIcon: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    chainBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.COLORS.text,
    },
    chainBtnTextTestnet: {
      color: theme.COLORS.warning,
    },
    testnetPill: {
      backgroundColor: theme.COLORS.warning,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    testnetPillText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.5,
    },

    // ─── Testnet banner ──────────────────────────────────────────────────────
    testnetBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.COLORS.warning + '15',
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.warning + '30',
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: 7,
    },
    testnetBannerText: {
      fontSize: 12,
      color: theme.COLORS.warning,
      fontWeight: '500',
      flex: 1,
    },

    // ─── List ────────────────────────────────────────────────────────────────
    listContent: {
      paddingHorizontal: theme.SPACING.md,
      paddingTop: theme.SPACING.sm,
      paddingBottom: 110,
    },
    listContentEmpty: {
      flexGrow: 1,
    },
    gridRow: {
      justifyContent: 'space-between',
    },

    // ─── Loading ─────────────────────────────────────────────────────────────
    loadingBody: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: theme.SPACING.md,
    },
    loadingText: {
      color: theme.COLORS.textSecondary,
      fontSize: theme.FONTS.sizes.sm,
    },

    // ─── Error ───────────────────────────────────────────────────────────────
    errorBody: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.SPACING.xl,
      gap: theme.SPACING.md,
    },
    errorTitle: {
      color: theme.COLORS.text,
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: '600',
      textAlign: 'center',
    },
    errorSubtitle: {
      color: theme.COLORS.textSecondary,
      fontSize: theme.FONTS.sizes.sm,
      textAlign: 'center',
      lineHeight: 20,
    },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.COLORS.primary,
      paddingHorizontal: theme.SPACING.lg,
      paddingVertical: theme.SPACING.sm + 2,
      borderRadius: theme.BORDER_RADIUS.xl,
      marginTop: theme.SPACING.sm,
    },
    retryBtnText: {
      color: theme.COLORS.surface,
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: '600',
    },

    // ─── Floating sync badge ─────────────────────────────────────────────────
    syncBadge: {
      position: 'absolute',
      bottom: 20,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.COLORS.card,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      borderRadius: 20,
      ...theme.SHADOWS.medium,
    },
    syncBadgeText: {
      color: theme.COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '500',
    },
  });

export default DAOListScreen;
