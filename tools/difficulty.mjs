/**
 * Vaikeuskäyrän mittari.
 *
 *   node tools/difficulty.mjs           koko peli
 *   node tools/difficulty.mjs --raw     mitatut suureet ilman painotusta
 *   node tools/difficulty.mjs --json    koneluettava muoto
 *
 * This is a HEURISTIC, and the number it prints is not a fun rating. It reads
 * the level grid and counts things that demonstrably cost players lives in a
 * platformer — gaps against the measured jump budget, enemies by type, lethal
 * tiles, how much of the route hangs over nothing, how long you go without a
 * power block, how much of the footing is narrow. It cannot read pacing, it
 * cannot read whether a jump *feels* fair, and it has never played the game.
 *
 * What it is good for is comparing a level to another level of the same game,
 * which is exactly the question "does world 3 ramp from world 2".
 *
 * Everything is measured off the ROUTE BAND — the 15 rows the player starts in.
 * The sky and cave bands of a tall level are optional bonus rooms; counting
 * their contents as difficulty would say a level got harder because it hid a
 * reward in it.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getLevel } from '../src/data/levels.js';
import {
  WORLDS, tiersOf, tierScore, branchesOf, worldProblems, pipsFor, PIPS, REWARDS,
} from '../src/data/worlds.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const RAW = args.includes('--raw');
const JSON_OUT = args.includes('--json');
const WRITE = args.includes('--write');
const IS_MAIN = !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

const budget = JSON.parse(await readFile(join(ROOT, 'tools/jump-budget.json'), 'utf8'));

const ROWS = 15;
const FLOOR = 13;

/*
 * Enemy cost, in "walkers". The walker is 1.0 because it is the thing every
 * other enemy is a variation on: it walks at you, one stomp removes it.
 *
 * The ordering is behavioural, not cosmetic:
 *   - anything that cannot be stomped costs more, because the default answer
 *     does not work and the player has to have a second one ready
 *   - anything that moves in the air costs more, because you cannot outrun it
 *     along the ground, which is what the ground route is
 *   - anything that survives being hit costs more, because clearing it is two
 *     actions under pressure instead of one
 */
const ENEMY_COST = {
  g: 1.0,   // walker: the unit
  k: 1.3,   // shell: stomping it leaves a shell that comes back at you
  f: 1.6,   // flyer: hops, and a stomp turns it into a walker — two hits
  p: 1.1,   // pipe plant: telegraphed and stationary, but not stompable
  r: 1.5,   // stink cloud: bobs at head height and drifts toward you
  c: 1.2,   // cork guy: hops unpredictably, but corking is a nuisance not damage
  x: 1.4,   /* spiky walker: it walks at you like the unit does, but the default
             * answer does not work on it — and unlike the plant, which is the
             * other unstompable thing at 1.1, it does not stay where you left
             * it. Slower than a walker (0.4) on purpose, so it is priced below
             * the flyer: it will never catch you from behind, it just refuses
             * to be removed the usual way. It was missing from this table
             * entirely, which meant every one of them scored zero. */
  H: 1.5,   /* heartburn jet: cannot be killed, but it is bolted to one column
             * and fires on a fixed period. Timing a metronome is the cheapest
             * skill on this list — the plant next door is the same deal and
             * costs 1.1; the jet costs more only because it erupts out of open
             * floor instead of a pipe you can see from a screen away. */
  A: 3.0,   // angry sun: unkillable by stomp and follows you for the rest of the level
  P: 3.0,   /* bean baron: survives being hit, so clearing it is two actions under
             * pressure — above the flyer's 1.6 — and it throws something that
             * cannot be removed at all, above the plant and the cloud. But it is
             * bolted to its plinth and can be left behind, so it is not the
             * boss's 5.0. Level with the sun, which trades "no stomp answer and
             * it follows you" against "two hits and a crossfire, but it stays
             * put". Added with the enemy rather than after it, because a
             * mini-boss worth zero is the exact bug the spiky walker had. */
  O: 0.0,   // moon: harmless, it is a trampoline with a power-up in it
  b: 5.0,   /* boss: one entity, but it is the level. The real spread between
             * bosses is bossVariant's move set, which is code and not grid, so
             * this single number is the heuristic at its blindest. */
};

