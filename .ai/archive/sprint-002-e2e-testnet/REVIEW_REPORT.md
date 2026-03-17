# REVIEW_REPORT — Sprint 002: E2E Testnet Cycle

**Reviewer:** AI Reviewer
**Date:** 2026-03-17
**Sprint Packet:** `.ai/active/SPRINT_PACKET.md`
**Build Report:** `.ai/active/BUILD_REPORT.md`
**Verdict:** PASS WITH FIXES

---

## Acceptance Criteria Evaluation

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| AC1 | Fresh offering created in DB with all required fields | ✅ MET | Offering `5fa7b9d3-...` created via Supabase MCP with contract addresses |
| AC2 | Contracts deployed on-chain via factory, addresses saved to DB | ✅ MET | Factory TX `0x220ad982...`, 3 contracts deployed, addresses saved to DB |
| AC3 | Investor holds AgentShare tokens after deposit (verified on-chain) | ✅ MET | 100 E2E tokens, critical Escrow bug found and fixed to make this work |
| AC4 | Escrow status transitions: pending → funded | ✅ MET | Release TX `0xd28c13e3...` confirmed. BSC RPC read lag on status read is documented |
| AC5 | Revenue distributed: FDUSD split visible | ✅ MET | 50/807.5/142.5 split verified — matches 5% platform / 85% operator / 15% investor |
| AC6 | Investor claims FDUSD from distributor | ✅ MET | 142.5 FDUSD claimed, TX `0xdf463ab7...` |
| AC7 | `on_chain_events` table has Deposited, Released, RevenueReceived events | ⚠️ NOT MET | Table is empty. Events exist on-chain but indexer hasn't run with the block-range fix deployed |
| AC8 | `indexer_state` block numbers have advanced | ⚠️ PARTIAL | Seeded at 96265680 for new contracts. State sync works (200 blocks read OK). Event indexer advanced old contracts but hasn't caught up to new contract events yet |
| AC9 | Zero unhandled errors in full cycle | ✅ MET | All 7 Hardhat steps completed with zero errors |

**Score: 7/9 fully met, 2 partially met (both blocked on Railway deploy of this branch)**

---

## Quality Issues

### Q1 — Deviation from sprint scope: E2E ran via Hardhat script, not live Railway UI (MEDIUM)

The sprint packet explicitly says: "Execute the full lifecycle on BNB testnet **through the live Railway deployment**" and "deploy contracts **from the UI**". The Builder executed via a Hardhat script (`e2e-cycle.ts`) rather than the deployed UI.

**Justification:** Reasonable — the Builder cannot interact with MetaMask/browser UI. The Hardhat script tests identical contract code paths. However, this means the **UI components were not tested** as part of the E2E cycle. The UI deploy path (deploy-offering.tsx → factory → parse events → save to DB) remains untested end-to-end.

**Recommendation:** Accept for this sprint but add a note to CURRENT_STATE.md that UI E2E remains unverified. Consider a manual UI walkthrough as a future task.

**Fix required:** No code fix. Add note to CURRENT_STATE.md.

### Q2 — `on_chain_events` acceptance criterion not met (MEDIUM)

AC7 requires `on_chain_events` to have Deposited, Released, RevenueReceived events. The table is empty because the block-range fix hasn't been deployed to Railway. The fix is code-complete and the events exist on-chain — this is a deploy dependency, not a code issue.

**Recommendation:** This is acceptable for PASS WITH FIXES — deploy to Railway, run cron 2-3 times, and verify events appear. If they don't, it's a FAIL.

**Fix required:** Deploy branch, run cron, verify events populate.

### Q3 — CURRENT_STATE.md says "14/18 Complete | 1 Partial" but compliance matrix shows 15/18 (LOW)

Line 55: "**14/18 Complete | 1 Partial | 3 Missing**" — this contradicts the compliance matrix which now shows 15/18 Complete (C9 and I5 both moved to Complete). The CURRENT_STATE.md was not updated consistently.

**Fix required:** Update CURRENT_STATE.md compliance score to "15/18 Complete | 0 Partial | 3 Missing".

### Q4 — ARCHITECTURE.md not updated with new factory address or block-range cap (LOW)

ARCHITECTURE.md line 124 still shows the old factory: `0xe6C3AA4130c4Bf68dACEEE6F1cb8467dF2E262DA`. Line 95 says "Block range capped at 1000 blocks" but actual cap is now 200 blocks.

**Fix required:** Update ARCHITECTURE.md with new factory address and correct block range.

