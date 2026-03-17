# REVIEW_REPORT — Sprint 003: Solidity Unit Tests

**Reviewer:** AI Reviewer
**Date:** 2026-03-17
**Sprint Packet:** `.ai/active/SPRINT_PACKET.md`
**Build Report:** `.ai/active/BUILD_REPORT.md`
**Verdict:** PASS WITH FIXES

---

## Acceptance Criteria Evaluation

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| AC1 | `Escrow.claimRefund()` returns AgentShare tokens to the contract (bug fix) | ✅ MET | `returnShares()` added to AgentShare, called in `claimRefund()` before zeroing state. CEI pattern correct. Test at Escrow.test.ts line 307-321 verifies token return + balance check. |
| AC2 | `npx hardhat test` passes with 0 failures | ✅ MET | 83 passing, 0 failing. Verified live during review. |
| AC3 | Every public/external function on all 5 contracts has at least one test | ✅ MET | See function coverage analysis below. |
| AC4 | Revert conditions tested (unauthorized caller, deadline, min raise, etc.) | ✅ MET | 15+ revert tests across all contracts. OwnableUnauthorizedAccount, deadline checks, status checks, min/max raise, nothing to refund/claim. |
| AC5 | Revenue distribution math verified (5% platform, revenueShareBps split) | ✅ MET | 1000 FDUSD → 50 platform (5%) → 807.5 operator (85%) → 142.5 investors (15%). Sum check: 85.5 + 57 = 142.5. |
| AC6 | Multi-investor claim scenario tested (2+ investors, proportional payouts) | ✅ MET | Two investors (60%/40%), verified individually and summed. Multi-round cumulative tested. |
| AC7 | `cd app && npm run build` still passes (no app regressions) | ✅ MET | Per BUILD_REPORT. Contract changes don't affect app build (no ABI changes to existing functions). |
| AC8 | `npx hardhat compile` passes clean | ✅ MET | Per BUILD_REPORT. |

**Score: 8/8 — all acceptance criteria met.**

---

## Function Coverage Analysis

| Contract | Function | Tested? |
|----------|----------|---------|
| **MockFDUSD** | constructor | ✅ |
| | mint() | ✅ |
| | (inherited transfer, approve, transferFrom) | ✅ |
| **AgentShare** | constructor | ✅ (8 tests incl. edge cases) |
| | purchaseShares() | ✅ |
| | returnShares() | ✅ |
| | setTransfersEnabled() | ✅ |
| | _update() override | ✅ (3 scenarios) |
| **Escrow** | constructor | ✅ |
| | deposit() | ✅ (6 tests) |
| | release() | ✅ (5 tests) |
| | triggerRefund() | ✅ (5 tests) |
| | claimRefund() | ✅ (7 tests incl. multi-investor) |
| **RevenueDistributor** | constructor | ✅ |
| | distribute() | ✅ (4 tests) |
| | claim() | ✅ (9 tests incl. multi-round) |
| **OfferingFactory** | constructor | ✅ (5 tests) |
| | setApprovedOperator() | ✅ (4 tests) |
| | createOffering() | ✅ (7 tests incl. wiring) |
| | getOffering() | ✅ |
| | totalOfferings() | ✅ |

All public/external functions covered. No gaps.

---

## Bug Fix Review: Escrow.claimRefund()

### Implementation

```solidity
uint256 shares = sharesPurchased[msg.sender];
deposits[msg.sender] = 0;
sharesPurchased[msg.sender] = 0;

if (shares > 0) {
    shareToken.returnShares(msg.sender, shares);
}

paymentToken.transfer(msg.sender, amount);
```

### Assessment

- **CEI pattern:** State zeroed before external calls. Correct.
- **Reentrancy safe:** Both `returnShares` and `paymentToken.transfer` are known ERC20 calls, not arbitrary external calls. State already zeroed.
- **Zero shares guard:** `if (shares > 0)` prevents unnecessary call.
- **_update compatibility:** `returnShares` calls `_transfer(investor, address(this))`. The `_update` override allows transfers TO `address(this)` regardless of `transfersEnabled`.
- **Ownership correct:** Escrow owns AgentShare, so `onlyOwner` on `returnShares` is satisfied.

