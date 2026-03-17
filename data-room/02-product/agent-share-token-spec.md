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

> **Status:** Deployed to BNB Chain testnet (Chain ID 97). All contracts verified and functional.

### OfferingFactory (1 instance — deploys all per-offering contracts)
Creates a full contract set (AgentShare + Escrow + RevenueDistributor) for each agent listing in a single transaction.

- `createOffering(OfferingParams)` → deploys AgentShare, Escrow, and RevenueDistributor contracts
- `OfferingParams` struct: `agentId, name, symbol, revenueShareBps, totalSupply, minRaise, maxRaise, pricePerShare, deadline, operator`
- `getOffering(uint256 id)` → returns all deployed addresses + metadata
- `totalOfferings()` → number of offerings created
- Access controlled: `approvedOperators` mapping + contract owner

**Deployed (testnet):** `0xe6C3AA4130c4Bf68dACEEE6F1cb8467dF2E262DA`

### AgentShare (1 per offering — BEP-20 token)
Each offering gets its own BEP-20 token contract with fixed supply, minted entirely to the linked Escrow contract at creation.

- `name`, `symbol` — set at deploy (e.g., "RevenueBot Shares" / "RBS")
- `totalSupply` — fixed at creation, 18 decimals
- `revenueShareBps` — basis points (e.g., 1500 = 15%), immutable
- Non-transferable in v1

**Deployed (demo offering):** `0xa8b47e1f450a484c3D40622fB23C1e825A7A25F9`

### Escrow (1 per offering)
Holds FDUSD from investor deposits until minimum raise is met. Distributes AgentShare tokens to depositors.

**Purchase flow (two-step ERC-20 pattern):**
1. Investor calls `FDUSD.approve(escrowAddress, amount)`
2. Investor calls `Escrow.deposit(amount)` — escrow pulls FDUSD via `transferFrom`, sends AgentShare tokens pro-rata

**Escrow management:**
- `release()` — operator calls after `minRaise` met. Transfers all FDUSD to operator. One-time.
- `triggerRefund()` — enables refund mode (offering expired or cliff protection triggered)
- `claimRefund()` — investors burn AgentShare tokens, reclaim deposited FDUSD

**View functions:** `totalRaised()`, `minRaise()`, `maxRaise()`, `deadline()`, `released()`, `refunding()`

**Deployed (demo offering):** `0x0c50cc920489B3FE39670708071c4eC959BA867F`

### RevenueDistributor (1 per offering)
Handles incoming revenue and distributes to AgentShare holders using cumulative dividend pattern.

**Revenue deposit:**
- `depositRevenue(uint256 amount)` — operator deposits FDUSD revenue
- Deducts platform fee (5%) → sends to ACM treasury
- Splits remainder: operator share + investor share (based on `revenueShareBps`)
- Updates `cumulativeRevenuePerToken` — O(1) gas regardless of holder count

**Claim flow:**
- `claim()` — holder claims accumulated distributions in FDUSD
- `claimable(address)` — view pending distribution amount

**Deployed (demo offering):** `0x3217ED63cB3ee9758c7b0D1047B73F83b9585fAF`

### MockFDUSD (testnet only)
- ERC-20 test token ("ACM Mock FDUSD" / "mFDUSD"), public `mint()`, 18 decimals
- Production will use real FDUSD: `0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409`

**Deployed (testnet):** `0xAceB12E8E2F7126657E290BE382dA2926C1926FA`

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
