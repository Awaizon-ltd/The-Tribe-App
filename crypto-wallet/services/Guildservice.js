import { db } from './Firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

// ... existing code ...

/**
 * Join a guild
 */
export const joinGuild = async (guildId, userId, inviteId = null) => {
  try {
    // 1. Get guild data
    const guildRef = doc(db, 'guilds', guildId);
    const guildSnap = await getDoc(guildRef);
    
    if (!guildSnap.exists()) {
      throw new Error('Guild not found');
    }
    
    const guildData = guildSnap.data();
    
    // 2. Check if user is already a member
    const isMember = await checkGuildMembership(guildId, userId);
    if (isMember) {
      throw new Error('Already a member of this guild');
    }
    
    // 3. Token gating validation (if private guild)
    if (guildData.privacy === 'private' && guildData.tokenGating) {
      const hasAccess = await validateTokenGating(userId, guildData.tokenGating);
      if (!hasAccess) {
        throw new Error('You do not meet the token requirements to join this guild');
      }
    }
    
    // 4. Get user data for member document
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userSnap.data();
    
    // 5. Add to members subcollection
    const memberRef = doc(db, 'guilds', guildId, 'members', userId);
    await setDoc(memberRef, {
      uid: userId,
      username: userData.username || 'Unknown User',
      displayName: userData.displayName || 'Unknown User',
      userAvatar: userData.profilePicture || null,
      status: 'member', // Can be: member, moderator, owner
      joinedAt: serverTimestamp(),
      inviteId: inviteId || null,
    });
    
    // 6. Update guild document
    await updateDoc(guildRef, {
      members: arrayUnion(userId),
      memberCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    
    // 7. Update user's guilds array
    await updateDoc(userRef, {
      guilds: arrayUnion(guildId),
      updatedAt: serverTimestamp(),
    });
    
    console.log('[GuildService] User successfully joined guild:', guildId);
    return true;
  } catch (error) {
    console.error('[GuildService] Error joining guild:', error);
    throw error;
  }
};

/**
 * Validate token gating requirements
 */
const validateTokenGating = async (userId, tokenGating) => {
  try {
    // This is a placeholder - you'll need to implement actual token balance checking
    // using your wallet context or ethers.js
    
    // Example implementation structure:
    // 1. Get user's wallet address from Firestore/context
    // 2. Check token balance using ethers.js Contract
    // 3. Compare balance with minTokenAmount requirement
    
    console.warn('[GuildService] Token gating validation not fully implemented');
    
    // For now, return true to allow testing
    // TODO: Implement actual token balance checking
    return true;
    
    /* 
    // Full implementation would look like:
    const walletRef = doc(db, 'wallets', userId);
    const walletSnap = await getDoc(walletRef);
    
    if (!walletSnap.exists()) {
      return false;
    }
    
    const walletData = walletSnap.data();
    const userAddress = walletData.address;
    
    // Use ethers to check balance
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    
    if (tokenGating.tokenType === 'Token') {
      // ERC20 token check
      const contract = new ethers.Contract(
        tokenGating.tokenAddress,
        ERC20_ABI,
        provider
      );
      const balance = await contract.balanceOf(userAddress);
      const minRequired = ethers.utils.parseUnits(
        tokenGating.minTokenAmount,
        tokenGating.decimals
      );
      return balance.gte(minRequired);
    } else {
      // ERC721 NFT check
      const contract = new ethers.Contract(
        tokenGating.tokenAddress,
        ERC721_ABI,
        provider
      );
      const balance = await contract.balanceOf(userAddress);
      return balance.gt(0);
    }
    */
  } catch (error) {
    console.error('[GuildService] Error validating token gating:', error);
    return false;
  }
};

/**
 * Leave a guild
 */
export const leaveGuild = async (guildId, userId) => {
  try {
    // 1. Check if user is the owner
    const guildRef = doc(db, 'guilds', guildId);
    const guildSnap = await getDoc(guildRef);
    
    if (!guildSnap.exists()) {
      throw new Error('Guild not found');
    }
    
    const guildData = guildSnap.data();
    
    if (guildData.createdBy === userId) {
      throw new Error('Guild owner cannot leave. Delete the guild instead.');
    }
    
    // 2. Check if user is a member
    const isMember = await checkGuildMembership(guildId, userId);
    if (!isMember) {
      throw new Error('Not a member of this guild');
    }
    
    // 3. Remove from members subcollection
    const memberRef = doc(db, 'guilds', guildId, 'members', userId);
    await deleteDoc(memberRef);
    
    // 4. Update guild document
    await updateDoc(guildRef, {
      members: arrayRemove(userId),
      memberCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
    
    // 5. Update user's guilds array
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      guilds: arrayRemove(guildId),
      updatedAt: serverTimestamp(),
    });
    
    console.log('[GuildService] User successfully left guild:', guildId);
    return true;
  } catch (error) {
    console.error('[GuildService] Error leaving guild:', error);
    throw error;
  }
};

/**
 * Fetch guild members
 */
export const fetchGuildMembers = async (guildId) => {
  try {
    const membersRef = collection(db, 'guilds', guildId, 'members');
    const snapshot = await getDocs(membersRef);
    
    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
      joinedAt: doc.data().joinedAt?.toDate?.() || doc.data().joinedAt || null,
    }));
  } catch (error) {
    console.error('[GuildService] Error fetching members:', error);
    throw error;
  }
};

