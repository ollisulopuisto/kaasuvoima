/**
 * Builds levels from the mined pacing statistics.
 *
 *   node tools/gen-levels.mjs [--seed 1234] [--telemetry log.json]
 *
 * What is borrowed and what is not
 * --------------------------------
 * From `tools/pacing-stats.json` this takes RHYTHM: how many columns of calm
 * sit between challenges, how that density ramps across a level, how wide gaps
 * are as a fraction of what a jump can clear, how enemies cluster, how high
 * block rows float, how big a coin group tends to be.
 *
 * It takes no layout. The vocabulary below is this game's own — fart double
 * jumps, ummetus corks, hernekeitto, närästys jets, stink clouds — arranged by
 * rules written against this game's *measured* jump budget (tools/jump-budget.json,
 * produced by tools/measure-jump.mjs), so the geometry follows the physics
 * instead of a number somebody wrote down once. A generated level should read
 * as a Super Fart Bros level that happens to breathe at a classic tempo, not as
 * a copy of anything.
 *
 * Every level is checked before it is written: gaps and walls stay inside the
 * jump budget, nothing spawns inside a wall, there is headroom for the tallest
 * power level, and no eight-column stretch matches the source corpus.
 *
 * With `--telemetry` it also reads an exported playtest log and lets the data
 * move two knobs: a cluster of deaths lengthens the calm ground in front of the
 * spot, a cluster of stalls takes a tile off the obstacle that stopped them.
 * Nothing else. The thresholds that decide what counts as a cluster live in
 * tools/read-telemetry.mjs, and everything the data was too thin to justify is
 * printed too — silence would be indistinguishable from having no log at all.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLevel } from '../src/data/rules.js';
import { readTelemetry, RULES } from './read-telemetry.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const stats = JSON.parse(await readFile(join(ROOT, 'tools/pacing-stats.json'), 'utf8'));

const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg > 0 ? Number(process.argv[seedArg + 1]) : 20260808;

const telArg = process.argv.indexOf('--telemetry');
const TELEMETRY_FILE = telArg > 0 ? process.argv[telArg + 1] : null;
if (telArg > 0 && !TELEMETRY_FILE) {
  console.error('  --telemetry needs a file: node tools/gen-levels.mjs --telemetry log.json');
  process.exit(1);
}
const TELEMETRY = TELEMETRY_FILE
  ? await readTelemetry(TELEMETRY_FILE).catch((err) => {
    console.error(`  ${err.message}`);
    process.exit(1);
  })
  : null;

/* ------------------------------- the engine ----------------------------- */

const ROWS = 15;
const FLOOR = 13;          // rows 13-14 are the ground slab
const HEAD = 3;            // tiles of headroom the tallest player needs

/**
 * The jump budget is measured, not assumed: tools/measure-jump.mjs plays a
 * jump and writes what it actually achieved. Change the physics and the level
 * geometry follows, instead of quietly going stale.
 */
let budget = { gapTiles: 8, softGapTiles: 13, wallTiles: 6 };
try {
  budget = JSON.parse(await readFile(join(ROOT, 'tools/jump-budget.json'), 'utf8'));
} catch {
  console.warn('  (no tools/jump-budget.json — run node tools/measure-jump.mjs; using defaults)');
}
const REACH = { gap: budget.gapTiles, wall: budget.wallTiles, softGap: budget.softGapTiles };
/** The corpus jump budget, for translating difficulty rather than distance. */
const CORPUS_REACH = 5;
const GAP_SCALE = REACH.gap / CORPUS_REACH;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const range = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

/** Weighted draw from one of the mined histograms. */
function sampleHist(summary, { min = -Infinity, max = Infinity } = {}) {
  const entries = Object.entries(summary.histogram)
    .map(([k, v]) => [Number(k), v])
    .filter(([k]) => k >= min && k <= max);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  let roll = rnd() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries.length ? entries[entries.length - 1][0] : min;
}

class Canvas {
  constructor() {
    this.cells = Array.from({ length: ROWS }, () => []);
    this.width = 0;
  }

  ensure(x) {
    while (this.width <= x) {
      for (let y = 0; y < ROWS; y++) this.cells[y][this.width] = ' ';
      this.width++;
    }
  }

