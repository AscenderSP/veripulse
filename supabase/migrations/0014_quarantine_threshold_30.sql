-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0014_quarantine_threshold_30.sql
--
--  Lowers the quarantine cutoff on cast_weighted_vote from 35 → 30, so a
--  wire story only drops out of public rotation once its live
--  credibility (AI baseline + votes) sinks below 30. Everything else in
--  the function is identical to 0013.
--
--  Idempotent — `create or replace`.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.cast_weighted_vote(
  p_story_id uuid,
  p_vote     vote_action_type
)
returns table (new_credibility numeric, new_stage story_stage_type)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid         uuid := auth.uid();
  v_prof        record;
  v_story       record;
  v_prev        record;
  v_vnum        numeric;
  v_mrole       numeric;
  v_mtrust      numeric;
  v_mgeo        numeric := 1.0;
  v_mearly      numeric;
  v_mowner      numeric := 1.0;
  v_weight      numeric;
  v_cred        numeric;
  v_stage       story_stage_type;
  v_prior_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select trust_score, tier, home_lat, home_lng,
         coalesce(is_journalist_verified, false) as is_journalist
    into v_prof
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

  v_vnum := case p_vote
              when 'real'          then 1.0
              when 'hoax'          then -1.5
              else                     -0.5
            end;

  v_mrole := case
               when v_prof.is_journalist then 2.0
               when v_prof.tier = 'sentinel_t1'  then 1.0
               when v_prof.tier = 'validator_t2' then 0.85
               else 0.67
             end;

  v_mtrust := greatest(0.5, least(1.5, v_prof.trust_score / 50.0));

  if v_prof.home_lat is not null and v_story.geom is not null
     and st_dwithin(v_story.geom,
                    st_setsrid(st_makepoint(v_prof.home_lng, v_prof.home_lat), 4326)::geography,
                    10000) then
    v_mgeo := 1.5;
  end if;

  select count(*) into v_prior_count
    from public.votes
    where story_id = p_story_id and user_id <> v_uid;
  v_mearly := case
                when v_prior_count < 5  then 1.5
                when v_prior_count < 20 then 1.2
                else                         1.0
              end;

  if exists (
      select 1 from public.ownership_verifications ov
      where ov.user_id = v_uid and ov.tamper_check_passed
        and lower(ov.product_category) = lower(v_story.category)
  ) then
    v_mowner := 2.0;
  end if;

  v_weight := v_mrole * v_mtrust * v_mgeo * v_mearly * v_mowner;
  v_cred   := v_story.credibility_score;

  if v_prev.vote_type is not null then
    v_cred := v_cred - 1.0 * (case v_prev.vote_type when 'real' then 1.0
                                                    when 'hoax' then -1.5
                                                    else -0.5 end)
                           * v_prev.user_weight;
  end if;

  v_cred := least(99.0, greatest(5.0, v_cred + 1.0 * v_vnum * v_weight));

  insert into public.votes (story_id, user_id, vote_type, user_weight)
  values (p_story_id, v_uid, p_vote, v_weight)
  on conflict (story_id, user_id)
  do update set vote_type = excluded.vote_type,
                user_weight = excluded.user_weight,
                created_at = now();

  v_stage := v_story.rollout_stage;
  if v_cred >= 80.0 then
    v_stage := 'public';
  elsif v_cred < 30.0 then          -- was 35.0 in 0013
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
