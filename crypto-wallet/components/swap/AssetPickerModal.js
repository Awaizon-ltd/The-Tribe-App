// components/swap/AssetPickerModal.js
// One merged chain+token picker, replacing the old pair of separate modals
// (BridgeChainPicker for chain, TokenSelectorModal for token). A horizontal
// chain-chip row sits above a token list.
//
// Cross-chain (bridge) swaps are native-token-only, so picking a chain that
// would leave the pair on two different chains commits that chain's native
// token immediately and closes — there's only ever one valid choice, so
// showing a one-item list would just be an extra tap. Picking a chain that
// keeps both sides on the same chain (the only case `sameChainTokens` is
// actually loaded for — see `activeChainId` below) reveals the full list.
import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import ChainIcon from "../common/ChainIcon";

const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const NATIVE_SENTINEL = NATIVE_TOKEN_ADDRESS.toLowerCase();

export const buildNativeToken = (chain) => ({
  name: chain.nativeTokenName ?? "Ether",
  symbol: chain.symbol,
  address: NATIVE_TOKEN_ADDRESS,
  decimals: 18,
  isNative: true,
  logoURI: chain.icon,
  chainId: chain.id,
});

// ─── Multi-source logo fallback (moved from TokenSelectorModal.js) ──────────
const buildLogoSources = (logoURI, address, symbol) => {
  const sources = [];
  if (logoURI && typeof logoURI !== "string") return [logoURI];
  if (logoURI) {
    sources.push(logoURI);
    if (logoURI.endsWith(".svg")) sources.push(logoURI.replace(".svg", ".png"));
  }
  if (address && address.toLowerCase() !== NATIVE_SENTINEL) {
    const addrLower = address.toLowerCase();
    sources.push(`https://tokens.1inch.io/${addrLower}.png`);
    sources.push(
      `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${address}/logo.png`,
    );
    if (symbol) sources.push(`https://ethereum-optimism.github.io/data/${symbol}/logo.png`);
  }
  return sources;
};

const TokenIcon = memo(({ logoURI, address, symbol, size = 44, theme }) => {
  const { COLORS } = theme;
  const sources = useMemo(() => buildLogoSources(logoURI, address, symbol), [logoURI, address, symbol]);
  const [srcIndex, setSrcIndex] = useState(0);

  useEffect(() => { setSrcIndex(0); }, [logoURI, address]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        image: { width: size, height: size },
        fallback: {
          width: size, height: size,
          backgroundColor: COLORS.primaryMuted,
          alignItems: "center", justifyContent: "center",
        },
        fallbackText: { fontSize: size * 0.38, fontWeight: "800", color: COLORS.primaryDark },
      }),
    [size, COLORS],
  );

  const currentSrc = sources[srcIndex];
  if (currentSrc) {
    return (
      <Image
        source={typeof currentSrc === "string" ? { uri: currentSrc } : currentSrc}
        style={styles.image}
        onError={() => setSrcIndex((i) => i + 1)}
        fadeDuration={150}
      />
    );
  }
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>{symbol?.charAt(0) ?? "?"}</Text>
    </View>
  );
});

const TokenItem = memo(({ token, onSelect, isSelected, theme }) => {
  const styles = createStyles(theme);
  const { COLORS } = theme;
  return (
    <TouchableOpacity
      style={[styles.tokenItem, isSelected && styles.tokenItemSelected]}
      onPress={() => onSelect(token)}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrap}>
        <TokenIcon logoURI={token.logoURI} address={token.address} symbol={token.symbol} size={40} theme={theme} />
      </View>
      <View style={styles.tokenInfo}>
        <Text style={styles.tokenSymbol}>{token.symbol}</Text>
        <Text style={styles.tokenName} numberOfLines={1}>{token.name}</Text>
      </View>
      {isSelected && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
    </TouchableOpacity>
  );
});

const ChainChip = memo(({ chain, isSelected, onPress, theme }) => {
  const styles = createStyles(theme);
  return (
    <TouchableOpacity
      style={[styles.chainChip, isSelected && styles.chainChipSelected]}
      onPress={() => onPress(chain)}
      activeOpacity={0.75}
    >
      <ChainIcon chain={chain} size={22} />
      <Text style={[styles.chainChipText, isSelected && styles.chainChipTextSelected]} numberOfLines={1}>
        {chain.name}
      </Text>
    </TouchableOpacity>
  );
});

