import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '../services/Firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserDataContext = createContext(null);

export const useUserData = () => {
  const context = useContext(UserDataContext);
  if (!context) {
    throw new Error('useUserData must be used within UserDataProvider');
  }
  return context;
};

export const UserDataProvider = ({ children }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState(null);

  const STORAGE_KEY_PREFIX = '@user_data_';

  // Load cached data if available
  const loadCachedData = async (uid) => {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + uid);
      if (cached) {
        setUserData(JSON.parse(cached));
      }
    } catch (error) {
    }
  };

  // Save data to cache
  const saveCachedData = async (uid, data) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_PREFIX + uid, JSON.stringify(data));
    } catch (error) {

    }
  };

  // Listen for auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
        loadCachedData(user.uid); // load cached data immediately
      } else {
        setUid(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return unsubscribeAuth;
  }, []);

  // Listen for Firestore user data
  useEffect(() => {
    if (!uid) return;

    setLoading(true);
    const userRef = doc(db, 'users', uid);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = { uid, ...snapshot.data() };
          setUserData(data);
          saveCachedData(uid, data); // update cache
        } else {
          setUserData(null);
        }
        setLoading(false);
      },
      (error) => {
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [uid]);

  // Update only profile-related fields
  const updateProfile = async ({ username, displayName, bio, profilePicture }) => {
    if (!uid) return;

    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
    updateData.updatedAt = new Date().toISOString();

    await updateDoc(doc(db, 'users', uid), updateData);
  };

  return (
    <UserDataContext.Provider value={{ userData, loading, updateProfile }}>
      {children}
    </UserDataContext.Provider>
  );
};
