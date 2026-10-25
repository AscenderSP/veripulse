-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0004_platform_stats.sql
--  Crawler heartbeat + a public, aggregate-only stats function for the
--  right-rail payout ticker and crawler monitor. The underlying ledgers
--  stay private; only totals are exposed.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.crawler_runs (
  id          uuid default gen_random_uuid() primary key,
  started_at  timestamptz default now() not null,
  finished_at timestamptz,
  ingested    int default 0 not null,
  merged      int default 0 not null,
  errors      int default 0 not null,
  sources     jsonb default '[]'::jsonb not null   -- [{name, ok}]
);
alter table public.crawler_runs enable row level security;
-- no policies → service role only

create or replace function public.platform_stats()
returns table (
  distributed_month_inr numeric,
  stories_today         int,
  merged_today          int,
  last_crawl_at         timestamptz,
  last_crawl_ingested   int,
  last_crawl_merged     int,
  last_crawl_errors     int,
  last_crawl_sources    jsonb
)
language sql stable security definer set search_path = public, extensions as $$
  select
    coalesce((select sum(delta_inr) from public.wallet_ledger
               where delta_inr > 0 and created_at >= date_trunc('month', now())), 0),
    (select count(*)::int from public.stories where created_at >= date_trunc('day', now())),
    (select count(*)::int from public.story_timeline where created_at >= date_trunc('day', now())),
    r.finished_at, r.ingested, r.merged, r.errors, r.sources
  from (select 1) one
  left join lateral (
    select * from public.crawler_runs order by started_at desc limit 1
  ) r on true;
$$;

revoke execute on function public.platform_stats() from public;
grant execute on function public.platform_stats() to anon, authenticated, service_role;
