// components/AccessDeniedScreen.js
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import TokenRequirements from "./TokenRequirements";

const AccessDeniedScreen = ({
  tokenGatingData,
  hasRequiredToken,
  address,
  checkTokenBalance,
  tokenCheckLoading,
  navigation,
}) => {
  const { COLORS, isDark } = useTheme();

  return (
    <View style={styles.accessDeniedContainer}>
      <LinearGradient
        colors={isDark ? ["#000000ff", "#000000ff"] : [COLORS.surface, COLORS.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.accessDeniedGradient,
          {
            backgroundColor: COLORS.surface,
            borderColor: isDark ? "rgba(255, 68, 68, 0.3)" : "rgba(255, 68, 68, 0.4)",
          },
        ]}
      >
        <Ionicons name="lock-closed" size={24} color={COLORS.text} />
        <Text style={[styles.accessDeniedTitle, { color: COLORS.text }]}>
          Access Restricted
        </Text>
        <Text style={[styles.accessDeniedSubtext, { color: COLORS.textSecondary }]}>
          This is a private tribe that requires token ownership
        </Text>
      </LinearGradient>

      <TokenRequirements
        tokenGatingData={tokenGatingData}
        hasRequiredToken={hasRequiredToken}
        tokenCheckLoading={tokenCheckLoading}
        useraddress={address}
        checkTokenBalance={checkTokenBalance}
      />

      {!address && (
        <TouchableOpacity
          style={[
            styles.connectWalletButton,
            { backgroundColor: COLORS.primary },
          ]}
          onPress={() => navigation.navigate("WalletConnect")}
        >
          <Text style={[styles.connectWalletButtonText, { color: COLORS.buttonText }]}>
            Connect Wallet
          </Text>
        </TouchableOpacity>
      )}

      {address && !hasRequiredToken && (
        <View
          style={[
            styles.getTokensContainer,
            {
              backgroundColor: isDark ? "rgba(0, 212, 255, 0.1)" : "rgba(0, 212, 255, 0.08)",
              borderColor: isDark ? "rgba(0, 212, 255, 0.2)" : "rgba(0, 212, 255, 0.3)",
            },
          ]}
        >
          <Text style={[styles.getTokensText, { color: COLORS.accent || "#00D4FF" }]}>
            You need to acquire the required tokens to join this tribe.
          </Text>
          <TouchableOpacity
            style={[
              styles.retryButton,
              {
                backgroundColor: isDark ? "rgba(0, 212, 255, 0.2)" : "rgba(0, 212, 255, 0.15)",
                borderColor: COLORS.accent || "#00D4FF",
              },
            ]}
            onPress={checkTokenBalance}
          >
            <Text style={[styles.retryButtonText, { color: COLORS.accent || "#00D4FF" }]}>
              Check Again
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  accessDeniedContainer: {
    padding: 10,
    alignItems: "center",
  },
  accessDeniedGradient: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderRadius: 20,
    marginBottom: 14,
    width: "100%",
    borderWidth: 1,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 16,
    textAlign: "center",
  },
  accessDeniedSubtext: {
    fontSize: 16,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 24,
  },
  connectWalletButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 20,
    minWidth: 200,
    alignItems: "center",
  },
  connectWalletButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  getTokensContainer: {
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  getTokensText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default AccessDeniedScreen;