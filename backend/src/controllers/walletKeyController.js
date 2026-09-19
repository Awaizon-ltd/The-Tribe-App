// controllers/walletKeyController.js
import { deriveWalletKek } from '../services/walletKeyService.js';
import logger from '../utils/logger.js';

class WalletKeyController {
  /**
   * GET /auth/wallet-key
   * Requires requireFirebaseAuth (sets req.uid, req.decodedToken). Only
   * issues the KEK when the presented ID token was itself minted by a
   * Google sign-in — checked via the token's own `firebase.sign_in_provider`
   * claim, not merely "this account has Google linked somewhere" — so a
   * stolen password-session token can't be used to pull the Google-gated key.
   */
  async getWalletKey(req, res) {
    try {
      const provider = req.decodedToken?.firebase?.sign_in_provider;
      if (provider !== 'google.com') {
        return res.status(403).json({
          success: false,
          error: 'This key is only issued to sessions authenticated via Google Sign-In.',
        });
      }

      const kek = deriveWalletKek(req.uid);
      res.set('Cache-Control', 'no-store');
      return res.json({ success: true, kek });
    } catch (error) {
      logger.error('Error issuing wallet key:', error);
      return res.status(500).json({ success: false, error: 'Failed to issue wallet key' });
    }
  }
}

export default new WalletKeyController();
