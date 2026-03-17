-- =============================================================================
-- Migration 00006: Add revenue_events table
-- Sprint 005: Smart Contract Audit Prep
--
-- PROBLEM: The revenue monitor route (/api/monitor/revenue) writes to a
-- revenue_events table that was never created in any migration. This causes
-- the revenue monitor to fail in production.
-- =============================================================================

CREATE TABLE IF NOT EXISTS revenue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  source text NOT NULL,            -- 'on_chain', 'stripe', 'manual'
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'FDUSD',
  source_tx_id text,               -- on-chain tx hash or Stripe payment ID
  verified boolean NOT NULL DEFAULT false,
  event_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Unique on source_tx_id to prevent duplicate event processing (same pattern as on_chain_events)
CREATE UNIQUE INDEX idx_revenue_events_tx ON revenue_events(source_tx_id) WHERE source_tx_id IS NOT NULL;
CREATE INDEX idx_revenue_events_agent ON revenue_events(agent_id);

-- RLS: public read (revenue data is displayed on agent pages), service-role writes only
-- The revenue monitor uses service-role key, so no INSERT policy is needed for anon/authenticated.
ALTER TABLE revenue_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revenue_events_select" ON revenue_events FOR SELECT USING (true);
CREATE POLICY "revenue_events_no_delete" ON revenue_events FOR DELETE USING (false);
