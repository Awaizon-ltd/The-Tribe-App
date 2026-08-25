// components/dao/EmptyState.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

export const EmptyState = ({
  searchQuery,
  selectedGenre,
  chainName,
  isTestnet,
  onClearFilters,
}) => {
  const theme      = useTheme();
  const styles     = createStyles(theme);
  const hasFilters = !!(searchQuery || selectedGenre !== null);

  // ─── Pick icon + copy based on context ─────────────────────────────────
  let icon, title, subtitle;

  if (hasFilters) {
    icon     = 'search-outline';
    title    = 'No results found';
    subtitle = 'Try adjusting your search or filter — communities might be listed under a different genre.';
  } else if (isTestnet) {
    icon     = 'flask-outline';
    title    = `No testnet communities yet`;
    subtitle = `${chainName} is a test network. Deploy a community to get started, or switch to mainnet to explore live communities.`;
  } else {
    icon     = 'people-outline';
    title    = chainName ? `No communities on ${chainName}` : 'No communities yet';
    subtitle = 'Be the first to launch a community on this chain — it only takes a minute.';
  }

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, isTestnet && !hasFilters && styles.iconWrapTestnet]}>
        <Ionicons
          name={icon}
          size={40}
          color={isTestnet && !hasFilters ? theme.COLORS.warning : theme.COLORS.textSecondary}
        />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {hasFilters && (
        <TouchableOpacity style={styles.clearBtn} onPress={onClearFilters} activeOpacity={0.8}>
          <Ionicons name="close-circle-outline" size={16} color={theme.COLORS.surface} />
          <Text style={styles.clearBtnText}>Clear filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 32,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.COLORS.surface,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.SPACING.lg,
    },
    iconWrapTestnet: {
      backgroundColor: theme.COLORS.warning + '15',
      borderColor: theme.COLORS.warning + '40',
    },
    title: {
      color: theme.COLORS.text,
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: theme.SPACING.sm,
    },
    subtitle: {
      color: theme.COLORS.textSecondary,
      fontSize: theme.FONTS.sizes.sm,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: theme.SPACING.lg,
    },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.COLORS.primary,
      paddingHorizontal: theme.SPACING.lg,
      paddingVertical: theme.SPACING.sm + 2,
      borderRadius: 24,
    },
    clearBtnText: {
      color: theme.COLORS.surface,
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: '600',
    },
  });
