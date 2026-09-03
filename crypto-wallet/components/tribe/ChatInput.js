import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Text,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChatInput = ({ onSend, sending, disabled, messageDelay = 0 }) => {
  const [text, setText] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef(null);
  const cooldownTimerRef = useRef(null);
  const { COLORS, SPACING, BORDER_RADIUS } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  const handleSend = async () => {
    if (!text.trim() || sending || cooldown > 0 || disabled) return;

    const messageText = text.trim();
    setText(''); // Clear immediately for better UX

    try {
      await onSend(messageText);

      // Start cooldown if message delay is set
      if (messageDelay > 0) {
        setCooldown(messageDelay);
        cooldownTimerRef.current = setInterval(() => {
          setCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(cooldownTimerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (error) {
      // Restore text on error
      setText(messageText);
      // Error will be handled by parent
    }
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: COLORS.surface,
      borderTopWidth: 1,
      borderTopColor: COLORS.divider,
      paddingBottom: insets.bottom,
    },
    disabledBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      paddingVertical: SPACING.xs,
      backgroundColor: COLORS.background,
    },
    disabledText: {
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    cooldownBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      paddingVertical: SPACING.xs,
      backgroundColor: COLORS.primaryDark,
    },
    cooldownText: {
      fontSize: 12,
      color: COLORS.primary,
      fontWeight: '500',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: SPACING.md,
      gap: SPACING.sm,
    },
    input: {
      flex: 1,
      backgroundColor: COLORS.background,
      borderRadius: BORDER_RADIUS.lg,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      paddingTop: SPACING.sm,
      fontSize: 15,
      color: COLORS.text,
      maxHeight: 100,
      minHeight: 40,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: COLORS.surface,
    },
  });

  const canSend = text.trim().length > 0 && !sending && cooldown === 0 && !disabled;

  return (
    <View style={styles.container}>
      {disabled && (
        <View style={styles.disabledBanner}>
          <Ionicons name="lock-closed" size={14} color={COLORS.textSecondary} />
          <Text style={styles.disabledText}>Chat is locked</Text>
        </View>
      )}

      {cooldown > 0 && (
        <View style={styles.cooldownBanner}>
          <Ionicons name="time-outline" size={14} color={COLORS.primary} />
          <Text style={styles.cooldownText}>
            Wait {cooldown}s before sending another message
          </Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={disabled ? 'Chat is locked' : 'Type a message...'}
          placeholderTextColor={COLORS.textTertiary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          editable={!disabled && !sending}
          returnKeyType="default"
          blurOnSubmit={false}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            !canSend && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.7}
        >
          {sending ? (
            <ActivityIndicator size="small" color={COLORS.surface} />
          ) : (
            <Ionicons
              name="send"
              size={20}
              color={canSend ? COLORS.surface : COLORS.textTertiary}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChatInput;