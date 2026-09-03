import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  // FIX 1: Removed unused `useRef` import
} from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Wallet } from "ethers";
import { useAuth } from "./AuthContext";
import { useChain } from "./ChainContext";
import {
  generateNewMnemonic,
  createAccountFromMnemonic,
  getBalance,
  getAllBalances,
} from "../utils/Wallet";
import {
  encryptWallet,
  unlockWallet,
  validatePassword, // FIX 2: Restored missing import
  SCRYPT_N_CLOUD,
} from "../utils/Encryption";
import {
  // FIX 3: Restored all missing AttemptLimiter imports
  checkLocked,
  recordFailedAttempt,
  clearAttempts,
  formatLockMessage,
} from "../utils/AttemptLimiter";
import {
  saveWallet,
  getWalletsByUserId,
  getPrimaryWallet,
  getUserByUid,
  saveWalletAddressCache,
  getWalletAddressCache,
  clearWalletAddressCache,
} from "../utils/Database";
import {
  saveEncryptedWallet,
  getEncryptedWallet,
  migrateLegacyWallet,
} from "../services/Firebase";
import { createProviderForChain, getProviderSafe } from "../utils/blockchain/Providers";
import { APP_CONFIG } from "../constants/Config";
import { SUPPORTED_CHAINS } from "../constants/Chain";

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within a WalletProvider");
  return context;
};

