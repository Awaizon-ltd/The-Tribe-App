// components/dao/details/TreasuryCard.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatNumber } from '../../../utils/helpers';

export const TreasuryCard = ({ getTreasuryBalance, tokenSymbol }) => {
  const theme = useTheme();
  const { COLORS, SHADOWS } = theme;

  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getTreasuryBalance();
        if (!cancelled) setBalance(data);
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <View style={s.container}>
      <Text style={[s.sectionTitle, { color: COLORS.text }]}>DAO Treasury</Text>

      <LinearGradient
        colors={['#1A2100', '#0A0A0A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.card, SHADOWS.medium]}
      >
        {/* Decorative circles — positioned without 'top: auto' */}
        <View style={s.decoA} />
        <View style={s.decoB} />

        <View style={s.content}>
          <View style={s.iconWrap}>
            <Ionicons name="wallet" size={26} color="#D6FF00" />
          </View>

          <View style={s.textBlock}>
            <Text style={s.balanceLabel}>Total Balance</Text>
            {loading ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
            ) : (
              <Text style={s.balanceValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatNumber(balance?.formatted || '0')}
                {tokenSymbol ? (
                  <Text style={s.balanceSymbol}> {tokenSymbol}</Text>
                ) : null}
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  card: {
    borderRadius: 18,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  // Decorative background circles — NO 'top: auto'
  decoA: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(214,255,0,0.10)',
    top: -50, right: -40,
  },
  decoB: {
    position: 'absolute',
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(214,255,0,0.07)',
    bottom: -30, right: 60,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(214,255,0,0.16)',
    justifyContent: 'center', alignItems: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  balanceValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  balanceSymbol: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
});
