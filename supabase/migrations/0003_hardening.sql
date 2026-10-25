-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0003_hardening.sql
--  Closes the gaps between 0001/0002 and the architecture spec:
--    · function EXECUTE grants (Postgres grants PUBLIC by default)
--    · server-fixed payout policy + per-user idempotency namespace
--    · tier-gated canary rollout (tier_1 → sentinels, tier_2 → validators)
--    · vote resolution → voter accuracy / trust, Top-5% sentinel tiering
--    · retraction notices to prior readers, sentinel pool distribution
--    · products / owner reviews for the comparison matrix
--    · storage buckets, suspicious-document log, Realtime publication
--    · HNSW vector index (ivfflat built on an empty table has poor recall)
-- ════════════════════════════════════════════════════════════════════════

-- ─── Vector index ────────────────────────────────────────────────────────
-- ivfflat picks its list centroids at build time; created on an empty
-- table (as in 0001) it can miss true near-duplicates. HNSW has no
-- training step and keeps high recall as the table grows.
drop index if exists public.stories_embedding_ivfflat;
create index if not exists stories_embedding_hnsw
  on public.stories using hnsw (embedding vector_cosine_ops);

-- ─── Schema additions ────────────────────────────────────────────────────
alter table public.stories   add column if not exists resolved_at timestamptz;
alter table public.votes     add column if not exists is_correct boolean;
alter table public.ownership_verifications add column if not exists image_sha256 text;

-- Readers of a story (for retraction fan-out on quarantine).
create table if not exists public.story_reads (
  story_id   uuid references public.stories(id) on delete cascade not null,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (story_id, user_id)
);

create table if not exists public.notifications (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  kind       text not null,                 -- retraction | payout | verification
  story_id   uuid references public.stories(id) on delete cascade,
  body       jsonb not null,                -- {"en","bn","hi"}
  read_at    timestamptz,
  created_at timestamptz default now() not null
);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);

-- Rejected / tampered document submissions (§3.2 "Reject & Log Suspicious Flag").
create table if not exists public.verification_flags (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.profiles(id) on delete set null,
  image_sha256  text not null,
  reason        text not null,
  detail        jsonb,
  created_at    timestamptz default now() not null
);
create index if not exists verification_flags_user on public.verification_flags (user_id, created_at desc);

-- Products & verified-owner reviews (Product Matrix).
create table if not exists public.products (
  id                  text primary key,                -- slug, e.g. nova-x1-8-128
  name                text not null,
  category            text not null,
  merchant            text not null check (merchant in ('amazon', 'flipkart', 'cuelinks')),
  merchant_url        text not null,
  price_inr           numeric(12,2),
  claimed_specs       jsonb default '{}'::jsonb not null,
  primary_reviewer_id uuid references public.profiles(id) on delete set null,
  created_at          timestamptz default now() not null
);

create table if not exists public.product_reviews (
  id            uuid default gen_random_uuid() primary key,
  product_id    text references public.products(id) on delete cascade not null,
  reviewer_id   uuid references public.profiles(id) on delete cascade not null,
  rating        numeric(2,1) not null check (rating between 1 and 5),
  measured_specs jsonb default '{}'::jsonb not null,
  body          text,
  created_at    timestamptz default now() not null,
  unique (product_id, reviewer_id)
);

create or replace view public.product_matrix
with (security_invoker = true) as
select p.id, p.name, p.category, p.merchant, p.price_inr, p.claimed_specs,
       p.primary_reviewer_id,
       rv.username                          as primary_reviewer,
       count(r.id)::int                     as verified_owners,
       round(avg(r.rating), 1)              as owner_rating,
       (array_agg(r.measured_specs order by r.created_at desc))[1] as latest_measured_specs
from public.products p
left join public.product_reviews r on r.product_id = p.id
left join public.profiles rv on rv.id = p.primary_reviewer_id
group by p.id, rv.username;

alter table public.story_reads        enable row level security;
alter table public.notifications      enable row level security;
alter table public.verification_flags enable row level security;
alter table public.products           enable row level security;
alter table public.product_reviews    enable row level security;

