import { $ } from './util.js';
import { RANKS, LEVELS, MAX_LEVEL, levelName, progressOf, describe, REWARDS, DEFAULT_REWARD_LEVEL, DEFAULT_CFG, getConfig, applyConfig } from './save.js';
import { acct, news, saveSetting, adminList, adminBan, adminSetSave } from './cloud.js';

/* ---------- Admin-Bereich: Spielwerte, Spieler, Belohnungen, Ankündigung ----------
   Die Oberfläche steht nur Konten mit is_admin offen, durchgesetzt wird das aber von den Supabase-Policies (schema.sql). */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const A = { tab: 'game', cfg: null, players: null, msg: '', err: false, busy: false, ann: { text: '', active: false } };
const TABS = [['game', 'Spielwerte'], ['players', 'Spieler'], ['rewards', 'Belohnungen'], ['news', 'Ankündigung']];
const DIFF = ['Leicht', 'Mittel', 'Schwer'];
let el = null;

export function openAdmin() {
  if (!acct.admin) return;
  el = $('#admin'); A.cfg = getConfig(); A.ann = { text: news.text, active: news.active }; A.msg = ''; A.tab = 'game'; A.players = null;
  el.hidden = false; render();
}
const close = () => { el.hidden = true; };
const say = (m, err) => { A.msg = m; A.err = !!err; };

function gameHtml() {
  const c = A.cfg;
  return '<div class="fld"><label>XP-Faktor für alle Spieler</label><input class="txt plain" type="number" step="0.1" min="0.1" max="10" data-f="xpMul" value="' + c.xpMul + '"><p class="hint">1 = Normal, 2 = doppelte XP.</p></div>' +
    '<div class="fld"><label>XP pro Stufe (je Rang 3 Stufen)</label><div class="agrid">' + RANKS.map((r, i) => '<label>' + r.name + '<input class="txt plain" type="number" min="20" step="10" data-f="step:' + i + '" value="' + c.rankSteps[i] + '"></label>').join('') + '</div></div>' +
    '<div class="fld"><label>Stärke der Bots (0.5 bis 1)</label><div class="agrid">' + DIFF.map((d, i) => '<label>' + d + '<input class="txt plain" type="number" min="0.5" max="1" step="0.01" data-f="skill:' + i + '" value="' + c.botSkill[i] + '"></label>').join('') + '</div></div>' +
    '<div class="row"><button type="button" class="cta" data-a="saveCfg">Speichern</button><button type="button" class="ghost" data-a="defCfg">Standardwerte</button></div>';
}
function rewardsHtml() {
  const opts = id => { const cur = A.cfg.rewards[id] !== undefined ? A.cfg.rewards[id] : DEFAULT_REWARD_LEVEL[id]; let o = ''; for (let l = 1; l <= MAX_LEVEL; l++) o += '<option value="' + l + '"' + (l === cur ? ' selected' : '') + '>' + levelName(l) + '</option>'; return o; };
  const ids = Object.keys(DEFAULT_REWARD_LEVEL).sort((a, b) => DEFAULT_REWARD_LEVEL[a] - DEFAULT_REWARD_LEVEL[b]);
  return '<p class="hint">Ab welchem Rang eine Belohnung freigeschaltet wird. Bereits Freigeschaltetes bleibt bei Spielern erhalten.</p><div class="alist">' +
    ids.map(id => { const d = describe(id); return '<label class="arow"><span><b>' + esc(d.name) + '</b><small>' + esc(d.kind.replace(/^Neue[rs]? /, '')) + '</small></span><select data-f="rw:' + id + '">' + opts(id) + '</select></label>'; }).join('') +
    '</div><div class="row"><button type="button" class="cta" data-a="saveCfg">Speichern</button><button type="button" class="ghost" data-a="defRewards">Zurücksetzen</button></div>';
}
function playersHtml() {
  if (!A.players) return '<p class="hint">Lade Spieler …</p>';
  if (!A.players.length) return '<p class="hint">Noch keine Konten.</p>';
  return '<div class="row"><button type="button" class="ghost" data-a="reload">Neu laden</button></div><div class="alist">' + A.players.map(p => {
    const d = p.saves && (Array.isArray(p.saves) ? p.saves[0] : p.saves), p0 = d && d.data && d.data.p0 || {}, xp = p0.xp | 0, pr = progressOf(xp);
    return '<div class="arow col"><span><b>' + esc(p.username) + '</b>' + (p.is_admin ? ' <em>Admin</em>' : '') + (p.banned ? ' <em class="bad">gesperrt</em>' : '') + '<small>' + levelName(pr.level) + ' · ' + xp + ' XP · ' + (p0.races | 0) + ' Rennen · ' + (p0.wins | 0) + ' Siege</small></span>' +
      '<span class="abtn"><button type="button" class="ghost" data-a="xp" data-id="' + p.id + '">XP geben</button><button type="button" class="ghost" data-a="reset" data-id="' + p.id + '">Zurücksetzen</button><button type="button" class="ghost" data-a="ban" data-id="' + p.id + '" data-v="' + (p.banned ? 0 : 1) + '">' + (p.banned ? 'Entsperren' : 'Sperren') + '</button></span></div>';
  }).join('') + '</div>';
}
function newsHtml() {
  return '<div class="fld"><label for="annText">Nachricht im Hauptmenü (höchstens 280 Zeichen)</label><textarea id="annText" class="txt plain" rows="4" maxlength="280" data-f="annText">' + esc(A.ann.text) + '</textarea></div>' +
    '<label class="chk"><input type="checkbox" data-f="annOn"' + (A.ann.active ? ' checked' : '') + '> Anzeigen</label>' +
    '<div class="row"><button type="button" class="cta" data-a="saveNews">Speichern</button></div>';
}
function render() {
  const body = { game: gameHtml, rewards: rewardsHtml, players: playersHtml, news: newsHtml }[A.tab]();
  el.innerHTML = '<div class="menuIn awide"><div class="ahead"><h2 class="ptitle">Admin-Bereich</h2><button type="button" class="ghost" data-a="close">Schließen</button></div>' +
    '<div class="seg atabs">' + TABS.map(t => '<button type="button" data-a="tab" data-t="' + t[0] + '" aria-pressed="' + (A.tab === t[0]) + '">' + t[1] + '</button>').join('') + '</div>' +
    '<p class="amsg' + (A.err ? ' err' : '') + '"' + (A.msg ? '' : ' hidden') + '>' + esc(A.msg) + '</p>' + body + '</div>';
}
async function loadPlayers() {
  try { A.players = await adminList(); say('', false); } catch (e) { A.players = []; say('Spieler konnten nicht geladen werden: ' + e.message, true); }
  if (A.tab === 'players') render();
}
async function guard(fn, ok) {
  if (A.busy) return; A.busy = true;
  try { await fn(); say(ok || 'Gespeichert.', false); } catch (e) { say('Fehler: ' + (e.message || e), true); }
  A.busy = false; render();
}
const rowOf = id => (A.players || []).find(p => p.id === id);
const dataOf = p => { const d = p.saves && (Array.isArray(p.saves) ? p.saves[0] : p.saves); return d && d.data && d.data.p0 ? d.data : { v: 1, p0: { v: 2 } }; };

