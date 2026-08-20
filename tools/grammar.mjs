/**
 * Grammar meter — does this game keep saying the same SENTENCE.
 *
 *   node tools/grammar.mjs            the whole game
 *   node tools/grammar.mjs --raw      per-level token strings
 *   node tools/grammar.mjs --json     machine-readable
 *
 * A REPORTING tool in the same sense `variety.mjs`, `difficulty.mjs` and
 * `curriculum.mjs` are: reads level data, prints numbers, writes nothing, and
 * is not wired into `tools/verify.mjs`.
 *
 * ## Why a fifth meter, when four already exist
 *
 * The owner, twice: *"the levels still feel too flat — not enough variation"*,
 * and *"ne tuntuvat tasaisilta ja toisteisilta"*. Four fitness functions were
 * already green when he said it the second time, so at least one of the things
 * he can feel is not on any of their axes.
 *
 * `variety.mjs` names the gap itself in its own closing paragraph — it measures
 * one thing, *"sanooko tämä maailma saman asian kahdesti"*, over eight-column
 * ARRANGEMENTS. Arrangements are words. Nothing in this repository measures the
 * sentence: the order the challenges arrive in, how long the calm between them
 * runs, whether the level goes anywhere over its length. Eight levels can be
 * built out of eight disjoint sets of words and still be eight copies of one
 * sentence, and every existing meter would call that a good night's work.
 *
 * That is not a hypothetical. `src/data/generator.js` builds every level with
 *
 *     intro; while (x < width) { rest(); piece = weightedDraw(); piece(); }
 *
 * — a stationary first-order draw with one rule against immediate repeats. The
 * only thing that varies along a level's length is `restScale`, off a
 * four-bucket ramp. Every generated level is therefore the same sentence with
 * the nouns swapped, and this file exists to put a number on how much.
 *
 * ## WHAT A SENTENCE IS, EXACTLY
 *
 * One letter per column of the route band, from a seven-letter alphabet, by
 * priority — the most salient thing a player has to deal with in that column:
 *
 *     H  a lethal tile (lava, glacier crack, spikes)
 *     V  a void: nothing standable under this column at all
 *     E  an enemy
 *     O  structure overhead: a block, a plank, a ledge above the walking floor
 *     S  the ground CHANGES HEIGHT here: a step, a slope, the lip of a hill
 *     C  something to collect, and nothing else
 *     .  calm floor
 *
 * That string, run-length encoded, is the level's CLAUSE SEQUENCE: each
 * challenge run becomes one clause and each calm run becomes a rest, bucketed
 * short / medium / long. Nine symbols. Clause LENGTHS are dropped on purpose
 * (except for rests, where the length *is* the pacing) so the measure reads
 * structure rather than size — a wide gap and a narrow gap are the same word in
 * the same place, and `difficulty.mjs` is where the difference belongs.
 *
 * ## THE TRAP, AND IT IS THE REASON FOR EVERY NULL BELOW
 *
 * A raw diversity statistic over eight short strings is mostly sampling noise.
 * Two levels drawn from *the identical* random grammar still differ, because
 * three hundred columns is a small sample; a meter that reported that
 * difference as variety would hand the current generator a good score for
 * being random, which is exactly the thing being complained about.
 *
 * So nothing here is reported raw. Every number is an EXCESS over a null that
 * holds the level's material fixed and destroys only its arrangement:
 *
 *   - KAARI (arc, within a level) compares the level's own drift along its
 *     length against the same clauses **in a random order**. Same clauses, same
 *     rests, same lengths, same everything — only the sequence is shuffled. A
 *     level that is one stationary process from start to finish scores 0 by
 *     construction, however busy it is. A level that opens quietly, tightens,
 *     and ends in a gauntlet scores high, because no shuffle of its parts
 *     reproduces that shape.
 *
 *   - MURRE (dialect, between levels) compares the spread of the levels'
 *     clause-bigram distributions against levels **resampled from the pooled
 *     grammar of the same set**. That null is precisely the hypothesis "these
 *     were all built by one weighted draw", and MURRE is the ratio of the two,
 *     so 1.00 is not a failure to be different — it is a positive
 *     identification of one grammar.
 *
 *   - TOISTO (repetition, between levels) is the share of a level's five-clause
 *     phrases that turn up verbatim in one other level of the set. It is read
 *     against the FIXED POINT below rather than against a per-set null, and the
 *     reason is written out at `toistoNull`: a null refitted to the set cannot
 *     answer "is this whole set one grammar", because it has been handed that
 *     grammar to imitate.
 *
 * ## THE FIXED POINT, which is what makes any of the above a scale
 *
 * `calibration()` builds eight levels with **nothing but the seed changed** and
 * measures them the same way. That is "one grammar, rolled eight times",
 * observed rather than argued, and it is the far end of every scale here. The
 * hand-made levels are the other end, and they are not a control — they differ
 * in theme, length, world and intent all at once — so they are reported as a
 * comparison and never as a null.
 *
 * ## WHAT THIS DOES NOT MEASURE
 *
 * Not difficulty, not fairness, not playability — three tools already do those
 * and a level can score well here by being wildly, unfairly shaped. Not
 * vocabulary: a level made of one mechanic can have a beautiful arc, and
 * `variety.mjs` is the meter that would object. Not the vertical dimension
 * beyond the route band's own rows, and not hidden bands, for the same reason
 * `variety.mjs` gives. And it cannot tell a good arc from a bad one: it knows
 * only that the level is not the same all the way through.
 */