**Verdict: Fix is clean and correct.**

---

## Quality Issues

### Q1 — Share magnitude mismatch between Escrow and RevenueDistributor tests (MEDIUM)

The Escrow test correctly uses raw integer shares (`BigInt(100)` for 500 FDUSD / 5 FDUSD per share). But the RevenueDistributor test sets up investors with `ethers.parseEther("600")` (= 600e18) shares via `purchaseShares()`, simulating post-escrow state.

In production, Escrow would give investors raw integer shares (e.g., 100), not 18-decimal amounts (100e18). The RevenueDistributor test math works at any magnitude (proportions are preserved), but it doesn't test the actual production share magnitude. A combined Escrow-to-RevenueDistributor integration test would catch any rounding issues with small raw-integer share counts.

**Risk:** Low — the cumulative dividend math scales correctly at any magnitude. But this is worth noting as a gap.

**Fix:** No blocking fix required. Consider adding an integration test in a future sprint that flows Escrow deposits into RevenueDistributor claims with production-realistic share magnitudes.

### Q2 — Uncommitted sprint 002 changes mixed in working tree (PROCESS)

The git log shows the last commit is `6874788` (sprint 001 close). All sprint 002 changes (e2e-cycle.ts, indexer fixes, factory redeploy, ARCHITECTURE/ROADMAP/RULES updates) AND sprint 003 changes are uncommitted in the working tree together.

This means a single commit/PR will contain two sprints of work, making it harder to attribute changes and potentially harder to revert if needed.

**Fix required:** Commit sprint 002 and sprint 003 as separate commits (or at minimum, clearly separate them in the commit message).

### Q3 — Missing edge case: deposit with non-divisible amount (LOW)

`Escrow.deposit()` computes `shares = amount / pricePerShare`. If an investor deposits 3 FDUSD with pricePerShare = 5 FDUSD, shares = 3e18 / 5e18 = 0 (integer division truncation). The investor loses 3 FDUSD and receives 0 shares. No test covers this edge case.

The contract doesn't guard against zero-share deposits. This is a design concern, not a test concern, but a test documenting the behavior would be valuable.

**Fix:** Not blocking. Consider adding a test that documents the zero-share-deposit behavior, and optionally a `require(shares > 0, "Amount too small")` guard in a future sprint.

### Q4 — Missing edge case: distribute with zero totalShares (LOW)

`RevenueDistributor.distribute()` handles `totalShares == 0` with an `if` guard (line 59), but the investor amount stays in the contract permanently — it's not returned to the operator or added to a recoverable pool. No test covers this scenario.

**Fix:** Not blocking. Consider testing the zero-totalShares case for documentation.

### Q5 — RevenueDistributor test uses purchaseShares directly instead of Escrow flow (LOW)

Related to Q1. The test calls `share.connect(operator).purchaseShares(investor1.address, ethers.parseEther("600"))` directly. In production, the operator cannot call `purchaseShares` — only the Escrow (as AgentShare owner) can. The test works because operator IS the owner in the test setup (ownership not transferred to an Escrow). This is fine for unit testing but worth noting.

**Fix:** None required for unit tests. Integration tests would catch this.

---

## Overreach Assessment

### In-scope changes (sprint 003):
- `contracts/contracts/AgentShare.sol` — `returnShares()` added
- `contracts/contracts/Escrow.sol` — `claimRefund()` fixed
- `contracts/test/*.test.ts` — 5 test files, 83 tests
- `CHANGELOG.md` — v0.6.0 entry
- `docs/mvp-sow-compliance-matrix.md` — S1 marked Complete
- `.ai/handoff/CURRENT_STATE.md` — updated
- `.ai/active/BUILD_REPORT.md` — written

