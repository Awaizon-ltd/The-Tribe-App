// components/swap/CrossChainConfirmModal.js
// Confirm/execute flow for a LI.FI cross-chain quote from useCrossChainSwap.
// Mirrors SwapConfirmModal.js's PIN → review → approve → send → done state
// machine, adapted for two chains: the signer is built for `fromChain`
// (which may differ from the wallet's active chain — see WalletContext's
// createSignerForTransaction chainOverride, added for Community mode's
// "fund in from another chain" flow), and completion is a status poll on
// the destination chain rather than a single receipt wait.
import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Contract, MaxUint256, formatUnits } from "ethers";
import { useTheme } from "../../contexts/ThemeContext";
import { useWallet } from "../../contexts/WalletContext";

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const STEPS = {
  PIN: "pin",
  REVIEW: "review",
  APPROVING: "approving",
  BRIDGING: "bridging", // source tx sent, waiting on destination-chain settlement
  SUCCESS: "success",
  ERROR: "error",
};

const parseCrossChainError = (err) => {
  const code = err?.code ?? "";
  const message = (err?.reason ?? err?.message ?? "").toLowerCase();

  if (code === "ACTION_REJECTED" || message.includes("user rejected") || message.includes("user denied")) {
    return { title: "Transaction Cancelled", message: "You cancelled the transaction. No funds were moved.", icon: "close-circle-outline", canRetry: true };
  }
  if (code === "INSUFFICIENT_FUNDS" || message.includes("insufficient funds")) {
    return { title: "Not Enough Balance", message: "Your wallet doesn't have enough funds on the source chain to cover this transfer and gas.", icon: "wallet-outline", canRetry: false };
  }
  if (message.includes("timed out waiting for bridge")) {
    return { title: "Still Bridging", message: err.message, icon: "time-outline", canRetry: false };
  }
  if (message.includes("no route") || message.includes("insufficient liquidity")) {
    return { title: "No Route Available", message: "LI.FI couldn't find a route for this pair right now. Try a different token, amount, or chain.", icon: "git-network-outline", canRetry: false };
  }
  if (code === "NETWORK_ERROR" || message.includes("network") || message.includes("timeout")) {
    return { title: "Connection Problem", message: "Lost connection to the network. Check your internet and try again.", icon: "wifi-outline", canRetry: true };
  }
  return { title: "Bridge Failed", message: err?.reason ?? err?.message ?? "Something went wrong. Please try again.", icon: "alert-circle-outline", canRetry: true };
};

