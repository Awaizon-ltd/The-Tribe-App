// screens/settings/SettingsScreen.js
//
// Same functionality as before — every handler, Alert, and piece of state
// is unchanged. Restyled to match the grouped-card pattern (Section +
// MenuRow) used on the redesigned ProfileScreen, and emoji icons replaced
// with Ionicons for consistency with the rest of the app.
//
// Left as-is (not my call to change): the commented-out biometric toggle
// and "Manage Wallets" item, and the "Apps" row's onPress still shows
// "Coming Soon" — worth wiring to the mini-app AppScreen now that it
// exists, flagged as a TODO below rather than silently changed.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Image,
  Linking,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useWallet } from '../../contexts/WalletContext';
import { useTheme } from '../../contexts/ThemeContext';
import Button from '../../components/common/Button';
import { APP_CONFIG } from '../../constants/Config';
import {
  hasBiometricHardware,
  isBiometricEnrolled,
  getBiometricTypeName,
  isBiometricEnabled,
  setBiometricEnabled,
  authenticateWithBiometrics,
} from '../../utils/Biometric';
import Alert from '../../utils/Alert';
import AppHeader from '../../components/common/AppHeader';

const SettingsScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { wallet } = useWallet();
  const { COLORS, SPACING, FONTS, BORDER_RADIUS, isDark, toggleTheme } = useTheme();
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const EXTERNAL_LINKS = {
    TERMS_OF_SERVICE: 'https://sysfidao.com/terms',
    PRIVACY_POLICY: 'https://sysfidao.com/policy',
    PLAY_STORE: 'https://play.google.com/store/apps/details?id=com.sysfiprotocol.nexussysfi',
    APP_STORE: 'https://apps.apple.com/app/id123456789',
  };

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await hasBiometricHardware();
      const isEnrolled = await isBiometricEnrolled();
      const typeName = await getBiometricTypeName();
      const isEnabled = await isBiometricEnabled();

      setBiometricAvailable(hasHardware && isEnrolled);
      setBiometricType(typeName);
      setBiometricEnabledState(isEnabled && hasHardware && isEnrolled);
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      setBiometricAvailable(false);
    }
  };

  const handleBiometricToggle = async (value) => {
    if (!biometricAvailable) {
      Alert.alert(
        'Not Available',
        `Please enroll your ${biometricType} in device settings first.`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (value) {
      Alert.alert(
        `Enable ${biometricType}`,
        `Enter your 6-digit PIN to link it with ${biometricType}. You'll be able to unlock using ${biometricType} instead of typing your PIN.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => navigation.navigate('SetupBiometric'),
          },
        ]
      );
    } else {
      Alert.alert(
        'Disable Biometric Authentication',
        `Are you sure you want to disable ${biometricType}? You will need to enter your PIN manually to unlock.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              await setBiometricEnabled(false);
              setBiometricEnabledState(false);
              Alert.alert('Disabled', `${biometricType} has been disabled.`);
            },
          },
        ]
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleBackupWallet = () => {
    Alert.alert(
      'Backup Wallet',
      'Your wallet is automatically backed up to secure cloud with your password. Make sure you have saved your recovery phrase in case you forgot your password.',
      [{ text: 'OK' }]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear cached data but will not affect your wallet or transactions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: () => {
            Alert.alert('Success', 'Cache cleared successfully');
          },
        },
      ]
    );
  };

  const openExternalLink = async (url, title) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', `Cannot open ${title}. Please try again later.`);
      }
    } catch (error) {
      console.error(`Error opening ${title}:`, error);
      Alert.alert('Error', `Failed to open ${title}. Please try again.`);
    }
  };

  const handleTermsOfService = () => {
    openExternalLink(EXTERNAL_LINKS.TERMS_OF_SERVICE, 'Terms of Service');
  };

  const handlePrivacyPolicy = () => {
    openExternalLink(EXTERNAL_LINKS.PRIVACY_POLICY, 'Privacy Policy');
  };

  const handleRateApp = () => {
    const storeUrl = Platform.OS === 'ios' ? EXTERNAL_LINKS.APP_STORE : EXTERNAL_LINKS.PLAY_STORE;
    const storeName = Platform.OS === 'ios' ? 'App Store' : 'Play Store';
    openExternalLink(storeUrl, storeName);
  };

  const handleSupport = () => {
    navigation.navigate('Support');
  };

  const handleThemeToggle = () => {
    toggleTheme();
    Alert.alert(
      'Theme Changed',
      `Switched to ${!isDark ? 'Dark' : 'Light'} mode`,
      [{ text: 'OK' }]
    );
  };

  const styles = createStyles(COLORS, SPACING, FONTS, BORDER_RADIUS);

  // ── Grouped-list building blocks (matches ProfileScreen's Section/MenuRow) ──

  const Section = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );

  const MenuRow = ({ icon, iconColor, title, subtitle, onPress, danger, showArrow = true, last }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
      style={[styles.row, last && { borderBottomWidth: 0 }]}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: (danger ? COLORS.error : (iconColor || COLORS.primary)) + '14' }]}>
        <Ionicons name={icon} size={17} color={danger ? COLORS.error : (iconColor || COLORS.primary)} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, danger && { color: COLORS.error }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {onPress && showArrow && (
        <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
      )}
    </TouchableOpacity>
  );

  const ToggleRow = ({ icon, iconColor, title, subtitle, value, onValueChange, disabled, last }) => (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <View style={[styles.rowIconWrap, { backgroundColor: (iconColor || COLORS.primary) + '14' }]}>
        <Ionicons name={icon} size={17} color={iconColor || COLORS.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled || loading}
        trackColor={{ false: COLORS.surface, true: COLORS.primary + '80' }}
        thumbColor={value ? COLORS.primary : COLORS.textTertiary}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <AppHeader
        title="Settings"
        onBack={() => navigation.goBack()}
        rightActions={[{ icon: 'help-circle-outline', onPress: () => navigation.navigate('Support') }]}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Profile card ── */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => navigation.navigate('ProfileEdit')}
          activeOpacity={0.7}
        >
          <View style={styles.profileAvatarWrap}>
            {user?.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.profileImageFallback]}>
                <Text style={styles.profileImageFallbackText}>
                  {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>{user?.displayName || 'User'}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{user?.email}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
        </TouchableOpacity>

        {/* ── Account ── */}
        <Section title="Account">
          <MenuRow
            icon="person-outline"
            title="Edit Profile"
            subtitle="Update your name and preferences"
            onPress={() => navigation.navigate('ProfileEdit')}
            last
          />
        </Section>

        {/* ── Wallet ── */}
        <Section title="Wallet">
          {/*
          <MenuRow
            icon="wallet-outline"
            title="Manage Wallets"
            subtitle={`Active: ${wallet?.name || 'No wallet'}`}
            onPress={() => Alert.alert('Coming Soon')}
          />
          */}
          <MenuRow
            icon="key-outline"
            title="Show Recovery Phrase"
            subtitle="View your 12-word recovery phrase"
            onPress={() => navigation.navigate('RecoveryPhrase')}
          />
          <MenuRow
            icon="cloud-upload-outline"
            title="Backup Wallet"
            subtitle="Ensure your wallet is backed up"
            onPress={handleBackupWallet}
            last
          />
          {/* <MenuRow
            icon="lock-closed-outline"
            title="Change Password"
            subtitle="Update your wallet password"
            onPress={() => navigation.navigate('ChangePassword')}
          /> */}
        </Section>

        {/* ── Security ── */}
        <Section title="Security">
          {/* <ToggleRow
            icon="finger-print-outline"
            title={`${biometricType} Authentication`}
            subtitle={biometricAvailable
              ? `Use ${biometricType.toLowerCase()} to unlock app`
              : `${biometricType} not available on this device`
            }
            value={biometricEnabled}
            onValueChange={handleBiometricToggle}
            disabled={!biometricAvailable}
          /> */}
          <MenuRow
            icon="apps-outline"
            title="Apps"
            subtitle="Manage dApp connections"
            // TODO: now that screens/miniapps/AppScreen.js exists as a real
            // app-store directory, this could route there instead of the
            // placeholder alert — leaving as-is since it wasn't part of
            // this redesign's scope.
            onPress={() => Alert.alert('Coming Soon')}
          />
          <MenuRow
            icon="receipt-outline"
            title="Transaction History"
            subtitle="View all your transactions"
            onPress={() => navigation.navigate('Transactions')}
            last
          />
        </Section>

        {/* ── Preferences ── */}
        <Section title="Preferences">
          <ToggleRow
            icon="notifications-outline"
            title="Notifications"
            subtitle="Transaction and price alerts"
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
          />
          <MenuRow
            icon="cash-outline"
            title="Currency"
            subtitle="USD"
            showArrow={false}
          />
          <ToggleRow
            icon="moon-outline"
            title="Dark Mode"
            subtitle={`Currently: ${isDark ? 'Dark' : 'Light'}`}
            value={isDark}
            onValueChange={handleThemeToggle}
          />
          <MenuRow
            icon="trash-outline"
            title="Clear Cache"
            subtitle="Free up storage space"
            onPress={handleClearCache}
            last
          />
        </Section>

        {/* ── About ── */}
        <Section title="About">
          <MenuRow
            icon="information-circle-outline"
            title="App Version"
            subtitle={APP_CONFIG.VERSION}
            showArrow={false}
          />
          <MenuRow
            icon="document-text-outline"
            title="Terms of Service"
            subtitle="View our terms and conditions"
            onPress={handleTermsOfService}
          />
          <MenuRow
            icon="shield-checkmark-outline"
            title="Privacy Policy"
            subtitle="Learn how we protect your data"
            onPress={handlePrivacyPolicy}
          />
          <MenuRow
            icon="chatbubble-ellipses-outline"
            title="Support"
            subtitle="Get help or report issues"
            onPress={handleSupport}
          />
          <MenuRow
            icon="star-outline"
            title="Rate App"
            subtitle="Share your feedback on the store"
            onPress={handleRateApp}
            last
          />
        </Section>

        {/* ── Logout ── */}
        <Button
          title="Logout"
          onPress={handleLogout}
          variant="danger"
          fullWidth
          style={styles.logoutButton}
        />

        <Text style={styles.footer}>
          {APP_CONFIG.APP_NAME} v{APP_CONFIG.VERSION}
        </Text>
      </ScrollView>
    </View>
  );
};

