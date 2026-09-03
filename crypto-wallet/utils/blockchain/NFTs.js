// utils/nfts.js
import { ethers } from "ethers";
import { createWalletForChain, validateChain } from "./Providers";
import { getAlchemyInstance, ALCHEMY_NETWORK_MAP } from "./Alchemy";
import { SUPPORTED_CHAINS } from "../../constants/Chain";
import { withCache, nftCache } from "./NftsCache";

// ============================================================================
// CHAIN SUPPORT CONFIGURATION
// ============================================================================

// Base mainnet (8453) is fully supported by Alchemy NFT APIs.


// ============================================================================
// MAIN NFT FUNCTIONS (with fallback support)
// ============================================================================

/**
 * Get all NFTs owned by an address on a specific chain
 * CACHED for 5 minutes
 */
export const getNFTsForOwner = async (ownerAddress, chain, options = {}) => {
  const cacheKey = nftCache.generateKey(
    "getNFTsForOwner",
    ownerAddress,
    chain.id,
    options,
  );

  return withCache(cacheKey, async () => {
    try {
      validateChain(chain, "getNFTsForOwner");

      const alchemy = getAlchemyInstance(chain.id);
      const nfts = await alchemy.nft.getNftsForOwner(ownerAddress, {
        excludeFilters: options.excludeSpam ? ["SPAM"] : [],
        pageSize: options.pageSize || 100,
        ...options,
      });

      return {
        nfts: nfts.ownedNfts.map((nft) => ({
          ...nft,
          chainId: chain.id,
          chainName: chain.name,
        })),
        totalCount: nfts.totalCount,
        pageKey: nfts.pageKey,
      };
    } catch (error) {
      console.error("[getNFTsForOwner] Error:", error);
      throw error;
    }
  });
};

/**
 * Get all NFTs owned by an address across the provided chains.
 * @param {string}   ownerAddress
 * @param {object[]} [chains]  Explicit chain list. Defaults to all non-testnet chains
 *                             in SUPPORTED_CHAINS. Pass a filtered list to enforce
 *                             mode restrictions (e.g. Base-only in community mode).
 * @param {object}   [options]
 */
export const getAllNFTsAcrossChains = async (ownerAddress, chains, options = {}) => {
  // Backwards-compat: if second arg is a plain options object (not an array), treat it as options
  if (chains && !Array.isArray(chains)) {
    options = chains;
    chains = null;
  }

  // Default to all mainnet chains when none supplied
  const targetChains = chains?.length
    ? chains
    : Object.values(SUPPORTED_CHAINS).filter((c) => !c.testnet);

  const cacheKey = nftCache.generateKey(
    "getAllNFTsAcrossChains",
    ownerAddress,
    targetChains.map((c) => c.id).sort().join(','),
    options,
  );

  return withCache(cacheKey, async () => {
    try {
      console.log("[getAllNFTsAcrossChains] Fetching NFTs for:", ownerAddress);

      const allChains = targetChains;

      console.log(
        "[getAllNFTsAcrossChains] Checking chains:",
        allChains.map((c) => c.name),
      );

      const nftPromises = allChains.map(async (chain) => {
        try {
          console.log(
            `[getAllNFTsAcrossChains] Fetching from ${chain.name}...`,
          );

          const result = await getNFTsForOwner(ownerAddress, chain, options);

          console.log(
            `[getAllNFTsAcrossChains] ${chain.name}: Found ${result.totalCount} NFTs`,
          );

          return {
            chain: {
              id: chain.id,
              name: chain.name,
              symbol: chain.symbol,
              icon: chain.icon,
              explorer: chain.explorer,
            },
            nfts: result.nfts,
            totalCount: result.totalCount,
            pageKey: result.pageKey,
          };
        } catch (error) {
          console.error(
            `[getAllNFTsAcrossChains] Error fetching from ${chain.name}:`,
            error,
          );
          return {
            chain: {
              id: chain.id,
              name: chain.name,
              symbol: chain.symbol,
              icon: chain.icon,
              explorer: chain.explorer,
            },
            nfts: [],
            totalCount: 0,
            error: error.message,
          };
        }
      });

      const results = await Promise.all(nftPromises);
      const allNFTs = results.flatMap((result) => result.nfts);
      const totalCount = results.reduce(
        (sum, result) => sum + result.totalCount,
        0,
      );

      console.log(
        "[getAllNFTsAcrossChains] Total NFTs across all chains:",
        totalCount,
      );

      return {
        nfts: allNFTs,
        totalCount,
        byChain: results,
        chains: allChains.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
        })),
      };
    } catch (error) {
      console.error("[getAllNFTsAcrossChains] Fatal error:", error);
      throw error;
    }
  });
};

