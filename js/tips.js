// Tipps & Tricks – jeweils mit kleinem, interaktivem Griffbrett.
import * as T from './theory.js';
import * as A from './audio.js';
import { Fretboard } from './fretboard.js';

const B = () => T.stringShort(4);
const lab = (s, f) => T.sharpName(T.pcAt(s, f));
const dot = (p, cls = 'note', label = lab(p.s, p.f)) => ({ s: p.s, f: p.f, cls, label });
const midi = p => T.midiAt(p.s, p.f);
const sd = s => T.stringName(s, 'dat');
const PCS = [...Array(12).keys()];

function mini(host, from, to) {
  return new Fretboard(host, { from, to, orient: 'h', mini: true, fit: false, onTap: (s, f) => A.play(T.midiAt(s, f)) });
}
function win(ps, min = 6) {
  const fs = ps.map(p => p.f);
  let from = Math.max(0, Math.min(...fs) - 1), to = Math.max(...fs) + 1;
  if (to - from < min) to = from + min;
  if (to > 24) { from = Math.max(0, from - (to - 24)); to = 24; }
  return [from, to];
}

// Beispiel-Demo: Board + Beschriftung + "Anhören" + "Anderes Beispiel"
function cycleDemo(el, examples, build) {
  let i = 0, cur = null;
  el.innerHTML = `<div class="demo-board"></div><div class="demo-bar"><span class="demo-cap"></span>
    <button class="btn small play" aria-label="Anhören">▶ Anhören</button>
    ${examples.length > 1 ? '<button class="btn small nextex">Anderes Beispiel</button>' : ''}</div>`;
  const draw = () => {
    cur = build(examples[i]);
    const fb = mini(el.querySelector('.demo-board'), ...cur.win);
    fb.setMarks(cur.marks, cur.lines || []);
    el.querySelector('.demo-cap').innerHTML = cur.cap || '';
  };
  el.querySelector('.play').onclick = () => cur.strum ? A.strum(cur.play) : A.seq(cur.play);
  const nx = el.querySelector('.nextex');
  if (nx) nx.onclick = () => { i = (i + 1) % examples.length; draw(); };
  draw();
}

// Auswahl-Demo: Ton-Chips (+ optional Umschalter) steuern ein oder mehrere Boards
function pickerDemo(el, { pcs = PCS, start = 9, toggles = null, boards }) {
  let pc = start, mode = toggles ? toggles[0][0] : null;
  el.innerHTML = `${toggles ? `<div class="seg small">${toggles.map(([v, l]) => `<button data-mode="${v}">${l}</button>`).join('')}</div>` : ''}
    <div class="chips">${pcs.map(p => `<button data-pc="${p}">${T.noteName(p)}</button>`).join('')}</div>
    <div class="demo-boards"></div>`;
  const draw = () => {
    el.querySelectorAll('[data-pc]').forEach(b => b.classList.toggle('on', +b.dataset.pc === pc));
    el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    const wrap = el.querySelector('.demo-boards');
    wrap.innerHTML = '';
    for (const bd of boards) {
      const r = bd(pc, mode);
      if (!r) continue;
      const box = document.createElement('div');
      box.className = 'demo-unit';
      box.innerHTML = `<div class="demo-head"><b>${r.title}</b><button class="btn small play">▶</button></div><div class="demo-board"></div>${r.cap ? `<p class="demo-cap">${r.cap}</p>` : ''}`;
      wrap.appendChild(box);
      mini(box.querySelector('.demo-board'), ...r.win).setMarks(r.marks, r.lines || []);
      box.querySelector('.play').onclick = () => r.strum ? A.strum(r.play) : A.seq(r.play, r.gap || 0.28);
    }
  };
  el.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => { pc = +b.dataset.pc; draw(); });
  el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
  draw();
}

// Oktave/gleicher Ton von p auf Saite s2
const onString = (p, s2) => ({ s: s2, f: p.f + T.sameNoteShift(p.s, s2) });
function pairDemo(el, examples, toString) {
  cycleDemo(el, examples, p => {
    const t = onString(p, toString(p));
    const n = T.noteName(T.pcAt(p.s, p.f));
    return {
      win: win([p, t]), marks: [dot(p, 'given'), dot(t, 'ok')], lines: [{ a: p, b: t, cls: 'okline' }],
      cap: `<b>${n}</b>: ${sd(p.s)} Bund ${p.f} → ${sd(t.s)} Bund ${t.f}`, play: [midi(p), midi(t)],
    };
  });
}

