import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  deleteUser,
  initializeAuth,
  getReactNativePersistence,
  reload,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import {
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  addDoc,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

// Switched from the "sysfi-protocol" project to "the-tribe-community-app"
// (matches the app's real name/branding). Existing Firestore data (users,
// wallets, support chats) lived under sysfi-protocol and is not reachable
// under this project unless separately migrated — this only repoints the
// client SDK, it doesn't move data.
const firebaseConfig = {
  apiKey: "AIzaSyDRK4emsl-ab5tLZQHkwUqZbUka4fL-OWw",
  authDomain: "the-tribe-community-app.firebaseapp.com",
  projectId: "the-tribe-community-app",
  storageBucket: "the-tribe-community-app.firebasestorage.app",
  messagingSenderId: "149208464601",
  appId: "1:149208464601:web:c31039b1c073585c8a12c8",
  measurementId: "G-TNCJB06G2D",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
const db = getFirestore(app);
const storage = getStorage(app);
// Realtime Database (getDatabase) was previously initialized here but never
// actually used anywhere in the app (nothing imports `database` from this
// file) — removed rather than carried over, since the new project's config
// has no databaseURL and getDatabase(app) would throw at startup without
// one unless the new project also has RTDB provisioned.

// ============ Cache Configuration ============
const CACHE_KEYS = {
  CHAT_MESSAGES: 'support_chat_messages_',
  CHAT_INFO: 'support_chat_info_',
  LAST_SYNC: 'support_chat_last_sync_',
};

const CACHE_EXPIRY = 24*60 * 60 * 1000;

// ============ Cache Utilities ============

const getCachedData = async (key) => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is expired
    if (now - timestamp > CACHE_EXPIRY) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    console.log('[Cache] Retrieved from cache:', key);
    return data;
  } catch (error) {
    console.error('[Cache] Error reading cache:', error);
    return null;
  }
};

const setCachedData = async (key, data) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    console.log('[Cache] Saved to cache:', key);
  } catch (error) {
    console.error('[Cache] Error writing cache:', error);
  }
};

const clearChatCache = async (chatId) => {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.CHAT_MESSAGES + chatId);
    await AsyncStorage.removeItem(CACHE_KEYS.CHAT_INFO + chatId);
    await AsyncStorage.removeItem(CACHE_KEYS.LAST_SYNC + chatId);
    console.log('[Cache] Cleared cache for chat:', chatId);
  } catch (error) {
    console.error('[Cache] Error clearing cache:', error);
  }
};

// ============ Auth Functions ============

export const registerUser = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
};

/**
 * Change user password with re-authentication
 */
