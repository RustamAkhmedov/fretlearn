// Übungsrunde: Fragen auswählen, Antworten prüfen, Feedback + Ergebnis zeigen.
import * as T from './theory.js';
import * as S from './store.js';
import * as A from './audio.js';
import { Fretboard } from './fretboard.js';

const rnd = a => a[Math.floor(Math.random() * a.length)];
function weighted(list, w) {
  const ws = list.map(w), sum = ws.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < list.length; i++) if ((r -= ws[i]) <= 0) return list[i];
  return list[list.length - 1];
}
const spellRandom = pc => T.isNatural(pc) || Math.random() < 0.5 ? T.sharpName(pc) : T.flatName(pc);
const sec = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
const PAD_TYPES = ['name', 'chordName'], TAP_TYPES = ['find', 'octave', 'chordRoot'];

function octSources(p, item, sc) {
  const out = [];
  for (const s1 of [p.s - 2, p.s - 3]) {
    if (s1 < 0 || (item.sources && !item.sources.includes(s1))) continue;
    const f1 = p.f - T.sameNoteShift(s1, p.s);
    if (f1 >= sc.from && f1 <= sc.to) out.push({ s: s1, f: f1 });
  }
  return out;
}

function prepare(item, cfg) {
  const sc = { from: cfg.from, to: cfg.to, ...item.scope };
  if (item.type === 'findAll') {
    const pcs = [...Array(12).keys()].filter(pc => sc.notes === 'naturals' ? T.isNatural(pc) : sc.notes === 'accidentals' ? !T.isNatural(pc) : true);
    return { ...item, sc, cand: pcs };
  }
  let cand = sc.list ? sc.list.slice() : T.positions(sc);
  if (item.type === 'chordRoot' || item.type === 'chordName') cand = cand.filter(p => p.s <= 1 && p.f + 2 <= sc.to);
  if (item.type === 'octave') cand = cand.filter(p => octSources(p, item, sc).length);
  return { ...item, sc, cand };
}

