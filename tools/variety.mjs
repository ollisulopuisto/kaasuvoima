/**
 * Vaihtelumittari — sanotaanko tässä maailmassa sama asia monta kertaa.
 *
 *   node tools/variety.mjs            koko peli
 *   node tools/variety.mjs --raw      ikkuna- ja palikkatilastot kentittäin
 *   node tools/variety.mjs --json     koneluettava muoto
 *
 * This is a REPORTING tool in the same sense `tools/difficulty.mjs` and
 * `tools/curriculum.mjs` are: it reads level data, prints numbers, writes
 * nothing, and is not wired into `tools/verify.mjs`. It exists because the two
 * meters the repo already has cannot answer the question the owner is actually
 * weighing while the worlds are being filled from four levels to eight.
 *
 * ## The question, and why the difficulty meter cannot answer it
 *
 * World 1 went to eight levels and its measured difficulty FELL, 125.6 → 111.3.
 * That number is not wrong: `difficulty.mjs` counts enemies, gaps and hazards
 * per hundred columns, world 1's vocabulary is deliberately four mechanics
 * wide, and none of the four new levels reaches past 112 against the fortress's
 * 220. But it is also not the risk. **Eight levels built out of the same four
 * mechanics score identically to four levels and can be twice as dull**, and
 * nothing anywhere in this repository measures dullness.
 *
 * So: this file. One sentence for what it measures, because everything below
 * follows from it —
 *
 *   > A level earns its place when it shows the player an ARRANGEMENT they have
 *   > not seen in this world before. Not a mechanic they have not seen: an
 *   > arrangement.
 *
 * ## THE TRAP, AND HOW THIS MEASURE AVOIDS IT
 *
 * The obvious variety score — count distinct mechanics per level, more is
 * better — would be actively harmful here, and it is worth being precise about
 * why rather than merely asserting it. It would fight three things at once:
 * DESIGN.md §5's one-screen rule, the curriculum's "one new thing at a time",
 * and the decision taken on 9.8.2026 to *narrow* world 1's vocabulary on
 * purpose (`src/data/levels/world1.js` records the four mechanics that were
 * moved out of 1-2 and 1-3 and where each of them went). A meter that scored
 * that morning's work as a regression would be a meter nobody runs twice.
 *
 * **Repetition is not the same as coherence, and a world is supposed to have a
 * character.** The measure separates the two by refusing to grade one of them:
 *
 *   - SANASTO, how many distinct features a world fields, is printed and NEVER
 *     scored. A narrow vocabulary is what "this world has an identity" looks
 *     like from the outside, and there is no number of mechanics a world ought
 *     to have.
 *   - UUTUUS, how much of each level is an arrangement the world has not shown
 *     yet, is the only thing this tool complains about. It is measured on the
 *     grid, so it counts NEW SHAPES rather than new mechanics.
 *
 * That split is what makes the quadrant at the bottom of the report readable:
 * a narrow world with high UUTUUS has a character, a narrow world with low
 * UUTUUS has run out of ideas, and — the case that proves the measure is not
 * the trap — **a wide world with low UUTUUS is still called out.** You cannot
 * buy your way to a good number by cramming mechanics in.
 *
 * And that last claim is not an argument, it is an experiment the tool runs on
 * itself every time: see ANSAN KOE at the bottom of the report. It stamps one
 * enemy the level already contains, and then one enemy the level has never
 * seen, into the SAME empty column of the SAME level, and prints both deltas.
 * They come out within a fraction of a point of each other, because the score
 * is blind to which species it is — it can only see that column 40 no longer
 * looks the way it did. Then it reverses the middle of a level's chunk playlist,
 * which adds no mechanic and no tile at all, and that buys several times more.
 * The gradient points at rearranging, not at cramming, and it is printed rather
 * than promised.
 *
 * ## WHAT AN ARRANGEMENT IS, EXACTLY
 *
 * An eight-column window of the route band, canonicalised. Eight is not a new
 * number: `tools/originality.mjs` chose it for the corpus check and its reason
 * transfers unchanged — *"shorter and any flat floor matches everything, longer
 * and a copy could hide by moving one tile"* — so the constant is imported from
 * there rather than typed again. The repository gets one idea of how big a
 * "piece of level" is.
 *
 * The canonicalisation is this file's own and is deliberately COARSER than the
 * grid and FINER than originality.mjs's four letters, because the two tools are
 * asking different questions:
 *
 *   - originality.mjs folds every enemy to one letter, because "did we copy
 *     somebody's arrangement" does not care which monster stands in the hole.
 *     For variety it is the opposite: a spike guy where a walker was IS a
 *     different room to play, so every enemy species keeps its own letter.
 *   - all hard terrain folds to one letter, because a brick wall and a stone
 *     wall are the same wall to jump over; but the blocks that GIVE you
 *     something, the note block, the switch, the crumbling plank, the plank you
 *     pass through, the pipe, lava, spikes, quicksand and the beanstalk each
 *     keep their own, because each is a different verb.
 *   - the flag, the fortress door and the player start fold to air. Every level
 *     has exactly one of each in the same place relative to its ends, and
 *     counting them would hand every level a few identical windows for free.
 *
 * **Trivial windows are excluded and counted separately.** A window is trivial
 * when all eight of its columns are identical AND contain nothing that moves or
 * can be picked up — that is, plain floor, plain sky, a plain wall, or the
 * middle of a plain hole. Every level is made of a great deal of it, it says
 * nothing about arrangement, and leaving it in would drag every world toward
 * every other world. The share that was dropped is printed, so the exclusion is
 * visible rather than quiet.
 *
 * **The route band only**, the same 15 rows `difficulty.mjs` measures, and for
 * the same reason: the sky and cave bands are optional rooms, and a level is
 * not more varied for having hidden a garden in one. It does mean this tool
 * cannot see the one thing hidden rooms are best at, which is stated again
 * under "mitä tämä ei mittaa".
 *
 * ## WHY THE SCALE IS NOT FROZEN, UNLIKE difficulty.mjs's
 *
 * `difficulty.mjs` divides by frozen references and says why at length: if the
 * whole game is made harder the scores must all rise, and a self-normalising
 * scale would report no change. That argument does not carry over, and the
 * reason is the shape of the question. "Is world 1 too easy" is absolute. "Is
 * world 1 duller than the rest of this game" is comparative — it is the
 * comparison the owner is making when deciding whether to fill the other seven
 * worlds the same way. So the reference here is the game's own median,
 * recomputed on every run and printed next to the verdict.
 *
 * The cost of that choice is real and is the first line of "mitä tämä ei
 * mittaa": a game that is monotonous everywhere measures as fine everywhere.
 * The absolute per-level percentages are therefore printed too, and they are
 * the ones to read if the suspicion is about the game and not about a world.
 *
 * It also means the tool reads whatever is in the tree rather than a count
 * pinned to any particular day, which matters right now: worlds are being
 * filled while this is being written, and every number below moves when they
 * are. Nothing here is written down that the tool could have measured.
 */
