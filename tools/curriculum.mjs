/**
 * Opetusjärjestyksen mittari — mitä kukin kenttä opettaa, missä järjestyksessä,
 * ja onko ensiesittely turvallinen.
 *
 *   node tools/curriculum.mjs           koko peli
 *   node tools/curriculum.mjs --raw     kenttä × ominaisuus -matriisi
 *   node tools/curriculum.mjs --json    koneluettava muoto
 *
 * This is a REPORTING tool, in the same sense `tools/difficulty.mjs` is one: it
 * reads level data and prints numbers, it writes nothing, and it is not a gate.
 * It exists to answer one question the owner is weighing — *would a curriculum
 * (every macroblock declaring what it teaches, a table saying which level
 * introduces what, and a generator forbidden from using a feature before its
 * introduction) have caught anything the hand-made levels got wrong?*
 *
 * Three questions, three sections, and every claim carries a number:
 *
 *   1. what each level actually uses, derived from the assembled grid and the
 *      level definition — never from a list somebody maintained by hand
 *   2. where each feature is first met IN PLAY ORDER, and play order is a
 *      GRAPH: world 2 forks at 2-2 into HIEKKATIE and LAAVATIE, so "first
 *      encounter" is a set of answers and not one, and a feature that lives on
 *      one branch only is a different case from one that lives on both
 *   3. whether that first encounter is safe, by a stated proxy — see TURVAPROXY
 *
 * What it deliberately does NOT do: change anything or grade a level. A level
 * that introduces two features at once is reported as such; the tool has no
 * opinion about whether that level is good.
 *
 * IT USED TO SAY "gate anything" IN THAT SENTENCE, AND SINCE 9.8.2026 IT DOES
 * NOT. The tool still writes nothing and still fails nothing — but one of its
 * three conditions, YKSIN, was promoted to an assertion in `tools/verify.mjs`,
 * which imports the exports at the bottom of this file rather than walking the
 * map a second time. The verdict this tool was built to deliver was that a full
 * curriculum system was not worth building (the last feature arrives in 5-3,
 * most levels introduce nothing new, and the generator already obeys the rule
 * 56 times out of 58); YKSIN was the one fault it found that was real,
 * repeated and cheap to fix, and it was the only thing acted on. The direction
 * matters and is worth keeping straight: the gate borrows this measurement, the
 * measurement does not borrow the gate.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getLevel } from '../src/data/levels.js';
import { RULE_CONSTANTS } from '../src/data/rules.js';
import {
  WORLDS, startNode, fortressNode, findNode, branchesOf,
} from '../src/data/worlds.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const RAW = args.includes('--raw');
const JSON_OUT = args.includes('--json');
const IS_MAIN = !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

const budget = JSON.parse(await readFile(join(ROOT, 'tools/jump-budget.json'), 'utf8'));

/*
 * ROWS and FLOOR come from `RULE_CONSTANTS` rather than being typed in again.
 * `tools/difficulty.mjs` copied them with a note that rules.js kept them
 * private; it does not any more, so the copy is no longer the cheaper option.
 * One number in one place is worth an import even in a reporting tool.
 */
const { ROWS, FLOOR, HEAD } = RULE_CONSTANTS;

/*
 * The tile characters that hold a body up. This IS a third copy of the set that
 * lives in `src/data/rules.js` and `tools/difficulty.mjs`, and the reason is the
 * one difficulty.mjs already gave: rules.js keeps its own copy private, and
 * exporting it would widen a validator's surface for the sake of a tool that
 * only prints things. If a fourth copy ever appears, that is the moment to move
 * the set into `src/gfx/tiles.js` where `TILE_INFO` already knows the answer.
 *
 * `'C'` — möykky — is in it for the same reason rules.js has it: **it is solid
 * in the level's starting state**, and the starting state is what every grid
 * this file reads is written in. The one detector that would have got it wrong
 * is `pound`, which asks whether a body can stand somewhere: a möykky left out
 * of the set is a ledge the tool cannot see and a ceiling it will not count.
 */
const SOLID = new Set(['#', 'X', 'B', '?', '!', '*', 'u', 'N', '[', ']', '{', '}', '%', '(', ')', 'S', 'C', 'I', 'J']);
const SEMI = new Set(['-']);

/**
 * One 320x240 screen is 20 tiles wide and 15 tall — the canvas size in
 * index.html divided by `TILE`. It is also exactly one band, which is why the
 * chunk vocabulary is 15 rows: the room the player can see at once.
 *
 * It is the unit the "two things at once" test is measured in, because the
 * question is not how far apart two introductions are in the file but whether
 * they are *on screen together*.
 */
const SCREEN_COLS = 20;

/**
 * How much clear ground the introduction is measured to need in front of it,
 * in tiles.
 *
 * This is not taste and it is not rounded up from a feeling: `PHYSICS.md`'s
 * reaction budget, measured by `tools/measure-braking.mjs`, says a POWER-0
 * player at running speed needs **56 px** to stop after letting go of the
 * button — the worst case of the three power-0 rows (28 / 56 / 155 px at walk /
 * run / P-speed), P-speed excluded because P-speed is a state the player asked
 * for and PHYSICS.md says so in as many words. 56 px is 3.5 tiles, so four.
 *
 * The number is written here rather than read from a file because
 * `measure-braking.mjs` deliberately writes nothing — "it is a measurement, not
 * an input to generation". So it is quoted with its source, the same way
 * `WEIGHTS` in difficulty.mjs quotes frozen references, and it is wrong the day
 * the physics change and PHYSICS.md is re-measured.
 */
const APPROACH_TILES = 4;

/** How far past the feature the window still counts. Two tiles: the landing. */
const FOLLOW_TILES = 2;

/* ========================= what counts as a feature ======================= */

/*
 * THE FEATURE LIST, AND WHAT IS NOT ON IT.
 *
 * Everything here is derived from code, not from memory: a tile feature is a
 * character in `T` (src/gfx/tiles.js) that the engine gives a behaviour to, an
 * enemy is a key of `ENEMY_CHARS` (src/entities/enemies.js), and the two
 * non-grid entries below name the thing in the level *definition* that turns
 * them on. The brief's list was used as a checklist and every item on it is
 * either measured here or listed under LEFT OUT with the reason.
 *
 * The main table is the mechanics a curriculum would plausibly want to
 * schedule. The `core: true` ones are the genre's baseline vocabulary — the
 * things the first screen of the first level is made of — and they are measured
 * identically but kept out of the headline counts, because "1-1 introduces the
 * coin and the walker in the same level" is not a teaching failure, it is what
 * a first level is.
 *
 * LEFT OUT, and why:
 *
 *   - **moving platforms.** They do not exist. There is no moving-platform
 *     class in `src/entities/`, no tile in `T` with movement, and grepping the
 *     whole of `src/` for the concept returns one comment about crumbling
 *     platforms. A curriculum entry for a mechanic the engine does not have
 *     would be a row of zeroes pretending to be a measurement.
 *   - **the bubble trap.** It is real (`Enemy.bubbled`, `hitByProjectile`) but
 *     it is not a property of any level: it is what the player's own fart ball
 *     does, and the ball comes from a power-up. `LevelScene.rollPowerup` hands
 *     out `flower` on a 0.24 roll and only once the player is already above
 *     power 0, so WHERE a player first sees a bubble is a random variable, not
 *     a place on the map. That is the finding rather than an omission: a
 *     curriculum table cannot schedule the introduction of a mechanic whose
 *     introduction is a dice roll, and this is the one mechanic in the brief's
 *     list that is in that position.
 *   - **the ground pound itself.** Down + jump works from the first frame of
 *     1-1 and needs nothing from the level, so it has no introduction to
 *     schedule. What a level CAN offer is a *place to use it*, and that is
 *     measurable, so it is in the table as `maahaniskun paikka` with the
 *     geometry spelled out at its detector.
 */

