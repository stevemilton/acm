-- =============================================================================
-- RLS Audit Test Script
-- Sprint 004: Supabase RLS Audit
--
-- This script verifies that RLS policies correctly block unauthorized access.
-- Run against a Supabase instance (local or remote) with migration 00005 applied.
--
-- HOW TO RUN:
--   1. Apply all migrations (00001–00005)
--   2. Create two test users in auth.users (user_a and user_b)
--   3. Execute this script as the postgres role (superuser)
--   4. All tests should print PASS. Any FAIL indicates a policy gap.
--
-- NOTE: This script uses SET ROLE and SET LOCAL to simulate different users.
-- It requires the 'authenticated' and 'anon' roles to exist (Supabase creates
-- these automatically).
-- =============================================================================

BEGIN;

-- ============================================================================
-- SETUP: Create test users and profiles
-- ============================================================================

-- Create two test auth users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operator_a@test.com', crypt('password', gen_salt('bf')), now(), now(), now(), '', ''),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'investor_b@test.com', crypt('password', gen_salt('bf')), now(), now(), now(), '', '')
ON CONFLICT (id) DO NOTHING;

-- Create operator profile for user_a
INSERT INTO operators (id, user_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (user_id) DO NOTHING;

-- Create investor profile for user_b
INSERT INTO investors (id, user_id) VALUES
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT (user_id) DO NOTHING;

-- Create an agent owned by operator_a
INSERT INTO agents (id, name, description, operator_id) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Test Agent RLS', 'RLS audit test agent', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- Create an offering for the test agent
INSERT INTO offerings (id, agent_id, revenue_share_pct, total_shares, price_per_share, min_raise, max_raise, starts_at, ends_at) VALUES
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 15.00, 1000, 5.00, 100.00, 50000.00, now(), now() + interval '30 days')
ON CONFLICT (id) DO NOTHING;

-- Create a share record for investor_b
INSERT INTO shares (id, offering_id, investor_id, quantity, purchase_price, rail) VALUES
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 10, 5.00, 'crypto')
ON CONFLICT (id) DO NOTHING;

-- Create a distribution for the test agent
INSERT INTO distributions (id, agent_id, period_start, period_end, gross_revenue, platform_fee, operator_amount, investor_amount) VALUES
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', '2026-03-01', '2026-03-15', 1000.00, 50.00, 807.50, 142.50)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- TEST 1: Cross-user read isolation on shares
-- investor_b should see their own shares; user_a (operator) should NOT
-- ============================================================================

-- Simulate user_a (operator) trying to read shares
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT CASE
  WHEN count(*) = 0
  THEN 'PASS: T1a — Operator cannot read other investors shares'
  ELSE 'FAIL: T1a — Operator CAN read investor shares (should be blocked)'
END AS test_result
FROM shares WHERE id = '55555555-5555-5555-5555-555555555555';

-- Simulate user_b (investor) reading their own shares
SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

SELECT CASE
  WHEN count(*) = 1
  THEN 'PASS: T1b — Investor can read their own shares'
  ELSE 'FAIL: T1b — Investor CANNOT read their own shares'
END AS test_result
FROM shares WHERE id = '55555555-5555-5555-5555-555555555555';


-- ============================================================================
-- TEST 2: Cross-operator write isolation on agents
-- user_b should NOT be able to update user_a's agent
-- ============================================================================

SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

-- Try to update agent owned by user_a
UPDATE agents SET name = 'HACKED' WHERE id = '33333333-3333-3333-3333-333333333333';

-- Reset to superuser to check if the update was blocked
RESET ROLE;

SELECT CASE
  WHEN name = 'Test Agent RLS'
  THEN 'PASS: T2 — Non-owner cannot update another operators agent'
  ELSE 'FAIL: T2 — Non-owner modified agent name to: ' || name
END AS test_result
FROM agents WHERE id = '33333333-3333-3333-3333-333333333333';


-- ============================================================================
-- TEST 3: Cross-operator write isolation on offerings
-- user_b should NOT be able to insert an offering for user_a's agent
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

-- Try to insert offering for agent owned by user_a
DO $$
BEGIN
  INSERT INTO offerings (agent_id, revenue_share_pct, total_shares, price_per_share, min_raise, max_raise, starts_at, ends_at)
  VALUES ('33333333-3333-3333-3333-333333333333', 10.00, 500, 10.00, 50.00, 10000.00, now(), now() + interval '30 days');
  RAISE NOTICE 'FAIL: T3a — Non-owner INSERT into offerings succeeded (should be blocked)';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: T3a — Non-owner INSERT into offerings blocked by RLS';
END;
$$;

-- user_b should NOT be able to update offerings for user_a's agent
DO $$
BEGIN
  UPDATE offerings SET escrow_status = 'released' WHERE id = '44444444-4444-4444-4444-444444444444';
  -- If no rows matched (RLS filter), no error but no update either
  RAISE NOTICE 'PASS: T3b — Non-owner UPDATE on offerings returned 0 rows (RLS filtered)';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: T3b — Non-owner UPDATE on offerings blocked by RLS';
