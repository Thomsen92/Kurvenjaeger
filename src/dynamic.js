import * as THREE from 'three';
import { ROAD_HALF, CURB, EDGE } from './data.js';
import { S } from './state.js';
import { N, TAU, clamp, wrapIdx, rand } from './util.js';
import { lam, bas, canvasTex } from './core.js';
import { spawnPuff } from './karts.js';
import { snd } from './deco.js';
import { locate } from './cars.js';
import { hit } from './items.js';
import { mp, mpFx, mpPeers } from './multiplayer.js';

/* ---------- Dynamische Strecke ----------
   Alle beweglichen Teile sind reine Funktionen der gemeinsamen Streckenuhr D.t (Zufall nur über einen festen Startwert je Strecke).
   So sieht jeder Mitspieler dieselbe Stellung; im Mehrspielermodus gleicht D.t sich weich an die Uhr des Gastgebers an.
   Zerstörte Teile werden per Ereignis ('brk') gemeldet. Karts sind runde Körper (Radius RK), Hindernisse Kästen oder Zylinder. */
const RK = 10, STEP = 4, LATW = ROAD_HALF + CURB;

/* Aufbau je Typ: pre/post = freier Platz vor/nach dem Element (in Stützpunkten), len = Länge bei Abschnitten, win = Reichweite für Kollisionen */
const SPEC = {
  hammer: { pre: 14, len: 0, post: 14, win: 14 },
  sweep: { pre: 14, len: 0, post: 14, win: 16 },
  wall: { pre: 14, len: 0, post: 14, win: 14 },
  popup: { pre: 12, len: 0, post: 12, win: 12 },
  crates: { pre: 10, len: 0, post: 10, win: 12 },
  barrier: { pre: 12, len: 0, post: 12, win: 14 },
  heave: { pre: 8, len: 12, post: 12, win: 14 },
  turn: { pre: 16, len: 0, post: 16, win: 16 },
  trap: { pre: 26, len: 14, post: 8, win: 14, pit: true },
  slider: { pre: 26, len: 20, post: 8, win: 16, pit: true },
  creek: { pre: 8, len: 15, post: 8, win: 14 },
  slick: { pre: 8, len: 12, post: 8, win: 12 }
};

/* Legt die Elemente fest (deterministisch: nur Streckenform und Reihenfolge der Liste zählen) */
export function planDynamic(def, turn, near, gap) {
  const kinds = def.dyn || [], K = kinds.length, taken = new Uint8Array(N), pit = new Uint8Array(N), els = [];
  const blocked = i => { i = ((i % N) + N) % N; return near[i] || taken[i] || i > N - 46 || i < 46; };
  kinds.forEach((kind, k) => {
    const sp = SPEC[kind], target = Math.floor(N * (0.1 + 0.84 * (k + 0.5) / K));
    let best = -1, bc = 1e9;
    for (let d = -150; d <= 150; d += 3) {
      const i0 = target + d; if (i0 < 50 || i0 + sp.len > N - 50) continue;
      let ok = true, c = 0;
      for (let q = -sp.pre - 12; q <= sp.len + sp.post + 12; q += 2) { if (blocked(i0 + q)) { ok = false; break; } c = Math.max(c, turn[(i0 + q + N) % N]); }
      if (!ok) continue;
      const cost = c + Math.abs(d) * 0.0005; if (cost < bc) { bc = cost; best = i0; }
    }
    if (best < 0) return;
    for (let q = -sp.pre; q <= sp.len + sp.post; q++) taken[(best + q + N) % N] = 1;
    if (sp.pit) {
      for (let q = 1; q < sp.len; q++) gap[(best + q) % N] = 1;
      for (let q = 0; q < sp.len; q++) pit[(best + q) % N] = 1;
      for (let q = -sp.pre; q <= sp.len + 6; q++) near[(best + q + N) % N] = 1;
    }
    els.push({ kind, i0: best, len: sp.len });
  });
  const avoid = new Uint8Array(N);
  for (let i = 0; i < N; i++) avoid[i] = near[i] || taken[i] ? 1 : 0;
  return { els, avoid, pit };
}

/* ---------- Hilfen ---------- */
function rngOf(str, n) {
  let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = (h + n * 7919) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/* Rahmen eines Elements: Mitte, Fahrtrichtung t, Querrichtung n (links), Länge L der Sehne */
function mkFrame(pts, i0, len) {
  const a = pts[i0 % N], b = pts[(i0 + len) % N];
  let tx = b.x - a.x, tz = b.z - a.z, L = Math.hypot(tx, tz);
  if (len === 0 || L < 1) { tx = a.tx; tz = a.tz; L = 0; } else { tx /= L; tz /= L; }
  return { cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2, tx, tz, nx: -tz, nz: tx, ang: Math.atan2(tz, tx), L };
}
const toUV = (f, x, z) => { const dx = x - f.cx, dz = z - f.cz; return [dx * f.tx + dz * f.tz, dx * f.nx + dz * f.nz]; };
const fxz = (f, u, v) => [f.cx + f.tx * u + f.nx * v, f.cz + f.tz * u + f.nz * v];
function fgroup(parent, f) { const g = new THREE.Group(); g.position.set(f.cx, 0, f.cz); g.rotation.y = -f.ang; parent.add(g); return g; }
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cyl = (rt, rb, h, mat, seg) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 16), mat);
const ball = (r, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat); m.scale.setScalar(r); return m; };

