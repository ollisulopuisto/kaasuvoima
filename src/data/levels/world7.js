/**
 * World 7 — KAASUKEHÄ, the atmosphere, and the last world before the castle.
 *
 * ## The two things this world had to get right
 *
 * **It must not read as the bonus room, stretched.** The game has had a sky
 * since world 1: every tall level carries a hidden band above it, reached by a
 * beanstalk, and `sky_garden` is already a place made of planks in the air. A
 * whole world of clouds that felt like that would not merely be dull, it would
 * cheapen a secret that took real work to make findable.
 *
 * The difference is the floor, and it is measured rather than argued
 * (`verify.mjs`, "pilvimaailmassa on lattia, bonushuoneessa ei"). A bonus room
 * has no floor at all and everything you can stand on in it is a plank; these
 * three levels have packed cloud under nine columns in ten, and the planks are
 * a minority of the footing. In one sentence: **the sky band is somewhere you
 * hop, kaasukehä is somewhere you walk.** The second difference is what is
 * absent — there is no beanstalk and no sky band anywhere in this world,
 * because the whole rhetoric of that secret is climbing out above the world,
 * and there is nothing above this one.
 *
 * **And it must be passable at the smallest size, all the way down.** A world
 * of clouds is a pit for its whole length unless somebody decides otherwise;
 * `chunks/cloud.js` decides, in its first paragraph, that packed cloud is
 * ground. Everything below is built on ordinary `#`.
 *
 * ## What each level is for, and what it measures
 *
 *   7-1  the layers: two heights, nothing to fall into, then holes
 *   7-2  the dip — weather instead of holes
 *   7-3  the anvil: every hole the world owns, and the one place with a roof
 *   7-F  the keep, and the weather lord
 *
 * ## Where the difficulty comes from
 *
 * **Holes and height, never bridges.** Rule 2 in `chunks/cloud.js` — thin cloud
 * is never over nothing — means no plank in this world spans a hole, so every
 * one of them is jumped. That is the opposite trade from luulaakso's
 * `bone_ribs`, and it is why this world scores above world 6 without any hole
 * being wider: a bridged hole scores no gap risk at all, and there are no
 * bridged holes here.
 *
 * **And the decks are not free.** The difficulty meter charges for narrow
 * footing, which is exactly right for a world whose vertical vocabulary is
 * planks: every deck is a landing you have to aim. That term is this world's
 * signature the way gap risk was luulaakso's.
 *
 * Where two holes would otherwise run together, `flat8` — eight columns of
 * nothing — is the cheapest breath the vocabulary has. Never three in a row:
 * that is the arrangement world 6 measured as the one that breaks the promise,
 * because a landing is only as good as the run-up it leaves and a standing jump
 * carries 0 px sideways.
 */

import { GENERATED_LEVELS } from '../generated.js';

/** Which of the generated levels belong to this world — the file holds them all. */
const generated = Object.fromEntries(Object.entries(GENERATED_LEVELS)
  .filter(([id]) => id.startsWith('7-')));

