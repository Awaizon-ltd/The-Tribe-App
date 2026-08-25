import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { isAddress } from "ethers";

const TokenSelectorModal = ({
  visible,
  onClose,
  onSelectToken,
  chainId,
  tokenList = [],
  selectedTokenAddress,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [searchQuery, setSearchQuery] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAddress, setCustomAddress] = useState("");

  // Filter tokens based on search
  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) return tokenList;

    const query = searchQuery.toLowerCase();
    return tokenList.filter(
      (token) =>
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query) ||
        token.address.toLowerCase().includes(query),
    );
  }, [tokenList, searchQuery]);

  const handleSelectToken = (token) => {
    onSelectToken(token);
    setSearchQuery("");
    setShowCustomInput(false);
    setCustomAddress("");
    onClose();
  };

  const handleCustomToken = () => {
    if (!customAddress.trim()) {
      return;
    }

    if (!isAddress(customAddress)) {
      // Invalid address - could show error here
      return;
    }

    // Return custom token object
    onSelectToken({
      address: customAddress.trim(),
      isCustom: true,
      chainId,
    });

    setCustomAddress("");
    setShowCustomInput(false);
    setSearchQuery("");
    onClose();
  };

  const handleClose = () => {
    setSearchQuery("");
    setShowCustomInput(false);
    setCustomAddress("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Token</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color={theme.COLORS.textTertiary}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or symbol"
              placeholderTextColor={theme.COLORS.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={theme.COLORS.textTertiary}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Custom Token Toggle */}
          <TouchableOpacity
            style={styles.customToggle}
            onPress={() => setShowCustomInput(!showCustomInput)}
          >
            <Ionicons
              name={showCustomInput ? "contract" : "add-circle-outline"}
              size={20}
              color={theme.COLORS.primary}
            />
            <Text style={styles.customToggleText}>
              {showCustomInput
                ? "Hide Custom Token"
                : "Use Custom Token Address"}
            </Text>
          </TouchableOpacity>

          {/* Custom Token Input */}
          {showCustomInput && (
            <View style={styles.customInputContainer}>
              <Text style={styles.customInputLabel}>Custom Token Address</Text>
              <View style={styles.customInputWrapper}>
                <TextInput
                  style={styles.customInput}
                  placeholder="0x..."
                  placeholderTextColor={theme.COLORS.textTertiary}
                  value={customAddress}
                  onChangeText={setCustomAddress}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[
                    styles.customSubmitButton,
                    (!customAddress || !isAddress(customAddress)) &&
                      styles.customSubmitButtonDisabled,
                  ]}
                  onPress={handleCustomToken}
                  disabled={!customAddress || !isAddress(customAddress)}
                >
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={theme.COLORS.surface}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.customInputHelper}>
                Enter the contract address of your ERC-20 token
              </Text>
            </View>
          )}

          {/* Token List */}
          <ScrollView
            style={styles.tokenList}
            showsVerticalScrollIndicator={false}
          >
            {filteredTokens.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="search-outline"
                  size={48}
                  color={theme.COLORS.textTertiary}
                />
                <Text style={styles.emptyStateText}>
                  {searchQuery
                    ? "No tokens found"
                    : "No tokens available for this chain"}
                </Text>
                {searchQuery && (
                  <Text style={styles.emptyStateSubtext}>
                    Try using a custom token address instead
                  </Text>
                )}
              </View>
            ) : (
              filteredTokens.map((token, index) => (
                <TouchableOpacity
                  key={`${token.address}-${index}`}
                  style={[
                    styles.tokenItem,
                    selectedTokenAddress?.toLowerCase() ===
                      token.address.toLowerCase() && styles.tokenItemSelected,
                  ]}
                  onPress={() => handleSelectToken(token)}
                  activeOpacity={0.7}
                >
                  <View style={styles.tokenItemLeft}>
                    {token.logoURI ? (
                      <Image
                        source={{ uri: token.logoURI }}
                        style={styles.tokenLogo}
                        defaultSource={require("../../assets/favicon.png")}
                      />
                    ) : (
                      <View style={styles.tokenLogoPlaceholder}>
                        <Ionicons
                          name="help"
                          size={20}
                          color={theme.COLORS.textTertiary}
                        />
                      </View>
                    )}

                    <View style={styles.tokenInfo}>
                      <View style={styles.tokenNameRow}>
                        <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                        {selectedTokenAddress?.toLowerCase() ===
                          token.address.toLowerCase() && (
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={theme.COLORS.primary}
                          />
                        )}
                      </View>
                      <Text style={styles.tokenName} numberOfLines={1}>
                        {token.name}
                      </Text>
                    </View>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.COLORS.textTertiary}
                  />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Footer Info */}
          <View style={styles.modalFooter}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={theme.COLORS.textTertiary}
            />
            <Text style={styles.modalFooterText}>
              Only ERC-20 tokens on{" "}
              {chainId ? `Chain ${chainId}` : "this chain"} are supported
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "flex-end",
    },
    modalContainer: {
      backgroundColor: theme.COLORS.background,
      borderTopLeftRadius: theme.BORDER_RADIUS.xl,
      borderTopRightRadius: theme.BORDER_RADIUS.xl,
      height: "95%",
      paddingTop: theme.SPACING.md,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.SPACING.lg,
      paddingBottom: theme.SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.border,
    },
    modalTitle: {
      fontSize: theme.FONTS.sizes.xl,
      fontWeight: "bold",
      color: theme.COLORS.text,
    },
    closeButton: {
      padding: theme.SPACING.xs,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.COLORS.surface,
      borderRadius: theme.BORDER_RADIUS.lg,
      paddingHorizontal: theme.SPACING.md,
      marginHorizontal: theme.SPACING.lg,
      marginTop: theme.SPACING.md,
      height: 48,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    searchInput: {
      flex: 1,
      marginLeft: theme.SPACING.sm,
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.text,
    },
    customToggle: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.SPACING.lg,
      paddingVertical: theme.SPACING.md,
      gap: theme.SPACING.sm,
    },
    customToggleText: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: "600",
      color: theme.COLORS.primary,
    },
    customInputContainer: {
      paddingHorizontal: theme.SPACING.lg,
      paddingBottom: theme.SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.border,
    },
    customInputLabel: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: "600",
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.sm,
    },
    customInputWrapper: {
      flexDirection: "row",
      gap: theme.SPACING.sm,
    },
    customInput: {
      flex: 1,
      backgroundColor: theme.COLORS.surface,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
      borderRadius: theme.BORDER_RADIUS.md,
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
      height: 44,
    },
    customSubmitButton: {
      backgroundColor: theme.COLORS.primary,
      borderRadius: theme.BORDER_RADIUS.md,
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    customSubmitButtonDisabled: {
      opacity: 0.5,
    },
    customInputHelper: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textTertiary,
      marginTop: theme.SPACING.xs,
    },
    tokenList: {
      flex: 1,
      paddingHorizontal: theme.SPACING.lg,
      paddingTop: theme.SPACING.md,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.SPACING.xxl * 2,
    },
    emptyStateText: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      marginTop: theme.SPACING.md,
      textAlign: "center",
    },
    emptyStateSubtext: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textTertiary,
      marginTop: theme.SPACING.xs,
      textAlign: "center",
    },
    tokenItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.SPACING.md,
      backgroundColor: theme.COLORS.surface,
      borderRadius: theme.BORDER_RADIUS.lg,
      marginBottom: theme.SPACING.sm,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    tokenItemSelected: {
      borderColor: theme.COLORS.primary,
      backgroundColor: `${theme.COLORS.primary}10`,
    },
    tokenItemLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    tokenLogo: {
      width: 40,
      height: 40,
      borderRadius: theme.BORDER_RADIUS.round,
      marginRight: theme.SPACING.md,
    },
    tokenLogoPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: theme.BORDER_RADIUS.round,
      backgroundColor: theme.COLORS.border,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.SPACING.md,
    },
    tokenInfo: {
      flex: 1,
    },
    tokenNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.SPACING.xs,
    },
    tokenSymbol: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: "600",
      color: theme.COLORS.text,
    },
    tokenName: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      marginTop: 2,
    },
    modalFooter: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.SPACING.lg,
      paddingVertical: theme.SPACING.md,
      borderTopWidth: 1,
      borderTopColor: theme.COLORS.border,
      gap: theme.SPACING.xs,
    },
    modalFooterText: {
      flex: 1,
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textTertiary,
    },
  });

export default TokenSelectorModal;
