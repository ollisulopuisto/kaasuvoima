import { assemble, assembleTall, BAND_ROWS, CHUNKS } from './chunks.js';
import { normalizeRows } from '../core/utils.js';
import { DEFAULT_MODE, isBaseMode, modeId, scaleLevel, scaleTime } from './scale.js';
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
 * Ajossa rakennetut kentät, omassa taulussaan eikä `cache`ssa.
 *
 * Kaksi eri asiaa asuisi muuten samassa avaruudessa: `cache` on
 * "tämä kenttä tällä vaikeustasolla, rakennettu kerran", ja rekisteröity kenttä
 * on "tämä kenttä, piste". Kun ne olivat samassa taulussa, HELPOLLA kerran
 * rakennettu kenttä vastasi myös NORMAALIn kyselyyn, koska tunnus osui ensin.
 * Ks. `registerLevel`.
 */
const registered = new Map();

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
const BANDS = { rows: BAND_ROWS, main: BAND_ROWS, cave: 2 * BAND_ROWS };

/**
 * MAASTOPASSI ON KENTÄN OMA VALINTA, ja nämä ovat ne kentät jotka eivät voi
 * tehdä sitä.
 *
 * Vaihteleva maasto kirjoittaa palikoiden väliin rinteitä, eli **sarakkeita
 * joita palikkalistassa ei ole**. Kolme kentän muotoa lukee saraketta
 * numerona eikä sisältönä, ja jokaiselle niistä lisätty sarake tarkoittaa eri
 * paikkaa kuin ennen:
 *
 *   - `sky` ja `cave` ovat harvoja `[sarake, palikka]` -sijoituksia, ja ne
 *     osoittaisivat vartensa viereen;
 *   - `segments` rajaa osionsa sarakenumeroilla;
 *   - pomoareenan sisäänkäynti (`arenaColumn`) on palikkaleveyksien summa —
 *     ja senkin voisi korjata (`terrainShift` tekee juuri sen), mutta areenan
 *     oma uudelleensyntymä on `level.js`:ssä yhä rivi 12, joten nostettu
 *     areena pudottaisi voitetun pomon jälkeen pelaajan kiveen.
 *
 * Poikkeus ei ole varoitus vaan poikkeus: kenttä joka pyytää maastoa jota se
 * ei voi saada on kirjoitusvirhe, ja hiljaa jätetty tasamaa olisi se vika
 * jota etsittäisiin väärästä tiedostosta.
 */
export function terrainSeedOf(id, def) {
  if (!def.terrain) return null;
  if (def.rows) throw new Error(`${id}: terrain needs chunks, and this level writes its own rows`);
  if (def.sky || def.cave) throw new Error(`${id}: terrain and hidden bands both count columns`);
  if (def.segments) throw new Error(`${id}: terrain and segments both count columns`);
  if (def.boss) throw new Error(`${id}: a boss arena respawns on a fixed row, so it stays flat`);
  return def.terrain === true ? id : String(def.terrain);
}

function buildRows(id, def) {
  if (def.rows) return normalizeRows(def.rows);
  if (def.sky || def.cave) return assembleTall(def.chunks, def.sky, def.cave);
  return assemble(def.chunks, terrainSeedOf(id, def));
}

/**
 * Returns { id, theme, bg, music, time, boss, bands, rows } with rows padded.
 *
 * `mode` is the difficulty (see `./scale.js`), and it is a **parameter with a
 * default rather than a global**: everything that reads a level without playing
 * it — the world map's secret counts, `tools/difficulty.mjs`,
 * `tools/curriculum.mjs`, `tools/variety.mjs`, the whole of `verify.mjs` — is
 * asking about the level as the data file wrote it, and gets exactly that by
 * not asking for anything else. Only `LevelScene` passes a mode, because only
 * it is building the level somebody is about to play.
 *
 * The cache is keyed by both, so the three modes are three entries and not one
 * that changes meaning when a player picks a different game.
 */
export function getLevel(id, mode = DEFAULT_MODE) {
  /* Ajossa rekisteröity kenttä on aina se joka rekisteröitiin. Ks.
   * `registerLevel`: päivän pieru rakentaa oman kenttänsä eikä sitä venytetä
   * — yksi yritys päivässä ja sama kaikille on eri lupaus kuin vaikeustaso. */
  if (registered.has(id)) return registered.get(id);
  const key = isBaseMode(mode) ? id : `${modeId(mode)} ${id}`;
  if (cache.has(key)) return cache.get(key);
  const def = LEVEL_DEFS[id];
  if (!def) throw new Error(`unknown level: ${id}`);
  const rows = buildRows(id, def);
  const scaled = scaleLevel(id, def, rows, mode, arenaColumn(def));
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
    /* ...ja osioitu kenttä ottaa saman haaran samasta syystä. Kaistat ovat
     * kolme erillistä huonetta joiden välillä kamera ei saa nähdä, ja se on
     * oikein salaisuudelle mutta väärin reitille: osioidussa kentässä ylös
     * meneminen **on** reitti, ja kaistarajaus pysäyttäisi kameran ensimmäiseen
     * saumaan. Kenttä joka ilmoittaa osionsa on siis yksi korkea huone kuten
     * kiipeilykin, ei kolme päällekkäistä. */
    /* `BAND_ROWS` eikä `CHUNK_ROWS`, ja tämä oli koko 16 rivin muutoksen
     * hiljaisin ansa: palikkakorkuisella luvulla **jokainen tavallinen kenttä**
     * täyttäisi ehdon `16 > 15`, saisi kaistat joita sillä ei ole, ja kamera
     * alkaisi rajata kaistaan kenttää jossa ei ole yhtään. */
    bands: !def.vertical && !def.segments && rows.length > BAND_ROWS ? BANDS : null,
    rows,
  };
  /*
   * Vaikeustason jäljet, ja ne kirjoitetaan levityksen JÄLKEEN samasta syystä
   * kuin `bands`: määrittelyssä oleva `time` on kentän oma sana omasta
   * kellostaan, ja venytetyssä kentässä se on väärä sana. Kello skaalautuu
   * pituuden mukana ja jää entiseen kattoonsa, `arenaCol` kertoo `arenaColumn`
   * ille minne areena siirtyi, ja `mode` on se mitä tämä kenttä on — sitä
   * lukee `LevelScene` kun se kysyy salaisuuksia oikealta listalta.
   */
  if (scaled) {
    level.rows = scaled.rows;
    level.time = scaleTime(level.time, scaled.timeRatio);
    level.mode = modeId(mode);
    if (scaled.arenaCol !== null) level.arenaCol = scaled.arenaCol;
  }
  cache.set(key, level);
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
 *
 * Oma taulunsa `cache`n sijaan, ks. `registered`: rekisteröity kenttä on kentän
 * ainoa muoto eikä yksi kolmesta, joten se vastaa kyselyyn vaikeustasosta
 * riippumatta. Juuri sitä päivän pierulta halutaan — yksi yritys päivässä ja
 * sama kenttä kaikille on eri lupaus kuin vaikeustaso, eikä sitä lupausta voi
 * pitää kolmessa eri pituudessa.
 */
export function registerLevel(def) {
  registered.set(def.id, def);
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
  /* Venytetty kenttä kantaa oman lukunsa, ja se voittaa palikkalaskun: palikat
   * ovat yhä alkuperäiset, ruudukko ei ole, ja niiden leveyksien summa
   * osoittaisi kohtaan josta areena on siirtynyt pois. Ks. `scale.js`. */
  if (def && typeof def.arenaCol === 'number') return def.arenaCol;
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
