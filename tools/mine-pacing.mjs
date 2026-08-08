/**
 * Mines PACING STATISTICS from a corpus of classic platformer levels.
 *
 *   VGLC_DIR=/path/to/vglc/levels node tools/mine-pacing.mjs
 *
 * Why this exists, and what it deliberately does not do
 * ----------------------------------------------------
 * A specific level layout is copyrighted expression and cannot be reused. The
 * statistical shape of the pacing — how often a challenge arrives, how wide
 * gaps are as a fraction of what the player's jump can clear, how enemies
 * cluster, how the density ramps from the start of a level to its end — is
 * fact and method, not expression.
 *
 * So this tool reads a corpus that lives OUTSIDE the repository, throws the
 * layouts away, and writes nothing but aggregate numbers to
 * `tools/pacing-stats.json`. The corpus is never committed, never bundled and
 * never shipped. The generator downstream (tools/gen-levels.mjs) reads only
 * those numbers and builds levels out of this game's own set pieces.
 *
 * Corpus tile alphabet (VGLC "Processed" encoding):
 *   -  empty        X  solid        S  breakable block
 *   Q  ? block w/ coin   ?  ? block w/ power-up
 *   E  enemy        o  coin         < > [ ]  pipe        B b  cannon
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = process.env.VGLC_DIR;

if (!DIR) {
  console.error(`Set VGLC_DIR to a local checkout of the level corpus, e.g.

  git clone --depth 1 https://github.com/TheVGLC/TheVGLC /tmp/vglc
  VGLC_DIR="/tmp/vglc/Super Mario Bros/Processed" node tools/mine-pacing.mjs

Keep that checkout outside this repository: only the aggregate statistics in
tools/pacing-stats.json belong here.`);
  process.exit(2);
}

const SOLID = new Set(['X', 'S', 'Q', '?', '<', '>', '[', ']']);
const BLOCK = new Set(['S', 'Q', '?']);

/* ------------------------------ statistics ------------------------------ */

function summarise(values) {
  if (!values.length) return { n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const histogram = {};
  for (const v of values) histogram[v] = (histogram[v] || 0) + 1;
  return {
    n: values.length,
    mean: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
    min: sorted[0],
    p25: at(0.25),
    median: at(0.5),
    p75: at(0.75),
    p90: at(0.9),
    max: sorted[sorted.length - 1],
    histogram,
  };
}

/** Run lengths of consecutive true values in a boolean array. */
function runs(flags) {
  const out = [];
  let run = 0;
  for (const f of flags) {
    if (f) run++;
    else if (run) { out.push(run); run = 0; }
  }
  if (run) out.push(run);
  return out;
}

function analyse(grid) {
  const h = grid.length;
  const w = grid[0].length;
  const col = (x) => grid.map((row) => row[x]);

  // Floor height per column: the topmost solid tile in the bottom half.
  const floor = [];
  for (let x = 0; x < w; x++) {
    const c = col(x);
    let y = Math.floor(h / 2);
    while (y < h && !SOLID.has(c[y])) y++;
    floor.push(y < h ? y : null);          // null = bottomless gap
  }

  const isGap = floor.map((f) => f === null);
  const gapWidths = runs(isGap);
  const groundRuns = runs(isGap.map((g) => !g));

  // Steps: how far the floor jumps up or down where it is continuous.
  const stepsUp = [];
  const stepsDown = [];
  for (let x = 1; x < w; x++) {
    if (floor[x] === null || floor[x - 1] === null) continue;
    const d = floor[x - 1] - floor[x];      // positive = the ground rose
    if (d > 0) stepsUp.push(d);
    else if (d < 0) stepsDown.push(-d);
  }

  // Enemies: column positions, spacing between them, and cluster sizes.
  const enemyCols = [];
  for (let x = 0; x < w; x++) if (col(x).includes('E')) enemyCols.push(x);
  const enemySpacing = enemyCols.slice(1).map((x, i) => x - enemyCols[i]);
  const clusters = [];
  let cluster = 1;
  for (let i = 1; i < enemyCols.length; i++) {
    if (enemyCols[i] - enemyCols[i - 1] <= 3) cluster++;
    else { clusters.push(cluster); cluster = 1; }
  }
  if (enemyCols.length) clusters.push(cluster);

  // Block furniture: horizontal runs, how high they float above the floor,
  // and how many of them are rewards rather than plain bricks.
  const blockRuns = [];
  const blockHeights = [];
  let question = 0;
  let plain = 0;
  for (let y = 0; y < h; y++) {
    const flags = [];
    for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      flags.push(BLOCK.has(ch));
      if (ch === 'Q' || ch === '?') question++;
      else if (ch === 'S') plain++;
      if (BLOCK.has(ch) && floor[x] !== null) blockHeights.push(floor[x] - y);
    }
    blockRuns.push(...runs(flags));
  }

  // Coins, counted as horizontal groups.
  const coinGroups = [];
  for (let y = 0; y < h; y++) {
    coinGroups.push(...runs([...grid[y]].map((ch) => ch === 'o')));
  }

  // Pipes: height of each pipe column pair.
  const pipeHeights = [];
  for (let x = 0; x < w; x++) {
    const c = col(x);
    if (!c.includes('<')) continue;
    pipeHeights.push(c.filter((ch) => ch === '<' || ch === '[').length);
  }

  /* Challenges — the unit the pacing is actually made of. A column counts as
   * a challenge when it starts a gap, holds an enemy, or steps up by 2+. */
  const challenge = new Array(w).fill(false);
  for (let x = 0; x < w; x++) {
    if (isGap[x] && !isGap[x - 1]) challenge[x] = true;
    if (col(x).includes('E')) challenge[x] = true;
    if (x > 0 && floor[x] !== null && floor[x - 1] !== null && floor[x - 1] - floor[x] >= 2) {
      challenge[x] = true;
    }
  }
  const challengeCols = [];
  for (let x = 0; x < w; x++) if (challenge[x]) challengeCols.push(x);
  const challengeSpacing = challengeCols.slice(1).map((x, i) => x - challengeCols[i]);
  const intro = challengeCols.length ? challengeCols[0] : w;

  // Density per quarter of the level: the ramp.
  const quarters = [0, 0, 0, 0];
  for (const x of challengeCols) quarters[Math.min(3, Math.floor((x / w) * 4))]++;
  const quarterDensity = quarters.map((c) => Number(((c / (w / 4)) * 100).toFixed(1)));

  return {
    width: w,
    gapWidths,
    groundRuns,
    stepsUp,
    stepsDown,
    enemyCount: enemyCols.length,
    enemySpacing,
    clusters,
    blockRuns,
    blockHeights,
    question,
    plain,
    coinGroups,
    pipeHeights,
    challengeSpacing,
    intro,
    quarterDensity,
    challengeCount: challengeCols.length,
  };
}

