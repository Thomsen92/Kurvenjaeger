import * as THREE from 'three';
import { KART_SKINS, CHAR_SKINS } from './data.js';
import { S } from './state.js';
import { TAU, rand } from './util.js';
import { scene, lam, bas, sphereG, eyeW, eyeB } from './core.js';

/* ---------- Karts und Charaktere ---------- */
export const carsGroup = new THREE.Group(); scene.add(carsGroup);

export const supCache = {};
export function sup(w, h, d, n) {
  const key = [w, h, d, n].join('_'); if (supCache[key]) return supCache[key];
  const g = new THREE.SphereGeometry(1, 22, 14), pa = g.attributes && g.attributes.position, arr = pa && pa.array;
  if (arr && arr.length > 2) {
    const e = 2 / n;
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i], y = arr[i + 1], z = arr[i + 2];
      arr[i] = Math.sign(x) * Math.pow(Math.abs(x), e) * w / 2; arr[i + 1] = Math.sign(y) * Math.pow(Math.abs(y), e) * h / 2; arr[i + 2] = Math.sign(z) * Math.pow(Math.abs(z), e) * d / 2;
    }
    g.computeVertexNormals();
  }
  g.userData.keep = true; supCache[key] = g; return g;
}
export const gloss = (c, o) => new THREE.MeshPhongMaterial(Object.assign({ color: c, shininess: 70, specular: 0x666666 }, o || {}));
export const chromeM = gloss(0xe6ecf7, { shininess: 140, specular: 0xffffff }), glassM = gloss(0x8fd0ff, { transparent: true, opacity: 0.55, shininess: 120, specular: 0xffffff });
export const tireM = lam(0x1b1e27), seatM = lam(0x2a2d3a), lightM = bas(0xfff2a8), tailM = bas(0xff3b30);
export const wheelG = {};
export function wheelGeos(R) {
  if (wheelG[R]) return wheelG[R];
  const w = {
    tire: new THREE.TorusGeometry(R - 1.4, 1.4, 8, 18), wall: new THREE.CylinderGeometry(R - 1.4, R - 1.4, 2.6, 16),
    hub: new THREE.CylinderGeometry(R * 0.5, R * 0.5, 3.3, 12), spoke: new THREE.BoxGeometry(R * 1.5, 0.6, 3.6)
  };
  w.wall.rotateX(Math.PI / 2); w.hub.rotateX(Math.PI / 2);
  for (const k in w) w[k].userData.keep = true;
  return (wheelG[R] = w);
}

