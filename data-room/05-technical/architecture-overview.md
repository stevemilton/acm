# Technical Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                    Next.js (Railway)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Marketplace│  │  Agent   │  │ Operator │  │ Investor │   │
│  │  Browse   │  │Dashboard │  │Dashboard │  │Dashboard │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│                      AUTH LAYER                              │
│          Supabase Auth (email/social)                        │
│          wagmi/viem (wallet connect)                         │
├─────────────────────────────────────────────────────────────┤
│                      API LAYER                               │
│                 Next.js API Routes                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Agents  │  │Offerings │  │  Shares  │  │Distribute│   │
│  │   API    │  │   API    │  │   API    │  │   API    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    DATA LAYER                                │
│  ┌───────────────────┐    ┌────────────────────────┐        │
│  │    Supabase        │    │    BNB Chain            │        │
│  │    (Postgres)      │    │    (On-chain state)     │        │
│  │                    │    │                          │        │
│  │  - Agent metadata  │    │  - AgentShare tokens     │        │
│  │  - User profiles   │    │  - Escrow contracts      │        │
│  │  - Revenue history │    │  - Distribution records   │        │
│  │  - Offering terms  │    │  - Treasury              │        │
│  │  - Fiat shares     │    │                          │        │
│  └───────────────────┘    └────────────────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                  EXTERNAL INTEGRATIONS                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Stripe  │  │   x402   │  │  On-chain│  │   KYA    │   │
│  │ Connect  │  │ Monitor  │  │  Monitor │  │ Identity │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 16 + TypeScript + Tailwind v4 | Fast to ship, SSR for SEO, team experience |
| Auth (fiat) | Supabase Auth | Email/social login, row-level security |
| Auth (crypto) | wagmi + viem | Industry-standard wallet connect |
| Database | Supabase (Postgres) | Auth integration, realtime subscriptions, RLS |
| API | Next.js API routes | Co-located with frontend, serverless |
| Smart contracts | Solidity | BEP-20 standard, BNB Chain native |
| Contract framework | Hardhat | Testing, deployment, verification |
| Payments (fiat) | Stripe Connect | Marketplace splits, escrow, KYC |
| Hosting | Railway | Team experience, Docker-based deploys |

## Smart Contract Architecture

> **Status:** Deployed to BNB Chain testnet (Chain ID 97). Solidity 0.8.20, Hardhat toolchain.

### Contract Topology — Factory Pattern

Each offering deploys its own isolated contract set via the OfferingFactory. This avoids shared state, simplifies auditing, and enables per-offering upgrades.

```
OfferingFactory (1 instance) — 0xe6C3AA4130c4Bf68dACEEE6F1cb8467dF2E262DA
├── createOffering(OfferingParams) → deploys 3 contracts per offering
├── getOffering(id) → returns addresses + metadata
├── totalOfferings() → count
└── Access controlled (approvedOperators + owner)

Per Offering (deployed by factory):
  AgentShare (BEP-20)         — demo: 0xa8b47e1f450a484c3D40622fB23C1e825A7A25F9
  ├── Fixed supply, 18 decimals
  ├── Minted to Escrow at creation
  └── Non-transferable (v1)

  Escrow                      — demo: 0x0c50cc920489B3FE39670708071c4eC959BA867F
  ├── deposit(amount) — investor deposits FDUSD, receives AgentShare tokens
  ├── release() — operator withdraws FDUSD when minRaise met
  ├── triggerRefund() / claimRefund() — refund path
  └── View: totalRaised, minRaise, maxRaise, deadline, released, refunding

  RevenueDistributor          — demo: 0x3217ED63cB3ee9758c7b0D1047B73F83b9585fAF
  ├── depositRevenue(amount) — operator deposits FDUSD, auto-splits fees
  ├── claim() — holder claims accumulated distributions
  ├── Cumulative revenue per token pattern (O(1) gas per claim)
  └── View: claimable(address), totalDistributed

MockFDUSD (testnet)           — 0xAceB12E8E2F7126657E290BE382dA2926C1926FA
├── ERC-20 "ACM Mock FDUSD" / "mFDUSD"
├── Public mint() for testing
└── Production: real FDUSD 0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409
```

### Event Indexing Pipeline

Two API routes sync on-chain state to Supabase:

- **`/api/indexer`** — State sync: reads escrow balances, share balances, offering status from contracts → updates Supabase
- **`/api/indexer/events`** — Event log processing: scans `Deposited`, `Released`, `Refunded`, `RevenueReceived` events → stores in `on_chain_events` table, processes side effects (creates share records, updates escrow status, records distributions)