  set(x, y, ch) {
    if (y < 0 || y >= ROWS) return;
    this.ensure(x);
    this.cells[y][x] = ch;
  }

  get(x, y) {
    if (y < 0 || y >= ROWS || x < 0 || x >= this.width) return ' ';
    return this.cells[y][x];
  }

  /** Lays the ground slab across [x, x+w). */
  ground(x, w) {
    for (let i = 0; i < w; i++) {
      this.set(x + i, FLOOR, '#');
      this.set(x + i, FLOOR + 1, '#');
    }
  }

  rows() {
    return this.cells.map((row) => row.join(''));
  }
}

/* ------------------------------ set pieces ------------------------------ */
/* Each returns the number of columns it consumed. `ctx` carries the running
 * state the pieces need to stay fair to the player. `ctx.ease` is the tiles a
 * piece should shave off its height or its span; it is zero unless telemetry
 * says people stalled here, and the pieces that can honour it are EASEABLE. */

/**
 * Where each enemy belongs. Hovering kinds bob around their spawn height, so
 * putting one on the floor sinks it into the ground.
 */
const ENEMY_ROW = { g: 1, k: 1, c: 1, f: 5, r: 4 };

const placeEnemy = (c, x, kind) => c.set(x, FLOOR - (ENEMY_ROW[kind] || 1), kind);

const coinArc = (c, x, w) => {
  // Coins trace the jump the gap asks for, which is how a player reads it.
  for (let i = 0; i < w; i++) {
    const t = (i + 0.5) / w;
    const lift = Math.round(Math.sin(t * Math.PI) * 3);
    if (lift > 0) c.set(x + i, FLOOR - 2 - lift, 'o');
  }
};

