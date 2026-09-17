// ─── DM section PIN gate (Neon Odyssey) ───────────────────────────────
// A light "keep players out" access code for the DM pages and tools.
// Adapted from the Eapheron dm-gate, re-themed for Neon Odyssey.
//
// This is NOT real security: the code below is visible to anyone who reads
// this file's source. It just stops a curious player from idly clicking into
// behind-the-screen pages. Real auth (Supabase Auth + Row Level Security) is a
// later phase — see js/supabase-config.js.
//
// Once entered correctly the unlock is remembered on this device (via
// localStorage) so the DM isn't re-prompted in new tabs or after a restart.
// To CHANGE THE CODE, edit DM_PIN below — that invalidates the stored unlock,
// so everyone re-enters the new code.
//
// Usage: include in the <head> of every protected page, before the page
// renders, so content never flashes before the gate appears:
//   <script src="/js/dm-gate.js"></script>

(function () {
  'use strict';

  var DM_PIN = '4242';
  var STORAGE_KEY = 'neon-odyssey-dm-unlocked';

  // Already unlocked on this device? Let the page through untouched.
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === DM_PIN) return;
  } catch (e) { /* localStorage blocked — fall through and prompt */ }

  // Hide the page immediately so protected content never flashes.
  var hideStyle = document.createElement('style');
  hideStyle.id = 'dm-gate-hide';
  hideStyle.textContent = [
    'body > *:not(#dm-gate) { visibility: hidden !important; }',
    '#dm-gate { visibility: visible !important; }'
  ].join('\n');
  (document.head || document.documentElement).appendChild(hideStyle);

  function unlock() {
    try { window.localStorage.setItem(STORAGE_KEY, DM_PIN); } catch (e) {}
    var gate = document.getElementById('dm-gate');
    if (gate) gate.parentNode.removeChild(gate);
    var s = document.getElementById('dm-gate-hide');
    if (s) s.parentNode.removeChild(s);
  }

  function buildGate() {
    if (document.getElementById('dm-gate')) return;

    var style = document.createElement('style');
    style.textContent = [
      '#dm-gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;',
      'justify-content:center;padding:1.5rem;',
      'background:radial-gradient(1000px 500px at 80% -10%,rgba(255,79,216,0.18),transparent),',
      'radial-gradient(900px 480px at -10% 20%,rgba(0,230,255,0.14),transparent),#140a1f;}',
      '#dm-gate *{box-sizing:border-box;}',
      '#dm-gate .dmg-card{width:100%;max-width:420px;background:#241539;color:#f3e9ff;',
      'border:1px solid #402a5e;border-top:4px solid #ff4fd8;border-radius:14px;',
      'padding:2.4rem 2rem;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,0.55);',
      'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}',
      '#dm-gate .dmg-eyebrow{font-size:0.7rem;letter-spacing:0.32em;text-transform:uppercase;color:#00e6ff;margin-bottom:0.6rem;}',
      '#dm-gate h2{font-size:1.55rem;line-height:1.15;margin:0 0 0.45rem;color:#ff4fd8;letter-spacing:1px;}',
      '#dm-gate p{opacity:0.8;margin:0 0 1.5rem;font-size:0.92rem;color:#b6a6d6;}',
      '#dm-gate form{display:flex;flex-direction:column;gap:0.9rem;}',
      '#dm-gate input{font-family:inherit;font-size:1.5rem;text-align:center;letter-spacing:0.5em;',
      'padding:0.7rem 0.6rem;border:1px solid #402a5e;border-radius:8px;background:#170d26;color:#f3e9ff;width:100%;}',
      '#dm-gate input:focus{outline:none;border-color:#00e6ff;box-shadow:0 0 0 3px rgba(0,230,255,0.25);}',
      '#dm-gate button{font-family:inherit;font-weight:700;background:linear-gradient(100deg,#ff4fd8,#b3149c);',
      'color:#fff;border:none;border-radius:8px;padding:0.8rem 1rem;font-size:1rem;letter-spacing:0.04em;cursor:pointer;}',
      '#dm-gate button:hover{filter:brightness(1.08);}',
      '#dm-gate .dmg-error{min-height:1.2rem;color:#ff5c7a;font-size:0.88rem;font-weight:600;margin:0;opacity:0;transition:opacity 0.15s;}',
      '#dm-gate .dmg-error.show{opacity:1;}'
    ].join('');
    document.head.appendChild(style);

    var overlay = document.createElement('div');
    overlay.id = 'dm-gate';
    overlay.innerHTML =
      '<div class="dmg-card">' +
        '<p class="dmg-eyebrow">Behind the Screen</p>' +
        '<h2>DM Access</h2>' +
        '<p>Enter the access code, Dungeon Master.</p>' +
        '<form id="dmg-form" autocomplete="off">' +
          '<input id="dmg-input" type="password" inputmode="numeric" ' +
            'aria-label="DM access code" placeholder="••••" />' +
          '<p class="dmg-error" id="dmg-error">That code is not recognised.</p>' +
          '<button type="submit">Enter</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(overlay);

    var form = document.getElementById('dmg-form');
    var input = document.getElementById('dmg-input');
    var error = document.getElementById('dmg-error');

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (input.value === DM_PIN) {
        unlock();
      } else {
        error.classList.add('show');
        input.value = '';
        input.focus();
      }
    });
    input.addEventListener('input', function () { error.classList.remove('show'); });
    input.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildGate);
  } else {
    buildGate();
  }
})();
