import * as THREE from 'three';
import { S } from './state.js';
import { $ } from './util.js';
import { makeDriver } from './karts.js';
import { CHAR_SKINS } from './data.js';
import { sfx } from './audio.js';

/* ---------- Siegerehrung: eigene 3D-Szene mit Podium, Figuren, Publikum, Konfetti und Feuerwerk ----------
   Die Szene ist vollständig von der Rennwelt getrennt und wird nur im Zustand 'over' gezeichnet. */
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(38, 1.5, 2, 3000);
const group = { figs: new THREE.Group(), crowd: new THREE.Group(), fx: new THREE.Group() };
scene.add(group.figs, group.crowd, group.fx);
const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), ease = t => 1 - Math.pow(1 - t, 3);
const back = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

let built = false, active = false, T = 0, figs = [], crowd = [], rows = [], panelShown = false, winnerT = 99, onPanel = null;
let confettiOn = false, fwNext = 0, cheerNext = 0, lights = [];

/* ----- Grundaufbau (einmalig) ----- */
const mat = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
const glow = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
function numTex(n, col) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = col; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, 0, 128, 8); g.fillRect(0, 120, 128, 8);
  g.font = '900 92px "Russo One","Arial Black",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillText(String(n), 67, 70); g.fillStyle = '#fff'; g.fillText(String(n), 64, 66);
  const t = new THREE.CanvasTexture(c); return t;
}
const STEP = [{ h: 28, x: 0, col: '#e0a800', top: 0xffc928 }, { h: 19, x: -40, col: '#8d98a8', top: 0xcfd7e3 }, { h: 12, x: 40, col: '#a8642a', top: 0xd98a45 }];
const sky = () => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#060a24'); gr.addColorStop(0.55, '#1c1a52'); gr.addColorStop(1, '#5a2f78');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return new THREE.CanvasTexture(c);
};
const dotTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();

function arcBlock(r0, r1, a0, a1, h) {
  const s = new THREE.Shape(); s.absarc(0, 0, r1, a0, a1, false); s.absarc(0, 0, r0, a1, a0, true); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 40 }); g.rotateX(-Math.PI / 2); return g;
}

let fw = null, cf = null;
const FW_N = 1100, CF_N = 420;
const fwP = { pos: new Float32Array(FW_N * 3), col: new Float32Array(FW_N * 3), vel: new Float32Array(FW_N * 3), life: new Float32Array(FW_N), max: new Float32Array(FW_N), base: new Float32Array(FW_N * 3), i: 0 };
const cfP = { pos: new Float32Array(CF_N * 3), col: new Float32Array(CF_N * 3), vel: new Float32Array(CF_N * 3), ph: new Float32Array(CF_N), live: new Uint8Array(CF_N) };

