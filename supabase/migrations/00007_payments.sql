-- Fiserv IPG payment tracking for fiat share purchases

create type payment_status as enum (
  'pending',
  'tokenized',
  'requires_3ds',
  'authorized',
  'captured',
  'declined',
  'error',
  'refunded'
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references offerings(id),
  investor_id uuid not null references investors(id),
  quantity integer not null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  status payment_status not null default 'pending',

  -- Fiserv identifiers
  fiserv_order_id text,
  fiserv_ipg_tx_id text,
  fiserv_session_id text,

  -- Card info (from tokenization)
  card_last4 text,
  card_brand text,
  payment_token text,

  -- 3DS state
  three_ds_type text,
  three_ds_data jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payments_offering on payments(offering_id);
create index idx_payments_investor on payments(investor_id);
create index idx_payments_status on payments(status);
create index idx_payments_fiserv_order on payments(fiserv_order_id);

-- RLS: investors can read own payments
alter table payments enable row level security;

create policy "payments_select" on payments
  for select using (
    investor_id in (select id from investors where user_id = auth.uid())
  );

-- No direct insert/update/delete from client — all via API routes with service role
create policy "payments_deny_insert" on payments
  for insert with check (false);

create policy "payments_deny_update" on payments
  for update using (false);

create policy "payments_deny_delete" on payments
  for delete using (false);
