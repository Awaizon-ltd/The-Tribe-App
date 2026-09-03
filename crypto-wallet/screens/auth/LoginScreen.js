import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useWallet } from '../../contexts/WalletContext';
import { useLoading } from '../../contexts/LoadingContext';
// Google Sign-In disabled for now — email/password only. Re-enable by
// uncommenting this import and the usages below (search "Google Sign-In").
// import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { isValidEmail } from '../../utils/Validators';
import { useTheme } from '../../contexts/ThemeContext';
import Alert from '../../utils/Alert';

const STEP = {
  IDLE:       'idle',
  SIGNING_IN: 'signing-in',
  DECRYPTING: 'decrypting',
};

const RADIUS = { md: 8, lg: 12, xl: 16, xxl: 28 };

const LoginScreen = ({ navigation }) => {
  const { login, loading: authLoading, user /*, loginWithGoogle, linkGoogleAccount */ } = useAuth();
  const {
    unlockWalletFromFirestore,
    setupLocalPasscode,
    firestoreWalletExists,
    checkingWallet,
    hasLocalPasscode,
  } = useWallet();
  const { showLoading, hideLoading } = useLoading();
  const { COLORS, SPACING, FONTS } = useTheme();
  const insets = useSafeAreaInsets();
  // Google Sign-In disabled for now — email/password only.
  // const { request: googleRequest, promptAsync: promptGoogleAsync, idToken: googleIdToken } = useGoogleAuth();

  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [errors,          setErrors]          = useState({});
  const [step,            setStep]            = useState(STEP.IDLE);

  const [showPasscodeSetup,  setShowPasscodeSetup]  = useState(false);
  const [newPasscode,        setNewPasscode]        = useState('');
  const [confirmPasscode,    setConfirmPasscode]    = useState('');
  const [decryptedWallet,    setDecryptedWallet]    = useState(null);

  // Google Sign-In disabled for now — email/password only.
  // Was: set when Google sign-in hits auth/account-exists-with-different-credential
  // — the user needs to sign in with their original method below, then the
  // effect that already watches `user` completes the link.
  // const [pendingGoogleLink, setPendingGoogleLink] = useState(null);

  const passwordRef = useRef(password);
  useEffect(() => { passwordRef.current = password; }, [password]);

  // Which method the in-flight sign-in used — decides whether the post-login
  // effect below can auto-attempt a Firestore wallet unlock with the typed
  // password (email/password path) or must leave that to UnlockWalletScreen
  // (Google path — there's no password here to supply).
  const signedInMethodRef = useRef('password');

  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (step === STEP.DECRYPTING) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
    }
  }, [step]);

  const mountAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(mountAnim, {
      toValue: 1, duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const isLoading = authLoading || step !== STEP.IDLE;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.primary },

    // ── Top hero block ──
    hero: {
      paddingTop: insets.top + SPACING.xl,
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.xxl,
    },
    heroBack: {
      width: 36, height: 36, borderRadius: RADIUS.md,
      backgroundColor: `${COLORS.background}22`,
      justifyContent: 'center', alignItems: 'center',
      marginBottom: SPACING.xl,
    },
    heroEyebrow: {
      fontSize: FONTS.sizes.xs,
      fontWeight: '800',
      letterSpacing: 1.5,
      // container's bg is COLORS.primary — was COLORS.background (a
      // "light bg needs light text" assumption that predates the lime accent)
      color: `${COLORS.onPrimary}99`,
      marginBottom: SPACING.sm,
      textTransform: 'uppercase',
    },
    heroTitle: {
      fontSize: 40,
      fontWeight: '900',
      letterSpacing: -1,
      color: COLORS.onPrimary,
      lineHeight: 44,
    },

    // ── Bottom sheet ──
    sheetWrap: { flex: 1 },
    sheet: {
      flex: 1,
      backgroundColor: COLORS.background,
      borderTopLeftRadius: RADIUS.xxl,
      borderTopRightRadius: RADIUS.xxl,
    },
    sheetContent: {
      padding: SPACING.lg,
      paddingBottom: insets.bottom + SPACING.xl,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: COLORS.border,
      marginTop: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    formLabel: {
      fontSize: FONTS.sizes.lg,
      fontWeight: '800',
      color: COLORS.text,
      marginBottom: SPACING.lg,
      letterSpacing: -0.3,
    },
    inputGap: { marginBottom: SPACING.md },
    loginButton: { marginTop: SPACING.sm },

    stepRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', marginTop: SPACING.md, gap: SPACING.xs, minHeight: 20,
    },
    stepText: { fontSize: FONTS.sizes.sm, color: COLORS.primary },
    stepDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },

    divider: {
      flexDirection: 'row', alignItems: 'center',
      marginVertical: SPACING.lg, gap: SPACING.sm,
    },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.divider },
    dividerText: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, letterSpacing: 0.5 },

    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      marginBottom: SPACING.lg,
    },
    footerText: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
    footerLink: { fontSize: FONTS.sizes.md, color: COLORS.text, fontWeight: '800' },

    securityNote: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: SPACING.xs,
    },
    securityText: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },

    // Passcode setup
    infoBox: {
      flexDirection: 'row',
      backgroundColor: COLORS.primaryLight,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      marginBottom: SPACING.md,
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    infoText: {
      flex: 1,
      fontSize: FONTS.sizes.sm,
      color: COLORS.text,
      lineHeight: 20,
    },
    setupButton: { marginTop: SPACING.xs },
    skipButton:  { marginTop: SPACING.sm },
  });

  const validateForm = () => {
    const newErrors = {};
    if (!email.trim())             newErrors.email    = 'Email is required';
    else if (!isValidEmail(email)) newErrors.email    = 'Invalid email format';
    if (!password)                 newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    try {
      signedInMethodRef.current = 'password';
      setStep(STEP.SIGNING_IN);
      await login(email, password);
    } catch (error) {
      setStep(STEP.IDLE);
      let msg = 'Login failed. Please try again.';
      if      (error.code === 'auth/user-not-found')     msg = 'No account found with this email.';
      else if (error.code === 'auth/wrong-password')     msg = 'Incorrect password.';
      else if (error.code === 'auth/invalid-email')      msg = 'Invalid email address.';
      else if (error.code === 'auth/user-disabled')      msg = 'This account has been disabled.';
      else if (error.code === 'auth/invalid-credential') msg = 'Invalid email or password.';
      Alert.alert('Login Error', msg);
    }
  };

  // Google Sign-In disabled for now — email/password only.
  // const handleGoogleIdToken = async (token) => {
  //   try {
  //     signedInMethodRef.current = 'google';
  //     setStep(STEP.SIGNING_IN);
  //     await loginWithGoogle(token);
  //     // No setStep(IDLE) here on success — the effect below (watching `user`)
  //     // picks up from here, same as handleLogin's email/password path.
  //   } catch (err) {
  //     setStep(STEP.IDLE);
  //     if (err.code === 'auth/account-exists-with-different-credential') {
  //       setPendingGoogleLink({ pendingCredential: err.pendingCredential });
  //       Alert.alert(
  //         'Account Already Exists',
  //         err.message ||
  //           `An account already exists for ${err.email}. Sign in below with your original method to link Google to it.`,
  //         [{ text: 'OK' }],
  //       );
  //     } else {
  //       Alert.alert('Google Sign-In Failed', err.message || 'Please try again.');
  //     }
  //   }
  // };
  //
  // useEffect(() => {
  //   if (googleIdToken) {
  //     handleGoogleIdToken(googleIdToken);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [googleIdToken]);

  const attemptWalletUnlock = async () => {
    try {
      setStep(STEP.DECRYPTING);
      showLoading('Decrypting your wallet…');
      const decrypted = await unlockWalletFromFirestore(passwordRef.current);

      if (!hasLocalPasscode) {
        setDecryptedWallet(decrypted);
        setShowPasscodeSetup(true);
      }

      setStep(STEP.IDLE);
    } catch (err) {
      console.error('[LoginScreen] Wallet unlock failed:', err);
      setStep(STEP.IDLE);
      Alert.alert(
        'Wallet Unlock Failed',
        "We couldn't decrypt your wallet. If you recently changed your password, you may need to restore from your seed phrase.",
        [{ text: 'OK' }],
      );
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    if (user && !checkingWallet && step === STEP.SIGNING_IN) {
      // Google Sign-In disabled for now — email/password only, so this was
      // always the password path. (Was: guarded by signedInMethodRef here
      // too, to skip the auto-unlock for Google sign-ins, which have no
      // password to supply — see the commented-out Google block above.)
      if (firestoreWalletExists && signedInMethodRef.current === 'password') {
        attemptWalletUnlock();
      } else {
        setStep(STEP.IDLE);
      }
    }
  }, [user, firestoreWalletExists, checkingWallet, step]);

  const handleSetupPasscode = async () => {
    if (!newPasscode || newPasscode.length < 4) {
      Alert.alert('Error', 'Passcode must be at least 4 digits');
      return;
    }
    if (newPasscode !== confirmPasscode) {
      Alert.alert('Error', 'Passcodes do not match');
      return;
    }
    try {
      await setupLocalPasscode(newPasscode, decryptedWallet);
      Alert.alert(
        'Success',
        'Local passcode set up successfully! You can now use this passcode for quick unlocks.',
        [{
          text: 'OK',
          onPress: () => setShowPasscodeSetup(false),
        }],
      );
    } catch (error) {
      console.error('[LoginScreen] Error setting up passcode:', error);
      Alert.alert('Error', 'Failed to set up passcode. Please try again.');
    }
  };

  const buttonLabel =
    step === STEP.SIGNING_IN ? 'Signing in…' :
    step === STEP.DECRYPTING ? 'Decrypting wallet…' :
    'Sign In';

  // ── Passcode setup screen ──────────────────────────────────────────────
  if (showPasscodeSetup) {
    return (
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>ONE MORE STEP</Text>
          <Text style={styles.heroTitle}>Quick{'\n'}access</Text>
        </View>

        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <View style={styles.sheetHandle} />
              <Text style={styles.formLabel}>Set up your PIN</Text>

              <View style={styles.inputGap}>
                <Input
                  label="Create PIN"
                  value={newPasscode}
                  onChangeText={setNewPasscode}
                  placeholder="Enter 4-6 digit PIN"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  leftIcon={<Ionicons name="keypad-outline" size={20} color={COLORS.textSecondary} />}
                />
              </View>

              <View style={styles.inputGap}>
                <Input
                  label="Confirm PIN"
                  value={confirmPasscode}
                  onChangeText={setConfirmPasscode}
                  placeholder="Re-enter your PIN"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  leftIcon={<Ionicons name="keypad-outline" size={20} color={COLORS.textSecondary} />}
                />
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
                <Text style={styles.infoText}>
                  This PIN will only work on this device. You'll still need your account password to access your wallet from other devices.
                </Text>
              </View>

              <Button
                title="Set Up PIN"
                onPress={handleSetupPasscode}
                fullWidth
                style={styles.setupButton}
              />

              <Button
                title="Skip for Now"
                onPress={() => setShowPasscodeSetup(false)}
                variant="outline"
                fullWidth
                style={styles.skipButton}
              />
            </ScrollView>
          </View>
        </View>
      </View>
    );
  }

  // ── Main login screen ──────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Hero block */}
      <Animated.View style={[styles.hero, { opacity: mountAnim }]}>
        <Text style={styles.heroEyebrow}>TRIBE</Text>
        <Text style={styles.heroTitle}>Welcome{'\n'}back</Text>
      </Animated.View>

      {/* Sheet */}
      <View style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.formLabel}>Sign in to your account</Text>

            <View style={styles.inputGap}>
              <Input
                label="Email"
                value={email}
                onChangeText={(text) => { setEmail(text); setErrors(prev => ({ ...prev, email: null })); }}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
                error={errors.email}
                leftIcon={<Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />}
              />
            </View>

            <View style={styles.inputGap}>
              <Input
                label="Password"
                value={password}
                onChangeText={(text) => { setPassword(text); setErrors(prev => ({ ...prev, password: null })); }}
                placeholder="Enter your password"
                secureTextEntry
                editable={!isLoading}
                error={errors.password}
                leftIcon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />}
              />
            </View>

            <Button
              title={buttonLabel}
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
              fullWidth
              style={styles.loginButton}
            />

            {step === STEP.DECRYPTING && (
              <View style={styles.stepRow}>
                <Animated.View style={[styles.stepDot, { opacity: pulseAnim }]} />
                <Text style={styles.stepText}>Decrypting your wallet…</Text>
              </View>
            )}

            {/* Google Sign-In disabled for now — email/password only.
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="Continue with Google"
              onPress={() => promptGoogleAsync()}
              disabled={isLoading || !googleRequest}
              variant="outline"
              fullWidth
              icon={<Ionicons name="logo-google" size={18} color={COLORS.text} />}
            />
            */}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>NEW HERE</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <Text
                style={styles.footerLink}
                onPress={() => !isLoading && navigation.navigate('Register')}
              >
                Create one
              </Text>
            </View>

            <View style={styles.securityNote}>
              <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textTertiary} />
              <Text style={styles.securityText}>Your wallet is encrypted and secure</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;