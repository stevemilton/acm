# Agent Capital Markets (ACM)

## What ACM Is

ACM is a dual-rail exchange where AI agents list verified performance, raise capital through revenue shares, and distribute earnings to investors — on fiat and crypto rails.

**One marketplace. Two rails. Three functions: Verify, Raise, Distribute.**

- Agents must have 30+ days of live, verified revenue before listing — no vaporware
- Revenue share tokens (not equity, not speculative tokens) — structured claims on agent revenue
- Anti-fraud by design: escrow, lock-ups, cliff protection, operator vesting

## Company

- **Company:** Polar Industries Ltd
- **GitHub:** stevemilton/acm
- **Local:** /Users/stevemilton/Projects/acm

## Core Thesis

The structural parallel is Internet Capital Markets (ICMs) → Agent Capital Markets:
- ICMs: projects create tokens to raise capital (speculative, narrative-driven)
- ACMs: agents list verified revenue and issue revenue share tokens (performance-driven)
- The unlock: agents investing in agents — autonomous capital allocation. Only possible on crypto rails.

## Dual-Rail Architecture

### Fiat Rail
- Revenue verification: Stripe Connect, Visa VIC, Mastercard Agent Pay, ACP
- Payments: Stripe Checkout
- Distributions: Monthly via Stripe payouts
- Shares: Revenue participation agreement (legal contract)
- Investors: KYC'd individuals (Reg CF)
- Jurisdiction: US/UK regulated

### Crypto Rail (Binance Labs pitch focus)
- Chain: **BNB Chain** — BEP-20 Agent Share tokens
- Settlement: **FDUSD** (primary), USDC/USDT (secondary)
- Revenue verification: x402 protocol, on-chain wallet monitoring
- Distributions: Real-time via smart contract
- Investors: Wallet holders (permissionless)
- Agent-to-agent: Native — autonomous allocation via agentic wallets

## Three Core Functions

1. **Verify** — Connect agent revenue sources (Stripe, x402, on-chain). Real-time performance dashboards. No self-reporting.
2. **Raise** — Agents issue revenue share tokens (BEP-20). Investors buy with FDUSD or card. Smart contract escrow until minimum raise met.
3. **Distribute** — Revenue flows through ACM. 5% platform fee. Rest splits operator + shareholders pro-rata.

## Revenue Model

| Source | Rate |
|--------|------|
| Distribution fee | 5% of revenue flowing through |
| Transaction fee on share purchases | 2% |
| Agent-to-agent fee (v2) | 0.1% |
| Listing fee | Free (v1) |

## Trust Architecture / Anti-Fraud

- **No vaporware:** 30+ days verified revenue required before listing
- **Third-party verified:** Revenue via Stripe/Visa/MC/x402 — not self-reported
- **Smart contract escrow:** Funds held until minimum raise met. Auto-refund if not.
- **Revenue cliff protection:** If revenue drops >50% within 90 days, remaining escrow returns to investors
- **Operator vesting:** 12-month lock, monthly vest — same schedule as investors
- **Non-transferable shares (v1):** No secondary market = no pump-and-dump. Secondary in v2 with limits.
- **Investor lock-up:** 6 months

## Regulatory Stance

- Agent Shares ARE securities under the Howey Test (4/4 prongs met)
- This is solvable via exemptions: Reg CF ($5M/year, anyone can invest), Reg A+ ($75M/year, longer setup)
- Crypto rail: permissionless, but KYA (Know Your Agent) emerging as standard
- Alternative: Launch outside US first (UK, Singapore, UAE), enter US with Reg CF later

## Protocol Stack

### Fiat Protocols
- **Stripe Connect** — marketplace revenue splitting, webhook verification
- **Visa Intelligent Commerce (VIC)** — tokenized agent credentials, MCP server, US pilots live
- **Mastercard Agent Pay** — agentic tokens, live (first EU payment March 2026)
- **ACP (Stripe + OpenAI)** — open source, powers ChatGPT checkout

### Crypto Protocols
- **x402 (Coinbase)** — HTTP 402 micropayments, 50M+ transactions, BNB compatible (EVM)
- **Google AP2** — payment-agnostic, cryptographic proof of intent, 60+ collaborators
- **Know Your Agent (KYA)** — emerging agent identity standard
- **BNB Chain (BEP-20)** — Agent Share tokens, low gas, BSCScan transparency

## Competitive Landscape

**No one is building exactly what ACM does.** The gap is structured, verified capital markets for agents.

### Closest competitors
- **Virtuals Protocol** (Base) — AI agent launchpad, 2,200+ agents, peaked $5B mcap. Speculative IAOs with bonding curves. No verified revenue, no investor protections.
- **ElizaOS / ai16z** (Solana) — AI-managed VC fund via token. It's a fund, not a marketplace.
- **AgentStocks** — Provides capital TO agents for trading, not investment IN agents.
- **CreatorBid** (Base) — Agent launchpad, social/creator focus. No revenue verification.
- **MyShell** — Agent creation + tokenization. Consumer-oriented. 5M+ users.

