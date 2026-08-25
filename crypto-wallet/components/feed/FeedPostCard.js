import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme }    from '../../contexts/ThemeContext';
import ReactionPicker  from './ReactionPicker';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  const d = Date.now() - ts;
  const s = Math.floor(d / 1000);
  if (s < 60)  return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtCount(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const REACTION_EMOJI = {
  fire: '🔥', heart: '❤️', thumbsup: '👍',
  laugh: '🤣', wow: '😮', sad: '😢',
};

function topReactionEmojis(counts = {}) {
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k]) => REACTION_EMOJI[k] || '🙂');
}

// ─── Repost banner ────────────────────────────────────────────────────────────
const RepostBanner = ({ username, comment, COLORS }) => (
  <View style={[rb.row, { borderBottomColor: COLORS.divider }]}>
    <Ionicons name="repeat" size={13} color={COLORS.textTertiary} />
    <Text style={[rb.text, { color: COLORS.textTertiary }]} numberOfLines={1}>
      <Text style={{ fontWeight: '600', color: COLORS.textSecondary }}>{username}</Text>
      {' reposted'}{comment ? ` · "${comment}"` : ''}
    </Text>
  </View>
);
const rb = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, fontSize: 12 },
});

// ─── Main card ────────────────────────────────────────────────────────────────
const CAPTION_LIMIT = 220;

