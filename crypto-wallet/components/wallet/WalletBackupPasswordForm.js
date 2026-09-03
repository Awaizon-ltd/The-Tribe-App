// components/wallet/WalletBackupPasswordForm.js
// For accounts with no password provider (Google-only sign-in) — the app's
// cloud-wallet-encryption model normally reuses the Firebase account
// password as the passphrase, but Google-authenticated accounts never have
// one. This form collects a separate, explicit "Wallet Backup Password"
// instead, used exactly the same way: as the passphrase for the Firestore
// cloud copy (utils/Encryption.js's encryptWallet/unlockWalletFromFirestore).
//
// mode="create": password + confirm, used once at wallet creation.
// mode="restore": single field, used on a new device to decrypt the
//   existing cloud copy — same password the user set in "create" mode,
//   remembered by them (never stored anywhere in plaintext by this app).
//
// The password is held only in this component's local state and handed to
// the caller via onSubmit — never written into any context/global state.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import Input from '../common/Input';
import Button from '../common/Button';
import { validatePassword } from '../../utils/Encryption';

const WalletBackupPasswordForm = ({
  visible,
  mode = 'create', // 'create' | 'restore'
  onSubmit, // (password) => void | Promise<void>
  onCancel,
  loading = false,
  error, // external error (e.g. "Invalid password" from a failed restore attempt)
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const reset = () => {
    setPassword('');
    setConfirmPassword('');
    setLocalError('');
  };

  const handleCancel = () => {
    if (loading) return;
    reset();
    onCancel?.();
  };

  const handleSubmit = () => {
    setLocalError('');

    if (mode === 'create') {
      const check = validatePassword(password);
      if (!check.isValid) {
        setLocalError(
          `Password must be at least ${theme.MIN_PASSWORD_LENGTH || 8} characters, with uppercase, lowercase, and a number.`,
        );
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }
    } else if (!password) {
      setLocalError('Password is required');
      return;
    }

    onSubmit?.(password);
  };

  const title = mode === 'create' ? 'Set a Wallet Backup Password' : 'Restore Your Wallet';
  const subtitle =
    mode === 'create'
      ? "You're signed in with Google, which has no password of its own. This password protects your wallet's cloud backup — you'll need it to restore your wallet on any new device."
      : 'Enter the Wallet Backup Password you set when this wallet was created, to restore it on this device.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleCancel}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.card}>
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={40} color={theme.COLORS.primary} />
              </View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            <View style={styles.body}>
              <Input
                label={mode === 'create' ? 'Backup Password' : 'Wallet Backup Password'}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (localError) setLocalError('');
                }}
                placeholder="Enter password"
                secureTextEntry
                editable={!loading}
                leftIcon={<Ionicons name="key-outline" size={20} color={theme.COLORS.textSecondary} />}
              />

              {mode === 'create' && (
                <Input
                  label="Confirm Backup Password"
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t);
                    if (localError) setLocalError('');
                  }}
                  placeholder="Re-enter password"
                  secureTextEntry
                  editable={!loading}
                  leftIcon={<Ionicons name="key-outline" size={20} color={theme.COLORS.textSecondary} />}
                />
              )}

              {(localError || error) ? (
                <Text style={styles.errorText}>{localError || error}</Text>
              ) : null}

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={18} color={theme.COLORS.primary} />
                <Text style={styles.infoText}>
                  {mode === 'create'
                    ? "This password is separate from Google — we never see or store it. Losing it means losing access to your cloud backup (your recovery phrase still works)."
                    : 'This is not your Google password — it\'s the backup password you created for this wallet specifically.'}
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Button
                title={mode === 'create' ? 'Set Password' : 'Restore Wallet'}
                onPress={handleSubmit}
                loading={loading}
                fullWidth
              />
              <Button title="Cancel" onPress={handleCancel} variant="outline" fullWidth disabled={loading} />
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    keyboardView: {
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      backgroundColor: theme.COLORS.surface,
      borderRadius: 20,
      padding: theme.SPACING.xl,
      width: '90%',
      maxWidth: 400,
      ...theme.SHADOWS.large,
    },
    header: {
      alignItems: 'center',
      marginBottom: theme.SPACING.lg,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.COLORS.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.SPACING.md,
    },
    title: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.sm,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    body: {
      marginBottom: theme.SPACING.lg,
    },
    errorText: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.error,
      marginTop: -theme.SPACING.sm,
      marginBottom: theme.SPACING.sm,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.SPACING.sm,
      backgroundColor: theme.COLORS.primary + '10',
      padding: theme.SPACING.md,
      borderRadius: 12,
      marginTop: theme.SPACING.xs,
    },
    infoText: {
      flex: 1,
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.text,
      lineHeight: 18,
    },
    actions: {
      gap: theme.SPACING.md,
    },
  });

export default WalletBackupPasswordForm;
