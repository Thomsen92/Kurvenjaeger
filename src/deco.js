import * as THREE from 'three';
import { sfx } from './audio.js';
import { S } from './state.js';
import { rand, N, TAU, clamp } from './util.js';
import { lam, sphereG, eyeB, eyeW } from './core.js';
import { hit } from './items.js';

/* ---------- Themenpark-Deko, Pfützen, Tiere ---------- */
export const tmpO = new THREE.Object3D(), tmpC = new THREE.Color();
export const keepG = g => { g.userData.keep = true; return g; };
/* Instanzen setzen: fn(i, o, color) füllt Position/Skalierung und gibt optional eine Farbe zurück. */
export function inst(group, geo, mat, n, fn) {
  const m = new THREE.InstancedMesh(keepG(geo), mat, n);
  for (let i = 0; i < n; i++) {
    tmpO.position.set(0, 0, 0); tmpO.scale.set(1, 1, 1); tmpO.rotation.order = 'XYZ'; tmpO.rotation.set(0, 0, 0);
    const c = fn(i, tmpO); tmpO.updateMatrix(); m.setMatrixAt(i, tmpO.matrix);
    if (c !== undefined && c !== null) { tmpC.set(c); m.setColorAt(i, tmpC); }
  }
  group.add(m); return m;
}
export function edgeSpot(pts, lo, hi) {
  for (let t = 0; t < 40; t++) {
    const i = Math.floor(rand(0, N));
    if (S.world.near[i]) continue;
    const side = Math.random() < 0.5 ? -1 : 1, lat = side * (rand(lo, hi) + 32), p = pts[i];
    return { x: p.x + p.nx * lat, z: p.z + p.nz * lat, ang: p.ang, side };
  }
  const p = pts[0]; return { x: p.x + p.nx * 55, z: p.z + p.nz * 55, ang: p.ang, side: 1 };
}
export const R = (a, b) => rand(a, b);
export const FARM_TREES = 150, WATER_PALMS = 115, CANDY_TREES = 85;
export const orient = (g, s) => { g.position.set(s.x, 0, s.z); g.rotation.y = -(s.ang + s.side * Math.PI / 2); };


