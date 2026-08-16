import { T } from '../gfx/tiles.js';
import { mulberry32 } from './generator.js';
import { CHUNK_ROWS } from './chunks.js';

/**
 * VAIKEUSTASOT, ELI SAMA PELI KOLMESSA MITASSA.
 *
 * Omistaja juoksi kolme ensimmäistä maailmaa läpi kuolematta kertaakaan
 * (12.8.2026), ja se on mittaus eikä mielipide: peli oli liian helppo. Tämän
 * tiedoston koko tehtävä on tehdä siitä valinta.
 *
 * **HELPPO on tasan se peli joka tässä oli tähän asti.** Ei yhtään laattaa, ei
 * yhtä vihollista, ei sekuntia kelloa eroa — `scaleLevel` palauttaa
 * alkuperäisen määrittelyn samana oliona, eikä tätä tiedostoa edes ajeta.
 * Tämä on ehto eikä tyylivalinta: kaikki mitattu — `src/data/difficulty.js`,
 * `tools/curriculum.mjs`, `tools/variety.mjs`, aika-ajon ennätykset — koskee
 * sitä kenttää joka on `LEVEL_DEFS`:ssä, ja jos oletustaso poikkeaisi siitä
 * pikselinkään verran, jokainen niistä luvuista olisi mitattu kentästä jota
 * kukaan ei pelaa.
 *
 * NORMAALI on kaksinkertainen ja VAIKEA kolminkertainen pituus, ja molemmissa
 * on lisäksi vihollisia tiheämmässä kuin venytys yksin toisi. Kaksi lukua per
 * taso, `stretch` ja `crowd`, ja ne ovat alla.
 *
 *
 * ## Miten kenttä pitenee: se toistaa omia tahtejaan, ei kasva umpimähkään
 *
 * Kenttä on ruudukko merkkejä (`src/data/chunks.js`), ja pidempi kenttä
 * tehdään **monistamalla ruudukon omia sarakevälejä paikalleen**. Ei
 * generoimalla uutta: generaattori on olemassa (`gen-levels.mjs`) ja sen
 * tuotos on oma kenttänsä, ei toisen kentän jatke. Käsin tehdyn kentän
 * pidentäminen arvotulla maastolla tekisi siitä kaksi kenttää joilla on sama
 * nimi.
 *
 * Saumalla on kaksi ehtoa, ja ne vastaavat kahteen eri kysymykseen.
 *
 * **Liitos on ehjä**, koska sauma saa olla vain sellaisessa sarakkeessa jossa
 * koko sarake on pelkkää maata ja tyhjää (`isPlain`) ja jossa kaksi peräkkäistä
 * sellaista saraketta ovat merkilleen samat. Silloin jokainen liitos asettaa
 * tunnetusti kelvollisen sarakeparin vierekkäin: liitoskohtaan ei voi syntyä
 * seinää, kuilua, puolikasta putkea eikä katkennutta lauttaa, koska liitettävät
 * sarakkeet ovat samat kuin ne jotka alkuperäisessä kentässä jo ovat vierekkäin.
 *
 * **Liitos on reilu**, koska sen kummallakin puolella on `RUNWAY` saraketta
 * samaa maastoa. Tämä ehto puuttui ensimmäisestä versiosta ja se maksoi viisi
 * kenttää — koko perustelu on `RUNWAY`in kohdalla, ja lyhyesti: ehjä liitos voi
 * silti panna kuilun eteen viisi saraketta vauhdinottoa siellä missä kentän oma
 * kirjoittaja pani neljäkymmentäkolme.
 *
 * Ja koska ehto koskee **koko saraketta kaikissa kaistoissa**, sauma ei voi
 * osua salaiseen huoneeseen eikä sen ja sinne vievän varren tai putken väliin:
 * niissä sarakkeissa on mustetta jossakin kaistassa, joten ne eivät ole
 * saumakelpoisia. Osioitujen kenttien (1-2, 2-2, 3-2, 4-2) taivas- ja
 * luolahuoneet siirtyvät siis aina yhtenä palana reittinsä mukana.
 *
 * Kolme muuta rajausta, kaikki samasta syystä — kenttä saa pidentyä, ei
 * muuttua toiseksi kentäksi:
 *
 *   - **Avausneljännestä ei toisteta.** `OPENING`. Kentän ensimmäinen
 *     neljännes on se osa joka opettaa (ks. `levels/world1.js`), ja se on myös
 *     se osa jossa validaattori vaatii tehostuksen olevan. Kun mikään ennen
 *     sitä rajaa ei liiku, tehostus on yhä siellä missä sääntö sen vaatii —
 *     uudessakin, pidemmässä neljänneksessä.
 *   - **Ainutkertaista ei monisteta.** `UNIQUE`. Aloitusruutu, lipputanko,
 *     pomo, ovi, kytkin, papuvarsi, lämpöputken suu ja tähtilaatta ovat kukin
 *     kentässä kerran ja tarkoituksella. Pätkä joka sisältää yhdenkin niistä
 *     esiintyy tuloksessa täsmälleen kerran.
 *   - **Järjestys ei muutu.** Pätkän kopio menee heti alkuperäisen perään.
 *     Sekoittaminen olisi ollut vaihtelevampaa ja se olisi rikkonut sen mikä
 *     kentässä on kertomusta: vaikeus kasvaa vasemmalta oikealle.
 *
 * Toistettavat pätkät ovat vähintään `MIN_SEG` saraketta pitkiä. Saumakelpoisia
 * sarakkeita on kentässä satoja — 1-1:ssä 257 kolmestasadastaviidestäkymmenestä
 * — joten peräkkäisten saumojen väli olisi useimmiten yksi sarake, ja tulos
 * olisi kenttä jossa on sama tasainen lattia kahdesti eikä sama *tahti*
 * kahdesti. Puolitoista ruutua on lyhin väli jossa on jotain toistettavaa.
 *
 *
 * ## Miten vihollisia tulee lisää
 *
 * Venytys tuo jo omansa: kaksinkertainen kenttä on kaksinkertainen määrä
 * vihollisia. `crowd` on se osuus jonka pelaaja saa **sen päälle**, eli
 * NORMAALI on noin 2,7-kertainen ja VAIKEA noin 5,1-kertainen alkuperäiseen
 * nähden.
 *
 * Uusi vihollinen ilmestyy vain paikkaan joka kelpaisi kenttädatassakin: tyhjä
 * ruutu, kiinteä maa alla ja sen molemmin puolin, kaksi tyhjää riviä yllä,
 * tyhjää molemmilla sivuilla, `SPACING` laattaa väliä lähimpään toiseen
 * viholliseen, eikä lähtöruudun, maalin tai pomoareenan tuntumassa. Laji
 * arvotaan **niistä lajeista jotka kentässä jo ovat**, joten jäämaailmaan ei
 * ilmesty aavikon otusta eikä kenttään lajia jota se ei ole esitellyt.
 *
 * Arvonta on siemenetty kentän tunnuksesta ja tason nimestä, eli sama kenttä
 * samalla vaikeustasolla on joka kerta sama kenttä. Se ei ole siisteyttä:
 * tilatallennus, salaisuuslaskuri ja aika-ajon ennätykset kaikki olettavat että
 * kenttä on eilen sama kuin tänään.
 *
 *
 * ## Mitä EI veny
 *
 * **Kiipeilykentät** (`vertical`, 6-K ja 7-T) eivät veny eivätkä saa lisää
 * vihollisia. Ne ovat säännön mukaan tasan yhden ruudun levyisiä
 * (`RULE_CONSTANTS.VERTICAL_COLS`) ja niiden akseli on toinen; vaakasuora
 * venytys olisi niissä sääntörikko ja pystysuora olisi eri työ.
 *
 * **Päivän pieru** ei veny. Se on yksi yritys päivässä ja sama kaikille, ja
 * vaikeustaso tekisi siitä kolme eri kenttää joilla on sama nimi. Toteutus on
 * `levels.js`:ssä: ajossa rekisteröity kenttä palautetaan sellaisenaan.
 */

