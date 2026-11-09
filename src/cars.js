import { KARTS, CHARS, BOTS } from './data.js';
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
export function resetRace() {
  for (const c of S.cars) carsGroup.remove(c.mesh);
  for (const b of bananas) { b.life = 0; b.m.visible = false; }
  for (const r of rockets) { r.life = 0; r.m.visible = false; r.iceM.visible = false; }
  S.cars = []; S.gridN = 4;
  const others = KARTS.filter((_, i) => i !== S.selKart), chOthers = CHARS.filter((_, i) => i !== S.selChar).sort(() => Math.random() - 0.5);
  const list = [
    { name: BOTS[0].name, skill: BOTS[0].skill, kart: others[0], ch: chOthers[0], isPlayer: false, sk: rnd3(), pk: rnd3() },
    { name: BOTS[1].name, skill: BOTS[1].skill, kart: others[1], ch: chOthers[1], isPlayer: false, sk: rnd3(), pk: rnd3() },
    { name: 'Du', skill: 1, kart: KARTS[S.selKart], ch: CHARS[S.selChar], isPlayer: true, sk: S.selSkin, pk: S.selPaint },
    { name: BOTS[2].name, skill: BOTS[2].skill, kart: others[0], ch: chOthers[2], isPlayer: false, sk: rnd3(), pk: (rnd3() + 1) % 3 }
  ];
  list.forEach((o, slot) => {
    const c = Object.assign({ mesh: makeCarMesh(o.kart, o.ch, o.sk, o.pk), slot, st: stats(o.kart, o.ch) }, o);
    placeCar(c, slot); S.cars.push(c); carsGroup.add(c.mesh);
    if (c.isPlayer) S.player = c;
  });
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
