// components/feed/ProposalFeedCard.js
// Compact proposal card for the governance tab of the activity feed.
// Shows vote progress, status, time remaining, and a "Vote" CTA.
import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { formatUnits } from 'ethers';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META = {
  0: { label: 'Active',    color: '#10B981', icon: 'pulse' },
  1: { label: 'Passed',    color: '#3B82F6', icon: 'checkmark-circle' },
  2: { label: 'Failed',    color: '#EF4444', icon: 'close-circle' },
  3: { label: 'Queued',    color: '#F59E0B', icon: 'time' },
  4: { label: 'Executed',  color: '#D6FF00', icon: 'rocket' },
  5: { label: 'Cancelled', color: '#6B7280', icon: 'ban' },
};

function timeLeft(endTime) {
  if (!endTime) return null;
  const diff = endTime * 1000 - Date.now();
  if (diff <= 0) return 'Ended';
  const h = Math.floor(diff / 3_600_000);
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

function safeFormatUnits(value, decimals = 18) {
  try {
    const n = parseFloat(formatUnits(BigInt(value || '0'), decimals));
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(1);
  } catch {
    return '0';
  }
}

// ── Vote bar ──────────────────────────────────────────────────────────────────

const VoteBar = ({ forV, againstV, abstainV, COLORS }) => {
  const total = forV + againstV + abstainV;
  if (total === 0) {
    return <View style={[vb.track, { backgroundColor: COLORS.surface }]} />;
  }
  return (
    <View style={[vb.track, { backgroundColor: COLORS.surface }]}>
      {forV > 0     && <View style={[vb.seg, { flex: forV,     backgroundColor: '#10B981' }]} />}
      {againstV > 0 && <View style={[vb.seg, { flex: againstV, backgroundColor: '#EF4444' }]} />}
      {abstainV > 0 && <View style={[vb.seg, { flex: abstainV, backgroundColor: '#F59E0B' }]} />}
    </View>
  );
};
const vb = StyleSheet.create({
  track: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  seg:   { height: 6 },
});

// ── Main component ────────────────────────────────────────────────────────────

const ProposalFeedCard = ({
  proposal,
  daoName,
  daoAddress,
  tribeName,
  tribeLogoUrl,
  chainId,
  onVote,    // (proposal, daoAddress) => void
  onPress,   // (proposal, daoAddress) => void
}) => {
  const { COLORS } = useTheme();
  const meta   = STATUS_META[proposal.status] || STATUS_META[0];
  const tLeft  = timeLeft(proposal.endTime);

  const forV     = Number(safeFormatUnits(proposal.forVotes).replace(/[KM]/g, ''));
  const againstV = Number(safeFormatUnits(proposal.againstVotes).replace(/[KM]/g, ''));
  const abstainV = Number(safeFormatUnits(proposal.abstainVotes).replace(/[KM]/g, ''));

  const isActive = proposal.status === 0;

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: COLORS.card, borderColor: COLORS.divider }]}
      onPress={() => onPress?.(proposal, daoAddress)}
      activeOpacity={0.85}
    >
      {/* Header: tribe/DAO info */}
      <View style={s.header}>
        {tribeLogoUrl ? (
          <Image source={{ uri: tribeLogoUrl }} style={s.logo} />
        ) : (
          <View style={[s.logo, s.logoFallback, { backgroundColor: COLORS.primary + '20' }]}>
            <Ionicons name="shield-half-outline" size={20} color={COLORS.primary} />
          </View>
        )}
        <View style={s.headerText}>
          <Text style={[s.daoName, { color: COLORS.text }]} numberOfLines={1}>
            {daoName || 'DAO'}
          </Text>
          <Text style={[s.tribeLabel, { color: COLORS.textSecondary }]}>
            {tribeName} · Governance
          </Text>
        </View>
        <View style={[s.statusChip, { backgroundColor: meta.color + '20' }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      {/* Title + description */}
      <Text style={[s.title, { color: COLORS.text }]} numberOfLines={2}>
        {proposal.title || `Proposal #${proposal.id}`}
      </Text>
      {proposal.description ? (
        <Text style={[s.desc, { color: COLORS.textSecondary }]} numberOfLines={2}>
          {proposal.description}
        </Text>
      ) : null}

      {/* Vote bar */}
      <VoteBar forV={forV} againstV={againstV} abstainV={abstainV} COLORS={COLORS} />

      {/* Vote counts */}
      <View style={s.countsRow}>
        <Text style={[s.voteCount, { color: '#10B981' }]}>✓ {safeFormatUnits(proposal.forVotes)}</Text>
        <Text style={[s.voteCount, { color: '#EF4444' }]}>✗ {safeFormatUnits(proposal.againstVotes)}</Text>
        <Text style={[s.voteCount, { color: '#F59E0B' }]}>~ {safeFormatUnits(proposal.abstainVotes)}</Text>
        {tLeft && (
          <Text style={[s.timeLeft, { color: COLORS.textTertiary }]}>{tLeft}</Text>
        )}
      </View>

      {/* CTA */}
      {isActive && (
        <TouchableOpacity
          style={[s.voteBtn, { backgroundColor: COLORS.primary }]}
          onPress={(e) => { e.stopPropagation?.(); onVote?.(proposal, daoAddress); }}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle-outline" size={15} color="#FFF" />
          <Text style={s.voteBtnText}>Cast Vote</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1,
    padding: 14, marginBottom: 10, gap: 8,
  },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo:        { width: 40, height: 40, borderRadius: 20 },
  logoFallback: { justifyContent: 'center', alignItems: 'center' },
  headerText:  { flex: 1 },
  daoName:     { fontSize: 14, fontWeight: '700' },
  tribeLabel:  { fontSize: 12 },
  statusChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText:  { fontSize: 11, fontWeight: '600' },

  title:      { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  desc:       { fontSize: 13, lineHeight: 18 },

  countsRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  voteCount:  { fontSize: 12, fontWeight: '600' },
  timeLeft:   { marginLeft: 'auto', fontSize: 12 },

  voteBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 22, marginTop: 2 },
  voteBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});

export default ProposalFeedCard;