import { pathToFileURL } from 'node:url';
import { getLevel } from '../src/data/levels.js';
import { WORLDS } from '../src/data/worlds.js';
import { RULE_CONSTANTS } from '../src/data/rules.js';
import { FEATURES, CURRICULUM_USES } from './curriculum.mjs';
import { mulberry32, buildLevel } from '../src/data/generator.js';

const args = process.argv.slice(2);
const RAW = args.includes('--raw');
const JSON_OUT = args.includes('--json');
const IS_MAIN = !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

const { ROWS } = RULE_CONSTANTS;

/* ============================== the alphabet ============================== */

/**
 * Fourth copy of `SOLID` in this tree, and copied for the reason the third one
 * gives: `rules.js` keeps its private, and a printing tool should not widen a
 * validator's surface. `tools/verify.mjs` compares the copies as strings.
 */
const SOLID = new Set(['#', 'X', 'B', '?', '!', '*', 'u', 'N', '[', ']', '{', '}', '%', '(', ')', 'S', 'C', 'I', 'J']);
const SEMI = new Set(['-']);
const SLOPE = new Set(['/', '\\']);
const stands = (ch) => SOLID.has(ch) || SLOPE.has(ch);

/** Straight off the curriculum's tables, so the two tools cannot disagree. */
const ENEMY_CHARS = new Set(FEATURES.filter((f) => f.enemy).map((f) => f.chars));
const HAZARD_CHARS = new Set(FEATURES.filter((f) => f.hazard).flatMap((f) => [...f.chars]));
const REWARD_CHARS = new Set(['o', '?', '!', '*', 'u']);

/** The seven letters, most salient first. Order IS the priority. */
export const TOKENS = ['H', 'V', 'E', 'O', 'S', 'C', '.'];

/* ============================== grid reading ============================== */

/** The band the player starts in — same four lines as `variety.mjs`. */
function routeBand(rows) {
  if (rows.length <= ROWS) return rows;
  const start = rows.findIndex((row) => row.includes('1'));
  const top = Math.floor(Math.max(start, 0) / ROWS) * ROWS;
  return rows.slice(top, top + ROWS);
}

/**
 * The top of the standable column at `x`, or `null` if there is nothing to
 * stand on at all.
 *
 * Walked up from the bottom rather than down from the top on purpose: down
 * would find the first floating plank and call it the ground, and then a level
 * with planks over a pit would read as having a floor. Up from the bottom finds
 * the surface a walking body actually meets, which is also what makes a pipe
 * read as ground (you walk over it) and a ledge read as overhead structure.
 */
function groundTop(band, x) {
  const h = band.length;
  let y = h - 1;
  if (!stands(band[y][x] || ' ')) return null;
  while (y > 0 && stands(band[y - 1][x] || ' ')) y--;
  return y;
}

/**
 * One level's sentence: a token per column.
 *
 * ## `S` IS A CHANGE OF HEIGHT AND NOT A HEIGHT, and getting that wrong cost a
 * whole measurement
 *
 * `S` first meant "the ground here is off the level's usual height", which
 * sounds like the same thing and is not. The terrain pass
 * (`src/data/terrain.js`) lifts WHOLE STRETCHES and leaves them lifted, so that
 * definition painted **45 % of every generated level** with one letter — and a
 * plateau forty columns long is not forty columns of terrain challenge, it is
 * forty columns of walking. The sentence came out as `S x S x S x`, the letter
 * drowned every other, and a prototype that changed the level's whole syntax
 * measured as no change at all because the signal was underneath the noise.
 *
 * So `S` is the column where the surface MOVES: a step, a slope tile, the lip
 * of a hill. Flat ground is flat ground at any height, which is what it is to
 * walk on, and the lift then shows up where it belongs — as the two edges it
 * actually gives the player rather than as everything between them.
 *
 * ## THE LID IS NOT STRUCTURE, and finding that out is what this rule is
 *
 * The first version of this function had no such rule, and it scored the
 * factory and the fortress as the most stationary levels in the game by a
 * distance — 4-5's composition moved 0.054 bits against 1-1's 0.168. It was an
 * artefact and a total one. `ceilingPass` roofs those two themes over their
 * whole width, so **every column had something overhead** and the letter `O`
 * swallowed the level; the score was reading a decoration that is identical in
 * every column of every level of those worlds.
 *
 * So a row that is solid across (nearly) the whole level and sits clear above
 * the walking floor is furniture and is struck out before anything is read off
 * the column. Same argument `variety.mjs` makes for folding the flag and the
 * start marker to air: a tile every column has says nothing about any column.
 * The rule is deliberately about the row's own uniformity rather than about a
 * named theme, so a hand-made level that grows a roof gets the same treatment
 * as a generated one — and the ground slab, which is also nearly solid across,
 * is safe because the test only looks above the floor.
 */
