import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../../contexts/ThemeContext'; // Adjust path as needed
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import {
  getCoinDetails,
  getCoinChart,
  getCoinIdFromSymbol,
  formatPriceChange,
} from '../../services/coingecko';

const { width } = Dimensions.get('window');

const TokenDetailScreen = ({ route, navigation }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { chain, balance, usdValue, price, priceChange24h, walletAddress } =
    route.params;

  const [coinDetails, setCoinDetails] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7');
  const [loading, setLoading] = useState(true);

  const coinId = getCoinIdFromSymbol(chain.symbol);

  useEffect(() => {
    loadTokenData();
  }, [selectedPeriod]);

  const loadTokenData = async () => {
    if (!coinId) return;

    try {
      setLoading(true);
      const [details, chart] = await Promise.all([
        getCoinDetails(coinId),
        getCoinChart(coinId, parseInt(selectedPeriod)),
      ]);

      setCoinDetails(details);
      setChartData(chart);
    } catch (error) {
      console.error('Error loading token data:', error);
    } finally {
      setLoading(false);
    }
  };

  const change = formatPriceChange(priceChange24h);

  const periods = [
    { label: '1D', value: '1' },
    { label: '7D', value: '7' },
    { label: '1M', value: '30' },
    { label: '3M', value: '90' },
    { label: '1Y', value: '365' },
  ];

  const ActionButton = ({ icon, label, onPress, color = theme.COLORS.primary }) => (
    <Pressable style={styles.actionButton} onPress={onPress}>
      <View style={[styles.actionIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );

  const StatCard = ({ label, value, icon }) => (
    <Card style={styles.statCard}>
      <Ionicons name={icon} size={20} color={theme.COLORS.textSecondary} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </Card>
  );

  const formatChartData = () => {
    if (!chartData?.prices) return null;

    const prices = chartData.prices.map((p) => p[1]);
    const labels = chartData.prices
      .map((p) => {
        const date = new Date(p[0]);
        return selectedPeriod === '1'
          ? `${date.getHours()}:00`
          : `${date.getMonth() + 1}/${date.getDate()}`;
      })
      .filter((_, i, arr) => i % Math.ceil(arr.length / 6) === 0);

    return {
      labels,
      datasets: [
        {
          data: prices,
          color: (opacity = 1) =>
            change.isPositive
              ? `rgba(76, 175, 80, ${opacity})`
              : `rgba(244, 67, 54, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  const chartConfig = {
    backgroundGradientFrom: theme.COLORS.surface,
    backgroundGradientTo: theme.COLORS.surface,
    color: (opacity = 1) =>
      change.isPositive
        ? `rgba(76, 175, 80, ${opacity})`
        : `rgba(244, 67, 54, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 2,
    propsForDots: {
      r: '0',
    },
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.COLORS.text} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Image source={{ uri: chain.icon }} style={styles.tokenIcon} />
            <View style={styles.headerText}>
              <Text style={styles.tokenName}>{chain.name}</Text>
              <Text style={styles.tokenSymbol}>{chain.symbol}</Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Price Info */}
        <View style={styles.priceSection}>
          <Text style={styles.currentPrice}>${price?.toFixed(2) || '0.00'}</Text>
          {priceChange24h !== undefined && priceChange24h !== null && (
            <View style={styles.priceChange}>
              <Ionicons
                name={change.isPositive ? 'trending-up' : 'trending-down'}
                size={20}
                color={change.isPositive ? theme.COLORS.success : theme.COLORS.error}
              />
              <Text
                style={[
                  styles.priceChangeText,
                  { color: change.isPositive ? theme.COLORS.success : theme.COLORS.error },
                ]}
              >
                {change.text} (24h)
              </Text>
            </View>
          )}
        </View>

        {/* Balance */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your Balance</Text>
          <Text style={styles.balanceAmount}>
            {parseFloat(balance).toFixed(6)} {chain.symbol}
          </Text>
          <Text style={styles.balanceUsd}>${usdValue.toFixed(2)}</Text>
        </Card>

        {/* Chart Period Selector */}
        <View style={styles.periodSelector}>
          {periods.map((period) => (
            <Pressable
              key={period.value}
              style={[
                styles.periodButton,
                selectedPeriod === period.value && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period.value)}
            >
              <Text
                style={[
                  styles.periodText,
                  selectedPeriod === period.value && styles.periodTextActive,
                ]}
              >
                {period.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Chart */}
        <Card style={styles.chartCard}>
          {loading || !formatChartData() ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator size="large" color={theme.COLORS.primary} />
            </View>
          ) : (
            <LineChart
              data={formatChartData()}
              width={width - theme.SPACING.md * 4}
              height={200}
              chartConfig={chartConfig}
              bezier
              withDots={false}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLabels={true}
              withHorizontalLabels={true}
              style={styles.chart}
            />
          )}
        </Card>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <ActionButton
              icon="arrow-up-outline"
              label="Send"
              onPress={() =>
                navigation.navigate('Send', {
                  chain,
                  tokenAddress: null, // null for native token
                  walletAddress,
                })
              }
              color={theme.COLORS.primary}
            />
            <ActionButton
              icon="arrow-down-outline"
              label="Receive"
              onPress={() =>
                navigation.navigate('Receive', {
                  chain,
                  walletAddress,
                })
              }
              color="#4CAF50"
            />
            <ActionButton
              icon="swap-horizontal-outline"
              label="Swap"
              onPress={() =>
                navigation.navigate('Swap', {
                  chain,
                  fromToken: chain.symbol,
                })
              }
              color="#FF9800"
            />
          </View>
        </View>

        {/* Statistics */}
        {coinDetails && (
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Market Statistics</Text>
            <View style={styles.statsGrid}>
              <StatCard
                label="Market Cap"
                value={`$${(
                  coinDetails.market_data?.market_cap?.usd / 1e9
                ).toFixed(2)}B`}
                icon="stats-chart-outline"
              />
              <StatCard
                label="24h Volume"
                value={`$${(
                  coinDetails.market_data?.total_volume?.usd / 1e9
                ).toFixed(2)}B`}
                icon="trending-up-outline"
              />
              <StatCard
                label="Circulating Supply"
                value={`${(
                  coinDetails.market_data?.circulating_supply / 1e6
                ).toFixed(2)}M`}
                icon="globe-outline"
              />
              <StatCard
                label="All-Time High"
                value={`$${coinDetails.market_data?.ath?.usd?.toFixed(2)}`}
                icon="trophy-outline"
              />
            </View>
          </View>
        )}

        {/* About */}
        {coinDetails?.description?.en && (
          <View style={styles.aboutSection}>
            <Text style={styles.sectionTitle}>About {chain.name}</Text>
            <Card style={styles.aboutCard}>
              <Text style={styles.aboutText} numberOfLines={5}>
                {coinDetails.description.en.replace(/<[^>]*>/g, '')}
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.SPACING.md,
      paddingTop: theme.SPACING.lg,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.COLORS.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.sm,
    },
    tokenIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    headerText: {
      alignItems: 'center',
    },
    tokenName: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: 'bold',
      color: theme.COLORS.text,
    },
    tokenSymbol: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
    },
    priceSection: {
      alignItems: 'center',
      paddingHorizontal: theme.SPACING.md,
      marginBottom: theme.SPACING.md,
    },
    currentPrice: {
      fontSize: 48,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.xs,
    },
    priceChange: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    priceChangeText: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: '600',
    },
    balanceCard: {
      padding: theme.SPACING.lg,
      marginHorizontal: theme.SPACING.md,
      marginBottom: theme.SPACING.md,
      alignItems: 'center',
    },
    balanceLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      marginBottom: 4,
    },
    balanceAmount: {
      fontSize: theme.FONTS.sizes.xl,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginBottom: 2,
    },
    balanceUsd: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
    },
    periodSelector: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: theme.SPACING.md,
      marginBottom: theme.SPACING.sm,
    },
    periodButton: {
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.xs,
      borderRadius: 12,
      backgroundColor: theme.COLORS.surface,
    },
    periodButtonActive: {
      backgroundColor: theme.COLORS.primary,
    },
    periodText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
      fontWeight: '500',
    },
    periodTextActive: {
      color: '#fff',
    },
    chartCard: {
      padding: theme.SPACING.sm,
      marginHorizontal: theme.SPACING.md,
      marginBottom: theme.SPACING.md,
    },
    chartLoading: {
      height: 200,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chart: {
      marginVertical: 8,
      borderRadius: 16,
    },
    actionsSection: {
      paddingHorizontal: theme.SPACING.md,
      marginBottom: theme.SPACING.lg,
    },
    sectionTitle: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.sm,
    },
    actionsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    actionButton: {
      alignItems: 'center',
      gap: 6,
    },
    actionIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
      fontWeight: '500',
    },
    statsSection: {
      paddingHorizontal: theme.SPACING.md,
      marginBottom: theme.SPACING.lg,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.SPACING.sm,
    },
    statCard: {
      flex: 1,
      minWidth: '48%',
      padding: theme.SPACING.md,
      alignItems: 'flex-start',
    },
    statLabel: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textSecondary,
      marginTop: 4,
      marginBottom: 2,
    },
    statValue: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.text,
    },
    aboutSection: {
      paddingHorizontal: theme.SPACING.md,
      marginBottom: theme.SPACING.xl,
    },
    aboutCard: {
      padding: theme.SPACING.md,
    },
    aboutText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      lineHeight: 20,
    },
  });

export default TokenDetailScreen;