import { MOD_NAMES, CHARS, CHAR_SKINS, KARTS, KART_SKINS, TRACKS, hx } from './data.js';
import { S } from './state.js';
import { $, lsGet, fmt, clamp } from './util.js';
import { buildWorld } from './world.js';
import { resetRace } from './cars.js';
import { mp, mpPeers, mpHostGo, mpIsHost, mpMax, mpCreate, mpJoin, mpLeave, mpLobbyPresence, MP_ALPHA } from './multiplayer.js';
import { startRace, toMenu, update } from './flow.js';
import { draw } from './draw.js';
import { updateHud } from './hud.js';
import { thumb, setStage, setPreview, clearPreview } from './preview.js';
import { save, resetSave, charOk, kartOk, skinOk, paintOk, unlockHint, ruleOf, unlockedCount, TOTAL, DIFF_NAMES } from './save.js';
import { KEYMAP } from './input.js';
import { sfx } from './audio.js';

/* ---------- Menü: fester Ablauf Hauptmenü → Modus → Einrichtung → Charakter → Kart → Strecke → Übersicht → Start ---------- */
export function modText(ch) {
  const up = [], dn = [];
  for (const k in ch.mods) { if (ch.mods[k] > 1.03) up.push(MOD_NAMES[k]); else if (ch.mods[k] < 0.97) dn.push(MOD_NAMES[k]); }
  return (up.length ? 'Plus: ' + up.join(', ') : '') + (up.length && dn.length ? ' · ' : '') + (dn.length ? 'Minus: ' + dn.join(', ') : '');
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LOCK = '<svg class="lk" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const ICONS = {
  mp: '<svg viewBox="0 0 48 48"><circle cx="17" cy="17" r="7"/><circle cx="33" cy="19" r="6"/><path d="M5 40c0-8 5-13 12-13s12 5 12 13M29 30c6-2 14 1 14 10"/></svg>',
  local: '<svg viewBox="0 0 48 48"><rect x="6" y="14" width="36" height="22" rx="8"/><path d="M16 20v10M11 25h10"/><circle cx="31" cy="22" r="2.2"/><circle cx="36" cy="28" r="2.2"/></svg>',
  trial: '<svg viewBox="0 0 48 48"><circle cx="24" cy="27" r="14"/><path d="M24 27V18M20 7h8M24 7v6M37 14l3-3"/></svg>',
  settings: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="7"/><path d="M24 5v7M24 36v7M5 24h7M36 24h7M10.5 10.5l5 5M32.5 32.5l5 5M10.5 37.5l5-5M32.5 15.5l5-5"/></svg>'
};
const MODES = [
  { id: 'mp', name: 'Mehrspieler', sub: 'Online mit Freunden' },
  { id: 'local', name: 'Lokales Spiel', sub: 'Gegen Bots und/oder mit Freunden am selben Gerät' },
  { id: 'trial', name: 'Zeitrennen', sub: 'Allein gegen die Uhr, ohne Gegner' },
  { id: 'settings', name: 'Einstellungen', sub: 'Ton, Name und Fortschritt' }
];

/* ----- Zustand ----- */
const M = { i: 0, sel: 'local', settings: false, msg: '', confirm: false, fc: null, dir: '' };
const PREF = 'kj-prefs-v1';
S.hp[0] = { ch: 0, sk: 0, kt: 0, pk: 0 }; S.hp[1] = { ch: 1, sk: 0, kt: 0, pk: 0 }; S.hp[2] = { ch: 0, sk: 0, kt: 0, pk: 0 }; S.hp[3] = { ch: 1, sk: 0, kt: 0, pk: 0 };
function syncP1() { const h = S.hp[0]; S.selChar = h.ch; S.selSkin = h.sk; S.selKart = h.kt; S.selPaint = h.pk; }
function savePrefs() { try { localStorage.setItem(PREF, JSON.stringify({ hp: S.hp, cfg: S.cfg, mode: S.mode, track: S.selTrack, sel: M.sel })); } catch (e) {} }
function sanitize() {
  for (const h of S.hp) {
    h.ch = clamp(h.ch | 0, 0, CHARS.length - 1); h.kt = clamp(h.kt | 0, 0, KARTS.length - 1);
    if (!charOk(h.ch)) { h.ch = 0; h.sk = 0; } if (!skinOk(h.ch, h.sk)) h.sk = 0;
    if (!kartOk(h.kt)) { h.kt = 0; h.pk = 0; } if (!paintOk(h.kt, h.pk)) h.pk = 0;
  }
  S.cfg.humans = clamp(S.cfg.humans | 0, 1, 4); S.cfg.diff = clamp(S.cfg.diff | 0, 0, 2); S.cfg.mpMax = clamp(S.cfg.mpMax | 0, 2, 8);
  S.cfg.bots = clamp(S.cfg.bots | 0, S.cfg.humans === 1 ? 1 : 0, 8 - S.cfg.humans);
  syncP1();
}
(function loadPrefs() {
  try {
    const o = JSON.parse(localStorage.getItem(PREF) || 'null');
    if (o) {
      if (Array.isArray(o.hp)) o.hp.slice(0, 4).forEach((h, i) => Object.assign(S.hp[i], { ch: h.ch | 0, sk: h.sk | 0, kt: h.kt | 0, pk: h.pk | 0 }));
      if (o.cfg) Object.assign(S.cfg, o.cfg);
      if (['mp', 'local', 'trial'].includes(o.mode)) S.mode = o.mode;
      if (o.sel && MODES.some(m => m.id === o.sel)) M.sel = o.sel;
      if (Number.isInteger(o.track) && TRACKS[o.track]) S.selTrack = o.track;
    }
  } catch (e) {}
  sanitize();
})();

