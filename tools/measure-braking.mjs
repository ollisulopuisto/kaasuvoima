/**
 * Measures the *reaction budget*: how much room a moving player needs to not
 * hit the thing in front of him.
 *
 *   node tools/measure-braking.mjs
 *
 * tools/measure-jump.mjs answers "can I get there". This answers the opposite
 * question, the one that a player actually complains about: "I am already
 * moving, I have seen the enemy, can I still do anything about it?"
 *
 * Four things are measured, all in the real engine, none of them typed in:
 *   1. braking on the ground — release, turn round, and duck-slide, per power
 *      level and per speed cap
 *   2. braking in the air — the same reversal while airborne, which is where
 *      the decision is actually made when you are falling towards something
 *   3. how far ahead the player can see, which is the budget those distances
 *      are spent against
 *   4. the stomp window — sweeping the take-off distance at a walker one pixel
 *      at a time and classifying every outcome as stomp, hit or miss
 *
 * Nothing here writes a file. It is a measurement, not an input to generation;
 * PHYSICS.md quotes the numbers and this script is how they are re-checked.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 8149);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const data = await page.evaluate(async () => {
  const { LevelScene } = await import('/src/scenes/level.js');
  const { Walker } = await import('/src/entities/enemies.js');
  const { PLAYER_SIZES } = await import('/src/gfx/sprites.js');
  const game = window.sfb3;
  game.finishLevel = () => {};

  const blank = () => ({
    left: false, right: false, up: false, down: false, jump: false, run: false,
    start: false, mute: false, quicksave: false, quickload: false, slot: false, debug: false,
  });
  const mkInput = () => ({
    held: blank(), pressed: blank(), released: blank(), consume(a) { this.pressed[a] = false; },
  });

  /** A flat, empty runway so nothing but the test is in the way. */
  function runway(level) {
    game.state = {
      lives: 5, coins: 0, score: 0, power: { type: 'shroom', level },
      reserve: null, world: 0, node: 'w1-1', cleared: {}, worldsOpen: 1, cards: [],
    };
    if (level === 0) game.state.power = { type: null, level: 0 };
    const s = new LevelScene(game, '1-1');
    for (let y = 0; y < s.h - 2; y++) s.grid[y] = s.grid[y].map(() => ' ');
    for (let y = s.h - 2; y < s.h; y++) s.grid[y] = s.grid[y].map(() => '#');
    s.entities = s.entities.filter((e) => e.kind === 'player');
    s.goal = null;
    // The clock is irrelevant here and a timeout would end the run mid-measure.
    s.time = 400;
    return s;
  }

  const step = (s, i) => { s.update(i); i.pressed = blank(); };

  /** Winds the player up to the cap `mode` asks for, and hands back the scene. */
  function windUp(level, mode) {
    const s = runway(level);
    const p = s.player;
    const i = mkInput();
    for (let f = 0; f < 40; f++) step(s, i);
    i.held.right = mode !== 'stand';
    i.held.run = mode === 'run' || mode === 'p';
    /* 90 frames is the same run-up tools/measure-jump.mjs uses: long enough to
     * be pinned at the run cap (reached on frame 46), short enough that the
     * P-meter has not filled (which would make it a P-speed run instead). */
    const frames = mode === 'stand' ? 0 : mode === 'p' ? 420 : 90;
    for (let f = 0; f < frames; f++) step(s, i);
    if (mode === 'run' && p.pFull) return null;
    if (mode === 'p' && !p.pFull) return null;
    return { s, p, i };
  }

  /* ------------------------------------------------------------------ *
   * 1. Braking on the ground.
   * ------------------------------------------------------------------ */
  function groundBrake(level, mode, action) {
    const w = windUp(level, mode);
    if (!w) return null;
    const { s, p, i } = w;
    const v0 = p.vx;
    const x0 = p.x;
    i.held.right = false;
    i.held.run = false;
    if (action === 'reverse') i.held.left = true;
    if (action === 'duck') i.held.down = true;
    let frames = 0;
    while (p.vx > 0.0001 && frames < 900) { step(s, i); frames++; }
    return { v0: +v0.toFixed(2), frames, px: Math.round(p.x - x0) };
  }

  /* ------------------------------------------------------------------ *
   * 2. Braking in the air, and the landing that follows it.
   *
   * `decide` is when the reversal starts: 'takeoff' is the best case a player
   * could ever manage, 'apex' is realistic, 'land' is the case the complaint
   * describes — you only react once your feet are back down.
   * ------------------------------------------------------------------ */
  function airBrake(level, mode, decide) {
    const w = windUp(level, mode);
    if (!w) return null;
    const { s, p, i } = w;
    const x0 = p.x;
    const v0 = p.vx;

    i.pressed.jump = true;
    i.held.jump = true;
    step(s, i);

    let air = 0;
    let apexSeen = false;
    let landX = null;
    let landV = null;
    let landAir = null;
    let reversing = decide === 'takeoff';
    if (reversing) { i.held.right = false; i.held.left = true; }

    // Fly the arc, then keep going on the ground until the player is stopped.
    let frames = 0;
    while (frames < 900) {
      frames++;
      if (air < 400 && !p.onGround) air++;
      i.held.jump = p.vy < 0 && !reversing;
      if (!reversing && decide === 'apex' && p.vy > 0) {
        reversing = true;
        i.held.right = false;
        i.held.left = true;
      }
      if (!apexSeen && p.vy > 0) apexSeen = true;
      step(s, i);
      if (landX === null && p.onGround && frames > 4) {
        landX = p.x;
        landV = p.vx;
        landAir = air;
        if (!reversing && decide === 'land') {
          reversing = true;
          i.held.right = false;
          i.held.left = true;
        }
      }
      if (landX !== null && p.vx <= 0.0001) break;
    }
    return {
      v0: +v0.toFixed(2),
      airFrames: landAir,
      airPx: Math.round(landX - x0),
      landV: +landV.toFixed(2),
      groundPx: Math.round(p.x - landX),
      groundFrames: frames - landAir,
      totalPx: Math.round(p.x - x0),
    };
  }

  /* ------------------------------------------------------------------ *
   * 3. How far ahead the player can see.
   * ------------------------------------------------------------------ */
  function vision(level, mode) {
    const w = windUp(level, mode);
    if (!w) return null;
    const { s, p } = w;
    const VIEW_W = 320;
    return {
      v0: +p.vx.toFixed(2),
      aheadPx: Math.round(s.cam.x + VIEW_W - (p.x + p.w)),
      look: Math.round(s.camLook),
    };
  }

  /* ------------------------------------------------------------------ *
   * 4. The stomp window.
   *
   * A walker is parked `d` pixels in front of the player's leading edge and
   * the jump goes in immediately. Every outcome is classified, so the answer
   * is a range of take-off distances rather than an opinion.
   * ------------------------------------------------------------------ */
  function stompSweep(level, mode, { moving = false, maxD = 220 } = {}) {
    const out = [];
    for (let d = 0; d <= maxD; d++) {
      const w = windUp(level, mode);
      if (!w) return null;
      const { s, p, i } = w;
      const floorY = (s.h - 2) * 16;
      const e = new Walker(s, p.x + p.w + d, floorY - 16);
      e.speed = moving ? 0.55 : 0;
      e.active = true;
      s.add(e);
      const level0 = p.power.level;

      i.pressed.jump = true;
      i.held.jump = true;
      let verdict = 'over';
      let landedFirst = false;
      let onGroundAt = false;
      let feetOver = 0;
      for (let f = 0; f < 240; f++) {
        i.held.jump = p.vy < 0;
        const wasAir = !p.onGround;
        step(s, i);
        if (wasAir && p.onGround && p.x + p.w < e.x) landedFirst = true;
        if (p.power.level < level0 || p.dying) {
          // Ran into it on the ground after landing short is a different
          // failure from a jump that arrived at the wrong angle.
          verdict = landedFirst ? 'short' : 'hit';
          onGroundAt = p.onGround;
          feetOver = Math.round((p.y + p.h) - e.y);
          break;
        }
        if (e.squash > 0 || e.dying || e.remove) {
          verdict = 'stomp';
          feetOver = Math.round((p.y + p.h) - e.y);
          break;
        }
        if (p.x > e.x + e.w + 8) { verdict = 'over'; break; }
      }
      out.push({ d, verdict, onGroundAt, feetOver });
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 5. Landing at speed with an enemy ahead: how much clearance the player
   *    needs for a reversal on landing to actually save him.
   * ------------------------------------------------------------------ */
  function avoidSweep(level, mode, decide) {
    for (let d = 0; d <= 320; d += 1) {
      const w = windUp(level, mode);
      if (!w) return null;
      const { s, p, i } = w;
      const floorY = (s.h - 2) * 16;
      // The enemy is placed relative to where the player will *land*, which is
      // the moment the complaint is about.
      const e = new Walker(s, p.x + p.w + d, floorY - 16);
      e.speed = 0;
      e.active = true;
      s.add(e);
      const level0 = p.power.level;

      i.pressed.jump = true;
      i.held.jump = true;
      step(s, i);
      let reversing = decide === 'takeoff';
      if (reversing) { i.held.right = false; i.held.left = true; }
      let landed = false;
      let safe = true;
      for (let f = 0; f < 400; f++) {
        i.held.jump = p.vy < 0 && !reversing;
        if (!reversing && decide === 'apex' && p.vy > 0) {
          reversing = true; i.held.right = false; i.held.left = true;
        }
        step(s, i);
        if (!landed && p.onGround && f > 4) {
          landed = true;
          if (!reversing && decide === 'land') {
            reversing = true; i.held.right = false; i.held.left = true;
          }
        }
        if (p.power.level < level0 || p.dying) { safe = false; break; }
        if (landed && p.vx <= 0 && p.x + p.w < e.x) break;
      }
      if (safe) return { v0: 0, clearance: d };
    }
    return null;
  }

  const levels = [0, 1, 2, 3, 4, 5];
  const modes = ['walk', 'run', 'p'];

  const ground = [];
  for (const level of levels) {
    for (const mode of modes) {
      for (const action of ['release', 'reverse', 'duck']) {
        const r = groundBrake(level, mode, action);
        if (r) ground.push({ level, mode, action, ...r });
      }
    }
  }

  const air = [];
  for (const level of [0, 1, 5]) {
    for (const mode of modes) {
      for (const decide of ['takeoff', 'apex', 'land']) {
        const r = airBrake(level, mode, decide);
        if (r) air.push({ level, mode, decide, ...r });
      }
    }
  }

  const sight = [];
  for (const level of levels) {
    for (const mode of modes) {
      const r = vision(level, mode);
      if (r) sight.push({ level, mode, w: PLAYER_SIZES[level].w, h: PLAYER_SIZES[level].h, ...r });
    }
  }

  const stomp = [];
  for (const level of levels) {
    for (const mode of ['run', 'p']) {
      const rows = stompSweep(level, mode);
      if (rows) stomp.push({ level, mode, rows });
    }
  }

  const avoid = [];
  for (const level of levels) {
    for (const mode of ['run', 'p']) {
      for (const decide of ['takeoff', 'apex', 'land']) {
        const r = avoidSweep(level, mode, decide);
        if (r) avoid.push({ level, mode, decide, clearance: r.clearance });
      }
    }
  }

  return { ground, air, sight, stomp, avoid };
});

