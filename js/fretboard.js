// SVG-Griffbrett. Hochkant (Handy: Sattel oben, tiefe E links) oder quer (PC/Mini: hohe e oben).
// Markierungen: setMarks([{ s, f, cls, label }], [{ a:{s,f}, b:{s,f}, cls }])
import { stringShort } from './theory.js';

const NS = 'http://www.w3.org/2000/svg';
const DOTS = [3, 5, 7, 9, 15, 17, 19, 21], DOUBLE = [12, 24];
const GAUGE = [3.4, 2.8, 2.3, 1.7, 1.25, 0.95];
const MQ = '(max-width: 760px)';
let uid = 0;

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

export class Fretboard {
  constructor(host, opts = {}) {
    this.host = host;
    this.o = { from: 0, to: 12, orient: 'auto', mini: false, fit: true, onTap: null, ...opts };
    this.id = 'fb' + ++uid;
    this.marks = []; this.lines = []; this.active = null;
    if (this.o.orient === 'auto') {
      this.mq = matchMedia(MQ);
      this.onMq = () => this.render();
      this.mq.addEventListener('change', this.onMq);
    }
    this.render();
  }
  destroy() { this.mq?.removeEventListener('change', this.onMq); this.host.innerHTML = ''; }
  get vertical() { return this.o.orient === 'v' || (this.o.orient === 'auto' && matchMedia(MQ).matches); }

