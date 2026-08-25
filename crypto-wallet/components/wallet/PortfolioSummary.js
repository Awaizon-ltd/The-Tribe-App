import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../contexts/ThemeContext";
import { useChain } from "../../contexts/ChainContext";
import { SPACING, FONTS } from "../../constants/Theme";
import { formatPriceChange } from "../../services/coingecko";

const formatNumber = (num, decimals = 2) => {
  if (num === undefined || num === null) return "0.00";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

// Mini sparkline-style bar chart (decorative)
const SparkBars = ({ isPositive, color }) => {
  const bars = [0.4, 0.6, 0.3, 0.7, 0.5, 0.8, isPositive ? 1.0 : 0.2];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 2,
        height: 20,
      }}
    >
      {bars.map((h, i) => (
        <View
          key={i}
          style={{
            width: 3,
            height: h * 20,
            borderRadius: 2,
            backgroundColor: color,
            opacity: i === bars.length - 1 ? 1 : 0.35 + i * 0.08,
          }}
        />
      ))}
    </View>
  );
};

const PortfolioSummary = ({
  totalValue,
  totalChange24h,
  loading,
  includesTestnet = false,
}) => {
  const { COLORS } = useTheme();
  const { isProduction } = useChain();
  const change = formatPriceChange(totalChange24h);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -2.5,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    float.start();
    return () => float.stop();
  }, []);

  useEffect(() => {
    if (loading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [loading]);

  const isPositive = change.isPositive;
  const trendColor = isPositive ? COLORS.success : COLORS.error;

  // Split value for styled rendering
  const formatted = formatNumber(totalValue, 2);
  const [wholePart, decimalPart] = formatted.split(".");

  const styles = StyleSheet.create({
    wrapper: {
      marginBottom: SPACING.md,
      borderRadius: 24,
      overflow: "hidden",
      // Subtle elevation
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 6,
    },
    gradient: {
      borderRadius: 24,
    },
    inner: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.lg,
    },

    // ── Top row ──────────────────────────────────────────────
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: SPACING.sm,
    },
    label: {
      fontSize: FONTS.sizes.xs,
      color: COLORS.textSecondary,
      fontWeight: "600",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    networkPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: COLORS.primary + "18",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    networkDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: COLORS.primary,
    },
    networkText: {
      fontSize: 10,
      color: COLORS.primary,
      fontWeight: "800",
      letterSpacing: 0.8,
    },

    // ── Value display ─────────────────────────────────────────
    valueRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 2,
      marginBottom: 2,
    },
    dollarSign: {
      fontSize: 20,
      fontWeight: "700",
      color: COLORS.textSecondary,
      marginBottom: 7,
      marginRight: 2,
    },
    value: {
      fontSize: 44,
      fontWeight: "800",
      color: COLORS.text,
      letterSpacing: -2,
      lineHeight: 50,
    },
    valueCents: {
      fontSize: 20,
      fontWeight: "700",
      color: COLORS.textSecondary,
      marginBottom: 7,
    },
    loadingBlock: {
      height: 50,
      width: 200,
      backgroundColor: COLORS.surface || COLORS.card,
      borderRadius: 14,
      marginBottom: 4,
    },

    // ── Testnet badge ─────────────────────────────────────────
    testnetBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: (COLORS.warning || "#F59E0B") + "20",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      gap: 4,
      marginTop: SPACING.xs,
      alignSelf: "flex-start",
    },
    testnetText: {
      fontSize: 10,
      color: COLORS.warning || "#F59E0B",
      fontWeight: "700",
      letterSpacing: 0.3,
    },

    // ── Stats row ─────────────────────────────────────────────
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: SPACING.md,
      paddingTop: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.text + "12",
    },
    changeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: trendColor + "15",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    changeText: {
      fontSize: FONTS.sizes.sm,
      fontWeight: "700",
      color: trendColor,
    },
    sparkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    periodLabel: {
      fontSize: 10,
      color: COLORS.textSecondary,
      fontWeight: "600",
      letterSpacing: 0.5,
    },
    separator: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: COLORS.textSecondary,
      opacity: 0.3,
    },
  });

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={[
          (COLORS.surface || COLORS.card) + "FF",
          COLORS.background + "FF",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.inner}>
          {/* Top row */}
          <View style={styles.topRow}>
            <Text style={styles.label}>Portfolio</Text>
            <View style={styles.networkPill}>
              <View style={styles.networkDot} />
              <Text style={styles.networkText}>
                {isProduction ? "MAINNET" : "DEVNET"}
              </Text>
            </View>
          </View>

          {/* Value */}
          {loading ? (
            <Animated.View
              style={[styles.loadingBlock, { opacity: pulseAnim }]}
            />
          ) : (
            <Animated.View
              style={[
                styles.valueRow,
                { transform: [{ translateY: floatAnim }] },
              ]}
            >
              <Text style={styles.dollarSign}>$</Text>
              <Text style={styles.value}>{wholePart}</Text>
              <Text style={styles.valueCents}>.{decimalPart}</Text>
            </Animated.View>
          )}

          {/* Testnet badge */}
          {!isProduction && includesTestnet && (
            <View style={styles.testnetBadge}>
              <Ionicons
                name="flask"
                size={10}
                color={COLORS.warning || "#F59E0B"}
              />
              <Text style={styles.testnetText}>Testnet included</Text>
            </View>
          )}

          {/* Stats / trend row */}
          {!loading &&
            totalChange24h !== undefined &&
            totalChange24h !== null && (
              <View style={styles.statsRow}>
                <View style={styles.changeChip}>
                  <Ionicons
                    name={isPositive ? "arrow-up" : "arrow-down"}
                    size={12}
                    color={trendColor}
                  />
                  <Text style={styles.changeText}>{change.text}</Text>
                </View>

                <View style={styles.sparkRow}>
                  <SparkBars isPositive={isPositive} color={trendColor} />
                  <View style={styles.separator} />
                  <Text style={styles.periodLabel}>24H</Text>
                </View>
              </View>
            )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

export default PortfolioSummary;