await browser.close();
server.close();

const pad = (v, n) => String(v).padStart(n);
const padR = (v, n) => String(v).padEnd(n);

console.log('\n=== 1. Braking on the ground (from the cap, to a dead stop) ===\n');
console.log(`  ${padR('POWER', 7)}${padR('SPEED', 7)}${padR('ACTION', 9)}${pad('vx', 6)}${pad('FRAMES', 8)}${pad('PX', 7)}${pad('TILES', 7)}`);
for (const r of data.ground) {
  console.log(`  ${padR(r.level, 7)}${padR(r.mode, 7)}${padR(r.action, 9)}${pad(r.v0, 6)}`
    + `${pad(`${r.frames}f`, 8)}${pad(`${r.px}px`, 7)}${pad((r.px / 16).toFixed(1), 7)}`);
}

console.log('\n=== 2. Reacting to something you are falling towards ===');
console.log('  (jump at the cap, then turn round at takeoff / apex / on landing)\n');
console.log(`  ${padR('POWER', 7)}${padR('SPEED', 7)}${padR('TURN AT', 9)}${pad('AIR', 7)}${pad('AIR PX', 8)}`
  + `${pad('LAND vx', 9)}${pad('GRND PX', 9)}${pad('TOTAL', 8)}`);
for (const r of data.air) {
  console.log(`  ${padR(r.level, 7)}${padR(r.mode, 7)}${padR(r.decide, 9)}${pad(`${r.airFrames}f`, 7)}`
    + `${pad(`${r.airPx}px`, 8)}${pad(r.landV, 9)}${pad(`${r.groundPx}px`, 9)}${pad(`${r.totalPx}px`, 8)}`);
}