export const WORLD7_LEVELS = {
  /*
   * The world opens on `cloud_bank`, which is the grammar with nothing at
   * stake: two standable heights, one of them thin enough to fall through, and
   * nothing at all to fall into. Only then a hole.
   *
   * `cloud_updraft` comes third because the climb is what makes this world
   * vertical rather than merely high, and it is worth teaching while the floor
   * underneath is still unbroken — a player who learns the four-tile step here
   * reads `cloud_anvil` in 7-3 without being told.
   */
  '7-1': {
    theme: 'cloud', bg: 'clouds', music: 'cloud',
    chunks: [
      'start', 'cloud_bank', 'power', 'cloud_hole', 'cloud_squall', 'cloud_updraft',
      'cloud_hole_wisp', 'cloud_blocks', 'cloud_hail', 'cloud_hole', 'cloud_bank',
      'cloud_hole_deck', 'cloud_gate', 'cloud_lattice', 'cloud_hole_wisp',
      'cloud_squall', 'cloud_hole', 'cloud_flock', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * The dip, bought the way every dip in this game is bought: by taking the
   * holes out and leaving the inhabitants in. Two holes against 7-1's four, and
   * what fills the space is weather — brown clouds and flyers, which cost a
   * power level and not a life.
   *
   * It is 7-2 and not 7-1 or 7-3 for the same reason 4-2 and 6-2 are: the
   * breather is where curiosity is affordable, and this is the level with the
   * most standing around under decks in it.
   */
  '7-2': {
    theme: 'cloud', bg: 'clouds', music: 'cloud',
    chunks: [
      'start', 'cloud_bank', 'power', 'cloud_lattice', 'cloud_squall', 'cloud_blocks',
      'cloud_hole', 'cloud_bank', 'cloud_gate', 'cloud_updraft', 'cloud_hail',
      'cloud_squall', 'cloud_flock', 'cloud_hole_deck', 'cloud_blocks',
      'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * The peak, and the only level in the world with a roof over part of it.
   *
   * `cloud_anvil` sits in the middle, where a player has already met every
   * piece it is made of: the four-tile step from `cloud_updraft`, the deck from
   * `cloud_bank`, the walkers from everywhere. What it adds is the one thing
   * this world has that no other world has — enough air above the floor for the
   * ground pound to land lethal — and it adds it as a place to go rather than a
   * thing to do, because the ground route walks underneath it and the bot that
   * proves this level at power 0 does exactly that.
   *
   * Both `flat8`s sit where three holes would otherwise have run together.
   */
  '7-3': {
    theme: 'cloud', bg: 'clouds', music: 'cloud',
    chunks: [
      'start', 'cloud_bank', 'power', 'cloud_hole', 'cloud_hole_deck', 'flat8',
      'cloud_hole_wisp', 'cloud_hail', 'cloud_anvil', 'cloud_hole', 'cloud_hole_deck',
      'flat8', 'cloud_hole_wisp', 'cloud_lattice', 'cloud_flock', 'cloud_hole',
      'cloud_squall', 'cloud_blocks', 'cloud_hole_deck', 'cloud_hole', 'cloud_gate',
      'cloud_updraft', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * The keep. `bg: 'none'` is the shared fortress room, drawn in the cloud
   * palette, and the corridors are the shared `fort_*` pieces like every other
   * world's fortress.
   *
   * That is a deliberate reversal and the one thing this level says: **a wall
   * is the one thing cloud cannot make.** Every other room in this world is
   * open on all six sides, so arriving somewhere with a ceiling and a floor and
   * two ends is arriving somewhere that was *built* — and what is holding the
   * weather down is not weather.
   *
   * **Five `fort_gap`s and no `fort_trench`**, both halves measured rather than
   * chosen. The trench is nine tiles of lava with one plank in the middle and it
   * is where the power-0 bot gives up in 5-F; `fort_gap` is six tiles of open
   * lava with nothing over it, harder to read and easier to cross, and the
   * meter agrees with the hands for once because a bridged hole scores no gap
   * risk while a bare one scores the maximum. None of the five is adjacent to
   * another.
   *
   * `music: 'cloud'` and not `'fortress'`, following 6-F: the engine plays the
   * `boss` track until the fight ends, so this line only decides what comes
   * back afterwards, and after the weather lord falls the weather should.
   */
  /* `7-4`…`7-7`, generated; the spread's position is the play order. */
  ...generated,
  '7-F': {
    theme: 'cloud', bg: 'none', music: 'cloud', boss: true, bossVariant: 5,
    chunks: [
      'start', 'fort_power', 'fort_gap', 'fort_blocks', 'fort_gap', 'fort_spikes',
      'fort_gap', 'fort_burn', 'fort_gap', 'fort_hall', 'fort_gap', 'fort_pillars',
      'boss_arena',
    ],
  },
};
