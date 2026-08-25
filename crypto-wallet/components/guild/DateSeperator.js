import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * DateSeparator Component
 * 
 * Displays smart date separators in chat:
 * - "Today" - for messages from today
 * - "Yesterday" - for messages from yesterday
 * - "Monday" - for messages within the last week (shows day name)
 * - "Mon, Dec 25" - for messages within the last month
 * - "Dec 25" - for older messages in current year
 * - "Dec 25, 2023" - for messages from previous years
 */

const DateSeparator = ({ date }) => {
  const { COLORS, SPACING, BORDER_RADIUS } = useTheme();
  
  const formatDate = (date) => {
    const now = new Date();
    const messageDate = new Date(date);
    
    // Create dates at midnight for accurate day comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDateOnly = new Date(
      messageDate.getFullYear(),
      messageDate.getMonth(),
      messageDate.getDate()
    );
    
    // Calculate difference in days
    const diffTime = today - messageDateOnly;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Today
    if (diffDays === 0) {
      return { text: 'Today', isRecent: true };
    }
    
    // Yesterday
    if (diffDays === 1) {
      return { text: 'Yesterday', isRecent: true };
    }
    
    // Within last 7 days - show day of week
    if (diffDays > 1 && diffDays < 7) {
      const dayName = messageDate.toLocaleDateString('en-US', { weekday: 'long' });
      return { text: dayName, isRecent: true };
    }
    
    // Check if same year
    const currentYear = now.getFullYear();
    const messageYear = messageDate.getFullYear();
    
    // Same year
    if (currentYear === messageYear) {
      // Within last 30 days - show weekday abbreviation
      if (diffDays >= 7 && diffDays < 30) {
        const formatted = messageDate.toLocaleDateString('en-US', { 
          weekday: 'short',
          month: 'short', 
          day: 'numeric'
        });
        return { text: formatted, isRecent: false };
      } else {
        // More than a month ago - just month and day
        const formatted = messageDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        });
        return { text: formatted, isRecent: false };
      }
    } else {
      // Different year - include year
      const formatted = messageDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
      return { text: formatted, isRecent: false };
    }
  };

  const { text, isRecent } = formatDate(date);

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: SPACING.lg,
      paddingHorizontal: SPACING.md,
    },
    line: {
      flex: 1,
      height: 1,
      backgroundColor: COLORS.divider,
    },
    badge: {
      backgroundColor: isRecent ? COLORS.primaryDark : COLORS.surface,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: isRecent ? 0 : 1,
      borderColor: COLORS.divider,
      marginHorizontal: SPACING.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isRecent ? 0.08 : 0.03,
      shadowRadius: 2,
      elevation: isRecent ? 2 : 1,
    },
    dateText: {
      fontSize: 11,
      fontWeight: '600',
      color: isRecent ? COLORS.primary : COLORS.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <View style={styles.badge}>
        <Text style={styles.dateText}>{text}</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
};

export default DateSeparator;