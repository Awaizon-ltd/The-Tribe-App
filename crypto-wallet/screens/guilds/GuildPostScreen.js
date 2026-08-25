import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../../constants/Theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useGuildPosts } from '../../hooks/useGuildPost';
import PostCard from '../../components/post/PostCard';
import CreatePostModal from '../../components/post/CreatePostModal';
import CommentsModal from '../../components/post/CommentsModal';
import api from '../../services/GuildApiService';

const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 60,
  minimumViewTime: 1500,
};

const PostsScreen = ({ route, navigation }) => {
  const { guildId, membershipStatus, guild } = route.params;
  const { COLORS } = useTheme();
  const isOwner = membershipStatus === 'owner';
  const impressionsSent = useRef(new Set());

  const {
    posts,
    loading,
    loadingMore,
    hasMore,
    creating,
    createPost,
    reactToPost,
    addComment,
    deletePost,
    loadMorePosts,
  } = useGuildPosts(guildId);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleCreatePost = async (description, imageUrl) => {
    try {
      await createPost(description, imageUrl);
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleCommentPress = (post) => {
    setSelectedPost(post);
    setShowCommentsModal(true);
  };

  const handleAddComment = async (postId, commentText) => {
    try {
      await addComment(postId, commentText);
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    viewableItems.forEach(({ item }) => {
      if (item?.id && !impressionsSent.current.has(item.id)) {
        impressionsSent.current.add(item.id);
        api.trackImpression(guildId, item.id).catch(() => {});
      }
    });
  }, [guildId]);

  const renderPost = ({ item }) => (
    <PostCard
      post={item}
      guild={guild}
      guildId={guildId}
      onReact={reactToPost}
      onComment={handleCommentPress}
      onDelete={deletePost}
      canDelete={isOwner}
      onNavigateGuild={
        navigation
          ? () => navigation.navigate('GuildDetail', { guild })
          : undefined
      }
      onPressContent={
        navigation
          ? () => navigation.navigate('PostDetail', { post: item, guildId, guild })
          : undefined
      }
    />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading more posts...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="newspaper-outline" size={64} color={COLORS.textSecondary} />
        <Text style={styles.emptyText}>No posts yet</Text>
        {isOwner && (
          <Text style={styles.emptySubtext}>
            Be the first to share something with your guild!
          </Text>
        )}
      </View>
    );
  };

  // Move styles inside component to access dynamic COLORS
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
      paddingTop:10,
    },
    listContent: {
      padding: SPACING.md,
      paddingBottom: 80, // Space for FAB
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: SPACING.sm,
      fontSize: 14,
      color: COLORS.textSecondary,
    },
    loadingMore: {
      paddingVertical: SPACING.lg,
      alignItems: 'center',
    },
    emptyContainer: {
      paddingVertical: SPACING.xl * 3,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: COLORS.text,
      marginTop: SPACING.md,
    },
    emptySubtext: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginTop: SPACING.xs,
      textAlign: 'center',
      paddingHorizontal: SPACING.xl,
    },
    fab: {
      position: 'absolute',
      right: SPACING.lg,
      bottom: SPACING.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading posts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={() => { if (hasMore && !loadingMore) loadMorePosts(); }}
        onEndReachedThreshold={0.5}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Create Post Button (Owner Only) */}
      {isOwner && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={28} color={COLORS.surface} />
        </TouchableOpacity>
      )}

      {/* Modals */}
      <CreatePostModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreatePost}
        guildId={guildId}
      />

      <CommentsModal
        visible={showCommentsModal}
        onClose={() => {
          setShowCommentsModal(false);
          setSelectedPost(null);
        }}
        post={selectedPost}
        onAddComment={handleAddComment}
        guildId={guildId}
      />
    </View>
  );
};

export default PostsScreen;