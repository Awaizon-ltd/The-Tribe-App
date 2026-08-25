// components/dao/DAOListHeader.js
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import ChainIcon from "../common/ChainIcon";
import { useChain } from "../../contexts/ChainContext";
import ChainSwitcher from "../wallet/ChainSwitcher";

export const DAOListHeader = ({
  totalDAOs,
  loadedDAOs,
  isSyncing,
  dataSource,
  viewMode,
  onViewModeChange,
  onCreateDAO,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { activeChain } = useChain();
  const [chainSwitcherVisible, setChainSwitcherVisible] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Title Section */}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Discover DAOs</Text>
            {isSyncing && (
              <View style={styles.syncIndicator}>
                <ActivityIndicator size="small" color={theme.COLORS.primary} />
              </View>
            )}
          </View>
          <View style={styles.subtitleRow}>
            <Text style={styles.subtitle}>
              {totalDAOs} {totalDAOs === 1 ? "community" : "communities"} •{" "}
              {loadedDAOs} loaded
            </Text>
            {dataSource && (
              <View
                style={[
                  styles.dataSourceBadge,
                  {
                    backgroundColor:
                      dataSource === "cache"
                        ? theme.COLORS.warning + "20"
                        : theme.COLORS.primary + "20",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dataSourceText,
                    {
                      color:
                        dataSource === "cache"
                          ? theme.COLORS.warning
                          : theme.COLORS.primary,
                    },
                  ]}
                >
                  {dataSource === "cache" ? "💾 Cache" : "⛓️ Live"}
                </Text>
              </View>
            )}
          </View>

          {/* Active Chain Display */}
          <View style={styles.activeChainRow}>
            <ChainIcon chain={activeChain} size={20} style={styles.chainIcon}
            />
            <Text style={styles.chainName}>{activeChain.name}</Text>
            {activeChain.testnet && (
              <View style={styles.testnetBadge}>
                <Text style={styles.testnetText}>Testnet</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === "grid" && styles.viewModeActive,
            ]}
            onPress={() => onViewModeChange("grid")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="grid-outline"
              size={18}
              color={
                viewMode === "grid"
                  ? theme.COLORS.surface
                  : theme.COLORS.textSecondary
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === "list" && styles.viewModeActive,
            ]}
            onPress={() => onViewModeChange("list")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="list-outline"
              size={18}
              color={
                viewMode === "list"
                  ? theme.COLORS.surface
                  : theme.COLORS.textSecondary
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewModeButton, styles.createButton]}
            onPress={onCreateDAO}
            activeOpacity={0.7}
          >
            <Ionicons
              name="add-outline"
              size={18}
              color={theme.COLORS.surface}
            />
          </TouchableOpacity>

          {/* ✅ Chain Switcher Button - Shows Active Blockchain Icon */}
          <TouchableOpacity
            style={[styles.viewModeButton, styles.chainSwitcherButton]}
            onPress={() => setChainSwitcherVisible(true)}
            activeOpacity={0.7}
            disabled={isSyncing}
          >
            <ChainIcon chain={activeChain} size={22} style={styles.chainButtonIcon}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chain Switcher Modal */}
      <ChainSwitcher
        visible={chainSwitcherVisible}
        onClose={() => setChainSwitcherVisible(false)}
      />
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: theme.SPACING.md - 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.border,
    },
    content: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    info: {
      flex: 1,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.SPACING.sm,
    },
    title: {
      color: theme.COLORS.text,
      fontSize: theme.FONTS.sizes.xl - 2,
      fontWeight: "700",
      letterSpacing: -0.5,
    },
    syncIndicator: {
      width: 16,
      height: 16,
    },
    subtitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.SPACING.sm,
      marginTop: theme.SPACING.xs,
      flexWrap: "wrap",
    },
    subtitle: {
      color: theme.COLORS.textSecondary,
      fontSize: theme.FONTS.sizes.xs,
      fontWeight: "500",
    },
    dataSourceBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.BORDER_RADIUS.sm,
    },
    dataSourceText: {
      fontSize: 9,
      fontWeight: "700",
    },

    // Active Chain Display
    activeChainRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.SPACING.xs,
      marginTop: theme.SPACING.sm,
    },
    chainIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    chainName: {
      color: theme.COLORS.text,
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: "600",
    },
    testnetBadge: {
      backgroundColor: theme.COLORS.warning + "30",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.BORDER_RADIUS.xs,
    },
    testnetText: {
      color: theme.COLORS.warning,
      fontSize: 8,
      fontWeight: "700",
      textTransform: "uppercase",
    },

    // Action Buttons
    actions: {
      flexDirection: "row",
      gap: theme.SPACING.sm,
    },
    viewModeButton: {
      width: 36,
      height: 36,
      borderRadius: theme.BORDER_RADIUS.md,
      backgroundColor: theme.COLORS.card,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    viewModeActive: {
      backgroundColor: theme.COLORS.primary,
      borderColor: theme.COLORS.primary,
    },
    createButton: {
      backgroundColor: theme.COLORS.info,
      borderColor: theme.COLORS.info,
    },
    chainSwitcherButton: {
      backgroundColor: theme.COLORS.surface,
      borderColor: theme.COLORS.border,
      borderWidth: 2,
    },
    // ✅ Blockchain Icon in Button
    chainButtonIcon: {
      width: 22,
      height: 22,
      borderRadius: 11,
    },
  });
