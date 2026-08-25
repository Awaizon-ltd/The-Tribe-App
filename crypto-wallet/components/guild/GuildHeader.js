// GuildHeader.jsx - Reference implementation for displaying unread badge on tabs
// This shows how to update your existing GuildHeader component to display the badge

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

const GuildHeader = ({
  guild,
  isMember,
  membershipStatus,
  joinLoading,
  tokenCheckLoading,
  privacy,
  tokenGatingData,
  hasRequiredToken,
  handleJoinGuild,
  tabs,
  activeTab,
  setActiveTab,
}) => {
  const { COLORS, isDark } = useTheme();

  // Function to format unread count
  const formatUnreadCount = (count) => {
    if (count === 0) return null;
    if (count > 99) return '99+';
    return count.toString();
  };

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Your existing header content (banner, logo, title, join button, etc.) */}
      
      {/* Tabs Section */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const unreadText = tab.unreadCount ? formatUnreadCount(tab.unreadCount) : null;

          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                isActive && [styles.activeTab, { backgroundColor: COLORS.surface }],
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <View style={styles.tabContent}>
                <Ionicons
                  name={tab.icon}
                  size={20}
                  color={isActive ? COLORS.primary : COLORS.textTertiary}
                />
                <Text style={[
                  styles.tabText,
                  { color: COLORS.textTertiary },
                  isActive && { color: COLORS.primary },
                ]}>
                  {tab.name}
                </Text>
                
                {/* Unread badge */}
                {unreadText && (
                  <View style={[
                    styles.unreadBadge,
                    { 
                      backgroundColor: COLORS.error || '#EF4444',
                      borderColor: COLORS.background,
                    },
                  ]}>
                    <Text style={styles.unreadText}>{unreadText}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // backgroundColor applied dynamically
  },
  tabsContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  activeTab: {
    // backgroundColor applied dynamically
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    // color applied dynamically
  },
  unreadBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    // backgroundColor and borderColor applied dynamically
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default GuildHeader;