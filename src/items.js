import { ITEM_W } from './data.js';
import { S } from './state.js';
import { clamp, vib, rand, TAU, N } from './util.js';
import { spawnPuff, bananas, rockets } from './karts.js';
import { snd } from './deco.js';
import { mpFx } from './multiplayer.js';
import { banner } from './input.js';

/* ---------- Items ---------- */
export function pickItem(rank) {
  const w = ITEM_W[clamp(rank, 0, 3)]; let t = 0;
  for (const k in w) t += w[k];
  let r = Math.random() * t;
  for (const k in w) { r -= w[k]; if (r < 0) return k; }
  return 'banana';
}
export function giveItem(c) { if (c.item || c.roll > 0) return false; c.roll = 0.9; c.pending = pickItem(c.rank); return true; }
export function hit(c) {
  if (c.inv > 0 || c.fall) return false;
  if (c.shield > 0) { c.shield = 0; c.inv = 0.8; for (let i = 0; i < 6; i++) spawnPuff(c.x, 12, c.z, 0x4fd8ff, 0.5, 14); return false; }
  if (c === S.player) snd('hit'); c.spin = 1.1; c.inv = 2.4; c.s *= 0.35; c.vx *= 0.4; c.vz *= 0.4; c.boost = 0; c.drift = 0;
  if (c === S.player) { banner('Autsch!', '', 'show'); vib(120); S.shakeT = 0.3; }
  return true;
}
export function freezeCar(c) {
  if (c.inv > 0 || c.fall) return false;
  if (c.shield > 0) { c.shield = 0; c.inv = 0.8; for (let i = 0; i < 6; i++) spawnPuff(c.x, 12, c.z, 0x4fd8ff, 0.5, 14); return false; }
  c.freeze = 1.6; c.inv = 3; c.s = 0; c.vx = c.vz = 0; c.boost = 0; c.drift = 0;
  if (c === S.player) { banner('Eingefroren!', '', 'show'); vib(120); }
  return true;
}
S.inkBlobs = [];
export function useItem(c) {
  if (!c.item || c.roll > 0 || c.fall) return;
  const it = c.item; c.item = null; if (c === S.player) snd(it);
  if (it === 'banana') {
    const b = bananas.find(q => q.life <= 0);
    if (b) { b.life = 28; b.age = 0; b.owner = c; b.x = c.x - Math.cos(c.a) * 24; b.z = c.z - Math.sin(c.a) * 24; b.m.visible = true; b.m.position.set(b.x, 3, b.z); b.m.rotation.z = rand(0, TAU); if (c === S.player) mpFx({ k: 'ban', x: Math.round(b.x), z: Math.round(b.z) }); }
  } else if (it === 'shield') { c.shield = 9; }
  else if (it === 'mushroom') { c.boost = Math.max(c.boost, 1.7); if (c === S.player) banner('Boost!', '', 'show'); }
  else if (it === 'rocket') {
    const r = rockets.find(q => q.life <= 0);
    if (r) {
      const ahead = S.cars.filter(o => o !== c && o.prog > c.prog && !o.fall).sort((a, b) => a.prog - b.prog)[0] || null;
      r.kind = 'rocket'; r.life = 6; r.owner = c; r.target = ahead; r.i = c.idx + 3; r.lat = c.lat; r.m.visible = true; r.iceM.visible = false;
    }
  } else if (it === 'iceball') {
    const r = rockets.find(q => q.life <= 0);
    if (r) {
      const ahead = S.cars.filter(o => o !== c && o.prog > c.prog && !o.fall).sort((a, b) => a.prog - b.prog)[0] || null;
      r.kind = 'ice'; r.life = 6; r.owner = c; r.target = ahead; r.i = c.idx + 3; r.lat = c.lat; r.iceM.visible = true; r.m.visible = false;
    }
  } else if (it === 'feather') {
    c.air = true; c.chute = false; c.hop = true; c.feather = true; c.vy = 165; c.y = Math.max(c.y, 0.6); c.rollAng = 0; c.inv = Math.max(c.inv, 1.4); c.drift = 0;
    if (c === S.player) { banner('Feder!', '', 'show'); vib(30); }
  } else if (it === 'ink') {
    let n = 0;
    for (const o of S.cars) if (o !== c && o.prog > c.prog) {
      if (o.shield > 0) { o.shield = 0; o.inv = 0.6; } else { o.ink = 4.5; n++; if (o.remote && c === S.player) mpFx({ k: 'ink', to: o.peer }); if (o === S.player) { S.inkBlobs = []; for (let k = 0; k < 9; k++) S.inkBlobs.push({ x: rand(0.1, 0.9), y: rand(0.15, 0.85), r: rand(0.12, 0.26) }); vib(60); } }
    }
    if (c === S.player) banner(n ? 'Tinte!' : 'Tinte (niemand vorne)', '', 'show');
  } else if (it === 'magnet') {
    const t = S.cars.filter(o => o !== c && o.prog > c.prog && !o.fall).sort((a, b) => a.prog - b.prog)[0];
    if (t && t.item && t.shield <= 0) { c.item = t.item; t.item = null; c.itemT = rand(0.6, 1.6); if (c === S.player) banner('Item geklaut!', '', 'show'); else if (t === S.player) banner('Item weg!', '', 'show'); }
    else { c.boost = Math.max(c.boost, t ? 1.4 : 0.8); if (c === S.player) banner('Sog!', '', 'show'); }
  } else if (it === 'bolt') {
    if (c === S.player) mpFx({ k: 'bolt' });
    for (const o of S.cars) if (o !== c) { if (o.shield > 0) { o.shield = 0; o.inv = 0.6; } else if (!o.fall) { o.slow = 3; o.spin = Math.max(o.spin, 0.5); o.s *= 0.5; } }
    if (c === S.player) banner('Blitz!', '', 'show'); else if (S.player.shield <= 0) S.flashT = 0.35;
  }
}
export function updateHazards(dt) {
  const pts = S.world.pts;
  for (const b of bananas) {
    if (b.life <= 0) continue;
    b.life -= dt; b.age += dt; b.m.rotation.z += dt * 1.5; b.m.position.y = 3 + Math.sin(b.age * 6) * 0.6;
    if (b.life <= 0) { b.m.visible = false; continue; }
    for (const c of S.cars) {
      if (c.remote || c.fall || c.y > 7 || (c === b.owner && b.age < 1)) continue;
      const dx = c.x - b.x, dz = c.z - b.z;
      if (dx * dx + dz * dz < 15 * 15) { hit(c); b.life = 0; b.m.visible = false; break; }
    }
  }
  for (const r of rockets) {
    if (r.life <= 0) continue;
    r.life -= dt; r.i = (r.i + (r.kind === 'ice' ? 46 : 52) * dt) % N;
    if (r.target) r.lat += clamp(r.target.lat - r.lat, -130 * dt, 130 * dt);
    const i0 = Math.floor(r.i) % N, f = r.i - Math.floor(r.i), p0 = pts[i0], p1 = pts[(i0 + 1) % N];
    const x = p0.x + (p1.x - p0.x) * f + p0.nx * r.lat, z = p0.z + (p1.z - p0.z) * f + p0.nz * r.lat;
    const ice = r.kind === 'ice';
    r.m.position.set(x, 9, z); r.m.rotation.y = -p0.ang; r.iceM.position.set(x, 9, z); r.iceM.visible = ice; r.m.visible = !ice;
    if (Math.random() < dt * 40) spawnPuff(x - p0.tx * 10, 9, z - p0.tz * 10, 0xffc070, 0.35, 2);
    for (const c of S.cars) {
      if (c === r.owner || c.fall || c.y > 14) continue;
      const dx = c.x - x, dz = c.z - z;
      if (dx * dx + dz * dz < 17 * 17) { if (c.remote) { if (r.owner === S.player) mpFx({ k: ice ? 'ice' : 'hit', to: c.peer }); } else if (ice) freezeCar(c); else hit(c); for (let k = 0; k < 8; k++) spawnPuff(x, 10, z, ice ? 0xbfeaff : 0xff8a30, 0.5, 16); r.life = 0; break; }
    }
    if (r.life <= 0) { r.m.visible = false; r.iceM.visible = false; }
  }
}