/**
 * Enemy markers, straight off `ENEMY_CHARS` in src/entities/enemies.js.
 *
 * "Straight off" is a copy and copies go stale, and this table is where one
 * did. `U`, the kurnuttaja, shipped the same day this tool did and neither
 * knew about the other, so for one release the measurement below had a hole
 * in it: the game's newest enemy was the one species the curriculum could not
 * see. The row was added on 10.8.2026 and it is an ordinary row — the two
 * failures it uncovered are fixed in the levels rather than excused here (see
 * `levels/world2.js`), because a table with an exception in it measures the
 * exception and not the game.
 *
 * `tools/verify.mjs` has a check for exactly this shape of staleness on the
 * difficulty meter — "jokaisella vihollismerkillä on hinta vaikeusmittarissa" —
 * and the same one over this table is now cheap: it would pass on the day it
 * lands, which is the one thing that was true of neither of the two days
 * before this one. It is the obvious next thing and it is named here rather
 * than written, because it belongs in the gate and not in the measurement.
 */
const ENEMY_NAMES = {
  g: 'kävelijä',
  k: 'kuoriukko',
  f: 'lentäjä',
  p: 'putkikasvi',
  r: 'ruskea pilvi',
  c: 'ummetuskorkki',
  x: 'piikkiukko',
  A: 'vihainen aurinko',
  H: 'närästysliekki',
  O: 'kuu',
  P: 'papuparooni',
  b: 'linnakepomo',
  U: 'kurnuttaja',
  T: 'törähdystorvi',
  Z: 'paarma',
  Y: 'yökki',
  m: 'paukkupöhö',
};

/**
 * The enemies that ARE the hazard, in the sense POHJA means it.
 *
 * `hazard` changes one thing: the footing test stops at the feature's own
 * columns instead of running through them (see TURVAPROXY). For a tile that is
 * lava or spikes that is obvious. For an enemy it is a claim about where the
 * marker is allowed to stand, and exactly one enemy makes it: `ENEMY_CHARS`
 * specifies the kurnuttaja's marker as "the first floor row of the chunk, in a
 * column where that row is empty" — the creature lives in the hole, so its own
 * column has no floor by definition, and measuring one would fail every pit
 * that has ever had something in it for being a pit.
 *
 * It does not weaken the test where it counts. The approach is still measured
 * in full, and the approach is where a player has to be able to stop.
 */
const ENEMY_HAZARD = new Set(['U']);

/**
 * A feature, as this tool models one.
 *
 *   key      short id, used in --json and --raw
 *   name     what the table prints
 *   chars    the grid characters that ARE it, when it is a grid thing
 *   where    optional filter on the level: theme, band, definition flags
 *   hazard   true when the feature IS the danger, which changes the footing
 *            test — see TURVAPROXY
 *   core     baseline vocabulary, measured but out of the headline counts
 *   find     overrides `chars` entirely, for the three features that are not a
 *            character in the grid
 *   own      the characters that ARE the feature, for the company test, when
 *            `chars` is not the whole story
 *   same     another feature this one is physically the same object as. Two
 *            rows in the table, one thing in the room — the crowding tests skip
 *            such a pair, because a level cannot introduce the baron without
 *            introducing what the baron drops.
 */