/*
 * Counted per COLUMN, not per tile. Lava is written as a two-row slab and
 * spikes as a single row, so counting tiles would say a lava trench is twice
 * the hazard a spike bed of the same width is purely because of how the chunk
 * is spelled. What the player meets is the width of the thing.
 */
const LETHAL_TILE = { '^': 1.0, W: 1.5 };  // lava has no ledge to land on; spikes do

const SOLID = new Set(['#', 'X', 'B', '?', '!', '*', 'u', 'N', '[', ']', '{', '}', '%', '(', ')', 'S']);

/**
 * Same band rule as src/data/rules.js: the route is the band the player starts
 * in. Duplicated rather than imported because rules.js keeps it private, and
 * exporting it from there would widen the validator's surface for a reporting
 * tool.
 */
function routeBand(rows) {
  if (rows.length <= ROWS) return rows;
  const start = rows.findIndex((row) => row.includes('1'));
  const top = Math.floor(Math.max(start, 0) / ROWS) * ROWS;
  return rows.slice(top, top + ROWS);
}

/**
 * Horizontal runs of `chars`, as {y, from, w}. The floor row is included: the
 * crumbling catwalk is written at floor level, and it is footing you have to
 * aim at like any other.
 */
function runs(route, chars) {
  const out = [];
  const w = route[0].length;
  for (let y = 0; y <= FLOOR; y++) {
    let run = 0;
    for (let x = 0; x <= w; x++) {
      if (x < w && chars.has(route[y][x])) { run++; continue; }
      if (run) out.push({ y, from: x - run, w: run });
      run = 0;
    }
  }
  return out;
}

