import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ChainIcon from '../../components/common/ChainIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../../contexts/WalletContext';
import { useAuth } from '../../contexts/AuthContext';
import { useChain } from '../../contexts/ChainContext';
import { useTheme } from '../../contexts/ThemeContext';
import QRScanner from '../../components/wallet/QRScanner';
import ChainSwitcher from '../../components/wallet/ChainSwitcher';
import { TransactionModal } from '../../components/TransactionModal';
import TransactionSuccessScreen from '../../components/TransactionSuccessScreen';
import { validateAddress } from '../../utils/Validators';
import {
  getUserByUid, getAllTokens, getContactsByUserId,
  getTransactionsByWallet, saveTransaction,
} from '../../utils/Database';
import { formatAddress } from '../../utils/Wallet';
import CoinGeckoService from '../../services/NewCoinGecko';
import { parseUnits, JsonRpcProvider } from 'ethers';
import Alert from '../../utils/Alert';
import {
  estimateNativeTransferGas, estimateTokenTransferGas, getTokenBalance,
} from '../../utils/blockchain';

// ─── Constants ────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

const ENS_SUFFIXES = ['.eth', '.xyz', '.app', '.luxe', '.art'];
const isEns = (s) => ENS_SUFFIXES.some(sfx => s.toLowerCase().endsWith(sfx));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const resolveEns = async (name) => {
  try {
    const provider = new JsonRpcProvider('https://eth.llamarpc.com');
    return await provider.resolveName(name);
  } catch { return null; }
};

const fmtBal = (n) => {
  const v = parseFloat(n);
  if (isNaN(v) || v === 0) return '0';
  if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (v >= 1) return v.toFixed(4);
  return v.toFixed(6);
};

const fmtUsd = (v) => {
  if (v == null || isNaN(v)) return null;
  if (v < 0.01) return '< $0.01';
  if (v < 1000) return `$${v.toFixed(2)}`;
  if (v < 1_000_000) return `$${(v / 1000).toFixed(2)}K`;
  return `$${(v / 1_000_000).toFixed(2)}M`;
};

const getUsd = (amount, price) => {
  if (!amount || !price?.usd) return null;
  const v = parseFloat(amount) * price.usd;
  return isNaN(v) ? null : v;
};

// ─── TokenLogo ────────────────────────────────────────────────────────────────
const TokenLogo = memo(({ uri, symbol, size = 44, color }) => {
  const [err, setErr] = useState(false);
  if (uri && !err) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setErr(true)}
        fadeDuration={0}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color + '22',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '800', color }}>
        {symbol?.charAt(0)?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
});

