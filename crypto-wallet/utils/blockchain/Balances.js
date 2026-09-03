// utils/balances.js
import { ethers } from "ethers";
import { createProviderForChain, validateChain } from "./Providers";

// ─── Constants ────────────────────────────────────────────────────────────────

// ERC-20 Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Minimal ABI — defined once, reused everywhere
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol()   view returns (string)",
  "function name()     view returns (string)",
  "function decimals() view returns (uint8)",
];

// How many blocks back to scan for incoming Transfer logs when discovering tokens.
// ~7 days on Ethereum (12 s/block). Adjust per chain if needed.
const LOG_SCAN_BLOCKS = 50_000;

// Hard cap on how many token contracts to resolve per discovery call.
// Prevents runaway RPC usage on addresses with hundreds of dust tokens.
const MAX_TOKENS_TO_RESOLVE = 20;

// Known tokens per chain for guaranteed coverage regardless of Transfer log history.
// Base mainnet has full eth_getLogs support so this is a safety net only —
// add addresses here if a token is known to be missing from logs.
const KNOWN_TOKENS = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch ERC-20 metadata + balance for a list of contract addresses in parallel.
 * Skips contracts whose balanceOf returns 0 or whose calls revert.
 *
 * Returns only tokens with a non-zero balance.
 */
const resolveTokenBalances = async (
  provider,
  walletAddress,
  contractAddresses,
) => {
  const results = await Promise.all(
    contractAddresses.map(async (addr) => {
      try {
        const contract = new ethers.Contract(addr, ERC20_ABI, provider);

        // Fetch balance first — skip metadata round-trip if balance is zero
        const balance = await contract.balanceOf(walletAddress);
        if (balance === 0n) return null;

        // Fetch metadata in parallel now that we know there's a balance
        const [symbol, name, decimals] = await Promise.all([
          contract.symbol().catch(() => "???"),
          contract.name().catch(() => "Unknown Token"),
          contract.decimals().catch(() => 18n),
        ]);

        const dec = Number(decimals);

        return {
          address: addr,
          balance: balance.toString(),
          formatted: ethers.formatUnits(balance, dec),
          name,
          symbol,
          decimals: dec,
          logo: null, // no logo source without a metadata API
        };
      } catch {
        // Contract reverted or is not a real ERC-20 — skip silently
        return null;
      }
    }),
  );

  return results.filter(Boolean);
};

/**
 * Discover ERC-20 tokens by scanning Transfer logs where `to` = walletAddress.
 * This is the standard no-API approach used by MetaMask, Rainbow, etc.
 *
 * eth_getLogs is a single RPC call. We deduplicate contract addresses, cap at
 * MAX_TOKENS_TO_RESOLVE, then resolve balances + metadata in parallel.
 */
const discoverTokensViaLogs = async (provider, walletAddress, chain) => {
  let toBlock;
  try {
    toBlock = await provider.getBlockNumber();
  } catch {
    return [];
  }

  const fromBlock = Math.max(0, toBlock - LOG_SCAN_BLOCKS);
  const paddedAddress = ethers.zeroPadValue(walletAddress, 32);

  let logs;
  try {
    logs = await provider.getLogs({
      fromBlock,
      toBlock,
      topics: [TRANSFER_TOPIC, null, paddedAddress], // Transfer(_,TO,_)
    });
  } catch {
    // Node may not support eth_getLogs with a wide range — fall back to known tokens
    __DEV__ &&
      console.warn(
        `[discoverTokensViaLogs] getLogs failed for ${chain.name}, using known tokens only`,
      );
    return [];
  }

  // Deduplicate contract addresses, ignore the native sentinel
  const NATIVE_SENTINEL = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  const uniqueContracts = [
    ...new Set(
      logs
        .map((l) => l.address.toLowerCase())
        .filter((a) => a !== NATIVE_SENTINEL),
    ),
  ].slice(0, MAX_TOKENS_TO_RESOLVE);

  return resolveTokenBalances(provider, walletAddress, uniqueContracts);
};

/**
 * Merge log-discovered tokens with any KNOWN_TOKENS for the chain,
 * deduplicating by lowercase address.
 */
