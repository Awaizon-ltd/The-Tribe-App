// screens/dao/ProposalDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { formatUnits } from 'ethers';
import Card from '../../components/common/Card';
import { TransactionModal } from '../../components/TransactionModal';
import { ProposalChatModal } from '../../components/dao/chat/ProposalChatModal';
import { useDAOContract } from '../../hooks/useDAOContract';
import { useChain } from '../../contexts/ChainContext';
import { COLORS, SPACING, FONTS, BORDER_RADIUS, SHADOWS } from '../../constants/Theme';
import {
  ProposalStatus,
  VoteOption,
  ProposalType,
  ProtocolAction,
  getProposalStatusLabel,
  getProposalTypeLabel,
  getProposalStatusColor,
} from '../../abi/index';
import Alert from '../../utils/Alert';

export function ProposalDetailScreen({ route, navigation }) {
  const { proposal: initialProposal, daoAddress } = route.params;
  const { chainId } = useChain();
  
  const {
    daoInfo,
    userInfo,
    proposals,
    isSyncing,
    refresh,
    getVoteParams,
    getFinalizeProposalParams,
    getExecuteProposalParams,
    getCancelProposalParams,
    getUserVote,
    canExecuteProposal,
  } = useDAOContract(daoAddress);

  const [proposal, setProposal] = useState(initialProposal);
  const [userVote, setUserVote] = useState(null);
  const [canExecute, setCanExecute] = useState(false);
  const [txModalVisible, setTxModalVisible] = useState(false);
  const [txParams, setTxParams] = useState(null);
  const [loadingVote, setLoadingVote] = useState(true);
  const [chatModalVisible, setChatModalVisible] = useState(false);

  // Update proposal from latest data
  useEffect(() => {
    const updatedProposal = proposals.find(p => p.id === initialProposal.id);
    if (updatedProposal) {
      setProposal(updatedProposal);
    }
  }, [proposals, initialProposal.id]);

  // Load user vote
  useEffect(() => {
    const loadVote = async () => {
      if (!userInfo) {
        setLoadingVote(false);
        return;
      }
      
      setLoadingVote(true);
      const vote = await getUserVote(proposal.id);
      setUserVote(vote);
      setLoadingVote(false);
    };

    loadVote();
  }, [proposal.id, userInfo, getUserVote]);

  // Check if proposal can be executed
  useEffect(() => {
    const checkExecute = async () => {
      if (proposal.status === ProposalStatus.QUEUED) {
        const executable = await canExecuteProposal(proposal.id);
        setCanExecute(executable);
      }
    };

    checkExecute();
  }, [proposal.status, proposal.id, canExecuteProposal]);

  // Calculate quadratic votes as whole numbers
  const calculateVotes = (votes) => {
    const votesBigInt = BigInt(votes);
    const sqrtVotes = Math.sqrt(Number(formatUnits(votesBigInt, userInfo?.tokenDecimals || 18)));
    return Math.round(sqrtVotes);
  };

  const forVotes = calculateVotes(proposal.forVotes);
  const againstVotes = calculateVotes(proposal.againstVotes);
  const abstainVotes = calculateVotes(proposal.abstainVotes);
  const totalVotes = forVotes + againstVotes + abstainVotes;

  // Calculate percentages for progress bar
  const forPercentage = totalVotes > 0 ? (forVotes / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (againstVotes / totalVotes) * 100 : 0;
  const abstainPercentage = totalVotes > 0 ? (abstainVotes / totalVotes) * 100 : 0;

  // Calculate quorum
  const requiredQuorum = daoInfo ? Math.round((daoInfo.quorumPercentage / 100) * totalVotes) : 0;
  const hasMetQuorum = forVotes >= requiredQuorum;

  // Check if voting period has ended
  const votingEndTime = proposal.timestamp + (daoInfo?.votingPeriodHours || 72) * 3600;
  const hasVotingEnded = Date.now() / 1000 >= votingEndTime;
  const canFinalize = proposal.status === ProposalStatus.ACTIVE && hasVotingEnded;

  // Check if chat should be locked (voting ended AND proposal finalized)
  const isChatLocked = hasVotingEnded && 
    (proposal.status === ProposalStatus.EXECUTED || 
     proposal.status === ProposalStatus.FAILED ||
     proposal.status === ProposalStatus.CANCELLED);

  // Check if user has voted
  const hasVoted = userVote && userVote.voteOption !== VoteOption.NONE;

  // Check if user is creator
  const isCreator = userInfo && proposal.creator.toLowerCase() === userInfo.address?.toLowerCase();

  // Format time remaining
  const getTimeRemaining = () => {
    if (hasVotingEnded) return 'Voting ended';
    
    const now = Date.now() / 1000;
    const remaining = votingEndTime - now;
    const hours = Math.floor(remaining / 3600);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    return `${hours}h remaining`;
  };

  // Format date
  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get protocol action details
  const getProtocolActionDetails = () => {
    const actions = {
      [ProtocolAction.CHANGE_THRESHOLD]: 'Change Proposal Threshold',
      [ProtocolAction.CHANGE_TOKEN]: 'Change Governance Token',
      [ProtocolAction.CHANGE_QUORUM]: 'Change Quorum Percentage',
      [ProtocolAction.CHANGE_TIMELOCK]: 'Change Timelock Period',
      [ProtocolAction.CHANGE_VOTING_PERIOD]: 'Change Voting Period',
    };
    return actions[proposal.protocolAction] || 'Unknown Action';
  };

  // Handle vote
  const handleVote = (voteOption) => {
    const params = getVoteParams(proposal.id, voteOption);
    
    // Wrap onSuccess to reload vote
    const originalOnSuccess = params.onSuccess;
    params.onSuccess = async () => {
      if (originalOnSuccess) await originalOnSuccess();
      const vote = await getUserVote(proposal.id);
      setUserVote(vote);
    };
    
    setTxParams(params);
    setTxModalVisible(true);
  };

  // Handle finalize
  const handleFinalize = () => {
    const params = getFinalizeProposalParams(proposal.id);
    setTxParams(params);
    setTxModalVisible(true);
  };

  // Handle execute
  const handleExecute = () => {
    const params = getExecuteProposalParams(proposal.id);
    setTxParams(params);
    setTxModalVisible(true);
  };

  // Handle cancel
  const handleCancel = () => {
    Alert.alert(
      'Cancel Proposal',
      'Are you sure you want to cancel this proposal? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            const params = getCancelProposalParams(proposal.id);
            setTxParams(params);
            setTxModalVisible(true);
          }
        }
      ]
    );
  };

  const handleRefresh = async () => {
    await refresh();
    const vote = await getUserVote(proposal.id);
    setUserVote(vote);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proposal #{proposal.id}</Text>
        
        {/* Header Actions */}
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={() => setChatModalVisible(true)} 
            style={styles.headerButton}
          >
            <Ionicons name="chatbubbles" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleRefresh} 
            disabled={isSyncing} 
            style={styles.headerButton}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="refresh" size={24} color={COLORS.text} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Status & Type Badges */}
        <View style={styles.badgeRow}>
          <View style={[styles.statusBadge, { backgroundColor: getProposalStatusColor(proposal.status) + '20' }]}>
            <Text style={[styles.statusBadgeText, { color: getProposalStatusColor(proposal.status) }]}>
              {getProposalStatusLabel(proposal.status)}
            </Text>
          </View>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{getProposalTypeLabel(proposal.proposalType)}</Text>
          </View>
          {hasVoted && (
            <View style={styles.votedBadge}>
              <Ionicons name="checkmark-done" size={14} color={COLORS.success} />
              <Text style={styles.votedBadgeText}>Voted</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>{proposal.title}</Text>

        {/* Creator & Date */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>
              {proposal.creator.slice(0, 6)}...{proposal.creator.slice(-4)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>{formatDate(proposal.timestamp)}</Text>
          </View>
        </View>

        {/* Description */}
        <Card style={styles.descriptionCard}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{proposal.description}</Text>
        </Card>

        {/* Funding Details */}
        {proposal.proposalType === ProposalType.FUNDING && BigInt(proposal.amount) > 0n && (
          <Card style={styles.fundingCard}>
            <Text style={styles.sectionTitle}>Funding Request</Text>
            <View style={styles.fundingRow}>
              <View style={styles.fundingItem}>
                <Text style={styles.fundingLabel}>Amount</Text>
                <Text style={styles.fundingValue}>
                  {formatUnits(proposal.amount, userInfo?.tokenDecimals || 18)} {userInfo?.tokenSymbol}
                </Text>
              </View>
            </View>
            <View style={styles.fundingRow}>
              <View style={styles.fundingItem}>
                <Text style={styles.fundingLabel}>Recipient</Text>
                <Text style={styles.fundingAddress}>
                  {proposal.recipient}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Protocol Upgrade Details */}
        {proposal.proposalType === ProposalType.PROTOCOL_UPGRADE && (
          <Card style={styles.protocolCard}>
            <Text style={styles.sectionTitle}>Protocol Change</Text>
            <View style={styles.protocolRow}>
              <Text style={styles.protocolLabel}>Action:</Text>
              <Text style={styles.protocolValue}>{getProtocolActionDetails()}</Text>
            </View>
            {proposal.protocolAction !== ProtocolAction.CHANGE_TOKEN && (
              <View style={styles.protocolRow}>
                <Text style={styles.protocolLabel}>New Value:</Text>
                <Text style={styles.protocolValue}>{proposal.newValue}</Text>
              </View>
            )}
            {proposal.protocolAction === ProtocolAction.CHANGE_TOKEN && (
              <View style={styles.protocolRow}>
                <Text style={styles.protocolLabel}>New Token:</Text>
                <Text style={styles.protocolAddress}>{proposal.newTokenAddress}</Text>
              </View>
            )}
          </Card>
        )}

        {/* Voting Stats */}
        <Card style={styles.votingCard}>
          <View style={styles.votingHeader}>
            <Text style={styles.sectionTitle}>Voting Results</Text>
            {proposal.status === ProposalStatus.ACTIVE && (
              <Text style={styles.timeRemaining}>{getTimeRemaining()}</Text>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              {forPercentage > 0 && (
                <View style={[styles.progressSegment, styles.forSegment, { width: `${forPercentage}%` }]} />
              )}
              {againstPercentage > 0 && (
                <View style={[styles.progressSegment, styles.againstSegment, { width: `${againstPercentage}%` }]} />
              )}
              {abstainPercentage > 0 && (
                <View style={[styles.progressSegment, styles.abstainSegment, { width: `${abstainPercentage}%` }]} />
              )}
            </View>
          </View>

          {/* Vote Counts */}
          <View style={styles.voteStats}>
            <View style={styles.voteStat}>
              <View style={styles.voteStatHeader}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.voteStatLabel}>For</Text>
              </View>
              <Text style={styles.voteStatValue}>{forVotes}</Text>
              <Text style={styles.voteStatPercentage}>{forPercentage.toFixed(1)}%</Text>
            </View>

            <View style={styles.voteStat}>
              <View style={styles.voteStatHeader}>
                <Ionicons name="close-circle" size={20} color={COLORS.error} />
                <Text style={styles.voteStatLabel}>Against</Text>
              </View>
              <Text style={styles.voteStatValue}>{againstVotes}</Text>
              <Text style={styles.voteStatPercentage}>{againstPercentage.toFixed(1)}%</Text>
            </View>

            <View style={styles.voteStat}>
              <View style={styles.voteStatHeader}>
                <Ionicons name="remove-circle" size={20} color={COLORS.warning} />
                <Text style={styles.voteStatLabel}>Abstain</Text>
              </View>
              <Text style={styles.voteStatValue}>{abstainVotes}</Text>
              <Text style={styles.voteStatPercentage}>{abstainPercentage.toFixed(1)}%</Text>
            </View>
          </View>

          <View style={styles.totalVotes}>
            <Text style={styles.totalVotesText}>{totalVotes} Total Votes</Text>
          </View>
        </Card>

        {/* Quorum Info */}
        <Card style={styles.quorumCard}>
          <View style={styles.quorumHeader}>
            <MaterialCommunityIcons name="podium" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Quorum Requirement</Text>
          </View>
          
          <View style={styles.quorumRow}>
            <Text style={styles.quorumLabel}>Required:</Text>
            <Text style={[styles.quorumValue, hasMetQuorum && styles.quorumMet]}>
              {requiredQuorum} votes ({daoInfo?.quorumPercentage}%)
            </Text>
          </View>

          <View style={styles.quorumRow}>
            <Text style={styles.quorumLabel}>Current For Votes:</Text>
            <Text style={[styles.quorumValue, hasMetQuorum && styles.quorumMet]}>
              {forVotes} votes
            </Text>
          </View>

          <View style={[styles.quorumStatus, hasMetQuorum ? styles.quorumMetStatus : styles.quorumNotMetStatus]}>
            <Ionicons 
              name={hasMetQuorum ? "checkmark-circle" : "alert-circle"} 
              size={16} 
              color={hasMetQuorum ? COLORS.success : COLORS.warning} 
            />
            <Text style={[styles.quorumStatusText, hasMetQuorum ? styles.quorumMetText : styles.quorumNotMetText]}>
              {hasMetQuorum ? 'Quorum Met' : 'Quorum Not Met'}
            </Text>
          </View>

          <Text style={styles.quorumExplanation}>
            For a proposal to pass, it must receive at least {daoInfo?.quorumPercentage}% of total votes as "For" votes, 
            and the "For" votes must exceed "Against" votes.
          </Text>
        </Card>

        {/* Timeline */}
        <Card style={styles.timelineCard}>
          <Text style={styles.sectionTitle}>Proposal Timeline</Text>
          
          <View style={styles.timeline}>
            {/* Created */}
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.timelineDotActive]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Created</Text>
                <Text style={styles.timelineDate}>{formatDate(proposal.timestamp)}</Text>
              </View>
            </View>

            <View style={styles.timelineLine} />

            {/* Voting Period */}
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, hasVotingEnded ? styles.timelineDotActive : styles.timelineDotCurrent]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Voting Period</Text>
                <Text style={styles.timelineDate}>
                  {daoInfo?.votingPeriodHours || 72} hours
                  {!hasVotingEnded && ` • ${getTimeRemaining()}`}
                </Text>
              </View>
            </View>

            {proposal.status === ProposalStatus.QUEUED || proposal.status === ProposalStatus.EXECUTED ? (
              <>
                <View style={styles.timelineLine} />

                {/* Queued */}
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, proposal.status === ProposalStatus.EXECUTED ? styles.timelineDotActive : styles.timelineDotCurrent]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>Queued (Timelock)</Text>
                    <Text style={styles.timelineDate}>
                      {daoInfo?.timelockPeriodHours || 24} hours
                      {proposal.queuedTimestamp > 0 && ` • ${formatDate(proposal.queuedTimestamp)}`}
                    </Text>
                  </View>
                </View>

                {proposal.status === ProposalStatus.EXECUTED && (
                  <>
                    <View style={styles.timelineLine} />

                    {/* Executed */}
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, styles.timelineDotActive]} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineTitle}>Executed</Text>
                        <Text style={styles.timelineDate}>Completed</Text>
                      </View>
                    </View>
                  </>
                )}
              </>
            ) : null}
          </View>

          <Text style={styles.timelineExplanation}>
            After voting ends, the proposal must be finalized. If passed, it enters a {daoInfo?.timelockPeriodHours || 24}-hour 
            timelock period before execution.
          </Text>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Active - Can Vote */}
          {proposal.status === ProposalStatus.ACTIVE && !hasVoted && !hasVotingEnded && (
            <View style={styles.voteButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.forButton]}
                onPress={() => handleVote(VoteOption.FOR)}
              >
                <Ionicons name="checkmark" size={20} color={COLORS.background} />
                <Text style={styles.actionButtonText}>Vote For</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.againstButton]}
                onPress={() => handleVote(VoteOption.AGAINST)}
              >
                <Ionicons name="close" size={20} color={COLORS.background} />
                <Text style={styles.actionButtonText}>Vote Against</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.abstainButton]}
                onPress={() => handleVote(VoteOption.ABSTAIN)}
              >
                <Ionicons name="remove" size={20} color={COLORS.background} />
                <Text style={styles.actionButtonText}>Abstain</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Can Finalize */}
          {canFinalize && (
            <TouchableOpacity style={styles.finalizeButton} onPress={handleFinalize}>
              <Ionicons name="flag" size={20} color={COLORS.onPrimary} />
              <Text style={styles.finalizeButtonText}>Finalize Proposal</Text>
            </TouchableOpacity>
          )}

          {/* Can Execute */}
          {proposal.status === ProposalStatus.QUEUED && canExecute && (
            <TouchableOpacity style={styles.executeButton} onPress={handleExecute}>
              <Ionicons name="play" size={20} color={COLORS.background} />
              <Text style={styles.executeButtonText}>Execute Proposal</Text>
            </TouchableOpacity>
          )}

          {/* Can Cancel */}
          {(proposal.status === ProposalStatus.ACTIVE || proposal.status === ProposalStatus.QUEUED) && 
           (isCreator || (daoInfo && userInfo?.address === daoInfo.owner)) && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Ionicons name="close-circle" size={20} color={COLORS.error} />
              <Text style={styles.cancelButtonText}>Cancel Proposal</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Transaction Modal */}
      {txParams && (
        <TransactionModal
          visible={txModalVisible}
          onClose={() => {
            setTxModalVisible(false);
            setTxParams(null);
          }}
          fromAddress={userInfo?.address}
          {...txParams}
        />
      )}

      {/* Chat Modal */}
      <ProposalChatModal
        visible={chatModalVisible}
        onClose={() => setChatModalVisible(false)}
        proposal={proposal}
        daoAddress={daoAddress}
        chainId={chainId}
        isLocked={isChatLocked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
    marginLeft: SPACING.md,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  headerButton: {
    padding: SPACING.sm,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  typeBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface,
  },
  typeBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  votedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.success + '20',
  },
  votedBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.success,
    fontWeight: '600',
  },
  title: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  metaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  descriptionCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  fundingCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  fundingRow: {
    marginBottom: SPACING.sm,
  },
  fundingItem: {
    gap: 4,
  },
  fundingLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  fundingValue: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  fundingAddress: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  protocolCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  protocolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  protocolLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  protocolValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    fontWeight: 'bold',
  },
  protocolAddress: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  votingCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  votingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  timeRemaining: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  progressBarContainer: {
    marginBottom: SPACING.lg,
  },
  progressBar: {
    height: 24,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressSegment: {
    height: '100%',
  },
  forSegment: {
    backgroundColor: COLORS.success,
  },
  againstSegment: {
    backgroundColor: COLORS.error,
  },
  abstainSegment: {
    backgroundColor: COLORS.warning,
  },
  voteStats: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  voteStat: {
    flex: 1,
    alignItems: 'center',
  },
  voteStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.xs,
  },
  voteStatLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  voteStatValue: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.text,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  voteStatPercentage: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },
  totalVotes: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalVotesText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  quorumCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quorumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  quorumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  quorumLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  quorumValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  quorumMet: {
    color: COLORS.success,
  },
  quorumStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  quorumMetStatus: {
    backgroundColor: COLORS.success + '20',
  },
  quorumNotMetStatus: {
    backgroundColor: COLORS.warning + '20',
  },
  quorumStatusText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  quorumMetText: {
    color: COLORS.success,
  },
  quorumNotMetText: {
    color: COLORS.warning,
  },
  quorumExplanation: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textTertiary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  timelineCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  timeline: {
    marginVertical: SPACING.md,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: SPACING.md,
    borderWidth: 3,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  timelineDotActive: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success,
  },
  timelineDotCurrent: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  timelineDate: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  timelineLine: {
    width: 2,
    height: 30,
    backgroundColor: COLORS.border,
    marginLeft: 9,
    marginVertical: 4,
  },
  timelineExplanation: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textTertiary,
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: SPACING.md,
  },
  actionsContainer: {
    gap: SPACING.md,
  },
  voteButtons: {
    gap: SPACING.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  forButton: {
    backgroundColor: COLORS.success,
  },
  againstButton: {
    backgroundColor: COLORS.error,
  },
  abstainButton: {
    backgroundColor: COLORS.warning,
  },
  actionButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  finalizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  finalizeButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.onPrimary,
  },
  executeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  executeButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  cancelButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.error,
  },
});