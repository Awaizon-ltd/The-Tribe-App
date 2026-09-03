// services/GoogleAuthService.js
// Exchanges a Google ID token (from hooks/useGoogleAuth.js) for a Firebase
// session. This file only establishes IDENTITY — it never touches wallet
// encryption. The Google ID token is not secret (it's presented to Google's
// own verification servers and reissued on refresh), so it must never be
// used as key material; see contexts/AuthContext.js's hasPasswordProvider
// for how the wallet layer accounts for Google-authenticated users having
// no password to encrypt with.
import {
  GoogleAuthProvider,
  signInWithCredential,
  linkWithCredential,
  getAdditionalUserInfo,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { auth } from "./Firebase";

/**
 * Sign in (or sign up) with a Google ID token.
 *
 * Handles the standard Firebase multi-provider conflict: if this email
 * already has a password-based account, Firebase refuses to silently create
 * a second one — instead we surface enough information for the caller to
 * prompt the user to sign in with their original method, then call
 * completeGoogleAccountLink() to attach Google to that same account.
 *
 * @returns {Promise<{ user: import('firebase/auth').User, isNewUser: boolean }>}
 * @throws {Error & { code: 'auth/account-exists-with-different-credential', email: string, pendingCredential: import('firebase/auth').AuthCredential, existingMethods: string[] }}
 */
export const signInWithGoogleIdToken = async (idToken) => {
  const credential = GoogleAuthProvider.credential(idToken);

  try {
    const result = await signInWithCredential(auth, credential);
    const isNewUser = !!getAdditionalUserInfo(result)?.isNewUser;
    return { user: result.user, isNewUser };
  } catch (err) {
    if (err.code === "auth/account-exists-with-different-credential") {
      const email = err.customData?.email;
      const pendingCredential = GoogleAuthProvider.credentialFromError(err);
      const existingMethods = email ? await fetchSignInMethodsForEmail(auth, email) : [];

      const conflictError = new Error(
        existingMethods.includes("password")
          ? `An account already exists for ${email}. Sign in with your password to link Google to it.`
          : `An account already exists for ${email} using a different sign-in method.`,
      );
      conflictError.code = "auth/account-exists-with-different-credential";
      conflictError.email = email;
      conflictError.pendingCredential = pendingCredential;
      conflictError.existingMethods = existingMethods;
      throw conflictError;
    }
    throw err;
  }
};

/**
 * Completes the account-linking flow after the user has re-authenticated
 * with their original method (e.g. just signed in with email/password).
 * Attaches the Google credential to `auth.currentUser` so the SAME account
 * (same UID, same wallet) can be used with either method going forward.
 *
 * @param {import('firebase/auth').AuthCredential} pendingCredential - from
 *   the conflict error's `pendingCredential` field.
 */
export const completeGoogleAccountLink = async (pendingCredential) => {
  if (!auth.currentUser) {
    throw new Error("Must be signed in with the original method before linking Google.");
  }
  const result = await linkWithCredential(auth.currentUser, pendingCredential);
  return { user: result.user };
};
