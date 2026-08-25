import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// import * as SecureStore from 'expo-secure-store';
// import { APP_CONFIG } from './constants/Config';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';

// Navigation
import Navigation from './navigation/Navigation';

// Database
import { initDatabase } from './utils/Database';

// Theme
import { COLORS, FONTS } from './constants/Theme';
import { ChainProvider } from './contexts/ChainContext';
import { UserDataProvider } from './contexts/UserDataContext';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize database
      await initDatabase();
      
      // You can add more initialization logic here
      // For example: checking for app updates, loading assets, etc.
      
      setIsReady(true);
    } catch (err) {
      console.error('App initialization error:', err);
      setError('Failed to initialize app. Please restart.');
    }
  };
  // Add this temporarily in your App.js or any component


// useEffect(() => {
//   const resetPasscode = async () => {
//     await SecureStore.deleteItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET);
//     console.log('Local wallet cleared!');
//   };
//   resetPasscode();
// }, []);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.logo}>🔐</Text>
        <Text style={styles.appName}>Crypto Wallet</Text>
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UserDataProvider>
             <ChainProvider>
        <WalletProvider>
              <StatusBar style="light" backgroundColor='#0d1017' />
          <Navigation />
        </WalletProvider>
        </ChainProvider>
        </UserDataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 80,
    marginBottom: 16,
  },
  appName: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 32,
  },
  loader: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.error,
    textAlign: 'center',
  },
});