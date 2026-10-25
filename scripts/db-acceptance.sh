#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
#  Database acceptance tests (§8) against a throwaway local Postgres with
#  pgvector + PostGIS. Supabase-provided objects (auth.uid(), roles,
#  storage schema, realtime publication) are stubbed so the real
#  migrations run unmodified.
#
#  Usage:  npm run test:db
#  Needs:  postgres 15+ binaries on PATH (or PG_BIN), pgvector, postgis.
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || echo /opt/homebrew/opt/postgresql@17/bin/pg_ctl)")}"
PORT="${PGPORT_TEST:-54329}"
DATA="$(mktemp -d)/pgdata"
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGDATABASE=veripulse_test

cleanup() { "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$(dirname "$DATA")"; }
trap cleanup EXIT

"$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -c listen_addresses=127.0.0.1" -l "$DATA/log" -w start >/dev/null
"$PG_BIN/createdb" veripulse_test

PSQL=("$PG_BIN/psql" -v ON_ERROR_STOP=1 -q -X -o /dev/null)

echo "▸ Stubbing Supabase platform objects"
"${PSQL[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to postgres;

create schema extensions;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid default gen_random_uuid() primary key, bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select string_to_array(name, '/') $$;
alter table storage.objects enable row level security;

create publication supabase_realtime;

-- Supabase's default privileges: RLS, not table grants, is the gate.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
SQL

echo "▸ Applying migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "   $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"

pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }

# Helper SQL: fixed-direction 768-d vectors for dedup tests.
"${PSQL[@]}" <<'SQL'
create function pg_temp_vec(a float8, b float8) returns vector language sql as $$
  select ('[' || a || ',' || b || ',' ||
          array_to_string(array_fill(0::float8, array[766]), ',') || ']')::vector
$$;
grant execute on function pg_temp_vec(float8, float8) to service_role;

create function mk_user(p_id uuid, p_name text, p_trust numeric, p_tier user_tier_type,
                        p_balance numeric default 0, p_upi text default null)
returns void language sql as $$
  insert into auth.users (id, email) values (p_id, p_name || '@test');
  update public.profiles set username = p_name, trust_score = p_trust, tier = p_tier,
         wallet_balance_inr = p_balance, upi_id = p_upi where id = p_id;
$$;
SQL

echo "▸ Acceptance tests"

# ── Grants: service-only functions are not callable by clients ──────────
"${PSQL[@]}" <<'SQL'
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.ingest_story(uuid,text,text,double precision,double precision,jsonb,jsonb,text,text,boolean,numeric,numeric,vector,text)',
    'public.settle_affiliate_conversion(text,numeric,text,numeric,numeric,numeric)',
    'public.reverse_failed_payout(uuid,text)',
    'public.distribute_sentinel_pool()',
    'public.claim_payouts(integer)',
    'public.apply_payout_webhook(text,uuid,text,text,text)']
  loop
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'client role can execute %', fn;
    end if;
  end loop;
  if not has_function_privilege('authenticated', 'public.cast_weighted_vote(uuid,vote_action_type)', 'execute') then
    raise exception 'authenticated cannot vote';
  end if;
  if to_regprocedure('public.request_upi_payout(numeric,text,numeric,numeric)') is not null then
    raise exception 'client-tunable payout policy overload still exists';
  end if;
end $$;
SQL
pass "Grants: anon/authenticated cannot call ingest/settle/reverse/drain RPCs; payout policy is server-fixed"

# ── Deduplication ────────────────────────────────────────────────────────
"${PSQL[@]}" <<'SQL'
truncate public.stories cascade;
set role service_role;
select * from public.ingest_story(null,'Civic','Salt Lake',22.58,88.41,
  '{"en":"Fire at market","bn":"বাজারে আগুন","hi":"बाजार में आग"}','{"en":"a","bn":"a","hi":"a"}',
  null,'image',false,5,60,pg_temp_vec(1,0.20),'citizen');
