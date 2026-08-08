import { assemble } from './chunks.js';

/**
 * A level is a chunk playlist plus presentation data. `boss: true` means the
 * exit is the fortress door that opens once the boss is beaten.
 */
const LEVEL_DEFS = {
  '1-1': {
    theme: 'grass', bg: 'hills', music: 'level', time: 300,
    chunks: [
      'start', 'flat', 'walker', 'qrow', 'coins', 'walker',
      'pipe_short', 'flat', 'power', 'pit_s', 'plat_hi', 'walkers',
      'pipe_tall', 'coin_stack', 'pit_plat', 'shell', 'steps_up',
      'flat', 'run_up', 'goal', 'goal_end',
    ],
  },
  '1-2': {
    theme: 'grass', bg: 'hills', music: 'level', time: 300,
    chunks: [
      'start', 'flat', 'plat_float', 'pit_s', 'note_pair', 'walkers',
      'brick_wall', 'coins', 'pipe_plant', 'pit_bridge', 'flyer',
      'plat_steps', 'power_hi', 'walker', 'pit_l', 'ledge',
      'shell', 'sky_run', 'steps_down', 'run_up', 'goal', 'goal_end',
    ],
  },
  '1-3': {
    theme: 'grass', bg: 'peaks', music: 'level', time: 300,
    chunks: [
      'start_high', 'plat_hi', 'sky_run', 'coins', 'flyer', 'pit_plat',
      'plat_steps', 'walkers', 'pipe_pair', 'bricks', 'pit_l',
      'plat_float', 'shell', 'coin_stack', 'spikes', 'steps_up',
      'flyer', 'power', 'run_up', 'goal', 'goal_end',
    ],
  },
  '1-F': {
    theme: 'fortress', bg: 'none', music: 'fortress', time: 300, boss: true,
    chunks: [
      'start', 'fort_hall', 'fort_blocks', 'fort_gap', 'fort_spikes',
      'fort_pillars', 'fort_hall', 'fort_gap', 'boss_arena',
    ],
  },

  '2-1': {
    theme: 'desert', bg: 'dunes', music: 'level', time: 300,
    chunks: [
      'start', 'flat', 'walkers', 'qrow', 'pipe_plant', 'pit_s',
      'spikes', 'coins', 'shell', 'plat_steps', 'pit_l', 'flyer',
      'bricks', 'ledge', 'pit_plat', 'walkers', 'power', 'steps_up',
      'run_up', 'goal', 'goal_end',
    ],
  },
  '2-2': {
    theme: 'desert', bg: 'dunes', music: 'level', time: 300,
    chunks: [
      'start', 'plat_float', 'spikes', 'pipe_pair', 'walkers', 'sky_run',
      'coin_stack', 'pit_bridge', 'flyer', 'brick_wall', 'spikes',
      'plat_hi', 'shell', 'pit_l', 'power_hi', 'walkers', 'note_pair',
      'steps_down', 'run_up', 'goal', 'goal_end',
    ],
  },
  '2-3': {
    theme: 'desert', bg: 'peaks', music: 'level', time: 300,
    chunks: [
      'start', 'flat', 'lava_gap', 'walker', 'plat_steps', 'flyer',
      'pipe_plant', 'lava_wide', 'coins', 'shell', 'sky_run', 'bricks',
      'lava_gap', 'plat_float', 'walkers', 'power', 'steps_up',
      'run_up', 'goal', 'goal_end',
    ],
  },
  '2-F': {
    theme: 'fortress', bg: 'none', music: 'fortress', time: 300, boss: true,
    chunks: [
      'start', 'fort_hall', 'fort_spikes', 'fort_gap', 'fort_blocks',
      'fort_pillars', 'fort_spikes', 'fort_gap', 'fort_hall', 'boss_arena',
    ],
  },

  '3-1': {
    theme: 'ice', bg: 'peaks', music: 'level', time: 300,
    chunks: [
      'start', 'flat', 'walkers', 'pit_s', 'qrow', 'flyer', 'plat_hi',
      'shell', 'pit_l', 'coin_stack', 'pipe_tall', 'spikes', 'walkers',
      'sky_run', 'pit_plat', 'power_hi', 'plat_steps', 'steps_up',
      'run_up', 'goal', 'goal_end',
    ],
  },
  '3-2': {
    theme: 'ice', bg: 'peaks', music: 'level', time: 300,
    chunks: [
      'start_high', 'sky_run', 'plat_steps', 'flyer', 'pit_l', 'coins',
      'brick_wall', 'walkers', 'pit_bridge', 'shell', 'plat_float',
      'spikes', 'flyer', 'pit_plat', 'bricks', 'pipe_pair', 'walkers',
      'ledge', 'power', 'run_up', 'goal', 'goal_end',
    ],
  },
  '3-3': {
    theme: 'ice', bg: 'peaks', music: 'level', time: 300,
    chunks: [
      'start', 'flat', 'lava_gap', 'walkers', 'plat_steps', 'shell',
      'lava_wide', 'flyer', 'coin_stack', 'spikes', 'pipe_plant',
      'lava_gap', 'sky_run', 'walkers', 'brick_wall', 'pit_l',
      'plat_float', 'power_hi', 'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  '3-F': {
    theme: 'fortress', bg: 'none', music: 'fortress', time: 350, boss: true,
    chunks: [
      'start', 'fort_hall', 'fort_pillars', 'fort_gap', 'fort_spikes',
      'fort_blocks', 'fort_gap', 'fort_spikes', 'fort_pillars',
      'fort_hall', 'boss_arena',
    ],
  },
};

const cache = new Map();

/** Returns { id, theme, bg, music, time, boss, rows } with rows fully padded. */
export function getLevel(id) {
  if (cache.has(id)) return cache.get(id);
  const def = LEVEL_DEFS[id];
  if (!def) throw new Error(`unknown level: ${id}`);
  const level = { id, boss: false, ...def, rows: assemble(def.chunks) };
  cache.set(id, level);
  return level;
}

export const hasLevel = (id) => !!LEVEL_DEFS[id];
