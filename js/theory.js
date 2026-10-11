// Musiktheorie rund ums Griffbrett: Töne, Namen, Positionen und Herleitungen.
// Saiten-Index 0 = tiefe E-Saite … 5 = hohe e-Saite.

export const TUNING = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4 (MIDI)
const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const NATURAL = new Set(LETTER_PC);

// Deutsche Schreibweise: B → H, B♭ → B
let H = false;
export const setHNames = v => { H = !!v; };
const fixH = n => !H ? n : n === 'B' ? 'H' : n === 'B♭' ? 'B' : n;

export const pcAt = (s, f) => (TUNING[s] + f) % 12;
export const midiAt = (s, f) => TUNING[s] + f;
export const key = (s, f) => s + '-' + f;
export const isNatural = pc => NATURAL.has(pc);
export const sharpName = pc => fixH(SHARP[pc]);
export const flatName = pc => fixH(FLAT[pc]);
export const noteName = pc => isNatural(pc) ? sharpName(pc) : sharpName(pc) + '/' + flatName(pc);
export const letters = () => ['C', 'D', 'E', 'F', 'G', 'A', H ? 'H' : 'B'];
export function spell(i, acc) {
  if (H && i === 6 && acc < 0) return 'B';
  return letters()[i] + (acc > 0 ? '♯' : acc < 0 ? '♭' : '');
}
export const answerPc = (i, acc) => (LETTER_PC[i] + acc + 12) % 12;
// E♯, B♯, C♭, F♭ – klingen richtig, sagt man aber nicht
export const oddSpelling = (i, acc) => (acc > 0 && (i === 2 || i === 6)) || (acc < 0 && (i === 0 || i === 3));

export const stringShort = s => s === 4 ? fixH('B') : ['E', 'A', 'D', 'G', 'B', 'e'][s];
// case: 'nom' (die tiefe E-Saite) oder 'dat' (auf der tiefen E-Saite)
export function stringName(s, c = 'nom') {
  if (s === 0) return c === 'dat' ? 'tiefen E-Saite' : 'tiefe E-Saite';
  if (s === 5) return c === 'dat' ? 'hohen e-Saite' : 'hohe e-Saite';
  return stringShort(s) + '-Saite';
}

export function positions({ strings = [0, 1, 2, 3, 4, 5], from = 0, to = 12, notes = 'all', open = false } = {}) {
  const out = [];
  for (const s of strings) for (let f = Math.max(from, open ? 0 : 1); f <= to; f++) {
    const n = isNatural(pcAt(s, f));
    if ((notes === 'naturals' && !n) || (notes === 'accidentals' && n)) continue;
    out.push({ s, f });
  }
  return out;
}

// Bund-Verschiebung für denselben Ton (nächste Oktave) von Saite s1 auf Saite s2
export function sameNoteShift(s1, s2) {
  const d = TUNING[s2] - TUNING[s1];
  return 12 * Math.round(d / 12) - d;
}

export const powerShape = (s, f) => [{ s, f }, { s: s + 1, f: f + 2 }, { s: s + 2, f: f + 2 }];

const ANCHORS = [0, 3, 5, 7, 12, 15, 17, 19, 24];
const frets = n => n === 1 ? 'Bund' : 'Bünde';

// Herleitung eines Tons: kurze Merksätze + optional eine Referenzposition mit gleichem Ton
export function explain(s, f, max = 24) {
  const pc = pcAt(s, f), name = noteName(pc), nat = isNatural(pc), lines = [];
  let ref = null;
  if (!nat) lines.push(`Liegt zwischen ${sharpName(pcAt(s, f - 1))} (Bund ${f - 1}) und ${sharpName(pcAt(s, f + 1))} (Bund ${f + 1}) → ${sharpName(pc)} = ${flatName(pc)}.`);
  if (f === 0) lines.push(`Leere ${stringName(s)}: ${name}.`);
  else if (f % 12 === 0) { lines.push(`Bund ${f} = leere Saite, ${f === 12 ? 'eine Oktave' : 'zwei Oktaven'} höher → ${name}.`); ref = { s, f: 0 }; }
  else if (f > 12) { lines.push(`Ab Bund 12 wiederholt sich alles: Bund ${f} = Bund ${f - 12} → ${name}.`); ref = { s, f: f - 12 }; }
  else if ((f === 5 && s < 5 && s !== 3) || (f === 4 && s === 3)) { lines.push(`Stimm-Logik: Bund ${f} klingt wie die leere ${stringName(s + 1)} → ${name}.`); ref = { s: s + 1, f: 0 }; }
  else if (s === 5) { lines.push(`Die hohe e-Saite hat dieselben Töne wie die tiefe E-Saite: Bund ${f} → ${name}.`); ref = { s: 0, f }; }
  else if ((s === 2 || s === 3) && f >= 2) { lines.push(`Oktav-Form (2 Saiten, 2 Bünde): ${stringName(s - 2)}, Bund ${f - 2} ist auch ${name}.`); ref = { s: s - 2, f: f - 2 }; }
  else if (s === 4 && f + 2 <= max) { lines.push(`Oktav-Form (3 Saiten, 2 Bünde): A-Saite, Bund ${f + 2} ist auch ${name}.`); ref = { s: 1, f: f + 2 }; }
  else if (s === 4 && f >= 3) { lines.push(`Oktav-Form mit ${stringShort(4)}-Knick: D-Saite, Bund ${f - 3} ist auch ${name}.`); ref = { s: 2, f: f - 3 }; }
  else if (s <= 1 && nat) {
    let best = null;
    for (const a of ANCHORS) {
      if (a === f || a > max || !isNatural(pcAt(s, a))) continue;
      const d = Math.abs(a - f);
      if (!best || d < best.d) best = { a, d };
    }
    if (best) {
      lines.push(`${sharpName(pcAt(s, best.a))} ${best.a ? 'liegt auf Bund ' + best.a : 'ist die leere Saite'} – von dort ${best.d} ${frets(best.d)} ${f > best.a ? 'weiter' : 'zurück'} → ${name}.`);
      ref = { s, f: best.a, anchor: true };
    }
  }
  return { lines: lines.slice(0, 2), ref };
}
