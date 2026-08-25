// components/dao/details/OverviewTab.js
import React from "react";
import { Animated, View, StyleSheet } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import { DAOInfoCard } from "./DAOInfoCard";
import { DAOStatsGrid } from "./DAOStatsGrid";
import { GovernanceParamsCard } from "./GovernanceParamCard";
import { TreasuryCard } from "./TreasuryCard";

export const OverviewTab = ({
  daoInfo,
  genreId,
  tokenInfo,
  chainExplorer,
  totalProposals,
  activeProposals,
  getTreasuryBalance,
  userInfo,
  onScroll, // ← received from DAODetailsScreen
  scrollEventThrottle, // ← received from DAODetailsScreen
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <Animated.ScrollView // ← was ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll} // ← drives the header animation
      scrollEventThrottle={scrollEventThrottle ?? 16} // ← must be 16
    >
      {/* DAO Info Card */}
      <DAOInfoCard
        daoInfo={daoInfo}
        chainExplorer={chainExplorer}
        genreId={genreId}
      />

      {/* Stats Grid */}
      <DAOStatsGrid
        totalProposals={totalProposals}
        activeProposals={activeProposals}
        members={0}
        treasuryBalance="0"
        tokenSymbol={userInfo?.tokenSymbol}
      />

      {/* Governance Parameters */}
      <GovernanceParamsCard
        daoInfo={daoInfo}
        tokenSymbol={userInfo?.tokenSymbol}
      />

      {/* Treasury */}
      <TreasuryCard
        getTreasuryBalance={getTreasuryBalance}
        tokenSymbol={userInfo?.tokenSymbol}
      />

      <View style={styles.bottomSpacer} />
    </Animated.ScrollView>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    bottomSpacer: {
      height: theme.SPACING.xl,
    },
  });
