/**
 * The level design rules, in one place so the generator and the test suite
 * cannot drift apart. Everything here is a hard rule with a reason:
 *
 *   - the ground route is clearable at the smallest size and one jump, so a
 *     power-up opens places rather than the level itself
 *   - nothing spawns inside a wall or stands on nothing
 *   - the tallest power level has headroom everywhere it can walk
 *   - a mushroom is within the first quarter, so losing power is a setback
 *     rather than a sentence
 *   - a platform run leads to something; no stairways to nothing
 *   - a bonus room you can get into is a bonus room you can get out of
 *
 * See DESIGN.md section 5 for the reasoning behind each one.
 *
 * ## The three kinds of rule
 *
 * A tall level is three bands of 15 rows stacked into one grid — sky, route,
 * cave — and they are not the same kind of place, so they do not get the same
 * rules. Every check below is one of three kinds, and which kind it is, is a
 * statement about what the rule *means*, not about where it happens to be
 * convenient to run it:
 *
 *   **universal** — true of any band anywhere. Ragged rows and footing are
 *   questions about one tile and its neighbour; headroom over ground you can
 *   walk on is a question about the tallest body. None of the three mention a
 *   start or a flag, so all three are asked of every band.
 *
 *   **route-only** — meaningful only where the player must get from a start to
 *   an exit: gap width against the jump budget, wall height, "no stairway to
 *   nowhere", and the power-up in the first quarter. A sky garden has no flag
 *   and no obligation to be crossable end to end; a cave room's side wall is
 *   eight tiles tall and is a wall on purpose. Run these on a bonus band and
 *   every one of them fires on perfectly sound content — measured, not
 *   guessed: `cave_room` alone reports a wall of 8 and a gap the width of the
 *   level. That is why "validate every band" cannot mean "run every rule
 *   everywhere".
 *
 *   **bonus-only** — what a hidden band needs that a route does not: a way in
 *   and, from where the way in puts you, a way back out at the *tallest* size.
 *   The route band gets none of these, because leaving it is what the flag is
 *   for.
 *
 * ## Why the way out is checked at the tallest size and the way in is not
 *
 * Every hidden room in the game holds a power-up. So the player who has to
 * leave is not the player who arrived: you drop in small, you grow in there,
 * and then the exit pipe has to take a 21x43 px body. An entry that only
 * admits a small player is a curiosity; an exit that only admits a small
 * player is the trap `secrets.js` names — a bonus you cannot leave. Hence the
 * asymmetry: the way in is checked at the smallest size (does anything at all
 * get in?), the way out at the largest.
 *
 * ## What these checks cannot prove
 *
 * They are grid geometry, not a simulation, and the honest limits are:
 *
 *   - **Connectivity is air, not walking.** The way-out check floods the air
 *     of a band from where the player arrives and asks whether an exit is in
 *     that air. Rock genuinely blocks, so a "no way out" is real. But air says
 *     nothing about gravity: a shelf too high to jump onto is still air.
 *   - **The walk from the arrival to the exit is only checked as floor.** Gap
 *     and rise between the two are measured against the jump budget, and only
 *     when the arrival lands on the band's own floor. It does not model
 *     momentum, enemies, or a route that goes over the top of something.
 *   - **A brick is a wall here.** The flood fill does not know the big player
 *     can break `B`. A room whose only exit is behind bricks would be reported
 *     rather than passed — deliberately, since that is a design nobody has
 *     asked for and would rather hear about.
 *   - **The ways in and out are the ones the grid names**: a warp pipe and a
 *     beanstalk. Jumping across a band seam is not modelled, so a hidden band
 *     reachable only by a very tall jump would be reported as having no way in.
 *     No band in the game is built that way, and one that was should say so in
 *     the map.
 *   - **A beanstalk answers its own question.** When the way in is a vine, the
 *     way out is the same vine, so the way-out check is nearly free there. What
 *     it does still prove is that the vine reaches — it has to cross the seam
 *     in one unbroken column — and that it is wide enough to climb.
 *   - **Nothing here proves a room is fun, or that the coins are gettable.**
 */

const ROWS = 15;
const FLOOR = 13;

