# ACM — Changelog

## v0.8.0 — Smart Contract Audit Prep (March 2026)

- Slither static analysis: 7 High fixed (SafeERC20), 13 Optimization fixed (immutable), 1 Medium + 9 Low accepted
- Added `SafeERC20` to all ERC-20 transfer calls in Escrow and RevenueDistributor
- Added `immutable` to 13 state variables across 4 contracts (gas optimization)
- Added zero-address checks to RevenueDistributor constructor
- Flattened contract sources in `contracts/flat/` for auditor handoff
- Audit scope document: `docs/audit-scope.md` (contracts, addresses, threat model, known issues)
- Fixed `revenue_events` schema gap: migration `00006_revenue_events.sql`
- All 83 Hardhat tests pass with no behavioral changes
- Compliance matrix: S3 → Partial (prep done, external audit pending)

## v0.7.0 — Supabase RLS Audit (March 2026)

- Full RLS audit of all 8 database tables
- Added missing INSERT policy on `offerings` (scoped to owning operator)
- Added missing UPDATE policy on `offerings` (scoped to owning operator)
- Added missing INSERT policy on `shares` (scoped to authenticated investor's own record)
- Added missing INSERT policy on `distributions` (scoped to owning operator)
- Added explicit DELETE deny policies on all 6 user-facing tables
- Documented intentional RLS exclusion for `indexer_state` and `on_chain_events`
- Verified all 4 service-role routes require `INDEXER_SECRET` auth
- RLS test script: 9 test groups covering cross-user read isolation, cross-operator write blocking, authorized writes, anon rejection, delete blocking, and service-role bypass
- New migration: `supabase/migrations/00005_rls_audit.sql`
- ARCHITECTURE.md: Added comprehensive "Security Model" section
- **Critical finding fixed:** `offerings`, `shares`, and `distributions` had RLS enabled but no write policies — all API writes through the anon-key client were silently blocked
- Compliance matrix: X1 → Complete (17/18 Complete, 1 Missing: S3 audit)

## v0.6.0 — Solidity Unit Tests (March 2026)

- Comprehensive Hardhat unit tests for all 5 Solidity contracts (83 tests, 0 failures)
- Bug fix: `Escrow.claimRefund()` now returns AgentShare tokens to contract via `shareToken.returnShares()` before refunding FDUSD
- New `AgentShare.returnShares()` function (onlyOwner) — mirrors `purchaseShares()` for refund flow
- Test coverage: MockFDUSD (5), AgentShare (18), Escrow (24), RevenueDistributor (15), OfferingFactory (21)
- Revenue distribution math verified: 5% platform fee, revenueShareBps split, multi-investor proportional claims
- Revert conditions tested: unauthorized callers, deadline checks, min raise, duplicate claims
- Compliance matrix: S1 → Complete (16/18 Complete, 2 Missing)

## v0.5.0 — E2E Testnet Cycle (March 2026)

- Full lifecycle verified on BNB testnet: create offering → deploy contracts → invest FDUSD → release escrow → distribute revenue → claim earnings
- Critical bug fix: Escrow.deposit() now transfers AgentShare tokens to investors via `shareToken.purchaseShares()`
- OfferingFactory redeployed (`0x2f3E26b798B4D7906577F52a65BaA991Ea99C67A`) with fixed Escrow bytecode
- Event indexer: block range capped to 200 blocks/cycle to avoid BSC RPC rate limits; indexer always advances position
- Revenue monitor: block range reduced from 1000 to 200 for BSC compatibility
- E2E test script: `contracts/scripts/e2e-cycle.ts` — automated 7-step lifecycle on testnet
- Compliance matrix: C9 Complete, I5 Complete (15/18 Complete, 3 Missing)

## v0.4.0 — Unblock Factory Deploy + Cron Activation (March 2026)

- Factory operator approval script (`contracts/scripts/approve-operator.ts`) — deployer wallet approved on testnet
- Cron pipeline activated on Railway: all 3 indexer endpoints verified live (HTTP 200)
- Railway env vars configured: `INDEXER_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_CHAIN_ID`
- Railway deployment fixed: `railway.json` config, Docker cache-bust workaround
- Indexer state seeded with recent block numbers (avoids full-chain RPC scan)
- Review fixes: useEffect for deploy receipt processing, address validation on contracts API, graceful non-JSON error handling in cron, N+1 query elimination in revenue monitor
- Canonical docs created: PRODUCT_BRIEF, ARCHITECTURE, ROADMAP, RULES, compliance matrix
- Compliance matrix: 13/18 Complete, 2 Partial, 3 Missing

## v0.3.0 — Operator Self-Serve + Monitoring (March 2026)

- Operator factory deploy UI: create offering → deploy AgentShare + Escrow + RevenueDistributor from wallet
- API route to save deployed contract addresses (`POST /api/offerings/[id]/contracts`)
- On-chain revenue monitor: watches FDUSD Transfer events to agent wallets (`POST /api/monitor/revenue`)
- Cron endpoint: orchestrates all indexers on schedule (`GET /api/cron`)
- OfferingCreated event ABI added to contracts.ts
- Dynamic FDUSD address from chain-config (removed hardcoded address)

## v0.2.0 — Blockchain Integration (March 2026)

- OfferingFactory contract: deploys per-offering contract sets (AgentShare + Escrow + RevenueDistributor)
- MockFDUSD test stablecoin with public mint
- All contracts deployed to BNB Chain testnet (Chain ID 97)
- Investor crypto flow: FDUSD approve → escrow deposit → AgentShare tokens
- Operator on-chain management: escrow release/refund, revenue distribution with auto fee-split
- Investor on-chain: view shares, claim accumulated FDUSD distributions, test faucet
- Event indexing pipeline: state sync + event log processing
- Multi-chain config: environment-driven testnet/mainnet switching
- Per-offering contract addresses stored in DB
- Supabase migrations 00003 (contract columns) and 00004 (indexer tables)

## v0.1.0 — Initial Platform (March 2026)

- Next.js 16 app with Supabase Auth
- Agent marketplace: browse, search, detail pages
- Operator dashboard: create agents, manage offerings
- Investor dashboard: portfolio overview, holdings
- Fiat invest flow (DB-based share records)
- Seed data: 5 demo agents, 4 offerings, 12 distributions
- Railway deployment with Docker multi-stage build
- Supabase migrations 00001 (schema) and 00002 (functions)
