/**
 * World 7's chunks — kaasukehä, the atmosphere, and the world made of the one
 * material this engine has always drawn but never stood on.
 *
 * ## The question this file exists to answer
 *
 * A world made of clouds is a pit for its entire length, unless somebody
 * decides otherwise on purpose. DESIGN.md §5 is not negotiable — the ground
 * route opens at power level 0 — and `tools/playable.mjs` runs that promise, so
 * "there is no floor, it is all islands" is not a bold design, it is a world
 * nobody finishes. The decision is therefore made once, here, and everything
 * else in the file follows from it:
 *
 *   **cloud that has been packed by its own weight is ground.**
 *
 * The floor of kaasukehä is ordinary `#`. It is the same tile world 1 is built
 * from, it carries the same promise, and `THEMES.cloud` paints it as the sunlit
 * top of a cloud bank rather than as dirt. Holes in it are holes in the cloud —
 * they kill the way every hole in this game kills, because a hole in the sky
 * and a hole in the ground are the same thing to a player and inventing a
 * second grammar for falling would teach nothing.
 *
 * ## Two rules, and they are the luumaailma rules turned over
 *
 * `chunks/bone.js` justifies itself in one sentence — *bone stands* — so its
 * vertical interest grows out of the floor as spines, headstones and ridges.
 * Cloud is by definition the thing that does **not** hold itself up, so:
 *
 *   1. **Nothing stands.** There is not one `#` or `X` above the floor rows in
 *      this file. No hills, no stairs, no ledges: the whole `steps_up` /
 *      `ledge` half of the shared vocabulary is unusable here, and height has
 *      to be bought with planks and floating blocks. That is a real cost and it
 *      is the point — it forces this world's silhouette to differ from every
 *      world before it, which is the job the cancelled per-theme tile shapes
 *      (ROADMAP ✘ 9.8.2026) were going to do and now cannot.
 *
 *   2. **Thin cloud is never over nothing.** Every `-` in this file has packed
 *      cloud somewhere below it in its own column. The semi-solid plank has
 *      been in the game from the start and it carries one trap that has always
 *      been tolerable because planks were rare: hold down and you drop through,
 *      and if there is nothing underneath, you drop into a pit you did not ask
 *      for. A world whose entire vertical vocabulary is planks multiplies that
 *      trap by fifty, so this world removes it by construction instead of
 *      warning about it.
 *
 * Rule 2 costs something too, and the cost is worth stating because it is the
 * whole difference between this world and world 6: **no plank in kaasukehä
 * bridges a hole.** Everywhere else in the game a plank over a pit is a good
 * answer (`pit_l`, `sky_run`, `bone_ribs`), and the difficulty meter agrees —
 * a bridged hole scores no gap risk at all. Here every hole is jumped. Both
 * halves of both rules are asserted in `verify.mjs`, including the count of
 * hanging planks in the rest of the game, because a rule that forbids nothing
 * is not a rule.
 *
 * ## What that leaves the world to be hard with
 *
 * Holes, weather and height. Holes are four or five tiles against a measured
 * budget of six, exactly as in luulaakso and for the same measured reason — the
 * power-0 bot is not reliable at six, and a standing jump carries **0 px**
 * sideways (`tools/jump-budget.json`), so a landing is only as good as the
 * run-up it leaves. Nothing is ever placed on the run-up side of a hole.
 *
 * The weather is the world's own joke and it costs nothing to write: this game
 * has had an enemy that *is* a cloud since world 1. The ruskea pilvi (`r`) is a
 * visitor everywhere else and a native here.
 *
 * And height is what the decks are for. Kaasukehä is layered rather than long,
 * which is the one thing the ground pound (v26.08.09.31) has never had room
 * for: its strength is normalised against the level's own ceiling, so a dive
 * from `cloud_anvil`'s roof lands lethal and the same dive from a standing jump
 * does not. Measured in `verify.mjs`, both ways round. It is never required —
 * the bot that proves the ground route does not know the move exists.
 *
 * ## What is deliberately NOT here
 *
 * A beanstalk, and a sky band. Every tall level in the game hides its secret
 * *above* the world, and the rhetoric of that secret is the climb out. There is
 * no out of this world upward: the sky band in a sky world would be the same
 * room twice, and it would spend the one secret this game has that a player
 * has to be told about by the level rather than by a coin.
 *
 * Pits, flats and the goal are `common.js`'s, as always. A cloud-coloured copy
 * of `flat8` would be five places to fix and would say nothing new.
 */

import { ck, G } from './common.js';

