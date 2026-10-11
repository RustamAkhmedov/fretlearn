// Gezupfter Gitarrenton per Karplus-Strong – ohne Sample-Dateien.
let ctx = null, out = null, enabled = true;
const cache = new Map();

export const setEnabled = v => { enabled = !!v; };

// Muss nach einer Nutzer-Geste laufen (Autoplay-Regeln)
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 4200;
    const comp = ctx.createDynamicsCompressor();
    out = ctx.createGain(); out.gain.value = 0.55;
    out.connect(lp).connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function buffer(midi) {
  if (cache.has(midi)) return cache.get(midi);
  const sr = ctx.sampleRate, freq = 440 * 2 ** ((midi - 69) / 12);
  const N = Math.max(2, Math.round(sr / freq)), len = Math.floor(sr * 2.2);
  const d = new Float32Array(len);
  // weiches Rauschen als Anschlag
  let prev = 0;
  for (let i = 0; i < N; i++) { prev = prev * 0.45 + (Math.random() * 2 - 1) * 0.55; d[i] = prev; }
  let mean = 0; for (let i = 0; i < N; i++) mean += d[i] / N;
  for (let i = 0; i < N; i++) d[i] -= mean;
  // Abklingzeit: tiefe Saiten klingen länger
  const T60 = Math.max(0.9, 2.8 - (midi - 40) * 0.045);
  const rho = Math.pow(10, -3 / (T60 * freq));
  for (let i = N; i < len; i++) d[i] = rho * 0.5 * (d[i - N] + d[i - N - 1 < 0 ? 0 : i - N - 1]);
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  const fade = Math.floor(sr * 0.25);
  for (let i = 0; i < len; i++) {
    let g = 1 / (peak || 1);
    if (i < 64) g *= i / 64;
    if (i > len - fade) g *= (len - i) / fade;
    d[i] *= g;
  }
  const b = ctx.createBuffer(1, len, sr);
  b.copyToChannel(d, 0);
  cache.set(midi, b);
  return b;
}

export function play(midi, delay = 0, vol = 0.9) {
  if (!enabled) return;
  unlock();
  if (!ctx) return;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buffer(midi); g.gain.value = vol;
  src.connect(g).connect(out);
  src.start(ctx.currentTime + delay + 0.01);
}

export const strum = (midis, gap = 0.035) => midis.forEach((m, i) => play(m, i * gap, 0.6));
export const seq = (midis, gap = 0.32) => midis.forEach((m, i) => play(m, i * gap));
