// components/dao/details/PastProposalsTab.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatUnits } from 'ethers';
import { TransactionModal } from '../../TransactionModal';
import { useDAOContract } from '../../../hooks/useDAOContract';
import { calculateDisplayVotes } from '../../../utils/VoteCalculation';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  ProposalStatus, ProposalType,
  getProposalStatusLabel, getProposalTypeLabel, getProposalStatusColor,
} from '../../../abi/index';

// ─── Vote progress bar (same as ActiveTab) ───────────────────────────────────

const VoteBar = ({ forVotes, againstVotes, abstainVotes, theme }) => {
  const { COLORS } = theme;
  const total = forVotes + againstVotes + abstainVotes;
  if (total === 0) return <View style={[vb.track, { backgroundColor: COLORS.border }]} />;
  return (
    <View style={[vb.track, { backgroundColor: COLORS.border }]}>
      {forVotes > 0     && <View style={[vb.seg, { flex: forVotes,     backgroundColor: COLORS.success }]} />}
      {againstVotes > 0 && <View style={[vb.seg, { flex: againstVotes, backgroundColor: COLORS.error }]} />}
      {abstainVotes > 0 && <View style={[vb.seg, { flex: abstainVotes, backgroundColor: COLORS.warning }]} />}
    </View>
  );
};

