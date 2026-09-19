// services/walletKeyService.js
//
// Issues the per-user Key-Encryption-Key (KEK) that gates a Google-only
// account's cloud wallet backup. This is the server-side half of the
// "Google OAuth secures the wallet" design — see crypto-wallet/services/
// WalletKeyService.js for the client half and contexts/WalletContext.js for
// where the returned value is used (as the passphrase for the Firestore
// cloud copy, in place of a user-chosen "Wallet Backup Password").
//
// How it works: the KEK is deterministically derived from a server-only
// secret (WALLET_KEK_PEPPER) and the user's Firebase UID via HKDF. It is
// NEVER persisted anywhere — re-derived on every request — so there's
// nothing to leak from a database compromise alone. The only way to obtain
// it is to present a Firebase ID token that (a) verifies, and (b) was
// actually minted by a Google sign-in (checked in the controller via the
// token's own `firebase.sign_in_provider` claim, not just "Google is one of
// this account's linked providers"). Without a live, Google-authenticated
// session AND this server's pepper, the Firestore-stored wallet ciphertext
// is unusable — that's the property being traded for the convenience of not
// requiring (or accepting) a user-supplied recovery phrase import.
//
// Honest limitation to keep in mind: this is "Google OAuth + this backend"
// custody, not zero-knowledge self-custody. Anyone with both the pepper and
// database access (e.g. a compromised backend) could derive any user's KEK.
// It is NOT a substitute for keeping WALLET_KEK_PEPPER as tightly guarded as
// a signing key — losing it (or rotating it without a migration) makes every
// existing cloud wallet backup permanently undecryptable.
import { hkdfSync } from 'crypto';
import logger from '../utils/logger.js';

const KEK_LENGTH = 32; // 256-bit — used directly as an AES-256-GCM key client-side
const HKDF_INFO = 'tribe-wallet-kek-v1';

function getPepper() {
  const pepper = process.env.WALLET_KEK_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error(
      'WALLET_KEK_PEPPER is not set (or too short) — generate one with ' +
      '`openssl rand -base64 48` and add it to .env. See docs/GOOGLE_OAUTH_SETUP.md.',
    );
  }
  return pepper;
}

/**
 * Derives the wallet KEK for a given Firebase UID. Pure function of
 * (pepper, uid) — same inputs always produce the same output, and nothing
 * about the derivation is stored.
 * @param {string} uid - Firebase UID
 * @returns {string} base64-encoded 256-bit key
 */
export function deriveWalletKek(uid) {
  if (!uid || typeof uid !== 'string') {
    throw new Error('deriveWalletKek requires a non-empty uid');
  }
  const pepper = getPepper();
  try {
    const derived = hkdfSync('sha256', pepper, uid, HKDF_INFO, KEK_LENGTH);
    return Buffer.from(derived).toString('base64');
  } catch (error) {
    logger.error('Error deriving wallet KEK:', error);
    throw error;
  }
}

export default { deriveWalletKek };
