// components/swap/AssetCard.js
// One merged chain+token input card — used for both the "You Pay" and
// "You Receive" sides of the swap/bridge screen. Replaces the old split
// UI (a separate route-row chain badge above the widget + a token-only
// chip inside each card) with one tappable chip per side that opens one
// picker for both chain and token.
import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Image, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ChainIcon from "../common/ChainIcon";

// ─── TokenLogo ──────────────────────────────────────────────────────────────
// Moved here from SwapNewSCreen.js — only used inside this card now.
export const TokenLogo = ({ logoURI, symbol, size = 28, theme }) => {
  const [imgError, setImgError] = useState(false);
  const { COLORS } = theme;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        image: { width: size, height: size, borderRadius: size / 2 },
        fallback: {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS.primaryMuted,
          alignItems: "center",
          justifyContent: "center",
        },
        fallbackText: { fontSize: size * 0.4, fontWeight: "800", color: COLORS.primaryDark },
      }),
    [size, COLORS],
  );

  if (logoURI && !imgError) {
    return (
      <Image
        source={typeof logoURI === "string" ? { uri: logoURI } : logoURI}
        style={styles.image}
        onError={() => setImgError(true)}
        fadeDuration={0}
      />
    );
  }
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>{symbol?.charAt(0) ?? "?"}</Text>
    </View>
  );
};

const AssetCard = ({
  label,
  chain,
  token,
  amount,
  isEstimate = false,
  isFetchingEstimate = false,
  isLoadingToken = false,
  balanceLabel, // pre-formatted "Bal 1.23 ETH" — only rendered when passed
  usdLabel,
  onPressChip,
  onPressAmount, // omit for the read-only "to" side
  showCursor = false,
  cursorAnim,
  numpadOpen = false,
  side, // 'from' | 'to' — controls the extra padding the bridge button notches into
  theme,
}) => {
  const { COLORS, SPACING, FONTS, BORDER_RADIUS, SHADOWS } = theme;
  const accentColor = COLORS.primary;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: COLORS.surface,
          borderRadius: BORDER_RADIUS.xl,
          paddingHorizontal: 14,
          paddingTop: 8,
          paddingBottom: 8,
        },
        row: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        },
        label: {
          fontSize: FONTS.sizes.xs,
          fontWeight: "700",
          color: COLORS.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 0.9,
        },
        chip: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: COLORS.card,
          borderRadius: 24,
          paddingVertical: 6,
          paddingHorizontal: 10,
          paddingLeft: 6,
          gap: 6,
          ...SHADOWS.small,
        },
        iconStack: { width: 26, height: 26 },
        chainBadge: {
          position: "absolute",
          right: -3,
          bottom: -3,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: COLORS.card,
          overflow: "hidden",
        },
        chipText: { fontSize: FONTS.sizes.sm, fontWeight: "800", color: COLORS.text },
        chipSelect: { fontSize: FONTS.sizes.sm, fontWeight: "800", color: accentColor },
        chainSub: { fontSize: 10, color: COLORS.textTertiary, marginTop: 1 },
        amountBig: {
          fontSize: 34,
          fontWeight: "800",
          color: isEstimate ? COLORS.textSecondary : COLORS.text,
          letterSpacing: -1,
          includeFontPadding: false,
          marginBottom: 1,
        },
        amountUsd: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },
        fetchingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
        fetchingText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
        balanceLine: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: SPACING.xs },
      }),
    [theme, isEstimate],
  );

  const AmountArea = (
    <>
      {isFetchingEstimate ? (
        <View style={styles.fetchingRow}>
          <ActivityIndicator size="small" color={accentColor} />
          <Text style={styles.fetchingText}>Fetching best price…</Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.amountBig} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.35}>
            {amount || "0"}
          </Text>
          {showCursor && (
            <Animated.Text style={[styles.amountBig, { opacity: cursorAnim, marginLeft: 2 }]}>|</Animated.Text>
          )}
        </View>
      )}
      {usdLabel ? <Text style={styles.amountUsd}>{usdLabel}</Text> : null}
      {balanceLabel ? <Text style={styles.balanceLine}>{balanceLabel}</Text> : null}
    </>
  );

  // The bridge/flip button sits at the join of both cards (negative margin
  // overlap on the screen's bridgeRow) — this asymmetric padding is what
  // carves out room for it instead of the button covering card content.
  const sidePadding = side === "from" ? { paddingBottom: 20 } : side === "to" ? { paddingTop: 20 } : null;

  return (
    <View style={[styles.card, sidePadding, numpadOpen && { borderWidth: 1, borderColor: accentColor }]}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity style={styles.chip} onPress={onPressChip} activeOpacity={0.75}>
          {isLoadingToken ? (
            <>
              <ActivityIndicator size={14} color={accentColor} />
              <Text style={styles.chipSelect}>Loading…</Text>
            </>
          ) : token ? (
            <>
              <View style={styles.iconStack}>
                <TokenLogo logoURI={token.logoURI} symbol={token.symbol} size={26} theme={theme} />
                <View style={styles.chainBadge}>
                  <ChainIcon chain={chain} size={13} />
                </View>
              </View>
              <View>
                <Text style={styles.chipText}>{token.symbol}</Text>
                <Text style={styles.chainSub} numberOfLines={1}>{chain?.name}</Text>
              </View>
            </>
          ) : (
            <>
              <ChainIcon chain={chain} size={20} />
              <Text style={styles.chipSelect}>Select</Text>
            </>
          )}
          <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {onPressAmount ? (
        <TouchableOpacity onPress={onPressAmount} activeOpacity={0.7}>
          {AmountArea}
        </TouchableOpacity>
      ) : (
        <View>{AmountArea}</View>
      )}
    </View>
  );
};

export default AssetCard;
