import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { isValidEmail, validatePasswordStrength } from "../../utils/Validators";
import { useTheme } from "../../contexts/ThemeContext";
import Alert from "../../utils/Alert";

const RADIUS = { md: 8, lg: 12, xl: 16, xxl: 28 };

const STAGE_META = {
  1: { eyebrow: "STEP 1 OF 3", title: "Let's get\nstarted", label: "What's your email?" },
  2: { eyebrow: "STEP 2 OF 3", title: "Secure your\naccount", label: "Create a password" },
  3: { eyebrow: "STEP 3 OF 3", title: "Make it\nyours", label: "Set up your profile" },
};

// ==================== Custom Hooks ====================

const useFormValidation = () => {
  const validateEmail = useCallback((email) => {
    if (!email.trim()) return "Email is required";
    if (!isValidEmail(email)) return "Invalid email format";
    return null;
  }, []);

  const validatePassword = useCallback((password, confirmPassword) => {
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return { password: passwordValidation.errors[0] };
    }
    if (password !== confirmPassword) {
      return { confirmPassword: "Passwords do not match" };
    }
    return {};
  }, []);

  const validateUsername = useCallback((username) => {
    if (!username.trim()) return "Username is required";
    if (username.trim().length < 3)
      return "Username must be at least 3 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return "Username can only contain letters, numbers, and underscores";
    }
    return null;
  }, []);

  const validateDisplayName = useCallback((displayName) => {
    if (!displayName.trim()) return "Display name is required";
    if (displayName.trim().length < 2)
      return "Display name must be at least 2 characters";
    return null;
  }, []);

  const validateBio = useCallback((bio) => {
    if (bio && bio.length > 150) return "Bio must be 150 characters or less";
    return null;
  }, []);

  return {
    validateEmail,
    validatePassword,
    validateUsername,
    validateDisplayName,
    validateBio,
  };
};

// ==================== Subcomponents ====================

const ProgressIndicator = React.memo(({ stage, styles }) => (
  <View style={styles.progressContainer}>
    <View style={[styles.progressDot, stage >= 1 && styles.progressDotActive]} />
    <View style={[styles.progressLine, stage >= 2 && styles.progressLineActive]} />
    <View style={[styles.progressDot, stage >= 2 && styles.progressDotActive]} />
    <View style={[styles.progressLine, stage >= 3 && styles.progressLineActive]} />
    <View style={[styles.progressDot, stage >= 3 && styles.progressDotActive]} />
  </View>
));

const PasswordStrengthIndicator = React.memo(
  ({ password, strength, getColor, styles }) => {
    if (!password || !strength) return null;
    return (
      <View style={styles.strengthContainer}>
        <Text style={styles.strengthLabel}>Password Strength: </Text>
        <Text style={[styles.strengthText, { color: getColor() }]}>
          {strength.toUpperCase()}
        </Text>
      </View>
    );
  }
);

const ProfileImagePicker = React.memo(({ imageUri, onPress, styles, colors }) => (
  <View style={styles.imageContainer}>
    <TouchableOpacity onPress={onPress} style={styles.imagePicker} activeOpacity={0.8}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.profileImage} />
      ) : (
        <View style={styles.placeholderImage}>
          <Ionicons name="camera-outline" size={26} color={colors.textSecondary} />
        </View>
      )}
    </TouchableOpacity>
    <Text style={styles.imageLabel}>Profile Photo (Optional)</Text>
  </View>
));

const EmailStage = React.memo(
  ({ formData, errors, onUpdateField, onNext, styles, colors }) => (
    <View>
      <Input
        label="Email"
        value={formData.email}
        onChangeText={(text) => onUpdateField("email", text)}
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoFocus
        error={errors.email}
        leftIcon={<Ionicons name="mail-outline" size={20} color={colors.textSecondary} />}
      />
      <Button
        title="Continue"
        onPress={onNext}
        fullWidth
        style={styles.actionButton}
      />
    </View>
  )
);

