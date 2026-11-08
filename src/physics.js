import { ROAD_HALF, CURB, EDGE, LAPS, RAMP_H, G } from './data.js';
import { S } from './state.js';
import { clamp, angDiff, N, rand, btn, keys, vib, wrapIdx } from './util.js';
import { spawnPuff } from './karts.js';
import { snd } from './deco.js';
import { locate, respawn } from './cars.js';
import { giveItem } from './items.js';
import { aiControl } from './ai.js';
import { banner } from './input.js';

/* ---------- Fahrphysik ---------- */
export function stepCar(c, dt) {
  const d = c.st, pts = S.world.pts;
  c.inv = Math.max(0, c.inv - dt); c.ink = Math.max(0, c.ink - dt); c.slow = Math.max(0, c.slow - dt); c.shield = Math.max(0, c.shield - dt);
  c.boost = Math.max(0, c.boost - dt); c.padCd -= dt; c.gapCd -= dt; c.jumpCd -= dt;
  if (c.roll > 0) { c.roll -= dt; if (c.roll <= 0) { c.item = c.pending; c.itemT = rand(0.8, 2.6); } }
  if (c.fall) {
    c.vy -= 520 * dt; c.y += c.vy * dt; c.x += c.vx * dt; c.z += c.vz * dt; c.spinAng += dt * 7; locate(c);
    if (c.y < -320) respawn(c);
    return;
  }
  const auto = !c.isPlayer || c.finished;
  let steerT = 0, brake = false;
  if (auto) steerT = aiControl(c, dt);
  else {
    steerT = (btn.R || keys['arrowright'] || keys['d'] ? 1 : 0) - (btn.L || keys['arrowleft'] || keys['a'] ? 1 : 0);
    brake = btn.drift || keys['arrowdown'] || keys['s'] || keys['shift'];
  }
  if (c.spin > 0) { c.spin -= dt; steerT = 0; brake = false; c.spinAng += dt * 11; if (c.spin <= 0) c.spinAng = 0; }
  if (c.freeze > 0) { c.freeze -= dt; steerT = 0; brake = false; c.s = 0; c.vx = 0; c.vz = 0; }
  const flip = steerT === 0 || (c.steer !== 0 && Math.sign(steerT) !== Math.sign(c.steer));
  const rate = flip ? 9 : 5.5;
  c.steer += clamp(steerT - c.steer, -rate * dt, rate * dt);

  const air = c.air;
  const onGrass = !air && Math.abs(c.lat) > ROAD_HALF + CURB;
  const boosting = c.boost > 0;
  let pT = 1, pA = 1, pG = 1;
  if (!air) for (const q of S.world.puddles) {
    const dx = c.x - q.x, dz = c.z - q.z;
    if (dx * dx + dz * dz < (q.r * 0.9) * (q.r * 0.9)) {
      if (q.type === 'water') { pT = 0.88; pG = 0.4; } else if (q.type === 'mud') { pT = 0.6; pA = 0.6; } else { pT = 0.55; pA = 0.5; }
      if (Math.abs(c.s) > 40 && Math.random() < dt * 30) spawnPuff(c.x, 3, c.z, q.type === 'water' ? 0xbfe6ff : q.type === 'mud' ? 0x6b4a2e : 0xff7ac0, 0.45, 12);
    }
  }
  let target = d.max * c.speedMul * (boosting ? 1.3 : 1) * (onGrass ? 0.5 : 1) * (c.slow > 0 ? 0.55 : 1) * pT;
  if (!air) {
    if (c.spin > 0) c.s = Math.max(0, c.s * Math.pow(0.12, dt));
    else if (brake) c.s = Math.max(-25, c.s - (Math.abs(c.steer) > 0.35 && c.s > 50 ? 25 : 130) * dt);
    else if (c.s < target) c.s = Math.min(target, c.s + d.acc * (boosting ? 2.6 : 1) * (onGrass ? 0.7 : 1) * pA * dt);
    else c.s = Math.max(target, c.s - (onGrass ? 80 : 35) * dt);
  }
  // Drift-Boost
  if (!auto) {
    if (brake && Math.abs(c.steer) > 0.4 && c.s > 70 && !air) { c.drift += dt; if (Math.random() < dt * 25) spawnPuff(c.x - Math.cos(c.a) * 10, 2, c.z - Math.sin(c.a) * 10, c.drift > 0.8 ? 0xffb347 : 0xe8e8e8, 0.35, 3); }
    else if (c.drift > 0) { if (c.drift > 0.8) { c.boost = Math.max(c.boost, Math.min(1.5, 0.5 + c.drift * 0.5)); banner('Drift-Boost!', '', 'show'); } c.drift = 0; }
  }
  const sr = clamp(c.s / d.max, -0.3, 1.2);
  const turnRate = d.turn * clamp(Math.abs(c.s) / 40, 0, 1) * (1 - 0.28 * Math.max(0, sr)) * (brake ? 1.25 : 1) * (air ? (c.chute ? 0.75 : 0.3) : 1);
  c.a += c.steer * turnRate * dt * (c.s >= 0 ? 1 : -1);
  const fx = Math.cos(c.a), fz = Math.sin(c.a);
  {
    const grip = air ? (c.chute ? 2.4 : 0.8) : d.grip * (onGrass ? 0.6 : 1) * (brake ? 0.5 : 1) * (boosting ? 1.2 : 1) * pG;
    const k = 1 - Math.exp(-grip * dt);
    c.vx += (fx * c.s - c.vx) * k; c.vz += (fz * c.s - c.vz) * k;
  }
  c.x += c.vx * dt; c.z += c.vz * dt;
  locate(c);

  // Insel, Rampen, Abgrund
  const onPlat = Math.abs(c.lat) < EDGE && !S.world.gap[c.idx];
  c.onPlat = onPlat;
  if (!c.air) {
    if (S.world.launch[c.idx] && Math.abs(c.lat) < ROAD_HALF + 2 && c.s > 25 && c.gapCd <= 0) {
      c.air = true; c.chute = false; c.hop = false; c.vy = 0.8 * c.s + 20; c.gapCd = 1.5; c.y = RAMP_H; c.drift = 0;
      if (c === S.player) vib(30);
    } else if (!onPlat) { c.fall = true; c.vy = -40; c.drift = 0; if (c === S.player) { banner('Abgestürzt!', '', 'show'); vib(60); } }
    else { c.safe = c.idx; c.y = Math.abs(c.lat) < ROAD_HALF ? S.world.rampH[c.idx] : 0; }
  } else {
    c.vy -= G * dt;
    if (c.vy < 0 && !c.chute && !c.hop) { c.chute = true; c.vTerm = 34 + 36 * c.st.mass; if (c === S.player) banner('Fallschirm!', '', 'show'); }
    if (c.chute) c.vy = Math.max(c.vy, -c.vTerm);
    c.y += c.vy * dt;
    if (c.y <= 0 && c.vy < 0) {
      c.chute = false; const wasFeather = c.feather; c.hop = false; c.feather = false;
      if (onPlat) { c.air = false; c.y = 0; c.vy = 0; c.boost = Math.max(c.boost, wasFeather ? 0.9 : 0.35); if (c === S.player) S.shakeT = 0.18; for (let i = 0; i < 4; i++) spawnPuff(c.x, 3, c.z, 0xe8e8e8, 0.4, 6); }
      else { c.air = false; c.fall = true; if (c === S.player) { banner('Abgestürzt!', '', 'show'); vib(60); } }
    }
  }
  if (c.fall) return;

  if (onGrass && Math.abs(c.s) > 40 && Math.random() < dt * 28) spawnPuff(c.x - fx * 10, 3, c.z - fz * 10, S.world.def.decor === 'forest' ? 0x7a9a5a : 0xb79bff);
  for (const pd of S.world.pads) {
    if (Math.abs(wrapIdx(c.idx - pd.idx)) <= 3 && Math.abs(c.lat) < 36 && c.padCd <= 0 && !c.air) { c.boost = Math.max(c.boost, 1.1); c.padCd = 1.2; }
  }
  if (!c.air) for (const jp of S.world.jumps) {
    const dx = c.x - jp.x, dz = c.z - jp.z;
    if (c.jumpCd <= 0 && dx * dx + dz * dz < 19 * 19) {
      c.air = true; c.hop = true; c.chute = false; c.vy = 125 + 0.3 * c.s; c.y = 1; c.jumpCd = 1; c.drift = 0; jp.anim = 0.45;
      for (let i = 0; i < 5; i++) spawnPuff(jp.x, 4, jp.z, 0xffd23f, 0.4, 14);
      if (c === S.player) vib(25);
    }
  }
  for (const b of S.world.boxes) {
    if (b.t > 0 || c.y > 10) continue;
    const dx = c.x - b.x, dz = c.z - b.z;
    if (dx * dx + dz * dz < 18 * 18 && giveItem(c)) { b.t = 4; b.mesh.visible = false; }
  }
  const wrongWay = Math.abs(angDiff(c.a, pts[c.idx].ang)) > 2.1 && Math.abs(c.s) > 5;
  c.wrong = wrongWay ? c.wrong + dt : 0;
  c.stuck = (Math.abs(c.s) < 10 && !c.air && c.spin <= 0) ? c.stuck + dt : 0;
  if (c.stuck > 2.5) { const p = pts[c.idx]; c.x = p.x; c.z = p.z; c.a = p.ang; c.vx = c.vz = 0; c.s = 0; c.stuck = 0; c.lat = 0; }

  const lapNow = Math.floor(c.prog / N);
  if (lapNow > c.lap && lapNow >= 1) {
    const lt = S.raceT - c.lapStart; c.lapStart = S.raceT;
    if (!c.bestLap || lt < c.bestLap) c.bestLap = lt;
    c.lap = lapNow;
    if (c === S.player && lapNow < LAPS) banner('Runde ' + (lapNow + 1), 'von ' + LAPS, 'show');
  } else if (lapNow < c.lap) c.lap = Math.max(0, lapNow);
  if (!c.finished && c.prog >= LAPS * N) {
    c.finished = true; c.finishT = S.raceT;
    if (c === S.player) { S.state = 'finish'; S.finishWait = 2.4; banner('Ziel!', '', 'stay'); }
  }
}

