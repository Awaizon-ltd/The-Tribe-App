// components/tribe/LinkDAOModal.js
// Modal for the tribe owner to browse and link a DAO to their tribe.
// Uses the existing DAOCard component and the backend DAO search API.
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  FlatList, TextInput, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme }    from '../../contexts/ThemeContext';
import { useChain }    from '../../contexts/ChainContext';
import axios           from 'axios';
import { APP_CONFIG }  from '../../constants/Config';

const API_BASE = APP_CONFIG.BACKEND_URL;

// Lightweight DAO row — not using full DAOCard to keep the modal compact
const DAORow = ({ dao, onPress, COLORS, isLinked }) => (
  <TouchableOpacity
    style={[
      s.daoRow,
      { backgroundColor: COLORS.surface, borderColor: isLinked ? COLORS.primary : COLORS.divider },
      isLinked && { borderWidth: 1.5 },
    ]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    {dao.image_url ? (
      <Image source={{ uri: dao.image_url }} style={s.daoLogo} />
    ) : (
      <View style={[s.daoLogo, s.daoLogoFallback, { backgroundColor: COLORS.primary + '20' }]}>
        <Text style={[s.daoLogoLetter, { color: COLORS.primary }]}>
          {dao.dao_name?.charAt(0).toUpperCase() || 'D'}
        </Text>
      </View>
    )}

    <View style={s.daoRowInfo}>
      <Text style={[s.daoRowName, { color: COLORS.text }]} numberOfLines={1}>
        {dao.dao_name}
      </Text>
      <Text style={[s.daoRowMeta, { color: COLORS.textSecondary }]} numberOfLines={1}>
        {dao.chain_name} · {dao.genre}
      </Text>
    </View>

    {isLinked ? (
      <View style={[s.linkedBadge, { backgroundColor: COLORS.primary }]}>
        <Ionicons name="checkmark" size={13} color="#FFF" />
        <Text style={s.linkedText}>Linked</Text>
      </View>
    ) : (
      <Ionicons name="link-outline" size={20} color={COLORS.textTertiary} />
    )}
  </TouchableOpacity>
);

const LinkDAOModal = ({
  visible,
  onClose,
  onLink,      // (daoAddress, chainId, daoName) => void
  currentLinkedAddress,
  currentLinkedChainId,
}) => {
  const { COLORS }  = useTheme();
  const { chainId } = useChain();   // current chain — used as default filter

  const [query, setQuery]     = useState('');
  const [daos, setDaos]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(null);   // daoAddress being linked

  // Load DAOs whenever the modal opens or search changes
  const loadDaos = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const params = { offset: 0, limit: 40 };
      let url;
      if (q.trim()) {
        url = `${API_BASE}/daos/search`;
        params.q = q.trim();
        if (chainId) params.chainId = chainId;
      } else {
        url = `${API_BASE}/daos/chain/${chainId || 1}`;
      }
      const res = await axios.get(url, { params });
      const list = res.data?.data ?? res.data?.daos ?? [];
      setDaos(list);
    } catch {
      setDaos([]);
    } finally {
      setLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    if (visible) loadDaos();
  }, [visible, loadDaos]);

  const handleSearch = useCallback((text) => {
    setQuery(text);
    loadDaos(text);
  }, [loadDaos]);

  const handleLink = useCallback(async (dao) => {
    setLinking(dao.dao_address);
    try {
      await onLink(dao.dao_address, dao.chain_id, dao.dao_name);
      onClose();
    } finally {
      setLinking(null);
    }
  }, [onLink, onClose]);

  const renderItem = useCallback(({ item }) => {
    const isLinked = item.dao_address?.toLowerCase() === currentLinkedAddress?.toLowerCase()
      && item.chain_id === currentLinkedChainId;

    return (
      <DAORow
        dao={item}
        COLORS={COLORS}
        isLinked={isLinked}
        onPress={() => {
          if (isLinked) return;   // already linked — no-op
          handleLink(item);
        }}
      />
    );
  }, [COLORS, currentLinkedAddress, currentLinkedChainId, handleLink]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[s.container, { backgroundColor: COLORS.background }]}>
        {/* Header */}
        <View style={[s.header, { backgroundColor: COLORS.surface, borderColor: COLORS.divider }]}>
          <Text style={[s.title, { color: COLORS.text }]}>Link a DAO</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <Text style={[s.subtitle, { color: COLORS.textSecondary }]}>
          Linking a DAO adds a Governance tab to your tribe — members can view proposals
          and vote without leaving the tribe.
        </Text>

        {/* Search */}
        <View style={[s.searchWrap, { backgroundColor: COLORS.surface, borderColor: COLORS.divider }]}>
          <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={[s.searchInput, { color: COLORS.text }]}
            placeholder="Search DAOs…"
            placeholderTextColor={COLORS.textTertiary}
            value={query}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* List */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={daos}
            keyExtractor={(item) => `${item.dao_address}-${item.chain_id}`}
            renderItem={renderItem}
            contentContainerStyle={s.listPad}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Ionicons name="search-outline" size={40} color={COLORS.textTertiary} />
                <Text style={[s.emptyText, { color: COLORS.textSecondary }]}>
                  No DAOs found
                </Text>
              </View>
            }
          />
        )}

        {/* Linking overlay */}
        {linking && (
          <View style={s.linkingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[s.linkingText, { color: COLORS.text }]}>Linking DAO…</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title:    { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 4 },
  subtitle: { fontSize: 13, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, lineHeight: 18 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },

  listPad: { padding: 16, gap: 8 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:   { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:   { fontSize: 15 },

  // DAO row
  daoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  daoLogo:        { width: 44, height: 44, borderRadius: 22 },
  daoLogoFallback: { justifyContent: 'center', alignItems: 'center' },
  daoLogoLetter:  { fontSize: 18, fontWeight: '700' },
  daoRowInfo:     { flex: 1 },
  daoRowName:     { fontSize: 15, fontWeight: '600' },
  daoRowMeta:     { fontSize: 12, marginTop: 2 },
  linkedBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  linkedText:     { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // Linking overlay
  linkingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  linkingText: { fontSize: 16, fontWeight: '600' },
});

export default LinkDAOModal;