export function makeKart(def, pk) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const PK = KART_SKINS[def.id][pk || 0], col = PK[1], col2 = PK[2], pat = PK[3];
  const paint = gloss(col), acc = gloss(col2);
  const add = (geo, mat, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0); body.add(m); return m; };
  const sph = (mat, x, y, z, sx, sy, sz) => { const m = add(sphereG, mat, x, y, z); m.scale.set(sx, sy, sz); return m; };
  const cyl = (r, len, mat, x, y, z, rx, ry, rz) => add(new THREE.CylinderGeometry(r, r, len, 8), mat, x, y, z, rx, ry, rz);
  let R = 3.6, wx = 8.5, wz = 7.4, hull;      /* hull = {L,H,W,y} für Muster */
  if (def.id === 'blitz') {
    hull = { L: 28, H: 7, W: 13.4, y: 6.2 };
    add(sup(28, 7, 13.4, 2.6), paint, 0, 6.2, 0);
    add(sup(11, 5, 11, 2.4), paint, 10.5, 5.2, 0);
    add(sup(10, 7, 12.6, 2.4), paint, -10, 6.8, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(sup(9, 4, 3.8, 2.4), paint, sx * 8.5, 6.4, sz * 7.5);
    add(sup(7, 5, 9, 3), seatM, -4, 8.4, 0);
    add(new THREE.BoxGeometry(0.8, 4, 10.5), glassM, 5.2, 11.4, 0, 0, 0, -0.75);
    add(sup(4, 0.9, 15, 3), dark(), 15.5, 2.6, 0);
    add(sup(5.4, 1.1, 16, 3), acc, -13.5, 14.2, 0);
    for (const s of [-1, 1]) { cyl(0.6, 6, dark(), -12.5, 11, s * 5.2); sph(lightM, 14.6, 6.4, s * 3.8, 1.3, 1.3, 1.9); sph(tailM, -14.6, 7, s * 4.6, 0.9, 1.1, 2.2); cyl(1.1, 3, chromeM, -14, 3.8, s * 2.4, 0, 0, Math.PI / 2); }
  } else if (def.id === 'brummi') {
    R = 4.8; wx = 9; wz = 7.8;
    hull = { L: 24, H: 6, W: 13, y: 8.6 };
    add(sup(27, 3, 12, 6), dark(), 0, 4.6, 0);
    add(sup(24, 6, 13, 3.2), paint, 0, 8.6, 0);
    add(sup(10, 4.6, 12.4, 3), paint, 9, 11.2, 0);
    add(sup(9, 5, 12.6, 3.4), paint, -10, 12.4, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(sup(10.4, 2.6, 4.2, 3), acc, sx * 9, 10.2, sz * 7.8);
    add(sup(7, 5, 9, 3), seatM, -4, 9.6, 0);
    add(new THREE.BoxGeometry(0.8, 5.5, 11.4), glassM, 5, 15, 0, 0, 0, -0.25);
    for (const s of [-1, 1]) { cyl(0.6, 10, chromeM, -7, 14, s * 5.8); cyl(0.6, 10, chromeM, 14.6, 9, s * 4.8); sph(lightM, 14, 11.6, s * 4.4, 1.8, 1.8, 1.8); }
    cyl(0.6, 12, chromeM, -7, 18.8, 0, Math.PI / 2, 0, 0);
    cyl(0.7, 12, chromeM, 15.6, 8, 0, Math.PI / 2, 0, 0);
    const sp = add(new THREE.TorusGeometry(3, 1.4, 8, 16), tireM, -15.6, 11, 0, 0, Math.PI / 2, 0); sp.userData.k = 1;
    cyl(1.7, 1.2, acc, -16.4, 11, 0, 0, 0, Math.PI / 2);
  } else {
    R = 3.4; wx = 8; wz = 7;
    hull = { L: 22, H: 10, W: 13, y: 8 };
    add(sup(22, 10, 13, 2), paint, 0, 8, 0);
    add(sup(10, 5.4, 11.4, 2), paint, 8, 7.4, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(sup(7.6, 4.6, 3.8, 2), paint, sx * 8, 6.8, sz * 7.2);
    add(sup(6, 5, 8, 3), seatM, -4, 9, 0);
    add(sup(13, 9, 12, 2), glassM, -3, 14, 0);
    add(sup(5, 5, 8, 2), acc, -11, 8.4, 0);
    add(sup(2.4, 2.2, 12.6, 3), chromeM, 12.8, 4.4, 0);
    cyl(0.3, 7, chromeM, -9, 18, 0); sph(acc, -9, 21.6, 0, 1.4, 1.4, 1.4);
    for (const s of [-1, 1]) { sph(chromeM, 11.4, 8.8, s * 4.2, 2.3, 2.3, 2.3); sph(lightM, 12.6, 8.8, s * 4.2, 1.5, 1.5, 1.5); sph(tailM, -13.4, 7.4, s * 4, 0.9, 1, 1.6); }
  }
  /* Muster */
  const hy = hull.y, hh = hull.H;
  if (pat === 'stripe') for (const s of [-1, 1]) sph(acc, 0, hy, s * 1.6, hull.L * 0.46, hh * 0.54, 1.0);
  else if (pat === 'sides') for (const s of [-1, 1]) sph(acc, 0, hy - hh * 0.05, s * (hull.W / 2 - 0.35), hull.L * 0.38, hh * 0.15, 1.1);
  else for (const dx of [-0.28, 0, 0.28]) sph(acc, hull.L * dx, hy + hh * 0.5, 0, 1.9, 0.5, 1.9);
  /* Räder */
  const wheels = [], front = [], wg = wheelGeos(R);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pv = new THREE.Group(); pv.rotation.order = 'YZX'; pv.position.set(sx * wx, R, sz * wz); body.add(pv);
    pv.add(new THREE.Mesh(wg.tire, tireM), new THREE.Mesh(wg.wall, tireM), new THREE.Mesh(wg.hub, chromeM));
    const sp1 = new THREE.Mesh(wg.spoke, chromeM), sp2 = new THREE.Mesh(wg.spoke, chromeM); sp2.rotation.z = Math.PI / 2; pv.add(sp1, sp2);
    wheels.push(pv); if (sx > 0) front.push(pv);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(3.2, 15, 10), bas(0xffa030, { transparent: true, opacity: 0.9 }));
  flame.rotation.z = Math.PI / 2; flame.position.set(-20, 7, 0); flame.visible = false; body.add(flame);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(15, 16), bas(0x000000, { transparent: true, opacity: 0.3 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.6; blob.scale.set(1.15, 0.9, 1); g.add(blob);
  const shield = new THREE.Mesh(sphereG, bas(0x4fd8ff, { transparent: true, opacity: 0.28 }));
  shield.scale.set(24, 20, 20); shield.position.y = 11; shield.visible = false; g.add(shield);
  const chute = new THREE.Group();
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI / 2), lam(col, { side: THREE.DoubleSide }));
  canopy.scale.set(22, 13, 22); canopy.position.y = 40; chute.add(canopy);
  const band = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 4, 0, TAU, 0.5, 0.35), lam(col2, { side: THREE.DoubleSide }));
  band.scale.set(22.3, 13.3, 22.3); band.position.y = 40; chute.add(band);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const ln = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 30, 4), bas(0xf2f2f2));
    ln.position.set(sx * 8, 24, sz * 8); ln.rotation.z = -sx * 0.24; ln.rotation.x = sz * 0.24; chute.add(ln);
  }
  chute.visible = false; g.add(chute);
  const ice = new THREE.Mesh(new THREE.BoxGeometry(34, 26, 22), bas(0xbfeaff, { transparent: true, opacity: 0.5 }));
  ice.position.y = 13; ice.visible = false; g.add(ice);
  g.userData = { body, wheels, front, flame, blob, shield, chute, ice, driver: null };
  return g;
}
export const darkM = lam(0x1b1e27), dark = () => darkM;

