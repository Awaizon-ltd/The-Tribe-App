// screens/auth/WelcomeScreen.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, ScrollView, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { NavigationCache } from '../../navigation/NavigationCache';

const { width: W } = Dimensions.get('window');
const CARD_W = W * 0.72;
const CARD_GAP = 14;
const SNAP = CARD_W + CARD_GAP;
const TOP_GAP = 12;

// ─── Static content ───────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: 'globe-outline',
    title: 'Community Hub',
    desc: 'One home for every circle you belong to, fully decentralized.',
  },
  {
    icon: 'people-outline',
    title: 'DAO Governance',
    desc: 'Vote on what matters. Every decision transparent, on-chain.',
  },
  {
    icon: 'key-outline',
    title: 'Token Gates',
    desc: 'Access curated spaces unlocked by what you hold.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Secure Wallet',
    desc: 'Your assets, protected by advanced built-in security.',
  },
];

const WHY_TRIBE = [
  { icon: 'add-circle-outline',   title: 'Build',    desc: 'Launch and run your own DAO' },
  { icon: 'people-circle-outline',title: 'Belong',    desc: 'Find your people, on-chain' },
  { icon: 'git-network-outline',  title: 'Govern',    desc: 'Shape decisions that matter' },
  { icon: 'lock-closed-outline',  title: 'Protect',   desc: 'Keep your assets secure' },
];

// ─── Main screen ──────────────────────────────────────────────────────────────

const WelcomeScreen = ({ navigation }) => {
  const theme = useTheme();
  const { COLORS, isDark } = theme;
  const insets = useSafeAreaInsets();

  const [activeCard, setActiveCard] = useState(0);
  const carouselRef = useRef(null);
  const mountAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    NavigationCache.setOnboardingComplete();
  }, []);

  useEffect(() => {
    Animated.timing(mountAnim, {
      toValue: 1, duration: 550,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleCarouselScroll = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP);
    if (idx !== activeCard) setActiveCard(idx);
  }, [activeCard]);

  const goToCard = useCallback((index) => {
    carouselRef.current?.scrollTo({ x: index * SNAP, animated: true });
    setActiveCard(index);
  }, []);

  const handleGetStarted = () => navigation.navigate('Register');
  const handleSignIn = () => navigation.navigate('Login');

  const bgGradient = isDark
    ? [`${COLORS.primary}0d`, COLORS.background, `${COLORS.primary}07`]
    : [`${COLORS.primary}0f`, '#ffffff', `${COLORS.primary}08`];

  const BOTTOM_H = 132 + insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: COLORS.background }]}>

      {/* Background */}
      <LinearGradient
        colors={bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blobTR, { backgroundColor: `${COLORS.primary}10` }]} />
      <View style={[styles.blobBL, { borderColor: `${COLORS.primary}12` }]} />

      {/* Top-right sign in */}
      <TouchableOpacity
        style={[styles.topSignIn, { top: insets.top + TOP_GAP }]}
        onPress={handleSignIn}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.topSignInText, { color: COLORS.textSecondary }]}>Sign In</Text>
      </TouchableOpacity>

      <Animated.ScrollView
        style={{ flex: 1, opacity: mountAnim }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: BOTTOM_H }}
      >
        {/* ── Hero ── */}
        <View style={[styles.hero, { paddingTop: insets.top + TOP_GAP + 28 }]}>
          {/* Logo + wordmark, side by side */}
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={[styles.brandName, { color: COLORS.primary }]}>TRIBE</Text>
          </View>

          <Text style={[styles.heroTagline, { color: COLORS.text }]}>
            Where Communities{'\n'}Become Tribes
          </Text>
          <Text style={[styles.heroDesc, { color: COLORS.textSecondary }]}>
            Build, govern, and belong — in a decentralized space made for your people.
          </Text>
        </View>

        {/* ── Feature carousel ── */}
        <View style={styles.section}>
          <View style={[styles.chip, { backgroundColor: `${COLORS.primary}18`, alignSelf: 'flex-start' }]}>
            <Ionicons name="apps-outline" size={12} color={COLORS.primary} />
            <Text style={[styles.chipText, { color: COLORS.primary }]}>CAPABILITIES</Text>
          </View>
          <Text style={[styles.sectionTitle, { color: COLORS.text, textAlign: 'left' }]}>
            Everything your tribe needs
          </Text>

          <ScrollView
            ref={carouselRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SNAP}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={handleCarouselScroll}
            contentContainerStyle={{ paddingRight: 24 - CARD_GAP }}
            style={styles.carousel}
          >
            {FEATURES.map((f, i) => {
              const accent = [COLORS.primary, COLORS.text, COLORS.textSecondary, COLORS.primary][i % 4];
              return (
                <View
                  key={f.title}
                  style={[styles.featureCard, {
                    backgroundColor: COLORS.surface,
                    width: CARD_W,
                    marginRight: CARD_GAP,
                  }]}
                >
                  <View style={[styles.featureIconBg, { backgroundColor: `${accent}18` }]}>
                    <Ionicons name={f.icon} size={22} color={accent} />
                  </View>
                  <Text style={[styles.featureName, { color: COLORS.text }]}>{f.title}</Text>
                  <Text style={[styles.featureDesc, { color: COLORS.textSecondary }]}>{f.desc}</Text>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.carouselDots}>
            {FEATURES.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => goToCard(i)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: activeCard === i ? COLORS.primary : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
                      width: activeCard === i ? 20 : 6,
                    },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Why join grid ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: COLORS.text, textAlign: 'left' }]}>
            Why join Tribe
          </Text>
          <View style={styles.grid}>
            {WHY_TRIBE.map((item) => (
              <View
                key={item.title}
                style={[styles.gridCard, {
                  backgroundColor: COLORS.surface,
                  width: (W - 48 - 10) / 2,
                }]}
              >
                <View style={[styles.gridIconBg, { backgroundColor: `${COLORS.primary}18` }]}>
                  <Ionicons name={item.icon} size={18} color={COLORS.primary} />
                </View>
                <Text style={[styles.gridTitle, { color: COLORS.text }]}>{item.title}</Text>
                <Text style={[styles.gridDesc, { color: COLORS.textSecondary }]}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.ScrollView>

      {/* ── Sticky bottom CTA ── */}
      <View
        style={[
          styles.bottom,
          {
            paddingBottom: insets.bottom + 20,
            backgroundColor: COLORS.background,
            borderTopColor: `${COLORS.primary}10`,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]}
          onPress={handleGetStarted}
          activeOpacity={0.88}
        >
          <Text style={[styles.primaryBtnText, { color: COLORS.background }]}>Get Started</Text>
          <View style={styles.primaryBtnIcon}>
            <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
          </View>
        </TouchableOpacity>

        <View style={styles.signInRow}>
          <Text style={[styles.signInText, { color: COLORS.textSecondary }]}>
            Already have an account?
          </Text>
          <TouchableOpacity
            onPress={handleSignIn}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.signInLink, { color: COLORS.primary }]}> Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>

    </View>
  );
};

