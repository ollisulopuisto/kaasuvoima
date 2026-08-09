/**
 * Levels are assembled from 15-row chunks. Writing them as sparse row maps
 * keeps the data short and makes column alignment impossible to get wrong:
 * every row is padded to the chunk width at build time.
 *
 * Row guide (row 13-14 is normally the floor):
 *   0-3   high sky        8-9   the classic "bump row" reachable from the floor
 *   4-7   platform band   12    the tile enemies and pipes stand on
 *
 * Characters: see src/gfx/tiles.js (T) plus entity markers
 *   1 player start | g walker | k shell | f flyer | p piranha | b boss
 *
 * A level can also be three of these bands stacked — see assembleTall.
 */

export const CHUNK_ROWS = 15;

const G = '################';
const G8 = '########';

/**
 * Threads a beanstalk down a column of a chunk spec, `top`..`bottom` inclusive.
 * Merged rather than written, so the vine can pass through rows that already
 * have something in them — and twenty near-identical `'      v'` lines are not
 * a level map, they are a copy-paste.
 */
function withVine(spec, col, top, bottom) {
  for (let y = top; y <= bottom; y++) {
    const row = (spec[y] || '').padEnd(col + 1, ' ');
    spec[y] = row.slice(0, col) + 'v' + row.slice(col + 1);
  }
  return spec;
}

function ck(w, spec) {
  const rows = [];
  for (let y = 0; y < CHUNK_ROWS; y++) {
    const raw = spec[y] || '';
    if (raw.length > w) {
      throw new Error(`chunk row ${y} is ${raw.length} wide, expected max ${w}: "${raw}"`);
    }
    rows.push(raw.padEnd(w, ' '));
  }
  return { w, rows };
}

