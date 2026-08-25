import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWallet } from '../../contexts/WalletContext';
import api from '../../services/GuildApiService';
import MiniAppWebView from '../../components/miniapps/MiniAppsWebView';
import Alert from '../../utils/Alert';

const GuildAppsScreen = ({ route, navigation }) => {
  const { guildId, guild, isOwner } = route.params;
  const { COLORS, SPACING, BORDER_RADIUS, FONTS } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { address } = useWallet();

  const [installed, setInstalled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeApp, setActiveApp] = useState(null);
  const [showInstallPicker, setShowInstallPicker] = useState(false);

  const loadInstalled = useCallback(() => {
    setLoading(true);
    api.getGuildMiniApps(guildId)
      .then((list) => setInstalled(list || []))
      .catch(() => setInstalled([]))
      .finally(() => setLoading(false));
  }, [guildId]);

  useEffect(() => { loadInstalled(); }, [loadInstalled]);

  const handleUninstall = useCallback((miniApp) => {
    Alert.alert(
      'Remove App',
      `Remove ${miniApp.name} from this guild?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.uninstallMiniApp(guildId, miniApp.id);
              setInstalled((prev) => prev.filter((a) => a.id !== miniApp.id));
            } catch {
              Alert.alert('Error', 'Failed to remove app');
            }
          },
        },
      ]
    );
  }, [guildId]);

  const styles = createStyles(COLORS, SPACING, BORDER_RADIUS, FONTS);

  // ── Full-screen mini-app view ─────────────────────────────────────────────
  if (activeApp) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: COLORS.background }}>
        <TouchableOpacity onPress={() => setActiveApp(null)} style={styles.closeBar}>
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
          <Text style={styles.closeText}>{activeApp.name}</Text>
        </TouchableOpacity>
        <MiniAppWebView
          miniApp={activeApp}
          guildId={guildId}
          grantedScopes={activeApp.requestedScopes || []}
          userProfile={{ username: user?.email?.split('@')[0], address }}
          onClose={() => setActiveApp(null)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Apps</Text>
        {isOwner ? (
          <TouchableOpacity onPress={() => setShowInstallPicker(true)}>
            <Ionicons name="add-circle-outline" size={26} color={COLORS.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 26 }} /> // keep title centered
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : installed.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="grid-outline" size={48} color={COLORS.textTertiary} />
          <Text style={styles.emptyText}>No apps installed</Text>
          {isOwner && (
            <Text style={styles.emptySubtext}>
              Tap + to browse and add mini-apps for this guild.
            </Text>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {installed.map((app) => (
            <View key={app.id} style={styles.appTile}>
              <TouchableOpacity onPress={() => setActiveApp(app)} activeOpacity={0.8}>
                <View style={styles.iconWrap}>
                  {app.icon ? (
                    <Image source={{ uri: app.icon }} style={styles.iconImage} />
                  ) : (
                    <Text style={styles.iconFallback}>{app.name?.charAt(0)}</Text>
                  )}
                </View>
                <Text style={styles.appName} numberOfLines={1}>{app.name}</Text>
              </TouchableOpacity>
              {isOwner && (
                <TouchableOpacity
                  style={styles.removeBadge}
                  onPress={() => handleUninstall(app)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {isOwner && (
        <InstallPickerModal
          visible={showInstallPicker}
          onClose={() => setShowInstallPicker(false)}
          guildId={guildId}
          installedIds={installed.map((a) => a.id)}
          onInstalled={() => { setShowInstallPicker(false); loadInstalled(); }}
        />
      )}
    </View>
  );
};

// ── Owner-only: browse global directory, install into this guild ─────────────
const InstallPickerModal = ({ visible, onClose, guildId, installedIds, onInstalled }) => {
  const { COLORS, SPACING, BORDER_RADIUS, FONTS } = useTheme();
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [installingId, setInstallingId] = useState(null);
  const styles = createStyles(COLORS, SPACING, BORDER_RADIUS, FONTS);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api.getMiniAppDirectory()
      .then((list) => setDirectory(list || []))
      .catch(() => setDirectory([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const handleInstall = async (app) => {
    setInstallingId(app.id);
    try {
      // Scopes shown here mirror what MiniAppWebView will actually grant —
      // this is the consent step, so the list must match requestedScopes exactly.
      await api.installMiniApp(guildId, app.id, app.requestedScopes || []);
      onInstalled();
    } catch {
      Alert.alert('Error', 'Failed to install app');
    } finally {
      setInstallingId(null);
    }
  };

  const available = directory.filter((app) => !installedIds.includes(app.id));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: 24 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add App</Text>
          <View style={{ width: 26 }} />
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : available.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No new apps available</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
            {available.map((app) => (
              <View key={app.id} style={styles.installRow}>
                <View style={styles.installRowLeft}>
                  <View style={styles.iconWrapSmall}>
                    {app.icon ? (
                      <Image source={{ uri: app.icon }} style={styles.iconImageSmall} />
                    ) : (
                      <Text style={styles.iconFallback}>{app.name?.charAt(0)}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.installName}>{app.name}</Text>
                    <Text style={styles.installScopes} numberOfLines={2}>
                      Requests: {(app.requestedScopes || []).join(', ')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.installButton}
                  onPress={() => handleInstall(app)}
                  disabled={installingId === app.id}
                >
                  {installingId === app.id ? (
                    <ActivityIndicator size="small" color={COLORS.onPrimary} />
                  ) : (
                    <Text style={styles.installButtonText}>Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const createStyles = (COLORS, SPACING, BORDER_RADIUS, FONTS) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
    },
    headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.text },
    closeBar: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: 4 },
    closeText: { color: COLORS.primary, fontWeight: '600', fontSize: FONTS.sizes.md },
    emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: SPACING.xl },
    emptyText: { color: COLORS.text, fontSize: FONTS.sizes.md, fontWeight: '600', marginTop: SPACING.sm },
    emptySubtext: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, textAlign: 'center', marginTop: SPACING.xs },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.md,
      padding: SPACING.md,
    },
    appTile: { width: 80, alignItems: 'center', position: 'relative' },
    iconWrap: {
      width: 60, height: 60, borderRadius: BORDER_RADIUS.lg,
      backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
      justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xs, overflow: 'hidden',
    },
    iconImage: { width: 60, height: 60 },
    iconFallback: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.onPrimaryLight },
    appName: { fontSize: FONTS.sizes.xs, color: COLORS.text, textAlign: 'center' },
    removeBadge: { position: 'absolute', top: -4, right: 10 },
    installRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
    },
    installRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: SPACING.sm },
    iconWrapSmall: {
      width: 44, height: 44, borderRadius: BORDER_RADIUS.md,
      backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    },
    iconImageSmall: { width: 44, height: 44 },
    installName: { fontSize: FONTS.sizes.md, fontWeight: '600', color: COLORS.text },
    installScopes: { fontSize: FONTS.sizes.xs, color: COLORS.textTertiary, marginTop: 2 },
    installButton: {
      backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2,
      borderRadius: BORDER_RADIUS.round, minWidth: 60, alignItems: 'center',
    },
    installButtonText: { color: COLORS.onPrimary, fontWeight: '600', fontSize: FONTS.sizes.sm },
  });

export default GuildAppsScreen;