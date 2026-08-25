// components/dao/chat/ChatInput.js
import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext'; // Adjust path as needed

export const ChatInput = ({ onSend, isLocked, sending }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (!message.trim() || sending || isLocked) return;
    
    onSend(message.trim());
    setMessage('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.container, isLocked && styles.containerDisabled]}>
        <TextInput
          style={styles.input}
          placeholder={isLocked ? "Discussion is locked" : "Type a message..."}
          placeholderTextColor={theme.COLORS.textTertiary}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={500}
          editable={!isLocked && !sending}
        />
        
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!message.trim() || isLocked || sending) && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={!message.trim() || isLocked || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={theme.COLORS.surface} />
          ) : (
            <Ionicons name="send" size={20} color={theme.COLORS.surface} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: theme.SPACING.md,
      borderTopWidth: 1,
      borderTopColor: theme.COLORS.border,
      backgroundColor: theme.COLORS.surface,
    },
    containerDisabled: {
      opacity: 0.6,
    },
    input: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
      borderRadius: theme.BORDER_RADIUS.md,
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      marginRight: theme.SPACING.sm,
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.text,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    sendButton: {
      backgroundColor: theme.COLORS.primary,
      borderRadius: theme.BORDER_RADIUS.md,
      padding: theme.SPACING.md,
      justifyContent: 'center',
      alignItems: 'center',
      width: 48,
      height: 48,
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
  });