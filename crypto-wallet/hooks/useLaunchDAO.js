// hooks/useLaunchDAO.js
import { useState, useCallback, useEffect } from 'react';
import { Contract, isAddress } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { useChain } from '../contexts/ChainContext';
import { getFactoryAddress, isFactoryDeployed } from '../constants/ContractAddress';
import factoryABI from '../abi/DAOFactoryAbi.json';

// ERC20 ABI for fetching token details
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
];

// DAO Genres mapping
export const DAO_GENRES = {
  NFT: 0,
  GAMING: 1,
  COMMUNITY: 2,
  DEFI: 3,
  AI: 4,
  DEGEN: 5,
  MEMECOIN: 6,
  RWA: 7,
  DEPIN: 8,
  SOCIALFI: 9,
  METAVERSE: 10,
  OTHER: 11,
};

export const GENRE_LABELS = {
  0: 'NFT',
  1: 'Gaming',
  2: 'Community',
  3: 'DeFi',
  4: 'AI',
  5: 'Degen',
  6: 'Memecoin',
  7: 'RWA',
  8: 'DePIN',
  9: 'SocialFi',
  10: 'Metaverse',
  11: 'Other',
};

// Payment methods
export const PAYMENT_METHODS = {
  ETH: 0,
  TOKEN: 1,
};

