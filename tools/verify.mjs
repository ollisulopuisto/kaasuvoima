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
  let ruleReport = [];

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
      if (stuck.length) {
        const where = stuck.slice(0, 4)
          .map((e) => `${e.constructor.name}@${Math.floor(e.cx / 16)},${Math.floor(e.y / 16)}`)
          .join(' ');
        failures.push(`${id}: ${stuck.length} enemies inside walls — ${where}`);
      }

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

  /* Landing on two enemies at once must not stomp one and kill you on the
   * other: the stomp test has to use the fall speed the player arrived with,
   * not the bounce speed the first stomp just gave them. */
  {
    reset({ type: 'shroom', level: 1 });
    const s = new LevelScene(game, '1-1');
    game.setScene(s);
    const { Walker } = await import('/src/entities/enemies.js');
    const i = mkInput();
    for (let f = 0; f < 4; f++) s.update(i);

    const groundY = s.player.y + s.player.h;
    const px = s.player.cx;
    s.entities = s.entities.filter((e) => e.kind !== 'enemy');
    const a = new Walker(s, px - 8, groundY - 16);
    const b = new Walker(s, px + 8, groundY - 16);
    for (const e of [a, b]) { e.active = true; e.alwaysActive = true; e.vx = 0; s.entities.push(e); }

    // Drop the player onto the pair from just above them.
    s.player.y = groundY - 16 - s.player.h - 6;
    s.player.vy = 4;
    s.player.onGround = false;
    const powerBefore = s.player.powerLevel;
    for (let f = 0; f < 6 && !s.player.dying; f++) s.update(i);

    const squashed = [a, b].filter((e) => e.dying || e.remove || !e.stompable).length;
    const unhurt = !s.player.dying && s.player.powerLevel === powerBefore;
    expect('stomping two enemies at once does not hurt the player',
      unhurt && s.state === 'play' && squashed >= 1,
      `power ${powerBefore}->${s.player.powerLevel}, ${squashed}/2 squashed`
      + `${s.player.dying ? ', died' : ''}`);
  }

  /* A piranha hidden inside its pipe must not hurt anybody. Its box collapses
   * to zero height while it is down, but a zero-height box still straddles the
   * player's, so standing on the pipe mouth used to be lethal. */
  {
    reset({ type: 'shroom', level: 1 });
    const s = new LevelScene(game, '1-2');
    game.setScene(s);
    const { Plant } = await import('/src/entities/enemies.js');
    const i = mkInput();
    for (let f = 0; f < 8; f++) s.update(i);

    s.entities = s.entities.filter((e) => e.kind !== 'enemy');
    const feet = s.player.y + s.player.h;
    const plant = new Plant(s, s.player.cx - 8, feet - 33);
    plant.active = true;
    plant.alwaysActive = true;
    plant.phase = 'hidden';
    plant.timer = 999;
    plant.offset = 32;
    plant.y = plant.pipeTopY + 32;
    s.entities.push(plant);

    const powerBefore = s.player.powerLevel;
    s.collisions();
    expect('a piranha hidden in its pipe cannot hurt the player',
      !s.player.dying && s.player.powerLevel === powerBefore,
      `power ${powerBefore}->${s.player.powerLevel}, plant box h=${plant.box.h}`);
  }

  /* The piranha's hitbox must be exactly the part of it sticking out of the
   * pipe, at every point of its animation, and a sliver too small to see must
   * not be able to hurt anyone. */
  {
    reset();
    const s = new LevelScene(game, '1-2');
    const { Plant } = await import('/src/entities/enemies.js');
    const plant = new Plant(s, 100, 112);
    const mouth = 112 + 32;
    const bad = [];
    for (let offset = 0; offset <= 32; offset++) {
      plant.offset = offset;
      plant.y = plant.pipeTopY + offset;
      const box = plant.box;
      if (box.y + box.h !== mouth) bad.push(`offset ${offset}: box ends at ${box.y + box.h}, not ${mouth}`);
      if (box.y < plant.pipeTopY) bad.push(`offset ${offset}: box starts above the sprite`);
      const visible = mouth - box.y;
      if (!plant.harmless && visible < 8) bad.push(`offset ${offset}: ${visible}px sliver still hurts`);
      if (plant.harmless && visible >= 12) bad.push(`offset ${offset}: ${visible}px visible but harmless`);
    }
    expect('the piranha hitbox is exactly what sticks out of the pipe',
      bad.length === 0, bad.slice(0, 3).join('; '));
  }

  /* A standing player must never be a still image: there is always a breath,
   * and after a few seconds the idle performance kicks in. */
  {
    const { drawPlayer } = await import('/src/gfx/sprites.js');
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 48;
    const g = canvas.getContext('2d');
    const shot = (tick, idle) => {
      g.clearRect(0, 0, 40, 48);
      drawPlayer(g, 12, 10, {
        type: 'shroom', level: 1, facing: 1, frame: 0, state: 'idle',
        ducking: false, running: false, tick, idle,
      });
      return [...g.getImageData(0, 0, 40, 48).data].join(',');
    };
    const breathing = new Set([shot(0, 30), shot(13, 43), shot(26, 56), shot(152, 182)]);
    const performing = new Set();
    for (let beat = 0; beat < 4; beat++) performing.add(shot(300 + beat * 90, 240 + beat * 90));
    expect('a standing player breathes and then finds something to do',
      breathing.size >= 2 && performing.size >= 3,
      `${breathing.size} breathing frames, ${performing.size} idle poses`);
  }

  /* A tap that goes down and up inside one frame must still register: the
   * event handler latches it, so the poll cannot look at an already-released
   * key and drop the press. */
  {
    const { Input } = await import('/src/core/input.js');
    Input.install();
    Input.poll();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ' }));
    Input.poll();
    const sawIt = Input.pressed.jump;
    Input.poll();
    expect('a tap shorter than one frame still registers',
      sawIt && !Input.pressed.jump && !Input.held.jump,
      `pressed ${sawIt}, still held after ${Input.held.jump}`);
  }

  /* The world map has to look alive, not printed. */
  {
    const { WorldMapScene } = await import('/src/scenes/worldmap.js');
    reset();
    const map = new WorldMapScene(game);
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const g = canvas.getContext('2d');
    const frames = new Set();
    for (const t of [0, 20, 45, 70]) {
      map.tick = t;
      g.clearRect(0, 0, 320, 240);
      map.draw(g);
      const d = g.getImageData(0, 0, 320, 240).data;
      let hash = 0;
      for (let i = 0; i < d.length; i += 4 * 37) hash = (hash * 31 + d[i] + d[i + 1] * 3) | 0;
      frames.add(hash);
    }
    expect('the world map animates', frames.size >= 3, `${frames.size} distinct frames`);
  }

  /* Standing still on solid ground must read as grounded on EVERY frame. If it
   * flickers, jumps silently vanish: the press lands on a frame where the game
   * thinks the player is in mid-air. */
  {
    reset({ type: 'shroom', level: 1 });
    const s = new LevelScene(game, '1-1');
    const i = mkInput();
    for (let f = 0; f < 30; f++) s.update(i);        // settle on the floor
    let airborne = 0;
    for (let f = 0; f < 60; f++) {
      s.update(i);
      if (!s.player.onGround) airborne++;
    }
    expect('standing on the ground reads as grounded every frame',
      airborne === 0, `${airborne}/60 frames airborne while standing still`);

    // ...and the player must not sink and pop back either: that reads on screen
    // as the character vibrating even when the game says it is grounded.
    const heights = new Set();
    for (let f = 0; f < 60; f++) { s.update(i); heights.add(Math.round(s.player.y * 100)); }
    expect('a standing player does not drift up and down',
      heights.size === 1, `${heights.size} eri y-arvoa paikallaan seistessä`);

    // And a jump has to fire on any frame the player asks for one.
    let missed = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      for (let f = 0; f < 24; f++) { s.update(i); i.pressed = blank(); }
      i.pressed.jump = true; i.held.jump = true;
      s.update(i);
      i.pressed = blank();
      if (s.player.vy >= 0) missed++;
      i.held.jump = false;
    }
    expect('every jump press launches a jump', missed === 0, `${missed}/12 presses ignored`);
  }

  /* Running past the boss must not delete it. The fortress door only opens on
   * `bossDefeated`, so a despawned boss is an unwinnable level. */
  {
    reset({ type: 'shroom', level: 1 });
    const s = new LevelScene(game, '1-F');
    game.setScene(s);
    const boss = s.entities.find((e) => e.constructor.name === 'Boss');
    const i = mkInput();
    // Put the player at the far end of the arena, where the door is, and let
    // the camera settle there — the boss is now way behind.
    // Run the level the way a player does. The boss chases, so it will follow
    // the player out of its arena if nothing stops it.
    i.held.right = true;
    i.held.run = true;
    let lost = null;
    for (let f = 0; f < 1500; f++) {
      i.pressed = blank();
      if (f % 35 === 0) { i.pressed.jump = true; i.held.jump = true; } else if (f % 35 > 12) i.held.jump = false;
      s.player.invuln = Math.max(s.player.invuln, 4);      // survive long enough to watch
      s.update(i);
      if (!lost && (!s.entities.includes(boss) || boss.remove || boss.y > s.heightPx)) {
        lost = { f, x: Math.round(boss.x), y: Math.round(boss.y), hp: boss.hp };
      }
    }
    expect('the boss cannot leave its arena and fall out of the level',
      !lost && !s.bossDefeated === !s.bossDefeated && s.entities.includes(boss),
      lost ? `pomo katosi framella ${lost.f} kohdassa ${lost.x},${lost.y} hp ${lost.hp}` : '');

    // The save state has to bring the boss back too, or the door never opens.
    game.pendingNode = WORLDS[0].nodes.find((n) => n.id === 'w1-f');
    game.slot = 2;
    game.quickSave();
    game.quickLoad();
    const after = game.scene;
    const bossBack = after.entities.filter((e) => e.constructor.name === 'Boss').length;
    expect('a save state in the fortress keeps the boss',
      bossBack === 1 && after.entities.length > 0,
      `${bossBack} pomoa, ${after.entities.length} entiteettiä`);

    // And with the boss down, the door has to actually let you out.
    reset({ type: 'shroom', level: 1 });
    const s2 = new LevelScene(game, '1-F');
    game.setScene(s2);
    s2.bossDefeated = true;
    let finished = null;
    game.finishLevel = (r) => { finished = r; };
    const door = [];
    for (let ty = 0; ty < s2.h; ty++) {
      for (let tx = 0; tx < s2.w; tx++) if (s2.grid[ty][tx] === 'D') door.push({ tx, ty });
    }
    if (door.length) {
      s2.player.x = door[0].tx * 16;
      s2.player.y = door[0].ty * 16;
      for (let f = 0; f < 200 && !finished; f++) { s2.update(i); i.pressed = blank(); }
    }
    expect('the fortress door opens once the boss is beaten',
      door.length === 1 && !!finished && finished.cleared,
      `${door.length} ovea, finished ${JSON.stringify(finished)}`);
  }

  /* The design rules, applied to EVERY level in the game rather than only the
   * generated ones. Worlds 1-4 predate the current jump budget, so their
   * violations are reported as a work list, not as a build failure. */
  {
    const { validateLevel } = await import('/src/data/rules.js');
    const { getLevel, levelIds } = await import('/src/data/levels.js');
    const budget = await (await fetch('/tools/jump-budget.json')).json();
    const perLevel = [];
    for (const id of levelIds()) {
      const problems = validateLevel(getLevel(id).rows, budget);
      if (problems.length) perLevel.push({ id, problems });
    }
    // Every level is clean as of v26.08.08.15, so any violation from here on is
    // a regression and fails the run — hand-made levels included.
    const generatedBad = perLevel;
    checks.push({
      name: 'design rules across every level',
      ok: generatedBad.length === 0,
      detail: perLevel.length
        ? `${perLevel.length}/${levelIds().length} kenttää rikkoo sääntöjä`
        : 'kaikki kentät sääntöjen mukaisia',
    });
    if (generatedBad.length) {
      failures.push(...generatedBad.flatMap((l) => l.problems.map((p) => `${l.id}: ${p}`)));
    }
    ruleReport = perLevel;
  }

  /* Picking up a different power-up swaps: the one you were wearing goes into
   * the reserve box rather than evaporating. */
  {
    reset({ type: 'leaf', level: 3 });
    const s = new LevelScene(game, '1-1');
    game.state.reserve = null;
    s.player.collect('shroom');
    expect('a different power-up swaps the old one into the box',
      game.state.reserve === 'leaf' && s.player.type === 'shroom',
      `varasto ${game.state.reserve}, voima ${s.player.type} ${s.player.powerLevel}`);

    // Same type just levels up; nothing to bank.
    reset({ type: 'shroom', level: 2 });
    const s2 = new LevelScene(game, '1-1');
    game.state.reserve = null;
    s2.player.collect('shroom');
    expect('the same power-up just levels up',
      game.state.reserve === null && s2.player.powerLevel === 3,
      `varasto ${game.state.reserve}, taso ${s2.player.powerLevel}`);
  }

  /* Every character the game puts on screen must have a glyph. A missing one
   * shows as a hole, and Finnish is full of letters ASCII does not have. */
  {
    const font = await import('/src/gfx/font.js');
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 16;
    const g = canvas.getContext('2d');
    const missing = [];
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖ0123456789 .,:!?*()=/+<>%\'-') {
      g.clearRect(0, 0, 64, 16);
      font.drawText(g, ch, 2, 2, { color: '#ffffff' });
      const data = g.getImageData(0, 0, 64, 16).data;
      let ink = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) ink++;
      if (ch !== ' ' && ink === 0) missing.push(ch);
    }
    expect('the font can draw every letter the game uses',
      missing.length === 0, missing.length ? `puuttuu: ${missing.join('')}` : '');
  }

  /* Taking a hit drops the reserve item, and that item must not land straight
   * back in the player's hands — otherwise a hit silently swaps your power
   * instead of costing you one. */
  {
    reset({ type: 'shroom', level: 3 });
    const s = new LevelScene(game, '1-1');
    game.setScene(s);
    game.state.reserve = 'leaf';
    const i = mkInput();
    for (let f = 0; f < 6; f++) s.update(i);

    const before = s.player.powerLevel;
    s.player.hurt();
    for (let f = 0; f < 20; f++) { s.update(i); i.pressed = blank(); }
    const p = s.player;
    expect('a hit costs a power level instead of swapping your power',
      p.type === 'shroom' && p.powerLevel === before - 1,
      `${p.type} ${p.powerLevel}, odotettiin shroom ${before - 1}`);
  }

  /* ----------------------------- high scores --------------------------- */
  {
    const scores = await import('/src/core/scores.js');
    scores.clearScores();
    expect('an empty board takes any score', scores.qualifies(10) && !scores.qualifies(0));

    for (let i = 0; i < scores.MAX_ENTRIES; i++) {
      scores.addScore({ name: `P${i}`, score: 1000 + i * 100, world: 1 });
    }
    const full = scores.loadScores();
    const sorted = full.every((e, i) => i === 0 || full[i - 1].score >= e.score);
    expect('the board keeps the best ten in order',
      full.length === scores.MAX_ENTRIES && sorted && full[0].score === 1900,
      `${full.length} rows, top ${full[0].score}`);

    expect('a score below the board is turned away', !scores.qualifies(500));
    const idx = scores.addScore({ name: 'STAR', score: 5000, world: 3, assisted: true });
    const board = scores.loadScores();
    expect('a new best lands on top and keeps its star',
      idx === 0 && board[0].name === 'STAR' && board[0].assisted && board.length === 10,
      `index ${idx}, assisted ${board[0].assisted}`);

    // A tie must not push the older entry down: you beat a score, not match it.
    scores.addScore({ name: 'TIE', score: 5000, world: 1 });
    expect('a tie stays behind the entry that got there first',
      scores.loadScores()[0].name === 'STAR');
    scores.clearScores();
  }

  {
    // Loading a save state has to mark the run, or the star means nothing.
    reset();
    const s = new LevelScene(game, '1-1');
    game.pendingNode = WORLDS[0].nodes.find((n) => n.id === 'w1-1');
    game.setScene(s);
    game.state.usedSaveState = false;
    game.slot = 3;
    game.quickSave();
    game.quickLoad();
    expect('loading a save state marks the run as assisted', game.state.usedSaveState === true);
  }

  /* ------------------------------ telemetry ---------------------------- */
  {
    const tele = await import('/src/core/telemetry.js');
    tele.clearTelemetry();

    // A death has to land in the log with the right cause and the right column,
    // because a heatmap pointing at the wrong tile is worse than no heatmap.
    reset({ type: 'shroom', level: 1 });
    const s = new LevelScene(game, '1-1');
    game.setScene(s);
    const i = mkInput();
    for (let f = 0; f < 4; f++) s.update(i);
    const column = Math.floor(s.player.cx / 16);
    s.player.die('pit');
    const deaths = tele.allEvents().filter((e) => e.e === 'die');
    expect('a death is logged with its cause and column',
      deaths.length === 1 && deaths[0].c === 'pit' && deaths[0].x === column
      && deaths[0].l === '1-1',
      JSON.stringify(deaths[0] || null));

    // …and only once. A rewind used to be able to log the same death twice,
    // which quietly doubled the weight of whatever spot someone was practising.
    s.player.dying = false;
    s.player.die('lava');
    expect('one attempt logs one death',
      tele.allEvents().filter((e) => e.e === 'die').length === 1);

    // Falling out of the world reports as a pit, not as an enemy.
    reset({ type: 'shroom', level: 1 });
    const s2 = new LevelScene(game, '1-1');
    game.setScene(s2);
    s2.update(i);
    s2.player.y = s2.heightPx + 200;
    s2.player.noclip = true;
    for (let f = 0; f < 3 && !s2.player.dying; f++) s2.update(i);
    const fell = tele.allEvents().filter((e) => e.e === 'die').at(-1);
    expect('falling out of the world is logged as a pit', fell && fell.c === 'pit',
      fell ? fell.c : 'ei tapahtumaa');

    // Standing still long enough is a stall, and it is logged once per column —
    // a player who wanders off for a minute must not fill the log by himself.
    tele.clearTelemetry();
    reset({ type: 'shroom', level: 1 });
    const s3 = new LevelScene(game, '1-1');
    game.setScene(s3);
    s3.entities = s3.entities.filter((e) => e.kind !== 'enemy');   // this is about standing, not dying
    const idle = mkInput();
    for (let f = 0; f < 1100; f++) { s3.update(idle); idle.pressed = blank(); }
    const stalls = tele.allEvents().filter((e) => e.e === 'stuck');
    expect('standing still is logged once as a stall',
      stalls.length === 1 && stalls[0].l === '1-1',
      `${stalls.length} kpl`);

    // Walking on must not count as stuck at all.
    tele.clearTelemetry();
    const s4 = new LevelScene(game, '1-1');
    game.setScene(s4);
    s4.entities = s4.entities.filter((e) => e.kind !== 'enemy');
    const walk = mkInput();
    walk.held.right = true;
    for (let f = 0; f < 600; f++) { s4.update(walk); walk.pressed = blank(); }
    expect('a player who keeps moving is never called stuck',
      tele.allEvents().filter((e) => e.e === 'stuck').length === 0);

    // Clearing a level records what it cost.
    tele.clearTelemetry();
    expect('the game counts attempts per level', !!game.attempts);
    if (game.attempts) game.attempts['1-1'] = 2;
    const s5 = new LevelScene(game, '1-1');
    game.setScene(s5);
    s5.update(mkInput());
    s5.completeLevel('shroom');
    const clear = tele.allEvents().find((e) => e.e === 'clear');
    expect('a cleared level records the attempts it took',
      clear && clear.d === 2 && clear.l === '1-1' && game.attempts && game.attempts['1-1'] === 0,
      JSON.stringify(clear || null));

    // The export has to be valid JSON with the events in it, or phase 2 is a lie.
    const dump = JSON.parse(tele.exportJSON());
    expect('the export is valid JSON carrying the events',
      dump.game === 'sfb3' && Array.isArray(dump.events) && dump.events.length > 0,
      `${dump.events ? dump.events.length : '?'} tapahtumaa`);

    // Nothing in this module may reach the network.
    const src = await (await fetch('/src/core/telemetry.js')).text();
    expect('telemetry never sends anything anywhere',
      !/fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(src));

    tele.clearTelemetry();
  }

  /* --------------------------- kosketusohjaus -------------------------- */
  {
    const { Input } = await import('/src/core/input.js');
    const touch = game.touch;
    touch.reveal();

    const rect = (act) => document.querySelector(`#touch [data-act="${act}"]`)
      .getBoundingClientRect();
    const send = (type, id, x, y) => {
      document.getElementById('touch').dispatchEvent(new PointerEvent(type, {
        pointerId: id, clientX: x, clientY: y, pointerType: 'touch', bubbles: true, cancelable: true,
      }));
    };
    const at = (act) => {
      const r = rect(act);
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    const held = () => {
      Input.poll();
      return Object.entries(Input.held).filter(([, v]) => v).map(([k]) => k).sort().join(',');
    };
    const letGo = () => {
      touch._releaseAll();
      Input.poll();
      Input.poll();
    };

    touch.setLayout('napit');
    letGo();
    send('pointerdown', 1, ...at('left'));
    const pressed = held();
    send('pointerup', 1, ...at('left'));
    const released = held();
    expect('a touch key presses and releases',
      pressed === 'left' && released === '', `alas "${pressed}", ylös "${released}"`);

    /* Rolling a thumb from one key to the next has to work. The browser sends
     * no leave event for that, which is why the hit-testing is done by hand. */
    letGo();
    send('pointerdown', 2, ...at('left'));
    held();                                  // a frame passes, as it would in life
    send('pointermove', 2, ...at('right'));
    const rolled = held();
    send('pointerup', 2, ...at('right'));
    expect('sliding a thumb between keys switches the direction',
      rolled === 'right', `"${rolled}"`);

    // Steering, running and jumping at once is three fingers, and dropping any
    // one of them would read as the game sticking.
    letGo();
    send('pointerdown', 3, ...at('right'));
    send('pointerdown', 4, ...at('jump'));
    send('pointerdown', 5, ...at('run'));
    const three = held();
    send('pointerup', 4, ...at('jump'));
    const afterOne = held();
    for (const id of [3, 5]) send('pointerup', id, 0, 0);
    expect('three fingers work at once, and lifting one keeps the others',
      three === 'jump,right,run' && afterOne === 'right,run',
      `"${three}" -> "${afterOne}"`);

    // A tap shorter than a frame still counts: on a touchscreen that is not an
    // edge case, that is simply what tapping is.
    letGo();
    send('pointerdown', 6, ...at('jump'));
    send('pointerup', 6, ...at('jump'));
    expect('a tap shorter than one frame still registers', held().includes('jump'));

    /* The thumb layout: no buttons, the halves of the screen are the control. */
    touch.setLayout('peukalot');
    letGo();
    const lx = innerWidth * 0.25;
    const ly = innerHeight * 0.7;
    send('pointerdown', 7, lx, ly);
    const neutral = held();
    send('pointermove', 7, lx + 50, ly);
    const right = held();
    send('pointermove', 7, lx - 50, ly);
    const left = held();
    send('pointermove', 7, lx, ly - 60);
    const up = held();
    send('pointerup', 7, lx, ly);
    expect('the floating stick steers from wherever the thumb landed',
      neutral === '' && right === 'right' && left === 'left' && up === 'up',
      `neutraali "${neutral}" oikea "${right}" vasen "${left}" ylös "${up}"`);

    letGo();
    send('pointerdown', 8, innerWidth * 0.8, innerHeight * 0.8);
    const jump = held();
    send('pointerup', 8, innerWidth * 0.8, innerHeight * 0.8);
    send('pointerdown', 9, innerWidth * 0.8, innerHeight * 0.1);
    const run = held();
    send('pointerup', 9, innerWidth * 0.8, innerHeight * 0.1);
    expect('the right half jumps low down and farts up top',
      jump === 'jump' && run === 'run', `alhaalla "${jump}", ylhäällä "${run}"`);

    // Switching layout mid-press must not leave an action stuck down.
    letGo();
    touch.setLayout('napit');
    send('pointerdown', 10, ...at('left'));
    touch.setLayout('peukalot');
    const afterSwitch = held();
    expect('switching layout mid-press does not leave a key stuck',
      afterSwitch === '', `"${afterSwitch}"`);

    touch.setLayout('napit');
    letGo();
    expect('the touch layout is remembered', touch.loadLayout() === 'napit', touch.loadLayout());
  }

  /* ------------------------------ kuvaefektit -------------------------- */
  {
    const { PostFX, PRESETS } = await import('/src/gfx/postfx.js');

    // A fresh instance per case: the live PostFX is already attached to the
    // real canvas and must not be re-initialised out from under the game.
    const makeFX = () => Object.create(PostFX);
    const testCanvas = () => {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 240;
      const g = c.getContext('2d');
      g.fillStyle = '#204080';
      g.fillRect(0, 0, 320, 240);
      g.fillStyle = '#ffe0a0';                 // something bright for the bloom
      g.fillRect(140, 90, 40, 40);
      return c;
    };
    const pixels = (c) => c.getContext('2d').getImageData(0, 0, 320, 240).data;
    // Any channel counts. A bloom around something already at 255 red shows up
    // only in the other two, and counting red alone missed almost all of it.
    const differs = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
      }
      return n;
    };

    /* THE point of this file: a machine without WebGL still gets a game.
     * getContext('webgl2') returns null on a blocklisted driver, in a VM and
     * whenever hardware acceleration is off — in an up-to-date browser. */
    const realGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, opts) {
      if (String(type).startsWith('webgl')) return null;
      return realGet.call(this, type, opts);
    };
    let fallbackOk = false;
    let drewGlow = 0;
    let drewCrt = 0;
    try {
      const fx = makeFX();
      const c = testCanvas();
      const shown = fx.init(c);
      fallbackOk = fx.mode === '2d' && shown === c && !fx.displayCanvas
        && fx.present() === false;
      for (const [preset, out] of [['hehku', 'glow'], ['crt', 'crt']]) {
        const t = testCanvas();
        fx.source = t;
        fx.setPreset(preset);
        const before = pixels(t).slice();
        fx.apply(t.getContext('2d'));
        const n = differs(before, pixels(t));
        if (out === 'glow') drewGlow = n; else drewCrt = n;
      }
    } finally {
      HTMLCanvasElement.prototype.getContext = realGet;
    }
    expect('without WebGL the game still draws, effects and all',
      fallbackOk && drewGlow > 200, `mode-ok ${fallbackOk}, hehku muutti ${drewGlow} px`);
    // Scanlines and the vignette live in the shader when there is one, and in
    // Canvas 2D when there is not. Without WebGL, CRT must still beat plain glow.
    expect('the CRT preset really does more than the glow one without WebGL',
      drewCrt > drewGlow * 4, `hehku ${drewGlow} px, crt ${drewCrt} px`);

    // A context that throws outright must land in the same place as a null one.
    HTMLCanvasElement.prototype.getContext = function (type, opts) {
      if (String(type).startsWith('webgl')) throw new Error('ajuri estetty');
      return realGet.call(this, type, opts);
    };
    let threwOk = false;
    try {
      const fx = makeFX();
      threwOk = fx.init(testCanvas()) !== null && fx.mode === '2d';
    } catch {
      threwOk = false;
    } finally {
      HTMLCanvasElement.prototype.getContext = realGet;
    }
    expect('a driver that throws falls back instead of taking the game down', threwOk);

    /* Every preset has to survive being drawn, and 'pois' has to mean off —
     * an effects switch that does not switch anything off is worse than none. */
    const perPreset = [];
    for (const preset of PRESETS) {
      const fx = makeFX();
      const c = testCanvas();
      fx.init(c);
      fx.setPreset(preset);
      const before = pixels(c).slice();
      try {
        fx.apply(c.getContext('2d'));
        fx.present();
        perPreset.push({ preset, changed: differs(before, pixels(c)), error: null });
      } catch (err) {
        perPreset.push({ preset, changed: -1, error: err.message });
      }
    }
    const off = perPreset.find((p) => p.preset === 'pois');
    const on = perPreset.filter((p) => p.preset !== 'pois');
    expect('every effect preset renders, and "pois" really is off',
      perPreset.every((p) => !p.error) && off.changed === 0
      && on.every((p) => p.changed > 200),
      perPreset.map((p) => `${p.preset}:${p.error || p.changed}`).join(' '));

    /* Effects must leave the context exactly as they found it. A filter or a
     * composite mode left set wrecks the next frame's tiles, and that reads as
     * a graphics glitch rather than as a leak. */
    {
      const fx = makeFX();
      const c = testCanvas();
      fx.init(c);
      fx.setPreset('crt');
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      fx.apply(g);
      expect('effects put the drawing context back the way they found it',
        g.imageSmoothingEnabled === false && g.globalAlpha === 1
        && g.globalCompositeOperation === 'source-over'
        && (!('filter' in g) || g.filter === 'none'),
        `smoothing ${g.imageSmoothingEnabled}, alpha ${g.globalAlpha}, `
        + `op ${g.globalCompositeOperation}, filter ${g.filter}`);
    }

    // The preset is a taste decision, so it has to survive a reload.
    {
      const fx = makeFX();
      fx.init(testCanvas());
      fx.setPreset('crt');
      const other = makeFX();
      other.init(testCanvas());
      expect('the chosen preset is remembered', other.preset === 'crt', other.preset);
      const cycled = [fx.cyclePreset(), fx.cyclePreset(), fx.cyclePreset()];
      expect('the effects key cycles through every preset and back',
        cycled.join(',') === 'pois,hehku,crt', cycled.join(','));
    }

    /* The bloom reads back 4800 pixels every frame. That is affordable, but it
     * is exactly the kind of thing that quietly stops being affordable, so the
     * budget is asserted rather than assumed. */
    {
      const fx = makeFX();
      const c = testCanvas();
      fx.init(c);
      fx.setPreset('crt');
      const g = c.getContext('2d');
      fx.apply(g);                        // warm up
      const t0 = performance.now();
      for (let i = 0; i < 60; i++) fx.apply(g);
      const per = (performance.now() - t0) / 60;
      expect('the effect pass fits in the frame budget',
        per < 2.5, `${per.toFixed(2)} ms / frame`);
    }

    // And whatever the live game ended up with, it has to be a working mode.
    expect('the running game has a valid effect mode',
      ['webgl', '2d'].includes(game.fx.mode) && PRESETS.includes(game.fx.preset),
      `${game.fx.mode} / ${game.fx.preset}`);
    game.fx.setPreset('hehku');
  }

  /* -------------------------------- audio ------------------------------ */
  const { Sfx, Music } = await import('/src/core/audio.js');

  /* A backgrounded tab throttles setTimeout, so the sequencer can wake up
   * seconds behind the audio clock. Playing that backlog would build thousands
   * of oscillators in one turn of the event loop and freeze the keyboard. */
  {
    Sfx.resume();
    Music.play('level');
    const before = Music._step;
    Music._nextTime -= 30;                 // pretend the tab was hidden
    const t0 = performance.now();
    let threw = null;
    try { Music._tick(); } catch (err) { threw = err.message; }
    const elapsed = performance.now() - t0;
    const aligned = Music._step - before > 0 && Music._step % Music._loopLen < 8;
    expect('the sequencer drops a backlog instead of playing it',
      !threw && elapsed < 150 && aligned,
      `${Math.round(elapsed)}ms${threw ? `, threw ${threw}` : ''}`);
    Music.stop();
  }
  {
    const { getLevel, levelIds } = await import('/src/data/levels.js');
    const missing = [...new Set(levelIds().map((id) => getLevel(id).music).filter(Boolean))]
      .filter((name) => !Music.has(name));
    expect('every level names a real music track', missing.length === 0, missing.join(', '));
  }

  /* ------------------------------ rendering ---------------------------- */
  {
    const { drawBackdrop } = await import('/src/gfx/backdrop.js');
    const { drawTile, THEMES, T } = await import('/src/gfx/tiles.js');
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 208;
    const g = canvas.getContext('2d');

    // A backdrop that throws, or comes out as a flat wash, is a regression.
    const shot = (bg, theme, camX, tick) => {
      g.clearRect(0, 0, 320, 208);
      drawBackdrop(g, bg, theme, camX, 320, 208, tick);
      return g.getImageData(0, 0, 320, 208).data;
    };
    const badBg = [];
    for (const theme of Object.keys(THEMES)) {
      for (const bg of ['hills', 'dunes', 'peaks', 'factory', 'none']) {
        try {
          const near = shot(bg, theme, 0, 24);
          const far = shot(bg, theme, 640, 24);
          const seen = new Set();
          let moved = 0;
          for (let i = 0; i < near.length; i += 4 * 89) {
            seen.add((near[i] << 16) | (near[i + 1] << 8) | near[i + 2]);
            if (near[i] !== far[i] || near[i + 1] !== far[i + 1]) moved++;
          }
          if (seen.size < 5) badBg.push(`${theme}/${bg} flat`);
          if (moved < 8) badBg.push(`${theme}/${bg} does not parallax`);
        } catch (err) {
          badBg.push(`${theme}/${bg}: ${err.message}`);
        }
      }
    }
    expect('every backdrop renders with detail and parallax', badBg.length === 0, badBg.join(' '));

    const badTile = [];
    const chars = Object.values(T).filter((ch) => ch !== ' ');
    for (const theme of Object.keys(THEMES)) {
      for (const ch of chars) {
        try {
          for (const t of [0, 44]) {
            drawTile(g, ch, 0, 16, theme, 3, 5, t, ' ', { doorOpen: true });
            drawTile(g, ch, 0, 16, theme, 4, 5, t, '#', { doorOpen: false });
          }
        } catch (err) {
          badTile.push(`${theme}/${ch}: ${err.message}`);
        }
      }
    }
    expect('every tile type draws in every theme', badTile.length === 0, badTile.join(' '));
  }

  return {
    levels, checks, failures, worlds: WORLDS.length, ruleReport,
    audio: { sfx: Sfx.names(), music: Music.names() },
  };
});

