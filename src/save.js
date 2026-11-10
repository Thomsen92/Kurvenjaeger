import { CHARS, KARTS, CHAR_SKINS, KART_SKINS, TRACKS } from './data.js';

/* ---------- Spielstand, Freischaltungen und Belohnungen ---------- */
const KEY = 'kurvenjaeger-save-v1';
const fresh = () => ({ v: 1, races: 0, wins: 0, podiums: 0, points: 0, unlocked: {}, tracksDone: {}, seen: {} });

function load() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (o && typeof o === 'object') return Object.assign(fresh(), o, { unlocked: Object.assign({}, o.unlocked), tracksDone: Object.assign({}, o.tracksDone), seen: Object.assign({}, o.seen) });
  } catch (e) {}
  return fresh();
}
export let save = load();
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
export function resetSave() { save = fresh(); persist(); }

/* Ids: char:<id>, kart:<id>, skin:<charId>:<n>, paint:<kartId>:<n> */
export const STARTERS = new Set(['char:tom', 'char:anna', 'kart:blitz']);
for (const c of CHARS) STARTERS.add('skin:' + c.id + ':0');
for (const k of KARTS) STARTERS.add('paint:' + k.id + ':0');

/* Freischalt-Regeln, bewusst über viele Rennen verteilt. type: races | wins | podiums | points */
export const RULES = [
  { id: 'skin:tom:1', type: 'races', n: 1 },
  { id: 'kart:brummi', type: 'races', n: 2 },
  { id: 'char:quaki', type: 'races', n: 3 },
  { id: 'paint:blitz:1', type: 'races', n: 4 },
  { id: 'skin:anna:1', type: 'races', n: 5 },
  { id: 'kart:wiesel', type: 'wins', n: 1 },
  { id: 'char:janos', type: 'races', n: 6 },
  { id: 'skin:quaki:1', type: 'races', n: 7 },
  { id: 'char:flavio', type: 'points', n: 1000 },
  { id: 'paint:brummi:1', type: 'races', n: 8 },
  { id: 'skin:flavio:1', type: 'races', n: 9 },
  { id: 'skin:janos:1', type: 'podiums', n: 5 },
  { id: 'paint:wiesel:1', type: 'races', n: 10 },
  { id: 'skin:tom:2', type: 'races', n: 12 },
  { id: 'skin:anna:2', type: 'wins', n: 3 },
  { id: 'paint:blitz:2', type: 'races', n: 14 },
  { id: 'skin:flavio:2', type: 'points', n: 2500 },
  { id: 'paint:brummi:2', type: 'races', n: 16 },
  { id: 'skin:quaki:2', type: 'races', n: 18 },
  { id: 'skin:janos:2', type: 'wins', n: 5 },
  { id: 'paint:wiesel:2', type: 'races', n: 20 }
];
const RULE = {}; for (const r of RULES) RULE[r.id] = r;

export const isUnlocked = id => STARTERS.has(id) || !!save.unlocked[id];
export const charOk = i => isUnlocked('char:' + CHARS[i].id);
export const kartOk = i => isUnlocked('kart:' + KARTS[i].id);
export const skinOk = (ci, k) => isUnlocked('skin:' + CHARS[ci].id + ':' + k);
export const paintOk = (ki, k) => isUnlocked('paint:' + KARTS[ki].id + ':' + k);
export const TOTAL = RULES.length + STARTERS.size;
export const unlockedCount = () => RULES.filter(r => isUnlocked(r.id)).length + STARTERS.size;

const have = type => type === 'races' ? save.races : type === 'wins' ? save.wins : type === 'podiums' ? save.podiums : save.points;
const WHAT = { races: n => 'Schließe ' + n + (n === 1 ? ' Rennen' : ' Rennen') + ' ab', wins: n => 'Gewinne ' + n + (n === 1 ? ' Rennen' : ' Rennen'), podiums: n => 'Fahre ' + n + '-mal aufs Podest (Platz 1 bis 3)', points: n => 'Sammle insgesamt ' + n + ' Punkte' };
export function ruleOf(id) { return RULE[id]; }
export function unlockHint(id) {
  const r = RULE[id]; if (!r) return '';
  return WHAT[r.type](r.n) + ' (' + Math.min(r.n, have(r.type)) + ' / ' + r.n + ')';
}
export const ruleFrac = id => { const r = RULE[id]; return r ? Math.min(1, have(r.type) / r.n) : 1; };