/* ------------------------------- the modes ------------------------------- */

/**
 * `stretch` on tavoitepituus kerrottuna alkuperäisellä, `crowd` on venytyksen
 * päälle tuleva vihollislisä osuutena.
 */
export const MODES = [
  { id: 'easy', title: 'HELPPO', stretch: 1, crowd: 0, blurb: 'KENTAT KUTEN ENNEN' },
  { id: 'normal', title: 'NORMAALI', stretch: 2, crowd: 0.35, blurb: 'TUPLASTI KENTTAA, LISAA VAKEA' },
  { id: 'hard', title: 'VAIKEA', stretch: 3, crowd: 0.7, blurb: 'KOLMINKERTAINEN JA TAYNNA' },
];

export const DEFAULT_MODE = 'easy';

/** The mode record for an id, falling back to the default rather than throwing. */
export const modeOf = (id) => MODES.find((m) => m.id === id) || MODES[0];

/** Normalised mode id — anything unknown, missing or stale reads as the default. */
export const modeId = (id) => (MODES.some((m) => m.id === id) ? id : DEFAULT_MODE);

/** True when this mode leaves every level exactly as the data file wrote it. */
export const isBaseMode = (id) => modeOf(id).stretch === 1 && modeOf(id).crowd === 0;

/**
 * What to print on screen for a mode, or '' for the one that needs no printing.
 *
 * HELPPO is the game as it has always been, and a permanent label announcing
 * the default would be a fifth reading in a strip that already has four
 * (DESIGN.md §8). The picker names all three; the map and the pause menu only
 * speak up when the answer is not the ordinary one.
 */
