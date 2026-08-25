// screens/miniapps/AppScreen.js
//
// App-store-style directory for mini-apps. Three tiers, same pattern the
// iOS/Play stores use: a featured carousel up top for editorial picks, a
// category filter row, then a scannable vertical list for everything else.
// Search narrows all three at once.
//
// TODO: getMiniAppDirectory() currently returns a flat array. This screen
// expects each app to optionally carry `featured: boolean`, `category:
// string`, `tagline: string`, and `scopes: string[]` — add those fields on
// the backend/directory response if they don't exist yet. Everything
// degrades gracefully (falls into "Apps" category, no scope pills, etc.)
// if they're missing.

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { useWallet } from "../../contexts/WalletContext";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/GuildApiService";
import MiniAppWebView from "../../components/miniapps/MiniAppsWebView";

const SCOPE_META = {
  wallet:  { icon: "wallet-outline",       label: "Wallet" },
  guild:   { icon: "people-outline",       label: "Guild" },
  posts:   { icon: "chatbubble-outline",   label: "Posts" },
  profile: { icon: "person-outline",       label: "Profile" },
};

const AppScreen = () => {
  const { COLORS, FONTS, SPACING, BORDER_RADIUS } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { address } = useWallet();

  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeApp, setActiveApp] = useState(null);

  const loadApps = useCallback(async () => {
    try {
      const list = await api.getMiniAppDirectory();
      setApps(list || []);
    } catch {
      setApps([]);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    loadApps().finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [loadApps]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadApps();
    setRefreshing(false);
  }, [loadApps]);

  const openApp = useCallback((miniApp) => setActiveApp(miniApp), []);
  const closeApp = useCallback(() => setActiveApp(null), []);

  // ── Derived data ──────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const set = new Set(apps.map((a) => a.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [apps]);

  const featured = useMemo(() => apps.filter((a) => a.featured), [apps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((a) => {
      const matchesCategory = activeCategory === "All" || a.category === activeCategory;
      const matchesQuery =
        !q ||
        a.name?.toLowerCase().includes(q) ||
        a.tagline?.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [apps, activeCategory, query]);

  const styles = createStyles(COLORS, FONTS, SPACING, BORDER_RADIUS);

  // ── Full-screen mini-app ─────────────────────────────────────────────────
  if (activeApp) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: COLORS.background }}>
        <View style={styles.playerHeader}>
          <TouchableOpacity onPress={closeApp} style={styles.playerCloseBtn}>
            <Ionicons name="chevron-down" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.playerIconWrap}>
            {activeApp.icon ? (
              <Image source={{ uri: activeApp.icon }} style={styles.playerIcon} />
            ) : (
              <Text style={styles.iconFallback}>{activeApp.name?.charAt(0)}</Text>
            )}
          </View>
          <Text style={styles.playerTitle} numberOfLines={1}>{activeApp.name}</Text>
        </View>
        <MiniAppWebView
          miniApp={activeApp}
          guildId={null}
          grantedScopes={activeApp.requestedScopes || activeApp.scopes || []}
          userProfile={{ username: user?.email?.split("@")[0], address }}
          onClose={closeApp}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>App Store</Text>
        </View>
        <Text style={styles.subtitle}>Mini-apps that run on your wallet and guilds.</Text>

        {/* ── Search ── */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search apps"
            placeholderTextColor={COLORS.textTertiary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 60 }} />
        ) : apps.length === 0 ? (
          <View style={styles.placeholderCard}>
            <Ionicons name="apps-outline" size={22} color={COLORS.textTertiary} />
            <Text style={styles.placeholderTitle}>No mini-apps yet</Text>
            <Text style={styles.placeholderBody}>Apps built for your wallet and guilds will show up here.</Text>
          </View>
        ) : (
          <>
            {/* ── Featured carousel ── */}
            {!query && featured.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Featured</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.featuredRow}
                >
                  {featured.map((app) => (
                    <TouchableOpacity
                      key={app.id}
                      style={styles.featuredCard}
                      onPress={() => openApp(app)}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={[COLORS.card, COLORS.surface]}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.featuredIconWrap}>
                        {app.icon ? (
                          <Image source={{ uri: app.icon }} style={styles.featuredIcon} />
                        ) : (
                          <Text style={[styles.iconFallback, { fontSize: FONTS.sizes.xl }]}>
                            {app.name?.charAt(0)}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.featuredName} numberOfLines={1}>{app.name}</Text>
                      {!!app.tagline && (
                        <Text style={styles.featuredTagline} numberOfLines={2}>{app.tagline}</Text>
                      )}
                      <ScopePills scopes={app.scopes} COLORS={COLORS} FONTS={FONTS} />
                      <View style={styles.featuredOpenBtn}>
                        <Text style={styles.featuredOpenText}>OPEN</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* ── Category chips ── */}
            {categories.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {categories.map((cat) => {
                  const active = cat === activeCategory;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                      onPress={() => setActiveCategory(cat)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* ── App list ── */}
            <Text style={styles.sectionTitle}>
              {query ? `Results` : activeCategory === "All" ? "All apps" : activeCategory}
            </Text>

            {filtered.length === 0 ? (
              <View style={styles.placeholderCard}>
                <Ionicons name="search-outline" size={20} color={COLORS.textTertiary} />
                <Text style={styles.placeholderBody}>No apps match "{query}"</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {filtered.map((app) => (
                  <TouchableOpacity
                    key={app.id}
                    style={styles.row}
                    onPress={() => openApp(app)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowIconWrap}>
                      {app.icon ? (
                        <Image source={{ uri: app.icon }} style={styles.rowIcon} />
                      ) : (
                        <Text style={styles.iconFallback}>{app.name?.charAt(0)}</Text>
                      )}
                    </View>

                    <View style={styles.rowMid}>
                      <Text style={styles.rowName} numberOfLines={1}>{app.name}</Text>
                      {!!app.tagline && (
                        <Text style={styles.rowTagline} numberOfLines={1}>{app.tagline}</Text>
                      )}
                      <ScopePills scopes={app.scopes} COLORS={COLORS} FONTS={FONTS} compact />
                    </View>

                    <View style={styles.rowOpenBtn}>
                      <Text style={styles.rowOpenText}>OPEN</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

// ─── Scope pills ────────────────────────────────────────────────────────────
// The signature element: a compact readout of what a mini-app can actually
// touch (wallet, guild, posts, profile), shown right on the tile — the
// trust signal that matters for a wallet-connected store, in place of a
// generic star rating these apps have no real basis for yet.
const ScopePills = ({ scopes, COLORS, FONTS, compact = false }) => {
  if (!scopes || scopes.length === 0) return null;
  const known = scopes.map((s) => SCOPE_META[s]).filter(Boolean).slice(0, compact ? 2 : 3);
  if (known.length === 0) return null;

  return (
    <View style={{ flexDirection: "row", gap: 6, marginTop: compact ? 4 : 8 }}>
      {known.map(({ icon, label }) => (
        <View
          key={label}
          style={{
            flexDirection: "row", alignItems: "center", gap: 3,
            backgroundColor: COLORS.surface, borderRadius: 8,
            paddingHorizontal: 6, paddingVertical: 3,
          }}
        >
          <Ionicons name={icon} size={10} color={COLORS.textTertiary} />
          <Text style={{ fontSize: 9, fontWeight: "600", color: COLORS.textTertiary }}>{label}</Text>
        </View>
      ))}
    </View>
  );
};

const createStyles = (COLORS, FONTS, SPACING, BORDER_RADIUS) =>
  StyleSheet.create({
    container: { flex: 1 },

    headerRow: { paddingHorizontal: 20 },
    title: { fontWeight: "800", fontSize: FONTS.sizes.xxl, color: COLORS.text, letterSpacing: -0.5 },
    subtitle: {
      paddingHorizontal: 20,
      marginTop: 4, marginBottom: 16,
      lineHeight: 20, fontSize: FONTS.sizes.md, color: COLORS.textSecondary,
    },

    searchBar: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg,
      marginHorizontal: 20, paddingHorizontal: 12, paddingVertical: 10,
      marginBottom: 24,
    },
    searchInput: { flex: 1, fontSize: FONTS.sizes.md, color: COLORS.text, padding: 0 },

    sectionTitle: {
      fontSize: FONTS.sizes.lg, fontWeight: "700", color: COLORS.text,
      paddingHorizontal: 20, marginBottom: 12, marginTop: 4,
    },

    // Featured carousel
    featuredRow: { paddingHorizontal: 20, gap: 12, paddingBottom: 28 },
    featuredCard: {
      width: 210, borderRadius: BORDER_RADIUS.xl, padding: 16,
      borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
      overflow: "hidden",
    },
    featuredIconWrap: {
      width: 48, height: 48, borderRadius: BORDER_RADIUS.md,
      backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
      justifyContent: "center", alignItems: "center", overflow: "hidden", marginBottom: 10,
    },
    featuredIcon: { width: 48, height: 48 },
    featuredName: { fontSize: FONTS.sizes.md, fontWeight: "700", color: COLORS.text },
    featuredTagline: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2, lineHeight: 16 },
    featuredOpenBtn: {
      marginTop: 12, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full,
      paddingVertical: 8, alignItems: "center",
    },
    featuredOpenText: { fontSize: FONTS.sizes.xs, fontWeight: "800", color: COLORS.background, letterSpacing: 0.5 },

    // Category chips
    categoryRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 20 },
    categoryChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: BORDER_RADIUS.full,
      backgroundColor: COLORS.surface,
    },
    categoryChipActive: { backgroundColor: COLORS.primary },
    categoryChipText: { fontSize: FONTS.sizes.sm, fontWeight: "600", color: COLORS.textSecondary },
    categoryChipTextActive: { color: COLORS.background },

    // List rows
    list: { paddingHorizontal: 20 },
    row: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
    },
    rowIconWrap: {
      width: 52, height: 52, borderRadius: BORDER_RADIUS.lg,
      backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
      justifyContent: "center", alignItems: "center", overflow: "hidden", marginRight: 12,
    },
    rowIcon: { width: 52, height: 52 },
    rowMid: { flex: 1, marginRight: 10 },
    rowName: { fontSize: FONTS.sizes.md, fontWeight: "700", color: COLORS.text },
    rowTagline: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
    rowOpenBtn: {
      backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.full,
      paddingHorizontal: 16, paddingVertical: 7,
    },
    rowOpenText: { fontSize: FONTS.sizes.xs, fontWeight: "800", color: COLORS.primary, letterSpacing: 0.5 },

    iconFallback: { fontSize: FONTS.sizes.xl, fontWeight: "700", color: COLORS.onPrimaryLight },

    placeholderCard: {
      marginHorizontal: 20, borderRadius: BORDER_RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
      backgroundColor: COLORS.card, padding: 24, alignItems: "center", gap: 6,
    },
    placeholderTitle: { fontSize: FONTS.sizes.md, fontWeight: "700", color: COLORS.text, marginTop: 4 },
    placeholderBody: { fontSize: FONTS.sizes.sm, color: COLORS.textTertiary, textAlign: "center" },

    // Full-screen player header
    playerHeader: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingHorizontal: 16, paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
    },
    playerCloseBtn: { padding: 4 },
    playerIconWrap: {
      width: 28, height: 28, borderRadius: 8, overflow: "hidden",
      backgroundColor: COLORS.surface, justifyContent: "center", alignItems: "center",
    },
    playerIcon: { width: 28, height: 28 },
    playerTitle: { fontSize: FONTS.sizes.md, fontWeight: "700", color: COLORS.text, flex: 1 },
  });

export default AppScreen;