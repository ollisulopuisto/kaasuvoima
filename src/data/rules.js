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
 * ## Two axes, and only one of them is the default
 *
 * Everything in the next section is about a level you cross left to right. A
 * level marked `vertical` is a **climb**: one screen wide, many screens tall,
 * the exit at the top (or, for a level that digs, at the bottom), and falling
 * a setback rather than a death. `validateLevel(rows, budget, { vertical:
 * true })` asks a different set of questions on the same grid — see the
 * "climbs" section below for which rules survive the change of axis, which are
 * replaced, and which are dropped and why. The flag is off by default and no
 * level in the game sets it, so nothing here changed for the levels that
 * exist: their output is compared byte for byte against the run before.
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
 *
 * ## The one place this reads a level the player never sees
 *
 * A beanstalk is not standing in the level when it loads: a `?` block on its
 * bump row grows it. The rows below are still the **grown** level — the vine is
 * written whole in `chunks/secrets.js` and lifted out of the live grid by
 * `LevelScene.plantVines` — and that is deliberate, because a validator handed
 * the ungrown grid would find no vine, no seam crossing, and would therefore
 * stop proving that the sky band can be reached at all. It would not fail; it
 * would go quiet, which is worse.
 *
 * The price of reading the grown level is that the growing has to be
 * guaranteed rather than assumed, and that is what `checkBeanBlocks` is for.
 * With it, the two halves of the claim are both checked: the vine reaches
 * (`vineCrossings`, `checkVines`) and the vine happens (`checkBeanBlocks`).
 *
 * What is **not** checked, said plainly rather than left to be discovered: the
 * bean block itself is a solid tile that only exists at run time, so no rule
 * here has looked at it. It is bounded rather than trusted — it stands in a
 * cell the level data says is vine, and `checkVines` has already proved that
 * cell and both its neighbours are clear of rock at the tallest size, which is
 * a stronger statement than anything the headroom rule would have made about a
 * lone floating block.
 */

const ROWS = 15;
const FLOOR = 13;
/**
 * How wide a vertical level is, and it is not a maximum: it is the width.
 *
 * `VIEW_W` is 320 and `TILE` is 16, so one screen is 20 columns exactly. A
 * climb is locked sideways — the camera's horizontal clamp is `widthPx -
 * VIEW_W`, which is zero here, so `cam.x` is 0 for the whole level and the
 * dead zone and the look-ahead have nothing to do. Twenty-one columns would
 * quietly turn that off and give the climb a scrolling horizontal camera as
 * well, which is the one thing the shape is meant not to have; nineteen would
 * letterbox the level sideways with no code anywhere to draw the bars.
 *
 * Duplicated from `src/scenes/level.js` in the same idiom as
 * `BEAN_BLOCK_OVER_FLOOR` — the validator may not import a scene — and
 * `verify.mjs` asserts the two agree.
 */
const VERTICAL_COLS = 20;

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
const SOLID = new Set(['#', 'X', 'B', '?', '!', '*', 'u', 'N', '[', ']', '{', '}', '%', '(', ')', 'S', 'C', 'I']);
const SEMI = new Set(['-']);
/*
 * MÖYKKY, se yksi laatta joka tottelee painovoimaa (`T.LUMP`, `src/gfx/tiles.js`).
 *
 * Se on `SOLID`issa koska se **on** kiinteä lähtötilassa, ja lähtötila on se
 * jota jokainen tämän tiedoston sääntö mittaa: kuilu jonka päällä möykky on ei
 * ole kuilu, ja pää joka ei mahdu sen alle ei mahdu. Se on samalla ainoa
 * `SOLID`in jäsen joka voi liikkua, ja siksi se on myös oma joukkonsa —
 * `checkFalling` kysyy siltä kolme asiaa joita muilta ei kysytä.
 */
const FALLING = new Set(['C']);
const ENEMY = new Set(['g', 'k', 'f', 'p', 'r', 'c', 'A', 'H', 'O']);
const REWARD = new Set(['o', '!', '?', 'N', 'B']);
/* The two halves of a warp pipe's mouth. `{}` below them is ordinary pipe. */
const WARP = new Set(['(', ')']);
const VINE = 'v';
/**
 * How far above its floor the engine hangs a beanstalk's bean block, in tiles.
 *
 * **This is a copy of `BEAN_BLOCK_OVER_FLOOR` in `src/scenes/level.js`**, in the
 * same idiom as the two copies of the secret-brick rates: the validator may not
 * import a scene, the engine may not import the validator, and one number in
 * two files is cheaper than an import that ties them together. `verify.mjs`
 * asserts that the two copies agree, which is the part that makes it safe.
 *
 * Four is the bump row — three clear rows over the floor, so the tallest body
 * stands under it and every body can put its head into it.
 */
const BEAN_BLOCK_OVER_FLOOR = 4;
/*
 * Not solid, and not somewhere you travel through either. Lava is what
 * `assembleTall` lids a bottomless column with, so treating it as air would
 * quietly connect a cave room to the pit above it and call falling to your
 * death a way out.
 */
const DEADLY = new Set(['W']);
/*
 * JUOKSUHIEKKA, and it is deliberately a third category rather than a member of
 * either of the two above. Getting this wrong is the trap ROADMAP names, so the
 * reasoning belongs next to the set and not in a commit message.
 *
 * **Not `SOLID`.** `SOLID` is what a body cannot pass through, and it is what
 * every rule in this file measures against: the floor profile, headroom, wall
 * height, the warp landing box, the flood fill. Sand is passable — you go into
 * it, you sink through it, you climb out of it — so calling it solid would make
 * the validator claim a ceiling where there is none, and, much worse, would put
 * the *surface* of a pool into the floor profile. A pool painted over a
 * bottomless column would then read as ordinary ground and pass silently, which
 * is the single most expensive way this could be got wrong.
 *
 * **Not `DEADLY` either.** `DEADLY` exists to stop the flood fill travelling
 * through the lava lid that `assembleTall` puts over a bottomless column, i.e.
 * to stop "falling to your death" being reported as a way out of a room. You
 * genuinely can travel through quicksand — slowly, and you have seconds to do
 * it — so treating it as a wall for the flood fill would invent a trap, which
 * that fill is explicitly built never to do.
 *
 * So it is its own set, with its own rule (`checkQuicksand`) and one line in
 * `checkGaps`. **Kept character for character identical with the copy in
 * `src/data/generator.js`**, the same way `SOLID` is, and `verify.mjs` compares
 * the two lines as strings — a copy nobody checks is a copy that has already
 * drifted.
 */