/* ----- Ablauf ----- */
function flow() {
  const f = [{ id: 'main' }];
  if (S.mode === 'mp') f.push({ id: 'mp' }); else if (S.mode === 'local') f.push({ id: 'local' });
  const n = S.mode === 'local' ? S.cfg.humans : 1;
  for (let i = 0; i < n; i++) f.push({ id: 'char', pi: i }, { id: 'kart', pi: i });
  if (!(S.mode === 'mp' && mp.on && !mpIsHost())) f.push({ id: 'track' });
  f.push({ id: 'sum' });
  return f;
}
const cur = () => M.settings ? { id: 'settings' } : flow()[Math.min(M.i, flow().length - 1)];
const lastIdx = () => flow().length - 1;

function canNext() {
  const c = cur();
  if (c.id === 'settings') return false;
  if (c.id === 'mp') return mp.on;
  if (c.id === 'sum' && S.mode === 'mp') return mp.on && mpIsHost() && mpPeers().length >= 2;
  return true;
}
function go(dir) {
  const f = flow(), c = cur();
  M.dir = dir > 0 ? 'fwd' : 'back'; M.confirm = false; M.msg = '';
  if (dir > 0) {
    if (!canNext()) return;
    if (c.id === 'main') {
      if (M.sel === 'settings') { M.settings = true; }
      else { S.mode = M.sel; M.i = 1; }
    } else if (c.id === 'sum') { launch(); return; }
    else M.i = Math.min(f.length - 1, M.i + 1);
  } else {
    if (c.id === 'settings') M.settings = false;
    else if (M.i > 0) { if (c.id === 'mp' && mp.on) mpLeave(); M.i--; }
    else return;
  }
  savePrefs(); show();
}
function launch() {
  savePrefs();
  if (S.mode === 'mp') { mpHostGo(); return; }
  startRace();
}
export function jumpTo(id, pi) {
  const f = flow(), k = f.findIndex(s => s.id === id && (pi === undefined || s.pi === pi));
  if (k < 0) return; M.i = k; M.dir = 'back'; show();
}

/* ----- Seiten ----- */
const seg = (k, vals, curV, labels) => '<div class="seg" role="group">' + vals.map((v, i) => '<button type="button" data-a="cfg" data-k="' + k + '" data-v="' + v + '" aria-pressed="' + (v === curV) + '">' + (labels ? labels[i] : v) + '</button>').join('') + '</div>';
const short = id => { const r = ruleOf(id); if (!r) return ''; return r.type === 'races' ? r.n + ' Rennen' : r.type === 'wins' ? r.n + (r.n === 1 ? ' Sieg' : ' Siege') : r.type === 'podiums' ? r.n + ' Podien' : r.n + ' Punkte'; };
const stageEl = (extra) => '<div class="stage live' + (extra ? ' ' + extra : '') + '" id="stage"></div>';

