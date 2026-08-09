/**
 * The chunks that carry a mechanic rather than a shape: the hidden routes out
 * of the middle band, the timed switch, and the floor that leaves without you.
 *
 * They sit together because none of them can be read off the tile grid — a
 * reviewer has to know what the vine, the warp pipe and the button do before
 * the map means anything — and because the rules they obey (a bonus you can
 * always leave, a reward that is never the route) are the same rules.
 */

import { ck, withVine, G } from './common.js';

export const SECRET_CHUNKS = {
  /* --------------------- salaisuudet: varsi ja putki -------------------- */
  /**
   * The beanstalk, drawn here in the state it **ends up in**: rooted in the
   * floor and running all the way through the band and into the sky one.
   *
   * The player never sees it like this to begin with. `LevelScene.plantVines`
   * lifts the whole vine out of the live grid when the level is built and puts
   * an ordinary-looking `?` block on the bump row of the vine's own column; the
   * block drops a bean, the bean falls to the floor, and the stalk grows back
   * up a tile at a time — through the spent block, which is where it came from.
   *
   * **The vine is written here anyway, and that is the point.** The level data
   * is the grown level, `src/data/rules.js` validates the grown level, and the
   * engine derives the ungrown one from it. Handing the validator the ungrown
   * grid instead would mean it finds no vine, no seam crossing, and quietly
   * stops proving that the sky band can be reached at all — it would not fail,
   * it would go silent, which is worse. So there is one source of truth and the
   * gate still checks the thing the player ends up standing on.
   *
   * The block is not in this map because the vine is: the two want the same
   * cell, and the vine is the one that has to be here for the validator. Where
   * the block goes is therefore a rule and not a placement — the bump row of
   * the vine's own column — and `checkBeanBlocks` in rules.js holds the engine
   * to it, so this cannot quietly become a beanstalk nobody can start.
   */
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
  /* The cave band: a sealed room under the warp pipe.
   *
   * **The exit hangs from the ceiling**, because the way out of here is up and
   * the direction you travel has to match the mouth you enter (`tryWarp`). It
   * used to stand on the floor and be pressed *up* on, which is the genre's
   * rule backwards — you would be climbing in through the capped end.
   *
   * Row 9 is not a taste: the mouth's lower lip has to be within a body-height
   * of the floor at row 13 and still clear the head of the tallest power level
   * (21x43 px, so three tile rows). Three empty rows — 10, 11, 12 — is the one
   * height that both admits the biggest body and stays in reach of the
   * smallest. See `WARP_UP_REACH` in `src/scenes/level.js`.
   *
   * The exit also sits where the *surface* above it is clear, not where it
   * looks tidiest down here: a brick row on the surface two columns over is
   * enough to make the warp refuse, and the biggest player would be sealed in a
   * bonus room with no way out. */
  cave_room: ck(32, {
    5: ' XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    6: ' X                        {}  X',
    7: ' X                        {}  X',
    8: ' X                        {}  X',
    9: ' X        ?B!B?           ()  X',
    10: ' X                            X',
    11: ' X        oooooooooo          X',
    12: ' X        oooooooooo          X',
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
};