  render() {
    const o = this.o, V = this.vertical, mini = o.mini, id = this.id;
    const SP = mini ? 24 : V ? 50 : 36;
    const base = mini ? 38 : V ? 46 : 66;
    const taper = mini ? 0.985 : 0.972;
    const OZ = o.from === 0 ? (mini ? 28 : V ? 40 : 46) : 10;
    const NT = o.from === 0 ? (mini ? 4 : 7) : 0;
    const LBL = mini ? 16 : 22, FN = mini ? 16 : V ? 26 : 22;
    const ACROSS = SP * 6;

    const cells = {}, wires = [];
    let u;
    if (o.from === 0) { cells[0] = [0, OZ]; u = OZ + NT; } else { u = OZ; wires.push(u); }
    for (let f = Math.max(1, o.from); f <= o.to; f++) {
      const L = base * Math.pow(taper, f - 1);
      cells[f] = [u, u + L]; u += L; wires.push(u);
    }
    const U = u + (mini ? 4 : 8);
    const map = V ? (a, b) => [FN + b, LBL + a] : (a, b) => [LBL + a, 4 + ACROSS - b];
    const W = V ? FN + ACROSS + 4 : LBL + U, H = V ? LBL + U : 4 + ACROSS + FN;
    const vS = s => SP * (s + 0.5);
    const rect = (a0, a1, b0, b1, attrs, parent) => {
      const [x0, y0] = map(a0, b0), [x1, y1] = map(a1, b1);
      return el('rect', { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0), ...attrs }, parent);
    };
    const line = (a0, b0, a1, b1, attrs, parent) => {
      const [x1, y1] = map(a0, b0), [x2, y2] = map(a1, b1);
      return el('line', { x1, y1, x2, y2, ...attrs }, parent);
    };
    let minCell = Infinity;
    for (const f in cells) minCell = Math.min(minCell, cells[f][1] - cells[f][0]);
    this.g = { cells, map, vS, r: Math.min(SP, minCell) * (mini ? 0.4 : 0.38) };

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fb ' + (V ? 'fb-v' : 'fb-h') + (mini ? ' fb-mini' : ''), role: 'img', 'aria-label': 'Griffbrett' });
    const fit = o.fit && !(V && o.to > 12);
    if (fit) { svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); }
    else svg.classList.add('fb-flow');

    const defs = el('defs', {}, svg);
    const wood = el('linearGradient', { id: id + 'w', x1: 0, y1: 0, x2: V ? 1 : 0, y2: V ? 0 : 1 }, defs);
    [['0', '#3b2417'], ['.18', '#2e1b11'], ['.5', '#352015'], ['.82', '#2b190f'], ['1', '#3d2518']].forEach(([off, c]) => el('stop', { offset: off, 'stop-color': c }, wood));
    const pearl = el('radialGradient', { id: id + 'p', cx: '.4', cy: '.35', r: '.7' }, defs);
    el('stop', { offset: '0', 'stop-color': '#fbf7ee' }, pearl);
    el('stop', { offset: '.6', 'stop-color': '#ddd5c5' }, pearl);
    el('stop', { offset: '1', 'stop-color': '#b9ae9a' }, pearl);

    // Holz + Maserung
    const woodStart = o.from === 0 ? OZ : 0;
    rect(woodStart, U, 0, ACROSS, { fill: `url(#${id}w)`, rx: mini ? 3 : 4 }, svg);
    const grain = el('g', { class: 'grain' }, svg), rand = rng(7 + o.from * 13 + o.to);
    for (let i = 0; i < (mini ? 14 : 30); i++) {
      const b = rand() * ACROSS;
      line(woodStart, b, U, b + (rand() - 0.5) * 3, { stroke: rand() < 0.5 ? '#000' : '#6b4630', 'stroke-opacity': (0.08 + rand() * 0.16).toFixed(2), 'stroke-width': (0.4 + rand() * 1.4).toFixed(2) }, grain);
    }
    // Einlagen
    const inl = el('g', { class: 'inlays' }, svg), ir = SP * (mini ? 0.17 : 0.16);
    for (let f = Math.max(1, o.from); f <= o.to; f++) {
      const [a0, a1] = cells[f], a = (a0 + a1) / 2;
      const bs = DOTS.includes(f) ? [SP * 3] : DOUBLE.includes(f) ? [SP * 2, SP * 4] : [];
      for (const b of bs) { const [cx, cy] = map(a, b); el('circle', { cx, cy, r: ir, fill: `url(#${id}p)`, opacity: 0.9 }, inl); }
    }
    // Bundstäbe + Sattel
    for (const w of wires) {
      line(w, 0, w, ACROSS, { stroke: '#7d7a76', 'stroke-width': mini ? 2.2 : 3.4 }, svg);
      line(w - 0.5, 0, w - 0.5, ACROSS, { stroke: '#eceae4', 'stroke-width': mini ? 0.7 : 1.1, 'stroke-opacity': 0.85 }, svg);
    }
    if (o.from === 0) rect(OZ, OZ + NT, -1, ACROSS + 1, { fill: '#e9dfc7', rx: 1.5 }, svg);
    // Saiten
    this.strEls = [];
    const strs = el('g', { class: 'strings' }, svg);
    for (let s = 0; s < 6; s++) {
      const b = vS(s), w = GAUGE[s] * (mini ? 0.8 : 1);
      const g = el('g', { class: 'str', 'data-s': s }, strs);
      line(0, b - 1.2, U, b - 1.2, { stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': w + 0.6 }, g);
      line(0, b, U, b, { stroke: s < 3 ? '#c9bfae' : '#dcdad6', 'stroke-width': w }, g);
      if (s < 3) line(0, b, U, b, { stroke: '#6e6559', 'stroke-width': w, 'stroke-dasharray': '0.7 1.1', 'stroke-opacity': 0.55 }, g);
      this.strEls.push(g);
    }
    // Saitennamen
    this.lblEls = [];
    for (let s = 0; s < 6; s++) {
      const [x, y] = V ? [FN + vS(s), LBL - 7] : [LBL / 2, 4 + ACROSS - vS(s)];
      const t = el('text', { x, y, class: 'slabel', 'text-anchor': 'middle', 'dominant-baseline': V ? 'auto' : 'central' }, svg);
      t.textContent = stringShort(s);
      this.lblEls.push(t);
    }
    // Bundnummern
    for (let f = Math.max(1, o.from); f <= o.to; f++) {
      const a = (cells[f][0] + cells[f][1]) / 2;
      const [x, y] = V ? [FN / 2 - 1, LBL + a] : [LBL + a, 4 + ACROSS + FN * 0.62];
      const t = el('text', { x, y, class: 'fnum' + (DOTS.includes(f) || DOUBLE.includes(f) ? ' dot' : ''), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, svg);
      t.textContent = f;
    }
    this.gLines = el('g', { class: 'mlines' }, svg);
    this.gMarks = el('g', { class: 'marks' }, svg);
    // Tipp-Flächen
    this.hitEls = [];
    const hits = el('g', { class: 'hits' }, svg);
    for (let s = 0; s < 6; s++) for (let f = o.from; f <= o.to; f++) {
      const [a0, a1] = cells[f];
      const r = rect(a0, a1, SP * s, SP * (s + 1), { class: 'hit', 'data-s': s, 'data-f': f, fill: 'transparent' }, hits);
      this.hitEls.push(r);
    }
    svg.addEventListener('click', e => {
      const h = e.target.closest('.hit');
      if (h && this.o.onTap) this.o.onTap(+h.dataset.s, +h.dataset.f, e);
    });

    this.svg = svg;
    this.host.innerHTML = '';
    this.host.appendChild(svg);
    this.applyActive();
    this.draw();
  }

  center(s, f) {
    const [a0, a1] = this.g.cells[f];
    return this.g.map(f === 0 ? (a0 + a1) / 2 : a0 + (a1 - a0) * 0.55, this.g.vS(s));
  }
  has(s, f) { return f >= this.o.from && f <= this.o.to && s >= 0 && s < 6; }

  setMarks(marks = [], lines = []) { this.marks = marks; this.lines = lines; this.draw(); }

  draw() {
    if (!this.svg) return;
    this.gLines.innerHTML = ''; this.gMarks.innerHTML = '';
    for (const ln of this.lines) {
      if (!this.has(ln.a.s, ln.a.f) || !this.has(ln.b.s, ln.b.f)) continue;
      const [x1, y1] = this.center(ln.a.s, ln.a.f), [x2, y2] = this.center(ln.b.s, ln.b.f);
      el('line', { x1, y1, x2, y2, class: 'mline ' + (ln.cls || '') }, this.gLines);
    }
    for (const m of this.marks) this.dot(m, this.gMarks);
  }

  dot(m, parent) {
    if (!this.has(m.s, m.f)) return null;
    const [cx, cy] = this.center(m.s, m.f), r = this.g.r * (m.big ? 1.12 : 1);
    const g = el('g', { class: 'mark ' + (m.cls || 'note') }, parent);
    if (m.cls?.includes('target')) el('circle', { cx, cy, r: r * 1.15, class: 'pulse' }, g);
    el('circle', { cx, cy, r, class: 'disc' }, g);
    if (m.label) {
      const parts = String(m.label).split('/');
      if (parts.length === 2) {
        const fs = r * 0.62;
        const t1 = el('text', { x: cx, y: cy - fs * 0.5, 'font-size': fs }, g); t1.textContent = parts[0];
        const t2 = el('text', { x: cx, y: cy + fs * 0.55, 'font-size': fs }, g); t2.textContent = parts[1];
      } else {
        const t = el('text', { x: cx, y: cy, 'font-size': r * (parts[0].length > 2 ? 0.72 : 0.92) }, g);
        t.textContent = parts[0];
      }
    }
    return g;
  }

  flash(m, ms = 900) {
    const g = this.dot({ ...m, cls: (m.cls || '') + ' flash' }, this.gMarks);
    if (g) setTimeout(() => g.remove(), ms);
  }

  // nur diese Saiten sind aktiv (null = alle)
  setActive(strings) { this.active = strings ? new Set(strings) : null; this.applyActive(); }
  applyActive() {
    if (!this.strEls) return;
    const on = s => !this.active || this.active.has(s);
    this.strEls.forEach((g, s) => g.classList.toggle('dim', !on(s)));
    this.lblEls.forEach((t, s) => { t.classList.toggle('dim', !on(s)); t.classList.toggle('on', !!this.active && on(s)); });
    this.hitEls.forEach(h => h.classList.toggle('off', !on(+h.dataset.s)));
  }

  reveal(s, f) {
    const host = this.host;
    if (host.scrollHeight <= host.clientHeight + 4 && host.scrollWidth <= host.clientWidth + 4) return;
    const [x, y] = this.center(s, f), vb = this.svg.viewBox.baseVal, sc = this.svg.clientWidth / vb.width;
    host.scrollTo({ top: y * sc - host.clientHeight / 2, left: x * sc - host.clientWidth / 2, behavior: 'smooth' });
  }
}
