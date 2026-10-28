-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0008_logs_push_cron.sql
--  · app_logs + app_events: own error / event pipeline (Sentry-shaped)
--  · push_tokens: Capacitor FCM/APNs device tokens for push delivery
--  · pg_cron schedules: reset_daily_post_counters + stat rebuild
-- ════════════════════════════════════════════════════════════════════════

-- ─── Error + event logs (own pipeline; replace with Sentry anytime) ──────
create table if not exists public.app_logs (
  id          bigserial primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  level       text not null check (level in ('error', 'warn', 'info')),
  message     text not null,
  stack       text,
  component   text,
  action      text,
  extra       jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz default now() not null
);
create index if not exists app_logs_created on public.app_logs (created_at desc);
create index if not exists app_logs_user    on public.app_logs (user_id, created_at desc);
create index if not exists app_logs_level   on public.app_logs (level, created_at desc);

alter table public.app_logs enable row level security;
drop policy if exists app_logs_admin_select on public.app_logs;
create policy app_logs_admin_select on public.app_logs
  for select to authenticated using (public.is_admin());

create table if not exists public.app_events (
  id          bigserial primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  event       text not null,
  payload     jsonb,
  created_at  timestamptz default now() not null
);
create index if not exists app_events_created on public.app_events (created_at desc);
create index if not exists app_events_event   on public.app_events (event, created_at desc);
create index if not exists app_events_user    on public.app_events (user_id, created_at desc);

alter table public.app_events enable row level security;
drop policy if exists app_events_admin_select on public.app_events;
create policy app_events_admin_select on public.app_events
  for select to authenticated using (public.is_admin());

-- ─── Push tokens (Capacitor native shell) ────────────────────────────────
create table if not exists public.push_tokens (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  token       text not null,
  last_seen_at timestamptz default now() not null,
  created_at  timestamptz default now() not null,
  unique (user_id, token)
);
create index if not exists push_tokens_user on public.push_tokens (user_id, last_seen_at desc);

alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_select_self on public.push_tokens;
create policy push_tokens_select_self on public.push_tokens
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists push_tokens_insert_self on public.push_tokens;
create policy push_tokens_insert_self on public.push_tokens
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists push_tokens_update_self on public.push_tokens;
create policy push_tokens_update_self on public.push_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists push_tokens_delete_self on public.push_tokens;
create policy push_tokens_delete_self on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

-- ─── pg_cron schedules ───────────────────────────────────────────────────
-- Both the extension install and the schedules are idempotent — safe to
-- re-run. The schedules call service-definer functions already granted to
-- the cron role on Supabase.
create extension if not exists pg_cron with schema extensions;

-- Daily post counter reset at 00:00 IST (18:30 UTC).
select cron.unschedule('vp-reset-daily-posts') where exists (
  select 1 from cron.job where jobname = 'vp-reset-daily-posts'
);
select cron.schedule(
  'vp-reset-daily-posts',
  '30 18 * * *',
  $$select public.reset_daily_post_counters();$$
);

-- Trim app_logs older than 30 days every day at 03:00 IST (21:30 UTC).
select cron.unschedule('vp-trim-app-logs') where exists (
  select 1 from cron.job where jobname = 'vp-trim-app-logs'
);
select cron.schedule(
  'vp-trim-app-logs',
  '30 21 * * *',
  $$delete from public.app_logs where created_at < (now() - interval '30 days');$$
);

-- Trim app_events older than 90 days every Sunday at 04:00 IST (22:30 UTC Sat).
select cron.unschedule('vp-trim-app-events') where exists (
  select 1 from cron.job where jobname = 'vp-trim-app-events'
);
select cron.schedule(
  'vp-trim-app-events',
  '30 22 * * 6',
  $$delete from public.app_events where created_at < (now() - interval '90 days');$$
);

-- Reap expired suspensions each hour: a suspended user whose window has
-- passed is automatically unsuspended.
create or replace function public.reap_expired_suspensions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  update public.profiles
     set is_suspended = false,
         suspended_until = null,
         suspension_reason = null
   where is_suspended = true
     and suspended_until is not null
     and suspended_until < now();
  get diagnostics touched = row_count;
  return touched;
end;
$$;
revoke all on function public.reap_expired_suspensions() from public;

select cron.unschedule('vp-reap-suspensions') where exists (
  select 1 from cron.job where jobname = 'vp-reap-suspensions'
);
select cron.schedule(
  'vp-reap-suspensions',
  '0 * * * *',
  $$select public.reap_expired_suspensions();$$
);

-- Platform stats refresh every 15 min (if the view exists from 0004).
do $$
begin
  if exists (
    select 1 from pg_matviews where schemaname = 'public' and matviewname = 'platform_stats'
  ) then
    perform cron.unschedule('vp-refresh-platform-stats') where exists (
      select 1 from cron.job where jobname = 'vp-refresh-platform-stats'
    );
    perform cron.schedule(
      'vp-refresh-platform-stats',
      '*/15 * * * *',
      $cron$refresh materialized view concurrently public.platform_stats;$cron$
    );
  end if;
end$$;
