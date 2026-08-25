// components/TransactionSuccessScreen.js
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
  Modal, Platform, Dimensions, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const { width: W } = Dimensions.get('window');
const AUTO_DISMISS_MS = 3000;

const _Logo = ({ uri, symbol, size, color }) => {
  const [err, setErr] = useState(false);
  if (uri && !err) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: `${color}28`,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.42, fontWeight: '800', color }}>
        {symbol?.charAt(0)?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
};

const TransactionSuccessScreen = ({
  visible,
  onDismiss,
  tokenSymbol = '',
  tokenLogo,
  tokenAmount = '',
  amountUsd,
  recipientAddress = '',
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const flashAnim    = useRef(new Animated.Value(0)).current;
  const glowAnim     = useRef(new Animated.Value(0)).current;
  const checkAnim    = useRef(new Animated.Value(0)).current;
  const contentAnim  = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;

    flashAnim.setValue(0);
    glowAnim.setValue(0);
    checkAnim.setValue(0);
    contentAnim.setValue(0);
    progressAnim.setValue(1);

    // 1 — bright white flash (very short)
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    // 2 — green glow burst from top
    Animated.timing(glowAnim, {
      toValue: 1, duration: 750,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();

    // 3 — check icon spring
    Animated.spring(checkAnim, {
      toValue: 1, delay: 90,
      tension: 170, friction: 9,
      useNativeDriver: true,
    }).start();

    // 4 — content slide up
    Animated.timing(contentAnim, {
      toValue: 1, delay: 210, duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // 5 — countdown progress (not native driver — width interpolation)
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: AUTO_DISMISS_MS,
      useNativeDriver: false,
    }).start();

    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  const shortAddr = (a) => (a ? `${a.slice(0, 6)}···${a.slice(-4)}` : '—');

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.root}>

        {/* White screen flash */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.flash, { opacity: flashAnim }]}
          pointerEvents="none"
        />

        {/* Green radial glow burst from top */}
        <Animated.View
          style={[
            styles.glow,
            {
              backgroundColor: theme.COLORS.primary,
              opacity: glowAnim.interpolate({
                inputRange: [0, 0.15, 1],
                outputRange: [0, 0.65, 0.13],
              }),
              transform: [{
                scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 1] }),
              }],
            },
          ]}
          pointerEvents="none"
        />

        {/* Checkmark icon — centered in upper half */}
        <Animated.View
          style={[styles.checkWrap, { transform: [{ scale: checkAnim }] }]}
          pointerEvents="none"
        >
          <View style={[styles.checkRingOuter, { borderColor: `${theme.COLORS.primary}20` }]} />
          <View style={[styles.checkRingInner, { borderColor: `${theme.COLORS.primary}40` }]} />
          <View style={[styles.checkCircle, { backgroundColor: theme.COLORS.primary }]}>
            <Ionicons name="checkmark" size={56} color="#fff" />
          </View>
        </Animated.View>

        {/* Content — anchored to bottom */}
        <Animated.View
          style={[
            styles.content,
            {
              paddingBottom: insets.bottom + 56,
              opacity: contentAnim,
              transform: [{
                translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }),
              }],
            },
          ]}
        >
          <Text style={styles.sentLabel}>Transaction Sent</Text>

          {/* Amount row */}
          <View style={styles.amountRow}>
            <_Logo uri={tokenLogo} symbol={tokenSymbol} size={40} color={theme.COLORS.primary} />
            <Text style={styles.amountNum}>{tokenAmount}</Text>
            <Text style={styles.amountSym}>{tokenSymbol}</Text>
          </View>

          {!!amountUsd && (
            <Text style={styles.usdText}>{amountUsd}</Text>
          )}

          {/* Recipient pill */}
          <View style={styles.addrPill}>
            <Ionicons name="arrow-forward-outline" size={13} color="rgba(255,255,255,0.38)" />
            <Text style={styles.addrText}>{shortAddr(recipientAddress)}</Text>
          </View>

          {/* Countdown progress strip */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.COLORS.primary,
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
              ]}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default TransactionSuccessScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060e09',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flash: {
    backgroundColor: '#fff',
    zIndex: 999,
  },
  glow: {
    position: 'absolute',
    top: -(W * 0.8),
    alignSelf: 'center',
    width: W * 2.4,
    height: W * 2.4,
    borderRadius: W * 1.2,
  },
  checkWrap: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkRingOuter: {
    position: 'absolute',
    width: 158,
    height: 158,
    borderRadius: 79,
    borderWidth: 1,
  },
  checkRingInner: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1,
  },
  checkCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  sentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.30)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 22,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  amountNum: {
    fontSize: 46,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1.5,
    includeFontPadding: false,
  },
  amountSym: {
    fontSize: 22,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.50)',
    marginTop: 10,
  },
  usdText: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.40)',
    marginBottom: 26,
  },
  addrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    marginBottom: 42,
  },
  addrText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  progressTrack: {
    width: W * 0.48,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    borderRadius: 1,
  },
});
