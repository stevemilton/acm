# ACM — Current State (March 2026)

## What Exists

### Deployed Infrastructure
- **Web app:** https://perfect-forgiveness-production-fd63.up.railway.app/
- **Railway:** https://railway.com/project/29fdf09e-e349-4527-88ea-71640ba0a686
- **Supabase:** project `qxcgpngliyphtfdaaukz`, 4 migrations applied
- **BNB testnet (97):** 5 contracts deployed, deployer wallet `0x598B84b07126D8D85Ce1088Eff2C02180F710260`

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
- Cron endpoint: `/api/cron` orchestrates all indexers
- Multi-chain config: env-driven testnet/mainnet switching
- Seed data: 5 agents, 4 offerings, 12 distributions

### Not Built
- Stripe Connect (stubs only at `/api/stripe/connect` and `/api/webhooks/stripe`)
- Revenue verification pipeline (Stripe webhooks → revenue_events)
- x402 protocol integration
- Factory operator approval UI (manual via Hardhat)
- Cron service activation (endpoint exists, no scheduler configured)
- Smart contract tests
- KYC integration
- Secondary market
- Agent-to-agent investment

### Database Schema (4 migrations)
1. `00001_initial_schema.sql` — Core tables
2. `00002_functions.sql` — DB functions
3. `00003_offering_contracts.sql` — Contract address columns on offerings
4. `00004_indexer.sql` — indexer_state + on_chain_events

### Key Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CHAIN_ID` (97 testnet, 56 mainnet)
- `INDEXER_SECRET` (auth for cron/indexer endpoints)
- `DEPLOYER_PRIVATE_KEY` (in contracts/.env, gitignored)

## Last Completed Work
- Factory deploy UI: operators can deploy contracts from web app
- On-chain revenue monitor: watches FDUSD transfers to agent wallets
- Indexer cron endpoint: `/api/cron` runs all indexers
- Data room updated with all implementation details

## Safest Next Step
Activate cron service + end-to-end test the full cycle on testnet.
