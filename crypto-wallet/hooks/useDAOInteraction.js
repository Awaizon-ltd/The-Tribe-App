// hooks/useDelegatedDAO.js
import { useState, useCallback, useEffect } from 'react';
import { Contract } from 'ethers';
import { useWallet } from '../contexts/WalletContext';

/**
 * ✅ Custom Hook for DelegatedDAO Contract Interactions
 * 
 * Provides functions for:
 * - Creating proposals (funding, generic, protocol upgrade)
 * - Voting on proposals
 * - Delegating/undelegating voting power
 * - Finalizing and executing proposals
 * - Reading proposal data
 */
export const useDelegatedDAO = (daoContractAddress, daoContractABI) => {
  const { provider, address } = useWallet();
  
  // State Management
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [daoInfo, setDaoInfo] = useState(null);
  const [userDelegation, setUserDelegation] = useState(null);

  // ✅ Create read-only contract instance
  const getReadContract = useCallback(() => {
    if (!provider || !daoContractAddress || !daoContractABI) {
      throw new Error('Provider, contract address, and ABI are required');
    }
    return new Contract(daoContractAddress, daoContractABI, provider);
  }, [provider, daoContractAddress, daoContractABI]);

  // ========================================
  // 📖 READ FUNCTIONS
  // ========================================

  /**
   * Get basic DAO information
   */
  const fetchDaoInfo = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const contract = getReadContract();
      
      const [
        name,
        imageUrl,
        tokenAddress,
        quorum,
        threshold,
        votingPeriod,
        timelockPeriod,
        proposalCount,
        owner,
      ] = await Promise.all([
        contract.name(),
        contract.imageUrl(),
        contract.token(),
        contract.quorumPercentage(),
        contract.proposalThreshold(),
        contract.votingPeriodHours(),
        contract.timelockPeriodHours(),
        contract.proposalCount(),
        contract.owner(),
      ]);

      const info = {
        name,
        imageUrl,
        tokenAddress,
        quorumPercentage: Number(quorum),
        proposalThreshold: threshold.toString(),
        votingPeriodHours: Number(votingPeriod),
        timelockPeriodHours: Number(timelockPeriod),
        proposalCount: Number(proposalCount),
        owner,
      };

      setDaoInfo(info);
      return info;
    } catch (err) {
      console.error('[useDelegatedDAO] Error fetching DAO info:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getReadContract]);

  /**
   * Get proposal details by ID
   */
  const getProposal = useCallback(async (proposalId) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const contract = getReadContract();
      const proposal = await contract.getProposal(proposalId);
      
      return {
        id: Number(proposal.id),
        title: proposal.title,
        description: proposal.description,
        amount: proposal.amount.toString(),
        recipient: proposal.recipient,
        proposalType: Number(proposal.proposalType),
        protocolAction: Number(proposal.protocolAction),
        newValue: proposal.newValue.toString(),
        newTokenAddress: proposal.newTokenAddress,
        forVotes: proposal.forVotes.toString(),
        againstVotes: proposal.againstVotes.toString(),
        abstainVotes: proposal.abstainVotes.toString(),
        status: Number(proposal.status),
        timestamp: Number(proposal.timestamp),
        queuedTimestamp: Number(proposal.queuedTimestamp),
        creator: proposal.creator,
      };
    } catch (err) {
      console.error('[useDelegatedDAO] Error getting proposal:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getReadContract]);

  /**
   * Get all proposals
   */
  const getAllProposals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const contract = getReadContract();
      const count = await contract.proposalCount();
      const totalProposals = Number(count);
      
      if (totalProposals === 0) {
        return [];
      }

      const proposals = await Promise.all(
        Array.from({ length: totalProposals }, (_, i) => 
          getProposal(i + 1)
        )
      );

      return proposals;
    } catch (err) {
      console.error('[useDelegatedDAO] Error getting all proposals:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getReadContract, getProposal]);

  /**
   * Check if proposal can be executed
   */
  const canExecuteProposal = useCallback(async (proposalId) => {
    try {
      const contract = getReadContract();
      return await contract.canExecute(proposalId);
    } catch (err) {
      console.error('[useDelegatedDAO] Error checking execution status:', err);
      throw err;
    }
  }, [getReadContract]);

  /**
   * Get user's delegation info
   */
  const getUserDelegation = useCallback(async (userAddress = address) => {
    try {
      if (!userAddress) {
        throw new Error('User address is required');
      }

      setIsLoading(true);
      setError(null);
      
      const contract = getReadContract();
      
      const [
        delegatee,
        delegatedBalance,
        delegatorCount,
        votesReceived,
      ] = await Promise.all([
        contract.delegatorDelegatee(userAddress),
        contract.delegatorBalance(userAddress),
        contract.delegateeDelegatorCount(userAddress),
        contract.delegateeVotesReceived(userAddress),
      ]);

      const delegation = {
        delegatee,
        delegatedBalance: delegatedBalance.toString(),
        delegatorCount: Number(delegatorCount),
        votesReceived: votesReceived.toString(),
        isDelegating: delegatee !== '0x0000000000000000000000000000000000000000',
        isDelegatee: Number(delegatorCount) > 0,
      };

      setUserDelegation(delegation);
      return delegation;
    } catch (err) {
      console.error('[useDelegatedDAO] Error getting delegation info:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getReadContract, address]);

  /**
   * Check if user has voted on a proposal
   */
  const getUserVote = useCallback(async (proposalId, userAddress = address) => {
    try {
      if (!userAddress) {
        throw new Error('User address is required');
      }

      const contract = getReadContract();
      const voteOption = await contract.votesCast(userAddress, proposalId);
      const hasVoted = await contract.hasVotedIndependently(userAddress, proposalId);
      
      return {
        voteOption: Number(voteOption), // 0=None, 1=For, 2=Against, 3=Abstain
        hasVoted,
      };
    } catch (err) {
      console.error('[useDelegatedDAO] Error getting user vote:', err);
      throw err;
    }
  }, [getReadContract, address]);

  // ========================================
  // ✍️ WRITE FUNCTION CONFIGS (for TransactionModal)
  // ========================================

  /**
   * Create Funding Proposal Transaction Config
   */
  const createFundingProposalConfig = useCallback((title, description, amount, recipient) => {
    return {
      contractAddress: daoContractAddress,
      contractABI: daoContractABI,
      functionName: 'createFundingProposal',
      args: [title, description, amount, recipient],
      value: '0',
      title: 'Create Funding Proposal',
      description: `Create a proposal to transfer ${amount} tokens to ${recipient}`,
    };
  }, [daoContractAddress, daoContractABI]);

  /**
   * Create Generic Proposal Transaction Config
   */
  const createGenericProposalConfig = useCallback((title, description) => {
    return {
      contractAddress: daoContractAddress,
      contractABI: daoContractABI,
      functionName: 'createGenericProposal',
      args: [title, description],
      value: '0',
      title: 'Create Generic Proposal',
      description: `Create a proposal: ${title}`,
    };
  }, [daoContractAddress, daoContractABI]);

  /**
   * Create Protocol Upgrade Proposal Transaction Config
   * 
   * @param {string} title - Proposal title
   * @param {string} description - Proposal description
   * @param {number} action - ProtocolAction enum (0-4)
   *   0: ChangeThreshold
   *   1: ChangeToken
   *   2: ChangeQuorum
   *   3: ChangeTimelock
   *   4: ChangeVotingPeriod
   * @param {string} newValue - New value for the parameter
   * @param {string} newTokenAddress - New token address (only for ChangeToken)
   */
  const createProtocolUpgradeProposalConfig = useCallback((
    title, 
    description, 
    action, 
    newValue, 
    newTokenAddress = '0x0000000000000000000000000000000000000000'
  ) => {
    const actionNames = [
      'Change Threshold',
      'Change Token',
      'Change Quorum',
      'Change Timelock',
      'Change Voting Period'
    ];

    return {
      contractAddress: daoContractAddress,
      contractABI: daoContractABI,
      functionName: 'createProtocolUpgradeProposal',
      args: [title, description, action, newValue, newTokenAddress],
      value: '0',
      title: 'Create Protocol Upgrade',
      description: `${actionNames[action]}: ${title}`,
    };
  }, [daoContractAddress, daoContractABI]);

  /**
   * Vote on Proposal Transaction Config
   * 
   * @param {number} proposalId - Proposal ID
   * @param {number} voteOption - Vote option (1=For, 2=Against, 3=Abstain)
   */
  const voteConfig = useCallback((proposalId, voteOption) => {
    const voteLabels = { 1: 'For', 2: 'Against', 3: 'Abstain' };
    
    return {
      contractAddress: daoContractAddress,
      contractABI: daoContractABI,
      functionName: 'vote',
      args: [proposalId, voteOption],
      value: '0',
      title: 'Cast Vote',
      description: `Vote ${voteLabels[voteOption]} on Proposal #${proposalId}`,
    };
  }, [daoContractAddress, daoContractABI]);

  /**
   * Delegate Voting Power Transaction Config
   */
  const delegateConfig = useCallback((delegateeAddress) => {
    return {
      contractAddress: daoContractAddress,
      contractABI: daoContractABI,
      functionName: 'delegate',
      args: [delegateeAddress],
      value: '0',
      title: 'Delegate Voting Power',
      description: `Delegate your voting power to ${delegateeAddress}`,
    };
  }, [daoContractAddress, daoContractABI]);

  /**
   * Undelegate Voting Power Transaction Config
   */
  const undelegateConfig = useCallback(() => {
    return {
      contractAddress: daoContractAddress,
      contractABI: daoContractABI,
      functionName: 'undelegate',
      args: [],
      value: '0',
      title: 'Revoke Delegation',
      description: 'Revoke your delegated voting power and reclaim your tokens',
    };
  }, [daoContractAddress, daoContractABI]);

  /**
   * Finalize Proposal Transaction Config
   */
  const finalizeProposalConfig = useCallback((proposalId) => {
    return {
      contractAddress: daoContractAddress,
      contractABI: daoContractABI,
      functionName: 'finalizeProposal',
      args: [proposalId],
      value: '0',
      title: 'Finalize Proposal',
      description: `Finalize Proposal #${proposalId} and queue for execution`,
    };
  }, [daoContractAddress, daoContractABI]);

  /**
   * Execute Proposal Transaction Config
   */
  const executeProposalConfig = useCallback((proposalId) => {
    return {
      contractAddress: daoContractAddress,
      contractABI: daoContractABI,
      functionName: 'executeProposal',
      args: [proposalId],
      value: '0',
      title: 'Execute Proposal',
      description: `Execute Proposal #${proposalId}`,
    };
  }, [daoContractAddress, daoContractABI]);

  /**
   * Cancel Proposal Transaction Config
   */
  const cancelProposalConfig = useCallback((proposalId) => {
    return {
      contractAddress: daoContractAddress,
      contractABI: daoContractABI,
      functionName: 'cancelProposal',
      args: [proposalId],
      value: '0',
      title: 'Cancel Proposal',
      description: `Cancel Proposal #${proposalId}`,
    };
  }, [daoContractAddress, daoContractABI]);

  // ========================================
  // 🔄 HELPER FUNCTIONS
  // ========================================

  /**
   * Get proposal status label
   */
  const getProposalStatusLabel = useCallback((status) => {
    const labels = {
      0: 'Active',
      1: 'Passed',
      2: 'Failed',
      3: 'Queued',
      4: 'Executed',
      5: 'Cancelled',
    };
    return labels[status] || 'Unknown';
  }, []);

  /**
   * Get proposal type label
   */
  const getProposalTypeLabel = useCallback((type) => {
    const labels = {
      0: 'Funding',
      1: 'Generic',
      2: 'Protocol Upgrade',
    };
    return labels[type] || 'Unknown';
  }, []);

  /**
   * Get protocol action label
   */
  const getProtocolActionLabel = useCallback((action) => {
    const labels = {
      0: 'Change Threshold',
      1: 'Change Token',
      2: 'Change Quorum',
      3: 'Change Timelock',
      4: 'Change Voting Period',
    };
    return labels[action] || 'Unknown';
  }, []);

  /**
   * Calculate time remaining for voting
   */
  const getVotingTimeRemaining = useCallback((proposalTimestamp, votingPeriodHours) => {
    const now = Math.floor(Date.now() / 1000);
    const endTime = proposalTimestamp + (votingPeriodHours * 3600);
    const remaining = endTime - now;
    
    if (remaining <= 0) {
      return { isActive: false, remainingSeconds: 0, remainingHours: 0 };
    }
    
    return {
      isActive: true,
      remainingSeconds: remaining,
      remainingHours: Math.floor(remaining / 3600),
      remainingMinutes: Math.floor((remaining % 3600) / 60),
    };
  }, []);

  /**
   * Calculate time remaining until execution
   */
  const getExecutionTimeRemaining = useCallback((queuedTimestamp, timelockPeriodHours) => {
    const now = Math.floor(Date.now() / 1000);
    const executionTime = queuedTimestamp + (timelockPeriodHours * 3600);
    const remaining = executionTime - now;
    
    if (remaining <= 0) {
      return { canExecute: true, remainingSeconds: 0, remainingHours: 0 };
    }
    
    return {
      canExecute: false,
      remainingSeconds: remaining,
      remainingHours: Math.floor(remaining / 3600),
      remainingMinutes: Math.floor((remaining % 3600) / 60),
    };
  }, []);

  /**
   * Calculate vote percentages
   */
  const calculateVotePercentages = useCallback((forVotes, againstVotes, abstainVotes) => {
    const total = BigInt(forVotes) + BigInt(againstVotes) + BigInt(abstainVotes);
    
    if (total === 0n) {
      return { forPercent: 0, againstPercent: 0, abstainPercent: 0 };
    }
    
    return {
      forPercent: Number((BigInt(forVotes) * 100n) / total),
      againstPercent: Number((BigInt(againstVotes) * 100n) / total),
      abstainPercent: Number((BigInt(abstainVotes) * 100n) / total),
      totalVotes: total.toString(),
    };
  }, []);

  // ========================================
  // 🎣 AUTO-FETCH ON MOUNT
  // ========================================

  useEffect(() => {
    if (daoContractAddress && daoContractABI && provider) {
      fetchDaoInfo();
      if (address) {
        getUserDelegation();
      }
    }
  }, [daoContractAddress, daoContractABI, provider, address]);

  // ========================================
  // 📤 RETURN VALUES
  // ========================================

  return {
    // State
    isLoading,
    error,
    daoInfo,
    userDelegation,

    // Read Functions
    fetchDaoInfo,
    getProposal,
    getAllProposals,
    canExecuteProposal,
    getUserDelegation,
    getUserVote,

    // Transaction Configs (for use with TransactionModal)
    createFundingProposalConfig,
    createGenericProposalConfig,
    createProtocolUpgradeProposalConfig,
    voteConfig,
    delegateConfig,
    undelegateConfig,
    finalizeProposalConfig,
    executeProposalConfig,
    cancelProposalConfig,

    // Helper Functions
    getProposalStatusLabel,
    getProposalTypeLabel,
    getProtocolActionLabel,
    getVotingTimeRemaining,
    getExecutionTimeRemaining,
    calculateVotePercentages,
  };
};

export default useDelegatedDAO;