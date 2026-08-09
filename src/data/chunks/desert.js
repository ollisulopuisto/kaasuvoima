/**
 * World 2's chunks: the heat, the things that come out of the floor, and the
 * night level's two pieces. Grouped by the world that introduces them rather
 * than by the tile they use, because that is the level someone is editing when
 * they change one.
 */

import { ck, G } from './common.js';

export const DESERT_CHUNKS = {
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
  cork_gap: ck(16, {
    12: '   c        c',
    13: '#####      #####',
    14: '#####      #####',
  }),
  /** Wakes the angry sun. One per level is plenty — it follows you after that. */
  sun: ck(16, {
    2: '       A',
    9: '   o o o',
    13: G,
    14: G,
  }),
  soup_stop: ck(16, {
    9: '      !',
    12: '   g       c',
    13: G,
    14: G,
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
};
