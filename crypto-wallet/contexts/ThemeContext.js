// ThemeContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, SPACING, FONTS, BORDER_RADIUS, SHADOWS } from '../constants/Theme';

const ThemeContext = createContext();
const THEME_STORAGE_KEY = '@app_theme_preference';

export const ThemeProvider = ({ children }) => {
  // Reactive — re-renders whenever the OS theme changes
  const systemScheme = useColorScheme(); // 'dark' | 'light' | null

  // 'dark' | 'light' | 'system'
  // Default to 'dark' (the brand default) for new installs — overridden by
  // AsyncStorage below the moment a user has actually picked a preference.
  const [themeMode, setThemeModeState] = useState('dark');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        // Accept existing 'dark'/'light' values and new 'system' value
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
          setThemeModeState(saved);
        }
        // null → keep 'system' default (no saved preference)
      } catch (e) {
        console.error('[ThemeContext] Error loading theme preference:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // The actual dark/light state used for styling
  const isDark =
    themeMode === 'system'
      ? systemScheme === 'dark'   // follow OS; null treated as light
      : themeMode === 'dark';

  /**
   * Set an explicit mode and persist it.
   * Pass 'system' to re-enable OS following.
   */
  const setTheme = async (mode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.error('[ThemeContext] Error saving theme preference:', e);
    }
  };

  /**
   * Backward-compatible toggle used by existing UI components.
   * Always switches to an explicit dark or light preference —
   * call setTheme('system') to re-enable OS following.
   */
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  const theme = {
    COLORS: isDark ? THEMES.dark : THEMES.light,
    SPACING,
    FONTS,
    BORDER_RADIUS,
    SHADOWS,
    isDark,
    isLoading,
    themeMode,    // 'dark' | 'light' | 'system' — useful for settings UI
    toggleTheme,  // existing API: toggles between explicit dark / light
    setTheme,     // new API: set any mode including 'system'
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
