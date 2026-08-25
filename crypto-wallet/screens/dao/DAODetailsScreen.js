// screens/dao/DAODetailsScreen.js
import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { useDAOContract } from "../../hooks/useDAOContract";
import { useChain } from "../../contexts/ChainContext";
import { DAODetailsHeader } from "../../components/dao/details/DAODetailsHeader";
import { TabBar } from "../../components/dao/details/TabBar";
import { ActiveProposalsTab } from "../../components/dao/details/ActiveProposalTab";
import { PastProposalsTab } from "../../components/dao/details/PastProposalTab";
import { UserStatisticsTab } from "../../components/dao/details/UserStatisticTab";
import { OverviewTab } from "../../components/dao/details/OverviewTab";

const { width } = Dimensions.get("window");
const HEADER_MAX_HEIGHT = 280;
const HEADER_MIN_HEIGHT = 100;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

const DAODetailsScreen = ({ route, navigation }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { daoAddress, daoGenre } = route.params;
  const { chainExplorer } = useChain();

  const [activeTab, setActiveTab] = useState("overview");
  const scrollY = useRef(new Animated.Value(0)).current;

  const {
    daoInfo,
    userInfo,
    isLoading,
    isSyncing,
    error,
    totalProposals,
    activeProposalsCount,
    isTokenHolder,
    getTreasuryBalance,
    refresh,
  } = useDAOContract(daoAddress);

  const handleBack = () => navigation.goBack();

  // ─── Shared scroll handler passed to every tab ───────────────────────────
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false },
  );

  // Reset header height when user switches tabs
  const handleTabChange = (tab) => {
    scrollY.setValue(0);
    setActiveTab(tab);
  };

  // ─── Header animations ────────────────────────────────────────────────────
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  });

  const titleScale = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.8],
    extrapolate: "clamp",
  });

  const logoScale = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.6],
    extrapolate: "clamp",
  });

  // ─── Loading / error states ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.COLORS.primary} />
        <Text style={styles.loaderText}>Loading DAO details...</Text>
      </SafeAreaView>
    );
  }

  if (error && !daoInfo) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error Loading DAO</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </SafeAreaView>
    );
  }

  // ─── Tab content ──────────────────────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <OverviewTab
            daoInfo={daoInfo}
            genreId={daoGenre}
            chainExplorer={chainExplorer}
            totalProposals={totalProposals}
            activeProposals={activeProposalsCount}
            getTreasuryBalance={getTreasuryBalance}
            userInfo={userInfo}
            scrollY={scrollY}
            onScroll={onScroll}
            scrollEventThrottle={16}
          />
        );

      case "active":
        return (
          <ActiveProposalsTab
            daoAddress={daoAddress}
            navigation={navigation}
            onScroll={onScroll}
            scrollEventThrottle={16}
          />
        );

      case "past":
        return (
          <PastProposalsTab
            daoAddress={daoAddress}
            navigation={navigation}
            onScroll={onScroll}
            scrollEventThrottle={16}
          />
        );

      case "user":
        return (
          <UserStatisticsTab
            daoAddress={daoAddress}
            onScroll={onScroll}
            scrollEventThrottle={16}
          />
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Animated collapsing header */}
      <Animated.View style={[styles.headerContainer, { height: headerHeight }]}>
        <DAODetailsHeader
          daoInfo={daoInfo}
          onBack={handleBack}
          headerOpacity={headerOpacity}
          titleScale={titleScale}
          logoScale={logoScale}
          genreId={daoGenre}
        />
      </Animated.View>

      {/* Tab bar */}
      <TabBar
        activeTab={activeTab}
        onTabChange={handleTabChange} // ← uses handleTabChange, not setActiveTab
        isTokenHolder={isTokenHolder}
      />

      {/* Tab content */}
      <View style={styles.content}>{renderTabContent()}</View>
    </SafeAreaView>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
    },
    headerContainer: {
      overflow: "hidden",
    },
    loaderContainer: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
      justifyContent: "center",
      alignItems: "center",
      gap: theme.SPACING.md,
    },
    loaderText: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
    },
    errorContainer: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: theme.SPACING.xl,
    },
    errorTitle: {
      fontSize: theme.FONTS.sizes.xl,
      fontWeight: "bold",
      color: theme.COLORS.error,
      marginBottom: theme.SPACING.sm,
    },
    errorMessage: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      textAlign: "center",
    },
    content: {
      flex: 1,
    },
  });

export default DAODetailsScreen;
