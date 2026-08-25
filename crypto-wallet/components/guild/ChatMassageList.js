import React, { useMemo, forwardRef, useCallback } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ChatMessage from './ChatMessage';
import DateSeparator from './DateSeperator';
import { useTheme } from '../../contexts/ThemeContext';

const ChatMessagesList = forwardRef(({
  messages,
  isAdmin,
  hasMore,
  loading,
  onLoadMore,
  onDelete,
  onDeleteAllUserMessages,
  onBanUser,
  onPin,
  onUnpin,
  onRetry,
}, ref) => {
  const { COLORS, SPACING, BORDER_RADIUS } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      paddingBottom: 10,
      flexGrow: 1,
    },
    // Loading States
    loadingMore: {
      paddingVertical: SPACING.lg,
      alignItems: 'center',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: COLORS.surface,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    loadingText: {
      fontSize: 12,
      color: COLORS.textSecondary,
      fontWeight: '500',
    },
    // End of Messages (Should appear at TOP with oldest messages)
    endOfMessages: {
      paddingVertical: SPACING.xl,
      alignItems: 'center',
    },
    endOfMessagesCard: {
      backgroundColor: COLORS.surface,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      alignItems: 'center',
      gap: SPACING.xs,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    endOfMessagesIcon: {
      marginBottom: SPACING.xs,
    },
    endOfMessagesText: {
      color: COLORS.primary,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    endOfMessagesSubtext: {
      color: COLORS.textTertiary,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 2,
    },
    // Top Spacer (Should appear at BOTTOM with newest messages)
    topSpacer: {
      height: SPACING.sm,
    },
    // Empty State
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
      paddingBottom: 100,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: COLORS.primaryDark,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: SPACING.xs,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 15,
      color: COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 280,
    },
  });

  const isDifferentDay = useCallback((date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    return (
      d1.getFullYear() !== d2.getFullYear() ||
      d1.getMonth() !== d2.getMonth() ||
      d1.getDate() !== d2.getDate()
    );
  }, []);

  const messagesWithSeparators = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const items = [];

    messages.forEach((message, index) => {
      items.push({
        type: 'message',
        ...message,
      });

      if (index === messages.length - 1) {
        items.push({
          type: 'separator',
          id: `separator-${message.createdAt.getTime()}`,
          date: message.createdAt,
        });
      } else {
        const nextMessage = messages[index + 1];
        if (isDifferentDay(message.createdAt, nextMessage.createdAt)) {
          items.push({
            type: 'separator',
            id: `separator-${message.createdAt.getTime()}`,
            date: message.createdAt,
          });
        }
      }
    });

    return items;
  }, [messages, isDifferentDay]);

  const renderItem = useCallback(({ item, index }) => {
    if (item.type === 'separator') {
      return <DateSeparator date={item.date} />;
    }

    const nextItem = messagesWithSeparators[index + 1];
    const prevItem = messagesWithSeparators[index - 1];

    const isNextMessageSameUser =
      nextItem &&
      nextItem.type === 'message' &&
      nextItem.userId === item.userId;

    const isPrevMessageSameUser =
      prevItem &&
      prevItem.type === 'message' &&
      prevItem.userId === item.userId;

    return (
      <ChatMessage
        message={item}
        isAdmin={isAdmin}
        showAvatar={!isNextMessageSameUser}
        isGrouped={isPrevMessageSameUser}
        onDelete={onDelete}
        onDeleteAllUserMessages={onDeleteAllUserMessages}
        onBanUser={onBanUser}
        onPin={onPin}
        onUnpin={onUnpin}
        onRetry={onRetry}
      />
    );
  }, [
    messagesWithSeparators,
    isAdmin,
    onDelete,
    onDeleteAllUserMessages,
    onBanUser,
    onPin,
    onUnpin,
    onRetry
  ]);

  // ✅ SWAPPED: This now renders at TOP (with oldest messages) when inverted
  const renderListFooterComponent = useCallback(() => {
    // Show "Beginning" banner at TOP when all old messages are loaded
    if (!hasMore && messages.length > 0 && !loading) {
      return (
        <View style={styles.endOfMessages}>
          <View style={styles.endOfMessagesCard}>
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={COLORS.primary}
              style={styles.endOfMessagesIcon}
            />
            <Text style={styles.endOfMessagesText}>
              You've reached the beginning
            </Text>
            <Text style={styles.endOfMessagesSubtext}>
              This is where your conversation started
            </Text>
          </View>
        </View>
      );
    }

    // Show loading at TOP when fetching older messages
    if (loading && messages.length > 0 && hasMore) {
      return (
        <View style={styles.loadingMore}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading older messages...</Text>
          </View>
        </View>
      );
    }

    return null;
  }, [hasMore, loading, messages.length, COLORS, styles]);

  // ✅ SWAPPED: This now renders at BOTTOM (with newest messages) when inverted
  const renderListHeaderComponent = useCallback(() => {
    return <View style={styles.topSpacer} />;
  }, [styles]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading && messages.length > 0) {
      onLoadMore();
    }
  }, [hasMore, loading, messages.length, onLoadMore]);

  const handleRefresh = useCallback(() => {
    if (!loading && hasMore && messages.length > 0) {
      onLoadMore();
    }
  }, [loading, hasMore, messages.length, onLoadMore]);

  const keyExtractor = useCallback((item) => item.id, []);

  if (!messages || messages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          {/* Was color={COLORS.primary} — primary and primaryDark sit at the
              same lightness extreme within a theme (both near-black in light
              mode, both near-white in dark mode), so the icon was nearly
              invisible against its own background circle in both themes.
              onPrimary is built to contrast against that extreme. */}
          <Ionicons name="chatbubbles" size={40} color={COLORS.onPrimary} />
        </View>
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubtext}>
          Start the conversation! Be the first to send a message in this chat.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={ref}
      style={styles.container}
      data={messagesWithSeparators}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      inverted // ← This causes Header/Footer to swap visually!

      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={15}
      updateCellsBatchingPeriod={50}
      initialNumToRender={20}
      windowSize={11}

      // Loading
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.3}

      // ⚠️ IMPORTANT: Swapped for inverted list!
      // ListHeaderComponent appears at BOTTOM (newest messages)
      // ListFooterComponent appears at TOP (oldest messages)
      ListHeaderComponent={renderListHeaderComponent}
      ListFooterComponent={renderListFooterComponent}

      // Styling
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}

      // Keyboard
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"

      // Scroll position maintenance
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
        autoscrollToTopThreshold: 10,
      }}

      // Pull to refresh
      refreshControl={
        <RefreshControl
          refreshing={loading && messages.length > 0 && hasMore}
          onRefresh={handleRefresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
          progressBackgroundColor={COLORS.surface}
        />
      }
    />
  );
});

ChatMessagesList.displayName = 'ChatMessagesList';

export default ChatMessagesList;