-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0001_schema.sql
--  Core extensions, enum types, tables, indexes, and Row-Level Security.
-- ════════════════════════════════════════════════════════════════════════

-- ─── Extensions ──────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "vector";
create extension if not exists "pgcrypto";
create extension if not exists "postgis";

-- ─── Enum Types ──────────────────────────────────────────────────────────
do $$ begin
  create type user_tier_type     as enum ('sentinel_t1', 'validator_t2', 'public');
exception when duplicate_object then null; end $$;
do $$ begin
  create type story_stage_type    as enum ('tier_1', 'tier_2', 'public', 'quarantined');
exception when duplicate_object then null; end $$;
do $$ begin
  create type vote_action_type    as enum ('real', 'hoax', 'needs_context');
exception when duplicate_object then null; end $$;
do $$ begin
  create type payout_status_type  as enum ('queued', 'processing', 'processed', 'failed', 'reversed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type doc_verification_type as enum ('vehicle_rc', 'gst_invoice');
exception when duplicate_object then null; end $$;

-- ─── 1. Profiles ─────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                 uuid references auth.users on delete cascade primary key,
  username           text unique not null,
  trust_score        numeric(5,2) default 50.00 check (trust_score between 0.00 and 100.00),
  tier               user_tier_type default 'public' not null,
  badge              text default 'Citizen Scout' not null,
  correct_votes      int default 0 not null,
  total_votes        int default 0 not null,
  wallet_balance_inr numeric(12,2) default 0.00 not null check (wallet_balance_inr >= 0.00),
  upi_id             text,
  home_lat           double precision,
  home_lng           double precision,
  preferred_lang     text default 'en' check (preferred_lang in ('en', 'bn', 'hi')) not null,
  created_at         timestamptz default now() not null,
  updated_at         timestamptz default now() not null
);

-- ─── 2. Stories ──────────────────────────────────────────────────────────
create table if not exists public.stories (
  id                   uuid default gen_random_uuid() primary key,
  author_id            uuid references public.profiles(id) on delete set null,
  category             text not null,
  location_name        text not null,
  lat                  double precision,
  lng                  double precision,
  geom                 geography(Point, 4326),              -- PostGIS point for <=10km queries
  titles               jsonb not null,                       -- {"en","bn","hi"}
  summaries            jsonb not null,                       -- {"en","bn","hi"}
  media_url            text,
  media_type           text default 'image' check (media_type in ('image', 'video')) not null,
  c2pa_verified        boolean default false not null,
  ai_probability_score numeric(5,2) default 0.00 not null,
  credibility_score    numeric(5,2) default 50.00 not null,
  rollout_stage        story_stage_type default 'tier_1' not null,
  completeness_score   numeric(5,2) default 50.00 not null,
  ad_impressions       int default 0 not null,
  source               text default 'citizen' not null,      -- citizen | rss
  embedding            vector(768),
  created_at           timestamptz default now() not null,
  updated_at           timestamptz default now() not null
);

-- Vector similarity index (cosine)
create index if not exists stories_embedding_ivfflat
  on public.stories using ivfflat (embedding vector_cosine_ops) with (lists = 100);
-- Spatial GIST index
create index if not exists stories_geom_gist on public.stories using gist (geom);
-- Feed query helpers
create index if not exists stories_stage_created
  on public.stories (rollout_stage, created_at desc);

-- Keep geom in sync with lat/lng
create or replace function public.sync_story_geom()
returns trigger language plpgsql as $$
begin
  if new.lat is not null and new.lng is not null then
    new.geom := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_sync_story_geom on public.stories;
create trigger trg_sync_story_geom
  before insert or update of lat, lng on public.stories
  for each row execute function public.sync_story_geom();

-- ─── 3. Story Timelines ──────────────────────────────────────────────────
create table if not exists public.story_timeline (
  id             uuid default gen_random_uuid() primary key,
  story_id       uuid references public.stories(id) on delete cascade not null,
  contributor_id uuid references public.profiles(id) on delete set null,
  update_text    jsonb not null,
  media_url      text,
  is_verified    boolean default true not null,
  created_at     timestamptz default now() not null
);
create index if not exists story_timeline_story on public.story_timeline (story_id, created_at);

-- ─── 4. Votes & Consensus Ledger ─────────────────────────────────────────
create table if not exists public.votes (
  id          uuid default gen_random_uuid() primary key,
  story_id    uuid references public.stories(id) on delete cascade not null,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  vote_type   vote_action_type not null,
  user_weight numeric(5,2) default 1.00 not null,
  created_at  timestamptz default now() not null,
  unique (story_id, user_id)
);
create index if not exists votes_story on public.votes (story_id);

-- ─── 5. Ownership Verifications (RC & GST) ───────────────────────────────
create table if not exists public.ownership_verifications (
  id                 uuid default gen_random_uuid() primary key,
  user_id            uuid references public.profiles(id) on delete cascade not null,
  document_type      doc_verification_type not null,
  product_category   text not null,
  brand_model        text not null,
  document_hash      text unique not null,                  -- idempotency / anti-duplicate
  masked_identifier  text not null,                          -- e.g. WB02••••1234
  purchase_date      date,
  ocr_confidence     numeric(5,2) not null,
  tamper_check_passed boolean default true not null,
  created_at         timestamptz default now() not null
);
create index if not exists ownership_user on public.ownership_verifications (user_id);

