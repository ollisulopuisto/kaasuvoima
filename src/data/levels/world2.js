/**
 * World 2 — the desert, and the first world that branches: 2-N sits off the
 * direct route, so anything unkind can go there instead of on the main line.
 */

export const WORLD2_LEVELS = {
  /*
   * The two open desert levels are shot in Cinemascope. It is the one place in
   * the game where the picture is nothing but sky, dunes and distance, which is
   * the only thing a wider frame is actually good for — and the same bars over
   * a fortress corridor would just be a smaller fortress corridor.
   */
  '2-1': {
    theme: 'desert', bg: 'dunes', music: 'level', letterbox: true,
    chunks: [
      'start', 'flat', 'power', 'walkers', 'sun', 'corks',
      'pipe_plant', 'pit_s', 'heartburn', 'coins', 'shell', 'plat_steps',
      'pit_l', 'flyer', 'bricks', 'ledge', 'pit_plat', 'corks',
      'power', 'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  '2-2': {
    theme: 'desert', bg: 'dunes', music: 'level',
    chunks: [
      'start', 'plat_float', 'power', 'sun', 'spikes', 'pit_twin',
      'walkers', 'sky_run', 'coin_stack', 'pit_bridge', 'clouds', 'brick_wall',
      'heartburn_pair', 'plat_hi', 'shell', 'pit_l', 'power_hi', 'walkers',
      'note_pair', 'steps_down', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * The desert world's night level: windy, and there is a moon to jump on.
   *
   * It is also the one level lit by a lamp. That is not a coin toss: it is
   * already night, so the darkness is the level agreeing with itself rather
   * than an effect laid over it; its theme asks for no other atmosphere, so
   * nothing is displaced; and it is off the direct route through world 2, so a
   * player who does not get on with it can go round. It stays out of world 1
   * on principle — the first world is where the game teaches, and a lesson in
   * the dark is not a lesson.
   *
   * The `heartburn` before the spike bridge is there for its *light*: a flame
   * is the brightest thing in the level and the only one that shows you ground
   * you are not standing on, so waiting one out buys you a look at what comes
   * next. It is the same chunk 2-1 and 2-2 already taught in daylight, and both
   * of them come before this one on the map — the flame is a tool here, never
   * the first lesson. Same sixteen columns and the same flat floor as the
   * `dune_night` it replaced, so the route through the level is unchanged.
   */
  '2-N': {
    theme: 'night', bg: 'dunes', music: 'level', wind: true, spotlight: true,
    chunks: [
      'start', 'flat', 'power', 'dune_night', 'walkers', 'pit_s',
      'moon_night', 'coins', 'shell', 'plat_steps', 'pit_l', 'corks',
      'heartburn', 'spike_bridge', 'flyer', 'pit_plat', 'shell', 'steps_up',
      'run_up', 'goal', 'goal_end',
    ],
  },
  '2-3': {
    theme: 'desert', bg: 'peaks', music: 'level', letterbox: true,
    chunks: [
      'start', 'flat', 'power', 'walkers', 'lava_gap', 'walker',
      'plat_steps', 'flyer', 'pipe_plant', 'lava_wide', 'lava_gap', 'soup_stop',
      'sky_run', 'cork_gap', 'heartburn', 'plat_float', 'walkers', 'power',
      'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  '2-F': {
    theme: 'fortress', bg: 'none', music: 'fortress', boss: true, bossVariant: 1,
    chunks: [
      'start', 'fort_hall', 'fort_power', 'fort_spikes', 'fort_gap', 'fort_blocks',
      'fort_pillars', 'fort_spikes', 'fort_gap', 'fort_pillars', 'boss_arena',
    ],
  },
};
