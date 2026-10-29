-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0010_cinema_sentinel.sql
--  "Cinema Sentinel" — anti-bot movie review gate.
--
--  Three verification pillars enforced by the schema + RPCs:
--    1. Ticket ownership       — SHA-256 hash with a UNIQUE constraint so
--                                 one seat on one show == one review.
--    2. Temporal gate          — review window opens after
--                                 show_time + runtime + interval buffer.
--    3. 500 m geo-fence        — ST_DWithin against cinema lat/lng.
--
--  Review payouts land in public.master_transactions under
--  'movie_critic_reward' so the Wallet already sees them.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ─── Cinemas ─────────────────────────────────────────────────────────────
create table if not exists public.cinemas (
  id          text primary key,                       -- 'pvr-south-city-kol'
  name        text not null,
  chain       text,                                   -- PVR, INOX, Cinepolis…
  city        text,
  address     text,
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz default now() not null
);
create index if not exists cinemas_city on public.cinemas (city);
alter table public.cinemas enable row level security;
drop policy if exists cinemas_select on public.cinemas;
create policy cinemas_select on public.cinemas
  for select to anon, authenticated using (true);

-- ─── Movies ──────────────────────────────────────────────────────────────
create table if not exists public.movies (
  id                  text primary key,               -- slug
  title               text not null,
  language            text,                           -- 'hi' | 'bn' | …
  duration_minutes    integer not null check (duration_minutes between 30 and 300),
  interval_minutes    integer default 15 not null,
  release_date        date,
  poster_url          text,
  critic_hype_score   numeric(4,2),                   -- pre-release critic avg (0-10)
  reality_gap_sum     numeric default 0 not null,     -- running sum for crowd-reality metric
  reality_gap_count   integer default 0 not null,
  created_at          timestamptz default now() not null
);
alter table public.movies enable row level security;
drop policy if exists movies_select on public.movies;
create policy movies_select on public.movies
  for select to anon, authenticated using (true);