export function useLaunchDAO() {
  const { provider } = useWallet();
  const { activeChain } = useChain();
  
  const factoryAddress = getFactoryAddress(activeChain.id);
  const isDeployed = isFactoryDeployed(activeChain.id);
  
  const [tokenDetails, setTokenDetails] = useState(null);
  const [fetchingToken, setFetchingToken] = useState(false);
  const [tokenError, setTokenError] = useState(null);
  
  const [creationFees, setCreationFees] = useState({
    ethFee: null,
    tokenFee: null,
    minTimelock: null,
  });
  const [fetchingFees, setFetchingFees] = useState(false);

  // Fetch fees when chain changes
  useEffect(() => {
    if (isDeployed && factoryAddress && provider) {
      fetchCreationFees();
    }
  }, [activeChain.id, factoryAddress, isDeployed, provider]);

  /**
   * Fetch token details by address - ENHANCED VERSION
   */
  const fetchTokenDetails = useCallback(async (tokenAddress) => {
    console.log('=== [useLaunchDAO] Fetching Token Details ===');
    console.log('[useLaunchDAO] Token Address:', tokenAddress);
    
    // Validate address format
    if (!tokenAddress) {
      setTokenError('Token address is required');
      setTokenDetails(null);
      return null;
    }

    if (!isAddress(tokenAddress)) {
      setTokenError('Invalid token address format');
      setTokenDetails(null);
      return null;
    }

    if (!provider) {
      console.error('[useLaunchDAO] ❌ Provider not available');
      setTokenError('Provider not available');
      return null;
    }

    setFetchingToken(true);
    setTokenError(null);

    try {
      // Check if address has contract code
      console.log('[useLaunchDAO] Checking if address is a contract...');
      const code = await provider.getCode(tokenAddress);
      
      if (code === '0x') {
        console.error('[useLaunchDAO] ❌ No contract found at address');
        throw new Error('No contract found at this address. Please check the token address.');
      }
      
      console.log('[useLaunchDAO] ✅ Contract found, fetching token details...');
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
      
      // Fetch all token details - with individual error handling
      const results = await Promise.allSettled([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply(),
      ]);

      // Check if all calls succeeded
      const allSucceeded = results.every(result => result.status === 'fulfilled');
      
      if (!allSucceeded) {
        console.error('[useLaunchDAO] ❌ Some token functions failed:', results);
        throw new Error('This address is not a valid ERC20 token. Some required functions are missing.');
      }

      const [name, symbol, decimals, totalSupply] = results.map(r => r.value);

      const details = {
        address: tokenAddress,
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: totalSupply.toString(),
      };

      console.log('[useLaunchDAO] ✅ Token details fetched successfully:', details);
      setTokenDetails(details);
      setTokenError(null);
      return details;
      
    } catch (error) {
      console.error('[useLaunchDAO] ❌ Error fetching token details:', error);
      
      // Provide specific error messages
      let errorMessage = 'Failed to fetch token details.';
      
      if (error.message.includes('No contract')) {
        errorMessage = 'No contract found at this address. Please verify the token address.';
      } else if (error.message.includes('not a valid ERC20')) {
        errorMessage = error.message;
      } else if (error.code === 'CALL_EXCEPTION') {
        errorMessage = 'This address is not a valid ERC20 token or does not implement required functions.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      setTokenError(errorMessage);
      setTokenDetails(null);
      return null;
      
    } finally {
      setFetchingToken(false);
      console.log('=== [useLaunchDAO] Token Fetch Complete ===\n');
    }
  }, [provider]);

  /**
   * Fetch DAO creation fees from factory
   */
  const fetchCreationFees = useCallback(async () => {
    if (!factoryAddress || !provider) {
      console.log('[useLaunchDAO] Cannot fetch fees - missing factory or provider');
      return;
    }

    setFetchingFees(true);

    try {
      console.log('[useLaunchDAO] Fetching creation fees...');
      console.log('[useLaunchDAO] Factory Address:', factoryAddress);
      console.log('[useLaunchDAO] Active Chain:', activeChain.name, activeChain.id);
      
      const network = await provider.getNetwork();
      console.log('[useLaunchDAO] Provider Network:', network.chainId.toString());
      
      if (network.chainId.toString() !== activeChain.id.toString()) {
        console.error('[useLaunchDAO] Network mismatch!');
        throw new Error(`Provider is on chain ${network.chainId} but expected ${activeChain.id}`);
      }
      
      const code = await provider.getCode(factoryAddress);
      console.log('[useLaunchDAO] Contract exists:', code !== '0x');
      
      if (code === '0x') {
        throw new Error('No contract found at this address');
      }

      const factory = new Contract(factoryAddress, factoryABI, provider);
      
      const [ethFee, tokenFee, minTimelock] = await Promise.all([
        factory.ethDaoCreationFee(),
        factory.tokenDaoCreationFee(),
        factory.minTimelockHours(),
      ]);

      setCreationFees({
        ethFee: ethFee.toString(),
        tokenFee: tokenFee.toString(),
        minTimelock: Number(minTimelock),
      });
      
      console.log('[useLaunchDAO] Fees fetched successfully:', {
        ethFee: ethFee.toString(),
        tokenFee: tokenFee.toString(),
        minTimelock: Number(minTimelock),
      });
    } catch (error) {
      console.error('[useLaunchDAO] Error fetching creation fees:', error);
    } finally {
      setFetchingFees(false);
    }
  }, [factoryAddress, provider, activeChain]);

  /**
   * Validate DAO parameters
   */
  const validateDAOParams = useCallback((params) => {
    const errors = {};

    if (!params.daoName || params.daoName.trim().length === 0) {
      errors.daoName = 'DAO name is required';
    } else if (params.daoName.length > 100) {
      errors.daoName = 'DAO name must be less than 100 characters';
    }

    if (params.genre === null || params.genre === undefined) {
      errors.genre = 'Please select a genre';
    }

    if (!params.tokenAddress || !isAddress(params.tokenAddress)) {
      errors.tokenAddress = 'Valid token address is required';
    }

    if (!params.quorum || params.quorum <= 0 || params.quorum > 100) {
      errors.quorum = 'Quorum must be between 1 and 100';
    }

    if (!params.threshold || params.threshold <= 0) {
      errors.threshold = 'Threshold must be greater than 0';
    }

    if (!params.votingPeriodHours || params.votingPeriodHours <= 0) {
      errors.votingPeriodHours = 'Voting period must be greater than 0';
    }

    if (!params.timelockPeriodHours || params.timelockPeriodHours < (creationFees.minTimelock || 1)) {
      errors.timelockPeriodHours = `Timelock must be at least ${creationFees.minTimelock || 1} hours`;
    }

    if (params.paymentMethod === null || params.paymentMethod === undefined) {
      errors.paymentMethod = 'Please select a payment method';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }, [creationFees.minTimelock]);

  /**
   * Get transaction parameters for DAO creation
   */
  const getCreateDAOTxParams = useCallback((params) => {
    const value = params.paymentMethod === PAYMENT_METHODS.ETH 
      ? creationFees.ethFee 
      : "0";

    return {
      address: factoryAddress,
      abi: factoryABI,
      functionName: 'createDAO',
      args: [
        params.quorum,
        params.threshold,
        params.votingPeriodHours,
        params.timelockPeriodHours,
        params.tokenAddress,
        params.genre,
        params.imageUrl || '',
        params.daoName,
        params.paymentMethod,
      ],
      value,
    };
  }, [factoryAddress, creationFees.ethFee]);

  /**
   * Clear token details
   */
  const clearTokenDetails = useCallback(() => {
    setTokenDetails(null);
    setTokenError(null);
  }, []);

  return {
    // Chain info
    activeChain,
    factoryAddress,
    isDeployed,
    
    // Token details
    tokenDetails,
    fetchingToken,
    tokenError,
    fetchTokenDetails,
    clearTokenDetails,
    
    // Creation fees
    creationFees,
    fetchingFees,
    fetchCreationFees,
    
    // Validation
    validateDAOParams,
    
    // Transaction params
    getCreateDAOTxParams,
    
    // Constants
    DAO_GENRES,
    GENRE_LABELS,
    PAYMENT_METHODS,
  };
}

export default useLaunchDAO;