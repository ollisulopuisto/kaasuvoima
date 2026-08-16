import { assembleTall, CHUNK_ROWS } from './chunks.js';
import { defaultTime, registerLevel } from './levels.js';

/**
 * ESITTELY — kenttä joka on olemassa vain esittelyä varten.
 *
 * Alkuruutu alkaa pelata itseään kahdenkymmenen sekunnin jälkeen, ja sen demon
 * pitäisi **tehdä temppu**: painaa alas putken päällä ja hävitä siihen. Se on
 * salaisuuksien löydettävyyden kolmas osa, ja kaksi ensimmäistä määräävät mitä
 * kolmas saa olla:
 *
 *   1. Kartta kertoo *että* kentässä on salaisuuksia, ei koskaan *missä*.
 *   2. Kolikkojono osoittaa, ja vain sitä yhtä salaisuutta johon ei voi
 *      kompastua.
 *
 * Näistä seuraa yksi ehto: **demo saa opettaa verbin, muttei paikkaa.**
 *
 * ## Miksi oma kenttä
 *
 * Vaihtoehtoja oli kolme, ja kaksi niistä kaatuu tuohon ehtoon:
 *
 *   - **1-1:n tavallinen putki.** Demo painaisi alas eikä mitään tapahtuisi.
 *     Se ei opeta verbiä vaan näyttää siltä että peli on rikki — pahin
 *     mahdollinen asia opettaa alkuruudulla.
 *   - **Demo vaihdetaan 1-2:een**, jossa lämpöputki on. Verbi opetettaisiin ja
 *     samalla paljastettaisiin sarake 229 pelin toisessa kentässä. Se on tasan
 *     se mitä ehto kieltää, eikä sitä voi tehdä puoliksi: demo näyttää sen
 *     kentän jota se pelaa.
 *   - **1-1:een lisätään salaisuus.** Pelin ensimmäinen kenttä on kaikkein
 *     huonoin paikka lisätä salaisuus, koska se on ainoa kenttä jonka jokainen
 *     pelaaja pelaa ennen kuin tietää mitään.
 *
 * Jäljelle jää tämä: **kenttä jota ei ole pelissä.** Temppu tehdään oikeasti,
 * oikealla moottorilla ja oikeilla säännöillä, mutta se paikka jonka demo
 * paljastaa ei ole yhdessäkään pelattavassa kentässä. Paljastettavaa ei ole.
 *
 * ## Mitä tämä kenttä ei ole
 *
 * Se **ei ole pelin sisällysluettelossa** (`LEVEL_DEFS`), ja se on tarkoitus.
 * `levelIds()` on se lista jota kartta, `tools/difficulty.mjs`,
 * `tools/curriculum.mjs` ja `tools/variety.mjs` kävelevät läpi, ja ne mittaavat
 * kaikki samaa asiaa: **opetusjärjestystä**. Esittelykenttä ei opeta mitään
 * järjestyksessä — se on näyteikkuna — joten sen laskeminen mukaan vääristäisi
 * jokaisen niistä luvuista. Sama ratkaisu ja sama perustelu kuin päivän
 * pierulla (`src/core/daily.js`), ja sama mekanismi: `registerLevel` niin että
 * `src/core/secrets.js` löytää kentän kun pelaaja koskee ensimmäiseen tiileen.
 *
 * Se **on** silti kenttä jonka pelaaja näkee, joten se läpäisee samat säännöt
 * kuin muutkin: `validateLevel` ja maareitti voimatasolla 0. Ne ajetaan
 * `tools/verify.mjs`:ssä muiden kenttien kanssa samassa lohkossa. Näyteikkuna
 * jonka läpi ei pääse olisi huonompi mainos kuin ei näyteikkunaa lainkaan.
 *
 * ## Miksi juuri nämä palikat
 *
 * Kolme päätöstä:
 *
 *   1. **Tavallinen putki ennen lämpöputkea** (`pipe_short` ennen
 *      `warp_pipe`ä). Sama sääntö kuin jokaisessa oikeassa kentässä jossa on
 *      lämpöputki: jos ainoa putki jonka demo näyttää on se joka vie jonnekin,
 *      demo opettaa "putki = ovi" ja se on väärä oppi. Botti kävelee
 *      ensimmäisen yli ja pysähtyy toiselle, ja ero näiden kahden välillä on
 *      juuri se mitä pelaajan pitää itse opetella etsimään.
 *   2. **Meno ja paluu, ei vain meno.** Luolahuoneen uloskäynti roikkuu
 *      katosta, ja botti painaa siellä ylös. Bonushuone josta ei pääse pois on
 *      ansa eikä bonus, ja demo joka näyttää vain menon opettaa puolet
 *      verbistä.
 *   3. **Voimasieni ensimmäisessä neljänneksessä** (`power` palikkana 1).
 *      `validateLevel` vaatii sen jokaiselta kentältä, ja tämä kenttä ei ole
 *      poikkeus — mutta se on myös esittelyn oma etu: demobotti saa
 *      ilmahypyn, ja ilmahyppy on se toinen asia jota näyteikkunassa
 *      kannattaa näyttää.
 */
export const DEMO_ID = 'esittely';

/**
 * Lämpöputken suu on sarakkeessa 53 (`warp_pipe` alkaa sarakkeesta 48), ja
 * luolahuone alkaa samasta sarakkeesta. Sen uloskäynti on huoneen sarakkeissa
 * 26–27 eli kentän sarakkeissa 74–75, ja siellä pinnalla on `coins`-palikan
 * tasainen maa — lämpöputki kieltäytyy jos nousukohdan yläpuolella on kiveä,
 * joten paluun paikka on maaston sanelema eikä valittu.
 */
const DEMO_CHUNKS = [
  'start', 'power', 'pipe_short', 'warp_pipe', 'coins', 'walkers',
  'flat', 'run_up', 'goal', 'goal_end',
];
const DEMO_CAVE = [[48, 'cave_room']];

let built = null;

/** Rakennetaan kerran ja rekisteröidään, ks. ylempi perustelu. */
export function demoLevel() {
  if (built) return built;
  const rows = assembleTall(DEMO_CHUNKS, [], DEMO_CAVE);
  built = registerLevel({
    id: DEMO_ID,
    title: 'ESITTELY',
    theme: 'grass',
    bg: 'hills',
    music: 'level',
    rows,
    time: defaultTime(rows[0].length),
    /* Sama kolmikaistainen muoto kuin `getLevel` antaa korkealle kentälle.
     * Luvut luetaan `CHUNK_ROWS`:sta eikä kirjoiteta tähän, jotta kaista ei voi
     * jäädä eri mittaiseksi kuin se ruudukko jonka `assembleTall` teki. */
    bands: { rows: CHUNK_ROWS, main: CHUNK_ROWS, cave: 2 * CHUNK_ROWS },
    boss: false,
    bossVariant: 0,
  });
  return built;
}