/**
 * Get NFTs with pagination across all chains
 * CACHED for 5 minutes
 */
export const getAllNFTsAcrossChainsWithPagination = async (
  ownerAddress,
  pageSize = 10,
) => {
  const cacheKey = nftCache.generateKey(
    "getAllNFTsAcrossChainsWithPagination",
    ownerAddress,
    pageSize,
  );

  return withCache(cacheKey, async () => {
    try {
      console.log(
        "[getAllNFTsAcrossChainsWithPagination] Fetching NFTs for:",
        ownerAddress,
      );

      const allChains = Object.values(SUPPORTED_CHAINS);

      const nftPromises = allChains.map(async (chain) => {
        try {
          const result = await getNFTsForOwner(ownerAddress, chain, {
            excludeSpam: true,
            pageSize,
          });

          return {
            chain: {
              id: chain.id,
              name: chain.name,
              symbol: chain.symbol,
              icon: chain.icon,
              explorer: chain.explorer,
            },
            nfts: result.nfts,
            totalCount: result.totalCount,
            pageKey: result.pageKey,
          };
        } catch (error) {
          console.error(
            `[getAllNFTsAcrossChainsWithPagination] Error for ${chain.name}:`,
            error,
          );
          return {
            chain: {
              id: chain.id,
              name: chain.name,
              symbol: chain.symbol,
              icon: chain.icon,
              explorer: chain.explorer,
            },
            nfts: [],
            totalCount: 0,
            error: error.message,
          };
        }
      });

      const results = await Promise.all(nftPromises);
      const allNFTs = results.flatMap((result) => result.nfts);
      const totalCount = results.reduce(
        (sum, result) => sum + result.totalCount,
        0,
      );

      return {
        nfts: allNFTs,
        totalCount,
        byChain: results,
        hasMore: results.some((result) => result.pageKey),
      };
    } catch (error) {
      console.error("[getAllNFTsAcrossChainsWithPagination] Error:", error);
      throw error;
    }
  });
};

/**
 * Get NFT metadata
 * CACHED for 5 minutes
 */
export const getNFTMetadata = async (contractAddress, tokenId, chain) => {
  const cacheKey = nftCache.generateKey(
    "getNFTMetadata",
    contractAddress,
    tokenId,
    chain.id,
  );

  return withCache(cacheKey, async () => {
    try {
      validateChain(chain, "getNFTMetadata");

      const alchemy = getAlchemyInstance(chain.id);
      const metadata = await alchemy.nft.getNftMetadata(contractAddress, tokenId);

      return metadata;
    } catch (error) {
      console.error("[getNFTMetadata] Error:", error);
      throw error;
    }
  });
};

// ... (keep all other existing functions: getNFTContractMetadata, getNFTFloorPrice, etc.)
// They will automatically use fallback when needed through getNFTsForOwner

/**
 * Get NFT contract metadata
 * CACHED for 5 minutes
 */
export const getNFTContractMetadata = async (contractAddress, chain) => {
  const cacheKey = nftCache.generateKey(
    "getNFTContractMetadata",
    contractAddress,
    chain.id,
  );

  return withCache(cacheKey, async () => {
    try {
      validateChain(chain, "getNFTContractMetadata");

      const alchemy = getAlchemyInstance(chain.id);
      const metadata = await alchemy.nft.getContractMetadata(contractAddress);

      return metadata;
    } catch (error) {
      console.error("[getNFTContractMetadata] Error:", error);
      throw error;
    }
  });
};

/**
 * Get NFT floor price
 * CACHED for 5 minutes
 */
export const getNFTFloorPrice = async (contractAddress, chain) => {
  const cacheKey = nftCache.generateKey(
    "getNFTFloorPrice",
    contractAddress,
    chain.id,
  );

  return withCache(cacheKey, async () => {
    try {
      validateChain(chain, "getNFTFloorPrice");

      const alchemy = getAlchemyInstance(chain.id);
      const floorPrice = await alchemy.nft.getFloorPrice(contractAddress);

      return floorPrice;
    } catch (error) {
      console.error("[getNFTFloorPrice] Error:", error);
      throw error;
    }
  });
};

/**
 * Check if contract is spam
 * CACHED for 5 minutes
 */
export const isSpamContract = async (contractAddress, chain) => {
  const cacheKey = nftCache.generateKey(
    "isSpamContract",
    contractAddress,
    chain.id,
  );

  return withCache(cacheKey, async () => {
    try {
      validateChain(chain, "isSpamContract");

      const alchemy = getAlchemyInstance(chain.id);
      const isSpam = await alchemy.nft.isSpamContract(contractAddress);

      return isSpam;
    } catch (error) {
      console.error("[isSpamContract] Error:", error);
      return false;
    }
  });
};