drop policy if exists "Users read own reads" on public.story_reads;
create policy "Users read own reads" on public.story_reads for select using (auth.uid() = user_id);

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "Users mark own notifications read" on public.notifications;
create policy "Users mark own notifications read" on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Public read products" on public.products;
create policy "Public read products" on public.products for select using (true);
drop policy if exists "Public read reviews" on public.product_reviews;
create policy "Public read reviews" on public.product_reviews for select using (true);
-- Only verified owners of the product's category may review it.
drop policy if exists "Verified owners write reviews" on public.product_reviews;
create policy "Verified owners write reviews" on public.product_reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.ownership_verifications ov
      join public.products p on p.id = product_id
      where ov.user_id = auth.uid()
        and ov.tamper_check_passed
        and lower(ov.product_category) = lower(p.category)
    )
  );

-- ─── Profiles: also lock badge (only the server awards badges) ───────────
drop policy if exists "Users update own safe fields" on public.profiles;
create policy "Users update own safe fields" on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and trust_score        = (select p.trust_score        from public.profiles p where p.id = auth.uid())
    and tier               = (select p.tier               from public.profiles p where p.id = auth.uid())
    and badge              = (select p.badge              from public.profiles p where p.id = auth.uid())
    and wallet_balance_inr = (select p.wallet_balance_inr from public.profiles p where p.id = auth.uid())
    and correct_votes      = (select p.correct_votes      from public.profiles p where p.id = auth.uid())
    and total_votes        = (select p.total_votes        from public.profiles p where p.id = auth.uid())
  );

-- ─── Stories: tier-gated canary visibility ───────────────────────────────
--   public / quarantined (vault) → everyone
--   tier_2 (community ring)      → validators + sentinels
--   tier_1 (canary ring)         → sentinels
--   authors always see their own.
create or replace function public.my_tier()
returns user_tier_type language sql stable security definer set search_path = public, extensions as $$
  select tier from public.profiles where id = auth.uid();
$$;

drop policy if exists "Public read stories" on public.stories;
create policy "Tiered read stories" on public.stories for select using (
  rollout_stage in ('public', 'quarantined')
  or author_id = auth.uid()
  or (rollout_stage = 'tier_2' and public.my_tier() in ('validator_t2', 'sentinel_t1'))
  or (rollout_stage = 'tier_1' and public.my_tier() = 'sentinel_t1')
);

-- ─────────────────────────────────────────────────────────────────────────
--  get_feed — the only feed query the client makes.
--    p_scope: 'global' | 'hyperlocal' | 'vault'
--  Hyperlocal limits to p_radius_km around (p_lat,p_lng). Tier-1 canary
--  items are additionally limited to sentinels within 10 km of the story
--  (wire items with no coordinates go to every sentinel).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.get_feed(
  p_scope     text default 'global',
  p_lat       double precision default null,
  p_lng       double precision default null,
  p_radius_km numeric default 10,
  p_limit     int default 50
)
returns setof public.stories
language sql stable security invoker set search_path = public, extensions as $$
  with me as (
    select p.home_lat, p.home_lng from public.profiles p where p.id = auth.uid()
  )
  select s.*
  from public.stories s
  left join me on true
  where
    case when p_scope = 'vault'
         then s.rollout_stage = 'quarantined'
         else s.rollout_stage <> 'quarantined' end
    and (
      p_scope <> 'hyperlocal' or p_lat is null or p_lng is null
      or (s.geom is not null and st_dwithin(
            s.geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000))
    )
    and (
      s.rollout_stage <> 'tier_1'
      or s.author_id = auth.uid()
      or s.geom is null
      or (me.home_lat is not null and st_dwithin(
            s.geom, st_setsrid(st_makepoint(me.home_lng, me.home_lat), 4326)::geography, 10000))
    )
  order by s.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- Timeline nodes for a story (RLS on stories already applies via join).
