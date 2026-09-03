import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  ScrollView,
 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import Alert from '../../utils/Alert';

const AdminControlsModal = ({ visible, onClose, chatSettings, onUpdateSettings }) => {
  const [isLocked, setIsLocked] = useState(false);
  const [messageDelay, setMessageDelay] = useState('0');
  const [saving, setSaving] = useState(false);
  const { COLORS, SPACING, BORDER_RADIUS } = useTheme() ;

  const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '80%',
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
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  content: {
    padding: SPACING.lg,
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  settingDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryDark,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.surface,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.surface,
  },
});
  useEffect(() => {
    if (chatSettings) {
      setIsLocked(chatSettings.isLocked || false);
      setMessageDelay(String(chatSettings.messageDelay || 0));
    }
  }, [chatSettings]);

  const handleSave = async () => {
    const delay = parseInt(messageDelay) || 0;

    if (delay < 0 || delay > 300) {
      Alert.alert('Invalid Delay', 'Message delay must be between 0 and 300 seconds');
      return;
    }

    setSaving(true);
    try {
      await onUpdateSettings({
        isLocked,
        messageDelay: delay,
      });
      onClose();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Chat Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Lock Chat */}
            <View style={styles.setting}>
              <View style={styles.settingLeft}>
                <Ionicons
                  name={isLocked ? 'lock-closed' : 'lock-open'}
                  size={24}
                  color={COLORS.primary}
                />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Lock Chat</Text>
                  <Text style={styles.settingDescription}>
                    Only admins can send messages when locked
                  </Text>
                </View>
              </View>
              <Switch
                value={isLocked}
                onValueChange={setIsLocked}
                trackColor={{ false: COLORS.divider, true: COLORS.primaryDark }}
                thumbColor={isLocked ? COLORS.primary : COLORS.surface}
              />
            </View>

            {/* Message Delay */}
            <View style={styles.setting}>
              <View style={styles.settingLeft}>
                <Ionicons name="time-outline" size={24} color={COLORS.primary} />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Message Delay (seconds)</Text>
                  <Text style={styles.settingDescription}>
                    Cooldown between messages to prevent spam
                  </Text>
                </View>
              </View>
            </View>

            <TextInput
              style={styles.input}
              value={messageDelay}
              onChangeText={setMessageDelay}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={COLORS.textTertiary}
            />

            {/* Info Banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={20} color={COLORS.primary} />
              <Text style={styles.infoText}>
                Admins are not affected by chat lock or message delay
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};



export default AdminControlsModal;