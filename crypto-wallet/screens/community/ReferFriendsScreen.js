// screens/community/ReferFriendsScreen.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Share, Clipboard, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useWallet } from '../../contexts/WalletContext';
import { useAuth } from '../../contexts/AuthContext';
import AppHeader from '../../components/common/AppHeader';

const PERKS = [
  { icon: 'people-outline',          text: 'Earn rewards when friends join' },
  { icon: 'flash-outline',           text: 'Both you and your friend get bonuses' },
  { icon: 'trending-up-outline',     text: 'Unlock exclusive community features' },
  { icon: 'shield-checkmark-outline',text: 'Grow your reputation in the ecosystem' },
];

const ReferFriendsScreen = ({ navigation }) => {
  const { COLORS, FONTS, SPACING, BORDER_RADIUS } = useTheme();
  const insets  = useSafeAreaInsets();
  const { wallet } = useWallet();
  const { user }   = useAuth();
  const [copied, setCopied] = useState(false);

  // Referral code derived from the wallet address (last 8 chars uppercased)
  const referralCode = wallet?.address
    ? `NEXUS-${wallet.address.slice(-8).toUpperCase()}`
    : 'NEXUS-XXXXXXXX';

  const shareMessage = `Join me on Nexus — the future of decentralized communities!\n\nUse my referral code: ${referralCode}\n\nhttps://nexus.sysfi.io/join`;

  const handleCopy = () => {
    Clipboard.setString(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = () => {
    Share.share({ message: shareMessage, title: 'Join Nexus' }).catch(() => {});
  };

  return (
    <View style={[styles.root, { backgroundColor: COLORS.background }]}>
      <AppHeader
        title="Refer Friends"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: `${COLORS.primary}15` }]}>
            <View style={[styles.heroIconInner, { backgroundColor: COLORS.primary }]}>
              <Ionicons name="gift-outline" size={38} color="#fff" />
            </View>
          </View>
          <Text style={[styles.heroTitle, { color: COLORS.text }]}>Invite Friends,{'\n'}Earn Together</Text>
          <Text style={[styles.heroSub, { color: COLORS.textSecondary }]}>
            Share your referral code and both of you unlock rewards when your friend joins Nexus.
          </Text>
        </View>

        {/* Referral code card */}
        <View style={[styles.codeCard, { backgroundColor: COLORS.surface, borderColor: `${COLORS.primary}30` }]}>
          <Text style={[styles.codeLabel, { color: COLORS.textSecondary }]}>Your referral code</Text>
          <Text style={[styles.codeValue, { color: COLORS.primary }]}>{referralCode}</Text>

          <View style={styles.codeActions}>
            <TouchableOpacity
              style={[styles.codeBtn, { backgroundColor: copied ? `${COLORS.primary}18` : COLORS.background, borderColor: COLORS.border }]}
              onPress={handleCopy}
              activeOpacity={0.75}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[styles.codeBtnText, { color: copied ? COLORS.primary : COLORS.textSecondary }]}>
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.codeBtn, styles.codeBtnPrimary, { backgroundColor: COLORS.primary }]}
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <Ionicons name="share-outline" size={16} color="#fff" />
              <Text style={[styles.codeBtnText, { color: '#fff' }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Perks */}
        <Text style={[styles.sectionTitle, { color: COLORS.textTertiary || COLORS.textSecondary }]}>
          WHY REFER
        </Text>
        <View style={[styles.perksCard, { backgroundColor: COLORS.surface }]}>
          {PERKS.map((perk, i) => (
            <View
              key={i}
              style={[
                styles.perkRow,
                i < PERKS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider || COLORS.border },
              ]}
            >
              <View style={[styles.perkIcon, { backgroundColor: `${COLORS.primary}14` }]}>
                <Ionicons name={perk.icon} size={18} color={COLORS.primary} />
              </View>
              <Text style={[styles.perkText, { color: COLORS.text }]}>{perk.text}</Text>
            </View>
          ))}
        </View>

        {/* How it works */}
        <Text style={[styles.sectionTitle, { color: COLORS.textTertiary || COLORS.textSecondary }]}>
          HOW IT WORKS
        </Text>
        {[
          { step: '1', label: 'Share your code', desc: 'Send your unique referral code to friends.' },
          { step: '2', label: 'Friend joins',    desc: 'They sign up on Nexus using your code.' },
          { step: '3', label: 'Both earn',       desc: 'Rewards are credited to both accounts.' },
        ].map((item) => (
          <View key={item.step} style={styles.stepRow}>
            <View style={[styles.stepCircle, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.stepNum}>{item.step}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={[styles.stepLabel, { color: COLORS.text }]}>{item.label}</Text>
              <Text style={[styles.stepDesc,  { color: COLORS.textSecondary }]}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default ReferFriendsScreen;

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  hero: { alignItems: 'center', paddingVertical: 24 },
  heroIcon: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  heroIconInner: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4, marginBottom: 10 },
  heroSub:   { fontSize: 14, textAlign: 'center', lineHeight: 21, paddingHorizontal: 16 },

  codeCard: {
    borderRadius: 16, padding: 20, borderWidth: 1,
    alignItems: 'center', marginBottom: 28,
  },
  codeLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },
  codeValue: { fontSize: 26, fontWeight: '800', letterSpacing: 2, marginBottom: 18 },
  codeActions: { flexDirection: 'row', gap: 10, width: '100%' },
  codeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  codeBtnPrimary: { borderWidth: 0 },
  codeBtnText: { fontSize: 14, fontWeight: '700' },

  sectionTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 10,
  },

  perksCard: { borderRadius: 14, marginBottom: 24, overflow: 'hidden' },
  perkRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 14 },
  perkIcon:  { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  perkText:  { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },

  stepRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  stepCircle:{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNum:   { fontSize: 14, fontWeight: '800', color: '#fff' },
  stepBody:  { flex: 1, paddingTop: 4 },
  stepLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  stepDesc:  { fontSize: 13, lineHeight: 19 },
});