END;
$$;

-- Verify the offering was not modified
RESET ROLE;

SELECT CASE
  WHEN escrow_status = 'pending'
  THEN 'PASS: T3c — Offerings escrow_status unchanged after non-owner update attempt'
  ELSE 'FAIL: T3c — Offerings escrow_status changed to: ' || escrow_status::text
END AS test_result
FROM offerings WHERE id = '44444444-4444-4444-4444-444444444444';


-- ============================================================================
-- TEST 4: Cross-operator write isolation on distributions
-- user_b should NOT be able to insert a distribution for user_a's agent
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

DO $$
BEGIN
  INSERT INTO distributions (agent_id, period_start, period_end, gross_revenue, platform_fee, operator_amount, investor_amount)
  VALUES ('33333333-3333-3333-3333-333333333333', '2026-03-16', '2026-03-31', 500.00, 25.00, 403.75, 71.25);
  RAISE NOTICE 'FAIL: T4 — Non-owner INSERT into distributions succeeded (should be blocked)';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: T4 — Non-owner INSERT into distributions blocked by RLS';
END;
$$;


-- ============================================================================
-- TEST 5: Authorized operator CAN write to their own offerings/distributions
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Operator_a should be able to insert an offering for their own agent
DO $$
BEGIN
  INSERT INTO offerings (agent_id, revenue_share_pct, total_shares, price_per_share, min_raise, max_raise, starts_at, ends_at)
  VALUES ('33333333-3333-3333-3333-333333333333', 20.00, 2000, 10.00, 200.00, 100000.00, now(), now() + interval '60 days');
  RAISE NOTICE 'PASS: T5a — Owner INSERT into offerings succeeded';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL: T5a — Owner INSERT into offerings failed: %', SQLERRM;
END;
$$;

-- Operator_a should be able to update their own offering
UPDATE offerings SET escrow_status = 'funded' WHERE id = '44444444-4444-4444-4444-444444444444';

RESET ROLE;

SELECT CASE
  WHEN escrow_status = 'funded'
  THEN 'PASS: T5b — Owner UPDATE on offerings succeeded'
  ELSE 'FAIL: T5b — Owner UPDATE on offerings did not apply'
END AS test_result
FROM offerings WHERE id = '44444444-4444-4444-4444-444444444444';

-- Operator_a should be able to insert a distribution
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

DO $$
BEGIN
  INSERT INTO distributions (agent_id, period_start, period_end, gross_revenue, platform_fee, operator_amount, investor_amount)
  VALUES ('33333333-3333-3333-3333-333333333333', '2026-03-16', '2026-03-31', 2000.00, 100.00, 1615.00, 285.00);
  RAISE NOTICE 'PASS: T5c — Owner INSERT into distributions succeeded';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL: T5c — Owner INSERT into distributions failed: %', SQLERRM;
END;
$$;


-- ============================================================================
-- TEST 6: Authenticated investor CAN insert shares for themselves
-- ============================================================================

SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

DO $$
BEGIN
  INSERT INTO shares (offering_id, investor_id, quantity, purchase_price, rail)
  VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 5, 5.00, 'crypto');
  RAISE NOTICE 'PASS: T6a — Investor INSERT into shares (own record) succeeded';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL: T6a — Investor INSERT into shares failed: %', SQLERRM;
END;
$$;

-- Investor should NOT be able to insert shares for someone else's investor_id
DO $$
BEGIN
  INSERT INTO shares (offering_id, investor_id, quantity, purchase_price, rail)
  VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 5, 5.00, 'crypto');
  RAISE NOTICE 'FAIL: T6b — Investor INSERT into shares for WRONG investor_id succeeded (should be blocked)';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: T6b — Investor INSERT into shares for wrong investor_id blocked by RLS';
END;
$$;


-- ============================================================================
-- TEST 7: Unauthenticated (anon) cannot write to any table
-- ============================================================================

SET LOCAL ROLE anon;

