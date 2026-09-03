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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatUnits } from 'ethers';
import { useTheme } from '../../contexts/ThemeContext'; // Adjust path as needed
import Card from '../../components/common/Card';
import { TransactionModal } from '../../components/TransactionModal';
import { useDAOContract } from '../../hooks/useDAOContract';
import { calculateDisplayVotes, calculateRequiredQuorum } from '../../utils/VoteCalculation';
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
  const theme = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const { proposal: initialProposal, daoAddress } = route.params;
  
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

  // ✅ CORRECTED: Votes are already quadratic from blockchain
  // Just convert from precision format (1e9) to whole number
  const forVotes = calculateDisplayVotes(proposal.forVotes);
  const againstVotes = calculateDisplayVotes(proposal.againstVotes);
  const abstainVotes = calculateDisplayVotes(proposal.abstainVotes);
  const totalVotes = forVotes + againstVotes + abstainVotes;

  // Calculate percentages for progress bar
  const forPercentage = totalVotes > 0 ? (forVotes / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (againstVotes / totalVotes) * 100 : 0;
  const abstainPercentage = totalVotes > 0 ? (abstainVotes / totalVotes) * 100 : 0;

  // Calculate quorum
  const requiredQuorum = userInfo && daoInfo 
    ? calculateRequiredQuorum(
        userInfo.totalSupply,
        userInfo.tokenDecimals,
        daoInfo.quorumPercentage
      )
    : 0;
  
  const hasMetQuorum = forVotes >= requiredQuorum;

  // Check if voting period has ended
  const votingEndTime = proposal.timestamp + (daoInfo?.votingPeriodHours || 72) * 3600;
  const hasVotingEnded = Date.now() / 1000 >= votingEndTime;
  const canFinalize = proposal.status === ProposalStatus.ACTIVE && hasVotingEnded;

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
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proposal #{proposal.id}</Text>
        <TouchableOpacity onPress={handleRefresh} disabled={isSyncing}>
          {isSyncing ? (
            <ActivityIndicator size="small" color={theme.COLORS.primary} />
          ) : (
            <Ionicons name="refresh" size={24} color={theme.COLORS.text} />
          )}
        </TouchableOpacity>
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
              <Ionicons name="checkmark-done" size={14} color={theme.COLORS.success} />
              <Text style={styles.votedBadgeText}>Voted</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>{proposal.title}</Text>

        {/* Creator & Date */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={16} color={theme.COLORS.textSecondary} />
            <Text style={styles.metaText}>
              {proposal.creator.slice(0, 6)}...{proposal.creator.slice(-4)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color={theme.COLORS.textSecondary} />
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
                <Ionicons name="checkmark-circle" size={20} color={theme.COLORS.success} />
                <Text style={styles.voteStatLabel}>For</Text>
              </View>
              <Text style={styles.voteStatValue}>{forVotes}</Text>
              <Text style={styles.voteStatPercentage}>{forPercentage.toFixed(1)}%</Text>
            </View>

            <View style={styles.voteStat}>
              <View style={styles.voteStatHeader}>
                <Ionicons name="close-circle" size={20} color={theme.COLORS.error} />
                <Text style={styles.voteStatLabel}>Against</Text>
              </View>
              <Text style={styles.voteStatValue}>{againstVotes}</Text>
              <Text style={styles.voteStatPercentage}>{againstPercentage.toFixed(1)}%</Text>
            </View>

            <View style={styles.voteStat}>
              <View style={styles.voteStatHeader}>
                <Ionicons name="remove-circle" size={20} color={theme.COLORS.warning} />
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
            <MaterialCommunityIcons name="podium" size={20} color={theme.COLORS.primary} />
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
              color={hasMetQuorum ? theme.COLORS.success : theme.COLORS.warning} 
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
                <Ionicons name="checkmark" size={20} color={theme.COLORS.surface} />
                <Text style={styles.actionButtonText}>Vote For</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.againstButton]}
                onPress={() => handleVote(VoteOption.AGAINST)}
              >
                <Ionicons name="close" size={20} color={theme.COLORS.surface} />
                <Text style={styles.actionButtonText}>Vote Against</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.abstainButton]}
                onPress={() => handleVote(VoteOption.ABSTAIN)}
              >
                <Ionicons name="remove" size={20} color={theme.COLORS.surface} />
                <Text style={styles.actionButtonText}>Abstain</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Can Finalize */}
          {canFinalize && (
            <TouchableOpacity style={styles.finalizeButton} onPress={handleFinalize}>
              <Ionicons name="flag" size={20} color={theme.COLORS.surface} />
              <Text style={styles.finalizeButtonText}>Finalize Proposal</Text>
            </TouchableOpacity>
          )}

          {/* Can Execute */}
          {proposal.status === ProposalStatus.QUEUED && canExecute && (
            <TouchableOpacity style={styles.executeButton} onPress={handleExecute}>
              <Ionicons name="play" size={20} color={theme.COLORS.surface} />
              <Text style={styles.executeButtonText}>Execute Proposal</Text>
            </TouchableOpacity>
          )}

          {/* Can Cancel */}
          {(proposal.status === ProposalStatus.ACTIVE || proposal.status === ProposalStatus.QUEUED) && 
           (isCreator || (daoInfo && userInfo?.address === daoInfo.owner)) && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Ionicons name="close-circle" size={20} color={theme.COLORS.error} />
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
    </View>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.SPACING.lg,
      paddingVertical: theme.SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.border,
      backgroundColor: theme.COLORS.background,
    },
    backButton: {
      padding: theme.SPACING.sm,
    },
    headerTitle: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: 'bold',
      color: theme.COLORS.text,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: theme.SPACING.lg,
    },
    badgeRow: {
      flexDirection: 'row',
      gap: theme.SPACING.xs,
      marginBottom: theme.SPACING.md,
      flexWrap: 'wrap',
    },
    statusBadge: {
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.xs,
      borderRadius: theme.BORDER_RADIUS.sm,
    },
    statusBadgeText: {
      fontSize: theme.FONTS.sizes.xs,
      fontWeight: '600',
    },
    typeBadge: {
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.xs,
      borderRadius: theme.BORDER_RADIUS.sm,
      backgroundColor: theme.COLORS.surface,
    },
    typeBadgeText: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textSecondary,
      fontWeight: '600',
    },
    votedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.xs,
      borderRadius: theme.BORDER_RADIUS.sm,
      backgroundColor: theme.COLORS.success + '20',
    },
    votedBadgeText: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.success,
      fontWeight: '600',
    },
    title: {
      fontSize: theme.FONTS.sizes.xxl,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.md,
      lineHeight: 32,
    },
    metaRow: {
      flexDirection: 'row',
      gap: theme.SPACING.lg,
      marginBottom: theme.SPACING.lg,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.xs,
    },
    metaText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
    },
    descriptionCard: {
      padding: theme.SPACING.lg,
      marginBottom: theme.SPACING.md,
    },
    sectionTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.sm,
    },
    description: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      lineHeight: 22,
    },
    fundingCard: {
      padding: theme.SPACING.lg,
      marginBottom: theme.SPACING.md,
      backgroundColor: theme.COLORS.primaryLight,
      borderWidth: 1,
      borderColor: theme.COLORS.primary + '40',
    },
    fundingRow: {
      marginBottom: theme.SPACING.sm,
    },
    fundingItem: {
      gap: 4,
    },
    fundingLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      fontWeight: '600',
    },
    fundingValue: {
      fontSize: theme.FONTS.sizes.lg,
      color: theme.COLORS.primary,
      fontWeight: 'bold',
    },
    fundingAddress: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.text,
      fontFamily: 'monospace',
    },
    protocolCard: {
      padding: theme.SPACING.lg,
      marginBottom: theme.SPACING.md,
      backgroundColor: theme.COLORS.surface,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    protocolRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.SPACING.sm,
    },
    protocolLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      fontWeight: '600',
    },
    protocolValue: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
      fontWeight: 'bold',
    },
    protocolAddress: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.text,
      fontFamily: 'monospace',
    },
    votingCard: {
      padding: theme.SPACING.lg,
      marginBottom: theme.SPACING.md,
    },
    votingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.SPACING.md,
    },
    timeRemaining: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.primary,
      fontWeight: '600',
    },
    progressBarContainer: {
      marginBottom: theme.SPACING.lg,
    },
    progressBar: {
      height: 24,
      borderRadius: theme.BORDER_RADIUS.md,
      backgroundColor: theme.COLORS.border,
      flexDirection: 'row',
      overflow: 'hidden',
    },
    progressSegment: {
      height: '100%',
    },
    forSegment: {
      backgroundColor: theme.COLORS.success,
    },
    againstSegment: {
      backgroundColor: theme.COLORS.error,
    },
    abstainSegment: {
      backgroundColor: theme.COLORS.warning,
    },
    voteStats: {
      flexDirection: 'row',
      gap: theme.SPACING.md,
      marginBottom: theme.SPACING.md,
    },
    voteStat: {
      flex: 1,
      alignItems: 'center',
    },
    voteStatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: theme.SPACING.xs,
    },
    voteStatLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      fontWeight: '600',
    },
    voteStatValue: {
      fontSize: theme.FONTS.sizes.xl,
      color: theme.COLORS.text,
      fontWeight: 'bold',
      marginBottom: 2,
    },
    voteStatPercentage: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textSecondary,
    },
    totalVotes: {
      alignItems: 'center',
      paddingTop: theme.SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: theme.COLORS.border,
    },
    totalVotesText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      fontWeight: '600',
    },
    quorumCard: {
      padding: theme.SPACING.lg,
      marginBottom: theme.SPACING.md,
      backgroundColor: theme.COLORS.surface,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    quorumHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.sm,
      marginBottom: theme.SPACING.md,
    },
    quorumRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.SPACING.sm,
    },
    quorumLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
    },
    quorumValue: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.text,
      fontWeight: '600',
    },
    quorumMet: {
      color: theme.COLORS.success,
    },
    quorumStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.xs,
      padding: theme.SPACING.sm,
      borderRadius: theme.BORDER_RADIUS.sm,
      marginBottom: theme.SPACING.sm,
    },
    quorumMetStatus: {
      backgroundColor: theme.COLORS.success + '20',
    },
    quorumNotMetStatus: {
      backgroundColor: theme.COLORS.warning + '20',
    },
    quorumStatusText: {
      fontSize: theme.FONTS.sizes.sm,
      fontWeight: '600',
    },
    quorumMetText: {
      color: theme.COLORS.success,
    },
    quorumNotMetText: {
      color: theme.COLORS.warning,
    },
    quorumExplanation: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textTertiary,
      lineHeight: 18,
      fontStyle: 'italic',
    },
    timelineCard: {
      padding: theme.SPACING.lg,
      marginBottom: theme.SPACING.md,
    },
    timeline: {
      marginVertical: theme.SPACING.md,
    },
    timelineItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    timelineDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: theme.SPACING.md,
      borderWidth: 3,
      borderColor: theme.COLORS.border,
      backgroundColor: theme.COLORS.background,
    },
    timelineDotActive: {
      borderColor: theme.COLORS.success,
      backgroundColor: theme.COLORS.success,
    },
    timelineDotCurrent: {
      borderColor: theme.COLORS.primary,
      backgroundColor: theme.COLORS.primary,
    },
    timelineContent: {
      flex: 1,
    },
    timelineTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.text,
      marginBottom: 2,
    },
    timelineDate: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
    },
    timelineLine: {
      width: 2,
      height: 30,
      backgroundColor: theme.COLORS.border,
      marginLeft: 9,
      marginVertical: 4,
    },
    timelineExplanation: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.textTertiary,
      lineHeight: 18,
      fontStyle: 'italic',
      marginTop: theme.SPACING.md,
    },
    actionsContainer: {
      gap: theme.SPACING.md,
    },
    voteButtons: {
      gap: theme.SPACING.sm,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.SPACING.sm,
      paddingVertical: theme.SPACING.md,
      borderRadius: theme.BORDER_RADIUS.md,
      ...theme.SHADOWS.small,
    },
    forButton: {
      backgroundColor: theme.COLORS.success,
    },
    againstButton: {
      backgroundColor: theme.COLORS.error,
    },
    abstainButton: {
      backgroundColor: theme.COLORS.warning,
    },
    actionButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: 'bold',
      color: theme.COLORS.surface,
    },
    finalizeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.SPACING.sm,
      paddingVertical: theme.SPACING.md,
      backgroundColor: theme.COLORS.primary,
      borderRadius: theme.BORDER_RADIUS.md,
      ...theme.SHADOWS.small,
    },
    finalizeButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: 'bold',
      color: theme.COLORS.surface,
    },
    executeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.SPACING.sm,
      paddingVertical: theme.SPACING.md,
      backgroundColor: theme.COLORS.success,
      borderRadius: theme.BORDER_RADIUS.md,
      ...theme.SHADOWS.small,
    },
    executeButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: 'bold',
      color: theme.COLORS.surface,
    },
    cancelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.SPACING.sm,
      paddingVertical: theme.SPACING.md,
      backgroundColor: theme.COLORS.surface,
      borderRadius: theme.BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: theme.COLORS.error,
    },
    cancelButtonText: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: 'bold',
      color: theme.COLORS.error,
    },
  });