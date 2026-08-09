/**
 * World 3 — ice. The chunk playlists look much like world 2's on paper; what
 * makes them harder is the floor, so the levels here are laid out with more
 * room to stop than the tile count suggests they need.
 */

export const WORLD3_LEVELS = {
  '3-1': {
    theme: 'ice', bg: 'peaks', music: 'level',
    chunks: [
      'start', 'spike_walk', 'power', 'walkers', 'pit_s', 'qrow',
      'flyer', 'plat_hi', 'shell', 'pit_l', 'heartburn_pair', 'pit_twin',
      'spikes', 'cork_gap', 'sky_run', 'pit_plat', 'power_hi', 'plat_steps',
      'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  '3-2': {
    theme: 'ice', bg: 'peaks', music: 'level',
    chunks: [
      'start_high', 'sky_run', 'power', 'plat_steps', 'flyer', 'pit_l',
      'clouds', 'switch_wall', 'cloud_run', 'pit_bridge', 'shell', 'plat_float',
      'spikes', 'flyer', 'pit_plat', 'heartburn_pair', 'corks', 'walkers',
      'ledge', 'power', 'run_up', 'goal', 'goal_end',
    ],
  },
  '3-3': {
    theme: 'ice', bg: 'peaks', music: 'level',
    chunks: [
      'start', 'flat', 'power', 'lava_gap', 'walkers', 'plat_steps',
      'shell', 'lava_wide', 'clouds', 'cork_gap', 'heartburn_pair', 'pipe_plant',
      'lava_gap', 'sky_run', 'corks', 'brick_wall', 'pit_l', 'plat_float',
      'power_hi', 'steps_up', 'run_up', 'goal', 'goal_end',
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
