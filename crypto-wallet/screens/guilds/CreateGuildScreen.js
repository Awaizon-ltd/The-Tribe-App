import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, ActivityIndicator, Modal, Animated,
} from "react-native";
import { Ionicons }         from "@expo/vector-icons";
import { LinearGradient }   from "expo-linear-gradient";
import * as ImagePicker     from "expo-image-picker";
import { useAuth }          from "../../contexts/AuthContext";
import { useTheme }         from "../../contexts/ThemeContext";
import { useWallet }        from "../../contexts/WalletContext";
import { ethers }           from "ethers";
import { SPACING, FONTS, BORDER_RADIUS } from "../../constants/Theme";
import Alert                from "../../utils/Alert";
import api                  from "../../services/GuildApiService";
import { uploadImageToCloudinary } from "../../services/ImageUploadServices";

const GENRES = [
  "NFTs","DeFi","DAO","GameFi","DePIN","AI",
  "Memecoin","Degen","RWA","Metaverse","Infrastructure",
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

const MAX_GUILDS_PER_USER = 1;

const CreateGuildScreen = ({ navigation }) => {
  const { user }     = useAuth();
  const { provider } = useWallet();
  const { COLORS }   = useTheme();

  // Basic info
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [logoUri, setLogoUri]         = useState(null);
  const [bannerUri, setBannerUri]     = useState(null);

  // Privacy
  const [privacy, setPrivacy]                 = useState("public");
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Token gating
  const [showTokenGatingModal, setShowTokenGatingModal] = useState(false);
  const [tokenType, setTokenType]             = useState("Token");
  const [tokenAddress, setTokenAddress]       = useState("");
  const [minTokenAmount, setMinTokenAmount]   = useState("1");
  const [tokenInfo, setTokenInfo]             = useState(null);
  const [fetchingTokenInfo, setFetchingTokenInfo] = useState(false);

  // UI state
  const [loading, setLoading]                         = useState(false);
  const [creatingStep, setCreatingStep]               = useState(null);
  const [showGenreModal, setShowGenreModal]           = useState(false);
  const [checkingGuildLimit, setCheckingGuildLimit]   = useState(true);
  const [userGuildCount, setUserGuildCount]           = useState(0);

  // Pulse animation for the creation overlay icon
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!loading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [loading]);

  // ── Check how many guilds this user has already created ──────────────────────
  useEffect(() => {
    if (!user) return;

    const checkLimit = async () => {
      try {
        setCheckingGuildLimit(true);
        const guilds = await api.getMyGuilds();
        const owned  = (guilds || []).filter(
          g => (g.createdBy || g.created_by) === user.uid,
        );
        const count = owned.length;
        setUserGuildCount(count);

        if (count >= MAX_GUILDS_PER_USER) {
          Alert.alert(
            "Guild Limit Reached",
            `You can only create up to ${MAX_GUILDS_PER_USER} guild. Delete an existing guild to create a new one.`,
            [{ text: "Go Back", onPress: () => navigation.goBack() }],
            { cancelable: false },
          );
        }
      } catch (err) {
        console.error("[CreateGuild] guild limit check failed:", err.message);
      } finally {
        setCheckingGuildLimit(false);
      }
    };

    checkLimit();
  }, [user]);

  // ── Image pickers ─────────────────────────────────────────────────────────────
  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photos.");
      return false;
    }
    return true;
  };

  const pickLogo = async () => {
    if (!(await requestPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setLogoUri(result.assets[0].uri);
  };

  const pickBanner = async () => {
    if (!(await requestPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setBannerUri(result.assets[0].uri);
  };

  // ── Token info fetch (on-chain, no Firebase) ──────────────────────────────────
  const fetchTokenInfo = async () => {
    if (!tokenAddress)             { Alert.alert("Error", "Please enter a contract address."); return; }
    if (!ethers.isAddress(tokenAddress)) { Alert.alert("Invalid Address", "Please enter a valid Ethereum address."); return; }
    if (!provider)                 { Alert.alert("Error", "Wallet not connected."); return; }

    setFetchingTokenInfo(true);
    try {
      const ABI      = tokenType === "Token" ? ERC20_ABI : ERC721_ABI;
      const contract = new ethers.Contract(tokenAddress, ABI, provider);

      if (tokenType === "Token") {
        const [tName, symbol, decimals] = await Promise.all([
          contract.name(), contract.symbol(), contract.decimals(),
        ]);
        setTokenInfo({ name: tName, symbol, decimals: decimals.toString() });
        Alert.alert("Token Found", `${tName} (${symbol})\nDecimals: ${decimals}`);
      } else {
        const [tName, symbol] = await Promise.all([contract.name(), contract.symbol()]);
        setTokenInfo({ name: tName, symbol });
        Alert.alert("NFT Collection Found", `${tName} (${symbol})`);
      }
    } catch {
      Alert.alert("Error", "Failed to fetch token info. Verify the address and network.");
      setTokenInfo(null);
    } finally {
      setFetchingTokenInfo(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────────
  const validate = () => {
    if (userGuildCount >= MAX_GUILDS_PER_USER) {
      Alert.alert("Guild Limit Reached", `You can only create ${MAX_GUILDS_PER_USER} guild.`);
      return false;
    }
    if (!name.trim())        { Alert.alert("Missing Info", "Please enter a guild name.");   return false; }
    if (!description.trim()) { Alert.alert("Missing Info", "Please enter a description.");  return false; }
    if (!selectedGenre)      { Alert.alert("Missing Info", "Please select a genre.");        return false; }
    if (!logoUri)            { Alert.alert("Missing Info", "Please upload a guild logo.");   return false; }
    if (!bannerUri)          { Alert.alert("Missing Info", "Please upload a guild banner."); return false; }

    if (privacy === "private") {
      if (!tokenAddress || !tokenInfo) {
        Alert.alert("Missing Info", "Please enter a valid token address and fetch token info.");
        return false;
      }
      if (tokenType === "Token" && (!minTokenAmount || parseFloat(minTokenAmount) <= 0)) {
        Alert.alert("Invalid Amount", "Please enter a valid minimum token amount.");
        return false;
      }
    }
    return true;
  };

  // ── Create guild ──────────────────────────────────────────────────────────────
  const handleCreateGuild = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      // Step 1 — upload logo
      setCreatingStep("logo");
      const logoResult = await uploadImageToCloudinary(
        logoUri, "guild-images", { publicId: `guild_logo_${Date.now()}` },
      );

      // Step 2 — upload banner
      setCreatingStep("banner");
      const bannerResult = await uploadImageToCloudinary(
        bannerUri, "guild-images", { publicId: `guild_banner_${Date.now()}` },
      );

      // Step 3 — create guild record
      setCreatingStep("creating");
      const tokenGating = privacy === "private" && tokenInfo
        ? {
            tokenType,
            tokenAddress,
            minTokenAmount: tokenType === "Token" ? minTokenAmount : "1",
            name:    tokenInfo.name,
            symbol:  tokenInfo.symbol,
            ...(tokenType === "Token" && { decimals: tokenInfo.decimals }),
          }
        : null;

      await api.createGuild({
        name:        name.trim(),
        description: description.trim(),
        genre:       selectedGenre,
        privacy,
        logoUrl:     logoResult.url,
        bannerUrl:   bannerResult.url,
        tokenGating,
      });

      // Step 4 — done
      setCreatingStep("done");
      await new Promise((r) => setTimeout(r, 900));

      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (err) {
      console.error("[CreateGuild] failed:", err.message);
      setLoading(false);
      setCreatingStep(null);
      Alert.alert("Error", err?.response?.data?.error || "Failed to create guild. Please try again.");
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────────
  const styles = StyleSheet.create({
    container:           { flex: 1, backgroundColor: COLORS.background, paddingTop: SPACING.xl },
    backgroundGradient:  { flex: 1 },
    header:              { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
    backButton:          { padding: SPACING.sm },
    headerTitle:         { color: COLORS.text, fontSize: FONTS.sizes.xl, fontWeight: "bold" },
    headerRight:         { minWidth: 40, alignItems: "flex-end" },
    guildCount:          { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: "600" },
    scrollView:          { flex: 1 },
    loadingContainer:    { flex: 1, backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center", gap: SPACING.md },
    loadingText:         { color: COLORS.textSecondary, fontSize: FONTS.sizes.md },
    limitContainer:      { flex: 1, backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center", padding: SPACING.xl },
    limitTitle:          { color: COLORS.text, fontSize: FONTS.sizes.xxl, fontWeight: "bold", marginTop: SPACING.lg, textAlign: "center" },
    limitText:           { color: COLORS.textSecondary, fontSize: FONTS.sizes.lg, marginTop: SPACING.md, textAlign: "center" },
    limitSubtext:        { color: COLORS.textTertiary, fontSize: FONTS.sizes.md, marginTop: SPACING.sm, textAlign: "center" },
    backButton2:         { marginTop: SPACING.xl, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg },
    backButtonText:      { color: COLORS.card, fontSize: FONTS.sizes.md, fontWeight: "bold" },
    bannerContainer:     { width: "100%", height: 200, backgroundColor: COLORS.surface },
    bannerImage:         { width: "100%", height: "100%" },
    bannerPlaceholder:   { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
    bannerPlaceholderText: { color: COLORS.textTertiary, fontSize: FONTS.sizes.md, fontWeight: "600", marginTop: SPACING.md },
    bannerSubtext:       { color: COLORS.textTertiary, fontSize: FONTS.sizes.xs, marginTop: SPACING.xs },
    logoContainer:       { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.surface, borderWidth: 4, borderColor: COLORS.background, marginTop: -50, marginLeft: SPACING.lg },
    logoImage:           { width: "100%", height: "100%", borderRadius: 50 },
    logoPlaceholder:     { width: "100%", height: "100%", borderRadius: 50, justifyContent: "center", alignItems: "center" },
    form:                { padding: SPACING.lg },
    inputGroup:          { marginBottom: SPACING.lg },
    label:               { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: "600", marginBottom: SPACING.sm },
    input:               { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.divider, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, color: COLORS.text, fontSize: FONTS.sizes.md },
    textArea:            { height: 120, textAlignVertical: "top" },
    charCount:           { color: COLORS.textTertiary, fontSize: FONTS.sizes.xs, textAlign: "right", marginTop: SPACING.xs },
    selectButton:        { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.divider, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    selectButtonText:    { color: COLORS.textTertiary, fontSize: FONTS.sizes.md },
    selectButtonTextActive: { color: COLORS.text },
    privacyOption:       { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
    tokenGatingContainer: { backgroundColor: "rgba(255,215,0,0.05)", borderWidth: 1, borderColor: "rgba(255,215,0,0.2)", borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginTop: SPACING.sm },
    tokenGatingHeader:   { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.md },
    tokenGatingTitle:    { color: "#FFD700", fontSize: FONTS.sizes.md, fontWeight: "600" },
    tokenTypeContainer:  { flexDirection: "row", gap: SPACING.md, marginBottom: SPACING.md },
    tokenTypeButton:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.divider, borderRadius: BORDER_RADIUS.lg, paddingVertical: SPACING.md },
    tokenTypeButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    tokenTypeText:       { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: "600" },
    tokenTypeTextActive: { color: COLORS.card },
    addressInputContainer: { flexDirection: "row", gap: SPACING.sm },
    addressInput:        { flex: 1 },
    fetchButton:         { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, width: 48, height: 48, justifyContent: "center", alignItems: "center" },
    tokenInfoDisplay:    { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginTop: SPACING.md },
    tokenInfoRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
    tokenInfoLabel:      { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: "500" },
    tokenInfoValue:      { color: COLORS.text, fontSize: FONTS.sizes.sm, fontWeight: "600" },
    createButton:        { borderRadius: BORDER_RADIUS.lg, overflow: "hidden", marginTop: SPACING.lg, marginBottom: SPACING.xl },
    createButtonDisabled: { opacity: 0.6 },
    createButtonGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: SPACING.md, gap: SPACING.sm },
    createButtonText:    { color: COLORS.card, fontSize: FONTS.sizes.lg, fontWeight: "bold" },
    creationOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: SPACING.xl },
    creationCard:        { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, alignItems: "center", width: "100%", maxWidth: 320, gap: SPACING.md },
    creationIconWrap:    { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(38,204,107,0.12)", justifyContent: "center", alignItems: "center" },
    creationTitle:       { color: COLORS.text, fontSize: FONTS.sizes.xl, fontWeight: "bold", textAlign: "center" },
    creationSubtitle:    { color: COLORS.textSecondary, fontSize: FONTS.sizes.md, textAlign: "center", lineHeight: 22 },
    stepRow:             { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
    stepDot:             { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.divider },
    stepDotActive:       { backgroundColor: COLORS.primary, width: 20 },
    stepDotDone:         { backgroundColor: COLORS.primary },
    modalOverlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
    modalContent:        { backgroundColor: COLORS.surface, borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, maxHeight: "80%" },
    modalHeader:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
    modalTitle:          { color: COLORS.text, fontSize: FONTS.sizes.lg, fontWeight: "bold" },
    modalList:           { padding: SPACING.md },
    modalItem:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, marginBottom: SPACING.sm },
    modalItemSelected:   { backgroundColor: "rgba(38,204,107,0.1)", borderWidth: 1, borderColor: COLORS.primary },
    modalItemText:       { color: COLORS.text, fontSize: FONTS.sizes.md, fontWeight: "500" },
    modalItemTextSelected: { color: COLORS.primary },
    privacyModalContent: { padding: SPACING.lg, gap: SPACING.md },
    privacyCard:         { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, alignItems: "center", borderWidth: 2, borderColor: COLORS.divider },
    privacyCardSelected: { borderColor: COLORS.primary, backgroundColor: "rgba(38,204,107,0.05)" },
    privacyCardTitle:    { color: COLORS.text, fontSize: FONTS.sizes.lg, fontWeight: "bold", marginTop: SPACING.md },
    privacyCardDescription: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, textAlign: "center", marginTop: SPACING.sm, lineHeight: 20 },
  });

  // ── Early returns ─────────────────────────────────────────────────────────────
  if (checkingGuildLimit) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Checking guild limit...</Text>
      </View>
    );
  }

  if (userGuildCount >= MAX_GUILDS_PER_USER) {
    return (
      <View style={styles.limitContainer}>
        <Ionicons name="alert-circle" size={64} color={COLORS.warning} />
        <Text style={styles.limitTitle}>Guild Limit Reached</Text>
        <Text style={styles.limitText}>
          You've created {userGuildCount} of {MAX_GUILDS_PER_USER} guild.
        </Text>
        <Text style={styles.limitSubtext}>Delete an existing guild to create a new one.</Text>
        <TouchableOpacity style={styles.backButton2} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.background, COLORS.background, COLORS.background]}
        style={styles.backgroundGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Guild</Text>
          <View style={styles.headerRight}>
            <Text style={styles.guildCount}>{userGuildCount}/{MAX_GUILDS_PER_USER}</Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Banner */}
          <TouchableOpacity style={styles.bannerContainer} onPress={pickBanner}>
            {bannerUri ? (
              <Image source={{ uri: bannerUri }} style={styles.bannerImage} />
            ) : (
              <View style={styles.bannerPlaceholder}>
                <Ionicons name="image" size={48} color={COLORS.textTertiary} />
                <Text style={styles.bannerPlaceholderText}>Upload Banner</Text>
                <Text style={styles.bannerSubtext}>16:9 aspect ratio</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Logo */}
          <TouchableOpacity style={styles.logoContainer} onPress={pickLogo}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="camera" size={32} color={COLORS.textTertiary} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.form}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Guild Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter guild name"
                placeholderTextColor={COLORS.textTertiary}
                value={name}
                onChangeText={setName}
                maxLength={50}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your guild..."
                placeholderTextColor={COLORS.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
              <Text style={styles.charCount}>{description.length}/500</Text>
            </View>

            {/* Genre */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Genre *</Text>
              <TouchableOpacity style={styles.selectButton} onPress={() => setShowGenreModal(true)}>
                <Text style={[styles.selectButtonText, selectedGenre && styles.selectButtonTextActive]}>
                  {selectedGenre || "Select genre"}
                </Text>
                <Ionicons name="chevron-down" size={20} color={COLORS.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Privacy */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Privacy *</Text>
              <TouchableOpacity style={styles.selectButton} onPress={() => setShowPrivacyModal(true)}>
                <View style={styles.privacyOption}>
                  <Ionicons
                    name={privacy === "public" ? "globe" : "lock-closed"}
                    size={20}
                    color={privacy === "public" ? COLORS.primary : "#FFD700"}
                  />
                  <Text style={styles.selectButtonTextActive}>
                    {privacy === "public" ? "Public" : "Private (Token Gated)"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={COLORS.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Token gating (private only) */}
            {privacy === "private" && (
              <View style={styles.tokenGatingContainer}>
                <View style={styles.tokenGatingHeader}>
                  <Ionicons name="shield-checkmark" size={20} color="#FFD700" />
                  <Text style={styles.tokenGatingTitle}>Token Gating Setup</Text>
                </View>

                <View style={styles.tokenTypeContainer}>
                  {["Token", "NFT"].map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.tokenTypeButton, tokenType === t && styles.tokenTypeButtonActive]}
                      onPress={() => { setTokenType(t); setTokenInfo(null); setTokenAddress(""); if (t === "NFT") setMinTokenAmount("1"); }}
                    >
                      <Ionicons
                        name={t === "Token" ? "diamond" : "image"}
                        size={20}
                        color={tokenType === t ? COLORS.card : COLORS.primary}
                      />
                      <Text style={[styles.tokenTypeText, tokenType === t && styles.tokenTypeTextActive]}>
                        {t === "Token" ? "ERC20 Token" : "ERC721 NFT"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Contract Address *</Text>
                  <View style={styles.addressInputContainer}>
                    <TextInput
                      style={[styles.input, styles.addressInput]}
                      placeholder="0x..."
                      placeholderTextColor={COLORS.textTertiary}
                      value={tokenAddress}
                      onChangeText={setTokenAddress}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.fetchButton}
                      onPress={fetchTokenInfo}
                      disabled={fetchingTokenInfo || !tokenAddress}
                    >
                      {fetchingTokenInfo
                        ? <ActivityIndicator size="small" color={COLORS.card} />
                        : <Ionicons name="search" size={20} color={COLORS.card} />
                      }
                    </TouchableOpacity>
                  </View>
                </View>

                {tokenInfo && (
                  <View style={styles.tokenInfoDisplay}>
                    {[["Name", tokenInfo.name], ["Symbol", tokenInfo.symbol], ...(tokenType === "Token" ? [["Decimals", tokenInfo.decimals]] : [])].map(([label, val]) => (
                      <View key={label} style={styles.tokenInfoRow}>
                        <Text style={styles.tokenInfoLabel}>{label}:</Text>
                        <Text style={styles.tokenInfoValue}>{val}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {tokenType === "Token" && tokenInfo && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Minimum Token Amount Required *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 100"
                      placeholderTextColor={COLORS.textTertiary}
                      value={minTokenAmount}
                      onChangeText={setMinTokenAmount}
                      keyboardType="numeric"
                    />
                  </View>
                )}
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.createButton, loading && styles.createButtonDisabled]}
              onPress={handleCreateGuild}
              disabled={loading}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.createButtonGradient}
              >
                <Ionicons name="add-circle" size={20} color={COLORS.card} />
                <Text style={styles.createButtonText}>Create Guild</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* ── Creation progress overlay ────────────────────────────────── */}
        {(() => {
          const STEPS = [
            { key: "logo",     icon: "image",         title: "Uploading Logo",    sub: "Uploading your guild logo..." },
            { key: "banner",   icon: "image-outline", title: "Uploading Banner",  sub: "Uploading your guild banner..." },
            { key: "creating", icon: "hammer",         title: "Creating Guild",    sub: "Setting up your guild on-chain..." },
            { key: "done",     icon: "checkmark-circle", title: "Guild Created!",  sub: "Your guild is ready." },
          ];
          const idx = STEPS.findIndex((s) => s.key === creatingStep);
          const step = STEPS[idx] ?? STEPS[0];
          const isDone = creatingStep === "done";

          return (
            <Modal visible={loading} transparent animationType="fade">
              <View style={styles.creationOverlay}>
                <View style={styles.creationCard}>
                  <Animated.View
                    style={[styles.creationIconWrap, { transform: [{ scale: pulseAnim }] }]}
                  >
                    {isDone ? (
                      <Ionicons name="checkmark-circle" size={44} color={COLORS.primary} />
                    ) : (
                      <ActivityIndicator size="large" color={COLORS.primary} />
                    )}
                  </Animated.View>

                  <Text style={styles.creationTitle}>{step.title}</Text>
                  <Text style={styles.creationSubtitle}>{step.sub}</Text>

                  {/* Step progress dots */}
                  <View style={styles.stepRow}>
                    {STEPS.map((s, i) => (
                      <Animated.View
                        key={s.key}
                        style={[
                          styles.stepDot,
                          i < idx  && styles.stepDotDone,
                          i === idx && styles.stepDotActive,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              </View>
            </Modal>
          );
        })()}

        {/* Genre modal */}
        <Modal visible={showGenreModal} animationType="slide" presentationStyle="pageSheet" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Genre</Text>
                <TouchableOpacity onPress={() => setShowGenreModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalList}>
                {GENRES.map((genre) => (
                  <TouchableOpacity
                    key={genre}
                    style={[styles.modalItem, selectedGenre === genre && styles.modalItemSelected]}
                    onPress={() => { setSelectedGenre(genre); setShowGenreModal(false); }}
                  >
                    <Text style={[styles.modalItemText, selectedGenre === genre && styles.modalItemTextSelected]}>
                      {genre}
                    </Text>
                    {selectedGenre === genre && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Privacy modal */}
        <Modal visible={showPrivacyModal} animationType="slide" presentationStyle="pageSheet" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Privacy</Text>
                <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.privacyModalContent}>
                {[
                  { value: "public",  icon: "globe",       color: COLORS.primary, title: "Public Guild",   desc: "Anyone can join without restrictions" },
                  { value: "private", icon: "lock-closed", color: "#FFD700",       title: "Private Guild",  desc: "Token gated — members must hold specific tokens/NFTs" },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.privacyCard, privacy === opt.value && styles.privacyCardSelected]}
                    onPress={() => { setPrivacy(opt.value); setShowPrivacyModal(false); }}
                  >
                    <Ionicons name={opt.icon} size={32} color={opt.color} />
                    <Text style={styles.privacyCardTitle}>{opt.title}</Text>
                    <Text style={styles.privacyCardDescription}>{opt.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </View>
  );
};

export default CreateGuildScreen;