const FEATURES = [
  /* ---------------------------- the mechanics --------------------------- */
  { key: 'star', name: 'supertähti (tähtilohko)', chars: '*' },
  { key: 'switch', name: 'kytkinruutu', chars: 'S' },
  { key: 'crumble', name: 'mureneva lava', chars: '%' },
  /* PONNAHDUSLAUTA. Rivi tähän tauluun on osa laatan lisäämistä eikä
   * jälkityötä: tämä työkalu on se joka valvoo ettei yksikään kenttä esittele
   * kolmea uutta asiaa kerralla eikä kahta samassa ruudussa, ja taulusta
   * puuttuva laatta on laatta jonka esittelyä mikään ei katso. Sama vika
   * tehtiin kerran kurnuttajalla — ks. `ENEMY_NAMES`in kommentti. */
  { key: 'spring', name: 'ponnahduslauta', chars: 'J' },
  /*
   * MÖYKKY, se yksi laatta joka tottelee painovoimaa (`T.LUMP`).
   *
   * **Ei `hazard: true`, ja se on väite eikä unohdus.** `hazard` löysentää
   * POHJAa: se lakkaa mittaamasta ominaisuuden omia sarakkeita, koska laavassa
   * seisominen *on* se ominaisuus eikä yllätys lattiasta. Möykky on
   * lähtötilassa kiinteä laatta jonka päällä seisotaan, ja se satuttaa vasta
   * kun pelaaja on itse rikkonut sen tuen (`LevelScene.lumpImpact`,
   * `CHANGELOG` v26.08.10.64: "vain pelaajan aloittama ketju saa satuttaa
   * häntä"). Merkitseminen vaaraksi antaisi sille anteeksi juuri sen mitä
   * ensiesittelyltä pitää vaatia — että alla on lattia jolle astua sivuun.
   *
   * Merkki on myös perussanaston ulkopuolella (`core` pois), koska se on
   * mekaniikka eikä aakkonen: se on pelin ensimmäinen laatta joka liikkuu.
   */
  { key: 'lump', name: 'möykky (putoava laatta)', chars: 'C' },
  /*
   * JÄÄ (`T.ICE`).
   *
   * **Ei `hazard: true`, ja se on sama väite kuin möykyllä mutta vahvempi.**
   * `hazard` löysentää POHJAa — se lakkaa vaatimasta lattiaa ominaisuuden omilta
   * sarakkeilta, koska laavassa seisominen *on* se ominaisuus. Jäällä
   * seisominen ei satuta lainkaan: jää on tavallinen kiinteä laatta jonka päällä
   * voi olla loputtomiin. Vaaraksi merkitseminen antaisi anteeksi juuri sen mitä
   * ensiesittelyltä on vaadittava — että alla ja ympärillä on maata jolle
   * liukua, eikä kuilua.
   *
   * Perussanaston ulkopuolella (`core` pois) samasta syystä kuin möykky: se on
   * mekaniikka eikä aakkonen. Se on pelin ensimmäinen laatta joka muuttaa sitä
   * mitä pelaaja *pystyy* tekemään sen sijaan että muuttaisi sitä missä hän voi
   * seistä.
   */
  { key: 'ice', name: 'jää (liukas laatta)', chars: 'I' },
  { key: 'vine', name: 'pavunvarsi', chars: 'v' },
  { key: 'warp', name: 'warp-putki', chars: '()' },
  { key: 'note', name: 'nuottipalikka', chars: 'N' },
  { key: 'semi', name: 'puulava (läpi alhaalta)', chars: '-' },
  { key: 'spike', name: 'piikkirivi', chars: '^', hazard: true },
  /*
   * Lava and the glacier are the same character and the same death; only the
   * picture differs (`drawTile` swaps in `drawCrevasse` when the theme is ice,
   * "because lava in a glacier is a joke the level did not intend"). They are
   * two rows here rather than one because a curriculum is about what the player
   * has to RECOGNISE, and a blue-white hole in the ice is a thing to recognise
   * even for somebody who has already learned the orange one.
   */
  { key: 'lava', name: 'laava', chars: 'W', theme: (t) => t !== 'ice', hazard: true },
  { key: 'glacier', name: 'jäätikkö (halkeama)', chars: 'W', theme: (t) => t === 'ice', hazard: true },
  /*
   * The breaking power-up has exactly one source in the game — the pair of
   * barons in 2-M, and `POWER_TYPES` in player.js says so in as many words: no
   * question block, no secret brick and no moon can ever roll it. So its
   * marker is the baron's, and `same` records that this row and the baron's row
   * are one object seen twice.
   */
  { key: 'break', name: 'PAUKKUPAPU (murtava)', chars: 'P', same: 'enemy_P' },

  /* --------------------------- enemy species ---------------------------- */
  ...Object.entries(ENEMY_NAMES).map(([ch, name]) => ({
    key: `enemy_${ch}`, name: `vihu: ${name}`, chars: ch, enemy: true,
    hazard: ENEMY_HAZARD.has(ch),
  })),

  /* ------------------ the two that are not in the grid ------------------ */
  {
    key: 'bands',
    name: 'piilokaista (bonushuone)',
    /*
     * A tall level IS the feature: `assembleTall` stacks sky, route and cave,
     * and `getLevel` sets `bands` when the result is taller than one band. The
     * position reported is the leftmost column of the hidden room itself, so
     * the "two things on one screen" test compares it against the beanstalk or
     * warp pipe that leads to it — which is exactly the pairing worth seeing.
     *
     * The `W` lid `assembleTall` welds under every bottomless column is not
     * content and is skipped: it is the bottom of a pit the player already had,
     * not a room somebody built.
     */
    find(level) {
      if (!level.bands) return [];
      const out = [];
      const bands = bandCount(level);
      for (let b = 0; b < bands; b++) {
        if (b === routeBandIndex(level)) continue;
        for (let y = 0; y < ROWS; y++) {
          const row = level.rows[b * ROWS + y];
          for (let x = 0; x < row.length; x++) {
            if (row[x] !== ' ' && row[x] !== 'W') out.push({ x, y, band: b });
          }
        }
      }
      return out;
    },
  },
  {
    key: 'bosscycle',
    name: 'pomon piikkisykli',
    own: 'b',
    same: 'enemy_b',
    /*
     * Every `Boss` runs `updateSpikes`, whatever its `variant` — the cycle is in
     * the base class and the variant only picks a move set — so the feature is
     * introduced by the first boss, full stop. It is reported at the boss
     * marker's own column so the safety test measures the arena floor.
     */
    find(level) {
      if (!level.boss) return [];
      return cells(level, (ch) => ch === 'b');
    },
  },
  {
    key: 'pound',
    name: 'maahaniskun paikka',
    /* The enemy under the ledge is half of what the feature IS, so it is not
     * "company" in the sense the safety proxy means. Every enemy marker is
     * therefore the feature's own. */
    own: Object.keys(ENEMY_NAMES).join(''),
    /*
     * MAAHANISKUN PAIKKA, spelled out because the whole entry stands on it.
     *
     * The move works everywhere; what a level can give it is HEIGHT. From
     * `LevelScene.poundImpact` the impact kills at `POUND_KILL_AT = 0.5`, and
     * `poundScale(fromY, toY) = (toY - fromY) / toY` measures both ends as the
     * TOP of the body, so the player's height cancels out. Landing on the floor
     * at row 13 at power 0 (12x16, `PLAYER_SIZES[0]`) puts toY at 13·16 − 16 =
     * 192 px, so strength ≥ 0.5 needs fromY ≤ 96 px — a body standing on a
     * surface whose own row is at 96/16 + 1 = **row 7 or higher**.
     *
     * So: a standable tile at row ≤ 7, with a stompable enemy standing on the
     * floor within `POUND_REACH` (30 px, so two tiles) of it. Spiny things are
     * excluded because `poundImpact` skips `e.spiky` outright — a pound onto a
     * spiky walker is not a weaker answer, it is no answer.
     *
     * A CEILING IS NOT A LEDGE, and that is the one correction this detector
     * needed: every fortress chunk is roofed with two rows of ground, so the
     * first version happily reported the roof of 1-F as somewhere to dive from.
     * A surface only counts when a body can stand on it — `HEAD` clear rows
     * above it, the same three rows `rules.js` measures a body with — and when
     * it is at least HEAD rows down from the top of the band, because a slab in
     * the top three rows is what a level is roofed with and not what it is
     * furnished with.
     *
     * This is the loosest detector in the file and it is worth saying so: it
     * cannot tell whether the player can actually get up there, and it does not
     * try. What it measures is whether the SHAPE the move wants is present.
     */
    find(level) {
      const out = [];
      const b = routeBandIndex(level);
      const top = b * ROWS;
      const at = (x, y) => cellAt(level, x, top + y);
      const w = level.rows[0].length;
      for (let x = 0; x < w; x++) {
        for (let y = HEAD; y <= 7; y++) {
          const ch = at(x, y);
          if (!SOLID.has(ch) && !SEMI.has(ch)) continue;
          let room = true;
          for (let h = 1; h <= HEAD; h++) if (SOLID.has(at(x, y - h))) room = false;
          if (!room) continue;
          let found = false;
          for (let dx = -2; dx <= 2 && !found; dx++) {
            const e = at(x + dx, FLOOR - 1);
            if (e && ENEMY_NAMES[e] && e !== 'x' && e !== 'b') found = true;
          }
          if (found) out.push({ x, y, band: b });
        }
      }
      return out;
    },
  },

  /* --------------------------- core vocabulary -------------------------- */
  { key: 'ground', name: 'maa / kova laatta', chars: '#X', core: true },
  { key: 'brick', name: 'tiili (rikottava)', chars: 'B', core: true },
  { key: 'qblock', name: 'kolikkolohko', chars: '?', core: true },
  { key: 'pblock', name: 'tehostuslohko', chars: '!', core: true },
  { key: 'coin', name: 'kolikko', chars: 'o', core: true },
  /*
   * The ordinary pipe is core vocabulary and still worth measuring separately,
   * because the warp pipe's entire discoverability rests on it: `secrets.js`
   * says the warp is "an ordinary-looking pipe" and `common.js` says the plain
   * one carries the same three coins so the hint is about pipes and not about
   * one pipe. That makes "does the ordinary pipe come first, on every branch"
   * a question a curriculum would have to answer, so it gets its own row.
   */
  { key: 'pipe', name: 'putki (tavallinen)', chars: '[]{}', core: true },
  { key: 'goal', name: 'maalitolppa', chars: 'F', core: true },
  { key: 'door', name: 'linnakkeen ovi', chars: 'D', core: true },
];

