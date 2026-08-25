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

const MessageActionsModal = ({
  visible,
  onClose,
  isOwnMessage,
  isAdmin,
  isPinned,
  onDelete,
  onPin,
  onCopy,
  onReport,
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
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: COLORS.text,
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

  const actions = [];

  // Copy text (always available)
  actions.push({
    icon: 'copy-outline',
    label: 'Copy Text',
    onPress: onCopy || onClose,
    color: COLORS.text,
    description: 'Copy message to clipboard',
  });

  // Pin/Unpin - admin only
  if (isAdmin) {
    actions.push({
      icon: isPinned ? 'pin' : 'pin-outline',
      label: isPinned ? 'Unpin Message' : 'Pin Message',
      onPress: onPin,
      color: COLORS.primary,
      description: isPinned ? 'Remove from pinned messages' : 'Pin to top of chat',
    });
  }

  // Delete - available for own messages or admins
  if (isOwnMessage || isAdmin) {
    actions.push({
      icon: 'trash-outline',
      label: 'Delete Message',
      onPress: onDelete,
      color: COLORS.error || '#FF3B30',
      description: isAdmin ? 'Permanently delete this message' : 'Delete your message',
    });
  }

  // Report (for messages that aren't yours)
  if (!isOwnMessage) {
    actions.push({
      icon: 'flag-outline',
      label: 'Report Message',
      onPress: onReport || (() => {
        onClose();
        // This would trigger a report modal in parent component
      }),
      color: COLORS.warning || '#FF9500',
      description: 'Report inappropriate content',
    });
  }

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
            <Text style={styles.title}>Message Options</Text>
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
                onPress={() => {
                  action.onPress();
                  onClose();
                }}
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

export default MessageActionsModal;