-- ~0.99 cosine similarity, more complete → merges and becomes primary
select * from public.ingest_story(null,'Civic','Salt Lake',22.58,88.41,
  '{"en":"Fire at Salt Lake market, 3 engines","bn":"খ","hi":"ख"}','{"en":"b","bn":"b","hi":"b"}',
  null,'image',false,5,80,pg_temp_vec(1,0.25),'citizen');
-- orthogonal → separate story
select * from public.ingest_story(null,'Weather','Howrah',22.59,88.26,
  '{"en":"Heavy rain alert","bn":"ক","hi":"क"}','{"en":"c","bn":"c","hi":"c"}',
  null,'image',false,5,50,pg_temp_vec(0,1),'citizen');
reset role;
do $$ begin
  if (select count(*) from public.stories) <> 2 then raise exception 'expected 2 stories, got %', (select count(*) from public.stories); end if;
  if (select count(*) from public.story_timeline) <> 1 then raise exception 'expected 1 timeline node'; end if;
  if not exists (select 1 from public.stories where titles->>'en' = 'Fire at Salt Lake market, 3 engines' and completeness_score = 80) then
    raise exception 'higher-completeness report was not promoted to primary';
  end if;
end $$;
SQL
pass "Dedup: similar reports merge into 1 story + 1 timeline node; more complete report becomes primary"

# ── Consensus: 5 hoax flags from trust>80 sentinels → quarantine ─────────
"${PSQL[@]}" <<'SQL'
truncate public.stories cascade;
select mk_user('00000000-0000-0000-0000-00000000000a','author',60,'public');
select mk_user(('00000000-0000-0000-0000-00000000010' || i)::uuid, 'sentinel' || i, 85, 'sentinel_t1') from generate_series(1,5) i;
select mk_user('00000000-0000-0000-0000-0000000000f1','pleb',90,'public');
insert into public.stories (id, author_id, category, location_name, titles, summaries)
values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','Civic','Kolkata',
        '{"en":"Bridge collapsed","bn":"সেতু","hi":"पुल"}','{"en":"x","bn":"x","hi":"x"}');

-- reader who never votes still gets the retraction
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select public.mark_story_read('11111111-1111-1111-1111-111111111111');
-- public-tier user cannot vote in the tier-1 canary ring
do $$ begin
  perform public.cast_weighted_vote('11111111-1111-1111-1111-111111111111','real');
  raise exception 'ring gate missing';
exception when others then
  if sqlerrm <> 'RING_RESTRICTED' then raise; end if;
end $$;
-- canary story is invisible to a public-tier user
do $$ begin
  if exists (select 1 from public.get_feed('global')) then raise exception 'tier_1 leaked to public tier'; end if;
end $$;
reset role;

do $$
declare i int; r record;
begin
  for i in 1..5 loop
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000010' || i, false);
    set local role authenticated;
    select * into r from public.cast_weighted_vote('11111111-1111-1111-1111-111111111111','hoax');
    reset role;
  end loop;
end $$;

do $$
declare s record;
begin
  select * into s from public.stories where id = '11111111-1111-1111-1111-111111111111';
  if s.rollout_stage <> 'quarantined' or s.credibility_score >= 35 then
    raise exception 'expected quarantined <35, got % %', s.rollout_stage, s.credibility_score;
  end if;
  if (select trust_score from public.profiles where username = 'author') <> 57.5 then
    raise exception 'author trust penalty not applied';
  end if;
  -- Trust-85 flags weigh 1.7 → −8.925 each, so the story quarantines on
  -- the 2nd flag. Readers + voters at that moment are notified, and only
  -- those 2 votes are scored: piling on after the outcome is known earns
  -- nothing (otherwise late voters could farm accuracy and pool share).
  if (select count(*) from public.notifications where kind = 'retraction') <> 3 then
    raise exception 'expected 3 retraction notices (2 voters + 1 reader), got %',
      (select count(*) from public.notifications where kind = 'retraction');
  end if;
  if (select count(*) from public.profiles where username like 'sentinel%'
        and correct_votes = 1 and total_votes = 1 and trust_score = 86) <> 2 then
    raise exception 'pre-resolution voters not scored';
  end if;
  if exists (select 1 from public.profiles where username in ('sentinel3','sentinel4','sentinel5') and total_votes <> 0) then
    raise exception 'post-resolution votes were scored';
  end if;
