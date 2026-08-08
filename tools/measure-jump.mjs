/**
 * Measures the jump budget by actually jumping.
 *
 *   node tools/measure-jump.mjs
 *
 * Level design lives or dies on three numbers: how high a jump rises, how far
 * it carries, and how wide a gap is still fair. Those are consequences of the
 * physics constants, not independent knobs, so they are measured here rather
 * than written down and left to rot. tools/gen-levels.mjs reads the result.
 */
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 8147);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };

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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const result = await page.evaluate(async () => {
  const { LevelScene } = await import('/src/scenes/level.js');
  const game = window.sfb3;
  game.finishLevel = () => {};

  const blank = () => ({
    left: false, right: false, up: false, down: false, jump: false, run: false,
    start: false, mute: false, quicksave: false, quickload: false, slot: false, debug: false,
  });
  const mkInput = () => ({
    held: blank(), pressed: blank(), released: blank(), consume(a) { this.pressed[a] = false; },
  });

  /**
   * Runs one jump on a floor with nothing in the way and reports the arc.
   * `mode` is how much of a run-up the player gets first.
   */
  function jump({ mode, power, hold, doubleJump = false }) {
    game.state = {
      lives: 5, coins: 0, score: 0, power, reserve: null, world: 0,
      node: 'w1-1', cleared: {}, worldsOpen: 1, cards: [],
    };
    const s = new LevelScene(game, '1-1');
    // A clear runway: unbroken floor, nothing above it, no enemies. The pits
    // in the real level would end the run before the jump under test.
    for (let y = 0; y < s.h - 2; y++) s.grid[y] = s.grid[y].map(() => ' ');
    for (let y = s.h - 2; y < s.h; y++) s.grid[y] = s.grid[y].map(() => '#');
    s.entities = s.entities.filter((e) => e.kind === 'player');
    s.goal = null;
    const p = s.player;
    const i = mkInput();

    // Let the player fall out of the spawn and settle, or the very first frame
    // spends an air jump instead of a ground jump.
    for (let f = 0; f < 40; f++) { s.update(i); i.pressed = blank(); }

    // Build up speed. 'run' stops short of filling the P-meter on purpose:
    // P-speed is a separate case below.
    const runFrames = mode === 'stand' ? 0 : mode === 'walk' ? 90 : mode === 'run' ? 90 : 320;
    i.held.right = mode !== 'stand';
    i.held.run = mode === 'run' || mode === 'p';
    for (let f = 0; f < runFrames; f++) { s.update(i); i.pressed = blank(); }
    if (mode === 'run' && p.pFull) return null;   // ran too long, not a run jump
    if (mode === 'p' && !p.pFull) return null;

    const speed = Math.abs(p.vx);
    const x0 = p.x;
    const y0 = p.y;
    let peak = 0;
    let air = 0;

    i.pressed.jump = true;
    i.held.jump = true;
    s.update(i);
    i.pressed = blank();

    let usedDouble = !doubleJump;
    while (air < 400) {
      air++;
      i.held.jump = hold && p.vy < 0;
      if (!usedDouble && p.vy > 0.5) { i.pressed.jump = true; i.held.jump = true; usedDouble = true; }
      s.update(i);
      i.pressed = blank();
      peak = Math.max(peak, y0 - p.y);
      if (p.onGround && air > 4) break;
    }
    return {
      speed: Number(speed.toFixed(2)),
      height: Math.round(peak),
      distance: Math.round(p.x - x0),
      frames: air,
    };
  }

  const rows = [];
  const add = (label, spec) => {
    const r = jump(spec);
    if (r) rows.push({ label, ...r });
  };

  const big = { type: 'shroom', level: 1 };
  add('standing, tapped', { mode: 'stand', power: big, hold: false });
  add('standing, held', { mode: 'stand', power: big, hold: true });
  add('walking, held', { mode: 'walk', power: big, hold: true });
  add('running, held', { mode: 'run', power: big, hold: true });
  add('P-speed, held', { mode: 'p', power: big, hold: true });
  add('running + fart jump', { mode: 'run', power: { type: 'shroom', level: 3 }, hold: true, doubleJump: true });
  // Body size is deliberately not measured: jump velocity and gravity in this
  // engine do not depend on it, only friction does.

  return rows;
});

await browser.close();
server.close();

const TILE = 16;
console.log('\nJump budget (measured, 60 Hz, 16 px tiles)\n');
console.log(`  ${'CASE'.padEnd(22)}${'SPEED'.padStart(6)}${'RISE'.padStart(8)}${'CARRY'.padStart(9)}${'AIR'.padStart(7)}`);
for (const r of result) {
  console.log(`  ${r.label.padEnd(22)}${String(r.speed).padStart(6)}`
    + `${`${r.height}px`.padStart(8)}${`${r.distance}px`.padStart(9)}${`${r.frames}f`.padStart(7)}`);
}
console.log('');
for (const r of result) {
  console.log(`  ${r.label.padEnd(22)} = ${(r.height / TILE).toFixed(1)} tiles up, `
    + `${(r.distance / TILE).toFixed(1)} tiles across`);
}

const run = result.find((r) => r.label === 'running, held');
const fart = result.find((r) => r.label === 'running + fart jump');

/*
 * The design budget is deliberately short of the measured maximum. Clearing a
 * gap at the theoretical limit needs top speed, a perfectly timed take-off and
 * a held button for the whole arc; asking for that on every jump is not
 * difficulty, it is a tax. 70% of the running jump is the width a player can
 * take at a normal run without thinking about it.
 */
const MARGIN = 0.7;
const budget = {
  note: 'Measured by tools/measure-jump.mjs. Regenerate after touching physics.',
  margin: MARGIN,
  cases: result,
  gapTiles: Math.max(3, Math.floor((run.distance * MARGIN) / TILE)),
  softGapTiles: Math.max(4, Math.floor(((fart ? fart.distance : run.distance) * 0.55) / TILE)),
  wallTiles: Math.max(2, Math.floor((run.height * 0.8) / TILE)),
};
await writeFile(join(ROOT, 'tools/jump-budget.json'), `${JSON.stringify(budget, null, 2)}\n`);
console.log(`\n  design budget: gap ${budget.gapTiles} tiles, `
  + `gap with fart jump ${budget.softGapTiles}, wall ${budget.wallTiles}`);
console.log('  wrote tools/jump-budget.json\n');
