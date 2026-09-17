'use strict';

// Shared 5E character-sheet definitions + helpers, used by the player sheet
// (editable) and the DM console (read-only). All sheet data lives in the
// character row's `sheet` jsonb column — no extra table columns required.

const ABILITIES = [
  ['str', 'Strength'], ['dex', 'Dexterity'], ['con', 'Constitution'],
  ['int', 'Intelligence'], ['wis', 'Wisdom'], ['cha', 'Charisma'],
];

// 18 standard 5E skills + Computers and Technology (both Intelligence).
const SKILLS = [
  ['Acrobatics', 'dex'], ['Animal Handling', 'wis'], ['Arcana', 'int'],
  ['Athletics', 'str'], ['Computers', 'int'], ['Deception', 'cha'],
  ['History', 'int'], ['Insight', 'wis'], ['Intimidation', 'cha'],
  ['Investigation', 'int'], ['Medicine', 'wis'], ['Nature', 'int'],
  ['Perception', 'wis'], ['Performance', 'cha'], ['Persuasion', 'cha'],
  ['Religion', 'int'], ['Sleight of Hand', 'dex'], ['Stealth', 'dex'],
  ['Survival', 'wis'], ['Technology', 'int'],
];

const SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_');
const abilMod = (score) => Math.floor(((parseInt(score, 10) || 10) - 10) / 2);
const signed = (n) => (n >= 0 ? '+' + n : '' + n);
function escH(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setPath(obj, path, val) {
  const parts = path.split('.'); let o = obj;
  for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
  o[parts[parts.length - 1]] = val;
}
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// ---- build the editable controls ------------------------------------------
function buildSheetControls() {
  document.getElementById('abilities').innerHTML = ABILITIES.map(([k, name]) =>
    `<div class="abil">
       <div class="abil-name">${name}</div>
       <input class="abil-score" data-field="abilities.${k}" type="number" value="10" data-abil="${k}" />
       <div class="abil-mod" id="mod-${k}">+0</div>
     </div>`).join('');

  document.getElementById('saves').innerHTML = ABILITIES.map(([k, name]) =>
    `<label class="prof-row">
       <input type="checkbox" data-field="save.${k}" data-save="${k}" />
       <span class="prof-total" id="save-${k}">+0</span>
       <span class="prof-name">${name}</span>
     </label>`).join('');

  document.getElementById('skills').innerHTML = SKILLS.map(([name, ab]) =>
    `<label class="prof-row">
       <input type="checkbox" data-field="skill.${slug(name)}" data-skill="${slug(name)}" data-ab="${ab}" />
       <span class="prof-total" id="skill-${slug(name)}">+0</span>
       <span class="prof-name">${name} <span class="muted">(${ab})</span></span>
     </label>`).join('');

  document.getElementById('spellslots').innerHTML = SPELL_LEVELS.map((lv) =>
    `<div class="slot">
       <div class="slot-lv">L${lv}</div>
       <input data-field="slots.${lv}.total" type="number" min="0" placeholder="0" title="Total slots" />
       <input data-field="slots.${lv}.used"  type="number" min="0" placeholder="0" title="Used" />
     </div>`).join('');
}

// ---- recompute derived numbers --------------------------------------------
function recompute(root) {
  root = root || document;
  const prof = parseInt((root.querySelector('[data-field="prof_bonus"]') || {}).value, 10) || 0;
  const mods = {};
  root.querySelectorAll('.abil-score').forEach((inp) => {
    const k = inp.dataset.abil; mods[k] = abilMod(inp.value);
    const el = root.querySelector('#mod-' + k); if (el) el.textContent = signed(mods[k]);
  });
  root.querySelectorAll('[data-save]').forEach((cb) => {
    const k = cb.dataset.save; const t = (mods[k] || 0) + (cb.checked ? prof : 0);
    const el = root.querySelector('#save-' + k); if (el) el.textContent = signed(t);
  });
  let perceptionTotal = 0;
  root.querySelectorAll('[data-skill]').forEach((cb) => {
    const t = (mods[cb.dataset.ab] || 0) + (cb.checked ? prof : 0);
    const el = root.querySelector('#skill-' + cb.dataset.skill); if (el) el.textContent = signed(t);
    if (cb.dataset.skill === 'perception') perceptionTotal = t;
  });
  const pp = root.querySelector('#passive-perception'); if (pp) pp.textContent = 10 + perceptionTotal;
  // spellcasting
  const sa = root.querySelector('[data-field="spell_ability"]');
  const sm = sa && sa.value && mods[sa.value] != null ? mods[sa.value] : 0;
  const dc = root.querySelector('#spell-dc'); if (dc) dc.textContent = 8 + prof + sm;
  const at = root.querySelector('#spell-atk'); if (at) at.textContent = signed(prof + sm);
}

// ---- serialise / hydrate ---------------------------------------------------
function collectSheet(root) {
  const out = {};
  root.querySelectorAll('[data-field]').forEach((el) => {
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'number') v = el.value === '' ? null : Number(el.value);
    else v = el.value;
    setPath(out, el.dataset.field, v);
  });
  return out;
}
function applySheet(root, sheet) {
  sheet = sheet || {};
  root.querySelectorAll('[data-field]').forEach((el) => {
    const v = getPath(sheet, el.dataset.field);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (v != null) el.value = v;
    else if (el.type !== 'number') el.value = '';
    else el.value = '';
  });
}
function setSheetDisabled(root, disabled) {
  root.querySelectorAll('[data-field]').forEach((el) => { el.disabled = disabled; });
}

