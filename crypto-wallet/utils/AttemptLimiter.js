import * as SecureStore from "expo-secure-store";

const STORE_PREFIX = "awarizon_attempts_";

// Lockout schedule: { minAttempts, lockMs }
// Each tier supersedes the previous — last matching tier wins
const BACKOFF_TIERS = [
  { minAttempts: 3, lockMs: 30 * 1000 },           // 30 seconds
  { minAttempts: 5, lockMs: 5 * 60 * 1000 },        // 5 minutes
  { minAttempts: 7, lockMs: 60 * 60 * 1000 },       // 1 hour
  { minAttempts: 10, lockMs: 24 * 60 * 60 * 1000 }, // 24 hours
];

const storeKey = (key) => STORE_PREFIX + key;

export const checkLocked = async (key) => {
  try {
    const raw = await SecureStore.getItemAsync(storeKey(key));
    if (!raw) return { locked: false, attempts: 0, remainingMs: 0 };
    const { attempts, lockedUntil } = JSON.parse(raw);
    const now = Date.now();
    if (lockedUntil && now < lockedUntil) {
      return { locked: true, attempts, remainingMs: lockedUntil - now };
    }
    return { locked: false, attempts: attempts || 0, remainingMs: 0 };
  } catch {
    return { locked: false, attempts: 0, remainingMs: 0 };
  }
};

export const recordFailedAttempt = async (key) => {
  try {
    const raw = await SecureStore.getItemAsync(storeKey(key));
    const prev = raw ? JSON.parse(raw) : { attempts: 0 };
    const attempts = (prev.attempts || 0) + 1;
    const now = Date.now();
    let lockedUntil = null;
    for (const tier of BACKOFF_TIERS) {
      if (attempts >= tier.minAttempts) lockedUntil = now + tier.lockMs;
    }
    await SecureStore.setItemAsync(storeKey(key), JSON.stringify({ attempts, lockedUntil }));
    return { attempts, locked: !!lockedUntil, lockedUntil };
  } catch {
    return { attempts: 1, locked: false, lockedUntil: null };
  }
};

export const clearAttempts = async (key) => {
  try {
    await SecureStore.deleteItemAsync(storeKey(key));
  } catch {}
};

export const formatLockMessage = (remainingMs) => {
  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds < 60) return `Too many attempts. Try again in ${seconds} seconds.`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `Too many attempts. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`;
  const hours = Math.ceil(minutes / 60);
  return `Too many attempts. Try again in ${hours} hour${hours > 1 ? "s" : ""}.`;
};
