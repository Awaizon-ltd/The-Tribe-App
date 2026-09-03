// components/navigation/WalletTabBar.js
// Custom floating pill tab bar for wallet mode — a `tabBar` render-prop
// passed to WalletTabs' <Tab.Navigator>, so React Navigation still owns
// focus/switching state, but layout is fully custom (a rounded pill of 4
// icon slots + a separate circular search button anchored to its right).
// Active state: no background fill behind the icon (previously a white
// circle) — just the filled glyph in the Robinhood-lime accent, plus a
// small dot underneath so the selection still reads clearly without a
// "chip" look.
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

const WalletTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { COLORS, isDark } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        { bottom: insets.bottom + 12 },
      ]}
      pointerEvents="box-none"
    >
      {/* ── Pill: 4 tab slots ── */}
      <View style={[styles.pill, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        <BlurView
          intensity={75}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(10,10,16,0.55)' : 'rgba(255,255,255,0.62)', borderRadius: 999 },
          ]}
        />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const iconName = options.tabBarIconName || 'ellipse';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              style={styles.slot}
            >
              <Ionicons
                name={focused ? iconName : `${iconName}-outline`}
                size={23}
                color={focused ? COLORS.primary : (isDark ? '#8A8F98' : '#9AA0A8')}
              />
              <View style={[styles.dot, { opacity: focused ? 1 : 0, backgroundColor: COLORS.primary }]} />
            </Pressable>
          );
        })}
      </View>

      {/* ── Separate circular search button — pushes a stack screen, not a tab ── */}
      <Pressable
        onPress={() => navigation.getParent()?.navigate('Search')}
        style={[
          styles.searchButton,
          { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
        ]}
      >
        <BlurView
          intensity={75}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(10,10,16,0.55)' : 'rgba(255,255,255,0.62)', borderRadius: 999 },
          ]}
        />
        <Ionicons name="search" size={20} color={COLORS.text} />
      </Pressable>
    </View>
  );
};

const PILL_HEIGHT = 60;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: PILL_HEIGHT,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flex: 1,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  slot: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  searchButton: {
    width: PILL_HEIGHT,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
});

export default WalletTabBar;