export const difficultyLabel = (id) => (isBaseMode(id) ? '' : modeOf(id).title);

/* ------------------------------- the numbers ----------------------------- */

/** How much of a level's opening is never repeated, as a share of its width. */
const OPENING = 0.25;
/** The shortest span that may be duplicated, in columns. */
const MIN_SEG = 24;
/**
 * VAUHDINOTTO: montako yhtenäistä maasaraketta sauman kummallakin puolella on
 * oltava.
 *
 * Ja tämä on se luku joka löytyi punaisesta. Sääntö oli aluksi "kaksi
 * peräkkäistä samanlaista maasaraketta", mikä riittää **laattojen jatkuvuuteen**
 * — liitos asettaa vierekkäin sarakeparin joka on kentässä jo vierekkäin, joten
 * saumaan ei voi syntyä seinää eikä kuilua — mutta ei riittänyt vauhtiin.
 * `node tools/playable.mjs --mode hard` mittasi hinnan: viisi kenttää joissa
 * botti ei enää päässyt läpi, ja 7-3 oli niistä selvin. Sen rytmi on 43
 * saraketta lattiaa ja viiden sarakkeen kuilu, ja liitos pani kuilun eteen
 * viisi saraketta lattiaa 43:n sijaan. Kuilu oli yhä hyppybudjetin sisällä ja
 * `validateLevel` sanoi kentän olevan kunnossa — se mittaa kuilun leveyden,
 * ei sitä paljonko vauhtia sen eteen mahtuu.
 *
 * Kuusi kumpaankin suuntaan tarkoittaa että jokaisen liitoksen ympärillä on
 * **kaksitoista saraketta tasaista**, ja mitattuna seisonnasta täyteen juoksuun
 * (`ACC` 0,0547 px/frame²) menee 46 framea ja noin neljä laattaa — eli
 * vauhdinottoa on kolminkertaisesti siihen nähden mitä paikaltaan lähtevä
 * tarvitsee. Luku on haettu mittaamalla: `--mode hard` on vihreä kuudella ja
 * kentät venyvät 2,03x ja 2,99x, kun kymmenellä ne venyvät enää 2,80x ja
 * yksitoista kenttää ei veny lainkaan.
 *
 * **Vauhdinotto mitataan alariveistä eikä koko sarakkeesta**, ja se ero on
 * sekin mitattu: kun ehto oli "koko sarake tyhjä ja maata" kahdenkymmenenneljän
 * sarakkeen matkalta, yksikään kentän 64:stä ei venynyt lainkaan. Syy on
 * ilmeinen jälkeenpäin — taivaassa on kolikoita, lauttoja ja tiiliä, eikä
 * kahdenkymmenenneljän sarakkeen mittaista tyhjää taivasta ole missään. Yllä
 * oleva kolikkorivi ei kuitenkaan hidasta juoksijaa, joten kysymys on väärä:
 * vauhtia rajoittaa se mitä jaloissa on. `RUN_ROWS` on se osa sarakkeesta jossa
 * juoksija on.
 */
