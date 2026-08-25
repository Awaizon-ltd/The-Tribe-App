import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';


const ChatLockedBanner = () => {
  const { COLORS, SPACING } = useTheme();
  const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.warningDark,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.warning,
  },
  text: {
    fontSize: 13,
    color: COLORS.warning,
    fontWeight: '500',
  },
});
  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed" size={16} color={COLORS.warning} />
      <Text style={styles.text}>Chat is locked. Only admins can send messages.</Text>
    </View>
  );
};



export default ChatLockedBanner;