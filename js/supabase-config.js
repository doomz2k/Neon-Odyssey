// Shared Supabase configuration for Neon Odyssey.
// Loaded AFTER the Supabase CDN script on every page:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="/js/supabase-config.js"></script>
//
// Fill these in from your Supabase project:
//   Dashboard > Project Settings > API
//     - "Project URL"            -> SUPABASE_URL
//     - "Project API keys" > anon/public (publishable) -> SUPABASE_ANON_KEY
//
// The anon key is a *publishable* client-side key (same as Eapheron's) — it is
// meant to live in the browser. It is NOT the service_role/secret key; never
// put the service_role key in here or anywhere client-side.
//
// Auth: none for now — obscurity + the dm-gate PIN, matching the Eapheron
// tools. Supabase Auth + Row Level Security is a later phase.

const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLISHABLE-KEY';

// Exposed globally for the page scripts.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
