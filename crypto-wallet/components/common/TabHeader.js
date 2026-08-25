// components/common/TabHeader.js
// Shared header for all main tab screens.
// Sits directly under the status bar (uses useSafeAreaInsets for top padding).
// Screens that use this must render their root as a plain <View>, not <SafeAreaView>.
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import Logo from '../../assets/logo.png'; // adjust path to your actual logo

const HEADER_PADDING_BOTTOM = 6;

/**
 * @param {string}   title
 * @param {string}   [subtitle]
 * @param {React.ReactNode} [left]   Optional element before the title (e.g. avatar)
 * @param {Array}    [rightActions]  [{ icon, onPress, badge?, element? }]
 *                                  Pass element instead of icon for custom JSX
 * @param {boolean}  [border]        Hairline bottom border (default false)
 * @param {boolean}  [showLogo]      Replace title with a centered app logo (Feed, Guilds only)
 */
const TabHeader = ({ title, subtitle, left, rightActions = [], border = false, showLogo = false }) => {
  const { COLORS, FONTS, SPACING, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const s = styles(COLORS, FONTS, SPACING, insets, border);

  return (
    <View style={s.wrapper}>
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

      {/* Centered logo — top/bottom match the wrapper's own padding so this
          box shares the exact same vertical center as the row content below,
          instead of centering over the full box (which includes the inset
          top padding and would sit lower than the icons). */}
      {showLogo && (
        <View style={s.logoWrap} pointerEvents="none">
          <Image source={Logo} style={s.logo} resizeMode="contain" />
        </View>
      )}

      {/* Left slot — fixed width so right slot mirrors it and content stays centered */}
      <View style={s.sideSlot}>{left}</View>

      {/* Title block — hidden in logo mode, kept as a flexible spacer so the
          right actions still land at the edge correctly */}
      {showLogo ? (
        <View style={s.titleBlock} />
      ) : (
        <View style={s.titleBlock}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
      )}

      {/* Right actions */}
      <View style={s.rightSlot}>
        {rightActions.map((action, i) =>
          action.element ? (
            <View key={i}>{action.element}</View>
          ) : (
            <TouchableOpacity
              key={i}
              style={s.iconBtn}
              onPress={action.onPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={action.icon} size={20} color={COLORS.text} />
              {action.badge ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>
                    {action.badge > 9 ? '9+' : action.badge}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )
        )}
      </View>
    </View>
  );
};

const styles = (COLORS, FONTS, SPACING, insets, border) => {
  const paddingTop = insets.top;

  return StyleSheet.create({
    wrapper: {
      position: 'relative',
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop,
   
      paddingHorizontal: SPACING.sm,
      borderBottomWidth: border ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: COLORS.border,
    },
    sideSlot: {
      minWidth: 36,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    titleBlock: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: FONTS.sizes.xl,
      fontWeight: '700',
      color: COLORS.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
      fontWeight: '500',
    },
    rightSlot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
      minWidth: 36,
    },
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: COLORS.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 15,
      height: 15,
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
    logoWrap: {
      position: 'absolute',
      top: paddingTop,
      bottom: HEADER_PADDING_BOTTOM,
      left: 0,
      right: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logo: {
      width: 70,
      height: 70,
    },
  });
};

export default TabHeader;