const tex = {};
function textures() {
  if (tex.haz) return tex;
  const stripes = (a, b) => canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b;
    for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 + 8, 0); g.lineTo(i * 16 + 72, 64); g.lineTo(i * 16 + 64, 64); g.fill(); }
  }, true);
  tex.haz = stripes('#ffd23f', '#1b1f2b');
  tex.red = stripes('#f4f4f4', '#e23b30');
  tex.wood = canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#b98a52'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(60,35,12,.55)'; g.fillRect(0, y, w, 2); g.fillStyle = (y / 16) % 2 ? 'rgba(255,230,180,.12)' : 'rgba(60,30,10,.1)'; g.fillRect(0, y + 2, w, 14); }
    g.fillStyle = 'rgba(70,40,15,.5)'; for (let i = 0; i < 8; i++) g.fillRect(rand(0, w), rand(0, h), 2, 2);
  }, true);
  tex.crate = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#c98c3d'; g.fillRect(0, 0, w, h); g.strokeStyle = '#6b4218'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.lineWidth = 5; g.beginPath(); g.moveTo(6, 6); g.lineTo(w - 6, h - 6); g.moveTo(w - 6, 6); g.lineTo(6, h - 6); g.stroke();
  });
  tex.turn = canvasTex(128, 128, (g) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffd23f' : '#4fd8ff'; g.beginPath(); g.moveTo(64, 64); g.arc(64, 64, 63, i * TAU / 8, (i + 1) * TAU / 8); g.closePath(); g.fill(); }
    g.fillStyle = '#2b3040'; g.beginPath(); g.arc(64, 64, 18, 0, TAU); g.fill();
    g.strokeStyle = '#2b3040'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.35; g.beginPath(); g.moveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34); g.lineTo(64 + Math.cos(a + 0.28) * 44, 64 + Math.sin(a + 0.28) * 44); g.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); g.stroke(); }
  });
  return tex;
}

/* ---------- Aufbau ---------- */
export function buildDynamic(plan, group, pts, def) {
  const D = { els: [], t: 0, hs: null, hat: 0, debris: [], dI: 0 }, T = textures();
  const dg = new THREE.BoxGeometry(1, 1, 1); dg.userData.keep = true;
  for (let i = 0; i < 56; i++) { const m = new THREE.Mesh(dg, new THREE.MeshLambertMaterial({ color: 0xb98a52 })); m.visible = false; group.add(m); D.debris.push({ m, life: 0, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0, sx: 1, sy: 1, sz: 1 }); }
  plan.els.forEach((p, n) => {
    const sp = SPEC[p.kind], el = { kind: p.kind, id: n, i0: p.i0, len: p.len, f: mkFrame(pts, p.i0, p.len), win: sp.win, cols: [], R: 60 };
    el.iC = p.i0 + p.len / 2;
    BUILD[p.kind](el, D, group, def, T, rngOf(def.id, n));
    D.els.push(el);
  });
  return D;
}