function measure(rows) {
  const route = routeBand(rows);
  const w = route[0].length;
  const at = (x, y) => (y < 0 || y >= ROWS || x < 0 || x >= w ? ' ' : route[y][x]);

  let enemyCost = 0;
  const enemies = {};
  let hazardCost = 0;
  for (let x = 0; x < w; x++) {
    let worst = 0;
    for (let y = 0; y < ROWS; y++) {
      const ch = at(x, y);
      if (ENEMY_COST[ch] !== undefined) {
        enemyCost += ENEMY_COST[ch];
        enemies[ch] = (enemies[ch] || 0) + 1;
      }
      worst = Math.max(worst, LETHAL_TILE[ch] || 0);
    }
    hazardCost += worst;
  }

  /*
   * A column is lethal if standing in it kills: no floor at all, or lava where
   * the floor should be. Lava counts because a lava trench is a pit that the
   * engine happens to have put a lid on — it is not somewhere you land. Lava on
   * the lower floor row counts only when the upper one is open, so a solid
   * catwalk with lava beneath it reads as the catwalk it is; a crumbling one
   * does not, because it will not be there.
   */
  const lethalCol = [];
  for (let x = 0; x < w; x++) {
    const stands = (y) => SOLID.has(at(x, y)) && at(x, y) !== '%';
    const grounded = stands(FLOOR) || stands(FLOOR + 1);
    const lava = at(x, FLOOR) === 'W' || (!SOLID.has(at(x, FLOOR)) && at(x, FLOOR + 1) === 'W');
    lethalCol.push(!grounded || lava);
  }

  /*
   * Gap risk. The thing that makes a gap hard is not its width but its width
   * *relative to what the jump carries* — six tiles out of an eight-tile budget
   * is a jump you take without thinking, and nine is a death. So the span is
   * divided by the measured budget and squared: the cost climbs steeply as the
   * gap approaches the budget, which is how the failure rate behaves too.
   *
   * Stepping stones are honoured, because a player crosses to the stone and not
   * to the far side. A gap is therefore cut at every column that has a platform
   * over it, and each resulting hop is scored on its own — which is why an
   * eight-wide pit with a plank in it scores half of what a bare one does.
   */
  const landable = [];
  for (let x = 0; x < w; x++) {
    const plank = Array.from({ length: FLOOR + 1 }, (_, y) => at(x, y)).some((ch) => ch === '-' || ch === '%');
    landable.push(!lethalCol[x] || plank);
  }
  let gapRisk = 0;
  let span = 0;
  const spans = [];
  for (let x = 0; x <= w; x++) {
    if (x < w && !landable[x]) { span++; continue; }
    if (span) { gapRisk += (span / budget.gapTiles) ** 2; spans.push(span); }
    span = 0;
  }

  /*
   * How much of the level is over death, regardless of how it is divided up.
   * A level can be all narrow gaps — cheap by the rule above — and still spend
   * a third of its length somewhere a mistake is fatal, which is a different
   * kind of pressure and worth its own number.
   */
  const pitShare = (lethalCol.filter(Boolean).length / w) * 100;

  /*
   * The longest stretch with no power block. This is not difficulty on its own,
   * it is an amplifier: the design promise is that the route works at the
   * smallest size, so a drought never makes a level impossible — it only means
   * that if you get hit at the start of it, you play all of it small.
   */
  let drought = 0;
  let sinceP = 0;
  for (let x = 0; x < w; x++) {
    const power = Array.from({ length: ROWS }, (_, y) => at(x, y)).includes('!');
    sinceP = power ? 0 : sinceP + 1;
    drought = Math.max(drought, sinceP);
  }

  /*
   * Forced precision. Narrow footing is hard in proportion to how little of it
   * there is — three tiles is about where a landing stops needing aim, so the
   * cost is 3/width and capped at 1. Footing over a lethal column counts far
   * more (2.5x): missing a plank over grass costs a climb, missing one over a
   * pit costs a life. Crumbling tiles get a further 1.5x because the platform
   * is leaving whether or not you aimed well.
   */
  let precision = 0;
  for (const r of runs(route, new Set(['-', '%']))) {
    const overDeath = Array.from({ length: r.w }, (_, i) => lethalCol[r.from + i]).some(Boolean);
    const crumbles = Array.from({ length: r.w }, (_, i) => at(r.from + i, r.y) === '%').some(Boolean);
    precision += Math.min(1, 3 / r.w) * (overDeath ? 2.5 : 1) * (crumbles ? 1.5 : 1);
  }

  const per100 = (n) => (n / w) * 100;
  return {
    cols: w,
    enemies,
    spans,
    metrics: {
      enemies: per100(enemyCost),
      gaps: per100(gapRisk),
      hazards: per100(hazardCost),
      pit: pitShare,
      drought: (drought / w) * 100,
      precision: per100(precision),
    },
  };
}

/*
 * Weights, and the reference each metric is divided by.
 *
 * `ref` is world 1's measured average of that metric — the four levels the game
 * opens with, fortress included — so a term reading 100·w means "as much of
 * this as the gentlest world in the game has". World 1 therefore averages 100
 * by construction, and every other world is a percentage of it.
 *
 * The references are FROZEN measurements, not a running average. That is the
 * point: if the whole game is made harder the scores must all rise, and a scale
 * that renormalised itself would report no change at all. Re-measure them (and
 * say so in the changelog) only if world 1 itself is redesigned.
 *
 * `w` sums to 1 and is the editorial half — the claim about what makes a
 * platformer hard, in order:
 *   gaps       0.30  the only thing here that kills with no warning and no
 *                    recovery, and the hardest skill to acquire
 *   enemies    0.25  the constant tax; every level has it, so it sets the floor
 *   precision  0.18  aiming a landing is the second skill, and it fails silently
 *   hazards    0.12  lethal but static: learnable in one attempt
 *   pit        0.09  exposure rather than a challenge in itself
 *   drought    0.06  an amplifier, not a source — see the promise in DESIGN.md §5
 */
const WEIGHTS = {
  enemies: { w: 0.25, ref: 3.57 },
  gaps: { w: 0.30, ref: 0.30 },
  hazards: { w: 0.12, ref: 3.82 },
  pit: { w: 0.09, ref: 6.35 },
  drought: { w: 0.06, ref: 65.08 },
  precision: { w: 0.18, ref: 1.62 },
};

