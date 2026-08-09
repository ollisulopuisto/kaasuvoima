/**
 * World 4's chunks. Every one of them has a ceiling: the factory is indoors,
 * and a piece from here dropped into an open-air level would leave a roof
 * hanging over nothing. That is the reason they cannot simply live in
 * common.js next to the pieces they otherwise resemble.
 */

import { ck, G } from './common.js';

export const FACTORY_CHUNKS = {
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
    10: '                                            DD',
    11: '                                            DD',
    12: '                                            DD',
    13: G + G + G,
    14: G + G + G,
  }),
};