import { pathToFileURL } from 'node:url';
import { getLevel } from '../src/data/levels.js';
import { assemble } from '../src/data/chunks.js';
import { WORLDS } from '../src/data/worlds.js';
import { RULE_CONSTANTS } from '../src/data/rules.js';
import { WINDOW } from './originality.mjs';
import { FEATURES, CURRICULUM_USES } from './curriculum.mjs';

const args = process.argv.slice(2);
const RAW = args.includes('--raw');
const JSON_OUT = args.includes('--json');
const IS_MAIN = !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

const { ROWS, FLOOR } = RULE_CONSTANTS;

/* ========================== the canonical alphabet ======================== */

/**
 * Grid character → the letter an arrangement is spelled in. Anything not in
 * here and not an enemy marker is air: decoration, markers the engine consumes
 * at load, and the two ends of the level.
 *
 * Each fold is a claim that two tiles are THE SAME ROOM to play, and each one
 * is arguable, which is exactly why they are written out one per line instead
 * of being derived from `TILE_INFO`. `TILE_INFO` knows what a tile IS; this
 * table says which differences a player's hands can feel.
 */
const CANON = {
  '#': '#',   // ground
  X: '#',     // hard tile — a wall is a wall
  B: 'B',     /* brick: breakable from below and standable from above, which is
               * two verbs the plain wall does not have */
  '?': '?',   // gives you something
  '!': '?',   // ditto — what falls out differs, the shape and the bump do not
  '*': '?',
  u: '?',
  N: 'N',     // note block: bounces
  S: 'S',     // switch square
  '[': 'P',
  ']': 'P',
  '{': 'P',
  '}': 'P',
  '(': 'P',   /* the warp pipe folds to the ordinary pipe ON PURPOSE, and it is
               * the one fold worth defending here. `chunks/secrets.js` builds
               * the entire discoverability of the warp on it being drawn as an
               * ordinary pipe; a measure that could tell them apart would be
               * reading something the player cannot see. */
  ')': 'P',
  '%': '%',   // crumbling: it is leaving
  '-': '-',   // plank: through from below
  '^': '^',
  W: 'W',
  '~': '~',
  v: 'v',
  o: 'o',
  F: '.',     // flag, door, start: furniture every level has, folded to air
  D: '.',
  1: '.',
};

/** Every enemy marker keeps its own letter — see the header for why. */
const ENEMY_CHARS = new Set(FEATURES.filter((f) => f.enemy).map((f) => f.chars));
const canon = (ch) => (CANON[ch] !== undefined ? CANON[ch] : ENEMY_CHARS.has(ch) ? ch : '.');

/**
 * Characters whose presence stops a window being trivial: anything that moves,
 * anything you can collect, and quicksand — which looks like flat ground in a
 * column string and behaves like nothing else in the game.
 */
const ALIVE = new Set([...ENEMY_CHARS, 'o', '~']);

/* ============================== grid reading ============================== */

/**
 * The band the player starts in. Third copy of the same four lines in this
 * repository (`rules.js`, `difficulty.mjs`, `curriculum.mjs`) and copied for
 * the same stated reason: rules.js keeps its own private, and exporting it
 * would widen a validator's surface for a tool that only prints things.
 */
function routeBand(rows) {
  if (rows.length <= ROWS) return rows;
  const start = rows.findIndex((row) => row.includes('1'));
  const top = Math.floor(Math.max(start, 0) / ROWS) * ROWS;
  return rows.slice(top, top + ROWS);
}

/**
 * Every WINDOW-column arrangement of a level, in order, each marked trivial or
 * not. Returned as an array rather than a set because the count of windows a
 * level HAS is one of the numbers, and a set would silently drop a level's
 * repetition of itself.
 */
