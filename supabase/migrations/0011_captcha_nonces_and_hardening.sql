-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0011_captcha_nonces_and_hardening.sql
--  · One-shot captcha nonces (replay protection for /api/captcha/issue)
--  · Unique state_token on digilocker_sessions (defence in depth)
--  · admin_actions and app_logs retention (DPDP-friendly TTL)
-- ════════════════════════════════════════════════════════════════════════

-- ─── One-shot captcha nonces ─────────────────────────────────────────────
create table if not exists public.captcha_nonces (
  nonce      text primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz default now() not null
);
create index if not exists captcha_nonces_expires
  on public.captcha_nonces (expires_at);

alter table public.captcha_nonces enable row level security;
-- No policies → only service role can touch it. Deliberate.

-- Delete + return in one call; returns the row when the nonce was present
-- and not yet expired. The route handler treats "no row" as a replay/expiry.
create or replace function public.consume_captcha_nonce(p_nonce text)
returns table (nonce text)
language sql
security definer
set search_path = public
as $$
  delete from public.captcha_nonces
   where nonce = p_nonce
     and expires_at > now()
  returning nonce;
$$;
revoke all on function public.consume_captcha_nonce(text) from public;
grant execute on function public.consume_captcha_nonce(text) to service_role;

-- Lazy reaper the issue route calls on ~1 in 100 requests.
create or replace function public.reap_captcha_nonces()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.captcha_nonces where expires_at < now() - interval '1 hour';
$$;
revoke all on function public.reap_captcha_nonces() from public;
grant execute on function public.reap_captcha_nonces() to service_role;

-- ─── digilocker_sessions unique constraint (defence in depth) ────────────
do $$ begin
  alter table public.digilocker_sessions
    add constraint digilocker_sessions_state_token_key unique (state_token);
exception when duplicate_table or duplicate_object then null; end $$;

-- ─── razorpay_webhook_events: processing state for crash-safe retries ────
-- A row inserted at the start of handling stays 'processing' until the DB
-- mutation actually completes, so a crash mid-handler no longer blocks the
-- vendor's retry from re-applying the activation.
alter table public.razorpay_webhook_events
  add column if not exists status text default 'processed' not null;
alter table public.razorpay_webhook_events
  add column if not exists processed_at timestamptz;
-- Backfill historic rows so the new NOT NULL default doesn't matter for them.
update public.razorpay_webhook_events
   set status = 'processed', processed_at = coalesce(processed_at, received_at)
 where status is null;

-- ─── Retention ───────────────────────────────────────────────────────────
-- app_logs beyond 90 days get purged; admin_actions kept for a year.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'vp-reap-app-logs',
      '15 3 * * *',
      $cron$delete from public.app_logs where created_at < now() - interval '90 days'$cron$
    );
    perform cron.schedule(
      'vp-reap-admin-actions',
      '30 3 * * *',
      $cron$delete from public.admin_actions where created_at < now() - interval '365 days'$cron$
    );
    perform cron.schedule(
      'vp-reap-captcha-nonces',
      '*/30 * * * *',
      'select public.reap_captcha_nonces()'
    );
  end if;
end $$;
