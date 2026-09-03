// hooks/useMultichainPortfolio.js
// Per-token (ERC-20) balance breakdown across every chain the wallet has
// available, on top of (not replacing) useWallet()'s existing native-balance
// fetching. Home-screen-local by design: useWallet().balances is consumed by
// Send/Receive/Tokens/TokenDetail and several other screens, so this hook
// fetches independently rather than changing that shared contract.
//
// Alchemy-supported chains (Ethereum, Polygon, Arbitrum, Base)
// use Alchemy's batched core.getTokenBalances — one call per chain instead of
// the N sequential per-contract balanceOf() RPC calls the log-scan fallback
// needs. Chains the Alchemy SDK doesn't cover (Robinhood Chain + testnet,
// Avalanche, HyperEVM) fall back to utils/blockchain/Balances.js's existing
// getAllTokenBalances (log-scan discovery), unchanged.
import { useState, useCallback, useRef } from "react";
import { formatUnits } from "ethers";
import { isAlchemySupported, getAlchemyInstance } from "../utils/blockchain/Alchemy";
import { getAllTokenBalances } from "../utils/blockchain/Balances";

const fetchAlchemyChainTokens = async (chainId, walletAddress) => {
  const alchemy = getAlchemyInstance(chainId);
  const { tokenBalances } = await alchemy.core.getTokenBalances(walletAddress);

  const nonZero = tokenBalances.filter(
    (t) => !t.error && t.tokenBalance && BigInt(t.tokenBalance) > 0n,
  );

  const tokens = await Promise.all(
    nonZero.map(async (t) => {
      try {
        const meta = await alchemy.core.getTokenMetadata(t.contractAddress);
        const decimals = meta.decimals ?? 18;
        const balance = BigInt(t.tokenBalance);
        return {
          address: t.contractAddress,
          balance: balance.toString(),
          formatted: formatUnits(balance, decimals),
          name: meta.name || "Unknown Token",
          symbol: meta.symbol || "???",
          decimals,
          logo: meta.logo || null,
        };
      } catch {
        // Metadata call failed (non-standard token, revert, etc.) — skip
        // rather than show a balance with no symbol/decimals to format it.
        return null;
      }
    }),
  );

  return tokens.filter(Boolean);
};

const fetchRpcChainTokens = async (walletAddress, chain) => {
  const tokens = await getAllTokenBalances(walletAddress, chain);
  // Already shaped as { address, balance, formatted, name, symbol, decimals, logo }.
  return tokens;
};

export function useMultichainPortfolio(walletAddress, chains) {
  const [tokensByChain, setTokensByChain] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!walletAddress || !Array.isArray(chains) || chains.length === 0) {
      setTokensByChain({});
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    const results = await Promise.allSettled(
      chains.map(async (chain) => {
        const tokens = isAlchemySupported(chain.id)
          ? await fetchAlchemyChainTokens(chain.id, walletAddress)
          : await fetchRpcChainTokens(walletAddress, chain);
        return { chainId: chain.id, tokens };
      }),
    );

    // A stale, superseded request (wallet/chain list changed mid-flight)
    // should never clobber a newer one's result.
    if (requestId !== requestIdRef.current) return;

    const merged = {};
    let firstError = null;
    results.forEach((r, i) => {
      const chainId = chains[i].id;
      if (r.status === "fulfilled") {
        merged[chainId] = r.value.tokens;
      } else {
        merged[chainId] = [];
        firstError = firstError || r.reason;
        if (__DEV__) {
          console.warn(`[useMultichainPortfolio] chain ${chainId} failed:`, r.reason?.message);
        }
      }
    });

    setTokensByChain(merged);
    setError(firstError);
    setLoading(false);
  }, [walletAddress, chains]);

  return { tokensByChain, loading, error, refresh };
}

export default useMultichainPortfolio;