const LID_SHARE = 0.9;

export function tokensOf(rows) {
  const band = routeBand(rows);
  const w = band[0].length;
  const tops = [];
  for (let x = 0; x < w; x++) tops.push(groundTop(band, x));

  const counts = new Map();
  for (const t of tops) if (t !== null) counts.set(t, (counts.get(t) || 0) + 1);
  let base = band.length - 2;
  let bestN = -1;
  for (const [t, n] of counts) if (n > bestN) { base = t; bestN = n; }

  /* The lid test needs a height to sit above, and the modal ground is still the
   * right one for that even though `S` no longer uses it. */
  const lid = new Set();
  for (let y = 0; y < base - 1; y++) {
    let solid = 0;
    for (let x = 0; x < w; x++) if (SOLID.has(band[y][x] || ' ')) solid++;
    if (solid / w >= LID_SHARE) lid.add(y);
  }

  const out = [];
  for (let x = 0; x < w; x++) {
    const col = band.map((row, y) => (lid.has(y) ? ' ' : row[x] || ' '));
    const top = tops[x];
    let tok = '.';
    if (col.some((ch) => HAZARD_CHARS.has(ch))) tok = 'H';
    else if (top === null) tok = 'V';
    else if (col.some((ch) => ENEMY_CHARS.has(ch))) tok = 'E';
    else if (col.slice(0, top).some((ch) => SOLID.has(ch) || SEMI.has(ch))) tok = 'O';
    else if (col.some((ch) => SLOPE.has(ch)) || (x > 0 && tops[x - 1] !== null && tops[x - 1] !== top)) tok = 'S';
    else if (col.some((ch) => REWARD_CHARS.has(ch))) tok = 'C';
    out.push(tok);
  }
  return out.join('');
}

/* ============================== clauses =================================== */

/**
 * Run-length encoding of a sentence, as clauses.
 *
 * Rests carry a bucketed length because in this game the calm between
 * challenges is the pacing, and pacing is grammar — it is the one number
 * `mine-pacing.mjs` mines and the one thing `restScale` moves. Challenge runs
 * drop their length, so the measure cannot be moved by making a gap wider.
 *
 * The buckets are the corpus's own shape rather than round numbers:
 * `pacing-stats.json`'s challenge spacing has its median at 6 and its p90 at
 * 19, so short / medium / long is "under the median", "up to p90", "past it".
 */
const REST_SHORT = 6;
const REST_LONG = 19;
export const CLAUSE_ALPHABET = ['H', 'V', 'E', 'O', 'S', 'C', 'r0', 'r1', 'r2'];

export function clausesOf(sentence) {
  const runs = [];
  for (let i = 0; i < sentence.length;) {
    let j = i;
    while (j < sentence.length && sentence[j] === sentence[i]) j++;
    runs.push({ tok: sentence[i], len: j - i });
    i = j;
  }
  return runs.map((r) => (r.tok !== '.' ? r.tok
    : r.len <= REST_SHORT ? 'r0' : r.len <= REST_LONG ? 'r1' : 'r2'));
}

/** The runs themselves, needed by the shuffle null: it moves whole runs. */
export function runsOf(sentence) {
  const runs = [];
  for (let i = 0; i < sentence.length;) {
    let j = i;
    while (j < sentence.length && sentence[j] === sentence[i]) j++;
    runs.push({ tok: sentence[i], len: j - i });
    i = j;
  }
  return runs;
}

/* ============================== information =============================== */

/** Additive smoothing with one pseudo-observation spread over the bins. */
function normalise(counts, bins) {
  const alpha = 1 / bins;
  let total = 0;
  for (const c of counts) total += c;
  const denom = total + 1;
  return counts.map((c) => (c + alpha) / denom);
}

const log2 = (v) => Math.log(v) / Math.LN2;

/** Jensen–Shannon divergence in bits: 0 identical, 1 disjoint. */
function jsd(p, q) {
  let out = 0;
  for (let i = 0; i < p.length; i++) {
    const m = (p[i] + q[i]) / 2;
    if (p[i] > 0) out += (p[i] / 2) * log2(p[i] / m);
    if (q[i] > 0) out += (q[i] / 2) * log2(q[i] / m);
  }
  return out;
}

