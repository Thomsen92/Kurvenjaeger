import * as THREE from 'three';
import { CHARS, KARTS } from './data.js';
import { S } from './state.js';
import { makeDriver, makeKart, makeCarMesh } from './karts.js';

/* ---------- 3D-Vorschau für Charakter-, Kart- und Freischaltungsseiten ----------
   Die Vorschau läuft mit dem Haupt-Renderer in einem Ausschnitt (Scissor), der genau über einem
   Platzhalter-Element im Menü liegt. Kleine Vorschaubilder entstehen einmalig über ein Render-Target. */
const mkScene = () => {
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x6f7a92, 1.05));
  const d = new THREE.DirectionalLight(0xfff1d6, 0.95); d.position.set(3, 6, 4); sc.add(d);
  const d2 = new THREE.DirectionalLight(0x9ec8ff, 0.35); d2.position.set(-4, 2, -3); sc.add(d2);
  return sc;
};
const pvScene = mkScene(), thScene = mkScene();
const pvCam = new THREE.PerspectiveCamera(34, 1, 0.1, 4000), thCam = new THREE.PerspectiveCamera(34, 1, 0.1, 4000);
const pvPivot = new THREE.Group(); pvScene.add(pvPivot);
const cache = {};

(function bg() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2a3a6b'); gr.addColorStop(0.6, '#1b2442'); gr.addColorStop(1, '#10141f');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  pvScene.background = new THREE.CanvasTexture(c);
})();

function bbox(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3(), t = new THREE.Box3();
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    t.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(t);
  });
  return box;
}
/* Baut (und merkt sich) ein zentriertes Modell. spec: { pv:'char', ch, sk } oder { pv:'kart', kt, pk, drv:{ch,sk} } */
function model(spec) {
  const key = spec.pv === 'char' ? 'c' + spec.ch + '_' + spec.sk : 'k' + spec.kt + '_' + spec.pk + (spec.drv ? '_d' + spec.drv.ch + '_' + spec.drv.sk : '');
  if (cache[key]) return cache[key];
  let m;
  if (spec.pv === 'char') { m = makeDriver(CHARS[spec.ch], spec.sk); m.position.set(0, 0, 0); }
  else m = spec.drv ? makeCarMesh(KARTS[spec.kt], CHARS[spec.drv.ch], spec.drv.sk, spec.pk) : makeKart(KARTS[spec.kt], spec.pk);
  const holder = new THREE.Group(); holder.add(m);
  const box = bbox(holder), c = box.getCenter(new THREE.Vector3());
  m.position.sub(c);
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  return (cache[key] = { holder, r });
}
function fit(cam, r, aspect) {
  const half = THREE.MathUtils.degToRad(cam.fov / 2), dist = Math.max(r / Math.sin(half), r / (Math.sin(half) * Math.max(0.2, aspect))) * 1.04;
  cam.aspect = aspect; cam.position.set(0, r * 0.28, dist); cam.lookAt(0, 0, 0); cam.near = Math.max(0.1, dist - r * 2); cam.far = dist + r * 3; cam.updateProjectionMatrix();
}

/* ----- Vorschaubilder ----- */
const TH = 176; let rt = null;
const thumbCache = {};
export function thumb(spec) {
  const key = spec.pv === 'char' ? 'c' + spec.ch + '_' + spec.sk : 'k' + spec.kt + '_' + spec.pk;
  if (thumbCache[key]) return thumbCache[key];
  const r = S.renderer; if (!r) return '';
  if (!rt) rt = new THREE.WebGLRenderTarget(TH, TH);
  const mdl = model(spec), par = mdl.holder.parent; mdl.holder.rotation.y = -0.75; thScene.add(mdl.holder);
  fit(thCam, mdl.r, 1);
  const tmp = new THREE.Color(), cc = (r.getClearColor(tmp) || tmp).clone(), ca = r.getClearAlpha(), prev = r.getRenderTarget();
  r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(thScene, thCam);
  const buf = new Uint8Array(TH * TH * 4); r.readRenderTargetPixels(rt, 0, 0, TH, TH, buf);
  r.setRenderTarget(prev); r.setClearColor(cc, ca);
  thScene.remove(mdl.holder); mdl.holder.rotation.y = 0; if (par) par.add(mdl.holder);
  const cv = document.createElement('canvas'); cv.width = cv.height = TH; const g = cv.getContext('2d'), img = g.createImageData(TH, TH);
  for (let y = 0; y < TH; y++) img.data.set(buf.subarray((TH - 1 - y) * TH * 4, (TH - y) * TH * 4), y * TH * 4);
  g.putImageData(img, 0, 0);
  return (thumbCache[key] = cv.toDataURL('image/png'));
}

/* ----- Live-Vorschau ----- */
const pv = { el: null, spec: null, mdl: null, yaw: -0.75, drag: false, idle: 0, pop: 1, vel: 0 };
export function setStage(el) {
  if (pv.el === el) return;
  pv.el = el;
  if (!el) return;
  let lx = 0;
  el.style.touchAction = 'none'; el.style.cursor = 'grab';
  el.addEventListener('pointerdown', e => { pv.drag = true; lx = e.clientX; try { el.setPointerCapture(e.pointerId); } catch (x) {} el.style.cursor = 'grabbing'; });
  el.addEventListener('pointermove', e => { if (!pv.drag) return; pv.yaw += (e.clientX - lx) * 0.012; lx = e.clientX; pv.idle = 0; });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, () => { pv.drag = false; el.style.cursor = 'grab'; });
}
export function setPreview(spec) {
  pv.spec = spec;
  if (pv.mdl) pvPivot.remove(pv.mdl.holder);
  pv.mdl = spec ? model(spec) : null;
  if (pv.mdl) { pvPivot.add(pv.mdl.holder); pv.pop = 0.6; }
}
/* Auftritt für Freischaltungen: schnelle Drehung, die ausläuft, und größeres Hereinwachsen */
export function kick() { pv.pop = 0; pv.vel = 9; }
export const clearPreview = () => { setPreview(null); pv.el = null; };

export function renderPreview(dt) {
  const r = S.renderer, el = pv.el;
  if (!r || !el || !pv.mdl || !el.isConnected) return;
  const rc = el.getBoundingClientRect(), cr = r.domElement.getBoundingClientRect();
  if (rc.width < 8 || rc.height < 8) return;
  const x = rc.left - cr.left, y = cr.bottom - rc.bottom, w = rc.width, h = rc.height;
  if (!pv.drag) { pv.idle += dt; if (pv.idle > 0.4) pv.yaw += dt * (0.7 + pv.vel); }
  pv.vel *= Math.exp(-dt * 1.4);
  pv.pop = Math.min(1, pv.pop + dt * 3.2); const k = 1 - Math.pow(1 - pv.pop, 3);
  pvPivot.rotation.y = pv.yaw; pvPivot.scale.setScalar(0.7 + 0.3 * k);
  fit(pvCam, pv.mdl.r, w / h);
  r.setViewport(x, y, w, h); r.setScissor(x, y, w, h); r.setScissorTest(true);
  const ac = r.autoClear; r.autoClear = false; r.clearDepth(); r.render(pvScene, pvCam);
  r.autoClear = ac; r.setScissorTest(false); r.setViewport(0, 0, S.VW, S.VH);
}
