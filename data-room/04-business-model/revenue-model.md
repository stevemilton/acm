# Revenue Model

## Revenue Streams

### 1. Distribution Fee — 5%
Taken from every revenue distribution flowing through ACM smart contracts.

- Applied to all revenue before splitting between operator and shareholders
- Collected automatically by smart contract → ACM treasury wallet
- **Alignment:** ACM only earns when agents earn. Zero revenue from failed or inactive agents.

### 2. Transaction Fee — 2%
On every Agent Share purchase (FDUSD).

- One-time fee at point of investment
- Deducted from purchase amount before escrow
- Competitive with DEX trading fees (PancakeSwap: 0.25%, but ACM provides verified assets + escrow)

### 3. Agent-to-Agent Fee — 0.1% (v2)
On autonomous investments between agents.

- Deliberately low to encourage volume
- Agent-to-agent transactions are high-frequency, low-friction
- This is where scale lives — thousands of autonomous transactions daily

### 4. Listing Fee — Free (v1)
Free to list agents to bootstrap supply side of marketplace.

**v2 premium features (future):**
- Promoted listings: featured placement on marketplace
- Advanced analytics: deeper performance insights for operators
- Priority verification: expedited revenue verification
- Custom dashboards: white-label agent performance pages

## Unit Economics

### Per-Agent Economics (example)

**Agent profile:**
- Monthly revenue: $10,000
- Revenue share offered: 20%
- Shares issued: 200
- Price per share: $50
- Total raise: $10,000

**ACM revenue per month from this agent:**

| Source | Calculation | Amount |
|--------|------------|--------|
| Distribution fee | $10,000 × 20% × 5% | $100/month |
| Transaction fee (one-time) | $10,000 raise × 2% | $200 (once) |
| **Annual recurring** | $100 × 12 | **$1,200/year** |

**Investor returns (per share):**
- Monthly distribution: ($10,000 × 20% - 5% fee) / 200 shares = $9.50/share
- Annual distribution: $114/share
- Yield on $50 share: **22.8% annual**

### Platform Economics at Scale

| Metric | 100 agents | 500 agents | 1,000 agents |
|--------|-----------|-----------|-------------|
| Avg agent revenue/month | $10,000 | $10,000 | $10,000 |
| Avg revenue share | 20% | 20% | 20% |
| Monthly distributions | $200,000 | $1,000,000 | $2,000,000 |
| Distribution fee (5%) | $10,000 | $50,000 | $100,000 |
| Annual distribution revenue | $120,000 | $600,000 | $1,200,000 |
| Avg raise per agent | $25,000 | $25,000 | $25,000 |
| Transaction fee revenue | $50,000 | $250,000 | $500,000 |
| **Year 1 total revenue** | **$170,000** | **$850,000** | **$1,700,000** |

*Note: Agent-to-agent fees (v2) not included. These scale non-linearly as the agent investor loop compounds.*

## Cost Structure (Estimated)

| Cost | Monthly | Notes |
|------|---------|-------|
| BNB Chain gas | $500-2,000 | Distributions, token minting, escrow |
| Infrastructure (Railway) | $200-500 | Web app, API, monitoring |
| Supabase | $25-300 | Database, auth |
| Smart contract audit | One-time: $30-80K | Pre-mainnet requirement |
| Revenue verification (API costs) | $200-500 | x402 monitoring, Stripe webhooks |
| **Monthly operating cost** | **$1,000-3,000** | Excluding team/salaries |

## Margin Profile

- Gross margin: ~95% (software + smart contracts, minimal marginal cost per transaction)
- Primary costs are fixed (infrastructure, audit) not variable
- Distribution fee scales linearly with platform volume
- Agent-to-agent fees (v2) have near-zero marginal cost

## Comparison to Analogous Platforms

| Platform | Take rate | Model |
|----------|----------|-------|
| **ACM** | 5% distribution + 2% transaction | Revenue share on verified agent earnings |
| Virtuals Protocol | Variable (bonding curve spread) | Speculative token trading fees |
| Stripe | 2.9% + $0.30 | Payment processing |
| AngelList | 5% carry on returns | VC fund administration |
| Republic (Reg CF) | 6% of raise + 2% AUM | Crowdfunding platform |
| PancakeSwap | 0.25% per trade | DEX trading fees |
