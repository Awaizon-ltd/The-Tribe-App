// hooks/useAvailableChains.js
import { useMemo, useCallback } from 'react';
import { useChain } from '../contexts/ChainContext';
import { useAppMode } from '../contexts/AppModeContext';
import { SUPPORTED_CHAINS } from '../constants/Chain';

// Module-level constants — stable references, no re-creation on renders
const COMMUNITY_CHAINS_PROD = [SUPPORTED_CHAINS.BASE];
const COMMUNITY_CHAINS_DEV  = [SUPPORTED_CHAINS.BASE, SUPPORTED_CHAINS.BASE_SEPOLIA];
const COMMUNITY_CHAINS = __DEV__ ? COMMUNITY_CHAINS_DEV : COMMUNITY_CHAINS_PROD;

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
