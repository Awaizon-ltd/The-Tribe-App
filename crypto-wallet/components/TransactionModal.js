// components/TransactionModal.js
import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator,
  ScrollView, Image, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useTransactionManager } from '../hooks/useTransactionManager';
import { useWallet } from '../contexts/WalletContext';
import { formatEther } from 'ethers';
import Alert from '../utils/Alert';
import { PasscodeKeypad } from './common/PasscodeKeypad';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const shortAddr = (a) => (a && typeof a === 'string' ? `${a.slice(0, 6)}···${a.slice(-4)}` : '');

const fmtGasEth = (val) => {
  if (!val && val !== 0) return '—';
  if (val < 0.000001) return '< 0.000001';
  if (val < 0.0001)   return val.toFixed(8);
  if (val < 0.001)    return val.toFixed(6);
  return val.toFixed(5);
};

const fmtUsd = (val) => {
  if (val == null || isNaN(val)) return null;
  if (val < 0.01) return '< $0.01';
  return `$${val.toFixed(2)}`;
};

// ─── Inline token logo ────────────────────────────────────────────────────────

const TokenLogo = ({ uri, symbol, size, color }) => {
  const [err, setErr] = useState(false);
  if (uri && !err) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: `${color}22`,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.42, fontWeight: '800', color }}>
        {symbol?.charAt(0)?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
};

// ─── Review step ──────────────────────────────────────────────────────────────

