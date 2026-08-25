// components/dao/chat/ChatMessage.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext'; // Adjust path as needed

export const ChatMessage = ({ message, isOwnMessage, userAddress }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const senderShort = `${message.sender.slice(0, 6)}...${message.sender.slice(-4)}`;

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <View style={[
      styles.container,
      isOwnMessage ? styles.ownContainer : styles.otherContainer
    ]}>
      {!isOwnMessage && (
        <Text style={styles.sender}>{message.senderName || senderShort}</Text>
      )}

      <View style={[
        styles.bubble,
        isOwnMessage ? styles.ownBubble : styles.otherBubble
      ]}>
        <Text style={[
          styles.text,
          isOwnMessage ? styles.ownText : styles.otherText
        ]}>
          {message.message}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.time}>{formatTime(message.timestamp)}</Text>
        {message.isEdited && (
          <Text style={styles.edited}>(edited)</Text>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.SPACING.md,
      maxWidth: '80%',
    },
    ownContainer: {
      alignSelf: 'flex-end',
      alignItems: 'flex-end',
    },
    otherContainer: {
      alignSelf: 'flex-start',
      alignItems: 'flex-start',
    },
    sender: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textSecondary,
      marginBottom: 4,
      marginLeft: theme.SPACING.sm,
    },
    bubble: {
      borderRadius: theme.BORDER_RADIUS.md,
      padding: theme.SPACING.md,
      maxWidth: '100%',
    },
    ownBubble: {
      backgroundColor: theme.COLORS.primary,
    },
    otherBubble: {
      backgroundColor: theme.COLORS.surface,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    text: {
      fontSize: theme.FONTS.sizes.md,
      lineHeight: 20,
    },
    ownText: {
      // Was theme.COLORS.surface — that only works if surface happens to be
      // the visual opposite of primary. Use the dedicated on-color token
      // instead, so bubble text contrast can't silently break if surface
      // or primary changes independently.
      color: theme.COLORS.onPrimary,
    },
    otherText: {
      color: theme.COLORS.text,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.xs,
      marginTop: 4,
      marginHorizontal: theme.SPACING.sm,
    },
    time: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textTertiary,
    },
    edited: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textTertiary,
      fontStyle: 'italic',
    },
  });