function windowsOf(rows) {
  const band = routeBand(rows);
  const w = band[0].length;
  const cols = [];
  for (let x = 0; x < w; x++) cols.push(band.map((row) => canon(row[x] || ' ')).join(''));
  const out = [];
  for (let x = 0; x + WINDOW <= w; x++) {
    const slice = cols.slice(x, x + WINDOW);
    const flat = slice.every((c) => c === slice[0])
      && ![...slice[0]].some((ch) => ALIVE.has(ch));
    out.push({ key: slice.join('|'), trivial: flat });
  }
  return out;
}

/** The non-trivial arrangements of a level, de-duplicated. */
const shapesOf = (rows) => new Set(windowsOf(rows).filter((w) => !w.trivial).map((w) => w.key));

/**
 * How much of `a` is also in `b`, as a share of `a`. Deliberately NOT symmetric
 * and not a Jaccard: the question asked of a level is "how much of what YOU
 * show has been shown already", and a short level compared with a long one
 * should not be excused by the long one's extra length.
 */
function coveredBy(a, b) {
  if (!a.size) return 0;
  let n = 0;
  for (const k of a) if (b.has(k)) n++;
  return (n / a.size) * 100;
}

/* ============================== the play order =========================== */

/**
 * Every level, world by world, in the order the map lists them — the same walk
 * `difficulty.mjs` makes (`world.nodes.filter(n => n.level)`), so the two tools
 * are looking at the same game in the same order.
 *
 * KNOWN LIMIT, AND IT IS THE ONLY PLACE ORDER MATTERS: world 2 forks, so two of
 * its levels are alternatives rather than a sequence, and "what the world had
 * already shown" is measured against nodes a given player may never have
 * played. `curriculum.mjs` solves this properly by enumerating play orders,
 * because a first encounter is a moment and moments have to be on somebody's
 * route. Monotony is not a moment: it is a property of a body of content, and a
 * branch is content the world contains whichever way round it is played. The
 * order-free number in the table — LÄHIN, the sibling a level most resembles —
 * is there partly so this caveat can be checked rather than trusted.
 */
const WORLD_LEVELS = WORLDS.map((world) => ({
  id: world.id,
  levels: world.nodes.filter((n) => n.level)
    .map((n) => ({ id: n.level, fortress: n.type === 'fortress' })),
}));

/**
 * A level the map lists but no route through the map reaches is a level
 * `curriculum.mjs` never measured, so there is no feature set for it here
 * either. `worldProblems` already reports that shape of map fault and it is not
 * this tool's job to report it twice — but it IS this tool's job not to crash
 * on one and not to pretend the level was measured. It is dropped, counted, and
 * named in the output.
 *
 * This is not hypothetical housekeeping: levels are being added to this tree
 * while this file is being written, and a half-linked node is exactly what a
 * world in progress looks like.
 */
const ORPHANS = WORLD_LEVELS.flatMap((w) => w.levels)
  .filter((l) => !CURRICULUM_USES.has(l.id)).map((l) => l.id);
for (const w of WORLD_LEVELS) w.levels = w.levels.filter((l) => CURRICULUM_USES.has(l.id));
const ALL = WORLD_LEVELS.flatMap((w) => w.levels.map((l) => ({ ...l, world: w.id })));

/* ================================ measure ================================ */

/** Non-core feature keys a level contains, straight off the curriculum's own
 *  detectors so the two tools cannot disagree about what the game holds. */
const MAIN_KEYS = FEATURES.filter((f) => !f.core).map((f) => f.key);
const featuresOf = (id) => new Set(MAIN_KEYS.filter((k) => CURRICULUM_USES.get(id)[k]));

/** |a ∩ b| / |a ∪ b|, in percent. The "same six things four times running" number. */
function jaccard(a, b) {
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  let n = 0;
  for (const k of a) if (b.has(k)) n++;
  return (n / union.size) * 100;
}

const LEVELS = new Map();
for (const { id } of ALL) LEVELS.set(id, getLevel(id));
const WINDOWS = new Map([...LEVELS].map(([id, lvl]) => [id, windowsOf(lvl.rows)]));
const SHAPES = new Map([...LEVELS].map(([id, lvl]) => [id, shapesOf(lvl.rows)]));

/**
 * The per-level row. Everything is measured against what came BEFORE, in two
 * scopes, and the difference between the two scopes is itself a finding: a
 * level can be the freshest thing in its world and the eighth copy of something
 * the game did three worlds ago.
 */
const seenWorld = new Map();
const seenGame = new Set();
const ROWS_OUT = [];
let prevInWorld = null;
let prevWorld = null;
for (const { id, world, fortress } of ALL) {
  if (world !== prevWorld) { prevInWorld = null; prevWorld = world; }
  if (!seenWorld.has(world)) seenWorld.set(world, new Set());
  const before = seenWorld.get(world);
  const mine = SHAPES.get(id);
  const all = WINDOWS.get(id);
  const nontrivial = all.filter((w) => !w.trivial);

  let newWorld = 0;
  let newGame = 0;
  for (const key of mine) {
    if (!before.has(key)) newWorld++;
    if (!seenGame.has(key)) newGame++;
  }

  const feat = featuresOf(id);
  ROWS_OUT.push({
    id,
    world,
    fortress,
    cols: routeBand(LEVELS.get(id).rows)[0].length,
    windows: all.length,
    trivial: all.length - nontrivial.length,
    shapes: mine.size,
    first: before.size === 0,
    novelty: mine.size ? (newWorld / mine.size) * 100 : 0,
    noveltyGame: mine.size ? (newGame / mine.size) * 100 : 0,
    features: feat,
    overlap: prevInWorld ? jaccard(feat, prevInWorld.features) : null,
    newFeatures: [...feat].filter((k) => !prevInWorld
      || !ROWS_OUT.some((r) => r.world === world && r.features.has(k))).length,
  });
  for (const key of mine) { before.add(key); seenGame.add(key); }
  prevInWorld = ROWS_OUT[ROWS_OUT.length - 1];
}