await browser.close();
server.close();

/* Every Sfx.play('x') / Music.play('x') in the source must name a real sound. */
const sourceFiles = [];
{
  const { readdir } = await import('node:fs/promises');
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.js')) sourceFiles.push(full);
    }
  };
  await walk(join(ROOT, 'src'));
}
const audioRefs = [];
for (const file of sourceFiles) {
  const text = await readFile(file, 'utf8');
  for (const [, name] of text.matchAll(/Sfx\.play\([^)]*?'([\w-]+)'/g)) {
    audioRefs.push({ kind: 'sfx', name, file });
  }
  for (const [, name] of text.matchAll(/Music\.play\([^)]*?'([\w-]+)'/g)) {
    audioRefs.push({ kind: 'music', name, file });
  }
}
const unknownAudio = audioRefs
  .filter((ref) => !report.audio[ref.kind].includes(ref.name))
  .map((ref) => `${ref.kind} '${ref.name}' in ${ref.file.slice(ROOT.length)}`);
report.checks.push({
  name: 'every sound the code asks for exists',
  ok: unknownAudio.length === 0,
  detail: unknownAudio.length ? unknownAudio.join(', ') : `${audioRefs.length} call sites`,
});
if (unknownAudio.length) report.failures.push(...unknownAudio);

/* --------------------------------- output -------------------------------- */
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nSuper Fart Bros 3 — verify   (${report.worlds} worlds, ${report.levels.length} levels)\n`);
console.log(`  ${pad('LEVEL', 8)}${pad('BOT', 10)}${pad('REACH', 8)}STOPPED BY`);
for (const l of report.levels) {
  console.log(`  ${pad(l.id, 8)}${pad(l.result, 10)}${pad(`${l.progress ?? '-'}%`, 8)}${l.cause || ''}`);
}
console.log('');
for (const c of report.checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);

if (report.ruleReport.length) {
  console.log('\nSUUNNITTELUSAANNOT — korjattavaa:');
  for (const level of report.ruleReport) {
    const counts = {};
    for (const p of level.problems) {
      const kind = p.replace(/ at column \d+.*| at \d+,\d+.*| of \d+/g, '');
      counts[kind] = (counts[kind] || 0) + 1;
    }
    const summary = Object.entries(counts).map(([k, n]) => `${n}x ${k}`).join(', ');
    console.log(`  ${level.id.padEnd(6)} ${summary}`);
  }
}

const hardFailures = [...report.failures, ...(booted ? [] : ['game did not boot']), ...errors];
console.log('');
if (hardFailures.length) {
  console.log('FAILURES:');
  for (const f of hardFailures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('All checks passed, no page errors.\n');
