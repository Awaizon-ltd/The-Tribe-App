import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../contexts/AuthContext';
import MessageActionsModal from './MessageActionsModal';
import UserActionsModal from './UserActionsModal';
import { useTheme } from '../../contexts/ThemeContext';
import Alert from '../../utils/Alert';

const ChatMessage = ({
  message,
  isAdmin,
  showAvatar,
  isGrouped,
  onDelete,
  onDeleteAllUserMessages,
  onBanUser,
  onPin,
  onUnpin,
  onRetry,
}) => {
  const { user: currentUser } = useAuth();
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [showUserActions, setShowUserActions] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { COLORS, SPACING, BORDER_RADIUS } = useTheme();

  const AVATAR_SIZE = 26;
  const AVATAR_MARGIN = SPACING.sm - 6;

  // Muted variants of onPrimary for secondary text/icons sitting on a
  // primary-colored bubble (own messages). Hex+alpha works in RN.
  const onPrimaryMuted = `${COLORS.onPrimary}99`; // ~60% opacity
  const onPrimarySubtle = `${COLORS.onPrimary}80`; // ~50% opacity

  const styles = StyleSheet.create({
    container: {
      marginBottom: isGrouped ? SPACING.xs : SPACING.md,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    ownMessageRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
    },
    avatarContainer: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      marginRight: AVATAR_MARGIN,
      justifyContent: 'flex-end',
    },
    ownAvatarContainer: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      marginLeft: AVATAR_MARGIN,
      justifyContent: 'flex-end',
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      // Was COLORS.surface — only worked by coincidence when surface happened
      // to contrast against primary. Use the dedicated on-color token instead.
      color: COLORS.onPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    messageContent: {
      flex: 1,
      maxWidth: '75%',
    },
    ownMessageContent: {
      maxWidth: '75%',
      alignItems: 'flex-end',
    },
    messageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginBottom: SPACING.xs / 2,
      paddingHorizontal: SPACING.xs,
    },
    username: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.text,
    },
    headerTimestamp: {
      fontSize: 11,
      color: COLORS.textTertiary,
    },
    messageBubble: {
      backgroundColor: COLORS.surface,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      borderRadius: BORDER_RADIUS.lg,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    pinnedMessageBubble: {
      backgroundColor: COLORS.surface,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      borderRadius: BORDER_RADIUS.lg,
      borderLeftWidth: 3,
      borderLeftColor: COLORS.primary,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    ownMessageBubble: {
      backgroundColor: COLORS.primary,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      borderRadius: BORDER_RADIUS.lg,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    ownPinnedMessageBubble: {
      backgroundColor: COLORS.primary,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm + 2,
      borderRadius: BORDER_RADIUS.lg,
      borderRightWidth: 3,
      // Was hardcoded '#1C1C1E' — didn't adapt between themes. Uses the
      // on-color token so it stays visible against COLORS.primary in both modes.
      borderRightColor: COLORS.onPrimary,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    messageText: {
      fontSize: 15,
      color: COLORS.text,
      lineHeight: 20,
    },
    ownMessageText: {
      // Was hardcoded '#1C1C1E'. In light mode COLORS.primary (the bubble
      // background) is near-black, so dark text on it was nearly invisible.
      // onPrimary flips correctly per theme (white-on-dark / black-on-light).
      fontSize: 15,
      color: COLORS.onPrimary,
      lineHeight: 20,
    },
    messageFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
      marginTop: 4,
    },
    ownMessageFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
      marginTop: 4,
    },
    timestampText: {
      fontSize: 10,
      color: COLORS.textTertiary,
    },
    ownTimestampText: {
      // Was hardcoded 'rgba(28, 28, 30, 0.6)' — same invisible-in-light-mode bug.
      fontSize: 10,
      color: onPrimaryMuted,
    },
    pinnedIcon: {
      marginRight: 4,
    },
  });

  const isOwnMessage = message.userId === currentUser?.uid;
  const displayName = message.displayName || message.username || 'Unknown User';

  const handleLongPress = () => {
    setShowMessageActions(true);
  };

  const handleAvatarPress = () => {
    if (isAdmin && !isOwnMessage) {
      setShowUserActions(true);
    }
  };

  const handleDeletePress = () => {
    setShowMessageActions(false);
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(message.id),
        },
      ]
    );
  };

  const handlePinToggle = () => {
    setShowMessageActions(false);
    if (message.isPinned) {
      onUnpin(message.id);
    } else {
      onPin(message.id);
    }
  };

  const handleDeleteAllMessages = () => {
    setShowUserActions(false);
    Alert.alert(
      'Delete All Messages',
      `Delete all messages from ${displayName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => onDeleteAllUserMessages(message.userId, displayName),
        },
      ]
    );
  };

  const handleBanUser = () => {
    setShowUserActions(false);
    Alert.alert(
      'Ban User',
      `Ban ${displayName} from this tribe? This will remove them and delete all their messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban',
          style: 'destructive',
          onPress: () => onBanUser(message.userId, displayName),
        },
      ]
    );
  };

  const formatTime = (date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diff = now - messageDate;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) {
      const hours = messageDate.getHours();
      const minutes = messageDate.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes} ${ampm}`;
    }
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }
    return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderTickIcon = () => {
    if (!isOwnMessage) return null;
    if (message._pending) {
      // Was hardcoded rgba(28,28,30,0.5) — same fix as above.
      return <ActivityIndicator size={11} color={onPrimarySubtle} />;
    }
    if (message._failed) {
      return <Ionicons name="alert-circle" size={13} color="#EF4444" />;
    }
    return <Ionicons name="checkmark-done" size={12} color={onPrimarySubtle} />;
  };

  const renderAvatar = () => {
    if (!showAvatar) {
      return null;
    }

    if (!message.userAvatar || imageError) {
      return (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
      );
    }

    return (
      <Image
        source={{ uri: message.userAvatar }}
        style={styles.avatar}
        onError={() => setImageError(true)}
      />
    );
  };

  // Determine bubble style based on pinned status
  const getBubbleStyle = () => {
    if (isOwnMessage) {
      return message.isPinned ? styles.ownPinnedMessageBubble : styles.ownMessageBubble;
    }
    return message.isPinned ? styles.pinnedMessageBubble : styles.messageBubble;
  };

  return (
    <>
      <TouchableOpacity
        onLongPress={message._pending || message._failed ? null : handleLongPress}
        onPress={message._failed ? () => onRetry?.(message.id) : undefined}
        delayLongPress={300}
        activeOpacity={0.9}
        style={[styles.container, (message._pending || message._failed) && { opacity: message._pending ? 0.65 : 1 }]}
      >
        {isOwnMessage ? (
          <View style={styles.ownMessageRow}>
            <View style={styles.ownMessageContent}>
              {showAvatar && (
                <View style={styles.messageHeader}>
                  <Text style={styles.username}>{displayName}</Text>
                  <Text style={styles.headerTimestamp}>{formatTime(message.createdAt)}</Text>
                </View>
              )}

              <View style={[getBubbleStyle(), message._failed && { borderWidth: 1, borderColor: '#EF4444' }]}>
                <Text style={styles.ownMessageText}>{message.text}</Text>
                <View style={styles.ownMessageFooter}>
                  {message.isPinned && (
                    <Ionicons name="pin" size={10} color={onPrimarySubtle} style={styles.pinnedIcon} />
                  )}
                  {message._failed ? (
                    <Text style={{ fontSize: 10, color: '#EF4444' }}>Failed · Tap to retry</Text>
                  ) : (
                    <Text style={styles.ownTimestampText}>{formatTime(message.createdAt)}</Text>
                  )}
                  {renderTickIcon()}
                </View>
              </View>
            </View>

            <View style={styles.ownAvatarContainer}>
              {renderAvatar()}
            </View>
          </View>
        ) : (
          <View style={styles.messageRow}>
            <View style={styles.avatarContainer}>
              {showAvatar ? (
                <TouchableOpacity
                  onPress={handleAvatarPress}
                  disabled={!isAdmin}
                  activeOpacity={0.7}
                >
                  {renderAvatar()}
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.messageContent}>
              {showAvatar && (
                <View style={styles.messageHeader}>
                  <Text style={styles.username}>{displayName}</Text>
                  <Text style={styles.headerTimestamp}>{formatTime(message.createdAt)}</Text>
                </View>
              )}

              <View style={getBubbleStyle()}>
                <Text style={styles.messageText}>{message.text}</Text>
                <View style={styles.messageFooter}>
                  {message.isPinned && (
                    <Ionicons
                      name="pin"
                      size={10}
                      color={COLORS.textTertiary}
                      style={styles.pinnedIcon}
                    />
                  )}
                  <Text style={styles.timestampText}>
                    {formatTime(message.createdAt)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>

      <MessageActionsModal
        visible={showMessageActions}
        onClose={() => setShowMessageActions(false)}
        isOwnMessage={isOwnMessage}
        isAdmin={isAdmin}
        canEdit={false}
        isPinned={message.isPinned}
        onEdit={() => {}}
        onDelete={handleDeletePress}
        onPin={handlePinToggle}
      />

      <UserActionsModal
        visible={showUserActions}
        onClose={() => setShowUserActions(false)}
        username={displayName}
        onDeleteAllMessages={handleDeleteAllMessages}
        onBanUser={handleBanUser}
      />
    </>
  );
};

export default ChatMessage;