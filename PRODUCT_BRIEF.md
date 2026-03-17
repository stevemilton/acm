# ACM — Product Brief

## Summary

ACM (Agent Capital Markets) is a BNB Chain-native exchange where AI agents list verified revenue performance, raise capital through revenue share tokens, and distribute earnings to investors via smart contracts.

**One marketplace. Two rails. Three functions: Verify, Raise, Distribute.**

## Problem

AI agents are the new businesses — but they have no way to raise capital. Traditional VC can't evaluate 10,000 agents. Internet Capital Markets (token launches) solved fundraising but not trust — 90%+ of projects had no real revenue. The agent economy needs financial infrastructure that is verified, structured, and scalable.

## Target Users

| User | Description |
|------|-------------|
| **Operator** (v1) | Person/team who built and runs an AI agent. Lists on ACM to raise capital for scaling. |
| **Investor** (v1) | Person who buys Agent Share tokens to earn yield from agent revenue. |
| **Agent Investor** (v2) | AI agent that evaluates other agents and invests autonomously via agentic wallet. |

## Value Proposition

- **For operators:** Raise capital without giving up equity. Revenue-share model aligned with agent economics.
- **For investors:** Verified yield from real agent revenue. Smart contract escrow and cliff protection.
- **For the ecosystem:** Agent-to-agent capital allocation — recursive autonomous investment only possible on crypto rails.

## V1 Scope

### Crypto Rail (primary — BNB Chain)
- OfferingFactory deploys per-offering contract sets (AgentShare + Escrow + RevenueDistributor)
- Operator self-serve: create offering in UI → deploy contracts from wallet
- Investor flow: FDUSD approve → escrow deposit → receive AgentShare tokens
- Operator management: escrow release/refund, revenue distribution with auto fee-split
- Investor claims: view shares, claim accumulated FDUSD distributions
- On-chain event indexing (chain → Supabase sync)
- On-chain revenue monitoring (FDUSD transfers to agent wallets)
- Automated indexer cron

### Fiat Rail (designed, not implemented)
- Stripe Connect for revenue verification and payouts
- Card payments via Stripe Checkout
- Monthly distributions

## Non-Goals (v1)

- Secondary market / share transfers
- Agent-to-agent investment
- KYC provider integration
- Cross-chain support
- CEX partnerships
- Stripe Connect implementation

## Success Criteria

1. End-to-end raise → distribute cycle on BNB testnet
2. Operator can create offering and deploy contracts from web UI
3. Investor can buy shares, view holdings, claim revenue
4. Revenue monitoring captures FDUSD transfers to operator wallets
5. Indexer runs automatically on schedule
6. Smart contract audit passed (pre-mainnet gate)

## Product Non-Negotiables

- **No vaporware:** 30+ days verified revenue required before listing
- **Third-party verified:** Revenue via Stripe/x402/on-chain — not self-reported
- **Smart contract escrow:** Auto-refund if minimum raise not met
- **Revenue cliff protection:** >50% revenue drop triggers escrow return
- **Non-transferable shares (v1):** No secondary market = no pump-and-dump
- **Operator vesting:** 12-month lock, monthly vest
- **Investor lock-up:** 6 months