/**
 * The tallest power level is 21x43 px (`PLAYER_SIZES[5]`). Standing on a floor
 * its feet sit on the tile boundary, so it fills exactly the three tile rows
 * above that floor — that is HEAD — and, placed anywhere in the middle of a
 * two-tile pipe mouth, exactly two tile columns. Both numbers are why a warp
 * can be checked over the pipe's own columns and three rows and no more.
 *
 * The smallest is 12x16: one row, one column. It is the yardstick for "can
 * anybody get in here at all".
 */
const HEAD = 3;
const SMALL_HEAD = 1;

/*
 * '%' is the crumbling platform. It counts as solid here on purpose: it holds
 * long enough to walk across, so a route over it is a real route. Leaving it
 * out would make the validator read every catwalk as a bottomless pit and
 * reject perfectly good levels.
 *
 * '*' (the star block) was missing and is not a judgement call: `TILE_INFO`
 * gives it `solid: true`, so the engine walks into it and the validator did
 * not. That mattered nowhere while the rules only measured floors; it matters
 * now that they ask whether a body fits somewhere, so the two lists agree.
 */
const SOLID = new Set(['#', 'X', 'B', '?', '!', '*', 'u', 'N', '[', ']', '{', '}', '%', '(', ')', 'S']);
const SEMI = new Set(['-']);
const ENEMY = new Set(['g', 'k', 'f', 'p', 'r', 'c', 'A', 'H', 'O']);
const REWARD = new Set(['o', '!', '?', 'N', 'B']);
/* The two halves of a warp pipe's mouth. `{}` below them is ordinary pipe. */
const WARP = new Set(['(', ')']);
const VINE = 'v';
/*
 * Not solid, and not somewhere you travel through either. Lava is what
 * `assembleTall` lids a bottomless column with, so treating it as air would
 * quietly connect a cave room to the pit above it and call falling to your
 * death a way out.
 */
const DEADLY = new Set(['W']);

/* -------------------------------- bands ---------------------------------- */

/**
 * The bands of a level, top to bottom. A plain level is one band; a tall one is
 * three of 15 rows each — sky, route, cave.
 */
function bandsOf(rows) {
  if (rows.length <= ROWS) return [rows];
  const out = [];
  for (let top = 0; top + ROWS <= rows.length; top += ROWS) out.push(rows.slice(top, top + ROWS));
  return out;
}

/**
 * Which band is the route is not a guess and not a position: it is the band the
 * player starts in. That is the same sentence as the promise itself — the route
 * from the start to the flag must work at the smallest size — so the validator
 * and the design rule cannot drift apart. A tall level with no start marker is
 * therefore a genuine error and not a case to guess around; a one-band level is
 * its own route whether or not it carries the marker.
 */
function routeIndexOf(bands) {
  return bands.findIndex((band) => band.some((row) => row.includes('1')));
}

/** A band nobody put anything in is not a room. The `W` lid is not content. */
const hasContent = (band) => band.some((row) => /[^ W]/.test(row));

/* ------------------------------- geometry -------------------------------- */

/** Reads a band with out-of-bounds as air. */
const reader = (band, w) => (x, y) =>
  (y < 0 || y >= band.length || x < 0 || x >= w ? ' ' : band[y][x]);

/**
 * The top of the connected ground stack per column, so a floating block row is
 * never mistaken for terrain the player has to climb.
 */
function floorProfile(at, w) {
  const floor = [];
  for (let x = 0; x < w; x++) {
    if (!SOLID.has(at(x, FLOOR + 1)) && !SOLID.has(at(x, FLOOR))) { floor.push(null); continue; }
    let y = SOLID.has(at(x, FLOOR)) ? FLOOR : FLOOR + 1;
    while (y > 0 && SOLID.has(at(x, y - 1))) y--;
    floor.push(y);
  }
  return floor;
}

/**
 * Universal. The tallest power level needs three clear rows over anything it
 * can walk on, and "walk on" means the band's ground — the connected stack the
 * floor profile follows — not every ledge in the level.
 *
 * That scope is a decision and not laziness. A shelf with two rows over it is
 * not a trap: a body that does not fit above it cannot get onto it in the first
 * place, so it is unreachable at that size rather than sealed. `fort_blocks`
 * (1-F, 2-F, 3-F) and the block row in `tomb_cave` are exactly that shape, all
 * four verified by hand, and a rule that fired on them would be switched off
 * within the week and then it would protect nothing.
 */
