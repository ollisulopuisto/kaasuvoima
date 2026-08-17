/**
 * Scratch leak hunter for the randomly failing speech tests.
 *
 *   node tools/repro-leak.mjs [--seconds N]
 *
 * Wraps ctx.createBufferSource/createOscillator so every sound source created
 * after the wrap is tracked, then simulates what verify.mjs does for minutes:
 * random game sounds plus the attract demo, which runs on the real loop. Every
 * few seconds it asks two questions:
 *
 *   1. Is the sfx bus floor (tapped the way the speech tests tap it) growing?
 *   2. Is any source still alive (started, never stopped, loop=true)?
 *
 * A source that started, loops and never stops *is* the leak — the thing the
 * speech tests hear as a constant tone under their words.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 8152);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const rel = normalize(url === '/' ? '/index.html' : url).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': MIME[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

let chromium;
try {
  ({ chromium } = await import(process.env.PW_MODULE || 'playwright'));
} catch {
  console.error('playwright is missing.');
  process.exit(2);
}

const seconds = Number(process.argv[process.argv.indexOf('--seconds') + 1]) || 130;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const out = await page.evaluate(async ({ seconds }) => {
  const { audioTap, Sfx, Music } = await import('/src/core/audio.js');
  const game = window.sfb3;
  const tap = audioTap();
  const ctx = tap.ctx;

  /* --- instrument: every source/oscillator created from now on is tracked --- */
  const live = { src: [], osc: [] };
  const wrap = (kind, method) => {
    const orig = ctx[method].bind(ctx);
    ctx[method] = (...args) => {
      const n = orig(...args);
      if (kind === 'src' || kind === 'osc') {
        const rec = { stopped: false, start: 0, loop: !!n.loop };
        try { n.addEventListener('ended', () => { rec.stopped = true; }); } catch {}
        const s0 = n.start.bind(n);
        n.start = (...a) => { rec.start++; return s0(...a); };
        const p0 = n.stop.bind(n);
        n.stop = (...a) => { rec.stopped = true; return p0(...a); };
        live[kind].push(rec);
      }
      return n;
    };
  };
  wrap('src', 'createBufferSource');
  wrap('osc', 'createOscillator');
  wrap('src', 'createConstantSource');
  wrap('src', 'createMediaElementSource');

  Music.stop();

  /* --- analyse it the same way the speech tests do --- */
  const an = ctx.createAnalyser();
  an.fftSize = 2048;
  tap.bus.connect(an);
  const buf = new Float32Array(an.fftSize);
  const floor = async (ms) => {
    let peak = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      an.getFloatTimeDomainData(buf);
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
      await new Promise((r) => setTimeout(r, 8));
    }
    return peak;
  };

  const zone = () => {
    const s = game.scene;
    return s ? `${s.constructor.name}${s.tick !== undefined ? '@' + s.tick : ''}` : '?';
  };

  const names = ['jump', 'bigjump', 'coin', 'fart', 'brick', 'burst', 'stomp',
    'door', 'pipe', 'sprout', 'powerup', 'oneup', 'slam', 'bump', 'kick',
    'kurnutus', 'loikka', 'spikes', 'yeah', 'clear', 'death', 'upota'];

  const rows = [];
  const t0 = performance.now();
  let nextSound = t0;
  while (performance.now() - t0 < seconds * 1000) {
    const now = performance.now();
    if (now > nextSound) {
      Sfx.play(names[(Math.random() * names.length) | 0]);
      nextSound = now + 220 + Math.random() * 400;
    }
    if (Math.random() < 0.02) Sfx.play('powerdown');

    if (rows.length === 0 || now - rows[rows.length - 1].t > 5000) {
      const f = await floor(200);
      const aliveSrc = live.src.filter((r) => r.start > 0 && !r.stopped);
      const aliveOsc = live.osc.filter((r) => r.start > 0 && !r.stopped);
      // The nodes here are all *created after* the wrap: this is what the
      // speech tests would be hearing on top of their own sounds.
      const srcInfo = aliveSrc.map((r) =>
        `loop=${r.loop} stop=${r.stop}:${r.stopped ? 'y' : 'N'}`).slice(0, 4);
      rows.push({
        t: Math.round(now - t0),
        floor: Number(f.toFixed(3)),
        scene: zone(),
        nSrc: aliveSrc.length,
        nOsc: aliveOsc.length,
        srcInfo,
      });
    }
    await new Promise((r) => setTimeout(r, 60));
  }
  return rows;
}, { seconds });

await browser.close();
server.close();

console.log(`\nrepro-leak ${seconds} s — ${out.length} näytettä\n`);
console.log('    t (s)  sfx-floor  scene         elävät src/osc');
for (const r of out) {
  const bad = r.nSrc + r.nOsc > 0 ? `  <== ${r.srcInfo.join(' | ')}` : '';
  console.log(`  ${String(r.t).padStart(6)}  ${String(r.floor).padStart(8)}  `
    + `${r.scene.padEnd(14)}  ${r.nSrc}/${r.nOsc}${bad}`);
}
