// hooks/useDAOInteractions.js
import { useState, useCallback } from 'react';
import { VoteOption } from '../abi/index';
import * as ProposalDatabase from '../utils/ProposalDatabase';

export const useDAOInteractions = (daoAddress, chainId, userAddress) => {
  const [userVotes, setUserVotes] = useState({});

  const loadUserVote = useCallback(async (proposalId) => {
    if (!userAddress) return null;

    try {
      const cached = await ProposalDatabase.getUserVote(
        daoAddress,
        chainId,
        proposalId,
        userAddress
      );
      
      if (cached) {
        setUserVotes(prev => ({ ...prev, [proposalId]: cached }));
        return cached;
      }
      
      return null;
    } catch (err) {
      console.error('[useDAOInteractions] Error loading vote:', err);
      return null;
    }
  }, [daoAddress, chainId, userAddress]);

  const cacheVote = useCallback(async (proposalId, voteOption, voteWeight) => {
    if (!userAddress) return;

    try {
      await ProposalDatabase.cacheUserVote(
        daoAddress,
        chainId,
        proposalId,
        userAddress,
        voteOption,
        voteWeight
      );

      setUserVotes(prev => ({
        ...prev,
        [proposalId]: { proposalId, voteOption, voteWeight, votedAt: Date.now() }
      }));
    } catch (err) {
      console.error('[useDAOInteractions] Error caching vote:', err);
    }
  }, [daoAddress, chainId, userAddress]);

  return {
    userVotes,
    loadUserVote,
    cacheVote,
  };
};