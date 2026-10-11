// Fortschritt & Einstellungen – liegt nur im localStorage dieses Browsers.
const KEY = 'fretlearn.v1';
export const FAST = 3000; // "sicher" heißt: richtig und schneller als 3 s

const DEF = () => ({
  settings: { hNames: false, frets: 12, sound: true },
  practice: { mode: 'name', strings: [0, 1, 2, 3, 4, 5], notes: 'naturals', from: 0, to: 12, len: 20 },
  lessonLen: 20,
  pos: {},   // "s-f" → { a: Versuche, c: richtig, k: Stärke 0–4, t: Ø ms, l: zuletzt }
  days: {},  // "YYYY-MM-DD" → { q: Antworten, r: Runden }
  total: { a: 0, c: 0 },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw), def = DEF();
      return { ...def, ...d, settings: { ...def.settings, ...d.settings }, practice: { ...def.practice, ...d.practice }, total: { ...def.total, ...d.total } };
    }
  } catch { /* privates Fenster o. Ä. */ }
  return DEF();
}

let st = load(), timer = 0;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* egal */ } }, 120);
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

export function finishRound() { (st.days[today()] ||= { q: 0, r: 0 }).r++; save(); }

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