/* ---------- Zerstörbare Teile ---------- */
function burst(D, x, y, z, n, color, vx, vz, size) {
  for (let i = 0; i < n; i++) {
    const p = D.debris[D.dI++ % D.debris.length];
    p.m.material.color.setHex(color); p.m.visible = true; p.m.position.set(x + rand(-4, 4), y + rand(-2, 4), z + rand(-4, 4));
    p.vx = vx * 0.5 + rand(-60, 60); p.vz = vz * 0.5 + rand(-60, 60); p.vy = rand(60, 170); p.rx = rand(-9, 9); p.rz = rand(-9, 9);
    p.sx = size * rand(0.7, 1.4); p.sy = size * 0.35; p.sz = size * rand(0.9, 2); p.life = rand(1.4, 2); p.m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3)); p.m.scale.set(p.sx, p.sy, p.sz);
  }
}
function updateDebris(D, dt) {
  for (const p of D.debris) {
    if (p.life <= 0) continue;
    p.life -= dt; p.vy -= 420 * dt; const m = p.m;
    m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt;
    if (m.position.y < 0.8) { m.position.y = 0.8; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
    m.rotation.x += p.rx * dt; m.rotation.z += p.rz * dt;
    const k = Math.min(1, p.life / 0.5); m.scale.set(p.sx * k, p.sy * k, p.sz * k);
    if (p.life <= 0) m.visible = false;
  }
}
function breakEl(D, el, k, c, silent) {
  if (!el.alive[k]) return;
  const col = el.cols[k]; el.alive[k] = false; el.rt[k] = el.respawn; el.grow[k] = 0; col.on = false; el.meshes[k].visible = false;
  burst(D, col.x, (col.y1 || 10) / 2, col.z, el.pieces, el.wood, c ? c.vx : 0, c ? c.vz : 0, el.psize);
  for (let i = 0; i < 4; i++) spawnPuff(col.x, 6, col.z, 0xcdbb98, 0.5, 14);
  snd('bump');
  if (c && !silent && mp.active) mpFx({ k: 'brk', id: el.id * 16 + k });
}
export function dynRemoteBreak(id) {
  const D = S.world && S.world.dyn; if (!D) return;
  const el = D.els[id >> 4]; if (el && el.alive) breakEl(D, el, id & 15, null, true);
}
/* Gemeinsamer Teil von Kisten und Absperrungen: Liste von Teilen mit Kollisionskasten, Zerbrechen und Nachwachsen */
function breakables(el, D, root, items, mk, o) {
  const f = el.f; el.alive = []; el.rt = []; el.grow = []; el.meshes = []; el.respawn = o.respawn; el.pieces = o.pieces; el.wood = o.wood; el.psize = o.size;
  items.forEach((it, k) => {
    const m = mk(it); m.position.set(it.u, 0, it.v); m.rotation.y = -it.yaw; root.add(m); el.meshes.push(m);
    const [x, z] = fxz(f, it.u, it.v), th = f.ang + it.yaw;
    el.cols.push({ x, z, cs: Math.cos(th), sn: Math.sin(th), hx: it.hx, hz: it.hz, y0: 0, y1: it.h, on: true, el, k, brk: o.brk });
    el.alive.push(true); el.rt.push(0); el.grow.push(1);
  });
  el.update = (t, dt) => {
    for (let k = 0; k < items.length; k++) {
      if (!el.alive[k]) { el.rt[k] -= dt; if (el.rt[k] <= 0) { el.alive[k] = true; el.grow[k] = 0; el.meshes[k].visible = true; } }
      else if (el.grow[k] < 1) el.grow[k] = Math.min(1, el.grow[k] + dt * 3);
      if (el.alive[k]) { el.meshes[k].scale.setScalar(0.2 + 0.8 * el.grow[k]); el.cols[k].on = el.grow[k] > 0.6; }
    }
  };
  el.reset = () => { for (let k = 0; k < items.length; k++) { el.alive[k] = true; el.grow[k] = 1; el.rt[k] = 0; el.meshes[k].visible = true; el.meshes[k].scale.setScalar(1); el.cols[k].on = true; } };
}

/* ---------- Die einzelnen Elemente ---------- */
const BUILD = {};

/* Pendelhämmer an Portalen: gefährlich ist der Kopf, solange er tief hängt */
const HL = 84, HAMP = 1.0, HT = 3.4;
BUILD.hammer = (el, D, g, def, T) => {
  const f = el.f, root = fgroup(g, f), W = ROAD_HALF + 14, metal = lam(0x2b3040), headM = lam(def.curb[0]), band = new THREE.MeshLambertMaterial({ map: T.haz }), hs = [];
  [-30, 30].forEach((u, i) => {
    for (const s of [-1, 1]) { const post = box(6, 104, 6, metal); post.position.set(u, 52, s * W); root.add(post); }
    const beam = box(7, 7, W * 2, metal); beam.position.set(u, 102, 0); root.add(beam);
    const piv = new THREE.Group(); piv.position.set(u, 98, 0); root.add(piv);
    const arm = box(3.2, HL, 3.2, metal); arm.position.y = -HL / 2; piv.add(arm);
    const head = box(26, 18, 26, headM); head.position.y = -HL; piv.add(head);
    const strip = box(27, 5, 27, band); strip.position.y = -HL; piv.add(strip);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 18), bas(0x000000, { transparent: true, opacity: 0.3 })); sh.rotation.x = -Math.PI / 2; sh.position.set(u, 0.6, 0); sh.scale.setScalar(15); root.add(sh);
    hs.push({ u, ph: i * Math.PI / 2, piv, sh });
  });
  const state = (h, t) => { const a = TAU * t / HT + h.ph, ph = HAMP * Math.sin(a); return { ph, v: HL * Math.sin(ph), y: 98 - HL * Math.cos(ph), dv: HL * Math.cos(ph) * HAMP * TAU / HT * Math.cos(a) }; };
  const test = (h, s, u, v, y) => Math.abs(u - h.u) < 13 + RK * 0.8 && Math.abs(v - s.v) < 13 + RK * 0.8 && s.y - 9 < y + 14 && s.y + 9 > y;
  el.R = 62;
  el.update = t => { for (const h of hs) { const s = state(h, t); h.piv.rotation.x = -s.ph; h.sh.position.z = s.v; } };
  el.hitCar = (c, dt, Dd) => {
    const [u, v] = toUV(f, c.x, c.z);
    for (const h of hs) {
      const s = state(h, Dd.t);
      if (test(h, s, u, v, c.y) && hit(c)) {
        const d = Math.sign(s.dv) || 1; c.vx += f.nx * d * 120; c.vz += f.nz * d * 120; c.x += f.nx * d * 8; c.z += f.nz * d * 8;
        for (let i = 0; i < 5; i++) spawnPuff(c.x, 8, c.z, 0xffffff, 0.4, 10);
      }
    }
  };
  el.danger = (t, u, v) => hs.some(h => test(h, state(h, t), u, v, 0));
};

/* Rotierender Balken mit Nabe: schleudert Karts weg */
BUILD.sweep = (el, D, g, def, T, rng) => {
  const f = el.f, w = (rng() < 0.5 ? -1 : 1) * 1.3, ph = rng() * TAU, root = new THREE.Group(), metal = lam(0x2b3040);
  root.position.set(f.cx, 0, f.cz); g.add(root);
  const hub = cyl(8, 9, 28, metal); hub.position.y = 14; root.add(hub);
  const bar = new THREE.Group(); root.add(bar);
  const b = box(116, 12, 7, new THREE.MeshLambertMaterial({ map: T.haz })); b.position.y = 9; bar.add(b);
  for (const s of [-1, 1]) { const e = ball(6.5, lam(def.curb[0])); e.position.set(s * 58, 9, 0); bar.add(e); }
  const cap = ball(6, lam(0xff4b3e)); cap.position.y = 28; root.add(cap);
  const bc = { x: f.cx, z: f.cz, cs: 1, sn: 0, hx: 58, hz: 4, y0: 0, y1: 20, w, px: f.cx, pz: f.cz, on: true, el, k: 0 };
  el.cols.push(bc, { x: f.cx, z: f.cz, r: 8, y0: 0, y1: 28, on: true, el, k: 1 });
  el.R = 74;
  el.update = t => { const th = f.ang + ph + w * t; bar.rotation.y = -th; bc.cs = Math.cos(th); bc.sn = Math.sin(th); };
  el.danger = (t, u, v) => { const a = ph + w * t, s = u * Math.cos(a) + v * Math.sin(a), p = -u * Math.sin(a) + v * Math.cos(a); return (Math.abs(s) < 58 + RK && Math.abs(p) < 7 + RK) || Math.hypot(u, v) < 8 + RK; };
};

