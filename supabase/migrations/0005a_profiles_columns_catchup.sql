-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0005a_profiles_columns_catchup.sql
--
--  Adds every `profiles` column that later migrations and the app runtime
--  assume but which was never created by an earlier migration (schema
--  drift: the columns were originally added via the Supabase dashboard).
--
--  Every statement is idempotent (`add column if not exists`), so this
--  file is safe to re-run on any DB.
-- ════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists full_name      text,
  add column if not exists avatar_url     text,
  add column if not exists bio            text,
  add column if not exists city           text,
  add column if not exists auth_provider  text;

-- ── Admin / moderation flags (referenced by 0007 is_admin() and policies) ──
alter table public.profiles
  add column if not exists is_admin         boolean default false not null,
  add column if not exists is_suspended     boolean default false not null,
  add column if not exists suspended_until  timestamptz,
  add column if not exists suspension_reason text;

-- ── Account type + daily posting limit ──
alter table public.profiles
  add column if not exists account_type       text
    default 'citizen_reporter' not null
    check (account_type in ('reader','citizen_reporter','pro_reporter','journalist')),
  add column if not exists daily_post_limit   integer default 5 not null,
  add column if not exists posts_today        integer default 0 not null;

-- ── Subscription (Pro via Razorpay) ──
alter table public.profiles
  add column if not exists subscription_tier       text
    default 'free' not null
    check (subscription_tier in ('free','pro','press')),
  add column if not exists subscription_expires_at timestamptz;

-- ── Verification flags ──
alter table public.profiles
  add column if not exists is_id_verified         boolean default false not null,
  add column if not exists is_ownership_verified  boolean default false not null,
  add column if not exists is_sentinel_verified   boolean default false not null;

-- ── Journalist / press pass fields ──
alter table public.profiles
  add column if not exists is_journalist_verified          boolean default false not null,
  add column if not exists is_press_pass_paid              boolean default false not null,
  add column if not exists journalist_verification_status  text default 'none' not null
    check (journalist_verification_status in ('none','pending','approved','rejected')),
  add column if not exists press_credential_id             text,
  add column if not exists journalist_employer             text,
  add column if not exists journalist_earnings_inr         numeric(12,2) default 0 not null,
  add column if not exists press_pass_expiry               timestamptz;

-- ── Social graph ──
alter table public.profiles
  add column if not exists followers_count  integer default 0 not null,
  add column if not exists following_count  integer default 0 not null,
  add column if not exists social_links     jsonb default '{}'::jsonb not null;

-- Indexes for frequent admin filters.
create index if not exists profiles_is_admin_idx
  on public.profiles (is_admin) where is_admin = true;
create index if not exists profiles_is_suspended_idx
  on public.profiles (is_suspended) where is_suspended = true;
create index if not exists profiles_journalist_status_idx
  on public.profiles (journalist_verification_status)
  where journalist_verification_status <> 'none';
