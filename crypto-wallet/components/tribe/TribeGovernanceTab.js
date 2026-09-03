import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme }               from '../../contexts/ThemeContext';
import { useDAOContract }         from '../../hooks/useDAOContract';
import { ActiveProposalsTab }     from '../dao/details/ActiveProposalTab';
import { PastProposalsTab }       from '../dao/details/PastProposalTab';
import { OverviewTab }            from '../dao/details/OverviewTab';
import { UserStatisticsTab }      from '../dao/details/UserStatisticTab';

const SUB_TABS = [
  { id: 'overview', label: 'Overview',  icon: 'information-circle-outline' },
  { id: 'active',   label: 'Active',    icon: 'pulse-outline' },
  { id: 'past',     label: 'Past',      icon: 'archive-outline' },
  { id: 'stats',    label: 'My Stats',  icon: 'stats-chart-outline' },
];

const TribeGovernanceTab = ({ daoAddress, chainId, navigation, onBack }) => {
  const { COLORS, isDark } = useTheme();
  const [subTab, setSubTab] = useState('overview');

  const {
    daoInfo, userInfo, proposals,
    isLoading, isSyncing, error,
    totalProposals, activeProposalsCount, getTreasuryBalance, refresh,
    getVoteParams, getFinalizeProposalParams, getExecuteProposalParams,
    getCancelProposalParams, getUserVote, canExecuteProposal,
  } = useDAOContract(daoAddress);

  if (isLoading) {
    return (
      <View style={[s.center, { backgroundColor: COLORS.background }]}>
        <View style={[s.loadingIconWrap, { backgroundColor: COLORS.primary + '18' }]}>
          <Ionicons name="shield-half-outline" size={36} color={COLORS.primary} />
        </View>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
        <Text style={[s.loadingText, { color: COLORS.textSecondary }]}>
          Loading governance…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.center, { backgroundColor: COLORS.background }]}>
        <View style={[s.errorIconWrap, { backgroundColor: (COLORS.error || '#EF4444') + '15' }]}>
          <Ionicons name="warning-outline" size={36} color={COLORS.error || '#EF4444'} />
        </View>
        <Text style={[s.errorTitle, { color: COLORS.text }]}>Failed to load DAO data</Text>
        <Text style={[s.errorSub, { color: COLORS.textSecondary }]}>{error}</Text>
        <TouchableOpacity
          style={[s.retryBtn, { backgroundColor: COLORS.primary }]}
          onPress={refresh}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={15} color={COLORS.onPrimary} />
          <Text style={[s.retryText, { color: COLORS.onPrimary }]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderContent = () => {
    switch (subTab) {
      case 'overview':
        return (
          <OverviewTab
            daoInfo={daoInfo}
            userInfo={userInfo}
            totalProposals={totalProposals}
            activeProposalsCount={activeProposalsCount}
            getTreasuryBalance={getTreasuryBalance}
            onNavigateProposals={() => setSubTab('active')}
          />
        );
      case 'active':
        return (
          <ActiveProposalsTab
            daoAddress={daoAddress}
            proposals={proposals}
            daoInfo={daoInfo}
            userInfo={userInfo}
            isSyncing={isSyncing}
            onRefresh={refresh}
            getVoteParams={getVoteParams}
            getFinalizeProposalParams={getFinalizeProposalParams}
            getUserVote={getUserVote}
            canExecuteProposal={canExecuteProposal}
            onProposalPress={(proposal) =>
              navigation?.navigate('ProposalDetail', { proposal, daoAddress })
            }
            onCreateProposal={() =>
              navigation?.navigate('CreateProposal', { daoAddress, daoInfo })
            }
          />
        );
      case 'past':
        return (
          <PastProposalsTab
            daoAddress={daoAddress}
            proposals={proposals}
            daoInfo={daoInfo}
            isSyncing={isSyncing}
            onRefresh={refresh}
            getExecuteProposalParams={getExecuteProposalParams}
            getCancelProposalParams={getCancelProposalParams}
            getUserVote={getUserVote}
            canExecuteProposal={canExecuteProposal}
            onProposalPress={(proposal) =>
              navigation?.navigate('ProposalDetail', { proposal, daoAddress })
            }
          />
        );
      case 'stats':
        return (
          <UserStatisticsTab
            daoAddress={daoAddress}
            daoInfo={daoInfo}
            userInfo={userInfo}
            chainId={chainId}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={[s.container, { backgroundColor: COLORS.background }]}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: COLORS.surface, borderBottomColor: COLORS.divider }]}>

        {/* Top row: back · DAO name + sync · Full DAO */}
        <View style={s.headerRow}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: COLORS.background }]}
            onPress={() => onBack ? onBack() : navigation?.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={COLORS.text} />
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <View style={[s.daoIcon, { backgroundColor: COLORS.primary + '20' }]}>
              <Ionicons name="shield-half-outline" size={14} color={COLORS.primary} />
            </View>
            <Text style={[s.daoName, { color: COLORS.text }]} numberOfLines={1}>
              {daoInfo?.name || daoInfo?.daoName || 'Governance'}
            </Text>
            {isSyncing && (
              <ActivityIndicator size="small" color={COLORS.primary} style={s.syncDot} />
            )}
          </View>

          <TouchableOpacity
            style={[s.fullDaoBtn, { borderColor: COLORS.primary + '50' }]}
            onPress={() => navigation?.navigate('DAODetails', { daoAddress, daoGenre: daoInfo?.genreId })}
            activeOpacity={0.75}
          >
            <Text style={[s.fullDaoBtnText, { color: COLORS.primary }]}>Full DAO</Text>
            <Ionicons name="open-outline" size={11} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats pills */}
        <View style={s.statsRow}>
          <View style={[s.statPill, { backgroundColor: COLORS.primary + '14' }]}>
            <View style={[s.activeDot, { backgroundColor: COLORS.primary }]} />
            <Text style={[s.statLabel, { color: COLORS.primary }]}>
              {activeProposalsCount ?? 0} active
            </Text>
          </View>
          <View style={[s.statPill, { backgroundColor: COLORS.divider + '80' }]}>
            <Text style={[s.statLabel, { color: COLORS.textSecondary }]}>
              {totalProposals ?? 0} proposals total
            </Text>
          </View>
        </View>

        {/* Sub-tab bar — full-width underline style */}
        <View style={[s.tabBar, { borderTopColor: COLORS.divider }]}>
          {SUB_TABS.map(t => {
            const active = subTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={s.tabItem}
                onPress={() => setSubTab(t.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={t.icon}
                  size={13}
                  color={active ? COLORS.primary : COLORS.textTertiary}
                />
                <Text style={[s.tabLabel, { color: active ? COLORS.primary : COLORS.textTertiary }]}>
                  {t.label}
                </Text>
                {t.id === 'active' && (activeProposalsCount ?? 0) > 0 && (
                  <View style={[
                    s.tabBadge,
                    { backgroundColor: active ? COLORS.primary : COLORS.primary + '25' },
                  ]}>
                    <Text style={[s.tabBadgeText, { color: active ? '#FFF' : COLORS.primary }]}>
                      {activeProposalsCount}
                    </Text>
                  </View>
                )}
                {active && (
                  <View style={[s.tabUnderline, { backgroundColor: COLORS.primary }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <View style={s.content}>
        {renderContent()}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  // Loading
  loadingIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  loadingText:     { marginTop: 12, fontSize: 14 },

  // Error
  errorIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  errorTitle:    { fontSize: 17, fontWeight: '600', marginTop: 16 },
  errorSub:      { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  retryBtn: {
    marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 24, paddingVertical: 11, borderRadius: 22,
  },
  retryText: { color: '#FFF', fontWeight: '600', fontSize: 14 },

  // Header
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },

  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 10, gap: 10,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  daoIcon: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  daoName:  { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  syncDot:  { marginLeft: 2 },
  fullDaoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1,
  },
  fullDaoBtnText: { fontSize: 11, fontWeight: '600' },

  // Stats
  statsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, marginBottom: 12,
  },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  statLabel: { fontSize: 12, fontWeight: '500' },

  // Tab bar — full-width, underline indicator
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 4,
    paddingVertical: 10,
    position: 'relative',
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  tabBadge: {
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 9, fontWeight: '700' },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, borderRadius: 1,
  },

  // Content
  content: { flex: 1 },
});

export default TribeGovernanceTab;
