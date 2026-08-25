// screens/profile/ProfileScreen.js
//
// Redesigned around social-profile conventions: stats row → hero balance →
// Posts / Guilds / About tabs, instead of a stack of settings sections.
//
// Data notes:
//   - Guilds count/list: real, from api.getMyGuilds() (already exists).
//   - Posts tab: there's no dedicated "my posts" endpoint yet, so this
//     filters api.getFeed() client-side by author. That only sees posts
//     from guilds you're in and whatever page(s) the feed returns — it's a
//     reasonable stand-in, not a complete history. TODO: add a real
//     getMyPosts(userId) endpoint and swap loadPosts() over to it.
//   - Field names (post.authorId / post.username / guild.memberCount etc.)
//     are my best guess from the existing API shape — check these against
//     your actual response payloads and adjust the accessors marked below.
//
// New in this pass: a "Membership Card" quick action (id-card icon, next
// to Edit/Share) that opens a shareable premium card — see
// components/wallet/MembershipCardModal.js.

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Share,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import { useUserData } from "../../contexts/UserDataContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useWallet } from "../../contexts/WalletContext";
import { auth } from "../../services/Firebase";
import api from "../../services/GuildApiService";
import Alert from "../../utils/Alert";
import MembershipCardModal from "../../components/wallet/MembershipCardModal";

const TOKEN_SYMBOL = "TRIBE";

// ─── Avatar ────────────────────────────────────────────────────────────────────

