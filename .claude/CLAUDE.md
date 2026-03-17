# Agent Capital Markets (ACM)

ACM is a BNB Chain-native exchange where AI agents list verified revenue, raise capital through revenue share tokens, and distribute earnings via smart contracts.

**Polar Industries Ltd** | github.com/stevemilton/acm

## Canonical Docs

Product, architecture, roadmap, and rules live in the repo root — read these first:

- **PRODUCT_BRIEF.md** — what ACM is, users, scope, non-negotiables
- **ARCHITECTURE.md** — stack, module boundaries, flows, data model, deployment
- **docs/mvp-sow-compliance-matrix.md** — acceptance gate (every row must be Complete before mainnet)
- **ROADMAP.md** — future work only
- **RULES.md** — durable development rules (read before writing code)
- **CHANGELOG.md** — release history
- **.ai/handoff/CURRENT_STATE.md** — snapshot for fresh-thread recovery
- **.ai/active/SPRINT_PACKET.md** — current sprint tasks

## Quick Reference

### Deployed Infrastructure
- **App:** https://perfect-forgiveness-production-fd63.up.railway.app/
- **Railway:** https://railway.com/project/29fdf09e-e349-4527-88ea-71640ba0a686
- **Supabase:** project `qxcgpngliyphtfdaaukz`
- **Chain:** BNB testnet (97), deployer `0x598B84b07126D8D85Ce1088Eff2C02180F710260`

### Key Contracts (BNB Testnet)
- MockFDUSD: `0xAceB12E8E2F7126657E290BE382dA2926C1926FA`
- OfferingFactory: `0xe6C3AA4130c4Bf68dACEEE6F1cb8467dF2E262DA`

### Commands
- `cd app && npm run build` — must pass before commit
- `cd app && npm run dev` — local dev
- `cd contracts && npx hardhat run scripts/deploy.ts --network bscTestnet` — deploy contracts
- `git push origin main` — auto-deploys to Railway

### Environment
- `NEXT_PUBLIC_CHAIN_ID=97` (testnet) or `56` (mainnet)
- `INDEXER_SECRET` — auth for cron/indexer endpoints
- `DEPLOYER_PRIVATE_KEY` in `contracts/.env` — NEVER commit

## Dev Notes

- Wallet components must use `"use client"` + `next/dynamic` with `ssr: false` via a `client-components.tsx` wrapper
- No BigInt literals (`123n`) — use `BigInt(123)` instead
- All on-chain amounts use 18 decimals — use `parseEther()` / `formatEther()`
- Two-step ERC-20 pattern for all deposits: `token.approve()` then `contract.deposit()`
- Per-offering contract addresses in DB (`offerings.escrow_address` etc.), global addresses in `chain-config.ts`
- Supabase/viem clients: create inside handlers, not at module level

## Other Docs

- `data-room/` — investor data room (14 files, separate audience from dev docs)
- `ACM_Pitch_Deck.pptx`, `ACM_Binance_Labs_Deck.pptx` — pitch decks (generators: `pitch_deck*.py`)
