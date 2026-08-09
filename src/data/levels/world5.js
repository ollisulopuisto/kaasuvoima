/**
 * World 5 — the bonus world, and the only one that is mostly not written by
 * hand. It keeps the generated levels and the rematch in the same file because
 * the order matters: the generated three have to land before 5-F for the world
 * map to run the right way round.
 */

import { GENERATED_LEVELS } from '../generated.js';

export const WORLD5_LEVELS = {
  // World 5 is the statistics-driven bonus world; 5-1..5-3 come out of
  // tools/gen-levels.mjs, the rematch arena is hand-built like the others.
  ...GENERATED_LEVELS,
  /*
   * The rematch, and the last thing in the game. World 5's numbered levels are
   * generated and their difficulty is the generator's to set, so this is the
   * one place the world can be given a peak by hand — and it is spent on
   * trenches rather than on more enemies, because at this point the player has
   * seen every enemy and none of them is news.
   */
  '5-F': {
    theme: 'fortress', bg: 'none', music: 'fortress', boss: true, bossVariant: 3,
    chunks: [
      'start', 'fort_hall', 'fort_power', 'fort_trench', 'fort_spikes', 'fort_burn',
      'fort_gap', 'fort_trench', 'fort_burn', 'fort_spikes', 'boss_arena_big',
    ],
  },
};
