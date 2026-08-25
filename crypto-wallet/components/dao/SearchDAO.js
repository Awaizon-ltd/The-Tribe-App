// components/dao/SearchBar.js
import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext'; // Adjust path as needed

export const SearchBar = ({ value, onChangeText, placeholder }) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Ionicons 
          name="search-outline" 
          size={20} 
          color={theme.COLORS.textTertiary} 
          style={styles.icon} 
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder || 'Search DAOs by name...'}
          placeholderTextColor={theme.COLORS.textSecondary}
          value={value}
          onChangeText={onChangeText}
          selectionColor={theme.COLORS.primary}
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeText('')}
            style={styles.clearButton}
            activeOpacity={0.6}
          >
            <Ionicons name="close-circle" size={20} color={theme.COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 6,
      paddingVertical: theme.SPACING.md - 6,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.COLORS.card,
      borderRadius: theme.BORDER_RADIUS.md + 2,
      paddingHorizontal: theme.SPACING.sm + 6,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      height: 44,
    },
    icon: {
      marginRight: theme.SPACING.md - 6,
    },
    input: {
      flex: 1,
      color: theme.COLORS.text,
      fontSize: theme.FONTS.sizes.md - 1,
    },
    clearButton: {
      padding: theme.SPACING.xs,
    },
  });