-- ─── Tickets (verified ownership claim) ──────────────────────────────────
-- A row is created when a user submits proof of purchase (BookMyShow QR,
-- PVR/INOX PDF, or OCR'd paper stub). The hash is SHA-256 of
--   movie_id | cinema_id | show_time_iso | seat_no | booking_id
-- which rejects duplicates at insert time via the UNIQUE constraint.
create table if not exists public.movie_tickets (
  id                 uuid default gen_random_uuid() primary key,
  user_id            uuid references public.profiles(id) on delete cascade not null,
  movie_id           text references public.movies(id) on delete cascade not null,
  cinema_id          text references public.cinemas(id) on delete cascade not null,
  show_time          timestamptz not null,                 -- scheduled start
  seat_no            text not null,
  booking_id         text not null,
  ticket_claim_hash  text not null unique,                 -- defence #1
  source             text not null check (source in ('qr_bookmyshow', 'ocr_photo', 'manual')),
  verified_at        timestamptz default now() not null,
  consumed_at        timestamptz,                           -- set when review posts
  created_at         timestamptz default now() not null
);
create index if not exists movie_tickets_user on public.movie_tickets (user_id, created_at desc);
create index if not exists movie_tickets_movie on public.movie_tickets (movie_id, show_time desc);

alter table public.movie_tickets enable row level security;
drop policy if exists movie_tickets_select_self on public.movie_tickets;
create policy movie_tickets_select_self on public.movie_tickets
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ─── Reviews ─────────────────────────────────────────────────────────────
-- One review per ticket (ticket_id UNIQUE). ratings jsonb carries the five
-- 1-10 parameters: pacing, theater, acting, rewatch, reality_gap.
create table if not exists public.movie_reviews (
  id                 uuid default gen_random_uuid() primary key,
  ticket_id          uuid references public.movie_tickets(id) on delete cascade not null unique,
  user_id            uuid references public.profiles(id) on delete cascade not null,
  movie_id           text references public.movies(id) on delete cascade not null,
  cinema_id          text references public.cinemas(id) on delete cascade not null,
  ratings            jsonb not null,                        -- {pacing, theater, acting, rewatch, reality_gap}
  overall_score      numeric(4,2) not null,                 -- avg of the five
  reality_gap        numeric(4,2) not null,                 -- stored again for aggregates
  verdict            text not null check (char_length(verdict) between 1 and 220),
  spoiler            boolean default false not null,
  selfie_url         text,                                   -- optional Cine-Pass proof
  distance_meters    integer not null check (distance_meters between 0 and 2000),
  reward_vp          integer not null default 0,             -- VPcoins paid
  window_tier        text not null check (window_tier in ('fdfs', 'day1', 'standard', 'bonus')),
  edit_locked_at     timestamptz not null,                   -- 10 min grace after insert
  created_at         timestamptz default now() not null
);
create index if not exists movie_reviews_movie on public.movie_reviews (movie_id, created_at desc);
create index if not exists movie_reviews_user  on public.movie_reviews (user_id, created_at desc);

alter table public.movie_reviews enable row level security;
drop policy if exists movie_reviews_select on public.movie_reviews;
create policy movie_reviews_select on public.movie_reviews
  for select to anon, authenticated using (true);
drop policy if exists movie_reviews_update_self on public.movie_reviews;
create policy movie_reviews_update_self on public.movie_reviews
  for update to authenticated
  using (user_id = auth.uid() and edit_locked_at > now())
  with check (user_id = auth.uid() and edit_locked_at > now());

-- Any insert/delete goes through the service role via the submit RPC
-- below; no direct insert policy is granted on purpose.

-- ─── Submit review RPC — three-pillar gate in SQL ────────────────────────
create or replace function public.submit_cinema_review(
  p_ticket_id       uuid,
  p_ratings         jsonb,
  p_verdict         text,
  p_spoiler         boolean,
  p_selfie_url      text,
  p_user_lat        double precision,
  p_user_lng        double precision
)
returns table (
  review_id    uuid,
  reward_vp    integer,
  window_tier  text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_ticket      public.movie_tickets%rowtype;
  v_movie       public.movies%rowtype;
  v_cinema      public.cinemas%rowtype;
  v_unlock_at   timestamptz;
  v_distance_m  integer;
  v_overall     numeric;
  v_reality_gap numeric;
  v_reward      integer;
  v_tier        text;
  v_now         timestamptz := now();
  v_review_id   uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- Pillar 1: ticket must exist, belong to the caller, and be unused.
  select * into v_ticket from public.movie_tickets
    where id = p_ticket_id and user_id = v_user_id;
  if not found then
    raise exception 'TICKET_NOT_FOUND' using errcode = '22023';
  end if;
  if v_ticket.consumed_at is not null then
    raise exception 'TICKET_ALREADY_USED' using errcode = '23505';
  end if;

  select * into v_movie  from public.movies  where id = v_ticket.movie_id;
  select * into v_cinema from public.cinemas where id = v_ticket.cinema_id;

  -- Pillar 2: temporal gate.
  v_unlock_at := v_ticket.show_time
                 + make_interval(mins => v_movie.duration_minutes + v_movie.interval_minutes);
  if v_now < v_unlock_at then
    raise exception 'TOO_EARLY' using errcode = '22023';
  end if;
  -- Review window closes 4h after unlock.
  if v_now > v_unlock_at + interval '4 hours' then
    raise exception 'WINDOW_CLOSED' using errcode = '22023';
  end if;

  -- Pillar 3: 500 m geo-fence — spherical haversine on EPSG:4326.
  v_distance_m := round(
    ST_DistanceSphere(
      ST_SetSRID(ST_MakePoint(v_cinema.lng, v_cinema.lat), 4326),
      ST_SetSRID(ST_MakePoint(p_user_lng,   p_user_lat),   4326)
    )
  )::integer;
  if v_distance_m > 500 then
    raise exception 'OUT_OF_FENCE' using errcode = '22023';
  end if;

  -- Score + reality-gap derive from the ratings payload.
  v_overall := round(((
    coalesce((p_ratings->>'pacing')::numeric, 0) +
    coalesce((p_ratings->>'theater')::numeric, 0) +
    coalesce((p_ratings->>'acting')::numeric, 0) +
    coalesce((p_ratings->>'rewatch')::numeric, 0) +
    coalesce((p_ratings->>'reality_gap')::numeric, 0)
  ) / 5.0)::numeric, 2);
  v_reality_gap := coalesce((p_ratings->>'reality_gap')::numeric, 0);

  -- FDFS reward decay (minutes past unlock → tier + VPcoin reward).
  if v_now - v_unlock_at < interval '30 minutes' then
    v_reward := 50; v_tier := 'fdfs';
  elsif v_now - v_unlock_at < interval '2 hours' then
    v_reward := 30; v_tier := 'day1';
  else
    v_reward := 15; v_tier := 'standard';
  end if;

  insert into public.movie_reviews (
    ticket_id, user_id, movie_id, cinema_id,
    ratings, overall_score, reality_gap,
    verdict, spoiler, selfie_url,
    distance_meters, reward_vp, window_tier,
    edit_locked_at
  ) values (
    v_ticket.id, v_user_id, v_movie.id, v_cinema.id,
    p_ratings, v_overall, v_reality_gap,
    p_verdict, coalesce(p_spoiler, false), p_selfie_url,
    v_distance_m, v_reward, v_tier,
    v_now + interval '10 minutes'
  )
  returning id into v_review_id;

  update public.movie_tickets
     set consumed_at = v_now
   where id = v_ticket.id;

  update public.movies
     set reality_gap_sum   = reality_gap_sum   + v_reality_gap,
         reality_gap_count = reality_gap_count + 1
   where id = v_movie.id;

  -- Credit the VPcoin reward via the master ledger. Idempotency key is
  -- the ticket id so retries never double-pay.
  insert into public.master_transactions (
    user_id, type, amount_inr, ref_id, meta
  ) values (
    v_user_id, 'movie_critic_reward',
    v_reward::numeric / 10.0,            -- 10 VPcoins == ₹1 (demo rate)
    v_ticket.id::text,
    jsonb_build_object(
      'movie_id', v_movie.id,
      'cinema_id', v_cinema.id,
      'tier', v_tier,
      'distance_meters', v_distance_m
    )
  ) on conflict do nothing;

  return query select v_review_id, v_reward, v_tier;
end;
$$;

revoke all on function public.submit_cinema_review(uuid, jsonb, text, boolean, text, double precision, double precision) from public;
grant execute on function public.submit_cinema_review(uuid, jsonb, text, boolean, text, double precision, double precision) to authenticated;
