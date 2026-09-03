// components/dao/details/ActiveProposalTab.js
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
  ProposalStatus, VoteOption, ProposalType,
  getProposalStatusLabel, getProposalTypeLabel, getProposalStatusColor,
} from '../../../abi/index';

// ─── Vote progress bar ────────────────────────────────────────────────────────

const VoteBar = ({ forVotes, againstVotes, abstainVotes, theme }) => {
  const { COLORS } = theme;
  const total = forVotes + againstVotes + abstainVotes;
  if (total === 0) {
    return <View style={[vb.track, { backgroundColor: COLORS.border }]} />;
  }
  return (
    <View style={[vb.track, { backgroundColor: COLORS.border }]}>
      {forVotes > 0 && (
        <View style={[vb.seg, { flex: forVotes, backgroundColor: COLORS.success }]} />
      )}
      {againstVotes > 0 && (
        <View style={[vb.seg, { flex: againstVotes, backgroundColor: COLORS.error }]} />
      )}
      {abstainVotes > 0 && (
        <View style={[vb.seg, { flex: abstainVotes, backgroundColor: COLORS.warning }]} />
      )}
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
      <Text style={[s.chipText, { color: active ? COLORS.onPrimary : COLORS.textSecondary }]}>
        {label}
      </Text>
      {count != null && (
        <View style={[s.chipBadge, { backgroundColor: active ? 'rgba(0,0,0,0.14)' : COLORS.border }]}>
          <Text style={[s.chipBadgeText, { color: active ? COLORS.onPrimary : COLORS.text }]}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Proposal card ────────────────────────────────────────────────────────────

const ProposalCard = ({ proposal, userInfo, userVote, onPress, onVote, onFinalize, theme }) => {
  const { COLORS, SHADOWS } = theme;
  const hasVoted   = userVote && userVote.voteOption !== VoteOption.NONE;
  const canFinalize = proposal.status === ProposalStatus.ACTIVE
    && Date.now() / 1000 >= proposal.timestamp + (proposal.votingPeriodHours || 72) * 3600;

  const forVotes     = calculateDisplayVotes(proposal.forVotes);
  const againstVotes = calculateDisplayVotes(proposal.againstVotes);
  const abstainVotes = calculateDisplayVotes(proposal.abstainVotes);
  const total        = forVotes + againstVotes + abstainVotes;
  const forPct       = total > 0 ? Math.round((forVotes / total) * 100) : 0;

  const statusColor = getProposalStatusColor(proposal.status);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[s.card, { backgroundColor: COLORS.surface, borderColor: COLORS.border, ...SHADOWS.small }]}
    >
      {/* Header row */}
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

      {/* Title + desc */}
      <Text style={[s.title, { color: COLORS.text }]} numberOfLines={2}>{proposal.title}</Text>
      <Text style={[s.desc, { color: COLORS.textSecondary }]} numberOfLines={2}>
        {proposal.description}
      </Text>

      {/* Funding amount */}
      {proposal.proposalType === ProposalType.FUNDING && BigInt(proposal.amount) > 0n && (
        <View style={[s.amountPill, { backgroundColor: `${COLORS.primary}14` }]}>
          <Ionicons name="cash-outline" size={13} color={COLORS.primary} />
          <Text style={[s.amountText, { color: COLORS.primary }]}>
            {formatUnits(proposal.amount, userInfo?.tokenDecimals || 18)} {userInfo?.tokenSymbol || 'tokens'}
          </Text>
        </View>
      )}

      {/* Vote bar + stats */}
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
          <Text style={[s.totalVotes, { color: COLORS.textSecondary }]}>{total} votes</Text>
        </View>
      </View>

      {/* Already voted badge */}
      {hasVoted && (
        <View style={[s.votedBadge, { backgroundColor: `${COLORS.success}14`, borderColor: `${COLORS.success}28` }]}>
          <Ionicons name="checkmark-done" size={14} color={COLORS.success} />
          <Text style={[s.votedText, { color: COLORS.success }]}>
            Voted {userVote.voteOption === VoteOption.FOR ? 'For' : userVote.voteOption === VoteOption.AGAINST ? 'Against' : 'Abstain'}
          </Text>
        </View>
      )}

      {/* Vote actions */}
      {!hasVoted && proposal.status === ProposalStatus.ACTIVE && (
        <View style={s.voteButtons}>
          <TouchableOpacity
            style={[s.voteBtn, { backgroundColor: COLORS.success }]}
            onPress={() => onVote(proposal.id, VoteOption.FOR)}
          >
            <Ionicons name="checkmark" size={15} color="#fff" />
            <Text style={s.voteBtnText}>For</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.voteBtn, { backgroundColor: COLORS.error }]}
            onPress={() => onVote(proposal.id, VoteOption.AGAINST)}
          >
            <Ionicons name="close" size={15} color="#fff" />
            <Text style={s.voteBtnText}>Against</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.voteBtn, { backgroundColor: COLORS.warning }]}
            onPress={() => onVote(proposal.id, VoteOption.ABSTAIN)}
          >
            <Ionicons name="remove" size={15} color="#fff" />
            <Text style={s.voteBtnText}>Abstain</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Finalize */}
      {canFinalize && (
        <TouchableOpacity
          style={[s.finalizeBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => onFinalize(proposal.id)}
        >
          <Ionicons name="flag-outline" size={15} color={COLORS.onPrimary} />
          <Text style={[s.finalizeBtnText, { color: COLORS.onPrimary }]}>Finalize Voting</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

// ─── Tab ──────────────────────────────────────────────────────────────────────

export const ActiveProposalsTab = ({ daoAddress, navigation }) => {
  const theme = useTheme();
  const { COLORS } = theme;

  const {
    proposals, userInfo, isLoading, isSyncing, error,
    refresh, getVoteParams, getFinalizeProposalParams, getUserVote, canCreateProposal,
  } = useDAOContract(daoAddress);

  const [selectedFilter, setSelectedFilter] = useState('all');
  const [txModalVisible, setTxModalVisible]   = useState(false);
  const [txParams, setTxParams]               = useState(null);
  const [userVotes, setUserVotes]             = useState({});

  const activeProposals = proposals.filter(p => p.status === ProposalStatus.ACTIVE);

  const grouped = {
    all:      activeProposals,
    generic:  activeProposals.filter(p => p.proposalType === ProposalType.GENERIC),
    funding:  activeProposals.filter(p => p.proposalType === ProposalType.FUNDING),
    protocol: activeProposals.filter(p => p.proposalType === ProposalType.PROTOCOL_UPGRADE),
  };

  const filtered = grouped[selectedFilter] || [];

  const loadUserVotes = async () => {
    if (!userInfo) return;
    const votes = {};
    for (const p of activeProposals) {
      const v = await getUserVote(p.id);
      if (v) votes[p.id] = v;
    }
    setUserVotes(votes);
  };

  useEffect(() => {
    if (activeProposals.length > 0 && userInfo) loadUserVotes();
  }, [activeProposals.length, userInfo]);

  const handleRefresh = async () => { await refresh(); await loadUserVotes(); };

  const handleVote = (proposalId, voteOption) => {
    const params = getVoteParams(proposalId, voteOption);
    const orig = params.onSuccess;
    params.onSuccess = async () => { if (orig) await orig(); await loadUserVotes(); };
    setTxParams(params); setTxModalVisible(true);
  };

  const handleFinalize = (proposalId) => {
    const params = getFinalizeProposalParams(proposalId);
    const orig = params.onSuccess;
    params.onSuccess = async () => { if (orig) await orig(); await loadUserVotes(); };
    setTxParams(params); setTxModalVisible(true);
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
        <TouchableOpacity style={[s.retryBtn, { backgroundColor: COLORS.primary }]} onPress={handleRefresh}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
    return (
      <View style={s.center}>
        <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
        <Text style={[s.emptyTitle, { color: COLORS.text }]}>No active proposals</Text>
        <Text style={[s.emptyText, { color: COLORS.textSecondary }]}>
          {selectedFilter === 'all' ? 'Create a proposal to get started' : 'Try a different filter'}
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
      {/* Filter chips */}
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
          <ProposalCard
            proposal={item}
            userInfo={userInfo}
            userVote={userVotes[item.id]}
            onPress={() => navigation.navigate('ProposalDetail', { proposal: item, daoAddress, userInfo })}
            onVote={handleVote}
            onFinalize={handleFinalize}
            theme={theme}
          />
        )}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={s.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={isSyncing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      {canCreateProposal && (
        <TouchableOpacity
          style={[s.fab, { backgroundColor: COLORS.primary }]}
          onPress={() => navigation.navigate('CreateProposal', { daoAddress })}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

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

  filterBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
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

  list: { padding: 16, gap: 12, paddingBottom: 100 },

  card: {
    borderRadius: 16, borderWidth: 1,
    padding: 14, gap: 10,
  },
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
  totalVotes: { fontSize: 11, marginLeft: 'auto' },

  votedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1,
  },
  votedText: { fontSize: 12, fontWeight: '600' },

  voteButtons: { flexDirection: 'row', gap: 8 },
  voteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 10,
  },
  voteBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  finalizeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  finalizeBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  center: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  fab: {
    position: 'absolute', right: 16, bottom: 20,
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
  },
});
