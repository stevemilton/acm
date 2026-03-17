# ACM — Architecture

## System Overview

```
Frontend (Next.js 16 on Railway)
├── Marketplace (public browse/search)
├── Agent Dashboard (public metrics + invest flow)
├── Operator Dashboard (manage offerings, escrow, distributions)
├── Investor Dashboard (portfolio, claims, faucet)
└── API Routes (agents, offerings, indexer, cron, monitor)

Auth Layer
├── Supabase Auth (email/social)
└── wagmi/viem (wallet connect)

Data Layer
├── Supabase (Postgres) — off-chain state, user profiles, revenue events
└── BNB Chain — on-chain state, tokens, escrow, distributions

Smart Contracts (BNB Chain, Solidity 0.8.20)
├── OfferingFactory (1 instance) — deploys per-offering contract sets
├── AgentShare (BEP-20 per offering) — revenue share token
├── Escrow (per offering) — FDUSD deposit/release/refund
├── RevenueDistributor (per offering) — cumulative dividend pattern
└── MockFDUSD (testnet) — test stablecoin
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + TypeScript + Tailwind v4 |
| Auth (fiat) | Supabase Auth |
| Auth (crypto) | wagmi v3 + viem |
| Database | Supabase (Postgres) |
| API | Next.js API routes |
| Smart contracts | Solidity 0.8.20, Hardhat, OpenZeppelin |
| Payments (fiat) | Stripe Connect (designed, not built) |
| Hosting | Railway (Docker, node:22-alpine) |

## Module Boundaries

### `/app/src/app/` — Pages + API
- `agents/[id]/` — Public agent detail, invest flow (client components with wagmi)
- `operator/agents/[id]/` — Operator management: create offering, deploy contracts, escrow, distributions
- `dashboard/` — Investor portfolio
- `api/indexer/` — On-chain state + event sync
- `api/monitor/revenue/` — FDUSD transfer monitoring
- `api/cron/` — Orchestrates all indexers on schedule
- `api/offerings/[id]/contracts/` — Save deployed contract addresses

### `/app/src/lib/` — Shared libraries
- `chain-config.ts` — Multi-chain config (testnet/mainnet), environment-driven
- `contracts.ts` — All ABIs (Escrow, AgentShare, RevenueDistributor, Factory, ERC20, events)
- `wagmi.ts` — Wagmi config derived from chain-config
- `auth.ts` — Server auth helpers (getUser, requireOperator)

### `/app/src/components/wallet/` — Wallet UI
- `deploy-offering.tsx` — Factory deploy from operator wallet
- `escrow-manage.tsx` — Release/refund escrow
- `distribute-revenue.tsx` — FDUSD approve → depositRevenue
- `claim-revenue.tsx` — Investor claim accumulated distributions
- `test-faucet.tsx` — Mint MockFDUSD

### `/contracts/` — Hardhat project
- `contracts/` — Solidity sources
- `scripts/deploy.ts` — Deployment script

## Main Flows

### Invest Flow (crypto rail)
1. Investor calls `FDUSD.approve(escrowAddress, amount)`
2. Investor calls `Escrow.deposit(amount)` — escrow pulls FDUSD, sends AgentShare tokens

### Distribution Flow
1. Operator calls `FDUSD.approve(distributorAddress, amount)`
2. Operator calls `RevenueDistributor.depositRevenue(amount)`
3. Contract auto-splits: 5% platform → treasury, remainder by revenueShareBps
4. Investor calls `claim()` to withdraw accumulated FDUSD

### Factory Deploy Flow
1. Operator fills form in UI → DB insert
2. Operator clicks "Deploy to Blockchain" → wallet sends `createOffering()` tx
3. Factory deploys AgentShare + Escrow + RevenueDistributor
4. UI parses OfferingCreated event → saves addresses to DB

### Indexer Flow
1. `/api/cron` called on schedule (GET with auth key)
2. Runs `/api/indexer` (state sync), `/api/indexer/events` (event processing), `/api/monitor/revenue` (FDUSD transfers)
3. Updates Supabase with on-chain state

## Data Model Summary

**Off-chain (Supabase):** agents, offerings (with contract addresses), shares, distributions, operators, investors, revenue_events, indexer_state, on_chain_events

**On-chain (BNB Chain):** AgentShare balances, Escrow state/FDUSD, RevenueDistributor cumulative dividends

Key relationship: `offerings` table bridges off-chain and on-chain via `escrow_address`, `share_token_address`, `distributor_address`, `factory_offering_id`.

## Auth / Security Boundaries

- Supabase RLS on all tables
- Operator ownership verified via user → operator → agent → offering chain
- Indexer endpoints protected by `INDEXER_SECRET` header/query param
- Smart contracts: `onlyOwnerOrApproved` on factory, `onlyOperator` on escrow/distributor
- Non-transferable shares in v1 (no secondary market attack surface)

## Deployment

| Layer | Environment | Status |
|-------|------------|--------|
| Frontend + API | Railway (Docker) | Live |
| Database | Supabase (managed Postgres) | Live (4 migrations) |
| Smart contracts | BNB Chain testnet (97) | Deployed |
| Indexer cron | External cron → `/api/cron` | Ready (needs cron service) |

### Deployed Contracts (BNB Testnet)
- MockFDUSD: `0xAceB12E8E2F7126657E290BE382dA2926C1926FA`
- OfferingFactory: `0xe6C3AA4130c4Bf68dACEEE6F1cb8467dF2E262DA`
- AgentShare (demo): `0xa8b47e1f450a484c3D40622fB23C1e825A7A25F9`
- Escrow (demo): `0x0c50cc920489B3FE39670708071c4eC959BA867F`
- RevenueDistributor (demo): `0x3217ED63cB3ee9758c7b0D1047B73F83b9585fAF`

### Multi-Chain Config
Set `NEXT_PUBLIC_CHAIN_ID=56` for mainnet, `97` for testnet. All addresses, RPCs, explorer URLs auto-switch via `chain-config.ts`.

## Open Technical Risks

1. **Smart contract audit** — Required before mainnet. No audit partner selected.
2. **Factory operator approval** — Operators must be approved on-chain by factory owner before deploying. No self-serve approval flow yet.
3. **Indexer reliability** — Depends on external cron. No retry/dead-letter queue.
4. **BSC testnet RPC** — Single hardcoded RPC endpoint. No fallback.
5. **Revenue verification** — On-chain monitor is passive (watches transfers). No fraud detection beyond escrow-source filtering.
6. **Supabase RLS** — Policies exist but need audit for completeness.
