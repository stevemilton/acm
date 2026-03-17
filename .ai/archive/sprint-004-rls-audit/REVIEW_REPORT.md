# REVIEW_REPORT — Sprint 004: Supabase RLS Audit

**Verdict: PASS WITH FIXES**

## Criteria Met

| # | Criterion | Status |
|---|-----------|--------|
| AC1 | Every table has documented RLS policies | ✅ Full audit table in BUILD_REPORT and ARCHITECTURE.md |
| AC2 | `offerings` INSERT + UPDATE scoped to owning operator | ✅ Correct ownership chain in policy |
| AC3 | `shares` INSERT policy works with invest flow | ✅ Scoped to `investor_id` matching auth.uid() |
| AC4 | `distributions` INSERT scoped to owning operator | ✅ Correct ownership chain |
| AC5 | No unrestricted DELETE | ✅ Explicit `USING (false)` on all 6 tables |
| AC6 | Indexer table RLS exclusion documented | ✅ In migration comments + ARCHITECTURE.md + BUILD_REPORT |
| AC7 | All 3 service-role routes reject without INDEXER_SECRET | ✅ Verified in all 4 routes (3 + cron) |
| AC8 | RLS test script exists | ✅ 9 test groups, correct ROLLBACK pattern |
| AC9 | `cd app && npm run build` passes | ✅ |
| AC10 | Migration `00005_rls_audit.sql` created | ✅ Clean, well-commented |

## Criteria Missed

None. All 10 acceptance criteria are met.

## Quality Issues

### Q1 — MUST FIX: Invest route `offerings.update()` still broken after migration

**Severity: High** (data integrity bug, pre-existing but now knowable)

The invest route (`/api/offerings/[id]/invest/route.ts`, line 118–121) updates `offerings.shares_sold` using the anon-key Supabase client. The authenticated user is the **investor**, not the operator. The new `offerings_update` policy only permits updates when `auth.uid()` matches the operator who owns the agent. So this update will **continue to silently fail** even after migration 00005.

The BUILD_REPORT states: "The invest route... will start working correctly through the web UI once migration 00005 is applied." This is **only partially true** — the `shares` INSERT will work (AC3 ✅), but the `offerings.shares_sold` update will still be blocked.

**Fix:** The `increment_shares_sold` RPC function already exists in migration 00002 as `SECURITY DEFINER` (bypasses RLS). Replace the direct `.update()` with `supabase.rpc("increment_shares_sold", { offering_id: offeringId, quantity })`. This is a 3-line change in the invest route and is the same pattern already used for `increment_investor_invested` on line 125.

**Note:** This is a pre-existing bug (the update was already broken before this sprint due to missing UPDATE policy), but the sprint revealed it, the fix is trivial, and the BUILD_REPORT should not claim the route is fixed without addressing it.

### Q2 — MUST FIX: ARCHITECTURE.md deployment table says "4 migrations"

Line 156: `Live (4 migrations)` should be `Live (5 migrations)` after migration 00005.

### Q3 — Observation: BUILD_REPORT overclaims invest route fix

The BUILD_REPORT "Next Steps" section (item 4) claims routes will "start working correctly." Amend to note the invest route's `offerings.update()` was fixed via RPC function.

### Q4 — Observation: Test T9 simulates service-role as postgres superuser

Test T9 uses `RESET ROLE` (postgres superuser) to simulate service-role. In Supabase, the actual `service_role` is a distinct role that bypasses RLS via the `supabase_admin` role, not via postgres superuser. The test is still valid (superuser bypasses everything, so it proves the write paths work), but it's not a perfect simulation. Acceptable for this sprint.

### Q5 — Observation: `revenue_events` table not audited

The monitor/revenue route writes to a `revenue_events` table which doesn't appear in the initial schema (migration 00001). It may have been created elsewhere or may not exist yet. The audit covers all tables from migrations 00001–00004 but `revenue_events` is referenced in code and not documented. This is out of scope for this sprint but should be tracked.

## Regression Risks

- **Low risk.** Migration only adds new policies (no modification or dropping of existing ones).
- **DELETE deny policies** could theoretically affect some admin operation, but all routes use Supabase client (not raw SQL DELETE), so this is safe.
- **Service-role routes unaffected** — they bypass RLS entirely.

## Docs Issues

- ARCHITECTURE.md deployment table migration count outdated (Q2)
- BUILD_REPORT overclaims invest route fix (Q3)
- All other docs correctly updated: CURRENT_STATE.md (17/18), compliance matrix (X1 Complete), CHANGELOG (v0.7.0)

## Scope Assessment

No overreach. All changes within sprint scope. No application code changes, no schema changes, no auth changes.

## Should anything be added to RULES.md?

**Yes — one addition recommended:**

> **Use `SECURITY DEFINER` RPC functions for cross-role writes.** When an API route acts on behalf of one role (e.g., investor) but needs to update a table owned by another role (e.g., operator's offerings), use an existing `security definer` function instead of a direct `.update()`. Direct writes will be blocked by RLS scoping.

## Should anything update ARCHITECTURE.md?

- Fix migration count in deployment table (Q2)
- Otherwise, the new Security Model section is excellent and comprehensive

## Required Fixes Before Merge

1. **Invest route: replace direct `offerings.update()` with `supabase.rpc("increment_shares_sold")`** — in `app/src/app/api/offerings/[id]/invest/route.ts`
2. **ARCHITECTURE.md line 156:** Change "4 migrations" → "5 migrations"
3. **BUILD_REPORT "Next Steps" item 4:** Amend to note invest route fixed via RPC
4. **RULES.md:** Add cross-role write rule

## Recommended Next Action

Apply the 4 fixes above, verify build still passes, then **MERGE_APPROVED**.
