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

  /* ------------------------------ maahanisku ---------------------------- */
  /*
   * Maahanisku on tasapainoväite ennen kuin se on mekaniikka, ja väite on se
   * mikä voi mennä rikki. "Liike on olemassa" menisi läpi myös silloin kun
   * liike on korvannut tallauksen, joten alla mitataan hintaa ja rajoja:
   * montako framea ohjausta menetetään, tainnuttaako tavallisen hypyn mittainen
   * isku vai tappaako se, voittavatko piikit, ja mihin korkeusasteikko on
   * normalisoitu.
   *
   * Koko lohko on try/catchissa siksi että ensimmäinen ajo on tarkoituksella
   * punainen: puuttuva nimetty vienti kaataisi dynaamisen importin ja sen
   * mukana kaikki tämän jälkeen tulevat tarkistukset, jolloin punaisesta ei
   * näkisi mitään.
   */
  try {
    const { SpikeGuy, Walker, Shockwave } = await import('/src/entities/enemies.js');
    const { poundScale, POUND_CHARGE, POUND_SPEED } = await import('/src/entities/player.js');
    const { PoundWave } = await import('/src/entities/effects.js');

    /**
     * Korkein y johon pelaajan pää yltää siinä sarakkeessa jossa hän seisoo.
     * Katto (`ty < 0` on kiinteä) on 0, joten tyhjässä sarakkeessa tämä on
     * täsmälleen se suurin mahdollinen pudotus jota vastaan asteikko
     * normalisoidaan — mitattuna kentästä eikä arvattuna vakiona.
     */
    const roomAbove = (s, p) => {
      const tx0 = Math.floor(p.x / 16);
      const tx1 = Math.floor((p.x + p.w - 1) / 16);
      const blocked = (ty) => {
        for (let tx = tx0; tx <= tx1; tx++) if (s.solidAt(tx, ty)) return true;
        return false;
      };
      let ty = Math.floor(p.y / 16);
      while (ty - 1 >= 0 && !blocked(ty - 1)) ty--;
      return ty * 16;
    };

    /** Kenttä pystyyn, viholliset pois, pelaaja seisomaan omalle lattialleen. */
    const setup = (opts = {}) => {
      const { id = '1-1', power = { type: null, level: 0 } } = opts;
      reset(power);
      const s = new LevelScene(game, id);
      game.setScene(s);
      const i = mkInput();
      for (let f = 0; f < 8; f++) { s.update(i); i.pressed = blank(); }
      s.entities = s.entities.filter((e) => e.kind !== 'enemy');
      return { s, i, standY: s.player.y };
    };

    const lift = (s, y) => {
      s.player.y = y;
      s.player.vy = 0;
      s.player.onGround = false;
    };

    /** Painaa alas + hyppy ja ajaa kunnes isku on osunut maahan. */
    const pound = (s, i, cap = 400) => {
      i.held.down = true;
      i.pressed.jump = true;
      i.held.jump = true;
      s.update(i);
      i.pressed = blank();
      i.held.jump = false;
      let f = 1;
      while (f < cap && !s.lastPound) { s.update(i); f++; }
      return f;
    };

    /* 1. Perusliikkeen pitää toimia voimatasolla 0. Tehostus avaa paikkoja,
     *    ei kenttää — ja siksi ei myöskään liikettä. */
    {
      const { s, i, standY } = setup();
      lift(s, standY - 70);
      const frames = pound(s, i);
      const lp = s.lastPound;
      expect('maahanisku toimii voimatasolla 0',
        !!lp && s.player.powerLevel === 0 && lp.reach > 0 && lp.strength > 0,
        lp ? `voimataso 0, pudotus ${Math.round(lp.fall)}/${Math.round(lp.room)} px`
          + `, voima ${lp.strength.toFixed(2)}, säde ${lp.reach} px, ${frames} framea`
          : `iskua ei tullut ${frames} framessa`);
    }

    /* 2. Hinta numeroina: syöksy ei ohjaudu, ja siihen menee aikaa. Sama
     *    korkeus, sama nappi pohjassa, kaksi eri tapaa tulla alas. */
    {
      const free = setup();
      lift(free.s, free.standY - 70);
      free.i.held.right = true;
      const freeX = free.s.player.x;
      let freeFrames = 0;
      while (freeFrames < 400 && !free.s.player.onGround) { free.s.update(free.i); freeFrames++; }
      const freeDrift = free.s.player.x - freeX;

      const dive = setup();
      lift(dive.s, dive.standY - 70);
      dive.i.held.right = true;
      const diveX = dive.s.player.x;
      let diveFrames = pound(dive.s, dive.i);
      // ...ja maassa vielä se hetki jona ei pääse mihinkään.
      while (diveFrames < 400 && dive.s.player.poundPhase !== '') {
        dive.s.update(dive.i);
        diveFrames++;
      }
      const diveDrift = dive.s.player.x - diveX;

      expect('maahanisku maksaa ohjaamattoman ajan, tavallinen putoaminen ei',
        diveDrift < 1 && freeDrift > 10 && diveFrames > freeFrames + 20,
        `vapaa pudotus ${freeFrames} framea ja ${Math.round(freeDrift)} px sivuun`
        + `, maahanisku ${diveFrames} framea ja ${Math.round(diveDrift)} px`
        + ` (lataus ${POUND_CHARGE} framea, syöksy ${POUND_SPEED} px/frame)`);
    }

    /* 3. Eikä se korvaa tallausta. Sama korkeus, sama kävelijä, ja kumpikin
     *    liike saa oman parhaan tapauksensa: tallaus laskeutuu vihollisen
     *    päälle, maahanisku maahan sen viereen — päälle syöksyminen olisi
     *    tallaus eikä maahanisku, koska `bounce` peruu iskun. Mitataan kaksi
     *    asiaa: montako framea pelaaja on ilman ohjausta, ja kuoleeko vihollinen
     *    vai jääkö se henkiin tainnutettuna. */
    {
      const stomp = setup({ power: { type: 'shroom', level: 1 } });
      const feetY = stomp.standY + stomp.s.player.h;
      const walkerA = new Walker(stomp.s, stomp.s.player.x + 2, feetY - 16);
      walkerA.active = true; walkerA.alwaysActive = true; walkerA.vx = 0; walkerA.speed = 0;
      stomp.s.entities.push(walkerA);
      lift(stomp.s, stomp.standY - 70);
      stomp.i.held.right = true;
      let stompStill = 0;
      for (let f = 0; f < 120; f++) {
        stomp.s.update(stomp.i);
        stomp.i.pressed = blank();
        if (stomp.s.player.vx === 0) stompStill++;
      }

      const slam = setup({ power: { type: 'shroom', level: 1 } });
      const walkerB = new Walker(slam.s, slam.s.player.x + 22, slam.standY + slam.s.player.h - 16);
      walkerB.active = true; walkerB.alwaysActive = true; walkerB.vx = 0; walkerB.speed = 0;
      slam.s.entities.push(walkerB);
      lift(slam.s, slam.standY - 70);
      slam.i.held.right = true;
      slam.i.held.down = true;
      slam.i.pressed.jump = true;
      slam.i.held.jump = true;
      let slamStill = 0;
      /* Iskun lopputulos luetaan siltä framelta jolla isku osui, ei lopusta:
       * pelaaja kävelee oikealle vielä kymmeniä frameja sen jälkeen ja
       * puhkaisisi kuplan itse, mikä näyttäisi siltä että isku tappoi. */
      let outcome = null;
      let gap = 0;
      for (let f = 0; f < 120; f++) {
        slam.s.update(slam.i);
        slam.i.pressed = blank();
        slam.i.held.jump = false;
        // Alas irti heti käskyn jälkeen: kyykky pysäyttäisi pelaajan omasta
        // syystään, ja silloin mittari laskisi kyykkyä eikä maahaniskua.
        slam.i.held.down = false;
        if (slam.s.player.vx === 0) slamStill++;
        if (slam.s.lastPound && !outcome) {
          outcome = {
            killed: walkerB.remove || walkerB.dying,
            stunned: walkerB.bubbled || walkerB.harmless,
          };
          gap = Math.round(walkerB.cx - slam.s.player.cx);
        }
      }

      const lp = slam.s.lastPound;
      const stompKilled = walkerA.remove || walkerA.dying || walkerA.squash > 0;
      const slamKilled = !!outcome && outcome.killed;
      const slamStunned = !!outcome && outcome.stunned;
      expect('maahanisku ei korvaa tallausta: se maksaa ohjaamattomia frameja',
        slamStill - stompStill >= 24,
        `tallaus ${stompStill} framea ilman ohjausta, maahanisku ${slamStill}`
        + ` (ero ${slamStill - stompStill})`);
      expect('tavallisen hypyn korkeudelta isku tainnuttaa, tallaus tappaa',
        !!lp && stompKilled && !slamKilled && slamStunned,
        `voima ${lp ? lp.strength.toFixed(2) : 'ei iskua'}`
        + `, säde ${lp ? lp.reach : '-'} px ja kävelijä ${gap} px sivussa`
        + `, tallaus tappoi ${stompKilled}, isku tappoi ${slamKilled}`
        + `, isku tainnutti ${slamStunned}`);
    }

    /* 4. Piikit voittavat senkin — sekä sen alle jäänyt piikkiukko että se joka
     *    seisoo säteen sisällä. Muuten piikikkyys lakkaa tarkoittamasta mitään. */
    {
      /* a) Säteen sisällä mutta ei alla. Isku osuu maahan asti, joten säde on
       *    mitattavissa, ja piikkiukon pitää seistä siinä ehjänä vaikka aalto
       *    yltää sen yli. */
      const beside = setup({ power: { type: 'shroom', level: 3 } });
      const bp = beside.s.player;
      const guard = new SpikeGuy(beside.s, bp.x + 30, beside.standY + bp.h - 16);
      guard.active = true; guard.alwaysActive = true; guard.speed = 0; guard.vx = 0;
      beside.s.entities.push(guard);
      lift(beside.s, roomAbove(beside.s, bp));
      pound(beside.s, beside.i, 400);
      const lp = beside.s.lastPound;
      const gap = Math.round(guard.cx - bp.cx);
      expect('maahaniskun aalto ei kaada piikkiukkoa vaikka se yltää sen yli',
        !!lp && lp.reach >= gap && !guard.remove && !guard.dying && !guard.bubbled,
        lp ? `säde ${lp.reach} px, piikkiukko ${gap} px päässä, voima`
          + ` ${lp.strength.toFixed(2)}, hengissä ${!guard.remove && !guard.dying}`
          : 'iskua ei tullut');

      /* b) Ja suoraan piikkien päälle syöksyminen häviää täsmälleen kuten
       *    tallaus häviää. `sawDive` on siksi että pelkkä "pelaaja sattui" olisi
       *    yhtä hyvin voinut tarkoittaa että hän käveli päin. */
      const onto = setup({ power: { type: 'shroom', level: 3 } });
      const op = onto.s.player;
      const target = new SpikeGuy(onto.s, op.x, onto.standY + op.h - 16);
      target.active = true; target.alwaysActive = true; target.speed = 0; target.vx = 0;
      onto.s.entities.push(target);
      const levelBefore = op.powerLevel;
      lift(onto.s, onto.standY - 70);
      onto.i.held.down = true;
      onto.i.pressed.jump = true;
      onto.i.held.jump = true;
      let sawDive = false;
      for (let f = 0; f < 90; f++) {
        onto.s.update(onto.i);
        onto.i.pressed = blank();
        onto.i.held.jump = false;
        if (op.poundPhase === 'dive') sawDive = true;
      }
      expect('piikit voittavat maahaniskun täsmälleen kuten ne voittavat tallauksen',
        sawDive && !target.remove && !target.dying && !target.bubbled
        && op.powerLevel === levelBefore - 1,
        `syöksy nähtiin ${sawDive}, piikkiukko hengissä`
        + ` ${!target.remove && !target.dying}, voimataso ${levelBefore}->${op.powerLevel}`);
    }

    /* 5. Korkeusasteikko. Katto on `ty < 0`, joten suurin mahdollinen pudotus
     *    on laskeutumiskohdan oma y — mitattu luku, ei arvattu vakio. Kaksi
     *    kenttää joissa se luku on eri, ja molemmista katosta tehty isku on
     *    täydet 1,00. Vakioon sidottu asteikko ei voi antaa kumpaakin. */
    {
      const ceiling = [];
      for (const id of levelIds()) {
        if (ceiling.length >= 2 && Math.abs(ceiling[0].fall - ceiling[1].fall) > 60) break;
        let probe;
        try { probe = setup({ id }); } catch { continue; }
        const { s, i } = probe;
        if (roomAbove(s, s.player) !== 0) continue;
        lift(s, 0);
        pound(s, i, 400);
        if (!s.lastPound) continue;
        const row = { id, fall: s.lastPound.fall, room: s.lastPound.room, t: s.lastPound.strength };
        if (ceiling.length < 2) ceiling.push(row);
        else if (Math.abs(row.fall - ceiling[0].fall) > Math.abs(ceiling[1].fall - ceiling[0].fall)) {
          ceiling[1] = row;
        }
      }
      const both = ceiling.length === 2;
      const spread = both ? Math.abs(ceiling[0].fall - ceiling[1].fall) : 0;
      const full = ceiling.every((c) => c.t > 0.995);
      expect('korkeusasteikko on normalisoitu mitattuun kattoon eikä vakioon',
        both && full && spread > 40,
        ceiling.map((c) => `${c.id} pudotus ${Math.round(c.fall)}/${Math.round(c.room)} px`
          + ` = ${c.t.toFixed(3)}`).join(', ') + ` — ero ${Math.round(spread)} px`);
      // Ja sama väite puhtaana laskutoimituksena, ilman kenttää välissä.
      expect('asteikon laskukaava kestää kaksi eri kattoa ja puolikkaan pudotuksen',
        poundScale(0, 176) === 1 && poundScale(0, 400) === 1 && poundScale(88, 176) === 0.5
        && poundScale(176, 176) === 0,
        `176px->${poundScale(0, 176)}, 400px->${poundScale(0, 400)}`
        + `, puolikas ${poundScale(88, 176)}, nolla ${poundScale(176, 176)}`);
    }

    /* 6. Mitä korkeammalta, sitä kovempaa — sekä vahingoltaan että ruudulla. */
    {
      const low = setup();
      lift(low.s, low.standY - 40);
      pound(low.s, low.i, 200);
      const a = low.s.lastPound;

      const high = setup();
      lift(high.s, roomAbove(high.s, high.s.player));
      pound(high.s, high.i, 400);
      const b = high.s.lastPound;

      expect('isku kovenee korkeuden mukana: säde, tärinä ja vahinko',
        !!a && !!b && b.strength > a.strength && b.reach > a.reach && b.shake > a.shake
        && !a.kills && b.kills,
        a && b ? `matala ${a.strength.toFixed(2)}: säde ${a.reach} tärinä ${a.shake.toFixed(1)}`
          + ` tappaa ${a.kills} — korkea ${b.strength.toFixed(2)}: säde ${b.reach}`
          + ` tärinä ${b.shake.toFixed(1)} tappaa ${b.kills}`
          : 'iskuja ei tullut');
    }

    /* 7. Iskuaalto on voimatason vahvistama eikä avaama: voimatasolla 0
     *    ylimmästä mahdollisesta korkeudesta se syntyy, ja voimataso vain
     *    laskee kynnystä. */
    {
      const bare = setup();
      lift(bare.s, roomAbove(bare.s, bare.s.player));
      pound(bare.s, bare.i, 400);
      const top = bare.s.lastPound;

      const mid = setup();
      lift(mid.s, mid.standY - 70);
      pound(mid.s, mid.i, 200);
      const weak = mid.s.lastPound;

      const strong = setup({ power: { type: 'shroom', level: 5 } });
      lift(strong.s, strong.standY - 70);
      pound(strong.s, strong.i, 200);
      const boosted = strong.s.lastPound;

      expect('iskuaalto: voimataso 0 saa sen korkeudella, voimataso 5 halvemmalla',
        !!top && top.wave && !!weak && !weak.wave && !!boosted && boosted.wave,
        top && weak && boosted
          ? `voima 0 katosta ${top.strength.toFixed(2)} aalto ${top.wave}`
          + `, voima 0 hypystä ${weak.strength.toFixed(2)} aalto ${weak.wave}`
          + `, voima 5 hypystä ${boosted.strength.toFixed(2)} aalto ${boosted.wave}`
          : 'iskuja ei tullut');
    }

    /* 8. Ummetus tukkii kaasun, ja maahanisku on kaasua. Sama sääntö kuin
     *    pieruhypyllä, tehostushyökkäyksellä ja lennolla. */
    {
      const { s, i, standY } = setup({ power: { type: 'shroom', level: 2 } });
      lift(s, standY - 60);
      s.player.cork(300);
      i.held.down = true; i.pressed.jump = true; i.held.jump = true;
      s.update(i); i.pressed = blank();
      const corkedPhase = s.player.poundPhase;
      s.player.collect('soup');
      for (let f = 0; f < 24; f++) { s.update(i); i.pressed = blank(); }
      lift(s, standY - 60);
      i.pressed.jump = true; i.held.jump = true;
      s.update(i); i.pressed = blank();
      expect('ummetus tukkii maahaniskun, hernekeitto avaa sen',
        corkedPhase === '' && s.player.poundPhase !== '',
        `tukossa "${corkedPhase}", keiton jälkeen "${s.player.poundPhase}"`);
    }

    /* 9. Pikatallennus kesken syöksyn palaa kesken syöksyn — muuten
     *    savestate.js:n REGISTRY pudottaa liikkeen hiljaa pois. */
    {
      const { s, i, standY } = setup();
      game.pendingNode = WORLDS[0].nodes.find((n) => n.id === 'w1-1');
      lift(s, standY - 90);
      i.held.down = true; i.pressed.jump = true; i.held.jump = true;
      s.update(i); i.pressed = blank(); i.held.jump = false;
      let guard = 0;
      while (guard < 60 && s.player.poundPhase !== 'dive') { s.update(i); guard++; }
      for (let f = 0; f < 3; f++) s.update(i);
      const phase = s.player.poundPhase;
      const fromY = s.player.poundFromY;
      const midY = Math.round(s.player.y);
      const snap = captureState(game);
      restoreState(game, JSON.parse(JSON.stringify(snap)));
      const r = game.scene;
      const kept = r.player.poundPhase === phase && r.player.poundFromY === fromY
        && Math.round(r.player.y) === midY;
      let f = 0;
      while (f < 200 && !r.lastPound) { r.update(mkInput()); f++; }
      expect('pikatallennus kesken syöksyn palaa kesken syöksyn ja laskeutuu loppuun',
        kept && !!r.lastPound,
        `vaihe "${phase}" y ${midY} lähtö ${Math.round(fromY)}`
        + ` -> "${r.player.poundPhase}" y ${Math.round(r.player.y)}`
        + `, laskeutui ${f} framessa voimalla`
        + ` ${r.lastPound ? r.lastPound.strength.toFixed(2) : '-'}`);
    }

    /* 10. Pomon piikkisykli voittaa maahaniskun täsmälleen kuten tallauksen —
     *     ja avoimena ottaa osuman täsmälleen kuten tallauksesta.
     *
     *     Kahdella pomolla eikä yhdellä, ja jälkimmäinen on tässä siksi että
     *     luurankopomo (6-F, variantti 4) on ensimmäinen uusi pomo maahaniskun
     *     jälkeen. Sääntö "piikit voittavat senkin" on kirjoitettu
     *     `poundImpact`iin `e.spiky`-lipun varaan eikä varianttiluetteloon, eli
     *     sen *pitäisi* päteä uuteen pomoon ilmaiseksi — ja juuri sellainen
     *     väite kannattaa mitata, koska se on se joka rapautuu hiljaa. */
    for (const bossLevel of ['1-F', '6-F']) {
      const bossDive = (spiky) => {
        reset({ type: 'shroom', level: 3 });
        const s = new LevelScene(game, bossLevel);
        game.setScene(s);
        const i = mkInput();
        const boss = s.entities.find((e) => e.constructor.name === 'Boss');
        boss.speed = 0;
        boss.jumpTimer = 1e6;
        boss.chargeTimer = 1e6;
        boss.spikePhase = spiky ? 'spiky' : 'open';
        const p = s.player;
        p.x = boss.cx - p.w / 2;
        p.y = boss.y - p.h - 56;
        p.vy = 0;
        p.onGround = false;
        const hp0 = boss.hp;
        const lvl0 = p.powerLevel;
        i.held.down = true; i.pressed.jump = true; i.held.jump = true;
        s.update(i); i.pressed = blank(); i.held.jump = false;
        for (let f = 0; f < 90; f++) {
          boss.spikeTimer = 1e6;
          boss.doffTimer = 0;
          s.update(i);
        }
        return { hits: hp0 - boss.hp, lost: lvl0 - p.powerLevel };
      };
      const spikyRun = bossDive(true);
      const openRun = bossDive(false);
      expect(`${bossLevel}: pomon piikit voittavat maahaniskun, avoin pomo ottaa siitä osuman`,
        spikyRun.hits === 0 && spikyRun.lost === 1 && openRun.hits >= 1 && openRun.lost === 0,
        `piikeissä osumia ${spikyRun.hits} ja pelaaja menetti ${spikyRun.lost} tasoa`
        + `, avoinna osumia ${openRun.hits} ja menetti ${openRun.lost}`);
    }

    /* 11. DESIGN.md kohta 8: iskuaalto ei saa näyttää pomon iskuaallolta.
     *     Väri ja rytmi mitataan pikseleistä, koska "eri väriä" on väite jonka
     *     voi tarkistaa ja "näyttää erilaiselta" ei ole. */
    {
      const stage = setup();
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 40;
      const g = c.getContext('2d');
      const shot = (entity, tick) => {
        g.clearRect(0, 0, 96, 40);
        entity.tick = tick;
        if (entity instanceof PoundWave) entity.life = entity.maxLife - tick;
        entity.draw(g);
        return g.getImageData(0, 0, 96, 40).data;
      };
      const mean = (px) => {
        let r = 0; let gg = 0; let b = 0; let n = 0;
        for (let q = 0; q < px.length; q += 4) {
          if (px[q + 3] < 8) continue;
          r += px[q]; gg += px[q + 1]; b += px[q + 2]; n++;
        }
        return n ? [Math.round(r / n), Math.round(gg / n), Math.round(b / n)] : [0, 0, 0];
      };
      const distinct = (entity) => {
        const seen = new Set();
        for (let t = 0; t < 12; t++) seen.add([...shot(entity, t)].join(','));
        return seen.size;
      };

      const wave = new PoundWave(stage.s, 48, 24, 30);
      const boss = new Shockwave(stage.s, 42, 18, 1);
      const waveColor = mean(shot(wave, 3));
      const bossColor = mean(shot(boss, 3));
      const waveFrames = distinct(wave);
      const bossFrames = distinct(boss);
      // Kaasu on vihreää, pomon aalto ruskeaa: vihreän ja punaisen erotus on
      // se yksi luku joka erottaa ne toisistaan katsomatta kuvaa.
      const waveTilt = waveColor[1] - waveColor[0];
      const bossTilt = bossColor[1] - bossColor[0];
      expect('maahaniskun aalto on eri väriä ja eri rytmiä kuin pomon aalto',
        waveTilt > 20 && bossTilt < 0 && waveFrames >= 8 && bossFrames <= 3,
        `isku rgb(${waveColor.join(',')}) vihreä-punainen ${waveTilt}`
        + `, pomo rgb(${bossColor.join(',')}) ${bossTilt}`
        + `; eri ruutuja 12 framessa: isku ${waveFrames}, pomo ${bossFrames}`);
    }
  } catch (e) {
    expect('maahanisku-testit pääsevät ajoon asti', false, String(e && e.message));
  }

  /* ------------------------------ juoksuhiekka -------------------------- */
  /*
   * JUOKSUHIEKKA, ja se mitä siitä voi mennä rikki.
   *
   * Omistajan päätös 9.8.2026: "hiekka vetää hitaasti alas, mutta reagoimiseen
   * jää useita sekunteja". Se on **mitattava väite** eikä tunnelma, joten koko
   * lohko on rakennettu numeroiden ympärille: montako framea ensimmäisestä
   * kosketuksesta kuolemaan pienimmällä keholla, montako framea ulospääsy
   * maksaa voimatasolla 0, ja paljonko maahanisku syö varoajasta.
   *
   * "Juoksuhiekka on olemassa" ei todista mitään. Nämä ovat ne väitteet jotka
   * voi rikkoa yhdellä vakion muutoksella eikä huomata pelatessa:
   *
   *   - varoaika lyhenee tai katoaa (uhkasta tulee ansa)
   *   - matalasta kuopasta tulee tappava (ensimmäinen kohtaaminen ei enää opeta)
   *   - jostain kuopasta ei pääse ulos pienimmällä koolla (DESIGN.md kohta 5)
   *   - tähti alkaa kantaa hiekan yli (lupaus muuttuu vahingossa)
   *   - maahanisku ei tee hiekassa mitään (kaksi samana päivänä tullutta
   *     mekaniikkaa jotka eivät tiedä toisistaan)
   *
   * Koko lohko on try/catchissa samasta syystä kuin maahaniskun lohko: ensi
   * ajolla vienti puuttuu, ja kaatuva importti veisi mukanaan kaikki tämän
   * jälkeiset tarkistukset.
   */
  try {
    const { T } = await import('/src/gfx/tiles.js');
    const {
      QUICKSAND_GRACE, QUICKSAND_SINK, QUICKSAND_PLUNGE_FRAMES, QUICKSAND_WADE, MAX_WALK,
    } = await import('/src/entities/player.js');
    const { PLAYER_SIZES: SIZES } = await import('/src/gfx/sprites.js');

    /**
     * Kentän juoksuhiekkalammikot, vierekkäiset sarakkeet yhtenä. `top` on
     * pinta ja `bottom` alin hiekkarivi — syvyys on se luku josta koko
     * hukkumisväite riippuu, joten se luetaan kentästä eikä muisteta.
     */
    const poolsOf = (s) => {
      const cols = [];
      for (let tx = 0; tx < s.w; tx++) {
        let top = -1; let bottom = -1;
        for (let ty = 0; ty < s.h; ty++) {
          if (s.rawTileAt(tx, ty) !== T.QUICKSAND) continue;
          if (top < 0) top = ty;
          bottom = ty;
        }
        cols.push(top < 0 ? null : { top, bottom });
      }
      const pools = [];
      let run = null;
      for (let tx = 0; tx <= s.w; tx++) {
        const c = tx < s.w ? cols[tx] : null;
        if (c) {
          if (!run) run = { tx0: tx, tx1: tx, ...c };
          else {
            run.tx1 = tx;
            run.top = Math.min(run.top, c.top);
            run.bottom = Math.max(run.bottom, c.bottom);
          }
        } else if (run) { pools.push(run); run = null; }
      }
      return pools;
    };

    /** Kaikki kentät joissa on hiekkaa, lammikoineen. */
    const sandLevels = [];
    for (const id of levelIds()) {
      reset();
      const s = new LevelScene(game, id);
      const pools = poolsOf(s);
      if (pools.length) sandLevels.push({ id, pools });
    }

    /** Pelaaja lammikon keskelle, jalat täsmälleen pinnalla. */
    const dropInto = (s, pool) => {
      const p = s.player;
      p.x = Math.round(((pool.tx0 + pool.tx1 + 1) / 2) * 16 - p.w / 2);
      p.y = pool.top * 16 - p.h;
      p.vx = 0;
      p.vy = 0;
      p.onGround = false;
      p.sunk = 0;
      s.centerCamera();
    };

    /** Kenttä pystyyn ilman vihollisia ja ilman kelloa. */
    const sandScene = (id, power = { type: null, level: 0 }) => {
      reset(power);
      const s = new LevelScene(game, id);
      game.setScene(s);
      s.entities = s.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
      s.time = 9999;
      return s;
    };

    /**
     * Framet ensimmäisestä hiekkakosketuksesta kuolemaan, tai null jos ei kuole.
     * `press` saa painaa hyppyä; oletuksena pelaaja ei tee mitään, mikä on se
     * tapaus jota omistajan lause koskee.
     */
    const untilDeath = (s, i, cap = 900) => {
      let contact = -1;
      for (let f = 0; f < cap; f++) {
        s.update(i);
        i.pressed = blank();
        if (contact < 0 && s.player.inQuicksand) contact = f;
        if (s.player.dying) return contact < 0 ? f : f - contact;
      }
      return null;
    };

    const deepest = sandLevels
      .flatMap((l) => l.pools.map((p) => ({ id: l.id, pool: p })))
      .sort((a, b) => (b.pool.bottom - b.pool.top) - (a.pool.bottom - a.pool.top))[0];
    const shallowest = sandLevels
      .flatMap((l) => l.pools.map((p) => ({ id: l.id, pool: p })))
      .sort((a, b) => (a.pool.bottom - a.pool.top) - (b.pool.bottom - b.pool.top))[0];

    expect('aavikossa on juoksuhiekkaa, mutta ei joka kentässä',
      sandLevels.length >= 2 && sandLevels.length < levelIds().length,
      `${sandLevels.length}/${levelIds().length} kenttää: `
      + sandLevels.map((l) => `${l.id} ${l.pools.length} kpl`).join(', '));

    /* 1. "Useita sekunteja" numeroina. Pienin keho uppoaa ensimmäisenä, joten
     *    se on pahin tapaus, ja mittaus alkaa ensimmäisestä kosketuksesta. */
    {
      const s = sandScene(deepest.id);
      const i = mkInput();
      dropInto(s, deepest.pool);
      const frames = untilDeath(s, i);
      expect('syvä hiekka tappaa vasta useiden sekuntien kuluttua, ei heti',
        frames !== null && frames >= 150 && frames <= 250,
        frames === null
          ? `${deepest.id} ${(deepest.pool.bottom - deepest.pool.top + 1)} ruutua syvä: ei tappanut`
          : `${deepest.id}, keho ${SIZES[0].h} px, kuoppa `
            + `${(deepest.pool.bottom - deepest.pool.top + 1) * 16} px: ${frames} framea `
            + `(${(frames / 60).toFixed(2)} s), vajoamisnopeus ${QUICKSAND_SINK} px/frame, `
            + `varoaika ${QUICKSAND_GRACE} framea`);
    }

    /* 2. Ensimmäinen kohtaaminen ei saa tappaa. Matala kuoppa on pohjaa myöten
     *    matalampi kuin pienin keho, joten pää ei mene alle — ja se on
     *    geometriaa eikä ajastin, joten se pitää mitata eikä luvata. */
    {
      const s = sandScene(shallowest.id);
      const i = mkInput();
      dropInto(s, shallowest.pool);
      const frames = untilDeath(s, i, 900);
      const p = s.player;
      expect('matala kuoppa opettaa eikä tapa: pää ei mene pinnan alle',
        frames === null && !p.dying,
        `${shallowest.id}, kuoppa ${(shallowest.pool.bottom - shallowest.pool.top + 1) * 16} px, `
        + `keho ${SIZES[0].h} px: 900 framea, uppoama ${p.sunk} framea, `
        + `pää ${Math.round(shallowest.pool.top * 16 - p.y)} px pinnan yläpuolella`);
    }

    /* 3. DESIGN.md kohta 5 kuopittain. Ei abstraktisti vaan jokaisesta
     *    lammikosta erikseen: hiekka jonka reunalle ei pääse on ansa, ja
     *    varoaika tekee sijoittelusta koko työn. */
    {
      const stuck = [];
      let worst = 0;
      for (const { id, pools } of sandLevels) {
        for (const pool of pools) {
          const s = sandScene(id);
          const i = mkInput();
          dropInto(s, pool);
          /* From the FLOOR of the pool and not from the rim. Falling in is the
           * easy case — a kick on the first frame barely enters — and the case
           * that matters is the one the several seconds are spent reaching:
           * standing on the bottom with the whole depth to climb. */
          s.player.y = (pool.bottom + 1) * 16 - s.player.h;
          let out = -1;
          for (let f = 0; f < 600 && out < 0; f++) {
            const p = s.player;
            // Rimpuilu on hyppynapin hakkaamista, ja mitään muuta bottikaan ei
            // osaa: oikealle ja hyppy.
            i.held.right = true;
            i.held.jump = f % 4 < 2;
            i.pressed.jump = f % 4 === 0;
            s.update(i);
            i.pressed = blank();
            if (p.dying) break;
            if (!p.inQuicksand && p.onGround && p.y + p.h <= pool.top * 16 + 1) out = f;
          }
          if (out < 0) stuck.push(`${id} ${pool.tx0}-${pool.tx1}`);
          else worst = Math.max(worst, out);
        }
      }
      expect('jokaisesta hiekkakuopasta pääsee ulos voimatasolla 0',
        stuck.length === 0,
        stuck.length ? `jumissa: ${stuck.join(', ')}`
          : `${sandLevels.reduce((n, l) => n + l.pools.length, 0)} kuoppaa, hitain `
            + `${worst} framea (${(worst / 60).toFixed(2)} s)`);
      /* 3 b. Ja mitä se maksaa kellossa. Kello tikittää 24 framen välein, joten
       *      hitain ulospääsy on tämän verran aikayksiköitä — hinta on tarkoitus,
       *      mutta se ei saa olla merkittävä osa kentän kellosta. */
      const worstUnits = Math.ceil(worst / 24);
      const clocks = sandLevels.map((l) => {
        reset();
        return new LevelScene(game, l.id).time;
      });
      const tightest = Math.min(...clocks);
      expect('rimpuilu maksaa kelloa mutta ei kenttää',
        worstUnits < tightest * 0.05,
        `hitain ulospääsy ${worstUnits} aikayksikköä, tiukin kello ${tightest} `
        + `(${((worstUnits / tightest) * 100).toFixed(1)} %)`);
    }

    /* 4. Kaksi samana päivänä tullutta mekaniikkaa. Maahanisku ajaa alaspäin
     *    kovaa, joten hiekassa sen pitää haudata syvemmälle — ja siitä seuraa
     *    että se syö varoajan. Mitataan molemmat samasta kuopasta. */
    {
      const plain = (() => {
        const s = sandScene(deepest.id);
        const i = mkInput();
        dropInto(s, deepest.pool);
        return untilDeath(s, i);
      })();
      const s = sandScene(deepest.id);
      const i = mkInput();
      dropInto(s, deepest.pool);
      s.player.y = deepest.pool.top * 16 - s.player.h - 40;   // tilaa syöksylle
      i.held.down = true;
      i.pressed.jump = true;
      i.held.jump = true;
      s.update(i);
      i.pressed = blank();
      i.held.jump = false;
      const dived = untilDeath(s, i);
      expect('maahanisku hiekkaan hautaa syvemmälle ja syö varoajan',
        plain !== null && dived !== null && dived < plain * 0.8 && !s.lastPound,
        `pudotus ${plain} framea, maahanisku ${dived} framea `
        + `(${Math.round((1 - dived / plain) * 100)} % pois), painallusaalto: `
        + `${s.lastPound ? 'tuli' : 'ei tullut'}, syöksyn lisäuppoama `
        + `${QUICKSAND_PLUNGE_FRAMES} framea`);
    }

    /* 5. …ja matalassa kuopassa senkään ei pidä tappaa. Sama sääntö kuin
     *    kohdassa 2: ensimmäinen kohtaaminen opettaa, se ei rankaise. */
    {
      const s = sandScene(shallowest.id);
      const i = mkInput();
      dropInto(s, shallowest.pool);
      s.player.y = shallowest.pool.top * 16 - s.player.h - 40;
      i.held.down = true;
      i.pressed.jump = true;
      i.held.jump = true;
      s.update(i);
      i.pressed = blank();
      i.held.jump = false;
      const frames = untilDeath(s, i, 600);
      expect('maahanisku matalaan kuoppaan ei tapa',
        frames === null && !s.player.dying,
        `${shallowest.id}: 600 framea, uppoama ${s.player.sunk} framea`);
    }

    /* 6. Tähden lupaus, tarkalleen sellaisena kuin se on kirjattu: se suojaa
     *    vihollisilta ja piikeiltä, ei kentältä itseltään. Hiekka on kenttä. */
    {
      const s = sandScene(deepest.id);
      const i = mkInput();
      dropInto(s, deepest.pool);
      s.player.collect('star');
      const frames = untilDeath(s, i);
      expect('supertähti ei kanna juoksuhiekan yli',
        frames !== null,
        frames === null ? 'tähdellä ei kuollut lainkaan'
          : `tähti päällä ${s.player.star} framea jäljellä, kuoli ${frames} framessa`);
    }

    /* 7. Isompi keho pitää päänsä pinnalla. Tämä ei ole armo vaan geometria,
     *    ja se on kirjattava numerona: kuoppa on matalampi kuin keho. */
    {
      const depth = (deepest.pool.bottom - deepest.pool.top + 1) * 16;
      const drowns = [];
      for (let lvl = 0; lvl <= 5; lvl++) {
        const s = sandScene(deepest.id, { type: 'shroom', level: lvl });
        const i = mkInput();
        dropInto(s, deepest.pool);
        if (untilDeath(s, i) !== null) drowns.push(lvl);
      }
      const tall = SIZES.map((z, n) => (z.h >= depth ? n : -1)).filter((n) => n >= 0);
      expect('hiekka ei hukuta kehoa joka on kuoppaa pidempi',
        drowns.length > 0 && !drowns.some((n) => tall.includes(n)),
        `kuoppa ${depth} px, kehot ${SIZES.map((z) => z.h).join('/')} px — `
        + `hukkuvat voimatasot ${drowns.join(',') || 'ei yksikään'}`);
    }

    /* 8. Hiekka on hidas, ja se mitataan kuljettuna matkana eikä pelkkänä
     *    nopeuslukuna: seinään puskeva pelaaja näyttää hitaalta myös silloin
     *    kun hiekka ei hidasta mitään. Siksi lähtö on lammikon vasemmasta
     *    reunasta, jotta 40 framen matka mahtuu lammikkoon. */
    {
      const s = sandScene(deepest.id);
      const i = mkInput();
      dropInto(s, deepest.pool);
      s.player.x = deepest.pool.tx0 * 16;
      for (let f = 0; f < 20; f++) { s.update(i); i.pressed = blank(); }
      const from = s.player.x;
      i.held.right = true;
      i.held.run = true;
      for (let f = 0; f < 40; f++) { s.update(i); i.pressed = blank(); }
      const inSand = Math.abs(s.player.vx);
      const sandRun = s.player.x - from;
      const s2 = sandScene(deepest.id);
      const i2 = mkInput();
      const from2 = s2.player.x;
      i2.held.right = true;
      i2.held.run = true;
      for (let f = 0; f < 40; f++) { s2.update(i2); i2.pressed = blank(); }
      const onSand = Math.abs(s2.player.vx);
      const groundRun = s2.player.x - from2;
      /* Väite on sidottu olemassa olevaan vakioon eikä valittuun suhdelukuun:
       * kahlauskaton pitää olla alle puolet kävelykatosta, eli hiekassa
       * liikkuminen on hitaampaa kuin hitain tapa liikkua maalla. Kuljettu
       * matka on mukana siksi, ettei katto jäisi pelkäksi luvuksi jota kukaan
       * ei koskaan saavuta. */
      expect('hiekassa kahlataan, päällä juostaan',
        inSand > 0.1 && inSand <= QUICKSAND_WADE + 0.01
        && QUICKSAND_WADE < MAX_WALK / 2 && sandRun < groundRun,
        `hiekassa ${inSand.toFixed(2)} px/frame ja ${Math.round(sandRun)} px 40 framessa, `
        + `maalla ${onSand.toFixed(2)} px/frame ja ${Math.round(groundRun)} px; `
        + `kahlauskatto ${QUICKSAND_WADE} vastaan kävelykatto ${MAX_WALK}`);
    }

    /* 9. Pikatallennus keskellä uppoamista. `savestate.js` sarjallistaa jokaisen
     *    oman kentän, joten tämä on ilmaista — mutta juuri siksi se on myös se
     *    joka rikkoutuu hiljaa, jos uppoaminen joskus siirretään kohtaukseen. */
    {
      const s = sandScene(deepest.id);
      const i = mkInput();
      dropInto(s, deepest.pool);
      for (let f = 0; f < 140; f++) { s.update(i); i.pressed = blank(); }
      const before = { sunk: s.player.sunk, y: Math.round(s.player.y) };
      const snap = captureState(game);
      restoreState(game, snap);
      const p2 = game.scene.player;
      expect('pikatallennus kesken uppoamisen palaa kesken uppoamista',
        before.sunk > 0 && p2.sunk === before.sunk && Math.round(p2.y) === before.y,
        `ennen uppoama ${before.sunk} framea y=${before.y}, `
        + `jälkeen ${p2.sunk} framea y=${Math.round(p2.y)}`);
    }

    /* ------------------- 10. hiekka ja se mikä siihen kävelee ------------ */
    /*
     * Punainen ennen vihreää (DESIGN.md kohta 7) toiselle puoliskolle:
     * **hiekka ei tiennyt vihollisista mitään.**
     *
     * Hiekka on ruutu eikä osuma, joten se koskee kaikkea mikä seisoo lattialla
     * — ja siihen asti se koski vain pelaajaa. Kävelijä joka päätyi lammikkoon
     * putosi sen pohjalle ja jatkoi kävelyä siellä, koko keho pinnan alla,
     * näkymättömänä. Se ei näyttänyt bugilta vaan vitsiltä, ja tänään sen esti
     * pelkkä sijoittelu: 2-1:n ja 2-3:n penkat aitaavat kävelijät lammikoiden
     * ulkopuolelle. Sijoittelurajoite on rajoite vain niin kauan kuin kukaan ei
     * siirrä mitään, ja juuri se on se laji jota testi on olemassa varten.
     *
     * Mitattavat väitteet, ja jokainen niistä on päätös eikä sivutuote:
     *
     *   a. syvässä lammikossa vihollinen uppoaa ja katoaa — samalla kellolla
     *      kuin pelaaja, koska se on sama hiekka
     *   b. matalassa se ei voi hukkua, koska geometria on sama molemmille
     *   c. hukkuminen ei maksa pisteitä (ks. kuilu: sekään ei maksa)
     *   d. pikatallennus kesken vihollisen uppoamista palaa kesken uppoamista
     *   e. merkkinä on hiekan oma pöly, ei pelaajan hukkumisääni
     *   f. jokainen painovoiman varassa liikkuva vihollinen on **päättänyt**
     *      uppoamisestaan — sama portti kuin `ENEMY_COST`
     *   g. ja koko kauppa on tavoitettavissa julkaistussa kentässä eikä vain
     *      koeasetelmassa: 2-1:n kuori potkaistuna vasemmalle
     */
    {
      const enemies = await import('/src/entities/enemies.js');
      const { Sfx } = await import('/src/core/audio.js');

      /** Kaikki neljä lattiakävelijää ja lentäjä, merkkeineen. */
      const species = [['g', enemies.Walker], ['k', enemies.ShellGuy],
        ['x', enemies.SpikeGuy], ['c', enemies.CorkGuy], ['f', enemies.Flyer]];

      /**
       * Yksi vihollinen lammikon keskelle, jalat täsmälleen pinnalla — sama
       * lähtöasento kuin `dropInto` antaa pelaajalle, jotta luvut ovat
       * vertailukelpoisia sen kanssa.
       */
      const dropEnemy = (s, pool, Ctor) => {
        const mid = Math.round(((pool.tx0 + pool.tx1 + 1) / 2) * 16);
        const e = new Ctor(s, mid, pool.top * 16);
        e.x = mid - e.w / 2;
        e.y = pool.top * 16 - e.h;
        e.vx = 0;
        e.vy = 0;
        e.active = true;
        e.alwaysActive = true;
        s.add(e);
        return e;
      };

      /** Ajaa lammikkoa kunnes vihollinen katoaa, ja kertoo mitä matkalla tapahtui. */
      const sinkRun = (id, pool, Ctor, cap = 900) => {
        const s = sandScene(id);
        s.player.x = 16;
        s.player.y = 8 * 16;
        const e = dropEnemy(s, pool, Ctor);
        const i = mkInput();
        const startX = e.x;
        let buried = 0;
        let gone = null;
        for (let f = 0; f < cap; f++) {
          s.update(i);
          if (e.y >= pool.top * 16 + 1) buried++;
          if (e.remove || !s.entities.includes(e)) { gone = f; break; }
        }
        return { gone, buried, dx: Math.round(e.x - startX), e, s };
      };

      /* a. Syvä lammikko: uppoaa ja katoaa, eikä kävele pohjalla. Yläraja on
       *    pelaajan oma lukema — sama hiekka, sama kello — ja alaraja on se
       *    että uppoaminen on uppoamista eikä katoamista kosketuksesta. */
      {
        const rows = [];
        for (const [ch, Ctor] of species) {
          const r = sinkRun(deepest.id, deepest.pool, Ctor);
          rows.push({ ch, gone: r.gone, buried: r.buried });
        }
        expect('syvä hiekka ottaa myös vihollisen, eikä se jää kävelemään pohjalle',
          rows.every((r) => r.gone !== null && r.gone > 60 && r.gone < 400),
          rows.map((r) => `${r.ch}: ${r.gone === null ? 'ei koskaan' : `${r.gone} framea`}`
            + `, ${r.buried} framea pinnan alla`).join(', '));
      }

      /* b. Matala lammikko ei hukuta ketään, ja se on sama geometria jolla se
       *    ei hukuta pelaajaakaan: keho on kuoppaa pidempi. Tämä on vihreä jo
       *    ennen korjausta ja on se puoli jota korjaus ei saa rikkoa. */
      {
        const rows = [];
        for (const [ch, Ctor] of species) {
          const r = sinkRun(shallowest.id, shallowest.pool, Ctor, 600);
          rows.push({ ch, gone: r.gone, top: Math.round(r.e.y - shallowest.pool.top * 16) });
        }
        const depth = (shallowest.pool.bottom - shallowest.pool.top + 1) * 16;
        expect('matala hiekka ei hukuta vihollista sen enempää kuin pelaajaa',
          rows.every((r) => r.gone === null),
          `kuoppa ${depth} px — ` + rows.map((r) => `${r.ch} ${r.gone === null ? 'jäi' : 'katosi'}`
            + ` (pää ${r.top > 0 ? '+' : ''}${r.top} px pinnasta)`).join(', '));
      }

      /* c. Hiekkaan hukkunut vihollinen ei maksa mitään. Ennakkotapaus on
       *    kuilu: kentän pohjan läpi pudonnut vihollinen katoaa ilmaiseksi jo
       *    nyt, ja hukkuminen on sama tapahtuma kansi päällä. Piste maksetaan
       *    tässä pelissä siitä mitä pelaaja teki, ei siitä mitä huone teki. */
      {
        reset();
        const r = sinkRun(deepest.id, deepest.pool, enemies.Walker);
        expect('hiekkaan hukkunut vihollinen ei maksa pisteitä',
          r.gone !== null && game.state.score === 0,
          `kävelijä katosi ${r.gone === null ? 'ei koskaan' : `${r.gone} framessa`}, `
          + `pisteet ${game.state.score}`);
      }

      /* d. Pikatallennus kesken vihollisen uppoamista. Sama väite kuin
       *    kohdassa 9 pelaajalle, ja samasta syystä: uppoaminen on tavallisia
       *    lukuja oliossa, joten `REGISTRY` kantaa sen ilman tallennuskoodia. */
      {
        const s = sandScene(deepest.id);
        game.setScene(s);
        s.player.x = 16;
        s.player.y = 8 * 16;
        const e = dropEnemy(s, deepest.pool, enemies.Walker);
        const i = mkInput();
        for (let f = 0; f < 140; f++) { s.update(i); i.pressed = blank(); }
        const before = { sunk: e.sunk, y: Math.round(e.y) };
        const snap = captureState(game);
        restoreState(game, snap);
        const e2 = game.scene.entities.find((z) => z.constructor.name === 'Walker');
        expect('pikatallennus kesken vihollisen uppoamista palaa kesken uppoamista',
          before.sunk > 0 && !!e2 && e2.sunk === before.sunk && Math.round(e2.y) === before.y,
          `ennen uppoama ${before.sunk} framea y=${before.y}, jälkeen `
          + `${e2 ? `${e2.sunk} framea y=${Math.round(e2.y)}` : 'ei kävelijää'}`);
      }

      /* e. Kuva ja ääni (DESIGN.md kohta 8). Uppoava vihollinen tarvitsee
       *    merkin, mutta se ei saa olla **pelaajan oma** merkki: `upota` ja
       *    `kahlaa` ovat lauseita "sinut sai kiinni", ja aavikossa lammikko voi
       *    olla ruudun ulkopuolella. Ääni ilman näkyvää syytä opettaisi
       *    katsomaan alas silloin kun mitään ei ole. Jäljelle jää hiekan oma
       *    pöly, joka on sama pöly kummalle tahansa keholle. */
      {
        const heard = [];
        const realPlay = Sfx.play;
        Sfx.play = function (name, ...rest) { heard.push(name); return realPlay.call(this, name, ...rest); };
        let puffs = 0;
        try {
          const s = sandScene(deepest.id);
          s.player.x = 16;
          s.player.y = 8 * 16;
          const e = dropEnemy(s, deepest.pool, enemies.Walker);
          const i = mkInput();
          const seen = new Set();
          for (let f = 0; f < 400; f++) {
            s.update(i);
            for (const z of s.entities) {
              if (z.constructor.name === 'Puff' && !seen.has(z.id)) { seen.add(z.id); puffs++; }
            }
            if (e.remove) break;
          }
        } finally {
          Sfx.play = realPlay;
        }
        const borrowed = heard.filter((n) => n === 'upota' || n === 'kahlaa');
        expect('uppoavan vihollisen merkki on hiekan pöly, ei pelaajan hukkumisääni',
          puffs >= 8 && borrowed.length === 0,
          `${puffs} pölyhiukkasta, pelaajan ääniä ${borrowed.length}`
          + `${heard.length ? ` (kuultiin: ${[...new Set(heard)].join(',') || 'ei mitään'})` : ''}`);
      }

      /* f. Portti, ja se on sama portti kuin `ENEMY_COST`.
       *
       * Vihollinen joka putoaa painovoiman varassa on vihollinen joka voi
       * päätyä hiekkaan, joten sen on **sanottava** kumpaa se on. Oletusarvoa
       * ei ole kummallakaan puolella: `true` oletuksena upottaisi hiljaa
       * seuraavan lentävän, `false` oletuksena jättäisi seuraavan kävelijän
       * kävelemään pohjalla — ja juuri jälkimmäinen on se bugi jota tämä lohko
       * korjaa. Kysymys esitetään vain niiltä joita se koskee: luokan oma
       * `update` kertoo lähdetekstissään käyttääkö se `applyGravity`ä, ja koodi
       * on ajossa sellaisenaan (ei käännösvaihetta, DESIGN.md kohta 7).
       */
      {
        const classes = Object.entries(enemies)
          .filter(([, v]) => typeof v === 'function' && v.prototype instanceof enemies.Enemy);
        const undecided = [];
        const silent = [];
        for (const [name, Ctor] of classes) {
          const src = String(Ctor.prototype.update || '');
          const owns = Object.prototype.hasOwnProperty.call(Ctor.prototype, 'sinks');
          if (/applyGravity\(/.test(src) && !owns) undecided.push(name);
          if (owns && Ctor.prototype.sinks && !/this\.sink\(\)/.test(src)) silent.push(name);
        }
        const sinkers = classes.filter(([, C]) => C.prototype.sinks).map(([n]) => n);
        expect('jokainen painovoiman varassa oleva vihollinen on päättänyt hiekasta',
          undecided.length === 0 && silent.length === 0 && sinkers.length >= 4,
          undecided.length || silent.length
            ? `päättämättä: ${undecided.join(',') || '-'}; ilmoittaa uppoavansa muttei kysy `
              + `hiekalta: ${silent.join(',') || '-'}`
            : `${classes.length} luokkaa, uppoavat: ${sinkers.join(' ')}`);
      }

      /* g. Ja se että tämä on tavoitettavissa oikeassa kentässä eikä vain
       *    koeasetelmassa. 2-1:n ainoa kuori seisoo lammikon oikealla puolella,
       *    joten vasemmalle potkaistu kuori päätyy hiekkaan — ja se on koko
       *    kauppa jonka mekaniikka tarjoaa: väline vaihtuu roskikseen. Jos
       *    joku joskus siirtää kumpaa tahansa palikkaa, tämä kertoo sen. */
      {
        reset({ type: 'leaf', level: 3 });
        const s = new LevelScene(game, '2-1');
        game.setScene(s);
        s.time = 9999;
        const shell = s.entities.find((e) => e.constructor.name === 'ShellGuy');
        const sand = [];
        for (let tx = 0; tx < s.w; tx++) {
          if (s.rawTileAt(tx, 13) === T.QUICKSAND) sand.push(tx);
        }
        let gone = null;
        let col = null;
        if (shell && sand.length) {
          shell.alwaysActive = true;
          shell.active = true;
          shell.toShell();
          shell.kick(-1);
          s.player.x = shell.x + 60;
          s.player.y = shell.y - 40;
          const i = mkInput();
          for (let f = 0; f < 600; f++) {
            s.update(i);
            if (shell.remove) { gone = f; break; }
          }
          col = Math.floor(shell.cx / 16);
        }
        expect('2-1:ssä vasemmalle potkaistu kuori päätyy hiekkaan eikä ohi',
          gone !== null && sand.includes(col),
          `kuori sarakkeessa ${col}, hiekka ${sand[0]}–${sand[sand.length - 1]}, `
          + `katosi ${gone === null ? 'ei koskaan' : `${gone} framessa`}`);
      }
    }
  } catch (e) {
    expect('juoksuhiekan testit pääsevät ajoon asti', false, String(e && e.message));
  }

  /* ------------------------------ KURNUTTAJA ---------------------------- */
  /*
   * KUILUSTA LOIKKAAVA — ja se mitä siitä pitää todistaa.
   *
   * Kuilu on tähän asti ollut binäärinen: joko ylität sen tai kuolet. Kun
   * kuiluun pannaan olento, vaaralliseksi muuttuu **ilma kuilun yllä** — juuri
   * se paikka jossa pelaajalla on vähiten ohjausta, kesken hyppyä ja sidottuna,
   * pelkkä vauhti jäljellä. Huolimattomasti tehtynä se muuttaa hypyn, jonka
   * pelaaja itse valitsi, kuolemaksi jota hän ei voinut välttää. Siksi
   * "vihollinen on olemassa" ei todista tästä mitään, ja alla mitataan viisi
   * asiaa jotka voivat mennä pieleen:
   *
   *   1. varoitus ehtii ennen kuin hyppy on sidottu
   *   2. sykli on deterministinen — myös pikatallennuksen yli
   *   3. loikka pysyy omassa sarakkeessaan, eli maassa seisova on turvassa
   *   4. tapposäännöt: ei tallausta, mutta pierupallo ja tähti purevat
   *   5. maahanisku ei yletä kuiluun, eikä kuiluun sukeltaminen ole vastaus
   *
   * Koko lohko on try/catchissa samasta syystä kuin maahanisku-lohko: puuttuva
   * vienti kaataisi dynaamisen importin ja veisi mukanaan kaiken tämän
   * jälkeisen, jolloin punaisesta ei näkisi mitään.
   */
  try {
    const { Kurnuttaja, KURN_WAIT, KURN_WARN } = await import('/src/entities/enemies.js');
    const budget = await (await fetch('/tools/jump-budget.json')).json();

    /** Yksi kurnuttaja tyhjiössä: oma kenttä, ei muita vihollisia häiritsemässä. */
    const lone = (power = { type: null, level: 0 }, lipY = 208) => {
      reset(power);
      const s = new LevelScene(game, '1-1');
      game.setScene(s);
      s.entities = s.entities.filter((e) => e.kind !== 'enemy');
      const k = new Kurnuttaja(s, 40 * 16, lipY);
      k.active = true;
      k.alwaysActive = true;
      s.entities.push(k);
      return { s, k };
    };

    /**
     * Yhden syklin muoto frameina: milloin varoitus alkaa, milloin ruumis voi
     * satuttaa, milloin loikka on ohi. Luetaan olion omasta tilasta eikä
     * vakioista, koska juuri vakion ja käytöksen ero on se mikä rapautuu.
     */
    const cycle = (k, frames = 1200) => {
      const out = [];
      let warnAt = -1;
      let hurtAt = -1;
      for (let f = 0; f < frames; f++) {
        const wasWarn = k.warning > 0;
        const wasHurt = !k.harmless;
        k.update();
        if (!wasWarn && k.warning > 0) warnAt = f;
        if (!wasHurt && !k.harmless) hurtAt = f;
        if (wasHurt && k.harmless && warnAt >= 0 && hurtAt >= 0) {
          out.push({ warnAt, hurtAt, doneAt: f, lead: hurtAt - warnAt });
          warnAt = -1;
          hurtAt = -1;
        }
      }
      return out;
    };

    /*
     * 1. VAROITUS ENNEN SITOUTUMISTA, MITATTUNA LENNON PITUUTTA VASTAAN.
     *
     * Väite on tämä: jos varoitus kestää vähintään yhtä kauan kuin pisin
     * voimatason 0 hyppy on ilmassa, niin **jokainen loikka joka voi osua
     * lentävään pelaajaan oli varoitettu ennen kuin hän lähti maasta**. Todistus
     * on kolme riviä: varoitus alkaa framella t, loikka framella t+W, pelaaja
     * lähtee framella u ja laskeutuu framella u+A. Osuma edellyttää t+W < u+A,
     * eli t < u + (A-W); jos W >= A, niin t < u.
     *
     * A luetaan mitatusta hyppybudjetista (`tools/measure-jump.mjs`) eikä
     * arvata. Pieruhypyn tapaus jätetään ulos tarkoituksella: se on pelin ainoa
     * hyppy jonka voi *muuttaa kesken kaiken*, eli se ei ole sitoutuminen samalla
     * tavalla — ja DESIGN.md kohta 5 sanoo muutenkin että tehostus avaa
     * paikkoja, ei kenttää, joten lupaus mitataan voimatasolta 0.
     */
    {
      const power0 = budget.cases.filter((c) => !/fart|pieru/i.test(c.label));
      const airborne = Math.max(...power0.map((c) => c.frames));
      const longest = power0.find((c) => c.frames === airborne);
      const { k } = lone();
      const laps = cycle(k);
      const leads = laps.map((l) => l.lead);
      const minLead = leads.length ? Math.min(...leads) : -1;
      expect('kurnuttajan varoitus kestää pidempään kuin pisin voimatason 0 hyppy on ilmassa',
        laps.length >= 3 && minLead >= airborne,
        `varoitus ${minLead} framea (vakio ${KURN_WARN}), pisin hyppy ilmassa ${airborne}`
        + ` framea ("${longest ? longest.label : '?'}"), pelivara ${minLead - airborne}`
        + ` framea; juoksuvauhdilla 2,5 px/frame varoitus on ${Math.round(minLead * 2.5)} px`
        + ` eli ${(minLead * 2.5 / 16).toFixed(1)} ruutua lähestymistä`);
    }

    /*
     * 2. SYKLI ON DETERMINISTINEN. Pomon piikkisykli on, ja tiekartta nimeää sen
     *    hyveeksi. Kaksi oliota jotka heräsivät samalla framella ovat framen
     *    tarkkuudella samassa tahdissa, ja peräkkäiset kierrokset ovat yhtä
     *    pitkiä — jälkimmäinen on se joka kaatuisi jos syklissä olisi
     *    `Math.random()`.
     */
    {
      const a = lone();
      const b = lone();
      const one = cycle(a.k);
      const two = cycle(b.k);
      const same = JSON.stringify(one) === JSON.stringify(two);
      const lengths = one.slice(1).map((l, i) => l.warnAt - one[i].warnAt);
      const steady = lengths.length > 0 && lengths.every((v) => v === lengths[0]);
      expect('kurnuttajan sykli on deterministinen ja joka kierros yhtä pitkä',
        same && steady,
        `${one.length} kierrosta, pituudet ${lengths.join('/')} framea`
        + ` (odotus ${KURN_WAIT} + varoitus ${KURN_WARN} + loikka)`
        + `, kaksi oliota samassa tahdissa: ${same}`);
    }

    /* 3. Ja pikatallennus palaa samaan rytmiin. `savestate.js` sarjallistaa
     *    entiteetin omat kentät, joten tämä kaatuu jos luokka puuttuu
     *    REGISTRYstä — silloin kurnuttaja katoaa tallennuksesta kokonaan. */
    {
      const { s, k } = lone();
      game.pendingNode = WORLDS[0].nodes.find((n) => n.id === 'w1-1');
      while (k.phase !== 'warn') k.update();
      for (let f = 0; f < 20; f++) k.update();
      const before = { phase: k.phase, timer: k.timer, y: Math.round(k.y) };
      const snap = captureState(game);
      restoreState(game, JSON.parse(JSON.stringify(snap)));
      const r = game.scene;
      const back = r.entities.find((e) => e.constructor.name === 'Kurnuttaja');
      const after = back
        ? { phase: back.phase, timer: back.timer, y: Math.round(back.y) } : null;
      let mine = -1;
      let theirs = -1;
      for (let f = 0; f < 400; f++) {
        if (mine < 0 && !k.harmless) mine = f;
        if (after && theirs < 0 && !back.harmless) theirs = f;
        k.update();
        if (back) back.update();
      }
      expect('pikatallennus palauttaa kurnuttajan samaan kohtaan sykliä',
        !!after && JSON.stringify(before) === JSON.stringify(after) && mine === theirs && mine > 0,
        `ennen ${JSON.stringify(before)}, jälkeen ${JSON.stringify(after)}`
        + `, loikka ${mine} vs ${theirs} framen päästä`);
    }

    /*
     * 4. LOIKKA PYSYY OMASSA SARAKKEESSAAN.
     *
     * Tämä on se sääntö joka tekee tästä ajoitustehtävän eikä ansan: vaara on
     * täsmälleen kuilun yllä oleva ilma, eikä koskaan sen reunalla oleva maa.
     * Mitataan molemmat päät — että x ei liiku lainkaan, ja että reunalla
     * seisova pelaaja selviää kahdesta kokonaisesta kierroksesta ehjin nahoin.
     */
    {
      const { s, k } = lone();
      const x0 = k.x;
      let drift = 0;
      let top = k.y;
      for (let f = 0; f < 600; f++) {
        k.update();
        drift = Math.max(drift, Math.abs(k.x - x0));
        top = Math.min(top, k.y);
      }
      const rise = Math.round(k.lipY - top);

      const stage = lone();
      const p = stage.s.player;
      const i = mkInput();
      for (let f = 0; f < 4; f++) { stage.s.update(i); i.pressed = blank(); }
      // Pelaaja seisomaan täsmälleen kuilun reunalle, olennon viereen.
      stage.k.x = p.cx + 48 - 8;
      stage.k.lipY = p.y + p.h;
      stage.k.restY = stage.k.lipY + 32;
      stage.k.y = stage.k.restY;
      const level0 = p.powerLevel;
      for (let f = 0; f < 600; f++) { stage.s.update(i); i.pressed = blank(); }
      expect('loikka pysyy kuilun sarakkeessa: reunalla seisova ei voi jäädä alle',
        drift === 0 && rise > 32 && !p.dying && p.powerLevel === level0,
        `x liikkui ${drift} px, loikka nousi ${rise} px reunan yli`
        + `, reunalla seisonut voimataso ${level0}->${p.powerLevel}`);
    }

    /*
     * 5. TAPPOSÄÄNNÖT.
     *
     * Tallaus ei käy, ja syy on se että kuilun yllä olevaan olentoon
     * laskeutuminen tarkoittaa kuilun ylle laskeutumista: peli tarjoaisi
     * vastauksen joka tappaa vastaajan. "Odota" on jo pelin opettama laillinen
     * vastaus (närästyssuihkuun ei voi hypätä lainkaan). Kaikki muu puree kuten
     * putkikasviin: pierupallo, häntä ja liukuva kuori.
     */
    {
      const { s, k } = lone({ type: 'shroom', level: 1 });
      const p = s.player;
      const i = mkInput();
      for (let f = 0; f < 4; f++) { s.update(i); i.pressed = blank(); }
      k.lipY = p.y + p.h;
      k.restY = k.lipY + 32;
      k.phase = 'leap';
      k.y = k.lipY - 24;
      k.vy = -2;
      k.x = p.cx - 8;
      const level0 = p.powerLevel;
      p.y = k.y - p.h - 2;
      p.vy = 4;
      p.onGround = false;
      for (let f = 0; f < 4 && !p.dying; f++) s.update(i);
      const stompedIt = k.remove || k.dying;

      const shot = lone();
      shot.k.phase = 'leap';
      shot.k.y = shot.k.lipY - 24;
      shot.k.hitByProjectile(1);

      expect('kurnuttajaa ei voi tallata, mutta pierupallo kaataa sen',
        k.stompable === false && !stompedIt && p.powerLevel === level0 - 1
        && (shot.k.dying || shot.k.remove),
        `tallattava ${k.stompable}, tallaus tappoi ${stompedIt}`
        + `, pelaajan voimataso ${level0}->${p.powerLevel}`
        + `, pierupallo tappoi ${shot.k.dying || shot.k.remove}`);
    }

    /*
     * 6. SUPERTÄHTI. Se suojaa kentän asukeilta ja nimenomaan ei kentältä
     *    itseltään — kuilu, laava ja kello ovat sen ulkopuolella. Kurnuttaja on
     *    asukki kuilun yllä, joten se on tähden puolella rajaa; kuilu sen alla
     *    ei ole, ja tämä mittaa molemmat samassa testissä.
     */
    {
      const { s, k } = lone();
      const p = s.player;
      const i = mkInput();
      for (let f = 0; f < 4; f++) { s.update(i); i.pressed = blank(); }
      p.collect('star');
      k.lipY = p.y + p.h;
      k.restY = k.lipY + 32;
      k.phase = 'leap';
      k.y = k.lipY - 20;
      k.vy = -2;
      k.x = p.cx - 8;
      const level0 = p.powerLevel;
      s.collisions();
      const killed = k.dying || k.remove;
      const unhurt = !p.dying && p.powerLevel === level0;

      // ...ja sama tähti ei kanna kuilun yli. Syy luetaan siitä mitä kohtaus
      // kirjaa, koska pelkkä "kuoli" ei erottaisi kuilua vihollisesta.
      let cause = '';
      s.onPlayerDied = (why) => { cause = why; };
      p.y = s.heightPx + 40;
      s.playerTiles();
      expect('supertähti kantaa kurnuttajan yli mutta ei kuilun yli',
        killed && unhurt && p.dying && cause === 'pit',
        `tähti tappoi olennon ${killed}, pelaaja ehjä ${unhurt}`
        + `, kuiluun pudonnut kuoli syystä "${cause}"`);
    }

    /*
     * 7. MAAHANISKU (v26.08.09.31), ja vastaus tulee geometriasta eikä lipusta.
     *
     * Iskuaalto juoksee lattiaa pitkin, ja lattia loppuu kuilun reunaan. Se ei
     * ole erikoistapaus koodissa vaan mitattava luku: iskun säde voimatasolla 0
     * vastaan matka reunalta kuilun keskelle. Kurnuttaja EI ole piikikäs — jos
     * se olisi, "piikit" lakkaisi tarkoittamasta piikkejä — vaan isku ei
     * yksinkertaisesti ulotu sinne. Ja kuiluun sukeltaminen on jo kuolema.
     */
    {
      const half = (budget.gapTiles * 16) / 2;
      const { s } = lone();
      const p = s.player;
      const i = mkInput();
      for (let f = 0; f < 8; f++) { s.update(i); i.pressed = blank(); }
      s.entities = s.entities.filter((e) => e.kind !== 'enemy');
      const standY = p.y;
      p.y = standY - 90;
      p.vy = 0;
      p.onGround = false;
      i.held.down = true;
      i.pressed.jump = true;
      i.held.jump = true;
      s.update(i);
      i.pressed = blank();
      i.held.jump = false;
      i.held.down = false;
      let f = 1;
      while (f < 400 && !s.lastPound) { s.update(i); f++; }
      const lp = s.lastPound;
      const probe = new Kurnuttaja(s, 0, 208);
      expect('maahanisku ei yletä kuilun keskelle, eikä kurnuttaja ole piikikäs',
        !!lp && lp.reach < half && probe.spiky === false,
        `iskun säde ${lp ? lp.reach : '-'} px voimatasolla ${p.powerLevel}`
        + `, matka reunalta ${budget.gapTiles} ruudun kuilun keskelle ${half} px`
        + `, piikikäs ${probe.spiky}`);
    }

    /*
     * 8. KUVA JA ÄÄNI SAMASSA TAHDISSA (DESIGN.md kohta 8), ja kumpikaan ei saa
     *    olla vanha merkki. Varoituksella on oma äänensä ja loikalla omansa, ja
     *    kumpikin soi samalla framella kuin sen kuva alkaa.
     */
    {
      const { s, k } = lone();
      const { Sfx } = await import('/src/core/audio.js');
      const realPlay = Sfx.play;
      const heard = [];
      Sfx.play = function spy(name) { heard.push({ name, f: s.tick }); };
      let warnFrame = -1;
      let leapFrame = -1;
      let warnHeard = null;
      let leapHeard = null;
      try {
        for (let f = 0; f < 600; f++) {
          const before = heard.length;
          k.update();
          const fresh = heard.slice(before).map((h) => h.name);
          if (warnFrame < 0 && k.warning > 0) { warnFrame = f; warnHeard = fresh; }
          if (leapFrame < 0 && k.phase === 'leap') { leapFrame = f; leapHeard = fresh; }
        }
      } finally {
        Sfx.play = realPlay;
      }
      const OLD = ['jump', 'bigjump', 'fart', 'squeak', 'pop', 'kick', 'spikes', 'boss',
        'stomp', 'slam', 'dive', 'sprout', 'bump', 'timewarn', 'pipe', 'cork'];
      const warnSound = warnHeard && warnHeard[0];
      const leapSound = leapHeard && leapHeard[0];
      expect('varoituksella ja loikalla on omat äänensä, samalla framella kuin kuva',
        warnHeard && warnHeard.length === 1 && leapHeard && leapHeard.length === 1
        && !OLD.includes(warnSound) && !OLD.includes(leapSound) && warnSound !== leapSound
        && Sfx.has(warnSound) && Sfx.has(leapSound),
        `varoitus framella ${warnFrame} soitti "${warnSound}"`
        + `, loikka framella ${leapFrame} soitti "${leapSound}"`);
    }

    /*
     * 9. MIHIN KUILUIHIN SE PANNAAN. Ei jokaiseen: vaara joka on jokaisessa
     *    kolossa on maastoa, ja maasto ei ole vaara. Sääntö on että kurnuttaja
     *    asuu kuilussa jonka pelaaja jo osaa ylittää — mitatun hyppybudjetin
     *    sisällä ja ilman astinkiveä — ja kentässä on niitä enintään yksi.
     */
    {
      const { getLevel, levelIds } = await import('/src/data/levels.js');
      const homes = [];
      const bad = [];
      for (const id of levelIds()) {
        const rows = getLevel(id).rows;
        for (let y = 0; y < rows.length; y++) {
          for (let x = 0; x < rows[y].length; x++) {
            if (rows[y][x] !== 'U') continue;
            // Kuinka leveä kuilu sen ympärillä on, ja onko se koko kuilu.
            const solid = (c) => '#XB?!*uN[]{}%()S'.includes(c);
            let from = x;
            let to = x;
            while (from > 0 && !solid(rows[y][from - 1])) from--;
            while (to < rows[y].length - 1 && !solid(rows[y][to + 1])) to++;
            homes.push({ id, x, span: to - from + 1 });
          }
        }
      }
      const perLevel = {};
      for (const h of homes) perLevel[h.id] = (perLevel[h.id] || 0) + 1;
      for (const h of homes) {
        if (h.span > budget.gapTiles) bad.push(`${h.id} @${h.x}: kuilu ${h.span} ruutua > ${budget.gapTiles}`);
      }
      for (const [id, n] of Object.entries(perLevel)) {
        if (n > 1) bad.push(`${id}: ${n} kurnuttajaa samassa kentässä`);
      }
      expect('kurnuttaja asuu vain hyppybudjettiin mahtuvassa kuilussa, yksi per kenttä',
        homes.length >= 2 && bad.length === 0,
        bad.length ? bad.join('; ')
          : `${homes.length} kpl: ${homes.map((h) => `${h.id} sarake ${h.x} kuilu ${h.span}`).join(', ')}`);
    }
  } catch (e) {
    expect('kurnuttaja-testit pääsevät ajoon asti', false, String(e && e.message));
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

  /* ------------- kartan luettavuus: polku, kalusto ja vaikeuslaatta -------- */
  /*
   * Kolme valitusta, yksi kuva. Omistaja pelasi kartan läpi ja sanoi kolme
   * asiaa: puut seisovat polun päällä, kentän numerolaatta on ahdettu täyteen,
   * ja linkit on vedetty viivaimella. Ne ovat sama kuva ja siksi sama testi.
   *
   * Kaikki kolme mitataan pikseleistä eikä katsota silmällä, koska "näyttää
   * ahtaalta" ei ole luku jonka voi rikkoa vahingossa uudestaan. Jokainen alla
   * oleva väite nähtiin punaisena ennen kuin mitään korjattiin, ja rivikommentit
   * kertovat mitä se mittasi silloin.
   */
  {
    const worlds = await import('/src/data/worlds.js');
    const { WorldMapScene, TIER_COLORS, PIP_OFF } = await import('/src/scenes/worldmap.js');
    const cv = document.createElement('canvas');
    cv.width = 320;
    cv.height = 240;
    const g = cv.getContext('2d');

    /*
     * Se kalusto joka nousee maasta ylös ja siksi tukkii polun. Lista on tässä
     * testissä käsin kirjoitettuna eikä luettuna `worlds.js`:stä tarkoituksella:
     * jos sääntö ja sen tarkistus lukevat saman muuttujan, merkin poistaminen
     * listalta korjaa molemmat ja testi lakkaa olemasta testi. Luvut ovat
     * `drawTerrain`in omista suorakulmioista, ruudun yläreunasta laskien:
     *   T puu     y+1..y+14   P mänty  y+1..y+14   M vuori  y+3..y+15
     *   C kaktus  y+3..y+14   R kivi   y+8..y+13   " pensas y+6..y+13
     *   E koneisto y+1..y+14  K kallo  y+4..y+14
     * Polun pisteen oma muste on y+5..y+10 ruudun sisällä, joten jokainen näistä
     * osuu siihen suoraan jos se seisoo samassa ruudussa.
     */
    const TALL = 'TPMCR"EK';
    const bare = new RegExp(`[${TALL}]`, 'g');

    const rgbaOf = (paint) => {
      g.clearRect(0, 0, 320, 240);
      paint(g);
      return g.getImageData(0, 0, 320, 240).data;
    };
    const inkOf = (paint) => {
      const d = rgbaOf(paint);
      const m = new Uint8Array(320 * 240);
      for (let i = 0; i < m.length; i++) if (d[i * 4 + 3] > 8) m[i] = 1;
      return m;
    };
    const hueOf = (d, hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const gg = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const m = new Uint8Array(320 * 240);
      for (let i = 0; i < m.length; i++) {
        if (d[i * 4] === r && d[i * 4 + 1] === gg && d[i * 4 + 2] === b && d[i * 4 + 3] > 200) m[i] = 1;
      }
      return m;
    };
    const count = (m) => { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; };

    /* Chebyshev-etäisyysmuunnos kahdella pyyhkäisyllä. Chebyshev eikä euklidinen
     * siksi, että kysymys on "montako tyhjää pikseliä väliin jää" — vinottain
     * naapuri on yhtä lähellä kuin suoraan sivulla oleva, kun molemmat peittyvät
     * saman kokoisen pisteen alle. */
    const distFrom = (m) => {
      const d = new Int32Array(320 * 240).fill(1 << 20);
      for (let i = 0; i < d.length; i++) if (m[i]) d[i] = 0;
      for (let y = 0; y < 240; y++) {
        for (let x = 0; x < 320; x++) {
          const i = y * 320 + x;
          let v = d[i];
          if (x > 0) v = Math.min(v, d[i - 1] + 1);
          if (y > 0) v = Math.min(v, d[i - 320] + 1);
          if (x > 0 && y > 0) v = Math.min(v, d[i - 321] + 1);
          if (x < 319 && y > 0) v = Math.min(v, d[i - 319] + 1);
          d[i] = v;
        }
      }
      for (let y = 239; y >= 0; y--) {
        for (let x = 319; x >= 0; x--) {
          const i = y * 320 + x;
          let v = d[i];
          if (x < 319) v = Math.min(v, d[i + 1] + 1);
          if (y < 239) v = Math.min(v, d[i + 320] + 1);
          if (x < 319 && y < 239) v = Math.min(v, d[i + 321] + 1);
          if (x > 0 && y < 239) v = Math.min(v, d[i + 319] + 1);
          d[i] = v;
        }
      }
      return d;
    };
    /** Tyhjiä pikseleitä kahden piirroksen väliin: 0 = koskettavat, -1 = päällekkäin. */
    const clearance = (a, b) => {
      const d = distFrom(a);
      let best = 1 << 20;
      for (let i = 0; i < b.length; i++) if (b[i] && d[i] < best) best = d[i];
      return best - 1;
    };

    const mapOf = (wi) => {
      reset();
      game.state.world = wi;
      game.state.node = WORLDS[wi].nodes[0].id;
      game.state.cleared = Object.fromEntries(WORLDS[wi].nodes.map((n) => [n.id, true]));
      const m = new WorldMapScene(game);
      m.tick = 30;
      return m;
    };

    /* --- 1. kalusto ei seiso polulla eikä sen vieressä --- */

    /* Sama polun geometria kuin `worldProblems`illa, mutta laskettuna tässä
     * uudelleen: sääntö ja sen todiste eivät saa jakaa samaa koodia. */
    const zoneOf = (w) => {
      const path = new Set(w.nodes.map((n) => `${n.tx},${n.ty}`));
      for (const l of w.links) {
        const pts = worlds.linkPoints(w, l);
        for (let i = 0; i < pts.length - 1; i++) {
          let { tx, ty } = pts[i];
          const dx = Math.sign(pts[i + 1].tx - tx);
          const dy = Math.sign(pts[i + 1].ty - ty);
          path.add(`${tx},${ty}`);
          while (tx !== pts[i + 1].tx || ty !== pts[i + 1].ty) {
            if (tx !== pts[i + 1].tx) tx += dx;
            if (ty !== pts[i + 1].ty) ty += dy;
            path.add(`${tx},${ty}`);
          }
        }
      }
      const zone = new Set(path);
      for (const k of path) {
        const [tx, ty] = k.split(',').map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) zone.add(`${tx + dx},${ty + dy}`);
      }
      return zone;
    };

    const planted = [];
    for (const w of WORLDS) {
      const zone = zoneOf(w);
      for (let ty = 0; ty < w.terrain.length; ty++) {
        for (let tx = 0; tx < w.terrain[ty].length; tx++) {
          if (TALL.includes(w.terrain[ty][tx]) && zone.has(`${tx},${ty}`)) {
            planted.push(`${w.id} ${w.terrain[ty][tx]}@${tx},${ty}`);
          }
        }
      }
    }
    expect('yksikään puu, kivi tai koneisto ei seiso polulla eikä sen vieressä',
      planted.length === 0, planted.length ? `${planted.length}: ${planted.slice(0, 6).join(' ')}` : `${WORLDS.length} maailmaa`);

    /* Ja sama pikseleinä: piirretään maasto kahdesti, kerran oikeana ja kerran
     * ilman korkeaa kalustoa, ja erotus ON kaluston muste. Sitten mitataan
     * paljonko tyhjää jää polun ja lähimmän kalusteen väliin. */
    let worstScenery = { d: 1 << 20, id: '?' };
    for (let wi = 0; wi < WORLDS.length; wi++) {
      const m = mapOf(wi);
      const w = m.world;
      const full = rgbaOf((c) => m.drawTerrain(c));
      m.world = { ...w, terrain: w.terrain.map((r) => r.replace(bare, '.')) };
      const flat = rgbaOf((c) => m.drawTerrain(c));
      m.world = w;
      const scenery = new Uint8Array(320 * 240);
      for (let i = 0; i < scenery.length; i++) {
        if (full[i * 4] !== flat[i * 4] || full[i * 4 + 1] !== flat[i * 4 + 1]
          || full[i * 4 + 2] !== flat[i * 4 + 2]) scenery[i] = 1;
      }
      const path = inkOf((c) => m.drawLinks(c));
      const d = count(scenery) ? clearance(path, scenery) : 1 << 20;
      if (d < worstScenery.d) worstScenery = { d, id: w.id, px: count(scenery) };
    }
    expect('polun ja lähimmän kaluston väliin jää tyhjää joka maailmassa',
      worstScenery.d >= 4, `tiukin ${worstScenery.id}: ${worstScenery.d} px`);

    /*
     * Ja tässä se vastaesimerkki jonka takia sääntö raivaa myös naapuriruudut.
     * Kartta jossa vain polun omat ruudut ovat tyhjiä ja vuorijono seisoo rivin
     * ylä- ja alapuolella on täsmälleen se mitä heikompi sääntö sallisi.
     * Mitataan paljonko tilaa siihen jää — jos luku on sama kuin oikeilla
     * kartoilla, naapuriruutujen raivaaminen ei osta mitään ja sen voi perua.
     */
    const strip = {
      id: 'wS',
      name: 'KAISTA',
      theme: 'grass',
      terrain: [0, 1, 2, 3, 4, 5, 6, 7, 8]
        .map((r) => (r === 3 || r === 5 ? 'M'.repeat(20) : '.'.repeat(20))),
      nodes: [
        { id: 'p', tx: 2, ty: 4, type: 'start', name: 'A' },
        { id: 'q', tx: 14, ty: 4, type: 'level', level: '1-1', name: 'B' },
      ],
      links: [{ a: 'p', b: 'q' }],
    };
    const ms = mapOf(0);
    const keepW = ms.world;
    const keepR = ms.routeLinks;
    ms.routeLinks = new Map();
    ms.world = strip;
    const stripFull = rgbaOf((c) => ms.drawTerrain(c));
    ms.world = { ...strip, terrain: strip.terrain.map((r) => r.replace(bare, '.')) };
    const stripFlat = rgbaOf((c) => ms.drawTerrain(c));
    ms.world = strip;
    const stripPath = inkOf((c) => ms.drawLinks(c));
    ms.world = keepW;
    ms.routeLinks = keepR;
    const stripScenery = new Uint8Array(320 * 240);
    for (let i = 0; i < stripScenery.length; i++) {
      if (stripFull[i * 4] !== stripFlat[i * 4] || stripFull[i * 4 + 1] !== stripFlat[i * 4 + 1]
        || stripFull[i * 4 + 2] !== stripFlat[i * 4 + 2]) stripScenery[i] = 1;
    }
    const weak = clearance(stripPath, stripScenery);
    expect('pelkkien polkuruutujen raivaaminen ei olisi riittänyt',
      weak < worstScenery.d - 2,
      `vain polkuruudut ${weak} px, polkuruudut ja naapurit ${worstScenery.d} px`);

    /* Ja säännön pitää olla mahdoton rikkoa, ei vain rikkomatta jätetty. */
    const mkT = (terrain) => ({
      id: 'wT',
      name: 'TESTI',
      theme: 'grass',
      terrain: terrain.map((r) => r.padEnd(6, '.')),
      nodes: [
        { id: 's', tx: 0, ty: 1, type: 'start', name: 'ALKU' },
        { id: 'a', tx: 2, ty: 1, type: 'level', level: '1-1', name: 'A' },
        { id: 'f', tx: 4, ty: 1, type: 'fortress', level: '1-F', name: 'F' },
      ],
      links: [{ a: 's', b: 'a' }, { a: 'a', b: 'f' }],
    });
    const clean = mkT(['......', '......', '......', '...T..']);
    const onPath = mkT(['......', '.T....', '......', '......']);
    const beside = mkT(['...T..', '......', '......', '......']);
    const sceneryCases = [
      ['puhdas kartta', clean, false],
      ['puu polulla', onPath, true],
      ['puu polun vieressä', beside, true],
    ];
    const sceneryMissed = sceneryCases.filter(([, world, shouldFail]) =>
      worlds.worldProblems(world).some((p) => p.includes('polun')) !== shouldFail);
    expect('polulle istutettua puuta ei voi committoida',
      sceneryMissed.length === 0,
      sceneryMissed.map(([n]) => n).join(', ') || `${sceneryCases.length} tapausta`);

    /* --- 2. laatan sisällä on väljyyttä --- */

    /*
     * Numero, salaisuusmerkki ja vaikeuspalkki kilpailevat samasta ruudusta.
     * Mitataan ne erikseen väristä: selvitetyllä solmulla numero on #8fe04a,
     * löytymätön salaisuus #ffd048, laatan reunus #202038 ja palkin oma tausta
     * (16,14,20). Neljä eri väriä, joten jokainen osa saa oman maskin.
     */
    const plaqueNode = WORLDS[0].nodes.find((n) => n.level === '1-2');
    const mp = mapOf(0);
    mp.game.state.secrets = { '1-2': [] };      // viisi salaisuutta, yhtään ei löytynyt
    const w1 = mp.world;
    mp.world = { ...w1, nodes: [plaqueNode] };
    const plaque = rgbaOf((c) => mp.drawNodes(c));
    mp.world = w1;
    const gNum = hueOf(plaque, '#8fe04a');
    const gMark = hueOf(plaque, '#ffd048');
    const gEdge = hueOf(plaque, '#202038');
    /* Palkki on kolmea eri väriä: läpikuultava tausta, sammunut pykälä ja
     * palanut pykälä sen tason värissä. Ne ovat sama esine, joten sama maski. */
    const litPip = TIER_COLORS[worlds.nodePips(plaqueNode)];
    const gOff = hueOf(plaque, PIP_OFF);
    const gLit = hueOf(plaque, litPip);
    const gBar = new Uint8Array(320 * 240);
    for (let i = 0; i < gBar.length; i++) {
      const a = plaque[i * 4 + 3];
      if (gOff[i] || gLit[i] || (a > 100 && a < 250)) gBar[i] = 1;
    }
    const drawn = count(gNum) && count(gMark) && count(gEdge) && count(gBar);
    const gaps = {
      numMark: clearance(gNum, gMark),
      numEdge: clearance(gNum, gEdge),
      markEdge: clearance(gMark, gEdge),
      edgeBar: clearance(gEdge, gBar),
    };
    expect('laatan numero, salaisuusmerkki ja vaikeuspalkki eivät hengitä toistensa niskaan',
      !!drawn && Math.min(...Object.values(gaps)) >= 2,
      `numero-merkki ${gaps.numMark}, numero-reunus ${gaps.numEdge}, `
      + `merkki-reunus ${gaps.markEdge}, reunus-palkki ${gaps.edgeBar} px`);

    /* Väljyys maksaa tilaa, ja se hinta mitataan: kahden vierekkäisen solmun
     * piirrosten väliin pitää jäädä tyhjää, tai laatta on kasvanut naapurinsa
     * päälle. Tiukin pari kartalla on kaksi ruutua eli 32 px erillään. */
    let worstNodes = { d: 1 << 20 };
    let worstLinkNode = { d: 1 << 20 };
    let worstLinks = { d: 1 << 20 };
    for (let wi = 0; wi < WORLDS.length; wi++) {
      const m = mapOf(wi);
      const w = m.world;
      const keep = m.routeLinks;
      const nodeInk = w.nodes.map((n) => {
        m.world = { ...w, nodes: [n] };
        const ink = inkOf((c) => m.drawNodes(c));
        m.world = w;
        return ink;
      });
      const linkInk = w.links.map((l) => {
        m.world = { ...w, links: [l] };
        m.routeLinks = new Map();
        const ink = inkOf((c) => m.drawLinks(c));
        m.world = w;
        m.routeLinks = keep;
        return ink;
      });
      for (let i = 0; i < w.nodes.length; i++) {
        for (let j = i + 1; j < w.nodes.length; j++) {
          const d = clearance(nodeInk[i], nodeInk[j]);
          if (d < worstNodes.d) worstNodes = { d, id: `${w.nodes[i].id}/${w.nodes[j].id}` };
        }
        for (let k = 0; k < w.links.length; k++) {
          const l = w.links[k];
          if (l.a === w.nodes[i].id || l.b === w.nodes[i].id) continue;
          const d = clearance(nodeInk[i], linkInk[k]);
          if (d < worstLinkNode.d) worstLinkNode = { d, id: `${w.nodes[i].id}/${l.a}-${l.b}` };
        }
      }
      for (let i = 0; i < w.links.length; i++) {
        for (let j = i + 1; j < w.links.length; j++) {
          const A = w.links[i];
          const B = w.links[j];
          if (A.a === B.a || A.a === B.b || A.b === B.a || A.b === B.b) continue;
          const d = clearance(linkInk[i], linkInk[j]);
          if (d < worstLinks.d) worstLinks = { d, id: `${A.a}-${A.b} / ${B.a}-${B.b}` };
        }
      }
    }
    expect('kaksi solmua ei kasva kiinni toisiinsa',
      worstNodes.d >= 8, `tiukin ${worstNodes.id}: ${worstNodes.d} px`);
    expect('polku ei kulje sellaisen solmun läpi johon se ei liity',
      worstLinkNode.d >= 8, `tiukin ${worstLinkNode.id}: ${worstLinkNode.d} px`);
    expect('kaksi linkkiä joilla ei ole yhteistä solmua eivät kosketa',
      worstLinks.d >= 8, `tiukin ${worstLinks.id}: ${worstLinks.d} px`);

    /* --- 3. polut mutkittelevat, ja pelinappula kulkee samaa mutkaa --- */

    /*
     * Mutkan pitää olla datassa eikä piirtokoodissa, koska kaksi eri paikkaa
     * jotka laskevat "saman" mutkan eri kaavalla on juuri se ero jota DESIGN.md
     * 8 tarkoittaa: kuva ja liike kertoisivat eri tarinaa. Siksi tässä kysytään
     * käyrä `worlds.js`:ltä ja verrataan siihen sekä piirrosta että kävelyä.
     * Jos käyrää ei ole olemassa, tämä lukee suoran — ja mutkan mitta on 0.
     */
    const curveOf = (w, link) => (worlds.linkCurve
      ? worlds.linkCurve(w, link)
      : worlds.linkPoints(w, link).map((p) => ({ x: p.tx * 16 + 8, y: p.ty * 16 + 8 })));
    const segDist = (p, a, b) => {
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const L2 = vx * vx + vy * vy;
      const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2)) : 0;
      return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
    };
    const polyDist = (p, line) => {
      let best = 1e9;
      for (let i = 0; i < line.length - 1; i++) best = Math.min(best, segDist(p, line[i], line[i + 1]));
      return best;
    };

    let bendMin = 1e9;
    let bendMax = 0;
    let offCurve = 0;
    for (const w of WORLDS) {
      for (const link of w.links) {
        const straight = worlds.linkPoints(w, link)
          .map((p) => ({ x: p.tx * 16 + 8, y: p.ty * 16 + 8 }));
        const curve = curveOf(w, link);
        let deep = 0;
        for (const p of curve) deep = Math.max(deep, polyDist(p, straight));
        bendMin = Math.min(bendMin, deep);
        bendMax = Math.max(bendMax, deep);
        /* Kävelijä kulkee tismalleen sitä samaa murtoviivaa. */
        reset();
        game.state.world = WORLDS.indexOf(w);
        game.state.node = link.a;
        game.state.cleared = Object.fromEntries(w.nodes.map((n) => [n.id, true]));
        const m = new WorldMapScene(game);
        const pts = worlds.linkPoints(w, link);
        const dx = Math.sign(pts[1].tx - pts[0].tx);
        const dy = Math.sign(pts[1].ty - pts[0].ty);
        m.mode = 'idle';
        m.tryMove(dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up');
        if (m.mode === 'walk' && m.targetNode && m.targetNode.id === link.b) {
          for (let f = 0; f < 4000 && m.mode === 'walk'; f++) {
            offCurve = Math.max(offCurve, polyDist(m.pos, curve));
            m.update({
              pressed: blank(), held: blank(), released: blank(), consume() {},
            });
          }
        }
      }
    }
    expect('jokainen linkki mutkittelee, mutta pysyy omassa ruudussaan',
      bendMin >= 2 && bendMax <= 4,
      `pienin mutka ${bendMin.toFixed(1)} px, suurin ${bendMax.toFixed(1)} px `
      + `(ruudun keskeltä reunaan 8, pisteen puolikas 3)`);
    expect('kävelijä kulkee sitä mutkaa joka on piirretty',
      offCurve <= 0.5, `suurin poikkeama piirretystä käyrästä ${offCurve.toFixed(3)} px`);
  }

  /* ------------- kartta joka on näkymää leveämpi, ja sen kamera ------------ */
  /*
   * KAHDEKSAN KENTTÄÄ EI MAHDU KAHTEENKYMMENEEN SARAKKEESEEN.
   *
   * Kartan ruudukko on ollut tasan näkymän kokoinen (20x9 laattaa = 320x144 px),
   * joten se ei ole koskaan joutunut vierimään. Kahdeksan solmua, niiden polut
   * ja säännön 8 raivaama väljyys eivät mahdu kahteenkymmeneen sarakkeeseen, eli
   * ruudukon on saatava olla näkymää leveämpi ja näkymän on seurattava nappulaa.
   *
   * Testimaailma eikä levennetty oikea maailma, kahdesta syystä. Toinen on
   * työnjako — maailmadata on toisen käsissä juuri nyt — ja toinen on että
   * *kuvitteellinen* leveä maailma on parempi testi kuin oikea: se saa olla
   * 30 saraketta leveä ja siinä saa olla solmu kohdassa 25, eli kaukana sen
   * takana mihin näkymä yltää, ilman että kukaan joutuu pelaamaan sitä.
   *
   * Punainen ennen vihreää (DESIGN.md 7). Ennen korjausta nämä sanoivat:
   *   - kaukainen solmu ei piirtynyt lainkaan: 0 pikseliä mustetta, kun leima
   *     on kohdassa x=400..419 ja näkymä on 0..319
   *   - nappula käveli ulos ruudusta: suurin x näkymässä 456 px (raja 320)
   *   - näkymän ulkopuolinen solmu ja linkki piirrettiin silti: 14 ja 20
   *     fillRect-kutsua, jokainen kokonaan ruudun ulkopuolelle
   *   - kaksinkertaisen levyinen maasto maksoi kaksinkertaisesti: 918 vs 1794
   *     fillRect-kutsua samasta näkymästä
   *   - leima ei liikkunut vieritettäessä: vasen reuna pysyi x=207:ssä kun sen
   *     olisi pitänyt olla 47
   */
  {
    const worlds = await import('/src/data/worlds.js');
    const { WorldMapScene } = await import('/src/scenes/worldmap.js');
    const cv = document.createElement('canvas');
    cv.width = 320;
    cv.height = 240;
    const g = cv.getContext('2d');

    /*
     * Laskuri piirtokutsuille. Kello on huono mittari portissa — se heittelee
     * koneen mukaan ja punainen joka johtuu naapuriprosessista ei ole punainen —
     * mutta `fillRect`-kutsujen määrä on täsmälleen sama joka ajolla ja mittaa
     * sitä samaa asiaa: montako laattaa, solmua ja pistettä koodi vaivautui
     * piirtämään. Kellotettu luku on raportissa, tämä on portissa.
     */
    const counting = (target) => {
      let n = 0;
      const ctx = new Proxy(target, {
        get(o, k) {
          const v = o[k];
          if (typeof v !== 'function') return v;
          if (k === 'fillRect') return (...a) => { n++; return v.apply(o, a); };
          return v.bind(o);
        },
        set(o, k, v) { o[k] = v; return true; },
      });
      return { ctx, calls: () => n };
    };

    /*
     * PITKÄ LAAKSO: 30 saraketta, kahdeksan kenttää, linnake sarakkeessa 28.
     * Kalusto on riveillä 0, 7 ja 8, eli säännön 8 raivaaman käytävän (rivit
     * 1..6) ulkopuolella — testimaailmakin on maailma, ja rikkinäinen maailma
     * mittaisi rikkinäisyyttään eikä vierimistä.
     */
    const WIDE = {
      id: 'wL',
      name: 'PITKA LAAKSO',
      theme: 'grass',
      terrain: [
        'T..T...T..T...T..T...T..T...T.',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '.T...T...T...T...T...T...T...T',
        'T..T...T..T...T..T...T..T...T.',
      ],
      nodes: [
        { id: 'wL-s', tx: 1, ty: 4, type: 'start', name: 'ALKU' },
        { id: 'wL-1', tx: 4, ty: 4, type: 'level', level: '1-1', name: 'YKSI' },
        { id: 'wL-2', tx: 7, ty: 2, type: 'level', level: '1-2', name: 'KAKSI' },
        { id: 'wL-3', tx: 10, ty: 5, type: 'level', level: '1-3', name: 'KOLME' },
        { id: 'wL-4', tx: 13, ty: 2, type: 'level', level: '2-1', name: 'NELJA' },
        { id: 'wL-5', tx: 16, ty: 5, type: 'level', level: '2-2', name: 'VIISI' },
        { id: 'wL-6', tx: 19, ty: 2, type: 'level', level: '2-3', name: 'KUUSI' },
        { id: 'wL-7', tx: 22, ty: 5, type: 'level', level: '3-1', name: 'SEITSEMAN' },
        { id: 'wL-8', tx: 25, ty: 2, type: 'level', level: '3-2', name: 'KAHDEKSAN' },
        { id: 'wL-f', tx: 28, ty: 4, type: 'fortress', level: '1-F', name: 'LINNAKE' },
      ],
      links: [
        { a: 'wL-s', b: 'wL-1' },
        { a: 'wL-1', b: 'wL-2', path: [[7, 4]] },
        { a: 'wL-2', b: 'wL-3', path: [[10, 2]] },
        { a: 'wL-3', b: 'wL-4', path: [[13, 5]] },
        { a: 'wL-4', b: 'wL-5', path: [[16, 2]] },
        { a: 'wL-5', b: 'wL-6', path: [[19, 5]] },
        { a: 'wL-6', b: 'wL-7', path: [[22, 2]] },
        { a: 'wL-7', b: 'wL-8', path: [[25, 5]] },
        { a: 'wL-8', b: 'wL-f', path: [[28, 2]] },
      ],
    };

    expect('leveä testimaailma on itsekin kelvollinen kartta',
      worlds.worldProblems(WIDE).length === 0, worlds.worldProblems(WIDE).join(' / '));

    /* Kohtaus osoitetaan testimaailmaan käsin sen sijaan että se työnnettäisiin
     * `WORLDS`iin: taulukkoa kiertävät kaikki tämän tiedoston muut karttatestit,
     * ja globaalia listaa mutatoiva testi rikkoisi ne. */
    const keepPersist = game.persist.bind(game);
    game.persist = () => {};
    const wideAt = (nodeId) => {
      reset();
      game.state.cleared = Object.fromEntries(WIDE.nodes.map((n) => [n.id, true]));
      const m = new WorldMapScene(game);
      m.world = WIDE;
      m.routeLinks = new Map();
      m.node = worlds.findNode(WIDE, nodeId);
      m.pos = { x: m.node.tx * 16 + 8, y: m.node.ty * 16 + 8 };
      m.mode = 'idle';
      m.tick = 30;
      if (m.snapCamera) m.snapCamera();
      return m;
    };
    const camOf = (m) => (m.camX ? m.camX() : 0);
    const inkOf2 = (paint) => {
      g.clearRect(0, 0, 320, 240);
      paint(g);
      const d = g.getImageData(0, 0, 320, 240).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
      return n;
    };
    /** Piirretyn musteen vasen reuna, tai -1 jos mustetta ei ole. */
    const leftEdge = (paint) => {
      g.clearRect(0, 0, 320, 240);
      paint(g);
      const d = g.getImageData(0, 0, 320, 240).data;
      for (let x = 0; x < 320; x++) {
        for (let y = 0; y < 240; y++) if (d[(y * 320 + x) * 4 + 3] > 8) return x;
      }
      return -1;
    };

    /* --- 1. kartan toinen pää on olemassa ruudulla --- */

    const far = worlds.findNode(WIDE, 'wL-8');
    const mFar = wideAt('wL-8');
    const keepNodes = mFar.world;
    mFar.world = { ...WIDE, nodes: [far] };
    const farInk = inkOf2((c) => mFar.drawNodes(c));
    mFar.world = keepNodes;
    expect('kartan kaukaisin solmu näkyy kun sen päällä seisotaan',
      farInk > 0,
      `solmu wL-8 laattasarakkeessa ${far.tx} (x=${far.tx * 16}), näkymä `
      + `${camOf(mFar)}..${camOf(mFar) + 320}, mustetta ${farInk} px`);

    /* --- 2. nappula ei kävele ulos ruudusta --- */

    /* Koko matka alusta linnakkeeseen, joka linkki kerrallaan, ja nappulan
     * paikka näkymässä joka framella. Tämä on se testi joka kaatuu heti jos
     * kamera unohtuu jostain tilasta: kävelystä, saapumisesta tai lopusta. */
    const chain = ['wL-s', 'wL-1', 'wL-2', 'wL-3', 'wL-4', 'wL-5', 'wL-6', 'wL-7', 'wL-8', 'wL-f'];
    const mWalk = wideAt('wL-s');
    let minView = 1e9;
    let maxView = -1e9;
    let worstStep = 0;
    let reversals = 0;
    let arrived = 'wL-s';
    const idle = () => ({ pressed: blank(), held: blank(), released: blank(), consume() {} });
    for (let i = 0; i < chain.length - 1; i++) {
      const a = worlds.findNode(WIDE, chain[i]);
      const b = worlds.findNode(WIDE, chain[i + 1]);
      const dx = Math.sign((WIDE.links[i].path ? WIDE.links[i].path[0][0] : b.tx) - a.tx);
      const dy = Math.sign((WIDE.links[i].path ? WIDE.links[i].path[0][1] : b.ty) - a.ty);
      mWalk.mode = 'idle';
      mWalk.tryMove(dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up');
      let prev = camOf(mWalk);
      let dir = 0;
      for (let f = 0; f < 4000 && mWalk.mode === 'walk'; f++) {
        mWalk.update(idle());
        const cam = camOf(mWalk);
        const view = mWalk.pos.x - cam;
        minView = Math.min(minView, view);
        maxView = Math.max(maxView, view);
        const step = cam - prev;
        worstStep = Math.max(worstStep, Math.abs(step));
        if (step && dir && Math.sign(step) !== dir) reversals++;
        if (step) dir = Math.sign(step);
        prev = cam;
      }
      arrived = mWalk.node.id;
    }
    expect('nappula pysyy ruudulla koko matkan kartan päästä päähän',
      arrived === 'wL-f' && minView >= 4 && maxView <= 316,
      `pääty ${arrived}, nappula näkymässä ${minView.toFixed(1)}..${maxView.toFixed(1)} px (0..320)`);

    /* --- 3. kamera ei tärise eikä ryntää --- */

    /* Nappula kulkee 1.4 px/frame, joten kameran on kuljettava korkeintaan
     * saman verran: sitä nopeampi liike olisi kameran omaa vauhtia eikä
     * seuraamista. Ja suunnanvaihto kesken yhden linkin on juuri se tärinä joka
     * syntyy kun mutka heiluttaa nappulan x:ää ja kamera seuraa heilahdusta. */
    expect('kamera seuraa nappulaa eikä liiku omin päin',
      worstStep <= 2 && reversals === 0,
      `pahin askel ${worstStep} px/frame (nappula 1.4), suunnanvaihtoja ${reversals}`);

    /* --- 4. näkymän ulkopuolista ei piirretä --- */

    const mCull = wideAt('wL-s');
    const nodeCull = counting(g);
    const keepW = mCull.world;
    mCull.world = { ...WIDE, nodes: [far] };
    g.clearRect(0, 0, 320, 240);
    mCull.drawNodes(nodeCull.ctx);
    const linkCull = counting(g);
    mCull.world = { ...WIDE, nodes: WIDE.nodes, links: [WIDE.links[8]] };
    mCull.drawLinks(linkCull.ctx);
    mCull.world = keepW;
    expect('näkymän ulkopuolelle jäävää solmua tai linkkiä ei piirretä lainkaan',
      nodeCull.calls() === 0 && linkCull.calls() === 0,
      `solmu wL-8 ${nodeCull.calls()} kutsua, linkki wL-8→wL-f ${linkCull.calls()} kutsua `
      + `(näkymä ${camOf(mCull)}..${camOf(mCull) + 320})`);

    /* Ja sama maastolle: kartan leventäminen ei saa maksaa mitään, koska
     * näkymä on yhtä leveä kuin ennenkin. Sama kartta kahtena levyisenä, sama
     * näkymä, ja piirtokutsujen pitää olla luku luvulta sama. */
    const mTer = wideAt('wL-s');
    const narrow = counting(g);
    g.clearRect(0, 0, 320, 240);
    mTer.drawTerrain(narrow.ctx);
    const doubled = counting(g);
    mTer.world = { ...WIDE, terrain: WIDE.terrain.map((r) => r + r) };
    g.clearRect(0, 0, 320, 240);
    mTer.drawTerrain(doubled.ctx);
    mTer.world = WIDE;
    expect('kaksi kertaa leveämpi maasto ei maksa piirtoaikaa yhtään enempää',
      narrow.calls() === doubled.calls() && narrow.calls() > 0,
      `30 saraketta ${narrow.calls()} fillRect, 60 saraketta ${doubled.calls()}`);

    /* --- 5. leima mitataan vieritettynäkin oikein --- */

    /*
     * Laatan sisäiset raot mitattiin tänään pikseleistä (2 px joka saumaan) ja
     * ne ovat portti. Vieritys ei saa muuttaa niitä — ja se muuttaisi, jos
     * kameran siirtymä olisi murtoluku: puolen pikselin translaatio pehmentäisi
     * jokaisen reunan ja mitatut raot kutistuisivat sitä myöten. Siksi tässä
     * mitataan sama leima neljästä eri vierityksestä ja vaaditaan sekä että
     * se on *liikkunut* oikeaan kohtaan että että se on mitattavissa samana.
     */
    const stamp = worlds.findNode(WIDE, 'wL-4');
    const stampInk = (m) => {
      const keep = m.world;
      m.world = { ...WIDE, nodes: [stamp] };
      const out = { left: leftEdge((c) => m.drawNodes(c)), ink: inkOf2((c) => m.drawNodes(c)) };
      m.world = keep;
      return out;
    };
    /* Mitta on suhteellinen eikä ennustettu: leiman vasen reuna on vaikeuspalkin
     * tumma reunus kaksi pikseliä ruudun vasemmalta puolen, ja sen absoluuttinen
     * arvo on `drawPips`in asia. Väite on että se *siirtyy* vierityksen verran ja
     * että mustetta on yhtä paljon — eli leima liikkui eikä sumentunut. */
    const base = stampInk(wideAt('wL-s'));
    const edges = [];
    const inks = [];
    for (const scroll of [0, 37, 96, 160]) {
      const m = wideAt('wL-s');
      m.scroll = scroll;
      const got = stampInk(m);
      edges.push(`${got.left}/${base.left - camOf(m)}`);
      inks.push(got.ink);
    }
    expect('solmun leima liikkuu vierityksen mukana ja mittautuu samana',
      edges.every((e) => e.split('/')[0] === e.split('/')[1])
      && new Set(inks).size === 1 && base.ink > 0,
      `vasen reuna (mitattu/odotettu) ${edges.join(' ')}, mustetta ${inks.join('/')} px`);

    /* --- 6. ja kaikki tämä on nolla-muutos kapealle kartalle --- */

    /*
     * Jokainen laivattu maailma on yhä 20 laattaa leveä eli tasan näkymän
     * kokoinen, joten kameran pitää olla nollassa joka framella: alussa, joka
     * solmulla ja keskellä kävelyä. Se on se väite jonka nojalla kapean kartan
     * kuva on pikselilleen sama kuin ennen — siirtymä on 0, eikä 0 px:n
     * translaatio muuta yhtään pikseliä.
     */
    let drift = 0;
    let widest = 0;
    for (let wi = 0; wi < WORLDS.length; wi++) {
      const w = WORLDS[wi];
      widest = Math.max(widest, WorldMapScene.mapWidthPx ? WorldMapScene.mapWidthPx(w) : 320);
      for (const link of w.links) {
        reset();
        game.state.world = wi;
        game.state.node = link.a;
        game.state.cleared = Object.fromEntries(w.nodes.map((n) => [n.id, true]));
        const m = new WorldMapScene(game);
        drift = Math.max(drift, Math.abs(camOf(m)));
        const pts = worlds.linkPoints(w, link);
        m.mode = 'idle';
        m.tryMove(Math.sign(pts[1].tx - pts[0].tx) > 0 ? 'right'
          : Math.sign(pts[1].tx - pts[0].tx) < 0 ? 'left'
            : Math.sign(pts[1].ty - pts[0].ty) > 0 ? 'down' : 'up');
        for (let f = 0; f < 4000 && m.mode === 'walk'; f++) {
          m.update(idle());
          drift = Math.max(drift, Math.abs(camOf(m)));
        }
      }
    }
    expect('kapea kartta ei vieri pikseliäkään, eli sen kuva on ennallaan',
      drift === 0 && widest === 320,
      `suurin siirtymä ${drift} px, levein laivattu kartta ${widest} px (näkymä 320)`);

    game.persist = keepPersist;
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

    /*
     * And red before green for the thing the growing beanstalk added to the
     * argument.
     *
     * The validator reads the level data, and the level data is the GROWN
     * level — the vine is in it from floor to sky, which is what makes
     * `vineCrossings` able to say the sky band is reachable. The player is
     * handed the ungrown one, with a `?` on the vine's bump row instead. That
     * is only honest while the growing is guaranteed, so the guarantee is
     * checked rather than assumed: the vine stands on a floor (which is where
     * the bean lands, and also the only place a player can take hold of the
     * finished stalk), it is tall enough for the block to hang in it, and that
     * height is one a jump can reach.
     *
     * Three faults, one at a time, and the same fixture with none of them has
     * to come back silent — otherwise this proves nothing about the rule and
     * only that some level somewhere is unusual.
     */
    const vineFixture = ({ endsAt = 27, pit = false, pillar = false } = {}) => {
      const W = 32;
      const g = Array.from({ length: 45 }, () => ' '.repeat(W));
      const put = (y, x, s) => { g[y] = g[y].slice(0, x) + s + g[y].slice(x + s.length); };

      // Route band: flat ground, a start, an early power-up, a flag.
      put(28, 0, '#'.repeat(W)); put(29, 0, '#'.repeat(W));
      put(27, 2, '1');
      put(24, 5, '!');
      put(27, 28, 'F');
      /* The vine, from the floor up through the seam into the sky band. A
       * pillar raises the floor under it so the run is only three tiles long
       * on this side of the seam — too short to hang a block in. */
      const top = pillar ? 14 : 6;
      if (pillar) for (let y = 17; y <= 29; y++) put(y, 16, 'X');
      for (let y = top; y <= endsAt; y++) put(y, 16, 'v');
      /* A pit right under the vine, lidded with lava the way `assembleTall`
       * lids one: the stalk has nothing to stand in and the bean nowhere to
       * land. */
      if (pit) { put(28, 15, '   '); put(29, 15, '   '); put(30, 15, 'WWW'); }

      // The sky garden the vine arrives in, shaped like the shipped one: the
      // vine runs three rows past the planks so you step off sideways, the
      // planks start in the column beside it so nothing solid is ever next to
      // the vine, and the open bottom edge is how you get home.
      put(9, 17, '--------');
      put(8, 18, 'ooo');
      put(6, 19, '!');
      return g;
    };

    const grown = validateLevel(vineFixture(), budget);
    const hanging = validateLevel(vineFixture({ endsAt: 24 }), budget);
    const overPit = validateLevel(vineFixture({ pit: true }), budget);
    const stumpy = validateLevel(vineFixture({ endsAt: 16, pillar: true }), budget);

    expect('a beanstalk that stops in mid-air instead of reaching the floor is reported',
      hanging.some((p) => p.includes('instead of standing on the floor')),
      hanging.slice(0, 3).join(' / ') || 'ei yhtään');
    expect('a beanstalk rooted over a pit is reported',
      overPit.some((p) => p.includes('instead of standing on the floor')),
      overPit.slice(0, 3).join(' / ') || 'ei yhtään');
    expect('a beanstalk too short to hang a bean block in is reported',
      stumpy.some((p) => p.includes('too short to hang a bean block')),
      stumpy.slice(0, 3).join(' / ') || 'ei yhtään');
    expect('the same beanstalk fixture with none of the faults passes',
      grown.length === 0, grown.slice(0, 3).join(' / '));
  }

  /* ------------------------------ luumaailma ------------------------------ */
  /*
   * Maailma 6, ja kolme väitettä joita se ei saa rikkoa. Ne ovat tässä eikä
   * hajallaan siksi että ne ovat sama väite kolmesta suunnasta: luumaailma on
   * oma maailmansa eikä toisen maailman uudelleenmaalaus.
   */
  {
    const { BONE_CHUNKS } = await import('/src/data/chunks/bone.js');
    const { FACTORY_CHUNKS } = await import('/src/data/chunks/factory.js');

    /*
     * 1. LUUPALIKOIDEN EHTO, ja se on tehtaan ehdon peilikuva.
     *
     * `chunks/factory.js` perustelee olemassaolonsa yhdellä lauseella: jokaisella
     * sen palikalla on katto, koska tehdas on sisätila, ja avotaivaan kenttään
     * pudotettu tehdaspalikka jättäisi katon roikkumaan tyhjän päälle. Luumaailma
     * on tehtaan jälkeen ja sen sääntö kulkee toiseen suuntaan:
     *
     *   **luulaaksossa ei ole kattoa, eikä siellä roiku mikään.**
     *
     * Kaksi puoliskoa, ja molemmat mitataan alla:
     *
     *   - **taivas on auki**: rivit 0..4 ovat tyhjiä jokaisessa luupalikassa.
     *     Se on se puolisko joka kieltää lainaamisen: `fac_*` ei kelpaa tänne,
     *     koska sen katto peittäisi juuri sen kuun ja tähdet joiden takia tämä
     *     maailma näyttää keskiyöltä. Sääntö on siis aita edellisen maailman
     *     ympärillä eikä tämän — ja se on tarkoituksellisesti eri asia kuin
     *     tehtaan aita, koska kysymys "kummasta suunnasta lainataan" on eri
     *     kysymys kuin "saako lainata".
     *   - **luu seisoo**: jokainen `X` ja jokainen `#` lattiarivien yläpuolella
     *     nojaa johonkin suoraan allaan. Luuranko on määritelmän mukaan asia
     *     joka kannattaa itsensä, joten luulaakson pystysuunta tulee maasta
     *     ylöspäin eikä katosta alaspäin. Lohkot, laudat ja kolikot leijuvat
     *     kuten kaikkialla muualla — ne eivät ole luuta.
     *
     * Molemmat ovat rikottavissa yhdellä huolimattomalla rivillä, ja kumpikaan
     * ei näkyisi missään muussa testissä: kattopalikka luukentässä on täysin
     * kelvollinen kenttä `rules.js`:n mielestä.
     */
    const SKY_ROWS = 5;
    const STRUCTURE = '#X';
    const noSky = [];
    const floating = [];
    for (const [name, chunk] of Object.entries(BONE_CHUNKS)) {
      for (let y = 0; y < SKY_ROWS; y++) {
        if (/\S/.test(chunk.rows[y])) noSky.push(`${name} rivi ${y}`);
      }
      for (let y = 0; y < 13; y++) {
        for (let x = 0; x < chunk.w; x++) {
          if (!STRUCTURE.includes(chunk.rows[y][x])) continue;
          if (!STRUCTURE.includes(chunk.rows[y + 1][x])) floating.push(`${name} ${x},${y}`);
        }
      }
    }
    /* Tehtaan puoli luetaan kuudelta ylimmältä riviltä eikä pelkältä rivi
     * nollalta: `fac_cellar` ja `fac_loft` ovat kellari ja ullakko, ja niiden
     * katto on rivillä 5. Ne ovat yhtä lailla sisätilaa — mitattuna 10/12
     * roikkuisi rivillä 0 ja 12/12 roikkuu kuuden ylimmän sisällä. */
    const ceilinged = Object.values(FACTORY_CHUNKS)
      .filter((c) => c.rows.slice(0, 6).some((row) => /\S/.test(row))).length;
    expect('luupalikoissa on taivas auki ja tehdaspalikoissa katto',
      noSky.length === 0 && ceilinged === Object.keys(FACTORY_CHUNKS).length,
      `${Object.keys(BONE_CHUNKS).length} luupalikkaa, kattoja ${noSky.length}`
      + ` — tehtaassa katto ${ceilinged}/${Object.keys(FACTORY_CHUNKS).length}:ssa`);
    expect('luumaailmassa mikään luu ei roiku ilmassa',
      floating.length === 0,
      floating.length ? `${floating.length}: ${floating.slice(0, 5).join(' ')}` : 'kaikki nojaa maahan');
  }

  /*
   * 2. JOKAISEN MAAILMAN KÄYRÄ NOUSEE, HENGÄHTÄÄ, EIKÄ KIIPEÄ KOLMEA PIDEMPÄÄN.
   *
   * `tools/difficulty.mjs` on tulostanut tämän rivin pitkään, mutta tulostus ei
   * ole portti: uuden maailman voisi committoida suoraviivaisena tai laskevana
   * eikä mikään sanoisi mitään ennen kuin joku katsoo. Nyt sanoo.
   *
   * **TÄMÄ SÄÄNTÖ MUUTTUI 9.8.2026, ja se on tarkoituksellinen muutos eikä
   * löysennys.** Vanha muoto oli `dips !== 1` — "tasan yksi notko" — ja se on
   * nyt jaettu neljään väitteeseen. Syy on mittaus, ei maku:
   *
   *   **"Tasan yksi" ei sanonut mitään kolmen askelen maailmasta.** Kolmen
   *   askelen kävelyssä on kaksi siirtymää, joten notkoja voi olla 0, 1 tai 2.
   *   Kaksi notkoa tarkoittaa että molemmat siirtymät laskevat, eli viimeinen
   *   luku on ensimmäistä pienempi — jonka `rises` hylkää jo. Eli maailmoissa
   *   1–7 ehto `dips === 1` oli **täsmälleen sama ehto** kuin `dips >= 1`, ja
   *   se ero näkyy vasta kun maailmassa on enemmän askelia. Sanan "tasan"
   *   ainoa oikea kohde oli maailma 8 (viisi askelta), jossa se sattui
   *   pitämään.
   *
   *   **Ja kahdeksan kentän maailmassa "tasan yksi" olisi väärä sääntö.**
   *   Seitsemän askelta yhdellä hengähdyksellä on kuuden nousun putki jossa on
   *   yksi tauko; ROADMAP pyytää kahdeksalta kentältä nimenomaan tilaa
   *   hengähdyskentälle, eikä yhtä.
   *
   * Tilalle neljä väitettä, ja jokainen on mitattu tästä pelistä:
   *
   *   1  käyrä nousee kokonaisuutena           (ennallaan)
   *   2  vähintään yksi notko                  (vanhan sisältö kolmella askelella)
   *   3  ei kahta notkoa peräkkäin             — pelissä 0 tapausta tänään
   *   4  ei yli kolmen nousun putkea           — pelin pisin on tasan 3 (maailma
   *                                              8: 117→302→378→386)
   *
   * Kolme ja nolla ovat siis pelin omia lukuja eivätkä valittuja kattoja: sääntö
   * kieltää sen mitä peli ei jo tee, ja päästää läpi kaiken minkä se tekee.
   * Maailmoissa 1–7 uusi sääntö on merkki merkiltä sama kuin vanha (ks. todistus
   * yllä), maailmassa 8 se sallii toisen hengähdyksen jos joku sellaisen joskus
   * haluaa. Se on ainoa kohta jossa sääntö on väljempi, ja se on sanottu ääneen.
   */
  {
    const { tiersOf, tierScore } = await import('/src/data/worlds.js');
    const { DIFFICULTY } = await import('/src/data/difficulty.js');
    const shapes = WORLDS.map((w) => {
      const walk = tiersOf(w).filter((t) => !t.fortress);
      const seq = walk.map((t) => tierScore(w, t, DIFFICULTY));
      const steps = seq.slice(1).map((v, i) => (v < seq[i] ? -1 : 1));
      const dips = steps.filter((s) => s < 0).length;
      const twice = steps.some((s, i) => i > 0 && s < 0 && steps[i - 1] < 0);
      let climb = 0;
      let longest = 0;
      for (const s of steps) {
        climb = s > 0 ? climb + 1 : 0;
        longest = Math.max(longest, climb);
      }
      return {
        id: w.id,
        seq,
        dips,
        twice,
        longest,
        levels: w.nodes.filter((n) => n.level).length,
        rises: seq[seq.length - 1] > seq[0],
      };
    });
    const bad = shapes.filter((s) => !s.rises || s.dips < 1 || s.twice || s.longest > 3);
    expect('jokaisen maailman käyrä nousee, hengähtää, eikä kiipeä kolmea pidempään',
      bad.length === 0,
      shapes.map((s) => `${s.id} ${s.seq.map((v) => v.toFixed(0)).join('→')} `
        + `${s.dips} notkoa, pisin nousu ${s.longest}`).join(', '));

    /*
     * KAHDEKSAN KENTÄN MAAILMAN MUOTO, ja se on tämän päivän päätös kirjoitettuna
     * porttiin eikä roadmapiin.
     *
     * ROADMAP piti kysymystä auki näin: *"Kahdeksan kenttää maailmassa on eri
     * muoto kuin neljä. Nykyinen kaava on kolme kenttää ja linnake. Kahdeksan ei
     * ole 'sama kaksi kertaa' vaan tila välipomolle, haaralle ja
     * hengähdyskentälle."*
     *
     * Päätetty muoto: **seitsemän numeroitua kenttää ja linnake, ja kävelyssä
     * kaksi hengähdystä.** Perustelu kolmessa osassa, ja kaikki kolme ovat
     * mitattavissa:
     *
     *   **Miksi ei kahta kaarta.** "Sama kaksi kertaa" tarkoittaisi kahta
     *   huippua, ja kahden huipun maailma on kaksi maailmaa joiden välistä
     *   puuttuu linnake — pelaaja lukee toisen huipun lopuksi ja saa jatkoa.
     *   Yksi maailma on yksi kaari yhteen huippuun, ja se huippu on linnake.
     *   Kahdeksan kenttää ei siis muuta kaarta vaan venyttää sitä.
     *
     *   **Miksi kaksi hengähdystä eikä yksi.** Venytetty kaari on kuuden nousun
     *   putki, ja sääntö 4 yllä sanoo pelin oman mittauksen: pisin kiipeäminen
     *   jonka tämä peli on koskaan pyytänyt on kolme askelta. Kaksi notkoa on se
     *   pienin määrä joka pitää seitsemän askelta sen mitan sisällä ilman että
     *   ne ovat peräkkäin (3 + 2 + 1 tai 2 + 3 + 1 ja niin edelleen).
     *
     *   **Miksi ei haaraa ja välipomoa jokaiseen maailmaan**, vaikka ROADMAP
     *   ne mainitsee: molemmat ovat jo sidottuja päätöksiä muualla. Haaran pitää
     *   olla eriarvoinen ja vaikeamman haaran pitää maksaa jotain jota ei saa
     *   muualta (omistajan päätös 9.8.2026), ja koko pelissä on **yksi** sellainen
     *   palkinto (`REWARDS.break`), jonka ainoa lähde on maailman 2 välipomo.
     *   Seitsemän uutta samanarvoista palkintoa keksittäisiin tässä vain muodon
     *   täytteeksi, ja se on väärin päin. Haara ja välipomo pysyvät siis
     *   **maailman ominaisuutena eivätkä muodon osana** — maailma 2 on
     *   haarautuva kahdeksankin kentän mitassa, koska kahdeksan kentän muoto ei
     *   sano mitään siitä montako askelta on haaroja.
     *
     * Väite on siksi askelina eikä kenttinä: kahdeksan kentän maailmassa on
     * seitsemän askelta *jos* mikään niistä ei ole haara, ja maailma 2 saa olla
     * kuusi askelta samalla kahdeksalla kentällä. Notkojen määrä on kaksi
     * kummassakin tapauksessa.
     */
    const eight = shapes.filter((s) => s.levels === 8);
    const wrong = eight.filter((s) => s.dips !== 2);
    expect('kahdeksan kentän maailmassa on kaksi hengähdystä',
      eight.length >= 2 && wrong.length === 0,
      `${eight.length} kahdeksan kentän maailmaa `
      + `(${eight.map((s) => `${s.id} ${s.seq.length} askelta, ${s.dips} notkoa`).join('; ') || '—'})`);

    /*
     * Ja maailmasta maailmaan käyrä nousee myös, mikä on eri väite kuin
     * yllä oleva. Muototesti katsoo yhtä maailmaa kerrallaan, joten uusi
     * maailma voisi olla sisäisesti moitteeton ja silti helpompi kuin
     * edellinen — pelaajan kannalta juuri se on se vika joka tuntuu.
     * `difficulty.mjs` on tulostanut tämän rivin pitkään ("Käyrä nousee joka
     * maailmassa"), ja tulostus ei ole portti.
     *
     * Luku on maailman tasojen keskiarvo linnake mukaan lukien, sama kuin
     * työkalussa. Askelten koot vaihtelevat rajusti (+8,0 maailmaan 6, +66,8
     * maailmaan 5) eikä sitä yritetä tasoittaa: askelen koko on toimituksellinen
     * päätös, sen etumerkki ei ole.
     */
    const means = WORLDS.map((w) => {
      const tiers = tiersOf(w);
      const sum = tiers.reduce((s, t) => s + tierScore(w, t, DIFFICULTY), 0);
      return { id: w.id, mean: sum / (tiers.length || 1) };
    });
    const falls = means.filter((m, i) => i > 0 && m.mean <= means[i - 1].mean);
    expect('vaikeus nousee maailmasta maailmaan',
      falls.length === 0,
      means.map((m, i) => `${m.id} ${m.mean.toFixed(1)}`
        + (i ? ` (${m.mean > means[i - 1].mean ? '+' : ''}${(m.mean - means[i - 1].mean).toFixed(1)})` : ''))
        .join(', '));
  }

  /*
   * 3. UUSIEN KÄSINTEHTYJEN MAAILMOJEN MAAREITTI AUKEAA PIENIMMÄLLÄ KOOLLA.
   *
   * DESIGN.md kohta 5 sanoo sen näin: tehostus avaa paikkoja, ei kenttää.
   * `tools/playable.mjs` mittaa juuri tätä koko pelistä, mutta se on raportti
   * eikä portti, ja siinä on jo kolme tunnettua nimeä. Uusi maailma ei saa
   * liittyä siihen listaan huomaamatta, joten sen kolme numeroitua kenttää ja
   * linnake ajetaan täällä ja tulos on kaatava.
   *
   * **Maailmat 6, 7 ja 8 samassa silmukassa, ja se on väite eikä säästö.**
   * Lupaus koskee koko peliä, mutta portiksi se voidaan nostaa vain siellä
   * missä lähtötaso on puhdas: maailmoissa 1–5 on kolme tunnettua nimeä (4-3,
   * ja 2-1 / 3-F / 5-F tuplahypyllä), ja niiden korjaaminen on eri työ kuin
   * uuden maailman tekeminen. Käsintehdyt maailmat luulaaksosta eteenpäin
   * eivät saa kasvattaa tuota listaa, ja tässä se on ajettavassa muodossa.
   *
   * Ovi avataan **kentän omasta `boss`-lipusta** eikä tunnisteen viimeisestä
   * kirjaimesta. Se oli sama asia niin kauan kuin pomoja oli vain
   * linnakkeissa; viimeisessä linnakkeessa jokainen kenttä päättyy oveen, ja
   * nimestä päättelevä testi olisi raportoinut kuusi kenttää umpikujina
   * mittaamatta niiden maastosta mitään.
   *
   * Botti on sama tyhmä botti: juoksee oikealle ja hyppää. Viholliset ja
   * vaarat poistetaan, koska kysymys on maastosta — vihollisen alle jääminen on
   * eri testi ja se on jo olemassa. Tehostuksia ei anneta yhtään: voimataso 0
   * on se koko jolle lupaus on annettu. Se on samalla toinen puoli maahaniskun
   * lupauksesta: botti ei osaa maahaniskua eikä sitä pyydetä siltä, joten
   * kenttä joka vaatisi sitä jäisi tähän kiinni.
   */
  {
    const handmade = levelIds().filter((id) => /^[678]-/.test(id));
    const rows = [];
    for (const id of handmade) {
      reset({ type: null, level: 0 });
      let finished = null;
      game.finishLevel = (r) => { finished = r; };
      const s = new LevelScene(game, id);
      game.setScene(s);
      s.entities = s.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
      if (s.def.boss) s.bossDefeated = true;      // ovi on maali; tappelu on eri testi
      s.time = 9999;
      const i = mkInput();
      let prevJump = false;
      let hold = 0;
      let maxX = s.player.x;
      for (let f = 0; f < 7000 && !finished; f++) {
        const p = s.player;
        const footY = Math.floor((p.y + p.h) / 16);
        const aheadX = Math.floor((p.x + p.w + 6) / 16);
        const solid = (tx, ty) => isSolid(s.tileAt(tx, ty));
        const lethal = (tx, ty) => '^W'.includes(s.tileAt(tx, ty));
        const wall = solid(aheadX, footY - 1) || solid(aheadX, footY - 2);
        let obstacle = -1;
        for (let d = 0; d <= 5 && obstacle < 0; d++) {
          const tx = aheadX + d;
          if (lethal(tx, footY) || lethal(tx, footY - 1)) obstacle = d;
          else if (!solid(tx, footY) && !solid(tx + 1, footY)) obstacle = d;
        }
        const takeOff = p.onGround && (wall || (obstacle >= 0 && obstacle <= 2));
        if (takeOff) {
          let span = 0;
          if (obstacle >= 0) {
            const start = aheadX + obstacle;
            while (span < 14 && (!solid(start + span, footY)
              || lethal(start + span, footY) || lethal(start + span, footY - 1))) span++;
          }
          hold = wall ? 16 : Math.max(5, Math.min(16, 3 + span * 1.1)) | 0;
        }
        const wantJump = takeOff || (hold > 0 && p.vy < 0);
        if (hold > 0) hold--;
        i.held = blank();
        i.held.right = true;
        i.held.run = true;
        i.held.jump = wantJump;
        i.pressed = blank();
        i.pressed.jump = takeOff && !prevJump;
        prevJump = wantJump;
        s.update(i);
        maxX = Math.max(maxX, p.x);
        if (s.state === 'dead') break;
      }
      rows.push({
        id,
        cleared: !!(finished && finished.cleared),
        reach: Math.round((maxX / (s.w * 16)) * 100),
        stopped: s.state === 'dead' ? `kuoli sarakkeessa ${Math.floor(s.player.cx / 16)}`
          : `jumissa ${Math.round((maxX / (s.w * 16)) * 100)} %`,
      });
    }
    const stuck = rows.filter((r) => !r.cleared);
    expect('käsintehtyjen maailmojen 6–8 jokainen kenttä on läpäistävissä voimatasolla 0',
      rows.length === 14 && stuck.length === 0,
      rows.length
        ? `${rows.length} kenttää: ${rows.map((r) => `${r.id} ${r.cleared ? 'läpi' : r.stopped}`).join(', ')}`
        : 'ei 6-, 7- eikä 8-kenttiä lainkaan');
  }

  /* ----------------------------- pilvimaailma ---------------------------- */
  /*
   * Maailma 7, KAASUKEHÄ, ja kaksi ongelmaa jotka se on olemassa ratkaistakseen.
   * Molemmat ovat sellaisia joihin maailma voi vastata väärin *ja silti näyttää
   * valmiilta*, joten molemmat mitataan tässä eikä perustella kommentissa.
   *
   * ONGELMA 1: PELISSÄ ON JO TAIVAS. Jokaisen korkean kentän yllä on
   * taivaskaista, ja `sky_garden` on jo paikka joka on tehty lavoista ilmassa.
   * Jos kokonainen pilvimaailma lukee samalta, se ei ole uusi maailma vaan
   * venytetty bonushuone — ja pahempaa, se halventaa salaisuuden jonka
   * löydettäväksi tekeminen oli oikeaa työtä. Ero on tehty **lattiasta** ja se
   * on siksi mitattavissa: bonushuoneessa ei ole lattiaa lainkaan, ja kaikki
   * mille siellä voi astua on lautaa. Testi 3 laskee molemmat luvut molemmista.
   *
   * ONGELMA 2: PILVISTÄ TEHTY MAAILMA ON KUOPPA KOKO PITUUDELTAAN. Vastaus on
   * kirjoitettu palikoihin ja tarkistetaan testeissä 1 ja 2: **tiivistynyt
   * pilvi on maata**, eli lattia on tavallista `#`:ää, ja **ohut pilvi (`-`) ei
   * ole koskaan tyhjän päällä**. Jälkimmäinen on se puolisko joka ostaa
   * puoliläpäisevän lavan tähän maailmaan ilman sen omaa ansaa — alas
   * painaminen vahingossa ei voi pudottaa tyhjään, koska tässä maailmassa
   * lavan alla on aina pilveä.
   */
  {
    const { CLOUD_CHUNKS } = await import('/src/data/chunks/cloud.js');
    const { BONE_CHUNKS } = await import('/src/data/chunks/bone.js');
    const { CHUNKS } = await import('/src/data/chunks.js');

    /*
     * 1. EI JALKOJA, ja se on luumaailman ehdon peilikuva.
     *
     * `chunks/bone.js` perustelee itsensä yhdellä lauseella: luu seisoo, eli
     * jokainen `X` ja `#` lattian yläpuolella nojaa johonkin suoraan allaan,
     * koska luuranko on määritelmän mukaan asia joka kannattaa itsensä. Pilvi
     * on määritelmän mukaan asia joka **ei** kannata itseään, joten sääntö
     * kulkee tässä täsmälleen toisin päin:
     *
     *   **mikään ei seiso maassa — kaikki pystysuunta leijuu.**
     *
     * Ei kukkuloita, ei portaita, ei hautakiviä: lattian yläpuolella ei ole
     * yhtään `#`:ää eikä `X`:ää. Se maksaa saman kuin luumaailman sääntö maksoi
     * — koko `steps_up`/`ledge`-sanasto on poissa käytöstä, ja korkeus on
     * ostettava laudalla ja lohkolla — ja se on juuri se hinta jonka takia
     * sääntö kannattaa kirjoittaa: se pakottaa maailman siluetin erilaiseksi
     * kuin yhdenkään edellisen.
     *
     * Luumaailma mitataan tässä vastapariksi eikä kohteliaisuudesta: jos
     * molemmat luvut olisivat nollia, sääntö ei erottaisi mitään.
     */
    const STANDS = '#X';
    const legsIn = (chunks) => {
      const out = [];
      for (const [name, chunk] of Object.entries(chunks)) {
        for (let y = 0; y < 13; y++) {
          for (let x = 0; x < chunk.w; x++) {
            if (STANDS.includes(chunk.rows[y][x])) out.push(`${name} ${x},${y}`);
          }
        }
      }
      return out;
    };
    const cloudLegs = legsIn(CLOUD_CHUNKS);
    const boneLegs = legsIn(BONE_CHUNKS);
    expect('pilvimaailmassa mikään ei seiso maassa, luumaailmassa kaikki seisoo',
      cloudLegs.length === 0 && boneLegs.length > 0,
      `${Object.keys(CLOUD_CHUNKS).length} pilvipalikkaa, maasta nousevia ruutuja `
      + `${cloudLegs.length} — luussa ${boneLegs.length}`
      + (cloudLegs.length ? `: ${cloudLegs.slice(0, 5).join(' ')}` : ''));

    /*
     * 2. OHUT PILVI EI OLE KOSKAAN TYHJÄN PÄÄLLÄ.
     *
     * Puoliläpäisevä lava on ollut pelissä alusta asti ja siinä on yksi ansa,
     * joka on aina ollut siedettävä siksi että lavoja on ollut vähän: alas
     * painaminen pudottaa lävitse, ja jos lavan alla ei ole mitään, se pudottaa
     * kuoppaan. Maailma jonka koko pystysuunta on lautaa moninkertaistaa sen
     * ansan — joten tässä maailmassa jokaisen `-`:n alla on samassa sarakkeessa
     * kiinteää pilveä.
     *
     * Sääntö on ehdoton eikä ohje, ja sillä on hintansa: **tässä maailmassa
     * yksikään lauta ei ylitä kuoppaa.** Jokainen reikä pilvessä hypätään.
     * Muualla pelissä lauta kuopan yllä on tavallinen ja hyvä ratkaisu
     * (`pit_l`, `sky_run`, `bone_ribs`, `sky_garden`), ja alla oleva luku
     * mittaa juuri ne — jos se olisi nolla, sääntö ei kieltäisi mitään.
     */
    const hanging = (chunks) => {
      let count = 0;
      const where = [];
      for (const [name, chunk] of Object.entries(chunks)) {
        for (let y = 0; y < 15; y++) {
          for (let x = 0; x < chunk.w; x++) {
            if (chunk.rows[y][x] !== '-') continue;
            let held = false;
            for (let below = y + 1; below < 15; below++) {
              if (STANDS.includes(chunk.rows[below][x])) { held = true; break; }
            }
            if (!held) { count++; if (where.length < 5) where.push(`${name} ${x},${y}`); }
          }
        }
      }
      return { count, where };
    };
    const cloudHang = hanging(CLOUD_CHUNKS);
    const elsewhere = hanging(Object.fromEntries(
      Object.entries(CHUNKS).filter(([name]) => !name.startsWith('cloud_'))));
    expect('pilvimaailmassa yksikään ohut pilvi ei leiju tyhjän päällä',
      cloudHang.count === 0 && elsewhere.count > 0,
      `pilvimaailma ${cloudHang.count}, muu peli ${elsewhere.count}`
      + (cloudHang.count ? `: ${cloudHang.where.join(' ')}` : ` (esim. ${elsewhere.where.join(' ')})`));
  }

  /*
   * 3. TÄMÄ EI OLE VENYTETTY BONUSHUONE, JA SE ON MITATTU.
   *
   * Kaksi lukua per kenttä, ja ne ovat kaksi eri kysymystä:
   *
   *   **maaosuus** — kuinka monessa sarakkeessa on kiinteää lattiaa. Se on
   *   vastaus kysymykseen "onko täällä lattia": paikassa on lattia, huoneessa
   *   ei ole.
   *   **lautaosuus astuttavasta** — kuinka suuri osa kaikesta mille voi astua
   *   on ohutta pilveä. Se on vastaus kysymykseen "mistä täällä kuljetaan":
   *   bonushuoneessa vastaus on sata prosenttia, koska siellä ei ole muuta.
   *
   * `sky_garden` mitataan samoilla riveillä ja se antaa 0 % ja 100 %. Jos
   * pilvimaailman luvut lähestyvät noita, maailma on muuttunut siksi
   * bonushuoneeksi jota se ei saa olla, ja se näkyy tässä ennen kuin se näkyy
   * kenessäkään pelaajassa.
   *
   * Linnake 7-F jätetään pois tarkoituksella: se on jaettu `fort_*`-käytävä
   * niin kuin joka maailman linnake, ja sen lattiassa on laavaa. Väite koskee
   * niitä kolmea kenttää jotka ovat tämän maailman omia.
   */
  {
    const { getLevel } = await import('/src/data/levels.js');
    const { CHUNKS } = await import('/src/data/chunks.js');
    const SOLIDF = '#X';
    const shares = (rows, floorRow) => {
      const w = rows[0].length;
      let ground = 0;
      let planks = 0;
      let groundTiles = 0;
      for (let x = 0; x < w; x++) {
        const solid = SOLIDF.includes(rows[floorRow][x]) || SOLIDF.includes(rows[floorRow + 1][x]);
        if (solid) ground++;
        for (let y = 0; y < rows.length; y++) {
          if (rows[y][x] === '-') planks++;
          else if (SOLIDF.includes(rows[y][x])) groundTiles++;
        }
      }
      const footing = planks + groundTiles;
      return {
        ground: (ground / w) * 100,
        plank: footing ? (planks / footing) * 100 : 100,
        w,
      };
    };
    const levels = ['7-1', '7-2', '7-3'].map((id) => ({ id, ...shares(getLevel(id).rows, 13) }));
    const garden = shares(CHUNKS.sky_garden.rows, 13);
    const worstGround = levels.reduce((m, l) => Math.min(m, l.ground), 100);
    const worstPlank = levels.reduce((m, l) => Math.max(m, l.plank), 0);
    expect('pilvimaailmassa on lattia, bonushuoneessa ei — mitattuna molemmat',
      levels.length === 3 && worstGround >= 80 && worstPlank <= 25
      && garden.ground === 0 && garden.plank === 100,
      `${levels.map((l) => `${l.id} maata ${l.ground.toFixed(0)} % / lautaa `
        + `${l.plank.toFixed(0)} % (${l.w} saraketta)`).join(', ')}`
      + ` — sky_garden maata ${garden.ground.toFixed(0)} % / lautaa ${garden.plank.toFixed(0)} %`);
  }

  /*
   * 4. MAAHANISKULLA ON TÄSSÄ MAAILMASSA TILAA, MUTTEI VALTAA.
   *
   * Maahanisku (v26.08.09.31) normalisoi voimansa kentän omaa kattoa vasten,
   * joten se on sitä kovempi mitä korkeammalta se aloitetaan — ja kerroksittain
   * ladottu pilvimaailma on ainoa paikka pelissä jossa korkeutta on tarjolla
   * ilman että sitä pitää erikseen rakentaa. Väite on kaksiosainen ja
   * molemmat puolet mitataan:
   *
   *   - **alasimelta pudotettuna isku tappaa.** Maailman ylin lauta on
   *     `cloud_anvil`in kansi, ja siltä alkava sukellus ylittää
   *     POUND_KILL_AT-rajan (0,5) mitattuna eikä laskettuna.
   *   - **lattialta hypättynä se ei tapa.** Sama liike tavallisen seisonnasta
   *     tehdyn hypyn huipulta jää rajan alle, eli korkeus on se mikä ostaa
   *     tappavuuden — ei tehostus eikä tämä maailma.
   *
   * Ja kolmas puoli on jo tarkistettu muualla: kohdan 3 botti ei osaa
   * maahaniskua lainkaan ja läpäisee silti jokaisen 7-kentän voimatasolla 0,
   * eli liike avaa paikkoja eikä kenttää (DESIGN.md kohta 5).
   */
  {
    const { getLevel } = await import('/src/data/levels.js');
    /* Ylin lauta koko maailmassa, ja siitä se sarake jonka vierestä pääsee
     * putoamaan lattiaan asti — sukellus jonka jalat ovat jo kannen päällä ei
     * mittaa mitään, koska se laskeutuu sille kannelle. */
    let top = null;
    for (const id of ['7-1', '7-2', '7-3']) {
      const rows = getLevel(id).rows;
      for (let y = 0; y < 13 && (!top || y < top.y); y++) {
        for (let x = 0; x < rows[y].length - 1; x++) {
          if (rows[y][x] !== '-' || rows[y][x + 1] === '-') continue;
          let clear = true;
          for (let d = y; d <= 12; d++) if (rows[d][x + 1] !== ' ') clear = false;
          if (!clear || rows[13][x + 1] !== '#') continue;
          top = { id, x: x + 1, y };
          break;
        }
      }
    }
    const dive = (id, place) => {
      reset({ type: null, level: 0 });
      const s = new LevelScene(game, id);
      game.setScene(s);
      s.entities = s.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
      s.time = 9999;
      const i = mkInput();
      const step = (held = {}, pressed = {}) => {
        i.held = { ...blank(), ...held };
        i.pressed = { ...blank(), ...pressed };
        s.update(i);
      };
      place(s.player, step);
      step({ down: true, jump: true }, { down: true, jump: true });
      for (let f = 0; f < 240 && !s.lastPound; f++) step({ down: true });
      return s.lastPound;
    };
    const fromDeck = top && dive(top.id, (p) => {
      p.x = top.x * 16 + 1;
      p.y = top.y * 16 - p.h;
      p.vx = 0;
      p.vy = 0;
      p.onGround = false;
    });
    const fromFloor = top && dive(top.id, (p, step) => {
      p.x = top.x * 16 + 1;
      p.y = 12 * 16 - p.h;
      for (let f = 0; f < 20; f++) step();
      step({ jump: true }, { jump: true });
      for (let f = 0; f < 60 && p.vy < 0; f++) step({ jump: true });
    });
    /* Rivi 5 on `cloud_anvil`in kansi, ja se on osa väitettä eikä sen kuvaus:
     * maailma jonka ylin lauta valuisi alaspäin lakkaisi olemasta se paikka
     * jossa liikkeellä on tilaa, ja tekisi sen huomaamatta. */
    expect('pilvimaailman ylimmältä laudalta maahanisku tappaa, lattiahypystä ei',
      !!fromDeck && !!fromFloor && top.y <= 5 && fromDeck.kills && !fromFloor.kills,
      top
        ? `ylin lauta ${top.id} rivi ${top.y}: voima ${fromDeck ? fromDeck.strength.toFixed(2) : '—'}`
        + ` (${fromDeck && fromDeck.kills ? 'tappaa' : 'ei tapa'}), lattiahypystä `
        + `${fromFloor ? fromFloor.strength.toFixed(2) : '—'}`
        + ` (${fromFloor && fromFloor.kills ? 'tappaa' : 'ei tapa'})`
        : 'yhtään lautaa ei löytynyt maailmasta 7');
  }

  /* --------------------------- viimeinen linnake -------------------------- */
  /*
   * MAAILMA 8, VIIMEINEN LINNAKE, ja se yksi väite jonka takia se on olemassa:
   * **finaali on eri muotoinen kuin maailma jonka perässä on linnake.**
   *
   * Tämä on eri testijoukko kuin luulaakson ja pilvimaailman omat, ja se on
   * eri asiasta. Maailmoilla 6 ja 7 oli uusi teema, ja niiden mittaukset
   * kysyivät onko teema oikeasti oma (lattia, siluetti, palikoiden ehdot).
   * Maailmalla 8 ei ole uutta teemaa eikä saa olla — teemalista on täysi
   * (ROADMAP 9.8.2026) — joten sen ero on **rakenteessa**, ja rakenne on
   * mitattavissa täsmälleen samalla ankaruudella.
   *
   * Kuusi mittausta, ja jokainen on sellainen jonka maailma voi rikkoa *ja
   * silti näyttää valmiilta*:
   *
   *   1  muoto     kuusi askelta neljän sijaan
   *   2  katto     ei ulkopuolta: joka sarakkeen yllä on kiveä
   *   3  ovi       ei yhtään lippua, kuusi ovea
   *   4  pomot     jokainen pelin pomo, eikä yksikään kahdesti
   *   5  tiili     tiili ei kosketa kiveä, koska paletti ei erota niitä
   *   6  vauhti    jokaisen kuilun edessä on täysi vauhdinotto
   *
   * Nollatestinä on aina muu peli. Jos maailma 8 on ainoa jossa luku on se mikä
   * se on, väite erottaa jotain; jos kaikki maailmat antavat saman luvun, väite
   * ei sano mitään ja testi on koriste.
   */
  {
    const { getLevel, levelIds } = await import('/src/data/levels.js');
    const { tiersOf } = await import('/src/data/worlds.js');
    const { THEMES, T, drawTile } = await import('/src/gfx/tiles.js');

    const ids = levelIds();
    const inWorld = (n) => ids.filter((id) => id.startsWith(`${n}-`));
    const w8 = inWorld(8);
    const FLOOR = 13;
    const STONE = '#X';
    /* Sama kaistasääntö kuin `rules.js`:llä ja vaikeusmittarilla: reitti on se
     * viisitoista riviä joilla pelaaja aloittaa. Ilman tätä korkean kentän
     * ylimmät rivit olisivat taivaskaistan omia, ja "katto" mitattaisiin
     * bonushuoneen katosta. Maailmassa 8 ei ole yhtään korkeaa kenttää, joten
     * tämä koskee pelkästään vertailulukua — ja vertailuluku on tässä koko
     * väitteen toinen puolisko. */
    const routeOf = (id) => {
      const rows = getLevel(id).rows;
      if (rows.length <= 15) return rows;
      const start = rows.findIndex((row) => row.includes('1'));
      const top = Math.floor(Math.max(start, 0) / 15) * 15;
      return rows.slice(top, top + 15);
    };

    /*
     * 1. JOKAINEN ASKEL ON TAPPELU, EIKÄ VAIN VIIMEINEN.
     *
     * **Tässä luki 9.8.2026 asti "viimeinen maailma on kuusi askelta, muut
     * neljä", ja se väite jouduttiin vaihtamaan.** Syy kannattaa lukea, koska se
     * on esimerkki portista joka mittasi oikein mutta väitti väärää asiaa.
     *
     * Väite oli **kahden luvun erotus**: kuusi vastaan neljä. Toinen puolisko
     * niistä luvuista — muiden maailmojen neljä — ei ollut maailman 8
     * ominaisuus lainkaan vaan sen ajan hetken ominaisuus jolloin jokainen muu
     * maailma oli kolme kenttää ja linnake. ROADMAPin oma tavoite (kahdeksan
     * kenttää joka maailmaan) tekee siitä epätoden ensimmäisenä päivänä jona
     * joku alkaa tehdä sitä työtä, eikä maailmalle 8 tapahdu silloin mitään.
     * Portti olisi siis kaatunut oikeasta työstä, ja portti joka kaatuu
     * oikeasta työstä sammutetaan.
     *
     * Tilalle väite joka kestää minkä tahansa kenttämäärän, koska se on
     * **osuus eikä lukumäärä**: viimeisessä linnakkeessa jokainen askel päättyy
     * tappeluun, muualla vain viimeinen. Mitattuna maailma 8 on 6/6 = 100 % ja
     * jokainen muu 1/n — ja kun maailmat kasvavat kahdeksaan kenttään, tämä
     * väite **vahvistuu** eikä heikkene: nimittäjä kasvaa, osuus pienenee.
     *
     * Nollatestinä yhä muu peli, samalla koodilla. Jos jokainen maailma antaisi
     * saman osuuden, väite ei erottaisi mitään.
     */
    const steps = WORLDS.map((w) => {
      const tiers = tiersOf(w);
      const fights = tiers.filter((t) => t.levels.some((id) => getLevel(id).boss)).length;
      return { id: w.id, n: tiers.length, fights, share: (fights / tiers.length) * 100 };
    });
    const last = steps[steps.length - 1];
    const rest = steps.slice(0, -1);
    expect('viimeisessä maailmassa jokainen askel on tappelu, muualla vain viimeinen',
      steps.length === 8 && last.id === 'w8' && last.share === 100 && last.n >= 6
      && rest.every((s) => s.fights === 1 && s.share <= 25),
      steps.map((s) => `${s.id} ${s.fights}/${s.n} = ${s.share.toFixed(0)} %`).join(', '));

    /*
     * 2. EI ULKOPUOLTA.
     *
     * Luumaailman ehto oli "taivas on auki", pilvimaailman "mikään ei seiso
     * maassa". Viimeisen linnakkeen ehto on se kolmas, ja se on molempien
     * vastakohta: **kaikkien yllä on kiveä.** Jokaisessa sarakkeessa,
     * jokaisessa kentässä, ensimmäisestä ruudusta viimeiseen.
     *
     * Se on myös syy siihen miksi maailmalla on oma `keep_start`: pelin
     * jokainen linnake alkaa jaetulla `start`-palikalla, jonka kaksi ylintä
     * riviä ovat tyhjiä, eli jokaisen linnakkeen ensimmäiset kuusitoista
     * saraketta ovat tähän asti olleet taivasta katon sijaan. Yhden kentän
     * huoneessa sitä ei huomaa; maailmassa joka väittää olevansa sisätila se on
     * reikä väitteen läpi.
     *
     * Muu peli mitataan samalla koodilla, koska ilman sitä tämä luku olisi vain
     * sata prosenttia jostakin — ja vertailuluku sanoo tässä jotain mitä ei
     * osannut odottaa: **tehdas on 57 %.** Maailma 4 on sisätila kolmessa
     * kentässä neljästä, eli "katto" ei yksin erota mitään. Väite on siksi
     * sata vastaan viisikymmentäseitsemän eikä sata vastaan nolla: maailma 8
     * on ainoa jossa ei ole yhtään saraketta taivasta, ja lähin kilpailija on
     * kahden kentän päässä siitä.
     */
    const roofShare = (id) => {
      const rows = routeOf(id);
      const w = rows[0].length;
      let roofed = 0;
      for (let x = 0; x < w; x++) {
        if (STONE.includes(rows[0][x]) || STONE.includes(rows[1][x])) roofed++;
      }
      return (roofed / w) * 100;
    };
    const roofOf = (n) => {
      const levels = inWorld(n);
      const tot = levels.reduce((s, id) => s + getLevel(id).rows[0].length, 0);
      const roofed = levels.reduce((s, id) => s + (roofShare(id) / 100)
        * getLevel(id).rows[0].length, 0);
      return (roofed / tot) * 100;
    };
    const roofs = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ n, share: roofOf(n) }));
    const w8roof = roofs[7];
    const runnerUp = roofs.slice(0, 7).reduce((m, r) => (r.share > m.share ? r : m), roofs[0]);
    const openest = w8.map((id) => ({ id, share: roofShare(id) }))
      .sort((a, b) => a.share - b.share)[0] || { id: '—', share: 0 };
    expect('viimeisessä linnakkeessa ei ole ulkopuolta: joka sarakkeen yllä on kiveä',
      w8.length > 0 && w8roof.share === 100 && openest.share === 100
      && runnerUp.share <= 60,
      roofs.map((r) => `w${r.n} ${r.share.toFixed(0)} %`).join(', ')
      + ` — avoimin 8-kenttä ${openest.id} ${openest.share.toFixed(0)} %,`
      + ` seuraavaksi suljetuin maailma w${runnerUp.n} ${runnerUp.share.toFixed(0)} %`);

    /*
     * 3. EI LIPPUA, VAAN OVI.
     *
     * Lippu on se merkki jolla tämä peli sanoo "kenttä loppui"; ovi on se jolla
     * se sanoo "pomo kaatui". Jokaisessa maailmassa on tähän asti ollut kolme
     * lippua ja yksi ovi, ja se järjestys *on* se kaava jonka finaalin pitää
     * rikkoa: viimeisessä linnakkeessa ei ole yhtään lippua, koska siellä ei
     * ole yhtään huonetta josta pääsee ulos kävelemällä.
     */
    const flagsIn = (id) => getLevel(id).rows
      .reduce((s, row) => s + [...row].filter((ch) => ch === T.GOAL).length, 0);
    const worldFlags = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
      n,
      flags: inWorld(n).reduce((s, id) => s + flagsIn(id), 0),
      doors: inWorld(n).filter((id) => getLevel(id).boss).length,
    }));
    const w8flags = worldFlags[7];
    expect('viimeisessä maailmassa ei ole yhtään lippua vaan kuusi ovea',
      !!w8flags && w8flags.flags === 0 && w8flags.doors === 6
      && worldFlags.slice(0, 7).every((r) => r.flags >= 3 && r.doors === 1),
      worldFlags.map((r) => `w${r.n} ${r.flags} lippua / ${r.doors} ovea`).join(', '));

    /*
     * 4. JOKAINEN POMO, EIKÄ YKSIKÄÄN KAHDESTI.
     *
     * `bossVariant` on ainoa kohta jossa pomot oikeasti eroavat toisistaan —
     * osumat, nopeus ja liikesarja tulevat siitä — ja peli on kuluttanut kuusi
     * varianttia seitsemään linnakkeeseen (kolmonen kahdesti). Finaali kerää ne
     * kaikki, kerran kunkin.
     *
     * Toinen puolisko on se joka pitää tämän rehellisenä: **yksikään toinen
     * maailma ei sisällä kahta eri pomoa.** Ilman sitä lukua "kuusi varianttia"
     * olisi kuvaus eikä ero.
     */
    const variantsIn = (n) => new Set(inWorld(n).filter((id) => getLevel(id).boss)
      .map((id) => getLevel(id).bossVariant));
    const allVariants = new Set(ids.filter((id) => getLevel(id).boss)
      .map((id) => getLevel(id).bossVariant));
    const w8v = variantsIn(8);
    const others = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ n, v: variantsIn(n) }));
    expect('viimeisessä linnakkeessa on jokainen pelin pomo, kerran kukin',
      w8v.size === allVariants.size && [...allVariants].every((v) => w8v.has(v))
      && inWorld(8).filter((id) => getLevel(id).boss).length === w8v.size
      && others.every((o) => o.v.size <= 1),
      `w8 ${[...w8v].sort().join(' ')} (${w8v.size} kpl), koko peli `
      + `${[...allVariants].sort().join(' ')} — muissa maailmoissa `
      + others.map((o) => `w${o.n} ${o.v.size}`).join(', '));

    /*
     * 5. TIILI EI KOSKETA KIVEÄ.
     *
     * Tämä on se velka jonka ROADMAP kirjasi maailmaa 8 varten: linnaketeeman
     * tiilen ja maan ero on koko pelin toiseksi huonoin heti yön jälkeen, ja
     * maailma joka on kokonaan linnaketta joutuu tekemään sille jotain. Uusi
     * paletti ei ole vaihtoehto — teemalista on täysi ja `THEMES.fortress` on
     * seitsemän maailman viimeisen kentän ulkonäkö, eli sen muuttaminen
     * muuttaisi valmiita kenttiä.
     *
     * Jäljelle jää rakenne, ja vastaus on rakenteellinen: **tässä maailmassa
     * tiili ei koskaan kosketa kiveä.** Kun kaksi lähes samanväristä ruutua
     * eivät ole vierekkäin, silmän ei tarvitse erottaa niitä toisistaan — ero
     * luetaan siitä että tiili leijuu ja kivi ei. Hinta on todellinen ja se on
     * se joka tekee tästä säännön: `brick_wall`in kaltainen lattialta nouseva
     * tiilipino on tässä maailmassa kielletty rakenne.
     *
     * Kontrasti mitataan tässä eikä muisteta, ja muu peli mitataan
     * kosketuksista samalla koodilla — jos sielläkin olisi nolla, sääntö ei
     * kieltäisi mitään.
     */
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const g8 = canvas.getContext('2d');
    const meanTile = (ch, theme) => {
      g8.clearRect(0, 0, 64, 64);
      drawTile(g8, ch, 0, 16, theme, 3, 5, 0, ' ', {});
      const d = g8.getImageData(0, 16, 16, 16).data;
      let r = 0; let gg = 0; let b = 0; let n = 0;
      for (let q = 0; q < d.length; q += 4) {
        if (d[q + 3] < 8) continue;
        r += d[q]; gg += d[q + 1]; b += d[q + 2]; n++;
      }
      return n ? [r / n, gg / n, b / n] : null;
    };
    const contrast = (theme) => {
      const a = meanTile(T.GROUND, theme);
      const b = meanTile(T.BRICK, theme);
      if (!a || !b) return 0;
      return ((Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3 / 255)
        * 100;
    };
    const touches = (levels) => {
      let n = 0;
      const where = [];
      for (const id of levels) {
        const rows = getLevel(id).rows;
        for (let y = 0; y < rows.length; y++) {
          for (let x = 0; x < rows[y].length; x++) {
            if (rows[y][x] !== T.BRICK) continue;
            const near = [[1, 0], [-1, 0], [0, 1], [0, -1]]
              .some(([dx, dy]) => STONE.includes((rows[y + dy] || '')[x + dx] || ' '));
            if (near) { n++; if (where.length < 4) where.push(`${id} ${x},${y}`); }
          }
        }
      }
      return { n, where };
    };
    const w8touch = touches(w8);
    const gameTouch = touches(ids.filter((id) => !id.startsWith('8-')));
    const fortGap = contrast('fortress');
    const worstGap = Object.keys(THEMES)
      .map((th) => ({ th, gap: contrast(th) })).sort((a, b) => a.gap - b.gap);
    expect('viimeisessä linnakkeessa tiili ei kosketa kiveä, koska paletti ei erota niitä',
      w8.length > 0 && w8touch.n === 0 && gameTouch.n > 0 && fortGap < 10,
      `linnaketeema ${fortGap.toFixed(1)} % (huonoin ${worstGap[0].th} `
      + `${worstGap[0].gap.toFixed(1)} %, toiseksi huonoin ${worstGap[1].th} `
      + `${worstGap[1].gap.toFixed(1)} %) — kosketuksia maailmassa 8 ${w8touch.n}, `
      + `muualla ${gameTouch.n}${gameTouch.where.length ? ` (esim. ${gameTouch.where.join(' ')})` : ''}`
      + `${w8touch.where.length ? `: ${w8touch.where.join(' ')}` : ''}`);

    /*
     * 6. JOKAISEN KUILUN EDESSÄ ON TÄYSI VAUHDINOTTO.
     *
     * Luulaakso mittasi tämän ja kirjoitti sen kommenttiin: seisova hyppy
     * kantaa **0 px** sivusuunnassa, joten laskeutuminen on täsmälleen niin
     * hyvä kuin se vauhdinotto jonka se jättää. Maailma jonka jokainen kenttä
     * on käytävä ja jonka jokainen kuilu on laavaa on juuri se paikka jossa
     * tuo asia lakkaa olemasta ohje ja alkaa olla kentän rikkova virhe: jaettu
     * `fort_gap` tuo mukanaan vain neljä saraketta lattiaa, joten kaksi
     * peräkkäistä palikkaa voi tuottaa laavan jonka eteen ei ehdi kiihtyä.
     *
     * Sääntö on siis mitta eikä maku: **yhdenkään kuilun edessä ei ole alle
     * yhdeksää saraketta yhtenäistä lattiaa.** Yhdeksän on `keep_hole`in oma
     * profiili, sama jota pilvimaailma käyttää, ja se on tässä koko maailman
     * sävellyssääntö — se sanelee palikkajärjestyksen kaikissa kuudessa
     * kentässä.
     *
     * `%` eli murenevaa lavaa ei lasketa kuiluksi: se on jalansijaa siihen
     * asti kunnes sille astuu, ja sen oma vaikeus on eri kysymys.
     */
    const runUps = (levels) => {
      const out = [];
      for (const id of levels) {
        const rows = routeOf(id);
        const w = rows[0].length;
        const footing = [];
        for (let x = 0; x < w; x++) {
          footing.push([FLOOR, FLOOR + 1].some((y) => STONE.includes(rows[y][x])
            || rows[y][x] === T.CRUMBLE));
        }
        let run = 0;
        for (let x = 0; x < w; x++) {
          if (footing[x]) { run++; continue; }
          if (x && footing[x - 1] === false) continue;   // sama kuilu, jo kirjattu
          out.push({ id, x, run });
          run = 0;
        }
      }
      return out;
    };
    const w8runs = runUps(w8);
    const worstRun = w8runs.reduce((m, r) => (r.run < m.run ? r : m), { id: '—', run: 99 });
    const elsewhereRun = runUps(ids.filter((id) => !id.startsWith('8-')))
      .reduce((m, r) => (r.run < m.run ? r : m), { id: '—', run: 99 });
    expect('viimeisessä linnakkeessa jokaisen kuilun edessä on yhdeksän saraketta lattiaa',
      w8runs.length > 0 && worstRun.run >= 9 && elsewhereRun.run < 9,
      `${w8runs.length} kuilua, ahtain ${worstRun.id} sarakkeessa ${worstRun.x} `
      + `(${worstRun.run} saraketta vauhtia) — muun pelin ahtain ${elsewhereRun.id} `
      + `${elsewhereRun.run}`);
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

  /* ------------------------- pavun istuttaminen ------------------------- */
  /*
   * Red before green (DESIGN.md §7) for the beanstalk that grows instead of
   * standing there.
   *
   * The whole point of the change is a gap between two pictures of the same
   * level: `getLevel('1-2').rows` is the GROWN level — that is what
   * `src/data/rules.js` validates and what proves the sky band can be reached —
   * and `LevelScene.grid` starts out as the UNGROWN one. So the assertions are
   * a comparison between those two, tile for tile, rather than a count somebody
   * typed in: the level data stays the single source of truth for where the
   * vine goes, and this is the test that the two ever agree.
   *
   * Nothing below names a column or a row: the vine's own position is read out
   * of the level data and the block's position is derived from it the way the
   * rule says it is, so this keeps testing the mechanic if the chunk moves.
   */
  {
    const { getLevel } = await import('/src/data/levels.js');
    const { Sfx } = await import('/src/core/audio.js');
    const { BEAN_BLOCK_OVER_FLOOR } = await import('/src/scenes/level.js');
    const { RULE_CONSTANTS } = await import('/src/data/rules.js');
    reset();
    const bean = new LevelScene(game, '1-2');
    bean.time = 9999;
    game.scene = bean;
    const def = getLevel('1-2').rows;

    /* Where the block hangs is one number kept in two files — the validator may
     * not import a scene and the engine may not import the validator — so the
     * two copies are asserted against each other, exactly as the secret-brick
     * rates are. A drift here would let the gate bless a block the engine puts
     * somewhere else. */
    expect('the engine and the validator agree where a bean block hangs',
      BEAN_BLOCK_OVER_FLOOR === RULE_CONSTANTS.BEAN_BLOCK_OVER_FLOOR,
      `moottori ${BEAN_BLOCK_OVER_FLOOR}, säännöt ${RULE_CONSTANTS.BEAN_BLOCK_OVER_FLOOR}`);

    const wanted = [];
    for (let ty = 0; ty < def.length; ty++) {
      for (let tx = 0; tx < def[ty].length; tx++) if (def[ty][tx] === 'v') wanted.push([tx, ty]);
    }
    const foot = wanted.reduce((a, b) => (b[1] > a[1] ? b : a), wanted[0] || [0, 0]);
    const blockAt = [foot[0], foot[1] + 1 - BEAN_BLOCK_OVER_FLOOR];
    const liveVines = () => wanted.filter(([tx, ty]) => bean.rawTileAt(tx, ty) === 'v').length;

    expect('a beanstalk is not standing there when the level loads',
      wanted.length > 0 && liveVines() === 0
      && bean.rawTileAt(blockAt[0], blockAt[1]) === '?',
      `kentässä ${wanted.length} varsiruutua, ruudukossa ${liveVines()}, `
      + `lohko "${bean.rawTileAt(blockAt[0], blockAt[1])}" kohdassa `
      + `${blockAt[0]},${blockAt[1]} (jalka rivillä ${foot[1]})`);

    /* The sound comes with the picture (DESIGN.md §8), and it has to be its
     * own: the three payouts a block already has are a coin, a power-up and a
     * dead thud, and a fourth event wearing one of those is a fourth event the
     * player mis-reads. */
    const heard = [];
    const realPlay = Sfx.play;
    Sfx.play = function spy(name) { heard.push(name); return realPlay.call(this, name); };
    bean.bumpTile(blockAt[0], blockAt[1], bean.player);
    Sfx.play = realPlay;

    const grew = [];
    for (let f = 0; f < 400; f++) {
      bean.update(mkInput());
      if (f === 20 || f === 40 || f === 60) grew.push(liveVines());
    }
    const missing = wanted.filter(([tx, ty]) => bean.rawTileAt(tx, ty) !== 'v');

    expect('hitting the block grows exactly the beanstalk the rules validated',
      missing.length === 0 && liveVines() === wanted.length,
      `${liveVines()}/${wanted.length} ruutua, puuttuu ${missing.length}`
      + (missing.length ? ` (esim. ${missing[0]})` : ''));

    /* A tile at a time, not a vine that appears. Measured at three moments
     * rather than asserted as a constant, because the speed is a feel decision
     * and this test is about the growing. */
    expect('the vine grows a tile at a time rather than appearing',
      grew[0] > 0 && grew[0] < grew[1] && grew[1] < grew[2] && grew[2] < wanted.length,
      `20/40/60 framea: ${grew.join(' -> ')} / ${wanted.length}`);

    expect('the bean has a sound of its own and does not borrow another',
      heard.length === 1 && heard[0] === 'sprout' && Sfx.has('sprout'),
      `soi [${heard.join(', ')}]`);

    /* And it grows from the floor up: the tile the bean landed in is there long
     * before the one that crosses into the sky band. The spent block is one of
     * the tiles that gets written — the stalk grows through the block it came
     * out of — which is what lets a finished vine be climbed from the ground. */
    const order = new LevelScene(game, '1-2');
    order.time = 9999;
    game.scene = order;
    order.bumpTile(blockAt[0], blockAt[1], order.player);
    for (let f = 0; f < 24; f++) order.update(mkInput());
    const low = order.rawTileAt(foot[0], foot[1]) === 'v';
    const high = order.rawTileAt(wanted[0][0], wanted[0][1]) === 'v';
    expect('the beanstalk grows upward from the floor, not downward from the sky',
      low && !high,
      `24 framen jälkeen jalka ${low ? 'on' : 'ei ole'} (rivi ${foot[1]}), `
      + `latva ${high ? 'on' : 'ei ole'} (rivi ${wanted[0][1]})`);
    for (let f = 0; f < 400; f++) order.update(mkInput());
    expect('the grown stalk runs unbroken from the floor through the spent block',
      order.rawTileAt(blockAt[0], blockAt[1]) === 'v'
      && order.rawTileAt(foot[0], foot[1]) === 'v',
      `lohkon paikalla "${order.rawTileAt(blockAt[0], blockAt[1])}", `
      + `jalassa "${order.rawTileAt(foot[0], foot[1])}"`);

    /* A quicksave taken while the stalk is halfway up has to come back halfway
     * up and finish, which is the whole reason `Beanstalk` is in the REGISTRY
     * (DESIGN.md §6): the tiles it has already written are in the saved grid,
     * and the ones it has not written are nowhere but in the entity. Without
     * the entry the snapshot would restore a level with half a beanstalk in it
     * and nothing left alive to finish the job. */
    {
      reset();
      const half = new LevelScene(game, '1-2');
      half.entities = half.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
      half.time = 9999;
      game.setScene(half);
      half.bumpTile(blockAt[0], blockAt[1], half.player);
      for (let f = 0; f < 40; f++) half.update(mkInput());
      const partway = wanted.filter(([tx, ty]) => half.rawTileAt(tx, ty) === 'v').length;
      const snap = JSON.parse(JSON.stringify(captureState(game)));
      const kinds = snap.level.entities.map((d) => d.t);
      restoreState(game, snap);
      const back = game.scene;
      for (let f = 0; f < 400; f++) back.update(mkInput());
      const done = wanted.filter(([tx, ty]) => back.rawTileAt(tx, ty) === 'v').length;
      expect('a beanstalk caught half-grown survives a save state — REGISTRY',
        kinds.includes('Beanstalk') && partway > 0 && partway < wanted.length
        && done === wanted.length,
        `tallennettaessa ${partway}/${wanted.length}, latauksen jälkeen `
        + `${done}/${wanted.length}, oliot [${kinds.join(' ')}]`);
    }
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
    /* A jump, held. The press has to be a press and not a hold — the engine
     * jumps off `pressed.jump` — which is the whole reason this is not `hold`
     * with 'jump' in the list. */
    const leap = (s, i, frames) => {
      for (let f = 0; f < frames; f++) {
        i.held = blank();
        i.held.jump = true;
        i.pressed = blank();
        if (f === 0) i.pressed.jump = true;
        s.update(i);
      }
    };

    /* Both ends of the size range. The widest body is three tiles across while
     * it hangs off a vine, so anything solid beside the vine is a ceiling only
     * the big player hits — exactly the sort of thing that ships unnoticed.
     *
     * And it starts from the block now, because that is the level: standing on
     * the floor under the bump row, a jump, the bean, and only then a vine. The
     * two halves of the trip are deliberately the same test — a beanstalk that
     * grows and cannot be climbed, or one that can be climbed at only some
     * sizes, is the same failure to the player either way. */
    for (const power of [{ type: null, level: 0 }, { type: 'leaf', level: 5 }]) {
      const s = mk(power);
      const i = mkInput();
      put(s, 150, 28);
      leap(s, i, 40);
      const planted = s.rawTileAt(150, 24) !== '?';
      hold(s, i, [], 140);
      hold(s, i, ['up'], 360);
      const up = s.player.y + s.player.h < 15 * 16;
      hold(s, i, ['right'], 60);
      const onPlatform = s.player.onGround && Math.round(s.player.y + s.player.h) === 9 * 16;
      const coins = game.state.coins;
      hold(s, i, ['right'], 180);          // walk off the edge and fall home
      expect(`power ${power.level} plants the bean, climbs it and gets back down`,
        planted && up && onPlatform && game.state.coins > coins && s.player.onGround
        && !s.player.dying && s.player.y + s.player.h > 27 * 16,
        `lohko ${planted}, taivaassa ${up}, lavalla ${onPlatform}, `
        + `jalat ${Math.round(s.player.y + s.player.h)}`);

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

  /* ------------- luolakaistan musiikki: paikka, ei tapahtuma ------------- */
  /*
   * Punainen ennen vihreää (DESIGN.md kohta 7) sille päätökselle joka piti
   * tehdä ennen kuin yhtään säveltä kirjoitettiin: **löytyminen on tapahtuma,
   * musiikki on paikka.**
   *
   * Piilokaistalle saapumisella on jo merkkinsä — `noteSecret` kirjaa löydön
   * sillä framella jolla matka päätetään, putki soi, ja kartan salaisuuslaskuri
   * nousee. Jos musiikinvaihto osuisi samaan hetkeen, se olisi §8:n kieltämä
   * toinen samaa sanova merkki: kaksi "jotain tapahtui" -signaalia peräkkäin
   * opettaa lukemaan väärää asiaa. Siksi nämä tarkistukset eivät kysy *onko*
   * luolalla oma raita vaan **milloin** se tulee, **kuinka kauan** se pysyy ja
   * **mikä sen tuo takaisin** — eli juuri ne asiat joissa paikka ja tapahtuma
   * eroavat toisistaan.
   *
   * "Raita nimeltä cave on olemassa" ei todista mitään, joten sitä ei kysytä
   * kertaakaan yksinään.
   */
  {
    const { Music, audioTap } = await import('/src/core/audio.js');
    const mk = (id, power = { type: null, level: 0 }, time = 9999) => {
      reset(power);
      const s = new LevelScene(game, id);
      s.entities = s.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
      s.time = time;
      // setScene eikä sijoitus: `enter()` on se paikka jossa kohtaus valitsee
      // raitansa, ja puolet näistä tarkistuksista koskee juuri sitä.
      game.setScene(s);
      return s;
    };
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
    const found = (id) => ((game.state.secrets || {})[id] || []).filter((k) => k === 'cave').length;

    /* 1. Raita vaihtuu kaistan mukaan ja vaihtuu takaisin. Molemmat suunnat
     * samassa tarkistuksessa siksi että pelkkä meno on helppo: paikka joka ei
     * lopu kun siitä lähtee ei ole paikka vaan tila johon jäätiin. */
    {
      const s = mk('1-2', { type: 'shroom', level: 1 });
      const own = Music.current;
      put(s, 229, 26);
      hold(s, i, ['down'], 120);
      hold(s, i, [], 60);
      const inCave = Music.current;
      const caveBand = bandOf(s);
      put(s, 250, 43);
      hold(s, i, [], 3);
      s.player.warpLock = 0;
      hold(s, i, ['up'], 120);
      hold(s, i, [], 90);
      expect('the cave band sounds like itself, and leaving gives the level back',
        own === 'level' && Music.has('cave') && inCave === 'cave'
        && caveBand === 2 && bandOf(s) === 1 && Music.current === 'level',
        `${own} -> ${inCave} (kaista ${caveBand}) -> ${Music.current} (kaista ${bandOf(s)})`);
    }

    /* 2. Taivaskaista pitää kentän oman musiikin. Päätös, ei unohdus: yksi
     * raita kahdelle vastakkaiselle paikalle sanoisi "salaisuus" eikä "luola",
     * ja silloin musiikki olisi taas löytymisen merkki. */
    {
      const s = mk('4-2', { type: 'shroom', level: 1 });
      const own = Music.current;
      put(s, 245, 28);
      hold(s, i, ['up'], 120);
      hold(s, i, [], 90);
      expect('the sky band keeps the level\'s own music',
        own === 'factory' && bandOf(s) === 0 && Music.current === 'factory',
        `${own} -> ${Music.current} (kaista ${bandOf(s)})`);
    }

    /* 3. Sama mitattuna framen tarkkuudella, ja kolme lukua eikä kahta.
     *
     * Saapumisella on kaksi hetkeä: löytö kirjataan sillä framella jolla matka
     * päätetään, ja matka päättyy sillä framella jolla ohjaus palaa. Musiikki
     * ei saa osua kumpaankaan. Pelkkä "putken jälkeen" ei riittäisi — vaihto
     * juuri sillä framella jolla pelaaja putkahtaa ulos olisi matkan viimeinen
     * isku, ja matka on tapahtuma. Siksi tässä mitataan myös se väli. */
    {
      const s = mk('1-2');
      put(s, 229, 26);
      let foundAt = -1;
      let controlAt = -1;
      let musicAt = -1;
      for (let f = 0; f < 240; f++) {
        i.held = blank();
        i.held.down = f < 4;
        i.pressed = blank();
        const traveling = !!s.player.transit;
        s.update(i);
        if (foundAt < 0 && found('1-2') > 0) foundAt = f;
        if (controlAt < 0 && traveling && !s.player.transit) controlAt = f;
        if (musicAt < 0 && Music.current === 'cave') musicAt = f;
      }
      expect('the music is not a second find-signal: the place arrives after the find',
        foundAt >= 0 && controlAt > foundAt && musicAt > controlAt + 20
        && bandOf(s) === 2,
        `löytö framella ${foundAt}, ohjaus takaisin framella ${controlAt}, `
        + `musiikki framella ${musicAt} (${musicAt - foundAt} framea löydöstä, `
        + `${musicAt - controlAt} ohjauksen palaamisesta)`);
    }

    /* 4. Ja toisinpäin: paikka kuulostaa toisella käynnillä samalta kuin
     * ensimmäisellä, vaikka löytö tapahtuu vain kerran. Löytymisen merkki
     * soisi kerran; paikan ääni soi joka kerta. */
    {
      const s = mk('1-2');
      put(s, 229, 26);
      hold(s, i, ['down'], 120);
      hold(s, i, [], 60);
      const first = Music.current;
      const firstFinds = found('1-2');
      put(s, 250, 43);
      hold(s, i, [], 3);
      s.player.warpLock = 0;
      hold(s, i, ['up'], 120);
      hold(s, i, [], 90);
      const between = Music.current;
      put(s, 229, 26);
      hold(s, i, ['down'], 120);
      hold(s, i, [], 60);
      expect('the music is a place: the second visit sounds like the first, the find does not',
        first === 'cave' && between === 'level' && Music.current === 'cave'
        && firstFinds === 1 && found('1-2') === 1,
        `1. käynti ${first}, välissä ${between}, 2. käynti ${Music.current}, `
        + `löytöjä ${found('1-2')}`);
    }

    /* 5. Pikatallennus luolassa. `enter()` ajetaan uudelleen latauksessa, joten
     * se ei saa lukea raitaa kenttädatasta vaan siitä missä jalat ovat. */
    {
      const s = mk('1-2');
      put(s, 229, 26);
      hold(s, i, ['down'], 120);
      hold(s, i, [], 60);
      const saved = Music.current;
      game.slot = 3;
      game.quickSave();
      Music.play('title');                     // jotain aivan muuta väliin
      const between = Music.current;
      game.quickLoad();
      const back = game.scene;
      expect('a quicksave taken in the cave loads back into the cave music',
        saved === 'cave' && between === 'title' && bandOf(back) === 2
        && Music.current === 'cave',
        `tallennus ${saved}, väliin ${between}, lataus ${Music.current} `
        + `(kaista ${bandOf(back)})`);
      game.slot = 1;
    }

    /* 6. Kuoppaan putoaminen käy luolakaistan puolella ennen laavaa. Se ei ole
     * käynti luolassa eikä siitä saa tulla ääntä. Tämän ei kaada odotusaika
     * vaan kuolemaportti — mitattuna sauman alla ollaan vain framen verran, ja
     * sillä framella kuolema on jo tapahtunut. Kaksi eri vartijaa, ja kumpikin
     * omalla testillään, ettei toinen pääse esittämään toista. */
    {
      const s = mk('1-2');
      s.player.x = 71 * 16;
      s.player.y = 26 * 16;
      let caveFrames = 0;
      let deepest = 0;
      let seam = 0;
      for (let f = 0; f < 200 && s.state === 'play'; f++) {
        i.held = blank();
        i.pressed = blank();
        s.update(i);
        deepest = Math.max(deepest, bandOf(s));
        if (bandOf(s) >= 2) seam++;
        if (Music.current === 'cave') caveFrames++;
      }
      expect('falling into a pit never sounds like the cave',
        caveFrames === 0 && deepest >= 2,
        `syvin kaista ${deepest}, sauman alla ${seam} framea, luolamusiikkia `
        + `${caveFrames} framea`);
    }

    /* 7. Kello ei nollaudu raidan mukana. `Music.play` aloittaa jokaisen raidan
     * rauhallisena, joten luolaan meno vähissä ajoissa veisi kiireen pois —
     * juuri sen signaalin joka on jo ansaittu. */
    {
      const s = mk('1-2', { type: null, level: 0 }, 90);
      put(s, 229, 26);
      hold(s, i, ['down'], 120);
      hold(s, i, [], 60);
      expect('entering the cave with the clock low keeps the hurry',
        Music.current === 'cave' && Music._hurry === true,
        `raita ${Music.current}, kiire ${Music._hurry}, aikaa ${s.time}`);
    }

    /* 8. Kiihtyvyys. Grieg valittiin rakenteensa takia — teos kiihtyy — joten
     * se on mitattava eikä uskottava. Askelen pituus samassa osiossa, ensin
     * heti alussa ja sitten kuuden kierroksen jälkeen, ja vertailuna raita
     * jonka ei kuulu kiihtyä lainkaan. */
    {
      const tap = audioTap();
      const stepMs = (name, pass) => {
        Music.play(name);
        // Raita jota ei ole ei tuota ääniä eikä siis askeleita: `play` asettaa
        // `current`in silti, joten tämä on ainoa kohta josta puuttuva raita
        // näkyy — ja se on syytä näkyä lukuna eikä poikkeuksena.
        if (!Music._voices) return NaN;
        Music._step = pass * Music._loopLen;
        Music._cycle = pass;
        Music._applyVariation();
        Music._nextTime = tap.ctx.currentTime + 0.005;
        const t0 = Music._nextTime;
        const s0 = Music._step;
        Music._tick();
        if (Music._timer) { clearTimeout(Music._timer); Music._timer = null; }
        return ((Music._nextTime - t0) / (Music._step - s0)) * 1000;
      };
      const caveEarly = tap ? stepMs('cave', 0) : 0;
      const caveLate = tap ? stepMs('cave', 6) : 0;
      Music.stop();
      const levelEarly = tap ? stepMs('level', 0) : 0;
      const levelLate = tap ? stepMs('level', 6) : 0;
      Music.stop();
      expect('the cave track accelerates the longer you stay, and only it does',
        !tap || (caveEarly > 0 && caveLate < caveEarly * 0.6
          && Math.abs(levelLate - levelEarly) < 0.5),
        tap ? `luola ${caveEarly.toFixed(1)} -> ${caveLate.toFixed(1)} ms `
          + `(${(caveEarly / caveLate).toFixed(2)}x), kenttä ${levelEarly.toFixed(1)} `
          + `-> ${levelLate.toFixed(1)} ms`
          : 'ei äänikontekstia — ohitettu');
    }

    /* 9. Ja kiihtyvyys nollautuu kun paikasta lähtee. Muuten toinen käynti
     * alkaisi siitä mihin ensimmäinen jäi, ja "älä jää tänne" muuttuisi
     * rangaistukseksi siitä että kävi kerran aiemmin. */
    {
      Music.play('cave');
      Music._step = 6 * Music._loopLen;
      const hot = Music.pace();
      Music.play('level');
      Music.play('cave');
      const cold = Music.pace();
      expect('leaving the cave winds the accelerando back to the start',
        hot >= 1.9 && cold < 1.05,
        `lähtiessä ${hot.toFixed(2)}x, palatessa ${cold.toFixed(2)}x `
        + `(askel ${Music._step})`);
      Music.stop();
      Music.current = null;
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

    /* Nopeutuminen on sääntö jota pelaaja ei voi lukea mistään ellei naama
     * kerro sitä. `drawStinkCloud` osaa kaksi ilmettä ja piirsi vuosia vain
     * toista: molemmat kutsupaikat antoivat kirjaimellisen `true`:n, joten
     * rauhallinen pilvi näytti aivan yhtä vihaiselta kuin puolitoista kertaa
     * nopeampi karkulainen. Testi vertaa kahta muuten identtistä pilveä
     * pikseli pikseliltä, koska juuri se ero oli nolla.
     *
     * `tick = 0` ei ole makuasia: karkulainen myös vilkkuu (`get tint`), ja
     * vilkku on päällä joka toinen neljän framen jakso. Nollassa se on pois,
     * joten ainoa jäljelle jäävä ero on ilme. */
    {
      const faces = (angry) => {
        const cv = document.createElement('canvas');
        cv.width = 40; cv.height = 32;
        const g2 = cv.getContext('2d');
        const e2 = new E.StinkCloud(setup(96).s, 8, 8);
        e2.tick = 0;
        e2.facing = 1;
        e2.angry = angry;
        e2.x = 8; e2.y = 8;
        e2.draw(g2);
        return g2.getImageData(0, 0, 40, 32).data;
      };
      const calm = faces(false);
      const cross = faces(true);
      let diff = 0;
      for (let i = 0; i < calm.length; i += 4) {
        if (calm[i] !== cross[i] || calm[i + 1] !== cross[i + 1]
          || calm[i + 2] !== cross[i + 2] || calm[i + 3] !== cross[i + 3]) diff++;
      }
      expect('a stink cloud that escaped a bubble looks angrier than one that never was',
        diff > 0, `${diff} px eroa`);
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
    const BOSS_LEVELS = ['1-F', '2-F', '3-F', '4-F', '5-F', '6-F', '7-F'];

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

    /* ------------------------------ luuranko ----------------------------- */
    /*
     * LUURANKOPOMO, 6-F, `bossVariant: 4`.
     *
     * Kaksi asiaa erottaa hänet muista pomoista, ja molemmat mitataan tässä
     * eikä uskota:
     *
     *   1. **Osuma hajottaa hänet.** Muut pomot ottavat osuman ja kiihtyvät;
     *      luuranko lentää palasiksi ja kokoaa itsensä, ja se näkyy kahtena
     *      iskuaaltona jotka lähtevät hänestä ulos. Aalto on olemassa oleva
     *      `Shockwave` — sama esine jonka pelaaja jo osaa lukea "väistä" —
     *      eikä uusi entiteetti, joten `REGISTRY` ja tilatallennus pysyvät
     *      koskemattomina. Nyrkkeilijä on verrokki: hän ei tee tätä.
     *   2. **Hänellä on oma ääni.** `VOICES` on ollut taulussa yhtä puhujaa
     *      varten siitä asti kun se kirjoitettiin, ja sen oma kommentti sanoo
     *      että ääni jota kukaan ei puhu on sama virhe kuin ääni jota mikään ei
     *      soita. Luuranko on luonteva ensimmäinen toinen puhuja: hän nauraa
     *      **silloin kun kruunu lähtee päästä**, eli täsmälleen sillä hetkellä
     *      kun häneen voi taas osua. Se on ilkkumista eikä varoitus, ja siksi
     *      se saa olla oma äänensä — varoitusäänet pysyvät jaettuina, kuten
     *      `VOICES`in kommentti vaatii.
     *
     * Naurun ajoitus mitataan soittolokista eikä lipusta: `Sfx.play` kääritään
     * hetkeksi, pomoa ajetaan monta piikkisykliä, ja lokista katsotaan että
     * ääni tuli kerran sykliä kohti ja tuli oikeassa vaiheessa.
     */
    {
      const { VOICES, Sfx: audio } = await import('/src/core/audio.js');
      reset();
      const s = new LevelScene(game, '6-F');
      game.setScene(s);
      const bone = s.entities.find((e) => e instanceof E.Boss);
      const boxerScene = new LevelScene(game, '1-F');
      const boxer = boxerScene.entities.find((e) => e instanceof E.Boss);

      const waves = (sc) => sc.entities.filter((e) => e instanceof E.Shockwave).length;
      const hit = (sc, b) => {
        b.spikePhase = 'open';
        b.spikeTimer = 1e6;
        b.invuln = 0;
        const before = waves(sc);
        b.stomp();
        return waves(sc) - before;
      };
      const boneWaves = hit(s, bone);
      const boxerWaves = hit(boxerScene, boxer);
      expect('luurankoon osuminen hajottaa hänet — kaksi aaltoa, nyrkkeilijällä ei yhtään',
        boneWaves === 2 && boxerWaves === 0 && bone.variant === 4,
        `luuranko ${boneWaves} aaltoa, nyrkkeilijä ${boxerWaves}, variantti ${bone.variant}`);

      /* Ja ääni: oma puhuja, matalampi kuin pelaaja, ja se kuuluu vasta kun
       * kruunu on pois — ei sitä laittaessa, koska silloin se olisi toinen
       * varoitus samasta asiasta (DESIGN.md kohta 8). */
      const log = [];
      const realPlay = audio.play;
      audio.play = (name) => { log.push({ name, phase: bone.spikePhase }); };
      /* Aloitus avoimesta vaiheesta, jotta laskurit ovat vertailukelpoiset:
       * yksi sykli on tasan yksi `spikes` (kruunu päähän) ja yksi nauru
       * (kruunu pois). Piikkivaiheesta aloittaminen antaisi yhden naurun
       * enemmän kuin syklejä, mikä olisi totta mutta mittaisi aloitusta. */
      bone.hp = bone.maxHp;
      bone.spikePhase = 'open';
      bone.spikeTimer = 2;
      bone.doffTimer = 0;
      for (let f = 0; f < 900; f++) bone.updateSpikes();
      audio.play = realPlay;
      const laughs = log.filter((e) => e.name === 'luuranko');
      /* Yksi nauru per kruunun riisuminen, ja riisuminen tunnistetaan siitä
       * äänestä joka sitä on aina merkinnyt (`pipe`). Näin luku ei riipu siitä
       * mihin kohtaan sykliä silmukan framebudjetti sattuu loppumaan. */
      const doffs = log.filter((e) => e.name === 'pipe').length;
      const donned = log.filter((e) => e.name === 'spikes').length;
      expect('luurangolla on oma ääni, ja hän nauraa vasta kun kruunu on pois',
        !!VOICES.luuranko && VOICES.luuranko.pitchScale < VOICES.player.pitchScale
        && laughs.length > 0 && laughs.length === doffs
        && laughs.every((e) => e.phase === 'open'),
        `naurua ${laughs.length}, kruunu pois ${doffs} kertaa, päähän ${donned}, vaiheet `
        + `${[...new Set(laughs.map((e) => e.phase))].join('/') || '-'}, `
        + `sävelkorkeus ${VOICES.luuranko ? VOICES.luuranko.pitchScale : 'ei ääntä'}`);
    }

    /* ------------------------------ sääherra ----------------------------- */
    /*
     * SÄÄHERRA, 7-F, `bossVariant: 5`, ja hän vastaa osumaan **nousemalla**.
     *
     * Kysymys on sama kuin luurangolla — mitä pomo tekee kun häneen osuu — ja
     * vastaus tulee tämän maailman aiheesta: sää väistää ylöspäin. Muut pomot
     * kiihtyvät, mikä on luku jonka pelaaja tuntee kolmen sekunnin päästä;
     * tämä lähtee ilmaan samalla framella ja tulee alas iskuaaltojen kanssa,
     * koska variantti >= 1 heittää ne kovasta laskeutumisesta. Yksi rivi
     * (`jumpTimer = 1`) tuottaa siis koko ketjun eikä `REGISTRY` muutu.
     *
     * Mitataan vertailuna eikä yksin: molempien pomojen oma hyppykello
     * asetetaan kauas, jotta ilmaan nouseminen ei voi olla sattumaa, ja
     * luuranko ajetaan samalla mitalla. Ilman vertailua testi menisi läpi
     * pelkästä siitä että pomot hyppivät muutenkin.
     */
    {
      const liftOff = (id) => {
        reset();
        const s = new LevelScene(game, id);
        game.setScene(s);
        const b = s.entities.find((e) => e instanceof E.Boss);
        const idle = mkInput();
        for (let f = 0; f < 60; f++) s.update(idle);   // anna hänen laskeutua
        b.spikePhase = 'open';
        b.spikeTimer = 1e6;
        b.invuln = 0;
        b.jumpTimer = 9999;                            // oma kello pois pelistä
        b.chargeTimer = 9999;
        b.stomp();
        for (let f = 0; f < 40; f++) {
          s.update(idle);
          if (!b.onGround) return { at: f, variant: b.variant };
        }
        return { at: -1, variant: b.variant };
      };
      const storm = liftOff('7-F');
      const skeleton = liftOff('6-F');
      expect('sääherra nousee ilmaan osumasta, luuranko ei',
        storm.variant === 5 && storm.at >= 0 && storm.at <= 3 && skeleton.at < 0,
        `sääherra (variantti ${storm.variant}) ilmassa framella ${storm.at}, `
        + `luuranko (variantti ${skeleton.variant}) framella ${skeleton.at} — 40 framen ikkuna`);
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
    /* The scene is fresh, so its beanstalk has not been grown yet and there is
     * not one vine tile in the grid. It still has to count as a vine: this
     * overlay exists to say what a level is hiding while somebody tests it, and
     * a count that only appears once the tester has already found the thing is
     * a count that helps nobody. */
    expect('the debug overlay counts the secrets in the level, grown or not',
      c.vine === 1 && c.warp > 0 && c.bands === 1
      && plain.vine === 0 && plain.warp === 0 && plain.bands === 0,
      `1-2: varsi ${c.vine} (ruudukossa ${tall.beanstalks.size} istuttamatta) `
      + `putki ${c.warp} kaistat ${c.bands}`
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

  /* ------------- kolikkojonot: vihje eikä kyltti (DESIGN.md §5) ----------- */
  /*
   * A hidden band is the one secret in this game that a player cannot stumble
   * into. A loaded brick is bumped by accident, a star block is an ordinary `?`
   * and gets hit out of habit, a switch is a tile of its own with a slab of
   * brick hanging over it — but a warp pipe asks you to *stand on it and press
   * down*, and nothing in ordinary play ever does that. So the ways into a
   * hidden band are the places a coin hint has to earn its keep, and these are
   * the properties that separate a hint from a sign. Each one can actually go
   * wrong, which is why each one is a line here rather than a sentence in a
   * comment somewhere:
   *
   *   1. **every entrance carries one.** A census, not a spot check: eight ways
   *      into a hidden band in the whole game, and a ninth added later has to
   *      come past this line rather than ship silently unhinted.
   *   2. **it pays on its own.** Every hint coin is collectible from the route
   *      band's own floor at power level 0, without finding anything. That is
   *      `fac_duct_down`'s test, quoted: "they are worth having on their own, so
   *      following them costs nothing if there turns out to be nothing".
   *   3. **it is not an arrow.** Three ways of failing that, all measured: a
   *      coin touching the entrance tile marks it; a run centred on the entrance
   *      is an X on the spot; and a shape that only ever appears at a secret is
   *      a signpost however innocent it looks. The third is the one that needs
   *      the whole game to answer, so it is counted over the whole game.
   *   4. **the shape says "a pipe", never "this pipe".** Two-tile floor pipes
   *      are pixel-identical apart from the shine in a warp's throat, so the
   *      coins over them have to be identical too. This is the line that fails
   *      when somebody gives the secret one a hint and forgets its twin.
   *
   * What is deliberately *not* asserted here: that a loaded brick, a star block
   * or a switch has a hint. None of them gets one, and that is the design —
   * a trail on a secret that already reads is noise, and noise is what makes
   * the real hints stop working.
   */
  {
    reset();
    const { getLevel } = await import('/src/data/levels.js');
    const jump = await (await fetch('/tools/jump-budget.json')).json();

    /* Eight columns either side, and rows 7-10 of the band. That is the bump
     * row and the two rows around it — the band a coin has to be in to be
     * grabbed from the floor at all — widened by enough that a three-coin run
     * beside an entrance counts and the next chunk's coins do not. */
    const WIN = 8;
    const BUMP_FROM = 7;
    const BUMP_TO = 10;
    /* Anything the feet can rest on, so a coin over a pipe is measured against
     * the pipe's own lid rather than the floor four rows under it. */
    const STANDABLE = new Set([...'#XB?!*uN[]{}%()S-']);
    const isCoin = (sc, tx, ty) => sc.rawTileAt(tx, ty) === 'o';

    /**
     * Every way into a hidden band, read from the loaded scene rather than from
     * the level data, so that the bean block is the one the engine actually
     * planted (`plantVines`) instead of a fourth copy of where it hangs.
     */
    const entrancesOf = (sc) => {
      const def = getLevel(sc.id);
      if (!def.bands) return [];
      const top = def.bands.main;
      const list = [];
      for (let ty = top; ty < top + def.bands.rows; ty++) {
        for (let tx = 0; tx < sc.w; tx++) {
          if (!'()'.includes(sc.rawTileAt(tx, ty))) continue;
          if (tx > 0 && '()'.includes(sc.rawTileAt(tx - 1, ty))) continue;
          let x1 = tx;
          while (x1 + 1 < sc.w && '()'.includes(sc.rawTileAt(x1 + 1, ty))) x1++;
          list.push({ kind: 'putki', x0: tx, x1, y: ty, top });
        }
      }
      for (const key of sc.beanstalks.keys()) {
        const [bx, by] = key.split(',').map(Number);
        list.push({ kind: 'papulohko', x0: bx, x1: bx, y: by, top });
      }
      return list.map((e) => ({ ...e, where: `${sc.id} ${e.kind}@${e.x0}` }));
    };

    const hints = [];
    let runs = 0;
    let runsAtSecret = 0;
    const pipes = [];
    for (const id of levelIds()) {
      const sc = new LevelScene(game, id);
      const def = getLevel(id);
      const doors = entrancesOf(sc);
      for (const e of doors) {
        const coins = [];
        for (let ty = e.top + BUMP_FROM; ty <= e.top + BUMP_TO; ty++) {
          for (let tx = Math.max(0, e.x0 - WIN); tx <= Math.min(sc.w - 1, e.x1 + WIN); tx++) {
            if (isCoin(sc, tx, ty)) coins.push({ tx, ty });
          }
        }
        hints.push({ id, e, coins, sc });
      }

      /* Every coin run in the bump band of every band, so that "how often does
       * a coin row mean something" is a number and not an impression. A run is
       * allowed one empty column, because `o o o` is one row of coins and not
       * three rows of one. */
      const bandTops = def.bands ? [0, def.bands.main, def.bands.cave] : [0];
      for (const b of bandTops) {
        for (let ty = b + BUMP_FROM; ty <= b + BUMP_TO; ty++) {
          let tx = 0;
          while (tx < sc.w) {
            if (!isCoin(sc, tx, ty)) { tx++; continue; }
            let end = tx;
            for (;;) {
              if (isCoin(sc, end + 1, ty)) { end++; continue; }
              if (sc.rawTileAt(end + 1, ty) === ' ' && isCoin(sc, end + 2, ty)) { end += 2; continue; }
              break;
            }
            runs++;
            if (doors.some((e) => e.top === b && end >= e.x0 - WIN && tx <= e.x1 + WIN)) runsAtSecret++;
            tx = end + 1;
          }
        }
      }

      /* Two-tile floor pipes: a mouth, one tile of throat, and ground. That is
       * `pipe_short`, `warp_pipe` and `fac_duct_down` — the same silhouette
       * whether or not it goes anywhere. */
      for (let ty = 0; ty < sc.h; ty++) {
        for (let tx = 0; tx < sc.w; tx++) {
          const ch = sc.rawTileAt(tx, ty);
          if (ch !== '[' && ch !== '(') continue;
          if (sc.rawTileAt(tx, ty + 1) !== '{' || sc.rawTileAt(tx, ty + 2) !== '#') continue;
          const offsets = [];
          for (let cy = ty - 4; cy < ty; cy++) {
            for (let cx = tx - WIN; cx <= tx + WIN; cx++) if (isCoin(sc, cx, cy)) offsets.push(cx - tx);
          }
          pipes.push({ id, tx, warp: ch === '(', offsets: offsets.join(',') });
        }
      }
    }

    /* 1. The census. */
    const bare = hints.filter((h) => h.coins.length < 3);
    expect('jokainen tie salaiselle kaistalle kantaa kolikkovihjeen',
      hints.length === 8 && bare.length === 0,
      `${hints.length} sisäänkäyntiä, kolikoita ${hints.map((h) => h.coins.length).join('/')}`
      + (bare.length ? ` — vihjeettä: ${bare.map((h) => h.e.where).join(' ')}` : ''));

    /* 2. It pays on its own: the drop from every hint coin to the first thing
     * under it that holds, against the measured standing jump at power 0. A
     * coin with nothing under it at all is worse than a high one — it hangs
     * over a pit, and a coin you have to dare a pit for is not a free hint. */
    const standing = (jump.cases.find((c) => c.label === 'standing, held') || {}).height || 0;
    let worst = 0;
    const dangling = [];
    for (const h of hints) {
      for (const c of h.coins) {
        let sy = -1;
        for (let ty = c.ty + 1; ty < h.e.top + 15; ty++) {
          if (STANDABLE.has(h.sc.rawTileAt(c.tx, ty))) { sy = ty; break; }
        }
        if (sy < 0) { dangling.push(`${h.e.where} ${c.tx},${c.ty}`); continue; }
        worst = Math.max(worst, sy - c.ty);
      }
    }
    expect('vihjekolikot saa pienimmällä koolla ilman itse salaisuutta',
      dangling.length === 0 && worst * 16 <= standing,
      `korkeintaan ${worst} ruutua = ${worst * 16} px, paikaltaan hyppy nostaa ${standing} px`
      + (dangling.length ? ` — tyhjän päällä: ${dangling.join(' ')}` : ''));

    /* 3a. No coin touches the entrance tile. A coin on the thing is a marker on
     * the thing, whatever the rest of the run is doing. */
    let nearest = 99;
    for (const h of hints) {
      for (const c of h.coins) {
        const dx = Math.max(h.e.x0 - c.tx, c.tx - h.e.x1, 0);
        nearest = Math.min(nearest, Math.max(dx, Math.abs(c.ty - h.e.y)));
      }
    }
    expect('yksikään vihjekolikko ei kosketa sisäänkäyntiä',
      nearest >= 2, `lähin kolikko ${nearest} ruudun päässä`);

    /* 3b. And the run is not centred on it. Coins either side of a thing, evenly
     * spaced, is the oldest map marking there is. */
    const offCentre = hints.map((h) => {
      const xs = h.coins.map((c) => c.tx);
      const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
      return { where: h.e.where, off: Math.abs(mid - (h.e.x0 + h.e.x1) / 2) };
    });
    const centred = offCentre.filter((o) => o.off < 1);
    expect('vihjejono ei ole keskitetty sisäänkäynnin päälle',
      centred.length === 0,
      `poikkeama keskeltä ${offCentre.map((o) => o.off).join('/')} ruutua`
      + (centred.length ? ` — keskitetty: ${centred.map((o) => o.where).join(' ')}` : ''));

    /* 3c. The camouflage, counted over the whole game: a coin row that means
     * something has to be the exception, or following coin rows becomes an
     * oracle and the hint has turned into a sign. */
    const share = runsAtSecret / Math.max(1, runs);
    expect('kolikkorivi on tavallinen näky eikä salaisuuden merkki',
      runs >= 200 && share <= 0.1,
      `${runsAtSecret}/${runs} kolikkoriviä salaisuuden kohdalla = ${(share * 100).toFixed(1)} %`);

    /* 4. The twin. */
    const shapes = new Set(pipes.map((p) => p.offsets));
    const warps = pipes.filter((p) => p.warp).length;
    expect('kahden ruudun lattiaputket kantavat saman kolikkorivin, warppasi tai ei',
      pipes.length >= 6 && shapes.size === 1 && warps < pipes.length,
      `${pipes.length} putkea, ${warps} warppia, kolikkorivit [${[...shapes].join('] [')}]`);

    /*
     * 5. JA SAMA VÄITE MUODOSTA: lyhyt putki ei saa olla warpin synonyymi.
     *
     * Kohta 4 takaa että kaikki kahden ruudun lattiaputket *näyttävät*
     * samalta. Se ei takaa mitään siitä miten usein sellaisen alle menee
     * jotain — ja jos niitä on kuusi ja neljä on warppeja, "paina alas jokaisen
     * kolikoidun lyhyen putken päällä" osuu kahdesti kolmesta. Salaisuus jonka
     * arvaa kahdesti kolmesta ei ole salaisuus vaan rutiini, ja koko
     * kolikkovihjeen idea (kohta 3c) kaatuu sen mukana: vihje näyttäisi
     * vihjeeltä ja toimisi kylttinä.
     *
     * **Miksi kolmasosa.** Luku ei ole makuasia eikä sitä ole poimittu ilmasta,
     * vaan se on *sama kaista jonka peli jo asettaa toiselle tavalliselta
     * näyttävälle esineelle joka joskus onkin salaisuus*: piilotiili. Tuon
     * testin raja tässä samassa tiedostossa on `share < 0.35` — alle 35 % kaikista
     * tiilistä saa kätkeä jotain. Lyhyt lattiaputki on täsmälleen sama väite eri
     * esineestä, joten se saa saman katon, ja kolmasosa on lähin luku jonka
     * alle nykyiset neljä warppia mahtuvat: 4/12 = 33,3 %.
     *
     * Kolmasosa on myös se kohta jossa väite muuttuu laadullisesti. Puolikkaalla
     * "useimmat lyhyet putket ovat tavallisia" on totta yhden putken erolla ja
     * kääntyy takaisin heti kun joku lisää yhden warpin. Kolmasosalla pelaaja
     * joka painaa alas jokaisen lyhyen putken päällä on väärässä kaksi kertaa
     * useammin kuin oikeassa, ja uusi warp maksaa kolme uutta tavallista
     * putkea — mikä on juuri se hinta jonka sen kuuluu maksaa.
     *
     * Ei alarajaa. Tavallisia putkia ei voi olla liikaa: jokainen niistä on
     * ilmaisia kolikoita ja yksi vertailukohta lisää.
     */
    expect('lyhyt lattiaputki ei ole warpin synonyymi',
      warps * 3 <= pipes.length,
      `${warps}/${pipes.length} lattiaputkesta warppaa = ${(warps * 100 / pipes.length).toFixed(1)} %`
      + ` (katto 33,3 %, sama kuin piilotiilen 35 %)`);
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
    /* Every colour the player is ever painted in. It is a list and not a rule
     * because the outline has to be told from the artwork, and the day the
     * costume changed it was also the list that said what the costume was: the
     * greens and whites of the old shirt left it, the slate, the purples, the
     * gas green and the brass of POWER_LOOKS came in. A colour missing from
     * here does not fail loudly — the audit below simply stops seeing that part
     * of the body, and a sprite with an invisible middle counts as two pieces. */
    const ART = new Set([
      '16,16,24', '240,184,144', '192,120,80', '31,111,38',
      '140,76,24', '90,44,12', '200,140,64', '248,248,248', '92,156,40',
      '255,208,72', '156,106,40', '224,76,60', '200,200,208', '192,90,36',
      '140,60,28', '74,28,10', '42,74,106', '127,200,240',
      '232,248,255',
      // POWER_LOOKS, the gas hose and the leaves.
      '168,224,74', '160,76,160', '106,44,106', '60,24,64',
      '106,116,136', '57,65,79', '76,86,102', '232,255,192', '216,168,96',
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

  /* ------------------------ hahmon oma ulkonäkö ------------------------- */
  /*
   * Two measurements that stand for a decision rather than for a bug: the hero
   * is this game's own character and not the genre's most-copied costume. Both
   * are shape and colour, not naming, because a sprite cannot be checked by
   * asking it what it is called.
   *
   *  1. **The head is a head, not a peaked cap.** A brim is the one thing on a
   *     platform hero that is wider than the skull it sits on, and the old
   *     drawing made it exactly as wide as the whole character: 12 px of brim
   *     across a 14 px body, 10 across a 12 px one, with the crown only 9 and 8.
   *     The rule is therefore about *width*, not about colour — a red cap
   *     repainted green is still a cap. The head, measured on the rows just
   *     below the top of the box, has to be at least four pixels narrower than
   *     the body: room for a skull and hair, no room for a brim.
   *
   *     The top row of the box is left out of the measurement on purpose. That
   *     is where the kaasulehti's fronds sit, and they are a named exception in
   *     the audit above for the same reason they are one here: they are not the
   *     head, they are what the power-up put on it.
   *
   *  2. **The five power looks are five looks.** `POWER_LOOKS` used to change
   *     the cap and nothing else between "no power" and the first mushroom, so
   *     two of the five tiers were the same drawing with a hat repainted —
   *     about a quarter of the body. A tier a player cannot name at a glance is
   *     not a tier, and at 12x16 a quarter of the body is a detail. Measured as
   *     the share of the character's own pixels that actually change between
   *     every pair of tiers, at the smallest size and the largest, since those
   *     are the two that could disagree.
   *
   * Both numbers are reported so that a future palette can be argued with in
   * numbers: they are the floor, not the target.
   */
  {
    const sprites = await import('/src/gfx/sprites.js');
    const { PLAYER_SIZES, drawPlayer } = sprites;
    const W = 80; const H = 80; const OX = 26; const OY = 14;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const TYPES = [null, 'shroom', 'flower', 'leaf', 'pop'];
    /* Artwork is told apart from its own outline the same way the audit above
     * does it: the outline only ever reaches full alpha where all four offsets
     * stack, and there it lands on 16,16,23 — one blue short of C.ink. */
    const shot = (type, level) => {
      g.clearRect(0, 0, W, H);
      drawPlayer(g, OX, OY, {
        type, level, facing: 1, frame: 0, state: 'idle', running: false,
        ducking: false, theme: 'grass', tick: 0, idle: 0, wag: 0,
      });
      const d = g.getImageData(0, 0, W, H).data;
      const art = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const q = i * 4;
        if (d[q + 3] !== 255) continue;
        if (d[q] === 16 && d[q + 1] === 16 && d[q + 2] === 23) continue;
        art[i] = 1;
      }
      return { art, d };
    };

    const heads = [];
    for (const level of [0, 1]) {
      const box = PLAYER_SIZES[level];
      let widest = 0;
      for (const type of TYPES) {
        const { art } = shot(type, level);
        for (let row = 1; row <= 5; row++) {
          let lo = -1; let hi = -1;
          /* Only the box and the one pixel of shoulder it has always been
           * allowed on each side. Anything further out is not the head: the
           * kaasulehti's hose swings back eleven pixels and crosses these rows
           * on its way up, and it would otherwise be measured as a hat. What
           * leaves the box is the audit above's question, not this one's. */
          for (let x = Math.max(0, OX - 1); x <= OX + box.w; x++) {
            if (!art[(OY + row) * W + x]) continue;
            if (lo < 0) lo = x;
            hi = x;
          }
          if (hi >= 0) widest = Math.max(widest, hi - lo + 1);
        }
      }
      heads.push({ level, widest, allow: box.w - 4 });
    }
    expect('the hero has a head and not a peaked cap',
      heads.every((h) => h.widest <= h.allow),
      heads.map((h) => `taso ${h.level}: pää ${h.widest}px, laatikko `
        + `${PLAYER_SIZES[h.level].w}px, sallittu ${h.allow}px`).join(', '));

    /* Every pair of tiers, both ends of the size range. The denominator is the
     * character's own pixels rather than the canvas, so the number means "how
     * much of him changed" and does not quietly improve when he grows. */
    const shares = [];
    for (const level of [0, 5]) {
      const shots = TYPES.map((t) => shot(t, level));
      let worst = 100;
      let pair = '';
      for (let a = 0; a < TYPES.length; a++) {
        for (let b = a + 1; b < TYPES.length; b++) {
          let own = 0;
          let changed = 0;
          for (let i = 0; i < W * H; i++) {
            if (!shots[a].art[i] && !shots[b].art[i]) continue;
            own++;
            const q = i * 4;
            for (let k = 0; k < 3; k++) {
              if (shots[a].d[q + k] !== shots[b].d[q + k]) { changed++; break; }
            }
          }
          const share = Math.round((changed / own) * 100);
          if (share < worst) {
            worst = share;
            pair = `${TYPES[a] || 'none'}/${TYPES[b] || 'none'}`;
          }
        }
      }
      shares.push({ level, worst, pair });
    }
    expect('the five power looks are five looks and not one with a hat repainted',
      shares.every((s) => s.worst >= 45),
      shares.map((s) => `taso ${s.level}: lähimmät ${s.pair} ${s.worst}%`).join(', ')
      + ', vaadittu 45%');
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
      '122,76,24', '248,248,248', '16,16,24',
      '200,200,216', '60,52,80', '88,76,116', '42,36,56', '90,80,64',
      '232,224,200', '168,152,120', '216,168,96', '156,106,40',
      '138,90,42', '92,58,22',
      '60,32,50', '106,60,88', '74,44,24', '200,160,88', '255,208,72',
      '106,68,36',
      // kurnuttaja: suo-turkoosi, joka ei ole kenenkään muun väri tässä pelissä
      '30,90,76', '52,140,110', '108,200,160', '18,60,52',
      // pöhö: suolenvärinen kaasupussi, joka korvasi ruskean kävelijän
      '224,120,120', '248,168,168', '168,60,76', '112,28,48',
      // pönttö: teräksinen painesäiliö ja se kalpea toukka joka asuu siinä
      '32,80,192', '92,144,232', '16,48,108', '168,200,240',
      '216,224,240', '140,156,192',
      // nielu: märkä, lähes musta kurkku ja sen punainen sisus
      '24,16,48', '52,44,104', '104,88,176', '32,24,64', '120,16,60', '200,40,108',
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
    /*
     * `stomp` is the rule the entity actually enforces (`Enemy.stompable`), and
     * it is on this table rather than read out of the classes on purpose: the
     * point of the crown audit below is to compare the *picture* against the
     * rule, so the rule has to arrive from somewhere the picture cannot reach.
     * `pit` marks the one enemy the player never arrives above.
     */
    const subjects = [
      { n: 'walker', box: [0, 0, 16, 16], breathes: true, clock: 8, stomp: true, ...none,
        paint: (ox, t, f) => sprites.drawWalker(g, ox, OY, Math.floor(t / 8), f, false) },
      // A flattened walker is scenery for twenty-two frames and cannot hurt
      // anybody, so it is not held to the box it no longer fills.
      { n: 'flyer', box: [0, 0, 16, 16], stomp: true,
        over: { left: 4, right: 4 }, under: {},
        paint: (ox, t, f) => sprites.drawFlyer(g, ox, OY, t, f) },
      { n: 'shell walking', box: [1, 0, 14, 24], breathes: true, clock: 1, stomp: true,
        over: {}, under: { top: 1 },
        paint: (ox, t, f) => sprites.drawShell(g, ox, OY, t, f, 'walk') },
      { n: 'shell', box: [1, 0, 14, 14], stomp: true,
        over: { left: 1, right: 1 }, under: { top: 2 },
        paint: (ox, t, f) => sprites.drawShell(g, ox, OY, t, f, 'shell') },
      /* The kicked one. It was never in this audit, which is a gap and not a
       * decision: a shell that slides through a room is the one drawing in the
       * game the player is asked to read while it is moving fastest. */
      { n: 'shell sliding', box: [1, 0, 14, 14], stomp: true,
        over: { left: 1, right: 1 }, under: { top: 2 },
        paint: (ox, t, f) => sprites.drawShell(g, ox, OY, t, f, 'sliding') },
      { n: 'spikeguy', box: [0, 0, 16, 16], breathes: true, clock: 2, stomp: false,
        over: { top: 2 }, under: { left: 1, right: 1 },
        paint: (ox, t, f) => sprites.drawSpikeGuy(g, ox, OY, Math.floor(t / 2), f) },
      { n: 'plant', box: [0, 0, 16, 32], breathes: true, clock: 1, stomp: false,
        over: {}, under: { left: 1, right: 1 }, facings: [1],
        paint: (ox, t) => sprites.drawPlant(g, ox, OY, t) },
      { n: 'corkguy', box: [1, 0, 14, 16], breathes: true, clock: 1, stomp: true,
        over: {}, under: { top: 2, left: 1, right: 1 },
        paint: (ox, t, f) => sprites.drawCorkGuy(g, ox, OY, t, f) },
      { n: 'stink cloud', box: [0, 0, 20, 14], stomp: true,
        over: {}, under: { top: 1, bottom: 1, left: 1, right: 1 },
        paint: (ox, t, f) => sprites.drawStinkCloud(g, ox, OY, t, f, true) },
      { n: 'bean baron', box: [0, 0, 18, 26], stomp: true, ...none,
        paint: (ox, t, f) => sprites.drawBeanBaron(g, ox, OY, Math.floor(t / 7), f, 0, false) },
      /* Kurnuttaja. Silmät ovat laatikon katto ja jalat sen lattia, ja hengitys
       * liikkuu niiden välissä — sama rakenne kuin kävelijällä, ja samasta
       * syystä: se on ainoa tapa täyttää laatikko jokaisella framella. */
      { n: 'kurnuttaja', box: [0, 0, 16, 16], breathes: true, clock: 8,
        stomp: false, pit: true, ...none,
        paint: (ox, t, f) => sprites.drawKurnuttaja(g, ox, OY, t, f) },
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

    /* ------------- ylälaita kertoo saako päälle hypätä ------------------- */
    /*
     * Stomping is the one verb this game teaches in its first screen, and the
     * whole verb rests on a yes/no the player has to read *before* the jump, at
     * a distance, in a fraction of a second. There is exactly one place in a
     * sprite where that answer can live: the top edge, because that is the part
     * a falling player is aimed at.
     *
     * So the claim is not "the art looks different". It is that **the top edges
     * of the two populations do not overlap** — that no enemy you must walk
     * around offers a wider flat landing than the narrowest one you are meant to
     * jump on, with a band of at least four pixels between them where nothing
     * lives. That is a number, it is measured off the finished pixels, and it
     * cannot be satisfied by choosing a nicer colour: colour has to be learned
     * first, and a row of points does not (the same argument `drawSpines`
     * already makes for the piikkiukko, now enforced instead of asserted).
     *
     * **What the red said, and it is worth reading twice.** Measured on the old
     * art, the widest flat landing surface in the entire enemy roster belonged
     * to the *plant* — 14 px of unbroken flat crown out of a 16 px box, wider
     * than the walker's 10, tied with the shell that you are supposed to jump
     * on — and the plant is the one enemy in the game that has never been
     * stompable. The picture said "land here" in the largest type available and
     * the rule said "this costs you a power level". The other unstompable, the
     * piikkiukko, measured 1. So the populations were not merely close, they
     * were inverted, and the game taught a lie in 1-2 to every player who had
     * just been taught the truth in 1-1.
     *
     * `landing` is the widest run of columns whose topmost painted pixel is
     * within one pixel of the sprite's own highest, over the box's columns only
     * — a wing hanging off the side is not somewhere you can land. `points` is
     * how many separate such runs there are, which is what tells a row of teeth
     * apart from a plateau with a notch in it.
     */
    const crown = (paint, box) => {
      const [dx, , bw] = box;
      g.clearRect(0, 0, W, H);
      paint();
      const d = g.getImageData(0, 0, W, H).data;
      const top = new Int32Array(bw).fill(1e9);
      for (let y = 0; y < H; y++) {
        for (let i = 0; i < bw; i++) {
          const q = ((y * W) + OX + dx + i) * 4;
          if (d[q + 3] !== 255) continue;
          if (!ART.has(`${d[q]},${d[q + 1]},${d[q + 2]}`)) continue;
          if (y < top[i]) top[i] = y;
        }
      }
      let min = 1e9;
      for (const v of top) if (v < min) min = v;
      let landing = 0; let run = 0; let points = 0; let was = false;
      for (let i = 0; i < bw; i++) {
        const hi = top[i] <= min + 1;
        if (hi) { run++; if (!was) points++; if (run > landing) landing = run; } else { run = 0; }
        was = hi;
      }
      return { landing, points };
    };
    {
      const read = [];
      for (const s of subjects) {
        if (s.stomp === undefined) continue;
        let landing = 1e9; let points = 1e9;
        for (const facing of (s.facings || [1, -1])) {
          for (let t = 0; t < 176; t += 2) {
            const m = crown(() => s.paint(OX, t, facing), s.box);
            landing = Math.min(landing, m.landing);
            points = Math.min(points, m.points);
          }
        }
        read.push({ ...s, landing, points });
      }
      /* The kurnuttaja is the one exemption and it is named rather than
       * tolerated. It is not stompable either, but it spends its life at the
       * bottom of a pit: the player never arrives above it by choice, and the
       * warning it owes is the column of bubbles `drawCroak` puts in the air
       * over the hole — a signal in a place, not a shape on a crown. Its own
       * number is printed anyway, because an exemption nobody can see the size
       * of is just a hole in a test. Measured 6, which is inside the band this
       * assertion keeps empty, and somebody may yet decide to narrow its eye
       * turrets. */
      const land = read.filter((s) => !s.pit);
      const yes = land.filter((s) => s.stomp);
      const no = land.filter((s) => !s.stomp);
      const softest = yes.reduce((m, s) => (s.landing < m.landing ? s : m), yes[0]);
      const flattest = no.reduce((m, s) => (s.landing > m.landing ? s : m), no[0]);
      const blunt = no.filter((s) => s.points < 3);
      const pit = read.find((s) => s.pit);
      expect('vihollisen ylälaita kertoo saako sen päälle hypätä',
        softest.landing >= flattest.landing + 4 && blunt.length === 0,
        `tallattavista kapein ${softest.n} ${softest.landing} px, `
        + `tallaamattomista levein ${flattest.n} ${flattest.landing} px`
        + (blunt.length ? ` — piikittömät: ${blunt.map((s) => `${s.n} ${s.points}`).join(', ')}` : '')
        + `; kaikki: ${read.map((s) => `${s.n} ${s.landing}/${s.points}`).join(', ')}`
        + (pit ? ` (${pit.n} kuopan pohjalla, ei portissa)` : ''));
    }

    /* ------------ vihollinen erottuu siitä maasta jolla se seisoo -------- */
    /*
     * The tiles have had a per-theme contrast gate for a while and the enemies
     * have not, which is the wrong way round: a brick that melts into the
     * ground costs you a secret, an enemy that melts into the ground costs you
     * a power level. Eight themes and one sprite each means eight chances for
     * a species to disappear, and the one that disappears will be the one on
     * the world nobody replayed.
     *
     * Same measure as the tile gate, deliberately — mean channel difference out
     * of a full 255, crude but unbreakable, and worth more as *the same number*
     * than as a better one nobody can compare against anything. Two differences,
     * both forced by what is being measured:
     *
     *   - The outline is left out (`16,16,24`). Every sprite in the game wears
     *     the same one, so it can only ever hide the thing being asked about,
     *     which is whether the *body* has a colour of its own.
     *   - The threshold is not typed in. It is the desert's own ground/brick
     *     gap, computed here from the same tiles — the weakest pair the game
     *     already ships and knowingly tolerates. "At least as separate as the
     *     worst pair we already live with" is a claim that stays true when the
     *     palette moves, which a hard-coded 8.6 would not.
     *
     * **What the red said.** The walker — the first enemy in the game, in 1-1,
     * standing on grass — measured 6.0 % against grass and 5.7 % against the
     * night ground of world 2, both under the 8.6 % floor. The plant measured
     * 6.9 % against grass. Brown on brown, and it had been that way since the
     * first sprite was written.
     *
     * Gated on the three species this pass redrew, and **measured on all of
     * them**: the rest of the roster is printed with its worst theme so the
     * ones still under the line are a decision somebody makes with a number in
     * front of them rather than a thing this test quietly blesses.
     */
    {
      const { THEMES, T, drawTile } = await import('/src/gfx/tiles.js');
      const bodyMean = (paint) => {
        g.clearRect(0, 0, W, H);
        paint();
        const d = g.getImageData(0, 0, W, H).data;
        let r = 0; let gg = 0; let b = 0; let n = 0;
        for (let i = 0; i < W * H; i++) {
          const q = i * 4;
          if (d[q + 3] !== 255) continue;
          const key = `${d[q]},${d[q + 1]},${d[q + 2]}`;
          if (!ART.has(key) || key === '16,16,24') continue;
          r += d[q]; gg += d[q + 1]; b += d[q + 2]; n++;
        }
        return n ? [r / n, gg / n, b / n] : null;
      };
      const tileMean = (ch, theme) => {
        g.clearRect(0, 0, W, H);
        drawTile(g, ch, 0, 0, theme, 3, 5, 0, ' ', {});
        const d = g.getImageData(0, 0, 16, 16).data;
        let r = 0; let gg = 0; let b = 0; let n = 0;
        for (let q = 0; q < d.length; q += 4) {
          if (d[q + 3] < 8) continue;
          r += d[q]; gg += d[q + 1]; b += d[q + 2]; n++;
        }
        return n ? [r / n, gg / n, b / n] : null;
      };
      const sep = (a, b) => (!a || !b ? 0
        : ((Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3 / 255) * 100);
      const floor = sep(tileMean(T.GROUND, 'desert'), tileMean(T.BRICK, 'desert'));
      const grounds = Object.keys(THEMES).map((th) => [th, tileMean(T.GROUND, th)]);
      /* The three species this pass redrew. The flyer is on the list because
       * it *is* the walker — `drawFlyer` paints `walkerBody` and adds wings —
       * so leaving it out would be pretending a body is two bodies. */
      const owned = new Set(['walker', 'flyer', 'shell walking', 'shell', 'shell sliding', 'plant']);
      const rows = [];
      for (const s of subjects) {
        const m = bodyMean(() => s.paint(OX, 0, 1));
        let worst = { th: '?', v: 1e9 };
        for (const [th, ground] of grounds) {
          const v = sep(m, ground);
          if (v < worst.v) worst = { th, v };
        }
        rows.push({ n: s.n, owned: owned.has(s.n), ...worst });
      }
      const mine = rows.filter((r) => r.owned);
      const rest = rows.filter((r) => !r.owned);
      const sunk = mine.filter((r) => r.v < floor);
      expect('uudelleenpiirretty vihollinen erottuu jokaisen teeman maasta',
        sunk.length === 0,
        `kynnys ${floor.toFixed(1)} % = aavikon maa vs tiili; `
        + `${mine.map((r) => `${r.n} ${r.v.toFixed(1)} (${r.th})`).join(', ')}`
        + ` — mittaamatta portissa: ${rest.map((r) => `${r.n} ${r.v.toFixed(1)} (${r.th})`).join(', ')}`);
    }
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
      /* No beanstalk is in the grid until its block has been hit, so a test
       * about climbing one has to plant it first. The entities are stepped on
       * their own rather than through `scene.update`, so nothing else in the
       * level — enemies, the clock, the player falling off something — moves
       * while this is only trying to make a vine exist. */
      for (const key of [...sc.beanstalks.keys()]) {
        const [bx, by] = key.split(',').map(Number);
        sc.bumpTile(bx, by, sc.player);
      }
      for (let f = 0; f < 400; f++) {
        const growing = sc.entities.filter((e) => e.kind === 'prop');
        if (!growing.length) break;
        for (const e of growing) e.update();
        sc.entities = sc.entities.filter((e) => !e.remove);
      }
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
        let counted = false;
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
          /* Whether the view had finished its last move before this take-off.
           * See the assertion below for why an unfinished one has to be left
           * out of the *rise* number and stays in the *ground* number. */
          const settled = Math.abs(s.cam.y - s.cameraY()) < 0.5;
          s.update(input);
          const p = s.player;
          if (p.dying) break;
          if (wasGround && !p.onGround) { takeoff = p.y + p.h; counted = settled; }
          if (!p.onGround && takeoff !== null) {
            air++;
            if (takeoff < s.cam.y + s.viewH) seen++;
            // How far the view climbed on a single airborne frame.
            if (counted) rise = Math.max(rise, camBefore - s.cam.y);
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
       * ride the arc. A jump lifts the body ~5 px on its fastest frame.
       *
       * The 2-1 power-3 row reads 0.27 rather than 0.00 since `CAM_TOP_LEAD`,
       * and that is the anticipation zone rather than a regression: that jump
       * tops out 16.4 px from the top of the letterbox band, 0.4 px short of
       * forcing the old hard clamp, so it was always going to move the view —
       * it now moves it 0.93 px over the whole 85 px arc instead of stepping.
       * The power-0 row has 20.4 px of headroom and stays at 0.00.
       *
       * **Only jumps that start from a settled view count**, which is the same
       * filter its sibling below has had since `CAM_TOP_LEAD` and for the same
       * reason: landing moves the anchor and the view then glides up to it at
       * `CAM_V_EASE`, so a jump taken while that glide is still running carries
       * the glide into the air with it and the number stops being about the
       * arc. It only started mattering here when the letterboxed levels stopped
       * cutting their big landings — a cut was over inside one frame and could
       * never overlap the next take-off, so this filter was free before and is
       * load-bearing now. Unfiltered the bot reads 2.65 px in 2-1, and every
       * pixel of it is the previous landing finishing.
       *
       * The *ground* number deliberately keeps every frame: the take-off tile
       * must stay on screen through jumps taken mid-glide as well, and that is
       * a promise about the picture rather than about which mechanism moved it. */
      expect('the view does not ride a jump upward',
        rows.every((r) => r.rise < 2),
        rows.map((r) => `${r.id} ${r.rise.toFixed(2)} px/frame`).join(', '));
    }

    /*
     * Red before green (DESIGN.md §7) for the owner's second camera report:
     * "now it's better that it doesn't move when we jump, but then when the
     * character is actually high enough for the camera to move, it moves
     * suddenly. It just snaps higher instead of animating."
     *
     * The hold and the downward follow were both right and both stay; what was
     * wrong was the moment the hold ends. `CAM_TOP_MARGIN` was a hard clamp
     * applied after the ease, so the frame the head crossed it the view was
     * pinned to `p.y - 16` and tracked it exactly — nought to the body's own
     * rise speed between two frames.
     *
     * **A snap is a big number on one frame; an animation is a small number on
     * many.** So the measurement is the largest single-frame upward move of the
     * view over a run of jumps. Before `CAM_TOP_LEAD`: **2.92 px**, on a frame
     * where the body lifted 2.93 — the view matching the body's speed from a
     * standstill. After: **1.95 px**, and reached over several frames.
     *
     * Two things about the fixture, both of which decide what is being
     * measured:
     *
     *   - **only jumps that start from a settled view count.** Landing on a
     *     ledge moves the anchor, and the view then glides up to it at
     *     `CAM_V_EASE` — 8.7 px on its first frame, by design, because that is
     *     the *downward* follow working. Jumping again mid-glide and blaming
     *     the number on the top margin measures the wrong thing entirely; it
     *     was 6.70 px before the filter and had nothing to do with the report.
     *   - **fart jumps**, because nothing else reaches the zone. A running
     *     jump rises 85 px and tops out with the head still 16 px clear of the
     *     frame even in a letterboxed level, so it never asks the camera for
     *     anything — which is why the two power-0 and running-jump rows below
     *     are 0.00 px and must stay 0.00 px.
     */
    {
      const rows = [];
      for (const [id, power] of [['2-3', { type: 'leaf', level: 5 }],
        ['2-1', { type: 'leaf', level: 5 }], ['2-1', { type: 'leaf', level: 3 }],
        ['1-1', { type: 'leaf', level: 5 }], ['2-1', { type: null, level: 0 }],
        ['2-1', { type: 'shroom', level: 3 }]]) {
        reset(power);
        const s = new LevelScene(game, id);
        s.entities = s.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
        s.time = 9999;
        const input = mkInput();
        let rise = 0;
        let air = 0;
        let seen = 0;
        let head = Infinity;
        let takeoff = null;
        let counted = false;
        for (let f = 0; f < 1800; f++) {
          input.held = blank();
          input.pressed = blank();
          input.held.right = true;
          input.held.run = true;
          const phase = f % 60;
          if (phase === 40 && s.player.onGround) { input.pressed.jump = true; input.held.jump = true; }
          else if (phase > 40 && phase < 74) input.held.jump = true;
          // The second press, in mid-air: the fart jump.
          if (phase === 48) { input.pressed.jump = true; input.held.jump = true; }
          const wasGround = s.player.onGround;
          const camBefore = s.cam.y;
          const settled = Math.abs(s.cam.y - s.cameraY()) < 0.5;
          s.update(input);
          const p = s.player;
          if (p.dying) break;
          if (wasGround && !p.onGround) { takeoff = p.y + p.h; counted = settled; }
          if (!p.onGround && takeoff !== null && counted) {
            air++;
            if (takeoff < s.cam.y + s.viewH) seen++;
            rise = Math.max(rise, camBefore - s.cam.y);
            head = Math.min(head, p.y - s.cam.y);
          }
          if (p.onGround) takeoff = null;
        }
        rows.push({ id, level: power.level, air, seen, rise, head });
      }
      /* 2.5 and not 2.92: the ceiling is under the number the snap produced and
       * over the number the ease produces, so it is the snap that cannot come
       * back rather than the whole mechanism being frozen. */
      expect('a view that has to rise animates instead of snapping',
        rows.every((r) => r.air > 200 && r.rise < 2.5),
        rows.map((r) => `${r.id} taso ${r.level}: ${r.rise.toFixed(2)} px/frame`).join(', '));
      /* And the warning must buy the smoothness out of itself, not out of the
       * two things that were already right: the head still may not touch the
       * top of the frame — nor even reach the margin, which is how you can tell
       * the clamp is no longer the thing doing the work — and the ground under
       * a jump still may not leave the bottom of it. */
      expect('anticipating the rise costs neither the headroom nor the ground',
        rows.every((r) => r.head > 16 && r.seen === r.air),
        rows.map((r) => `${r.id}: pää ${r.head.toFixed(2)} px, maa ${r.seen}/${r.air}`).join(', '));
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

    /*
     * Red before green (DESIGN.md §7) for the owner's third camera report:
     * "vertical camera movement when falling down from a platform that is
     * above the ground is still janky". The rise was fixed by anticipating
     * (CAM_TOP_LEAD); this is the same axis falling, and it was still wrong.
     *
     * **The complaint stated as a number: how long does the camera keep moving
     * after the player has stopped?** Feet stop dead on contact. An exponential
     * ease chasing a target that moves at v settles a constant (1-e)/e = 3v
     * behind it, so at TERMINAL the view was 12 px in debt at the moment of
     * touchdown and paid it off afterwards, gliding on while the body it was
     * following stood still. That is inertia, and the comment on `updateCamera`
     * says in as many words that inertia is what makes a platformer seasick —
     * the horizontal axis goes to real lengths to avoid it and the vertical
     * axis had it.
     *
     * Measured before, walking or jumping off a real ledge in a real level:
     * 6.97 px over 10 frames (4-1), 4.30 px over 9 (2-3), 4.12 px over 9 (2-1).
     * The ordinary 15-row levels hid it — 0.71 px over 2 frames in 1-1 — not
     * because the camera was well behaved but because those levels only have
     * 32 px of vertical travel and the level's own limit paid the debt off
     * mid-fall. It is the letterboxed and banded levels, where the camera has
     * room, that show what the mechanism actually does.
     *
     * The fixture is a real ledge and not a teleport: the deepest edge in the
     * level with four to eight tiles of air and a floor under it, walked off
     * and jumped off. Both, because they are different: walking off starts the
     * camera and the body from rest together, while jumping off means the body
     * is already at TERMINAL by the time it passes the line it left.
     *
     * `CAM_SNAP` was measured too and it is **not** part of this: over every
     * fall here the biggest gap between the view and where it wants to be is
     * 14.5 px against a threshold of 48, so no real fall has ever reached the
     * cut. (Landing *on* a raised platform does — see the note in level.js.)
     */
    {
      /** The deepest walk-off edge in the level with a floor under it. */
      const ledge = (s, minDrop, maxDrop) => {
        let best = null;
        for (let tx = 4; tx < s.w - 8; tx++) {
          for (let ty = 2; ty < s.h - 3; ty++) {
            if (!s.solidAt(tx, ty)) continue;
            if (s.solidAt(tx, ty - 1) || s.solidAt(tx, ty - 2) || s.solidAt(tx, ty - 3)) continue;
            if (s.solidAt(tx + 1, ty) || s.solidAt(tx + 1, ty - 1)) continue;
            let d = 1;
            while (ty + d < s.h && !s.solidAt(tx + 1, ty + d) && !s.solidAt(tx + 2, ty + d)) d++;
            if (ty + d >= s.h || d < minDrop || d > maxDrop) continue;
            if (!best || d > best.drop) best = { tx, ty, drop: d };
          }
        }
        return best;
      };

      const fall = (id, mode) => {
        reset();
        const s = new LevelScene(game, id);
        s.entities = s.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
        s.time = 9999;
        const spot = ledge(s, 4, 8);
        if (!spot) return null;
        const p = s.player;
        p.x = spot.tx * TILE + 2;
        p.y = spot.ty * TILE - p.h;
        p.vx = 0;
        p.vy = 0;
        p.onGround = true;
        s.centerCamera();
        const input = mkInput();
        for (let f = 0; f < 40; f++) s.update(input);   // let the view settle
        let left = -1;
        let landed = -1;
        let after = 0;
        let tail = 0;
        let rise = 0;
        let below = Infinity;
        let pounded = false;
        for (let f = 0; f < 240; f++) {
          input.held = blank();
          input.pressed = blank();
          input.held.right = true;
          if (mode === 'jump' && f === 0) input.pressed.jump = true;
          if (mode === 'jump' && f < 14) input.held.jump = true;
          if (mode === 'pound' && left >= 0 && !p.onGround && !pounded && f > left + 2) {
            input.held.down = true;
            input.pressed.jump = true;
            input.held.jump = true;
            pounded = true;
          } else if (mode === 'pound' && pounded && !p.onGround) input.held.down = true;
          const wasGround = p.onGround;
          const camBefore = s.cam.y;
          s.update(input);
          const d = s.cam.y - camBefore;
          if (left < 0 && wasGround && !p.onGround) left = f;
          if (left >= 0) {
            rise = Math.max(rise, -d);
            below = Math.min(below, s.cam.y + s.viewH - (p.y + p.h));
          }
          if (left >= 0 && landed < 0 && p.onGround) landed = f;
          if (landed >= 0 && f > landed) {
            if (Math.abs(d) > 0.1) after = f - landed;
            tail += Math.abs(d);
          }
          if (landed >= 0 && f > landed + 45) break;
        }
        return {
          id, mode, drop: spot.drop, after, tail, rise, below, landed,
          pounded: mode !== 'pound' || pounded,
        };
      };

      const ids = ['1-1', '2-1', '2-3', '4-1', '5-1', '1-2'];
      const rows = [];
      for (const mode of ['walk', 'jump']) for (const id of ids) {
        const r = fall(id, mode);
        if (r) rows.push(r);
      }
      const say = (r) => `${r.id} ${r.mode} ${r.tail.toFixed(2)} px / ${r.after} framea`;

      /* 3.5 px is the ceiling for the same reason 2.5 is the ceiling on the
       * rising side: it is under the 6.97 px the debt produced and over the
       * 2.94 px the anticipation leaves, so it is the inertia that cannot come
       * back rather than the whole mechanism being frozen. */
      expect('a view that has fallen stops when the player stops',
        rows.length >= 10 && rows.every((r) => r.tail < 3.5 && r.after <= 8),
        rows.map(say).join(', '));

      /* And the anticipation must be bought out of itself, not out of the two
       * things that were already right: the view still may not creep upward
       * during a fall, and what you are falling towards still may not leave
       * the bottom of the window. */
      expect('anticipating the fall costs neither the ground below nor the hold',
        rows.every((r) => r.rise < 0.01 && r.below > 24),
        rows.map((r) => `${r.id} ${r.mode} ylös ${r.rise.toFixed(2)} px, `
          + `alla ${r.below.toFixed(0)} px`).join(', '));

      /*
       * The ground pound gets its own line and its own number, and the number
       * is bigger on purpose. The dive is 7.5 px/frame — 1.9x TERMINAL — and
       * it starts from a dead hang, so its own lag is 22.5 px rather than 12.
       * The lead may only grow as fast as gravity could grow it, which is what
       * stops the dive's standing start from jerking the view (that costs the
       * dive most of its lead), so this improves rather than disappears:
       * 11.51 px over 12 frames before, 8.47 over 11 after, worst case 2-3.
       */
      const pounds = [];
      for (const id of ids) {
        const r = fall(id, 'pound');
        if (r) pounds.push(r);
      }
      expect('a ground pound is not followed down by the view it landed under',
        pounds.length >= 5 && pounds.every((r) => r.pounded && r.tail < 9.5),
        pounds.map(say).join(', '));
    }

    /*
     * Red before green (DESIGN.md §7) for the fourth camera report, which is
     * the one the previous fix measured and deliberately did not fix blind:
     * **jumping onto a raised platform cuts.**
     *
     * The two fixes above are the falling axis and the top-of-frame axis. This
     * is the third and it is the one nobody complained about, because it does
     * not look like a camera bug — it looks like the level jumping. Landing is
     * `onGround` on the frame the feet touch, so the anchor moves the whole
     * height of the platform in one frame and `CAM_V_EASE` glides the view up
     * to it. That is by design and it is what every ordinary level does: the
     * biggest landing in a 208-row level moves the view 32 px and its first
     * frame is 8 px. In the two letterboxed levels the same landing is bigger
     * than the old `CAM_SNAP` threshold and was cut instead of glided.
     *
     * **A cut is the whole distance on one frame; a glide is a decaying series
     * over many.** So the measurement is the same one the rising fix used: the
     * largest single-frame upward move of the view over a real jump onto a real
     * platform, driven with the pad rather than teleported, because a teleport
     * would prove a step the player cannot actually take.
     *
     * The fixture picks, per level, the platform whose landing moves the view
     * furthest — in 2-1 and 2-3 alike that is a four-tile top at row 9 over the
     * desert floor at row 13, which frames at 30 against the floor's 80, so the
     * step is 50 px of the level's 80 px of travel.
     */
    {
      /**
       * The landing in this level that moves the view furthest, jumped for real.
       *
       * Candidates are ranked by how far the framing would move — `cameraY()`
       * asked twice, once with the feet on the lower floor and once with them
       * on the platform — rather than by how tall the platform is, because the
       * level's own clamp is what decides whether a tall step is a big move or
       * no move at all. Then the best few are jumped at with the pad, and the
       * first one the player genuinely lands on is the answer.
       */
      const climb = (id, power) => {
        reset(power);
        const probe = new LevelScene(game, id);
        const frameAt = (feet) => {
          probe.player.y = feet - probe.player.h;
          probe.player.onGround = true;
          probe.camAnchor = feet;
          return probe.cameraY();
        };
        const tops = [];
        for (let tx = 3; tx < probe.w - 3; tx++) {
          for (let ty = 3; ty < probe.h - 2; ty++) {
            if (!probe.solidAt(tx, ty) || probe.solidAt(tx, ty - 1)) continue;
            if (!probe.solidAt(tx + 1, ty)) continue;
            let fy = ty + 1;
            while (fy < probe.h && !probe.solidAt(tx - 2, fy)) fy++;
            /* Two to four tiles of step. Below two there is nothing to measure;
             * above four the jump does not reach the top and the run would be
             * measuring a landing that never happened — the measured budget is
             * 100 px of rise, and clearing a rim needs more than just reaching
             * its height. */
            if (fy >= probe.h || fy - ty < 2 || fy - ty > 4) continue;
            tops.push({ tx, ty, fy, move: frameAt(fy * TILE) - frameAt(ty * TILE) });
          }
        }
        tops.sort((a, b) => b.move - a.move);
        /* Several run-ups, because how much room a jump needs depends on the
         * platform and not on this fixture's opinion: four tiles clears the
         * four-tile step in 2-1 and lands short of the same step in 2-3. */
        for (const spot of tops.slice(0, 10)) for (const runUp of [4, 6, 8, 3]) {
          reset(power);
          const s = new LevelScene(game, id);
          s.entities = s.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
          s.time = 9999;
          const p = s.player;
          p.x = (spot.tx - runUp) * TILE;
          p.y = spot.fy * TILE - p.h;
          p.vx = 0;
          p.vy = 0;
          p.onGround = true;
          s.centerCamera();
          const input = mkInput();
          for (let f = 0; f < 40; f++) s.update(input);   // let the view settle
          let jumped = false;
          let step = 0;
          let settle = 0;
          let landed = -1;
          let onTop = false;
          for (let f = 0; f < 140; f++) {
            input.held = blank();
            input.pressed = blank();
            /* The pad is dropped the moment the feet touch. The complaint is
             * about the settling and not about what happens next, and a player
             * who keeps running off the far side would fold a second landing
             * into the number. */
            if (landed < 0) {
              input.held.right = true;
              input.held.run = true;
              if (p.onGround && !jumped) {
                input.pressed.jump = true;
                input.held.jump = true;
                jumped = true;
              } else if (jumped && p.vy < 0) input.held.jump = true;
            }
            const wasAir = !p.onGround;
            const camBefore = s.cam.y;
            s.update(input);
            const d = camBefore - s.cam.y;
            if (landed < 0 && jumped && wasAir && p.onGround) {
              landed = f;
              onTop = p.y + p.h <= spot.ty * TILE + 1;
              if (!onTop) break;                              // landed short
              /* Stopped dead on touchdown. The complaint is vertical, and a
               * body that slides on and off the far rim would fold a second
               * landing and a fall into a number that is meant to be about
               * one rise. */
              p.vx = 0;
            }
            if (landed >= 0) {
              step = Math.max(step, d);
              // How long the view took to arrive: a cut arrives on the frame it
              // happens, an animation does not.
              if (!settle && Math.abs(s.cam.y - s.cameraY()) <= 1) settle = f - landed + 1;
            }
            if (p.dying) break;
            if (landed >= 0 && (settle || f > landed + 40)) break;
          }
          if (onTop) return { id, level: power.level, top: spot.ty, step, settle };
        }
        return null;
      };

      const rows = [];
      for (const [id, power] of [['2-1', { type: null, level: 0 }],
        ['2-1', { type: 'leaf', level: 3 }], ['2-3', { type: null, level: 0 }],
        ['2-3', { type: 'leaf', level: 3 }], ['1-1', { type: null, level: 0 }],
        ['4-1', { type: null, level: 0 }]]) {
        const r = climb(id, power);
        if (r) rows.push(r);
      }
      /* 13 px is the ceiling for the same reason 2.5 and 3.5 are the ceilings
       * on the other two axes: it is far under the 50 px the cut produced and
       * just over the 12.5 px the ease produces on its first frame, so it is
       * the cut that cannot come back rather than the mechanism being frozen.
       * 12.5 is `CAM_V_EASE` × 50 and nothing else, which is exactly what an
       * ordinary level's 32 px landing already does at 8 px. */
      expect('a view that has to rise on landing animates instead of cutting',
        rows.length >= 5 && rows.every((r) => r.step < 13 && r.settle > 4),
        rows.map((r) => `${r.id} taso ${r.level}: ${r.step.toFixed(2)} px/frame, `
          + `asettui ${r.settle || '>40'} framessa`).join(', '));
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
    let note = '';
    if (tap && tap.ctx.state === 'running') {
      Music.stop();
      /* Punainen ennen vihreää, ja satunnaiselle vialle se tarkoittaa että
       * vika pitää **tuottaa tahallaan**. Kaatuneissa ajoissa tausta oli 0,379
       * … 3,029 — se ei ole yhden äänen häntä vaan muutama päällekkäinen ääni,
       * eli suite itse jätti väylän soimaan. Neljä ääntä yhtä aikaa tekee
       * saman joka ajolla ja pysyy siinä suuruusluokassa jonka oikeat
       * kaatumiset näyttivät; kymmenen ääntä olisi tuottanut leikkaavan
       * 19,450:n eli vian jota suite ei koskaan tuota itse. */
      for (const s of ['sprout', 'bigfart', 'burst', 'flight']) Sfx.play(s);
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
      /* Odota hiljaisuutta, älä kelloa.
       *
       * Tässä oli kiinteä 900 ms odotus ja perustelu "suite on soittanut ääniä
       * minuutin ajan, annetaan väylän rauhoittua". Perustelu oli oikea, luku
       * ei: 900 ms on arvaus siitä miten pitkä häntä edellisellä äänellä
       * sattuu olemaan, ja arvaus meni pieleen noin joka toinen ajo. Mitattuna
       * tausta oli milloin 0,000 ja milloin 3,029 — eli testi ei mitannut
       * pohjakohinaa vaan sitä ehtiikö edellinen ääni loppua. Portti joka
       * kaatuu satunnaisesti ei ole portti vaan kolikonheitto, ja se on
       * pahempi kuin puuttuva testi: se opettaa ohittamaan punaisen.
       *
       * Nyt väylää kuunnellaan kunnes se on oikeasti hiljaa, ja **samalla
       * ikkunalla jolla lopputulos mitataan**. Ensimmäinen yritys tarkkaili
       * hiljaisuutta 60 ms:n ikkunalla ja mittasi sitten 200 ms:llä, mikä
       * kaatui omaan mittaansa: ääni jossa on tauko näyttää 60 ms:n ikkunassa
       * hiljaiselta ja jatkuu heti perään. Mitattu tulos oli "hiljeni 182 ms,
       * tausta 19,450" — eli portti julisti hiljaisuuden keskellä ryminää.
       * Yksi ikkuna, se jonka väite koskee, ei voi valehdella noin.
       *
       * **Kaksi peräkkäistä hiljaista ikkunaa, ei yhtä**, ja siihen on
       * konkreettinen syy: `sprout` on ajastettu ääni jonka sisällä on tauko
       * (kopsahdus, hiljaisuus, sitten nouseva kahina). Yhden ikkunan sääntö
       * osui siihen taukoon — tausta 0,000 ja heti perään ääni 4,250, eli
       * mittaus luuli mittaavansa yhtä puhuttua riviä ja mittasi kahinaa sen
       * päällä. Neljäsataa millisekuntia yhtäjaksoista hiljaisuutta on
       * pidempi kuin yksikään pelin äänen sisäinen tauko.
       *
       * Jos väylä ei rauhoitu kuudessa sekunnissa, sekin on tulos eikä
       * oletus: silmukka päättyy, `tausta` jää suureksi ja rivi kaatuu
       * kertoen syyn. */
      const QUIET = 0.02;
      const t0 = performance.now();
      let calm = 0;
      while (calm < 2 && performance.now() - t0 < 6000) {
        floorNoise = await peakFor(200);
        calm = floorNoise > QUIET ? 0 : calm + 1;
      }
      const waited = Math.round(performance.now() - t0);
      Sfx.play('yeah');
      voice = await peakFor(420);
      an.disconnect();
      note = ` (hiljeni ${waited} ms)`;
    }
    const measured = tap && tap.ctx.state === 'running';
    expect('a spoken line is loud enough to hear',
      !measured || (floorNoise < 0.1 && voice > 0.25),
      measured ? `ääni ${voice.toFixed(3)}, tausta ${floorNoise.toFixed(3)}${note}` : 'ei mitattu');
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

  /*
   * DANSE MACABRE, ELI SE ETTÄ VALSSI ON DATASSA EIKÄ KOMMENTISSA.
   *
   * Luumaailman raita on Saint-Saëns'n *Danse macabre* (1874, vapautunut
   * 1.1.1992), ja DESIGN.md kohta 1 b sanoo millä ehdoilla: sävelet käsin
   * `TRACKS`-tauluun, ei äänitettä eikä nuottilaitosta, ja lähde nimetään.
   * Nimeäminen tarkistetaan ajon lopussa tiedostoista; tässä tarkistetaan se
   * mikä on tarkistettavissa itse datasta.
   *
   * Kaksi väitettä, ja molemmat ovat sellaisia jotka voi rikkoa vahingossa
   * yhdellä nuotilla eikä kumpikaan näkyisi missään muualla:
   *
   *   - **Teos on kolmijakoinen.** Sekvensseri laskee kuudestoistaosia ja sen
   *     tahti on 16 askelta eli neljäjakoinen. Valssi tehdään tässä niin että
   *     jokainen ääni ja jokainen rumpukuvio on kuuden askeleen monikerta —
   *     kuusi kuudestoistaosaa on yksi 3/4-tahti. Yksikin ääni väärän
   *     mittaisena, ja raita alkaa vaeltaa omaa tahtiaan muita vasten. Se
   *     kuulostaisi rikkinäiseltä eikä väärältä, mikä on juuri se vika jota
   *     kukaan ei osaa etsiä.
   *   - **Keskiyö lyö kaksitoista.** Teos alkaa kahdellatoista lyönnillä, ja
   *     ne ovat tässä ensimmäisenä fraasina. Se on koko sovituksen tunnistettavin
   *     yksittäinen asia, joten se on myös se jonka pitää olla luettavissa
   *     datasta eikä vain kuultavissa.
   */
  {
    Sfx.resume();
    Music.play('bone');
    const track = Music._track;
    const lens = [
      ...(Music._voices || []).map((v) => `${v.name} ${v.len}`),
      ...(Music._phrases || []).map((p, i) => `fraasi${i} ${p.len}`),
      ...Object.entries((track && track.drums) || {}).map(([k, p]) => `${k} ${p.length}`),
    ];
    const numbers = lens.map((s) => Number(s.split(' ')[1]));
    const inThree = numbers.length > 0 && numbers.every((n) => n % 6 === 0);

    const first = track && track.lead && track.lead.phrases ? track.lead.phrases[0] : [];
    let run = 0;
    let best = 0;
    let prev = null;
    for (const [semi] of first) {
      run = semi !== null && semi === prev ? run + 1 : 1;
      prev = semi;
      best = Math.max(best, run);
    }
    expect('luumaailman raita on kolmijakoinen jokaista ääntä myöten',
      inThree, lens.join(', ') || 'ei raitaa');
    expect('keskiyö lyö kaksitoista ennen kuin tanssi alkaa',
      best === 12, `pisin toisto ${best} lyöntiä, fraasissa ${first.length} nuottia`);
    Music.stop();
  }

  /*
   * KAASUKEHÄ, ELI SE ETTÄ LYYDINEN ON DATASSA EIKÄ TUNNELMASSA.
   *
   * Maailman 7 raita on **tätä peliä varten sävelletty** — ei `source`-kenttää,
   * eikä sitä kysytä miltään, koska DESIGN.md kohdan 1 b sääntö koskee
   * lainattua eikä kaikkea. Vapautuneesta sävelmistöstä ei löytynyt teosta joka
   * olisi ollut *tämä paikka* samalla tavalla kuin Danse macabre oli
   * luulaakso, ja aihevalinta on ainoa peruste jolla lainaaminen on tässä
   * pelissä tehty.
   *
   * Sävellyksen yksi ajatus on kirjoitettavissa numeroina, joten se
   * tarkistetaan: raita on **D-lyydisessä**. Lyydinen on duuriasteikko jonka
   * neljäs sävel on korotettu, ja juuri se yksi sävel on syy valita se tänne:
   * korotettu kvartti poistaa vetovoiman subdominanttiin, eli harmonia ei
   * koskaan kallistu alaspäin. Se on kirjaimellisesti sen soundi ettei mikään
   * laskeudu — mikä on tämän maailman koko aihe.
   *
   * Kaksi lukua, ja molemmat rikkoutuvat yhdestä nuotista:
   *   - **alennettua kvarttia (G) ei ole kertaakaan.** Yksi G ja moodi on
   *     jälleen tavallinen duuri, eikä kukaan osaisi etsiä sitä yhtä säveltä.
   *   - **korotettu kvartti (G#) soi useasti.** Lyydinen jossa ei koskaan soi
   *     sen oma sävel on lyydinen vain paperilla.
   */
  {
    Sfx.resume();
    Music.play('cloud');
    const track = Music._track;
    /* D on -7 puolisävelaskelta A:sta, joten sävelluokka lasketaan siitä. */
    const pcOf = (semi) => (((semi + 7) % 12) + 12) % 12;
    const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
    const counts = new Array(12).fill(0);
    const collect = (notes) => {
      for (const [semi] of notes || []) {
        if (semi === null || semi === undefined) continue;
        for (const s of Array.isArray(semi) ? semi : [semi]) counts[pcOf(s)]++;
      }
    };
    for (const name of ['lead', 'harm', 'bass']) {
      const voice = (track || {})[name];
      if (!voice) continue;
      collect(voice.notes);
      for (const phrase of voice.phrases || []) collect(phrase);
    }
    const outside = counts
      .map((n, pc) => ({ pc, n }))
      .filter((x) => x.n && !LYDIAN.includes(x.pc));
    expect('pilviraita on D-lyydinen: korotettu kvartti soi, alennettua ei ole',
      outside.length === 0 && counts[6] >= 8 && counts[5] === 0,
      `G# ${counts[6]} kertaa, G ${counts[5]} kertaa, asteikon ulkopuolella `
      + `${outside.map((x) => `pc${x.pc}×${x.n}`).join(' ') || 'ei mitään'}`
      + ` — säveliä yhteensä ${counts.reduce((a, b) => a + b, 0)}`);
    Music.stop();
  }

  /*
   * YÖ AUTIOVUORELLA, ELI SE ETTÄ AAMU ON DATASSA EIKÄ SELITYKSESSÄ.
   *
   * Viimeisen linnakkeen raita on Modest Mussorgskin *Yö Autiovuorella* (1867)
   * Nikolai Rimski-Korsakovin sovituksena (1886), ja DESIGN.md kohta 1 b
   * sanoo millä ehdoilla: sävelet käsin `TRACKS`-tauluun, ei äänitettä eikä
   * nuottilaitosta, ja lähde nimetään. Nimeäminen tarkistetaan ajon lopussa
   * molemmista dokumenteista — ja **molemmat tekijät**, koska sovitus on oma
   * teoksensa omine suoja-aikoineen. Täällä tarkistetaan se mikä on
   * tarkistettavissa itse sävelistä.
   *
   * Teoksen koko dramaturgia on yksi käänne: **yö on mollissa, aamu on
   * duurissa.** Kellon lyötyä pahat väistyvät ja loppu on sama sävellaji
   * suurena. Se on kirjoitettavissa numeroina, ja se on juuri sen lajin väite
   * joka rikkoutuu yhdestä nuotista huomaamatta:
   *
   *   - **yön fraasit eivät sisällä duuriterssiä kertaakaan.** Yksi F# yössä ja
   *     käänteestä tulee koriste, koska duuri oli jo käynyt.
   *   - **aamun fraasi ei sisällä molliterssiä kertaakaan**, ja sisältää
   *     duuriterssin. Muuten aamu on vain hiljaisempi yö.
   *
   * Ja kello: aamufraasi alkaa toistuvilla lyönneillä samaa säveltä, kuten
   * luulaakson keskiyö. Ero on tarkoituksellinen ja se on suunta — luulaakson
   * kaksitoista lyöntiä *aloittavat* tanssin, tämän raidan lyönnit *lopettavat*
   * yön.
   */
  {
    Sfx.resume();
    Music.play('autiovuori');
    const track = Music._track;
    /* D on -7 puolisävelaskelta A:sta, sama laskutapa kuin pilviraidalla. */
    const pcOf = (semi) => (((semi + 7) % 12) + 12) % 12;
    const MINOR_THIRD = 3;
    const MAJOR_THIRD = 4;
    const phrases = ((track || {}).lead || {}).phrases || [];
    const countIn = (phrase, pc) => {
      let n = 0;
      for (const [semi] of phrase || []) {
        if (semi === null || semi === undefined) continue;
        for (const s of Array.isArray(semi) ? semi : [semi]) if (pcOf(s) === pc) n++;
      }
      return n;
    };
    const night = phrases.slice(0, -1);
    const dawn = phrases[phrases.length - 1] || [];
    const nightMajor = night.reduce((s, p) => s + countIn(p, MAJOR_THIRD), 0);
    const nightMinor = night.reduce((s, p) => s + countIn(p, MINOR_THIRD), 0);
    const dawnMajor = countIn(dawn, MAJOR_THIRD);
    const dawnMinor = countIn(dawn, MINOR_THIRD);
    /* Kello: pisin sarja samaa säveltä aamufraasin alussa. */
    let toll = 0;
    for (const [semi] of dawn) {
      if (semi !== null && semi === (dawn[0] || [])[0]) toll++;
      else break;
    }
    expect('autiovuoren yö on mollissa ja sen aamu duurissa',
      phrases.length >= 3 && nightMinor > 0 && nightMajor === 0
      && dawnMajor > 0 && dawnMinor === 0,
      `yössä molliterssi ${nightMinor}, duuriterssi ${nightMajor} `
      + `(${night.length} fraasia); aamussa duuriterssi ${dawnMajor}, `
      + `molliterssi ${dawnMinor}`);
    expect('aamun fraasi alkaa kellonlyönneillä',
      toll >= 4, `${toll} lyöntiä, aamufraasissa ${dawn.length} nuottia`);

    /*
     * Ja se puolisko ilman jota käänne ei kuuluisi: **säestyksessä ei ole
     * terssiä.**
     *
     * Sekvensseri vaihtaa fraasia joka kierroksella mutta soittaa saman
     * `harm`in läpi koko raidan. Mollisointu aamun alla rikkoisi käänteen
     * täsmälleen sillä nuotilla jolla se tehdään, eikä sitä kuulisi
     * rikkinäisenä vaan latteana. Paljas kvintti kantaa molemmat, ja se on
     * tarkistettavissa: ei yhtään F:ää eikä F#:ää.
     */
    const harmThirds = ((track || {}).harm || {}).notes || [];
    let thirds = 0;
    for (const [semi] of harmThirds) {
      if (semi === null || semi === undefined) continue;
      for (const s of Array.isArray(semi) ? semi : [semi]) {
        if (pcOf(s) === MINOR_THIRD || pcOf(s) === MAJOR_THIRD) thirds++;
      }
    }
    expect('autiovuoren säestyksessä ei ole terssiä, joten sama sointu kantaa yön ja aamun',
      harmThirds.length > 0 && thirds === 0,
      `${harmThirds.length} sointua, terssejä ${thirds}`);
    Music.stop();
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
      for (const bg of ['hills', 'dunes', 'peaks', 'bones', 'clouds', 'factory', 'none']) {
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

    /*
     * Ja teeman ruutujen pitää erottua TOISISTAAN, ei vain piirtyä.
     *
     * Tämä on se puolisko jonka jäljelle jäi kun teemakohtaiset ruutumuodot
     * peruttiin (ROADMAP, ✘ 9.8.2026): jos siluetti on kaikissa maailmoissa
     * sama, koko ero on materiaalissa ja värissä — ja silloin väri on
     * mekaniikkaa eikä koristetta. Tiili hajoaa ja maa ei, joten pelaajan on
     * nähtävä kumpi on kumpi yhdellä silmäyksellä.
     *
     * Mitta on kanavakohtainen keskiero täydestä 255:stä, mikä on karkea mutta
     * rikkomaton: se ei osaa sanoa mitään muodosta, ja juuri siksi se mittaa
     * sitä yhtä asiaa joka teemasta toiseen muuttuu.
     *
     * **Mitattu ennen kuin luuteemaa oli olemassa**, ja luku kannattaa lukea:
     * ruoho 9,3 %, aavikko 8,6 %, yö **0,4 %**, jää 22,3 %, tehdas 17,9 %,
     * linnake 7,9 %. Yön tiili ja yön maa olivat siis käytännössä sama väri —
     * `#7a5a30` vastaan `#6a5030` — eli 2-N:ssä rikottava lohko sulautui
     * maahan. Se oli pitkään löydös eikä korjattava, koska yön paletin
     * muuttaminen muuttaa valmiin kentän ulkonäön; omistaja päätti sen
     * erikseen, ja korjaus on **tiilessä eikä maassa** (ks. oma kohtansa alla).
     *
     * Siksi väite on se jonka tämä työ omistaa ja joka on rikottavissa:
     * **luumaailman pari on koko pelin selvin.** Ei "riittävän hyvä" vaan
     * mitattuna paras, koska sen maa on luuta ja sen tiili hautamultaa — kaksi
     * eri ainetta eikä saman aineen kaksi sävyä. Kynnyksenä on nykyinen paras
     * (jää), joten tämä ei voi mennä läpi vahingossa.
     */
    {
      const meanOf = (ch, theme) => {
        g.clearRect(0, 0, 320, 208);
        drawTile(g, ch, 0, 16, theme, 3, 5, 0, ' ', {});
        const d = g.getImageData(0, 16, 16, 16).data;
        let r = 0; let gg = 0; let b = 0; let n = 0;
        for (let q = 0; q < d.length; q += 4) {
          if (d[q + 3] < 8) continue;
          r += d[q]; gg += d[q + 1]; b += d[q + 2]; n++;
        }
        return n ? [r / n, gg / n, b / n] : null;
      };
      const gapOf = (theme) => {
        const a = meanOf(T.GROUND, theme);
        const b = meanOf(T.BRICK, theme);
        if (!a || !b) return 0;
        return ((Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3 / 255)
          * 100;
      };
      const gaps = Object.keys(THEMES).map((theme) => ({ theme, gap: gapOf(theme) }));
      const others = gaps.filter((x) => x.theme !== 'bone');
      const worst = others.reduce((m, x) => (x.gap < m.gap ? x : m), others[0]);
      const best = others.reduce((m, x) => (x.gap > m.gap ? x : m), others[0]);
      const bone = gaps.find((x) => x.theme === 'bone');
      expect('luumaailman tiili ja maa erottuvat selvemmin kuin minkään muun teeman',
        !!bone && bone.gap > best.gap,
        `${gaps.map((x) => `${x.theme} ${x.gap.toFixed(1)} %`).join(', ')}`
        + ` — muista paras ${best.theme}, huonoin ${worst.theme}`);

      /*
       * Ja juoksuhiekan pitää erottua siitä maasta johon se on kaivettu.
       *
       * Kynnys ei ole makuasia vaan sama mitta yhtä askelta tiukempana: aavikon
       * oma maa/tiili-pari on 8,6 %, ja se on pelin heikoimpia — tiedossa oleva
       * ongelma, ei tavoite. Uhka jota ei tunnista ensi silmäyksellä on juuri se
       * laji jota tässä pelissä ei saa olla (sama sääntö kuin piikkien
       * varoitusraidalla), joten hiekan ja maan eron on oltava suurempi kuin
       * tuon parin. Toinen puolisko on ettei se saa lukea laavana: kaksi
       * samanlaista signaalia opettaa väärän lukutavan.
       */
      const sandGap = gapOf('desert');
      const quick = meanOf(T.QUICKSAND, 'desert');
      const ground = meanOf(T.GROUND, 'desert');
      const lava = meanOf(T.LAVA, 'desert');
      const sep = (a, b) => (!a || !b ? 0
        : ((Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3 / 255) * 100);
      const vsGround = sep(quick, ground);
      const vsLava = sep(quick, lava);
      expect('juoksuhiekka erottuu aavikon maasta selvemmin kuin maa erottuu tiilestä',
        !!quick && vsGround > sandGap && vsLava > sandGap,
        `hiekka vs maa ${vsGround.toFixed(1)} %, hiekka vs laava ${vsLava.toFixed(1)} %, `
        + `aavikon maa vs tiili ${sandGap.toFixed(1)} %`);

      /*
       * Ja pilviteema on juuri se teema joka tämän testin kuuluisi kaataa.
       *
       * Valkoista valkoisella on koko maailman lähtökohta, ja se on samalla se
       * tapa jolla teema epäonnistuisi hiljaa: rikottava lohko sulaisi maahan
       * kuten yössä (0,4 %), eikä kukaan huomaisi ennen kuin joku juoksisi
       * kentän läpi ja ihmettelisi minne palikat katosivat. Siksi tässä
       * maailmassa maa ja tiili ovat **kaksi eri pilveä**: pohjapilvi on
       * auringon puolelta valaistua, tiili on ukkospilveä. Kynnys 25 % on
       * korkeampi kuin yhdelläkään ennen luumaailmaa toimitetulla teemalla,
       * eli se ei mene läpi vahingossa — ja luumaailman oma väite yllä pitää
       * huolen ylärajasta, koska se vaatii olevansa koko pelin selvin pari.
       */
      const cloud = gaps.find((x) => x.theme === 'cloud');
      expect('pilvimaailman tiili erottuu maasta vaikka molemmat ovat pilveä',
        !!cloud && cloud.gap >= 25,
        cloud ? `pilvi ${cloud.gap.toFixed(1)} %, kynnys 25 % — jää ${
          (gaps.find((x) => x.theme === 'ice') || {}).gap.toFixed(1)} %, yö ${
          (gaps.find((x) => x.theme === 'night') || {}).gap.toFixed(1)} %`
          : 'ei pilviteemaa lainkaan');

      /*
       * JA YÖ. Pelin heikoin pari, 0,4 %, ja koko päivän tiedossa ollut ongelma:
       * `#7a5a30` tiiltä `#6a5030` maata vasten on kaksi nimeä samalle ruskealle,
       * eli 2-N:n rikottava lohko on käytännössä näkymätön. Se on ehtinyt ohjata
       * kahta suunnittelupäätöstä — juoksuhiekka jätettiin pois 2-N:stä ja
       * pilviteema rakennettiin 25 %:n kynnykseen juuri ettei tämä toistuisi.
       *
       * **Omistaja päätti että tiili vaalenee ja maa jää.** Se on tärkeä puoli:
       * 2-N:n lattia näyttää tämän jälkeen täsmälleen siltä miltä ennenkin.
       *
       * Kynnys on 17 %, ja se on **kaksi kertaa pelin heikoin selviytynyt pari**
       * (aavikko 8,6 %). Se ei ole jään 22,3 % eikä sitä yritetäkään: jään koko
       * paletti asuu luminanssivälillä 145–224, eli sillä on 80 tasoa
       * liikkumavaraa, kun taas yön paletti on tarkoituksella puristettu pimeään
       * päähän — ja juuri se puristus **on** se mikä tekee yöstä yön. Kynnys ei
       * myöskään ole "hiukan yli nykyisen": se on lähellä sitä maksimia jonka
       * paletti antaa alla olevan pimeysehdon vallitessa, ja mitattu paras
       * puumainen sävy sen alla oli 19,2 %.
       */
      const night = gaps.find((x) => x.theme === 'night');
      expect('yön tiili erottuu yön omasta maasta',
        !!night && night.gap >= 17,
        night ? `yö ${night.gap.toFixed(1)} %, kynnys 17 % = 2 × aavikko `
          + `(${(gaps.find((x) => x.theme === 'desert') || {}).gap.toFixed(1)} %) `
          + `— ennen korjausta 0,4 %` : 'ei yöteemaa lainkaan');

      /*
       * Ja tässä on se puolisko joka estää helpon vastauksen.
       *
       * Vaalentamisella on raja, ja ilman rajaa tämän testin voisi läpäistä
       * maalaamalla yön tiilen niin kirkkaaksi että se hehkuu sisältäpäin — yksi
       * bugi vaihdettuna toiseen. Raja on mitattu eikä keksitty: **kova palikka
       * on jokaisen kahdeksan teeman kirkkain kiinteä ruutu**, maata ja tiiltä
       * myöten (mitattuna luminanssina ruoho 192,3 / 99,5 / 105,6; aavikko
       * 186,7 / 166,2 / 141,0; yö 133,1 / 86,6; jää 224,3; tehdas 162,5;
       * luu 211,0; pilvi 232,6; linnake 171,0).
       *
       * Se on kaksi asiaa yhdessä. Fysiikan puolella kova palikka on se pinta
       * jonka taivas valaisee kirkkaimmin, joten mikä tahansa sitä kirkkaampi
       * ruutu tekee valonsa itse — juuri se on "hehkuu sisältäpäin" mitattuna.
       * Luettavuuden puolella se on opittu merkki: **kirkkain on se jota ei voi
       * rikkoa.** Yksi teema joka kääntää sen nurin opettaa väärän lukutavan
       * kaikkien muiden jäljiltä.
       *
       * Väite koskee kaikkia teemoja eikä vain yötä, koska sääntö on koko pelin
       * eikä yhden korjauksen — ja koska juuri niin se pysyy voimassa myös
       * seuraavan paletin kohdalla.
       */
      const lumOf = (ch, theme) => {
        const m = meanOf(ch, theme);
        return m ? 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2] : 0;
      };
      const lit = Object.keys(THEMES).map((theme) => ({
        theme,
        hard: lumOf(T.HARD, theme),
        ground: lumOf(T.GROUND, theme),
        brick: lumOf(T.BRICK, theme),
      }));
      const glowing = lit.filter((x) => x.hard <= x.brick || x.hard <= x.ground);
      const nightLit = lit.find((x) => x.theme === 'night');
      expect('kova palikka on jokaisen teeman kirkkain kiinteä ruutu',
        glowing.length === 0,
        `${lit.map((x) => `${x.theme} ${x.hard.toFixed(0)}/${x.ground.toFixed(0)}/`
          + `${x.brick.toFixed(0)}`).join(', ')} (kova/maa/tiili)`
        + (nightLit ? ` — yön tiilelle jää ${(nightLit.hard - nightLit.brick).toFixed(1)} `
          + 'luminanssia pelivaraa' : ''));
    }

    /* A pipe that goes up has to look like it goes up, or the rule `tryWarp`
     * enforces is invisible and the warp reads as broken. The tile knows from
     * the neighbour it is already handed: pipe overhead means this mouth is the
     * bottom end of something hanging, so it is drawn mirrored. Asserted as the
     * mirror rather than as "different", because "different" would also pass if
     * the two were merely two shades of the same wrong picture. */
    {
      const px = (d, x, y) => (d[(y * 320 + x) * 4] << 16) | (d[(y * 320 + x) * 4 + 1] << 8)
        | d[(y * 320 + x) * 4 + 2];
      const tile = (above) => {
        g.clearRect(0, 0, 320, 208);
        drawTile(g, '(', 0, 0, 'factory', 3, 5, 0, above, {});
        drawTile(g, ')', 16, 0, 'factory', 4, 5, 0, above, {});
        return g.getImageData(0, 0, 320, 208).data;
      };
      const floor = tile(' ');
      const ceiling = tile('{');
      let mirrored = 0;
      let same = 0;
      for (let x = 0; x < 32; x++) {
        for (let y = 0; y < 16; y++) {
          if (px(floor, x, y) === px(ceiling, x, 15 - y)) mirrored++;
          if (px(floor, x, y) === px(ceiling, x, y)) same++;
        }
      }
      expect('a pipe hanging from the ceiling is drawn the other way up',
        mirrored === 512 && same < 512,
        `peilattuja ${mirrored}/512, samoja ${same}/512`);
    }

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
      // Both halves of the bean: falling, and once it is a stalk.
      for (const bare of [true, false]) {
        sprites.drawSprout(g, 20, 20, 30, bare);
        check(`sprout ${bare ? 'bare' : 'grown'}`);
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
      for (const v of [0, 1, 2, 3, 4]) {
        sprites.drawBoss(g, 20, 40, 12, 1, false, v, 1, 1);
        check(`boss ${v} spiny`);
      }
      // Kurnuttajan varoituskupla on läpikuultava, eli se koskee globalAlphaan.
      if (sprites.drawKurnuttaja) {
        sprites.drawKurnuttaja(g, 20, 40, 12, -1);
        check('kurnuttaja');
        for (const t of [0.01, 0.5, 1]) {
          sprites.drawCroak(g, 20, 56, t, 12);
          check(`kurnutus ${t}`);
        }
      }
      expect('drawing a sprite leaves the canvas state as it found it',
        leaks.length === 0, leaks.join(', '));
    }
  }

  const { TRACK_SOURCES } = await import('/src/core/audio.js');
  return {
    levels, checks, failures, worlds: WORLDS.length, ruleReport,
    audio: { sfx: Sfx.names(), music: Music.names() },
    trackSources: TRACK_SOURCES || {},
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

/* ------------------------ kehys kaarevan kuvan ympärillä ------------------ */
/*
 * Omistajan havainto Chromella: "kuvaputkiruudun ympärillä on laatikko".
 *
 * Syy on kahden asian törmäys, ja molemmat mitataan tässä ennen kuin kumpaakaan
 * uskotaan. `styles.css` piirtää esityskankaalle suorakulmaisen renkaan
 * (`box-shadow: 0 0 0 2px`), kun taas `postfx.js`:n tynnyrivääristymä vetää
 * kuvan **sisäänpäin** (`uv += uv * offset`, ja rajan yli menevä näyte on
 * kehystä). Suora rengas jää siis seisomaan kaarevan kuvan ympärille, ja rako
 * niiden välissä on suurimmillaan nurkissa — juuri siellä missä se ruutukaappauksessa näkyy.
 *
 * Mittaus on kaksiosainen, koska rengas ei ole kankaalla vaan sivulla: kaarevuus
 * luetaan esityskankaan pikseleistä (lähde valkoiseksi, yksi `present`, ja
 * katsotaan mistä kuva alkaa), ja rengas oikeasta ruutukaappauksesta, jonka
 * selain on jo yhdistänyt varjoineen päivineen. Kaappaus puretaan takaisin
 * sivulla `createImageBitmap`illa — se on sama kaksikko joka repossa jo on
 * (`tools/make-card.mjs` kuvaa elementin, testistö lukee pikseleitä).
 *
 * Vaatimus on nimenomaan ehdollinen eikä "poista kehys". Kuvamoodeja on kolme
 * (`7`: pois → hehku → kuvaputki) ja vain kuvaputki kaartaa, eikä WebGL:tä
 * vailla olevalla koneella kaareva kuva ole edes mahdollinen. Suora kuva saa
 * siis pitää kehyksensä, ja se on toinen tämän kohdan väitteistä: pelkkä rivin
 * poistaminen tiedostosta kaataa sen.
 */
{
  const expect = (name, ok, detail = '') => {
    report.checks.push({ name, ok, detail });
    if (!ok) report.failures.push(`${name}${detail ? ` (${detail})` : ''}`);
  };

  const glThere = await page.evaluate(async () => {
    const { PostFX } = await import('/src/gfx/postfx.js');
    return PostFX.mode === 'webgl';
  });

  if (!glThere) {
    // Kelvollista WebGL:ää vailla ei ole kaarevaa kuvaa eikä siis tätä bugia.
    // Ohitus sanotaan ääneen: hiljaa ohitettu testi on vihreä joka ei mittaa.
    report.checks.push({
      name: 'kaareva kuva ei kanna suoraa kehystä',
      ok: true,
      detail: 'ei WebGL-kontekstia, ei kaarevuutta — ohitettu',
    });
  } else {
    /* 1. Kaarevuus: kuinka kauas kuva vetäytyy elementin reunasta.
     *
     * Lähde maalataan valkoiseksi, jotta ero kuvan ja kehysvärin
     * (`vec4(0.02, 0.02, 0.03, 1.0)`) välillä on suurin mahdollinen eikä mittaus
     * riipu siitä mikä kohtaus sattuu olemaan ruudulla. Nurkasta lähdetään
     * lävistäjää pitkin sisään ja reunan keskeltä suoraan sisään: ero näiden
     * kahden välillä **on** koko bugi, koska suora kehys sopii vain siihen
     * jälkimmäiseen. */
    const curve = await page.evaluate(async () => {
      const { PostFX } = await import('/src/gfx/postfx.js');
      const game = window.sfb3;
      const src = game.canvas;
      const g = src.getContext('2d');
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, src.width, src.height);
      PostFX.setPreset('crt');
      PostFX.present();
      const disp = PostFX.displayCanvas;
      // Piirtopuskuria luetaan saman tehtävän sisällä kuin se piirrettiin:
      // ilman `preserveDrawingBuffer`ia se on tyhjä heti kun selain on ehtinyt
      // yhdistää ruudun.
      const probe = document.createElement('canvas');
      probe.width = disp.width;
      probe.height = disp.height;
      const p = probe.getContext('2d');
      p.drawImage(disp, 0, 0);
      const d = p.getImageData(0, 0, probe.width, probe.height).data;
      const sum = (x, y) => {
        const i = (y * probe.width + x) * 4;
        return d[i] + d[i + 1] + d[i + 2];
      };
      // Kehysväri on summana 18; 40 on sen yläpuolella ja kaukana valkoisesta.
      let diag = 0;
      while (diag < probe.height / 2 && sum(diag, diag) < 40) diag++;
      let mid = 0;
      const my = probe.height >> 1;
      while (mid < probe.width / 2 && sum(mid, my) < 40) mid++;
      game.render();                     // takaisin siihen mitä ruudulla oli
      return { w: probe.width, h: probe.height, diag, mid };
    });
    expect('kuvaputken kuva vetäytyy nurkista mutta ei reunojen keskeltä',
      curve.diag >= 8 && curve.mid === 0,
      `nurkassa ${curve.diag} px sisään, reunan keskellä ${curve.mid} px `
      + `(${curve.w}x${curve.h})`);

    /* 2. Rengas: kirkkain pikseli siinä kahden pikselin nauhassa joka jää heti
     * elementin ulkopuolelle. Siellä asuu `box-shadow`in levitys, ja siellä
     * asuu myös pudotusvarjo — joka vain tummentaa, joten sivun oma tausta on
     * oikea vertailukohta molempiin suuntiin. */
    const band = async (preset) => {
      await page.evaluate(async (name) => {
        const { PostFX } = await import('/src/gfx/postfx.js');
        PostFX.setPreset(name);
        window.sfb3.render();
      }, preset);
      await page.waitForTimeout(80);
      const box = await page.evaluate(() => {
        const el = document.getElementById('screen') || document.getElementById('game');
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      const pad = 6;
      const png = await page.screenshot({
        clip: {
          x: Math.round(box.x - pad),
          y: Math.round(box.y - pad),
          width: Math.round(box.w + pad * 2),
          height: Math.round(box.h + pad * 2),
        },
      });
      return page.evaluate(async ({ b64, edge }) => {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
        const bmp = await createImageBitmap(blob);
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const g = c.getContext('2d');
        g.drawImage(bmp, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        const lum = (x, y) => {
          const i = (y * c.width + x) * 4;
          return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        };
        let max = 0;
        for (let x = edge; x < c.width - edge; x++) {
          max = Math.max(max, lum(x, edge - 1), lum(x, edge - 2),
            lum(x, c.height - edge), lum(x, c.height - edge + 1));
        }
        for (let y = edge; y < c.height - edge; y++) {
          max = Math.max(max, lum(edge - 1, y), lum(edge - 2, y),
            lum(c.width - edge, y), lum(c.width - edge + 1, y));
        }
        const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
        return { max, bg: 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2] };
      }, { b64: png.toString('base64'), edge: pad });
    };

    const wasPreset = await page.evaluate(async () => {
      const { PostFX } = await import('/src/gfx/postfx.js');
      return PostFX.preset;
    });
    const crt = await band('crt');
    const flat = await band('pois');
    const glow = await band('hehku');
    await page.evaluate(async (name) => {
      const { PostFX } = await import('/src/gfx/postfx.js');
      PostFX.setPreset(name);
      window.sfb3.render();
    }, wasPreset);

    expect('kaareva kuva ei kanna suoraa kehystä',
      crt.max <= crt.bg,
      `kirkkain kehyspikseli ${crt.max.toFixed(1)}, sivun tausta ${crt.bg.toFixed(1)} `
      + `— kuva vetäytyy nurkassa ${curve.diag} px`);

    /* Ja toinen puolisko: suora kuva on suora, ja suoran kuvan ympärille kehys
     * kuuluu. Ilman tätä väitettä bugin voisi "korjata" poistamalla rivin, ja
     * silloin ilman WebGL:ää pelaava — sama kone jolle koko varajärjestelmä on
     * olemassa — saisi reunattoman kankaan mustalla sivulla. */
    expect('suora kuva pitää kehyksensä molemmissa muissa moodeissa',
      flat.max > flat.bg && glow.max > glow.bg,
      `pois ${flat.max.toFixed(1)}, hehku ${glow.max.toFixed(1)}, `
      + `tausta ${flat.bg.toFixed(1)}`);
  }
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
 * VAPAUTUNUT SÄVELMISTÖ ON NIMETTÄVÄ, JA TÄSSÄ SE EHTO ON AJETTAVA.
 *
 * DESIGN.md kohta 1 b (9.8.2026) päästää tekijänoikeudesta vapautuneen
 * sävellyksen sisään yhdellä ehdolla: **lähde nimetään**, sekä DESIGN.md:hen
 * että CHANGELOG.md:hen. Se ehto oli tähän asti lupaus, ja lupaus on juuri se
 * asia joka unohtuu kolmannella kerralla — kohta itse sanoo miksi tämä on
 * ankarampi kuin vanha sääntö: "kaikki on itse tehtyä" on väite jota kukaan ei
 * voi tarkistaa, ja nimetty teos on lause jonka kuka tahansa voi todentaa.
 *
 * Joten raita kantaa lähteensä mukanaan (`source` `TRACKS`-taulussa) ja tämä
 * tarkistaa, että sekä säveltäjä että teoksen nimi lukevat molemmissa
 * dokumenteissa. Raita ilman `source`-kenttää on omaa sävellystä eikä sitä
 * kysytä miltään — sääntö koskee lainattua, ei kaikkea.
 */
{
  const design = await readFile(join(ROOT, 'DESIGN.md'), 'utf8');
  const changelog = await readFile(join(ROOT, 'CHANGELOG.md'), 'utf8');
  /*
   * Luetaan **jokainen** `source`in kenttä eikä kahta nimettyä, ja se ero on
   * maailman 8 maksama oppi.
   *
   * *Yö Autiovuorella* tunnetaan lähes yksinomaan Rimski-Korsakovin
   * sovituksena, ja **sovitus on oma teoksensa omine suoja-aikoineen** — juuri
   * se on se kohta jossa "tämähän on vanhaa musiikkia" menee useimmiten
   * pieleen. Kun portti luki vain `composer`in ja `work`in, raita saattoi
   * kantaa `arranger`-kentän jota mikään ei tarkistanut: kenttä olisi ollut
   * koodissa, nimi olisi voinut puuttua molemmista dokumenteista, eikä mikään
   * olisi sanonut mitään. Portti joka kattaa osan tapauksista on huonompi kuin
   * puuttuva portti, koska se näyttää kattavan kaikki — sama havainto kuin
   * `cave`n kanssa, ja se on nyt tehty kahdesti.
   */
  const unnamed = [];
  for (const [track, source] of Object.entries(report.trackSources || {})) {
    const parts = Object.values(source).filter((v) => typeof v === 'string' && v.trim());
    if (!parts.length) unnamed.push(`${track}: lähde on tyhjä`);
    for (const part of parts) {
      if (!design.includes(part)) unnamed.push(`${track}: "${part}" puuttuu DESIGN.md:stä`);
      if (!changelog.includes(part)) unnamed.push(`${track}: "${part}" puuttuu CHANGELOG.md:stä`);
    }
  }
  const named = Object.keys(report.trackSources || {});
  report.checks.push({
    name: 'jokainen lainattu sävelmä on nimetty DESIGN.md:ssä ja muutoslokissa',
    ok: unnamed.length === 0,
    detail: unnamed.length ? unnamed.join('; ')
      : `${named.length} lainattua raitaa: ${named.join(', ') || 'ei yhtään'}`,
  });
  if (unnamed.length) report.failures.push(...unnamed);
}

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
/*
 * GENERAATTORI TUNTEE JOKAISEN TEEMAN EHDOT, JA NE ON KOETELTU RIKKINÄISELLÄ
 * KENTÄLLÄ.
 *
 * Maailmat 6, 7 ja 8 kirjoittivat itselleen rakennesäännön — luussa taivas on
 * auki eikä mikään roiku, pilvessä mikään ei seiso maassa eikä ohut pilvi ole
 * tyhjän päällä, linnakkeessa ei ole ulkopuolta eikä lippua — ja jokainen niistä
 * on portissa **palikkatiedostoa vasten**. Se riitti niin kauan kuin nuo
 * maailmat olivat käsintehtyjä: palikka on se paikka jossa käsi tekee virheen.
 *
 * Generoitu kenttä ei kuitenkaan kokoa palikoita vaan kirjoittaa ruudukon, joten
 * jokainen noista säännöistä menisi generaattorin ohi ilman että mikään sanoo
 * mitään. Sääntö joka koskee sisältöä mutta ei sen konetta on puolikas sääntö.
 *
 * Tämä portti kysyy siis kolme asiaa, ja kolmas on se joka tekee kahdesta
 * ensimmäisestä muuta kuin koristetta:
 *
 *   1  generaattori tuntee kaikki kahdeksan teemaa (ei seitsemää, ei yhdeksää —
 *      lista luetaan `THEMES`istä eikä kirjoiteta tänne käsin)
 *   2  jokainen generoitu kenttä läpäisee oman teemansa ehdon
 *   3  **jokainen teeman ehto hylkää sitä rikkovan koekentän.** Ilman tätä
 *      kohta 2 olisi tosi myös silloin kun tarkistus ei tarkista mitään — ja
 *      juuri niin kävisi, koska generaattori ei tällä hetkellä tuota yhtään
 *      kenttää luuhun, pilveen, tehtaaseen tai linnakkeeseen. Neljä ehtoa
 *      viidestä olisi tyhjä lupaus ilman rikkinäistä koekenttää.
 */
{
  let problems = [];
  let themeNames = [];
  let checked = 0;
  let fixturesRun = 0;
  try {
    const gen = await import('./gen-levels.mjs');
    const { GENERATED_LEVELS } = await import('../src/data/generated.js');
    const tiles = await readFile(join(ROOT, 'src/gfx/tiles.js'), 'utf8');
    const table = /export const THEMES = \{([\s\S]*?)\n\};/.exec(tiles);
    themeNames = table ? [...table[1].matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]) : [];

    const missing = themeNames.filter((t) => !gen.THEME_RULES[t]);
    const extra = Object.keys(gen.THEME_RULES).filter((t) => !themeNames.includes(t));
    if (!themeNames.length) problems.push('THEMES-taulua ei löytynyt lähdetekstistä');
    problems.push(...missing.map((t) => `generaattori ei tunne teemaa ${t}`));
    problems.push(...extra.map((t) => `generaattori tuntee teeman ${t} jota ei ole`));

    for (const [id, def] of Object.entries(GENERATED_LEVELS)) {
      const bad = gen.themeProblems(def.theme, def.rows);
      checked++;
      problems.push(...bad.map((p) => `${id}: ${p}`));
    }

    /* Rikkinäinen koekenttä **sääntöä** kohti eikä teemaa kohti: sama pohja joka
     * kerta, yksi vika kerrallaan, ja teeman oma ehto on ainoa asia joka erottaa
     * ne. Pari per sääntö siksi että luussa, pilvessä ja linnakkeessa niitä on
     * kaksi, ja portti joka koettelee niistä toisen näyttää täsmälleen samalta
     * kuin portti joka koettelee molemmat. */
    for (const [theme, rule] of Object.entries(gen.THEME_RULES)) {
      if ((rule.fixtures || []).length !== rule.rules.length) {
        problems.push(`${theme}: ${rule.rules.length} sääntöä mutta `
          + `${(rule.fixtures || []).length} koekenttäparia`);
      }
      for (const make of rule.fixtures || []) {
        const { clean, broken } = make();
        fixturesRun++;
        if (gen.themeProblems(theme, clean).length) {
          problems.push(`${theme}: ehto hylkää oman kelvollisen koekenttänsä`);
        }
        if (!gen.themeProblems(theme, broken).length) {
          problems.push(`${theme}: ehto siunaa koekentän joka rikkoo sen`);
        }
      }
    }
  } catch (err) {
    problems.push(`teematarkistus ei päässyt ajoon: ${err && err.message}`);
  }
  report.checks.push({
    name: 'generaattori tuntee jokaisen teeman ehdot, ja ehdot hylkäävät rikkinäisen kentän',
    ok: problems.length === 0,
    detail: problems.length ? problems.slice(0, 5).join('; ')
      : `${themeNames.length} teemaa, ${checked} generoitua kenttää, ${fixturesRun} koekenttäparia`,
  });
  if (problems.length) report.failures.push(...problems);
}

/*
 * ALKUPERÄISYYSTARKISTUS: MITÄ ON MITATTU JA MITÄ EI, EIKÄ MITÄÄN SILTÄ VÄLILTÄ.
 *
 * DESIGN.md kohta 3 sanoo että generaattori hylkää kentän jos yksikään **8
 * sarakkeen ikkuna** osuu korpukseen, ja kohta 4 lisää käskyn: *aja generaattori
 * aina `VGLC_DIR` asetettuna*. Korpus ei ole repossa eikä saa olla, joten käsky
 * on ainoa mitä repo voi tehdä — ja käsky on juuri se muoto jonka kolmas tekijä
 * unohtaa.
 *
 * **Miksi tämä ei ole kaatava portti "tarkistamattomalle sisällölle".** Sellainen
 * portti olisi punainen jokaisessa ympäristössä jossa korpusta ei ole, eli tässä
 * repossa aina — ja tämä tiedosto sanoo itse muualla mitä pysyvästi punaiselle
 * portille tapahtuu: se sammutetaan. Pahempaa, se painostaisi merkitsemään
 * kentän tarkistetuksi jotta ajo menisi läpi, mikä on tasan se valhe jota vastaan
 * koko kohta 3 on kirjoitettu.
 *
 * Sen sijaan portti väittää **ympäristöstä ja tallenteesta yhdessä**, ja se on
 * kaatava molempiin suuntiin:
 *
 *   - `VGLC_DIR` asetettu → korpus luetaan tässä ja nyt, ja jokaisen generoidun
 *     kentän jokainen 8 sarakkeen ikkuna verrataan siihen. Yksikin osuma
 *     kaataa. Tämä on se "kyllä vai ei" jonka omistaja saa yhdellä komennolla.
 *   - `VGLC_DIR` asettamatta → tarkistusta ei voi tehdä, eikä sitä teeskennellä.
 *     Portti vaatii silloin että **jokainen generoitu kenttä kantaa merkinnän
 *     siitä ettei sitä ole tarkistettu**, ja kaataa ajon jos jokin kenttä
 *     väittää olevansa tarkistettu ilman että kukaan voi todentaa sitä.
 *
 * Eli: repo saa olla vihreä ilman korpusta, mutta se ei saa **väittää** mitään
 * ilman korpusta. Ero on koko kohta 3.
 */
{
  const problems = [];
  let detail = '';
  try {
    const { corpusHits, CORPUS_DIR } = await import('./originality.mjs');
    const { GENERATED_LEVELS } = await import('../src/data/generated.js');
    const levels = Object.entries(GENERATED_LEVELS);
    if (!levels.length) problems.push('yhtään generoitua kenttää ei löytynyt');

    if (CORPUS_DIR) {
      let hits = 0;
      let files = 0;
      for (const [id, def] of levels) {
        const r = await corpusHits(def.rows);
        files = r.files;
        hits += r.hits;
        if (r.hits) problems.push(`${id}: ${r.hits} kahdeksan sarakkeen ikkunaa osuu korpukseen`);
        if (def.origin !== 'checked') {
          problems.push(`${id}: korpus on käytettävissä mutta kenttä on generoitu ilman sitä `
            + '(merkintä "not checked") — aja: VGLC_DIR=… node tools/gen-levels.mjs');
        }
      }
      detail = `${levels.length} kenttää, ${files} korpustiedostoa, ${hits} osumaa`;
    } else {
      const lying = levels.filter(([, def]) => def.origin !== 'not checked');
      problems.push(...lying.map(([id, def]) => `${id}: merkintä "${def.origin}" ilman korpusta `
        + '— tarkistusta ei ole tehty, joten se ei saa lukea tehdyksi'));
      detail = `${levels.length} kenttää, kaikki merkitty "not checked" — `
        + 'VGLC_DIR asettamatta, aja: VGLC_DIR=… node tools/originality.mjs';
    }
  } catch (err) {
    problems.push(`alkuperäisyystarkistus ei päässyt ajoon: ${err && err.message}`);
  }
  report.checks.push({
    name: 'generoitu kenttä kantaa sen mitä sen alkuperästä on mitattu, ei enempää',
    ok: problems.length === 0,
    detail: problems.length ? problems.slice(0, 3).join('; ') : detail,
  });
  if (problems.length) report.failures.push(...problems);
}

/*
 * JOKAISELLA VIHOLLISMERKILLÄ ON HINTA VAIKEUSMITTARISSA.
 *
 * Piikkiukko lähti tuotantoon pisteillä **0**: se puuttui `ENEMY_COST`-taulusta
 * kokonaan, joten jokainen kenttä jossa niitä oli mittautui helpommaksi kuin
 * mitä se pelattuna oli — ja mittari on nykyään portti (maailman käyrän muoto),
 * eli väärä luku ei enää ole vain väärä raportti. Sama vika tehtiin melkein
 * uudestaan papuparoonin kanssa, ja se on merkki siitä että kyse ei ole
 * huolimattomuudesta vaan puuttuvasta tarkistuksesta.
 *
 * Merkit luetaan `ENEMY_CHARS`in lähdetekstistä eikä moduulista, koska tämä
 * puoli ajaa Nodessa eikä selaimessa — sama tekniikka kuin äänien nimien
 * tarkistuksessa yllä.
 */
{
  const { ENEMY_COST } = await import('./difficulty.mjs');
  const text = await readFile(join(ROOT, 'src/entities/enemies.js'), 'utf8');
  const table = /export const ENEMY_CHARS = \{([\s\S]*?)\n\};/.exec(text);
  const marks = table ? [...table[1].matchAll(/^\s{2}(\w):/gm)].map((m) => m[1]) : [];
  const priceless = marks.filter((ch) => ENEMY_COST[ch] === undefined);
  report.checks.push({
    name: 'jokaisella vihollismerkillä on hinta vaikeusmittarissa',
    ok: marks.length > 0 && priceless.length === 0,
    detail: priceless.length
      ? `hinnaton merkki: ${priceless.join(' ')} — lisää ENEMY_COST-tauluun`
      : `${marks.length} merkkiä: ${marks.join(' ')}`,
  });
  if (marks.length === 0) report.failures.push('ENEMY_CHARS-taulua ei löytynyt lähdetekstistä');
  if (priceless.length) {
    report.failures.push(...priceless.map((ch) => `'${ch}' puuttuu ENEMY_COST-taulusta`));
  }
}

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

/*
 * YKSI RUUTU, YKSI UUSI ASIA — opetusjärjestyksen ainoa portti.
 *
 * `tools/curriculum.mjs` mittaa kolmea ehtoa (POHJA, SEURA, YKSIN) ja on
 * raportti eikä portti. Omistaja päätti 9.8.2026 nostaa niistä *yhden*
 * portiksi, koska vain se osoitti toistuvan ja korjattavan vian: YKSIN hylkäsi
 * kuusi ensiesittelyä 26:sta, ja hylätyt tulivat kolmena parina — kolme kenttää
 * joissa kaksi uutta asiaa esitellään samalla ruudulla. POHJA hylkäsi nolla ja
 * SEURA kaksi, eikä kumpikaan kelpaa portiksi ilman että ne ensin korjataan.
 *
 * **Mitä "ensiesittely" tarkoittaa, kun kartta haarautuu.** Maailma 2 haarautuu
 * 2-2:ssa, joten yhdellä ominaisuudella on kolme eri vastausta siihen missä se
 * kohdataan ensin: *earliest* (aikaisin kenttä jollain reitillä), *guaranteed*
 * (kenttä johon mennessä jokainen reitti on sen kohdannut) ja *branch-only*
 * (vain toisella haaralla esiintyvä). **Tämä portti väittää `earliest`istä**,
 * ja syy on että se on pahin tapaus: se on ensimmäinen paikka jossa kukaan voi
 * kohdata asian, ja jos kaksi asiaa on siellä samalla ruudulla, ne ovat samalla
 * ruudulla jollekulle. `guaranteed` sallisi tungoksen niin kauan kuin *toinen*
 * reitti on jo opettanut toisen niistä, mikä on lupaus väärälle pelaajalle.
 *
 * Kulkua ei kävellä täällä uudestaan: `curriculum.mjs` kävelee graafin samoilla
 * säännöillä kuin `worldProblems` (linkit suunnattuja, reitti päättyy
 * linnakkeeseen, talot kävellään läpi), ja tämä tiedosto lukee sen tuloksen.
 * Toinen kävely olisi toinen totuus.
 *
 * Ruutu on 20 laattaa = 320 px, eli canvasin leveys jaettuna laatalla. Se on
 * oikea yksikkö siksi että kysymys ei ole siitä kuinka kaukana kaksi esittelyä
 * on toisistaan tiedostossa vaan siitä näkyvätkö ne yhtä aikaa.
 */
{
  const { CURRICULUM_ROWS, CURRICULUM_INTRO, SCREEN_COLS } = await import('./curriculum.mjs');
  const measured = CURRICULUM_ROWS.filter((r) => r.enc && !r.feature.core);
  const crowded = measured.filter((r) => !r.safety.yksin);
  const where = (r) => `${r.feature.key}@${r.enc.earliest}:${r.inst.x0}`;
  report.checks.push({
    name: `kahta ensiesittelyä ei ole saman ${SCREEN_COLS} laatan ruudun sisällä`,
    ok: crowded.length === 0,
    detail: crowded.length
      ? `${crowded.length}/${measured.length}: ${crowded.map(where).join(' ')}`
      : `${measured.length} ensiesittelyä, väljin pakka ${SCREEN_COLS} laattaa`,
  });
  if (crowded.length) {
    report.failures.push(...crowded.map((r) => `ensiesittely ruudun sisällä toisesta: ${where(r)}`));
  }

  /*
   * JA SAMAN ASIAN TOINEN PUOLI: montako uutta asiaa yksi kenttä esittelee.
   *
   * YKSIN mittaa etäisyyttä, tämä lukumäärää, ja ne eivät ole sama väite. Kenttä
   * voi levittää seitsemän ensiesittelyä 400 sarakkeelle ja läpäistä YKSINin
   * moitteetta — juuri niin 1-2 teki kaikkien muiden paitsi yhden parin osalta —
   * ja silti pyytää pelaajaa oppimaan seitsemän asiaa yhdessä kentässä. 1-2 oli
   * pelin toinen kenttä, mikä on huonoin mahdollinen paikka sille.
   *
   * Raja on **kolme**, eikä se ole pyöristys: kolme oli pelin *seuraavaksi*
   * pahin kenttä ennen tätä korjausta (1-1 ja 1-3, kumpikin kolme), joten raja
   * on mitattu pelistä eikä valittu. Se sanoo "1-2 ei saa olla poikkeus", ei
   * "kolme on oikea luku". Perussanasto ei ole mukana samasta syystä kuin
   * työkalussa: ensimmäisen ruudun aakkosia ei voi aikatauluttaa.
   */
  const over = CURRICULUM_INTRO.filter((l) => l.features.length > 3);
  const busiest = CURRICULUM_INTRO.reduce((a, b) => (b.features.length > a.features.length ? b : a));
  report.checks.push({
    name: 'yksikään kenttä ei esittele yli kolmea uutta asiaa',
    ok: over.length === 0,
    detail: over.length
      ? over.map((l) => `${l.id} ${l.features.length}: ${l.features.map((f) => f.feature.key).join(' ')}`).join(' — ')
      : `eniten ${busiest.id} ${busiest.features.length} kpl`,
  });
  if (over.length) {
    report.failures.push(...over.map((l) => `${l.id} esittelee ${l.features.length} uutta asiaa kerralla`));
  }
}

/*
 * JUOKSUHIEKKA KOLMESSA PAIKASSA, JA MITÄ VÄÄRÄ LUKUTAPA MAKSAA.
 *
 * ROADMAP kirjaa ansan: uusi ruutumerkki on kolme paikkaa eikä yksi. `TILE_INFO`
 * kertoo mitä merkki *on*, `src/data/rules.js` mitä validaattori siitä ajattelee
 * ja `tools/gen-levels.mjs` mitä generaattori siitä ajattelee — ja kaksi
 * jälkimmäistä ovat kopioita, koska validaattori ei saa importoida generaattoria
 * eikä toisin päin. Kopio on halvempi kuin sidos vain niin kauan kuin joku
 * tarkistaa että kopiot ovat samat, ja tämä on se tarkistus.
 *
 * Väärä lukutapa ei kaada mitään, se vain valehtelee. Hiekka kuiluna hylkäisi
 * kelvollisia kenttiä ja pakottaisi astinkiven paikkaan jossa sellaista ei
 * tarvita; hiekka tavallisena maana siunaisi lammikon jolla ei ole pohjaa, eli
 * pohjattoman kuilun jonka päälle on maalattu hiekkaa. Molemmat testataan
 * rikkinäisellä koekentällä, koska sääntö jota on koeteltu vain toimivalla
 * sisällöllä ei ole koeteltu millään.
 */
{
  const { validateLevel } = await import('../src/data/rules.js');
  const { scoreRows } = await import('./difficulty.mjs');
  const budget = JSON.parse(await readFile(join(ROOT, 'tools/jump-budget.json'), 'utf8'));

  /* Yksi koekenttä, 32 saraketta: tasamaata, keskellä yhden ruudun korkuinen
   * hiekkatörmä ja siihen kaivettu kahden ruudun syvyinen lammikko. Sama pohja
   * joka vialle, yksi vika kerrallaan. */
  const fixture = (over = {}) => {
    const rows = Array.from({ length: 15 }, () => ' '.repeat(32));
    const put = (y, s) => { rows[y] = s.padEnd(32, ' ').slice(0, 32); };
    put(9, '      !');
    put(12, '  1             XXX~~~XXXX  F   ');
    put(13, '################XXX~~~XXXX######');
    put(14, '################################');
    for (const [y, s] of Object.entries(over)) put(Number(y), s);
    return rows;
  };

  const clean = validateLevel(fixture(), budget);
  const sandProblems = (list) => list.filter((p) => /hiekk|quicksand/i.test(p));

  report.checks.push({
    name: 'kelvollinen hiekkalammikko ei ole validaattorille ongelma',
    ok: clean.length === 0,
    detail: clean.length ? clean.join('; ') : '32 saraketta, 3 ruutua hiekkaa, ei huomautuksia',
  });
  if (clean.length) report.failures.push(...clean.map((p) => `hiekkakoekenttä: ${p}`));

  /* Pohjaton lammikko: hiekka maalattu kuilun päälle. Tämä on se tapaus jossa
   * "hiekka on tavallista maata" menisi hiljaa läpi. */
  const noFloor = validateLevel(fixture({
    13: '################XXX~~~XXXX######',
    14: '###################   ##########',
  }), budget);
  report.checks.push({
    name: 'pohjaton hiekkalammikko raportoidaan, ei siunata maana',
    ok: sandProblems(noFloor).length > 0,
    detail: sandProblems(noFloor)[0] || `ei huomautusta hiekasta (${noFloor.join('; ') || 'ei mitään'})`,
  });
  if (!sandProblems(noFloor).length) {
    report.failures.push('validaattori ei huomaa hiekkaa pohjattoman kuilun päällä');
  }

  /* Yhdeksän saraketta hiekkaa on leveämpi kuin hyppybudjetti kantaa — ja silti
   * ei kuilu, koska hiekasta noustaan pintaan ja kahlataan yli. Jos tämä alkaa
   * raportoida "gap of 9", validaattori on alkanut lukea hiekkaa kuiluna. */
  const wide = validateLevel(fixture({
    12: '  1          XXX~~~~~~~~~XXX F  ',
    13: '#############XXX~~~~~~~~~XXX####',
  }), budget);
  report.checks.push({
    name: 'leveä hiekkalammikko ei ole kuilu',
    ok: !wide.some((p) => p.startsWith('gap of')),
    detail: wide.some((p) => p.startsWith('gap of'))
      ? wide.filter((p) => p.startsWith('gap of')).join('; ')
      : `9 saraketta hiekkaa, hyppybudjetti ${budget.gapTiles} — ei kuiluhuomautusta`,
  });
  if (wide.some((p) => p.startsWith('gap of'))) {
    report.failures.push('validaattori lukee hiekkalammikon kuiluna');
  }

  /* Ja kuoppa jonka reunalle ei nousta. Varoaika tekee sijoittelusta koko työn:
   * hiekka aukealla on säikähdys, hiekka kaivossa on ansa. */
  const walled = validateLevel(fixture({
    7: '                XXX   XXXX      ',
    8: '                XXX   XXXX      ',
    9: '      !         XXX   XXXX      ',
    10: '                XXX   XXXX      ',
    11: '                XXX   XXXX      ',
    12: '  1             XXX~~~XXXX  F   ',
  }), budget);
  report.checks.push({
    name: 'hiekkakuoppa jonka reunalle ei nousta raportoidaan',
    ok: sandProblems(walled).some((p) => /reuna|rim/i.test(p)),
    detail: sandProblems(walled)[0] || 'ei huomautusta seinien sisään kaivetusta kuopasta',
  });
  if (!sandProblems(walled).some((p) => /reuna|rim/i.test(p))) {
    report.failures.push('validaattori ei huomaa hiekkakuoppaa josta ei pääse ulos');
  }

  /* Sama virhe jonka piikkikävelijä teki tänä aamuna: uhka jota mittari ei näe.
   * Kaksi identtistä kenttää, toisessa hiekkaa — jos luku ei nouse, maailman 2
   * käyrä on väärä ja `verify.mjs`:n muototarkistus mittaa väärää kenttää. */
  const withSand = scoreRows(fixture());
  const withoutSand = scoreRows(fixture({
    12: '  1             XXXXXXXXXX  F   ',
    13: '################XXXXXXXXXX######',
  }));
  report.checks.push({
    name: 'vaikeusmittari näkee juoksuhiekan',
    ok: withSand > withoutSand + 0.5,
    detail: `sama kenttä hiekalla ${withSand.toFixed(1)}, ilman ${withoutSand.toFixed(1)} `
      + `(+${(withSand - withoutSand).toFixed(1)})`,
  });
  if (!(withSand > withoutSand + 0.5)) {
    report.failures.push('vaikeusmittari pisteyttää juoksuhiekan nollaksi');
  }

  /* Kolme paikkaa, ja kaksi niistä on tarkoituksellisia kopioita. Verrataan
   * merkkijonoina: se on ainoa tapa huomata että toinen kopio jäi päivittämättä. */
  const src = {
    tiles: await readFile(join(ROOT, 'src/gfx/tiles.js'), 'utf8'),
    rules: await readFile(join(ROOT, 'src/data/rules.js'), 'utf8'),
    gen: await readFile(join(ROOT, 'tools/gen-levels.mjs'), 'utf8'),
    diff: await readFile(join(ROOT, 'tools/difficulty.mjs'), 'utf8'),
    orig: await readFile(join(ROOT, 'tools/originality.mjs'), 'utf8'),
  };
  const sinkLine = /const SINK = new Set\(\[[^\]]*\]\);/;
  const inRules = (src.rules.match(sinkLine) || [])[0];
  const inGen = (src.gen.match(sinkLine) || [])[0];
  const inOrig = (src.orig.match(sinkLine) || [])[0];
  const places = [
    ['src/gfx/tiles.js', /QUICKSAND: '~'/.test(src.tiles) && /\[T\.QUICKSAND\]:/.test(src.tiles)],
    ['src/data/rules.js', !!inRules && inRules.includes("'~'")],
    ['tools/gen-levels.mjs', !!inGen && inGen === inRules],
    /* A FOURTH COPY APPEARED, and this line is what stops it from being the one
     * that rots. `tools/originality.mjs` folds every character it does not
     * recognise into air before comparing against the corpus, so a tile missing
     * from its sets is compared as if the level had a hole where the tile is —
     * exactly the failure the comment in rules.js describes, one module further
     * out. The comment in gen-levels.mjs says the fourth copy is the moment to
     * move the set into `src/gfx/tiles.js`; that is still true and still not
     * done, so until it is, the copy is checked as a string like the others. */
    ['tools/originality.mjs', !!inOrig && inOrig === inRules],
    ['tools/difficulty.mjs', /QUICKSAND_COST|'~'/.test(src.diff)],
  ];
  const missing = places.filter(([, ok]) => !ok).map(([f]) => f);
  report.checks.push({
    name: 'uusi ruutumerkki on kaikissa paikoissa joissa sen pitää olla',
    ok: missing.length === 0,
    detail: missing.length ? `puuttuu: ${missing.join(', ')}`
      : `${places.length} paikkaa, rules.js ja gen-levels.mjs sanasanaisesti samat`,
  });
  if (missing.length) report.failures.push(...missing.map((f) => `~ puuttuu tiedostosta ${f}`));

  /*
   * DESIGN.md kohta 8: kuva ja ääni yhdessä, eikä kumpikaan saa lukea väärin.
   * Äänen väärä lukutapa on laava tai vesi, ja ne molemmat ovat pyyhkäisyjä —
   * yksi suodin joka liukuu. Hiekka on rakeita: monta lyhyttä purskausta
   * peräkkäin. Sitä ei voi mitata korvalla testissä, mutta rakenteen voi lukea,
   * ja rakenne on juuri se päätös joka muuten kumoutuisi hiljaa.
   */
  const audio = await readFile(join(ROOT, 'src/core/audio.js'), 'utf8');
  const body = (name) => {
    const at = audio.indexOf(`\n  ${name}: () => {`);
    if (at < 0) return '';
    return audio.slice(at, audio.indexOf('\n  },', at));
  };
  const sink = body('upota');
  // Rakeita voi olla kirjoitettuna joko peräkkäisinä kutsuina tai silmukkana;
  // väite koskee niiden lukumäärää, ei kirjoitusasua.
  const loop = sink.match(/i < (\d+); i\+\+/);
  const grains = Math.max((sink.match(/noise\(/g) || []).length,
    loop && sink.includes('noise(') ? Number(loop[1]) : 0);
  report.checks.push({
    name: 'hiekan ääni on rakeita eikä pyyhkäisy, eikä se ole märkä',
    ok: grains >= 4 && !sink.includes('farty('),
    detail: sink ? `${grains} rakeista purskausta, farty: ${sink.includes('farty(') ? 'on' : 'ei'}`
      : 'ääntä upota ei ole',
  });
  if (!(grains >= 4 && !sink.includes('farty('))) {
    report.failures.push('juoksuhiekan ääni ei erotu laavasta ja vedestä rakenteeltaan');
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