const PasswordStage = React.memo(
  ({
    formData,
    errors,
    passwordStrength,
    onUpdateField,
    onNext,
    onBack,
    getPasswordStrengthColor,
    styles,
    colors,
  }) => (
    <View>
      <View style={styles.inputGap}>
        <Input
          label="Password"
          value={formData.password}
          onChangeText={(text) => onUpdateField("password", text)}
          placeholder="Create a password"
          secureTextEntry
          autoFocus
          error={errors.password}
          leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />}
        />
      </View>

      <PasswordStrengthIndicator
        password={formData.password}
        strength={passwordStrength}
        getColor={getPasswordStrengthColor}
        styles={styles}
      />

      <View style={styles.inputGap}>
        <Input
          label="Confirm Password"
          value={formData.confirmPassword}
          onChangeText={(text) => onUpdateField("confirmPassword", text)}
          placeholder="Confirm your password"
          secureTextEntry
          error={errors.confirmPassword}
          leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />}
        />
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          This password will be used to encrypt your wallet in the cloud. You'll
          set up a simpler PIN for quick access on this device.
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <Button title="Back" onPress={onBack} variant="secondary" style={styles.backButton} />
        <Button title="Continue" onPress={onNext} style={styles.continueButton} />
      </View>
    </View>
  )
);

const ProfileStage = React.memo(
  ({
    formData,
    errors,
    checkingUsername,
    loading,
    onUpdateField,
    onPickImage,
    onRegister,
    onBack,
    styles,
    colors,
  }) => (
    <View>
      <ProfileImagePicker
        imageUri={formData.profileImage}
        onPress={onPickImage}
        styles={styles}
        colors={colors}
      />

      <View style={styles.inputGap}>
        <Input
          label="Username"
          value={formData.username}
          onChangeText={(text) => onUpdateField("username", text.toLowerCase())}
          placeholder="Choose a unique username"
          autoCapitalize="none"
          autoFocus
          error={errors.username}
          leftIcon={<Ionicons name="at-outline" size={20} color={colors.textSecondary} />}
          rightIcon={checkingUsername ? "⏳" : null}
        />
      </View>

      <View style={styles.inputGap}>
        <Input
          label="Display Name"
          value={formData.displayName}
          onChangeText={(text) => onUpdateField("displayName", text)}
          placeholder="Your full name"
          error={errors.displayName}
          leftIcon={<Ionicons name="person-outline" size={20} color={colors.textSecondary} />}
        />
      </View>

      <Input
        label="Bio (Optional)"
        value={formData.bio}
        onChangeText={(text) => onUpdateField("bio", text)}
        placeholder="Tell us about yourself"
        multiline
        numberOfLines={3}
        error={errors.bio}
        maxLength={150}
      />

      {formData.bio && (
        <Text style={styles.charCount}>{formData.bio.length}/150</Text>
      )}

      <View style={styles.buttonRow}>
        <Button title="Back" onPress={onBack} variant="secondary" style={styles.backButton} />
        <Button
          title="Create Account"
          onPress={onRegister}
          loading={loading || checkingUsername}
          style={styles.continueButton}
        />
      </View>
    </View>
  )
);

// ==================== Main Component ====================

