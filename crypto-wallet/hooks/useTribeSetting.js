import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/TribeApiService';

function generateCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export const useTribeSettings = (tribeId) => {
  const { user } = useAuth();
  const [moderators, setModerators]     = useState([]);
  const [inviteLinks, setInviteLinks]   = useState([]);
  const [externalLinks, setExternalLinks] = useState(null);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!tribeId || !user) return;

    const load = async () => {
      try {
        const [mods, invites, links] = await Promise.all([
          api.getModerators(tribeId),
          api.getInvites(tribeId),
          api.getExternalLinks(tribeId),
        ]);
        if (!mounted) return;
        setModerators(mods || []);
        setInviteLinks(invites || []);
        setExternalLinks(links || null);
      } catch {
        // fail gracefully
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [tribeId, user]);

  const addModerator = useCallback(async (userId, roleName, permissions) => {
    const mod = await api.addModerator(tribeId, { userId, roleName, permissions });
    const newMod = mod.data || mod;
    setModerators(prev => {
      const filtered = prev.filter(m => m.user_id !== userId);
      return [...filtered, newMod];
    });
  }, [tribeId]);

  const removeModerator = useCallback(async (userId) => {
    await api.removeModerator(tribeId, userId);
    setModerators(prev => prev.filter(m => m.user_id !== userId));
  }, [tribeId]);

  const updateModeratorPermissions = useCallback(async (userId, permissions) => {
    const updated = await api.updateModeratorPerms(tribeId, userId, permissions);
    setModerators(prev =>
      prev.map(m => m.user_id === userId ? { ...m, permissions } : m),
    );
    return updated;
  }, [tribeId]);

  const createInviteLink = useCallback(async (options = {}) => {
    const invite = await api.createInvite(tribeId, options);
    const newInvite = invite.data || invite;
    setInviteLinks(prev => [newInvite, ...prev]);
    return newInvite.code;
  }, [tribeId]);

  const deactivateInviteLink = useCallback(async (inviteId) => {
    await api.deactivateInvite(tribeId, inviteId);
    setInviteLinks(prev =>
      prev.map(i => i.id === inviteId ? { ...i, is_active: false, isActive: false } : i),
    );
  }, [tribeId]);

  const updateExternalLinks = useCallback(async (links) => {
    const updated = await api.updateExternalLinks(tribeId, links);
    setExternalLinks(updated.data || updated);
  }, [tribeId]);

  const updateTribeName = useCallback(async (newName) => {
    await api.updateTribe(tribeId, { name: newName });
  }, [tribeId]);

  return {
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
    updateTribeName,
  };
};
