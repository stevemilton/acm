-- Increment investor total_invested atomically
create or replace function increment_investor_invested(investor_id uuid, amount numeric)
returns void as $$
begin
  update investors
  set total_invested = total_invested + amount
  where id = investor_id;
end;
$$ language plpgsql security definer;

-- Increment investor total_earned atomically
create or replace function increment_investor_earned(investor_id uuid, amount numeric)
returns void as $$
begin
  update investors
  set total_earned = total_earned + amount
  where id = investor_id;
end;
$$ language plpgsql security definer;

-- Increment offering shares_sold atomically
create or replace function increment_shares_sold(offering_id uuid, quantity integer)
returns void as $$
begin
  update offerings
  set shares_sold = shares_sold + quantity
  where id = offering_id
  and shares_sold + quantity <= total_shares;
end;
$$ language plpgsql security definer;
