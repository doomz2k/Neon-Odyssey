'use strict';

// DM-side logic. Runs only after dm-gate.js has let the page through. Talks to
// Supabase via `sb` from supabase-config.js.

const $ = (id) => document.getElementById(id);
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- tabs -------------------------------------------------------------------
document.querySelectorAll('nav.tabs button').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('nav.tabs button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tabpane').forEach((p) => p.classList.add('hidden'));
    $('tab-' + btn.dataset.tab).classList.remove('hidden');
  };
});

// Generic renderer with delete.
async function loadInto(table, el, fields, order = 'created_at') {
  const { data, error } = await sb.from(table).select('*').order(order, { ascending: false });
  if (error) { el.innerHTML = `<div class="msg error">${esc(error.message)}</div>`; return; }
  el.innerHTML = data.length ? '' : '<p class="muted">Nothing here yet.</p>';
  for (const r of data) {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = fields(r) +
      `<div style="margin-top:8px;"><button class="btn danger small" data-del="${r.id}">Delete</button></div>`;
    div.querySelector('[data-del]').onclick = async () => {
      await sb.from(table).delete().eq('id', r.id);
      loadAll();
    };
    el.appendChild(div);
  }
}

// --- NPCs -------------------------------------------------------------------
function loadNpcs() {
  return loadInto('npcs', $('npc-list'), (r) =>
    `<h3>${esc(r.name)}</h3><div class="meta">${esc(r.role || '')}</div><p class="small">${esc(r.notes).replace(/\n/g, '<br>')}</p>`);
}
async function addNpc() {
  await sb.from('npcs').insert({ name: $('npc-name').value.trim() || 'Unnamed NPC', role: $('npc-role').value, notes: $('npc-notes').value });
  ['npc-name', 'npc-role', 'npc-notes'].forEach((id) => ($(id).value = ''));
  loadNpcs();
}

// --- Encounters -------------------------------------------------------------
function loadEncounters() {
  return loadInto('encounters', $('enc-list'), (r) =>
    `<h3>${esc(r.name)}</h3><p class="small">${esc(r.summary).replace(/\n/g, '<br>')}</p>`);
}
async function addEncounter() {
  await sb.from('encounters').insert({ name: $('enc-name').value.trim() || 'Untitled encounter', summary: $('enc-summary').value });
  ['enc-name', 'enc-summary'].forEach((id) => ($(id).value = ''));
  loadEncounters();
}

// --- Loot -------------------------------------------------------------------
function loadLoot() {
  return loadInto('loot', $('loot-list'), (r) =>
    `<h3>${esc(r.name)}</h3><div class="meta">${esc(r.value_notes || '')}</div><p class="small">${esc(r.description).replace(/\n/g, '<br>')}</p>`);
}
async function addLoot() {
  await sb.from('loot').insert({ name: $('loot-name').value.trim() || 'Unnamed item', value_notes: $('loot-value').value, description: $('loot-desc').value });
  ['loot-name', 'loot-value', 'loot-desc'].forEach((id) => ($(id).value = ''));
  loadLoot();
}

// --- DM-only notes (same notes table, dm_only visibility) -------------------
async function loadDmNotes() {
  const el = $('dn-list');
  const { data, error } = await sb.from('notes').select('*')
    .eq('visibility', 'dm_only').order('updated_at', { ascending: false });
  if (error) { el.innerHTML = `<div class="msg error">${esc(error.message)}</div>`; return; }
  el.innerHTML = data.length ? '' : '<p class="muted">No DM-only notes yet.</p>';
  for (const n of data) {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<h3>${esc(n.title)} <span class="badge dm">DM ONLY</span></h3>
      <div class="meta">${esc((n.updated_at || '').slice(0, 16).replace('T', ' '))}</div>
      <p>${esc(n.body).replace(/\n/g, '<br>')}</p>
      <div style="margin-top:8px;"><button class="btn danger small" data-del="${n.id}">Delete</button></div>`;
    div.querySelector('[data-del]').onclick = async () => { await sb.from('notes').delete().eq('id', n.id); loadDmNotes(); };
    el.appendChild(div);
  }
}
async function addDmNote() {
  await sb.from('notes').insert({ author_label: 'DM', title: $('dn-title').value.trim() || 'Untitled', body: $('dn-body').value, visibility: 'dm_only' });
  $('dn-title').value = ''; $('dn-body').value = '';
  loadDmNotes();
}

function loadAll() { loadNpcs(); loadEncounters(); loadLoot(); loadDmNotes(); }

window.addEventListener('DOMContentLoaded', () => {
  $('npc-add').onclick = addNpc;
  $('enc-add').onclick = addEncounter;
  $('loot-add').onclick = addLoot;
  $('dn-add').onclick = addDmNote;
  loadAll();
});