/* --------------------------------- main --------------------------------- */

const files = (await readdir(DIR)).filter((f) => f.endsWith('.txt')).sort();
if (!files.length) {
  console.error(`no .txt levels found in ${DIR}`);
  process.exit(2);
}

const all = [];
for (const file of files) {
  const grid = (await readFile(join(DIR, file), 'utf8')).split('\n').filter((r) => r.length);
  all.push(analyse(grid));
}

const cat = (key) => all.flatMap((a) => a[key]);
const totalCols = all.reduce((sum, a) => sum + a.width, 0);
const totalEnemies = all.reduce((sum, a) => sum + a.enemyCount, 0);
const totalChallenges = all.reduce((sum, a) => sum + a.challengeCount, 0);
const question = all.reduce((sum, a) => sum + a.question, 0);
const plain = all.reduce((sum, a) => sum + a.plain, 0);

const quarterDensity = [0, 1, 2, 3].map((q) => Number(
  (all.reduce((sum, a) => sum + a.quarterDensity[q], 0) / all.length).toFixed(1),
));

const stats = {
  note: 'Aggregate pacing statistics only. No level layout is stored, derivable '
    + 'or shipped from this file. Regenerate with tools/mine-pacing.mjs.',
  corpus: { levels: files.length, columns: totalCols },
  gapWidth: summarise(cat('gapWidths')),
  groundRun: summarise(cat('groundRuns')),
  stepUp: summarise(cat('stepsUp')),
  stepDown: summarise(cat('stepsDown')),
  challengeSpacing: summarise(cat('challengeSpacing')),
  introSafeColumns: summarise(all.map((a) => a.intro)),
  enemySpacing: summarise(cat('enemySpacing')),
  enemyCluster: summarise(cat('clusters')),
  enemiesPer100: Number(((totalEnemies / totalCols) * 100).toFixed(2)),
  challengesPer100: Number(((totalChallenges / totalCols) * 100).toFixed(2)),
  blockRun: summarise(cat('blockRuns')),
  blockHeightAboveFloor: summarise(cat('blockHeights')),
  rewardBlockShare: Number((question / (question + plain)).toFixed(3)),
  coinGroup: summarise(cat('coinGroups')),
  pipeHeight: summarise(cat('pipeHeights')),
  levelWidth: summarise(all.map((a) => a.width)),
  densityRampByQuarter: quarterDensity,
};

await writeFile(join(ROOT, 'tools/pacing-stats.json'), `${JSON.stringify(stats, null, 2)}\n`);

console.log(`\nMined ${files.length} levels, ${totalCols} columns.\n`);
const line = (label, s) => console.log(
  `  ${label.padEnd(22)} median ${String(s.median).padStart(3)}   p90 ${String(s.p90).padStart(3)}`
  + `   max ${String(s.max).padStart(3)}   (n=${s.n})`,
);
line('gap width', stats.gapWidth);
line('ground run', stats.groundRun);
line('challenge spacing', stats.challengeSpacing);
line('enemy spacing', stats.enemySpacing);
line('enemy cluster', stats.enemyCluster);
line('block run', stats.blockRun);
line('block height', stats.blockHeightAboveFloor);
line('coin group', stats.coinGroup);
line('step up', stats.stepUp);
console.log(`\n  challenges / 100 cols  ${stats.challengesPer100}`);
console.log(`  enemies / 100 cols     ${stats.enemiesPer100}`);
console.log(`  reward block share     ${stats.rewardBlockShare}`);
console.log(`  density ramp           ${quarterDensity.join('  ')}`);
console.log('\n  wrote tools/pacing-stats.json\n');