export const CLOUD_CHUNKS = {
  /**
   * Pilviranta, and the sentence the world opens with: a deck of thin cloud
   * over an unbroken floor of packed cloud.
   *
   * Everything this world is, is in this one chunk. There are two heights and
   * both of them are standable, the upper one is thin enough to fall through on
   * purpose, and there is nothing at all to fall *into*. A player who learns
   * only this has learned the grammar; the rest of the file is that grammar
   * with something at stake.
   *
   * The one walker is at the far end and there is nothing else, and that was
   * measured rather than composed. This chunk opens all three levels, and the
   * first version put three inhabitants in it: the noisy bot — the one that
   * plays with enemies switched on — got 4 % into 7-3 against 12–57 % everywhere
   * else in the game, which is what a difficulty spike in the first eight
   * seconds looks like from the outside. Emptying this one chunk moved the
   * three levels to 39/25/28 %.
   */
  cloud_bank: ck(16, {
    7: '     ooo',
    9: '    ----',
    12: '            g',
    13: G,
    14: G,
  }),

  /**
   * Reikä pilvessä: viisi ruutua ja kolikkokaari sen yli.
   *
   * Five against a measured budget of six, and **nothing whatsoever on the
   * run-up side**. Both numbers are luulaakson, inherited rather than
   * rediscovered: world 6 measured three separate falls into a hole whose lip
   * had a headstone two tiles before it, because a body two tiles up reads as a
   * wall, the jump starts early, lands on the obstacle and goes into the hole
   * from a standstill — where the jump carries 0 px sideways.
   *
   * So the coin arc is the only thing that marks this, which is what this game
   * marks jumps with, and it starts over the lip rather than before it.
   */
  cloud_hole: ck(16, {
    9: '         o o o',
    12: '               k',
    13: '#########     ##',
    14: '#########     ##',
  }),

  /**
   * Sama reikä, ja sen yllä pilvi joka on ruskea.
   *
   * Column for column the same floor as `cloud_hole` — nine of run-up, five of
   * hole, two of landing — and that is not laziness but the profile this
   * world's holes are cut to, so two of them can stand next to each other in a
   * playlist and the second still gets its run-up.
   *
   * What is over it is the joke this world was built to be able to make. The
   * ruskea pilvi has drifted through every world since world 1 as something
   * from somewhere else; here it is a local, and the one place a local can be
   * put where being shoved sideways costs a life rather than a power level is
   * over a hole in the floor.
   */
  cloud_hole_wisp: ck(16, {
    6: '           r',
    9: '         o o o',
    12: '  g',
    13: '#########     ##',
    14: '#########     ##',
  }),

  /**
   * Sama reikä yhtä ruutua kapeampana, ja sitä ennen kansi.
   *
   * The deck is on the **run-up side**, which is the one place world 6 proved
   * nothing may stand — and it is allowed here precisely because a plank is not
   * a wall. `tools/playable.mjs`'s bot reads solidity, and a semi-solid is not
   * solid, so a deck at row 7 is invisible to it and to the jump it plans. That
   * is the useful half of the semi-solid: it can be scenery for the feet on the
   * floor and a floor for the feet above it, in the same column.
   */
  cloud_hole_deck: ck(16, {
    5: '   ooo',
    7: '  ----',
    9: '          o o',
    12: '       g       k',
    13: '##########    ##',
    14: '##########    ##',
  }),

  /**
   * Rakeita: kaksi raekenttää lattiassa ja kansi ensimmäisen yli.
   *
   * This is the world's cheap lethal-adjacent difficulty, and it is the shape
   * luulaakso measured rather than a new one: **two beds of four rather than
   * one of eight, bridged over only the first.** The bot reads a spike bed as
   * one obstacle and holds a jump proportional to its width, so eight tiles of
   * hail is a ten-tile hop against a 155 px running carry; and a five-wide bed
   * under a full-width bridge is what broke 6-3, because the bridge is where it
   * lands and the bed is where the bridge ends.
   *
   * A brown cloud hangs over the far bed. It may not be put on the ground
   * (DESIGN.md §6 — it bobs around its spawn height and would sink into the
   * floor), and here that constraint is the placement: what it is doing is
   * pushing you sideways over the one part of the floor that bites.
   */
  cloud_hail: ck(16, {
    6: '           r',
    8: '    ooo',
    9: '  -------',
    12: '   ^^^^   ^^^^g',
    13: G,
    14: G,
  }),

  /**
   * Puuska. Kaksi ruskeaa pilveä, ei mitään muuta.
   *
   * The world's `bone_dance`: no gap, no hazard, no aim, and therefore the one
   * kind of difficulty that can be used generously without the world becoming a
   * gauntlet. It is also the joke this world was owed — the ruskea pilvi has
   * been drifting through every other world as a visitor since world 1, and
   * this is the one place where a brown cloud among the white ones is simply a
   * local.
   */
  cloud_squall: ck(16, {
    4: '    ooo',
    6: '   -----',
    8: '          r',
    10: '   r',
    12: '       g',
    13: G,
    14: G,
  }),

  /**
   * Nousuvirtaus: kolme askelmaa ylös ja lohko huipulla.
   *
   * Every rise is 64 px — four tiles — against a measured standing jump of 71,
   * so the climb is inside the power-0 budget at every step and needs no run-up
   * on a deck that has none to give. That is the arithmetic that makes a
   * plank-only world climbable at all: with `X` forbidden by rule 1 there are
   * no stairs, so every step has to be a jump the smallest size can make from
   * standing.
   *
   * There is a block at the top, and DESIGN.md §5 is why: a climb that leads to
   * nothing teaches the player to stop climbing, and one empty climb is enough
   * to lose every later one. The coins under the upper deck are the same rule
   * from underneath — they are what pressing down is *for*.
   */
  cloud_updraft: ck(16, {
    4: '        ?',
    6: '      ----',
    7: '     ooo',
    8: '   r',
    9: '   ooo',
    10: '  -----',
    12: '             g',
    13: G,
    14: G,
  }),

  /**
   * Alasin, eli ukkospilven laki — tämän maailman katto, ja se ainoa paikka
   * jossa maahaniskulla on koko pudotus käytettävissään.
   *
   * The roof is at row 5 and it is the highest plank in the world. That is not
   * decoration: `poundScale` normalises the dive against the level's own
   * ceiling, so what the anvil actually buys is a fall long enough for the
   * impact to be lethal — measured at 0,67 against POUND_KILL_AT's 0,5, where
   * the same move begun at the top of a standing jump off the floor measures
   * 0,37 and only knocks things over. Both numbers are in `verify.mjs`, taken
   * from a running scene rather than from this comment.
   *
   * The three walkers underneath are the reason to bother, and the ground route
   * walks straight past all of it. **The move opens a place, not the level** —
   * the bot that proves this world at power 0 cannot ground pound and does not
   * need to.
   *
   * Both steps up are 64 px, like `cloud_updraft`'s, and the lower deck stops
   * at column 6 while the roof runs to column 11: stepping off the right-hand
   * end drops you the whole way to the floor, which is the shape the dive
   * needs and the shape the measurement finds.
   */
  cloud_anvil: ck(16, {
    3: '      ooooo',
    5: '     -------',
    8: '   oo',
    9: '  -----',
    12: '     g   g   g',
    13: G,
    14: G,
  }),

  /** Tämän maailman lohkorivi. Hautamullan sijaan ukkospilveä, ja kuori
   *  aukeaa kolikoiksi kuten kaikkialla muualla. */
  cloud_blocks: ck(16, {
    6: '            oo',
    8: '           ---',
    9: '   BB?BB',
    12: '   g    k    g',
    13: G,
    14: G,
  }),

  /**
   * Ukkospää: pino ukkospilveä ilmassa, ja lohko sen päällä.
   *
   * Three rows of air under it and not two. That is the tallest power level's
   * headroom (`HEAD` in rules.js, 43 px of body against 48 px of air), and it
   * is the constraint that decides where every floating block in this world
   * sits: rows 10, 11 and 12 belong to whoever is walking underneath, so the
   * bump row is row 9 here exactly as it is everywhere else in the game.
   *
   * The stack is `B` and not `X` for the obvious reason and one less obvious
   * one. Rule 1 forbids `X` above the floor at all — but even without it, a
   * storm cloud that shrugged off a running body would be the one thing in this
   * world that behaves like rock, and the material of this world is the thing
   * that gives.
   */
  cloud_gate: ck(16, {
    5: '   ooo',
    6: '      B?B',
    7: '  -----',
    8: '      BBB',
    9: '      BBB',
    12: '    g    k  g',
    13: G,
    14: G,
  }),

  /** Parvi. Kaksi lentäjää siinä korkeudessa jossa hyppy on jo sitoutunut, ja
   *  yksi kävelijä alla — ilmassa oleva vihollinen on kalliimpi kuin maassa
   *  oleva juuri siksi ettei sitä voi juosta karkuun sitä reittiä jota tässä
   *  pelissä juostaan, ja kävelijä on se joka pakottaa valitsemaan kummalle
   *  puolelle laskeutuu. */
  cloud_flock: ck(16, {
    7: '    f       f',
    12: '  g',
    13: G,
    14: G,
  }),

  /**
   * Ristikko: pitkä ohut kansi ja raekenttä sen alla.
   *
   * This is the chunk that gives pressing down a consequence, and it is the
   * honest limit of rule 2 written into the level data. The rule guarantees
   * that dropping through a cloud in this world can never *kill* you, because
   * there is always cloud below. It does not guarantee that the cloud below is
   * somewhere you wanted to be. Here it is hail, and the price of a careless
   * drop is a power level — which is the same price this game charges for every
   * other careless landing.
   *
   * Three tiles of hail and not five: the deck runs the full width, so the bed
   * is the thing the bridge ends over, and that is exactly the arrangement
   * luulaakso measured as a bot killer at five wide.
   */
  cloud_lattice: ck(16, {
    6: '      ooo',
    9: '  ------------',
    12: '  k    ^^^   g',
    13: G,
    14: G,
  }),
};
