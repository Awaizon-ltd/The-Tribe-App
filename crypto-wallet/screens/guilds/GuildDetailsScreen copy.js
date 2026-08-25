import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useWallet } from "../../contexts/WalletContext";
import { useTheme } from "../../contexts/ThemeContext";
import GuildTabContent from "../../components/guild/GuildTabContent";
import AccessDeniedScreen from "../../components/guild/AccessDeniedScreen";
import { useGuildMembership } from "../../hooks/useGuildMembership";
import { useTokenGating } from "../../hooks/useTokenGating";
import api from "../../services/GuildApiService";
import * as GuildCache from "../../utils/GuildCache";

const BANNER_HEIGHT = 180;
const LOGO_SIZE = 88;

const TABS = [
  { id: "overview", name: "Overview", icon: "information-circle-outline" },
  { id: "request", name: "Requests", icon: "shield-checkmark-outline" },
  { id: "chat", name: "Chat", icon: "chatbubbles-outline" },
  { id: "posts", name: "Posts", icon: "newspaper-outline" },
  { id: "apps", name: "Apps", icon: "grid-outline" },
  { id: "governance", name: "Governance", icon: "shield-half-outline" },
  { id: "settings", name: "Settings", icon: "settings-outline" },
];

const GuildDetailsScreen = ({ route, navigation }) => {
  const { guild: guildParam, guildId: paramId } = route.params;
  const { COLORS, isDark } = useTheme();
  const { user } = useAuth();
  const { address } = useWallet() || {};

  const [guild, setGuild] = useState(guildParam ?? null);
  // Block the UI only when we have no guild object at all yet (deep-link / guildId-only path).
  // When a guild object is passed from the list we show it immediately and refresh silently.
  const [fetchingGuild, setFetching] = useState(!guildParam && !!paramId);
  const [activeTab, setActiveTab] = useState("overview");
  const [members, setMembers] = useState([]);
  const [membersLoading, setMemberLoad] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fade in when guild loads
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // ── Always fetch the full guild object on mount ───────────────────────────────
  // Regardless of navigation source, we need the complete guild record so that
  // fields like linked_dao_address (required for the Governance tab) are present.
  // When guildParam was passed, the screen renders immediately from that data while
  // this fetch runs silently in the background — no loading spinner shown.
  useEffect(() => {
    const id = guildParam?.id || paramId;
    if (!id) return;

    api
      .getGuild(id)
      .then((data) => {
        if (data) setGuild(data);
        else if (!guildParam) navigation.goBack(); // nothing to show — bail out
      })
      .catch(() => {
        if (!guildParam) navigation.goBack();
      })
      .finally(() => setFetching(false));
  }, []);

  // ── Fade in animation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (guild && !fetchingGuild) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [guild, fetchingGuild]);

  // ── Hooks (must be called unconditionally) ───────────────────────────────────
  const privacy = guild?.privacy || "public";

  const {
    isMember,
    memberCount,
    membershipStatus,
    joinLoading,
    handleJoinGuild: originalHandleJoin,
    setMemberCount,
  } = useGuildMembership(guild || {}, user, privacy);

  // Pass token gating config from the guild object so the hook skips a redundant API call.
  // Backend returns it as token_gating (snake_case) or tokenGating (camelCase).
  const guildTokenGating = guild?.token_gating ?? guild?.tokenGating ?? null;

  const {
    tokenGatingData,
    hasRequiredToken,
    tokenCheckLoading,
    checkTokenBalance,
  } = useTokenGating(
    guild?.id,
    user,
    address,
    privacy,
    isMember,
    guildTokenGating,
  );

  // ── Members fetch (cache-first) ──────────────────────────────────────────────
  useEffect(() => {
    if (!guild?.id) return;
    let mounted = true;

    const loadMembers = async () => {
      setMemberLoad(true);

      // 1. Show cached members instantly
      const { data: cached, stale } = await GuildCache.getMembers(guild.id);
      if (cached.length > 0 && mounted) {
        setMembers(cached);
        setMemberLoad(false);
      }

      // 2. Re-fetch from API only when stale
      if (!stale && cached.length > 0) return;

      try {
        const fresh = await api.getMembers(guild.id);
        if (!mounted) return;
        setMembers(fresh || []);
        GuildCache.saveMembers(guild.id, fresh || []).catch(() => {});
      } catch {
      } finally {
        if (mounted) setMemberLoad(false);
      }
    };

    loadMembers();
    return () => {
      mounted = false;
    };
  }, [guild?.id]);

  // ── Unread count ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!guild?.id || !isMember || membershipStatus === "pending") return;
    let cancelled = false;

    const load = () => {
      api
        .getUnreadCount(guild.id)
        .then((data) => {
          if (!cancelled) setUnreadCount(data?.count || 0);
        })
        .catch(() => {});
    };

    load();
    const interval = setInterval(load, 15_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [guild?.id, isMember, membershipStatus]);

  // ── Early returns (after all hooks) ──────────────────────────────────────────
  if (fetchingGuild || !guild) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const isOwner =
    guild.created_by === user?.uid || guild.createdBy === user?.uid;

  const handleJoinGuild = () =>
    originalHandleJoin(address, tokenGatingData, hasRequiredToken);

  const formatBadge = (n) => (n === 0 ? null : n > 99 ? "99+" : String(n));

  const linkedDaoAddress = guild.linkedDaoAddress || guild.linked_dao_address;
  const linkedDaoChainId = guild.linkedDaoChainId || guild.linked_dao_chain_id;

  const handleTabPress = (tabId) => {
    if (tabId === "overview" || tabId === "request") {
      setActiveTab(tabId);
    } else if (tabId === "chat") {
      setUnreadCount(0);
      navigation.navigate("GuildChat", {
        guildId: guild.id,
        membershipStatus,
        members,
        logo: guild.logoUrl || guild.logo_url,
        name: guild.name,
      });
    } else if (tabId === "posts") {
      navigation.navigate("GuildPosts", {
        guildId: guild.id,
        membershipStatus,
        guild,
      });
    } else if (tabId === "apps") {
      navigation.navigate("GuildApps", {
        guildId: guild.id,
        guild,
        isOwner,
      });
    } else if (tabId === "settings") {
      navigation.navigate("GuildSettings", { guild });
    } else if (tabId === "governance") {
      navigation.navigate("GuildGovernance", {
        daoAddress: linkedDaoAddress,
        chainId: linkedDaoChainId,
      });
    }
  };

  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === "request") return isOwner && privacy === "private";
    if (tab.id === "chat") return isMember && membershipStatus !== "pending";
    if (tab.id === "apps") return isMember && membershipStatus !== "pending";
    if (tab.id === "governance")
      return isMember && membershipStatus !== "pending" && !!linkedDaoAddress;
    if (tab.id === "settings") return isOwner;
    return true;
  }).map((tab) => ({
    ...tab,
    badge: tab.id === "chat" ? formatBadge(unreadCount) : null,
  }));

  // ── Access denied (private + no token) ───────────────────────────────────────
  if (
    privacy === "private" &&
    tokenGatingData &&
    !isMember &&
    !tokenCheckLoading &&
    !hasRequiredToken
  ) {
    return (
      <View style={[styles.container, { backgroundColor: COLORS.background }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {renderHeader()}
          <AccessDeniedScreen
            tokenGatingData={tokenGatingData}
            hasRequiredToken={hasRequiredToken}
            address={address}
            checkTokenBalance={checkTokenBalance}
            tokenCheckLoading={tokenCheckLoading}
            navigation={navigation}
          />
        </ScrollView>
      </View>
    );
  }

  // ── Header ────────────────────────────────────────────────────────────────────
  function renderHeader() {
    const s = styles(COLORS);
    return (
      <View>
        {/* Banner */}
        <View style={s.bannerWrapper}>
          {guild.bannerUrl || guild.banner_url ? (
            <Image
              source={{ uri: guild.bannerUrl || guild.banner_url }}
              style={s.banner}
              resizeMode="cover"
            />
          ) : (
            <View style={[s.banner, s.bannerFallback]}>
              <Ionicons
                name="image-outline"
                size={40}
                color={COLORS.textTertiary}
              />
            </View>
          )}

          {/* Back button */}
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Logo + info row */}
        <View style={s.infoRow}>
          <View style={[s.logoWrap, { borderColor: COLORS.background }]}>
            {guild.logoUrl || guild.logo_url ? (
              <Image
                source={{ uri: guild.logoUrl || guild.logo_url }}
                style={s.logo}
              />
            ) : (
              <View
                style={[
                  s.logo,
                  {
                    backgroundColor: COLORS.primary,
                    justifyContent: "center",
                    alignItems: "center",
                  },
                ]}
              >
                <Text
                  style={{ color: "#FFF", fontSize: 30, fontWeight: "700" }}
                >
                  {guild.name?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Join button — only when not member */}
          {!isMember && (
            <TouchableOpacity
              style={[
                s.joinBtn,
                { backgroundColor: COLORS.primary },
                (joinLoading || tokenCheckLoading) && s.joinBtnDisabled,
              ]}
              onPress={handleJoinGuild}
              disabled={joinLoading || tokenCheckLoading}
              activeOpacity={0.85}
            >
              {joinLoading || tokenCheckLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={s.joinBtnText}>Join Guild</Text>
              )}
            </TouchableOpacity>
          )}

          {isMember && membershipStatus !== "pending" && (
            <View
              style={[
                s.memberBadge,
                { backgroundColor: COLORS.primary + "20" },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={COLORS.primary}
              />
              <Text style={[s.memberBadgeText, { color: COLORS.primary }]}>
                Member
              </Text>
            </View>
          )}

          {membershipStatus === "pending" && (
            <View
              style={[
                s.memberBadge,
                { backgroundColor: COLORS.warning + "20" },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={16}
                color={COLORS.warning || "#F59E0B"}
              />
              <Text
                style={[
                  s.memberBadgeText,
                  { color: COLORS.warning || "#F59E0B" },
                ]}
              >
                Pending
              </Text>
            </View>
          )}
        </View>

        {/* Guild name + metadata */}
        <View style={s.metaBlock}>
          <View style={s.nameLine}>
            <Text
              style={[s.guildName, { color: COLORS.text }]}
              numberOfLines={1}
            >
              {guild.name}
            </Text>
            {privacy === "private" && (
              <View
                style={[s.privacyChip, { backgroundColor: COLORS.primaryDark }]}
              >
                <Ionicons name="lock-closed" size={11} color={COLORS.primary} />
                <Text style={[s.privacyText, { color: COLORS.primary }]}>
                  Private
                </Text>
              </View>
            )}
          </View>

          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Ionicons
                name="people-outline"
                size={15}
                color={COLORS.textSecondary}
              />
              <Text style={[s.statText, { color: COLORS.textSecondary }]}>
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </Text>
            </View>

            {guild.genre && (
              <View
                style={[s.genreChip, { backgroundColor: COLORS.primaryDark }]}
              >
                <Text style={[s.genreText, { color: COLORS.onPrimary }]}>
                  {guild.genre}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Tab bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.tabBar}
          contentContainerStyle={s.tabBarContent}
        >
          {visibleTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  s.tab,
                  { backgroundColor: COLORS.surface },
                  active && [s.tabActive, { borderColor: COLORS.primary }],
                ]}
                onPress={() => handleTabPress(tab.id)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={tab.icon}
                  size={18}
                  color={active ? COLORS.primary : COLORS.textTertiary}
                />
                <Text
                  style={[
                    s.tabLabel,
                    { color: active ? COLORS.primary : COLORS.textTertiary },
                  ]}
                >
                  {tab.name}
                </Text>

                {tab.badge && (
                  <View
                    style={[
                      s.badge,
                      { backgroundColor: COLORS.error || "#EF4444" },
                    ]}
                  >
                    <Text style={s.badgeText}>{tab.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ── Scrollable content ────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        styles(COLORS).container,
        { opacity: fadeAnim, backgroundColor: COLORS.background },
      ]}
    >
      <ScrollView showsVerticalScrollIndicator={false} bounces>
        {renderHeader()}
        <GuildTabContent
          activeTab={activeTab}
          guild={guild}
          memberCount={memberCount}
          members={members}
          membershipStatus={membershipStatus}
          privacy={privacy}
          tokenGatingData={tokenGatingData}
          isMember={isMember}
          hasRequiredToken={hasRequiredToken}
          tokenCheckLoading={tokenCheckLoading}
          useraddress={address}
          checkTokenBalance={checkTokenBalance}
          navigation={navigation}
        />
      </ScrollView>
    </Animated.View>
  );
};

// ─── Styles (function to avoid recreating every render) ──────────────────────
const styles = (COLORS) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    bannerWrapper: { position: "relative" },
    banner: { width: "100%", height: BANNER_HEIGHT },
    bannerFallback: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: COLORS.surface,
    },

    backBtn: {
      position: "absolute",
      top: 44,
      left: 16,
      zIndex: 10,
      backgroundColor: "rgba(0,0,0,0.45)",
      borderRadius: 20,
      padding: 8,
    },

    infoRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 16,
      marginTop: -(LOGO_SIZE / 2),
      marginBottom: 8,
      justifyContent: "space-between",
    },

    logoWrap: {
      borderWidth: 4,
      borderRadius: LOGO_SIZE / 2 + 4,
      overflow: "hidden",
      elevation: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    logo: { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: LOGO_SIZE / 2 },

    joinBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 22,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      marginBottom: 4,
    },
    joinBtnDisabled: { opacity: 0.6 },
    joinBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },

    memberBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      marginBottom: 4,
    },
    memberBadgeText: { fontSize: 13, fontWeight: "600" },

    metaBlock: { paddingHorizontal: 16, marginBottom: 4 },

    nameLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    guildName: { fontSize: 22, fontWeight: "700", flex: 1 },

    privacyChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    privacyText: { fontSize: 11, fontWeight: "600" },

    statsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    statText: { fontSize: 13 },

    genreChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
    genreText: { fontSize: 12, fontWeight: "600" },

    tabBar: { marginTop: 12 },
    tabBarContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },

    tab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "transparent",
      position: "relative",
    },
    tabActive: { borderWidth: 1.5 },
    tabLabel: { fontSize: 13, fontWeight: "500" },

    badge: {
      position: "absolute",
      top: -6,
      right: -6,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      justifyContent: "center",
      alignItems: "center",
    },
    badgeText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  });

export default GuildDetailsScreen;
