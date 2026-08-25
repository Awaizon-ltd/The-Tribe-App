// navigation/Navigation.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { View, StyleSheet, Platform, AppState } from "react-native";
import * as Linking from "expo-linking";
import { useAuth } from "../contexts/AuthContext";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import { NavigationCache } from "./NavigationCache";
import { navigationRef } from "./NavigationService";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";
import AuthLoadingScreen from "../screens/loading/LoadingScreen";
import { useAppMode } from "../contexts/AppModeContext";
import ModeSwitchSplash from "../components/common/ModeSwitchSplash";

// ─── Genre maps (single source of truth) ─────────────────────────────────────
const GENRE_NAME_TO_ID = {
  NFT: 0,
  Gaming: 1,
  Community: 2,
  DeFi: 3,
  AI: 4,
  Degen: 5,
  Memecoin: 6,
  RWA: 7,
  DePIN: 8,
  SocialFi: 9,
  Metaverse: 10,
  Other: 11,
};

const GENRE_ID_TO_NAME = Object.fromEntries(
  Object.entries(GENRE_NAME_TO_ID).map(([name, id]) => [id, name]),
);

// ─── Deep link URL parser ─────────────────────────────────────────────────────
const parseDeepLink = (url) => {
  if (!url) return null;

  try {
    const parsed = Linking.parse(url);
    const path = parsed.path ?? "";
    const segments = path.split("/").filter(Boolean);
    const query = parsed.queryParams ?? {};

    if (!segments.length) return null;

    // invite/:inviteCode
    if (segments[0] === "invite" && segments[1]) {
      return { type: "invite", inviteCode: segments[1] };
    }

    // dao/:daoAddress/:daoGenre?
    if (segments[0] === "dao" && segments[1]) {
      const daoAddress = segments[1];
      const genreRaw = segments[2];
      const daoGenre = genreRaw ? (GENRE_NAME_TO_ID[genreRaw] ?? 11) : 11;
      return { type: "dao", daoAddress, daoGenre };
    }

    // post/:guildId/:postId
    if (segments[0] === "post" && segments[1] && segments[2]) {
      return { type: "post", guildId: segments[1], postId: segments[2] };
    }

    // guild/create  (must come before guild/:id check)
    if (segments[0] === "guild" && segments[1] === "create") {
      return { type: "createGuild" };
    }

    // guild/search/:genre?
    if (segments[0] === "guild" && segments[1] === "search") {
      return { type: "searchGuild", genre: segments[2] ?? null };
    }

    // guild/:guildId
    if (segments[0] === "guild" && segments[1]) {
      return { type: "guild", guildId: segments[1] };
    }

    // profile/:userId
    if (segments[0] === "profile" && segments[1]) {
      return { type: "profile", userId: segments[1] };
    }

    // proposal/:proposalId
    if (segments[0] === "proposal" && segments[1]) {
      return { type: "proposal", proposalId: segments[1] };
    }

    // token/:tokenAddress
    if (segments[0] === "token" && segments[1]) {
      return { type: "token", tokenAddress: segments[1] };
    }

    // nft/:contractAddress/:tokenId
    if (segments[0] === "nft" && segments[1] && segments[2]) {
      return { type: "nft", contractAddress: segments[1], tokenId: segments[2] };
    }

    // wallet/send/:tokenAddress?to=...&amount=...
    if (segments[0] === "wallet" && segments[1] === "send" && segments[2]) {
      return {
        type: "send",
        tokenAddress: segments[2],
        toAddress: segments[3] ?? query.to ?? null,
        amount: query.amount ?? null,
      };
    }

    // Tab shortcuts — DACTab is the communities/guilds/daos hub
    const TAB_ROUTES = {
      guilds: "DACTab",   // was "HomeTab" which doesn't exist
      daos: "DACTab",
      "my-daos": "MyDACTab",
      swap: "SwapTab",
      wallet: "WalletTab",
    };

    if (TAB_ROUTES[segments[0]]) {
      return { type: "tab", tab: TAB_ROUTES[segments[0]] };
    }

    return null;
  } catch (err) {
    console.warn("[DeepLink] Failed to parse URL:", url, err);
    return null;
  }
};

