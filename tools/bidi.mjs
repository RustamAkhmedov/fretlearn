// Browser-Test mit Firefox headless über WebDriver BiDi (kein headless Chrome – hängt auf diesem Laptop).
// Aufruf: W=390 H=844 node tools/bidi.mjs http://127.0.0.1:8765/ tools/steps.json <ausgabeordner>
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
const [url, stepsFile, outDir] = process.argv.slice(2);
const steps = JSON.parse(readFileSync(stepsFile, 'utf8'));
const PORT = process.env.PORT || '9336', W = +(process.env.W || 390), H = +(process.env.H || 844);
mkdirSync(outDir, { recursive: true });
const prof = outDir + '/ff-prof-' + PORT; rmSync(prof, { recursive: true, force: true }); mkdirSync(prof);
const ff = spawn('firefox', ['--headless', '--remote-debugging-port=' + PORT, '--profile', prof], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let sock;
for (let i = 0; i < 60; i++) { try { sock = new WebSocket('ws://127.0.0.1:' + PORT + '/session'); await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; }); break; } catch { sock = null; await sleep(300); } }
if (!sock) { console.log('keine Verbindung'); ff.kill(); process.exit(1); }
let id = 0; const pend = new Map();
sock.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else if (d.method === 'log.entryAdded') console.log('[' + d.params.level + ']', d.params.text); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
await send('session.new', { capabilities: {} });
await send('session.subscribe', { events: ['log.entryAdded'] });
const tree = await send('browsingContext.getTree', {}); const ctx = tree.result.contexts[0].context;
await send('browsingContext.setViewport', { context: ctx, viewport: { width: W, height: H } });
await send('browsingContext.navigate', { context: ctx, url, wait: 'complete' });
const ev = async expr => { const r = await send('script.evaluate', { expression: expr, target: { context: ctx }, awaitPromise: true, resultOwnership: 'none' }); if (r.type === 'error' || r.result?.type === 'exception') { console.log('[evalERR]', JSON.stringify(r.result?.exceptionDetails?.text || r).slice(0, 400)); return undefined; } const v = r.result.result; return v.value !== undefined ? v.value : v.type; };
for (const st of steps) {
  if (st.nav) await send('browsingContext.navigate', { context: ctx, url: st.nav, wait: 'complete' });
  if (st.eval) { const v = await ev(st.eval); if (st.label !== false) console.log((st.label || 'eval') + ' =>', typeof v === 'object' ? JSON.stringify(v) : v); }
  if (st.click) { // echter Klick auf Element-Mitte
    const c = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(st.click)}); if(!e) return null; const r=e.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2];})()`);
    if (!c) console.log('click: nicht gefunden', st.click);
    else await send('input.performActions', { context: ctx, actions: [{ type: 'pointer', id: 'p', parameters: { pointerType: 'mouse' }, actions: [{ type: 'pointerMove', x: Math.round(c[0]), y: Math.round(c[1]) }, { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 }] }] });
  }
  if (st.wait) await sleep(st.wait);
  if (st.shot) { const r = await send('browsingContext.captureScreenshot', { context: ctx, origin: st.full ? 'document' : 'viewport' }); if (r.result) { writeFileSync(outDir + '/' + st.shot, Buffer.from(r.result.data, 'base64')); console.log('shot', st.shot); } else console.log('shot fail', JSON.stringify(r).slice(0, 300)); }
}
await send('session.end', {}); sock.close(); ff.kill();
rmSync(prof, { recursive: true, force: true });
