import * as THREE from 'three';
import { S } from './state.js';
import { clamp, TAU, angDiff, rand, ctx, N, fmt } from './util.js';
import { LAPS, ITEMS } from './data.js';
import { sun, scene } from './core.js';
import { puffs } from './karts.js';
import { loopLat } from './world.js';
import { sorted } from './physics.js';
import { renderPreview } from './preview.js';

/* ---------- Zeichnen ---------- */
const camPool = [];
const camState = i => camPool[i] || (camPool[i] = { a: 0, fov: 64, init: false, lk: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), camera: i === 0 ? S.camera : new THREE.PerspectiveCamera(64, 1, 2, 9000) });
export const cam = camState(0);
export const tv = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0), Z_AXIS = new THREE.Vector3(0, 0, 1), qPitch = new THREE.Quaternion(), qYaw = new THREE.Quaternion();
export function proj(x, y, z) { tv.set(x, y, z).project(S.camera); return [(tv.x * 0.5 + 0.5) * S.VW, (-tv.y * 0.5 + 0.5) * S.VH, tv.z]; }

export function draw(dt) {
  const now = performance.now();
  for (const c of S.cars) {
    const u = c.mesh.userData, g = c.mesh;
    g.position.set(c.x, c.y, c.z);
    if (c.loop) g.quaternion.setFromAxisAngle(Y_AXIS, -S.world.pts[S.world.loop.i0].ang).multiply(qPitch.setFromAxisAngle(Z_AXIS, c.pitch)).multiply(qYaw.setFromAxisAngle(Y_AXIS, -c.loop.psi + c.spinAng));
    else g.rotation.set(0, -c.a + c.spinAng, c.pitch || 0);
    u.body.rotation.x = (c.feather && c.air) ? c.rollAng : clamp(-c.steer * 0.07 * clamp(c.s / 100, 0, 1.2), -0.1, 0.1) + (c.air ? -0.12 : 0);
    u.body.position.y = c.boost > 0 ? 0.6 : 0;
    for (const w of u.wheels) w.rotation.z -= c.s * dt / 3.6;
    for (const w of u.front) w.rotation.y = -c.steer * 0.45;
    u.flame.visible = c.boost > 0; if (c.boost > 0) u.flame.scale.set(0.8 + Math.random() * 0.5, 1, 1);
    u.driver.rotation.y = -c.steer * 0.5; u.driver.rotation.z = c.boost > 0 ? -0.18 : 0;
    u.chute.visible = c.chute && c.air; if (u.chute.visible) { c.chuteT = Math.min(1, c.chuteT + dt * 4); u.chute.scale.setScalar(0.2 + 0.8 * c.chuteT); u.chute.rotation.z = Math.sin(now / 260) * 0.08; } else c.chuteT = 0;
    u.ice.visible = c.freeze > 0;
    if (c.feather && c.air) c.rollAng += dt * TAU / 1.15; else c.rollAng = 0;
    u.shield.visible = c.shield > 0 && (c.shield > 2 || Math.floor(now / 120) % 2 === 0);
    u.blob.visible = c.onPlat && !c.fall; u.blob.position.y = 0.6 - c.y; u.blob.scale.set(1.15 * (1 - Math.min(0.5, c.y / 60)), 0.9 * (1 - Math.min(0.5, c.y / 60)), 1);
    g.visible = c.inv <= 0 || Math.floor(now / 90) % 2 === 0 || c.spin > 0;
  }
  for (const h of S.world.spinners) h.rotation.x += dt * 1.3;
  for (const j of S.world.jumps) { if (j.anim > 0) j.anim -= dt; const k = j.anim > 0 ? Math.sin(j.anim / 0.45 * Math.PI) : 0; j.mesh.userData.top.position.y = 3.6 + k * 2.2; j.mesh.userData.arrow.position.y = 5 + k * 3; j.mesh.userData.arrow.rotation.y += dt * 1.6; }
  for (const b of S.world.boxes) if (b.mesh.visible) { b.mesh.position.y = 11 + Math.sin(now / 280 + b.x) * 2.2; b.mesh.rotation.y = now / 700; b.mesh.rotation.x = now / 1100; }
  for (const p of puffs) { if (p.life > 0) { p.life -= dt; const t = 1 - p.life / p.max; p.m.scale.setScalar(2.5 + t * 8); p.m.position.y += dt * p.rise; p.m.material.opacity = Math.max(0, 0.55 * (1 - t)); if (p.life <= 0) p.m.visible = false; } }


  const split = S.humans.length > 1 && S.state !== 'menu';
  const sh = S.shakeT > 0 ? rand(-1, 1) * 3 : 0; S.shakeT = Math.max(0, S.shakeT - dt);
  sun.position.set(400, 900, 300);
  const R = S.renderer;
  if (S.state === 'menu') {
    const ref = S.player || S.cars[0];
    S.menuAng += dt * 0.5;
    S.camera.position.set(ref.x + Math.cos(S.menuAng) * 78, 30, ref.z + Math.sin(S.menuAng) * 78);
    S.camera.lookAt(ref.x, 9, ref.z); S.camera.fov = 52; for (const q of camPool) q.init = false;
    S.camera.setViewOffset(S.VW, S.VH, 0, S.VH > S.VW ? S.VH * 0.2 : S.VH * 0.08, S.VW, S.VH);
    S.camera.updateProjectionMatrix();
    S.views = null;
    R.render(scene, S.camera);
  } else if (!split) {
    S.camera.clearViewOffset();
    followCam(camState(0), S.player || S.cars[0], dt, S.VW / S.VH, sh);
    S.views = null;
    R.render(scene, S.camera);
  } else {
    const rects = splitRects(S.humans.length);
    S.views = rects;
    R.setScissorTest(true);
    S.humans.forEach((h, i) => {
      const v = rects[i], st = camState(i); st.camera.clearViewOffset();
      followCam(st, h, dt, v.w / v.h, sh);
      R.setViewport(v.x, v.y, v.w, v.h); R.setScissor(v.x, v.y, v.w, v.h);
      R.render(scene, st.camera);
    });
    R.setScissorTest(false); R.setViewport(0, 0, S.VW, S.VH);
  }
  if (S.state === 'menu' || S.state === 'over') renderPreview(dt);
  drawOverlay();
}

