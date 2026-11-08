import * as THREE from 'three';
import { GAPLEN, EDGE, ROAD_HALF, CURB, RAMP_H } from './data.js';
import { S } from './state.js';
import { N, TAU, angDiff, rand } from './util.js';
import { scene, canvasTex, sun, makeTopTex, makeRoadTex, bas, checkTex, lam, bannerTex, boxTex, sphereG, padTex } from './core.js';
import { makeJumpPad } from './karts.js';
import { buildPuddles, buildWalkers, buildTheme } from './deco.js';

/* Band entlang der Strecke. hA/hB dürfen Zahlen oder Funktionen des Stützpunkts sein. */
export function ribbon(pts, segs, latA, latB, hA, hB, tile, c1, c2, seg) {
  const pos = [], uv = [], col = [], idx = [];
  const cc1 = c1 && new THREE.Color(c1), cc2 = c2 && new THREE.Color(c2);
  const fa = typeof hA === 'function' ? hA : () => hA, fb = typeof hB === 'function' ? hB : () => hB;
  for (const i of segs) {
    const j = (i + 1) % N, a = pts[i], b = pts[j];
    const v0 = i * S.world_ds / tile, v1 = (i + 1) * S.world_ds / tile;
    const base = pos.length / 3;
    pos.push(a.x + a.nx * latA, fa(i), a.z + a.nz * latA, a.x + a.nx * latB, fb(i), a.z + a.nz * latB,
      b.x + b.nx * latA, fa(i + 1), b.z + b.nz * latA, b.x + b.nx * latB, fb(i + 1), b.z + b.nz * latB);
    uv.push(0, v0, 1, v0, 0, v1, 1, v1);
    if (cc1) { const c = (Math.floor(i / seg) % 2) ? cc1 : cc2; for (let k = 0; k < 4; k++) col.push(c.r, c.g, c.b); }
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (cc1) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
S.world_ds = 5;

export function disposeGroup(g) { g.traverse(o => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); }); }

export function pickGaps(turn, count, len) {
  const res = [];
  for (let k = 0; k < count; k++) {
    let from = Math.floor(N * (0.14 + 0.84 * k / count)); const to = Math.floor(N * (0.14 + 0.84 * (k + 1) / count) - 40);
    if (k > 0) from = Math.max(from, res[k - 1].i + len + 170);
    if (from >= to) from = to - 2;
    let bi = from, bc = 9;
    for (let i = from; i < to; i += 2) {
      let c = 0;
      for (let q = -26; q <= len + 30; q += 3) c = Math.max(c, turn[(i + q + N) % N]);
      if (c < bc) { bc = c; bi = i; }
    }
    res.push({ i: bi, len });
  }
  return res;
}

