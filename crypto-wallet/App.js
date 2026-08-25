import "react-native-get-random-values";
import React, { useEffect, useState } from "react";
import { Platform, Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as NavigationBar from "expo-navigation-bar";

// Contexts
import { AuthProvider } from "./contexts/AuthContext";
import { WalletProvider } from "./contexts/WalletContext";
import { ChainProvider } from "./contexts/ChainContext";
import { UserDataProvider } from "./contexts/UserDataContext";
import { LoadingProvider } from "./contexts/LoadingContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { AlertProvider } from "./contexts/AlertContext";
import { AppModeProvider } from "./contexts/AppModeContext";
import { StatusBar } from "expo-status-bar";

// Navigation
import Navigation from "./navigation/Navigation";

// Database
import { initDatabase } from "./utils/Database";

// Update Checker
import { UpdateChecker } from "./utils/UpdateChecker";

// Splash Screen
import SplashScreen from "./screens/SplashScreen";

// ─── App Content ─────────────────────────────────────────────────────────────
const AppContent = () => {
  const { COLORS, isDark, isLoading: themeLoading } = useTheme();
  const [isReady, setIsReady] = useState(false);
  const [statusLabel, setLabel] = useState("Initializing...");
  const [error, setError] = useState(null);

  // ── Navigation bar sync ──────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS === "android" && !themeLoading) {
      NavigationBar.setBackgroundColorAsync(COLORS.background);
      NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark");
    }
  }, [isDark, COLORS.background, themeLoading]);

  // ── Init sequence ────────────────────────────────────────────────────────
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      if (Platform.OS === "android") {
        await NavigationBar.setBackgroundColorAsync(COLORS.background);
        await NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark");
      }

      setLabel("Loading database...");
      await initDatabase();

      setLabel("Checking for updates...");
      checkForUpdates(); // fire-and-forget; don't block init

      setIsReady(true);
    } catch (err) {
      console.error("App initialization error:", err);
      setError("Failed to initialize app. Please restart.");
    }
  };

  // ── Update logic (unchanged) ─────────────────────────────────────────────
  const checkForUpdates = async () => {
    try {
      const update = await UpdateChecker.checkForUpdates();
      if (update.type === "playstore") handleGooglePlayUpdate(update);
      else if (update.type === "ota") showOTAUpdateAlert();
    } catch (err) {
      console.error("Update check error:", err);
    }
  };

  const handleGooglePlayUpdate = async (update) => {
    const isFlexible = (update.stalenessDays || 0) < 7;
    if (isFlexible) {
      Alert.alert(
        "Update Available",
        "A new version is available. Would you like to update now?",
        [
          { text: "Later", style: "cancel" },
          {
            text: "Update",
            onPress: async () => {
              try {
                await UpdateChecker.startGooglePlayUpdate(update, true);
              } catch {
                Alert.alert("Update Failed", "Please try again later.");
              }
            },
          },
        ],
        { cancelable: true },
      );
    } else {
      try {
        await UpdateChecker.startGooglePlayUpdate(update, false);
      } catch {
        Alert.alert(
          "Update Required",
          "Please update from Google Play Store to continue.",
        );
      }
    }
  };

  const showOTAUpdateAlert = () => {
    Alert.alert(
      "Update Available",
      "A new update is ready to install. The app will restart.",
      [
        { text: "Later", style: "cancel" },
        {
          text: "Install",
          onPress: async () => {
            try {
              await UpdateChecker.installOTAUpdate();
            } catch {
              Alert.alert("Update Failed", "Please try again later.");
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  // Theme loading (before COLORS are available)
  if (themeLoading) {
    return (
      <SplashScreen
        label="Loading theme..."
        isDark
        COLORS={{ background: "#0a0a0a", primary: "#F2F2F2" }}
      />
    );
  }

  // Initialization error
  if (error) {
    return (
      <SplashScreen
        isError
        errorMessage={error}
        isDark={isDark}
        COLORS={COLORS}
      />
    );
  }

  // Initializing
  if (!isReady) {
    return <SplashScreen label={statusLabel} isDark={isDark} COLORS={COLORS} />;
  }

  // App ready
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Navigation />
    </>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AlertProvider>
          <LoadingProvider>
            <AuthProvider>
              <UserDataProvider>
                <ChainProvider>
                  <WalletProvider>
                    <AppModeProvider>
                      <AppContent />
                    </AppModeProvider>
                  </WalletProvider>
                </ChainProvider>
              </UserDataProvider>
            </AuthProvider>
          </LoadingProvider>
        </AlertProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}