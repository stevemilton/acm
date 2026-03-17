# ACM — Current State (March 2026)

## What Exists

### Deployed Infrastructure
- **Web app:** https://perfect-forgiveness-production-fd63.up.railway.app/
- **Railway:** https://railway.com/project/29fdf09e-e349-4527-88ea-71640ba0a686
- **Supabase:** project `qxcgpngliyphtfdaaukz`, 4 migrations applied
- **BNB testnet (97):** 8 contracts deployed (5 original + 3 E2E), deployer wallet `0x598B84b07126D8D85Ce1088Eff2C02180F710260`
- **Cron pipeline:** live on Railway, all 3 sub-endpoints verified (indexer, events, revenue monitor)
- **E2E cycle:** COMPLETE — full lifecycle verified on testnet via Hardhat script

### Contract Addresses (BNB Testnet)
| Contract | Address | Notes |
|----------|---------|-------|
| MockFDUSD | `0xAceB12E8E2F7126657E290BE382dA2926C1926FA` | Shared across all offerings |
| OfferingFactory (v2) | `0x2f3E26b798B4D7906577F52a65BaA991Ea99C67A` | Fixed Escrow (transfers shares) |
| OfferingFactory (v1) | `0xe6C3AA4130c4Bf68dACEEE6F1cb8467dF2E262DA` | Deprecated — Escrow bug |
| AgentShare (E2E) | `0xbb3696A56fd32b9aD1e0772a511B04a723962A04` | |
| Escrow (E2E) | `0x611128F84236504C1d3bd847EFCFccfFeBd0f196` | |
| RevenueDistributor (E2E) | `0x00d8aC16E976d2FF3fCe16Fbd9f6AB8c0F76e9A6` | |
| AgentShare (demo) | `0xa8b47e1f450a484c3D40622fB23C1e825A7A25F9` | Old factory |
| Escrow (demo) | `0x0c50cc920489B3FE39670708071c4eC959BA867F` | Old factory |
| RevenueDistributor (demo) | `0x3217ED63cB3ee9758c7b0D1047B73F83b9585fAF` | Old factory |

### Working Features
- Auth: email/password login, signup with role selector
- Agent listing: public browse, detail pages with metrics
- Offerings: active offerings with progress bars, share purchase flow
- Crypto invest: FDUSD approve → escrow deposit → AgentShare tokens
- Wallet connect: MetaMask/WalletConnect, BNB testnet switching
- Operator dashboard: manage agents, create offerings, deploy contracts on-chain
- Operator on-chain: escrow release/refund, revenue distribution with fee breakdown
- Investor dashboard: portfolio stats, holdings, distribution history
- Investor on-chain: FDUSD faucet, escrow status, claim revenue
- Event indexer: state sync + event processing with block range capping (50 blocks/cycle), retry-on-failure (never skips events)
- Revenue monitor: watches FDUSD transfers to agent wallets (50 blocks/cycle)
- Indexer RPC: `bsc-testnet-rpc.publicnode.com` (Binance seed node rate-limits getLogs)
- Cron pipeline: `/api/cron` orchestrates indexer → events → revenue monitor
- Factory operator approval: deployer wallet approved on v2 factory
- Multi-chain config: env-driven testnet/mainnet switching
- Seed data: 5 agents, 4 offerings, 12 distributions
- **E2E testnet cycle: VERIFIED** — create → deploy → invest → release → distribute → claim

### Not Built
- External cron scheduler (endpoint exists, needs 5-min trigger)
- Stripe Connect (stubs only)
- Revenue verification pipeline (Stripe webhooks → revenue_events)
- x402 protocol integration
- ~~Smart contract unit tests~~ — 83 tests across 5 contracts (sprint 003)
- KYC integration
- Secondary market
- Agent-to-agent investment

### Compliance Matrix Score
**17/18 Complete | 0 Partial | 1 Missing**
- Missing: S3 (smart contract audit — requires external vendor)
- Note: UI E2E walkthrough remains unverified — E2E cycle was executed via Hardhat script, not browser UI

### Database Schema (5 migrations)
1. `00001_initial_schema.sql` — Core tables + initial RLS policies
2. `00002_functions.sql` — DB functions (security definer)
3. `00003_offering_contracts.sql` — Contract address columns on offerings
4. `00004_indexer.sql` — indexer_state + on_chain_events (no RLS — system tables)
5. `00005_rls_audit.sql` — Missing write policies + explicit delete deny on all tables

### Key Environment Variables (Railway)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CHAIN_ID=97`
- `INDEXER_SECRET=acm-indexer-0a07987723ca0f39f162ea293cbad383`
- `DEPLOYER_PRIVATE_KEY` (in contracts/.env, gitignored)

## Last Completed Sprint (2026-03-17)
**Sprint 004: Supabase RLS Audit** — MERGE_APPROVED
- Archive: `.ai/archive/sprint-004-rls-audit/`
- Migration `00005_rls_audit.sql`: added missing write policies on offerings, shares, distributions
- Explicit DELETE deny on all 6 user-facing tables
- Invest route fix: replaced direct `offerings.update()` with `increment_shares_sold` RPC (security definer)
- X1 compliance item → Complete (17/18)

**Sprint 003: Solidity Unit Tests** — MERGED
- Archive: `.ai/archive/sprint-003-solidity-tests/`

**Sprint 002: E2E Testnet Cycle** — MERGED
- Archive: `.ai/archive/sprint-002-e2e-testnet/`

## Known Tech Debt
- UI E2E walkthrough never performed (E2E was via Hardhat script — contract paths verified, UI paths not)
- Old demo offering (c0000000) in DB references deprecated v1 factory contracts
- Share magnitude mismatch: Escrow produces raw integer shares, RevenueDistributor tests use 18-decimal shares (math works at both scales but integration test would be valuable)
- `revenue_events` table referenced in code but not in migrations 00001–00005 — may need schema audit

## Safest Next Step
17/18 compliance complete. The only remaining gap is S3 (smart contract audit), which requires an external auditor. The next internally-actionable sprint would be **audit prep**: flatten contracts, run Slither static analysis, fix any findings, prepare audit scope document. Alternatively, tackle UI E2E walkthrough or the `revenue_events` table schema gap.