function build() {
  if (built) return; built = true;
  scene.background = sky();
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x3a2a55, 0.95));
  const sunL = new THREE.DirectionalLight(0xfff0d8, 0.85); sunL.position.set(60, 160, 160); scene.add(sunL);
  for (const [c, x] of [[0xff4bd8, -120], [0x4fd8ff, 120]]) { const l = new THREE.PointLight(c, 0.9, 420); l.position.set(x, 90, 40); scene.add(l); lights.push(l); }

  /* Bühnenboden mit Schachbrett und Teppich */
  const ck = document.createElement('canvas'); ck.width = ck.height = 64; const g = ck.getContext('2d');
  g.fillStyle = '#26305e'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#323f78'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  const ct = new THREE.CanvasTexture(ck); ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(24, 24);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(520, 48), mat(0xffffff, { map: ct })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(150, 1.6, 64), mat(0xb01e2f)); carpet.position.set(0, 0.8, 2); scene.add(carpet);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(154, 1.2, 68), mat(0xffc928)); trim.position.set(0, 0.5, 2); scene.add(trim);

  /* Podium (3 Stufen) mit Nummernschildern */
  STEP.forEach((st, i) => {
    const front = new THREE.MeshLambertMaterial({ map: numTex(i + 1, st.col) }), side = mat(parseInt(st.col.slice(1), 16)), top = mat(st.top);
    const m = new THREE.Mesh(new THREE.BoxGeometry(34, st.h, 30), [side, side, top, side, front, side]); m.position.set(st.x, 1.6 + st.h / 2, 0); scene.add(m);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(22, 120, 24, 1, true), glow(i === 0 ? 0xfff2b0 : 0xbfd4ff, { transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.set(st.x, 1.6 + st.h + 58, 0); cone.userData.sp = i; scene.add(cone); lights.push(cone);
  });
  /* Rückwand mit Lichterkette */
  const bulbs = new THREE.Group(); scene.add(bulbs);
  for (let i = 0; i < 28; i++) { const a = -0.9 + i / 27 * 1.8, b = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), glow([0xffd23f, 0xff4b3e, 0x4fd8ff, 0x6fdc8c][i % 4])); b.position.set(Math.sin(a) * 105, 60 + Math.cos(a * 2) * 10 + 32, -52); b.userData.ph = i; bulbs.add(b); lights.push(b); }

  /* Tribünen (Bögen hinter der Bühne) */
  const span = 2.5, a0 = Math.PI / 2 - span / 2, a1 = Math.PI / 2 + span / 2, TR = [[110, 135, 8], [135, 160, 18], [160, 185, 30], [185, 210, 42]];
  const tierCols = [0x39406e, 0x323863, 0x2b3157, 0x252a4b];
  TR.forEach((t, k) => { const m = new THREE.Mesh(arcBlock(t[0], t[1], a0, a1, t[2]), mat(tierCols[k])); scene.add(m); });
  const shirt = [0xff4b3e, 0xffd23f, 0x4fd8ff, 0x6fdc8c, 0xff5ab8, 0xffffff, 0x8a5cff, 0xff8a2b], skinT = [0xf2c6a0, 0xd9a47c, 0x9a6a48, 0xffdcc0, 0x6b4630];
  const sphG = new THREE.SphereGeometry(1, 10, 8), armG = new THREE.CylinderGeometry(0.6, 0.6, 4.2, 6); armG.translate(0, 2.1, 0);
  const shM = shirt.map(c => mat(c)), skM = skinT.map(c => mat(c)), hairM = [mat(0x2a1c14), mat(0xe8c15a), mat(0x7a3a1c), mat(0x1a1a1a), mat(0xd04a2a)];
  TR.forEach((t, k) => {
    const rm = t[1] - 12, n = Math.floor(rm * span / 11);
    for (let i = 0; i < n; i++) {
      const a = a0 + 0.04 + (i + Math.random() * 0.5) / n * (span - 0.08), x = Math.cos(a) * rm, z = -Math.sin(a) * rm;
      const p = new THREE.Group(); p.position.set(x, t[2], z);
      const body = new THREE.Mesh(sphG, shM[(Math.random() * shM.length) | 0]); body.scale.set(3, 3.8, 2.4); body.position.y = 3.6; p.add(body);
      const head = new THREE.Mesh(sphG, skM[(Math.random() * skM.length) | 0]); head.scale.setScalar(2.4); head.position.y = 9; p.add(head);
      const hair = new THREE.Mesh(sphG, hairM[(Math.random() * hairM.length) | 0]); hair.scale.set(2.5, 1.5, 2.5); hair.position.set(0, 10.2, -0.5); p.add(hair);
      const arms = [-1, 1].map(s => { const a = new THREE.Mesh(armG, shM[(Math.random() * shM.length) | 0]); a.position.set(s * 3.3, 5.6, 0); p.add(a); return a; });
      p.lookAt(0, t[2], 0);
      group.crowd.add(p);
      crowd.push({ p, arms, y0: t[2], ph: Math.random() * TAU, sp: rnd(5, 9), amp: rnd(0.6, 1), head });
    }
  });

  /* Sterne und Partikel */
  const sg = new THREE.BufferGeometry(), sp = new Float32Array(260 * 3);
  for (let i = 0; i < 260; i++) { const a = rnd(0, TAU), e = rnd(0.25, 1.3), r = 1500; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = -Math.abs(Math.sin(a)) * Math.cos(e) * r - 100; }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 4, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false })));

  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fwP.pos, 3)); fg.setAttribute('color', new THREE.BufferAttribute(fwP.col, 3));
  fw = new THREE.Points(fg, new THREE.PointsMaterial({ size: 9, map: dotTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); fw.frustumCulled = false; group.fx.add(fw);
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cfP.pos, 3)); cg.setAttribute('color', new THREE.BufferAttribute(cfP.col, 3));
  cf = new THREE.Points(cg, new THREE.PointsMaterial({ size: 5.5, vertexColors: true, sizeAttenuation: true })); cf.frustumCulled = false; group.fx.add(cf);
  for (let i = 0; i < FW_N; i++) fwP.pos[i * 3 + 1] = -999;
  for (let i = 0; i < CF_N; i++) cfP.pos[i * 3 + 1] = -999;
}

