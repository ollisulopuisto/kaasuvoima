/**
 * The chunk vocabulary every world is built from, and the helpers that make a
 * chunk. It lives apart from the themed files because these pieces belong to no
 * world in particular: `flat`, a pit and a staircase turn up in the grass and in
 * the factory alike, and copying them per theme would mean five places to fix
 * when the floor changes.
 *
 * The helpers are here rather than in a file of their own so a themed chunk file
 * has exactly one import.
 */

export const CHUNK_ROWS = 15;

export const G = '################';
export const G8 = '########';

/**
 * Threads a beanstalk down a column of a chunk spec, `top`..`bottom` inclusive.
 * Merged rather than written, so the vine can pass through rows that already
 * have something in them — and twenty near-identical `'      v'` lines are not
 * a level map, they are a copy-paste.
 */
export function withVine(spec, col, top, bottom) {
  for (let y = top; y <= bottom; y++) {
    const row = (spec[y] || '').padEnd(col + 1, ' ');
    spec[y] = row.slice(0, col) + 'v' + row.slice(col + 1);
  }
  return spec;
}

export function ck(w, spec) {
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

export const COMMON_CHUNKS = {
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
  /**
   * Two gaps and two tiles of ground between them. Each jump on its own is
   * shorter than the one in `pit_s`; what is hard is that the first one has to
   * *stop*, because the landing is two tiles wide and the next gap starts
   * immediately after it.
   *
   * This is deliberately not one wide gap. The measured budget says eight tiles
   * fit, but `tools/playable.mjs` — which is the design promise made
   * executable — does not clear seven at power level 0, and a level the
   * smallest size cannot pass is broken rather than hard. Difficulty here has
   * to come from asking for two accurate jumps, not one enormous one.
   */
  pit_twin: ck(16, {
    9: '  o o     o o',
    13: '##     ##     #',
    14: '##     ##     #',
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
  /**
   * A spike bed too long to hop, and a bridge over it. The bridge is the route
   * and the spikes are what a badly judged landing costs — the ground under
   * them is still ground, so the level does not become a pit, it becomes a
   * question about height.
   */
  spike_bridge: ck(16, {
    8: '      ooo',
    9: '   ---------',
    12: '     ^^^^',
    13: G,
    14: G,
  }),
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

  /* -------------------------------- goal ------------------------------- */
  run_up: ck(16, { 9: '     o o o', 13: G, 14: G }),
  goal: ck(16, {
    12: '      F',
    13: G,
    14: G,
  }),
  goal_end: ck(16, { 13: G, 14: G }),
};
