// Seiten, Navigation, Einstellungen.
import * as T from './theory.js';
import * as S from './store.js';
import * as A from './audio.js';
import { Fretboard } from './fretboard.js';
import { LESSONS, lessonById, lessonProgress, lessonConfig, nextLesson } from './lessons.js';
import { GROUPS, tipCard } from './tips.js';
import { runQuiz } from './quiz.js';

const view = document.getElementById('view');
const LENS = [[10, '10'], [20, '20'], [50, '50'], [0, '∞']];
const LENS_ALL = { 10: 3, 20: 5, 50: 12, 0: 0 }; // "Alle finden" ist pro Frage länger
let cleanup = null, pendingQuiz = null;

function applySettings() {
  const st = S.settings();
  T.setHNames(st.hNames);
  A.setEnabled(st.sound);
}

function mount(fn, arg) {
  cleanup?.(); cleanup = null;
  view.innerHTML = '';
  window.scrollTo(0, 0);
  cleanup = fn(view, arg) || null;
}

const ROUTES = { lernen: learnView, lektion: lessonView, ueben: practiceView, erkunden: exploreView, tricks: tipsView, fortschritt: progressView, runde: quizRoute };
function route() {
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  const fn = ROUTES[name] || learnView;
  document.body.classList.toggle('in-quiz', name === 'runde');
  const tab = name === 'lektion' ? 'lernen' : ROUTES[name] ? name : 'lernen';
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  mount(fn, arg && decodeURIComponent(arg));
  updateStreak();
}

function startQuiz(cfg, back) {
  pendingQuiz = { ...cfg, back, onAgain: () => startQuiz(cfg, back) };
  if (location.hash === '#/runde') route(); else location.hash = '#/runde';
}
function quizRoute(el) {
  const cfg = pendingQuiz;
  if (!cfg) { location.replace('#/lernen'); return; }
  return runQuiz(el, cfg, () => { pendingQuiz = null; location.hash = cfg.back; });
}

function updateStreak() {
  const { n, todayDone } = S.streak();
  const b = document.getElementById('streak');
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.5 4.5 5.5 4.5 10a4.5 4.5 0 0 1-9 0c0-2.2 1-3.6 2-4.6.2 1.6.9 2.6 2 3.1C11 8 12 5 12 2z"/></svg><span>${n}</span>`;
  b.classList.toggle('done', todayDone);
  b.title = todayDone ? `${n} ${n === 1 ? 'Tag' : 'Tage'} am Stück – heute erledigt` : n ? `${n} ${n === 1 ? 'Tag' : 'Tage'} am Stück – heute noch eine Runde für die Serie` : 'Schließ heute eine Runde ab, um eine Serie zu starten';
}