/* ============================== grid reading ============================== */

const bandCount = (level) => Math.max(1, Math.floor(level.rows.length / ROWS));

/**
 * Which band is the route. Same sentence as `routeIndexOf` in rules.js and for
 * the same reason: the route is the band the player starts in, which is the
 * design promise itself rather than a position somebody agreed on.
 */
function routeBandIndex(level) {
  if (level.rows.length <= ROWS) return 0;
  const start = level.rows.findIndex((row) => row.includes('1'));
  return Math.max(0, Math.floor(start / ROWS));
}

function cellAt(level, x, y) {
  const row = level.rows[y];
  if (!row || x < 0 || x >= row.length) return ' ';
  return row[x];
}

/** Every {x, y, band} whose character passes `test`. */
function cells(level, test) {
  const out = [];
  const lidBand = bandCount(level) - 1;
  for (let y = 0; y < level.rows.length; y++) {
    const row = level.rows[y];
    const band = Math.floor(y / ROWS);
    for (let x = 0; x < row.length; x++) {
      /*
       * The lava lid. `assembleTall` welds a row of `W` under every bottomless
       * column of the route band, so a tall level "contains lava" the moment it
       * contains a pit. Counting it would say 1-2 introduces lava, which is a
       * statement about a tile nobody is ever shown rather than about the
       * level. The lid is exactly row 0 of the last band, so it is skipped
       * exactly there and nowhere else.
       */
      if (row[x] === 'W' && band === lidBand && band > 0 && y % ROWS === 0) continue;
      if (test(row[x], x, y)) out.push({ x, y: y % ROWS, band });
    }
  }
  return out;
}

/** Occurrences of a feature in a level, leftmost first. */
function occurrences(feature, level) {
  const found = feature.find
    ? feature.find(level)
    : cells(level, (ch) => feature.chars.includes(ch));
  if (feature.theme && !feature.theme(level.theme)) return [];
  return found.sort((a, b) => a.x - b.x || a.y - b.y);
}

/**
 * The first INSTANCE of a feature: the leftmost occurrence and every column of
 * the unbroken run it belongs to. A two-tile pipe mouth, a six-tile lava trench
 * and a one-tile beanstalk are all one instance, which is what the player meets.
 *
 * The run is capped at one screen. Without the cap a feature that occurs in
 * nearly every column — the ground itself is the honest example — reports an
 * "instance" three hundred tiles long, and the safety window then spans the
 * whole level and measures nothing. One screen is the most a player can meet at
 * once, so it is the most an instance can be.
 */
function firstInstance(feature, level) {
  const occ = occurrences(feature, level);
  if (!occ.length) return null;
  /* Same band only. A run that crossed a seam would be two rooms fifteen rows
   * apart reported as one thing, and the safety window would then be measured
   * against the floor of whichever band happened to come first. */
  const band = occ[0].band;
  const here = occ.filter((o) => o.band === band);
  const cols = new Set(here.map((o) => o.x));
  const x0 = here[0].x;
  let x1 = x0;
  while (cols.has(x1 + 1) && x1 - x0 + 1 < SCREEN_COLS) x1++;
  const mine = here.filter((o) => o.x >= x0 && o.x <= x1);
  return {
    x0,
    x1,
    band,
    /* The lowest row the instance reaches, which is how "on the ground route"
     * is decided: something whose bottom row is the row enemies stand on (or
     * below it, which is how a lava slab is written) is in the way. */
    bottom: Math.max(...mine.map((o) => o.y)),
    count: occ.length,
  };
}

/* ============================== TURVAPROXY =============================== */

/**
 * TURVAPROXY — the definition, stated plainly, because the number this tool
 * prints is only worth as much as this paragraph.
 *
 * The question is: **on the first encounter, can this feature kill a power-0
 * player who does not yet know what it is?** Not "is it hard" and not "is it
 * fair" — can meeting it wrong cost a LIFE rather than a power level. That
 * distinction is the one the engine actually makes: a hit at power ≥ 1 costs a
 * size, a pit costs the run.
 *
 * A first encounter is SAFE when all three of these hold. Each is reported
 * separately, so a failure says which part failed and not merely that it did.
 *
 *   POHJA  — the ground under the encounter window holds. Every column of
 *            [x0 − 4, x1 + 2] has standable, non-lethal footing on the floor
 *            rows. Four is the measured power-0 braking distance (see
 *            APPROACH_TILES); two is the landing. FAIL means the player is
 *            learning the new thing while also over a hole, so one mistake is a
 *            death and not a lesson.
 *            For a feature that IS the hazard — lava, the glacier, spikes, and
 *            the one enemy whose marker is specified to stand in a floorless
 *            column (see ENEMY_HAZARD) — only the approach columns are
 *            measured, because standing in lava is the feature and not a
 *            surprise about the floor. The approach is still measured whole,
 *            and that is the half that decides whether a player can stop.
 *
 *   SEURA  — nothing else is asking for attention. No other enemy species and
 *            no hazard tile inside the same window. Another copy of the SAME
 *            enemy does not count: two walkers are one lesson.
 *
 *   YKSIN  — no other feature's first encounter within one screen
 *            (SCREEN_COLS = 20 tiles) in the same level and the same band. FAIL
 *            means the level introduces two new things where the player can see
 *            both at once, which is the definition of teaching neither.
 *            **This is the one of the three that `tools/verify.mjs` asserts**,
 *            and it is asserted on `earliest` — the worst case, the first level
 *            in which anybody can meet the thing — because `guaranteed` would
 *            excuse a crowded screen on one branch on the strength of what the
 *            other branch taught. It failed 6 first encounters out of 26 on the
 *            day it was promoted, in three pairs: vine/pipe plant in 1-2, star/
 *            cork guy in 1-3, crumbling floor/moon in 2-N.
 *
 * What this proxy CANNOT see, and it matters: it does not know whether a
 * feature can be walked past, it does not know the player's speed on arrival,
 * and it has never played the game. It is a shape test on a grid. A proxy you
 * can compute beats a definition you cannot — but it is a proxy, and a feature
 * it calls unsafe is a place to go and look, not a verdict.
 */
