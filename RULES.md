# ACM — Rules

Durable rules for AI-assisted development. Keep this short.

## Architecture Rules

- **Client components with wagmi hooks must use `"use client"` + `next/dynamic` with `ssr: false`.** Server Components cannot use wagmi. Create a `client-components.tsx` wrapper per page that needs wallet interaction.
- **Supabase/viem clients must be created inside handlers, not at module level.** Lazy initialization prevents build-time crashes from missing env vars.
- **Per-offering contract addresses live in the `offerings` DB table**, not hardcoded. Global addresses (FDUSD, factory) live in `chain-config.ts`.
- **No BigInt literals (`123n`) in source files.** Use `BigInt(123)`. The TypeScript target doesn't support BigInt literals.
- **All amounts on-chain use 18 decimals.** Use `parseEther()` / `formatEther()` for conversion. Never pass raw numbers to contract calls.

## Smart Contract Rules

- **Factory pattern is canonical.** Every offering gets its own AgentShare + Escrow + RevenueDistributor deployed by OfferingFactory.
- **Two-step ERC-20 pattern for all deposits.** Step 1: `token.approve(contract, amount)`. Step 2: `contract.deposit(amount)`. Never send native BNB.
- **Operators must be approved on the factory** (`setApprovedOperator`) before they can call `createOffering`.
- **Contract deployer private key stays in `contracts/.env`**, never committed.

## Data Rules

- **Supabase is the source of truth for off-chain state.** On-chain state is synced via indexer but chain is authoritative for balances/escrow.
- **`indexer_state` tracks scan position per contract.** Never re-process already-indexed blocks.
- **When adding a new contract to the indexer, seed its `indexer_state` row with a recent block number.** Never start from block 0 — BSC public RPC rate-limits full-chain log scans.
- **Duplicate events are handled via unique constraint on `tx_hash`** in `on_chain_events`. Upsert/ignore on conflict.
- **Indexer block range is capped at 50 blocks per cron cycle.** BSC public RPC rate-limits `getLogs` aggressively. On RPC failure the indexer retries the same range next cycle (never skips events). Do not increase this cap without testing against BSC testnet RPC.
- **Use `bsc-testnet-rpc.publicnode.com` for indexer RPC**, not the Binance seed node. The Binance `data-seed-prebsc-1-s1` endpoint aggressively rate-limits `getLogs` even for small ranges.

## Process Rules

- **Build must pass before committing.** Run `cd app && npm run build`.
- **Deploy to Railway via push to `main`** (auto-deploy) **or `railway up`** (uploads local files directly). Use `railway up` if git-triggered builds are stale. `railway.json` configures the Docker build.
- **Contract deployment via Hardhat CLI**, not the web app. `cd contracts && npx hardhat run scripts/deploy.ts --network bscTestnet`.
- **Database migrations via Supabase CLI or MCP tool.** Not raw SQL in production.

## Product Rules

- **Agent Shares are securities** under Howey Test. All design decisions must account for this.
- **Revenue share only, never equity.** This is a participation agreement, not ownership transfer.
- **No speculative features in v1.** No bonding curves, no AMM, no secondary market.
- **5% platform fee is hardcoded in RevenueDistributor.** Change requires contract redeployment.
- **Escrow share math produces raw integers, not 18-decimal values.** `shares = amount / pricePerShare` divides two 18-decimal values (e.g., 500e18 / 5e18 = 100, not 100e18). Tests and downstream contracts must use raw integer share counts when referencing Escrow-originated shares.
