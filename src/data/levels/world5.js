/**
 * World 5 — the bonus world, and the only one that is mostly not written by
 * hand. It keeps the generated levels and the rematch in the same file because
 * the order matters: the generated three have to land before 5-F for the world
 * map to run the right way round.
 */

import { GENERATED_LEVELS } from '../generated.js';

/*
 * Which of the generated levels belong to this world — and the filter is new.
 *
 * This file used to spread `GENERATED_LEVELS` whole, which was harmless while
 * world 5 was the only generated world and became wrong the moment it was not:
 * every generated level in the game was arriving here, so `1-4` and `3-4` were
 * defined twice and world 5 was quietly claiming ownership of eight levels that
 * belong to other worlds. It worked only because `levels.js` spreads world 1
 * first and an object key keeps the position of its first insertion — i.e. the
 * play order was right by accident, which is the kind of right that stops being
 * right when somebody reorders the imports.
 */
const generated = Object.fromEntries(Object.entries(GENERATED_LEVELS)
  .filter(([id]) => id.startsWith('5-')));

export const WORLD5_LEVELS = {
  // World 5 is the statistics-driven bonus world; 5-1..5-7 come out of
  // tools/gen-levels.mjs, the rematch arena is hand-built like the others.
  ...generated,
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
      'start', 'pyre_gate', 'pyre_hall', 'pyre_grate', 'pyre_hall', 'pyre_steps',
      'pyre_hall', 'pyre_trench', 'pyre_gate', 'pyre_hall', 'boss_arena_big',
    ],
  },
};