function checkHeadroom(at, floor, from, to, problems, where) {
  for (let x = from; x <= to; x++) {
    if (floor[x] === null || floor[x] > FLOOR) continue;
    for (let y = floor[x] - HEAD; y < floor[x]; y++) {
      if (SOLID.has(at(x, y))) { problems.push(`no headroom at column ${x}${where}`); break; }
    }
  }
}

/**
 * Universal. A beanstalk has to be wide enough to climb at the tallest size.
 *
 * `Player.grabVine` snaps the body to the middle of the vine's column, so a
 * 21 px body straddles three columns: the vine's own and one either side. Rock
 * in any of them is a wall the climber walks into — which is why `sky_garden`'s
 * landing is planks and not ground, and why that decision needs a rule and not
 * a comment.
 *
 * Checked at the vine's own rows only. The body is three rows tall, so above
 * the *top* of a vine it also occupies two rows with no vine in them, and rock
 * there costs the climber some of the last stretch — `mesa_sky` has exactly
 * that shape and reaches its platform anyway (verified by hand at all six
 * sizes). Where a grid can no longer tell "just reaches" from "just misses",
 * this rule stops rather than guesses.
 */
function checkVines(rows, w, problems) {
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < w; x++) {
      if (rows[y][x] !== VINE) continue;
      for (let nx = Math.max(0, x - 1); nx <= Math.min(w - 1, x + 1); nx++) {
        if (SOLID.has(rows[y][nx])) {
          problems.push(`beanstalk at ${x},${y} is walled in at the tallest size`);
          break;
        }
      }
    }
  }
}

/** Route-only. Every bottomless run fits the measured jump or has a stone. */
function checkGaps(at, band, from, to, reach, problems, where) {
  let gap = 0;
  for (let x = from; x <= to; x++) {
    const bottomless = ![FLOOR, FLOOR + 1].some((y) => SOLID.has(at(x, y)))
      && at(x, FLOOR) !== 'W';
    if (bottomless) { gap++; continue; }
    if (gap > reach.gap) {
      const start = x - gap;
      const hasStone = band.slice(0, FLOOR).some((row) => row.slice(start, x).includes('-'));
      if (!hasStone) problems.push(`gap of ${gap} at column ${start}${where}`);
    }
    gap = 0;
  }
}

/** Route-only. No step up taller than the measured jump. */
function checkWalls(floor, from, to, reach, problems, where) {
  for (let x = Math.max(from, 1); x <= to; x++) {
    if (floor[x] === null || floor[x - 1] === null) continue;
    const rise = floor[x - 1] - floor[x];
    if (rise > reach.wall) problems.push(`wall of ${rise} at column ${x}${where}`);
  }
}

/* --------------------------- warps and vines ------------------------------ */

/**
 * Every warp a level offers, as a mouth **and the one direction it can be
 * travelled in**. Coordinates are whole-grid rows, because a warp is the one
 * thing that crosses bands.
 *
 * The direction is not a property of the level's intent, it is a property of
 * the picture, and `LevelScene.tryWarp` reads it the same way: you enter a
 * mouth facing the way you are going. So a run of `()` with air above it is a
 * pipe standing on the floor — you stand on it and press **down** — and a run
 * with air below it hangs from a ceiling and is entered pressing **up** from
 * underneath. This used to return the mouths alone and let the caller try both
 * ways from each, which blessed every floor pipe as a way out of a bonus room
 * upwards. The engine has refused that since the direction rule landed; this is
 * the validator catching up, and the gap mattered — it is exactly the check
 * that exists to stop somebody being sealed in.
 *
 * A lone `()` with air on both sides is genuinely both, and is returned twice,
 * because that is what the engine would let you do with it.
 */
function warpMouths(rows, w) {
  const mouths = [];
  const clear = (y, x0, x1) => {
    if (y < 0 || y >= rows.length) return true;
    for (let x = x0; x <= x1; x++) if (SOLID.has(rows[y][x])) return false;
    return true;
  };
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < w; x++) {
      if (!WARP.has(rows[y][x])) continue;
      if (x > 0 && WARP.has(rows[y][x - 1])) continue;
      let end = x;
      while (end + 1 < w && WARP.has(rows[y][end + 1])) end++;
      if (clear(y - 1, x, end)) mouths.push({ x0: x, x1: end, y, dir: 1 });
      if (clear(y + 1, x, end)) mouths.push({ x0: x, x1: end, y, dir: -1 });
    }
  }
  return mouths;
}

