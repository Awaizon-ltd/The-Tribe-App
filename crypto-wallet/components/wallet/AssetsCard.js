import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import { useTheme } from '../../contexts/ThemeContext';
import ChainIcon from '../common/ChainIcon';
import { SPACING, FONTS } from '../../constants/Theme';
import { formatPriceChange } from '../../services/coingecko';
import { isTestnetAllowedInProduction } from '../../constants/Chain';

// Format numbers with thousand separators
const formatNumber = (num, decimals = 2) => {
  if (num === undefined || num === null) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

const AssetCard = ({ asset, onPress }) => {
  const { COLORS } = useTheme();
  const {
    chain,
    balance,
    usdValue,
    price,
    priceChange24h,
    isZeroBalance,
  } = asset;

  // Hide testnet assets in production, except the allow-listed ones
  // (currently Robinhood Chain Testnet, for Community mode).
  if (!__DEV__ && chain.testnet && !isTestnetAllowedInProduction(chain.id)) {
    return null;
  }

  const change = formatPriceChange(priceChange24h);

  // Create styles inside component to use dynamic COLORS
  const styles = StyleSheet.create({
    container: {
      padding: SPACING.sm,
    },
    zeroBalance: {
      opacity: 0.6,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      flex: 1,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: COLORS.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    icon: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: FONTS.sizes.md,
      color: COLORS.text,
      fontWeight: '600',
      marginBottom: 2,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    price: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
    },
    changeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    changeText: {
      fontSize: FONTS.sizes.xs,
      fontWeight: '600',
    },
    right: {
      alignItems: 'flex-end',
      gap: 2,
    },
    balance: {
      fontSize: FONTS.sizes.md,
      color: COLORS.text,
      fontWeight: '600',
    },
    tokenPrice: {
      fontSize: FONTS.sizes.xs,
      color: COLORS.primary,
      fontWeight: '600',
    },
    usdValue: {
      fontSize: FONTS.sizes.xs,
      color: COLORS.textSecondary,
    },
  });

  return (
    <Pressable onPress={onPress}>
      <Card style={[styles.container, isZeroBalance && styles.zeroBalance]}>
        <View style={styles.row}>
          <View style={styles.left}>
            <View style={styles.iconContainer}>
              <ChainIcon chain={chain} size={32} style={styles.icon} />
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{chain.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>${formatNumber(price, 2)}</Text>
                {priceChange24h !== undefined && priceChange24h !== null && (
                  <View
                    style={[
                      styles.changeBadge,
                      {
                        backgroundColor: change.isPositive
                          ? COLORS.success + '20'
                          : COLORS.error + '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.changeText,
                        {
                          color: change.isPositive ? COLORS.success : COLORS.error,
                        },
                      ]}
                    >
                      {change.text}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <View style={styles.right}>
            <Text style={styles.balance}>
              {formatNumber(parseFloat(balance), 4)} {chain.symbol}
            </Text>
            {price > 0 && (
              <Text style={styles.tokenPrice}>
                ${price >= 1 ? formatNumber(price, 2) : formatNumber(price, 4)}
              </Text>
            )}
            <Text style={styles.usdValue}>${formatNumber(usdValue, 2)}</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
};

export default AssetCard;