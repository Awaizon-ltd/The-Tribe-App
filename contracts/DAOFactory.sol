// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.21;

import "./DelegatedDAO.sol";
import "./IERC20.sol";
import "./Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DAOFactory is Ownable, ReentrancyGuard {
    uint256 public ethDaoCreationFee;
    uint256 public tokenDaoCreationFee;
    address public feeToken;
    address public feeCollector;
    uint256 public minTimelockHours; // Minimum timelock period

    enum Genre {
        NFT, GAMING, COMMUNITY, DEFI, AI, DEGEN,
        MEMECOIN, RWA, DEPIN, SOCIALFI, METAVERSE, OTHER
    }

    enum PaymentMethod {
        ETH,
        TOKEN
    }

    struct DAOInfo {
        address daoAddress;
        address tokenAddress;
        Genre genre;
        string daoName;
        string imageUrl;
        uint256 threshold;
        uint256 quorum;
        uint256 votingPeriodHours;
        uint256 timelockPeriodHours;
        uint256 createdAt;
    }

    address[] private daoAddresses;
    mapping(address => DAOInfo) private daoInfoByAddress;

    event DAOCreated(
        address indexed daoAddress,
        address indexed creator,
        address tokenAddress,
        Genre genre,
        string daoName,
        PaymentMethod paymentMethod,
        uint256 threshold,
        uint256 timelockPeriodHours
    );
    event EthFeeUpdated(uint256 newFee);
    event TokenFeeUpdated(uint256 newFee);
    event FeeTokenUpdated(address newFeeToken);
    event FeeCollectorUpdated(address newFeeCollector);
    event MinTimelockUpdated(uint256 newMinTimelock);

    constructor(
        uint256 _ethDaoCreationFee,
        uint256 _tokenDaoCreationFee,
        address _feeToken,
        address _feeCollector,
        uint256 _minTimelockHours
    ) Ownable(msg.sender) {
        require(_minTimelockHours > 0, "Invalid min timelock");
        ethDaoCreationFee = _ethDaoCreationFee;
        tokenDaoCreationFee = _tokenDaoCreationFee;
        feeToken = _feeToken;
        feeCollector = _feeCollector;
        minTimelockHours = _minTimelockHours;
    }

    /**
     * @notice Creates a new DAO with enhanced security features
     * @param quorum Minimum percentage of total token supply required to pass proposals
     * @param threshold Minimum token holding required to create a proposal
     * @param votingPeriodHours Duration of voting period
     * @param timelockPeriodHours Timelock period before execution
     */
    function createDAO(
        uint256 quorum,
        uint256 threshold,
        uint256 votingPeriodHours,
        uint256 timelockPeriodHours,
        address tokenAddress,
        Genre genre,
        string memory imgUrl,
        string memory daoName,
        PaymentMethod paymentMethod
    ) external payable nonReentrant returns (address) {
        require(tokenAddress != address(0), "Invalid token address");
        require(quorum > 0 && quorum <= 100, "Invalid quorum");
        require(threshold > 0, "Invalid threshold");
        require(votingPeriodHours > 0, "Invalid voting period");
        require(timelockPeriodHours >= minTimelockHours, "Timelock too short");

        // Process payment
        if (paymentMethod == PaymentMethod.ETH) {
            require(msg.value == ethDaoCreationFee, "Incorrect ETH fee sent");
            (bool success, ) = feeCollector.call{value: msg.value}("");
            require(success, "ETH fee transfer failed");
        } else {
            require(msg.value == 0, "ETH sent when paying with token");
            require(feeToken != address(0), "Fee token not set");
            IERC20 feeTokenInstance = IERC20(feeToken);
            require(
                feeTokenInstance.transferFrom(msg.sender, feeCollector, tokenDaoCreationFee),
                "Token fee transfer failed"
            );
        }

        // Deploy new DAO with timelock
        DelegatedDAO newDAO = new DelegatedDAO(
            IERC20(tokenAddress),
            quorum,
            threshold,
            votingPeriodHours,
            timelockPeriodHours,
            daoName,
            imgUrl
        );

        address daoAddr = address(newDAO);

        // Store DAO info
        daoInfoByAddress[daoAddr] = DAOInfo({
            daoAddress: daoAddr,
            tokenAddress: tokenAddress,
            genre: genre,
            daoName: daoName,
            imageUrl: imgUrl,
            threshold: threshold,
            quorum: quorum,
            votingPeriodHours: votingPeriodHours,
            timelockPeriodHours: timelockPeriodHours,
            createdAt: block.timestamp
        });

        daoAddresses.push(daoAddr);

        emit DAOCreated(
            daoAddr,
            msg.sender,
            tokenAddress,
            genre,
            daoName,
            paymentMethod,
            threshold,
            timelockPeriodHours
        );

        return daoAddr;
    }

    /**
     * @notice Get DAO info by address
     */
    function getDAO(address daoAddr) external view returns (DAOInfo memory) {
        require(daoInfoByAddress[daoAddr].daoAddress != address(0), "DAO not found");
        return daoInfoByAddress[daoAddr];
    }

    /**
     * @notice Paginated DAO list
     */
    function getDeployedDAOs(uint256 offset, uint256 limit) external view returns (DAOInfo[] memory) {
        require(offset < daoAddresses.length || daoAddresses.length == 0, "Offset out of bounds");
        if (limit > 100) limit = 100;

        uint256 end = offset + limit;
        if (end > daoAddresses.length) {
            end = daoAddresses.length;
        }

        DAOInfo[] memory chunk = new DAOInfo[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            chunk[i - offset] = daoInfoByAddress[daoAddresses[i]];
        }
        return chunk;
    }

    function getTotalDAOs() external view returns (uint256) {
        return daoAddresses.length;
    }

    /**
     * @notice Filter DAOs by genre
     */
    function getDAOsByGenre(Genre genre, uint256 offset, uint256 limit) external view returns (DAOInfo[] memory) {
        if (limit > 100) limit = 100;
        
        // Count matching DAOs
        uint256 matchCount = 0;
        for (uint256 i = 0; i < daoAddresses.length; i++) {
            if (daoInfoByAddress[daoAddresses[i]].genre == genre) {
                matchCount++;
            }
        }

        // Skip to offset
        uint256 skipped = 0;
        uint256 collected = 0;
        uint256 resultSize = matchCount > offset ? (matchCount - offset > limit ? limit : matchCount - offset) : 0;
        DAOInfo[] memory result = new DAOInfo[](resultSize);

        for (uint256 i = 0; i < daoAddresses.length && collected < resultSize; i++) {
            DAOInfo storage info = daoInfoByAddress[daoAddresses[i]];
            if (info.genre == genre) {
                if (skipped >= offset) {
                    result[collected] = info;
                    collected++;
                } else {
                    skipped++;
                }
            }
        }

        return result;
    }

    // --- Fee and parameter management ---
    function updateEthFee(uint256 _newFee) external onlyOwner {
        ethDaoCreationFee = _newFee;
        emit EthFeeUpdated(_newFee);
    }

    function updateTokenFee(uint256 _newFee) external onlyOwner {
        tokenDaoCreationFee = _newFee;
        emit TokenFeeUpdated(_newFee);
    }

    function updateFeeToken(address _newFeeToken) external onlyOwner {
        feeToken = _newFeeToken;
        emit FeeTokenUpdated(_newFeeToken);
    }

    function updateFeeCollector(address _newFeeCollector) external onlyOwner {
        require(_newFeeCollector != address(0), "Invalid fee collector");
        feeCollector = _newFeeCollector;
        emit FeeCollectorUpdated(_newFeeCollector);
    }

    function updateMinTimelock(uint256 _newMinTimelock) external onlyOwner {
        require(_newMinTimelock > 0, "Invalid min timelock");
        minTimelockHours = _newMinTimelock;
        emit MinTimelockUpdated(_newMinTimelock);
    }

    receive() external payable {}
}