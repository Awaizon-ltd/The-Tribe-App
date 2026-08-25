// screens/feed/ActivityFeedScreen.js
// Social activity feed — two tabs: Activity (guild posts) + Governance (DAO proposals).
// Posts are ranked by the visibility score algorithm (engagement × diversity ÷ age).
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  Animated, Image,
} from 'react-native';
import { Ionicons }           from '@expo/vector-icons';
import { useTheme }           from '../../contexts/ThemeContext';
import { useWallet }          from '../../contexts/WalletContext';
import { useUserData }        from '../../contexts/UserDataContext';
import { useAuth }            from '../../contexts/AuthContext';
import TabHeader              from '../../components/common/TabHeader';
import UserIcon               from '../../components/common/UserIcon';
import { useActivityFeed, useGovernanceFeed } from '../../hooks/useActivityFeed';
import { useDAOContract }     from '../../hooks/useDAOContract';
import FeedPostCard           from '../../components/feed/FeedPostCard';
import ProposalFeedCard       from '../../components/feed/ProposalFeedCard';
import CommentsModal          from '../../components/post/CommentsModal';
import Alert                  from '../../utils/Alert';
import api                    from '../../services/GuildApiService';

const TABS = [
  { id: 'activity',    label: 'Activity',    icon: 'flame-outline' },
  { id: 'governance',  label: 'Governance',  icon: 'shield-half-outline' },
];