end $$;
SQL
pass "Consensus: 5 hoax flags (trust 85) → quarantined, author −2.5 trust, readers+voters notified, voters scored"

"${PSQL[@]}" <<'SQL'
insert into public.stories (id, author_id, category, location_name, titles, summaries, rollout_stage)
values ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-00000000000a','Civic','Kolkata',
        '{"en":"t","bn":"t","hi":"t"}','{"en":"x","bn":"x","hi":"x"}','tier_2');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
select public.cast_weighted_vote('22222222-2222-2222-2222-222222222222','real');
select public.cast_weighted_vote('22222222-2222-2222-2222-222222222222','real');
select public.cast_weighted_vote('22222222-2222-2222-2222-222222222222','real');
reset role;
do $$ begin
  -- one vote: 50 + 3.5 * 1 * (86/50) = 56.02
  if (select credibility_score from public.stories where id = '22222222-2222-2222-2222-222222222222') <> 56.02 then
    raise exception 'repeat vote changed credibility: %',
      (select credibility_score from public.stories where id = '22222222-2222-2222-2222-222222222222');
  end if;
end $$;
SQL
pass "Consensus: re-casting the same vote is a no-op (no vote stuffing)"

# ── Affiliate split + replay protection ─────────────────────────────────
"${PSQL[@]}" <<'SQL'
select mk_user('00000000-0000-0000-0000-0000000000b1','reviewer',75,'validator_t2');
insert into public.affiliate_clicks (sub_id, product_id, primary_reviewer_id, merchant)
values ('vp_nova-x1-8-128_rev_1','nova-x1-8-128','00000000-0000-0000-0000-0000000000b1','amazon');
set role service_role;
select * from public.settle_affiliate_conversion('vp_nova-x1-8-128_rev_1', 1000, 'wh-1');
select * from public.settle_affiliate_conversion('vp_nova-x1-8-128_rev_1', 1000, 'wh-1');
reset role;
do $$ begin
  if (select wallet_balance_inr from public.profiles where username = 'reviewer') <> 200 then
    raise exception 'reviewer credit wrong / replayed';
  end if;
  if (select sum(amount_inr) from public.ad_revenue_ledger where source = 'affiliate') <> 700 then
    raise exception 'founder share wrong';
  end if;
  if (select sum(amount_inr) from public.ad_revenue_ledger where source = 'sentinel_pool') <> 100 then
    raise exception 'sentinel pool share wrong';
  end if;
end $$;
SQL
pass "Affiliate: ₹1000 → 700 founder / 200 reviewer / 100 pool; replayed postback settles nothing"

"${PSQL[@]}" <<'SQL'
set role service_role;
select public.distribute_sentinel_pool();
reset role;
do $$ begin
  -- the 2 scored sentinels each had 1 correct vote → ₹50 each
  if (select count(*) from public.profiles where username like 'sentinel%' and wallet_balance_inr = 50) <> 2
     or exists (select 1 from public.profiles where username in ('sentinel3','sentinel4','sentinel5') and wallet_balance_inr <> 0) then
    raise exception 'sentinel pool not split pro rata';
  end if;
  set local role service_role;
  if public.distribute_sentinel_pool() <> 0 then raise exception 'pool paid twice'; end if;
end $$;
SQL
pass "Sentinel pool: distributed pro rata to correct voters, never twice"