/* Geometrien zusammenfügen, mit weichem Farbverlauf (unten dunkler, oben heller) */
export const mxOf = (x, y, z, sx, sy, sz, rx, ry, rz) => {
  const o = new THREE.Object3D(); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx || 0, ry || 0, rz || 0); o.updateMatrix(); return o.matrix.clone();
};
export function mergeGeos(parts, dark, light) {
  const pos = [], nor = [], uv = [], idx = [];
  let off = 0;
  for (const [g, m] of parts) {
    const c = g.clone(); c.applyMatrix4(m);
    const p = c.attributes.position.array, n = c.attributes.normal.array, u = c.attributes.uv.array, ix = c.index.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    for (let i = 0; i < u.length; i++) uv.push(u[i]);
    for (let i = 0; i < ix.length; i++) idx.push(ix[i] + off);
    off += p.length / 3;
  }
  let lo = 1e9, hi = -1e9;
  for (let i = 1; i < pos.length; i += 3) { lo = Math.min(lo, pos[i]); hi = Math.max(hi, pos[i]); }
  const col = [], d = dark === undefined ? 0.66 : dark, l = light === undefined ? 1 : light;
  for (let i = 1; i < pos.length; i += 3) { const t = hi > lo ? (pos[i] - lo) / (hi - lo) : 1, v = d + (l - d) * t; col.push(v, v, v); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  return out;
}
export const shadeMat = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c, vertexColors: true }, o || {}));
export const unitS = () => new THREE.SphereGeometry(1, 10, 8);
/* Laubbaum: Krone aus fünf runden Blättern */
export function oakCrownGeo() {
  const S = unitS();
  return mergeGeos([[S, mxOf(0, 0, 0, 11, 9.5, 11)], [S, mxOf(8, -2.5, 3, 8, 7, 8)], [S, mxOf(-7, -2, -4, 8.5, 7.5, 8.5)],
    [S, mxOf(2, -3, -8, 7.5, 6.5, 7.5)], [S, mxOf(-3, 6.5, 3, 7.5, 6.5, 7.5)]], 0.6, 1);
}
/* Kiefer: drei gestufte Kegel */
export function pineGeo() {
  return mergeGeos([[new THREE.ConeGeometry(13, 16, 9), mxOf(0, 8, 0, 1, 1, 1)], [new THREE.ConeGeometry(10, 15, 9), mxOf(0, 19, 0, 1, 1, 1)],
    [new THREE.ConeGeometry(7, 14, 9), mxOf(0, 29, 0, 1, 1, 1)], [new THREE.ConeGeometry(4, 10, 8), mxOf(0, 38, 0, 1, 1, 1)]], 0.62, 1);
}
/* Palme: gebogener Stamm und Wedel */
export function palmTrunkGeo() {
  const parts = []; let x = 0, y = 0, a = 0;
  for (let i = 0; i < 6; i++) { const h = 5.2, r0 = 2.6 - i * 0.22; parts.push([new THREE.CylinderGeometry(r0 - 0.2, r0, h, 7), mxOf(x + Math.sin(a) * h / 2, y + Math.cos(a) * h / 2, 0, 1, 1, 1, 0, 0, -a)]); x += Math.sin(a) * h; y += Math.cos(a) * h; a += 0.1; }
  const g = mergeGeos(parts, 0.7, 1); g.userData.top = [x, y]; return g;
}
export function palmCrownGeo(tx, ty) {
  const parts = [];
  for (let k = 0; k < 8; k++) {
    const ang = k / 8 * TAU, o = new THREE.Object3D();
    const leaf = new THREE.ConeGeometry(2.6, 20, 4); leaf.translate(0, 10, 0); // Spitze nach außen
    const m = new THREE.Object3D(); m.position.set(tx, ty, 0); m.rotation.order = 'YZX'; m.rotation.y = ang; m.rotation.z = -1.25; m.scale.set(1, 1, 0.45); m.updateMatrix();
    parts.push([leaf, m.matrix.clone()]);
  }
  parts.push([unitS(), mxOf(tx, ty - 1, 0, 3, 3, 3)]);
  return mergeGeos(parts, 0.7, 1);
}
/* Zuckerwatte-Baum: Wolke aus Kugeln */
export function cottonGeo() {
  const S = unitS();
  return mergeGeos([[S, mxOf(0, 0, 0, 10, 8.5, 10)], [S, mxOf(7, -2, 2, 7.5, 6.5, 7.5)], [S, mxOf(-7, -2, -2, 7.5, 6.5, 7.5)], [S, mxOf(0, 5, 0, 7, 6, 7)], [S, mxOf(1, -3, -7, 7, 6, 7)]], 0.78, 1);
}

export function buildTheme(def, group, pts) {
  S.world.spinners = [];
  if (def.decor === 'farm') themeFarm(group, pts);
  else if (def.decor === 'candy') themeCandy(group, pts);
  else themeWater(group, pts);
}

