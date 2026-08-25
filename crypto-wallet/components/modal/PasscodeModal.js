import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PasscodeKeypad } from '../common/PasscodeKeypad';

const PasscodeModal = ({
  visible,
  onClose,
  onSubmit,
  title = 'Enter Passcode',
  subtitle = 'Enter your 6-digit passcode',
}) => {
  const { COLORS, SPACING, FONTS, BORDER_RADIUS } = useTheme();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setError('');
      setLoading(false);
    }
  }, [visible]);

  const handleComplete = async (passcode) => {
    setLoading(true);
    setError('');
    try {
      await onSubmit(passcode);
    } catch (err) {
      setError(err.message || 'Incorrect passcode');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  const s = createStyles(COLORS, SPACING, FONTS, BORDER_RADIUS);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <View style={s.card}>

          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.title}>{title}</Text>
              <Text style={s.subtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity
              style={s.closeBtn}
              onPress={handleClose}
              disabled={loading}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Keypad (no title — header already shows it) */}
          <PasscodeKeypad
            key={visible ? 'open' : 'closed'}
            onComplete={handleComplete}
            error={error}
            style={s.keypadOverride}
          />

          {/* Footer */}
          <Text style={s.securityText}>Your passcode is encrypted and stored securely</Text>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (COLORS, SPACING, FONTS, BORDER_RADIUS) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACING.lg,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: COLORS.surface,
      borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.xl,
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      width: '100%',
      marginBottom: SPACING.md,
    },
    title: {
      fontSize: FONTS.sizes.xl,
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
    },
    closeBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: {
      fontSize: 18,
      color: COLORS.textSecondary,
      fontWeight: '400',
    },
    keypadOverride: {
      paddingHorizontal: 0,
      width: '100%',
    },
    securityText: {
      fontSize: FONTS.sizes.xs,
      color: COLORS.textTertiary,
      textAlign: 'center',
      marginTop: SPACING.lg,
      paddingTop: SPACING.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
      width: '100%',
    },
  });

export default PasscodeModal;
