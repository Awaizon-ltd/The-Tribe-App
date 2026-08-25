// screens/MyDAOsScreen.js
import React, { useState, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Text,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useMyDAOs } from "../../hooks/useMyDAOs";
import { DAOCard } from "../../components/dao/DAOCard";
import { GenreFilter } from "../../components/dao/GenreFilter";
import TabHeader from "../../components/common/TabHeader";
import UserIcon   from "../../components/common/UserIcon";

const MyDAOsScreen = () => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const navigation = useNavigation();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [viewMode, setViewMode] = useState("list");

  const {
    myDAOs,
    userTokens,
    isLoading,
    isSyncing,
    error,
    totalMyDAOs,
    totalTokens,
    refresh,
    getDAOTokenInfo,
  } = useMyDAOs();

  // Client-side filtering
  const filteredDAOs = useMemo(() => {
    if (!myDAOs) return [];

    return myDAOs.filter((dao) => {
      const nameMatch =
        dao.daoName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? true;

      const genreMatch =
        selectedGenre === null || dao.genreId === selectedGenre;

      return nameMatch && genreMatch;
    });
  }, [myDAOs, searchQuery, selectedGenre]);

  const handleDAOPress = (dao) => {
    navigation.navigate("DAODetails", {
      daoAddress: dao.daoAddress || dao.address,
      chainId: dao.chainId,
      daoGenre: dao.genreId,
    });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedGenre(null);
  };

  const handleViewAllDAOs = () => {
    navigation.navigate("DAOList");
  };

  const handleImportTokens = () => {
    navigation.navigate("TokenImport"); // Or your token import screen
  };

  const renderDAOCard = ({ item }) => {
    const tokenInfo = getDAOTokenInfo(item.daoAddress || item.address);

    return (
      <DAOCard
        dao={item}
        viewMode={viewMode}
        onPress={() => handleDAOPress(item)}
        badge={
          tokenInfo
            ? {
                label: tokenInfo.symbol,
                color: theme.COLORS.success,
              }
            : null
        }
      />
    );
  };

  const renderEmpty = () => {
    // No tokens imported
    if (totalTokens === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="wallet-outline"
            size={80}
            color={theme.COLORS.textSecondary}
          />
          <Text style={styles.emptyTitle}>No Tokens Imported</Text>
          <Text style={styles.emptySubtitle}>
            Import governance tokens to see your DAOs here
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleImportTokens}
          >
            <Ionicons
              name="add-circle"
              size={20}
              color={theme.COLORS.surface}
            />
            <Text style={styles.primaryButtonText}>Import Tokens</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Has tokens but no matching DAOs
    if (searchQuery || selectedGenre !== null) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="search-outline"
            size={80}
            color={theme.COLORS.textSecondary}
          />
          <Text style={styles.emptyTitle}>No DAOs Found</Text>
          <Text style={styles.emptySubtitle}>Try adjusting your filters</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleClearFilters}
          >
            <Text style={styles.secondaryButtonText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Has tokens but no DAOs for those tokens
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="briefcase-outline"
          size={80}
          color={theme.COLORS.textSecondary}
        />
        <Text style={styles.emptyTitle}>No DAOs Found</Text>
        <Text style={styles.emptySubtitle}>
          You have {totalTokens} {totalTokens === 1 ? "token" : "tokens"} but no
          matching DAOs on this network
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleViewAllDAOs}
        >
          <Ionicons
            name="grid-outline"
            size={20}
            color={theme.COLORS.surface}
          />
          <Text style={styles.primaryButtonText}>View All DAOs</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>

      {/* Info Banner - Show when DAOs available */}
      {totalMyDAOs > 0 && (
        <View style={styles.infoBanner}>
          <Ionicons
            name="information-circle"
            size={16}
            color={theme.COLORS.primary}
          />
          <Text style={styles.infoBannerText}>
            These are DAOs where you hold governance tokens
          </Text>
        </View>
      )}

      {/* Search Bar
      {totalMyDAOs > 0 && (
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search your DAOs..."
        />
      )} */}

      {/* Genre Filter */}
      {totalMyDAOs > 0 && (
        <GenreFilter
          selectedGenre={selectedGenre}
          onSelectGenre={setSelectedGenre}
        />
      )}
    </View>
  );

  const myTabHeader = (
    <TabHeader
      title="My Guilds"
      subtitle={`${totalMyDAOs} ${totalMyDAOs === 1 ? 'DAO' : 'DAOs'} · ${totalTokens} ${totalTokens === 1 ? 'Token' : 'Tokens'}`}
      border
      left={<UserIcon onPress={() => navigation.getParent('ProfileDrawer')?.openDrawer()} />}
      rightActions={[
        {
          element: (
            <TouchableOpacity
              style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: theme.COLORS.surface, justifyContent: 'center', alignItems: 'center' }}
              onPress={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
            >
              <Ionicons name={viewMode === 'list' ? 'grid-outline' : 'list-outline'} size={18} color={theme.COLORS.text} />
            </TouchableOpacity>
          ),
        },
      ]}
    />
  );

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        {myTabHeader}
        <View style={styles.loaderContent}>
          <ActivityIndicator size="large" color={theme.COLORS.primary} />
          <Text style={styles.loaderTitle}>Loading Your DAOs</Text>
          <Text style={styles.loaderSubtitle}>Checking your tokens and DAOs...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loaderContainer}>
        {myTabHeader}
        <View style={styles.loaderContent}>
          <Ionicons name="warning-outline" size={80} color={theme.COLORS.error} />
          <Text style={styles.errorTitle}>Error Loading DAOs</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={refresh}>
            <Ionicons name="refresh" size={20} color={theme.COLORS.surface} />
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {myTabHeader}
      <FlatList
        data={filteredDAOs}
        keyExtractor={(item, index) =>
          `${item.daoAddress || item.address}-${index}`
        }
        numColumns={viewMode === "grid" ? 2 : 1}
        key={viewMode}
        contentContainerStyle={[
          styles.listContent,
          filteredDAOs.length === 0 && styles.emptyListContent,
        ]}
        columnWrapperStyle={viewMode === "grid" ? styles.row : null}
        showsVerticalScrollIndicator={false}
        renderItem={renderDAOCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={refresh}
            colors={[theme.COLORS.primary]}
            tintColor={theme.COLORS.primary}
          />
        }
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
    loaderContainer: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
    },
    loaderContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
    },
    loaderTitle: {
      color: theme.COLORS.text,
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: "600",
      textAlign: "center",
      marginTop: theme.SPACING.lg,
      marginBottom: theme.SPACING.xs,
    },
    loaderSubtitle: {
      color: theme.COLORS.textSecondary,
      fontSize: theme.FONTS.sizes.md,
      textAlign: "center",
    },
    errorTitle: {
      color: theme.COLORS.error,
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: "600",
      textAlign: "center",
      marginTop: theme.SPACING.lg,
      marginBottom: theme.SPACING.xs,
    },
    errorSubtitle: {
      color: theme.COLORS.textSecondary,
      fontSize: theme.FONTS.sizes.md,
      textAlign: "center",
      marginBottom: theme.SPACING.lg,
    },
    headerContainer: {
      paddingHorizontal: 0,
      paddingTop: theme.SPACING.lg,
      paddingBottom: theme.SPACING.md,
      backgroundColor: theme.COLORS.background,
    },
    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.SPACING.md,
    },
    titleSection: {
      flex: 1,
    },
    title: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: "bold",
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.xs,
    },
    subtitle: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
    },
    viewModeContainer: {
      flexDirection: "row",
      backgroundColor: theme.COLORS.surface,
      borderRadius: 8,
      padding: 4,
    },
    viewModeButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
    },
    viewModeButtonActive: {
      backgroundColor: theme.COLORS.primary,
    },
    infoBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.SPACING.sm,
      padding: theme.SPACING.md,
      backgroundColor: `${theme.COLORS.primary}15`,
      borderRadius: 8,
      marginBottom: theme.SPACING.xs,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    infoBannerText: {
      flex: 1,
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
    },
    listContent: {
      paddingHorizontal: theme.SPACING.md,
      paddingBottom: 110,
    },
    emptyListContent: {
      flexGrow: 1,
    },
    row: {
      justifyContent: "space-between",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: theme.SPACING.lg,
      paddingVertical: theme.SPACING.xlg * 2,
    },
    emptyTitle: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: "bold",
      color: theme.COLORS.text,
      marginTop: theme.SPACING.lg,
      marginBottom: theme.SPACING.xs,
    },
    emptySubtitle: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      textAlign: "center",
      marginBottom: theme.SPACING.lg,
    },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.SPACING.sm,
      paddingVertical: theme.SPACING.md,
      paddingHorizontal: theme.SPACING.lg,
      backgroundColor: theme.COLORS.primary,
      borderRadius: 8,
      marginBottom: theme.SPACING.sm,
    },
    primaryButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "600",
      color: theme.COLORS.surface,
    },
    secondaryButton: {
      paddingVertical: theme.SPACING.md,
      paddingHorizontal: theme.SPACING.lg,
      backgroundColor: theme.COLORS.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    secondaryButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "600",
      color: theme.COLORS.text,
    },
  });

export default MyDAOsScreen;
