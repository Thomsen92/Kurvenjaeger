import * as THREE from 'three';
import { S } from './state.js';
import { cv, $, rand, TAU } from './util.js';

/* ---------- 3D-Grundlagen ---------- */
try {
  S.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
} catch (err) {
  $('#bestLine').textContent = 'Dein Gerät unterstützt kein WebGL, das 3D-Spiel startet hier nicht.';
  throw new Error('WebGL nicht verfügbar');
}
export const scene = new THREE.Scene();
S.camera = new THREE.PerspectiveCamera(64, 1, 2, 9000);
export const hemi = new THREE.HemisphereLight(0xdfeaff, 0x8a8f9c, 1.0);
export const sun = new THREE.DirectionalLight(0xfff1d6, 0.85);
sun.position.set(400, 900, 300);
scene.add(hemi); scene.add(sun);
export const lam = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
export const bas = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
export const sphereG = new THREE.SphereGeometry(1, 12, 8);
sphereG.userData.keep = true;
export const eyeW = bas(0xffffff), eyeB = bas(0x10131a);

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return t;
}
export const specks = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '0,0,0') + ',' + rand(0.02, a) + ')'; g.fillRect(rand(0, w), rand(0, h), 2, 2); } };
/* Straßenbelag je Themenpark */
export const makeRoadTex = def => canvasTex(128, 128, (g, w, h) => {
  if (def.decor === 'farm') {
    g.fillStyle = '#8a6e4e'; g.fillRect(0, 0, w, h); specks(g, w, h, 700, 0.12);
    g.fillStyle = 'rgba(60,40,22,.38)'; g.fillRect(w * 0.27, 0, 14, h); g.fillRect(w * 0.66, 0, 14, h);
    for (let i = 0; i < 46; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '210,195,170' : '70,52,34') + ',.55)'; g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(1.5, 3.5), rand(1, 2.4), rand(0, 3), 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(70,140,50,.85)'; g.lineWidth = 2;
    for (let i = 0; i < 26; i++) { const x = Math.random() < 0.5 ? rand(0, 10) : rand(w - 10, w), y = rand(0, h); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-2, 2), y - rand(4, 9)); g.stroke(); }
  } else if (def.decor === 'candy') {
    g.fillStyle = '#e3b36a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b9833f'; g.lineWidth = 4;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); }
    specks(g, w, h, 300, 0.1);
    g.fillStyle = '#ff6ad5'; g.fillRect(0, 0, 9, h); g.fillRect(w - 9, 0, 9, h);
    g.fillStyle = '#ffffff'; for (let y = 4; y < h; y += 20) { g.fillRect(2, y, 5, 8); g.fillRect(w - 7, y, 5, 8); }
    const pal = ['#ff4b3e', '#ffd23f', '#4fd8ff', '#ffffff', '#7ddc6f'];
    for (let i = 0; i < 26; i++) { g.fillStyle = pal[i % 5]; g.save(); g.translate(rand(14, w - 14), rand(0, h)); g.rotate(rand(0, 3)); g.fillRect(-3, -1, 6, 2.2); g.restore(); }
  } else {
    g.fillStyle = '#c9965b'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(70,40,15,.55)'; g.fillRect(0, y, w, 2); g.fillStyle = (y / 16) % 2 ? 'rgba(255,230,180,.10)' : 'rgba(60,30,10,.08)'; g.fillRect(0, y + 2, w, 14); }
    specks(g, w, h, 500, 0.1);
    g.strokeStyle = 'rgba(80,45,15,.25)'; g.lineWidth = 1; for (let i = 0; i < 40; i++) { const y = rand(0, h), x = rand(0, w); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(10, 30), y + rand(-1, 1)); g.stroke(); }
    g.fillStyle = '#2fa8e0'; g.fillRect(0, 0, 9, h); g.fillRect(w - 9, 0, 9, h);
    g.fillStyle = '#ffffff'; for (let y = 6; y < h; y += 22) { g.beginPath(); g.arc(4.5, y, 2.4, 0, TAU); g.fill(); g.beginPath(); g.arc(w - 4.5, y, 2.4, 0, TAU); g.fill(); }
  }
}, true);
export const makeTopTex = (col, sprinkles) => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = col; g.fillRect(0, 0, w, h); specks(g, w, h, 500, 0.09);
  if (sprinkles) { const pal = ['#ff4b3e', '#ffd23f', '#4fd8ff', '#ffffff', '#7ddc6f']; for (let i = 0; i < 70; i++) { g.fillStyle = pal[i % 5]; g.save(); g.translate(rand(0, w), rand(0, h)); g.rotate(rand(0, 3)); g.fillRect(-3, -1, 6, 2.2); g.restore(); } }
}, true);
export const padTex = canvasTex(128, 112, (g, w, h) => {
  g.fillStyle = '#1b1f2b'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ffd23f'; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < 3; i++) { const x = 24 + i * 34; g.beginPath(); g.moveTo(x, 22); g.lineTo(x + 26, h / 2); g.lineTo(x, h - 22); g.stroke(); }
  g.lineWidth = 5; g.strokeRect(3, 3, w - 6, h - 6);
});
export const checkTex = canvasTex(64, 16, (g) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 4, j * 4, 4, 4); } });
export const bannerTex = canvasTex(512, 96, (g, w, h) => {
  g.fillStyle = '#12151e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 64; i++) { g.fillStyle = i % 2 ? '#fff' : '#111'; g.fillRect(i * 8, 0, 8, 8); g.fillStyle = i % 2 ? '#111' : '#fff'; g.fillRect(i * 8, h - 8, 8, 8); }
  g.fillStyle = '#ffd23f'; g.font = '56px "Russo One", Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('START · ZIEL', w / 2, h / 2 + 2);
});
export const boxTex = canvasTex(64, 64, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ff6ad5'); gr.addColorStop(0.5, '#ffd23f'); gr.addColorStop(1, '#4fd8ff');
  g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  g.fillStyle = '#fff'; g.font = '44px "Russo One", Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', w / 2, h / 2 + 3);
});
