import express from 'express';
import nftController from '../../../controllers/nftController.js';

const router = express.Router();

router.get('/:chainId/:ownerAddress', nftController.getNFTsForOwner);

export default router;