export function collide() {
  for (let i = 0; i < S.cars.length; i++) for (let j = i + 1; j < S.cars.length; j++) {
    const a = S.cars[i], b = S.cars[j];
    if ((a.remote && b.remote) || a.fall || b.fall || Math.abs(a.y - b.y) > 12) continue;
    const dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz), min = 22;
    if (dist >= min || dist < 0.001) continue;
    const nx = dx / dist, nz = dz / dist, ma = a.st.mass, mb = b.st.mass, over = min - dist, rm = a.remote ? a : b.remote ? b : null, sv = rm ? [rm.x, rm.z, rm.vx, rm.vz] : null;
    a.x -= nx * over * mb / (ma + mb); a.z -= nz * over * mb / (ma + mb);
    b.x += nx * over * ma / (ma + mb); b.z += nz * over * ma / (ma + mb);
    const rv = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    if (rv > 0) {
      const jj = 1.3 * rv / (1 / ma + 1 / mb);
      a.vx -= nx * jj / ma; a.vz -= nz * jj / ma; b.vx += nx * jj / mb; b.vz += nz * jj / mb;
      for (const q of [a, b]) q.s += (q.vx * Math.cos(q.a) + q.vz * Math.sin(q.a) - q.s) * 0.5;
      if (a === S.player || b === S.player) { S.shakeT = 0.18; snd('bump'); }
    }
    if (rm) { rm.x = sv[0]; rm.z = sv[1]; rm.vx = sv[2]; rm.vz = sv[3]; }
  }
}
export const rankKey = c => c.finished ? 1e7 - c.finishT : c.prog;
export const sorted = () => S.cars.slice().sort((a, b) => rankKey(b) - rankKey(a));