function safety(feature, level, inst, otherFirsts) {
  const b = inst.band;
  const top = b * ROWS;
  const w = level.rows[0].length;
  const at = (x, y) => cellAt(level, x, top + y);

  const stands = (x) => {
    const a = at(x, FLOOR);
    const c = at(x, FLOOR + 1);
    return (SOLID.has(a) && a !== '%') || (SOLID.has(c) && c !== '%') || SEMI.has(a) || SEMI.has(c);
  };
  /* Same rule as difficulty.mjs: a column is lethal if standing in it kills —
   * no floor at all, or lava where the floor should be. The two tools have to
   * agree on this or they are measuring different levels. */
  const lethal = (x) => at(x, FLOOR) === 'W'
    || (!SOLID.has(at(x, FLOOR)) && at(x, FLOOR + 1) === 'W');

  const from = Math.max(0, inst.x0 - APPROACH_TILES);
  const to = Math.min(w - 1, inst.x1 + FOLLOW_TILES);
  /* A hazard's own columns are the hazard. Measuring "is there a hole under the
   * lava" would fail every lava trench in the game for being a lava trench. */
  const footFrom = from;
  const footTo = feature.hazard ? Math.min(to, inst.x0 - 1) : to;

  /*
   * A hidden band is exempt from the footing test rather than passed by it.
   * The floor of a bonus room is a different question — walking off the edge of
   * `sky_garden` is the documented way OUT of it (world2.js measures the drift:
   * 18 tiles right, 12 left), so a missing floor up there is not a pit. The
   * three-band geometry is `src/data/rules.js`'s job and it already checks it.
   */
  const hidden = b !== routeBandIndex(level);

  let pohja = true;
  if (!hidden) {
    for (let x = footFrom; x <= footTo; x++) if (!stands(x) || lethal(x)) pohja = false;
  }

  let seura = true;
  const own = new Set(`${feature.own || feature.chars || ''}`.split(''));
  for (let x = from; x <= to; x++) {
    for (let y = 0; y < ROWS; y++) {
      const ch = at(x, y);
      if (own.has(ch)) continue;
      if (ENEMY_NAMES[ch] || ch === '^' || ch === 'W') seura = false;
    }
  }

  let yksin = true;
  for (const other of otherFirsts) {
    if (other.key === feature.key || other.key === feature.same) continue;
    if (other.same === feature.key || other.band !== b) continue;
    if (Math.abs(other.x0 - inst.x0) < SCREEN_COLS) yksin = false;
  }

  return {
    pohja, seura, yksin, hidden, safe: pohja && seura && yksin,
  };
}

/** `same` read from both ends, so it does not matter which row comes first. */
const PARTNER = new Map();
for (const f of FEATURES) {
  if (!f.same) continue;
  PARTNER.set(f.key, f.same);
  PARTNER.set(f.same, f.key);
}

/* ============================== the map graph ============================= */

/**
 * Every route through a world, as an ordered list of level ids.
 *
 * This walks the same graph `worldProblems` walks and by the same rules: links
 * are directed a→b, a route ends at the fortress, and a node that cannot reach
 * the fortress is not on a route. Houses are walked through — world 3's way to
 * 3-3 runs through one — and contribute no level, exactly as in `tiersOf`.
 *
 * It is written as an enumeration rather than a single walk because that is the
 * whole point of question 2: a branching map has more than one play order, and
 * a tool that picks one of them is answering a question nobody asked.
 */
function routesOf(world) {
  const start = startNode(world);
  const fort = fortressNode(world);
  if (!start || !fort) return [];
  const out = [];
  const walk = (id, seen, nodes) => {
    if (id === fort.id) { out.push([...nodes, id]); return; }
    for (const l of world.links) {
      if (l.a !== id || seen.has(l.b)) continue;
      walk(l.b, new Set([...seen, l.b]), [...nodes, id]);
    }
  };
  walk(start.id, new Set([start.id]), []);
  return out.map((nodes) => ({
    nodes,
    levels: nodes.map((id) => (findNode(world, id) || {}).level).filter(Boolean),
    /* What the map calls this way round: the declared branch route whose own
     * nodes this path contains. A world with no fork has one route and no name,
     * and printing "PÄÄREITTI" for it is clearer than printing nothing. */
    name: (branchesOf(world).flatMap((br) => br.routes)
      .find((r) => r.via.every((id) => nodes.includes(id))) || {}).name || null,
  }));
}

/**
 * Every distinct play order through the whole game: the cartesian product of
 * the worlds' routes, in world order. Two, at the time of writing, because
 * world 2 is the only world that forks.
 */
function playthroughs() {
  let paths = [{ labels: [], levels: [] }];
  for (const world of WORLDS) {
    const routes = routesOf(world);
    const next = [];
    for (const p of paths) {
      for (const r of routes) {
        next.push({
          labels: r.name ? [...p.labels, r.name] : p.labels,
          levels: [...p.levels, ...r.levels],
        });
      }
    }
    paths = next;
  }
  return paths.map((p) => ({ ...p, label: p.labels.join(' + ') || 'PÄÄREITTI' }));
}

/* ================================ measure ================================ */

const PATHS = playthroughs();
/**
 * Every level anybody can play, in play order. "In play order" needs deciding
 * when the map branches: a level on one branch has no position on the other, so
 * the order used here is the earliest position it has on ANY route. That puts
 * 2-3 and 2-M where a player who takes the lava road meets them instead of at
 * the end of the list, which is where a plain de-duplication leaves them.
 */
const LEVEL_ORDER = (id) => Math.min(...PATHS.map((p) => {
  const i = p.levels.indexOf(id);
  return i < 0 ? Infinity : i;
}));
const LEVEL_IDS = [...new Set(PATHS.flatMap((p) => p.levels))]
  .sort((a, b) => LEVEL_ORDER(a) - LEVEL_ORDER(b) || a.localeCompare(b));
const LEVELS = new Map(LEVEL_IDS.map((id) => [id, getLevel(id)]));

/** level id → { featureKey: instance } for every feature the level contains. */
const USES = new Map();
for (const [id, level] of LEVELS) {
  const row = {};
  for (const f of FEATURES) {
    const inst = firstInstance(f, level);
    if (inst) row[f.key] = inst;
  }
  USES.set(id, row);
}