### Adjacent
- **Olas / Autonolas** — Agent services infrastructure
- **SingularityNET** — AI services marketplace
- **Morpheus** — Network incentives (stake → earn)
- **Paid.ai** ($33M raised) — B2B billing for agent revenue-sharing (not investor-facing)

### ACM differentiator
"Everyone else is building the casino version. ACM is the regulated capital markets layer."

## Binance Labs / YZi Labs Context

- Rebranded to YZi Labs early 2025, $10B+ AUM
- Invested in Genius Trading (March 2026, eight figures, CZ advising)
- BNB Chain: ERC-8004 for agent identities, BAP-578 "Non-Fungible Agents"
- 7 AI agent skills for Binance API access
- **No existing investment matching ACM's model** — this is greenfield for them

### What Binance gets from ACM
- New asset class native to BNB Chain
- Continuous organic transaction volume (not speculation-driven)
- Agent economy locked into Binance ecosystem
- First-mover advantage in agent finance
- Revenue share from platform fees

## Tech Stack

| Layer | Fiat Rail | Crypto Rail |
|-------|-----------|-------------|
| Frontend | Next.js 16 (App Router, Turbopack) | Same |
| Auth | Supabase Auth | Wallet connect (wagmi v3 / viem) |
| Database | Supabase (Postgres) | Same + on-chain state |
| Revenue verification | Stripe Connect webhooks | x402 / on-chain monitoring |
| Payments in | Stripe Checkout | FDUSD (ERC-20) via Escrow contract |
| Distributions out | Stripe Connect payouts | RevenueDistributor smart contract |
| Share record | DB row (legal agreement) | BEP-20 AgentShare token (non-transferable v1) |
| Hosting | Railway (Docker) | Same |
| Smart contracts | N/A | Solidity 0.8.20, Hardhat, OpenZeppelin |

## Deployed Infrastructure

### Live App
- **URL:** https://perfect-forgiveness-production-fd63.up.railway.app/
- **Railway project:** https://railway.com/project/29fdf09e-e349-4527-88ea-71640ba0a686
- **Supabase project:** qxcgpngliyphtfdaaukz (ACM)
- **Deploys:** Auto-deploy on push to `main` via Docker

### BNB Testnet Contracts (Chain ID 97)
- **MockFDUSD:** `0xAceB12E8E2F7126657E290BE382dA2926C1926FA`
- **OfferingFactory:** `0xe6C3AA4130c4Bf68dACEEE6F1cb8467dF2E262DA`
- **AgentShare (demo):** `0xa8b47e1f450a484c3D40622fB23C1e825A7A25F9`
- **Escrow (demo):** `0x0c50cc920489B3FE39670708071c4eC959BA867F`
- **RevenueDistributor (demo):** `0x3217ED63cB3ee9758c7b0D1047B73F83b9585fAF`
- **Deployer wallet:** `0x598B84b07126D8D85Ce1088Eff2C02180F710260`
- **Explorer:** https://testnet.bscscan.com

### Smart Contract Architecture
- **OfferingFactory** — deploys a new AgentShare + Escrow + RevenueDistributor per offering
- **AgentShare** — BEP-20 revenue share token, non-transferable in v1, minted to contract, purchased via Escrow
- **Escrow** — holds FDUSD until min raise met (ERC-20 approve → deposit pattern), auto-refund if deadline passes
- **RevenueDistributor** — 5% platform fee, remainder split operator/investors pro-rata, cumulative revenue per token pattern
- **MockFDUSD** — test ERC-20 with public `mint()` for testnet faucet

### Multi-Chain Config
- Set `NEXT_PUBLIC_CHAIN_ID=56` for mainnet, `97` (default) for testnet
- All explorer URLs, FDUSD addresses, RPC endpoints auto-switch via `app/src/lib/chain-config.ts`
- Per-offering contract addresses stored in DB (`offerings.escrow_address`, etc.)
- Global addresses (FDUSD, factory) in chain-config

## Data Model (Core)

- **agents** — id, name, description, category, operator_id, revenue_source, metrics, status
- **offerings** — agent_id, revenue_share_pct, total_shares, shares_sold, price, min/max raise, escrow_status, escrow_address, share_token_address, distributor_address, chain_id, factory_offering_id
- **shares** — offering_id, investor_id, quantity, purchase_price, rail (fiat|crypto), token_id
- **distributions** — agent_id, period, gross_revenue, platform_fee, operator_amount, investor_amount
- **operators** — user_id, kyc_status, stripe_connect_id, wallet_address, reputation_score
- **investors** — user_id, kyc_status, wallet_address, total_invested, total_earned
- **indexer_state** — contract_address, last_indexed_block, event_count
- **on_chain_events** — contract_address, event_name, block_number, tx_hash, args (jsonb)

## Project Structure

