// components/dao/DAOCard.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';

const GENRE_INFO = {
  0:  { label: 'NFT',        icon: 'image-outline',          color: '#8B5CF6' },
  1:  { label: 'Gaming',     icon: 'game-controller-outline', color: '#10B981' },
  2:  { label: 'Community',  icon: 'people-outline',          color: '#F59E0B' },
  3:  { label: 'DeFi',       icon: 'trending-up-outline',     color: '#3B82F6' },
  4:  { label: 'AI',         icon: 'bulb-outline',            color: '#EF4444' },
  5:  { label: 'Degen',      icon: 'rocket-outline',          color: '#F97316' },
  6:  { label: 'Memecoin',   icon: 'happy-outline',           color: '#84CC16' },
  7:  { label: 'RWA',        icon: 'business-outline',        color: '#6366F1' },
  8:  { label: 'DePIN',      icon: 'hardware-chip-outline',   color: '#EC4899' },
  9:  { label: 'SocialFi',   icon: 'share-social-outline',    color: '#14B8A6' },
  10: { label: 'Metaverse',  icon: 'globe-outline',           color: '#A855F7' },
  11: { label: 'Other',      icon: 'help-circle-outline',     color: '#6B7280' },
};

function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export const DAOCard = ({ dao, viewMode, onPress }) => {
  const theme   = useTheme();
  const styles  = createStyles(theme);
  const [imgErr, setImgErr] = useState(false);

  const genreInfo = GENRE_INFO[dao.genreId] ?? GENRE_INFO[dao.genre] ?? GENRE_INFO[11];

  const formatAddress = (addr) =>
    addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : 'N/A';

  const isGrid = viewMode === 'grid';

  // ─── Image or initials fallback ─────────────────────────────────────────
  const renderImage = () => {
    const imgStyle = isGrid ? styles.imageGrid : styles.imageList;

    if (dao.imageUrl && !imgErr) {
      return (
        <Image
          source={{ uri: dao.imageUrl }}
          style={imgStyle}
          onError={() => setImgErr(true)}
        />
      );
    }

    // Fallback: coloured block with initials
    return (
      <View style={[imgStyle, styles.imageFallback, { backgroundColor: genreInfo.color + '25' }]}>
        <Text style={[styles.initials, { color: genreInfo.color }]}>
          {getInitials(dao.daoName) || '?'}
        </Text>
      </View>
    );
  };

  return (
    <View style={isGrid ? styles.cardGrid : styles.cardList}>
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.touchable}>
        <View style={isGrid ? styles.contentGrid : styles.contentList}>

          {/* Image / fallback */}
          <View style={styles.imageContainer}>
            {renderImage()}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.55)']}
              style={styles.imageOverlay}
            />
            {/* Genre dot */}
            <View style={[styles.genreDot, { backgroundColor: genreInfo.color }]} />
          </View>

          {/* Info */}
          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={isGrid ? 2 : 1}>
                {dao.daoName}
              </Text>
              <View style={styles.favoriteBtn}>
                <Ionicons name="heart-outline" size={14} color={theme.COLORS.textSecondary} />
              </View>
            </View>

            <View style={styles.addressRow}>
              <View style={styles.addressBadge}>
                <Ionicons name="wallet-outline" size={10} color={theme.COLORS.primary} />
                <Text style={styles.addressText}>
                  {formatAddress(dao.daoAddress || dao.address)}
                </Text>
              </View>
            </View>

            <View style={styles.footer}>
              <View style={[styles.genreChip, { backgroundColor: genreInfo.color + '18' }]}>
                <Ionicons name={genreInfo.icon} size={11} color={genreInfo.color} />
                <Text style={[styles.genreLabel, { color: genreInfo.color }]}>
                  {genreInfo.label}
                </Text>
              </View>

              {dao.members != null && (
                <View style={styles.membersRow}>
                  <MaterialCommunityIcons
                    name="account-group-outline"
                    size={12}
                    color={theme.COLORS.textTertiary}
                  />
                  <Text style={styles.membersText}>{dao.members}</Text>
                </View>
              )}
            </View>
          </View>

        </View>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    cardGrid: {
      width: '48%',
      backgroundColor: theme.COLORS.card,
      borderRadius: theme.BORDER_RADIUS.xl,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      overflow: 'hidden',
      marginBottom: theme.SPACING.sm + 4,
      ...theme.SHADOWS.small,
    },
    cardList: {
      backgroundColor: theme.COLORS.card,
      borderRadius: theme.BORDER_RADIUS.xl,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      overflow: 'hidden',
      marginVertical: 5,
      ...theme.SHADOWS.small,
    },
    touchable: { flex: 1 },
    contentGrid: {},
    contentList: { flexDirection: 'row' },

    // ─── Image ────────────────────────────────────────────────────────────────
    imageContainer: { position: 'relative' },
    imageGrid: {
      width: '100%',
      height: 115,
      backgroundColor: theme.COLORS.surface,
    },
    imageList: {
      width: 96,
      height: '100%',
      minHeight: 80,
      backgroundColor: theme.COLORS.surface,
    },
    imageFallback: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    initials: {
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: 1,
    },
    imageOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 40,
    },
    genreDot: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    // ─── Info ─────────────────────────────────────────────────────────────────
    cardInfo: {
      flex: 1,
      padding: theme.SPACING.md,
      justifyContent: 'space-between',
      gap: 4,
    },
    nameRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    name: {
      color: theme.COLORS.text,
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      flex: 1,
      marginRight: 6,
      lineHeight: 20,
    },
    favoriteBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.COLORS.surface,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      justifyContent: 'center',
      alignItems: 'center',
    },

    addressRow: { marginTop: 2 },
    addressBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${theme.COLORS.primary}18`,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: theme.BORDER_RADIUS.md,
      alignSelf: 'flex-start',
      gap: 4,
    },
    addressText: {
      color: theme.COLORS.primary,
      fontSize: 10,
      fontFamily: 'monospace',
      fontWeight: '600',
    },

    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 2,
    },
    genreChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: theme.BORDER_RADIUS.lg,
      gap: 4,
    },
    genreLabel: {
      fontSize: 11,
      fontWeight: '600',
    },
    membersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    membersText: {
      color: theme.COLORS.textTertiary,
      fontSize: 11,
      fontWeight: '500',
    },
  });
