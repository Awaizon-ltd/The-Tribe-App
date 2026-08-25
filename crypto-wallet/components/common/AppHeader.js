import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Unified screen header used across all app screens.
 *
 * Props:
 *   title        - Main heading text
 *   subtitle     - Optional secondary line below title
 *   onBack       - When provided, renders a back chevron on the left
 *   rightActions - Array of { icon, onPress, badge? } rendered on the right
 *   bordered     - Show a thin bottom border (default true)
 *   transparent  - Remove background fill (use over imagery)
 */
const AppHeader = ({
  title,
  subtitle,
  onBack,
  rightActions = [],
  bordered = true,
  transparent = false,
}) => {
  const { COLORS, FONTS, SPACING, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const styles = createStyles(COLORS, FONTS, SPACING, insets, bordered, transparent);

  return (
    <View style={styles.wrapper}>
      {!transparent && (
        <>
          <BlurView
            intensity={75}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(10,10,18,0.62)' : 'rgba(255,255,255,0.65)' },
            ]}
          />
        </>
      )}
      <View style={styles.row}>
        {/* Left — back button or spacer */}
        <View style={styles.side}>
          {onBack ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color={COLORS.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} />
          )}
        </View>

        {/* Center — title */}
        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right — action buttons */}
        <View style={[styles.side, styles.sideRight]}>
          {rightActions.slice(0, 3).map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.iconBtn}
              onPress={action.onPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View>
                <Ionicons name={action.icon} size={22} color={COLORS.text} />
                {action.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {action.badge > 9 ? '9+' : action.badge}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
          {/* Pad so the title stays centred when fewer than one action */}
          {rightActions.length === 0 && <View style={styles.iconBtn} />}
        </View>
      </View>
    </View>
  );
};

const createStyles = (COLORS, FONTS, SPACING, insets, bordered, transparent) =>
  StyleSheet.create({
    wrapper: {
      overflow: 'hidden',
      paddingTop: insets.top,
      borderBottomWidth: bordered ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: COLORS.border,
    },
    row: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.sm,
    },
    side: {
      width: 80,
      flexDirection: 'row',
      alignItems: 'center',
    },
    sideRight: {
      justifyContent: 'flex-end',
      gap: 4,
    },
    center: {
      flex: 1,
      alignItems: 'center',
    },
    title: {
      fontSize: FONTS.sizes.base,
      fontWeight: '700',
      color: COLORS.text,
      letterSpacing: 0.2,
    },
    subtitle: {
      fontSize: FONTS.sizes.xs,
      color: COLORS.textSecondary,
      marginTop: 1,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: COLORS.error,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      fontSize: 9,
      color: '#fff',
      fontWeight: '700',
    },
  });

export default AppHeader;
