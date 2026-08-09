/**
 * World 4 — the factory, which is indoors from the first tile to the last.
 * Every chunk in these playlists has a ceiling, so an open-air piece dropped in
 * here reads as a hole in the roof rather than as variety.
 */

export const WORLD4_LEVELS = {
  '4-1': {
    theme: 'factory', bg: 'factory', music: 'factory',
    chunks: [
      'start', 'fac_floor', 'fort_power', 'fac_press', 'fac_vents', 'corks',
      'fac_belt', 'cork_gap', 'fac_shaft', 'fac_gap', 'heartburn', 'fac_crumble',
      'fac_press', 'cloud_run', 'fac_vents', 'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  '4-2': {
    theme: 'factory', bg: 'factory', music: 'factory',
    chunks: [
      'start', 'fac_floor', 'fort_power', 'fac_belt', 'heartburn_pair', 'fac_shaft',
      'corks', 'fac_press', 'fac_floor', 'fac_gap', 'soup_stop', 'fac_vents',
      'fac_belt', 'clouds', 'fac_shaft', 'heartburn', 'steps_down', 'run_up',
      'goal', 'goal_end',
    ],
  },
  '4-3': {
    theme: 'factory', bg: 'factory', music: 'factory',
    chunks: [
      'start', 'spike_walk', 'fort_power', 'fac_vents', 'fac_belt', 'fac_shaft',
      'heartburn_pair', 'cloud_run', 'fac_gap', 'fac_press', 'corks', 'fac_belt',
      'heartburn', 'fac_shaft', 'cloud_run', 'fac_vents', 'cork_gap', 'steps_up',
      'run_up', 'goal', 'goal_end',
    ],
  },
  '4-F': {
    theme: 'factory', bg: 'factory', music: 'fortress', boss: true, bossVariant: 3,
    chunks: [
      'start', 'fac_floor', 'fort_power', 'fac_vents', 'fac_gap', 'fac_shaft',
      'fac_belt', 'fac_vents', 'boss_arena_big',
    ],
  },
};
