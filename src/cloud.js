import { hooks, exportProfile0, setProfile0, resetSave, applyConfig } from './save.js';

/* ---------- Optionaler Cloud-Speicher (Supabase, nur per fetch, ohne Zusatzpaket) ----------
   Konto = Spielername + Passwort. Für Supabase Auth wird daraus eine Fake-E-Mail gebaut, es werden nie E-Mails verschickt
   (dafür in Supabase "Confirm email" ausschalten). Ohne Konto bleibt alles wie bisher lokal im Browser. */
const URL_ = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const cloudOn = !!(URL_ && KEY_);
const DOMAIN = 'kurvenjaeger.app';
const LS = 'kj-cloud-v1', LS_CFG = 'kj-cfg-v1', LS_ANN = 'kj-ann-v1';

export const acct = { user: null, id: '', admin: false, banned: false, busy: false, msg: '', sync: '' };   // sync: '' | 'ok' | 'dirty' | 'error'
export const news = { text: '', active: false };
let st = { sess: null, last: '', dirty: false }, listeners = [], timer = 0;
try { Object.assign(st, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
const keep = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) {} };
export const onCloud = fn => listeners.push(fn);
const emit = () => listeners.forEach(f => { try { f(); } catch (e) {} });

export const nameOk = n => /^[A-Za-z0-9_]{3,16}$/.test(n);
const mail = n => n.toLowerCase() + '@' + DOMAIN;

class CloudErr extends Error { constructor(m, code) { super(m); this.code = code; } }
async function raw(path, opt) {
  opt = opt || {};
  const h = { apikey: KEY_, 'Content-Type': 'application/json' };
  if (!opt.anon && st.sess) h.Authorization = 'Bearer ' + st.sess.access_token;   // der publishable key gehört nur in den apikey-Header
  if (opt.prefer) h.Prefer = opt.prefer;
  let r;
  try { r = await fetch(URL_ + path, { method: opt.method || 'GET', headers: h, body: opt.body === undefined ? undefined : JSON.stringify(opt.body) }); }
  catch (e) { throw new CloudErr('Keine Verbindung zum Server.', 'net'); }
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok) throw new CloudErr((j && (j.msg || j.error_description || j.message || j.error)) || 'Fehler ' + r.status, (j && (j.error_code || j.code)) || r.status);
  return j;
}
async function api(path, opt) {
  if (st.sess && st.sess.expires_at && st.sess.expires_at - Date.now() / 1000 < 60 && st.sess.refresh_token) {
    try { setSess(await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', anon: true, body: { refresh_token: st.sess.refresh_token } })); }
    catch (e) { if (e.code !== 'net') { st.sess = null; keep(); acct.user = null; emit(); } }
  }
  return raw(path, opt);
}
function setSess(j) { st.sess = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), uid: j.user && j.user.id }; keep(); }
function nice(e) {
  const m = String(e.message || e);
  if (/already registered|already been registered|exists/i.test(m)) return 'Dieser Name ist schon vergeben.';
  if (/invalid login/i.test(m)) return 'Name oder Passwort stimmt nicht.';
  if (/password/i.test(m) && /(6|short|weak|least)/i.test(m)) return 'Das Passwort braucht mindestens 6 Zeichen.';
  if (/rate|too many|limit/i.test(m)) return 'Zu viele Versuche, bitte kurz warten.';
  return m;
}

/* ----- Konto ----- */
async function loadMe() {
  const id = st.sess && st.sess.uid; if (!id) return false;
  const r = await api('/rest/v1/profiles?id=eq.' + id + '&select=username,is_admin,banned');
  if (!r || !r[0]) return false;
  acct.user = r[0].username; acct.id = id; acct.admin = !!r[0].is_admin; acct.banned = !!r[0].banned;
  st.me = { user: acct.user, id, admin: acct.admin, banned: acct.banned }; keep();
  return true;
}
export async function signUp(name, pw) {
  if (!cloudOn || acct.busy) return; acct.busy = true; acct.msg = ''; emit();
  try {
    if (!nameOk(name)) throw new Error('Name: 3 bis 16 Zeichen, nur Buchstaben, Zahlen und _.');
    if (String(pw).length < 6) throw new Error('Das Passwort braucht mindestens 6 Zeichen.');
    const j = await raw('/auth/v1/signup', { method: 'POST', anon: true, body: { email: mail(name), password: pw, data: { username: name } } });
    if (!j.access_token) throw new Error('Die Anmeldung wurde nicht abgeschlossen. Im Supabase-Projekt muss "Confirm email" ausgeschaltet sein.');
    setSess(j); st.last = ''; st.dirty = true; keep();
    if (!(await loadMe())) throw new Error('Profil konnte nicht geladen werden (wurde schema.sql ausgeführt?).');
    await push(true);      // aktueller Fortschritt von diesem Gerät wandert ins neue Konto
    acct.msg = 'Konto erstellt. Dein Fortschritt wird jetzt gespeichert.';
  } catch (e) { acct.msg = nice(e); }
  acct.busy = false; emit();
}
export async function signIn(name, pw) {
  if (!cloudOn || acct.busy) return; acct.busy = true; acct.msg = ''; emit();
  try {
    if (!nameOk(name)) throw new Error('Name: 3 bis 16 Zeichen, nur Buchstaben, Zahlen und _.');
    const j = await raw('/auth/v1/token?grant_type=password', { method: 'POST', anon: true, body: { email: mail(name), password: pw } });
    setSess(j); st.last = ''; keep();
    if (!(await loadMe())) throw new Error('Profil konnte nicht geladen werden.');
    await reconcile(true);
    acct.msg = 'Angemeldet.';
  } catch (e) { acct.msg = nice(e); st.sess = null; keep(); acct.user = null; }
  acct.busy = false; emit();
}
export async function signOut() {
  if (acct.user) { try { await flush(); } catch (e) {} }
  clearTimeout(timer); st = { sess: null, last: '', dirty: false, me: null }; keep();
  Object.assign(acct, { user: null, id: '', admin: false, banned: false, sync: '', msg: 'Abgemeldet. Dein Fortschritt bleibt im Konto gespeichert.' });
  resetSave();                     // dieses Gerät gehört wieder dem nächsten Gast
  emit();
}