/**
 * Where each feature is first met, per play order. The result deliberately
 * keeps all of the answers rather than collapsing them:
 *
 *   firsts     [{ path, level }] for every play order that meets it at all
 *   everywhere true when every play order meets it
 *   earliest   the level a player can meet it in first — the one the safety
 *              proxy is measured against, because it is the worst case
 *   guaranteed the level by which EVERY play order has met it, which is what a
 *              curriculum table would actually have to promise
 */
function firstEncounters(feature) {
  const firsts = [];
  for (const path of PATHS) {
    const hit = path.levels.find((id) => USES.get(id)[feature.key]);
    if (hit) firsts.push({ path: path.label, level: hit });
  }
  if (!firsts.length) return null;
  const rank = (id) => Math.min(...PATHS.map((p) => {
    const i = p.levels.indexOf(id);
    return i < 0 ? Infinity : i;
  }));
  const byRank = [...firsts].sort((a, b) => rank(a.level) - rank(b.level));
  return {
    firsts,
    everywhere: firsts.length === PATHS.length,
    earliest: byRank[0].level,
    guaranteed: byRank[byRank.length - 1].level,
    branchOnly: firsts.length < PATHS.length,
    split: new Set(firsts.map((f) => f.level)).size > 1,
  };
}

/*
 * Every feature's first-encounter instance, so the "two on one screen" test has
 * something to compare against. Built per level: what matters is which
 * introductions land in the same level, not which exist in the game.
 *
 * The core vocabulary is deliberately NOT in this list, so it cannot make
 * anything else fail YKSIN. Otherwise every feature in 1-1 would fail against
 * the coin and the question block, which is true and useless: the first screen
 * of the first level introduces the alphabet, and no curriculum can schedule
 * that away.
 */
const FIRST_IN_LEVEL = new Map(LEVEL_IDS.map((id) => [id, []]));
const ROWS_OUT = [];
for (const f of FEATURES) {
  const enc = firstEncounters(f);
  if (!enc) { ROWS_OUT.push({ feature: f, enc: null }); continue; }
  const inst = USES.get(enc.earliest)[f.key];
  if (!f.core) FIRST_IN_LEVEL.get(enc.earliest).push({ key: f.key, same: f.same, ...inst });
  ROWS_OUT.push({ feature: f, enc, inst });
}
for (const r of ROWS_OUT) {
  if (!r.enc) continue;
  r.safety = safety(r.feature, LEVELS.get(r.enc.earliest), r.inst,
    FIRST_IN_LEVEL.get(r.enc.earliest));
}

/**
 * Features whose first encounter is in this level, main list only, and with
 * `same` pairs collapsed to one entry. 2-M introduces the baron and the thing
 * the baron drops; that is one new thing in the room and counting it as two
 * would inflate the very number this tool exists to report.
 */
function introducedIn(id) {
  const here = ROWS_OUT.filter((r) => r.enc && r.enc.earliest === id && !r.feature.core);
  const seen = new Set();
  return here.filter((r) => {
    if (seen.has(r.feature.key)) return false;
    seen.add(r.feature.key);
    const twin = PARTNER.get(r.feature.key);
    if (twin) seen.add(twin);
    return true;
  });
}

const MAIN = ROWS_OUT.filter((r) => !r.feature.core);
const CORE = ROWS_OUT.filter((r) => r.feature.core);
const MISSING = ROWS_OUT.filter((r) => !r.enc);
const UNSAFE = MAIN.filter((r) => r.enc && !r.safety.safe);
const INTRO = LEVEL_IDS.map((id) => ({ id, features: introducedIn(id) }));
const CROWDED = INTRO.filter((l) => l.features.length >= 2);
const QUIET = INTRO.filter((l) => !l.features.length);

/**
 * The last level on each play order that introduces anything at all, and how
 * much of the game comes after it. This is the number the whole curriculum
 * question turns on: a rule that says "the generator may not use a feature
 * before its introduction" only constrains the levels that come BEFORE the
 * table runs out.
 */
const LAST_INTRO = PATHS.map((p) => {
  const idx = p.levels.map((id, i) => (introducedIn(id).length ? i : -1))
    .filter((i) => i >= 0);
  const last = idx.length ? idx[idx.length - 1] : -1;
  return {
    path: p.label,
    level: last >= 0 ? p.levels[last] : null,
    after: p.levels.length - last - 1,
    total: p.levels.length,
  };
});

/**
 * The generated world, measured against the curriculum rule it would be the
 * first customer of: how many features do 5-1…5-3 use, and how many of those
 * were introduced earlier on the same play order?
 */
const GENERATED = ['5-1', '5-2', '5-3'].filter((id) => LEVELS.has(id));
const GEN_CHECK = (() => {
  let uses = 0;
  let ok = 0;
  const early = [];
  for (const path of PATHS) {
    for (const id of GENERATED) {
      const at = path.levels.indexOf(id);
      if (at < 0) continue;
      for (const r of MAIN) {
        if (!USES.get(id)[r.feature.key]) continue;
        uses++;
        const before = path.levels.slice(0, at).some((prev) => USES.get(prev)[r.feature.key]);
        if (before) ok++;
        else {
          /* Not "used too early" but "introduced by the generator": there is no
           * earlier occurrence anywhere, so the generated level is the first
           * place in the game the thing exists. That is precisely the case a
           * curriculum rule is for, so it is named rather than counted. */
          early.push(`${path.label}: ${id} esittelee itse — ${r.feature.key} `
            + '(ei aiempaa esiintymää koko pelissä)');
        }
      }
    }
  }
  return { uses, ok, early };
})();

/**
 * The two prerequisites the CODE ITSELF states, checked rather than assumed.
 * Neither is invented here: both are written down in the file that owns the
 * feature, which is what makes them the right two to test.
 *
 *   putki → warp   `chunks/secrets.js`: the warp is "an ordinary-looking pipe",
 *                  and `common.js` gives the plain pipe the same three coins so
 *                  the hint is about pipes and never about one pipe. A warp met
 *                  before any ordinary pipe would be a signpost, not a secret.
 *   tiili → break  `player.js`: PAUKKUPAPU breaks the brick and only the brick,
 *                  and 2-M points it at a brick wall while the player still has
 *                  it. A breaking power-up met before any brick breaks nothing.
 */
const PREREQS = [
  { before: 'pipe', after: 'warp', why: 'warp on tavallisen putken näköinen' },
  { before: 'brick', after: 'break', why: 'murtava voima rikkoo vain tiilen' },
].map((p) => {
  const a = ROWS_OUT.find((r) => r.feature.key === p.before);
  const b = ROWS_OUT.find((r) => r.feature.key === p.after);
  const held = PATHS.every((path) => {
    const ia = path.levels.findIndex((id) => USES.get(id)[p.before]);
    const ib = path.levels.findIndex((id) => USES.get(id)[p.after]);
    return ib < 0 || (ia >= 0 && ia <= ib);
  });
  return {
    ...p, held, first: a && a.enc ? a.enc.earliest : '—', then: b && b.enc ? b.enc.earliest : '—',
  };
});

