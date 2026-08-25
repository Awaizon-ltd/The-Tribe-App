// components/dao/chat/ChatAuthModal.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,

} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext'; // Adjust path as needed
import Alert from '../../../utils/Alert';

export const ChatAuthModal = ({ visible, onClose, onAuthenticate, userAddress, proposalId }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(false);

  const handleAuthenticate = async () => {
    try {
      setLoading(true);
      await onAuthenticate();
      onClose();
    } catch (error) {
      Alert.alert('Authentication Failed', error.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Ionicons name="shield-checkmark" size={48} color={theme.COLORS.primary} />
            <Text style={styles.title}>Authenticate for Chat</Text>
          </View>

          <Text style={styles.description}>
            Sign a message to verify your identity and start chatting on this proposal.
          </Text>

          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Proposal:</Text>
              <Text style={styles.infoValue}>#{proposalId}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Your Address:</Text>
              <Text style={styles.infoValue}>
                {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Valid For:</Text>
              <Text style={styles.infoValue}>24 hours</Text>
            </View>
          </View>

          <Text style={styles.note}>
            <Ionicons name="information-circle" size={16} color={theme.COLORS.textSecondary} />
            {' '}This signature is free and doesn't submit any transactions.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.authButton, loading && styles.authButtonDisabled]}
              onPress={handleAuthenticate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={theme.COLORS.surface} />
              ) : (
                <>
                  <Ionicons name="create-outline" size={20} color={theme.COLORS.surface} />
                  <Text style={styles.authButtonText}>Sign Message</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.SPACING.lg,
    },
    container: {
      backgroundColor: theme.COLORS.background,
      borderRadius: theme.BORDER_RADIUS.lg,
      padding: theme.SPACING.xl,
      width: '100%',
      maxWidth: 400,
      ...theme.SHADOWS.large,
    },
    header: {
      alignItems: 'center',
      marginBottom: theme.SPACING.lg,
    },
    title: {
      fontSize: theme.FONTS.sizes.xl,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginTop: theme.SPACING.md,
    },
    description: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: theme.SPACING.lg,
    },
    infoBox: {
      backgroundColor: theme.COLORS.surface,
      borderRadius: theme.BORDER_RADIUS.md,
      padding: theme.SPACING.md,
      marginBottom: theme.SPACING.md,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.SPACING.sm,
    },
    infoLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
    },
    infoValue: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
      fontWeight: '600',
    },
    note: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      textAlign: 'center',
      marginBottom: theme.SPACING.lg,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.SPACING.md,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: theme.SPACING.md,
      borderRadius: theme.BORDER_RADIUS.md,
      backgroundColor: theme.COLORS.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    cancelButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.text,
    },
    authButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.SPACING.xs,
      paddingVertical: theme.SPACING.md,
      borderRadius: theme.BORDER_RADIUS.md,
      backgroundColor: theme.COLORS.primary,
    },
    authButtonDisabled: {
      opacity: 0.6,
    },
    authButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: 'bold',
      color: theme.COLORS.surface,
    },
  });