const ACTIVE_ACCOUNT_KEY = "@nexus_active_account_idx";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a raw privateKey field (object bytes or hex string) → "0x..." string */
const normalisePrivateKey = (raw) => {
  if (typeof raw === "object" && raw !== null) {
    const bytes = Object.values(raw);
    return "0x" + bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  if (typeof raw === "string") {
    return raw.startsWith("0x") ? raw : "0x" + raw;
  }
  throw new Error("Invalid privateKey format");
};

/** Wrap an ethers.Wallet in a Proxy that hides private key material externally */
const makeRestrictedSigner = (rawWallet) => {
  const BLOCKED = new Set(["privateKey", "mnemonic", "signingKey"]);
  return new Proxy(rawWallet, {
    get(target, prop, receiver) {
      if (BLOCKED.has(prop)) return undefined;
      const val = Reflect.get(target, prop, receiver);
      return typeof val === "function" ? val.bind(target) : val;
    },
    has(target, prop) {
      if (BLOCKED.has(prop)) return false;
      return prop in target;
    },
  });
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const WalletProvider = ({ children }) => {
  const { user } = useAuth();
  const { activeChain } = useChain();

  const [wallet, setWallet]                         = useState(null);
  const [wallets, setWallets]                       = useState([]);
  const [isAuthenticated, setIsAuthenticated]       = useState(false);
  const [needsPasscodeSetup, setNeedsPasscodeSetup] = useState(false);
  const [decryptedWalletData, setDecryptedWalletData] = useState(null);

  // ── Multi-account ──────────────────────────────────────────────────────────
  const [accounts, setAccounts]                     = useState([]);
  const [activeAccountIndex, setActiveAccountIndex] = useState(0);

  const [balances, setBalances]               = useState({});
  const [loading, setLoading]                 = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [error, setError]                     = useState(null);
  const [firestoreWalletExists, setFirestoreWalletExists] = useState(false);
  // walletResolved: true once initializeWallet() has run to completion for the current session.
  // checkingWallet is derived — it's true exactly when user is set but init hasn't finished,
  // making it mathematically impossible to have the transient "user set, wallet unknown" state
  // that previously caused the race condition / WalletSetup flash on startup.
  const [walletResolved, setWalletResolved]     = useState(false);
  const checkingWallet = useMemo(() => !!user && !walletResolved, [user, walletResolved]);
  const [walletCheckError, setWalletCheckError] = useState(false);
  const [hasLocalPasscode, setHasLocalPasscode] = useState(false);
  const [address, setAddress]                 = useState(null);

  // Prevents concurrent initializeWallet() invocations from racing.
  const initializingRef = React.useRef(false);

  const provider = useMemo(() => {
    if (!activeChain?.id || !activeChain?.rpcUrl) return null;
    try { return createProviderForChain(activeChain); }
    catch (err) { console.error("[WalletContext] provider error:", err); return null; }
  }, [activeChain?.id, activeChain?.rpcUrl]);

  // Depend only on the UID so profile-only Firestore updates (which create a new
  // user object reference every snapshot) don't re-trigger initializeWallet().
  useEffect(() => {
    if (user) initializeWallet();
    else resetWalletState();
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (wallet?.address) {
      loadAllBalances();
      setAddress(wallet.address);
    }
  }, [wallet?.address]);

  // ── Initialisation ─────────────────────────────────────────────────────────

  // FIX 4: Restored the smart fast-path from v1 — if a local wallet exists we
  // unblock the UI immediately and check Firestore in the background. Without
  // this the app stalls on every launch waiting for a network round-trip.
  const initializeWallet = async () => {
    // Drop concurrent invocations; only one init at a time is meaningful.
    if (initializingRef.current) return;
    initializingRef.current = true;

    setWalletResolved(false); // signal init is in progress (checkingWallet becomes true)
    setWalletCheckError(false);
    let localWalletFound = false;
    try {
      // Fast path: read address from SQLite cache (no SecureStore, no crypto).
      // This pre-populates the wallet state so any UI that renders before the
      // full init completes already has an address to display.
      if (user) {
        try {
          const cached = await getWalletAddressCache(user.uid);
          if (cached?.address) {
            const cachedAccounts = cached.accounts?.length
              ? cached.accounts
              : [{ index: 0, address: cached.address, name: "Account 1" }];
            setWallet({ address: cached.address, name: cached.name || "My Wallet" });
            setAccounts(cachedAccounts);
            setActiveAccountIndex(cached.activeIndex ?? 0);
            setAddress(cached.address);
          }
        } catch (cacheErr) {
          console.warn("[WalletContext] SQLite cache read failed (non-fatal):", cacheErr);
        }
      }

      localWalletFound = await loadWalletMetadataFromSecureStore();
      await loadWalletMetadataFromDatabase();

      if (localWalletFound) {
        // Local wallet found — unblock the UI now; Firebase check is non-critical.
        setWalletResolved(true);
        checkFirestoreWallet().catch(() => {});
      } else {
        // No local wallet — must know if Firestore has one before routing.
        const firestoreOk = await checkFirestoreWallet();
        if (!firestoreOk) {
          // Firestore unreachable: we can't confirm wallet is absent, so don't
          // route the user to WalletSetup (they could accidentally overwrite an
          // existing cloud wallet). Signal the error and wait for a retry.
          setWalletCheckError(true);
        }
        setWalletResolved(true);
      }
    } catch (err) {
      console.error("[WalletContext] init error:", err);
      // Unexpected error: if no local wallet was found, don't route to WalletSetup
      // — we can't be certain the user has no wallet at all.
      if (!localWalletFound) setWalletCheckError(true);
      setWalletResolved(true);
    } finally {
      initializingRef.current = false;
    }
  };

  // FIX 5: Restored boolean return value so initializeWallet's fast-path works.
  const loadWalletMetadataFromSecureStore = async () => {
    try {
      const localWalletJson = await SecureStore.getItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET);
      if (!localWalletJson) { setHasLocalPasscode(false); return false; } // FIX 5a: return false

      const localWallet = JSON.parse(localWalletJson);
      const primaryAddress = localWallet.address;

      let storedAccounts = localWallet.accounts;
      if (!Array.isArray(storedAccounts) || storedAccounts.length === 0) {
        storedAccounts = [{ index: 0, address: primaryAddress, name: "Account 1" }];
        await SecureStore.setItemAsync(
          APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET,
          JSON.stringify({ ...localWallet, accounts: storedAccounts }),
        );
      }
      setAccounts(storedAccounts);

      const storedIdx = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
      const idx = storedIdx != null ? parseInt(storedIdx, 10) : 0;
      const safeIdx = storedAccounts.find((a) => a.index === idx) ? idx : 0;
      setActiveAccountIndex(safeIdx);

      const activeAccount = storedAccounts.find((a) => a.index === safeIdx) || storedAccounts[0];
      if (!activeAccount?.address) {
        console.error("[WalletContext] Stored account has no address — wallet data corrupt");
        return false;
      }
      const walletName = localWallet.name || "My Wallet";
      setWallet({ address: activeAccount.address, name: walletName });
      setHasLocalPasscode(!!(localWallet.encrypted && localWallet.salt));

      // Keep the SQLite cache in sync so future startups can read the address
      // without touching SecureStore.
      if (user) {
        saveWalletAddressCache(user.uid, activeAccount.address, walletName, storedAccounts, safeIdx)
          .catch((e) => console.warn("[WalletContext] cache write failed:", e));
      }

      return true; // FIX 5b: return true so fast-path triggers
    } catch (err) {
      console.error("[WalletContext] SecureStore load error:", err);
      setHasLocalPasscode(false);
      return false; // FIX 5c: always return a boolean
    }
  };

  const loadWalletMetadataFromDatabase = async () => {
    if (!user) return;
    try {
      const dbUser = await getUserByUid(user.uid);
      if (!dbUser) return;
      const primaryWallet = await getPrimaryWallet(dbUser.id);
      if (primaryWallet) {
        setWallet((prev) => ({
          ...prev,
          id: primaryWallet.id,
          name: primaryWallet.name,
          address: prev?.address || primaryWallet.address,
        }));
      }
      const userWallets = await getWalletsByUserId(dbUser.id);
      setWallets(userWallets);
    } catch (err) {
      console.error("[WalletContext] DB load error:", err);
    }
  };

  const resetWalletState = () => {
    initializingRef.current = false; // Allow a fresh init on next login
    setWallet(null); setWallets([]); setAccounts([]); setActiveAccountIndex(0);
    setIsAuthenticated(false); setNeedsPasscodeSetup(false);
    setDecryptedWalletData(null); setBalances({}); setFirestoreWalletExists(false);
    setHasLocalPasscode(false); setWalletResolved(false); setWalletCheckError(false);
  };

  // Returns true if the check completed (regardless of whether a wallet was found),
  // false if the check itself failed (network error, Firestore unavailable, etc.).
  // Callers must not treat a false return as "no wallet" — it means "unknown".
  const checkFirestoreWallet = async () => {
    if (!user) return true; // no user → definitively no wallet, not an error
    try {
      const encrypted = await getEncryptedWallet(user.uid);
      setFirestoreWalletExists(!!encrypted);
      return true;
    } catch (err) {
      console.error("[WalletContext] Firestore check error:", err);
      // Do NOT set firestoreWalletExists=false here — a network/Firestore error
      // does not mean the wallet is absent. Leave the previous value intact.
      return false;
    }
  };

  // ── Authentication ─────────────────────────────────────────────────────────

  // FIX 6: Restored checkLocked / recordFailedAttempt / clearAttempts guards.
  // Without these, unlimited passcode attempts are allowed — a serious security hole.
  const authenticateWithPasscode = async (passcode) => {
    const lockStatus = await checkLocked("passcode");
    if (lockStatus.locked) {
      throw new Error(formatLockMessage(lockStatus.remainingMs));
    }

    try {
      const localWalletJson = await SecureStore.getItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET);
      if (!localWalletJson) throw new Error("No local wallet found");
      const localWallet = JSON.parse(localWalletJson);
      const result = await unlockWallet(localWallet, passcode);

      if (result.needsMigration) {
        await SecureStore.setItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET, JSON.stringify({
          address: localWallet.address, name: localWallet.name,
          accounts: localWallet.accounts,
          ...result.migratedEncryption,
        }));
      }
      await clearAttempts("passcode");
      setIsAuthenticated(true);
      setNeedsPasscodeSetup(false);
      return true;
    } catch {
      await recordFailedAttempt("passcode");
      setIsAuthenticated(false);
      throw new Error("Invalid passcode");
    }
  };

  // ── Signer creation ────────────────────────────────────────────────────────

  // FIX 7: Restored checkLocked / recordFailedAttempt / clearAttempts guards here too.
  // `chainOverride` lets a caller sign against a chain other than the wallet's
  // currently active one — needed for cross-chain LI.FI swaps initiated from
  // Community mode, which stays pinned to Robinhood Chain (activeChain) while
  // the user "funds in" from a different source chain. Defaults to
  // activeChain, so every existing call site is unaffected.
  const createSignerForTransaction = async (passcode, chainOverride) => {
    const lockStatus = await checkLocked("passcode");
    if (lockStatus.locked) {
      throw new Error(formatLockMessage(lockStatus.remainingMs));
    }

    try {
      const localWalletJson = await SecureStore.getItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET);
      if (!localWalletJson) throw new Error("No local wallet found");

      const localWallet = JSON.parse(localWalletJson);
      const result = await unlockWallet(localWallet, passcode);
      const decryptedData = result.walletData;

      if (result.needsMigration) {
        await SecureStore.setItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET, JSON.stringify({
          address: localWallet.address, name: localWallet.name,
          accounts: localWallet.accounts,
          ...result.migratedEncryption,
        }));
      }

      let privateKeyHex;
      if (activeAccountIndex === 0) {
        privateKeyHex = normalisePrivateKey(decryptedData.privateKey);
      } else {
        if (!decryptedData.mnemonic) throw new Error("Mnemonic not available for HD derivation");
        const derived = createAccountFromMnemonic(decryptedData.mnemonic, activeAccountIndex);
        privateKeyHex = derived.privateKey;
      }

      const signingChain = chainOverride ?? activeChain;
      if (!signingChain?.id || !signingChain?.rpcUrl) throw new Error("No active chain configured.");
      const safeProvider = await getProviderSafe(signingChain);
      const rawWallet = new Wallet(privateKeyHex, safeProvider);
      privateKeyHex = null; // zero out key material from local scope

      await clearAttempts("passcode");
      return makeRestrictedSigner(rawWallet);
    } catch (err) {
      await recordFailedAttempt("passcode");
      console.error("[WalletContext] createSignerForTransaction error:", err.message);
      throw new Error("Failed to create signer: " + err.message);
    }
  };

  // ── Multi-account ──────────────────────────────────────────────────────────

  const switchAccount = useCallback(async (index) => {
    const account = accounts.find((a) => a.index === index);
    if (!account) throw new Error("Account not found");

    setActiveAccountIndex(index);
    setAddress(account.address);
    setWallet((prev) => ({ ...prev, address: account.address }));
    await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, String(index));

    loadAllBalances(account.address);
  }, [accounts]);

  const addAccount = useCallback(async (passcode, accountName) => {
    const localWalletJson = await SecureStore.getItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET);
    if (!localWalletJson) throw new Error("No local wallet found");

    const localWallet = JSON.parse(localWalletJson);
    const result = await unlockWallet(localWallet, passcode);
    if (!result.walletData.mnemonic) throw new Error("Mnemonic not available — cannot add account");

    const newIndex = accounts.length;
    const derived  = createAccountFromMnemonic(result.walletData.mnemonic, newIndex);

    const newAccount = {
      index:   newIndex,
      address: derived.address,
      name:    accountName || `Account ${newIndex + 1}`,
    };
    const updatedAccounts = [...accounts, newAccount];

    await SecureStore.setItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET, JSON.stringify({
      ...localWallet,
      accounts: updatedAccounts,
    }));
    setAccounts(updatedAccounts);
    return newAccount;
  }, [accounts]);

  const renameAccount = useCallback(async (index, newName) => {
    const localWalletJson = await SecureStore.getItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET);
    if (!localWalletJson) return;
    const localWallet = JSON.parse(localWalletJson);

    const updatedAccounts = accounts.map((a) =>
      a.index === index ? { ...a, name: newName } : a,
    );
    await SecureStore.setItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET, JSON.stringify({
      ...localWallet, accounts: updatedAccounts,
    }));
    setAccounts(updatedAccounts);
  }, [accounts]);

  // ── Wallet lifecycle ───────────────────────────────────────────────────────

  const lockWallet = () => {
    setIsAuthenticated(false); setNeedsPasscodeSetup(false); setDecryptedWalletData(null);
  };

  const loadAllBalances = useCallback(async (overrideAddress) => {
    const addr = overrideAddress || wallet?.address;
    if (!addr) return;
    try {
      setLoadingBalances(true);
      const allBalances = await getAllBalances(addr);
      setBalances(allBalances);
    } catch (err) {
      console.error("[WalletContext] loadAllBalances error:", err);
    } finally {
      setLoadingBalances(false);
    }
  }, [wallet?.address]);

  // FIX 8: activeChain?.id — optional chaining applied consistently so this
  // doesn't crash when activeChain is null/undefined during chain switches.
  const refreshBalance = useCallback(async (chainId = null) => {
    if (!wallet?.address) return;
    try {
      const targetChainId = chainId || activeChain?.id;
      if (!targetChainId) return;
      const chain = Object.values(SUPPORTED_CHAINS).find((c) => c.id === targetChainId);
      if (!chain) return;
      const balance = await getBalance(wallet.address, chain);
      setBalances((prev) => ({ ...prev, [chain.id]: balance }));
    } catch (err) {
      console.error("[WalletContext] refreshBalance error:", err);
    }
  }, [wallet?.address, activeChain?.id]);

  const refreshAllBalances = useCallback(async () => {
    await loadAllBalances();
  }, [loadAllBalances]);

  // ── Wallet creation / import ───────────────────────────────────────────────

  // FIX 9: Restored account.address as the AAD (Additional Authenticated Data)
  // argument to encryptWallet for cloud encryption in both createWallet and
  // importWallet. This cryptographically binds the address to the ciphertext so
  // any tampering with the address field in Firestore is caught at decryption time.
  const createWallet = async (cloudPassword, localPasscode, walletName = "Main Wallet") => {
    try {
      setLoading(true); setError(null);
      const mnemonic = generateNewMnemonic();
      const account  = createAccountFromMnemonic(mnemonic, 0);
      const walletData = {
        mnemonic, privateKey: account.privateKey,
        publicKey: account.publicKey, createdAt: new Date().toISOString(),
      };

      const cloudEncryption = await encryptWallet(walletData, cloudPassword, account.address, SCRYPT_N_CLOUD); // FIX 9a
      const localEncryption = await encryptWallet(walletData, localPasscode, account.address);

      const dbUser = await getUserByUid(user.uid);
      let walletId = null;
      if (dbUser) {
        walletId = await saveWallet(dbUser.id, walletName, account.address, cloudEncryption.encrypted, cloudEncryption.salt, true);
      } else {
        console.warn("[WalletContext] createWallet: user not in local DB yet, skipping SQLite save");
      }

      await saveEncryptedWallet(user.uid, {
        address: account.address, encrypted: cloudEncryption.encrypted,
        salt: cloudEncryption.salt, iv: cloudEncryption.iv,
        authTag: cloudEncryption.authTag, version: cloudEncryption.version,
        scryptN: cloudEncryption.scryptN,
      });

      const defaultAccounts = [{ index: 0, address: account.address, name: "Account 1" }];
      await SecureStore.setItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET, JSON.stringify({
        address: account.address, name: walletName,
        accounts: defaultAccounts,
        encrypted: localEncryption.encrypted, salt: localEncryption.salt,
        iv: localEncryption.iv, authTag: localEncryption.authTag,
        version: localEncryption.version, scryptN: localEncryption.scryptN,
      }));

      setAccounts(defaultAccounts);
      setActiveAccountIndex(0);
      setWallet({ id: walletId, name: walletName, address: account.address });
      setHasLocalPasscode(true); setFirestoreWalletExists(true); setIsAuthenticated(true);

      // Cache the address so subsequent startups skip SecureStore for the address lookup.
      saveWalletAddressCache(user.uid, account.address, walletName, defaultAccounts, 0)
        .catch((e) => console.warn("[WalletContext] cache write failed:", e));

      return { wallet: { id: walletId, name: walletName, address: account.address }, mnemonic };
    } catch (err) {
      console.error("createWallet error:", err);
      setError(err.message); throw err;
    } finally {
      setLoading(false);
    }
  };

  const importWallet = async (mnemonic, cloudPassword, localPasscode, walletName = "Imported Wallet") => {
    try {
      setLoading(true); setError(null);
      const account    = createAccountFromMnemonic(mnemonic, 0);
      const walletData = {
        mnemonic, privateKey: account.privateKey,
        publicKey: account.publicKey, imported: true,
        createdAt: new Date().toISOString(),
      };

      const cloudEncryption = await encryptWallet(walletData, cloudPassword, account.address, SCRYPT_N_CLOUD); // FIX 9b
      const localEncryption = await encryptWallet(walletData, localPasscode, account.address);

      const dbUser = await getUserByUid(user.uid);
      let walletId = null;
      if (dbUser) {
        walletId = await saveWallet(dbUser.id, walletName, account.address, cloudEncryption.encrypted, cloudEncryption.salt, wallets.length === 0);
      } else {
        console.warn("[WalletContext] importWallet: user not in local DB yet, skipping SQLite save");
      }

      await saveEncryptedWallet(user.uid, {
        address: account.address, encrypted: cloudEncryption.encrypted,
        salt: cloudEncryption.salt, iv: cloudEncryption.iv,
        authTag: cloudEncryption.authTag, version: cloudEncryption.version,
        scryptN: cloudEncryption.scryptN,
      });

      const defaultAccounts = [{ index: 0, address: account.address, name: "Account 1" }];
      await SecureStore.setItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET, JSON.stringify({
        address: account.address, name: walletName,
        accounts: defaultAccounts,
        encrypted: localEncryption.encrypted, salt: localEncryption.salt,
        iv: localEncryption.iv, authTag: localEncryption.authTag,
        version: localEncryption.version, scryptN: localEncryption.scryptN,
      }));

      setAccounts(defaultAccounts); setActiveAccountIndex(0);
      setHasLocalPasscode(true); setFirestoreWalletExists(true); setIsAuthenticated(true);

      // Cache the address so subsequent startups skip SecureStore for the address lookup.
      saveWalletAddressCache(user.uid, account.address, walletName, defaultAccounts, 0)
        .catch((e) => console.warn("[WalletContext] cache write failed:", e));

      await loadWalletMetadataFromSecureStore();
      await loadWalletMetadataFromDatabase();
      return account.address;
    } catch (err) {
      console.error("importWallet error:", err);
      setError(err.message); throw err;
    } finally {
      setLoading(false);
    }
  };

  // ── Firestore wallet unlock ────────────────────────────────────────────────

  // FIX 10: Restored checkLocked / recordFailedAttempt / clearAttempts brute-force
  // protection. Also fixed the migration block — v2 used result.migratedEncryption
  // which doesn't exist in this flow; the correct approach (matching v1) is to
  // re-encrypt from scratch using encryptWallet with the address as AAD.
  const unlockWalletFromFirestore = async (cloudPassword) => {
    if (!user) throw new Error("No user logged in");

    const lockStatus = await checkLocked("cloud_unlock");
    if (lockStatus.locked) {
      throw new Error(formatLockMessage(lockStatus.remainingMs));
    }

    try {
      const cloudWallet = await getEncryptedWallet(user.uid);
      if (!cloudWallet) throw new Error("No cloud wallet found");

      // CLOUD cost profile — this payload was (or will be) scrypt-derived at
      // the higher N, matching how createWallet/importWallet encrypt it.
      const result = await unlockWallet(cloudWallet, cloudPassword, SCRYPT_N_CLOUD);
      const decryptedData = result.walletData;

      if (result.needsMigration) {
        // Re-encrypt with address as AAD (V3 format) so the address is
        // cryptographically bound to the ciphertext going forward.
        const latestEncryption = await encryptWallet(
          decryptedData,
          cloudPassword,
          cloudWallet.address, // AAD — same as v1
          SCRYPT_N_CLOUD,
        );
        await saveEncryptedWallet(user.uid, {
          address: cloudWallet.address,
          encrypted: latestEncryption.encrypted,
          salt: latestEncryption.salt,
          iv: latestEncryption.iv,
          authTag: latestEncryption.authTag,
          version: latestEncryption.version,
          scryptN: latestEncryption.scryptN,
        });

        if (cloudWallet.isLegacy) {
          try { await migrateLegacyWallet(user.uid); } catch {}
        }
      }

      await clearAttempts("cloud_unlock");

      const dbUser = await getUserByUid(user.uid);
      let walletName = "Cloud Wallet";
      if (dbUser) {
        const pw = await getPrimaryWallet(dbUser.id);
        if (pw) walletName = pw.name;
      }

      setWallet({ id: wallet?.id || "cloud", name: walletName, address: cloudWallet.address });
      setIsAuthenticated(true);
      setDecryptedWalletData(decryptedData);
      setNeedsPasscodeSetup(true);
      setHasLocalPasscode(false);

      return decryptedData;
    } catch (err) {
      await recordFailedAttempt("cloud_unlock");
      console.error("[WalletContext] Firestore unlock error:", err);
      throw new Error("Invalid password");
    }
  };

  const setupLocalPasscode = async (passcode, walletDataArg) => {
    try {
      const encryption = await encryptWallet(walletDataArg, passcode, wallet.address);
      const existing   = await SecureStore.getItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET);
      const parsed     = existing ? JSON.parse(existing) : {};
      await SecureStore.setItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET, JSON.stringify({
        ...parsed,
        address: wallet.address, name: wallet.name,
        accounts: parsed.accounts || [{ index: 0, address: wallet.address, name: "Account 1" }],
        encrypted: encryption.encrypted, salt: encryption.salt,
        iv: encryption.iv, authTag: encryption.authTag, version: encryption.version,
        scryptN: encryption.scryptN,
      }));

      // Ensure the wallet row exists in SQLite (the cloud-unlock path skips saveWallet).
      try {
        const dbUser = await getUserByUid(user.uid);
        if (dbUser) {
          await saveWallet(dbUser.id, wallet.name, wallet.address, encryption.encrypted, encryption.salt, true);
        }
      } catch (dbErr) {
        console.warn("[WalletContext] setupLocalPasscode: SQLite save failed (non-fatal):", dbErr);
      }

      setHasLocalPasscode(true); setNeedsPasscodeSetup(false); setDecryptedWalletData(null);
      return true;
    } catch (err) {
      console.error("setupLocalPasscode error:", err); throw err;
    }
  };

  const skipPasscodeSetup = () => { setNeedsPasscodeSetup(false); setDecryptedWalletData(null); };

  const clearLocalWallet = async () => {
    try {
      await SecureStore.deleteItemAsync(APP_CONFIG.STORAGE_KEYS.LOCAL_WALLET);
      await AsyncStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      if (user) {
        await clearWalletAddressCache(user.uid).catch(() => {});
      }
      setHasLocalPasscode(false); setIsAuthenticated(false);
      setNeedsPasscodeSetup(false); setDecryptedWalletData(null);
      setAccounts([]); setActiveAccountIndex(0);
      return true;
    } catch (err) {
      console.error("clearLocalWallet error:", err); throw err;
    }
  };

  const getBalanceForChain = useCallback((chainId) => {
    const chain = Object.values(SUPPORTED_CHAINS).find((c) => c.id === chainId);
    return balances[chainId] || {
      wei: "0", formatted: "0",
      symbol: chain?.symbol || "ETH", chainId, chainName: chain?.name || "Unknown",
    };
  }, [balances]);

  // FIX 11: activeChain?.id — guard against null activeChain
  const getActiveChainBalance = useCallback(
    () => getBalanceForChain(activeChain?.id),
    [activeChain?.id, getBalanceForChain],
  );

  const value = {
    wallet, wallets, isAuthenticated, needsPasscodeSetup, decryptedWalletData, address, provider,
    selectedChain: activeChain, balances, loading, loadingBalances, error,

    // Multi-account
    accounts, activeAccountIndex, switchAccount, addAccount, renameAccount,

    createWallet, importWallet, clearLocalWallet,
    authenticateWithPasscode, createSignerForTransaction, lockWallet,
    unlockWalletFromFirestore, setupLocalPasscode, skipPasscodeSetup,
    refreshBalance, refreshAllBalances, getBalanceForChain, getActiveChainBalance,

    hasWallet: !!wallet, firestoreWalletExists, checkingWallet, hasLocalPasscode,
    walletCheckError, retryWalletCheck: initializeWallet,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};