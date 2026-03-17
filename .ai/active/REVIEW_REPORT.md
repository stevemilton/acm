# REVIEW REPORT — Sprint: Unblock Factory Deploy + Activate Cron

**Date:** 2026-03-17
**Reviewer role:** Automated Review against SPRINT_PACKET.md
**Build report:** `.ai/active/BUILD_REPORT.md`

---

## Verdict: **PASS WITH FIXES**

The sprint objective is met — both blockers are cleared and verified live. However, there are quality issues that should be addressed before the next sprint begins.

---

## Exit Criteria Assessment

| Criteria | Status | Evidence |
|----------|--------|----------|
| `approve-operator.ts` script exists and has been run on testnet | ✅ Met | Script at `contracts/scripts/approve-operator.ts`, tx confirmed on BNB testnet |
| `INDEXER_SECRET` set in Railway | ✅ Met | Verified via `railway variables` |
| `/api/cron` returns 200 and populates `indexer_state` | ✅ Met | HTTP 200 verified. `indexer_state` has 3 rows (escrow, distributor, revenue_monitor) |
| Operator wallet approved on factory | ✅ Met | Verified via Hardhat console: `approvedOperators(deployer) = true` |

**All 4 exit criteria are satisfied.**

---

## Quality Issues (Fix Before Next Sprint)

### Q1: `deploy-offering.tsx` — Race condition in receipt processing (Medium)

Lines 96–141 process the receipt inside the render body (not inside a `useEffect`). The pattern `if (receipt && !deployed && !saving)` runs on every render and triggers side effects (fetch, setState). This can cause double-fires in React Strict Mode (dev) or if a parent re-renders.

**Fix:** Move receipt processing into a `useEffect` with `[receipt]` dependency.

### Q2: `/api/offerings/[id]/contracts` — No address format validation (Low)

The endpoint accepts `escrow_address`, `share_token_address`, `distributor_address` from the request body but doesn't validate they are valid Ethereum addresses (0x-prefixed, 42 chars). Malformed data could be stored.

**Fix:** Add `isAddress()` check from viem before saving.

### Q3: `/api/cron` — `res.json()` can throw on non-JSON 500 responses (Low)

Line 54 calls `await res.json()` on the sub-endpoint response. If a sub-endpoint crashes with an HTML 500 page (as happened during the missing-env-var issue), this throws "Unexpected end of JSON input" instead of a meaningful error.

**Fix:** Wrap in try/catch or check `Content-Type` header before parsing.

### Q4: `/api/monitor/revenue` — N+1 query in escrow exclusion (Low)

Lines 145–151 run a Supabase query per transfer event to check if the sender is an escrow contract. Under high volume this is O(n) DB calls per cron run.

**Fix:** Pre-fetch all escrow addresses into a Set before the loop. Not urgent until there's real transfer volume.

### Q5: `Dockerfile` — `ARG CACHEBUST=1` is a workaround, not a fix (Info)

The cache-bust ARG works but is a band-aid. The root cause was Railway's Docker layer caching not invalidating on source changes. This ARG will prevent layer caching for the COPY step permanently (slight build slowdown). Monitor and remove if Railway fixes their caching.

---

## Overreach Assessment

The BUILD_REPORT lists substantial "Additional Work (from prior session)" including:
- Factory deploy UI (`deploy-offering.tsx`)
- Contracts API endpoint
- Revenue monitor endpoint
- 10+ canonical documentation files
- Compliance matrix

**Verdict:** This work was done in a prior session, not during this sprint. The current sprint stayed within scope — only the approval script and cron activation were newly executed. The file list is large but the sprint scope was respected. No overreach.

---

## Regression Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Railway reverts to stale build on next push | Medium | High | `railway.json` is now committed; `CACHEBUST` ARG prevents COPY layer caching. Monitor next deploy. |
| Sub-endpoint 500 crashes kill cron silently | Low | Medium | Cron catches errors and returns them in the results array. But `res.json()` failure (Q3) can mask the real error. |
| `deploy-offering.tsx` double-fires save | Low | Low | Race condition (Q1) only triggers in dev/Strict Mode. Production single-renders. But fix is cheap. |

---

## Documentation Issues

| Doc | Issue |
|-----|-------|
| `RULES.md` | Missing rule about Railway deployment via `railway up` CLI vs git push. Both paths exist — which is canonical? |
| `RULES.md` | Missing rule about seeding `indexer_state` when adding new contracts. Builder had to learn this the hard way (full-chain scan). |
| `ARCHITECTURE.md` | Doesn't mention the cron orchestrator pattern (`/api/cron` → calls sub-endpoints). Should be documented under "Flows". |
| `CURRENT_STATE.md` | Says "Needs external cron trigger (every 5 min)" but doesn't document what that trigger should be. |
| `CHANGELOG.md` | Not updated with this sprint's work. |

---

## Should RULES.md be updated?

**Yes.** Add these two rules:

1. **Railway deployment:** "`railway up` deploys from local files. `git push origin main` deploys from git. Use `railway up` if git-triggered builds are stale. `railway.json` configures the Docker build."

2. **Indexer state seeding:** "When adding a new contract to the indexer, seed its `indexer_state` row with a recent block number. Never start from block 0 — BSC RPC rate-limits full-chain scans."

---

## Should ARCHITECTURE.md be updated?

**Yes.** Add to the "Flows" section:

- **Cron pipeline:** `GET /api/cron` → sequentially calls `/api/indexer` (state sync), `/api/indexer/events` (event processing), `/api/monitor/revenue` (FDUSD transfer watch). Auth via `INDEXER_SECRET` query param or header.

---

## Recommended Next Action

1. **Fix Q1** (deploy-offering useEffect) — 5 minutes, prevents subtle bugs
2. **Update RULES.md and ARCHITECTURE.md** per above — 10 minutes
3. **Update CHANGELOG.md** with v0.4.0 entry for this sprint
4. **Then proceed to next sprint:** E2E testnet cycle (C9 in compliance matrix)
