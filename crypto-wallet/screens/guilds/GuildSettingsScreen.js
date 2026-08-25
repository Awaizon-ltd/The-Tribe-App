import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, BORDER_RADIUS } from '../../constants/Theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGuildSettings } from '../../hooks/useGuildSetting';
import { AddModeratorModal, ExternalLinksManager, InviteLinksManager, ModeratorsList } from '../../components/guild/GuildSettingComponents';
import LinkDAOModal from '../../components/guild/LinkDAOModal';
import api from '../../services/GuildApiService';
import Alert from '../../utils/Alert';

const GuildSettingsScreen = ({ route, navigation }) => {
  const { guild } = route.params;
  const { user } = useAuth();
  const { COLORS } = useTheme(); // Add this to get dynamic colors
  
  const {
    moderators,
    inviteLinks,
    externalLinks,
    loading,
    addModerator,
    removeModerator,
    updateModeratorPermissions,
    createInviteLink,
    deactivateInviteLink,
    updateExternalLinks,
    updateGuildName,
  } = useGuildSettings(guild.id);

  const [showAddModerator, setShowAddModerator] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newGuildName, setNewGuildName] = useState(guild.name);
  const [savingName, setSavingName] = useState(false);

  // Linked DAO state — seed from guild prop, can be updated locally
  const [linkedDaoAddress, setLinkedDaoAddress] = useState(
    guild.linkedDaoAddress || guild.linked_dao_address || null,
  );
  const [linkedDaoChainId, setLinkedDaoChainId] = useState(
    guild.linkedDaoChainId || guild.linked_dao_chain_id || null,
  );
  const [linkedDaoName, setLinkedDaoName]         = useState(null);
  const [showLinkModal, setShowLinkModal]         = useState(false);
  const [unlinkLoading, setUnlinkLoading]         = useState(false);

  // Check if current user is owner
  const isOwner = guild.created_by === user?.uid || guild.createdBy === user?.uid;

  useEffect(() => {
    if (!isOwner) {
      Alert.alert('Access Denied', 'Only the guild owner can access settings');
      navigation.goBack();
    }
  }, [isOwner]);

  const handleSaveGuildName = async () => {
    if (!newGuildName.trim() || newGuildName === guild.name) {
      setEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      await updateGuildName(newGuildName.trim());
      Alert.alert('Success', 'Guild name updated successfully');
      setEditingName(false);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update guild name');
    } finally {
      setSavingName(false);
    }
  };

  const handleAddModerator = async (memberUid, roleName, permissions) => {
    try {
      await addModerator(memberUid, roleName, permissions);
      setShowAddModerator(false);
      Alert.alert('Success', 'Moderator added successfully');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to add moderator');
    }
  };

  const handleRemoveModerator = async (moderatorUid, username) => {
    Alert.alert(
      'Remove Moderator',
      `Remove ${username} as moderator?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeModerator(moderatorUid);
              Alert.alert('Success', 'Moderator removed');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove moderator');
            }
          },
        },
      ]
    );
  };

  const handleUpdatePermissions = async (moderatorUid, permissions) => {
    try {
      await updateModeratorPermissions(moderatorUid, permissions);
      Alert.alert('Success', 'Permissions updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update permissions');
    }
  };

  // ── DAO link handlers ────────────────────────────────────────────────────────
  const handleLinkDAO = async (daoAddress, chainId, daoName) => {
    try {
      const updated = await api.linkDao(guild.id, daoAddress, chainId);
      const g = updated?.data || updated;
      setLinkedDaoAddress(g?.linkedDaoAddress || daoAddress);
      setLinkedDaoChainId(g?.linkedDaoChainId || chainId);
      setLinkedDaoName(daoName);
      Alert.alert('DAO Linked', `${daoName} is now linked to this guild. A Governance tab will appear for all members.`);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || e.message || 'Failed to link DAO');
      throw e;
    }
  };

  const handleUnlinkDAO = () => {
    Alert.alert(
      'Unlink DAO',
      'This will remove the Governance tab from your guild. Members will no longer see DAO proposals here.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            setUnlinkLoading(true);
            try {
              await api.unlinkDao(guild.id);
              setLinkedDaoAddress(null);
              setLinkedDaoChainId(null);
              setLinkedDaoName(null);
              Alert.alert('DAO Unlinked', 'The Governance tab has been removed from your guild.');
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.error || e.message || 'Failed to unlink DAO');
            } finally {
              setUnlinkLoading(false);
            }
          },
        },
      ],
    );
  };

  // Move styles inside component to access dynamic COLORS
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: COLORS.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      backgroundColor: COLORS.surface,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.divider,
    },
    backButton: {
      padding: SPACING.xs,
      width: 40,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: COLORS.text,
    },
    section: {
      marginTop: SPACING.lg,
      paddingHorizontal: SPACING.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.text,
      marginLeft: SPACING.sm,
      flex: 1,
    },
    addButton: {
      padding: SPACING.xs,
    },
    editNameContainer: {
      backgroundColor: COLORS.surface,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
    },
    nameInput: {
      backgroundColor: COLORS.background,
      borderWidth: 1,
      borderColor: COLORS.divider,
      borderRadius: BORDER_RADIUS.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontSize: 16,
      color: COLORS.text,
      marginBottom: SPACING.md,
    },
    editNameButtons: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    editButton: {
      flex: 1,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.divider,
    },
    cancelButtonText: {
      color: COLORS.text,
      fontSize: 14,
      fontWeight: '600',
    },
    saveButton: {
      backgroundColor: COLORS.primary,
    },
    saveButtonText: {
      color: COLORS.surface,
      fontSize: 14,
      fontWeight: '600',
    },
    nameDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: COLORS.surface,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
    },
    guildName: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.text,
    },

    // Linked DAO styles
    daoLinkedCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: SPACING.md, borderRadius: BORDER_RADIUS.md,
      borderWidth: 1.5,
    },
    daoLinkedIcon: {
      width: 48, height: 48, borderRadius: 24,
      justifyContent: 'center', alignItems: 'center',
    },
    daoLinkedInfo:   { flex: 1 },
    daoLinkedName:   { fontSize: 15, fontWeight: '600', marginBottom: 2 },
    daoLinkedAddr:   { fontSize: 11, fontFamily: 'monospace', marginBottom: 6 },
    daoLinkedBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    daoLinkedBadgeText: { fontSize: 11, fontWeight: '500' },
    unlinkBtn:       { padding: 8 },

    linkDaoBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    },
    linkDaoIconWrap: {
      width: 44, height: 44, borderRadius: 22,
      justifyContent: 'center', alignItems: 'center',
    },
    linkDaoBtnText:  { flex: 1 },
    linkDaoBtnTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
    linkDaoBtnSub:   { fontSize: 12 },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Guild Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Guild Name Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Guild Name</Text>
          </View>
          
          {editingName ? (
            <View style={styles.editNameContainer}>
              <TextInput
                style={styles.nameInput}
                value={newGuildName}
                onChangeText={setNewGuildName}
                placeholder="Enter guild name"
                placeholderTextColor={COLORS.textSecondary}
                maxLength={50}
              />
              <View style={styles.editNameButtons}>
                <TouchableOpacity
                  style={[styles.editButton, styles.cancelButton]}
                  onPress={() => {
                    setNewGuildName(guild.name);
                    setEditingName(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editButton, styles.saveButton]}
                  onPress={handleSaveGuildName}
                  disabled={savingName}
                >
                  {savingName ? (
                    <ActivityIndicator size="small" color={COLORS.surface} />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.nameDisplay}
              onPress={() => setEditingName(true)}
            >
              <Text style={styles.guildName}>{guild.name}</Text>
              <Ionicons name="pencil" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Moderators Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Moderators</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModerator(true)}
            >
              <Ionicons name="add-circle" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          
          <ModeratorsList
            moderators={moderators}
            onRemove={handleRemoveModerator}
            onUpdatePermissions={handleUpdatePermissions}
          />
        </View>

        {/* Invite Links Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="link" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Invite Links</Text>
          </View>
          
          <InviteLinksManager
            inviteLinks={inviteLinks}
            guildId={guild.id}
            onCreateLink={createInviteLink}
            onDeactivateLink={deactivateInviteLink}
          />
        </View>

        {/* External Links Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="globe" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>External Links</Text>
          </View>

          <ExternalLinksManager
            links={externalLinks}
            onSave={updateExternalLinks}
          />
        </View>

        {/* ── Linked DAO Section ──────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-half-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Linked DAO</Text>
          </View>

          {linkedDaoAddress ? (
            /* Current linked DAO card */
            <View style={[styles.daoLinkedCard, { backgroundColor: COLORS.surface, borderColor: COLORS.primary + '40' }]}>
              <View style={[styles.daoLinkedIcon, { backgroundColor: COLORS.primary + '15' }]}>
                <Ionicons name="shield-checkmark" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.daoLinkedInfo}>
                <Text style={[styles.daoLinkedName, { color: COLORS.text }]}>
                  {linkedDaoName || 'Linked DAO'}
                </Text>
                <Text style={[styles.daoLinkedAddr, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {linkedDaoAddress}
                </Text>
                <View style={[styles.daoLinkedBadge, { backgroundColor: COLORS.primary + '15' }]}>
                  <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
                  <Text style={[styles.daoLinkedBadgeText, { color: COLORS.primary }]}>
                    Governance tab active for members
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.unlinkBtn}
                onPress={handleUnlinkDAO}
                disabled={unlinkLoading}
              >
                {unlinkLoading
                  ? <ActivityIndicator size="small" color={COLORS.error || '#EF4444'} />
                  : <Ionicons name="unlink-outline" size={22} color={COLORS.error || '#EF4444'} />
                }
              </TouchableOpacity>
            </View>
          ) : (
            /* No DAO linked yet */
            <TouchableOpacity
              style={[styles.linkDaoBtn, { backgroundColor: COLORS.surface, borderColor: COLORS.divider }]}
              onPress={() => setShowLinkModal(true)}
              activeOpacity={0.75}
            >
              <View style={[styles.linkDaoIconWrap, { backgroundColor: COLORS.primary + '15' }]}>
                <Ionicons name="link-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.linkDaoBtnText}>
                <Text style={[styles.linkDaoBtnTitle, { color: COLORS.text }]}>Link a DAO</Text>
                <Text style={[styles.linkDaoBtnSub, { color: COLORS.textSecondary }]}>
                  Add a Governance tab to let members vote on proposals
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Moderator Modal */}
      <AddModeratorModal
        visible={showAddModerator}
        onClose={() => setShowAddModerator(false)}
        guildId={guild.id}
        existingModerators={moderators}
        onAdd={handleAddModerator}
      />

      {/* Link DAO Modal */}
      <LinkDAOModal
        visible={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onLink={handleLinkDAO}
        currentLinkedAddress={linkedDaoAddress}
        currentLinkedChainId={linkedDaoChainId}
      />
    </View>
  );
};

export default GuildSettingsScreen;