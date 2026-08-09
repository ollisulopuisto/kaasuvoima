/**
 * World 3's chunks. Ice adds fewer pieces than the other worlds because most of
 * its difficulty comes from the floor being slippery, which is a physics change
 * and not a chunk — so what is here is the two things the world teaches with
 * geometry instead.
 */

import { ck, G } from './common.js';

export const ICE_CHUNKS = {
  cloud_run: ck(16, {
    4: '   r',
    7: '        r',
    9: '      ooo',
    10: '     ----',
    13: '###         ####',
    14: '###         ####',
  }),

  /**
   * The spiky walker, on open flat ground on purpose.
   *
   * The lesson is "reach for another tool", not "die to a surprise": there is
   * room to back off, nothing to fall into, and a power block earlier in the
   * level answers the question. Pairing it with a forced jump or a narrow ledge
   * would teach the wrong thing.
   */
  spike_walk: ck(16, { 9: '   o o o', 12: '        x', 13: G, 14: G }),
};