const PIECES = {
  /** Plain ground with nothing on it — the rest between challenges. */
  rest(c, x, ctx) {
    const w = Math.max(3, Math.round(sampleHist(stats.challengeSpacing, { min: 2, max: 20 })
      * ctx.restScale));
    c.ground(x, w);
    return w;
  },

  /** A gap. Wide ones get a stepping stone, because ours is a 6-tile budget. */
  gap(c, x, ctx) {
    const raw = sampleHist(stats.gapWidth, { min: 1, max: 9 });
    const w = Math.max(2, Math.min(REACH.softGap, Math.round(raw * GAP_SCALE)) - ctx.ease);
    const lead = 2;
    c.ground(x, lead);
    if (w > REACH.gap) {
      const half = Math.floor(w / 2);
      for (let i = 0; i < 2; i++) c.set(x + lead + half - 1 + i, FLOOR - 3, '-');
    }
    if (rnd() < 0.55) coinArc(c, x + lead, w);
    c.ground(x + lead + w, 3);
    return lead + w + 3;
  },

  /** Gas cloud drifting over a gap: this game's own version of a leap of faith. */
  stinkGap(c, x, ctx) {
    const w = Math.min(REACH.gap, Math.max(3, Math.round(
      sampleHist(stats.gapWidth, { min: 2, max: 8 }) * GAP_SCALE,
    ) - ctx.ease));
    c.ground(x, 2);
    c.set(x + 2 + Math.floor(w / 2), FLOOR - 4, 'r');
    coinArc(c, x + 2, w);
    c.ground(x + 2 + w, 3);
    return 2 + w + 3;
  },

  /**
   * Ummetus gate: a cork guy patrols in front of a gap, so getting corked turns
   * a routine hop into a problem. The gap itself stays inside the plain jump
   * budget — the fart jump is never the price of admission — and the soup that
   * cures the cork sits on the far side.
   */
  corkGate(c, x, ctx) {
    const w = Math.max(3, REACH.gap - ctx.ease);
    c.ground(x, 5);
    c.set(x + 2, FLOOR - 1, 'c');
    const half = Math.floor(w / 2);
    for (let i = 0; i < 2; i++) c.set(x + 5 + half - 1 + i, FLOOR - 3, '-');
    coinArc(c, x + 5, w);
    c.ground(x + 5 + w, 6);
    c.set(x + 5 + w + 3, FLOOR - 4, '!');
    return 5 + w + 6;
  },

  /**
   * A reward that only the fart double jump reaches: a ledge above the normal
   * jump, with something worth having on it. This is the whole bargain of the
   * power-up — it opens places, it does not open the level.
   */
  highReward(c, x, ctx) {
    const w = 14;
    c.ground(x, w);
    const height = REACH.wall + 4;
    for (let i = 0; i < 4; i++) c.set(x + 5 + i, FLOOR - height, '-');
    c.set(x + 6, FLOOR - height - 1, ctx.gaveePower ? 'o' : '!');
    c.set(x + 7, FLOOR - height - 1, 'o');
    c.set(x + 8, FLOOR - height - 1, 'o');
    ctx.gaveePower = true;
    ctx.hasHighReward = true;
    return w;
  },

  /** Närästys jets rising out of the floor, spaced so a run can thread them. */
  heartburn(c, x) {
    const count = range(2, 3);
    const step = 4;
    const w = count * step + 4;
    c.ground(x, w);
    for (let i = 0; i < count; i++) c.set(x + 3 + i * step, FLOOR - 1, 'H');
    return w;
  },

  /** A row of blocks floating at a mined height, mostly plain, rarely a prize. */
  blockRow(c, x, ctx) {
    const run = Math.min(7, Math.max(2, sampleHist(stats.blockRun, { min: 2, max: 9 })));
    const height = Math.min(9, Math.max(HEAD + 1,
      sampleHist(stats.blockHeightAboveFloor, { min: 4, max: 9 })));
    const w = run + 4;
    c.ground(x, w);
    const rewardAt = rnd() < 0.55 ? range(0, run - 1) : -1;
    for (let i = 0; i < run; i++) {
      let ch = 'B';
      if (i === rewardAt) ch = ctx.gaveePower && rnd() < 0.5 ? '?' : '!';
      else if (rnd() < stats.rewardBlockShare) ch = '?';
      c.set(x + 2 + i, FLOOR - height, ch);
    }
    if (rewardAt >= 0) ctx.gaveePower = true;
    return w;
  },

  /** Note blocks — bouncy, and this game's cheapest way to gain height. */
  notes(c, x) {
    const w = 8;
    c.ground(x, w);
    c.set(x + 3, FLOOR - 4, 'N');
    c.set(x + 4, FLOOR - 4, 'N');
    c.set(x + 3, FLOOR - 8, 'o');
    c.set(x + 4, FLOOR - 8, 'o');
    return w;
  },

  /** A staircase, sized from the mined step distribution and our wall budget. */
  stairs(c, x, ctx) {
    const h = Math.min(REACH.wall,
      Math.max(2, sampleHist(stats.stepUp, { min: 2, max: 5 }) - ctx.ease));
    const w = h * 2 + 4;
    c.ground(x, w);
    for (let i = 0; i < h; i++) {
      for (let j = 0; j <= i; j++) c.set(x + 2 + i, FLOOR - 1 - j, 'X');
    }
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < h - i; j++) c.set(x + 2 + h + i, FLOOR - 1 - j, 'X');
    }
    return w;
  },

  /** A cluster of walkers, shells or flyers, sized from the mined clustering. */
  enemies(c, x, ctx) {
    const count = Math.min(4, Math.max(1, sampleHist(stats.enemyCluster, { min: 1, max: 4 })));
    const w = count * 3 + 6;
    c.ground(x, w);
    for (let i = 0; i < count; i++) {
      placeEnemy(c, x + 3 + i * 3, pick(ctx.enemies));
    }
    return w;
  },

  /** A pipe, sometimes with something living in it. */
  pipe(c, x) {
    const h = Math.min(4, Math.max(1, sampleHist(stats.pipeHeight, { min: 1, max: 4 })));
    const w = 8;
    c.ground(x, w);
    for (let i = 0; i < h; i++) {
      const y = FLOOR - 1 - i;
      c.set(x + 3, y, i === h - 1 ? '[' : '{');
      c.set(x + 4, y, i === h - 1 ? ']' : '}');
    }
    if (h >= 3 && rnd() < 0.45) c.set(x + 3, FLOOR - 1 - h, 'p');
    return w;
  },

  /** Floating platforms — the vertical half of the level's vocabulary. */
  platforms(c, x, ctx) {
    const count = range(2, 3);
    const w = count * 5 + 4;
    c.ground(x, w);
    // A climb has to lead somewhere: the last and highest platform always
    // carries something. Stairways to nothing teach the player to ignore them.
    let topHeight = 0;
    let topX = x;
    for (let i = 0; i < count; i++) {
      const height = Math.max(3, range(4, 7) - ctx.ease);
      for (let j = 0; j < 3; j++) c.set(x + 2 + i * 5 + j, FLOOR - height, '-');
      if (rnd() < 0.6) c.set(x + 3 + i * 5, FLOOR - height - 2, 'o');
      if (height >= topHeight) { topHeight = height; topX = x + 3 + i * 5; }
    }
    c.set(topX, FLOOR - topHeight - 2, 'o');
    c.set(topX - 1, FLOOR - topHeight - 2, 'o');
    c.set(topX + 1, FLOOR - topHeight - 2, 'o');
    return w;
  },

  /** Spikes on the floor: a hazard you walk into rather than fall into. */
  spikes(c, x) {
    const run = range(3, 5);
    const w = run + 6;
    c.ground(x, w);
    for (let i = 0; i < run; i++) c.set(x + 3 + i, FLOOR - 1, '^');
    return w;
  },

  /** A pool of lava with a bridge of platforms over it. */
  lava(c, x) {
    const run = range(4, 7);
    const w = run + 6;
    c.ground(x, 3);
    for (let i = 0; i < run; i++) {
      c.set(x + 3 + i, FLOOR, 'W');
      c.set(x + 3 + i, FLOOR + 1, 'W');
    }
    for (let i = 1; i < run - 1; i += 3) {
      for (let j = 0; j < 2; j++) c.set(x + 3 + i + j, FLOOR - 4, '-');
    }
    c.ground(x + 3 + run, 3);
    return w;
  },

  /** Vihainen aurinko, for the levels that live under an open sky. */
  sun(c, x) {
    const w = 12;
    c.ground(x, w);
    c.set(x + 5, 2, 'A');
    return w;
  },

  /** A pocket of coins to reward looking up. */
  coins(c, x) {
    const run = Math.min(6, Math.max(2, sampleHist(stats.coinGroup, { min: 2, max: 6 })));
    const w = run + 5;
    c.ground(x, w);
    const height = range(3, 6);
    for (let i = 0; i < run; i++) c.set(x + 2 + i, FLOOR - height, 'o');
    return w;
  },
};