const SINK = new Set(['~']);
/*
 * JÄÄ (`T.ICE`, `src/gfx/tiles.js`). `SOLID`in jäsen, koska se **on** tavallinen
 * kiinteä laatta: sen päällä seistään, sen läpi ei mennä, ja se kelpaa
 * lattiaksi, askelmaksi ja katoksi kuten mikä tahansa kivi. Ainoa mitä se tekee
 * eri tavalla on se mitä *sen päällä oleva keho* pystyy tekemään, eikä yksikään
 * tämän tiedoston sääntö mittaa sitä — ne mittaavat muotoa. Siksi jää on
 * `SOLID`issa eikä omassa joukossaan juoksuhiekan tapaan, ja siksi sillä on
 * silti oma sääntönsä (`checkIce`): tasan yksi asetelma jonka muut sivuuttavat.
 */
const ICE = new Set(['I']);
/**
 * Kuinka monta saraketta jäistä jalansijaa tarvitaan pysähtymiseen, laattoina.
 *
 * Mitattu eikä valittu: `tools/measure-braking.mjs` ajaa pelaajan jäärunwaylla
 * ja vastaan kääntyminen pysäyttää voimatasolla 0 juoksuvauhdista 40 pikselissä
 * ja P-nopeudesta 68:ssa. 68 px on 4,25 laattaa, ylöspäin viisi. P-nopeuden luku
 * eikä juoksun, koska lautalle voi saapua kummalla tahansa vauhdilla.
 */
const ICE_BRAKE = 5;

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
 * place, so it is unreachable at that size rather than sealed. The block row in
 * `tomb_cave` is exactly that shape, verified by hand, and a rule that fired on
 * it would be switched off within the week and then it would protect nothing.
 * (`fort_blocks` was the other example and the one this paragraph was written
 * for; se poistettiin 10.8.2026 kuolleena palikkana, eli sen kuusi kohtaa
 * ratkesivat poistamalla eivätkä myöntämällä.)
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

/**
 * Universal. What a quicksand pool has to be, in the two ways a grid can say it.
 *
 * The hazard is a clock and not a touch: you sink slowly and you have seconds
 * to get out (see the constants in `entities/player.js`). That is what makes
 * *placement* the whole design problem rather than a detail — with a window to
 * react, the sand in the open is a scare and the sand at the bottom of a shaft
 * is a death sentence, and the difference between the two is geometry this file
 * can read.
 *
 * So, two rules, and each one is a way the tile stops being what it claims:
 *
 *   - **a pool has a bottom.** Sand painted over a bottomless column is a pit
 *     wearing a costume: nothing stops the sinking, the several seconds are
 *     spent falling out of the level, and the promise the tile makes is a lie.
 *     It is also the exact shape that `checkGaps` would otherwise have blessed
 *     — which is why this is reported here by name rather than left to come out
 *     as a gap of three, or, if `~` had been put in `SOLID`, as nothing at all.
 *   - **a pool has a rim.** Escaping is rising to the surface and stepping out
 *     sideways, so there has to be somewhere to step. Measured against the same
 *     jump budget everything else here uses: a flank whose floor is more than
 *     `wall` tiles above the sand's surface is a wall, and a pool between two
 *     walls is a hole you are given several seconds to fail to leave. One
 *     usable side is enough — you can always wade back the way you came.
 *
 * What this cannot say, stated rather than left to be found: it does not know
 * how *deep* a pool has to be before it can drown anybody (that is the body's
 * height against the pool's, and it is asserted in `verify.mjs` against the
 * engine), and it does not know whether the rim is somewhere you would want to
 * land. Grid geometry, as everywhere else in this file.
 */
function checkQuicksand(band, w, reach, problems, where) {
  const at = reader(band, w);
  const cols = [];
  for (let x = 0; x < w; x++) {
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < band.length; y++) {
      if (!SINK.has(at(x, y))) continue;
      if (top < 0) top = y;
      bottom = y;
    }
    cols.push(top < 0 ? null : { top, bottom });
  }
  if (!cols.some(Boolean)) return;

  for (let x = 0; x < w; x++) {
    if (!cols[x]) continue;
    const under = at(x, cols[x].bottom + 1);
    if (!SOLID.has(under)) {
      problems.push(`quicksand at column ${x}${where} ends at row ${cols[x].bottom}`
        + ` over "${under}" instead of a floor: that is a pit with sand painted on it`);
    }
  }

  const floor = floorProfile(at, w);
  for (let x = 0; x < w; x++) {
    if (!cols[x] || (x > 0 && cols[x - 1])) continue;
    let end = x;
    while (end + 1 < w && cols[end + 1]) end++;
    let surface = cols[x].top;
    for (let c = x; c <= end; c++) surface = Math.min(surface, cols[c].top);
    const sides = [x - 1, end + 1].filter((s) => s >= 0 && s < w);
    const usable = sides.some((s) => floor[s] !== null && floor[s] >= surface - reach.wall);
    if (!usable) {
      problems.push(`quicksand at columns ${x}-${end}${where} has no rim within`
        + ` ${reach.wall} tiles of its surface at row ${surface}: nothing to climb out onto`);
    }
  }
}