// ─── PIN Pad ──────────────────────────────────────────────────────────────────
const PinPad = ({ theme, onComplete, onCancel, error: externalError }) => {
  const styles = createStyles(theme);
  const { COLORS } = theme;
  const [pin, setPin] = useState("");
  const [shakeAnim] = useState(new Animated.Value(0));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const PIN_LENGTH = 6;

  useEffect(() => {
    if (externalError) {
      setPin("");
      setIsSubmitting(false);
      Vibration.vibrate([0, 80, 40, 80]);
      Animated.sequence(
        [8, -8, 8, -8, 0].map((toValue) => Animated.timing(shakeAnim, { toValue, duration: 50, useNativeDriver: true })),
      ).start();
    }
  }, [externalError]);

  useEffect(() => {
    if (pin.length === PIN_LENGTH && !isSubmitting) {
      setIsSubmitting(true);
      setTimeout(() => onComplete(pin), 100);
    }
  }, [pin]);

  const handlePress = (digit) => {
    if (pin.length < PIN_LENGTH && !isSubmitting) { setPin((p) => p + digit); Vibration.vibrate(8); }
  };
  const handleBack = () => {
    if (pin.length > 0 && !isSubmitting) { setPin((p) => p.slice(0, -1)); Vibration.vibrate(8); }
  };

  const keys = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","⌫"]];

  return (
    <View style={styles.pinScreen}>
      <TouchableOpacity onPress={onCancel} style={styles.pinCloseBtn}>
        <Ionicons name="close" size={22} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.pinTitle}>Enter Passcode</Text>
      <Text style={styles.pinSubtitle}>Confirm your identity to authorise this transfer</Text>
      <View style={styles.pinErrorRow}>
        {externalError ? (
          <View style={styles.pinErrorBadge}>
            <Ionicons name="alert-circle" size={14} color={COLORS.error} />
            <Text style={styles.pinErrorText}>Wrong passcode — try again</Text>
          </View>
        ) : null}
      </View>
      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled]} />
        ))}
      </Animated.View>
      <View style={styles.keypad}>
        {keys.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((k, ki) => {
              if (!k) return <View key={ki} style={styles.keyBtn} />;
              return (
                <TouchableOpacity key={ki} style={styles.keyBtn} onPress={k === "⌫" ? handleBack : () => handlePress(k)} disabled={isSubmitting} activeOpacity={0.65}>
                  {k === "⌫" ? <Ionicons name="backspace-outline" size={22} color={COLORS.text} /> : <Text style={styles.keyText}>{k}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── CrossChainConfirmModal ────────────────────────────────────────────────────
// crossChainSwap: the object returned by useCrossChainSwap()
export const CrossChainConfirmModal = ({ visible, onClose, onSuccess, onError, crossChainSwap }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { COLORS } = theme;
  const { createSignerForTransaction, address } = useWallet();

  const { fromChain, toChain, fromToken, toToken, fromAmount, quote, pollStatus } = crossChainSwap;

  const [step, setStep] = useState(STEPS.PIN);
  const [pinError, setPinError] = useState("");
  const [signer, setSigner] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const [progressLabel, setProgressLabel] = useState("");

  useEffect(() => {
    if (visible) {
      setStep(STEPS.PIN);
      setPinError("");
      setSigner(null);
      setTxHash(null);
      setErrorInfo(null);
      setProgressLabel("");
    }
  }, [visible]);

  const handlePinComplete = async (passcode) => {
    try {
      setPinError("");
      // Sign against fromChain, not necessarily the wallet's active chain —
      // this is what makes Community mode's "fund in from another chain"
      // work while activeChain stays pinned to Robinhood Chain.
      const walletSigner = await createSignerForTransaction(passcode, fromChain);
      setSigner(walletSigner);
      setStep(STEPS.REVIEW);
    } catch {
      setPinError("wrong_pin");
    }
  };

  const handleConfirm = async () => {
    if (!signer || !quote) return;
    try {
      const approvalAddress = quote?.estimate?.approvalAddress;
      const needsApproval = !fromToken?.isNative && approvalAddress && approvalAddress !== ZERO_ADDRESS;

      if (needsApproval) {
        setStep(STEPS.APPROVING);
        setProgressLabel(`Approving ${fromToken.symbol} for bridging…`);

        const readContract = new Contract(fromToken.address, ERC20_ABI, signer.provider);
        const allowance = await readContract.allowance(address, approvalAddress);
        const requiredAmount = BigInt(quote.action?.fromAmount ?? quote.estimate?.fromAmount ?? "0");

        if (BigInt(allowance) < requiredAmount) {
          const approveTx = await new Contract(fromToken.address, ERC20_ABI, signer).approve(approvalAddress, MaxUint256);
          setProgressLabel("Waiting for approval to confirm on-chain…");
          await approveTx.wait();
          setProgressLabel(`${fromToken.symbol} approved ✓`);
        }
      }

      // ── Send the source-chain transaction ──────────────────────────────────
      setStep(STEPS.BRIDGING);
      setProgressLabel(`Sending on ${fromChain?.name}…`);

      const txReq = quote.transactionRequest;
      const tx = await signer.sendTransaction({
        to: txReq.to,
        data: txReq.data,
        value: txReq.value ? BigInt(txReq.value) : undefined,
        gasLimit: txReq.gasLimit ? BigInt(txReq.gasLimit) : undefined,
      });
      setTxHash(tx.hash);
      setProgressLabel("Waiting for source-chain confirmation…");
      await tx.wait();

      // ── Poll until the bridge settles on the destination chain ─────────────
      setProgressLabel(`Bridging to ${toChain?.name}… this can take a few minutes`);
      await pollStatus(tx.hash, {
        bridge: quote.tool,
        fromChainId: fromChain?.id,
        toChainId: toChain?.id,
      });

      setStep(STEPS.SUCCESS);
      if (onSuccess) onSuccess({ hash: tx.hash });
    } catch (err) {
      if (__DEV__) console.error("[CrossChainConfirmModal]", err);
      setErrorInfo(parseCrossChainError(err));
      setStep(STEPS.ERROR);
      if (onError) onError(err);
    }
  };

  const handleClose = () => { setSigner(null); onClose(); };
  const handleRetry = () => { setSigner(null); setStep(STEPS.PIN); setPinError(""); setErrorInfo(null); };

  if (!visible) return null;

  const estimatedMinutes = quote?.estimate?.executionDuration
    ? Math.max(1, Math.round(quote.estimate.executionDuration / 60))
    : null;

  const receiveAmountLabel = (() => {
    if (!quote?.estimate?.toAmount || !toToken) return "—";
    try {
      const val = parseFloat(formatUnits(String(quote.estimate.toAmount), parseInt(toToken.decimals, 10)));
      return `${val.toFixed(6)} ${toToken.symbol}`;
    } catch { return "—"; }
  })();

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <View style={styles.screen}>
        {step === STEPS.PIN && (
          <PinPad theme={theme} onComplete={handlePinComplete} onCancel={handleClose} error={pinError} />
        )}

        {step !== STEPS.PIN && (
          <View style={styles.modalWrapper}>
            <View style={styles.header}>
              {step === STEPS.REVIEW ? (
                <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
                  <Ionicons name="chevron-back" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ) : <View style={styles.headerBtn} />}

              <Text style={styles.headerTitle}>
                {step === STEPS.REVIEW ? "Review Transfer"
                  : step === STEPS.APPROVING ? "Approving"
                  : step === STEPS.BRIDGING ? "Bridging"
                  : step === STEPS.SUCCESS ? "Transfer Complete"
                  : "Bridge Failed"}
              </Text>

              {[STEPS.SUCCESS, STEPS.ERROR].includes(step) ? (
                <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
                  <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ) : <View style={styles.headerBtn} />}
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              {step === STEPS.REVIEW && (
                <View>
                  <View style={styles.flowCard}>
                    <View style={styles.flowSide}>
                      <Text style={styles.flowLabel}>{fromChain?.name}</Text>
                      <Text style={styles.flowAmount} numberOfLines={1} adjustsFontSizeToFit>{fromAmount}</Text>
                      <View style={styles.flowTokenRow}>
                        <View style={styles.flowTokenDot}><Text style={styles.flowTokenDotText}>{fromToken?.symbol?.charAt(0)}</Text></View>
                        <Text style={styles.flowTokenSymbol}>{fromToken?.symbol}</Text>
                      </View>
                    </View>
                    <View style={styles.flowArrow}><Ionicons name="arrow-forward" size={18} color={COLORS.primary} /></View>
                    <View style={[styles.flowSide, styles.flowSideReceive]}>
                      <Text style={styles.flowLabel}>{toChain?.name}</Text>
                      <Text style={[styles.flowAmount, { color: COLORS.primary }]} numberOfLines={1} adjustsFontSizeToFit>≈{receiveAmountLabel}</Text>
                      <View style={styles.flowTokenRow}>
                        <View style={[styles.flowTokenDot, { backgroundColor: COLORS.primaryLight }]}><Text style={styles.flowTokenDotText}>{toToken?.symbol?.charAt(0)}</Text></View>
                        <Text style={styles.flowTokenSymbol}>{toToken?.symbol}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailsCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Route</Text>
                      <Text style={styles.detailValue}>{quote?.toolDetails?.name ?? quote?.tool ?? "—"}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Est. time</Text>
                      <Text style={styles.detailValue}>{estimatedMinutes ? `~${estimatedMinutes} min` : "—"}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>You'll receive at least</Text>
                      <Text style={styles.detailValue}>{receiveAmountLabel}</Text>
                    </View>
                  </View>

                  <View style={styles.warnBanner}>
                    <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.warnText}>
                      This moves funds between two different chains. Double-check the receiving chain and amount before confirming.
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
                    <Text style={styles.confirmBtnText}>Confirm Transfer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {[STEPS.APPROVING, STEPS.BRIDGING].includes(step) && (
                <View style={styles.processingWrap}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.processingLabel}>{progressLabel}</Text>
                  {step === STEPS.BRIDGING && (
                    <Text style={styles.processingSubLabel}>
                      Bridges settle on the destination chain — you can leave this screen and check back later.
                    </Text>
                  )}
                </View>
              )}

              {step === STEPS.SUCCESS && (
                <View style={styles.processingWrap}>
                  <View style={styles.successIconWrap}>
                    <Ionicons name="checkmark" size={40} color={COLORS.onPrimary} />
                  </View>
                  <Text style={styles.processingLabel}>
                    {receiveAmountLabel} arrived on {toChain?.name}
                  </Text>
                  {txHash ? <Text style={styles.hashText} numberOfLines={1}>{txHash}</Text> : null}
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleClose} activeOpacity={0.85}>
                    <Text style={styles.confirmBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}

              {step === STEPS.ERROR && (
                <View style={styles.processingWrap}>
                  <Ionicons name={errorInfo?.icon ?? "alert-circle-outline"} size={40} color={COLORS.error} />
                  <Text style={styles.processingLabel}>{errorInfo?.title}</Text>
                  <Text style={styles.processingSubLabel}>{errorInfo?.message}</Text>
                  {errorInfo?.canRetry && (
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleRetry} activeOpacity={0.85}>
                      <Text style={styles.confirmBtnText}>Try Again</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
                    <Text style={styles.cancelBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
};

const createStyles = (theme) => {
  const { COLORS, SPACING, FONTS, BORDER_RADIUS } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    modalWrapper: { flex: 1 },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.md,
    },
    headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: "700", color: COLORS.text },
    body: { padding: SPACING.md, paddingBottom: SPACING.xxl },

    flowCard: {
      flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface,
      borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
      padding: SPACING.md, marginBottom: SPACING.md,
    },
    flowSide: { flex: 1 },
    flowSideReceive: { alignItems: "flex-end" },
    flowLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginBottom: 4 },
    flowAmount: { fontSize: FONTS.sizes.lg, fontWeight: "800", color: COLORS.text },
    flowTokenRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 },
    flowTokenDot: {
      width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary,
      alignItems: "center", justifyContent: "center",
    },
    flowTokenDotText: { fontSize: 10, fontWeight: "800", color: COLORS.onPrimary },
    flowTokenSymbol: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: "600" },
    flowArrow: { paddingHorizontal: SPACING.sm },

    detailsCard: {
      backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
      borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md, gap: SPACING.sm,
    },
    detailRow: { flexDirection: "row", justifyContent: "space-between" },
    detailLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
    detailValue: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: "600" },

    warnBanner: {
      flexDirection: "row", gap: SPACING.sm, backgroundColor: COLORS.primaryLight,
      borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.lg,
    },
    warnText: { flex: 1, fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, lineHeight: 16 },

    confirmBtn: {
      backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, paddingVertical: SPACING.md,
      alignItems: "center", marginBottom: SPACING.sm,
    },
    confirmBtnText: { fontSize: FONTS.sizes.base, fontWeight: "700", color: COLORS.onPrimary },
    cancelBtn: { paddingVertical: SPACING.sm, alignItems: "center" },
    cancelBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: "600" },

    processingWrap: { alignItems: "center", justifyContent: "center", paddingTop: SPACING.xxl, gap: SPACING.md },
    processingLabel: { fontSize: FONTS.sizes.base, fontWeight: "700", color: COLORS.text, textAlign: "center" },
    processingSubLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: "center", paddingHorizontal: SPACING.lg },
    hashText: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },
    successIconWrap: {
      width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary,
      alignItems: "center", justifyContent: "center",
    },

    // ── PIN pad ──
    pinScreen: { flex: 1, alignItems: "center", paddingTop: SPACING.xxl, paddingHorizontal: SPACING.lg },
    pinCloseBtn: { position: "absolute", top: SPACING.xl, right: SPACING.md, padding: SPACING.xs },
    pinTitle: { fontSize: FONTS.sizes.xl, fontWeight: "800", color: COLORS.text, marginTop: SPACING.xxl },
    pinSubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: "center" },
    pinErrorRow: { height: 28, justifyContent: "center" },
    pinErrorBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.sm },
    pinErrorText: { fontSize: FONTS.sizes.xs, color: COLORS.error, fontWeight: "600" },
    dotsRow: { flexDirection: "row", gap: 14, marginVertical: SPACING.xl },
    dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: COLORS.border },
    dotFilled: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    keypad: { marginTop: SPACING.lg, gap: SPACING.md },
    keyRow: { flexDirection: "row", gap: SPACING.xl },
    keyBtn: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
    keyText: { fontSize: FONTS.sizes.xxl, fontWeight: "600", color: COLORS.text },
  });
};

export default CrossChainConfirmModal;