export function makeDriver(ch, k) {
  const SK = CHAR_SKINS[ch.id][k || 0], C1 = SK[1], C2 = SK[2];
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz); g.add(m); return m; };
  const S = sphereG;
  const eye = (x, y, z, r) => { add(S, eyeW, x, y, z, r); add(S, eyeB, x + r * 0.55, y, z, r * 0.55); };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cone = (r, h, n) => new THREE.ConeGeometry(r, h, n || 8);
  add(S, lam(SK[3]), -1.5, -8, 0, 5.6, 4.8, 5.8);
  if (ch.id === 'quaki') {
    const gr = lam(C1);
    add(S, gr, 0, 0, 0, 7.4, 6, 7);
    for (const s of [-1, 1]) { add(S, gr, 1.6, 5.2, s * 3.6, 3); eye(3.4, 6.2, s * 3.6, 2.2); }
    add(box(0.8, 0.9, 8), lam(C2), 6.9, -1.6, 0);
  } else if (ch.id === 'pip') {
    add(S, lam(C1), 0, 0, 0, 6.8, 6.6, 6.6);
    add(S, lam(0xffffff), 2.4, -0.6, 0, 5.2, 5.2, 5.4);
    const beak = add(cone(1.9, 4.2, 6), lam(C2), 7.4, -0.6, 0); beak.rotation.z = -Math.PI / 2;
    eye(4.6, 2, 2.4, 1.5); eye(4.6, 2, -2.4, 1.5);
  } else if (ch.id === 'bolzen') {
    add(box(12, 10, 11.5), lam(C1), 0, 0, 0);
    add(box(0.9, 4.4, 9.6), bas(C2), 6.1, 0.8, 0);
    add(new THREE.CylinderGeometry(0.5, 0.5, 4, 6), lam(0x6b7a99), 0, 7, 0);
    add(S, bas(0xff4b3e), 0, 9.4, 0, 1.6);
    for (const s of [-1, 1]) { const b = add(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 8), lam(0x6b7a99), 0, 0, s * 6.6); b.rotation.x = Math.PI / 2; }
  } else if (ch.id === 'mausi') {
    const o = lam(C1);
    add(S, o, 0, 0, 0, 7, 6, 6.8);
    for (const s of [-1, 1]) { const e = add(cone(2.6, 5.2, 4), o, -1, 6.4, s * 3.8); e.rotation.x = -s * 0.25; }
    add(S, lam(0xffffff), 5.4, -1.8, 0, 2.8, 2.2, 3.6);
    add(S, lam(C2), 7.6, -0.8, 0, 0.9);
    eye(5, 2, 2.6, 1.5); eye(5, 2, -2.6, 1.5);
    for (const s of [-1, 1]) for (const dy of [-0.8, 0.8]) { const w = add(box(5, 0.25, 0.25), lam(0xffffff), 6.2, -1.6 + dy, s * 5.2); w.rotation.y = s * 0.5; }
  } else if (ch.id === 'broesel') {
    add(S, lam(C1), 0, 0, 0, 7.2, 6.6, 7);
    add(S, lam(C2), 6, -1.6, 0, 3.4, 3, 3.8);
    for (const s of [-1, 1]) add(S, lam(C2), -0.5, 1.5, s * 7.4, 2.2, 3.8, 1.3);
    add(box(1.4, 0.6, 2), lam(0xff7aa8), 7.4, -4.6, 0);
    eye(5, 2.8, 2.8, 1.8); eye(5, 2.8, -2.8, 1.8);
  } else {
    add(S, lam(C1), 0, 0, 0, 7.2);
    add(S, eyeW, 5.4, 1.2, 0, 3.8); add(S, eyeB, 8.6, 1.2, 0, 1.9);
    for (const s of [-1, 1]) { const h = add(cone(1.6, 5, 6), lam(C2), 0, 7, s * 3.4); h.rotation.x = -s * 0.35; }
    add(box(0.8, 0.8, 7), lam(0x2b1760), 7, -3, 0);
  }
  g.position.set(-3, 16, 0);
  return g;
}

