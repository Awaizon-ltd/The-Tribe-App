import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { useWallet } from '../../contexts/WalletContext';
import { useLoading } from '../../contexts/LoadingContext';
import { useTheme } from '../../contexts/ThemeContext';
import { PasscodeKeypad } from '../../components/common/PasscodeKeypad';

const PasscodeUnlockScreen = ({ navigation }) => {
  const { authenticateWithPasscode, wallet } = useWallet();
  const { showLoading, updateLoading, hideLoading } = useLoading();
  const { COLORS, SPACING, FONTS } = useTheme();

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const walletSubtitle = wallet?.address
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : 'Unlock your wallet';

  const handleComplete = async (passcode) => {
    setIsLoading(true);
    try {
      showLoading('Verifying passcode...', { step: 1, totalSteps: 3 });
      await authenticateWithPasscode(passcode);
      updateLoading('Unlocking wallet...', 2);
      await new Promise(resolve => setTimeout(resolve, 300));
      updateLoading('Loading your data...', 3);
      await new Promise(resolve => setTimeout(resolve, 300));
      hideLoading();
      // WalletContext updates isAuthenticated → navigation switches automatically
    } catch (err) {
      console.error('Unlock error:', err);
      hideLoading();
      setError('Incorrect passcode');
      Vibration.vibrate(500);
    } finally {
      setIsLoading(false);
    }
  };

  const s = makeStyles(COLORS, SPACING, FONTS);

  return (
    <View style={s.container}>
      <View style={s.center}>
        <PasscodeKeypad
          onComplete={handleComplete}
          error={error}
          title="Enter Passcode"
          subtitle={walletSubtitle}
        />
      </View>

    </View>
  );
};

const makeStyles = (COLORS, SPACING, FONTS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'space-between',
    paddingBottom: SPACING.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  altBtn: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  altBtnText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
  },
});

export default PasscodeUnlockScreen;
