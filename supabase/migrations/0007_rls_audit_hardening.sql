-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0007_rls_audit_hardening.sql
--  · Row-level security on every user-facing table
--  · Immutable admin_actions audit log (writes only via service role)
--  · is_admin() SQL helper used by policies
--  · Daily post counter reset function
--  · Rate-limit buckets table for /api/admin/*
-- ════════════════════════════════════════════════════════════════════════

-- ─── Helpers ─────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles
     where id = auth.uid()
       and coalesce(is_admin, false) = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ─── Audit log ───────────────────────────────────────────────────────────
create table if not exists public.admin_actions (
  id            uuid default gen_random_uuid() primary key,
  actor_id      uuid references public.profiles(id) on delete set null,
  actor_email   text,
  action        text not null,                         -- takedown | restore | suspend | ...
  target_table  text not null,                         -- stories | profiles | ...
  target_id     text not null,                         -- target primary key as text
  reason        text,
  before_data   jsonb,
  after_data    jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz default now() not null
);
create index if not exists admin_actions_actor on public.admin_actions (actor_id, created_at desc);
create index if not exists admin_actions_target on public.admin_actions (target_table, target_id, created_at desc);
create index if not exists admin_actions_created on public.admin_actions (created_at desc);

alter table public.admin_actions enable row level security;

-- Only admins can read the log; nobody can write via the API — writes go
-- through the service-role client exclusively.
drop policy if exists admin_actions_select on public.admin_actions;
create policy admin_actions_select on public.admin_actions
  for select
  to authenticated
  using (public.is_admin());

-- No insert/update/delete policy exists → every write from an anon or
-- authenticated client is rejected. Service-role bypasses RLS.

-- ─── Rate-limit buckets ──────────────────────────────────────────────────
-- Token-bucket style: 1 row per (actor_id, bucket). The admin middleware
-- increments on each request; a timestamp older than window_seconds resets
-- the count.
create table if not exists public.admin_rate_limits (
  actor_id         uuid references public.profiles(id) on delete cascade not null,
  bucket           text not null,
  window_started   timestamptz default now() not null,
  request_count    integer default 0 not null,
  primary key (actor_id, bucket)
);
alter table public.admin_rate_limits enable row level security;
drop policy if exists admin_rate_limits_select on public.admin_rate_limits;
create policy admin_rate_limits_select on public.admin_rate_limits
  for select
  to authenticated
  using (actor_id = auth.uid() or public.is_admin());

-- ─── Daily post counter reset ────────────────────────────────────────────
alter table public.profiles
  add column if not exists posts_today integer default 0 not null,
  add column if not exists posts_counter_reset_at timestamptz;

create or replace function public.reset_daily_post_counters()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  update public.profiles
     set posts_today = 0,
         posts_counter_reset_at = now()
   where posts_counter_reset_at is null
      or posts_counter_reset_at < (now() - interval '24 hours');
  get diagnostics touched = row_count;
  return touched;
end;
$$;
revoke all on function public.reset_daily_post_counters() from public;

-- ─── RLS on core tables ──────────────────────────────────────────────────
-- profiles: a user reads/updates their own row; admins read/update any.
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select
  to authenticated
  using (true);                                -- public profile fields
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- A user cannot escalate privilege or clear their own suspension.
    and coalesce(is_admin,       false) = (select coalesce(p.is_admin,       false) from public.profiles p where p.id = auth.uid())
    and coalesce(is_suspended,   false) = (select coalesce(p.is_suspended,   false) from public.profiles p where p.id = auth.uid())
  );
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- stories: everyone reads non-quarantined / non-taken-down; author writes
-- their own; admin writes anything.
alter table public.stories enable row level security;
drop policy if exists stories_select on public.stories;
create policy stories_select on public.stories
  for select
  to anon, authenticated
  using (
    coalesce(admin_taken_down, false) = false
    and coalesce(rollout_stage, 'public') <> 'quarantined'
  );
drop policy if exists stories_author_read_own on public.stories;
create policy stories_author_read_own on public.stories
  for select
  to authenticated
  using (author_id = auth.uid() or public.is_admin());
drop policy if exists stories_insert_self on public.stories;
create policy stories_insert_self on public.stories
  for insert
  to authenticated
  with check (author_id = auth.uid());
drop policy if exists stories_update_self on public.stories;
create policy stories_update_self on public.stories
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
drop policy if exists stories_admin_write on public.stories;
create policy stories_admin_write on public.stories
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- votes: insert as self only; read all.
alter table public.votes enable row level security;
drop policy if exists votes_select on public.votes;
create policy votes_select on public.votes
  for select to anon, authenticated using (true);
drop policy if exists votes_insert_self on public.votes;
create policy votes_insert_self on public.votes
  for insert to authenticated with check (voter_id = auth.uid());

-- product_reviews: insert as self only; read all; update own only.
alter table public.product_reviews enable row level security;
drop policy if exists product_reviews_select on public.product_reviews;
create policy product_reviews_select on public.product_reviews
  for select to anon, authenticated using (true);
drop policy if exists product_reviews_insert_self on public.product_reviews;
create policy product_reviews_insert_self on public.product_reviews
  for insert to authenticated with check (reviewer_id = auth.uid());
drop policy if exists product_reviews_update_self on public.product_reviews;
create policy product_reviews_update_self on public.product_reviews
  for update to authenticated using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());

-- notifications: user reads own; writes via service role only.
alter table public.notifications enable row level security;
drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- story_reads: user adds their own; no update.
alter table public.story_reads enable row level security;
drop policy if exists story_reads_select on public.story_reads;
create policy story_reads_select on public.story_reads
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists story_reads_insert_self on public.story_reads;
create policy story_reads_insert_self on public.story_reads
  for insert to authenticated with check (user_id = auth.uid());

-- products: public read; writes only through service role.
alter table public.products enable row level security;
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to anon, authenticated using (true);

-- verification_flags: admin-only (service role writes).
alter table public.verification_flags enable row level security;
drop policy if exists verification_flags_select on public.verification_flags;
create policy verification_flags_select on public.verification_flags
  for select to authenticated using (public.is_admin());

-- ─── Grants on new objects ───────────────────────────────────────────────
grant select on public.admin_actions to authenticated;
grant select on public.admin_rate_limits to authenticated;
