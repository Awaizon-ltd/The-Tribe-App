import express from 'express';
import { getChains, getCrossChainQuote, getCrossChainStatus } from '../../../controllers/lifiController.js';

const router = express.Router();

router.get('/chains', getChains);
router.get('/quote',  getCrossChainQuote);
router.get('/status', getCrossChainStatus);

export default router;
