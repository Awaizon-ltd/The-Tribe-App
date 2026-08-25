import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Clipboard,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useWallet } from '../../contexts/WalletContext';
import { useLoading } from '../../contexts/LoadingContext';
import { useTheme } from '../../contexts/ThemeContext'; // Adjust path as needed
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import { isValidMnemonic } from '../../utils/Wallet';
import { useAuth } from '../../contexts/AuthContext';
import Alert from '../../utils/Alert';

const WalletSetupScreen = ({ navigation, route }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { createWallet, importWallet, loading } = useWallet();
  const { tempCloudPassword, clearTempPassword, user } = useAuth();
  const { showLoading, updateLoading, hideLoading } = useLoading();
  
  // Get cloud password from navigation params (from Register/Login)
  const { cloudPassword: routePassword, isNewUser } = route.params || {};
  const cloudPassword = routePassword || tempCloudPassword; 
  console.log("cloudpassword", cloudPassword)
  
  const [mode, setMode] = useState(null); // 'create' or 'import'
  const [walletName, setWalletName] = useState('Main Wallet');
  const [localPasscode, setLocalPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [errors, setErrors] = useState({});
  const [copied, setCopied] = useState(false);
  
  // Reauthentication modal state
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'create' or 'import'
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!walletName.trim()) {
      newErrors.walletName = 'Wallet name is required';
    }

    if (!localPasscode) {
      newErrors.localPasscode = 'PIN is required';
    } else if (localPasscode.length < 6) {
      newErrors.localPasscode = 'PIN must be at least 6 digits';
    }

    if (localPasscode !== confirmPasscode) {
      newErrors.confirmPasscode = 'PINs do not match';
    }

    if (mode === 'import' && !isValidMnemonic(mnemonic)) {
      newErrors.mnemonic = 'Invalid recovery phrase';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReauthSubmit = async () => {
    if (!reauthPassword.trim()) {
      setReauthError('Password is required');
      return;
    }

    setReauthLoading(true);
    setReauthError('');

    try {
      // Step 1/2: Verifying credentials
      showLoading('Verifying your credentials...', { step: 1, totalSteps: 2 });
      
      const auth = getAuth();
      const currentUser = auth.currentUser || user;

      if (!currentUser) {
        hideLoading();
        setReauthError('No user is currently logged in');
        setReauthLoading(false);
        return;
      }

      if (!currentUser.email) {
        hideLoading();
        setReauthError('User email not found');
        setReauthLoading(false);
        return;
      }

      // Create credential with user's email and entered password
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        reauthPassword
      );

      // Reauthenticate the user
      await reauthenticateWithCredential(currentUser, credential);

      // Step 2/2: Authentication successful
      updateLoading('Authentication successful...', 2);
      await new Promise(resolve => setTimeout(resolve, 300));

      hideLoading();

      // Password is correct, proceed with the pending action
      setShowReauthModal(false);
      
      if (pendingAction === 'create') {
        await proceedWithWalletCreation(reauthPassword);
      } else if (pendingAction === 'import') {
        await proceedWithWalletImport(reauthPassword);
      }
      
      // Clear the reauthentication state
      setReauthPassword('');
      setReauthError('');
      setPendingAction(null);
      setShowPassword(false);
      
    } catch (error) {
      console.error('Reauthentication error:', error);
      hideLoading();
      
      // Handle specific Firebase auth errors
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setReauthError('Incorrect password. Please try again.');
      } else if (error.code === 'auth/too-many-requests') {
        setReauthError('Too many failed attempts. Please try again later.');
      } else if (error.code === 'auth/user-mismatch') {
        setReauthError('User mismatch. Please try again.');
      } else if (error.code === 'auth/user-not-found') {
        setReauthError('User not found. Please log in again.');
      } else if (error.code === 'auth/invalid-email') {
        setReauthError('Invalid email. Please log in again.');
      } else {
        setReauthError('Authentication failed. Please try again.');
      }
    } finally {
      setReauthLoading(false);
    }
  };

  const proceedWithWalletCreation = async (password) => {
    try {
      // Step 1/7: Generating mnemonic
      showLoading('Generating recovery phrase...', { step: 1, totalSteps: 7 });
      
      // Step 2/7: Creating account
      updateLoading('Creating your account...', 2);
      
      // Step 3/7: Encrypting wallet (cloud)
      updateLoading('Encrypting wallet for cloud...', 3);
      
      // Step 4/7: Encrypting wallet (local)
      updateLoading('Encrypting wallet for device...', 4);
      
      // Step 5/7: Saving to database
      updateLoading('Saving to database...', 5);
      
      // Step 6/7: Saving to cloud
      updateLoading('Saving to cloud storage...', 6);
      
      // Step 7/7: Finalizing
      updateLoading('Finalizing wallet setup...', 7);
      
      const result = await createWallet(password, localPasscode, walletName);
      
      hideLoading();
      clearTempPassword();

      setGeneratedMnemonic(result.mnemonic);

      Alert.alert(
        'Important',
        'Please write down your recovery phrase and store it safely. You will need it to recover your wallet.',
        [{ text: 'I Understand' }]
      );
    } catch (error) {
      console.error('Wallet creation error:', error);
      hideLoading();
      Alert.alert('Error', 'Failed to create wallet. Please try again.');
    }
  };

  const proceedWithWalletImport = async (password) => {
    try {
      // Step 1/6: Validating mnemonic
      showLoading('Validating recovery phrase...', { step: 1, totalSteps: 6 });
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 2/6: Restoring account
      updateLoading('Restoring your account...', 2);
      
      // Step 3/6: Encrypting wallet (cloud)
      updateLoading('Encrypting wallet for cloud...', 3);
      
      // Step 4/6: Encrypting wallet (local)
      updateLoading('Encrypting wallet for device...', 4);
      
      // Step 5/6: Saving to database
      updateLoading('Saving to database...', 5);
      
      // Step 6/6: Finalizing
      updateLoading('Finalizing import...', 6);
      
      await importWallet(mnemonic.trim(), password, localPasscode, walletName);

      hideLoading();
      clearTempPassword();
      Alert.alert('Success', 'Wallet imported successfully!');
    } catch (error) {
      console.error('Wallet import error:', error);
      hideLoading();
      Alert.alert('Error', 'Failed to import wallet. Please check your recovery phrase.');
    }
  };

  const handleCreateWallet = async () => {
    if (!validateForm()) return;

    if (!cloudPassword) {
      // No cloud password available, show reauthentication modal
      setPendingAction('create');
      setShowReauthModal(true);
      return;
    }

    await proceedWithWalletCreation(cloudPassword);
  };

  const handleImportWallet = async () => {
    if (!validateForm()) return;

    if (!cloudPassword) {
      // No cloud password available, show reauthentication modal
      setPendingAction('import');
      setShowReauthModal(true);
      return;
    }

    await proceedWithWalletImport(cloudPassword);
  };

  const handleCopyMnemonic = () => {
    Clipboard.setString(generatedMnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseReauthModal = () => {
    if (reauthLoading) return; // Prevent closing while loading
    
    setShowReauthModal(false);
    setReauthPassword('');
    setReauthError('');
    setPendingAction(null);
    setShowPassword(false);
  };

  // Reauthentication Modal - Memoized to prevent re-renders
  const ReauthModal = React.useMemo(() => {
    if (!showReauthModal) return null;
    
    return (
      <Modal
        visible={true}
        transparent
        animationType="fade"
        onRequestClose={handleCloseReauthModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseReauthModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardView}
          >
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="lock-closed" size={48} color={theme.COLORS.primary} />
                </View>
                <Text style={styles.modalTitle}>Confirm Your Identity</Text>
                <Text style={styles.modalSubtitle}>
                  Please enter your account password to encrypt your wallet
                </Text>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.passwordInputContainer}>
                  <Text style={styles.inputLabel}>Account Password</Text>
                  <View style={[
                    styles.passwordInputWrapper,
                    reauthError && styles.passwordInputWrapperError
                  ]}>
                    <Ionicons 
                      name="key" 
                      size={20} 
                      color={theme.COLORS.textSecondary} 
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.passwordInput}
                      value={reauthPassword}
                      onChangeText={(text) => {
                        setReauthPassword(text);
                        if (reauthError) setReauthError('');
                      }}
                      placeholder="Enter your password"
                      placeholderTextColor={theme.COLORS.textSecondary}
                      secureTextEntry={!showPassword}
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!reauthLoading}
                      returnKeyType="done"
                      onSubmitEditing={handleReauthSubmit}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(prev => !prev)}
                      style={styles.eyeIcon}
                      disabled={reauthLoading}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={theme.COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                  {reauthError ? (
                    <Text style={styles.errorText}>{reauthError}</Text>
                  ) : null}
                </View>

                <View style={styles.modalInfoBox}>
                  <Ionicons name="information-circle-outline" size={20} color={theme.COLORS.info || theme.COLORS.primary} />
                  <Text style={styles.modalInfoText}>
                    This password will be used to encrypt and secure your wallet in the cloud.
                  </Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Confirm"
                  onPress={handleReauthSubmit}
                  loading={reauthLoading}
                  fullWidth
                  style={styles.modalConfirmButton}
                />
                <Button
                  title="Cancel"
                  onPress={handleCloseReauthModal}
                  variant="outline"
                  fullWidth
                  disabled={reauthLoading}
                />
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    );
  }, [showReauthModal, reauthPassword, reauthError, reauthLoading, showPassword, theme]);

  // Success screen after wallet creation
  if (generatedMnemonic) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="checkmark-circle" size={80} color={theme.COLORS.success || theme.COLORS.primary} />
            </View>
            <Text style={styles.title}>Wallet Created!</Text>
            <Text style={styles.subtitle}>
              Save your recovery phrase securely
            </Text>
          </View>

          <Card style={styles.mnemonicCard}>
            <View style={styles.mnemonicHeader}>
              <Ionicons name="key" size={24} color={theme.COLORS.primary} />
              <Text style={styles.mnemonicLabel}>Your Recovery Phrase</Text>
            </View>
            
            <View style={styles.mnemonicWrapper}>
              {generatedMnemonic.split(' ').map((word, index) => (
                <View key={index} style={styles.wordChip}>
                  <Text style={styles.wordNumber}>{index + 1}</Text>
                  <Text style={styles.wordText}>{word}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.copyButton}
              onPress={handleCopyMnemonic}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={copied ? "checkmark-circle" : "copy-outline"} 
                size={20} 
                color={copied ? theme.COLORS.success || theme.COLORS.primary : theme.COLORS.primary} 
              />
              <Text style={[styles.copyButtonText, copied && styles.copiedText]}>
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </Text>
            </TouchableOpacity>

            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color={theme.COLORS.warning} />
              <Text style={styles.warningText}>
                Never share this phrase with anyone. Anyone with this phrase can access your wallet.
              </Text>
            </View>
          </Card>

          <Button
            title="I've Saved It Securely"
            onPress={() => setGeneratedMnemonic('')}
            fullWidth
          />
        </ScrollView>
      </View>
    );
  }

  // Mode selection screen
  if (!mode) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="wallet" size={72} color={theme.COLORS.primary} />
            </View>
            <Text style={styles.title}>Setup Your Wallet</Text>
            <Text style={styles.subtitle}>
              Create a new wallet or import an existing one
            </Text>
          </View>

          <View style={styles.options}>
            <TouchableOpacity 
              style={styles.optionCard}
              onPress={() => setMode('create')}
              activeOpacity={0.7}
            >
              <View style={styles.optionIconContainer}>
                <Ionicons name="add-circle" size={56} color={theme.COLORS.primary} />
              </View>
              <Text style={styles.optionTitle}>Create New Wallet</Text>
              <Text style={styles.optionDescription}>
                Generate a new wallet with a recovery phrase
              </Text>
              <View style={styles.arrowContainer}>
                <Ionicons name="arrow-forward" size={20} color={theme.COLORS.primary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionCard}
              onPress={() => setMode('import')}
              activeOpacity={0.7}
            >
              <View style={styles.optionIconContainer}>
                <Ionicons name="download" size={56} color={theme.COLORS.primary} />
              </View>
              <Text style={styles.optionTitle}>Import Wallet</Text>
              <Text style={styles.optionDescription}>
                Restore wallet using recovery phrase
              </Text>
              <View style={styles.arrowContainer}>
                <Ionicons name="arrow-forward" size={20} color={theme.COLORS.primary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Wallet setup form
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backIconButton}
            onPress={() => setMode(null)}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={24} color={theme.COLORS.text} />
          </TouchableOpacity>
          
          <View style={styles.iconContainer}>
            <Ionicons 
              name={mode === 'create' ? 'add-circle' : 'download'} 
              size={64} 
              color={theme.COLORS.primary} 
            />
          </View>
          <Text style={styles.title}>
            {mode === 'create' ? 'Create Wallet' : 'Import Wallet'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'create' 
              ? 'Set up your new wallet securely' 
              : 'Restore your existing wallet'}
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Wallet Name"
            value={walletName}
            onChangeText={setWalletName}
            placeholder="Enter wallet name"
            error={errors.walletName}
            leftIcon={<Ionicons name="wallet-outline" size={20} color={theme.COLORS.textSecondary} />}
            editable={!loading}
          />

          {mode === 'import' && (
            <View style={styles.inputContainer}>
              <Input
                label="Recovery Phrase"
                value={mnemonic}
                onChangeText={setMnemonic}
                placeholder="Enter your 12-word recovery phrase"
                multiline
                numberOfLines={4}
                error={errors.mnemonic}
                leftIcon={<Ionicons name="key-outline" size={20} color={theme.COLORS.textSecondary} />}
                editable={!loading}
              />
              <Text style={styles.helperText}>
                Separate each word with a space
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.passcodeSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="phone-portrait-outline" size={24} color={theme.COLORS.primary} />
              <Text style={styles.sectionTitle}>Device PIN Setup</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Create a simple PIN for quick access on this device
            </Text>

            <Input
              label="Create PIN"
              value={localPasscode}
              onChangeText={setLocalPasscode}
              placeholder="Enter 6 digit PIN"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              error={errors.localPasscode}
              leftIcon={<Ionicons name="keypad-outline" size={20} color={theme.COLORS.textSecondary} />}
              editable={!loading}
            />

            <Input
              label="Confirm PIN"
              value={confirmPasscode}
              onChangeText={setConfirmPasscode}
              placeholder="Re-enter your PIN"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              error={errors.confirmPasscode}
              leftIcon={<Ionicons name="keypad-outline" size={20} color={theme.COLORS.textSecondary} />}
              editable={!loading}
            />
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={theme.COLORS.info || theme.COLORS.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoText}>
                • Your account password encrypts the wallet in the cloud
              </Text>
              <Text style={styles.infoText}>
                • This PIN provides quick access on this device only
              </Text>
              {mode === 'create' && (
                <Text style={styles.infoText}>
                  • You'll receive a 12-word recovery phrase after setup
                </Text>
              )}
            </View>
          </View>

          <Button
            title={mode === 'create' ? 'Create Wallet' : 'Import Wallet'}
            onPress={mode === 'create' ? handleCreateWallet : handleImportWallet}
            loading={loading}
            disabled={loading}
            fullWidth
            style={styles.primaryButton}
          />

          <Button
            title="Back"
            onPress={() => setMode(null)}
            variant="outline"
            fullWidth
            disabled={loading}
            style={styles.backButton}
          />
        </View>
      </ScrollView>

      {/* Reauthentication Modal */}
      {ReauthModal}
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
    },
    content: {
      flex: 1,
      padding: theme.SPACING.lg,
      justifyContent: 'center',
    },
    scrollContent: {
      flexGrow: 1,
      padding: theme.SPACING.lg,
    },
    header: {
      alignItems: 'center',
      marginBottom: theme.SPACING.xxl,
    },
    backIconButton: {
      position: 'absolute',
      left: 0,
      top: 0,
      padding: theme.SPACING.sm,
      zIndex: 1,
    },
    iconContainer: {
      marginBottom: theme.SPACING.lg,
    },
    title: {
      fontSize: theme.FONTS.sizes.xxl,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.sm,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      textAlign: 'center',
      paddingHorizontal: theme.SPACING.lg,
    },
    options: {
      gap: theme.SPACING.lg,
    },
    optionCard: {
      backgroundColor: theme.COLORS.surface,
      borderRadius: 16,
      padding: theme.SPACING.xl,
      alignItems: 'center',
      ...theme.SHADOWS.medium,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    optionIconContainer: {
      marginBottom: theme.SPACING.md,
    },
    optionTitle: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.sm,
    },
    optionDescription: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      textAlign: 'center',
      marginBottom: theme.SPACING.md,
    },
    arrowContainer: {
      marginTop: theme.SPACING.sm,
    },
    form: {
      flex: 1,
    },
    inputContainer: {
      marginBottom: theme.SPACING.md,
    },
    helperText: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textSecondary,
      marginTop: theme.SPACING.xs,
      marginLeft: theme.SPACING.sm,
    },
    divider: {
      height: 1,
      backgroundColor: theme.COLORS.border,
      marginVertical: theme.SPACING.lg,
    },
    passcodeSection: {
      marginBottom: theme.SPACING.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.SPACING.sm,
    },
    sectionTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.text,
      marginLeft: theme.SPACING.sm,
    },
    sectionDescription: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      marginBottom: theme.SPACING.md,
      marginLeft: theme.SPACING.xl,
    },
    infoBox: {
      flexDirection: 'row',
      backgroundColor: theme.COLORS.primaryLight,
      padding: theme.SPACING.md,
      borderRadius: 12,
      marginBottom: theme.SPACING.lg,
      alignItems: 'flex-start',
    },
    infoTextContainer: {
      flex: 1,
      marginLeft: theme.SPACING.sm,
    },
    infoText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
      lineHeight: 20,
      marginBottom: theme.SPACING.xs,
    },
    primaryButton: {
      marginBottom: theme.SPACING.md,
    },
    backButton: {
      marginTop: theme.SPACING.sm,
    },
    mnemonicCard: {
      padding: theme.SPACING.xl,
      marginBottom: theme.SPACING.xl,
    },
    mnemonicHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.SPACING.lg,
    },
    mnemonicLabel: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.text,
      marginLeft: theme.SPACING.sm,
      fontWeight: '600',
    },
    mnemonicWrapper: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.SPACING.sm,
      marginBottom: theme.SPACING.lg,
    },
    wordChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.COLORS.primaryLight,
      paddingVertical: theme.SPACING.sm,
      paddingHorizontal: theme.SPACING.md,
      borderRadius: 8,
      minWidth: '30%',
    },
    wordNumber: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textSecondary,
      marginRight: theme.SPACING.xs,
      fontWeight: '600',
    },
    wordText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
      fontWeight: '500',
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.COLORS.primaryLight,
      padding: theme.SPACING.md,
      borderRadius: 12,
      marginBottom: theme.SPACING.lg,
    },
    copyButtonText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.primary,
      marginLeft: theme.SPACING.sm,
      fontWeight: '600',
    },
    copiedText: {
      color: theme.COLORS.success || theme.COLORS.primary,
    },
    warningBox: {
      flexDirection: 'row',
      backgroundColor: `${theme.COLORS.warning}15`,
      padding: theme.SPACING.md,
      borderRadius: 12,
      alignItems: 'flex-start',
    },
    warningText: {
      flex: 1,
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.warning,
      marginLeft: theme.SPACING.sm,
      lineHeight: 20,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalKeyboardView: {
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.COLORS.surface,
      borderRadius: 20,
      padding: theme.SPACING.xl,
      width: '90%',
      maxWidth: 400,
      ...theme.SHADOWS.large,
    },
    modalHeader: {
      alignItems: 'center',
      marginBottom: theme.SPACING.xl,
    },
    modalIconContainer: {
      marginBottom: theme.SPACING.md,
    },
    modalTitle: {
      fontSize: theme.FONTS.sizes.xl,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.sm,
      textAlign: 'center',
    },
    modalSubtitle: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    modalBody: {
      marginBottom: theme.SPACING.lg,
    },
    passwordInputContainer: {
      marginBottom: theme.SPACING.md,
    },
    inputLabel: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: '600',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.xs,
    },
    passwordInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.COLORS.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      paddingHorizontal: theme.SPACING.md,
    },
    passwordInputWrapperError: {
      borderColor: theme.COLORS.error,
      borderWidth: 2,
    },
    inputIcon: {
      marginRight: theme.SPACING.sm,
    },
    passwordInput: {
      flex: 1,
      height: 48,
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.text,
      paddingVertical: theme.SPACING.sm,
    },
    eyeIcon: {
      padding: theme.SPACING.xs,
      marginLeft: theme.SPACING.sm,
    },
    errorText: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.error,
      marginTop: theme.SPACING.xs,
      marginLeft: theme.SPACING.sm,
    },
    modalInfoBox: {
      flexDirection: 'row',
      backgroundColor: theme.COLORS.primaryLight,
      padding: theme.SPACING.md,
      borderRadius: 12,
      alignItems: 'flex-start',
    },
    modalInfoText: {
      flex: 1,
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.text,
      marginLeft: theme.SPACING.sm,
      lineHeight: 18,
    },
    modalActions: {
      gap: theme.SPACING.md,
    },
    modalConfirmButton: {
      marginBottom: 0,
    },
  });

export default WalletSetupScreen;