/* Bewegliche Wände: zwei Schiebetore im Wechsel */
const WT = 3.4, WA = 40, WHW = 20;
BUILD.wall = (el, D, g, def, T) => {
  const f = el.f, root = fgroup(g, f), mat = new THREE.MeshLambertMaterial({ map: T.haz }), ws = [];
  [{ u: -30, ph: 0 }, { u: 30, ph: 0.9 }].forEach((w, i) => {
    const m = new THREE.Group(); root.add(m);
    const slab = box(9, 22, WHW * 2, mat); slab.position.y = 11; m.add(slab);
    const top = box(11, 3, WHW * 2 + 2, lam(def.curb[0])); top.position.y = 23; m.add(top);
    const col = { x: 0, z: 0, cs: f.tx, sn: f.tz, hx: 4.5, hz: WHW, y0: 0, y1: 24, vx: 0, vz: 0, on: true, el, k: i };
    el.cols.push(col); ws.push(Object.assign(w, { m, col }));
  });
  const pos = (w, t) => WA * Math.sin(TAU * t / WT + w.ph);
  el.R = 60;
  el.update = t => {
    for (const w of ws) {
      const m = pos(w, t), dm = WA * TAU / WT * Math.cos(TAU * t / WT + w.ph), [x, z] = fxz(f, w.u, m);
      w.m.position.set(w.u, 0, m); w.col.x = x; w.col.z = z; w.col.vx = f.nx * dm; w.col.vz = f.nz * dm;
    }
  };
  el.danger = (t, u, v) => ws.some(w => Math.abs(u - w.u) < 4.5 + RK + 3 && Math.abs(v - pos(w, t)) < WHW + RK + 1);
};

/* Poller, die aus dem Boden fahren: erst Warnleuchten, dann zwei wechselnde Muster */
const PP = 6.4, PH = 34;
const popTop = x => { x = ((x % PP) + PP) % PP; if (x < 0.9) return 0; x -= 0.9; if (x < 0.15) return PH * x / 0.15; x -= 0.15; if (x < 1.95) return PH; x -= 1.95; return x < 0.3 ? PH * (1 - x / 0.3) : 0; };
const popWarn = x => { x = ((x % PP) + PP) % PP; return x < 0.9 ? x / 0.9 : 0; };
BUILD.popup = (el, D, g, def, T) => {
  const f = el.f, root = fgroup(g, f), SETS = [[-46, 0, 46], [-23, 23]], ps = [];
  const pm = lam(def.curb[0]), ring = lam(0xffffff);
  [[-22, 0], [22, 1.6]].forEach(([u, shift]) => SETS.forEach((lats, si) => lats.forEach(v => {
    const m = new THREE.Group(); m.position.set(u, 0, v); root.add(m);
    const body = cyl(9, 9, PH, pm); m.add(body); const rg = cyl(9.6, 9.6, 3, ring); rg.position.y = PH / 2 - 6; body.add(rg);
    const cap = cyl(8, 8, 2, lam(0xffd23f)); cap.position.y = PH / 2 + 1; body.add(cap);
    const base = new THREE.Mesh(new THREE.CircleGeometry(12, 18), bas(0xff3b30, { transparent: true, opacity: 0 })); base.rotation.x = -Math.PI / 2; base.position.set(u, 0.62, v); root.add(base);
    const [x, z] = fxz(f, u, v), col = { x, z, r: 9, y0: 0, y1: 0, on: false, el, k: ps.length, hurt: true, rising: false };
    el.cols.push(col); ps.push({ body, base, col, off: si * 3.2 + shift });
  })));
  el.R = 54;
  el.update = t => {
    for (const p of ps) {
      const top = popTop(t - p.off), wa = popWarn(t - p.off), rising = top > 0 && top < PH && popTop(t - p.off - 0.05) < top;
      p.body.visible = top > 0.5; p.body.position.y = top - PH / 2;
      p.base.material.opacity = wa > 0 ? 0.35 + 0.5 * (Math.floor(t * 8) % 2) : 0;
      p.col.y1 = top; p.col.on = top > 3; p.col.rising = rising;
    }
  };
  el.danger = (t, u, v) => ps.some(p => { const [pu, pv] = toUV(f, p.col.x, p.col.z); return Math.abs(u - pu) < 9 + RK + 2 && Math.abs(v - pv) < 9 + RK + 2 && (popTop(t - p.off) > 4 || popWarn(t - p.off) > 0 || popTop(t - p.off + 0.3) > 4); });
};

/* Holzkisten: zerbrechen ab Tempo 50 (oder mit Boost/Schild), sonst wie eine Wand */
BUILD.crates = (el, D, g, def, T, rng) => {
  const root = fgroup(g, el.f), items = [];
  [[0, [-48, -24, 0, 24, 48]], [24, [-36, -12, 12, 36]]].forEach(([u, lats]) => {
    const keep = lats.filter(() => rng() < 0.7); if (keep.length < 2) keep.push(lats[0], lats[lats.length - 1]);
    for (const v of new Set(keep)) items.push({ u, v, yaw: (rng() - 0.5) * 0.5, hx: 8, hz: 8, h: 16 });
  });
  const mat = new THREE.MeshLambertMaterial({ map: T.crate });
  breakables(el, D, root, items, () => { const m = new THREE.Group(); const b = box(16, 16, 16, mat); b.position.y = 8; m.add(b); return m; }, { respawn: 18, pieces: 6, wood: 0xb98a52, size: 5, brk: { minS: 50, slow: 0.9 } });
  el.R = 50;
};

/* Absperrungen (Baustellengitter) im Slalom: brechen schon bei geringem Tempo */
BUILD.barrier = (el, D, g, def, T) => {
  const root = fgroup(g, el.f), items = [[-30, -30], [0, 30], [30, -30]].map(([u, v]) => ({ u, v, yaw: 0, hx: 3, hz: 26, h: 20 }));
  const mat = new THREE.MeshLambertMaterial({ map: T.red }), leg = lam(0x555b6e);
  breakables(el, D, root, items, () => {
    const m = new THREE.Group();
    for (const y of [7, 15]) { const b = box(4, 6, 52, mat); b.position.y = y; m.add(b); }
    for (const z of [-22, 22]) { const l = box(4, 18, 4, leg); l.position.set(0, 9, z); m.add(l); }
    return m;
  }, { respawn: 14, pieces: 5, wood: 0xe8e8e8, size: 6, brk: { minS: 25, slow: 0.95 } });
  el.R = 50;
};