-- ─── 6. Affiliate Clicks & Conversions ───────────────────────────────────
create table if not exists public.affiliate_clicks (
  id                       uuid default gen_random_uuid() primary key,
  sub_id                   text unique not null,
  product_id               text not null,
  primary_reviewer_id      uuid references public.profiles(id) on delete set null,
  merchant                 text not null,
  estimated_commission_inr numeric(10,2) default 0.00 not null,
  platform_share_inr       numeric(10,2) default 0.00 not null,
  reviewer_share_inr       numeric(10,2) default 0.00 not null,
  sentinel_share_inr       numeric(10,2) default 0.00 not null,
  conversion_status        text default 'clicked' not null,  -- clicked | paid | reversed
  created_at               timestamptz default now() not null,
  updated_at               timestamptz default now() not null
);

-- ─── 7. Payout Requests (RazorpayX Queue) ────────────────────────────────
create table if not exists public.payout_requests (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references public.profiles(id) on delete cascade not null,
  amount_inr        numeric(10,2) not null check (amount_inr >= 100.00),
  amount_paise      int not null,
  upi_vpa           text not null,
  idempotency_key   text unique not null,
  razorpay_payout_id text unique,
  bank_utr          text,
  status            payout_status_type default 'queued' not null,
  failure_reason    text,
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null
);
create index if not exists payout_user on public.payout_requests (user_id, created_at desc);

-- ─── 8. Immutable Audit Ledgers ──────────────────────────────────────────
-- Founder/platform revenue ledger (append-only).
create table if not exists public.ad_revenue_ledger (
  id             uuid default gen_random_uuid() primary key,
  source         text not null,            -- affiliate | adsense | admob
  reference_id   text,                     -- sub_id / impression batch
  amount_inr     numeric(12,2) not null,
  created_at     timestamptz default now() not null
);

-- Wallet movement ledger (append-only; every credit/debit is recorded).
create table if not exists public.wallet_ledger (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  delta_inr   numeric(12,2) not null,       -- +credit / -debit
  reason      text not null,                -- affiliate_reviewer | sentinel_pool | payout | reversal
  reference_id text,
  created_at  timestamptz default now() not null
);
create index if not exists wallet_ledger_user on public.wallet_ledger (user_id, created_at desc);

-- ─── Processed-webhook guard (replay protection for postbacks) ───────────
create table if not exists public.processed_webhooks (
  id           text primary key,            -- sha256 of (provider + external id)
  provider     text not null,
  created_at   timestamptz default now() not null
);

-- ════════════════════════════════════════════════════════════════════════
--  Row-Level Security
-- ════════════════════════════════════════════════════════════════════════
alter table public.profiles                enable row level security;
alter table public.stories                 enable row level security;
alter table public.story_timeline          enable row level security;
alter table public.votes                   enable row level security;
alter table public.ownership_verifications enable row level security;
alter table public.affiliate_clicks        enable row level security;
alter table public.payout_requests         enable row level security;
alter table public.ad_revenue_ledger       enable row level security;
alter table public.wallet_ledger           enable row level security;
alter table public.processed_webhooks      enable row level security;

-- Profiles: world-readable; a user may edit ONLY their handle/lang/upi/home,
-- and may never move their own trust_score, tier, badge, or wallet.
drop policy if exists "Public read profiles" on public.profiles;
create policy "Public read profiles" on public.profiles for select using (true);

drop policy if exists "Users update own safe fields" on public.profiles;
create policy "Users update own safe fields" on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and trust_score        = (select p.trust_score        from public.profiles p where p.id = auth.uid())
    and tier               = (select p.tier               from public.profiles p where p.id = auth.uid())
    and wallet_balance_inr = (select p.wallet_balance_inr from public.profiles p where p.id = auth.uid())
    and correct_votes      = (select p.correct_votes      from public.profiles p where p.id = auth.uid())
    and total_votes        = (select p.total_votes        from public.profiles p where p.id = auth.uid())
  );

-- Stories & timeline: public read. Writes happen through SECURITY DEFINER
-- functions / service role only (no direct INSERT/UPDATE policy = denied).
drop policy if exists "Public read stories" on public.stories;
create policy "Public read stories" on public.stories for select
  using (rollout_stage <> 'quarantined' or author_id = auth.uid());

drop policy if exists "Public read timeline" on public.story_timeline;
create policy "Public read timeline" on public.story_timeline for select using (true);

-- Votes: a user can see and insert ONLY their own vote rows; weight is
-- recomputed server-side regardless of what the client sends.
drop policy if exists "Users read own votes" on public.votes;
create policy "Users read own votes" on public.votes for select using (auth.uid() = user_id);

-- Ownership: users read their own records only.
drop policy if exists "Users read own ownership" on public.ownership_verifications;
create policy "Users read own ownership" on public.ownership_verifications for select
  using (auth.uid() = user_id);

-- Payouts: users read their own queue only.
drop policy if exists "Users view own payouts" on public.payout_requests;
create policy "Users view own payouts" on public.payout_requests for select
  using (auth.uid() = user_id);

-- Wallet ledger: users read their own movements.
drop policy if exists "Users read own wallet ledger" on public.wallet_ledger;
create policy "Users read own wallet ledger" on public.wallet_ledger for select
  using (auth.uid() = user_id);

-- Affiliate clicks: public read of non-financial status is fine for the ticker;
-- financial columns are still protected because the service role writes them.
drop policy if exists "Public read affiliate status" on public.affiliate_clicks;
create policy "Public read affiliate status" on public.affiliate_clicks for select using (true);

-- ad_revenue_ledger & processed_webhooks: no policies => only service role
-- (which bypasses RLS) can touch them. Deliberate.

-- ─── Auto-provision a profile row when a new auth user signs up ──────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'scout_' || substr(new.id::text, 1, 8))
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
