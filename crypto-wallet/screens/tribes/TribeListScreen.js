import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTribes } from '../../hooks/useTribes';
import UserIcon  from '../../components/common/UserIcon';
import TabHeader from '../../components/common/TabHeader';
import { useTheme } from '../../contexts/ThemeContext';
import Alert from '../../utils/Alert';

// Layout constants shared by row, skeleton, and separator
const AVATAR_SIZE = 52;
const LEFT_PAD    = 16;
const AVATAR_GAP  = 14;
const SEP_LEFT    = LEFT_PAD + AVATAR_SIZE + AVATAR_GAP; // indented separator start

// ── Skeleton ──────────────────────────────────────────────────────────────────
const SkeletonRow = ({ COLORS }) => (
  <View style={[sk.row, { backgroundColor: COLORS.background }]}>
    <View style={[sk.avatar, { backgroundColor: COLORS.surface }]} />
    <View style={sk.content}>
      <View style={[sk.pulse, sk.nameW, { backgroundColor: COLORS.surface }]} />
      <View style={[sk.pulse, sk.subW,  { backgroundColor: COLORS.surface }]} />
    </View>
  </View>
);
const sk = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingLeft: LEFT_PAD, paddingVertical: 11 },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, marginRight: AVATAR_GAP },
  content:{ flex: 1, paddingRight: LEFT_PAD, gap: 9 },
  pulse:  { borderRadius: 6 },
  nameW:  { height: 13, width: '55%' },
  subW:   { height: 11, width: '38%' },
});