/** Route-only. Every bottomless run fits the measured jump or has a stone. */
function checkGaps(at, band, from, to, reach, problems, where) {
  let gap = 0;
  for (let x = from; x <= to; x++) {
    /* Neither lava nor quicksand is a bottomless run, and they are excluded for
     * two different reasons that happen to want the same line. Lava is a lid
     * the engine puts on a pit — the column is death, but it is not a jump you
     * are being asked to clear. Quicksand is the opposite: it is footing of a
     * kind, you rise to its surface and wade, so a pool wider than the jump
     * budget is a slog and not an impossibility, and demanding a stepping stone
     * over one would be the validator inventing a requirement. What quicksand
     * *does* have to satisfy is `checkQuicksand` below — it needs a bottom and
     * a rim — and that is the check this exemption is paid for by. */
    const bottomless = ![FLOOR, FLOOR + 1].some((y) => SOLID.has(at(x, y)))
      && at(x, FLOOR) !== 'W'
      && ![FLOOR, FLOOR + 1].some((y) => SINK.has(at(x, y)));
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

/**
 * Universal. Footing is a question about one tile and the tile under it, so it
 * is asked of the whole grid: an enemy hanging in mid-air is a mistake wherever
 * it is, and "wherever" now includes a climb. Lifted out of `validateLevel`
 * unchanged so that both shapes of level ask it in the same words — the message
 * is compared against shipped output, so the wording is load-bearing.
 */
function checkEnemyFooting(rows, w, problems) {
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
}

/* --------------------------------- climbs -------------------------------- */

/**
 * UP IS A DIRECTION, AND EVERY RULE ABOVE THIS LINE IS ABOUT THE OTHER ONE.
 *
 * `floorProfile`, `checkGaps` and `checkWalls` all read row 13 and ask what
 * happens as `x` increases. On a level that is 20 columns wide and forty rows
 * tall they do not degrade, they invert: the whole level is one gap, the floor
 * profile is the topmost platform in each column and the "walls" are the climb
 * itself. So a climb gets its own reachability, and the honest meaning of
 * reachable upward is **the measured jump**, not a spacing somebody liked.
 *
 * ## What one jump carries when it also has to rise
 *
 * `tools/jump-budget.json` measures two numbers off the running-held jump and
 * the generator has used both for as long as it has existed: `gapTiles` = 6,
 * how far it carries across flat ground, and `wallTiles` = 4, how far it
 * rises. Those are the two ENDS of the same arc, and a climb needs the middle:
 * how far sideways can a jump that must also gain three tiles carry?
 *
 * The two ends are measured. The line between them is the cheapest assumption
 * that respects them — one arc, so what it spends on height it cannot spend on
 * distance — and it is stated here rather than buried because it is the one
 * thing in this file that is neither measured nor grid geometry:
 *
 *     carry(rise) = floor(gapTiles × (wallTiles + 1 − rise) / (wallTiles + 1))
 *
 *     rise 0 → 6 tiles   rise 1 → 4   rise 2 → 3   rise 3 → 2   rise 4 → 1
 *
 * A real arc is concave — you can go a long way while still clearing a modest
 * height — so a straight line **under-promises in the middle**, and that is
 * the safe direction for a rule whose job is to refuse impossible levels: it
 * will reject a climb that a good player could just about make, and it will
 * never bless one that nobody can. If it ever turns out to reject real content,
 * the fix is to measure the arc in `measure-jump.mjs` and read the table from
 * there, not to widen the line by feel.
 *
 * Rise 0 is in the table because a climb has sideways hops too, and at rise 0
 * the formula returns `gapTiles` unchanged — the same number `checkGaps` uses,
 * which is how you can tell the two rules are the same rule seen from two
 * directions rather than two opinions.
 */
function climbCarry(reach) {
  const span = reach.wall + 1;
  return (rise) => Math.max(0, Math.floor((reach.gap * (span - rise)) / span));
}

/**
 * Every surface a body can stand on, as maximal horizontal runs.
 *
 * A cell is a standing surface when it is footing and the cell above it is not
 * rock. Planks count as footing — they are solid from above, which is the only
 * direction anybody lands from — and a plank *above* a surface does not cover
 * it, because you pass up through one. That asymmetry is the whole reason a
 * climb can be built out of them.
 */
/**
 * Universal. **Kolme ehtoa jotka pitävät putoavan laatan rajan sisällä.**
 *
 * ROADMAP 10.8.2026 sallii maaston liikkua vain silloin kun liike ei voi
 * poistaa reittiä. Möykky palaa kotiruutuunsa, mikä hoitaa puolet; toinen
 * puoli on se ettei sitä saa sijoittaa paikkaan jossa sen lähtö tai sen paluu
 * tarkoittaisi jotain. Nämä ovat portteja eivätkä ohjeita, koska laatta jota
 * ei ole vielä yhdessäkään kentässä on täsmälleen se laatta jonka säännöt
 * unohtuvat ensimmäisen sijoituksen kohdalla.
 *
 *   1. **Se ei roiku.** Alla on kiinteä ruutu lähtötilassa. Muuten kenttä
 *      muokkaa itseään ensimmäisellä framella, ja `playable.mjs`,
 *      `validateLevel` ja `difficulty.mjs` mittaisivat kaikki kolme kenttää
 *      jota kukaan ei pelaa.
 *   2. **Sen tuki ei ole mureneva lauta.** Lauta on ainoa ruutu jonka
 *      *vihollinen* voi poistaa (laki 2), ja reiluussääntö sanoo että vain
 *      pelaajan aloittama ketju saa satuttaa häntä. Kaikki muut tuen
 *      poistajat — päänpuski, potkaistu kuori, kytkin — ovat pelaajan tekoja,
 *      joten tämä yksi kielto tekee säännöstä rakenteellisen eikä
 *      muistettavan: ruudun ulkopuolista kirjanpitoa ei tarvita.
 *   3. **Sen päällä ei ole mitään.** Ei kolikkoa, ei lohkoa, ei lavaa, ei
 *      vihollista. Palkinto laatan päällä on syy seistä sillä, ja reitti joka
 *      voi kadota on täsmälleen se asia jota tämä koko raja on vastaan.
 */
function checkFalling(rows, w, problems) {
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < w; x++) {
      if (!FALLING.has(rows[y][x])) continue;
      const below = y + 1 < rows.length ? rows[y + 1][x] : '#';
      if (!SOLID.has(below)) {
        problems.push(`falling tile at ${x},${y} has "${below}" under it: it would drop on the`
          + ' first frame, and every gate measures the level as it starts');
      } else if (below === '%') {
        problems.push(`falling tile at ${x},${y} rests on a crumbling plank: an enemy could drop`
          + ' it, and only a chain the player started may hurt him');
      }
      const above = y > 0 ? rows[y - 1][x] : ' ';
      if (above !== ' ') {
        problems.push(`falling tile at ${x},${y} has "${above}" on top of it: nothing may stand`
          + ' on a tile that can leave, or the route can leave with it');
      }
    }
  }
}

