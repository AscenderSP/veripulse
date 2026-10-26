-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0006_master_transactions_and_bounties.sql
--  1. Unified Master Transaction DB Ledger for all financial events.
--  2. 2-Hour Bounty Expiration enforcement.
--  3. 24-Hour Bounty Leaderboard Cycles & Historical Archive.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Unified Master Transaction Ledger ────────────────────────────────
create table if not exists public.master_transactions (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references public.profiles(id) on delete cascade not null,
  type              text not null, -- 'bounty_reward', 'bounty_creation', 'sentinel_dividend', 'journalist_reward', 'upi_withdrawal', 'upi_reversal', 'voucher_redemption', 'affiliate_commission', 'referral_bonus', 'consensus_vote'
  delta_inr         numeric(12,2) not null,
  delta_vp          numeric(12,2) not null,
  balance_after_inr numeric(12,2) not null default 0,
  balance_after_vp  numeric(12,2) not null default 0,
  status            text not null default 'settled', -- 'settled', 'pending', 'reversed', 'failed'
  description       text not null,
  reference_id      text,
  metadata          jsonb default '{}'::jsonb,
  created_at        timestamptz default now() not null
);

create index if not exists master_tx_user_created on public.master_transactions (user_id, created_at desc);
create index if not exists master_tx_type on public.master_transactions (type, created_at desc);

alter table public.master_transactions enable row level security;
drop policy if exists "Users read own transactions" on public.master_transactions;
create policy "Users read own transactions" on public.master_transactions
  for select using (auth.uid() = user_id);

-- ─── 2. Bounties Table (Strict 2-Hour Expiration) ─────────────────────────
create table if not exists public.bounties (
  id              uuid default gen_random_uuid() primary key,
  title           text not null,
  description     text not null,
  type            text not null,
  reward_inr      numeric(12,2) not null,
  reward_vp       numeric(12,2) not null,
  creator_id      uuid references public.profiles(id) on delete set null,
  claimed_by      uuid references public.profiles(id) on delete set null,
  location        text,
  lat             double precision,
  lng             double precision,
  radius_km       numeric,
  product_id      text,
  proof_required  text not null,
  status          text not null default 'open', -- 'open', 'claimed', 'completed', 'expired'
  created_at      timestamptz default now() not null,
  expires_at      timestamptz default (now() + interval '2 hours') not null
);

create index if not exists bounties_status_expires on public.bounties (status, expires_at);
alter table public.bounties enable row level security;
drop policy if exists "Public read bounties" on public.bounties;
create policy "Public read bounties" on public.bounties for select using (true);

-- Function to fetch active bounties with automatic 2-hour expiration
create or replace function public.get_active_bounties()
returns setof public.bounties
language sql stable security invoker set search_path = public as $$
  select * from public.bounties
   where status = 'open'
     and expires_at > now()
   order by created_at desc;
$$;

-- ─── 3. 24-Hour Bounty Leaderboard Cycles (Active & Past Archive) ─────────
create table if not exists public.bounty_leaderboard_cycles (
  id                      uuid default gen_random_uuid() primary key,
  cycle_number            int not null,
  cycle_name              text not null,
  cycle_date              date not null,
  starts_at               timestamptz not null,
  ends_at                 timestamptz not null, -- 24 hours after starts_at
  status                  text not null default 'active', -- 'active', 'archived'
  total_bounties          int default 0,
  total_vp_distributed   numeric(12,2) default 0,
  total_inr_distributed  numeric(12,2) default 0,
  podium_winners          jsonb default '[]'::jsonb,
  rankings                jsonb default '[]'::jsonb,
  created_at              timestamptz default now() not null
);

create index if not exists bounty_cycles_status on public.bounty_leaderboard_cycles (status, cycle_date desc);
alter table public.bounty_leaderboard_cycles enable row level security;
drop policy if exists "Public read leaderboard cycles" on public.bounty_leaderboard_cycles;
create policy "Public read leaderboard cycles" on public.bounty_leaderboard_cycles for select using (true);

-- ─── 4. Master Transaction Recording RPC ─────────────────────────────────
create or replace function public.record_master_transaction(
  p_user_id      uuid,
  p_type         text,
  p_delta_inr    numeric,
  p_delta_vp     numeric,
  p_description  text,
  p_reference_id text default null,
  p_metadata     jsonb default '{}'::jsonb,
  p_status       text default 'settled'
)
returns public.master_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_cur_inr numeric(12,2);
  v_cur_vp  numeric(12,2);
  v_new_tx  public.master_transactions;
begin
  select coalesce(wallet_balance_inr, 0)
    into v_cur_inr
    from public.profiles
   where id = p_user_id;

  v_cur_inr := coalesce(v_cur_inr, 0) + p_delta_inr;
  v_cur_vp  := v_cur_inr * 10;

  update public.profiles
     set wallet_balance_inr = greatest(0, v_cur_inr)
   where id = p_user_id;

  insert into public.master_transactions (
    user_id, type, delta_inr, delta_vp,
    balance_after_inr, balance_after_vp,
    status, description, reference_id, metadata, created_at
  ) values (
    p_user_id, p_type, p_delta_inr, p_delta_vp,
    greatest(0, v_cur_inr), greatest(0, v_cur_vp),
    p_status, p_description, p_reference_id, p_metadata, now()
  )
  returning * into v_new_tx;

  return v_new_tx;
end $$;

grant execute on function public.record_master_transaction to service_role;
grant execute on function public.get_active_bounties to anon, authenticated;
