// components/dao/GenreFilter.js
import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext'; // Adjust path as needed

const GENRES = [
  { id: 0, label: 'NFT', icon: 'image-outline', color: '#8B5CF6' },
  { id: 1, label: 'Gaming', icon: 'game-controller-outline', color: '#10B981' },
  { id: 2, label: 'Community', icon: 'people-outline', color: '#F59E0B' },
  { id: 3, label: 'DeFi', icon: 'trending-up-outline', color: '#3B82F6' },
  { id: 4, label: 'AI', icon: 'bulb-outline', color: '#EF4444' },
  { id: 5, label: 'Degen', icon: 'rocket-outline', color: '#F97316' },
  { id: 6, label: 'Memecoin', icon: 'happy-outline', color: '#84CC16' },
  { id: 7, label: 'RWA', icon: 'business-outline', color: '#6366F1' },
  { id: 8, label: 'DePIN', icon: 'hardware-chip-outline', color: '#EC4899' },
  { id: 9, label: 'SocialFi', icon: 'share-social-outline', color: '#14B8A6' },
  { id: 10, label: 'Metaverse', icon: 'globe-outline', color: '#A855F7' },
];

export const GenreFilter = ({ selectedGenre, onSelectGenre }) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* All DAOs */}
      <TouchableOpacity
        style={[
          styles.chip,
          selectedGenre === null && styles.chipActive,
        ]}
        onPress={() => onSelectGenre(null)}
        activeOpacity={0.7}
      >
        <Text style={[styles.chipText, selectedGenre === null && styles.chipTextActive]}>
          All
        </Text>
      </TouchableOpacity>

      {/* Genre Chips */}
      {GENRES.map((genre) => (
        <TouchableOpacity
          key={genre.id}
          style={[
            styles.chip,
            selectedGenre === genre.id && [
              styles.chipActive,
              { backgroundColor: genre.color + '20', borderColor: genre.color },
            ],
          ]}
          onPress={() => onSelectGenre(selectedGenre === genre.id ? null : genre.id)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={genre.icon}
            size={14}
            color={selectedGenre === genre.id ? genre.color : theme.COLORS.textSecondary}
            style={styles.chipIcon}
          />
          <Text
            style={[
              styles.chipText,
              selectedGenre === genre.id && { color: genre.color },
            ]}
          >
            {genre.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flexShrink: 0,
      flexGrow: 0,
    },
    content: {
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      gap: theme.SPACING.xs,
      alignItems: 'center',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.COLORS.surface,
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.xs,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      gap: 4,
      height: 28,
    },
    chipActive: {
      backgroundColor: theme.COLORS.primary,
      borderColor: theme.COLORS.primary,
    },
    chipIcon: {
      marginRight: 2,
    },
    chipText: {
      color: theme.COLORS.textSecondary,
      fontSize: theme.FONTS.sizes.xs,
      fontWeight: '600',
    },
    chipTextActive: {
      color: theme.COLORS.surface,
    },
  });