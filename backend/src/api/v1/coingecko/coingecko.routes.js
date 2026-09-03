import express from 'express';
import {
  getNativePrices,
  getSimplePrice,
  getTrending,
  getSearchCoins,
  getGainers,
  getTopByChain,
  getCoinDetail,
  getMarkets,
} from '../../../controllers/coingeckoController.js';

const router = express.Router();

router.get('/native-prices', getNativePrices);
router.get('/simple-price',  getSimplePrice);
router.get('/trending',      getTrending);
router.get('/search',        getSearchCoins);
router.get('/gainers',       getGainers);
router.get('/top-by-chain',  getTopByChain);
router.get('/coin-detail',   getCoinDetail);
router.get('/markets',       getMarkets);

export default router;