export function makeCarMesh(kart, ch, sk, pk) {
  const g = makeKart(kart, pk), d = makeDriver(ch, sk);
  g.userData.body.add(d); g.userData.driver = d;
  return g;
}

/* Bananen und Raketen */
export const bananas = [], rockets = [];
export const bananaG = new THREE.TorusGeometry(5, 1.9, 6, 12, 3.6); bananaG.userData.keep = true;
export const bananaM = lam(0xffd23f, { emissive: 0x4a3a00 });
for (let i = 0; i < 14; i++) {
  const m = new THREE.Mesh(bananaG, bananaM); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m);
  bananas.push({ m, life: 0, age: 0, x: 0, z: 0, owner: null });
}
export const rocketG = new THREE.Group();
(() => {
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 14, 8), lam(0xf2f2f2)); body.rotation.z = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.6, 6, 8), lam(0xff4b3e)); nose.rotation.z = -Math.PI / 2; nose.position.x = 10;
  const fl = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 6), bas(0xffa030)); fl.rotation.z = Math.PI / 2; fl.position.x = -11;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 9), lam(0xff4b3e)); fin.position.x = -5;
  rocketG.add(body, nose, fl, fin);
})();
for (let i = 0; i < 8; i++) {
  const m = rocketG.clone(); m.visible = false; scene.add(m);
  const iceM = new THREE.Mesh(sphereG, bas(0xbfeaff)); iceM.scale.setScalar(6); iceM.visible = false; scene.add(iceM);
  rockets.push({ m, iceM, kind: 'rocket', life: 0, i: 0, lat: 0, owner: null, target: null });
}

/* Staubwolken und Funken */
export const puffs = [], puffG = new THREE.SphereGeometry(1, 8, 6); puffG.userData.keep = true;
for (let i = 0; i < 48; i++) {
  const m = new THREE.Mesh(puffG, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, color: 0xcdbb98 }));
  m.visible = false; scene.add(m); puffs.push({ m, life: 0, max: 0.55, rise: 8 });
}
S.puffI = 0;
export function spawnPuff(x, y, z, color, max, rise) {
  const p = puffs[S.puffI++ % puffs.length];
  p.life = p.max = max || 0.55; p.rise = rise === undefined ? 8 : rise; p.m.visible = true; p.m.position.set(x + rand(-3, 3), y, z + rand(-3, 3)); p.m.material.color.setHex(color);
}

/* Sprungpad: Trampolin auf der Strecke */
export function makeJumpPad() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(12, 13.5, 3.4, 24), lam(0x2b3040)); base.position.y = 1.7; g.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(11.2, 1.5, 8, 28), lam(0xe23b30)); ring.rotation.x = Math.PI / 2; ring.position.y = 3.4; g.add(ring);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 1.2, 24), lam(0xffb300, { emissive: 0x6a3a00 })); top.position.y = 3.6; g.add(top);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(4.2, 7, 4), bas(0xffffff)); arrow.position.y = 5; arrow.rotation.y = Math.PI / 4; g.add(arrow);
  g.userData = { top, arrow };
  return g;
}
