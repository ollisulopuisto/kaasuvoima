/**
 * World 1 — the grass world, and the only one that has to teach. Every level
 * here is short on ideas by design: one new thing at a time, on ground with
 * nothing to fall into.
 */

export const WORLD1_LEVELS = {
  '1-1': {
    theme: 'grass', bg: 'hills', music: 'level',
    chunks: [
      'start', 'flat', 'power', 'walker', 'qrow', 'coins',
      'walker', 'pipe_short', 'flat', 'power', 'pit_s', 'plat_hi',
      'walkers', 'pipe_tall', 'coin_stack', 'pit_plat', 'shell', 'steps_up',
      'flat', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * World 1's hidden level, and the only one in the world: a discovery stops
   * being a discovery if there is one in every corner. The beanstalk at column
   * 150 climbs into the sky band, the pipe at column 229 drops into the cave
   * band, and neither is on the way to the flag — the ground route is exactly
   * the level it was before.
   */
  '1-2': {
    theme: 'grass', bg: 'hills', music: 'level',
    chunks: [
      'start', 'flat', 'power', 'plat_float', 'pit_s', 'note_pair',
      'walkers', 'brick_wall', 'pit_plat', 'beanstalk', 'pipe_plant', 'pit_bridge',
      'flyer', 'plat_steps', 'warp_pipe', 'power_hi', 'clouds', 'pit_l',
      'ledge', 'shell', 'sky_run', 'steps_down', 'run_up', 'goal', 'goal_end',
    ],
    sky: [[144, 'sky_garden']],
    cave: [[224, 'cave_room']],
  },
  '1-3': {
    theme: 'grass', bg: 'peaks', music: 'level',
    chunks: [
      'start_high', 'plat_hi', 'power', 'sky_run', 'coins', 'flyer',
      'pit_plat', 'plat_steps', 'walkers', 'pipe_pair', 'bricks', 'pit_l',
      'star_block', 'corks', 'shell', 'coin_stack', 'spikes', 'steps_up', 'clouds',
      'power', 'run_up', 'goal', 'goal_end',
    ],
  },
  '1-F': {
    theme: 'fortress', bg: 'none', music: 'fortress', boss: true, bossVariant: 0,
    chunks: [
      'start', 'fort_hall', 'fort_power', 'fort_blocks', 'fort_gap', 'fort_spikes',
      'fort_pillars', 'fort_hall', 'fort_gap', 'boss_arena',
    ],
  },
};
