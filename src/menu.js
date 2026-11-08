import { MOD_NAMES, CHARS, CHAR_SKINS, KARTS, KART_SKINS, TRACKS, faceSvg, hx } from './data.js';
import { S } from './state.js';
import { $, lsGet, fmt, svgIcon, clamp } from './util.js';
import { buildWorld } from './world.js';
import { resetRace } from './cars.js';
import { mpLobbyPresence, mpRender, mp, mpPeers, mpHostGo } from './multiplayer.js';
import { startRace, toMenu, update } from './flow.js';
import { draw } from './draw.js';
import { updateHud } from './hud.js';

/* ---------- Menü ---------- */
export function modText(ch) {
  const up = [], dn = [];
  for (const k in ch.mods) { if (ch.mods[k] > 1.03) up.push(MOD_NAMES[k]); else if (ch.mods[k] < 0.97) dn.push(MOD_NAMES[k]); }
  return (up.length ? 'Plus: ' + up.join(', ') : '') + (up.length && dn.length ? ' · ' : '') + (dn.length ? 'Minus: ' + dn.join(', ') : '');
}
export function renderMenu() {
  const ch = $('#chars'); ch.innerHTML = '';
  CHARS.forEach((c, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chp'; b.setAttribute('aria-pressed', i === S.selChar);
    b.innerHTML = svgIcon(faceSvg(c.id, i === S.selChar ? S.selSkin : 0)) + '<b>' + c.name + '</b>';
    b.addEventListener('click', () => { S.selChar = i; S.selSkin = 0; resetRace(); renderMenu(); });
    ch.appendChild(b);
  });
  const c0 = CHARS[S.selChar];
  $('#charInfo').innerHTML = '<b>' + c0.name + '</b> der ' + c0.kind + '. ' + c0.note + ' ' + modText(c0);
  const sr = $('#skins'); sr.innerHTML = '';
  CHAR_SKINS[c0.id].forEach((k, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sk'; b.setAttribute('aria-pressed', i === S.selSkin); b.setAttribute('aria-label', 'Skin ' + k[0]);
    b.innerHTML = svgIcon(faceSvg(c0.id, i)) + '<small>' + k[0] + '</small>';
    b.addEventListener('click', () => { S.selSkin = i; resetRace(); renderMenu(); });
    sr.appendChild(b);
  });
  const kh = $('#cars'); kh.innerHTML = '';
  KARTS.forEach((d, i) => {
    const rows = [['Tempo', d.max / 160], ['Antritt', d.acc / 76], ['Lenkung', d.turn / 2.4]];
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card'; b.setAttribute('aria-pressed', i === S.selKart); b.style.setProperty('--c', d.css);
    b.innerHTML = '<span class="swatch"></span><h3>' + d.name + '<small>' + d.role + '</small></h3><div class="stats">' +
      rows.map(r => '<div class="stat">' + r[0] + '<span class="bar"><i style="width:' + Math.round(clamp(r[1], 0.1, 1) * 100) + '%"></i></span></div>').join('') + '</div>';
    b.addEventListener('click', () => { S.selKart = i; S.selPaint = 0; resetRace(); renderMenu(); });
    kh.appendChild(b);
  });
  const pr = $('#paints'); pr.innerHTML = '';
  KART_SKINS[KARTS[S.selKart].id].forEach((k, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sk paint'; b.setAttribute('aria-pressed', i === S.selPaint); b.setAttribute('aria-label', 'Lack ' + k[0]);
    b.style.setProperty('--c', hx(k[1])); b.style.setProperty('--c2', hx(k[2]));
    b.innerHTML = '<span class="dot"></span><small>' + k[0] + '</small>';
    b.addEventListener('click', () => { S.selPaint = i; resetRace(); renderMenu(); });
    pr.appendChild(b);
  });
  const th = $('#tracks'); th.innerHTML = '';
  TRACKS.forEach((t, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', i === S.selTrack);
    b.innerHTML = '<b>' + t.name + '</b><small>' + t.info + '</small>';
    b.addEventListener('click', () => { if (i === S.selTrack) return; S.selTrack = i; buildWorld(TRACKS[i]); resetRace(); renderMenu(); });
    th.appendChild(b);
  });
  mpLobbyPresence(); mpRender();
  const bt = lsGet('kurvenjaeger-best-' + TRACKS[S.selTrack].id);
  $('#bestLine').textContent = bt ? 'Bestzeit auf dieser Strecke: ' + fmt(bt) : 'Noch keine Bestzeit auf dieser Strecke';
}
$('#startBtn').addEventListener('click', startRace);
$('#againBtn').addEventListener('click', () => { if (mp.on && mp.active) { const ps = mpPeers(); if (ps.length > 1 && ps[0].isMe && ps[0].sameTab) mpHostGo(); else toMenu(); } else startRace(); });
$('#changeBtn').addEventListener('click', toMenu);

   
S.last = 0;
export function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - S.last) / 1000 || 0.016); S.last = t;
  update(dt); draw(dt); updateHud();
}
