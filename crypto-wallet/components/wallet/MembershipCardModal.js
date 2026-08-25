// components/wallet/MembershipCardModal.js
//
// Preview + share flow for the MembershipCard. Capture is done with
// react-native-view-shot; sharing is done with expo-sharing so the native
// share sheet opens and the user can pick X (or anything else).
//
// Note: the OS share sheet can't reliably attach both a free-text caption
// AND a local image together on Android (iOS handles combined
// message+attachment fine, Android generally doesn't for arbitrary apps).
// To keep behavior consistent across platforms without ejecting from Expo,
// we copy the invite caption to the clipboard and prompt the user to paste
// it after picking where to share.
//
// Dependencies to install:
//   npx expo install expo-sharing
//   npx expo install react-native-view-shot   (or: npm install react-native-view-shot)
// If you're running in Expo Go and captures come back blank on Android,
// switch to an EAS development build — view-shot is more reliable there.

import React, { useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import MembershipCard from './MembershipCard';
import Alert from '../../utils/Alert';

// TODO: swap in your real invite/referral link once it exists.
const APP_INVITE_URL = 'https://nexus.app/join';

const MembershipCardModal = ({
  visible,
  onClose,
  COLORS,
  appName = 'NEXUS',
  displayName,
  username,
  avatarUri,
  memberSince,
  walletAddress,
}) => {
  const cardRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!cardRef.current) return;

    try {
      setSharing(true);

      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const referral = username ? `?ref=${username}` : '';
      const caption = `I'm a verified member on ${appName} 🏆\n\nJoin me → ${APP_INVITE_URL}${referral}`;

      await Clipboard.setStringAsync(caption);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          'Caption copied',
          "Sharing isn't available on this device, but your invite caption has been copied to your clipboard."
        );
        return;
      }

      Alert.alert(
        'Caption copied!',
        'Paste it into your post after picking where to share.',
        [
          {
            text: 'OK',
            onPress: () =>
              Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                dialogTitle: 'Share your membership card',
              }),
          },
        ]
      );
    } catch (error) {
      console.error('Error sharing membership card:', error);
      Alert.alert('Error', 'Could not share your membership card. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: COLORS.text }]}>Your Membership Card</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.cardWrap}>
            <MembershipCard
              ref={cardRef}
              appName={appName}
              displayName={displayName}
              username={username}
              avatarUri={avatarUri}
              memberSince={memberSince}
              walletAddress={walletAddress}
            />
          </View>

          <Text style={[styles.hint, { color: COLORS.textTertiary }]}>
            Share it on X to invite friends — we'll copy an invite caption to your clipboard too.
          </Text>

          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: COLORS.primary }, sharing && { opacity: 0.6 }]}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.85}
          >
            {sharing ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <>
                <Ionicons name="share-social-outline" size={18} color={COLORS.onPrimary} />
                <Text style={[styles.shareBtnText, { color: COLORS.onPrimary }]}>Share Card</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  sheet: {
    width: '100%', maxWidth: 400, borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth, padding: 20, alignItems: 'center',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: '800' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  cardWrap: {
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
  },
  hint: { fontSize: 12, textAlign: 'center', lineHeight: 17, marginBottom: 16, paddingHorizontal: 8 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', paddingVertical: 14, borderRadius: 14,
  },
  shareBtnText: { fontSize: 15, fontWeight: '700' },
});

export default MembershipCardModal;