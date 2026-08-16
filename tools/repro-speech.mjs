/**
 * Scratch repro + observation driver for the randomly failing speech tests.
 *
 *   node tools/repro-speech.mjs [--kill-demo] [--seconds N]
 *
 * Opens the game exactly like verify.mjs does and then watches the sfx bus
 * (the same tap the speech tests read) while the real main loop runs. The
 * title screen starts the attract demo after 20 s of no input; the demo runs
 * a real LevelScene whose sounds land on this same bus.
 *
 * --kill-demo cancels the demo every second, so an untouched game never gets
 * to play itself. Comparing the two traces is the experiment: if the bus is
 * clean when the demo is dead and noisy when it lives, the demo is the
 * sound source and the speech tests were measuring a different program than
 * the one they thought.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 8151);
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
  console.error('playwright is missing. Run:  npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const killDemo = process.argv.includes('--kill-demo');
const seconds = Number(process.argv[process.argv.indexOf('--seconds') + 1]) || 40;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const trace = await page.evaluate(async ({ killDemo, seconds }) => {
  const { audioTap } = await import('/src/core/audio.js');
  const tap = audioTap();
  const an = tap.ctx.createAnalyser();
  an.fftSize = 2048;
  tap.bus.connect(an);
  const buf = new Float32Array(an.fftSize);
  const out = [];
  const t0 = performance.now();
  let lastKill = t0;
  while (performance.now() - t0 < seconds * 1000) {
    if (killDemo && performance.now() - lastKill > 1000) {
      lastKill = performance.now();
      // eslint-disable-next-line no-undef
      window.sfb3.endDemo();
    }
    an.getFloatTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
    if (performance.now() - t0 >= 1000) {
      out.push({ t: Math.round(performance.now() - t0), p: Number(peak.toFixed(3)) });
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  an.disconnect();
  const scene = window.sfb3.scene;
  return {
    trace: out,
    scene: scene && scene.constructor.name,
    tick: scene && scene.tick,
  };
}, { killDemo, seconds });

await browser.close();
server.close();

const noisey = trace.trace.filter((r) => r.p > 0.02).length;
console.log(`\nrepro-speech ${killDemo ? '(demo tapetaan sekunnin välein)' : '(demo saa elää)'}`
  + ` — ${seconds} s, ${trace.trace.length} näytettä\n`);
console.log('    t (s)    sfx-huippu');
for (const r of trace.trace) {
  const bar = r.p > 0.5 ? '  <-- YLI 0.5!' : '';
  console.log(`  ${String(r.t).padStart(6)}      ${String(r.p).padStart(8)}${bar}`);
}
console.log(`\n  näytteitä joissa bus > 0.02: ${noisey}/${trace.trace.length}`
  + ` (${((100 * noisey) / trace.trace.length).toFixed(0)} %)`);
console.log(`  lopussa scene: ${trace.scene}, tick ${trace.tick}`);
