-- ACM Initial Schema
-- Agents, Offerings, Shares, Distributions, Operators, Investors

-- Enums
create type agent_status as enum ('pending', 'verified', 'listed', 'suspended');
create type escrow_status as enum ('pending', 'funded', 'released', 'refunded');
create type rail as enum ('fiat', 'crypto');
create type kyc_status as enum ('none', 'pending', 'verified', 'rejected');

-- Operators (agent owners/creators)
create table operators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kyc_status kyc_status not null default 'none',
  stripe_connect_id text,
  wallet_address text,
  reputation_score numeric(4,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- Investors
create table investors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kyc_status kyc_status not null default 'none',
  wallet_address text,
  total_invested numeric(12,2) not null default 0,
  total_earned numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- Agents (AI agents listed on ACM)
create table agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default 'general',
  operator_id uuid not null references operators(id) on delete cascade,
  revenue_source text not null default '',
  monthly_revenue numeric(12,2) not null default 0,
  revenue_verified_at timestamptz,
  verification_days integer not null default 0,
  status agent_status not null default 'pending',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Offerings (fundraising rounds for agents)
create table offerings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  revenue_share_pct numeric(5,2) not null,
  total_shares integer not null,
  shares_sold integer not null default 0,
  price_per_share numeric(10,2) not null,
  min_raise numeric(12,2) not null,
  max_raise numeric(12,2) not null,
  escrow_status escrow_status not null default 'pending',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_share_pct check (revenue_share_pct > 0 and revenue_share_pct <= 50),
  constraint valid_raise check (min_raise > 0 and max_raise >= min_raise),
  constraint valid_shares check (total_shares > 0 and shares_sold >= 0 and shares_sold <= total_shares)
);

-- Shares (investor holdings)
create table shares (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references offerings(id) on delete cascade,
  investor_id uuid not null references investors(id) on delete cascade,
  quantity integer not null,
  purchase_price numeric(10,2) not null,
  rail rail not null,
  token_id text,
  purchased_at timestamptz not null default now(),
  constraint valid_quantity check (quantity > 0)
);

-- Distributions (revenue payouts)
create table distributions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_revenue numeric(12,2) not null,
  platform_fee numeric(12,2) not null,
  operator_amount numeric(12,2) not null,
  investor_amount numeric(12,2) not null,
  distributed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint valid_period check (period_end > period_start),
  constraint valid_amounts check (platform_fee >= 0 and operator_amount >= 0 and investor_amount >= 0)
);

-- Indexes
create index idx_agents_operator on agents(operator_id);
create index idx_agents_status on agents(status);
create index idx_offerings_agent on offerings(agent_id);
create index idx_offerings_escrow on offerings(escrow_status);
create index idx_shares_offering on shares(offering_id);
create index idx_shares_investor on shares(investor_id);
create index idx_distributions_agent on distributions(agent_id);

-- Updated_at triggers
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_operators_updated_at before update on operators for each row execute function update_updated_at();
create trigger set_investors_updated_at before update on investors for each row execute function update_updated_at();
create trigger set_agents_updated_at before update on agents for each row execute function update_updated_at();
create trigger set_offerings_updated_at before update on offerings for each row execute function update_updated_at();

-- Row Level Security
alter table operators enable row level security;
alter table investors enable row level security;
alter table agents enable row level security;
alter table offerings enable row level security;
alter table shares enable row level security;
alter table distributions enable row level security;

-- Operators: users can read all, modify own
create policy "operators_select" on operators for select using (true);
create policy "operators_insert" on operators for insert with check (auth.uid() = user_id);
create policy "operators_update" on operators for update using (auth.uid() = user_id);

-- Investors: users can read all, modify own
create policy "investors_select" on investors for select using (true);
create policy "investors_insert" on investors for insert with check (auth.uid() = user_id);
create policy "investors_update" on investors for update using (auth.uid() = user_id);

-- Agents: public read, operators can modify own
create policy "agents_select" on agents for select using (true);
create policy "agents_insert" on agents for insert with check (
  operator_id in (select id from operators where user_id = auth.uid())
);
create policy "agents_update" on agents for update using (
  operator_id in (select id from operators where user_id = auth.uid())
);

-- Offerings: public read
create policy "offerings_select" on offerings for select using (true);

-- Shares: investors can see own
create policy "shares_select" on shares for select using (
  investor_id in (select id from investors where user_id = auth.uid())
);

-- Distributions: public read
create policy "distributions_select" on distributions for select using (true);