/* Hubrampe: Keil, dessen Höhe wechselt. Am Ende springt das Kart ab, wenn sie hoch steht */
const HVT = 4.4, HVH = 17;
BUILD.heave = (el, D, g, def, T, rng) => {
  const f = el.f, L = f.L, ph = rng() * TAU, root = fgroup(g, f), geo = new THREE.BufferGeometry();
  const P = (u, h, z) => [u, h, z], tris = [];
  const quad = (a, b, c, d, uv) => { tris.push([a, uv[0]], [b, uv[1]], [c, uv[2]], [a, uv[0]], [c, uv[2]], [d, uv[3]]); };
  quad(P(0, 0, -1), P(1, 1, -1), P(1, 1, 1), P(0, 0, 1), [[0, 0], [0, 2], [4, 2], [4, 0]]);
  quad(P(1, 0, -1), P(1, 0, 1), P(1, 1, 1), P(1, 1, -1), [[0, 0], [4, 0], [4, 1], [0, 1]]);
  for (const s of [-1, 1]) { tris.push([P(0, 0, s), [0, 0]], [P(1, 0, s), [2, 0]], [P(1, 1, s), [2, 1]]); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flatMap(t => t[0]), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(tris.flatMap(t => t[1]), 2));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: T.haz, side: THREE.DoubleSide }));
  mesh.position.set(-L / 2, 0.35, 0); root.add(mesh);
  const H = t => HVH * (0.5 - 0.5 * Math.cos(TAU * t / HVT + ph));
  el.R = L / 2 + 20;
  el.update = t => { mesh.scale.set(L, Math.max(0.02, H(t)), LATW - 2); };
  el.support = (c, sup, dt, Dd) => {
    const [u, v] = toUV(f, c.x, c.z);
    if (Math.abs(v) >= LATW - 2 || u <= -L / 2 || u >= L / 2) return;
    const h = H(Dd.t) * (u + L / 2) / L;
    if (h <= c.y + STEP) { if (!sup.solid || h > sup.h) { sup.solid = true; sup.h = h; } }
    else { c.x -= c.vx * dt; c.z -= c.vz * dt; c.vx *= 0.3; c.vz *= 0.3; c.s *= 0.4; if (c === S.player) snd('bump'); sup.moved = true; }
  };
};

/* Drehscheibe über der Straße: nimmt Karts mit und dreht sie ein Stück mit */
BUILD.turn = (el, D, g, def, T, rng) => {
  const f = el.f, w = (rng() < 0.5 ? -1 : 1) * 0.8, R = 60;
  const mesh = cyl(R, R, 1.2, [lam(0x2b3040), new THREE.MeshLambertMaterial({ map: T.turn }), lam(0x2b3040)], 36);
  mesh.position.set(f.cx, -0.1, f.cz); g.add(mesh);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 1.4, 6, 40), lam(def.curb[0])); rim.rotation.x = Math.PI / 2; rim.position.set(f.cx, 0.55, f.cz); g.add(rim);
  el.R = R + 10;
  el.update = t => { mesh.rotation.y = -w * t; };
  el.carry = (c, dt) => {
    if (c.air || c.y > 3) return false;
    const dx = c.x - f.cx, dz = c.z - f.cz; if (dx * dx + dz * dz > (R - 3) * (R - 3)) return false;
    const p = w * dt, cs = Math.cos(p), sn = Math.sin(p);
    c.x = f.cx + dx * cs - dz * sn; c.z = f.cz + dx * sn + dz * cs; c.a += p * 0.6;
    return true;
  };
};

/* Falltür (Klappbrücke): öffnet und schließt in festem Takt, vorher Warnlicht */
const TP = 7.2;
const trapAng = x => { x = ((x % TP) + TP) % TP; if (x < 3.2) return 0; if (x < 3.6) return (x - 3.2) / 0.4 * 1.3; if (x < 5.6) return 1.3; if (x < 6.1) return 1.3 * (1 - (x - 5.6) / 0.5); return 0; };
BUILD.trap = (el, D, g, def, T, rng) => {
  const f = el.f, L = f.L, off = rng() * TP, root = fgroup(g, f), wood = new THREE.MeshLambertMaterial({ map: T.wood }), haz = new THREE.MeshLambertMaterial({ map: T.haz }), hinges = [];
  for (const s of [1, -1]) {
    const hg = new THREE.Group(); hg.position.set(0, 0, s * LATW); root.add(hg);
    const leaf = box(L, 3, LATW, wood); leaf.position.set(0, -1.2, -s * LATW / 2); hg.add(leaf);
    for (const e of [-1, 1]) { const tr = box(4, 3.4, LATW, haz); tr.position.set(e * (L / 2 - 2), -1.1, -s * LATW / 2); hg.add(tr); }
    hinges.push([hg, s]);
  }
  const lamps = [];
  for (const s of [-1, 1]) {
    const post = box(3, 24, 3, lam(0x2b3040)); post.position.set(-L / 2 - 10, 12, s * (LATW + 8)); root.add(post);
    const b = ball(4.5, new THREE.MeshBasicMaterial({ color: 0x3be07a })); b.position.set(-L / 2 - 10, 27, s * (LATW + 8)); root.add(b); lamps.push(b);
  }
  el.R = L / 2 + 14; el.pit = true; el.stopU = L / 2 + 8; el.off = off; el.ang = t => trapAng(t + off);
  el.update = t => {
    const x = (((t + off) % TP) + TP) % TP, warn = x >= 2.2 && x < 3.2, a = trapAng(t + off);
    const shake = warn ? Math.sin(t * 60) * 0.03 : 0;
    for (const [hg, s] of hinges) hg.rotation.x = -s * (a + shake);
    const on = a > 0.05 ? 0xff3b30 : warn ? (Math.floor(t * 8) % 2 ? 0xff3b30 : 0x331111) : 0x3be07a;
    for (const l of lamps) l.material.color.setHex(on);
  };
  el.support = (c, sup, dt, Dd) => {
    const [u, v] = toUV(f, c.x, c.z);
    if (Math.abs(u) <= L / 2 + 8 && Math.abs(v) < LATW && trapAng(Dd.t + off) < 0.3) { sup.solid = true; sup.h = Math.max(sup.h, 0); }   // 8 Reserve: der nächste Stützpunkt wechselt schon vor dem sichtbaren Rand
  };
  el.danger = (t, u) => Math.abs(u) < L / 2 + 8 && (trapAng(t + off) > 0.05 || trapAng(t + off + 0.25) > 0.05);
};

