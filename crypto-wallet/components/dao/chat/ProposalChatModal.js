// components/dao/chat/ProposalChatModal.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../../../contexts/WalletContext';
import { useTheme } from '../../../contexts/ThemeContext'; // Adjust path as needed
import * as FirebaseChatService from '../../../services/ProposalChat';
import * as ChatDB from '../../../utils/ProposalChatDatabase';
import { ChatAuthModal } from './ChatAuthModal';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import Alert from '../../../utils/Alert';

export const ProposalChatModal = ({ 
  visible, 
  onClose, 
  proposal,
  daoAddress, 
  chainId,
  isLocked,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { address, createSignerForTransaction } = useWallet();
  const flatListRef = useRef(null);
  const unsubscribeRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authSignature, setAuthSignature] = useState(null);
  const [authMessage, setAuthMessage] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    if (visible && address) {
      checkAuthentication();
    }
  }, [visible, address]);

  // Load messages
  useEffect(() => {
    if (visible && isAuthenticated) {
      loadMessages();
      subscribeToNewMessages();
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [visible, isAuthenticated]);

  const checkAuthentication = async () => {
    try {
      const auth = await ChatDB.getAuth(daoAddress, chainId, proposal.id, address);
      
      if (auth) {
        setAuthSignature(auth.signature);
        setAuthMessage(auth.message);
        setIsAuthenticated(true);
      } else {
        setAuthModalVisible(true);
      }
    } catch (error) {
      console.error('[Chat] ❌ Auth check failed:', error);
      setAuthModalVisible(true);
    }
  };

  const handleAuthenticate = async () => {
    try {
      // Create auth message
      const authData = FirebaseChatService.createAuthMessage(
        daoAddress,
        chainId,
        proposal.id,
        address
      );

      // Request PIN
      Alert.prompt(
        'Enter Passcode',
        'Enter your 6-digit passcode to sign',
        async (passcode) => {
          try {
            const signer = await createSignerForTransaction(passcode);
            const signature = await signer.signMessage(authData.message);

            // Save authentication
            await ChatDB.saveAuth(
              daoAddress,
              chainId,
              proposal.id,
              address,
              signature,
              authData.message,
              authData.expiresAt
            );

            setAuthSignature(signature);
            setAuthMessage(authData.message);
            setIsAuthenticated(true);
            setAuthModalVisible(false);

            // Load messages after auth
            loadMessages();
            subscribeToNewMessages();
          } catch (err) {
            throw new Error('Failed to sign message. Please check your passcode.');
          }
        },
        'secure-text'
      );
    } catch (error) {
      throw error;
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);

      // Load from cache first
      const cached = await ChatDB.getCachedMessages(daoAddress, chainId, proposal.id, 50);
      if (cached.length > 0) {
        setMessages(cached);
      }

      // Fetch from Firebase
      const syncState = await ChatDB.getSyncState(daoAddress, chainId, proposal.id);
      const lastSync = syncState?.lastSyncTimestamp || 0;

      const newMessages = await FirebaseChatService.fetchMessages(
        daoAddress,
        chainId,
        proposal.id,
        50,
        lastSync
      );

      if (newMessages.length > 0) {
        // Cache new messages
        await ChatDB.cacheMessages(daoAddress, chainId, proposal.id, newMessages);
        
        // Update sync state
        const latestTimestamp = Math.max(...newMessages.map(m => m.timestamp));
        await ChatDB.updateSyncState(daoAddress, chainId, proposal.id, latestTimestamp, newMessages.length);

        // Merge with existing
        setMessages(prev => {
          const merged = [...prev, ...newMessages];
          // Remove duplicates
          const unique = merged.filter((msg, index, self) =>
            index === self.findIndex(m => m.id === msg.id)
          );
          return unique.sort((a, b) => a.timestamp - b.timestamp);
        });
      }
    } catch (error) {
      console.error('[Chat] ❌ Load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNewMessages = () => {
    const lastTimestamp = messages.length > 0 
      ? messages[messages.length - 1].timestamp 
      : 0;

    unsubscribeRef.current = FirebaseChatService.subscribeToMessages(
      daoAddress,
      chainId,
      proposal.id,
      async (newMessages) => {
        if (newMessages.length > 0) {
          // Cache immediately
          await ChatDB.cacheMessages(daoAddress, chainId, proposal.id, newMessages);
          
          setMessages(prev => {
            const merged = [...prev, ...newMessages];
            const unique = merged.filter((msg, index, self) =>
              index === self.findIndex(m => m.id === msg.id)
            );
            return unique.sort((a, b) => a.timestamp - b.timestamp);
          });

          // Scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      },
      lastTimestamp
    );
  };

  const handleSendMessage = async (messageText) => {
    if (!isAuthenticated || !authSignature) {
      setAuthModalVisible(true);
      return;
    }

    try {
      setSending(true);

      const messageData = {
        sender: address,
        senderName: null, // Could get from user profile
        senderAvatar: null,
        message: messageText,
      };

      const sentMessage = await FirebaseChatService.sendMessage(
        daoAddress,
        chainId,
        proposal.id,
        messageData,
        authSignature,
        authMessage
      );

      // Cache immediately
      await ChatDB.cacheMessages(daoAddress, chainId, proposal.id, [sentMessage]);

      // Optimistically add to UI
      setMessages(prev => [...prev, sentMessage]);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('[Chat] ❌ Send failed:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => (
    <ChatMessage
      message={item}
      isOwnMessage={item.sender.toLowerCase() === address?.toLowerCase()}
      userAddress={address}
    />
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.COLORS.primary} />
          <Text style={styles.emptyText}>Loading messages...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={64} color={theme.COLORS.textSecondary} />
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptySubtext}>Be the first to start the discussion!</Text>
      </View>
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.COLORS.text} />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>Proposal Discussion</Text>
              <Text style={styles.headerSubtitle}>Proposal #{proposal.id}</Text>
            </View>
            <View style={styles.headerRight}>
              {isLocked && (
                <Ionicons name="lock-closed" size={20} color={theme.COLORS.warning} />
              )}
            </View>
          </View>

          {/* Lock Notice */}
          {isLocked && (
            <View style={styles.lockNotice}>
              <Ionicons name="information-circle" size={18} color={theme.COLORS.warning} />
              <Text style={styles.lockNoticeText}>
                Discussion locked. Voting has ended and proposal is finalized.
              </Text>
            </View>
          )}

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            ListEmptyComponent={renderEmpty}
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
          />

          {/* Input */}
          {isAuthenticated && (
            <ChatInput
              onSend={handleSendMessage}
              isLocked={isLocked}
              sending={sending}
            />
          )}
        </View>
      </Modal>

      {/* Auth Modal */}
      <ChatAuthModal
        visible={authModalVisible}
        onClose={() => {
          setAuthModalVisible(false);
          onClose();
        }}
        onAuthenticate={handleAuthenticate}
        userAddress={address}
        proposalId={proposal.id}
      />
    </>
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
      paddingHorizontal: theme.SPACING.lg,
      paddingVertical: theme.SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.border,
      backgroundColor: theme.COLORS.surface,
    },
    backButton: {
      padding: theme.SPACING.sm,
      marginRight: theme.SPACING.sm,
    },
    headerInfo: {
      flex: 1,
    },
    headerTitle: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: 'bold',
      color: theme.COLORS.text,
    },
    headerSubtitle: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
    },
    headerRight: {
      padding: theme.SPACING.sm,
    },
    lockNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.sm,
      padding: theme.SPACING.md,
      backgroundColor: theme.COLORS.warning + '20',
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.warning + '40',
    },
    lockNoticeText: {
      flex: 1,
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
    },
    messagesList: {
      padding: theme.SPACING.md,
      flexGrow: 1,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.SPACING.xxl * 2,
    },
    emptyText: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginTop: theme.SPACING.md,
    },
    emptySubtext: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      marginTop: theme.SPACING.xs,
    },
  });