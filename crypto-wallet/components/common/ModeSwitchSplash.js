import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { APP_MODES } from '../../contexts/AppModeContext';

const { width } = Dimensions.get('window');

// ── Mode-specific content ────────────────────────────────────────────────────

const CONTENT = {
  [APP_MODES.WALLET]: {
    icon: 'wallet',
    title: 'Wallet Mode',
    subtitle: 'Your personal multi-chain wallet',
    steps: [
      { icon: 'globe-outline',    text: 'Unlocking 5 blockchain networks' },
      { icon: 'layers-outline',   text: 'Ethereum  ·  Polygon  ·  Arbitrum' },
      { icon: 'diamond-outline',  text: 'Avalanche  ·  Base' },
      { icon: 'shield-checkmark-outline', text: 'Non-custodial  ·  Your keys, your coins' },
    ],
    accentColor: '#26cc6b',
  },
  [APP_MODES.COMMUNITY]: {
    icon: 'people',
    title: 'Community Mode',
    subtitle: 'DAOs, guilds & on-chain governance',
    steps: [
      { icon: 'swap-horizontal-outline', text: 'Switching to Base network' },
      { icon: 'grid-outline',            text: 'Loading DAOs & Communities' },
      { icon: 'chatbubbles-outline',     text: 'Guild chats & proposals' },
      { icon: 'checkmark-circle-outline',text: 'On-chain voting enabled' },
    ],
    accentColor: '#7c3aed',
  },
};

// ── Component ────────────────────────────────────────────────────────────────

const ModeSwitchSplash = ({ targetMode, durationMs = 3000 }) => {
  const { COLORS, FONTS, SPACING } = useTheme();
  const insets = useSafeAreaInsets();

  const content = CONTENT[targetMode] ?? CONTENT[APP_MODES.COMMUNITY];
  const accent = content.accentColor;

  // Animations
  const fadeIn    = useRef(new Animated.Value(0)).current;
  const progress  = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.6)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;

  // Staggered step reveals
  const stepAnims = content.steps.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    // 1. Fade the whole overlay in
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    // 2. Pop in the icon
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // 3. Fill the progress bar over the full duration
    Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      useNativeDriver: false,
    }).start();

    // 4. Stagger the steps in
    Animated.stagger(
      (durationMs * 0.18),
      stepAnims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          tension: 70,
          friction: 9,
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const styles = createStyles(COLORS, FONTS, SPACING, insets, accent);

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeIn }]}>

      {/* ── Icon ── */}
      <Animated.View
        style={[
          styles.iconWrap,
          { transform: [{ scale: iconScale }], opacity: iconOpacity },
        ]}
      >
        <View style={[styles.iconRing, { borderColor: accent + '40' }]}>
          <View style={[styles.iconInner, { backgroundColor: accent + '18' }]}>
            <Ionicons name={content.icon} size={48} color={accent} />
          </View>
        </View>
      </Animated.View>

      {/* ── Headline ── */}
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.subtitle}>{content.subtitle}</Text>

      {/* ── Progress bar ── */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: progressWidth, backgroundColor: accent },
          ]}
        />
      </View>

      {/* ── Steps ── */}
      <View style={styles.steps}>
        {content.steps.map((step, i) => (
          <Animated.View
            key={i}
            style={[
              styles.step,
              {
                opacity: stepAnims[i],
                transform: [
                  {
                    translateY: stepAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.stepDot, { backgroundColor: accent + '20' }]}>
              <Ionicons name={step.icon} size={15} color={accent} />
            </View>
            <Text style={styles.stepText}>{step.text}</Text>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
};

const createStyles = (COLORS, FONTS, SPACING, insets, accent) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: COLORS.background,
      zIndex: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingHorizontal: SPACING.xl,
    },
    iconWrap: {
      marginBottom: SPACING.xl,
    },
    iconRing: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconInner: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: FONTS.sizes.xxl,
      fontWeight: '800',
      color: COLORS.text,
      textAlign: 'center',
      marginBottom: SPACING.sm,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: FONTS.sizes.base,
      color: COLORS.textSecondary,
      textAlign: 'center',
      marginBottom: SPACING.xl,
    },
    progressTrack: {
      width: '100%',
      height: 4,
      backgroundColor: COLORS.border,
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: SPACING.xl,
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
    },
    steps: {
      width: '100%',
      gap: SPACING.md,
    },
    step: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    stepDot: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepText: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
      fontWeight: '500',
      flex: 1,
    },
  });

export default ModeSwitchSplash;
