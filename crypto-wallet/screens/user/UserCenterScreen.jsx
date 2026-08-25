import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { signOut } from "firebase/auth";
import { auth, storage, db } from "../../config/Firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { useUserData } from "../../context/userDataContext";
import { useNavigation } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from "expo-linear-gradient";

// Import the enhanced profile hook
import { useUserProfileEnhanced } from "../../hooks/useUserProfile";

const { width } = Dimensions.get('window');

const UserCenterScreen = () => {
  const { userData, loading: userDataLoading, updateUserData } = useUserData();
  const navigation = useNavigation();
  const [imageUpdateLoading, setImageUpdateLoading] = useState(false);
  const [showDAODetails, setShowDAODetails] = useState(false);

  // Use the enhanced profile hook
  const {
    profileStats,
    loading: profileLoading,
    isRefreshing,
    isSyncing,
    refreshProfile,
    getProgressToNextTier,
    getAchievements,
    getMemberDuration,
  } = useUserProfileEnhanced(userData?.walletAddress);

  const formatBalance = (balance) => {
    if (!balance && balance !== 0) return "0";
    return new Intl.NumberFormat("en-US").format(balance);
  };

  const sliceAddress = (address) => {
    if (!address) return "No wallet connected";
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const copyToClipboard = (text) => {
    Alert.alert("Copied", "Wallet address copied to clipboard");
  };

  const uploadImageToFirebase = async (imageUri) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const timestamp = Date.now();
      const filename = `profile_pictures/${userId}_${timestamp}.jpg`;
      const imageRef = ref(storage, filename);
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const snapshot = await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return {
        url: downloadURL,
        path: filename
      };
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const updateUserProfileImage = async (imageUrl, imagePath) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const userDocRef = doc(db, "users", userId);
      await updateDoc(userDocRef, {
        profilePicture: imageUrl,
        profileImagePath: imagePath,
        updatedAt: new Date()
      });

      updateUserData({ 
        profileImage: imageUrl,
        profileImagePath: imagePath 
      });
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  };

  const deleteOldProfileImage = async (imagePath) => {
    try {
      if (imagePath) {
        const oldImageRef = ref(storage, imagePath);
        await deleteObject(oldImageRef);
      }
    } catch (error) {
      console.error("Error deleting old image:", error);
    }
  };

  const handleImagePicker = () => {
    Alert.alert(
      "Update Profile Image",
      "Choose an option",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Camera", onPress: () => pickImage('camera') },
        { text: "Gallery", onPress: () => pickImage('gallery') },
      ]
    );
  };

  const pickImage = async (source) => {
    try {
      setImageUpdateLoading(true);
      
      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: false,
      };

      let result;
      if (source === 'camera') {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert("Permission required", "Camera permission is required to take photos");
          setImageUpdateLoading(false);
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert("Permission required", "Gallery permission is required to select photos");
          setImageUpdateLoading(false);
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        const oldImagePath = userData?.profileImagePath;
        const { url: downloadURL, path: imagePath } = await uploadImageToFirebase(imageUri);
        await updateUserProfileImage(downloadURL, imagePath);
        if (oldImagePath) {
          await deleteOldProfileImage(oldImagePath);
        }
        Alert.alert("Success", "Profile image updated successfully!");
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Failed to update profile image. Please try again.");
    } finally {
      setImageUpdateLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await SecureStore.deleteItemAsync("wallet");
            await AsyncStorage.clear();
            await signOut(auth);
          } catch (error) {
            console.error("Logout error:", error);
            Alert.alert("Error", "Failed to logout. Please try again.");
          }
        },
      },
    ]);
  };

  const gridItems = [
    {
      id: "nfts",
      title: "Collections",
      icon: "diamond",
      gradient: ["#43e97b", "#38f9d7"],
      description: "NFT Gallery",
      onPress: () => navigation.navigate("NFTs"),
    },
    {
      id: "dao",
      title: "SYSFI Governance",
      icon: "people",
      gradient: ["#f093fb", "#f5576c"],
      description: "DAO Participation",
      onPress: () => navigation.navigate("DAO"),
    },
    {
      id: "identity",
      title: "Identity",
      icon: "shield-checkmark",
      gradient: ["#4facfe", "#00f2fe"],
      description: "onChain Identity",
      onPress: () => navigation.navigate("Identity"),
    },
  ];

  const renderGridItem = (item, index) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.gridItem, { 
        marginLeft: index % 2 === 0 ? 0 : 8,
        marginRight: index % 2 === 0 ? 8 : 0,
      }]}
      onPress={item.onPress}
      activeOpacity={0.8}
    >
      <View style={styles.gridContent}>
        <View style={[styles.iconContainer, { backgroundColor: item.gradient[0] + '20' }]}>
          <Ionicons name={item.icon} size={28} color={item.gradient[0]} />
        </View>
        <View style={styles.gridTextContainer}>
          <Text style={styles.gridTitle}>{item.title}</Text>
          <Text style={styles.gridDescription}>{item.description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6B7280" />
      </View>
    </TouchableOpacity>
  );

  const renderAchievements = () => {
    const achievements = getAchievements();
    if (achievements.length === 0) return null;

    return (
      <View style={styles.achievementsSection}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.achievementsScroll}
        >
          {achievements.map((achievement, index) => (
            <View key={index} style={styles.achievementCard}>
              <View style={[styles.achievementIcon, { backgroundColor: achievement.color + '20' }]}>
                <Ionicons name={achievement.icon} size={24} color={achievement.color} />
              </View>
              <Text style={styles.achievementName}>{achievement.name}</Text>
              <Text style={styles.achievementDesc}>{achievement.description}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderDAOSpecificStats = () => {
    if (!profileStats.daoSpecificStats || profileStats.daoSpecificStats.length === 0) {
      return null;
    }

    return (
      <View style={styles.daoStatsSection}>
        <View style={styles.daoStatsHeader}>
          <Text style={styles.sectionTitle}>DAO Activity</Text>
          <TouchableOpacity 
            onPress={() => setShowDAODetails(!showDAODetails)}
            style={styles.expandButton}
          >
            <Text style={styles.expandButtonText}>
              {showDAODetails ? 'Hide' : 'Show'} Details
            </Text>
            <Ionicons 
              name={showDAODetails ? "chevron-up" : "chevron-down"} 
              size={16} 
              color="#10B981" 
            />
          </TouchableOpacity>
        </View>

        {showDAODetails && (
          <View style={styles.daoStatsList}>
            {profileStats.daoSpecificStats.map((daoStat, index) => (
              <View key={index} style={styles.daoStatCard}>
                <View style={styles.daoStatHeader}>
                  <Text style={styles.daoStatName} numberOfLines={1}>
                    {daoStat.daoName || sliceAddress(daoStat.daoAddress)}
                  </Text>
                  {daoStat.isDelegatee && (
                    <View style={styles.delegateeBadge}>
                      <Ionicons name="ribbon" size={12} color="#14B8A6" />
                      <Text style={styles.delegateeBadgeText}>Rep</Text>
                    </View>
                  )}
                </View>

                <View style={styles.daoStatRow}>
                  <View style={styles.daoStatItem}>
                    <MaterialCommunityIcons name="vote" size={16} color="#8B5CF6" />
                    <Text style={styles.daoStatValue}>{daoStat.votesCast}</Text>
                    <Text style={styles.daoStatLabel}>Votes</Text>
                  </View>
                  <View style={styles.daoStatItem}>
                    <Ionicons name="bulb-outline" size={16} color="#F59E0B" />
                    <Text style={styles.daoStatValue}>{daoStat.proposalsCreated}</Text>
                    <Text style={styles.daoStatLabel}>Proposals</Text>
                  </View>
                  {daoStat.isDelegatee && (
                    <View style={styles.daoStatItem}>
                      <MaterialCommunityIcons name="account-group" size={16} color="#14B8A6" />
                      <Text style={styles.daoStatValue}>{daoStat.delegatorCount}</Text>
                      <Text style={styles.daoStatLabel}>Delegators</Text>
                    </View>
                  )}
                </View>

                {daoStat.isDelegator && (
                  <View style={styles.delegatorBadgeContainer}>
                    <MaterialCommunityIcons name="git-branch" size={12} color="#3B82F6" />
                    <Text style={styles.delegatorBadgeText}>Delegated Power</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (userDataLoading || profileLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const progress = getProgressToNextTier();
  const reputation = profileStats.reputation;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshProfile}
            tintColor="#10B981"
            colors={["#10B981"]}
          />
        }
      >
        {/* Sync Indicator */}
        {isSyncing && (
          <View style={styles.syncIndicator}>
            <ActivityIndicator size="small" color="#10B981" />
            <Text style={styles.syncText}>Syncing from blockchain...</Text>
          </View>
        )}

        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerBackground} />
          <View style={styles.profileSection}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleImagePicker}
              activeOpacity={0.8}
            >
              {userData?.profileImage ? (
                <Image
                  source={{ uri: userData.profileImage }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.defaultAvatar}>
                  <Ionicons name="person" size={32} color="#10B981" />
                </View>
              )}
              <View style={styles.cameraOverlay}>
                {imageUpdateLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>
            
            <View style={styles.userInfo}>
              <Text style={styles.username}>
                {userData?.username || userData?.displayName || "Anonymous User"}
              </Text>
              <Text style={styles.email}>{userData?.email || "No email provided"}</Text>
              <TouchableOpacity 
                style={styles.walletContainer}
                onPress={() => copyToClipboard(userData?.walletAddress)}
                activeOpacity={0.7}
              >
                <Ionicons name="wallet-outline" size={16} color="#8B5CF6" />
                <Text style={styles.walletAddress}>
                  {sliceAddress(userData?.walletAddress)}
                </Text>
                <Ionicons name="copy-outline" size={14} color="#8B5CF6" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Reputation Card */}
        <View style={styles.reputationSection}>
          <LinearGradient
            colors={reputation.gradient}
            style={styles.reputationCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.reputationHeader}>
              <View style={styles.reputationIconContainer}>
                <Ionicons name={reputation.icon} size={32} color="white" />
              </View>
              <View style={styles.reputationInfo}>
                <Text style={styles.reputationTitle}>{reputation.name}</Text>
                <Text style={styles.reputationDescription}>{reputation.description}</Text>
              </View>
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreValue}>{profileStats.activityScore}</Text>
                <Text style={styles.scoreLabel}>Score</Text>
              </View>
            </View>

            {progress.nextTier && (
              <View style={styles.progressSection}>
                <View style={styles.progressInfo}>
                  <Text style={styles.progressLabel}>Next: {progress.nextTier.name}</Text>
                  <Text style={styles.progressPoints}>{progress.pointsNeeded} points needed</Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${progress.percentage}%` }]} />
                </View>
                <Text style={styles.progressPercentage}>{progress.percentage}%</Text>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* Airdrop Section */}
        {userData?.balance !== undefined && (
          <View style={styles.airdropSection}>
            <View style={styles.airdropHeader}>
              <View>
                <Text style={styles.sectionTitle}>Token Balance</Text>
                <Text style={styles.sectionSubtitle}>Your $SYN allocation</Text>
              </View>
              <View style={styles.balanceBadge}>
                <Ionicons name="diamond-outline" size={16} color="#10B981" />
              </View>
            </View>
            
            <View style={styles.balanceCard}>
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceAmount}>
                  {formatBalance(userData.balance)}
                </Text>
                <Text style={styles.tokenSymbol}>$SYN</Text>
              </View>
              
              <TouchableOpacity style={styles.claimButton} disabled={true}>
                <Ionicons name="lock-closed" size={16} color="#6B7280" />
                <Text style={styles.claimButtonText}>Locked</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Voting Power Section - NEW */}
        {profileStats.totalVotingPowerAcrossDAOs !== "0" && (
          <View style={styles.votingPowerSection}>
            <View style={styles.votingPowerCard}>
              <View style={styles.votingPowerIcon}>
                <MaterialCommunityIcons name="gavel" size={24} color="#8B5CF6" />
              </View>
              <View style={styles.votingPowerInfo}>
                <Text style={styles.votingPowerLabel}>Total Voting Power</Text>
                <Text style={styles.votingPowerValue}>
                  {parseFloat(profileStats.totalVotingPowerAcrossDAOs).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Achievements Section */}
        {renderAchievements()}

        {/* DAO-Specific Stats - NEW */}
        {renderDAOSpecificStats()}

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Activity Stats</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <View style={[styles.statIconBg, { backgroundColor: "#10B98120" }]}>
                <Ionicons name="time-outline" size={20} color="#10B981" />
              </View>
              <Text style={styles.statLabel}>Member For</Text>
              <Text style={styles.statValue}>{getMemberDuration()}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIconBg, { backgroundColor: "#F59E0B20" }]}>
                <Ionicons name="flash-outline" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.statLabel}>Transactions</Text>
              <Text style={styles.statValue}>{profileStats.totalTransactions}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIconBg, { backgroundColor: "#8B5CF620" }]}>
                <MaterialCommunityIcons name="vote" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.statLabel}>Votes Cast</Text>
              <Text style={styles.statValue}>{profileStats.totalVotesCast}</Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <View style={[styles.statIconBg, { backgroundColor: "#EC489920" }]}>
                <Ionicons name="bulb-outline" size={20} color="#EC4899" />
              </View>
              <Text style={styles.statLabel}>Proposals</Text>
              <Text style={styles.statValue}>{profileStats.totalProposalsCreated}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIconBg, { backgroundColor: "#3B82F620" }]}>
                <Ionicons name="people-outline" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.statLabel}>DAOs Joined</Text>
              <Text style={styles.statValue}>{profileStats.daosJoined}</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIconBg, { backgroundColor: "#14B8A620" }]}>
                <MaterialCommunityIcons name="git-branch" size={20} color="#14B8A6" />
              </View>
              <Text style={styles.statLabel}>Delegations</Text>
              <Text style={styles.statValue}>{profileStats.totalDelegations}</Text>
            </View>
          </View>
        </View>

        {/* Grid Section */}
        <View style={styles.gridSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.gridContainer}>
            {gridItems.map(renderGridItem)}
          </View>
        </View>
      </ScrollView>

      {/* Logout Button */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D1117",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: "#9CA3AF",
    fontSize: 16,
    fontWeight: "500",
  },
  syncIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#161B22",
    paddingVertical: 8,
    paddingHorizontal: 16,
    margin: 16,
    borderRadius: 8,
    gap: 8,
  },
  syncText: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "600",
  },
  header: {
    position: "relative",
    paddingBottom: 24,
  },
  headerBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: "#161B22",
    borderBottomWidth: 1,
    borderColor: "#30363D",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    zIndex: 1,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: "#10B981",
  },
  defaultAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#10B981",
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0F0F23",
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 8,
  },
  walletContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "#30363D",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    alignSelf: "flex-start",
  },
  walletAddress: {
    fontSize: 12,
    color: "#ffffffff",
    fontFamily: "monospace",
    fontWeight: "600",
  },
  reputationSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  reputationCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  reputationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  reputationIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  reputationInfo: {
    flex: 1,
  },
  reputationTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "white",
    marginBottom: 4,
  },
  reputationDescription: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  scoreContainer: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "white",
  },
  scoreLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
    marginTop: 2,
  },
  progressSection: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: 12,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "white",
  },
  progressPoints: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "white",
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 11,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
    textAlign: "right",
  },
  airdropSection: {
    padding: 20,
    marginTop: 8,
  },
  airdropHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 2,
  },
  balanceBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#065F46",
    justifyContent: "center",
    alignItems: "center",
  },
  balanceCard: {
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceInfo: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: "#10B981",
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  claimButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#374151",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    opacity: 0.7,
  },
  claimButtonText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "600",
  },
  votingPowerSection: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  votingPowerCard: {
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  votingPowerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#8B5CF620",
    justifyContent: "center",
    alignItems: "center",
  },
  votingPowerInfo: {
    flex: 1,
  },
  votingPowerLabel: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
    marginBottom: 4,
  },
  votingPowerValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#8B5CF6",
  },
  achievementsSection: {
    paddingVertical: 20,
  },
  achievementsScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  achievementCard: {
    width: 140,
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
  },
  daoStatsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  daoStatsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10B981",
  },
  daoStatsList: {
    gap: 12,
  },
  daoStatCard: {
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 16,
    padding: 16,
  },
  daoStatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  daoStatName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
  },
  delegateeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#14B8A620",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  delegateeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#14B8A6",
  },
  daoStatRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  daoStatItem: {
    alignItems: "center",
    gap: 4,
  },
  daoStatValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  daoStatLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  delegatorBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B82F620",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    marginTop: 12,
  },
  delegatorBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3B82F6",
  },
  statsSection: {
    padding: 20,
    paddingTop: 0,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 8,
  },
  statItem: {
    flex: 1,
    backgroundColor: "#161B22",
    borderColor: "#30363D",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    gap: 8,
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  gridSection: {
    padding: 20,
  },
  gridContainer: {
    marginTop: 12,
    gap: 12,
  },
  gridItem: {
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 16,
    overflow: "hidden",
  },
  gridContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  gridTextContainer: {
    flex: 1,
  },
  gridTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  gridDescription: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "400",
  },
  logoutContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1F2937",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    gap: 8,
  },
  logoutText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default UserCenterScreen;