/**
 * Refresh NFT metadata
 * NOT CACHED - This is an action that should always execute
 */
export const refreshNFTMetadata = async (contractAddress, tokenId, chain) => {
  try {
    validateChain(chain, "refreshNFTMetadata");

    const alchemy = getAlchemyInstance(chain.id);
    const result = await alchemy.nft.refreshNftMetadata(
      contractAddress,
      tokenId,
    );

    // Invalidate related caches after refresh
    const metadataKey = nftCache.generateKey(
      "getNFTMetadata",
      contractAddress,
      tokenId,
      chain.id,
    );
    nftCache.cache.delete(metadataKey);

    return result;
  } catch (error) {
    console.error("[refreshNFTMetadata] Error:", error);
    throw error;
  }
};

/**
 * Send NFT (ERC-721 or ERC-1155)
 * NOT CACHED - This is a transaction that should always execute
 */
export const sendNFT = async (
  privateKey,
  contractAddress,
  toAddress,
  tokenId,
  tokenType = "ERC721",
  chain,
) => {
  try {
    validateChain(chain, "sendNFT");

    const wallet = createWalletForChain(chain, privateKey);

    const ERC721_TRANSFER_ABI = [
      "function transferFrom(address from, address to, uint256 tokenId)",
    ];

    const ERC1155_TRANSFER_ABI = [
      "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
    ];

    const abi =
      tokenType === "ERC1155" ? ERC1155_TRANSFER_ABI : ERC721_TRANSFER_ABI;
    const contract = new ethers.Contract(contractAddress, abi, wallet);

    let tx;
    if (tokenType === "ERC1155") {
      tx = await contract.safeTransferFrom(
        wallet.address,
        toAddress,
        tokenId,
        1,
        "0x",
      );
    } else {
      tx = await contract.transferFrom(wallet.address, toAddress, tokenId);
    }

    console.log("[sendNFT] Transaction sent:", tx.hash);

    // Invalidate owner caches after transfer
    nftCache.clear(); // Clear all NFT ownership caches since ownership changed

    return tx.hash;
  } catch (error) {
    console.error("[sendNFT] Error:", error);
    throw error;
  }
};

/**
 * Get NFTs for a specific collection
 * CACHED for 5 minutes
 */
export const getNFTsForCollection = async (
  contractAddress,
  chain,
  options = {},
) => {
  const cacheKey = nftCache.generateKey(
    "getNFTsForCollection",
    contractAddress,
    chain.id,
    options,
  );

  return withCache(cacheKey, async () => {
    try {
      validateChain(chain, "getNFTsForCollection");

      const alchemy = getAlchemyInstance(chain.id);
      const nfts = await alchemy.nft.getNftsForContract(contractAddress, {
        pageSize: options.pageSize || 100,
        ...options,
      });

      return nfts;
    } catch (error) {
      console.error("[getNFTsForCollection] Error:", error);
      throw error;
    }
  });
};

/**
 * Get owners of an NFT
 * CACHED for 5 minutes
 */
export const getNFTOwners = async (contractAddress, tokenId, chain) => {
  const cacheKey = nftCache.generateKey(
    "getNFTOwners",
    contractAddress,
    tokenId,
    chain.id,
  );

  return withCache(cacheKey, async () => {
    try {
      validateChain(chain, "getNFTOwners");

      const alchemy = getAlchemyInstance(chain.id);
      const owners = await alchemy.nft.getOwnersForNft(
        contractAddress,
        tokenId,
      );

      return owners;
    } catch (error) {
      console.error("[getNFTOwners] Error:", error);
      throw error;
    }
  });
};

/**
 * Verify NFT ownership
 * CACHED for 5 minutes
 */
export const verifyNFTOwnership = async (
  ownerAddress,
  contractAddress,
  chain,
) => {
  const cacheKey = nftCache.generateKey(
    "verifyNFTOwnership",
    ownerAddress,
    contractAddress,
    chain.id,
  );

  return withCache(cacheKey, async () => {
    try {
      validateChain(chain, "verifyNFTOwnership");

      const alchemy = getAlchemyInstance(chain.id);
      const result = await alchemy.nft.verifyNftOwnership(
        ownerAddress,
        contractAddress,
      );

      return result;
    } catch (error) {
      console.error("[verifyNFTOwnership] Error:", error);
      return false;
    }
  });
};

/**
 * Utility: Clear all NFT caches manually
 */
export const clearNFTCache = () => {
  nftCache.clear();
};

/**
 * Utility: Get cache statistics
 */
export const getNFTCacheStats = () => {
  return nftCache.getStats();
};
