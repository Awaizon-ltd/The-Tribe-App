import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../services/TribeApiService';
import { formatTimeAgo, getEntityTimestamp } from '../../utils/helpers';

const CommentItem = ({ comment, theme }) => {
  const styles = createStyles(theme);
  const [imageError, setImageError] = useState(false);

  return (
    <View style={styles.commentItem}>
      {/* User Avatar - Shows individual profile picture */}
      {comment.userAvatar && !imageError ? (
        <Image 
          source={{ uri: comment.userAvatar }} 
          style={styles.commentAvatar}
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={[styles.commentAvatar, styles.commentAvatarPlaceholder]}>
          <Text style={styles.commentAvatarText}>
            {comment.username?.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>{comment.username}</Text>
          <Text style={styles.commentTime}>{formatTimeAgo(getEntityTimestamp(comment))}</Text>
        </View>
        {/* API returns `.text` (see tribeMongoService.getComments) — was
            reading `.commentText`, a field that doesn't exist, so every
            comment body silently rendered blank here. */}
        <Text style={styles.commentText}>{comment.text}</Text>
      </View>
    </View>
  );
};

// The API's `.timestamp`/`.createdAt` pass through untouched — CommentItem
// resolves the real one via getEntityTimestamp(), so this no longer needs
// to (mis)handle time itself. It previously tried to detect a Firestore-
// style object timestamp (`typeof c.createdAt === 'object'`) that never
// matches what this API actually returns (a plain ISO string), so that
// branch was silently dead and createdAt passed through as an unparsed
// string — same bug family as the one CommentItem itself had.
const normaliseComment = (c) => ({ ...c });

const CommentsModal = ({ visible, onClose, post, onAddComment, tribeId }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !post || !tribeId) return;
    let cancelled = false;

    const loadComments = async () => {
      setLoading(true);
      try {
        const data = await api.getComments(tribeId, post.id, 50, 0);
        if (!cancelled) {
          setComments((data || []).map(normaliseComment));
        }
      } catch (error) {
        console.error('Error loading comments:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadComments();
    return () => { cancelled = true; };
  }, [visible, post?.id, tribeId]);

  const handleSubmit = async () => {
    const text = commentText.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    try {
      const saved = await onAddComment(post.id, text);
      setCommentText('');
      Keyboard.dismiss();
      // Optimistically append so the user sees their comment immediately
      const optimistic = normaliseComment(
        saved ?? { id: `tmp-${Date.now()}`, username: '', userAvatar: null, text, createdAt: Date.now() }
      );
      setComments(prev => [...prev, optimistic]);
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setCommentText('');
    setComments([]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={28} color={theme.COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Comments ({post?.commentsCount || 0})
          </Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Post Preview - Shows Tribe Info */}
        <View style={styles.postPreview}>
          <View style={styles.postPreviewHeader}>
            {post?.tribeLogo ? (
              <Image 
                source={{ uri: post.tribeLogo }} 
                style={styles.postTribeLogo}
              />
            ) : (
              <View style={[styles.postTribeLogo, styles.postTribeLogoPlaceholder]}>
                <Text style={styles.postTribeLogoText}>
                  {post?.tribeName?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.postTribeName}>{post?.tribeName || 'Tribe'}</Text>
          </View>
          <Text style={styles.postDescription} numberOfLines={2}>
            {post?.description}
          </Text>
        </View>

        {/* Comments List with keyboard dismissal */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.COLORS.primary} />
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-outline" size={48} color={theme.COLORS.textSecondary} />
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptySubtext}>Be the first to comment!</Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <CommentItem comment={item} theme={theme} />}
                contentContainerStyle={styles.commentsList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </View>
        </TouchableWithoutFeedback>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor={theme.COLORS.textSecondary}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={300}
            editable={!submitting}
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
            blurOnSubmit={true}
          />
          <TouchableOpacity
            style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
            onPress={handleSubmit}
            disabled={!commentText.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={theme.COLORS.surface} />
            ) : (
              <Ionicons name="send" size={20} color={theme.COLORS.surface} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop:30,
      justifyContent: 'space-between',
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.divider,
      backgroundColor: theme.COLORS.surface,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.COLORS.text,
    },
    postPreview: {
      padding: theme.SPACING.md,
      backgroundColor: theme.COLORS.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.divider,
    },
    postPreviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.SPACING.xs,
    },
    postTribeLogo: {
      width: 24,
      height: 24,
      borderRadius: 12,
      marginRight: theme.SPACING.xs,
    },
    postTribeLogoPlaceholder: {
      backgroundColor: theme.COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    postTribeLogoText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.COLORS.surface,
    },
    postTribeName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.COLORS.text,
    },
    postDescription: {
      fontSize: 14,
      color: theme.COLORS.textSecondary,
      lineHeight: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.SPACING.xl,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.COLORS.text,
      marginTop: theme.SPACING.md,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.COLORS.textSecondary,
      marginTop: theme.SPACING.xs,
    },
    commentsList: {
      paddingVertical: theme.SPACING.sm,
    },
    commentItem: {
      flexDirection: 'row',
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
    },
    commentAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginRight: theme.SPACING.sm,
    },
    commentAvatarPlaceholder: {
      backgroundColor: theme.COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    commentAvatarText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.COLORS.surface,
    },
    commentContent: {
      flex: 1,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    commentUsername: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.COLORS.text,
      marginRight: theme.SPACING.xs,
    },
    commentTime: {
      fontSize: 12,
      color: theme.COLORS.textSecondary,
    },
    commentText: {
      fontSize: 14,
      color: theme.COLORS.text,
      lineHeight: 20,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: theme.COLORS.divider,
      gap: theme.SPACING.sm,
      backgroundColor: theme.COLORS.surface,
    },
    input: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
      borderRadius: theme.BORDER_RADIUS.lg,
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      fontSize: 14,
      color: theme.COLORS.text,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
  });

export default CommentsModal;