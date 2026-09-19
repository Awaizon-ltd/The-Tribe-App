// viem/chains imports for the non-Robinhood chains below are commented out
// along with those chain entries — re-add the ones you need if you
// uncomment a chain (mainnet, sepolia, polygon, bsc, arbitrum, optimism,
// avalanche, base, baseSepolia).
import { defineChain } from "viem";
import { getFactoryAddress } from "./FactoryAddress.js";

// viem/chains doesn't ship a Robinhood Chain definition yet (as of viem
// 2.43.3 in this project), so it's defined manually. Params verified
// 2026-08-28 against robinhood.com support docs + Alchemy's network page.
const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

// Robinhood Chain has no public testnet RPC domain yet (only mainnet does,
// above), so this uses the same Alchemy app key crypto-wallet/constants/
// Chain.js and website/src/config/wagmi.js already ship client-side for it
// — kept in sync across all three rather than introducing a fourth source.
const robinhoodTestnetChain = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://robinhood-testnet.g.alchemy.com/v2/DNSsO2xFxmfxk92qoGfS1"] },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
  testnet: true,
});

export const SUPPORTED_CHAINS = {
  // ETHEREUM: {
  //   id: 1,
  //   name: "Ethereum",
  //   symbol: "ETH",
  //   chain: mainnet,
  //   rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/HbuLjJ4P7DfTF8UQBKwMY",
  //   explorer: "https://etherscan.io",
  //   icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png?v=024",
  //   testnet: false,
  //   factoryAddress: getFactoryAddress(1),
  // },
  // POLYGON: {
  //   id: 137,
  //   name: "Polygon",
  //   symbol: "MATIC",
  //   rpcUrl: "https://polygon-rpc.com/",
  //   chain: polygon,
  //   alchemyUrl:
  //     "https://polygon-mainnet.g.alchemy.com/v2/HbuLjJ4P7DfTF8UQBKwMY",
  //   explorer: "https://polygonscan.com",
  //   icon: "https://cryptologos.cc/logos/polygon-matic-logo.png?v=024",
  //   testnet: false,
  //   factoryAddress: getFactoryAddress(137),
  // },
  // BSC: {
  //   id: 56,
  //   name: "BNB Chain",
  //   symbol: "BNB",
  //   chain: bsc,
  //   rpcUrl: "https://bsc.api.pocket.network/",
  //   alchemyUrl: "https://bnb-mainnet.g.alchemy.com/v2/HbuLjJ4P7DfTF8UQBKwMY",
  //   explorer: "https://bscscan.com",
  //   icon: "https://cryptologos.cc/logos/bnb-bnb-logo.png?v=024",
  //   testnet: false,
  //   factoryAddress: getFactoryAddress(56),
  // },
  // ARBITRUM: {
  //   id: 42161,
  //   name: "Arbitrum",
  //   symbol: "ETH",
  //   chain: arbitrum,
  //   rpcUrl: "https://arb-mainnet.g.alchemy.com/v2/HbuLjJ4P7DfTF8UQBKwMY",
  //   explorer: "https://arbiscan.io",
  //   icon: "https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=024",
  //   testnet: false,
  //   factoryAddress: getFactoryAddress(42161),
  // },
  // OPTIMISM: {
  //   id: 10,
  //   name: "Optimism",
  //   symbol: "ETH",
  //   chain: optimism,
  //   rpcUrl: "https://opt-mainnet.g.alchemy.com/v2/HbuLjJ4P7DfTF8UQBKwMY",
  //   explorer: "https://optimistic.etherscan.io",
  //   icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png?v=024",
  //   testnet: false,
  //   factoryAddress: getFactoryAddress(10),
  // },
  // AVALANCHE: {
  //   id: 43114,
  //   name: "Avalanche",
  //   symbol: "AVAX",
  //   chain: avalanche,
  //   rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
  //   alchemyUrl: "https://avax-mainnet.g.alchemy.com/v2/HbuLjJ4P7DfTF8UQBKwMY",
  //   explorer: "https://snowtrace.io",
  //   icon: "https://cryptologos.cc/logos/avalanche-avax-logo.png?v=024",
  //   testnet: false,
  //   factoryAddress: getFactoryAddress(43114),
  // },
  // Base is commented out (not deleted) — the app is Robinhood Chain-only
  // for now. Leaving Base active here meant blockchainService.js's
  // initializeClients()/fetchAllDAOs() hit Base's RPC on every server boot
  // and every GET /daos*, regardless of what any client actually asked for.
  // Uncomment to bring Base back.
  // BASE: {
  //   id: 8453,
  //   name: "Base",
  //   symbol: "ETH",
  //   chain: base,
  //   rpcUrl: "https://mainnet.base.org",
  //   explorer: "https://basescan.org",
  //   icon: "https://avatars.githubusercontent.com/u/108554348?s=200&v=4",
  //   testnet: false,
  //   factoryAddress: getFactoryAddress(8453),
  // },
  // BASE_SEPOLIA: {
  //   id: 84532,
  //   name: "Base Sepolia",
  //   symbol: "ETH",
  //   chain: baseSepolia,
  //   rpcUrl: "https://sepolia.base.org",
  //   explorer: "https://sepolia.basescan.org",
  //   icon: "https://avatars.githubusercontent.com/u/108554348?s=200&v=4",
  //   testnet: true,
  //   factoryAddress: getFactoryAddress(84532),
  // },
  ROBINHOOD: {
    id: 4663,
    name: "Robinhood Chain",
    symbol: "ETH",
    chain: robinhoodChain,
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    explorer: "https://robinhoodchain.blockscout.com",
    icon: null,
    testnet: false,
    // null until DAOFactory.sol is deployed to Robinhood Chain — see FactoryAddress.js
    factoryAddress: getFactoryAddress(4663),
  },
  ROBINHOOD_TESTNET: {
    id: 46630,
    name: "Robinhood Chain Testnet",
    symbol: "ETH",
    chain: robinhoodTestnetChain,
    rpcUrl: "https://robinhood-testnet.g.alchemy.com/v2/DNSsO2xFxmfxk92qoGfS1",
    explorer: "https://robinhoodchain.blockscout.com",
    icon: null,
    testnet: true,
    factoryAddress: getFactoryAddress(46630),
  },
  //  ABSTRACT: {
  //     id: 2741,
  //     name: 'Abstract',
  //     symbol: 'ETH',
  //     rpcUrl: 'https://abstract.drpc.org', // replace if needed
  //     explorer: 'https://explorer.abstract.xyz',
  //     icon: abstract,
  //     testnet: false,
  //       factoryAddress: getFactoryAddress(84532),
  //   },
};

export const DEFAULT_CHAIN = SUPPORTED_CHAINS.ROBINHOOD;

export const getChainById = (chainId) =>
  Object.values(SUPPORTED_CHAINS).find((chain) => chain.id === chainId);

export const getMainnetChains = () =>
  Object.values(SUPPORTED_CHAINS).filter((chain) => !chain.testnet);

export const getTestnetChains = () =>
  Object.values(SUPPORTED_CHAINS).filter((chain) => chain.testnet);

export const getChainByName = (name) =>
  Object.values(SUPPORTED_CHAINS).find(
    (chain) => chain.name.toLowerCase() === name.toLowerCase(),
  );
