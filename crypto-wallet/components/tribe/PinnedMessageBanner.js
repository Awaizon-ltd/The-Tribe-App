import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

const PinnedMessagesBanner = ({ 
  pinnedMessages = [], 
  onPressMessage, 
  onUnpin,
  isAdmin 
}) => {
  const { COLORS, SPACING, BORDER_RADIUS } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!pinnedMessages || pinnedMessages.length === 0) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      backgroundColor: COLORS.primaryDark,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.divider,
    },
    singleMessageContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
    },
    multipleMessagesContainer: {
      paddingVertical: SPACING.sm,
       paddingHorizontal: SPACING.sm,
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: COLORS.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    contentContainer: {
      flex: 1,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginBottom: 2,
    },
    pinnedLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.primary,
      textTransform: 'uppercase',
    },
    countBadge: {
      backgroundColor: COLORS.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      minWidth: 20,
      alignItems: 'center',
    },
    countText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#1C1C1E',
    },
    messagePreview: {
      fontSize: 14,
      color: COLORS.text,
      numberOfLines: 2,
    },
    senderName: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: 2,
    },
    closeButton: {
      padding: SPACING.xs,
    },
    unpinButton: {
      padding: SPACING.xs,
      marginLeft: SPACING.xs,
    },
    expandButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.xs,
      gap: SPACING.xs,
    },
    expandText: {
      fontSize: 12,
      color: COLORS.primary,
      fontWeight: '600',
    },
    messagesList: {
      paddingHorizontal: SPACING.md,
    },
    messageItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: COLORS.divider + '40',
    },
    messageItemContent: {
      flex: 1,
    },
    divider: {
      height: 1,
      backgroundColor: COLORS.divider + '40',
      marginHorizontal: SPACING.md,
    },
  });

  // Single pinned message view
  if (pinnedMessages.length === 1) {
    const message = pinnedMessages[0];
    const displayName = message.displayName || message.username || 'Unknown User';

    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.singleMessageContainer}
          onPress={() => onPressMessage(message)}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="pin" size={16} color={COLORS.primary} />
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.pinnedLabel}>Pinned Message</Text>
            </View>
            <Text style={styles.senderName}>{displayName}</Text>
            <Text style={styles.messagePreview} numberOfLines={2}>
              {message.text}
            </Text>
          </View>

          {isAdmin && (
            <TouchableOpacity
              style={styles.unpinButton}
              onPress={() => onUnpin(message.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Multiple pinned messages view
  return (
    <View style={styles.container}>
      <View style={styles.multipleMessagesContainer}>
        {/* Header */}
        <TouchableOpacity 
          style={styles.singleMessageContainer}
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="pin" size={16} color={COLORS.primary} />
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.pinnedLabel}>Pinned Messages</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{pinnedMessages.length}</Text>
              </View>
            </View>
            <Text style={styles.messagePreview} numberOfLines={1}>
              Tap to view all pinned messages
            </Text>
          </View>

          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={COLORS.textSecondary} 
          />
        </TouchableOpacity>

        {/* Expanded list */}
        {isExpanded && (
          <ScrollView 
            style={{ maxHeight: 300 }}
            showsVerticalScrollIndicator={false}
          >
            {pinnedMessages.map((message, index) => {
              const displayName = message.displayName || message.username || 'Unknown User';
              
              return (
                <React.Fragment key={message.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <TouchableOpacity
                    style={styles.messageItem}
                    onPress={() => {
                      setIsExpanded(false);
                      onPressMessage(message);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.messageItemContent}>
                      <Text style={styles.senderName}>{displayName}</Text>
                      <Text style={styles.messagePreview} numberOfLines={3}>
                        {message.text}
                      </Text>
                    </View>

                    {isAdmin && (
                      <TouchableOpacity
                        style={styles.unpinButton}
                        onPress={() => onUnpin(message.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

export default PinnedMessagesBanner;