'use strict';

// Player-side logic. Talks directly to Supabase via the `sb` client from
// supabase-config.js. No login — the player picks who they are from a fixed
// roster on the main menu, remembered on this device.

// ---- Prebaked player roster. Edit this list to add/rename players. ----
const PLAYERS = ['Ben', 'Franc', 'Dom', 'Paddy', 'Hendri'];

const $ = (id) => document.getElementById(id);
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function msg(el, text, kind = 'error') { el.innerHTML = text ? `<div class="msg ${kind}">${text}</div>` : ''; }

const PLAYER_KEY = 'neon-odyssey-player';
function currentPlayer() { try { return localStorage.getItem(PLAYER_KEY) || ''; } catch (e) { return ''; } }
function setPlayer(v) { try { localStorage.setItem(PLAYER_KEY, v); } catch (e) {} }
function clearPlayer() { try { localStorage.removeItem(PLAYER_KEY); } catch (e) {} }

let loreCache = { species: [], patrons: [], glossary: [] };
let loreLoaded = false;

// --- main menu (player select) ----------------------------------------------
function renderSelect() {
  $('playerCards').innerHTML = PLAYERS.map((p) =>
    `<button class="card player-card" data-player="${esc(p)}">
       <div class="pc-avatar">${esc(p[0])}</div>
       <div class="pc-name">${esc(p)}</div>
     </button>`).join('');
  document.querySelectorAll('.player-card').forEach((btn) => {
    btn.onclick = () => enterAs(btn.dataset.player);
  });
}

function enterAs(name) {
  setPlayer(name);
  showApp();
}
function showSelect() {
  $('appView').classList.add('hidden');
  $('selectView').classList.remove('hidden');
  $('whoBadge').classList.add('hidden');
}
function showApp() {
  const p = currentPlayer();
  if (!PLAYERS.includes(p)) { showSelect(); return; }
  $('selectView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  $('whoName').textContent = p;
  $('whoBadge').classList.remove('hidden');
  $('charListTitle').textContent = p + "'s characters";
  if (!loreLoaded) loadLore();
  loadCharacters();
}

// --- tabs -------------------------------------------------------------------
function wireTabs() {
  document.querySelectorAll('nav.tabs button').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('nav.tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tabpane').forEach((p) => p.classList.add('hidden'));
      $('tab-' + btn.dataset.tab).classList.remove('hidden');
      if (btn.dataset.tab === 'notes') loadNotes();
      if (btn.dataset.tab === 'characters') loadCharacters();
    };
  });
}

