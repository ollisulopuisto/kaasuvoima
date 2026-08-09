/**
 * The chunks world 1 introduces on top of the common vocabulary. They are not
 * grass-only — a cork or a cloud turns up right through the game — but this is
 * where the player first meets them, so this is where a change to how they read
 * has to be judged.
 */

import { ck, G } from './common.js';

export const GRASS_CHUNKS = {
  corks: ck(16, {
    12: '     c      c',
    13: G,
    14: G,
  }),
  clouds: ck(16, {
    5: '      r',
    8: '  r',
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
};
