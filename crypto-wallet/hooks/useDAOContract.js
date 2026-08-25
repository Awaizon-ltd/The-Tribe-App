// hooks/useDAOContract.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { Contract, formatUnits, parseUnits } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { useChain } from '../contexts/ChainContext';
import { DAO_CONTRACT_ABI, ERC20_ABI, ProposalStatus, VoteOption, ProposalType, ProtocolAction } from '../abi/index';
import * as ProposalDatabase from '../utils/ProposalDatabase';

export const useDAOContract = (daoAddress) => {
  const { provider, address: userAddress } = useWallet();
  const { chainId } = useChain();
  
  // Contract state (no refs!)
  const [daoContract, setDaoContract] = useState(null);
  const [tokenContract, setTokenContract] = useState(null);
  
  // Data state 
  const [daoInfo, setDaoInfo] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  
  const isMountedRef = useRef(true);

  /**
   * Initialize contracts - Effect runs when provider or daoAddress changes
   */
  useEffect(() => {
    let mounted = true;

    const initContracts = async () => {
      if (!provider || !daoAddress) {
        console.log('[useDAOContract] ⚠️ Missing provider or daoAddress');
        setDaoContract(null);
        setTokenContract(null);
        return;
      }

      try {
        console.log('[useDAOContract] 🔧 Initializing contracts for DAO:', daoAddress);
        
        // Create DAO contract instance
        const newDaoContract = new Contract(daoAddress, DAO_CONTRACT_ABI, provider);
        
        // Get token address from DAO contract
        const tokenAddress = await newDaoContract.token();
        console.log('[useDAOContract] 🪙 Token address:', tokenAddress);
        
        // Create token contract instance
        const newTokenContract = new Contract(tokenAddress, ERC20_ABI, provider);

        if (mounted) {
          setDaoContract(newDaoContract);
          setTokenContract(newTokenContract);
          console.log('[useDAOContract] ✅ Contracts initialized and set in state');
        }
      } catch (err) {
        console.error('[useDAOContract] ❌ Contract initialization failed:', err);
        if (mounted) {
          setDaoContract(null);
          setTokenContract(null);
          setError(err.message);
        }
      }
    };

    initContracts();

    return () => {
      mounted = false;
    };
  }, [provider, daoAddress]);

  /**
   * Fetch DAO metadata from contract
   */
  const fetchDAOInfo = useCallback(async () => {
    if (!daoContract) {
      console.log('[useDAOContract] ⚠️ No DAO contract available');
      return null;
    }

    try {
      const [
        owner,
        tokenAddress,
        name,
        imageUrl,
        quorumPercentage,
        proposalThreshold,
        votingPeriodHours,
        timelockPeriodHours,
      ] = await Promise.all([
        daoContract.owner(),
        daoContract.token(),
        daoContract.name(),
        daoContract.imageUrl(),
        daoContract.quorumPercentage(),
        daoContract.proposalThreshold(),
        daoContract.votingPeriodHours(),
        daoContract.timelockPeriodHours(),
      ]);

      const info = {
        address: daoAddress,
        owner,
        tokenAddress,
        name,
        imageUrl,
        quorumPercentage: Number(quorumPercentage),
        proposalThreshold: proposalThreshold.toString(),
        votingPeriodHours: Number(votingPeriodHours),
        timelockPeriodHours: Number(timelockPeriodHours),
        chainId,
      };

      console.log('[useDAOContract] ✅ DAO info fetched:', info.name);
      return info;
    } catch (err) {
      console.error('[useDAOContract] ❌ Error fetching DAO info:', err);
      throw err;
    }
  }, [daoContract, daoAddress, chainId]);

  /**
   * Fetch all proposals from contract
   */
  const fetchProposals = useCallback(async () => {
    if (!daoContract) {
      console.log('[useDAOContract] ⚠️ No DAO contract available');
      return [];
    }

    try {
      const proposalCount = await daoContract.proposalCount();
      const count = Number(proposalCount);

      if (count === 0) {
        return [];
      }

      const proposalPromises = [];
      for (let i = 1; i <= count; i++) {
        proposalPromises.push(daoContract.getProposal(i));
      }

      const rawProposals = await Promise.all(proposalPromises);

      const formattedProposals = rawProposals.map((p) => ({
        id: Number(p.id),
        proposalId: Number(p.id),
        title: p.title,
        description: p.description,
        amount: p.amount.toString(),
        recipient: p.recipient,
        proposalType: Number(p.proposalType),
        protocolAction: Number(p.protocolAction),
        newValue: p.newValue.toString(),
        newTokenAddress: p.newTokenAddress,
        forVotes: p.forVotes.toString(),
        againstVotes: p.againstVotes.toString(),
        abstainVotes: p.abstainVotes.toString(),
        status: Number(p.status),
        timestamp: Number(p.timestamp),
        queuedTimestamp: Number(p.queuedTimestamp),
        creator: p.creator,
      }));

      console.log(`[useDAOContract] ✅ Fetched ${formattedProposals.length} proposals`);
      return formattedProposals;
    } catch (err) {
      console.error('[useDAOContract] ❌ Error fetching proposals:', err);
      throw err;
    }
  }, [daoContract]);

  /**
   * Fetch user info (voting power, delegation)
   */
  const fetchUserInfo = useCallback(async () => {
    if (!userAddress) {
      console.log('[useDAOContract] ⚠️ No user address');
      return null;
    }

    if (!daoContract || !tokenContract) {
      console.log('[useDAOContract] ⚠️ Contracts not ready');
      return null;
    }

    try {

      const [
        tokenBalance,
        delegatee,
        delegatorBalance,
        delegateeDelegatorCount,
        delegateeVotesReceived,
        tokenDecimals,
        tokenSymbol,
           totalSupply,
      ] = await Promise.all([
        tokenContract.balanceOf(userAddress),
        daoContract.delegatorDelegatee(userAddress),
        daoContract.delegatorBalance(userAddress),
        daoContract.delegateeDelegatorCount(userAddress),
        daoContract.delegateeVotesReceived(userAddress),
        tokenContract.decimals(),
        tokenContract.symbol(),
          tokenContract.totalSupply(), // ✅ ADD THIS
      ]);

      const ownBalance = BigInt(tokenBalance);
      const receivedVotes = BigInt(delegateeVotesReceived);
      const totalVotingPower = ownBalance + receivedVotes;
      const isHolder = ownBalance > 0n;

      const info = {
        tokenBalance: tokenBalance.toString(),
        tokenBalanceFormatted: formatUnits(tokenBalance, tokenDecimals),
        delegatee: delegatee === '0x0000000000000000000000000000000000000000' ? null : delegatee,
        isDelegating: delegatee !== '0x0000000000000000000000000000000000000000',
        delegatedAmount: delegatorBalance.toString(),
        delegatedAmountFormatted: formatUnits(delegatorBalance, tokenDecimals),
        delegatorsCount: Number(delegateeDelegatorCount),
        receivedVotes: delegateeVotesReceived.toString(),
        receivedVotesFormatted: formatUnits(delegateeVotesReceived, tokenDecimals),
        votingPower: totalVotingPower.toString(),
        votingPowerFormatted: formatUnits(totalVotingPower, tokenDecimals),
        isTokenHolder: isHolder,
        tokenDecimals: Number(tokenDecimals),
        tokenSymbol,
            totalSupply: totalSupply.toString(), // ✅ ADD THIS
      totalSupplyFormatted: formatUnits(totalSupply, tokenDecimals), 
      };

      console.log('[useDAOContract] ✅ User info fetched successfully');
      return info;
    } catch (err) {
      console.error('[useDAOContract] ❌ Error fetching user info:', err);
      throw err;
    }
  }, [userAddress, daoContract, tokenContract]);

  /**
   * Load data from cache
   */
  const loadFromCache = useCallback(async () => {
    try {
      console.log('[useDAOContract] 💾 Loading from cache...');

      const cachedProposals = await ProposalDatabase.getCachedProposals(
        daoAddress,
        chainId
      );

      if (cachedProposals.length > 0) {
        setProposals(cachedProposals);
        setDataSource('cache');
        console.log(`[useDAOContract] ✅ Loaded ${cachedProposals.length} proposals from cache`);
        return true;
      }

      console.log('[useDAOContract] ⚠️ No cached proposals found');
      return false;
    } catch (err) {
      console.error('[useDAOContract] ❌ Error loading from cache:', err);
      return false;
    }
  }, [daoAddress, chainId]);

  /**
   * Sync data from contract
   */
  const syncFromContract = useCallback(async () => {
    if (!daoContract || !tokenContract) {
      console.log('[useDAOContract] ⚠️ Contracts not ready for sync');
      return;
    }

    try {
      setIsSyncing(true);
      setError(null);

      console.log('[useDAOContract] 🔄 ============ STARTING SYNC ============');
      const [fetchedDAOInfo, fetchedProposals, fetchedUserInfo] = await Promise.all([
        fetchDAOInfo(),
        fetchProposals(),
        userAddress ? fetchUserInfo() : Promise.resolve(null),
      ]);

      if (!isMountedRef.current) {
        console.log('[useDAOContract] ⚠️ Component unmounted, aborting sync');
        return;
      }

      console.log('[useDAOContract] 📝 Updating state with synced data');
      setDaoInfo(fetchedDAOInfo);
      setProposals(fetchedProposals);
      setUserInfo(fetchedUserInfo);
      setDataSource('contract');

      if (fetchedProposals.length > 0) {
        await ProposalDatabase.batchCacheProposals(
          fetchedProposals,
          daoAddress,
          chainId
        );
        await ProposalDatabase.updateProposalSyncState(
          daoAddress,
          chainId,
          fetchedProposals.length
        );
        console.log('[useDAOContract] 💾 Proposals cached');
      }

      console.log('[useDAOContract] 🔄 ============ SYNC COMPLETE ============');
    } catch (err) {
      console.error('[useDAOContract] ❌ Sync failed:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [
    daoContract,
    tokenContract,
    userAddress,
    daoAddress,
    chainId,
    fetchDAOInfo,
    fetchProposals,
    fetchUserInfo,
  ]);

  /**
   * Initial load strategy
   */
  const initialLoad = useCallback(async () => {
    if (!daoContract || !tokenContract) {
      console.log('[useDAOContract] ⚠️ Contracts not ready for initial load');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log(`[useDAOContract] 🚀 Loading DAO ${daoAddress} on chain ${chainId}`);

      const info = await fetchDAOInfo();
      setDaoInfo(info);

      if (userAddress) {
        const userInfoData = await fetchUserInfo();
        setUserInfo(userInfoData);
      }

      const hasCache = await loadFromCache();
      const isStale = await ProposalDatabase.isProposalCacheStale(
        daoAddress,
        chainId,
        2 * 60 * 1000
      );

      if (!hasCache || isStale) {
        await syncFromContract();
      } else {
        console.log('[useDAOContract] ✅ Using cached data');
      }
    } catch (err) {
      console.error('[useDAOContract] ❌ Initial load failed:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [
    daoContract,
    tokenContract,
    daoAddress,
    chainId,
    userAddress,
    fetchDAOInfo,
    fetchUserInfo,
    loadFromCache,
    syncFromContract,
  ]);

  /**
   * Refresh all data (manual refresh)
   */
  const refresh = useCallback(async () => {
    console.log('[useDAOContract] 🔄 Manual refresh triggered');
    await syncFromContract();
  }, [syncFromContract]);

  /**
   * Get user's vote for a specific proposal
   */
  const getUserVote = useCallback(
    async (proposalId) => {
      if (!userAddress || !daoContract) return null;

      try {
        const cachedVote = await ProposalDatabase.getUserVote(
          daoAddress,
          chainId,
          proposalId,
          userAddress
        );

        if (cachedVote) return cachedVote;

        const voteOption = await daoContract.votesCast(userAddress, proposalId);
        const hasVoted = await daoContract.hasVotedIndependently(userAddress, proposalId);

        if (!hasVoted) return null;

        return {
          proposalId,
          voteOption: Number(voteOption),
          voteWeight: '0',
          votedAt: Date.now(),
        };
      } catch (err) {
        console.error('[useDAOContract] ❌ Error getting user vote:', err);
        return null;
      }
    },
    [daoAddress, chainId, userAddress, daoContract]
  );

  /**
   * Get proposals grouped by status
   */
  const getProposalsByStatus = useCallback(() => {
    return {
      active: proposals.filter((p) => p.status === ProposalStatus.ACTIVE),
      queued: proposals.filter((p) => p.status === ProposalStatus.QUEUED),
      executed: proposals.filter((p) => p.status === ProposalStatus.EXECUTED),
      failed: proposals.filter((p) => p.status === ProposalStatus.FAILED),
      cancelled: proposals.filter((p) => p.status === ProposalStatus.CANCELLED),
    };
  }, [proposals]);

  /**
   * Check if user can execute a proposal
   */
  const canExecuteProposal = useCallback(
    async (proposalId) => {
      if (!daoContract) return false;

      try {
        return await daoContract.canExecute(proposalId);
      } catch (err) {
        console.error('[useDAOContract] ❌ Error checking canExecute:', err);
        return false;
      }
    },
    [daoContract]
  );

  /**
   * Get DAO treasury balance
   */
  const getTreasuryBalance = useCallback(async () => {
    if (!tokenContract || !daoAddress) {
      console.log('[useDAOContract] ⚠️ Missing token contract or DAO address');
      return { raw: '0', formatted: '0', decimals: 18 };
    }

    try {
      console.log('[useDAOContract] 💰 Fetching treasury balance...');
      
      const [balance, decimals] = await Promise.all([
        tokenContract.balanceOf(daoAddress),
        tokenContract.decimals(),
      ]);

      console.log('[useDAOContract] 💰 Treasury:', formatUnits(balance, decimals));

      return {
        raw: balance.toString(),
        formatted: formatUnits(balance, decimals),
        decimals: Number(decimals),
      };
    } catch (err) {
      console.error('[useDAOContract] ❌ Error getting treasury balance:', err);
      return { raw: '0', formatted: '0', decimals: 18 };
    }
  }, [tokenContract, daoAddress]);

  // ==================== TRANSACTION PARAMS GENERATORS ====================

  const getVoteParams = useCallback(
    (proposalId, voteOption) => ({
      contractAddress: daoAddress,
      contractABI: DAO_CONTRACT_ABI,
      functionName: 'vote',
      args: [proposalId, voteOption],
      value: '0',
      title: 'Cast Vote',
      description: `Vote on proposal #${proposalId}`,
      onSuccess: () => {
        console.log('[useDAOContract] ✅ Vote successful, refreshing...');
        refresh();
      },
    }),
    [daoAddress, refresh]
  );

  const getDelegateParams = useCallback(
    (delegateeAddress) => ({
      contractAddress: daoAddress,
      contractABI: DAO_CONTRACT_ABI,
      functionName: 'delegate',
      args: [delegateeAddress],
      value: '0',
      title: 'Delegate Voting Power',
      description: `Delegate to ${delegateeAddress.slice(0, 6)}...${delegateeAddress.slice(-4)}`,
      onSuccess: () => {
        console.log('[useDAOContract] ✅ Delegation successful, refreshing...');
        refresh();
      },
    }),
    [daoAddress, refresh]
  );

  const getUndelegateParams = useCallback(
    () => ({
      contractAddress: daoAddress,
      contractABI: DAO_CONTRACT_ABI,
      functionName: 'undelegate',
      args: [],
      value: '0',
      title: 'Revoke Delegation',
      description: 'Revoke your delegation and reclaim your voting power',
      onSuccess: () => {
        console.log('[useDAOContract] ✅ Undelegation successful, refreshing...');
        refresh();
      },
    }),
    [daoAddress, refresh]
  );

  const getFundingProposalParams = useCallback(
    (title, description, amount, recipientAddress) => {
      const tokenDecimals = userInfo?.tokenDecimals || 18;
      const amountInWei = parseUnits(amount, tokenDecimals);
      
      return {
        contractAddress: daoAddress,
        contractABI: DAO_CONTRACT_ABI,
        functionName: 'createFundingProposal',
        args: [title, description, amountInWei.toString(), recipientAddress],
        value: '0',
        title: 'Create Funding Proposal',
        description: `Request ${amount} tokens for: ${title}`,
        onSuccess: () => {
          console.log('[useDAOContract] ✅ Funding proposal created, refreshing...');
          refresh();
        },
      };
    },
    [daoAddress, userInfo, refresh]
  );

  const getGenericProposalParams = useCallback(
    (title, description) => ({
      contractAddress: daoAddress,
      contractABI: DAO_CONTRACT_ABI,
      functionName: 'createGenericProposal',
      args: [title, description],
      value: '0',
      title: 'Create Proposal',
      description: title,
      onSuccess: () => {
        console.log('[useDAOContract] ✅ Generic proposal created, refreshing...');
        refresh();
      },
    }),
    [daoAddress, refresh]
  );

  const getProtocolUpgradeParams = useCallback(
    (title, description, action, newValue, newTokenAddress) => ({
      contractAddress: daoAddress,
      contractABI: DAO_CONTRACT_ABI,
      functionName: 'createProtocolUpgradeProposal',
      args: [title, description, action, newValue, newTokenAddress],
      value: '0',
      title: 'Create Protocol Upgrade',
      description: title,
      onSuccess: () => {
        console.log('[useDAOContract] ✅ Protocol upgrade created, refreshing...');
        refresh();
      },
    }),
    [daoAddress, refresh]
  );

  const getFinalizeProposalParams = useCallback(
    (proposalId) => ({
      contractAddress: daoAddress,
      contractABI: DAO_CONTRACT_ABI,
      functionName: 'finalizeProposal',
      args: [proposalId],
      value: '0',
      title: 'Finalize Proposal',
      description: `Finalize proposal #${proposalId} after voting period`,
      onSuccess: () => {
        console.log('[useDAOContract] ✅ Proposal finalized, refreshing...');
        refresh();
      },
    }),
    [daoAddress, refresh]
  );

  const getExecuteProposalParams = useCallback(
    (proposalId) => ({
      contractAddress: daoAddress,
      contractABI: DAO_CONTRACT_ABI,
      functionName: 'executeProposal',
      args: [proposalId],
      value: '0',
      title: 'Execute Proposal',
      description: `Execute queued proposal #${proposalId}`,
      onSuccess: () => {
        console.log('[useDAOContract] ✅ Proposal executed, refreshing...');
        refresh();
      },
    }),
    [daoAddress, refresh]
  );

  const getCancelProposalParams = useCallback(
    (proposalId) => ({
      contractAddress: daoAddress,
      contractABI: DAO_CONTRACT_ABI,
      functionName: 'cancelProposal',
      args: [proposalId],
      value: '0',
      title: 'Cancel Proposal',
      description: `Cancel proposal #${proposalId}`,
      onSuccess: () => {
        console.log('[useDAOContract] ✅ Proposal canceled, refreshing...');
        refresh();
      },
    }),
    [daoAddress, refresh]
  );

  // Effect: Trigger initial load when contracts are ready
  useEffect(() => {
    if (daoContract && tokenContract && daoAddress && chainId) {
      console.log('[useDAOContract] 🎯 Contracts ready, triggering initial load');
      initialLoad();
    }
  }, [daoContract, tokenContract, daoAddress, chainId, initialLoad]);

  // Cleanup effect
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      console.log('[useDAOContract] 🧹 Component unmounted');
    };
  }, []);

  // Computed values
  const isTokenHolder = userInfo?.isTokenHolder || false;
  const canCreateProposal = userInfo?.isTokenHolder && 
    BigInt(userInfo?.tokenBalance || '0') >= BigInt(daoInfo?.proposalThreshold || '0');

  return {
    // State
    daoInfo,
    userInfo,
    proposals,
    isLoading,
    isSyncing,
    error,
    dataSource,
    chainId,

    // Contracts (accessible but shouldn't be used directly in most cases)
    daoContract,
    tokenContract,

    // Data fetching
    refresh,
    getTreasuryBalance,
    getUserVote,
    getProposalsByStatus,
    canExecuteProposal,

    // Transaction param generators
    getVoteParams,
    getDelegateParams,
    getUndelegateParams,
    getFundingProposalParams,
    getGenericProposalParams,
    getProtocolUpgradeParams,
    getFinalizeProposalParams,
    getExecuteProposalParams,
    getCancelProposalParams,

    // Computed
    totalProposals: proposals.length,
    activeProposalsCount: proposals.filter((p) => p.status === ProposalStatus.ACTIVE).length,
    isTokenHolder,
    canCreateProposal,
  };
};