const seg = (name, opts, cur) => `<div class="seg" data-name="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
function bindSeg(root, name, cb) {
  root.querySelectorAll(`.seg[data-name="${name}"] button`).forEach(b => b.onclick = () => {
    b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    cb(b.dataset.v);
  });
}
const pctBar = p => `<div class="bar"><i style="width:${Math.round(p * 100)}%"></i></div>`;

function weakPositions() {
  const max = S.settings().frets, out = [];
  for (const [k, r] of Object.entries(S.state().pos)) {
    const [s, f] = k.split('-').map(Number);
    if (f >= 1 && f <= max && r.k < 3) out.push({ s, f });
  }
  return out;
}
function startWeak(back) {
  const list = weakPositions();
  if (!list.length) return;
  const max = Math.max(12, ...list.map(p => p.f));
  startQuiz({ title: 'Schwächen', len: 20, from: 0, to: max, mix: [{ type: 'name', w: 0.55, scope: { list } }, { type: 'find', w: 0.45, scope: { list } }] }, back);
}

// ——— Lernen ———
function learnView(el) {
  const nx = nextLesson(), ni = LESSONS.indexOf(nx), weak = weakPositions().length;
  el.innerHTML = `<section class="page">
    <div class="card hero">
      <div class="eyebrow">Weiter lernen · Lektion ${ni + 1}</div>
      <h1>${nx.title()}</h1>
      <p class="muted">${nx.sub}</p>
      ${pctBar(lessonProgress(nx))}
      <div class="row">
        <button class="btn primary go-next">Runde starten</button>
        <button class="btn go-weak" ${weak ? '' : 'disabled'}>Schwächen üben${weak ? ` <span class="pill">${weak}</span>` : ''}</button>
      </div>
    </div>
    <h2 class="sec">Lernpfad</h2>
    <ol class="path">${LESSONS.map((l, i) => {
      const p = lessonProgress(l), done = p >= 0.9;
      return `<li><a class="card lesson ${l === nx ? 'next' : ''} ${done ? 'done' : ''}" href="#/lektion/${l.id}">
        <span class="num">${done ? '✓' : i + 1}</span>
        <span class="lmain"><b>${l.title()}</b><small>${l.sub}</small>${pctBar(p)}</span>
        ${l === nx ? '<span class="tag">Empfohlen</span>' : ''}
      </a></li>`;
    }).join('')}</ol>
  </section>`;
  el.querySelector('.go-next').onclick = () => startQuiz(lessonConfig(nx, S.state().lessonLen), '#/lernen');
  el.querySelector('.go-weak').onclick = () => startWeak('#/lernen');
}

// ——— Lektion ———
function lessonView(el, id) {
  const l = lessonById(id);
  if (!l) { location.replace('#/lernen'); return; }
  const i = LESSONS.indexOf(l), p = lessonProgress(l);
  el.innerHTML = `<section class="page">
    <a class="back" href="#/lernen">‹ Lernpfad</a>
    <div class="card hero">
      <div class="eyebrow">Lektion ${i + 1} von ${LESSONS.length}</div>
      <h1>${l.title()}</h1>
      <p class="muted">${l.sub}</p>
      ${pctBar(p)}<p class="small muted">${Math.round(p * 100)} % sicher${p >= 0.9 ? ' · geschafft ✓' : ' · ab 90 % gilt die Lektion als geschafft'}</p>
      <div class="field"><span>Fragen pro Runde</span>${seg('len', LENS, S.state().lessonLen)}</div>
      <div class="row"><button class="btn primary go">Runde starten</button></div>
    </div>
    <h2 class="sec">Tipps für diese Lektion</h2>
    <div class="tips"></div>
    <div class="row lesson-nav">
      ${i > 0 ? `<a class="btn" href="#/lektion/${LESSONS[i - 1].id}">‹ ${LESSONS[i - 1].title()}</a>` : '<span></span>'}
      ${i < LESSONS.length - 1 ? `<a class="btn" href="#/lektion/${LESSONS[i + 1].id}">${LESSONS[i + 1].title()} ›</a>` : ''}
    </div>
  </section>`;
  bindSeg(el, 'len', v => { S.state().lessonLen = +v; S.save(); });
  el.querySelector('.go').onclick = () => startQuiz(lessonConfig(l, S.state().lessonLen), '#/lektion/' + l.id);
  const tips = el.querySelector('.tips');
  l.tips.forEach(t => tips.appendChild(tipCard(t)));
}

// ——— Freies Üben ———
function practiceView(el) {
  const pr = S.state().practice, max = S.settings().frets;
  pr.to = Math.min(pr.to, max); pr.from = Math.min(pr.from, pr.to - 2);
  const weak = weakPositions().length;
  const opts = (a, b, cur) => Array.from({ length: b - a + 1 }, (_, i) => a + i).map(f => `<option value="${f}" ${f === cur ? 'selected' : ''}>${f}</option>`).join('');
  el.innerHTML = `<section class="page">
    <h1 class="pagetitle">Freies Üben</h1>
    <div class="card form">
      <div class="field"><span>Modus</span>${seg('mode', [['name', 'Benennen'], ['find', 'Finden'], ['findAll', 'Alle finden'], ['octave', 'Oktaven']], pr.mode)}
        <p class="small muted modehelp"></p></div>
      <div class="field"><span>Saiten</span><div class="seg multi strs">${[0, 1, 2, 3, 4, 5].map(s => `<button data-s="${s}" class="${pr.strings.includes(s) ? 'on' : ''}">${T.stringShort(s)}</button>`).join('')}</div></div>
      <div class="field"><span>Töne</span>${seg('notes', [['naturals', 'Stammtöne'], ['all', 'Alle'], ['accidentals', 'Nur ♯/♭']], pr.notes)}</div>
      <div class="field"><span>Bünde</span><div class="frange"><select class="ffrom">${opts(0, max - 1, pr.from)}</select><span>bis</span><select class="fto">${opts(1, max, pr.to)}</select></div></div>
      <div class="field"><span>Länge</span>${seg('len', LENS, pr.len)}</div>
      <div class="row"><button class="btn primary go">Los geht's</button><button class="btn go-weak" ${weak ? '' : 'disabled'}>Schwächen üben${weak ? ` <span class="pill">${weak}</span>` : ''}</button></div>
      <p class="warn small" hidden></p>
    </div>
  </section>`;
  const HELP = {
    name: 'Ein Punkt leuchtet auf – du sagst, welcher Ton das ist.',
    find: 'Du bekommst Ton + Saite und tippst den Bund an.',
    findAll: 'Finde alle Stellen eines Tons im gewählten Bereich. Länge zählt hier in Tönen (3/5/12).',
    octave: 'Du siehst einen Ton und suchst ihn mit einer Oktav-Form auf einer höheren Saite.',
  };
  const help = () => { el.querySelector('.modehelp').textContent = HELP[pr.mode]; };
  help();
  bindSeg(el, 'mode', v => { pr.mode = v; help(); S.save(); });
  bindSeg(el, 'notes', v => { pr.notes = v; S.save(); });
  bindSeg(el, 'len', v => { pr.len = +v; S.save(); });
  el.querySelectorAll('.strs button').forEach(b => b.onclick = () => {
    const s = +b.dataset.s, on = pr.strings.includes(s);
    if (on && pr.strings.length === 1) return;
    pr.strings = on ? pr.strings.filter(x => x !== s) : [...pr.strings, s].sort();
    b.classList.toggle('on', !on); S.save();
  });
  const ff = el.querySelector('.ffrom'), ft = el.querySelector('.fto');
  ff.onchange = () => { pr.from = +ff.value; if (pr.to < pr.from + 2) { pr.to = Math.min(max, pr.from + 2); ft.value = pr.to; } S.save(); };
  ft.onchange = () => { pr.to = +ft.value; if (pr.from > pr.to - 2) { pr.from = Math.max(0, pr.to - 2); ff.value = pr.from; } S.save(); };
  el.querySelector('.go').onclick = () => {
    const warn = el.querySelector('.warn');
    if (pr.mode === 'octave' && !pr.strings.some(s => s >= 2)) {
      warn.hidden = false; warn.textContent = 'Für Oktaven brauchst du mindestens eine Saite von D bis e als Ziel.'; return;
    }
    const len = pr.mode === 'findAll' ? LENS_ALL[pr.len] : pr.len;
    const NAMES = { name: 'Benennen', find: 'Finden', findAll: 'Alle finden', octave: 'Oktaven' };
    startQuiz({ title: NAMES[pr.mode], len, from: pr.from, to: pr.to, mix: [{ type: pr.mode, w: 1, scope: { strings: pr.strings, notes: pr.notes } }] }, '#/ueben');
  };
  el.querySelector('.go-weak').onclick = () => startWeak('#/ueben');
}

// ——— Erkunden ———
function exploreView(el) {
  const max = S.settings().frets;
  let show = 'none', sel = new Set();
  el.innerHTML = `<section class="page explore">
    <h1 class="pagetitle">Erkunden</h1>
    <div class="card controls">
      ${seg('show', [['none', 'Nur Auswahl'], ['nat', 'Stammtöne'], ['all', 'Alle Töne']], show)}
      <div class="chips notechips">${[...Array(12).keys()].map(pc => `<button data-pc="${pc}">${T.noteName(pc)}</button>`).join('')}</div>
      <div class="info"><span class="muted">Tippe einen Ton oben oder eine Stelle auf dem Griffbrett an.</span><button class="btn small clear" hidden>Auswahl leeren</button></div>
    </div>
    <div class="boardwrap"></div>
  </section>`;
  const info = el.querySelector('.info span'), clr = el.querySelector('.clear');
  const fb = new Fretboard(el.querySelector('.boardwrap'), {
    from: 0, to: max, fit: false,
    onTap: (s, f) => {
      const pc = T.pcAt(s, f);
      A.play(T.midiAt(s, f));
      info.innerHTML = `<b>${T.noteName(pc)}</b> · ${T.stringName(s)} · ${f ? 'Bund ' + f : 'leer'}`;
      if (!sel.has(pc)) sel.add(pc);
      draw();
      fb.flash({ s, f, cls: 'ping', label: T.noteName(pc) }, 500);
    },
  });
  function draw() {
    const marks = [];
    for (const p of T.positions({ from: 0, to: max, open: true })) {
      const pc = T.pcAt(p.s, p.f), on = sel.has(pc);
      if (on) marks.push({ ...p, cls: 'hl', label: T.noteName(pc) });
      else if (show === 'all' || (show === 'nat' && T.isNatural(pc))) marks.push({ ...p, cls: 'note faint', label: T.noteName(pc) });
    }
    fb.setMarks(marks);
    el.querySelectorAll('[data-pc]').forEach(b => b.classList.toggle('on', sel.has(+b.dataset.pc)));
    clr.hidden = !sel.size;
  }
  bindSeg(el, 'show', v => { show = v; draw(); });
  el.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => {
    const pc = +b.dataset.pc;
    sel.has(pc) ? sel.delete(pc) : sel.add(pc);
    if (sel.has(pc)) info.innerHTML = `<b>${T.noteName(pc)}</b> · ${T.positions({ from: 0, to: max, open: true }).filter(p => T.pcAt(p.s, p.f) === pc).length} Stellen bis Bund ${max}`;
    draw();
  });
  clr.onclick = () => { sel.clear(); draw(); };
  draw();
  return () => fb.destroy();
}

// ——— Tricks ———
function tipsView(el) {
  el.innerHTML = `<section class="page"><h1 class="pagetitle">Tipps & Tricks</h1>
    <p class="muted lead">Jeder Trick hat ein kleines Griffbrett: antippen zum Anhören, Beispiele durchklicken.</p>
    ${GROUPS.map((g, i) => `<h2 class="sec">${g.title}</h2><p class="muted">${g.intro}</p><div class="tips" data-g="${i}"></div>`).join('')}
  </section>`;
  GROUPS.forEach((g, i) => { const w = el.querySelector(`[data-g="${i}"]`); g.ids.forEach(id => w.appendChild(tipCard(id))); });
}

// ——— Fortschritt ———
function progressView(el) {
  const max = S.settings().frets, ps = T.positions({ from: 0, to: max });
  const safe = ps.filter(p => S.isSafe(p.s, p.f)).length;
  const { n, todayDone } = S.streak(), tot = S.state().total;
  const weak = Object.entries(S.state().pos).map(([k, r]) => { const [s, f] = k.split('-').map(Number); return { s, f, r }; })
    .filter(x => x.f >= 1 && x.f <= max && x.r.k < 3).sort((a, b) => a.r.k - b.r.k || a.r.c / a.r.a - b.r.c / b.r.a).slice(0, 6);
  el.innerHTML = `<section class="page progress">
    <h1 class="pagetitle">Fortschritt</h1>
    <div class="tiles">
      <div class="tile"><b>${n}</b><span>${n === 1 ? 'Tag' : 'Tage'} am Stück${todayDone ? ' ✓' : ''}</span></div>
      <div class="tile"><b>${safe}<small>/${ps.length}</small></b><span>Stellen sicher</span></div>
      <div class="tile"><b>${tot.a}</b><span>Antworten</span></div>
      <div class="tile"><b>${tot.a ? Math.round(tot.c / tot.a * 100) : 0}<small>%</small></b><span>richtig</span></div>
    </div>
    <div class="card">
      <h3>Deine Griffbrett-Karte</h3>
      <div class="legend"><span class="lg n">neu</span><span class="lg l0">schwach</span><span class="lg l1">am Lernen</span><span class="lg l3">sicher</span></div>
      <div class="boardwrap"></div>
      <p class="small muted">„Sicher“ heißt: dreimal hintereinander richtig und jeweils schneller als 3 Sekunden.</p>
    </div>
    <div class="card"><h3>Pro Saite</h3><div class="perstring">${[0, 1, 2, 3, 4, 5].map(s => {
      const sp = ps.filter(p => p.s === s), v = sp.filter(p => S.isSafe(p.s, p.f)).length / sp.length;
      return `<div class="ps"><b>${T.stringShort(s)}</b>${pctBar(v)}<span>${Math.round(v * 100)} %</span></div>`;
    }).join('')}</div></div>
    ${weak.length ? `<div class="card"><h3>Da hakt's noch</h3><ul class="misslist">${weak.map(x => `<li>${T.noteName(T.pcAt(x.s, x.f))} – ${T.stringName(x.s)}, Bund ${x.f} <span class="muted">(${x.r.c}/${x.r.a} richtig)</span></li>`).join('')}</ul></div>` : ''}
    <div class="card backup"><h3>Sichern</h3>
      <p class="small muted persist-status">Speicher wird geprüft …</p>
      <div class="row"><button class="btn small do-export">Backup speichern</button><button class="btn small do-import">Backup laden</button></div>
      <input type="file" accept="application/json,.json" class="import-file" hidden>
      <p class="small muted backup-msg" hidden></p>
    </div>
    <div class="card danger"><h3>Neu anfangen</h3><p class="small muted">Löscht deinen Fortschritt auf diesem Gerät. Einstellungen bleiben.</p><button class="btn reset">Fortschritt zurücksetzen</button></div>
  </section>`;
  const fb = new Fretboard(el.querySelector('.boardwrap'), { from: 0, to: max, fit: false });
  fb.setMarks(ps.map(p => {
    const lv = S.level(p.s, p.f);
    return { ...p, cls: 'heat ' + (lv < 0 ? 'n' : lv === 0 ? 'l0' : lv < 3 ? 'l1' : 'l3'), label: T.noteName(T.pcAt(p.s, p.f)) };
  }));
  const rb = el.querySelector('.reset');
  rb.onclick = () => {
    if (!rb.classList.contains('confirm')) { rb.classList.add('confirm'); rb.textContent = 'Wirklich alles löschen?'; return; }
    S.resetProgress(); route();
  };
  bindBackup(el);
  return () => fb.destroy();
}

function bindBackup(el) {
  const status = el.querySelector('.persist-status'), msg = el.querySelector('.backup-msg'), file = el.querySelector('.import-file');
  const say = t => { msg.textContent = t; msg.hidden = false; };
  const showStatus = p => {
    status.textContent = S.app ? 'In der App gespeichert ✓ – bleibt, bis du fretlearn deinstallierst oder die App-Daten löschst. Für einen Handywechsel: Backup.'
      : p === true ? 'Dauerhaft gespeichert ✓ – der Browser räumt deinen Fortschritt nicht von selbst weg. Gegen „Browserdaten löschen“ hilft nur ein Backup.'
      : p === false ? 'Der Browser darf deinen Fortschritt bei Platzmangel löschen. Tipp: fretlearn als App installieren, dann erlaubt er dauerhaftes Speichern eher.'
      : 'Dieser Browser sagt nicht, ob er deinen Fortschritt behält. Mach ab und zu ein Backup.';
    if (p === false) {
      const b = document.createElement('button');
      b.className = 'btn small'; b.style.marginTop = '8px'; b.textContent = 'Dauerhaft speichern';
      b.onclick = async () => { const r = await S.requestPersist(); showStatus(r); if (!r) say('Der Browser hat abgelehnt. Ein Backup ist dann besonders sinnvoll.'); };
      status.append(document.createElement('br'), b);
    }
  };
  S.persisted().then(showStatus);
  el.querySelector('.do-export').onclick = () => {
    if (S.app) { S.app.saveBackup(S.exportData(), `fretlearn-backup-${S.today()}.json`); return; }
    const url = URL.createObjectURL(new Blob([S.exportData()], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `fretlearn-backup-${S.today()}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    say('Backup gespeichert (Downloads).');
  };
  const ib = el.querySelector('.do-import');
  ib.onclick = () => {
    if (!ib.classList.contains('confirm')) { ib.classList.add('confirm'); ib.textContent = 'Ersetzt deinen Fortschritt – Datei wählen'; return; }
    file.click();
  };
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    try { S.importData(await f.text()); applySettings(); updateStreak(); route(); }
    catch { ib.classList.remove('confirm'); ib.textContent = 'Backup laden'; say('Das ist keine gültige fretlearn-Sicherung.'); }
  };
}

