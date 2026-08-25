import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBiometricStatus, setupBiometric } from '../../utils/Biometric';
import { useTheme } from '../../contexts/ThemeContext';
import Alert from '../../utils/Alert';
import { PasscodeKeypad } from '../../components/common/PasscodeKeypad';

const SetupBiometricScreen = ({ navigation }) => {
  const [step, setStep] = useState(1); // 1: Enter Passcode, 2: Verify Biometric
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [biometricType, setBiometricType] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const { COLORS, SPACING, FONTS } = useTheme();

  useEffect(() => {
    getBiometricStatus().then(s => setBiometricType(s.type));
  }, []);

  const handlePasscodeComplete = (entered) => {
    setPasscode(entered);
    setError('');
    setStep(2);
  };

  const handleBiometricSetup = async () => {
    if (!biometricType) {
      setError('Biometric type not detected');
      return;
    }
    setIsLoading(true);
    try {
      const result = await setupBiometric(passcode, biometricType);
      if (result.success) {
        Alert.alert(
          'Biometric Enabled',
          `${biometricType.name} has been enabled. You can now use it to unlock the app.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        setError(result.message || 'Failed to set up biometric');
        setStep(1);
        setPasscode('');
        Vibration.vibrate(500);
      }
    } catch (err) {
      console.error('Biometric setup error:', err);
      setError('Failed to set up biometric authentication');
      setStep(1);
      setPasscode('');
      Vibration.vibrate(500);
    } finally {
      setIsLoading(false);
    }
  };

  const s = makeStyles(COLORS, SPACING, FONTS);

  // ── Step 2: Biometric verification ──────────────────────────────────────────
  if (step === 2) {
    return (
      <View style={s.container}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => { setStep(1); setPasscode(''); setError(''); }}
        >
          <Text style={[s.backBtnText, { color: COLORS.text }]}>← Back</Text>
        </TouchableOpacity>

        <View style={s.center}>
          <View style={[s.biometricCircle, { backgroundColor: COLORS.surface }]}>
            <Ionicons
              name={biometricType?.icon || 'finger-print'}
              size={80}
              color={COLORS.primary}
            />
          </View>

          <Text style={s.title}>
            Verify {biometricType?.name || 'Biometric'}
          </Text>
          <Text style={s.subtitle}>
            Place your{' '}
            {biometricType?.type === 'FACIAL_RECOGNITION' ? 'face' : 'finger'}{' '}
            to link your passcode with {biometricType?.name}
          </Text>

          {error ? <Text style={[s.errorText, { color: COLORS.error }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.verifyBtn, { backgroundColor: COLORS.primary }]}
            onPress={handleBiometricSetup}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={s.verifyBtnText}>
              {isLoading ? 'Setting up…' : `Verify ${biometricType?.name || 'Biometric'}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Step 1: Passcode entry ───────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
        <Text style={[s.backBtnText, { color: COLORS.text }]}>← Back</Text>
      </TouchableOpacity>

      <View style={s.center}>
        <PasscodeKeypad
          onComplete={handlePasscodeComplete}
          error={error}
          title="Enter Your Passcode"
          subtitle={`Link your passcode with ${biometricType?.name || 'biometric'}`}
        />
      </View>

      <View style={s.footer}>
        <Text style={s.footerText}>
          Your passcode will be securely stored and auto-filled when you use{' '}
          {biometricType?.name || 'biometric'}
        </Text>
      </View>
    </View>
  );
};

const makeStyles = (COLORS, SPACING, FONTS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  backBtn: {
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  backBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    lineHeight: 22,
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  biometricCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  verifyBtn: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl * 2,
    paddingVertical: SPACING.md,
    borderRadius: 25,
  },
  verifyBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: '#FFF',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: SPACING.md,
  },
  footerText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
});

export default SetupBiometricScreen;
