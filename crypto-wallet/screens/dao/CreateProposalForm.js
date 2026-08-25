// screens/dao/CreateProposalForm.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatUnits, parseUnits } from 'ethers';
import { useTheme } from '../../contexts/ThemeContext';
import { useDAOContract } from '../../hooks/useDAOContract';
import { TransactionModal } from '../../components/TransactionModal';
import { useWallet } from '../../contexts/WalletContext';
import Alert from '../../utils/Alert';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtTokenAmount = (raw, decimals) => {
  if (!raw) return '0';
  const n = parseFloat(formatUnits(raw, decimals));
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(4);
};

const fmtThreshold = (val) => {
  const n = parseFloat(val);
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(2);
};

// ─── Proposal type cards ──────────────────────────────────────────────────────

const PROPOSAL_TYPES = (isTreasuryEmpty, tokenSymbol) => [
  {
    id: '1',
    name: 'Generic',
    icon: 'document-text-outline',
    description: 'Governance decisions & policy',
    disabled: false,
  },
  {
    id: '0',
    name: 'Funding',
    icon: 'cash-outline',
    description: isTreasuryEmpty ? 'Treasury is empty' : 'Request treasury funds',
    disabled: isTreasuryEmpty,
  },
  {
    id: '2',
    name: 'Protocol',
    icon: 'construct-outline',
    description: 'Modify DAO parameters',
    disabled: false,
  },
];

const PROTOCOL_ACTIONS = {
  '0': {
    label: 'Change Threshold',
    icon: 'options-outline',
    helper: 'Modify the minimum tokens needed to create a proposal',
    inputLabel: 'New Threshold',
    placeholder: 'e.g., 100',
    inputType: 'token-amount',
  },
  '1': {
    label: 'Change Governance Token',
    icon: 'swap-horizontal-outline',
    helper: 'Replace the governance token contract',
    inputLabel: 'New Token Address',
    placeholder: '0x…',
    inputType: 'address-only',
  },
  '2': {
    label: 'Change Quorum',
    icon: 'people-outline',
    helper: 'Percentage of votes required for a proposal to pass (0–100)',
    inputLabel: 'New Quorum',
    placeholder: 'e.g., 51',
    inputType: 'percentage',
  },
  '3': {
    label: 'Change Timelock',
    icon: 'time-outline',
    helper: 'Delay before a passed proposal can be executed',
    inputLabel: 'New Timelock',
    placeholder: 'e.g., 2',
    inputType: 'days',
  },
  '4': {
    label: 'Change Voting Period',
    icon: 'calendar-outline',
    helper: 'How long community members have to cast their votes',
    inputLabel: 'New Voting Period',
    placeholder: 'e.g., 7',
    inputType: 'days',
  },
};

// ─── Small reusable components ────────────────────────────────────────────────

const SectionLabel = ({ title, icon, COLORS }) => (
  <View style={sl.row}>
    <Ionicons name={icon} size={14} color={COLORS.primary} />
    <Text style={[sl.text, { color: COLORS.textSecondary }]}>{title}</Text>
  </View>
);
const sl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginTop: 20 },
  text: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
});

const FieldError = ({ message, COLORS }) => (
  <View style={fe.row}>
    <Ionicons name="alert-circle" size={13} color={COLORS.error} />
    <Text style={[fe.text, { color: COLORS.error }]}>{message}</Text>
  </View>
);
const fe = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  text: { fontSize: 12, fontWeight: '500' },
});

// ─── Main form ────────────────────────────────────────────────────────────────

