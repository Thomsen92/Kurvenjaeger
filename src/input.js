import { sfx } from './audio.js';
import { S } from './state.js';
import { $, app, btn, keys } from './util.js';
import { useItem } from './items.js';

/* ---------- Eingabe ---------- */
export function hold(el, key, onDown) {
  const on = e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (err) {} if (key) btn[key] = true; el.classList.add('down'); if (onDown) onDown(); };
  const off = () => { if (key) btn[key] = false; el.classList.remove('down'); };
  el.addEventListener('pointerdown', on);
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, off);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown']) addEventListener(ev, () => sfx.init(), { passive: true });
export const muteB = $('#mute'); export const muteUi = () => { muteB.textContent = sfx.muted() ? 'Ton aus' : sfx.running() ? 'Ton an' : 'Ton: tippen'; muteB.setAttribute('aria-pressed', !sfx.muted()); };
muteB.addEventListener('click', () => { sfx.init(); if (sfx.running() || sfx.muted()) sfx.set(!sfx.muted()); muteUi(); }); muteUi(); setInterval(muteUi, 800);
hold($('#bL'), 'L'); hold($('#bR'), 'R'); hold($('#bDrift'), 'drift');
hold($('#bItem'), null, () => { if (S.state === 'race' && S.player) useItem(S.player); });
/* Tastenbelegung je lokalem Spieler. Spieler 1 darf allein auch mit A/D/S fahren, Touch-Tasten gehören immer Spieler 1. */
export const KEYMAP = [
  { L: ['arrowleft'], R: ['arrowright'], B: ['arrowdown', 'shift'], I: [' '], hint: 'Pfeiltasten · Pfeil unten Driften · Leertaste Item' },
  { L: ['a'], R: ['d'], B: ['s'], I: ['q'], hint: 'A / D lenken · S Driften · Q Item' },
  { L: ['j'], R: ['l'], B: ['k'], I: ['i'], hint: 'J / L lenken · K Driften · I Item' },
  { L: ['4'], R: ['6'], B: ['5'], I: ['8'], hint: 'Ziffernblock 4 / 6 lenken · 5 Driften · 8 Item' }
];
const down = list => list.some(k => keys[k]);
export function readInput(c) {
  const i = c.pi | 0, m = KEYMAP[i], solo = S.humans.length <= 1;
  const L = down(m.L) || (i === 0 && (btn.L || (solo && keys['a']))), R = down(m.R) || (i === 0 && (btn.R || (solo && keys['d'])));
  const B = down(m.B) || (i === 0 && (btn.drift || (solo && keys['s'])));
  return { steer: (R ? 1 : 0) - (L ? 1 : 0), brake: !!B };
}
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if (S.state === 'race' && !e.repeat) {
    S.humans.forEach((h, i) => { if (KEYMAP[i].I.includes(k)) useItem(h); });
  }
  if (k === ' ' && S.state !== 'menu') e.preventDefault();
  if (k.startsWith('arrow') && S.state !== 'menu') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
app.addEventListener('contextmenu', e => e.preventDefault());

export const bannerEl = $('#banner');
export function banner(big, small, cls) {
  bannerEl.firstElementChild.textContent = big; bannerEl.lastElementChild.textContent = small || '';
  bannerEl.className = ''; void bannerEl.offsetWidth; bannerEl.className = cls || 'show';
}
