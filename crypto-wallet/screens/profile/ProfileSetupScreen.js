// screens/profile/ProfileSetupScreen.js
//
// Same functionality as before — image picking/upload, validation, save
// flow — restyled to feel like profile setup in a social app rather than a
// generic form screen. Two additions beyond styling:
//   1. Live username availability check on blur (checkmark/x), instead of
//      only surfacing on submit. Falls back gracefully — if it fails, no
//      indicator shows and the submit-time check (unchanged) still catches it.
//   2. A live preview card showing exactly how the avatar/name/bio will
//      render, so people aren't guessing.
//
// TODO: this assumes components/common/Input forwards unrecognized props
// (like onBlur) to the underlying TextInput — check that's true; if Input
// doesn't pass onBlur through, the live-check call just won't fire and
// everything else on this screen still works as before.

import React, { useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { updateUserProfile } from "../../services/Firebase";
import {
  uploadImageToCloudinary,
  pickImage,
} from "../../services/ImageUploadServices";
import Alert from "../../utils/Alert";

const ProfileSetupScreen = ({ navigation, route }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const { user, checkUsernameAvailability } = useAuth();
  const { isRequired = false } = route.params || {};

  const [formData, setFormData] = useState({
    username: user?.username || "",
    displayName: user?.displayName || "",
    bio: user?.bio || "",
    profileImage: user?.profilePicture || null,
  });

  const [localImageUri, setLocalImageUri] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  // null = not yet checked, true = available, false = taken/invalid
  const [usernameAvailable, setUsernameAvailable] = useState(null);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
    if (field === "username") setUsernameAvailable(null);
  };

  // Live check on blur — same rules as the submit-time check, just surfaced
  // earlier so people don't fill out the whole form before finding out the
  // name's taken.
  const handleUsernameBlur = async () => {
    const value = formData.username.trim();
    if (
      !value ||
      value.length < 3 ||
      !/^[a-zA-Z0-9_]+$/.test(value) ||
      value === user?.username
    ) {
      return;
    }
    try {
      setCheckingUsername(true);
      const isAvailable = await checkUsernameAvailability(value.toLowerCase());
      setUsernameAvailable(isAvailable);
      if (!isAvailable) {
        setErrors((prev) => ({ ...prev, username: "Username is already taken" }));
      }
    } catch {
      // Silent — submit-time validateForm() re-checks and surfaces this properly.
    } finally {
      setCheckingUsername(false);
    }
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
    } else if (formData.username !== user?.username) {
      setCheckingUsername(true);
      try {
        const isAvailable = await checkUsernameAvailability(
          formData.username.toLowerCase(),
        );
        setUsernameAvailable(isAvailable);
        if (!isAvailable) {
          newErrors.username = "Username is already taken";
        }
      } catch (error) {
        newErrors.username = "Could not verify username availability";
      } finally {
        setCheckingUsername(false);
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
        const { requestCameraPermissionsAsync, launchCameraAsync } =
          await import("expo-image-picker");
        const { status } = await requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Please allow camera access");
          return;
        }
        const result = await launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (!result.canceled) {
          setLocalImageUri(result.assets[0].uri);
        }
      } else {
        const asset = await pickImage();
        if (asset) {
          setLocalImageUri(asset.uri);
        }
      }
    } catch (error) {
      console.error("[ProfileSetup] Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const showImageOptions = () => {
    Alert.alert("Profile Photo", "Choose an option", [
      { text: "Take Photo", onPress: () => handlePickImage(true) },
      { text: "Choose from Gallery", onPress: () => handlePickImage(false) },
      {
        text: "Remove Photo",
        onPress: () => {
          setLocalImageUri(null);
          setFormData((prev) => ({ ...prev, profileImage: null }));
        },
        style: "destructive",
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    const isValid = await validateForm();
    if (!isValid) return;

    try {
      setLoading(true);
      let profilePicture = formData.profileImage;

      if (localImageUri) {
        setUploadingImage(true);
        try {
          console.log(
            "[ProfileSetup] Uploading profile image to Cloudinary...",
          );
          const result = await uploadImageToCloudinary(
            localImageUri,
            "profile-images",
            {
              publicId: `profile_${user.uid}`,
              tags: ["profile", user.uid],
              transformation: "w_400,h_400,c_fill,q_auto,f_auto",
            },
          );
          profilePicture = result.url;
          console.log(
            "[ProfileSetup] Image uploaded successfully:",
            profilePicture,
          );
        } catch (imgError) {
          console.error("[ProfileSetup] Image upload failed:", imgError);
          Alert.alert(
            "Image Upload Failed",
            "Failed to upload profile image, but we can continue without it. Do you want to proceed?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Continue",
                onPress: () => saveProfile(formData.profileImage),
              },
            ],
          );
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      await saveProfile(profilePicture);
    } catch (error) {
      console.error("[ProfileSetup] Save error:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (profilePicture) => {
    try {
      const profileData = {
        username: formData.username.toLowerCase(),
        displayName: formData.displayName.trim(),
        bio: formData.bio.trim(),
        profilePicture: profilePicture || null,
      };

      console.log("[ProfileSetup] Saving profile data:", profileData);
      await updateUserProfile(user.uid, profileData);

      Alert.alert(
        "Success! 🎉",
        "Your profile has been updated successfully.",
        [
          {
            text: "OK",
            onPress: () => {
              if (isRequired) {
                console.log(
                  "[ProfileSetup] Profile complete, proceeding to next step...",
                );
              } else {
                navigation.goBack();
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error("[ProfileSetup] Error saving profile:", error);
      throw error;
    }
  };

  const handleSkip = () => {
    if (isRequired) {
      Alert.alert(
        "Profile Required",
        "You need to set up your profile to continue.",
        [{ text: "OK" }],
      );
    } else {
      navigation.goBack();
    }
  };

  const displayImage = localImageUri || formData.profileImage;

  // Username field's right-side indicator: spinner while checking, a
  // checkmark once confirmed available, nothing otherwise (errors already
  // render below the field via the existing Input error prop).
  const usernameRightIcon = checkingUsername ? (
    <ActivityIndicator size="small" color={theme.COLORS.primary} />
  ) : usernameAvailable === true ? (
    <Ionicons name="checkmark-circle" size={20} color={theme.COLORS.success || "#22C55E"} />
  ) : null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <LinearGradient
          colors={[theme.COLORS.primary + "22", theme.COLORS.primary + "00"]}
          style={styles.headerGradient}
        >
          {!isRequired && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="close" size={24} color={theme.COLORS.text} />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>
            {isRequired ? "Welcome — let's set you up" : "Edit your profile"}
          </Text>
          <Text style={styles.subtitle}>
            {isRequired
              ? "This is how people will find and recognize you"
              : "Update your photo, name, and bio"}
          </Text>
        </LinearGradient>

        {/* ── Avatar ── */}
        <View style={styles.imageSection}>
          <TouchableOpacity
            onPress={showImageOptions}
            activeOpacity={0.85}
            style={styles.avatarWrap}
          >
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="person" size={48} color={theme.COLORS.textSecondary} />
              </View>
            )}
            {uploadingImage && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color={theme.COLORS.primary} />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={showImageOptions} activeOpacity={0.7}>
            <Text style={styles.changePhotoText}>
              {displayImage ? "Change photo" : "Add a photo"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Form card ── */}
        <View style={styles.formCard}>
          <Input
            label="Username"
            value={formData.username}
            onChangeText={(text) => updateField("username", text.toLowerCase())}
            onBlur={handleUsernameBlur}
            placeholder="Choose a unique username"
            autoCapitalize="none"
            error={errors.username}
            leftIcon={<Ionicons name="at" size={20} color={theme.COLORS.textSecondary} />}
            rightIcon={usernameRightIcon}
          />

          <Input
            label="Display name"
            value={formData.displayName}
            onChangeText={(text) => updateField("displayName", text)}
            placeholder="Your full name"
            error={errors.displayName}
            leftIcon={<Ionicons name="person-outline" size={20} color={theme.COLORS.textSecondary} />}
          />

          <View>
            <Input
              label="Bio"
              value={formData.bio}
              onChangeText={(text) => updateField("bio", text)}
              placeholder="Tell people a little about yourself"
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
              <View style={styles.charCountPill}>
                <Text style={styles.charCountText}>{formData.bio.length}/150</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Live preview ── */}
        <Text style={styles.previewLabel}>Preview</Text>
        <View style={styles.previewCard}>
          <View style={styles.previewAvatarWrap}>
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={styles.previewAvatar} />
            ) : (
              <View style={[styles.previewAvatar, styles.previewAvatarPlaceholder]}>
                <Ionicons name="person" size={20} color={theme.COLORS.textSecondary} />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewName} numberOfLines={1}>
              {formData.displayName || "Your name"}
            </Text>
            <Text style={styles.previewUsername} numberOfLines={1}>
              @{formData.username || "username"}
            </Text>
            {!!formData.bio && (
              <Text style={styles.previewBio} numberOfLines={2}>{formData.bio}</Text>
            )}
          </View>
        </View>

        {/* ── Info note ── */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color={theme.COLORS.primary} />
          <Text style={styles.infoText}>
            Usernames can only contain letters, numbers, and underscores, and must be unique.
          </Text>
        </View>

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <Button
            title={uploadingImage ? "Uploading..." : "Save profile"}
            onPress={handleSave}
            loading={loading || checkingUsername}
            disabled={uploadingImage}
            fullWidth
            style={styles.saveButton}
          />
          {!isRequired && (
            <Button
              title="Cancel"
              onPress={handleSkip}
              variant="outline"
              fullWidth
              style={styles.cancelButton}
            />
          )}
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
      paddingBottom: theme.SPACING.xl,
    },

    headerGradient: {
      alignItems: "center",
      paddingTop: theme.SPACING.xxl,
      paddingBottom: theme.SPACING.lg,
      paddingHorizontal: theme.SPACING.xl,
    },
    closeButton: {
      position: "absolute",
      top: theme.SPACING.lg,
      right: theme.SPACING.lg,
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: theme.COLORS.surface,
      justifyContent: "center", alignItems: "center",
      zIndex: 1,
    },
    title: {
      fontSize: theme.FONTS.sizes.xxl,
      fontWeight: "800",
      color: theme.COLORS.text,
      marginBottom: 4,
      textAlign: "center",
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      textAlign: "center",
    },

    imageSection: {
      alignItems: "center",
      marginTop: -theme.SPACING.md,
      marginBottom: theme.SPACING.xl,
      gap: 8,
    },
    avatarWrap: {
      width: 108, height: 108, borderRadius: 54,
      borderWidth: 3, borderColor: theme.COLORS.background,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
    },
    profileImage: { width: "100%", height: "100%", borderRadius: 54 },
    placeholderImage: {
      width: "100%", height: "100%", borderRadius: 54,
      backgroundColor: theme.COLORS.surface,
      justifyContent: "center", alignItems: "center",
      borderWidth: 2, borderColor: theme.COLORS.border, borderStyle: "dashed",
    },
    uploadingOverlay: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: theme.isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)",
      justifyContent: "center", alignItems: "center", borderRadius: 54,
    },
    cameraBadge: {
      position: "absolute", bottom: 0, right: 0,
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: theme.COLORS.primary,
      borderWidth: 2, borderColor: theme.COLORS.background,
      justifyContent: "center", alignItems: "center",
    },
    changePhotoText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.primary,
      fontWeight: "700",
    },

    formCard: {
      marginHorizontal: theme.SPACING.xl,
      backgroundColor: theme.COLORS.surface,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.COLORS.border,
      padding: theme.SPACING.md,
      gap: theme.SPACING.sm,
      marginBottom: theme.SPACING.lg,
    },
    bioIcon: { alignSelf: "flex-start", marginTop: theme.SPACING.sm },
    charCountPill: {
      position: "absolute", right: theme.SPACING.sm, bottom: theme.SPACING.sm,
      backgroundColor: theme.COLORS.background,
      borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
    },
    charCountText: { fontSize: 10, fontWeight: "600", color: theme.COLORS.textTertiary },

    previewLabel: {
      fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase",
      color: theme.COLORS.textTertiary,
      marginHorizontal: theme.SPACING.xl + 4, marginBottom: 8,
    },
    previewCard: {
      flexDirection: "row", gap: 12, alignItems: "flex-start",
      marginHorizontal: theme.SPACING.xl,
      backgroundColor: theme.COLORS.primary + "0c",
      borderRadius: 16, borderWidth: 1, borderColor: theme.COLORS.primary + "22",
      padding: theme.SPACING.md,
      marginBottom: theme.SPACING.lg,
    },
    previewAvatarWrap: { width: 44, height: 44 },
    previewAvatar: { width: 44, height: 44, borderRadius: 22 },
    previewAvatarPlaceholder: {
      backgroundColor: theme.COLORS.surface,
      justifyContent: "center", alignItems: "center",
      borderWidth: 1, borderColor: theme.COLORS.border,
    },
    previewName: { fontSize: theme.FONTS.sizes.md, fontWeight: "700", color: theme.COLORS.text },
    previewUsername: { fontSize: theme.FONTS.sizes.sm, color: theme.COLORS.textSecondary, marginTop: 1 },
    previewBio: { fontSize: theme.FONTS.sizes.sm, color: theme.COLORS.textTertiary, marginTop: 4, lineHeight: 18 },

    infoBox: {
      flexDirection: "row", gap: 8, alignItems: "flex-start",
      marginHorizontal: theme.SPACING.xl,
      backgroundColor: theme.COLORS.surface,
      padding: theme.SPACING.md,
      borderRadius: 14,
      marginBottom: theme.SPACING.xl,
    },
    infoText: {
      flex: 1,
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      lineHeight: 19,
    },

    actions: {
      gap: theme.SPACING.sm,
      marginHorizontal: theme.SPACING.xl,
    },
    saveButton: {},
    cancelButton: {},
  });

export default ProfileSetupScreen;