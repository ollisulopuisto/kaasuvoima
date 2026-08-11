import { assemble, assembleTall, CHUNK_ROWS, CHUNKS } from './chunks.js';
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
export const defaultTime = (columns) => Math.min(600, Math.max(300, Math.round((columns * 1.3) / 10) * 10));

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
    /*
     * A tall grid is bands **unless the level says it is a climb**, and the
     * order matters: this line overrules the spread above it, so a level
     * cannot declare `bands` and it cannot declare its way out of them either
     * — except by declaring what it is.
     *
     * The two are the same number of rows and nothing else. A banded level is
     * three separate 15-row *rooms* stacked in one grid, reached by a pipe or
     * a beanstalk, and the camera stays inside whichever one your feet are in
     * (`clampCamY`) precisely so that walking under a secret does not show it
     * to you. A vertical level is one room that happens to be forty rows tall,
     * with no seams, no rooms and nothing hidden — the camera is meant to
     * travel its whole height, and band clamping would pin it to fifteen rows
     * and stop the climb dead at the first seam. So a climb takes the plain
     * branch, which is the one that says "this level is as tall as it is".
     */
    bands: !def.vertical && rows.length > CHUNK_ROWS ? BANDS : null,
    rows,
  };
  cache.set(id, level);
  return level;
}

export const hasLevel = (id) => !!LEVEL_DEFS[id];
export const levelIds = () => Object.keys(LEVEL_DEFS);

/**
 * Panee ajossa rakennetun kentän välimuistiin, jotta `getLevel` löytää sen.
 *
 * Päivän pieru rakentaa kenttänsä selaimessa (`src/core/daily.js`), eikä se
 * kenttä ole `LEVEL_DEFS`:ssä — eikä saakaan olla. `levelIds()` on pelin
 * sisällysluettelo: kartta, `tools/verify.mjs`, `tools/playable.mjs` ja
 * `tools/difficulty.mjs` kaikki kävelevät sen läpi, ja päivän kenttä siellä
 * olisi 61. kenttä joka vaihtuu joka yö.
 *
 * Välimuistiin se silti kuuluu, ja syy on `src/core/secrets.js`: se kysyy
 * `getLevel(id)`:llä mitä kentässä on piilossa, ja saa muuten `unknown level`
 * -poikkeuksen ensimmäisestä tiilestä johon pelaaja koskee. Sama seam kuin
 * `LevelScene`in kolmas parametri, samasta syystä.
 *
 * Sama tunnus joka päivä on tarkoituksellista (HUD ja telemetria lukevat sen),
 * ja sen ainoa seuraus on että `secrets.js`:n oma avainvälimuisti pitää
 * eilispäivän listan siihen asti kun sivu ladataan — päivän pierussa ei näytetä
 * salatilastoa, joten se ei näy missään.
 */
export function registerLevel(def) {
  cache.set(def.id, def);
  return def;
}

/**
 * Missä linnakkeen areena alkaa, laattoina — eli mihin ovi vie.
 *
 * Laskettu palikoiden leveyksistä eikä kirjoitettu kenttädataan, koska
 * kirjoitettu luku vanhenee sillä hetkellä kun joku lisää yhden palikan
 * areenan eteen. Tässä erässä on kolme esimerkkiä siitä mitä se maksaa.
 *
 * `null` kun kenttä ei ole linnake tai sillä ei ole areenapalikkaa: kutsuja
 * päättää mitä se siitä ajattelee, eikä tämä keksi sijaintia jota ei ole.
 */
export function arenaColumn(def) {
  if (!def || !Array.isArray(def.chunks)) return null;
  let col = 0;
  for (const name of def.chunks) {
    if (name.startsWith('boss_arena')) return col;
    const chunk = CHUNKS[name];
    if (!chunk) return null;
    col += chunk.w;
  }
  return null;
}