/**
 * Get member's role in guild
 */
export const getMemberRole = async (guildId, userId) => {
  try {
    const memberRef = doc(db, 'guilds', guildId, 'members', userId);
    const memberSnap = await getDoc(memberRef);
    
    if (!memberSnap.exists()) {
      return null;
    }
    
    return memberSnap.data().status || 'member';
  } catch (error) {
    console.error('[GuildService] Error getting member role:', error);
    return null;
  }
};

/**
 * Fetch guilds that the user is a member of
 */
export const fetchUserGuilds = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return [];
    }
    
    const userData = userSnap.data();
    const guildIds = userData.guilds || [];
    
    if (guildIds.length === 0) {
      return [];
    }
    
    // Fetch all guilds the user is a member of
    const guilds = [];
    for (const guildId of guildIds) {
      const guildRef = doc(db, 'guilds', guildId);
      const guildSnap = await getDoc(guildRef);
      
      if (guildSnap.exists()) {
        guilds.push({
          id: guildSnap.id,
          ...guildSnap.data(),
        });
      }
    }
    
    return guilds;
  } catch (error) {
    console.error('[GuildService] Error fetching user guilds:', error);
    throw error;
  }
};

/**
 * Fetch top guilds by member count
 */
export const fetchTopGuilds = async (limitCount = 10) => {
  try {
    const guildsRef = collection(db, 'guilds');
    const q = query(
      guildsRef,
      where('privacy', '==', 'public'),
      orderBy('memberCount', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('[GuildService] Error fetching top guilds:', error);
    throw error;
  }
};

/**
 * Search guilds by name or description
 */
export const searchGuilds = async (searchQuery, genre = null) => {
  try {
    const guildsRef = collection(db, 'guilds');
    let q;
    
    if (genre) {
      q = query(
        guildsRef,
        where('privacy', '==', 'public'),
        where('genre', '==', genre)
      );
    } else {
      q = query(
        guildsRef,
        where('privacy', '==', 'public')
      );
    }
    
    const snapshot = await getDocs(q);
    
    // Filter by search query (client-side filtering since Firestore doesn't support full-text search)
    const searchLower = searchQuery.toLowerCase();
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(guild => 
        guild.name?.toLowerCase().includes(searchLower) ||
        guild.description?.toLowerCase().includes(searchLower)
      );
  } catch (error) {
    console.error('[GuildService] Error searching guilds:', error);
    throw error;
  }
};