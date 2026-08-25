// AppNavigator.js
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../contexts/ThemeContext";
import { useAppMode } from "../contexts/AppModeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Screens ──────────────────────────────────────────────────────────────────
import HomeScreen from "../screens/wallet/HomeScreen";
import SendScreen from "../screens/wallet/SendScreen";
import ReceiveScreen from "../screens/wallet/ReceiveScreen";
import TransactionsScreen from "../screens/wallet/TransactionsScreen";
import TransactionConfirmScreen from "../screens/wallet/TransactionConfirmScreen";
import TokensScreen from "../screens/wallet/TokensScreen";
import TokenImportScreen from "../screens/wallet/TokenImportScreen";
import NFTScreen from "../screens/wallet/NFTScreen";
import TokenDetailScreen from "../screens/wallet/TokenDetailScreen";
import NFTDetailScreen from "../screens/wallet/NFTDetailScreen";
import NFTSendScreen from "../screens/wallet/NFTSendScreen";
import ProfileEditScreen from "../screens/profile/ProfileEditScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import DAOListScreen from "../screens/dao/DAOListScreen";
import LaunchDAOScreen from "../screens/dao/LaunchDaoScreen";
import DAODetailsScreen from "../screens/dao/DAODetailsScreen";
import { CreateProposalForm } from "../screens/dao/CreateProposalForm";
import { ProposalDetailScreen } from "../screens/dao/ProposalDetailScreen";
import AppScreen from "../screens/app/AppSCreen"; 
import RecoveryPhraseScreen from "../screens/wallet/RecoveryPhraseScreen";
import LiveChatScreen from "../screens/settings/LiveChatScreen";
import ArticleDetailScreen from "../screens/settings/AirticleDetailsScreen";
import SupportScreen from "../screens/settings/ChatSupportScreen";
import SetupBiometricScreen from "../screens/auth/SetupBiometricScreen";
import BrowserScreen from "../screens/wallet/DappBrowserScreen";
import SwapScreen from "../screens/swap/SwapNewSCreen";
import MintScreen from "../screens/wallet/MintScreen";
import ReferFriendsScreen from "../screens/community/ReferFriendsScreen";

import ProfileDrawerContent from "../components/navigation/ProfileDrawerContent";
import GuildListScreen       from "../screens/guilds/GuildListScreen";
import GuildInviteScreen     from "../screens/guilds/GuildInviteScreen";
import GuildDetailsScreen    from "../screens/guilds/GuildDetailsScreen";
import CreateGuildScreen     from "../screens/guilds/CreateGuildScreen";
import SearchGuildScreen     from "../screens/guilds/SearchGuildScreen";
import GuildChatScreen       from "../screens/guilds/GuildChatScreen";
import GuildPostScreen       from "../screens/guilds/GuildPostScreen";
import GuildSettingsScreen   from "../screens/guilds/GuildSettingsScreen";
import GuildGovernanceScreen from "../screens/guilds/GuildGovernanceScreen";
import PostDetailScreen      from "../screens/guilds/PostDetailScreen";
import ActivityFeedScreen    from "../screens/feed/ActivityFeedScreen";
import { StatusBar } from "expo-status-bar";
import GuildAppsScreen from "../screens/guilds/GuildAppsScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// ─── Shared tab bar options factory ─────────────────────────────────────────

const makeTabOptions = (COLORS, FONTS, insets, isDark) => ({
  headerShown: false,
  tabBarActiveTintColor: COLORS.primary,
  tabBarInactiveTintColor: COLORS.textTertiary,
  tabBarBackground: () => (
    <>
      <BlurView intensity={75} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? "rgba(8,8,18,0.42)" : "rgba(245,247,255,0.38)" },
        ]}
      />
      <LinearGradient
        colors={
          isDark
            ? ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)", "rgba(0,0,0,0)"]
            : ["rgba(255,255,255,0.90)", "rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]
        }
        locations={[0, 0.28, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: isDark ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,1.0)",
        }}
      />
    </>
  ),
  tabBarStyle: {
    position: "absolute",
    backgroundColor: "transparent",
    borderTopWidth: 0,
    paddingTop: 5,
    paddingBottom: 10 + insets.bottom,
    height: 70 + insets.bottom,
  },
  tabBarLabelStyle: { fontSize: FONTS.sizes.xs, fontWeight: "600" },
});

// ─── Wallet Mode Tabs ─────────────────────────────────────────────────────