console.log('\n=== 3. What the player can see ahead of himself (320x240 window) ===\n');
console.log(`  ${padR('POWER', 7)}${padR('BODY', 9)}${padR('SPEED', 7)}${pad('vx', 6)}${pad('LOOK', 7)}${pad('AHEAD', 8)}${pad('TILES', 7)}`);
for (const r of data.sight) {
  console.log(`  ${padR(r.level, 7)}${padR(`${r.w}x${r.h}`, 9)}${padR(r.mode, 7)}${pad(r.v0, 6)}`
    + `${pad(`${r.look}px`, 7)}${pad(`${r.aheadPx}px`, 8)}${pad((r.aheadPx / 16).toFixed(1), 7)}`);
}

const span = (rows, verdict) => {
  const hits = rows.filter((r) => r.verdict === verdict).map((r) => r.d);
  if (!hits.length) return '—';
  return `${hits[0]}..${hits[hits.length - 1]}px (${hits.length})`;
};

console.log('\n=== 4. Stomp window: jump from d px away at a parked walker ===');
console.log('  hit = arrived at the wrong angle. short = landed first, then ran into it.\n');
console.log(`  ${padR('POWER', 7)}${padR('SPEED', 7)}${padR('HIT (too late)', 18)}${padR('STOMP', 18)}`
  + `${padR('SHORT (too early)', 20)}${padR('WINDOW', 12)}`);