export function themeFarm(group, pts) {
  const spots = [];
  for (let i = 0; i < FARM_TREES; i++) { const sp = edgeSpot(pts, 46, 58); spots.push({ x: sp.x, z: sp.z, k: R(0.8, 1.45), oak: Math.random() < 0.6, ry: R(0, 6) }); }
  const oaks = spots.filter(t => t.oak), pines = spots.filter(t => !t.oak);
  const greens = ['#4f9a3c', '#5aa843', '#6bb34c', '#3f8a3a'], pineG = ['#2f7a4a', '#2a6e44', '#357f50'];
  inst(group, new THREE.CylinderGeometry(1.7, 2.9, 15, 8), lam(0x6b4a2e), oaks.length, (i, o) => { const t = oaks[i]; o.position.set(t.x, 7.5 * t.k, t.z); o.scale.set(t.k, t.k, t.k); });
  const oakM = new THREE.InstancedMesh(keepG(oakCrownGeo()), shadeMat(0xffffff), oaks.length);
  oaks.forEach((t, i) => { tmpO.position.set(t.x, 22 * t.k, t.z); tmpO.scale.set(t.k, t.k, t.k); tmpO.rotation.set(0, t.ry, 0); tmpO.updateMatrix(); oakM.setMatrixAt(i, tmpO.matrix); tmpC.set(greens[i % greens.length]); oakM.setColorAt(i, tmpC); });
  group.add(oakM);
  inst(group, new THREE.CylinderGeometry(1.3, 2.2, 10, 7), lam(0x5b3f28), pines.length, (i, o) => { const t = pines[i]; o.position.set(t.x, 5 * t.k, t.z); o.scale.set(t.k, t.k, t.k); });
  const pineM = new THREE.InstancedMesh(keepG(pineGeo()), shadeMat(0xffffff), pines.length);
  pines.forEach((t, i) => { tmpO.position.set(t.x, 8 * t.k, t.z); tmpO.scale.set(t.k, t.k, t.k); tmpO.rotation.set(0, t.ry, 0); tmpO.updateMatrix(); pineM.setMatrixAt(i, tmpO.matrix); tmpC.set(pineG[i % pineG.length]); pineM.setColorAt(i, tmpC); });
  group.add(pineM);
  inst(group, new THREE.CylinderGeometry(4.2, 4.2, 7, 12), lam(0xe0b84e), 60, (i, o) => { const s = edgeSpot(pts, 44, 58); o.position.set(s.x, 4.2, s.z); o.rotation.order = 'YXZ'; o.rotation.set(Math.PI / 2, R(0, 3), 0); return Math.random() < 0.5 ? '#e0b84e' : '#c99a36'; });
  // Scheunen, Silos, Windmühle
  for (let k = 0; k < 10; k++) {
    const s = edgeSpot(pts, 50, 54), g = new THREE.Group(); orient(g, s);
    if (k % 3 === 2) {
      const silo = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 34, 14), lam(0xc9ced8)); silo.position.y = 17; g.add(silo);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(7, 9, 14), lam(0xd23b34)); cap.position.y = 38; g.add(cap);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(17, 13, 24), lam(0xc8372f)); body.position.y = 6.5; g.add(body);
      for (const q of [-1, 1]) { const slab = new THREE.Mesh(new THREE.BoxGeometry(11, 0.8, 26), lam(0x8e2420)); slab.position.set(q * 4.7, 15.4, 0); slab.rotation.z = -q * 0.62; g.add(slab); }
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 8), lam(0xf4efe4)); door.position.set(-8.7, 4.5, 0); g.add(door);
      const x = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1, 11), lam(0xc8372f)); x.position.set(-8.9, 4.5, 0); x.rotation.x = 0.8; g.add(x);
    }
    group.add(g);
  }
  for (let k = 0; k < 3; k++) {
    const s = edgeSpot(pts, 52, 54), g = new THREE.Group(); orient(g, s);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 7, 36, 8), lam(0xf1ead8)); tower.position.y = 18; g.add(tower);
    const hub = new THREE.Group(); hub.position.set(6, 34, 0); g.add(hub);
    for (let b = 0; b < 4; b++) { const blade = new THREE.Mesh(new THREE.BoxGeometry(1, 30, 5), lam(0xffffff)); blade.position.y = 15; const arm = new THREE.Group(); arm.rotation.x = b * Math.PI / 2; arm.add(blade); hub.add(arm); }
    group.add(g); S.world.spinners.push(hub);
  }
}

