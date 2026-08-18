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
 *
 * Poikkeus on `chunks/fortresses.js`, jossa on kaikkien kahdeksan maailman
 * linnakesanastot yhdessä. Syy on rakenteellinen eikä laiskuus: linnake on
 * sisätila, ja teematiedostoilla on portteja jotka vaativat avointa taivasta
 * (`bone.js`) tai kieltävät maasta nousevan kiven (`cloud.js`). Katollinen
 * käytävä niissä tiedostoissa olisi joko rikkonut portin tai vaatinut sen
 * sisään poikkeuksen. Tiedosto perustelee itsensä omassa alussaan.
 */

import { CHUNK_ROWS, COMMON_CHUNKS, SLOPE_CHUNKS, TREE_CHUNKS } from './chunks/common.js';
import { GRASS_CHUNKS } from './chunks/grass.js';
import { DESERT_CHUNKS } from './chunks/desert.js';
import { ICE_CHUNKS } from './chunks/ice.js';
import { FACTORY_CHUNKS } from './chunks/factory.js';
import { BONE_CHUNKS } from './chunks/bone.js';
import { CLOUD_CHUNKS } from './chunks/cloud.js';
import { FORTRESS_CHUNKS } from './chunks/fortress.js';
import { FORTRESS_WORLD_CHUNKS } from './chunks/fortresses.js';
import { KEEP_CHUNKS } from './chunks/keep.js';
import { SECRET_CHUNKS } from './chunks/secrets.js';
/* Generoidut hyppysarjat. Ne ovat palikoita siinä missä muutkin — assemble ei
 * tiedä eroa — mutta niiden vaikeus on mitattu eikä arvioitu: ks. tiedoston oma
 * alku ja `tools/gen-jumps.mjs`. */
import { JUMP_CHUNKS } from './chunks/jumps.js';
import { applyTerrain, terrainProfile } from './terrain.js';

export { CHUNK_ROWS };

/**
 * KENTTÄDATA ON 15 RIVIÄ, KOOTTU KENTTÄ ON 16 — ja se yksi rivi on taivasta.
 *
 * ROADMAP kirjasi hinnan silloin kun HUD-nauha purettiin (17.8.2026):
 * *"tavallinen kenttä on 15 riviä eli tasan 240 px, joten pystyvieritys loppui
 * niistä."* Ikkuna on 240 px ja kenttä oli täsmälleen sen korkuinen, joten
 * kamera ei voinut liikkua pystysuunnassa lainkaan. Yksi rivi lisää palauttaa
 * sen — 16 × 16 = 256 px eli **16 pikseliä liikkumavaraa** — ja tekee samalla
 * toisen asian jota ROADMAP ei luvannut: maailman kansi nousee laatan verran,
 * eli maastopassi (`data/terrain.js`) saa nostaa maata kahdella laatalla
 * yhden sijaan.
 *
 * **Rivi tulee päälle eikä alle, ja se on koko ero.** Alle lisätty rivi olisi
 * antanut pystyvierityksen muttei yhtään lisää tilaa hypylle: kansi on
 * maanpinnan yläpuolella, ja sen ja lattian väli on se mitä hyppy tarvitsee.
 * Päälle lisätty rivi siirtää lattian alemmas ja **kannen kauemmas**.
 *
 * Ja se tulee **kokoajassa eikä kenttädatassa**. Palikkatiedostot pysyvät
 * viitenätoista rivinä lattioineen riveillä 13-14: siellä on 370
 * rivimerkintää kahdessatoista tiedostossa ja jokainen niiden perustelu
 * viittaa riviin 13. Kokoaja on yksi paikka, ja se on se paikka joka jo tietää
 * mikä on kaista ja mikä on palikka.
 *
 * Kaksi nimeä, ja ero niiden välillä on tämän muutoksen koko sisältö:
 *
 *   `CHUNK_ROWS`  rivejä **palikkatiedostossa**. Ei muutu koskaan.
 *   `BAND_ROWS`   rivejä **kootussa kaistassa**. Tämä on se luku jota
 *                 `rules.js`, `levels.js`, `scale.js` ja kamera tarkoittavat
 *                 kun ne sanovat "kaista".
 *
 * Kolmas luku joka **ei** ole kumpikaan näistä: ruudun korkeus on yhä 15
 * laattaa (`VIEW_H / TILE`). Se että se oli sama luku kuin kaista oli sattuma,
 * ja sen purkautuminen on tämän muutoksen tarkoitus — `tools/difficulty.mjs`
 * ja sen `SCREEN_ROWS` lukevat ruutua eivätkä kaistaa.
 */
export const SKY_PAD = 1;
export const BAND_ROWS = CHUNK_ROWS + SKY_PAD;

export const CHUNKS = {
  ...COMMON_CHUNKS,
  ...SLOPE_CHUNKS,
  ...TREE_CHUNKS,
  ...GRASS_CHUNKS,
  ...DESERT_CHUNKS,
  ...ICE_CHUNKS,
  ...FACTORY_CHUNKS,
  ...BONE_CHUNKS,
  ...CLOUD_CHUNKS,
  ...FORTRESS_CHUNKS,
  ...FORTRESS_WORLD_CHUNKS,
  ...KEEP_CHUNKS,
  ...SECRET_CHUNKS,
  ...JUMP_CHUNKS,
};