/**
 * LÄHIN SISKO — the level in the same world whose arrangements this one most
 * repeats, and by how much. Order-free, and the one number in the table that
 * names the other end of the repetition instead of only measuring it.
 *
 * The fortress is compared only with other fortresses, and levels only with
 * levels. A fortress shares almost nothing with the grass level before it —
 * different theme, different chunk vocabulary, a ceiling — so pairing it with
 * one would print a large number that says nothing except "these are different
 * kinds of room". Fortresses repeating each other is a real finding and it gets
 * its own section.
 */
for (const r of ROWS_OUT) {
  let best = null;
  for (const o of ROWS_OUT) {
    if (o.id === r.id || o.world !== r.world || o.fortress !== r.fortress) continue;
    const share = coveredBy(SHAPES.get(r.id), SHAPES.get(o.id));
    if (!best || share > best.share) best = { id: o.id, share };
  }
  r.twin = best;
}

/**
 * Per world. Two numbers that are never added together, and the reason is the
 * whole design of this tool:
 *
 *   sanasto  how many distinct features the world fields. NOT GRADED.
 *   uutuus   the mean share of new arrangements, over the world's levels except
 *            the first and except the fortress.
 *
 * The first level is out because it is 100% by definition — it has nothing to
 * repeat yet — and averaging it in would reward a world for being short. The
 * fortress is out for the reason `difficulty.mjs` states when it leaves the
 * fortress out of the world-shape walk: it is a different kind of room, always
 * last, and it would hand every world the same free points. What fortresses do
 * to each other is measured below, where it is the actual question.
 */
const WORLD_ROWS = WORLD_LEVELS.map(({ id }) => {
  const mine = ROWS_OUT.filter((r) => r.world === id);
  const body = mine.filter((r) => !r.fortress && !r.first);
  const vocab = new Set(mine.flatMap((r) => [...r.features]));
  const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);
  const half = Math.ceil(body.length / 2);
  /* The longest run of consecutive levels whose feature sets are IDENTICAL —
   * "the same six things four times running is the shape of padding". Counted
   * over the world's levels in map order, fortress included, because a fortress
   * that fields exactly what the level before it fielded is the same symptom. */
  let run = 1;
  let longest = mine.length ? 1 : 0;
  for (let i = 1; i < mine.length; i++) {
    const a = mine[i - 1].features;
    const b = mine[i].features;
    const same = a.size === b.size && [...a].every((k) => b.has(k));
    run = same ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return {
    id,
    levels: mine.length,
    body: body.length,
    vocab: vocab.size,
    perLevel: mean(mine.map((r) => r.features.size)),
    overlap: mean(mine.filter((r) => r.overlap !== null).map((r) => r.overlap)),
    novelty: mean(body.map((r) => r.novelty)),
    early: mean(body.slice(0, half).map((r) => r.novelty)),
    late: mean(body.slice(half).map((r) => r.novelty)),
    worst: body.reduce((a, b) => (!a || b.novelty < a.novelty ? b : a), null),
    longestSame: longest,
    silent: mine.filter((r) => !r.first && r.newFeatures === 0).length,
    fortress: mine.find((r) => r.fortress) || null,
  };
});

/** The medians the verdict is read against, from this tree and no other. */
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const MED_VOCAB = median(WORLD_ROWS.map((w) => w.vocab));
/* A world with nothing measurable would otherwise drag the median toward zero
 * with a number that is an absence and not a measurement. */
const MED_NOVELTY = median(WORLD_ROWS.filter((w) => w.body).map((w) => w.novelty));
const MED_LEVEL = median(ROWS_OUT.filter((r) => !r.first && !r.fortress).map((r) => r.novelty));

/**
 * The quadrant. Only one of the two axes is a complaint, and the labels say so:
 * two of the four are descriptions and two are faults. A narrow world is never
 * a fault on its own — that is the whole point of keeping SANASTO out of the
 * score — and a wide one is never a defence.
 */
function character(w) {
  /* A world with one level and a fortress has nothing to repeat yet, and
   * calling that "out of ideas" would be reading a zero as a measurement. */
  if (!w.body) return 'liian lyhyt';
  const narrow = w.vocab <= MED_VOCAB;
  const fresh = w.novelty >= MED_NOVELTY;
  if (narrow && fresh) return 'oma luonne';
  if (narrow && !fresh) return 'IDEA LOPPU';
  if (!narrow && fresh) return 'vaihteleva';
  return 'LEVEÄ, LAISKA';
}

/* =============================== ANSAN KOE =============================== */