export function themeCandy(group, pts) {
  const cols = ['#ff6ad5', '#ffd23f', '#7ff3ff', '#a0f07a', '#ff8a5c', '#b79bff'];
  inst(group, new THREE.SphereGeometry(1, 12, 8), lam(0xffffff), 140, (i, o) => { const s = edgeSpot(pts, 44, 60), k = R(5, 11); o.position.set(s.x, k * 0.55, s.z); o.scale.set(k, k * 0.75, k); return cols[i % cols.length]; });
  const cots = [];
  for (let i = 0; i < CANDY_TREES; i++) { const sp = edgeSpot(pts, 46, 58); cots.push({ x: sp.x, z: sp.z, k: R(0.9, 1.5), ry: R(0, 6) }); }
  inst(group, new THREE.CylinderGeometry(1.4, 1.9, 16, 7), lam(0xf4efe4), cots.length, (i, o) => { const t = cots[i]; o.position.set(t.x, 8 * t.k, t.z); o.scale.set(t.k, t.k, t.k); });
  const cotM = new THREE.InstancedMesh(keepG(cottonGeo()), shadeMat(0xffffff), cots.length);
  const cotC = ['#ff9ad0', '#9fe8ff', '#d3b3ff', '#ffd0e8'];
  cots.forEach((t, i) => { tmpO.position.set(t.x, 22 * t.k, t.z); tmpO.scale.set(t.k, t.k, t.k); tmpO.rotation.set(0, t.ry, 0); tmpO.updateMatrix(); cotM.setMatrixAt(i, tmpO.matrix); tmpC.set(cotC[i % 4]); cotM.setColorAt(i, tmpC); });
  group.add(cotM);
  S.world._t = [];
  inst(group, new THREE.CylinderGeometry(0.9, 0.9, 22, 6), lam(0xffffff), 64, (i, o) => { const s = edgeSpot(pts, 46, 58); S.world._t[i] = s; o.position.set(s.x, 11, s.z); });
  inst(group, new THREE.SphereGeometry(1, 14, 8), lam(0xffffff), 64, (i, o) => { const s = S.world._t[i]; o.position.set(s.x, 23, s.z); o.scale.set(8, 8, 1.8); o.rotation.set(0, R(0, 3), 0); return cols[(i + 2) % cols.length]; });
  S.world._t = null;
  for (let k = 0; k < 12; k++) {
    const s = edgeSpot(pts, 50, 58), g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.scale.setScalar(R(1.5, 2.3));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(6, 18, 12), lam(0xd9a05b)); cone.rotation.x = Math.PI; cone.position.y = 9; g.add(cone);
    const scoop = new THREE.Mesh(sphereG, lam(cols[k % cols.length])); scoop.scale.setScalar(7); scoop.position.y = 20; g.add(scoop);
    const cherry = new THREE.Mesh(sphereG, lam(0xd8203a)); cherry.scale.setScalar(2.2); cherry.position.y = 28; g.add(cherry);
    group.add(g);
  }
}

export function themeWater(group, pts) {
  const trunkGeo = keepG(palmTrunkGeo()), top = trunkGeo.userData.top;
  const palms = [];
  for (let i = 0; i < WATER_PALMS; i++) { const sp = edgeSpot(pts, 46, 58); palms.push({ x: sp.x, z: sp.z, k: R(0.85, 1.4), ry: R(0, 6) }); }
  const trM = new THREE.InstancedMesh(trunkGeo, shadeMat(0xb98550), palms.length), crM = new THREE.InstancedMesh(keepG(palmCrownGeo(top[0], top[1])), shadeMat(0xffffff), palms.length);
  palms.forEach((t, i) => {
    tmpO.position.set(t.x, 0, t.z); tmpO.scale.set(t.k, t.k, t.k); tmpO.rotation.set(0, t.ry, 0); tmpO.updateMatrix();
    trM.setMatrixAt(i, tmpO.matrix); crM.setMatrixAt(i, tmpO.matrix); tmpC.set(i % 2 ? '#2fae5a' : '#47c46b'); crM.setColorAt(i, tmpC);
  });
  group.add(trM, crM);
  const bc = ['#ff4b3e', '#ffd23f', '#4fd8ff', '#ff6ad5', '#ffffff'];
  inst(group, sphereG, lam(0xffffff), 48, (i, o) => { const s = edgeSpot(pts, 44, 60), k = R(6, 10); o.position.set(s.x, k, s.z); o.scale.set(k, k, k); return bc[i % bc.length]; });
  inst(group, new THREE.TorusGeometry(6, 2.4, 8, 16), lam(0xffffff), 38, (i, o) => { const s = edgeSpot(pts, 44, 60); o.position.set(s.x, 2.6, s.z); o.rotation.set(Math.PI / 2, 0, 0); return bc[(i + 1) % bc.length]; });
  for (let k = 0; k < 8; k++) {
    const s = edgeSpot(pts, 50, 54), g = new THREE.Group(); orient(g, s);
    for (const a of [-1, 1]) for (const b of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.6, 16, 1.6), lam(0xf4efe4)); l.position.set(a * 5, 8, b * 5); g.add(l); }
    const cab = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 14), lam(0xf4efe4)); cab.position.y = 20; g.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(17, 2.4, 17), lam(0xe23b30)); roof.position.y = 25.2; g.add(roof);
    group.add(g);
  }
  for (let k = 0; k < 5; k++) {
    const s = edgeSpot(pts, 52, 56), g = new THREE.Group(); orient(g, s);
    const tw = new THREE.Mesh(new THREE.BoxGeometry(10, 46, 10), lam(0xf2f2f2)); tw.position.y = 23; g.add(tw);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 70, 10), lam(k % 2 ? 0xffd23f : 0x4fd8ff)); tube.rotation.z = 1.0; tube.position.set(26, 22, 0); g.add(tube);
    group.add(g);
  }
}

