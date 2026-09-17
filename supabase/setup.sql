-- =============================================================================
-- Neon Odyssey — Supabase setup
-- Run this once in your project's SQL editor (Supabase dashboard > SQL Editor).
-- It creates the tables, opens anon access (matching the Eapheron pattern:
-- obscurity + client-side dm-gate, no Auth yet), and seeds the lore reference.
--
-- SECURITY NOTE: with no Supabase Auth, the anon (publishable) key can reach
-- every table below via the REST API. dm_only notes and the DM tables are only
-- hidden by the pages not requesting them + the dm-gate PIN — NOT a hard wall.
-- Locking this down = Supabase Auth + Row Level Security, a later phase.
-- =============================================================================

-- ---- Player-facing --------------------------------------------------------
create table if not exists characters (
  id          uuid primary key default gen_random_uuid(),
  player_name text,                          -- who owns it (typed, no login yet)
  name        text not null,
  species     text,
  class_name  text,
  subclass    text,
  level       int  not null default 1,
  concept     text default '',
  sheet       jsonb default '{}'::jsonb,     -- room to grow the sheet
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists notes (
  id           uuid primary key default gen_random_uuid(),
  author_label text,                          -- "DM" or a player's name
  title        text not null,
  body         text not null default '',
  visibility   text not null default 'shared'
                 check (visibility in ('shared','dm_only')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---- DM-only --------------------------------------------------------------
create table if not exists npcs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text default '',                 -- e.g. "Bounty broker on Sleema"
  notes      text default '',
  created_at timestamptz not null default now()
);

create table if not exists encounters (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  summary    text default '',
  created_at timestamptz not null default now()
);

create table if not exists loot (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  value_notes text default '',                -- Galactic Notes value / rarity
  description text default '',
  awarded_to  text default '',
  created_at  timestamptz not null default now()
);

-- ---- Lore reference (player-facing) ---------------------------------------
create table if not exists lore_species (
  id    bigint generated always as identity primary key,
  name  text unique not null,
  blurb text default ''
);
create table if not exists lore_patrons (
  id     bigint generated always as identity primary key,
  name   text unique not null,
  domain text default '',
  blurb  text default ''
);
create table if not exists lore_glossary (
  id      bigint generated always as identity primary key,
  term    text unique not null,
  meaning text default ''
);

-- ---- Access policies ------------------------------------------------------
-- New Supabase tables have RLS on and deny-all by default. These permissive
-- policies let the anon key read/write (same posture as your Eapheron tools).
-- When you add Auth later, replace these with role-scoped policies.
do $$
declare t text;
begin
  foreach t in array array[
    'characters','notes','npcs','encounters','loot',
    'lore_species','lore_patrons','lore_glossary'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists anon_all on %I;', t);
    execute format(
      'create policy anon_all on %I for all to anon using (true) with check (true);', t);
  end loop;
end $$;

-- ---- Lore seed ------------------------------------------------------------
insert into lore_species (name, blurb) values
 ('Stardust Human', 'The galaxy''s most common folk; adaptable everypeople from many worlds.'),
 ('Aetheron', 'Dense, dwarf-like humanoids; masters of aether and gravity. Favoured by Khorabos the Architect.'),
 ('Anitron', 'Fully sapient robot constructs powered by Hypersparks, 3-7 ft tall, built for specialised functions.'),
 ('Isotron', 'Fully digital construct species from the Hypergrid, made of code and hard light.'),
 ('Bitling', 'Video-game-powered fey from Arcadia with wildly diverse looks; collect tokens.'),
 ('Navili', 'Small fairy-like folk from Polygonia with crystalline digital wings and three philosophical lineages.'),
 ('Glowblin', 'Goblin-like beings of Prismara with prismatic neon skin that shifts colour with emotion.'),
 ('Flambego', 'Flamingo-like tropical bird-folk from Prismara; can fly, drawn to relaxation and fun.'),
 ('Poggle', 'Small pig-like beings with rabbit ears, bat wings and spring tails. Favoured by Tykris the Dealer.'),
 ('Solari', 'Radiant elf-like humanoids from Adonia with gradient hair. Favoured by Alara the Lightbringer.'),
 ('Cygnian', 'Ascended mortals remade into starlight beings, their souls tied to Agathos.'),
 ('Nilari', 'Shadowy elf-like humanoids with draconic features from Val''Sha, born of Void Wyrm biology.'),
 ('Clawderan', 'Martial cat-like humanoids from stormy Goro with inherent combat prowess and weapons mastery.'),
 ('Raizo', 'Oni-like storm-powered humanoids from Goro, 6-7 ft tall, tied to thunder and lightning.'),
 ('Jozza', 'Orc-like aquatic beings from Kharabis with shark features and instincts for fighting many foes.'),
 ('Murexian', 'Amphibious mollusk-and-crustacean folk of the Kharabis oceans, capable of biological evolution.'),
 ('Benthos', 'Anglerfish-like humanoids with luminous lures, transformed by the Abyssal Void; shape Dark Matter.'),
 ('Laika', 'Anthropomorphic dog-people from Astrovega; cultures of aviation, science, loyalty and togetherness.'),
 ('Marsoom', 'Three-eyed bovine-like beings from Mavros with psionic abilities and diplomatic prowess.'),
 ('Jenovan', 'Nomadic psionic humanoids from bioengineering experiments; emphasise self-mastery and training.'),
 ('Saurian', 'Dinosaur-like humanoids from Krayta, diverse in shape with lineage-based natural weapons.'),
 ('Tekal', 'Stone construct beings from Krayta with souls drawn from the Harmony, powered by Harmony gemstones.'),
 ('Volcar', 'Large rocky elemental beings from Caldoa with internal magma, tied to fire and earth.'),
 ('Oculok', 'One-eyed subterranean beings from Morzebe; masters of metals and advanced mech engineering.'),
 ('Rangor', 'Broad ogre-like humanoids, 6-8 ft tall, tied to gravity with unstoppable forward momentum.'),
 ('Oozoid', 'Pliable ooze-based humanoids from Tibbulus whose nerves, eyes and organs form bipedal shapes.'),
 ('Amanite', 'Small mushroom-like folk from Sethreen who can grow temporarily and navigate dangerous swamps.'),
 ('Pakku', 'Plant-like beings resembling cacti and carnivorous plants from Sethreen''s deserts.'),
 ('Gorgonite', 'Gorgon-like humanoids from Sethreen with serpentine eyes and snake-hair tendrils; gaze powers.'),
 ('Greeble', 'Wormlike bipedal wanderers from Sleema specialising in intergalactic transport and commerce.'),
 ('Nematoan', 'Four-armed amphibious humanoids from Sleema who gain abilities by consuming non-sapient creatures.'),
 ('Skettik', 'Flightless vulture-like beings from Vulx, cursed with necromancy and bone-shaping.'),
 ('Discordant', 'Beings corrupted by the Cacophony into four types: Varg, Dathu, Terminox and Motlien.')
on conflict (name) do nothing;

insert into lore_patrons (name, domain, blurb) values
 ('Khorabos the Architect', 'Aether & gravity', 'Patron of the dense, stone-like Aetheron.'),
 ('Alara the Lightbringer', 'Suns & radiance', 'Patron of the radiant Solari.'),
 ('Tykris the Dealer', 'Luck & bargains', 'Patron of the lucky Poggle.'),
 ('Agathos', 'Starlight ascension', 'Binds the souls of the Cygnian, mortals remade as starlight.'),
 ('The Eldest', 'Primordial dreams', 'Primordial dreamers whose dreams birthed strange species.')
on conflict (name) do nothing;

insert into lore_glossary (term, meaning) values
 ('Stardust Rhapsody', 'The galaxy the campaign takes place in.'),
 ('Galactic Notes', 'The setting''s currency; the debt-driven economy keeps everyone short.'),
 ('Grand Cosmic Melody', 'The song of creation itself — the metaphysical backbone of the setting.'),
 ('Harmony', 'The force of order, light and connection; faithful souls return to it.'),
 ('Cacophony', 'The force of corruption and dissonance that warps beings into the Discordant.'),
 ('Discordant', 'Beings warped by the Cacophony (Varg, Dathu, Terminox, Motlien).'),
 ('Hyperspark', 'The spark that gives robots and constructs true sapience.'),
 ('Outrunner', 'The game term for a spacefaring adventurer — i.e. the players.')
on conflict (term) do nothing;

-- Species listed on the wiki but with no public description yet (pre-release stubs).
-- Placeholders — replace the blurbs once the books reveal them.
insert into lore_species (name, blurb) values
 ('Yaungu',    'A playable species of the Stardust Rhapsody. Full details not yet revealed in public previews.'),
 ('Yoggoth',   'A species created through the dreams of the Eldest. Full details not yet revealed in public previews.'),
 ('Zamani',    'A playable species of the Stardust Rhapsody. Full details not yet revealed in public previews.'),
 ('Zephursa',  'A playable species of the Stardust Rhapsody. Full details not yet revealed in public previews.'),
 ('Zeticulan', 'A playable species of the Stardust Rhapsody. Full details not yet revealed in public previews.'),
 ('Zorbrak',   'A playable species of the Stardust Rhapsody. Full details not yet revealed in public previews.')
on conflict (name) do nothing;
