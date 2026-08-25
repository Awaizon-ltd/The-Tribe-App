// utils/Contracts.js - Multi-chain contract configuration
// Import ABIs
import DAOFactoryABI from "../abi/DAOFactoryAbi.json";
import DAOABI from "../abi/DAOCoreAbi.json";
import TokenABI from "../abi/ERC20Abi.json";
import StakingABI from "../abi/DAOFactoryAbi.json";

/**
 * Chain ID to key mapping (numeric chain ID → string key)
 * This maps the numeric chain IDs from ChainContext to the string keys used in contract addresses
 */
export const CHAIN_ID_TO_KEY = {
  137: 'polygon',        // Polygon Mainnet
  1: 'ethereum',         // Ethereum Mainnet
  56: 'bsc',             // BSC Mainnet
  8453: 'base',          // Base Mainnet
  84532: 'baseTestnet',  // Base Sepolia Testnet
  42161: 'arbitrum',     // Arbitrum One
  10: 'optimism',        // Optimism Mainnet ✅ ADD THIS
  43114: 'avalanche',    // Avalanche C-Chain
};

/**
 * Reverse mapping: string key → numeric chain ID
 */
export const CHAIN_KEY_TO_ID = Object.entries(CHAIN_ID_TO_KEY).reduce((acc, [id, key]) => {
  acc[key] = parseInt(id);
  return acc;
}, {});

/**
 * Get chain key from numeric chain ID
 * @param {number|string} chainId - Numeric chain ID (e.g., 8453 or '8453')
 * @returns {string|null} Chain key (e.g., 'base') or null if not found
 */
export const getChainKey = (chainId) => {
  const numericId = typeof chainId === 'string' ? parseInt(chainId) : chainId;
  return CHAIN_ID_TO_KEY[numericId] || null;
};

/**
 * Get chain ID from chain key
 * @param {string} chainKey - Chain key (e.g., 'base')
 * @returns {number|null} Numeric chain ID (e.g., 8453) or null if not found
 */
export const getChainId = (chainKey) => {
  return CHAIN_KEY_TO_ID[chainKey] || null;
};

/**
 * Multi-chain contract configuration
 * Maps contract types to their ABIs and addresses across different chains
 */
export const CONTRACTS = {
  daoFactory: {
    name: "DAO Factory",
    abi: DAOFactoryABI,
    addresses: {
      polygon: "0x1234567890123456789012345678901234567890",
      ethereum: "0x2345678901234567890123456789012345678901",
      bsc: "0x3456789012345678901234567890123456789012",
      base: "0x616f59CCc6951958C6177574AEDCe4A83caF8360",
      baseTestnet: "0x5678901234567890123456789012345678901234",
      arbitrum: "0x6789012345678901234567890123456789012345",
      avalanche: "0x7890123456789012345678901234567890123456",
      abstract: "0x8901234567890123456789012345678901234567",
      apechain: "0x9012345678901234567890123456789012345678",
    },
  },
  dao: {
    name: "DAO",
    abi: DAOABI,
    addresses: {
      polygon: "0xabcdef0123456789abcdef0123456789abcdef01",
      ethereum: "0xbcdef0123456789abcdef0123456789abcdef012",
      bsc: "0xcdef0123456789abcdef0123456789abcdef0123",
      base: "0xdef0123456789abcdef0123456789abcdef01234",
      baseTestnet: "0xef0123456789abcdef0123456789abcdef012345",
      arbitrum: "0xf0123456789abcdef0123456789abcdef0123456",
      avalanche: "0x0123456789abcdef0123456789abcdef01234567",
      abstract: "0x123456789abcdef0123456789abcdef012345678",
      apechain: "0x23456789abcdef0123456789abcdef0123456789",
    },
  },
  synToken: {
    name: "SYN Token",
    abi: TokenABI,
    addresses: {
      polygon: "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
      ethereum: "0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
      bsc: "0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2",
      base: "0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3",
      baseTestnet: "0xe5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4",
      arbitrum: "0xf6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5",
      avalanche: "0xa7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6",
      abstract: "0xb8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7",
      apechain: "0xc9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8",
    },
  },
  staking: {
    name: "Staking",
    abi: StakingABI,
    addresses: {
      polygon: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
      ethereum: "0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c",
      bsc: "0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d",
      base: "0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e",
      baseTestnet: "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f",
      arbitrum: "0x6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a",
      avalanche: "0x7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
      abstract: "0x8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c",
      apechain: "0x9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d",
    },
  },
};