const getTokensWithKnownFallback = async (provider, walletAddress, chain) => {
  const knownAddresses = (KNOWN_TOKENS[chain.id] ?? []).map((t) => t.address);

  // Run log discovery and known-token resolution in parallel
  const [discovered, knownResolved] = await Promise.all([
    discoverTokensViaLogs(provider, walletAddress, chain),
    resolveTokenBalances(provider, walletAddress, knownAddresses),
  ]);

  // Merge: discovered takes precedence, known fills in gaps
  const seen = new Set(discovered.map((t) => t.address.toLowerCase()));
  const merged = [...discovered];

  for (const token of knownResolved) {
    if (!seen.has(token.address.toLowerCase())) {
      merged.push(token);
    }
  }

  return merged;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Native token balance for one chain.
 */
export const getNativeBalance = async (address, chain) => {
  validateChain(chain, "getNativeBalance");

  const balance = await createProviderForChain(chain).getBalance(address);

  return {
    wei: balance.toString(),
    formatted: ethers.formatEther(balance),
    symbol: chain.symbol,
    decimals: 18,
  };
};

/**
 * Native balances across multiple chains in parallel.
 * Returns an object keyed by chainId. Failed chains return { formatted: "0", error }.
 */
export const getNativeBalancesMultiChain = async (address, chains) => {
  const results = await Promise.all(
    chains.map(async (chain) => {
      try {
        const balance = await getNativeBalance(address, chain);
        return { chainId: chain.id, chainName: chain.name, ...balance };
      } catch (error) {
        return {
          chainId: chain.id,
          chainName: chain.name,
          wei: "0",
          formatted: "0",
          symbol: chain.symbol,
          decimals: 18,
          error: error.message,
        };
      }
    }),
  );

  return results.reduce((acc, b) => {
    acc[b.chainId] = b;
    return acc;
  }, {});
};

/**
 * ERC-20 balance for a single known token address.
 * Use getAllTokenBalances when you don't know which tokens the address holds.
 */
export const getTokenBalance = async (tokenAddress, walletAddress, chain) => {
  validateChain(chain, "getTokenBalance");

  const provider = createProviderForChain(chain);
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  const [balance, decimals, symbol] = await Promise.all([
    contract.balanceOf(walletAddress),
    contract.decimals(),
    contract.symbol(),
  ]);

  const dec = Number(decimals);

  return {
    wei: balance.toString(),
    formatted: ethers.formatUnits(balance, dec),
    symbol,
    decimals: dec,
    address: tokenAddress,
  };
};

/**
 * Fast ERC-20 balance fetch — one RPC call only.
 * Requires `decimals` from the stored token record to skip the on-chain read.
 */
export const getTokenBalanceFast = async (tokenAddress, walletAddress, chain, decimals) => {
  validateChain(chain, "getTokenBalanceFast");

  const provider = createProviderForChain(chain);
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const balance  = await contract.balanceOf(walletAddress);
  const dec      = Number(decimals ?? 18);

  return {
    formatted: ethers.formatUnits(balance, dec),
    address: tokenAddress,
  };
};

/**
 * Discover and return all ERC-20 tokens held by `address` on `chain`.
 *
 * Strategy:
 *   1. eth_getLogs scan for incoming Transfer events (standard, no API key)
 *   2. KNOWN_TOKENS fallback for chains with limited log history or known assets
 *   3. Merge, deduplicate, resolve balances + metadata in parallel
 *   4. Return only tokens with a non-zero balance
 */
export const getAllTokenBalances = async (address, chain) => {
  validateChain(chain, "getAllTokenBalances");

  const provider = createProviderForChain(chain);
  return getTokensWithKnownFallback(provider, address, chain);
};

/**
 * Token balances across multiple chains in parallel.
 * Returns an object keyed by chainId.
 */
export const getAllTokenBalancesMultiChain = async (address, chains) => {
  const results = await Promise.all(
    chains.map(async (chain) => {
      try {
        const tokens = await getAllTokenBalances(address, chain);
        return { chainId: chain.id, tokens };
      } catch {
        return { chainId: chain.id, tokens: [] };
      }
    }),
  );

  return results.reduce((acc, r) => {
    acc[r.chainId] = r.tokens;
    return acc;
  }, {});
};

/**
 * Returns true if the address holds any native token or ERC-20 balance.
 * Both checks run in parallel.
 */
export const hasBalance = async (address, chain) => {
  validateChain(chain, "hasBalance");

  const [native, tokens] = await Promise.all([
    getNativeBalance(address, chain).catch(() => ({ formatted: "0" })),
    getAllTokenBalances(address, chain).catch(() => []),
  ]);

  return parseFloat(native.formatted) > 0 || tokens.length > 0;
};