/* ------------------------------- assembly ------------------------------- */

/**
 * The palette per world: which set pieces can appear and how often. Weights
 * are this game's design, not the corpus — the corpus only says WHEN a
 * challenge should arrive, never WHICH.
 */
const PALETTES = {
  meadow: {
    enemies: ['g', 'g', 'k', 'f'],
    weights: {
      gap: 4, enemies: 5, blockRow: 4, stairs: 2, pipe: 2, platforms: 3,
      coins: 2, notes: 1, stinkGap: 2, corkGate: 1, highReward: 2,
    },
  },
  dunes: {
    enemies: ['g', 'k', 'f', 'r'],
    weights: {
      gap: 3, enemies: 4, blockRow: 3, stairs: 2, platforms: 3, spikes: 2,
      heartburn: 3, sun: 1, coins: 2, stinkGap: 2, corkGate: 2, lava: 1,
      highReward: 2,
    },
  },
  glacier: {
    enemies: ['g', 'k', 'f', 'c'],
    weights: {
      gap: 4, enemies: 4, blockRow: 3, platforms: 4, stairs: 2, spikes: 2,
      coins: 2, notes: 1, stinkGap: 3, corkGate: 2, lava: 2, heartburn: 2,
      highReward: 2,
    },
  },
};

function weightedPiece(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rnd() * total;
  for (const [name, w] of entries) {
    roll -= w;
    if (roll <= 0) return name;
  }
  return entries[0][0];
}

