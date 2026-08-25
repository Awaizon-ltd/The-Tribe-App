// components/dao/details/DAODetailsHeader.js
import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ImageBackground, Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import { getBannerForGenre, getGradientForGenre } from '../../../constants/GenreBanner';
import { shareDAO } from '../../../utils/helpers';

const { width } = Dimensions.get('window');

const GENRE_LABELS = {
  0: 'NFT', 1: 'Gaming', 2: 'Community', 3: 'DeFi', 4: 'AI',
  5: 'Degen', 6: 'Memecoin', 7: 'RWA', 8: 'DePIN', 9: 'SocialFi',
  10: 'Metaverse', 11: 'Other',
};

export const DAODetailsHeader = ({
  daoInfo, genreId, onBack,
  headerOpacity, titleScale, logoScale,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { COLORS, FONTS, SPACING, BORDER_RADIUS } = theme;

  const activeGenreId = genreId ?? daoInfo?.genreId ?? 11;
  const genreName     = GENRE_LABELS[activeGenreId] || 'Other';
  const bannerSource  = daoInfo?.imageUrl
    ? { uri: daoInfo.imageUrl }
    : getBannerForGenre(activeGenreId);
  const gradientColors = getGradientForGenre(activeGenreId);

  const handleShare = () => {
    if (daoInfo) shareDAO(daoInfo.address, daoInfo.chainId, daoInfo.name, genreName);
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={bannerSource}
        style={styles.banner}
        imageStyle={styles.bannerImage}
      >
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.15)',
            'rgba(0,0,0,0.05)',
            'rgba(0,0,0,0.7)',
          ]}
          style={styles.gradient}
        >
          {/* Controls row — respects safe area */}
          <View style={[styles.topControls, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleShare} activeOpacity={0.75}>
              <Ionicons name="share-social-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* DAO identity — fades + shrinks on scroll */}
          <Animated.View style={[styles.infoContainer, { opacity: headerOpacity }]}>
            {daoInfo?.imageUrl ? (
              <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }] }]}>
                <Image source={{ uri: daoInfo.imageUrl }} style={styles.logo} />
              </Animated.View>
            ) : (
              <Animated.View
                style={[
                  styles.logoWrap, styles.logoFallback,
                  { backgroundColor: `${COLORS.primary}33`, transform: [{ scale: logoScale }] },
                ]}
              >
                <Ionicons name="shield-checkmark" size={32} color={COLORS.primary} />
              </Animated.View>
            )}

            <Animated.Text
              style={[styles.name, { transform: [{ scale: titleScale }] }]}
              numberOfLines={1}
            >
              {daoInfo?.name || '—'}
            </Animated.Text>

            {/* Genre chip */}
            <View style={styles.genreChip}>
              <Text style={styles.genreText}>{genreName}</Text>
            </View>
          </Animated.View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner:    { flex: 1, width },
  bannerImage: { resizeMode: 'cover' },
  gradient: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.40)',
    justifyContent: 'center', alignItems: 'center',
  },
  infoContainer: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  logoWrap: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.9)',
    marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  logoFallback: {
    justifyContent: 'center', alignItems: 'center',
  },
  logo: { width: '100%', height: '100%', resizeMode: 'cover' },
  name: {
    fontSize: 22, fontWeight: '800', color: '#fff',
    textAlign: 'center', letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 6,
  },
  genreChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  genreText: {
    fontSize: 11, fontWeight: '700',
    color: '#fff', textTransform: 'uppercase', letterSpacing: 0.8,
  },
});