// ─── AssetPickerModal ─────────────────────────────────────────────────────
const AssetPickerModal = ({
  visible,
  onClose,
  chains = [],
  currentChain,
  activeChainId, // the one chain `sameChainTokens` is actually loaded for
  otherSideChainId, // the fixed side's chain — full list only shows when both sides agree
  sameChainTokens = [],
  loadingSameChainTokens = false,
  selectedToken = null,
  excludeToken = null,
  onCommit, // (chain, token) => void
  title = "Select asset",
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { COLORS } = theme;

  const [pendingChain, setPendingChain] = useState(currentChain);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (visible) {
      setPendingChain(currentChain);
      setSearchQuery("");
    }
  }, [visible, currentChain?.id]);

  const showFullList =
    !!pendingChain &&
    pendingChain.id === activeChainId &&
    otherSideChainId === activeChainId;

  const handleChainPress = useCallback(
    (chain) => {
      const willShowList = chain.id === activeChainId && otherSideChainId === activeChainId;
      if (willShowList) {
        setPendingChain(chain);
        return;
      }
      onCommit(chain, buildNativeToken(chain));
      onClose();
    },
    [activeChainId, otherSideChainId, onCommit, onClose],
  );

  const handleTokenPress = useCallback(
    (token) => {
      onCommit(pendingChain, token);
      onClose();
    },
    [pendingChain, onCommit, onClose],
  );

  const filteredTokens = useMemo(() => {
    const available = sameChainTokens.filter((t) => t.address !== excludeToken?.address);
    const q = searchQuery.toLowerCase().trim();
    if (!q) return available;
    return available.filter(
      (t) =>
        t.symbol?.toLowerCase().includes(q) ||
        t.name?.toLowerCase().includes(q) ||
        t.address?.toLowerCase().includes(q),
    );
  }, [sameChainTokens, excludeToken, searchQuery]);

  const renderToken = useCallback(
    ({ item }) => (
      <TokenItem token={item} onSelect={handleTokenPress} isSelected={selectedToken?.address === item.address} theme={theme} />
    ),
    [handleTokenPress, selectedToken, theme],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Chain row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chainRow}
        >
          {chains.map((chain) => (
            <ChainChip
              key={chain.id}
              chain={chain}
              isSelected={pendingChain?.id === chain.id}
              onPress={handleChainPress}
              theme={theme}
            />
          ))}
        </ScrollView>

        {showFullList ? (
          <>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={17} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search name, symbol, or address..."
                placeholderTextColor={COLORS.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={17} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {loadingSameChainTokens ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Loading tokens…</Text>
              </View>
            ) : (
              <FlatList
                data={filteredTokens}
                keyExtractor={(item) => item.address}
                renderItem={renderToken}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={10}
                removeClippedSubviews
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No tokens found</Text>
                  </View>
                }
              />
            )}
          </>
        ) : (
          <View style={styles.nativeOnlyNote}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.textTertiary} />
            <Text style={styles.nativeOnlyText}>
              Bridging supports each chain's native token — pick a chain above to continue.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────
const createStyles = (theme) => {
  const { COLORS, SPACING, FONTS, BORDER_RADIUS, SHADOWS } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: SPACING.lg, paddingTop: 56, paddingBottom: SPACING.sm,
    },
    headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: "700", color: COLORS.text },
    closeBtn: {
      padding: SPACING.xs, borderRadius: BORDER_RADIUS.md,
      backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    },

    chainRow: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: 8 },
    chainChip: {
      flexDirection: "row", alignItems: "center", gap: 7,
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: BORDER_RADIUS.round,
      backgroundColor: COLORS.surface,
      borderWidth: 1, borderColor: COLORS.border,
      maxWidth: 150,
    },
    chainChipSelected: { backgroundColor: `${COLORS.primary}18`, borderColor: COLORS.primary },
    chainChipText: { fontSize: FONTS.sizes.sm, fontWeight: "600", color: COLORS.text },
    chainChipTextSelected: { color: COLORS.primary, fontWeight: "800" },

    searchContainer: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg,
      marginHorizontal: SPACING.md, marginTop: SPACING.sm, marginBottom: SPACING.xs,
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2,
      borderWidth: 1, borderColor: COLORS.border,
      ...SHADOWS.small,
    },
    searchInput: { flex: 1, fontSize: FONTS.sizes.md, color: COLORS.text, padding: 0 },

    listContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxxl },
    tokenItem: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: SPACING.sm + 2, paddingHorizontal: SPACING.sm,
      borderRadius: BORDER_RADIUS.lg,
    },
    tokenItemSelected: { backgroundColor: COLORS.primaryMuted },
    iconWrap: {
      width: 40, height: 40, borderRadius: 20, marginRight: SPACING.md,
      overflow: "hidden", backgroundColor: COLORS.surface,
      borderWidth: 1, borderColor: COLORS.border,
    },
    tokenInfo: { flex: 1 },
    tokenSymbol: { fontSize: FONTS.sizes.base, fontWeight: "700", color: COLORS.text, marginBottom: 2 },
    tokenName: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
    separator: { height: 1, backgroundColor: COLORS.divider, marginLeft: 40 + SPACING.md },

    emptyContainer: { alignItems: "center", paddingTop: SPACING.xxxl, paddingHorizontal: SPACING.xl },
    emptyText: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },

    nativeOnlyNote: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      marginHorizontal: SPACING.lg, marginTop: SPACING.lg,
      padding: SPACING.md, borderRadius: BORDER_RADIUS.lg,
      backgroundColor: COLORS.surface,
    },
    nativeOnlyText: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 18 },
  });
};

export default AssetPickerModal;
