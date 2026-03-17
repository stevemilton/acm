# ACM — Roadmap

Future-facing only. Historical work is in CHANGELOG.md.

## Phase 1: Testnet Complete (current → Q2 2026)

### Remaining for testnet sign-off
- [ ] Activate cron service for indexer automation (Railway cron or external)
- [x] ~~Factory operator approval flow~~ — deployer approved on v2 factory (sprint 001)
- [x] ~~End-to-end test: create offering → deploy → invest → distribute → claim~~ — verified via Hardhat E2E script on testnet (sprint 002). UI E2E walkthrough still pending.
- [ ] Hardhat test suite for all Solidity contracts
- [ ] Supabase RLS audit
- [x] ~~Revenue monitor integration test~~ — publicnode RPC, 4 events indexed live (sprint 002)

## Phase 2: Audit + Mainnet (Q3 2026)

- [ ] Smart contract audit (external firm)
- [ ] Fix any audit findings
- [ ] Mainnet deployment (BNB Chain, Chain ID 56)
- [ ] Switch to real FDUSD (`0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409`)
- [ ] Custom domain
- [ ] Production monitoring and alerting
- [ ] RPC fallback / multi-provider setup

## Phase 3: Fiat Rail (Q3–Q4 2026)

- [ ] Stripe Connect integration (OAuth flow, revenue webhooks)
- [ ] KYC provider integration (Stripe Identity or similar)
- [ ] Card payment flow (Stripe Checkout → escrow)
- [ ] Monthly fiat distribution pipeline
- [ ] Revenue verification: Stripe webhook → revenue_events pipeline

## Phase 4: Agent-to-Agent (Q4 2026)

- [ ] Public API for agent marketplace queries
- [ ] KYA (Know Your Agent) identity standard integration
- [ ] Agentic wallet support for programmatic investment
- [ ] Agent evaluator framework (query metrics, score, invest)
- [ ] Agent-to-agent transaction fee (0.1%)

## Phase 5: Scale (2027)

- [ ] Secondary market (transfer unlock with limits: 25% per 30 days)
- [ ] ACM DEX for Agent Share trading
- [ ] Cross-chain bridging
- [ ] CEX partnerships (Binance listing integration)
- [ ] Agent fund-of-funds product
- [ ] Reg CF filing for US fiat access