function lobbyHtml() {
  const ps = mpPeers(), mx = mpMax();
  const rows = ps.map((p, i) => {
    const r = p.presence, ch = CHARS[r.ch | 0] || CHARS[0], kt = KARTS[r.kt | 0] || KARTS[0], out = i >= mx;
    return '<li class="' + (out ? 'out' : '') + '"><span class="lb">' + (i === 0 ? '★' : i + 1) + '</span><b>' + esc(String(r.n).slice(0, 12)) + (p.isMe && p.sameTab ? ' (du)' : '') + '</b><small>' + ch.name + ' · ' + kt.name + (out ? ' · Raum voll' : '') + '</small></li>';
  }).join('');
  return '<div class="lobby"><div class="lobbyHead"><span>Raum-Code</span><b class="code">' + esc(mp.code) + '</b></div>' +
    '<p class="hint">Schick den Code an deine Freunde. Sie öffnen dasselbe Spiel und treten mit dem Code bei. <b>' + Math.min(ps.length, mx) + ' / ' + mx + '</b> Plätze belegt (★ = Gastgeber).</p><ul class="plist">' + rows + '</ul></div>';
}

function pageMain() {
  return '<section class="page solo"><div class="stage" aria-hidden="true"></div><div class="panel">' +
    '<p class="lead">Drei Runden in einem Themenpark im Himmel. Weiche Kühen, Pfützen und Enten aus, sammle Item-Würfel und spring mit dem Fallschirm über die Abgründe.</p>' +
    '<div class="modes">' + MODES.map(m => '<button type="button" class="mode" data-a="mode" data-m="' + m.id + '" aria-pressed="' + (M.sel === m.id) + '">' + ICONS[m.id] + '<span><b>' + m.name + '</b><small>' + m.sub + '</small></span></button>').join('') + '</div>' +
    '<p class="best">Freigeschaltet: ' + unlockedCount() + ' von ' + TOTAL + ' · ' + save.points + ' Punkte · ' + save.races + ' Rennen</p></div></section>';
}
function pageLocal() {
  const c = S.cfg, maxBots = 8 - c.humans, minBots = c.humans === 1 ? 1 : 0;
  let keys = '';
  if (c.humans > 1) keys = '<div class="keys"><h3>Tastenbelegung (geteilter Bildschirm)</h3>' + Array.from({ length: c.humans }, (_, i) => '<p><b>Spieler ' + (i + 1) + '</b> ' + KEYMAP[i].hint + '</p>').join('') + '</div>';
  return '<section class="page solo"><div class="stage" aria-hidden="true"></div><div class="panel">' +
    '<h2 class="ptitle">Lokales Spiel</h2>' +
    '<div class="fld"><label>Menschliche Spieler</label>' + seg('humans', [1, 2, 3, 4], c.humans) + '<p class="hint">' + (c.humans === 1 ? 'Du fährst allein, gesteuert per Touch oder Tastatur.' : 'Geteilter Bildschirm. Jeder wählt später Charakter und Kart.') + '</p></div>' + keys +
    '<div class="fld"><label>Bots</label><div class="step"><button type="button" class="ghost" data-a="bots" data-d="-1" ' + (c.bots <= minBots ? 'disabled' : '') + ' aria-label="Weniger Bots">−</button><b id="botN">' + c.bots + '</b><button type="button" class="ghost" data-a="bots" data-d="1" ' + (c.bots >= maxBots ? 'disabled' : '') + ' aria-label="Mehr Bots">+</button></div><p class="hint">Insgesamt ' + (c.humans + c.bots) + ' Fahrer am Start (höchstens 8).</p></div>' +
    '<div class="fld"><label>Schwierigkeit der Bots</label>' + seg('diff', [0, 1, 2], c.diff, DIFF_NAMES) + '<p class="hint">' + ['Entspannt fahren, wenig Bonus-Punkte.', 'Ausgewogen, ein paar Bonus-Punkte.', 'Harte Gegner, die meisten Bonus-Punkte.'][c.diff] + '</p></div>' +
    '</div></section>';
}
function pageMp() {
  let body;
  if (!mp.on) {
    body = '<div class="fld"><label for="mpName">Dein Name</label><input id="mpName" class="txt plain" data-in="name" maxlength="12" value="' + esc(S.name) + '" autocomplete="off"></div>' +
      '<div class="box"><h3>Raum erstellen</h3><label>Spieleranzahl (mit dir)</label>' + seg('mpMax', [2, 3, 4, 5, 6, 7, 8], S.cfg.mpMax) + '<button type="button" class="cta" data-a="mpCreate">Raum erstellen</button></div>' +
      '<div class="box"><h3>Raum beitreten</h3><div class="row"><input class="txt" id="mpCode" data-in="code" maxlength="6" placeholder="Raum-Code" aria-label="Raum-Code" autocapitalize="characters" autocomplete="off"><button type="button" class="ghost" data-a="mpJoin">Beitreten</button></div></div>' +
      '<p class="hint err" id="mpMsg">' + esc(M.msg) + '</p>';
  } else {
    body = lobbyHtml() + '<button type="button" class="ghost" data-a="mpLeave">Raum verlassen</button><p class="hint">Weiter geht es mit Charakter und Kart, sobald du bereit bist. Gestartet wird auf der letzten Seite.</p>';
  }
  return '<section class="page solo"><div class="stage" aria-hidden="true"></div><div class="panel"><h2 class="ptitle">Mehrspieler</h2>' + body + '</div></section>';
}
const who = pi => S.mode === 'local' && S.cfg.humans > 1 ? 'Spieler ' + (pi + 1) + ' · ' : '';

