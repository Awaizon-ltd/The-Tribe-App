import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth }     from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';
import api from '../services/GuildApiService';
import * as GuildCache from '../utils/GuildCache';

export const useGuildMembership = (guild, user, privacy) => {
  const { userData } = useUserData();

  const [isMember, setIsMember]               = useState(false);
  const [memberCount, setMemberCount]         = useState(guild?.member_count || guild?.memberCount || 0);
  const [membershipStatus, setMembershipStatus] = useState(null);
  const [joinLoading, setJoinLoading]         = useState(false);

  // Sync memberCount when the guild object arrives late (async fetch in GuildDetailsScreen)
  useEffect(() => {
    const count = guild?.member_count ?? guild?.memberCount ?? 0;
    if (count > 0) setMemberCount(count);
  }, [guild?.member_count, guild?.memberCount]);

  // ── Membership status — cache-first ────────────────────────────────────────
  const checkStatus = useCallback(async () => {
    if (!user || !guild?.id) return;

    // 1. Show cached status immediately
    const { data: cached, stale } = await GuildCache.getMembership(guild.id, user.uid);
    if (cached) {
      setIsMember(true);
      setMembershipStatus(cached.status);
    }

    // 2. Re-fetch from API only when stale (or first time)
    if (!stale) return;

    try {
      const membership = await api.getMembership(guild.id);
      if (membership) {
        setIsMember(true);
        setMembershipStatus(membership.status);
        await GuildCache.saveMembership(guild.id, user.uid, membership);
      } else {
        setIsMember(false);
        setMembershipStatus(null);
        // Cache "not a member" as null so we don't re-check until TTL expires
        await GuildCache.saveMembership(guild.id, user.uid, null);
      }
    } catch {
      if (!cached) {
        setIsMember(false);
        setMembershipStatus(null);
      }
    }
  }, [user, guild?.id]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  // ── Join guild ────────────────────────────────────────────────────────────
  const handleJoinGuild = useCallback(async (address, tokenGatingData, hasRequiredToken) => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to join this guild.');
      return;
    }

    if (privacy === 'private' && tokenGatingData && !hasRequiredToken) {
      const req = tokenGatingData.tokenType === 'Token'
        ? `at least ${tokenGatingData.minTokenAmount} tokens`
        : 'at least 1 NFT';
      Alert.alert('Access Denied', `You need to hold ${req} from the required collection.`);
      return;
    }

    setJoinLoading(true);
    try {
      const result = await api.joinGuild(guild.id, {
        username:      userData?.username    || user.email?.split('@')[0] || 'Unknown',
        displayName:   userData?.displayName || null,
        userAvatar:    userData?.profilePicture || null,
        walletAddress: address || null,
      });

      if (result.alreadyMember) {
        const status = result.data?.status || 'member';
        setIsMember(true);
        setMembershipStatus(status);
        await GuildCache.saveMembership(guild.id, user.uid, { status });
        Alert.alert('Already a Member', 'You are already a member of this guild.');
        return;
      }

      setIsMember(true);
      setMembershipStatus('member');
      setMemberCount((prev) => prev + 1);

      // Persist fresh membership, invalidate the members list so it re-fetches
      await GuildCache.saveMembership(guild.id, user.uid, { status: 'member' });
      await GuildCache.invalidateGuild(guild.id);

      Alert.alert('Success!', 'You joined the guild.');
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Failed to join. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setJoinLoading(false);
    }
  }, [user, guild?.id, userData, privacy]);

  return {
    isMember,
    memberCount,
    membershipStatus,
    joinLoading,
    handleJoinGuild,
    setMemberCount,
  };
};