const RUNWAY = 6;
/**
 * Mitkä rivit ovat "jalat": lattia ja se tila jossa vartalo kulkee.
 *
 * Kaistan alin viisi riviä, eli 10…14 kun lattia on rivillä 13. Pisin hahmo on
 * 43 px eli 2,7 laattaa, joten rivit 10–12 ovat se mitä sen läpi juokseminen
 * vaatii tyhjäksi ja rivit 13–14 se mitä se vaatii kiinteäksi. Kaikki sen
 * yläpuolella — kolikot, lautat, tiilirivit, salaiset huoneet — saa vaihdella
 * vauhdinoton matkalla, koska mikään niistä ei ole juoksijan tiellä.
 */
const RUN_ROWS = 5;
/** Tiles of clear ground an added enemy keeps from any other enemy. */
const SPACING = 6;
/** Columns after the start marker and before the flag that stay empty. */
const START_CLEAR = 20;
const GOAL_CLEAR = 12;
/**
 * Kellon katto venytetyssä kentässä, aikayksikköinä.
 *
 * `defaultTime`n oma katto on 600 ja se jää sinne: se on mitoitettu 462
 * sarakkeen kentälle, ja kolminkertainen kenttä on 1200. 999 on suurin luku
 * joka mahtuu nauhan kolmeen numeroon (`padNum(this.time, 3)`), eli tämä on
 * yhtä aikaa reilu ja ilmainen — HUD-nauhaa ei tarvitse koskea, ja sen
 * pikselimitat ovat portissa.
 *
 * Mitattu, ettei se ole liian tiukka: pisin VAIKEA kenttä on 1224 saraketta eli
 * 19 584 px, ja 999 aikayksikköä on 23 976 framea, joten läpipääsy vaatii 0,82
 * px/frame keskinopeuden. Juoksuvauhti on 2,5 (`MAX_RUN`). Määräaika siis, ei
 * tavoiteaika — sama suhde kuin peli on aina luvannut.
 */
const TIME_CAP = 999;

/** What a seam column may contain: ground, and nothing else. */
const PLAIN = new Set([T.GROUND, T.HARD]);
/** What an added enemy may stand on. */
const FOOTING = new Set([T.GROUND, T.HARD]);

/**
 * Characters a duplicated span may not contain.
 *
 * Every one of them is a thing a level has exactly one of, and duplicating any
 * of them breaks something the game states elsewhere: two flags, two bosses,
 * two switches for one wall (`rules.js`), a beanstalk whose sky room is
 * somewhere else, or a warp mouth that leads into the middle of a corridor.
 * `T.QSTAR` is on the list for a softer reason — a level's one star block is a
 * discovery, and three of them is an errand.
 *
 * The set-piece creatures are here too, and which ones is a **count** and not a
 * hunch: `A` the sun and `O` the moon appear once in the level that has them,
 * and `P` the bean baron only in 2-M, where the fight is the one and only
 * source of the popping power-up. A second one of any of those is not a harder
 * level, it is a broken one.
 *
 * `H` the heartburn is deliberately NOT here, and the same count is why: 2-F
 * has eleven and 4-3 twelve. It is a flame that comes out of the floor, i.e.
 * ordinary furniture, and treating it as a set piece cost exactly one level —
 * 2-F could not repeat a single span of itself, because every span in it had a
 * flame in it.
 */
const UNIQUE = new Set([
  '1', T.GOAL, T.DOOR, T.SWITCH, T.VINE, T.WARP_L, T.WARP_R, T.QSTAR,
  'b', 'A', 'O', 'P',
]);