// ── Tribe row ─────────────────────────────────────────────────────────────────
const TribeRow = React.memo(({ item, COLORS, onPress, onTogglePin }) => {
  const pinned  = item.is_pinned === 1;
  const logoUri = item.logo_url || item.logoUrl;
  const members = item.member_count ?? item.memberCount ?? 0;
  const isOwner = item.status === 'owner';

  return (
    <TouchableOpacity
      style={[row.container, { backgroundColor: COLORS.background }]}
      onPress={onPress}
      activeOpacity={0.5}
    >
      {/* Avatar */}
      {logoUri ? (
        <Image source={{ uri: logoUri }} style={row.avatar} />
      ) : (
        <View style={[row.avatar, row.avatarFallback, { backgroundColor: COLORS.primary + '22' }]}>
          <Text style={[row.avatarLetter, { color: COLORS.primary }]}>
            {item.name?.charAt(0)?.toUpperCase() ?? 'G'}
          </Text>
        </View>
      )}

      {/* Content — right of avatar */}
      <View style={row.content}>
        {/* Top line */}
        <View style={row.topLine}>
          <Text style={[row.name, { color: COLORS.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={row.actions}>
            {item.privacy === 'private' && (
              <Ionicons name="lock-closed" size={12} color={COLORS.textTertiary} />
            )}
            <TouchableOpacity
              onPress={onTogglePin}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons
                name={pinned ? 'star' : 'star-outline'}
                size={16}
                color={pinned ? COLORS.primary : COLORS.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom line */}
        <View style={row.bottomLine}>
          <Text style={[row.sub, { color: COLORS.textSecondary }]} numberOfLines={1}>
            {[item.genre, `${members} members`].filter(Boolean).join(' · ')}
          </Text>
          {isOwner && (
            <View style={[row.ownerPill, { backgroundColor: COLORS.primary + '20' }]}>
              <Text style={[row.ownerText, { color: COLORS.primary }]}>Owner</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const row = StyleSheet.create({
  container:    { flexDirection: 'row', alignItems: 'center', paddingLeft: LEFT_PAD },
  avatar:       { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, marginRight: AVATAR_GAP },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: 20, fontWeight: '700' },
  content:      { flex: 1, paddingRight: LEFT_PAD, paddingVertical: 13, gap: 4 },
  topLine:      { flexDirection: 'row', alignItems: 'center' },
  name:         { flex: 1, fontSize: 16, fontWeight: '600' },
  actions:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  bottomLine:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sub:          { flex: 1, fontSize: 13 },
  ownerPill:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  ownerText:    { fontSize: 10, fontWeight: '700' },
});

// ── Screen ────────────────────────────────────────────────────────────────────
const TribeListScreen = ({ navigation }) => {
  const { COLORS, SPACING } = useTheme();
  const { tribes, loading, syncing, refresh, togglePin } = useTribes();

  const handleTogglePin = useCallback(async (tribeId) => {
    try { await togglePin(tribeId); }
    catch (e) { Alert.alert(e.message || 'Failed to toggle pin'); }
  }, [togglePin]);

  const renderItem = useCallback(({ item }) => (
    <TribeRow
      item={item}
      COLORS={COLORS}
      onPress={() => navigation.navigate('TribeDetail', { tribe: item })}
      onTogglePin={() => handleTogglePin(item.id)}
    />
  ), [COLORS, navigation, handleTogglePin]);

  const keyExtractor = useCallback((item) => item.id, []);

  // Telegram-style separator — starts at text indent, not screen edge
  const Separator = useCallback(() => (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: COLORS.divider, marginLeft: SEP_LEFT }} />
  ), [COLORS.divider]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
    <TabHeader
  showLogo
  border
  left={
    <View style={{ transform: [{ scale: 0.8 }] }}>
      <UserIcon onPress={() => navigation.getParent('ProfileDrawer')?.openDrawer()} />
    </View>
  }
  rightActions={[
    { icon: 'search-outline', onPress: () => navigation.navigate('SearchTribe') },
  ]}
/>

      {/* Background sync indicator */}
      {syncing && !loading && (
        <View style={[sync.banner, { backgroundColor: COLORS.surface, borderBottomColor: COLORS.divider }]}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={[sync.text, { color: COLORS.textSecondary }]}>Syncing…</Text>
        </View>
      )}

      {loading && tribes.length === 0 ? (
        // Skeleton while initial load
        <View>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <React.Fragment key={i}>
              <SkeletonRow COLORS={COLORS} />
              {i < 5 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: COLORS.divider, marginLeft: SEP_LEFT }} />}
            </React.Fragment>
          ))}
        </View>
      ) : (
        <FlatList
          data={tribes}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={{ paddingBottom: 110 }}
          initialNumToRender={14}
          maxToRenderPerBatch={14}
          windowSize={5}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={empty.wrap}>
              <View style={[empty.iconWrap, { backgroundColor: COLORS.primary + '15' }]}>
                <Ionicons name="people-outline" size={48} color={COLORS.primary} />
              </View>
              <Text style={[empty.title, { color: COLORS.text }]}>No Tribes Yet</Text>
              <Text style={[empty.sub, { color: COLORS.textSecondary }]}>
                Join a community or start your own
              </Text>
              <View style={empty.actions}>
                <TouchableOpacity
                  style={[empty.btn, { backgroundColor: COLORS.primary }]}
                  onPress={() => navigation.navigate('SearchTribe')}
                >
                  <Ionicons name="search" size={16} color={COLORS.onPrimary} />
                  <Text style={[empty.btnText, { color: COLORS.onPrimary }]}>Browse Tribes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[empty.btnOutline, { borderColor: COLORS.primary }]}
                  onPress={() => navigation.navigate('CreateTribe')}
                >
                  <Ionicons name="add" size={16} color={COLORS.primary} />
                  <Text style={[empty.btnText, { color: COLORS.primary }]}>Create Tribe</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      )}
    </View>
  );
};

const sync = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  text:   { fontSize: 12 },
});

const empty = StyleSheet.create({
  wrap:       { alignItems: 'center', paddingVertical: 72, paddingHorizontal: 32 },
  iconWrap:   { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title:      { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  sub:        { fontSize: 14, textAlign: 'center', marginBottom: 28 },
  actions:    { flexDirection: 'row', gap: 12 },
  btn:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 22 },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22, borderWidth: 1.5 },
  btnText:    { color: '#FFF', fontSize: 14, fontWeight: '600' },
});

export default TribeListScreen;
