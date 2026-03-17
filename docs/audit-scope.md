# ACM Smart Contract Audit Scope

**Prepared for:** External Auditor
**Prepared by:** Polar Industries Ltd
**Date:** March 2026
**Chain:** BNB Chain (BSC) — Testnet (Chain ID 97), targeting Mainnet (Chain ID 56)
**Compiler:** Solidity 0.8.20, Hardhat, OpenZeppelin Contracts v5

---

## 1. Contracts In Scope

| # | Contract | LOC | Purpose |
|---|----------|-----|---------|
| 1 | **OfferingFactory.sol** | 155 | Deploys per-offering contract sets (AgentShare + Escrow + RevenueDistributor). One instance per ACM deployment. |
| 2 | **AgentShare.sol** | 63 | BEP-20 revenue share token. Non-transferable in v1 (no secondary market). Minted to contract, distributed by Escrow. |
| 3 | **Escrow.sol** | 109 | Holds investor FDUSD deposits until offering min raise is met. Releases to operator or refunds to investors. |
| 4 | **RevenueDistributor.sol** | 90 | Splits agent revenue: 5% platform fee → treasury, remainder by revenueShareBps. Cumulative dividend pattern for investor claims. |
| 5 | **MockFDUSD.sol** | 16 | Test-only ERC-20 with public mint. **Not for production audit.** Included for completeness. |

**Total Solidity LOC (excluding MockFDUSD):** ~417

### Flattened Sources

Single-file versions of all contracts are available in `contracts/flat/` for auditor convenience. Canonical sources are in `contracts/contracts/`.

### Dependencies

- OpenZeppelin Contracts v5.x: `Ownable`, `ERC20`, `IERC20`, `SafeERC20`
- No assembly, no inline Yul, no proxy patterns, no upgradability

---

## 2. Deployed Addresses (BNB Testnet)

| Contract | Address |
|----------|---------|
| MockFDUSD | `0xAceB12E8E2F7126657E290BE382dA2926C1926FA` |
| OfferingFactory (v2) | `0x2f3E26b798B4D7906577F52a65BaA991Ea99C67A` |
| AgentShare (E2E) | `0xbb3696A56fd32b9aD1e0772a511B04a723962A04` |
| Escrow (E2E) | `0x611128F84236504C1d3bd847EFCFccfFeBd0f196` |
| RevenueDistributor (E2E) | `0x00d8aC16E976d2FF3fCe16Fbd9f6AB8c0F76e9A6` |

Deployer wallet: `0x598B84b07126D8D85Ce1088Eff2C02180F710260`

---

## 3. Architecture Summary

### Factory Pattern
`OfferingFactory` is the single entry point. Each `createOffering()` call deploys three contracts:
1. **AgentShare** — mints total supply to itself, transfers ownership to Escrow
2. **Escrow** — holds FDUSD, distributes AgentShare tokens on deposit
3. **RevenueDistributor** — receives operator revenue deposits, splits per formula

### Ownership Chain
- Factory deploys AgentShare with itself as temp owner → transfers ownership to Escrow
- Escrow is owned by the operator (can call `release()`)
- RevenueDistributor is owned by the operator (can call `distribute()`)
- Factory is owned by the ACM deployer; operators are approved via `setApprovedOperator()`

### Token Flow
```
Invest:   Investor → FDUSD.approve(Escrow) → Escrow.deposit(amount)
                     → Escrow pulls FDUSD, sends AgentShare tokens to investor

Release:  Operator → Escrow.release() → FDUSD to operator (if minRaise met)

Refund:   Anyone → Escrow.triggerRefund() (if deadline passed & min not met)
          Investor → Escrow.claimRefund() → returns AgentShare tokens, refunds FDUSD

Revenue:  Operator → FDUSD.approve(Distributor) → Distributor.distribute(gross)
                    → 5% to platform, revenueShareBps to investor pool, rest to operator
          Investor → Distributor.claim() → proportional FDUSD payout
```

### Share Math
`shares = amount / pricePerShare` — integer division of two 18-decimal values produces raw integers (e.g., 500e18 / 5e18 = 100, not 100e18). This is by design.

---

## 4. Threat Model

### Actors
- **Platform owner** — Owns the factory, approves operators, receives platform fee
- **Operator** — Creates offerings, releases escrow, distributes revenue
- **Investor** — Deposits FDUSD, receives AgentShare tokens, claims revenue

### Key Invariants
1. Investor funds in Escrow are only released when `totalRaised >= minRaise` and only to the operator
2. If min raise is not met by deadline, investors can claim full refunds (FDUSD + AgentShare return)
3. Platform fee is exactly 5% (PLATFORM_FEE_BPS = 500, hardcoded constant)
4. Revenue claims are proportional to share holdings — no investor can claim more than their fair share
5. AgentShare tokens are non-transferable between investors in v1 (only contract ↔ investor transfers)
6. Only approved operators (or the factory owner) can create offerings