export function buildWorld(def) {
  if (S.world) { scene.remove(S.world.group); disposeGroup(S.world.group); }
  const group = new THREE.Group();
  const M = 64, ctrl = [];
  for (let i = 0; i < M; i++) { const t = i / M * TAU, r = def.R * def.f(t); ctrl.push(new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r)); }
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
  const sp = curve.getSpacedPoints(N);
  const pts = [];
  for (let i = 0; i < N; i++) pts.push({ x: sp[i].x, z: sp[i].z });
  for (let i = 0; i < N; i++) {
    const a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N], p = pts[i];
    let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    p.tx = tx; p.tz = tz; p.nx = -tz; p.nz = tx; p.ang = Math.atan2(tz, tx);
  }
  const turn = pts.map((p, i) => Math.abs(angDiff(pts[(i + 20) % N].ang, p.ang)));
  let length = 0;
  for (let i = 0; i < N; i++) length += Math.hypot(pts[(i + 1) % N].x - pts[i].x, pts[(i + 1) % N].z - pts[i].z);
  S.world_ds = length / N;

  // Abgründe und Rampen
  const gaps = pickGaps(turn, def.gaps, GAPLEN);
  const gap = new Uint8Array(N), launch = new Uint8Array(N), near = new Uint8Array(N), rampH = new Float32Array(N + 2);
  for (const g of gaps) {
    for (let k = 1; k < g.len; k++) gap[(g.i + k) % N] = 1;
    for (let k = -1; k <= 1; k++) launch[(g.i + k + N) % N] = 1;
    for (let k = -44; k <= g.len + 6; k++) near[(g.i + k + N) % N] = 1;
    for (let k = -6; k <= 0; k++) rampH[(g.i + k + N) % N] = RAMP_H * (k + 6) / 6;
  }
  const solidSeg = [];
  for (let i = 0; i < N; i++) { let ok = true; for (const g of gaps) { const d = (i - g.i + N) % N; if (d < g.len) ok = false; } if (ok) solidSeg.push(i); }
  const rampSegs = [];
  for (const g of gaps) for (let k = -6; k < 0; k++) rampSegs.push((g.i + k + N) % N);
  const rampFn = off => i => rampH[i % N] + off;

  // Himmel
  scene.background = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, def.sky[0]); gr.addColorStop(0.75, def.sky[1]); gr.addColorStop(1, def.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const fogHex = new THREE.Color(def.sky[1]).getHex();
  scene.fog = new THREE.Fog(fogHex, 1000, 5200);
  S.renderer.setClearColor(fogHex);
  sun.color.setHex(def.sun);

  // Insel: Oberseite, Klippen, Unterseite
  const topMat = new THREE.MeshLambertMaterial({ map: makeTopTex(def.top, def.sprinkles) });
  group.add(new THREE.Mesh(ribbon(pts, solidSeg, -EDGE, EDGE, -0.2, -0.2, 128), topMat));
  const cliffMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(ribbon(pts, solidSeg, EDGE, EDGE - 30, -0.2, -80, 128, def.cliff[0], def.cliff[1], 4), cliffMat));
  group.add(new THREE.Mesh(ribbon(pts, solidSeg, -EDGE, -EDGE + 30, -0.2, -80, 128, def.cliff[0], def.cliff[1], 4), cliffMat));
  group.add(new THREE.Mesh(ribbon(pts, solidSeg, -EDGE + 30, EDGE - 30, -80, -80, 128, def.cliff[0], def.cliff[1], 4), cliffMat));
  // Straße und Randsteine
  group.add(new THREE.Mesh(ribbon(pts, solidSeg, -ROAD_HALF, ROAD_HALF, 0.3, 0.3, 120), new THREE.MeshLambertMaterial({ map: makeRoadTex(def) })));
  const curbMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  group.add(new THREE.Mesh(ribbon(pts, solidSeg, -ROAD_HALF - CURB, -ROAD_HALF, 0.35, 0.35, 60, def.curb[0], def.curb[1], 3), curbMat));
  group.add(new THREE.Mesh(ribbon(pts, solidSeg, ROAD_HALF, ROAD_HALF + CURB, 0.35, 0.35, 60, def.curb[0], def.curb[1], 3), curbMat));
  // Rampen
  const rampMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(ribbon(pts, rampSegs, -ROAD_HALF, ROAD_HALF, rampFn(0.5), rampFn(0.5), 60, 0xffd23f, 0x2b2f3a, 1), rampMat));
  group.add(new THREE.Mesh(ribbon(pts, rampSegs, -ROAD_HALF, -ROAD_HALF, 0, rampFn(0.5), 60, 0xffd23f, 0x2b2f3a, 1), rampMat));
  group.add(new THREE.Mesh(ribbon(pts, rampSegs, ROAD_HALF, ROAD_HALF, 0, rampFn(0.5), 60, 0xffd23f, 0x2b2f3a, 1), rampMat));
  for (const g of gaps) {
    const p = pts[g.i % N], grp = new THREE.Group(); grp.position.set(p.x, 0, p.z); grp.rotation.y = -p.ang;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, RAMP_H + 1), lam(0xe8791f, { side: THREE.DoubleSide }));
    face.rotation.y = Math.PI / 2; face.position.set(0, (RAMP_H + 1) / 2, 0); grp.add(face);
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(3, 24, 3), lam(0x2b3040)); post.position.set(-4, 12, s * (ROAD_HALF + 5)); grp.add(post); const ball = new THREE.Mesh(sphereG, bas(0xff4b3e)); ball.scale.setScalar(4); ball.position.set(-4, 26, s * (ROAD_HALF + 5)); grp.add(ball); }
    group.add(grp);
  }

  // Start und Ziel
  const p0 = pts[0];
  const lineG = new THREE.Group(); lineG.position.set(p0.x, 0.45, p0.z); lineG.rotation.y = -(p0.ang + Math.PI / 2);
  const linePlane = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 8), bas(0xffffff, { map: checkTex }));
  linePlane.rotation.x = -Math.PI / 2; lineG.add(linePlane); group.add(lineG);
  const gantry = new THREE.Group(); gantry.position.set(p0.x, 0, p0.z); gantry.rotation.y = -p0.ang;
  const postM = lam(0x2b3040), W = ROAD_HALF + 12;
  for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(4, 54, 4), postM); post.position.set(0, 27, s * W); gantry.add(post); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(5, 16, W * 2), postM); beam.position.set(0, 46, 0); gantry.add(beam);
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 - 4, 14), bas(0xffffff, { map: bannerTex }));
  ban.rotation.y = -Math.PI / 2; ban.position.set(-2.8, 46, 0); gantry.add(ban);
  group.add(gantry);

  // Boost-Felder
  const pads = [];
  const addPad = idx => {
    idx = (idx + N) % N; const p = pts[idx];
    const pg = new THREE.Group(); pg.position.set(p.x, 0.5, p.z); pg.rotation.y = -p.ang;
    for (const zz of [-16, 16]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(34, 30), bas(0xffffff, { map: padTex }));
    m.rotation.x = -Math.PI / 2; m.position.z = zz; pg.add(m); } group.add(pg); pads.push({ idx });
  };
  const pc = Math.round(N / 145);
  for (let k = 0; k < pc; k++) { const idx = Math.floor(k * N / pc + N / (2 * pc)); if (!near[idx]) addPad(idx); }
  for (const g of gaps) addPad(g.i - 16);

  // Item-Würfel
  const boxes = [], boxG = new THREE.BoxGeometry(11, 11, 11); boxG.userData.keep = true;
  const boxMat = bas(0xffffff, { map: boxTex });
  const bc = Math.round(N / 116);
  for (let k = 0; k < bc; k++) {
    let idx = Math.floor((k + 0.5) * N / bc);
    while (near[idx % N] || idx < 30) idx += 12;
    idx %= N; const p = pts[idx];
    for (const lat of [-44, -22, 0, 22, 44]) {
      const bx = p.x + p.nx * lat, bz = p.z + p.nz * lat;
      const m = new THREE.Mesh(boxG, boxMat); m.position.set(bx, 11, bz); group.add(m);
      boxes.push({ x: bx, z: bz, mesh: m, t: 0 });
    }
  }
  // Sprungpads
  const jumps = [], jc = Math.round(N / 110);
  for (let k = 0; k < jc; k++) {
    let idx = Math.floor((k + 0.5) * N / jc + rand(-12, 12)); idx = (idx + N) % N;
    if (near[idx] || idx < 40 || idx > N - 20) continue;
    const p = pts[idx], lat = [-44, 44, 0, 22, -22][k % 5], jx = p.x + p.nx * lat, jz = p.z + p.nz * lat;
    const jg = makeJumpPad(); jg.scale.setScalar(1.5); jg.position.set(jx, 0.4, jz); jg.rotation.y = -p.ang; group.add(jg);
    jumps.push({ x: jx, z: jz, mesh: jg, anim: 0 });
  }
  S.world = { def, group, pts, turn, gaps, gap, launch, near, rampH, pads, boxes, jumps, length };
  buildScenery(def, group, pts);
  buildPuddles(def, group, pts);
  buildWalkers(def, group, pts);
  scene.add(group);
  buildMini(def, pts);
}

