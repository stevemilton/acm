# BUILD_REPORT — Sprint 003: Solidity Unit Tests

**Sprint:** Solidity Unit Tests
**Branch:** `sprint-003-solidity-tests`
**Builder started:** 2026-03-17
**Status:** COMPLETE

## Summary

Wrote comprehensive Hardhat unit tests for all 5 Solidity contracts (83 tests, 0 failures). Fixed the `Escrow.claimRefund()` token-return bug. All acceptance criteria met.

## Bug Fix: Escrow.claimRefund() Token Return

### Problem
`claimRefund()` zeroed `sharesPurchased[msg.sender]` without returning AgentShare tokens to the contract. Investors kept tokens after refund — a token leak.

### Fix
1. Added `returnShares(address investor, uint256 amount)` to `AgentShare.sol` (onlyOwner, mirrors `purchaseShares`)
2. Modified `Escrow.claimRefund()` to call `shareToken.returnShares(msg.sender, shares)` before zeroing `sharesPurchased`
3. The `_update` override in AgentShare already allows transfers TO the contract address, so no additional permission changes needed

### Files Changed
| File | Change |
|------|--------|
| `contracts/contracts/AgentShare.sol` | Added `returnShares()` function |
| `contracts/contracts/Escrow.sol` | `claimRefund()` calls `returnShares()` before zeroing shares |

## Test Suite

### Test Files
| File | Tests | Coverage |
|------|-------|----------|
| `contracts/test/MockFDUSD.test.ts` | 5 | constructor, mint, transfer, approve/transferFrom |
| `contracts/test/AgentShare.test.ts` | 18 | constructor (8), purchaseShares (2), returnShares (2), setTransfersEnabled (3), _update override (3) |
| `contracts/test/Escrow.test.ts` | 24 | constructor (2), deposit (6), release (5), triggerRefund (5), claimRefund (6) |
| `contracts/test/RevenueDistributor.test.ts` | 15 | constructor (2), distribute (4), claim (9 incl multi-round + multi-investor) |
| `contracts/test/OfferingFactory.test.ts` | 21 | constructor (5), setApprovedOperator (4), createOffering (7), getOffering (1), totalOfferings (1), wiring (3) |
| **Total** | **83** | |

### Key Test Scenarios

**Escrow deposit/release happy path:**
- Investor approves FDUSD → deposits → receives AgentShare tokens
- Operator releases when minRaise met → receives FDUSD

**Escrow refund (bug fix verified):**
- Deadline passes, minRaise not met → triggerRefund → status = Refunding
- Investor claimRefund → gets FDUSD back AND returns AgentShare tokens to contract
- Multiple investors claim independently → all shares returned to contract

**Revenue distribution math:**
- 1000 FDUSD gross → 50 platform (5%) → 807.5 operator (85% of 950) → 142.5 investors (15% of 950)
- Investor1 (600/1000 shares = 60%) claims 85.5 FDUSD
- Investor2 (400/1000 shares = 40%) claims 57 FDUSD
- Sum verified: 85.5 + 57 = 142.5 (exact match)

**Multi-round distribution:**
- Investor can claim after each round OR accumulate across rounds
- Cumulative dividend pattern works correctly over 2 distribution rounds

**Revert conditions tested:**
- Unauthorized callers (onlyOwner, onlyOwnerOrApproved)
- Deadline not reached / deadline passed
- Min raise not met / min raise met
- Exceeds max raise
- Nothing to refund / nothing to claim
- Transfers disabled (AgentShare investor-to-investor)
- Invalid constructor params (zero addresses, out-of-range BPS)

**Factory wiring:**
- AgentShare ownership → Escrow (so escrow can call purchaseShares/returnShares)
- Escrow ownership → operator
- RevenueDistributor ownership → operator
- Auto-incrementing offering IDs

### Share Math Note
The Escrow contract computes `shares = amount / pricePerShare` where both values are 18-decimal. This produces raw integers (e.g., 500e18 / 5e18 = 100), not 18-decimal values. Tests verified this matches the deployed contract behavior. This is a known design decision — shares are stored as raw counts, not 18-decimal ERC-20 amounts.

## Test Output

```
83 passing (1s)
0 failing
```

## Acceptance Criteria Status

- [x] `Escrow.claimRefund()` returns AgentShare tokens to the contract (bug fix)
- [x] `npx hardhat test` passes with 0 failures (83 passing)
- [x] Every public/external function on all 5 contracts has at least one test
- [x] Revert conditions tested (unauthorized caller, deadline, min raise, etc.)
- [x] Revenue distribution math verified (5% platform, revenueShareBps split)
- [x] Multi-investor claim scenario tested (2 investors, proportional payouts)
- [x] `cd app && npm run build` still passes (no app regressions from Escrow fix)
- [x] `npx hardhat compile` passes clean (4 Solidity files)

## Files Changed

| File | Change |
|------|--------|
| `contracts/contracts/AgentShare.sol` | Added `returnShares()` function |
| `contracts/contracts/Escrow.sol` | `claimRefund()` calls `returnShares()` before zeroing shares |
| `contracts/test/MockFDUSD.test.ts` | NEW — 5 tests |
| `contracts/test/AgentShare.test.ts` | NEW — 18 tests |
| `contracts/test/Escrow.test.ts` | NEW — 24 tests |
| `contracts/test/RevenueDistributor.test.ts` | NEW — 15 tests |
| `contracts/test/OfferingFactory.test.ts` | NEW — 21 tests |
| `CHANGELOG.md` | v0.6.0 entry |
| `docs/mvp-sow-compliance-matrix.md` | S1 → Complete |
| `.ai/handoff/CURRENT_STATE.md` | Updated compliance score, claimRefund fix noted |

## Next Steps

1. Reviewer pass on this sprint
2. Note: The Escrow.sol and AgentShare.sol changes mean the OfferingFactory bytecode has changed. Any new factory deployment will produce contracts with the claimRefund fix. Existing testnet contracts are unaffected (deployed from old bytecode).
