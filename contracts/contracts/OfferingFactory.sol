// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AgentShare.sol";
import "./Escrow.sol";
import "./RevenueDistributor.sol";

/// @title OfferingFactory — Deploys a full AgentShare + Escrow + RevenueDistributor per offering
/// @notice One factory per ACM deployment. Each `createOffering` call deploys three contracts
///         and wires them together with correct ownership.
contract OfferingFactory is Ownable {
    // ── Immutable config ────────────────────────────────────────────────
    address public immutable paymentToken; // FDUSD (or mock on testnet)
    address public immutable platformWallet;

    // ── Offering registry ───────────────────────────────────────────────
    struct Offering {
        address agentShare;
        address escrow;
        address revenueDistributor;
        string agentId;
        address operator;
    }

    /// @notice Input parameters for createOffering (struct to avoid stack-too-deep)
    struct OfferingParams {
        string agentId;
        string name;
        string symbol;
        uint256 revenueShareBps;
        uint256 totalSupply;
        uint256 minRaise;
        uint256 maxRaise;
        uint256 pricePerShare;
        uint256 deadline;
        address operator;
    }

    uint256 private _nextOfferingId;
    mapping(uint256 => Offering) private _offerings;

    /// @notice Addresses approved to create offerings (in addition to the owner)
    mapping(address => bool) public approvedOperators;

    // ── Events ──────────────────────────────────────────────────────────
    event OfferingCreated(
        uint256 indexed offeringId,
        string agentId,
        address agentShare,
        address escrow,
        address revenueDistributor,
        address operator
    );
    event OperatorApproved(address indexed operator, bool approved);

    // ── Constructor ─────────────────────────────────────────────────────
    constructor(
        address _paymentToken,
        address _platformWallet
    ) Ownable(msg.sender) {
        require(_paymentToken != address(0), "Invalid payment token");
        require(_platformWallet != address(0), "Invalid platform wallet");
        paymentToken = _paymentToken;
        platformWallet = _platformWallet;
    }

    // ── Access control ──────────────────────────────────────────────────
    modifier onlyOwnerOrApproved() {
        require(
            msg.sender == owner() || approvedOperators[msg.sender],
            "Not authorized"
        );
        _;
    }

    function setApprovedOperator(address operator, bool approved) external onlyOwner {
        approvedOperators[operator] = approved;
        emit OperatorApproved(operator, approved);
    }

    // ── Core ────────────────────────────────────────────────────────────

    /// @notice Deploy a new offering (AgentShare + Escrow + RevenueDistributor)
    /// @param p  OfferingParams struct containing all offering configuration
    /// @return offeringId  Auto-incremented ID for this offering
    function createOffering(
        OfferingParams calldata p
    ) external onlyOwnerOrApproved returns (uint256 offeringId) {
        require(p.operator != address(0), "Invalid operator");

        // 1. Deploy AgentShare — initially owned by this factory (temporary)
        AgentShare agentShare = new AgentShare(
            p.name,
            p.symbol,
            p.agentId,
            p.revenueShareBps,
            p.totalSupply,
            address(this) // factory is initial owner so we can transfer ownership
        );

        // 2. Deploy Escrow
        Escrow escrow = new Escrow(
            paymentToken,
            address(agentShare),
            p.minRaise,
            p.maxRaise,
            p.pricePerShare,
            p.deadline,
            p.operator
        );

        // 3. Transfer AgentShare ownership to Escrow (so escrow can call purchaseShares)
        agentShare.transferOwnership(address(escrow));

        // 4. Deploy RevenueDistributor
        RevenueDistributor revenueDistributor = new RevenueDistributor(
            paymentToken,
            address(agentShare),
            platformWallet,
            p.operator
        );

        // 5. Store offering
        offeringId = _nextOfferingId++;
        _offerings[offeringId] = Offering({
            agentShare: address(agentShare),
            escrow: address(escrow),
            revenueDistributor: address(revenueDistributor),
            agentId: p.agentId,
            operator: p.operator
        });

        emit OfferingCreated(
            offeringId,
            p.agentId,
            address(agentShare),
            address(escrow),
            address(revenueDistributor),
            p.operator
        );
    }

    // ── Views ───────────────────────────────────────────────────────────

    function getOffering(uint256 id) external view returns (Offering memory) {
        require(id < _nextOfferingId, "Offering does not exist");
        return _offerings[id];
    }

    function totalOfferings() external view returns (uint256) {
        return _nextOfferingId;
    }
}
