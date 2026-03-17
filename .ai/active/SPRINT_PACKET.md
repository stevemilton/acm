# Sprint: Smart Contract Audit Prep

**Sprint Type:** repair
**Sprint Reason:** S3 (smart contract audit) is the last compliance gap. Before engaging an external auditor, we need: flattened contract sources, static analysis results with fixes, a formal audit scope document, and the `revenue_events` schema gap closed. This sprint produces everything needed to hand off to an auditor.

## Objective

Prepare all artifacts needed to engage an external smart contract auditor: flattened Solidity sources, Slither static analysis with any fixable findings addressed, an audit scope document, and a complete database schema (fix `revenue_events` gap).

## Why This Sprint Matters

An external auditor needs: (1) flattened contract source files they can review without the Hardhat project, (2) known issues pre-triaged so audit hours aren't wasted on known items, (3) a scope document defining what's in/out of audit, and (4) confidence that the platform schema is complete. The `revenue_events` table gap also means the revenue monitor is broken in production — it writes to a table that doesn't exist.

## In Scope

1. **Flatten contracts** — Generate single-file Solidity for each of the 5 contracts using `hardhat flatten` or equivalent. Output to `contracts/flat/`.
2. **Run Slither static analysis** — Install and run Slither against all contracts. Document all findings.
3. **Fix Slither findings** — Address any high/medium severity issues. Document low/informational as accepted risks.
4. **Write audit scope document** — `docs/audit-scope.md` covering: contracts in scope, deployment addresses, known issues, architecture summary, threat model, and what's out of scope.
5. **Fix `revenue_events` schema gap** — Create migration `00006_revenue_events.sql` with the table definition matching what the revenue monitor route expects.
6. **Re-run Hardhat tests** — Confirm 83 tests still pass after any Solidity changes.

## Out of Scope

- Performing the actual audit (external vendor)
- Application-level code changes (except the migration)
- UI changes
- New smart contract features
- Deploying updated contracts to testnet (only if Slither fixes require recompilation)

## Files / Modules In Scope

- `contracts/contracts/*.sol` — All 5 Solidity source files (read + potential fixes)
- `contracts/flat/` — NEW: flattened contract output
- `contracts/hardhat.config.ts` — May need Slither config
- `contracts/test/*.test.ts` — Re-run to verify no regressions
- `docs/audit-scope.md` — NEW: audit scope document
- `supabase/migrations/00006_revenue_events.sql` — NEW: revenue_events table
- `app/src/app/api/monitor/revenue/route.ts` — Reference for revenue_events schema

## Constraints

- Do not change contract behavior — Slither fixes must be cosmetic/safety only (e.g., missing checks, reentrancy guards, variable visibility)
- If Slither finds issues that require behavioral changes, document them in the audit scope as known issues for the auditor
- Flattened files are for auditor reference only — do not change the canonical source in `contracts/contracts/`
- The `revenue_events` migration must match what the revenue monitor route already writes
- All 83 existing Hardhat tests must continue to pass

## Relevant Rules

- Factory pattern is canonical (RULES.md)
- Two-step ERC-20 pattern for all deposits (RULES.md)
- 5% platform fee is hardcoded in RevenueDistributor (RULES.md)
- Escrow share math produces raw integers, not 18-decimal values (RULES.md)
- Build must pass before committing (RULES.md)
- No BigInt literals in source files (RULES.md)

## Acceptance Criteria

- [ ] Flattened Solidity files exist for all 5 contracts in `contracts/flat/`
- [ ] Slither installed and run — all findings documented in BUILD_REPORT
- [ ] High/medium Slither findings fixed or documented as accepted risk with rationale
- [ ] `docs/audit-scope.md` exists with: contracts in scope, addresses, architecture summary, known issues, threat model
- [ ] Migration `00006_revenue_events.sql` creates the `revenue_events` table
- [ ] All 83 Hardhat tests still pass (`npx hardhat test`)
- [ ] `cd app && npm run build` still passes
- [ ] No behavioral changes to smart contracts

## Required Tests

- `cd contracts && npx hardhat test` — 83 tests, 0 failures
- `cd app && npm run build` — no regressions
- `cd contracts && npx hardhat compile` — clean compilation after any fixes

## Docs To Update

- `.ai/handoff/CURRENT_STATE.md` — S3 status updated to "audit prep complete, ready for external auditor"
- `docs/mvp-sow-compliance-matrix.md` — S3 → Partial with evidence (prep done, audit pending)
- `CHANGELOG.md` — v0.8.0 entry
- `docs/audit-scope.md` — NEW

## Definition of Done

Flattened contracts generated. Slither run with findings documented and fixable issues addressed. Audit scope document written. `revenue_events` migration created. All tests pass. BUILD_REPORT.md written with Slither findings table and audit readiness checklist.

## Git Instructions

- **Branch Name:** `sprint-005-audit-prep`
- **Base Branch:** `sprint-004-rls-audit`
- **PR Strategy:** Single PR with flat contracts + audit doc + migration + fixes
- **Merge Policy:** Squash merge after review pass
