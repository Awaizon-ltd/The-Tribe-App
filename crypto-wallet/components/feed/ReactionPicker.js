// components/feed/ReactionPicker.js
// Emoji reaction row — renders inline below a post.
// Tapping the active reaction removes it; tapping another swaps it.
import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export const REACTIONS = [
  { type: 'fire',     emoji: '🔥', label: 'Fire'  },
  { type: 'heart',    emoji: '❤️', label: 'Love'  },
  { type: 'thumbsup', emoji: '👍', label: 'Like'  },
  { type: 'laugh',    emoji: '🤣', label: 'Haha'  },
  { type: 'wow',      emoji: '😮', label: 'Wow'   },
  { type: 'sad',      emoji: '😢', label: 'Sad'   },
];

// ── Single reaction button ────────────────────────────────────────────────────

const ReactionBtn = ({ reaction, count, isActive, onPress }) => {
  const { COLORS } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Quick pop animation on tap
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.35, duration: 90,  useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
    onPress(reaction.type);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.75} style={s.btn}>
      <Animated.View
        style={[
          s.pill,
          {
            backgroundColor: isActive ? COLORS.primary + '20' : COLORS.surface,
            borderColor:      isActive ? COLORS.primary         : COLORS.divider,
          },
          { transform: [{ scale }] },
        ]}
      >
        <Text style={s.emoji}>{reaction.emoji}</Text>
        {count > 0 && (
          <Text style={[s.count, { color: isActive ? COLORS.primary : COLORS.textSecondary }]}>
            {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── Exported component ────────────────────────────────────────────────────────

const ReactionPicker = ({ reactionCounts = {}, myReaction, onReact }) => (
  <View style={s.row}>
    {REACTIONS.map(r => (
      <ReactionBtn
        key={r.type}
        reaction={r}
        count={reactionCounts[r.type] || 0}
        isActive={myReaction === r.type}
        onPress={onReact}
      />
    ))}
  </View>
);

const s = StyleSheet.create({
  row:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 8 },
  btn:   {},
  pill:  {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  emoji: { fontSize: 16 },
  count: { fontSize: 13, fontWeight: '600' },
});

export default ReactionPicker;
