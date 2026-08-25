// components/dao/details/DAOInfoCard.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import { Contract } from 'ethers';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatAddress, openExplorer } from '../../../utils/helpers';
import { useWallet } from '../../../contexts/WalletContext';

const MINIMAL_ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
];

const GENRE_INFO = {
  0:  { label: 'NFT',        icon: 'image-outline',          color: '#8B5CF6' },
  1:  { label: 'Gaming',     icon: 'game-controller-outline', color: '#10B981' },
  2:  { label: 'Community',  icon: 'people-outline',          color: '#F59E0B' },
  3:  { label: 'DeFi',       icon: 'trending-up-outline',     color: '#3B82F6' },
  4:  { label: 'AI',         icon: 'bulb-outline',            color: '#EF4444' },
  5:  { label: 'Degen',      icon: 'rocket-outline',          color: '#F97316' },
  6:  { label: 'Memecoin',   icon: 'happy-outline',           color: '#84CC16' },
  7:  { label: 'RWA',        icon: 'business-outline',        color: '#6366F1' },
  8:  { label: 'DePIN',      icon: 'hardware-chip-outline',   color: '#EC4899' },
  9:  { label: 'SocialFi',   icon: 'share-social-outline',    color: '#14B8A6' },
  10: { label: 'Metaverse',  icon: 'globe-outline',           color: '#A855F7' },
  11: { label: 'Other',      icon: 'help-circle-outline',     color: '#6B7280' },
};

// ─── Address row with copy + explorer ────────────────────────────────────────

const AddressRow = ({ label, address, chainExplorer, theme }) => {
  const { COLORS, FONTS, SPACING } = theme;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExplorer = () => {
    if (address && chainExplorer) openExplorer(chainExplorer, address);
  };

  return (
    <View style={[s.row, { borderBottomColor: COLORS.divider || COLORS.border }]}>
      <Text style={[s.rowLabel, { color: COLORS.textSecondary }]}>{label}</Text>
      <View style={s.rowRight}>
        <Text style={[s.addrText, { color: COLORS.text }]}>
          {formatAddress(address)}
        </Text>
        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: copied ? `${COLORS.success}18` : `${COLORS.primary}14` }]}
          onPress={handleCopy}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={13}
            color={copied ? COLORS.success : COLORS.primary}
          />
        </TouchableOpacity>
        {chainExplorer && (
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: `${COLORS.primary}14` }]}
            onPress={handleExplorer}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="open-outline" size={13} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─── Main card ────────────────────────────────────────────────────────────────

export const DAOInfoCard = ({ daoInfo, chainExplorer, genreId }) => {
  const theme = useTheme();
  const { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } = theme;
  const { provider } = useWallet();
  const genreInfo = GENRE_INFO[genreId] || GENRE_INFO[11];

  const [tokenName,    setTokenName]    = useState(null);
  const [tokenSymbol,  setTokenSymbol]  = useState(null);
  const [loadingToken, setLoadingToken] = useState(false);

  useEffect(() => {
    if (!daoInfo?.tokenAddress || !provider) return;
    let cancelled = false;
    (async () => {
      setLoadingToken(true);
      try {
        const tc = new Contract(daoInfo.tokenAddress, MINIMAL_ERC20_ABI, provider);
        const [n, sym] = await Promise.all([tc.name(), tc.symbol()]);
        if (!cancelled) { setTokenName(n); setTokenSymbol(sym); }
      } catch {}
      finally { if (!cancelled) setLoadingToken(false); }
    })();
    return () => { cancelled = true; };
  }, [daoInfo?.tokenAddress, provider]);

  return (
    <View style={[s.card, {
      backgroundColor: COLORS.surface,
      borderColor: COLORS.border,
      ...SHADOWS.small,
    }]}>
      {/* DAO Address */}
      <AddressRow
        label="DAO Contract"
        address={daoInfo?.address}
        chainExplorer={chainExplorer}
        theme={theme}
      />

      {/* Genre */}
      <View style={[s.row, { borderBottomColor: COLORS.divider || COLORS.border }]}>
        <Text style={[s.rowLabel, { color: COLORS.textSecondary }]}>Genre</Text>
        <View style={[s.genreChip, { backgroundColor: `${genreInfo.color}18`, borderColor: `${genreInfo.color}35` }]}>
          <Ionicons name={genreInfo.icon} size={13} color={genreInfo.color} />
          <Text style={[s.genreText, { color: genreInfo.color }]}>{genreInfo.label}</Text>
        </View>
      </View>

      {/* Governance Token */}
      <View style={[s.row, s.rowLast, { borderBottomColor: COLORS.divider || COLORS.border }]}>
        <Text style={[s.rowLabel, { color: COLORS.textSecondary }]}>Gov Token</Text>
        {loadingToken ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {tokenName && tokenSymbol && (
              <Text style={[s.tokenName, { color: COLORS.text }]}>
                {tokenName}
                <Text style={[s.tokenSymbol, { color: COLORS.primary }]}> {tokenSymbol}</Text>
              </Text>
            )}
            <View style={s.rowRight}>
              <Text style={[s.addrText, { color: COLORS.textSecondary }]}>
                {formatAddress(daoInfo?.tokenAddress)}
              </Text>
              <AddressActionButtons
                address={daoInfo?.tokenAddress}
                chainExplorer={chainExplorer}
                theme={theme}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

// Inline icon-only copy + explorer buttons (no label)
const AddressActionButtons = ({ address, chainExplorer, theme }) => {
  const { COLORS } = theme;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      <TouchableOpacity
        style={[s.iconBtn, { backgroundColor: copied ? `${COLORS.success}18` : `${COLORS.primary}14` }]}
        onPress={handleCopy}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={12} color={copied ? COLORS.success : COLORS.primary} />
      </TouchableOpacity>
      {chainExplorer && (
        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: `${COLORS.primary}14` }]}
          onPress={() => openExplorer(chainExplorer, address)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="open-outline" size={12} color={COLORS.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 13, fontWeight: '500', flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addrText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '500',
  },
  iconBtn: {
    width: 26, height: 26, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  genreChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  genreText: { fontSize: 12, fontWeight: '700' },
  tokenName: { fontSize: 13, fontWeight: '700' },
  tokenSymbol: { fontSize: 13, fontWeight: '600' },
});
