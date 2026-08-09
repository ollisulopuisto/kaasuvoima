/**
 * The corridors every world ends in, and the two arenas. They are their own
 * file because a fortress is the one level type that repeats unchanged across
 * five worlds — the same hall, gap and pillars in a different order — so a
 * change here is felt five times and should be reviewed once.
 */

import { ck, G } from './common.js';

export const FORTRESS_CHUNKS = {
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
  /**
   * The trench. Nine tiles of lava, one plank in the middle, and the spikes on
   * the near lip so the run-up has to be measured instead of taken — two
   * three-tile hops rather than one long one, which is a different skill and
   * the one a last fortress should be asking about.
   */
  fort_trench: ck(16, {
    0: G,
    1: G,
    10: '      ---',
    12: ' ^^',
    13: '###         ####',
    14: '###WWWWWWWWW####',
  }),
  /**
   * The factory catwalk, rebuilt over lava. There it cost you the fall; here it
   * costs you immediately, which is the only thing the last fortress adds — the
   * move is still "keep walking".
   */
  fort_burn: ck(16, {
    0: G,
    1: G,
    9: '    o o o',
    12: '            k',
    13: '###%%%%%%%%%####',
    14: '###WWWWWWWWW####',
  }),
  boss_arena: ck(32, {
    0: G + G,
    1: G + G,
    2: 'XX                            XX',
    3: 'XX                            XX',
    9: '            b',
    /* Two tiles wide and three tall. The largest power level is 21x43 px, so a
     * single-tile doorway is a third of his height — he does not walk through
     * it, he steps over it. */
    10: '                            DD',
    11: '                            DD',
    12: '                            DD',
    13: G + G,
    14: G + G,
  }),
};