### Q5 — E2E script uses same wallet for operator and investor (LOW)

The sprint packet says: "Use a separate wallet or the same wallet as investor (document which)." The script uses the deployer as both operator and investor, which is documented in the script. However, this is a weaker test — a two-wallet test would verify that ownership/access controls work correctly (e.g., only the operator can release escrow).

**Recommendation:** Accept for this sprint. Two-wallet E2E would be a good future enhancement.

**Fix required:** None.

### Q6 — Escrow.claimRefund doesn't return shares to contract (LOW, PRE-EXISTING)

The fixed Escrow now correctly transfers shares on deposit via `purchaseShares()`. But `claimRefund()` (line 94-95) zeroes `sharesPurchased` without returning the AgentShare tokens to the contract. If an investor gets a refund, they keep their share tokens but the escrow has no mechanism to reclaim them.

**Recommendation:** This is a pre-existing issue outside sprint scope (not introduced by this sprint). Document for future sprint.

**Fix required:** No (out of scope). Note for future.

---

## Regression Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Old factory address in ARCHITECTURE.md could mislead future sessions | Low | Fix in Q4 |
| Old demo offering (c0000000) still in DB referencing deprecated contracts | Low | Not harmful but could cause confusing indexer errors on old contracts |
| Escrow.sol change requires factory redeploy — all future offerings use new bytecode | None | Intentional. Old offering contracts unaffected (immutable on-chain). New factory already deployed. |
| Block range reduction (1000→200) means indexer takes 5x longer to catch up | Low | Acceptable trade-off for reliability. 200 blocks ≈ 10 min ≈ 2 cron cycles to catch up |

---

## Overreach Check

No overreach detected. All changes are within sprint scope:
- Escrow fix: repair scope (sprint explicitly allows "Fix any bugs encountered")
- Indexer block range: repair scope (needed to make indexer work for verification)
- Factory redeploy: necessary consequence of Escrow fix
- E2E script: primary deliverable
- Doc updates: required by sprint packet

---

## Docs Issues

| Doc | Issue | Severity |
|-----|-------|----------|
| `CURRENT_STATE.md` | Compliance score inconsistent (says 14 but should be 15) | Low — Fix required |
| `ARCHITECTURE.md` | Old factory address on line 124, wrong block range on line 95 | Low — Fix required |
| `RULES.md` | No mention of block range cap as a rule | Info — Consider adding |
| `BUILD_REPORT.md` | Complete and well-evidenced with all TX hashes | None |
| `CHANGELOG.md` | v0.5.0 entry accurate | None |
| Compliance matrix | C9 and I5 correctly updated | None |

---

## Should anything be added to RULES.md?

**Yes — one addition recommended:**

> **Indexer block range is capped at 200 blocks per cron cycle.** BSC public RPC rate-limits `getLogs` for large ranges. The indexer always advances its position even when no events are found, so it catches up over multiple cron cycles.

---

## Should anything update ARCHITECTURE.md?

**Yes — three updates:**

1. **Line 95:** Change "Block range capped at 1000 blocks per call" → "Block range capped at 200 blocks per call"
2. **Line 124:** Update OfferingFactory address to `0x2f3E26b798B4D7906577F52a65BaA991Ea99C67A`
3. **Add E2E script** to the `/contracts/` module boundary description: `scripts/e2e-cycle.ts` — Full E2E lifecycle on testnet

---

## Verdict: PASS WITH FIXES

### Required Fixes (4 items, all low effort):

| # | Fix | Effort |
|---|-----|--------|
| F1 | Deploy branch to Railway, run cron 2-3 times, verify `on_chain_events` populates | 10 min |
| F2 | Fix CURRENT_STATE.md: compliance score → "15/18 Complete \| 0 Partial \| 3 Missing" | 1 min |
| F3 | Fix ARCHITECTURE.md: factory address (line 124), block range (line 95), add e2e-cycle.ts | 3 min |
| F4 | Add block-range cap rule to RULES.md | 2 min |

### Optional Improvements (not blocking):

| # | Improvement | Notes |
|---|-------------|-------|
| O1 | Note in CURRENT_STATE.md that UI E2E walkthrough remains unverified | Q1 context |
| O2 | Future: Escrow.claimRefund() should burn/return AgentShare tokens | Q6 pre-existing |
| O3 | Future: Two-wallet E2E test for access control verification | Q5 |

### Recommended Next Action

Apply the 4 required fixes, deploy to Railway, verify event indexing, then proceed to Control Tower for sprint distillation.
