import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/GuildApiService';

function generateCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export const useGuildSettings = (guildId) => {
  const { user } = useAuth();
  const [moderators, setModerators]     = useState([]);
  const [inviteLinks, setInviteLinks]   = useState([]);
  const [externalLinks, setExternalLinks] = useState(null);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!guildId || !user) return;

    const load = async () => {
      try {
        const [mods, invites, links] = await Promise.all([
          api.getModerators(guildId),
          api.getInvites(guildId),
          api.getExternalLinks(guildId),
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
  }, [guildId, user]);

  const addModerator = useCallback(async (userId, roleName, permissions) => {
    const mod = await api.addModerator(guildId, { userId, roleName, permissions });
    const newMod = mod.data || mod;
    setModerators(prev => {
      const filtered = prev.filter(m => m.user_id !== userId);
      return [...filtered, newMod];
    });
  }, [guildId]);

  const removeModerator = useCallback(async (userId) => {
    await api.removeModerator(guildId, userId);
    setModerators(prev => prev.filter(m => m.user_id !== userId));
  }, [guildId]);

  const updateModeratorPermissions = useCallback(async (userId, permissions) => {
    const updated = await api.updateModeratorPerms(guildId, userId, permissions);
    setModerators(prev =>
      prev.map(m => m.user_id === userId ? { ...m, permissions } : m),
    );
    return updated;
  }, [guildId]);

  const createInviteLink = useCallback(async (options = {}) => {
    const invite = await api.createInvite(guildId, options);
    const newInvite = invite.data || invite;
    setInviteLinks(prev => [newInvite, ...prev]);
    return newInvite.code;
  }, [guildId]);

  const deactivateInviteLink = useCallback(async (inviteId) => {
    await api.deactivateInvite(guildId, inviteId);
    setInviteLinks(prev =>
      prev.map(i => i.id === inviteId ? { ...i, is_active: false, isActive: false } : i),
    );
  }, [guildId]);

  const updateExternalLinks = useCallback(async (links) => {
    const updated = await api.updateExternalLinks(guildId, links);
    setExternalLinks(updated.data || updated);
  }, [guildId]);

  const updateGuildName = useCallback(async (newName) => {
    await api.updateGuild(guildId, { name: newName });
  }, [guildId]);

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
    updateGuildName,
  };
};
