// components/dao/details/DAOStatsGrid.js
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatNumber } from '../../../utils/helpers';

const { width } = Dimensions.get('window');
// Two columns with 16px horizontal padding on each side + 8px gap between cards
const CARD_W = (width - 32 - 8) / 2;

const STATS = (totalProposals, activeProposals, members, treasuryBalance, tokenSymbol) => [
  {
    icon: 'document-text-outline',
    label: 'Total Proposals',
    value: String(totalProposals || 0),
    accent: '#3B82F6',
  },
  {
    icon: 'flash-outline',
    label: 'Active',
    value: String(activeProposals || 0),
    accent: '#10B981',
  },
  {
    icon: 'people-outline',
    label: 'Members',
    value: String(members || 0),
    accent: '#F59E0B',
  },
  {
    icon: 'wallet-outline',
    label: 'Treasury',
    value: formatNumber(treasuryBalance || '0'),
    sub: tokenSymbol || '',
    accent: '#8B5CF6',
  },
];

const StatCard = ({ icon, label, value, sub, accent, theme }) => {
  const { COLORS, SHADOWS } = theme;
  return (
    <View style={[s.card, { backgroundColor: COLORS.surface, borderColor: COLORS.border, ...SHADOWS.small }]}>
      <View style={[s.iconWrap, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <Text style={[s.value, { color: COLORS.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {!!sub && <Text style={[s.sub, { color: accent }]} numberOfLines={1}>{sub}</Text>}
      <Text style={[s.label, { color: COLORS.textSecondary }]}>{label}</Text>
    </View>
  );
};

export const DAOStatsGrid = ({ totalProposals, activeProposals, members, treasuryBalance, tokenSymbol }) => {
  const theme = useTheme();
  const { COLORS } = theme;

  const stats = STATS(totalProposals, activeProposals, members, treasuryBalance, tokenSymbol);

  return (
    <View style={s.container}>
      <Text style={[s.sectionTitle, { color: COLORS.text }]}>Overview</Text>
      <View style={s.grid}>
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} theme={theme} />
        ))}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    width: CARD_W,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'flex-start',
    gap: 4,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  value: {
    fontSize: 22, fontWeight: '800', letterSpacing: -0.5,
  },
  sub: {
    fontSize: 11, fontWeight: '700', marginTop: -2,
  },
  label: {
    fontSize: 12, fontWeight: '500',
  },
});