/** 100 = a world 1 level. Linear in every term, so a 20% rise is 20% more of something. */
function score(metrics) {
  let total = 0;
  const parts = {};
  for (const [key, { w, ref }] of Object.entries(WEIGHTS)) {
    parts[key] = 100 * w * (metrics[key] / ref);
    total += parts[key];
  }
  return { total, parts };
}

/* Play order, straight off the map graph, so the sequence is the one a player
 * actually walks and not the order the definitions happen to be written in. */
const playOrder = WORLDS.map((world) => ({
  id: world.id,
  world,
  levels: world.nodes.filter((n) => n.level).map((n) => ({ id: n.level, fortress: n.type === 'fortress' })),
}));

const rows = [];
for (const world of playOrder) {
  for (const { id, fortress } of world.levels) {
    const m = measure(getLevel(id).rows);
    rows.push({
      id, world: world.id, fortress, ...m, ...score(m.metrics),
    });
  }
}

/** The one number per level that leaves this tool. One decimal, and no more:
 *  the heuristic does not have a second one, and printing it would suggest it
 *  does. */
export function difficultyTable() {
  return Object.fromEntries(rows.map((r) => [r.id, Number(r.total.toFixed(1))]));
}

const SCORES = difficultyTable();

/**
 * Worlds as tiers. A tier is one step of progress — one level, or one branch
 * whose routes are alternatives — and its number is `tierScore`: hardest level
 * within a route, easiest route across a branch. The world's number is the mean
 * over its tiers, fortress included, which is what it always was for a world
 * with no branches and stays comparable across the change.
 */
const worldShape = playOrder.map(({ id, world }) => {
  const tiers = tiersOf(world).map((t) => ({ ...t, score: tierScore(world, t, SCORES) }));
  const mean = tiers.reduce((s, t) => s + t.score, 0) / (tiers.length || 1);
  return {
    id,
    world,
    tiers,
    mean,
    branches: branchesOf(world, SCORES),
    levels: rows.filter((r) => r.world === id),
  };
});

const problems = WORLDS.flatMap((w) => worldProblems(w, SCORES));

/**
 * The generated file the game reads. Written only when asked: a reporting tool
 * that rewrites its own inputs as a side effect is exactly the trap
 * `measure-jump.mjs` fell into, and this one is read by the world map.
 */
function renderDataFile(table) {
  const header = `/**
 * GENERATED FILE — do not edit by hand.
 *
 *   node tools/difficulty.mjs --write
 *
 * The measured difficulty of every level, as \`tools/difficulty.mjs\` scores it.
 * 100 = a world 1 level; the scale and its frozen references live in the tool.
 *
 * This file exists because the map has to show difficulty BEFORE the player
 * commits to a branch, and the game cannot run the tool: the tool is Node, it
 * reads \`tools/jump-budget.json\` off disk, and the game is a static page. So
 * the numbers are carried across in a data file, the same way
 * \`tools/pacing-stats.json\` carries pacing to the generator.
 *
 * A carried number can go stale, which is the whole cost of doing it this way.
 * That is caught rather than trusted: \`tools/verify.mjs\` re-runs the measurement
 * and compares it with this file, and a single changed level fails the gate with
 * the command that fixes it. Writing is a separate flag on purpose — a reporting
 * tool that rewrites its own inputs as a side effect is the trap
 * \`measure-jump.mjs\` already fell into.
 */

export const DIFFICULTY = {
`;
  const body = Object.entries(table)
    .map(([id, v]) => `  '${id}': ${v.toFixed(1)},`).join('\n');
  return `${header}${body}\n};\n`;
}