const WalletTabs = () => {
  const { COLORS, FONTS, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const tabIcon = (name, focused) => (
    <Ionicons name={focused ? name : `${name}-outline`} size={22} color={focused ? COLORS.primary : COLORS.textTertiary} />
  );

  return (
    <Tab.Navigator screenOptions={makeTabOptions(COLORS, FONTS, insets, isDark)}>
      <Tab.Screen
        name="WalletTab"
        component={HomeScreen}
        options={{ tabBarLabel: "Wallet", tabBarIcon: ({ focused }) => tabIcon("wallet", focused) }}
      />
      <Tab.Screen
        name="SwapTab"
        component={SwapScreen}
        options={{ tabBarLabel: "Swap", tabBarIcon: ({ focused }) => tabIcon("repeat", focused) }}
      />
      <Tab.Screen
        name="ActivityTab"
        component={TransactionsScreen}
        options={{ tabBarLabel: "Activity", tabBarIcon: ({ focused }) => tabIcon("time", focused) }}
      />
      <Tab.Screen
        name="ExploreTab"
        component={BrowserScreen}
        options={{ tabBarLabel: "Browser", tabBarIcon: ({ focused }) => tabIcon("compass", focused) }}
      />
    </Tab.Navigator>
  );
};

// ─── Community Mode Tabs ─────────────────────────────────────────────────────
//   Guilds · DAOs · Feed (center) · App · Wallet
//   Feed and Guilds get the Twitter-style centered-logo header.

const CommunityTabs = () => {
  const { COLORS, FONTS, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const tabIcon = (name, focused, size = 22) => (
    <Ionicons name={focused ? name : `${name}-outline`} size={size} color={focused ? COLORS.primary : COLORS.textTertiary} />
  );

  const FeedIcon = ({ focused }) => (
    <Ionicons name={focused ? "flame" : "flame-outline"} size={focused ? 26 : 24} color={focused ? COLORS.primary : COLORS.textTertiary} />
  );

  return (
    <Tab.Navigator initialRouteName="FeedTab" screenOptions={makeTabOptions(COLORS, FONTS, insets, isDark)}>
      {/* Feed — center, Twitter-style header */}
      <Tab.Screen
        name="FeedTab"
        component={ActivityFeedScreen}
        options={({ navigation }) => ({
          tabBarLabel: "Feed",
          tabBarIcon: FeedIcon,
          headerShown: false,
        })}
      />

      {/* Guilds — Twitter-style header */}
      <Tab.Screen
        name="GuildsTab"
        component={GuildListScreen}
        options={({ navigation }) => ({
          tabBarLabel: "Guilds",
          tabBarIcon: ({ focused }) => tabIcon("people", focused),
          headerShown: false,
        })}
      />

      {/* DAOs / Community browser — unchanged */}
      <Tab.Screen
        name="DACTab"
        component={DAOListScreen}
        options={{ tabBarLabel: "DAOs", tabBarIcon: ({ focused }) => tabIcon("grid", focused) }}
      />

      {/* App — replaces My DAOs */}
      <Tab.Screen
        name="MyDACTab"
        component={AppScreen}
        options={{ tabBarLabel: "App", tabBarIcon: ({ focused }) => tabIcon("apps", focused) }}
      />

      {/* Wallet — unchanged */}
      <Tab.Screen
        name="WalletTab"
        component={HomeScreen}
        options={{ tabBarLabel: "Wallet", tabBarIcon: ({ focused }) => tabIcon("wallet", focused) }}
      />
    </Tab.Navigator>
  );
};

// ─── Main Stack ──────────────────────────────────────────────────────────────
// Screens are grouped by role, each group gets a distinct transition so the
// app "reads" its navigation hierarchy through motion, not just position.

const MainStack = () => {
 const { COLORS, isDark } = useTheme();
  const { isWalletMode } = useAppMode();

  // Drill-down / detail views — push horizontally, swipe-back enabled
  const pushOptions = {
    animation: "slide_from_right",
    gestureDirection: "horizontal",
    gestureEnabled: true,
    animationDuration: 260,
  };

  // Action sheets — swipe-down-to-dismiss modal
  const actionModalOptions = {
    presentation: "modal",
    animation: "slide_from_bottom",
    gestureDirection: "vertical",
    gestureEnabled: true,
    animationDuration: 300,
  };

  // Security-sensitive flows — full-screen, no swipe dismissal
  const lockedModalOptions = {
    presentation: "fullScreenModal",
    animation: "slide_from_bottom",
    gestureEnabled: false,
    animationDuration: 320,
  };

  // Profile / settings — modal feel, swipe down allowed
  const sheetOptions = {
    presentation: "modal",
    animation: "slide_from_bottom",
    gestureDirection: "vertical",
    gestureEnabled: true,
    animationDuration: 340,
  };

  // Secondary / utility screens — soft fade, no directional motion
  const fadeOptions = { animation: "fade", animationDuration: 220 };

  return (
       <View style={styles.container}>
      {/* Global default — covers regular pushed screens */}
      <StatusBar style={isDark ? "light" : "dark"} />
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: "slide_from_right",
        animationDuration: 280,
      }}
    >
      <Stack.Screen
        name="Main"
        component={isWalletMode ? WalletTabs : CommunityTabs}
        options={{ animation: "none" }}
      />

      {/* ── Drill-down screens ── */}
      <Stack.Screen name="TokenDetail" component={TokenDetailScreen} options={pushOptions} />
      <Stack.Screen name="NFTDetail" component={NFTDetailScreen} options={pushOptions} />
      <Stack.Screen name="DAODetails" component={DAODetailsScreen} options={pushOptions} />
      <Stack.Screen name="ProposalDetail" component={ProposalDetailScreen} options={pushOptions} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} options={pushOptions} />
      <Stack.Screen name="ArticleDetail" component={ArticleDetailScreen} options={pushOptions} />
      <Stack.Screen name="Browser" component={BrowserScreen} options={pushOptions} />
      <Stack.Screen name="ActivityFeed" component={ActivityFeedScreen} options={pushOptions} />
      <Stack.Screen name="GuildDetail" component={GuildDetailsScreen} options={pushOptions} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ ...pushOptions, headerShown: false }} />
      <Stack.Screen name="GuildChat" component={GuildChatScreen} options={{ ...pushOptions, headerShown: false }} />
      <Stack.Screen name="GuildPosts" component={GuildPostScreen} options={{ ...pushOptions, headerShown: false }} />
      <Stack.Screen name="GuildGovernance" component={GuildGovernanceScreen} options={{ ...pushOptions, headerShown: false }} />
      <Stack.Screen name="GuildSettings" component={GuildSettingsScreen} options={{ ...pushOptions, headerShown: false }} />
      <Stack.Screen name="SearchGuild" component={SearchGuildScreen} options={pushOptions} />
      <Stack.Screen name="ReferFriends" component={ReferFriendsScreen} options={pushOptions} />

      {/* ── Action modals ── */}
      <Stack.Screen name="Swap" component={SwapScreen} options={actionModalOptions} />
      <Stack.Screen name="Send" component={SendScreen} options={actionModalOptions} />
      <Stack.Screen name="Receive" component={ReceiveScreen} options={actionModalOptions} />
      <Stack.Screen name="TokenImport" component={TokenImportScreen} options={actionModalOptions} />
      <Stack.Screen name="MintTRIBE" component={MintScreen} options={actionModalOptions} />
      <Stack.Screen name="CreateProposal" component={CreateProposalForm} options={actionModalOptions} />
      <Stack.Screen name="LaunchDAO" component={LaunchDAOScreen} options={actionModalOptions} />
      <Stack.Screen name="NFTSend" component={NFTSendScreen} options={actionModalOptions} />
      <Stack.Screen name="CreateGuild" component={CreateGuildScreen} options={actionModalOptions} />
      <Stack.Screen name="GuildInvite" component={GuildInviteScreen} options={actionModalOptions} />
      <Stack.Screen name="GuildApps" component={GuildAppsScreen} options={{ ...pushOptions, headerShown: false }} />

      {/* ── Security-sensitive, locked flows ── */}
      <Stack.Screen name="RecoveryPhrase" component={RecoveryPhraseScreen} options={lockedModalOptions} />
      <Stack.Screen name="SetupBiometric" component={SetupBiometricScreen} options={lockedModalOptions} />

      {/* ── Profile / settings ── */}
      <Stack.Screen name="Profile" component={ProfileScreen} options={sheetOptions} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} options={sheetOptions} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={sheetOptions} />

      {/* ── Secondary / utility — fade ── */}
      <Stack.Screen name="TransactionConfirm" component={TransactionConfirmScreen} options={fadeOptions} />
      <Stack.Screen name="Tokens" component={TokensScreen} options={fadeOptions} />
      <Stack.Screen name="NFTs" component={NFTScreen} options={fadeOptions} />
      <Stack.Screen name="Support" component={SupportScreen} options={fadeOptions} />
      <Stack.Screen name="LiveChat" component={LiveChatScreen} options={fadeOptions} />
    </Stack.Navigator>
        </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
});

// ─── Profile Drawer ──────────────────────────────────────────────────────────

const AppNavigator = () => {
  const { COLORS, isDark } = useTheme();

  return (
    <Drawer.Navigator
      id="ProfileDrawer"
      drawerContent={(props) => <ProfileDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "slide",
        drawerPosition: "left",
        drawerStyle: { width: "78%", backgroundColor: "transparent" },
        overlayColor: "rgba(0,0,0,0.55)",
        swipeEnabled: false,
        swipeEdgeWidth: 0,
        sceneStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Drawer.Screen name="AppContent" component={MainStack} />
    </Drawer.Navigator>
  );
};

export default AppNavigator;