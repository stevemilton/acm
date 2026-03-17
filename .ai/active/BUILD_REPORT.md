# BUILD_REPORT — Sprint 005: Smart Contract Audit Prep

**Sprint:** Smart Contract Audit Prep
**Branch:** `sprint-005-audit-prep`
**Builder started:** 2026-03-17
**Status:** COMPLETE

## Objective

Prepare all artifacts for external smart contract audit: flattened sources, Slither analysis with fixes, audit scope document, and fix the `revenue_events` schema gap.

## Completed Work

### 1. Slither Static Analysis

Ran Slither v0.11.5 against all 5 contracts. Results:

| Severity | Before Fix | After Fix | Action |
|----------|-----------|-----------|--------|
| **High** | 7 | 0 | All fixed (SafeERC20) |
| **Medium** | 2 | 1 | 1 fixed (reentrancy via SafeERC20), 1 accepted (divide-before-multiply — correct operator precedence) |
| **Low** | 16 | 9 | 7 fixed (zero-checks, SafeERC20 resolves benign reentrancy), 9 accepted (shadowing, event-after-call, timestamp) |
| **Informational** | 6 | 9 | Increased due to SafeERC20 import adding more pragma versions. All informational. |
| **Optimization** | 13 | 0 | All fixed (immutable) |

### 2. Fixes Applied (No Behavioral Changes)

**Escrow.sol:**
- Added `import SafeERC20` + `using SafeERC20 for IERC20`
- Changed `paymentToken.transferFrom()` → `paymentToken.safeTransferFrom()`
- Changed `paymentToken.transfer()` → `paymentToken.safeTransfer()` (3 locations)
- Added `immutable` to: `paymentToken`, `shareToken`, `minRaise`, `maxRaise`, `pricePerShare`, `deadline`

**RevenueDistributor.sol:**
- Added `import SafeERC20` + `using SafeERC20 for IERC20`
- Changed all `paymentToken.transferFrom()` / `paymentToken.transfer()` → safe variants (4 locations)
- Added `immutable` to: `paymentToken`, `shareToken`, `platformWallet`, `operatorWallet`
- Added zero-address checks: `require(_platformWallet != address(0))`, `require(_operatorWallet != address(0))`

**AgentShare.sol:**
- Added `immutable` to `revenueShareBps`

**OfferingFactory.sol:**
- Added `immutable` to: `paymentToken`, `platformWallet`

### 3. Flattened Contracts

Generated in `contracts/flat/`:
| File | Lines |
|------|-------|
| MockFDUSD.flat.sol | 635 |
| AgentShare.flat.sol | 784 |
| Escrow.flat.sol | 1,311 |
| RevenueDistributor.flat.sol | 1,289 |
| OfferingFactory.flat.sol | 1,557 |

### 4. Audit Scope Document

Created `docs/audit-scope.md` with:
- Contracts in scope (4 production + 1 test-only)
- Deployed addresses (BNB testnet)
- Architecture summary (factory pattern, ownership chain, token flows)
- Threat model (actors, invariants, attack vectors)
- Known issues table (1 Medium, 9 Low — all with rationale)
- Test coverage summary
- Out-of-scope declaration
- Auditor checklist

### 5. Revenue Events Migration

Created `supabase/migrations/00006_revenue_events.sql`:
- `revenue_events` table matching the schema expected by `/api/monitor/revenue`
- Unique index on `source_tx_id` (prevents duplicate event processing)
- RLS enabled: public SELECT, no INSERT/UPDATE for anon (service-role writes only), DELETE denied

## Acceptance Criteria Status

- [x] Flattened Solidity files exist for all 5 contracts in `contracts/flat/`
- [x] Slither installed and run — all findings documented above
- [x] High/medium Slither findings fixed or documented as accepted risk with rationale
- [x] `docs/audit-scope.md` exists with full content
- [x] Migration `00006_revenue_events.sql` creates the `revenue_events` table
- [x] All 83 Hardhat tests still pass
- [x] `cd app && npm run build` still passes
- [x] No behavioral changes to smart contracts

## Files Changed

| File | Change |
|------|--------|
| `contracts/contracts/Escrow.sol` | SafeERC20, immutable (6 vars) |
| `contracts/contracts/RevenueDistributor.sol` | SafeERC20, immutable (4 vars), zero-checks |
| `contracts/contracts/AgentShare.sol` | immutable (1 var) |
| `contracts/contracts/OfferingFactory.sol` | immutable (2 vars) |
| `contracts/flat/*.flat.sol` | NEW — 5 flattened contract files |
| `docs/audit-scope.md` | NEW — audit scope document |
| `supabase/migrations/00006_revenue_events.sql` | NEW — revenue_events table |
| `docs/mvp-sow-compliance-matrix.md` | S3 → Partial |
| `CHANGELOG.md` | v0.8.0 entry |
| `.ai/handoff/CURRENT_STATE.md` | Sprint 005 status, 6 migrations, tech debt updates |

## Tests Run

- `npx hardhat compile` — 9 Solidity files compiled successfully
- `npx hardhat test` — 83 passing, 0 failures
- `cd app && npm run build` — passes
- Slither v0.11.5 — 0 High, 1 Medium (accepted), 9 Low (accepted), 0 Optimization

## Blockers/Issues

None. All acceptance criteria met.

## Recommended Next Steps

1. Reviewer pass on this sprint
2. Engage external auditor — hand over `docs/audit-scope.md` + `contracts/flat/`
3. Apply migration `00006_revenue_events.sql` to production Supabase
4. After audit completes: redeploy contracts to testnet with SafeERC20 fixes, re-run E2E cycle