/** Stored vs measured, as a list of human-readable differences. */
export function compareTable(stored, measured) {
  const out = [];
  for (const [id, v] of Object.entries(measured)) {
    if (!(id in stored)) out.push(`${id}: puuttuu tiedostosta (mitattu ${v.toFixed(1)})`);
    else if (Math.abs(stored[id] - v) > 0.05) {
      out.push(`${id}: tiedostossa ${Number(stored[id]).toFixed(1)}, mitattu ${v.toFixed(1)}`);
    }
  }
  for (const id of Object.keys(stored)) {
    if (!(id in measured)) out.push(`${id}: tiedostossa mutta ei enää pelissä`);
  }
  return out;
}

if (WRITE && IS_MAIN) {
  await writeFile(join(ROOT, 'src/data/difficulty.js'), renderDataFile(SCORES));
  console.log('\n  kirjoitettu src/data/difficulty.js\n');
}

if (!IS_MAIN) {
  // imported by verify.mjs for the freshness check; it wants the numbers, not
  // the report.
} else if (JSON_OUT) {
  console.log(JSON.stringify({
    levels: rows,
    worlds: worldShape.map((w) => ({
      id: w.id,
      mean: w.mean,
      tiers: w.tiers.map((t) => ({ id: t.id, levels: t.levels, score: t.score })),
    })),
    problems,
  }, null, 2));
  process.exit(0);
} else {
  report();
}

