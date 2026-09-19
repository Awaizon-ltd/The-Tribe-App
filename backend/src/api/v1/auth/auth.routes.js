import express from 'express';
import { requireFirebaseAuth } from '../../../middleware/auth/firebase.js';
import walletKeyController from '../../../controllers/walletKeyController.js';

const router = express.Router();

router.get('/wallet-key', requireFirebaseAuth, walletKeyController.getWalletKey);

export default router;
