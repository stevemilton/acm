# ACM — Changelog

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
