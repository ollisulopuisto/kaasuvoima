/**
 * MAASTOPASSI — maan korkeus vaihtelee palikoiden välillä.
 *
 * ROADMAP 17.8.2026, mitattu tilanne: *"Lähes jokaisessa palikassa rivit 13-14
 * ovat `G` — eli maan pinta on samalla korkeudella koko pelin ajan. Kaikki
 * vaihtelu on sen yläpuolella olevaa tavaraa."* Rinteet (v26.08.18.13) olivat
 * ensimmäinen kerta kun maa itse liikkuu, mutta `kumpare` palaa aina riville
 * 13: mäki on pala, ei maasto. Tämä tiedosto on se toinen puolisko —
 * **kokoaja päättää kullekin palikalle lattiatason ja kirjoittaa siirtymät
 * rinteinä**, ja maa jää sille tasolle kunnes seuraava siirtymä vie sen pois.
 *
 * ## Se yksi valinta joka teki tästä halvan
 *
 * ROADMAP arvioi tämän kalleimmaksi kolmesta askeleesta, ja perustelu oli
 * oikea mutta se koski toista toteutusta: *"`rules.js`, hyppybudjetti,
 * vaikeusmittari, botti ja jokainen käsintehty kenttä lukevat tällä hetkellä
 * lattiaa rivinä 13."* Se on totta jos maasto **siirretään** — jos palikan
 * rivit 13-14 tyhjenevät kun maa nousee. Silloin `floorProfile`in siemen
 * (`rules.js:332`), `checkGaps`in pohjattomuustesti (`rules.js:513`) ja
 * `difficulty.mjs`:n `lethalCol` lukisivat jokaisen nostetun sarakkeen
 * kuiluna, ja koko lista pitäisi kirjoittaa uusiksi.
 *
 * Maastopassi ei siirrä maata. Se **nostaa pintaa ja jättää kiven alle**:
 * palikan omat rivit kelaantuvat ylös, ja niiden alle jää sitä samaa maata
 * joka palikan alimmalla rivillä oli. Rivit 13-14 ovat siis yhä kiinteät
 * jokaisessa sarakkeessa jossa ne olivat kiinteät ennenkin, ja jokainen yllä
 * lueteltu sääntö näkee täsmälleen sen mitä se on aina nähnyt: maata.
 * `floorProfile` kävelee pinon ylös (`while (y > 0 && stands(...)) y--`), eli
 * se on osannut vaihtelevan korkeuden koko ajan — vain sen siemen oli
 * rivissä 13, ja siemen osuu edelleen.
 *
 * Sama valinta rajaa noston: **maa voi vain nousta**, koska rivi 14 on
 * ruudukon pohja eikä sen alle mahdu mitään. Laskeva maasto odottaa
 * kenttädatan kasvamista 16 riviin (ROADMAP kohta 1).
 *
 * ## Kaksi porttia nostolle, yksi saumalle
 *
 * Ne eivät ole varmuuden vuoksi asetettuja: jokainen niistä on se ehto jonka
 * rikkoutuminen tuottaisi kentän jota mikään muu portti ei huomaa vääräksi.
 *
 * Palikka on **nostettava** kun molemmat pitävät (`liftCap`):
 *
 *   1. **Ylhäällä on tilaa.** `lift` ylintä riviä ovat tyhjiä, koska ne
 *      kelaantuvat ruudukon ulkopuolelle. Tämä on myös se ehto joka pitää
 *      `checkHeadroom`in tyytyväisenä ilmaiseksi: palikka joka vaati kolme
 *      vapaata riviä lattiansa yllä vaatii ne yhä, samat rivit, kolme
 *      pykälää ylempänä.
 *   2. **Alin rivi kelpaa täytteeksi.** Se rivi kopioituu noston alle, joten
 *      siinä saa olla vain maata ja tyhjää: laavalla, piikillä ja putken
 *      suulla on merkitys jota ei saa monistaa. Tyhjä sarake kopioituu
 *      tyhjänä, eli **kuilu pysyy kuiluna** — ja sarake jossa on maata
 *      rivillä 13 mutta ei rivillä 14 hylkää palikan kokonaan, koska
 *      nostettuna se muuttuisi kuiluksi.
 *
 * Kahden palikan väli on **sauma** kun kummallakin puolella on `RUNWAY`
 * saraketta tasaista maata (`seamReady`). Rinne kirjoitetaan siihen väliin ja
 * kohtaa kummankin reunan; reuna jossa on kuoppa, porras tai putki ei ole
 * sauma vaan sattuma, ja reuna jonka takana kuilu alkaa heti ei ole
 * vauhdinottoa vaan ansa.
 *
 * ## Miksi jaksot eivätkä palikat
 *
 * Maa voi vaihtaa tasoa vain saumassa. Siksi lista pilkotaan **jaksoiksi**
 * joiden rajalla sauma on, ja taso valitaan jaksolle eikä palikalle: jakson
 * sisällä palikat nousevat yhdessä, niiden oma liitos säilyy sellaisenaan, ja
 * jakson katto on sen tiukimman palikan katto. Vaihtoehto olisi ollut
 * perääntyvä haku, ja se olisi ollut sama vastaus kalliimmin.
 *
 * **Aloitus ja lippu ankkuroivat oman jaksonsa maan tasalle.** Ne ovat ne
 * kaksi kohtaa joista kaikki muu on mitattu — `spawn`, `tools/playable.mjs`,
 * kentän oma kello — eikä maisema ole niin arvokasta että se kannattaisi
 * ostaa niiden liikuttamisella. Ehto on merkeissä (`1` ja `F`) eikä
 * järjestysluvuissa, koska "ensimmäinen ja viimeinen jakso" olisi ollut sama
 * sääntö arvattuna: 1-1:n `goal` ja `goal_end` ovat eri jaksoja, ja lippu on
 * niistä ensimmäisessä.
 */