/**
 * The trap test, run on the data rather than argued about in a comment.
 *
 * A variety meter is dangerous exactly when its gradient points at "put one of
 * everything in every level". This measures the gradient, three ways, on the
 * least varied level in the game — the level where the temptation would be
 * strongest:
 *
 *   1. stamp an enemy the level ALREADY contains into an empty column
 *   2. stamp an enemy species the level has NEVER contained into that same
 *      column
 *   3. change no tile at all, and reverse the middle of the chunk playlist
 *
 * If 1 and 2 differ much, the score can be bought with mechanics and the trap
 * is real. If 3 dwarfs both, the score is bought with arrangement, which is
 * what it claims to measure.
 *
 * Level 3 needs a chunk playlist and the generated levels do not have one
 * (`src/data/generated.js` ships finished grids), so it is run on the least
 * varied level that HAS one, named in the output. The permuted level is never
 * validated and never written anywhere — `assemble` is being used here as a
 * scratch pad, and a reordering that would fail `rules.js` is still a perfectly
 * good measurement of what reordering costs.
 */
function stamp(rows, x, y, ch) {
  const out = [...rows];
  out[y] = out[y].slice(0, x) + ch + out[y].slice(x + 1);
  return out;
}

function noveltyOf(id, rows) {
  const before = new Set();
  for (const r of ROWS_OUT) {
    if (r.world !== ROWS_OUT.find((q) => q.id === id).world) continue;
    if (r.id === id) break;
    for (const k of SHAPES.get(r.id)) before.add(k);
  }
  const mine = shapesOf(rows);
  if (!mine.size) return 0;
  let n = 0;
  for (const k of mine) if (!before.has(k)) n++;
  return (n / mine.size) * 100;
}

function trapTest() {
  const body = ROWS_OUT.filter((r) => !r.first && !r.fortress);
  if (!body.length) return null;
  const target = body.reduce((a, b) => (b.novelty < a.novelty ? b : a));
  const level = LEVELS.get(target.id);
  const band = routeBand(level.rows);
  /* Which absolute row the route band starts at, so the stamp lands in the grid
   * and not in a copy of the band. */
  const bandTop = level.rows.length <= ROWS ? 0
    : Math.floor(Math.max(level.rows.findIndex((r) => r.includes('1')), 0) / ROWS) * ROWS;

  /* An empty column standing on solid floor, taken from the middle of the level
   * so the stamp is not next to the start or the flag. */
  let x = -1;
  for (let c = Math.floor(band[0].length / 3); c < band[0].length - 20; c++) {
    if (band[FLOOR - 1][c] === ' ' && (band[FLOOR][c] === '#' || band[FLOOR][c] === 'X')) { x = c; break; }
  }
  if (x < 0) return null;

  const here = new Set(band.flatMap((row) => [...row]).filter((ch) => ENEMY_CHARS.has(ch)));
  const familiar = [...here][0];
  const stranger = [...ENEMY_CHARS].find((ch) => !here.has(ch) && ch !== 'b');
  if (!familiar || !stranger) return null;

  const base = target.novelty;
  const withOld = noveltyOf(target.id, stamp(level.rows, x, bandTop + FLOOR - 1, familiar));
  const withNew = noveltyOf(target.id, stamp(level.rows, x, bandTop + FLOOR - 1, stranger));

  const reorderable = body.filter((r) => LEVELS.get(r.id).chunks)
    .sort((a, b) => a.novelty - b.novelty)[0];
  let reorder = null;
  if (reorderable) {
    const list = LEVELS.get(reorderable.id).chunks;
    const middle = list.slice(1, -1).reverse();
    reorder = {
      id: reorderable.id,
      chunks: list.length,
      base: reorderable.novelty,
      after: noveltyOf(reorderable.id, assemble([list[0], ...middle, list[list.length - 1]])),
    };
  }
  return {
    id: target.id, col: x, familiar, stranger, base, withOld, withNew, reorder,
  };
}

const TRAP = trapTest();

/* ============================ chunk vocabulary =========================== */

/**
 * The same question one level down, where a chunk playlist exists.
 *
 * This is the measure the brief suspected might be the more honest one, and the
 * finding is that it CANNOT be the headline — not because it is wrong but
 * because it does not cover the game. A hand-written level is a list of named
 * chunks and a generated one is a finished grid (`src/data/generated.js` has no
 * `chunks` field at all), so a chunk-repetition score would be blind to exactly
 * the levels the owner is worried about: the ones being added to fill worlds
 * out. The window measure above is the same idea done on the grid, which every
 * level has.
 *
 * It is still printed, because when it applies it names the repeated thing
 * instead of only measuring it, and "this chunk appears eleven times" is a
 * sentence somebody can act on.
 */
const CHUNK_USE = new Map();
for (const { id, world } of ALL) {
  const list = LEVELS.get(id).chunks;
  if (!list) continue;
  for (const name of list) {
    if (!CHUNK_USE.has(name)) CHUNK_USE.set(name, { total: 0, worlds: new Set(), levels: new Set() });
    const e = CHUNK_USE.get(name);
    e.total++;
    e.worlds.add(world);
    e.levels.add(id);
  }
}
const HANDMADE = ALL.filter(({ id }) => LEVELS.get(id).chunks);

/* ================================ output ================================= */

function json() {
  return {
    window: WINDOW,
    levels: ROWS_OUT.map((r) => ({
      id: r.id,
      world: r.world,
      fortress: r.fortress,
      cols: r.cols,
      windows: r.windows,
      trivial: r.trivial,
      shapes: r.shapes,
      features: [...r.features],
      overlap: r.overlap,
      novelty: r.novelty,
      noveltyGame: r.noveltyGame,
      twin: r.twin,
    })),
    worlds: WORLD_ROWS.map((w) => ({
      id: w.id,
      levels: w.levels,
      vocab: w.vocab,
      overlap: w.overlap,
      novelty: w.novelty,
      early: w.early,
      late: w.late,
      longestSame: w.longestSame,
      silent: w.silent,
      character: character(w),
    })),
    medians: { vocab: MED_VOCAB, worldNovelty: MED_NOVELTY, levelNovelty: MED_LEVEL },
    trap: TRAP,
  };
}

