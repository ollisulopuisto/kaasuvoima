/**
 * Kenttägeneraattorin ydin — sama koodi työkalulle ja selaimelle.
 *
 * Tämä tiedosto oli `tools/gen-levels.mjs`:n keskiosa, ja se siirrettiin tänne
 * sanasta sanaan. Syy on **päivän pieru**: se generoi kentän *sivulla*, ja
 * DESIGN.md kohta 3 sanoo että generoitu kenttä syntyy louhituista rytmiluvuista
 * ja tämän pelin omasta sanastosta — yhdellä tavalla, ei kahdella. Toinen
 * generaattori selaimeen olisi ollut kaksi generaattoria jotka ajautuvat erilleen
 * ensimmäisessä muutoksessa, ja silloin "sama sääntö" olisi ollut väite jota
 * mikään ei tarkista.
 *
 * Työnjako on nyt tämä:
 *
 *   `src/data/generator.js`   mitä kenttä on: palikat, teemat, säännöt,
 *                             `buildLevel`, `validateGenerated`. Ei tiedostoja,
 *                             ei prosessia, ei korpusta — pelkkää laskentaa.
 *   `tools/gen-levels.mjs`    mitkä kentät tehdään: `PLAN`, siemenhaku,
 *                             telemetria, korpustarkistus ja tiedoston
 *                             kirjoittaminen. Nämä ovat Nodea eivätkä voi olla
 *                             muuta.
 *   `src/core/daily.js`       päivän kenttä: päivämäärä siemeneksi, resepti,
 *                             ja se ainoa yritys.
 *
 * **Todiste siitä ettei mikään liikkunut on tavuissa.** Siirron jälkeen
 * `VGLC_DIR=… node tools/gen-levels.mjs` kirjoittaa `src/data/generated.js`:n
 * tavulleen samana kuin ennen siirtoa; 60 toimitettua kenttää eivät saa liikkua.
 *
 * Kaksi asiaa jotka eivät seuranneet mukaan, ja molemmat tarkoituksella:
 *
 *   - **korpustarkistus** (`tools/originality.mjs`) vaatii korpuksen, jota ei
 *     ole repossa eikä julkaisussa (DESIGN.md kohta 3, alakohta 1). Selain ei
 *     siis voi tarkistaa mitään, eikä tässä teeskennellä että voisi — ks.
 *     `src/data/daily-origin.js`, jossa vastaus on laskettu etukäteen ja repoon
 *     jää pelkkä tuomio.
 *   - **botti** (`tools/playable.mjs`) todistaa maareitin voimatasolla 0. Se
 *     ajaa moottoria, eikä sitä aja pelaajan selain. Sama vastaus: luetteloitu
 *     etukäteen.
 *
 * Se mikä tässä on ajossa mukana on `validateLevel` (`src/data/rules.js`) ja
 * `themeProblems` — ja ne ovat ruudukkogeometriaa eivätkä simulaatiota. Ero on
 * kirjattu `src/core/daily.js`:hin sanalla eikä jätetty pääteltäväksi.
 */
import { validateLevel } from './rules.js';
import { hashNoise } from '../core/utils.js';
import { PACING_STATS, JUMP_BUDGET } from './pacing.js';

/* ------------------------------- the engine ----------------------------- */

const ROWS = 15;
const FLOOR = 13;          // rows 13-14 are the ground slab
const HEAD = 3;            // tiles of headroom the tallest player needs

/**
 * The jump budget is measured, not assumed: tools/measure-jump.mjs plays a
 * jump and writes what it actually achieved. Change the physics and the level
 * geometry follows, instead of quietly going stale.
 *
 * It arrives here through `src/data/pacing.js` rather than off disk, and so do
 * the mined statistics, because this module now runs in a browser as well as in
 * Node — see the header. The carried copy is compared against the two measured
 * JSON files by `tools/verify.mjs`.
 */
export const budget = JUMP_BUDGET;
const stats = PACING_STATS;
export const REACH = { gap: budget.gapTiles, wall: budget.wallTiles, softGap: budget.softGapTiles };
/** The corpus jump budget, for translating difficulty rather than distance. */
const CORPUS_REACH = 5;
const GAP_SCALE = REACH.gap / CORPUS_REACH;

/* Viety ulos, koska päivän pieru johtaa reseptinsä — teeman ja leveyden — samasta
 * virrasta samalla tavalla kuin kenttä johdetaan siemenestään. Kaksi
 * satunnaislukugeneraattoria samassa pelissä olisi kaksi tapaa olla eri mieltä
 * siitä mitä "sama siemen" tarkoittaa. */
export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/*
 * THE STREAM, AND WHY IT IS A MODULE-LEVEL LET RATHER THAN A PARAMETER.
 *
 * Every set piece below draws from `rnd` by closure, and the order of those
 * draws IS the level: move one call and world 5 comes out a different world.
 * Threading a generator object through fourteen pieces would have been the
 * tidier shape and it would also have been fourteen chances to change that
 * order, so the stream stays exactly where it was and `buildLevel` reseeds it
 * from `spec.seed` on entry — which is what the tool did by hand before this
 * module existed, in the same place, with the same value.
 */
let rnd = mulberry32(0);
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
const ENEMY_ROW = { g: 1, k: 1, c: 1, x: 1, f: 5, r: 4 };

const placeEnemy = (c, x, kind) => c.set(x, FLOOR - (ENEMY_ROW[kind] || 1), kind);

const coinArc = (c, x, w) => {
  // Coins trace the jump the gap asks for, which is how a player reads it.
  for (let i = 0; i < w; i++) {
    const t = (i + 0.5) / w;
    const lift = Math.round(Math.sin(t * Math.PI) * 3);
    if (lift > 0) c.set(x + i, FLOOR - 2 - lift, 'o');
  }
};