function buildLevel({ palette, targetWidth, tuning = null }) {
  const pal = PALETTES[palette];
  const c = new Canvas();
  const ctx = { enemies: pal.enemies, restScale: 1, ease: 0, gaveePower: false };
  const trace = [];
  let x = 0;

  // A safe opening, the length the corpus gives before its first challenge.
  const intro = Math.max(10, Math.min(24, sampleHist(stats.introSafeColumns, { min: 8, max: 26 })));
  c.ground(x, intro);
  c.set(2, FLOOR - 1, '1');
  x += intro;

  const ramp = stats.densityRampByQuarter;
  const peak = Math.max(...ramp);
  let lastPiece = null;

  while (x < targetWidth - 26) {
    // The ramp modulates how much calm sits between challenges: the busiest
    // quarter of the corpus gets the shortest rests.
    const quarter = Math.min(3, Math.floor((x / targetWidth) * 4));
    const tuned = tuning ? tuning.get(trace.length) : null;
    ctx.restScale = (1.35 - 0.6 * (ramp[quarter] / peak)) * (tuned ? tuned.restScale : 1);
    ctx.ease = tuned ? tuned.ease : 0;
    const from = x;
    x += PIECES.rest(c, x, ctx);

    let name = weightedPiece(pal.weights);
    if (name === lastPiece) name = weightedPiece(pal.weights);   // avoid doubles
    lastPiece = name;
    x += PIECES[name](c, x, ctx);
    trace.push({ name, from, to: x });
  }

  /*
   * Every level opens with a mushroom within its first quarter. Losing your
   * power at the start of a level should not sentence you to the whole of it
   * at the smallest size — the recovery has to be nearby, not a reward for
   * surviving to the middle.
   */
  const quarter = Math.floor(x * 0.25);
  let hasEarlyPower = false;
  for (let y = 0; y < ROWS; y++) {
    for (let px = 0; px < quarter; px++) if (c.get(px, y) === '!') hasEarlyPower = true;
  }
  if (!hasEarlyPower) {
    for (let px = intro + 4; px < quarter && !hasEarlyPower; px++) {
      const clear = [0, 1].every((d) => c.get(px + d, FLOOR) === '#'
        && [1, 2, 3, 4, 5].every((up) => c.get(px + d, FLOOR - up) === ' '));
      if (!clear) continue;
      c.set(px, FLOOR - 4, '!');
      hasEarlyPower = true;
    }
  }

  // The piece weights alone undershoot the corpus enemy density, so top it up
  // on plain ground until the level breathes at the mined rate.
  const target = Math.round((stats.enemiesPer100 / 100) * x * 0.8);
  let placed = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let px = 0; px < c.width; px++) if (pal.enemies.includes(c.get(px, y))) placed++;
  }
  for (let tries = 0; placed < target && tries < 400; tries++) {
    const px = range(intro + 6, x - 12);
    const kind = pick(pal.enemies);
    const row = FLOOR - (ENEMY_ROW[kind] || 1);
    const clear = [-2, -1, 0, 1, 2].every((d) => c.get(px + d, FLOOR) === '#'
      && [1, 2, 3, 4, 5, 6].every((up) => c.get(px + d, FLOOR - up) === ' '));
    if (!clear) continue;
    c.set(px, row, kind);
    placed++;
  }

  // Run-up, flag, and a little ground past it so the camera has somewhere to go.
  c.ground(x, 10);
  for (let i = 0; i < 3; i++) c.set(x + 2 + i * 2, FLOOR - 4, 'o');
  x += 10;
  c.set(x + 3, FLOOR - 1, 'F');
  c.ground(x, 10);
  return { rows: c.rows(), trace };
}

/* ------------------------------ telemetry ------------------------------- */

/**
 * How much a death cluster stretches the calm ground leading into it. Rests
 * are three to eight columns, so anything under a doubling rounds away to a
 * tile or two — less than the histogram's own spread, i.e. not a change the
 * player could feel.
 */
const REST_BOOST = 2;

/** The pieces whose difficulty is a height or a distance, i.e. the ones `ease` can lower. */
const EASEABLE = new Set(['gap', 'stinkGap', 'corkGate', 'stairs', 'platforms']);

/**
 * Turns hotspots into per-iteration adjustments.
 *
 * This is why a level is built twice. The log indexes the columns of the level
 * people actually played, and widening anything shifts every column after it —
 * compare a hotspot against the shifted layout and it points at the next piece
 * along. So the first build is the map, and the second build is the one that
 * moves: same seed, same pieces in the same order (nothing here draws from the
 * generator's RNG), only their widths and heights differ.
 *
 * A stall lands either in the calm before an obstacle or on the obstacle
 * itself, and in both cases the obstacle to lower is the one in that same
 * iteration — the rest always comes first.
 */
