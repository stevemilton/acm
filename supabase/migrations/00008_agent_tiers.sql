-- Add revenue tier to agents for pre-revenue, early-revenue, and verified listings

-- New enum for revenue tier
create type revenue_tier as enum ('pre_revenue', 'early_revenue', 'verified');

-- Add tier and traction fields to agents
alter table agents
  add column revenue_tier revenue_tier not null default 'pre_revenue',
  add column demo_url text,
  add column active_users integer not null default 0,
  add column pitch text not null default '';

-- Allow pre-revenue agents to be listed (previously required verified status)
-- monthly_revenue default is already 0, which is fine for pre-revenue

-- Update agent_status: add 'listed' for pre-revenue agents that are approved
-- (no change needed — 'listed' already exists and can be used for any tier)

-- Index on tier for filtering
create index idx_agents_tier on agents(revenue_tier);
