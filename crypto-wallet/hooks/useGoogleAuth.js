// hooks/useGoogleAuth.js
// Google Sign-In via expo-auth-session's ID-token flow — purpose-built for
// exchanging the result with Firebase (GoogleAuthProvider.credential needs
// an ID token, not just an auth code), unlike the plain/deprecated
// `Google.useAuthRequest`. See node_modules/expo-auth-session/build/
// providers/Google.d.ts's own doc comment on useIdTokenAuthRequest.
//
// This hook only gets Google's ID token — it does NOT sign in to Firebase
// itself. Callers pass the resolved token to
// services/GoogleAuthService.js's signInWithGoogleIdToken().
import { useMemo } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";

// Required once per app for the browser redirect to resolve back into the
// app under our custom scheme — a no-op outside of an in-progress auth
// session, safe to call at module scope.
WebBrowser.maybeCompleteAuthSession();

// Must match whatever scheme is registered against the OAuth client IDs in
// Google Cloud Console (see the wallet-mode-redesign-adjacent Google OAuth
// plan — "thetribe", matching app.json's declared scheme).
const REDIRECT_SCHEME = "thetribe";

export function useGoogleAuth() {
  const redirectUri = useMemo(() => makeRedirectUri({ scheme: REDIRECT_SCHEME }), []);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    },
    { scheme: REDIRECT_SCHEME },
  );

  const idToken = response?.type === "success" ? response.params?.id_token : null;
  const error =
    response?.type === "error"
      ? response.error?.message || "Google sign-in failed"
      : response?.type === "success" && !idToken
        ? "Google sign-in did not return an ID token"
        : null;

  return {
    request, // null until the auth request finishes loading — gate the button on !!request
    response,
    promptAsync, // call on button press; resolves once the browser flow completes
    idToken, // the value to pass into signInWithGoogleIdToken()
    error,
    redirectUri, // for Phase-0 setup reference (register this exact URI in Google Cloud Console)
  };
}

export default useGoogleAuth;