const createStyles = (COLORS, SPACING, FONTS, BORDER_RADIUS) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: SPACING.lg, paddingBottom: 120 },

    // Profile card
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: COLORS.surface,
      borderRadius: (BORDER_RADIUS?.xl) || 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.border,
      padding: SPACING.md,
      marginBottom: SPACING.xl,
    },
    profileAvatarWrap: {
      width: 56, height: 56, borderRadius: 28, overflow: 'hidden',
    },
    profileImage: { width: 56, height: 56, borderRadius: 28 },
    profileImageFallback: {
      backgroundColor: COLORS.primary + '18',
      justifyContent: 'center', alignItems: 'center',
    },
    profileImageFallbackText: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.primary },
    profileInfo: { flex: 1 },
    profileName: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
    profileEmail: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },

    // Grouped section
    section: { marginBottom: SPACING.xl },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: COLORS.textTertiary,
      marginBottom: SPACING.sm,
      marginLeft: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    sectionCard: {
      backgroundColor: COLORS.surface,
      borderRadius: (BORDER_RADIUS?.lg) || 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.border,
      overflow: 'hidden',
    },

    // Row
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: 13,
      paddingHorizontal: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    rowIconWrap: {
      width: 34, height: 34, borderRadius: 10,
      justifyContent: 'center', alignItems: 'center',
    },
    rowText: { flex: 1 },
    rowTitle: { fontSize: FONTS.sizes.md, fontWeight: '500', color: COLORS.text, marginBottom: 2 },
    rowSubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },

    logoutButton: { marginTop: SPACING.sm, marginBottom: SPACING.lg },
    footer: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textTertiary,
      textAlign: 'center',
      marginBottom: SPACING.xl,
    },
  });

export default SettingsScreen;