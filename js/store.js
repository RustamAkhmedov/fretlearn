// Fortschritt & Einstellungen – liegt im localStorage dieses Browsers (+ Backup-Datei auf Wunsch).
// In der Android-App zusätzlich als Datei im App-Speicher (window.FretlearnApp, siehe android/).
const KEY = 'fretlearn.v1';
export const app = globalThis.FretlearnApp || null;
export const FAST = 3000; // "sicher" heißt: richtig und schneller als 3 s

const DEF = () => ({
  settings: { hNames: false, frets: 12, sound: true },
  practice: { mode: 'name', strings: [0, 1, 2, 3, 4, 5], notes: 'naturals', from: 0, to: 12, len: 20 },
  lessonLen: 20,
  pos: {},   // "s-f" → { a: Versuche, c: richtig, k: Stärke 0–4, t: Ø ms, l: zuletzt }
  days: {},  // "YYYY-MM-DD" → { q: Antworten, r: Runden }
  total: { a: 0, c: 0 },
});

const merge = d => {
  const def = DEF();
  return { ...def, ...d, settings: { ...def.settings, ...d.settings }, practice: { ...def.practice, ...d.practice }, total: { ...def.total, ...d.total } };
};

function load() {
  try {
    const raw = app?.load() || localStorage.getItem(KEY);
    if (raw) return merge(JSON.parse(raw));
  } catch { /* privates Fenster o. Ä. */ }
  return DEF();
}

let st = load(), timer = 0;
export function flush() {
  clearTimeout(timer); timer = 0;
  const json = JSON.stringify(st);
  try { app?.save(json); } catch { /* egal */ }
  try { localStorage.setItem(KEY, json); } catch { /* egal */ }
}
// nur speichern, wenn noch etwas offen ist – sonst überschreibt ein alter Tab neueren Stand
const flushPending = () => { if (timer) flush(); };
export function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 120);
}
// App wird geschlossen/weggewischt → nichts Ungespeichertes verlieren
if (typeof addEventListener === 'function') {
  addEventListener('pagehide', flushPending);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPending(); });
}

// Browser bitten, die Daten nicht beim Aufräumen zu löschen.
// Ergebnis: true = dauerhaft, false = abgelehnt, null = Browser kann das nicht
export async function persisted() {
  if (app) return true;
  try { return navigator.storage?.persisted ? await navigator.storage.persisted() : null; } catch { return null; }
}
let asked = false;
export async function requestPersist() {
  const now = await persisted();
  if (now !== false || asked) return now;
  asked = true;
  try { return await navigator.storage.persist(); } catch { return false; }
}

// Backup als Datei
export function exportData() {
  flush();
  return JSON.stringify({ app: 'fretlearn', v: 1, saved: new Date().toISOString(), data: st });
}
export function importData(text) {
  const j = JSON.parse(text);
  const d = j?.app === 'fretlearn' ? j.data : null;
  if (!d || typeof d !== 'object' || typeof d.pos !== 'object' || typeof d.days !== 'object') throw new Error('Keine fretlearn-Sicherung');
  st = merge(d);
  flush();
}
export const state = () => st;
export const settings = () => st.settings;
export function setSetting(k, v) { st.settings[k] = v; save(); }

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const rec = (s, f) => st.pos[s + '-' + f];
export const level = (s, f) => rec(s, f)?.k ?? -1; // -1 = noch nie gefragt
export const isSafe = (s, f) => level(s, f) >= 3;

export function record(s, f, ok, ms) {
  const id = s + '-' + f;
  const r = st.pos[id] || (st.pos[id] = { a: 0, c: 0, k: 0, t: 0, l: 0 });
  r.a++; st.total.a++;
  if (ok) {
    r.c++; st.total.c++;
    // schnell → eine Stufe rauf; langsam → höchstens "am Lernen"
    r.k = ms < FAST ? Math.min(4, r.k + 1) : Math.min(Math.max(r.k, 1), 2);
  } else r.k = 0;
  r.t = r.t ? Math.round(r.t * 0.7 + ms * 0.3) : Math.round(ms);
  r.l = Date.now();
  (st.days[today()] ||= { q: 0, r: 0 }).q++;
  save();
}

// Wie dringend eine Position wieder dran ist
export function weight(s, f) {
  const r = rec(s, f);
  if (!r) return 4;
  const days = (Date.now() - r.l) / 864e5;
  return [6, 4, 2.5, 1.2, 0.6][r.k] * (1 + Math.min(days, 7) / 5);
}

export function finishRound() { (st.days[today()] ||= { q: 0, r: 0 }).r++; flush(); requestPersist(); }

export function streak() {
  const d = new Date();
  const todayDone = !!st.days[today(d)]?.r;
  if (!todayDone) d.setDate(d.getDate() - 1);
  let n = 0;
  while (st.days[today(d)]?.r) { n++; d.setDate(d.getDate() - 1); }
  return { n, todayDone };
}

export function resetProgress() {
  const keep = { settings: st.settings, practice: st.practice, lessonLen: st.lessonLen };
  st = { ...DEF(), ...keep };
  save();
}