create or replace function public.get_story_timeline(p_story_id uuid)
returns setof public.story_timeline
language sql stable security invoker set search_path = public, extensions as $$
  select t.* from public.story_timeline t
  join public.stories s on s.id = t.story_id
  where t.story_id = p_story_id
  order by t.created_at asc;
$$;

-- Record that the caller opened a story (feeds retraction fan-out).
create or replace function public.mark_story_read(p_story_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.story_reads (story_id, user_id) values (p_story_id, auth.uid())
  on conflict do nothing;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  resolve_story_votes — scores every vote on a story the first time it
--  reaches a terminal stage. Correct: 'real' on public, 'hoax' on
--  quarantined. needs_context is neutral (counted, not scored).
--  Correct voters gain +1 trust, wrong voters lose 1 (clamped 0..100).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.resolve_story_votes(p_story_id uuid, p_outcome story_stage_type)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_right vote_action_type := case p_outcome when 'public' then 'real'::vote_action_type
                                             else 'hoax'::vote_action_type end;
begin
  update public.votes v
     set is_correct = case when v.vote_type = 'needs_context' then null
                           else v.vote_type = v_right end
   where v.story_id = p_story_id;

  update public.profiles p
     set total_votes   = p.total_votes + 1,
         correct_votes = p.correct_votes + case when v.is_correct then 1 else 0 end,
         trust_score   = least(100, greatest(0, p.trust_score +
                           case when v.is_correct is null then 0
                                when v.is_correct then 1 else -1 end)),
         updated_at    = now()
    from public.votes v
   where v.story_id = p_story_id and v.user_id = p.id;

  update public.stories set resolved_at = now() where id = p_story_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  cast_weighted_vote (v2) — §6.1, plus:
--    · ring gating (tier_1 → sentinels, tier_2 → validators+), no self-votes
--    · re-casting the same vote is a no-op; switching reverses the old delta
--    · first terminal transition resolves votes; quarantine notifies readers
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.cast_weighted_vote(
  p_story_id uuid,
  p_vote     vote_action_type
)
returns table (new_credibility numeric, new_stage story_stage_type)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid      uuid := auth.uid();
  v_prof     record;
  v_story    record;
  v_prev     record;
  v_vnum     numeric;
  v_mgeo     numeric := 1.0;
  v_mowner   numeric := 1.0;
  v_weight   numeric;
  v_cred     numeric;
  v_stage    story_stage_type;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select trust_score, tier, home_lat, home_lng into v_prof
    from public.profiles where id = v_uid for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  select * into v_story from public.stories where id = p_story_id for update;
  if not found then raise exception 'STORY_NOT_FOUND'; end if;

  if v_story.author_id = v_uid then raise exception 'CANNOT_VOTE_OWN_STORY'; end if;
  if v_story.rollout_stage = 'tier_1' and v_prof.tier <> 'sentinel_t1' then
    raise exception 'RING_RESTRICTED';
  end if;
  if v_story.rollout_stage = 'tier_2' and v_prof.tier = 'public' then
    raise exception 'RING_RESTRICTED';
  end if;

  select vote_type, user_weight into v_prev
    from public.votes where story_id = p_story_id and user_id = v_uid;
  if found and v_prev.vote_type = p_vote then
    return query select v_story.credibility_score, v_story.rollout_stage;
    return;
  end if;

  v_vnum := case p_vote when 'real' then 1.0 when 'hoax' then -1.5 else -0.5 end;

  if v_prof.home_lat is not null and v_story.geom is not null
     and st_dwithin(v_story.geom,
                    st_setsrid(st_makepoint(v_prof.home_lng, v_prof.home_lat), 4326)::geography,
                    10000) then
    v_mgeo := 1.5;
  end if;

  if exists (
      select 1 from public.ownership_verifications ov
      where ov.user_id = v_uid and ov.tamper_check_passed
        and lower(ov.product_category) = lower(v_story.category)
  ) then
    v_mowner := 3.0;
  end if;

  v_weight := (v_prof.trust_score / 50.0) * v_mgeo * v_mowner;
  v_cred   := v_story.credibility_score;

  -- Switching vote: back out the previous contribution first.
  if v_prev.vote_type is not null then
    v_cred := v_cred - 3.5 * (case v_prev.vote_type when 'real' then 1.0
                                                    when 'hoax' then -1.5 else -0.5 end)
                           * v_prev.user_weight;
  end if;

  v_cred := least(99.0, greatest(5.0, v_cred + 3.5 * v_vnum * v_weight));

  insert into public.votes (story_id, user_id, vote_type, user_weight)
  values (p_story_id, v_uid, p_vote, v_weight)
  on conflict (story_id, user_id)
  do update set vote_type = excluded.vote_type, user_weight = excluded.user_weight, created_at = now();

  v_stage := v_story.rollout_stage;
  if v_cred >= 80.0 then
    v_stage := 'public';
  elsif v_cred < 35.0 then
    v_stage := 'quarantined';
  elsif v_story.rollout_stage = 'tier_1' then
    v_stage := 'tier_2';
  end if;

  update public.stories
     set credibility_score = v_cred, rollout_stage = v_stage, updated_at = now()
   where id = p_story_id;

  if v_stage = 'quarantined' and v_story.rollout_stage <> 'quarantined' then
    update public.profiles
       set trust_score = greatest(0, trust_score - 2.5), updated_at = now()
     where id = v_story.author_id;

    -- Retraction notice to everyone who read or voted on it.
    insert into public.notifications (user_id, kind, story_id, body)
    select distinct r.user_id, 'retraction', p_story_id,
           jsonb_build_object(
             'en', 'Retracted: "' || (v_story.titles->>'en') || '" was quarantined by consensus.',
             'bn', 'প্রত্যাহার: "' || (v_story.titles->>'bn') || '" সম্মিলিত যাচাইয়ে কোয়ারেন্টাইন করা হয়েছে।',
             'hi', 'वापस लिया गया: "' || (v_story.titles->>'hi') || '" सामूहिक जाँच में क्वारंटीन किया गया।')
    from (select user_id from public.story_reads where story_id = p_story_id
          union select user_id from public.votes where story_id = p_story_id) r;
  end if;

  if v_story.resolved_at is null and v_stage in ('public', 'quarantined') then
    perform public.resolve_story_votes(p_story_id, v_stage);
  end if;

  return query select v_cred, v_stage;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  recompute_tiers — Top 5% by trust → sentinel_t1, next 20% (or anyone
--  holding a verified ownership) → validator_t2, the rest public.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.recompute_tiers()
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  with ranked as (
    select id, percent_rank() over (order by trust_score desc, correct_votes desc) as pr,
           exists (select 1 from public.ownership_verifications ov where ov.user_id = profiles.id) as owner
    from public.profiles
  )
  update public.profiles p
     set tier = case when r.pr < 0.05 then 'sentinel_t1'::user_tier_type
                     when r.pr < 0.25 or r.owner then 'validator_t2'::user_tier_type
                     else 'public'::user_tier_type end,
         badge = case when r.pr < 0.05 then 'Sentinel'
                      when r.owner then 'Verified Owner'
                      when r.pr < 0.25 then 'Validator'
                      else 'Citizen Scout' end,
         updated_at = now()
    from ranked r
   where r.id = p.id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  distribute_sentinel_pool — pays the undistributed 10% pool to voters
--  whose resolved votes in the last 30 days were correct, pro rata.
--  Pool balance = Σ sentinel_pool ledger − Σ already-credited, so the
--  append-only ledgers are never mutated. Rounding dust stays in the pool.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.distribute_sentinel_pool()
returns numeric language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pool   numeric;
  v_total  int;
  v_paid   numeric := 0;
  v_ref    text := 'pool_' || to_char(now(), 'YYYYMMDDHH24MISS');
  r        record;
  v_share  numeric;
begin
  perform pg_advisory_xact_lock(hashtext('distribute_sentinel_pool'));

  select coalesce((select sum(amount_inr) from public.ad_revenue_ledger where source = 'sentinel_pool'), 0)
       - coalesce((select sum(delta_inr) from public.wallet_ledger where reason = 'sentinel_pool'), 0)
    into v_pool;

  select count(*) into v_total from public.votes v
   where v.is_correct and v.created_at > now() - interval '30 days';

  if v_pool < 1 or v_total = 0 then return 0; end if;

  for r in
    select v.user_id, count(*)::int as n from public.votes v
     where v.is_correct and v.created_at > now() - interval '30 days'
     group by v.user_id
  loop
    v_share := floor(v_pool * r.n / v_total * 100) / 100;
    if v_share > 0 then
      update public.profiles set wallet_balance_inr = wallet_balance_inr + v_share, updated_at = now()
       where id = r.user_id;
      insert into public.wallet_ledger (user_id, delta_inr, reason, reference_id)
      values (r.user_id, v_share, 'sentinel_pool', v_ref);
      v_paid := v_paid + v_share;
    end if;
  end loop;
  return v_paid;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  request_upi_payout (v2) — policy is fixed server-side (₹100, trust 70);
--  idempotency keys are namespaced per user and checked inside the lock.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists public.request_upi_payout(numeric, text, numeric, numeric);

create or replace function public.request_upi_payout(
  p_amount_inr      numeric,
  p_idempotency_key text
)
returns table (payout_id uuid, status payout_status_type)
language plpgsql security definer set search_path = public, extensions as $$
declare
  c_min_inr   constant numeric := 100;
  c_min_trust constant numeric := 70;
  v_uid    uuid := auth.uid();
  v_key    text;
  v_prof   record;
  v_payout uuid;
  v_status payout_status_type;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(length(p_idempotency_key), 0) < 8 then raise exception 'BAD_IDEMPOTENCY_KEY'; end if;
  v_key := v_uid::text || ':' || p_idempotency_key;

  -- Lock the wallet row first — serializes concurrent withdrawals.
  select * into v_prof from public.profiles where id = v_uid for update;

  select pr.id, pr.status into v_payout, v_status
    from public.payout_requests pr where pr.idempotency_key = v_key;
  if v_payout is not null then
    return query select v_payout, v_status;
    return;
  end if;

  if v_prof.upi_id is null then raise exception 'NO_UPI_ON_FILE'; end if;
  if p_amount_inr < c_min_inr then raise exception 'BELOW_MIN_PAYOUT'; end if;
  if v_prof.trust_score < c_min_trust then raise exception 'TRUST_TOO_LOW'; end if;
  if v_prof.wallet_balance_inr < p_amount_inr then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update public.profiles
     set wallet_balance_inr = wallet_balance_inr - p_amount_inr, updated_at = now()
   where id = v_uid;

  insert into public.wallet_ledger (user_id, delta_inr, reason, reference_id)
  values (v_uid, -p_amount_inr, 'payout', v_key);

  insert into public.payout_requests (user_id, amount_inr, amount_paise, upi_vpa, idempotency_key, status)
  values (v_uid, p_amount_inr, round(p_amount_inr * 100)::int, v_prof.upi_id, v_key, 'queued')
  returning id into v_payout;

  return query select v_payout, 'queued'::payout_status_type;
end $$;

-- Claim payouts for the drainer (edge function). SKIP LOCKED lets several
-- drainers run without picking the same row.
create or replace function public.claim_payouts(p_limit int default 10)
returns setof public.payout_requests
language sql security definer set search_path = public, extensions as $$
  update public.payout_requests pr
     set status = 'processing', updated_at = now()
   where pr.id in (
     select id from public.payout_requests
      where (status = 'queued' and created_at < now() - interval '1 minute')
         or (status = 'processing' and razorpay_payout_id is null
             and updated_at < now() - interval '10 minutes')
      order by created_at
      limit p_limit
      for update skip locked)
  returning pr.*;
$$;

-- Apply a RazorpayX webhook. Failed/reversed payouts refund the wallet.
create or replace function public.apply_payout_webhook(
  p_razorpay_payout_id text,
  p_reference_id       uuid,
  p_status             text,
  p_utr                text,
  p_reason             text
)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_req record;
begin
  select * into v_req from public.payout_requests
   where razorpay_payout_id = p_razorpay_payout_id or id = p_reference_id
   for update;
  if not found then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if v_req.status in ('failed', 'reversed') then return; end if;

  if p_status in ('failed', 'reversed', 'rejected', 'cancelled') then
    perform public.reverse_failed_payout(v_req.id, coalesce(p_reason, p_status));
  else
    update public.payout_requests
       set status = case when p_status = 'processed' then 'processed'::payout_status_type
                         else 'processing'::payout_status_type end,
           razorpay_payout_id = coalesce(razorpay_payout_id, p_razorpay_payout_id),
           bank_utr = coalesce(p_utr, bank_utr),
           updated_at = now()
     where id = v_req.id;
  end if;

  if p_status = 'processed' then
    insert into public.notifications (user_id, kind, body)
    values (v_req.user_id, 'payout', jsonb_build_object(
      'en', '₹' || v_req.amount_inr || ' paid to ' || v_req.upi_vpa || coalesce(' · UTR ' || p_utr, ''),
      'bn', '₹' || v_req.amount_inr || ' ' || v_req.upi_vpa || '-এ পাঠানো হয়েছে' || coalesce(' · UTR ' || p_utr, ''),
      'hi', '₹' || v_req.amount_inr || ' ' || v_req.upi_vpa || ' पर भेजा गया' || coalesce(' · UTR ' || p_utr, '')));
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════════
--  EXECUTE grants. Postgres grants EXECUTE to PUBLIC on every new function,
--  which would let the anon key call SECURITY DEFINER internals directly.
-- ════════════════════════════════════════════════════════════════════════
-- Listed explicitly: a schema-wide revoke would also hit PostGIS / pgvector
-- functions when those extensions are installed into public.
revoke execute on function
  public.find_duplicate_story(vector, numeric, int),
  public.ingest_story(uuid, text, text, double precision, double precision, jsonb, jsonb,
                      text, text, boolean, numeric, numeric, vector, text),
  public.settle_affiliate_conversion(text, numeric, text, numeric, numeric, numeric),
  public.reverse_failed_payout(uuid, text),
  public.resolve_story_votes(uuid, story_stage_type),
  public.recompute_tiers(),
  public.distribute_sentinel_pool(),
  public.claim_payouts(int),
  public.apply_payout_webhook(text, uuid, text, text, text),
  public.cast_weighted_vote(uuid, vote_action_type),
  public.request_upi_payout(numeric, text),
  public.mark_story_read(uuid)
from public, anon, authenticated;

grant execute on function public.my_tier()                                    to anon, authenticated;
grant execute on function public.get_feed(text, double precision, double precision, numeric, int) to anon, authenticated;
grant execute on function public.get_story_timeline(uuid)                     to anon, authenticated;
grant execute on function public.mark_story_read(uuid)                        to authenticated;
grant execute on function public.cast_weighted_vote(uuid, vote_action_type)   to authenticated;
grant execute on function public.request_upi_payout(numeric, text)            to authenticated;

grant execute on all functions in schema public to service_role;

-- ─── Storage buckets (evidence media, avatars) ───────────────────────────
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Users upload own evidence" on storage.objects;
create policy "Users upload own evidence" on storage.objects for insert to authenticated
  with check (bucket_id in ('evidence', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Public read media" on storage.objects;
create policy "Public read media" on storage.objects for select
  using (bucket_id in ('evidence', 'avatars'));

-- ─── Realtime ────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.stories;
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object or undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.payout_requests;
exception when duplicate_object or undefined_object then null; end $$;

-- ─── Scheduled jobs (if pg_cron is enabled) ──────────────────────────────
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('vp-recompute-tiers', '15 * * * *', 'select public.recompute_tiers()');
    perform cron.schedule('vp-sentinel-pool',   '0 2 * * *',  'select public.distribute_sentinel_pool()');
  end if;
end $$;
