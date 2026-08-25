// Base Sepolia testnet (chainId 84532) token list.
// Used by token management, swap UI, and the WSYN mint flow in __DEV__ mode.

export const BASE_SEPOLIA_TOKENS = [
  {
    "chainId": 84532,
    "address": "0x4200000000000000000000000000000000000006",
    "name": "Wrapped Ether",
    "symbol": "WETH",
    "decimals": 18,
    "logoURI": "https://ethereum-optimism.github.io/data/WETH/logo.png"
  },
  {
    "chainId": 84532,
    "address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "name": "USD Coin",
    "symbol": "USDC",
    "decimals": 6,
    "logoURI": "https://ethereum-optimism.github.io/data/USDC/logo.png"
  },
  {
    "chainId": 84532,
    "address": "0x3c181eaaB64052c726194Da6797EA06DD15e8E6B",
    "name": "WrappedSYN",
    "symbol": "WSYN",
    "decimals": 18,
    "logoURI": "https://raw.githubusercontent.com/sysfi-protocol/assets/main/logo.png"
  }
];

export const getTokenByAddress = (address) =>
  BASE_SEPOLIA_TOKENS.find(
    (t) => t.address.toLowerCase() === address.toLowerCase(),
  );

export const getTokenBySymbol = (symbol) =>
  BASE_SEPOLIA_TOKENS.find(
    (t) => t.symbol.toLowerCase() === symbol.toLowerCase(),
  );

export const searchTokens = (query) => {
  const q = query.toLowerCase();
  return BASE_SEPOLIA_TOKENS.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.symbol.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q),
  );
};
