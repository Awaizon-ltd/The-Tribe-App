import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEYS = {
  NAVIGATION_STATE: "@navigation_state",
  USER_PREFERENCES: "@user_preferences",
  LAST_ACTIVE_TAB: "@last_active_tab",
  ONBOARDING_COMPLETE: "@onboarding_complete",
  PENDING_INVITE: "@pending_invite",
  PENDING_DEEP_LINK: "@pending_deep_link",
};

export const NavigationCache = {
  // ─── Navigation State ───────────────────────────────────────────────────────

  saveNavigationState: async (state) => {
    try {
      await AsyncStorage.setItem(
        CACHE_KEYS.NAVIGATION_STATE,
        JSON.stringify(state),
      );
    } catch (error) {
      console.error("[NavigationCache] Error saving navigation state:", error);
    }
  },

  getNavigationState: async () => {
    try {
      const state = await AsyncStorage.getItem(CACHE_KEYS.NAVIGATION_STATE);
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error("[NavigationCache] Error getting navigation state:", error);
      return null;
    }
  },

  // ─── Last Active Tab ────────────────────────────────────────────────────────

  saveLastActiveTab: async (tabName) => {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.LAST_ACTIVE_TAB, tabName);
    } catch (error) {
      console.error("[NavigationCache] Error saving last active tab:", error);
    }
  },

  getLastActiveTab: async () => {
    try {
      return await AsyncStorage.getItem(CACHE_KEYS.LAST_ACTIVE_TAB);
    } catch (error) {
      console.error("[NavigationCache] Error getting last active tab:", error);
      return null;
    }
  },

  // ─── User Preferences ───────────────────────────────────────────────────────

  saveUserPreferences: async (preferences) => {
    try {
      await AsyncStorage.setItem(
        CACHE_KEYS.USER_PREFERENCES,
        JSON.stringify(preferences),
      );
    } catch (error) {
      console.error("[NavigationCache] Error saving user preferences:", error);
    }
  },

  getUserPreferences: async () => {
    try {
      const prefs = await AsyncStorage.getItem(CACHE_KEYS.USER_PREFERENCES);
      return prefs ? JSON.parse(prefs) : null;
    } catch (error) {
      console.error("[NavigationCache] Error getting user preferences:", error);
      return null;
    }
  },

  // ─── Onboarding ─────────────────────────────────────────────────────────────

  isOnboardingComplete: async () => {
    try {
      const complete = await AsyncStorage.getItem(
        CACHE_KEYS.ONBOARDING_COMPLETE,
      );
      return complete === "true";
    } catch (error) {
      console.error(
        "[NavigationCache] Error checking onboarding status:",
        error,
      );
      return false;
    }
  },

  setOnboardingComplete: async () => {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.ONBOARDING_COMPLETE, "true");
    } catch (error) {
      console.error(
        "[NavigationCache] Error setting onboarding complete:",
        error,
      );
    }
  },

  // ─── Pending Invite ─────────────────────────────────────────────────────────
  // Persists an invite code when a deep link arrives before the user is
  // authenticated. Cleared automatically after it is acted on.

  savePendingInvite: async (inviteCode) => {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.PENDING_INVITE, inviteCode);
    } catch (error) {
      console.warn("[NavigationCache] Failed to save pending invite:", error);
    }
  },

  getPendingInvite: async () => {
    try {
      return await AsyncStorage.getItem(CACHE_KEYS.PENDING_INVITE);
    } catch (error) {
      console.warn("[NavigationCache] Failed to get pending invite:", error);
      return null;
    }
  },

  clearPendingInvite: async () => {
    try {
      await AsyncStorage.removeItem(CACHE_KEYS.PENDING_INVITE);
    } catch (error) {
      console.warn("[NavigationCache] Failed to clear pending invite:", error);
    }
  },

  // ─── Pending Deep Link ──────────────────────────────────────────────────────
  // Persists any non-invite parsed deep link object so it survives app kills
  // that happen before the user has authenticated.

  savePendingDeepLink: async (parsed) => {
    try {
      await AsyncStorage.setItem(
        CACHE_KEYS.PENDING_DEEP_LINK,
        JSON.stringify(parsed),
      );
    } catch (error) {
      console.warn(
        "[NavigationCache] Failed to save pending deep link:",
        error,
      );
    }
  },

  getPendingDeepLink: async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEYS.PENDING_DEEP_LINK);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("[NavigationCache] Failed to get pending deep link:", error);
      return null;
    }
  },

  clearPendingDeepLink: async () => {
    try {
      await AsyncStorage.removeItem(CACHE_KEYS.PENDING_DEEP_LINK);
    } catch (error) {
      console.warn(
        "[NavigationCache] Failed to clear pending deep link:",
        error,
      );
    }
  },

  // ─── Clear All Cache ────────────────────────────────────────────────────────
  // Clears everything except onboarding status (intentionally preserved).

  clearCache: async () => {
    try {
      await AsyncStorage.multiRemove([
        CACHE_KEYS.NAVIGATION_STATE,
        CACHE_KEYS.USER_PREFERENCES,
        CACHE_KEYS.LAST_ACTIVE_TAB,
        CACHE_KEYS.PENDING_INVITE,
        CACHE_KEYS.PENDING_DEEP_LINK,
      ]);
    } catch (error) {
      console.error("[NavigationCache] Error clearing cache:", error);
    }
  },

  // ─── Clear Deep Link Cache Only ─────────────────────────────────────────────
  // Convenience method used by Navigation.js after auth completes — clears
  // both pending stores in a single AsyncStorage round-trip.

  clearPendingLinks: async () => {
    try {
      await AsyncStorage.multiRemove([
        CACHE_KEYS.PENDING_INVITE,
        CACHE_KEYS.PENDING_DEEP_LINK,
      ]);
    } catch (error) {
      console.warn("[NavigationCache] Failed to clear pending links:", error);
    }
  },
};
