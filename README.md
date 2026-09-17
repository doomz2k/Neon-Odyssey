# Neon Odyssey — DM & Players Tool

A web app for running a **Neon Odyssey** tabletop campaign (the Legends of Avantris
space-opera setting). Players manage character sheets, browse the setting's lore, and
share campaign notes; the DM gets a PIN-gated console for NPCs, encounters, loot, and
secret notes.

Built to match the **Eapheron** stack: static pages + Supabase + a client-side
`dm-gate.js`. No server to run or deploy.

> Neon Odyssey is a pre-release setting. The seeded lore is summarised from public
> previews and the community wiki and may change before the books ship.

## Stack

- **Static HTML/CSS/JS** — no build step, no Node server
- **Supabase** (hosted Postgres) — data + REST API, reached with the `supabase-js`
  client from the CDN
- **`js/dm-gate.js`** — client-side PIN gate that keeps players out of the DM pages

## Access model (deliberately light)

- **Players** don't log in (yet). They set a display name (remembered on their
  device) which tags the characters they create. They see characters, the lore
  browser, and *shared* notes.
- **The DM area** (`dm.html`) is gated by `js/dm-gate.js` — a PIN checked in the
  browser and remembered in `localStorage`. The player pages simply never request
  DM data (`dm_only` notes, NPCs, encounters, loot).

This is **obscurity + a light PIN, not real security** — exactly the Eapheron
posture. With no Supabase Auth, the anon key can technically reach every table via
the REST API; the gate stops casual poking, not a determined user. Hardening =
Supabase Auth + Row Level Security, a later phase (see `supabase/setup.sql`).

## Setup

1. **Create a Supabase project** (free tier) at <https://supabase.com>. A *separate*
   project from Eapheron keeps the two campaigns fully isolated.
2. In the dashboard, open **SQL Editor** and run **`supabase/setup.sql`** — it
   creates the tables, opens anon access, and seeds the lore.
3. In **Project Settings > API**, copy the **Project URL** and the **anon/public
   (publishable)** key into **`js/supabase-config.js`** (replace the two
   placeholders). The anon key is a client-side key — do **not** use the
   `service_role` secret key here.
4. Serve the folder as static files (any static host — your droplet's Nginx, or
   `npx serve .` locally to try it). Open `/` for players, `/dm.html` for the DM.
5. **Change the DM PIN**: edit `DM_PIN` at the top of `js/dm-gate.js`.

## Project layout

```
index.html            player app (characters, lore, notes)
dm.html               DM console (behind dm-gate.js)
js/
  supabase-config.js  your Supabase URL + anon key (fill in the placeholders)
  dm-gate.js          client-side PIN gate (edit DM_PIN)
  app.js              player-side Supabase logic
  dm-common.js        DM-side Supabase logic
css/style.css         neon theme
supabase/setup.sql    run once in the Supabase SQL editor (schema + policies + lore)
```

## Roadmap

- Richer character sheet (stats, gear, abilities) beyond name/species/class/concept
- Editing existing rows in the UI (delete + create are wired; edit is next)
- Real accounts + per-player ownership via **Supabase Auth + RLS** (also the
  Eapheron "later phase") — this is what turns the light gate into real security
- Optional live session sync