for (const s of data.stomp) {
  const st = s.rows.filter((r) => r.verdict === 'stomp').map((r) => r.d);
  const speed = { walk: 1.5, run: 2.5, p: 3.5 }[s.mode];
  const width = st.length ? `${st.length}px / ${(st.length / speed).toFixed(0)}f` : '—';
  console.log(`  ${padR(s.level, 7)}${padR(s.mode, 7)}${padR(span(s.rows, 'hit'), 18)}`
    + `${padR(span(s.rows, 'stomp'), 18)}${padR(span(s.rows, 'short'), 20)}${padR(width, 12)}`);
}

console.log('\n=== 5. Clearance needed to turn round and NOT touch the enemy ===\n');
console.log(`  ${padR('POWER', 7)}${padR('SPEED', 7)}${padR('TURN AT', 9)}${pad('CLEARANCE', 11)}${pad('TILES', 7)}${pad('vs SIGHT', 10)}`);
for (const r of data.avoid) {
  const sight = data.sight.find((s) => s.level === r.level && s.mode === r.mode);
  const pct = sight ? `${Math.round((r.clearance / sight.aheadPx) * 100)}%` : '—';
  console.log(`  ${padR(r.level, 7)}${padR(r.mode, 7)}${padR(r.decide, 9)}${pad(`${r.clearance}px`, 11)}`
    + `${pad((r.clearance / 16).toFixed(1), 7)}${pad(pct, 10)}`);
}
console.log('');