function meanPairwise(vectors) {
  if (vectors.length < 2) return 0;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) { sum += jsd(vectors[i], vectors[j]); n++; }
  }
  return sum / n;
}

/* ============================ KAARI: the arc ============================== */

const SEGMENTS = 8;
const SHUFFLES = 300;

/** Token histogram of a slice of a sentence. */
function tokenHist(sentence) {
  const counts = TOKENS.map(() => 0);
  for (const ch of sentence) counts[TOKENS.indexOf(ch)]++;
  return normalise(counts, TOKENS.length);
}

/**
 * How much the level's own composition moves along its length: mean pairwise
 * JSD between the token histograms of `SEGMENTS` equal slices.
 *
 * Equal slices by COLUMN and not by clause, because the player experiences the
 * level in columns — a stretch made of one very long rest is one experience
 * however few clauses it contains.
 */
function drift(sentence) {
  const n = sentence.length;
  const hists = [];
  for (let s = 0; s < SEGMENTS; s++) {
    const a = Math.floor((s * n) / SEGMENTS);
    const b = Math.floor(((s + 1) * n) / SEGMENTS);
    if (b > a) hists.push(tokenHist(sentence.slice(a, b)));
  }
  return meanPairwise(hists);
}

/** Fisher–Yates against a seeded stream, so every number here is reproducible. */
function shuffled(arr, rnd) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const rebuild = (runs) => runs.map((r) => r.tok.repeat(r.len)).join('');

/**
 * KAARI: the level's drift, in standard deviations above what the same runs in
 * a random order produce.
 *
 * The null keeps every run — its letter and its exact length — and moves only
 * where it sits. So the level's difficulty, its vocabulary, its enemy count,
 * its gap widths and its total calm are all held fixed by construction, and
 * the only thing the score can be bought with is arrangement.
 */
export function kaari(sentence, seed = 1) {
  const runs = runsOf(sentence);
  const observed = drift(sentence);
  const rnd = mulberry32(seed);
  const samples = [];
  for (let i = 0; i < SHUFFLES; i++) samples.push(drift(rebuild(shuffled(runs, rnd))));
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length) || 1e-9;
  return { observed, null: mean, sd, z: (observed - mean) / sd };
}

/* ========================== MURRE: the dialect ============================ */

const BIGRAM_BINS = CLAUSE_ALPHABET.length * CLAUSE_ALPHABET.length;

function bigramVec(clauses) {
  const counts = new Array(BIGRAM_BINS).fill(0);
  for (let i = 0; i + 1 < clauses.length; i++) {
    const a = CLAUSE_ALPHABET.indexOf(clauses[i]);
    const b = CLAUSE_ALPHABET.indexOf(clauses[i + 1]);
    if (a >= 0 && b >= 0) counts[a * CLAUSE_ALPHABET.length + b]++;
  }
  return normalise(counts, BIGRAM_BINS);
}

/** The first-order chain the whole set looks like, as transition rows. */
function pooledChain(sequences) {
  const n = CLAUSE_ALPHABET.length;
  const trans = Array.from({ length: n }, () => new Array(n).fill(0));
  const start = new Array(n).fill(0);
  for (const seq of sequences) {
    if (seq.length) start[CLAUSE_ALPHABET.indexOf(seq[0])]++;
    for (let i = 0; i + 1 < seq.length; i++) {
      const a = CLAUSE_ALPHABET.indexOf(seq[i]);
      const b = CLAUSE_ALPHABET.indexOf(seq[i + 1]);
      if (a >= 0 && b >= 0) trans[a][b]++;
    }
  }
  const rowise = trans.map((row) => normalise(row, n));
  return { start: normalise(start, n), trans: rowise };
}

const drawFrom = (dist, rnd) => {
  let roll = rnd();
  for (let i = 0; i < dist.length; i++) { roll -= dist[i]; if (roll <= 0) return i; }
  return dist.length - 1;
};

function sampleChain(chain, length, rnd) {
  const out = [];
  let s = drawFrom(chain.start, rnd);
  for (let i = 0; i < length; i++) {
    out.push(CLAUSE_ALPHABET[s]);
    s = drawFrom(chain.trans[s], rnd);
  }
  return out;
}

const MURRE_REPS = 200;

/**
 * MURRE: how far apart this set of levels' grammars are, as a MULTIPLE of the
 * spread the same number of levels of the same lengths, drawn from the set's
 * own pooled first-order grammar, would show.
 *
 * The null is the hypothesis stated as a generator. If the levels really were
 * produced by one weighted draw, resampling them from the chain they imply
 * reproduces their spread exactly and the ratio lands at 1.00. Above 1.00 is
 * spread the pooled chain cannot account for — levels that are built
 * differently rather than rolled differently.
 *
 * **The ratio is the headline and the z-score is printed beside it**, and that
 * is the second thing this file got wrong before it got right. z was the
 * headline first, and z grows with how many levels are being compared: the
 * null's standard deviation shrinks as the pairs multiply, so a set of 36
 * levels scores a bigger z than a set of 28 for the same *shape* of
 * disagreement. Comparing the hand-made levels with the generated ones is the
 * whole reason this function exists and the two sets are not the same size, so
 * the headline has to be the one number that does not care.
 */