// cfg: { title, mix:[{type,w,scope,sources}], len (0 = endlos), from, to }
export function runQuiz(root, cfg, onExit) {
  const items = cfg.mix.map(m => prepare(m, cfg)).filter(m => m.cand.length);
  if (!items.length) {
    root.innerHTML = `<section class="page"><div class="card"><h2>Nichts zu üben</h2><p>Mit dieser Auswahl gibt es keine passenden Fragen. Wähl mehr Saiten oder Bünde aus.</p><button class="btn primary">Zurück</button></div></section>`;
    root.querySelector('button').onclick = onExit;
    return () => {};
  }
  const needAcc = items.some(m => PAD_TYPES.includes(m.type) && (m.sc.notes !== 'naturals' || m.sc.list));
  // Positionen im Bereich – für "neu sicher" am Ende
  const scopeKeys = new Set();
  for (const m of items) T.positions({ ...m.sc, notes: m.type === 'findAll' ? 'all' : m.sc.notes }).forEach(p => scopeKeys.add(T.key(p.s, p.f)));
  const safeBefore = new Set([...scopeKeys].filter(k => S.isSafe(...k.split('-').map(Number))));

  root.innerHTML = `<div class="quiz">
    <div class="qbar"><button class="icon-btn qx" aria-label="Runde beenden">✕</button><div class="qprog"><i></i></div><span class="qcount"></span></div>
    <div class="qprompt"><div class="qmain"></div><div class="qsub"></div></div>
    <div class="qboard"></div>
    <div class="qfoot"></div>
  </div>`;
  const $ = s => root.querySelector(s);
  const board = new Fretboard($('.qboard'), { from: cfg.from, to: cfg.to, onTap });
  const foot = $('.qfoot');

  let q = null, phase = 'ask', t0 = 0, tLast = 0, acc = 0, asked = 0, right = 0, timer = 0;
  const log = [], recent = [], pending = [];

  function makeQ() {
    const di = pending.findIndex(p => p.due <= asked);
    let item, forced = null;
    if (di >= 0) ({ item, forced } = pending.splice(di, 1)[0]);
    else item = weighted(items, m => m.w);
    const nq = { type: item.type, item };
    if (item.type === 'findAll') {
      let pool = item.cand.filter(pc => !recent.includes('pc' + pc));
      if (!pool.length) pool = item.cand;
      nq.pc = forced ?? weighted(pool, pc => {
        const ps = T.positions({ ...item.sc, notes: 'all' }).filter(p => T.pcAt(p.s, p.f) === pc);
        return ps.reduce((a, p) => a + S.weight(p.s, p.f), 0) / (ps.length || 1);
      });
      nq.name = spellRandom(nq.pc);
      nq.all = T.positions({ ...item.sc, notes: 'all', open: true }).filter(p => T.pcAt(p.s, p.f) === nq.pc);
      nq.keys = new Set(nq.all.map(p => T.key(p.s, p.f)));
      nq.found = new Set(); nq.miss = 0;
      recent.push('pc' + nq.pc);
    } else {
      let pool = item.cand.filter(p => !recent.includes(T.key(p.s, p.f)));
      if (!pool.length) pool = item.cand;
      const t = forced || weighted(pool, p => S.weight(p.s, p.f));
      Object.assign(nq, { s: t.s, f: t.f, pc: T.pcAt(t.s, t.f) });
      nq.name = spellRandom(nq.pc);
      if (item.type === 'octave') nq.src = rnd(octSources(t, item, item.sc));
      recent.push(T.key(t.s, t.f));
    }
    while (recent.length > 3) recent.shift();
    return nq;
  }

  function setPrompt(main, sub, cls = '') {
    $('.qprompt').className = 'qprompt ' + cls;
    $('.qmain').innerHTML = main;
    $('.qsub').innerHTML = sub;
  }
  function updateBar() {
    const p = $('.qprog');
    p.hidden = !cfg.len;
    if (cfg.len) p.firstElementChild.style.width = (asked / cfg.len * 100) + '%';
    $('.qcount').textContent = cfg.len ? `${Math.min(asked + 1, cfg.len)} / ${cfg.len}` : `${right} ✓ · ${asked - right} ✗`;
  }

  function padHTML() {
    const L = T.letters();
    return `<div class="pad">
      ${needAcc ? `<div class="pad-acc"><button data-acc="-1">♭</button><button data-acc="1">♯</button></div>` : ''}
      <div class="pad-letters">${L.map((l, i) => `<button data-i="${i}">${l}</button>`).join('')}</div>
    </div>`;
  }
  function setAcc(a) {
    acc = a;
    foot.querySelectorAll('[data-acc]').forEach(b => b.classList.toggle('on', +b.dataset.acc === acc && acc !== 0));
  }

  function show() {
    clearTimeout(timer);
    q = makeQ(); phase = 'ask'; acc = 0;
    t0 = tLast = performance.now();
    board.setActive(null); board.setMarks([]);
    const nm = T.stringName;
    switch (q.type) {
      case 'name':
        setPrompt('Welcher Ton?', `${nm(q.s)} · Bund ${q.f}`);
        board.setMarks([{ s: q.s, f: q.f, cls: 'target' }]);
        break;
      case 'chordName':
        setPrompt('Welcher Powerchord?', `Grundton auf der ${nm(q.s, 'dat')}`);
        board.setMarks(T.powerShape(q.s, q.f).map((p, i) => ({ ...p, cls: i ? 'tone' : 'target' })));
        break;
      case 'find':
        setPrompt(q.name, `auf der ${nm(q.s, 'dat')}`);
        board.setActive([q.s]);
        break;
      case 'octave':
        setPrompt(`Oktave von ${q.name}`, `auf der ${nm(q.s, 'dat')}`);
        board.setActive([q.s]);
        board.setMarks([{ ...q.src, cls: 'given', label: q.name }]);
        break;
      case 'chordRoot':
        setPrompt(q.name + '5', `Powerchord · Grundton auf der ${nm(q.s, 'dat')}`);
        board.setActive([q.s]);
        break;
      case 'findAll':
        setPrompt(`Alle ${q.name}`, `0 / ${q.all.length} gefunden`);
        break;
    }
    if (PAD_TYPES.includes(q.type)) {
      foot.innerHTML = padHTML();
      foot.querySelectorAll('[data-i]').forEach(b => b.onclick = () => answerPad(+b.dataset.i, acc));
      foot.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => setAcc(acc === +b.dataset.acc ? 0 : +b.dataset.acc));
      if (q.s !== undefined) board.reveal(q.s, q.f);
    } else if (q.type === 'findAll') {
      foot.innerHTML = `<div class="qhint"><span>Tippe alle Stellen an – auch leere Saiten.</span><button class="btn small giveup">Zeig mir den Rest</button></div>`;
      foot.querySelector('.giveup').onclick = giveUp;
    } else {
      foot.innerHTML = `<div class="qhint"><span>Tippe den Bund an.</span></div>`;
    }
    updateBar();
  }

  function answerPad(i, a) {
    if (phase !== 'ask' || !PAD_TYPES.includes(q.type)) return;
    const pc = T.answerPc(i, a), odd = T.oddSpelling(i, a);
    resolve(pc === q.pc && !odd, { s: q.s, f: q.f }, { given: T.spell(i, a), odd: odd && pc === q.pc });
  }

  function onTap(s, f) {
    A.unlock();
    if (phase === 'feedback') return next();
    if (phase !== 'ask') return;
    if (q.type === 'findAll') return tapAll(s, f);
    if (!TAP_TYPES.includes(q.type)) return;
    if (s !== q.s) { nudge(`Auf der ${T.stringName(q.s, 'dat')}!`); return; }
    const ok = T.pcAt(s, f) === q.pc;
    resolve(ok, ok ? { s, f } : { s: q.s, f: q.f }, { tapped: { s, f } });
  }

  function nudge(text) {
    const h = foot.querySelector('.qhint span');
    if (!h) return;
    h.textContent = text; h.classList.remove('shake'); void h.offsetWidth; h.classList.add('shake');
  }

  function resolve(ok, pos, extra = {}) {
    phase = ok ? 'ok' : 'feedback';
    const ms = performance.now() - t0;
    S.record(pos.s, pos.f, ok, ms);
    asked++; if (ok) right++;
    log.push({ ok, ms, s: q.s, f: q.f, pc: q.pc, type: q.type });
    if (ok) success(pos, ms); else fail(extra);
  }

  function success(pos, ms) {
    const fast = ms < S.FAST;
    const name = T.noteName(q.pc);
    const timeTag = `<span class="${fast ? 'fast' : 'slow'}">${sec(ms)}${fast ? '' : ' · noch nicht flüssig'}</span>`;
    foot.querySelectorAll('button').forEach(b => b.disabled = true);
    if (q.type === 'chordRoot' || q.type === 'chordName') {
      const shape = T.powerShape(pos.s, pos.f);
      board.setMarks(shape.map((p, i) => ({ ...p, cls: i ? 'tone' : 'ok', label: T.sharpName(T.pcAt(p.s, p.f)) })));
      setPrompt(`✓ ${T.sharpName(q.pc)}5`, timeTag, 'good');
      A.strum(shape.map(p => T.midiAt(p.s, p.f)));
      timer = setTimeout(next, 1200);
      return;
    }
    const marks = [{ ...pos, cls: 'ok', label: name, big: true }];
    if (q.type === 'octave') marks.unshift({ ...q.src, cls: 'given', label: T.noteName(q.pc) });
    board.setMarks(marks, q.type === 'octave' ? [{ a: q.src, b: pos, cls: 'okline' }] : []);
    setPrompt(`✓ ${name}`, timeTag, 'good');
    if (q.type === 'octave') A.seq([T.midiAt(q.src.s, q.src.f), T.midiAt(pos.s, pos.f)], 0.22);
    else A.play(T.midiAt(pos.s, pos.f));
    timer = setTimeout(next, q.type === 'octave' ? 1000 : 700);
  }

  function fail(extra) {
    pending.push({ item: q.item, forced: q.type === 'findAll' ? q.pc : { s: q.s, f: q.f }, due: asked + 3 });
    const name = T.noteName(q.pc), ex = T.explain(q.s, q.f, cfg.to);
    const marks = [], lines = [];
    let title;
    if (q.type === 'find' || q.type === 'octave' || q.type === 'chordRoot') {
      const tf = extra.tapped;
      title = `${q.type === 'chordRoot' ? 'Grundton ' : ''}${name} liegt hier`;
      for (let f = cfg.from; f <= cfg.to; f++) if (T.pcAt(q.s, f) === q.pc) marks.push({ s: q.s, f, cls: 'ok', label: name });
      if (tf) marks.push({ ...tf, cls: 'bad', label: T.noteName(T.pcAt(tf.s, tf.f)) });
      if (q.type === 'octave') { marks.push({ ...q.src, cls: 'given', label: name }); lines.push({ a: q.src, b: { s: q.s, f: q.f }, cls: 'okline' }); }
      if (tf) extra.note = `Du hast ${T.noteName(T.pcAt(tf.s, tf.f))} getippt (Bund ${tf.f}).`;
    } else {
      title = `Das war ${name}`;
      if (q.type === 'chordName') {
        title = `Das war ${T.sharpName(q.pc)}5`;
        T.powerShape(q.s, q.f).forEach((p, i) => marks.push({ ...p, cls: i ? 'tone' : 'ok', label: T.sharpName(T.pcAt(p.s, p.f)) }));
      } else marks.push({ s: q.s, f: q.f, cls: 'ok', label: name, big: true });
      if (extra.odd) extra.note = `${extra.given} klingt zwar gleich – man nennt den Ton aber ${T.sharpName(q.pc)}.`;
      else if (extra.given) extra.note = `Deine Antwort: ${extra.given}`;
    }
    if (ex.ref && board.has(ex.ref.s, ex.ref.f) && !(ex.ref.s === q.s && ex.ref.f === q.f)) {
      marks.unshift({ ...ex.ref, cls: 'ref', label: T.noteName(T.pcAt(ex.ref.s, ex.ref.f)) });
      lines.push({ a: ex.ref, b: { s: q.s, f: q.f }, cls: 'refline' });
    }
    board.setActive(null);
    board.setMarks(marks, lines);
    board.reveal(q.s, q.f);
    setPrompt(`✗ ${title}`, extra.note || '', 'bad');
    foot.innerHTML = `<div class="fbk">
      ${ex.lines.length ? `<ul>${ex.lines.map(l => `<li>${l}</li>`).join('')}</ul>` : ''}
      <button class="btn primary next">Weiter</button></div>`;
    foot.querySelector('.next').onclick = next;
    A.play(T.midiAt(q.s, q.f));
  }

  function tapAll(s, f) {
    const k = T.key(s, f);
    if (q.found.has(k)) return;
    const now = performance.now(), ms = now - tLast;
    tLast = now;
    if (q.keys.has(k)) {
      q.found.add(k);
      S.record(s, f, true, ms);
      A.play(T.midiAt(s, f));
      drawAll();
      if (q.found.size === q.all.length) finishAll(false);
    } else {
      q.miss++;
      if (f >= 1) S.record(s, f, false, ms);
      board.flash({ s, f, cls: 'bad', label: T.noteName(T.pcAt(s, f)) }, 900);
    }
  }
  function drawAll(missing = []) {
    const marks = q.all.filter(p => q.found.has(T.key(p.s, p.f))).map(p => ({ ...p, cls: 'ok', label: q.name }));
    missing.forEach(p => marks.push({ ...p, cls: 'miss', label: q.name }));
    board.setMarks(marks);
    $('.qsub').textContent = `${q.found.size} / ${q.all.length} gefunden${q.miss ? ` · ${q.miss} daneben` : ''}`;
  }
  function finishAll(gaveUp) {
    const clean = !gaveUp && q.miss === 0;
    asked++; if (clean) right++;
    log.push({ ok: clean, ms: performance.now() - t0, pc: q.pc, type: 'findAll' });
    if (!clean) pending.push({ item: q.item, forced: q.pc, due: asked + 3 });
    if (gaveUp) {
      phase = 'feedback';
      setPrompt(`Hier fehlten noch ${q.all.length - q.found.size}`, `Alle ${q.name} im Überblick`, 'bad');
      foot.innerHTML = `<div class="fbk"><ul><li>Trick: Von jedem gefundenen Ton aus mit der Oktav-Form weiterspringen – 2 Saiten höher, 2 Bünde weiter (ab der ${T.stringShort(4)}-Saite 3).</li></ul><button class="btn primary next">Weiter</button></div>`;
      foot.querySelector('.next').onclick = next;
    } else {
      phase = 'ok';
      setPrompt(`✓ Alle ${q.name} gefunden`, q.miss ? `${q.miss}× daneben getippt` : 'Ohne Fehler!', clean ? 'good' : '');
      foot.querySelectorAll('button').forEach(b => b.disabled = true);
      timer = setTimeout(next, 1100);
    }
  }
  function giveUp() {
    if (phase !== 'ask' || q.type !== 'findAll') return;
    const missing = q.all.filter(p => !q.found.has(T.key(p.s, p.f)));
    missing.forEach(p => { if (p.f >= 1) S.record(p.s, p.f, false, 9999); });
    drawAll(missing);
    finishAll(true);
  }

  function next() {
    clearTimeout(timer);
    if (cfg.len && asked >= cfg.len) return results();
    show();
  }

  function results() {
    phase = 'done';
    clearTimeout(timer);
    S.finishRound();
    const st = S.streak();
    const newly = [...scopeKeys].filter(k => !safeBefore.has(k) && S.isSafe(...k.split('-').map(Number))).length;
    const pct = asked ? Math.round(right / asked * 100) : 0;
    const times = log.filter(l => l.ok && l.type !== 'findAll').map(l => l.ms);
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const seen = new Set(), miss = [];
    for (const l of log) {
      if (l.ok) continue;
      const k = l.type === 'findAll' ? 'pc' + l.pc : T.key(l.s, l.f);
      if (seen.has(k)) continue;
      seen.add(k);
      miss.push(l.type === 'findAll' ? `Alle ${T.noteName(l.pc)}` : `${T.noteName(l.pc)} – ${T.stringName(l.s)}, Bund ${l.f}`);
    }
    board.destroy();
    root.innerHTML = `<section class="page results">
      <div class="card res-card">
        <div class="eyebrow">${cfg.title || 'Runde'} · fertig</div>
        <div class="res-score">${right}<small> / ${asked}</small></div>
        <p class="muted">${pct} % richtig${avg ? ` · Ø ${sec(avg)} pro Antwort` : ''}</p>
        <div class="tiles">
          <div class="tile"><b>${newly}</b><span>neu sicher</span></div>
          <div class="tile"><b>${st.n}</b><span>${st.n === 1 ? 'Tag' : 'Tage'} am Stück</span></div>
        </div>
        ${miss.length ? `<h3>Da hakt's noch</h3><ul class="misslist">${miss.slice(0, 5).map(m => `<li>${m}</li>`).join('')}</ul>` : `<p class="perfect">Keine Fehler – stark!</p>`}
        <div class="row">
          <button class="btn primary again">Nochmal</button>
          <button class="btn done">Fertig</button>
        </div>
      </div></section>`;
    root.querySelector('.again').onclick = () => { cleanup(); cfg.onAgain?.(); };
    root.querySelector('.done').onclick = () => { cleanup(); onExit(); };
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === 'Escape') { $('.qx')?.click(); return; }
    if (phase === 'feedback' && (k === 'Enter' || k === ' ')) { e.preventDefault(); next(); return; }
    if (phase !== 'ask' || !PAD_TYPES.includes(q.type)) return;
    if (k === '#' || k === '+') return setAcc(acc === 1 ? 0 : 1);
    if (k === '-') return setAcc(acc === -1 ? 0 : -1);
    const L = T.letters().map(l => l.toLowerCase());
    let i = L.indexOf(k.toLowerCase());
    if (i < 0 && k.toLowerCase() === 'b' && L[6] === 'h') { answerPad(6, -1); return; } // deutsches B = H♭
    if (i >= 0) answerPad(i, acc);
  }
  document.addEventListener('keydown', onKey);

  $('.qx').onclick = () => {
    if (asked >= 5 && phase !== 'done') results();
    else { cleanup(); onExit(); }
  };

  function cleanup() {
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey);
    board.destroy();
  }

  show();
  // Testzugriff
  window.__quiz = { get q() { return q; }, get phase() { return phase; }, answerPad, onTap, giveUp, next };
  return cleanup;
}
