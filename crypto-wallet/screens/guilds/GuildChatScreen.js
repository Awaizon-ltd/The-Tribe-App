import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING } from '../../constants/Theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useGuildChat } from '../../hooks/useGuildChat';
import ChatMessagesList from '../../components/guild/ChatMassageList';
import ChatInput from '../../components/guild/ChatInput';
import AdminControlsModal from '../../components/guild/AdminControlsModal';
import ChatLockedBanner from '../../components/guild/ChatLockedBanner';
import PinnedMessagesBanner from '../../components/guild/PinnedMessageBanner';
import Alert from '../../utils/Alert';

const GuildChatScreen = ({
  route,
  navigation,
  guildId:          _guildId,
  membershipStatus: _memberStatus,
  members:          _members,
  logo:             _logo,
  name:             _name,
  onPress,
}) => {
  const p = route?.params ?? {};
  const guildId          = _guildId      ?? p.guildId;
  const membershipStatus = _memberStatus ?? p.membershipStatus;
  const members          = _members      ?? p.members ?? [];
  const logo             = _logo         ?? p.logo;
  const name             = _name         ?? p.name;
  const { COLORS } = useTheme();
  const messagesListRef = useRef(null);
  const [logoError, setLogoError] = useState(false);
  
  const {
    messages,
    loading,
    loadingOlder,
    sending,
    hasMore,
    isAdmin,
    chatSettings,
    sendMessage,
    editMessage,
    deleteMessage,
    deleteAllUserMessages,
    banUser,
    pinMessage,
    unpinMessage,
    updateChatSettings,
    loadMoreMessages,
    retrySend,
  } = useGuildChat(guildId);

  const [showAdminControls, setShowAdminControls] = useState(false);

  // Get pinned messages
  const pinnedMessages = messages.filter(msg => msg.isPinned);

  const handleSend = async (text, replyTo = null) => {
    try {
      await sendMessage(text, replyTo);
    } catch (error) {
      Alert.alert(error.message || 'Failed to send message');
    }
  };

  const handleEdit = async (messageId, newText) => {
    try {
      await editMessage(messageId, newText);
    } catch (error) {
      Alert.alert(error.message || 'Failed to edit message');
    }
  };

  const handleDelete = async (messageId) => {
    try {
      await deleteMessage(messageId);
    } catch (error) {
      Alert.alert(error.message || 'Failed to delete message');
    }
  };

  const handleDeleteAllUserMessages = async (userId, username) => {
    try {
      await deleteAllUserMessages(userId, username);
    } catch (error) {
      Alert.alert(error.message || 'Failed to delete messages');
    }
  };

  const handleBanUser = async (userId, username) => {
    try {
      await banUser(userId, username);
    } catch (error) {
      Alert.alert(error.message || 'Failed to ban user');
    }
  };

  const handlePinMessage = async (messageId) => {
    try {
      await pinMessage(messageId);
    } catch (error) {
      Alert.alert(error.message || 'Failed to pin message');
    }
  };

  const handleUnpinMessage = async (messageId) => {
    try {
      await unpinMessage(messageId);
    } catch (error) {
      Alert.alert(error.message || 'Failed to unpin message');
    }
  };

  const handlePinnedMessagePress = (message) => {
    // Scroll to the pinned message in the list
    if (messagesListRef.current) {
      const messageIndex = messages.findIndex(m => m.id === message.id);
      if (messageIndex !== -1) {
        messagesListRef.current.scrollToIndex({
          index: messageIndex,
          animated: true,
          viewPosition: 0.5, // Center the message
        });
      }
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
      paddingTop:30
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      backgroundColor: COLORS.surface,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.divider,
    },
    backButton: {
      padding: SPACING.xs,
      marginRight: SPACING.sm,
    },
    headerCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    guildLogoContainer: {
      width: 36,
      height: 36,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: COLORS.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    guildLogo: {
      width: 36,
      height: 36,
    },
    guildLogoPlaceholder: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    guildLogoText: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.primary,
    },
    headerTextContainer: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: COLORS.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: COLORS.textSecondary,
      marginTop: 2,
    },
    settingsButton: {
      padding: SPACING.xs,
      marginLeft: SPACING.sm,
    },
    contentContainer: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  // Render guild logo or placeholder
  const renderGuildLogo = () => {
    if (logo && !logoError) {
      return (
        <View style={styles.guildLogoContainer}>
          <Image
            source={{ uri: logo }}
            style={styles.guildLogo}
            onError={() => setLogoError(true)}
          />
        </View>
      );
    }

    // Show placeholder with first letter of guild name
    return (
      <View style={[styles.guildLogoContainer, styles.guildLogoPlaceholder]}>
        <Text style={styles.guildLogoText}>
          {name ? name.charAt(0).toUpperCase() : 'G'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            {/* Guild Logo */}
            {renderGuildLogo()}

            {/* Guild Info */}
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.headerSubtitle}>
                {members?.length || 0} {members?.length === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </View>

          {isAdmin && (
            <TouchableOpacity
              onPress={() => setShowAdminControls(true)}
              style={styles.settingsButton}
            >
              <Ionicons name="settings-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Pinned Messages Banner */}
        <PinnedMessagesBanner
          pinnedMessages={pinnedMessages}
          onPressMessage={handlePinnedMessagePress}
          onUnpin={handleUnpinMessage}
          isAdmin={isAdmin}
        />

        {/* Chat Locked Banner */}
        {chatSettings?.isLocked && <ChatLockedBanner />}

        {/* Messages List Container */}
        <View style={styles.contentContainer}>
          {loading && messages.length === 0 ? (
            // Only shown on very first open with an empty cache
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <ChatMessagesList
              ref={messagesListRef}
              messages={messages}
              isAdmin={isAdmin}
              hasMore={hasMore}
              loading={loadingOlder}
              onLoadMore={loadMoreMessages}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDeleteAllUserMessages={handleDeleteAllUserMessages}
              onBanUser={handleBanUser}
              onPin={handlePinMessage}
              onUnpin={handleUnpinMessage}
              onRetry={retrySend}
            />
          )}
        </View>

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          sending={sending}
          disabled={chatSettings?.isLocked && !isAdmin}
          messageDelay={chatSettings?.messageDelay}
        />
      </KeyboardAvoidingView>

      {/* Admin Controls Modal */}
      {isAdmin && (
        <AdminControlsModal
          visible={showAdminControls}
          onClose={() => setShowAdminControls(false)}
          chatSettings={chatSettings}
          onUpdateSettings={updateChatSettings}
        />
      )}
    </View>
  );
};

export default GuildChatScreen;