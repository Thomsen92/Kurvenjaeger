import { S } from './state.js';
import { N, clamp, angDiff, rand, wrapIdx } from './util.js';
import { useItem } from './items.js';

/* ---------- KI ---------- */
export function aiItem(c, dt) {
  if (!c.item || c.roll > 0 || c.air) return;
  c.itemT -= dt; if (c.itemT > 0) return;
  const it = c.item, here = S.world.turn[c.idx];
  const behind = S.cars.some(o => o !== c && o.prog < c.prog && c.prog - o.prog < 60);
  const ahead = S.cars.some(o => o !== c && o.prog > c.prog && o.prog - c.prog < 160);
  if (it === 'mushroom') { if (here < 0.25) useItem(c); }
  else if (it === 'shield') useItem(c);
  else if (it === 'banana') { if (behind || c.itemT < -6) useItem(c); }
  else if (it === 'rocket') { if (ahead || c.itemT < -8) useItem(c); }
  else if (it === 'bolt') { if (c.rank >= 2 || c.itemT < -6) useItem(c); }
  else if (it === 'iceball') { if (ahead || c.itemT < -8) useItem(c); }
  else if (it === 'feather') { if (here < 0.2 || c.itemT < -7) useItem(c); }
  else if (it === 'ink') { if ((c.rank >= 1 && ahead) || c.itemT < -9) useItem(c); }
  else if (it === 'magnet') { if (ahead || c.itemT < -8) useItem(c); }
}
export function aiControl(c, dt) {
  const pts = S.world.pts, look = 9 + Math.floor(Math.abs(c.s) / 18), tp = pts[(c.idx + look) % N];
  const nearGap = S.world.near[c.idx];
  const L = S.world.loop, inLoop = L && wrapIdx(c.idx - L.i0) > -44 && wrapIdx(c.idx - L.i0) < L.m + 6;
  if (nearGap) c.lane += ((inLoop ? L.lc : 0) - c.lane) * Math.min(1, dt * 3);
  else { c.laneT -= dt; if (c.laneT <= 0) { c.lane = rand(-34, 34); c.laneT = rand(2, 5); } }
  const tx = tp.x + tp.nx * c.lane, tz = tp.z + tp.nz * c.lane;
  const want = Math.atan2(tz - c.z, tx - c.x);
  const ahead = Math.max(S.world.turn[c.idx], S.world.turn[(c.idx + 15) % N], S.world.turn[(c.idx + 30) % N]);
  let mul = clamp(1 - ahead * 0.42, 0.6, 1) * c.skill;
  if (nearGap) mul = Math.max(mul, 0.97);
  for (const w of S.world.walkers) { const di = wrapIdx(w.idx - c.idx); if (di > 1 && di < 24 && Math.abs(w.lat - c.lat) < 32 + (w.pause <= 0 ? 10 : 0)) mul = Math.min(mul, 0.5); }
  if (!c.isPlayer && S.player) { const d = S.player.prog - c.prog; mul *= d > 90 ? 1.07 : d < -90 ? 0.93 : 1; }
  if (c.ink > 0) mul *= 0.88;
  c.speedMul = mul;
  aiItem(c, dt);
  return clamp(angDiff(want, c.a) * 2.4, -1, 1);
}
