/**
 * Geometry playability check.
 *
 *   node tools/playable.mjs            all levels
 *   node tools/playable.mjs 3-F        one level
 *   node tools/playable.mjs --frames 9000
 *
 * `verify.mjs` runs a bot through every level with everything switched on, and
 * that bot dies to enemies constantly — it only knows how to run right and
 * jump. Those deaths are noise, and noise hides the signal underneath: is the
 * *terrain* passable at all?
 *
 * So this tool takes the same levels, removes every enemy and hazard, and asks
 * one question: can a player who only runs and jumps get from the start to the
 * exit? It runs at power level 0 on purpose, because that is the actual design
 * promise (DESIGN.md §5): **the ground route must be clearable at the smallest
 * size, with no power-up.** A level that fails here is broken for real, not
 * merely hard, and no amount of skill fixes it.
 *
 * Env: PW_BROWSER=/path/to/chromium  PORT=8124
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 8124);
const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--')) || null;
/*
 * Report only, unless asked otherwise. This bot is a heuristic: it runs right,
 * jumps, and that is the whole repertoire. It cannot duck, enter a pipe, kick a
 * shell or wait for a moving one — and several levels are built around exactly
 * those. Letting a heuristic fail the build would mean hand-made levels get
 * "fixed" to suit a bad bot, which is the wrong way round. --strict is for when
 * you want a gate anyway.
 *
 * **Se gate on nyt olemassa muualla, ja se on tarkoituksellisesti eri asia.**
 * 10.8.2026 alkaen `tools/verify.mjs` vaatii että jokainen kentän 60:stä on
 * läpäistävissä voimatasolla 0 — sama botti, sama moottori, kaatava portti.
 * Tämä työkalu jäi silti raportiksi, koska sen tehtävä on toinen: portti sanoo
 * *läpi vai ei*, tämä sanoo **missä sarakkeessa ja kuinka pitkälle**, ja
 * kertoo lisäksi mikä aukeaisi tuplahypyllä. Kun portti punastuu, tämä on se
 * komento jolla katsotaan miksi.
 */
