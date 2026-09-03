// components/navigation/ProfileDrawerContent.js
import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  ScrollView, Switch, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUserData } from '../../contexts/UserDataContext';
import { useWallet } from '../../contexts/WalletContext';
import { useAppMode } from '../../contexts/AppModeContext';
// import { APP_MODES } from '../../contexts/AppModeContext'; // mode-toggle only
// Wallet-mode toggle disabled for now — app stays on Community mode. Re-enable
// by uncommenting these two imports and the pieces marked below.
// import { useChain } from '../../contexts/ChainContext';
// import { SUPPORTED_CHAINS } from '../../constants/Chain';
import { formatAddress } from '../../utils/Wallet';
import ChainSwitcher from '../wallet/ChainSwitcher';
import AccountSwitcherModal from '../wallet/AccountSwitcherModal';
import { navigationRef } from '../../navigation/NavigationService';
import UserLogo from '../../assets/default-icon.png';

const ProfileDrawerContent = ({ navigation }) => {
  const { COLORS, FONTS, SPACING, isDark, toggleTheme } = useTheme();
  const { logout }     = useAuth();
  const { userData }   = useUserData();
  const { wallet, accounts, activeAccountIndex } = useWallet();
  const { isWalletMode } = useAppMode();
  // const { mode, setMode, isSwitching } = useAppMode(); // mode-toggle only
  // const { switchChain, activeChain } = useChain();
  const insets = useSafeAreaInsets();

  const [showChainSwitcher,   setShowChainSwitcher]   = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  // Navigate to a screen in the nested MainStack.
  // Using the root navigationRef avoids the Drawer resetting the stack to
  // [screen] only — the ref navigates at the NavigationContainer level, so
  // React Navigation pushes onto the existing stack and back returns to Main.
  const navigate = (screen) => {
    navigation.closeDrawer();
    navigationRef.current?.navigate(screen);
  };

  const handleLogout = () => { navigation.closeDrawer(); logout(); };

  // Wallet-mode toggle disabled for now — see the commented-out mode bar
  // below. Re-enable by restoring this function and its imports above.
  // const handleModeSwitch = (newMode) => {
  //   if (newMode === mode || isSwitching) return;
  //   navigation.closeDrawer();
  //   setMode(newMode, () => {
  //     if (newMode === APP_MODES.COMMUNITY && activeChain?.id !== SUPPORTED_CHAINS.ROBINHOOD.id) {
  //       switchChain(SUPPORTED_CHAINS.ROBINHOOD).catch(console.error);
  //     }
  //   });
  // };

  // Active account label for the drawer header
  const activeAccount = accounts.find((a) => a.index === activeAccountIndex);
  const accountLabel  = activeAccount?.name || 'Account 1';

  const styles = createStyles(COLORS, FONTS, SPACING);

  // ── Menu item renderer — compact, single-line, minimal vertical rhythm ─────

  const MenuItem = ({ icon, label, onPress, rightElement, tint }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.65}>
      <Ionicons name={icon} size={18} color={tint || COLORS.textSecondary} style={styles.menuIcon} />
      <Text style={styles.menuLabel} numberOfLines={1}>{label}</Text>
      {rightElement || <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary || COLORS.textSecondary} />}
    </TouchableOpacity>
  );

  const SectionTitle = ({ title }) => (
    <Text style={styles.groupTitle}>{title}</Text>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // WALLET MODE MENU
  // ─────────────────────────────────────────────────────────────────────────────

  const WalletMenu = () => (
    <>
      {/* Account switcher — compact inline row instead of its own card */}
      <TouchableOpacity
        style={styles.accountRow}
        onPress={() => { navigation.closeDrawer(); setShowAccountSwitcher(true); }}
        activeOpacity={0.65}
      >
        <View style={[styles.accountAvatar, { backgroundColor: COLORS.primary }]}>
          <Text style={styles.accountAvatarText}>{(activeAccountIndex ?? 0) + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.accountName} numberOfLines={1}>{accountLabel}</Text>
          {wallet?.address && (
            <Text style={styles.accountAddr}>{formatAddress(wallet.address, 6)}</Text>
          )}
        </View>
        <Ionicons name="swap-horizontal-outline" size={16} color={COLORS.primary} />
      </TouchableOpacity>

      <View style={styles.menuGroup}>
        <SectionTitle title="Wallet" />
        <MenuItem
          icon="globe-outline"
          label="Switch Network"
          onPress={() => { navigation.closeDrawer(); setShowChainSwitcher(true); }}
        />
        <MenuItem icon="image-outline" label="NFTs" onPress={() => navigate('NFTs')} />
        <MenuItem icon="compass-outline" label="Browser" onPress={() => navigate('Browser')} />
        <MenuItem icon="person-add-outline" label="Add Account" onPress={() => { navigation.closeDrawer(); setShowAccountSwitcher(true); }} />
        <MenuItem
          icon="key-outline"
          label="Backup Phrase"
          onPress={() => navigate('RecoveryPhrase')}
          tint={COLORS.warning}
        />
      </View>
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // COMMUNITY MODE MENU
  // ─────────────────────────────────────────────────────────────────────────────

  const CommunityMenu = () => (
    <>
      <View style={styles.menuGroup}>
        <SectionTitle title="Account" />
        <MenuItem icon="person-circle-outline" label="My Profile"   onPress={() => navigate('Profile')} />
        <MenuItem icon="create-outline"        label="Edit Profile" onPress={() => navigate('ProfileEdit')} />
      </View>

      <View style={styles.menuGroup}>
        <SectionTitle title="Tools" />
        <MenuItem icon="repeat-outline"  label="Swap"    onPress={() => navigate('Swap')} />
        <MenuItem icon="compass-outline" label="Explore" onPress={() => navigate('Browser')} />
        <MenuItem icon="layers-outline"  label="Tokens"  onPress={() => navigate('Tokens')} />
        <MenuItem icon="image-outline"   label="NFTs"    onPress={() => navigate('NFTs')} />
      </View>

      <View style={styles.menuGroup}>
        <SectionTitle title="Community" />
        <MenuItem
          icon="gift-outline"
          label="Refer Friends"
          onPress={() => navigate('ReferFriends')}
          tint="#D6FF00"
        />
      </View>

      <View style={styles.menuGroup}>
        <SectionTitle title="Support" />
        <MenuItem icon="help-circle-outline" label="Help Center" onPress={() => navigate('Support')} />
        <MenuItem icon="chatbubble-outline"  label="Live Chat"   onPress={() => navigate('LiveChat')} />
      </View>
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* ── Glass background ── */}
      <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? 'rgba(10,10,18,0.78)' : 'rgba(248,248,255,0.80)' },
        ]}
      />

      {/* ── Profile card — avatar side-by-side with user info ── */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(30,35,45,0.90)', 'rgba(15,18,26,0.85)']
            : ['rgba(255,255,255,0.92)', 'rgba(240,242,255,0.88)']
        }
        style={[styles.profileHeader, { paddingTop: insets.top + SPACING.md+2 }]}
      >
        <View style={styles.profileRow}>
          <View style={styles.avatarWrapper}>
            <Image
              source={userData?.profilePicture ? { uri: userData.profilePicture } : UserLogo}
              style={styles.avatar}
            />
            <View style={styles.onlineDot} />
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.displayName} numberOfLines={1}>
              {userData?.displayName || userData?.username || 'Nexus User'}
            </Text>
            {userData?.username && (
              <Text style={styles.username} numberOfLines={1}>@{userData.username}</Text>
            )}

            <View style={styles.pillRow}>
              {wallet?.address && (
                <View style={styles.addressPill}>
                  <Ionicons name="wallet-outline" size={10} color={COLORS.primary} />
                  <Text style={styles.addressText}>{formatAddress(wallet.address, 4)}</Text>
                </View>
              )}
              <View style={[styles.modeChip, { backgroundColor: isWalletMode ? `${COLORS.primary}18` : `${COLORS.info || '#2196F3'}18` }]}>
                <Ionicons
                  name={isWalletMode ? 'wallet-outline' : 'grid-outline'}
                  size={10}
                  color={isWalletMode ? COLORS.primary : (COLORS.info || '#2196F3')}
                />
                <Text style={[styles.modeChipText, { color: isWalletMode ? COLORS.primary : (COLORS.info || '#2196F3') }]}>
                  {isWalletMode ? 'Wallet' : 'Community'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ── Scrollable Menu ── */}
      <ScrollView
        style={styles.menuScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACING.lg }}
      >
        {isWalletMode ? <WalletMenu /> : <CommunityMenu />}

        {/* ── Appearance (always visible) ── */}
        <View style={styles.menuGroup}>
          <SectionTitle title="Appearance" />
          <View style={styles.menuItem}>
            <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={18} color={COLORS.textSecondary} style={styles.menuIcon} />
            <Text style={[styles.menuLabel, { flex: 1 }]}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '60' }}
              thumbColor={isDark ? COLORS.primary : COLORS.textTertiary || COLORS.textSecondary}
            />
          </View>
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={17} color={COLORS.error} />
          <Text style={styles.logoutLabel}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Mode toggle bar — pinned bottom ──
          Disabled for now — app stays on Community mode. Re-enable by
          restoring this block, handleModeSwitch above, and the
          mode/setMode/isSwitching + useChain/SUPPORTED_CHAINS imports.
      <View style={[styles.modeBar, { paddingBottom: insets.bottom + SPACING.xs }]}>
        <View style={styles.modeRow}>
          <Text style={styles.modeLabel}>Wallet Mode</Text>
          <Switch
            value={isWalletMode}
            onValueChange={(val) => handleModeSwitch(val ? APP_MODES.WALLET : APP_MODES.COMMUNITY)}
            trackColor={{ false: COLORS.border, true: COLORS.primary + '60' }}
            thumbColor={isWalletMode ? COLORS.primary : COLORS.textTertiary || COLORS.textSecondary}
            disabled={isSwitching}
          />
        </View>
      </View>
      */}

      {/* ── Modals (rendered outside the ScrollView so they cover the full screen) ── */}
      <ChainSwitcher
        visible={showChainSwitcher}
        onClose={() => setShowChainSwitcher(false)}
      />
      <AccountSwitcherModal
        visible={showAccountSwitcher}
        onClose={() => setShowAccountSwitcher(false)}
      />
    </View>
  );
};

