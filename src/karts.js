import * as THREE from 'three';
import { KART_SKINS, CHAR_SKINS } from './data.js';
import { S } from './state.js';
import { TAU, rand } from './util.js';
import { scene, lam, bas, sphereG, eyeW, eyeB, canvasTex } from './core.js';

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
  /* Gemeinsamer Kart-Unterbau: Bodenwanne, Seitenrohre und -kästen, Stoßstangen, Sitz mit Lehne, Lenkrad, Motor, Überrollbügel */
  const base = o => {
    const px = o.px || 0;
    add(sup(o.L, 1.8, o.W, 5), dark(), px, o.floor, 0);
    for (const s of [-1, 1]) {
      cyl(0.7, o.L - 4, chromeM, px, o.floor + 1.2, s * (o.W / 2 - 0.2), 0, 0, Math.PI / 2);
      add(sup(o.pod[0], o.pod[1], o.pod[2], 2.6), paint, o.pod[3], o.floor + 2.6, s * (o.W / 2 + 0.2));
    }
    for (const bx of [o.fb, o.rb]) if (bx) {
      cyl(0.8, o.bw, chromeM, bx, o.floor + 1.8, 0, Math.PI / 2, 0, 0);
      for (const s of [-1, 1]) cyl(0.6, 4, chromeM, bx - Math.sign(bx) * 2, o.floor + 1.8, s * (o.bw / 2 - 1), 0, 0, Math.PI / 2);
    }
    add(sup(7.4, 3.4, 9.6, 3), seatM, -3.6, o.floor + 3.6, 0);
    add(sup(2.8, 8, 10.4, 3), paint, -8.6, o.floor + 7, 0, 0, 0, 0.14);
    add(new THREE.TorusGeometry(5.8, 0.45, 6, 14, Math.PI), chromeM, -11.4, o.floor + 3.2, 0, 0, Math.PI / 2, 0);
    cyl(0.5, 5.4, dark(), 7.6, o.floor + 4.8, 0, 0, 0, 0.47);
    const wh = new THREE.Group(); wh.position.set(6.2, o.floor + 8.6, 0); wh.rotation.z = -0.6; body.add(wh);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.6, 6, 14), dark()); ring.rotation.y = -Math.PI / 2; wh.add(ring);
    const hubB = new THREE.Mesh(sphereG, acc); hubB.scale.set(0.9, 0.9, 0.9); wh.add(hubB);
    add(sup(6.4, 5.6, 8.6, 2.4), dark(), o.eng, o.floor + 4.2, 0);
    add(sup(5.8, 3.8, 8, 2.4), paint, o.eng - 0.2, o.floor + 6.8, 0);
    add(sup(2, 4.6, 9.4, 2.6), paint, o.rb + 2.2, o.floor + 3.2, 0);
    for (const s of [-1, 1]) cyl(0.9, 5, chromeM, o.eng - 4.4, o.floor + 3.4, s * 3.2, 0, 0, Math.PI / 2);
  };
  if (def.id === 'blitz') {
    hull = { x: 8, L: 18, H: 4.6, W: 9.6, y: 5.4 };
    base({ L: 30, W: 10.4, floor: 3.4, pod: [9, 3.4, 3.8, 0], fb: 0, rb: -17.6, bw: 12, eng: -13.6 });
    add(sup(18, 4.6, 9.6, 2.6), paint, 8, 5.4, 0);
    add(sup(10, 3.4, 6.4, 2.2), paint, 15, 4.6, 0);
    add(sup(4, 0.9, 16, 3), dark(), 18.4, 2.4, 0);
    for (const s of [-1, 1]) { add(sup(1.2, 3, 0.8, 2.4), acc, 18.4, 3.6, s * 7.8); sph(lightM, 13.4, 6.4, s * 3, 1.3, 1.1, 1.5); }
    add(sup(5.4, 1.1, 16, 3), acc, -15.2, 16, 0);
    for (const s of [-1, 1]) cyl(0.6, 9, dark(), -14.4, 11.6, s * 5.2);
  } else if (def.id === 'brummi') {
    R = 4.8; wx = 9; wz = 7.8;
    hull = { x: 8.5, L: 16, H: 6, W: 12.4, y: 8 };
    base({ L: 31, W: 12.6, floor: 4.8, pod: [10, 4.2, 4.4, 0], fb: 18, rb: -19, bw: 15, eng: -14.4 });
    add(sup(16, 6, 12.4, 3), paint, 8.5, 8, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(sup(10.4, 2.6, 4.2, 3), acc, sx * 9, 11.6, sz * 7.8);
    for (const s of [-1, 1]) { cyl(0.8, 8, chromeM, 18, 8.4, s * 5.6); sph(lightM, 16.6, 10.2, s * 4.4, 1.8, 1.8, 1.8); cyl(0.6, 12, chromeM, -11.8, 14, s * 5.6); }
    cyl(0.8, 11.6, chromeM, -11.8, 20, 0, Math.PI / 2, 0, 0);
    const sp = add(new THREE.TorusGeometry(3, 1.4, 8, 16), tireM, -20.6, 11, 0, 0, Math.PI / 2, 0); sp.userData.k = 1;
    cyl(1.7, 1.2, acc, -21.4, 11, 0, 0, 0, Math.PI / 2);
  } else {
    R = 3.4; wx = 8; wz = 7;
    hull = { x: 7.6, L: 14, H: 6.4, W: 10.4, y: 6.8 };
    base({ L: 26, W: 10.6, floor: 3.2, pod: [8, 3.4, 3.6, 0], fb: 15.4, rb: -14.8, bw: 12, eng: -11.8 });
    add(sup(14, 6.4, 10.4, 2), paint, 7.6, 6.8, 0);
    for (const s of [-1, 1]) { sph(chromeM, 11.6, 8.8, s * 4.2, 2.3, 2.3, 2.3); sph(lightM, 12.8, 8.8, s * 4.2, 1.5, 1.5, 1.5); }
    cyl(0.3, 7, chromeM, -11.4, 16.6, 0); sph(acc, -11.4, 20.4, 0, 1.4, 1.4, 1.4);
  }
  /* Muster */
  const hy = hull.y, hh = hull.H, hx0 = hull.x || 0;
  if (pat === 'stripe') for (const s of [-1, 1]) sph(acc, hx0, hy, s * 1.6, hull.L * 0.46, hh * 0.54, 1.0);
  else if (pat === 'sides') for (const s of [-1, 1]) sph(acc, hx0, hy - hh * 0.05, s * (hull.W / 2 - 0.35), hull.L * 0.38, hh * 0.15, 1.1);
  else for (const dx of [-0.28, 0, 0.28]) sph(acc, hx0 + hull.L * dx, hy + hh * 0.5, 0, 1.9, 0.5, 1.9);
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

/* Rundes Mützen-Abzeichen mit großem Buchstaben, dir 1 = vorn, -1 = hinten (damit man es im Rennen von hinten liest); tilt = Neigung der Mützenwölbung */
const badgeCache = {};
function badge(letter, col, r, x, y, tilt, dir) {
  const key = letter + col;
  const tex = badgeCache[key] || (badgeCache[key] = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill();
    g.fillStyle = '#' + ('000000' + col.toString(16)).slice(-6); g.font = '900 104px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(letter, 64, 70);
  }));
  const grp = new THREE.Group(); grp.position.set(x * dir, y, 0); grp.rotation.z = tilt * dir;
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), bas(0xffffff, { map: tex, transparent: true })); m.rotation.y = dir * Math.PI / 2; grp.add(m);
  return grp;
}