/**
 * Get contract configuration for a specific chain
 * @param {string} contractKey - Contract identifier (e.g., 'daoFactory', 'dao', 'synToken', 'staking')
 * @param {number|string} chainId - Chain identifier - ACCEPTS BOTH numeric ID (8453) OR string key ('base')
 * @returns {Object} Contract configuration with name, address, and abi
 * @throws {Error} If contract or chain not found
 * 
 * @example
 * // Using numeric chain ID (from ChainContext)
 * const daoFactory = getContractForChain('daoFactory', 8453);
 * 
 * // Using string chain key (legacy)
 * const daoFactory = getContractForChain('daoFactory', 'base');
 * 
 * // Both return: { name: 'DAO Factory', address: '0x616f...', abi: [...] }
 */
export const getContractForChain = (contractKey, chainId) => {
  const contract = CONTRACTS[contractKey];
  if (!contract) {
    throw new Error(`Contract ${contractKey} not found`);
  }
  
  // Handle both numeric chain IDs and string keys
  let chainKey;
  if (typeof chainId === 'number' || !isNaN(parseInt(chainId))) {
    // It's a numeric ID, convert to key
    chainKey = getChainKey(chainId);
    if (!chainKey) {
      throw new Error(`Chain ID ${chainId} not recognized. Available chain IDs: ${Object.keys(CHAIN_ID_TO_KEY).join(', ')}`);
    }
  } else {
    // It's already a string key
    chainKey = chainId;
  }
  
  const address = contract.addresses[chainKey];
  if (!address) {
    throw new Error(`Contract ${contractKey} not deployed on ${chainKey} (chain ID: ${chainId})`);
  }
  
  return {
    name: contract.name,
    address,
    abi: contract.abi,
  };
};

/**
 * Check if a contract is deployed on a specific chain
 * @param {string} contractKey - Contract identifier
 * @param {number|string} chainId - Chain identifier (numeric ID or string key)
 * @returns {boolean} True if contract is deployed on the chain
 * 
 * @example
 * if (isContractDeployedOnChain('daoFactory', 8453)) {
 *   // Contract is deployed on Base
 * }
 */
export const isContractDeployedOnChain = (contractKey, chainId) => {
  if (!CONTRACTS[contractKey]) return false;
  
  // Handle both numeric chain IDs and string keys
  let chainKey;
  if (typeof chainId === 'number' || !isNaN(parseInt(chainId))) {
    chainKey = getChainKey(chainId);
    if (!chainKey) return false;
  } else {
    chainKey = chainId;
  }
  
  return !!CONTRACTS[contractKey]?.addresses[chainKey];
};

/**
 * Get all chains where a contract is deployed
 * @param {string} contractKey - Contract identifier
 * @param {boolean} returnNumericIds - If true, returns numeric chain IDs instead of string keys
 * @returns {Array} Array of chain keys (or IDs if returnNumericIds=true) where contract is deployed
 * 
 * @example
 * const chains = getDeployedChains('daoFactory');
 * // Returns: ['polygon', 'ethereum', 'bsc', 'base', ...]
 * 
 * const chainIds = getDeployedChains('daoFactory', true);
 * // Returns: [137, 1, 56, 8453, ...]
 */