function report() {
const pad = (s, n) => String(s).padEnd(n);
const num = (v, n, d = 1) => String(v.toFixed(d)).padStart(n);
const meter = (n) => '●'.repeat(n) + '○'.repeat(PIPS - n);

console.log('\nVaikeusmittari — heuristiikka, ei totuus. Perusluku 100 = maailman 1 taso.\n');

if (RAW) {
  console.log(`  ${pad('KENTTÄ', 8)}${pad('SAR.', 6)}${pad('VIHUT', 8)}${pad('KUILUT', 8)}`
    + `${pad('VAARAT', 8)}${pad('KUILU%', 8)}${pad('KUIVUUS', 9)}TARKKUUS`);
  for (const r of rows) {
    const m = r.metrics;
    console.log(`  ${pad(r.id, 8)}${pad(r.cols, 6)}${num(m.enemies, 6)}  ${num(m.gaps, 6)}  `
      + `${num(m.hazards, 6)}  ${num(m.pit, 6)}  ${num(m.drought, 7)}  ${num(m.precision, 6)}`);
  }
  console.log('\n  Yksiköt: kaikki per 100 saraketta, paitsi KUILU% ja KUIVUUS jotka ovat');
  console.log('  osuuksia kentän pituudesta. KUILUT on (hyppyväli / hyppybudjetti)² summattuna.\n');
}

console.log(`  ${pad('KENTTÄ', 8)}${pad('PISTEET', 9)}${pad('VIHUT', 7)}${pad('KUILUT', 8)}`
  + `${pad('VAARAT', 8)}${pad('KUILU%', 8)}${pad('KUIVUUS', 9)}${pad('TARKKUUS', 10)}KARTALLA`);
for (const world of worldShape) {
  for (const r of world.levels) {
    const p = r.parts;
    console.log(`  ${pad(r.id, 8)}${num(r.total, 6)}   ${num(p.enemies, 5)}  ${num(p.gaps, 6)}  `
      + `${num(p.hazards, 6)}  ${num(p.pit, 6)}  ${num(p.drought, 7)}  ${num(p.precision, 6)}`
      + `    ${meter(pipsFor(r.total))}`);
  }
  console.log(`  ${pad(world.id, 8)}${num(world.mean, 6)}   ← tasojen keskiarvo, helpoin reitti\n`);
}

/* Across worlds: strictly increasing, no ties. */
let monotonic = true;
console.log('  Maailmojen käyrä:');
for (let i = 0; i < worldShape.length; i++) {
  const prev = i ? worldShape[i - 1].mean : null;
  const delta = prev === null ? null : worldShape[i].mean - prev;
  const mark = delta === null ? '   ' : delta > 0 ? ' ↑ ' : ' ↓ ';
  if (delta !== null && delta <= 0) monotonic = false;
  console.log(`    ${pad(worldShape[i].id, 5)}${num(worldShape[i].mean, 6)}${mark}`
    + `${delta === null ? '' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}`);
}
console.log(monotonic
  ? '\n  Käyrä nousee joka maailmassa.'
  : '\n  KÄYRÄ EI NOUSE — jokin maailma on edellistä helpompi.');

/*
 * The shape of a world, measured in TIERS rather than along a chain.
 *
 * The old walk was the world's levels in the order they happen to be listed,
 * and it was right only as long as the map was a queue. A branching map breaks
 * it in a way that looks like a content bug: two alternatives get read as two
 * consecutive steps, so an easy branch after a hard one reports as a dip that
 * nobody plays, and a hard branch reports as a spike nobody has to survive.
 * The tool would then complain about a correct map, and a gate that complains
 * about correct data gets switched off.
 *
 * So a tier is one step of progress: one level, or one whole branch. Two levels
 * inside one branch are one tier because a player plays one of them, and the
 * tier's number is the EASIEST route's — that is what everybody walks. The
 * branch's own inequality is a separate question, checked below.
 *
 * Unchanged, and still the point: generally up, with at least one deliberate
 * breather, because a straight line has no shape. The fortress stays out of the
 * walk — it is always the peak and always last, so counting it would make every
 * world "rises overall" for free.
 */
console.log('\n  Maailman muoto tasoittain, linnake pois lukien:');
for (const world of worldShape) {
  const walk = world.tiers.filter((t) => !t.fortress);
  const seq = walk.map((t) => t.score);
  const dips = seq.slice(1).filter((v, i) => v < seq[i]).length;
  const rises = seq[seq.length - 1] > seq[0];
  const shape = walk.map((t) => {
    if (!t.branch) return t.score.toFixed(0);
    const routes = world.branches.find((b) => b.from === t.branch.from);
    return `[${[...routes.routes].sort((a, b) => a.score - b.score)
      .map((r) => r.score.toFixed(0)).join('|')}]`;
  }).join(' → ');
  const verdict = rises && dips > 0 ? 'ok'
    : !rises ? 'ei nouse kokonaisuutena'
      : 'suora viiva, ei hengähdystä';
  console.log(`    ${pad(world.id, 5)}${pad(shape, 30)}${pad(`${dips} notkoa`, 12)}${verdict}`);
}
console.log('    Hakasulje on haara: sen reitit helpoimmasta vaikeimpaan, ja tason');
console.log('    luku on niistä ensimmäinen.');

/*
 * The branches themselves. A route's number is its hardest level, because a run
 * dies on the worst thing on the way and an average would let one gentle level
 * hide one lethal one. The reward has to be on the harder route or the choice
 * is a punishment, and that is checked, not assumed.
 */
const branched = worldShape.filter((w) => w.branches.length);
if (branched.length) {
  console.log('\n  Haarat — reitin luku on sen vaikein kenttä, ei keskiarvo:');
  for (const world of branched) {
    for (const branch of world.branches) {
      console.log(`    ${world.id}  ${branch.from} → ${branch.to}`);
      for (const r of [...branch.routes].sort((a, b) => a.score - b.score)) {
        const prize = r.reward ? (REWARDS[r.reward] || {}).label || r.reward : 'ei palkintoa';
        console.log(`      ${pad(r.name, 14)}${num(r.score, 6)}  ${meter(r.pips)}  `
          + `${pad(r.levels.join(' '), 12)}${prize}`);
      }
    }
  }
}

if (problems.length) {
  console.log('\n  KARTAN RAKENNE — korjattavaa:');
  for (const p of problems) console.log(`    ${p}`);
} else {
  console.log('\n  Kartan rakenne kunnossa: jokainen kenttä on jollain reitillä alusta');
  console.log('  linnakkeeseen, jokainen haara on ilmoitettu, palkitsematon reitti vie');
  console.log('  läpi, ja palkinto on vaikeammalla reitillä.');
}

console.log('\n  Heuristiikka lukee ruudukkoa. Se ei tiedä mitään rytmistä, pomon');
console.log('  liikesarjasta eikä siitä miltä hyppy tuntuu.\n');
}
