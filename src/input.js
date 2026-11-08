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
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if (k === ' ') { e.preventDefault(); if (S.state === 'race' && S.player) useItem(S.player); }
  if (k.startsWith('arrow')) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
app.addEventListener('contextmenu', e => e.preventDefault());

export const bannerEl = $('#banner');
export function banner(big, small, cls) {
  bannerEl.firstElementChild.textContent = big; bannerEl.lastElementChild.textContent = small || '';
  bannerEl.className = ''; void bannerEl.offsetWidth; bannerEl.className = cls || 'show';
}
