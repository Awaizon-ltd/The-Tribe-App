// hooks/useAvailableChains.js
import { useMemo, useCallback } from 'react';
import { useChain } from '../contexts/ChainContext';
import { useAppMode } from '../contexts/AppModeContext';
import { SUPPORTED_CHAINS } from '../constants/Chain';

// Module-level constant — stable reference, no re-creation on renders.
// Robinhood Testnet is available in Community mode in every build,
// including production — it's the one testnet ChainContext.js's production
// guards allow through (see constants/Chain.js's isTestnetAllowedInProduction).
const COMMUNITY_CHAINS = [SUPPORTED_CHAINS.ROBINHOOD, SUPPORTED_CHAINS.ROBINHOOD_TESTNET];

export const useAvailableChains = () => {
  const { getAvailableChains, activeChain } = useChain();
  const { isWalletMode } = useAppMode();

  // Memoize so the array reference is stable between renders.
  // Only recomputes when isWalletMode (a boolean) actually flips.
  // Without useMemo, getAvailableChains() returns a new array every render,
  // which causes useEffect([..., availableChains]) to fire on every render → infinite loop.
  const availableChains = useMemo(
    () => (isWalletMode ? getAvailableChains() : COMMUNITY_CHAINS),
    [isWalletMode], // getAvailableChains output is constant (SUPPORTED_CHAINS is a module constant)
  );

  const isChainAvailable = useCallback(
    (chainId) => availableChains.some((c) => c.id === chainId),
    [availableChains],
  );

  return { availableChains, isChainAvailable, activeChain };
};
