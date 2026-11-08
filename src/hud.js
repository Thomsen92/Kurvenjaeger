import { ITEMS, LAPS } from './data.js';
import { S } from './state.js';
import { $, clamp, N, fmt, svgIcon } from './util.js';
import { sorted } from './physics.js';

/* ---------- HUD ---------- */
export const el = { pos: $('#posTxt'), lap: $('#lapTxt'), time: $('#timeTxt'), spd: $('#spdTxt'), item: $('#bItem'), wrong: $('#wrong'), flash: $('#flash') };
export const cache = {};
export function setTxt(k, node, v) { if (cache[k] !== v) { cache[k] = v; node.textContent = v; } }
export const iconKeys = Object.keys(ITEMS);
export function updateHud() {
  if (S.flashT > 0) { S.flashT = Math.max(0, S.flashT - 0.016); el.flash.style.opacity = String(S.flashT / 0.35 * 0.75); }
  if (S.state === 'menu' || S.state === 'over' || !S.player) return;
  setTxt('pos', el.pos, String(sorted().indexOf(S.player) + 1));
  setTxt('lap', el.lap, 'Runde ' + clamp(Math.floor(Math.max(0, S.player.prog) / N) + 1, 1, LAPS) + ' / ' + LAPS);
  setTxt('time', el.time, fmt(S.state === 'count' ? 0 : S.raceT));
  setTxt('spd', el.spd, String(Math.round(Math.abs(S.player.s) * 1.15)));
  let key = 'none', html = '<span>ITEM</span>';
  if (S.player.roll > 0) { const k = iconKeys[Math.floor(performance.now() / 90) % iconKeys.length]; key = 'roll' + k; html = svgIcon(ITEMS[k].svg); }
  else if (S.player.item) { key = S.player.item; html = svgIcon(ITEMS[S.player.item].svg); }
  if (cache.item !== key) { cache.item = key; el.item.innerHTML = html; }
  el.item.classList.toggle('has', !!S.player.item && S.player.roll <= 0);
  el.item.classList.toggle('roll', S.player.roll > 0);
  el.wrong.hidden = !(S.player.wrong > 1 && S.state === 'race');
}