/**
 * JÄÄ, ja **vain se yksi asetelma jota mikään muu sääntö ei näe.**
 *
 * Mittaus ensin, koska se rajaa säännön eikä toisin päin. `measure-braking.mjs`
 * ajaa pelaajan jäärunwaylla: vastaan kääntyminen pysäyttää voimatasolla 0
 * juoksuvauhdista 40 pikselissä ja P-nopeudesta 68:ssa, ja eteen näkyy
 * juostessa ~176 px (PHYSICS.md). Pahin *tahallinen* pysähdys on siis 39 %
 * siitä mitä ehtii nähdä. **Jäällä ei ole vaaraa jota ei ehtisi väistää** —
 * kunhan on jotain minkä päällä jarruttaa.
 *
 * Siksi tämä ei ole reunasääntö juoksuhiekan tapaan, ja se on kielto eikä
 * unohdus. Reunasääntö olisi keksitty vaatimus kahdesta syystä: tavallista maata
 * pitkin jäälle saapuva pelaaja voi jarruttaa jo ennen jäätä, ja jään jälkeen
 * tuleva kuoppa on hypättävissä kuten mikä tahansa kuoppa — `checkGaps` mittaa
 * sen, eikä jää muuta kiihdytystä (ks. `SURFACES`in `grip`), joten vauhdinotto
 * on täsmälleen se jolla kuilu on mitoitettu.
 *
 * Se mitä jäljelle jää on **ilmasta saapuminen**. Kelluva lautta kuilun päällä
 * on ainoa paikka jossa pelaaja ei voi jarruttaa ennen jäätä: hän tulee sille
 * kaaressa, laskeutuu sillä vauhdilla jonka hyppy vaati, ja jos lautta on
 * lyhyempi kuin jarrutusmatka, hän liukuu sen yli. Mikään muu sääntö ei näe
 * sitä — `checkGaps` on tyytyväinen, koska kuilu on hypättävissä molemmilta
 * puolilta, ja juuri se hyppy on se joka tappaa.
 *
 * Saari on tässä *jalansijan* maksimaalinen jakso yhdellä rivillä, ei jään:
 * `IIII##` on kuuden laatan saari eikä neljän, koska ne kaksi kiveä ovat
 * jarrutusmatkaa siinä missä jääkin — ja parempaa. Kentän reuna ei avaa saarta
 * kummallakaan puolella, koska reuna on seinä (`moveX`) eikä sen yli liu'uta.
 *
 * **Sääntö on hitusen liian tiukka ja se on tiedossa:** saari jossa on yksi
 * jäälaatta viiden kiven joukossa mitataan samalla mitalla kuin läpijäinen.
 * Erottaminen vaatisi simuloinnin — jarrutusmatka riippuu siitä missä kohtaa
 * saarta jää on — ja hinta väärään suuntaan on kaksi laattaa suunnittelijalle,
 * kun taas väärään suuntaan toisin päin se on henki.
 */
function checkIce(rows, w, problems) {
  const footing = (x, y) => SOLID.has(rows[y][x]) || SEMI.has(rows[y][x]);
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < w; x++) {
      if (!footing(x, y)) continue;
      let end = x;
      while (end + 1 < w && footing(end + 1, y)) end++;
      const open = (a) => a >= 0 && a < w && !footing(a, y);
      const island = open(x - 1) && open(end + 1);
      let ice = false;
      for (let i = x; i <= end; i++) if (ICE.has(rows[y][i])) ice = true;
      const width = end - x + 1;
      if (island && ice && width < ICE_BRAKE) {
        problems.push(`ice island at ${x},${y} is ${width} wide: a body landing on it at speed`
          + ` needs ${ICE_BRAKE} tiles to stop, and there is nothing either side to stop on`);
      }
      x = end;
    }
  }
}

export function platformsOf(rows, w) {
  const h = rows.length;
  const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w ? ' ' : rows[y][x]);
  const out = [];
  for (let y = 0; y < h; y++) {
    let from = -1;
    for (let x = 0; x <= w; x++) {
      const ch = at(x, y);
      const stands = x < w && (SOLID.has(ch) || SEMI.has(ch)) && !SOLID.has(at(x, y - 1));
      if (stands) { if (from < 0) from = x; continue; }
      if (from >= 0) out.push({ y, x0: from, x1: x - 1, i: out.length });
      from = -1;
    }
  }
  return out;
}

/** Columns strictly between two platforms; 0 when they overlap or touch. */
function sideways(a, b) {
  if (b.x0 > a.x1) return b.x0 - a.x1 - 1;
  if (a.x0 > b.x1) return a.x0 - b.x1 - 1;
  return 0;
}

/**
 * The climb as a graph: which platform you can get to from which, and how.
 *
 * Exported because the validator and the bot in `tools/playable.mjs` must not
 * hold two opinions about what is reachable. A bot that could climb something
 * the rules call impossible would make the rules a formality; a bot that could
 * not climb what the rules bless would fail sound levels. One graph, two
 * readers — the same argument `rules.js` makes for the generator and the test
 * suite in its first paragraph.
 *
 * Upward edges are the measured jump (see `climbCarry`), and they check that
 * the landing column is actually open between the two platforms: a shelf under
 * a stone ceiling is within reach of the jump and is still not somewhere you
 * can arrive. Planks in the way are fine, because you pass up through them.
 *
 * Downward edges are free within `gapTiles`, and that is the shape of the
 * level rather than generosity: a fall in a climb is a setback and not a
 * death, gravity needs no budget, and drifting sideways while falling carries
 * at least as far as a flat jump does.
 */