// ─── SendScreen ───────────────────────────────────────────────────────────────
const SendScreen = ({ navigation, route }) => {
  const theme = useTheme();
  const { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } = theme;
  const { wallet, balances, refreshBalances } = useWallet();
  const { user } = useAuth();
  const { activeChain } = useChain();
  const insets = useSafeAreaInsets();
  const { token: routeToken, recipient: routeRecipient } = route.params || {};

  const S = useMemo(() => createStyles(COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS), [theme]);

  // ── Stage ─────────────────────────────────────────────────────────────────
  const [stage, setStage] = useState(routeToken ? 2 : 1);

  // ── Token data ───────────────────────────────────────────────────────────
  const [availableTokens, setAvailableTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedToken, setSelectedToken] = useState(routeToken || null);

  // ── Send state ───────────────────────────────────────────────────────────
  const [recipient, setRecipient] = useState(routeRecipient || '');
  const [ensResult, setEnsResult] = useState(null);
  const [ensLoading, setEnsLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [gasEstimate, setGasEstimate] = useState(null);
  const [estimatingGas, setEstimatingGas] = useState(false);
  const [errors, setErrors] = useState({});
  const [contacts, setContacts] = useState([]);
  const [recentAddresses, setRecentAddresses] = useState([]);

  // ── UI ───────────────────────────────────────────────────────────────────
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showChainSwitcher, setShowChainSwitcher] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [successData, setSuccessData] = useState({});

  const ensDebounceRef = useRef(null);
  const gasDebounceRef = useRef(null);

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => { loadData(); }, [activeChain]);
  useEffect(() => { if (routeToken) { setSelectedToken(routeToken); setStage(2); } }, [routeToken]);

  const loadData = async () => {
    try {
      setLoadingTokens(true);
      const dbUser = await getUserByUid(user.uid);
      const allDbTokens = await getAllTokens(dbUser.id);
      const chainTokens = allDbTokens.filter(t => t.chain_id === activeChain.id);

      const tokensWithData = await Promise.all(
        chainTokens.map(async (token) => {
          try {
            const balance = await getTokenBalance(token.address, wallet.address, activeChain);
            const coinInfo = await CoinGeckoService.getTokenInfo(token.symbol, token.address);
            return { ...token, balance: balance.formatted, logo: coinInfo?.logo || token.logo || null, price: coinInfo?.price || null };
          } catch {
            return { ...token, balance: '0', logo: token.logo || null, price: null };
          }
        })
      );

      const nativeBalance = balances[activeChain.id]?.formatted || '0';
      const nativeInfo = await CoinGeckoService.getTokenInfo(activeChain.symbol);
      const nativeToken = {
        id: 'native', symbol: activeChain.symbol, name: activeChain.name,
        address: null, balance: nativeBalance, decimals: 18, isNative: true,
        logo: nativeInfo?.logo || activeChain.icon || null, price: nativeInfo?.price || null,
      };

      const withBalance = tokensWithData.filter(t => parseFloat(t.balance) > 0);
      setAvailableTokens([nativeToken, ...withBalance]);
      if (!selectedToken && !routeToken) setSelectedToken(nativeToken);

      const userContacts = await getContactsByUserId(dbUser.id);
      setContacts(userContacts);

      const txns = await getTransactionsByWallet(wallet.id, 20);
      const recents = [...new Set(
        txns.filter(tx => tx.from_address.toLowerCase() !== wallet.address.toLowerCase()).map(tx => tx.to_address)
      )].slice(0, 5);
      setRecentAddresses(recents);
    } catch (err) {
      console.error('[SendScreen] loadData:', err);
    } finally {
      setLoadingTokens(false);
    }
  };

  // ── ENS resolution ───────────────────────────────────────────────────────
  useEffect(() => {
    if (ensDebounceRef.current) clearTimeout(ensDebounceRef.current);
    setEnsResult(null);
    if (!recipient.trim() || !isEns(recipient.trim())) return;
    ensDebounceRef.current = setTimeout(async () => {
      setEnsLoading(true);
      const resolved = await resolveEns(recipient.trim());
      setEnsLoading(false);
      setEnsResult(resolved ? { address: resolved, name: recipient.trim() } : { failed: true });
    }, 600);
  }, [recipient]);

  const effectiveAddress = useMemo(() => {
    if (ensResult?.address) return ensResult.address;
    return validateAddress(recipient).isValid ? recipient : null;
  }, [recipient, ensResult]);

  // ── Gas estimation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (gasDebounceRef.current) clearTimeout(gasDebounceRef.current);
    setGasEstimate(null);
    if (!effectiveAddress || !amount || parseFloat(amount) <= 0 || !selectedToken) return;
    gasDebounceRef.current = setTimeout(async () => {
      try {
        setEstimatingGas(true);
        const est = selectedToken.isNative
          ? await estimateNativeTransferGas(wallet.address, effectiveAddress, amount, activeChain)
          : await estimateTokenTransferGas(wallet.address, selectedToken.address, effectiveAddress, amount, selectedToken.decimals, activeChain);
        setGasEstimate(est);
        setErrors(p => ({ ...p, gas: null }));
      } catch {
        setErrors(p => ({ ...p, gas: 'Cannot estimate fee — check amount' }));
      } finally {
        setEstimatingGas(false);
      }
    }, 500);
  }, [effectiveAddress, amount, selectedToken]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const setMaxAmount = useCallback(() => {
    if (!selectedToken) return;
    if (selectedToken.isNative && gasEstimate) {
      setAmount(Math.max(0, parseFloat(selectedToken.balance) - parseFloat(gasEstimate.totalCost) - 0.000001).toFixed(6));
    } else if (selectedToken.isNative) {
      setAmount((parseFloat(selectedToken.balance) * 0.99).toFixed(6));
    } else {
      setAmount(selectedToken.balance);
    }
  }, [selectedToken, gasEstimate]);

  const handleSend = () => {
    const errs = {};
    if (!effectiveAddress) errs.recipient = 'Enter a valid address or ENS name';
    if (!amount || parseFloat(amount) <= 0) errs.amount = 'Enter an amount';
    else if (parseFloat(amount) > parseFloat(selectedToken?.balance || '0')) errs.amount = 'Insufficient balance';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setShowTransactionModal(true);
  };

  const handleTransactionSuccess = (receipt) => {
    // Show full-screen success immediately (synchronous state update)
    setSuccessData({
      tokenSymbol: selectedToken?.symbol,
      tokenLogo: selectedToken?.logo,
      tokenAmount: amount,
      amountUsd: amountUsd != null ? fmtUsd(amountUsd) : null,
      recipientAddress: effectiveAddress,
    });
    setShowSuccessScreen(true);

    // Save transaction record in background (non-critical)
    (async () => {
      try {
        const dbUser = await getUserByUid(user.uid);
        await saveTransaction({
          wallet_id: wallet.id, user_id: dbUser.id, hash: receipt.hash,
          from_address: wallet.address, to_address: effectiveAddress,
          value: amount, token_address: selectedToken?.isNative ? null : selectedToken.address,
          token_symbol: selectedToken.symbol, gas_used: receipt.gasUsed?.toString(),
          gas_price: receipt.gasPrice?.toString(), status: 'confirmed',
          chain_id: activeChain.id, type: selectedToken?.isNative ? 'send' : 'token_transfer',
        });
      } catch { /* non-critical */ }
    })();
  };

  const handleSuccessDismiss = () => {
    setShowSuccessScreen(false);
    // Navigate to wallet home — pop back to root of this stack
    navigation.popToTop();
  };

  const handleTransactionError = (error) => {
    if (error?.type !== 'cancelled')
      Alert.alert(error?.title || 'Transaction Failed', error?.message || 'Something went wrong.');
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const amountUsd = getUsd(amount, selectedToken?.price);
  const gasFeeUsd = gasEstimate ? getUsd(gasEstimate.totalCost, availableTokens.find(t => t.isNative)?.price) : null;

  const txConfig = useMemo(() => {
    if (!selectedToken || !effectiveAddress || !amount) return null;
    if (selectedToken.isNative) return { isNative: true, to: effectiveAddress, value: amount };
    try {
      const wei = parseUnits(amount, selectedToken.decimals);
      return { isNative: false, contractAddress: selectedToken.address, contractABI: ERC20_ABI, functionName: 'transfer', args: [effectiveAddress, wei], value: '0' };
    } catch { return null; }
  }, [selectedToken, effectiveAddress, amount]);

  const displayTokens = useMemo(() => {
    if (!searchQuery.trim()) return availableTokens;
    const q = searchQuery.toLowerCase();
    return availableTokens.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
  }, [availableTokens, searchQuery]);

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loadingTokens) {
    return (
      <View style={[S.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={S.loaderText}>Loading assets…</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE 1 — Token selection
  // ─────────────────────────────────────────────────────────────────────────
  if (stage === 1) {
    return (
      <View style={S.root}>
        <View style={[S.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={S.headerTitle}>Send</Text>
          <TouchableOpacity style={S.iconBtn} onPress={() => setShowChainSwitcher(true)}>
            <ChainIcon chain={activeChain} size={20} style={S.chainIcon} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={S.searchRow}>
          <Ionicons name="search-outline" size={15} color={COLORS.textTertiary} />
          <TextInput
            style={S.searchInput}
            placeholder="Search assets…"
            placeholderTextColor={COLORS.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={15} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={S.stageSubtitle}>Select an asset to send</Text>

        <FlatList
          data={displayTokens}
          keyExtractor={t => String(t.id)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={S.separator} />}
          ListEmptyComponent={
            <View style={S.emptyState}>
              <Ionicons name="wallet-outline" size={44} color={COLORS.textTertiary} />
              <Text style={S.emptyTitle}>No assets found</Text>
              <Text style={S.emptySubtitle}>
                {searchQuery ? 'No matching tokens' : 'Tokens with balance appear here'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const balUsd = item.price?.usd ? parseFloat(item.balance) * item.price.usd : null;
            return (
              <TouchableOpacity
                style={S.tokenRow}
                onPress={() => { setSelectedToken(item); setAmount(''); setGasEstimate(null); setStage(2); }}
                activeOpacity={0.7}
              >
                <TokenLogo uri={item.logo} symbol={item.symbol} size={46} color={COLORS.primary} />
                <View style={S.tokenRowInfo}>
                  <Text style={S.tokenRowSymbol}>{item.symbol}</Text>
                  <Text style={S.tokenRowName} numberOfLines={1}>{item.name}</Text>
                  {item.price?.usd && (
                    <Text style={S.tokenRowPrice}>
                      ${item.price.usd >= 1 ? item.price.usd.toFixed(2) : item.price.usd.toFixed(4)}
                      {item.price.usd_24h_change != null && (
                        <Text style={{ color: item.price.usd_24h_change >= 0 ? COLORS.primary : COLORS.error }}>
                          {' '}{item.price.usd_24h_change >= 0 ? '▲' : '▼'}{Math.abs(item.price.usd_24h_change).toFixed(2)}%
                        </Text>
                      )}
                    </Text>
                  )}
                </View>
                <View style={S.tokenRowRight}>
                  <Text style={S.tokenRowBal}>{fmtBal(item.balance)}</Text>
                  <Text style={S.tokenRowSymbolSmall}>{item.symbol}</Text>
                  {balUsd != null && <Text style={S.tokenRowUsd}>{fmtUsd(balUsd)}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={15} color={COLORS.textTertiary} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            );
          }}
        />

        <ChainSwitcher visible={showChainSwitcher} onClose={() => setShowChainSwitcher(false)} />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE 2 — Send
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={S.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[S.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={S.backBtn} onPress={() => setStage(1)}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity style={S.tokenHeaderChip} onPress={() => setStage(1)} activeOpacity={0.75}>
          <TokenLogo uri={selectedToken?.logo} symbol={selectedToken?.symbol} size={26} color={COLORS.primary} />
          <View>
            <Text style={S.tokenHeaderSymbol}>{selectedToken?.symbol}</Text>
            <Text style={S.tokenHeaderBal}>{fmtBal(selectedToken?.balance)} available</Text>
          </View>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={S.iconBtn} onPress={() => setShowChainSwitcher(true)}>
          {activeChain?.icon
            ? <Image source={{ uri: activeChain.icon }} style={S.chainIcon} />
            : <Ionicons name="globe-outline" size={16} color={COLORS.textSecondary} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <>
          {/* ── Address card ── */}
          <View style={S.card}>
            <View style={S.cardLabelRow}>
              <Text style={S.cardLabel}>To</Text>
              <TouchableOpacity style={S.miniIconBtn} onPress={() => setShowQRScanner(true)}>
                <Ionicons name="scan-outline" size={15} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {/* Contacts / recents horizontal */}
            {(contacts.length > 0 || recentAddresses.length > 0) && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingBottom: 10 }}
              >
                {contacts.map(c => (
                  <TouchableOpacity key={c.id} style={S.contactChip} onPress={() => setRecipient(c.address)} activeOpacity={0.75}>
                    <View style={S.contactAvatar}>
                      <Text style={S.contactAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={S.contactChipName} numberOfLines={1}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
                {recentAddresses.map((addr, i) => (
                  <TouchableOpacity key={i} style={S.contactChip} onPress={() => setRecipient(addr)} activeOpacity={0.75}>
                    <View style={[S.contactAvatar, { backgroundColor: COLORS.surface }]}>
                      <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
                    </View>
                    <Text style={S.contactChipName}>{formatAddress(addr, 6)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Address input — no box, underline only */}
            <View style={[S.addressInputRow, errors.recipient && S.addressInputRowError]}>
              <TextInput
                style={S.addressInputText}
                placeholder="0x address or name.eth"
                placeholderTextColor={COLORS.textTertiary}
                value={recipient}
                onChangeText={t => { setRecipient(t); setErrors(p => ({ ...p, recipient: null })); }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
              {ensLoading && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 6 }} />}
              {!ensLoading && ensResult && !ensResult.failed && (
                <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
              )}
              {!ensLoading && ensResult?.failed && (
                <Ionicons name="close-circle" size={18} color={COLORS.error} />
              )}
            </View>

            {ensResult && !ensResult.failed && (
              <View style={S.ensBadge}>
                <Ionicons name="checkmark-circle" size={11} color={COLORS.primary} />
                <Text style={S.ensBadgeText}>{formatAddress(ensResult.address, 10)}</Text>
              </View>
            )}
            {ensResult?.failed && <Text style={S.ensError}>ENS name could not be resolved</Text>}
            {errors.recipient && <Text style={S.errorText}>{errors.recipient}</Text>}
          </View>

            {/* ── Amount card ── */}
            <View style={S.card}>
              <View style={S.cardLabelRow}>
                <Text style={S.cardLabel}>Amount</Text>
                <Text style={S.cardBalText}>
                  Bal  {fmtBal(selectedToken?.balance)} {selectedToken?.symbol}
                </Text>
              </View>

              <TextInput
                style={[S.amountBigInput, errors.amount && { color: COLORS.error }]}
                placeholder="0"
                placeholderTextColor={COLORS.textTertiary + '80'}
                value={amount}
                onChangeText={t => {
                  const clean = t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                  setAmount(clean);
                  setErrors(p => ({ ...p, amount: null }));
                }}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />

              {amountUsd != null && amount ? (
                <Text style={S.amountUsdText}>≈ {fmtUsd(amountUsd)}</Text>
              ) : null}

              {/* PCT row */}
              <View style={S.pctRow}>
                {[['25%', 0.25], ['50%', 0.5], ['75%', 0.75], ['MAX', 1]].map(([label, pct]) => (
                  <TouchableOpacity
                    key={label}
                    style={S.pctBtn}
                    onPress={() => {
                      if (label === 'MAX') { setMaxAmount(); return; }
                      const bal = parseFloat(selectedToken?.balance || '0');
                      setAmount((bal * pct).toFixed(6).replace(/\.?0+$/, ''));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={S.pctBtnText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {errors.amount && <Text style={[S.errorText, { marginTop: 6 }]}>{errors.amount}</Text>}
            </View>

            {/* ── Gas inline ── */}
            {(estimatingGas || gasEstimate || errors.gas) && (
              <View style={S.gasRow}>
                <Ionicons name="flash-outline" size={13} color={COLORS.textTertiary} />
                {estimatingGas ? (
                  <>
                    <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 4 }} />
                    <Text style={S.gasText}>Estimating fee…</Text>
                  </>
                ) : errors.gas ? (
                  <Text style={[S.gasText, { color: COLORS.error }]}>{errors.gas}</Text>
                ) : gasEstimate ? (
                  <>
                    <Text style={S.gasText}>~{parseFloat(gasEstimate.totalCost).toFixed(5)} {activeChain.symbol}</Text>
                    {gasFeeUsd != null && <Text style={S.gasUsd}>· {fmtUsd(gasFeeUsd)}</Text>}
                  </>
                ) : null}
              </View>
            )}

            {/* ── Summary ── */}
            {!!amount && parseFloat(amount) > 0 && selectedToken && (
              <View style={S.summaryCard}>
                <View style={S.summaryLeft}>
                  <TokenLogo uri={selectedToken.logo} symbol={selectedToken.symbol} size={30} color={COLORS.primary} />
                  <View>
                    <Text style={S.summaryAmount}>{amount} {selectedToken.symbol}</Text>
                    {amountUsd != null && <Text style={S.summaryAmountUsd}>{fmtUsd(amountUsd)}</Text>}
                  </View>
                </View>
                <View style={S.summaryArrow}>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.textTertiary} />
                </View>
                <View style={S.summaryRight}>
                  {effectiveAddress ? (
                    <>
                      <Text style={S.summaryAddr}>{formatAddress(effectiveAddress, 8)}</Text>
                      {ensResult?.name && <Text style={S.summaryEns}>{ensResult.name}</Text>}
                    </>
                  ) : (
                    <Text style={S.summaryNoAddr}>No recipient yet</Text>
                  )}
                </View>
              </View>
            )}

            {/* ── Send button ── */}
            <TouchableOpacity
              style={[
                S.ctaBtn,
                (!effectiveAddress || !amount || parseFloat(amount) <= 0 || estimatingGas) && S.ctaBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={!effectiveAddress || !amount || parseFloat(amount) <= 0 || estimatingGas}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane" size={17} color="#fff" style={{ marginRight: 8 }} />
              <Text style={S.ctaBtnText}>Send {selectedToken?.symbol}</Text>
            </TouchableOpacity>

            <Text style={S.helperText}>Review all details carefully before confirming</Text>
          </>
      </ScrollView>

      {/* Modals */}
      <QRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={(addr) => { setRecipient(addr); setShowQRScanner(false); }}
      />
      <ChainSwitcher visible={showChainSwitcher} onClose={() => setShowChainSwitcher(false)} />
      {txConfig && (
        <TransactionModal
          visible={showTransactionModal}
          onClose={() => setShowTransactionModal(false)}
          contractAddress={txConfig.isNative ? null : txConfig.contractAddress}
          contractABI={txConfig.isNative ? null : txConfig.contractABI}
          functionName={txConfig.isNative ? null : txConfig.functionName}
          args={txConfig.isNative ? null : txConfig.args}
          value={txConfig.value}
          isNativeTransfer={txConfig.isNative}
          to={txConfig.isNative ? txConfig.to : null}
          title={`Send ${selectedToken?.symbol}`}
          onSuccess={handleTransactionSuccess}
          onError={handleTransactionError}
          tokenLogo={selectedToken?.logo}
          tokenSymbol={selectedToken?.symbol}
          tokenAmount={amount}
          amountUsd={amountUsd != null ? fmtUsd(amountUsd) : null}
          recipientAddress={effectiveAddress}
          nativeTokenPrice={availableTokens.find(t => t.isNative)?.price?.usd ?? null}
          chainSymbol={activeChain.symbol}
        />
      )}

      <TransactionSuccessScreen
        visible={showSuccessScreen}
        onDismiss={handleSuccessDismiss}
        {...successData}
      />
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.background },
    loaderText: { marginTop: 12, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: SPACING.md, paddingBottom: 10,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
      ...SHADOWS.small,
    },
    headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
    iconBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
      ...SHADOWS.small,
    },
    chainIcon: { width: 20, height: 20, borderRadius: 10 },

    // Stage 1
    searchRow: {
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: SPACING.md, marginBottom: SPACING.xs,
      backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg,
      paddingHorizontal: SPACING.md, paddingVertical: 9, gap: 8,
    },
    searchInput: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.text },
    stageSubtitle: {
      fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.8,
      marginHorizontal: SPACING.md, marginBottom: SPACING.sm, marginTop: SPACING.xs,
    },
    tokenRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: SPACING.md, paddingVertical: 13,
    },
    tokenRowInfo: { flex: 1, marginLeft: SPACING.sm },
    tokenRowSymbol: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
    tokenRowName: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: 1 },
    tokenRowPrice: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
    tokenRowRight: { alignItems: 'flex-end', marginRight: 4 },
    tokenRowBal: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.text },
    tokenRowSymbolSmall: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },
    tokenRowUsd: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 1 },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.border + '60',
      marginHorizontal: SPACING.md,
    },
    emptyState: { paddingTop: 72, alignItems: 'center', gap: 10 },
    emptyTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text },
    emptySubtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 32 },

    // Stage 2 header
    tokenHeaderChip: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: COLORS.surface, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 6,
      ...SHADOWS.small,
    },
    tokenHeaderSymbol: { fontSize: FONTS.sizes.sm, fontWeight: '800', color: COLORS.text },
    tokenHeaderBal: { fontSize: 10, color: COLORS.textSecondary },

    scroll: { paddingHorizontal: SPACING.md, gap: 10 },

    // Cards
    card: {
      backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.md, ...SHADOWS.small,
    },
    cardLabelRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    cardLabel: {
      fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.9,
    },
    cardBalText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
    miniIconBtn: {
      width: 30, height: 30, borderRadius: 8,
      backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center',
    },

    // Contacts
    contactChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: COLORS.background, borderRadius: 20,
      paddingHorizontal: 9, paddingVertical: 5,
      borderWidth: 1, borderColor: COLORS.border,
    },
    contactAvatar: {
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    },
    contactAvatarText: { fontSize: 9, fontWeight: '800', color: '#fff' },
    contactChipName: { fontSize: FONTS.sizes.xs, fontWeight: '600', color: COLORS.text, maxWidth: 68 },

    // Address input — underline only, no box
    addressInputRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: COLORS.border + '70',
      marginTop: 4, gap: 8,
    },
    addressInputRowError: { borderBottomColor: COLORS.error },
    addressInputText: {
      flex: 1, fontSize: FONTS.sizes.md, color: COLORS.text,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      padding: 0,
    },

    // ENS feedback
    ensBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
      paddingHorizontal: 8, paddingVertical: 3,
      backgroundColor: COLORS.primary + '15', borderRadius: 6, alignSelf: 'flex-start',
    },
    ensBadgeText: {
      fontSize: FONTS.sizes.xs, fontWeight: '600', color: COLORS.primary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    ensError: { marginTop: 5, fontSize: FONTS.sizes.xs, color: COLORS.error },
    errorText: { fontSize: FONTS.sizes.xs, color: COLORS.error },

    // Amount
    amountBigInput: {
      fontSize: 46, fontWeight: '800', color: COLORS.text,
      letterSpacing: -1.5, includeFontPadding: false,
      paddingVertical: SPACING.xs,
    },
    amountUsdText: { fontSize: FONTS.sizes.sm, color: COLORS.textTertiary, marginBottom: SPACING.sm },

    // PCT
    pctRow: { flexDirection: 'row', gap: 6, marginTop: SPACING.xs },
    pctBtn: {
      flex: 1, paddingVertical: 6, borderRadius: 8,
      backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
      alignItems: 'center',
    },
    pctBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },

    // Gas
    gasRow: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: SPACING.xs,
    },
    gasText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
    gasUsd: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },

    // Summary
    summaryCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.md, ...SHADOWS.small,
    },
    summaryLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    summaryAmount: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
    summaryAmountUsd: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
    summaryArrow: { marginHorizontal: 8 },
    summaryRight: { flex: 1, alignItems: 'flex-end' },
    summaryAddr: {
      fontSize: FONTS.sizes.xs, fontWeight: '600', color: COLORS.text,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    summaryEns: { fontSize: 10, color: COLORS.primary, marginTop: 1 },
    summaryNoAddr: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary },

    // CTA
    ctaBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.xl,
      paddingVertical: SPACING.md + 2,
      ...SHADOWS.large,
    },
    ctaBtnDisabled: { opacity: 0.4 },
    ctaBtnText: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
    helperText: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, textAlign: 'center', marginTop: 4 },

  });

export default SendScreen;
