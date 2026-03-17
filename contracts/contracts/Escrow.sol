// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AgentShare.sol";

/// @title Escrow — Holds funds until offering minimum is met
/// @notice Manages the lifecycle of an agent share offering:
///         deposit → (min met? release : refund)
contract Escrow is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken; // FDUSD / USDC / USDT
    AgentShare public immutable shareToken;

    uint256 public immutable minRaise;
    uint256 public immutable maxRaise;
    uint256 public immutable pricePerShare;
    uint256 public immutable deadline;
    uint256 public totalRaised;

    enum Status { Open, Funded, Refunding }
    Status public status;

    mapping(address => uint256) public deposits;
    mapping(address => uint256) public sharesPurchased;

    event Deposited(address indexed investor, uint256 amount, uint256 shares);
    event Released(uint256 totalAmount);
    event Refunded(address indexed investor, uint256 amount);

    constructor(
        address _paymentToken,
        address _shareToken,
        uint256 _minRaise,
        uint256 _maxRaise,
        uint256 _pricePerShare,
        uint256 _deadline,
        address _operator
    ) Ownable(_operator) {
        paymentToken = IERC20(_paymentToken);
        shareToken = AgentShare(_shareToken);
        minRaise = _minRaise;
        maxRaise = _maxRaise;
        pricePerShare = _pricePerShare;
        deadline = _deadline;
        status = Status.Open;
    }

    /// @notice Invest in the offering
    function deposit(uint256 amount) external {
        require(status == Status.Open, "Not open");
        require(block.timestamp < deadline, "Deadline passed");
        require(totalRaised + amount <= maxRaise, "Exceeds max raise");

        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
        totalRaised += amount;

        uint256 shares = amount / pricePerShare;
        sharesPurchased[msg.sender] += shares;

        // Transfer AgentShare tokens to investor
        shareToken.purchaseShares(msg.sender, shares);

        emit Deposited(msg.sender, amount, shares);
    }

    /// @notice Release funds to operator once minimum is met
    function release() external onlyOwner {
        require(status == Status.Open, "Not open");
        require(totalRaised >= minRaise, "Min raise not met");

        status = Status.Funded;
        paymentToken.safeTransfer(owner(), totalRaised);

        emit Released(totalRaised);
    }

    /// @notice Trigger refunds if deadline passed and min not met
    function triggerRefund() external {
        require(status == Status.Open, "Not open");
        require(block.timestamp >= deadline, "Deadline not reached");
        require(totalRaised < minRaise, "Min raise met");

        status = Status.Refunding;
    }

    /// @notice Claim refund
    function claimRefund() external {
        require(status == Status.Refunding, "Not refunding");
        uint256 amount = deposits[msg.sender];
        require(amount > 0, "Nothing to refund");

        uint256 shares = sharesPurchased[msg.sender];
        deposits[msg.sender] = 0;
        sharesPurchased[msg.sender] = 0;

        // Return AgentShare tokens to the contract before refunding FDUSD
        if (shares > 0) {
            shareToken.returnShares(msg.sender, shares);
        }

        paymentToken.safeTransfer(msg.sender, amount);

        emit Refunded(msg.sender, amount);
    }
}
