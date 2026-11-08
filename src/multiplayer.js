import { CHARS, KARTS, TRACKS } from './data.js';
import { S } from './state.js';
import { $, rand, angDiff, N } from './util.js';
import { buildWorld } from './world.js';
import { bananas, carsGroup, rockets, makeCarMesh } from './karts.js';
import { stats, placeCar, resetRace, locate } from './cars.js';
import { hit, freezeCar } from './items.js';
import { startRace } from './flow.js';
import { joinRoomP2P } from './room.js';

/* ---------- Mehrspieler (Raum-Code, Live-Position der Mitspieler) ---------- */
export const mp = { nr: null, code: '', on: false, active: false, round: 0, seen: {}, acc: 0, pending: null, unsub: [], last: '' };
export const MP_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const mpName = () => (($('#mpName').value || '').trim() || 'Fahrer').slice(0, 12);
export function mpSetUi() {
  $('#mpJoinRow').hidden = mp.on; $('#mpRoom').hidden = !mp.on; $('#mpCodeShow').textContent = mp.code;
}
export function mpPeers() { return mp.nr ? mp.nr.peers().filter(p => p.kind === 'viewer' && p.presence && p.presence.n).sort((a, b) => (a.peer < b.peer ? -1 : 1)) : []; }
export function mpRender() {
  if (!mp.on) return;
  const ps = mpPeers(), ul = $('#mpList'); ul.innerHTML = '';
  ps.forEach((p, i) => {
    const li = document.createElement('li'), r = p.presence;
    const ch = CHARS[r.ch | 0] || CHARS[0], kt = KARTS[r.kt | 0] || KARTS[0];
    li.textContent = (i === 0 ? '★ ' : '') + String(r.n).slice(0, 12) + (p.isMe && p.sameTab ? ' (du)' : '') + ' · ' + ch.name + ' · ' + kt.name;
    ul.appendChild(li);
  });
  const meHost = ps.length && ps[0].isMe && ps[0].sameTab;
  $('#mpGo').hidden = !meHost; $('#mpGo').disabled = ps.length < 2;
  $('#mpHint').textContent = ps.length < 2 ? 'Warte auf Mitspieler … (★ = Gastgeber, startet das Rennen)' : meHost ? 'Alle da? Dann starte das Rennen für alle.' : 'Der Gastgeber (★) startet das Rennen.';
}
export function mpLobbyPresence() {
  if (!mp.on) return;
  const d = { n: mpName(), ch: S.selChar, sk: S.selSkin, kt: S.selKart, pk: S.selPaint, tr: S.selTrack, go: mp.round };
  const j = JSON.stringify(d); if (j === mp.last) return; mp.last = j;
  mp.nr.presence(d).catch(() => {});
}
export function mpOnPeers() {
  mpRender();
  const ps = mpPeers(); if (!ps.length) return;
  const h = ps[0], g = h.presence.go | 0;
  if (mp.seen[h.peer] === undefined) { mp.seen[h.peer] = g; return; }
  if (g > mp.seen[h.peer]) {
    mp.seen[h.peer] = g;
    if (!(h.isMe && h.sameTab) && S.state !== 'count' && S.state !== 'race' && h.presence.ids) mpStart(h.presence.ids, h.presence.tr | 0);
  }
}
export async function mpJoin(code) {
  code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (code.length < 4) { $('#mpStatus').textContent = 'Der Code braucht mindestens 4 Zeichen.'; return; }
  try { localStorage.setItem('kj-name', mpName()); } catch (e) {}
  $('#mpStatus').textContent = 'Verbinde …';
  try { mp.nr = await joinRoomP2P('kj-' + code.toLowerCase()); } catch (e) { $('#mpStatus').textContent = 'Raum konnte nicht geöffnet werden.'; return; }
  mp.on = true; mp.code = code; mp.seen = {}; mp.round = 0; mp.last = '';
  mp.unsub.push(mp.nr.onPeers(mpOnPeers, () => {})); mp.unsub.push(mp.nr.on('fx', mpOnFx, () => {}));
  $('#mpStatus').textContent = ''; mpSetUi(); mpLobbyPresence(); mpRender();
}
export async function mpLeave() {
  for (const u of mp.unsub) u(); mp.unsub = [];
  try { if (mp.nr) await mp.nr.leave(); } catch (e) {}
  mp.nr = null; mp.on = false; mp.active = false; mp.code = ''; mpSetUi();
}
export function mpFx(d) { if (mp.active && mp.nr) mp.nr.emit('fx', d).catch(() => {}); }
export function mpOnFx(m) {
  const d = m.data; if (!d || m.isMe || !mp.active || !S.player || (S.state !== 'race' && S.state !== 'finish')) return;
  if (d.k === 'ban') { const b = bananas.find(q => q.life <= 0); if (b && isFinite(d.x) && isFinite(d.z)) { b.life = 28; b.age = 0; b.owner = null; b.x = +d.x; b.z = +d.z; b.m.visible = true; b.m.position.set(b.x, 3, b.z); } return; }
  if (d.k === 'bolt') { if (S.player.shield > 0) { S.player.shield = 0; S.player.inv = 0.6; } else if (!S.player.fall) { S.player.slow = 3; S.player.spin = Math.max(S.player.spin, 0.5); S.player.s *= 0.5; S.flashT = 0.35; } return; }
  if (d.to !== S.player.peer) return;
  if (d.k === 'hit') hit(S.player); else if (d.k === 'ice') freezeCar(S.player);
  else if (d.k === 'ink') { if (S.player.shield > 0) { S.player.shield = 0; S.player.inv = 0.6; } else { S.player.ink = 4.5; S.inkBlobs = []; for (let k = 0; k < 9; k++) S.inkBlobs.push({ x: rand(0.1, 0.9), y: rand(0.15, 0.85), r: rand(0.12, 0.26) }); } }
}
export function mpHostGo() {
  const ps = mpPeers(); if (ps.length < 2 || !(ps[0].isMe && ps[0].sameTab)) return;
  const ids = ps.slice(0, 8).map(p => p.peer); mp.round++; mp.last = '';
  mp.seen[ps[0].peer] = mp.round;
  mp.nr.presence({ n: mpName(), ch: S.selChar, sk: S.selSkin, kt: S.selKart, pk: S.selPaint, tr: S.selTrack, ids, go: mp.round }).catch(() => {});
  mp.last = '';
  mpStart(ids, S.selTrack);
}
export function mpStart(ids, tr) { mp.pending = { ids, tr: Math.max(0, Math.min(TRACKS.length - 1, tr)) }; startRace(); }
export function mpBuildCars(pen) {
  if (pen.tr !== S.selTrack) { S.selTrack = pen.tr; buildWorld(TRACKS[pen.tr]); }
  for (const c of S.cars) carsGroup.remove(c.mesh);
  for (const b of bananas) { b.life = 0; b.m.visible = false; }
  for (const r of rockets) { r.life = 0; r.m.visible = false; r.iceM.visible = false; }
  S.cars = []; S.gridN = pen.ids.length; const ps = mp.nr.peers();
  for (const id of pen.ids) {
    const p = ps.find(q => q.peer === id); if (!p || !p.presence || !p.presence.n) continue;
    const r = p.presence, me = p.isMe && p.sameTab, ch = CHARS[r.ch | 0] || CHARS[0], kart = KARTS[r.kt | 0] || KARTS[0];
    const o = { name: me ? 'Du' : String(r.n).slice(0, 12), skill: 1, kart, ch, isPlayer: me, remote: !me, peer: id, sk: (r.sk | 0) % 3, pk: (r.pk | 0) % 3 };
    const slot = S.cars.length, c = Object.assign({ mesh: makeCarMesh(o.kart, o.ch, o.sk, o.pk), slot, st: stats(o.kart, o.ch) }, o);
    placeCar(c, slot); S.cars.push(c); carsGroup.add(c.mesh); if (me) S.player = c;
  }
  if (!S.player) { resetRace(); return; }
  S.raceT = 0; S.finishWait = 0; mp.active = true; mp.acc = 0;
}
export function mpRemote(c, dt) {
  const p = mp.nr && mp.nr.peers().find(q => q.peer === c.peer);
  if (!p) { c.left = true; return; }
  const r = p.presence; if (r.x === undefined) return;
  const k = Math.min(1, dt * 10);
  if (Math.hypot(r.x - c.x, r.z - c.z) > 150) { c.x = r.x; c.z = r.z; } else { c.x += (r.x - c.x) * k; c.z += (r.z - c.z) * k; }
  c.a += angDiff(r.a, c.a) * k; c.y += ((r.y || 0) - c.y) * k;
  locate(c);
  const fl = r.fl | 0;
  c.s = r.s || 0; c.steer = r.st || 0; if (typeof r.p === 'number') c.prog = r.p; c.lap = Math.max(0, Math.floor(c.prog / N));
  c.air = !!(fl & 1); c.chute = !!(fl & 2); c.feather = !!(fl & 4); c.boost = fl & 8 ? 1 : 0; c.fall = !!(fl & 16); c.shield = fl & 32 ? 9 : 0; c.freeze = fl & 64 ? 1 : 0; c.spin = fl & 128 ? 1 : 0;
  c.onPlat = !c.fall; c.inv = 0; c.spinAng = c.spin > 0 ? c.spinAng + dt * 11 : 0;
  c.finished = (r.f || 0) > 0; c.finishT = r.f || 0;
  c.vx = Math.cos(c.a) * c.s; c.vz = Math.sin(c.a) * c.s;
}
export function mpSend(dt) {
  if (!mp.active || !mp.nr || !S.player) return;
  mp.acc += dt; if (mp.acc < 0.066) return; mp.acc = 0;
  const p = S.player, f1 = v => Math.round(v * 10) / 10;
  const fl = (p.air ? 1 : 0) | (p.chute ? 2 : 0) | (p.feather ? 4 : 0) | (p.boost > 0 ? 8 : 0) | (p.fall ? 16 : 0) | (p.shield > 0 ? 32 : 0) | (p.freeze > 0 ? 64 : 0) | (p.spin > 0 ? 128 : 0);
  mp.nr.presence({ x: f1(p.x), z: f1(p.z), a: Math.round(p.a * 100) / 100, y: f1(p.y), s: Math.round(p.s), st: Math.round(p.steer * 100) / 100, p: f1(p.prog), f: p.finished ? Math.round(p.finishT * 100) / 100 : 0, fl }).catch(() => {});
}
/* Menü-Verdrahtung */
(function () {
  try { $('#mpName').value = localStorage.getItem('kj-name') || ''; } catch (e) {}
  if (!$('#mpName').value) $('#mpName').value = 'Fahrer' + Math.floor(10 + Math.random() * 90);
  $('#mpJoin').addEventListener('click', () => mpJoin($('#mpCode').value));
  $('#mpNew').addEventListener('click', () => { let c = ''; for (let i = 0; i < 4; i++) c += MP_ALPHA[Math.floor(Math.random() * MP_ALPHA.length)]; mpJoin(c); });
  $('#mpGo').addEventListener('click', mpHostGo);
  $('#mpLeave').addEventListener('click', mpLeave);
  $('#mpName').addEventListener('change', mpLobbyPresence);
  mpSetUi();
})();
