// screens/wallet/MintScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ethers } from "ethers";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserData } from "../../contexts/UserDataContext";
import { useWallet } from "../../contexts/WalletContext";
import { useChain } from "../../contexts/ChainContext";
import { useMintToken } from "../../hooks/useMintToken";
import { SPACING, FONTS } from "../../constants/Theme";
import { isWSYNDeployed, WSYN_MINT_FEE_ETH } from "../../constants/wsyn";

const SOURCE_LABELS = {
  networkbalance: "Network Balance",
  "balance+point": "Epoch Balance + Points",
  balance: "Balance",
};

const MintScreen = ({ navigation }) => {
  const { COLORS } = useTheme();
  const { userData } = useUserData();
  const { wallet } = useWallet();
  const { activeChain, switchChainById } = useChain();

  const {
    stage,
    txHash,
    explorerUrl,
    error,
    resolvedFrom,
    mintedAmountWei,
    requestVoucher,
    confirmMint,
    reset,
  } = useMintToken();

  const [passcode, setPasscode] = useState("");

  const styles = createStyles(COLORS);
  const deployed = isWSYNDeployed(activeChain.id);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatDisplayAmount = (wei) => {
    if (!wei) return "0";
    try {
      const n = parseFloat(ethers.formatUnits(wei, 18));
      return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    } catch {
      return "0";
    }
  };

  // Read balance fields from userData for pre-flight display.
  // Mirrors the priority logic of resolveEffectiveBalance — used for display only.
  const getPreflightBalance = () => {
    if (!userData) return null;
    const nb = Number(userData.networkbalance);
    if (userData.networkbalance != null && nb > 0) {
      return { label: "Network Balance", value: nb };
    }
    if (userData.balance != null && userData.point != null) {
      const sum = Number(userData.balance || 0) + Number(userData.point || 0);
      if (sum > 0) return { label: "Epoch Balance + Points", value: sum };
    }
    if (userData.balance != null && Number(userData.balance) > 0) {
      return { label: "Balance", value: Number(userData.balance) };
    }
    return null;
  };

  const preflightBalance = getPreflightBalance();
  const hasBalance = preflightBalance && preflightBalance.value > 0;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleMintPress = async () => {
    await requestVoucher();
    // Hook transitions to 'awaiting_passcode' on success — UI re-renders
  };

  const handlePasscodeSubmit = async () => {
    if (!passcode.trim()) return;
    const code = passcode;
    setPasscode("");
    await confirmMint(code);
  };

  const handleCancel = () => {
    reset();
    setPasscode("");
  };

  // ── Wrong network ──────────────────────────────────────────────────────────

  if (!deployed) {
    return (
      <View style={styles.container}>
        <Header title="Mint TRIBE" onBack={() => navigation.goBack()} COLORS={COLORS} styles={styles} />
        <View style={styles.centeredSection}>
          <Ionicons name="warning-outline" size={52} color={COLORS.warning} />
          <Text style={styles.stateTitle}>Wrong Network</Text>
          <Text style={styles.stateSubtitle}>
            TRIBE minting is available on Base Sepolia (testnet) and Base Mainnet.
            Please switch your network.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: SPACING.lg }]}
            onPress={() => switchChainById(84532)}
          >
            <Text style={styles.primaryButtonText}>Switch to Base Sepolia</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Passcode entry ─────────────────────────────────────────────────────────

  if (stage === "awaiting_passcode") {
    return (
      <View style={styles.container}>
        <Header
          title="Confirm Mint"
          onBack={handleCancel}
          COLORS={COLORS}
          styles={styles}
        />
        <View style={styles.centeredSection}>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed-outline" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.stateTitle}>Enter Passcode</Text>
          <Text style={styles.stateSubtitle}>
            Enter your wallet passcode to sign the mint transaction on{" "}
            {activeChain.name}.
          </Text>

          <TextInput
            style={styles.passcodeInput}
            value={passcode}
            onChangeText={setPasscode}
            secureTextEntry
            placeholder="••••••"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="number-pad"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handlePasscodeSubmit}
          />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              !passcode.trim() && styles.disabledButton,
            ]}
            onPress={handlePasscodeSubmit}
            disabled={!passcode.trim()}
          >
            <Text style={styles.primaryButtonText}>Confirm & Mint</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.textButton} onPress={handleCancel}>
            <Text style={styles.textButtonLabel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Waiting for tx ─────────────────────────────────────────────────────────

  if (stage === "waiting_tx") {
    return (
      <View style={styles.container}>
        <Header title="Minting..." onBack={null} COLORS={COLORS} styles={styles} />
        <View style={styles.centeredSection}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateTitle}>Transaction in Progress</Text>
          <Text style={styles.stateSubtitle}>
            Waiting for confirmation on {activeChain.name}.{"\n"}
            Do not close this screen.
          </Text>
        </View>
      </View>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────

  if (stage === "success") {
    return (
      <View style={styles.container}>
        <Header title="Mint TRIBE" onBack={() => navigation.goBack()} COLORS={COLORS} styles={styles} />
        <View style={styles.centeredSection}>
          <Ionicons
            name="checkmark-circle"
            size={64}
            color={COLORS.success ?? "#22c55e"}
          />
          <Text style={styles.stateTitle}>
            Minted {formatDisplayAmount(mintedAmountWei)} WSYN
          </Text>
          <Text style={styles.stateSubtitle}>
            Your TRIBE tokens have arrived in your wallet on {activeChain.name}.
            {resolvedFrom && (
              `\n\nSource: ${SOURCE_LABELS[resolvedFrom] ?? resolvedFrom}`
            )}
          </Text>

          {explorerUrl && (
            <TouchableOpacity
              style={styles.explorerLink}
              onPress={() => Linking.openURL(explorerUrl)}
            >
              <Ionicons name="open-outline" size={16} color={COLORS.primary} />
              <Text style={styles.explorerLinkText}>
                View on {activeChain.id === 84532 ? "Sepolia " : ""}Basescan
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: SPACING.xl }]}
            onPress={() => { reset(); navigation.goBack(); }}
          >
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main / error ───────────────────────────────────────────────────────────

  const isBusy = stage === "requesting_voucher";

  return (
    <View style={styles.container}>
      <Header
        title="Mint TRIBE"
        onBack={() => navigation.goBack()}
        COLORS={COLORS}
        styles={styles}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Network badge */}
        <View style={styles.networkRow}>
          <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
          <Text style={styles.networkLabel}>{activeChain.name}</Text>
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceCardTitle}>Available to Mint</Text>
          {preflightBalance ? (
            <>
              <Text style={styles.balanceLabel}>{preflightBalance.label}</Text>
              <Text style={styles.balanceAmount}>
                {Number(preflightBalance.value).toLocaleString()} SYN
              </Text>
            </>
          ) : (
            <Text style={styles.noBalanceText}>No off-chain balance found.</Text>
          )}
        </View>

        {/* Info rows */}
        <View style={styles.infoCard}>
          <InfoRow
            icon="swap-horizontal-outline"
            text="Converts your off-chain SYN balance to on-chain WSYN tokens."
            COLORS={COLORS}
            styles={styles}
          />
          <InfoRow
            icon="wallet-outline"
            text={`Mint fee: ${WSYN_MINT_FEE_ETH} ETH (covers the gas cost on Base)`}
            COLORS={COLORS}
            styles={styles}
          />
          <InfoRow
            icon="alert-circle-outline"
            text="Irreversible — your off-chain balance will be set to 0 after minting."
            COLORS={COLORS}
            styles={styles}
            warn
          />
        </View>

        {/* Error banner */}
        {(stage === "error" || error) && (
          <View style={styles.errorBanner}>
            <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* Mint button */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            (!hasBalance || isBusy) && styles.disabledButton,
          ]}
          onPress={handleMintPress}
          disabled={!hasBalance || isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color={COLORS.surface} />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Mint My Tokens</Text>
              <Ionicons name="flash" size={20} color={COLORS.surface} />
            </>
          )}
        </TouchableOpacity>

        {/* Retry after error */}
        {stage === "error" && (
          <TouchableOpacity style={styles.textButton} onPress={reset}>
            <Text style={styles.textButtonLabel}>Try Again</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Header = ({ title, onBack, COLORS, styles }) => (
  <View style={styles.header}>
    {onBack ? (
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Ionicons name="arrow-back" size={22} color={COLORS.text} />
      </TouchableOpacity>
    ) : (
      <View style={styles.backButton} />
    )}
    <Text style={styles.headerTitle}>{title}</Text>
    <View style={styles.backButton} />
  </View>
);

const InfoRow = ({ icon, text, warn, COLORS, styles }) => (
  <View style={styles.infoRow}>
    <Ionicons
      name={icon}
      size={17}
      color={warn ? COLORS.warning : COLORS.textSecondary}
    />
    <Text style={[styles.infoText, warn && { color: COLORS.warning }]}>
      {text}
    </Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (COLORS) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.sm,
    },
    backButton: {
      width: 36,
      height: 36,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: FONTS.sizes.lg,
      fontWeight: "700",
      color: COLORS.text,
    },
    content: {
      padding: SPACING.md,
      paddingBottom: SPACING.xl * 2,
    },
    centeredSection: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: SPACING.xl,
    },
    stateTitle: {
      fontSize: FONTS.sizes.xl,
      fontWeight: "700",
      color: COLORS.text,
      marginTop: SPACING.md,
      textAlign: "center",
    },
    stateSubtitle: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
      marginTop: SPACING.sm,
      textAlign: "center",
      lineHeight: 20,
    },
    lockIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: COLORS.primary + "15",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: SPACING.sm,
    },
    networkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
      marginBottom: SPACING.md,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    networkLabel: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
      fontWeight: "500",
    },
    balanceCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    balanceCardTitle: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
      fontWeight: "500",
      marginBottom: SPACING.xs,
    },
    balanceLabel: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
    },
    balanceAmount: {
      fontSize: 28,
      fontWeight: "700",
      color: COLORS.text,
      marginTop: 4,
    },
    noBalanceText: {
      fontSize: FONTS.sizes.md,
      color: COLORS.textTertiary,
      marginTop: SPACING.xs,
    },
    infoCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      padding: SPACING.md,
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.xs,
    },
    infoText: {
      flex: 1,
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
      lineHeight: 18,
    },
    errorBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.xs,
      backgroundColor: COLORS.error + "15",
      borderRadius: 12,
      padding: SPACING.sm,
      marginBottom: SPACING.md,
    },
    errorBannerText: {
      flex: 1,
      fontSize: FONTS.sizes.sm,
      color: COLORS.error,
      lineHeight: 18,
    },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.xs,
      backgroundColor: COLORS.primary,
      borderRadius: 14,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.xl,
      width: "100%",
    },
    disabledButton: {
      opacity: 0.45,
    },
    primaryButtonText: {
      fontSize: FONTS.sizes.md,
      fontWeight: "700",
      color: COLORS.surface,
    },
    textButton: {
      alignItems: "center",
      paddingVertical: SPACING.sm,
      marginTop: SPACING.sm,
    },
    textButtonLabel: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
      fontWeight: "500",
    },
    passcodeInput: {
      width: "100%",
      backgroundColor: COLORS.surface,
      borderRadius: 12,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      fontSize: FONTS.sizes.xl,
      color: COLORS.text,
      textAlign: "center",
      letterSpacing: 8,
      marginTop: SPACING.lg,
      marginBottom: SPACING.md,
    },
    explorerLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.xs,
      marginTop: SPACING.md,
    },
    explorerLinkText: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.primary,
      fontWeight: "500",
    },
  });

export default MintScreen;
