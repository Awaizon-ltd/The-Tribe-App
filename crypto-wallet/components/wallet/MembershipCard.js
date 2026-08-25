// components/wallet/MembershipCard.js
//
// The visual card that gets captured as an image and shared. Deliberately
// NOT wired to the app's light/dark theme — it's an external asset (shared
// on X, saved to camera roll, etc.) so it should look the same premium
// "black card" regardless of the viewer's or sharer's in-app theme.
//
// Fixed pixel dimensions (not percentages) so the exported PNG is
// consistent no matter what device/screen it's rendered on before capture.

import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const CARD_WIDTH = 340;
const CARD_HEIGHT = 214;

const formatSerial = (address) => {
  if (!address) return '••••  ••••  ••••  ••••';
  const clean = address.replace(/^0x/i, '').toUpperCase();
  const groups = clean.match(/.{1,4}/g)?.slice(0, 4) || [];
  return groups.join('  ');
};

const MembershipCard = forwardRef(
  ({ displayName, username, avatarUri, memberSince, walletAddress, appName = 'TRIBE' }, ref) => {
    const initial = (displayName || username || '?').charAt(0).toUpperCase();

    return (
      // collapsable={false} keeps Android from optimizing this View away,
      // which can produce blank/partial captures with react-native-view-shot.
      <View ref={ref} collapsable={false} style={styles.outer}>
        <LinearGradient
          colors={['#0c0c0c', '#1a1a1a', '#0c0c0c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* diagonal sheen */}
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.06)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* faint hairline grid, credit-card texture */}
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.gridLine, { top: `${28 + i * 24}%` }]} />
          ))}

          {/* top row: brand + chip */}
          <View style={styles.topRow}>
            <View style={styles.brandWrap}>
              <View style={styles.brandDot} />
              <Text style={styles.brandText}>{appName}</Text>
            </View>
            <View style={styles.chipWrap}>
              <Ionicons name="hardware-chip-outline" size={22} color="rgba(255,255,255,0.55)" />
            </View>
          </View>

          {/* identity row */}
          <View style={styles.identityRow}>
            <View style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <Text style={styles.avatarFallback}>{initial}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{displayName || 'Member'}</Text>
              {username ? <Text style={styles.username} numberOfLines={1}>@{username}</Text> : null}
            </View>
          </View>

          {/* masked wallet address, styled like a card number */}
          <Text style={styles.serial}>{formatSerial(walletAddress)}</Text>

          {/* bottom row */}
          <View style={styles.bottomRow}>
            <View>
              <Text style={styles.bottomLabel}>MEMBER SINCE</Text>
              <Text style={styles.bottomValue}>{memberSince || '—'}</Text>
            </View>
            <View style={styles.tierBadge}>
              <Text style={styles.tierText}>MEMBER</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  outer: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 20, overflow: 'hidden' },
  card: { flex: 1, padding: 20, justifyContent: 'space-between', overflow: 'hidden' },

  gridLine: {
    position: 'absolute', left: 0, right: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.06)',
  },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  brandText: { fontSize: 13, fontWeight: '800', letterSpacing: 3, color: '#fff' },
  chipWrap: {
    width: 34, height: 26, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },

  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatar: { width: 44, height: 44 },
  avatarFallback: { fontSize: 17, fontWeight: '800', color: '#fff' },
  name: { fontSize: 16, fontWeight: '800', color: '#fff' },
  username: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 },

  serial: {
    fontSize: 15, fontWeight: '600', letterSpacing: 3,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },

  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bottomLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', marginBottom: 3 },
  bottomValue: { fontSize: 13, fontWeight: '700', color: '#fff' },
  tierBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  tierText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: '#fff' },
});

export default MembershipCard;