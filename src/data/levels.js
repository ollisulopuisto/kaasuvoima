import { assemble, assembleTall, CHUNK_ROWS } from './chunks.js';
import { normalizeRows } from '../core/utils.js';
import { GENERATED_LEVELS } from './generated.js';

/**
 * A level is a chunk playlist plus presentation data. `boss: true` means the
 * exit is the fortress door that opens once the boss is beaten, and
 * `bossVariant` picks that boss's move set (see entities/enemies.js).
 */
const LEVEL_DEFS = {
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

  '2-1': {
    theme: 'desert', bg: 'dunes', music: 'level',
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
      'start', 'plat_float', 'power', 'walkers', 'spikes', 'pit_twin',
      'walkers', 'sky_run', 'coin_stack', 'pit_bridge', 'clouds', 'brick_wall',
      'heartburn_pair', 'plat_hi', 'shell', 'pit_l', 'power_hi', 'walkers',
      'note_pair', 'steps_down', 'run_up', 'goal', 'goal_end',
    ],
  },
  // The desert world's night level: windy, and there is a moon to jump on.
  '2-N': {
    theme: 'night', bg: 'dunes', music: 'level', wind: true,
    chunks: [
      'start', 'flat', 'power', 'dune_night', 'walkers', 'pit_s',
      'moon_night', 'coins', 'shell', 'plat_steps', 'pit_l', 'corks',
      'dune_night', 'spike_bridge', 'flyer', 'pit_plat', 'shell', 'steps_up',
      'run_up', 'goal', 'goal_end',
    ],
  },
  '2-3': {
    theme: 'desert', bg: 'peaks', music: 'level',
    chunks: [
      'start', 'flat', 'power', 'sun', 'lava_gap', 'walker',
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

const cache = new Map();

/**
 * A level's clock is proportional to its length: the classic one-unit-per-24-
 * frames tick means a 16-tile chunk costs about 5 units at a walk, so a short
 * level with a long clock is not tension, it is just a number going down.
 * `time` in a level definition overrides this.
 */
const defaultTime = (columns) => Math.min(600, Math.max(300, Math.round((columns * 1.3) / 10) * 10));

/**
 * Where the bands of a tall level sit, in tile rows. Everything that needs to
 * know — the camera, the warp pipes, the underground wash — reads it from here
 * rather than counting rows for itself.
 */
const BANDS = { rows: CHUNK_ROWS, main: CHUNK_ROWS, cave: 2 * CHUNK_ROWS };

function buildRows(def) {
  if (def.rows) return normalizeRows(def.rows);
  if (def.sky || def.cave) return assembleTall(def.chunks, def.sky, def.cave);
  return assemble(def.chunks);
}

/** Returns { id, theme, bg, music, time, boss, bands, rows } with rows padded. */
export function getLevel(id) {
  if (cache.has(id)) return cache.get(id);
  const def = LEVEL_DEFS[id];
  if (!def) throw new Error(`unknown level: ${id}`);
  const rows = buildRows(def);
  const level = {
    id,
    boss: false,
    bossVariant: 0,
    time: defaultTime(rows[0].length),
    ...def,
    bands: rows.length > CHUNK_ROWS ? BANDS : null,
    rows,
  };
  cache.set(id, level);
  return level;
}

export const hasLevel = (id) => !!LEVEL_DEFS[id];
export const levelIds = () => Object.keys(LEVEL_DEFS);