/* ================================ output ================================= */

function json() {
  return {
    paths: PATHS.map((p) => ({ label: p.label, levels: p.levels })),
    features: ROWS_OUT.map((r) => ({
      key: r.feature.key,
      name: r.feature.name,
      core: !!r.feature.core,
      first: r.enc ? r.enc.earliest : null,
      guaranteed: r.enc ? r.enc.guaranteed : null,
      branchOnly: r.enc ? r.enc.branchOnly : null,
      on: r.enc ? r.enc.firsts : [],
      at: r.inst ? { x0: r.inst.x0, x1: r.inst.x1, band: r.inst.band } : null,
      safety: r.safety || null,
    })),
    crowded: CROWDED.map((l) => ({ id: l.id, features: l.features.map((f) => f.feature.key) })),
    lastIntro: LAST_INTRO,
    generated: GEN_CHECK,
    prereqs: PREREQS,
    counts: {
      features: MAIN.length,
      measured: MAIN.filter((r) => r.enc).length,
      unsafe: UNSAFE.length,
      crowdedLevels: CROWDED.length,
      quietLevels: QUIET.length,
      levels: LEVEL_IDS.length,
    },
  };
}

if (!IS_MAIN) {
  // imported: no report, just the exports below.
} else if (JSON_OUT) {
  console.log(JSON.stringify(json(), null, 2));
} else {
  report();
}

/*
 * WHAT IS EXPORTED, AND WHY THIS FILE IS NO LONGER ONLY A REPORT.
 *
 * The header above still says this tool gates nothing, and that is still true
 * of the tool: it writes nothing and it grades nothing. But one of the three
 * conditions it measures — YKSIN — was promoted to an assertion in
 * `tools/verify.mjs` on 9.8.2026, and the assertion imports these exports
 * rather than walking the map a second time. That direction matters: the gate
 * borrows the measurement, the measurement does not borrow the gate.
 *
 * `CURRICULUM_ROWS` carries `feature`, `enc` (the first-encounter answer set),
 * `inst` (where, in columns) and `safety` for every feature. `CURRICULUM_INTRO`
 * is the same data pivoted per level: what each level is the first place to
 * meet. `SCREEN_COLS` is exported so the gate can quote the unit in its own
 * message instead of writing 20 down again.
 */
/*
 * `CURRICULUM_USES` on `level id → { featureKey: instance }` jokaiselle
 * ominaisuudelle jokaisessa pelattavassa kentässä, ja se on olemassa jotta
 * `tools/variety.mjs` voi kääntää saman mittauksen kolmanteen asentoon
 * (kuinka USEIN ominaisuutta käytetään, ei missä se ensi kertaa kohdataan)
 * ilman toista kopiota kahdestakymmenestäseitsemästä tunnistimesta.
 *
 * Yksi määritelmä sanalle "ominaisuus" on viennin arvoinen kahden
 * raportointityökalunkin välillä: kaksi määritelmää tarkoittaisi että
 * vaihtelumittari ja opetusmittari voisivat olla eri mieltä siitä mitä peli
 * sisältää, eikä kumpikaan luku silloin tarkoittaisi mitään.
 */
export {
  FEATURES, PATHS, ROWS_OUT as CURRICULUM_ROWS, INTRO as CURRICULUM_INTRO, SCREEN_COLS,
  USES as CURRICULUM_USES, LEVELS as CURRICULUM_LEVELS,
};