const vb = StyleSheet.create({
  track: { flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden' },
  seg:   { height: 5 },
});

// ─── Filter chip ──────────────────────────────────────────────────────────────

const FilterChip = ({ label, active, onPress, count, theme }) => {
  const { COLORS } = theme;
  return (
    <TouchableOpacity
      style={[
        s.chip,
        active
          ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
          : { backgroundColor: COLORS.surface, borderColor: COLORS.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[s.chipText, { color: active ? COLORS.onPrimary : COLORS.textSecondary }]}>{label}</Text>
      {count != null && (
        <View style={[s.chipBadge, { backgroundColor: active ? 'rgba(0,0,0,0.14)' : COLORS.border }]}>
          <Text style={[s.chipBadgeText, { color: active ? COLORS.onPrimary : COLORS.text }]}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Proposal card ────────────────────────────────────────────────────────────

const fmtDate = (ts) =>
  new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const PastProposalCard = ({ proposal, userInfo, onPress, onExecute, canExecute, theme }) => {
  const { COLORS, SHADOWS } = theme;

  const forVotes     = calculateDisplayVotes(proposal.forVotes);
  const againstVotes = calculateDisplayVotes(proposal.againstVotes);
  const abstainVotes = calculateDisplayVotes(proposal.abstainVotes);
  const total        = forVotes + againstVotes + abstainVotes;
  const forPct       = total > 0 ? Math.round((forVotes / total) * 100) : 0;
  const passed       = forVotes > againstVotes;
  const statusColor  = getProposalStatusColor(proposal.status);

  const resultInfo = (() => {
    if (proposal.status === ProposalStatus.EXECUTED) return { icon: 'checkmark-circle', label: 'Executed', color: COLORS.success };
    if (proposal.status === ProposalStatus.QUEUED)   return { icon: 'time',             label: 'Queued',   color: COLORS.warning };
    if (proposal.status === ProposalStatus.CANCELLED)return { icon: 'close-circle',     label: 'Cancelled',color: COLORS.textSecondary };
    if (proposal.status === ProposalStatus.FAILED)   return { icon: 'close-circle',     label: 'Failed',   color: COLORS.error };
    if (passed)                                      return { icon: 'checkmark-circle', label: 'Passed',   color: COLORS.success };
    return                                                  { icon: 'close-circle',     label: 'Rejected', color: COLORS.error };
  })();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[s.card, { backgroundColor: COLORS.surface, borderColor: COLORS.border, ...SHADOWS.small }]}
    >
      {/* Header */}
      <View style={s.cardHeader}>
        <View style={s.badges}>
          <View style={[s.statusBadge, { backgroundColor: `${statusColor}1a` }]}>
            <Text style={[s.statusText, { color: statusColor }]}>
              {getProposalStatusLabel(proposal.status)}
            </Text>
          </View>
          <View style={[s.typeBadge, { backgroundColor: COLORS.background, borderColor: COLORS.border }]}>
            <Text style={[s.typeText, { color: COLORS.textSecondary }]}>
              {getProposalTypeLabel(proposal.proposalType)}
            </Text>
          </View>
        </View>
        <Text style={[s.proposalId, { color: COLORS.textTertiary || COLORS.textSecondary }]}>
          #{proposal.id}
        </Text>
      </View>

      <Text style={[s.title, { color: COLORS.text }]} numberOfLines={2}>{proposal.title}</Text>
      <Text style={[s.desc, { color: COLORS.textSecondary }]} numberOfLines={2}>{proposal.description}</Text>

      {proposal.proposalType === ProposalType.FUNDING && BigInt(proposal.amount) > 0n && (
        <View style={[s.amountPill, { backgroundColor: `${COLORS.primary}14` }]}>
          <Ionicons name="cash-outline" size={13} color={COLORS.primary} />
          <Text style={[s.amountText, { color: COLORS.primary }]}>
            {formatUnits(proposal.amount, userInfo?.tokenDecimals || 18)} {userInfo?.tokenSymbol || 'tokens'}
          </Text>
        </View>
      )}

      {/* Vote bar */}
      <View style={s.voteSection}>
        <VoteBar forVotes={forVotes} againstVotes={againstVotes} abstainVotes={abstainVotes} theme={theme} />
        <View style={s.voteStats}>
          <View style={s.voteStat}>
            <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
            <Text style={[s.voteCount, { color: COLORS.text }]}>{forVotes}</Text>
            {total > 0 && <Text style={[s.votePct, { color: COLORS.success }]}>{forPct}%</Text>}
          </View>
          <View style={s.voteStat}>
            <Ionicons name="close-circle" size={13} color={COLORS.error} />
            <Text style={[s.voteCount, { color: COLORS.text }]}>{againstVotes}</Text>
          </View>
          <View style={s.voteStat}>
            <Ionicons name="remove-circle" size={13} color={COLORS.warning} />
            <Text style={[s.voteCount, { color: COLORS.text }]}>{abstainVotes}</Text>
          </View>
        </View>
      </View>

      {/* Result + date footer */}
      <View style={[s.footer, { borderTopColor: COLORS.border }]}>
        <View style={s.resultRow}>
          <Ionicons name={resultInfo.icon} size={14} color={resultInfo.color} />
          <Text style={[s.resultLabel, { color: resultInfo.color }]}>{resultInfo.label}</Text>
        </View>
        <Text style={[s.dateText, { color: COLORS.textSecondary }]}>
          {fmtDate(proposal.timestamp)}
        </Text>
      </View>

      {/* Execute button for queued proposals */}
      {proposal.status === ProposalStatus.QUEUED && canExecute && (
        <TouchableOpacity
          style={[s.executeBtn, { backgroundColor: COLORS.success }]}
          onPress={() => onExecute(proposal.id)}
        >
          <Ionicons name="play" size={15} color="#fff" />
          <Text style={s.executeBtnText}>Execute Proposal</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

// ─── Tab ──────────────────────────────────────────────────────────────────────

export const PastProposalsTab = ({ daoAddress, navigation }) => {
  const theme = useTheme();
  const { COLORS } = theme;

  const {
    proposals, userInfo, isLoading, isSyncing, error,
    refresh, getExecuteProposalParams, canExecuteProposal,
  } = useDAOContract(daoAddress);

  const [selectedFilter, setSelectedFilter] = useState('all');
  const [txModalVisible, setTxModalVisible]   = useState(false);
  const [txParams, setTxParams]               = useState(null);
  const [executables, setExecutables]         = useState({});

  const pastProposals = proposals
    .filter(p => p.status !== ProposalStatus.ACTIVE)
    .sort((a, b) => b.timestamp - a.timestamp);

  const grouped = {
    all:      pastProposals,
    generic:  pastProposals.filter(p => p.proposalType === ProposalType.GENERIC),
    funding:  pastProposals.filter(p => p.proposalType === ProposalType.FUNDING),
    protocol: pastProposals.filter(p => p.proposalType === ProposalType.PROTOCOL_UPGRADE),
  };

  const filtered = grouped[selectedFilter] || [];

  useEffect(() => {
    if (!pastProposals.length) return;
    (async () => {
      const checks = {};
      for (const p of pastProposals) {
        if (p.status === ProposalStatus.QUEUED) checks[p.id] = await canExecuteProposal(p.id);
      }
      setExecutables(checks);
    })();
  }, [pastProposals.length]);

  const handleExecute = (proposalId) => {
    setTxParams(getExecuteProposalParams(proposalId));
    setTxModalVisible(true);
  };

  const renderEmpty = () => {
    if (isLoading) return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[s.emptyText, { color: COLORS.textSecondary }]}>Loading proposals…</Text>
      </View>
    );
    if (error) return (
      <View style={s.center}>
        <Ionicons name="warning-outline" size={48} color={COLORS.error} />
        <Text style={[s.emptyTitle, { color: COLORS.text }]}>Could not load proposals</Text>
        <Text style={[s.emptyText, { color: COLORS.textSecondary }]}>{error}</Text>
        <TouchableOpacity style={[s.retryBtn, { backgroundColor: COLORS.primary }]} onPress={refresh}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
    return (
      <View style={s.center}>
        <Ionicons name="archive-outline" size={48} color={COLORS.textSecondary} />
        <Text style={[s.emptyTitle, { color: COLORS.text }]}>No past proposals</Text>
        <Text style={[s.emptyText, { color: COLORS.textSecondary }]}>
          {selectedFilter === 'all' ? 'Completed proposals will appear here' : 'Try a different filter'}
        </Text>
      </View>
    );
  };

  const FILTERS = [
    { key: 'all',      label: 'All',      count: grouped.all.length },
    { key: 'generic',  label: 'Generic',  count: grouped.generic.length },
    { key: 'funding',  label: 'Funding',  count: grouped.funding.length },
    { key: 'protocol', label: 'Protocol', count: grouped.protocol.length },
  ];

  return (
    <View style={[s.root, { backgroundColor: COLORS.background }]}>
      <View style={[s.filterBar, { borderBottomColor: COLORS.border, backgroundColor: COLORS.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
          {FILTERS.map(f => (
            <FilterChip
              key={f.key}
              label={f.label}
              count={f.count}
              active={selectedFilter === f.key}
              onPress={() => setSelectedFilter(f.key)}
              theme={theme}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        renderItem={({ item }) => (
          <PastProposalCard
            proposal={item}
            userInfo={userInfo}
            onPress={() => navigation.navigate('ProposalDetail', { proposal: item, daoAddress, userInfo })}
            onExecute={handleExecute}
            canExecute={executables[item.id]}
            theme={theme}
          />
        )}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={s.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={isSyncing} onRefresh={refresh} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      />

      {txParams && (
        <TransactionModal
          visible={txModalVisible}
          onClose={() => { setTxModalVisible(false); setTxParams(null); }}
          fromAddress={userInfo?.address}
          {...txParams}
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  filterBar: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  chipBadge: {
    minWidth: 18, height: 18, paddingHorizontal: 5,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  chipBadgeText: { fontSize: 10, fontWeight: '800' },

  list: { padding: 16, gap: 12 },

  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', gap: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  typeText: { fontSize: 11, fontWeight: '500' },
  proposalId: { fontSize: 12, fontWeight: '600' },

  title: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  desc:  { fontSize: 13, lineHeight: 19 },

  amountPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  amountText: { fontSize: 12, fontWeight: '600' },

  voteSection: { gap: 8 },
  voteStats: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  voteStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  voteCount: { fontSize: 12, fontWeight: '700' },
  votePct: { fontSize: 11, fontWeight: '600' },

  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  resultLabel: { fontSize: 13, fontWeight: '700' },
  dateText: { fontSize: 12 },

  executeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  executeBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  center: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
