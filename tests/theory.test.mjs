// node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../js/theory.js';

test('Töne auf dem Griffbrett', () => {
  assert.equal(T.noteName(T.pcAt(0, 5)), 'A');
  assert.equal(T.noteName(T.pcAt(1, 3)), 'C');
  assert.equal(T.noteName(T.pcAt(3, 4)), 'B');
  assert.equal(T.noteName(T.pcAt(0, 6)), 'A♯/B♭');
  assert.equal(T.noteName(T.pcAt(5, 12)), 'E');
});

test('deutsche Schreibweise', () => {
  T.setHNames(true);
  assert.equal(T.noteName(11), 'H');
  assert.equal(T.noteName(10), 'A♯/B');
  assert.equal(T.spell(6, -1), 'B');
  assert.equal(T.answerPc(6, -1), 10);
  assert.equal(T.stringShort(4), 'H');
  T.setHNames(false);
  assert.equal(T.noteName(11), 'B');
});

test('Oktav-Verschiebungen', () => {
  const cases = [[0, 2, 2], [1, 3, 2], [2, 4, 3], [3, 5, 3], [0, 3, -3], [1, 4, -2], [2, 5, -2], [0, 5, 0], [3, 4, -4], [0, 1, -5]];
  for (const [a, b, d] of cases) assert.equal(T.sameNoteShift(a, b), d, `${a}→${b}`);
  for (let s1 = 0; s1 < 6; s1++) for (let s2 = s1 + 1; s2 < 6; s2++) for (let f = 0; f <= 12; f++)
    assert.equal(T.pcAt(s2, f + T.sameNoteShift(s1, s2)), T.pcAt(s1, f));
});

test('Herleitungen stimmen immer', () => {
  for (const max of [12, 24]) for (let s = 0; s < 6; s++) for (let f = 0; f <= max; f++) {
    const ex = T.explain(s, f, max);
    if (ex.ref && !ex.ref.anchor) {
      assert.equal(T.pcAt(ex.ref.s, ex.ref.f), T.pcAt(s, f), `ref ${s}/${f}`);
      assert.ok(ex.ref.f >= 0 && ex.ref.f <= max, `ref im Bereich ${s}/${f}`);
    }
    if (f >= 1) assert.ok(ex.lines.length > 0, `Erklärung fehlt für ${s}/${f}`);
  }
});

test('Stammtöne pro Saite (0–12)', () => {
  assert.equal(T.positions({ strings: [0], notes: 'naturals', open: true }).length, 8);
  assert.equal(T.positions({ notes: 'accidentals' }).length, 6 * 5);
});

test('ungewöhnliche Schreibweisen', () => {
  assert.ok(T.oddSpelling(2, 1));  // E♯
  assert.ok(T.oddSpelling(0, -1)); // C♭
  assert.ok(!T.oddSpelling(3, 1)); // F♯
});
