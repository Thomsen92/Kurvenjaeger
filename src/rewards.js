import { CHARS } from './data.js';
import { S } from './state.js';
import { $, fmt } from './util.js';
import { sfx } from './audio.js';
import { describe, unlockedCount, TOTAL, save } from './save.js';
import { thumb, setStage, setPreview, clearPreview, kick } from './preview.js';

/* ---------- Belohnungsbildschirm und Freischalt-Präsentation ---------- */
let data = null, timers = [], qi = 0, raf = 0, rwOpen = false;
const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Wird beim Zieleinlauf aufgerufen; die Belohnungen sind dann schon gespeichert. */
export function prepareRewards(rw, info) {
  data = { rw, info };
  hideRewards();
  $('#rwBtn').textContent = rw.unlocks.length ? 'Belohnungen ansehen (' + rw.unlocks.length + ' neu!)' : 'Belohnungen ansehen';
}

export function hideRewards() {
  $('#reward').hidden = true; closeShowcase(false); rwOpen = false;
  timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf);
}

function showRewards() {
  if (!data) return;
  const { rw, info } = data;
  $('#over').hidden = true; $('#reward').hidden = false; rwOpen = true;
  $('#rwTitle').textContent = '+' + rw.total + ' Punkte';
  $('#rwLines').innerHTML = rw.lines.map((l, i) => '<li style="animation-delay:' + (i * 0.14) + 's"><span>' + esc(l[0]) + '</span><b>+' + l[1] + '</b></li>').join('');
  const tot = $('#rwTotal'); tot.textContent = '0';
  const t0 = performance.now(), dur = 900 + rw.lines.length * 140;
  cancelAnimationFrame(raf);
  const tick = t => { const k = Math.min(1, (t - t0) / dur); tot.textContent = String(Math.round(rw.total * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  $('#rwStats').textContent = (info.multi ? 'Die Belohnungen gehen an Spieler 1. ' : '') + 'Gesamt: ' + save.races + ' Rennen · ' + save.wins + ' Siege · ' + save.points + ' Punkte · ' + unlockedCount() + ' von ' + TOTAL + ' Inhalten freigeschaltet';
  const ul = $('#rwUnlocks'); ul.hidden = !rw.unlocks.length;
  $('#rwChips').innerHTML = rw.unlocks.map((id, i) => { const d = describe(id); return '<button type="button" class="uchip" data-i="' + i + '"><img alt="" src="' + thumb(d.pv === 'char' ? { pv: 'char', ch: d.ch, sk: d.sk } : { pv: 'kart', kt: d.kt, pk: d.pk }) + '"><span><small>' + d.kind + '</small><b>' + esc(d.name) + '</b></span></button>'; }).join('');
  const g = $('#rwGoal');
  if (rw.goal) {
    g.hidden = false;
    g.innerHTML = '<small>Nächstes Ziel</small><b>' + esc(rw.goal.d.name) + '</b><span>' + esc(rw.goal.hint) + '</span><div class="gbar"><i style="width:' + Math.round(rw.goal.f * 100) + '%"></i></div>';
  } else { g.hidden = false; g.innerHTML = '<small>Geschafft</small><b>Alles freigeschaltet!</b><span>Du hast alle Charaktere, Skins, Karts und Lacke.</span>'; }
  if (rw.unlocks.length) later(() => { if (!$('#reward').hidden) openShowcase(0); }, dur + 500);
}

/* ----- Freischaltungen ----- */
function openShowcase(i) {
  const ids = data.rw.unlocks; if (i >= ids.length) { closeShowcase(true); return; }
  qi = i;
  const d = describe(ids[i]), box = $('#unlock');
  /* Der 3D-Ausschnitt liegt hinter allen Seiten, deshalb wird der Belohnungsbildschirm währenddessen ausgeblendet */
  if (!$('#reward').hidden) rwOpen = true;
  $('#reward').hidden = true; box.hidden = false;
  $('#unKind').textContent = d.kind; $('#unName').textContent = d.name; $('#unSub').textContent = d.sub;
  $('#unCount').textContent = ids.length > 1 ? (i + 1) + ' / ' + ids.length : '';
  $('#unNext').textContent = i + 1 < ids.length ? 'Weiter' : 'Super!';
  const h = S.hp[0];
  setStage($('#unStage'));
  setPreview(d.pv === 'char' ? { pv: 'char', ch: d.ch, sk: d.sk } : { pv: 'kart', kt: d.kt, pk: d.pk, drv: { ch: h.ch, sk: h.sk } });
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
