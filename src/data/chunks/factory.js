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
  /**
   * Supertähti, tehtaan versio.
   *
   * The block sits on the ordinary bump row for the same reason world 1's does:
   * a star you have to climb for is a reward for climbing, and this one has to
   * be a reward for hitting a block that looks like every other block.
   *
   * What follows it is why the factory is where world 4's star belongs. The
   * heartburn jet cannot be stomped and the cork guy hops out of reach, so the
   * ordinary answer to both is "wait" — and the star is the one thing that
   * turns waiting into walking. Nothing here is a wall: the same twelve tiles
   * are perfectly passable without ever hitting the block.
   */
  fac_star: ck(16, {
    0: G,
    1: G,
    9: '   *',
    12: '        H   c',
    13: G,
    14: G,
  }),

  /**
   * Kytkin ja sen palkinto, tehtaan katon alla. The mechanic is 3-2's and so is
   * the silhouette, deliberately: the player learned in the ice world that a
   * button turns that slab into coins, and a factory-shaped button they have to
   * learn again would be a new mechanic wearing an old one's name. The world
   * changes the material — a roof over it and steel around it — not the shape.
   *
   * Everything `switch_wall` promises holds here. The floor under the slab is
   * `#` and never `B`, so the button cannot dissolve what you are standing on;
   * the slab is overhead and off the route, so you can walk the whole twenty
   * columns without touching either and lose nothing but coins.
   */
  fac_switch: ck(20, {
    0: G + '####',
    1: G + '####',
    5: '        BBBBBBBB',
    6: '        BBBBBBBB',
    7: '        BBBBBBBB',
    9: '  o  S',
    13: '####################',
    14: '####################',
  }),

  /* --------------------- salaisuudet: tehtaan putket -------------------- */

  /**
   * The factory's way into a hidden band, and the reason world 4 has no
   * beanstalk. A vine growing indoors is the hole in the roof this whole file
   * exists to avoid — and `drawVine` paints leaves and a bean in grass green
   * with no theme parameter at all, so it would be a hole in the roof with
   * foliage in it. A duct is what a factory has instead, and the warp pipe is
   * already exactly that tile: solid, enterable, and it goes to another band.
   *
   * **There are two of these, and which way each one goes is written on it.**
   * There used to be one chunk used twice, and the argument for that was that
   * nothing on either said which way it went — pressing the wrong way simply
   * did nothing. That argument is spent: `tryWarp` now asks that the direction
   * you travel matches the mouth you enter, so a duct going up has to hang from
   * the roof and a duct going down has to stand on the floor. The honest
   * replacement for the old idea is that **a duct in the ceiling and a duct in
   * the floor are already two different things to look at** — the player learns
   * to read them instead of learning that pipes are ambiguous, and that is the
   * better lesson anyway.
   *
   * The three coins on the bump row are the whole hint, in both. They are worth
   * having on their own, so following them costs nothing if there turns out to
   * be nothing; that is the difference between a hint and a sign.
   *
   * Columns 11-14 are kept clear from the ceiling down: that is where both
   * rooms put their exit, and the tallest power level has to arrive there
   * standing up. See `fac_cellar`.
   */
  fac_duct_down: ck(16, {
    0: G,
    1: G,
    9: '  o o o',
    11: '     ()',
    12: '     {}',
    13: G,
    14: G,
  }),

  /**
   * The same duct, the other way up: it comes down out of the roof and stops
   * with its mouth over the floor, which is what you stand under and press up.
   *
   * Row 9 is the mouth and it is not a taste. The lower lip has to be within a
   * body-height of the floor at row 13 and still clear the head of the tallest
   * power level (21x43 px — three tile rows), so three empty rows under it is
   * the one height every size can use. See `WARP_UP_REACH` in
   * `src/scenes/level.js`, and `cave_room`, which is measured the same way.
   *
   * The coins move right rather than disappear: the hint is the same hint, and
   * putting them under the mouth would have made them a sign pointing at it.
   */
  fac_duct_up: ck(16, {
    0: G,
    1: G,
    2: '     {}',
    3: '     {}',
    4: '     {}',
    5: '     {}',
    6: '     {}',
    7: '     {}',
    8: '     {}',
    9: '     ()  o o o',
    13: G,
    14: G,
  }),

  /**
   * The cave band under a factory: the space below the floor plates where the
   * coins the machines drop have been piling up.
   *
   * Read the geometry against the tallest power level (21x43 px — three tiles
   * wide, nearly three tall), because **nothing validates these bands**:
   * `rules.js` only checks the band the player starts in, so a ceiling too low
   * in here is a bug no tool will report.
   *
   *   - you arrive at columns 4-7 (the duct's pipe is at its columns 5-6, and
   *     a warp keeps your x), so rows 8-10 are empty there — the blocks start
   *     at column 8
   *   - you leave from the mouth at columns 12-13, standing on the floor under
   *     it in rows 10-12, so those three rows are empty from column 11
   *     rightwards too
   *   - the ceiling is at row 5 and the floor at 13, so standing on the blocks
   *     at row 9 leaves rows 6-8 free
   *
   * **The way out hangs from the ceiling and is pressed up on from the floor.**
   * It used to stand on the floor and be pressed up on from on top of it, which
   * is entering a pipe through its capped end; `tryWarp` asks for the mouth to
   * face the way you are going. Row 9 is where it stops because three empty
   * rows are what the tallest power level needs to stand under it — the same
   * measurement `cave_room` and `fac_duct_up` are built to.
   *
   * `fac_duct_down` keeps the surface above these columns clear so the warp is
   * never refused. A bonus room you cannot leave is a trap, not a bonus.
   */
  fac_cellar: ck(16, {
    5: 'XXXXXXXXXXXXXXXX',
    6: 'X           {} X',
    7: 'X           {} X',
    8: 'X           {} X',
    9: 'X       ??? () X',
    10: 'X              X',
    11: 'X  ooooo       X',
    12: 'X  ooooo       X',
    13: '################',
    14: '################',
  }),

  /**
   * The sky band over a factory, and the answer to "what does up mean when the
   * level is indoors": **not the sky — the loft on top of the roof.**
   *
   * The room is sealed, and its floor is the factory's own roof: the route
   * band's ceiling rows sit directly under these two, so nothing here hangs in
   * the air. That is also why it is a room and not a walkway. An open deck
   * would let you run the length of the roof and drop back in wherever the
   * ceiling happens to break, which is a shortcut past the level rather than a
   * reward inside it.
   *
   * The one thing that reads as outdoors is the backdrop, and that is correct
   * here by accident of how `drawBackdrop` works: `bg: 'factory'` draws the
   * yard anchored to the bottom of the view and ignores the band offset
   * entirely, so the skyline, the stacks and the turning gears are the same
   * picture at this height as on the shop floor. A window this high up would
   * show exactly that.
   *
   * Same measurements as `fac_cellar`, for the same reason — arrival at
   * columns 4-7, departure from 12-13, ceiling at 5 and floor at 13.
   *
   * **Its exit did not have to move**, and that is worth saying out loud in the
   * round that moved the other three. The loft is the band *above* the route,
   * so leaving it is a journey downwards, and a pipe you stand on and press
   * down through is already the mouth facing the way you are going. The rule
   * that turned three exits upside down leaves this one exactly as it was.
   */
  fac_loft: ck(16, {
    5: 'XXXXXXXXXXXXXXXX',
    6: 'X              X',
    7: 'X              X',
    8: 'X              X',
    9: 'X       ?!?    X',
    10: 'X              X',
    11: 'X  ooooo       X',
    12: 'X           () X',
    13: '################',
    14: '################',
  }),
};
