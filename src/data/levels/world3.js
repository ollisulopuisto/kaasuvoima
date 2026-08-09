/**
 * World 3 — ice. The chunk playlists look much like world 2's on paper; what
 * makes them harder is the floor, so the levels here are laid out with more
 * room to stop than the tile count suggests they need.
 *
 * The world's three optional mechanics are one per level on purpose, and which
 * one went where is a claim about the level rather than about the mechanic:
 *
 *   3-1  the star, because the opener is where a reward should be unmissable
 *   3-2  the hidden bands, because the breather is where curiosity is affordable
 *   3-3  the crumbling floor, because that is the level that is about the floor
 *
 * The switch in 3-2 was already here. That makes 3-2 the level with things to
 * find and 3-1/3-3 the levels with things to survive, which reads as an
 * editorial split rather than a pile — and it costs nothing on the curve,
 * because a switch and a secret are both optional and both score at or below
 * zero (see the numbers in the changelog entry).
 */

export const WORLD3_LEVELS = {
  /*
   * `ice_star` sits between the plain spike bed and `cork_gap`, and that order
   * is the point. The level teaches the spiky walker in chunk 2 on empty
   * ground, meets a spike bed unarmed at column 192, and only then hands over
   * the tool — and what follows the star is a gap with cork guys standing
   * either side of it. The star deletes the cork guys and does nothing at all
   * about the gap, which is the whole lesson: it is protection from the
   * inhabitants, never from the level.
   *
   * The pits are `ice_pit` and `ice_twin` and not the common `pit_s` and
   * `pit_twin`, which is the one thing about this level that was changed on
   * evidence rather than on taste. Correcting `tools/jump-budget.json`
   * (9.8.2026 — the file had claimed a 200 px running carry since the commit
   * that wrote it, measured 155) dropped the gap budget from eight tiles to
   * six, and the difficulty meter, which prices a gap as (span / budget)²,
   * then read this level at 204 against 3-2's 133 and 3-3's 174. **The
   * world's opening level was its hardest**, and the single reason was that
   * three of its gaps sat at or one tile under the budget: `pit_s` at six of
   * six, `pit_twin` at five and five with a two-tile island between them.
   *
   * That was true before the file was corrected — the stale number was hiding
   * it, not causing it. So the fix is the level and not the meter: 3-1 lost
   * the two gaps that had no argument for being that wide, and kept
   * `cork_gap`, which does have one (it is the star's lesson, above). Why the
   * gaps and not the enemies: the meter reads 3-1 as the world's *gentlest*
   * level for enemies (24.9 against 3-2's 36.7), so widening the difference
   * there would have flattened the level rather than shaped it.
   *
   * Deliberately not done: making 3-3 harder. It would have produced the same
   * "rises overall" verdict out of the same measurements, and would have been
   * tuning the number instead of the level.
   *
   * After: 3-1 162 → 3-2 133 → 3-3 174, which is the shape the world was
   * always supposed to have.
   */
  '3-1': {
    theme: 'ice', bg: 'peaks', music: 'level',
    chunks: [
      'start', 'spike_walk', 'power', 'walkers', 'ice_pit', 'qrow',
      'flyer', 'plat_hi', 'shell', 'pit_l', 'heartburn_pair', 'ice_twin',
      'spikes', 'ice_star', 'cork_gap', 'sky_run', 'pit_plat', 'power_hi',
      'plat_steps', 'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * World 3's hidden level, and the only one in the world: a discovery stops
   * being a discovery if there is one in every corner. The beanstalk at column
   * 112 climbs into the sky band, the warp pipe at column 228 drops into the
   * cave band, and neither is on the way to the flag — the ground route is
   * exactly the level it was before, one chunk of coins and one pipe longer.
   *
   * The cave room's exit pipe lands at columns 254-255, which is the middle of
   * a `flyer` chunk: bare floor, nothing overhead for eleven rows. That is a
   * measurement and not a coincidence — the biggest power level is 21x43 px, so
   * a brick two columns over on the *surface* would be enough for the warp to
   * refuse and seal the largest player into the bonus room.
   *
   * Why this level and not 3-1 or 3-3: 3-2 is the world's deliberate dip, and a
   * hidden area needs a player with attention to spare. Somewhere the level is
   * already pressing is where a secret goes unfound.
   */
  '3-2': {
    theme: 'ice', bg: 'peaks', music: 'level',
    chunks: [
      'start_high', 'sky_run', 'power', 'plat_steps', 'flyer', 'pit_l',
      'clouds', 'beanstalk', 'switch_wall', 'cloud_run', 'pit_bridge', 'shell',
      'plat_float', 'spikes', 'warp_pipe', 'flyer', 'pit_plat', 'heartburn_pair',
      'corks', 'walkers', 'ledge', 'power', 'run_up', 'goal', 'goal_end',
    ],
    sky: [[112, 'sky_garden']],
    cave: [[228, 'cave_room']],
  },
  /*
   * `ice_crumble` goes between `corks` and `brick_wall`, and both neighbours
   * were chosen rather than accepted. `corks` is flat, so the player arrives at
   * whatever speed they like and the catwalk (columns 244-252) is the first
   * thing that is not ground. `brick_wall` is what the run-off empties into,
   * and it opens with six tiles of floor and then a stack of bricks — because
   * the one way to spend twelve tiles of run-off and still be moving is to jump
   * off the end at P-speed, which carries 245 px, and the thing waiting fifteen
   * tiles away had better be a wall you bump into rather than a hole you fall
   * down. The chunk's own run-off already covers letting go (measured: rest at
   * column 262, run-off ends at 264); this is the belt for the braces.
   */
  /*
   * KURNUTTAJA, TOINEN JA VIIMEINEN KOKO PELISSÄ.
   *
   * `pit_l` becomes `pit_croak`, and it swaps places with `plat_float` so that
   * the occupied hole comes *after* a flat chunk instead of directly after the
   * brick wall. 2-1 introduces the creature in the one place a bare pit already
   * stood; this is the second and last one in the game, because a hazard that
   * turns up in every hole stops being a hazard and becomes terrain — and
   * terrain is something a player looks at once.
   *
   * Why 3-3 and not 3-1 or 3-2: this is world 3's last level and its measured
   * peak, and the other two already carry the world's own new ideas (3-1 the
   * star, 3-2 the hidden bands and the switch). 3-1's long comment above also
   * explains why that level was deliberately *softened*, which settles it.
   *
   * THE REORDER IS THE INTERESTING PART, and it was found by the tools rather
   * than by looking. Left where `pit_l` was, the chunk before this one is
   * `brick_wall`: a four-tile stack you clear with a full sixteen-frame hold
   * and come down off with the run spent. `pit_l` survived that because it
   * carries a stepping stone; a bare hole did not, and `tools/playable.mjs`
   * drowned in it at power level 0 — a level the smallest size cannot pass is
   * broken rather than hard (DESIGN.md §5). Widening or narrowing the hole was
   * the wrong lever, because the fault was the *approach*: what this chunk
   * needs is ground to build speed on, and `plat_float` is sixteen tiles of
   * exactly that. Both chunks are still here and the level is the same length.
   *
   * Measured after: 174.3 -> 186.5, and the world's shape is unchanged at
   * 162 -> 133 -> 187, still one dip. Most of that rise is the lost stepping
   * stone rather than the creature — `tools/difficulty.mjs` prices a plank over
   * a pit and cannot tell "a different pit" from "a harder one".
   */
  '3-3': {
    theme: 'ice', bg: 'peaks', music: 'level',
    chunks: [
      'start', 'flat', 'power', 'lava_gap', 'walkers', 'plat_steps',
      'shell', 'lava_wide', 'clouds', 'cork_gap', 'heartburn_pair', 'pipe_plant',
      'lava_gap', 'sky_run', 'corks', 'ice_crumble', 'brick_wall', 'plat_float',
      'pit_croak', 'power_hi', 'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  '3-F': {
    theme: 'fortress', bg: 'none', music: 'fortress', boss: true, bossVariant: 2,
    chunks: [
      'start', 'fort_hall', 'fort_power', 'fort_pillars', 'fort_gap', 'fort_spikes',
      'fort_blocks', 'fort_gap', 'fort_spikes', 'fort_pillars', 'fort_spikes', 'boss_arena',
    ],
  },
};
