import { S } from './state.js';
import { $ } from './util.js';
import { sfx } from './audio.js';
import { describe, levelName, progressOf, MAX_LEVEL } from './save.js';
import { badgeHtml } from './rank.js';
import { podiumSkip } from './podium.js';
import { thumb, setStage, setPreview, clearPreview, kick } from './preview.js';

/* ---------- Belohnungsbildschirm und Freischalt-Präsentation ---------- */
let all = [], info = {}, cur = null, timers = [], qi = 0, raf = 0, rwOpen = false;
const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Vorschau-Angaben einer Freischaltung; Kartschmuck wird am Kart samt Fahrer des Spielers gezeigt */
function specOf(d, slot) {
  if (d.pv === 'char') return { pv: 'char', ch: d.ch, sk: d.sk };
  const h = S.hp[slot | 0] || S.hp[0];
  return d.cs ? { pv: 'kart', kt: h.kt, pk: h.pk, cs: d.cs, drv: { ch: h.ch, sk: h.sk } } : { pv: 'kart', kt: d.kt, pk: d.pk };
}

/* Wird beim Zieleinlauf aufgerufen; die XP sind dann schon gespeichert. rws: eine Auswertung pro menschlichem Spieler */
export function prepareRewards(rws, inf) {
  hideRewards();
  all = rws; info = inf; cur = rws[0] || null;
  const n = rws.reduce((s, r) => s + r.unlocks.length, 0), up = rws.some(r => r.after.level > r.before.level);
  $('#rwBtn').textContent = up ? 'Rangaufstieg! Belohnungen ansehen' : n ? 'Belohnungen ansehen (' + n + ' neu!)' : 'Belohnungen ansehen';
}

export function hideRewards() {
  $('#reward').hidden = true; closeShowcase(false); rwOpen = false;
  timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf);
}

function showRewards() {
  if (!cur) return;
  $('#over').hidden = true; $('#reward').hidden = false; rwOpen = true;
  const tabs = $('#rwTabs');
  tabs.hidden = all.length < 2;
  tabs.innerHTML = all.length < 2 ? '' : all.map((r, i) => '<button type="button" data-i="' + i + '" aria-pressed="' + (r === cur) + '">' + esc(r.label || 'Spieler') + '</button>').join('');
  fill();
}

