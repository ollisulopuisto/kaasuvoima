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
let devices;
try {
  // PW_MODULE lets a global install be used instead of a local devDependency.
  ({ chromium, devices } = await import(process.env.PW_MODULE || 'playwright'));
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
  const { PLAYER_SIZES } = await import('/src/gfx/sprites.js');
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

  /* ------------------- haarautuva kartta ja mitattu vaikeus ---------------- */

  /*
   * The map's shape rules. These are the ROADMAP's branch conditions turned
   * into something the data cannot get around: every level lies on a way from
   * the start to the fortress, every fork is described, and blocking every
   * rewarded route still leaves a way through.
   *
   * Red before green (DESIGN.md 7): the six broken worlds below come first, and
   * every one of them was checked to be reported before the real map was
   * changed to satisfy the same rules. The one that matters most is the second
   * — a level hanging off the road with no way back is exactly what 2-N was,
   * and it is the shape a half-finished branch has.
   */
  {
    const worlds = await import('/src/data/worlds.js');
    const real = WORLDS.flatMap((w) => worlds.worldProblems(w));
    expect('every world map is a shape the game can actually be played through',
      real.length === 0, real.slice(0, 4).join(' / '));

    /* 1-2 scores 122.8 and 1-3 scores 101.2, so `b` is the harder road. Reusing
     * real levels keeps the fixture honest about the measured table. */
    const mk = (over) => ({
      id: 'wT',
      name: 'TESTI',
      theme: 'grass',
      terrain: [],
      nodes: [
        { id: 's', tx: 0, ty: 0, type: 'start', name: 'ALKU' },
        { id: 'a', tx: 1, ty: 0, type: 'level', level: '1-1', name: 'A' },
        { id: 'b', tx: 2, ty: 0, type: 'level', level: '1-2', name: 'B' },
        { id: 'c', tx: 2, ty: 1, type: 'level', level: '1-3', name: 'C' },
        { id: 'f', tx: 3, ty: 0, type: 'fortress', level: '1-F', name: 'F' },
      ],
      links: [
        { a: 's', b: 'a' }, { a: 'a', b: 'b' }, { a: 'a', b: 'c' },
        { a: 'b', b: 'f' }, { a: 'c', b: 'f' },
      ],
      branches: [{
        from: 'a',
        to: 'f',
        routes: [
          { name: 'HELPPO', via: ['c'] },
          { name: 'VAIKEA', via: ['b'], reward: 'break' },
        ],
      }],
      ...over,
    });

    expect('a well-formed branching world reports nothing',
      worlds.worldProblems(mk({})).length === 0,
      worlds.worldProblems(mk({})).join(' / '));

    const cases = [
      ['umpikuja', 'umpikuja', mk({
        nodes: [...mk({}).nodes, { id: 'd', tx: 4, ty: 2, type: 'level', level: '2-N', name: 'D' }],
        links: [...mk({}).links, { a: 'b', b: 'd' }],
      })],
      ['ilmoittamaton haara', 'haarautuu ilmoittamatta', mk({ branches: [] })],
      ['reitti ilman linkkiä', 'puuttuu linkki', mk({
        links: mk({}).links.filter((l) => !(l.a === 'b' && l.b === 'f')),
      })],
      ['palkinto helpolla reitillä', 'ei ole vaikeampi', mk({
        branches: [{
          from: 'a',
          to: 'f',
          routes: [
            { name: 'HELPPO', via: ['c'], reward: 'break' },
            { name: 'VAIKEA', via: ['b'] },
          ],
        }],
      })],
      ['kaikki reitit palkittuja', 'helppo reitti ei vie linnakkeeseen', mk({
        branches: [{
          from: 'a',
          to: 'f',
          routes: [
            { name: 'HELPPO', via: ['c'], reward: 'break' },
            { name: 'VAIKEA', via: ['b'], reward: 'break' },
          ],
        }],
      })],
      ['tuntematon palkinto', 'tuntematon palkinto', mk({
        branches: [{
          from: 'a',
          to: 'f',
          routes: [
            { name: 'HELPPO', via: ['c'] },
            { name: 'VAIKEA', via: ['b'], reward: 'kultaharkko' },
          ],
        }],
      })],
    ];
    const missed = cases.filter(([, needle, world]) =>
      !worlds.worldProblems(world).some((p) => p.includes(needle)));
    expect('a broken map is reported rather than drawn',
      missed.length === 0, missed.map(([name]) => name).join(', ') || `${cases.length} tapausta`);
  }

  /* Every string the map data asks the map to print has to exist in the font.
   * A missing glyph does not throw — it leaves a hole and moves the cursor on —
   * so this draws each character alone and looks for ink, the same way the
   * challenge link's address box is checked. */
  {
    const worlds = await import('/src/data/worlds.js');
    const font = await import('/src/gfx/font.js');
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 12;
    const g = canvas.getContext('2d');
    const missing = new Set();
    for (const s of WORLDS.flatMap((w) => worlds.mapStrings(w))) {
      for (const ch of String(s).toUpperCase()) {
        if (ch === ' ') continue;
        g.clearRect(0, 0, 16, 12);
        font.drawText(g, ch, 2, 2, { color: '#ffffff' });
        const d = g.getImageData(0, 0, 16, 12).data;
        let ink = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) ink++;
        if (!ink) missing.add(ch);
      }
    }
    expect('every name the map prints is spellable in the font',
      missing.size === 0, missing.size ? `puuttuu: ${[...missing].join('')}` : '');
  }

  /* The measured difficulty has to reach the screen, not just the data file. */
  {
    const { WorldMapScene } = await import('/src/scenes/worldmap.js');
    const worlds = await import('/src/data/worlds.js');
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const g = canvas.getContext('2d');
    const shot = (nodeId, cleared = {}) => {
      reset();
      game.state.world = 1;
      game.state.node = nodeId;
      game.state.cleared = cleared;
      const map = new WorldMapScene(game);
      map.mode = 'idle';
      map.tick = 30;
      g.clearRect(0, 0, 320, 240);
      map.draw(g);
      return g.getImageData(0, 0, 320, 240).data;
    };
    const count = (data, [r, gg, b], y0, y1) => {
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < 320; x++) {
          const i = (y * 320 + x) * 4;
          if (data[i] === r && data[i + 1] === gg && data[i + 2] === b) n++;
        }
      }
      return n;
    };

    const w2 = WORLDS[1];
    const branch = worlds.branchAt(w2, 'w2-2');
    const easy = branch && branch.easiest;
    const hard = branch && branch.hardest;
    expect('world 2 forks, and the two roads measure differently',
      !!branch && easy.pips !== hard.pips && hard.score > easy.score,
      branch ? `${easy.name} ${easy.score.toFixed(1)} (${easy.pips}) vs `
        + `${hard.name} ${hard.score.toFixed(1)} (${hard.pips})` : 'ei haaraa');

    /* Tier 2 is #c8e048 and belongs to nothing else on this map, so its pixels
     * are the gentler road's own: its path dots and the bars under 2-N. */
    const atFork = shot('w2-2', { 'w2-2': true });
    expect('the gentler road is drawn in its measured tier colour',
      count(atFork, [200, 224, 72], 14, 158) > 30,
      `${count(atFork, [200, 224, 72], 14, 158)} px`);

    /* The board only exists where the roads part. Off the fork the same band is
     * the ordinary panel, so the difference is the board itself. */
    const off = shot('w2-1', { 'w2-2': true });
    const goldHere = count(atFork, [255, 208, 72], 200, 226);
    const goldThere = count(off, [255, 208, 72], 200, 226);
    expect('standing on the fork spells out both roads and what they pay',
      goldHere > 100 && goldThere === 0,
      `palkintotekstiä haarassa ${goldHere} px, muualla ${goldThere} px`);

    /* And the branch has to be walkable in both directions, or it is a picture
     * of a choice rather than one. */
    reset();
    game.state.world = 1;
    game.state.node = 'w2-2';
    game.state.cleared = { 'w2-2': true, 'w2-n': true, 'w2-3': true };
    const map = new WorldMapScene(game);
    const walkTo = (dir) => {
      map.mode = 'idle';
      map.tryMove(dir);
      for (let f = 0; f < 4000 && map.mode === 'walk'; f++) map.update({
        pressed: blank(), held: blank(), released: blank(), consume() {},
      });
      return map.node.id;
    };
    const low = walkTo('down');
    const toFort = walkTo('right');
    map.node = worlds.findNode(w2, 'w2-2');
    map.pos = { x: map.node.tx * 16 + 8, y: map.node.ty * 16 + 8 };
    const high = walkTo('right');
    expect('both roads out of the fork are walkable and both reach the fortress',
      low === 'w2-n' && toFort === 'w2-f' && high === 'w2-3',
      `alas ${low}, sieltä ${toFort}, oikealle ${high}`);
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
      // 260 and not 200: going in is a walk now, and the clear sequence that
      // used to start on contact starts when the body is gone. See below.
      for (let f = 0; f < 260 && !finished; f++) { s2.update(i); i.pressed = blank(); }
    }
    /* The door is several tiles now — big enough that the largest power level
     * walks through it rather than steps over it — so what matters is that it
     * exists, that it is tall enough for that player, and that touching it
     * ends the level. */
    const doorH = door.length ? Math.max(...door.map((d) => d.ty))
      - Math.min(...door.map((d) => d.ty)) + 1 : 0;
    expect('the fortress door opens once the boss is beaten',
      door.length > 0 && doorH * 16 >= 43 && !!finished && finished.cleared,
      `${door.length} ruutua, ${doorH} korkea, finished ${JSON.stringify(finished)}`);

    /*
     * Red before green (DESIGN.md §7) for the three ways the door did not work.
     *
     * 1. It never opened. `drawDoor` took an `open` parameter and spent it on a
     *    blinking handle and a faint halo — the leaves themselves never moved,
     *    so the one promise the whole fortress is built around was plumbed all
     *    the way to the drawing code and dropped there.
     * 2. Touching it ended the level on the same frame, and `completeLevel`
     *    sets `autoWalk`, so the player walked *past* the door he had just
     *    finished the game by entering.
     * 3. `TILE_INFO`'s `door` flag was read nowhere.
     */
    {
      const { drawTile } = await import('/src/gfx/tiles.js');
      reset({ type: 'shroom', level: 1 });
      const s3 = new LevelScene(game, '1-F');
      // The boss is not what this is about.
      s3.entities = s3.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
      s3.time = 9999;
      game.setScene(s3);
      let done = null;
      game.finishLevel = (r) => { done = r; };

      // The swing is a picture, so it is measured as one. Three moments of the
      // same door tile have to be three different pictures.
      const shots = [0, 0.5, 1].map((o) => {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.fillStyle = '#000';
        g.fillRect(0, 0, 16, 16);
        drawTile(g, 'D', 0, 0, 'fortress', 4, 6, 0,
          ' ', { doorOpen: o, doorEdges: { l: true, r: false, t: false, b: false } });
        return [...g.getImageData(0, 0, 16, 16).data].join(',');
      });
      expect('the fortress door visibly swings instead of only glowing',
        shots[0] !== shots[1] && shots[1] !== shots[2] && shots[0] !== shots[2],
        `kiinni=puoliauki ${shots[0] === shots[1]}, puoliauki=auki ${shots[1] === shots[2]}`);

      // A door that has only just been unlocked is not a door you can walk
      // into: the leaves are still moving.
      s3.bossDefeated = s3.tick + 1;
      const shut = s3.doorOpen;
      for (let f = 0; f < 40; f++) s3.tick++;
      expect('the door takes a moment to swing and then stays open',
        shut < 0.2 && s3.doorOpen === 1, `${shut} -> ${s3.doorOpen}`);

      // Walking in: the level must not end on contact, the body must go out of
      // sight, and the clear sequence must land on the frame it does.
      const cells = [];
      for (let ty = 0; ty < s3.h; ty++) {
        for (let tx = 0; tx < s3.w; tx++) if (s3.grid[ty][tx] === 'D') cells.push({ tx, ty });
      }
      const left = Math.min(...cells.map((c) => c.tx));
      const bottom = Math.max(...cells.map((c) => c.ty));
      s3.player.x = left * 16 - s3.player.w + 2;
      s3.player.y = (bottom + 1) * 16 - s3.player.h;
      s3.player.onGround = true;
      s3.centerCamera();
      const walk = mkInput();
      walk.held.right = true;
      let contactAt = -1;
      let clearAt = -1;
      let hidden = 0;
      for (let f = 0; f < 120 && clearAt < 0; f++) {
        walk.pressed = blank();
        s3.update(walk);
        if (contactAt < 0 && s3.player.transit) contactAt = f;
        if (s3.player.transit && s3.player.transit.phase === 'hold') hidden++;
        if (s3.state === 'clear' && clearAt < 0) clearAt = f;
      }
      /* The body is drawn clipped to the near side of `transit.hide`, so by the
       * end of the walk-in it is entirely on the far side of that line — which
       * is what "the player disappears" means when tiles draw before entities
       * and there is no depth buffer.
       *
       * Still 'gone' after the level has cleared, and still on the far side of
       * the line it disappeared behind: `completeLevel` sets `autoWalk`, and a
       * player who reappeared and strolled back out of the door would be the
       * original complaint with an animation in front of it. */
      const t = s3.player.transit;
      const gone = !!t && t.phase === 'gone'
        && (t.hideDir > 0 ? s3.player.x >= t.hide : s3.player.x + s3.player.w <= t.hide);
      let strolled = 0;
      const x0 = s3.player.x;
      for (let f = 0; f < 60; f++) { s3.update(walk); walk.pressed = blank(); }
      strolled = Math.abs(s3.player.x - x0);
      expect('walking into the door takes the player in before the level ends',
        contactAt >= 0 && clearAt > contactAt + 10 && hidden >= 3
        && s3.state === 'clear' && gone && strolled < 0.001,
        `kosketus ${contactAt}, selvä ${clearAt}, piilossa ${hidden} framea, `
        + `poissa ${gone}, käveli vielä ${strolled.toFixed(1)} px`);
      /* And where the clear sequence sits: on the frame the body is gone, not
       * on the frame it touched the door. 14 frames of walking in plus 5 of
       * empty doorway, so ~19; asserted as a window, because the exact number
       * is a tuning constant and the ordering is the decision. */
      expect('and the clear jingle waits for the picture, not the other way round',
        contactAt >= 0 && clearAt - contactAt >= 15 && clearAt - contactAt <= 25
        && done === null,
        `kosketuksesta selväksi ${clearAt - contactAt} framea, finished ${JSON.stringify(done)}`);
    }
  }

  /*
   * The jump budget must be reproducible from the engine that is in the tree.
   *
   * This is the one bug in this project's history that nothing could catch.
   * `tools/jump-budget.json` claimed a 121 px rise and a 200 px carry from the
   * commit that wrote it until 9.8.2026 — the physics change and the budget
   * file landed together and the budget was never re-measured, so the file was
   * wrong on arrival rather than gone stale. Nothing failed: the validator
   * reads the same file, so a too-generous budget makes every level *pass*, and
   * `difficulty.mjs` reads it too, so the curve looked fine as well. Both
   * gates were measuring against the claim instead of against the game.
   *
   * So this asserts the claim itself. It re-runs the two headline cases of
   * `measure-jump.mjs` — the standing held jump's rise and the running jump's
   * carry — and compares them with what the file says. It does NOT write the
   * file: `measure-jump.mjs` does that as a side effect, which is exactly why
   * a read-only check has to exist somewhere else.
   *
   * The tolerance is ±3 px. The measurement is deterministic (fixed 60 Hz
   * steps, no randomness), so anything beyond a rounding difference means the
   * constants moved and the file did not follow.
   */
  {
    const budget = await (await fetch('/tools/jump-budget.json')).json();
    const runway = (power) => {
      reset(power);
      const s = new LevelScene(game, '1-1');
      for (let y = 0; y < s.h - 2; y++) s.grid[y] = s.grid[y].map(() => ' ');
      for (let y = s.h - 2; y < s.h; y++) s.grid[y] = s.grid[y].map(() => '#');
      s.entities = s.entities.filter((e) => e.kind === 'player');
      s.goal = null;
      return s;
    };
    /** One held jump on clear floor; `runFrames` of held right first. */
    const arc = (runFrames, run) => {
      const s = runway({ type: 'shroom', level: 1 });
      const p = s.player;
      const i = mkInput();
      for (let f = 0; f < 40; f++) { s.update(i); i.pressed = blank(); }
      i.held.right = runFrames > 0;
      i.held.run = run;
      for (let f = 0; f < runFrames; f++) { s.update(i); i.pressed = blank(); }
      const x0 = p.x; const y0 = p.y;
      let peak = 0; let air = 0;
      i.pressed.jump = true; i.held.jump = true;
      s.update(i); i.pressed = blank();
      while (air < 400) {
        air++;
        i.held.jump = p.vy < 0;
        s.update(i);
        i.pressed = blank();
        peak = Math.max(peak, y0 - p.y);
        if (p.onGround && air > 4) break;
      }
      return { pFull: p.pFull, height: Math.round(peak), distance: Math.round(p.x - x0) };
    };

    const stand = arc(0, false);
    const runJump = arc(90, true);
    const claimed = (label) => budget.cases.find((c) => c.label === label) || {};
    const near = (a, b) => Math.abs(a - b) <= 3;
    const standClaim = claimed('standing, held');
    const runClaim = claimed('running, held');
    expect('the stored jump budget is reproducible from the current physics',
      !runJump.pFull
      && near(stand.height, standClaim.height) && near(runJump.height, runClaim.height)
      && near(runJump.distance, runClaim.distance),
      `paikaltaan ${stand.height}px (tiedostossa ${standClaim.height}), `
      + `juosten ${runJump.height}px / ${runJump.distance}px `
      + `(tiedostossa ${runClaim.height} / ${runClaim.distance})`);

    /* And that the design budget the validator uses is the one those numbers
     * imply. Same formula and same margin as measure-jump.mjs — duplicated on
     * purpose, so that editing the file by hand is caught rather than blessed. */
    const gap = Math.max(3, Math.floor((runJump.distance * 0.7) / 16));
    const wall = Math.max(2, Math.floor((runJump.height * 0.8) / 16));
    expect('the design budget follows from the measured jump',
      budget.margin === 0.7 && budget.gapTiles === gap && budget.wallTiles === wall,
      `kuilu ${budget.gapTiles} (mitattu ${gap}), seinä ${budget.wallTiles} (mitattu ${wall})`);
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

    /* The band split is load-bearing and silent when it breaks. Before it
     * existed, a 45-row level came back with zero problems — not because it was
     * sound, but because the rules read the sky band's empty floor rows, never
     * found ground, and never flushed the gap counter. Every geometry rule was
     * switched off and nothing said so. This asserts the one case that cannot
     * be guessed around: a tall level with no start marker is an error. */
    const tall = levelIds().map((id) => getLevel(id)).find((d) => d.rows.length > 15);
    if (tall) {
      const stripped = tall.rows.map((row) => row.replace('1', ' '));
      const problems = validateLevel(stripped, budget);
      expect('a tall level with no start marker is reported, not silently skipped',
        problems.some((p) => p.includes('no player start')), problems.slice(0, 2).join(' / '));
    }
    expect('at least one level is tall enough to have a hidden band', !!tall,
      tall ? `${tall.rows.length} riviä` : 'ei korkeita kenttiä');

    /* Red before green (DESIGN.md 7), for the two ways a hidden room turns into
     * a trap. Both are built here rather than borrowed from a real level,
     * because a rule proved only against content that happens to be correct is
     * a rule proved against nothing: the fixture is broken on purpose, one
     * fault at a time, and the same fixture with the fault taken out has to
     * come back silent.
     *
     * The shape is the shape every hidden area in the game has: a flat route
     * band with two warp pipes, a sealed room in the sky over one of them and a
     * sealed room in the cave under the other. Each room holds a power-up,
     * which is the whole reason the way out is measured at the tallest size —
     * you arrive small and you grow in there. */
    const tallFixture = ({ skyCeiling = 5, ledgeOverCaveExit = false } = {}) => {
      const W = 64;
      const g = Array.from({ length: 45 }, () => ' '.repeat(W));
      const put = (y, x, s) => { g[y] = g[y].slice(0, x) + s + g[y].slice(x + s.length); };
      const room = (top, ceiling, left, width, floorChar) => {
        put(top + ceiling, left, 'X'.repeat(width));
        for (let y = top + ceiling + 1; y <= top + 12; y++) {
          put(y, left, 'X'); put(y, left + width - 1, 'X');
        }
        put(top + 13, left, floorChar.repeat(width));
        put(top + 14, left, floorChar.repeat(width));
      };

      // Route band: flat ground, a start, a power-up inside the first quarter,
      // a flag, and the two warp pipes.
      put(28, 0, '#'.repeat(W)); put(29, 0, '#'.repeat(W));
      put(27, 2, '1');
      put(24, 8, '!');
      put(27, 60, 'F');
      put(27, 20, '()');   // down into the cave room: a pipe you stand on
      /* Up into the sky loft, and therefore a pipe that hangs. Row 24 is the
       * mouth because it leaves the three clear rows the tallest body needs
       * between it and the ground at row 28 — see `WARP_UP_REACH`. */
      put(24, 40, '()');
      for (let y = 18; y < 24; y++) put(y, 40, '{}');
      // The fault: two tiles of ground on the surface right over the cave
      // room's exit, so the warp back up has nowhere to put a 21x43 body.
      if (ledgeOverCaveExit) { put(26, 23, '####'); put(27, 23, '####'); }

      // Sky loft over the pipe at column 40. `skyCeiling` is its ceiling row:
      // 5 leaves the tallest size three clear rows over the floor, 10 leaves
      // two, which is the one-row-too-low fault.
      room(0, skyCeiling, 36, 14, '#');
      put(9, 42, '!');
      put(12, 46, '()');   // the way back down

      // Cave room under the pipe at column 20. The way back up hangs from its
      // ceiling, three clear rows over the floor at row 43.
      room(30, 5, 14, 14, 'X');
      put(39, 18, '!');
      for (let y = 36; y < 39; y++) put(y, 24, '{}');
      put(39, 24, '()');   // the way back up
      return g;
    };

    const sound = validateLevel(tallFixture(), budget);
    const lowCeiling = validateLevel(tallFixture({ skyCeiling: 10 }), budget);
    const sealedIn = validateLevel(tallFixture({ ledgeOverCaveExit: true }), budget);

    expect('a bonus room with a ceiling one row too low is reported',
      lowCeiling.length > 0 && lowCeiling.every((p) => p.startsWith('no headroom') && p.includes('sky band')),
      lowCeiling.slice(0, 3).join(' / ') || 'ei yhtään');
    expect('a bonus room whose exit pipe has nowhere to land is reported',
      sealedIn.length > 0 && sealedIn.every((p) => p === 'no way out of the cave band at the tallest size'),
      sealedIn.slice(0, 3).join(' / ') || 'ei yhtään');
    expect('the same tall fixture without the faults passes',
      sound.length === 0, sound.slice(0, 3).join(' / '));
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

    // The board should say which level the run reached, not just which world.
    scores.clearScores();
    scores.addScore({ name: 'LVL', score: 4242, world: 2, level: '2-3' });
    const withLevel = scores.loadScores()[0];
    scores.addScore({ name: 'OLD', score: 4000, world: 2 });
    const withoutLevel = scores.loadScores()[1];
    expect('a score remembers the level it reached, and old rows still load',
      withLevel.level === '2-3' && withoutLevel.level === '',
      `${withLevel.level} / "${withoutLevel.level}"`);
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

  /* ------------------------------- jakoruutu ---------------------------- */
  /* Jakoruudulla on neljä maailmaa — jako + leikepöytä, pelkkä jako, pelkkä
   * leikepöytä, ei kumpaakaan — eikä yhteenkään niistä voi luottaa selaimen
   * oletuksena, joten jokainen pakotetaan tyngällä. Kolme asiaa jotka tämä
   * vahtii: peruutus ei ole virhe, mikään ei lähde palvelimelle, eikä ruudulle
   * jää jumiin missään yhdistelmässä. */
  {
    const share = await import('/src/scenes/share.js');
    const scores = await import('/src/core/scores.js');
    const { HighScoreScene } = await import('/src/scenes/scores.js');
    const { Input } = await import('/src/core/input.js');
    const { textWidth, drawText: drawTextFn } = await import('/src/gfx/font.js');

    const settle = () => new Promise((r) => setTimeout(r, 0));
    const stub = (shareFn, clipFn) => {
      Object.defineProperty(navigator, 'share', {
        value: shareFn || undefined, configurable: true, writable: true,
      });
      Object.defineProperty(navigator, 'clipboard', {
        value: clipFn ? { writeText: clipFn } : undefined, configurable: true, writable: true,
      });
    };
    const unstub = () => {
      delete navigator.share;
      delete navigator.clipboard;
    };
    /* Yhden framen napautus kosketuksen tietä. Sama polku kuin puhelimessa,
     * eli myös nousureuna syntyy siellä missä oikeastikin. */
    const tap = (action) => {
      Input.setAction(action, true);
      game.step();
      Input.setAction(action, false);
      game.step();
    };

    stub(null, null);
    scores.clearScores();
    scores.addScore({ name: 'TESTI', score: 12345, world: 2, level: '2-3' });

    /* Reitti sisään ja ulos. Se on jakoruudun ensimmäinen vaatimus: sinne pitää
     * päästä ja sieltä pitää päästä pois, riippumatta siitä mitä jako teki. */
    reset();
    game.toHighScores(0);
    const board = game.scene;
    tap('run');
    const openedFromBoard = game.scene.constructor.name;
    for (let f = 0; f < 8; f++) game.step();
    tap('start');
    expect('pistetaulusta pääsee jakoruutuun ja ENTER tuo takaisin samaan tauluun',
      openedFromBoard === 'ShareScene' && game.scene === board,
      `${openedFromBoard} -> ${game.scene.constructor.name}`);

    game.toTitle();
    tap('run');
    const openedFromTitle = game.scene.constructor.name;
    for (let f = 0; f < 8; f++) game.step();
    tap('run');
    expect('alkuruudusta pääsee jakoruutuun ja X tuo takaisin',
      openedFromTitle === 'ShareScene' && game.scene.constructor.name === 'TitleScene',
      `${openedFromTitle} -> ${game.scene.constructor.name}`);

    // Juoksunappi on kentässä juoksu. Kohtauksen vaihto kesken hypyn tappaisi
    // kierroksen, joten jako ei ole siellä.
    reset();
    const midLevel = new LevelScene(game, '1-1');
    game.setScene(midLevel);
    tap('run');
    expect('kentästä ei voi avata jakoruutua juoksunapilla',
      game.scene === midLevel, game.scene.constructor.name);
    game.toTitle();

    /* Osoite on se jonka og:tagi ilmoittaa, ei sivun oma. Testipalvelin ajaa
     * 127.0.0.1:ssä, joten tämä testi erottaa ne kaksi toisistaan. */
    const meta = document.querySelector('meta[property="og:url"]').getAttribute('content');
    expect('jaettava osoite on og:url eikä sivun oma osoite',
      share.shareUrl() === meta && !share.shareUrl().includes('127.0.0.1'), share.shareUrl());

    const brag = share.shareText({ name: 'TESTI', score: 12345, world: 2, level: '2-3' });
    const plain = share.shareText(null);
    expect('jaettava rivi kertoo pisteet ja kentän, ja tyhjä taulu ei keksi tulosta',
      brag.includes('12345') && brag.includes('2-3') && brag.includes('Super Fart Bros 3')
      && !/\d{3}/.test(plain), `${brag} | ${plain}`);

    const combos = [
      [() => Promise.resolve(), () => Promise.resolve(), 'share'],
      [() => Promise.resolve(), null, 'share'],
      [null, () => Promise.resolve(), 'clipboard'],
      [null, null, 'none'],
    ];
    const detected = combos.map(([s, c, want]) => {
      stub(s, c);
      return share.shareCapability() === want;
    });
    expect('selaimen kyvyt tunnistetaan kaikissa neljässä yhdistelmässä',
      detected.every(Boolean), detected.join(','));

    /**
     * Avaa jakoruudun annetuilla tyngillä, painaa ja päästää jakonapin, odottaa
     * lupaukset ja poistuu. Palauttaa mitä tyngät näkivät ja mihin tilaan ruutu
     * jäi. Nousureuna on tässä olennainen: jako lähtee siitä eikä painalluksesta.
     */
    const runShare = async (shareFn, clipFn) => {
      const saw = { share: null, clip: null };
      stub(shareFn && ((d) => { saw.share = d; return shareFn(d); }),
        clipFn && ((t) => { saw.clip = t; return clipFn(t); }));
      const back = new HighScoreScene(game, 0);
      const scene = new share.ShareScene(game, back);
      game.setScene(scene);
      const i = mkInput();
      for (let f = 0; f < 8; f++) scene.update(i);
      i.pressed = blank();
      i.pressed.jump = true;
      scene.update(i);
      const armed = scene.armed;
      i.pressed = blank();
      i.released = blank();
      i.released.jump = true;
      scene.update(i);
      await settle();
      await settle();
      const status = scene.status;
      const j = mkInput();
      j.pressed.start = true;
      scene.update(j);
      return { saw, armed, status, left: game.scene === back, scene };
    };

    const abort = () => Promise.reject(Object.assign(new Error('cancel'), { name: 'AbortError' }));
    const denied = () => Promise.reject(Object.assign(new Error('nope'), { name: 'NotAllowedError' }));
    const ok = () => Promise.resolve();

    const both = await runShare(ok, ok);
    expect('jako ja leikepöytä: jakovalikko saa otsikon, rivin ja osoitteen',
      both.status === 'shared' && both.armed && both.left
      && both.saw.share && both.saw.share.url.startsWith(meta)
      && both.saw.share.text.includes('12345') && both.saw.clip === null,
      `${both.status}, leikepöytä ${both.saw.clip === null ? 'koskematta' : 'kosketettu'}`);

    const cancelled = await runShare(abort, ok);
    expect('peruutettu jako ei ole virhe eikä valu leikepöydälle',
      cancelled.status === 'cancelled' && cancelled.saw.clip === null && cancelled.left,
      `${cancelled.status}, leikepöytä ${cancelled.saw.clip === null ? 'koskematta' : 'kosketettu'}`);

    const fellBack = await runShare(denied, ok);
    expect('kaatunut jako putoaa leikepöydälle osoitteen kanssa',
      fellBack.status === 'copied' && typeof fellBack.saw.clip === 'string'
      && fellBack.saw.clip.includes(meta) && fellBack.left,
      `${fellBack.status}, ${fellBack.saw.clip}`);

    const shareOnly = await runShare(denied, null);
    expect('ilman leikepöytää kaatunut jako jättää osoitteen ruudulle',
      shareOnly.status === 'manual' && shareOnly.scene.url.startsWith(meta) && shareOnly.left,
      `${shareOnly.status}, ${shareOnly.scene.url}`);

    const clipOnly = await runShare(null, ok);
    expect('pelkkä leikepöytä kopioi rivin ja osoitteen',
      clipOnly.status === 'copied' && clipOnly.saw.clip.includes(meta)
      && clipOnly.saw.clip.includes('12345') && clipOnly.left,
      `${clipOnly.status}, ${clipOnly.saw.clip}`);

    const clipDenied = await runShare(null, denied);
    expect('kieltäytynyt leikepöytä ei jätä ruutua roikkumaan',
      clipDenied.status === 'manual' && !clipDenied.scene.busy && clipDenied.left,
      `${clipDenied.status}, busy ${clipDenied.scene.busy}`);

    const nothing = await runShare(null, null);
    expect('ilman jakoa ja leikepöytää ruutu näyttää osoitteen eikä lupaa nappia',
      nothing.status === 'manual' && nothing.scene.how === 'none'
      && nothing.scene.url.startsWith(meta) && nothing.left,
      `${nothing.status}, ${nothing.scene.how}`);

    const threw = await runShare(() => { throw new Error('synkroninen'); }, ok);
    expect('synkronisesti heittävä jako kaatuu leikepöydälle eikä sivulle',
      threw.status === 'copied' && threw.left, threw.status);

    /* Nousureuna ilman painallusta ei saa laukaista mitään. Edellisestä
     * ruudusta roikkuva nappi tuottaa juuri sellaisen. */
    let ghost = null;
    stub((d) => { ghost = d; return Promise.resolve(); }, null);
    const loose = new share.ShareScene(game, null);
    const li = mkInput();
    for (let f = 0; f < 8; f++) loose.update(li);
    li.released = blank();
    li.released.jump = true;
    loose.update(li);
    await settle();
    expect('pelkkä napin nousu ilman painallusta ei jaa mitään',
      ghost === null && loose.status === 'idle', `${loose.status}`);

    /* Mikään tässä ruudussa ei saa ottaa yhteyttä mihinkään. Sama peruste kuin
     * telemetrian palvelinlähetyksen jättämisessä tekemättä. */
    const shareSrc = await (await fetch('/src/scenes/share.js')).text()
      + await (await fetch('/src/core/challenge.js')).text();
    const net = ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'img.src']
      .filter((n) => shareSrc.includes(n));
    expect('jakoruutu ei lähetä mitään minnekään', net.length === 0, net.join(', ') || 'ei verkkokutsuja');

    // Pisin mahdollinen kehu: kuusi kirjainta, seitsemän numeroa, linnake.
    const widest = share.wrapText(
      share.shareText({ name: 'ÄÄKKÖS', score: 9999999, world: 5, level: '5-F' }), 46,
    );
    const tooWide = widest.filter((l) => textWidth(l) > 300);
    expect('pisin mahdollinen kehu rivittyy ruudun leveyteen',
      tooWide.length === 0 && widest.length <= 3, `${widest.length} riviä, ${tooWide.length} yli`);

    {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 240;
      const g = c.getContext('2d');
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      const leaks = [];
      let flat = 0;
      for (const st of ['idle', 'busy', 'shared', 'copied', 'cancelled', 'manual']) {
        for (const how of ['share', 'clipboard', 'none']) {
          const scene = new share.ShareScene(game, null);
          scene.how = how;
          scene.status = st;
          g.clearRect(0, 0, 320, 240);
          scene.draw(g);
          if (g.globalAlpha !== 1) leaks.push(`${how}/${st} alpha ${g.globalAlpha}`);
          if (g.globalCompositeOperation !== 'source-over') leaks.push(`${how}/${st} ${g.globalCompositeOperation}`);
          if (g.filter && g.filter !== 'none') leaks.push(`${how}/${st} filter ${g.filter}`);
          const px = g.getImageData(0, 0, 320, 240).data;
          const seen = new Set();
          for (let p = 0; p < px.length; p += 4 * 37) {
            seen.add((px[p] << 16) | (px[p + 1] << 8) | px[p + 2]);
          }
          if (seen.size < 5) flat++;
        }
      }
      expect('jakoruudun piirto jättää canvasin tilan ennalleen ja piirtää jotain',
        leaks.length === 0 && flat === 0, leaks.join(', ') || `${flat} tyhjää`);
    }

    /* ---------------------------- haastelinkki -------------------------- */
    /* Tulos kulkee osoiteparametreissa (`?s=45200&n=OLLI&l=2-3`). Tässä
     * lohkossa testataan luku, kirjoitus ja mitat; sivunlatauksen vaativat
     * asiat — osoiterivin siivous ja "mitään ei kirjoiteta" — ovat omassa
     * selainkontekstissaan tämän tiedoston lopussa. */
    {
      const ch = await import('/src/core/challenge.js');
      const { TitleScene } = await import('/src/scenes/title.js');

      const link = ch.appendChallenge(meta, { name: 'OLLI', score: 45200, level: '2-3' });
      expect('jakolinkki kantaa tuloksen, nimen ja kentän',
        link === `${meta}?s=45200&n=OLLI&l=2-3`, link);

      /* Tyhjä taulu ei saa tuottaa `?s=0`. Nollan kehuminen on huonompi kuin
       * kehumatta jättäminen, ja vastaanottaja saisi haasteen jonka voittaa
       * kävelemällä ensimmäisen kolikon ohi. */
      const bare = [
        ch.appendChallenge(meta, null),
        ch.appendChallenge(meta, { name: 'OLLI', score: 0, level: '1-1' }),
        ch.appendChallenge(meta, { name: 'OLLI', score: -5 }),
      ];
      expect('tyhjä taulu jakaa pelkän osoitteen eikä nollatulosta',
        bare.every((u) => u === meta), bare.join(' | '));

      const round = ch.parseChallenge(new URL(
        ch.appendChallenge(meta, { name: 'ÄÄKKÖS', score: 9999999, level: '5-F' }),
      ).search);
      expect('linkin tulos luetaan takaisin sellaisenaan, ääkkösineen',
        round && round.score === 9999999 && round.name === 'ÄÄKKÖS' && round.level === '5-F',
        JSON.stringify(round));

      /* Roskaa parametreissa. Sääntö on yksi: haaste on väite ajosta jonka
       * *tämä peli* olisi voinut tuottaa, ja jos väite ei ole sellainen, ei ole
       * haastetta. Puolikas haaste ruudulla olisi pahempi kuin ei haastetta. */
      const junk = ['', '?', '?n=OLLI&l=2-3', '?s=', '?s=abc', '?s=-5', '?s=1e999',
        '?s=0', '?s=0000000', '?s=45200.5', '?s=45200x', '?s=+45200', '?s=%2045200',
        '?s=99999999', '?s=NaN', '?s=Infinity', '?s=١٢٣'];
      const wrong = junk.filter((q) => ch.parseChallenge(q) !== null);
      expect('roska osoiteparametreissa ei tuota haastetta lainkaan',
        wrong.length === 0, wrong.join(' ') || `${junk.length} roskatapausta`);

      /* Nimi on ainoa vapaa teksti linkissä. Se piirretään pelin omalla
       * fontilla, joten injektiopintaa ei ole — mutta 500 merkkiä levittäisi
       * rivin ruudun ulkopuolelle, ja fontin tuntematon merkki vie leveyttä
       * piirtämättä mitään. Siksi nimi sekä suodatetaan että katkaistaan. */
      const longName = ch.parseChallenge(`?s=1000&n=${'A'.repeat(500)}`);
      const emoji = ch.parseChallenge('?s=1000&n=%F0%9F%92%A9%F0%9F%92%A9');
      const mixed = ch.parseChallenge('?s=1000&n=%F0%9F%92%A9olli%F0%9F%92%A9');
      const rtl = ch.parseChallenge('?s=1000&n=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7');
      expect('pitkä tai piirtokelvoton nimi katkaistaan ja suodatetaan',
        longName && longName.name === 'AAAAAA'
        && emoji && emoji.name === 'KAVERI'
        && mixed && mixed.name === 'OLLI'
        && rtl && rtl.name === 'KAVERI',
        [longName, emoji, mixed, rtl].map((c) => c && c.name).join(' | '));

      /* Kenttätunnus on kuvateksti eikä haasteen ehto, joten tuntematon tunnus
       * jätetään pois eikä koko haastetta hylätä. */
      const ghostLevel = ch.parseChallenge('?s=1000&n=OLLI&l=9-9');
      const realLevel = ch.parseChallenge('?s=1000&n=OLLI&l=2-3');
      expect('tuntematon kenttätunnus jätetään pois mutta haaste jää voimaan',
        ghostLevel && ghostLevel.score === 1000 && ghostLevel.level === ''
        && realLevel && realLevel.level === '2-3',
        `${ghostLevel && ghostLevel.level}|${realLevel && realLevel.level}`);

      /* Sama sääntö kuin pistetaululla: pisteet pitää *voittaa*, ei tasata. */
      const target = ch.parseChallenge('?s=45200&n=OLLI&l=2-3');
      expect('haasteen voittaa vain suuremmalla tuloksella',
        ch.beats(45201, target) && !ch.beats(45200, target) && !ch.beats(0, target)
        && !ch.beats(-1, target) && !ch.beats(999999, null),
        `${ch.beats(45201, target)}/${ch.beats(45200, target)}`);

      // Pisin mahdollinen haasterivi: kuusi kirjainta, seitsemän numeroa, linnake.
      const widestCh = { name: 'ÄÄKKÖS', score: 9999999, level: '5-F' };
      const lines = [
        ch.challengeLine({ ...widestCh, beaten: false }),
        ch.challengeLine({ ...widestCh, beaten: true }),
        ch.challengeLine({ ...longName, name: 'AAAAAA' }),
      ];
      const over = lines.filter((l) => textWidth(l) > 300);
      expect('pisin mahdollinen haasterivi mahtuu 320 pikselin ruudulle',
        over.length === 0 && lines.every((l) => l.length > 0),
        over.map((l) => `${textWidth(l)}px ${l}`).join(', ') || lines[0]);

      /* Jokainen merkki haasterivillä pitää löytyä pelin fontista. Puuttuva
       * glyyfi ei kaada mitään — `drawText` hyppää sen yli mutta siirtää silti
       * kohdistinta — joten virhe olisi aukko tekstissä eikä poikkeus, ja se
       * huomattaisiin vasta ruutukaappauksesta. Sen takia se mitataan
       * musteesta eikä luetella käsin. */
      {
        const ink = document.createElement('canvas');
        ink.width = 16;
        ink.height = 12;
        const ig = ink.getContext('2d');
        const blank = new Set();
        const board = [
          `VOITIT HAASTEEN! ${widestCh.name} SAI 9 999 999`,
          `${widestCh.name} JOHTAA YHÄ: 9 999 999`,
          `HAASTE: ${widestCh.name} 9 999 999`,
        ];
        for (const text of [...lines, ...board]) {
          for (const chr of new Set(text.toUpperCase())) {
            if (chr === ' ') continue;
            ig.clearRect(0, 0, 16, 12);
            drawTextFn(ig, chr, 1, 1, { color: '#ffffff' });
            const px = ig.getImageData(0, 0, 16, 12).data;
            let lit = 0;
            for (let p = 3; p < px.length; p += 4) if (px[p] > 0) lit++;
            if (!lit) blank.add(chr);
          }
        }
        const wideBoard = board.filter((l) => textWidth(l) > 300);
        expect('haaste- ja pistetaulurivit piirtyvät kokonaan pelin omalla fontilla',
          blank.size === 0 && wideBoard.length === 0,
          blank.size ? `fontista puuttuu: ${[...blank].join(' ')}`
            : `${lines.length + board.length} riviä, levein ${Math.max(...[...lines, ...board].map((l) => textWidth(l)))}px`);
      }

      // 45 200 eikä 45200: kolmen ryhmät ovat ainoa syy siihen että ruudulta
      // näkee yhdellä silmäyksellä onko luku kymmeniä vai satojatuhansia.
      expect('haasteen pisteet ryhmitellään luettavaan muotoon',
        ch.groupThousands(45200) === '45 200' && ch.groupThousands(999) === '999'
        && ch.groupThousands(9999999) === '9 999 999',
        ch.groupThousands(45200));

      /* Alkuruutu piirtää haasteen omalla fontillaan. Seisova peli saa oman
       * seisojan (`Object.create`) samasta syystä kuin esittelytila: testin ei
       * pidä jättää haastetta oikeaan peliin roikkumaan. */
      {
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 240;
        const g = c.getContext('2d');
        const leaks = [];
        /* Sama ruutu samalla tikillä, haasteella ja ilman: erotus on juuri se
         * mitä haaste piirtää. Pelkkä "onko tuolla jotain" ei erottaisi
         * haastetta taivaan liukuväristä, ja se testi menisi läpi tyhjänäkin. */
        const shot = (ch) => {
          const stand = Object.create(game);
          if (ch) stand.challenge = ch;
          const title = new TitleScene(stand);
          title.enter();
          title.tick = 40;
          title.puffs = [];
          g.clearRect(0, 0, 320, 240);
          title.draw(g);
          if (g.globalAlpha !== 1) leaks.push(`alpha ${g.globalAlpha}`);
          if (g.globalCompositeOperation !== 'source-over') leaks.push(g.globalCompositeOperation);
          return new Uint8ClampedArray(g.getImageData(0, 0, 320, 240).data);
        };
        const diff = (a, b) => {
          let n = 0;
          let outside = 0;
          for (let p = 0; p < a.length; p += 4) {
            if (a[p] === b[p] && a[p + 1] === b[p + 1] && a[p + 2] === b[p + 2]) continue;
            n++;
            // Alkuruudun logolaatikko alkaa riviltä 26; haaste ei saa peittää
            // sitä eikä valikkoa, joten muutoksen pitää mahtua taivaskaistaan.
            if (Math.floor(p / 4 / 320) >= 26) outside++;
          }
          return { n, outside };
        };
        const plain = shot(null);
        const openPx = shot({ ...widestCh, beaten: false });
        const wonPx = shot({ ...widestCh, beaten: true });
        const open = diff(plain, openPx);
        const won = diff(plain, wonPx);
        /* Kolmas vertailu on se joka oikeasti mittaa tekstin: taustapalkki
         * muuttaa koko kaistan kummassakin tapauksessa, joten pelkkä "erosi
         * tyhjästä" saturoituu palkkiin eikä näkisi tekstiä lainkaan. */
        const wording = diff(openPx, wonPx);
        expect('alkuruutu näyttää haasteen omalla rivillään eikä muuten muutu',
          leaks.length === 0 && open.n > 200 && won.n > 200 && wording.n > 100
          && open.outside === 0 && won.outside === 0 && wording.outside === 0
          && !game.challenge,
          leaks.join(', ')
          || `avoin ${open.n}px, voitettu ${won.n}px, sanamuotoero ${wording.n}px`
             + ` (väärässä paikassa ${open.outside}/${won.outside}/${wording.outside})`);
      }

      /* Pistetaulu on se ruutu joka kertoo voitosta: kierros päättyy sinne aina.
       * Ilman tätä haaste on pelkkä kuvateksti. */
      {
        const stand = Object.create(game);
        stand.challenge = { score: 45200, name: 'OLLI', level: '2-3', beaten: false };
        const lost = new HighScoreScene(stand, -1, null, 45200);
        const lostFlag = lost.beat;
        const won = new HighScoreScene(stand, -1, null, 45201);
        expect('pistetaulu kertoo kun haaste on voitettu, ja vasta silloin',
          lostFlag === false && won.beat === true && stand.challenge.beaten === true,
          `tasapeli ${lostFlag}, voitto ${won.beat}`);
      }

      /* …ja sama koko kierroksen mitalta, `finishRun`in kautta. Ero edelliseen
       * on olennainen: yllä testattiin että ruutu osaa kertoa, tässä että
       * tulos ylipäätään päätyy sinne. Kolme reittiä, ja ne menevät eri kautta:
       * listalle päässyt kierros käy nimikysymyksen läpi, listan ulkopuolelle
       * jäänyt ei, ja warpattu kierros ei saa voittaa haastetta lainkaan. */
      {
        const target = { score: 45200, name: 'OLLI', level: '2-3', beaten: false };
        const finish = (score, extra = {}) => {
          const stand = Object.create(game);
          stand.challenge = { ...target };
          stand.state = {
            ...game.state, score, world: 1, continues: 0, usedSaveState: false, ...extra,
          };
          stand.pendingNode = { level: '2-3' };
          stand.finishRun();
          if (stand.scene.constructor.name === 'NameEntryScene') stand.scene.submit();
          return stand.scene;
        };

        // Täysi taulu, jotta listan ulkopuolelle jäävä kierros on saatavissa.
        scores.clearScores();
        for (let i = 0; i < 10; i++) {
          scores.addScore({ name: 'HUIPPU', score: 9999999 - i, world: 5, level: '5-F' });
        }
        const offBoard = finish(45201);
        scores.clearScores();
        const onBoard = finish(45201);
        scores.clearScores();
        const short = finish(45200);
        scores.clearScores();
        const warped = finish(9999999, { debugWarped: true });
        scores.clearScores();

        expect('haasteen voitto kerrotaan myös listan ulkopuolelle jääneelle kierrokselle',
          offBoard.constructor.name === 'HighScoreScene' && offBoard.beat === true
          && onBoard.constructor.name === 'HighScoreScene' && onBoard.beat === true
          && short.beat === false && warped.beat === false,
          `ulkona ${offBoard.beat}, listalla ${onBoard.beat}, tasapeli ${short.beat}, warpattu ${warped.beat}`);

        scores.addScore({ name: 'TESTI', score: 12345, world: 2, level: '2-3' });
      }

      /* Tämä on koko ominaisuuden vaarallisin kohta: jos vastaanottaja jakaa
       * omasta jakoruudustaan, lähtevän linkin pitää kantaa *hänen* tuloksensa.
       * Muuten linkki muuttuu matkalla ja kaveripiiri jakaa yhtä ja samaa
       * pistemäärää ristiin. */
      {
        const stand = Object.create(game);
        stand.challenge = { score: 45200, name: 'OLLI', level: '2-3', beaten: false };
        const scene = new share.ShareScene(stand, null);
        expect('vastaanotettu haaste ei matkusta eteenpäin omassa jakolinkissä',
          scene.url.includes('s=12345') && !scene.url.includes('45200')
          && !scene.url.includes('OLLI'), scene.url);
      }

      /* Osoitelaatikko on porras 3: se osoite jonka pelaaja kirjoittaa ylös kun
       * jakovalikkoa ja leikepöytää ei ole. Jaettu linkki kantaa tuloksen,
       * mutta laatikossa lukee perusosoite — koska pelin 5x7-fontissa **ei ole
       * et-merkkiä**, ja kyselymerkkijono piirtyisi ilman sitä rikkinäisenä.
       *
       * Se ei ole mielipide vaan mitattavissa: piirretään jokainen laatikon
       * merkki yksinään ja katsotaan jäikö mustetta. Puuttuva glyyfi jättää
       * tyhjää mutta siirtää silti kohdistinta, eli virhe olisi näkymätön
       * kaikille paitsi sille joka yrittää kirjoittaa osoitteen ylös. */
      {
        scores.clearScores();
        scores.addScore({ name: 'ÄÄKKÖS', score: 9999999, world: 5, level: '5-F' });
        const scene = new share.ShareScene(game, null);
        const ink = document.createElement('canvas');
        ink.width = 16;
        ink.height = 12;
        const ig = ink.getContext('2d');
        const blank = [];
        for (const chr of new Set(scene.shown.toUpperCase())) {
          if (chr === ' ') continue;
          ig.clearRect(0, 0, 16, 12);
          drawTextFn(ig, chr, 1, 1, { color: '#ffffff' });
          const px = ig.getImageData(0, 0, 16, 12).data;
          let lit = 0;
          for (let p = 3; p < px.length; p += 4) if (px[p] > 0) lit++;
          if (!lit) blank.push(chr);
        }
        expect('osoitelaatikon osoite on kokonaan piirtokelpoinen ja mahtuu laatikkoon',
          blank.length === 0 && textWidth(scene.shown) <= 268
          && scene.shown === meta && scene.url !== scene.shown
          && scene.carries === true && scene.url.includes('s=9999999'),
          blank.length ? `fontista puuttuu: ${blank.join(' ')}`
            : `laatikko ${scene.shown} (${textWidth(scene.shown)}px), lähtee ${scene.url}`);
        scores.clearScores();
        scores.addScore({ name: 'TESTI', score: 12345, world: 2, level: '2-3' });
      }
    }

    unstub();
    scores.clearScores();
    reset();
    game.toTitle();
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

  /* --------------------- pavunvarsi ja piilotettu alue ------------------ */
  {
    const mk = (power) => {
      reset(power);
      const s = new LevelScene(game, '1-2');
      s.entities = s.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
      s.time = 9999;
      game.scene = s;
      return s;
    };
    const put = (s, tx, ty) => {
      s.player.x = tx * 16 + (16 - s.player.w) / 2;
      s.player.y = ty * 16 - s.player.h;
      s.player.vy = 0;
      s.player.climbing = false;
      s.player.warpLock = 0;
    };
    const hold = (s, i, keys, frames) => {
      for (let f = 0; f < frames; f++) {
        i.held = blank();
        for (const k of keys) i.held[k] = true;
        i.pressed = blank();
        s.update(i);
      }
    };

    /* Both ends of the size range. The widest body is three tiles across while
     * it hangs off a vine, so anything solid beside the vine is a ceiling only
     * the big player hits — exactly the sort of thing that ships unnoticed. */
    for (const power of [{ type: null, level: 0 }, { type: 'leaf', level: 5 }]) {
      const s = mk(power);
      const i = mkInput();
      put(s, 150, 28);
      hold(s, i, ['up'], 360);
      const up = s.player.y + s.player.h < 15 * 16;
      hold(s, i, ['right'], 60);
      const onPlatform = s.player.onGround && Math.round(s.player.y + s.player.h) === 9 * 16;
      const coins = game.state.coins;
      hold(s, i, ['right'], 180);          // walk off the edge and fall home
      expect(`the beanstalk goes up and lets power ${power.level} back down`,
        up && onPlatform && game.state.coins > coins && s.player.onGround
        && !s.player.dying && s.player.y + s.player.h > 27 * 16,
        `taivaassa ${up}, lavalla ${onPlatform}, jalat ${Math.round(s.player.y + s.player.h)}`);

      // Down the pipe, and — the part that matters — back out of it. A bonus
      // area you cannot leave is a trap, not a bonus.
      const c = mk(power);
      put(c, 229, 26);
      // 90 and not 40: going down a pipe is a slide now, and there is still a
      // drop to the cave floor at the end of it.
      hold(c, i, ['down'], 90);
      const inCave = c.player.y > 30 * 16 && c.player.onGround && !c.player.dying;
      /* Standing on the room's floor under the exit, not on top of a pipe: the
       * way out hangs from the ceiling now, and you leave the way you came —
       * facing the mouth you are about to travel through. */
      put(c, 250, 43);
      hold(c, i, [], 3);
      c.player.warpLock = 0;
      hold(c, i, ['up'], 90);
      hold(c, i, [], 20);
      expect(`the warp pipe takes power ${power.level} down and the cave lets it out`,
        inCave && c.player.y < 30 * 16 && c.player.onGround && !c.player.dying
        && c.state === 'play',
        `luolassa ${inCave}, paluu ${Math.round(c.player.y + c.player.h)}`);
    }

    const s = mk({ type: null, level: 0 });
    const i = mkInput();
    put(s, 229, 26);
    const y0 = s.player.y;
    hold(s, i, ['up'], 60);
    expect('a warp pipe will not throw you into empty sky',
      Math.abs(s.player.y - y0) < 1, `${Math.round(y0)} -> ${Math.round(s.player.y)}`);

    /* Stacking bands changes what a pit is: a bottomless column in the route
     * band now has a cellar under it. Falling in has to still kill, and kill at
     * the same moment, rather than become a scenic tour of the secret. */
    const pit = mk({ type: null, level: 0 });
    pit.player.x = 71 * 16;
    pit.player.y = 26 * 16;
    let frames = 0;
    while (pit.state === 'play' && frames < 200) { pit.update(i); frames++; }
    expect('falling into a pit still kills instead of touring the secret',
      pit.state === 'dead' && frames < 45 && pit.player.y < 32 * 16,
      `${frames} framea, y ${Math.round(pit.player.y)}`);

    // And walking the ordinary route must never show the band above or below.
    const run = mk({ type: 'shroom', level: 1 });
    let worst = 15 * 16;
    for (let f = 0; f < 900 && run.state === 'play'; f++) {
      i.held = blank(); i.held.right = true; i.held.run = true;
      i.pressed = blank();
      if (run.player.onGround && f % 27 === 0) { i.pressed.jump = true; i.held.jump = true; }
      run.update(i);
      worst = Math.max(worst, run.cam.y);
    }
    expect('the ground route never shows another band', worst <= 15 * 16 + 32,
      `cam.y ${Math.round(worst)}`);
  }

  /* ------------------- putken suunta ja putkessa kulkeminen -------------- */
  /*
   * Red before green (DESIGN.md §7) for the rule that the direction you travel
   * has to match the mouth you enter — and for the content that now obeys it.
   *
   * The fixture used to be two pipes pasted into a level, because no shipped
   * chunk had a ceiling pipe: every upward warp in the game stood on the floor,
   * which is what `WARP_COMPAT.upFromFloor` existed to keep working. The rooms
   * carry their own ceilings now, so the rule is proved against them directly.
   *
   * **Every hidden room, in and out, at all six body sizes.** That is the only
   * evidence that matters here. A room you can enter and not leave is the trap
   * `secrets.js` exists to prevent, and the body that gets stuck is the tallest
   * (21x43 px) — which is also the one that arrives last, because every one of
   * these rooms holds a power-up.
   */
  {
    const mk = (power, id = '1-2') => {
      reset(power);
      const s = new LevelScene(game, id);
      s.entities = s.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
      s.time = 9999;
      game.scene = s;
      return s;
    };
    /* `ty` is always the row the **feet** stand on — on a floor pipe's mouth,
     * or on the floor under a ceiling pipe's. That is one sentence for both
     * directions: stand where the pipe is and press the way it points. */
    const put = (s, tx, ty) => {
      s.player.x = tx * 16 + (16 - s.player.w) / 2;
      s.player.y = ty * 16 - s.player.h;
      s.player.vy = 0;
      s.player.onGround = true;
      s.player.climbing = false;
      s.player.warpLock = 0;
      s.centerCamera();
    };
    const hold = (s, i, keys, frames) => {
      for (let f = 0; f < frames; f++) {
        i.held = blank();
        for (const k of keys) i.held[k] = true;
        i.pressed = blank();
        s.update(i);
      }
    };
    const i = mkInput();
    const bandOf = (s) => Math.floor((s.player.y + s.player.h - 1) / (15 * 16));

    /* The five hidden rooms in the game, and the two journeys each one owes
     * the player. `into` is the band the way in arrives in: 0 is the sky, 2 is
     * the cave, and coming back always means band 1. */
    const ROOMS = [
      { room: 'cave_room (1-2)', id: '1-2', in: [229, 26, 'down'], out: [250, 43, 'up'], into: 2 },
      { room: 'tomb_cave (2-2)', id: '2-2', in: [229, 26, 'down'], out: [235, 43, 'up'], into: 2 },
      { room: 'cave_room (3-2)', id: '3-2', in: [233, 26, 'down'], out: [254, 43, 'up'], into: 2 },
      { room: 'fac_cellar (4-2)', id: '4-2', in: [133, 26, 'down'], out: [140, 43, 'up'], into: 2 },
      { room: 'fac_loft (4-2)', id: '4-2', in: [245, 28, 'up'], out: [252, 12, 'down'], into: 0 },
    ];

    for (const r of ROOMS) {
      const bad = [];
      for (let level = 0; level <= 5; level++) {
        const power = level === 0 ? { type: null, level: 0 } : { type: 'shroom', level };
        const into = mk(power, r.id);
        put(into, r.in[0], r.in[1]);
        hold(into, i, [r.in[2]], 120);
        hold(into, i, [], 30);
        if (!(bandOf(into) === r.into && into.player.onGround && !into.player.dying)) {
          bad.push(`koko ${level} ei päässyt sisään (kaista ${bandOf(into)})`);
        }
        const back = mk(power, r.id);
        put(back, r.out[0], r.out[1]);
        hold(back, i, [], 3);
        back.player.warpLock = 0;
        hold(back, i, [r.out[2]], 120);
        hold(back, i, [], 30);
        if (!(bandOf(back) === 1 && back.player.onGround && !back.player.dying
          && back.state === 'play')) {
          bad.push(`koko ${level} ei päässyt ulos (kaista ${bandOf(back)})`);
        }
      }
      expect(`${r.room} is enterable and leavable at all six sizes`,
        bad.length === 0, bad.join(', ') || 'kuusi kokoa sisään ja ulos');
    }

    /*
     * And the rule itself, stated as a refusal, because the room tests above
     * would still pass if `tryWarp` went back to reading one tile in both
     * directions.
     *
     * The pipe is pasted in rather than borrowed: no floor pipe in the shipped
     * game has a legal band above it any more, and a refusal that could be
     * blamed on the landing proves nothing about the direction. This one has a
     * landing — clear surface at columns 252-253 with the route's own ground
     * under it — and is refused anyway, because it is a pipe you are standing
     * on top of and the top of a pipe is capped.
     */
    const floorPipe = mk({ type: null, level: 0 });
    floorPipe.grid[42][252] = '(';
    floorPipe.grid[42][253] = ')';
    put(floorPipe, 252, 42);
    const stayY = floorPipe.player.y;
    hold(floorPipe, i, ['up'], 60);
    expect('pressing up on a pipe standing on the floor is not a way in',
      Math.abs(floorPipe.player.y - stayY) < 1 && !floorPipe.player.transit,
      `${Math.round(stayY)} -> ${Math.round(floorPipe.player.y)}`);

    /* …and the same pipe pressed downwards is refused too, for the other half
     * of the reason: below it is the bottom of the level. Nothing about the
     * fixture is a warp that happens to be broken. */
    const noBand = mk({ type: null, level: 0 });
    noBand.grid[42][252] = '(';
    noBand.grid[42][253] = ')';
    put(noBand, 252, 42);
    const downY = noBand.player.y;
    hold(noBand, i, ['down'], 60);
    expect('a warp with no band under it stays put',
      Math.abs(noBand.player.y - downY) < 1 && !noBand.player.transit,
      `${Math.round(downY)} -> ${Math.round(noBand.player.y)}`);

    /* ----------------------- putkessa kulkeminen ----------------------- */
    /*
     * The warp used to be `p.y += shift` on one frame. It is a slide now, and
     * the three things that must be true of any such slide: it takes time, the
     * player cannot act or be acted upon while it runs, and it ends exactly
     * where the instant version ended.
     */
    {
      const s = mk({ type: 'shroom', level: 1 });
      put(s, 229, 26);
      /* Measured at the feet, not at `y`. Pressing down ducks a big player on
       * the way in, and `applySize` pins the bottom of the body and moves `y`;
       * the feet are the thing that is actually one band lower afterwards. */
      const before = s.player.y + s.player.h;
      const shift = 15 * 16;
      let frames = 0;
      let acted = 0;
      let hurtLanded = 0;
      i.held = blank(); i.held.down = true; i.pressed = blank();
      s.update(i);
      const started = !!s.player.transit;
      while (s.player.transit && frames < 200) {
        frames++;
        // Everything a player could try, every frame, plus an enemy's worth of
        // damage. None of it may reach him.
        i.held = blank();
        i.held.right = true; i.held.jump = true; i.held.run = true;
        i.pressed = blank(); i.pressed.jump = true; i.pressed.run = true;
        const px = s.player.x;
        if (s.player.hurt('enemy')) hurtLanded++;
        s.update(i);
        if (Math.abs(s.player.x - px) > 0.001 || s.player.vx !== 0 || s.player.vy !== 0) acted++;
      }
      // Measured where the slide left him and not a moment later: the arrival
      // is two tiles above the cave floor and gravity has it from here.
      // `controllable` is in here because taking the controls away is easy and
      // giving them back is the half that gets forgotten.
      expect('entering a pipe is a slide, and nothing reaches the player during it',
        started && frames > 20 && frames < 60 && acted === 0 && hurtLanded === 0
        && s.player.powerLevel === 1 && s.player.controllable === true
        && Math.abs((s.player.y + s.player.h) - (before + shift)) < 1,
        `${frames} framea, liikkui ${acted}, osumia ${hurtLanded}, `
        + `ohjattavissa ${s.player.controllable}, jalat `
        + `${Math.round(before)} -> ${Math.round(s.player.y + s.player.h)} `
        + `(odotus ${before + shift})`);
    }

    /*
     * A quicksave taken mid-slide. The state is a plain object on the player,
     * so `savestate.js` carries it with no help; the load has to come back
     * inside the pipe and finish the journey at the right place. Refusing the
     * save was the alternative and it is worse — a quicksave key that silently
     * does nothing for half a second is a bug report, not a policy.
     */
    {
      const s = mk({ type: 'shroom', level: 1 });
      put(s, 229, 26);
      const target = s.player.y + s.player.h + 15 * 16;      // feet, see above
      game.setScene(s);
      i.held = blank(); i.held.down = true; i.pressed = blank();
      for (let f = 0; f < 8; f++) s.update(i);
      const midway = !!s.player.transit && s.player.transit.phase === 'in';
      game.slot = 3;
      game.quickSave();
      game.quickLoad();
      const back = game.scene;
      const restored = !!(back.player.transit && back.player.transit.phase === 'in');
      const idle = mkInput();
      for (let f = 0; f < 90 && back.player.transit; f++) back.update(idle);
      expect('a quicksave taken inside a pipe loads back inside it and finishes',
        midway && back !== s && restored && !back.player.transit
        && !back.player.dying
        && Math.abs((back.player.y + back.player.h) - target) < 1,
        `tallennettu ${midway}, palautettu ${restored}, jalat `
        + `${Math.round(back.player.y + back.player.h)} (odotus ${Math.round(target)})`);
      game.slot = 1;
    }

    /*
     * The scene stops updating 140 frames after a death (DESIGN.md §6), so a
     * transit that could outlive that would leave a body parked inside a pipe.
     * It cannot: the clock stops, the collisions stand aside and `hurt`
     * refuses, so nothing in the level can kill a travelling player — and a
     * death forced from outside drops the transit rather than racing it.
     */
    {
      const s = mk({ type: null, level: 0 });
      put(s, 229, 26);
      s.time = 1;
      s.timeSub = 20;      // four frames from zero, and the trip lasts thirty
      i.held = blank(); i.held.down = true; i.pressed = blank();
      s.update(i);
      let ticked = 0;
      while (s.player.transit && ticked < 200) { s.update(i); ticked++; }
      const clockHeld = s.time === 1 && s.state === 'play';
      const forced = mk({ type: null, level: 0 });
      put(forced, 229, 26);
      forced.update(i);
      const running = !!forced.player.transit;
      forced.player.die('debug');
      expect('nothing can kill a player inside a pipe, and a forced death ends the trip',
        clockHeld && running && forced.player.transit === null && forced.player.dying,
        `kello ${s.time}, tila ${s.state}, kesken ${running}`);
    }
  }

  /* ------------------------------ kuplaloukku -------------------------- */
  {
    const E = await import('/src/entities/enemies.js');
    const { FartBall } = await import('/src/entities/items.js');

    /** A scene with one enemy `dx` px to the player's right, on the same floor. */
    const setup = (dx = 60, Ctor = E.Walker) => {
      reset({ type: 'flower', level: 2 });
      const s = new LevelScene(game, '1-1');
      game.pendingNode = WORLDS[0].nodes.find((n) => n.id === 'w1-1');
      game.setScene(s);
      s.entities = [];
      const p = s.player;
      const e = new Ctor(s, p.x + dx, p.y + p.h - 16);
      e.active = true;
      s.add(e);
      return { s, e, p };
    };
    const idle = mkInput();
    const run = (s, n) => { for (let f = 0; f < n; f++) s.update(idle); };

    {
      const { s, e, p } = setup(50);
      s.add(new FartBall(s, p.x + p.w, p.y + p.h * 0.45, 1));
      let f = 0;
      while (!e.bubbled && !e.dying && f < 90) { s.update(idle); f++; }
      expect('a fart ball bubbles an enemy instead of killing it',
        e.bubbled && !e.dying && !e.remove && game.state.score === 0,
        `bubbled ${e.bubbled}, dying ${e.dying}, pisteet ${game.state.score}`);
      expect('a bubbled enemy is harmless and a bigger target than the enemy in it',
        e.harmless === true && e.box.w > e.w && e.box.h > e.h,
        `${e.box.w}x${e.box.h} vs ${e.w}x${e.h}`);
    }

    {
      const { s, e, p } = setup(50);
      e.trap();
      p.power = { type: null, level: 0 };
      p.applySize();
      const before = game.state.score;
      const walk = mkInput();
      walk.held.right = true;
      let f = 0;
      while (!e.dying && f < 200) {
        walk.pressed.jump = f % 24 === 0;
        walk.held.jump = f % 24 < 12;
        s.update(walk);
        f++;
      }
      expect('touching a bubble kills the enemy and never the player',
        e.dying && !p.dying && p.power.level === 0, `${f} framea`);
      expect('popping a bubble pays at least what the old instant kill did',
        game.state.score - before >= e.score, `${game.state.score - before} vs ${e.score}`);
    }

    {
      const { s, e } = setup(96);
      e.trap();
      run(s, E.BUBBLE_FRAMES - 100);
      const quiet = e.bursting;
      run(s, 60);
      expect('a bubble warns before it bursts', quiet === false && e.bursting === true,
        `100 jäljellä: ${quiet}, 40 jäljellä: ${e.bursting}`);
    }

    {
      const { s, e } = setup(96);
      const was = e.speed;
      e.trap();
      run(s, E.BUBBLE_FRAMES + 2);
      const x0 = e.x;
      run(s, 60);
      expect('an untouched bubble expires and lets an angry enemy out',
        !e.bubbled && !e.dying && !e.remove && e.angry && Math.abs(e.x - x0) > 6,
        `angry ${e.angry}, ${Math.round(x0)} -> ${Math.round(e.x)}`);
      expect('the escaped enemy is faster than it went in',
        Math.abs(e.speed - was * E.ANGRY_SPEED) < 1e-9, `${was} -> ${e.speed}`);
    }

    {
      const want = {
        Walker: true, ShellGuy: true, Flyer: true, StinkCloud: true, CorkGuy: true,
        Plant: false, AngrySun: false, Boss: false, Moon: false, Shockwave: false,
      };
      const bad = [];
      for (const [name, yes] of Object.entries(want)) {
        const s = setup(60).s;
        const e = new E[name](s, 64, 100, 0);
        e.active = true;
        s.add(e);
        e.hitByProjectile(1);
        if (!!e.bubbled !== yes) bad.push(`${name}: ${e.bubbled}`);
      }
      expect('only the wandering enemies can be bubbled', bad.length === 0, bad.join(' '));
    }

    {
      const { s, e } = setup(96);
      e.trap();
      run(s, 30);
      const snap = JSON.parse(JSON.stringify(captureState(game)));
      const before = `${e.constructor.name}|${e.bubbleTimer}|${Math.round(e.x)}|${Math.round(e.y)}`;
      s.entities = [];
      restoreState(game, snap);
      const r = game.scene;
      const back = r.entities.find((x) => x.bubbled);
      const after = back
        ? `${back.constructor.name}|${back.bubbleTimer}|${Math.round(back.x)}|${Math.round(back.y)}`
        : 'poissa';
      expect('a save state round-trips a bubbled enemy', before === after, `${before} vs ${after}`);
      for (let f = 0; f < E.BUBBLE_FRAMES; f++) r.update(idle);
      expect('a restored bubble still runs out and turns angry',
        !!back && !back.bubbled && back.angry, back ? `angry ${back.angry}` : 'poissa');
    }
  }

  /* ---------------------------- peli poikki ----------------------------- */
  /* It used to say "continue" and end the run regardless. Both options must
   * exist, the selection must be visible, and continuing must NOT bank the
   * score — the board is for finished runs. */
  {
    const { GameOverScene } = await import('/src/scenes/cards.js');
    const scores = await import('/src/core/scores.js');
    const i = mkInput();

    reset();
    scores.clearScores();
    game.state.score = 50000;
    game.setScene(new GameOverScene(game));
    for (let f = 0; f < 32; f++) game.scene.update(mkInput());
    const start = game.scene.choice;
    i.pressed.right = true;
    game.scene.update(i);
    const moved = game.scene.choice;
    i.pressed = blank();
    i.pressed.left = true;
    game.scene.update(i);
    const back = game.scene.choice;
    expect('the game over screen offers two choices and moves between them',
      start === 0 && moved === 1 && back === 0, `${start}/${moved}/${back}`);

    // Continue: back to the map, nothing banked.
    i.pressed = blank();
    i.pressed.jump = true;
    game.scene.update(i);
    expect('continuing resumes the run and banks nothing',
      game.scene.constructor.name === 'WorldMapScene' && scores.loadScores().length === 0,
      `${game.scene.constructor.name}, ${scores.loadScores().length} riviä`);

    // Start over: the run is finished, so the score goes to the board.
    reset();
    game.state.score = 50000;
    game.setScene(new GameOverScene(game));
    for (let f = 0; f < 32; f++) game.scene.update(mkInput());
    const j = mkInput();
    j.pressed.right = true;
    game.scene.update(j);
    j.pressed = blank();
    j.pressed.jump = true;
    game.scene.update(j);
    expect('starting over ends the run and offers the score to the board',
      ['NameEntryScene', 'HighScoreScene'].includes(game.scene.constructor.name),
      game.scene.constructor.name);
    scores.clearScores();
  }

  /* ------------------------------ näppäimet ------------------------------ */
  /* No utility key may sit in the corner where the action keys live. `Backquote`
   * opened the developer overlay and on a Mac ISO board that is the key between
   * left Shift and Z — it was being hit mid-jump. `event.code` is a physical
   * position, but which one depends on ANSI vs ISO, and they disagree exactly
   * there. */
  {
    const src = await (await fetch('/src/core/input.js')).text();
    const map = src.slice(src.indexOf('const KEYMAP'), src.indexOf('const PADMAP'));
    const risky = ['Backquote', 'IntlBackslash', 'Backslash', 'IntlRo'];
    const found = risky.filter((k) => new RegExp(`^\\s*${k}:`, 'm').test(map));
    expect('no utility key sits next to the action keys',
      found.length === 0, found.length ? found.join(', ') : 'numerorivi vain');
  }

  /* ------------------------------- lentäjä ------------------------------- */
  /* Reported from play: stomp a flyer, it loses its wings, and the same jump
   * kills the walker underneath. `Flyer.stomp` appends the walker to the array
   * `collisions()` is iterating, so it is visited later in that same loop with
   * the same fall speed and stomped by a jump already spent. */
  {
    const { Flyer, Walker } = await import('/src/entities/enemies.js');
    reset({ type: 'shroom', level: 1 });
    const s = new LevelScene(game, '1-1');
    game.setScene(s);
    const i = mkInput();
    for (let f = 0; f < 6; f++) s.update(i);
    s.entities = s.entities.filter((e) => e.kind !== 'enemy');
    const p = s.player;

    const groundY = p.y + p.h;
    const fly = new Flyer(s, p.cx - 8, groundY - 16);
    fly.active = true;
    fly.alwaysActive = true;
    fly.vx = 0;
    fly.vy = 0;
    s.add(fly);

    // Overlapping and arriving downwards, which is what a stomp is.
    p.y = fly.y - p.h + 4;
    p.vy = 4;
    p.onGround = false;
    s.collisions();

    const walker = s.entities.find((e) => e instanceof Walker);
    expect('stomping a flyer leaves a walker instead of killing it outright',
      !!walker && !walker.dying && !walker.remove && walker.squash === 0,
      walker ? `dying ${walker.dying} squash ${walker.squash}` : 'ei kävelijää');

    /* …and the grace has to actually end, or it would be immortal. The player
     * is parked out of the way first: left where he is, he lands on the walker
     * the moment it becomes vulnerable and squashes it, which measures the
     * stomp rather than the grace. */
    p.y = 32;
    p.x = s.spawn.x + 240;
    p.vy = 0;
    for (let f = 0; f < 20; f++) s.update(i);
    expect('the new walker becomes vulnerable again a moment later',
      !!walker && walker.spawnGrace === 0 && !walker.bubbled,
      walker ? `grace ${walker.spawnGrace}, squash ${walker.squash}, `
        + `remove ${walker.remove}` : 'ei kävelijää');
  }

  /* --------------------------------- kuu -------------------------------- */
  /* Bouncing off the moon drops a prize. It must fall *out* of the moon, not
   * bud out of its top the way a question block does — a moon hanging in the
   * night sky is not a brick, and the player is above it at that moment. */
  {
    const { Moon } = await import('/src/entities/enemies.js');
    reset({ type: 'shroom', level: 1 });
    const s = new LevelScene(game, '2-N');
    game.setScene(s);
    const m = s.entities.find((e) => e instanceof Moon) || s.add(new Moon(s, 100, 60));
    m.active = true;
    const before = s.entities.filter((e) => e.kind === 'item').length;
    m.stomp();
    const item = s.entities.filter((e) => e.kind === 'item').at(-1);
    expect('the moon drops a prize below itself, already falling',
      s.entities.filter((e) => e.kind === 'item').length === before + 1
      && !!item && item.emerging === 0 && item.y > m.y,
      item ? `emerge ${item.emerging}, kuu ${Math.round(m.y)} esine ${Math.round(item.y)}` : 'ei esinettä');

    // And only once — a trampoline that keeps paying is not a prize.
    m.stomp();
    expect('the moon pays exactly once',
      s.entities.filter((e) => e.kind === 'item').length === before + 1 && m.used);
  }

  /* ---------------------------- jatkolaskuri ----------------------------- */
  /* Continues are unlimited and cost no points — the third time this project
   * has answered "should the game stop them?" with "no, the board says so".
   * That only holds if the count is real: taken on every continue, carried to
   * the entry, absent from rows that predate it, and persisted. */
  {
    const scores = await import('/src/core/scores.js');
    const { GameOverScene } = await import('/src/scenes/cards.js');

    reset();
    scores.clearScores();
    game.state.score = 50000;
    game.state.continues = 0;
    for (let n = 1; n <= 2; n++) {
      game.setScene(new GameOverScene(game));
      for (let f = 0; f < 32; f++) game.scene.update(mkInput());
      const i = mkInput();
      i.pressed.jump = true;
      game.scene.update(i);
    }
    expect('continuing counts the continue, resumes the run and banks nothing',
      game.state.continues === 2
      && game.scene.constructor.name === 'WorldMapScene'
      && scores.loadScores().length === 0,
      `jatkot ${game.state.continues}, ${game.scene.constructor.name},`
      + ` ${scores.loadScores().length} riviä`);

    reset();
    scores.clearScores();
    game.state.score = 77000;
    game.state.continues = 4;
    game.pendingNode = { id: 'w2-3', level: '2-3' };
    game.finishRun();
    const offered = game.scene.constructor.name === 'NameEntryScene'
      && game.scene.result.continues === 4;
    if (game.scene.submit) game.scene.submit();
    const row = scores.loadScores()[0];
    expect('the continue count reaches the high score entry',
      offered && row && row.continues === 4 && row.score === 77000,
      `${game.scene.constructor.name}, ${JSON.stringify(row)}`);

    scores.clearScores();
    scores.addScore({ name: 'NEW', score: 3000, world: 1, continues: 7 });
    localStorage.setItem('sfb3.scores.v1', JSON.stringify([
      { name: 'RAW', score: 9000, world: 1, at: 1 },
      ...JSON.parse(localStorage.getItem('sfb3.scores.v1')),
    ]));
    const [raw, fresh] = scores.loadScores();
    expect('a row saved without a continue count still loads, as zero',
      raw.continues === 0 && fresh.continues === 7, `${raw.continues}/${fresh.continues}`);

    // It has to survive a reload, or the board would forget by morning.
    reset();
    game.state.continues = 5;
    game.persist();
    const { Save } = await import('/src/core/save.js');
    expect('the continue count is written to the save', Save.load().continues === 5,
      `${Save.load().continues}`);

    reset();
    game.state.continues = 6;
    game.newGame();
    expect('starting a new game resets the continue count',
      game.state.continues === 0, `${game.state.continues}`);
    scores.clearScores();
  }

  /* ----------------------------- pierupallo ------------------------------ */
  /* Reported from play: the player outruns their own shot. They did — the ball
   * moved at 3.2 px/frame and the P-meter top speed is 3.5. A projectile you
   * can beat in a footrace is not a weapon, so this is an invariant now. */
  {
    const { FartBall } = await import('/src/entities/items.js');
    const { MAX_RUN } = await import('/src/entities/player.js');
    reset({ type: 'flower', level: 2 });
    const s = new LevelScene(game, '1-1');
    game.setScene(s);
    const ball = new FartBall(s, s.player.cx, s.player.cy, 1);
    // 3.5 is MAX_P, the P-meter cap, which is the fastest the player ever goes.
    expect('a fart ball outruns the fastest possible player',
      Math.abs(ball.vx) > 3.5 && Math.abs(ball.vx) > MAX_RUN,
      `pallo ${Math.abs(ball.vx)}, juoksu ${MAX_RUN}, P-katto 3.5`);
  }

  /* --------------------- pallo ei toimi ruudun ulkopuolella -------------- */
  /* Reported from play: the camera scrolls onto an enemy already sitting in a
   * bubble. At 5 px/frame with 200 frames of life the ball crossed three
   * screens, so it was trapping things the player never saw — the game playing
   * itself just out of sight. */
  {
    const { FartBall } = await import('/src/entities/items.js');
    reset({ type: 'flower', level: 2 });
    const s = new LevelScene(game, '1-1');
    game.setScene(s);
    const ball = s.add(new FartBall(s, s.cam.x + 300, 100, 1));
    ball.active = true;
    let frames = 0;
    while (!ball.remove && frames < 200) { ball.update(); frames++; }
    expect('a fart ball is spent when it leaves the screen',
      ball.remove && frames < 30 && ball.x < s.cam.x + 400,
      `${frames} framea, x ${Math.round(ball.x)}, kamera ${Math.round(s.cam.x)}`);
  }

  /* ------------------------------- kuori -------------------------------- */
  /* Reported from play: stomp a shell walker, walk into the shell, lose a power
   * level. The kick landed — and then the shell, having moved 3.4 px out of a
   * box it overlapped by more, was still inside the player next frame, where a
   * sliding shell hurts. It hurt the one who had just kicked it. */
  {
    const { ShellGuy } = await import('/src/entities/enemies.js');
    reset({ type: 'shroom', level: 2 });
    const s = new LevelScene(game, '1-1');
    game.setScene(s);
    const i = mkInput();
    for (let f = 0; f < 6; f++) s.update(i);
    s.entities = s.entities.filter((e) => e.kind !== 'enemy');
    const p = s.player;

    const e = new ShellGuy(s, p.x + p.w - 6, p.y + p.h - 24);
    e.active = true;
    e.alwaysActive = true;
    s.add(e);
    e.toShell();
    e.stompable = true;

    const before = p.powerLevel;
    let kicked = false;
    for (let f = 0; f < 30 && !p.dying; f++) {
      i.held = blank();
      i.held.right = true;
      i.pressed = blank();
      s.update(i);
      if (e.mode === 'sliding') kicked = true;
    }
    expect('kicking a shell you are standing in does not hurt you',
      kicked && p.powerLevel === before && !p.dying,
      `potkaistu ${kicked}, voima ${before}->${p.powerLevel}`);

    // But a shell that has been on its way for a while is still dangerous.
    e.kickGrace = 0;
    e.x = p.x + 2;
    p.invuln = 0;
    p.frozen = 0;
    const mid = p.powerLevel;
    s.collisions();
    expect('a shell already on its way still hurts', p.powerLevel < mid || p.dying,
      `voima ${mid}->${p.powerLevel}`);
  }

  /* --------------------------- piikit / spines -------------------------- */
  {
    const E = await import('/src/entities/enemies.js');
    const BOSS_LEVELS = ['1-F', '2-F', '3-F', '4-F', '5-F'];

    const arena = (power) => {
      reset(power);
      const s = new LevelScene(game, '1-1');
      game.setScene(s);
      const i = mkInput();
      for (let f = 0; f < 6; f++) s.update(i);
      s.entities = s.entities.filter((e) => e.kind !== 'enemy');
      return s;
    };
    const place = (s, Ctor) => {
      const groundY = s.player.y + s.player.h;
      const e = new Ctor(s, s.player.cx - 8, groundY - 16);
      e.active = true; e.alwaysActive = true; e.vx = 0;
      s.entities.push(e);
      return e;
    };
    const dropOn = (s, e) => {
      const p = s.player;
      p.x = e.cx - p.w / 2;
      p.y = e.y - p.h + 4;
      p.vy = 3; p.invuln = 0; p.frozen = 0;
      s.collisions();
    };

    expect("ENEMY_CHARS has the spiky enemy on 'x'",
      !!E.ENEMY_CHARS.x && E.ENEMY_CHARS.x(null, 0, 0) instanceof E.SpikeGuy);

    {
      const s = arena({ type: 'shroom', level: 1 });
      const e = place(s, E.SpikeGuy);
      dropOn(s, e);
      expect('stomping a spiky enemy hurts the player and leaves it standing',
        s.player.powerLevel === 0 && !e.remove && !e.dying, `power ${s.player.powerLevel}`);
    }
    {
      const s = arena({ type: 'leaf', level: 3 });
      const a = place(s, E.SpikeGuy);
      a.hitByProjectile(1);
      const bubbled = a.bubbled;
      a.popBubble(1);
      const b = place(arena({ type: 'leaf', level: 3 }), E.SpikeGuy);
      b.hitByTail(1);
      const c = place(arena({ type: 'leaf', level: 3 }), E.SpikeGuy);
      c.hitByShell(1);
      expect('a spiky enemy still dies to a fart ball, a tail whack and a shell',
        bubbled && a.dying && b.dying && c.dying);
    }
    {
      const s = arena({ type: 'shroom', level: 1 });
      const e = place(s, E.SpikeGuy);
      s.player.star = 300;
      dropOn(s, e);
      expect('the star beats the spines, as it beats every other inhabitant',
        e.dying && s.player.powerLevel === 1);
    }
    {
      const s = arena({ type: 'shroom', level: 1 });
      place(s, E.SpikeGuy);
      const snap = captureState(game);
      expect('a spiky enemy survives a save state — REGISTRY',
        !!snap && snap.level.entities.some((d) => d.t === 'SpikeGuy'));
    }

    {
      reset();
      const s = new LevelScene(game, '1-F');
      const trace = (b) => {
        const out = [];
        for (let f = 0; f < 1200; f++) { b.update(); out.push(b.spikePhase); }
        return out;
      };
      const a = trace(new E.Boss(s, 100, 100, 0));
      const b = trace(new E.Boss(s, 100, 100, 0));
      const seen = [];
      a.forEach((phase, f) => {
        if (!seen.length || seen[seen.length - 1].phase !== phase) seen.push({ phase, at: f });
      });
      const order = seen.slice(1).map((x) => x.phase);
      const cycle = ['open', 'telegraph', 'spiky'];
      const start = cycle.indexOf(order[0]);
      const ordered = order.every((phase, k) => phase === cycle[(start + k) % 3]);
      expect('the boss spine cycle is deterministic and always in the same order',
        ordered && a.join('') === b.join(''), order.slice(0, 4).join('>'));
    }

    {
      reset({ type: 'shroom', level: 1 });
      const s = new LevelScene(game, '1-F');
      game.setScene(s);
      const boss = s.entities.find((e) => e instanceof E.Boss);
      boss.spikePhase = 'spiky'; boss.spikeTimer = 100;
      const hp = boss.hp;
      dropOn(s, boss);
      const spikedHp = boss.hp;
      const spikedPower = s.player.powerLevel;
      boss.spikePhase = 'open'; boss.spikeTimer = 100; boss.invuln = 0;
      s.player.invuln = 0; s.player.frozen = 0;
      dropOn(s, boss);
      expect('stomping the spines hurts, stomping in the window damages',
        spikedHp === hp && spikedPower === 0 && boss.hp === hp - 1,
        `spiky hp ${hp}->${spikedHp}, open hp ${spikedHp}->${boss.hp}`);
    }

    {
      reset();
      const s = new LevelScene(game, '3-F');
      game.setScene(s);
      const boss = s.entities.find((e) => e instanceof E.Boss);
      boss.spikePhase = 'telegraph';
      boss.spikeTimer = 10;
      restoreState(game, JSON.parse(JSON.stringify(captureState(game))));
      const back = game.scene.entities.find((e) => e.constructor.name === 'Boss');
      expect('the boss keeps its place in the cycle across a save state',
        !!back && back.spikePhase === 'telegraph' && back.spikeTimer === 10,
        back ? `${back.spikePhase}/${back.spikeTimer}` : 'ei pomoa');
    }

    /* The promise the lead designer set himself: a powerless player can beat
     * every boss. Taken apart into the two things it needs — one window is long
     * enough to walk up and land a stomp at its tightest, and the clock holds
     * far more windows than the boss has health. */
    for (const id of BOSS_LEVELS) {
      reset();
      const s = new LevelScene(game, id);
      game.setScene(s);
      const boss = s.entities.find((e) => e instanceof E.Boss);
      const idle = mkInput();
      for (let f = 0; f < 90; f++) s.update(idle);

      boss.hp = 1;
      boss.spikePhase = 'open';
      const openWindow = boss.openFrames;
      boss.spikeTimer = openWindow;

      const p = s.player;
      p.y = boss.y + boss.h - p.h;
      p.x = boss.cx - 90;
      p.vx = 0; p.vy = 0;
      s.centerCamera();

      const i = mkInput();
      let hitAt = -1;
      for (let f = 0; f < openWindow && hitAt < 0; f++) {
        boss.jumpTimer = 999; boss.chargeTimer = 999; boss.charging = 0;
        const dx = boss.cx - p.cx;
        const adx = Math.abs(dx);
        i.held = blank();
        i.pressed = blank();
        if (!p.onGround) {
          const want = Math.sign(dx) * Math.min(2.2, adx / 8);
          if (p.vx < want - 0.15) i.held.right = true;
          else if (p.vx > want + 0.15) i.held.left = true;
          if (p.vy < 0) i.held.jump = true;
        } else if (adx > 40 + Math.abs(boss.vx) * 12) {
          i.held[dx > 0 ? 'right' : 'left'] = true;
          i.held.run = true;
        } else {
          i.pressed.jump = true;
          i.held.jump = true;
        }
        s.update(i);
        if (boss.hp < 1 || s.bossDefeated) hitAt = f;
      }
      expect(`${id}: a power-0 stomp fits inside the tightest window`,
        hitAt >= 0, `osui framella ${hitAt}/${openWindow}`);
    }

    {
      const rows = [];
      let worst = Infinity;
      for (const id of BOSS_LEVELS) {
        reset();
        const s = new LevelScene(game, id);
        const boss = s.entities.find((e) => e instanceof E.Boss);
        boss.hp = 1;
        const cycle = boss.openFrames + 48 + 132;
        const windows = Math.floor((s.time * 24) / cycle);
        rows.push(`${id} ${boss.maxHp}hp/${windows}`);
        worst = Math.min(worst, windows / boss.maxHp);
      }
      expect('the level clock holds far more windows than the boss has health',
        worst >= 4, `${rows.join(' ')} — huonoin ${worst.toFixed(1)} per osuma`);
    }

    /* ------------------------ jättiläisen kannet ------------------------ */
    /*
     * THE GIANT AND HIS DECKS (4-F, 5-F, `bossVariant: 3`).
     *
     * The giant grows half a size with every stomp, so his head climbs away
     * from the floor as the fight goes on, and by the end of it no power-0 jump
     * reaches. That was ruled design and not a bug on 9.8.2026: the arena's
     * upper decks are the answer, and the decks are where the last hits come
     * from. Which turns the whole promise — every boss is beatable at the
     * smallest size — into one sentence that had never been checked:
     *
     *     a power-0 player must be able to GET ONTO a deck, and from a deck the
     *     stomp must land at every size he reaches.
     *
     * It was not true. A simulated climb over the arena found exactly one
     * standable height, the floor: the decks were 112 px up against an 85 px
     * best jump, with nothing in between. The fight's answer was scenery, which
     * is precisely why players read it as scenery.
     *
     * These four checks are that sentence, in the order a player meets it —
     * the head leaves reach, the climb exists, the drop connects, and the
     * steps stay the player's rather than his.
     */
    {
      const GIANT_LEVELS = ['4-F', '5-F'];
      const FLOOR_Y = 208;

      /* The measurement itself, kept as a check so that a later change to the
       * physics or to his growth says so instead of silently making the decks
       * pointless — or, worse, silently necessary at a size they were never
       * checked for. `budget` is the measured jump, not a remembered one. */
      {
        const budget = await (await fetch('/tools/jump-budget.json')).json();
        const stand = budget.cases.find((c) => c.label === 'standing, held').height;
        const run = budget.cases.find((c) => c.label === 'running, held').height;
        reset();
        const s = new LevelScene(game, '4-F');
        const boss = s.entities.find((e) => e instanceof E.Boss);
        // The rise the n-th stomp asks for is the boss's height when it lands.
        const rises = [];
        let scale = 1;
        for (let hit = 0; hit < boss.maxHp; hit++) {
          rises.push(Math.round(boss.baseH * scale));
          scale = Math.min(3, scale + 0.5);
        }
        const fromFloor = rises.filter((r) => r <= run).length;
        expect('the giant grows out of power-0 floor reach before he is down',
          boss.giant && fromFloor < boss.maxHp,
          `nousut ${rises.join('/')} px, seisova hyppy ${stand}, juoksuhyppy ${run}`
          + ` — lattialta ${fromFloor}/${boss.maxHp} osumaa`);
      }

      /*
       * Every height a power-0 player can stand at, found by simulation rather
       * than by reading the grid: from each place they have reached, jump
       * standing and jump in both directions with and without a run-up, and see
       * where they land. It over-reports nothing — every spot in the set was
       * arrived at by actually flying there — and it is the only honest way to
       * ask "is that platform reachable", because the grid cannot tell a ledge
       * you can just make from one you just cannot.
       */
      const standableHeights = (id) => {
        reset();
        const s = new LevelScene(game, id);
        game.setScene(s);
        s.entities = s.entities.filter((e) => e.kind !== 'enemy');
        s.time = 9999;
        const p = s.player;
        const x0 = (s.grid[0].length - 48) * 16;
        const i = mkInput();

        const hop = (x, feet, dir, runup) => {
          p.x = x; p.y = feet - p.h; p.vx = 0; p.vy = 0;
          p.onGround = true; p.invuln = 999; p.frozen = 0;
          s.centerCamera();
          for (let f = 0; f < runup; f++) {
            i.held = blank(); i.pressed = blank();
            i.held[dir > 0 ? 'right' : 'left'] = true; i.held.run = true;
            s.update(i);
            if (!p.onGround) break;
          }
          i.held = blank(); i.pressed = blank();
          if (dir) { i.held[dir > 0 ? 'right' : 'left'] = true; i.held.run = true; }
          i.pressed.jump = true; i.held.jump = true;
          s.update(i);
          for (let f = 0; f < 180 && !p.onGround; f++) {
            i.pressed = blank();
            i.held.jump = true;
            s.update(i);
          }
          return { x: p.x, feet: p.y + p.h, ok: p.onGround && !p.dying };
        };

        const seen = new Set();
        const spots = [];
        const push = (x, feet) => {
          if (x < x0 + 8 || x > x0 + 47 * 16) return;
          const k = `${Math.round(x / 8)},${Math.round(feet)}`;
          if (seen.has(k)) return;
          seen.add(k);
          spots.push({ x, feet });
        };
        for (let c = 2; c < 46; c += 2) push(x0 + c * 16, FLOOR_Y);

        const heights = new Set();
        for (let n = 0; n < spots.length && n < 400; n++) {
          heights.add(Math.round(spots[n].feet));
          for (const [dir, runup] of [[0, 0], [-1, 0], [1, 0], [-1, 45], [1, 45]]) {
            const r = hop(spots[n].x, spots[n].feet, dir, runup);
            if (r.ok) push(r.x, r.feet);
          }
        }
        return { heights: [...heights].sort((a, b) => a - b), x0 };
      };

      /* Where the decks are is read out of the level rather than written down,
       * so moving them moves the test with them. */
      const deckRows = (s) => {
        const out = new Set();
        const from = s.grid[0].length - 48;
        for (let y = 0; y < s.grid.length; y++) {
          for (let x = from; x < s.grid[y].length; x++) {
            if (s.grid[y][x] === '-') out.add(y);
          }
        }
        return [...out].sort((a, b) => a - b);
      };

      /* THE CENTRE OF ALL THIS. Red before green (DESIGN.md §7): against the
       * arena as it stood this reports one reachable height, 208, the floor. */
      for (const id of GIANT_LEVELS) {
        reset();
        const probe = new LevelScene(game, id);
        const decks = deckRows(probe);
        const { heights } = standableHeights(id);
        const reached = decks.filter((row) => heights.includes(row * 16));
        expect(`${id}: a power-0 player can climb onto the giant's decks`,
          decks.length > 0 && reached.length === decks.length,
          `kannet riveillä ${decks.join('/')}, seisottavat korkeudet ${heights.join('/')}`);
      }

      /* And from up there the stomp has to connect at every size he reaches,
       * including the one he is at when the fight ends. Dropping off a deck is
       * the whole move, so that is what is simulated: stand on the plank, press
       * down, fall. */
      for (const id of GIANT_LEVELS) {
        const misses = [];
        for (const scale of [1, 1.5, 2, 2.5, 3]) {
          reset();
          const s = new LevelScene(game, id);
          game.setScene(s);
          const boss = s.entities.find((e) => e instanceof E.Boss);
          const p = s.player;
          const x0 = (s.grid[0].length - 48) * 16;
          const deck = deckRows(s)[0];
          // The left deck, and the boss parked under the middle of it.
          let col = 0;
          for (let x = 0; x < 48; x++) if (s.grid[deck][x + (s.grid[0].length - 48)] === '-') { col = x + 2; break; }
          boss.scale = scale; boss.targetScale = scale; boss.applyScale();
          boss.x = x0 + col * 16 - boss.w / 2; boss.y = FLOOR_Y - boss.h;
          boss.vx = 0; boss.vy = 0; boss.invuln = 0;
          p.x = x0 + col * 16 - p.w / 2; p.y = deck * 16 - p.h;
          p.vx = 0; p.vy = 0; p.invuln = 0; p.frozen = 0;
          s.centerCamera();
          const hp0 = boss.hp;
          const i = mkInput();
          let hurt = false;
          for (let f = 0; f < 240 && boss.hp === hp0; f++) {
            i.held = blank(); i.pressed = blank();
            // Hold him still and open: this asks about geometry, not timing —
            // the window is already tested above, for every boss in the game.
            boss.jumpTimer = 999; boss.chargeTimer = 999; boss.charging = 0;
            boss.spikePhase = 'open'; boss.spikeTimer = 999;
            boss.vx = 0; boss.speed = 0;
            i.held.down = true;
            s.update(i);
            if (p.dying) hurt = true;
          }
          if (boss.hp === hp0 || hurt) misses.push(`${scale}x`);
        }
        expect(`${id}: a power-0 stomp off the deck lands on the giant at every size`,
          misses.length === 0, misses.length ? `ei osunut: ${misses.join(',')}` : 'kaikki koot');
      }

      /* The steps are at row 9 and not row 10 for one measured reason: his own
       * jump reaches y≈161 and a plank at row 10 tops out at 160, so he would
       * land on the player's staircase and stand there. Sixteen pixels is the
       * whole margin, so it gets a check rather than a comment. */
      for (const id of GIANT_LEVELS) {
        reset();
        const s = new LevelScene(game, id);
        game.setScene(s);
        const boss = s.entities.find((e) => e instanceof E.Boss);
        const p = s.player;
        boss.scale = 3; boss.targetScale = 3; boss.applyScale();
        boss.y = FLOOR_Y - boss.h;
        const i = mkInput();
        let top = Infinity;
        for (let f = 0; f < 900; f++) {
          p.invuln = 999;
          s.update(i);
          top = Math.min(top, boss.y + boss.h);
        }
        // The lowest plank in the arena is the step, and it is the only one he
        // could ever reach — so it is the only one worth measuring against.
        const step = Math.max(...deckRows(s)) * 16;
        expect(`${id}: the giant's own jump cannot put him on the player's steps`,
          top > step, `jalat ylimmillään y=${Math.round(top)}, alin lava y=${step}`);
      }

      /* The signal. A growth that changed nothing on screen would be a sound in
       * a noisy fight; this is the picture half (DESIGN.md §8), and it has to
       * come off the decks rather than off him or it points at the wrong thing. */
      {
        reset();
        const s = new LevelScene(game, '4-F');
        game.setScene(s);
        const boss = s.entities.find((e) => e instanceof E.Boss);
        const p = s.player;
        const deck = deckRows(s)[0];
        s.entities = s.entities.filter((e) => e.kind !== 'effect');
        boss.spikePhase = 'open'; boss.spikeTimer = 999; boss.invuln = 0;
        // He stays where he spawns — between the two decks, which is the point.
        const before = boss.targetScale;
        boss.stomp();
        const armed = boss.deckDust > 0;
        const i = mkInput();
        for (let f = 0; f < 12; f++) { p.invuln = 999; s.update(i); }
        const dust = s.entities.filter((e) => e.constructor.name === 'Puff'
          && e.y < (deck + 3) * 16);
        expect('growing shakes dust off the decks, not off the giant',
          boss.targetScale > before && armed && dust.length > 0,
          `pöly ${dust.length} hiukkasta kansien tasolla, koko ${before}->${boss.targetScale}`);
      }

      /* `boss_arena_big` is defined twice — the live one here, and a dead copy
       * left behind in `factory.js` where it used to live. `chunks.js` spreads
       * the fortress last, so the fortress copy wins. Shadowing is a trap when
       * it is silent, so this is the thing that stops being silent: edit the
       * factory copy and nothing happens, but the gate says why. */
      {
        const { CHUNKS } = await import('/src/data/chunks.js');
        const { FORTRESS_CHUNKS } = await import('/src/data/chunks/fortress.js');
        expect("the giant's arena is the fortress copy, not the dead one in factory.js",
          !!FORTRESS_CHUNKS.boss_arena_big
          && CHUNKS.boss_arena_big === FORTRESS_CHUNKS.boss_arena_big);
      }
    }
  }

  /* ------------------- murtava tehostus ja papuparoonit ------------------ */
  /*
   * The breaking power-up (PAUKKUPAPU) and its only source (PAPUPAROONI).
   *
   * Two halves of one feature, so they are tested together — and the thing
   * that ties them is the rule that has to be *proved* rather than intended:
   * nothing else in the game hands this power-up out. A second source would
   * not break anything visibly; it would only make the fight pointless, which
   * is exactly the kind of decay no crash ever reports.
   */
  {
    const P = await import('/src/entities/player.js');
    const E = await import('/src/entities/enemies.js');
    const { T } = await import('/src/gfx/tiles.js');

    /**
     * A flat corridor with a one-column wall of `ch` six tiles ahead, charged
     * into at a run. Everything about the corridor is written into the grid
     * rather than found in a level, so the test says what it means: the wall is
     * the only thing between the player and open ground.
     */
    const chargeInto = (power, ch, { cork = false, secret = false } = {}) => {
      reset(power);
      const s = new LevelScene(game, '1-1');
      game.setScene(s);
      const i = mkInput();
      for (let f = 0; f < 6; f++) s.update(i);
      const p = s.player;
      const foot = Math.floor((p.y + p.h) / 16);
      const x0 = Math.floor(p.x / 16);
      /*
       * A brick that is hiding something behaves like stone, so which columns
       * hide something is not a free choice — `brickSecret` is a pure function
       * of the tile's position. Pick the first column that is the case being
       * asked about, then build the corridor out to it. Which row is asked
       * about differs: a wall that must break has to be clear all the way up
       * (the body is more than one tile tall), a wall that must hold only has
       * to hide something in the row every size meets.
       */
      let wallX = -1;
      for (let dx = 6; dx <= 40 && wallX < 0; dx++) {
        const hides = secret
          ? !!s.brickSecret(x0 + dx, foot - 1)
          : [foot - 3, foot - 2, foot - 1].some((ty) => !!s.brickSecret(x0 + dx, ty));
        if (hides === secret) wallX = x0 + dx;
      }
      for (let tx = x0; tx <= wallX + 3; tx++) {
        for (let ty = foot - 5; ty < foot; ty++) s.setTile(tx, ty, T.EMPTY);
        s.setTile(tx, foot, T.GROUND);
        s.setTile(tx, foot + 1, T.GROUND);
      }
      for (let ty = foot - 3; ty < foot; ty++) s.setTile(wallX, ty, ch);
      if (cork) p.cork(400);
      for (let f = 0; f < 340; f++) {
        i.held = blank();
        i.held.right = true;
        i.held.run = true;
        i.pressed = blank();
        s.update(i);
      }
      return {
        found: wallX >= 0,
        gone: s.tileAt(wallX, foot - 1) === T.EMPTY,
        past: p.x > wallX * 16,
        player: p,
      };
    };

    expect('murtava tehostus on neljäs voimatyyppi ja sillä on nimi',
      P.POWER_TYPES.includes('pop') && P.POWER_NAMES.pop === 'PAUKKUPAPU',
      `${P.POWER_TYPES.join(',')} / ${P.POWER_NAMES.pop}`);

    {
      const withIt = chargeInto({ type: 'pop', level: 1 }, T.BRICK);
      expect('paukkupavulla tiili hajoaa sivusta juosten — pienimmälläkin koolla',
        withIt.gone && withIt.past, `hajosi ${withIt.gone}, pääsi läpi ${withIt.past}`);
    }
    {
      // The strongest player in the game without the power-up. Side-breaking is
      // the power-up's own doing, not a perk of being big — otherwise pea soup
      // is a second source and the fight stops being the only one.
      const without = chargeInto({ type: 'leaf', level: 5 }, T.BRICK);
      expect('ilman paukkupapua tiili pysyy vaikka voimataso olisi 5',
        !without.gone && !without.past, `hajosi ${without.gone}, pääsi läpi ${without.past}`);
    }
    {
      const corked = chargeInto({ type: 'pop', level: 3 }, T.BRICK, { cork: true });
      expect('ummetus tukkii myös murtamisen', !corked.gone && !corked.past,
        `hajosi ${corked.gone}`);
    }
    {
      const hiding = chargeInto({ type: 'pop', level: 3 }, T.BRICK, { secret: true });
      expect('salaisuutta kätkevä tiili kestää murtamisen, kuten kuorenkin',
        hiding.found && !hiding.gone, `löytyi ${hiding.found}, hajosi ${hiding.gone}`);
    }
    {
      // The whole table in one assertion: exactly one character gives way.
      const kept = [];
      for (const ch of [T.QCOIN, T.QPOWER, T.QSTAR, T.HARD, T.GROUND, T.CRUMBLE,
        T.SWITCH, T.USED, T.NOTE]) {
        if (chargeInto({ type: 'pop', level: 3 }, ch).gone) kept.push(ch);
      }
      expect('murtava tehostus rikkoo vain tiilen, ei mitään muuta ruutua',
        kept.length === 0, kept.length ? `hajosi myös: ${kept.join(' ')}` : 'vain B');
    }
    {
      // Losing it costs rewards and nothing else: the ability goes with the
      // type, and the type is the first thing a hit takes.
      reset({ type: 'pop', level: 1 });
      const s = new LevelScene(game, '1-1');
      const p = s.player;
      const before = p.breaker;
      p.hurt();
      expect('tehostuksen menettäminen vie murtamisen, ei kulkua',
        before === true && p.breaker === false && !p.dying,
        `ennen ${before}, jälkeen ${p.breaker}`);
    }

    /* ---------------------------- papuparooni --------------------------- */

    expect("ENEMY_CHARS has the mini-boss on 'P'",
      !!E.ENEMY_CHARS.P && E.ENEMY_CHARS.P(null, 0, 0) instanceof E.BeanBaron);

    {
      const sprites = await import('/src/gfx/sprites.js');
      expect('paroonilla, pommilla ja paukkupavulla on oma piirroksensa',
        typeof sprites.drawBeanBaron === 'function'
        && typeof sprites.drawBeanBomb === 'function');
    }

    {
      // DESIGN.md 6: a spawn character that is also a tile character is a level
      // that silently loses either the enemy or the tile.
      const clash = Object.keys(E.ENEMY_CHARS).filter((ch) => Object.values(T).includes(ch));
      expect('yksikään vihollismerkki ei törmää ruutumerkkiin', clash.length === 0,
        clash.join(' ') || `${Object.keys(E.ENEMY_CHARS).length} merkkiä`);
    }

    /* The arena and everything in it. Grouped inside one try so that a missing
     * level or a missing class reports as a failed check rather than as a
     * thrown page error — the difference matters when the suite is being used
     * red-first and half of this is not written yet. */
    try {
    {
      reset();
      const s = new LevelScene(game, '2-M');
      const barons = s.entities.filter((e) => e instanceof E.BeanBaron);
      expect('2-M on aavikon minipomokenttä: kaksi paroonia ja lippu, ei pomo-ovea',
        barons.length === 2 && !!s.goal && !s.def.boss,
        `${barons.length} paroonia, maali ${!!s.goal}`);
    }

    {
      reset();
      const s = new LevelScene(game, '2-M');
      game.setScene(s);
      const barons = s.entities.filter((e) => e instanceof E.BeanBaron);
      const drops = () => s.entities.filter((e) => e.kind === 'item' && e.itemKind === 'pop').length;
      barons[0].hp = 1;
      barons[0].stomp();
      const afterFirst = drops();
      barons[1].hp = 1;
      barons[1].stomp();
      const afterSecond = drops();
      expect('vasta viimeinen parooni pudottaa murtavan tehostuksen',
        afterFirst === 0 && afterSecond === 1, `${afterFirst} -> ${afterSecond}`);
    }

    {
      // The fight is winnable at the smallest size, like every boss in the game.
      reset();
      const s = new LevelScene(game, '2-M');
      game.setScene(s);
      const b = s.entities.find((e) => e instanceof E.BeanBaron);
      const hp = b.hp;
      const p = s.player;
      p.x = b.cx - p.w / 2;
      p.y = b.y - p.h + 4;
      p.vy = 3; p.invuln = 0; p.frozen = 0;
      s.collisions();
      expect('voimatason 0 tallaus vahingoittaa paroonia', b.hp === hp - 1 && !p.dying,
        `hp ${hp} -> ${b.hp}`);
    }

    {
      // And losable: the thing it throws is a hazard, and a hazard hits.
      reset({ type: 'shroom', level: 1 });
      const s = new LevelScene(game, '2-M');
      game.setScene(s);
      const b = s.entities.find((e) => e instanceof E.BeanBaron);
      const bomb = b.throwBomb();
      const p = s.player;
      p.x = bomb.cx - p.w / 2;
      p.y = bomb.cy - p.h / 2;
      p.invuln = 0; p.frozen = 0;
      s.collisions();
      expect('papupommi vahingoittaa: taistelun voi hävitä', p.powerLevel === 0,
        `voima 1 -> ${p.powerLevel}`);
    }

    {
      /* Left alone in its own arena for twenty seconds with the player in
       * range, a baron has to do the two things the fight is made of: throw,
       * and stay where it was put. The second one is not decoration — a baron
       * that walks off carries the game's only paukkupapu away with it, and
       * nothing would report that but a player who never found the reward. */
      reset({ type: 'shroom', level: 3 });
      const s = new LevelScene(game, '2-M');
      game.setScene(s);
      const barons = s.entities.filter((e) => e instanceof E.BeanBaron);
      const p = s.player;
      p.x = (barons[0].cx + barons[1].cx) / 2;
      p.y = 12 * 16 - p.h;
      s.centerCamera();
      const thrown = new Set();
      let strayed = 0;
      /* Sampled every frame, not once at the end. A baron hops, so `onGround`
       * at one arbitrary instant says only which phase of the hop the loop
       * stopped in — this assertion passed and failed on the same simulation
       * depending on where it landed. What the fight actually promises is that
       * it never *falls off*, and that is a property of every frame. */
      let sank = 0;
      const idle = mkInput();
      for (let f = 0; f < 1200; f++) {
        p.invuln = 20;                       // this is about them, not about him
        s.update(idle);
        for (const e of s.entities) if (e instanceof E.BeanBomb) thrown.add(e.id);
        for (const b of barons) {
          strayed = Math.max(strayed, Math.abs(b.x - b.homeX));
          sank = Math.max(sank, b.y + b.h);
        }
      }
      const onPlinth = sank <= 11 * 16 + 1;
      expect('paroonit heittelevät ja pysyvät jalustoillaan',
        thrown.size >= 4 && strayed <= 32 && onPlinth,
        `${thrown.size} pommia, poikkeama ${Math.round(strayed)} px, jalustalla ${onPlinth}`);
    }

    {
      reset();
      const s = new LevelScene(game, '2-M');
      game.setScene(s);
      const b = s.entities.find((e) => e instanceof E.BeanBaron);
      b.throwBomb();
      const snap = captureState(game);
      const kinds = snap ? snap.level.entities.map((d) => d.t) : [];
      expect('parooni ja sen pommi selviävät tilatallennuksesta — REGISTRY',
        kinds.includes('BeanBaron') && kinds.includes('BeanBomb'), kinds.join(' '));
    }
    } catch (err) {
      expect('papuparoonien areena rakentuu ja taistelu toimii', false, err.message);
    }

    {
      // The rule from the roadmap, made executable: the fight is the ONLY
      // source. Every question block, every secret brick and the moon all draw
      // from rollPowerup, so one assertion covers all three.
      reset({ type: 'shroom', level: 2 });
      const s = new LevelScene(game, '1-1');
      const seen = new Set();
      for (let i = 0; i < 2000; i++) seen.add(s.rollPowerup(s.player));
      expect('mikään lohko ei arvo murtavaa tehostusta', !seen.has('pop'),
        [...seen].join(' '));
    }
  }

  /* ---------------------------- koon vaihtuminen ------------------------ */
  /* Growing and shrinking used to be a sprite swapped while nobody was looking.
   * The freeze frames were already there; this is what they are for. The
   * hitbox must NOT flicker with the picture — only the picture. */
  {
    reset({ type: 'shroom', level: 1 });
    const s = new LevelScene(game, '1-1');
    game.setScene(s);
    const i = mkInput();
    for (let f = 0; f < 6; f++) s.update(i);
    const p = s.player;

    p.collect('shroom');
    const grew = p.morphTimer > 0 && p.morphFrom === 1 && p.powerLevel === 2;
    const boxAtOnce = p.h === PLAYER_SIZES[2].h;
    let flickered = false;
    const seen = new Set();
    for (let f = 0; f < 20; f++) {
      seen.add(p.morphTimer > 0 && Math.floor(p.tick / 3) % 2 ? p.morphFrom : p.powerLevel);
      if (p.h !== PLAYER_SIZES[2].h) flickered = true;
      s.update(i);
    }
    const ran = p.morphTimer === 0;

    p.invuln = 0;
    p.frozen = 0;
    p.hurt();
    const shrank = p.morphTimer > 0 && p.morphFrom === 2 && p.powerLevel === 1;
    expect('growing and shrinking flicker between the two bodies',
      grew && shrank && boxAtOnce && !flickered && ran && seen.size === 2,
      `kasvu ${grew}, kutistus ${shrank}, laatikko vakaa ${!flickered}, `
      + `kokoja ${seen.size}`);
  }

  /* ------------------------------ ilmajarru ----------------------------- */
  /*
   * Reported from play: "there is a bit of inertia when you jump and land, you
   * still move sideways, and it is really hard to react so that you could
   * avoid the enemy you are heading towards."
   *
   * Measured (tools/measure-braking.mjs): almost none of that distance is
   * spent on the ground. At the run cap a jump carries 155 px through the air
   * and only 24 px after landing — so the reaction happens, or fails to
   * happen, in mid-air.
   *
   * The cause was one word. `skidding` required `onGround`, so turning round
   * in the air braked at the acceleration rate (0.0547) instead of the skid
   * rate (0.125). The SMB3 disassembly gates two things on `Player_InAir` —
   * plain friction with no direction held, and the bleed back down to the
   * speed cap — and gates the skid rate on neither. Both of those gates are
   * still here; this one never should have been.
   */
  {
    const flat = (power) => {
      reset(power);
      const s = new LevelScene(game, '1-1');
      for (let y = 0; y < s.h - 2; y++) s.grid[y] = s.grid[y].map(() => ' ');
      for (let y = s.h - 2; y < s.h; y++) s.grid[y] = s.grid[y].map(() => '#');
      s.entities = s.entities.filter((e) => e.kind === 'player');
      s.goal = null;
      s.time = 400;
      return s;
    };
    /** Runs up to the cap, jumps, then holds the other way for the whole arc. */
    const turnRoundInAir = (power) => {
      const s = flat(power);
      const p = s.player;
      const i = mkInput();
      for (let f = 0; f < 40; f++) { s.update(i); i.pressed = blank(); }
      i.held.right = true; i.held.run = true;
      for (let f = 0; f < 90; f++) { s.update(i); i.pressed = blank(); }
      const v0 = p.vx;
      i.pressed.jump = true; i.held.jump = true;
      s.update(i); i.pressed = blank();
      i.held.right = false; i.held.left = true; i.held.jump = false;
      let frames = 0;
      while (!p.onGround && p.vx > 0 && frames < 200) {
        s.update(i); i.pressed = blank(); frames++;
      }
      return { v0, frames, stopped: p.vx <= 0 };
    };

    const air = turnRoundInAir({ type: 'shroom', level: 1 });
    // 2.5 / 0.125 = 20 frames at the skid rate; 46 at the acceleration rate.
    expect('turning round in mid-air brakes at the skid rate, not the walk rate',
      air.stopped && air.frames <= 24,
      `${air.v0.toFixed(2)} -> 0 in ${air.frames}f, pysähtyi ${air.stopped}`);

    /*
     * And the two gates that *are* faithful must stay. Letting go of the pad
     * in mid-air keeps every pixel per frame of speed — that is what makes a
     * jump commit — and it is the same rule for every body size.
     */
    const coastInAir = (power) => {
      const s = flat(power);
      const p = s.player;
      const i = mkInput();
      for (let f = 0; f < 40; f++) { s.update(i); i.pressed = blank(); }
      i.held.right = true; i.held.run = true;
      for (let f = 0; f < 90; f++) { s.update(i); i.pressed = blank(); }
      const v0 = p.vx;
      i.pressed.jump = true; i.held.jump = true;
      s.update(i); i.pressed = blank();
      i.held.right = false; i.held.run = false; i.held.jump = false;
      for (let f = 0; f < 20; f++) { s.update(i); i.pressed = blank(); }
      return { v0, v1: p.vx, air: !p.onGround };
    };
    const coast = coastInAir({ type: 'shroom', level: 1 });
    expect('letting go in mid-air still costs nothing — no air friction',
      coast.air && Math.abs(coast.v1 - coast.v0) < 0.001,
      `${coast.v0.toFixed(2)} -> ${coast.v1.toFixed(2)}`);
  }

  /* ------------------------------ katto --------------------------------- */
  /* Reported from play: in 1-F you could jump up where the opening screen has
   * no ceiling, land on the roof, and run the level along the top — past the
   * boss, unable to come down and unable to win. The fix is that the world has
   * a lid, so this asserts the lid rather than the one level that lacked it. */
  {
    reset({ type: 'shroom', level: 2 });
    const s = new LevelScene(game, '1-F');
    game.setScene(s);
    s.entities = s.entities.filter((e) => e.kind !== 'enemy');
    expect('the top of the world is solid', s.solidAt(4, -1) && s.solidAt(4, -3));

    // Jump for the sky from the open start area and stay inside the level.
    const i = mkInput();
    let highest = s.player.y;
    for (let f = 0; f < 240; f++) {
      i.held = blank();
      i.held.right = f > 60;
      i.held.run = true;
      i.held.jump = f % 30 < 18;
      i.pressed = blank();
      i.pressed.jump = f % 30 === 0;
      s.update(i);
      highest = Math.min(highest, s.player.y);
    }
    expect('the player cannot get on top of the ceiling and run the roof',
      highest >= 0 && s.player.y >= 0, `ylin y ${Math.round(highest)}`);
  }

  /* --------------------------- debug-warp -------------------------------- */
  /* A testing tool, and the two things that make it safe to have one: it does
   * nothing without the developer overlay up (an invisible warp is a cheat code
   * somebody finds by accident), and a run that used it cannot reach the board
   * at all. There is an honest star for "rewound"; there is none for "skipped
   * four worlds". */
  {
    const scores = await import('/src/core/scores.js');
    reset();
    game.debug = false;
    const world0 = game.state.world;
    game.debugWarp();
    const blocked = game.state.world === world0 && !game.state.debugWarped;

    game.debug = true;
    game.debugWarp();
    const moved = game.state.world !== world0 && game.state.debugWarped === true;
    expect('the debug warp needs the overlay and marks the run',
      blocked && moved, `ilman debugia ${blocked}, debugilla ${moved}`);

    scores.clearScores();
    game.state.score = 999999;
    game.finishRun();
    expect('a warped run never reaches the high score table',
      scores.loadScores().length === 0
      && game.scene.constructor.name === 'HighScoreScene',
      `${scores.loadScores().length} riviä, ${game.scene.constructor.name}`);
    game.debug = false;
    game.state.debugWarped = false;
    scores.clearScores();
  }

  /* ----------------------- tauko ei jää jumiin --------------------------- */
  /* A pause is something that happened to a level, not a mode the machine is
   * in. Warping out from under the pause screen used to leave `paused` true on
   * the world map — and nothing there can clear it, because the pause key only
   * answers inside a LevelScene. The map never updated, Enter did nothing, and
   * the only way out was a reload.
   *
   * The warp is only the shortest way to reproduce it. Any scene change made
   * while paused does the same, which is why the fix is in `setScene` and this
   * test checks the state of the game rather than the state of the warp. */
  {
    reset();
    game.debug = true;
    game.setScene(new LevelScene(game, '1-1'));
    game.paused = true;
    game.debugWarp();
    const cleared = game.paused === false;
    const onMap = game.scene.constructor.name === 'WorldMapScene';

    /* Asserted on the flag and not by running a frame: `game.step()` drives the
     * whole loop, including the attract-mode idle counter, and a test that
     * borrows it hands the next three tests a title screen that has already
     * been waiting. Found the hard way — it failed the demo tests, not this
     * one. `paused` on a scene with no pause key *is* the stuck state, so the
     * flag is the thing worth asserting. */
    expect('warping out from under the pause screen leaves the game running',
      cleared && onMap,
      `paused ${game.paused}, ${game.scene.constructor.name}`);

    /* And the same for the ordinary way out of a level, which shares the fix. */
    reset();
    game.setScene(new LevelScene(game, '1-1'));
    game.paused = true;
    game.toWorldMap();
    expect('any scene change clears the pause, not just the warp',
      game.paused === false, `paused ${game.paused}`);

    game.debug = false;
    game.state.debugWarped = false;
  }

  /* --------------------------- salaisuuslaskuri -------------------------- */
  {
    reset();
    const tall = new LevelScene(game, '1-2');
    const c = game.levelSecrets(tall);
    const plain = game.levelSecrets(new LevelScene(game, '1-1'));
    expect('the debug overlay counts the secrets in the level',
      c.vine === 1 && c.warp > 0 && c.bands === 1
      && plain.vine === 0 && plain.warp === 0 && plain.bands === 0,
      `1-2: varsi ${c.vine} putki ${c.warp} kaistat ${c.bands}`
      + ` / 1-1: varsi ${plain.vine} putki ${plain.warp}`);
    /* Counted across the whole game rather than one level: there are only 186
     * bricks in all of it, and the first version of this feature hid about five
     * surprises in the lot — a mechanic nobody would ever meet. */
    let bricks = 0;
    let secrets = 0;
    for (const id of levelIds()) {
      const sc = new LevelScene(game, id);
      for (let ty = 0; ty < sc.h; ty++) {
        for (let tx = 0; tx < sc.w; tx++) {
          if (sc.rawTileAt(tx, ty) !== 'B') continue;
          bricks++;
          if (sc.brickSecret(tx, ty)) secrets++;
        }
      }
    }
    const share = secrets / Math.max(1, bricks);
    expect('secret bricks are common enough to meet and rare enough to matter',
      secrets >= 12 && share > 0.08 && share < 0.35,
      `${secrets}/${bricks} tiiltä = ${Math.round(share * 100)} %`);
  }

  /* ---------------- salaisuudet kartalla: kertoo että, ei missä ----------- */
  /*
   * Four things have to hold at once, and the last two are the design:
   *
   *   1. the count is right, and right WITHOUT loading the level — the map has
   *      to draw it for every node at once;
   *   2. finding one moves it, and the move survives a save;
   *   3. a save written before any of this existed still loads, and reads as
   *      nothing found, which is the truth;
   *   4. the map shows HOW MANY and never WHICH. That one is tested by pixels,
   *      because it is the only way to prove a negative: two saves that found
   *      different secrets but the same number of them must draw the same map.
   */
  {
    reset();
    const {
      secretKeys, secretTotal, secretTally, foundKeys, noteSecret, brickHides, SKY, CAVE,
    } = await import('/src/core/secrets.js');
    const { WorldMapScene } = await import('/src/scenes/worldmap.js');
    const { Save, DEFAULT_SAVE } = await import('/src/core/save.js');
    const { getLevel } = await import('/src/data/levels.js');

    /* 1a. A level with a known secret, and one with none. 1-2 is the tall level
     * of world 1: a room above, a cave below and three loaded bricks. 1-1 is
     * the opening level and hides nothing at all. */
    const tall = secretKeys('1-2');
    expect('salaisuuslaskenta osaa kentän jossa on salaisuuksia ja kentän jossa ei ole',
      secretTotal('1-2') === 5 && tall.includes(SKY) && tall.includes(CAVE)
      && secretTotal('1-1') === 0,
      `1-2: ${tall.join(' ')} / 1-1: ${secretTotal('1-1')}`);

    /* 1b. Counted from level data alone, so it must agree with the engine's own
     * reading of the loaded grid. This is what keeps the copied brick rates
     * honest: they drift, this fails. */
    const drift = [];
    for (const id of levelIds()) {
      const sc = new LevelScene(game, id);
      let bricksHere = 0; let stars = 0; let switches = 0;
      for (let ty = 0; ty < sc.h; ty++) {
        for (let tx = 0; tx < sc.w; tx++) {
          const ch = sc.rawTileAt(tx, ty);
          if (ch === 'B' && sc.brickSecret(tx, ty)) {
            bricksHere++;
            if (!brickHides(tx, ty)) drift.push(`${id} ${tx},${ty}`);
          }
          if (ch === '*') stars++;
          if (ch === 'S') switches++;
        }
      }
      const keys = secretKeys(id);
      const mine = { b: 0, s: 0, w: 0, band: 0 };
      for (const k of keys) {
        if (k === SKY || k === CAVE) mine.band++;
        else if (k[0] === 'B') mine.b++;
        else if (k[0] === '*') mine.s++;
        else if (k[0] === 'S') mine.w++;
      }
      if (mine.b !== bricksHere || mine.s !== stars || mine.w !== switches) {
        drift.push(`${id} ${mine.b}/${bricksHere} ${mine.s}/${stars} ${mine.w}/${switches}`);
      }
      const bands = getLevel(id).bands ? 1 : 0;
      if (!bands && mine.band) drift.push(`${id} kaistaton mutta ${mine.band} aluetta`);
    }
    expect('kartan laskenta ja moottorin luenta ovat samaa mieltä joka kentässä',
      drift.length === 0, drift.slice(0, 4).join(' · '));

    /* 2. Found means "the game gave you what it was hiding". A block pays out;
     * a hidden area is where your feet are. */
    reset();
    const scene = new LevelScene(game, '1-2');
    const brick = secretKeys('1-2').find((k) => k[0] === 'B') || 'B0,0';
    const [bx, by] = brick.slice(1).split(',').map(Number);
    scene.bumpTile(bx, by, scene.player);
    const afterBrick = secretTally(game.state, '1-2');
    scene.player.y = 5 * 16;
    scene.player.x = 150 * 16;
    scene.update(mkInput());
    const afterSky = secretTally(game.state, '1-2');
    expect('salaisuus löytyy silloin kun se antaa sen mitä se kätki',
      afterBrick.found === 1 && afterBrick.total === 5
      && afterSky.found === 2 && foundKeys(game.state, '1-2').includes(SKY),
      `tiili ${afterBrick.found}/${afterBrick.total} → alue ${afterSky.found}`);

    /* …and it has to still be there tomorrow. */
    const before = localStorage.getItem('sfb3.save.v2');
    Save.write(game.state);
    const reloaded = Save.load();
    expect('löydetty salaisuus kestää tallennuksen',
      secretTally(reloaded, '1-2').found === 2, JSON.stringify(reloaded.secrets || null));

    /* 3. The save format did not get a new version number, so this is the case
     * that has to work: a save written yesterday, with no secret field at all. */
    localStorage.setItem('sfb3.save.v2', JSON.stringify({
      lives: 3, coins: 7, score: 4200, power: { type: 'shroom', level: 2 },
      reserve: null, world: 0, node: 'w1-2', cleared: { 'w1-1': true }, worldsOpen: 1,
    }));
    let old = null; let oldErr = '';
    try { old = Save.load(); } catch (e) { oldErr = e.message; }
    const oldReads = old && secretTally(old, '1-2');
    expect('vanha tallennus ilman salaisuustietoa latautuu ja lukee nollaksi',
      !!old && old.lives === 3 && !!old.secrets && oldReads.found === 0
      && oldReads.total === 5 && DEFAULT_SAVE().secrets
      && noteSecret(old, '1-2', brick) === true,
      oldErr || `lives ${old && old.lives}  ${oldReads && oldReads.found}/${oldReads && oldReads.total}`);
    if (before === null) localStorage.removeItem('sfb3.save.v2');
    else localStorage.setItem('sfb3.save.v2', before);

    /* 4. Same map, drawn three ways. */
    const shot = (found) => {
      const g = Object.create(game);
      g.state = { ...DEFAULT_SAVE(), world: 0, node: 'w1-2', secrets: { '1-2': found } };
      const map = new WorldMapScene(g);
      const cv = document.createElement('canvas');
      cv.width = 320; cv.height = 240;
      const c2 = cv.getContext('2d');
      map.draw(c2);
      return c2.getImageData(0, 0, 320, 240).data.join(',');
    };
    const bricksOf = secretKeys('1-2').filter((k) => k[0] === 'B').concat('B0,0');
    const none = shot([]);
    const oneA = shot([bricksOf[0]]);
    const oneB = shot([SKY]);
    expect('kartta kertoo montako salaisuutta on löytynyt',
      none !== oneA, `${none.length} vs ${oneA.length} tavua`);
    expect('kartta ei kerro mikä salaisuus löytyi',
      oneA === oneB, 'sama määrä, eri salaisuus, sama kuva');
  }

  /* ------------------- generoitujen kenttien uusi sanasto ---------------- */
  /*
   * The generated world gets its own assertions, and they are here rather than
   * in the generator because the generator only knows what it wrote. These ask
   * the *engine* what is in the shipped grid.
   *
   * The one that matters most is the secret. Which brick hides something is a
   * pure function of position, so it costs nothing and applies to generated
   * levels for free — and "for free" is how the levels this replaced ended up
   * with 5-1 and 5-2 holding no secret at all. `gen-levels.mjs` now guarantees
   * one, using its own copy of the two rates in `src/scenes/level.js` because
   * that module cannot be loaded outside a browser. This test is what makes the
   * copy safe: it asks `brickSecret` itself, so if the rates ever drift apart
   * the gate fails instead of the world quietly going empty.
   */
  {
    reset();
    const { T } = await import('/src/gfx/tiles.js');
    const generated = ['5-1', '5-2', '5-3'];
    const world = { crumble: 0, switches: 0, stars: 0 };
    const perLevel = [];
    for (const id of generated) {
      const sc = new LevelScene(game, id);
      const seen = { crumble: 0, switches: 0, stars: 0, bricks: 0, secrets: 0 };
      for (let ty = 0; ty < sc.h; ty++) {
        for (let tx = 0; tx < sc.w; tx++) {
          const ch = sc.rawTileAt(tx, ty);
          if (ch === T.CRUMBLE) seen.crumble++;
          if (ch === T.SWITCH) seen.switches++;
          if (ch === T.QSTAR) seen.stars++;
          if (ch === T.BRICK) {
            seen.bricks++;
            if (sc.brickSecret(tx, ty)) seen.secrets++;
          }
        }
      }
      world.crumble += seen.crumble;
      world.switches += seen.switches;
      world.stars += seen.stars;
      perLevel.push({ id, ...seen });
    }
    const say = perLevel.map((l) => `${l.id}: %${l.crumble} S${l.switches} *${l.stars} `
      + `${l.secrets}/${l.bricks} salaista`).join(' · ');

    expect('every generated level hides something in an ordinary brick',
      perLevel.every((l) => l.secrets > 0), say);
    /* Exactly one star per level: none means the level never got the surprise,
     * two means it stopped being one. */
    expect('every generated level has exactly one star block',
      perLevel.every((l) => l.stars === 1), say);
    /* Coverage is the world's promise, not the level's — the hand-made worlds
     * hand out mechanics one per level too. */
    expect('the generated world carries crumbling platforms and a switch block',
      world.crumble > 0 && world.switches > 0, say);
    /* A switch with nothing to change is furniture. */
    expect('every switch block has bricks in the same level to change',
      perLevel.every((l) => l.switches === 0 || l.bricks > 0), say);
  }

  /* ------------------------- teemakohtainen seisonta -------------------- */
  /* Standing about is where the character says what kind of place this is: he
   * shivers on the ice and mops his brow in the desert. Asserted by pixel count
   * against the same pose in a temperate world, because "it is in there
   * somewhere" is how the first version shipped a four-pixel bead nobody could
   * see. Same idle value on both sides — comparing different idle values only
   * measures the ordinary idle beats. */
  {
    const sprites = await import('/src/gfx/sprites.js');
    const c = document.createElement('canvas');
    c.width = 40;
    c.height = 40;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const shot = (o) => {
      g.clearRect(0, 0, 40, 40);
      sprites.drawPlayer(g, 8, 4, {
        type: null, level: 1, facing: 1, state: 'idle', frame: 0, wag: 0, ...o,
      });
      return g.getImageData(0, 0, 40, 40).data;
    };
    const diff = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]
          || a[i + 3] !== b[i + 3]) n++;
      }
      return n;
    };
    const cold = diff(shot({ tick: 100, idle: 210, theme: 'grass' }),
      shot({ tick: 100, idle: 210, theme: 'ice' }));
    const hot = diff(shot({ tick: 100, idle: 300, theme: 'grass' }),
      shot({ tick: 100, idle: 300, theme: 'desert' }));
    const shivers = diff(shot({ tick: 100, idle: 210, theme: 'ice' }),
      shot({ tick: 102, idle: 210, theme: 'ice' }));
    // A temperate world must stay exactly as it was.
    const plainSame = diff(shot({ tick: 100, idle: 300, theme: 'grass' }),
      shot({ tick: 100, idle: 300 }));
    expect('the hero shivers on the ice and sweats in the desert',
      cold > 40 && hot > 20 && shivers > 40 && plainSame === 0,
      `jää ${cold}px, aavikko ${hot}px, värinä ${shivers}px, niitty ${plainSame}px`);
  }

  /* --------------------- animaatiokierrokset, viisi kokoa ---------------- */
  /*
   * Every pose the player can be in, at all five power levels and in all four
   * power types, measured against the box the game actually hits things with.
   * Two rules, and both of them were broken when this was written:
   *
   *  1. Nothing may be drawn outside the box except the exceptions named here.
   *     The walk cycle drew its feet 3px below the floor line at level 0 and
   *     1-2px below it at levels 1-5, and the idle breath lifted the cap out
   *     through the top of the head.
   *  2. The character is one piece. The breath pulled the shirt off the
   *     trousers at every level above 0, so for a third of every breath he came
   *     apart at the waist, and the walk's third frame left the back leg
   *     floating a pixel below the hip at every size.
   *
   * Neither was visible to any numeric test before this one and both were
   * obvious the moment the poses were laid out as a sheet — which is why this
   * measures the picture and not the numbers that made it.
   *
   * Artwork is told apart from its own outline by colour, not by alpha: the
   * outline is rgba(16,16,24,0.85), translucent everywhere except where all
   * four offsets stack, and there it lands on 16,16,23 — one blue short of
   * C.ink, and therefore not a colour the player is ever painted in.
   *
   * The exceptions are named rather than tolerated as slack, because slack
   * hides the next bug: a raccoon has ears above his head and a tail behind
   * him, a bead of sweat leaves the face on its way down, the shoulders are a
   * pixel wider than the box on each side (see the report — closing that one
   * means moving PLAYER_SIZES, which moves every collision in the game), and
   * the shiver displaces the whole body a pixel sideways because that is what
   * a shiver is. Allowances are given in template pixels and scaled up with
   * the sprite, since that is how the drawing itself grows.
   */
  {
    const sprites = await import('/src/gfx/sprites.js');
    const { PLAYER_SIZES, PLAYER_DUCK_SIZES, drawPlayer } = sprites;
    /* Twelve rows taller and the sprite twelve lower than this used to be: the
     * sleeper's ZZZ climbs 21 px above his head, and a picture that runs off
     * the top of the sheet counts as one piece fewer rather than as a leak,
     * which is a check quietly measuring the canvas instead of the drawing. */
    const W = 96; const H = 88; const OX = 36; const OY = 27;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    /* Every colour the player is ever painted in. */
    const ART = new Set([
      '16,16,24', '240,184,144', '192,120,80', '62,162,58', '31,111,38',
      '140,76,24', '90,44,12', '200,140,64', '248,248,248', '92,156,40',
      '255,208,72', '156,106,40', '224,76,60', '200,200,208', '192,90,36',
      '140,60,28', '74,28,10', '44,76,20', '42,74,106', '127,200,240',
      '232,248,255',
    ]);

    const poses = [
      { n: 'idle', s: { state: 'idle', tick: 0, idle: 0 } },
      { n: 'breath', s: { state: 'idle', tick: 40, idle: 60 } },
      { n: 'look up', s: { state: 'idle', tick: 5, idle: 230 } },
      { n: 'scratch', s: { state: 'idle', tick: 5, idle: 320 } },
      { n: 'tap', s: { state: 'idle', tick: 5, idle: 497 } },
      { n: 'shiver-', s: { state: 'idle', tick: 100, idle: 210, theme: 'ice' } },
      { n: 'shiver+', s: { state: 'idle', tick: 102, idle: 210, theme: 'ice' } },
      { n: 'sweat 0', s: { state: 'idle', tick: 5, idle: 231, theme: 'desert' } },
      { n: 'sweat 7', s: { state: 'idle', tick: 5, idle: 385, theme: 'desert' } },
      { n: 'wipe', s: { state: 'idle', tick: 5, idle: 620, theme: 'desert' } },
      { n: 'walk 0', s: { state: 'walk', frame: 0 } },
      { n: 'walk 1', s: { state: 'walk', frame: 1 } },
      { n: 'walk 2', s: { state: 'walk', frame: 2 } },
      { n: 'walk 3', s: { state: 'walk', frame: 3 } },
      { n: 'run 0', s: { state: 'walk', frame: 0, running: true } },
      { n: 'run 2', s: { state: 'walk', frame: 2, running: true } },
      { n: 'jump', s: { state: 'jump', frame: 0 } },
      { n: 'duck', s: { state: 'duck', ducking: true } },
      /* Hand over hand up a vine, seen from behind. Nothing leaves the box
       * that the standing pose does not already send out: the raised arms sit
       * on the same columns the hanging ones do. */
      { n: 'climb 0', s: { state: 'climb', frame: 0 } },
      { n: 'climb 1', s: { state: 'climb', frame: 1 } },
      /*
       * The second-tier idle, one per theme. Each is sampled at the frame of
       * its own cycle that reaches furthest, so the numbers below are the
       * animation's maxima and not one convenient still: `px` is template
       * pixels and grows with the sprite, `screen` is finished pixels and does
       * not, and `comps` is the exact number of pieces the picture is allowed
       * to be in. Every one of them was measured off the drawing rather than
       * chosen, and none of them is round.
       *
       * The icicles and the flame are the room acting on the character, so
       * they are drawn by the body and grow with it. The ZZZ is a symbol and
       * is not part of the body, so it is drawn beside it at a fixed size —
       * see the note in sprites/player.js.
       */
      { n: 'sleep', s: { state: 'idle', tick: 5, idle: 1319 }, a: { screen: { above: 21, front: 12 }, comps: 4 } },
      /* Two samples of the icicle breath: the first one still on his lip, and
       * the frame where all three are clear of him and as far out as they go. */
      { n: 'frost 1', s: { state: 'idle', tick: 5, idle: 1244, theme: 'ice' }, a: { px: { front: 2 } } },
      { n: 'frost 3', s: { state: 'idle', tick: 5, idle: 1263, theme: 'ice' }, a: { px: { front: 11 }, comps: 4 } },
      { n: 'alight', s: { state: 'idle', tick: 5, idle: 1218, theme: 'desert' }, a: { px: { above: 2 } } },
      /* The panic beats the body a pixel sideways as well as the arms, so the
       * back arm reaches one further out than a hanging one — the same pixel
       * the shiver is already allowed on the ice, for the same reason. */
      { n: 'panic', s: { state: 'idle', tick: 5, idle: 1260, theme: 'desert' }, a: { px: { above: 4, back: 1 } } },
      { n: 'smoke', s: { state: 'idle', tick: 5, idle: 1355, theme: 'desert' }, a: { px: { above: 4 } } },
    ];

    const leaks = [];
    const pieces = [];
    const hashes = {};
    for (const level of [0, 1, 2, 3, 4, 5]) {
      for (const type of [null, 'shroom', 'flower', 'leaf', 'pop']) {
        for (const p of poses) {
          for (const facing of [1, -1]) {
            const s = {
              type, level, facing, frame: 0, running: false, wag: 1.1,
              ducking: false, theme: 'grass', tick: 5, idle: 0, ...p.s,
            };
            const box = (s.ducking ? PLAYER_DUCK_SIZES : PLAYER_SIZES)[level];
            g.clearRect(0, 0, W, H);
            drawPlayer(g, OX, OY, s);
            const d = g.getImageData(0, 0, W, H).data;
            const art = new Uint8Array(W * H);
            let x0 = 1e9; let y0 = 1e9; let x1 = -1; let y1 = -1;
            let hash = 0;
            for (let y = 0; y < H; y++) {
              for (let x = 0; x < W; x++) {
                const i = (y * W + x) * 4;
                hash = (hash * 33 + d[i] * 7 + d[i + 1] * 3 + d[i + 3]) | 0;
                if (d[i + 3] !== 255) continue;
                if (!ART.has(`${d[i]},${d[i + 1]},${d[i + 2]}`)) continue;
                art[y * W + x] = 1;
                if (x < x0) x0 = x;
                if (y < y0) y0 = y;
                if (x > x1) x1 = x;
                if (y > y1) y1 = y;
              }
            }
            if (facing === 1) hashes[`${level}|${type}|${p.n}`] = hash;
            const where = `L${level} ${type || 'none'} ${p.n} f${facing}`;
            if (x1 < 0) { leaks.push(`${where}: nothing drawn at all`); continue; }

            /* Named allowances, in template pixels. */
            const sx = level < 2 ? 1 : box.w / 14;
            const sy = level < 2 ? 1 : box.h / (s.ducking ? 16 : 26);
            const ice = s.theme === 'ice';
            const sweaty = s.theme === 'desert' || s.theme === 'factory';
            const up = (n, k) => (n <= 0 ? 0 : Math.ceil(n * k));
            const px = (p.a && p.a.px) || {};
            const scr = (p.a && p.a.screen) || {};
            const allow = {
              above: up((type === 'leaf' ? 2 : 0) + (px.above || 0), sy) + (scr.above || 0),
              below: 0,                                        // the floor line is the floor line
              front: up((sweaty ? 2 : 1) + (ice ? 1 : 0) + (px.front || 0), sx) + (scr.front || 0),
              back: up((type === 'leaf' ? 9 : 1) + (ice ? 1 : 0) + (px.back || 0), sx) + (scr.back || 0),
            };
            const over = {
              above: OY - y0,
              below: y1 - (OY + box.h - 1),
              [facing > 0 ? 'front' : 'back']: x1 - (OX + box.w - 1),
              [facing > 0 ? 'back' : 'front']: OX - x0,
            };
            for (const k of ['above', 'below', 'front', 'back']) {
              if (over[k] > allow[k]) leaks.push(`${where}: ${over[k]}px ${k} of the box, ${allow[k]} allowed`);
            }

            /* One character, not a pile of parts. */
            let comps = 0;
            const seen = new Uint8Array(W * H);
            const stack = [];
            for (let q0 = 0; q0 < W * H; q0++) {
              if (!art[q0] || seen[q0]) continue;
              comps++;
              stack.push(q0);
              seen[q0] = 1;
              while (stack.length) {
                const q = stack.pop();
                const qx = q % W;
                if (qx > 0 && art[q - 1] && !seen[q - 1]) { seen[q - 1] = 1; stack.push(q - 1); }
                if (qx < W - 1 && art[q + 1] && !seen[q + 1]) { seen[q + 1] = 1; stack.push(q + 1); }
                if (q >= W && art[q - W] && !seen[q - W]) { seen[q - W] = 1; stack.push(q - W); }
                if (q < W * (H - 1) && art[q + W] && !seen[q + W]) { seen[q + W] = 1; stack.push(q + W); }
              }
            }
            const wantComps = (p.a && p.a.comps) || 1;
            if (comps !== wantComps) pieces.push(`${where}: ${comps} pieces, ${wantComps} named`);
          }
        }
      }
    }
    expect('every pose at every power level stays inside its own box',
      leaks.length === 0, `${leaks.length} poses leak: ${leaks.slice(0, 4).join('; ')}`);
    expect('the player is one piece in every pose at every power level',
      pieces.length === 0, `${pieces.length} broken: ${pieces.slice(0, 4).join('; ')}`);

    /* The paukkupapu landed as the fourth power type on the day this audit was
     * written, and a new type that inherits another one's drawing looks exactly
     * like a working feature until somebody collects it. */
    const same = [];
    for (const level of [0, 1, 2, 3, 4, 5]) {
      for (const p of poses) {
        for (const t of [null, 'shroom', 'flower', 'leaf']) {
          if (hashes[`${level}|pop|${p.n}`] === hashes[`${level}|${t}|${p.n}`]) {
            same.push(`L${level} ${p.n} == ${t || 'none'}`);
          }
        }
      }
    }
    expect('the paukkupapu has a body of its own at every level and pose',
      same.length === 0, same.slice(0, 4).join('; '));
  }

  /* ------------------ vihollisten laatikot ja hengitys ------------------- */
  /*
   * The audit above, pointed at the things that walk at him. Same method —
   * measure the picture, not the numbers that made it — and it found the same
   * two kinds of fault.
   *
   *  1. `Walker` is declared 16x16 and drew x+1..+15, y+3..+16, so a three
   *     pixel band above its head hurt without ever being visible (DESIGN.md
   *     §7). Fixed by growing the art into the box, never by shrinking the box
   *     onto the art: the walker is the enemy every other one is a variation
   *     of, so its box is the size of a stomp everywhere in the game, and
   *     trimming it would quietly make every walker harder to land on.
   *  2. Nothing that walks had any vertical motion at all. Everything alive
   *     breathes now — one pixel — and two neighbours must not breathe in step.
   *
   * `over` is art outside the box: visible, harmless, a wing or a spine.
   * `under` is box with no art on it: invisible, harmful, and the worse of the
   * two. Both are named per enemy rather than tolerated as slack, because
   * slack is where the next one hides — every non-zero number below is a
   * finding somebody may still decide to fix.
   */
  {
    const sprites = await import('/src/gfx/sprites.js');
    const W = 88; const H = 72; const OX = 28; const OY = 24;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    /* Every colour an enemy body is painted in. Trailing gas and the stink
     * cloud's shadow are deliberately not on the list: they are translucent, so
     * they only reach full alpha where they land on the stacked outline, and a
     * puff of gas behind an enemy is not part of its body. */
    const ART = new Set([
      '160,104,40', '122,76,24', '76,44,8', '248,248,248', '16,16,24',
      '62,162,58', '28,107,31', '248,232,160', '240,208,96', '200,160,48',
      '200,200,216', '60,52,80', '88,76,116', '42,36,56', '90,80,64',
      '232,224,200', '168,152,120', '224,64,64', '31,111,38', '160,32,32',
      '112,16,16', '216,168,96', '156,106,40', '138,90,42', '92,58,22',
      '60,32,50', '106,60,88', '74,44,24', '200,160,88', '255,208,72',
      '106,68,36',
    ]);
    const shot = (paint) => {
      g.clearRect(0, 0, W, H);
      paint();
      const d = g.getImageData(0, 0, W, H).data;
      const art = new Uint8Array(W * H);
      let x0 = 1e9; let y0 = 1e9; let x1 = -1; let y1 = -1;
      let rows = 0; let n = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          if (d[i + 3] !== 255) continue;
          if (!ART.has(`${d[i]},${d[i + 1]},${d[i + 2]}`)) continue;
          art[y * W + x] = 1;
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
          rows += y;
          n++;
        }
      }
      /* One body, not a pile of parts — the same flood fill as the player's
       * audit, and here for the same reason: his breath used to lift the shirt
       * off the trousers, and a breath that pins the top of a sprite while it
       * moves the middle is exactly the shape of mistake that does it again. */
      let pieces = 0;
      const seen2 = new Uint8Array(W * H);
      const stack = [];
      for (let q0 = 0; q0 < W * H; q0++) {
        if (!art[q0] || seen2[q0]) continue;
        pieces++;
        stack.push(q0);
        seen2[q0] = 1;
        while (stack.length) {
          const q = stack.pop();
          const qx = q % W;
          if (qx > 0 && art[q - 1] && !seen2[q - 1]) { seen2[q - 1] = 1; stack.push(q - 1); }
          if (qx < W - 1 && art[q + 1] && !seen2[q + 1]) { seen2[q + 1] = 1; stack.push(q + 1); }
          if (q >= W && art[q - W] && !seen2[q - W]) { seen2[q - W] = 1; stack.push(q - W); }
          if (q < W * (H - 1) && art[q + W] && !seen2[q + W]) { seen2[q + W] = 1; stack.push(q + W); }
        }
      }
      // `lift` is the art's vertical centre of mass in hundredths of a pixel:
      // it moves whenever any part of the body moves up or down, and it does
      // not care where along the ground the sprite was drawn.
      return { x0, y0, x1, y1, pieces, lift: n ? Math.round((rows / n) * 100) : -1 };
    };

    const none = { over: {}, under: {} };
    const subjects = [
      { n: 'walker', box: [0, 0, 16, 16], breathes: true, clock: 8, ...none,
        paint: (ox, t, f) => sprites.drawWalker(g, ox, OY, Math.floor(t / 8), f, false) },
      // A flattened walker is scenery for twenty-two frames and cannot hurt
      // anybody, so it is not held to the box it no longer fills.
      { n: 'flyer', box: [0, 0, 16, 16], over: { left: 4, right: 4 }, under: {},
        paint: (ox, t, f) => sprites.drawFlyer(g, ox, OY, t, f) },
      { n: 'shell walking', box: [1, 0, 14, 24], breathes: true, clock: 1,
        over: {}, under: { top: 1 },
        paint: (ox, t, f) => sprites.drawShell(g, ox, OY, t, f, 'walk') },
      { n: 'shell', box: [1, 0, 14, 14], over: { left: 1, right: 1 }, under: { top: 2 },
        paint: (ox, t, f) => sprites.drawShell(g, ox, OY, t, f, 'shell') },
      { n: 'spikeguy', box: [0, 0, 16, 16], breathes: true, clock: 2,
        over: { top: 2 }, under: { left: 1, right: 1 },
        paint: (ox, t, f) => sprites.drawSpikeGuy(g, ox, OY, Math.floor(t / 2), f) },
      { n: 'plant', box: [0, 0, 16, 32], breathes: true, clock: 1,
        over: {}, under: { left: 1, right: 1 }, facings: [1],
        paint: (ox, t) => sprites.drawPlant(g, ox, OY, t) },
      { n: 'corkguy', box: [1, 0, 14, 16], breathes: true, clock: 1,
        over: {}, under: { top: 2, left: 1, right: 1 },
        paint: (ox, t, f) => sprites.drawCorkGuy(g, ox, OY, t, f) },
      { n: 'stink cloud', box: [0, 0, 20, 14],
        over: {}, under: { top: 1, bottom: 1, left: 1, right: 1 },
        paint: (ox, t, f) => sprites.drawStinkCloud(g, ox, OY, t, f, true) },
      { n: 'bean baron', box: [0, 0, 18, 26], ...none,
        paint: (ox, t, f) => sprites.drawBeanBaron(g, ox, OY, Math.floor(t / 7), f, 0, false) },
    ];

    // One line per distinct fault, not one per frame: 176 frames of the same
    // three pixel band is one bug, and a list of 700 of them hides the next.
    const seen = new Map();
    const disagree = [];
    const note = (what, t) => {
      if (!seen.has(what)) { seen.set(what, t); disagree.push(what); }
    };
    const worst = [];
    for (const s of subjects) {
      const [dx, dy, bw, bh] = s.box;
      const bx0 = OX + dx; const by0 = OY + dy;
      const bx1 = bx0 + bw - 1; const by1 = by0 + bh - 1;
      let gap = 0;
      for (const facing of (s.facings || [1, -1])) {
        for (let t = 0; t < 176; t += 2) {
          const m = shot(() => s.paint(OX, t, facing));
          if (m.x1 < 0) { note(`${s.n} f${facing}: nothing drawn`, t); continue; }
          if (m.pieces !== 1) note(`${s.n} f${facing}: came apart into ${m.pieces} pieces`, t);
          const over = { top: by0 - m.y0, bottom: m.y1 - by1, left: bx0 - m.x0, right: m.x1 - bx1 };
          const under = { top: m.y0 - by0, bottom: by1 - m.y1, left: m.x0 - bx0, right: bx1 - m.x1 };
          for (const k of ['top', 'bottom', 'left', 'right']) {
            if (under[k] > gap) gap = under[k];
            if (over[k] > (s.over[k] || 0)) {
              note(`${s.n} f${facing}: ${over[k]}px of art ${k} of the box, ${s.over[k] || 0} allowed`, t);
            }
            if (under[k] > (s.under[k] || 0)) {
              note(`${s.n} f${facing}: ${under[k]}px of box with no art at the ${k}, ${s.under[k] || 0} allowed`, t);
            }
          }
        }
      }
      worst.push(`${s.n} ${gap}`);
    }
    // The measurement, not just the verdict: the widest band of box that no
    // pixel of the enemy ever covers. Zero is what the walker was grown for.
    expect('every enemy\'s drawing agrees with the box it hurts you with',
      disagree.length === 0,
      disagree.length ? disagree.join('; ') : `laatikossa kattamatta: ${worst.join(', ')}`);

    /*
     * One shared breath, offset per enemy — the trick the world map already
     * uses on its tiles. Without the offset a row of walkers pulses as one
     * body and reads as a rendering fault rather than as life. Measured three
     * ways: it moves at all, a neighbour a tile away is out of step with it,
     * and one pixel of walking does not jump its phase.
     *
     * Not on the list, because they already have vertical motion of their own
     * and a second one would fight it: the stink cloud (bobs on a sine), the
     * flyer (bounces off the floor), the bean baron (hops), the angry sun and
     * the moon (both hover), and anything sealed in a bubble.
     */
    const flat = [];
    const lockstep = [];
    const measured = [];
    const PERIOD = sprites.BREATH_PERIOD;
    const flipOf = (ser) => {
      for (let i = 1; i < ser.length; i++) if (ser[i] !== ser[0]) return i;
      return -1;
    };
    for (const s of subjects.filter((q) => q.breathes)) {
      const series = (ox) => {
        const out = [];
        for (let t = 0; t < PERIOD + 16; t++) out.push(shot(() => s.paint(ox, t, 1)).lift);
        return out;
      };
      // A whole tile's worth of standing positions, so whatever the phase is
      // derived from, this walks across at least one of its boundaries.
      const steps = [0, 4, 8, 12, 16].map((d) => series(OX + d));
      const here = steps[0];
      let apart = 0;
      for (let i = 0; i < here.length; i++) if (here[i] !== steps[4][i]) apart++;
      // How far the breath's phase moved for four pixels of ground. It has to
      // move — that is what keeps neighbours apart — but it may only ever
      // drift, never snap, or an enemy would change its breathing the moment
      // it stepped over a tile boundary. The slack is one step of the sprite's
      // own animation clock, which for the walker is eight frames because that
      // is the only clock it is given.
      let jumped = 0;
      for (let i = 1; i < steps.length; i++) {
        const a = flipOf(steps[i - 1]); const b = flipOf(steps[i]);
        if (a < 0 || b < 0) continue;
        const d = Math.abs(a - b);
        jumped = Math.max(jumped, Math.min(d, PERIOD - d));
      }
      const slack = 4 + s.clock;
      if (new Set(here).size < 2) flat.push(`${s.n} never moves`);
      if (apart < 3) lockstep.push(`${s.n}: the next tile along differs on ${apart} frames`);
      if (jumped > slack) lockstep.push(`${s.n}: four pixels of travel snapped the breath ${jumped} frames, ${slack} allowed`);
      measured.push(`${s.n} ${apart}/${jumped}`);
    }
    expect('everything alive breathes, and neighbours are not in step',
      flat.length === 0 && lockstep.length === 0,
      [...flat, ...lockstep, `naapurin ero / 4px:n siirtymä: ${measured.join(', ')}`].join('; '));
  }
  /* ------------------------ kävelyn ohitusasento ------------------------ */
  /*
   * A walk is contact, pass, contact, pass. The three leg frames were always
   * right — 0 and 2 are the two contacts, 1 is the pass — but the driver ran
   * them with `% 3`, so once every stride the cycle wrapped 2 straight back to
   * 0 and the character put both feet down twice in a row.
   *
   * Measured on the pictures a player who is actually walking asks for, not on
   * the counter: the counter can be renumbered, the limp cannot be argued with.
   */
  {
    const sprites = await import('/src/gfx/sprites.js');
    const c = document.createElement('canvas');
    c.width = 40;
    c.height = 40;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const shot = (frame) => {
      g.clearRect(0, 0, 40, 40);
      sprites.drawPlayer(g, 8, 4, {
        type: 'shroom', level: 1, facing: 1, frame, state: 'walk',
        running: false, tick: 5, idle: 0, wag: 0,
      });
      const d = g.getImageData(0, 0, 40, 40).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] * 5 + d[i + 3]) | 0;
      return h;
    };

    reset({ type: 'shroom', level: 1 });
    const scene = new LevelScene(game, '1-1');
    const input = mkInput();
    input.held.right = true;
    const asked = [];
    for (let f = 0; f < 400; f++) {
      scene.update(input);
      const p = scene.player;
      if (p.state() === 'walk') asked.push(p.animFrame);
    }
    // The pictures, with repeats of the same picture collapsed.
    const pics = [];
    for (const f of asked) {
      const h = shot(f);
      if (pics.length === 0 || pics[pics.length - 1] !== h) pics.push(h);
    }
    const pass = shot(1);
    const contacts = new Set(pics.filter((h) => h !== pass));
    let doubled = 0;
    for (let i = 1; i < pics.length; i++) {
      if (pics[i] !== pass && pics[i - 1] !== pass) doubled++;
    }
    expect('the walk passes through the closed-legs frame between every contact',
      pics.length > 8 && contacts.size === 2 && doubled === 0,
      `${pics.length} kuvaa, ${contacts.size} kosketusasentoa, ${doubled} peräkkäin`);
  }

  /* ------------------------- kiipeilyn oma asento ----------------------- */
  /*
   * Half of this was already in the engine and thrown away: `animFrame` was
   * being driven as a two-frame hand-over-hand cycle while `state()` reported
   * `jump`, so the vine showed a frozen jump pose that never changed. Both
   * halves are checked here — the state the engine reports, and that the two
   * frames are actually two different pictures and neither of them is the jump.
   */
  {
    const { T } = await import('/src/gfx/tiles.js');
    const sprites = await import('/src/gfx/sprites.js');
    reset({ type: 'shroom', level: 1 });
    let scene = null;
    let vine = null;
    for (const id of levelIds()) {
      const sc = new LevelScene(game, id);
      for (let ty = 1; ty < sc.h && !vine; ty++) {
        for (let tx = 0; tx < sc.w; tx++) {
          if (sc.rawTileAt(tx, ty) === T.VINE && sc.rawTileAt(tx, ty + 1) === T.VINE) {
            vine = { tx, ty }; scene = sc; break;
          }
        }
      }
      if (vine) break;
    }
    let climbState = 'ei köyttä';
    let moved = false;
    if (vine) {
      const p = scene.player;
      p.x = vine.tx * 16 + (16 - p.w) / 2;
      p.y = vine.ty * 16;
      p.onGround = false;
      const input = mkInput();
      input.held.up = true;
      const seen = new Set();
      for (let f = 0; f < 40; f++) {
        scene.update(input);
        if (p.climbing) { climbState = p.state(); seen.add(p.animFrame); }
      }
      moved = seen.size === 2;
    }

    const c = document.createElement('canvas');
    c.width = 40;
    c.height = 40;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const shot = (o) => {
      g.clearRect(0, 0, 40, 40);
      sprites.drawPlayer(g, 8, 4, {
        type: 'shroom', level: 1, facing: 1, frame: 0, state: 'idle',
        running: false, tick: 5, idle: 0, wag: 0, ...o,
      });
      const d = g.getImageData(0, 0, 40, 40).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] * 5 + d[i + 3]) | 0;
      return h;
    };
    const a = shot({ state: 'climb', frame: 0 });
    const b = shot({ state: 'climb', frame: 1 });
    const jump = shot({ state: 'jump', frame: 0 });
    expect('a player on a vine climbs instead of hanging in a jump pose',
      climbState === 'climb' && moved && a !== b && a !== jump && b !== jump,
      `tila "${climbState}", kaksi framea ${moved}, framet eroavat ${a !== b}, `
      + `ei hyppyasento ${a !== jump && b !== jump}`);
  }

  /* --------------------- toisen tason seisonta-animaatiot --------------- */
  /*
   * Twenty seconds of standing still — the same wait the title screen makes
   * before the cabinet starts playing by itself — and the character starts a
   * bigger performance: he falls asleep in an ordinary level, breathes icicles
   * on the ice and sets his hair on fire in the desert.
   *
   * Three things are checked, and the first two are the whole joke:
   *  1. Nothing at all changes before the twenty seconds are up. The first-tier
   *     idle keeps its own 360-frame cycle, so a shot at 1199 must be identical
   *     to the same phase 360 frames earlier.
   *  2. It ends in one frame when anything comes near, exactly as the attract
   *     demo hands the machine back.
   *  3. All three are different performances, not one with a repaint.
   */
  {
    const sprites = await import('/src/gfx/sprites.js');
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const shot = (o) => {
      g.clearRect(0, 0, 64, 64);
      sprites.drawPlayer(g, 22, 26, {
        type: null, level: 1, facing: 1, state: 'idle', frame: 0, wag: 0,
        running: false, ducking: false, theme: 'grass', tick: 100, ...o,
      });
      return g.getImageData(0, 0, 64, 64).data;
    };
    const diff = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]
          || a[i + 3] !== b[i + 3]) n++;
      }
      return n;
    };
    const quiet = diff(shot({ idle: 1199 }), shot({ idle: 839 }));
    const wakes = diff(shot({ idle: 1199 }), shot({ idle: 1300 }));
    const sleep = shot({ idle: 1300 });
    const frost = shot({ idle: 1263, theme: 'ice' });
    const fire = shot({ idle: 1260, theme: 'desert' });
    const own = Math.min(diff(sleep, frost), diff(sleep, fire), diff(frost, fire));
    // …and it must be an animation, not a still.
    const alive = diff(shot({ idle: 1300 }), shot({ idle: 1340 }));
    expect('the second-tier idle waits twenty seconds and then puts on a show',
      quiet === 0 && wakes > 30 && own > 20 && alive > 10,
      `ennen ${quiet}px, laukeaa ${wakes}px, teemojen ero ${own}px, elää ${alive}px`);

    /* Breaking in a single frame is the same promise the attract demo makes. */
    reset({ type: 'shroom', level: 1 });
    const scene = new LevelScene(game, '1-1');
    const p = scene.player;
    const idleInput = mkInput();
    for (let f = 0; f < 30; f++) scene.update(idleInput);
    // Nothing in the room to begin with, so the twenty seconds can run out.
    const foes = scene.entities.filter((e) => e.kind === 'enemy');
    for (const e of foes) e.x += 4000;
    p.idle = 1400;
    scene.update(idleInput);
    const undisturbed = p.idle;
    let broke = -1;
    if (foes.length) {
      const foe = foes[0];
      foe.x = p.x + 40;
      foe.y = p.y;
      foe.active = true;
      p.idle = 1400;
      scene.update(idleInput);
      broke = p.idle;
    }
    expect('the second-tier idle stops dead the frame something comes near',
      undisturbed > 1400 && broke === 0,
      `häiriöttä ${undisturbed}, vihollinen lähellä ${broke}`);
  }

  /* ---------------------------- voittoruutu ----------------------------- */
  /* Clearing a castle used to leave the player standing on the edge of the
   * arena while the map loaded. The card must appear, must be skippable, and
   * must never be able to swallow the world it was celebrating. */
  {
    const { VictoryScene } = await import('/src/scenes/cards.js');
    reset({ type: 'leaf', level: 3 });
    let completed = 0;
    const realComplete = game.completeWorld;
    game.completeWorld = () => { completed++; };
    game.pendingNode = { id: 'w1-f', level: '1-F', type: 'fortress' };
    game.finishLevel = Object.getPrototypeOf(game).finishLevel || game.finishLevel;
    game.setScene(new VictoryScene(game, 1, () => game.completeWorld()));
    const shown = game.scene instanceof VictoryScene;
    const i = mkInput();
    for (let f = 0; f < 20; f++) game.scene.update(i);
    const early = completed;
    i.pressed.jump = true;
    game.scene.update(i);
    const afterKey = completed;
    // …and it must also end on its own, for whoever puts the pad down.
    game.setScene(new VictoryScene(game, 1, () => game.completeWorld()));
    for (let f = 0; f < 600; f++) game.scene.update(mkInput());
    expect('the victory card shows, skips on a key and ends by itself',
      shown && early === 0 && afterKey === 1 && completed === 2,
      `alussa ${early}, näppäimellä ${afterKey}, lopuksi ${completed}`);
    game.completeWorld = realComplete;
  }

  /* ------------------------------- attract ----------------------------- */
  {
    const { DemoScene } = await import('/src/scenes/demo.js');
    const key = (code) => {
      dispatchEvent(new KeyboardEvent('keydown', { code }));
      dispatchEvent(new KeyboardEvent('keyup', { code }));
    };
    const storage = () => {
      const all = {};
      for (let i = 0; i < localStorage.length; i++) {
        all[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
      }
      return JSON.stringify(all);
    };
    const toDemo = () => {
      game.toTitle();
      for (let f = 0; f < 1300 && !(game.scene instanceof DemoScene); f++) game.step();
      return game.scene instanceof DemoScene;
    };

    reset();
    game.toTitle();
    let startedAt = -1;
    for (let f = 0; f < 2000 && startedAt < 0; f++) {
      game.step();
      if (game.scene instanceof DemoScene) startedAt = f + 1;
    }
    expect('the title screen starts playing by itself when left alone',
      startedAt > 60 && startedAt <= 1300 && game.scene.level.id === '1-1',
      `${startedAt} framea, ${game.scene.level && game.scene.level.id}`);

    const back = [];
    for (const code of ['KeyZ', 'KeyQ']) {
      if (!toDemo()) { back.push(`${code}:ei esittelyä`); continue; }
      key(code);
      game.step();
      back.push(`${code}:${game.scene.constructor.name}`);
    }
    expect('any key ends the demo within a frame',
      back.every((r) => r.endsWith('TitleScene')), back.join(' '));

    reset();
    const before = storage();
    const lives = game.state.lives;
    const score = game.state.score;
    const started = toDemo();
    let died = false;
    let frames = 0;
    for (; frames < 6000 && game.scene instanceof DemoScene; frames++) {
      game.step();
      game.render();
      if (game.scene instanceof DemoScene && game.scene.level.state === 'dead') died = true;
    }
    expect('the demo survives the bot dying and returns to the title',
      started && died && game.scene.constructor.name === 'TitleScene',
      `${frames} framea, kuoli ${died}, ${game.scene.constructor.name}`);
    expect('the demo writes nothing and spends nothing',
      storage() === before && game.state.lives === lives && game.state.score === score,
      `${lives}/${score} -> ${game.state.lives}/${game.state.score}`);

    if (toDemo()) game.scene.level.update = () => { throw new Error('botti hajosi'); };
    game.step();
    game.render();
    expect('an error inside the demo ends the demo, not the game',
      game.scene.constructor.name === 'TitleScene', game.scene.constructor.name);
    game.toTitle();
  }

  /* ------------------------------- piikit ------------------------------- */
  /* Reported from play: "the player passed on top of the spikes but still took
   * damage". The spikes are drawn in the bottom ten pixels of their tile, but
   * the damage test used the whole sixteen — so six pixels of plain air above
   * the points were just as lethal as the points. */
  {
    const { T, TILE, SPIKE_TOP } = await import('/src/gfx/tiles.js');
    reset({ type: 'shroom', level: 1 });
    const s = new LevelScene(game, '2-1');
    game.setScene(s);

    // Build a spike bed of our own so the test does not depend on level data.
    const ty = 12;
    const tx = Math.floor(s.player.x / TILE) + 4;
    for (let i = 0; i < 4; i++) s.setTile(tx + i, ty, T.SPIKE);

    const tryAt = (feetY) => {
      const p = s.player;
      p.dying = false;
      p.invuln = 0;
      p.frozen = 0;
      p.power = { type: 'shroom', level: 3 };
      p.applySize();
      p.x = (tx + 1) * TILE;
      p.y = feetY - p.h;
      const before = p.powerLevel;
      s.playerTiles();
      return p.powerLevel < before || p.dying;
    };

    const spikeTop = ty * TILE + SPIKE_TOP;
    const clear = tryAt(spikeTop - 1);      // feet one pixel above the points
    const grazed = tryAt(spikeTop + 3);     // feet in among the points
    expect('spikes hurt where the points are and not in the air above them',
      !clear && grazed, `yläpuolella ${clear ? 'sattui' : 'ei sattunut'}, `
      + `piikeissä ${grazed ? 'sattui' : 'ei sattunut'}`);
  }

  /* ------------------------------ supertähti ---------------------------- */
  /* It kills what it touches, and it protects you from enemies and from nothing
   * else. The three "still kills" cases are the whole point of the feature —
   * the lead designer specified them — so each lethal path is asked separately,
   * because each one lives in different code. */
  {
    const { Walker } = await import('/src/entities/enemies.js');
    const { T } = await import('/src/gfx/tiles.js');

    reset({ type: 'shroom', level: 2 });
    const s = new LevelScene(game, '1-1');
    game.setScene(s);
    const i = mkInput();
    for (let f = 0; f < 6; f++) s.update(i);
    s.entities = s.entities.filter((e) => e.kind !== 'enemy');
    const p = s.player;
    p.collect('star');

    const scoreBefore = game.state.score;
    const powerBefore = p.powerLevel;
    const w = new Walker(s, p.x + p.w - 4, p.y + p.h - 16);
    w.active = true; w.alwaysActive = true; w.vx = 0;
    s.entities.push(w);
    s.collisions();
    expect('the star kills the enemy it touches and leaves the player alone',
      (w.dying || w.remove) && !p.dying && p.powerLevel === powerBefore
      && game.state.score > scoreBefore,
      `power ${powerBefore}->${p.powerLevel}, score ${scoreBefore}->${game.state.score}`);

    const survived = [];
    for (const [what, kill] of [
      ['kuoppa', (sc) => { sc.player.y = sc.heightPx + 40; sc.playerTiles(); }],
      ['laava', (sc) => {
        sc.setTile(Math.floor(sc.player.cx / 16), Math.floor(sc.player.cy / 16), T.LAVA);
        sc.playerTiles();
      }],
      ['aika', (sc) => { sc.time = 1; sc.timeSub = 23; sc.updateTimer(); }],
    ]) {
      reset({ type: 'shroom', level: 2 });
      const sc = new LevelScene(game, '1-1');
      game.setScene(sc);
      for (let f = 0; f < 6; f++) sc.update(mkInput());
      sc.player.collect('star');
      kill(sc);
      if (!sc.player.dying) survived.push(what);
    }
    /* Spikes are one of the things in the level that hit you, so the star does
     * cover them — the lead designer asked for exactly that. The level itself
     * still is not covered, which is the line the previous check draws. */
    {
      const { T } = await import('/src/gfx/tiles.js');
      reset({ type: 'shroom', level: 3 });
      const sc = new LevelScene(game, '1-1');
      game.setScene(sc);
      for (let f = 0; f < 6; f++) sc.update(mkInput());
      const p2 = sc.player;
      const tx = Math.floor(p2.cx / 16);
      const ty = Math.floor((p2.y + p2.h) / 16) - 1;
      sc.setTile(tx, ty, T.SPIKE);
      p2.y = ty * 16 + 10 - p2.h;
      const withoutStar = p2.powerLevel;
      sc.playerTiles();
      const hurt = p2.powerLevel < withoutStar;

      reset({ type: 'shroom', level: 3 });
      const sc2 = new LevelScene(game, '1-1');
      game.setScene(sc2);
      for (let f = 0; f < 6; f++) sc2.update(mkInput());
      const p3 = sc2.player;
      p3.collect('star');
      const tx2 = Math.floor(p3.cx / 16);
      const ty2 = Math.floor((p3.y + p3.h) / 16) - 1;
      sc2.setTile(tx2, ty2, T.SPIKE);
      p3.y = ty2 * 16 + 10 - p3.h;
      const before2 = p3.powerLevel;
      sc2.playerTiles();
      expect('the star carries you over ground spikes',
        hurt && p3.powerLevel === before2 && !p3.dying,
        `ilman tähteä ${hurt ? 'sattui' : 'ei sattunut'}, tähdellä `
        + `${p3.powerLevel === before2 ? 'ei sattunut' : 'sattui'}`);
    }

    expect('the star does not save you from the level itself',
      survived.length === 0,
      survived.length ? `selvisi: ${survived.join(', ')}` : 'kuoppa/laava/aika tappavat yhä');
  }

  {
    const { T } = await import('/src/gfx/tiles.js');
    reset({ type: 'shroom', level: 2 });
    const s = new LevelScene(game, '1-1');
    game.pendingNode = WORLDS[0].nodes.find((n) => n.id === 'w1-1');
    game.setScene(s);
    const i = mkInput();
    for (let f = 0; f < 6; f++) s.update(i);
    s.player.collect('star');
    const full = s.player.star;

    const snap = JSON.parse(JSON.stringify(captureState(game)));
    s.player.star = 0;
    restoreState(game, snap);
    const r = game.scene;
    expect('a save state keeps the star running', r.player.star === full,
      `${full} vs ${r.player.star}`);

    let ran = 0;
    while (r.player.star > 0 && ran < 3000) { r.update(i); ran++; }
    expect('the star runs out', r.player.star === 0 && ran < 3000, `${ran} framea`);

    const blocks = [];
    for (const id of levelIds()) {
      const sc = new LevelScene(game, id);
      for (let ty = 0; ty < sc.h; ty++) {
        for (let tx = 0; tx < sc.w; tx++) {
          if (sc.rawTileAt(tx, ty) === T.QSTAR) blocks.push({ id, tx, ty });
        }
      }
    }
    expect('a star block exists in a hand-made level', blocks.length > 0,
      blocks.map((b) => `${b.id} ${b.tx},${b.ty}`).join(' '));
    if (blocks.length) {
      reset();
      const sc = new LevelScene(game, blocks[0].id);
      game.setScene(sc);
      sc.bumpTile(blocks[0].tx, blocks[0].ty, sc.player);
      const item = sc.entities.find((e) => e.kind === 'item');
      expect('a star block yields a star and not a rolled power-up',
        !!item && item.itemKind === 'star', item ? item.itemKind : 'ei mitään');
    }
  }

  /* ----------------------------- kytkinruudut --------------------------- */
  {
    const { T } = await import('/src/gfx/tiles.js');
    reset({ type: 'shroom', level: 1 });
    const s = new LevelScene(game, '3-2');
    game.setScene(s);
    const i = mkInput();

    let button = null;
    let brick = null;
    for (let ty = 0; ty < s.h && !button; ty++) {
      for (let tx = 0; tx < s.w; tx++) if (s.grid[ty][tx] === T.SWITCH) { button = { tx, ty }; break; }
    }
    for (let ty = 0; ty < s.h && !brick; ty++) {
      for (let tx = 0; tx < s.w; tx++) if (s.grid[ty][tx] === T.BRICK) { brick = { tx, ty }; break; }
    }
    expect('3-2 has a switch block and bricks for it to change', !!button && !!brick,
      `${button ? `${button.tx},${button.ty}` : 'ei kytkintä'} / ${brick ? 'tiiliä' : 'ei tiiliä'}`);

    if (button && brick) {
      const solidBefore = s.solidAt(brick.tx, brick.ty);
      s.startSwitch();
      const asCoin = s.tileAt(brick.tx, brick.ty) === T.COIN;
      const passable = !s.solidAt(brick.tx, brick.ty);
      // The stored grid must not have changed — that is the whole design.
      const gridUntouched = s.grid[brick.ty][brick.tx] === T.BRICK;
      expect('a running switch turns bricks into coins without rewriting the grid',
        solidBefore && asCoin && passable && gridUntouched,
        `kiinteä ${solidBefore}, kolikko ${asCoin}, ruudukko ${s.grid[brick.ty][brick.tx]}`);

      // Park the player somewhere harmless and let it run out.
      s.player.x = s.spawn.x;
      s.player.y = s.spawn.y - s.player.h;
      s.player.vy = 0;
      for (let f = 0; f < 40 && s.switchTimer > 0; f++) s.update(i);
      s.switchTimer = 3;
      for (let f = 0; f < 12; f++) s.update(i);
      expect('a switch runs out and the bricks come back',
        s.switchTimer === 0 && s.solidAt(brick.tx, brick.ty), `ajastin ${s.switchTimer}`);

      /* The one way this design could hurt someone is being inside a brick when
       * it comes back. It turns out that cannot happen, and not for the reason
       * the guard in `updateSwitch` assumes: a brick reading as a coin is
       * *collected* the moment the player touches it, which empties that cell
       * of the stored grid for good. There is nothing left to return. The guard
       * stays as defence for any future mapping that is not collectable, but
       * this is the property that actually protects the player, so this is the
       * one worth asserting. */
      s.startSwitch();
      s.player.x = brick.tx * 16 + (16 - s.player.w) / 2;
      s.player.y = brick.ty * 16;
      s.player.vy = 0;
      s.update(i);
      const collected = s.grid[brick.ty][brick.tx] === T.EMPTY;
      s.switchTimer = 2;
      for (let f = 0; f < 20; f++) {
        s.player.x = brick.tx * 16 + (16 - s.player.w) / 2;
        s.player.y = brick.ty * 16;
        s.player.vy = 0;
        s.update(i);
      }
      expect('a switched brick is collected, so nothing can come back on top of you',
        collected && s.switchTimer === 0 && !s.solidAt(brick.tx, brick.ty)
        && !s.player.dying,
        `kerätty ${collected}, ajastin ${s.switchTimer}, `
        + `kiinteä ${s.solidAt(brick.tx, brick.ty)}`);

      // Bumping the block is what starts it, and it only works once.
      const s2 = new LevelScene(game, '3-2');
      game.setScene(s2);
      s2.bumpTile(button.tx, button.ty, s2.player);
      const started = s2.switchTimer > 0;
      const spent = s2.grid[button.ty][button.tx] === T.USED;
      expect('hitting the block starts the switch and spends the block',
        started && spent, `ajastin ${s2.switchTimer}, ruutu ${s2.grid[button.ty][button.tx]}`);

      // And a save state has to carry it, or a reload silently changes the level.
      game.pendingNode = WORLDS[2].nodes.find((n) => n.level === '3-2') || game.pendingNode;
      const snap = JSON.parse(JSON.stringify(captureState(game)));
      s2.switchTimer = 0;
      restoreState(game, snap);
      expect('a save state remembers a running switch',
        game.scene.switchTimer > 0, `${game.scene.switchTimer}`);
    }
  }

  /* -------------------------- murenevat lavat -------------------------- */
  {
    const { T } = await import('/src/gfx/tiles.js');
    reset({ type: 'shroom', level: 1 });
    const s = new LevelScene(game, '4-1');
    game.setScene(s);
    const i = mkInput();

    // Find a crumbling tile and stand the player on it.
    let spot = null;
    for (let ty = 0; ty < s.h && !spot; ty++) {
      for (let tx = 0; tx < s.w; tx++) if (s.grid[ty][tx] === T.CRUMBLE) { spot = { tx, ty }; break; }
    }
    expect('4-1 has a crumbling catwalk in it', !!spot, spot ? `${spot.tx},${spot.ty}` : 'ei löytynyt');

    if (spot) {
      s.player.x = spot.tx * 16 + 2;
      s.player.y = spot.ty * 16 - s.player.h;
      s.player.vy = 0;
      for (let f = 0; f < 3; f++) s.update(i);
      const heldAtFirst = s.tileAt(spot.tx, spot.ty) === T.CRUMBLE;
      const started = s.crumbleProgress(spot.tx, spot.ty) > 0;

      // It has to hold long enough to walk across…
      for (let f = 0; f < 40; f++) s.update(i);
      const stillThere = s.tileAt(spot.tx, spot.ty) === T.CRUMBLE;

      /* …and then go, whether or not anyone is still standing there. Step off
       * first: the pit under this catwalk is bottomless, and a dead scene stops
       * updating after the death animation, so staying would only prove that. */
      s.player.x = s.spawn.x;
      s.player.y = s.spawn.y - s.player.h;
      s.player.vy = 0;
      for (let f = 0; f < 40; f++) s.update(i);
      const gone = s.tileAt(spot.tx, spot.ty) === T.EMPTY;
      expect('a crumbling platform holds, warns, then drops out',
        heldAtFirst && started && stillThere && gone,
        `heti ${heldAtFirst}, ajastin ${started}, 40 framea ${stillThere}, 80 framea poissa ${gone}`);

      /* It must come back. Dying halfway across a row of these would otherwise
       * leave the level impassable for the rest of the attempt, with nothing on
       * screen to explain why. */
      for (let f = 0; f < 260; f++) s.update(i);
      expect('a crumbling platform grows back',
        s.tileAt(spot.tx, spot.ty) === T.CRUMBLE, s.tileAt(spot.tx, spot.ty));

      // And the save state has to carry the timers, like it does for bumps.
      const s2 = new LevelScene(game, '4-1');
      game.pendingNode = WORLDS[3].nodes.find((n) => n.level === '4-1') || game.pendingNode;
      game.setScene(s2);
      s2.player.x = spot.tx * 16 + 2;
      s2.player.y = spot.ty * 16 - s2.player.h;
      for (let f = 0; f < 8; f++) s2.update(i);
      const snap = JSON.parse(JSON.stringify(captureState(game)));
      const before = s2.crumbles.size;
      restoreState(game, snap);
      expect('a save state remembers which platforms are already crumbling',
        before > 0 && game.scene.crumbles.size === before,
        `${before} -> ${game.scene.crumbles.size}`);
    }
  }

  /* --------------------------- kosketusohjaus -------------------------- */
  {
    const { Input } = await import('/src/core/input.js');
    const { LAYOUTS } = await import('/src/core/touch.js');
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

    /* The rolling layout: the fart pad is a field low and right where the flat
     * of the thumb rests, and the jump button sits *inside* it, up and left
     * where the tip reaches. One finger is one point to every touchscreen ever
     * built, so the only way one thumb can hold two buttons is for the two
     * rectangles to overlap. That containment is the whole mechanism, so it is
     * asserted directly rather than through the pixels it happens to have. */
    touch.setLayout('rulla');
    letGo();
    expect('the old layouts are still on offer',
      LAYOUTS.includes('napit') && LAYOUTS.includes('peukalot'), LAYOUTS.join(','));
    expect('the rolling layout keeps the d-pad', rect('left').width > 0, `${rect('left').width}`);

    const runPad = rect('run');
    const jumpPad = rect('jump');
    expect('the jump button lies wholly inside the fart pad, above and left of the thumb rest',
      jumpPad.left >= runPad.left && jumpPad.right <= runPad.right
      && jumpPad.top >= runPad.top && jumpPad.bottom <= runPad.bottom
      && jumpPad.left > runPad.left && jumpPad.bottom < runPad.bottom,
      `pieru ${Math.round(runPad.left)},${Math.round(runPad.top)} ${Math.round(runPad.width)}x${Math.round(runPad.height)}`
      + ` hyppy ${Math.round(jumpPad.left)},${Math.round(jumpPad.top)} ${Math.round(jumpPad.width)}x${Math.round(jumpPad.height)}`);

    /* This is the bug the owner reported, written as a gesture: rest the thumb
     * on the fart pad, roll the tip up onto jump, roll back. Run must never let
     * go — a jump that drops the run bit is a short jump, and short jumps miss
     * gaps that were measured for long ones. */
    letGo();
    const rest = [runPad.right - 18, runPad.bottom - 18];
    send('pointerdown', 20, ...rest);
    const resting = held();
    send('pointermove', 20, ...at('jump'));
    const rolledUp = held();
    send('pointermove', 20, ...rest);
    const rolledBack = held();
    send('pointerup', 20, ...rest);
    const lifted = held();
    expect('one thumb holds the fart button down and still reaches jump',
      resting === 'run' && rolledUp === 'jump,run' && rolledBack === 'run' && lifted === '',
      `lepo "${resting}" ylös "${rolledUp}" alas "${rolledBack}" irti "${lifted}"`);

    // Steering with the other hand has to keep working through all of it.
    letGo();
    send('pointerdown', 21, ...at('right'));
    send('pointerdown', 22, ...at('jump'));
    const runJumpRight = held();
    for (const id of [21, 22]) send('pointerup', id, 0, 0);
    expect('the rolling layout still runs, jumps and steers at once',
      runJumpRight === 'jump,right,run', `"${runJumpRight}"`);

    expect('the rolling layout is remembered too', touch.loadLayout() === 'rulla', touch.loadLayout());

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

  /* --------------------- selaimen zoom mobiiliselaimessa --------------------- */
  /*
   * Two halves of one bug. Double-tapping beside the canvas zooms the page in,
   * and the full-screen control overlay then swallows the pinch that would
   * take it back out. `user-scalable=no` does not help: iOS Safari has ignored
   * it since iOS 10, and on Android it makes the trap worse by disabling the
   * way back out.
   */
  {
    const touch = game.touch;
    const root = document.getElementById('touch');
    const meta = document.querySelector('meta[name="viewport"]').content;

    touch.setZoomed?.(false);
    expect('nothing in the viewport meta can lock a player out of zooming back out',
      !/user-scalable\s*=\s*(no|0)/i.test(meta) && !/maximum-scale/i.test(meta), meta);

    expect('the double tap is killed by touch-action on the root element',
      getComputedStyle(document.documentElement).touchAction === 'manipulation',
      getComputedStyle(document.documentElement).touchAction);

    const playing = getComputedStyle(root).touchAction;
    touch.setZoomed?.(true);
    const zoomedRoot = getComputedStyle(document.documentElement).touchAction;
    const zoomedOverlay = getComputedStyle(root).touchAction;
    touch.setZoomed?.(false);
    expect('the overlay eats browser gestures while playing and gives them back while zoomed',
      playing === 'none' && zoomedOverlay === 'auto' && zoomedRoot === 'auto',
      `pelatessa "${playing}", zoomattuna juuri "${zoomedRoot}" / peite "${zoomedOverlay}"`);

    /* The belt to that pair of braces: swallow the second tap ourselves. It has
     * to stay off the controls — the toolbar is ordinary DOM and needs the
     * synthetic click that preventDefault would eat. */
    const tap = (target, x, y) => {
      const t = new window.Touch({ identifier: 1, target, clientX: x, clientY: y });
      const ev = new TouchEvent('touchend', {
        bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [t],
      });
      target.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    const first = tap(document.body, 40, 40);
    const second = tap(document.body, 42, 41);
    const tool = root.querySelector('.tool');
    const onTool = tap(tool, 4, 4) || tap(tool, 4, 4);
    expect('a double tap beside the game is swallowed, and the controls are not',
      first === false && second === true && onTool === false,
      `1. "${first}" 2. "${second}" työkalu "${onTool}"`);
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

    /* Per-level atmosphere comes from the level's theme, and nothing else must
     * be able to set it — a shimmer on the world map would just be a bug. */
    {
      const { THEME_AMBIENCE } = await import('/src/gfx/postfx.js');
      const { getLevel, levelIds } = await import('/src/data/levels.js');
      const seen = new Set(levelIds().map((id) => THEME_AMBIENCE[getLevel(id).theme] || null));
      expect('the desert shimmers and the ice world frosts over',
        THEME_AMBIENCE.desert === 'heat' && THEME_AMBIENCE.ice === 'frost'
        && seen.has('heat') && seen.has('frost') && seen.has(null),
        [...seen].join(','));

      reset();
      const desert = new LevelScene(game, '2-1');
      game.setScene(desert);
      const inDesert = game.fx.ambience;
      game.toWorldMap();
      const onMap = game.fx.ambience;
      expect('atmosphere follows the scene and clears when you leave',
        inDesert === 'heat' && onMap === null, `${inDesert} -> ${onMap}`);
    }

    /* The HUD is not air and not a window. Heat used to wobble the timer and
     * frost used to grow over the score, which is the kind of atmosphere that
     * makes a game harder to read rather than better to look at. */
    {
      const fx = makeFX();
      const c = testCanvas();
      fx.init(c);
      fx.setPreset('hehku');
      const g = c.getContext('2d');
      const hudRow = (canvas) => {
        const d = canvas.getContext('2d').getImageData(0, 232, 320, 1).data;
        return [...d].join(',');
      };
      // Force the Canvas 2D path: that is where the atmosphere is drawn by
      // hand, and where getting the vertical direction wrong is easy.
      fx.mode = '2d';
      const shot = (theme) => {
        const t = testCanvas();
        const tg = t.getContext('2d');
        // Mark the HUD strip so any distortion of it shows as a difference.
        tg.fillStyle = '#000000';
        tg.fillRect(0, 208, 320, 32);
        tg.fillStyle = '#ffffff';
        for (let x = 0; x < 320; x += 7) tg.fillRect(x, 230, 3, 5);
        fx.source = t;
        fx.setAmbience(theme);
        fx.tick = 40;
        fx.apply(tg);
        return hudRow(t);
      };
      // The baseline has the same bloom, so only the atmosphere can differ.
      const plain = shot(null);
      const results = ['desert', 'ice'].map((theme) => ({
        theme, same: shot(theme) === plain,
      }));
      expect('atmosphere never touches the HUD strip',
        results.every((r) => r.same),
        results.map((r) => `${r.theme}:${r.same ? 'ok' : 'muuttui'}`).join(' '));
      fx.setAmbience(null);
    }

    // And whatever the live game ended up with, it has to be a working mode.
    expect('the running game has a valid effect mode',
      ['webgl', '2d'].includes(game.fx.mode) && PRESETS.includes(game.fx.preset),
      `${game.fx.mode} / ${game.fx.preset}`);
    game.fx.setPreset('hehku');
  }

  /* ------------------------ kuvasuhde ja valokeila --------------------- */
  {
    const { VIEW_W, VIEW_H, HUD_H } = await import('/src/scenes/level.js');
    const { PostFX } = await import('/src/gfx/postfx.js');
    const { T, TILE } = await import('/src/gfx/tiles.js');

    // A fresh instance per case, as in the kuvaefektit block above: the live
    // PostFX is attached to the real canvas and must not be re-initialised.
    const makeFX = () => Object.create(PostFX);
    const shot = () => {
      const c = document.createElement('canvas');
      c.width = VIEW_W;
      c.height = VIEW_H + HUD_H;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#000';
      g.fillRect(0, 0, c.width, c.height);
      return { c, g };
    };
    const data = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const at = (x, y) => 4 * (y * VIEW_W + x);
    const luma = (d, i) => (d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8;
    const rowBlack = (d, y) => {
      for (let x = 0; x < VIEW_W; x++) {
        const i = at(x, y);
        if (d[i] || d[i + 1] || d[i + 2]) return false;
      }
      return true;
    };
    const strip = (d, y0, y1) => [...d.slice(at(0, y0), at(0, y1))].join(',');

    /* Cinemascope is a crop, not a mask: if the camera's vertical range does not
     * narrow with the bars, the level is showing the same picture with a slice
     * painted out — which takes away the part you were reading and adds nothing. */
    reset();
    const wide = new LevelScene(game, '2-1');
    expect('2-1 and 2-3 are letterboxed and world 1 is not',
      wide.bar === 24 && wide.viewH === 160
      && new LevelScene(game, '2-3').bar === 24
      && new LevelScene(game, '1-1').bar === 0
      && new LevelScene(game, '1-1').viewH === VIEW_H,
      `2-1 bar ${wide.bar}, viewH ${wide.viewH}`);

    {
      const input = mkInput();
      let hi = -Infinity;
      let escaped = 0;
      for (let f = 0; f < 900; f++) {
        input.held.right = true;
        input.held.run = true;
        input.pressed.jump = f % 47 === 0;
        input.held.jump = f % 47 < 12;
        input.held.down = f % 137 < 20;          // crouching must not break it either
        wide.update(input);
        hi = Math.max(hi, wide.cam.y);
        if (wide.cam.y < -0.001 || wide.cam.y + wide.viewH > wide.heightPx + 0.001) escaped++;
      }
      expect('the letterbox camera stays inside the narrowed band, and the crop is real',
        escaped === 0 && hi > wide.heightPx - VIEW_H,
        `${escaped} frames outside, max cam.y ${hi.toFixed(1)} `
        + `vs full-height limit ${wide.heightPx - VIEW_H}`);
    }

    /* The bars belong to the playfield. A widescreen score readout is just a
     * score readout with a slice missing. */
    {
      reset();
      const s = new LevelScene(game, '2-1');
      const a = shot();
      s.draw(a.g);
      const d = data(a.c);
      let bars = true;
      for (let y = 0; y < s.bar; y++) if (!rowBlack(d, y)) bars = false;
      for (let y = VIEW_H - s.bar; y < VIEW_H; y++) if (!rowBlack(d, y)) bars = false;
      const reaches = !rowBlack(d, s.bar) && !rowBlack(d, VIEW_H - s.bar - 1);

      const s2 = new LevelScene(game, '2-1');
      s2.bar = 0;
      s2.viewH = VIEW_H;
      const b = shot();
      s2.draw(b.g);
      expect('the bars sit in the playfield only and leave the HUD alone',
        bars && reaches && strip(d, VIEW_H, VIEW_H + HUD_H)
          === strip(data(b.c), VIEW_H, VIEW_H + HUD_H),
        `bars ${bars}, picture at both band edges ${reaches}`);
    }

    /* A narrower window must still hold the highest jump in the game — 100 px,
     * measured. Standing on the desert floor the head sits 102 px below the top
     * of the band, so the apex fits before the camera even follows it up. */
    {
      reset();
      game.state.power = { type: 'shroom', level: 3 };
      let worst = Infinity;
      let ground = 0;
      for (const id of ['2-1', '2-3']) {
        const s = new LevelScene(game, id);
        const input = mkInput();
        for (let f = 0; f < 900; f++) {
          input.held.right = true;
          input.held.run = true;
          input.pressed.jump = f % 53 === 0;
          input.held.jump = f % 53 < 34;
          s.update(input);
          if (s.player.dying) continue;
          const head = s.player.y - s.cam.y;
          worst = Math.min(worst, head);
          if (s.player.onGround) ground = Math.max(ground, head);
        }
      }
      expect('the highest jump still fits inside the letterbox band',
        worst >= -0.5 && ground >= 90,
        `head rests ${ground.toFixed(1)} px below the band top, jumps to ${worst.toFixed(1)}`);
    }

    /*
     * Red before green (DESIGN.md §7) for the owner's report: "the ground
     * disappears from view pretty often when jumping".
     *
     * The measurement is the complaint, stated as a number: over a run of
     * ordinary running jumps, on how many airborne frames is the tile the
     * player took off from — the one they are about to land back on — still
     * inside the window? Before the camera anchor it was **58.4 %** in 2-1 at
     * power level 0 and 58.8 % at level 3, with the tile as much as 42 px past
     * the bottom edge. In 1-1, where the window is 208 rows and the camera has
     * only 32 px of travel, it was already 100 %, which is why this only ever
     * showed up in the letterboxed desert.
     *
     * It is asserted at 100 % and not at "better than before": the rule is that
     * the view does not follow a jump upward at all, so there is no arc that
     * can take the ground with it, and any frame that fails is the rule being
     * broken rather than a threshold being missed.
     */
    {
      const rows = [];
      for (const [id, power] of [['2-1', { type: null, level: 0 }],
        ['2-1', { type: 'shroom', level: 3 }], ['1-1', { type: 'shroom', level: 3 }]]) {
        reset(power);
        const s = new LevelScene(game, id);
        s.entities = s.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
        s.time = 9999;
        const input = mkInput();
        let air = 0;
        let seen = 0;
        let rise = 0;
        let takeoff = null;
        for (let f = 0; f < 1200; f++) {
          input.held = blank();
          input.pressed = blank();
          input.held.right = true;
          input.held.run = true;
          const phase = f % 60;
          if (phase === 40 && s.player.onGround) { input.pressed.jump = true; input.held.jump = true; }
          else if (phase > 40 && phase < 74) input.held.jump = true;
          const wasGround = s.player.onGround;
          const camBefore = s.cam.y;
          s.update(input);
          const p = s.player;
          if (p.dying) break;
          if (wasGround && !p.onGround) takeoff = p.y + p.h;
          if (!p.onGround && takeoff !== null) {
            air++;
            if (takeoff < s.cam.y + s.viewH) seen++;
            // How far the view climbed on a single airborne frame.
            rise = Math.max(rise, camBefore - s.cam.y);
          }
          if (p.onGround) takeoff = null;
        }
        rows.push({ id, level: power.level, air, seen, rise });
      }
      expect('the ground you jumped off stays on screen for the whole jump',
        rows.every((r) => r.air > 200 && r.seen === r.air),
        rows.map((r) => `${r.id} taso ${r.level}: ${r.seen}/${r.air} framea`).join(', '));
      /* And the mechanism, not just its effect: the view may rise a little near
       * the apex to keep the head in frame (CAM_TOP_MARGIN), and it must never
       * ride the arc. A jump lifts the body ~5 px on its fastest frame. */
      expect('the view does not ride a jump upward',
        rows.every((r) => r.rise < 2),
        rows.map((r) => `${r.id} ${r.rise.toFixed(2)} px/frame`).join(', '));
    }

    /* `applySize()` pins the bottom of the body and changes its height, so
     * ducking used to shove `p.y` down 13 px in one frame and the camera went
     * with it — a jolt with no cue, because the backdrop has no vertical
     * parallax to move with it. The vertical camera hangs off the feet now. */
    {
      reset();
      game.state.power = { type: 'shroom', level: 3 };
      const results = [];
      for (const id of ['1-1', '1-2', '1-3', '2-2']) {
        const s = new LevelScene(game, id);
        let spot = null;
        for (let tx = 4; tx < s.w && !spot; tx++) {
          for (let ty = 3; ty < s.h; ty++) {
            if (s.rawTileAt(tx, ty) === T.PIPE_TL) { spot = { tx, ty }; break; }
          }
        }
        if (!spot) continue;
        s.player.x = spot.tx * TILE + 4;
        s.player.y = spot.ty * TILE - s.player.h;
        s.player.vy = 0;
        s.player.onGround = true;
        s.centerCamera();
        const input = mkInput();
        for (let f = 0; f < 60; f++) s.update(input);
        const camBefore = s.cam.y;
        const yBefore = s.player.y;
        input.held.down = true;
        s.update(input);
        results.push({
          id, jump: Math.abs(s.cam.y - camBefore), body: Math.abs(s.player.y - yBefore),
          ducked: s.player.ducking,
        });
      }
      const worst = results.reduce((a, b) => (b.jump > a.jump ? b : a));
      expect('crouching on a pipe does not jolt the camera',
        results.length >= 3 && results.every((r) => r.ducked && r.body > 8 && r.jump < 0.5),
        `body moves ${worst.body} px, camera moves ${worst.jump.toFixed(2)} px (${worst.id})`);

      // …and anchoring to the feet must not re-frame ordinary play.
      const s = new LevelScene(game, '1-3');
      s.player.power = { type: 'shroom', level: 1 };
      s.player.applySize();
      const old = Math.max(0, Math.min(s.player.y - s.viewH * 0.55, s.heightPx - s.viewH));
      expect('a standing mushroom-sized player is framed exactly as before',
        Math.abs(s.cameraY() - old) < 0.001, `${s.cameraY().toFixed(2)} vs ${old.toFixed(2)}`);
    }

    /* Vertical easing is fine; a camera that watches a fall from behind is not.
     * What matters is how much ground is still visible under the feet. */
    {
      reset();
      const rows = [];
      for (const id of ['1-1', '1-3', '2-1', '1-2']) {
        const s = new LevelScene(game, id);
        const input = mkInput();
        s.player.y -= 120;
        s.player.onGround = false;
        let lag = 0;
        let below = Infinity;
        for (let f = 0; f < 240; f++) {
          s.update(input);
          lag = Math.max(lag, Math.abs(s.cam.y - s.cameraY()));
          below = Math.min(below, s.cam.y + s.viewH - (s.player.y + s.player.h));
          if (s.player.onGround && f > 40) break;
        }
        rows.push({ id, lag, below });
      }
      expect('a fall keeps the landing point on screen',
        rows.every((r) => r.below > 24 && r.lag <= 28),
        rows.map((r) => `${r.id} ${r.below.toFixed(0)}px alla / ${r.lag.toFixed(0)}px jäljessä`).join(' '));
    }

    /* ---------------------------- vihainen aurinko ---------------------- */
    /*
     * The sun is the one enemy that positions itself against the camera, which
     * makes it the one the letterbox can break: `viewH` is 160 in 2-1 and 208
     * in 2-2, so a sun that aims at the uncropped height aims at 48 px the
     * player never sees. Both levels are measured, because the same enemy in
     * the two framings is the only A/B this game has for the crop.
     *
     * What this caught: `skyY = Math.min(skyY, cam.y + 18)` is a ratchet. It
     * could only ever raise the sun, so the first descent left it above the
     * frame for the rest of the level — 0 of 390 hunting frames on screen in
     * 2-1, and clipped through the top edge on every bob in 2-2.
     */
    /* The wait between dives is the one random number in the sun, and a gate
     * that measures a retreat cannot afford to sample a different dive on every
     * run. Seeded for this block and put back at the end of it. */
    const realRandom = Math.random;
    let sunSeed = 20260809;
    Math.random = () => {
      sunSeed = (sunSeed * 1103515245 + 12345) & 0x7fffffff;
      return sunSeed / 0x7fffffff;
    };

    const sunRun = (id, place, frames = 420, walk = false) => {
      // Power 3, because the bot is standing under a thing that dives at it and
      // a level-0 death would end the sample after the first hit — this block
      // is measuring where the sun is, not how long the bot lives.
      reset({ type: 'leaf', level: 3 });
      const s = new LevelScene(game, id);
      const sun = s.entities.find((e) => e.constructor.name === 'AngrySun');
      const input = mkInput();
      const out = {
        id, sun, scene: s, hunting: 0, seen: 0, hover: 0, whole: 0, dives: 0,
        wind: 0, windAtDive: -1, quitAt: -1, gone: -1, quitY: 0, endY: 0, ran: 0,
        low: -Infinity, after: 0,
      };
      if (!sun) return out;
      place(s, sun);
      s.centerCamera();
      let prevY = sun.y;
      let prevPhase = sun.phase;
      for (let f = 0; f < frames; f++) {
        // A cleared level keeps updating its entities, and that is the point:
        // the retreat is meant to be watched while the flag animation plays.
        if (s.state === 'dead') break;
        /* Jumping on the spot is the harder case and the deliberate one: a jump
         * swings the vertical camera through its whole range and back, which is
         * exactly the pan the old `Math.min` could only follow in one
         * direction. Walking is for the runs that have to reach the flag. */
        input.held.right = walk;
        input.held.run = walk;
        input.pressed.jump = f % 41 === 0;
        input.held.jump = f % 41 < 14;
        s.update(input);
        if (f < 30) { prevY = sun.y; continue; }   // the drop and the camera settle
        const top = sun.y - s.cam.y;
        if (sun.quit) {
          if (out.quitAt < 0) { out.quitAt = f; out.quitY = sun.y; }
          if (out.gone < 0 && top + sun.h < 0) out.gone = f;
        } else {
          out.hunting++;
          if (top + sun.h > 0 && top < s.viewH) out.seen++;
          if (sun.phase === 'hover') {
            out.hover++;
            if (top >= 0 && top + sun.h <= s.viewH) out.whole++;
          }
        }
        if (sun.phase === 'dive' && prevPhase === 'hover') {
          out.dives++;
          if (out.quitAt >= 0) out.after++;
          out.windAtDive = out.wind;
          out.wind = 0;
        } else if (sun.windUp > 0) {
          out.wind++;
        }
        out.low = Math.max(out.low, sun.y + sun.h);
        out.endY = sun.y;
        out.ran = f;
        prevPhase = sun.phase;
        prevY = sun.y;
      }
      return out;
    };
    /* Walk it in under the sun: the level puts it five chunks in, and the spawn
     * row is the one band the ground route runs along. */
    const underSun = (s, sun) => {
      s.player.x = sun.x;
      s.player.y = s.spawn.y;
      s.player.vy = 0;
    };

    {
      const runs = ['2-1', '2-2'].map((id) => sunRun(id, underSun));
      expect('vihainen aurinko pysyy näkyvässä kaistassa myös laajakuvassa',
        runs.every((r) => r.hunting > 200 && r.seen === r.hunting && r.whole === r.hover),
        runs.map((r) => `${r.id} viewH ${r.scene.viewH}: ruudulla ${r.seen}/${r.hunting}, `
          + `kokonaan ${r.whole}/${r.hover}`).join(' | '));

      /* The dive is telegraphed. Both halves in the same beat (DESIGN.md §8),
       * and the warning is taken out of the wait rather than added to it: the
       * launch frame does not move, so the fight is no harder than it was. */
      expect('sukellusta edeltää puolen sekunnin ennakkovaroitus, eikä se siirrä lähtöä',
        runs.every((r) => r.dives >= 1 && r.windAtDive === 34)
        && runs.every((r) => r.low < r.scene.cam.y + r.scene.viewH + 40),
        runs.map((r) => `${r.id} ${r.dives} sukellusta, varoitus ${r.windAtDive} framea`).join(' | '));
    }

    /*
     * Most persistent enemies give up before the flag, and the sun is the game's
     * only one that follows you the whole way. It has to be *seen* leaving —
     * that is the reward for surviving it — so the retreat is a climb out of
     * frame and not a switch, and it is measured as one.
     */
    {
      const flag = sunRun('2-1', (s, sun) => {
        // Far enough out that it is genuinely hunting when the flag arrives.
        s.player.x = s.goal.x - 900;
        s.player.y = s.spawn.y;
        s.player.vy = 0;
        sun.x = s.player.x - 84;
      }, 700, true);
      const climb = flag.quitY - flag.endY;
      /* Nine tenths and not all of them: this run walks the level, and a dive
       * is a fixed arc that does **not** chase the camera. Descend a staircase
       * mid-dive and the tail of the arc is briefly above the frame — the
       * alternative is a dive that follows you down, which is a harder fight,
       * and the wind-up is a promise about where the thing is coming from. */
      expect('aurinko luovuttaa lipun näkyessä ja nousee näkyvästi pois',
        flag.hunting > 100 && flag.seen > flag.hunting * 0.9
        && flag.quitAt > 0 && flag.sun.quit === 'flag' && flag.after === 0
        // Out of the top of the frame, and by climbing there: a cut would be a
        // bug wearing the same end state, so the travel is measured too.
        && flag.gone > 0 && flag.gone - flag.quitAt < 120
        && flag.ran - flag.quitAt > 60 && climb > 40,
        `jahtasi ${flag.hunting} framea (${flag.seen} ruudulla), luovutti framella `
        + `${flag.quitAt}, poissa framella ${flag.gone}, nousi ${climb.toFixed(0)} px, `
        + `sukelluksia luovutuksen jälkeen ${flag.after}`);
    }

    /*
     * And it is the *sky's*. A tall level is sky / route / cave; following the
     * camera down a warp pipe would park an unkillable, unavoidable thing
     * inside a sealed room. No desert level has a pipe today — the tall ones
     * are worlds 1-4's secrets — so this is unreachable in the shipped game and
     * built anyway: containment that depends on nobody adding a pipe is a trap
     * for whoever adds one. 2-2 is tall, so it can be asked directly.
     */
    {
      reset();
      const s = new LevelScene(game, '2-2');
      const sun = s.entities.find((e) => e.constructor.name === 'AngrySun');
      const input = mkInput();
      const span = s.def.bands.rows * TILE;
      const cave = 2 * span;
      // Into the sealed tomb room under column 224, where the warp pipe lands,
      // with the sun overhead and awake — it wakes with the camera, and the
      // level puts it eleven chunks earlier.
      s.player.x = 230 * TILE;
      s.player.y = cave + 10 * TILE;
      s.player.vy = 0;
      sun.x = s.player.x - 84;
      sun.active = true;
      s.centerCamera();
      let deepest = -Infinity;
      for (let f = 0; f < 240; f++) s.update(input), deepest = Math.max(deepest, sun.y + sun.h);
      const left = sun.quit === 'band' && sun.y + sun.h <= span && deepest < cave;
      // …and it comes back when the player does.
      s.player.x = sun.x;
      s.player.y = s.spawn.y;
      s.player.vy = 0;
      s.centerCamera();
      let back = -1;
      for (let f = 0; f < 240; f++) {
        s.update(input);
        const top = sun.y - s.cam.y;
        if (back < 0 && !sun.quit && top >= 0 && top + sun.h <= s.viewH) back = f;
      }
      expect('aurinko ei seuraa maan alle vaan odottaa oman kaistansa yllä',
        left && back >= 0 && back < 120,
        `luovutus ${sun.quit || 'ei'}, alin ${Math.round(deepest)} vs luola ${cave}, `
        + `paluu framella ${back}`);
    }
    Math.random = realRandom;

    /* The lamp. It is an ambience like the heat and the frost, so it has to work
     * on a machine with no WebGL — and it must never be the reason a hazard is
     * invisible, which is the one thing this game does not do. */
    {
      reset();
      const night = new LevelScene(game, '2-N');
      game.setScene(night);
      const on = game.fx.ambience;
      game.toWorldMap();
      expect('2-N is lit by a lamp, and leaving the level puts it out',
        on === 'spotlight' && game.fx.ambience === null, `${on} -> ${game.fx.ambience}`);
    }

    const realGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, opts) {
      if (String(type).startsWith('webgl')) return null;
      return realGet.call(this, type, opts);
    };
    try {
      reset();
      const s = new LevelScene(game, '2-N');
      const a = shot();
      s.draw(a.g);
      const fx = makeFX();
      fx.init(a.c);
      fx.source = a.c;
      fx.setPreset('hehku');
      fx.setAmbience('night', s.def);
      const focus = { ...PostFX.focus };       // the scene pushed it while drawing
      fx.setFocus(focus.x, focus.y);
      const before = data(a.c).slice();
      fx.apply(a.g);
      const after = data(a.c);

      const near = at(Math.round(focus.x), Math.round(focus.y) - 40);
      const far = at(focus.x > VIEW_W / 2 ? 4 : VIEW_W - 5, 40);
      const keptNear = luma(after, near) / Math.max(1, luma(before, near));
      const keptFar = luma(after, far) / Math.max(1, luma(before, far));
      expect('without WebGL the lamp still lights the player and darkens the distance',
        fx.mode === '2d' && keptNear > 0.95 && keptFar < 0.45,
        `mode ${fx.mode}, lähellä ${keptNear.toFixed(2)}, kaukana ${keptFar.toFixed(2)}`);
      expect('the lamp never touches the HUD strip',
        strip(before, VIEW_H, VIEW_H + HUD_H) === strip(after, VIEW_H, VIEW_H + HUD_H));

      /* Darkness may hide the route and the rewards. It may not hide a spike:
       * a hazard you can only learn by dying is the one thing this game is not
       * supposed to have. Measured at the darkest a hazard can legitimately get
       * — the far side of the view, with the CRT vignette dimming it again. */
      const spikes = [];
      for (let ty = 0; ty < s.h; ty++) {
        for (let tx = 0; tx < s.w; tx++) {
          if (s.rawTileAt(tx, ty) === T.SPIKE) spikes.push({ tx, ty });
        }
      }
      let worst = null;
      for (const sp of spikes) {
        const s2 = new LevelScene(game, '2-N');
        s2.player.y = sp.ty * TILE;
        s2.centerCamera();
        const sx = 300;
        s2.cam.x = sp.tx * TILE - sx;
        if (s2.cam.x < 0 || s2.cam.x > s2.widthPx - VIEW_W) continue;
        const sy = sp.ty * TILE - Math.round(s2.cam.y);
        if (sy < 0 || sy + TILE > VIEW_H) continue;
        const b = shot();
        s2.draw(b.g);
        // The dead zone and the look-ahead keep the player between screen x 126
        // and 194, so 194 px is as far as a hazard can get from the light.
        fx.source = b.c;
        fx.setPreset('crt');
        fx.setAmbience('night', s2.def);
        fx.setFocus(sx + TILE / 2 - 194, sy + 8);
        fx.apply(b.g);
        const d2 = data(b.c);
        let tip = 0;
        let air = 0;
        let n = 0;
        for (let y = sy + 6; y < sy + TILE; y++) {
          for (let x = sx; x < sx + TILE; x++) tip = Math.max(tip, luma(d2, at(x, y)));
        }
        for (let y = sy - 10; y < sy + 5; y++) {
          for (let x = sx; x < sx + TILE; x++) { air += luma(d2, at(x, y)); n++; }
        }
        const gap = tip - air / Math.max(1, n);
        if (!worst || gap < worst.gap) worst = { gap, tx: sp.tx, ty: sp.ty };
      }
      expect('a lethal tile outside the beam is still readable',
        worst && worst.gap >= 20,
        worst ? `piikit erottuvat ${worst.gap.toFixed(1)} luminanssia taustasta`
          : 'no spike tile could be placed');
      fx.setPreset('hehku');
    } finally {
      HTMLCanvasElement.prototype.getContext = realGet;
    }

    /* A GLSL error is silent — `_initGL` returns false and the game falls back
     * to Canvas 2D forever. So the shader is compiled and run on purpose. */
    {
      const probe = document.createElement('canvas').getContext('webgl2')
        || document.createElement('canvas').getContext('webgl');
      const gfx = makeFX();
      const a = shot();
      gfx.init(a.c);
      gfx.setAmbience('night', { spotlight: true });
      gfx.setFocus(100, 100);
      let presented = false;
      try { presented = gfx.present(); } catch { presented = false; }
      expect('the spotlight shader compiles and runs where there is a GPU',
        !probe || (gfx.mode === 'webgl' && presented
          && gfx._uniforms.dark && gfx._uniforms.focus),
        probe ? `mode ${gfx.mode}, present ${presented}` : 'ei WebGL:ää — ohitettu');
      if (gfx.displayCanvas) gfx.displayCanvas.remove();
    }

    game.fx.setAmbience(null);
  }

  /* -------------------------------- audio ------------------------------ */
  const { Sfx, Music, audioTap } = await import('/src/core/audio.js');

  /* The vocals are synthesised through two narrow bandpass filters, so their
   * `gain` argument is applied to whatever survives the filters — it never
   * meant what it said. Measured, a nominal 0.44 came out at a third the
   * loudness of a coin, which is why they were reported as inaudible three
   * times. This asserts the measurement, because the constant cannot. */
  {
    const tap = audioTap();
    let voice = 0;
    let floorNoise = 0;
    if (tap && tap.ctx.state === 'running') {
      Music.stop();
      const an = tap.ctx.createAnalyser();
      an.fftSize = 2048;
      tap.bus.connect(an);
      const buf = new Float32Array(an.fftSize);
      const peakFor = async (ms) => {
        let peak = 0;
        const t0 = performance.now();
        while (performance.now() - t0 < ms) {
          an.getFloatTimeDomainData(buf);
          for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
          await new Promise((r) => setTimeout(r, 8));
        }
        return peak;
      };
      // The suite has been firing sounds for a minute; let the bus go quiet
      // first, and measure what "quiet" actually is before trusting the reading.
      await new Promise((r) => setTimeout(r, 900));
      floorNoise = await peakFor(200);
      Sfx.play('yeah');
      voice = await peakFor(420);
      an.disconnect();
    }
    const measured = tap && tap.ctx.state === 'running';
    expect('a spoken line is loud enough to hear',
      !measured || (floorNoise < 0.1 && voice > 0.25),
      measured ? `ääni ${voice.toFixed(3)}, tausta ${floorNoise.toFixed(3)}` : 'ei mitattu');
  }

  /*
   * Consonants.
   *
   * The vocals used to be five vowels and nothing else, so every line was one
   * glide with a shape on it. Three things have to be true of the consonants and
   * not one of them can be read off the source:
   *
   *   - a plosive's silence has to be *in the waveform*. Without it the ear
   *     hears a tap, and a burst scheduled 35 ms after a vowel that is still
   *     ringing is exactly that.
   *   - a fricative is broadband noise and a vowel is two narrow bandpass peaks.
   *     They do not arrive at the same level for the same nominal gain, so the
   *     numbers are measured against the same references as everything else on
   *     this bus (coin 0.32, death 0.57).
   *   - the vowel-only words the game already speaks ('iea', 'ou', 'eo', 'uo')
   *     have to come out of the segmented path exactly as they did out of the
   *     single-glide one.
   */
  {
    const audio = await import('/src/core/audio.js');
    const { vox, voxPlan, Ambience } = audio;
    const tap = audioTap();
    const measured = tap && tap.ctx.state === 'running';
    const check = (name, fn) => {
      try {
        const [ok, detail] = fn();
        expect(name, ok, detail);
      } catch (err) {
        expect(name, false, `heitti: ${err.message}`);
      }
    };
    const near = (a, b, tol) => Math.abs(a - b) <= tol;
    const kinds = (plan) => plan.map((s) => s.kind).join(' ');

    check('a vowel-only word is still one unbroken glide', () => {
      const p = voxPlan('iea', 0.32);
      const t = p[0] && p[0].targets;
      return [
        p.length === 1 && p[0].kind === 'run' && p[0].at === 0
          && near(p[0].dur, 0.32, 1e-9) && t.length === 3
          && near(t[0].at, 0, 1e-9) && near(t[1].at, 0.136, 1e-6)
          && near(t[2].at, 0.272, 1e-6),
        `${kinds(p)}, kohdat ${t ? t.map((x) => x.at.toFixed(3)).join('/') : '-'}`,
      ];
    });

    check('a plosive is silence before it is a burst', () => {
      const bad = [];
      for (const c of ['p', 't', 'k']) {
        const p = voxPlan(`a${c}a`, 0.4);
        const [, gap, burst] = p;
        if (kinds(p) !== 'run silence burst run') { bad.push(`${c}: ${kinds(p)}`); continue; }
        if (gap.dur < 0.03) bad.push(`${c}: hiljaisuus vain ${(gap.dur * 1000).toFixed(0)} ms`);
        if (!near(burst.at, gap.at + gap.dur, 1e-9)) bad.push(`${c}: purske ei seuraa hiljaisuutta`);
      }
      const g = voxPlan('ata', 0.4)[1];
      return [bad.length === 0, bad.join(', ') || `esim. t: ${(g.dur * 1000).toFixed(0)} ms kiinni`];
    });

    /* Unknown letters used to become an 'a'. With five-letter vowel words that
     * was harmless; with real words a stray letter turning into an extra "ah"
     * adds a syllable nobody wrote. They are dropped now — and a word left with
     * nothing at all still falls back to an 'a', because a sound effect that
     * silently does nothing is the failure that never gets reported. */
    check('an unknown letter is dropped instead of becoming an "a"', () => {
      const same = JSON.stringify(voxPlan('jee', 0.3)) === JSON.stringify(voxPlan('ee', 0.3));
      const empty = voxPlan('jvlr', 0.3);
      const fallback = empty.length === 1 && empty[0].targets.length === 1
        && empty[0].targets[0].f[0] === 730;
      return [same && fallback, `jee=ee ${same}, tuntematon sana -> ${kinds(empty)}`];
    });

    if (measured) {
      /*
       * The attract demo plays the game to nobody after twenty seconds on the
       * title screen, and it fires jumps and stomps into the very bus these
       * checks read. Going back to the title re-arms that timer, which buys the
       * twenty seconds this block needs — the readings below were varying by a
       * factor of two before, and it was the demo landing a coin in the window.
       */
      game.toTitle();
      Music.stop();
      Ambience.stop();                       // no room tail across the closures
      const an = tap.ctx.createAnalyser();
      an.fftSize = 32768;                    // 743 ms of contiguous waveform at 44.1k
      tap.bus.connect(an);
      const wave = new Float32Array(an.fftSize);
      const rate = tap.ctx.sampleRate;
      const peakFor = async (ms) => {
        let peak = 0;
        const t0 = performance.now();
        while (performance.now() - t0 < ms) {
          an.getFloatTimeDomainData(wave);
          for (let i = 0; i < wave.length; i++) peak = Math.max(peak, Math.abs(wave[i]));
          await new Promise((r) => setTimeout(r, 8));
        }
        return peak;
      };
      const quiet = async () => new Promise((r) => setTimeout(r, 300));
      const say = async (word, gain = 0.44, dur = 0.34, ms = 420) => {
        await quiet();
        vox({ word, dur, gain });
        return peakFor(ms);
      };

      const checkA = async (name, fn) => {
        try {
          const [ok, detail] = await fn();
          expect(name, ok, detail);
        } catch (err) {
          expect(name, false, `heitti: ${err.message}`);
        }
      };

      /* Every consonant on its own. A fricative or a burst that never made it
       * out of the graph would still leave the word around it sounding fine. */
      const levels = {};
      await checkA('every consonant makes a sound of its own', async () => {
        for (const c of ['s', 'š', 'f', 'h', 'p', 't', 'k', 'm', 'n', 'a']) {
          levels[c] = await say(c);
        }
        const mute = Object.entries(levels).filter(([, v]) => v < 0.05).map(([c]) => c);
        return [mute.length === 0,
          Object.entries(levels).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(' ')];
      });

      /* A fricative is noise where a vowel is two resonances: it will not land
       * at the same level for the same nominal gain, and both numbers only mean
       * something next to the coin and the death sound on this same bus. */
      await checkA('a fricative is audible against the same reference as a vowel', async () => [
        levels.s > 0.16 && levels.s < levels.a,
        `s ${levels.s.toFixed(3)}, vokaali ${levels.a.toFixed(3)}, `
        + `h ${levels.h.toFixed(3)}, t-purske ${levels.t.toFixed(3)} (kolikko 0.32)`,
      ]);

      /* And the silence, in the recorded waveform rather than in the schedule.
       * `ata` is a vowel, a closure and a burst: if the closure is not really
       * there the envelope never comes down between the two vowels. */
      await checkA('a plosive keeps its silence in the waveform', async () => {
        await quiet();
        await new Promise((r) => setTimeout(r, 200));
        vox({ word: 'ata', dur: 0.42, gain: 0.44 });
        await new Promise((r) => setTimeout(r, 560));
        an.getFloatTimeDomainData(wave);
        const block = 64;                    // 1.45 ms per step
        const env = [];
        for (let i = 0; i + block <= wave.length; i += block) {
          let m = 0;
          for (let j = i; j < i + block; j++) m = Math.max(m, Math.abs(wave[j]));
          env.push(m);
        }
        const top = Math.max(...env);
        const start = env.findIndex((v) => v > top * 0.25);
        /*
         * The longest quiet stretch inside the word that is answered by
         * something loud. "Answered" is looked for over the 12 ms after the
         * silence rather than in the first block out of it, because a burst
         * starts from nothing and its own attack would end the count early.
         *
         * Twelve and not forty: with a wider window this check passed a build
         * whose closures had been deleted, because a vowel fading in over 30 ms
         * leaves a quiet stretch of its own. The window is now shorter than any
         * onset that is not a transient.
         */
        const reply = Math.round((0.012 * rate) / block);
        let gap = 0;
        let run = 0;
        let after = 0;
        for (let i = Math.max(0, start); i < env.length; i++) {
          if (env[i] < top * 0.06) { run++; continue; }
          if (run > gap) {
            let hi = 0;
            for (let j = i; j < Math.min(env.length, i + reply); j++) hi = Math.max(hi, env[j]);
            if (hi > top * 0.2) { gap = run; after = hi; }
          }
          run = 0;
        }
        const ms = (gap * block * 1000) / rate;
        return [top > 0.2 && ms >= 20 && after > top * 0.2,
          `kiinni ${ms.toFixed(0)} ms, huippu ${top.toFixed(2)}, `
          + `purskeen jälkeen ${after.toFixed(2)}`];
      });
      an.disconnect();
    }
  }

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

    /* Sprites now tint and glow, and glowing means switching the composite mode
     * mid-draw. One that is not switched back corrupts every tile drawn after
     * it, which looks like a graphics bug rather than a leak — so this is
     * asserted the same way the post-processing pass is. */
    {
      const sprites = await import('/src/gfx/sprites.js');
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      const leaks = [];
      const check = (what) => {
        if (g.globalCompositeOperation !== 'source-over') leaks.push(`${what}: ${g.globalCompositeOperation}`);
        if (g.globalAlpha !== 1) leaks.push(`${what}: alpha ${g.globalAlpha}`);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
      };
      for (const kind of ['shroom', 'flower', 'leaf', 'soup', 'star', 'pop']) {
        sprites.drawItem(g, kind, 20, 20, 30);
        check(`item ${kind}`);
      }
      const { TINTS } = sprites;
      for (const level of [0, 1, 3, 5]) {
        for (const tint of [null, TINTS && TINTS.frozen, TINTS && TINTS.flash]) {
          sprites.drawPlayer(g, 20, 20, {
            type: 'leaf', level, facing: 1, state: 'walk', frame: 1, tick: 12, tint,
          });
          check(`player ${level}${tint ? ' tinted' : ''}`);
        }
      }
      // The star draws the whole player a second time, additively — the most
      // likely place for a composite mode to escape.
      for (const t of (sprites.STAR_TINTS || [])) {
        sprites.drawPlayer(g, 20, 20, {
          type: 'leaf', level: 5, facing: 1, state: 'walk', frame: 1, tick: 12,
          tint: t, glow: sprites.GLOWS && sprites.GLOWS.star,
        });
        check('player starred');
      }
      for (const out of [0, 0.3, 1]) {
        sprites.drawSpines(g, 20, 40, 30, out, 12);
        check(`spines ${out}`);
      }
      sprites.drawSpikeGuy(g, 20, 40, 7, -1);
      check('spikeguy');
      // The sun's wake and its wind-up halo are both additive, which is the
      // one thing in this file that switches the composite mode mid-sprite.
      {
        const trail = [];
        for (let i = 0; i < 14; i++) trail.push({ x: 20 + i * 3, y: 40 + i, life: 26 - i });
        for (const wind of [0, 0.4, 0.9, 1]) {
          sprites.drawAngrySun(g, 20, 40, 12, wind > 0.9, false, { trail, windUp: wind });
          check(`angrysun ${wind}`);
        }
        sprites.drawAngrySun(g, 20, 40, 12, false, true);
        check('angrysun bare');
      }
      if (sprites.drawBeanBaron) {
        for (const wind of [0, 0.5, 1]) {
          sprites.drawBeanBaron(g, 20, 40, 12, -1, wind, false);
          check(`beanbaron ${wind}`);
        }
        sprites.drawBeanBomb(g, 20, 40, 12);
        check('beanbomb');
      }
      for (const v of [0, 1, 2, 3]) {
        sprites.drawBoss(g, 20, 40, 12, 1, false, v, 1, 1);
        check(`boss ${v} spiny`);
      }
      expect('drawing a sprite leaves the canvas state as it found it',
        leaks.length === 0, leaks.join(', '));
    }
  }

  return {
    levels, checks, failures, worlds: WORLDS.length, ruleReport,
    audio: { sfx: Sfx.names(), music: Music.names() },
  };
});