/**
 * The species an added enemy may be: the ones that stand on the ground.
 *
 * Yökki ja paukkupöhö tulivat listalle 16.8.2026 ja ne ovat siinä samalla
 * ehdolla kuin muutkin — vain sellaiseen kenttään jossa laji jo on. Se ehto on
 * tässä poikkeuksellisen tärkeä juuri näille kahdelle: kumpikin tuottaa jotain
 * (pallon, räjähdyksen), joten kappalemäärän tuplaaminen ei tuplaa esteitä vaan
 * niiden lähteitä. Se on nimenomaan se mitä VAIKEA-tason on tarkoitus tehdä, ja
 * se on myös syy siihen ettei kumpaakaan panna kenttään jossa niitä ei ole.
 *
 * Törähdystorvi ja paarma eivät ole listalla, ja se on päätös: torvi on
 * rakenne joka ampuu vaakasuoraan koko käytävän halki, ja paarma on
 * ilmaotus, jolla ei ole `SPACING`illa mitattavaa lattiaa alla. Kummankin
 * paikka on kenttäsuunnittelua eikä satunnaislukua.
 */
const GROUNDLINGS = ['g', 'k', 'c', 'x', 'Y', 'm'];

/**
 * Merkit jotka eivät ole maastoa: ne seisovat maaston päällä tai leijuvat sen
 * yllä. Vauhdinoton mittaus (`seamColumns`) lukee ne tyhjänä, koska juoksijaa
 * hidastaa se mitä maastossa on eikä se kuka siinä sattuu seisomaan.
 */
const LOOSE = new Set([...'gkfprcxAOPHbTZYm1', T.COIN, T.GOAL]);

/* ------------------------------- the seams ------------------------------- */

const columnOf = (rows, x) => {
  let s = '';
  for (const row of rows) s += row[x];
  return s;
};

/** Ground and air only, and at least one tile of ground. */
function isPlain(profile) {
  let ground = false;
  for (const ch of profile) {
    if (ch === T.EMPTY) continue;
    if (!PLAIN.has(ch)) return false;
    ground = true;
  }
  return ground;
}

/**
 * Every column where the grid may be cut, as column indices.
 *
 * A cut before column `x` is legal when the `RUNWAY` columns either side of it
 * are all the same plain profile, and only the commonest such profile in the
 * level is used — mixing two of them would join a two-row floor to a three-row
 * one and put a step where the level author did not draw one.
 *
 * The two halves of that condition answer two different questions, and both had
 * to be asked (see `RUNWAY`): the *same profile* is what makes the joint sound,
 * and the *length* is what makes it fair.
 */
function seamColumns(rows, limit) {
  const w = rows[0].length;
  const profiles = new Array(w);
  for (let x = 0; x < w; x++) profiles[x] = columnOf(rows, x);

  const counts = new Map();
  for (let x = 1; x < limit; x++) {
    if (profiles[x] !== profiles[x - 1] || !isPlain(profiles[x])) continue;
    counts.set(profiles[x], (counts.get(profiles[x]) || 0) + 1);
  }
  let best = null;
  let bestN = 0;
  for (const [profile, n] of counts) if (n > bestN) { best = profile; bestN = n; }
  if (!best) return [];

  /* Jalkojen rivit, ks. `RUN_ROWS`. Reitti on korkeassa kentässä keskikaista;
   * `routeBand` on sama laskenta ja se on siellä missä sitä toinenkin puoli
   * tästä tiedostosta tarvitsee. */
  const [, bottom] = routeBand(rows);
  const feetOf = (x) => {
    let s = '';
    for (let y = bottom - RUN_ROWS; y < bottom; y++) {
      const ch = rows[y][x];
      /* Olennot ja kolikot pois, ja tämäkin on mitattu eikä siisteyttä: kävelijä
       * ja kuori seisovat rivillä 12, joka on jalkojen riveissä, joten
       * merkilleen vertaava sauma hylkäsi jokaisen matkan jolla oli yksikin
       * vihollinen. Se ei ole se kysymys jota tässä kysytään — maasto on sama
       * maasto seisoi sen päällä kuka tahansa. */
      s += LOOSE.has(ch) ? T.EMPTY : ch;
    }
    return s;
  };
  const feet = new Array(w);
  for (let x = 0; x < w; x++) feet[x] = feetOf(x);

  const seams = [];
  for (let x = RUNWAY; x + RUNWAY <= limit; x++) {
    if (profiles[x] !== best || profiles[x - 1] !== best) continue;
    let flat = true;
    for (let i = x - RUNWAY; i < x + RUNWAY && flat; i++) if (feet[i] !== feet[x]) flat = false;
    if (flat) seams.push(x);
  }
  return seams;
}