function charTile(i, h) {
  const ok = charOk(i), id = 'char:' + CHARS[i].id, f = M.fc.ch === i;
  return '<button type="button" class="tile' + (ok ? '' : ' locked') + (f ? ' focus' : '') + '" data-a="char" data-i="' + i + '" aria-pressed="' + (h.ch === i) + '"><img alt="" src="' + thumb({ pv: 'char', ch: i, sk: 0 }) + '"><b>' + CHARS[i].name + '</b>' + (ok ? '' : LOCK + '<small>' + short(id) + '</small>') + '</button>';
}
function pageChar(pi) {
  const h = S.hp[pi], ci = M.fc.ch, c0 = CHARS[ci], chOk = charOk(ci);
  const skins = CHAR_SKINS[c0.id].map((k, i) => {
    const ok = chOk && skinOk(ci, i), id = 'skin:' + c0.id + ':' + i;
    return '<button type="button" class="tile sm' + (ok ? '' : ' locked') + (M.fc.sk === i ? ' focus' : '') + '" data-a="skin" data-i="' + i + '" aria-pressed="' + (h.ch === ci && h.sk === i) + '"><img alt="" src="' + thumb({ pv: 'char', ch: ci, sk: i }) + '"><b>' + k[0] + '</b>' + (ok ? '' : LOCK + '<small>' + (chOk ? short(id) : 'Charakter') + '</small>') + '</button>';
  }).join('');
  let lockMsg = '';
  if (!chOk) lockMsg = 'Gesperrt: ' + unlockHint('char:' + c0.id);
  else if (!skinOk(ci, M.fc.sk)) lockMsg = 'Gesperrt: ' + unlockHint('skin:' + c0.id + ':' + M.fc.sk);
  return '<section class="page">' + stageEl() + '<div class="panel"><h2 class="ptitle">' + who(pi) + 'Charakter</h2>' +
    '<div class="grid5">' + CHARS.map((c, i) => charTile(i, h)).join('') + '</div>' +
    '<p class="info"><b>' + c0.name + '</b> der ' + c0.kind + '. ' + c0.note + ' ' + modText(c0) + '</p>' +
    '<h3 class="sec">Skin</h3><div class="grid3">' + skins + '</div>' +
    '<p class="lockmsg" id="lockMsg"' + (lockMsg ? '' : ' hidden') + '>' + LOCK + '<span>' + esc(lockMsg) + '</span></p></div></section>';
}
function pageKart(pi) {
  const h = S.hp[pi], ki = M.fc.kt, d0 = KARTS[ki], kOk = kartOk(ki);
  const cards = KARTS.map((d, i) => {
    const ok = kartOk(i), rows = [['Tempo', d.max / 160], ['Antritt', d.acc / 76], ['Lenkung', d.turn / 2.4]];
    return '<button type="button" class="card' + (ok ? '' : ' locked') + (ki === i ? ' focus' : '') + '" style="--c:' + d.css + '" data-a="kart" data-i="' + i + '" aria-pressed="' + (h.kt === i) + '"><img alt="" src="' + thumb({ pv: 'kart', kt: i, pk: 0 }) + '"><span class="ct"><h3>' + d.name + '<small>' + d.role + '</small></h3><span class="stats">' +
      rows.map(r => '<span class="stat">' + r[0] + '<span class="bar"><i style="width:' + Math.round(clamp(r[1], 0.1, 1) * 100) + '%"></i></span></span>').join('') + '</span></span>' + (ok ? '' : LOCK + '<small class="lt">' + short('kart:' + d.id) + '</small>') + '</button>';
  }).join('');
  const paints = KART_SKINS[d0.id].map((k, i) => {
    const ok = kOk && paintOk(ki, i), id = 'paint:' + d0.id + ':' + i;
    return '<button type="button" class="tile sm' + (ok ? '' : ' locked') + (M.fc.pk === i ? ' focus' : '') + '" data-a="paint" data-i="' + i + '" aria-pressed="' + (h.kt === ki && h.pk === i) + '"><img alt="" src="' + thumb({ pv: 'kart', kt: ki, pk: i }) + '"><b>' + k[0] + '</b>' + (ok ? '' : LOCK + '<small>' + (kOk ? short(id) : 'Kart') + '</small>') + '</button>';
  }).join('');
  let lockMsg = '';
  if (!kOk) lockMsg = 'Gesperrt: ' + unlockHint('kart:' + d0.id);
  else if (!paintOk(ki, M.fc.pk)) lockMsg = 'Gesperrt: ' + unlockHint('paint:' + d0.id + ':' + M.fc.pk);
  return '<section class="page">' + stageEl() + '<div class="panel"><h2 class="ptitle">' + who(pi) + 'Kart</h2>' +
    '<div class="cards">' + cards + '</div><h3 class="sec">Lack</h3><div class="grid3">' + paints + '</div>' +
    '<p class="lockmsg" id="lockMsg"' + (lockMsg ? '' : ' hidden') + '>' + LOCK + '<span>' + esc(lockMsg) + '</span></p></div></section>';
}
function pageTrack() {
  return '<section class="page"><div class="stage" aria-hidden="true"></div><div class="panel"><h2 class="ptitle">Strecke</h2><div class="tracks">' + TRACKS.map((t, i) => {
    const bt = lsGet('kurvenjaeger-best-' + t.id), tt = lsGet('kurvenjaeger-tt-' + t.id), tags = [t.gaps + ' Abgründe'].concat(t.loop ? ['Looping'] : []);
    return '<button type="button" class="trk" data-a="track" data-i="' + i + '" aria-pressed="' + (i === S.selTrack) + '"><canvas width="300" height="170" data-t="' + i + '"></canvas><span class="tt"><b>' + t.name + '</b><small>' + t.info + '</small><span class="tags">' + tags.map(g => '<i>' + g + '</i>').join('') + '</span><small>' + (bt ? 'Bestzeit Rennen: ' + fmt(bt) : 'Noch keine Rennzeit') + (tt ? ' · Zeitrennen: ' + fmt(tt) : '') + '</small></span></button>';
  }).join('') + '</div></div></section>';
}
function pageSum() {
  const ps = mpPeers(), host = ps[0], tIdx = S.mode === 'mp' && mp.on && host && !mpIsHost() ? clamp(host.presence.tr | 0, 0, TRACKS.length - 1) : S.selTrack, t = TRACKS[tIdx];
  const n = S.mode === 'local' ? S.cfg.humans : 1;
  let rows = '';
  for (let i = 0; i < n; i++) {
    const h = S.hp[i], c = CHARS[h.ch], k = KARTS[h.kt];
    rows += '<div class="srow"><div class="si"><img alt="" src="' + thumb({ pv: 'char', ch: h.ch, sk: h.sk }) + '"><img alt="" src="' + thumb({ pv: 'kart', kt: h.kt, pk: h.pk }) + '"></div><div class="st"><small>' + (n > 1 ? 'Spieler ' + (i + 1) : 'Dein Fahrer') + '</small><b>' + c.name + ' · ' + k.name + '</b><span>Skin ' + CHAR_SKINS[c.id][h.sk][0] + ' · Lack ' + KART_SKINS[k.id][h.pk][0] + '</span></div><button type="button" class="lnk" data-a="goto" data-s="char" data-p="' + i + '">Ändern</button></div>';
  }
  const mode = S.mode === 'mp' ? 'Mehrspieler' : S.mode === 'trial' ? 'Zeitrennen' : 'Lokales Spiel';
  let opp;
  if (S.mode === 'local') opp = '<div class="srow"><div class="st"><small>Gegner</small><b>' + (S.cfg.bots ? S.cfg.bots + (S.cfg.bots === 1 ? ' Bot' : ' Bots') + ' · ' + DIFF_NAMES[S.cfg.diff] : 'Keine Bots') + '</b><span>' + (S.cfg.humans > 1 ? S.cfg.humans + ' Spieler am geteilten Bildschirm' : 'Du fährst allein gegen die Bots') + '</span></div><button type="button" class="lnk" data-a="goto" data-s="local">Ändern</button></div>';
  else if (S.mode === 'trial') opp = '<div class="srow"><div class="st"><small>Gegner</small><b>Keine</b><span>Du fährst gegen die Uhr, Item-Würfel sind aus.</span></div></div>';
  else opp = '<div class="srow col"><div class="st"><small>Raum</small><b>Raum ' + esc(mp.code) + '</b></div>' + lobbyHtml() + '</div>';
  const tr = '<div class="srow"><div class="si"><canvas width="300" height="170" data-t="' + tIdx + '"></canvas></div><div class="st"><small>Strecke</small><b>' + t.name + '</b><span>' + t.info + '</span></div>' + (S.mode === 'mp' && !mpIsHost() ? '' : '<button type="button" class="lnk" data-a="goto" data-s="track">Ändern</button>') + '</div>';
  let foot = '';
  if (S.mode === 'mp') foot = '<p class="hint">' + (!mp.on ? 'Du bist in keinem Raum.' : ps.length < 2 ? 'Warte auf Mitspieler …' : mpIsHost() ? 'Alle da? Dann starte das Rennen für alle.' : 'Der Gastgeber (★) startet das Rennen. Die Strecke bestimmt er.') + '</p>';
  return '<section class="page">' + stageEl('track') + '<div class="panel"><h2 class="ptitle">Rennübersicht</h2><div class="srow"><div class="st"><small>Modus</small><b>' + mode + '</b></div><button type="button" class="lnk" data-a="goto" data-s="main">Ändern</button></div>' + rows + opp + tr + foot + '</div></section>';
}
function pageSettings() {
  return '<section class="page solo"><div class="stage" aria-hidden="true"></div><div class="panel"><h2 class="ptitle">Einstellungen</h2>' +
    '<div class="fld"><label>Ton</label><div class="seg"><button type="button" data-a="mute" data-v="0" aria-pressed="' + !sfx.muted() + '">Ton an</button><button type="button" data-a="mute" data-v="1" aria-pressed="' + sfx.muted() + '">Ton aus</button></div></div>' +
    '<div class="fld"><label for="setName">Spielername (für Mehrspieler)</label><input id="setName" class="txt plain" data-in="name" maxlength="12" value="' + esc(S.name) + '" autocomplete="off"></div>' +
    '<div class="fld"><label>Fortschritt</label><p class="info">' + unlockedCount() + ' von ' + TOTAL + ' Inhalten freigeschaltet · ' + save.races + ' Rennen · ' + save.wins + ' Siege · ' + save.points + ' Punkte</p>' +
    '<button type="button" class="ghost danger" data-a="reset">' + (M.confirm ? 'Wirklich alles löschen? Nochmal tippen' : 'Fortschritt zurücksetzen') + '</button></div></div></section>';
}

