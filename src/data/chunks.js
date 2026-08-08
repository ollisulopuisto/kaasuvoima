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
 */

export const CHUNK_ROWS = 15;

const G = '################';
const G8 = '########';

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
  steps_down: ck(16, {
    9: 'XX',
    10: 'XXXX',
    11: 'XXXXXX',
    12: 'XXXXXXXX',
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
    6: '    ------',
    7: '     o o',
    13: G,
    14: G,
  }),
  plat_steps: ck(16, {
    5: '        ----',
    8: '  ----',
    11: '       ---',
    13: G,
    14: G,
  }),
  plat_float: ck(16, {
    7: '   -----',
    8: '    ooo',
    12: '            g',
    13: G,
    14: G,
  }),
  sky_run: ck(16, {
    4: '  --------',
    5: '   o o o',
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