function anchors(el, s, anchorFrets) {
  const marks = T.positions({ strings: [s], from: 0, to: 12, notes: 'naturals', open: true })
    .map(p => dot(p, anchorFrets.includes(p.f) ? 'given' : 'note'));
  el.innerHTML = `<div class="demo-board"></div><div class="demo-bar"><span class="demo-cap">Tippe aufs Griffbrett zum Anhören.</span><button class="btn small play">▶ Alle anhören</button></div>`;
  mini(el.querySelector('.demo-board'), 0, 12).setMarks(marks);
  el.querySelector('.play').onclick = () => A.seq(marks.map(midi), 0.3);
}

export const TIPS = {
  anchorsE: {
    title: () => 'Ankertöne der tiefen E-Saite',
    body: () => `<p>Lern zuerst die Töne an den Punkt-Markierungen, der Rest liegt direkt daneben:</p>
      <ul><li><b>Bund 3 = G</b>, <b>Bund 5 = A</b>, <b>Bund 7 = ${T.sharpName(11)}</b>, <b>Bund 12 = E</b></li>
      <li>C liegt direkt nach ${T.sharpName(11)} (Bund 8), D zwei Bünde vor dem E (Bund 10), F direkt nach dem leeren E (Bund 1).</li></ul>
      <p class="muted">Diese Töne sind später deine wichtigsten Grundtöne – Powerchords, Barré-Akkorde und Skalen starten hier.</p>`,
    demo: el => anchors(el, 0, [3, 5, 7, 12]),
  },
  anchorsA: {
    title: () => 'Ankertöne der A-Saite',
    body: () => `<ul><li><b>Bund 3 = C</b>, <b>Bund 5 = D</b>, <b>Bund 7 = E</b>, <b>Bund 12 = A</b></li>
      <li>${T.sharpName(11)} auf Bund 2, F auf Bund 8 (direkt nach E), G auf Bund 10.</li></ul>
      <p class="muted">Trick: Bund 7 der A-Saite ist E – genau wie die leere tiefe E-Saite, nur eine Oktave höher.</p>`,
    demo: el => anchors(el, 1, [3, 5, 7, 12]),
  },
  oct2: {
    title: () => '2 Saiten hoch, 2 Bünde weiter',
    body: () => `<p>Den gleichen Ton eine Oktave höher findest du von der <b>E-Saite auf der D-Saite</b> und von der <b>A-Saite auf der G-Saite</b>: zwei Saiten weiter, zwei Bünde Richtung Korpus.</p>
      <p class="muted">Damit kennst du die D- und G-Saite praktisch geschenkt, sobald E und A sitzen.</p>`,
    demo: el => pairDemo(el, [{ s: 0, f: 5 }, { s: 1, f: 3 }, { s: 0, f: 8 }, { s: 1, f: 5 }, { s: 0, f: 3 }, { s: 1, f: 7 }], p => p.s + 2),
  },
  octKnick: {
    title: () => `Der ${B()}-Saiten-Knick`,
    body: () => `<p>Sobald die Form über die ${B()}-Saite springt, rutscht sie einen Bund weiter: von der <b>D- auf die ${B()}-Saite</b> und von der <b>G- auf die e-Saite</b> heißt es <b>2 Saiten, 3 Bünde</b>.</p>
      <p class="muted">Grund: G- und ${B()}-Saite sind nur 4 Bünde auseinander gestimmt statt 5.</p>`,
    demo: el => pairDemo(el, [{ s: 2, f: 5 }, { s: 3, f: 2 }, { s: 2, f: 3 }, { s: 3, f: 5 }, { s: 2, f: 7 }], p => p.s + 2),
  },
  oct3: {
    title: () => '3 Saiten hoch, Bünde zurück',
    body: () => `<p>Die zweite Oktav-Form geht rückwärts: <b>E-Saite → G-Saite: 3 Bünde zurück</b>. Wegen des Knicks: <b>A → ${B()}</b> und <b>D → e</b> nur 2 Bünde zurück.</p>
      <p class="muted">Praktisch, wenn die erste Form aus dem Griffbrett rausläuft.</p>`,
    demo: el => pairDemo(el, [{ s: 0, f: 8 }, { s: 1, f: 5 }, { s: 0, f: 10 }, { s: 2, f: 5 }, { s: 1, f: 7 }], p => p.s + 3),
  },
  eE: {
    title: () => 'Tiefe E = hohe e',
    body: () => `<p>Die hohe e-Saite hat <b>exakt dieselben Töne</b> wie die tiefe E-Saite, nur zwei Oktaven höher. Bund 5 ist auf beiden ein A, Bund 8 auf beiden ein C.</p>
      <p class="muted">Kennst du die tiefe E-Saite, kennst du automatisch die hohe e-Saite.</p>`,
    demo: el => cycleDemo(el, [3, 5, 8, 10, 1, 7], f => {
      const p = { s: 0, f }, t = { s: 5, f };
      return { win: win([p], 5), marks: [dot(p, 'given'), dot(t, 'ok')], lines: [{ a: p, b: t, cls: 'okline' }], cap: `Bund ${f}: beide <b>${T.noteName(T.pcAt(0, f))}</b>`, play: [midi(p), midi(t)] };
    }),
  },
  chain: {
    title: () => 'Die Oktav-Kette: alle Stellen eines Tons',
    body: () => `<p>Kombiniere die Formen und spring von Saite zu Saite: So findest du in Sekunden <b>alle</b> Stellen eines Tons – genau das trainiert der Modus „Alle finden“.</p>
      <p class="muted">Wähl einen Ton: Die Linien zeigen die Sprünge „2 Saiten, 2 Bünde“ (bzw. 3 über die ${B()}-Saite).</p>`,
    demo: el => pickerDemo(el, {
      pcs: [0, 2, 4, 5, 7, 9, 11], start: 9,
      boards: [pc => {
        const ps = T.positions({ from: 0, to: 12, open: true }).filter(p => T.pcAt(p.s, p.f) === pc);
        const lines = [];
        for (const p of ps) if (p.s <= 3) { const t = onString(p, p.s + 2); if (t.f >= 0 && t.f <= 12) lines.push({ a: p, b: t, cls: 'okline' }); }
        return { title: `Alle ${T.noteName(pc)} bis Bund 12`, win: [0, 12], marks: ps.map(p => dot(p, p.s <= 1 ? 'given' : 'ok')), lines, play: ps.sort((a, b) => midi(a) - midi(b)).map(midi), gap: 0.25 };
      }],
    }),
  },
  fret5: {
    title: () => 'Bund 5 = nächste leere Saite',
    body: () => `<p>So stimmt man die Gitarre: <b>Bund 5</b> einer Saite klingt wie die <b>nächste leere Saite</b>. Bund 5 auf E = A, auf A = D, auf D = G.</p>
      <p><b>Ausnahme:</b> Auf der G-Saite ist es <b>Bund 4</b> (= ${B()}). Auf der ${B()}-Saite wieder Bund 5 (= E).</p>`,
    demo: el => {
      const marks = [], lines = [], play = [];
      for (let s = 0; s < 5; s++) {
        const p = { s, f: s === 3 ? 4 : 5 }, o = { s: s + 1, f: 0 };
        marks.push(dot(p, 'given'), dot(o, 'ok')); lines.push({ a: p, b: o, cls: 'okline' }); play.push(midi(p), midi(o));
      }
      cycleDemo(el, [0], () => ({ win: [0, 6], marks, lines, play, cap: 'Jedes Paar klingt gleich.' }));
    },
  },
  shift: {
    title: () => 'Saitenwechsel: 5 Bünde zurück',
    body: () => `<p>Denselben Ton (gleiche Höhe!) gibt es auch auf der nächsthöheren Saite: <b>eine Saite weiter, 5 Bünde zurück</b>. Von G nach ${B()} nur <b>4 Bünde</b>.</p>
      <p class="muted">Bund 7 auf der E-Saite (${T.sharpName(11)}) = Bund 2 auf der A-Saite. Hilft, wenn du einen Ton auf einer Saite kennst und ihn auf der Nachbarsaite brauchst.</p>`,
    demo: el => pairDemo(el, [{ s: 0, f: 7 }, { s: 1, f: 8 }, { s: 2, f: 9 }, { s: 3, f: 7 }, { s: 4, f: 8 }], p => p.s + 1),
  },
  accidentals: {
    title: () => '♯ und ♭: zwei Namen, ein Bund',
    body: () => `<p><b>♯</b> (Kreuz) = einen Bund höher, <b>♭</b> (b) = einen Bund tiefer. Der Bund zwischen F und G heißt deshalb <b>F♯</b> oder <b>G♭</b> – beides stimmt, und in der Übung zählt beides.</p>
      <p class="muted">Du musst nur die Stammtöne wirklich kennen – die ♯/♭-Töne liegen immer dazwischen.</p>`,
    demo: el => cycleDemo(el, [0], () => {
      const ps = [0, 1, 2, 3, 4, 5].map(f => ({ s: 0, f }));
      return { win: [0, 6], marks: ps.map(p => T.isNatural(T.pcAt(0, p.f)) ? dot(p, 'note') : dot(p, 'given', T.noteName(T.pcAt(0, p.f)))), play: ps.map(midi), cap: 'E · F · F♯/G♭ · G · G♯/A♭ · A' };
    }),
  },
  power: {
    title: () => 'Powerchords: Grundton + Form',
    body: () => `<p>Ein Powerchord (z. B. <b>G5</b>) ist nur eine Form, die du an den Grundton hängst: <b>Grundton</b> auf der E- oder A-Saite, die <b>Quinte</b> eine Saite höher und 2 Bünde weiter, die <b>Oktave</b> noch eine Saite höher auf demselben Bund.</p>
      <p class="muted">Wer weiß, wo G auf der E-Saite liegt, kann sofort G5 spielen.</p>`,
    demo: el => pickerDemo(el, {
      start: 7,
      boards: [0, 1].map(rs => pc => {
        const f = (pc - T.TUNING[rs] % 12 + 12) % 12, sh = T.powerShape(rs, f);
        return { title: `${T.sharpName(pc)}5 · Grundton ${rs ? 'A-Saite' : 'E-Saite'}`, win: win(sh, 5), marks: sh.map((p, i) => dot(p, i ? 'note' : 'root')), play: sh.map(midi), strum: true };
      }),
    }),
  },
  barre: {
    title: () => 'Barré-Akkorde: E-Form & A-Form',
    body: () => `<p>Die zwei wichtigsten Barré-Formen hängen am Grundton: Die <b>E-Form</b> hat ihn auf der <b>E-Saite</b>, die <b>A-Form</b> auf der <b>A-Saite</b>. Form kennen + Grundton finden = jeder Dur- und Moll-Akkord.</p>`,
    demo: el => pickerDemo(el, {
      start: 7, toggles: [['dur', 'Dur'], ['moll', 'Moll']],
      boards: [
        (pc, m) => {
          const r = (pc - 4 + 12) % 12;
          const sh = [[0, r], [1, r + 2], [2, r + 2], [3, r + (m === 'dur' ? 1 : 0)], [4, r], [5, r]].map(([s, f]) => ({ s, f }));
          return barreBoard(`E-Form: ${T.sharpName(pc)}${m === 'dur' ? '' : 'm'}`, sh, pc, r, 0);
        },
        (pc, m) => {
          const r = (pc - 9 + 12) % 12;
          const sh = [[1, r], [2, r + 2], [3, r + 2], [4, r + (m === 'dur' ? 2 : 1)], [5, r]].map(([s, f]) => ({ s, f }));
          return barreBoard(`A-Form: ${T.sharpName(pc)}${m === 'dur' ? '' : 'm'}`, sh, pc, r, 1);
        },
      ],
    }),
  },
  penta: {
    title: () => 'Skalen starten am Grundton',
    body: () => `<p>Die <b>Moll-Pentatonik</b> (die Rock- und Blues-Solo-Skala) beginnt in ihrer bekanntesten Form am <b>Grundton auf der E-Saite</b>. Weißt du, wo A liegt (Bund 5), weißt du, wo die A-Moll-Pentatonik liegt.</p>
      <p class="muted">Die hervorgehobenen Punkte sind die Grundtöne – genau die, die du hier lernst.</p>`,
    demo: el => pickerDemo(el, {
      start: 9,
      boards: [pc => {
        const r = (pc - 4 + 12) % 12;
        const steps = [[0, 3], [0, 2], [0, 2], [0, 2], [0, 3], [0, 3]];
        const ps = [];
        steps.forEach((st, s) => st.forEach(d => ps.push({ s, f: r + d })));
        return { title: `${T.sharpName(pc)}-Moll-Pentatonik`, win: win(ps, 5), marks: ps.map(p => dot(p, T.pcAt(p.s, p.f) === pc ? 'root' : 'note')), play: ps.map(midi), gap: 0.2 };
      }],
    }),
  },
};