export const getDeployedChains = (contractKey, returnNumericIds = false) => {
  const contract = CONTRACTS[contractKey];
  if (!contract) {
    throw new Error(`Contract ${contractKey} not found`);
  }
  
  const chainKeys = Object.keys(contract.addresses);
  
  if (returnNumericIds) {
    return chainKeys.map(key => CHAIN_KEY_TO_ID[key]).filter(id => id !== undefined);
  }
  
  return chainKeys;
};

/**
 * Get all contracts deployed on a specific chain
 * @param {number|string} chainId - Chain identifier (numeric ID or string key)
 * @returns {Object} Object mapping contract keys to their configurations
 * 
 * @example
 * const contracts = getContractsForChain(8453); // or getContractsForChain('base')
 * // Returns: { daoFactory: {...}, dao: {...}, ... }
 */
export const getContractsForChain = (chainId) => {
  // Convert to chain key if numeric
  let chainKey;
  if (typeof chainId === 'number' || !isNaN(parseInt(chainId))) {
    chainKey = getChainKey(chainId);
    if (!chainKey) {
      throw new Error(`Chain ID ${chainId} not recognized`);
    }
  } else {
    chainKey = chainId;
  }
  
  const result = {};
  
  for (const [contractKey, contract] of Object.entries(CONTRACTS)) {
    if (contract.addresses[chainKey]) {
      result[contractKey] = {
        name: contract.name,
        address: contract.addresses[chainKey],
        abi: contract.abi,
      };
    }
  }
  
  return result;
};

/**
 * Get all available contract types
 * @returns {string[]} Array of contract keys
 * 
 * @example
 * const types = getContractTypes();
 * // Returns: ['daoFactory', 'dao', 'synToken', 'staking']
 */
export const getContractTypes = () => {
  return Object.keys(CONTRACTS);
};

/**
 * Get all available chain keys
 * @returns {string[]} Array of unique chain keys
 * 
 * @example
 * const chains = getAvailableChains();
 * // Returns: ['polygon', 'ethereum', 'bsc', 'base', ...]
 */
export const getAvailableChains = () => {
  const chains = new Set();
  
  for (const contract of Object.values(CONTRACTS)) {
    Object.keys(contract.addresses).forEach(chain => chains.add(chain));
  }
  
  return Array.from(chains);
};

/**
 * Get all available chain IDs (numeric)
 * @returns {number[]} Array of numeric chain IDs
 * 
 * @example
 * const chainIds = getAvailableChainIds();
 * // Returns: [137, 1, 56, 8453, ...]
 */
export const getAvailableChainIds = () => {
  return Object.keys(CHAIN_ID_TO_KEY).map(id => parseInt(id));
};

/**
 * Validate contract and chain combination
 * @param {string} contractKey - Contract identifier
 * @param {number|string} chainId - Chain identifier (numeric ID or string key)
 * @returns {Object} Validation result with isValid and optional error message
 * 
 * @example
 * const validation = validateContractChain('daoFactory', 8453);
 * if (!validation.isValid) {
 *   console.error(validation.error);
 * }
 */
export const validateContractChain = (contractKey, chainId) => {
  if (!CONTRACTS[contractKey]) {
    return {
      isValid: false,
      error: `Contract '${contractKey}' not found. Available contracts: ${getContractTypes().join(', ')}`
    };
  }
  
  // Convert to chain key if numeric
  let chainKey;
  if (typeof chainId === 'number' || !isNaN(parseInt(chainId))) {
    chainKey = getChainKey(chainId);
    if (!chainKey) {
      return {
        isValid: false,
        error: `Chain ID ${chainId} not recognized. Available chain IDs: ${Object.keys(CHAIN_ID_TO_KEY).join(', ')}`
      };
    }
  } else {
    chainKey = chainId;
  }
  
  if (!CONTRACTS[contractKey].addresses[chainKey]) {
    return {
      isValid: false,
      error: `Contract '${contractKey}' not deployed on chain '${chainKey}' (ID: ${chainId}). Available chains: ${getDeployedChains(contractKey).join(', ')}`
    };
  }
  
  return { isValid: true };
};