const createStyles = (COLORS, FONTS, SPACING) =>
  StyleSheet.create({
    root: { flex: 1, overflow: 'hidden' },

    // ── Profile card ──────────────────────────────────────────────────────
    profileHeader: {
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md+2,
    },
    avatarWrapper: { position: 'relative' },
    avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: COLORS.primary },
    onlineDot: {
      position: 'absolute', bottom: 0, right: 0,
      width: 12, height: 12, borderRadius: 6,
      backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.background,
    },
    profileInfo: { flex: 1, minWidth: 0 },
    displayName: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
    username:    { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 1 },
    pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
    addressPill: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: COLORS.primary + '15',
      paddingHorizontal: 7, paddingVertical: 3,
      borderRadius: 99,
    },
    addressText: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
    modeChip: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99,
    },
    modeChipText: { fontSize: 10, fontWeight: '700' },

    // ── Account row (wallet mode, replaces bulky account pill card) ────────
    accountRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: SPACING.md, marginTop: SPACING.md+2,
      paddingVertical: 8, paddingHorizontal: 10,
      borderRadius: 10, backgroundColor: COLORS.surface,
    },
    accountAvatar: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },
    accountAvatarText: { fontSize: 12, fontWeight: '800', color: '#fff' },
    accountName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
    accountAddr: { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },

    // ── Menu — tight, minimal, single-line rows ─────────────────────────────
    menuScroll: { flex: 1 },
    menuGroup:  { paddingTop: SPACING.md, paddingHorizontal: SPACING.md },
    groupTitle: {
      fontSize: 10, fontWeight: '700', color: COLORS.textTertiary || COLORS.textSecondary,
      textTransform: 'uppercase', letterSpacing: 1,
      marginBottom: 2, paddingHorizontal: 2,
    },
    menuItem: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 9, paddingHorizontal: 2,
    },
    menuIcon: { width: 22, marginRight: 10 },
    menuLabel: { flex: 1, fontSize: FONTS.sizes.md+2, color: COLORS.text, fontWeight: '500' },

    // ── Logout ──────────────────────────────────────────────────────────────
    logoutButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      marginHorizontal: SPACING.md, marginTop: SPACING.md,
      paddingVertical: 11, paddingHorizontal: SPACING.md,
      borderRadius: 10, borderWidth: 1,
      borderColor: COLORS.error + '30', backgroundColor: COLORS.error + '08',
      gap: SPACING.xs,
    },
    logoutLabel: { fontSize: FONTS.sizes.md+2, color: COLORS.error, fontWeight: '600' },

    // ── Mode bar ──────────────────────────────────────────────────────────
    modeBar: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
      paddingHorizontal: SPACING.md, paddingTop: SPACING.xs,
    },
    modeRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 8, paddingHorizontal: 2,
    },
    modeLabel: { fontSize: FONTS.sizes.md+2, fontWeight: '600', color: COLORS.textSecondary, flex: 1 },
  });

export default ProfileDrawerContent;