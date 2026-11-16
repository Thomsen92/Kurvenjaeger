import { CHARS, KARTS, CHAR_SKINS, KART_SKINS } from './data.js';

/* ---------- Spielstand: Erfahrungspunkte (XP), Ränge und Belohnungen ----------
   Jeder lokale Spielerplatz (0 bis 3) besitzt ein eigenes Profil im localStorage.
   Online liegt der Fortschritt ohnehin nur im Browser des jeweiligen Spielers;
   Mitspieler im Raum bekommen nie Daten von hier und beeinflussen den eigenen Stand nicht. */
const KEY = 'kurvenjaeger-save-v2-p';
const OLD_KEY = 'kurvenjaeger-save-v1';
export const SLOTS = 4;

const fresh = () => ({ v: 2, xp: 0, races: 0, wins: 0, podiums: 0, drifts: 0, jumps: 0, unlocked: {}, tracksDone: {}, chal: {} });

/* ----- Ränge: 6 Ränge mit je 3 Stufen (I bis III) ----- */
export const RANKS = [
  { id: 'bronze', name: 'Bronze', color: '#cd7f32', hi: '#f0b070', step: 150 },
  { id: 'silber', name: 'Silber', color: '#b4bfcc', hi: '#eef3f8', step: 250 },
  { id: 'gold', name: 'Gold', color: '#ffc928', hi: '#fff0a0', step: 400 },
  { id: 'platin', name: 'Platin', color: '#4fd8c0', hi: '#c8fff4', step: 600 },
  { id: 'diamant', name: 'Diamant', color: '#4fb4ff', hi: '#d4f0ff', step: 850 },
  { id: 'meister', name: 'Meister', color: '#d05cff', hi: '#ffd2ff', step: 1200 }
];
const TIERS = ['I', 'II', 'III'];
export const LEVELS = [];          // { rank, tier, start }: ab start XP erreicht
{ let xp = 0; for (let r = 0; r < RANKS.length; r++) for (let t = 0; t < 3; t++) { LEVELS.push({ rank: r, tier: t, start: xp }); xp += RANKS[r].step; } }
export const MAX_LEVEL = LEVELS.length - 1;
export const levelName = l => RANKS[LEVELS[l].rank].name + ' ' + TIERS[LEVELS[l].tier];
export const levelOf = xp => { let l = 0; while (l < MAX_LEVEL && xp >= LEVELS[l + 1].start) l++; return l; };
/* Fortschritt in der aktuellen Stufe: { level, into, need, frac, left } (need = 0 auf der höchsten Stufe) */
export function progressOf(xp) {
  const level = levelOf(xp);
  if (level >= MAX_LEVEL) return { level, into: xp - LEVELS[level].start, need: 0, frac: 1, left: 0 };
  const need = LEVELS[level + 1].start - LEVELS[level].start, into = xp - LEVELS[level].start;
  return { level, into, need, frac: Math.min(1, into / need), left: need - into };
}

/* ----- Belohnungen je Stufe. Ids: char:<id>, kart:<id>, skin:<charId>:<n>, paint:<kartId>:<n>, cos:<id> ----- */
export const COSMETICS = [
  { id: 'flag', name: 'Wimpel', note: 'Ein wehender Wimpel am Heck.' },
  { id: 'halo', name: 'Heiligenschein', note: 'Ein leuchtender Ring über dem Fahrer.' },
  { id: 'crown', name: 'Goldkrone', note: 'Die Krone der Meister.' }
];
const REWARD_AT = [
  [], ['skin:tom:1'], ['kart:brummi'], ['char:quaki'], ['paint:blitz:1'], ['skin:anna:1'], ['kart:wiesel'], ['char:janos'],
  ['skin:quaki:1', 'paint:brummi:1'], ['char:flavio'], ['skin:flavio:1', 'paint:wiesel:1'], ['skin:janos:1', 'cos:flag'],
  ['skin:tom:2', 'paint:blitz:2'], ['skin:anna:2', 'paint:brummi:2'], ['skin:flavio:2', 'cos:halo'], ['skin:quaki:2', 'paint:wiesel:2'],
  ['skin:janos:2'], ['cos:crown']
];
export const REWARDS = [];         // { id, level }
REWARD_AT.forEach((ids, level) => ids.forEach(id => REWARDS.push({ id, level })));
const RULE = {}; for (const r of REWARDS) RULE[r.id] = r;
export const ruleOf = id => RULE[id];

/* Startinhalte */
export const STARTERS = new Set(['char:tom', 'char:anna', 'kart:blitz']);
for (const c of CHARS) STARTERS.add('skin:' + c.id + ':0');
for (const k of KARTS) STARTERS.add('paint:' + k.id + ':0');