// --- characters (scoped to the selected player) -----------------------------
async function loadCharacters() {
  const el = $('charList');
  const { data, error } = await sb
    .from('characters')
    .select('id,name,species,class_name,subclass,level')
    .eq('player_name', currentPlayer())
    .order('created_at', { ascending: false });
  if (error) { el.innerHTML = `<div class="msg error">${esc(error.message)}</div>`; return; }
  el.innerHTML = data.length ? '' : '<p class="muted">No characters yet — create your first Outrunner above.</p>';
  for (const c of data) {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<h3>${esc(c.name)}</h3>
      <div class="meta">${esc(c.species || '—')} · ${esc(c.class_name || 'Class TBD')}${c.subclass ? ' / ' + esc(c.subclass) : ''} · Lv ${c.level}</div>
      <div style="margin-top:8px;"><button class="btn danger small" data-del="${c.id}">Delete</button></div>`;
    div.querySelector('[data-del]').onclick = async () => {
      if (!confirm('Delete ' + c.name + '?')) return;
      await sb.from('characters').delete().eq('id', c.id);
      loadCharacters();
    };
    el.appendChild(div);
  }
}

async function createCharacter() {
  const row = {
    player_name: currentPlayer(),
    name: $('c-name').value.trim() || 'Unnamed Outrunner',
    species: $('c-species').value || null,
    class_name: $('c-class').value.trim() || null,
    subclass: $('c-subclass').value.trim() || null,
    level: Math.max(1, Math.min(20, parseInt($('c-level').value, 10) || 1)),
    concept: $('c-concept').value.trim(),
  };
  const { error } = await sb.from('characters').insert(row);
  if (error) { msg($('charMsg'), error.message); return; }
  ['c-name', 'c-class', 'c-subclass', 'c-concept'].forEach((id) => ($(id).value = ''));
  $('c-level').value = 1;
  msg($('charMsg'), 'Character saved.', 'ok');
  loadCharacters();
}

// --- notes ------------------------------------------------------------------
async function loadNotes() {
  const el = $('noteList');
  const { data, error } = await sb
    .from('notes').select('id,author_label,title,body,visibility,updated_at')
    .eq('visibility', 'shared')
    .order('updated_at', { ascending: false });
  if (error) { el.innerHTML = `<div class="msg error">${esc(error.message)}</div>`; return; }
  el.innerHTML = data.length ? '' : '<p class="muted">No notes yet.</p>';
  for (const n of data) {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<h3>${esc(n.title)} <span class="badge shared">SHARED</span></h3>
      <div class="meta">${esc(n.author_label || 'Unknown')} · ${esc((n.updated_at || '').slice(0, 16).replace('T', ' '))}</div>
      <p>${esc(n.body).replace(/\n/g, '<br>')}</p>`;
    el.appendChild(div);
  }
}
async function postNote() {
  const title = $('n-title').value.trim();
  if (!title) { msg($('notesMsg'), 'A title is required.'); return; }
  const { error } = await sb.from('notes').insert({
    author_label: currentPlayer(), title, body: $('n-body').value, visibility: 'shared',
  });
  if (error) { msg($('notesMsg'), error.message); return; }
  $('n-title').value = ''; $('n-body').value = '';
  msg($('notesMsg'), 'Note posted.', 'ok');
  loadNotes();
}

// --- lore -------------------------------------------------------------------
async function loadLore() {
  const [sp, pa, gl] = await Promise.all([
    sb.from('lore_species').select('name,blurb').order('name'),
    sb.from('lore_patrons').select('name,domain,blurb').order('name'),
    sb.from('lore_glossary').select('term,meaning').order('term'),
  ]);
  if (sp.error) { $('speciesList').innerHTML = `<div class="msg error">${esc(sp.error.message)}</div>`; return; }
  loreLoaded = true;
  loreCache = { species: sp.data || [], patrons: pa.data || [], glossary: gl.data || [] };
  $('c-species').innerHTML = '<option value="">— species —</option>' +
    loreCache.species.map((s) => `<option>${esc(s.name)}</option>`).join('');
  renderSpecies(loreCache.species);
  $('patronList').innerHTML = loreCache.patrons.map((p) =>
    `<div class="card"><h3>${esc(p.name)}</h3><div class="meta">${esc(p.domain)}</div><p class="small">${esc(p.blurb)}</p></div>`).join('');
  $('glossaryList').innerHTML = loreCache.glossary.map((g) =>
    `<div class="card"><h3>${esc(g.term)}</h3><p class="small">${esc(g.meaning)}</p></div>`).join('');
}
function renderSpecies(rows) {
  $('speciesList').innerHTML = rows.map((s) =>
    `<div class="card"><h3>${esc(s.name)}</h3><p class="small">${esc(s.blurb)}</p></div>`).join('');
}

// --- boot -------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  renderSelect();
  wireTabs();
  $('c-create').onclick = createCharacter;
  $('n-create').onclick = postNote;
  $('switchBtn').onclick = () => { clearPlayer(); showSelect(); };
  $('loreSearch').oninput = (e) => {
    const q = e.target.value.toLowerCase();
    renderSpecies(loreCache.species.filter((s) =>
      s.name.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q)));
  };
  // Return to the app if a player was already chosen on this device.
  if (PLAYERS.includes(currentPlayer())) showApp(); else showSelect();
});