export function murre(sequences, seed = 7) {
  const observed = meanPairwise(sequences.map(bigramVec));
  const chain = pooledChain(sequences);
  const rnd = mulberry32(seed);
  const samples = [];
  for (let r = 0; r < MURRE_REPS; r++) {
    const fake = sequences.map((seq) => sampleChain(chain, seq.length, rnd));
    samples.push(meanPairwise(fake.map(bigramVec)));
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length) || 1e-9;
  return { observed, null: mean, sd, ratio: observed / mean, z: (observed - mean) / sd };
}

/* ========================== TOISTO: shared phrases ======================== */

const PHRASE = 5;

/**
 * How much of one level's phrasing you have already read in ONE OTHER level of
 * the set: the share of A's distinct five-clause phrases that also occur in B,
 * averaged over every ordered pair (A, B).
 *
 * Five clauses is roughly "a rest, a challenge, a rest, a challenge, a rest" —
 * one breath of level. Lengths are already out of the clause alphabet for
 * challenges, so a repeated phrase here is a repeated *shape*, not a repeated
 * piece of grid; `variety.mjs` and `originality.mjs` are the tools that look at
 * grid, and this number is deliberately blind to it.
 *
 * **Pairwise and not "shared with anybody"**, which is the version this
 * function had first and had to lose for the same reason MURRE lost its
 * z-score headline: "does this phrase occur elsewhere in the set" rises with
 * the size of the set on its own, so the 36 hand-made levels would have been
 * charged for being 36. A pair is a pair whatever the set does.
 */
export function toisto(entries) {
  const mine = entries.map(({ clauses }) => {
    const set = new Set();
    for (let i = 0; i + PHRASE <= clauses.length; i++) set.add(clauses.slice(i, i + PHRASE).join(' '));
    return set;
  });
  let sum = 0;
  let n = 0;
  for (let i = 0; i < mine.length; i++) {
    for (let j = 0; j < mine.length; j++) {
      if (i === j || !mine[i].size) continue;
      let shared = 0;
      for (const key of mine[i]) if (mine[j].has(key)) shared++;
      sum += (shared / mine[i].size) * 100;
      n++;
    }
  }
  return n ? sum / n : 0;
}

/**
 * TOISTO's per-set null — printed, and DELIBERATELY NOT THE HEADLINE.
 *
 * Phrase sharing rises on its own with how alike the levels' lengths are and
 * with how few clause symbols they use, so the obvious next move is a null:
 * replace each level with a sequence of the same length drawn from the set's
 * own pooled chain, recompute, take the ratio. That is what this does, and the
 * ratio it produces answers a genuinely different question from the one the
 * raw percentage answers. Both are printed because they disagree, and a column
 * that quietly disagreed with the headline would be worse than no column.
 *
 *   RAW TOISTO, read against the fixed point, answers **"is this set one
 *   grammar?"** The fixed point is one grammar and it scores 32.6 %; the
 *   generated levels score 28.9 % and the hand-made ones 11.5 %.
 *
 *   THE RATIO cannot answer that, and this is the trap in it: the null is
 *   *fitted to the set it is judging*. Hand a set of eight identical grammars
 *   to `pooledChain` and it returns that grammar, so the null reproduces the
 *   set's repetition and the ratio comes back near 1 — a set that is one
 *   grammar is exactly the set this null is blindest to. What the ratio does
 *   see is motif reuse beyond the set's own first-order statistics, and there
 *   the hand-made levels score HIGHER (1.51) than the generated ones (1.29).
 *   That is not a contradiction and it is not noise: hand-made levels are chunk
 *   playlists drawn from one shared library, so `pit`, `walkers` and `stairs`
 *   recur across them as literal phrases while their bigram statistics stay
 *   wide. Two true things about two different kinds of repetition.
 */
const TOISTO_REPS = 50;

export function toistoNull(sequences, seed = 11) {
  const chain = pooledChain(sequences);
  const rnd = mulberry32(seed);
  let sum = 0;
  for (let r = 0; r < TOISTO_REPS; r++) {
    sum += toisto(sequences.map((seq) => ({ clauses: sampleChain(chain, seq.length, rnd) })));
  }
  return sum / TOISTO_REPS;
}

/* ============================== the levels ================================ */

const WORLD_LEVELS = WORLDS.map((world) => ({
  id: world.id,
  levels: world.nodes.filter((n) => n.level).map((n) => n.level)
    .filter((id) => CURRICULUM_USES.has(id)),
}));

