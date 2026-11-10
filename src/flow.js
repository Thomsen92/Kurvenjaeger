import { sfx } from './audio.js';
import { S } from './state.js';
import { $, btn, fmt, lsGet, lsSet } from './util.js';
import { audioTick, updateWalkers } from './deco.js';
import { resetRace, locate } from './cars.js';
import { updateHazards } from './items.js';
import { sorted, stepCar, collide } from './physics.js';
import { mp, mpBuildCars, mpSend, mpRemote } from './multiplayer.js';
import { banner } from './input.js';
import { renderMenu } from './menu.js';
import { grantRewards } from './save.js';
import { prepareRewards, hideRewards } from './rewards.js';

/* ---------- Spielfluss ---------- */
export function resetBoxes() {
  /* Im Zeitrennen gibt es keine Item-Würfel */
  const off = S.mode === 'trial' && !mp.active;
  for (const b of S.world.boxes) { b.t = off ? 1e9 : 0; b.mesh.visible = !off; }
}
const hudOff = () => { $('#hud').hidden = true; $('#ctl').hidden = true; $('#speed').hidden = true; $('#wrong').hidden = true; $('#app').classList.remove('split'); };
export function startRace() {
  if (mp.pending) { const pen = mp.pending; mp.pending = null; mpBuildCars(pen); } else { mp.active = false; resetRace(); }
  resetBoxes();
  S.state = 'count'; S.countT = 3.6; S.lastCount = -1;
  $('#menu').hidden = true; $('#over').hidden = true; hideRewards();
  const split = S.humans.length > 1;
  $('#app').classList.toggle('split', split);
  $('#hud').hidden = false; $('#ctl').hidden = split; $('#speed').hidden = split;
  btn.L = btn.R = btn.drift = false;
}
export function toMenu() {
  S.state = 'menu'; $('#over').hidden = true; hideRewards(); $('#menu').hidden = false; hudOff();
  mp.active = false; S.views = null; renderMenu(true); resetBoxes();
}
export function showResults() {
  const order = sorted(), place = order.indexOf(S.player) + 1, multi = S.humans.length > 1, trial = S.mode === 'trial';
  $('#overKick').textContent = trial ? 'Zeitrennen' : 'Zieleinlauf';
  $('#overTitle').textContent = trial ? fmt(S.player.finishT) : multi ? order[0].name + ' gewinnt' : 'Platz ' + place;
  $('#results').innerHTML = order.map((c, i) => '<li class="' + (c.isPlayer ? 'me' : '') + '"><span class="n">' + (i + 1) + '</span><span class="nm">' + c.ch.name + '<small>' + c.name + ' · ' + c.kart.name + '</small></span><span class="tm">' + (c.finished ? fmt(c.finishT) : c.left ? 'ausgestiegen' : 'unterwegs') + '</span></li>').join('');
  $('#rTime').textContent = fmt(S.player.finishT); $('#rLap').textContent = fmt(S.player.bestLap);
  const key = (trial ? 'kurvenjaeger-tt-' : 'kurvenjaeger-best-') + S.world.def.id, old = lsGet(key);
  const isBest = (trial || place === 1) && (!old || S.player.finishT < old);
  if (isBest) lsSet(key, S.player.finishT);
  $('#newBest').hidden = !isBest;
  hudOff();
  /* Belohnungen werden sofort vergeben und gespeichert, auch wenn der Bildschirm später geschlossen wird */
  const rw = grantRewards({ place, cars: S.cars.length, opponents: S.cars.length - 1, mode: S.mode, trackId: S.world.def.id, isBest, driftN: S.player.driftN | 0, diff: S.cfg.diff });
  prepareRewards(rw, { place, multi, trial, time: S.player.finishT });
  $('#over').hidden = false; S.state = 'over';
}

export function update(dt) {
  if (S.state === 'count') {
    S.countT -= dt;
    const n = Math.ceil(S.countT - 0.6);
    if (n !== S.lastCount) {
      S.lastCount = n; if (n >= 1) sfx.beep(n); else if (S.countT > -0.2) sfx.beep(0);
      if (n >= 1) banner(String(n), 'Mach dich bereit', 'show'); else if (S.countT > -0.2) banner('LOS!', '', 'show');
    }
    if (S.countT <= 0.6) { S.state = 'race'; S.raceT = 0; }
  }
  const go = S.state === 'race' || S.state === 'finish' || S.state === 'over';
  if (go && S.state !== 'over') S.raceT += dt;
  const order = sorted(); order.forEach((c, i) => { c.rank = i; });
  for (const c of S.cars) { if (c.remote) { mpRemote(c, dt); continue; } if (!go) { locate(c); continue; } stepCar(c, dt); }
  mpSend(dt); audioTick();
  if (go) { collide(); updateHazards(dt); }
  updateWalkers(dt);
  for (const b of S.world.boxes) { if (b.t > 0) { b.t -= dt; if (b.t <= 0) b.mesh.visible = true; } }
  if (S.state === 'finish') { S.finishWait -= dt; if (mp.active && S.cars.every(c => c.finished || c.left)) S.finishWait = Math.min(S.finishWait, 1.2); if (S.finishWait <= 0) showResults(); }
}
