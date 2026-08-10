/**
 * World 6 — luulaakso, the boneyard, and the world after the factory.
 *
 * The factory was indoors from the first tile to the last; this world is
 * outdoors from the first tile to the last, and the two are neighbours on
 * purpose. Coming out of a roofed world into a sky full of stars is the one
 * transition the game can make for free, and `chunks/bone.js` is built to
 * protect it: nothing in these three playlists has a ceiling over it.
 *
 * ## What each level is for, and what it measures
 *
 *   6-1  242,5  the graves: one hole shape, over and over, with everything else
 *               arranged around it
 *   6-2  147,5  the dip — teeth in the floor, blocks over it, and only two
 *               holes in the whole level
 *   6-3  271,5  the dance: eight holes and everything the world owns
 *   6-F  395,4  the crypt, and a boss made of the floor he is standing on
 *
 * World mean 264,2, which is +8,0 on world 5 — the smallest step on the curve,
 * and worth saying out loud rather than hiding. World 5's levels are generated
 * and short (205–245 columns) and the meter counts everything per hundred
 * columns, so world 5 sits higher on the scale than it does in the hand. A
 * hand-made world cannot out-score it without turning into a gauntlet.
 *
 * ## Where the difficulty comes from, and where it does not
 *
 * **More holes, never wider ones.** Every gap in this world is five tiles
 * against a measured budget of six, because `tools/playable.mjs`'s power-0 bot
 * — the design promise in DESIGN.md §5 made executable — is not reliable at
 * six. A world that bought its number with seven-tile gaps would score well and
 * fail the promise, which is the wrong trade in both directions.
 *
 * **And never more than two holes in a row.** Chaining three of them is exactly
 * where the bot falls in ("kuilu sarakkeessa 93"), because a landing is only as
 * good as the run-up it leaves and a standing jump carries 0 px sideways. Where
 * two holes have to sit close, `flat8` — eight columns of nothing — is the
 * cheapest breath the vocabulary has.
 *
 * The rest is people. `bone_dance` puts three walkers on empty ground at even
 * spacing and turns up in every level: a waltz is three beats and it repeats,
 * so is this, and it is the cheapest kind of difficulty for a player to read.
 */

import { GENERATED_LEVELS } from '../generated.js';

/** Which of the generated levels belong to this world — the file holds them all. */
const generated = Object.fromEntries(Object.entries(GENERATED_LEVELS)
  .filter(([id]) => id.startsWith('6-')));

export const WORLD6_LEVELS = {
  /*
   * The world opens on `bone_stones` rather than on the flag-side vocabulary,
   * because the first thing this world has to say is where you are. Headstones
   * are the cheapest sentence it has and they cost nothing to walk past.
   *
   * The hole is taught in the order it can be learned. `bone_grave` first — the
   * coin arc over it is the shape of the jump — then `bone_wisp`, which is the
   * same hole with something bobbing over it, then `bone_ribs`, which is the
   * same hole with a plank across it. One geometry, three readings, and by the
   * third the player is looking at what is *above* the hole rather than at the
   * hole.
   */
  '6-1': {
    theme: 'bone', bg: 'bones', music: 'bone',
    chunks: [
      'start', 'bone_stones', 'power', 'bone_grave', 'bone_wisp', 'bone_dance',
      'bone_spine', 'bone_marrow', 'bone_wisp', 'bone_grave', 'bone_ribs',
      'bone_dance', 'bone_jaws', 'bone_marrow', 'bone_grave', 'bone_wisp',
      'bone_dance', 'bone_ridge', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * The dip, and it is bought the way every dip in this game is bought: by
   * taking the holes out rather than the inhabitants. Two graves in the whole
   * level against 6-1's five, and what fills the space is `bone_jaws` — teeth
   * standing in the floor, which cost a power level and not a life.
   *
   * That is what a breather is allowed to be in the *last* world. Measured, it
   * is 147,5 against 242,5 and 271,5 either side of it, and almost all of the
   * difference is gaps: 48 against 124 and 151. The enemies barely move (66
   * against 82 and 75), which is the point — the level is not emptier, it is
   * survivable.
   *
   * It is 6-2 rather than 6-1 or 6-3 for the same reason 4-2 is: the breather
   * is where curiosity is affordable.
   */
  '6-2': {
    theme: 'bone', bg: 'bones', music: 'bone',
    chunks: [
      'start', 'bone_stones', 'power', 'bone_jaws', 'bone_dance', 'bone_marrow',
      'bone_grave', 'bone_dance', 'bone_coffins', 'bone_marrow', 'bone_jaws',
      'bone_dance', 'bone_grave', 'bone_stones', 'bone_ridge', 'run_up',
      'goal', 'goal_end',
    ],
  },
  /*
   * The peak, and it is eight holes. Every one of them is the same five tiles;
   * what changes is what is over them and what is between them.
   *
   * The two `flat8`s are the level's whole pacing, and they are eight columns
   * of absolutely nothing. Both sit where three holes would otherwise have run
   * together, which is the one arrangement measured to break the promise
   * ("kuilu sarakkeessa 93" at power level 0). A breath is cheaper than a
   * sixteen-column chunk and it is what the geometry actually needs — the run-up
   * is the resource, not the ground.
   */
  '6-3': {
    theme: 'bone', bg: 'bones', music: 'bone',
    chunks: [
      'start', 'bone_dance', 'power', 'bone_grave', 'bone_wisp', 'flat8',
      'bone_grave', 'bone_marrow', 'bone_jaws', 'bone_grave', 'bone_wisp',
      'flat8', 'bone_grave', 'bone_ribs', 'bone_stones', 'bone_jaws',
      'bone_marrow', 'bone_grave', 'bone_wisp', 'bone_dance', 'bone_ridge',
      'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * The crypt. `bg: 'none'` is the fortress room, drawn in the bone palette —
   * the same torch-lit hall every world ends in, in ivory and grave earth — and
   * the corridors are the shared `fort_*` pieces, because a fortress is the one
   * level type that repeats unchanged across worlds and this one has no reason
   * to be the exception.
   *
   * `music: 'bone'` and not `'fortress'`, and that is the one deliberate break
   * from the pattern. The engine plays the `boss` track until the fight is over,
   * so what this line actually decides is what plays *after* he falls — and
   * after the skeleton falls, the dance should come back. The joke in the piece
   * is that the dancing stops at dawn, not that it ends.
   *
   * **Four `fort_gap`s and no `fort_trench`**, and both halves of that are
   * measured rather than chosen. The trench is nine tiles of lava with one plank
   * in the middle, and it is where the power-0 bot gives up in 5-F ("VAATII
   * TUPLAHYPYN", maasto sarakkeessa 67) — 6-F did exactly the same until it came
   * out. `fort_gap` is six tiles of open lava with nothing over it: harder to
   * read, easier to cross, and the meter agrees with the hands for once, because
   * a hole with a plank over it scores no gap risk at all while a bare one
   * scores the maximum. Four of them are most of why this is the hardest level
   * in the game at 395,4.
   */
  /* `6-4`…`6-7`, generated; the spread's position is the play order. */
  ...generated,
  '6-F': {
    theme: 'bone', bg: 'none', music: 'bone', boss: true, bossVariant: 4,
    chunks: [
      'start', 'fort_power', 'fort_gap', 'fort_spikes', 'fort_gap', 'fort_burn',
      'fort_gap', 'fort_blocks', 'fort_gap', 'fort_pillars', 'boss_arena',
    ],
  },
};