/* ---------------------- kosketusohjaus puhelimen mitoissa ----------------- */
/*
 * A second context with an iPhone's viewport, pixel ratio and touch support.
 *
 * What this proves: that the layout survives 390 CSS pixels of width, that the
 * phone-only media queries — which never run in the desktop page above — put
 * the buttons where they are meant to be, and that the hit-testing still reads
 * a thumb roll at that size.
 *
 * What it does NOT prove: anything about Safari. This is Chromium wearing an
 * iPhone's measurements. Double-tap zoom, pinch and `touch-action` handling are
 * WebKit's own, and only a real phone can confirm them.
 */
{
  const phone = await browser.newContext({ ...devices['iPhone 13'] });
  const page2 = await phone.newPage();
  page2.on('pageerror', (e) => errors.push(`[iphone pageerror] ${e.message}`));
  page2.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' && !text.includes('favicon')) errors.push(`[iphone console] ${text}`);
  });
  await page2.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(400);

  const mobile = await page2.evaluate(async () => {
    const checks = [];
    const failures = [];
    const expect = (name, ok, detail = '') => {
      checks.push({ name: `${name} (iPhone-mitat)`, ok, detail });
      if (!ok) failures.push(`${name} [iPhone-mitat]${detail ? ` (${detail})` : ''}`);
    };
    const { Input } = await import('/src/core/input.js');
    const touch = window.sfb3.touch;
    touch.reveal();

    // A phone that has never been given a preference gets the layout that was
    // built for one thumb. Anyone who has chosen keeps their choice — that is
    // what localStorage is for, and this context has nothing stored.
    expect('a phone with no stored preference starts in the rolling layout',
      touch.layout === 'rulla', touch.layout);

    touch.setLayout('rulla');
    const rect = (act) => document.querySelector(`#touch [data-act="${act}"]`).getBoundingClientRect();
    const send = (type, id, x, y) => {
      document.getElementById('touch').dispatchEvent(new PointerEvent(type, {
        pointerId: id, clientX: x, clientY: y, pointerType: 'touch', bubbles: true, cancelable: true,
      }));
    };
    const held = () => {
      Input.poll();
      return Object.entries(Input.held).filter(([, v]) => v).map(([k]) => k).sort().join(',');
    };

    expect('the root element still forbids double-tap zoom on a phone',
      getComputedStyle(document.documentElement).touchAction === 'manipulation',
      getComputedStyle(document.documentElement).touchAction);

    const runPad = rect('run');
    const jumpPad = rect('jump');
    const dpad = ['left', 'right', 'up', 'down'].map(rect);
    const small = [runPad, jumpPad, ...dpad].filter((r) => r.width < 44 || r.height < 44);
    expect('no control is under the 44 px a fingertip needs', small.length === 0,
      small.map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`).join(' '));

    expect('the jump button stays inside the fart pad at phone width',
      jumpPad.left >= runPad.left && jumpPad.right <= runPad.right
      && jumpPad.top >= runPad.top && jumpPad.bottom <= runPad.bottom,
      `pieru ${Math.round(runPad.left)}..${Math.round(runPad.right)} / hyppy ${Math.round(jumpPad.left)}..${Math.round(jumpPad.right)}`);

    const clash = dpad.filter((r) => r.right > runPad.left && r.bottom > runPad.top && r.top < runPad.bottom);
    expect('the fart pad does not land on the d-pad at 390 px of width',
      clash.length === 0, `d-pad ends at ${Math.round(Math.max(...dpad.map((r) => r.right)))}, pieru alkaa ${Math.round(runPad.left)}`);

    const offscreen = [runPad, jumpPad, ...dpad]
      .filter((r) => r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight);
    expect('every control is on the screen', offscreen.length === 0,
      `${Math.round(innerWidth)}x${Math.round(innerHeight)}, ulkona ${offscreen.length}`);

    touch._releaseAll();
    Input.poll();
    Input.poll();
    const rest = [runPad.right - 16, runPad.bottom - 16];
    send('pointerdown', 30, ...rest);
    const resting = held();
    send('pointermove', 30, jumpPad.left + jumpPad.width / 2, jumpPad.top + jumpPad.height / 2);
    const rolled = held();
    send('pointermove', 30, ...rest);
    const back = held();
    send('pointerup', 30, ...rest);
    expect('the thumb roll works at phone size too',
      resting === 'run' && rolled === 'jump,run' && back === 'run',
      `lepo "${resting}" ylös "${rolled}" alas "${back}"`);

    return { checks, failures };
  });
  report.checks.push(...mobile.checks);
  report.failures.push(...mobile.failures);
  await phone.close();
}

/* --------------------- haastelinkki oikeana sivunlatauksena --------------- */
/*
 * Kolme asiaa haastelinkissä ei ole testattavissa funktiokutsuna, koska ne ovat
 * sivunlatauksen tapahtumia: parametrien luku käynnistyksessä, niiden poisto
 * osoiteriviltä ja se että vastaanotto **ei kirjoita mitään**. Ne vaativat
 * oman selainkontekstin ja oikean `goto`:n kyselymerkkijonolla.
 *
 * Kontekstit ovat erillisiä tarkoituksella: roskatestit käynnistävät pelin ja
 * kirjoittavat tallennuksen, ja se sotkisi kirjoitusmittauksen.
 */
{
  const base = `http://127.0.0.1:${PORT}/`;
  const expect = (name, ok, detail = '') => {
    report.checks.push({ name, ok, detail });
    if (!ok) report.failures.push(`${name}${detail ? ` (${detail})` : ''}`);
  };

  /* --- A: roska parametreissa ei saa estää peliä käynnistymästä --- */
  {
    const junkCtx = await browser.newContext();
    const jp = await junkCtx.newPage();
    const junkErrors = [];
    jp.on('pageerror', (e) => junkErrors.push(`[haaste pageerror] ${e.message}`));
    jp.on('console', (m) => {
      const text = m.text();
      if (m.type() === 'error' && !text.includes('favicon')) junkErrors.push(`[haaste console] ${text}`);
    });

    /* Jokainen rivi: kyselymerkkijono, odotettu haaste (null = ei haastetta)
     * ja se mitä tapaus koettelee. Peruste kaikille: haaste on väite ajosta
     * jonka tämä peli olisi voinut tuottaa. Jos väite ei ole sellainen, ei ole
     * haastetta — ja alkuruutu on täsmälleen se mikä se on ilman linkkiäkin. */
    const cases = [
      ['', null, 'ei parametreja'],
      ['?', null, 'tyhjä kysely'],
      ['?s=abc&n=OLLI', null, 'kirjaimia pisteinä'],
      ['?s=-5', null, 'negatiivinen tulos'],
      ['?s=1e999', null, 'eksponentti eli ääretön'],
      [`?s=1000&n=${'A'.repeat(500)}`, { score: 1000, name: 'AAAAAA', level: '' }, '500 merkin nimi'],
      ['?s=1000&n=%F0%9F%92%A9%E4%B8%AD%E6%96%87', { score: 1000, name: 'KAVERI', level: '' }, 'unicode-nimi'],
      ['?s=1000&n=OLLI&l=9-9', { score: 1000, name: 'OLLI', level: '' }, 'olematon kenttä'],
      ['?s=45200&n=OLLI&l=2-3', { score: 45200, name: 'OLLI', level: '2-3' }, 'kunnollinen haaste'],
    ];

    const results = [];
    for (const [query] of cases) {
      await jp.goto(base + query, { waitUntil: 'networkidle' });
      await jp.waitForTimeout(120);
      results.push(await jp.evaluate(async () => {
        const game = window.sfb3;
        if (!game) return { booted: false };
        // Alkuruutu piirtyy: haaste tai ei, ruudulla on peliä eikä mustaa.
        game.render();
        const px = game.ctx.getImageData(0, 0, 320, 240).data;
        const seen = new Set();
        for (let p = 0; p < px.length; p += 4 * 37) {
          seen.add((px[p] << 16) | (px[p + 1] << 8) | px[p + 2]);
        }
        // …ja peli lähtee käyntiin. Se on se mitä roskalinkki ei saa estää.
        const before = game.scene.constructor.name;
        game.newGame();
        const started = game.scene.constructor.name;
        return {
          booted: true,
          challenge: game.challenge ? { ...game.challenge } : null,
          colors: seen.size,
          title: before,
          started,
          search: location.search,
        };
      }));
    }

    const bad = [];
    cases.forEach(([query, want, why], i) => {
      const got = results[i];
      if (!got.booted) { bad.push(`${why}: ei bootannut`); return; }
      if (got.title !== 'TitleScene') bad.push(`${why}: alkuruutu oli ${got.title}`);
      if (got.colors < 5) bad.push(`${why}: ruutu tyhjä (${got.colors} väriä)`);
      if (got.started !== 'WorldMapScene') bad.push(`${why}: peli ei lähtenyt (${got.started})`);
      const c = got.challenge;
      if (!want && c) bad.push(`${why}: haaste syntyi tyhjästä (${JSON.stringify(c)})`);
      if (want && !c) bad.push(`${why}: haaste jäi lukematta`);
      if (want && c && (c.score !== want.score || c.name !== want.name || c.level !== want.level)) {
        bad.push(`${why}: ${JSON.stringify(c)} != ${JSON.stringify(want)}`);
      }
      if (got.search.includes('s=') || got.search.includes('n=') || got.search.includes('l=')) {
        bad.push(`${why}: parametrit jäivät osoiteriville (${got.search})`);
      }
    });
    expect('roskalinkki ei estä peliä käynnistymästä eikä keksi haastetta',
      bad.length === 0 && junkErrors.length === 0,
      [...bad, ...junkErrors].join('; ') || `${cases.length} tapausta`);

    /* Osoiterivin siivous on kaksi lupausta yhdessä: päivitys ei herätä
     * vanhentunutta haastetta, eikä `?touch=1` saa kadota siivouksen mukana —
     * se on kehitystyökalu joka elää samassa kyselyssä. */
    await jp.goto(`${base}?s=45200&n=OLLI&l=2-3&touch=1`, { waitUntil: 'networkidle' });
    await jp.waitForTimeout(120);
    const stripped = await jp.evaluate(() => ({
      search: location.search,
      challenge: window.sfb3.challenge ? { ...window.sfb3.challenge } : null,
      entries: performance.getEntriesByType('navigation').length,
    }));
    await jp.reload({ waitUntil: 'networkidle' });
    await jp.waitForTimeout(120);
    const reloaded = await jp.evaluate(() => ({
      search: location.search,
      challenge: window.sfb3.challenge ? { ...window.sfb3.challenge } : null,
    }));
    expect('haasteparametrit katoavat osoiteriviltä eivätkä herää päivityksessä',
      stripped.search === '?touch=1' && stripped.challenge
      && stripped.challenge.score === 45200
      && reloaded.search === '?touch=1' && reloaded.challenge === null,
      `${stripped.search} -> ${reloaded.search}, haaste ${reloaded.challenge}`);

    await junkCtx.close();
  }

  /* --- B: haasteen vastaanotto ei kirjoita yhtään tavua --- */
  /*
   * DESIGN.md kohta 6 luettelee kaikki kuusi localStorage-avainta. Ne kylvetään
   * tunnetuilla arvoilla, sivu ladataan haastelinkillä ja avaimet luetaan
   * uudelleen: haaste elää istunnon muistissa eikä koske tallennukseen,
   * pistetauluun eikä pelidataan. Sama vaatimus kuin esittelytilalla, ja siksi
   * se todistetaan samalla tavalla — mittaamalla, ei lupaamalla.
   */
  {
    const cleanCtx = await browser.newContext();
    const cp = await cleanCtx.newPage();
    const quietErrors = [];
    cp.on('pageerror', (e) => quietErrors.push(`[haaste pageerror] ${e.message}`));
    cp.on('console', (m) => {
      const text = m.text();
      if (m.type() === 'error' && !text.includes('favicon')) quietErrors.push(`[haaste console] ${text}`);
    });

    await cp.goto(base, { waitUntil: 'networkidle' });
    const before = await cp.evaluate(() => {
      const seed = {
        'sfb3.save.v2': JSON.stringify({
          lives: 3, coins: 7, score: 111, power: { type: 'shroom', level: 2 },
          reserve: null, world: 1, node: 'w2-1', cleared: { 'w1-1': true },
          worldsOpen: 2, usedSaveState: false, continues: 1,
        }),
        'sfb3.savestate.1': JSON.stringify({ label: '2-1', at: 1 }),
        'sfb3.savestate.2': JSON.stringify({ label: '3-2', at: 2 }),
        'sfb3.savestate.3': JSON.stringify({ label: '4-3', at: 3 }),
        'sfb3.scores.v1': JSON.stringify([
          { name: 'MINÄ', score: 777, world: 1, level: '1-1', at: 1, version: 'x' },
        ]),
        'sfb3.telemetry.v1': JSON.stringify([{ t: 'death', id: '1-1', x: 5, y: 5 }]),
        'sfb3.fx.v1': 'crt',
        'sfb3.touch.v1': 'rulla',
      };
      localStorage.clear();
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      // Avainjärjestys ei ole taattu, joten se lajitellaan ennen vertailua —
      // muuten testi voisi punastua pelkästä järjestyksestä.
      const all = [];
      for (let i = 0; i < localStorage.length; i++) all.push(localStorage.key(i));
      all.sort();
      return JSON.stringify(all.map((k) => [k, localStorage.getItem(k)]));
    });

    await cp.goto(`${base}?s=45200&n=OLLI&l=2-3`, { waitUntil: 'networkidle' });
    await cp.waitForTimeout(400);
    const after = await cp.evaluate(() => {
      const game = window.sfb3;
      // Ruutuja pyöritetään hetki: haaste ei saa vuotaa tallennukseen
      // myöskään sen jälkeen kun alkuruutu on ehtinyt piirtyä ja liikkua.
      for (let f = 0; f < 120; f++) { game.step(); game.render(); }
      game.toHighScores();
      for (let f = 0; f < 30; f++) { game.step(); game.render(); }
      game.toTitle();
      const all = [];
      for (let i = 0; i < localStorage.length; i++) all.push(localStorage.key(i));
      all.sort();
      return {
        storage: JSON.stringify(all.map((k) => [k, localStorage.getItem(k)])),
        challenge: game.challenge ? { ...game.challenge } : null,
        keys: all.join(' '),
      };
    });

    expect('haasteen vastaanotto ei kirjoita yhtään tavua selaimen muistiin',
      before === after.storage && !!after.challenge && after.challenge.score === 45200
      && quietErrors.length === 0,
      before === after.storage
        ? (after.challenge ? `${after.keys}` : 'haaste jäi lukematta')
        : 'tallennus muuttui');

    await cleanCtx.close();
  }
}

/* ----------------------------- peliohjain -------------------------------- */
/*
 * Playwrightissa ei ole ohjainemulaatiota, mutta peli lukee ohjaimen
 * `navigator.getGamepads()`:sta joka pollilla eikä missään muualla. Siksi
 * valeohjain sivulla on rehellinen testi eikä kiertotie: se syöttää
 * täsmälleen sen rajapinnan jota oikea ohjain käyttää, ja oikea `Input.poll()`
 * lukee sen.
 *
 * Mukana on myös ääniluvan aukko, koska se on ohjaimen ominaisuus eikä äänen:
 * selain avaa AudioContextin vain käyttäjän eleestä, ja **ohjaimen napinpainallus
 * ei ole ele**. Sitä ei voi korjata yrittämällä uudestaan, joten testataan se
 * mitä oikeasti tehdään — kerrotaan asiasta ruudulla.
 */
{
  const gamepad = await page.evaluate(async () => {
    const checks = [];
    const failures = [];
    const expect = (name, ok, detail = '') => {
      checks.push({ name, ok, detail });
      if (!ok) failures.push(`${name}${detail ? ` (${detail})` : ''}`);
    };
    const { Input } = await import('/src/core/input.js');
    const { Music, isMuted, toggleMute } = await import('/src/core/audio.js');
    const game = window.sfb3;

    const realGetGamepads = navigator.getGamepads.bind(navigator);
    let pads = [];
    navigator.getGamepads = () => pads;

    /** Standardin muotoinen ohjain: 16 nappia, kaksi akselia. */
    const mkPad = (down = [], axes = [0, 0], mapping = 'standard') => ({
      index: 0, id: 'testipad', connected: true, mapping, timestamp: 0,
      buttons: Array.from({ length: 16 }, (_, i) => ({
        pressed: down.includes(i), touched: down.includes(i), value: down.includes(i) ? 1 : 0,
      })),
      axes,
    });

    const clear = () => {
      pads = [];
      dispatchEvent(new Event('blur'));   // nollaa näppäimet ja latchin
      Input.poll();
      Input.poll();
    };
    const held = () => {
      Input.poll();
      return Object.entries(Input.held).filter(([, v]) => v).map(([k]) => k).sort().join(',');
    };
    const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));

    /* --- napit tulevat perille oikeina toimintoina --- */
    clear();
    pads = [mkPad([0])];
    const jump = held();
    pads = [mkPad([2])];
    const run = held();
    pads = [mkPad([9])];
    const start = held();
    pads = [mkPad([14])];
    const dpadLeft = held();
    expect('ohjaimen napit tulevat peliin oikeina toimintoina',
      jump === 'jump' && run === 'run' && start === 'start' && dpadLeft === 'left',
      `0="${jump}" 2="${run}" 9="${start}" 14="${dpadLeft}"`);

    /* --- tatti: kuollut alue pitää ja sen yli ohjaa --- */
    clear();
    pads = [mkPad([], [-1, 0])];
    const stickLeft = held();
    pads = [mkPad([], [-0.2, 0])];
    const stickIdle = held();
    pads = [mkPad([], [0, 0.9])];
    const stickDown = held();
    pads = [mkPad([], [0, -0.39])];
    const stickAlmost = held();
    expect('tatti ohjaa kuolleen alueen ulkopuolella eikä sisäpuolella',
      stickLeft === 'left' && stickIdle === '' && stickDown === 'down' && stickAlmost === '',
      `-1="${stickLeft}" -0.2="${stickIdle}" +0.9="${stickDown}" -0.39="${stickAlmost}"`);

    /* --- molemmat elossa yhtä aikaa: kumpikaan ei kumoa toista --- */
    clear();
    key('keydown', 'ArrowRight');
    const keyOnly = held();
    pads = [mkPad([0])];
    const both = held();
    key('keyup', 'ArrowRight');
    const padOnly = held();
    clear();
    expect('näppäimistö ja ohjain ovat elossa yhtä aikaa',
      keyOnly === 'right' && both === 'jump,right' && padOnly === 'jump',
      `näppäin "${keyOnly}" molemmat "${both}" ohjain "${padOnly}"`);

    /* --- irronnut tai vajaa ohjain ei saa kaataa pollia --- */
    clear();
    let crash = '';
    const survives = (label, value) => {
      pads = value;
      try { Input.poll(); } catch (e) { crash += `${label}: ${e.message}; `; }
    };
    survives('null-paikka', [null]);
    survives('tyhjä lista', []);
    survives('undefined-paikka', [undefined]);
    survives('connected=false', [{ ...mkPad([0]), connected: false }]);
    survives('ei nappeja eikä akseleita', [{ index: 0, id: 'rikki', connected: true, mapping: 'standard' }]);
    survives('lyhyt akselilista', [{ ...mkPad([]), axes: [] }]);
    survives('yhden akselin ohjain', [{ ...mkPad([]), axes: [0.9] }]);
    survives('NaN akselilla', [{ ...mkPad([]), axes: [NaN, NaN] }]);
    navigator.getGamepads = () => null;
    try { Input.poll(); } catch (e) { crash += `getGamepads null: ${e.message}; `; }
    navigator.getGamepads = () => pads;
    pads = [];
    Input.poll();
    const leftovers = Object.entries(Input.held).filter(([, v]) => v).map(([k]) => k).join(',');
    expect('irronnut tai vajaa ohjain ei kaada eikä jätä nappeja pohjaan',
      crash === '' && leftovers === '', crash || `jäi pohjaan: ${leftovers}`);

    /* --- ei-standardi kuvaus: napit luetaan, akseleita ei --- */
    clear();
    pads = [mkPad([0], [-1, 0], '')];
    const odd = held();
    clear();
    pads = [mkPad([], [0, -1], 'vendor-specific')];
    const oddAxis = held();
    clear();
    expect('ei-standardi ohjain ei ohjaa akseleillaan mutta napit toimivat',
      odd === 'jump' && oddAxis === '',
      `napit+akseli "${odd}" pelkkä akseli "${oddAxis}"`);

    /* --- ohjaimen nappi ei ole ele, näppäin on --- */
    clear();
    const realGesture = Input.onGesture;
    let gestures = 0;
    Input.onGesture = () => { gestures++; if (realGesture) realGesture(); };
    pads = [mkPad([0])];
    Input.poll();
    Input.poll();
    const afterPad = gestures;
    key('keydown', 'KeyZ');
    key('keyup', 'KeyZ');
    const afterKey = gestures;
    dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const afterPointer = gestures;
    Input.onGesture = realGesture;
    clear();
    /* Lukumäärä ei ole yksi vaan kaksi, koska tämä testitiedosto kutsuu itse
     * `Input.install()`in uudestaan ylempänä ja kuuntelijoita on siksi kaksi
     * kerrosta. Väite ei ole "tasan kerran" vaan se mikä oikeasti ratkaisee:
     * **ohjaimesta ei nolla kertaa, näppäimestä ja osoittimesta joka kerta.** */
    expect('ääniluvan yritys lähtee eleestä, ei ohjaimen napista',
      afterPad === 0 && afterKey > 0 && afterPointer > afterKey,
      `ohjain ${afterPad} näppäin ${afterKey} osoitin ${afterPointer}`);

    /* --- ääniloukku: mitä ruudulla lukee, milloin ja kenelle --- */
    const wasMuted = isMuted();
    if (wasMuted) toggleMute();
    const realScene = game.scene;
    const realTrack = Music.current;
    const realAudioState = game.audioState;
    Music.current = null;               // ei aloiteta samaa raitaa satoja kertoja
    game.scene = { update() {}, draw() {} };
    // Tunnelmaefektit pois: kuumuuden väreily muuttaa pikseleitä joka framella
    // ja tekisi alla olevasta pikselivertailusta arpapeliä.
    game.fx.setAmbience(null, null);
    const resetHint = () => {
      game.audioHintOff = false;
      game.audioHintWasUp = false;
      game.flashTimer = 0;
      game.flashIsHint = false;
      game.flash = '';
    };
    const steps = (n) => { for (let i = 0; i < n; i++) game.step(); };

    // (a) ääni käynnissä: ohjaimella pelataan pitkään eikä mitään sanota
    game.audioState = () => 'running';
    resetHint();
    clear();
    pads = [mkPad([0])];
    steps(300);
    const whenFine = game.audioHintVisible === true;

    // (b) ääni kiinni ja ohjaimelta tulee syötettä: sanotaan heti, ei kellon jälkeen
    game.audioState = () => 'suspended';
    resetHint();
    game.step();
    const atOnce = game.audioHintVisible === true;
    const text = game.flash;
    steps(300);
    const stillUp = game.audioHintVisible === true;   // uusitaan, ei umpeudu alta

    // (c) ääni lähtee: vihje katoaa samalla framella
    game.audioState = () => 'running';
    game.step();
    const gone = game.audioHintVisible === true;

    // (d) selaimessa ei ole Web Audiota ollenkaan: ei nalkuteta turhaan
    game.audioState = () => 'none';
    resetHint();
    steps(300);
    const noWebAudio = game.audioHintVisible === true;

    expect('ääniloukun vihje näkyy heti kun ääni on kiinni ja ohjain puhuu',
      !whenFine && atOnce && text === 'OHJAIN EI AVAA ÄÄNTÄ - PAINA NÄPPÄINTÄ'
      && stillUp && !gone && !noWebAudio,
      `käynnissä ${whenFine} heti ${atOnce} pysyy ${stillUp} äänen jälkeen ${gone}`
      + ` ei-audiota ${noWebAudio} teksti "${text}"`);

    /* (e) Väärä hälytys on se mitä tässä ratkaisussa nimenomaan ei saa olla:
     * näppäimistöpelaaja avaa äänen ensimmäisellä painalluksellaan, ja jos
     * ehto katsoisi pelkkää "syötettä" hän näkisi vilauksen siitä muutaman
     * framen ajan sillä välin kun `resume()` etenee. Ohjain saa olla kytkettynä
     * — se ei ole rikos, se on pöydällä. */
    game.audioState = () => 'suspended';
    resetHint();
    clear();
    pads = [mkPad()];                 // kytketty, mutta kukaan ei koske siihen
    key('keydown', 'ArrowRight');
    steps(300);
    const keyboardNagged = game.audioHintVisible === true;
    key('keyup', 'ArrowRight');
    clear();
    expect('näppäimistöpelaaja ei näe ääniloukun vihjettä vaikka ohjain on kiinni',
      !keyboardNagged, `näkyi ${keyboardNagged}`);

    // (f) oikea ilmoitus voittaa: se on vastaus siihen mitä pelaaja juuri teki
    game.audioState = () => 'suspended';
    resetHint();
    pads = [mkPad([0])];
    steps(3);
    const hintFirst = game.audioHintVisible === true;
    game.toast('TILA 1 LADATTU');
    steps(3);
    const realWins = game.flash === 'TILA 1 LADATTU' && game.audioHintVisible === false;
    steps(120);                        // ilmoitus umpeutuu
    const hintReturns = game.audioHintVisible === true;
    expect('oikea ilmoitus voittaa vihjeen, ja vihje palaa itse',
      hintFirst && realWins && hintReturns,
      `vihje ${hintFirst} ilmoitus "${game.flash}" voitti ${realWins} palasi ${hintReturns}`);

    // (g) vihje on oikeasti ruudulla eikä vain lipussa
    const strip = () => Array.from(game.ctx.getImageData(0, 0, 320, 14).data).join(',');
    game.audioState = () => 'running';
    resetHint();
    game.render();
    const without = strip();
    game.render();
    const withoutAgain = strip();
    game.audioState = () => 'suspended';
    resetHint();
    steps(2);
    game.render();
    const withHint = strip();
    game.audioState = () => 'running';
    game.step();
    game.render();
    const afterUnlock = strip();
    expect('vihje piirtyy ilmoitusriville ja katoaa kun ääni lähtee',
      without === withoutAgain && withHint !== without && afterUnlock === without,
      `vakaa ${without === withoutAgain}, erosi ${withHint !== without},`
      + ` palasi ${afterUnlock === without}`);

    /* (h) Kuittaus ohjaimen napilla. Se on ainoa kuittaus jolla on merkitystä:
     * näppäimellä kuittaava avaa samalla äänen, joten vihje olisi mennyt
     * muutenkin. Ohjaimella kuittaava on valinnut hiljaisuuden — eikä ääni
     * lähde siitä painalluksesta, joten valinnan pitää pysyä. */
    game.audioState = () => 'suspended';
    resetHint();
    clear();
    pads = [mkPad([14])];              // ristiohjain vasemmalle: ehto täyttyy
    steps(4);
    const upBeforePress = game.audioHintVisible === true;
    pads = [mkPad([14, 0])];           // ja nyt hyppynappi eli uusi painallus
    game.step();
    const afterPress = game.audioHintVisible === true;
    const dismissed = game.audioHintOff === true;
    steps(300);
    const stayedGone = game.audioHintVisible === true;
    const stillStuck = game.audioState() !== 'running';
    expect('ohjaimen napilla kuittaaminen sulkee vihjeen koko istunnoksi',
      upBeforePress && !afterPress && dismissed && !stayedGone && stillStuck,
      `ennen ${upBeforePress} jälkeen ${afterPress} kuitattu ${dismissed}`
      + ` pysyi poissa ${!stayedGone}`);

    // (i) kuittaus elää vain muistissa, ei selaimen muistissa
    const stored = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/audio|hint|vihje|gamepad|ohjain/i.test(k)) stored.push(k);
    }
    expect('vihjeen kuittaus ei jätä uutta avainta selaimen muistiin',
      stored.length === 0, stored.join(' '));

    if (realAudioState) game.audioState = realAudioState; else delete game.audioState;
    resetHint();
    game.scene = realScene;
    Music.current = realTrack;
    if (wasMuted !== isMuted()) toggleMute();
    clear();
    navigator.getGamepads = realGetGamepads;

    return { checks, failures };
  });
  report.checks.push(...gamepad.checks);
  report.failures.push(...gamepad.failures);
}

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

