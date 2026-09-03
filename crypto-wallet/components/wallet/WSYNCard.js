// components/wallet/WSYNCard.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const WSYN_LOGO = require("../../assets/logo.png");
import { useTheme } from "../../contexts/ThemeContext";
import { useWallet } from "../../contexts/WalletContext";
import { useChain } from "../../contexts/ChainContext";
import { getTokenBalance } from "../../utils/blockchain/Balances";
import {
  getWSYNAddress,
  isWSYNDeployed,
  SUPPORTED_WSYN_CHAIN_IDS,
} from "../../constants/wsyn";
import { SPACING, FONTS } from "../../constants/Theme";

/**
 * WSYNCard
 *
 * Displays the user's on-chain WSYN balance for the active chain.
 * Shows a "wrong network" state if the chain doesn't support WSYN.
 *
 * Props:
 *   onMintPress — called when the "Mint WSYN" button is tapped
 *   onRefreshRef — optional ref; parent can call onRefreshRef.current() to
 *                  force a balance refresh (e.g. after a successful mint)
 */
const WSYNCard = ({ onMintPress, onRefreshRef }) => {
  const { COLORS } = useTheme();
  const { wallet } = useWallet();
  const { activeChain, switchChainById } = useChain();

  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const contractAddress = getWSYNAddress(activeChain.id);
  const deployed = isWSYNDeployed(activeChain.id);
  const isOnSupportedChain = SUPPORTED_WSYN_CHAIN_IDS.includes(activeChain.id);
  const canFetch = deployed && !!wallet?.address;

  const fetchBalance = useCallback(async () => {
    if (!canFetch) {
      setBalance(null);
      return;
    }

    setLoading(true);
    setFetchError(false);

    try {
      const result = await getTokenBalance(
        contractAddress,
        wallet.address,
        activeChain,
      );
      setBalance(result.formatted);
    } catch (err) {
      console.error("[WSYNCard] balanceOf failed:", err.message);
      setFetchError(true);
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [canFetch, contractAddress, wallet?.address, activeChain]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Expose refresh to parent (e.g. after a successful mint in MintScreen)
  if (onRefreshRef) {
    onRefreshRef.current = fetchBalance;
  }

  const formatBalance = (b) => {
    const n = parseFloat(b);
    if (!b || !Number.isFinite(n)) return "0.00";
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const networkLabel =
    activeChain.id === 46630
      ? "Robinhood Testnet"
      : activeChain.id === 4663
      ? "Robinhood Chain"
      : null;

  const styles = createStyles(COLORS);

  return (
    <View style={styles.container}>
      {/* Top row — token identity + balance */}
      <View style={styles.row}>
        {/* Token icon */}
        <View style={styles.left}>
          <View style={styles.iconContainer}>
            <Image source={WSYN_LOGO} style={styles.tokenIcon} resizeMode="contain" />
          </View>

          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>TRIBE</Text>
              {networkLabel && (
                <View
                  style={[
                    styles.networkBadge,
                    !isOnSupportedChain && styles.networkBadgeWarn,
                  ]}
                >
                  <Text
                    style={[
                      styles.networkBadgeText,
                      !isOnSupportedChain && styles.networkBadgeTextWarn,
                    ]}
                  >
                    {networkLabel}
                  </Text>
                </View>
              )}
              {!isOnSupportedChain && (
                <View style={styles.networkBadgeWarn}>
                  <Text style={styles.networkBadgeTextWarn}>Wrong Network</Text>
                </View>
              )}
            </View>
            <Text style={styles.symbol}>TRIBE</Text>
          </View>
        </View>

        {/* Right side — balance or action */}
        <View style={styles.right}>
          {!wallet?.address ? (
            <Text style={styles.mutedText}>Connect wallet</Text>
          ) : !isOnSupportedChain ? (
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => switchChainById(46630)}
            >
              <Text style={styles.switchButtonText}>Switch to Robinhood</Text>
            </TouchableOpacity>
          ) : loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <View style={styles.balanceCol}>
              <Text style={styles.balance}>
                {fetchError ? "—" : formatBalance(balance)}
              </Text>
              <Text style={styles.balanceSymbol}>TRIBE</Text>
            </View>
          )}
        </View>
      </View>

      {/* Mint button — only visible when on a supported + deployed chain */}
      {wallet?.address && isOnSupportedChain && deployed && (
        <TouchableOpacity style={styles.mintButton} onPress={onMintPress}>
          <Ionicons name="flash-outline" size={15} color={COLORS.primary} />
          <Text style={styles.mintButtonText}>Mint TRIBE</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (COLORS) =>
  StyleSheet.create({
    container: {
      backgroundColor: COLORS.surface,
      borderRadius: 12,
      padding: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    left: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
      flex: 1,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: COLORS.background,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    tokenIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    info: {
      flex: 1,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    name: {
      fontSize: FONTS.sizes.md,
      fontWeight: "600",
      color: COLORS.text,
    },
    symbol: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.textSecondary,
      marginTop: 2,
    },
    networkBadge: {
      backgroundColor: COLORS.primary + "20",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    networkBadgeText: {
      fontSize: FONTS.sizes.xs,
      color: COLORS.primary,
      fontWeight: "600",
    },
    networkBadgeWarn: {
      backgroundColor: COLORS.warning + "20",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    networkBadgeTextWarn: {
      fontSize: FONTS.sizes.xs,
      color: COLORS.warning,
      fontWeight: "600",
    },
    right: {
      alignItems: "flex-end",
    },
    mutedText: {
      fontSize: FONTS.sizes.xs,
      color: COLORS.textTertiary,
    },
    balanceCol: {
      alignItems: "flex-end",
    },
    balance: {
      fontSize: FONTS.sizes.md,
      fontWeight: "600",
      color: COLORS.text,
    },
    balanceSymbol: {
      fontSize: FONTS.sizes.xs,
      color: COLORS.textSecondary,
      marginTop: 2,
    },
    switchButton: {
      backgroundColor: COLORS.primary + "15",
      borderRadius: 8,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
    },
    switchButtonText: {
      fontSize: FONTS.sizes.xs,
      color: COLORS.primary,
      fontWeight: "600",
    },
    mintButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      marginTop: SPACING.xs,
      paddingVertical: SPACING.xs,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    mintButtonText: {
      fontSize: FONTS.sizes.sm,
      color: COLORS.primary,
      fontWeight: "600",
    },
  });

export default WSYNCard;