export default WelcomeScreen;

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  blobTR: {
    position: 'absolute', top: -90, right: -90,
    width: 260, height: 260, borderRadius: 130,
  },
  blobBL: {
    position: 'absolute', bottom: 60, left: -70,
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 1,
  },

  topSignIn: {
    position: 'absolute', right: 20, zIndex: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  topSignInText: { fontSize: 14, fontWeight: '600' },

  // Hero
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  },
  logoImage: { width: 36, height: 36 },
  brandName: {
    fontSize: 26, fontWeight: '900', letterSpacing: 3,
  },
  heroTagline: {
    fontSize: 24, fontWeight: '800',
    textAlign: 'center', lineHeight: 32, marginBottom: 10,
    letterSpacing: -0.4,
  },
  heroDesc: {
    fontSize: 14, textAlign: 'center',
    lineHeight: 21, paddingHorizontal: 8,
  },

  // Sections
  section: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginBottom: 10,
  },
  chipText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  sectionTitle: {
    fontSize: 21, fontWeight: '800',
    letterSpacing: -0.3, marginBottom: 16,
  },

  // Carousel
  carousel: { marginHorizontal: -24, paddingLeft: 24 },
  featureCard: {
    borderRadius: 18, padding: 18, minHeight: 150,
  },
  featureIconBg: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  featureName: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  featureDesc: { fontSize: 12.5, lineHeight: 18 },
  carouselDots: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 6, marginTop: 14,
  },
  dot: { height: 6, borderRadius: 3 },

  // Grid
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', rowGap: 10,
  },
  gridCard: {
    borderRadius: 16, padding: 14,
  },
  gridIconBg: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  gridTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  gridDesc: { fontSize: 11.5, lineHeight: 16 },

  // Bottom bar
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  primaryBtn: {
    height: 56, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.1 },
  primaryBtnIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  signInRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  signInText: { fontSize: 14 },
  signInLink: { fontSize: 14, fontWeight: '700' },
});