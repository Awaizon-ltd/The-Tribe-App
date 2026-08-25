import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Linking,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useWallet } from "../../contexts/WalletContext";
import { useTheme } from "../../contexts/ThemeContext";
import AppHeader from "../../components/common/AppHeader";
import { formatAddress } from "../../utils/Wallet";
import { getTransactionHistory } from "../../utils/blockchain";

const MAX_TRANSACTIONS = 7;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtAmount = (value) => {
  const n = parseFloat(value || 0);
  if (n === 0) return "0";
  if (n < 0.0001) return "< 0.0001";
  if (n < 1) return n.toFixed(6);
  return n.toFixed(4);
};

const fmtTime = (timestamp) => {
  if (!timestamp) return "";
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

// ─── Transaction row ──────────────────────────────────────────────────────────

const TxRow = ({ item, walletAddress, onPress, theme }) => {
  const isSent    = item.from?.toLowerCase() === walletAddress?.toLowerCase();
  const isFailed  = item.status === "failed";
  const isPending = item.status === "pending";

  const iconName  = isFailed  ? "close"
                  : isPending ? "time-outline"
                  : isSent    ? "arrow-up"
                  :             "arrow-down";

  const accentColor = isFailed  ? theme.COLORS.error
                    : isPending ? theme.COLORS.warning
                    : isSent    ? theme.COLORS.error
                    :             theme.COLORS.primary;

  const typeLabel = isFailed  ? "Failed"
                  : isPending ? "Pending"
                  : isSent    ? "Sent"
                  :             "Received";

  const time = fmtTime(item.timestamp);
  const counterparty = isSent
    ? formatAddress(item.to, 5)
    : formatAddress(item.from, 5);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      onPress={onPress}
    >
      {/* Direction / status icon */}
      <View style={[styles.iconWrap, { backgroundColor: accentColor + "18" }]}>
        <Ionicons name={iconName} size={16} color={accentColor} />
      </View>

      {/* Middle */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={[styles.typeText, { color: isFailed || isPending ? accentColor : theme.COLORS.text }]}>
            {typeLabel}
          </Text>
          {item.category === "erc20" && !isFailed && (
            <View style={[styles.badge, { backgroundColor: theme.COLORS.surface, borderColor: theme.COLORS.border }]}>
              <Text style={[styles.badgeText, { color: theme.COLORS.textSecondary }]}>Token</Text>
            </View>
          )}
          {isPending && (
            <ActivityIndicator
              size="small"
              color={theme.COLORS.warning}
              style={{ transform: [{ scale: 0.55 }] }}
            />
          )}
        </View>
        <Text style={[styles.metaText, { color: theme.COLORS.textSecondary }]} numberOfLines={1}>
          {counterparty}{time ? ` · ${time}` : ""}
        </Text>
      </View>

      {/* Amount */}
      <View style={styles.right}>
        <Text style={[styles.amountText, { color: isFailed ? theme.COLORS.textSecondary : accentColor }]}>
          {!isFailed && (isSent ? "−" : "+")}
          {fmtAmount(item.value)}
        </Text>
        <Text style={[styles.assetText, { color: theme.COLORS.textSecondary }]}>
          {item.asset}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={13} color={theme.COLORS.textTertiary ?? theme.COLORS.textSecondary} />
    </Pressable>
  );
};

// ─── Load more footer ─────────────────────────────────────────────────────────

const LoadMoreFooter = ({ explorerUrl, theme }) => (
  <Pressable
    style={({ pressed }) => [
      styles.loadMore,
      { borderColor: theme.COLORS.border, opacity: pressed ? 0.7 : 1 },
    ]}
    onPress={() => Linking.openURL(explorerUrl)}
  >
    <Text style={[styles.loadMoreText, { color: theme.COLORS.textSecondary }]}>
      View all on Explorer
    </Text>
    <Ionicons name="open-outline" size={14} color={theme.COLORS.textSecondary} />
  </Pressable>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

const TransactionsScreen = ({ navigation }) => {
  const theme = useTheme();
  const { wallet, selectedChain } = useWallet();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [refreshing, setRefreshing]     = useState(false);

  useEffect(() => {
    if (wallet?.address) loadTransactions();
  }, [wallet, selectedChain]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const history = await getTransactionHistory(
        wallet.address,
        selectedChain,
        { limit: MAX_TRANSACTIONS },
      );
      setTransactions(history);
    } catch (err) {
      console.error("[Transactions] load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const openTx = (hash) =>
    Linking.openURL(`${selectedChain.explorer}/tx/${hash}`);

  const explorerAddressUrl = `${selectedChain?.explorer}/address/${wallet?.address}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.COLORS.background }]}>
      <AppHeader
        title="Activity"
        subtitle={selectedChain.name}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      {loading && transactions.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={({ item }) => (
            <TxRow
              item={item}
              walletAddress={wallet?.address}
              onPress={() => openTx(item.hash)}
              theme={theme}
            />
          )}
          keyExtractor={(item) => item.hash}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.COLORS.primary}
            />
          }
          ListFooterComponent={
            transactions.length > 0
              ? <LoadMoreFooter explorerUrl={explorerAddressUrl} theme={theme} />
              : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <View style={[styles.emptyIconWrap, { backgroundColor: theme.COLORS.surface }]}>
                  <Ionicons name="receipt-outline" size={32} color={theme.COLORS.textSecondary} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.COLORS.text }]}>
                  No transactions yet
                </Text>
                <Text style={[styles.emptySub, { color: theme.COLORS.textSecondary }]}>
                  Your history on {selectedChain.name} will appear here
                </Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  list: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 110,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Row — no card chrome, transparent
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    flex: 1,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  typeText: {
    fontSize: 15,
    fontWeight: "700",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  metaText: {
    fontSize: 12,
  },
  right: {
    alignItems: "flex-end",
    gap: 2,
  },
  amountText: {
    fontSize: 15,
    fontWeight: "700",
  },
  assetText: {
    fontSize: 11,
    fontWeight: "500",
  },

  // Load more
  loadMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Empty state
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  emptySub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 32,
  },
});

export default TransactionsScreen;
