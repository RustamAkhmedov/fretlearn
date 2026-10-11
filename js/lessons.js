// Lernpfad: Lektionen mit Fokus-Bereich, Fragen-Mix und passenden Tipps.
import * as T from './theory.js';
import * as S from './store.js';

const N = 'naturals', ALL = [0, 1, 2, 3, 4, 5];

export const LESSONS = [
  {
    id: 'e', title: () => 'Tiefe E-Saite', sub: 'Die Stammtöne auf der dicksten Saite', tips: ['anchorsE'],
    focus: { strings: [0], notes: N },
    mix: [{ type: 'name', w: 1 }, { type: 'find', w: 1 }],
  },
  {
    id: 'a', title: () => 'A-Saite', sub: 'Die zweite Grundton-Saite – plus Wiederholung der E-Saite', tips: ['anchorsA'],
    focus: { strings: [1], notes: N },
    mix: [{ type: 'name', w: 0.4 }, { type: 'find', w: 0.4 }, { type: 'name', w: 0.2, scope: { strings: [0], notes: N } }],
  },
  {
    id: 'oct', title: () => 'Oktav-Formen', sub: 'Von E und A aus die D- und G-Saite erobern', tips: ['oct2', 'oct3'],
    focus: { strings: [2, 3], notes: N },
    mix: [{ type: 'octave', w: 1, sources: [0, 1] }],
  },
  {
    id: 'dg', title: () => 'D- und G-Saite', sub: 'Jetzt ohne Hilfe – mit Stimm-Logik als Rettungsanker', tips: ['fret5', 'shift'],
    focus: { strings: [2, 3], notes: N },
    mix: [{ type: 'name', w: 0.35 }, { type: 'find', w: 0.3 }, { type: 'octave', w: 0.15, sources: [0, 1] }, { type: 'name', w: 0.2, scope: { strings: [0, 1], notes: N } }],
  },
  {
    id: 'be', title: () => `${T.stringShort(4)}- und hohe e-Saite`, sub: 'Die zwei dünnen Saiten – eine davon kennst du schon', tips: ['eE', 'octKnick'],
    focus: { strings: [4, 5], notes: N },
    mix: [{ type: 'name', w: 0.35 }, { type: 'find', w: 0.35 }, { type: 'name', w: 0.3, scope: { strings: [0, 1, 2, 3], notes: N } }],
  },
  {
    id: 'acc', title: () => '♯ und ♭', sub: 'Die Töne dazwischen – jeder hat zwei Namen', tips: ['accidentals'],
    focus: { strings: ALL, notes: 'accidentals' },
    mix: [{ type: 'name', w: 0.4 }, { type: 'find', w: 0.3 }, { type: 'name', w: 0.3, scope: { strings: ALL, notes: N } }],
  },
  {
    id: 'mix', title: () => 'Alles gemischt', sub: 'Das ganze Griffbrett, alle Modi – auch „Alle finden“', tips: ['chain'],
    focus: { strings: ALL, notes: 'all' },
    mix: [{ type: 'name', w: 0.4 }, { type: 'find', w: 0.3 }, { type: 'findAll', w: 0.3 }],
  },
  {
    id: 'chords', title: () => 'Brücke zu Akkorden', sub: 'Grundtöne auf E und A → Powerchords, Barré & Skalen', tips: ['power', 'barre', 'penta'],
    focus: { strings: [0, 1], notes: 'all' },
    mix: [{ type: 'chordRoot', w: 0.5 }, { type: 'chordName', w: 0.5 }],
  },
];

export const lessonById = id => LESSONS.find(l => l.id === id);

// Anteil "sicherer" Positionen im Fokus der Lektion (Bund 1–12)
export function lessonProgress(l) {
  const ps = T.positions({ ...l.focus, from: 0, to: 12 });
  return ps.length ? ps.filter(p => S.isSafe(p.s, p.f)).length / ps.length : 0;
}

export function lessonConfig(l, len) {
  return {
    title: l.title(), len, from: 0, to: 12, lessonId: l.id,
    mix: l.mix.map(m => ({ ...m, scope: { ...l.focus, ...m.scope } })),
  };
}

export const nextLesson = () => LESSONS.find(l => lessonProgress(l) < 0.9) || LESSONS[LESSONS.length - 1];
