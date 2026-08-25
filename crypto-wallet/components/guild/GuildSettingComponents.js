// ============ ModeratorsList.jsx ============
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Switch, 
  Share, 
  Modal, 
  FlatList,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMembers } from '../../services/GuildApiService';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../contexts/ThemeContext';
import Alert from '../../utils/Alert';

export const ModeratorsList = ({ moderators, onRemove, onUpdatePermissions }) => {
  const [expandedId, setExpandedId] = useState(null);
  const theme = useTheme();
  const styles = createStyles(theme);

  if (moderators.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="shield-outline" size={48} color={theme.COLORS.textSecondary} />
        <Text style={styles.emptyText}>No moderators yet</Text>
        <Text style={styles.emptySubtext}>Add moderators to help manage your guild</Text>
      </View>
    );
  }

  return (
    <View>
      {moderators.map((moderator) => (
        <View key={moderator.userUid} style={styles.moderatorCard}>
          <TouchableOpacity
            style={styles.moderatorHeader}
            onPress={() => setExpandedId(expandedId === moderator.userUid ? null : moderator.userUid)}
          >
            {moderator.userAvatar ? (
              <Image source={{ uri: moderator.userAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {moderator.username?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            
            <View style={styles.moderatorInfo}>
              <Text style={styles.moderatorName}>{moderator.username}</Text>
              <Text style={styles.roleName}>{moderator.roleName}</Text>
            </View>

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onRemove(moderator.userUid, moderator.username)}
            >
              <Ionicons name="close-circle" size={24} color={theme.COLORS.error} />
            </TouchableOpacity>
          </TouchableOpacity>

          {expandedId === moderator.userUid && (
            <View style={styles.permissionsContainer}>
              <PermissionToggle
                label="Lock Chat"
                value={moderator.permissions.canLockChat}
                onChange={(value) => onUpdatePermissions(moderator.userUid, {
                  ...moderator.permissions,
                  canLockChat: value,
                })}
                theme={theme}
              />
              <PermissionToggle
                label="Delete Messages"
                value={moderator.permissions.canDeleteMessages}
                onChange={(value) => onUpdatePermissions(moderator.userUid, {
                  ...moderator.permissions,
                  canDeleteMessages: value,
                })}
                theme={theme}
              />
              <PermissionToggle
                label="Pin Messages"
                value={moderator.permissions.canPinMessages}
                onChange={(value) => onUpdatePermissions(moderator.userUid, {
                  ...moderator.permissions,
                  canPinMessages: value,
                })}
                theme={theme}
              />
              <PermissionToggle
                label="Ban Members"
                value={moderator.permissions.canBanMembers}
                onChange={(value) => onUpdatePermissions(moderator.userUid, {
                  ...moderator.permissions,
                  canBanMembers: value,
                })}
                theme={theme}
              />
              <PermissionToggle
                label="Manage Members"
                value={moderator.permissions.canManageMembers}
                onChange={(value) => onUpdatePermissions(moderator.userUid, {
                  ...moderator.permissions,
                  canManageMembers: value,
                })}
                theme={theme}
              />
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

const PermissionToggle = ({ label, value, onChange, theme }) => {
  const styles = createStyles(theme);
  
  return (
    <View style={styles.permissionRow}>
      <Text style={styles.permissionLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.COLORS.divider, true: theme.COLORS.primary }}
        thumbColor={theme.COLORS.surface}
      />
    </View>
  );
};

// ============ InviteLinksManager.jsx ============
export const InviteLinksManager = ({ inviteLinks, guildId, onCreateLink, onDeactivateLink }) => {
  const [creating, setCreating] = useState(false);
  const theme = useTheme();
  const styles = createStyles(theme);

  const handleCreateLink = async () => {
    setCreating(true);
    try {
      const code = await onCreateLink();
      const inviteUrl = `https://sysfidao.com/invite/${code}`;
      Alert.alert('Invite Link Created', inviteUrl, [
        { text: 'Copy', onPress: () => Clipboard.setStringAsync(inviteUrl) },
        { text: 'Share', onPress: () => Share.share({ message: inviteUrl }) },
        { text: 'OK' },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to create invite link');
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = async (code) => {
    const inviteUrl = `https://sysfidao.com/invite/${code}`;
    await Clipboard.setStringAsync(inviteUrl);
    Alert.alert('Copied', 'Invite link copied to clipboard');
  };

  const shareLink = async (code) => {
    const inviteUrl = `https://sysfidao.com/invite/${code}`;
    await Share.share({ message: `Join our guild: ${inviteUrl}` });
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.createButton}
        onPress={handleCreateLink}
        disabled={creating}
      >
        <Ionicons name="add-circle-outline" size={20} color={theme.COLORS.primary} />
        <Text style={styles.createButtonText}>Create New Invite Link</Text>
      </TouchableOpacity>

      {inviteLinks.map((invite) => (
        <View key={invite.id} style={styles.inviteCard}>
          <View style={styles.inviteHeader}>
            <Text style={styles.inviteCode}>{invite.code}</Text>
            <View style={styles.inviteActions}>
              <TouchableOpacity onPress={() => copyToClipboard(invite.code)}>
                <Ionicons name="copy-outline" size={20} color={theme.COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => shareLink(invite.code)} style={{ marginLeft: 12 }}>
                <Ionicons name="share-outline" size={20} color={theme.COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDeactivateLink(invite.id)}
                style={{ marginLeft: 12 }}
              >
                <Ionicons name="trash-outline" size={20} color={theme.COLORS.error} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.inviteStats}>Uses: {invite.uses}{invite.maxUses ? ` / ${invite.maxUses}` : ''}</Text>
        </View>
      ))}

      {inviteLinks.length === 0 && (
        <Text style={styles.noInvitesText}>No active invite links</Text>
      )}
    </View>
  );
};

// ============ ExternalLinksManager.jsx ============
export const ExternalLinksManager = ({ links, onSave }) => {
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [discord, setDiscord] = useState('');
  const [telegram, setTelegram] = useState('');
  const [saving, setSaving] = useState(false);
  const theme = useTheme();
  const styles = createStyles(theme);

  useEffect(() => {
    if (links) {
      setWebsite(links.website || '');
      setTwitter(links.twitter || '');
      setDiscord(links.discord || '');
      setTelegram(links.telegram || '');
    }
  }, [links]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ website, twitter, discord, telegram });
      Alert.alert('Success', 'External links updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update links');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <LinkInput
        icon="globe-outline"
        label="Website"
        value={website}
        onChangeText={setWebsite}
        placeholder="https://example.com"
        theme={theme}
      />
      <LinkInput
        icon="logo-twitter"
        label="Twitter"
        value={twitter}
        onChangeText={setTwitter}
        placeholder="https://twitter.com/username"
        theme={theme}
      />
      <LinkInput
        icon="logo-discord"
        label="Discord"
        value={discord}
        onChangeText={setDiscord}
        placeholder="https://discord.gg/invite"
        theme={theme}
      />
      <LinkInput
        icon="paper-plane-outline"
        label="Telegram"
        value={telegram}
        onChangeText={setTelegram}
        placeholder="https://t.me/channel"
        theme={theme}
      />

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving...' : 'Save External Links'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const LinkInput = ({ icon, label, value, onChangeText, placeholder, theme }) => {
  const styles = createStyles(theme);
  
  return (
    <View style={styles.linkInputContainer}>
      <View style={styles.linkInputHeader}>
        <Ionicons name={icon} size={18} color={theme.COLORS.textSecondary} />
        <Text style={styles.linkInputLabel}>{label}</Text>
      </View>
      <TextInput
        style={styles.linkInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.COLORS.textSecondary}
        autoCapitalize="none"
        keyboardType="url"
      />
    </View>
  );
};

// ============ AddModeratorModal.jsx ============
export const AddModeratorModal = ({ visible, onClose, guildId, existingModerators, onAdd }) => {
  const [members, setMembers] = useState([]);
  const [roleName, setRoleName] = useState('Moderator');
  const [selectedMember, setSelectedMember] = useState(null);
  const [permissions, setPermissions] = useState({
    canLockChat: true,
    canDeleteMessages: true,
    canPinMessages: true,
    canBanMembers: false,
    canManageMembers: false,
  });
  const theme = useTheme();
  const styles = createStyles(theme);

  useEffect(() => {
    if (visible) {
      loadMembers();
    }
  }, [visible]);

  const loadMembers = async () => {
    try {
      const all = await getMembers(guildId);
      // Normalise to { id, username, userAvatar, status } and exclude existing mods
      const membersList = (all || [])
        .map(m => ({
          id:         m.user_id || m.id,
          username:   m.username,
          displayName: m.display_name || m.displayName,
          userAvatar: m.user_avatar  || m.userAvatar,
          status:     m.status,
        }))
        .filter(member =>
          !existingModerators.some(
            mod => (mod.user_id || mod.userUid) === member.id
          )
        );
      setMembers(membersList);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const handleAdd = () => {
    if (!selectedMember) {
      Alert.alert('Error', 'Please select a member');
      return;
    }
    if (!roleName.trim()) {
      Alert.alert('Error', 'Please enter a role name');
      return;
    }

    onAdd(selectedMember.id, roleName, permissions);
    resetForm();
  };

  const resetForm = () => {
    setSelectedMember(null);
    setRoleName('Moderator');
    setPermissions({
      canLockChat: true,
      canDeleteMessages: true,
      canPinMessages: true,
      canBanMembers: false,
      canManageMembers: false,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Moderator</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.COLORS.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Select Member</Text>
          <FlatList
            data={members}
            style={styles.membersList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.memberItem,
                  selectedMember?.id === item.id && styles.memberItemSelected,
                ]}
                onPress={() => setSelectedMember(item)}
              >
                <Text style={styles.memberName}>{item.username}</Text>
              </TouchableOpacity>
            )}
          />

          <Text style={styles.sectionLabel}>Role Name</Text>
          <TextInput
            style={styles.input}
            value={roleName}
            onChangeText={setRoleName}
            placeholder="e.g., Moderator, Admin, Helper"
            placeholderTextColor={theme.COLORS.textSecondary}
          />

          <Text style={styles.sectionLabel}>Permissions</Text>
          <View style={styles.permissionsGrid}>
            {Object.entries(permissions).map(([key, value]) => (
              <PermissionToggle
                key={key}
                label={key.replace(/^can/, '').replace(/([A-Z])/g, ' $1').trim()}
                value={value}
                onChange={(newValue) => setPermissions({ ...permissions, [key]: newValue })}
                theme={theme}
              />
            ))}
          </View>

          <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
            <Text style={styles.addButtonText}>Add Moderator</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ============ Shared Styles ============
const createStyles = (theme) =>
  StyleSheet.create({
    emptyState: {
      alignItems: 'center',
      paddingVertical: theme.SPACING.xl * 2,
    },
    emptyText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.text,
      marginTop: theme.SPACING.md,
    },
    emptySubtext: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      marginTop: theme.SPACING.xs,
    },
    moderatorCard: {
      backgroundColor: theme.COLORS.surface,
      borderRadius: theme.BORDER_RADIUS.md,
      marginBottom: theme.SPACING.md,
      overflow: 'hidden',
      ...theme.SHADOWS.small,
    },
    moderatorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.SPACING.md,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: theme.SPACING.md,
    },
    avatarPlaceholder: {
      backgroundColor: theme.COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: theme.COLORS.surface,
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
    },
    moderatorInfo: {
      flex: 1,
    },
    moderatorName: {
      fontSize: theme.FONTS.sizes.md - 1,
      fontWeight: '600',
      color: theme.COLORS.text,
    },
    roleName: {
      fontSize: theme.FONTS.sizes.sm - 1,
      color: theme.COLORS.primary,
      marginTop: 2,
    },
    removeButton: {
      padding: theme.SPACING.xs,
    },
    permissionsContainer: {
      borderTopWidth: 1,
      borderTopColor: theme.COLORS.divider,
      padding: theme.SPACING.md,
    },
    permissionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.SPACING.sm,
    },
    permissionLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.COLORS.surface,
      padding: theme.SPACING.md,
      borderRadius: theme.BORDER_RADIUS.md,
      marginBottom: theme.SPACING.md,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    createButtonText: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: '600',
      color: theme.COLORS.primary,
      marginLeft: theme.SPACING.sm,
    },
    inviteCard: {
      backgroundColor: theme.COLORS.surface,
      padding: theme.SPACING.md,
      borderRadius: theme.BORDER_RADIUS.md,
      marginBottom: theme.SPACING.sm,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    inviteHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    inviteCode: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.text,
      fontFamily: 'monospace',
    },
    inviteActions: {
      flexDirection: 'row',
    },
    inviteStats: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textSecondary,
      marginTop: theme.SPACING.xs,
    },
    noInvitesText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      textAlign: 'center',
      paddingVertical: theme.SPACING.lg,
    },
    linkInputContainer: {
      marginBottom: theme.SPACING.md,
    },
    linkInputHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.SPACING.xs,
    },
    linkInputLabel: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: '600',
      color: theme.COLORS.text,
      marginLeft: theme.SPACING.xs,
    },
    linkInput: {
      backgroundColor: theme.COLORS.surface,
      borderWidth: 1,
      borderColor: theme.COLORS.divider,
      borderRadius: theme.BORDER_RADIUS.sm,
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
    },
    saveButton: {
      backgroundColor: theme.COLORS.primary,
      padding: theme.SPACING.md,
      borderRadius: theme.BORDER_RADIUS.md,
      alignItems: 'center',
      marginTop: theme.SPACING.md,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.surface,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.COLORS.background,
      borderTopLeftRadius: theme.BORDER_RADIUS.lg,
      borderTopRightRadius: theme.BORDER_RADIUS.lg,
      paddingHorizontal: theme.SPACING.md,
      paddingBottom: theme.SPACING.xl,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.divider,
    },
    modalTitle: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: '600',
      color: theme.COLORS.text,
    },
    sectionLabel: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: '600',
      color: theme.COLORS.text,
      marginTop: theme.SPACING.md,
      marginBottom: theme.SPACING.xs,
    },
    membersList: {
      maxHeight: 150,
    },
    memberItem: {
      padding: theme.SPACING.md,
      backgroundColor: theme.COLORS.surface,
      borderRadius: theme.BORDER_RADIUS.sm,
      marginBottom: theme.SPACING.xs,
    },
    memberItemSelected: {
      backgroundColor: theme.COLORS.primary,
    },
    memberName: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
    },
    input: {
      backgroundColor: theme.COLORS.surface,
      borderWidth: 1,
      borderColor: theme.COLORS.divider,
      borderRadius: theme.BORDER_RADIUS.sm,
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
    },
    permissionsGrid: {
      marginTop: theme.SPACING.xs,
    },
    addButton: {
      backgroundColor: theme.COLORS.primary,
      padding: theme.SPACING.md,
      borderRadius: theme.BORDER_RADIUS.md,
      alignItems: 'center',
      marginTop: theme.SPACING.lg,
    },
    addButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.surface,
    },
  });

export default { ModeratorsList, InviteLinksManager, ExternalLinksManager, AddModeratorModal };