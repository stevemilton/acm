# Sprint: Unblock Factory Deploy + Activate Cron

**Goal:** Close the two blockers that prevent E2E testing — operator approval and indexer automation.

**Confidence:** High. Both are small, well-defined tasks with no unknowns.

**Matrix rows:** S2 (Missing → Complete), I4 (Missing → Complete), C2 (Partial → Complete)

## Task 1: Factory Operator Approval Script

**File:** `contracts/scripts/approve-operator.ts` (new)

Write a Hardhat script that:
1. Reads operator address from CLI arg or env var
2. Calls `OfferingFactory.setApprovedOperator(address, true)`
3. Logs confirmation

Run it for the deployer wallet (`0x598B84b07126D8D85Ce1088Eff2C02180F710260`) so it can also act as test operator.

**Acceptance:** Script runs, operator can call `createOffering` on factory.

## Task 2: Activate Indexer Cron

1. Set `INDEXER_SECRET` env var in Railway dashboard
2. Create a Railway cron service OR document a `curl` cron command for external cron
3. Verify: call `GET /api/cron?key=<secret>`, confirm `indexer_state` rows created in Supabase

**Acceptance:** Cron endpoint returns 200 with results. `indexer_state` table has entries.

## Exit Criteria

- [ ] `approve-operator.ts` script exists and has been run on testnet
- [ ] `INDEXER_SECRET` set in Railway
- [ ] `/api/cron` returns 200 and populates `indexer_state`
- [ ] Operator wallet approved on factory (verified via `approvedOperators` read)

## Out of Scope

- E2E test (next sprint — depends on this sprint completing)
- Hardhat unit tests (separate sprint)
- RLS audit (separate sprint)
- Any UI changes
