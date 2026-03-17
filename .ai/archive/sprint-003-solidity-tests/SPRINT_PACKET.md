# Sprint: Solidity Unit Tests

**Sprint Type:** feature
**Sprint Reason:** S1 (Hardhat unit tests for all contracts) is the most actionable of the 3 remaining compliance gaps. Unit tests are a prerequisite for audit (S3) and validate the critical Escrow share-transfer fix from sprint 002. The claimRefund token-return bug (Q6 from sprint 002 review) should also be fixed and tested here.

## Objective

Write comprehensive Hardhat unit tests for all 5 Solidity contracts. Fix the `Escrow.claimRefund()` token-return bug. Achieve full coverage of happy paths, revert conditions, and access control.

## Why This Sprint Matters

Zero Solidity tests exist. The Escrow contract was just patched with a critical bug fix (share transfer) that has no regression protection. The claimRefund path has a known token-leak bug. Any future contract changes risk silent regressions without a test suite. S1 is a prerequisite for S3 (audit).

## In Scope

1. **Fix Escrow.claimRefund()** — must return AgentShare tokens to the contract before zeroing `sharesPurchased`
2. **Test MockFDUSD** — mint, transfer, approve, balanceOf
3. **Test AgentShare** — constructor, purchaseShares (owner-only), transfersEnabled toggle, _update override
4. **Test Escrow** — deposit (happy + revert), release (owner-only, min raise check), triggerRefund (deadline, min not met), claimRefund (token return), status transitions
5. **Test RevenueDistributor** — distribute (fee split math, owner-only), claim (share-weighted, nothing-to-claim revert), multi-investor proportional claims
6. **Test OfferingFactory** — createOffering (approved operators, param validation), getOffering, totalOfferings, setApprovedOperator (owner-only)

## Out of Scope

- Integration tests against live testnet (covered by e2e-cycle.ts)
- UI tests
- RLS audit (separate sprint X1)
- Gas optimization
- Any new contract features

## Files / Modules In Scope

- `contracts/contracts/MockFDUSD.sol`
- `contracts/contracts/AgentShare.sol`
- `contracts/contracts/Escrow.sol` (fix + test)
- `contracts/contracts/RevenueDistributor.sol`
- `contracts/contracts/OfferingFactory.sol`
- `contracts/test/` (new directory)
- `contracts/hardhat.config.ts` (if test config needed)

## Constraints

- Tests run locally via `npx hardhat test` — no testnet RPC needed
- Use Hardhat's built-in network (local EVM fork)
- Follow existing code style (TypeScript tests, ethers v6)
- No BigInt literals (`123n`) — use `BigInt(123)`
- The claimRefund fix changes Escrow.sol — recompile and verify e2e-cycle.ts still works conceptually (no need to re-run on testnet)

## Relevant Rules

- Two-step ERC-20 pattern for all deposits (approve → deposit)
- All amounts 18 decimals (parseEther/formatEther)
- No BigInt literals
- Factory pattern is canonical
- 5% platform fee is hardcoded in RevenueDistributor

## Acceptance Criteria

- [ ] `Escrow.claimRefund()` returns AgentShare tokens to the contract (bug fix)
- [ ] `npx hardhat test` passes with 0 failures
- [ ] Every public/external function on all 5 contracts has at least one test
- [ ] Revert conditions tested (unauthorized caller, deadline, min raise, etc.)
- [ ] Revenue distribution math verified (5% platform, revenueShareBps split)
- [ ] Multi-investor claim scenario tested (2+ investors, proportional payouts)
- [ ] `cd app && npm run build` still passes (no app regressions from Escrow fix)
- [ ] `npx hardhat compile` passes clean

## Required Tests

- `npx hardhat test` — primary deliverable
- `cd app && npm run build` — no regressions

## Docs To Update

- `docs/mvp-sow-compliance-matrix.md` — S1 → Complete
- `.ai/handoff/CURRENT_STATE.md` — reflect test suite exists, claimRefund fixed
- `CHANGELOG.md` — v0.6.0 entry

## Definition of Done

All acceptance criteria checked. `npx hardhat test` passes with full coverage of all 5 contracts. claimRefund bug fixed. BUILD_REPORT.md written with test output. Compliance matrix S1 marked Complete. Both builds pass.

## Git Instructions

- **Branch Name:** `sprint-003-solidity-tests`
- **Base Branch:** `sprint-002-e2e-testnet`
- **PR Strategy:** Single PR with all tests + claimRefund fix
- **Merge Policy:** Squash merge after review pass