const Avatar = ({ uri, displayName, size, onPress, COLORS }) => {
  const [loaded, setLoaded] = useState(false);
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || "?")}&background=random&size=240`;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        av.wrap,
        {
          width: size + 6,
          height: size + 6,
          borderRadius: (size + 6) / 2,
          borderColor: COLORS.background,
        },
      ]}
    >
      {!loaded && (
        <View
          style={[
            av.placeholder,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: COLORS.surface,
            },
          ]}
        >
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      )}
      <Image
        source={{ uri: uri || fallback }}
        style={[av.img, { width: size, height: size, borderRadius: size / 2 }]}
        onLoadEnd={() => setLoaded(true)}
      />
      <View
        style={[
          av.badge,
          { backgroundColor: COLORS.primary, borderColor: COLORS.background },
        ]}
      >
        <Ionicons name="camera" size={12} color="#fff" />
      </View>
    </TouchableOpacity>
  );
};

const av = StyleSheet.create({
  wrap: {
    borderWidth: 3,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  placeholder: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  img: { resizeMode: "cover" },
  badge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
});

// ─── Stats row ───────────────────────────────────────────────────────────────

const StatBlock = ({ value, label, onPress, COLORS }) => (
  <TouchableOpacity
    style={st.block}
    onPress={onPress}
    activeOpacity={onPress ? 0.6 : 1}
    disabled={!onPress}
  >
    <Text style={[st.value, { color: COLORS.text }]}>{value}</Text>
    <Text style={[st.label, { color: COLORS.textTertiary }]}>{label}</Text>
  </TouchableOpacity>
);

const st = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: 24, marginBottom: 18 },
  block: { flex: 1, alignItems: "center", gap: 2 },
  value: { fontSize: 18, fontWeight: "800" },
  label: { fontSize: 11, fontWeight: "600" },
});

// ─── Airdrop Balance Card (unchanged — already the app's signature element) ──

const AirdropCard = ({ balance, nodeId, COLORS, isDark }) => {
  const formatted = Number(balance ?? 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

  return (
    <View style={[ab.outer, { shadowColor: COLORS.primary }]}>
      <LinearGradient
        colors={[COLORS.primary + "22", COLORS.primary + "08", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          ab.card,
          {
            borderColor: COLORS.primary + "30",
            backgroundColor: COLORS.surface,
          },
        ]}
      >
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[ab.gridLine, { top: `${25 + i * 25}%`, opacity: 0.04 }]}
          />
        ))}

        <View style={ab.headerRow}>
          <View style={ab.labelWrap}>
            <View style={[ab.dotActive, { backgroundColor: COLORS.primary }]} />
            <Text style={[ab.label, { color: COLORS.primary }]}>
              CLAIMABLE AIRDROP BALANCE
            </Text>
          </View>
          <View
            style={[
              ab.tokenBadge,
              {
                backgroundColor: COLORS.primary + "18",
                borderColor: COLORS.primary + "35",
              },
            ]}
          >
            <Text style={[ab.tokenText, { color: COLORS.primary }]}>
              {TOKEN_SYMBOL}
            </Text>
          </View>
        </View>

        <View style={ab.balanceRow}>
          <Text style={[ab.amount, { color: COLORS.text }]}>{formatted}</Text>
          <Text style={[ab.symbol, { color: COLORS.primary }]}>
            {TOKEN_SYMBOL}
          </Text>
        </View>

        <View style={[ab.scanLine, { backgroundColor: COLORS.primary }]} />

        {nodeId ? (
          <View style={ab.footerRow}>
            <Ionicons
              name="hardware-chip-outline"
              size={11}
              color={COLORS.textTertiary}
            />
            <Text style={[ab.nodeText, { color: COLORS.textTertiary }]}>
              {nodeId}
            </Text>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
};

const ab = StyleSheet.create({
  outer: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  card: { borderRadius: 20, borderWidth: 1, padding: 20, overflow: "hidden" },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#fff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  labelWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  dotActive: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  tokenBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  tokenText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  balanceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 14,
  },
  amount: {
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 44,
  },
  symbol: { fontSize: 16, fontWeight: "700", marginBottom: 5 },
  scanLine: { height: 1, opacity: 0.25, marginBottom: 12 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  nodeText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
});

// ─── Tab bar ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "posts", label: "Posts", icon: "grid-outline" },
  { key: "guilds", label: "Guilds", icon: "people-outline" },
  { key: "about", label: "About", icon: "information-circle-outline" },
];

const TabBar = ({ active, onChange, COLORS }) => (
  <View style={[tb.row, { borderBottomColor: COLORS.border }]}>
    {TABS.map((tab) => {
      const isActive = tab.key === active;
      return (
        <TouchableOpacity
          key={tab.key}
          style={tb.tab}
          onPress={() => onChange(tab.key)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={tab.icon}
            size={16}
            color={isActive ? COLORS.primary : COLORS.textTertiary}
          />
          <Text
            style={[
              tb.label,
              { color: isActive ? COLORS.primary : COLORS.textTertiary },
            ]}
          >
            {tab.label}
          </Text>
          {isActive && (
            <View style={[tb.indicator, { backgroundColor: COLORS.primary }]} />
          )}
        </TouchableOpacity>
      );
    })}
  </View>
);

const tb = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 4 },
  label: { fontSize: 12, fontWeight: "700" },
  indicator: {
    position: "absolute",
    bottom: -1,
    height: 2,
    width: 28,
    borderRadius: 1,
  },
});

// ─── Post card (Posts tab) ───────────────────────────────────────────────────

const PostCard = ({ post, COLORS }) => (
  <View
    style={[
      pc.card,
      { backgroundColor: COLORS.surface, borderColor: COLORS.border },
    ]}
  >
    <View style={pc.header}>
      <Text style={[pc.guildName, { color: COLORS.primary }]} numberOfLines={1}>
        {post.guildName || "Guild"}
      </Text>
      <Text style={[pc.time, { color: COLORS.textTertiary }]}>
        {post.createdAt
          ? new Date(post.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : ""}
      </Text>
    </View>
    {!!post.text && (
      <Text style={[pc.body, { color: COLORS.text }]} numberOfLines={4}>
        {post.text}
      </Text>
    )}
    <View style={pc.footer}>
      <View style={pc.metaItem}>
        <Ionicons name="heart-outline" size={14} color={COLORS.textTertiary} />
        <Text style={[pc.metaText, { color: COLORS.textTertiary }]}>
          {post.likesCount ?? 0}
        </Text>
      </View>
      <View style={pc.metaItem}>
        <Ionicons
          name="chatbubble-outline"
          size={14}
          color={COLORS.textTertiary}
        />
        <Text style={[pc.metaText, { color: COLORS.textTertiary }]}>
          {post.commentsCount ?? 0}
        </Text>
      </View>
    </View>
  </View>
);

const pc = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  guildName: { fontSize: 12, fontWeight: "700" },
  time: { fontSize: 11 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  footer: { flexDirection: "row", gap: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontWeight: "600" },
});

// ─── Guild row (Guilds tab) ───────────────────────────────────────────────────

const GuildRow = ({ guild, onPress, COLORS }) => (
  <TouchableOpacity style={gc.row} onPress={onPress} activeOpacity={0.6}>
    <View
      style={[
        gc.iconWrap,
        { backgroundColor: COLORS.background, borderColor: COLORS.border },
      ]}
    >
      {guild.icon ? (
        <Image source={{ uri: guild.icon }} style={gc.icon} />
      ) : (
        <Text style={[gc.iconFallback, { color: COLORS.primary }]}>
          {guild.name?.charAt(0)}
        </Text>
      )}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[gc.name, { color: COLORS.text }]} numberOfLines={1}>
        {guild.name}
      </Text>
      {typeof guild.memberCount === "number" && (
        <Text style={[gc.sub, { color: COLORS.textTertiary }]}>
          {guild.memberCount.toLocaleString()} members
        </Text>
      )}
    </View>
    <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
  </TouchableOpacity>
);

const gc = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  icon: { width: 44, height: 44 },
  iconFallback: { fontSize: 16, fontWeight: "800" },
  name: { fontSize: 14, fontWeight: "700" },
  sub: { fontSize: 12, marginTop: 1 },
});

// ─── Menu row + Section (used in About tab) ──────────────────────────────────

const MenuRow = ({ icon, label, value, onPress, danger, COLORS, last }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.6}
    disabled={!onPress}
    style={[
      mr.row,
      { borderBottomColor: COLORS.border },
      last && { borderBottomWidth: 0 },
    ]}
  >
    <View
      style={[
        mr.iconWrap,
        {
          backgroundColor: danger ? COLORS.error + "14" : COLORS.primary + "14",
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={17}
        color={danger ? COLORS.error : COLORS.primary}
      />
    </View>
    <Text style={[mr.label, { color: danger ? COLORS.error : COLORS.text }]}>
      {label}
    </Text>
    <View style={mr.right}>
      {value ? (
        <Text style={[mr.value, { color: COLORS.textSecondary }]}>{value}</Text>
      ) : null}
      {onPress && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={COLORS.textTertiary}
        />
      )}
    </View>
  </TouchableOpacity>
);

const mr = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  label: { flex: 1, fontSize: 14, fontWeight: "500" },
  right: { flexDirection: "row", alignItems: "center", gap: 4 },
  value: { fontSize: 13 },
});

const Section = ({ title, children, COLORS }) => (
  <View style={sc.wrap}>
    {title ? (
      <Text style={[sc.title, { color: COLORS.textSecondary }]}>{title}</Text>
    ) : null}
    <View
      style={[
        sc.card,
        { backgroundColor: COLORS.surface, borderColor: COLORS.border },
      ]}
    >
      {children}
    </View>
  </View>
);

const sc = StyleSheet.create({
  wrap: { marginBottom: 20 },
  title: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});

// ─── Main screen ───────────────────────────────────────────────────────────────

const ProfileScreen = ({ navigation }) => {
  const { userData } = useUserData();
  const { COLORS, isDark } = useTheme();
  const { wallet } = useWallet();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState("posts");
  const [guilds, setGuilds] = useState([]);
  const [guildsLoading, setGuildsLoading] = useState(true);
  const [feed, setFeed] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMembershipCard, setShowMembershipCard] = useState(false);

  const loadGuilds = useCallback(async () => {
    try {
      const list = await api.getMyGuilds();
      setGuilds(list || []);
    } catch {
      setGuilds([]);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      // TODO: replace with a dedicated getMyPosts(userId) endpoint — this
      // filters the general feed client-side, which only covers guilds
      // you're a member of and whatever page(s) the feed API returns.
      const items = await api.getFeed(1, 50);
      setFeed(items || []);
    } catch {
      setFeed([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadGuilds(), loadPosts()]).finally(() => {
      if (mounted) {
        setGuildsLoading(false);
        setFeedLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadGuilds, loadPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadGuilds(), loadPosts()]);
    setRefreshing(false);
  }, [loadGuilds, loadPosts]);

  const myPosts = useMemo(() => {
    if (!userData) return [];
    return feed.filter(
      (post) =>
        post.authorId === userData.uid ||
        post.username === userData.username ||
        post.author?.username === userData.username,
    );
  }, [feed, userData]);

  if (!userData) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
          } catch {
            Alert.alert("Error", "Failed to sign out. Please try again.");
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    // TODO: swap in the real profile-link domain once it exists.
    const link = `https://app.example.com/u/${userData.username}`;
    try {
      await Share.share({
        message: `Check out @${userData.username} on the app\n${link}`,
      });
    } catch (e) {
      console.error("[ProfileScreen] share failed:", e);
    }
  };

  const memberSince = userData.createdAt
    ? new Date(userData.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Recently";

  const networkBalance = userData.networkBalance ?? userData.balance ?? 0;

  const COVER_HEIGHT = 150 + insets.top;
  const AVATAR_SIZE = 84;
  const AVATAR_OVERLAP = 42;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* ── Cover ── */}
        <View style={{ height: COVER_HEIGHT + AVATAR_OVERLAP }}>
          <LinearGradient
            colors={[
              COLORS.primary + "cc",
              COLORS.primary + "44",
              COLORS.background,
            ]}
            locations={[0, 0.65, 1]}
            style={{
              height: COVER_HEIGHT,
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
            }}
          />
          <View style={[s.coverActions, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              style={[s.coverBtn, { backgroundColor: "rgba(0,0,0,0.28)" }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.coverBtn, { backgroundColor: "rgba(0,0,0,0.28)" }]}
              onPress={() => navigation.navigate("Settings")}
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <Avatar
              uri={userData.profilePicture}
              displayName={userData.displayName}
              size={AVATAR_SIZE}
              onPress={() => navigation.navigate("ProfileEdit")}
              COLORS={COLORS}
            />
          </View>
        </View>

        {/* ── Identity ── */}
        <View style={s.identity}>
          <Text style={[s.displayName, { color: COLORS.text }]}>
            {userData.displayName || userData.username}
          </Text>
          <Text style={[s.username, { color: COLORS.textSecondary }]}>
            @{userData.username}
          </Text>
          {userData.bio ? (
            <Text style={[s.bio, { color: COLORS.textTertiary }]}>
              {userData.bio}
            </Text>
          ) : null}
          <View
            style={[
              s.chip,
              { backgroundColor: COLORS.primary + "14", marginTop: 8 },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={11}
              color={COLORS.primary}
            />
            <Text style={[s.chipText, { color: COLORS.primary }]}>
              Since {memberSince}
            </Text>
          </View>
        </View>

        {/* ── Action row ── */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.editBtn, { borderColor: COLORS.border }]}
            onPress={() => navigation.navigate("ProfileEdit")}
            activeOpacity={0.7}
          >
            <Text style={[s.editBtnText, { color: COLORS.text }]}>
              Edit profile
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.shareBtn, { borderColor: COLORS.border }]}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Ionicons name="share-outline" size={17} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.shareBtn, { borderColor: COLORS.border }]}
            onPress={() => setShowMembershipCard(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="id-card-outline" size={17} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* ── Stats ── */}
        <View style={st.row}>
          <StatBlock
            value={guildsLoading ? "—" : guilds.length}
            label="Guilds"
            onPress={() => setActiveTab("guilds")}
            COLORS={COLORS}
          />
          <StatBlock
            value={feedLoading ? "—" : myPosts.length}
            label="Posts"
            onPress={() => setActiveTab("posts")}
            COLORS={COLORS}
          />
          <StatBlock value={memberSince} label="Member since" COLORS={COLORS} />
        </View>

        {/* ── Claimable Airdrop Balance ── */}
        <AirdropCard
          balance={networkBalance}
          nodeId={userData.nodeId}
          COLORS={COLORS}
          isDark={isDark}
        />

        {/* ── Tabs ── */}
        <TabBar active={activeTab} onChange={setActiveTab} COLORS={COLORS} />

        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          {activeTab === "posts" &&
            (feedLoading ? (
              <ActivityIndicator
                color={COLORS.primary}
                style={{ marginTop: 30 }}
              />
            ) : myPosts.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons
                  name="grid-outline"
                  size={22}
                  color={COLORS.textTertiary}
                />
                <Text style={[s.emptyTitle, { color: COLORS.text }]}>
                  No posts yet
                </Text>
                <Text style={[s.emptyBody, { color: COLORS.textTertiary }]}>
                  Join a guild and share something to see it here.
                </Text>
              </View>
            ) : (
              myPosts.map((post) => (
                <PostCard key={post.id} post={post} COLORS={COLORS} />
              ))
            ))}

          {activeTab === "guilds" &&
            (guildsLoading ? (
              <ActivityIndicator
                color={COLORS.primary}
                style={{ marginTop: 30 }}
              />
            ) : guilds.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons
                  name="people-outline"
                  size={22}
                  color={COLORS.textTertiary}
                />
                <Text style={[s.emptyTitle, { color: COLORS.text }]}>
                  No guilds yet
                </Text>
                <Text style={[s.emptyBody, { color: COLORS.textTertiary }]}>
                  Communities you join will show up here.
                </Text>
              </View>
            ) : (
              guilds.map((guild) => (
                <GuildRow
                  key={guild.id}
                  guild={guild}
                  // TODO: confirm the guild-detail route name in your navigator.
                  onPress={() =>
                    navigation.navigate("GuildDetail", { guildId: guild.id })
                  }
                  COLORS={COLORS}
                />
              ))
            ))}

          {activeTab === "about" && (
            <>
              <Section title="Account" COLORS={COLORS}>
                <MenuRow
                  icon="mail-outline"
                  label="Email"
                  value={userData.email}
                  COLORS={COLORS}
                />
                <MenuRow
                  icon="person-outline"
                  label="Username"
                  value={`@${userData.username}`}
                  COLORS={COLORS}
                  last={!userData.referralCode}
                />
                {userData.referralCode ? (
                  <MenuRow
                    icon="people-outline"
                    label="Referral code"
                    value={userData.referralCode}
                    COLORS={COLORS}
                    last
                  />
                ) : null}
              </Section>

              <Section title="App" COLORS={COLORS}>
                <MenuRow
                  icon="settings-outline"
                  label="Settings"
                  onPress={() => navigation.navigate("Settings")}
                  COLORS={COLORS}
                />
                <MenuRow
                  icon="shield-outline"
                  label="Security & Recovery"
                  onPress={() => navigation.navigate("RecoveryPhrase")}
                  COLORS={COLORS}
                />
                <MenuRow
                  icon="finger-print-outline"
                  label="Biometric Auth"
                  onPress={() => navigation.navigate("SetupBiometric")}
                  COLORS={COLORS}
                />
                <MenuRow
                  icon="chatbubble-ellipses-outline"
                  label="Support"
                  onPress={() => navigation.navigate("Support")}
                  COLORS={COLORS}
                  last
                />
              </Section>

              <TouchableOpacity
                style={[
                  s.logoutBtn,
                  {
                    borderColor: COLORS.error + "40",
                    backgroundColor: COLORS.error + "0c",
                  },
                ]}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="log-out-outline"
                  size={18}
                  color={COLORS.error}
                />
                <Text style={[s.logoutTxt, { color: COLORS.error }]}>
                  Sign out
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      <MembershipCardModal
        visible={showMembershipCard}
        onClose={() => setShowMembershipCard(false)}
        COLORS={COLORS}
        appName="TRIBE"
        displayName={userData.displayName || userData.username}
        username={userData.username}
        avatarUri={userData.profilePicture}
        memberSince={memberSince}
        walletAddress={wallet?.address}
      />
    </View>
  );
};

const s = StyleSheet.create({
  coverActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  coverBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  identity: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 4,
  },
  displayName: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  username: { fontSize: 14, fontWeight: "500" },
  bio: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 4,
    paddingHorizontal: 12,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  chipText: { fontSize: 11, fontWeight: "600" },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  editBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  editBtnText: { fontSize: 14, fontWeight: "700" },
  shareBtn: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },

  emptyState: { alignItems: "center", paddingVertical: 36, gap: 6 },
  emptyTitle: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  emptyBody: { fontSize: 12, textAlign: "center", maxWidth: 240 },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 12,
  },
  logoutTxt: { fontSize: 15, fontWeight: "700" },
});

export default ProfileScreen;
