import { assemble, assembleTall, CHUNK_ROWS } from './chunks.js';
import { normalizeRows } from '../core/utils.js';
import { WORLD1_LEVELS } from './levels/world1.js';
import { WORLD2_LEVELS } from './levels/world2.js';
import { WORLD3_LEVELS } from './levels/world3.js';
import { WORLD4_LEVELS } from './levels/world4.js';
import { WORLD5_LEVELS } from './levels/world5.js';
import { WORLD6_LEVELS } from './levels/world6.js';
import { WORLD7_LEVELS } from './levels/world7.js';
import { WORLD8_LEVELS } from './levels/world8.js';

/**
 * A level is a chunk playlist plus presentation data. `boss: true` means the
 * exit is the fortress door that opens once the boss is beaten, and
 * `bossVariant` picks that boss's move set (see entities/enemies.js).
 *
 * The definitions live in ./levels/, one file per world, so two people editing
 * two worlds are not editing the same file. Spread in world order: `levelIds()`
 * hands its keys straight to the world map, and the order of this object is
 * the order of the game.
 */
const LEVEL_DEFS = {
  ...WORLD1_LEVELS,
  ...WORLD2_LEVELS,
  ...WORLD3_LEVELS,
  ...WORLD4_LEVELS,
  ...WORLD5_LEVELS,
  ...WORLD6_LEVELS,
  ...WORLD7_LEVELS,
  ...WORLD8_LEVELS,
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
