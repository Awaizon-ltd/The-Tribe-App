// utils/ProposalDatabase.js
import { getDatabase } from './Database';

/**
 * Format proposal data for database storage
 */
const formatProposalForDB = (proposal, daoAddress, chainId) => {
  return {
    proposalId: proposal.id || proposal.proposalId,
    daoAddress: daoAddress.toLowerCase(),
    chainId: chainId,
    title: proposal.title,
    description: proposal.description,
    amount: proposal.amount?.toString() || '0',
    recipient: proposal.recipient || null,
    proposalType: proposal.proposalType,
    protocolAction: proposal.protocolAction || null,
    newValue: proposal.newValue?.toString() || null,
    newTokenAddress: proposal.newTokenAddress || null,
    forVotes: proposal.forVotes?.toString() || '0',
    againstVotes: proposal.againstVotes?.toString() || '0',
    abstainVotes: proposal.abstainVotes?.toString() || '0',
    status: proposal.status,
    timestamp: proposal.timestamp,
    queuedTimestamp: proposal.queuedTimestamp || null,
    creator: proposal.creator.toLowerCase(),
  };
};

/**
 * Format proposal data from database
 */
const formatProposalFromDB = (row) => {
  return {
    id: row.proposal_id,
    proposalId: row.proposal_id,
    daoAddress: row.dao_address,
    chainId: row.chain_id,
    title: row.title,
    description: row.description,
    amount: row.amount,
    recipient: row.recipient,
    proposalType: row.proposal_type,
    protocolAction: row.protocol_action,
    newValue: row.new_value,
    newTokenAddress: row.new_token_address,
    forVotes: row.for_votes,
    againstVotes: row.against_votes,
    abstainVotes: row.abstain_votes,
    status: row.status,
    timestamp: row.timestamp,
    queuedTimestamp: row.queued_timestamp,
    creator: row.creator,
    cachedAt: row.cached_at,
  };
};

/**
 * Save single proposal to cache
 */
export const cacheProposal = async (proposalData, daoAddress, chainId) => {
  const db = getDatabase();
  
  try {
    const formatted = formatProposalForDB(proposalData, daoAddress, chainId);
    
    await db.runAsync(
      `INSERT OR REPLACE INTO proposals (
        proposal_id, dao_address, chain_id, title, description, amount, recipient,
        proposal_type, protocol_action, new_value, new_token_address,
        for_votes, against_votes, abstain_votes, status, timestamp,
        queued_timestamp, creator, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        formatted.proposalId,
        formatted.daoAddress,
        formatted.chainId,
        formatted.title,
        formatted.description,
        formatted.amount,
        formatted.recipient,
        formatted.proposalType,
        formatted.protocolAction,
        formatted.newValue,
        formatted.newTokenAddress,
        formatted.forVotes,
        formatted.againstVotes,
        formatted.abstainVotes,
        formatted.status,
        formatted.timestamp,
        formatted.queuedTimestamp,
        formatted.creator,
        Date.now(),
      ]
    );
    
    console.log(`[Proposal Cache] ✅ Saved proposal ${formatted.proposalId}`);
  } catch (error) {
    console.error('[Proposal Cache] ❌ Error saving proposal:', error);
    throw error;
  }
};

/**
 * Batch save proposals
 */
export const batchCacheProposals = async (proposals, daoAddress, chainId) => {
  try {
    for (const proposal of proposals) {
      await cacheProposal(proposal, daoAddress, chainId);
    }
    
    console.log(`[Proposal Cache] ✅ Batch saved ${proposals.length} proposals`);
  } catch (error) {
    console.error('[Proposal Cache] ❌ Batch save error:', error);
    throw error;
  }
};

/**
 * Get all cached proposals for a DAO
 */
export const getCachedProposals = async (daoAddress, chainId) => {
  const db = getDatabase();
  
  try {
    const proposals = await db.getAllAsync(
      'SELECT * FROM proposals WHERE dao_address = ? AND chain_id = ? ORDER BY timestamp DESC',
      [daoAddress.toLowerCase(), chainId]
    );
    
    return proposals.map(formatProposalFromDB);
  } catch (error) {
    console.error('[Proposal Cache] ❌ Error getting proposals:', error);
    return [];
  }
};

/**
 * Get proposals by status
 */
export const getCachedProposalsByStatus = async (daoAddress, chainId, status) => {
  const db = getDatabase();
  
  try {
    const proposals = await db.getAllAsync(
      'SELECT * FROM proposals WHERE dao_address = ? AND chain_id = ? AND status = ? ORDER BY timestamp DESC',
      [daoAddress.toLowerCase(), chainId, status]
    );
    
    return proposals.map(formatProposalFromDB);
  } catch (error) {
    console.error('[Proposal Cache] ❌ Error getting proposals by status:', error);
    return [];
  }
};

/**
 * Get single proposal
 */
export const getCachedProposal = async (daoAddress, chainId, proposalId) => {
  const db = getDatabase();
  
  try {
    const result = await db.getAllAsync(
      'SELECT * FROM proposals WHERE dao_address = ? AND chain_id = ? AND proposal_id = ? LIMIT 1',
      [daoAddress.toLowerCase(), chainId, proposalId]
    );
    
    return result.length > 0 ? formatProposalFromDB(result[0]) : null;
  } catch (error) {
    console.error('[Proposal Cache] ❌ Error getting proposal:', error);
    return null;
  }
};

/**
 * Cache user vote
 */
export const cacheUserVote = async (daoAddress, chainId, proposalId, userAddress, voteOption, voteWeight) => {
  const db = getDatabase();
  
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO user_votes (
        dao_address, chain_id, proposal_id, user_address, vote_option, vote_weight, voted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        daoAddress.toLowerCase(),
        chainId,
        proposalId,
        userAddress.toLowerCase(),
        voteOption,
        voteWeight.toString(),
        Date.now(),
      ]
    );
    
    console.log(`[Vote Cache] ✅ Saved vote for proposal ${proposalId}`);
  } catch (error) {
    console.error('[Vote Cache] ❌ Error saving vote:', error);
  }
};

/**
 * Get user's vote for a proposal
 */
export const getUserVote = async (daoAddress, chainId, proposalId, userAddress) => {
  const db = getDatabase();
  
  try {
    const result = await db.getAllAsync(
      'SELECT * FROM user_votes WHERE dao_address = ? AND chain_id = ? AND proposal_id = ? AND user_address = ? LIMIT 1',
      [daoAddress.toLowerCase(), chainId, proposalId, userAddress.toLowerCase()]
    );
    
    if (result.length === 0) return null;
    
    return {
      proposalId: result[0].proposal_id,
      voteOption: result[0].vote_option,
      voteWeight: result[0].vote_weight,
      votedAt: result[0].voted_at,
    };
  } catch (error) {
    console.error('[Vote Cache] ❌ Error getting vote:', error);
    return null;
  }
};

/**
 * Get all user's votes for a DAO
 */
export const getUserVotesForDAO = async (daoAddress, chainId, userAddress) => {
  const db = getDatabase();
  
  try {
    const votes = await db.getAllAsync(
      'SELECT * FROM user_votes WHERE dao_address = ? AND chain_id = ? AND user_address = ? ORDER BY voted_at DESC',
      [daoAddress.toLowerCase(), chainId, userAddress.toLowerCase()]
    );
    
    return votes.map(row => ({
      proposalId: row.proposal_id,
      voteOption: row.vote_option,
      voteWeight: row.vote_weight,
      votedAt: row.voted_at,
    }));
  } catch (error) {
    console.error('[Vote Cache] ❌ Error getting user votes:', error);
    return [];
  }
};

/**
 * Update sync state
 */
export const updateProposalSyncState = async (daoAddress, chainId, totalProposals, error = null) => {
  const db = getDatabase();
  
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO proposal_sync_state (
        dao_address, chain_id, last_sync_timestamp, total_proposals, last_error
      ) VALUES (?, ?, ?, ?, ?)`,
      [daoAddress.toLowerCase(), chainId, Date.now(), totalProposals, error]
    );
    
    console.log(`[Proposal Sync] ✅ Updated sync state for DAO ${daoAddress}`);
  } catch (error) {
    console.error('[Proposal Sync] ❌ Error updating sync state:', error);
  }
};

