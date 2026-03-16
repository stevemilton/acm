// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AgentShare.sol";

/// @title Escrow — Holds funds until offering minimum is met
/// @notice Manages the lifecycle of an agent share offering:
///         deposit → (min met? release : refund)
contract Escrow is Ownable {
    IERC20 public paymentToken; // FDUSD / USDC / USDT
    AgentShare public shareToken;

    uint256 public minRaise;
    uint256 public maxRaise;
    uint256 public pricePerShare;
    uint256 public deadline;
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

        paymentToken.transferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
        totalRaised += amount;

        uint256 shares = amount / pricePerShare;
        sharesPurchased[msg.sender] += shares;

        emit Deposited(msg.sender, amount, shares);
    }

    /// @notice Release funds to operator once minimum is met
    function release() external onlyOwner {
        require(status == Status.Open, "Not open");
        require(totalRaised >= minRaise, "Min raise not met");

        status = Status.Funded;
        paymentToken.transfer(owner(), totalRaised);

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

        deposits[msg.sender] = 0;
        sharesPurchased[msg.sender] = 0;
        paymentToken.transfer(msg.sender, amount);

        emit Refunded(msg.sender, amount);
    }
}