/** True when nothing in `[from, to)` is a thing the level has only one of. */
function spanRepeatable(rows, from, to) {
  for (const row of rows) {
    for (let x = from; x < to; x++) if (UNIQUE.has(row[x])) return false;
  }
  return true;
}

/**
 * The spans this level offers for repetition, in play order.
 *
 * Seams are thinned to `MIN_SEG` apart before they are paired, so a span is a
 * stretch of level and not a slice of empty floor.
 */
function repeatableSpans(rows, limit) {
  const w = rows[0].length;
  const opening = Math.floor(w * OPENING);
  const marks = [];
  for (const x of seamColumns(rows, limit)) {
    if (x < opening) continue;
    if (!marks.length || x - marks[marks.length - 1] >= MIN_SEG) marks.push(x);
  }
  const spans = [];
  for (let i = 0; i + 1 < marks.length; i++) {
    if (spanRepeatable(rows, marks[i], marks[i + 1])) spans.push([marks[i], marks[i + 1]]);
  }
  return spans;
}

/**
 * The stretched grid, plus how many columns were inserted before each of a
 * caller's marker columns.
 *
 * Returns `null` when the level offers nothing to repeat, which is not a
 * failure: a level too short or too tightly built to have two seams in it
 * simply stays the length it is, and the mode's other half — the crowd — still
 * applies to it.
 */
function stretchRows(rows, mode, limit) {
  const w = rows[0].length;
  const target = Math.round(w * mode.stretch);
  if (target <= w) return null;
  const spans = repeatableSpans(rows, limit);
  if (!spans.length) return null;

  /* Round-robin rather than "repeat the best one N times": every span the level
   * offers gets used before any of them is used twice, so a doubled level is a
   * level heard through once more rather than one bar looped. */
  const copies = new Array(spans.length).fill(0);
  let width = w;
  for (let i = 0; width < target; i++) {
    const span = spans[i % spans.length];
    copies[i % spans.length]++;
    width += span[1] - span[0];
  }

  const pieces = [];
  let cursor = 0;
  let inserted = 0;
  let shiftAtLimit = 0;
  for (let i = 0; i < spans.length; i++) {
    if (!copies[i]) continue;
    const [from, to] = spans[i];
    pieces.push([cursor, to]);
    for (let n = 0; n < copies[i]; n++) pieces.push([from, to]);
    inserted += copies[i] * (to - from);
    if (to <= limit) shiftAtLimit = inserted;
    cursor = to;
  }
  pieces.push([cursor, w]);

  const out = rows.map((row) => {
    let line = '';
    for (const [from, to] of pieces) line += row.slice(from, to);
    return line;
  });
  return { rows: out, shiftAtLimit };
}

/* ------------------------------ the crowd -------------------------------- */

/** A stable 32-bit seed for a string, so the same level rolls the same dice. */
function seedOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Which rows are the route.
 *
 * A tall level is three 15-row rooms stacked (see `assembleTall`), and only the
 * middle one is the level: an enemy added to the sky garden is an enemy nobody
 * meets, and one added to the cave is a punishment for finding a secret.
 */
function routeBand(rows) {
  if (rows.length <= CHUNK_ROWS) return [0, rows.length];
  return [CHUNK_ROWS, 2 * CHUNK_ROWS];
}

/** Every tile an enemy could be added to, in column order. */
function standingSpots(grid, band, taken, limit) {
  const w = grid[0].length;
  const [top, bottom] = band;
  const spots = [];
  for (let x = 1; x < Math.min(w - 1, limit); x++) {
    for (let y = top + 2; y < bottom - 1; y++) {
      if (grid[y][x] !== T.EMPTY) continue;
      if (!FOOTING.has(grid[y + 1][x])) continue;
      if (!FOOTING.has(grid[y + 1][x - 1]) || !FOOTING.has(grid[y + 1][x + 1])) continue;
      if (grid[y][x - 1] !== T.EMPTY || grid[y][x + 1] !== T.EMPTY) continue;
      if (grid[y - 1][x] !== T.EMPTY || grid[y - 2][x] !== T.EMPTY) continue;
      if (taken.some((tx) => Math.abs(tx - x) < SPACING)) continue;
      spots.push([x, y]);
      break;
    }
  }
  return spots;
}