const ReviewStep = ({
  theme, insets,
  title,
  isNativeTransfer, to, args, value,
  gasInfo, isEstimating, error,
  onConfirm, onCancel, hasSignerUnlocked,
  // Display enhancement props (optional)
  tokenLogo, tokenSymbol, tokenAmount, amountUsd,
  recipientAddress, nativeTokenPrice, chainSymbol,
}) => {
  const s = reviewStyles(theme, insets);
  const canConfirm = hasSignerUnlocked && !error && !isEstimating;

  // Best recipient address for display
  const displayTo = recipientAddress || to ||
    (Array.isArray(args) && typeof args[0] === 'string' && args[0].startsWith('0x') ? args[0] : null);

  // Gas in USD
  const gasUsd = (gasInfo?.estimatedCostEth != null && nativeTokenPrice)
    ? gasInfo.estimatedCostEth * nativeTokenPrice
    : null;

  // Effective amount for display (for non-native transfers without tokenAmount prop)
  const displayValue = (tokenAmount == null && !isNativeTransfer && value && value !== '0')
    ? `${parseFloat(formatEther(value)).toFixed(6)} ${chainSymbol || 'ETH'}`
    : null;

  return (
    <View style={s.sheet}>
      <View style={s.handle} />

      {/* Header */}
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <View style={s.headerIcon}>
            <Ionicons name="paper-plane-outline" size={18} color={theme.COLORS.primary} />
          </View>
          <Text style={s.headerTitle}>{title}</Text>
        </View>
        <TouchableOpacity style={s.closeBtn} onPress={onCancel}>
          <Ionicons name="close" size={18} color={theme.COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ── Token hero ── */}
        <View style={s.hero}>
          {(tokenLogo || tokenSymbol) ? (
            <TokenLogo uri={tokenLogo} symbol={tokenSymbol} size={76} color={theme.COLORS.primary} />
          ) : (
            <View style={[s.heroFallbackIcon, { backgroundColor: `${theme.COLORS.primary}18` }]}>
              <Ionicons name="swap-horizontal" size={34} color={theme.COLORS.primary} />
            </View>
          )}

          {(tokenAmount || displayValue) && (
            <Text style={s.heroAmount}>
              {tokenAmount ?? displayValue}
              {tokenAmount && tokenSymbol ? (
                <Text style={s.heroSymbol}>  {tokenSymbol}</Text>
              ) : null}
            </Text>
          )}

          {amountUsd ? (
            <Text style={[s.heroUsd, { color: theme.COLORS.textSecondary }]}>≈ {amountUsd}</Text>
          ) : null}
        </View>

        {/* ── Info card ── */}
        <View style={[s.card, { backgroundColor: theme.COLORS.surface, borderColor: theme.COLORS.border }]}>

          {/* Recipient */}
          {displayTo && (
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: theme.COLORS.textSecondary }]}>To</Text>
              <Text
                style={[s.infoValue, { color: theme.COLORS.text,
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  fontSize: 13,
                }]}
                numberOfLines={1}
              >
                {shortAddr(displayTo)}
              </Text>
            </View>
          )}

          {/* Separator */}
          {displayTo && <View style={[s.divider, { backgroundColor: theme.COLORS.divider }]} />}

          {/* Network fee */}
          <View style={[s.infoRow, { alignItems: 'flex-start' }]}>
            <Text style={[s.infoLabel, { color: theme.COLORS.textSecondary }]}>Network Fee</Text>

            {isEstimating ? (
              <View style={s.feeLoadingRow}>
                <ActivityIndicator size="small" color={theme.COLORS.primary} />
                <Text style={[s.feeSecondary, { color: theme.COLORS.textSecondary }]}>Calculating…</Text>
              </View>
            ) : error ? (
              <View style={s.feeErrorRow}>
                <Ionicons name="warning-outline" size={13} color={theme.COLORS.error} />
                <Text style={[s.feeSecondary, { color: theme.COLORS.error }]}>Unable to estimate</Text>
              </View>
            ) : gasInfo ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.infoValue, { color: theme.COLORS.primary }]}>
                  ≈ {fmtGasEth(gasInfo.estimatedCostEth)} {chainSymbol || 'ETH'}
                </Text>
                {gasUsd != null && (
                  <Text style={[s.feeSecondary, { color: theme.COLORS.textSecondary, marginTop: 2 }]}>
                    {fmtUsd(gasUsd)}
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Gas error detail ── */}
        {error && !isEstimating && (
          <View style={[s.errorBanner, { backgroundColor: `${theme.COLORS.error}0f`, borderColor: `${theme.COLORS.error}25` }]}>
            <Ionicons name="alert-circle-outline" size={15} color={theme.COLORS.error} />
            <Text style={[s.errorBannerText, { color: theme.COLORS.error }]}>
              {error.message || 'Could not estimate fees for this transaction.'}
            </Text>
          </View>
        )}

        {/* ── Wallet status badge ── */}
        <View style={[
          s.statusBadge,
          hasSignerUnlocked
            ? { backgroundColor: `${theme.COLORS.success}12` }
            : { backgroundColor: theme.COLORS.surface },
        ]}>
          <Ionicons
            name={hasSignerUnlocked ? 'checkmark-circle' : 'lock-closed'}
            size={13}
            color={hasSignerUnlocked ? theme.COLORS.success : theme.COLORS.textTertiary}
          />
          <Text style={[
            s.statusText,
            { color: hasSignerUnlocked ? theme.COLORS.success : theme.COLORS.textTertiary },
          ]}>
            {hasSignerUnlocked ? 'Wallet unlocked' : 'Wallet locked'}
          </Text>
        </View>

      </ScrollView>

      {/* ── Actions ── */}
      <View style={[s.actions, { borderTopColor: theme.COLORS.divider }]}>
        <TouchableOpacity style={[s.cancelBtn, { borderColor: theme.COLORS.border, backgroundColor: theme.COLORS.surface }]} onPress={onCancel}>
          <Text style={[s.cancelText, { color: theme.COLORS.text }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.confirmBtn, { backgroundColor: theme.COLORS.primary }, !canConfirm && s.confirmDisabled]}
          onPress={onConfirm}
          disabled={!canConfirm}
          activeOpacity={0.85}
        >
          <Text style={s.confirmText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const reviewStyles = (theme, insets) => StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
    paddingTop: insets.top + 8,
    paddingBottom: insets.bottom + 12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: theme.COLORS.border,
    alignSelf: 'center', marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.COLORS.divider,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: `${theme.COLORS.primary}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: theme.COLORS.text, letterSpacing: -0.3 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: theme.COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.COLORS.border,
  },

  scrollContent: {
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8, gap: 12,
  },

  // Token hero
  hero: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  heroFallbackIcon: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
  },
  heroAmount: {
    fontSize: 34, fontWeight: '800',
    color: theme.COLORS.text, letterSpacing: -0.8,
    marginTop: 12, textAlign: 'center',
  },
  heroSymbol: {
    fontSize: 20, fontWeight: '500', color: theme.COLORS.textSecondary,
  },
  heroUsd: {
    fontSize: 16, fontWeight: '400',
  },

  // Info card
  card: {
    borderRadius: 16, paddingHorizontal: 16,
    borderWidth: 1, overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14,
  },
  infoLabel: { fontSize: 14, flex: 1 },
  infoValue: { fontSize: 14, fontWeight: '600', flex: 2, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth },
  feeLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  feeErrorRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  feeSecondary:  { fontSize: 13 },

  // Error banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 10, padding: 12, borderWidth: 1,
  },
  errorBannerText: { flex: 1, fontSize: 13, lineHeight: 19 },

  // Wallet status
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: '600' },

  // Action buttons
  actions: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flex: 1, height: 54, borderRadius: 14,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 2, height: 54, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmDisabled: { opacity: 0.35 },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ─── Processing step ──────────────────────────────────────────────────────────

const ProcessingStep = ({ theme, insets }) => {
  const s = statusStyles(theme, insets);
  return (
    <View style={s.root}>
      <View style={[s.iconWrap, { backgroundColor: `${theme.COLORS.primary}15` }]}>
        <ActivityIndicator size="large" color={theme.COLORS.primary} />
      </View>
      <Text style={s.title}>Submitting…</Text>
      <Text style={s.subtitle}>Your transaction is being sent to the network.</Text>
      <View style={[s.statusCard, { backgroundColor: theme.COLORS.surface, borderColor: theme.COLORS.border }]}>
        <View style={s.statusRow}>
          <Ionicons name="checkmark-circle" size={17} color={theme.COLORS.success} />
          <Text style={[s.statusRowText, { color: theme.COLORS.textSecondary }]}>Signed</Text>
        </View>
        <View style={s.statusRow}>
          <ActivityIndicator size="small" color={theme.COLORS.primary} />
          <Text style={[s.statusRowText, { color: theme.COLORS.textSecondary }]}>Waiting for confirmation…</Text>
        </View>
      </View>
    </View>
  );
};

// ─── Success step (used when no onSuccess prop is provided) ───────────────────

const SuccessStep = ({ theme, insets, receipt, onClose }) => {
  const s = statusStyles(theme, insets);
  const txRef = receipt?.hash ? shortAddr(receipt.hash) : null;
  return (
    <View style={s.root}>
      <View style={[s.iconWrap, { backgroundColor: `${theme.COLORS.success}15` }]}>
        <Ionicons name="checkmark" size={44} color={theme.COLORS.success} />
      </View>
      <Text style={s.title}>Transaction Sent</Text>
      <Text style={s.subtitle}>Your transaction was confirmed successfully.</Text>
      {txRef && <Text style={[s.txRef, { color: theme.COLORS.textTertiary }]}>Ref {txRef}</Text>}
      <TouchableOpacity
        style={[s.primaryBtn, { backgroundColor: theme.COLORS.success }]}
        onPress={onClose}
      >
        <Text style={s.primaryBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Error step ───────────────────────────────────────────────────────────────

const ErrorStep = ({ theme, insets, error, onRetry, onClose }) => {
  const s = statusStyles(theme, insets);
  return (
    <View style={s.root}>
      <View style={[s.iconWrap, { backgroundColor: `${theme.COLORS.error}15` }]}>
        <Ionicons name="close" size={44} color={theme.COLORS.error} />
      </View>
      <Text style={s.title}>Transaction Failed</Text>
      <View style={[s.detailsCard, {
        backgroundColor: `${theme.COLORS.error}08`,
        borderColor: `${theme.COLORS.error}28`,
      }]}>
        <Text style={[s.errorTitle, { color: theme.COLORS.error }]}>
          {error?.title || 'Something went wrong'}
        </Text>
        <Text style={[s.errorMsg, { color: theme.COLORS.textSecondary }]}>
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </Text>
      </View>
      <View style={[s.btnRow, { bottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={[s.secondaryBtn, { backgroundColor: theme.COLORS.surface, borderColor: theme.COLORS.border }]} onPress={onClose}>
          <Text style={[s.secondaryBtnText, { color: theme.COLORS.text }]}>Close</Text>
        </TouchableOpacity>
        {error?.type !== 'cancelled' && (
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: theme.COLORS.primary }]} onPress={onRetry}>
            <Text style={s.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const statusStyles = (theme, insets) => StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: insets.top + 48,
    paddingBottom: insets.bottom + 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    backgroundColor: theme.COLORS.background,
  },
  iconWrap: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  title: {
    fontSize: 24, fontWeight: '700', color: theme.COLORS.text,
    textAlign: 'center', letterSpacing: -0.5, marginBottom: 10,
  },
  subtitle: {
    fontSize: 14, color: theme.COLORS.textSecondary,
    textAlign: 'center', lineHeight: 21, marginBottom: 28,
  },
  txRef: { fontSize: 12, letterSpacing: 0.5, marginBottom: 28, marginTop: -16 },
  statusCard: {
    width: '100%', borderRadius: 14, padding: 16, gap: 14, borderWidth: 1,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusRowText: { fontSize: 14 },
  detailsCard: {
    width: '100%', borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 24,
  },
  errorTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  errorMsg: { fontSize: 14, lineHeight: 21 },
  btnRow: {
    flexDirection: 'row', gap: 12, width: '100%',
    position: 'absolute', left: 28, right: 28,
  },
  primaryBtn: {
    flex: 1, height: 54, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', width: '100%',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  secondaryBtn: {
    flex: 1, height: 54, borderRadius: 14,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
});

// ─── Main modal ───────────────────────────────────────────────────────────────

export const TransactionModal = ({
  visible,
  onClose,
  // Transaction params
  contractAddress,
  contractABI,
  functionName,
  args = [],
  value = '0',
  isNativeTransfer = false,
  to,
  // Display
  title = 'Confirm Transaction',
  // Callbacks
  onSuccess,
  onError,
  // Optional display enhancement props
  tokenLogo,
  tokenSymbol,
  tokenAmount,
  amountUsd,
  recipientAddress,
  nativeTokenPrice,
  chainSymbol,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    estimateGas, executeTransaction, executeNativeTransfer,
    gasInfo, isEstimating, error, clearError,
  } = useTransactionManager();
  const { createSignerForTransaction, address } = useWallet();

  const [step, setStep]                   = useState('unlock');
  const [passcodeError, setPasscodeError] = useState('');
  const [txReceipt, setTxReceipt]         = useState(null);
  const [signerReady, setSignerReady]     = useState(false);
  const [needsSignerForGas, setNeedsSignerForGas] = useState(false);

  // Signer lives in a ref — never in React state, never in DevTools, never serialised
  const signerRef = useRef(null);

  const clearSigner = () => {
    signerRef.current = null;
    setSignerReady(false);
  };

  useEffect(() => {
    if (visible) {
      setStep('unlock');
      setPasscodeError('');
      setTxReceipt(null);
      clearSigner();
      setNeedsSignerForGas(false);
      clearError();
      estimateInitial();
    } else {
      clearSigner();
      setPasscodeError('');
      setStep('unlock');
    }
  }, [visible]);

  const estimateInitial = async () => {
    try {
      await estimateGas(
        isNativeTransfer
          ? { isNativeTransfer: true, to, value, from: address }
          : { address: contractAddress, abi: contractABI, functionName, args, value, from: address },
      );
    } catch (err) {
      if (/token holder|not authorized|insufficient/i.test(err.message)) {
        setNeedsSignerForGas(true);
      }
    }
  };

  const handlePinComplete = async (passcode) => {
    try {
      setPasscodeError('');
      const signer = await createSignerForTransaction(passcode);
      signerRef.current = signer;
      setSignerReady(true);

      if (needsSignerForGas || error) {
        clearError();
        try {
          await estimateGas(
            isNativeTransfer
              ? { isNativeTransfer: true, to, value, signer }
              : { address: contractAddress, abi: contractABI, functionName, args, value, signer },
          );
        } catch {}
      }

      setStep('review');
    } catch {
      setPasscodeError('Incorrect passcode');
    }
  };

  const handleConfirm = async () => {
    if (!signerRef.current) {
      Alert.alert('Error', 'Please unlock your wallet first');
      setStep('unlock');
      return;
    }
    setStep('processing');
    const signer = signerRef.current;
    clearSigner(); // drop ref before async work — key material no longer needed after this point
    try {
      const receipt = await (
        isNativeTransfer
          ? executeNativeTransfer({ to, value, gasLimit: gasInfo?.gasLimit, signer })
          : executeTransaction({ address: contractAddress, abi: contractABI, functionName, args, value, gasLimit: gasInfo?.gasLimit, signer })
      );
      if (onSuccess) {
        onSuccess(receipt);
        handleClose();
      } else {
        setTxReceipt(receipt);
        setStep('success');
      }
    } catch (err) {
      setStep('error');
      onError?.(err);
    }
  };

  const handleClose = () => {
    clearSigner();
    clearError();
    setPasscodeError('');
    setStep('unlock');
    onClose();
  };

  const handleRetry = () => {
    clearSigner();
    clearError();
    setPasscodeError('');
    setStep('unlock');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: theme.COLORS.background }}>
        {step === 'unlock' && (
          <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.COLORS.background }}>
            <PasscodeKeypad
              onComplete={handlePinComplete}
              onCancel={handleClose}
              error={passcodeError}
              title="Enter Passcode"
              subtitle="Authorize this transaction with your 6-digit passcode"
            />
          </View>
        )}
        {step === 'review'     && (
          <ReviewStep
            theme={theme} insets={insets}
            title={title}
            isNativeTransfer={isNativeTransfer}
            to={to} args={args} value={value}
            gasInfo={gasInfo} isEstimating={isEstimating} error={error}
            onConfirm={handleConfirm} onCancel={handleClose}
            hasSignerUnlocked={signerReady}
            tokenLogo={tokenLogo} tokenSymbol={tokenSymbol}
            tokenAmount={tokenAmount} amountUsd={amountUsd}
            recipientAddress={recipientAddress}
            nativeTokenPrice={nativeTokenPrice}
            chainSymbol={chainSymbol}
          />
        )}
        {step === 'processing' && <ProcessingStep theme={theme} insets={insets} />}
        {step === 'success'    && <SuccessStep    theme={theme} insets={insets} receipt={txReceipt} onClose={handleClose} />}
        {step === 'error'      && <ErrorStep      theme={theme} insets={insets} error={error} onRetry={handleRetry} onClose={handleClose} />}
      </View>
    </Modal>
  );
};

export default TransactionModal;
