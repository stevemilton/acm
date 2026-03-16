// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentShare — BEP-20 revenue share token for an AI agent on ACM
/// @notice Each agent offering deploys one AgentShare contract.
///         Tokens represent pro-rata claims on agent revenue distributions.
contract AgentShare is ERC20, Ownable {
    /// @notice The agent's unique ID on ACM (matches Supabase agents.id)
    string public agentId;

    /// @notice Revenue share percentage (basis points, e.g. 1000 = 10%)
    uint256 public revenueShareBps;

    /// @notice Whether transfers are enabled (disabled in v1 — no secondary market)
    bool public transfersEnabled;

    event RevenueDistributed(uint256 amount, uint256 timestamp);
    event TransfersToggled(bool enabled);

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _agentId,
        uint256 _revenueShareBps,
        uint256 _totalSupply,
        address _operator
    ) ERC20(_name, _symbol) Ownable(_operator) {
        require(_revenueShareBps > 0 && _revenueShareBps <= 5000, "Invalid revenue share");
        agentId = _agentId;
        revenueShareBps = _revenueShareBps;
        transfersEnabled = false;
        _mint(address(this), _totalSupply);
    }

    /// @notice Purchase shares during offering (called by Escrow contract)
    function purchaseShares(address investor, uint256 amount) external onlyOwner {
        _transfer(address(this), investor, amount);
    }

    /// @notice Toggle secondary market transfers (v2)
    function setTransfersEnabled(bool _enabled) external onlyOwner {
        transfersEnabled = _enabled;
        emit TransfersToggled(_enabled);
    }

    /// @dev Override transfer to enforce non-transferable in v1
    function _update(address from, address to, uint256 value) internal override {
        // Allow minting (from == address(0)) and escrow operations (from == address(this) or to == address(this))
        if (from != address(0) && from != address(this) && to != address(this)) {
            require(transfersEnabled, "Transfers disabled");
        }
        super._update(from, to, value);
    }
}
