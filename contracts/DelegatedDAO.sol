// SPDX-License-Identifier: Unlicense


pragma solidity ^0.8.21;

import "./IERC20.sol";
import "./Math.sol";

/**
 * @title DelegatedDAO
 * @dev Enhanced DAO with multiple proposal types, timelock, and protocol upgrades
 */
contract DelegatedDAO {
    address public owner;
    IERC20 public token;
    uint256 public quorumPercentage;
    uint256 public proposalThreshold;
    uint256 public votingPeriodHours;
    uint256 public timelockPeriodHours; // New: timelock before execution
    string public name;
    string public imageUrl;

    enum ProposalStatus { Active, Passed, Failed, Queued, Executed, Cancelled }
    enum VoteOption { None, For, Against, Abstain }
    enum ProposalType { Funding, Generic, ProtocolUpgrade }
    enum ProtocolAction { ChangeThreshold, ChangeToken, ChangeQuorum, ChangeTimelock, ChangeVotingPeriod }

    struct Proposal {
        uint256 id;
        string title;
        string description;
        uint256 amount;
        address payable recipient;
        ProposalType proposalType;
        ProtocolAction protocolAction; // Only used if proposalType is ProtocolUpgrade
        uint256 newValue; // New threshold/quorum/timelock value
        address newTokenAddress; // New token address for ChangeToken
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        ProposalStatus status;
        uint256 timestamp;
        uint256 queuedTimestamp; // When proposal was queued for execution
        address creator;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;

    // Votes tracking
    mapping(address => mapping(uint256 => VoteOption)) public votesCast;
    mapping(address => mapping(uint256 => bool)) public hasVotedIndependently;

    // Delegation
    mapping(address => address) public delegatorDelegatee;
    mapping(address => uint256) public delegatorBalance;
    mapping(address => mapping(uint256 => address)) public delegateeDelegators;
    mapping(address => uint256) public delegateeDelegatorCount;
    mapping(address => mapping(address => uint256)) public delegateeDelegatorIndex;
    mapping(address => uint256) public delegateeVotesReceived;

    // Security: prevent reentrancy
    bool private locked;

    event Propose(
        uint256 id,
        uint256 amount,
        address recipient,
        address creator,
        string description,
        ProposalType proposalType
    );
    event Delegate(address indexed delegator, address indexed delegatee, uint256 amount, uint256 timestamp);
    event Undelegate(address indexed delegator, address indexed delegatee, uint256 amount, uint256 timestamp);
    event Vote(uint256 id, address voter, VoteOption option, uint256 weight);
    event Finalize(uint256 id, ProposalStatus status);
    event ProposalQueued(uint256 id, uint256 executionTime);
    event ProposalExecuted(uint256 id);
    event ProposalCancelled(uint256 id);
    event GovernanceTokenUpdated(address newToken);
    event ProposalThresholdUpdated(uint256 newThreshold);
    event QuorumUpdated(uint256 newQuorum);
    event TimelockUpdated(uint256 newTimelock);
    event VotingPeriodUpdated(uint256 newVotingPeriod);

    modifier onlyInvestor() {
        require(
            token.balanceOf(msg.sender) > 0 || delegatorBalance[msg.sender] > 0,
            "Must be token holder"
        );
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier noReentrant() {
        require(!locked, "No reentrancy");
        locked = true;
        _;
        locked = false;
    }

    constructor(
        IERC20 _token,
        uint256 _quorumPercentage,
        uint256 _proposalThreshold,
        uint256 _votingPeriodHours,
        uint256 _timelockPeriodHours,
        string memory _name,
        string memory _imageUrl
    ) {
        require(_quorumPercentage > 0 && _quorumPercentage <= 100, "Invalid quorum");
        require(_votingPeriodHours > 0, "Invalid voting period");
        require(_timelockPeriodHours > 0, "Invalid timelock period");
        
        owner = msg.sender;
        token = _token;
        quorumPercentage = _quorumPercentage;
        proposalThreshold = _proposalThreshold;
        votingPeriodHours = _votingPeriodHours;
        timelockPeriodHours = _timelockPeriodHours;
        name = _name;
        imageUrl = _imageUrl;
    }

    /**
     * @notice Update DAO image (owner only for initial setup)
     */
    function updateImageUrl(string memory _newUrl) external onlyOwner {
        imageUrl = _newUrl;
    }

    /**
     * @notice Create a funding proposal
     */
    function createFundingProposal(
        string memory _title,
        string memory _description,
        uint256 _amount,
        address payable _recipient
    ) external onlyInvestor {
        require(_amount > 0, "Amount must be > 0");
        require(_recipient != address(0), "Invalid recipient");
        uint256 voterBalance = token.balanceOf(msg.sender);
        require(voterBalance >= proposalThreshold, "Below proposal threshold");
        require(token.balanceOf(address(this)) >= _amount, "Insufficient DAO funds");

        _createProposal(
            _title,
            _description,
            _amount,
            _recipient,
            ProposalType.Funding,
            ProtocolAction.ChangeThreshold, // Unused
            0,
            address(0)
        );
    }

    /**
     * @notice Create a generic (non-funding) proposal
     */
    function createGenericProposal(
        string memory _title,
        string memory _description
    ) external onlyInvestor {
        uint256 voterBalance = token.balanceOf(msg.sender);
        require(voterBalance >= proposalThreshold, "Below proposal threshold");

        _createProposal(
            _title,
            _description,
            0,
            payable(address(0)),
            ProposalType.Generic,
            ProtocolAction.ChangeThreshold, // Unused
            0,
            address(0)
        );
    }

    /**
     * @notice Create a protocol upgrade proposal
     */
    function createProtocolUpgradeProposal(
        string memory _title,
        string memory _description,
        ProtocolAction _action,
        uint256 _newValue,
        address _newTokenAddress
    ) external onlyInvestor {
        uint256 voterBalance = token.balanceOf(msg.sender);
        require(voterBalance >= proposalThreshold, "Below proposal threshold");

        // Validate based on action type
        if (_action == ProtocolAction.ChangeThreshold) {
            require(_newValue > 0, "Threshold must be > 0");
        } else if (_action == ProtocolAction.ChangeQuorum) {
            require(_newValue > 0 && _newValue <= 100, "Invalid quorum");
        } else if (_action == ProtocolAction.ChangeToken) {
            require(_newTokenAddress != address(0), "Invalid token address");
        } else if (_action == ProtocolAction.ChangeTimelock) {
            require(_newValue > 0, "Timelock must be > 0");
        } else if (_action == ProtocolAction.ChangeVotingPeriod) {
            require(_newValue > 0, "Voting period must be > 0");
        }

        _createProposal(
            _title,
            _description,
            0,
            payable(address(0)),
            ProposalType.ProtocolUpgrade,
            _action,
            _newValue,
            _newTokenAddress
        );
    }

    /**
     * @notice Internal function to create proposals
     */
    function _createProposal(
        string memory _title,
        string memory _description,
        uint256 _amount,
        address payable _recipient,
        ProposalType _proposalType,
        ProtocolAction _protocolAction,
        uint256 _newValue,
        address _newTokenAddress
    ) internal {
        proposalCount++;
        proposals[proposalCount] = Proposal({
            id: proposalCount,
            title: _title,
            description: _description,
            amount: _amount,
            recipient: _recipient,
            proposalType: _proposalType,
            protocolAction: _protocolAction,
            newValue: _newValue,
            newTokenAddress: _newTokenAddress,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            status: ProposalStatus.Active,
            timestamp: block.timestamp,
            queuedTimestamp: 0,
            creator: msg.sender
        });

        emit Propose(proposalCount, _amount, _recipient, msg.sender, _description, _proposalType);
    }

    /**
     * @notice Delegate voting power to another investor
     */
    function delegate(address _delegatee) external onlyInvestor noReentrant {
        require(_delegatee != msg.sender, "Cannot delegate to self");
        require(_delegatee != address(0), "Invalid delegatee");
        require(token.balanceOf(_delegatee) > 0, "Delegatee must hold tokens");
        require(delegatorDelegatee[_delegatee] == address(0), "Chained delegation not allowed");
        require(delegateeDelegatorCount[msg.sender] == 0, "Cannot delegate as delegatee");
        require(delegatorDelegatee[msg.sender] == address(0), "Already delegated");

        uint256 amount = token.balanceOf(msg.sender);
        require(amount > 0, "No tokens to delegate");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        delegatorBalance[msg.sender] = amount;
        delegatorDelegatee[msg.sender] = _delegatee;
        delegateeDelegatorCount[_delegatee]++;
        delegateeDelegators[_delegatee][delegateeDelegatorCount[_delegatee]] = msg.sender;
        delegateeDelegatorIndex[_delegatee][msg.sender] = delegateeDelegatorCount[_delegatee];
        delegateeVotesReceived[_delegatee] += amount;

        emit Delegate(msg.sender, _delegatee, amount, block.timestamp);
    }

    /**
     * @notice Revoke delegation
     */
    function undelegate() public onlyInvestor noReentrant {
        address delegatee = delegatorDelegatee[msg.sender];
        require(delegatee != address(0), "Not delegated");

        uint256 amount = delegatorBalance[msg.sender];
        require(token.transfer(msg.sender, amount), "Transfer failed");
        
        delegatorBalance[msg.sender] = 0;
        delegateeVotesReceived[delegatee] -= amount;
        delegatorDelegatee[msg.sender] = address(0);

        // Remove delegator from delegatee list
        uint256 index = delegateeDelegatorIndex[delegatee][msg.sender];
        if (index != delegateeDelegatorCount[delegatee]) {
            address lastDelegator = delegateeDelegators[delegatee][delegateeDelegatorCount[delegatee]];
            delegateeDelegators[delegatee][index] = lastDelegator;
            delegateeDelegatorIndex[delegatee][lastDelegator] = index;
        }
        delegateeDelegatorCount[delegatee]--;
        delegateeDelegators[delegatee][delegateeDelegatorCount[delegatee] + 1] = address(0);
        delegateeDelegatorIndex[delegatee][msg.sender] = 0;

        emit Undelegate(msg.sender, delegatee, amount, block.timestamp);
    }

    /**
     * @notice Cast a vote with quadratic voting
     */
    function vote(uint256 _id, VoteOption _option) external onlyInvestor {
        require(_option == VoteOption.For || _option == VoteOption.Against || _option == VoteOption.Abstain, "Invalid option");

        Proposal storage proposal = proposals[_id];
        require(proposal.status == ProposalStatus.Active, "Proposal not active");
        require(votesCast[msg.sender][_id] == VoteOption.None, "Already voted");
        require(delegatorDelegatee[msg.sender] == address(0), "Delegated vote");

        // Quadratic vote weight
        uint256 voteWeight = Math.sqrt(token.balanceOf(msg.sender));
        require(voteWeight > 0, "No voting power");

        // Include delegatee votes
        if (delegateeDelegatorCount[msg.sender] > 0) {
            uint256 delegateeWeight = Math.sqrt(delegateeVotesReceived[msg.sender]);
            // Exclude delegators who already voted independently
            for (uint256 i = 1; i <= delegateeDelegatorCount[msg.sender]; i++) {
                address delegator = delegateeDelegators[msg.sender][i];
                if (hasVotedIndependently[delegator][_id]) {
                    uint256 delegatorBal = delegatorBalance[delegator];
                    if (delegatorBal > 0) {
                        delegateeWeight -= Math.sqrt(delegatorBal);
                    }
                }
            }
            voteWeight += delegateeWeight;
        }

        if (_option == VoteOption.For) {
            proposal.forVotes += voteWeight;
        } else if (_option == VoteOption.Against) {
            proposal.againstVotes += voteWeight;
        } else if (_option == VoteOption.Abstain) {
            proposal.abstainVotes += voteWeight;
        }

        votesCast[msg.sender][_id] = _option;
        hasVotedIndependently[msg.sender][_id] = true;

        emit Vote(_id, msg.sender, _option, voteWeight);
    }

    /**
     * @notice Finalize a proposal after voting period and queue for execution
     */
    function finalizeProposal(uint256 _id) external onlyInvestor {
        Proposal storage proposal = proposals[_id];
        require(proposal.status == ProposalStatus.Active, "Already finalized");
        require(block.timestamp >= proposal.timestamp + (votingPeriodHours * 3600), "Voting period ongoing");

        uint256 totalSupply = token.totalSupply();
        uint256 totalVotesCast = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        require(totalVotesCast > 0, "No votes cast");

    uint256 requiredQuorum = (Math.sqrt(totalSupply) * quorumPercentage) / 100;
        
        if (proposal.forVotes >= requiredQuorum && proposal.forVotes > proposal.againstVotes) {
            proposal.status = ProposalStatus.Queued;
            proposal.queuedTimestamp = block.timestamp;
            emit ProposalQueued(_id, block.timestamp + (timelockPeriodHours * 3600));
        } else {
            proposal.status = ProposalStatus.Failed;
        }

        emit Finalize(_id, proposal.status);
    }

    /**
     * @notice Execute a queued proposal after timelock period
     */
    function executeProposal(uint256 _id) external onlyInvestor noReentrant {
        Proposal storage proposal = proposals[_id];
        require(proposal.status == ProposalStatus.Queued, "Not queued");
        require(
            block.timestamp >= proposal.queuedTimestamp + (timelockPeriodHours * 3600),
            "Timelock not expired"
        );

        proposal.status = ProposalStatus.Executed;

        // Execute based on proposal type
        if (proposal.proposalType == ProposalType.Funding) {
            require(token.balanceOf(address(this)) >= proposal.amount, "Insufficient DAO funds");
            require(token.transfer(proposal.recipient, proposal.amount), "Transfer failed");
        } else if (proposal.proposalType == ProposalType.ProtocolUpgrade) {
            _executeProtocolUpgrade(proposal);
        }
        // Generic proposals don't need execution

        emit ProposalExecuted(_id);
    }

    /**
     * @notice Internal function to execute protocol upgrades
     */
    function _executeProtocolUpgrade(Proposal storage proposal) internal {
        if (proposal.protocolAction == ProtocolAction.ChangeThreshold) {
            proposalThreshold = proposal.newValue;
            emit ProposalThresholdUpdated(proposal.newValue);
        } else if (proposal.protocolAction == ProtocolAction.ChangeQuorum) {
            require(proposal.newValue > 0 && proposal.newValue <= 100, "Invalid quorum");
            quorumPercentage = proposal.newValue;
            emit QuorumUpdated(proposal.newValue);
        } else if (proposal.protocolAction == ProtocolAction.ChangeToken) {
            require(proposal.newTokenAddress != address(0), "Invalid token");
            token = IERC20(proposal.newTokenAddress);
            emit GovernanceTokenUpdated(proposal.newTokenAddress);
        } else if (proposal.protocolAction == ProtocolAction.ChangeTimelock) {
            require(proposal.newValue > 0, "Invalid timelock");
            timelockPeriodHours = proposal.newValue;
            emit TimelockUpdated(proposal.newValue);
        } else if (proposal.protocolAction == ProtocolAction.ChangeVotingPeriod) {
            require(proposal.newValue > 0, "Invalid voting period");
            votingPeriodHours = proposal.newValue;
            emit VotingPeriodUpdated(proposal.newValue);
        }
    }

    /**
     * @notice Cancel a queued proposal (emergency function for creator or owner)
     */
    function cancelProposal(uint256 _id) external {
        Proposal storage proposal = proposals[_id];
        require(
            msg.sender == proposal.creator || msg.sender == owner,
            "Only creator or owner"
        );
        require(
            proposal.status == ProposalStatus.Queued || proposal.status == ProposalStatus.Active,
            "Cannot cancel"
        );

        proposal.status = ProposalStatus.Cancelled;
        emit ProposalCancelled(_id);
    }

    /**
     * @notice Get proposal details
     */
    function getProposal(uint256 _id) external view returns (Proposal memory) {
        return proposals[_id];
    }

    /**
     * @notice Check if timelock has expired for a proposal
     */
    function canExecute(uint256 _id) external view returns (bool) {
        Proposal storage proposal = proposals[_id];
        return proposal.status == ProposalStatus.Queued &&
               block.timestamp >= proposal.queuedTimestamp + (timelockPeriodHours * 3600);
    }

    receive() external payable {}
    fallback() external payable {}
}