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

  /**
   * THE GIANT'S ARENA — 4-F and 5-F, `bossVariant: 3`.
   *
   * ## Why it lives here and not in `factory.js`
   *
   * It used to be a factory chunk, next to `fac_loft`, because 4-F is the
   * factory's fortress. But it is an arena, and this file is the one that says
   * "the corridors every world ends in, and the two arenas" — a chunk shared by
   * two worlds should be read where the other shared arena is read. `chunks.js`
   * spreads `FORTRESS_CHUNKS` after `FACTORY_CHUNKS`, so **this definition is
   * the live one** and the copy still sitting in `factory.js` is dead. That is
   * a trap unless something says so out loud, so `verify.mjs` asserts the
   * shadowing (`the giant's arena is the fortress copy`): edit the factory copy
   * and nothing happens, but the gate tells you why.
   *
   * ## What the decks are for, and why they now have stairs
   *
   * The giant grows half a size with every stomp (`Boss.stomp`), so his head
   * climbs away from the floor as the fight goes on. Measured, at power level 0
   * and 16 px tiles, with the floor's surface at y=208:
   *
   * | hits landed | scale | height | head top | rise the next stomp needs |
   * | --- | --- | --- | --- | --- |
   * | 0 | 1.0 | 32 | 176 | 32 px |
   * | 1 | 1.5 | 48 | 160 | 48 px |
   * | 2 | 2.0 | 64 | 144 | 64 px |
   * | 3 | 2.5 | 80 | 128 | **80 px** |
   * | 4 | 3.0 | 96 | 112 | **96 px** |
   *
   * A standing jump carries 71 px and a running one 85 (`jump-budget.json`), so
   * the fourth stomp is already outside a standing jump and the fifth — the one
   * that ends the fight — is outside every jump a power-0 player has. **That is
   * the design**: the last two hits are supposed to come down from the decks,
   * not up from the floor. The decision was made on 9.8.2026 and it is not up
   * for revisiting here; the boss does not get smaller and the decks do not
   * come down.
   *
   * What was actually broken is that **the decks could not be got onto at all**.
   * Row 6 is 112 px above the floor against an 85 px best jump, and there was
   * nothing in between: a simulated climb over the whole arena at power 0 found
   * exactly one standable height, the floor. The answer to the fight was
   * hanging in the air out of reach, which is why it read as scenery — it *was*
   * scenery. So each deck now has a step under it, and the climb is signposted
   * the way this game signposts things:
   *
   *   - **a step at row 9**, four tiles up from the floor (64 px, the measured
   *     `wallTiles` budget) and three below the deck (48 px). Two ordinary
   *     standing jumps, both inside the power-0 budget, which is the size that
   *     matters — a player who has been hit is the player who is small.
   *   - **planks, not blocks.** Semi-solid, so nothing can be trapped on top of
   *     one and neither the boss nor a shockwave is stopped by one.
   *   - **a coin arc into each step** (rows 11 and 10). The arc is the shape of
   *     the jump that gets you there, which is the one pointing device this
   *     game already has.
   *   - **coins on the decks themselves**, a full row of five where there used
   *     to be two. DESIGN.md §5 forbids a climb with nothing at the top; the
   *     mirror of that rule is what was wrong here, a top with nothing leading
   *     to it. Now the deck is worth standing on in the first minute of the
   *     fight, while the boss is still small enough to hit from the floor — so
   *     the player learns the route before the fight needs it.
   *
   * Row 9 is deliberate and not merely convenient: the boss's own jump
   * (`vy = -5.6`) lifts his feet to y≈158, so a plank at row 10 (top 160) is
   * something he can land on and row 9 (top 144) is not. The steps are out of
   * his reach by 16 px, and that margin is the reason they are where they are.
   *
   * Both climbs are entered running right, like everything else in the game,
   * and both sit outboard of their deck so climbing takes you away from him
   * rather than over him.
   */
  boss_arena_big: ck(48, {
    0: G + G + G,
    1: G + G + G,
    2: 'XX                                            XX',
    3: 'XX                                            XX',
    5: '        ooooo                    ooooo',
    6: '        -----                    -----',
    7: '       o                              o',
    9: '    ----             b                ----',
    10: '   o                                 o      DD',
    11: '  o                                 o       DD',
    12: '                                            DD',
    13: G + G + G,
    14: G + G + G,
  }),
};