function report() {
const pad = (s, n) => String(s).padEnd(n);
const yn = (v) => (v ? 'on' : 'EI');

console.log('\nOpetusjärjestys — mitattu kenttädatasta, ei muistettu.\n');

console.log(`  Pelijärjestyksiä ${PATHS.length} kpl (kartta haarautuu, ks. worlds.js):`);
for (const p of PATHS) {
  console.log(`    ${pad(p.label, 22)}${p.levels.length} kenttää`);
  console.log(`      ${p.levels.join(' → ')}`);
}
console.log(`\n  Mitattuja ominaisuuksia ${MAIN.length} (+ ${CORE.length} perussanastoa),`);
console.log(`  ${LEVEL_IDS.length} kenttää, hyppybudjetti ${budget.gapTiles} ruutua.`);

if (RAW) {
  console.log('\n  KENTTÄ × OMINAISUUS — x = esiintyy, E = ensiesittely\n');
  const keys = MAIN.filter((r) => r.enc).map((r) => r.feature.key);
  /* `enemy_g` and `enemy_k` are the same six characters, so the column heads
   * would be a row of `enemy_`. The marker itself is what distinguishes them
   * and it is what the chunk files are written in, so `vg` it is. */
  const head = (k) => (k.startsWith('enemy_') ? `v${k.slice(6)}` : k.slice(0, 6));
  console.log(`  ${pad('KENTTÄ', 7)}${keys.map((k) => head(k).padEnd(7)).join('')}`);
  for (const id of LEVEL_IDS) {
    const use = USES.get(id);
    const cellsOut = keys.map((k) => {
      const r = ROWS_OUT.find((q) => q.feature.key === k);
      if (!use[k]) return pad('.', 7);
      return pad(r.enc.earliest === id ? 'E' : 'x', 7);
    });
    console.log(`  ${pad(id, 7)}${cellsOut.join('')}`);
  }
}

console.log('\n  ENSIESITTELYT — ensimmäinen kenttä joka reitillä, ja turvaproxy\n');
console.log(`  ${pad('OMINAISUUS', 26)}${pad('ENSIN', 7)}${pad('SAR.', 6)}${pad('MISSÄ', 8)}`
  + `${pad('HAARA', 26)}${pad('POHJA', 7)}${pad('SEURA', 7)}${pad('YKSIN', 7)}TURVA`);

const line = (r) => {
  if (!r.enc) {
    console.log(`  ${pad(r.feature.name, 26)}${pad('—', 7)}${pad('—', 6)}${pad('—', 8)}`
      + 'ei esiinny pelissä');
    return;
  }
  const s = r.safety;
  const band = s.hidden ? 'piilo' : r.inst.bottom >= FLOOR - 1 ? 'maa' : 'ilma';
  const branch = r.enc.branchOnly
    ? `vain ${r.enc.firsts.map((f) => f.path).join('/')}`
    : r.enc.split ? `haaroittain, viim. ${r.enc.guaranteed}` : 'kaikki reitit';
  console.log(`  ${pad(r.feature.name, 26)}${pad(r.enc.earliest, 7)}${pad(r.inst.x0, 6)}`
    + `${pad(band, 8)}${pad(branch, 26)}${pad(yn(s.pohja), 7)}${pad(yn(s.seura), 7)}`
    + `${pad(yn(s.yksin), 7)}${s.safe ? 'ok' : 'EI'}`);
};

for (const r of MAIN) line(r);
console.log('\n  Perussanasto — mitattu samoin, mutta ei lasketa mukaan: nämä ovat se');
console.log('  mistä ensimmäinen ruutu on tehty, eikä ensimmäistä ruutua voi aikatauluttaa.\n');
for (const r of CORE) line(r);

console.log('\n  Turvaproxy: POHJA = ikkunassa [x−4, x+2] on kantava ja tappamaton lattia');
console.log('  (4 = mitattu voimatason 0 jarrutusmatka 56 px, PHYSICS.md). SEURA = ikkunassa');
console.log('  ei ole muuta vihollislajia eikä vaaralaattaa. YKSIN = saman ruudun (20 saraketta)');
console.log('  sisällä ei ole toisen ominaisuuden ensiesittelyä. Vaaralaatoilla POHJA mitataan');
console.log('  vain tulosuunnasta, piilokaistalla ei lainkaan.');

console.log(`\n  Turvaproxyn läpäisemättömiä ensiesittelyjä: ${UNSAFE.length} / `
  + `${MAIN.filter((r) => r.enc).length} mitatusta.`);
for (const r of UNSAFE) {
  const fails = [!r.safety.pohja && 'POHJA', !r.safety.seura && 'SEURA', !r.safety.yksin && 'YKSIN']
    .filter(Boolean).join(' + ');
  console.log(`    ${pad(r.feature.name, 26)}${pad(r.enc.earliest, 7)}sarake ${pad(r.inst.x0, 6)}${fails}`);
}

console.log(`\n  Kenttiä jotka esittelevät kaksi tai useamman kerralla: ${CROWDED.length} / `
  + `${LEVEL_IDS.length}.`);
for (const l of CROWDED) {
  const near = [];
  for (let i = 0; i < l.features.length; i++) {
    for (let j = i + 1; j < l.features.length; j++) {
      const a = l.features[i].inst;
      const b = l.features[j].inst;
      if (a.band === b.band && Math.abs(a.x0 - b.x0) < SCREEN_COLS) {
        near.push(`${l.features[i].feature.key}/${l.features[j].feature.key}`);
      }
    }
  }
  console.log(`    ${pad(l.id, 7)}${pad(`${l.features.length} kpl`, 8)}`
    + `${l.features.map((f) => `${f.feature.key}@${f.inst.x0}`).join(' ')}`);
  if (near.length) console.log(`             samalla ruudulla: ${near.join(', ')}`);
}

if (MISSING.length) {
  console.log('\n  Ei esiinny yhdessäkään kentässä:');
  for (const r of MISSING) console.log(`    ${r.feature.name}`);
}

/*
 * The three sections below are the ones that answer the owner's question rather
 * than describing the game. Everything above says what the levels do; these say
 * what a curriculum would have had to do about it.
 */
console.log('\n  MILLOIN OPETTAMINEN LOPPUU — ja paljonko peliä tulee sen jälkeen:');
for (const l of LAST_INTRO) {
  console.log(`    ${pad(l.path, 22)}viimeinen uusi asia ${pad(l.level || '—', 6)}`
    + `→ ${l.after} / ${l.total} kenttää ei esittele mitään uutta`);
}
console.log(`    Kenttiä ilman yhtään ensiesittelyä: ${QUIET.length} / ${LEVEL_IDS.length}.`);

console.log('\n  GENEROITU MAAILMA 5 kurriculumin sääntöä vasten — "vain esitellyt sallittu":');
console.log(`    ${GENERATED.join(' ')} käyttävät mitattuja ominaisuuksia ${GEN_CHECK.uses} kertaa,`);
console.log(`    joista ${GEN_CHECK.ok} on esitelty aiemmin samalla reitillä. Rikkomuksia `
  + `${GEN_CHECK.early.length}.`);
for (const e of GEN_CHECK.early) console.log(`      ${e}`);

console.log('\n  KOODIN OMAT EDELTÄVYYSVAATIMUKSET, tarkistettuna joka reitillä:');
for (const p of PREREQS) {
  console.log(`    ${pad(`${p.before} → ${p.after}`, 20)}${pad(`${p.first} → ${p.then}`, 16)}`
    + `${p.held ? 'pitää' : 'EI PIDÄ'}   (${p.why})`);
}

/*
 * The verdict, in the same spirit as difficulty.mjs's "Käyrä nousee joka
 * maailmassa": a sentence per measurement, each one derived rather than typed,
 * so it cannot quietly stop being true. It answers the question the tool was
 * built for and no more than that.
 */
const measured = MAIN.filter((r) => r.enc);
const failPohja = measured.filter((r) => !r.safety.pohja).length;
const failSeura = measured.filter((r) => !r.safety.seura).length;
const failYksin = measured.filter((r) => !r.safety.yksin).length;
const branchOnly = measured.filter((r) => r.enc.branchOnly);
const splitFirst = measured.filter((r) => r.enc.split && !r.enc.branchOnly);

console.log('\n  TULOS');
console.log(`    ${measured.length - UNSAFE.length} / ${measured.length} ensiesittelyä `
  + 'läpäisee turvaproxyn.');
console.log(`    POHJA hylkää ${failPohja}, SEURA ${failSeura}, YKSIN ${failYksin}.`);
console.log(failPohja
  ? `    ${failPohja} ensiesittelyä on kuilun tai tappavan laatan yllä — maasto, ei seura.`
  : '    Yksikään ensiesittely ei ole kuilun tai laavan yllä: hylkäykset ovat seuraa ja');
if (!failPohja) console.log('    tungosta, eivät maastoa.');
console.log(`    Haarakohtaisia ominaisuuksia ${branchOnly.length}: `
  + `${branchOnly.map((r) => `${r.feature.key} (${r.enc.firsts.map((f) => f.path).join('/')})`)
    .join(', ') || 'ei yhtään'}.`);
console.log(`    Haaran mukaan siirtyviä ensiesittelyjä ${splitFirst.length}: `
  + `${splitFirst.map((r) => `${r.feature.key} ${r.enc.earliest}→${r.enc.guaranteed}`).join(', ')
    || 'ei yhtään'}.`);

console.log('\n  Mitä tämä ei mittaa: kuplaloukku (pelaajan oma pallo, arvotaan');
console.log('  rollPowerupista — ei paikkaa kartalla), liikkuvat lavat (ei ole moottorissa),');
console.log('  eikä maahaniskun opettaminen (liike toimii ensimmäisestä framesta).');
console.log('  Heuristiikka lukee ruudukkoa. Se ei tiedä pelaako kukaan haaraa toisin päin');
console.log('  eikä siitä, mitä pelaaja ehtii katsoa.\n');
}