/* Anzeigedaten einer Freischaltung für Vorschau und Belohnungsbildschirm */
export function describe(id) {
  const p = id.split(':');
  if (p[0] === 'char') { const i = CHARS.findIndex(c => c.id === p[1]), c = CHARS[i]; return { kind: 'Neuer Charakter', pv: 'char', ch: i, sk: 0, name: c.name, sub: c.kind + '. ' + c.note }; }
  if (p[0] === 'kart') { const i = KARTS.findIndex(c => c.id === p[1]), k = KARTS[i]; return { kind: 'Neues Kart', pv: 'kart', kt: i, pk: 0, name: k.name, sub: k.role }; }
  if (p[0] === 'skin') { const i = CHARS.findIndex(c => c.id === p[1]), n = +p[2]; return { kind: 'Neuer Skin', pv: 'char', ch: i, sk: n, name: CHARS[i].name + ': ' + CHAR_SKINS[p[1]][n][0], sub: 'Skin für ' + CHARS[i].name }; }
  const i = KARTS.findIndex(c => c.id === p[1]), n = +p[2];
  return { kind: 'Neuer Lack', pv: 'kart', kt: i, pk: n, name: KARTS[i].name + ': ' + KART_SKINS[p[1]][n][0], sub: 'Lack für das Kart ' + KARTS[i].name };
}

/* Nächste Freischaltung (die mit dem größten Fortschritt) für die Anzeige im Belohnungsbildschirm */
export function nextGoal() {
  let best = null;
  for (const r of RULES) { if (isUnlocked(r.id)) continue; const f = ruleFrac(r.id); if (!best || f > best.f) best = { id: r.id, f }; }
  return best;
}

const PLACE_PTS = [100, 70, 50, 35, 25, 20, 15, 10];
export const DIFF_NAMES = ['Leicht', 'Mittel', 'Schwer'];
export const DIFF_MUL = [1, 1.15, 1.3];

/* Vergibt Punkte, aktualisiert den Spielstand, schaltet frei und liefert die Daten für den Belohnungsbildschirm.
   r: { place, cars, opponents, mode, trackId, isBest, driftN, diff } */
export function grantRewards(r) {
  const lines = [];
  const racing = r.opponents > 0;
  if (racing) {
    const base = PLACE_PTS[Math.min(r.place, PLACE_PTS.length) - 1];
    lines.push(['Platz ' + r.place, base]);
    const beaten = r.cars - r.place;
    if (beaten > 0) lines.push([beaten + (beaten === 1 ? ' Gegner geschlagen' : ' Gegner geschlagen'), beaten * 5]);
    if (r.mode === 'local' && DIFF_MUL[r.diff] > 1) lines.push(['Bonus Schwierigkeit ' + DIFF_NAMES[r.diff], Math.round(base * (DIFF_MUL[r.diff] - 1))]);
  } else lines.push(['Zeitrennen geschafft', 60]);
  if (r.driftN > 0) lines.push([Math.min(5, r.driftN) + ' Drift-Boosts', Math.min(5, r.driftN) * 8]);
  if (r.isBest) lines.push(['Neue Bestzeit', 40]);
  if (!save.tracksDone[r.trackId]) lines.push(['Erste Fahrt auf dieser Strecke', 50]);
  const total = lines.reduce((s, l) => s + l[1], 0);

  save.races++; save.points += total; save.tracksDone[r.trackId] = 1;
  if (racing && r.place === 1) save.wins++;
  if (racing && r.place <= 3) save.podiums++;
  const fresh = [];
  for (const rule of RULES) if (!isUnlocked(rule.id) && have(rule.type) >= rule.n) { save.unlocked[rule.id] = 1; fresh.push(rule.id); }
  persist();
  const goal = nextGoal();
  return { lines, total, unlocks: fresh, goal: goal && { id: goal.id, f: goal.f, hint: unlockHint(goal.id), d: describe(goal.id) } };
}
