import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

const UserActionsModal = ({
  visible,
  onClose,
  username,
  onDeleteAllMessages,
  onBanUser,
}) => {
  const { COLORS, SPACING, BORDER_RADIUS } = useTheme();

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACING.lg,
    },
    container: {
      backgroundColor: COLORS.surface,
      borderRadius: BORDER_RADIUS.lg,
      width: '100%',
      maxWidth: 400,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: SPACING.lg,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.divider,
      backgroundColor: COLORS.background,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: COLORS.text,
    },
    subtitle: {
      fontSize: 13,
      color: COLORS.textSecondary,
      marginTop: 2,
    },
    closeButton: {
      padding: SPACING.xs,
    },
    actionsContainer: {
      padding: SPACING.sm,
    },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
    },
    actionBorder: {
      borderBottomWidth: 1,
      borderBottomColor: COLORS.divider,
      borderRadius: 0,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionTextContainer: {
      flex: 1,
    },
    actionText: {
      fontSize: 16,
      fontWeight: '500',
    },
    actionDescription: {
      fontSize: 12,
      color: COLORS.textTertiary,
      marginTop: 2,
    },
  });

  const actions = [
    {
      icon: 'trash-outline',
      label: 'Delete All Messages',
      onPress: () => {
        onDeleteAllMessages();
        onClose();
      },
      color: COLORS.warning || '#FF9500',
      description: `Remove all messages from ${username}`,
    },
    {
      icon: 'ban',
      label: 'Ban User',
      onPress: () => {
        onBanUser();
        onClose();
      },
      color: COLORS.error || '#FF3B30',
      description: 'Remove user and delete all their messages',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Moderate User</Text>
              <Text style={styles.subtitle}>{username}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.actionsContainer}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.action,
                  index < actions.length - 1 && styles.actionBorder,
                ]}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: action.color + '20' }]}>
                  <Ionicons name={action.icon} size={20} color={action.color} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionText, { color: action.color }]}>
                    {action.label}
                  </Text>
                  {action.description && (
                    <Text style={styles.actionDescription}>{action.description}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default UserActionsModal;