/**
 * The row a body's feet are on while it uses a mouth.
 *
 * Standing **on** a floor pipe, that is the mouth's own row. Standing **under**
 * a ceiling pipe it is HEAD + 1 rows below: the tallest body fills exactly HEAD
 * rows, and `WARP_UP_REACH` in the engine is HEAD tiles measured from the feet,
 * so the floor that every size can use the mouth from is the one directly under
 * the space that body occupies. It is the same number from both directions,
 * which is why a room's exit is built to it.
 */
const standRow = (mouth) => (mouth.dir > 0 ? mouth.y : mouth.y + HEAD + 1);

/**
 * The engine's own two conditions for a warp, as `LevelScene.tryWarp` states
 * them: the body fits where it arrives, and there is something to land on
 * between the arrival row and the end of the band it arrives in. This mirrors
 * `fits` and `footingWithin` deliberately — the validator should agree with the
 * engine rather than hold a second opinion about what a legal warp is.
 *
 * @param {number} head how many rows the body needs — HEAD for the tallest
 */
function warpLands(rows, w, mouth, head) {
  const feet = standRow(mouth) + mouth.dir * ROWS;
  if (feet < 0 || feet >= rows.length) return null;
  if (feet - head < 0) return null;
  for (let y = feet - head; y < feet; y++) {
    for (let x = mouth.x0; x <= mouth.x1; x++) if (SOLID.has(rows[y][x])) return null;
  }
  const bandEnd = Math.min(rows.length - 1, (Math.floor(feet / ROWS) + 1) * ROWS - 1);
  let footing = false;
  for (let y = feet; y <= bandEnd && !footing; y++) {
    for (let x = mouth.x0; x <= mouth.x1; x++) {
      const ch = rows[y][x];
      if (SOLID.has(ch) || SEMI.has(ch)) { footing = true; break; }
    }
  }
  return footing ? { band: Math.floor(feet / ROWS), feet } : null;
}

/**
 * Columns where a beanstalk runs straight across the seam between two bands.
 * A vine is two-way — up grabs, down grabs in mid-air — so one crossing is both
 * a way in and a way out.
 */
function vineCrossings(rows, w, bandCount) {
  const seams = [];
  for (let b = 0; b + 1 < bandCount; b++) {
    const last = (b + 1) * ROWS - 1;
    for (let x = 0; x < w; x++) {
      if (rows[last][x] === VINE && rows[last + 1][x] === VINE) seams.push({ x, upper: b });
    }
  }
  return seams;
}

/**
 * The air of one band, flooded from where the player arrives. Four-connected
 * through anything that is not rock and not lava.
 *
 * This is an over-approximation of where the player can get to and is meant to
 * be: it ignores gravity, so it can miss a trap, but it never invents one —
 * rock really does stop a body, so an exit outside this set is genuinely
 * unreachable from the arrival.
 */
function airFrom(band, w, seeds) {
  const open = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= ROWS) return false;
    const ch = band[y][x];
    return !SOLID.has(ch) && !DEADLY.has(ch);
  };
  const seen = new Set();
  const stack = [];
  const push = (x, y) => {
    const k = y * w + x;
    if (!open(x, y) || seen.has(k)) return;
    seen.add(k);
    stack.push([x, y]);
  };
  for (const [x, y] of seeds) push(x, y);
  while (stack.length) {
    const [x, y] = stack.pop();
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  return seen;
}

/**
 * Bonus-only. A band the player can get into must be a band the player can get
 * out of, and the room has to be worth having a way into.
 *
 * Structurally, in terms the grid can express:
 *   - **a way in** — a warp from another band that lands here legally at the
 *     smallest size, or a beanstalk crossing this band's seam.
 *   - **a way out** — from the air the arrival puts you in: a warp mouth whose
 *     warp is legal at the *tallest* size, the same beanstalk, or, for a band
 *     above the route, an open column at the band's bottom edge to walk off
 *     into. (Walking off the bottom of the *cave* band is not a way out, it is
 *     the bottom of the level.)
 *   - **clearance along the way** — the arrival's body box and the exit's body
 *     box are both checked, and the floor between the two is measured against
 *     the jump budget.
 */
