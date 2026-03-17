-- =============================================================================
-- Migration 00005: RLS Audit — Fix missing policies
-- Sprint 004: Supabase RLS Audit
--
-- PROBLEM: offerings, shares, and distributions tables have RLS enabled but
-- are missing INSERT/UPDATE policies. The invest route, contracts route, and
-- distributions route use the anon-key client (RLS-enforced), so all writes
-- to these tables fail silently. Service-role routes (indexer) bypass RLS
-- and are unaffected.
--
-- This migration adds the missing write policies and explicitly blocks DELETE
-- on all user-facing tables.
-- =============================================================================

-- =============================================================================
-- OFFERINGS: INSERT + UPDATE for owning operator
-- =============================================================================

-- Operator can create offerings for their own agents
CREATE POLICY "offerings_insert" ON offerings FOR INSERT WITH CHECK (
  agent_id IN (
    SELECT a.id FROM agents a
    JOIN operators o ON a.operator_id = o.id
    WHERE o.user_id = auth.uid()
  )
);

-- Operator can update offerings for their own agents
-- (contract addresses, escrow_status, shares_sold)
CREATE POLICY "offerings_update" ON offerings FOR UPDATE USING (
  agent_id IN (
    SELECT a.id FROM agents a
    JOIN operators o ON a.operator_id = o.id
    WHERE o.user_id = auth.uid()
  )
);

-- =============================================================================
-- SHARES: INSERT for authenticated investors
-- =============================================================================

-- Authenticated investor can create share records for themselves
-- (investor_id must match the authenticated user's investor record)
CREATE POLICY "shares_insert" ON shares FOR INSERT WITH CHECK (
  investor_id IN (
    SELECT id FROM investors WHERE user_id = auth.uid()
  )
);

-- =============================================================================
-- DISTRIBUTIONS: INSERT for owning operator
-- =============================================================================

-- Operator can create distribution records for their own agents
CREATE POLICY "distributions_insert" ON distributions FOR INSERT WITH CHECK (
  agent_id IN (
    SELECT a.id FROM agents a
    JOIN operators o ON a.operator_id = o.id
    WHERE o.user_id = auth.uid()
  )
);

-- =============================================================================
-- DELETE POLICIES: Explicitly block deletes on all user-facing tables
-- =============================================================================

-- No one can delete operators (only Supabase auth cascade can)
-- RLS enabled + no DELETE policy = DELETE is implicitly denied for anon/user roles.
-- We add explicit deny policies for clarity and defense-in-depth.

-- These policies use a USING clause that always evaluates to false,
-- meaning no rows can ever be selected for deletion.

CREATE POLICY "operators_no_delete" ON operators FOR DELETE USING (false);
CREATE POLICY "investors_no_delete" ON investors FOR DELETE USING (false);
CREATE POLICY "agents_no_delete" ON agents FOR DELETE USING (false);
CREATE POLICY "offerings_no_delete" ON offerings FOR DELETE USING (false);
CREATE POLICY "shares_no_delete" ON shares FOR DELETE USING (false);
CREATE POLICY "distributions_no_delete" ON distributions FOR DELETE USING (false);

-- =============================================================================
-- INDEXER TABLES: No RLS (intentional)
-- =============================================================================
-- indexer_state and on_chain_events do NOT have RLS enabled.
-- Rationale:
--   1. These tables are only accessed by service-role routes (indexer, events,
--      revenue monitor) which use SUPABASE_SERVICE_ROLE_KEY.
--   2. Service-role bypasses RLS regardless.
--   3. No anon-key route ever reads or writes these tables.
--   4. The data is non-sensitive (public blockchain events, block numbers).
--   5. Adding RLS would add complexity with zero security benefit.
--
-- If a future route exposes these tables to end users, add RLS at that time.
-- =============================================================================