/* ----- Figuren ----- */
const gold = new THREE.MeshPhongMaterial({ color: 0xffc928, shininess: 90, specular: 0xffffff, emissive: 0x4a3000 });
function trophy() {
  const g = new THREE.Group();
  const pts = [[0, 0], [2.6, 0], [2.6, 0.8], [1.2, 1.3], [0.7, 2], [0.7, 3.6], [2, 4.4], [3.6, 7.6], [3.2, 8.4], [2.4, 8.4], [2.2, 7.6], [0, 7.2]].map(p => new THREE.Vector2(p[0], p[1]));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 18), gold));
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.32, 6, 14), gold); h.position.set(s * 3.4, 6, 0); g.add(h); }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), glow(0xfff2b0)); star.position.set(0, 5.4, 2.9); star.scale.set(1, 1, 0.3); g.add(star);
  return g;
}
function strap(a, b, m) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length(), s = new THREE.Mesh(new THREE.BoxGeometry(0.9, len, 0.25), m);
  s.position.copy(a).addScaledVector(d, 0.5); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return s;
}
function medal(col) {
  const g = new THREE.Group(), m = new THREE.MeshPhongMaterial({ color: col, shininess: 80, specular: 0xffffff, emissive: 0x201000 });
  const d = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.6, 20), m); d.rotation.z = Math.PI / 2; d.position.set(4.4, -5.4, 0); g.add(d);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.7, 5), mat(0x000000, { transparent: true, opacity: 0.2 })); inner.rotation.z = Math.PI / 2; inner.position.set(4.5, -5.4, 0); g.add(inner);
  const rib = mat(0xd62828);
  for (const s of [-1, 1]) g.add(strap(new THREE.Vector3(3.2, -0.6, s * 2.6), new THREE.Vector3(4.3, -4.4, s * 0.5), rib));
  return g;
}
const tagCache = {};
function tag(text, col) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,12,22,.72)'; const r = 16; g.beginPath(); g.moveTo(r, 4); g.lineTo(256 - r, 4); g.quadraticCurveTo(252, 4, 252, r); g.lineTo(252, 60 - r); g.quadraticCurveTo(252, 60, 256 - r, 60); g.lineTo(r, 60); g.quadraticCurveTo(4, 60, 4, 60 - r); g.lineTo(4, r); g.quadraticCurveTo(4, 4, r, 4); g.fill();
  g.strokeStyle = col; g.lineWidth = 3; g.stroke();
  g.font = '700 30px "Barlow Semi Condensed",Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(text.slice(0, 14), 128, 34);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); sp.scale.set(30, 7.5, 1); return sp;
}
function makeFig(r, place, x, z, sc, tr) {
  const root = new THREE.Group(), bodyG = new THREE.Group(), face = new THREE.Group(), hip = new THREE.Group();
  root.add(bodyG); bodyG.add(face); face.rotation.y = -Math.PI / 2; face.add(hip); hip.position.y = 15.5;
  const drv = makeDriver(r.ch, r.sk | 0); drv.position.set(0, 0, 0); hip.add(drv);
  const torso = CHAR_SKINS[r.ch.id][r.sk | 0][3];
  const sleeve = mat(torso), glove = mat(0xffffff), boot = mat(0x20232e);
  const arm = side => {
    const p = new THREE.Group(); p.position.set(-1.5, -5.6, side * 5.8); p.rotation.order = 'ZXY';
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.2, 6, 8), sleeve); m.position.y = -3; p.add(m);
    const h = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8), glove); h.position.y = -6.6; p.add(h);
    hip.add(p); return p;
  };
  const armR = arm(1), armL = arm(-1);
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), boot); b.scale.set(3.4, 2.2, 2.6); b.position.set(-0.6, -14, s * 3.2); hip.add(b); }
  const f = { root, bodyG, hip, drv, armR, armL, ch: r.ch, place, tr, sc, x, z, res: r, trophy: null, tag: null };
  if (place === 1) { const t = trophy(); t.position.y = -7.2; t.rotation.x = Math.PI; t.scale.setScalar(1.15); armR.add(t); f.trophy = t; }
  if (place <= 3) hip.add(medal([0xffc928, 0xcfd7e3, 0xcd7f32][place - 1]));
  const nm = tag((place <= 3 ? place + '. ' : '') + r.label, ['#ffc928', '#cfd7e3', '#e09a5a', '#4a5578'][Math.min(place, 4) - 1]);
  nm.position.set(0, 25, 0); root.add(nm); f.tag = nm;
  root.position.set(x, 0, z); root.scale.setScalar(0); root.visible = false;
  return f;
}