/** Looks a playlist up, and says which name was wrong rather than that one was. */
function chunksOf(names) {
  return names.map((name) => {
    const chunk = CHUNKS[name];
    if (!chunk) throw new Error(`unknown chunk: ${name}`);
    return chunk;
  });
}

/**
 * Expands a chunk name list into one padded grid of characters.
 *
 * `seed` on maastopassi (`./terrain.js`): sen kanssa kokoaja päättää kullekin
 * palikalle lattiatason ja kirjoittaa siirtymät rinteinä, ilman sitä maa on
 * tasan rivillä 13 kuten ennenkin. Se on **valinnainen ja oletuksena pois**,
 * koska kentän maasto on kentän oma asia: 64 käsintehtyä kenttää on mitattu
 * tasamaalla, ja kokoaja joka alkaisi arpoa mäkiä niiden alle muuttaisi
 * jokaisen niistä mittaamatta.
 */
export function assemble(names, seed = null) {
  const chunks = chunksOf(names);
  if (seed) return skyPad(applyTerrain(chunks, terrainProfile(chunks, seed)).rows);
  const rows = Array.from({ length: CHUNK_ROWS }, () => '');
  for (const chunk of chunks) {
    for (let y = 0; y < CHUNK_ROWS; y++) rows[y] += chunk.rows[y];
  }
  return skyPad(rows);
}

/**
 * Palikkakorkuiset rivit kaistakorkuisiksi: `SKY_PAD` riviä päälle.
 *
 * **Uusi rivi on kopio ylimmästä, ei tyhjä rivi**, ja se on mitattu eikä
 * arvattu. Palikoiden rivillä 0 on tasan kaksi merkkiä koko sanastossa:
 * `#` kahdeksassakymmenessäkahdessa palikassa (tehtaan, linnakkeen ja
 * linnan katot) ja `v` yhdessä (pavunvarsi). Kumpikin on asia joka **jatkuu
 * ylöspäin** — katto jonka päälle jäisi rivi tyhjää olisi katto jonka yllä on
 * ryömintätila, ja varsi joka pysähtyisi riviä ennen kaistan rajaa ei enää
 * veisi taivaskaistalle. Portti sanoi jälkimmäisen heti: *"nothing leads into
 * the sky band"*, 1-2, 2-2 ja 3-2.
 *
 * Kaikessa muussa rivi 0 on tyhjä, joten kopio on tyhjä. Sääntö on siis
 * yhdellä lauseella: **taivasrivi jatkaa sitä mitä palikan yläreunassa on.**
 *
 * Yksi funktio ja yksi kutsuja per polku, jotta padia ei voi tulla kahdesti
 * eikä nollaa kertaa.
 */
function skyPad(rows) {
  return [...Array.from({ length: SKY_PAD }, () => rows[0]), ...rows];
}

/**
 * Montako saraketta maastopassi työntää kunkin palikan eteen.
 *
 * Rinne on sarakkeita joita palikkalistassa ei ole, joten palikkaleveyksien
 * summa lakkaa olemasta sarakenumero sillä hetkellä kun kenttä saa maaston.
 * `arenaColumn` on se joka laskee niitä summia, ja tämä on sen vastaus.
 */
export function terrainShift(names, seed) {
  const chunks = chunksOf(names);
  return applyTerrain(chunks, terrainProfile(chunks, seed)).shift;
}

/** Stamps sparse `[column, chunk]` placements into one otherwise empty band. */
function band(width, places) {
  const rows = Array.from({ length: BAND_ROWS }, () => ' '.repeat(width));
  for (const [at, name] of places) {
    const chunk = CHUNKS[name];
    if (!chunk) throw new Error(`unknown chunk: ${name}`);
    if (at < 0 || at + chunk.w > width) {
      throw new Error(`chunk ${name} at column ${at} does not fit a ${width} wide level`);
    }
    /* `+ SKY_PAD`, ja tämä on se rivi jonka unohtaminen olisi ollut hiljainen
     * vika: salaisen huoneen lattia päätyisi kaistan riveille 13-14 samalla
     * kun reitin lattia on riveillä 14-15, eli huone olisi laatan verran
     * pielessä eikä mikään kaatuisi. */
    for (let y = 0; y < CHUNK_ROWS + SKY_PAD; y++) {
      /* Ylin rivi kahdesti, ks. `skyPad`: taivasrivi jatkaa sitä mitä palikan
       * yläreunassa on. */
      const src = chunk.rows[Math.max(0, y - SKY_PAD)];
      rows[y] = rows[y].slice(0, at) + src + rows[y].slice(at + chunk.w);
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
    /* `BAND_ROWS` eikä `CHUNK_ROWS`: `rows` on tässä jo koottu kaista, ja
     * kaistan kaksi alinta riviä ovat 14-15. Palikkakorkuisilla luvuilla tämä
     * lukisi rivejä 13-14 — joista ensimmäinen on nyt lattian *yläpuolella* —
     * ja pitäisi jokaista kiinteää saraketta pohjattomana, eli laavakansi
     * valuisi koko luolakaistan päälle. */
    const bottomless = rows[BAND_ROWS - 2][x] === ' ' && rows[BAND_ROWS - 1][x] === ' ';
    lid += bottomless ? 'W' : under[0][x];
  }
  under[0] = lid;
  return [...band(width, sky), ...rows, ...under];
}