function checkBonusBand(rows, w, band, b, routeIndex, mouths, seams, reach, problems, label) {
  const where = ` in the ${label}`;
  const arrivals = [];
  const seeds = [];

  for (const m of mouths) {
    if (Math.floor(standRow(m) / ROWS) === b) continue;
    const landing = warpLands(rows, w, m, SMALL_HEAD);
    if (!landing || landing.band !== b) continue;
    const fy = landing.feet - b * ROWS;
    arrivals.push({ x0: m.x0, x1: m.x1 });
    /* Seeded at the smallest body, to match the size the way in was tested
     * at. A taller box would poke through a low ceiling and let the flood
     * fill out of the very room it is supposed to be measuring. */
    for (let y = Math.max(0, fy - SMALL_HEAD); y <= Math.min(ROWS - 1, fy); y++) {
      for (let x = m.x0; x <= m.x1; x++) seeds.push([x, y]);
    }
  }
  for (const s of seams) {
    if (s.upper !== b && s.upper + 1 !== b) continue;
    for (let y = 0; y < ROWS; y++) if (band[y][s.x] === VINE) seeds.push([s.x, y]);
    arrivals.push({ x0: s.x, x1: s.x, vine: true });
  }

  if (!arrivals.length) {
    problems.push(`nothing leads into the ${label}`);
    return;
  }

  const air = airFrom(band, w, seeds);
  const inAir = (x, y) => air.has(y * w + x);

  /* A warp counts as a way out when the tallest body can be in the place it is
   * entered from, and the journey itself is legal for that body.
   *
   * "The place it is entered from" is the one thing that differs by direction,
   * and it is the direction rule again: a floor pipe is entered from the air
   * directly *above* it, a ceiling pipe from the HEAD rows of air *below* it
   * with something under them to stand on. Asking that of the flood fill is
   * what makes this a way out rather than a picture of one — the air has to be
   * air the arrival can actually reach. */
  const exits = [];
  for (const m of mouths) {
    const feet = standRow(m);
    if (Math.floor(feet / ROWS) !== b) continue;
    const my = m.y - b * ROWS;
    const fy = feet - b * ROWS;
    let standable = false;
    if (m.dir > 0) {
      for (let x = m.x0; x <= m.x1; x++) if (my > 0 && inAir(x, my - 1)) standable = true;
    } else if (fy < ROWS) {
      /* Every row the body would fill has to be reachable air, and the row the
       * feet are on has to hold. Otherwise the mouth is a mouth hanging over a
       * pit, or over a floor too far below to reach it from. */
      standable = true;
      for (let y = my + 1; y < fy; y++) {
        let any = false;
        for (let x = m.x0; x <= m.x1; x++) if (inAir(x, y)) any = true;
        if (!any) standable = false;
      }
      let footing = false;
      for (let x = m.x0; x <= m.x1; x++) {
        const ch = band[fy][x];
        if (SOLID.has(ch) || SEMI.has(ch)) footing = true;
      }
      if (!footing) standable = false;
    }
    if (!standable) continue;
    const out = warpLands(rows, w, m, HEAD);
    if (out && out.band !== b) exits.push({ x0: m.x0, x1: m.x1 });
  }
  const vineOut = seams.some((s) => (s.upper === b || s.upper + 1 === b)
    && [...Array(ROWS).keys()].some((y) => band[y][s.x] === VINE && inAir(s.x, y)));
  /* Above the route, the way down can simply be to walk off the edge — but only
   * off an edge the arrival can reach, which is what the flood fill is for. */
  const fallOut = b < routeIndex
    && [...Array(w).keys()].some((x) => inAir(x, ROWS - 1));

  if (!exits.length && !vineOut && !fallOut) {
    problems.push(`no way out of the ${label} at the tallest size`);
    return;
  }

  /* The walk from the way in to the way out, as far as a grid can tell: the
   * band's own floor between the two columns, against the jump budget. Skipped
   * for a vine, whose way in and way out are the same column. */
  if (!exits.length) return;
  const at = reader(band, w);
  const floor = floorProfile(at, w);
  const said = new Set();
  for (const a of arrivals) {
    if (a.vine) continue;
    for (const e of exits) {
      const found = [];
      const from = Math.min(a.x0, e.x0);
      const to = Math.max(a.x1, e.x1);
      checkGaps(at, band, from, to, reach, found, `${where} between the way in and the way out`);
      checkWalls(floor, from, to, reach, found, `${where} between the way in and the way out`);
      // Two pipes into the same room would otherwise say the same thing twice.
      for (const p of found) if (!said.has(p)) { said.add(p); problems.push(p); }
    }
  }
}