/* ----- Posen und Animationen je Charakter ----- */
const raise = (a, side, up, fwd) => { a.rotation.x = -side * up; a.rotation.z = fwd || 0; };
function animate(f, T, dt) {
  const t = T - f.tr, root = f.root;
  if (t < 0) { root.visible = false; return; }
  root.visible = true;
  const pop = Math.min(1, t / 0.7), s = f.sc * Math.max(0.001, back(pop));
  root.scale.setScalar(s);
  const id = f.ch.id, p = f.place, b = f.bodyG, h = f.hip;
  let jump = 0, spin = 0, roll = 0, sy = 1, tilt = 0, nod = 0, shake = 0, aR = [0.1, 0], aL = [0.1, 0];
  const ph = t + f.x * 0.05;
  if (p === 1) {
    const done = Math.min(1, Math.max(0, (t - 0.5) / 0.4)); // erst nach dem Auftritt voll feiern
    if (id === 'tom') {                                       // hüpft und reckt den Pokal
      const k = Math.abs(Math.sin(ph * 5.2)); jump = k * 8 * done; sy = 1 - 0.14 * (1 - k) * done; aR = [3.0 + Math.sin(ph * 10.4) * 0.12, 0.1]; aL = [2.4 + Math.sin(ph * 10.4 + 1.7) * 0.5, 0]; nod = Math.sin(ph * 5.2) * 0.12;
    } else if (id === 'anna') {                               // Pirouette, Pokal hoch
      const c = ph % 3.2; spin = c < 1.3 ? ease(c / 1.3) * TAU : 0; jump = (c < 1.3 ? Math.sin(c / 1.3 * Math.PI) * 6 : Math.abs(Math.sin(ph * 3)) * 2) * done; aR = [3.05, 0.15]; aL = [1.1 + Math.sin(ph * 6) * 0.9, 0.3 * Math.sin(ph * 6)];
    } else if (id === 'flavio') {                             // Powerpose, schüttelt den Pokal
      roll = Math.sin(ph * 3) * 0.16 * done; jump = Math.abs(Math.sin(ph * 3)) * 2.4 * done; aR = [2.7 + Math.sin(ph * 9) * 0.2, 0]; aL = [Math.max(0.3, 1.6 + Math.sin(ph * 6) * 1.2), 0.2]; nod = Math.sin(ph * 6) * 0.2;
    } else if (id === 'quaki') {                              // Froschsprünge
      const q = Math.sin(ph * 4); jump = Math.max(0, q) * 15 * done; sy = q < 0 ? 1 - 0.22 * -q * done : 1 + 0.12 * q * done; aR = [q > 0 ? 3.1 : 2.2, 0]; aL = [q > 0 ? 2.8 : 1.6, 0]; nod = q > 0 ? -0.15 : 0.2;
    } else {                                                  // Janos: Watschel-Tanz
      roll = Math.sin(ph * 7) * 0.22 * done; jump = Math.abs(Math.sin(ph * 7)) * 3 * done; aR = [3.0 + Math.sin(ph * 14) * 0.25, 0]; aL = [1.4 + Math.sin(ph * 14 + Math.PI) * 0.7, 0]; shake = Math.sin(ph * 7) * 0.3;
    }
    if (id !== 'tom' && id !== 'flavio') nod += Math.sin(ph * 5) * 0.05;
  } else if (p === 2) {                                       // klatscht begeistert, kleine Hüpfer
    const k = Math.abs(Math.sin(ph * 4)); jump = k * 3.2; aR = [0.9 + Math.sin(ph * 12) * 0.08, 1.1]; aL = [0.9 + Math.sin(ph * 12) * 0.08, 1.1]; nod = Math.sin(ph * 4) * 0.1; shake = -0.35;
    if (id === 'quaki' || id === 'janos') { aR = [2.7, 0.1]; aL = [0.3 + (Math.sin(ph * 8) + 1) * 0.25, 0]; }
  } else if (p === 3) {                                       // winkt und freut sich bescheiden
    const k = Math.abs(Math.sin(ph * 3)); jump = k * 2; aR = [2.6 + Math.sin(ph * 9) * 0.35, 0]; aL = [0.25, 0]; nod = Math.sin(ph * 3) * 0.08; shake = 0.35;
  } else if (p === 4) {                                       // höflicher Applaus
    jump = Math.abs(Math.sin(ph * 3.5)) * 1.2; aR = [0.8, 1.1 + Math.sin(ph * 11) * 0.1]; aL = [0.8, 1.1 + Math.sin(ph * 11) * 0.1]; nod = Math.sin(ph * 3.5) * 0.08;
  } else {                                                    // enttäuschtes Achselzucken, schüttelt den Kopf
    const sh = Math.sin(ph * 1.4); aR = [0.55 + Math.max(0, sh) * 0.3, 0.3]; aL = [0.55 + Math.max(0, sh) * 0.3, 0.3]; shake = Math.sin(ph * 2.6) * 0.3; nod = 0.18; jump = Math.max(0, sh) * 0.6;
  }
  const breathe = Math.sin(T * 2.2 + f.x) * 0.012;
  b.position.y = jump; b.rotation.y = spin; b.rotation.z = roll; b.scale.set(1 - (sy - 1) * 0.5, sy + breathe, 1 - (sy - 1) * 0.5);
  f.drv.rotation.z = nod; f.drv.rotation.y = shake;
  raise(f.armR, 1, aR[0], aR[1]); raise(f.armL, -1, aL[0], aL[1]);
  if (f.trophy) f.trophy.rotation.y = Math.sin(T * 2) * 0.6;
  f.tag.visible = t > 0.8;
  f.root.rotation.y = f.yaw;
}

