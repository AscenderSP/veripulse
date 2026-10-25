-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0002_functions.sql
--  SECURITY DEFINER stored procedures. All credibility, wallet, and payout
--  mutations live here so the client can never move a protected value.
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
--  find_duplicate_story
--  Returns the best matching recent story whose cosine similarity to the
--  incoming embedding is >= p_threshold, within p_window hours.
--
--  pgvector's <=> is cosine DISTANCE, so similarity = 1 - distance.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.find_duplicate_story(
  p_embedding   vector(768),
  p_threshold   numeric default 0.84,
  p_window_hours int    default 24
)
returns table (story_id uuid, similarity numeric, completeness numeric)
language sql stable as $$
  select s.id,
         (1 - (s.embedding <=> p_embedding))::numeric as similarity,
         s.completeness_score
  from public.stories s
  where s.embedding is not null
    and s.rollout_stage <> 'quarantined'
    and s.created_at > now() - make_interval(hours => p_window_hours)
    and (1 - (s.embedding <=> p_embedding)) >= p_threshold
  order by s.embedding <=> p_embedding
  limit 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────
--  ingest_story
--  Single atomic entry point for both citizen reports and RSS items.
--  Runs the dedup invariant: if a near-duplicate exists it appends a
--  timeline node (and swaps the primary when the newcomer is more complete);
--  otherwise it creates a fresh Tier-1 story.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.ingest_story(
  p_author        uuid,
  p_category      text,
  p_location_name text,
  p_lat           double precision,
  p_lng           double precision,
  p_titles        jsonb,
  p_summaries     jsonb,
  p_media_url     text,
  p_media_type    text,
  p_c2pa          boolean,
  p_ai_prob       numeric,
  p_completeness  numeric,
  p_embedding     vector(768),
  p_source        text default 'citizen'
)
returns table (story_id uuid, action text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_dup   record;
  v_new   uuid;
begin
  select * into v_dup from public.find_duplicate_story(p_embedding, 0.84, 24);

  if v_dup.story_id is not null then
    -- Corroborating event → timeline node.
    insert into public.story_timeline (story_id, contributor_id, update_text, media_url)
    values (v_dup.story_id, p_author, p_summaries, p_media_url);

    -- Promote the higher-fidelity report to primary.
    if p_completeness > v_dup.completeness then
      update public.stories
         set titles             = p_titles,
             summaries          = p_summaries,
             media_url          = coalesce(p_media_url, media_url),
             media_type         = p_media_type,
             completeness_score = p_completeness,
             c2pa_verified      = p_c2pa or c2pa_verified,
             updated_at         = now()
       where id = v_dup.story_id;
    end if;

    return query select v_dup.story_id, 'merged_timeline'::text;
  else
    insert into public.stories (
      author_id, category, location_name, lat, lng,
      titles, summaries, media_url, media_type, c2pa_verified,
      ai_probability_score, completeness_score, embedding, source,
      rollout_stage, credibility_score
    ) values (
      p_author, p_category, p_location_name, p_lat, p_lng,
      p_titles, p_summaries, p_media_url, coalesce(p_media_type,'image'), coalesce(p_c2pa,false),
      coalesce(p_ai_prob,0), coalesce(p_completeness,50), p_embedding, coalesce(p_source,'citizen'),
      'tier_1', 50.00
    )
    returning id into v_new;

    return query select v_new, 'created_primary'::text;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  cast_weighted_vote
--  Implements §6.1 bridging-consensus credibility.
--
--    vᵤ  : +1 real | -1.5 hoax | -0.5 needs_context
--    Wᵤ  = (Tᵤ / 50) · M_geo · M_owner
--    M_geo   = 1.5 if voter within 10 km of the story, else 1.0
--    M_owner = 3.0 if voter has a matching verified ownership record, else 1.0
--    C⁽ᵗ⁺¹⁾ = clamp(5, 99, C⁽ᵗ⁾ + 3.5 · vᵤ · Wᵤ)
--
--  Promotes to 'public' at >=80, quarantines at <35 (with retraction + author
--  trust penalty). One vote per (story,user); re-votes update in place.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.cast_weighted_vote(
  p_story_id uuid,
  p_vote     vote_action_type
)
returns table (new_credibility numeric, new_stage story_stage_type)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid       uuid := auth.uid();
  v_trust     numeric;
  v_home_lat  double precision;
  v_home_lng  double precision;
  v_story      record;
  v_vnum      numeric;
  v_mgeo      numeric := 1.0;
  v_mowner    numeric := 1.0;
  v_weight    numeric;
  v_cred      numeric;
  v_stage     story_stage_type;
  v_dist_m    double precision;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select trust_score, home_lat, home_lng
    into v_trust, v_home_lat, v_home_lng
  from public.profiles where id = v_uid for update;

  select * into v_story from public.stories where id = p_story_id for update;
  if v_story.id is null then
    raise exception 'STORY_NOT_FOUND';
  end if;

  -- vote scalar
  v_vnum := case p_vote
              when 'real'          then  1.0
              when 'hoax'          then -1.5
              when 'needs_context' then -0.5
            end;

  -- geo multiplier (<=10 km)
  if v_home_lat is not null and v_story.geom is not null then
    v_dist_m := st_distance(
                  v_story.geom,
                  st_setsrid(st_makepoint(v_home_lng, v_home_lat), 4326)::geography
                );
    if v_dist_m <= 10000 then v_mgeo := 1.5; end if;
  end if;

  -- owner multiplier: matching verified ownership in the story's category
  if exists (
      select 1 from public.ownership_verifications ov
      where ov.user_id = v_uid
        and ov.tamper_check_passed
        and lower(ov.product_category) = lower(v_story.category)
  ) then
    v_mowner := 3.0;
  end if;

  v_weight := (v_trust / 50.0) * v_mgeo * v_mowner;

  -- record / update the vote (recomputed weight — never client-supplied)
  insert into public.votes (story_id, user_id, vote_type, user_weight)
  values (p_story_id, v_uid, p_vote, v_weight)
  on conflict (story_id, user_id)
  do update set vote_type = excluded.vote_type,
                user_weight = excluded.user_weight,
                created_at = now();

  -- iterative credibility update, clamped to [5, 99]
  v_cred := least(99.0, greatest(5.0, v_story.credibility_score + 3.5 * v_vnum * v_weight));

  -- stage transition
  v_stage := v_story.rollout_stage;
  if v_cred >= 80.0 then
    v_stage := 'public';
  elsif v_cred < 35.0 then
    v_stage := 'quarantined';
  elsif v_cred >= 35.0 and v_story.rollout_stage = 'tier_1' then
    v_stage := 'tier_2';
  end if;

  update public.stories
     set credibility_score = v_cred,
         rollout_stage     = v_stage,
         updated_at        = now()
   where id = p_story_id;

  -- quarantine side-effects: author trust penalty (retraction fan-out is
  -- handled by a Realtime listener on rollout_stage transitions).
  if v_stage = 'quarantined' and v_story.rollout_stage <> 'quarantined' then
    update public.profiles
       set trust_score = greatest(0, trust_score - 2.5),
           updated_at  = now()
     where id = v_story.author_id;
  end if;

  return query select v_cred, v_stage;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  settle_affiliate_conversion
--  Idempotent 70/20/10 split on a confirmed merchant postback.
--  Guarded by processed_webhooks so a replayed postback is a no-op.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.settle_affiliate_conversion(
  p_sub_id       text,
  p_commission   numeric,
  p_webhook_id   text,
  p_platform_pct numeric default 70,
  p_reviewer_pct numeric default 20,
  p_sentinel_pct numeric default 10
)
returns table (settled boolean, reviewer_credit numeric)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_click       record;
  v_platform    numeric;
  v_reviewer    numeric;
  v_sentinel    numeric;
begin
  -- replay guard
  if exists (select 1 from public.processed_webhooks where id = p_webhook_id) then
    return query select false, 0::numeric;  -- already processed
    return;
  end if;

  select * into v_click from public.affiliate_clicks
    where sub_id = p_sub_id for update;
  if v_click.id is null then
    raise exception 'SUBID_NOT_FOUND';
  end if;

  v_platform := round(p_commission * p_platform_pct / 100.0, 2);
  v_reviewer := round(p_commission * p_reviewer_pct / 100.0, 2);
  v_sentinel := round(p_commission * p_sentinel_pct / 100.0, 2);

  update public.affiliate_clicks
     set estimated_commission_inr = p_commission,
         platform_share_inr = v_platform,
         reviewer_share_inr = v_reviewer,
         sentinel_share_inr = v_sentinel,
         conversion_status  = 'paid',
         updated_at = now()
   where id = v_click.id;

  -- founder ledger (append-only)
  insert into public.ad_revenue_ledger (source, reference_id, amount_inr)
  values ('affiliate', p_sub_id, v_platform);

  -- reviewer wallet credit
  if v_click.primary_reviewer_id is not null and v_reviewer > 0 then
    update public.profiles
       set wallet_balance_inr = wallet_balance_inr + v_reviewer,
           updated_at = now()
     where id = v_click.primary_reviewer_id;
    insert into public.wallet_ledger (user_id, delta_inr, reason, reference_id)
    values (v_click.primary_reviewer_id, v_reviewer, 'affiliate_reviewer', p_sub_id);
  end if;

  -- sentinel pool → distributed equally among correct voters on this product's
  -- stories. Simplified: credited to a pooled holding account handled by a
  -- separate settlement job; here we record the ledger obligation.
  insert into public.ad_revenue_ledger (source, reference_id, amount_inr)
  values ('sentinel_pool', p_sub_id, v_sentinel);

  insert into public.processed_webhooks (id, provider) values (p_webhook_id, 'affiliate');

  return query select true, v_reviewer;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  request_upi_payout
--  Atomic, double-spend-proof withdrawal. Locks the profile row FOR UPDATE,
--  checks balance (>= p_min) and trust (>= p_min_trust), debits, writes the
--  ledger, and enqueues a payout_requests row with a unique idempotency key.
--  The RazorpayX call itself is made by the edge function that drains the
--  queue — the DB only ever moves money it has already debited.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.request_upi_payout(
  p_amount_inr      numeric,
  p_idempotency_key text,
  p_min_inr         numeric default 100,
  p_min_trust       numeric default 70
)
returns table (payout_id uuid, status payout_status_type)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := auth.uid();
  v_prof    record;
  v_payout  uuid;
  v_status  payout_status_type;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  -- Idempotency: a repeated key returns the existing request, no re-debit.
  select pr.id, pr.status into v_payout, v_status
    from public.payout_requests pr where pr.idempotency_key = p_idempotency_key;
  if v_payout is not null then
    return query select v_payout, v_status;
    return;
  end if;

  -- Lock the wallet row — serializes concurrent withdrawals.
  select * into v_prof from public.profiles where id = v_uid for update;

  if v_prof.upi_id is null then raise exception 'NO_UPI_ON_FILE'; end if;
  if p_amount_inr < p_min_inr then raise exception 'BELOW_MIN_PAYOUT'; end if;
  if v_prof.trust_score < p_min_trust then raise exception 'TRUST_TOO_LOW'; end if;
  if v_prof.wallet_balance_inr < p_amount_inr then raise exception 'INSUFFICIENT_BALANCE'; end if;

  -- Debit first (inside the lock) — balance can never go negative.
  update public.profiles
     set wallet_balance_inr = wallet_balance_inr - p_amount_inr,
         updated_at = now()
   where id = v_uid;

  insert into public.wallet_ledger (user_id, delta_inr, reason, reference_id)
  values (v_uid, -p_amount_inr, 'payout', p_idempotency_key);

  insert into public.payout_requests (
    user_id, amount_inr, amount_paise, upi_vpa, idempotency_key, status
  ) values (
    v_uid, p_amount_inr, (p_amount_inr * 100)::int, v_prof.upi_id, p_idempotency_key, 'queued'
  ) returning id into v_payout;

  return query select v_payout, 'queued'::payout_status_type;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
--  reverse_failed_payout
--  Called by the payout drainer when RazorpayX reports terminal failure.
--  Credits the money back and marks the request. Idempotent on status.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.reverse_failed_payout(
  p_payout_id uuid,
  p_reason    text
)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_req record;
begin
  select * into v_req from public.payout_requests where id = p_payout_id for update;
  if v_req.id is null then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if v_req.status in ('failed', 'reversed') then return; end if;  -- already handled

  update public.payout_requests
     set status = 'reversed', failure_reason = p_reason, updated_at = now()
   where id = p_payout_id;

  update public.profiles
     set wallet_balance_inr = wallet_balance_inr + v_req.amount_inr, updated_at = now()
   where id = v_req.user_id;

  insert into public.wallet_ledger (user_id, delta_inr, reason, reference_id)
  values (v_req.user_id, v_req.amount_inr, 'reversal', p_payout_id::text);
end $$;

-- ─── Grants: expose the RPCs to authenticated callers ────────────────────
grant execute on function public.cast_weighted_vote(uuid, vote_action_type) to authenticated;
grant execute on function public.request_upi_payout(numeric, text, numeric, numeric) to authenticated;
-- ingest_story, settle_affiliate_conversion, reverse_failed_payout,
-- find_duplicate_story are called with the service role only (server side).