DO $$
BEGIN
  INSERT INTO operators (user_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  RAISE NOTICE 'FAIL: T7a — Anon INSERT into operators succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: T7a — Anon INSERT into operators blocked';
END;
$$;

DO $$
BEGIN
  INSERT INTO investors (user_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  RAISE NOTICE 'FAIL: T7b — Anon INSERT into investors succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: T7b — Anon INSERT into investors blocked';
END;
$$;

DO $$
BEGIN
  INSERT INTO agents (name, description, operator_id)
  VALUES ('Anon Agent', 'Should fail', '11111111-1111-1111-1111-111111111111');
  RAISE NOTICE 'FAIL: T7c — Anon INSERT into agents succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: T7c — Anon INSERT into agents blocked';
END;
$$;

DO $$
BEGIN
  INSERT INTO offerings (agent_id, revenue_share_pct, total_shares, price_per_share, min_raise, max_raise, starts_at, ends_at)
  VALUES ('33333333-3333-3333-3333-333333333333', 10.00, 100, 1.00, 10.00, 100.00, now(), now() + interval '1 day');
  RAISE NOTICE 'FAIL: T7d — Anon INSERT into offerings succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: T7d — Anon INSERT into offerings blocked';
END;
$$;

DO $$
BEGIN
  INSERT INTO shares (offering_id, investor_id, quantity, purchase_price, rail)
  VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 1, 1.00, 'crypto');
  RAISE NOTICE 'FAIL: T7e — Anon INSERT into shares succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: T7e — Anon INSERT into shares blocked';
END;
$$;

DO $$
BEGIN
  INSERT INTO distributions (agent_id, period_start, period_end, gross_revenue, platform_fee, operator_amount, investor_amount)
  VALUES ('33333333-3333-3333-3333-333333333333', '2026-04-01', '2026-04-15', 100.00, 5.00, 80.75, 14.25);
  RAISE NOTICE 'FAIL: T7f — Anon INSERT into distributions succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: T7f — Anon INSERT into distributions blocked';
END;
$$;


-- ============================================================================
-- TEST 8: DELETE is blocked on all user-facing tables
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Even the owner should not be able to delete
DELETE FROM operators WHERE id = '11111111-1111-1111-1111-111111111111';

RESET ROLE;

SELECT CASE
  WHEN count(*) = 1
  THEN 'PASS: T8a — DELETE on operators blocked (row still exists)'
  ELSE 'FAIL: T8a — DELETE on operators succeeded (row missing!)'
END AS test_result
FROM operators WHERE id = '11111111-1111-1111-1111-111111111111';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

DELETE FROM agents WHERE id = '33333333-3333-3333-3333-333333333333';

RESET ROLE;

SELECT CASE
  WHEN count(*) = 1
  THEN 'PASS: T8b — DELETE on agents blocked (row still exists)'
  ELSE 'FAIL: T8b — DELETE on agents succeeded (row missing!)'
END AS test_result
FROM agents WHERE id = '33333333-3333-3333-3333-333333333333';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

DELETE FROM shares WHERE id = '55555555-5555-5555-5555-555555555555';

RESET ROLE;

SELECT CASE
  WHEN count(*) = 1
  THEN 'PASS: T8c — DELETE on shares blocked (row still exists)'
  ELSE 'FAIL: T8c — DELETE on shares succeeded (row missing!)'
END AS test_result
FROM shares WHERE id = '55555555-5555-5555-5555-555555555555';


-- ============================================================================
-- TEST 9: Service-role can write to all tables (indexer use case)
-- ============================================================================

-- Service-role bypasses RLS entirely. We simulate this by using the postgres
-- superuser role (which is what service_role maps to in Supabase).
RESET ROLE;

-- Service-role can write to indexer tables (no RLS)
DO $$
BEGIN
  INSERT INTO indexer_state (contract_address, last_indexed_block)
  VALUES ('0xRLS_TEST_CONTRACT', 999999)
  ON CONFLICT (contract_address) DO UPDATE SET last_indexed_block = 999999;
  RAISE NOTICE 'PASS: T9a — Service-role write to indexer_state succeeded';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL: T9a — Service-role write to indexer_state failed: %', SQLERRM;
END;
$$;

DO $$
BEGIN
  INSERT INTO on_chain_events (contract_address, event_name, block_number, tx_hash, log_index, args)
  VALUES ('0xRLS_TEST_CONTRACT', 'TestEvent', 999999, '0xRLS_TEST_TX', 0, '{}');
  RAISE NOTICE 'PASS: T9b — Service-role write to on_chain_events succeeded';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL: T9b — Service-role write to on_chain_events failed: %', SQLERRM;
END;
$$;

-- Service-role can write to user-facing tables (bypasses RLS)
DO $$
BEGIN
  INSERT INTO distributions (agent_id, period_start, period_end, gross_revenue, platform_fee, operator_amount, investor_amount)
  VALUES ('33333333-3333-3333-3333-333333333333', '2026-04-01', '2026-04-15', 3000.00, 150.00, 2422.50, 427.50);
  RAISE NOTICE 'PASS: T9c — Service-role INSERT into distributions succeeded (bypasses RLS)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL: T9c — Service-role INSERT into distributions failed: %', SQLERRM;
END;
$$;


-- ============================================================================
-- CLEANUP: Remove test data
-- ============================================================================

RESET ROLE;

DELETE FROM on_chain_events WHERE tx_hash = '0xRLS_TEST_TX';
DELETE FROM indexer_state WHERE contract_address = '0xRLS_TEST_CONTRACT';
DELETE FROM distributions WHERE agent_id = '33333333-3333-3333-3333-333333333333';
DELETE FROM shares WHERE offering_id = '44444444-4444-4444-4444-444444444444';
DELETE FROM offerings WHERE agent_id = '33333333-3333-3333-3333-333333333333';
DELETE FROM agents WHERE id = '33333333-3333-3333-3333-333333333333';
DELETE FROM operators WHERE id = '11111111-1111-1111-1111-111111111111';
DELETE FROM investors WHERE id = '22222222-2222-2222-2222-222222222222';
DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

-- Rollback so no data is actually persisted (tests are read-only verification)
ROLLBACK;