/* ----- Feuerwerk und Konfetti ----- */
const FWC = [[1, 0.3, 0.3], [1, 0.85, 0.25], [0.3, 0.85, 1], [0.5, 1, 0.5], [1, 0.4, 0.85], [1, 1, 1], [0.7, 0.5, 1]];
function burst(x, y, z) {
  const c = FWC[(Math.random() * FWC.length) | 0], c2 = FWC[(Math.random() * FWC.length) | 0], n = 80;
  for (let k = 0; k < n; k++) {
    const i = fwP.i; fwP.i = (fwP.i + 1) % FW_N;
    const u = rnd(0, TAU), v = Math.acos(rnd(-1, 1)), sp = rnd(28, 62) * (k % 3 === 0 ? 0.55 : 1);
    fwP.pos[i * 3] = x; fwP.pos[i * 3 + 1] = y; fwP.pos[i * 3 + 2] = z;
    fwP.vel[i * 3] = Math.sin(v) * Math.cos(u) * sp; fwP.vel[i * 3 + 1] = Math.cos(v) * sp; fwP.vel[i * 3 + 2] = Math.sin(v) * Math.sin(u) * sp * 0.6;
    const cc = k % 2 ? c : c2; fwP.base[i * 3] = cc[0]; fwP.base[i * 3 + 1] = cc[1]; fwP.base[i * 3 + 2] = cc[2];
    fwP.life[i] = fwP.max[i] = rnd(1.3, 2.2);
  }
  sfx.play('fw');
}
function stepFx(dt) {
  for (let i = 0; i < FW_N; i++) {
    if (fwP.life[i] <= 0) { fwP.col[i * 3] = fwP.col[i * 3 + 1] = fwP.col[i * 3 + 2] = 0; continue; }
    fwP.life[i] -= dt; const k = Math.max(0, fwP.life[i] / fwP.max[i]), d = Math.exp(-dt * 1.4);
    fwP.vel[i * 3] *= d; fwP.vel[i * 3 + 2] *= d; fwP.vel[i * 3 + 1] = fwP.vel[i * 3 + 1] * d - 22 * dt;
    for (let a = 0; a < 3; a++) { fwP.pos[i * 3 + a] += fwP.vel[i * 3 + a] * dt; fwP.col[i * 3 + a] = fwP.base[i * 3 + a] * k * (k > 0.8 ? 1.2 : 1); }
  }
  fw.geometry.attributes.position.needsUpdate = true; fw.geometry.attributes.color.needsUpdate = true;
  for (let i = 0; i < CF_N; i++) {
    if (!cfP.live[i]) continue;
    const p = cfP.pos, v = cfP.vel; cfP.ph[i] += dt * 3;
    v[i * 3 + 1] += (-24 - v[i * 3 + 1]) * Math.min(1, dt * 1.6); v[i * 3] *= Math.exp(-dt * 0.8); v[i * 3 + 2] *= Math.exp(-dt * 0.8);
    p[i * 3] += (v[i * 3] + Math.sin(cfP.ph[i]) * 9) * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += (v[i * 3 + 2] + Math.cos(cfP.ph[i] * 0.8) * 6) * dt;
    if (p[i * 3 + 1] < 0) { if (confettiOn) { p[i * 3] = rnd(-130, 130); p[i * 3 + 1] = rnd(120, 190); p[i * 3 + 2] = rnd(-60, 70); v[i * 3] = v[i * 3 + 2] = 0; v[i * 3 + 1] = -rnd(8, 20); } else { cfP.live[i] = 0; p[i * 3 + 1] = -999; } }
  }
  cf.geometry.attributes.position.needsUpdate = true;
}
function confettiBurst() {
  confettiOn = true;
  const CC = [[1, 0.3, 0.25], [1, 0.82, 0.25], [0.3, 0.85, 1], [0.5, 1, 0.5], [1, 0.4, 0.85], [1, 1, 1]];
  for (let i = 0; i < CF_N; i++) {
    const c = CC[i % CC.length], side = i % 2 ? 1 : -1, cannon = i < 160;
    cfP.live[i] = 1; cfP.ph[i] = rnd(0, TAU);
    cfP.col[i * 3] = c[0]; cfP.col[i * 3 + 1] = c[1]; cfP.col[i * 3 + 2] = c[2];
    if (cannon) { cfP.pos[i * 3] = side * 78; cfP.pos[i * 3 + 1] = 3; cfP.pos[i * 3 + 2] = 28; cfP.vel[i * 3] = -side * rnd(10, 46); cfP.vel[i * 3 + 1] = rnd(70, 130); cfP.vel[i * 3 + 2] = rnd(-14, 6); }
    else { cfP.pos[i * 3] = rnd(-130, 130); cfP.pos[i * 3 + 1] = rnd(110, 200); cfP.pos[i * 3 + 2] = rnd(-60, 70); cfP.vel[i * 3] = cfP.vel[i * 3 + 2] = 0; cfP.vel[i * 3 + 1] = -rnd(8, 20); }
  }
  cf.geometry.attributes.color.needsUpdate = true;
}