/* Schiebeplattform über dem Abgrund: trägt Karts quer mit */
const SLT = 6.4, SLA = 30, SLHW = 27;
BUILD.slider = (el, D, g, def, T, rng) => {
  const f = el.f, L = f.L, ph = rng() * TAU, root = fgroup(g, f), wood = new THREE.MeshLambertMaterial({ map: T.wood }), haz = new THREE.MeshLambertMaterial({ map: T.haz });
  const pl = new THREE.Group(); root.add(pl);
  const slab = box(L, 3, SLHW * 2, wood); slab.position.y = -1.2; pl.add(slab);
  for (const s of [-1, 1]) { const e = box(L, 3.4, 4, haz); e.position.set(0, -1.1, s * (SLHW - 2)); pl.add(e); }
  const m = t => SLA * Math.sin(TAU * t / SLT + ph);
  el.R = L / 2 + 14;
  el.update = t => { pl.position.z = m(t); };
  el.carry = (c, dt, Dd) => {
    if (c.air || c.y > 2) return false;
    const [u, v] = toUV(f, c.x, c.z), pm = m(Dd.t - dt);
    if (Math.abs(u) > L / 2 || Math.abs(v - pm) > SLHW) return false;
    const dm = m(Dd.t) - pm; c.x += f.nx * dm; c.z += f.nz * dm; return true;
  };
  el.support = (c, sup, dt, Dd) => {
    const [u, v] = toUV(f, c.x, c.z);
    if (Math.abs(u) <= L / 2 + 8 && Math.abs(v - m(Dd.t)) <= SLHW) { sup.solid = true; sup.h = Math.max(sup.h, 0); }
  };
  el.danger = (t, u, v) => Math.abs(u) < L / 2 + 8 && Math.abs(v - m(t)) > SLHW - RK - 3;
  el.laneAt = t => m(t);
};

/* Holzbrücke über einen Bach: bricht unter schnellen Karts, danach ist der Bach zäh wie Schlamm */
BUILD.creek = (el, D, g, def, T) => {
  const f = el.f, L = f.L, n = 6, pl = L / n, root = fgroup(g, f), col = { water: 0x3fa8e0, mud: 0x6b4a2e, syrup: 0xff5ab0 }[def.puddle] || 0x3fa8e0;
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(L, EDGE * 2), lam(col, { transparent: true, opacity: 0.95 })); bed.rotation.x = -Math.PI / 2; bed.position.y = 0.42; root.add(bed);
  const wood = new THREE.MeshLambertMaterial({ map: T.wood });
  el.alive = []; el.rt = []; el.grow = []; el.meshes = []; el.respawn = 9; el.pieces = 3; el.wood = 0xb98a52; el.psize = 7;
  for (let k = 0; k < n; k++) {
    const p = box(pl - 0.8, 0.6, 2 * 72, wood); p.position.set(-L / 2 + pl * (k + 0.5), 0.55, 0); root.add(p); el.meshes.push(p);
    const [x, z] = fxz(f, -L / 2 + pl * (k + 0.5), 0);
    el.cols.push({ x, z, y1: 4, on: false, el, k }); el.alive.push(true); el.rt.push(0); el.grow.push(1);
  }
  for (const s of [-1, 1]) { const rail = box(L, 5, 2, lam(0x6b4a2e)); rail.position.set(0, 3, s * 74); root.add(rail); }
  el.R = L / 2;
  const plank = u => clamp(Math.floor((u + L / 2) / pl), 0, n - 1);
  el.update = (t, dt) => { for (let k = 0; k < n; k++) if (!el.alive[k]) { el.rt[k] -= dt; if (el.rt[k] <= 0) { el.alive[k] = true; el.meshes[k].visible = true; } } };
  el.reset = () => { for (let k = 0; k < n; k++) { el.alive[k] = true; el.meshes[k].visible = true; } };
  el.hitCar = (c, dt, Dd) => {
    if (c.air || c.y > 3) return;
    const [u, v] = toUV(f, c.x, c.z); if (Math.abs(u) > L / 2 || Math.abs(v) > 72) return;
    const k = plank(u); if (el.alive[k] && (c.s > 110 || c.boost > 0)) breakEl(Dd, el, k, c);
  };
  el.mods = c => {
    if (c.air || c.y > 3) return;
    const [u, v] = toUV(f, c.x, c.z); if (Math.abs(u) > L / 2) return;
    if (Math.abs(v) > 72 || !el.alive[plank(u)]) { c.dpT *= 0.6; c.dpA *= 0.6; c.dpG *= 0.9; }
  };
};