// ---- read-only render for the DM console ----------------------------------
function readonlySheetHTML(char) {
  const s = char.sheet || {};
  const prof = parseInt(s.prof_bonus, 10) || 0;
  const abil = s.abilities || {};
  const mod = (k) => abilMod(abil[k]);
  const abilRow = ABILITIES.map(([k, name]) =>
    `<div class="abil ro"><div class="abil-name">${name}</div><div class="abil-score-ro">${abil[k] != null ? escH(abil[k]) : '—'}</div><div class="abil-mod">${signed(mod(k))}</div></div>`).join('');
  const saveRows = ABILITIES.map(([k, name]) => {
    const p = s.save && s.save[k]; const t = mod(k) + (p ? prof : 0);
    return `<div class="prof-row ro"><span class="prof-total">${signed(t)}</span><span class="prof-name">${p ? '●' : '○'} ${name}</span></div>`;
  }).join('');
  let ppTotal = 0;
  const skillRows = SKILLS.map(([name, ab]) => {
    const p = s.skill && s.skill[slug(name)]; const t = mod(ab) + (p ? prof : 0);
    if (slug(name) === 'perception') ppTotal = t;
    return `<div class="prof-row ro"><span class="prof-total">${signed(t)}</span><span class="prof-name">${p ? '●' : '○'} ${name} <span class="muted">(${ab})</span></span></div>`;
  }).join('');

  const sm = s.spell_ability && abil[s.spell_ability] != null ? mod(s.spell_ability) : 0;
  const anySlots = SPELL_LEVELS.some((lv) => s.slots && s.slots[lv] && (s.slots[lv].total || s.slots[lv].used));
  const slotsHTML = anySlots ? '<div class="ro-slots">' + SPELL_LEVELS.map((lv) => {
    const sl = (s.slots && s.slots[lv]) || {}; if (!sl.total && !sl.used) return '';
    return `<span>L${lv}: ${escH(sl.used || 0)}/${escH(sl.total || 0)}</span>`;
  }).join('') + '</div>' : '';
  const atkRows = [1, 2, 3, 4].map((i) => {
    const n = s['atk' + i + '_name']; if (!n) return '';
    return `<div class="ro-atk">${escH(n)} · ${escH(s['atk' + i + '_atk'] || '')} · ${escH(s['atk' + i + '_dmg'] || '')}</div>`;
  }).join('');

  const txt = (label, key) => s[key] ? `<div class="ro-sec"><h4>${label}</h4><p>${escH(s[key]).replace(/\n/g, '<br>')}</p></div>` : '';
  const art = s.art_url ? `<img class="ro-art" src="${escH(s.art_url)}" alt="art" />` : '';
  const spellHdr = s.spell_ability
    ? `<div class="ro-combat"><span>Spell ${escH(s.spell_ability).toUpperCase()}</span><span>Save DC ${8 + prof + sm}</span><span>Atk ${signed(prof + sm)}</span></div>` : '';

  return `
    <div class="ro-head">
      ${art}
      <div>
        <h3>${escH(char.name || 'Unnamed')} ${s.locked ? '<span class="badge dm">🔒 LOCKED</span>' : ''}</h3>
        <div class="meta">${escH(char.species || '—')} · ${escH(char.class_name || '')}${char.subclass ? ' / ' + escH(char.subclass) : ''} · Lv ${char.level || 1}</div>
        <div class="meta">Player: ${escH(char.player_name || '—')} · ${escH(s.background || '')} · GN: ${escH(s.galactic_notes || '0')}</div>
      </div>
    </div>
    <div class="abilities ro">${abilRow}</div>
    <div class="ro-combat">
      <span>AC ${escH(s.ac ?? '—')}</span><span>Init ${signed(parseInt(s.initiative, 10) || 0)}</span>
      <span>Speed ${escH(s.speed ?? '—')}</span><span>HP ${escH(s.hp_cur ?? '—')}/${escH(s.hp_max ?? '—')}</span>
      <span>Hit Dice ${escH(s.hit_dice ?? '—')}</span><span>Prof ${signed(prof)}</span><span>Passive Perc ${10 + ppTotal}</span>
    </div>
    <div class="sheet-grid">
      <div><h4>Saving Throws</h4>${saveRows}</div>
      <div><h4>Skills</h4>${skillRows}</div>
    </div>
    ${spellHdr}${slotsHTML}
    ${atkRows ? '<div class="ro-sec"><h4>Attacks</h4>' + atkRows + '</div>' : ''}
    ${txt('Cantrips', 'cantrips')}${txt('Spells', 'spells')}
    ${txt('Equipment', 'equipment')}${txt('Features &amp; Traits', 'features')}
    ${txt('Proficiencies &amp; Languages', 'proficiencies')}${txt('Personality, Ideals, Bonds &amp; Flaws', 'personality')}
  `;
}
