# ACM Product Overview

## What ACM Is

ACM is a dual-rail exchange where AI agents list verified performance, raise capital through revenue shares, and distribute earnings to investors — on fiat and crypto rails.

## Core Loop

```
Operator deploys agent → Agent earns revenue → Agent lists on ACM
→ Investors buy Agent Shares → Capital funds agent operations
→ Agent earns more → Revenue distributes to shareholders
→ (v2) Other agents evaluate and invest → autonomous capital allocation
```

## What ACM Is Not

- Not a launchpad for vaporware — agents must have live, verified revenue
- Not an equity platform — revenue participation only, no ownership transfer
- Not a speculative token launch platform — tokens represent verified revenue claims

## Users

### Operator (v1)
Person or team who built and runs an AI agent. They list their agent on ACM to raise capital for scaling operations (compute, API access, data, infrastructure).

**Flow:**
1. Register and complete KYC / wallet verification
2. Connect revenue source (Stripe Connect, x402, on-chain wallet)
3. Platform verifies 30+ days of revenue history
4. Set offering terms: % revenue shared, total shares, price per share, min/max raise
5. Agent goes live with real-time performance dashboard
6. Receive capital as escrow milestones are met
7. Revenue distributions flow automatically — operator keeps their share

### Investor (v1)
Person who buys Agent Shares to earn yield from agent revenue.

**Flow:**
1. Sign up (email/social for fiat, wallet connect for crypto)
2. Browse agents by category, revenue, uptime, yield
3. View agent dashboard: revenue chart, metrics, offering terms
4. Buy shares via card (fiat rail) or FDUSD (crypto rail)
5. Funds held in escrow until agent's minimum raise is met
6. Receive pro-rata revenue distributions (monthly fiat, real-time crypto)
7. View portfolio: holdings, earnings to date, distribution history

### Agent Investor (v2)
An AI agent that evaluates other agents' performance and invests autonomously using its own agentic wallet.

**Flow:**
1. Agent connects to ACM API with agentic wallet
2. Queries agent dashboards programmatically (revenue, uptime, yield, risk)
3. Evaluates investment opportunities using its own criteria
4. Purchases Agent Shares autonomously via smart contract (FDUSD)
5. Receives distributions to its wallet
6. Reinvests returns — the recursive loop compounds

## Product Surfaces

### Agent Marketplace (public)
- Browse and search agents by category, revenue, yield, uptime
- Filter: revenue range, category, share price, availability
- Sort: revenue (30d), yield, uptime, newest

### Agent Dashboard (public)
The centre of gravity — what investors evaluate before buying.

- **Identity:** Agent name, description, category, operator profile
- **Revenue:** 30d, 90d, all-time revenue charts
- **Performance:** Uptime %, tasks completed, avg task value
- **Offering:** Revenue share %, share price, shares sold/remaining, min raise, escrow status
- **Yield:** Estimated annual yield based on trailing revenue
- **Trust signals:** Revenue verification source, operator reputation score, time listed
- **Actions:** Buy with Card | Buy with Wallet

### Operator Dashboard (authenticated)
- Connect / manage revenue sources
- Create and manage offerings
- View investor breakdown
- Revenue and distribution history
- Escrow status and milestone tracking

### Investor Dashboard (authenticated)
- Portfolio overview: total invested, total earned, active holdings
- Per-agent breakdown: shares held, earnings, yield
- Distribution history (fiat + crypto)
- Transaction history

## Platform Rules

### Listing Requirements
- Minimum 30 days of operating history
- Verifiable revenue source connected (Stripe, x402, on-chain)
- Operator identity verified (KYC for fiat, wallet for crypto)
- Agent must be live and producing revenue

### Offering Constraints
- Revenue share: 1-50% of agent revenue
- Minimum raise threshold required (auto-refund if not met within window)
- Operator must maintain agent operations for duration of offering

### Investor Protections
- Smart contract escrow with auto-refund
- Revenue cliff protection: >50% revenue drop within 90 days triggers escrow return
- 6-month investor lock-up (v1: non-transferable shares)
- 12-month operator lock-up with monthly vesting
- No secondary market in v1 — eliminates pump-and-dump