/* Pfützen */
export const PUDDLE = { water: { color: 0x4fa8e0, opacity: 0.8 }, mud: { color: 0x6b4a2e, opacity: 0.95 }, syrup: { color: 0xff5ab0, opacity: 0.9 } };
export function buildPuddles(def, group, pts) {
  const list = [], g = keepG(new THREE.CircleGeometry(1, 22));
  const info = PUDDLE[def.puddle];
  for (let k = 0; k < 24; k++) {
    let i = Math.floor((k + 0.5) * N / 24 + R(-14, 14)); i = (i + N) % N;
    if (S.world.near[i] || i < 36 || i > N - 20) continue;
    const p = pts[i], lat = R(-44, 44), r = R(14, 22);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: info.color, transparent: true, opacity: info.opacity, emissive: def.puddle === 'syrup' ? 0x551133 : 0x000000 }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x + p.nx * lat, 0.45, p.z + p.nz * lat); m.scale.set(r, r * 0.7, 1); m.rotation.z = p.ang;
    group.add(m);
    list.push({ x: m.position.x, z: m.position.z, r, ang: p.ang, type: def.puddle });
  }
  S.world.puddles = list;
}

/* Tiere, die über die Straße laufen */
export function makeWalker(type) {
  const g = new THREE.Group(), legs = [];
  const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || g).add(m); return m; };
  const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const leg = (x, z, col, h, w) => { const pv = new THREE.Group(); pv.position.set(x, h, z); g.add(pv); const m = new THREE.Mesh(bx(w, h, w), col); m.position.y = -h / 2; pv.add(m); legs.push(pv); };
  if (type === 'cow') {
    const wh = lam(0xf6f3ee), bk = lam(0x1d1d22), pk = lam(0xf4a6b4);
    add(bx(18, 9.5, 8.5), wh, 0, 13, 0);
    add(bx(5.4, 9.8, 8.8), bk, -3, 13, 0); add(bx(4, 9.8, 8.8), bk, 4.5, 13.4, 0);
    add(bx(7, 7, 7), wh, 11.5, 16, 0); add(bx(2.4, 4.2, 6), pk, 15.4, 14.6, 0);
    for (const s of [-1, 1]) { add(sphereG, eyeB, 14.4, 17.6, s * 2.6).scale.setScalar(0.8); add(new THREE.ConeGeometry(0.9, 3, 6), lam(0xe8dcc0), 11, 20.4, s * 2.8); }
    add(bx(1, 7, 1), bk, -9.4, 13, 0); add(sphereG, pk, 3, 7.4, 0).scale.set(2.4, 1.8, 2.4);
    for (const x of [-6, 6]) for (const z of [-2.8, 2.8]) leg(x, z, wh, 8.5, 2.6);
  } else if (type === 'duck') {
    const ye = lam(0xffd23f), or = lam(0xff9f1c);
    add(sphereG, ye, 0, 12, 0).scale.set(9.5, 7.4, 7);
    add(sphereG, ye, 7.5, 19.5, 0).scale.setScalar(5);
    add(bx(4.4, 1.6, 4.2), or, 12.4, 19, 0);
    for (const s of [-1, 1]) add(sphereG, eyeB, 10.4, 21, s * 2.4).scale.setScalar(0.9);
    add(sphereG, lam(0xf2c022), -1, 13, 0).scale.set(5, 3.2, 8.2);
    for (const z of [-2.6, 2.6]) leg(0, z, or, 6, 1.8);
  } else {
    const col = lam([0xff5a8a, 0x7ddc6f, 0xffa03c, 0xe84a4a][Math.floor(Math.random() * 4)]);
    add(sphereG, col, 0, 11, 0).scale.set(6.6, 8, 6);
    add(sphereG, col, 1, 21, 0).scale.setScalar(5.4);
    for (const s of [-1, 1]) { add(sphereG, col, 0, 25.6, s * 3.8).scale.setScalar(1.9); add(sphereG, eyeW, 5.2, 22, s * 2.2).scale.setScalar(1.3); add(sphereG, eyeB, 6.2, 22, s * 2.2).scale.setScalar(0.7); add(sphereG, col, 1, 12, s * 6.6).scale.setScalar(2.4); }
    add(sphereG, lam(0xffe3ec), 5.6, 19.4, 0).scale.set(2.2, 1.8, 2.4);
    for (const z of [-2.8, 2.8]) leg(0, z, col, 6, 3);
  }
  g.userData = { legs, type };
  return g;
}
export function buildWalkers(def, group, pts) {
  const list = [];
  for (let k = 0; k < 7; k++) {
    let i = Math.floor((k + 0.35) * N / 7 + R(-20, 20)); i = (i + N) % N;
    let tries = 0; while ((S.world.near[i] || i < 40) && tries++ < 60) i = (i + 9) % N;
    const mesh = makeWalker(def.walker); group.add(mesh);
    list.push({ idx: i, lat: R(-96, 96), dir: Math.random() < 0.5 ? -1 : 1, speed: def.walker === 'cow' ? 20 : 26, pause: 0, mesh, x: 0, z: 0, t: R(0, 6), r: def.walker === 'cow' ? 19 : 15 });
  }
  S.world.walkers = list;
}
export function updateWalkers(dt) {
  const pts = S.world.pts;
  for (const w of S.world.walkers) {
    w.t += dt;
    if (w.pause > 0) w.pause -= dt;
    else { w.lat += w.dir * w.speed * dt; if (Math.abs(w.lat) >= 98) { w.lat = Math.sign(w.lat) * 98; w.dir = -Math.sign(w.lat); w.pause = R(0.8, 2.2); } }
    const p = pts[w.idx];
    w.x = p.x + p.nx * w.lat; w.z = p.z + p.nz * w.lat;
    const moving = w.pause <= 0, heading = p.ang + (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    w.mesh.position.set(w.x, moving ? Math.abs(Math.sin(w.t * 7)) * 1.2 : 0, w.z); w.mesh.rotation.y = -heading;
    w.mesh.userData.legs.forEach((l, i) => { l.rotation.z = moving ? Math.sin(w.t * 7 + (i % 2) * Math.PI) * 0.5 : 0; });
    for (const c of S.cars) {
      if (c.fall || c.air) continue;
      const dx = c.x - w.x, dz = c.z - w.z;
      if (dx * dx + dz * dz < (w.r + 8) * (w.r + 8)) { if (hit(c)) { c.s *= 0.3; } }
    }
  }
}

export const snd = (n, a) => sfx.play(n, a);
/* Zustandswechsel des Spielers in Töne übersetzen */
export const aud = { tickT: 0, tickN: 0, item: false, boost: 0, air: false, hop: false, chute: false, fall: false, spin: 0, lap: 0, fin: false, freeze: 0, state: '' };
export function audioTick() {
  const p = S.player; if (!p || S.state === 'menu') { sfx.engine(0, false); return; }
  sfx.engine(clamp(p.s / p.st.max, 0, 1.3), S.state === 'race' || S.state === 'finish', p.boost > 0);
  if (p.roll > 0) { const nw = Date.now(); if (nw - aud.tickT > 70) { aud.tickT = nw; snd('tick', aud.tickN++); } }
  if (p.item && !aud.item) snd('reveal'); aud.item = !!p.item;
  if (p.boost > 0 && !aud.boost) snd('boost'); aud.boost = p.boost > 0 ? 1 : 0;
  if (p.air && !aud.air) snd(p.feather ? 'feather' : p.hop ? 'pad' : 'ramp');
  if (!p.air && aud.air && !p.fall) snd('land'); aud.air = p.air;
  if (p.chute && !aud.chute) snd('chute'); aud.chute = p.chute;
  if (p.fall && !aud.fall) snd('fall'); if (!p.fall && aud.fall) snd('respawn'); aud.fall = p.fall;
  if (p.spin > 0 && !aud.spin) snd('spin'); aud.spin = p.spin > 0 ? 1 : 0;
  if (p.freeze > 0 && !aud.freeze) snd('ice'); aud.freeze = p.freeze > 0 ? 1 : 0;
  if (p.lap > aud.lap && !p.finished) snd('lap'); aud.lap = p.lap;
  if (p.finished && !aud.fin) snd('finish'); aud.fin = p.finished;
}