/* Rutschwelle: Düsen am Rand fluten die Straße zeitweise, dann ist sie glatt */
const SKP = 9;
const slickF = x => { x = ((x % SKP) + SKP) % SKP; return x < 1 ? 0 : x < 4.6 ? 1 : x < 5.4 ? 1 - (x - 4.6) / 0.8 : 0; };
BUILD.slick = (el, D, g, def, T, rng) => {
  const f = el.f, L = f.L, off = rng() * SKP, root = fgroup(g, f), col = { water: 0x6fd0ff, mud: 0x3b2a1a, syrup: 0xff7ac0 }[def.puddle] || 0x6fd0ff;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(L, ROAD_HALF * 2), new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false, emissive: def.puddle === 'syrup' ? 0x551133 : 0x000000 }));
  sheet.rotation.x = -Math.PI / 2; sheet.position.y = 0.55; root.add(sheet);
  const jets = [];
  for (const s of [-1, 1]) { const j = cyl(3, 4.5, 8, lam(0x2b3040)); j.position.set(0, 4, s * (LATW + 6)); root.add(j); jets.push(s); }
  el.R = L / 2;
  el.update = t => {
    const x = (((t + off) % SKP) + SKP) % SKP, f2 = slickF(t + off);
    sheet.material.opacity = f2 * 0.6 + (x < 1 ? 0.12 * Math.floor(t * 6 % 2) : 0);
    if ((x < 1 || f2 > 0) && Math.random() < 0.35) for (const s of jets) { const [px, pz] = fxz(f, rand(-L / 2, L / 2), s * (LATW - 6)); spawnPuff(px, 5, pz, col, 0.5, 6); }
  };
  el.mods = c => {
    if (c.air || c.y > 3) return;
    const [u, v] = toUV(f, c.x, c.z); if (Math.abs(u) > L / 2 || Math.abs(v) > LATW) return;
    if (slickF(S.world.dyn.t + off) > 0.5) { c.dpG *= 0.35; c.dpT *= 0.92; }
  };
};

/* ---------- Spiel-Schleife ---------- */
export function dynReset() {
  const D = S.world && S.world.dyn; if (!D) return;
  D.t = 0; D.hs = null;
  for (const el of D.els) if (el.reset) el.reset();
  for (const p of D.debris) { p.life = 0; p.m.visible = false; }
}
export function dynUpdate(dt) {
  const D = S.world && S.world.dyn; if (!D) return;
  if (S.state === 'count') D.t = Math.min(0, 0.6 - S.countT);
  else {
    D.t += dt;
    /* Mehrspieler: Uhr des Gastgebers als Bezug, Abweichung wird weich abgebaut */
    if (mp.active && S.state === 'race') {
      const h = mpPeers()[0];
      if (h && !(h.isMe && h.sameTab) && h.presence && typeof h.presence.dc === 'number' && h.presence.dc > 0.3) {
        const now = performance.now();
        if (D.hs !== h.presence.dc) { D.hs = h.presence.dc; D.hat = now; }
        const err = D.hs + (now - D.hat) / 1000 + 0.06 - D.t;
        if (Math.abs(err) > 1.2) D.t += err; else D.t += clamp(err, -0.4 * dt, 0.4 * dt);
      }
    }
  }
  for (const el of D.els) el.update(D.t, dt);
  updateDebris(D, dt);
}

/* ---------- Kart und Strecke ---------- */
const SUP = { solid: false, h: 0, moved: false };
const inRange = (el, c) => { const di = wrapIdx(el.iC - c.idx); return di <= el.win && di >= -el.win; };

/* Abstand eines Punktes zur Oberfläche eines Hindernisses (negativ = innen) */
function dist(col, x, z) {
  if (col.r !== undefined) return Math.hypot(x - col.x, z - col.z) - col.r;
  const dx = x - col.x, dz = z - col.z, lx = Math.abs(dx * col.cs + dz * col.sn) - col.hx, lz = Math.abs(-dx * col.sn + dz * col.cs) - col.hz;
  return Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0);
}
/* Kart gegen Hindernis: 0 = frei, 1 = fest berührt, 2 = zerschlagen */
function resolve(c, col, D) {
  if (c.y > col.y1 - 1 || c.y + 12 < col.y0) return 0;
  let nx, nz, pen;
  if (col.r !== undefined) {
    const dx = c.x - col.x, dz = c.z - col.z, d = Math.hypot(dx, dz), R = col.r + RK;
    if (d >= R) return 0;
    if (d > 0.01) { nx = dx / d; nz = dz / d; } else { nx = -Math.cos(c.a); nz = -Math.sin(c.a); }
    pen = R - d;
  } else {
    const dx = c.x - col.x, dz = c.z - col.z, lx = dx * col.cs + dz * col.sn, lz = -dx * col.sn + dz * col.cs;
    const ex = lx - clamp(lx, -col.hx, col.hx), ez = lz - clamp(lz, -col.hz, col.hz), d2 = ex * ex + ez * ez;
    if (d2 >= RK * RK) return 0;
    let lnx, lnz;
    if (d2 > 1e-6) { const d = Math.sqrt(d2); lnx = ex / d; lnz = ez / d; pen = RK - d; }
    else { const px = col.hx - Math.abs(lx), pz = col.hz - Math.abs(lz); if (px < pz) { lnx = Math.sign(lx) || 1; lnz = 0; pen = px + RK; } else { lnx = 0; lnz = Math.sign(lz) || 1; pen = pz + RK; } }
    nx = lnx * col.cs - lnz * col.sn; nz = lnx * col.sn + lnz * col.cs;
  }
  if (col.brk && (Math.abs(c.s) >= col.brk.minS || c.boost > 0 || c.shield > 0)) {
    breakEl(D, col.el, col.k, c); c.s *= col.brk.slow; c.vx *= col.brk.slow; c.vz *= col.brk.slow;
    if (c === S.player) S.shakeT = Math.max(S.shakeT, 0.12);
    return 2;
  }
  pen = Math.min(pen, 16); c.x += nx * pen; c.z += nz * pen;
  let cvx = col.vx || 0, cvz = col.vz || 0;
  if (col.w) { cvx = -col.w * (c.z - col.pz); cvz = col.w * (c.x - col.px); }
  const vn = (c.vx - cvx) * nx + (c.vz - cvz) * nz, moving = cvx !== 0 || cvz !== 0;
  if (vn < 0) {
    const j = -1.2 * vn; c.vx += nx * j; c.vz += nz * j;
    if (moving) { c.vx += nx * 35; c.vz += nz * 35; }
    c.s = Math.max(0, c.vx * Math.cos(c.a) + c.vz * Math.sin(c.a));
    if (-vn > 40 && c === S.player) { snd('bump'); S.shakeT = Math.max(S.shakeT, 0.15); }
  }
  if (col.hurt && col.rising && hit(c)) { c.vx += nx * 120; c.vz += nz * 120; for (let i = 0; i < 5; i++) spawnPuff(c.x, 6, c.z, 0xcdbb98, 0.4, 12); }
  return 1;
}
function unstick(c, D) {
  c.pinT = 0; const pts = S.world.pts;
  for (let k = 10; k <= 34; k += 6) for (const lat of [0, 30, -30, 52, -52]) {
    const i = (c.idx + k) % N, p = pts[i], x = p.x + p.nx * lat, z = p.z + p.nz * lat;
    if (D.els.every(el => el.cols.every(col => !col.on || dist(col, x, z) > RK + 8))) {
      c.prog += k; c.idx = i; c.x = x; c.z = z; c.a = p.ang; c.s = 40; c.vx = p.tx * 40; c.vz = p.tz * 40; c.y = 0; c.lat = lat; c.inv = Math.max(c.inv, 1.5); c.deckY = 0;
      return;
    }
  }
}