## Data Model

### Supabase (off-chain)

```sql
-- Agent metadata and metrics
agents (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text,
  operator_id uuid REFERENCES operators(id),
  revenue_source text CHECK (revenue_source IN ('stripe', 'x402', 'on_chain')),
  revenue_30d numeric,
  revenue_all_time numeric,
  uptime_pct numeric,
  tasks_completed integer,
  contract_address text,  -- BNB Chain AgentShare address
  status text CHECK (status IN ('pending', 'verified', 'live', 'suspended')),
  listed_at timestamptz,
  created_at timestamptz DEFAULT now()
)

-- Offering terms (with on-chain contract references)
offerings (
  id uuid PRIMARY KEY,
  agent_id uuid REFERENCES agents(id),
  revenue_share_pct numeric CHECK (revenue_share_pct BETWEEN 1 AND 50),
  total_shares integer,
  shares_sold integer DEFAULT 0,
  price_per_share numeric,
  min_raise numeric,
  max_raise numeric,
  escrow_status text CHECK (escrow_status IN ('pending', 'active', 'funded', 'refunding', 'closed')),
  offering_window_days integer DEFAULT 30,
  status text CHECK (status IN ('draft', 'open', 'funded', 'closed', 'refunding')),
  -- On-chain contract addresses (added for per-offering factory pattern)
  escrow_address text,            -- Escrow contract for this offering
  share_token_address text,       -- AgentShare BEP-20 token address
  distributor_address text,       -- RevenueDistributor contract address
  chain_id integer DEFAULT 97,    -- BNB Chain ID (97=testnet, 56=mainnet)
  factory_offering_id integer,    -- Index in OfferingFactory registry
  created_at timestamptz DEFAULT now()
)

-- Share ownership records (fiat rail + crypto reference)
shares (
  id uuid PRIMARY KEY,
  offering_id uuid REFERENCES offerings(id),
  investor_id uuid,               -- NULL for crypto-only investors
  investor_address text,           -- Wallet address (crypto rail)
  quantity integer,
  purchase_amount numeric,         -- FDUSD amount paid
  rail text CHECK (rail IN ('fiat', 'crypto')),
  tx_hash text,                    -- on-chain tx hash (crypto rail)
  stripe_payment_id text,          -- Stripe reference (fiat rail)
  purchased_at timestamptz DEFAULT now(),
  UNIQUE(offering_id, investor_address)  -- one record per investor per offering
)

-- Distribution records
distributions (
  id uuid PRIMARY KEY,
  agent_id uuid REFERENCES agents(id),
  period text,  -- '2026-06' for monthly
  gross_revenue numeric,
  platform_fee numeric,
  operator_amount numeric,
  investor_amount numeric,
  per_share_amount numeric,
  tx_hash text,  -- on-chain distribution tx
  status text CHECK (status IN ('pending', 'processing', 'distributed')),
  distributed_at timestamptz
)

-- Operators
operators (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  kyc_status text CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  stripe_connect_id text,
  wallet_address text,
  reputation_score numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
)

-- Investors
investors (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  kyc_status text,
  wallet_address text,
  total_invested numeric DEFAULT 0,
  total_earned numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
)

-- Revenue events (raw verification data)
revenue_events (
  id uuid PRIMARY KEY,
  agent_id uuid REFERENCES agents(id),
  source text,  -- 'stripe_webhook', 'x402', 'on_chain'
  amount numeric,
  currency text DEFAULT 'USD',
  source_tx_id text,  -- external reference
  verified boolean DEFAULT false,
  event_at timestamptz,
  created_at timestamptz DEFAULT now()
)
```

-- Indexer state tracking (on-chain → Supabase sync)
indexer_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address text NOT NULL UNIQUE,
  last_indexed_block integer NOT NULL DEFAULT 0,
  last_indexed_at timestamptz,
  event_count integer NOT NULL DEFAULT 0
)

