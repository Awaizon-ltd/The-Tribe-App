// constants/abis/index.js
import DAO_CONTRACT_ABI_JSON from './DAOCoreAbi.json';
import ERC20_ABI_JSON from './ERC20Abi.json';

// Export the ABIs
export const DAO_CONTRACT_ABI = DAO_CONTRACT_ABI_JSON;
export const ERC20_ABI = ERC20_ABI_JSON;

// Enums matching the Solidity contract
export const ProposalStatus = {
  ACTIVE: 0,
  PASSED: 1,
  FAILED: 2,
  QUEUED: 3,
  EXECUTED: 4,
  CANCELLED: 5,
};

export const VoteOption = {
  NONE: 0,
  FOR: 1,
  AGAINST: 2,
  ABSTAIN: 3,
};

export const ProposalType = {
  FUNDING: 0,
  GENERIC: 1,
  PROTOCOL_UPGRADE: 2,
};

export const ProtocolAction = {
  CHANGE_THRESHOLD: 0,
  CHANGE_TOKEN: 1,
  CHANGE_QUORUM: 2,
  CHANGE_TIMELOCK: 3,
  CHANGE_VOTING_PERIOD: 4,
};

// Helper functions
export const getProposalStatusLabel = (status) => {
  const labels = {
    [ProposalStatus.ACTIVE]: 'Active',
    [ProposalStatus.PASSED]: 'Passed',
    [ProposalStatus.FAILED]: 'Failed',
    [ProposalStatus.QUEUED]: 'Queued',
    [ProposalStatus.EXECUTED]: 'Executed',
    [ProposalStatus.CANCELLED]: 'Cancelled',
  };
  return labels[status] || 'Unknown';
};

export const getProposalTypeLabel = (type) => {
  const labels = {
    [ProposalType.FUNDING]: 'Funding',
    [ProposalType.GENERIC]: 'Generic',
    [ProposalType.PROTOCOL_UPGRADE]: 'Protocol Upgrade',
  };
  return labels[type] || 'Unknown';
};

export const getVoteOptionLabel = (option) => {
  const labels = {
    [VoteOption.NONE]: 'None',
    [VoteOption.FOR]: 'For',
    [VoteOption.AGAINST]: 'Against',
    [VoteOption.ABSTAIN]: 'Abstain',
  };
  return labels[option] || 'Unknown';
};

export const getProtocolActionLabel = (action) => {
  const labels = {
    [ProtocolAction.CHANGE_THRESHOLD]: 'Change Threshold',
    [ProtocolAction.CHANGE_TOKEN]: 'Change Token',
    [ProtocolAction.CHANGE_QUORUM]: 'Change Quorum',
    [ProtocolAction.CHANGE_TIMELOCK]: 'Change Timelock',
    [ProtocolAction.CHANGE_VOTING_PERIOD]: 'Change Voting Period',
  };
  return labels[action] || 'Unknown';
};

// Color helpers for UI
export const getProposalStatusColor = (status) => {
  const colors = {
    [ProposalStatus.ACTIVE]: '#3B82F6', // Blue
    [ProposalStatus.PASSED]: '#10B981', // Green
    [ProposalStatus.FAILED]: '#EF4444', // Red
    [ProposalStatus.QUEUED]: '#F59E0B', // Orange
    [ProposalStatus.EXECUTED]: '#D6FF00', // Robinhood Chain lime
    [ProposalStatus.CANCELLED]: '#6B7280', // Gray
  };
  return colors[status] || '#6B7280';
};

export const getVoteOptionColor = (option) => {
  const colors = {
    [VoteOption.FOR]: '#10B981', // Green
    [VoteOption.AGAINST]: '#EF4444', // Red
    [VoteOption.ABSTAIN]: '#F59E0B', // Orange
    [VoteOption.NONE]: '#6B7280', // Gray
  };
  return colors[option] || '#6B7280';
};