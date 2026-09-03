import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, FlatList,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useUserData } from '../../contexts/UserDataContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/TribeApiService';
import Alert from '../../utils/Alert';
import { updateEngagement } from '../../utils/PostEngagementStore';
import { formatTimeAgo, getEntityTimestamp } from '../../utils/helpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCount(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ── Comment item ──────────────────────────────────────────────────────────────

const CommentItem = ({ comment, COLORS }) => {
  // Was `typeof comment.createdAt === 'number' ? ... : Date.now()` — the API
  // always sends createdAt as an ISO string (Mongo Date → JSON), never a
  // number, so that check was always false and every comment silently fell
  // back to "right now". getEntityTimestamp reads the real numeric field.
  const ts = getEntityTimestamp(comment);
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.username || '?')}&size=64&background=random`;

  return (
    <View style={ci.row}>
      <Image
        source={{ uri: comment.userAvatar || fallbackAvatar }}
        style={[ci.avatar, { backgroundColor: COLORS.surface }]}
      />
      <View style={[ci.bubble, { backgroundColor: COLORS.surface }]}>
        <View style={ci.header}>
          <Text style={[ci.username, { color: COLORS.text }]}>{comment.username || 'User'}</Text>
          <Text style={[ci.time, { color: COLORS.textTertiary }]}>{formatTimeAgo(ts)}</Text>
        </View>
        <Text style={[ci.text, { color: COLORS.textSecondary }]}>{comment.commentText || comment.text}</Text>
      </View>
    </View>
  );
};

const ci = StyleSheet.create({
  row:      { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  avatar:   { width: 34, height: 34, borderRadius: 17, marginTop: 2 },
  bubble:   { flex: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  username: { fontSize: 13, fontWeight: '700' },
  time:     { fontSize: 11 },
  text:     { fontSize: 14, lineHeight: 20 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

const PostDetailScreen = ({ route, navigation }) => {
  // Deep links pass only { postId, tribeId }; normal navigation passes a full post object.
  const { post: initialPost, postId: deepLinkPostId, tribeId, tribe } = route.params;
  const { COLORS, isDark } = useTheme();
  const { userData } = useUserData();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [post, setPost]           = useState(initialPost ?? null);
  const [fetchingPost, setFetchingPost] = useState(!initialPost && !!deepLinkPostId);

  // Fetch the post when arriving via deep link (no post object provided)
  useEffect(() => {
    if (initialPost || !deepLinkPostId || !tribeId) return;
    setFetchingPost(true);
    api.getPost(tribeId, deepLinkPostId)
      .then(data => setPost(data))
      .catch(() => {})
      .finally(() => setFetchingPost(false));
  }, [deepLinkPostId, tribeId]);
  const [comments, setComments]   = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [imgErr, setImgErr]           = useState(false);
  const listRef = useRef(null);

  if (fetchingPost || !post) {
    return (
      <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center' }, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const ts = getEntityTimestamp(post);

  const logoUrl   = tribe?.logo_url || tribe?.logoUrl || post.tribeLogoUrl;
  const tribeName = tribe?.name || post.tribeName || 'Tribe';
  const resolvedTribeId = tribeId || post.tribeId;

  // ── Load comments from MongoDB via backend API ───────────────────────────
  useEffect(() => {
    if (!resolvedTribeId || !post.id) return;
    let cancelled = false;

    setLoadingComments(true);
    api.getComments(resolvedTribeId, post.id, 100, 0)
      .then(data => {
        if (!cancelled) {
          setComments((data || []).map(c => ({
            ...c,
            commentText: c.commentText ?? c.text ?? '',
          })));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingComments(false); });

    return () => { cancelled = true; };
  }, [resolvedTribeId, post.id]);

  // ── Submit comment ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const text = commentText.trim();
    if (!text || submitting) return;
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const username   = userData?.username || user?.email?.split('@')[0] || 'User';
      const userAvatar = userData?.profilePicture || null;
      const saved = await api.addComment(resolvedTribeId, post.id, { text, username, userAvatar });
      setCommentText('');
      // Optimistically append so the user sees their comment immediately
      const newComment = {
        id:          saved?.id ?? `tmp-${Date.now()}`,
        commentText: text,
        username,
        userAvatar,
        createdAt:   Date.now(),
      };
      setComments(prev => [...prev, newComment]);
      const newCount = (post.commentsCount || 0) + 1;
      setPost(p => ({ ...p, commentsCount: newCount }));
      updateEngagement(post.id, { commentsCount: newCount });
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Post body (header of the FlatList) ───────────────────────────────────
  const PostHeader = () => (
    <View>
      {/* Author row */}
      <View style={s.authorRow}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback, { backgroundColor: COLORS.primary + '22' }]}>
            <Text style={[s.avatarLetter, { color: COLORS.primary }]}>
              {tribeName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={s.authorText}>
          <Text style={[s.tribeName, { color: COLORS.text }]} numberOfLines={1}>{tribeName}</Text>
          <Text style={[s.meta, { color: COLORS.textSecondary }]}>
            {post.username} · {formatTimeAgo(ts)}
          </Text>
        </View>
      </View>

      {/* Full description */}
      {!!post.description && (
        <Text style={[s.description, { color: COLORS.text }]}>
          {post.description}
        </Text>
      )}

      {/* Full image */}
      {post.imageUrl && !imgErr && (
        <Image
          source={{ uri: post.imageUrl }}
          style={[s.image, { backgroundColor: COLORS.surface }]}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
      )}

      {/* Engagement counts */}
      {(post.likesCount > 0 || post.commentsCount > 0) && (
        <View style={[s.countRow, { borderBottomColor: COLORS.divider }]}>
          {post.likesCount > 0 && (
            <View style={s.countItem}>
              <Ionicons name="heart" size={14} color="#EF4444" />
              <Text style={[s.countText, { color: COLORS.textSecondary }]}>
                {fmtCount(post.likesCount)} like{post.likesCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {post.commentsCount > 0 && (
            <Text style={[s.countText, { color: COLORS.textTertiary }]}>
              {fmtCount(post.commentsCount)} comment{post.commentsCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      )}

      {/* Comments section label */}
      <View style={[s.commentsLabel, { borderBottomColor: COLORS.divider }]}>
        <Text style={[s.commentsTitle, { color: COLORS.textSecondary }]}>
          {loadingComments ? 'Loading comments…' : `${comments.length} comment${comments.length !== 1 ? 's' : ''}`}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: COLORS.background }]}>


      {/* Header bar */}
      <View style={[s.topBar, { paddingTop: insets.top + 6, borderBottomColor: COLORS.divider, backgroundColor: COLORS.background }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[s.topBarTitle, { color: COLORS.text }]}>Post</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Content + Comments */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={comments}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <CommentItem comment={item} COLORS={COLORS} />}
          ListHeaderComponent={<PostHeader />}
          ListEmptyComponent={
            loadingComments ? null : (
              <View style={s.emptyComments}>
                <Ionicons name="chatbubble-outline" size={32} color={COLORS.textTertiary} />
                <Text style={[s.emptyText, { color: COLORS.textTertiary }]}>No comments yet. Be the first!</Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* Comment input */}
        <View style={[s.inputBar, {
          paddingBottom: insets.bottom + 8,
          borderTopColor: COLORS.divider,
          backgroundColor: COLORS.background,
        }]}>
          <TextInput
            style={[s.input, {
              backgroundColor: COLORS.surface,
              color: COLORS.text,
              borderColor: COLORS.divider,
            }]}
            placeholder="Add a comment…"
            placeholderTextColor={COLORS.textTertiary}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[s.sendBtn, {
              backgroundColor: commentText.trim() ? COLORS.primary : COLORS.surface,
              opacity: submitting ? 0.6 : 1,
            }]}
            onPress={handleSubmit}
            disabled={!commentText.trim() || submitting}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Ionicons name="send" size={18} color={commentText.trim() ? '#FFF' : COLORS.textTertiary} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:     { width: 38, height: 38, justifyContent: 'center' },
  topBarTitle: { fontSize: 17, fontWeight: '700' },

  authorRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, gap: 11 },
  avatar:       { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '700' },
  authorText:   { flex: 1 },
  tribeName:    { fontSize: 15, fontWeight: '700' },
  meta:         { fontSize: 12, marginTop: 1 },

  description: { fontSize: 16, lineHeight: 24, paddingHorizontal: 16, paddingBottom: 14 },
  image:       { width: '100%', aspectRatio: 1.78 },

  countRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  countItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  countText: { fontSize: 13 },

  commentsLabel: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  commentsTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  emptyComments: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyText:     { fontSize: 14 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, maxHeight: 120, minHeight: 42,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default PostDetailScreen;