/**
 * Get sync state
 */
export const getProposalSyncState = async (daoAddress, chainId) => {
  const db = getDatabase();
  
  try {
    const result = await db.getAllAsync(
      'SELECT * FROM proposal_sync_state WHERE dao_address = ? AND chain_id = ? LIMIT 1',
      [daoAddress.toLowerCase(), chainId]
    );
    
    if (result.length === 0) return null;
    
    return {
      daoAddress: result[0].dao_address,
      chainId: result[0].chain_id,
      lastSyncTimestamp: result[0].last_sync_timestamp,
      totalProposals: result[0].total_proposals,
      lastError: result[0].last_error,
    };
  } catch (error) {
    console.error('[Proposal Sync] ❌ Error getting sync state:', error);
    return null;
  }
};

/**
 * Check if cache is stale
 */
export const isProposalCacheStale = async (daoAddress, chainId, expiryMs = 2 * 60 * 1000) => {
  const syncState = await getProposalSyncState(daoAddress, chainId);
  
  if (!syncState) return true;
  
  const timeSinceSync = Date.now() - syncState.lastSyncTimestamp;
  return timeSinceSync > expiryMs;
};

/**
 * Clear proposal cache for DAO
 */
export const clearProposalCache = async (daoAddress, chainId) => {
  const db = getDatabase();
  
  try {
    await db.runAsync(
      'DELETE FROM proposals WHERE dao_address = ? AND chain_id = ?',
      [daoAddress.toLowerCase(), chainId]
    );
    await db.runAsync(
      'DELETE FROM proposal_sync_state WHERE dao_address = ? AND chain_id = ?',
      [daoAddress.toLowerCase(), chainId]
    );
    console.log(`[Proposal Cache] ✅ Cleared cache for DAO ${daoAddress}`);
  } catch (error) {
    console.error('[Proposal Cache] ❌ Error clearing cache:', error);
  }
};

export default {
  cacheProposal,
  batchCacheProposals,
  getCachedProposals,
  getCachedProposalsByStatus,
  getCachedProposal,
  cacheUserVote,
  getUserVote,
  getUserVotesForDAO,
  updateProposalSyncState,
  getProposalSyncState,
  isProposalCacheStale,
  clearProposalCache,
};