-- Raw on-chain event log storage
on_chain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address text NOT NULL,
  event_name text NOT NULL,
  block_number integer NOT NULL,
  tx_hash text NOT NULL UNIQUE,
  log_index integer NOT NULL DEFAULT 0,
  args jsonb DEFAULT '{}',
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
)
```

### On-chain (BNB Chain)
- AgentShare token balances and ownership
- Escrow state and FDUSD balances
- Distribution cumulative dividends
- Transaction history (BSCScan)

## Revenue Verification Architecture

### Stripe Connect (fiat)
```
Agent Stripe account → Stripe webhook → ACM API
→ Validate webhook signature → Record revenue event
→ Update agent metrics → Trigger distribution (monthly)
```

### x402 (crypto)
```
Agent x402 endpoint receives payment → On-chain FDUSD transfer
→ ACM monitor detects payment to agent wallet
→ Verify x402 protocol headers → Record revenue event
→ Update agent metrics → Trigger distribution (real-time)
```

### On-chain monitoring (crypto)
```
Agent wallet receives FDUSD → ACM indexer detects transfer
→ Cross-reference with known agent wallet
→ Validate source (not circular) → Record revenue event
→ Update agent metrics → Trigger distribution
```

## Security Considerations

- Smart contracts audited before mainnet (requirement)
- Multi-sig treasury (3-of-5 minimum)
- Supabase Row-Level Security on all tables
- Rate limiting on API routes
- Webhook signature validation (Stripe)
- Circular flow detection for revenue verification
- Contract upgradability via proxy pattern (for bug fixes only, not logic changes)

## Deployment

> **Status:** All layers deployed and live on testnet as of March 2026.

| Layer | Environment | Status |
|-------|------------|--------|
| Frontend + API | Railway (Docker, node:22-alpine) | ✅ Live |
| Database | Supabase (managed Postgres) | ✅ Live (4 migrations applied) |
| Smart contracts | BNB Chain testnet (Chain ID 97) | ✅ Deployed |
| Event indexer | Next.js API routes (`/api/indexer`, `/api/indexer/events`) | ✅ Built |

### Multi-Chain Configuration
- Centralized in `app/src/lib/chain-config.ts`
- Environment-driven via `NEXT_PUBLIC_CHAIN_ID` (97 for testnet, 56 for mainnet)
- Single config change switches all contract addresses, RPC endpoints, and explorer URLs
- Helpers: `getExplorerUrl()`, `getFdusdAddress()`, `getContractAddress()`

### Deployed Contract Addresses (BNB Testnet)

| Contract | Address |
|----------|---------|
| MockFDUSD | `0xAceB12E8E2F7126657E290BE382dA2926C1926FA` |
| OfferingFactory | `0xe6C3AA4130c4Bf68dACEEE6F1cb8467dF2E262DA` |
| AgentShare (demo) | `0xa8b47e1f450a484c3D40622fB23C1e825A7A25F9` |
| Escrow (demo) | `0x0c50cc920489B3FE39670708071c4eC959BA867F` |
| RevenueDistributor (demo) | `0x3217ED63cB3ee9758c7b0D1047B73F83b9585fAF` |

### Supabase Migrations

| Migration | What |
|-----------|------|
| `00001_initial_schema.sql` | Core tables: agents, offerings, shares, distributions, operators, investors |
| `00002_seed_data.sql` | Demo agent + offering data |
| `00003_offering_contracts.sql` | Added contract address columns + chain_id to offerings |
| `00004_indexer.sql` | Added indexer_state + on_chain_events tables |

### Project Structure

```
acm/
├── app/                           # Next.js frontend + API
│   └── src/
│       ├── app/
│       │   ├── agents/[id]/       # Agent dashboard + invest flow
│       │   ├── operator/agents/[id]/ # Operator escrow + distribution management
│       │   ├── dashboard/         # Investor portfolio
│       │   └── api/
│       │       └── indexer/       # On-chain → DB sync (state + events)
│       ├── components/wallet/     # Wallet UI: invest, escrow, claim, faucet
│       └── lib/
│           ├── chain-config.ts    # Multi-chain configuration
│           ├── contracts.ts       # ABIs for all contracts
│           └── wagmi.ts           # Wagmi config (derived from chain-config)
├── contracts/                     # Hardhat project
│   ├── contracts/
│   │   ├── OfferingFactory.sol    # Factory deploys AgentShare+Escrow+Distributor
│   │   ├── AgentShare.sol         # BEP-20 revenue share token
│   │   ├── Escrow.sol             # FDUSD escrow with release/refund
│   │   ├── RevenueDistributor.sol # Cumulative dividend distribution
│   │   └── MockFDUSD.sol          # Test stablecoin
│   └── scripts/deploy.ts         # Deployment script
├── supabase/migrations/           # Database migrations
└── data-room/                     # Investor data room (this directory)
```
