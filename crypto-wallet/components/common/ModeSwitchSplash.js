import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { APP_MODES } from '../../contexts/AppModeContext';
import { getMainnetChains } from '../../constants/Chain';

const INK = '#000000'; // text/icons on the lime background — always black, never white

// Wallet mode's chain list used to be two hand-maintained strings that
// silently drifted from the real supported-chain list (already missing
// HyperEVM). Source it live from constants/Chain.js instead so this splash
// can never say something the app doesn't actually support.
const buildWalletSteps = () => {
  const chains = getMainnetChains();
  const names = chains.map((c) => c.name);
  const mid = Math.ceil(names.length / 2);
  const groupA = names.slice(0, mid);
  const groupB = names.slice(mid);

  return [
    {
      icon: 'globe-outline',
      text: `Unlocking ${chains.length} blockchain network${chains.length === 1 ? '' : 's'}`,
    },
    { icon: 'layers-outline', text: groupA.join('  ·  ') },
    ...(groupB.length ? [{ icon: 'diamond-outline', text: groupB.join('  ·  ') }] : []),
    { icon: 'shield-checkmark-outline', text: 'Non-custodial  ·  Your keys, your coins' },
  ];
};

// ── Mode-specific content ────────────────────────────────────────────────────

const CONTENT = {
  [APP_MODES.WALLET]: {
    icon: 'wallet',
    title: 'Wallet Mode',
    subtitle: 'Your personal multi-chain wallet',
    steps: buildWalletSteps(),
  },
  [APP_MODES.COMMUNITY]: {
    icon: 'people',
    title: 'Community Mode',
    subtitle: 'DAOs, tribes & on-chain governance',
    steps: [
      { icon: 'swap-horizontal-outline', text: 'Switching to Robinhood Chain' },
      { icon: 'grid-outline',            text: 'Loading DAOs & Communities' },
      { icon: 'chatbubbles-outline',     text: 'Tribe chats & proposals' },
      { icon: 'checkmark-circle-outline',text: 'On-chain voting enabled' },
    ],
  },
};

// ── Component ────────────────────────────────────────────────────────────────

const ModeSwitchSplash = ({ targetMode, durationMs = 3000 }) => {
  const { COLORS, FONTS, SPACING } = useTheme();
  const insets = useSafeAreaInsets();

  const content = CONTENT[targetMode] ?? CONTENT[APP_MODES.COMMUNITY];
  // The whole screen IS the Robinhood lime now — one brand color everywhere,
  // same for both directions (theme-aware: COLORS.primary already resolves
  // to the correct light/dark shade). Every foreground element (icon, text,
  // progress bar, decorative rings) uses black (INK) instead, since lime is
  // now the background rather than a foreground accent.
  const accent = COLORS.primary;

  // Animations
  const fadeIn      = useRef(new Animated.Value(0)).current;
  const progress    = useRef(new Animated.Value(0)).current;
  const iconScale   = useRef(new Animated.Value(0.6)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(0)).current;

  // Staggered step reveals
  const stepAnims = content.steps.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    // 1. Fade the overlay in, hold, then dim itself out in the last ~250ms —
    // AppModeContext unmounts this component right at durationMs, so fading
    // to near-zero just before that avoids a visible pop at the handoff
    // without needing any change to its timer.
    const holdMs = Math.max(0, durationMs - 350 - 250);
    Animated.sequence([
      Animated.timing(fadeIn, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.delay(holdMs),
      Animated.timing(fadeIn, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

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

    // 3. Outer ring: slow radar-style pulse, looping for as long as the
    // splash is on screen.
    const pulse = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      }),
    );
    pulse.start();

    // 4. Fill the progress bar over the full duration
    Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      useNativeDriver: false,
    }).start();

    // 5. Stagger the steps in
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

    return () => pulse.stop();
  }, []);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.4, 0.12, 0] });

  const styles = createStyles(COLORS, FONTS, SPACING, insets, accent);

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeIn }]}>

      {/* ── Subtle depth wash — a faint black gradient over the lime field,
          since the accent itself is the background now rather than a tint
          layered over a neutral one. ── */}
      <LinearGradient
        colors={['#00000012', '#00000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* ── Icon ── */}
      <View style={styles.iconWrap}>
        {/* Soft radial-style glow, faked with stacked low-opacity circles
            since RN has no native radial gradient. */}
        <View style={styles.glowOuter} pointerEvents="none" />
        <View style={styles.glowInner} pointerEvents="none" />

        {/* Radar pulse ring */}
        <Animated.View
          style={[
            styles.pulseRing,
            {
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
          pointerEvents="none"
        />

        <Animated.View
          style={[
            styles.iconRingWrap,
            { transform: [{ scale: iconScale }], opacity: iconOpacity },
          ]}
        >
          <View style={styles.iconRing}>
            <View style={styles.iconInner}>
              <Ionicons name={content.icon} size={48} color={INK} />
            </View>
          </View>
        </Animated.View>
      </View>

      {/* ── Headline ── */}
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.subtitle}>{content.subtitle}</Text>

      {/* ── Progress bar ── */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFillWrap, { width: progressWidth }]}>
          <View style={styles.progressFill} />
        </Animated.View>
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
            <View style={styles.stepDot}>
              <Ionicons name={step.icon} size={15} color={INK} />
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
      backgroundColor: accent,
      zIndex: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingHorizontal: SPACING.xl,
    },
    iconWrap: {
      marginBottom: SPACING.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glowOuter: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: '#0000000A',
    },
    glowInner: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: '#00000010',
    },
    pulseRing: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      borderWidth: 1.5,
      borderColor: INK,
    },
    iconRingWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconRing: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 2,
      borderColor: '#00000040',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconInner: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: '#00000018',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: FONTS.sizes.xxl,
      fontWeight: '800',
      color: INK,
      textAlign: 'center',
      marginBottom: SPACING.sm,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: FONTS.sizes.base,
      color: '#000000B3',
      textAlign: 'center',
      marginBottom: SPACING.xl,
    },
    progressTrack: {
      width: '100%',
      height: 4,
      backgroundColor: '#00000022',
      borderRadius: 2,
      marginBottom: SPACING.xl,
    },
    progressFillWrap: {
      height: '100%',
      borderRadius: 2,
      overflow: 'visible',
    },
    progressFill: {
      flex: 1,
      borderRadius: 2,
      backgroundColor: INK,
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
      backgroundColor: '#00000018',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepText: {
      fontSize: FONTS.sizes.sm,
      color: INK,
      fontWeight: '500',
      flex: 1,
    },
  });

export default ModeSwitchSplash;
