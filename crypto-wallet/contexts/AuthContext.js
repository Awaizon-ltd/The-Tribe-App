import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  registerUser,
  loginUser,
  logoutUser,
  onAuthChange,
  getUserData,
  uploadProfileImage,
  createUserProfile,
  checkUsernameExists,
  deleteUserAccount,
  sendVerificationEmail,
  deleteUserProfile,
} from "../services/Firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../services/Firebase";
import { saveUser, getUserByUid } from "../utils/Database";
import { useLoading } from "./LoadingContext";
import { signInWithGoogleIdToken, completeGoogleAccountLink } from "../services/GoogleAuthService";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tempCloudPassword, setTempCloudPassword] = useState(null);

  const { showLoading, updateLoading, hideLoading } = useLoading();

  // Refs to prevent race conditions and memory leaks
  const firestoreUnsubscribeRef = useRef(null);
  const isMountedRef = useRef(true);
  const userUpdateTimeoutRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (userUpdateTimeoutRef.current) {
        clearTimeout(userUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Debounced user state update to prevent rapid flickering
  const updateUserState = useCallback((userData) => {
    if (!isMountedRef.current) return;

    // Clear any pending updates
    if (userUpdateTimeoutRef.current) {
      clearTimeout(userUpdateTimeoutRef.current);
    }

    // Use a small delay to batch rapid updates
    userUpdateTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setUser((prevUser) => {
          // Exclude emailVerified — Firebase Auth owns that field, not Firestore.
          // Spreading Firestore's stale emailVerified:false would block navigation.
          const { emailVerified: _ignored, ...rest } = userData ?? {};
          return { ...prevUser, ...rest };
        });
      }
    }, 50); // 50ms debounce
  }, []);

  // Auth state listener with improved error handling
  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Get additional user data from Firestore
          const userData = await getUserData(firebaseUser.uid);

          if (!mounted || !isMountedRef.current) return;

          // Save/update user in local database with profile data
          if (userData) {
            try {
              await saveUser(firebaseUser.uid, firebaseUser.email, {
                username: userData?.username,
                displayName: userData?.displayName,
                bio: userData?.bio,
                profileImageUrl: userData?.profileImageUrl,
              });
            } catch (dbError) {
              console.error("[AuthContext] Local DB save failed:", dbError);
            }
          }

          const combinedUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || userData?.displayName || "",
            ...userData,
            // Firebase Auth is the source of truth — put LAST so Firestore's
            // emailVerified field (often stale) never overrides it.
            emailVerified: firebaseUser.emailVerified,
            // Which sign-in providers this account has (e.g. "password",
            // "google.com") — used by hasPasswordProvider below to decide
            // whether the wallet's cloud copy can use the account password
            // as its encryption passphrase, or needs the separate Wallet
            // Backup Password flow (Google-only accounts have no password).
            providerData: firebaseUser.providerData,
          };

          if (mounted && isMountedRef.current) {
            setUser(combinedUser);
          }
        } else {
          if (mounted && isMountedRef.current) {
            setUser(null);
          }
        }
      } catch (err) {
        console.error("[AuthContext] Error in auth state change:", err);

        if (firebaseUser && mounted && isMountedRef.current) {
          // Fallback to basic user info
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            emailVerified: firebaseUser.emailVerified,
            displayName: firebaseUser.displayName || "",
            providerData: firebaseUser.providerData,
          });
        }
      } finally {
        if (mounted && isMountedRef.current) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Real-time Firestore listener with optimizations
  useEffect(() => {
    // Clean up previous listener
    if (firestoreUnsubscribeRef.current) {
      firestoreUnsubscribeRef.current();
      firestoreUnsubscribeRef.current = null;
    }

    if (!user?.uid) return;

    console.log(
      "[AuthContext] Setting up Firestore listener for user:",
      user.uid
    );

    let lastUpdateTime = Date.now();
    const MIN_UPDATE_INTERVAL = 500; // Minimum 500ms between updates

    const userRef = doc(db, "users", user.uid);

    firestoreUnsubscribeRef.current = onSnapshot(
      userRef,
      (docSnap) => {
        if (!isMountedRef.current) return;

        // Throttle updates to prevent rapid flickering
        const now = Date.now();
        if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) {
          console.log("[AuthContext] Throttling rapid Firestore update");
          return;
        }
        lastUpdateTime = now;

        if (docSnap.exists()) {
          const userData = docSnap.data();
          console.log("[AuthContext] Firestore update received:", userData);

          // Use debounced update
          updateUserState(userData);

          // Update local database asynchronously (don't wait)
          saveUser(user.uid, user.email, {
            username: userData?.username,
            displayName: userData?.displayName,
            bio: userData?.bio,
            profileImageUrl: userData?.profileImageUrl,
          }).catch((err) => {
            console.error("[AuthContext] Failed to update local DB:", err);
          });
        }
      },
      (error) => {
        console.error("[AuthContext] Firestore listener error:", error);
      }
    );

    return () => {
      console.log("[AuthContext] Cleaning up Firestore listener");
      if (firestoreUnsubscribeRef.current) {
        firestoreUnsubscribeRef.current();
        firestoreUnsubscribeRef.current = null;
      }
    };
  }, [user?.uid, user?.email, updateUserState]);

  const register = useCallback(
    async (email, password, profileData = null) => {
      let firebaseUser = null;
      let profileImageUrl = null;

      try {
        setError(null);

        const hasProfileData =
          profileData && profileData.username && profileData.displayName;
        const totalSteps = hasProfileData ? 5 : 2;

        showLoading("Creating your account...", { step: 1, totalSteps });

        firebaseUser = await registerUser(email, password);

        if (!isMountedRef.current) return;

        // If no profile data, create minimal user document
        if (!hasProfileData) {
          updateLoading("Setting up your account...", 2);

          try {
            await createUserProfile(firebaseUser.uid, {
              email: firebaseUser.email,
              emailVerified: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } catch (profileError) {
            console.error(
              "[AuthContext] Minimal profile creation failed:",
              profileError
            );

            // Rollback
            try {
              await deleteUserAccount(firebaseUser);
            } catch (deleteError) {
              console.error(
                "[AuthContext] Failed to delete user during rollback:",
                deleteError
              );
            }

            hideLoading();
            throw new Error("Failed to create user account. Please try again.");
          }

          setTempCloudPassword(password);
          hideLoading();
          return firebaseUser;
        }

        // Full profile setup
        if (profileData.profileImageUri) {
          updateLoading("Uploading profile image...", 2);
          try {
            profileImageUrl = await uploadProfileImage(
              firebaseUser.uid,
              profileData.profileImageUri
            );
          } catch (imgError) {
            console.error("[AuthContext] Image upload failed:", imgError);
            profileImageUrl = null;
          }
        }

        updateLoading("Creating your profile...", 3);

        try {
          await createUserProfile(firebaseUser.uid, {
            email: firebaseUser.email,
            username: profileData.username,
            displayName: profileData.displayName,
            bio: profileData.bio || "",
            profileImageUrl: profileImageUrl,
            emailVerified: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } catch (profileError) {
          console.error(
            "[AuthContext] Profile creation failed, rolling back...",
            profileError
          );

          try {
            await deleteUserAccount(firebaseUser);
          } catch (deleteError) {
            console.error(
              "[AuthContext] Failed to delete user during rollback:",
              deleteError
            );
          }

          hideLoading();
          throw new Error("Failed to create user profile. Please try again.");
        }

        updateLoading("Saving your data...", 4);

        try {
          await saveUser(firebaseUser.uid, firebaseUser.email, {
            username: profileData.username,
            displayName: profileData.displayName,
            bio: profileData.bio || "",
            profileImageUrl: profileImageUrl,
          });
        } catch (dbError) {
          console.error("[AuthContext] Local database save failed:", dbError);
        }

        updateLoading("Sending verification email...", 5);

        try {
          await sendVerificationEmail(firebaseUser);
        } catch (emailError) {
          console.error(
            "[AuthContext] Failed to send verification email:",
            emailError
          );
        }

        setTempCloudPassword(password);
        hideLoading();

        return firebaseUser;
      } catch (err) {
        console.error("[AuthContext] Registration error:", err);
        hideLoading();
        setError(err.message);
        throw err;
      }
      // NOTE: do NOT call setLoading() here — same reason as login().
    },
    [showLoading, updateLoading, hideLoading]
  );

  const checkUsernameAvailability = useCallback(async (username) => {
    try {
      const exists = await checkUsernameExists(username);
      return !exists;
    } catch (error) {
      console.error("[AuthContext] Error checking username:", error);
      throw error;
    }
  }, []);

  const login = useCallback(
    async (email, password) => {
      try {
        setError(null);
        showLoading("Signing in...", { step: 1, totalSteps: 2 });
        const firebaseUser = await loginUser(email, password);

        if (!isMountedRef.current) return;

        updateLoading("Loading your data...", 2);
        setTempCloudPassword(password);

        hideLoading();
        return firebaseUser;
      } catch (err) {
        console.error("[AuthContext] Login error:", err);
        hideLoading();
        setError(err.message);
        throw err;
      }
      // NOTE: do NOT call setLoading() here — loading is managed solely by
      // onAuthChange's finally block (initial startup check). Setting it from
      // login() causes Navigation.js to unmount AuthNavigator mid-login,
      // silently swallowing errors and navigating away from the login screen.
    },
    [showLoading, updateLoading, hideLoading]
  );

  // Google sign-in/sign-up. Deliberately does NOT set tempCloudPassword —
  // there is no password to set. Downstream wallet-creation/restore screens
  // must branch on `hasPasswordProvider` (below) instead of assuming a
  // password is available.
  const loginWithGoogle = useCallback(
    async (idToken) => {
      try {
        setError(null);
        showLoading("Signing in with Google...");
        const { user: firebaseUser, isNewUser } = await signInWithGoogleIdToken(idToken);
        if (!isMountedRef.current) return;
        hideLoading();
        return { user: firebaseUser, isNewUser };
      } catch (err) {
        console.error("[AuthContext] Google login error:", err);
        hideLoading();
        // Surface the friendlier conflict message from GoogleAuthService
        // as-is (it already explains what happened); pass its extra fields
        // (email/pendingCredential/existingMethods) through unchanged so
        // the calling screen can drive the link flow.
        setError(err.message);
        throw err;
      }
    },
    [showLoading, hideLoading],
  );

  // Completes account-linking after the user re-authenticated with their
  // original method following an auth/account-exists-with-different-credential
  // conflict from loginWithGoogle. Attaches Google to the SAME account
  // (same UID, same wallet) rather than creating a duplicate.
  const linkGoogleAccount = useCallback(
    async (pendingCredential) => {
      try {
        setError(null);
        showLoading("Linking Google account...");
        const result = await completeGoogleAccountLink(pendingCredential);
        hideLoading();
        return result;
      } catch (err) {
        console.error("[AuthContext] Google account link error:", err);
        hideLoading();
        setError(err.message);
        throw err;
      }
    },
    [showLoading, hideLoading],
  );

  // The correct branch condition for "does this account have a password
  // that can encrypt the wallet's cloud copy" — NOT "is this a Google
  // user", since a linked account (Google + password) still has one.
  // Always derived from the live Firebase user, never stale.
  const hasPasswordProvider = useMemo(
    () => !!user?.providerData?.some((p) => p.providerId === "password"),
    [user?.providerData],
  );

  const logout = useCallback(async () => {
    try {
      setError(null);
      showLoading("Signing out...");

      await logoutUser();

      if (isMountedRef.current) {
        setUser(null);
        setTempCloudPassword(null);
      }

      hideLoading();
    } catch (err) {
      console.error("[AuthContext] Logout error:", err);
      hideLoading();
      setError(err.message);
      throw err;
    }
  }, [showLoading, hideLoading]);

  const clearTempPassword = useCallback(() => {
    setTempCloudPassword(null);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    try {
      if (!user) {
        throw new Error("No user logged in");
      }

      showLoading("Sending verification email...");

      const { auth } = await import("../services/Firebase");
      const currentUser = auth.currentUser;

      if (!currentUser) {
        hideLoading();
        throw new Error("No Firebase user found");
      }

      await sendVerificationEmail(currentUser);
      hideLoading();

      return true;
    } catch (error) {
      console.error("[AuthContext] Error resending verification email:", error);
      hideLoading();
      throw error;
    }
  }, [user, showLoading, hideLoading]);

  const refreshUserData = useCallback(async () => {
    try {
      if (!user?.uid) return;

      console.log("[AuthContext] Refreshing user data...");
      const userData = await getUserData(user.uid);

      if (userData && isMountedRef.current) {
        updateUserState(userData);
        console.log("[AuthContext] User data refreshed:", userData);
      }
    } catch (error) {
      console.error("[AuthContext] Error refreshing user data:", error);
    }
  }, [user?.uid, updateUserState]);

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    loginWithGoogle,
    linkGoogleAccount,
    hasPasswordProvider,
    isAuthenticated: !!user,
    tempCloudPassword,
    clearTempPassword,
    checkUsernameAvailability,
    resendVerificationEmail,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
