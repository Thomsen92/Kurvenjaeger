import { KARTS, CHARS, BOTS, DIFF_SKILL } from './data.js';
import { S } from './state.js';
import { N, rand, wrapIdx } from './util.js';
import { carsGroup, bananas, rockets, makeCarMesh } from './karts.js';
import { banner } from './input.js';

/* ---------- Autos ---------- */
export function stats(kart, ch) {
  const m = ch.mods;
  return { max: kart.max * m.max, acc: kart.acc * m.acc, turn: kart.turn * m.turn, grip: kart.grip * m.grip, mass: kart.mass * m.mass };
}
S.gridN = 4;
export function placeCar(c, slot) {
  const per = S.gridN <= 4 ? S.gridN : Math.ceil(S.gridN / 2), row = Math.floor(slot / per), col = slot % per;
  const pts = S.world.pts, k = 6 + row * 9, i = (N - k) % N, p = pts[i], lat = (col - (per - 1) / 2) * 32;
  Object.assign(c, { x: p.x + p.nx * lat, z: p.z + p.nz * lat, a: p.ang, idx: i, prog: -k, lat, s: 0, vx: 0, vz: 0, y: 0, vy: 0, steer: 0,
    boost: 0, padCd: 0, gapCd: 0, finished: false, finishT: 0, stuck: 0, lap: 0, lapStart: 0, bestLap: 0, speedMul: 1, wrong: 0, lane: rand(-28, 28),
    item: null, roll: 0, pending: null, itemT: 0, shield: 0, spin: 0, spinAng: 0, inv: 0, slow: 0, drift: 0, air: false, fall: false, safe: i, rank: slot, onPlat: true, chute: false, chuteT: 0, vTerm: 60, hop: false, feather: false, rollAng: 0, freeze: 0, ink: 0, jumpCd: 0, loop: null, pitch: 0 });
}
export const rnd3 = () => Math.floor(Math.random() * 3);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/* Baut das Starterfeld aus der Menü-Auswahl: S.mode = local | trial (Mehrspieler baut mpBuildCars) */
export function resetRace() {
  for (const c of S.cars) carsGroup.remove(c.mesh);
  for (const b of bananas) { b.life = 0; b.m.visible = false; }
  for (const r of rockets) { r.life = 0; r.m.visible = false; r.iceM.visible = false; }
  S.cars = []; S.humans = [];
  const nh = S.mode === 'local' ? S.cfg.humans : 1, nb = S.mode === 'trial' ? 0 : S.mode === 'local' ? S.cfg.bots : 3;
  const list = [];
  for (let i = 0; i < nh; i++) {
    const h = S.hp[i];
    list.push({ name: nh > 1 ? 'Spieler ' + (i + 1) : 'Du', skill: 1, kart: KARTS[h.kt], ch: CHARS[h.ch], isPlayer: true, pi: i, sk: h.sk, pk: h.pk });
  }
  const base = DIFF_SKILL[S.cfg.diff] === undefined ? 0.9 : DIFF_SKILL[S.cfg.diff], names = shuffle(BOTS.slice());
  for (let i = 0; i < nb; i++) {
    const kt = KARTS[Math.floor(Math.random() * KARTS.length)], ch = CHARS[Math.floor(Math.random() * CHARS.length)];
    list.push({ name: names[i % names.length].name, skill: Math.min(1, base + (Math.random() - 0.5) * 0.05), kart: kt, ch, isPlayer: false, sk: rnd3(), pk: rnd3() });
  }
  shuffle(list);
  S.gridN = list.length;
  list.forEach((o, slot) => {
    const c = Object.assign({ mesh: makeCarMesh(o.kart, o.ch, o.sk, o.pk), slot, st: stats(o.kart, o.ch), driftN: 0 }, o);
    placeCar(c, slot); S.cars.push(c); carsGroup.add(c.mesh);
    if (c.isPlayer) S.humans.push(c);
  });
  S.humans.sort((a, b) => a.pi - b.pi); S.player = S.humans[0];
  S.raceT = 0; S.finishWait = 0;
}
export function locate(c) {
  const pts = S.world.pts;
  let bi = c.idx, bd = 1e12;
  for (let k = -8; k <= 16; k++) {
    const i = (c.idx + k + N) % N, p = pts[i], dx = c.x - p.x, dz = c.z - p.z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; bi = i; }
  }
  c.prog += wrapIdx(bi - c.idx); c.idx = bi;
  const p = pts[bi]; c.lat = (c.x - p.x) * p.nx + (c.z - p.z) * p.nz;
}
export function respawn(c) {
  const pts = S.world.pts, back = S.world.near[((c.safe % N) + N) % N] ? 54 : 4, i = ((c.safe - back) % N + N) % N, p = pts[i];
  c.prog += wrapIdx(i - c.idx); c.idx = i;
  Object.assign(c, { x: p.x, z: p.z, a: p.ang, s: 60, vx: p.tx * 60, vz: p.tz * 60, y: 0, vy: 0, fall: false, air: false, lat: 0, inv: 2.2, spin: 0, spinAng: 0, boost: 0, drift: 0, steer: 0, slow: 0, loop: null, pitch: 0 });
  if (c === S.player && S.state === 'race') banner('Zurück ins Rennen', '', 'show');
}