/* -------------------------------- the rule ------------------------------- */

/**
 * @param {string[]} rows padded level rows
 * @param {{gapTiles:number, wallTiles:number}} budget measured jump budget
 * @returns {string[]} human-readable problems, empty when the level is sound
 */
export function validateLevel(rows, budget) {
  const reach = { gap: budget.gapTiles, wall: budget.wallTiles };
  const problems = [];
  const w = rows[0].length;

  /* Universal, and first because everything after it indexes a row by column:
   * on a ragged grid the rest would report nonsense on top of the one problem
   * that is actually there, so it is reported alone. */
  if (rows.some((r) => r.length !== w)) return ['ragged rows'];

  /*
   * Universal. Footing is a question about one tile and the tile under it, so
   * it is asked of the whole grid: an enemy hanging in mid-air is a mistake
   * wherever it is.
   */
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (!ENEMY.has(ch)) continue;
      // Hovering kinds, pipe dwellers, and the shell walkers (which spawn half
      // a tile high and drop in) have no footing to check. The player start is
      // likewise allowed to be in mid-air: the game drops them in.
      if ('ApfrkO'.includes(ch)) continue;
      const below = y + 1 >= rows.length ? ' ' : rows[y + 1][x];
      if (!SOLID.has(below)) problems.push(`${ch} at ${x},${y} is standing on nothing`);
    }
  }

  const bands = bandsOf(rows);
  let routeIndex = routeIndexOf(bands);
  if (routeIndex < 0) {
    if (bands.length > 1) {
      problems.push('tall level with no player start: cannot tell which band is the route');
      return problems;
    }
    routeIndex = 0;
  }

  /* One band is unnamed: the route is what a level normally is, so its problems
   * read the way they always did and only the hidden ones say where they are. */
  const bandName = (b) => (b === routeIndex ? 'route band' : b < routeIndex ? 'sky band' : 'cave band');
  const where = (b) => (b === routeIndex ? '' : ` in the ${bandName(b)}`);

  /* Universal, whole grid: a beanstalk is a beanstalk in any band. */
  checkVines(rows, w, problems);

  /* Universal, per band: headroom over the ground of whatever band it is. */
  for (let b = 0; b < bands.length; b++) {
    const at = reader(bands[b], w);
    checkHeadroom(at, floorProfile(at, w), 0, w - 1, problems, where(b));
  }

  /* Route-only: everything that means "get from the start to the flag". */
  {
    const route = bands[routeIndex];
    const at = reader(route, w);
    checkGaps(at, route, 0, w - 1, reach, problems, '');
    checkWalls(floorProfile(at, w), 0, w - 1, reach, problems, '');

    const quarter = Math.floor(w * 0.25);
    let earlyPower = false;
    for (let y = 0; y < route.length; y++) {
      for (let x = 0; x < quarter; x++) if (at(x, y) === '!') earlyPower = true;
    }
    if (!earlyPower) problems.push('no power-up in the first quarter');

    for (let y = 0; y < FLOOR; y++) {
      let run = 0;
      for (let x = 0; x <= w; x++) {
        if (at(x, y) === '-') { run++; continue; }
        if (run) {
          const from = x - run;
          const overGap = Array.from({ length: run }, (_, i) => from + i)
            .some((px) => !SOLID.has(at(px, FLOOR)) && !SOLID.has(at(px, FLOOR + 1)));
          const paid = !overGap && Array.from({ length: run + 2 }, (_, i) => from - 1 + i)
            .some((px) => [1, 2, 3, 4].some((up) => REWARD.has(at(px, y - up))));
          if (!overGap && !paid) problems.push(`platform at ${from},${y} leads to nothing`);
        }
        run = 0;
      }
    }
  }

  /* Bonus-only: the hidden bands. */
  if (bands.length > 1) {
    const mouths = warpMouths(rows, w);
    const seams = vineCrossings(rows, w, bands.length);
    for (let b = 0; b < bands.length; b++) {
      if (b === routeIndex || !hasContent(bands[b])) continue;
      checkBonusBand(rows, w, bands[b], b, routeIndex, mouths, seams, reach, problems, bandName(b));
    }
  }

  return problems;
}

export const RULE_CONSTANTS = { ROWS, FLOOR, HEAD };