export function climbGraph(rows, budget) {
  const reach = { gap: budget.gapTiles, wall: budget.wallTiles };
  const w = rows[0].length;
  const carry = climbCarry(reach);
  const platforms = platformsOf(rows, w);
  const at = (x, y) => (y < 0 || y >= rows.length || x < 0 || x >= w ? ' ' : rows[y][x]);
  const open = (b, a) => {
    /* The column you come up through: the end of the landing platform nearest
     * the one you left, which is where a climber actually aims. */
    const x = a.x1 < b.x0 ? b.x0 : a.x0 > b.x1 ? b.x1 : Math.max(b.x0, Math.min(b.x1, a.x0));
    for (let y = b.y + 1; y < a.y; y++) if (SOLID.has(at(x, y))) return false;
    return true;
  };
  const edges = platforms.map(() => []);
  for (const a of platforms) {
    for (const b of platforms) {
      if (a === b) continue;
      const gap = sideways(a, b);
      if (b.y < a.y) {
        const rise = a.y - b.y;
        if (rise <= reach.wall && gap <= carry(rise) && open(b, a)) edges[a.i].push(b.i);
      } else if (gap <= reach.gap) edges[a.i].push(b.i);
    }
  }
  return { platforms, edges, carry, reach };
}

/** Platforms reachable from a seed, following `edges`. */
function flood(edges, seeds) {
  const seen = new Set(seeds);
  const stack = [...seeds];
  while (stack.length) for (const n of edges[stack.pop()]) if (!seen.has(n)) { seen.add(n); stack.push(n); }
  return seen;
}

/** The platform a body dropped at `x,y` comes to rest on, or null. */
function landsOn(graph, x, y) {
  let best = null;
  for (const p of graph.platforms) {
    if (p.y < y || x < p.x0 || x > p.x1) continue;
    if (!best || p.y < best.y) best = p;
  }
  return best;
}

/**
 * KUINKA LEVEÄ REIÄN ON OLTAVA, JA MIKSI SE EI OLE YKSI.
 *
 * Kaksi laattaa, ja luku tulee `PLAYER_SIZES`ista eikä mausta: pienin keho on
 * 12 px leveä ja **suurin 21**. Yhden laatan aukko on 16 px, eli se päästää
 * läpi voimatasot 0–2 ja pysäyttää tasot 3–5. Kyykistyminen ei auta, koska se
 * madaltaa eikä kavenna.
 *
 * Se on pahempi vika kuin miltä kuulostaa, ja pahempi kuin liian vaikea kohta:
 * pelaaja ei voi kutistua omasta tahdostaan, joten isona saapuminen on ansa
 * josta ei pääse takaisin. **Ja jokainen tämän tiedoston ja `playable.mjs`:n
 * portti mittaa voimatasoa 0**, eli tasan sitä kokoa joka mahtuu — mikä on syy
 * siihen ettei tätä huomannut mikään ennen kuin joku pelasi kentän isona.
 *
 * Kopio `PLAYER_SIZES`ista samassa hengessä kuin `BEAN_BLOCK_OVER_FLOOR`:
 * validaattori ei saa importoida piirtoa, ja `verify.mjs` vertaa lukuja.
 */
const WIDEST_BODY_TILES = 2;

/**
 * Universal pystykentille: **jokaisesta rivistä on päästävä läpi isonakin.**
 *
 * Rivi jossa on jalansijaa on rivi joka jakaa kentän ylä- ja alapuoleen, ja
 * aukot siinä ovat ne paikat joista kuljetaan. Jos rivin jokainen aukko on
 * kapeampi kuin `WIDEST_BODY_TILES`, rivi on läpäisemätön suurimmalle keholle
 * ja kenttä loppuu siihen.
 *
 * Rivit joissa ei ole yhtään aukkoa jätetään rauhaan, ja se on rajaus eikä
 * unohdus: umpinainen rivi on joko kentän pohja (6-K:n alin rivi) tai
 * saavuttamattomuus, ja jälkimmäisen huomaa `checkClimb`in kulkukelpoisuus
 * paremmin kuin tämä. Tämä sääntö vastaa täsmälleen yhteen kysymykseen —
 * *mahtuuko siitä* — eikä esitä sitä kysymystä paikoista joissa ei ole reikää.
 */
function checkClimbWidth(rows, w, problems) {
  const footing = (x, y) => SOLID.has(rows[y][x]) || SEMI.has(rows[y][x]);
  for (let y = 0; y < rows.length; y++) {
    let any = false;
    let widest = 0;
    let run = 0;
    for (let x = 0; x < w; x++) {
      if (footing(x, y)) { any = true; run = 0; continue; }
      run++;
      if (run > widest) widest = run;
    }
    if (!any || widest === 0) continue;
    if (widest < WIDEST_BODY_TILES) {
      problems.push(`row ${y} is only passable through a ${widest}-tile gap: the widest body`
        + ` is ${WIDEST_BODY_TILES} tiles, so a player who arrives big is stuck here`);
    }
  }
}

/**
 * Universal pystykentille: **kulkeminen sivusuunnassa on pakollista.**
 *
 * Tämä on se sääntö jota ei ollut, ja sen puuttuminen näkyi molemmissa pelin
 * pystykentissä yhtä aikaa — vastakkaisina vikoina, mikä on juuri se syy miksi
 * yksi sääntö kattaa molemmat:
 *
 *   - **6-K meni alas.** Sarake 3 oli auki riviltä 5 riville 43 ja maali oli
 *     sen pohjalla. Kävele vasemmalle, pidä alas, olet perillä.
 *   - **7-T meni ylös.** Lankut olivat `########---` ja `---########`, ja ne
 *     menivät päällekkäin sarakkeissa 9–10 — eli oli sarake jolla oli
 *     jalansija joka ikisellä tasolla. Hyppää paikallasi, olet perillä.
 *
 * `checkClimb` on tyytyväinen kumpaankin, ja aivan oikein: se todistaa että
 * reitti on **olemassa**, ei että se on ainoa. Tämä todistaa toisen puolen.
 *
 * Suunta luetaan maalista eikä nimestä, koska kumpikin kysymys on toisen
 * peilikuva: laskeutuvalta kentältä kielletään **vapaa sarake** (ei jalansijaa
 * lainkaan koko matkalla), nousevalta **tikapuusarake** (jalansija joka
 * askelmalla, ja askelmat mitatun hypyn sisällä). Molemmissa vika on sama
 * lause: kenttä on ratkaistavissa liikkumatta sivuun.
 */
