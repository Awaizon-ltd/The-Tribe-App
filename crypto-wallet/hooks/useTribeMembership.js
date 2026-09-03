import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth }     from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';
import api from '../services/TribeApiService';
import * as TribeCache from '../utils/TribeCache';

export const useTribeMembership = (tribe, user, privacy) => {
  const { userData } = useUserData();

  const [isMember, setIsMember]               = useState(false);
  const [memberCount, setMemberCount]         = useState(tribe?.member_count || tribe?.memberCount || 0);
  const [membershipStatus, setMembershipStatus] = useState(null);
  const [joinLoading, setJoinLoading]         = useState(false);

  // Sync memberCount when the tribe object arrives late (async fetch in TribeDetailsScreen)
  useEffect(() => {
    const count = tribe?.member_count ?? tribe?.memberCount ?? 0;
    if (count > 0) setMemberCount(count);
  }, [tribe?.member_count, tribe?.memberCount]);

  // ── Membership status — cache-first ────────────────────────────────────────
  const checkStatus = useCallback(async () => {
    if (!user || !tribe?.id) return;

    // 1. Show cached status immediately
    const { data: cached, stale } = await TribeCache.getMembership(tribe.id, user.uid);
    if (cached) {
      setIsMember(true);
      setMembershipStatus(cached.status);
    }

    // 2. Re-fetch from API only when stale (or first time)
    if (!stale) return;

    try {
      const membership = await api.getMembership(tribe.id);
      if (membership) {
        setIsMember(true);
        setMembershipStatus(membership.status);
        await TribeCache.saveMembership(tribe.id, user.uid, membership);
      } else {
        setIsMember(false);
        setMembershipStatus(null);
        // Cache "not a member" as null so we don't re-check until TTL expires
        await TribeCache.saveMembership(tribe.id, user.uid, null);
      }
    } catch {
      if (!cached) {
        setIsMember(false);
        setMembershipStatus(null);
      }
    }
  }, [user, tribe?.id]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  // ── Join tribe ────────────────────────────────────────────────────────────
  const handleJoinTribe = useCallback(async (address, tokenGatingData, hasRequiredToken) => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to join this tribe.');
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
      const result = await api.joinTribe(tribe.id, {
        username:      userData?.username    || user.email?.split('@')[0] || 'Unknown',
        displayName:   userData?.displayName || null,
        userAvatar:    userData?.profilePicture || null,
        walletAddress: address || null,
      });

      if (result.alreadyMember) {
        const status = result.data?.status || 'member';
        setIsMember(true);
        setMembershipStatus(status);
        await TribeCache.saveMembership(tribe.id, user.uid, { status });
        Alert.alert('Already a Member', 'You are already a member of this tribe.');
        return;
      }

      setIsMember(true);
      setMembershipStatus('member');
      setMemberCount((prev) => prev + 1);

      // Persist fresh membership, invalidate the members list so it re-fetches
      await TribeCache.saveMembership(tribe.id, user.uid, { status: 'member' });
      await TribeCache.invalidateTribe(tribe.id);

      Alert.alert('Success!', 'You joined the tribe.');
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Failed to join. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setJoinLoading(false);
    }
  }, [user, tribe?.id, userData, privacy]);

  return {
    isMember,
    memberCount,
    membershipStatus,
    joinLoading,
    handleJoinTribe,
    setMemberCount,
  };
};
