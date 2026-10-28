-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0009_webhooks_push_digilocker.sql
--  · razorpay_webhook_events: idempotency ledger
--  · digilocker_sessions: short-lived state for DigiLocker OAuth
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.razorpay_webhook_events (
  event_id    text primary key,
  event       text,
  payload     jsonb,
  received_at timestamptz default now() not null
);
alter table public.razorpay_webhook_events enable row level security;
drop policy if exists razorpay_webhook_events_admin on public.razorpay_webhook_events;
create policy razorpay_webhook_events_admin on public.razorpay_webhook_events
  for select to authenticated using (public.is_admin());

create table if not exists public.digilocker_sessions (
  state_token text primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  created_at  timestamptz default now() not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  nonce       text not null
);
create index if not exists digilocker_sessions_user on public.digilocker_sessions (user_id, created_at desc);
alter table public.digilocker_sessions enable row level security;
drop policy if exists digilocker_sessions_self on public.digilocker_sessions;
create policy digilocker_sessions_self on public.digilocker_sessions
  for select to authenticated using (user_id = auth.uid());

-- Trim expired/consumed state tokens hourly.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('vp-trim-digilocker') where exists (
      select 1 from cron.job where jobname = 'vp-trim-digilocker'
    );
    perform cron.schedule(
      'vp-trim-digilocker',
      '0 * * * *',
      $cron$delete from public.digilocker_sessions where expires_at < now() - interval '7 days';$cron$
    );
  end if;
end$$;