/**
 * Adds `mode.crowd` worth of enemies to an already-stretched grid.
 *
 * The species pool is what the level already contains, so this adds bodies and
 * never vocabulary: a level the player has been taught to read stays a level
 * they have been taught to read. `tools/curriculum.mjs` measures first
 * appearances, and this is what keeps its answer true on every mode.
 */
function crowdRows(rows, mode, seed, limit) {
  if (!mode.crowd) return rows;
  const grid = rows.map((row) => row.split(''));
  const band = routeBand(rows);
  const [top, bottom] = band;

  const present = new Set();
  const taken = [];
  let count = 0;
  let startX = -1;
  let goalX = grid[0].length;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const ch = grid[y][x];
      if (ch === '1') startX = x;
      else if (ch === T.GOAL) goalX = Math.min(goalX, x);
      if (y < top || y >= bottom) continue;
      if (GROUNDLINGS.includes(ch)) present.add(ch);
      if ('gkcxfrpAOPH'.includes(ch)) { taken.push(x); count++; }
    }
  }

  const extra = Math.round(count * mode.crowd);
  if (extra <= 0) return rows;
  const pool = GROUNDLINGS.filter((ch) => present.has(ch));
  const species = pool.length ? pool : ['g'];

  const spots = standingSpots(grid, band, taken, Math.min(limit, goalX - GOAL_CLEAR))
    .filter(([x]) => x > startX + START_CLEAR);
  if (!spots.length) return rows;

  /* Shuffled and then re-spaced: the shuffle is what makes the additions look
   * placed rather than metered, and the spacing pass is what stops three of
   * them landing in one doorway. */
  const rnd = mulberry32(seed);
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }

  let added = 0;
  for (const [x, y] of spots) {
    if (added >= extra) break;
    if (taken.some((tx) => Math.abs(tx - x) < SPACING)) continue;
    grid[y][x] = species[Math.floor(rnd() * species.length)];
    taken.push(x);
    added++;
  }
  return grid.map((row) => row.join(''));
}

/* -------------------------------- the seam ------------------------------- */

/**
 * The level a mode plays, built from the level the data file holds.
 *
 * `rows` in, rows out — the caller (`getLevel`) owns everything else about a
 * level definition, so this touches the grid, the clock and the arena column
 * and nothing at all besides.
 *
 * @param {string} id       the level's id, which is half the random seed
 * @param {object} def      the level definition, read for `vertical` and `boss`
 * @param {string[]} rows   the assembled grid at its shipped length
 * @param {string} mode     mode id
 * @param {number|null} arenaCol where the boss arena starts, or null
 * @returns {{rows: string[], arenaCol: number|null, timeRatio: number}|null}
 *   `null` when this mode leaves the level exactly as it was.
 */
export function scaleLevel(id, def, rows, mode, arenaCol = null) {
  const m = modeOf(mode);
  if (isBaseMode(m.id)) return null;
  /* A climb is one screen wide by rule and its axis is the other one. */
  if (def.vertical || (Array.isArray(def.segments) && def.segments.length)) return null;

  const w = rows[0].length;
  /* Nothing is repeated at or past the arena: the fortress door, the boss and
   * the room they stand in are one shape, and `arenaColumn` is a number the
   * scene uses to put the player back on the doorstep after a death. */
  const limit = arenaCol === null ? w : arenaCol;
  const stretched = stretchRows(rows, m, limit);
  const grown = stretched ? stretched.rows : rows;
  const shift = stretched ? stretched.shiftAtLimit : 0;
  const out = crowdRows(grown, m, seedOf(`${id}:${m.id}`), arenaCol === null
    ? grown[0].length : arenaCol + shift);
  if (out === rows) return null;
  return {
    rows: out,
    arenaCol: arenaCol === null ? null : arenaCol + shift,
    timeRatio: out[0].length / w,
  };
}

/** The clock a scaled level runs, from the clock it had and how much it grew. */
export const scaleTime = (time, ratio) =>
  Math.min(TIME_CAP, Math.round((time * ratio) / 10) * 10);