# ── Financial security: 5 concurrent withdrawals, one wallet ────────────
"${PSQL[@]}" -c "select mk_user('00000000-0000-0000-0000-0000000000c1','spender',80,'validator_t2',150,'spender@okaxis');"
for i in 1 2 3 4 5; do
  ( "$PG_BIN/psql" -X -q -t -A -c "set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000c1';
     select status from public.request_upi_payout(100, 'concurrent-key-$i');" >"$DATA/wd$i.out" 2>&1 || true ) &
done
wait
"${PSQL[@]}" <<'SQL'
do $$ begin
  if (select count(*) from public.payout_requests where user_id = '00000000-0000-0000-0000-0000000000c1') <> 1 then
    raise exception 'expected exactly 1 payout, got %', (select count(*) from public.payout_requests where user_id = '00000000-0000-0000-0000-0000000000c1');
  end if;
  if (select wallet_balance_inr from public.profiles where username = 'spender') <> 50 then
    raise exception 'balance should be 50';
  end if;
end $$;
SQL
OK=$(grep -l '^queued$' "$DATA"/wd*.out | wc -l | tr -d ' ')
REJECTED=$(grep -l 'INSUFFICIENT_BALANCE' "$DATA"/wd*.out | wc -l | tr -d ' ')
[ "$OK" = 1 ] && [ "$REJECTED" = 4 ] || { echo "concurrency: $OK ok / $REJECTED rejected"; cat "$DATA"/wd*.out; exit 1; }
pass "Payouts: 5 simultaneous withdrawals → exactly 1 executes, 4 abort (INSUFFICIENT_BALANCE)"

"${PSQL[@]}" <<'SQL'
update public.profiles set wallet_balance_inr = 500 where username = 'spender';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select public.request_upi_payout(100, 'replay-key-001');
select public.request_upi_payout(100, 'replay-key-001');
reset role;
do $$ begin
  if (select wallet_balance_inr from public.profiles where username = 'spender') <> 400 then
    raise exception 'idempotent replay double-debited';
  end if;
end $$;
select mk_user('00000000-0000-0000-0000-0000000000c2','lowtrust',60,'public',500,'low@okaxis');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
do $$ begin
  perform public.request_upi_payout(100, 'lowtrust-key-1');
  raise exception 'trust gate missing';
exception when others then
  if sqlerrm <> 'TRUST_TOO_LOW' then raise; end if;
end $$;
reset role;
SQL
pass "Payouts: replayed idempotency key never double-debits; trust < 70 is refused"

"${PSQL[@]}" <<'SQL'
-- Webhook failure refunds; a successful one records the UTR.
set role service_role;
select public.apply_payout_webhook('pout_x', (select id from public.payout_requests where idempotency_key like '%replay-key-001'), 'reversed', null, 'bank rejected');
reset role;
do $$ begin
  if (select wallet_balance_inr from public.profiles where username = 'spender') <> 500 then
    raise exception 'reversal did not refund';
  end if;
end $$;
SQL
pass "Payout webhook: reversed payout refunds the wallet"

# ── Profile RLS: users can't touch protected fields ─────────────────────
"${PSQL[@]}" <<'SQL'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
do $$ begin
  update public.profiles set wallet_balance_inr = 99999 where id = auth.uid();
  raise exception 'wallet self-credit allowed';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update public.profiles set badge = 'Sentinel' where id = auth.uid();
  raise exception 'badge self-award allowed';
exception when insufficient_privilege then null;
end $$;
update public.profiles set upi_id = 'new@okaxis', preferred_lang = 'bn' where id = auth.uid();
reset role;
SQL
pass "RLS: users can edit UPI/lang but not wallet, trust, tier or badge"

"${PSQL[@]}" <<'SQL'
set role service_role; select public.recompute_tiers(); reset role;
set role anon; select * from public.platform_stats(); reset role;
SQL
pass "recompute_tiers() and platform_stats() run"

echo "All database acceptance tests passed."