const RegisterScreen = ({ navigation }) => {
  const { register, loading, checkUsernameAvailability } = useAuth();
  const { COLORS, SPACING, FONTS } = useTheme();
  const insets = useSafeAreaInsets();
  const validation = useFormValidation();

  const [stage, setStage] = useState(1);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    displayName: "",
    bio: "",
    profileImage: null,
  });
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: COLORS.primary },

        // ── Top hero block ──
        hero: {
          paddingTop: insets.top + SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
        },
        heroEyebrow: {
          fontSize: FONTS.sizes.xs,
          fontWeight: "800",
          letterSpacing: 1.5,
          // container's bg is COLORS.primary — was COLORS.background (a
          // "light bg needs light text" assumption that predates the lime accent)
          color: `${COLORS.onPrimary}99`,
          marginBottom: SPACING.sm,
        },
        heroTitle: {
          fontSize: 34,
          fontWeight: "900",
          letterSpacing: -1,
          color: COLORS.onPrimary,
          lineHeight: 38,
        },

        // ── Sheet ──
        sheetWrap: { flex: 1 },
        sheet: {
          flex: 1,
          backgroundColor: COLORS.background,
          borderTopLeftRadius: RADIUS.xxl,
          borderTopRightRadius: RADIUS.xxl,
        },
        sheetContent: {
          padding: SPACING.lg,
          paddingBottom: insets.bottom + SPACING.xl,
        },
        sheetHandle: {
          alignSelf: "center",
          width: 40, height: 4, borderRadius: 2,
          backgroundColor: COLORS.border,
          marginTop: SPACING.sm,
          marginBottom: SPACING.lg,
        },
        formLabel: {
          fontSize: FONTS.sizes.lg,
          fontWeight: "800",
          color: COLORS.text,
          marginBottom: SPACING.lg,
          letterSpacing: -0.3,
        },
        inputGap: { marginBottom: SPACING.md },

        // ── Progress ──
        progressContainer: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: SPACING.lg,
        },
        progressDot: {
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: COLORS.border,
        },
        progressDotActive: {
          backgroundColor: COLORS.primary,
          width: 9, height: 9, borderRadius: 5,
        },
        progressLine: {
          flex: 1,
          height: 2,
          backgroundColor: COLORS.border,
          marginHorizontal: 6,
        },
        progressLineActive: { backgroundColor: COLORS.primary },

        strengthContainer: {
          flexDirection: "row",
          alignItems: "center",
          marginTop: -SPACING.sm,
          marginBottom: SPACING.md,
        },
        strengthLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
        strengthText: { fontSize: FONTS.sizes.sm, fontWeight: "bold" },

        infoBox: {
          flexDirection: "row",
          backgroundColor: COLORS.primaryLight,
          padding: SPACING.md,
          borderRadius: RADIUS.lg,
          marginBottom: SPACING.md,
          alignItems: "flex-start",
          gap: SPACING.sm,
        },
        infoText: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.text, lineHeight: 20 },

        imageContainer: { alignItems: "center", marginBottom: SPACING.lg },
        imagePicker: { marginBottom: SPACING.sm },
        profileImage: { width: 88, height: 88, borderRadius: 44 },
        placeholderImage: {
          width: 88, height: 88, borderRadius: 44,
          backgroundColor: COLORS.surface,
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 1,
          borderColor: COLORS.border,
          borderStyle: "dashed",
        },
        imageLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },

        charCount: {
          fontSize: FONTS.sizes.sm,
          color: COLORS.textTertiary,
          textAlign: "right",
          marginTop: -SPACING.sm,
          marginBottom: SPACING.md,
        },

        buttonRow: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.md },
        backButton: { flex: 1 },
        continueButton: { flex: 2 },
        actionButton: { marginTop: SPACING.md },

        footer: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACING.xs,
          marginTop: SPACING.lg,
        },
        footerText: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
        footerLink: { fontSize: FONTS.sizes.md, color: COLORS.text, fontWeight: "800" },
      }),
    [COLORS, SPACING, FONTS, insets]
  );

  const meta = STAGE_META[stage];

  // Callbacks
  const updateField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));

    if (field === "password") {
      const validationResult = validatePasswordStrength(value);
      setPasswordStrength(validationResult.strength);
    }
  }, []);

  const validateEmailStage = useCallback(() => {
    const error = validation.validateEmail(formData.email);
    if (error) {
      setErrors({ email: error });
      return false;
    }
    return true;
  }, [formData.email, validation]);

  const validatePasswordStage = useCallback(() => {
    const passwordErrors = validation.validatePassword(
      formData.password,
      formData.confirmPassword
    );
    if (Object.keys(passwordErrors).length > 0) {
      setErrors(passwordErrors);
      return false;
    }
    return true;
  }, [formData.password, formData.confirmPassword, validation]);

  const validateProfileStage = useCallback(async () => {
    const newErrors = {};

    const usernameError = validation.validateUsername(formData.username);
    if (usernameError) {
      newErrors.username = usernameError;
    } else {
      setCheckingUsername(true);
      try {
        const isAvailable = await checkUsernameAvailability(
          formData.username.toLowerCase()
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

    const displayNameError = validation.validateDisplayName(formData.displayName);
    if (displayNameError) newErrors.displayName = displayNameError;

    const bioError = validation.validateBio(formData.bio);
    if (bioError) newErrors.bio = bioError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.username, formData.displayName, formData.bio, validation, checkUsernameAvailability]);

  const handleNext = useCallback(async () => {
    if (stage === 1 && validateEmailStage()) {
      setStage(2);
    } else if (stage === 2 && validatePasswordStage()) {
      setStage(3);
    }
  }, [stage, validateEmailStage, validatePasswordStage]);

  const handleBack = useCallback(() => {
    if (stage > 1) setStage(stage - 1);
  }, [stage]);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow access to your photos");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setFormData((prev) => ({ ...prev, profileImage: result.assets[0].uri }));
      }
    } catch (error) {
      console.error("[RegisterScreen] Image picker error:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  }, []);

  const handleRegister = useCallback(async () => {
    const isValid = await validateProfileStage();
    if (!isValid) return;

    try {
      const profileData = {
        username: formData.username.toLowerCase(),
        displayName: formData.displayName.trim(),
        bio: formData.bio.trim(),
        profileImageUri: formData.profileImage,
      };

      console.log("[RegisterScreen] Starting registration...");
      await register(formData.email, formData.password, profileData);
      console.log("[RegisterScreen] Registration completed successfully");

      Alert.alert(
        "Registration Successful! 🎉",
        `A verification email has been sent to ${formData.email}.\n\nPlease check your inbox and verify your email to continue.\n\nYou can still set up your wallet while waiting for verification.`,
        [
          {
            text: "Continue to Wallet Setup",
            onPress: () => {
              navigation.navigate("WalletSetup", {
                cloudPassword: formData.password,
                isNewUser: true,
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error("[RegisterScreen] Registration error:", error);

      const errorMap = {
        "auth/email-already-in-use": { message: "This email is already registered", stage: 1 },
        "auth/invalid-email": { message: "Invalid email address", stage: 1 },
        "auth/weak-password": { message: "Password is too weak", stage: 2 },
      };

      const errorInfo = errorMap[error.code] || {
        message: error.message || "Registration failed. Please try again.",
        stage: null,
      };

      if (errorInfo.stage) setStage(errorInfo.stage);
      Alert.alert("Registration Error", errorInfo.message);
    }
  }, [validateProfileStage, formData, register, navigation]);

  const getPasswordStrengthColor = useCallback(() => {
    if (!passwordStrength) return COLORS.textTertiary;
    const colorMap = {
      weak: COLORS.error,
      medium: COLORS.warning,
      strong: COLORS.success,
    };
    return colorMap[passwordStrength] || COLORS.textTertiary;
  }, [passwordStrength, COLORS]);

  const handleSignIn = useCallback(() => {
    navigation.navigate("Login");
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Hero block */}
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>{meta.eyebrow}</Text>
        <Text style={styles.heroTitle}>{meta.title}</Text>
      </View>

      {/* Sheet */}
      <View style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sheetHandle} />

            <ProgressIndicator stage={stage} styles={styles} />

            <Text style={styles.formLabel}>{meta.label}</Text>

            {stage === 1 && (
              <EmailStage
                formData={formData}
                errors={errors}
                onUpdateField={updateField}
                onNext={handleNext}
                styles={styles}
                colors={COLORS}
              />
            )}

            {stage === 2 && (
              <PasswordStage
                formData={formData}
                errors={errors}
                passwordStrength={passwordStrength}
                onUpdateField={updateField}
                onNext={handleNext}
                onBack={handleBack}
                getPasswordStrengthColor={getPasswordStrengthColor}
                styles={styles}
                colors={COLORS}
              />
            )}

            {stage === 3 && (
              <ProfileStage
                formData={formData}
                errors={errors}
                checkingUsername={checkingUsername}
                loading={loading}
                onUpdateField={updateField}
                onPickImage={pickImage}
                onRegister={handleRegister}
                onBack={handleBack}
                styles={styles}
                colors={COLORS}
              />
            )}

            {stage === 1 && (
              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account?</Text>
                <Text style={styles.footerLink} onPress={handleSignIn}>
                  Sign In
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;