import { RANKS, LEVELS, MAX_LEVEL, levelName, progressOf, REWARDS, isUnlocked, describe, unlockedCount, TOTAL, ruleOf } from './save.js';

/* ---------- Anzeige von Rang, XP-Balken und Belohnungsliste (Hauptmenü, Belohnungsbildschirm) ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TIER = ['I', 'II', 'III'];

export function badgeHtml(level, cls) {
  const L = LEVELS[level], R = RANKS[L.rank];
  return '<span class="rbadge' + (cls ? ' ' + cls : '') + '" style="--rc:' + R.color + ';--rh:' + R.hi + '" aria-hidden="true"><i>' + TIER[L.tier] + '</i></span>';
}

/* Rangkarte für das Hauptmenü: Rang, Gesamt-XP, Balken, fehlende XP */
export function rankCardHtml(p, title) {
  const pr = progressOf(p.xp);
  const next = pr.level < MAX_LEVEL ? levelName(pr.level + 1) : '';
  return '<div class="rankcard">' + badgeHtml(pr.level) +
    '<div class="rk"><small>' + esc(title || 'Dein Rang') + '</small><b>' + levelName(pr.level) + '</b>' +
    '<div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="' + (pr.need || 1) + '" aria-valuenow="' + pr.into + '"><i style="width:' + Math.round(pr.frac * 100) + '%"></i></div>' +
    '<span class="xpl"><b>' + p.xp + ' XP</b> insgesamt · ' + (next ? 'noch <b>' + pr.left + ' XP</b> bis ' + next : 'höchster Rang erreicht') + '</span></div></div>';
}

/* Alle Belohnungen nach Rang, freigeschaltete hervorgehoben */
export function rewardListHtml() {
  let h = '<details class="rwlist"><summary>Belohnungen · ' + unlockedCount() + ' von ' + TOTAL + ' freigeschaltet</summary><div class="rwl">';
  for (let r = 0; r < RANKS.length; r++) {
    const items = REWARDS.filter(x => LEVELS[x.level].rank === r);
    if (!items.length) continue;
    h += '<h4 style="color:' + RANKS[r].color + '">' + RANKS[r].name + '</h4><ul>' + items.map(x => {
      const d = describe(x.id), ok = isUnlocked(x.id);
      return '<li class="' + (ok ? 'on' : 'off') + '"><b>' + esc(d.name) + '</b><small>' + (ok ? d.kind.replace(/^Neue[rs]? /, '') : levelName(ruleOf(x.id).level)) + '</small></li>';
    }).join('') + '</ul>';
  }
  return h + '<p class="hint">Startinhalte (3 Charaktere/Karts und alle Original-Looks) sind von Anfang an dabei.</p></div></details>';
}
