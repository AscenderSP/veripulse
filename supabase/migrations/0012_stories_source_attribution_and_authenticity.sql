-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0012_stories_source_attribution_and_authenticity.sql
--
--  Adds per-story source attribution (publisher name, canonical URL,
--  license tag) and an AI-derived authenticity score + flags. The crawler
--  populates these for every wire story; the citizen-report path leaves
--  them null (attribution = the reporter themselves).
--
--  Idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

alter table public.stories
  add column if not exists source_name text;
alter table public.stories
  add column if not exists source_url text;
alter table public.stories
  add column if not exists source_license text
  default null
  check (
    source_license is null
    or source_license in (
      'public_domain',          -- PIB India, government portals
      'cc_by',                  -- Wikimedia Commons, CC-BY
      'cc_by_nd',               -- The Conversation, some Creative Commons
      'cc_by_sa',               -- CC-BY-SA
      'fair_use_summary',       -- Paraphrased headline + attribution (default)
      'press_release',          -- Vendor / NGO press releases
      'wire_service'            -- Reuters/AP/PTI via aggregator
    )
  );
alter table public.stories
  add column if not exists authenticity_score numeric(5,2)
  check (authenticity_score is null or authenticity_score between 0 and 100);
alter table public.stories
  add column if not exists authenticity_flags jsonb default '[]'::jsonb not null;
alter table public.stories
  add column if not exists authenticity_checked_at timestamptz;

-- Index for admin "low authenticity" dashboards and the right-rail "verified
-- wires" ticker.
create index if not exists stories_authenticity_score_idx
  on public.stories (authenticity_score)
  where authenticity_score is not null;
create index if not exists stories_source_name_idx
  on public.stories (source_name)
  where source_name is not null;