### Mixed in from sprint 002 (not sprint 003 work):
- `app/src/app/api/indexer/events/route.ts` — block range fix
- `app/src/app/api/monitor/revenue/route.ts` — block range fix
- `app/src/lib/chain-config.ts` — new factory address
- `contracts/scripts/approve-operator.ts` — v2 factory reference
- `contracts/scripts/e2e-cycle.ts` — E2E script (new)
- `ARCHITECTURE.md` — factory address, block range updates
- `ROADMAP.md` — updates
- `RULES.md` — block range rule added
- `.ai/archive/sprint-002-e2e-testnet/` — archive directory (new)

**Verdict:** Sprint 003 itself has no overreach. All contract and test changes are within scope. The mixed working tree is a process issue (Q2), not an overreach issue.

---

## Regression Risks

| Risk | Severity | Notes |
|------|----------|-------|
| `returnShares()` adds new external function to AgentShare | None | onlyOwner, no new attack surface. Only Escrow (owner) can call. |
| Escrow bytecode changed — new factory deployments produce different Escrow | None | Intentional. Old testnet contracts unaffected (immutable). |
| No existing tests to break | None | This sprint adds the first test suite. No regression possible. |
| App build unaffected | None | No ABI changes to functions the app calls. `returnShares` is new and not called from the frontend. |

---

## Documentation Issues

| Doc | Issue | Severity |
|-----|-------|----------|
| `BUILD_REPORT.md` | Thorough and well-structured. Share math note is excellent. | None |
| `CHANGELOG.md` | v0.6.0 entry accurate and complete. | None |
| `docs/mvp-sow-compliance-matrix.md` | S1 correctly marked Complete. | None |
| `CURRENT_STATE.md` | Updated with sprint 003 info. Sprint 002 also reflected. | None |
| `CURRENT_STATE.md` | "Safest Next Step" still recommends sprint 003 — should be updated post-completion. | Low |

---

## Should anything be added to RULES.md?

**Yes — one addition:**

> **Share math in Escrow:** `shares = amount / pricePerShare` divides two 18-decimal values and produces raw integers (e.g., 500e18 / 5e18 = 100, not 100e18). Tests and downstream contracts must use raw integer share counts, not 18-decimal amounts, when referencing Escrow-originated shares.

This tripped up the initial test writing and is a non-obvious footgun.

---

## Should anything update ARCHITECTURE.md?

**No changes needed from sprint 003 specifically.** The ARCHITECTURE.md changes in the working tree are from sprint 002.

The `returnShares()` function should be mentioned in any future architecture refresh, but doesn't warrant an immediate update — it mirrors `purchaseShares()` and the pattern is self-documenting.

---

## Verdict: PASS WITH FIXES

### Required Fixes (2 items):

| # | Fix | Effort | Blocking? |
|---|-----|--------|-----------|
| F1 | Commit sprint 002 and sprint 003 as separate commits to preserve change attribution | 5 min | Yes — must be done before merge |
| F2 | Update CURRENT_STATE.md "Safest Next Step" to reflect sprint 003 is complete | 1 min | No |

### Recommended Improvements (not blocking):

| # | Improvement | Notes |
|---|-------------|-------|
| R1 | Add share-math rule to RULES.md (raw integers, not 18-decimal) | Prevents future confusion |
| R2 | Future: integration test combining Escrow deposit → RevenueDistributor claim at production share magnitude | Closes Q1 gap |
| R3 | Future: test for zero-share deposit edge case (amount < pricePerShare) | Documents/protects against Q3 |
| R4 | Future: test RevenueDistributor.distribute() with zero totalShares | Documents Q4 behavior |

### Recommended Next Action

1. Apply F1: commit sprint 002 changes first, then sprint 003 changes as a separate commit
2. Apply F2: update CURRENT_STATE.md safest next step
3. Optionally apply R1 (RULES.md share-math note)
4. Proceed to Control Tower for sprint distillation and next sprint selection