const STRICT = args.includes('--strict');
const FRAMES = Number(args[args.indexOf('--frames') + 1]) || 7000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = await new Promise((resolve) => {
  const s = createServer(async (req, res) => {
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
  s.listen(PORT, '127.0.0.1', () => resolve(s));
});

let chromium;
try {
  ({ chromium } = await import(process.env.PW_MODULE || 'playwright'));
} catch {
  console.error('playwright puuttuu:  npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PW_BROWSER ? { executablePath: process.env.PW_BROWSER } : {}),
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const report = await page.evaluate(async ({ onlyId, frames }) => {
  const { LevelScene } = await import('/src/scenes/level.js');
  const { isSolid } = await import('/src/gfx/tiles.js');
  const { levelIds } = await import('/src/data/levels.js');
  const { makeClimber, isClimb } = await import('/tools/climb-bot.js');
  /* Vaakabotti on omassa moduulissaan siitä asti kun `tools/daily-origin.mjs`
   * tarvitsi saman todisteen päivän kentille. Ks. tools/level-bot.js. */
  const { runGround, blankInput: blank, makeInput: mkInput } = await import('/tools/level-bot.js');
  const budget = await (await fetch('/tools/jump-budget.json')).json();
  const game = window.sfb3;

  /*
   * Two runs per level, and the difference between them is the whole point.
   *
   *   small   power level 0, the design promise: the ground route must work
   *           with no power-up at all.
   *   double  the fart mushroom's mid-air jumps, i.e. what a player who found
   *           one power block actually has.
   *
   * A level that fails small but clears with the double jump is not broken —
   * it is demanding, and the bot is not good. A level that fails both is worth
   * opening.
   */
  /**
   * The same run, upward.
   *
   * `reach` is still a percentage and still the honest one for the shape: how
   * much of the climb was ascended, measured from the start's own row so that
   * a level which digs downward reports the same way. `stuckAt` is a row and
   * not a column, and the report says so, because "jumissa sarakkeessa 3" on a
   * level three columns from either wall is a sentence that helps nobody.
   */
  const climb = (scene, boss) => {
    const rows = scene.def.rows;
    const bot = makeClimber(scene, rows, budget);
    const input = mkInput();
    const startY = scene.player.y + scene.player.h;
    const goalY = (bot.goalPlat ? bot.goalPlat.y : 0) * 16;
    const span = Math.abs(startY - goalY) || 1;
    let bestY = startY;
    let stuckAt = null;
    let stuckFor = 0;
    let death = null;
    let finishedHere = null;
    game.finishLevel = (r) => { finishedHere = r; };

    for (let f = 0; f < frames && !finishedHere; f++) {
      const p = scene.player;
      const want = bot.step();
      input.held = blank();
      input.pressed = blank();
      input.held.left = want.left;
      input.held.right = want.right;
      input.held.jump = want.jump;
      input.pressed.jump = want.press;
      scene.update(input);

      const feet = p.y + p.h;
      if (Math.abs(feet - goalY) < Math.abs(bestY - goalY) - 4) {
        bestY = feet;
        stuckFor = 0;
      } else if (++stuckFor === 600 && stuckAt === null) {
        stuckAt = Math.floor(bestY / 16);
      }
      if (scene.state === 'dead' && !finishedHere) {
        death = { tx: Math.floor(p.cx / 16), ty: Math.floor(p.cy / 16), how: 'maasto' };
        break;
      }
    }

    return {
      cleared: !!(finishedHere && finishedHere.cleared),
      reach: Math.round((Math.abs(startY - bestY) / span) * 100),
      width: scene.w,
      height: scene.h,
      vertical: true,
      pages: scene.camPages,
      stuckAt,
      death,
      died: scene.state === 'dead',
    };
  };

  const run = (id, power) => {
    game.state = {
      lives: 9, coins: 0, score: 0, power, reserve: null,
      world: 0, node: 'w1-1', cleared: {}, worldsOpen: 1, cards: [],
    };
    let finished = null;
    game.finishLevel = (r) => { finished = r; };

    const scene = new LevelScene(game, id);
    game.scene = scene;
    // Enemies and hazards are somebody else's test. What is left is terrain.
    scene.entities = scene.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
    /* Read off the level's own flag rather than off the last letter of its id.
     * Those were the same thing for as long as bosses only lived in
     * fortresses; in world 8 every level ends in a door, and a tool that
     * guessed from the name would have reported six dead ends without
     * measuring one tile of their terrain. */
    const boss = !!scene.def.boss;
    if (boss) scene.bossDefeated = true;      // the door is the exit; the fight is not the point
    scene.time = 9999;

    /*
     * UP IS A DIRECTION, AND THIS BOT ONLY KNEW ONE.
     *
     * Everything below this branch measures "how far right did it get", and on
     * a level twenty columns wide and forty rows tall that question answers
     * itself in two seconds and means nothing: the bot walks into the wall,
     * reports 100 % reach and no exit, and a level that is perfectly sound
     * joins the failure list. "No level may join the failure list" is a hard
     * rule, so the answer cannot be an exemption — a vertical level gets a
     * proof of passability that is exactly as real as the horizontal one. Same
     * engine, same physics, same power level 0, same "did `finishLevel` fire",
     * and the only thing that changes is which way the bot is trying to go.
     *
     * The climber is in `tools/climb-bot.js` because `verify.mjs` proves it
     * against a fixture climb — the game has no vertical level yet, and a bot
     * proved only by the content it is about to bless is not proved. See there
     * for why it shares the validator's own reachability graph.
     */
    if (isClimb(scene.def)) return climb(scene, boss);

    return runGround(scene, isSolid, frames, () => finished);
  };

  const rows = [];
  for (const id of (onlyId ? [onlyId] : levelIds())) {
    const small = run(id, { type: null, level: 0 });
    rows.push({
      id,
      small,
      double: small.cleared ? null : run(id, { type: 'shroom', level: 2 }),
    });
  }
  return rows;
}, { onlyId: only, frames: FRAMES });

await browser.close();
server.close();

const pad = (s, n) => String(s).padEnd(n);
console.log('\nGeometrian läpäisytesti — ei vihollisia, ei tehostuksia, voimataso 0\n');
console.log(`  ${pad('KENTTÄ', 8)}${pad('TULOS', 10)}${pad('ETENI', 8)}JUMISSA`);
const broken = [];
const demanding = [];
for (const r of report) {
  const s = r.small;
  const d = r.double;
  const verdict = s.cleared ? 'LÄPI'
    : d && d.cleared ? 'VAATII TUPLAHYPYN'
      : s.died ? 'KUOLI' : 'JUMISSA';
  const worst = d && !d.cleared ? d : s;
  /* A climb reports rows, because a column number on a twenty-column level
   * says nothing about where the bot stopped. Same table, same verdicts, one
   * word different — and unreachable for every level in the game today. */
  const where = worst.death
    ? `${worst.death.how} ${s.vertical ? 'rivillä' : 'sarakkeessa'} ${s.vertical ? worst.death.ty : worst.death.tx}`
    : worst.stuckAt !== null
      ? `jumissa ${s.vertical ? 'rivillä' : 'sarakkeessa'} ${worst.stuckAt}` : '';
  console.log(`  ${pad(r.id, 8)}${pad(verdict, 18)}${pad(`${s.reach}%`, 7)}`
    + `${s.cleared ? '' : `${where}  (${s.vertical ? `korkeus ${s.height}` : `leveys ${s.width}`})`}`);
  if (s.cleared) continue;
  if (d && d.cleared) demanding.push(r.id);
  else broken.push(r.id);
}

console.log('');
if (demanding.length) {
  console.log(`Tuplahypyllä läpi mutta ei ilman: ${demanding.join(', ')}`);
  console.log('Nämä eivät ole rikki, mutta rikkovat lupauksen siitä että maareitin');
  console.log('pitäisi aueta pienimmällä koolla — TAI botti ei vain osaa reittiä.\n');
}
if (broken.length) {
  console.log(`EI LÄPI EDES TUPLAHYPYLLÄ: ${broken.join(', ')}`);
  console.log('Avaa nämä ensin — mutta katso kartta ennen kuin muutat mitään.');
  console.log('Botti juoksee oikealle ja hyppää. Se osaa askelman alas ja kuilun');
  console.log('astinkiven, mutta ei kyykistyä, putkea, kuoren potkua eikä odottaa.\n');
  if (STRICT) process.exit(1);
}
if (!demanding.length) console.log('Jokainen kenttä on läpäistävissä pienimmällä koolla.\n');
