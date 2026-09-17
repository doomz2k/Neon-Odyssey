-- =============================================================================
-- Neon Odyssey — migration 02 (SAFE / minimal)
-- Run this in the Supabase SQL Editor. It only creates the two new tables the
-- Notes and Session Summary pages need. Character sheets need NO migration —
-- everything is stored in the existing `characters.sheet` jsonb column.
--
-- NOTE: character art upload uses a Storage bucket. Storage buckets/policies
-- are set up in the DASHBOARD (Storage section), not here, because storage
-- policy SQL can fail with a permissions error and roll back the whole script.
-- See README / the chat for the two-click dashboard steps. Until then, players
-- can paste an image URL instead of uploading — that needs no setup.
-- =============================================================================

create table if not exists player_notes (
  id          uuid primary key default gen_random_uuid(),
  player_name text not null,
  title       text not null,
  body        text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_player_notes_player on player_notes(player_name);

create table if not exists session_summaries (
  id          uuid primary key default gen_random_uuid(),
  author_name text,
  session_no  int,
  title       text not null,
  played_on   date,
  body        text default '',
  created_at  timestamptz not null default now()
);

alter table player_notes      enable row level security;
alter table session_summaries enable row level security;
drop policy if exists anon_all on player_notes;
drop policy if exists anon_all on session_summaries;
create policy anon_all on player_notes      for all to anon using (true) with check (true);
create policy anon_all on session_summaries for all to anon using (true) with check (true);