/* Bildschirmaufteilung für lokale Mitspieler; x/y im GL-Raster (unten links), oy = Abstand von oben */
export function splitRects(n) {
  const W = S.VW, H = S.VH, r = [];
  const add = (x, top, w, h) => r.push({ x, y: H - top - h, w, h, oy: top });
  if (n === 2) { if (W >= H) { add(0, 0, W / 2, H); add(W / 2, 0, W / 2, H); } else { add(0, 0, W, H / 2); add(0, H / 2, W, H / 2); } }
  else if (n === 3) { add(0, 0, W / 2, H / 2); add(W / 2, 0, W / 2, H / 2); add(0, H / 2, W, H / 2); }
  else { add(0, 0, W / 2, H / 2); add(W / 2, 0, W / 2, H / 2); add(0, H / 2, W / 2, H / 2); add(W / 2, H / 2, W / 2, H / 2); }
  return r;
}

/* Kamera hinter einem Fahrzeug; st = Kamera-Zustand je Spieler */
function followCam(st, ref, dt, asp, sh) {
  const camera = st.camera;
  if (!st.init) { st.a = ref.a; st.init = true; }
  st.a += angDiff(ref.a, st.a) * Math.min(1, dt * 4.5);
  const boostK = ref.boost > 0 ? 1 : 0, spdK = clamp(ref.s / ref.st.max, 0, 1.3);
  const dist = 84 + spdK * 10 - boostK * 6, h = 36 + spdK * 4, ly = Math.max(ref.y, -40);
  const base = asp < 0.8 ? 72 : asp < 1.2 ? 66 : 60;
  camera.position.set(ref.x - Math.cos(st.a) * dist + sh, h + ly * 0.7 + sh * 0.5, ref.z - Math.sin(st.a) * dist + sh);
  camera.lookAt(ref.x + Math.cos(st.a) * 55, 9 + ly * 0.6, ref.z + Math.sin(st.a) * 55);
  /* Im Looping filmt die Kamera von der Kreismitte aus, sonst läge sie in der Straße */
  st.lk += ((ref.loop ? 1 : 0) - st.lk) * Math.min(1, dt * 5);
  if (ref.loop) {
    const L = S.world.loop, p0 = S.world.pts[L.i0], sc = L.k * ref.loop.phi - L.R * 0.45;
    st.pos.set(p0.x + p0.tx * sc + p0.nx * (loopLat(L, ref.loop.phi) + ref.loop.rel) * 0.5, L.R + 10, p0.z + p0.tz * sc + p0.nz * (loopLat(L, ref.loop.phi) + ref.loop.rel) * 0.5);
    st.look.set(ref.x, ref.y + 6, ref.z);
  }
  if (st.lk > 0.01) {
    camera.position.lerp(st.pos, st.lk);
    camera.lookAt(new THREE.Vector3(ref.x + Math.cos(st.a) * 55, 9 + ly * 0.6, ref.z + Math.sin(st.a) * 55).lerp(st.look, st.lk));
  }
  st.fov += (base + spdK * 7 + boostK * 9 - st.fov) * Math.min(1, dt * 5); camera.fov = st.fov;
  camera.aspect = asp; camera.updateProjectionMatrix();
}

