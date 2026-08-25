// utils/VoteCalculations.js

/**
 * Vote precision used in smart contract
 * Standard is 1e9 (10^9) for vote calculations
 */
export const VOTE_PRECISION = 1e9;

/**
 * Calculate display votes from blockchain value
 * Votes are already quadratic (√balance) and stored with precision
 */
export const calculateDisplayVotes = (votes) => {
  try {
    if (!votes) return 0;
    
    const votesBigInt = typeof votes === 'string' ? BigInt(votes) : votes;
    const votesNumber = Number(votesBigInt) / VOTE_PRECISION;
    
    return Math.round(votesNumber);
  } catch (error) {
    console.error('[VoteCalc] Error calculating votes:', error);
    return 0;
  }
};

/**
 * Calculate voting power from token balance
 * Used for showing user's potential voting power
 */
export const calculateVotingPower = (balance, decimals = 18) => {
  try {
    if (!balance) return 0;
    
    const balanceBigInt = typeof balance === 'string' ? BigInt(balance) : balance;
    const balanceNumber = Number(balanceBigInt) / Math.pow(10, decimals);
    const power = Math.sqrt(balanceNumber);
    
    return power;
  } catch (error) {
    console.error('[VoteCalc] Error calculating power:', error);
    return 0;
  }
};

/**
 * Calculate required quorum votes
 * Formula from contract: requiredQuorum = (√totalSupply * quorumPercentage) / 100
 * 
 * @param {string|BigInt} totalSupply - Total token supply
 * @param {number} decimals - Token decimals
 * @param {number} quorumPercentage - Quorum percentage (e.g., 20 for 20%)
 * @returns {number} Required quorum in votes (whole number)
 */
export const calculateRequiredQuorum = (totalSupply, decimals, quorumPercentage) => {
  try {
    if (!totalSupply || !quorumPercentage) return 0;
    
    const supplyBigInt = typeof totalSupply === 'string' ? BigInt(totalSupply) : totalSupply;
    
    // Convert to actual token amount
    const supplyNumber = Number(supplyBigInt) / Math.pow(10, decimals);
    
    // √totalSupply
    const sqrtSupply = Math.sqrt(supplyNumber);
    
    // (√totalSupply * quorumPercentage) / 100
    const requiredQuorum = (sqrtSupply * quorumPercentage) / 100;
    
    return Math.round(requiredQuorum);
  } catch (error) {
    console.error('[VoteCalc] Error calculating quorum:', error);
    return 0;
  }
};

/**
 * Format voting power for display
 */
export const formatVotingPower = (power, decimals = 2) => {
  if (power === 0) return '0';
  if (power < 0.01) return '< 0.01';
  return power.toFixed(decimals);
};

/**
 * Calculate votes from balance (preview before voting)
 */
export const calculateVotesFromBalance = (balance, decimals = 18) => {
  const power = calculateVotingPower(balance, decimals);
  return Math.round(power);
};