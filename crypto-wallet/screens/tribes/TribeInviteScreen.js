import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useWallet } from "../../contexts/WalletContext";
import { useTribeMembership } from "../../hooks/useTribeMembership";
import { useTokenGating } from "../../hooks/useTokenGating";
import { FONTS, SPACING, BORDER_RADIUS } from "../../constants/Theme";
import { useNavigation } from "@react-navigation/native";
import api from "../../services/TribeApiService";
import Alert from "../../utils/Alert";

const InviteScreen = ({ route }) => {
  const { inviteCode } = route.params;
  const { user, isAuthenticated } = useAuth();
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const walletContext = useWallet();
  const { address } = walletContext || {};
  const navigation = useNavigation();

  const [loading, setLoading]       = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [tribeData, setTribeData]   = useState(null);
  const [error, setError]           = useState(null);

  // Initialize hooks after tribe data is loaded
  const tribeMembership = tribeData
    ? useTribeMembership(tribeData, user, tribeData.privacy || "public")
    : null;

  const tokenGating = tribeData
    ? useTokenGating(
        tribeData.id,
        user,
        address,
        tribeData.privacy || "public",
        tribeMembership?.isMember
      )
    : null;

  useEffect(() => {
    fetchInviteData();
  }, [inviteCode, isAuthenticated, user]);

  const fetchInviteData = async () => {
    if (!isAuthenticated) {
      setError("authentication");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Lookup invite by code via backend API
      const invite = await api.getInviteByCode(inviteCode);

      if (!invite) {
        setError("invalid");
        setLoading(false);
        return;
      }

      // expires_at comes as ISO string from PostgreSQL
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        setError("expired");
        setLoading(false);
        return;
      }

      if (invite.max_uses && invite.uses >= invite.max_uses) {
        setError("maxed");
        setLoading(false);
        return;
      }

      // Fetch the tribe the invite belongs to
      const tribe = await api.getTribe(invite.tribe_id);

      if (!tribe) {
        setError("tribe_not_found");
        setLoading(false);
        return;
      }

      setInviteData(invite);
      setTribeData(tribe);
      setLoading(false);
    } catch (err) {
      console.error("[InviteScreen] Error fetching invite:", err);
      setError("fetch_error");
      setLoading(false);
    }
  };

  const handleJoinTribe = async () => {
    if (!tribeData || !inviteData) return;

    // Token gating check
    if (tribeData.privacy === "private" && tokenGating?.tokenGatingData && !tokenGating?.hasRequiredToken) {
      const req = tokenGating.tokenGatingData.tokenType === "Token"
        ? `at least ${tokenGating.tokenGatingData.minTokenAmount} ${tokenGating.tokenGatingData.symbol} tokens`
        : "at least 1 NFT from the required collection";
      Alert.alert("Access Denied", `You need to hold ${req} to join this tribe.`);
      return;
    }

    setJoinLoading(true);
    try {
      // Pass inviteId so the backend tracks usage — no Firestore write needed
      await api.joinTribe(tribeData.id, {
        username:      user?.displayName || user?.email?.split("@")[0] || "Unknown",
        walletAddress: address || null,
        inviteId:      inviteData.id,
      });

      setTimeout(() => navigation.replace("TribeDetail", { tribe: tribeData }), 500);
    } catch (err) {
      console.error("[InviteScreen] join failed:", err);
      Alert.alert("Error", err?.response?.data?.error || err.message || "Failed to join. Please try again.");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleGoToTribe = () => {
    navigation.navigate("TribeDetail", {
      tribe: tribeData,
    });
  };

  const handleLogin = () => {
    navigation.navigate("Login");
  };

  // Move styles inside component to access dynamic COLORS
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    gradientBackground: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: SPACING.xxl,
    },

    // Header
    header: {
      flexDirection: "row",
      justifyContent: "flex-end",
      padding: SPACING.md,
      paddingTop: SPACING.xl,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${COLORS.text}20`,
      justifyContent: "center",
      alignItems: "center",
    },

    // Banner & Logo
    banner: {
      width: "100%",
      height: 200,
      backgroundColor: COLORS.surface,
    },
    logoContainer: {
      alignSelf: "center",
      marginTop: -60,
      marginBottom: SPACING.lg,
    },
    logo: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 4,
      borderColor: COLORS.background,
      backgroundColor: COLORS.surface,
    },
    privateBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: COLORS.background,
      borderWidth: 2,
      borderColor: "#FFD700",
      justifyContent: "center",
      alignItems: "center",
    },

    // Info Section
    infoSection: {
      paddingHorizontal: SPACING.lg,
    },
    title: {
      fontSize: FONTS.sizes.xxl,
      fontWeight: "bold",
      color: COLORS.text,
      textAlign: "center",
      marginBottom: SPACING.sm,
    },
    genreContainer: {
      flexDirection: "row",
      justifyContent: "center",
      marginBottom: SPACING.md,
    },
    genreBadge: {
      backgroundColor: `${COLORS.primary}20`,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.lg,
    },
    genreText: {
      color: COLORS.primary,
      fontSize: FONTS.sizes.sm,
      fontWeight: "600",
    },
    description: {
      fontSize: FONTS.sizes.md,
      color: COLORS.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: SPACING.lg,
    },

    // Stats
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      backgroundColor: COLORS.surface,
      borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    statItem: {
      alignItems: "center",
      gap: SPACING.xs,
    },
    statValue: {
      fontSize: FONTS.sizes.lg,
      fontWeight: "bold",
      color: COLORS.text,
    },
    statLabel: {
      fontSize: FONTS.sizes.xs,
      color: COLORS.textTertiary,
    },

    // Token Gating
    tokenGatingInfo: {
      backgroundColor: "rgba(255, 215, 0, 0.1)",
      borderWidth: 1,
      borderColor: "rgba(255, 215, 0, 0.3)",
      borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.md,
      marginBottom: SPACING.lg,
    },
    tokenGatingHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    tokenGatingTitle: {
      fontSize: FONTS.sizes.md,
      fontWeight: "600",
      color: "#FFD700",
    },
    tokenGatingText: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
    },

    // Actions
    actionsContainer: {
      marginTop: SPACING.lg,
      gap: SPACING.md,
    },
    memberBadgeContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.sm,
      backgroundColor: `${COLORS.success || "#10B981"}15`,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      marginBottom: SPACING.sm,
    },
    memberBadgeText: {
      fontSize: FONTS.sizes.md,
      color: COLORS.success || "#10B981",
      fontWeight: "600",
    },
    primaryButton: {
      borderRadius: BORDER_RADIUS.lg,
      overflow: "hidden",
    },
    buttonGradient: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: SPACING.md,
      gap: SPACING.sm,
    },
    primaryButtonText: {
      color: COLORS.card || "#FFFFFF",
      fontSize: FONTS.sizes.md,
      fontWeight: "bold",
    },
    secondaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: COLORS.surface,
      gap: SPACING.sm,
    },
    secondaryButtonText: {
      color: COLORS.primary,
      fontSize: FONTS.sizes.md,
      fontWeight: "600",
    },
    buttonDisabled: {
      opacity: 0.6,
    },

    // Loading State
    loadingText: {
      marginTop: SPACING.md,
      fontSize: FONTS.sizes.md,
      color: COLORS.textSecondary,
    },

    // Error State
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: SPACING.xl,
    },
    errorIconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: `${COLORS.error}15`,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: SPACING.lg,
    },
    errorTitle: {
      fontSize: FONTS.sizes.xl,
      fontWeight: "bold",
      color: COLORS.text,
      marginBottom: SPACING.sm,
      textAlign: "center",
    },
    errorMessage: {
      fontSize: FONTS.sizes.md,
      color: COLORS.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: SPACING.xl,
      paddingHorizontal: SPACING.md,
    },
  });

  // Loading State
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <LinearGradient
          colors={[COLORS.background, COLORS.surface]}
          style={styles.gradientBackground}
        >
          <View style={{ alignItems: "center" }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading invite...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Error States
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <LinearGradient
          colors={[COLORS.background, COLORS.surface]}
          style={styles.gradientBackground}
        >
          <View style={styles.errorContainer}>
            <View style={styles.errorIconContainer}>
              <Ionicons
                name={
                  error === "authentication"
                    ? "lock-closed"
                    : error === "expired"
                    ? "time"
                    : error === "maxed"
                    ? "people"
                    : "alert-circle"
                }
                size={64}
                color={COLORS.error}
              />
            </View>

            <Text style={styles.errorTitle}>
              {error === "authentication" && "Login Required"}
              {error === "invalid" && "Invalid Invite"}
              {error === "expired" && "Invite Expired"}
              {error === "maxed" && "Invite Full"}
              {error === "tribe_not_found" && "Tribe Not Found"}
              {error === "fetch_error" && "Something Went Wrong"}
            </Text>

            <Text style={styles.errorMessage}>
              {error === "authentication" &&
                "Please log in to accept tribe invites."}
              {error === "invalid" &&
                "This invite link is invalid or has been deactivated."}
              {error === "expired" && "This invite link has expired."}
              {error === "maxed" &&
                "This invite has reached its maximum number of uses."}
              {error === "tribe_not_found" &&
                "The tribe associated with this invite could not be found."}
              {error === "fetch_error" &&
                "Unable to load invite. Please try again later."}
            </Text>

            {error === "authentication" ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleLogin}
              >
                <LinearGradient
                  colors={[
                    COLORS.primary,
                    COLORS.primaryLight || COLORS.primary,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Ionicons
                    name="log-in"
                    size={20}
                    color={COLORS.card || "#FFFFFF"}
                  />
                  <Text style={styles.primaryButtonText}>Log In</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
                <Text style={styles.secondaryButtonText}>Go Back</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Success State - Show Tribe Info
  const isMember    = tribeMembership?.isMember || false;
  const memberCount = tribeMembership?.memberCount || tribeData?.member_count || tribeData?.memberCount || 0;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.background, COLORS.surface]}
        style={styles.gradientBackground}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="close" size={28} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Tribe Banner */}
          {tribeData?.bannerUrl && (
            <Image
              source={{ uri: tribeData.bannerUrl }}
              style={styles.banner}
              resizeMode="cover"
            />
          )}

          {/* Tribe Logo */}
          <View style={styles.logoContainer}>
            <Image source={{ uri: tribeData?.logoUrl }} style={styles.logo} />
            {tribeData?.privacy === "private" && (
              <View style={styles.privateBadge}>
                <Ionicons name="lock-closed" size={16} color="#FFD700" />
              </View>
            )}
          </View>

          {/* Tribe Info */}
          <View style={styles.infoSection}>
            <Text style={styles.title}>{tribeData?.name}</Text>

            <View style={styles.genreContainer}>
              <View style={styles.genreBadge}>
                <Text style={styles.genreText}>{tribeData?.genre}</Text>
              </View>
            </View>

            {tribeData?.description && (
              <Text style={styles.description}>{tribeData.description}</Text>
            )}

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="people" size={20} color={COLORS.primary} />
                <Text style={styles.statValue}>{memberCount}</Text>
                <Text style={styles.statLabel}>Members</Text>
              </View>

              {inviteData?.max_uses && (
                <View style={styles.statItem}>
                  <Ionicons name="person-add" size={20} color={COLORS.primary} />
                  <Text style={styles.statValue}>
                    {inviteData.uses}/{inviteData.max_uses}
                  </Text>
                  <Text style={styles.statLabel}>Uses</Text>
                </View>
              )}

              {inviteData?.expires_at && (
                <View style={styles.statItem}>
                  <Ionicons name="time" size={20} color={COLORS.primary} />
                  <Text style={styles.statValue}>
                    {Math.max(0, Math.ceil(
                      (new Date(inviteData.expires_at) - Date.now()) / (1000 * 60 * 60 * 24)
                    ))}d
                  </Text>
                  <Text style={styles.statLabel}>Remaining</Text>
                </View>
              )}
            </View>

            {/* Privacy Info */}
            {tribeData?.privacy === "private" &&
              tokenGating?.tokenGatingData && (
                <View style={styles.tokenGatingInfo}>
                  <View style={styles.tokenGatingHeader}>
                    <Ionicons
                      name="shield-checkmark"
                      size={20}
                      color="#FFD700"
                    />
                    <Text style={styles.tokenGatingTitle}>
                      Token Gated Tribe
                    </Text>
                  </View>
                  <Text style={styles.tokenGatingText}>
                    Requires {tokenGating.tokenGatingData.minTokenAmount}{" "}
                    {tokenGating.tokenGatingData.symbol}
                  </Text>
                </View>
              )}

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              {isMember ? (
                <>
                  <View style={styles.memberBadgeContainer}>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={COLORS.success || "#10B981"}
                    />
                    <Text style={styles.memberBadgeText}>
                      You're already a member
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleGoToTribe}
                  >
                    <LinearGradient
                      colors={[
                        COLORS.primary,
                        COLORS.primaryLight || COLORS.primary,
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      <Ionicons
                        name="arrow-forward"
                        size={20}
                        color={COLORS.card || "#FFFFFF"}
                      />
                      <Text style={styles.primaryButtonText}>Go to Tribe</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      joinLoading && styles.buttonDisabled,
                    ]}
                    onPress={handleJoinTribe}
                    disabled={joinLoading}
                  >
                    <LinearGradient
                      colors={[
                        COLORS.primary,
                        COLORS.primaryLight || COLORS.primary,
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      {joinLoading ? (
                        <>
                          <ActivityIndicator
                            size="small"
                            color={COLORS.card || "#FFFFFF"}
                          />
                          <Text style={styles.primaryButtonText}>
                            Joining...
                          </Text>
                        </>
                      ) : (
                        <>
                          <Ionicons
                            name="add-circle"
                            size={20}
                            color={COLORS.card || "#FFFFFF"}
                          />
                          <Text style={styles.primaryButtonText}>
                            Join Tribe
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => navigation.goBack()}
                    disabled={joinLoading}
                  >
                    <Text style={styles.secondaryButtonText}>Maybe Later</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

export default InviteScreen;
