import React, { useMemo } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COLORS } from "../constants/Theme";
import { useAuth } from "../contexts/AuthContext";

// Screens
import WelcomeScreen           from "../screens/auth/WelcomeScreen";
import LoginScreen             from "../screens/auth/LoginScreen";
import RegisterScreen          from "../screens/auth/RegisterScreen";
import EmailVerificationScreen from "../screens/auth/EmailVerificationScreen";
import PasscodeSetupScreen     from "../screens/auth/PasscodeSetupScreen";
import PasscodeUnlockScreen    from "../screens/auth/PasscodeUnlockScreen";
import UnlockWalletScreen      from "../screens/auth/UnlockWalletScreen";
import AuthLoadingScreen       from "../screens/loading/LoadingScreen";
import ProfileSetupScreen      from "../screens/profile/ProfileSetupScreen";
import WalletSetupScreen       from "../screens/wallet/WalletSetupScreen";

const Stack = createNativeStackNavigator();

// ─── AuthNavigator ────────────────────────────────────────────────────────────
// Navigation.js guarantees this component only mounts when authLoading=false AND
// checkingWallet=false — i.e. Firebase auth and wallet init are both fully settled.
// Routing is driven purely by conditionally registering screens: React Navigation
// treats a change in the registered screen set as a navigation event, transitioning
// the user to the new first screen automatically. No CommonActions.reset needed.
const AuthNavigator = ({
  wallet,
  firestoreWalletExists,
  needsPasscodeSetup,
  isWalletAuthenticated,
  hasLocalPasscode,
  walletCheckError,
}) => {
  const { user } = useAuth();

  const isAuthenticated = useMemo(() => !!user, [user]);
  const hasProfileData  = useMemo(
    () => !!(user?.username && user?.displayName),
    [user?.username, user?.displayName],
  );

  const navigationState = useMemo(() => {
    if (!isAuthenticated)                        return "unauthenticated";
    if (!user?.emailVerified)                    return "emailVerification";
    if (!hasProfileData)                         return "profileSetup";
    if (!wallet && !firestoreWalletExists) {
      // Stay on loading when Firestore check failed (network error) — routing to
      // WalletSetup when we're unsure would risk creating a duplicate wallet.
      if (walletCheckError) return "loading";
      return "walletSetup";
    }
    if (needsPasscodeSetup)                      return "passcodeSetup";
    if (!isWalletAuthenticated)
      return hasLocalPasscode ? "passcodeUnlock" : "unlockWallet";
    // All conditions met — Navigation.js will switch to AppNavigator this render.
    return "authenticated";
  }, [
    isAuthenticated, user?.emailVerified, hasProfileData,
    wallet, firestoreWalletExists, walletCheckError,
    needsPasscodeSetup, isWalletAuthenticated, hasLocalPasscode,
  ]);

  const screenOptions = useMemo(() => ({
    headerStyle:      { backgroundColor: COLORS.background },
    headerTintColor:  COLORS.text,
    headerTitleStyle: { fontWeight: "bold" },
    headerShadowVisible: false,
    contentStyle:     { backgroundColor: COLORS.background },
    animation:        "fade",
    animationDuration: 200,
  }), []);

  return (
    <Stack.Navigator screenOptions={screenOptions}>

      {/* Transient: Firestore check errored — show spinner until user retries */}
      {(navigationState === "loading" || navigationState === "authenticated") && (
        <Stack.Screen
          name="AuthLoading"
          component={AuthLoadingScreen}
          options={{ headerShown: false }}
        />
      )}

      {/* Not logged in */}
      {navigationState === "unauthenticated" && (
        <>
          <Stack.Screen name="Welcome"  component={WelcomeScreen}  options={{ headerShown: false }} />
          <Stack.Screen name="Login"    component={LoginScreen}    options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        </>
      )}

      {/* Email not yet verified */}
      {navigationState === "emailVerification" && (
        <Stack.Screen
          name="EmailVerification"
          component={EmailVerificationScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />
      )}

      {/* Profile setup required (new user) */}
      {navigationState === "profileSetup" && (
        <Stack.Screen
          name="ProfileSetup"
          component={ProfileSetupScreen}
          options={{ headerShown: false, gestureEnabled: false }}
          initialParams={{ isRequired: true }}
        />
      )}

      {/* No wallet found anywhere — create or import */}
      {navigationState === "walletSetup" && (
        <Stack.Screen
          name="WalletSetup"
          component={WalletSetupScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />
      )}

      {/* Cloud wallet exists but no local passcode set up yet */}
      {navigationState === "passcodeSetup" && (
        <Stack.Screen
          name="PasscodeSetup"
          component={PasscodeSetupScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />
      )}

      {/* Wallet locked — enter local passcode or cloud password */}
      {(navigationState === "passcodeUnlock" || navigationState === "unlockWallet") && (
        <>
          <Stack.Screen
            name={navigationState === "passcodeUnlock" ? "PasscodeUnlock" : "UnlockWallet"}
            component={navigationState === "passcodeUnlock" ? PasscodeUnlockScreen : UnlockWalletScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="UnlockWithPassword"
            component={UnlockWalletScreen}
            options={{ title: "Unlock with Password", headerBackTitle: "Back" }}
          />
        </>
      )}

    </Stack.Navigator>
  );
};

export default AuthNavigator;