/* ----- Streckenvorschau (aus der Streckenform gezeichnet) ----- */
function drawTrack(cv, def) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, def.sky[0]); gr.addColorStop(1, def.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const pts = []; let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (let i = 0; i < 240; i++) { const t = i / 240 * Math.PI * 2, r = def.f(t); const x = Math.cos(t) * r, z = Math.sin(t) * r; pts.push([x, z]); minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
  const sc = Math.min((W - 60) / (maxx - minx), (H - 44) / (maxz - minz)), ox = (W - (maxx - minx) * sc) / 2 - minx * sc, oy = (H - (maxz - minz) * sc) / 2 - minz * sc;
  const P = pts.map(p => [ox + p[0] * sc, oy + p[1] * sc]);
  const path = () => { g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
  g.lineJoin = 'round'; g.lineCap = 'round';
  path(); g.lineWidth = 56; g.strokeStyle = def.top; g.stroke(); g.fillStyle = def.top; g.fill();
  g.save(); g.translate(0, 7); path(); g.lineWidth = 56; g.strokeStyle = def.cliff[0]; g.globalCompositeOperation = 'destination-over'; g.stroke(); g.restore();
  g.globalCompositeOperation = 'source-over';
  path(); g.lineWidth = 26; g.strokeStyle = hx(def.curb[0]); g.stroke();
  path(); g.lineWidth = 20; g.strokeStyle = '#2b3040'; g.stroke();
  path(); g.lineWidth = 2.5; g.setLineDash([9, 9]); g.strokeStyle = 'rgba(255,255,255,.8)'; g.stroke(); g.setLineDash([]);
  const a = P[0], b = P[3];
  g.save(); g.translate(a[0], a[1]); g.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2); g.fillStyle = '#fff'; g.fillRect(-11, -2, 22, 4); g.fillStyle = '#111'; g.fillRect(-11, -2, 5.5, 2); g.fillRect(0, -2, 5.5, 2); g.restore();
}
function drawTrackCanvases() { document.querySelectorAll('#page canvas[data-t]').forEach(cv => drawTrack(cv, TRACKS[+cv.dataset.t])); }

/* ----- Anzeige ----- */
function backdrop() { buildWorld(TRACKS[S.selTrack]); resetRace(); }
const KICK = { main: 'Hauptmenü', mp: 'Mehrspieler', local: 'Lokales Spiel', char: 'Charakterauswahl', kart: 'Autoauswahl', track: 'Streckenauswahl', sum: 'Rennübersicht', settings: 'Einstellungen' };
function focusFor(c) {
  const h = S.hp[c.pi | 0];
  M.fc = { ch: h.ch, sk: h.sk, kt: h.kt, pk: h.pk };
}
function updatePreview() {
  const c = cur(), el = $('#stage.live');
  if (!el || (c.id !== 'char' && c.id !== 'kart')) { clearPreview(); return; }
  const h = S.hp[c.pi | 0];
  setStage(el);
  if (c.id === 'char') setPreview({ pv: 'char', ch: M.fc.ch, sk: M.fc.sk });
  else setPreview({ pv: 'kart', kt: M.fc.kt, pk: M.fc.pk, drv: { ch: h.ch, sk: h.sk } });
}
function setNav() {
  const f = flow(), c = cur(), back = $('#navBack'), next = $('#navNext');
  back.disabled = !M.settings && M.i === 0; back.hidden = false;
  let label = 'Weiter';
  if (c.id === 'sum') label = S.mode === 'mp' ? (mpIsHost() ? 'Gemeinsam starten' : 'Warte auf Gastgeber') : 'Rennen starten';
  next.textContent = label; next.disabled = !canNext(); next.hidden = c.id === 'settings';
  $('#navStep').textContent = c.id === 'settings' ? '' : 'Schritt ' + (Math.min(M.i, f.length - 1) + 1) + ' von ' + f.length;
}
export function show(anim) {
  const c = cur(), pg = $('#page'), top = $('.mscroll');
  if (c.id === 'char' || c.id === 'kart') { if (!M.fc || M.fcFor !== c.id + (c.pi | 0)) { focusFor(c); M.fcFor = c.id + (c.pi | 0); } } else M.fcFor = '';
  if (c.id === 'char' || c.id === 'kart') sanitize();
  if (c.id === 'main' || c.id === 'track' || c.id === 'sum') { if (anim !== false) backdrop(); }
  const html = { main: pageMain, mp: pageMp, local: pageLocal, char: () => pageChar(c.pi), kart: () => pageKart(c.pi), track: pageTrack, sum: pageSum, settings: pageSettings }[c.id]();
  const keep = anim === false ? top.scrollTop : 0;
  pg.innerHTML = html;
  if (anim !== false) { pg.className = ''; void pg.offsetWidth; pg.className = 'in-' + (M.dir || 'fwd'); }
  top.scrollTop = keep;
  $('#mKicker').textContent = KICK[c.id];
  if (c.id === 'track' || c.id === 'sum') drawTrackCanvases();
  updatePreview(); setNav();
  mpLobbyPresence();
}
export function renderMenu(reset) {
  if (reset) { M.settings = false; M.dir = 'back'; M.i = S.mode === 'mp' && mp.on ? lastIdx() : 0; }
  show();
}

/* ----- Klicks ----- */
function act(a, d) {
  const c = cur();
  if (a === 'mode') { if (M.sel === d.m) { go(1); return; } M.sel = d.m; document.querySelectorAll('.mode').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === d.m)); savePrefs(); return; }
  if (a === 'cfg') {
    const v = +d.v;
    if (d.k === 'humans') { S.cfg.humans = v; sanitize(); show(false); }
    else if (d.k === 'diff') { S.cfg.diff = v; show(false); }
    else if (d.k === 'mpMax') { S.cfg.mpMax = v; document.querySelectorAll('[data-k="mpMax"]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === v)); }
    savePrefs(); return;
  }
  if (a === 'bots') { S.cfg.bots += +d.d; sanitize(); show(false); savePrefs(); return; }
  if (a === 'char') {
    const i = +d.i, h = S.hp[c.pi | 0]; M.fc.ch = i; M.fc.sk = h.ch === i ? h.sk : 0;
    if (charOk(i)) { if (h.ch !== i) { h.ch = i; h.sk = 0; } M.fc.sk = h.sk; syncP1(); }
    show(false); return;
  }
  if (a === 'skin') {
    const i = +d.i, h = S.hp[c.pi | 0]; M.fc.sk = i;
    if (charOk(M.fc.ch) && skinOk(M.fc.ch, i)) { h.ch = M.fc.ch; h.sk = i; syncP1(); }
    show(false); return;
  }
  if (a === 'kart') {
    const i = +d.i, h = S.hp[c.pi | 0]; M.fc.kt = i; M.fc.pk = h.kt === i ? h.pk : 0;
    if (kartOk(i)) { if (h.kt !== i) { h.kt = i; h.pk = 0; } M.fc.pk = h.pk; syncP1(); }
    show(false); return;
  }
  if (a === 'paint') {
    const i = +d.i, h = S.hp[c.pi | 0]; M.fc.pk = i;
    if (kartOk(M.fc.kt) && paintOk(M.fc.kt, i)) { h.kt = M.fc.kt; h.pk = i; syncP1(); }
    show(false); return;
  }
  if (a === 'track') {
    const i = +d.i; if (i !== S.selTrack) { S.selTrack = i; buildWorld(TRACKS[i]); resetRace(); savePrefs(); }
    document.querySelectorAll('.trk').forEach(b => b.setAttribute('aria-pressed', +b.dataset.i === i)); return;
  }
  if (a === 'goto') { if (d.s === 'main') { M.i = 0; M.dir = 'back'; show(); } else jumpTo(d.s, d.p === undefined ? undefined : +d.p); return; }
  if (a === 'mpCreate') { M.msg = 'Raum wird erstellt …'; show(false); mp.max = S.cfg.mpMax; mpCreate(S.cfg.mpMax).then(err => { M.msg = err; show(false); }); return; }
  if (a === 'mpJoin') { const code = ($('#mpCode').value || ''); M.msg = 'Verbinde …'; const m = $('#mpMsg'); if (m) m.textContent = M.msg; mpJoin(code).then(err => { M.msg = err; show(false); }); return; }
  if (a === 'mpLeave') { mpLeave().then(() => show(false)); return; }
  if (a === 'mute') { sfx.init(); sfx.set(d.v !== '1'); show(false); return; }
  if (a === 'reset') { if (!M.confirm) { M.confirm = true; show(false); return; } resetSave(); M.confirm = false; sanitize(); show(false); return; }
}
$('#page').addEventListener('click', e => {
  const t = e.target.closest('[data-a]'); if (!t || t.disabled) return;
  act(t.dataset.a, t.dataset);
});
$('#page').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.in === 'name') { S.name = t.value.slice(0, 12); try { localStorage.setItem('kj-name', S.name); } catch (x) {} }
  if (t.dataset.in === 'code') t.value = t.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});
