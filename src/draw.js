import * as THREE from 'three';
import { S } from './state.js';
import { clamp, TAU, angDiff, rand, ctx } from './util.js';
import { sun, scene } from './core.js';
import { puffs } from './karts.js';
import { loopLat } from './world.js';

/* ---------- Zeichnen ---------- */
export const cam = { a: 0, fov: 64, init: false, lk: 0, pos: new THREE.Vector3(), look: new THREE.Vector3() };
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

  const ref = S.player || S.cars[0];
  if (S.state === 'menu') {
    S.menuAng += dt * 0.5;
    S.camera.position.set(ref.x + Math.cos(S.menuAng) * 78, 30, ref.z + Math.sin(S.menuAng) * 78);
    S.camera.lookAt(ref.x, 9, ref.z); S.camera.fov = 52; cam.init = false;
    S.camera.setViewOffset(S.VW, S.VH, 0, S.VH > S.VW ? S.VH * 0.2 : S.VH * 0.08, S.VW, S.VH);
  } else {
    S.camera.clearViewOffset();
    if (!cam.init) { cam.a = ref.a; cam.init = true; }
    cam.a += angDiff(ref.a, cam.a) * Math.min(1, dt * 4.5);
    const boostK = ref.boost > 0 ? 1 : 0, spdK = clamp(ref.s / ref.st.max, 0, 1.3);
    const dist = 84 + spdK * 10 - boostK * 6, h = 36 + spdK * 4, ly = Math.max(ref.y, -40);
    const asp = S.VW / S.VH, base = asp < 0.8 ? 72 : asp < 1.2 ? 66 : 60;
    const sh = S.shakeT > 0 ? rand(-1, 1) * 3 : 0; S.shakeT = Math.max(0, S.shakeT - dt);
    S.camera.position.set(ref.x - Math.cos(cam.a) * dist + sh, h + ly * 0.7 + sh * 0.5, ref.z - Math.sin(cam.a) * dist + sh);
    S.camera.lookAt(ref.x + Math.cos(cam.a) * 55, 9 + ly * 0.6, ref.z + Math.sin(cam.a) * 55);
    /* Im Looping filmt die Kamera von der Kreismitte aus, sonst läge sie in der Straße */
    cam.lk += ((ref.loop ? 1 : 0) - cam.lk) * Math.min(1, dt * 5);
    if (ref.loop) {
      const L = S.world.loop, p0 = S.world.pts[L.i0], sc = L.k * ref.loop.phi - L.R * 0.45;
      cam.pos.set(p0.x + p0.tx * sc + p0.nx * (loopLat(L, ref.loop.phi) + ref.loop.rel) * 0.5, L.R + 10, p0.z + p0.tz * sc + p0.nz * (loopLat(L, ref.loop.phi) + ref.loop.rel) * 0.5);
      cam.look.set(ref.x, ref.y + 6, ref.z);
    }
    if (cam.lk > 0.01) {
      S.camera.position.lerp(cam.pos, cam.lk);
      S.camera.lookAt(new THREE.Vector3(ref.x + Math.cos(cam.a) * 55, 9 + ly * 0.6, ref.z + Math.sin(cam.a) * 55).lerp(cam.look, cam.lk));
    }
    cam.fov += (base + spdK * 7 + boostK * 9 - cam.fov) * Math.min(1, dt * 5); S.camera.fov = cam.fov;
  }
  S.camera.updateProjectionMatrix();
  sun.position.set(400, 900, 300);
  S.renderer.render(scene, S.camera);
  drawOverlay();
}

export function drawOverlay() {
  ctx.setTransform(S.DPR, 0, 0, S.DPR, 0, 0); ctx.clearRect(0, 0, S.VW, S.VH);
  if (S.state === 'menu' || S.state === 'over') return;
  if (S.player && S.player.ink > 0) {
    const a = Math.min(1, S.player.ink / 1.2) * 0.92;
    ctx.fillStyle = 'rgba(18,20,38,' + a + ')';
    for (const b of S.inkBlobs) { ctx.beginPath(); ctx.ellipse(b.x * S.VW, b.y * S.VH, b.r * S.VW, b.r * S.VW * 0.8, 0, 0, TAU); ctx.fill(); }
  }
  const mx = S.VW - 16 - 112, my = 66;
  ctx.drawImage(S.mini.img, mx, my, S.mini.MM, S.mini.MM);
  for (const c of S.cars) {
    const x = mx + S.mini.ox + (c.x - S.mini.minx) * S.mini.sc, y = my + S.mini.oy + (c.z - S.mini.minz) * S.mini.sc;
    ctx.fillStyle = c.kart.css; ctx.strokeStyle = c === S.player ? '#fff' : '#0e1118'; ctx.lineWidth = c === S.player ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(x, y, c === S.player ? 5 : 3.8, 0, TAU); ctx.fill(); ctx.stroke();
  }
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
