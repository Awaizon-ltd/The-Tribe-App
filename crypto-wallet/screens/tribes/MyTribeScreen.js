import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthProvider";
import api from "../../services/TribeApiService";
import SplashScreen from "./SplashScreen";

const MyTribeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [myTribes, setMyTribes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) fetchMyTribes();
  }, [user]);

  const fetchMyTribes = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const tribes = await api.getMyTribes();
      setMyTribes(tribes || []);
    } catch (err) {
      console.error("[MyTribeScreen] fetchMyTribes failed:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyTribes();
    setRefreshing(false);
  };

  const renderTribeItem = ({ item }) => {
    // Backend returns snake_case fields; fall back to camelCase for safety
    const logoUrl       = item.logo_url   || item.logoUrl;
    const memberCount   = item.member_count ?? item.memberCount ?? 0;
    const memberStatus  = item.status     || item.membershipStatus;
    const createdBy     = item.created_by || item.createdBy;
    const isOwner       = createdBy === user?.uid || memberStatus === "owner";

    return (
      <TouchableOpacity
        style={styles.tribeItem}
        onPress={() => navigation.navigate("TribeDetail", { tribe: item })}
      >
        <Image source={{ uri: logoUrl }} style={styles.logo} />
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{item.name}</Text>
            {isOwner && (
              <View style={styles.ownerBadge}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.ownerBadgeText}>Owner</Text>
              </View>
            )}
          </View>
          <Text style={styles.description} numberOfLines={2}>
            {item.description || "No description provided"}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.memberStat}>
              <Ionicons name="people" size={16} color="#666" />
              <Text style={styles.memberCount}>{memberCount} members</Text>
            </View>
            <View style={styles.genreTag}>
              <Text style={styles.genreTagText}>{item.genre || "General"}</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#666" />
      </TouchableOpacity>
    );
  };

  if (loading) return <SplashScreen />;

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
        <Text style={styles.errorText}>Error loading your tribes</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchMyTribes}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0D1117", "#0D1117", "#0D1117"]}
        style={styles.backgroundGradient}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#00FF88" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Tribes</Text>
            <View style={styles.placeholder} />
          </View>
        </View>

        <FlatList
          data={myTribes}
          keyExtractor={(item) => item.id}
          renderItem={renderTribeItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#00FF88"]}
              tintColor="#00FF88"
              title="Pull to refresh"
              titleColor="#00FF88"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#666" />
              <Text style={styles.emptyText}>No tribes yet</Text>
              <Text style={styles.emptySubtext}>
                Join or create a tribe to get started!
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => navigation.navigate("CreateTribe")}
              >
                <Text style={styles.createButtonText}>Create Tribe</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#0D1117", paddingTop: 30 },
  backgroundGradient: { flex: 1 },
  header:           { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, backgroundColor: "#0D1117", borderBottomWidth: 1, borderColor: "#30363D" },
  headerTop:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backButton:       { padding: 8 },
  headerTitle:      { color: "#fff", fontSize: 24, fontWeight: "bold" },
  placeholder:      { width: 40 },
  listContent:      { padding: 16 },
  tribeItem:        { flexDirection: "row", backgroundColor: "#161B22", borderRadius: 16, borderWidth: 1, borderColor: "#30363D", padding: 16, marginBottom: 12, alignItems: "center" },
  logo:             { width: 64, height: 64, borderRadius: 32, marginRight: 16 },
  info:             { flex: 1 },
  titleRow:         { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  name:             { color: "#00FF88", fontSize: 18, fontWeight: "bold", flex: 1 },
  ownerBadge:       { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,215,0,0.1)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 8, gap: 4 },
  ownerBadgeText:   { color: "#FFD700", fontSize: 11, fontWeight: "600" },
  description:      { color: "#aaa", marginTop: 4, lineHeight: 18 },
  statsRow:         { flexDirection: "row", marginTop: 8, alignItems: "center", justifyContent: "space-between" },
  memberStat:       { flexDirection: "row", alignItems: "center" },
  memberCount:      { color: "#666", fontSize: 14, marginLeft: 4 },
  genreTag:         { backgroundColor: "#333", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  genreTagText:     { color: "#00FF88", fontSize: 12, fontWeight: "500" },
  emptyContainer:   { alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyText:        { color: "#fff", fontSize: 18, fontWeight: "600", marginTop: 16 },
  emptySubtext:     { color: "#666", fontSize: 14, marginTop: 8, textAlign: "center" },
  createButton:     { backgroundColor: "#00FF88", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 20 },
  createButtonText: { color: "#000", fontSize: 16, fontWeight: "600" },
  errorContainer:   { flex: 1, backgroundColor: "#0D1117", alignItems: "center", justifyContent: "center", padding: 20 },
  errorText:        { color: "#FF6B6B", fontSize: 20, fontWeight: "bold", marginTop: 16 },
  errorSubtext:     { color: "#666", fontSize: 14, marginTop: 8, textAlign: "center" },
  retryButton:      { backgroundColor: "#00FF88", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 20 },
  retryText:        { color: "#000", fontSize: 16, fontWeight: "600" },
});

export default MyTribeScreen;
