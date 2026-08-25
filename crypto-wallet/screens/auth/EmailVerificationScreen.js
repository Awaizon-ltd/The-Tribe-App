import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { sendEmailVerification, reload } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../services/Firebase';
import Alert from '../../utils/Alert';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';



const EmailVerificationScreen = () => {
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const {  refreshUserData } = useAuth();
  const [countdown, setCountdown] = useState(0);
   const { COLORS, SPACING, FONTS } = useTheme();
   
   const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 80,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  email: {
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  instructionsContainer: {
    backgroundColor: COLORS.surface || COLORS.card,
    padding: SPACING.lg,
    borderRadius: 12,
    marginBottom: SPACING.xl,
    width: '100%',
  },
  instructionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  instruction: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  resendButton: {
    backgroundColor: 'transparent',
    padding: SPACING.md,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  resendButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  logoutButton: {
    marginTop: SPACING.lg,
  },
  logoutButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textTertiary,
  },
});

  const currentUser = auth.currentUser;

  useEffect(() => {
    // Send verification email on mount
    handleSendVerification();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendVerification = async () => {
    if (countdown > 0) return;

    if (!currentUser) {
      Alert.alert('Error', 'No user is logged in.');
      return;
    }

    try {
      setSending(true);
      await sendEmailVerification(currentUser);
      Alert.alert('Email Sent', 'Please check your inbox for the verification link.');
      setCountdown(120); // 2 minute cooldown
    } catch (error) {
      console.error('Error sending verification email:', error);
      Alert.alert('Error', 'Failed to send verification email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'No user is logged in.');
      return;
    }

    try {
      setChecking(true);
      await reload(currentUser);

      if (currentUser.emailVerified) {
        // Update Firestore user document
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { emailVerified: true });
         await refreshUserData();

        Alert.alert('Success', 'Email verified');
           
      } else {
        Alert.alert(
          'Not Verified Yet',
          'Please check your email and click the verification link, then try again.'
        );
      }
    } catch (error) {
      console.error('Error checking verification:', error);
      Alert.alert('Error', 'Failed to check verification status.');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          onPress: async () => {
            try {
              await auth.signOut();
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>📧</Text>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We've sent a verification link to{'\n'}
          <Text style={styles.email}>{currentUser?.email}</Text>
        </Text>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionTitle}>Follow these steps:</Text>
          <Text style={styles.instruction}>1. Open your email inbox</Text>
          <Text style={styles.instruction}>2. Click the verification link</Text>
          <Text style={styles.instruction}>3. Return here and check verification</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, checking && styles.buttonDisabled]}
          onPress={handleCheckVerification}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>I've Verified My Email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendButton, countdown > 0 && styles.buttonDisabled]}
          onPress={handleSendVerification}
          disabled={sending || countdown > 0}
        >
          {sending ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <Text style={styles.resendButtonText}>
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Email'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};



export default EmailVerificationScreen;
