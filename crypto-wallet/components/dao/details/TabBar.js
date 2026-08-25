// components/dao/details/TabBar.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext';

const TAB_ICONS = {
  overview: 'grid-outline',
  active:   'flash-outline',
  past:     'archive-outline',
  user:     'bar-chart-outline',
};

const TabButton = ({ id, label, active, onPress, theme }) => {
  const { COLORS, FONTS, SPACING, BORDER_RADIUS } = theme;

  return (
    <TouchableOpacity
      style={[
        styles.tab,
        {
          backgroundColor: active ? COLORS.primary : 'transparent',
          borderColor: active ? COLORS.primary : COLORS.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={TAB_ICONS[id] || 'ellipse-outline'}
        size={15}
        color={active ? COLORS.background : COLORS.textSecondary}
      />
      <Text style={[styles.tabText, { color: active ? COLORS.background : COLORS.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export const TabBar = ({ activeTab, onTabChange, isTokenHolder }) => {
  const theme = useTheme();
  const { COLORS, FONTS, SPACING } = theme;

  const baseTabs = [
    { id: 'overview', label: 'Overview' },
  ];
  const tokenTabs = [
    { id: 'active', label: 'Active' },
    { id: 'past',   label: 'Past' },
    { id: 'user',   label: 'My Stats' },
  ];

  const tabs = isTokenHolder ? [...baseTabs, ...tokenTabs] : baseTabs;

  return (
    <View style={[styles.container, { backgroundColor: COLORS.surface, borderBottomColor: COLORS.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            id={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            onPress={() => onTabChange(tab.id)}
            theme={theme}
          />
        ))}
      </ScrollView>

      {!isTokenHolder && (
        <View style={[styles.lockBanner, { backgroundColor: COLORS.surface, borderTopColor: COLORS.border }]}>
          <Ionicons name="lock-closed-outline" size={12} color={COLORS.textSecondary} />
          <Text style={[styles.lockText, { color: COLORS.textSecondary }]}>
            Hold governance tokens to access proposals and stats
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  lockText: {
    fontSize: 11,
    fontWeight: '500',
  },
});