import * as THREE from 'three';
import { S } from './state.js';

export const $ = s => document.querySelector(s);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const TAU = Math.PI * 2;
export const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
export const wrapIdx = d => { if (d > N / 2) d -= N; else if (d < -N / 2) d += N; return d; };
export const app = $('#app'), cv = $('#c'), oc = $('#o'), ctx = oc.getContext('2d');

/* ---------- Daten ---------- */
export let N = 1160;
/* Daten: siehe data.js */

S.renderer = null;
S.camera = null;
S.VW = 0;
S.VH = 0;
S.DPR = 1;
S.state = 'menu';
S.selChar = 0;
S.selKart = 0;
S.selTrack = 0;
S.selSkin = 0;
S.selPaint = 0;
S.mode = 'local';
S.cfg = { humans: 1, bots: 3, diff: 1, mpMax: 4 };
S.hp = [0, 1, 2, 3].map(i => ({ ch: 0, sk: 0, kt: 0, pk: 0 }));
S.humans = [];
S.views = null;
try { S.name = localStorage.getItem('kj-name') || ''; } catch (e) { S.name = ''; }
if (!S.name) S.name = 'Fahrer' + Math.floor(10 + Math.random() * 90);
S.world = null;
S.cars = [];
S.player = null;
S.raceT = 0;
S.countT = 0;
S.finishWait = 0;
S.menuAng = 0;
S.shakeT = 0;
S.flashT = 0;
S.lastCount = -1;
export const btn = { L: false, R: false, drift: false };
export const keys = {};
export const lsGet = k => { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };
export const svgIcon = (inner) => '<svg viewBox="0 0 48 48" aria-hidden="true">' + inner + '</svg>';
export const fmt = t => { if (!t || t < 0) t = 0; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
export const vib = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

export function resize() {
  const r = app.getBoundingClientRect();
  S.VW = r.width; S.VH = r.height;
  S.DPR = Math.min(1.75, window.devicePixelRatio || 1);
  oc.width = Math.round(S.VW * S.DPR); oc.height = Math.round(S.VH * S.DPR);
  if (S.renderer) {
    S.renderer.setPixelRatio(S.DPR); S.renderer.setSize(S.VW, S.VH, false);
    S.camera.aspect = S.VW / S.VH; S.camera.updateProjectionMatrix();
  }
}
addEventListener('resize', resize); resize();
