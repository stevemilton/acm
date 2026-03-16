// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AgentShare.sol";

/// @title RevenueDistributor — Splits agent revenue between platform, operator, and shareholders
/// @notice 5% platform fee, remainder split per revenue share agreement
contract RevenueDistributor is Ownable {
    IERC20 public paymentToken;
    AgentShare public shareToken;

    address public platformWallet;
    address public operatorWallet;

    uint256 public constant PLATFORM_FEE_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10000;

    event RevenueReceived(uint256 gross, uint256 platformFee, uint256 operatorAmount, uint256 investorAmount);
    event InvestorClaimed(address indexed investor, uint256 amount);

    // Cumulative revenue per token (scaled by 1e18)
    uint256 public cumulativeRevenuePerToken;
    mapping(address => uint256) public lastClaimedCumulative;
    mapping(address => uint256) public pendingClaims;

    constructor(
        address _paymentToken,
        address _shareToken,
        address _platformWallet,
        address _operatorWallet
    ) Ownable(_operatorWallet) {
        paymentToken = IERC20(_paymentToken);
        shareToken = AgentShare(_shareToken);
        platformWallet = _platformWallet;
        operatorWallet = _operatorWallet;
    }

    /// @notice Distribute revenue for a period
    function distribute(uint256 grossRevenue) external onlyOwner {
        paymentToken.transferFrom(msg.sender, address(this), grossRevenue);

        uint256 platformFee = (grossRevenue * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 afterFee = grossRevenue - platformFee;

        uint256 revenueShareBps = shareToken.revenueShareBps();
        uint256 investorAmount = (afterFee * revenueShareBps) / BPS_DENOMINATOR;
        uint256 operatorAmount = afterFee - investorAmount;

        // Platform fee
        paymentToken.transfer(platformWallet, platformFee);

        // Operator share
        paymentToken.transfer(operatorWallet, operatorAmount);

        // Update cumulative revenue per token for investors
        uint256 totalShares = shareToken.totalSupply() - shareToken.balanceOf(address(shareToken));
        if (totalShares > 0) {
            cumulativeRevenuePerToken += (investorAmount * 1e18) / totalShares;
        }

        emit RevenueReceived(grossRevenue, platformFee, operatorAmount, investorAmount);
    }

    /// @notice Claim accumulated revenue as a shareholder
    function claim() external {
        uint256 shares = shareToken.balanceOf(msg.sender);
        require(shares > 0, "No shares");

        uint256 owed = (shares * (cumulativeRevenuePerToken - lastClaimedCumulative[msg.sender])) / 1e18;
        owed += pendingClaims[msg.sender];

        require(owed > 0, "Nothing to claim");

        lastClaimedCumulative[msg.sender] = cumulativeRevenuePerToken;
        pendingClaims[msg.sender] = 0;

        paymentToken.transfer(msg.sender, owed);

        emit InvestorClaimed(msg.sender, owed);
    }
}
