import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, Modal, ActivityIndicator,
  Image, Share, Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import ChainIcon from '../../components/common/ChainIcon';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../../contexts/WalletContext';
import { useAuth } from '../../contexts/AuthContext';
import { useChain } from '../../contexts/ChainContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatAddress } from '../../utils/Wallet';
import Alert from '../../utils/Alert';
import { getUserByUid, getAllTokens } from '../../utils/Database';
import { getTokenBalance } from '../../utils/blockchain';
import CoinGeckoService from '../../services/NewCoinGecko';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtUsd = (v) => {
  if (v == null || isNaN(v)) return null;
  if (v < 0.01) return '< $0.01';
  if (v < 1000) return `$${v.toFixed(2)}`;
  return `$${(v / 1000).toFixed(2)}K`;
};

// ─── TokenLogo ────────────────────────────────────────────────────────────────
const TokenLogo = memo(({ uri, symbol, size = 36, color }) => {
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
      backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '800', color }}>
        {symbol?.charAt(0)?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
});

// ─── ReceiveScreen ────────────────────────────────────────────────────────────
const ReceiveScreen = ({ navigation }) => {
  const theme = useTheme();
  const { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } = theme;
  const { wallet, balances } = useWallet();
  const { user } = useAuth();
  const { activeChain } = useChain();
  const insets = useSafeAreaInsets();

  // Fallback to selectedChain if activeChain not available
  const chain = activeChain;

  const S = useMemo(() => createStyles(COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS), [theme]);

  // ── Mode ─────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState('receive'); // 'receive' | 'request'

  // ── Receive state ─────────────────────────────────────────────────────────
  const copyAddress = async () => {
    if (wallet?.address) {
      await Clipboard.setStringAsync(wallet.address);
      Alert.alert('Copied', 'Address copied to clipboard.');
    }
  };

  const shareAddress = async () => {
    try {
      await Share.share({
        message: `My ${chain?.name} Address:\n${wallet?.address}`,
        title: 'Share Wallet Address',
      });
    } catch { }
  };

  // ── Request state ─────────────────────────────────────────────────────────
  const [requestToken, setRequestToken] = useState(null);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestLink, setRequestLink] = useState(null);
  const [availableTokens, setAvailableTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);

  // Load tokens when entering request tab
  useEffect(() => {
    if (mode === 'request' && availableTokens.length === 0) {
      loadTokens();
    }
  }, [mode]);

  const loadTokens = async () => {
    if (!user || !wallet?.address || !chain) return;
    try {
      setLoadingTokens(true);
      const dbUser = await getUserByUid(user.uid);
      const allDbTokens = await getAllTokens(dbUser.id);
      const chainTokens = allDbTokens.filter(t => t.chain_id === chain.id);

      const withData = await Promise.all(
        chainTokens.map(async (token) => {
          try {
            const balance = await getTokenBalance(token.address, wallet.address, chain);
            const info = await CoinGeckoService.getTokenInfo(token.symbol, token.address);
            return { ...token, balance: balance.formatted, logo: info?.logo || token.logo || null, price: info?.price || null };
          } catch {
            return { ...token, balance: '0', logo: token.logo || null, price: null };
          }
        })
      );

      const nativeBalance = balances[chain.id]?.formatted || '0';
      const nativeInfo = await CoinGeckoService.getTokenInfo(chain.symbol);
      const nativeToken = {
        id: 'native', symbol: chain.symbol, name: chain.name,
        address: null, balance: nativeBalance, decimals: 18, isNative: true,
        logo: nativeInfo?.logo || chain.icon || null, price: nativeInfo?.price || null,
      };

      const withBalance = withData.filter(t => parseFloat(t.balance) > 0);
      const all = [nativeToken, ...withBalance];
      setAvailableTokens(all);
      if (!requestToken) setRequestToken(nativeToken);
    } catch (err) {
      console.error('[ReceiveScreen] loadTokens:', err);
    } finally {
      setLoadingTokens(false);
    }
  };

  const generateRequestLink = () => {
    if (!wallet?.address) return;
    const params = [
      `to=${encodeURIComponent(wallet.address)}`,
      `amount=${encodeURIComponent(requestAmount || '0')}`,
      `token=${encodeURIComponent(requestToken?.symbol || chain?.symbol || '')}`,
      `tokenAddress=${encodeURIComponent(requestToken?.isNative ? 'native' : (requestToken?.address || 'native'))}`,
      `chain=${chain?.id || ''}`,
    ].join('&');
    setRequestLink(`nexuswallet://pay?${params}`);
  };

  const copyLink = async () => {
    if (!requestLink) return;
    await Clipboard.setStringAsync(requestLink);
    Alert.alert('Copied', 'Payment link copied to clipboard.');
  };

  const shareLink = async () => {
    if (!requestLink) return;
    try { await Share.share({ message: requestLink, title: 'Payment Request' }); } catch { }
  };

  const requestAmountUsd = useMemo(() => {
    if (!requestAmount || !requestToken?.price?.usd) return null;
    return parseFloat(requestAmount) * requestToken.price.usd;
  }, [requestAmount, requestToken]);

  if (!wallet) {
    return (
      <View style={[S.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: COLORS.error, fontSize: FONTS.sizes.lg }}>No wallet found</Text>
      </View>
    );
  }

  return (
    <View style={S.root}>
      {/* Header */}
      <View style={[S.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={S.headerCenter}>
          <ChainIcon chain={chain} size={18} style={S.headerChainIcon} />
          <Text style={S.headerTitle}>
            {mode === 'receive' ? `Receive ${chain?.symbol}` : 'Request Payment'}
          </Text>
        </View>
        <TouchableOpacity style={S.iconBtn} onPress={shareAddress}>
          <Ionicons name="share-outline" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Mode tabs */}
      <View style={S.modeTabs}>
        {['receive', 'request'].map(m => (
          <TouchableOpacity
            key={m}
            style={[S.modeTab, mode === m && S.modeTabActive]}
            onPress={() => setMode(m)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={m === 'receive' ? 'qr-code-outline' : 'link-outline'}
              size={13}
              color={mode === m ? COLORS.primary : COLORS.textSecondary}
              style={{ marginRight: 5 }}
            />
            <Text style={[S.modeTabText, mode === m && S.modeTabTextActive]}>
              {m === 'receive' ? 'Receive' : 'Request'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {mode === 'receive' ? (
          /* ── RECEIVE TAB ── */
          <>
            {/* QR card */}
            <View style={S.qrCard}>
              <View style={S.qrInner}>
                <QRCode
                  value={wallet.address}
                  size={200}
                  backgroundColor={COLORS.card}
                  color={COLORS.primary}
                  logo={require('../../assets/logo.png')}
                  logoSize={36}
                  logoBackgroundColor={COLORS.card}
                />
              </View>
              <View style={S.chainBadge}>
                <ChainIcon chain={chain} size={16} style={S.chainBadgeIcon} />
                <Text style={S.chainBadgeText}>{chain?.name}</Text>
              </View>
            </View>

            {/* Address card */}
            <View style={S.card}>
              <Text style={S.cardLabel}>Your Address</Text>
              <Text style={S.addressText} selectable>{wallet.address}</Text>
              <View style={S.addressActions}>
                <TouchableOpacity style={S.addressActionBtn} onPress={copyAddress} activeOpacity={0.75}>
                  <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
                  <Text style={S.addressActionText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.addressActionBtn, S.addressActionBtnOutline]} onPress={shareAddress} activeOpacity={0.75}>
                  <Ionicons name="share-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={[S.addressActionText, { color: COLORS.textSecondary }]}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Warning */}
            <View style={S.warningCard}>
              <View style={S.warningHeader}>
                <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
                <Text style={S.warningTitle}>Important</Text>
              </View>
              {[
                `Only send ${chain?.symbol} and ${chain?.name} tokens to this address`,
                'Sending from other networks will result in permanent loss',
                'Always verify the network before sending',
              ].map((line, i) => (
                <View key={i} style={S.warningRow}>
                  <Text style={S.warningDot}>·</Text>
                  <Text style={S.warningText}>{line}</Text>
                </View>
              ))}
            </View>

            {/* Network info */}
            <View style={S.card}>
              {[
                ['Network', chain?.name],
                ['Token', chain?.symbol],
                ['Wallet', wallet?.name || 'My Wallet'],
              ].map(([label, val]) => (
                <View key={label} style={S.infoRow}>
                  <Text style={S.infoLabel}>{label}</Text>
                  <Text style={S.infoValue}>{val}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          /* ── REQUEST TAB ── */
          <>
            {/* Token selector */}
            <TouchableOpacity
              style={S.tokenSelector}
              onPress={() => setShowTokenModal(true)}
              activeOpacity={0.75}
            >
              {loadingTokens ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <TokenLogo uri={requestToken?.logo} symbol={requestToken?.symbol} size={36} color={COLORS.primary} />
                  <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                    <Text style={S.tokenSelectorSymbol}>{requestToken?.symbol ?? 'Select token'}</Text>
                    <Text style={S.tokenSelectorName}>{requestToken?.name ?? 'Tap to choose'}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                </>
              )}
            </TouchableOpacity>

            {/* Amount card */}
            <View style={S.card}>
              <View style={S.cardLabelRow}>
                <Text style={S.cardLabel}>Request Amount</Text>
                {chain?.icon && (
                  <View style={S.chainPill}>
                    <ChainIcon chain={chain} size={14} style={{ marginRight: 4 }} />
                    <Text style={S.chainPillText}>{chain.name}</Text>
                  </View>
                )}
              </View>

              <TextInput
                style={S.amountInput}
                placeholder="0"
                placeholderTextColor={COLORS.textTertiary + '70'}
                value={requestAmount}
                onChangeText={t => {
                  setRequestAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'));
                  setRequestLink(null);
                }}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              {requestAmountUsd != null && requestAmount ? (
                <Text style={S.amountUsd}>≈ {fmtUsd(requestAmountUsd)}</Text>
              ) : null}
            </View>

            {/* Generated link */}
            {requestLink && (
              <View style={S.linkCard}>
                <View style={S.linkCardHeader}>
                  <Ionicons name="link-outline" size={14} color={COLORS.primary} />
                  <Text style={S.linkCardTitle}>Payment Link</Text>
                </View>
                <Text style={S.linkText} numberOfLines={4} selectable>{requestLink}</Text>
                <View style={S.linkActions}>
                  <TouchableOpacity style={S.linkActionBtn} onPress={copyLink} activeOpacity={0.75}>
                    <Ionicons name="copy-outline" size={13} color={COLORS.primary} />
                    <Text style={S.linkActionText}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.linkActionBtn} onPress={shareLink} activeOpacity={0.75}>
                    <Ionicons name="share-outline" size={13} color={COLORS.primary} />
                    <Text style={S.linkActionText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Generate CTA */}
            <TouchableOpacity
              style={[S.ctaBtn, (!requestToken) && S.ctaBtnDisabled]}
              onPress={generateRequestLink}
              disabled={!requestToken}
              activeOpacity={0.85}
            >
              <Ionicons name="link-outline" size={17} color={COLORS.onPrimary} style={{ marginRight: 8 }} />
              <Text style={S.ctaBtnText}>
                {requestLink ? 'Regenerate Link' : 'Generate Request Link'}
              </Text>
            </TouchableOpacity>

            <Text style={S.helperText}>
              Share the link — anyone with the Nexus app can pay you instantly
            </Text>
          </>
        )}
      </ScrollView>

      {/* Token picker modal */}
      <Modal
        visible={showTokenModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTokenModal(false)}
      >
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHandle} />
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Select Token</Text>
              <TouchableOpacity onPress={() => setShowTokenModal(false)} style={S.modalClose}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            {availableTokens.length === 0 && !loadingTokens ? (
              <View style={{ padding: SPACING.xl, alignItems: 'center' }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: FONTS.sizes.sm }}>
                  No tokens with balance found
                </Text>
              </View>
            ) : (
              <FlatList
                data={availableTokens}
                keyExtractor={t => String(t.id)}
                contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const usd = item.price?.usd ? parseFloat(item.balance) * item.price.usd : null;
                  const isSelected = requestToken?.id === item.id;
                  return (
                    <TouchableOpacity
                      style={[S.tokenPickerRow, isSelected && S.tokenPickerRowActive]}
                      onPress={() => { setRequestToken(item); setRequestLink(null); setShowTokenModal(false); }}
                      activeOpacity={0.7}
                    >
                      <TokenLogo uri={item.logo} symbol={item.symbol} size={40} color={COLORS.primary} />
                      <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                        <Text style={S.tokenPickerSymbol}>{item.symbol}</Text>
                        <Text style={S.tokenPickerName} numberOfLines={1}>{item.name}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={S.tokenPickerBal}>{parseFloat(item.balance).toFixed(4)}</Text>
                        {usd != null && <Text style={S.tokenPickerUsd}>{fmtUsd(usd)}</Text>}
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} style={{ marginLeft: 8 }} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border + '50', marginHorizontal: SPACING.xs }} />
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.background },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: SPACING.md, paddingBottom: 10,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
      ...SHADOWS.small,
    },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerChainIcon: { width: 18, height: 18, borderRadius: 9 },
    headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
    iconBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
      ...SHADOWS.small,
    },

    modeTabs: {
      flexDirection: 'row', marginHorizontal: SPACING.md, marginBottom: SPACING.md,
      backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: 3,
    },
    modeTab: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 9, borderRadius: BORDER_RADIUS.md,
    },
    modeTabActive: { backgroundColor: COLORS.background, ...SHADOWS.small },
    modeTabText: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.textSecondary },
    modeTabTextActive: { color: COLORS.primary, fontWeight: '700' },

    scroll: { paddingHorizontal: SPACING.md, gap: 12 },

    // QR card
    qrCard: {
      backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.lg, alignItems: 'center', ...SHADOWS.medium,
    },
    qrInner: {
      padding: SPACING.md, backgroundColor: COLORS.card,
      borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.md,
    },
    chainBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: COLORS.background, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 5,
      borderWidth: 1, borderColor: COLORS.border,
    },
    chainBadgeIcon: { width: 16, height: 16, borderRadius: 8 },
    chainBadgeText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },

    // Address card
    card: {
      backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.md, ...SHADOWS.small,
    },
    cardLabel: {
      fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: SPACING.sm,
    },
    cardLabelRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    addressText: {
      fontSize: FONTS.sizes.sm, color: COLORS.text,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      lineHeight: 22, marginBottom: SPACING.md,
    },
    addressActions: { flexDirection: 'row', gap: 8 },
    addressActionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
      paddingVertical: 10,
    },
    addressActionBtnOutline: {
      backgroundColor: COLORS.background,
      borderWidth: 1, borderColor: COLORS.border,
    },
    addressActionText: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: '#fff' },

    // Warning
    warningCard: {
      backgroundColor: COLORS.warning + '12', borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.warning,
    },
    warningHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
    warningTitle: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.warning },
    warningRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
    warningDot: { fontSize: FONTS.sizes.md, color: COLORS.warning, lineHeight: 20 },
    warningText: { flex: 1, fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, lineHeight: 18 },

    // Network info rows
    infoRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border + '50',
    },
    infoLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
    infoValue: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text },

    // Request tab — token selector
    tokenSelector: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.md, ...SHADOWS.small,
    },
    tokenSelectorSymbol: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text },
    tokenSelectorName: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: 1 },

    // Amount
    chainPill: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: COLORS.background, borderRadius: 20,
      paddingHorizontal: 8, paddingVertical: 3,
      borderWidth: 1, borderColor: COLORS.border,
    },
    chainPillText: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
    amountInput: {
      fontSize: 44, fontWeight: '800', color: COLORS.text,
      letterSpacing: -1.5, includeFontPadding: false,
      paddingVertical: SPACING.xs,
    },
    amountUsd: { fontSize: FONTS.sizes.sm, color: COLORS.textTertiary, marginBottom: SPACING.xs },

    // Link card
    linkCard: {
      backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.md, borderWidth: 1,
      borderColor: COLORS.primary + '28', ...SHADOWS.small,
    },
    linkCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
    linkCardTitle: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
    linkText: {
      fontSize: FONTS.sizes.xs, color: COLORS.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      marginBottom: SPACING.sm, lineHeight: 18,
    },
    linkActions: { flexDirection: 'row', gap: 8 },
    linkActionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: COLORS.primary + '15', borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    linkActionText: { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.primary },

    // CTA
    ctaBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.xl,
      paddingVertical: SPACING.md + 2, ...SHADOWS.large,
    },
    ctaBtnDisabled: { opacity: 0.4 },
    ctaBtnText: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.onPrimary, letterSpacing: 0.2 },
    helperText: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, textAlign: 'center' },

    // Token picker modal
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: COLORS.background,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      maxHeight: '75%',
    },
    modalHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: COLORS.border, alignSelf: 'center', marginTop: 10, marginBottom: 4,
    },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: SPACING.md, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    modalTitle: { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text },
    modalClose: {
      width: 32, height: 32, borderRadius: 8,
      backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
    },
    tokenPickerRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 12, paddingHorizontal: SPACING.xs,
    },
    tokenPickerRowActive: { backgroundColor: COLORS.primary + '0a', borderRadius: BORDER_RADIUS.md },
    tokenPickerSymbol: { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text },
    tokenPickerName: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: 1 },
    tokenPickerBal: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.text },
    tokenPickerUsd: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 1 },
  });

export default ReceiveScreen;