### Attack Vectors to Examine
- **Reentrancy:** Escrow.deposit() calls external shareToken.purchaseShares() after state updates. SafeERC20 mitigates ERC-20 transfer reentrancy, but AgentShare callbacks are trusted (owned by Escrow).
- **Rounding/precision:** `amount / pricePerShare` loses remainder. Can an attacker extract value via precision loss?
- **Front-running:** Can an attacker front-run `release()` or `triggerRefund()` to manipulate escrow state?
- **Operator trust:** Operator controls `release()` and `distribute()`. Can a malicious operator drain funds?
- **Share inflation:** Can an attacker manipulate `totalShares` in RevenueDistributor to dilute claims?
- **Timestamp dependence:** Escrow deadline uses `block.timestamp`. Miner manipulation window is ~15 seconds on BSC.

---

## 5. Known Issues & Accepted Risks

These were identified via Slither static analysis (v0.11.5) and manual review. They are documented here so the auditor does not re-discover them.

### Medium Severity

| # | Finding | Location | Status | Rationale |
|---|---------|----------|--------|-----------|
| M1 | Divide-before-multiply in `distribute()` | RevenueDistributor.sol:53-54 | Accepted | `afterFee * revenueShareBps / BPS_DENOMINATOR` — the multiply happens first due to operator precedence. Slither flags this as potential precision loss but the calculation order is correct. Maximum rounding error is < 1 wei per distribution. |

### Low Severity

| # | Finding | Location | Status | Rationale |
|---|---------|----------|--------|-----------|
| L1 | Constructor param shadowing (`_name`, `_symbol`, `_totalSupply`) | AgentShare.sol:24-28 | Accepted | Standard pattern for ERC-20 constructor params. No behavioral impact. |
| L2 | Reentrancy in Escrow.deposit() (event emission after external call) | Escrow.sol:53-69 | Accepted | Event emitted after `shareToken.purchaseShares()`. State is fully updated before the external call. The external call is to a trusted contract (AgentShare, owned by this Escrow). |
| L3 | Reentrancy in Escrow.claimRefund() (event emission after external call) | Escrow.sol:92-109 | Accepted | Same pattern as L2. State zeroed before external calls (CEI pattern). |
| L4 | Reentrancy in OfferingFactory.createOffering() | OfferingFactory.sol:87-142 | Accepted | Factory deploys contracts and transfers ownership. Only callable by owner/approved. No user funds at risk during deployment. |
| L5 | Reentrancy in RevenueDistributor.distribute() | RevenueDistributor.sol:46-69 | Accepted | SafeERC20 used. Only callable by operator (onlyOwner). Cumulative update happens after transfers, but only owner can trigger. |
| L6 | Timestamp dependence in Escrow | Escrow.sol:55,86 | Accepted | Deadline is checked against `block.timestamp`. BSC block time is ~3s; miner can manipulate ±15s. Escrow deadlines are typically days/weeks — 15s is immaterial. |
| L7 | Missing zero-check on constructor params | RevenueDistributor.sol:31-32 | Fixed | Added `require(_platformWallet != address(0))` and `require(_operatorWallet != address(0))` in sprint 005. |

### Previously Fixed (Sprint 005)

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| H1-H7 | Unchecked ERC-20 transfer return values | High | Added `SafeERC20` (`safeTransfer`/`safeTransferFrom`) to all transfer calls in Escrow and RevenueDistributor |
| O1-O13 | State variables that could be immutable | Optimization | Added `immutable` to 13 state variables across all 4 contracts |

---

## 6. Test Coverage

- **83 unit tests** across 5 contracts (Hardhat + ethers v6)
- Tests cover: happy paths, access control reverts, multi-investor scenarios, cumulative dividend math, refund flow with token return, factory wiring verification
- **E2E testnet cycle** executed: create → deploy → invest → release → distribute → claim (verified on BNB testnet)
- Test files: `contracts/test/*.test.ts`

---

## 7. Out of Scope

The following are NOT part of this smart contract audit:
- **MockFDUSD.sol** — Test-only contract with public mint, not deployed to mainnet
- **Off-chain application code** — Next.js API routes, Supabase database, indexer pipeline
- **Supabase RLS policies** — Separately audited in sprint 004
- **Frontend wallet integration** — wagmi/viem client-side code
- **Deployment scripts** — Hardhat deploy scripts (not deployed to mainnet)
- **Operational security** — Key management, deployer wallet security, multisig setup

---

## 8. Auditor Checklist

- [ ] Review OfferingFactory ownership and access control
- [ ] Verify Escrow fund safety (deposit → release/refund lifecycle)
- [ ] Check RevenueDistributor dividend math for rounding exploits
- [ ] Verify AgentShare non-transferability enforcement
- [ ] Check for reentrancy vectors (especially Escrow.deposit and claimRefund)
- [ ] Review factory → Escrow → AgentShare ownership transfer chain
- [ ] Check for front-running opportunities on release/triggerRefund
- [ ] Verify no funds can be permanently locked in any contract
- [ ] Review share math precision (amount / pricePerShare integer division)
- [ ] Check SafeERC20 usage is complete and correct
