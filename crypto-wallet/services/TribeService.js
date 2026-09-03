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
 * Join a tribe
 */
export const joinTribe = async (tribeId, userId, inviteId = null) => {
  try {
    // 1. Get tribe data
    const tribeRef = doc(db, 'tribes', tribeId);
    const tribeSnap = await getDoc(tribeRef);
    
    if (!tribeSnap.exists()) {
      throw new Error('Tribe not found');
    }
    
    const tribeData = tribeSnap.data();
    
    // 2. Check if user is already a member
    const isMember = await checkTribeMembership(tribeId, userId);
    if (isMember) {
      throw new Error('Already a member of this tribe');
    }
    
    // 3. Token gating validation (if private tribe)
    if (tribeData.privacy === 'private' && tribeData.tokenGating) {
      const hasAccess = await validateTokenGating(userId, tribeData.tokenGating);
      if (!hasAccess) {
        throw new Error('You do not meet the token requirements to join this tribe');
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
    const memberRef = doc(db, 'tribes', tribeId, 'members', userId);
    await setDoc(memberRef, {
      uid: userId,
      username: userData.username || 'Unknown User',
      displayName: userData.displayName || 'Unknown User',
      userAvatar: userData.profilePicture || null,
      status: 'member', // Can be: member, moderator, owner
      joinedAt: serverTimestamp(),
      inviteId: inviteId || null,
    });
    
    // 6. Update tribe document
    await updateDoc(tribeRef, {
      members: arrayUnion(userId),
      memberCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    
    // 7. Update user's tribes array
    await updateDoc(userRef, {
      tribes: arrayUnion(tribeId),
      updatedAt: serverTimestamp(),
    });
    
    console.log('[TribeService] User successfully joined tribe:', tribeId);
    return true;
  } catch (error) {
    console.error('[TribeService] Error joining tribe:', error);
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
    
    console.warn('[TribeService] Token gating validation not fully implemented');
    
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
    console.error('[TribeService] Error validating token gating:', error);
    return false;
  }
};

/**
 * Leave a tribe
 */
export const leaveTribe = async (tribeId, userId) => {
  try {
    // 1. Check if user is the owner
    const tribeRef = doc(db, 'tribes', tribeId);
    const tribeSnap = await getDoc(tribeRef);
    
    if (!tribeSnap.exists()) {
      throw new Error('Tribe not found');
    }
    
    const tribeData = tribeSnap.data();
    
    if (tribeData.createdBy === userId) {
      throw new Error('Tribe owner cannot leave. Delete the tribe instead.');
    }
    
    // 2. Check if user is a member
    const isMember = await checkTribeMembership(tribeId, userId);
    if (!isMember) {
      throw new Error('Not a member of this tribe');
    }
    
    // 3. Remove from members subcollection
    const memberRef = doc(db, 'tribes', tribeId, 'members', userId);
    await deleteDoc(memberRef);
    
    // 4. Update tribe document
    await updateDoc(tribeRef, {
      members: arrayRemove(userId),
      memberCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
    
    // 5. Update user's tribes array
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      tribes: arrayRemove(tribeId),
      updatedAt: serverTimestamp(),
    });
    
    console.log('[TribeService] User successfully left tribe:', tribeId);
    return true;
  } catch (error) {
    console.error('[TribeService] Error leaving tribe:', error);
    throw error;
  }
};

/**
 * Fetch tribe members
 */
export const fetchTribeMembers = async (tribeId) => {
  try {
    const membersRef = collection(db, 'tribes', tribeId, 'members');
    const snapshot = await getDocs(membersRef);
    
    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
      joinedAt: doc.data().joinedAt?.toDate?.() || doc.data().joinedAt || null,
    }));
  } catch (error) {
    console.error('[TribeService] Error fetching members:', error);
    throw error;
  }
};

/**
 * Get member's role in tribe
 */
export const getMemberRole = async (tribeId, userId) => {
  try {
    const memberRef = doc(db, 'tribes', tribeId, 'members', userId);
    const memberSnap = await getDoc(memberRef);
    
    if (!memberSnap.exists()) {
      return null;
    }
    
    return memberSnap.data().status || 'member';
  } catch (error) {
    console.error('[TribeService] Error getting member role:', error);
    return null;
  }
};

/**
 * Fetch tribes that the user is a member of
 */
export const fetchUserTribes = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return [];
    }
    
    const userData = userSnap.data();
    const tribeIds = userData.tribes || [];
    
    if (tribeIds.length === 0) {
      return [];
    }
    
    // Fetch all tribes the user is a member of
    const tribes = [];
    for (const tribeId of tribeIds) {
      const tribeRef = doc(db, 'tribes', tribeId);
      const tribeSnap = await getDoc(tribeRef);
      
      if (tribeSnap.exists()) {
        tribes.push({
          id: tribeSnap.id,
          ...tribeSnap.data(),
        });
      }
    }
    
    return tribes;
  } catch (error) {
    console.error('[TribeService] Error fetching user tribes:', error);
    throw error;
  }
};

/**
 * Fetch top tribes by member count
 */
export const fetchTopTribes = async (limitCount = 10) => {
  try {
    const tribesRef = collection(db, 'tribes');
    const q = query(
      tribesRef,
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
    console.error('[TribeService] Error fetching top tribes:', error);
    throw error;
  }
};

/**
 * Search tribes by name or description
 */
export const searchTribes = async (searchQuery, genre = null) => {
  try {
    const tribesRef = collection(db, 'tribes');
    let q;
    
    if (genre) {
      q = query(
        tribesRef,
        where('privacy', '==', 'public'),
        where('genre', '==', genre)
      );
    } else {
      q = query(
        tribesRef,
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
      .filter(tribe => 
        tribe.name?.toLowerCase().includes(searchLower) ||
        tribe.description?.toLowerCase().includes(searchLower)
      );
  } catch (error) {
    console.error('[TribeService] Error searching tribes:', error);
    throw error;
  }
};