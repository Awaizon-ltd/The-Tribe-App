// components/TribeTabContent.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../../contexts/ThemeContext";
import TribeRequestsScreen from "../../screens/tribes/TribeRequestScreen";
import PostsScreen from "../../screens/tribes/TribePostScreen";
import TokenRequirements from "./TokenRequirements";
import {
  getExternalLinks,
  getTribeInvites,
} from "../../utils/TribeManagementDB";
import Alert from "../../utils/Alert";

const TribeTabContent = ({
  activeTab,
  tribe,
  memberCount,
  members,
  membershipStatus,
  privacy,
  tokenGatingData,
  isMember,
  hasRequiredToken,
  tokenCheckLoading,
  useraddress,
  checkTokenBalance,
  navigation,
}) => {
  const { COLORS, isDark } = useTheme();
  const [externalLinks, setExternalLinks] = useState(null);
  const [activeInvite, setActiveInvite] = useState(null);
  const [loadingLinks, setLoadingLinks] = useState(true);

  // Load external links and invite when overview tab is active
  useEffect(() => {
    if (activeTab === "overview") {
      loadOverviewData();
    }
  }, [activeTab, tribe.id, isMember]);

  const loadOverviewData = async () => {
    setLoadingLinks(true);
    try {
      // Load external links
      const links = await getExternalLinks(tribe.id);
      setExternalLinks(links);

      // Load invite link (if member)
      if (isMember) {
        const invites = await getTribeInvites(tribe.id);
        if (invites.length > 0) {
          setActiveInvite(invites[0]);
        }
      }
    } catch (error) {
      console.error("Error loading overview data:", error);
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleOpenLink = async (url) => {
    try {
      const supported = await Linking.openURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Cannot open this URL");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to open link");
    }
  };

  const handleCopyInvite = async () => {
    if (!activeInvite) return;

    // Must match app.json's registered associatedDomains (sysfidao.com) —
    // "thetribe.com" isn't a real, registered universal-link domain and
    // would fail to reopen the app.
    const inviteUrl = `https://sysfidao.com/invite/${activeInvite.code}`;
    await Clipboard.setStringAsync(inviteUrl);
    Alert.alert("Copied!", "Invite link copied to clipboard");
  };

  const handleShareInvite = async () => {
    if (!activeInvite) return;

    // Must match app.json's registered associatedDomains (sysfidao.com) —
    // "thetribe.com" isn't a real, registered universal-link domain and
    // would fail to reopen the app.
    const inviteUrl = `https://sysfidao.com/invite/${activeInvite.code}`;
    await Share.share({
      message: `Join ${tribe.name} on our app!\n${inviteUrl}`,
    });
  };

  const hasExternalLinks =
    externalLinks &&
    (externalLinks.website ||
      externalLinks.twitter ||
      externalLinks.discord ||
      externalLinks.telegram);

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Stats Section */}
      <View
        style={[styles.statsContainer, { backgroundColor: COLORS.surface }]}
      >
        <View style={styles.statItem}>
          <Ionicons
            name="people"
            size={24}
            color={COLORS.success || "#00FF88"}
          />
          <Text style={[styles.statNumber, { color: COLORS.text }]}>
            {memberCount}
          </Text>
          <Text style={[styles.statLabel, { color: COLORS.textTertiary }]}>
            Members
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons
            name="calendar"
            size={24}
            color={COLORS.info || "#00D4FF"}
          />
          <Text style={[styles.statNumber, { color: COLORS.text }]}>
            {tribe.createdAt?.toDate
              ? new Date(tribe.createdAt.toDate()).getFullYear()
              : new Date().getFullYear()}
          </Text>
          <Text style={[styles.statLabel, { color: COLORS.textTertiary }]}>
            Founded
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons
            name={privacy === "public" ? "lock-open" : "lock-closed"}
            size={24}
            color={COLORS.warning || "#FFB800"}
          />
          <Text style={[styles.statNumber, { color: COLORS.text }]}>
            {privacy === "public" ? "Public" : "Private"}
          </Text>
          <Text style={[styles.statLabel, { color: COLORS.textTertiary }]}>
            Privacy
          </Text>
        </View>
      </View>

      {/* Token Requirements (Private Tribes) */}
      {privacy === "private" && tokenGatingData && !isMember && (
        <TokenRequirements
          tokenGatingData={tokenGatingData}
          hasRequiredToken={hasRequiredToken}
          tokenCheckLoading={tokenCheckLoading}
          useraddress={useraddress}
          checkTokenBalance={checkTokenBalance}
        />
      )}

      {/* About Section */}
      <View style={styles.aboutSection}>
        <Text style={[styles.sectionTitle, { color: COLORS.primary }]}>
          About This Tribe
        </Text>
        <Text style={[styles.aboutText, { color: COLORS.textSecondary }]}>
          {tribe.description || "No description provided for this tribe."}
        </Text>
      </View>

      {/* Invite Section (Members Only) */}
      {isMember && activeInvite && (
        <View style={styles.inviteSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="link-outline" size={20} color={COLORS.primary} />
            <Text style={[styles.sectionTitle, { color: COLORS.primary }]}>
              Invite Friends
            </Text>
          </View>

          <View
            style={[
              styles.inviteContainer,
              { backgroundColor: COLORS.surface },
            ]}
          >
            <View style={styles.inviteCodeWrapper}>
              <Text
                style={[styles.inviteLabel, { color: COLORS.textTertiary }]}
              >
                Invite Code
              </Text>
              <Text style={[styles.inviteCode, { color: COLORS.primary }]}>
                {activeInvite.code}
              </Text>
              {activeInvite.uses > 0 && (
                <Text
                  style={[styles.inviteUses, { color: COLORS.textTertiary }]}
                >
                  Used {activeInvite.uses} time
                  {activeInvite.uses !== 1 ? "s" : ""}
                </Text>
              )}
            </View>

            <View style={styles.inviteActions}>
              <TouchableOpacity
                style={[
                  styles.inviteButton,
                  {
                    backgroundColor: COLORS.background,
                    borderColor: isDark ? "#00FF8820" : COLORS.primary + "20",
                  },
                ]}
                onPress={handleCopyInvite}
              >
                <Ionicons
                  name="copy-outline"
                  size={18}
                  color={COLORS.primary}
                />
                <Text
                  style={[styles.inviteButtonText, { color: COLORS.primary }]}
                >
                  Copy
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.inviteButton,
                  {
                    backgroundColor: COLORS.background,
                    borderColor: isDark ? "#00FF8820" : COLORS.primary + "20",
                  },
                ]}
                onPress={handleShareInvite}
              >
                <Ionicons
                  name="share-outline"
                  size={18}
                  color={COLORS.primary}
                />
                <Text
                  style={[styles.inviteButtonText, { color: COLORS.primary }]}
                >
                  Share
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* External Links Section */}
      {hasExternalLinks && (
        <View style={styles.externalLinksSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="globe-outline" size={20} color={COLORS.primary} />
            <Text style={[styles.sectionTitle, { color: COLORS.primary }]}>
              External Links
            </Text>
          </View>

          <View style={styles.linksContainer}>
            {externalLinks.website && (
              <TouchableOpacity
                style={[styles.linkButton, { backgroundColor: COLORS.surface }]}
                onPress={() => handleOpenLink(externalLinks.website)}
              >
                <View style={styles.linkIconContainer}>
                  <Ionicons
                    name="globe-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
                <View style={styles.linkInfo}>
                  <Text style={[styles.linkLabel, { color: COLORS.text }]}>
                    Website
                  </Text>
                  <Text
                    style={[styles.linkUrl, { color: COLORS.textTertiary }]}
                    numberOfLines={1}
                  >
                    {externalLinks.website.replace(/^https?:\/\//, "")}
                  </Text>
                </View>
                <Ionicons
                  name="open-outline"
                  size={18}
                  color={COLORS.textTertiary}
                />
              </TouchableOpacity>
            )}

            {externalLinks.twitter && (
              <TouchableOpacity
                style={[styles.linkButton, { backgroundColor: COLORS.surface }]}
                onPress={() => handleOpenLink(externalLinks.twitter)}
              >
                <View
                  style={[
                    styles.linkIconContainer,
                    { backgroundColor: "#1DA1F220" },
                  ]}
                >
                  <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
                </View>
                <View style={styles.linkInfo}>
                  <Text style={[styles.linkLabel, { color: COLORS.text }]}>
                    Twitter
                  </Text>
                  <Text
                    style={[styles.linkUrl, { color: COLORS.textTertiary }]}
                    numberOfLines={1}
                  >
                    {externalLinks.twitter.replace(/^https?:\/\//, "")}
                  </Text>
                </View>
                <Ionicons
                  name="open-outline"
                  size={18}
                  color={COLORS.textTertiary}
                />
              </TouchableOpacity>
            )}

            {externalLinks.discord && (
              <TouchableOpacity
                style={[styles.linkButton, { backgroundColor: COLORS.surface }]}
                onPress={() => handleOpenLink(externalLinks.discord)}
              >
                <View
                  style={[
                    styles.linkIconContainer,
                    { backgroundColor: "#5865F220" },
                  ]}
                >
                  <Ionicons name="logo-discord" size={20} color="#5865F2" />
                </View>
                <View style={styles.linkInfo}>
                  <Text style={[styles.linkLabel, { color: COLORS.text }]}>
                    Discord
                  </Text>
                  <Text
                    style={[styles.linkUrl, { color: COLORS.textTertiary }]}
                    numberOfLines={1}
                  >
                    {externalLinks.discord.replace(/^https?:\/\//, "")}
                  </Text>
                </View>
                <Ionicons
                  name="open-outline"
                  size={18}
                  color={COLORS.textTertiary}
                />
              </TouchableOpacity>
            )}

            {externalLinks.telegram && (
              <TouchableOpacity
                style={[styles.linkButton, { backgroundColor: COLORS.surface }]}
                onPress={() => handleOpenLink(externalLinks.telegram)}
              >
                <View
                  style={[
                    styles.linkIconContainer,
                    { backgroundColor: "#0088CC20" },
                  ]}
                >
                  <Ionicons
                    name="paper-plane-outline"
                    size={20}
                    color="#0088CC"
                  />
                </View>
                <View style={styles.linkInfo}>
                  <Text style={[styles.linkLabel, { color: COLORS.text }]}>
                    Telegram
                  </Text>
                  <Text
                    style={[styles.linkUrl, { color: COLORS.textTertiary }]}
                    numberOfLines={1}
                  >
                    {externalLinks.telegram.replace(/^https?:\/\//, "")}
                  </Text>
                </View>
                <Ionicons
                  name="open-outline"
                  size={18}
                  color={COLORS.textTertiary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Members Section */}
      <View style={styles.membersSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people-outline" size={20} color={COLORS.primary} />
          <Text style={[styles.sectionTitle, { color: COLORS.primary }]}>
            Recent Members
          </Text>
        </View>
        {members.slice(0, 5).map((item) => (
          <View
            key={item.user_id || item.id}
            style={[styles.memberItem, { backgroundColor: COLORS.surface }]}
          >
            <View
              style={[
                styles.memberAvatar,
                { backgroundColor: isDark ? "#333" : COLORS.border },
              ]}
            >
              <Text
                style={[styles.memberAvatarText, { color: COLORS.primary }]}
              >
                {item.username?.charAt(0)?.toUpperCase() || "U"}
              </Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={[styles.memberName, { color: COLORS.text }]}>
                {item.username}
              </Text>
              <Text
                style={[styles.memberStatus, { color: COLORS.textTertiary }]}
              >
                {item.status}
              </Text>
            </View>
          </View>
        ))}
        {memberCount > 5 && (
          <Text
            style={[styles.moreMembersText, { color: COLORS.textTertiary }]}
          >
            +{memberCount - 5} more member{memberCount - 5 !== 1 ? "s" : ""}
          </Text>
        )}
      </View>
    </View>
  );

  const renderRequestTab = () => {
    if (membershipStatus === "owner" && privacy === "private") {
      return (
        <View style={styles.tabContent}>
          <TribeRequestsScreen tribeId={tribe.id} />
        </View>
      );
    }
    return (
      <View style={styles.tabContent}>
        <Text style={[styles.restrictedText, { color: COLORS.textTertiary }]}>
          Access restricted.
        </Text>
      </View>
    );
  };

  const renderPostsTab = () => (
    <View
      style={[styles.postsContainer, { backgroundColor: COLORS.background }]}
    >
      <PostsScreen
        route={{
          params: {
            tribeId: tribe.id,
            membershipStatus: membershipStatus,
          },
        }}
        navigation={navigation}
      />
    </View>
  );

  switch (activeTab) {
    case "overview":
      return renderOverviewTab();
    case "request":
      return renderRequestTab();
    case "posts":
      return renderPostsTab();
    default:
      return null;
  }
};

const styles = StyleSheet.create({
  tabContent: {
    padding: 20,
  },
  postsContainer: {
    flex: 1,
  },
  restrictedText: {
    fontSize: 13,
    textAlign: "center",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  aboutSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    marginLeft: 8,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 24,
  },
  inviteSection: {
    marginBottom: 24,
  },
  inviteContainer: {
    borderRadius: 12,
    padding: 16,
  },
  inviteCodeWrapper: {
    marginBottom: 16,
  },
  inviteLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  inviteCode: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: 2,
  },
  inviteUses: {
    fontSize: 11,
    marginTop: 4,
  },
  inviteActions: {
    flexDirection: "row",
    gap: 12,
  },
  inviteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  externalLinksSection: {
    marginBottom: 24,
  },
  linksContainer: {
    gap: 8,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
  },
  linkIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#00FF8820",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  linkInfo: {
    flex: 1,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  linkUrl: {
    fontSize: 12,
    marginTop: 2,
  },
  membersSection: {
    marginBottom: 24,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
  },
  memberStatus: {
    fontSize: 14,
    textTransform: "capitalize",
  },
  moreMembersText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
});

export default TribeTabContent;
