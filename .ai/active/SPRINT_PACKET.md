# Sprint: E2E Testnet Cycle

**Sprint Type:** feature
**Sprint Reason:** C9 (Full cycle tested end-to-end on testnet) is the single largest compliance gap. All individual flows are built but have never been run as a connected sequence. This sprint proves the system works end-to-end before any mainnet or audit work begins.

## Objective

Execute the full lifecycle on BNB testnet through the live Railway deployment: create an offering → deploy contracts from the UI → invest FDUSD → release escrow → distribute revenue → claim earnings. Record evidence for each step.

## Why This Sprint Matters

Every flow has been built and unit-verified in isolation. But no one has ever run step 1 through step 8 in order on the live deployment. Until this passes, the platform cannot be considered testnet-complete. Compliance row C9 blocks the audit gate.

## In Scope

1. **Create a fresh test offering** via operator UI on the live deployment
2. **Deploy contracts** from the operator page using MetaMask (factory deploy UI)
3. **Mint test FDUSD** via faucet for an investor wallet
4. **Invest** — FDUSD approve → escrow deposit → verify AgentShare tokens received
5. **Release escrow** — operator triggers release after minRaise met
6. **Distribute revenue** — operator approves FDUSD → deposits into RevenueDistributor
7. **Claim revenue** — investor claims accumulated FDUSD from distributor
8. **Verify indexer** — confirm cron picks up events, `indexer_state` advances, `on_chain_events` populated
9. **Fix any bugs** encountered during the cycle (repair scope, not feature scope)

## Out of Scope

- New features or UI improvements
- Stripe/fiat rail
- Smart contract unit tests (separate sprint S1)
- RLS audit (separate sprint X1)
- Cron scheduler setup (can be triggered manually for this sprint)
- Any mainnet work

## Files / Modules In Scope

- `app/src/components/wallet/` — all wallet interaction components (deploy, invest, escrow, distribute, claim, faucet)
- `app/src/app/operator/` — operator pages
- `app/src/app/offerings/` — offering detail / invest pages
- `app/src/app/dashboard/` — investor dashboard
- `app/src/app/api/cron/route.ts` — cron orchestrator
- `app/src/app/api/indexer/` — indexer endpoints
- `app/src/app/api/monitor/revenue/route.ts` — revenue monitor
- `app/src/app/api/offerings/[id]/contracts/route.ts` — contract save endpoint
- `app/src/lib/contracts.ts` — ABIs
- `app/src/lib/chain-config.ts` — contract addresses

## Constraints

- All testing on live Railway deployment + BNB testnet (chain 97)
- Use deployer wallet `0x598B84b07126D8D85Ce1088Eff2C02180F710260` as operator
- Use a separate wallet or the same wallet as investor (document which)
- Every step must produce verifiable evidence (tx hash, DB query, screenshot description, or API response)
- Bug fixes are in-scope but must be documented as deviations

## Relevant Rules

- Two-step ERC-20 pattern for all deposits (approve → deposit)
- All amounts 18 decimals (parseEther/formatEther)
- No BigInt literals
- Client wallet components: `"use client"` + `next/dynamic` with `ssr: false`
- Seed `indexer_state` for any new contracts before expecting indexer to work

## Acceptance Criteria

- [ ] Fresh offering created in DB with all required fields
- [ ] Contracts deployed on-chain via factory UI, addresses saved to DB
- [ ] Investor holds AgentShare tokens after deposit (verified on-chain)
- [ ] Escrow status transitions: pending → funded (after release)
- [ ] Revenue distributed: FDUSD split visible (5% platform, operator share, investor share)
- [ ] Investor claims FDUSD from distributor (balance increases)
- [ ] `on_chain_events` table has Deposited, Released, RevenueReceived events
- [ ] `indexer_state` block numbers have advanced
- [ ] Zero unhandled errors in the full cycle

## Required Tests

- Manual E2E walkthrough (primary deliverable)
- `cd app && npm run build` must pass before and after any fixes
- Cron endpoint `GET /api/cron?key=...` returns 200 with updated data after cycle

## Docs To Update

- `docs/mvp-sow-compliance-matrix.md` — C9 → Complete (with evidence links)
- `docs/mvp-sow-compliance-matrix.md` — I5 → Complete (if revenue monitor captures real transfers)
- `.ai/handoff/CURRENT_STATE.md` — reflect E2E verified status
- `CHANGELOG.md` — v0.5.0 entry

## Definition of Done

All acceptance criteria checked. BUILD_REPORT.md written with tx hashes and DB evidence for every step. Compliance matrix C9 marked Complete. Build passes.

## Git Instructions

- **Branch Name:** `sprint-002-e2e-testnet`
- **Base Branch:** `main`
- **PR Strategy:** Single PR with all fixes accumulated during the cycle
- **Merge Policy:** Squash merge after review pass. If no code changes needed (clean run), merge is a docs-only commit on main.