/*
 * The map's difficulty numbers must be the ones the measurement produces today.
 *
 * `src/data/difficulty.js` is a carried copy: the tool is Node and reads
 * `tools/jump-budget.json` off disk, the game is a static page, so the numbers
 * cross in a data file the way `tools/pacing-stats.json` crosses to the
 * generator. A carried copy is the whole cost of doing it that way — edit one
 * chunk of one level and the map keeps promising yesterday's difficulty, which
 * is worse than showing none, because the player has no way to tell.
 *
 * So it is not trusted, it is re-derived. This imports the measurement itself
 * rather than a hash of the inputs: a hash would tell you something moved, this
 * tells you which level and by how much. Same lesson as the jump budget, and
 * for the same reason — the numbers are read by something that cannot recompute
 * them, so somebody else has to.
 */
{
  const { difficultyTable, compareTable } = await import('./difficulty.mjs');
  const { DIFFICULTY } = await import('../src/data/difficulty.js');
  const measured = difficultyTable();
  const drift = compareTable(DIFFICULTY, measured);
  report.checks.push({
    name: 'the map difficulty table is what the tool measures now',
    ok: drift.length === 0,
    detail: drift.length
      ? `${drift.slice(0, 3).join('; ')} — aja: node tools/difficulty.mjs --write`
      : `${Object.keys(measured).length} kenttää`,
  });
  if (drift.length) {
    report.failures.push(...drift.map((d) => `vaikeustaulu vanhentunut — ${d}`),
      'korjaus: node tools/difficulty.mjs --write');
  }

  /* Red before green: the comparison has to notice all three ways a copy goes
   * stale, or the check above is a decoration that always passes. Built off the
   * measurement rather than off the file, so this stays a test of the
   * comparison even on a run where the file is the thing that is wrong. */
  const first = Object.keys(measured)[0];
  const nudged = { ...measured, [first]: measured[first] + 5 };
  const dropped = { ...measured };
  delete dropped[first];
  const extra = { ...measured, '9-9': 1 };
  report.checks.push({
    name: 'a stale difficulty table is detected, not blessed',
    ok: compareTable(nudged, measured).length === 1
      && compareTable(dropped, measured).length === 1
      && compareTable(extra, measured).length === 1
      && compareTable(measured, measured).length === 0,
    detail: `muutettu ${compareTable(nudged, measured).length}, puuttuva `
      + `${compareTable(dropped, measured).length}, ylimääräinen `
      + `${compareTable(extra, measured).length}`,
  });
  if (!(compareTable(nudged, measured).length === 1
    && compareTable(dropped, measured).length === 1
    && compareTable(extra, measured).length === 1)) {
    report.failures.push('vaikeustaulun vertailu ei huomaa vanhentumista');
  }
}

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
