import { sfx } from './audio.js';
import { S } from './state.js';
import { $, btn, fmt, lsGet, lsSet, N } from './util.js';
import { LAPS } from './data.js';
import { podiumStart, podiumStop } from './podium.js';
import { audioTick, updateWalkers } from './deco.js';
import { resetRace, locate } from './cars.js';
import { updateHazards } from './items.js';
import { dynUpdate, dynReset } from './dynamic.js';
import { sorted, stepCar, collide } from './physics.js';
import { mp, mpBuildCars, mpSend, mpRemote } from './multiplayer.js';
import { banner } from './input.js';
import { renderMenu, jumpTo } from './menu.js';
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
  resetBoxes(); dynReset();
  S.state = 'count'; S.countT = 3.6; S.lastCount = -1; S.finishExtra = 0;
  podiumStop(); $('#menu').hidden = true; $('#over').hidden = true; hideRewards();
  const split = S.humans.length > 1;
  $('#app').classList.toggle('split', split);
  $('#hud').hidden = false; $('#ctl').hidden = split; $('#speed').hidden = split;
  btn.L = btn.R = btn.drift = false;
}
export function toMenu() {
  S.state = 'menu'; podiumStop(); $('#over').hidden = true; hideRewards(); $('#menu').hidden = false; hudOff();
  mp.active = false; S.views = null; renderMenu(true); resetBoxes();
}
/* Zurück zur Streckenauswahl (Mehrspieler-Gäste haben keine, dort landen sie in der Rennübersicht) */
export function toTrackSelect() { toMenu(); jumpTo('track'); }
/* Endwertung: Zielzeiten gelten, wer noch fährt, wird nach Fortschritt eingeordnet und bekommt eine geschätzte Zeit */
function buildRows(order) {
  const len = LAPS * N, list = order.filter(c => !c.left).concat(order.filter(c => c.left));
  let last = 0;
  return list.map((c, i) => {
    let time = 0, est = false;
    if (c.finished) time = c.finishT;
    else if (!c.left) { const avg = c.prog / Math.max(1, S.raceT); if (avg > 0) { time = Math.max(S.raceT + (len - c.prog) / avg, last + 0.05); est = true; } }
    if (time) last = Math.max(last, time);
    return { c, place: i + 1, time, est, left: !!c.left };
  });
}
const humanLabel = c => S.humans.length > 1 ? 'Spieler ' + ((c.pi | 0) + 1) : 'Du';
export function showResults() {
  const order = sorted(), rowsAll = buildRows(order), place = rowsAll.findIndex(r => r.c === S.player) + 1, multi = S.humans.length > 1, trial = S.mode === 'trial';
  $('#overKick').textContent = trial ? 'Siegerehrung · Zeitrennen' : 'Siegerehrung';
  $('#overTitle').textContent = trial ? fmt(S.player.finishT) : multi ? rowsAll[0].c.name + ' gewinnt' : 'Platz ' + place;
  const TROPHY = '<svg class="tr" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0zM7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6v4H9z"/></svg>';
  $('#results').innerHTML = rowsAll.map(r => {
    const c = r.c, mine = c.isPlayer && !c.remote;
    return '<li class="pl' + Math.min(r.place, 4) + (mine ? ' me' : '') + (r.place === 1 ? ' win' : '') + '"><span class="n">' + r.place + '</span><span class="nm">' + (r.place === 1 ? TROPHY : '') + c.ch.name + '<small>' + (mine ? humanLabel(c) : c.name) + ' · ' + c.kart.name + '</small></span><span class="tm">' + (r.left ? 'ausgestiegen' : r.est ? '~' + fmt(r.time) : fmt(r.time)) + '</span></li>';
  }).join('');
  $('#rTime').textContent = fmt(S.player.finishT); $('#rLap').textContent = fmt(S.player.bestLap);
  const key = (trial ? 'kurvenjaeger-tt-' : 'kurvenjaeger-best-') + S.world.def.id, old = lsGet(key);
  const isBest = (trial || place === 1) && (!old || S.player.finishT < old);
  if (isBest) lsSet(key, S.player.finishT);
  $('#newBest').hidden = !isBest;
  hudOff();
  /* XP werden sofort vergeben und gespeichert, auch wenn der Bildschirm später geschlossen wird.
     Jeder menschliche Spieler bekommt die XP in sein eigenes Profil; Mitspieler im Online-Raum (remote) werden nie gewertet. */
  const rws = S.humans.filter(h => !h.remote).map(h => {
    const pl = rowsAll.findIndex(r => r.c === h) + 1;
    const r = grantRewards({ slot: h.pi | 0, place: pl, cars: S.cars.length, opponents: S.cars.length - 1, mode: S.mode, trackId: S.world.def.id, isBest: isBest && h === S.player, driftN: h.driftN | 0, jumpN: h.jumpN | 0, diff: S.cfg.diff });
    r.label = multi ? 'Spieler ' + ((h.pi | 0) + 1) : ''; r.place = pl; return r;
  });
  prepareRewards(rws, { multi, trial, time: S.player.finishT });
  /* Siegerehrung: 3D-Szene mit den tatsächlichen Platzierungen */
  const cp = $('#cpanel'); cp.classList.remove('show');
  podiumStart(rowsAll.map(r => ({ ch: r.c.ch, sk: r.c.sk | 0, place: r.place, label: r.c.isPlayer && !r.c.remote ? humanLabel(r.c) : r.c.name })), () => cp.classList.add('show'));
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
  dynUpdate(dt);
  for (const c of S.cars) { if (c.remote) { mpRemote(c, dt); continue; } if (!go) { locate(c); continue; } stepCar(c, dt); }
  mpSend(dt); audioTick();
  if (go) { collide(); updateHazards(dt); }
  updateWalkers(dt);
  for (const b of S.world.boxes) { if (b.t > 0) { b.t -= dt; if (b.t <= 0) b.mesh.visible = true; } }
  if (S.state === 'finish') { S.finishWait -= dt; if (mp.active && S.cars.every(c => c.finished || c.left)) S.finishWait = Math.min(S.finishWait, 1.2); if (S.finishWait <= 0) { S.finishExtra = (S.finishExtra || 0) + dt; if (S.cars.every(c => c.finished || c.left) || S.finishExtra > 6) showResults(); } }
}
