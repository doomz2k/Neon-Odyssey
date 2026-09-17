'use strict';

// Player-side logic. One character sheet per player, plus personal Notes and
// shared Session Summaries. Uses helpers from sheet.js and the `sb` client.

const PLAYERS = ['Ben', 'Franc', 'Dom', 'Paddy', 'Hendri'];
const ART_BUCKET = 'character-art';

const $ = (id) => document.getElementById(id);
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function msg(el, text, kind = 'error') { el.innerHTML = text ? `<div class="msg ${kind}">${text}</div>` : ''; }

const PLAYER_KEY = 'neon-odyssey-player';
const cur = () => { try { return localStorage.getItem(PLAYER_KEY) || ''; } catch (e) { return ''; } };
const setCur = (v) => { try { localStorage.setItem(PLAYER_KEY, v); } catch (e) {} };
const clearCur = () => { try { localStorage.removeItem(PLAYER_KEY); } catch (e) {} };

const sheetEl = () => $('sheet');
let state = { id: null, art_url: null, locked: false };
let loreCache = { species: [], patrons: [], glossary: [] };
let loreLoaded = false;

// --- main menu --------------------------------------------------------------
function renderSelect() {
  $('playerCards').innerHTML = PLAYERS.map((p) =>
    `<button class="card player-card" data-player="${esc(p)}">
       <div class="pc-avatar">${esc(p[0])}</div><div class="pc-name">${esc(p)}</div>
     </button>`).join('');
  document.querySelectorAll('.player-card').forEach((b) => (b.onclick = () => enterAs(b.dataset.player)));
}
function enterAs(name) { setCur(name); showApp(); }
function showSelect() {
  $('appView').classList.add('hidden'); $('selectView').classList.remove('hidden');
  $('whoBadge').classList.add('hidden');
}
function showApp() {
  if (!PLAYERS.includes(cur())) { showSelect(); return; }
  $('selectView').classList.add('hidden'); $('appView').classList.remove('hidden');
  $('whoName').textContent = cur(); $('whoBadge').classList.remove('hidden');
  if (!loreLoaded) loadLore();
  loadSheet();
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
      if (btn.dataset.tab === 'summaries') loadSummaries();
    };
  });
}

// --- character sheet --------------------------------------------------------
function applyLockUI() {
  setSheetDisabled(sheetEl(), state.locked);
  $('artInput').disabled = state.locked;
  $('saveBtn').classList.toggle('hidden', state.locked);
  $('lockBtn').textContent = state.locked ? '🔓 Unlock' : '🔒 Lock';
  $('lockState').textContent = state.locked ? '🔒 Locked — read-only' : 'Editable';
}

async function loadSheet() {
  const { data, error } = await sb.from('characters')
    .select('*').eq('player_name', cur()).order('created_at', { ascending: true }).limit(1);
  if (error) { msg($('sheetMsg'), error.message); return; }
  const row = data && data[0];
  if (row) {
    state.id = row.id; state.art_url = row.art_url || null; state.locked = !!row.locked;
    applySheet(sheetEl(), row.sheet || {});
  } else {
    state = { id: null, art_url: null, locked: false };
    applySheet(sheetEl(), {});
  }
  renderArt();
  recompute(sheetEl());
  applyLockUI();
}

async function saveSheet() {
  if (state.locked) return;
  const s = collectSheet(sheetEl());
  const row = {
    player_name: cur(),
    name: s.name || 'Unnamed Outrunner',
    species: s.species || null,
    class_name: s.class || null,
    subclass: s.subclass || null,
    level: Math.max(1, Math.min(20, parseInt(s.level, 10) || 1)),
    art_url: state.art_url,
    locked: state.locked,
    sheet: s,
  };
  let res;
  if (state.id) res = await sb.from('characters').update(row).eq('id', state.id).select('id').single();
  else res = await sb.from('characters').insert(row).select('id').single();
  if (res.error) { msg($('sheetMsg'), res.error.message); return; }
  state.id = res.data.id;
  msg($('sheetMsg'), 'Saved.', 'ok');
}

async function toggleLock() {
  state.locked = !state.locked;
  applyLockUI();
  // persist the lock (and current field values if we were editable)
  const s = collectSheet(sheetEl());
  const row = {
    player_name: cur(), name: s.name || 'Unnamed Outrunner', species: s.species || null,
    class_name: s.class || null, subclass: s.subclass || null,
    level: Math.max(1, Math.min(20, parseInt(s.level, 10) || 1)),
    art_url: state.art_url, locked: state.locked, sheet: s,
  };
  let res;
  if (state.id) res = await sb.from('characters').update(row).eq('id', state.id).select('id').single();
  else res = await sb.from('characters').insert(row).select('id').single();
  if (!res.error && res.data) state.id = res.data.id;
  msg($('sheetMsg'), state.locked ? 'Sheet locked.' : 'Sheet unlocked.', 'ok');
}

function renderArt() {
  const el = $('artPreview');
  if (state.art_url) el.innerHTML = `<img src="${esc(state.art_url)}" alt="character art" />`;
  else el.textContent = 'No art';
}

