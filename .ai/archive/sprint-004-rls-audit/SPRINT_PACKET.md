# Sprint: Supabase RLS Audit

**Sprint Type:** repair
**Sprint Reason:** X1 (RLS audit) is the last internally-actionable compliance gap. RLS is enabled on all 6 user-facing tables but several write policies are missing, service-role routes lack documentation, and no test verifies that RLS actually blocks unauthorized access. This must pass before mainnet.

## Objective

Audit all Supabase RLS policies, fix gaps, document the security model, and write tests that prove RLS blocks unauthorized reads/writes.

## Why This Sprint Matters

RLS is the primary data access control layer. The current state has known gaps: `offerings`, `shares`, and `distributions` tables block all INSERT/UPDATE at the RLS level, relying entirely on application logic. If any API route has a bug or a new route is added without ownership checks, data can be corrupted. The indexer tables (`indexer_state`, `on_chain_events`) have no RLS, which is intentional but undocumented. Without an audit, the platform cannot be considered secure for real funds.

## In Scope

1. **Audit existing RLS policies** — Document every policy on every table. Identify gaps where application logic substitutes for RLS.
2. **Fix missing write policies:**
   - `offerings` — needs INSERT policy scoped to the operator who owns the parent agent
   - `offerings` — needs UPDATE policy scoped to the operator who owns the parent agent
   - `shares` — needs INSERT policy (service-role only, or scoped to the invest flow)
   - `distributions` — needs INSERT policy scoped to the operator who owns the agent
3. **Add DELETE policies** — Explicitly deny DELETE on all tables (or add scoped policies where deletion is a valid operation)
4. **Document intentional RLS exclusions** — `indexer_state` and `on_chain_events` are system tables accessed only via service-role. Document why RLS is not needed.
5. **Verify service-role route protection** — Confirm all 3 service-role routes (`/api/indexer`, `/api/indexer/events`, `/api/monitor/revenue`) require `INDEXER_SECRET` auth and cannot be called by anonymous users.
6. **Write RLS tests** — SQL-based tests that prove:
   - Anon users cannot read `shares` belonging to other investors
   - Operators cannot modify other operators' agents
   - Unauthenticated requests cannot write to any table
   - Service-role can write to all tables (indexer use case)
7. **Create a new migration** (`00005_rls_audit.sql`) for any policy changes

## Out of Scope

- Smart contract security (separate S3 sprint — requires external auditor)
- Application-level authorization logic refactoring
- New features or UI changes
- Database schema changes (no new tables/columns)
- Auth flow changes (login, signup, session management)

## Files / Modules In Scope

- `supabase/migrations/00001_initial_schema.sql` — reference for existing policies
- `supabase/migrations/00005_rls_audit.sql` — NEW: policy fixes
- `app/src/app/api/indexer/route.ts` — verify INDEXER_SECRET check
- `app/src/app/api/indexer/events/route.ts` — verify INDEXER_SECRET check
- `app/src/app/api/monitor/revenue/route.ts` — verify INDEXER_SECRET check
- `app/src/app/api/offerings/[id]/invest/route.ts` — verify ownership checks align with RLS
- `app/src/app/api/offerings/[id]/contracts/route.ts` — verify ownership checks align with RLS
- `app/src/app/api/distributions/route.ts` — verify ownership checks align with RLS
- `supabase/tests/` — NEW: RLS test files (if using pgTAP or SQL scripts)

## Constraints

- RLS policy changes must be backward-compatible with existing data
- Do not break the indexer — service-role routes must continue to bypass RLS
- Do not break the invest flow — `shares` INSERT must work for authenticated investors via the API
- All policy changes go in a single migration file (`00005_rls_audit.sql`)
- Test with both anon key (user session) and service-role key perspectives
- No changes to `auth.users` or Supabase auth config

## Relevant Rules

- Supabase is the source of truth for off-chain state (RULES.md)
- Supabase/viem clients must be created inside handlers, not at module level (RULES.md)
- Database migrations via Supabase CLI or MCP tool (RULES.md)
- Agent Shares are securities under Howey Test — data access control is a compliance requirement (RULES.md)

## Acceptance Criteria

- [ ] Every table has documented RLS policies (audit spreadsheet or markdown table in BUILD_REPORT)
- [ ] `offerings` table has INSERT and UPDATE policies scoped to the owning operator
- [ ] `shares` table has INSERT policy that works with the invest flow
- [ ] `distributions` table has INSERT policy scoped to the owning operator
- [ ] No table allows unrestricted DELETE (explicit DENY or no DELETE policy with RLS enabled)
- [ ] `indexer_state` and `on_chain_events` RLS exclusion is documented with rationale
- [ ] All 3 service-role routes reject requests without valid `INDEXER_SECRET`
- [ ] RLS test script exists and passes — proves unauthorized access is blocked
- [ ] `cd app && npm run build` still passes
- [ ] Migration `00005_rls_audit.sql` applies cleanly

## Required Tests

- RLS test script (SQL or pgTAP) covering:
  - Cross-user read isolation on `shares`
  - Cross-operator write isolation on `agents`, `offerings`, `distributions`
  - Unauthenticated write rejection on all user-facing tables
  - Service-role bypass confirmation
- `cd app && npm run build` — no regressions

## Docs To Update

- `.ai/handoff/CURRENT_STATE.md` — X1 → Complete, update compliance score to 17/18
- `docs/mvp-sow-compliance-matrix.md` — X1 → Complete with evidence
- `CHANGELOG.md` — v0.7.0 entry
- `ARCHITECTURE.md` — Add "Security Model" section documenting RLS policy summary and service-role usage pattern

## Definition of Done

All acceptance criteria checked. Every user-facing table has correct RLS policies. RLS test script passes. Migration applies cleanly. Service-role routes verified. BUILD_REPORT.md written with full audit table. Compliance matrix X1 marked Complete. App build passes.

## Git Instructions

- **Branch Name:** `sprint-004-rls-audit`
- **Base Branch:** `sprint-003-solidity-tests`
- **PR Strategy:** Single PR with migration + tests + doc updates
- **Merge Policy:** Squash merge after review pass
