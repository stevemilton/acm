# Agent Capital Markets (ACM)

BNB Chain-native exchange where AI agents list verified revenue, raise capital through revenue share tokens, and distribute earnings to investors via smart contracts.

**Polar Industries Ltd** | BNB Testnet Live | [Demo](https://perfect-forgiveness-production-fd63.up.railway.app/)

## Setup

### Prerequisites
- Node.js 20+
- MetaMask or WalletConnect-compatible wallet

### Frontend
```bash
cd app
cp .env.local.example .env.local  # Add Supabase credentials
npm install
npm run dev                        # http://localhost:3000
```

### Smart Contracts
```bash
cd contracts
cp .env.example .env               # Add DEPLOYER_PRIVATE_KEY
npm install
npx hardhat compile
npx hardhat run scripts/deploy.ts --network bscTestnet
```

### Build & Deploy
```bash
cd app && npm run build            # Must pass before push
git push origin main               # Auto-deploys to Railway
```

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | app/.env.local | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app/.env.local | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | app/.env.local | Supabase service role (server only) |
| `NEXT_PUBLIC_CHAIN_ID` | app/.env.local | `97` (testnet) or `56` (mainnet) |
| `INDEXER_SECRET` | app/.env.local | Auth key for cron/indexer endpoints |
| `DEPLOYER_PRIVATE_KEY` | contracts/.env | Contract deployer wallet (never commit) |

## Structure

```
acm/
├── app/                    # Next.js 16 frontend + API
│   └── src/
│       ├── app/            # Pages + API routes
│       ├── components/     # UI components (wallet/, layout/)
│       └── lib/            # chain-config, contracts, wagmi, auth, supabase
├── contracts/              # Hardhat + Solidity
│   ├── contracts/          # OfferingFactory, AgentShare, Escrow, RevenueDistributor, MockFDUSD
│   └── scripts/deploy.ts
├── supabase/migrations/    # 4 SQL migrations
├── data-room/              # Investor data room docs
├── PRODUCT_BRIEF.md        # Product specification
├── ARCHITECTURE.md         # Technical architecture
├── ROADMAP.md              # Future work
├── RULES.md                # Development rules
└── .ai/handoff/            # AI agent handoff state
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `cd app && npm run dev` | Local dev server |
| `cd app && npm run build` | Production build (must pass) |
| `cd contracts && npx hardhat compile` | Compile contracts |
| `cd contracts && npx hardhat test` | Run contract tests |
| `curl -X POST localhost:3000/api/cron` | Run indexers manually |
