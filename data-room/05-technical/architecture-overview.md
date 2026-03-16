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
| Contract framework | Hardhat or Foundry | Testing, deployment, verification |
| Payments (fiat) | Stripe Connect | Marketplace splits, escrow, KYC |
| Hosting | Railway | Team experience, Docker-based deploys |

## Smart Contract Architecture

### Deployed Contracts

```
AgentShareFactory (1 instance)
├── Creates AgentShare contracts per agent
├── Maintains registry of all agent shares
└── Access controlled (ACM platform only)

AgentShare (1 per agent)
├── BEP-20 token with fixed supply
├── Purchase flow (FDUSD → escrow → mint tokens)
├── Refund flow (burn tokens → return FDUSD)
├── Transfer restrictions (v1: soulbound)
└── Linked to RevenueDistributor

RevenueDistributor (1 instance)
├── Receives verified revenue deposits
├── Calculates platform fee (5%)
├── Tracks cumulative dividends per token
├── Handles claim / auto-push distributions
└── Multi-agent support

EscrowManager (1 instance)
├── Holds raise FDUSD until minimum met
├── Milestone-based release schedule
├── Auto-refund on expiry or cliff trigger
└── Revenue cliff monitoring integration

ACMTreasury (1 instance)
├── Receives platform fees
├── Multi-sig controlled
└── Withdrawal governance
```

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

-- Offering terms
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
  created_at timestamptz DEFAULT now()
)

-- Share ownership records (fiat rail + crypto reference)
shares (
  id uuid PRIMARY KEY,
  offering_id uuid REFERENCES offerings(id),
  investor_id uuid REFERENCES investors(id),
  quantity integer,
  purchase_price numeric,
  rail text CHECK (rail IN ('fiat', 'crypto')),
  token_tx_hash text,  -- on-chain reference (crypto rail)
  stripe_payment_id text,  -- Stripe reference (fiat rail)
  purchased_at timestamptz DEFAULT now()
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

- Frontend + API: Railway (Docker, node:22-alpine)
- Database: Supabase (managed Postgres)
- Smart contracts: BNB Chain testnet → mainnet
- Contract verification: BSCScan
- Monitoring: Supabase dashboard + Railway metrics + on-chain analytics