/* Pro Schritt für jedes Auto: Mitnahme durch Plattformen, Kollisionen, Treffer, tragende Fläche. Liefert SUP (solid/h) und setzt c.dpT/dpA/dpG. */
export function dynCar(c, dt) {
  const D = S.world.dyn; SUP.solid = false; SUP.h = 0; SUP.moved = false; c.dpT = c.dpA = c.dpG = 1;
  if (!D || c.loop) return SUP;
  let moved = false, touched = false;
  for (const el of D.els) if (el.carry && inRange(el, c) && el.carry(c, dt, D)) moved = true;
  if (c.y < 60) for (const el of D.els) {
    if (!el.cols.length || !inRange(el, c)) continue;
    for (const col of el.cols) if (col.on) { const r = resolve(c, col, D); if (r === 1) { touched = true; moved = true; } else if (r === 2) moved = true; }
  }
  for (const el of D.els) if (el.hitCar && inRange(el, c)) el.hitCar(c, dt, D);
  for (const el of D.els) if (inRange(el, c)) { if (el.support) el.support(c, SUP, dt, D); if (el.mods) el.mods(c); }
  if (SUP.moved) moved = true;
  if (moved) locate(c);
  if (touched) c.pinT = (c.pinT || 0) + dt; else c.pinT = Math.max(0, (c.pinT || 0) - dt * 2);
  if (c.pinT > 2.2 && Math.abs(c.s) < 25) unstick(c, D);
  return SUP;
}

/* Computergegner: weicht Hindernissen aus (Spur wählen) oder bremst, wenn alle Spuren im Moment der Ankunft gefährlich sind */
const AI = { lane: null, mul: 1 }, LANES = [-56, -48, -40, -32, -24, -16, -8, 0, 8, 16, 24, 32, 40, 48, 56];
export function dynAi(c, dt) {
  AI.lane = null; AI.mul = 1;
  const D = S.world.dyn; if (!D) return AI;
  const vmax = c.st.max * Math.min(1, c.skill || 1), ds = S.world_ds;
  let found = false;
  for (const el of D.els) {
    if (!el.danger) continue;
    const di = wrapIdx(el.iC - c.idx); if (di < -2 || di > 70) continue;
    found = true;
    const du = di * ds;
    if (el.laneAt) { AI.lane = clamp(el.laneAt(D.t + du / Math.max(c.s, 80)), -40, 40); break; }
    let best = null, bc = 1e9;
    for (const L of LANES) {
      let bad = false;
      for (let prof = 0; prof < 2 && !bad; prof++) {   // Ankunft mit Beschleunigung und mit gleichbleibendem Tempo müssen sicher sein
        let x = -du;
        for (let tau = 0; tau < 9; tau += 0.12) {
          const v = prof === 0 ? Math.min(vmax, c.s + c.st.acc * tau) : Math.max(c.s, 50);
          x += v * 0.12; if (x > el.R) break; if (x < -el.R) continue;
          if (el.danger(D.t + tau, x, L) || el.danger(D.t + tau, x, L - 5) || el.danger(D.t + tau, x, L + 5)) { bad = true; break; }
        }
      }
      if (!bad) { const cost = Math.abs(L - c.lane) * 0.6 + Math.abs(L) * 0.15; if (cost < bc) { bc = cost; best = L; } }
    }
    if (best !== null) { AI.lane = best; c.dynWait = 0; }
    else if (du > (el.stopU || el.R)) {
      if (c.s < 20) c.dynWait = (c.dynWait || 0) + dt;
      if ((c.dynWait || 0) < 2.5 || el.pit) { const dw = du - ((el.stopU || el.R) + 24); AI.mul = clamp(Math.sqrt(2 * 16 * Math.max(0, dw)) / c.st.max, el.pit ? 0 : 0.55, 1); }   // nur vor Abgründen ganz anhalten, sonst mit Mindesttempo durchrollen   // vor der Gefahrenzone anhalten und auf die Lücke warten, nach 2,5 s ungeduldig losfahren
    }
    break;
  }
  if (!found) c.dynWait = 0;
  return AI;
}