const FeedPostCard = ({
  post,
  onReact,
  onComment,
  onRepost,
  onNavigateGuild,
  canDelete,
  onDelete,
  onPressContent,   // navigate to PostDetail when description/image is tapped
}) => {
  const { COLORS } = useTheme();
  const [imgErr, setImgErr]             = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const isTruncated = (post.description?.length || 0) > CAPTION_LIMIT;

  const totalReactions = Object.values(post.reactionCounts || {}).reduce((s, n) => s + n, 0);
  const topEmojis      = topReactionEmojis(post.reactionCounts);
  const myEmoji        = post.myReaction ? (REACTION_EMOJI[post.myReaction] || '🙂') : null;

  const handleShare = useCallback(async () => {
    const url = `https://sysfidao.com/post/${post.guildId}/${post.id}`;
    try { await Share.share({ url, message: url }); }
    catch {}
  }, [post.guildId, post.id]);

  const handleNavigate = useCallback(() => {
    onNavigateGuild?.(post.guildId);
  }, [post.guildId, onNavigateGuild]);

  return (
    <View style={{ backgroundColor: COLORS.background }}>

      {/* Repost banner */}
      {post.isRepost && (
        <RepostBanner username={post.username} comment={post.repostComment} COLORS={COLORS} />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.authorRow} onPress={handleNavigate} activeOpacity={0.7}>
          {post.guildLogoUrl ? (
            <Image source={{ uri: post.guildLogoUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback, { backgroundColor: COLORS.primary + '22' }]}>
              <Text style={[s.avatarLetter, { color: COLORS.primary }]}>
                {post.guildName?.charAt(0)?.toUpperCase() || 'G'}
              </Text>
            </View>
          )}
          <View style={s.authorText}>
            <Text style={[s.guildName, { color: COLORS.text }]} numberOfLines={1}>
              {post.guildName}
            </Text>
            <Text style={[s.meta, { color: COLORS.textSecondary }]} numberOfLines={1}>
              {post.isRepost && post.originalAuthor
                ? `Originally by ${post.originalAuthor} · `
                : ''
              }{post.username} · {timeAgo(post.timestamp)}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={s.headerRight}>
          {post.visibilityScore > 500 && (
            <View style={[s.trendPill, { backgroundColor: COLORS.primary + '18' }]}>
              <Ionicons name="flame" size={11} color={COLORS.primary} />
            </View>
          )}
          {canDelete && (
            <TouchableOpacity
              onPress={() => onDelete?.(post.id)}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="trash-outline" size={17} color={COLORS.error || '#EF4444'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Caption ──────────────────────────────────────────────────────────── */}
      {!!post.description && (
        <TouchableOpacity
          activeOpacity={onPressContent ? 0.75 : 1}
          onPress={onPressContent}
          disabled={!onPressContent}
        >
          <Text style={[s.caption, { color: COLORS.text }]}>
            {isTruncated ? post.description.slice(0, CAPTION_LIMIT) : post.description}
          </Text>
          {isTruncated && (
            <Text style={[s.readMore, { color: COLORS.primary }]}>...more</Text>
          )}
        </TouchableOpacity>
      )}

      {/* ── Image — edge-to-edge ─────────────────────────────────────────────── */}
      {post.imageUrl && !imgErr && (
        <TouchableOpacity
          activeOpacity={onPressContent ? 0.9 : 1}
          onPress={onPressContent}
          disabled={!onPressContent}
        >
          <Image
            source={{ uri: post.imageUrl }}
            style={[s.image, { backgroundColor: COLORS.surface }]}
            resizeMode="cover"
            onError={() => setImgErr(true)}
          />
        </TouchableOpacity>
      )}

      {/* ── Reaction picker (shown above bar when open) ────────────────────────── */}
      {showReactions && (
        <View style={s.pickerWrap}>
          <ReactionPicker
            reactionCounts={post.reactionCounts}
            myReaction={post.myReaction}
            onReact={(type) => { onReact?.(post.id, type); setShowReactions(false); }}
          />
        </View>
      )}

      {/* ── Engagement bar (Twitter-style) ───────────────────────────────────── */}
      <View style={[s.engageBar, { borderTopColor: COLORS.divider }]}>

        {/* Comment */}
        <TouchableOpacity style={s.engageBtn} onPress={() => onComment?.(post)} activeOpacity={0.6}>
          <Ionicons name="chatbubble-outline" size={18} color={COLORS.textSecondary} />
          {post.commentsCount > 0 && (
            <Text style={[s.engageCount, { color: COLORS.textSecondary }]}>
              {fmtCount(post.commentsCount)}
            </Text>
          )}
        </TouchableOpacity>

        {/* Repost */}
        <TouchableOpacity
          style={s.engageBtn}
          onPress={() => onRepost?.(post)}
          activeOpacity={0.6}
        >
          <Ionicons
            name="repeat"
            size={19}
            color={post.hasReposted ? COLORS.primary : COLORS.textSecondary}
          />
          {post.repostCount > 0 && (
            <Text style={[s.engageCount, { color: post.hasReposted ? COLORS.primary : COLORS.textSecondary }]}>
              {fmtCount(post.repostCount)}
            </Text>
          )}
        </TouchableOpacity>

        {/* React */}
        <TouchableOpacity
          style={s.engageBtn}
          onPress={() => setShowReactions(v => !v)}
          activeOpacity={0.6}
        >
          {myEmoji ? (
            <Text style={s.emojiIcon}>{myEmoji}</Text>
          ) : (
            <Ionicons name="happy-outline" size={18} color={COLORS.textSecondary} />
          )}
          {totalReactions > 0 && (
            <Text style={[s.engageCount, { color: post.myReaction ? COLORS.primary : COLORS.textSecondary }]}>
              {fmtCount(totalReactions)}
            </Text>
          )}
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity style={s.engageBtn} onPress={handleShare} activeOpacity={0.6}>
          <Ionicons name="share-outline" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Impressions — far right, read-only */}
        <View style={[s.engageBtn, s.engageViews]}>
          <Ionicons name="bar-chart-outline" size={16} color={COLORS.textTertiary} />
          {(post.impressionCount ?? 0) > 0 && (
            <Text style={[s.engageCount, { color: COLORS.textTertiary }]}>
              {fmtCount(post.impressionCount)}
            </Text>
          )}
        </View>

      </View>

      {/* ── Twitter-style separator ───────────────────────────────────────────── */}
      <View style={[s.separator, { backgroundColor: COLORS.divider }]} />
    </View>
  );
};

const s = StyleSheet.create({
  // Header
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  authorRow:    { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 11 },
  avatar:       { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '700' },
  authorText:   { flex: 1 },
  guildName:    { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  meta:         { fontSize: 12, lineHeight: 17, marginTop: 1 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trendPill:    { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  // Caption
  caption:  { fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingBottom: 10 },
  readMore: { fontSize: 14, fontWeight: '600', paddingHorizontal: 16, paddingBottom: 10, marginTop: -6 },

  // Image — no horizontal margin = edge-to-edge
  image: { width: '100%', aspectRatio: 1.78, marginBottom: 0 },

  // Reaction picker
  pickerWrap: { paddingHorizontal: 16, paddingBottom: 4 },

  // Engagement bar — Twitter style
  engageBar:   {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  engageBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 20 },
  engageViews: { marginLeft: 'auto' },
  engageCount: { fontSize: 13, fontWeight: '500' },
  emojiIcon:   { fontSize: 17, lineHeight: 22 },

  // Separator
  separator: { height: StyleSheet.hairlineWidth, marginTop: 4 },
});

export default FeedPostCard;