export function drawOverlay() {
  ctx.setTransform(S.DPR, 0, 0, S.DPR, 0, 0); ctx.clearRect(0, 0, S.VW, S.VH);
  if (S.state === 'menu' || S.state === 'over') return;
  const split = !!S.views;
  if (S.player && S.player.ink > 0) {
    const a = Math.min(1, S.player.ink / 1.2) * 0.92, v = split ? S.views[0] : { x: 0, oy: 0, w: S.VW, h: S.VH };
    ctx.save(); ctx.beginPath(); ctx.rect(v.x, v.oy, v.w, v.h); ctx.clip();
    ctx.fillStyle = 'rgba(18,20,38,' + a + ')';
    for (const b of S.inkBlobs) { ctx.beginPath(); ctx.ellipse(v.x + b.x * v.w, v.oy + b.y * v.h, b.r * v.w, b.r * v.w * 0.8, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  const mx = split ? (S.VW - S.mini.MM) / 2 : S.VW - 16 - 112, my = split ? (S.VH - S.mini.MM) / 2 : 66;
  if (!split || S.humans.length === 2) {
    ctx.drawImage(S.mini.img, mx, my, S.mini.MM, S.mini.MM);
    for (const c of S.cars) {
      const x = mx + S.mini.ox + (c.x - S.mini.minx) * S.mini.sc, y = my + S.mini.oy + (c.z - S.mini.minz) * S.mini.sc;
      ctx.fillStyle = c.kart.css; ctx.strokeStyle = c.isPlayer ? '#fff' : '#0e1118'; ctx.lineWidth = c.isPlayer ? 2.5 : 1.5;
      ctx.beginPath(); ctx.arc(x, y, c.isPlayer ? 5 : 3.8, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }
  if (split) { drawSplitHud(); return; }
  ctx.font = '700 13px "Barlow Semi Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const c of S.cars) {
    if (c === S.player) continue;
    const dx = c.x - S.player.x, dz = c.z - S.player.z;
    if (dx * dx + dz * dz > 300 * 300) continue;
    const [x, y, z] = proj(c.x, c.y + 34, c.z);
    if (z > 1 || x < -20 || x > S.VW + 20) continue;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(14,17,24,.85)'; ctx.strokeText(c.remote ? c.name : c.ch.name, x, y);
    ctx.fillStyle = '#fff'; ctx.fillText(c.remote ? c.name : c.ch.name, x, y);
  }
}

/* HUD je Teilbild bei lokalen Mitspielern: Platz, Runde, Item, Tempo */
function drawSplitHud() {
  const order = sorted(), v = S.views;
  ctx.lineJoin = 'round';
  const text = (t, x, y, size, col, al, fam) => {
    ctx.font = (fam ? '400 ' : '700 ') + size + 'px ' + (fam ? '"Russo One", Arial Black, sans-serif' : '"Barlow Semi Condensed", sans-serif'); ctx.textAlign = al;
    ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = 'rgba(14,17,24,.85)'; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y);
  };
  S.humans.forEach((h, i) => {
    const q = v[i], pad = 12, big = Math.min(44, q.h * 0.12 + 14), small = Math.min(15, q.h * 0.04 + 8);
    const place = order.indexOf(h) + 1;
    text(String(place), q.x + pad, q.oy + pad + big, big, '#fff', 'left', true);
    text('/ ' + S.cars.length, q.x + pad + big * 0.9, q.oy + pad + big, small + 3, '#dfe6f3', 'left');
    text(h.name + ' · Runde ' + clamp(Math.floor(Math.max(0, h.prog) / N) + 1, 1, LAPS) + ' / ' + LAPS, q.x + pad, q.oy + pad + big + small + 6, small, h.kart.css, 'left');
    const itemTxt = h.roll > 0 ? 'Item …' : h.item ? ITEMS[h.item].name : '';
    if (itemTxt) text(itemTxt, q.x + q.w - pad, q.oy + pad + small + 4, small + 2, '#ffd23f', 'right');
    text(Math.round(Math.abs(h.s) * 1.15) + ' km/h', q.x + q.w - pad, q.oy + q.h - pad, small + 1, '#dfe6f3', 'right');
    if (h.finished) text('Ziel! ' + fmt(h.finishT), q.x + q.w / 2, q.oy + q.h * 0.4, big * 0.8, '#ffd23f', 'center', true);
  });
  ctx.strokeStyle = 'rgba(10,12,18,.9)'; ctx.lineWidth = 4;
  ctx.beginPath();
  const n = S.humans.length;
  if (n === 2) { if (v[1].x > 0) { ctx.moveTo(S.VW / 2, 0); ctx.lineTo(S.VW / 2, S.VH); } else { ctx.moveTo(0, S.VH / 2); ctx.lineTo(S.VW, S.VH / 2); } }
  else { ctx.moveTo(S.VW / 2, 0); ctx.lineTo(S.VW / 2, n === 3 ? S.VH / 2 : S.VH); ctx.moveTo(0, S.VH / 2); ctx.lineTo(S.VW, S.VH / 2); }
  ctx.stroke();
}