// ——— Einstellungen ———
function openSettings() {
  const m = document.getElementById('modal'), st = S.settings();
  m.innerHTML = `<div class="sheet card" role="dialog" aria-label="Einstellungen">
    <div class="sheet-head"><h2>Einstellungen</h2><button class="icon-btn close" aria-label="Schließen">✕</button></div>
    <div class="field"><span>Notennamen</span>${seg('names', [['0', 'International (B)'], ['1', 'Deutsch (H)']], st.hNames ? 1 : 0)}
      <p class="small muted">Deutsch: H statt B, und „B“ meint B♭.</p></div>
    <div class="field"><span>Bünde</span>${seg('frets', [['12', '0–12'], ['24', '0–24']], st.frets)}
      <p class="small muted">Gilt für Üben, Erkunden und Fortschritt. Der Lernpfad bleibt bei 0–12.</p></div>
    <div class="field"><span>Sound</span>${seg('sound', [['1', 'An'], ['0', 'Aus']], st.sound ? 1 : 0)}</div>
    <p class="small muted about">fretlearn speichert alles nur ${S.app ? 'auf diesem Gerät' : 'in diesem Browser'}. Kein Account, kein Server. Backup: unter „Fortschritt“.</p>
  </div>`;
  m.hidden = false;
  const close = () => { m.hidden = true; m.innerHTML = ''; window.fretlearnBack = null; route(); };
  window.fretlearnBack = () => { close(); return true; }; // Zurück-Taste der Android-App
  m.onclick = e => { if (e.target === m) close(); };
  m.querySelector('.close').onclick = close;
  bindSeg(m, 'names', v => { S.setSetting('hNames', v === '1'); applySettings(); });
  bindSeg(m, 'frets', v => { S.setSetting('frets', +v); });
  bindSeg(m, 'sound', v => { S.setSetting('sound', v === '1'); applySettings(); if (v === '1') A.play(57); });
}

applySettings();
document.getElementById('btn-settings').onclick = openSettings;
document.addEventListener('pointerdown', () => A.unlock(), { passive: true });
addEventListener('hashchange', route);
route();

if (!S.app && 'serviceWorker' in navigator && location.protocol.startsWith('http') && !/^(localhost|127\.)/.test(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
