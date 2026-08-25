// components/dao/details/GovernanceParamsCard.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatNumber } from '../../../utils/helpers';

const PARAMS = (daoInfo, tokenSymbol) => [
  {
    icon: 'checkmark-circle-outline',
    label: 'Quorum',
    value: `${daoInfo?.quorumPercentage || 0}%`,
    accent: '#10B981',
  },
  {
    icon: 'bar-chart-outline',
    label: 'Proposal Threshold',
    value: `${formatNumber(daoInfo?.proposalThreshold || '0')} ${tokenSymbol || ''}`.trim(),
    accent: '#3B82F6',
  },
  {
    icon: 'time-outline',
    label: 'Voting Period',
    value: `${daoInfo?.votingPeriodHours || 0}h`,
    accent: '#F59E0B',
  },
  {
    icon: 'lock-closed-outline',
    label: 'Timelock',
    value: `${daoInfo?.timelockPeriodHours || 0}h`,
    accent: '#EF4444',
  },
];

export const GovernanceParamsCard = ({ daoInfo, tokenSymbol }) => {
  const theme = useTheme();
  const { COLORS, SHADOWS } = theme;

  const params = PARAMS(daoInfo, tokenSymbol);

  return (
    <View style={s.container}>
      <Text style={[s.sectionTitle, { color: COLORS.text }]}>Governance Parameters</Text>
      <View style={[s.card, { backgroundColor: COLORS.surface, borderColor: COLORS.border, ...SHADOWS.small }]}>
        {params.map((p, i) => (
          <View
            key={p.label}
            style={[
              s.row,
              { borderBottomColor: COLORS.divider || COLORS.border },
              i === params.length - 1 && s.rowLast,
            ]}
          >
            <View style={s.rowLeft}>
              <View style={[s.iconCircle, { backgroundColor: `${p.accent}18` }]}>
                <Ionicons name={p.icon} size={15} color={p.accent} />
              </View>
              <Text style={[s.label, { color: COLORS.textSecondary }]}>{p.label}</Text>
            </View>
            <Text style={[s.value, { color: COLORS.text }]}>{p.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
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
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 30, height: 30, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  label: { fontSize: 14, fontWeight: '500' },
  value: { fontSize: 14, fontWeight: '700' },
});