// ── Skeleton row (borderless, matches new card style) ────────────────────────
const SkeletonCard = ({ COLORS }) => (
  <View style={[sk.card, { backgroundColor: COLORS.background }]}>
    <View style={sk.header}>
      <View style={[sk.avatar, { backgroundColor: COLORS.surface }]} />
      <View style={sk.lines}>
        <View style={[sk.line, sk.w70, { backgroundColor: COLORS.surface }]} />
        <View style={[sk.line, sk.w40, { backgroundColor: COLORS.surface }]} />
      </View>
    </View>
    <View style={[sk.body, { backgroundColor: COLORS.surface }]} />
    <View style={[sk.body, sk.short, { backgroundColor: COLORS.surface }]} />
    <View style={[sk.sep, { backgroundColor: COLORS.divider }]} />
  </View>
);
const sk = StyleSheet.create({
  card:   { paddingHorizontal: 16, paddingTop: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  lines:  { flex: 1, gap: 9 },
  line:   { height: 13, borderRadius: 6 },
  w70:    { width: '70%' },
  w40:    { width: '40%' },
  body:   { height: 14, borderRadius: 6, marginBottom: 8 },
  short:  { width: '60%' },
  sep:    { height: StyleSheet.hairlineWidth, marginTop: 12 },
});

// ── Repost modal ─────────────────────────────────────────────────────────────
const RepostModal = ({ visible, post, onClose, onConfirm, COLORS }) => {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await onConfirm(post, comment.trim() || null);
      setComment('');
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to repost');
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={rm.overlay}>
        <View style={[rm.sheet, { backgroundColor: COLORS.background }]}>
          <View style={rm.handle} />
          <Text style={[rm.title, { color: COLORS.text }]}>Repost</Text>
          <Text style={[rm.sub, { color: COLORS.textSecondary }]}>
            Add an optional comment (quote repost)
          </Text>
          <TextInput
            style={[rm.input, { backgroundColor: COLORS.surface, color: COLORS.text, borderColor: COLORS.divider }]}
            placeholder="Say something…"
            placeholderTextColor={COLORS.textTertiary}
            value={comment}
            onChangeText={setComment}
            maxLength={280}
            multiline
          />
          <View style={rm.btns}>
            <TouchableOpacity style={[rm.btn, { borderColor: COLORS.divider, borderWidth: 1 }]} onPress={onClose}>
              <Text style={{ color: COLORS.text, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rm.btn, { backgroundColor: COLORS.primary }]}
              onPress={submit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={{ color: '#FFF', fontWeight: '700' }}>Repost</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
const rm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  handle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 16 },
  title:   { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sub:     { fontSize: 13, marginBottom: 16 },
  input:   { borderRadius: 12, borderWidth: 1, padding: 12, minHeight: 80, fontSize: 15, marginBottom: 20 },
  btns:    { flexDirection: 'row', gap: 12 },
  btn:     { flex: 1, paddingVertical: 13, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

// ── Governance sub-feed (one DAO) ─────────────────────────────────────────────
// Each linked DAO gets its own mini-section. We use useDAOContract per DAO.
const DAOProposalSection = ({ dao, guildName, guildLogoUrl, navigation }) => {
  const { daoInfo, proposals, isLoading } = useDAOContract(dao.daoAddress);
  const { COLORS } = useTheme();

  const active = proposals.filter(p => p.status === 0);
  const others = proposals.filter(p => p.status !== 0).slice(0, 3);
  const shown  = [...active, ...others].slice(0, 6);

  if (isLoading) return <ActivityIndicator size="small" color={COLORS.primary} style={{ margin: 16 }} />;
  if (!shown.length) return null;

  return (
    <View>
      {shown.map(p => (
        <ProposalFeedCard
          key={`${dao.daoAddress}-${p.id}`}
          proposal={p}
          daoName={daoInfo?.name || daoInfo?.daoName || 'DAO'}
          daoAddress={dao.daoAddress}
          guildName={guildName}
          guildLogoUrl={guildLogoUrl}
          chainId={dao.chainId}
          onPress={(proposal, addr) =>
            navigation.navigate('ProposalDetail', { proposal, daoAddress: addr })
          }
          onVote={(proposal, addr) =>
            navigation.navigate('ProposalDetail', { proposal, daoAddress: addr })
          }
        />
      ))}
    </View>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────

const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 60,
  minimumViewTime: 1500,
};

const ActivityFeedScreen = ({ navigation }) => {
  const { COLORS } = useTheme();
  const { userData } = useUserData();
  const { user }     = useAuth();
  const [activeTab, setTab]             = useState('activity');
  const [commentPost, setCommentPost]   = useState(null);
  const [repostTarget, setRepostTarget] = useState(null);
  const impressionsSent = useRef(new Set());

  // Activity feed
  const {
    posts, loading, loadingMore, hasMore, refreshing, error,
    refresh, loadMore, handleReact, handleRepost,
  } = useActivityFeed();

  // Governance feed
  const { linkedDAOs, loading: govLoading } = useGovernanceFeed();

  const tabAnim = useRef(new Animated.Value(0)).current;

  const switchTab = (id) => {
    setTab(id);
    Animated.timing(tabAnim, {
      toValue: id === 'activity' ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  // ── Add comment (called from CommentsModal) ───────────────────────────────
  const handleAddComment = useCallback(async (postId, text) => {
    const guildId = commentPost?.guildId;
    if (!guildId || !text?.trim()) return;
    await api.addComment(guildId, postId, {
      text:       text.trim(),
      username:   userData?.username || user?.email?.split('@')[0] || 'User',
      userAvatar: userData?.profilePicture || null,
    });
  }, [commentPost, userData, user]);

  // ── Activity tab item render ──────────────────────────────────────────────
  const renderPost = useCallback(({ item }) => (
    <FeedPostCard
      post={item}
      onReact={handleReact}
      onComment={(p) => setCommentPost(p)}
      onRepost={(p) => setRepostTarget(p)}
      onNavigateGuild={(gId) => navigation.navigate('GuildDetail', { guildId: gId })}
      canDelete={false}
      onPressContent={() => navigation.navigate('PostDetail', { post: item, guildId: item.guildId })}
    />
  ), [handleReact, navigation]);

  const keyExtractor = useCallback((item) => item.id, []);

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    viewableItems.forEach(({ item }) => {
      if (item?.id && item?.guildId && !impressionsSent.current.has(item.id)) {
        impressionsSent.current.add(item.id);
        api.trackImpression(item.guildId, item.id).catch(() => {});
      }
    });
  }, []);

  // ── Governance tab content ─────────────────────────────────────────────────
  const GovernanceContent = () => {
    if (govLoading) {
      return (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }
    if (!linkedDAOs.length) {
      return (
        <View style={s.empty}>
          <View style={[s.emptyIcon, { backgroundColor: COLORS.primary + '15' }]}>
            <Ionicons name="shield-half-outline" size={44} color={COLORS.primary} />
          </View>
          <Text style={[s.emptyTitle, { color: COLORS.text }]}>No Governance Yet</Text>
          <Text style={[s.emptySub, { color: COLORS.textSecondary }]}>
            Guild owners can link a DAO in Guild Settings to enable governance proposals here.
          </Text>
        </View>
      );
    }
    return (
      <FlatList
        data={linkedDAOs}
        keyExtractor={d => `${d.daoAddress}-${d.chainId}`}
        renderItem={({ item }) => (
          <DAOProposalSection
            dao={item}
            guildName={item.guildName}
            guildLogoUrl={item.guildLogo}
            navigation={navigation}
          />
        )}
        contentContainerStyle={s.listPad}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  // ── Tab indicator ──────────────────────────────────────────────────────────
  const indicatorLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  const styles = makeStyles(COLORS);

  return (
    <View style={styles.safe}>

   <TabHeader
  showLogo
  border
  left={
    <View style={{ transform: [{ scale: 0.8 }] }}>
      <UserIcon onPress={() => navigation.getParent('ProfileDrawer')?.openDrawer()} />
    </View>
  }
  rightActions={[
    { icon: 'search-outline', onPress: () => navigation.navigate('SearchGuild') },
  ]}
/>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={styles.tabBtn}
            onPress={() => switchTab(t.id)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={t.icon}
              size={16}
              color={activeTab === t.id ? COLORS.primary : COLORS.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === t.id && { color: COLORS.primary }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
        {/* Sliding underline */}
        <Animated.View style={[styles.tabIndicator, { left: indicatorLeft, backgroundColor: COLORS.primary }]} />
      </View>

      {/* Content */}
      {activeTab === 'activity' ? (
        loading && !posts.length ? (
          <View>
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} COLORS={COLORS} />)}
          </View>
        ) : error && !posts.length ? (
          <View style={s.center}>
            <Ionicons name="warning-outline" size={40} color={COLORS.error || '#EF4444'} />
            <Text style={[s.emptyTitle, { color: COLORS.text }]}>{error}</Text>
            <TouchableOpacity onPress={refresh} style={[s.retryBtn, { backgroundColor: COLORS.primary }]}>
              <Text style={{ color: '#FFF', fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={keyExtractor}
            renderItem={renderPost}
            contentContainerStyle={styles.listPad}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={VIEWABILITY_CONFIG}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={COLORS.primary}
                colors={[COLORS.primary]}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={error ? (
              <TouchableOpacity
                onPress={refresh}
                style={[s.errorBanner, { backgroundColor: (COLORS.error || '#EF4444') + '18' }]}
              >
                <Ionicons name="alert-circle-outline" size={15} color={COLORS.error || '#EF4444'} />
                <Text style={[s.errorBannerText, { color: COLORS.error || '#EF4444' }]}>
                  Could not refresh — tap to retry
                </Text>
              </TouchableOpacity>
            ) : null}
            ListFooterComponent={
              loadingMore
                ? <ActivityIndicator size="small" color={COLORS.primary} style={{ paddingVertical: 16 }} />
                : !hasMore && posts.length > 0
                  ? <Text style={[s.endText, { color: COLORS.textTertiary }]}>You're all caught up</Text>
                  : null
            }
            ListEmptyComponent={
              !loading && (
                <View style={s.empty}>
                  <View style={[s.emptyIcon, { backgroundColor: COLORS.primary + '15' }]}>
                    <Ionicons name="flame-outline" size={44} color={COLORS.primary} />
                  </View>
                  <Text style={[s.emptyTitle, { color: COLORS.text }]}>Nothing here yet</Text>
                  <Text style={[s.emptySub, { color: COLORS.textSecondary }]}>
                    Join guilds to see their posts ranked by activity
                  </Text>
                  <TouchableOpacity
                    style={[s.retryBtn, { backgroundColor: COLORS.primary }]}
                    onPress={() => navigation.navigate('SearchGuild')}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '600' }}>Explore Guilds</Text>
                  </TouchableOpacity>
                </View>
              )
            }
          />
        )
      ) : (
        <GovernanceContent />
      )}

      {/* Comments modal */}
      {commentPost && (
        <CommentsModal
          visible={!!commentPost}
          post={commentPost}
          guildId={commentPost?.guildId}
          onClose={() => setCommentPost(null)}
          onAddComment={handleAddComment}
        />
      )}

      {/* Repost modal */}
      <RepostModal
        visible={!!repostTarget}
        post={repostTarget}
        onClose={() => setRepostTarget(null)}
        onConfirm={handleRepost}
        COLORS={COLORS}
      />
    </View>
  );
};

const makeStyles = (COLORS) => StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.background },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    position: 'relative',
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
  },
  tabLabel:    { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  tabIndicator: {
    position: 'absolute', bottom: 0, width: '50%',
    height: 2.5, borderTopLeftRadius: 2, borderTopRightRadius: 2,
  },

  listPad: { paddingBottom: 110 },
});

const s = StyleSheet.create({
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty:     { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptySub:   { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryBtn:   { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 22 },
  endText:    { textAlign: 'center', paddingVertical: 16, fontSize: 13 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 10, marginBottom: 2,
    padding: 10, borderRadius: 8,
  },
  errorBannerText: { fontSize: 13, fontWeight: '500', flex: 1 },
});

export default ActivityFeedScreen;