import { T } from '../gfx/tiles.js';
import { seedOf } from '../core/utils.js';

/** Palikan lattiapinnan rivi kun sitä ei ole nostettu. Ks. `chunks.js`. */
export const FLOOR_ROW = 13;

/**
 * KORKEIN NOSTO, LAATTOINA — ja tämä luku on **kentän katto**, ei maku.
 *
 * Maailmalla on kansi (`solidAt(x, -1)`, `verify.mjs`: *"the top of the world
 * is solid"*), ja tavallinen kenttä on viisitoista riviä eli tasan 240 px eli
 * yksi ruutu. Nostettu maa siis syö hyppykorkeutta suoraan: se mitä maa
 * nousee, sen katto laskee.
 *
 * Mitattu ennen kuin päätettiin. `verify.mjs`in portti *"anticipating the rise
 * costs neither the headroom nor the ground"* ajaa botin läpi kentän ja
 * pieruhyppää 60 framen välein; korkeimmillaan pelaajan pää on 1-1:ssä
 * **30,38 px** kannen alapuolella ja 2-1:ssä 27–38 px. Se on alle kaksi
 * laattaa. Kahden laatan nosto siis kolauttaisi pelaajan kanteen, ja kolmen
 * nosto teki sen mitatusti: sama portti luki 1-1:stä `pää 0.00 px`.
 *
 * Yksi laatta on siis se mitä tässä ruudussa on varaa nostaa. Se ei ole tämän
 * tiedoston vika eikä sen rajoitus vaan **ruudun korkeuden** — ROADMAPin
 * ensimmäinen kohta (kenttädata 15 → 16 riviin, pystyvieritys takaisin) on
 * juuri se muutos joka nostaa tämän luvun, ja siihen asti maasto liikkuu
 * laatan verran kerrallaan.
 */
export const MAX_LIFT = 1;

const ROWS = 15;

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
 * **Sama luku on nyt kahden säännön alla**, ja se on tarkoituksellista: myös
 * maastopassin sauma on kohta jossa juoksijan alusta muuttuu, ja sen edessä
 * on oltava sama vauhdinotto kuin venytyksen liitoksen. Kun `1-1` sai
 * maastoa yhden sarakkeen ehdolla, botti jäi `pit_plat`in kymmenen
 * sarakkeen kuiluun sarakkeessa 290 — rinne oli vienyt kuudentoista
 * sarakkeen vauhdinoton kolmeen. Täsmälleen sama vika, täsmälleen sama
 * mittaus, ja siksi sama luku eikä toinen.
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
export const RUNWAY = 6;
/**
 * Mitkä rivit ovat "jalat": lattia ja se tila jossa vartalo kulkee.
 *
 * Kaistan alin viisi riviä, eli 10…14 kun lattia on rivillä 13. Pisin hahmo on
 * 43 px eli 2,7 laattaa, joten rivit 10–12 ovat se mitä sen läpi juokseminen
 * vaatii tyhjäksi ja rivit 13–14 se mitä se vaatii kiinteäksi. Kaikki sen
 * yläpuolella — kolikot, lautat, tiilirivit, salaiset huoneet — saa vaihdella
 * vauhdinoton matkalla, koska mikään niistä ei ole juoksijan tiellä.
 */
export const RUN_ROWS = 5;