function planTuning(hot, trace) {
  const tuning = new Map();
  const notes = [];
  const where = (h) => (h.from === h.to ? `col ${h.from}` : `cols ${h.from}-${h.to}`);
  const step = (i) => {
    if (!tuning.has(i)) tuning.set(i, { restScale: 1, ease: 0 });
    return tuning.get(i);
  };
  const index = (col) => trace.findIndex((t) => col >= t.from && col < t.to);

  for (const h of hot.deaths) {
    const i = index(h.at);
    if (i < 0) {
      notes.push(`deaths ${where(h)} (${h.count})  ->  outside any set piece, left alone`);
      continue;
    }
    step(i).restScale = REST_BOOST;
    notes.push(`deaths ${where(h)} (${h.count})  ->  rest before ${trace[i].name} x${REST_BOOST}`);
  }

  for (const h of hot.stalls) {
    const i = index(h.at);
    if (i < 0) {
      notes.push(`stalls ${where(h)} (${h.count})  ->  outside any set piece, left alone`);
      continue;
    }
    const name = trace[i].name;
    if (!EASEABLE.has(name)) {
      notes.push(`stalls ${where(h)} (${h.count})  ->  ${name} has no height to give, left alone`);
      continue;
    }
    // A cluster at twice the threshold is not twice as bad, but it is bad
    // enough that one tile is unlikely to be the difference.
    const ease = h.count >= 2 * RULES.cluster ? 2 : 1;
    step(i).ease = ease;
    notes.push(`stalls ${where(h)} (${h.count})  ->  ${name} lowered by ${ease}`);
  }

  return { tuning, notes };
}

/* ------------------------------ validation ------------------------------ */

const SOLID = new Set(['#', 'X', 'B', '?', '!', 'u', 'N', '[', ']', '{', '}']);
const ENEMY = new Set(['g', 'k', 'f', 'p', 'r', 'c', 'A', 'H', 'O']);

function validate(id, rows) {
  const problems = validateLevel(rows, budget);
  if (!rows.some((r) => r.includes('1'))) problems.push('no player start');
  if (!rows.some((r) => r.includes('F'))) problems.push('no goal');
  return problems.map((p) => `${id}: ${p}`);
}

/** No eight-column stretch may match the corpus, once both are canonicalised. */
async function originality(rows) {
  const dir = process.env.VGLC_DIR;
  if (!dir) return { checked: false };

  const canonOurs = (ch) => (SOLID.has(ch) ? 'X' : ENEMY.has(ch) ? 'E' : ch === 'o' ? 'o' : '-');
  const canonCorpus = (ch) => ('XSQ?<>[]'.includes(ch) ? 'X' : ch === 'E' ? 'E' : ch === 'o' ? 'o' : '-');

  const windows = (grid, canon) => {
    const w = grid[0].length;
    const cols = [];
    for (let x = 0; x < w; x++) {
      cols.push(grid.map((row) => canon(row[x] || ' ')).join(''));
    }
    const out = new Set();
    for (let x = 0; x + 8 <= w; x++) out.add(cols.slice(x, x + 8).join('|'));
    return out;
  };

  const mine = windows(rows, canonOurs);
  let hits = 0;
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.txt'))) {
    const grid = (await readFile(join(dir, file), 'utf8')).split('\n').filter((r) => r.length);
    // Both grids are trimmed to the same 14 bottom rows before comparing.
    const theirs = windows(grid.slice(-14), canonCorpus);
    for (const key of theirs) if (mine.has(key)) hits++;
  }
  return { checked: true, hits };
}

/* --------------------------------- main --------------------------------- */

const PLAN = [
  { id: '5-1', palette: 'meadow', theme: 'grass', bg: 'hills', music: 'level', width: 210 },
  { id: '5-2', palette: 'dunes', theme: 'desert', bg: 'dunes', music: 'level', width: 230 },
  { id: '5-3', palette: 'glacier', theme: 'ice', bg: 'peaks', music: 'level', width: 240 },
];

const built = [];
const failures = [];

