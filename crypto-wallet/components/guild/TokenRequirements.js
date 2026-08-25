// components/TokenRequirements.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext"; // Adjust path as needed

const TokenRequirements = ({
  tokenGatingData,
  hasRequiredToken,
  tokenCheckLoading,
  useraddress,
  checkTokenBalance,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  if (!tokenGatingData) return null;

  const isToken = tokenGatingData.tokenType === "Token";
  const hasTokenInfo = tokenGatingData.name || tokenGatingData.symbol;

  return (
    <View style={styles.tokenRequirementsContainer}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerIconContainer}>
          <Ionicons name="shield-checkmark" size={20} color={theme.COLORS.primary} />
        </View>
        <Text style={styles.tokenRequirementsTitle}>Token Requirements</Text>
      </View>

      {/* Main Card */}
      <View style={styles.tokenInfoCard}>
        {/* Token Type Badge */}
        <View style={styles.tokenTypeBadge}>
          <Ionicons
            name={isToken ? "diamond" : "image"}
            size={14}
            color={theme.COLORS.primary}
          />
          <Text style={styles.tokenTypeBadgeText}>
            {tokenGatingData.tokenType}
          </Text>
        </View>

        {/* Token Details */}
        <View style={styles.tokenDetailsContainer}>
          {/* Token/NFT Name */}
          {hasTokenInfo && (
            <View style={styles.tokenInfoRow}>
              <View style={styles.tokenInfoLabelContainer}>
                <Ionicons
                  name={isToken ? "wallet" : "image"}
                  size={16}
                  color={theme.COLORS.textTertiary}
                />
                <Text style={styles.tokenInfoLabel}>
                  {isToken ? "Token" : "Collection"}
                </Text>
              </View>
              <View style={styles.tokenInfoValueContainer}>
                <Text style={styles.tokenInfoValue}>
                  {tokenGatingData.name}
                </Text>
                {tokenGatingData.symbol && (
                  <Text style={styles.tokenSymbol}>
                    {tokenGatingData.symbol}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Contract Address */}
          <View style={styles.tokenInfoRow}>
            <View style={styles.tokenInfoLabelContainer}>
              <Ionicons name="document-text" size={16} color={theme.COLORS.textTertiary} />
              <Text style={styles.tokenInfoLabel}>Contract</Text>
            </View>
            <TouchableOpacity
              style={styles.contractAddressContainer}
              onPress={() => {
                console.log("Copy contract address:", tokenGatingData.tokenAddress);
              }}
            >
              <Text style={styles.contractAddress}>
                {`${tokenGatingData.tokenAddress.slice(0, 6)}...${tokenGatingData.tokenAddress.slice(-4)}`}
              </Text>
              <Ionicons name="copy-outline" size={14} color={theme.COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Minimum Amount (for tokens only) */}
          {isToken && tokenGatingData.minTokenAmount && (
            <View style={styles.tokenInfoRow}>
              <View style={styles.tokenInfoLabelContainer}>
                <Ionicons name="trending-up" size={16} color={theme.COLORS.textTertiary} />
                <Text style={styles.tokenInfoLabel}>Required</Text>
              </View>
              <Text style={styles.minAmountValue}>
                {parseFloat(tokenGatingData.minTokenAmount).toLocaleString()}{" "}
                {tokenGatingData.symbol || ""}
              </Text>
            </View>
          )}

          {/* User Balance */}
          {typeof tokenGatingData.userBalance !== "undefined" && (
            <View style={styles.tokenInfoRow}>
              <View style={styles.tokenInfoLabelContainer}>
                <Ionicons name="person" size={16} color={theme.COLORS.textTertiary} />
                <Text style={styles.tokenInfoLabel}>Your Balance</Text>
              </View>
              <Text
                style={[
                  styles.userBalanceValue,
                  hasRequiredToken ? styles.balanceValid : styles.balanceInvalid,
                ]}
              >
                {parseFloat(tokenGatingData.userBalance).toLocaleString()}{" "}
                {tokenGatingData.symbol || ""}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Status Section */}
      {checkTokenBalance && (
        <View style={styles.statusSection}>
          {tokenCheckLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.COLORS.primary} size="small" />
              <Text style={styles.loadingText}>Verifying token balance...</Text>
            </View>
          ) : (
            <View
              style={[
                styles.statusContainer,
                hasRequiredToken ? styles.statusSuccess : styles.statusError,
              ]}
            >
              <View style={styles.statusIconContainer}>
                <Ionicons
                  name={hasRequiredToken ? "checkmark-circle" : "close-circle"}
                  size={22}
                  color={hasRequiredToken ? theme.COLORS.success : theme.COLORS.error}
                />
              </View>
              <View style={styles.statusTextContainer}>
                <Text
                  style={[
                    styles.statusTitle,
                    hasRequiredToken
                      ? styles.statusTitleSuccess
                      : styles.statusTitleError,
                  ]}
                >
                  {hasRequiredToken ? "Access Granted" : "Access Denied"}
                </Text>
                <Text style={styles.statusDescription}>
                  {hasRequiredToken
                    ? "You meet the token requirements"
                    : useraddress
                    ? "Insufficient token balance"
                    : "Connect your wallet to verify"}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    tokenRequirementsContainer: {
      backgroundColor: theme.COLORS.surface,
      borderRadius: theme.BORDER_RADIUS.xl,
      padding: theme.SPACING.md,
      width: "100%",
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      ...theme.SHADOWS.medium,
      marginBottom: theme.SPACING.lg,
    },
    headerContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.SPACING.md,
    },
    headerIconContainer: {
      width: 32,
      height: 32,
      backgroundColor: `${theme.COLORS.primary}1A`, // 10% opacity
      borderRadius: theme.BORDER_RADIUS.md,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.SPACING.sm + 4,
    },
    tokenRequirementsTitle: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: "600",
      color: theme.COLORS.text,
      letterSpacing: 0.5,
    },
    tokenInfoCard: {
      backgroundColor: theme.COLORS.card,
      borderRadius: theme.BORDER_RADIUS.lg,
      padding: theme.SPACING.md,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      marginBottom: theme.SPACING.md,
    },
    tokenTypeBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${theme.COLORS.primary}1A`, // 10% opacity
      borderRadius: 20,
      paddingHorizontal: theme.SPACING.sm + 4,
      paddingVertical: 6,
      alignSelf: "flex-start",
      marginBottom: theme.SPACING.md,
    },
    tokenTypeBadgeText: {
      fontSize: theme.FONTS.sizes.xs,
      fontWeight: "600",
      color: theme.COLORS.primary,
      marginLeft: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    tokenDetailsContainer: {
      gap: theme.SPACING.sm + 4,
    },
    tokenInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.SPACING.sm,
    },
    tokenInfoLabelContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    tokenInfoLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textTertiary,
      marginLeft: theme.SPACING.sm,
      fontWeight: "500",
    },
    tokenInfoValueContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 2,
      justifyContent: "flex-end",
    },
    tokenInfoValue: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
      fontWeight: "500",
      textAlign: "right",
    },
    tokenSymbol: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.primary,
      fontWeight: "600",
      marginLeft: theme.SPACING.sm,
      backgroundColor: `${theme.COLORS.primary}1A`, // 10% opacity
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.BORDER_RADIUS.sm,
    },
    contractAddressContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.COLORS.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.BORDER_RADIUS.sm + 2,
      borderWidth: 1,
      borderColor: theme.COLORS.divider,
    },
    contractAddress: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textSecondary,
      fontFamily: "monospace",
      marginRight: 6,
    },
    minAmountValue: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.primary,
      fontWeight: "600",
      textAlign: "right",
    },
    userBalanceValue: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: "600",
      textAlign: "right",
    },
    balanceValid: {
      color: theme.COLORS.success,
    },
    balanceInvalid: {
      color: theme.COLORS.error,
    },
    statusSection: {
      marginTop: theme.SPACING.xs,
    },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${theme.COLORS.primary}0D`, // 5% opacity
      borderRadius: theme.BORDER_RADIUS.md + 2,
      paddingVertical: theme.SPACING.sm + 4,
      paddingHorizontal: theme.SPACING.md,
      borderWidth: 1,
      borderColor: `${theme.COLORS.primary}33`, // 20% opacity
    },
    loadingText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.primary,
      marginLeft: theme.SPACING.md - 6,
      fontWeight: "500",
    },
    statusContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: theme.BORDER_RADIUS.md + 2,
      paddingVertical: theme.SPACING.sm + 6,
      paddingHorizontal: theme.SPACING.md,
      borderWidth: 1,
    },
    statusSuccess: {
      backgroundColor: `${theme.COLORS.success}0D`, // 5% opacity
      borderColor: `${theme.COLORS.success}4D`, // 30% opacity
    },
    statusError: {
      backgroundColor: `${theme.COLORS.error}0D`, // 5% opacity
      borderColor: `${theme.COLORS.error}4D`, // 30% opacity
    },
    statusIconContainer: {
      marginRight: theme.SPACING.sm + 4,
    },
    statusTextContainer: {
      flex: 1,
    },
    statusTitle: {
      fontSize: theme.FONTS.sizes.md - 1,
      fontWeight: "600",
      marginBottom: 2,
    },
    statusTitleSuccess: {
      color: theme.COLORS.success,
    },
    statusTitleError: {
      color: theme.COLORS.error,
    },
    statusDescription: {
      fontSize: theme.FONTS.sizes.sm - 1,
      color: theme.COLORS.textTertiary,
      fontWeight: "400",
      lineHeight: 18,
    },
  });

export default TokenRequirements;