document.addEventListener('click', e => {
  const t = e.target.closest('#admin [data-a]'); if (!t || !el) return;
  const a = t.dataset.a, id = t.dataset.id;
  if (a === 'close') close();
  else if (a === 'tab') { A.tab = t.dataset.t; say('', false); render(); if (A.tab === 'players' && !A.players) loadPlayers(); }
  else if (a === 'reload') { A.players = null; render(); loadPlayers(); }
  else if (a === 'defCfg') { A.cfg = Object.assign(JSON.parse(JSON.stringify(DEFAULT_CFG)), { rewards: A.cfg.rewards }); render(); }
  else if (a === 'defRewards') { A.cfg.rewards = {}; render(); }
  else if (a === 'saveCfg') guard(async () => { const c = JSON.parse(JSON.stringify(A.cfg)); await saveSetting('game', c); applyConfig(c); A.cfg = getConfig(); try { localStorage.setItem('kj-cfg-v1', JSON.stringify(c)); } catch (x) {} }, 'Gespeichert. Gilt für alle Spieler beim nächsten Start des Spiels.');
  else if (a === 'saveNews') guard(async () => { const v = { text: A.ann.text.slice(0, 280), active: !!A.ann.active }; await saveSetting('announcement', v); news.text = v.text; news.active = v.active && !!v.text; try { localStorage.setItem('kj-ann-v1', JSON.stringify(v)); } catch (x) {} });
  else if (a === 'xp') {
    const p = rowOf(id); if (!p) return; const v = parseInt(window.prompt('Wie viele XP für ' + p.username + ' (negativ = abziehen)?', '100'), 10); if (!Number.isFinite(v)) return;
    guard(async () => { const d = dataOf(p); d.p0.xp = Math.max(0, (d.p0.xp | 0) + v); await adminSetSave(id, d); A.players = await adminList(); }, v + ' XP für ' + p.username + ' gebucht.');
  } else if (a === 'reset') {
    const p = rowOf(id); if (!p || !window.confirm('Fortschritt von ' + p.username + ' wirklich komplett zurücksetzen?')) return;
    guard(async () => { await adminSetSave(id, { v: 1, p0: { v: 2 } }); A.players = await adminList(); }, 'Fortschritt von ' + p.username + ' zurückgesetzt.');
  } else if (a === 'ban') {
    const p = rowOf(id); if (!p) return; const b = t.dataset.v === '1';
    if (b && !window.confirm(p.username + ' sperren? Gesperrte Konten können nicht mehr speichern.')) return;
    guard(async () => { await adminBan(id, b); A.players = await adminList(); }, p.username + (b ? ' gesperrt.' : ' entsperrt.'));
  }
});
/* Eingaben direkt in den Entwurf übernehmen (ohne neu zu zeichnen, damit der Fokus bleibt) */
document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset || !t.dataset.f || !el || el.hidden) return;
  const f = t.dataset.f;
  if (f === 'xpMul') A.cfg.xpMul = parseFloat(t.value) || 1;
  else if (f.startsWith('step:')) A.cfg.rankSteps[+f.slice(5)] = parseInt(t.value, 10) || 20;
  else if (f.startsWith('skill:')) A.cfg.botSkill[+f.slice(6)] = parseFloat(t.value) || 0.8;
  else if (f === 'annText') A.ann.text = t.value;
});
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.f || !el || el.hidden) return;
  const f = t.dataset.f;
  if (f.startsWith('rw:')) { const id = f.slice(3), v = +t.value; if (v === DEFAULT_REWARD_LEVEL[id]) delete A.cfg.rewards[id]; else A.cfg.rewards[id] = v; }
  else if (f === 'annOn') A.ann.active = t.checked;
});
