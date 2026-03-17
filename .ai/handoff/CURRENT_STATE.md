# ACM — Current State (March 2026)

## What Exists

### Deployed Infrastructure
- **Web app:** https://perfect-forgiveness-production-fd63.up.railway.app/
- **Railway:** https://railway.com/project/29fdf09e-e349-4527-88ea-71640ba0a686
- **Supabase:** project `qxcgpngliyphtfdaaukz`, 4 migrations applied
- **BNB testnet (97):** 5 contracts deployed, deployer wallet `0x598B84b07126D8D85Ce1088Eff2C02180F710260`
- **Cron pipeline:** live on Railway, all 3 sub-endpoints verified (indexer, events, revenue monitor)

### Contract Addresses (BNB Testnet)
| Contract | Address |
|----------|---------|
| MockFDUSD | `0xAceB12E8E2F7126657E290BE382dA2926C1926FA` |
| OfferingFactory | `0xe6C3AA4130c4Bf68dACEEE6F1cb8467dF2E262DA` |
| AgentShare (demo) | `0xa8b47e1f450a484c3D40622fB23C1e825A7A25F9` |
| Escrow (demo) | `0x0c50cc920489B3FE39670708071c4eC959BA867F` |
| RevenueDistributor (demo) | `0x3217ED63cB3ee9758c7b0D1047B73F83b9585fAF` |

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
- Event indexer: state sync + event processing API endpoints
- Revenue monitor: watches FDUSD transfers to agent wallets
- Cron pipeline: `/api/cron` orchestrates indexer → events → revenue monitor
- Factory operator approval: deployer wallet approved, script at `contracts/scripts/approve-operator.ts`
- Multi-chain config: env-driven testnet/mainnet switching
- Seed data: 5 agents, 4 offerings, 12 distributions

### Not Built
- External cron scheduler (endpoint exists, needs 5-min trigger)
- E2E testnet cycle never run as connected sequence
- Stripe Connect (stubs only)
- Revenue verification pipeline (Stripe webhooks → revenue_events)
- x402 protocol integration
- Smart contract unit tests (zero written)
- KYC integration
- Secondary market
- Agent-to-agent investment

### Compliance Matrix Score
**13/18 Complete | 2 Partial | 3 Missing**
- Partial: I5 (revenue monitor untested with real transfers), C9 (E2E cycle)
- Missing: S1 (unit tests), S3 (audit), X1 (RLS audit)

### Database Schema (4 migrations)
1. `00001_initial_schema.sql` — Core tables
2. `00002_functions.sql` — DB functions
3. `00003_offering_contracts.sql` — Contract address columns on offerings
4. `00004_indexer.sql` — indexer_state + on_chain_events

### Key Environment Variables (Railway)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CHAIN_ID=97`
- `INDEXER_SECRET=acm-indexer-0a07987723ca0f39f162ea293cbad383`
- `DEPLOYER_PRIVATE_KEY` (in contracts/.env, gitignored)

## Last Completed Sprint (2026-03-17)
**Sprint 001: Unblock Factory Deploy + Activate Cron** — MERGE_APPROVED
- Archive: `.ai/archive/sprint-001-unblock-factory-cron/`
- Review verdict: PASS WITH FIXES (5 quality fixes applied)

## Safest Next Step
E2E testnet cycle: create offering → deploy contracts from UI → invest FDUSD → release escrow → distribute revenue → claim. This is compliance row C9 and the single largest remaining gap.