function barreBoard(title, sh, pc, r, rs) {
  const lines = r > 0 ? [{ a: { s: rs, f: r }, b: { s: 5, f: r }, cls: 'barre' }] : [];
  return { title, win: win(sh, 5), marks: sh.map(p => dot(p, T.pcAt(p.s, p.f) === pc ? 'root' : 'note')), lines, play: sh.map(midi), strum: true, cap: r > 0 ? `Barré auf Bund ${r}` : 'Offener Akkord – kein Barré nötig' };
}

export const GROUPS = [
  { title: 'Oktav-Formen', intro: 'Kennst du einen Ton auf der E- oder A-Saite, findest du ihn mit diesen Formen überall.', ids: ['oct2', 'octKnick', 'oct3', 'eE', 'chain'] },
  { title: 'Stimm-Logik', intro: 'Wie die Saiten zueinander gestimmt sind – damit leitest du jeden Ton von einem bekannten ab.', ids: ['fret5', 'shift'] },
  { title: 'Brücke zu Akkorden & Skalen', intro: 'Wofür du das alles lernst: Grundton finden, Form anlegen, spielen.', ids: ['power', 'barre', 'penta'] },
];

export function tipCard(id) {
  const t = TIPS[id], card = document.createElement('article');
  card.className = 'card tip';
  card.innerHTML = `<h3>${t.title()}</h3><div class="tip-body">${t.body()}</div><div class="demo"></div>`;
  t.demo(card.querySelector('.demo'));
  return card;
}