export function CreateProposalForm({ route, navigation }) {
  const theme = useTheme();
  const { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } = theme;
  const insets = useSafeAreaInsets();
  const { daoAddress } = route.params;

  const {
    daoInfo, userInfo, isLoading,
    canCreateProposal, isTokenHolder,
    getTreasuryBalance,
    getFundingProposalParams,
    getGenericProposalParams,
    getProtocolUpgradeParams,
  } = useDAOContract(daoAddress);

  // ── Form state ───────────────────────────────────────────────────────────
  const [title,           setTitle]          = useState('');
  const [description,     setDescription]    = useState('');
  const [amount,          setAmount]         = useState('');
  const [recipient,       setRecipient]      = useState('');
  const [proposalType,    setProposalType]   = useState('1');
  const [protocolAction,  setProtocolAction] = useState('0');
  const [newValue,        setNewValue]       = useState('');
  const [newTokenAddress, setNewTokenAddress]= useState('');
  const [treasuryBalance, setTreasuryBalance]= useState(null);
  const [errors,          setErrors]         = useState({});
  const [isFormValid,     setIsFormValid]    = useState(false);
  const [showTxModal,     setShowTxModal]    = useState(false);
  const [txParams,        setTxParams]       = useState(null);

  const isFundingProposal = proposalType === '0';
  const isProtocolUpgrade = proposalType === '2';
  const isTreasuryEmpty   = Boolean(treasuryBalance && BigInt(treasuryBalance) === 0n);

  // ── Treasury fetch ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!daoInfo) return;
    let cancelled = false;
    (async () => {
      try {
        const bal = await getTreasuryBalance();
        if (!cancelled) setTreasuryBalance(bal.raw);
      } catch {
        if (!cancelled) setTreasuryBalance('0');
      }
    })();
    return () => { cancelled = true; };
  }, [daoInfo]);

  // ── Validation ───────────────────────────────────────────────────────────
  useEffect(() => {
    const errs = {};
    let valid = true;

    if (!title.trim()) {
      errs.title = 'Title is required'; valid = false;
    } else if (title.trim().length < 5) {
      errs.title = 'At least 5 characters'; valid = false;
    } else if (title.trim().length > 100) {
      errs.title = 'Max 100 characters'; valid = false;
    }

    if (!description.trim()) {
      errs.description = 'Description is required'; valid = false;
    } else if (description.trim().length < 20) {
      errs.description = 'At least 20 characters'; valid = false;
    } else if (description.trim().length > 1000) {
      errs.description = 'Max 1000 characters'; valid = false;
    }

    if (isFundingProposal) {
      if (!amount) {
        errs.amount = 'Amount is required'; valid = false;
      } else {
        const n = parseFloat(amount);
        if (isNaN(n) || n <= 0) {
          errs.amount = 'Must be a positive number'; valid = false;
        } else if (treasuryBalance && userInfo) {
          const amtWei = BigInt(Math.floor(n * Math.pow(10, userInfo.tokenDecimals)));
          if (amtWei > BigInt(treasuryBalance)) {
            errs.amount = 'Exceeds treasury balance'; valid = false;
          }
        }
      }
      if (!recipient) {
        errs.recipient = 'Recipient address is required'; valid = false;
      } else if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
        errs.recipient = 'Invalid Ethereum address'; valid = false;
      }
    }

    if (isProtocolUpgrade) {
      const cfg = PROTOCOL_ACTIONS[protocolAction];
      if (cfg.inputType === 'address-only') {
        if (!newTokenAddress) {
          errs.newTokenAddress = 'Address is required'; valid = false;
        } else if (!/^0x[a-fA-F0-9]{40}$/.test(newTokenAddress)) {
          errs.newTokenAddress = 'Invalid Ethereum address'; valid = false;
        }
      } else {
        if (!newValue) {
          errs.newValue = 'Value is required'; valid = false;
        } else {
          const n = parseFloat(newValue);
          if (isNaN(n) || n < 0) {
            errs.newValue = 'Must be a valid positive number'; valid = false;
          } else if (cfg.inputType === 'percentage' && (n < 0 || n > 100)) {
            errs.newValue = 'Must be between 0 and 100'; valid = false;
          }
        }
      }
    }

    setErrors(errs);
    setIsFormValid(Boolean(valid && canCreateProposal));
  }, [
    title, description, amount, recipient,
    proposalType, protocolAction, newValue, newTokenAddress,
    isFundingProposal, isProtocolUpgrade, isTreasuryEmpty,
    treasuryBalance, userInfo, canCreateProposal,
  ]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleClose = () => {
    if (title || description || amount || recipient || newValue) {
      Alert.alert('Discard Changes?', 'You have unsaved changes. Are you sure?', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid) {
      Alert.alert('Incomplete Form', 'Please fill in all required fields correctly.');
      return;
    }
    if (!daoInfo || !userInfo) {
      Alert.alert('Error', 'DAO information is not loaded. Please try again.');
      return;
    }
    if (!canCreateProposal) {
      Alert.alert(
        'Insufficient Balance',
        `You need at least ${fmtThreshold(daoInfo.proposalThreshold)} ${userInfo.tokenSymbol} to create proposals. Your balance: ${userInfo.tokenBalanceFormatted} ${userInfo.tokenSymbol}`,
      );
      return;
    }
    try {
      let params;
      if (isFundingProposal) {
        params = getFundingProposalParams(title, description, amount, recipient);
      } else if (isProtocolUpgrade) {
        const cfg = PROTOCOL_ACTIONS[protocolAction];
        const actionNum = parseInt(protocolAction);
        let convertedValue = newValue;
        switch (actionNum) {
          case 0: convertedValue = parseUnits(newValue, userInfo.tokenDecimals).toString(); break;
          case 1: convertedValue = '0'; break;
          case 2: convertedValue = Math.floor(parseFloat(newValue)).toString(); break;
          case 3: convertedValue = Math.floor(parseFloat(newValue) * 24).toString(); break;
          case 4: convertedValue = Math.floor(parseFloat(newValue) * 24).toString(); break;
          default: convertedValue = newValue;
        }
        const tokenAddr = cfg.inputType === 'address-only'
          ? newTokenAddress
          : '0x0000000000000000000000000000000000000000';
        params = getProtocolUpgradeParams(title, description, actionNum, convertedValue, tokenAddr);
      } else {
        params = getGenericProposalParams(title, description);
      }
      setTxParams(params);
      setShowTxModal(true);
    } catch (err) {
      Alert.alert('Error', `Failed to prepare proposal: ${err.message || 'Unknown error'}`);
    }
  };

  const handleTxSuccess = () => {
    setShowTxModal(false);
    Alert.alert(
      'Proposal Submitted',
      'Your proposal is now live and open for community voting.',
      [{
        text: 'Done',
        onPress: () => {
          setTitle(''); setDescription(''); setAmount('');
          setRecipient(''); setProposalType('1');
          setNewValue(''); setNewTokenAddress('');
          navigation.goBack();
        },
      }],
    );
  };

  const handleTxError = (err) => {
    setShowTxModal(false);
    Alert.alert('Transaction Failed', err?.message || 'Failed to create proposal. Please try again.');
  };

  const charColor = (len, limit) => {
    const pct = len / limit;
    if (pct > 0.9) return COLORS.error;
    if (pct > 0.75) return COLORS.warning;
    return COLORS.textTertiary || COLORS.textSecondary;
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading || !daoInfo || !userInfo) {
    return (
      <View style={[s.loading, { backgroundColor: COLORS.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[s.loadingText, { color: COLORS.textSecondary }]}>Loading DAO information…</Text>
      </View>
    );
  }

  const protocolCfg = PROTOCOL_ACTIONS[protocolAction];
  const types = PROPOSAL_TYPES(isTreasuryEmpty, userInfo.tokenSymbol);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: COLORS.background }}
    >
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: COLORS.border, backgroundColor: COLORS.background }]}>
        <TouchableOpacity style={s.backBtn} onPress={handleClose} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: COLORS.text }]}>Create Proposal</Text>
          <Text style={[s.headerSub, { color: COLORS.textSecondary }]}>{daoInfo?.name}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Eligibility card ── */}
        <View style={[s.eligibilityCard, {
          backgroundColor: canCreateProposal ? `${COLORS.success}0c` : `${COLORS.warning}0c`,
          borderColor: canCreateProposal ? `${COLORS.success}30` : `${COLORS.warning}30`,
        }]}>
          <View style={[s.eligibilityIcon, {
            backgroundColor: canCreateProposal ? `${COLORS.success}18` : `${COLORS.warning}18`,
          }]}>
            <Ionicons
              name={canCreateProposal ? 'checkmark-circle' : 'alert-circle'}
              size={22}
              color={canCreateProposal ? COLORS.success : COLORS.warning}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.eligibilityTitle, { color: COLORS.text }]}>
              {canCreateProposal ? 'Eligible to create' : 'Insufficient balance'}
            </Text>
            <View style={s.eligibilityRow}>
              <Text style={[s.eligibilityKey, { color: COLORS.textSecondary }]}>Required</Text>
              <Text style={[s.eligibilityVal, { color: COLORS.text }]}>
                {daoInfo.proposalThreshold} {userInfo.tokenSymbol}
              </Text>
            </View>
            <View style={s.eligibilityRow}>
              <Text style={[s.eligibilityKey, { color: COLORS.textSecondary }]}>Your balance</Text>
              <Text style={[s.eligibilityVal, {
                color: canCreateProposal ? COLORS.success : COLORS.warning,
              }]}>
                {userInfo.tokenBalanceFormatted} {userInfo.tokenSymbol}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Treasury (shown always when available) ── */}
        {treasuryBalance !== null && (
          <View style={[s.treasuryCard, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
            <View style={[s.treasuryIcon, { backgroundColor: `${COLORS.primary}14` }]}>
              <Ionicons name="wallet-outline" size={17} color={COLORS.primary} />
            </View>
            <Text style={[s.treasuryLabel, { color: COLORS.textSecondary }]}>DAO Treasury</Text>
            <View style={{ flex: 1 }} />
            <Text style={[s.treasuryAmount, { color: COLORS.text }]}>
              {fmtTokenAmount(treasuryBalance, userInfo.tokenDecimals)}
            </Text>
            <Text style={[s.treasurySym, { color: COLORS.primary }]}>{userInfo.tokenSymbol}</Text>
          </View>
        )}

        {/* ── Proposal Type ── */}
        <SectionLabel title="Proposal Type" icon="grid-outline" COLORS={COLORS} />
        <View style={s.typeRow}>
          {types.map((t) => {
            const active = proposalType === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  s.typeCard,
                  { backgroundColor: COLORS.surface, borderColor: COLORS.border },
                  active && { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}0f` },
                  t.disabled && { opacity: 0.38 },
                ]}
                onPress={() => !t.disabled && setProposalType(t.id)}
                disabled={Boolean(t.disabled)}
                activeOpacity={0.75}
              >
                <View style={[s.typeIconWrap, {
                  backgroundColor: active ? `${COLORS.primary}20` : COLORS.background,
                }]}>
                  <Ionicons
                    name={t.icon}
                    size={22}
                    color={active ? COLORS.primary : COLORS.textSecondary}
                  />
                </View>
                <Text style={[s.typeName, { color: active ? COLORS.primary : COLORS.text }]}>
                  {t.name}
                </Text>
                <Text style={[s.typeDesc, { color: COLORS.textSecondary }]} numberOfLines={2}>
                  {t.description}
                </Text>
                {active && (
                  <Ionicons
                    name="checkmark-circle"
                    size={15}
                    color={COLORS.primary}
                    style={s.typeCheck}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {isFundingProposal && isTreasuryEmpty && (
          <View style={[s.banner, { backgroundColor: `${COLORS.warning}0f`, borderColor: `${COLORS.warning}28` }]}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
            <Text style={[s.bannerText, { color: COLORS.warning }]}>
              The treasury has no {userInfo.tokenSymbol} to fund proposals.
            </Text>
          </View>
        )}

        {/* ── Proposal Details ── */}
        <SectionLabel title="Proposal Details" icon="create-outline" COLORS={COLORS} />

        {/* Title */}
        <View style={s.fieldGroup}>
          <View style={s.labelRow}>
            <Text style={[s.label, { color: COLORS.text }]}>Title <Text style={{ color: COLORS.error }}>*</Text></Text>
            <Text style={[s.charCount, { color: charColor(title.length, 100) }]}>
              {title.length}/100
            </Text>
          </View>
          <TextInput
            placeholder="e.g., Fund community developer grant Q1"
            placeholderTextColor={COLORS.textTertiary || COLORS.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            style={[
              s.input,
              { backgroundColor: COLORS.surface, borderColor: errors.title ? COLORS.error : COLORS.border, color: COLORS.text },
              errors.title && s.inputError,
            ]}
          />
          {errors.title && <FieldError message={errors.title} COLORS={COLORS} />}
        </View>

        {/* Description */}
        <View style={s.fieldGroup}>
          <View style={s.labelRow}>
            <Text style={[s.label, { color: COLORS.text }]}>Description <Text style={{ color: COLORS.error }}>*</Text></Text>
            <Text style={[s.charCount, { color: charColor(description.length, 1000) }]}>
              {description.length}/1000
            </Text>
          </View>
          <Text style={[s.hint, { color: COLORS.textSecondary }]}>
            Include goals, rationale, and expected outcomes
          </Text>
          <TextInput
            placeholder={'Describe your proposal in detail…'}
            placeholderTextColor={COLORS.textTertiary || COLORS.textSecondary}
            value={description}
            onChangeText={setDescription}
            maxLength={1000}
            multiline
            textAlignVertical="top"
            style={[
              s.input, s.textarea,
              { backgroundColor: COLORS.surface, borderColor: errors.description ? COLORS.error : COLORS.border, color: COLORS.text },
              errors.description && s.inputError,
            ]}
          />
          {errors.description && <FieldError message={errors.description} COLORS={COLORS} />}
        </View>

        {/* ── Funding Details ── */}
        {isFundingProposal && (
          <>
            <SectionLabel title="Funding Details" icon="cash-outline" COLORS={COLORS} />

            {/* Amount */}
            <View style={s.fieldGroup}>
              <Text style={[s.label, { color: COLORS.text }]}>
                Amount <Text style={{ color: COLORS.error }}>*</Text>
              </Text>
              <Text style={[s.hint, { color: COLORS.textSecondary }]}>
                Max available: {fmtTokenAmount(treasuryBalance, userInfo.tokenDecimals)} {userInfo.tokenSymbol}
              </Text>
              <View style={[
                s.inputRow,
                { backgroundColor: COLORS.surface, borderColor: errors.amount ? COLORS.error : COLORS.border },
                errors.amount && s.inputError,
              ]}>
                <TextInput
                  placeholder="0.0"
                  placeholderTextColor={COLORS.textTertiary || COLORS.textSecondary}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  editable={!isTreasuryEmpty}
                  style={[s.inputInRow, { color: COLORS.text }]}
                />
                <View style={[s.unitPill, { backgroundColor: `${COLORS.primary}14` }]}>
                  <Text style={[s.unitText, { color: COLORS.primary }]}>{userInfo.tokenSymbol}</Text>
                </View>
              </View>
              {errors.amount && <FieldError message={errors.amount} COLORS={COLORS} />}
            </View>

            {/* Recipient */}
            <View style={s.fieldGroup}>
              <Text style={[s.label, { color: COLORS.text }]}>
                Recipient Address <Text style={{ color: COLORS.error }}>*</Text>
              </Text>
              <Text style={[s.hint, { color: COLORS.textSecondary }]}>
                Funds will be sent here if the proposal passes
              </Text>
              <TextInput
                placeholder="0x…"
                placeholderTextColor={COLORS.textTertiary || COLORS.textSecondary}
                value={recipient}
                onChangeText={setRecipient}
                editable={!isTreasuryEmpty}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  s.input, s.mono,
                  { backgroundColor: COLORS.surface, borderColor: errors.recipient ? COLORS.error : COLORS.border, color: COLORS.text },
                  errors.recipient && s.inputError,
                ]}
              />
              {errors.recipient && <FieldError message={errors.recipient} COLORS={COLORS} />}
            </View>
          </>
        )}

        {/* ── Protocol Upgrade ── */}
        {isProtocolUpgrade && (
          <>
            <SectionLabel title="Protocol Configuration" icon="settings-outline" COLORS={COLORS} />

            <View style={s.fieldGroup}>
              <Text style={[s.label, { color: COLORS.text, marginBottom: 10 }]}>Action Type</Text>
              <View style={s.actionList}>
                {Object.entries(PROTOCOL_ACTIONS).map(([key, cfg]) => {
                  const active = protocolAction === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        s.actionRow,
                        { backgroundColor: COLORS.surface, borderColor: COLORS.border },
                        active && { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}0c` },
                      ]}
                      onPress={() => setProtocolAction(key)}
                      activeOpacity={0.75}
                    >
                      <View style={[s.actionIconWrap, {
                        backgroundColor: active ? `${COLORS.primary}18` : COLORS.background,
                      }]}>
                        <Ionicons name={cfg.icon} size={16} color={active ? COLORS.primary : COLORS.textSecondary} />
                      </View>
                      <Text style={[s.actionLabel, { color: active ? COLORS.primary : COLORS.text }]}>
                        {cfg.label}
                      </Text>
                      {active && <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[s.hint, { color: COLORS.textSecondary, marginTop: 8 }]}>
                {protocolCfg.helper}
              </Text>
            </View>

            {/* Value input */}
            {protocolCfg.inputType === 'address-only' ? (
              <View style={s.fieldGroup}>
                <Text style={[s.label, { color: COLORS.text }]}>
                  {protocolCfg.inputLabel} <Text style={{ color: COLORS.error }}>*</Text>
                </Text>
                <TextInput
                  placeholder={protocolCfg.placeholder}
                  placeholderTextColor={COLORS.textTertiary || COLORS.textSecondary}
                  value={newTokenAddress}
                  onChangeText={setNewTokenAddress}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    s.input, s.mono,
                    { backgroundColor: COLORS.surface, borderColor: errors.newTokenAddress ? COLORS.error : COLORS.border, color: COLORS.text },
                    errors.newTokenAddress && s.inputError,
                  ]}
                />
                {errors.newTokenAddress && <FieldError message={errors.newTokenAddress} COLORS={COLORS} />}
              </View>
            ) : (
              <View style={s.fieldGroup}>
                <Text style={[s.label, { color: COLORS.text }]}>
                  {protocolCfg.inputLabel} <Text style={{ color: COLORS.error }}>*</Text>
                </Text>
                <View style={[
                  s.inputRow,
                  { backgroundColor: COLORS.surface, borderColor: errors.newValue ? COLORS.error : COLORS.border },
                  errors.newValue && s.inputError,
                ]}>
                  <TextInput
                    placeholder={protocolCfg.placeholder}
                    placeholderTextColor={COLORS.textTertiary || COLORS.textSecondary}
                    value={newValue}
                    onChangeText={setNewValue}
                    keyboardType="decimal-pad"
                    style={[s.inputInRow, { color: COLORS.text }]}
                  />
                  <View style={[s.unitPill, { backgroundColor: `${COLORS.primary}14` }]}>
                    <Text style={[s.unitText, { color: COLORS.primary }]}>
                      {protocolCfg.inputType === 'percentage' ? '%'
                        : protocolCfg.inputType === 'days' ? 'days'
                        : userInfo.tokenSymbol}
                    </Text>
                  </View>
                </View>
                {errors.newValue && <FieldError message={errors.newValue} COLORS={COLORS} />}
              </View>
            )}
          </>
        )}

        {/* ── How it works ── */}
        <View style={[s.howCard, { backgroundColor: `${COLORS.info || '#2196F3'}0e`, borderColor: `${COLORS.info || '#2196F3'}28` }]}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.info || '#2196F3'} style={{ marginTop: 1 }} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[s.howTitle, { color: COLORS.text }]}>How it works</Text>
            {[
              'Create a proposal with clear details',
              'Community votes during the voting period',
              'Passed proposals are queued then executed',
            ].map((line, i) => (
              <View key={i} style={s.howRow}>
                <View style={[s.howDot, { backgroundColor: COLORS.info || '#2196F3' }]} />
                <Text style={[s.howText, { color: COLORS.textSecondary }]}>{line}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Actions ── */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.cancelBtn, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}
            onPress={handleClose}
            activeOpacity={0.75}
          >
            <Text style={[s.cancelText, { color: COLORS.text }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              s.submitBtn,
              { backgroundColor: COLORS.primary },
              !isFormValid && s.submitDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isFormValid}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={s.submitText}>Create Proposal</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {txParams && (
        <TransactionModal
          visible={showTxModal}
          onClose={() => setShowTxModal(false)}
          contractAddress={txParams.contractAddress}
          contractABI={txParams.contractABI}
          functionName={txParams.functionName}
          args={txParams.args}
          value={txParams.value}
          title={txParams.title}
          description={txParams.description}
          onSuccess={(receipt) => {
            if (txParams.onSuccess) txParams.onSuccess(receipt);
            handleTxSuccess();
          }}
          onError={handleTxError}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  loading: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadingText: { fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  headerSub: { fontSize: 12, marginTop: 1 },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  // Eligibility
  eligibilityCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  eligibilityIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  eligibilityTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  eligibilityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  eligibilityKey: { fontSize: 12 },
  eligibilityVal: { fontSize: 12, fontWeight: '700' },

  // Treasury
  treasuryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 4,
  },
  treasuryIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  treasuryLabel: { fontSize: 12, fontWeight: '500' },
  treasuryAmount: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  treasurySym: { fontSize: 12, fontWeight: '700', marginLeft: 4 },

  // Proposal type cards
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  typeCard: {
    flex: 1, borderRadius: 14, borderWidth: 1.5,
    padding: 12, alignItems: 'center', gap: 6,
  },
  typeIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeName: { fontSize: 13, fontWeight: '700' },
  typeDesc: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
  typeCheck: { position: 'absolute', top: 8, right: 8 },

  // Banner
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 8,
  },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '500' },

  // Field
  fieldGroup: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600' },
  charCount: { fontSize: 11, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  input: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14,
  },
  textarea: { minHeight: 130, paddingTop: 12, textAlignVertical: 'top' },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 },
  inputError: { borderWidth: 1.5 },

  // Row input (with unit badge)
  inputRow: {
    flexDirection: 'row', alignItems: 'stretch',
    borderRadius: 12, borderWidth: 1, overflow: 'hidden',
  },
  inputInRow: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  unitPill: {
    paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center',
    minWidth: 56,
  },
  unitText: { fontSize: 12, fontWeight: '800' },

  // Protocol actions
  actionList: { gap: 6 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  actionIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: '600' },

  // How it works
  howCard: {
    flexDirection: 'row', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 8,
  },
  howTitle: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  howDot: { width: 5, height: 5, borderRadius: 3 },
  howText: { fontSize: 12, lineHeight: 17 },

  // Actions
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, height: 52, borderRadius: 14,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600' },
  submitBtn: {
    flex: 2, height: 52, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitDisabled: { opacity: 0.38 },
  submitText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