$('#page').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.in === 'code') act('mpJoin', {}); });
$('#navBack').addEventListener('click', () => go(-1));
$('#navNext').addEventListener('click', () => go(1));
addEventListener('keydown', e => {
  if (S.state !== 'menu' || e.target.tagName === 'INPUT') return;
  if (e.key === 'Escape') go(-1);
});
/* Mehrspieler-Änderungen (Mitspieler kommen/gehen) aktualisieren Lobby und Start-Schaltfläche */
export function initMenu() { mp.onChange = menuMpChanged; }
function menuMpChanged() {
  if (S.state !== 'menu') return;
  const c = cur();
  if (c.id === 'mp' && !mp.on && M.msg === '') return;
  if (c.id === 'mp' || c.id === 'sum') show(false); else setNav();
}
setInterval(() => { if (S.state === 'menu') mpLobbyPresence(); }, 1000);

/* Ergebnis- und Belohnungsseiten: Weitere Schaltflächen (rwBtn siehe rewards.js) */
$('#againBtn').addEventListener('click', () => { if (mp.on && mp.active) { if (mpIsHost() && mpPeers().length > 1) mpHostGo(); else toMenu(); } else startRace(); });
$('#changeBtn').addEventListener('click', toMenu);

S.last = 0;
export function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - S.last) / 1000 || 0.016); S.last = t;
  update(dt); draw(dt); updateHud();
}
