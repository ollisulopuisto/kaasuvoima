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
 *
 * See DESIGN.md section 5 for the reasoning behind each one.
 */

const ROWS = 15;
const FLOOR = 13;
const HEAD = 3;

/*
 * '%' is the crumbling platform. It counts as solid here on purpose: it holds
 * long enough to walk across, so a route over it is a real route. Leaving it
 * out would make the validator read every catwalk as a bottomless pit and
 * reject perfectly good levels.
 */
const SOLID = new Set(['#', 'X', 'B', '?', '!', 'u', 'N', '[', ']', '{', '}', '%', '(', ')']);
const ENEMY = new Set(['g', 'k', 'f', 'p', 'r', 'c', 'A', 'H', 'O']);
const REWARD = new Set(['o', '!', '?', 'N', 'B']);

/**
 * A tall level is three bands of ROWS stacked into one grid — sky, route, cave
 * — and only the middle one carries the promise. Read whole, the sky band is
 * one enormous bottomless pit and the cave is a room with no way in, so every
 * rule in here would fire on a level that is perfectly sound.
 *
 * Which band is the route is not a guess and not a position: it is the band the
 * player starts in. That is the same sentence as the promise itself — the route
 * from the start to the flag must work at the smallest size — so the validator
 * and the design rule cannot drift apart. A tall level with no start marker is
 * therefore a genuine error and not a case to guess around.
 *
 * @returns {string[]|null} the 15 rows of the route, or null when there is no
 *   telling which band that is
 */
function routeBand(rows) {
  if (rows.length <= ROWS) return rows;
  const start = rows.findIndex((row) => row.includes('1'));
  if (start < 0) return null;
  const top = Math.floor(start / ROWS) * ROWS;
  return rows.slice(top, top + ROWS);
}

/**
 * @param {string[]} rows padded level rows
 * @param {{gapTiles:number, wallTiles:number}} budget measured jump budget
 * @returns {string[]} human-readable problems, empty when the level is sound
 */
export function validateLevel(rows, budget) {
  const REACH = { gap: budget.gapTiles, wall: budget.wallTiles };
  const problems = [];
  const w = rows[0].length;

  if (rows.some((r) => r.length !== w)) problems.push('ragged rows');

  /*
   * Footing is a question about one tile and the tile under it, so it is asked
   * of the whole grid: an enemy hanging in mid-air is a mistake wherever it is.
   * Everything below this asks "where is the floor", which only means anything
   * inside one band.
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

  const route = routeBand(rows);
  if (!route) {
    problems.push('tall level with no player start: cannot tell which band is the route');
    return problems;
  }
  const at = (x, y) => (y < 0 || y >= route.length || x < 0 || x >= w ? ' ' : route[y][x]);

  // Floor profile: the top of the connected ground stack, so a floating block
  // row is never mistaken for terrain the player has to climb.
  const floor = [];
  for (let x = 0; x < w; x++) {
    if (!SOLID.has(at(x, FLOOR + 1)) && !SOLID.has(at(x, FLOOR))) { floor.push(null); continue; }
    let y = SOLID.has(at(x, FLOOR)) ? FLOOR : FLOOR + 1;
    while (y > 0 && SOLID.has(at(x, y - 1))) y--;
    floor.push(y);
  }

  let gap = 0;
  for (let x = 0; x < w; x++) {
    const bottomless = ![FLOOR, FLOOR + 1].some((y) => SOLID.has(at(x, y)))
      && at(x, FLOOR) !== 'W';
    if (bottomless) { gap++; continue; }
    if (gap > REACH.gap) {
      const from = x - gap;
      const hasStone = route.slice(0, FLOOR).some((row) => row.slice(from, x).includes('-'));
      if (!hasStone) problems.push(`gap of ${gap} at column ${from} with no stepping stone`);
    }
    gap = 0;
  }

  for (let x = 1; x < w; x++) {
    if (floor[x] === null || floor[x - 1] === null) continue;
    const rise = floor[x - 1] - floor[x];
    if (rise > REACH.wall) problems.push(`wall of ${rise} at column ${x}`);
  }

  for (let x = 0; x < w; x++) {
    if (floor[x] === null || floor[x] > FLOOR) continue;
    for (let y = floor[x] - HEAD; y < floor[x]; y++) {
      if (SOLID.has(at(x, y))) { problems.push(`no headroom at column ${x}`); break; }
    }
  }

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

  return problems;
}

export const RULE_CONSTANTS = { ROWS, FLOOR, HEAD };
