-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0005_expire_and_timeline.sql
--  1. Expire news older than 12 hours from active feeds and dedup window.
--  2. On news update/duplicate: add older news to story timeline and promote latest news as primary.
--  3. Fallback category reference images when no image is submitted or verified.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Deduplication window reduced to 12 hours (stories older than 12h expire)
create or replace function public.find_duplicate_story(
  p_embedding   vector(768),
  p_threshold   numeric default 0.84,
  p_window_hours int    default 12
)
returns table (story_id uuid, similarity numeric, completeness numeric)
language sql stable as $$
  select s.id,
         (1 - (s.embedding <=> p_embedding))::numeric as similarity,
         s.completeness_score
  from public.stories s
  where s.embedding is not null
    and s.rollout_stage <> 'quarantined'
    and s.created_at >= now() - make_interval(hours => p_window_hours)
    and (1 - (s.embedding <=> p_embedding)) >= p_threshold
  order by s.embedding <=> p_embedding
  limit 1;
$$;

-- 2. Feed only returns active (non-expired <= 12 hours) stories unless viewing the quarantine vault
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
         else s.rollout_stage <> 'quarantined' and s.created_at >= (now() - interval '12 hours') end
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

-- 3. Ingest Story:
--    If an update on the same news comes (duplicate detected within 12h):
--      - Adds the OLDER news into the timeline of the latest news
--      - Promotes the LATEST news as the active primary card and refreshes created_at to now()
--    If no image is submitted or verified:
--      - Automatically assigns a category-curated reference image.
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
  v_dup       record;
  v_old       record;
  v_new       uuid;
  v_ref_img   text;
  v_final_img text;
begin
  -- Resolve curated reference image if none submitted or unverified
  case lower(coalesce(p_category, 'other'))
    when 'politics' then v_ref_img := 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&q=80';
    when 'business' then v_ref_img := 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80';
    when 'tech' then v_ref_img := 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80';
    when 'electronics' then v_ref_img := 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80';
    when 'health' then v_ref_img := 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80';
    when 'weather' then v_ref_img := 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=800&q=80';
    when 'crime' then v_ref_img := 'https://images.unsplash.com/photo-1589578527966-fdac0f44566c?auto=format&fit=crop&w=800&q=80';
    when 'vehicle' then v_ref_img := 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80';
    when 'civic' then v_ref_img := 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=800&q=80';
    when 'sports' then v_ref_img := 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=800&q=80';
    when 'entertainment' then v_ref_img := 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=800&q=80';
    else v_ref_img := 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=800&q=80';
  end case;

  v_final_img := coalesce(nullif(trim(p_media_url), ''), v_ref_img);

  -- Check for existing related news within the 12-hour active window
  select * into v_dup from public.find_duplicate_story(p_embedding, 0.84, 12);

  if v_dup.story_id is not null then
    -- Load the older news story
    select * into v_old from public.stories where id = v_dup.story_id;

    -- Add the older news into the timeline of the story
    insert into public.story_timeline (
      story_id,
      contributor_id,
      update_text,
      media_url,
      created_at
    ) values (
      v_dup.story_id,
      v_old.author_id,
      jsonb_build_object(
        'titles', v_old.titles,
        'summaries', v_old.summaries,
        'headline', coalesce(v_old.titles->>'en', v_old.titles->>'bn', v_old.titles->>'hi', 'Earlier Dispatch'),
        'summary', coalesce(v_old.summaries->>'en', v_old.summaries->>'bn', v_old.summaries->>'hi', ''),
        'en', coalesce(v_old.summaries->>'en', ''),
        'bn', coalesce(v_old.summaries->>'bn', ''),
        'hi', coalesce(v_old.summaries->>'hi', '')
      ),
      coalesce(v_old.media_url, v_ref_img),
      coalesce(v_old.updated_at, v_old.created_at)
    );

    -- Promote the latest news as the active primary card and refresh created_at to now()
    update public.stories
       set titles             = p_titles,
           summaries          = p_summaries,
           embedding          = p_embedding,
           completeness_score = greatest(coalesce(p_completeness, 50), v_old.completeness_score),
           media_url          = coalesce(nullif(trim(p_media_url), ''), v_old.media_url, v_ref_img),
           media_type         = coalesce(p_media_type, v_old.media_type),
           c2pa_verified      = p_c2pa or v_old.c2pa_verified,
           created_at         = now(),
           updated_at         = now()
     where id = v_dup.story_id;

    return query select v_dup.story_id, 'merged_timeline'::text;
  else
    insert into public.stories (
      author_id, category, location_name, lat, lng,
      titles, summaries, media_url, media_type, c2pa_verified,
      ai_probability_score, completeness_score, embedding, source,
      rollout_stage, credibility_score, created_at, updated_at
    ) values (
      p_author, p_category, p_location_name, p_lat, p_lng,
      p_titles, p_summaries, v_final_img, coalesce(p_media_type, 'image'), coalesce(p_c2pa, false),
      coalesce(p_ai_prob, 0), coalesce(p_completeness, 50), p_embedding, coalesce(p_source, 'citizen'),
      'public', 82.00, now(), now()
    )
    returning id into v_new;

    return query select v_new, 'created_primary'::text;
  end if;
end $$;
