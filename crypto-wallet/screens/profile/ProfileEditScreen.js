import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { updateUserProfile, getUserData } from "../../services/Firebase";
import {
  uploadImageToCloudinary,
  pickImage,
} from "../../services/ImageUploadServices";
import Alert from "../../utils/Alert";

const USERNAME_CHANGE_COOLDOWN_DAYS = 14;

const ProfileEditScreen = ({ navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);
  const { user, checkUsernameAvailability } = useAuth();

  const [formData, setFormData] = useState({
    username: "",
    displayName: "",
    bio: "",
    profileImage: null,
  });

  const [originalData, setOriginalData] = useState({});
  const [localImageUri, setLocalImageUri] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [lastUsernameChange, setLastUsernameChange] = useState(null);
  const [canChangeUsername, setCanChangeUsername] = useState(true);
  const [daysUntilChange, setDaysUntilChange] = useState(0);

  useEffect(() => {
    loadUserData();
  }, [user]);

  const loadUserData = async () => {
    try {
      const userData = await getUserData(user.uid);

      const data = {
        username: userData?.username || user?.username || "",
        displayName: userData?.displayName || user?.displayName || "",
        bio: userData?.bio || "",
        profileImage: userData?.profilePicture || null,
      };

      setFormData(data);
      setOriginalData(data);

      if (userData?.lastUsernameChange) {
        const lastChange = new Date(userData.lastUsernameChange);
        const now = new Date();
        const daysSinceChange = Math.floor(
          (now - lastChange) / (1000 * 60 * 60 * 24),
        );
        const daysRemaining = USERNAME_CHANGE_COOLDOWN_DAYS - daysSinceChange;

        setLastUsernameChange(lastChange);
        setCanChangeUsername(daysSinceChange >= USERNAME_CHANGE_COOLDOWN_DAYS);
        setDaysUntilChange(daysRemaining > 0 ? daysRemaining : 0);
      } else {
        setCanChangeUsername(true);
        setDaysUntilChange(0);
      }
    } catch (error) {
      console.error("[ProfileEdit] Error loading user data:", error);
      Alert.alert("Error", "Failed to load profile data");
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const hasChanges = () => {
    return (
      formData.username !== originalData.username ||
      formData.displayName !== originalData.displayName ||
      formData.bio !== originalData.bio ||
      localImageUri !== null
    );
  };

  const validateForm = async () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.trim().length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username =
        "Username can only contain letters, numbers, and underscores";
    } else if (formData.username !== originalData.username) {
      if (!canChangeUsername) {
        newErrors.username = `You can change your username in ${daysUntilChange} day${daysUntilChange !== 1 ? "s" : ""}`;
      } else {
        setCheckingUsername(true);
        try {
          const isAvailable = await checkUsernameAvailability(
            formData.username.toLowerCase(),
          );
          if (!isAvailable) {
            newErrors.username = "Username is already taken";
          }
        } catch (error) {
          newErrors.username = "Could not verify username availability";
        } finally {
          setCheckingUsername(false);
        }
      }
    }

    if (!formData.displayName.trim()) {
      newErrors.displayName = "Display name is required";
    } else if (formData.displayName.trim().length < 2) {
      newErrors.displayName = "Display name must be at least 2 characters";
    }

    if (formData.bio && formData.bio.length > 150) {
      newErrors.bio = "Bio must be 150 characters or less";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Image picking — delegates to imageUploadService ──────────────────────
  const handlePickImage = async (useCamera = false) => {
    try {
      if (useCamera) {
        // Camera flow — imageUploadService handles gallery; use ImagePicker directly for camera
        const { status } = await import("expo-image-picker").then((m) =>
          m.requestCameraPermissionsAsync(),
        );
        if (status !== "granted") {
          Alert.alert("Permission needed", "Please allow camera access");
          return;
        }
        const { launchCameraAsync } = await import("expo-image-picker");
        const result = await launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (!result.canceled) {
          setLocalImageUri(result.assets[0].uri);
        }
      } else {
        // Gallery flow — use imageUploadService.pickImage
        const asset = await pickImage();
        if (asset) {
          setLocalImageUri(asset.uri);
        }
      }
    } catch (error) {
      console.error("[ProfileEdit] Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const showImageOptions = () => {
    Alert.alert("Profile Photo", "Choose an option", [
      { text: "Take Photo", onPress: () => handlePickImage(true) },
      { text: "Choose from Gallery", onPress: () => handlePickImage(false) },
      ...(formData.profileImage || localImageUri
        ? [
            {
              text: "Remove Photo",
              onPress: () => {
                setLocalImageUri(null);
                setFormData((prev) => ({ ...prev, profileImage: null }));
              },
              style: "destructive",
            },
          ]
        : []),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      Alert.alert(
        "No Changes",
        "You haven't made any changes to your profile.",
      );
      return;
    }

    const isValid = await validateForm();
    if (!isValid) return;

    if (formData.username !== originalData.username && canChangeUsername) {
      Alert.alert(
        "Change Username?",
        `Are you sure you want to change your username from "${originalData.username}" to "${formData.username}"?\n\nYou won't be able to change it again for ${USERNAME_CHANGE_COOLDOWN_DAYS} days.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Change Username",
            onPress: saveProfile,
            style: "destructive",
          },
        ],
      );
    } else {
      await saveProfile();
    }
  };

  const saveProfile = async () => {
    try {
      setLoading(true);
      let profilePicture = formData.profileImage;

      // Upload new image via Cloudinary if user selected one
      if (localImageUri) {
        setUploadingImage(true);
        try {
          console.log("[ProfileEdit] Uploading profile image to Cloudinary...");
          const result = await uploadImageToCloudinary(
            localImageUri,
            "profile-images", // Cloudinary folder
            {
              publicId: `profile_${user.uid}`, // deterministic ID — overwrites previous
              tags: ["profile", user.uid],
              transformation: "w_400,h_400,c_fill,q_auto,f_auto", // eager thumb
            },
          );
          profilePicture = result.url;
          console.log(
            "[ProfileEdit] Image uploaded successfully:",
            profilePicture,
          );
        } catch (imgError) {
          console.error("[ProfileEdit] Image upload failed:", imgError);
          Alert.alert(
            "Image Upload Failed",
            "Failed to upload profile image. Do you want to save other changes without it?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Continue",
                onPress: () => updateProfile(formData.profileImage),
              },
            ],
          );
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      await updateProfile(profilePicture);
    } catch (error) {
      console.error("[ProfileEdit] Save error:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profilePicture) => {
    try {
      const profileData = {
        displayName: formData.displayName.trim(),
        bio: formData.bio.trim(),
        profilePicture: profilePicture || null,
      };

      if (formData.username !== originalData.username) {
        profileData.username = formData.username.toLowerCase();
        profileData.lastUsernameChange = new Date().toISOString();
      }

      console.log("[ProfileEdit] Updating profile data:", profileData);
      await updateUserProfile(user.uid, profileData);

      Alert.alert(
        "Success! 🎉",
        "Your profile has been updated successfully.",
        [
          {
            text: "OK",
            onPress: () => {
              loadUserData();
              setLocalImageUri(null);
            },
          },
        ],
      );
    } catch (error) {
      console.error("[ProfileEdit] Error updating profile:", error);
      throw error;
    }
  };

  const handleCancel = () => {
    if (hasChanges()) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to discard them?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } else {
      navigation.goBack();
    }
  };

  const displayImage = localImageUri || formData.profileImage;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
            <Ionicons name="close" size={28} color={theme.COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Profile</Text>
          <Text style={styles.subtitle}>Update your information</Text>
        </View>

        {/* Profile Image */}
        <View style={styles.imageSection}>
          <TouchableOpacity
            style={styles.imageContainer}
            onPress={showImageOptions}
            activeOpacity={0.8}
          >
            {displayImage ? (
              <>
                <Image
                  source={{ uri: displayImage }}
                  style={styles.profileImage}
                />
                <View style={styles.imageOverlay}>
                  <Ionicons name="camera" size={28} color="#FFFFFF" />
                </View>
              </>
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons
                  name="person"
                  size={60}
                  color={theme.COLORS.textSecondary}
                />
                <Text style={styles.placeholderText}>Add Photo</Text>
              </View>
            )}
            {uploadingImage && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color={theme.COLORS.primary} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.changePhotoButton}
            onPress={showImageOptions}
          >
            <Ionicons
              name="camera-outline"
              size={16}
              color={theme.COLORS.primary}
              style={styles.changePhotoIcon}
            />
            <Text style={styles.changePhotoText}>
              {displayImage ? "Change Photo" : "Add Photo"}
            </Text>
          </TouchableOpacity>

          {localImageUri && (
            <View style={styles.changedBadge}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={theme.COLORS.success}
              />
              <Text style={styles.changedBadgeText}>Photo will be updated</Text>
            </View>
          )}
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View>
            <Input
              label="Username"
              value={formData.username}
              onChangeText={(text) =>
                updateField("username", text.toLowerCase())
              }
              placeholder="Choose a unique username"
              autoCapitalize="none"
              error={errors.username}
              editable={canChangeUsername}
              leftIcon={
                <Ionicons
                  name="at"
                  size={20}
                  color={theme.COLORS.textSecondary}
                />
              }
              rightIcon={
                checkingUsername ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.COLORS.primary}
                  />
                ) : !canChangeUsername ? (
                  <Ionicons
                    name="lock-closed"
                    size={20}
                    color={theme.COLORS.warning}
                  />
                ) : null
              }
            />
            {!canChangeUsername && (
              <View style={styles.cooldownBox}>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={theme.COLORS.warning}
                />
                <Text style={styles.cooldownText}>
                  Username can be changed in {daysUntilChange} day
                  {daysUntilChange !== 1 ? "s" : ""}
                </Text>
              </View>
            )}
            {formData.username !== originalData.username &&
              canChangeUsername && (
                <View style={styles.warningBox}>
                  <Ionicons
                    name="warning-outline"
                    size={18}
                    color={theme.COLORS.warning}
                  />
                  <Text style={styles.warningText}>
                    Changing username will lock it for{" "}
                    {USERNAME_CHANGE_COOLDOWN_DAYS} days
                  </Text>
                </View>
              )}
          </View>

          <Input
            label="Display Name"
            value={formData.displayName}
            onChangeText={(text) => updateField("displayName", text)}
            placeholder="Your full name"
            error={errors.displayName}
            leftIcon={
              <Ionicons
                name="person-outline"
                size={20}
                color={theme.COLORS.textSecondary}
              />
            }
          />

          <Input
            label="Bio (Optional)"
            value={formData.bio}
            onChangeText={(text) => updateField("bio", text)}
            placeholder="Tell us about yourself"
            multiline
            numberOfLines={4}
            error={errors.bio}
            maxLength={150}
            leftIcon={
              <Ionicons
                name="create-outline"
                size={20}
                color={theme.COLORS.textSecondary}
                style={styles.bioIcon}
              />
            }
          />

          {formData.bio ? (
            <View style={styles.charCountContainer}>
              <Text style={styles.charCount}>
                {formData.bio.length}/150 characters
              </Text>
            </View>
          ) : null}

          {originalData.username && (
            <View style={styles.previousDataBox}>
              <Text style={styles.previousDataTitle}>Current Information</Text>
              <View style={styles.previousDataRow}>
                <Text style={styles.previousDataLabel}>Username:</Text>
                <Text style={styles.previousDataValue}>
                  @{originalData.username}
                </Text>
              </View>
              <View style={styles.previousDataRow}>
                <Text style={styles.previousDataLabel}>Display Name:</Text>
                <Text style={styles.previousDataValue}>
                  {originalData.displayName}
                </Text>
              </View>
              {originalData.bio ? (
                <View style={styles.previousDataRow}>
                  <Text style={styles.previousDataLabel}>Bio:</Text>
                  <Text style={styles.previousDataValue}>
                    {originalData.bio}
                  </Text>
                </View>
              ) : null}
              {lastUsernameChange ? (
                <View style={styles.previousDataRow}>
                  <Text style={styles.previousDataLabel}>
                    Last username change:
                  </Text>
                  <Text style={styles.previousDataValue}>
                    {new Date(lastUsernameChange).toLocaleDateString()}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          <View style={styles.infoBox}>
            <Ionicons
              name="information-circle"
              size={20}
              color={theme.COLORS.info || theme.COLORS.primary}
            />
            <Text style={styles.infoText}>
              • Display name can be changed anytime{"\n"}• Username can only be
              changed every {USERNAME_CHANGE_COOLDOWN_DAYS} days{"\n"}• Bio is
              optional (max 150 characters)
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title={uploadingImage ? "Uploading..." : "Save Changes"}
            onPress={handleSave}
            loading={loading || checkingUsername}
            disabled={uploadingImage || !hasChanges()}
            fullWidth
            style={styles.saveButton}
          />
          <Button
            title="Cancel"
            onPress={handleCancel}
            variant="outline"
            fullWidth
            style={styles.cancelButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
    },
    scrollContent: {
      flexGrow: 1,
      padding: theme.SPACING.xl,
    },
    header: {
      alignItems: "center",
      marginBottom: theme.SPACING.xxl,
      marginTop: theme.SPACING.lg,
    },
    closeButton: {
      position: "absolute",
      top: 0,
      right: 0,
      padding: theme.SPACING.xs,
      zIndex: 1,
    },
    title: {
      fontSize: theme.FONTS.sizes.xxl,
      fontWeight: "bold",
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.xs,
      textAlign: "center",
    },
    subtitle: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      textAlign: "center",
    },
    imageSection: {
      alignItems: "center",
      marginBottom: theme.SPACING.xxl,
    },
    imageContainer: {
      width: 140,
      height: 140,
      borderRadius: 70,
      marginBottom: theme.SPACING.md,
      overflow: "hidden",
    },
    profileImage: {
      width: "100%",
      height: "100%",
      borderRadius: 70,
    },
    imageOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      paddingVertical: theme.SPACING.sm,
      justifyContent: "center",
      alignItems: "center",
    },
    placeholderImage: {
      width: "100%",
      height: "100%",
      backgroundColor: theme.COLORS.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: theme.COLORS.border,
      borderStyle: "dashed",
      borderRadius: 70,
    },
    placeholderText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      marginTop: theme.SPACING.xs,
      fontWeight: "600",
    },
    uploadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.isDark
        ? "rgba(0,0,0,0.8)"
        : "rgba(255,255,255,0.9)",
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 70,
    },
    changePhotoButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.SPACING.sm,
      paddingHorizontal: theme.SPACING.md,
      backgroundColor: theme.COLORS.primaryLight,
      borderRadius: 20,
    },
    changePhotoIcon: {
      marginRight: theme.SPACING.xs,
    },
    changePhotoText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.primary,
      fontWeight: "600",
    },
    changedBadge: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: theme.SPACING.sm,
      backgroundColor: `${theme.COLORS.success}15`,
      paddingVertical: theme.SPACING.xs,
      paddingHorizontal: theme.SPACING.sm,
      borderRadius: 12,
    },
    changedBadgeText: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.success,
      marginLeft: theme.SPACING.xs,
      fontWeight: "600",
    },
    form: {
      marginBottom: theme.SPACING.xl,
    },
    bioIcon: {
      alignSelf: "flex-start",
      marginTop: theme.SPACING.sm,
    },
    charCountContainer: {
      alignItems: "flex-end",
      marginTop: -theme.SPACING.sm,
      marginBottom: theme.SPACING.md,
    },
    charCount: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textTertiary,
    },
    cooldownBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${theme.COLORS.warning}15`,
      padding: theme.SPACING.sm,
      borderRadius: 8,
      marginTop: -theme.SPACING.sm,
      marginBottom: theme.SPACING.md,
    },
    cooldownText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.warning,
      marginLeft: theme.SPACING.xs,
      fontWeight: "600",
    },
    warningBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${theme.COLORS.warning}15`,
      padding: theme.SPACING.sm,
      borderRadius: 8,
      marginTop: -theme.SPACING.sm,
      marginBottom: theme.SPACING.md,
    },
    warningText: {
      flex: 1,
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.warning,
      marginLeft: theme.SPACING.xs,
    },
    previousDataBox: {
      backgroundColor: theme.COLORS.surface,
      padding: theme.SPACING.md,
      borderRadius: 12,
      marginTop: theme.SPACING.md,
      marginBottom: theme.SPACING.md,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    previousDataTitle: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: "bold",
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.sm,
    },
    previousDataRow: {
      flexDirection: "row",
      marginBottom: theme.SPACING.xs,
    },
    previousDataLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      width: 140,
    },
    previousDataValue: {
      flex: 1,
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
      fontWeight: "500",
    },
    infoBox: {
      flexDirection: "row",
      backgroundColor: theme.COLORS.primaryLight,
      padding: theme.SPACING.md,
      borderRadius: 12,
      alignItems: "flex-start",
      marginTop: theme.SPACING.md,
    },
    infoText: {
      flex: 1,
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
      marginLeft: theme.SPACING.sm,
      lineHeight: 20,
    },
    actions: {
      gap: theme.SPACING.md,
      marginTop: "auto",
    },
    saveButton: {
      marginTop: theme.SPACING.md,
    },
    cancelButton: {
      marginTop: theme.SPACING.xs,
    },
  });

export default ProfileEditScreen;
