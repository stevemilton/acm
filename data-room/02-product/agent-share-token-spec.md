# Agent Share Token — Specification

## Overview

The Agent Share Token is a BEP-20 token on BNB Chain that represents a pro-rata claim on an AI agent's future revenue. Each agent listed on ACM has its own token contract with a fixed supply.

## Token Properties

| Property | Value |
|----------|-------|
| Standard | BEP-20 (ERC-20 compatible) |
| Chain | BNB Chain |
| Represents | Pro-rata claim on agent revenue share |
| Backed by | Verified, on-chain agent revenue |
| Settlement currency | FDUSD (primary), USDC/USDT (secondary) |
| Issuance | Per-agent — each agent has its own token contract |
| Supply | Fixed at offering (e.g., 1,000 shares) — no minting after issuance |
| Decimals | 18 |
| Transferable (v1) | No — soulbound to purchaser wallet |
| Transferable (v2) | Yes — with transfer limits and lock-up enforcement |

## Smart Contract Architecture

### AgentShareFactory
Deploys new AgentShare token contracts for each agent listing.

- `createAgentShare(agentId, name, symbol, totalSupply, revenueSharePct, pricePerShare, minRaise, operator)` → deploys new token contract
- Maintains registry of all deployed agent share contracts
- Only callable by ACM platform (access controlled)

### AgentShare (per-agent token contract)
Each agent gets its own BEP-20 token contract.

**State:**
- `operator` — operator wallet address
- `revenueSharePct` — percentage of revenue distributed to holders (immutable after deploy)
- `totalSupply` — fixed at creation
- `pricePerShare` — in FDUSD
- `minRaise` — minimum FDUSD to raise before escrow releases
- `raised` — total FDUSD raised so far
- `status` — OPEN | FUNDED | CLOSED | REFUNDING
- `transferable` — boolean (false in v1)

**Purchase flow:**
- `buyShares(quantity)` — transfers FDUSD from buyer to escrow, mints tokens to buyer
- Reverts if offering is not OPEN or insufficient shares remaining
- When `raised >= minRaise`, status transitions to FUNDED

**Refund flow:**
- If offering expires without meeting `minRaise`, status → REFUNDING
- `claimRefund()` — burns tokens, returns FDUSD to holder
- Also triggered by revenue cliff protection (>50% drop within 90 days)

### RevenueDistributor
Handles incoming revenue and distributes to token holders.

**Revenue deposit:**
- `depositRevenue(agentId, amount)` — called by ACM platform when verified revenue arrives
- Deducts 5% platform fee → sends to ACM treasury
- Remaining amount allocated pro-rata to all token holders
- Uses a dividend-tracking pattern (cumulative revenue per token) for gas-efficient distribution

**Claim flow:**
- `claimDistribution(agentId)` — holder claims their accumulated distributions in FDUSD
- Alternatively: auto-push distributions (higher gas, better UX) — configurable per agent

### EscrowManager
Manages capital raised during offerings.

- Holds FDUSD from share purchases until minimum raise is met
- Releases funds to operator on milestone schedule (not all at once)
- Default milestones: 33% at funding, 33% at 30 days (if revenue maintained), 34% at 90 days
- Triggers auto-refund if revenue cliff protection activates

## Lock-up Enforcement

### Investor lock-up (6 months)
- Token is non-transferable in v1 (enforced at contract level)
- In v2: `transfer()` checks `block.timestamp >= purchaseTimestamp + 180 days`

### Operator lock-up (12 months)
- Operator's share of revenue vests monthly over 12 months
- Operator tokens (if any reserved) locked for 12 months
- Early exit by operator triggers remaining escrow return to investors

## Revenue Cliff Protection

Automated protection against operator abandonment or revenue manipulation:

1. ACM platform monitors agent revenue via oracle / off-chain verification
2. If 30-day trailing revenue drops below 50% of revenue at time of raise:
   - Alert issued to operator (7-day grace period)
   - If not resolved: remaining escrowed funds returned to investors pro-rata
   - Offering status → CLOSED
   - Agent delisted

## Gas Considerations

- BNB Chain gas fees: ~$0.01-0.05 per transaction
- Distribution uses cumulative dividend pattern — O(1) gas per claim regardless of holder count
- Batch operations for multi-agent portfolio claims
- Estimated cost per distribution cycle: <$1 even with 1,000+ holders

## Upgrade Path

- v1: Non-transferable, claim-based distributions, milestone escrow
- v2: Transferable with limits (25% per 30 days), secondary market via ACM DEX, cross-chain bridging
- v3: Agent-to-agent investment via agentic wallet integration, auto-reinvestment strategies