/**
 * A LEVEL YOU CLIMB HAS NO SENTENCE IN THIS SENSE, and it is dropped, counted
 * and named rather than scored.
 *
 * This meter reads a level left to right, because that is the axis a platformer
 * spends its length on. Three levels in this game do not: `6-K`, `7-T` and
 * `7-P` are twenty to eighty columns wide and forty rows tall, and the player
 * goes UP them. Reading one column at a time along a twenty-column climb yields
 * a three-clause sentence, and three clauses is not a grammar — it is a
 * rounding error that would then be averaged in with a three-hundred-column
 * level as though the two were the same kind of measurement.
 *
 * The test is the shape and not a list of ids: taller than one band and
 * narrower than `MIN_COLS`. A vertical level added tomorrow is excluded by
 * being vertical, and a list would have needed editing.
 */
const MIN_COLS = 120;
const isVertical = (level) => level.rows.length > ROWS && level.rows[0].length < MIN_COLS;

export function collect() {
  const out = [];
  const skipped = [];
  for (const world of WORLD_LEVELS) {
    for (const id of world.levels) {
      const level = getLevel(id);
      if (isVertical(level)) { skipped.push(id); continue; }
      const sentence = tokensOf(level.rows);
      out.push({
        id,
        world: world.id,
        handmade: !!level.chunks,
        cols: sentence.length,
        sentence,
        clauses: clausesOf(sentence),
      });
    }
  }
  out.skipped = skipped;
  return out;
}

/* ================================ report ================================== */

const pad = (s, n) => String(s).padEnd(n);
const num = (v, n = 1) => (Number.isFinite(v) ? v.toFixed(n) : '—');

function setStats(entries, seed) {
  const arcs = entries.map((e) => kaari(e.sentence, seed));
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const seqs = entries.map((e) => e.clauses);
  const m = entries.length > 1 ? murre(seqs, seed) : null;
  const t = toisto(entries);
  const tn = entries.length > 1 ? toistoNull(seqs, seed) : NaN;
  return {
    n: entries.length,
    kaari: mean(arcs.map((a) => a.z)),
    drift: mean(arcs.map((a) => a.observed)),
    murre: m ? m.ratio : NaN,
    murreZ: m ? m.z : NaN,
    toisto: t,
    toistoNull: tn,
    toistoRatio: t / tn,
  };
}

/**
 * THE GRADIENT TEST — same idea as `variety.mjs`'s ANSAN KOE and printed for
 * the same reason: a claim about what a meter rewards is worthless unless the
 * meter runs the experiment on itself.
 *
 * The manipulation is on the SENTENCE and not on the grid, because the sentence
 * is this meter's entire input — anything done to the grid reaches the score
 * only through it, so operating here is the strongest possible statement of
 * what the score can and cannot see.
 */
function gradient(entries) {
  /* The flattest level that has calm to work with. Both manipulations below
   * need somewhere to write and something to move, and picking the flattest
   * level outright once landed on a fortress made entirely of challenge — where
   * both experiments were silent no-ops that printed as "the meter cannot see
   * this", which is the one thing a self-test must never do quietly. */
  const usable = entries.filter((e) => runsOf(e.sentence).filter((r) => r.tok === '.').length >= 10);
  const target = usable.reduce((lo, e) => (kaari(e.sentence).z < kaari(lo.sentence).z ? e : lo));
  const before = kaari(target.sentence).z;
  const runs = runsOf(target.sentence);

  /* 1. CRAMMING: twelve more enemies, spread evenly over the level. No
   *    arrangement is created — the level is uniformly busier. */
  const crammed = target.sentence.split('');
  const spots = [];
  for (let i = 0; i < crammed.length; i++) if (crammed[i] === '.') spots.push(i);
  for (let k = 0; k < 12 && spots.length; k++) {
    crammed[spots[Math.floor(((k + 0.5) / 12) * spots.length)]] = 'E';
  }
  const cram = kaari(crammed.join('')).z;

  /* 2. ARRANGING: the very same runs, sorted so the calm collects at the front
   *    and the challenges at the back. Nothing added, nothing removed, nothing
   *    resized — an arc imposed on the material the level already has. */
  const sorted = runs.slice().sort((a, b) => (a.tok === '.' ? 0 : 1) - (b.tok === '.' ? 0 : 1));
  const arc = kaari(rebuild(sorted)).z;

  return { id: target.id, before, cram, arc };
}

/**
 * THE FIXED POINT: eight levels that are known, by construction, to be one
 * grammar rolled eight times.
 *
 * Every number above is a comparison, and a comparison needs something at the
 * far end of the scale that is not an argument. This is it: eight levels out of
 * `buildLevel` with **identical knobs and nothing but the seed changed** — the
 * same theme, the same width, the same weights, the same ramp. Whatever
 * "written by one grammar" scores, it scores here, and it is measured rather
 * than asserted.
 *
 * It is worth more than the hand-made comparison, because the hand-made levels
 * are not a control: they differ in theme, in length, in world and in author's
 * intent all at once. These differ in one number, and that number is the
 * generator's own random seed.
 */
