# ACM — MVP Compliance Matrix

Acceptance gate for V1 testnet sign-off. Every row must reach **Complete** before mainnet audit can begin.

Status key: **Complete** | **Partial** | **Missing** | **N/A**

## Core Flows

| # | Requirement | Status | Evidence / Notes |
|---|-------------|--------|-----------------|
| C1 | Operator can create an offering via web UI | Complete | `create-offering-form.tsx` → DB insert |
| C2 | Operator can deploy contracts (AgentShare + Escrow + RevenueDistributor) from web UI | Partial | `deploy-offering.tsx` built. Blocked: operator must be pre-approved on factory via Hardhat. No approval script exists. |
| C3 | Investor can buy shares (FDUSD approve → escrow deposit → AgentShare tokens) | Complete | `invest-button.tsx`, two-step ERC-20 pattern |
| C4 | Operator can release escrow when minRaise met | Complete | `escrow-manage.tsx` → `Escrow.release()` |
| C5 | Operator can trigger refund if offering fails | Complete | `escrow-manage.tsx` → `Escrow.triggerRefund()` |
| C6 | Investor can claim refund | Complete | `escrow-manage.tsx` → `Escrow.claimRefund()` |
| C7 | Operator can distribute revenue (FDUSD → RevenueDistributor) | Complete | `distribute-revenue.tsx`, two-step approve + depositRevenue |
| C8 | Investor can claim accumulated revenue | Complete | `claim-revenue.tsx` → `RevenueDistributor.claim()` |
| C9 | Full cycle tested end-to-end on testnet | Missing | No recorded E2E test pass. Individual flows built but never run as a connected sequence with fresh contracts. |

## Infrastructure

| # | Requirement | Status | Evidence / Notes |
|---|-------------|--------|-----------------|
| I1 | App deployed and accessible | Complete | Railway: `https://perfect-forgiveness-production-fd63.up.railway.app/` |
| I2 | Smart contracts deployed to BNB testnet | Complete | 5 contracts, addresses in `chain-config.ts` + DB |
| I3 | Database schema applied | Complete | 4 Supabase migrations |
| I4 | Indexer runs automatically on schedule | Missing | `/api/cron` endpoint exists. No cron service configured. `INDEXER_SECRET` not set in Railway. |
| I5 | Revenue monitor captures FDUSD transfers | Partial | `/api/monitor/revenue` built. Never tested with real transfers. |

## Smart Contracts

| # | Requirement | Status | Evidence / Notes |
|---|-------------|--------|-----------------|
| S1 | Hardhat unit tests for all contracts | Missing | Zero tests written. |
| S2 | Factory operator approval script | Missing | `setApprovedOperator` exists in contract. No Hardhat script to call it. |
| S3 | Smart contract audit | Missing | Pre-mainnet gate. Not started. |

## Security

| # | Requirement | Status | Evidence / Notes |
|---|-------------|--------|-----------------|
| X1 | Supabase RLS policies audited | Missing | Policies exist but never reviewed for correctness. |
| X2 | Indexer/cron endpoints auth-gated | Complete | `INDEXER_SECRET` header check in all indexer routes. |
| X3 | No secrets in committed code | Complete | `contracts/.env` gitignored, deployer key safe. |

## Data Integrity

| # | Requirement | Status | Evidence / Notes |
|---|-------------|--------|-----------------|
| D1 | On-chain state syncs to Supabase | Partial | Indexer endpoints built. Never run against live contract events from a fresh deploy. |
| D2 | Duplicate event handling | Complete | Unique constraint on `tx_hash` in `on_chain_events`. |
