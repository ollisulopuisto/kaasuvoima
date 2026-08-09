/**
 * Levels are assembled from 15-row chunks. Writing them as sparse row maps
 * keeps the data short and makes column alignment impossible to get wrong:
 * every row is padded to the chunk width at build time.
 *
 * Row guide (row 13-14 is normally the floor):
 *   0-3   high sky        8-9   the classic "bump row" reachable from the floor
 *   4-7   platform band   12    the tile enemies and pipes stand on
 *
 * Characters: see src/gfx/tiles.js (T) plus entity markers
 *   1 player start | g walker | k shell | f flyer | p piranha | b boss
 *
 * A level can also be three of these bands stacked — see assembleTall.
 *
 * The chunks themselves live in ./chunks/, one file per world plus the shared
 * vocabulary, so two people working on two worlds are not editing the same
 * file. This one stays the only address anybody imports: it merges them and
 * owns the assembly.
 */

import { CHUNK_ROWS, COMMON_CHUNKS } from './chunks/common.js';
import { GRASS_CHUNKS } from './chunks/grass.js';
import { DESERT_CHUNKS } from './chunks/desert.js';
import { ICE_CHUNKS } from './chunks/ice.js';
import { FACTORY_CHUNKS } from './chunks/factory.js';
import { BONE_CHUNKS } from './chunks/bone.js';
import { CLOUD_CHUNKS } from './chunks/cloud.js';
import { FORTRESS_CHUNKS } from './chunks/fortress.js';
import { SECRET_CHUNKS } from './chunks/secrets.js';

export { CHUNK_ROWS };

export const CHUNKS = {
  ...COMMON_CHUNKS,
  ...GRASS_CHUNKS,
  ...DESERT_CHUNKS,
  ...ICE_CHUNKS,
  ...FACTORY_CHUNKS,
  ...BONE_CHUNKS,
  ...CLOUD_CHUNKS,
  ...FORTRESS_CHUNKS,
  ...SECRET_CHUNKS,
};

/** Expands a chunk name list into one padded grid of characters. */
export function assemble(names) {
  const rows = Array.from({ length: CHUNK_ROWS }, () => '');
  for (const name of names) {
    const chunk = CHUNKS[name];
    if (!chunk) throw new Error(`unknown chunk: ${name}`);
    for (let y = 0; y < CHUNK_ROWS; y++) rows[y] += chunk.rows[y];
  }
  return rows;
}

/** Stamps sparse `[column, chunk]` placements into one otherwise empty band. */
function band(width, places) {
  const rows = Array.from({ length: CHUNK_ROWS }, () => ' '.repeat(width));
  for (const [at, name] of places) {
    const chunk = CHUNKS[name];
    if (!chunk) throw new Error(`unknown chunk: ${name}`);
    if (at < 0 || at + chunk.w > width) {
      throw new Error(`chunk ${name} at column ${at} does not fit a ${width} wide level`);
    }
    for (let y = 0; y < CHUNK_ROWS; y++) {
      rows[y] = rows[y].slice(0, at) + chunk.rows[y] + rows[y].slice(at + chunk.w);
    }
  }
  return rows;
}

/**
 * Three bands of the same 15 rows, stacked: sky, the route, the cave. The
 * engine is told nothing — the level is simply 45 rows tall, the camera already
 * scrolls vertically, and the save state already stores the whole grid.
 *
 * `sky` and `cave` are sparse `[column, chunkName]` placements rather than
 * playlists, because a hidden area is a room or two and not a second level.
 *
 * The one thing stacking breaks is the floor of the middle band: a pit that
 * used to end a fall now drops the player into the band below and shows them
 * the secret on the way past. So every bottomless column gets a lid of lava
 * directly underneath, and falling in kills at the moment it always did.
 */
export function assembleTall(main, sky = [], cave = []) {
  const rows = assemble(main);
  const width = rows[0].length;
  const under = band(width, cave);
  let lid = '';
  for (let x = 0; x < width; x++) {
    const bottomless = rows[CHUNK_ROWS - 2][x] === ' ' && rows[CHUNK_ROWS - 1][x] === ' ';
    lid += bottomless ? 'W' : under[0][x];
  }
  under[0] = lid;
  return [...band(width, sky), ...rows, ...under];
}