/**
 * Merkit jotka eivät ole maastoa: ne seisovat maaston päällä tai leijuvat sen
 * yllä. Vauhdinoton mittaus lukee ne tyhjänä — `seamColumns` (`scale.js`) ja
 * `seamReady` täällä — koska juoksijaa hidastaa se mitä maastossa on eikä se
 * kuka siinä sattuu seisomaan.
 */
export const LOOSE = new Set([...'gkfprcxAOPHbTZYm1', T.COIN, T.GOAL]);

const BLANK = /^ *$/;
/** Portti 2: alin rivi kopioituu täytteeksi, joten siinä saa olla vain nämä. */
const FILLABLE = /^[# ]*$/;

/** Nostava rinne `/`, laskeva `\`. Ks. `chunks/common.js` ja generaattorin `hill`. */
const RISE = '/';
const FALL = '\\';

/**
 * Kuinka monta laattaa tämä palikka kestää nousta, 0 kun ei lainkaan.
 *
 * Kaksi porttia yhtenä lukuna, ks. tiedoston alku. Portti 2 on kyllä/ei,
 * portti 1 on se joka antaa luvun.
 */
export function liftCap(chunk) {
  const rows = chunk.rows;
  const fill = rows[ROWS - 1];
  if (!FILLABLE.test(fill)) return 0;
  /* Ja täytteen on **kannettava se mitä sen päälle jää**: sarake jossa on
   * maata rivillä 13 mutta tyhjää rivillä 14 muuttuisi nostettuna kuiluksi,
   * koska `checkGaps` lukee juuri nuo kaksi riviä. Sellaista saraketta ei
   * pitäisi olla missään, ja siksi tämä on portti eikä korjaus. */
  for (let x = 0; x < chunk.w; x++) {
    if (rows[FLOOR_ROW][x] !== ' ' && fill[x] !== '#') return 0;
  }
  let blank = 0;
  while (blank < MAX_LIFT && BLANK.test(rows[blank])) blank++;
  return blank;
}

/**
 * Kestääkö tämä palikan reuna rinteen: `RUNWAY` saraketta tasaista maata.
 *
 * Tämä on **sauman** ehto eikä noston, ja ero on se joka tekee jaksoista
 * jaksoja: rinne kirjoitetaan kahden palikan väliin ja kohtaa kummankin
 * reunan, mutta jakson *sisällä* ei ole rinnettä — siellä palikat nousevat
 * yhdessä ja niiden liitos säilyy sellaisena kuin se on. Siksi reunaehto ei
 * ole osa `liftCap`ia: nostamaton palikka voi olla kelvollinen rinteen pää,
 * ja nostettava palikka voi olla kelvoton sauma.
 *
 * Ja **kuusi saraketta eikä yksi**, mikä on `RUNWAY`in perustelu luettuna
 * toiseen suuntaan. Yhden sarakkeen ehdolla 1-1 sai rinteen kolme saraketta
 * ennen `pit_plat`in kymmenen sarakkeen kuilua: kuudentoista sarakkeen
 * vauhdinotto kutistui kolmeen, ja `tools/playable.mjs` löysi sen heti
 * (`kuilu sarakkeessa 290`). `validateLevel` oli tyytyväinen, koska se mittaa
 * kuilun leveyden eikä sitä paljonko vauhtia sen eteen mahtuu — sama sokea
 * piste kuin venytyksellä, ja siksi sama luku eikä toinen.
 *
 * Jalat ovat `RUN_ROWS` alinta riviä ja `LOOSE` luetaan tyhjänä: kolikko tai
 * kävelijä maan päällä ei hidasta juoksijaa, joten se ei ole tämän kysymys.
 */
export function seamReady(chunk, side) {
  const from = side === 'left' ? 0 : chunk.w - RUNWAY;
  if (from < 0 || from + RUNWAY > chunk.w) return false;
  for (let x = from; x < from + RUNWAY; x++) if (!plainFeet(chunk, x)) return false;
  return true;
}

/** Maata jaloissa, tyhjää vartalon kohdalla — ks. `RUN_ROWS`. */
function plainFeet(chunk, x) {
  const rows = chunk.rows;
  if (rows[FLOOR_ROW][x] !== '#' || rows[FLOOR_ROW + 1][x] !== '#') return false;
  for (let y = ROWS - RUN_ROWS; y < FLOOR_ROW; y++) {
    const ch = rows[y][x];
    if (ch !== ' ' && !LOOSE.has(ch)) return false;
  }
  return true;
}

/**
 * Palikan rivit nostettuna, kuiluineen.
 *
 * Kelaus ylös on suoraviivainen; koko idea on se mitä alle jää. Täyte on
 * palikan **oma alin rivi** eikä kivi, jotta pohjaton kuilu pysyy pohjattomana
 * (portti 2 takaa ettei siinä rivissä ole muuta kuin maata ja tyhjää).
 */
export function liftRows(chunk, lift) {
  if (!lift) return chunk.rows.slice();
  const fill = chunk.rows[ROWS - 1];
  const out = [];
  for (let y = 0; y < ROWS; y++) out.push(y + lift < ROWS ? chunk.rows[y + lift] : fill);
  return out;
}

/**
 * Rinne yhdeltä pinnan riviltä toiselle, `|Δ|` saraketta leveänä.
 *
 * Muoto on sama kuin `SLOPE_CHUNKS.kumpare`ella ja generaattorin `hill`illä,
 * ja se kannattaa lukea kerran ääneen: nousevassa rinteessä `/` on sarakkeen
 * **pinta** ja sen alla on kiveä lattiaan asti, eli rinne on maan pinta eikä
 * kelluva viiva. Laskeva `\` on sama toisin päin.
 */
export function rampRows(fromTop, toTop) {
  const rise = toTop < fromTop;
  const n = Math.abs(toTop - fromTop);
  const rows = new Array(ROWS).fill('');
  for (let j = 0; j < n; j++) {
    const surface = rise ? fromTop - 1 - j : fromTop + j;
    for (let y = 0; y < ROWS; y++) {
      rows[y] += y < surface ? ' ' : y === surface ? (rise ? RISE : FALL) : '#';
    }
  }
  return rows;
}

/**
 * Palikkalista jaksoiksi: yhden jakson sisällä maa ei voi vaihtaa tasoa.
 *
 * Raja kulkee siinä missä rinteen voi kirjoittaa, eli kahden reunoiltaan
 * tasaisen palikan välissä. Jakson katto on sen palikoiden pienin `liftCap`.
 */
function runsOf(chunks) {
  const runs = [];
  chunks.forEach((chunk, i) => {
    const seamHere = i > 0 && seamReady(chunks[i - 1], 'right') && seamReady(chunk, 'left');
    if (!runs.length || seamHere) {
      runs.push({ from: i, to: i, cap: liftCap(chunk), anchored: isAnchor(chunk) });
    } else {
      const run = runs[runs.length - 1];
      run.to = i;
      run.cap = Math.min(run.cap, liftCap(chunk));
      run.anchored = run.anchored || isAnchor(chunk);
    }
  });
  return runs;
}

/** Aloitus ja lippu: se mitä ei siirretä. Ks. tiedoston alku. */
const ANCHOR = /[1F]/;
const isAnchor = (chunk) => chunk.rows.some((row) => ANCHOR.test(row));

/** xorshift-32, siemenestä. Sama kenttä arpoo saman maaston joka kerta. */
function rollerFrom(seed) {
  let s = seed || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * Kunkin palikan lattiataso, laattoina maan pinnasta ylöspäin.
 *
 * Arvonta on siemenestä johdettu, joten kenttä on joka latauksella sama
 * kenttä: vaihteleva maasto ei ole ajossa arvottua sisältöä vaan kentän
 * ominaisuus, ja jokainen portti mittaa sitä samaa ruudukkoa jota pelataan.
 */
export function terrainProfile(chunks, seed) {
  const runs = runsOf(chunks);
  const roll = rollerFrom(seedOf(seed));
  const lift = new Array(chunks.length).fill(0);
  runs.forEach((run) => {
    const ceiling = run.anchored ? 0 : Math.min(run.cap, MAX_LIFT);
    const level = Math.floor(roll() * (ceiling + 1));
    for (let j = run.from; j <= run.to; j++) lift[j] = level;
  });
  return lift;
}

/**
 * Palikkarivit ja niiden väliin kirjoitetut rinteet, yhtenä ruudukkona.
 *
 * Palauttaa myös `shift`in: montako saraketta kunkin palikan eteen syntyi.
 * Kutsuja tarvitsee sen, koska palikkaleveyksien summa ei enää ole sarake —
 * ks. `arenaColumn` (`levels.js`).
 */
export function applyTerrain(chunks, lift) {
  const rows = new Array(ROWS).fill('');
  const shift = new Array(chunks.length).fill(0);
  let inserted = 0;
  let prevTop = null;
  chunks.forEach((chunk, i) => {
    const top = FLOOR_ROW - lift[i];
    if (prevTop !== null && top !== prevTop) {
      const ramp = rampRows(prevTop, top);
      for (let y = 0; y < ROWS; y++) rows[y] += ramp[y];
      inserted += Math.abs(top - prevTop);
    }
    shift[i] = inserted;
    const lifted = liftRows(chunk, lift[i]);
    for (let y = 0; y < ROWS; y++) rows[y] += lifted[y];
    prevTop = top;
  });
  return { rows, shift };
}
