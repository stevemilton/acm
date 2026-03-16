# ACM Platform User Flows

## Flow 1: Operator Lists an Agent

```
Operator signs up (email or wallet)
    │
    ├─ Fiat rail: Email signup → Supabase Auth → KYC via Stripe Identity
    └─ Crypto rail: Wallet connect → wallet verification
    │
    ▼
Connect revenue source
    │
    ├─ Stripe Connect: OAuth flow → Stripe account linked
    ├─ x402: Provide agent's x402 endpoint → platform verifies activity
    └─ On-chain: Provide wallet address → platform monitors transactions
    │
    ▼
Platform verifies revenue (automated)
    │
    ├─ Pulls 30+ days of transaction history
    ├─ Calculates: total revenue, daily average, trend, consistency
    ├─ Flags anomalies: circular flows, <3 unique sources, spikes
    └─ Status: PENDING → VERIFIED (or REJECTED with reason)
    │
    ▼
Create offering
    │
    ├─ Set revenue share percentage (1-50%)
    ├─ Set total shares (e.g., 1,000)
    ├─ Set price per share (FDUSD)
    ├─ Set minimum raise threshold
    ├─ Set offering window (default: 30 days)
    └─ Review and confirm terms
    │
    ▼
Agent goes live on marketplace
    │
    ├─ Real-time dashboard visible to investors
    ├─ Revenue metrics update via webhooks / polling
    └─ Offering status: OPEN
```

## Flow 2: Investor Buys Agent Shares

```
Investor browses marketplace
    │
    ├─ Filter: category, revenue range, yield, uptime
    ├─ Sort: revenue (30d), yield, newest, shares remaining
    └─ Search: agent name, operator, category
    │
    ▼
View agent dashboard
    │
    ├─ Revenue chart (30d, 90d, all-time)
    ├─ Performance metrics (uptime, tasks, avg value)
    ├─ Offering terms (share %, price, min raise, escrow status)
    ├─ Estimated yield based on trailing revenue
    ├─ Operator profile + reputation score
    └─ Trust signals (verification source, time listed)
    │
    ▼
Buy shares
    │
    ├─ Select quantity
    ├─ Fiat rail:
    │   ├─ Stripe Checkout → card payment
    │   ├─ Funds held in Stripe escrow
    │   └─ Share recorded in database (legal agreement)
    │
    └─ Crypto rail:
        ├─ Approve FDUSD spend → call buyShares(qty) on smart contract
        ├─ FDUSD transferred to escrow contract
        └─ BEP-20 Agent Share tokens minted to wallet
    │
    ▼
Escrow logic
    │
    ├─ If raised >= minRaise → status: FUNDED
    │   └─ First escrow tranche released to operator (33%)
    │
    └─ If offering window expires and raised < minRaise → status: REFUNDING
        └─ Investors claim refund (FDUSD returned, tokens burned)
```

## Flow 3: Revenue Distribution

```
Agent earns revenue
    │
    ├─ Stripe webhook fires (fiat rail)
    ├─ x402 payment received (crypto rail)
    └─ On-chain transaction detected (crypto rail)
    │
    ▼
ACM records revenue event
    │
    ├─ Validates source (matches connected revenue source)
    ├─ Converts to FDUSD value (if non-FDUSD)
    └─ Updates agent dashboard metrics
    │
    ▼
Distribution calculation
    │
    ├─ Gross revenue for period
    ├─ Platform fee: 5% → ACM treasury
    ├─ Operator share: (100% - revenue_share_pct) of remainder
    ├─ Investor share: revenue_share_pct of remainder
    └─ Per-share amount: investor_share / total_shares
    │
    ▼
Distribution execution
    │
    ├─ Fiat rail (monthly):
    │   ├─ Stripe Connect payout to operator
    │   ├─ Stripe Connect payout to each investor
    │   └─ Distribution recorded in database
    │
    └─ Crypto rail (real-time):
        ├─ depositRevenue() called on RevenueDistributor contract
        ├─ Platform fee sent to ACM treasury wallet
        ├─ Cumulative dividend per token updated
        └─ Investors claim via claimDistribution() or auto-push
```

## Flow 4: Revenue Cliff Protection

```
ACM monitors agent revenue (continuous)
    │
    ▼
30-day trailing revenue drops >50% vs. raise-time revenue
    │
    ▼
Alert issued to operator
    │
    ├─ 7-day grace period to restore revenue
    ├─ Operator can provide explanation
    └─ Dashboard shows warning to investors
    │
    ▼
Grace period expires without recovery
    │
    ▼
Protection triggers
    │
    ├─ Remaining escrowed funds returned to investors pro-rata
    ├─ Offering status → CLOSED
    ├─ Agent marked as SUSPENDED on marketplace
    └─ Operator reputation score impacted
```

## Flow 5: Agent-to-Agent Investment (v2)

```
Agent A is listed on ACM and earning revenue
    │
    ▼
Agent A connects agentic wallet to ACM API
    │
    ├─ Wallet holds FDUSD from accumulated earnings
    └─ Agent authenticates via KYA (Know Your Agent) protocol
    │
    ▼
Agent A queries ACM marketplace API
    │
    ├─ GET /agents?min_revenue=5000&min_uptime=99&sort=yield
    ├─ GET /agents/{id}/metrics (detailed performance data)
    └─ Agent applies its own evaluation criteria
    │
    ▼
Agent A decides to invest in Agent B
    │
    ├─ Approve FDUSD spend
    ├─ Call buyShares(qty) on Agent B's contract
    └─ BEP-20 tokens minted to Agent A's wallet
    │
    ▼
Agent B earns revenue → distributions flow to Agent A
    │
    ▼
Agent A reinvests returns into Agents C, D, E
    │
    └─ The recursive capital allocation loop compounds
```
