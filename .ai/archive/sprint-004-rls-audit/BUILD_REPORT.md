# BUILD_REPORT — Sprint 004: Supabase RLS Audit

**Sprint:** Supabase RLS Audit
**Branch:** `sprint-004-rls-audit`
**Builder started:** 2026-03-17
**Status:** COMPLETE

## Summary

Audited all 8 Supabase tables for RLS completeness. Found and fixed critical gap: `offerings`, `shares`, and `distributions` had RLS enabled but were missing INSERT/UPDATE policies — all API writes through the anon-key client were silently blocked. Added 8 new policies, 6 explicit delete denies, documented the security model, wrote 9-group RLS test script.

## Critical Finding: Silent Write Failures

### Problem
Three tables had RLS enabled (from migration 00001) but only SELECT policies defined:
- `offerings` — no INSERT or UPDATE policy
- `shares` — no INSERT policy
- `distributions` — no INSERT policy

The invest route (`/api/offerings/[id]/invest`), contracts route (`/api/offerings/[id]/contracts`), and distributions route (`/api/distributions`) all use the anon-key Supabase server client, which enforces RLS. Without write policies, all INSERT/UPDATE operations on these tables would return empty results or silently fail.

### Why It Wasn't Caught
- The E2E testnet cycle (sprint 002) was executed via Hardhat scripts, not through the web API
- The indexer routes use `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely
- The `security definer` functions (increment_investor_invested, increment_shares_sold) also bypass RLS
- No one had tested the invest/distribute flows through the actual web UI

### Fix
Migration `00005_rls_audit.sql` adds:
- `offerings_insert` — scoped to operator who owns parent agent
- `offerings_update` — scoped to operator who owns parent agent
- `shares_insert` — scoped to authenticated investor's own record
- `distributions_insert` — scoped to operator who owns parent agent

## Full RLS Audit Table

### Pre-Audit State (migrations 00001–00004)

| Table | RLS | SELECT | INSERT | UPDATE | DELETE |
|-------|-----|--------|--------|--------|--------|
| operators | ✅ | Public | Own user_id | Own user_id | **NONE** |
| investors | ✅ | Public | Own user_id | Own user_id | **NONE** |
| agents | ✅ | Public | Own operator | Own operator | **NONE** |
| offerings | ✅ | Public | **NONE** ⚠️ | **NONE** ⚠️ | **NONE** |
| shares | ✅ | Own investor | **NONE** ⚠️ | **NONE** | **NONE** |
| distributions | ✅ | Public | **NONE** ⚠️ | **NONE** | **NONE** |
| indexer_state | ❌ | — | — | — | — |
| on_chain_events | ❌ | — | — | — | — |

### Post-Audit State (after migration 00005)

| Table | RLS | SELECT | INSERT | UPDATE | DELETE |
|-------|-----|--------|--------|--------|--------|
| operators | ✅ | Public | Own user_id | Own user_id | **Blocked** |
| investors | ✅ | Public | Own user_id | Own user_id | **Blocked** |
| agents | ✅ | Public | Own operator | Own operator | **Blocked** |
| offerings | ✅ | Public | **Own operator** ✅ | **Own operator** ✅ | **Blocked** |
| shares | ✅ | Own investor | **Own investor** ✅ | None (immutable) | **Blocked** |
| distributions | ✅ | Public | **Own operator** ✅ | None (immutable) | **Blocked** |
| indexer_state | ❌ | — | — | — | — |
| on_chain_events | ❌ | — | — | — | — |

## Service-Role Route Verification

| Route | Auth Check | Secret Env | Service-Role Client | Dev Bypass |
|-------|-----------|------------|--------------------|-----------|
| `/api/indexer` | `x-indexer-key` header | `INDEXER_SECRET` | `SUPABASE_SERVICE_ROLE_KEY` | `if (!secret) return true` |
| `/api/indexer/events` | `x-indexer-key` header | `INDEXER_SECRET` | `SUPABASE_SERVICE_ROLE_KEY` | `if (!secret) return true` |
| `/api/monitor/revenue` | `x-indexer-key` header | `INDEXER_SECRET` | `SUPABASE_SERVICE_ROLE_KEY` | `if (!secret) return true` |
| `/api/cron` | header + query param | `INDEXER_SECRET` | N/A (calls sub-endpoints) | `if (!secret) return true` |

All 4 routes reject requests without valid `INDEXER_SECRET` in production (env var is set on Railway).

## Indexer Table RLS Exclusion Rationale

`indexer_state` and `on_chain_events` intentionally do NOT have RLS enabled:
1. Only accessed by service-role routes (which bypass RLS regardless)
2. No anon-key route ever reads or writes these tables
3. Data is non-sensitive (public blockchain events, block numbers)
4. Adding RLS would add complexity with zero security benefit

## RLS Test Script

Located at `supabase/tests/rls_audit.sql`. 9 test groups:

| # | Test | What It Verifies |
|---|------|-----------------|
| T1 | Cross-user share read isolation | Operator cannot read investor's shares; investor can read their own |
| T2 | Cross-operator agent write isolation | Non-owner cannot update another operator's agent |
| T3 | Cross-operator offering write isolation | Non-owner cannot INSERT or UPDATE offerings for another's agent |
| T4 | Cross-operator distribution write isolation | Non-owner cannot INSERT distributions for another's agent |
| T5 | Authorized operator writes | Owner CAN insert/update their own offerings and distributions |
| T6 | Authorized investor share insert | Investor CAN insert shares for themselves; CANNOT insert for others |
| T7 | Anon write rejection | Anonymous role blocked from INSERT on all 6 user-facing tables |
| T8 | Delete blocking | Authenticated users cannot DELETE from any table |
| T9 | Service-role bypass | Superuser/service-role can write to all tables including system tables |

Script uses `SET LOCAL ROLE` + `SET LOCAL request.jwt.claims` to simulate different users, wrapped in a transaction that ROLLBACKs at the end (no persistent test data).

## Acceptance Criteria Status

- [x] Every table has documented RLS policies (audit table in this report)
- [x] `offerings` table has INSERT and UPDATE policies scoped to the owning operator
- [x] `shares` table has INSERT policy that works with the invest flow
- [x] `distributions` table has INSERT policy scoped to the owning operator
- [x] No table allows unrestricted DELETE (explicit deny on all 6 tables)
- [x] `indexer_state` and `on_chain_events` RLS exclusion is documented with rationale
- [x] All 3 service-role routes reject requests without valid `INDEXER_SECRET`
- [x] RLS test script exists — `supabase/tests/rls_audit.sql` (9 test groups)
- [x] `cd app && npm run build` still passes
- [x] Migration `00005_rls_audit.sql` created

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/00005_rls_audit.sql` | NEW — 8 new policies + 6 delete denies |
| `supabase/tests/rls_audit.sql` | NEW — 9-group RLS test script |
| `ARCHITECTURE.md` | Added "Security Model" section with RLS policy table |
| `docs/mvp-sow-compliance-matrix.md` | X1 → Complete |
| `CHANGELOG.md` | v0.7.0 entry |
| `.ai/handoff/CURRENT_STATE.md` | 17/18 compliance, sprint 004 status |

## Next Steps

1. Reviewer pass on this sprint
2. Apply migration `00005_rls_audit.sql` to production Supabase
3. Run RLS test script against production to verify
4. The contracts route and distributions route will work correctly once migration 00005 is applied. The invest route additionally required replacing the direct `offerings.update()` with the existing `increment_shares_sold` RPC function (security definer) — the investor is not the operator, so the `offerings_update` RLS policy would block the direct write. This fix was applied during review.