```
acm/
├── app/                          # Next.js 16 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── agents/[id]/      # Public agent detail + invest flow
│   │   │   ├── offerings/        # Browse active offerings
│   │   │   ├── dashboard/        # Investor dashboard + test faucet
│   │   │   ├── operator/         # Operator agent management + escrow/distribution
│   │   │   ├── login/ signup/    # Auth pages
│   │   │   └── api/
│   │   │       ├── agents/       # Agent CRUD
│   │   │       ├── distributions/# Revenue distribution trigger
│   │   │       ├── offerings/    # Share purchase
│   │   │       ├── indexer/      # On-chain state + event sync
│   │   │       └── stripe/       # Webhook + Connect stubs
│   │   ├── components/
│   │   │   ├── layout/           # Navbar, sign-out
│   │   │   ├── providers.tsx     # WagmiProvider + QueryClient
│   │   │   └── wallet/           # ConnectButton, TestFaucet, EscrowStatus, EscrowManage, ClaimRevenue, DistributeRevenue
│   │   ├── lib/
│   │   │   ├── auth.ts           # Server auth helpers (getUser, requireOperator, etc.)
│   │   │   ├── chain-config.ts   # Multi-chain config (testnet/mainnet)
│   │   │   ├── contracts.ts      # All ABIs (Escrow, AgentShare, RevenueDistributor, Factory, ERC20, events)
│   │   │   ├── wagmi.ts          # Wagmi config + CONTRACT_ADDRESSES
│   │   │   └── supabase/         # Client + server Supabase clients
│   │   └── types/database.ts     # TypeScript types for all tables
│   ├── Dockerfile                # Multi-stage build for Railway
│   └── next.config.ts            # output: "standalone"
├── contracts/                    # Hardhat project
│   ├── contracts/
│   │   ├── AgentShare.sol
│   │   ├── Escrow.sol
│   │   ├── RevenueDistributor.sol
│   │   ├── OfferingFactory.sol
│   │   └── MockFDUSD.sol
│   ├── scripts/deploy.ts
│   ├── hardhat.config.ts
│   └── .env                      # DEPLOYER_PRIVATE_KEY (gitignored)
├── supabase/
│   └── migrations/               # 00001-00004
└── .claude/CLAUDE.md
```

## Build Status

### What's Built (working)
- Auth: email/password login, signup with role selector, auto-profile creation
- Agent listing: public browse, detail pages with revenue metrics
- Offerings: active offerings with progress bars, share purchase flow
- Dual-rail invest: fiat (DB record) + crypto (ERC-20 approve → escrow deposit)
- Wallet connect: MetaMask/WalletConnect, network switching to BNB testnet
- Operator dashboard: manage agents, create offerings
- Operator on-chain: escrow release/refund, revenue distribution with fee breakdown
- Investor dashboard: portfolio stats, holdings, distribution history
- Investor on-chain: test FDUSD faucet, escrow status, claim revenue
- Smart contracts: OfferingFactory deploys per-offering contract sets
- Event indexer: API endpoints to sync on-chain state → Supabase
- Multi-chain config: environment-driven testnet/mainnet switching
- Seed data: 5 agents, 4 offerings, 12 distributions
- Deploy: Railway (Docker), auto-deploy on push

### What's Not Built Yet
- **Stripe Connect** — `/api/stripe/connect` and `/api/webhooks/stripe` are stubs
- **Revenue verification pipeline** — Stripe webhook to track incoming revenue
- **x402 / on-chain revenue monitoring** — crypto rail verification
- **Operator offering → factory deploy UI** — operators can't deploy contracts from the UI yet (manual via Hardhat)
- **Secondary market** — transfers disabled in v1
- **Agent-to-agent investment** — v2 feature
- **Custom domain** — still on Railway default subdomain
- **KYC integration** — status fields exist but no provider connected

## Roadmap

| Phase | When | What |
|-------|------|------|
| Testnet | Q2 2026 | Smart contracts on BNB testnet, agent listing + verification, share purchase flow, escrow + distribution |
| Mainnet | Q3 2026 | BNB Chain mainnet, x402 live, FDUSD settlement, first real revenue flowing |
| Agent Investors | Q4 2026 | Agent-to-agent investment, autonomous capital allocation, evaluator agents |
| Exchange | 2027 | Secondary market, cross-chain, agent fund-of-funds, CEX partnerships |

## Pitch Decks

- **General deck:** `ACM_Pitch_Deck.pptx` — 14 slides, dark theme, teal accent
- **Binance Labs deck:** `ACM_Binance_Labs_Deck.pptx` — 14 slides, BNB gold accent, crypto/FDUSD focused
- Fonts: Montserrat (headlines), Play (subheadings), Inter (body)
- Generator scripts: `pitch_deck.py`, `pitch_deck_binance.py`

## Build Notes

- Deploy to Railway via Docker multi-stage build (deps → builder → runner)
- `output: "standalone"` in next.config.ts for Docker
- Auto-deploy: push to `main` triggers Railway build
- Supabase migrations: use `supabase db push` or run SQL directly via MCP tool
- Contract deployment: `cd contracts && npx hardhat run scripts/deploy.ts --network bscTestnet`
- No blockchain in fiat v1 — Stripe Connect handles escrow + splits
- Database generic removed from Supabase clients (untyped) — can regenerate with `supabase gen types`
- Pitch decks generated via python-pptx, upload to Google Slides
- Private key in `contracts/.env` — NEVER commit this file
