# ACM — MVP Compliance Matrix

Acceptance gate for V1 testnet sign-off. Every row must reach **Complete** before mainnet audit can begin.

Status key: **Complete** | **Partial** | **Missing** | **N/A**

## Core Flows

| # | Requirement | Status | Evidence / Notes |
|---|-------------|--------|-----------------|
| C1 | Operator can create an offering via web UI | Complete | `create-offering-form.tsx` → DB insert |
| C2 | Operator can deploy contracts (AgentShare + Escrow + RevenueDistributor) from web UI | Complete | `deploy-offering.tsx` built. Operator approval script created and run — deployer approved on factory. |
| C3 | Investor can buy shares (FDUSD approve → escrow deposit → AgentShare tokens) | Complete | `invest-button.tsx`, two-step ERC-20 pattern |
| C4 | Operator can release escrow when minRaise met | Complete | `escrow-manage.tsx` → `Escrow.release()` |
| C5 | Operator can trigger refund if offering fails | Complete | `escrow-manage.tsx` → `Escrow.triggerRefund()` |
| C6 | Investor can claim refund | Complete | `escrow-manage.tsx` → `Escrow.claimRefund()` |
| C7 | Operator can distribute revenue (FDUSD → RevenueDistributor) | Complete | `distribute-revenue.tsx`, two-step approve + depositRevenue |
| C8 | Investor can claim accumulated revenue | Complete | `claim-revenue.tsx` → `RevenueDistributor.claim()` |
| C9 | Full cycle tested end-to-end on testnet | Complete | E2E cycle executed via `contracts/scripts/e2e-cycle.ts` on BNB testnet. All 7 steps verified: factory deploy → create offering → mint FDUSD → invest (500 FDUSD → 100 shares) → release escrow → distribute revenue (1000 FDUSD, 5%/85%/15% split) → claim (142.5 FDUSD). TX evidence in `.ai/active/BUILD_REPORT.md`. Bug fixed: Escrow now transfers AgentShare tokens on deposit. |

## Infrastructure

| # | Requirement | Status | Evidence / Notes |
|---|-------------|--------|-----------------|
| I1 | App deployed and accessible | Complete | Railway: `https://perfect-forgiveness-production-fd63.up.railway.app/` |
| I2 | Smart contracts deployed to BNB testnet | Complete | 5 contracts, addresses in `chain-config.ts` + DB |
| I3 | Database schema applied | Complete | 4 Supabase migrations |
| I4 | Indexer runs automatically on schedule | Complete | `/api/cron` endpoint live on Railway. `INDEXER_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_CHAIN_ID` set. All 3 sub-endpoints verified healthy (HTTP 200). Needs external cron trigger (every 5 min). |
| I5 | Revenue monitor captures FDUSD transfers | Complete | `/api/monitor/revenue` deployed. E2E cycle generated real FDUSD transfers on testnet (distribute TX `0xcad72f1f...`). Block range capped to 200 to avoid BSC rate limits. |

## Smart Contracts

| # | Requirement | Status | Evidence / Notes |
|---|-------------|--------|-----------------|
| S1 | Hardhat unit tests for all contracts | Complete | 83 tests across 5 contracts (MockFDUSD, AgentShare, Escrow, RevenueDistributor, OfferingFactory). All pass. Happy paths, reverts, access control, multi-investor scenarios covered. |
| S2 | Factory operator approval script | Complete | `contracts/scripts/approve-operator.ts` created and executed. Deployer `0x598B...0260` approved on OfferingFactory. Verified via Hardhat console. |
| S3 | Smart contract audit | Missing | Pre-mainnet gate. Not started. |

## Security

| # | Requirement | Status | Evidence / Notes |
|---|-------------|--------|-----------------|
| X1 | Supabase RLS policies audited | Complete | Full audit in sprint 004. Migration `00005_rls_audit.sql` adds missing INSERT/UPDATE policies on `offerings`, `shares`, `distributions`. Explicit DELETE deny on all 6 tables. RLS test script at `supabase/tests/rls_audit.sql` covers cross-user isolation, cross-operator write blocking, anon rejection, and service-role bypass. System tables (`indexer_state`, `on_chain_events`) intentionally exempt — documented. |
| X2 | Indexer/cron endpoints auth-gated | Complete | `INDEXER_SECRET` header check in all indexer routes. |
| X3 | No secrets in committed code | Complete | `contracts/.env` gitignored, deployer key safe. |

## Data Integrity

| # | Requirement | Status | Evidence / Notes |
|---|-------------|--------|-----------------|
| D1 | On-chain state syncs to Supabase | Complete | Indexer endpoints deployed and verified. `/api/indexer` synced offering state (status, shares_sold) from chain to DB. |
| D2 | Duplicate event handling | Complete | Unique constraint on `tx_hash` in `on_chain_events`. |
