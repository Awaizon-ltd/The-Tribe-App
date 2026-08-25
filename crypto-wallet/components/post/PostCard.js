import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Share, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import Alert from '../../utils/Alert';
import ReactionPicker, { REACTIONS } from '../feed/ReactionPicker';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return '';
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

const REACTION_EMOJI = Object.fromEntries(REACTIONS.map(r => [r.type, r.emoji]));

function topReactionEmojis(counts = {}) {
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k]) => REACTION_EMOJI[k] || '🙂');
}

// ─── Linkify text ─────────────────────────────────────────────────────────────
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
const LinkifyText = ({ text, color, linkColor }) => {
  const parts = text.split(URL_PATTERN);
  return (
    <Text style={[s.caption, { color }]}>
      {parts.map((part, i) =>
        URL_PATTERN.test(part) ? (
          <Text key={i} style={{ color: linkColor, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL(part)}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const CAPTION_LIMIT = 220;

const POST_BASE_URL = 'https://sysfidao.com/post';

const PostCard = ({
  post,
  guild,
  onReact,
  onComment,
  onDelete,
  canDelete,
  onNavigateGuild,
  onPressContent,
}) => {
  const { COLORS } = useTheme();
  const [imgErr, setImgErr]               = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const isTruncated    = (post.description?.length || 0) > CAPTION_LIMIT;
  const totalReactions = Object.values(post.reactionCounts || {}).reduce((s, n) => s + n, 0);
  const topEmojis      = topReactionEmojis(post.reactionCounts);
  const myEmoji        = post.myReaction ? (REACTION_EMOJI[post.myReaction] || '🙂') : null;

  const ts = post.createdAt instanceof Date
    ? post.createdAt.getTime()
    : typeof post.createdAt === 'number' ? post.createdAt : post.timestamp;

  const logoUrl = guild?.logo_url || guild?.logoUrl;
  const guildName = guild?.name || 'Unknown Guild';

  const handleDelete = useCallback(() => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(post.id) },
    ]);
  }, [post.id, onDelete]);

  const handleShare = useCallback(async () => {
    const guildId = guild?.id || guild?.guildId || post.guildId;
    const url = `${POST_BASE_URL}/${guildId}/${post.id}`;
    try {
      await Share.share({ url, message: url });   // iOS uses url; Android uses message
    } catch {}
  }, [guild, post.id, post.guildId]);

  return (
    <View style={{ backgroundColor: COLORS.background }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={s.header}
        onPress={() => onNavigateGuild?.()}
        activeOpacity={onNavigateGuild ? 0.7 : 1}
        disabled={!onNavigateGuild}
      >
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback, { backgroundColor: COLORS.primary + '22' }]}>
            <Text style={[s.avatarLetter, { color: COLORS.primary }]}>
              {guildName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={s.headerText}>
          <View style={s.nameRow}>
            <Text style={[s.guildName, { color: COLORS.text }]} numberOfLines={1}>
              {guildName}
            </Text>
            {guild?.verified && (
              <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} style={{ marginLeft: 3 }} />
            )}
          </View>
          <Text style={[s.meta, { color: COLORS.textSecondary }]}>
            {post.username} · {timeAgo(ts)}
          </Text>
        </View>

        {canDelete && (
          <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Ionicons name="trash-outline" size={17} color={COLORS.error || '#EF4444'} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* ── Caption ──────────────────────────────────────────────────────────── */}
      {!!post.description && (
        <TouchableOpacity
          activeOpacity={onPressContent ? 0.75 : 1}
          onPress={onPressContent}
          disabled={!onPressContent}
        >
          <LinkifyText
            text={isTruncated ? post.description.slice(0, CAPTION_LIMIT) : post.description}
            color={COLORS.text}
            linkColor={COLORS.primary}
          />
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

      {/* ── Reaction picker (shown above bar when open) ───────────────────────── */}
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
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 11 },
  avatar:        { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarLetter:  { fontSize: 18, fontWeight: '700' },
  headerText:    { flex: 1 },
  nameRow:       { flexDirection: 'row', alignItems: 'center' },
  guildName:     { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  meta:          { fontSize: 12, lineHeight: 17, marginTop: 1 },

  // Caption
  caption:  { fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingBottom: 10 },
  readMore: { fontSize: 14, fontWeight: '600', paddingHorizontal: 16, paddingBottom: 10, marginTop: -6 },

  // Image
  image: { width: '100%', aspectRatio: 1.78 },

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

export default PostCard;