function checkClimbTraverse(rows, w, budget, problems) {
  const h = rows.length;
  const footing = (x, y) => (y >= 0 && y < h && SOLID.has(rows[y][x])) || (y >= 0 && y < h && SEMI.has(rows[y][x]));
  const find = (ch) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rows[y][x] === ch) return { x, y };
    return null;
  };
  const start = find('1');
  const goal = find('F');
  if (!start || !goal) return;
  const top = Math.min(start.y, goal.y);
  const bottom = Math.max(start.y, goal.y);

  if (goal.y > start.y) {
    // Laskeutuva kenttä: sarake jossa ei ole mitään pysäyttämässä.
    for (let x = 0; x < w; x++) {
      let clear = true;
      for (let y = top; y <= bottom && clear; y++) if (footing(x, y)) clear = false;
      if (clear) {
        problems.push(`column ${x} is open the whole way from the start at row ${start.y} to the`
          + ` goal at row ${goal.y}: the climb is solved by holding one direction and falling`);
        return;
      }
    }
    return;
  }

  // Nouseva kenttä: sarake jonka varassa pääsee ylös pysähtymättä sivuun.
  for (let x = 0; x < w; x++) {
    const rungs = [];
    for (let y = bottom; y >= top; y--) if (footing(x, y) && !footing(x, y - 1)) rungs.push(y);
    if (rungs.length < 2) continue;
    let ladder = rungs[0] >= bottom - budget.wallTiles;
    for (let i = 1; i < rungs.length && ladder; i++) {
      if (rungs[i - 1] - rungs[i] > budget.wallTiles) ladder = false;
    }
    if (ladder && rungs[rungs.length - 1] <= top + budget.wallTiles) {
      problems.push(`column ${x} has footing at every rung from row ${rungs[0]} to row`
        + ` ${rungs[rungs.length - 1]}: the climb is solved by jumping in place`);
      return;
    }
  }
}

/**
 * Route-only, and the vertical half of "the route works at the smallest size".
 *
 * Three questions, and each is the climb's version of one the horizontal rules
 * already ask:
 *
 *   - **the climb connects.** `checkGaps` asks whether every hole fits the
 *     jump; this asks whether every step of the ladder does, which on this
 *     axis is a reachability question rather than a per-hole one, because a
 *     climb has branches and a floor does not. Reported as the step that
 *     breaks it, with the two numbers that decide it.
 *   - **the level catches you.** Falling is not fatal in a climb — that is the
 *     shape's whole promise, the thing that makes it forgiving enough to be
 *     tall — so a column with nothing under it is a promise broken, and a
 *     lethal tile on the landing row is the same promise broken more quietly.
 *     This is the exact counterpart of `checkGaps` refusing a bottomless run
 *     on a horizontal level, and for the same reason: the level may not kill
 *     you for the mistake it is built around.
 *   - **no stairway to nothing, on the axis where every stair is the route.**
 *     DESIGN.md §5's rule cannot be read literally here: a plank run in a
 *     climb *is* the way up, so "does it lead to something" is answered by the
 *     climb itself and the rule would pass everything. What it is protecting
 *     is not planks, it is the player's willingness to explore — one empty
 *     climb teaches you to skip the next. So the vertical form asks the same
 *     question of the same intent: **a platform you can reach but cannot
 *     continue from has to be worth having gone to.** A dead end with a coin
 *     on it is a detour; a dead end with nothing on it is the stairway to
 *     nothing, wearing the other axis.
 */