if (!IS_MAIN) {
  // imported: nothing printed, the exports below are the interface.
} else if (JSON_OUT) {
  console.log(JSON.stringify(json(), null, 2));
} else {
  report();
}

export { windowsOf, shapesOf, ROWS_OUT as VARIETY_ROWS, WORLD_ROWS as VARIETY_WORLDS };

function report() {
const pad = (s, n) => String(s).padEnd(n);
const num = (v, n, d = 1) => String(Number(v).toFixed(d)).padStart(n);

console.log('\nVaihtelumittari — sanastoa ei pisteytetä, sen käyttöä pisteytetään.\n');
console.log(`  Ikkuna ${WINDOW} saraketta (sama kuin tools/originality.mjs), reittikaista,`);
console.log(`  ${ROWS_OUT.length} kenttää, ${WORLD_ROWS.length} maailmaa, `
  + `${[...new Set(ROWS_OUT.flatMap((r) => [...r.features]))].length} mitattua ominaisuutta.`);
if (ORPHANS.length) {
  console.log(`\n  Mittaamatta ${ORPHANS.length}: ${ORPHANS.join(' ')} — kartalla mutta ei`);
  console.log('  yhdelläkään reitillä alusta linnakkeeseen, joten opetusjärjestyskään ei');
  console.log('  ole niitä nähnyt. Ks. worldProblems (src/data/worlds.js).');
}

console.log('\n  KENTTÄ — UUTUUS on niiden muotojen osuus, joita tämä maailma ei ollut');
console.log('  vielä näyttänyt. PELISSÄ sama koko peliä vasten. LÄHIN on se saman');
console.log('  maailman kenttä jonka muotoja tämä toistaa eniten.\n');
console.log(`  ${pad('KENTTÄ', 8)}${pad('SAR.', 6)}${pad('MUOTOJA', 9)}${pad('TYHJÄÄ%', 9)}`
  + `${pad('OMIN.', 7)}${pad('UUSIA', 7)}${pad('∩EDELL', 8)}${pad('UUTUUS', 8)}`
  + `${pad('PELISSÄ', 9)}LÄHIN`);
for (const w of WORLD_ROWS) {
  for (const r of ROWS_OUT.filter((q) => q.world === w.id)) {
    const twin = r.twin ? `${pad(r.twin.id, 6)}${num(r.twin.share, 5)} %` : '—';
    console.log(`  ${pad(r.id, 8)}${pad(r.cols, 6)}${pad(r.shapes, 9)}`
      + `${num((r.trivial / (r.windows || 1)) * 100, 6)}   ${pad(r.features.size, 7)}`
      + `${pad(r.newFeatures, 7)}${r.overlap === null ? pad('—', 8) : `${num(r.overlap, 5)}   `}`
      + `${num(r.novelty, 6)}  ${num(r.noveltyGame, 7)}  ${twin}`);
  }
  console.log(`  ${pad(w.id, 8)}${pad('', 6)}${pad('', 9)}${pad('', 9)}`
    + `${pad(`sanasto ${w.vocab}`, 14)}${num(w.overlap, 5)}   ${num(w.novelty, 6)}`
    + '   ← keskiarvo ilman ensimmäistä ja linnaketta\n');
}

console.log('  MAAILMAT — kaksi lukua joita ei lasketa yhteen. SANASTO ei ole arvosana:');
console.log('  kapea sanasto on se miltä oma luonne näyttää ulospäin. UUTUUS on ainoa');
console.log('  asia josta tämä työkalu valittaa.\n');
console.log(`  ${pad('MAAILMA', 9)}${pad('KENTTIÄ', 9)}${pad('SANASTO', 9)}${pad('OM/KENT', 9)}`
  + `${pad('∩KESKI', 8)}${pad('UUTUUS', 8)}${pad('ALKU', 7)}${pad('LOPPU', 8)}`
  + `${pad('SAMA', 6)}${pad('MYKKIÄ', 8)}LUONNE`);
for (const w of WORLD_ROWS) {
  console.log(`  ${pad(w.id, 9)}${pad(w.levels, 9)}${pad(w.vocab, 9)}${num(w.perLevel, 6)}   `
    + `${num(w.overlap, 5)}   ${num(w.novelty, 6)}  ${num(w.early, 5)}  ${num(w.late, 6)}  `
    + `${pad(w.longestSame, 6)}${pad(w.silent, 8)}${character(w)}`);
}
console.log(`\n  Mediaanit tästä puusta: sanasto ${MED_VOCAB}, maailman uutuus `
  + `${MED_NOVELTY.toFixed(1)} %, yksittäisen kentän uutuus ${MED_LEVEL.toFixed(1)} %.`);
console.log('  SAMA = pisin jono peräkkäisiä kenttiä joilla on täsmälleen sama');
console.log('  ominaisuusjoukko. MYKKIÄ = kenttiä jotka eivät tuo maailmaan yhtään');
console.log('  ominaisuutta jota siinä ei jo ollut. ALKU/LOPPU = uutuus maailman');
console.log('  alkupuoliskolla ja loppupuoliskolla, eli loppuuko idea kesken.');

/*
 * Cross-world recycling, which the per-world numbers cannot see at all: a world
 * can be the freshest thing in the game relative to itself and still be built
 * entirely out of shapes three earlier worlds already used. The threshold is
 * the game's own median level novelty divided by four rather than a number
 * somebody liked, so it moves with the tree.
 */
const RECYCLED_AT = MED_LEVEL / 4;
const recycled = ROWS_OUT.filter((r) => r.noveltyGame < RECYCLED_AT);
console.log(`\n  KIERRÄTYS — kenttiä joissa alle ${RECYCLED_AT.toFixed(1)} % muodoista on `
  + 'koko pelille uusia');
console.log(`  (= mediaanikentän uutuus ${MED_LEVEL.toFixed(1)} % neljänneksellä): `
  + `${recycled.length} / ${ROWS_OUT.length}.`);
for (const r of recycled) {
  console.log(`    ${pad(r.id, 8)}${num(r.noveltyGame, 5)} %  koko pelille uutta, `
    + `${num(r.novelty, 5)} % omalle maailmalleen${r.fortress ? '   (linnake)' : ''}`);
}
const forts = ROWS_OUT.filter((r) => r.fortress);
const recycledForts = recycled.filter((r) => r.fortress);
console.log(`\n    Näistä ${recycledForts.length} on linnakkeita, ja linnakkeita on kaikkiaan `
  + `${forts.length}: eli ${((recycledForts.length / (forts.length || 1)) * 100).toFixed(0)} % pelin`);
console.log('    linnakkeista on rakennettu muodoista jotka peli on jo näyttänyt. Linnakkeet');
console.log('    ovat saman kourallisen palikoita eri järjestyksessä, ja se on toistoa');
console.log('    paikassa jossa sitä ei etsitty: maailmojen täyttäminen ei ole tässä puussa');
console.log('    lähimainkaan suurin yksitoikkoisuuden lähde.');

if (TRAP) {
  console.log('\n  ANSAN KOE — pisteyttääkö tämä mittari mekaniikan ahtamisen?\n');
  console.log(`  Koekenttä on pelin vähiten uusi kenttä ${TRAP.id} (${TRAP.base.toFixed(2)} %),`);
  console.log(`  eli se jossa houkutus olisi suurin. Sarakkeeseen ${TRAP.col} lisätään yksi`);
  console.log('  vihollinen, kahdesti: ensin laji joka kentässä jo on, sitten laji jota');
  console.log('  siinä ei ole koskaan ollut.\n');
  console.log(`    ${pad('lähtötaso', 34)}${num(TRAP.base, 6)} %`);
  console.log(`    ${pad(`+ tuttu laji '${TRAP.familiar}'`, 34)}${num(TRAP.withOld, 6)} %`
    + `   ${TRAP.withOld > TRAP.base ? '+' : ''}${(TRAP.withOld - TRAP.base).toFixed(2)}`);
  console.log(`    ${pad(`+ uusi laji '${TRAP.stranger}'`, 34)}${num(TRAP.withNew, 6)} %`
    + `   ${TRAP.withNew > TRAP.base ? '+' : ''}${(TRAP.withNew - TRAP.base).toFixed(2)}`);
  const gain = TRAP.withOld - TRAP.base;
  const extra = TRAP.withNew - TRAP.withOld;
  console.log(`\n    Yhden vihollisen lisääminen ostaa ${gain.toFixed(2)} %-yksikköä. Siitä että se`);
  console.log(`    on kentälle UUSI laji eikä tuttu, maksetaan ${extra.toFixed(2)} lisää — eli `
    + `${extra === 0 ? 'ei mitään' : 'lähes ei mitään'}.`);
  console.log('    Mittari on sokea sille mikä laji ruudussa on: se näkee vain että ruutu');
  console.log('    ei enää näytä samalta kuin ennen. Mekaniikan ahtamiselle ei siis ole');
  console.log('    gradienttia, koska ahtaminen ja saman asian siirtäminen maksavat saman.');
  if (TRAP.reorder) {
    console.log(`\n  Ja toisin päin: ${TRAP.reorder.id}:n palikkalista `
      + `(${TRAP.reorder.chunks} palikkaa) käännettynä keskeltä —`);
    console.log('  ei yhtään uutta mekaniikkaa, ei yhtään uutta laattaa, sama sisältö');
    console.log('  eri järjestyksessä:');
    console.log(`\n    ${pad('lähtötaso', 34)}${num(TRAP.reorder.base, 6)} %`);
    console.log(`    ${pad('järjestys käännettynä', 34)}${num(TRAP.reorder.after, 6)} %`
      + `   +${(TRAP.reorder.after - TRAP.reorder.base).toFixed(2)}`);
    const ratio = (TRAP.reorder.after - TRAP.reorder.base) / (gain || 0.01);
    console.log(`\n    Uudelleenjärjestäminen ostaa ${ratio.toFixed(1)}× sen mitä yhden vihollisen`);
    console.log('    lisääminen ostaa, ja se lisää nolla mekaniikkaa. Mittarin gradientti');
    console.log('    osoittaa siis järjestykseen eikä ahtamiseen, mikä oli koko ehto sille');
    console.log('    että tämän luvun saa julkaista.');
  }
}

if (RAW && HANDMADE.length) {
  console.log('\n  PALIKKASANASTO — vain käsintehdyt kentät, koska generoidulla kentällä');
  console.log(`  ei ole palikkalistaa (${HANDMADE.length} / ${ALL.length} kenttää).\n`);
  const top = [...CHUNK_USE].sort((a, b) => b[1].total - a[1].total).slice(0, 20);
  console.log(`  ${pad('PALIKKA', 16)}${pad('KÄYTTÖJÄ', 10)}${pad('KENTISSÄ', 10)}MAAILMOISSA`);
  for (const [name, e] of top) {
    console.log(`  ${pad(name, 16)}${pad(e.total, 10)}${pad(e.levels.size, 10)}`
      + `${e.worlds.size}  ${[...e.worlds].join(' ')}`);
  }
  console.log(`\n  Palikoita yhteensä ${CHUNK_USE.size}, käyttöjä `
    + `${[...CHUNK_USE.values()].reduce((s, e) => s + e.total, 0)}.`);
}

/*
 * The verdict, derived rather than typed, in the same spirit as
 * difficulty.mjs's "Käyrä nousee joka maailmassa": every sentence below is a
 * measurement, so it cannot quietly stop being true when the worlds are filled.
 */
console.log('\n  TULOS');

/*
 * WHY THE OBVIOUS MEASURE IS NOT THE MEASURE, demonstrated on this tree rather
 * than argued.
 *
 * "How much does a level's feature set overlap its predecessor's" is the first
 * thing anybody reaches for, and on its own it is the trap in another costume:
 * it scores a world DOWN for holding a vocabulary steady, which is precisely
 * what a world with a character does. The proof is a pair of worlds that repeat
 * their own feature sets to the same degree and are nothing alike to play, so
 * the tool goes and finds the worst such pair and prints it. If it ever fails
 * to find one, the two measures agree on this tree and the sentence says so.
 */
const bodies = WORLD_ROWS.filter((w) => w.body);
let pair = null;
for (const a of bodies) {
  for (const b of bodies) {
    if (a.id >= b.id) continue;
    const close = Math.abs(a.overlap - b.overlap);
    const apart = Math.abs(a.novelty - b.novelty);
    if (close > 15) continue;
    if (!pair || apart > pair.apart) pair = { a, b, close, apart };
  }
}
if (pair) {
  const [hi, lo] = pair.a.novelty >= pair.b.novelty ? [pair.a, pair.b] : [pair.b, pair.a];
  console.log(`    Päällekkäisyys yksin ei riitä: ${hi.id} ja ${lo.id} toistavat edeltäjänsä`);
  console.log(`    ominaisuusjoukkoa yhtä paljon (${hi.overlap.toFixed(0)} % ja `
    + `${lo.overlap.toFixed(0)} %), mutta uutuus on ${hi.novelty.toFixed(0)} % ja `
    + `${lo.novelty.toFixed(0)} %`);
  console.log(`    — ${pair.apart.toFixed(0)} %-yksikköä eroa. `
    + 'Kapea sanasto ei ole vika; sen kaluaminen samoiksi ruuduiksi on.');
}

const worst = [...WORLD_ROWS].sort((a, b) => a.novelty - b.novelty)[0];
const best = [...WORLD_ROWS].sort((a, b) => b.novelty - a.novelty)[0];
const tired = WORLD_ROWS.filter((w) => character(w).startsWith('IDEA') || character(w).startsWith('LEVEÄ'));
console.log(`    Vähiten uutta: ${worst.id} ${worst.novelty.toFixed(1)} %, eniten: `
  + `${best.id} ${best.novelty.toFixed(1)} %.`);
console.log(`    Maailmoja jotka toistavat itseään mediaania enemmän: ${tired.length} / `
  + `${WORLD_ROWS.length}${tired.length ? ` — ${tired.map((w) => w.id).join(' ')}` : ''}.`);
const fading = WORLD_ROWS.filter((w) => w.body && w.late < w.early);
console.log(`    Maailmoja joissa loppupuoli on alkupuolta toistavampi: ${fading.length} / `
  + `${bodies.length}.`);
if (fading.length) {
  console.log(`      ${fading.map((w) => `${w.id} ${w.early.toFixed(0)}→${w.late.toFixed(0)}`).join('   ')}`);
}
const eight = WORLD_ROWS.filter((w) => w.levels >= 8);
const four = WORLD_ROWS.filter((w) => w.levels <= 4);
if (eight.length && four.length) {
  const m = (xs) => xs.reduce((s, w) => s + w.novelty, 0) / xs.length;
  console.log(`    Kahdeksan kentän maailmat ${m(eight).toFixed(1)} %, neljän kentän `
    + `${m(four).toFixed(1)} % — ero ${(m(eight) - m(four)).toFixed(1)} %-yksikköä.`);
  console.log(eight.length && m(eight) >= m(four)
    ? '    Maailman täyttäminen kahdeksaan EI ole tässä puussa laskenut vaihtelua.'
    : '    Maailman täyttäminen kahdeksaan on tässä puussa laskenut vaihtelua.');
}

console.log('\n  Mitä tämä ei mittaa. Uutuus ei ole kiinnostavuus: generaattori tuottaa');
console.log('  loputtomasti uusia muotoja, eikä yksikään niistä ole siksi hyvä. Mittari');
console.log('  ei näe piilokaistoja (mitataan vain reittikaista), ei rytmiä eikä sitä');
console.log('  kummalla haaralla kukaan kulkee, ja koska se vertaa peliä itseensä, se');
console.log('  antaa läpi pelin joka on tasaisen yksitoikkoinen kauttaaltaan. Se vastaa');
console.log('  yhteen kysymykseen: sanooko tämä maailma saman asian kahdesti.\n');
}
