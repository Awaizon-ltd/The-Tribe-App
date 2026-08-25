import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

// Human-readable copy per bridge method — mini-apps never get to write
// their own confirmation text, so a malicious app can't phrase a
// dangerous action to sound harmless.
const METHOD_COPY = {
  'wallet.signMessage': {
    title: 'Sign Message',
    describe: (params) => `Sign this message with your wallet:\n\n"${params?.message ?? ''}"`,
    needsPasscode: true,
  },
  'wallet.sendTx': {
    title: 'Send Transaction',
    describe: (params) =>
      `Send ${params?.amount ?? '?'} ${params?.token ?? ''} to:\n${params?.to ?? '?'}`,
    needsPasscode: true,
  },
};

const ConfirmActionSheet = ({ visible, method, params, appName, onConfirm, onReject }) => {
  const { COLORS, SPACING, BORDER_RADIUS, FONTS } = useTheme();
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const copy = METHOD_COPY[method] || { title: 'Confirm Action', describe: () => '', needsPasscode: false };

  const styles = createStyles(COLORS, SPACING, BORDER_RADIUS, FONTS);

  const handleConfirm = async () => {
    if (copy.needsPasscode && !passcode) {
      setError('Enter your passcode to continue');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(passcode);
      setPasscode('');
    } catch (err) {
      // Wrong passcode / signer error — keep the sheet open so the user can retry
      // rather than silently rejecting the mini-app's request.
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = () => {
    setPasscode('');
    setError(null);
    onReject();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleReject}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <Text style={styles.appLabel}>{appName} wants to</Text>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.description}>{copy.describe(params)}</Text>

            {copy.needsPasscode && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Passcode"
                  placeholderTextColor={COLORS.textTertiary}
                  secureTextEntry
                  value={passcode}
                  onChangeText={(t) => { setPasscode(t); setError(null); }}
                  editable={!submitting}
                  autoFocus
                />
                {error && <Text style={styles.error}>{error}</Text>}
              </>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.rejectButton]}
                onPress={handleReject}
                disabled={submitting}
              >
                <Text style={styles.rejectText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirm}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.onPrimary} />
                ) : (
                  <Text style={styles.confirmText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const createStyles = (COLORS, SPACING, BORDER_RADIUS, FONTS) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: COLORS.card,
      borderTopLeftRadius: BORDER_RADIUS.xl,
      borderTopRightRadius: BORDER_RADIUS.xl,
      padding: SPACING.lg,
      paddingBottom: SPACING.xl,
    },
    appLabel: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
      marginBottom: 2,
    },
    title: {
      fontSize: FONTS.sizes.xl,
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: SPACING.sm,
    },
    description: {
      fontSize: FONTS.sizes.md,
      color: COLORS.textSecondary,
      lineHeight: FONTS.sizes.md * FONTS.lineHeights.normal,
      marginBottom: SPACING.md,
    },
    input: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      fontSize: FONTS.sizes.md,
      color: COLORS.text,
      backgroundColor: COLORS.surface,
      marginBottom: SPACING.xs,
    },
    error: {
      color: COLORS.error,
      fontSize: FONTS.sizes.sm,
      marginBottom: SPACING.sm,
    },
    actions: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: SPACING.md,
    },
    button: {
      flex: 1,
      paddingVertical: SPACING.sm + 2,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rejectButton: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    confirmButton: {
      backgroundColor: COLORS.primary,
    },
    rejectText: {
      color: COLORS.text,
      fontWeight: '600',
      fontSize: FONTS.sizes.md,
    },
    confirmText: {
      color: COLORS.onPrimary,
      fontWeight: '600',
      fontSize: FONTS.sizes.md,
    },
  });

export default ConfirmActionSheet;