function checkClimb(rows, w, graph, budget, problems) {
  const h = rows.length;
  const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w ? ' ' : rows[y][x]);
  const find = (ch) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y) === ch) return { x, y };
    return null;
  };

  /* The bottom of the level, before anything else: a climb whose floor has a
   * hole in it fails every other question for the wrong reason.
   *
   * Two halves, and the second is the one that would otherwise be found by
   * playing. A floor you land on is not a floor if what is resting on it kills
   * you — a spike bed at the bottom of a climb turns every missed jump into a
   * life, which is the shape's one promise broken silently. So the tile the
   * fall actually stops at is the one that is asked, and it is found the way
   * the body finds it: the first thing down the column, not the last row. */
  for (let x = 0; x < w; x++) {
    if (!SOLID.has(at(x, h - 1))) {
      problems.push(`column ${x} has no floor at the bottom of the climb: a fall`
        + ' is a setback here, not a death, so there has to be something to land on');
      continue;
    }
    let y = h - 1;
    while (y > 0 && SOLID.has(at(x, y - 1))) y--;
    const on = at(x, y - 1);
    if (DEADLY.has(on) || on === '^') {
      problems.push(`column ${x} lands you on "${on}" at the bottom of the`
        + ' climb: falling may cost the climb, not the life');
    }
  }

  const start = find('1');
  const goal = find('F');
  if (!start) { problems.push('vertical level with no player start'); return; }
  if (!goal) { problems.push('vertical level with no goal'); return; }
  const from = landsOn(graph, start.x, start.y);
  const to = landsOn(graph, goal.x, goal.y);
  if (!from) { problems.push(`the start at ${start.x},${start.y} falls out of the level`); return; }
  if (!to) { problems.push(`the goal at ${goal.x},${goal.y} stands on nothing`); return; }

  const reachable = flood(graph.edges, [from.i]);
  if (!reachable.has(to.i)) {
    /* The useful coordinate is where the climb stops, not where it was going.
     * The highest platform that can be reached, and the cheapest step off it
     * that would have continued, with both numbers the jump is judged by. */
    let top = from;
    for (const i of reachable) if (graph.platforms[i].y < top.y) top = graph.platforms[i];
    let next = null;
    for (const p of graph.platforms) {
      if (p.y >= top.y || reachable.has(p.i)) continue;
      if (!next || p.y > next.y) next = p;
    }
    const rise = next ? top.y - next.y : null;
    problems.push(`the climb stops at the platform on row ${top.y}: `
      + (next
        ? `the next footing up is ${rise} tiles above and ${sideways(top, next)} across,`
        + ` and the measured jump rises ${budget.wallTiles} and carries`
        + ` ${graph.carry(Math.min(rise, budget.wallTiles))} at that rise`
        : 'there is nothing above it at all'));
    return;
  }

  /*
   * The stairway to nothing, on the axis where every stair is the route.
   *
   * Asked as "no way further up, and nothing on it", which is as close to the
   * horizontal rule's own words as the axis allows: it looks up four rows from
   * the platform for something to take, and rejects it when there is neither a
   * reward there nor anywhere left to climb. The first draft asked instead
   * whether the platform was on a route to the goal, and that rule can never
   * fire — you can always drop off a ledge back onto the climb, so every
   * platform in a well-formed climb reaches the goal and the check passes
   * everything. A rule that cannot fail is worse than no rule, because it
   * reads like cover.
   *
   * The goal's own platform is exempt for the obvious reason: nothing is above
   * it, and that is what makes it the top.
   *
   * **This is stricter than the genre, on purpose, and the corpus says by how
   * much.** `tools/mine-pacing.mjs --vertical` reads the two vertical games in
   * the corpus (DESIGN.md §3: aggregates only, and they are in
   * `tools/pacing-stats.json` under `vertical`): across 2341 rungs, **24.2 %
   * have nothing above them in reach**. A quarter of the footing in those
   * games goes nowhere. So this rule is not the genre convention, it is this
   * game's own §5 — *"jos rakennat palikkapolun ylöspäin, sen päässä on
   * jotain"* — held on the other axis, and it costs a design choice those
   * games did not make. It is worth the cost for the same reason it was
   * horizontally: one empty climb teaches you to skip the next.
   *
   * The same run says the median rung rise is **4 tiles and the p90 is 6**,
   * against our measured `wallTiles` of 4 — so a climb built to this rule sits
   * at the corpus's median and refuses its top decile, which is what scaling
   * to our own jump budget rather than to theirs means (§3 point 5).
   */
  for (const p of graph.platforms) {
    if (!reachable.has(p.i) || p.i === to.i) continue;
    if (graph.edges[p.i].some((j) => graph.platforms[j].y < p.y)) continue;
    const paid = [...Array(p.x1 - p.x0 + 3).keys()]
      .some((i) => [1, 2, 3, 4].some((up) => REWARD.has(at(p.x0 - 1 + i, p.y - up))));
    if (!paid) {
      problems.push(`platform at ${p.x0},${p.y} has nothing above it in reach and`
        + ' nothing on it: a stairway to nothing, standing on end');
    }
  }
}

/**
 * Route-only. The basic power-up is near the start, and near is measured along
 * the axis the player travels.
 *
 * The horizontal rule is "within the first quarter of the width", and its
 * reason has nothing to do with width: *if you lose your power immediately,
 * the repair is close, and you do not have to play the rest of the level at
 * the smallest size.* On a climb the quarter is a quarter of the **height**,
 * and it is taken from the start rather than from the bottom of the grid — a
 * level that digs downward starts at the top, and a rule that always looked at
 * the bottom rows would demand the power-up at the far end of it.
 */
function checkClimbPower(rows, w, problems) {
  const h = rows.length;
  let startRow = -1;
  let goalRow = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rows[y][x] === '1') startRow = y;
      if (rows[y][x] === 'F') goalRow = y;
    }
  }
  if (startRow < 0 || goalRow < 0) return;      // already reported by checkClimb
  const quarter = Math.floor(h * 0.25);
  const up = goalRow < startRow;
  const from = up ? Math.max(0, startRow - quarter) : startRow;
  const to = up ? startRow : Math.min(h - 1, startRow + quarter);
  for (let y = from; y <= to; y++) for (let x = 0; x < w; x++) if (rows[y][x] === '!') return;
  problems.push(`no power-up in the first quarter of the climb (rows ${from}-${to})`);
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
 * Bonus-only, and the one rule here that exists because the level the player
 * plays is not the level this file reads.
 *
 * Everything else in this module measures the grid as written. A beanstalk is
 * written whole — that is what lets `vineCrossings` say a hidden band has a way
 * in — but the engine lifts it out at build time and puts a `?` block on its
 * bump row instead (`LevelScene.plantVines`). Hit the block, the bean falls to
 * the floor, the stalk grows back up. So the proof that the sky band can be
 * reached now has a second half, and this is it: **the stalk will actually
 * grow, and the thing that grows is climbable from the ground.**
 *
 * Three questions, and each is the part of it a grid can answer:
 *
 *   - **is the vine rooted?** The tile under its lowest one has to be something
 *     you can stand on. That is where the bean lands and where the stalk starts,
 *     and it is also what makes the grown vine grabbable at all — you take hold
 *     of a beanstalk by standing at the bottom of it and pressing up. Measured:
 *     with the vine lifted to the bump row instead, **no power level below 3
 *     can reach it** and the secret becomes unreachable for the size the level
 *     promises to work at.
 *   - **is there room for the block?** It hangs `BEAN_BLOCK_OVER_FLOOR` tiles
 *     over that floor, in the vine's own column, so the vine has to be at least
 *     that tall — otherwise the engine would be putting a block where no vine
 *     was, in a cell nothing has checked.
 *   - **can that height be hit?** The smallest body standing on the floor has
 *     its head one row up, so the block is `BEAN_BLOCK_OVER_FLOOR - 1` rows
 *     over it, against a budget of `wall` rows of rise. Three against four
 *     today. It is a constant either side, which is exactly why it is checked
 *     here rather than remembered: the budget is measured and it can move.
 *
 * Asked of vines that cross a seam and no others. A vine that goes nowhere
 * proves nothing about a hidden band, and the engine leaves an unrooted one
 * exactly where it is drawn — so the two agree about which vines are planted.
 */
