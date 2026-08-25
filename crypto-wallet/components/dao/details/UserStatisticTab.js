// components/dao/details/UserStatisticsTab.js
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../common/Card';
import { useDAOContract } from '../../../hooks/useDAOContract';
import { calculateVotingPower, formatVotingPower } from '../../../utils/VoteCalculation';
import { useTheme } from '../../../contexts/ThemeContext'; // Adjust path as needed

export const UserStatisticsTab = ({ daoAddress }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  
  const {
    userInfo,
    daoInfo,
    isLoading,
    isSyncing,
    error,
    refresh,
    isTokenHolder,
    canCreateProposal,
  } = useDAOContract(daoAddress);

  // Calculate quadratic voting power from token balance
  const votingPower = useMemo(() => {
    if (!userInfo) return null;

    try {
      const balance = userInfo.tokenBalance || '0';
      const decimals = userInfo.tokenDecimals || 18;
      
      // Calculate voting power: √balance
      const power = calculateVotingPower(balance, decimals);
      
      // Format balance for display
      const balanceFormatted = userInfo.tokenBalanceFormatted || '0';

      return {
        balance: balanceFormatted,
        power: formatVotingPower(power, 2),
        powerRaw: power,
        symbol: userInfo.tokenSymbol || 'tokens',
        decimals,
      };
    } catch (err) {
      console.error('[UserStatistics] Error calculating voting power:', err);
      return null;
    }
  }, [userInfo]);

  // Calculate delegation power if receiving votes
  const delegationPower = useMemo(() => {
    if (!userInfo || !userInfo.receivedVotes || userInfo.delegatorsCount === 0) {
      return null;
    }

    try {
      const receivedVotes = userInfo.receivedVotes || '0';
      const decimals = userInfo.tokenDecimals || 18;
      
      // Calculate additional power from delegation
      const additionalPower = calculateVotingPower(receivedVotes, decimals);
      
      return {
        additional: formatVotingPower(additionalPower, 2),
        additionalRaw: additionalPower,
        delegatorsCount: userInfo.delegatorsCount,
        receivedVotesFormatted: userInfo.receivedVotesFormatted || '0',
      };
    } catch (err) {
      console.error('[UserStatistics] Error calculating delegation power:', err);
      return null;
    }
  }, [userInfo]);

  const handleRefresh = async () => {
    await refresh();
  };

  // Show loading during initial load OR refresh
  if (isLoading || (isSyncing && !votingPower)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.COLORS.primary} />
        <Text style={styles.loadingText}>
          {isLoading ? 'Loading your statistics...' : 'Refreshing...'}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="warning-outline" size={64} color={theme.COLORS.error} />
        <Text style={styles.emptyText}>Error Loading Statistics</Text>
        <Text style={styles.emptySubtext}>{error}</Text>
      </View>
    );
  }

  if (!userInfo || !isTokenHolder) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="wallet-outline" size={64} color={theme.COLORS.textSecondary} />
        <Text style={styles.emptyText}>No Tokens Held</Text>
        <Text style={styles.emptySubtext}>
          You need to hold {daoInfo?.name} tokens to participate in governance
        </Text>
      </View>
    );
  }

  if (!votingPower) {
    return null;
  }

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl 
          refreshing={isSyncing} 
          onRefresh={handleRefresh} 
          tintColor={theme.COLORS.primary} 
        />
      }
    >
      {/* Status Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Status</Text>
        
        <View style={styles.statusGrid}>
          {/* Token Holder Status */}
          <Card style={[styles.statusCard, isTokenHolder && styles.statusCardActive]}>
            <Ionicons 
              name={isTokenHolder ? "checkmark-circle" : "close-circle"} 
              size={32} 
              color={isTokenHolder ? theme.COLORS.success : theme.COLORS.error} 
            />
            <Text style={styles.statusLabel}>Token Holder</Text>
            <Text style={[styles.statusValue, { color: isTokenHolder ? theme.COLORS.success : theme.COLORS.error }]}>
              {isTokenHolder ? 'Yes' : 'No'}
            </Text>
          </Card>

          {/* Can Create Proposals */}
          <Card style={[styles.statusCard, canCreateProposal && styles.statusCardActive]}>
            <Ionicons 
              name={canCreateProposal ? "checkmark-circle" : "close-circle"} 
              size={32} 
              color={canCreateProposal ? theme.COLORS.success : theme.COLORS.error} 
            />
            <Text style={styles.statusLabel}>Can Propose</Text>
            <Text style={[styles.statusValue, { color: canCreateProposal ? theme.COLORS.success : theme.COLORS.error }]}>
              {canCreateProposal ? 'Yes' : 'No'}
            </Text>
          </Card>
        </View>
      </View>

      {/* Voting Power */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Voting Power</Text>
        
        {/* Explanation */}
        <Card style={styles.explanationCard}>
          <View style={styles.explanationHeader}>
            <Ionicons name="information-circle" size={20} color={theme.COLORS.primary} />
            <Text style={styles.explanationTitle}>Quadratic Voting</Text>
          </View>
          <Text style={styles.explanationText}>
            Voting power = √(token balance). This reduces whale influence and ensures fairer governance.
          </Text>
        </Card>

        {/* Power Display */}
        <Card style={styles.powerCard}>
          <View style={styles.powerRow}>
            {/* Token Balance */}
            <View style={styles.powerItem}>
              <View style={styles.iconContainer}>
                <Ionicons name="wallet" size={28} color={theme.COLORS.primary} />
              </View>
              <Text style={styles.powerLabel}>Token Balance</Text>
              <Text style={styles.powerValue}>{votingPower.balance}</Text>
              <Text style={styles.powerSymbol}>{votingPower.symbol}</Text>
            </View>
            
            <Ionicons name="arrow-forward" size={24} color={theme.COLORS.textSecondary} />
            
            {/* Voting Power */}
            <View style={styles.powerItem}>
              <View style={[styles.iconContainer, { backgroundColor: theme.COLORS.success + '20' }]}>
                <Ionicons name="flash" size={28} color={theme.COLORS.success} />
              </View>
              <Text style={styles.powerLabel}>Voting Power</Text>
              <Text style={[styles.powerValue, { color: theme.COLORS.success }]}>
                {votingPower.power}
              </Text>
              <Text style={styles.powerSymbol}>votes</Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Delegation Info - Receiving */}
      {delegationPower && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delegation</Text>
          <Card style={styles.delegationCard}>
            <View style={styles.delegationHeader}>
              <Ionicons name="people" size={24} color={theme.COLORS.warning} />
              <View style={styles.delegationHeaderText}>
                <Text style={styles.delegationTitle}>Delegated to You</Text>
                <Text style={styles.delegationSubtitle}>
                  {delegationPower.delegatorsCount} {delegationPower.delegatorsCount === 1 ? 'person' : 'people'}
                </Text>
              </View>
            </View>
            <View style={styles.delegationStats}>
              <Text style={styles.delegationLabel}>Additional Voting Power</Text>
              <Text style={styles.delegationValue}>
                +{delegationPower.additional} votes
              </Text>
            </View>
            <View style={styles.delegationStats}>
              <Text style={styles.delegationLabel}>Total Delegated Tokens</Text>
              <Text style={styles.delegationValue}>
                {delegationPower.receivedVotesFormatted} {votingPower.symbol}
              </Text>
            </View>
          </Card>
        </View>
      )}

      {/* Delegation Info - Delegating */}
      {userInfo?.isDelegating && (
        <View style={styles.section}>
          <Card style={styles.delegatingCard}>
            <View style={styles.delegatingHeader}>
              <Ionicons name="arrow-forward-circle" size={24} color={theme.COLORS.warning} />
              <Text style={styles.delegatingTitle}>You are Delegating</Text>
            </View>
            <Text style={styles.delegatingAddress}>
              {userInfo.delegatee?.slice(0, 10)}...{userInfo.delegatee?.slice(-8)}
            </Text>
            <Text style={styles.delegatingNote}>
              Your voting power is being used by this address
            </Text>
          </Card>
        </View>
      )}

      {/* DAO Configuration */}
      {daoInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DAO Configuration</Text>
          <Card style={styles.configCard}>
            <View style={styles.configRow}>
              <View style={styles.configItem}>
                <Ionicons name="people-outline" size={20} color={theme.COLORS.textSecondary} />
                <Text style={styles.configLabel}>Quorum</Text>
              </View>
              <Text style={styles.configValue}>{daoInfo.quorumPercentage}%</Text>
            </View>
            
            <View style={styles.configDivider} />
            
            <View style={styles.configRow}>
              <View style={styles.configItem}>
                <Ionicons name="time-outline" size={20} color={theme.COLORS.textSecondary} />
                <Text style={styles.configLabel}>Voting Period</Text>
              </View>
              <Text style={styles.configValue}>{daoInfo.votingPeriodHours}h</Text>
            </View>
            
            <View style={styles.configDivider} />
            
            <View style={styles.configRow}>
              <View style={styles.configItem}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.COLORS.textSecondary} />
                <Text style={styles.configLabel}>Timelock</Text>
              </View>
              <Text style={styles.configValue}>{daoInfo.timelockPeriodHours}h</Text>
            </View>
          </Card>
        </View>
      )}
    </ScrollView>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.SPACING.xl,
    },
    loadingText: {
      marginTop: theme.SPACING.md,
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.SPACING.xl,
    },
    emptyText: {
      marginTop: theme.SPACING.md,
      fontSize: theme.FONTS.sizes.xl,
      color: theme.COLORS.text,
      fontWeight: 'bold',
    },
    emptySubtext: {
      marginTop: theme.SPACING.xs,
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      textAlign: 'center',
    },
    section: {
      padding: theme.SPACING.md,
    },
    sectionTitle: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.md,
    },
    
    // Status Cards
    statusGrid: {
      flexDirection: 'row',
      gap: theme.SPACING.md,
    },
    statusCard: {
      flex: 1,
      padding: theme.SPACING.md,
      alignItems: 'center',
      gap: theme.SPACING.xs,
    },
    statusCardActive: {
      backgroundColor: theme.COLORS.success + '10',
    },
    statusLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      fontWeight: '600',
    },
    statusValue: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: 'bold',
    },
    
    // Explanation
    explanationCard: {
      padding: theme.SPACING.md,
      marginBottom: theme.SPACING.md,
      backgroundColor: `${theme.COLORS.primary}15`,
    },
    explanationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.sm,
      marginBottom: theme.SPACING.xs,
    },
    explanationTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: 'bold',
      color: theme.COLORS.primary,
    },
    explanationText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
      lineHeight: 20,
    },
    
    // Power Display
    powerCard: {
      padding: theme.SPACING.lg,
    },
    powerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    powerItem: {
      alignItems: 'center',
      gap: theme.SPACING.sm,
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: theme.BORDER_RADIUS.lg,
      backgroundColor: `${theme.COLORS.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.SPACING.xs,
    },
    powerLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      fontWeight: '600',
    },
    powerValue: {
      fontSize: theme.FONTS.sizes.xxl,
      fontWeight: 'bold',
      color: theme.COLORS.text,
    },
    powerSymbol: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      fontStyle: 'italic',
    },
    
    // Delegation - Receiving
    delegationCard: {
      padding: theme.SPACING.md,
      backgroundColor: theme.COLORS.warning + '10',
    },
    delegationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.sm,
      marginBottom: theme.SPACING.md,
    },
    delegationHeaderText: {
      flex: 1,
    },
    delegationTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: 'bold',
      color: theme.COLORS.text,
    },
    delegationSubtitle: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      marginTop: 2,
    },
    delegationStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.SPACING.sm,
    },
    delegationLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
    },
    delegationValue: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: 'bold',
      color: theme.COLORS.warning,
    },
    
    // Delegating
    delegatingCard: {
      padding: theme.SPACING.md,
      backgroundColor: theme.COLORS.surface,
    },
    delegatingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.sm,
      marginBottom: theme.SPACING.md,
    },
    delegatingTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: 'bold',
      color: theme.COLORS.text,
    },
    delegatingAddress: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.text,
      fontFamily: 'monospace',
      marginBottom: theme.SPACING.sm,
    },
    delegatingNote: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      fontStyle: 'italic',
    },
    
    // Config
    configCard: {
      padding: theme.SPACING.md,
    },
    configRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.SPACING.sm,
    },
    configItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.sm,
    },
    configLabel: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
    },
    configValue: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: 'bold',
      color: theme.COLORS.text,
    },
    configDivider: {
      height: 1,
      backgroundColor: theme.COLORS.border,
    },
  });