/* ----- Profile laden und speichern ----- */
function sanitizeProfile(o) {
  const p = fresh();
  if (o && typeof o === 'object') {
    for (const k of ['xp', 'races', 'wins', 'podiums', 'drifts', 'jumps']) p[k] = Math.max(0, Math.floor(+o[k]) || 0);
    for (const k of ['unlocked', 'tracksDone', 'chal']) if (o[k] && typeof o[k] === 'object') p[k] = Object.assign({}, o[k]);
  }
  return p;
}
function syncUnlocks(p) {           // alles bis zur erreichten Stufe ist freigeschaltet
  const lv = levelOf(p.xp);
  for (const r of REWARDS) if (r.level <= lv) p.unlocked[r.id] = 1;
}
function loadSlot(i) {
  let p = null;
  try { const raw = localStorage.getItem(KEY + i); if (raw) p = sanitizeProfile(JSON.parse(raw)); } catch (e) {}
  if (!p) {
    p = fresh();
    if (i === 0) {                  // alten Spielstand (Punkte) übernehmen
      try {
        const o = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
        if (o && typeof o === 'object') { p = sanitizeProfile(Object.assign({}, o, { xp: o.points })); p.unlocked = Object.assign({}, o.unlocked); }
      } catch (e) {}
    }
  }
  syncUnlocks(p);
  return p;
}
export const profiles = Array.from({ length: SLOTS }, (_, i) => loadSlot(i));
export let save = profiles[0];      // Profil des gerade aktiven Spielerplatzes
export let slot = 0;
export function useSlot(i) { slot = Math.max(0, Math.min(SLOTS - 1, i | 0)); save = profiles[slot]; return slot; }
export function persist(i) { const s = i === undefined ? slot : i; try { localStorage.setItem(KEY + s, JSON.stringify(profiles[s])); } catch (e) {} }
export function resetSave() { for (let i = 0; i < SLOTS; i++) { profiles[i] = fresh(); persist(i); } try { localStorage.removeItem(OLD_KEY); } catch (e) {} useSlot(slot); }

export const isUnlocked = id => STARTERS.has(id) || !!save.unlocked[id];
export const charOk = i => isUnlocked('char:' + CHARS[i].id);
export const kartOk = i => isUnlocked('kart:' + KARTS[i].id);
export const skinOk = (ci, k) => isUnlocked('skin:' + CHARS[ci].id + ':' + k);
export const paintOk = (ki, k) => isUnlocked('paint:' + KARTS[ki].id + ':' + k);
export const cosOk = k => k === 0 || isUnlocked('cos:' + COSMETICS[k - 1].id);
export const TOTAL = REWARDS.length + STARTERS.size;
export const unlockedCount = () => REWARDS.filter(r => isUnlocked(r.id)).length + STARTERS.size;

export function unlockHint(id) {
  const r = RULE[id]; if (!r) return '';
  return 'Erreiche den Rang ' + levelName(r.level) + ' (' + Math.min(save.xp, LEVELS[r.level].start) + ' / ' + LEVELS[r.level].start + ' XP)';
}
export const ruleFrac = id => { const r = RULE[id]; return r ? Math.min(1, save.xp / Math.max(1, LEVELS[r.level].start)) : 1; };

/* Anzeigedaten einer Freischaltung für Vorschau und Belohnungsbildschirm */
export function describe(id) {
  const p = id.split(':');
  if (p[0] === 'char') { const i = CHARS.findIndex(c => c.id === p[1]), c = CHARS[i]; return { kind: 'Neuer Charakter', pv: 'char', ch: i, sk: 0, name: c.name, sub: c.kind + '. ' + c.note }; }
  if (p[0] === 'kart') { const i = KARTS.findIndex(c => c.id === p[1]), k = KARTS[i]; return { kind: 'Neues Kart', pv: 'kart', kt: i, pk: 0, name: k.name, sub: k.role }; }
  if (p[0] === 'skin') { const i = CHARS.findIndex(c => c.id === p[1]), n = +p[2]; return { kind: 'Neuer Skin', pv: 'char', ch: i, sk: n, name: CHARS[i].name + ': ' + CHAR_SKINS[p[1]][n][0], sub: 'Skin für ' + CHARS[i].name }; }
  if (p[0] === 'cos') { const k = COSMETICS.findIndex(c => c.id === p[1]), c = COSMETICS[k]; return { kind: 'Seltener Kartschmuck', pv: 'kart', kt: 0, pk: 0, cs: k + 1, name: c.name, sub: c.note }; }
  const i = KARTS.findIndex(c => c.id === p[1]), n = +p[2];
  return { kind: 'Neuer Lack', pv: 'kart', kt: i, pk: n, name: KARTS[i].name + ': ' + KART_SKINS[p[1]][n][0], sub: 'Lack für das Kart ' + KARTS[i].name };
}

/* Nächste noch gesperrte Belohnung des aktuellen Profils */
export function nextGoal(p) {
  const lv = levelOf(p.xp);
  const r = REWARDS.find(r => r.level > lv);
  return r ? { id: r.id, level: r.level, f: Math.min(1, p.xp / LEVELS[r.level].start) } : null;
}