export function buildScenery(def, group, pts) {
  const tmp = new THREE.Object3D(), color = new THREE.Color();
  const keep = g => { g.userData.keep = true; return g; };
  buildTheme(def, group, pts);
  // Wolkenmeer unter der Insel
  const cloudG = keep(new THREE.SphereGeometry(1, 10, 6));
  const clouds = new THREE.InstancedMesh(cloudG, bas(0xffffff, { transparent: true, opacity: 0.93 }), 150);
  for (let i = 0; i < 150; i++) {
    const a = rand(0, TAU), r = Math.sqrt(Math.random()) * def.R * 3.8;
    tmp.position.set(Math.cos(a) * r, rand(-240, -120), Math.sin(a) * r); tmp.scale.set(rand(80, 210), rand(18, 36), rand(80, 210)); tmp.rotation.set(0, 0, 0); tmp.updateMatrix();
    clouds.setMatrixAt(i, tmp.matrix);
  }
  group.add(clouds);
  const sea = new THREE.Mesh(keep(new THREE.PlaneGeometry(40000, 40000)), bas(new THREE.Color(def.sky[1]).getHex(), { transparent: true, opacity: 0.7 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -300; group.add(sea);
  // ferne schwebende Inseln
  const fi = 18;
  const topG = keep(new THREE.CylinderGeometry(1, 1, 0.16, 10)), botG = keep(new THREE.ConeGeometry(1, 1, 10));
  const tops = new THREE.InstancedMesh(topG, lam(0xffffff), fi), bots = new THREE.InstancedMesh(botG, lam(def.cliff[0]), fi);
  for (let i = 0; i < fi; i++) {
    const a = i / fi * TAU + rand(-0.12, 0.12), r = def.R * rand(2.3, 3.5), s = rand(70, 190), y = rand(-60, 160);
    tmp.rotation.set(0, 0, 0);
    tmp.position.set(Math.cos(a) * r, y, Math.sin(a) * r); tmp.scale.set(s, s, s); tmp.updateMatrix(); tops.setMatrixAt(i, tmp.matrix);
    color.set(def.top); color.offsetHSL(rand(-0.03, 0.03), 0, rand(-0.05, 0.05)); tops.setColorAt(i, color);
    tmp.rotation.set(Math.PI, 0, 0); tmp.position.set(Math.cos(a) * r, y - s * 0.55, Math.sin(a) * r); tmp.scale.set(s, s * 1.1, s); tmp.updateMatrix(); bots.setMatrixAt(i, tmp.matrix);
  }
  group.add(tops, bots);
}

S.mini = null;
export function buildMini(def, pts) {
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (const p of pts) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); minz = Math.min(minz, p.z); maxz = Math.max(maxz, p.z); }
  const MM = 112, sc = (MM - 12) / Math.max(maxx - minx, maxz - minz);
  const ox = (MM - (maxx - minx) * sc) / 2, oy = (MM - (maxz - minz) * sc) / 2;
  const img = document.createElement('canvas'); img.width = img.height = MM * 2;
  const mg = img.getContext('2d'); mg.scale(2, 2);
  mg.fillStyle = 'rgba(14,17,24,.62)'; mg.beginPath(); mg.roundRect ? mg.roundRect(0, 0, MM, MM, 14) : mg.rect(0, 0, MM, MM); mg.fill();
  mg.strokeStyle = 'rgba(255,255,255,.82)'; mg.lineWidth = 4; mg.lineJoin = 'round'; mg.beginPath();
  pts.forEach((p, i) => { const x = ox + (p.x - minx) * sc, y = oy + (p.z - minz) * sc; i ? mg.lineTo(x, y) : mg.moveTo(x, y); });
  mg.closePath(); mg.stroke();
  mg.fillStyle = '#ff4b3e';
  for (const g of S.world.gaps) { const p = pts[(g.i + 7) % N]; mg.beginPath(); mg.arc(ox + (p.x - minx) * sc, oy + (p.z - minz) * sc, 3.2, 0, TAU); mg.fill(); }
  S.mini = { img, MM, sc, ox, oy, minx, minz };
}