/* ----- Ablauf ----- */
export const podiumActive = () => active;
export function podiumSkip() { T = Math.max(T, winnerT + 0.6); }

/* res: Liste der Platzierungen (Platz 1 zuerst) mit { ch, sk, label, place } */
export function podiumStart(list, cb) {
  build(); podiumStop(true);
  active = true; T = 0; panelShown = false; onPanel = cb || null; confettiOn = false; fwNext = 99; cheerNext = 99;
  rows = list;
  const top = list.slice(0, 3), rest = list.slice(3);
  /* Auftritte von unten nach oben: der Gewinner kommt zuletzt */
  const order = top.map((r, i) => i).reverse();
  top.forEach((r, i) => {
    const st = STEP[i], tr = 1.2 + order.indexOf(i) * 1.9;
    const f = makeFig(r, i + 1, st.x, 2, 1.3, tr); f.root.position.y = 1.6 + st.h; f.yaw = i === 1 ? -0.2 : i === 2 ? 0.2 : 0; f.big = true; f.tr = tr;
    group.figs.add(f.root); figs.push(f);
    if (i === 0) winnerT = tr;
  });
  /* Platz 4 bis 8: neben dem Podium, hinten auf kleinen Podesten, der letzte davor */
  const slots = [[-70, 10, 2], [70, 10, 2], [-56, -30, 20], [56, -30, 20], [-48, 46, 2]];
  rest.forEach((r, i) => {
    const sl = slots[i] || slots[4], f = makeFig(r, i + 4, sl[0], sl[1], 1.0, 5.2 + i * 0.35);
    f.root.position.y = sl[2]; f.yaw = sl[0] < 0 ? 0.3 : sl[0] > 0 ? -0.3 : 0; group.figs.add(f.root); figs.push(f);
    if (sl[2] > 2) { const rs = new THREE.Mesh(riserG, riserM); rs.position.set(sl[0], 1 + sl[2] / 2 - 0.5, sl[1]); rs.scale.y = (sl[2] - 1) / 18; group.figs.add(rs); }
  });
  if (!top.length) winnerT = 1;
  sfx.init(); sfx.music(true);
  fired.length = 0;
  top.forEach((r, i) => { const at = 1.2 + order.indexOf(i) * 1.9; fired.push({ at: Math.max(0.05, at - 1.1), kind: 'roll' }, { at, kind: 'show', first: i === 0 }); });
}
const fired = [];
const riserG = new THREE.BoxGeometry(24, 18, 22), riserM = mat(0x4a5578);
export function podiumStop(keepBuilt) {
  active = false; sfx.music(false);
  for (const f of figs) disposeTree(f.root);
  figs = []; group.figs.clear();
  confettiOn = false; for (let i = 0; i < CF_N; i++) cfP.live[i] = 0;
  if (built) { for (let i = 0; i < FW_N; i++) { fwP.life[i] = 0; fwP.pos[i * 3 + 1] = -999; } for (let i = 0; i < CF_N; i++) cfP.pos[i * 3 + 1] = -999; }
}
function disposeTree(o) {
  o.traverse(m => {
    if (m.geometry && !(m.geometry.userData && m.geometry.userData.keep)) m.geometry.dispose();
    if (m.material && m.material.map && m.isSprite) m.material.map.dispose();
  });
}