function fill() {
  timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf);
  const rw = cur, b = rw.before, a = rw.after;
  $('#rwTitle').textContent = '+' + rw.total + ' XP';
  $('#rwLines').innerHTML = rw.lines.map((l, i) => '<li style="animation-delay:' + (i * 0.14) + 's"><span>' + esc(l[0]) + '</span><b>+' + l[1] + '</b></li>').join('');
  const tot = $('#rwTotal'); tot.textContent = '0';
  const t0 = performance.now(), dur = 900 + rw.lines.length * 140;
  const tick = t => { const k = Math.min(1, (t - t0) / dur); tot.textContent = String(Math.round(rw.total * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);

  /* Rangkarte: Der Balken läuft ab dem alten Stand durch alle erreichten Stufen */
  const p0 = progressOf(b.xp);
  $('#rwRank').innerHTML = '<div class="rankcard"><span id="rwBadge">' + badgeHtml(p0.level) + '</span><div class="rk"><small>' + (rw.label ? esc(rw.label) + ' · ' : '') + 'Rang</small><b id="rwRankName">' + levelName(p0.level) + '</b><div class="xpbar"><i id="rwBar" style="width:' + Math.round(p0.frac * 100) + '%"></i></div><span class="xpl" id="rwRankTxt"></span></div></div><div id="rwUp" class="rwup" hidden></div>';
  const bar = $('#rwBar'), nm = $('#rwRankName'), tx = $('#rwRankTxt');
  const setTxt = xp => { const pr = progressOf(xp); tx.innerHTML = '<b>' + xp + ' XP</b> insgesamt · ' + (pr.level < MAX_LEVEL ? 'noch <b>' + pr.left + ' XP</b> bis ' + levelName(pr.level + 1) : 'höchster Rang erreicht'); };
  setTxt(b.xp);
  let t = dur + 200;
  for (let l = b.level; l <= a.level; l++) {
    const last = l === a.level, to = last ? progressOf(a.xp).frac : 1, lv = l;
    later(() => { bar.style.width = Math.round(to * 100) + '%'; }, t);
    t += 800;
    if (!last) later(() => {
      bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; bar.style.transition = '';
      $('#rwBadge').innerHTML = badgeHtml(lv + 1, 'pop'); nm.textContent = levelName(lv + 1); sfx.init(); sfx.play('reveal');
      const up = $('#rwUp'); up.hidden = false; up.textContent = 'Rangaufstieg: ' + levelName(lv + 1) + '!';
    }, t - 40);
  }
  later(() => setTxt(a.xp), t - 400);

  $('#rwStats').textContent = 'Gesamt: ' + rw.stats.races + ' Rennen · ' + rw.stats.wins + ' Siege · ' + rw.stats.xp + ' XP' + (info.multi ? ' (jeder Spieler hat sein eigenes Profil)' : '');
  const ul = $('#rwUnlocks'); ul.hidden = !rw.unlocks.length;
  $('#rwChips').innerHTML = rw.unlocks.map((id, i) => { const d = describe(id); return '<button type="button" class="uchip" data-i="' + i + '"><img alt="" src="' + thumb(specOf(d, rw.slot)) + '"><span><small>' + d.kind + '</small><b>' + esc(d.name) + '</b></span></button>'; }).join('');
  const g = $('#rwGoal');
  if (rw.goal) {
    g.hidden = false;
    g.innerHTML = '<small>Nächste Belohnung</small><b>' + esc(rw.goal.d.name) + '</b><span>' + esc(rw.goal.hint) + '</span><div class="gbar"><i style="width:' + Math.round(rw.goal.f * 100) + '%"></i></div>';
  } else { g.hidden = false; g.innerHTML = '<small>Geschafft</small><b>Alles freigeschaltet!</b><span>Du hast alle Charaktere, Skins, Karts, Lacke und Schmuckstücke.</span>'; }
  if (rw.unlocks.length) later(() => { if (!$('#reward').hidden && cur === rw) openShowcase(0); }, t + 500);
}

/* ----- Freischaltungen ----- */
function openShowcase(i) {
  const ids = cur.unlocks; if (i >= ids.length) { closeShowcase(true); return; }
  qi = i;
  const d = describe(ids[i]), box = $('#unlock');
  /* Der 3D-Ausschnitt liegt hinter allen Seiten, deshalb wird der Belohnungsbildschirm währenddessen ausgeblendet */
  if (!$('#reward').hidden) rwOpen = true;
  $('#reward').hidden = true; box.hidden = false;
  $('#unKind').textContent = d.kind; $('#unName').textContent = d.name; $('#unSub').textContent = d.sub;
  $('#unCount').textContent = ids.length > 1 ? (i + 1) + ' / ' + ids.length : '';
  $('#unNext').textContent = i + 1 < ids.length ? 'Weiter' : 'Super!';
  const h = S.hp[cur.slot | 0] || S.hp[0];
  setStage($('#unStage'));
  const sp = specOf(d, cur.slot);
  setPreview(sp.pv === 'kart' && !sp.drv ? Object.assign(sp, { drv: { ch: h.ch, sk: h.sk } }) : sp);
  kick();
  const card = box.querySelector('.unTop'); card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
  confetti();
  sfx.init(); sfx.play('finish'); later(() => sfx.play('reveal'), 500);
}
function closeShowcase(restore) { const b = $('#unlock'); if (b) b.hidden = true; clearPreview(); $('#confetti').innerHTML = ''; if (restore && rwOpen) $('#reward').hidden = false; }
function confetti() {
  const box = $('#confetti'), cols = ['#ffd23f', '#ff4b3e', '#4fd8ff', '#6fdc8c', '#ff5ab8', '#ffffff'];
  box.innerHTML = '';
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i');
    p.style.cssText = 'left:' + Math.round(Math.random() * 100) + '%;background:' + cols[i % cols.length] + ';animation-delay:' + (Math.random() * 0.9).toFixed(2) + 's;animation-duration:' + (2.4 + Math.random() * 1.8).toFixed(2) + 's;--dx:' + Math.round(-60 + Math.random() * 120) + 'px;--r:' + Math.round(Math.random() * 720) + 'deg';
    box.appendChild(p);
  }
}

$('#rwBtn').addEventListener('click', showRewards);
$('#unNext').addEventListener('click', () => openShowcase(qi + 1));
$('#rwChips').addEventListener('click', e => { const b = e.target.closest('.uchip'); if (b) openShowcase(+b.dataset.i); });
$('#rwTabs').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; cur = all[+b.dataset.i]; $('#rwTabs').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); fill(); });
$('#rwBack').addEventListener('click', () => { hideRewards(); $('#over').hidden = false; });
$('#skipBtn').addEventListener('click', () => { podiumSkip(); $('#cpanel').classList.add('show'); });