/* ----- Herausforderungen ----- */
/* Pro Rennen (jedes Mal neu verdient) */
const RACE_CHAL = [
  { name: 'Podest-Fahrer: Platz 1 bis 3', xp: 25, test: r => r.racing && r.place <= 3 },
  { name: 'Drift-Meister: 4 Drift-Boosts', xp: 30, test: r => r.driftN >= 4 },
  { name: 'Luftakrobat: 3 Sprünge', xp: 25, test: r => r.jumpN >= 3 }
];
/* Einmalige Meilensteine (Stand nach dem Rennen) */
export const MILESTONES = [
  { id: 'm_first', name: 'Erstes Rennen geschafft', xp: 40, test: p => p.races >= 1 },
  { id: 'm_win1', name: 'Erster Sieg', xp: 80, test: p => p.wins >= 1 },
  { id: 'm_race10', name: '10 Rennen gefahren', xp: 100, test: p => p.races >= 10 },
  { id: 'm_win5', name: '5 Siege', xp: 150, test: p => p.wins >= 5 },
  { id: 'm_drift25', name: '25 Drift-Boosts', xp: 100, test: p => p.drifts >= 25 },
  { id: 'm_jump30', name: '30 Sprünge', xp: 100, test: p => p.jumps >= 30 },
  { id: 'm_tracks', name: 'Alle Strecken gefahren', xp: 120, test: p => Object.keys(p.tracksDone).length >= 3 },
  { id: 'm_hard', name: 'Sieg gegen schwere Bots', xp: 200, test: (p, r) => r.won && r.mode === 'local' && r.diff === 2 && r.opponents > 0 },
  { id: 'm_race50', name: '50 Rennen gefahren', xp: 300, test: p => p.races >= 50 }
];

const PLACE_XP = [100, 70, 50, 35, 25, 20, 15, 10];
export const DIFF_NAMES = ['Leicht', 'Mittel', 'Schwer'];
export const DIFF_MUL = [1, 1.15, 1.3];

/* Vergibt XP an das Profil des Spielerplatzes r.slot, schaltet frei und liefert die Daten für den Belohnungsbildschirm.
   r: { slot, place, cars, opponents, mode, trackId, isBest, driftN, jumpN, diff } */
export function grantRewards(r) {
  const p = profiles[Math.max(0, Math.min(SLOTS - 1, r.slot | 0))];
  const lines = [], racing = r.opponents > 0, won = racing && r.place === 1;
  if (racing) {
    const base = PLACE_XP[Math.min(r.place, PLACE_XP.length) - 1];
    lines.push(['Platz ' + r.place, base]);
    if (won) lines.push(['Rennen gewonnen', 50]);
    const beaten = r.cars - r.place;
    if (beaten > 0) lines.push([beaten + (beaten === 1 ? ' Gegner geschlagen' : ' Gegner geschlagen'), beaten * 5]);
    if (r.mode === 'local' && DIFF_MUL[r.diff] > 1) lines.push(['Bonus Schwierigkeit ' + DIFF_NAMES[r.diff], Math.round(base * (DIFF_MUL[r.diff] - 1))]);
  } else lines.push(['Zeitrennen geschafft', 60]);
  const dn = Math.min(6, r.driftN | 0), jn = Math.min(6, r.jumpN | 0);
  if (dn > 0) lines.push([dn + (dn === 1 ? ' Drift-Boost' : ' Drift-Boosts'), dn * 8]);
  if (jn > 0) lines.push([jn + (jn === 1 ? ' Sprung' : ' Sprünge'), jn * 5]);
  if (r.isBest) lines.push(['Neue Bestzeit', 40]);
  if (!p.tracksDone[r.trackId]) lines.push(['Erste Fahrt auf dieser Strecke', 50]);
  const info = Object.assign({ racing, won }, r);
  const chal = [];
  for (const c of RACE_CHAL) if (c.test(info)) { lines.push(['Herausforderung: ' + c.name, c.xp]); chal.push(c.name); }

  const before = { xp: p.xp, level: levelOf(p.xp) };
  p.races++; p.drifts += r.driftN | 0; p.jumps += r.jumpN | 0; p.tracksDone[r.trackId] = 1;
  if (won) p.wins++;
  if (racing && r.place <= 3) p.podiums++;
  for (const m of MILESTONES) if (!p.chal[m.id] && m.test(p, info)) { p.chal[m.id] = 1; lines.push(['Meilenstein: ' + m.name, m.xp]); chal.push(m.name); }
  const total = lines.reduce((s, l) => s + l[1], 0);
  p.xp += total;

  const after = { xp: p.xp, level: levelOf(p.xp) };
  const fresh = [];
  for (const rw of REWARDS) if (!p.unlocked[rw.id] && rw.level <= after.level) { p.unlocked[rw.id] = 1; fresh.push(rw.id); }
  persist(profiles.indexOf(p));
  const g = nextGoal(p);
  return { slot: profiles.indexOf(p), lines, total, before, after, unlocks: fresh, challenges: chal, goal: g && { id: g.id, level: g.level, f: g.f, hint: 'Rang ' + levelName(g.level) + ' (noch ' + (LEVELS[g.level].start - p.xp) + ' XP)', d: describe(g.id) }, stats: { races: p.races, wins: p.wins, xp: p.xp } };
}
