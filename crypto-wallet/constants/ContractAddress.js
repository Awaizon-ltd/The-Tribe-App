// constants/ContractAddresses.js
/**
 * Deployed contract addresses for each chain
 * Update these with your actual deployed addresses
 */

export const DAO_FACTORY_ADDRESSES = {
  // Ethereum Mainnet
  1: "0xYourEthereumFactoryAddress",

  // Polygon
  137: "0x3c181eaaB64052c726194Da6797EA06DD15e8E6B",

  // BSC
  56: "0x3c181eaaB64052c726194Da6797EA06DD15e8E6B",

  // Arbitrum
  42161: "0x3c181eaaB64052c726194Da6797EA06DD15e8E6B",

  // // Optimism
  // 10: '0xYourOptimismFactoryAddress',

  // Avalanche
  43114: "0x3c181eaaB64052c726194Da6797EA06DD15e8E6B",

  // Base (Mainnet)
  8453: "0x69db1Ea748Aa83214c99ab1109fc34eba94734C0",

  // Base Sepolia (Testnet)
  84532: "0x4B3AD106552927494E0DB019170c1E5d4E5D08Eb",

  // // Abstract Mainnet
  // 2741: '0xYourAbstractFactoryAddress',
};

/**
 * Get factory address for a specific chain
 */
export const getFactoryAddress = (chainId) => {
  const address = DAO_FACTORY_ADDRESSES[chainId];
  if (!address) {
    throw new Error(`Factory not deployed on chain ${chainId}`);
  }
  return address;
};

/**
 * Check if factory is deployed on a chain
 */
export const isFactoryDeployed = (chainId) => {
  return (
    !!DAO_FACTORY_ADDRESSES[chainId] &&
    !DAO_FACTORY_ADDRESSES[chainId].includes("Your")
  );
};

/**
 * Get all chains where factory is deployed
 */
export const getDeployedChains = () => {
  return Object.keys(DAO_FACTORY_ADDRESSES)
    .map((id) => parseInt(id))
    .filter((id) => isFactoryDeployed(id));
};

/**
 * Fee token addresses per chain (if using token payment)
 */
export const FEE_TOKEN_ADDRESSES = {
  1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  137: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
  56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
  // 10: '0xYourOptimismFeeToken',
  43114: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", // WETH
  8453: "0xb62015c281c7e54380934B45ED9bb035200A9838",
  84532: "0xE81cE73a9dF6C1a893ee024D6E8176283b2E9E6C",
  // 2741: '0xYourAbstractFeeToken',
};

export const getFeeTokenAddress = (chainId) => {
  return FEE_TOKEN_ADDRESSES[chainId];
};

export default {
  DAO_FACTORY_ADDRESSES,
  FEE_TOKEN_ADDRESSES,
  getFactoryAddress,
  isFactoryDeployed,
  getDeployedChains,
  getFeeTokenAddress,
};
