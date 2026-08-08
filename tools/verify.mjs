/**
 * Headless smoke + playability check for Super Fart Bros 3.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node tools/verify.mjs
 *
 * Serves the repo itself, drives the game in Chromium and reports:
 *   - page/console errors
 *   - every level loading with a sane spawn and an exit
 *   - a bot playthrough of each level (how far it gets, and why it stopped)
 *   - power-ups, ummetus, save states
 *
 * Exits non-zero on hard failures. Bot deaths are reported, not failed —
 * the bot only runs right and jumps, so it dies to things a human wouldn't.
 *
 * Env: PW_BROWSER=/path/to/chromium  PORT=8123  HEADED=1
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 8123);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function serve() {
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
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

let chromium;
try {
  // PW_MODULE lets a global install be used instead of a local devDependency.
  ({ chromium } = await import(process.env.PW_MODULE || 'playwright'));
} catch {
  console.error('playwright is missing. Run:  npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const server = await serve();
const browser = await chromium.launch({
  headless: !process.env.HEADED,
  ...(process.env.PW_BROWSER ? { executablePath: process.env.PW_BROWSER } : {}),
});
const page = await browser.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  const text = m.text();
  if (m.type() === 'error' && !text.includes('favicon')) errors.push(`[console] ${text}`);
});

await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const booted = await page.evaluate(() => !!window.sfb3);

const report = await page.evaluate(async () => {
  const { LevelScene } = await import('/src/scenes/level.js');
  const { isSolid } = await import('/src/gfx/tiles.js');
  const { levelIds } = await import('/src/data/levels.js');
  const { captureState, restoreState } = await import('/src/core/savestate.js');
  const { WORLDS } = await import('/src/data/worlds.js');
  const game = window.sfb3;

  const blank = () => ({
    left: false, right: false, up: false, down: false, jump: false, run: false,
    start: false, mute: false, quicksave: false, quickload: false, slot: false,
  });
  const mkInput = () => ({
    held: blank(), pressed: blank(), released: blank(), consume(a) { this.pressed[a] = false; },
  });
  const reset = (power = { type: null, level: 0 }) => {
    game.state = {
      lives: 5, coins: 0, score: 0, power, reserve: null, world: 0,
      node: 'w1-1', cleared: {}, worldsOpen: 1, cards: [],
    };
    game.finishLevel = () => {};
  };

  const levels = [];
  const failures = [];
  const checks = [];

  /* ------------------------------- levels ------------------------------ */
  for (const id of levelIds()) {
    const entry = { id };
    try {
      reset();
      let finished = null;
      game.finishLevel = (r) => { finished = r; };
      const scene = new LevelScene(game, id);
      entry.width = scene.w;
      entry.entities = scene.entities.length;

      const hasExit = !!scene.goal || scene.entities.some((e) => e.constructor.name === 'Boss');
      if (!hasExit) failures.push(`${id}: no goal and no boss`);

      const sx = Math.floor(scene.player.x / 16);
      const sy = Math.floor((scene.player.y + scene.player.h - 1) / 16);
      if (isSolid(scene.tileAt(sx, sy))) failures.push(`${id}: spawn inside a solid tile`);

      const stuck = scene.entities.filter((e) => {
        if (e.constructor.name === 'Plant' || e.kind === 'hazard') return false;
        return isSolid(scene.tileAt(Math.floor(e.cx / 16), Math.floor((e.y + e.h - 1) / 16)));
      });
      if (stuck.length) failures.push(`${id}: ${stuck.length} enemies inside walls`);

      // dumb bot: run right, jump over walls, gaps, enemies; wait out fire jets
      const input = mkInput();
      let prevJump = false; let hold = 0; let maxX = 0; let cause = null;
      for (let frame = 0; frame < 7000 && !finished; frame++) {
        const p = scene.player;
        const footY = Math.floor((p.y + p.h) / 16);
        const aheadX = Math.floor((p.x + p.w + 6) / 16);
        const solid = (tx, ty) => isSolid(scene.tileAt(tx, ty));
        const hazardTile = (tx, ty) => '^W'.includes(scene.tileAt(tx, ty));
        const wall = solid(aheadX, footY - 1) || solid(aheadX, footY - 2);
        const gap = !solid(aheadX, footY) && !solid(aheadX + 1, footY);
        const burn = hazardTile(aheadX, footY) || hazardTile(aheadX, footY - 1);
        const foe = scene.entities.some((e) => e.kind === 'enemy' && !e.dying
          && e.cx > p.cx && e.cx - p.cx < 48 && Math.abs(e.cy - p.cy) < 40);
        const jet = scene.entities.some((e) => e.kind === 'hazard'
          && e.phase !== 'idle' && e.x > p.x - 8 && e.x - p.x < 44);
        const takeOff = p.onGround && (wall || gap || foe || burn);
        if (takeOff) hold = 16;
        const wantJump = takeOff || (hold > 0 && p.vy < 0);
        if (hold > 0) hold--;
        input.held = blank();
        input.held.right = !jet;
        input.held.run = true;
        input.held.jump = wantJump;
        input.pressed = blank();
        input.pressed.jump = takeOff && !prevJump;
        prevJump = wantJump;
        const beforeY = p.y;
        scene.update(input);
        maxX = Math.max(maxX, p.x);
        if (scene.state === 'dead' && !cause) {
          cause = beforeY > scene.heightPx - 40 ? 'pit' : 'hit';
        }
      }
      entry.result = finished ? (finished.cleared ? 'CLEARED' : 'DIED') : 'TIMEOUT';
      entry.progress = Math.round((maxX / (scene.w * 16)) * 100);
      entry.cause = cause;
    } catch (err) {
      entry.result = 'ERROR';
      failures.push(`${id}: ${err.message}`);
    }
    levels.push(entry);
  }

  /* ------------------------------ mechanics ---------------------------- */
  const expect = (name, ok, detail = '') => {
    checks.push({ name, ok, detail });
    if (!ok) failures.push(`${name}${detail ? ` (${detail})` : ''}`);
  };

  {
    reset();
    const s = new LevelScene(game, '1-1');
    const sizes = [];
    for (let i = 0; i < 5; i++) { sizes.push(s.player.h); s.player.collect('shroom'); }
    sizes.push(s.player.h);
    const grows = sizes.every((h, i) => i === 0 || h > sizes[i - 1]);
    expect('power levels 1-5 grow the body', s.player.powerLevel === 5 && grows, sizes.join('/'));
  }

  {
    reset({ type: 'shroom', level: 2 });
    const s = new LevelScene(game, '1-1');
    const i = mkInput();
    for (let f = 0; f < 5; f++) s.update(i);
    const ground = s.player.y;
    i.pressed.jump = true; i.held.jump = true;
    s.update(i); i.pressed = blank();
    for (let f = 0; f < 22; f++) s.update(i);
    const h1 = ground - s.player.y;
    i.pressed.jump = true; s.update(i); i.pressed = blank();
    for (let f = 0; f < 18; f++) s.update(i);
    const h2 = ground - s.player.y;
    expect('fart mushroom double jump climbs higher', h2 > h1 + 20, `${Math.round(h1)} -> ${Math.round(h2)}`);
  }

  {
    reset({ type: 'shroom', level: 3 });
    const s = new LevelScene(game, '1-1');
    const before = s.player.airJumpsMax;
    s.player.cork(300);
    const during = s.player.airJumpsMax;
    s.player.collect('soup');
    expect('ummetus blocks the gas, soup cures it',
      before === 3 && during === 0 && s.player.corked === 0);
  }

  {
    reset({ type: 'leaf', level: 3 });
    const s = new LevelScene(game, '1-1');
    game.pendingNode = WORLDS[0].nodes.find((n) => n.id === 'w1-1');
    game.setScene(s);
    const i = mkInput();
    i.held.right = true; i.held.run = true;
    for (let f = 0; f < 120; f++) { s.update(i); i.pressed = blank(); }
    const snap = captureState(game);
    const before = `${Math.round(s.player.x)}|${s.time}|${s.entities.length}`;
    s.player.x += 400; s.time = 5; s.entities = []; game.state.coins = 999;
    restoreState(game, JSON.parse(JSON.stringify(snap)));
    const r = game.scene;
    const after = `${Math.round(r.player.x)}|${r.time}|${r.entities.length}`;
    for (let f = 0; f < 30; f++) r.update(mkInput());
    expect('save state restores the level exactly', before === after, `${before} vs ${after}`);
    expect('restored level keeps running', r.player.x > 0 && !!r.player.update);
  }

  return { levels, checks, failures, worlds: WORLDS.length };
});

await browser.close();
server.close();

/* --------------------------------- output -------------------------------- */
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nSuper Fart Bros 3 — verify   (${report.worlds} worlds, ${report.levels.length} levels)\n`);
console.log(`  ${pad('LEVEL', 8)}${pad('BOT', 10)}${pad('REACH', 8)}STOPPED BY`);
for (const l of report.levels) {
  console.log(`  ${pad(l.id, 8)}${pad(l.result, 10)}${pad(`${l.progress ?? '-'}%`, 8)}${l.cause || ''}`);
}
console.log('');
for (const c of report.checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);

const hardFailures = [...report.failures, ...(booted ? [] : ['game did not boot']), ...errors];
console.log('');
if (hardFailures.length) {
  console.log('FAILURES:');
  for (const f of hardFailures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('All checks passed, no page errors.\n');
