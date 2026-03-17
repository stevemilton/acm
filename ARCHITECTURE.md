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
- `scripts/e2e-cycle.ts` — Full E2E lifecycle on testnet (create → invest → release → distribute → claim)
- `scripts/approve-operator.ts` — Approve operator wallet on factory

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

### Cron / Indexer Pipeline
1. External cron calls `GET /api/cron?key=<INDEXER_SECRET>` (every 5 min)
2. Cron orchestrator sequentially calls 3 sub-endpoints via internal POST:
   - `/api/indexer` — reads escrow status + share balances from chain, syncs to `offerings` table
   - `/api/indexer/events` — scans contract event logs (Deposited, Released, RevenueReceived), stores in `on_chain_events`, triggers side-effects (upsert shares, update status, insert distributions)
   - `/api/monitor/revenue` — scans FDUSD Transfer events to agent operator wallets, records in `revenue_events` (excludes escrow-originated transfers)
3. Each sub-endpoint tracks its scan position in `indexer_state` (per contract address)
4. Block range capped at 50 blocks per call to avoid BSC RPC rate limits; indexer always advances position even on RPC failure

## Data Model Summary

**Off-chain (Supabase):** agents, offerings (with contract addresses), shares, distributions, operators, investors, revenue_events, indexer_state, on_chain_events

**On-chain (BNB Chain):** AgentShare balances, Escrow state/FDUSD, RevenueDistributor cumulative dividends

Key relationship: `offerings` table bridges off-chain and on-chain via `escrow_address`, `share_token_address`, `distributor_address`, `factory_offering_id`.

## Security Model

### Supabase RLS Policy Summary

All 6 user-facing tables have Row Level Security (RLS) enabled with explicit policies:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| **operators** | Public read | Own `user_id` only | Own `user_id` only | Blocked |
| **investors** | Public read | Own `user_id` only | Own `user_id` only | Blocked |
| **agents** | Public read | Owning operator only | Owning operator only | Blocked |
| **offerings** | Public read | Owning operator only | Owning operator only | Blocked |
| **shares** | Own investor only | Own `investor_id` only | None (immutable) | Blocked |
| **distributions** | Public read | Owning operator only | None (immutable) | Blocked |

Ownership chain: `auth.uid()` → `operators.user_id` → `agents.operator_id` → `offerings.agent_id` / `distributions.agent_id`.

**System tables** (`indexer_state`, `on_chain_events`) have RLS disabled — they are only accessed by service-role routes and contain non-sensitive public blockchain data.

### Service-Role Usage

Three routes bypass RLS using `SUPABASE_SERVICE_ROLE_KEY`:
- `POST /api/indexer` — syncs on-chain state to `offerings` table
- `POST /api/indexer/events` — processes blockchain events, writes to `on_chain_events`, `shares`, `offerings`, `distributions`
- `POST /api/monitor/revenue` — watches FDUSD transfers, writes to `revenue_events`

All three are protected by `INDEXER_SECRET` header check (`x-indexer-key`). The cron orchestrator (`/api/cron`) also requires the secret (via header or `?key=` query param).

Dev-mode bypass: if `INDEXER_SECRET` env var is unset, auth check is skipped. In production, the secret is always set.

### Database Functions

Three `SECURITY DEFINER` functions bypass RLS for atomic counter updates:
- `increment_investor_invested(investor_id, amount)` — updates `investors.total_invested`
- `increment_investor_earned(investor_id, amount)` — updates `investors.total_earned`
- `increment_shares_sold(offering_id, quantity)` — updates `offerings.shares_sold`

### Other Security Boundaries

- Operator ownership verified via user → operator → agent → offering chain in API routes
- Smart contracts: `onlyOwnerOrApproved` on factory, `onlyOwner` on escrow/distributor
- Non-transferable shares in v1 (no secondary market attack surface)
- Contract deployer private key in `contracts/.env` (gitignored)

## Deployment

| Layer | Environment | Status |
|-------|------------|--------|
| Frontend + API | Railway (Docker) | Live |
| Database | Supabase (managed Postgres) | Live (5 migrations) |
| Smart contracts | BNB Chain testnet (97) | Deployed |
| Indexer cron | External cron → `/api/cron` | Ready (needs cron service) |

### Deployed Contracts (BNB Testnet)
- MockFDUSD: `0xAceB12E8E2F7126657E290BE382dA2926C1926FA`
- OfferingFactory (v2): `0x2f3E26b798B4D7906577F52a65BaA991Ea99C67A`
- AgentShare (demo): `0xa8b47e1f450a484c3D40622fB23C1e825A7A25F9`
- Escrow (demo): `0x0c50cc920489B3FE39670708071c4eC959BA867F`
- RevenueDistributor (demo): `0x3217ED63cB3ee9758c7b0D1047B73F83b9585fAF`

### Multi-Chain Config
Set `NEXT_PUBLIC_CHAIN_ID=56` for mainnet, `97` for testnet. All addresses, RPCs, explorer URLs auto-switch via `chain-config.ts`.

## Open Technical Risks

1. **Smart contract audit** — Required before mainnet. No audit partner selected.
2. **Factory operator approval** — Operators must be approved on-chain by factory owner before deploying. No self-serve approval flow yet.
3. **Indexer reliability** — Depends on external cron. No retry/dead-letter queue.
4. **BSC testnet RPC** — Indexer uses publicnode.com RPC (Binance seed node rate-limits getLogs). No fallback.
5. **Revenue verification** — On-chain monitor is passive (watches transfers). No fraud detection beyond escrow-source filtering.
6. **Supabase RLS** — Audited in sprint 004. All user-facing tables have complete policies. See Security Model section above.