export const PIECES = {
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
    const w = Math.max(2, Math.min(ctx.softGap, Math.round(raw * GAP_SCALE)) - ctx.ease);
    const lead = 2;
    c.ground(x, lead);
    if (w > ctx.maxGap) {
      const half = Math.floor(w / 2);
      for (let i = 0; i < 2; i++) c.set(x + lead + half - 1 + i, FLOOR - 3, '-');
    }
    if (rnd() < 0.55) coinArc(c, x + lead, w);
    c.ground(x + lead + w, 3);
    return lead + w + 3;
  },

  /** Gas cloud drifting over a gap: this game's own version of a leap of faith. */
  stinkGap(c, x, ctx) {
    const w = Math.min(ctx.maxGap, Math.max(3, Math.round(
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
    const w = Math.max(3, ctx.maxGap - ctx.ease);
    c.ground(x, 5);
    c.set(x + 2, FLOOR - 1, 'c');
    /* The plank in the middle is a stepping stone, and a world that bridges no
     * holes (see `softGap` in `buildLevel`) does not bridge this one either. It
     * was never needed here in the first place — the gate's span is the plain
     * jump budget by construction — and `tools/playable.mjs` measured what it
     * cost: the power-0 bot died on it at column 216 of 1-4, on a four-tile hole
     * it clears without a plank. A stepping stone the bot cannot use is worse
     * than no stepping stone. */
    if (ctx.softGap > ctx.maxGap) {
      const half = Math.floor(w / 2);
      for (let i = 0; i < 2; i++) c.set(x + 5 + half - 1 + i, FLOOR - 3, '-');
    }
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
    const height = Math.min(ctx.maxBlockHeight, Math.max(HEAD + 1,
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

  /**
   * A crumbling catwalk over a pit — `%`, the tile that holds just long enough.
   *
   * The deck is written at floor level with nothing under it, the same shape
   * the hand-made `fac_crumble` and `dune_crumble` use, and the piers at both
   * ends are ordinary ground so that stopping to look is a decision rather than
   * an accident.
   *
   * The one placement rule that matters: **the deck is never wider than a plain
   * jump.** `%` is solid to the validator (src/data/rules.js says why), so a
   * crumbling deck silences the gap check — which would let this piece smuggle
   * in a pit no jump can cross, hidden behind a floor that will not be there.
   * Capping the span at REACH.gap means the level survives the mechanic
   * betraying you, which is DESIGN.md §5 applied to a tile that disappears.
   */
  crumbleWalk(c, x, ctx) {
    const w = Math.max(3, Math.min(ctx.maxGap, Math.round(
      sampleHist(stats.gapWidth, { min: 2, max: 8 }) * GAP_SCALE,
    )) - ctx.ease);
    c.ground(x, 3);
    for (let i = 0; i < w; i++) c.set(x + 3 + i, FLOOR, '%');
    // Coins over the deck and not over the piers, so the greedy line and the
    // fast line are the same line.
    if (rnd() < 0.6) coinArc(c, x + 3, w);
    c.ground(x + 3 + w, 3);
    return 3 + w + 3;
  },

  /**
   * A switch block and the bricks it has something to say to.
   *
   * The pairing *is* the mechanic: `S` turns `B` into coins for ten seconds, so
   * a switch with no bricks in sight is furniture and a brick wall with no
   * switch is a brick wall. This piece therefore always writes both, the switch
   * first, in the same screen — the reward has to be visible from the button or
   * pressing it is an act of faith.
   *
   * Both sit at FLOOR-4, the height everything bumpable in this generator sits
   * at: reachable from the ground at every power level, and clear of the three
   * rows the tallest body needs. The brick run is floating rather than stacked
   * on the ground on purpose — the switch may only ever make the level *less*
   * solid, so nothing the player walks on is allowed to depend on it.
   */
  switchWall(c, x) {
    const run = Math.min(6, Math.max(3, sampleHist(stats.blockRun, { min: 3, max: 9 })));
    const w = run + 12;
    c.ground(x, w);
    c.set(x + 3, FLOOR - 4, 'S');
    for (let i = 0; i < run; i++) c.set(x + 7 + i, FLOOR - 4, 'B');
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
  pipe(c, x, ctx) {
    const h = Math.min(4, Math.max(1, sampleHist(stats.pipeHeight, { min: 1, max: 4 })));
    const w = 8;
    c.ground(x, w);
    for (let i = 0; i < h; i++) {
      const y = FLOOR - 1 - i;
      c.set(x + 3, y, i === h - 1 ? '[' : '{');
      c.set(x + 4, y, i === h - 1 ? ']' : '}');
    }
    if (h >= 3 && ctx.plants && rnd() < 0.45) c.set(x + 3, FLOOR - 1 - h, 'p');
    /*
     * THE TWO-TILE PIPE'S COIN ROW, AND WHY IT IS NOT OPTIONAL.
     *
     * A warp pipe is drawn as an ordinary two-tile pipe with a coin row over it,
     * so the hint says "a pipe" rather than "this pipe" — and that only works if
     * every two-tile floor pipe in the game carries the *same* row. `verify.mjs`
     * gathers the coin offsets around every one of them and demands a single
     * shape; a generated pipe with no coins over it is a second silhouette, and
     * the day a warp is generated it would be the one pipe that looks different.
     *
     * The offsets are `pipe_short`'s, tile for tile: three coins at -3, -1 and
     * +1 from the pipe's left column, two rows above its mouth. Copied from this
     * game's own chunk, which is a source we own.
     *
     * Only the two-tile pipe, because only the two-tile pipe is the warp's
     * silhouette. `pipe_tall` carries nothing and neither does a tall one here.
     */
    if (h === 2) {
      for (const dx of [0, 2, 4]) c.set(x + dx, FLOOR - 4, 'o');
    }
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
      /*
       * THE CLAMP IS AFTER THE DRAW AND NOT INSIDE IT, and that is the whole
       * reason worlds 1, 3 and 5 do not move: `range` consumes the same two
       * numbers from the stream whatever the cap is, so a world that does not
       * lower `maxPlatform` builds exactly the level it built before.
       *
       * Why a cap at all: this piece's topmost ink is not its plank but the
       * coin two rows above it, and no other piece has that shape — `blockRow`
       * is capped by `maxBlockHeight` and stops there. In the bone world that
       * difference is a rule violation: the sky is open **five rows** for the
       * moon and the stars, a seven-high plank sits at row 6, and its coin
       * lands on row 4. Measured before this line: **10 of 80 seeds valid** in
       * 6-4, and "kuu ei näy" was one of the three reasons.
       */
      const height = Math.max(3, Math.min(ctx.maxPlatform, range(4, 7) - ctx.ease));
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
  /*
   * A LETHAL TILE YOU HAVE TO JUMP IS A GAP BY ANOTHER NAME, and this piece and
   * the next one now say so.
   *
   * Both used to be sized by a hand-picked pair — 3..5 spikes, 4..7 tiles of
   * lava — which is the one thing DESIGN.md §3 says a piece may not do: a size
   * comes from the mined histograms or from the measured jump budget, never
   * from taste. It had gone unnoticed because world 5's floor is ordinary and a
   * five-tile bed on ordinary floor is a hop.
   *
   * `tools/playable.mjs` found it on ice. Measured at power 0: the bot cleared
   * world 1's identical vocabulary at 100 %, and on world 3's slippery floor a
   * five-wide spike bed and a seven-wide lava pool stopped it dead — 21 % and
   * 6 % of the way through. So a world that has named its widest jump
   * (`maxGap`) gets these bounded by it too, one tile under for the spike bed
   * because its far edge is floor you have to land on rather than a lip.
   *
   * The uncapped default is left exactly as it was, because world 5 is already
   * measured and already passes; this is a rule a world opts into by declaring
   * what its jumps are worth.
   */
  spikes(c, x, ctx) {
    const run = Math.min(ctx.maxHazard, range(3, 5));
    const w = run + 6;
    c.ground(x, w);
    for (let i = 0; i < run; i++) c.set(x + 3 + i, FLOOR - 1, '^');
    return w;
  },

  /** A pool of lava with a bridge of platforms over it. */
  lava(c, x, ctx) {
    /* The bridge over it is planks, and `playable.mjs`'s bot cannot use a
     * floating plank — so for the bot, and therefore for the ground-route
     * promise, the pool is exactly as wide as it looks. */
    const run = Math.min(ctx.maxHazard, range(4, 7));
    const w = run + 6;
    c.ground(x, 3);
    for (let i = 0; i < run; i++) {
      c.set(x + 3 + i, FLOOR, 'W');
      c.set(x + 3 + i, FLOOR + 1, 'W');
    }
    /*
     * THE BRIDGE, AND WHY IT IS NOW ONE PLANK RATHER THAN A ROW OF STUMPS.
     *
     * It used to be two-tile stubs every three columns, which is neither a
     * crossing nor an absence of one. `tools/playable.mjs` measured what that
     * costs: the power-0 bot lands on a stub, has two tiles to take off again,
     * and drops into the lava — column 56 of 3-6, three times running, with a
     * five-wide pool, a four-wide one, and a four-wide one with no bridge at
     * all. A bare pool is no better, because the whole point of a lava pool as
     * opposed to a hole is that the far edge must be cleared outright.
     *
     * The hand-made answer was already in the repository and is the right one:
     * `lava_gap` lays a **continuous** plank across the whole pool and a tile
     * past each lip, and `3-3` — which has two of them, on ice — clears at power
     * 0. So a world that has named its jumps gets that: a walkway you can run
     * across, at FLOOR-3, the height `lava_gap` uses. The uncapped default keeps
     * the old stubs, because world 5 is measured and passes with them.
     */
    if (ctx.softGap > ctx.maxGap) {
      for (let i = 1; i < run - 1; i += 3) {
        for (let j = 0; j < 2; j++) c.set(x + 3 + i + j, FLOOR - 4, '-');
      }
    } else {
      for (let i = -1; i <= run; i++) c.set(x + 3 + i, FLOOR - 3, '-');
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

/* ---------------------------- the eight themes --------------------------- */

/*
 * ONE ENTRY PER THEME, AND THE ENTRY IS THREE DIFFERENT KINDS OF THING.
 *
 * The generator used to know three palettes — `meadow`, `dunes`, `glacier` —
 * which were the three looks world 5 happens to wear. That was enough while the
 * only generated world was the bonus world. It is not enough now: the levels
 * that fill out worlds 1..8 have to be *of* their world, and a world in this
 * game is a palette **and a structural rule**. Worlds 6, 7 and 8 each wrote one
 * down and put it in `verify.mjs` — bone stands and has open sky above it, cloud
 * stands on nothing and never hangs a plank over a hole, the keep has no outside
 * and no flagpole — and every one of those was gated against the hand-made
 * *chunk* files, i.e. against the one place a generated level never goes.
 *
 * So a theme entry carries three things, and they are deliberately separate:
 *
 *   `weights`  which set pieces may appear and how often. Editorial: the corpus
 *              says WHEN a challenge arrives, never WHICH.
 *   `enemies`  the species this world has. Same.
 *   `rules`    what has to be true of the finished grid, as named predicates.
 *              This is the half `themeProblems` enforces and `verify.mjs`
 *              proves with a broken fixture — a rule nobody has ever seen fail
 *              is indistinguishable from no rule.
 *
 * Plus `shape`, an optional pass that writes the theme's own structure onto the
 * finished canvas (a factory has a ceiling; the pieces cannot each grow one).
 *
 * The four open-air themes share one rule and it is not a formality: **there is
 * sky over every column.** It is the exact mirror of world 8's claim, which is
 * measured on rows 0 and 1, and it is what stops a generated meadow from
 * quietly acquiring a lid because some piece grew tall enough.
 */

/** Rows 0..1 — the two the world-8 roof claim is measured on. See verify.mjs. */
const SKY_ROWS = 2;
const STANDS = '#X';

const rowsOf = (rows) => rows.map((r) => r || '');
const at = (rows, x, y) => (rows[y] || '')[x] || ' ';

/** Every column has sky above it: nothing solid in the two topmost rows. */
function ruleOpenSky(rows) {
  const out = [];
  for (let y = 0; y < SKY_ROWS; y++) {
    for (let x = 0; x < (rows[y] || '').length; x++) {
      if (rows[y][x] !== ' ') out.push(`taivas ei ole auki sarakkeessa ${x}, rivi ${y}`);
    }
  }
  return out.slice(0, 3);
}

/**
 * The bone world's sky is five rows deep, not two: the moon and the stars are
 * the reason that world reads as midnight, and `chunks/bone.js` keeps rows 0..4
 * empty for them. A generated bone level has to buy the same silence.
 */
function ruleBoneSky(rows) {
  const out = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < (rows[y] || '').length; x++) {
      if (rows[y][x] !== ' ') out.push(`kuu ei näy sarakkeessa ${x}, rivi ${y}`);
    }
  }
  return out.slice(0, 3);
}

/** Bone stands: every `#`/`X` above the floor slab rests on one directly below. */
function ruleBoneStands(rows) {
  const out = [];
  for (let y = 0; y < FLOOR; y++) {
    for (let x = 0; x < (rows[y] || '').length; x++) {
      if (!STANDS.includes(at(rows, x, y))) continue;
      if (!STANDS.includes(at(rows, x, y + 1))) out.push(`luu roikkuu ilmassa ${x},${y}`);
    }
  }
  return out.slice(0, 3);
}

/** Cloud stands on nothing: no `#`/`X` anywhere above the floor slab. */
function ruleCloudNoLegs(rows) {
  const out = [];
  for (let y = 0; y < FLOOR; y++) {
    for (let x = 0; x < (rows[y] || '').length; x++) {
      if (STANDS.includes(at(rows, x, y))) out.push(`jokin seisoo maassa ${x},${y}`);
    }
  }
  return out.slice(0, 3);
}

/**
 * No thin cloud over nothing — and therefore no plank bridging a hole.
 *
 * The two are the same sentence in this world and that is the point world 7
 * made when it paid for it: a semi-solid platform can be dropped through, so a
 * plank with a pit under it is a trap you spring by pressing down. Requiring
 * solid cloud somewhere below every `-` closes it, and the price is that a hole
 * in this world is always jumped and never bridged.
 */
function ruleCloudHeld(rows) {
  const out = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < (rows[y] || '').length; x++) {
      if (at(rows, x, y) !== '-') continue;
      let held = false;
      for (let below = y + 1; below < ROWS && !held; below++) {
        if (STANDS.includes(at(rows, x, below))) held = true;
      }
      if (!held) out.push(`ohut pilvi tyhjän päällä ${x},${y}`);
    }
  }
  return out.slice(0, 3);
}

/**
 * The factory is an interior, and its ceiling is measured over rows 0..5 —
 * exactly the window `verify.mjs` reads `FACTORY_CHUNKS` over, because
 * `fac_cellar` and `fac_loft` roof at row 5 and are no less indoors for it.
 *
 * DELIBERATELY NOT ROWS 0..1, and this is the one place where two of the game's
 * structural claims would collide if nobody looked. World 8's claim is *"joka
 * sarakkeen yllä on kiveä"* measured on rows 0 and 1, with the runner-up
 * (the factory, 57 %) two levels away from it. Roof a generated factory level at
 * row 0 and world 4's share climbs toward 100 %, and the finale's claim stops
 * distinguishing anything — not because world 8 changed but because somebody
 * filled out world 4. So the factory's lid hangs at row 2 and below: an interior
 * whose machinery you can see, which is what world 4 already looks like.
 */
function ruleFactoryCeiling(rows) {
  const out = [];
  const w = (rows[0] || '').length;
  for (let x = 0; x < w; x++) {
    let roofed = false;
    for (let y = 0; y < 6 && !roofed; y++) if (STANDS.includes(at(rows, x, y))) roofed = true;
    if (!roofed) out.push(`tehtaassa ei ole kattoa sarakkeen ${x} yllä`);
  }
  return out.slice(0, 3);
}

/** The keep: stone over every column of rows 0..1, the finale's own claim. */
function ruleKeepRoof(rows) {
  const out = [];
  const w = (rows[0] || '').length;
  for (let x = 0; x < w; x++) {
    if (!STANDS.includes(at(rows, x, 0)) && !STANDS.includes(at(rows, x, 1))) {
      out.push(`linnakkeessa on ulkopuolta sarakkeen ${x} yllä`);
    }
  }
  return out.slice(0, 3);
}

/** The keep has no flagpole: every room is left through a door. */
function ruleKeepNoFlag(rows) {
  return rows.join('').includes('F') ? ['linnakkeessa on lippu, ja siellä ei ole yhtään ovea ulos'] : [];
}

/*
 * The fixtures. Each returns a `clean` grid its theme accepts and a `broken` one
 * it must reject, differing by as little as possible — usually one tile.
 *
 * They exist because `themeProblems` is currently asked of four grass levels and
 * four ice ones and nothing else: the generator does not yet build a bone,
 * cloud, factory or keep level, so six rules out of nine would be untested
 * promises. A rule that has never rejected anything is not a rule.
 *
 * One pair per rule and not one per theme, which is the same argument the music
 * gate had to learn twice: a check that covers two of a theme's rules and not
 * the third looks exactly like a check that covers all of them.
 */
const flat = (w = 24) => {
  const rows = Array.from({ length: ROWS }, () => ' '.repeat(w));
  rows[FLOOR] = '#'.repeat(w);
  rows[FLOOR + 1] = '#'.repeat(w);
  return rows;
};
const poke = (rows, x, y, ch) => rows.map((row, i) => (i === y
  ? row.slice(0, x) + ch + row.slice(x + 1) : row));
const roof = (rows, y) => rows.map((row, i) => (i === y ? 'X'.repeat(row.length) : row));

const THEME_FIXTURES = {
  openSky: () => ({ clean: flat(), broken: poke(flat(), 5, 1, 'X') }),
  bone: () => ({ clean: flat(), broken: poke(flat(), 5, 4, 'X') }),
  boneStands: () => ({ clean: flat(), broken: poke(flat(), 5, 9, 'X') }),
  cloud: () => ({ clean: poke(flat(), 5, 9, '-'), broken: poke(flat(), 5, 9, 'X') }),
  cloudHeld: () => ({
    clean: poke(flat(), 5, 9, '-'),
    broken: poke(poke(poke(flat(), 5, FLOOR, ' '), 5, FLOOR + 1, ' '), 5, 9, '-'),
  }),
  factory: () => ({ clean: roof(flat(), 3), broken: poke(roof(flat(), 3), 5, 3, ' ') }),
  keep: () => ({ clean: roof(flat(), 0), broken: poke(roof(flat(), 0), 5, 0, ' ') }),
  keepFlag: () => ({ clean: roof(flat(), 0), broken: poke(roof(flat(), 0), 5, 8, 'F') }),
};

/**
 * Writes a lid of `X` across the whole level, from row `top` down to row `y`.
 *
 * `top` IS THE HALF THAT WAS MISSING, AND IT COST A STRUCTURAL CLAIM.
 *
 * This used to fill every row from 0 down to `y`, which is a reasonable thing
 * for a lid to do and the wrong thing for this game's lid to do. `ruleFactoryCeiling`
 * right below explains at length why the factory's roof is measured over rows
 * 0..5 rather than 0..1: world 8's own claim — *"joka sarakkeen yllä on
 * kiveä"* — is measured on rows 0 and 1, and its nearest rival is the factory
 * at 56.6 %. Roof a generated factory level at row 0 and world 4 climbs toward
 * 100, and the finale stops distinguishing anything.
 *
 * The comment said the lid hangs "at row 2 and below". The code hung it from
 * row 0, and nothing measured which of the two was true. Measured now: four
 * generated factory levels at **100 % roofed each**, world 4 at **79.4 %**
 * against its committed 56.6, and the world-8 gate (`runnerUp.share <= 60`)
 * red. `verify.mjs` holds it from this side too, so the two halves of the
 * argument cannot drift apart again.
 *
 * So the factory's lid is rows 2..3 — two rows thick, exactly the keep's own
 * thickness, hanging two rows lower. An interior whose machinery you can see
 * over, which is what world 4 already looks like: its hand-made levels are
 * roofed over about half their columns and open over the rest.
 */
function ceilingPass(c, y, top = 0) {
  for (let x = 0; x < c.width; x++) {
    for (let row = top; row <= y; row++) c.set(x, row, 'X');
  }
}

export const THEME_RULES = {
  grass: {
    bg: 'hills',
    enemies: ['g', 'g', 'k', 'f'],
    weights: {
      gap: 4, enemies: 5, blockRow: 4, stairs: 2, pipe: 2, platforms: 3,
      coins: 2, notes: 1, stinkGap: 2, corkGate: 1, highReward: 2,
      crumbleWalk: 2, switchWall: 2,
    },
    rules: [ruleOpenSky],
    fixtures: [THEME_FIXTURES.openSky],
  },
  desert: {
    bg: 'dunes',
    enemies: ['g', 'k', 'f', 'r'],
    weights: {
      gap: 3, enemies: 4, blockRow: 3, stairs: 2, platforms: 3, spikes: 2,
      heartburn: 3, sun: 1, coins: 2, stinkGap: 2, corkGate: 2, lava: 1,
      highReward: 2, crumbleWalk: 3, switchWall: 2,
    },
    rules: [ruleOpenSky],
    fixtures: [THEME_FIXTURES.openSky],
  },
  /*
   * Night is the desert's dark half and not a world of its own (2-N is the only
   * hand-made one), so it inherits the dunes' vocabulary minus the one piece
   * that cannot be there: the angry sun. That is the whole theme in one line,
   * and it is the kind of thing that would otherwise be a comment nobody reads.
   */
  night: {
    bg: 'dunes',
    enemies: ['g', 'k', 'f', 'r'],
    weights: {
      gap: 3, enemies: 4, blockRow: 3, stairs: 2, platforms: 3, spikes: 2,
      heartburn: 2, coins: 2, stinkGap: 3, corkGate: 2, lava: 1,
      highReward: 2, crumbleWalk: 3, switchWall: 2,
    },
    rules: [ruleOpenSky],
    fixtures: [THEME_FIXTURES.openSky],
  },
  ice: {
    bg: 'peaks',
    /* No spiky walker, and that is a decision rather than an oversight: `x` is
     * world 3's own hand-made introduction (`spike_walk` in 3-1), and the
     * generator adding a second source of it would take that away from the level
     * that teaches it. It is also the tile that would have moved 5-3 — the
     * generated levels draw species from this list, so lengthening it rewrites a
     * world nobody asked to change. Measured: with `x` in the list, 5-3 came out
     * a different level at the same width. */
    enemies: ['g', 'k', 'f', 'c'],
    weights: {
      gap: 4, enemies: 4, blockRow: 3, platforms: 4, stairs: 2, spikes: 2,
      coins: 2, notes: 1, stinkGap: 3, corkGate: 2, lava: 2, heartburn: 2,
      highReward: 2, crumbleWalk: 3, switchWall: 2,
    },
    rules: [ruleOpenSky],
    fixtures: [THEME_FIXTURES.openSky],
  },
  factory: {
    bg: 'factory',
    enemies: ['g', 'k', 'f', 'c'],
    weights: {
      gap: 3, enemies: 4, blockRow: 3, stairs: 1, platforms: 3, spikes: 2,
      heartburn: 3, coins: 2, corkGate: 2, lava: 2,
      crumbleWalk: 4, switchWall: 3, pipe: 2,
    },
    /* The lid, and why it is not taller: `blockRow` floats as high as row 4 and
     * the tallest body needs three rows, so a ceiling at row 3 is the lowest one
     * that never lands on a block row or on the player's head. And why it does
     * not reach row 0: see `ceilingPass` — rows 0 and 1 are the two the finale's
     * roof claim is measured on, and this world is its nearest rival. */
    shape: (c) => ceilingPass(c, 3, 2),
    maxBlockHeight: 7,
    rules: [ruleFactoryCeiling],
    fixtures: [THEME_FIXTURES.factory],
  },
  /*
   * Bone: the sky is open five rows deep and nothing hangs. The vocabulary is
   * cut by the second half of that — `highReward` puts its ledge at
   * FLOOR-(wall+4), which is row 4 in this game's measured budget, i.e. straight
   * through the moon.
   */
  bone: {
    bg: 'bones',
    enemies: ['g', 'k', 'f', 'x'],
    weights: {
      gap: 4, enemies: 5, blockRow: 3, stairs: 3, platforms: 3, spikes: 2,
      coins: 2, stinkGap: 2, corkGate: 2, crumbleWalk: 3, switchWall: 2,
    },
    maxBlockHeight: 7,
    /* Five, and the two rows between it and `maxBlockHeight` are the coin a
     * plank carries: at seven the coin lands on row 4, i.e. through the moon.
     * Measured: with the plank uncapped only 10 of 80 seeds built a legal 6-4. */
    maxPlatform: 5,
    rules: [ruleBoneSky, ruleBoneStands],
    fixtures: [THEME_FIXTURES.bone, THEME_FIXTURES.boneStands],
  },
  /*
   * Cloud: nothing stands, so `stairs` (a pyramid of `X`) is out of the
   * vocabulary entirely, and every plank has to be over ground — which takes
   * `corkGate` and `lava` with it, because both bridge a hole with one.
   */
  cloud: {
    bg: 'clouds',
    enemies: ['g', 'k', 'f', 'r'],
    /*
     * THE HOLE IS THE THEME, AND THE WEIGHTING NOW SAYS SO.
     *
     * These numbers were the meadow's with the impossible pieces struck out,
     * which is the right way to *start* a theme and the wrong way to leave one.
     * Measured against what world 7 actually is: `7-1`, `7-2` and `7-3` carry
     * **17 holes across 1008 columns — one every 59 — and not one of them is
     * bridged**, which is the world's own sentence written as a number. The old
     * weighting produced about a third of that, because `gap` and `stinkGap`
     * were 7 shares out of 26.
     *
     * They are now 12 out of 33, and nothing else moved. That is editorial and
     * it is allowed to be: DESIGN.md kohta 3 says the corpus decides WHEN a
     * challenge arrives and never WHICH, so which pieces a world is made of is
     * exactly the half that has to be written here by hand — against this
     * world's own hand-made levels, which is a source we own.
     *
     * `crumbleWalk` goes 2 → 3 for the same reason from the other side: a world
     * where nothing stands on the ground has only two kinds of floor, the cloud
     * you land on and the cloud that leaves.
     */
    weights: {
      gap: 8, enemies: 5, blockRow: 3, platforms: 3, coins: 2, notes: 2,
      stinkGap: 4, crumbleWalk: 3, switchWall: 2, spikes: 1,
    },
    maxBlockHeight: 7,
    rules: [ruleCloudNoLegs, ruleCloudHeld],
    fixtures: [THEME_FIXTURES.cloud, THEME_FIXTURES.cloudHeld],
  },
  /*
   * The keep. No outside and no flagpole, which means a generated keep level is
   * a *boss room*: it ends in a door, and the door needs a fight behind it.
   * Nothing here builds an arena yet — that is the piece world 8's four missing
   * levels will need, and it is named here so the next person meets it as a gap
   * rather than as a surprise.
   */
  fortress: {
    bg: 'none',
    enemies: ['g', 'k', 'f'],
    weights: {
      gap: 3, enemies: 5, blockRow: 3, spikes: 3, heartburn: 3, lava: 3,
      crumbleWalk: 3, coins: 1, corkGate: 2,
    },
    shape: (c) => ceilingPass(c, 1),
    maxBlockHeight: 7,
    boss: true,
    rules: [ruleKeepRoof, ruleKeepNoFlag],
    fixtures: [THEME_FIXTURES.keep, THEME_FIXTURES.keepFlag],
  },
};

/**
 * What is wrong with this grid, if it claims to be of this theme. Empty is good.
 *
 * An unknown theme is a problem and not a pass: the failure this prevents is a
 * typo in a level spec silently buying an exemption from every rule its world
 * has.
 */
export function themeProblems(theme, rows) {
  const rule = THEME_RULES[theme];
  if (!rule) return [`tuntematon teema ${theme}`];
  return rule.rules.flatMap((fn) => fn(rowsOf(rows)));
}

/* --------------------------- the quiet characters ------------------------ */

/*
 * Two of the four new characters are not set pieces, because neither of them is
 * a *place*. A star block is one block among many that happens to hold the
 * level's biggest surprise, and a secret is an ordinary brick with something
 * behind it. Both are therefore passes over a finished level rather than pieces
 * in the weighting, which is also the only way to say "exactly one per level".
 */

/**
 * Promotes one existing `?` block to a star block.
 *
 * `TILE_INFO` gives `*` the same drawing as `?` deliberately — a block that
 * announced itself would turn the surprise into an errand — so the star is not
 * a new shape in the level, it is a claim about one block that is already
 * there. Hence promotion rather than placement: the geometry is untouched and
 * the star inherits whatever it cost to reach that block.
 *
 * Which one: the highest candidate past the opening quarter. The first quarter
 * belongs to the guaranteed mushroom (DESIGN.md §5), and a star found before
 * you have even been hit once is the cheapest possible version of it.
 */
function placeStar(c, notBefore) {
  const cands = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = notBefore; x < c.width; x++) if (c.get(x, y) === '?') cands.push([x, y]);
  }
  if (!cands.length) return false;
  cands.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  c.set(cands[0][0], cands[0][1], '*');
  return true;
}

/*
 * The secret-brick rates, copied from src/scenes/level.js.
 *
 * Copied and not imported, because they are private to `LevelScene` and that
 * module cannot be loaded outside a browser. The copy is a real coupling and it
 * is checked rather than trusted: `tools/verify.mjs` asks the *engine's own*
 * `brickSecret` whether each generated level actually hides something, so if
 * these two numbers ever drift apart the gate says so instead of the generator
 * quietly building levels with nothing in them.
 */
const SECRET_COIN_RATE = 0.07;
const SECRET_POWER_RATE = 0.015;
export const hidesSomething = (x, y) => hashNoise(x * 7 + 13, y * 11 + 5) < SECRET_POWER_RATE
  || hashNoise(x * 3 + 1, y * 5 + 2) < SECRET_COIN_RATE;

/**
 * Makes sure at least one ordinary brick in the level is hiding something.
 *
 * Which bricks hide what is a pure function of tile position, so it applies to
 * generated levels for free — and "for free" is exactly the problem: measured
 * against the levels this replaces, 5-1 and 5-2 held **no secret at all**, and
 * nobody would have known. A mechanic that is present in the engine and absent
 * from the content is not a mechanic.
 *
 * The fix is the smallest one that does not disturb the rhythm: extend an
 * existing brick run by a single tile into air beside it. A run of five
 * becoming a run of six is well inside the mined run-length distribution, so
 * the level still breathes the way the statistics say — nothing here invents a
 * new brick row, it only lengthens one the pacing already asked for.
 */
function ensureSecret(c) {
  const bricks = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < c.width; x++) if (c.get(x, y) === 'B') bricks.push([x, y]);
  }
  if (bricks.some(([x, y]) => hidesSomething(x, y))) return true;
  for (const [x, y] of bricks) {
    for (const nx of [x - 1, x + 1]) {
      if (nx < 0 || nx >= c.width || c.get(nx, y) !== ' ') continue;
      if (!hidesSomething(nx, y)) continue;
      c.set(nx, y, 'B');
      return true;
    }
  }
  return false;
}

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

/**
 * THE THREE KNOBS, AND WHY THERE ARE THREE RATHER THAN ONE.
 *
 * There used to be one, `intensity`, and it moved two things at once: the calm
 * between challenges and the number of enemies. That was enough for world 5,
 * where all three levels sit at the hard end of the game and the only question
 * was *how* hard. It is not enough for filling out world 1, and the measurement
 * says why: world 1's hand-made levels carry **1.5–2.7 enemy-cost per 100
 * columns** and world 5's generated ones carry **12.2–13.6**. Reaching the
 * first from the second through `intensity` alone means dividing by five, and
 * `intensity` also divides into the rest length — so a world-1-density level
 * would have come out with four times the calm ground, i.e. a different level
 * rather than a gentler one.
 *
 * So the knobs are now separate, and each one is a number a world already has:
 *
 *   `intensity`      how tight the calm is. Pacing.
 *   `enemiesPer100`  how many enemy markers per 100 columns. **Editorial, and
 *                    measured off the world the level is joining** — a level
 *                    that arrives in world 1 breathes at world 1's rate, not at
 *                    the corpus's global average. Two-sided: the generator tops
 *                    up when the pieces undershoot and culls when they overshoot,
 *                    so the number is hit rather than approached.
 *   `maxGap`         the widest jump this world asks for, in tiles. World 3's
 *                    own history is the argument: 3-1 was the world's *hardest*
 *                    level purely because three of its gaps sat at or one tile
 *                    under the six-tile budget, and the fix was the level rather
 *                    than the meter.
 *
 * `maxGap` is a cap and never a floor, so it cannot push a gap past the measured
 * budget — the ground-route promise (DESIGN.md §5) is still the validator's, and
 * a knob that could break it would not be a difficulty knob but a bug.
 */
export function buildLevel({
  seed = 0, theme, targetWidth, tuning = null, intensity = 1,
  enemiesPer100 = null, maxGap = null, drop = [], species = null, minIntro = 0,
}) {
  /* Sama rivi samassa paikassa kuin ennen: työkalu ajoi `rnd = mulberry32(seed)`
   * juuri ennen tätä kutsua, ja telemetriakierroksella uudestaan ennen toista.
   * Se on nyt kutsun sisällä, jotta kaksi kutsujaa ei voi eri tavoin unohtaa. */
  rnd = mulberry32(seed);
  const pal = THEME_RULES[theme];
  /*
   * `drop` and `species` are SUBTRACTIVE, and that direction is the whole point.
   *
   * World 1 is the game's teaching world and `levels/world1.js` argues at length
   * that its levels are short on ideas on purpose — the flyer, the stink cloud,
   * the note block and the pipe plant were all *moved out of 1-2* on measured
   * evidence. Filling the world out with generated levels that hand those four
   * straight back would have undone that work silently, and it very nearly did:
   * `tools/curriculum.mjs` measured the first draft and found `1-4` had become
   * the first place in the game to meet the switch block, the flyer and the
   * stink cloud, with two of the three inside one screen of each other.
   *
   * An additive allow-list would have been the other way to write this and it is
   * the worse one: a new set piece added to the generator would be silently
   * absent from every world with a list, i.e. the rule would decay into
   * whichever pieces existed the day somebody wrote it. Subtracting names what
   * is deliberately *not* here, so a new piece arrives everywhere by default and
   * a world that does not want it has to say so.
   */
  const weights = Object.fromEntries(Object.entries(pal.weights)
    .filter(([name]) => !drop.includes(name)));
  const enemies = species || pal.enemies;
  const c = new Canvas();
  const ctx = {
    enemies,
    plants: !drop.includes('plant'),
    restScale: 1,
    ease: 0,
    gaveePower: false,
    maxGap: maxGap === null ? REACH.gap : Math.min(maxGap, REACH.gap),
    /*
     * A WORLD THAT NAMES ITS WIDEST JUMP GETS NO BRIDGED HOLES AT ALL, and that
     * is the second thing `tools/playable.mjs` taught this generator.
     *
     * The default is the measured pair: a plain gap is capped at six tiles and a
     * bridged one at nine, the extra three bought by a plank in the middle.
     * DESIGN.md §5 allows exactly that — "jokainen kuilu mahtuu mitattuun
     * juoksuhyppybudjettiin **tai siinä on astinkivi**".
     *
     * Measured, it does not survive contact with the only automated check that
     * promise has. The bot in `playable.mjs` runs and jumps and **cannot use a
     * floating stepping stone** — the tool says so in its own output — so a
     * bridged nine-tile hole is indistinguishable to it from a hole nobody can
     * cross, and 3-7 duly joined the known-failure list at column 70 with a
     * nine-wide pit and a two-tile plank at FLOOR-3 in the middle of it.
     *
     * World 7 already paid this exact price for a different reason, and its
     * sentence is the one worth borrowing: **every hole in this world is jumped
     * and none is bridged.** So a spec that names `maxGap` gets `softGap` equal
     * to it. The default path — world 5, whose levels are already measured and
     * already pass — is untouched, which is why this is written as a consequence
     * of naming a cap rather than as a new global rule.
     */
    softGap: maxGap === null ? REACH.softGap : Math.min(maxGap, REACH.gap),
    /*
     * A lethal tile is bounded ONE TILE TIGHTER than a hole of the same width,
     * and the tile is where the difference is: a hole's far edge is a lip you
     * can scramble onto with the jump already spent, and a spike bed's or a lava
     * pool's far edge is floor you have to land *past*. Measured on ice, that
     * one tile is the whole difference — a five-wide pool stopped the power-0
     * bot at column 56 of 3-6 while a five-tile hole in the same world did not.
     *
     * Uncapped means "as it always was": 7 is the top of `lava`'s own range, so
     * world 5's levels, which are measured and pass, do not move.
     */
    maxHazard: maxGap === null ? 7 : Math.min(maxGap, REACH.gap) - 1,
    maxBlockHeight: pal.maxBlockHeight || 9,
    /*
     * How high a floating plank may sit. Seven is `platforms`' own top and the
     * default, so declaring nothing keeps the level the generator already
     * built; a theme lowers it only when its own rule needs the room above the
     * plank rather than the plank itself. See the clamp inside `platforms`.
     */
    maxPlatform: pal.maxPlatform || 7,
  };
  const trace = [];
  let x = 0;

  /*
   * A safe opening, the length the corpus gives before its first challenge —
   * with a floor the world may raise, and the floor is a measurement about the
   * FLOOR in the other sense.
   *
   * The mined number (5–17 columns, mean 11) is measured on ordinary ground. Ice
   * is not ordinary ground: the engine gives it its own friction, so a player
   * who has just started walking is still nowhere near running speed after
   * eleven tiles. `tools/playable.mjs` measured exactly that and it is not
   * subtle — the first draft of world 3's generated levels put a gap at column
   * 17 and a wall at column 22, and the power-0 bot got 5 % and 7 % of the way
   * through. The identical vocabulary on grass (world 1's four levels) cleared
   * at 100 %.
   *
   * So `minIntro` is the world's, and it is the ground-route promise
   * (DESIGN.md §5) in the one unit that matters on a slippery floor: how much
   * floor there is to get moving on. World 3's hand-made levels do the same
   * thing without saying so — `3-1` spends `start`, `spike_walk`, `power` and
   * `walkers` before its first pit, which is 64 columns.
   */
  const intro = Math.max(minIntro,
    Math.max(10, Math.min(24, sampleHist(stats.introSafeColumns, { min: 8, max: 26 }))));
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
    ctx.restScale = ((1.35 - 0.6 * (ramp[quarter] / peak)) / intensity)
      * (tuned ? tuned.restScale : 1);
    ctx.ease = tuned ? tuned.ease : 0;
    const from = x;
    x += PIECES.rest(c, x, ctx);

    let name = weightedPiece(weights);
    if (name === lastPiece) name = weightedPiece(weights);   // avoid doubles
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

  /*
   * ENEMY DENSITY, HIT FROM BOTH SIDES.
   *
   * The weights alone undershoot in one world and overshoot in another, because
   * the same `enemies` piece is worth a different amount of density in a level
   * that is 200 columns long and one that is 340. Topping up was already here;
   * culling is new, and without it `enemiesPer100` would be a floor pretending
   * to be a target — which is exactly how world 1 would have acquired world 5's
   * enemy count while the spec said otherwise.
   *
   * Culling removes markers and never geometry, so a culled level is the same
   * level with fewer things walking about in it. It takes them from the back
   * first: an enemy the player meets late has had the whole level to be
   * anticipated, and the opening is where the density is a lesson.
   */
  const rate = enemiesPer100 === null ? stats.enemiesPer100 * 0.8 * intensity : enemiesPer100;
  const target = Math.round((rate / 100) * x);
  const found = [];
  for (let y = 0; y < ROWS; y++) {
    for (let px = 0; px < c.width; px++) if (enemies.includes(c.get(px, y))) found.push([px, y]);
  }
  let placed = found.length;
  for (let tries = 0; placed < target && tries < 400; tries++) {
    const px = range(intro + 6, x - 12);
    const kind = pick(enemies);
    const row = FLOOR - (ENEMY_ROW[kind] || 1);
    const clear = [-2, -1, 0, 1, 2].every((d) => c.get(px + d, FLOOR) === '#'
      && [1, 2, 3, 4, 5, 6].every((up) => c.get(px + d, FLOOR - up) === ' '));
    if (!clear) continue;
    c.set(px, row, kind);
    placed++;
  }
  if (enemiesPer100 !== null && placed > target) {
    found.sort((a, b) => b[0] - a[0]);
    for (const [px, py] of found) {
      if (placed <= target) break;
      c.set(px, py, ' ');
      placed--;
    }
  }

  // Run-up, flag, and a little ground past it so the camera has somewhere to go.
  c.ground(x, 10);
  for (let i = 0; i < 3; i++) c.set(x + 2 + i * 2, FLOOR - 4, 'o');
  x += 10;
  /* The keep has no flagpole, because it has no room you leave by walking. Its
   * exit is the door the fight opens, and the door is the level's `boss` flag
   * rather than a tile — see `THEME_RULES.fortress`. */
  if (!pal.boss) c.set(x + 3, FLOOR - 1, 'F');
  c.ground(x, 10);

  /* The theme's own structure, last, over the whole finished width: a ceiling
   * cannot be grown by each piece separately without every piece knowing which
   * world it is in. */
  if (pal.shape) pal.shape(c);

  /* The two characters that are claims about blocks rather than places. Both
   * run last, on the finished level, and both report failure to the validator
   * instead of shrugging — see `validate`. */
  const star = placeStar(c, quarter);
  const secret = ensureSecret(c);

  return { rows: c.rows(), trace, star, secret };
}
/* ------------------------------ validation ------------------------------ */

/**
 * Kept identical to src/data/rules.js's own SOLID, and it has to be: this set
 * is what `originality` canonicalises our output with, so a solid character
 * missing from here would be compared to the corpus as if it were air and the
 * similarity check would be looking at the wrong grid. `%`, `S` and `*` joined
 * it with the tiles they name.
 */
const SOLID = new Set(['#', 'X', 'B', '?', '!', '*', 'u', 'N', '[', ']', '{', '}', '%', '(', ')', 'S']);
/*
 * Juoksuhiekka, and it is here for the reason the comment above gives about
 * `SOLID`: `canonOurs` below folds every character it does not recognise into
 * air, so a tile missing from these sets is compared against the corpus as if
 * the level had a hole where the tile is. Sand is not air and it is not rock —
 * it is footing you sink through — so it canonicalises to its own symbol.
 *
 * The generator does not *emit* it: world 5 is a factory and quicksand belongs
 * to the desert. That is exactly why the line has to be here anyway. The day
 * somebody adds a sand chunk to the vocabulary, the two ways this could go
 * wrong — the similarity check reading a pool as a pit, and `validate` blessing
 * a pool with no bottom because `validateLevel` never saw the character — are
 * both already closed. Kept character for character identical with the copy in
 * `src/data/rules.js`; `verify.mjs` compares the two lines as strings.
 */
const SINK = new Set(['~']);
export const ENEMY = new Set(['g', 'k', 'f', 'p', 'r', 'c', 'A', 'H', 'O']);

/**
 * `rules.js` owns everything that is true of any level in the game. What is
 * added here is what is only true of a *generated* one — the promises the
 * generator makes about its own vocabulary, which a hand-made level keeps by
 * having a person look at it.
 */
export function validateGenerated(id, rows, built, theme) {
  const problems = validateLevel(rows, budget);
  if (!rows.some((r) => r.includes('1'))) problems.push('no player start');
  const boss = !!(THEME_RULES[theme] || {}).boss;
  if (!boss && !rows.some((r) => r.includes('F'))) problems.push('no goal');

  /* The world's own structural rule, and it is checked here rather than left to
   * `verify.mjs` because a level that breaks it should never reach the file. */
  problems.push(...themeProblems(theme, rows));

  const grid = rows.join('');
  const count = (ch) => grid.split(ch).length - 1;

  /* A switch with nothing to change is furniture, and a switch is the only
   * thing that makes a floating brick row more than decoration. The pairing is
   * the mechanic, so neither half is allowed to appear alone. */
  if (count('S') && !count('B')) problems.push('switch block with no bricks to change');

  /* Exactly one star. Zero means the level never got the surprise; more than
   * one means it stopped being one. */
  const stars = count('*');
  if (stars !== 1) problems.push(`${stars} star blocks, want exactly 1`);
  if (built && !built.star) problems.push('no ? block past the first quarter to promote to a star');

  /* And at least one ordinary brick with something behind it. */
  if (built && !built.secret) problems.push('no brick in the level hides anything');

  return problems.map((p) => `${id}: ${p}`);
}