export const CHUNKS = {
  /* ------------------------------ openings ----------------------------- */
  start: ck(16, {
    12: '  1',
    13: G,
    14: G,
  }),
  start_high: ck(16, {
    8: '   o',
    9: '  1',
    10: '  ---',
    13: G,
    14: G,
  }),

  /* ------------------------------- ground ------------------------------ */
  flat: ck(16, { 13: G, 14: G }),
  flat8: ck(8, { 13: G8, 14: G8 }),
  walker: ck(16, { 12: '        g', 13: G, 14: G }),
  walkers: ck(16, { 12: '   g        g', 13: G, 14: G }),
  shell: ck(16, { 12: '      k', 13: G, 14: G }),
  flyer: ck(16, { 8: '       f', 13: G, 14: G }),

  /* ------------------------------- blocks ------------------------------ */
  coins: ck(16, { 9: '   o o o o', 13: G, 14: G }),
  qrow: ck(16, { 9: '    ?B?B?', 13: G, 14: G }),
  power: ck(16, { 9: '      !', 13: G, 14: G }),
  // Same block, but for the chunks that have a ceiling.
  fort_power: ck(16, { 0: G, 1: G, 9: '      !', 13: G, 14: G }),
  power_hi: ck(16, { 5: '      !', 9: '   BB?BB', 13: G, 14: G }),
  bricks: ck(16, { 9: '  BBBB?BBBB', 13: G, 14: G }),
  // Four tiles tall: clearable with a running jump, awkward from a standstill.
  brick_wall: ck(16, {
    5: '      B?B',
    9: '      BBB',
    10: '      BBB',
    11: '      BBB',
    12: '      BBB   g',
    13: G,
    14: G,
  }),
  note_pair: ck(16, { 9: '     NN', 12: '            g', 13: G, 14: G }),
  coin_stack: ck(16, {
    6: '     oo',
    7: '     oo',
    8: '     oo',
    9: '  ?  oo  ?',
    13: G,
    14: G,
  }),

  /* -------------------------------- pits ------------------------------- */
  pit_s: ck(16, { 13: '#####      #####', 14: '#####      #####' }),
  // Eight tiles wide — too far in one hop, so there is a stepping stone.
  pit_l: ck(16, {
    9: '       ooo',
    10: '       ---',
    13: '####        ####',
    14: '####        ####',
  }),
  pit_plat: ck(16, {
    9: '     o o o',
    10: '    -----',
    13: '###          ###',
    14: '###          ###',
  }),
  pit_bridge: ck(16, {
    11: '   ---------',
    12: '        k',
    13: '##          ####',
    14: '##          ####',
  }),

  /* ------------------------------- stairs ------------------------------ */
  steps_up: ck(16, {
    9: '            XX',
    10: '          XXXX',
    11: '        XXXXXX',
    12: '      XXXXXXXX',
    13: G,
    14: G,
  }),
  // Three tiles at the tall end, so it can be climbed from the left too.
  steps_down: ck(16, {
    10: 'XX',
    11: 'XXXX',
    12: 'XXXXXX',
    13: G,
    14: G,
  }),
  ledge: ck(16, {
    10: '    XXXXXXXX',
    11: '    XXXXXXXX',
    12: '    XXXXXXXX g',
    13: G,
    14: G,
  }),

  /* -------------------------------- pipes ------------------------------ */
  pipe_short: ck(16, {
    11: '     []',
    12: '     {}',
    13: G,
    14: G,
  }),
  pipe_tall: ck(16, {
    9: '      []',
    10: '      {}',
    11: '      {}',
    12: '      {}',
    13: G,
    14: G,
  }),
  pipe_plant: ck(16, {
    8: '     p',
    9: '     []',
    10: '     {}',
    11: '     {}',
    12: '     {}',
    13: G,
    14: G,
  }),
  pipe_pair: ck(16, {
    10: ' []       []',
    11: ' {}       {}',
    12: ' {}       {} ',
    13: G,
    14: G,
  }),

  /* --------------------- salaisuudet: varsi ja putki -------------------- */
  /** Grows from the floor all the way through the band and into the sky one. */
  beanstalk: ck(16, withVine({ 9: '   o     o   o', 13: G, 14: G }, 6, 0, 12)),
  /** An ordinary-looking pipe. Press down on it and it is not one. */
  warp_pipe: ck(16, {
    11: '     ()',
    12: '     {}',
    13: G,
    14: G,
  }),
  /* The sky band: where the beanstalk arrives. The vine runs three tiles past
   * the platform so you can step off sideways instead of guessing where to let
   * go, and the way back down is to walk off the edge — a bonus area you
   * cannot leave is a trap, not a bonus.
   *
   * The platform is planks and not ground on purpose: the tallest power level
   * is three tiles wide when it hangs off a vine, so anything solid beside the
   * vine is a ceiling that stops the biggest player climbing past it. */
  sky_garden: ck(32, withVine({
    5: '        ?!?',
    8: '          ooooo',
    9: '       ---------',
  }, 6, 6, 14)),
  /* The cave band: a sealed room under the warp pipe. The exit pipe stands one
   * tile lower than the entry one, which is exactly the height difference that
   * puts you back on the surface standing on the floor. */
  cave_room: ck(32, {
    5: ' XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    6: ' X                            X',
    7: ' X                            X',
    8: ' X                            X',
    9: ' X        ?B!B?               X',
    10: ' X                            X',
    11: ' X        oooooooooo          X',
    /* The exit sits where the *surface* above it is clear, not where it looks
     * tidiest down here. The tallest power level is 21x43 px — three tiles wide
     * and nearly three tall — so a brick row on the surface two columns over is
     * enough to make the warp refuse, and the biggest player would be sealed in
     * a bonus room with no way out. */
    12: ' X        oooooooooo      ()  X',
    13: ' XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    14: ' XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  }),

  /**
   * The switch and its payoff in one screen: hit the button, the slab of bricks
   * overhead turns into a raft of coins, and you have ten seconds to jump into
   * it before they turn back.
   *
   * **The switch opens a reward, never the route.** You can walk straight
   * under this and finish the level having ignored it entirely. Gating the way
   * forward behind a timed button breaks exactly the promise a mandatory
   * power-up would break — and neither the validator nor the bot can model a
   * button, so a gate here would also mean lying to both of them.
   *
   * The floor is `#` and never `B`: a switch that dissolves the ground you are
   * standing on is a different and much meaner idea.
   */
  switch_wall: ck(20, {
    5: '        BBBBBBBB',
    6: '        BBBBBBBB',
    7: '        BBBBBBBB',
    9: '  o  S',
    13: '####################',
    14: '####################',
  }),

  /* ----------------------------- platforms ----------------------------- */
  plat_hi: ck(16, {
    5: '     o o',
    6: '    ------',
    7: '     o o',
    13: G,
    14: G,
  }),
  plat_steps: ck(16, {
    4: '         oo',
    5: '        ----',
    7: '   oo',
    8: '  ----',
    10: '       ooo',
    11: '       ---',
    13: G,
    14: G,
  }),
  plat_float: ck(16, {
    6: '    ooo',
    7: '   -----',
    8: '    ooo',
    12: '            g',
    13: G,
    14: G,
  }),
  sky_run: ck(16, {
    4: '  --------',
    5: '   o o o',
    8: '            o',
    9: '           ---',
    13: '######      ####',
    14: '######      ####',
  }),

  /* ------------------------------- hazards ----------------------------- */
  spikes: ck(16, { 12: '     ^^^^', 13: G, 14: G }),
  lava_gap: ck(16, {
    10: '   ------',
    13: '####WWWWWW######',
    14: '####WWWWWW######',
  }),
  lava_wide: ck(16, {
    9: '   ----',
    10: '        ----',
    13: '##WWWWWWWWWWWW##',
    14: '##WWWWWWWWWWWW##',
  }),

  /* --------------------- ilmavaivat: uudet uhat ------------------------ */
  heartburn: ck(16, {
    9: '    o o o',
    12: '      H',
    13: G,
    14: G,
  }),
  heartburn_pair: ck(16, {
    9: '     ooo',
    10: '   ------',
    12: '  H        H',
    13: G,
    14: G,
  }),
  corks: ck(16, {
    12: '     c      c',
    13: G,
    14: G,
  }),
  cork_gap: ck(16, {
    12: '   c        c',
    13: '#####      #####',
    14: '#####      #####',
  }),
  clouds: ck(16, {
    5: '      r',
    8: '  r',
    13: G,
    14: G,
  }),
  cloud_run: ck(16, {
    4: '   r',
    7: '        r',
    9: '      ooo',
    10: '     ----',
    13: '###         ####',
    14: '###         ####',
  }),
  /** Wakes the angry sun. One per level is plenty — it follows you after that. */
  sun: ck(16, {
    2: '       A',
    9: '   o o o',
    13: G,
    14: G,
  }),
  /**
   * Supertähti, and then somewhere to spend it.
   *
   * The block sits on the ordinary bump row, so the star is not a reward for
   * reaching anywhere — it is a reward for hitting a block that looks like
   * every other block. What follows it is the point: a walker and a cork in
   * open ground, which is a nuisance normally and a straight run with a star.
   */
  star_block: ck(16, {
    9: '   *',
    12: '        g   c',
    13: G,
    14: G,
  }),
  soup_stop: ck(16, {
    9: '      !',
    12: '   g       c',
    13: G,
    14: G,
  }),

  /* ------------------------------ factory ------------------------------ */
  fac_floor: ck(16, {
    0: G,
    1: G,
    13: G,
    14: G,
  }),
  fac_press: ck(16, {
    0: G,
    1: G,
    2: '     XXXX',
    3: '     XXXX',
    9: '  ?  XXXX  ?',
    12: '           g',
    13: G,
    14: G,
  }),
  fac_vents: ck(16, {
    0: G,
    1: G,
    7: '    ooo',
    8: '   -----',
    12: '  H     H    H',
    13: G,
    14: G,
  }),
  fac_belt: ck(16, {
    0: G,
    1: G,
    6: '     r',
    9: '     ooooo',
    10: '  ---------',
    12: '            c',
    13: '##          ####',
    14: '##WWWWWWWWWW####',
  }),
  fac_shaft: ck(16, {
    0: G,
    1: G,
    2: 'XX          XX',
    3: 'XX    r     XX',
    4: 'XX          XX',
    // Bricks in the middle only: over the pillars they left the tallest power
    // level with two tiles of clearance, and it is 2.7 tiles tall.
    8: '     BBBB',
    11: 'XX          XX',
    12: 'XX  c    H  XX',
    13: G,
    14: G,
  }),
  fac_gap: ck(16, {
    0: G,
    1: G,
    9: '       ---',
    12: ' H',
    13: '#####     ######',
    14: '#####WWWWW######',
  }),
  /**
   * A catwalk that will not hold. Keep moving and it is a straight run; stop to
   * think and the floor leaves without you.
   *
   * The coins sit above the crumbling tiles rather than on the safe ends, so
   * the greedy line and the safe line are the same line — the tension is in the
   * pace, not in a choice made before you start.
   */
  fac_crumble: ck(22, {
    0: G + '      ',
    1: G + '      ',
    9: '      o o o o',
    12: '  ?',
    13: '#####%%%%%%%%%%%#####',
    14: '#####            ####',
  }),
  /** Roomy arena with landing platforms: the giant needs headroom. */
  boss_arena_big: ck(48, {
    0: G + G + G,
    1: G + G + G,
    2: 'XX                                            XX',
    3: 'XX                                            XX',
    5: '         o o                      o o',
    6: '        -----                    -----',
    7: '         o o                      o o',
    9: '                     b',
    12: '                                            D',
    13: G + G + G,
    14: G + G + G,
  }),

  /* ------------------------------ fortress ----------------------------- */
  fort_hall: ck(16, {
    0: G,
    1: G,
    13: G,
    14: G,
  }),
  fort_gap: ck(16, {
    0: G,
    1: G,
    12: '       k',
    13: '####      ######',
    14: '####WWWWWW######',
  }),
  fort_blocks: ck(16, {
    0: G,
    1: G,
    5: '    BBBB',
    6: '    B  B',
    9: '  BB?BBB',
    12: '            g',
    13: G,
    14: G,
  }),
  fort_spikes: ck(16, {
    0: G,
    1: G,
    2: '     ^^^^',
    7: '    o?o',
    8: '   -----',
    12: '  ^^    ^^',
    13: G,
    14: G,
  }),
  fort_pillars: ck(16, {
    0: G,
    1: G,
    2: 'XX          XX',
    3: 'XX          XX',
    4: 'XX          XX',
    9: '     ?',
    11: 'XX          XX',
    12: 'XX    f     XX',
    13: G,
    14: G,
  }),
  boss_arena: ck(32, {
    0: G + G,
    1: G + G,
    2: 'XX                            XX',
    3: 'XX                            XX',
    9: '            b',
    12: '                            D',
    13: G + G,
    14: G + G,
  }),

  /* ------------------------------ night ------------------------------- */
  // The moon sits above a staircase, so it is reachable without the fart jump
  // but still asks for a climb.
  moon_night: ck(16, {
    3: '        O',
    9: '   XX',
    10: '  XXXX',
    11: ' XXXXXX',
    12: 'XXXXXXXX',
    13: G,
    14: G,
  }),
  dune_night: ck(16, { 9: '     o o o', 12: '        g', 13: G, 14: G }),

  /* -------------------------------- goal ------------------------------- */
  run_up: ck(16, { 9: '     o o o', 13: G, 14: G }),
  goal: ck(16, {
    12: '      F',
    13: G,
    14: G,
  }),
  goal_end: ck(16, { 13: G, 14: G }),
};