function checkBeanBlocks(rows, w, seams, reach, problems) {
  const done = new Set();
  for (const s of seams) {
    if (done.has(s.x)) continue;
    done.add(s.x);
    let foot = (s.upper + 1) * ROWS;
    let top = foot;
    while (foot + 1 < rows.length && rows[foot + 1][s.x] === VINE) foot++;
    while (top > 0 && rows[top - 1][s.x] === VINE) top--;

    const under = foot + 1 < rows.length ? rows[foot + 1][s.x] : ' ';
    if (!SOLID.has(under)) {
      problems.push(`beanstalk at column ${s.x} ends at row ${foot} over "${under}"`
        + ' instead of standing on the floor');
      continue;
    }
    const by = foot + 1 - BEAN_BLOCK_OVER_FLOOR;
    if (by < top) {
      problems.push(`beanstalk at column ${s.x} is ${foot - top + 1} tiles tall,`
        + ` too short to hang a bean block ${BEAN_BLOCK_OVER_FLOOR} over its floor`);
      continue;
    }
    const rise = BEAN_BLOCK_OVER_FLOOR - 1;
    if (rise > reach.wall) {
      problems.push(`the bean block at ${s.x},${by} is ${rise} tiles over a standing`
        + ` head and the jump budget carries ${reach.wall}`);
    }
  }
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
 * @param {{vertical?:boolean}} [opts] what shape of level this is. Omitted
 *   everywhere in the game, because every level in the game is horizontal;
 *   a climb has to say so, and saying so is what switches the axis. Defaulting
 *   it off is what makes this change inert for the 30 levels that exist — an
 *   inference from the grid's shape would have to guess, and guessing wrong
 *   about a tall level would rewrite the rules under the banded ones.
 * @returns {string[]} human-readable problems, empty when the level is sound
 */
export function validateLevel(rows, budget, opts = {}) {
  const reach = { gap: budget.gapTiles, wall: budget.wallTiles };
  const problems = [];
  const w = rows[0].length;

  /* Universal, and first because everything after it indexes a row by column:
   * on a ragged grid the rest would report nonsense on top of the one problem
   * that is actually there, so it is reported alone. */
  if (rows.some((r) => r.length !== w)) return ['ragged rows'];

  /*
   * A CLIMB, AND THEREFORE A DIFFERENT SET OF QUESTIONS.
   *
   * Everything below this block reads row 13 and walks left to right. On a
   * 20-column, forty-row level that is not a weaker answer, it is an answer to
   * another level: the "floor" is the topmost platform of each column, the
   * whole grid is one gap, and the power-up "in the first quarter" is in the
   * first quarter of a width that is one screen.
   *
   * So the route rules are replaced rather than reused, and the ones that are
   * genuinely about a tile and its neighbour are kept:
   *
   *   kept    ragged rows, enemies standing on something, beanstalk clearance.
   *           None of them mentions a floor, a start or a flag.
   *   replaced gaps and walls → `checkClimb`; the power-up in the first quarter
   *           → the first quarter of the *climb*; "no stairway to nothing" →
   *           the dead-end rule inside `checkClimb`.
   *   dropped headroom and the quicksand rim, and both for the same reason:
   *           they are measured off `floorProfile`, which is row 13. Headroom
   *           would also be wrong even if it were re-aimed — a climb's
   *           platforms are spaced by the jump budget, four tiles at the most,
   *           so a rule demanding three clear rows over every one of them
   *           fires on every correctly built climb. That is the same escape
   *           the horizontal rule already grants a low shelf, in its own
   *           words: a body that does not fit above it cannot get onto it, so
   *           it is unreachable at that size rather than sealed.
   *
   * The width is checked here and not left to the camera to discover, because
   * the camera would not discover it — it would quietly start scrolling
   * sideways and the level would be a different shape than the one anybody
   * designed. See VERTICAL_COLS.
   */
  if (opts.vertical) {
    if (w !== VERTICAL_COLS) {
      problems.push(`a climb is ${VERTICAL_COLS} columns wide and this one is ${w}:`
        + ' one screen exactly, or the camera starts scrolling sideways');
    }
    if (rows.length <= ROWS) {
      problems.push(`a climb is taller than one screen and this one is ${rows.length} rows`);
    }
    checkEnemyFooting(rows, w, problems);
    checkVines(rows, w, problems);
    checkFalling(rows, w, problems);
    checkIce(rows, w, problems);
    checkClimbWidth(rows, w, problems);
    checkClimbTraverse(rows, w, budget, problems);
    const graph = climbGraph(rows, budget);
    checkClimb(rows, w, graph, budget, problems);
    checkClimbPower(rows, w, problems);
    return problems;
  }

  checkEnemyFooting(rows, w, problems);

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

  /* Universal, whole grid: a beanstalk is a beanstalk in any band, a tile that
   * can fall is one wherever it is put, and so is a tile you cannot stop on. */
  checkVines(rows, w, problems);
  checkFalling(rows, w, problems);
  checkIce(rows, w, problems);

  /* Universal, per band: headroom over the ground of whatever band it is, and
   * what a quicksand pool has to be wherever one is dug. */
  for (let b = 0; b < bands.length; b++) {
    const at = reader(bands[b], w);
    checkHeadroom(at, floorProfile(at, w), 0, w - 1, problems, where(b));
    checkQuicksand(bands[b], w, reach, problems, where(b));
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
    checkBeanBlocks(rows, w, seams, reach, problems);
    for (let b = 0; b < bands.length; b++) {
      if (b === routeIndex || !hasContent(bands[b])) continue;
      checkBonusBand(rows, w, bands[b], b, routeIndex, mouths, seams, reach, problems, bandName(b));
    }
  }

  return problems;
}

export const RULE_CONSTANTS = {
  ROWS, FLOOR, HEAD, BEAN_BLOCK_OVER_FLOOR, VERTICAL_COLS, ICE_BRAKE,
};