async function uploadArt(file) {
  if (!file) return;
  msg($('artMsg'), 'Uploading…', 'ok');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${cur()}/${Date.now()}.${ext}`;
  const up = await sb.storage.from(ART_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (up.error) { msg($('artMsg'), up.error.message); return; }
  const { data } = sb.storage.from(ART_BUCKET).getPublicUrl(path);
  state.art_url = data.publicUrl;
  renderArt();
  msg($('artMsg'), '');
  await saveSheet(); // persist the new art url
}

// --- personal notes ---------------------------------------------------------
async function loadNotes() {
  const el = $('noteList');
  const { data, error } = await sb.from('player_notes')
    .select('*').eq('player_name', cur()).order('updated_at', { ascending: false });
  if (error) { el.innerHTML = `<div class="msg error">${esc(error.message)}</div>`; return; }
  el.innerHTML = data.length ? '' : '<p class="muted">No notes yet.</p>';
  for (const n of data) {
    const d = document.createElement('div'); d.className = 'card';
    d.innerHTML = `<h3>${esc(n.title)}</h3>
      <div class="meta">${esc((n.updated_at || '').slice(0, 16).replace('T', ' '))}</div>
      <p>${esc(n.body).replace(/\n/g, '<br>')}</p>
      <div style="margin-top:8px;"><button class="btn danger small" data-del="${n.id}">Delete</button></div>`;
    d.querySelector('[data-del]').onclick = async () => { await sb.from('player_notes').delete().eq('id', n.id); loadNotes(); };
    el.appendChild(d);
  }
}
async function addNote() {
  const title = $('n-title').value.trim();
  if (!title) { msg($('notesMsg'), 'A title is required.'); return; }
  const { error } = await sb.from('player_notes').insert({ player_name: cur(), title, body: $('n-body').value });
  if (error) { msg($('notesMsg'), error.message); return; }
  $('n-title').value = ''; $('n-body').value = ''; msg($('notesMsg'), 'Saved.', 'ok'); loadNotes();
}

// --- shared session summaries -----------------------------------------------
async function loadSummaries() {
  const el = $('sumList');
  const { data, error } = await sb.from('session_summaries')
    .select('*').order('session_no', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  if (error) { el.innerHTML = `<div class="msg error">${esc(error.message)}</div>`; return; }
  el.innerHTML = data.length ? '' : '<p class="muted">No summaries yet.</p>';
  for (const s of data) {
    const d = document.createElement('div'); d.className = 'card';
    const head = (s.session_no != null ? `Session ${esc(s.session_no)} · ` : '') + esc(s.title);
    d.innerHTML = `<h3>${head}</h3>
      <div class="meta">by ${esc(s.author_name || '—')}${s.played_on ? ' · ' + esc(s.played_on) : ''}</div>
      <p>${esc(s.body).replace(/\n/g, '<br>')}</p>
      <div style="margin-top:8px;"><button class="btn danger small" data-del="${s.id}">Delete</button></div>`;
    d.querySelector('[data-del]').onclick = async () => { await sb.from('session_summaries').delete().eq('id', s.id); loadSummaries(); };
    el.appendChild(d);
  }
}
async function addSummary() {
  const title = $('s-title').value.trim();
  if (!title) { msg($('sumMsg'), 'A title is required.'); return; }
  const row = {
    author_name: cur(),
    session_no: $('s-no').value === '' ? null : Number($('s-no').value),
    title, played_on: $('s-date').value || null, body: $('s-body').value,
  };
  const { error } = await sb.from('session_summaries').insert(row);
  if (error) { msg($('sumMsg'), error.message); return; }
  ['s-no', 's-title', 's-date', 's-body'].forEach((id) => ($(id).value = ''));
  msg($('sumMsg'), 'Posted.', 'ok'); loadSummaries();
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
  $('speciesSelect').innerHTML = '<option value="">— species —</option>' +
    loreCache.species.map((s) => `<option>${esc(s.name)}</option>`).join('');
  // re-apply the saved species now the options exist
  if (state.id) sb.from('characters').select('sheet').eq('id', state.id).single()
    .then(({ data }) => { if (data && data.sheet && data.sheet.species) $('speciesSelect').value = data.sheet.species; });
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
  buildSheetControls();
  renderSelect();
  wireTabs();
  $('switchBtn').onclick = () => { clearCur(); showSelect(); };
  $('saveBtn').onclick = saveSheet;
  $('lockBtn').onclick = toggleLock;
  $('artInput').onchange = (e) => uploadArt(e.target.files[0]);
  $('n-create').onclick = addNote;
  $('s-create').onclick = addSummary;
  sheetEl().addEventListener('input', () => recompute(sheetEl()));
  $('loreSearch').oninput = (e) => {
    const q = e.target.value.toLowerCase();
    renderSpecies(loreCache.species.filter((s) =>
      s.name.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q)));
  };
  if (PLAYERS.includes(cur())) showApp(); else showSelect();
});