for (const spec of PLAN) {
  let rows = null;
  let notes = [];
  let problems = ['not attempted'];
  for (let attempt = 0; attempt < 40 && problems.length; attempt++) {
    const seed = SEED + attempt * 7919 + spec.id.charCodeAt(2) * 104729;
    rnd = mulberry32(seed);
    const build = { palette: spec.palette, targetWidth: spec.width };
    const plain = buildLevel(build);
    rows = plain.rows;
    notes = [];

    const hot = TELEMETRY?.levels.get(spec.id);
    if (hot) {
      const plan = planTuning(hot, plain.trace);
      notes = plan.notes;
      if (plan.tuning.size) {
        rnd = mulberry32(seed);
        rows = buildLevel({ ...build, tuning: plan.tuning }).rows;
      }
    }
    problems = validate(spec.id, rows);
  }
  if (problems.length) {
    failures.push(...problems);
    continue;
  }
  const orig = await originality(rows);
  if (orig.checked && orig.hits > 0) {
    failures.push(`${spec.id}: ${orig.hits} eight-column windows match the corpus`);
    continue;
  }
  built.push({ spec, rows, orig, notes });
}

if (failures.length) {
  console.error('\nGeneration failed:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

const body = built.map(({ spec, rows }) => {
  const lines = rows.map((r) => `      ${JSON.stringify(r)},`).join('\n');
  return `  '${spec.id}': {
    theme: '${spec.theme}', bg: '${spec.bg}', music: '${spec.music}',
    rows: [
${lines}
    ],
  },`;
}).join('\n');

const out = `/**
 * GENERATED FILE — do not edit by hand.
 *
 *   node tools/mine-pacing.mjs     (once, with VGLC_DIR set)
 *   node tools/gen-levels.mjs      (rebuilds this file)
 *
 * The pacing comes from tools/pacing-stats.json; every set piece in here is
 * this game's own. See the header of tools/gen-levels.mjs for the reasoning.
 *
 * Seed: ${SEED}
 */

export const GENERATED_LEVELS = {
${body}
};
`;

await writeFile(join(ROOT, 'src/data/generated.js'), out);

console.log(`\nGenerated ${built.length} levels with seed ${SEED}:\n`);
for (const { spec, rows, orig } of built) {
  const cols = rows[0].length;
  const enemies = rows.join('').split('').filter((ch) => ENEMY.has(ch)).length;
  const coins = rows.join('').split('').filter((ch) => ch === 'o').length;
  console.log(`  ${spec.id}  ${String(cols).padStart(3)} cols   ${
    String(enemies).padStart(2)} enemies   ${String(coins).padStart(2)} coins   `
    + `originality ${orig.checked ? `${orig.hits} corpus matches` : 'not checked (set VGLC_DIR)'}`);
}

if (TELEMETRY) {
  console.log(`\nTelemetry: ${TELEMETRY_FILE}, ${TELEMETRY.events} events`
    + `  (cluster >= ${RULES.cluster}, attempts elsewhere >= ${RULES.elsewhere})\n`);
  let acted = 0;
  for (const { spec, notes } of built) {
    for (const note of notes) console.log(`  ${spec.id}  ${note}`);
    acted += notes.length;
  }
  for (const id of TELEMETRY.levels.keys()) {
    if (!PLAN.some((spec) => spec.id === id)) {
      console.log(`  ignored  ${id}  hotspots found, but this level is not generated here`);
    }
  }
  // A near-miss is worth a line each; the long tail of one-off deaths is not,
  // so it gets counted instead of listed.
  for (const ig of TELEMETRY.ignored.filter((i) => i.code === 'grind')) {
    const where = ig.from === ig.to ? `col ${ig.from}` : `cols ${ig.from}-${ig.to}`;
    console.log(`  ignored  ${ig.level}  ${ig.kind} ${where} (${ig.count})  —  only `
      + `${ig.elsewhere} attempts ended elsewhere, want ${RULES.elsewhere}`);
  }
  const thin = TELEMETRY.ignored.filter((i) => i.code === 'thin');
  for (const id of new Set(thin.map((i) => i.level))) {
    const mine = thin.filter((i) => i.level === id);
    console.log(`  ignored  ${id}  ${mine.length} more spots under the `
      + `${RULES.cluster}-event threshold (biggest ${Math.max(...mine.map((i) => i.count))})`);
  }
  if (!acted && !TELEMETRY.ignored.length) console.log('  nothing in the log to act on');
}

console.log('\n  wrote src/data/generated.js\n');
