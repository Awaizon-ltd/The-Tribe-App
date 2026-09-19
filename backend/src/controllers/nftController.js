// controllers/nftController.js
import { ethers } from 'ethers';
import nftIndexerService from '../services/nftIndexerService.js';
import logger from '../utils/logger.js';

class NftController {
  /**
   * GET /nfts/:chainId/:ownerAddress
   * Serves indexed NFT ownership for chains Alchemy's NFT API doesn't cover
   * (Robinhood Chain / Testnet). Clients on other chains should keep using
   * Alchemy directly — this endpoint returns 404 for chains not indexed here.
   */
  async getNFTsForOwner(req, res) {
    try {
      const chainId = parseInt(req.params.chainId);
      const { ownerAddress } = req.params;

      if (!Number.isFinite(chainId)) {
        return res.status(400).json({ success: false, error: 'Invalid chainId' });
      }
      if (!ownerAddress || !ethers.isAddress(ownerAddress)) {
        return res.status(400).json({ success: false, error: 'Invalid owner address' });
      }
      if (!nftIndexerService.isIndexed(chainId)) {
        return res.status(404).json({
          success: false,
          error: `Chain ${chainId} is not indexed here — use Alchemy's NFT API for this chain`,
        });
      }

      const limit = Math.min(parseInt(req.query.limit) || 100, 500);
      const resolveMetadata = req.query.resolveMetadata !== 'false';

      const result = await nftIndexerService.getNFTsForOwner(chainId, ownerAddress, { limit, resolveMetadata });
      return res.json({ success: true, chainId, ownerAddress, ...result });
    } catch (error) {
      logger.error('Error in getNFTsForOwner:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch NFTs' });
    }
  }
}

export default new NftController();