export function makeDriver(ch, k) {
  const SK = CHAR_SKINS[ch.id][k || 0], C1 = SK[1], C2 = SK[2];
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz); g.add(m); return m; };
  const S = sphereG;
  const eye = (x, y, z, r) => { add(S, eyeW, x, y, z, r); add(S, eyeB, x + r * 0.55, y, z, r * 0.55); };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    add(S, lam(SK[3]), -1.5, -8, 0, 5.6, 4.8, 5.8);
  const dome = (a, b) => new THREE.SphereGeometry(1, 18, 10, 0, TAU, 0, a === undefined ? Math.PI / 2 : a);
  const skin = lam(0xf2c6a0), nose = lam(0xe8a07c);
  if (ch.id === 'quaki') {
    /* Frosch mit Hut und L */
    const gr = lam(C1), hat = lam(C2);
    add(S, gr, 0, 0, 0, 7.4, 6, 7);
    for (const s of [-1, 1]) { add(S, gr, 1.2, 4.2, s * 5.8, 3); eye(3.2, 5.2, s * 5.8, 2.2); }
    add(box(0.8, 0.9, 8), lam(0x14301b), 6.9, -1.6, 0);
    add(dome(), hat, 0, 5.8, 0, 5.4, 4.6, 5.6);
    add(S, hat, 4.8, 6.2, 0, 3.8, 0.6, 5.2);
    for (const d of [1, -1]) g.add(badge('L', C2, 3.4, 5.0, 8.1, 0.6, d));
  } else if (ch.id === 'tom') {
    /* Tom: humanoide Tomate mit Mütze, grünem Stiel und T */
    const red = lam(C1), cap = lam(C2), leaf = lam(0x3aa655);
    add(S, red, 0, 0, 0, 7.2, 6.8, 7.2);
    for (const s of [-1, 1]) eye(5.8, 1.2, s * 2.7, 1.7);
    add(S, lam(0x7a1620), 6.6, -2.6, 0, 0.8, 0.6, 2.2);
    add(dome(), cap, 0, 3.4, 0, 6.8, 4.4, 6.9);
    add(S, cap, 6.6, 3.6, 0, 4, 0.55, 5.2);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; add(S, leaf, Math.cos(a) * 2.1, 7.7, Math.sin(a) * 2.1, 2.4, 0.5, 1.2).rotation.y = -a; }
    add(new THREE.CylinderGeometry(0.9, 1.1, 4.2, 8), lam(0x2f8f3a), 0, 9.8, 0);
    for (const d of [1, -1]) g.add(badge('T', C2, 3.3, 6.2, 5.6, 0.7, d));
  } else if (ch.id === 'anna') {
    /* Anna: blond, langer Pferdeschwanz */
    const hair = lam(C1);
    add(S, skin, 0, 0, 0, 6.5, 6.4, 6.3);
    add(S, hair, -1.4, 1.1, 0, 7.2, 7, 7.3);
    add(S, hair, 2.8, 5.2, 0, 4.4, 2.4, 6.8);
    add(S, lam(C2), -7, 2.4, 0, 1.2);
    add(S, hair, -9.6, 0.6, 0, 3.6, 2.4, 2.4);
    add(S, hair, -12.6, -1.8, 0, 3.4, 2.2, 2.1);
    add(S, hair, -15.2, -4.4, 0, 2.6, 1.9, 1.8);
    for (const s of [-1, 1]) { eye(5.6, 1, s * 2.5, 1.5); add(S, lam(0xff9fb4), 5.4, -1.8, s * 4.2, 1.1, 0.8, 0.8); }
    add(S, nose, 6.4, -0.8, 0, 0.9);
    add(box(0.8, 0.5, 3.2), lam(0xd0485a), 6, -3, 0);
  } else if (ch.id === 'flavio') {
    /* Flavio: Schnauzer und Schirmmütze */
    const cap = lam(C1);
    add(S, skin, 0, 0, 0, 6.7, 6.4, 6.4);
    add(dome(), cap, 0, 2.2, 0, 7.2, 5.4, 7.2);
    add(S, cap, 6.8, 2.5, 0, 4.4, 0.6, 5.4);
    for (const d of [1, -1]) g.add(badge('F', C1, 3.3, 6.5, 5.2, 0.68, d));
    add(S, nose, 7.2, -0.7, 0, 1.9);
    for (const s of [-1, 1]) { eye(5.8, 1.7, s * 2.4, 1.5); const m = add(S, lam(C2), 6.6, -2.6, s * 2.1, 1.6, 1.1, 2.6); m.rotation.x = -s * 0.25; }
    add(S, lam(C2), 6.9, -2, 0, 1.2, 1, 1.2);
  } else if (ch.id === 'janos') {
    /* Janos: Tigerente mit Mütze und J */
    const yel = lam(C1), blk = lam(0x1d1d1d), cap = lam(C2);
    add(S, yel, 0, 0, 0, 6.9, 6.4, 6.6);
    for (const d of [-4.2, -1.6, 1.0]) { const q = Math.sqrt(1 - (d / 6.9) * (d / 6.9)); add(S, blk, d, 0, 0, 0.45, 6.4 * q + 0.25, 6.6 * q + 0.25); }
    for (const s of [-1, 1]) eye(5.4, 1.2, s * 2.7, 1.9);
    add(S, lam(0xff8a1f), 8.2, -1.6, 0, 3.8, 1.3, 3.4);
    add(S, lam(0xe0701a), 7.4, -2.9, 0, 3, 0.8, 2.6);
    add(dome(), cap, 0, 2.8, 0, 7.2, 5.2, 7.2);
    add(S, cap, 7, 2.9, 0, 4.4, 0.6, 5.4);
    for (const d of [1, -1]) g.add(badge('J', C2, 3.3, 6.5, 5.5, 0.68, d));
    add(S, yel, -7, 0.4, 0, 2.2, 1.6, 2.6);
  } else {
    add(S, lam(C1), 0, 0, 0, 7.2);
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
