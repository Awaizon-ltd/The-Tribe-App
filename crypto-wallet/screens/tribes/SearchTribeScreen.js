import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTribeSearch } from '../../hooks/useTribes';
import { BORDER_RADIUS, SPACING } from '../../constants/Theme'; // Remove COLORS from here
import { useTheme } from '../../contexts/ThemeContext'; // Add this import

const GENRES = [
  'All',
  'NFTs',
  'DeFi',
  'DAO',
  'GameFi',
  'DePIN',
  'AI',
  'Memecoin',
  'Degen',
  'RWA',
  'Metaverse',
  'Infrastructure',
];

const SearchTribeScreen = ({ navigation }) => {
  const { COLORS } = useTheme(); // Add this to get dynamic colors
  const insets = useSafeAreaInsets();
  const { topTribes, searchResults, loading, search } = useTribeSearch();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      const genre = selectedGenre === 'All' ? null : selectedGenre;
      search(query, genre);
    }
  };

  const handleGenreSelect = (genre) => {
    setSelectedGenre(genre);
    if (searchQuery.trim()) {
      const genreFilter = genre === 'All' ? null : genre;
      search(searchQuery, genreFilter);
    }
  };

  const displayTribes = searchQuery.trim() ? searchResults : topTribes;

  const renderTribeCard = ({ item }) => (
    <TouchableOpacity
      style={styles.tribeCard}
      onPress={() => navigation.navigate('TribeDetail', { tribe: item })}
    >
      <View style={styles.cardHeader}>
        {item.logo_url || item.logoUrl ? (
          <Image
            source={{ uri: item.logo_url || item.logoUrl }}
            style={styles.logo}
          />
        ) : (
          <View style={[styles.logo, styles.logoPlaceholder]}>
            <Ionicons name="people" size={24} color={COLORS.textTertiary} />
          </View>
        )}
        
        <View style={styles.tribeInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.tribeName} numberOfLines={1}>
              {item.name}
            </Text>
            {(item.privacy === 'private' || item.privacy === 'private') && (
              <Ionicons name="lock-closed" size={16} color={COLORS.primary} />
            )}
          </View>
          
          <View style={styles.metaRow}>
            <View style={styles.genreBadge}>
              <Text style={styles.genreText}>{item.genre}</Text>
            </View>
            
            <View style={styles.memberCount}>
              <Ionicons name="people" size={14} color={COLORS.textSecondary} />
              <Text style={styles.memberCountText}>
                {item.member_count || item.memberCount}
              </Text>
            </View>
          </View>
          
          {item.description && (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Move styles inside component to access dynamic COLORS
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    headerContainer: {
      flexDirection: 'column',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      backgroundColor: COLORS.surface,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      backgroundColor: COLORS.surface,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.divider,
    },
    backButton: {
      padding: SPACING.xs,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: COLORS.text,
    },
    placeholder: {
      width: 40,
    },
    searchContainer: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      backgroundColor: COLORS.surface,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.background,
      borderRadius: BORDER_RADIUS.round,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
      borderWidth: 1,
      borderColor: COLORS.divider,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: COLORS.text,
    },
    genreScroll: {
      backgroundColor: COLORS.surface,
      borderBottomColor: COLORS.divider,
      alignSelf: 'flex-start',
    },
    genreContent: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
      height: 'auto',
      alignItems: 'center',
    },
    genreChip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.round,
      backgroundColor: COLORS.background,
      borderWidth: 1,
      borderColor: COLORS.divider,
    },
    genreChipActive: {
      backgroundColor: COLORS.primaryDark,
      borderColor: COLORS.primary,
    },
    genreChipText: {
      fontSize: 14,
      color: COLORS.textSecondary,
      fontWeight: '500',
    },
    genreChipTextActive: {
      color: COLORS.primary,
      fontWeight: '600',
    },
    sectionHeader: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.sm,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: SPACING.xs / 2,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    listContent: {
      padding: SPACING.md,
      paddingBottom: SPACING.xl,
    },
    tribeCard: {
      backgroundColor: COLORS.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: COLORS.divider,
    },
    cardHeader: {
      flexDirection: 'row',
    },
    logo: {
      width: 56,
      height: 56,
      borderRadius: BORDER_RADIUS.md,
      marginRight: SPACING.md,
    },
    logoPlaceholder: {
      backgroundColor: COLORS.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tribeInfo: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginBottom: SPACING.xs,
    },
    tribeName: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.text,
      flex: 1,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    genreBadge: {
      backgroundColor: COLORS.primaryDark,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs / 2,
      borderRadius: BORDER_RADIUS.sm,
    },
    genreText: {
      color: COLORS.primary,
      fontSize: 11,
      fontWeight: '600',
    },
    memberCount: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs / 2,
    },
    memberCountText: {
      color: COLORS.textSecondary,
      fontSize: 12,
    },
    description: {
      color: COLORS.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: SPACING.xl * 2,
    },
    loadingText: {
      marginTop: SPACING.md,
      color: COLORS.textSecondary,
      fontSize: 14,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.xl * 2,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: COLORS.text,
      marginTop: SPACING.md,
      marginBottom: SPACING.xs,
    },
    emptyText: {
      fontSize: 14,
      color: COLORS.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search Tribes</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tribes..."
              placeholderTextColor={COLORS.textTertiary}
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.genreScroll}
          contentContainerStyle={styles.genreContent}
        >
          {GENRES.map((genre) => (
            <TouchableOpacity
              key={genre}
              style={[
                styles.genreChip,
                selectedGenre === genre && styles.genreChipActive,
              ]}
              onPress={() => handleGenreSelect(genre)}
            >
              <Text
                style={[
                  styles.genreChipText,
                  selectedGenre === genre && styles.genreChipTextActive,
                ]}
              >
                {genre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!searchQuery.trim() && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Tribes</Text>
          <Text style={styles.sectionSubtitle}>Most popular communities</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={displayTribes}
          keyExtractor={(item) => item.id}
          renderItem={renderTribeCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={searchQuery.trim() ? 'search-outline' : 'compass-outline'}
                size={64}
                color={COLORS.textTertiary}
              />
              <Text style={styles.emptyTitle}>
                {searchQuery.trim() ? 'No Results Found' : 'No Top Tribes Yet'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'Try different keywords or filters'
                  : 'Be the first to create a tribe'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

export default SearchTribeScreen;