// components/dao/details/StatStrip.js
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../contexts/ThemeContext";

const StatCard = ({ icon, label, value, COLORS, FONTS, loading }) => (
  <View style={[styles.card, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
    <Ionicons name={icon} size={16} color={COLORS.textSecondary} style={{ marginBottom: 6 }} />
    {loading ? (
      <ActivityIndicator size="small" color={COLORS.text} />
    ) : (
      <Text style={[styles.value, { color: COLORS.text, fontSize: FONTS.sizes.lg }]} numberOfLines={1}>
        {value}
      </Text>
    )}
    <Text style={[styles.label, { color: COLORS.textTertiary, fontSize: FONTS.sizes.xs }]}>
      {label}
    </Text>
  </View>
);

export const StatStrip = ({ totalProposals, activeProposals, getTreasuryBalance, isSyncing }) => {
  const { COLORS, FONTS } = useTheme();
  const [treasury, setTreasury] = useState(null);
  const [loadingTreasury, setLoadingTreasury] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchTreasury = async () => {
      if (typeof getTreasuryBalance !== "function") {
        // Not a function — just a plain value, use it directly, no fetch loop.
        if (!cancelled) {
          setTreasury(getTreasuryBalance ?? "—");
          setLoadingTreasury(false);
        }
        return;
      }
      try {
        const result = await getTreasuryBalance();
        if (!cancelled) setTreasury(result);
      } catch (e) {
        if (!cancelled) setTreasury("—");
      } finally {
        if (!cancelled) setLoadingTreasury(false);
      }
    };

    fetchTreasury();
    return () => { cancelled = true; };
    // Only re-fetch if the function/value identity actually changes —
    // NOT on every render.
  }, [getTreasuryBalance]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.strip, { borderBottomColor: COLORS.divider }]}
    >
      <StatCard
        icon="wallet-outline"
        label="Treasury"
        value={treasury ?? "—"}
        COLORS={COLORS}
        FONTS={FONTS}
        loading={loadingTreasury}
      />
      <StatCard
        icon="document-text-outline"
        label="Total Proposals"
        value={totalProposals ?? 0}
        COLORS={COLORS}
        FONTS={FONTS}
      />
      <StatCard
        icon="flash-outline"
        label="Active Now"
        value={activeProposals ?? 0}
        COLORS={COLORS}
        FONTS={FONTS}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  card: {
    minWidth: 108,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  value: { fontWeight: "700" },
  label: { marginTop: 1, textTransform: "uppercase", letterSpacing: 0.5 },
});