// ─── Navigate from a parsed deep link result ─────────────────────────────────
const navigateToDeepLink = (navigationRef, parsed) => {
  if (!parsed || !navigationRef.current) return false;

  try {
    switch (parsed.type) {
      case "invite":
        // "GuildInvite" — registered in AppNavigator.js
        navigationRef.current.navigate("GuildInvite", {
          inviteCode: parsed.inviteCode,
        });
        return true;

      case "dao":
        navigationRef.current.navigate("DAODetails", {
          daoAddress: parsed.daoAddress,
          daoGenre: parsed.daoGenre,
        });
        return true;

      case "post":
        navigationRef.current.navigate("PostDetail", {
          postId:  parsed.postId,
          guildId: parsed.guildId,
        });
        return true;

      case "guild":
        navigationRef.current.navigate("GuildDetail", {
          guildId: parsed.guildId,
        });
        return true;

      case "createGuild":
        navigationRef.current.navigate("CreateGuild");
        return true;

      case "searchGuild":
        navigationRef.current.navigate("SearchGuild", {
          genre: parsed.genre,
        });
        return true;

      case "profile":
        // Profile screen uses context for the current user; userId is passed
        // so the screen can show another user's profile if it supports it.
        navigationRef.current.navigate("Profile", {
          userId: parsed.userId,
        });
        return true;

      case "proposal":
        // Proposals belong to a DAO — navigate to the DAOs tab so the user
        // can find the proposal. A full proposal deep link needs daoAddress
        // which isn't in the URL; this is the best we can do without it.
        navigationRef.current.navigate("Main", { screen: "DACTab" });
        return true;

      case "token":
        // Navigate to the Tokens list — TokenDetail needs a full data object
        // that can only be assembled after fetching on-chain + price data.
        navigationRef.current.navigate("Tokens");
        return true;

      case "nft":
        // Navigate to the NFTs list for the same reason as tokens above.
        navigationRef.current.navigate("NFTs");
        return true;

      case "send":
        // Pass as deep link params; SendScreen can pre-populate if it reads them.
        navigationRef.current.navigate("Send", {
          deepLinkToken: parsed.tokenAddress,
          deepLinkTo: parsed.toAddress,
          deepLinkAmount: parsed.amount,
        });
        return true;

      case "tab":
        navigationRef.current.navigate("Main", { screen: parsed.tab });
        return true;

      default:
        return false;
    }
  } catch (err) {
    console.warn("[DeepLink] Navigation failed for parsed link:", parsed, err);
    return false;
  }
};