/* ----- Abgleich lokal <-> Cloud (Spielerplatz 0 gehört dem Konto) ----- */
async function fetchSave() {
  const r = await api('/rest/v1/saves?id=eq.' + acct.id + '&select=data,updated_at');
  return r && r[0] || null;
}
async function reconcile(fresh) {
  const row = await fetchSave(), local = exportProfile0();
  if (!row || !row.data || !row.data.p0) { st.dirty = true; await push(true); return; }
  const cloud = row.data.p0, cloudNewer = !st.last || row.updated_at > st.last;
  if (!cloudNewer) { if (st.dirty) await push(true); else { acct.sync = 'ok'; } return; }
  /* Cloud wurde seit dem letzten Abgleich verändert (anderes Gerät oder Admin) oder dieses Gerät ist neu */
  let useCloud = true;
  if (st.dirty || (fresh && local.xp > (cloud.xp | 0))) {
    if (local.xp !== (cloud.xp | 0) || local.races !== (cloud.races | 0)) {
      useCloud = window.confirm('Auf diesem Gerät gibt es einen anderen Spielstand (' + local.xp + ' XP) als in deinem Konto (' + (cloud.xp | 0) + ' XP).\n\nOK = Stand aus dem Konto laden\nAbbrechen = Stand von diesem Gerät behalten und ins Konto speichern');
    }
  }
  if (useCloud) { setProfile0(cloud); st.last = row.updated_at; st.dirty = false; keep(); acct.sync = 'ok'; }
  else { st.dirty = true; await push(true); }
}
export async function push(now) {
  if (!cloudOn || !acct.user || acct.banned) return;
  try {
    const body = { id: acct.id, data: { v: 1, p0: exportProfile0() } };
    const r = await api('/rest/v1/saves?on_conflict=id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body });
    st.last = r && r[0] ? r[0].updated_at : new Date().toISOString(); st.dirty = false; keep(); acct.sync = 'ok';
  } catch (e) { st.dirty = true; keep(); acct.sync = e.code === 'net' ? 'dirty' : 'error'; if (e.code !== 'net') acct.msg = nice(e); }
  emit();
}
export const flush = () => { clearTimeout(timer); return st.dirty ? push(true) : Promise.resolve(); };
hooks.persist = () => {
  if (!cloudOn || !acct.user) return;
  st.dirty = true; keep(); acct.sync = 'dirty'; clearTimeout(timer); timer = setTimeout(() => push(), 1200);
};
addEventListener('online', () => { if (st.dirty) push(); });
addEventListener('pagehide', () => { if (st.dirty && acct.user && st.sess) { try { fetch(URL_ + '/rest/v1/saves?on_conflict=id', { method: 'POST', keepalive: true, headers: { apikey: KEY_, Authorization: 'Bearer ' + st.sess.access_token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: acct.id, data: { v: 1, p0: exportProfile0() } }) }); } catch (e) {} } });

/* ----- Spielwerte und Ankündigung (öffentlich lesbar, nur Admin schreibt) ----- */
function applyNews(v) { news.text = v && typeof v.text === 'string' ? v.text.slice(0, 280) : ''; news.active = !!(v && v.active && news.text); }
export async function loadSettings() {
  try { applyConfig(JSON.parse(localStorage.getItem(LS_CFG) || 'null')); applyNews(JSON.parse(localStorage.getItem(LS_ANN) || 'null')); } catch (e) {}
  emit();
  if (!cloudOn) return;
  try {
    const rows = await raw('/rest/v1/settings?select=key,value', { anon: true });
    const m = {}; for (const r of rows || []) m[r.key] = r.value;
    applyConfig(m.game || null); applyNews(m.announcement || null);
    try { localStorage.setItem(LS_CFG, JSON.stringify(m.game || null)); localStorage.setItem(LS_ANN, JSON.stringify(m.announcement || null)); } catch (e) {}
    emit();
  } catch (e) { /* offline: Zwischenspeicher gilt */ }
}
export async function saveSetting(key, value) { await api('/rest/v1/settings?on_conflict=key', { method: 'POST', prefer: 'resolution=merge-duplicates', body: { key, value } }); }

/* ----- Admin ----- */
export async function adminList() { return api('/rest/v1/profiles?select=id,username,is_admin,banned,created_at,saves(data,updated_at)&order=created_at.desc&limit=500'); }
export async function adminBan(id, banned) { await api('/rest/v1/profiles?id=eq.' + id, { method: 'PATCH', body: { banned } }); }
export async function adminSetSave(id, data) { await api('/rest/v1/saves?on_conflict=id', { method: 'POST', prefer: 'resolution=merge-duplicates', body: { id, data } }); }

/* ----- Start ----- */
export async function initCloud() {
  await loadSettings();
  if (!cloudOn || !st.sess) return;
  try {
    if (await loadMe()) { await reconcile(false); emit(); }
    else { st.sess = null; keep(); }
  } catch (e) {
    if (e.code !== 'net') { st.sess = null; keep(); }
    else if (st.me) Object.assign(acct, st.me, { sync: st.dirty ? 'dirty' : 'ok' });   // offline: weiter als angemeldet behandeln, Speichern folgt später
  }
  emit();
}
