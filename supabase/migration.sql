-- =============================================================================
-- Neon Odyssey — migration 02
-- Adds: character sheet fields, per-player notes, shared session summaries,
-- and a public storage bucket for character art.
-- Run once in the Supabase SQL Editor. Safe to re-run (idempotent).
-- =============================================================================

-- ---- character extra columns ----------------------------------------------
alter table characters add column if not exists art_url text;
alter table characters add column if not exists locked  boolean not null default false;
-- the full 5E sheet (abilities, skills, combat, currency, text sections) lives
-- in the existing `sheet` jsonb column.

-- ---- per-player personal notes --------------------------------------------
create table if not exists player_notes (
  id          uuid primary key default gen_random_uuid(),
  player_name text not null,
  title       text not null,
  body        text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_player_notes_player on player_notes(player_name);

-- ---- shared session summaries (everyone sees all) -------------------------
create table if not exists session_summaries (
  id          uuid primary key default gen_random_uuid(),
  author_name text,
  session_no  int,
  title       text not null,
  played_on   date,
  body        text default '',
  created_at  timestamptz not null default now()
);

-- ---- RLS + anon policies for the new tables -------------------------------
do $$
declare t text;
begin
  foreach t in array array['player_notes','session_summaries']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists anon_all on %I;', t);
    execute format(
      'create policy anon_all on %I for all to anon using (true) with check (true);', t);
  end loop;
end $$;

-- ---- character art storage bucket -----------------------------------------
insert into storage.buckets (id, name, public)
values ('character-art', 'character-art', true)
on conflict (id) do nothing;

-- allow the anon (publishable) key to upload / read / overwrite art
drop policy if exists "art anon read"   on storage.objects;
drop policy if exists "art anon insert" on storage.objects;
drop policy if exists "art anon update" on storage.objects;
create policy "art anon read"   on storage.objects for select to anon using (bucket_id = 'character-art');
create policy "art anon insert" on storage.objects for insert to anon with check (bucket_id = 'character-art');
create policy "art anon update" on storage.objects for update to anon using (bucket_id = 'character-art') with check (bucket_id = 'character-art');