function placeCamera(aspect) {
  const hFov = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), need = 90;
  const dist = Math.max(150, need / (hFov * Math.max(0.4, aspect))), k = ease(Math.min(1, T / 4.2));
  const sway = Math.sin(T * 0.35) * 14 * (aspect > 1 ? 1 : 0.5);
  cam.position.set(sway + (1 - k) * 70, 30 + k * 16, dist + (1 - k) * 110);
  cam.lookAt(0, 26 + k * 5, 0);
  cam.aspect = aspect; cam.updateProjectionMatrix();
}

export function renderPodium(dt) {
  const R = S.renderer; if (!R || !active) return false;
  T += dt;
  /* Ablauf-Ereignisse: Fanfare, Feuerwerk, Konfetti, Jubel */
  for (const e of fired) if (!e.done && T >= e.at) {
    e.done = true;
    if (e.kind === 'roll') { sfx.play('roll'); continue; }
    sfx.play('cheer');
    if (e.first) { sfx.play('fanfare'); confettiBurst(); fwNext = T; cheerNext = T + 1.6; }
  }
  if (T >= fwNext) { burst(rnd(-110, 110), rnd(70, 150), rnd(-110, -30)); fwNext = T + rnd(0.35, 0.8); }
  if (T >= cheerNext) { sfx.play('cheer'); cheerNext = T + rnd(2.4, 3.6); }
  if (!panelShown && T >= winnerT + 1.8) { panelShown = true; if (onPanel) onPanel(); }
  const excite = T < winnerT ? 0.35 : 1;
  for (const c of crowd) {
    const k = Math.abs(Math.sin(T * c.sp + c.ph)) * c.amp * excite;
    c.p.position.y = c.y0 + k * 2.6; const w = excite > 0.5 ? 2.5 + Math.sin(T * c.sp * 1.6 + c.ph) * 0.7 : 0.4;
    c.arms[0].rotation.z = -w * 0.55 * excite - 0.2; c.arms[1].rotation.z = w * 0.55 * excite + 0.2;
    c.arms[0].rotation.x = c.arms[1].rotation.x = 0;
  }
  for (const f of figs) animate(f, T, dt);
  for (const l of lights) { if (l.isPointLight) { l.intensity = 0.7 + Math.sin(T * 2 + l.position.x) * 0.3; } else if (l.userData.sp !== undefined) l.material.opacity = 0.07 + 0.05 * Math.sin(T * 2 + l.userData.sp); else if (l.userData.ph !== undefined) l.scale.setScalar(0.8 + 0.4 * Math.abs(Math.sin(T * 3 + l.userData.ph))); }
  stepFx(dt);

  /* In den Platzhalter der Seite (Bühne) zeichnen, sonst vollflächig */
  const el = $('#podStage'), cr = R.domElement.getBoundingClientRect();
  let x = 0, y = 0, w = S.VW, h = S.VH;
  if (el && el.isConnected && el.offsetParent) { const rc = el.getBoundingClientRect(); if (rc.width > 8 && rc.height > 8) { x = rc.left - cr.left; y = cr.bottom - rc.bottom; w = rc.width; h = rc.height; } }
  placeCamera(w / h);
  const cc = new THREE.Color(), ca = R.getClearAlpha(); R.getClearColor(cc);
  R.setScissorTest(false); R.setViewport(0, 0, S.VW, S.VH); R.setClearColor(0x0b1030, 1); R.clear(); R.setClearColor(cc, ca);
  R.setViewport(x, y, w, h); R.setScissor(x, y, w, h); R.setScissorTest(true);
  R.render(scene, cam);
  R.setScissorTest(false); R.setViewport(0, 0, S.VW, S.VH);
  return true;
}
