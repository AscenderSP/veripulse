-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — 0005b_stories_admin_columns_catchup.sql
--
--  Admin takedown columns on `stories` that 0007 and /api/admin/posts
--  reference but which no prior migration created (schema drift: these
--  columns were originally added via the Supabase dashboard).
--
--  Idempotent (`add column if not exists`), safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

alter table public.stories
  add column if not exists admin_taken_down boolean default false not null;
alter table public.stories
  add column if not exists takedown_reason  text;
alter table public.stories
  add column if not exists taken_down_at    timestamptz;
alter table public.stories
  add column if not exists taken_down_by    uuid references public.profiles(id) on delete set null;

create index if not exists stories_admin_taken_down_idx
  on public.stories (admin_taken_down) where admin_taken_down = true;