export const changeUserPassword = async (email, currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('No user logged in');
    }

    // Re-authenticate user
    const credential = EmailAuthProvider.credential(email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    
    // Update password
    await updatePassword(user, newPassword);
    
    console.log('[Firebase] Password updated successfully');
    return true;
  } catch (error) {
    console.error('[Firebase] Change password error:', error);
    throw error;
  }
};

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const deleteUserAccount = async (user) => {
  try {
    await deleteUser(user);
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

// Send email verification
export const sendVerificationEmail = async (user) => {
  try {
    await sendEmailVerification(user, {
      handleCodeInApp: false,
    });
    console.log('Verification email sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

// Reload user to get updated emailVerified status
export const reloadUser = async (user) => {
  try {
    await reload(user);
    return user;
  } catch (error) {
    console.error('Error reloading user:', error);
    throw error;
  }
};

// ============ Storage Functions ============

export const uploadProfileImage = async (userId, imageUri) => {
  try {
    console.log('[Firebase] Starting profile image upload for user:', userId);
    console.log('[Firebase] Image URI:', imageUri);
    
    // Fetch the image
    const response = await fetch(imageUri);
    if (!response.ok) {
      throw new Error('Failed to fetch image from URI');
    }
    
    const blob = await response.blob();
    console.log('[Firebase] Image blob created, size:', blob.size);
    
    // Create unique filename
    const imageName = `profile_${userId}_${Date.now()}.jpg`;
    const storageRef = ref(storage, `profile_images/${imageName}`);
    
    console.log('[Firebase] Uploading to path:', `profile_images/${imageName}`);
    
    // Upload to Firebase Storage
    const uploadResult = await uploadBytes(storageRef, blob);
    console.log('[Firebase] Upload completed:', uploadResult);
    
    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('[Firebase] Download URL obtained:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('[Firebase] Error uploading profile image:', error);
    throw error;
  }
};

export const deleteProfileImage = async (imageUrl) => {
  try {
    const imageRef = ref(storage, imageUrl);
    await deleteObject(imageRef);
    return true;
  } catch (error) {
    console.error('Error deleting profile image:', error);
    throw error;
  }
};

// ============ Firestore User Functions ============

export const createUserProfile = async (userId, profileData) => {
  try {
    console.log('[Firebase] Creating user profile in Firestore:', userId);
    console.log('[Firebase] Profile data:', profileData);
    
    // Use batch write for atomic operation
    const batch = writeBatch(db);
    
    // 1. Add to users collection (with ALL required fields including uid)
    const userRef = doc(db, 'users', userId);
    batch.set(userRef, {
      uid: userId, // ✅ CRITICAL: Add this field (required by Firestore rules)
      email: profileData.email,
      username: profileData.username,
      displayName: profileData.displayName,
      bio: profileData.bio || '',
      profilePicture: profileData.profileImageUrl || null,
      emailVerified: profileData.emailVerified || false,
      createdAt: serverTimestamp(), // ✅ Use serverTimestamp instead of new Date()
      updatedAt: serverTimestamp(), // ✅ Use serverTimestamp instead of new Date()
    });
    
    // 2. Add to usernames collection (for fast lookup and uniqueness)
    const usernameRef = doc(db, 'usernames', profileData.username.toLowerCase());
    batch.set(usernameRef, {
      userId: userId,
      username: profileData.username, // Store original case
      createdAt: serverTimestamp(), // ✅ Use serverTimestamp instead of new Date()
    });
    
    // Commit both writes atomically
    await batch.commit();
    
    console.log('[Firebase] User profile and username created successfully');
    return true;
  } catch (error) {
    console.error('[Firebase] Error creating user profile:', error);
    console.error('[Firebase] Error code:', error.code);
    console.error('[Firebase] Error message:', error.message);
    throw error;
  }
};

export const getUserData = async (userId) => {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
};

export const updateUserProfile = async (userId, profileData) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...profileData,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

export const deleteUserProfile = async (userId, username) => {
  try {
    const batch = writeBatch(db);
    
    // Delete user profile
    const userRef = doc(db, 'users', userId);
    batch.delete(userRef);
    
    // Delete username document if provided
    if (username) {
      const usernameRef = doc(db, 'usernames', username.toLowerCase());
      batch.delete(usernameRef);
    }
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error deleting user profile:', error);
    throw error;
  }
};

// ============ Username Functions ============

export const checkUsernameExists = async (username) => {
  try {
    // Direct document lookup - much faster than query
    const usernameRef = doc(db, 'usernames', username.toLowerCase());
    const docSnap = await getDoc(usernameRef);
    
    return docSnap.exists();
  } catch (error) {
    console.error('Error checking username:', error);
    throw error;
  }
};

export const getUserByUsername = async (username) => {
  try {
    // 1. Look up userId from usernames collection (fast)
    const usernameRef = doc(db, 'usernames', username.toLowerCase());
    const usernameSnap = await getDoc(usernameRef);
    
    if (!usernameSnap.exists()) {
      return null;
    }
    
    const { userId } = usernameSnap.data();
    
    // 2. Get full user data
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return { id: userId, ...userSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user by username:', error);
    throw error;
  }
};

// Update username (atomic operation)
export const updateUsername = async (userId, oldUsername, newUsername) => {
  try {
    const batch = writeBatch(db);
    
    // 1. Delete old username document
    if (oldUsername) {
      const oldUsernameRef = doc(db, 'usernames', oldUsername.toLowerCase());
      batch.delete(oldUsernameRef);
    }
    
    // 2. Create new username document
    const newUsernameRef = doc(db, 'usernames', newUsername.toLowerCase());
    batch.set(newUsernameRef, {
      userId: userId,
      username: newUsername,
      createdAt: new Date().toISOString(),
    });
    
    // 3. Update user profile
    const userRef = doc(db, 'users', userId);
    batch.update(userRef, {
      username: newUsername,
      updatedAt: new Date().toISOString(),
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error updating username:', error);
    throw error;
  }
};

// ============ Wallet Functions ============

export const saveEncryptedWallet = async (userId, walletData) => {
  try {
    await setDoc(doc(db, 'wallets', userId), {
      ...walletData,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    console.error('Error saving wallet:', error);
    throw error;
  }
};

export const getEncryptedWallet = async (userId) => {
  try {
    // 1. Try new structure first (/wallets collection)
    const walletDocRef = doc(db, 'wallets', userId);
    const walletDocSnap = await getDoc(walletDocRef);
    
    if (walletDocSnap.exists()) {
      console.log('[Firebase] Found wallet in /wallets collection (new structure)');
      return walletDocSnap.data();
    }
    
    // 2. Fallback to old structure (/users collection)
    console.log('[Firebase] Wallet not found in /wallets, checking /users (legacy)');
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      
      // Check if old wallet fields exist
      if (userData.encryptedWallet && userData.salt) {
        console.log('[Firebase] Found legacy wallet data in /users collection');
        
        // Return in new format for compatibility
        return {
          address: userData.walletAddress,
          encrypted: userData.encryptedWallet,
          salt: userData.salt,
          isLegacy: true, // Flag for migration
        };
      }
    }
    
    console.log('[Firebase] No wallet found in either location');
    return null;
  } catch (error) {
    console.error('Error fetching wallet:', error);
    throw error;
  }
};

// Optional: Migrate legacy wallet to new structure
export const migrateLegacyWallet = async (userId) => {
  try {
    console.log('[Firebase] Starting wallet migration for user:', userId);
    
    // Get user data
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDocSnap.data();
    
    // Check if legacy wallet exists
    if (!userData.encryptedWallet || !userData.salt) {
      console.log('[Firebase] No legacy wallet to migrate');
      return false;
    }
    
    // Check if already migrated
    const walletDocRef = doc(db, 'wallets', userId);
    const walletDocSnap = await getDoc(walletDocRef);
    
    if (walletDocSnap.exists()) {
      console.log('[Firebase] Wallet already migrated');
      return false;
    }
    
    // Migrate to new structure
    await setDoc(walletDocRef, {
      address: userData.walletAddress,
      encrypted: userData.encryptedWallet,
      salt: userData.salt,
      migratedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    console.log('[Firebase] Wallet migration completed successfully');
    return true;
  } catch (error) {
    console.error('[Firebase] Error migrating wallet:', error);
    throw error;
  }
};

export const deleteEncryptedWallet = async (userId) => {
  try {
    await deleteDoc(doc(db, 'wallets', userId));
  } catch (error) {
    console.error('Error deleting wallet:', error);
    throw error;
  }
};

// ============ Support Chat Functions ============

/**
 * Create a new support chat with caching
 */
const createSupportChat = async (userId, userInfo) => {
  try {
    console.log('[Firebase] Creating support chat for user:', userId);
    
    // Check if user has active chat (cached)
    const cacheKey = CACHE_KEYS.CHAT_INFO + userId;
    const cachedChat = await getCachedData(cacheKey);
    
    if (cachedChat && cachedChat.status === 'open') {
      console.log('[Firebase] Found active chat in cache:', cachedChat.id);
      return cachedChat.id;
    }
    
    // Check Firestore for active chat
    const chatsRef = collection(db, 'supportChats');
    const q = query(
      chatsRef,
      where('userId', '==', userId),
      where('status', '==', 'open'),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const existingChat = querySnapshot.docs[0];
      const chatData = { id: existingChat.id, ...existingChat.data() };
      
      // Cache the chat info
      await setCachedData(cacheKey, chatData);
      
      console.log('[Firebase] Found existing active chat:', existingChat.id);
      return existingChat.id;
    }
    
    // Create new chat
    const chatRef = await addDoc(collection(db, 'supportChats'), {
      userId,
      userName: userInfo.userName,
      userEmail: userInfo.userEmail,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: null,
      unreadCount: 0,
    });

    console.log('[Firebase] Created new support chat:', chatRef.id);

    // Send welcome message
    await sendChatMessage(chatRef.id, {
      text: `Hello ${userInfo.userName}! 👋 Welcome to support. How can we help you today?`,
      senderId: 'system',
      senderName: 'Support Team',
      senderType: 'support',
    });

    // Cache the new chat info
    const newChatData = {
      id: chatRef.id,
      userId,
      userName: userInfo.userName,
      userEmail: userInfo.userEmail,
      status: 'open',
    };
    await setCachedData(cacheKey, newChatData);

    return chatRef.id;
  } catch (error) {
    console.error('[Firebase] Error creating support chat:', error);
    throw error;
  }
};

/**
 * Send a message in a support chat
 */
const sendChatMessage = async (chatId, messageData) => {
  try {
    console.log('[Firebase] Sending chat message to:', chatId);
    
    // Add message to subcollection
    const messageRef = await addDoc(
      collection(db, 'supportChats', chatId, 'messages'), 
      {
        ...messageData,
        createdAt: serverTimestamp(),
        read: false,
      }
    );

    // Update chat's last message and timestamp
    await updateDoc(doc(db, 'supportChats', chatId), {
      lastMessage: messageData.text,
      updatedAt: serverTimestamp(),
    });

    console.log('[Firebase] Chat message sent:', messageRef.id);
    
    // Invalidate cache to force refresh
    await AsyncStorage.removeItem(CACHE_KEYS.CHAT_MESSAGES + chatId);
    
    return messageRef.id;
  } catch (error) {
    console.error('[Firebase] Error sending chat message:', error);
    throw error;
  }
};

/**
 * Subscribe to chat messages in real-time with local caching
 */
const subscribeToChatMessages = (chatId, callback) => {
  try {
    console.log('[Firebase] Subscribing to chat messages:', chatId);
    
    const messagesRef = collection(db, 'supportChats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    // Load cached messages first (instant UI)
    const cacheKey = CACHE_KEYS.CHAT_MESSAGES + chatId;
    getCachedData(cacheKey).then(cachedMessages => {
      if (cachedMessages && cachedMessages.length > 0) {
        console.log('[Firebase] Loading cached messages:', cachedMessages.length);
        callback(cachedMessages);
      }
    });

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log('[Firebase] Received messages update:', messages.length);
      
      // Cache the messages
      setCachedData(cacheKey, messages);
      
      // Update last sync time
      AsyncStorage.setItem(
        CACHE_KEYS.LAST_SYNC + chatId,
        JSON.stringify({ timestamp: Date.now() })
      );

      callback(messages);
    }, (error) => {
      console.error('[Firebase] Error in message subscription:', error);
    });

    return unsubscribe;
  } catch (error) {
    console.error('[Firebase] Error subscribing to chat messages:', error);
    throw error;
  }
};

/**
 * Close a support chat
 */
const closeSupportChat = async (chatId) => {
  try {
    console.log('[Firebase] Closing support chat:', chatId);
    
    await updateDoc(doc(db, 'supportChats', chatId), {
      status: 'closed',
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Clear cache for this chat
    await clearChatCache(chatId);

    console.log('[Firebase] Support chat closed successfully');
  } catch (error) {
    console.error('[Firebase] Error closing support chat:', error);
    throw error;
  }
};

/**
 * Get user's support chat history
 */
const getUserSupportChats = async (userId) => {
  try {
    console.log('[Firebase] Fetching support chats for user:', userId);
    
    const chatsRef = collection(db, 'supportChats');
    const q = query(
      chatsRef,
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(10)
    );
    
    const querySnapshot = await getDocs(q);
    const chats = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log('[Firebase] Found chats:', chats.length);
    return chats;
  } catch (error) {
    console.error('[Firebase] Error fetching user support chats:', error);
    throw error;
  }
};

/**
 * Mark messages as read
 */
const markMessagesAsRead = async (chatId, messageIds) => {
  try {
    console.log('[Firebase] Marking messages as read:', messageIds.length);
    
    const batch = writeBatch(db);
    
    messageIds.forEach(messageId => {
      const messageRef = doc(db, 'supportChats', chatId, 'messages', messageId);
      batch.update(messageRef, { read: true });
    });
    
    await batch.commit();
    
    // Invalidate cache
    await AsyncStorage.removeItem(CACHE_KEYS.CHAT_MESSAGES + chatId);
    
    console.log('[Firebase] Messages marked as read');
  } catch (error) {
    console.error('[Firebase] Error marking messages as read:', error);
    throw error;
  }
};

// ============ User Preferences ============

export const saveUserPreferences = async (userId, preferences) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      preferences,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error saving preferences:', error);
    throw error;
  }
};

// ============ Exports ============

export {
  auth,
  db,
  storage,
  // Cache utilities
  getCachedData,
  setCachedData,
  clearChatCache,
  // Support Chat functions
  createSupportChat,
  sendChatMessage,
  subscribeToChatMessages,
  closeSupportChat,
  getUserSupportChats,
  markMessagesAsRead,
};