/** Expands a chunk name list into one padded grid of characters. */
export function assemble(names) {
  const rows = Array.from({ length: CHUNK_ROWS }, () => '');
  for (const name of names) {
    const chunk = CHUNKS[name];
    if (!chunk) throw new Error(`unknown chunk: ${name}`);
    for (let y = 0; y < CHUNK_ROWS; y++) rows[y] += chunk.rows[y];
  }
  return rows;
}

/** Stamps sparse `[column, chunk]` placements into one otherwise empty band. */
function band(width, places) {
  const rows = Array.from({ length: CHUNK_ROWS }, () => ' '.repeat(width));
  for (const [at, name] of places) {
    const chunk = CHUNKS[name];
    if (!chunk) throw new Error(`unknown chunk: ${name}`);
    if (at < 0 || at + chunk.w > width) {
      throw new Error(`chunk ${name} at column ${at} does not fit a ${width} wide level`);
    }
    for (let y = 0; y < CHUNK_ROWS; y++) {
      rows[y] = rows[y].slice(0, at) + chunk.rows[y] + rows[y].slice(at + chunk.w);
    }
  }
  return rows;
}

/**
 * Three bands of the same 15 rows, stacked: sky, the route, the cave. The
 * engine is told nothing — the level is simply 45 rows tall, the camera already
 * scrolls vertically, and the save state already stores the whole grid.
 *
 * `sky` and `cave` are sparse `[column, chunkName]` placements rather than
 * playlists, because a hidden area is a room or two and not a second level.
 *
 * The one thing stacking breaks is the floor of the middle band: a pit that
 * used to end a fall now drops the player into the band below and shows them
 * the secret on the way past. So every bottomless column gets a lid of lava
 * directly underneath, and falling in kills at the moment it always did.
 */
export function assembleTall(main, sky = [], cave = []) {
  const rows = assemble(main);
  const width = rows[0].length;
  const under = band(width, cave);
  let lid = '';
  for (let x = 0; x < width; x++) {
    const bottomless = rows[CHUNK_ROWS - 2][x] === ' ' && rows[CHUNK_ROWS - 1][x] === ' ';
    lid += bottomless ? 'W' : under[0][x];
  }
  under[0] = lid;
  return [...band(width, sky), ...rows, ...under];
}
