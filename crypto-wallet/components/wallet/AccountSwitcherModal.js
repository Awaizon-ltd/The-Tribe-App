// components/wallet/AccountSwitcherModal.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, TextInput, Animated, Vibration, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useWallet } from '../../contexts/WalletContext';
import { formatAddress } from '../../utils/Wallet';

const shortAddr = (a) => (a ? `${a.slice(0, 6)}···${a.slice(-4)}` : '');

// ─── PIN pad (minimal, reused within this modal) ──────────────────────────────

const PinEntry = ({ theme, onComplete, onCancel, title, subtitle }) => {
  const insets = useSafeAreaInsets();
  const { COLORS } = theme;
  const [pin, setPin]           = useState('');
  const [submitting, setSubmit] = useState(false);
  const shakeAnim               = useRef(new Animated.Value(0)).current;
  const PIN_LEN = 6;
  const KEYS = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

  useEffect(() => {
    if (pin.length === PIN_LEN && !submitting) {
      setSubmit(true);
      setTimeout(() => onComplete(pin), 100);
    }
  }, [pin]);

  const press = (d) => {
    if (pin.length < PIN_LEN && !submitting) { setPin(p => p + d); Vibration.vibrate(8); }
  };
  const back = () => {
    if (pin.length > 0 && !submitting) { setPin(p => p.slice(0, -1)); Vibration.vibrate(8); }
  };

  return (
    <View style={[s.pinRoot, { backgroundColor: COLORS.background, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
      <TouchableOpacity style={[s.pinClose, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]} onPress={onCancel}>
        <Ionicons name="close" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <View style={s.pinHero}>
        <View style={[s.pinIconCircle, { backgroundColor: `${COLORS.primary}15`, borderColor: `${COLORS.primary}25` }]}>
          <Ionicons name="add-circle-outline" size={30} color={COLORS.primary} />
        </View>
        <Text style={[s.pinTitle, { color: COLORS.text }]}>{title || 'Enter Passcode'}</Text>
        <Text style={[s.pinSub, { color: COLORS.textSecondary }]}>{subtitle || 'Confirm with your 6-digit PIN'}</Text>
      </View>

      <Animated.View style={[s.pinDots, { transform: [{ translateX: shakeAnim }] }]}>
        {[...Array(PIN_LEN)].map((_, i) => (
          <View key={i} style={[s.dot, { borderColor: COLORS.border }, pin.length > i && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]} />
        ))}
      </Animated.View>

      <View style={s.pinKeypad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={s.pinRow}>
            {row.map((key, ki) => {
              if (key === '') return <View key={ki} style={s.pinKey} />;
              if (key === '⌫') return (
                <TouchableOpacity key={ki} style={[s.pinKey, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]} onPress={back} disabled={submitting} activeOpacity={0.6}>
                  <Ionicons name="backspace-outline" size={20} color={pin.length === 0 ? COLORS.textTertiary : COLORS.text} />
                </TouchableOpacity>
              );
              return (
                <TouchableOpacity key={ki} style={[s.pinKey, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]} onPress={() => press(key)} disabled={submitting} activeOpacity={0.6}>
                  <Text style={[s.pinKeyText, { color: COLORS.text }]}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── Main modal ───────────────────────────────────────────────────────────────

const AccountSwitcherModal = ({ visible, onClose }) => {
  const theme = useTheme();
  const { COLORS, FONTS, SPACING } = theme;
  const insets = useSafeAreaInsets();
  const { accounts, activeAccountIndex, switchAccount, addAccount, renameAccount } = useWallet();

  const [view, setView] = useState('list'); // 'list' | 'pin' | 'adding'
  const [renaming, setRenaming] = useState(null); // { index, value }
  const [addError, setAddError] = useState('');

  const resetAndClose = () => {
    setView('list'); setRenaming(null); setAddError('');
    onClose();
  };

  const handleSwitch = async (index) => {
    if (index === activeAccountIndex) { resetAndClose(); return; }
    try { await switchAccount(index); resetAndClose(); }
    catch (e) { Alert.alert('Error', e.message); }
  };

  const handleAddPinComplete = async (passcode) => {
    setView('adding');
    try {
      await addAccount(passcode);
      setView('list');
    } catch (e) {
      setAddError(e.message || 'Failed to add account');
      setView('list');
    }
  };

  const handleRenameConfirm = async () => {
    if (!renaming || !renaming.value.trim()) return;
    try { await renameAccount(renaming.index, renaming.value.trim()); }
    catch {}
    setRenaming(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <View style={s.overlay}>

        {/* ── PIN view ── */}
        {view === 'pin' && (
          <View style={StyleSheet.absoluteFill}>
            <PinEntry
              theme={theme}
              title="Add Account"
              subtitle="Enter your PIN to derive the next account"
              onComplete={handleAddPinComplete}
              onCancel={() => setView('list')}
            />
          </View>
        )}

        {/* ── List view ── */}
        {(view === 'list' || view === 'adding') && (
          <View style={[s.sheet, { backgroundColor: COLORS.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={[s.handle, { backgroundColor: COLORS.border }]} />

            {/* Header */}
            <View style={s.header}>
              <Text style={[s.headerTitle, { color: COLORS.text }]}>Accounts</Text>
              <TouchableOpacity style={[s.headerClose, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]} onPress={resetAndClose}>
                <Ionicons name="close" size={17} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {!!addError && (
              <View style={[s.errorBanner, { backgroundColor: `${COLORS.error}10`, borderColor: `${COLORS.error}25` }]}>
                <Ionicons name="alert-circle-outline" size={14} color={COLORS.error} />
                <Text style={[s.errorText, { color: COLORS.error }]}>{addError}</Text>
                <TouchableOpacity onPress={() => setAddError('')}>
                  <Ionicons name="close" size={14} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {accounts.map((acc) => {
                const isActive = acc.index === activeAccountIndex;
                const isBeingRenamed = renaming?.index === acc.index;

                return (
                  <TouchableOpacity
                    key={acc.index}
                    style={[
                      s.accountRow,
                      { backgroundColor: isActive ? `${COLORS.primary}10` : 'transparent' },
                    ]}
                    onPress={() => handleSwitch(acc.index)}
                    activeOpacity={0.7}
                  >
                    {/* Avatar circle */}
                    <View style={[s.accountAvatar, { backgroundColor: isActive ? COLORS.primary : COLORS.surface }]}>
                      <Text style={[s.accountAvatarText, { color: isActive ? '#fff' : COLORS.textSecondary }]}>
                        {acc.index + 1}
                      </Text>
                    </View>

                    {/* Name + address */}
                    <View style={s.accountInfo}>
                      {isBeingRenamed ? (
                        <TextInput
                          autoFocus
                          style={[s.renameInput, { color: COLORS.text, borderColor: COLORS.primary, backgroundColor: COLORS.surface }]}
                          value={renaming.value}
                          onChangeText={(v) => setRenaming({ index: acc.index, value: v })}
                          onBlur={handleRenameConfirm}
                          onSubmitEditing={handleRenameConfirm}
                          maxLength={20}
                          returnKeyType="done"
                        />
                      ) : (
                        <Text style={[s.accountName, { color: isActive ? COLORS.primary : COLORS.text }]}>
                          {acc.name}
                        </Text>
                      )}
                      <Text style={[s.accountAddr, { color: COLORS.textSecondary }]}>
                        {shortAddr(acc.address)}
                      </Text>
                    </View>

                    {/* Actions */}
                    <View style={s.accountActions}>
                      {isActive && (
                        <View style={[s.activeBadge, { backgroundColor: COLORS.primary }]}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                      <TouchableOpacity
                        style={s.renameBtn}
                        onPress={() => setRenaming({ index: acc.index, value: acc.name })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="pencil-outline" size={14} color={COLORS.textTertiary || COLORS.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Add account button */}
            <TouchableOpacity
              style={[s.addBtn, { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}0c` }]}
              onPress={() => { setAddError(''); setView('pin'); }}
              disabled={view === 'adding'}
              activeOpacity={0.8}
            >
              {view === 'adding' ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              )}
              <Text style={[s.addBtnText, { color: COLORS.primary }]}>
                {view === 'adding' ? 'Adding account…' : 'Add Account'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default AccountSwitcherModal;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 8,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerClose: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, padding: 10, borderWidth: 1, marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 12 },

  accountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, paddingVertical: 11, paddingHorizontal: 10, marginBottom: 4,
  },
  accountAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  accountAvatarText: { fontSize: 15, fontWeight: '700' },
  accountInfo: { flex: 1 },
  accountName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  accountAddr: { fontSize: 12 },
  renameInput: {
    fontSize: 14, fontWeight: '600', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 2,
  },
  accountActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeBadge: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  renameBtn: { padding: 4 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 12, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1,
  },
  addBtnText: { fontSize: 15, fontWeight: '700' },

  // PIN
  pinRoot: { flex: 1, paddingHorizontal: 24 },
  pinClose: {
    alignSelf: 'flex-start', width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  pinHero: { alignItems: 'center', marginTop: 32, marginBottom: 8 },
  pinIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: 16,
  },
  pinTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginBottom: 6 },
  pinSub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 24, marginBottom: 36 },
  dot: { width: 13, height: 13, borderRadius: 6.5, borderWidth: 2, backgroundColor: 'transparent' },
  pinKeypad: { gap: 10 },
  pinRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  pinKey: {
    width: 80, height: 68, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  pinKeyText: { fontSize: 24, fontWeight: '300' },
});