// ─── Component ────────────────────────────────────────────────────────────────
const Navigation = () => {
  const { COLORS } = useTheme();
  const { isSwitching, switchingTo } = useAppMode();

  const {
    isAuthenticated: isAuthenticatedUser,
    loading: authLoading,
    user,
  } = useAuth();

  const {
    wallet,
    isAuthenticated: isWalletAuthenticated,
    needsPasscodeSetup,
    firestoreWalletExists,
    checkingWallet,
    hasLocalPasscode,
    walletCheckError,
  } = useWallet();

  const [isReady, setIsReady] = useState(false);
  const routeNameRef = useRef();
  const pendingDeepLinkRef = useRef(null);     // stores parsed link, not raw URL
  const isNavigationReadyRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const processedInitialUrlRef = useRef(null); // prevents re-processing on every foreground

  const emailVerified = user?.emailVerified !== false;
  const hasProfileData = Boolean(user?.username && user?.displayName);

  const showMainApp =
    isAuthenticatedUser &&
    emailVerified &&
    hasProfileData &&
    (wallet || firestoreWalletExists) &&
    !needsPasscodeSetup &&
    isWalletAuthenticated;

  // ─── Linking config ───────────────────────────────────────────────────────
  // Prefixes tell NavigationContainer which URLs belong to this app (needed
  // for iOS Universal Link infrastructure even when auto-navigation is off).
  // getStateFromPath: () => undefined disables automatic navigation so our
  // manual handleURL — which can queue links before auth is ready — is the
  // sole handler. Note: `getStateFromPath: undefined` uses the DEFAULT handler
  // (auto-navigates); `() => undefined` truly disables it.
  const linking = {
    prefixes: [
      "nexussysfi://",
      "https://sysfidao.com",
      "http://sysfidao.com",
      "https://www.sysfidao.com",
      "http://www.sysfidao.com",
      Linking.createURL("/"),
    ],
    config: {
      screens: {
        GuildInvite: {
          path: "invite/:inviteCode",
          parse: { inviteCode: (code) => code },
        },
        Main: {
          screens: {
            WalletTab: "wallet",
            DACTab: "daos",
            MyDACTab: "my-daos",
            SwapTab: "swap",
          },
        },
        DAODetails: {
          path: "dao/:daoAddress/:daoGenre?",
          parse: {
            daoAddress: (address) => address,
            daoGenre: (genreName) =>
              genreName ? (GENRE_NAME_TO_ID[genreName] ?? 11) : 11,
          },
          stringify: {
            daoGenre: (genreId) => GENRE_ID_TO_NAME[genreId] ?? "Other",
          },
        },
        PostDetail: {
          path: "post/:guildId/:postId",
          parse: { guildId: (id) => id, postId: (id) => id },
        },
        GuildDetail: {
          path: "guild/:guildId",
          parse: { guildId: (id) => id },
        },
        CreateGuild: "guild/create",
        SearchGuild: {
          path: "guild/search/:genre?",
          parse: { genre: (genre) => genre || null },
        },
        Profile: {
          path: "profile/:userId",
          parse: { userId: (id) => id },
        },
        Send: {
          path: "wallet/send/:deepLinkToken",
          parse: { deepLinkToken: (t) => t },
        },
      },
    },
    // () => undefined disables NavigationContainer's auto-navigation.
    // All URL handling is done by our manual handleURL which supports
    // pre-auth queuing via pendingDeepLinkRef + NavigationCache.
    getStateFromPath: () => undefined,
  };

  // ─── Attempt to navigate to a pending deep link ───────────────────────────
  const flushPendingDeepLink = useCallback(() => {
    if (!pendingDeepLinkRef.current) return;
    if (!isNavigationReadyRef.current) return;
    if (!showMainApp) return;

    const parsed = pendingDeepLinkRef.current;
    pendingDeepLinkRef.current = null;

    // Small delay ensures the navigator's stack is fully mounted
    setTimeout(() => {
      const success = navigateToDeepLink(navigationRef, parsed);
      if (!success) {
        console.warn("[DeepLink] Could not navigate to:", parsed);
      }
    }, 300);
  }, [showMainApp]);

  // ─── Handle a raw URL (called from both getInitialURL and the listener) ────
  const handleURL = useCallback(
    async (url) => {
      if (!url) return;
      console.log("[DeepLink] Received URL:", url);

      const parsed = parseDeepLink(url);
      if (!parsed) {
        console.log("[DeepLink] No handler matched for:", url);
        return;
      }

      console.log("[DeepLink] Parsed:", parsed);

      if (!showMainApp) {
        // User not authenticated yet — persist so we can act on it after login
        pendingDeepLinkRef.current = parsed;

        if (parsed.type === "invite") {
          await NavigationCache.savePendingInvite(parsed.inviteCode);
        } else {
          await NavigationCache.savePendingDeepLink(parsed);
        }

        console.log("[DeepLink] Queued until auth is complete:", parsed);
        return;
      }

      // Already authenticated — navigate immediately if nav is ready,
      // otherwise queue it for the onReady callback.
      if (isNavigationReadyRef.current) {
        navigateToDeepLink(navigationRef, parsed);
      } else {
        pendingDeepLinkRef.current = parsed;
      }
    },
    [showMainApp],
  );

  // ─── Restore navigation state + check persisted deep links ────────────────
  useEffect(() => {
    const restoreState = async () => {
      try {
        const [savedState, pendingInvite, pendingLink] = await Promise.all([
          NavigationCache.getNavigationState(),
          NavigationCache.getPendingInvite(),
          NavigationCache.getPendingDeepLink(),
        ]);

        // Prefer a specific persisted invite over a generic deep link
        if (pendingInvite) {
          pendingDeepLinkRef.current = {
            type: "invite",
            inviteCode: pendingInvite,
          };
        } else if (pendingLink) {
          pendingDeepLinkRef.current = pendingLink;
        }

        // Never restore tab/stack position — always start at the initial
        // route so users aren't dropped back into Swap or a modal on relaunch.
      } catch (err) {
        console.error("[Navigation] Failed to restore state:", err);
      } finally {
        setIsReady(true);
      }
    };

    restoreState();
  }, []);

  // ─── Wire up Linking listeners ────────────────────────────────────────────
  useEffect(() => {
    // Cold start — app opened via a link. Track the URL so the AppState
    // handler below doesn't re-process the same launch URL on every foreground.
    Linking.getInitialURL().then((url) => {
      if (url) {
        processedInitialUrlRef.current = url;
        handleURL(url);
      }
    });

    // Warm start — app already running, new link received
    const linkSub = Linking.addEventListener("url", ({ url }) => {
      if (url) handleURL(url);
    });

    // Re-check on Android foreground edge case: a link can arrive while the app
    // is backgrounded and getInitialURL() updates to the new value. Skip if
    // it's the same URL we already handled at launch.
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        Linking.getInitialURL().then((url) => {
          if (url && url !== processedInitialUrlRef.current) {
            processedInitialUrlRef.current = url;
            handleURL(url);
          }
        });
      }
      appStateRef.current = nextState;
    });

    return () => {
      linkSub.remove();
      appStateSub.remove();
    };
  }, [handleURL]);

  // ─── Flush pending deep links when auth state becomes ready ───────────────
  useEffect(() => {
    if (showMainApp) {
      // Clear persisted invite/link from storage now that we'll act on it
      NavigationCache.clearPendingInvite();
      NavigationCache.clearPendingDeepLink();
      flushPendingDeepLink();
    }
  }, [showMainApp, flushPendingDeepLink]);

  // Keep a ref so onStateChange (memoised with []) can read the latest value
  const showMainAppRef = useRef(showMainApp);
  useEffect(() => { showMainAppRef.current = showMainApp; }, [showMainApp]);

  // ─── Save navigation state on route change ────────────────────────────────
  // Only persist state when the main app is visible — never persist auth-flow
  // screens (Login, Welcome, etc.) so they are not restored on the next launch.
  const onStateChange = useCallback(async (state) => {
    if (!state) return;

    const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;

    if (routeNameRef.current !== currentRouteName) {
      console.log("[Navigation] Route changed:", currentRouteName);
      routeNameRef.current = currentRouteName;
    }

    if (!showMainAppRef.current) return; // don't persist auth-flow navigation

    try {
      await NavigationCache.saveNavigationState(state);
    } catch (err) {
      console.warn("[Navigation] Failed to save state:", err);
    }
  }, []);

  // ─── Loading guard ────────────────────────────────────────────────────────
  // Block until Firebase auth resolves, wallet init completes, and nav state
  // is restored. This ensures AuthNavigator only ever mounts with fully settled
  // state — eliminating the race condition that flashed WalletSetup on startup.
  if (authLoading || checkingWallet || !isReady) {
    return <AuthLoadingScreen />;
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        onStateChange={onStateChange}
        onReady={() => {
          isNavigationReadyRef.current = true;
          routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
          console.log("[Navigation] Ready — route:", routeNameRef.current);

          // Flush any link that arrived before navigation was mounted
          flushPendingDeepLink();
        }}
        fallback={<AuthLoadingScreen />}
      >
        {showMainApp ? (
          <AppNavigator />
        ) : (
          <AuthNavigator
            wallet={wallet}
            firestoreWalletExists={firestoreWalletExists}
            needsPasscodeSetup={needsPasscodeSetup}
            isWalletAuthenticated={isWalletAuthenticated}
            hasLocalPasscode={hasLocalPasscode}
            walletCheckError={walletCheckError}
          />
        )}
      </NavigationContainer>

      {/* Mode-switch splash — rendered above NavigationContainer so it covers everything */}
      {isSwitching && switchingTo && (
        <ModeSwitchSplash targetMode={switchingTo} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default Navigation;