function calibration(grammar = false) {
  const entries = [];
  for (let i = 0; i < 8; i++) {
    const built = buildLevel({ seed: 1000 + i * 7919, theme: 'grass', targetWidth: 320, grammar });
    const sentence = tokensOf(built.rows);
    entries.push({ id: `null-${i}`, sentence, clauses: clausesOf(sentence) });
  }
  return setStats(entries, 7);
}

function report() {
  const all = collect();
  const handmade = all.filter((e) => e.handmade);
  const generated = all.filter((e) => !e.handmade);

  const lines = [];
  const say = (s = '') => lines.push(s);

  say();
  say('  KIELIOPPIMITTARI — sanooko tämä peli saman LAUSEEN monta kertaa.');
  say();
  say('  AJAUMA = kuinka paljon kentän koostumus liikkuu sen mitassa, bitteinä.');
  say('  KAARI  = sama luku keskihajontoina siitä mitä SAMAT palaset satunnaisessa');
  say('           järjestyksessä tuottaisivat. 0 = kenttä on alusta loppuun sama');
  say('           prosessi, oli se kuinka tiheä tahansa.');
  say('  MURRE  = joukon kielioppien hajonta joukon OMAN yhteisen kieliopin');
  say('           tuottamana kerrannaisena. 1.00 = nämä kentät on tehty yhdellä');
  say('           arvonnalla eikä mikään niissä erota niitä toisistaan.');
  say(`  TOISTO = kuinka suuri osa kentän ${PHRASE} lauseen jaksoista löytyy myös`);
  say('           yhdestä toisesta kentästä, pareittain.');
  say();
  if (all.skipped.length) {
    say(`  Pystykentät jätetty pois (${all.skipped.length}): ${all.skipped.join(' ')} — `
      + 'kenttä jota kiivetään');
    say('  ei ole lause vasemmalta oikealle. Ks. `isVertical`.');
    say();
  }

  say(`  ${pad('KENTTÄ', 8)}${pad('SAR.', 6)}${pad('LÄHDE', 11)}${pad('KAARI', 8)}${pad('AJAUMA', 9)}${pad('NOLLA', 9)}LAUSEITA`);
  const worldRows = [];
  for (const world of WORLD_LEVELS) {
    const mine = all.filter((e) => e.world === world.id);
    if (!mine.length) continue;
    for (const e of mine) {
      const k = kaari(e.sentence);
      say(`  ${pad(e.id, 8)}${pad(e.cols, 6)}${pad(e.handmade ? 'käsintehty' : 'generoitu', 11)}`
        + `${pad(num(k.z, 2), 8)}${pad(num(k.observed, 4), 9)}${pad(num(k.null, 4), 9)}${e.clauses.length}`);
    }
    const s = setStats(mine, 7);
    worldRows.push({ id: world.id, ...s });
    say(`  ${pad(world.id, 8)}${pad('', 17)}${pad(num(s.kaari, 2), 8)}${pad(num(s.drift, 4), 18)}`
      + `MURRE ${num(s.murre, 2)}   TOISTO ${num(s.toisto, 1)} % (x${num(s.toistoRatio, 2)})`);
    say();
  }

  const sets = [
    ['KOKO PELI', all],
    ['käsintehdyt', handmade],
    ['generoidut', generated],
  ];
  say('  JOUKOITTAIN — se vertailu jonka takia tämä tiedosto on olemassa.');
  say('  Kaksi alinta riviä ovat ASTEIKON PÄÄT, molemmat mitattuja eikä');
  say('  arvattuja: kahdeksan kenttää joissa vaihtuu pelkkä siemen, ensin');
  say('  kielioppikerros pois päältä (toimitettu oletus) ja sitten päällä.');
  say(`  ${pad('JOUKKO', 14)}${pad('KENTTIÄ', 9)}${pad('KAARI', 9)}${pad('AJAUMA', 10)}${pad('MURRE', 9)}${pad('TOISTO', 10)}${pad('NOLLA', 9)}SUHDE`);
  const stats = {};
  for (const [name, set] of sets) {
    const s = setStats(set, 7);
    stats[name] = s;
    say(`  ${pad(name, 14)}${pad(s.n, 9)}${pad(num(s.kaari, 2), 9)}${pad(num(s.drift, 4), 10)}`
      + `${pad(num(s.murre, 2), 9)}${pad(`${num(s.toisto, 1)} %`, 10)}${pad(`${num(s.toistoNull, 1)} %`, 9)}${num(s.toistoRatio, 2)}`);
  }
  const cal = calibration(false);
  const calNew = calibration(true);
  stats.kiintopiste = cal;
  stats.kielioppi = calNew;
  say(`  ${pad('yksi kielioppi', 14)}${pad(cal.n, 9)}${pad(num(cal.kaari, 2), 9)}${pad(num(cal.drift, 4), 10)}`
    + `${pad(num(cal.murre, 2), 9)}${pad(`${num(cal.toisto, 1)} %`, 10)}${pad(`${num(cal.toistoNull, 1)} %`, 9)}${num(cal.toistoRatio, 2)}`);
  say(`  ${pad('sama, kieliopilla', 14)}${pad(calNew.n, 6)}${pad(num(calNew.kaari, 2), 9)}${pad(num(calNew.drift, 4), 10)}`
    + `${pad(num(calNew.murre, 2), 9)}${pad(`${num(calNew.toisto, 1)} %`, 10)}${pad(`${num(calNew.toistoNull, 1)} %`, 9)}${num(calNew.toistoRatio, 2)}`);
  say();

  const g = gradient(all);
  say('  GRADIENTTIKOE — mihin suuntaan tämä mittari osoittaa?');
  say();
  say(`  Koekenttä on pelin vähiten kaareva kenttä jossa on rauhaa: ${g.id}.`);
  say(`    lähtötaso                          ${num(g.before, 2)}`);
  say(`    + 12 vihollista tasavälein         ${num(g.cram, 2)}   ${num(g.cram - g.before, 2)}`);
  say(`    samat palaset järjestettynä        ${num(g.arc, 2)}   ${num(g.arc - g.before, 2)}`);
  say();
  say('    Ahtaminen ei osta kaarta: tasavälein lisätty tavara on yhtä');
  say('    tasaista kuin se mitä se korvasi. Järjestäminen ostaa, eikä se');
  say('    lisää yhtään palasta — sama sisältö, eri lause. Mittarin');
  say('    gradientti osoittaa siis järjestykseen eikä määrään, ja siksi');
  say('    tätä lukua ei voi nostaa vaikeuttamalla kenttää.');
  say();

  say('  TULOS');
  const hm = stats['käsintehdyt'];
  const gn = stats.generoidut;
  say(`    Käsintehdyt: KAARI ${num(hm.kaari, 2)}  AJAUMA ${num(hm.drift, 4)}  MURRE ${num(hm.murre, 2)}  TOISTO ${num(hm.toisto, 1)} % (x${num(hm.toistoRatio, 2)})`);
  say(`    Generoidut:  KAARI ${num(gn.kaari, 2)}  AJAUMA ${num(gn.drift, 4)}  MURRE ${num(gn.murre, 2)}  TOISTO ${num(gn.toisto, 1)} % (x${num(gn.toistoRatio, 2)})`);
  say(`    Kiintopiste: KAARI ${num(cal.kaari, 2)}  AJAUMA ${num(cal.drift, 4)}  MURRE ${num(cal.murre, 2)}  TOISTO ${num(cal.toisto, 1)} % (x${num(cal.toistoRatio, 2)})`);
  say(`    Sama kieliopilla: KAARI ${num(calNew.kaari, 2)}  AJAUMA ${num(calNew.drift, 4)}  MURRE ${num(calNew.murre, 2)}  TOISTO ${num(calNew.toisto, 1)} % (x${num(calNew.toistoRatio, 2)})`);
  const flattest = [...worldRows].sort((a, b) => a.kaari - b.kaari)[0];
  const same = [...worldRows].sort((a, b) => a.murre - b.murre)[0];
  say(`    Littein maailma: ${flattest.id} (KAARI ${num(flattest.kaari, 2)}).`);
  say(`    Yhdennäköisin maailma: ${same.id} (MURRE ${num(same.murre, 2)}).`);
  say();
  say('  Mitä tämä ei mittaa: vaikeutta, reilua opetusjärjestystä eikä');
  say('  läpäistävyyttä — ne ovat difficulty.mjs, curriculum.mjs ja');
  say('  playable.mjs. Eikä sanastoa: yhdestä mekaniikasta tehdyllä kentällä');
  say('  voi olla kaunis kaari, ja siitä valittaa variety.mjs. Eikä sitä onko');
  say('  kaari hyvä — vain sitä, ettei kenttä ole kauttaaltaan samaa.');
  say();

  return { lines, all, stats, gradient: g };
}

if (IS_MAIN) {
  const { lines, all, stats, gradient: g } = report();
  if (JSON_OUT) {
    console.log(JSON.stringify({
      levels: all.map((e) => ({
        id: e.id,
        world: e.world,
        handmade: e.handmade,
        cols: e.cols,
        kaari: kaari(e.sentence).z,
        clauses: e.clauses.length,
      })),
      sets: stats,
      gradient: g,
    }, null, 2));
  } else {
    console.log(lines.join('\n'));
    if (RAW) {
      console.log('\n  LAUSEET (yksi merkki per sarake)\n');
      for (const e of all) console.log(`  ${pad(e.id, 6)} ${e.sentence}`);
    }
  }
}
