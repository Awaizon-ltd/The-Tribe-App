import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../../contexts/WalletContext';
import { useLoading } from '../../contexts/LoadingContext';
import { useTheme } from '../../contexts/ThemeContext';
import Alert from '../../utils/Alert';
import { PasscodeKeypad } from '../../components/common/PasscodeKeypad';

const PasscodeSetupScreen = ({ navigation, route }) => {
  const { setupLocalPasscode, decryptedWalletData } = useWallet();
  const { showLoading, updateLoading, hideLoading } = useLoading();
  const { COLORS, SPACING, FONTS } = useTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [firstPasscode, setFirstPasscode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStep1Complete = (passcode) => {
    setFirstPasscode(passcode);
    setError('');
    setStep(2);
  };

  const handleStep2Complete = async (passcode) => {
    if (firstPasscode !== passcode) {
      setError('Passcodes do not match. Try again.');
      Vibration.vibrate(500);
      return;
    }

    try {
      setIsLoading(true);
      showLoading('Encrypting your wallet...', { step: 1, totalSteps: 3 });
      updateLoading('Securing your data...', 2);
      await setupLocalPasscode(firstPasscode, decryptedWalletData);
      updateLoading('Finalizing setup...', 3);
      await new Promise(resolve => setTimeout(resolve, 300));
      hideLoading();

      Alert.alert(
        'Passcode Set',
        'Your passcode has been set up. You can now use it for quick unlocks on this device.',
        [{ text: 'Continue' }]
      );
    } catch (err) {
      console.error('Error setting up passcode:', err);
      hideLoading();
      setError('Failed to set up passcode. Please try again.');
      Alert.alert(
        'Setup Failed',
        'Failed to set up passcode. Please try again.',
        [{
          text: 'OK',
          onPress: () => {
            setStep(1);
            setFirstPasscode('');
            setError('');
          },
        }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 2 && !isLoading) {
      setStep(1);
      setFirstPasscode('');
      setError('');
    }
  };

  const s = makeStyles(COLORS, SPACING, FONTS);

  return (
    <View style={[s.container, { paddingTop: insets.top + SPACING.lg }]}>

      {/* Step indicator */}
      <View style={s.stepRow}>
        <View style={[s.stepDot, s.stepDotActive]} />
        <View style={[s.stepDot, step === 2 && s.stepDotActive]} />
      </View>

      {/* Passcode keypad — key forces remount on step change */}
      <View style={s.center}>
        <PasscodeKeypad
          key={step}
          onComplete={step === 1 ? handleStep1Complete : handleStep2Complete}
          error={step === 2 ? error : ''}
          title={step === 1 ? 'Create Passcode' : 'Confirm Passcode'}
          subtitle={
            step === 1
              ? 'Enter exactly 6 digits for quick access'
              : 'Re-enter your 6-digit passcode to confirm'
          }
        />
      </View>

      {/* Footer */}
      <View style={s.footer}>
        {step === 2 && (
          <TouchableOpacity
            style={s.backBtn}
            onPress={handleBack}
            disabled={isLoading}
          >
            <Text style={[s.backBtnText, { color: COLORS.primary }]}>← Back</Text>
          </TouchableOpacity>
        )}
        {step === 1 && (
          <View style={s.tips}>
            <Text style={s.tipText}>· Must be exactly 6 digits</Text>
            <Text style={s.tipText}>· Avoid patterns like 123456</Text>
          </View>
        )}
        <Text style={s.securityText}>Your passcode is encrypted and secure</Text>
      </View>
    </View>
  );
};

const makeStyles = (COLORS, SPACING, FONTS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  stepDotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  backBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  backBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
  },
  tips: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    gap: SPACING.xs,
    width: '100%',
  },
  tipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  securityText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textTertiary,
  },
});

export default PasscodeSetupScreen;
