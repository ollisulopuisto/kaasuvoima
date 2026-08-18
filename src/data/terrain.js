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
 * is solid"*), joten nostettu maa syö hyppykorkeutta suoraan: se mitä maa
 * nousee, sen katto laskee.
 *
 * Mitattu ennen kuin päätettiin, kahdesti. `verify.mjs`in portti *"anticipating
 * the rise costs neither the headroom nor the ground"* ajaa botin läpi kentän
 * ja pieruhyppää 60 framen välein; korkeimmillaan pelaajan pää oli 1-1:ssä
 * **30,38 px** kannen alapuolella silloin kun kenttä oli viisitoista riviä.
 * Alle kaksi laattaa, ja kolmen laatan nosto kolautti kanteen mitatusti
 * (`pää 0.00 px`).
 *
 * Kenttädata kasvoi kuuteentoista riviin 18.8.2026 (`data/chunks.js`,
 * `SKY_PAD`), ja **lisärivi tuli päälle eikä alle**: lattia laskeutui laatan,
 * kansi ei. Vara on siis 30,38 + 16 = **46,4 px** eli 2,9 laattaa, ja kahden
 * laatan nosto (32 px) jättää siitä 14 px. Kolme (48 px) ei mahdu.
 *
 * Kaksi on siis se mitä tässä ruudussa on varaa nostaa, ja jokainen seuraava
 * rivi kenttädataan ostaa tasan yhden laatan lisää.
 */
export const MAX_LIFT = 2;

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
 * kuka siinä sattuu seisomaan. Puu on listalla samasta syystä eikä
 * poikkeuksena: sen läpi kävellään, joten se ei ole juoksijan tiellä.
 */
export const LOOSE = new Set([...'gkfprcxAOPHbTZYm1', T.COIN, T.GOAL, T.TREE]);

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
export function rampRows(fromTop, toTop, h = ROWS) {
  const rise = toTop < fromTop;
  const n = Math.abs(toTop - fromTop);
  const rows = new Array(h).fill('');
  for (let j = 0; j < n; j++) {
    const surface = rise ? fromTop - 1 - j : fromTop + j;
    for (let y = 0; y < h; y++) {
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

/* --------------------- sama passi valmiille ruudukolle --------------------- */
/**
 * MAASTO GENEROITUUN KENTTÄÄN, ja miksi tämä on toinen toteutus eikä toisinto.
 *
 * DESIGN.md kohta 8 kieltää kaksi tapaa sanoa sama asia, joten tämän on
 * ansaittava paikkansa. Ero on siinä **mitä kutsujalla on käsissään**:
 *
 *   - Kokoaja (`applyTerrain`) pitelee palikkalistaa. Se tietää mistä palikka
 *     alkaa ja mihin se loppuu, ja se voi **työntää sarakkeita väliin** —
 *     rinne on sille uutta tilaa, eikä mikään palikan sisällä siirry.
 *   - Generaattori (`data/generator.js`) ei kokoa palikoita vaan kirjoittaa
 *     ruudukkoon. Sarakkeen lisääminen jälkikäteen siirtäisi kaiken sen
 *     oikealla puolella, ja kentän leveys on siellä mitoitettu luku
 *     (`c.width`, kello, tavoitevaikeus). Siksi tämä passi **ei lisää
 *     saraketta vaan kirjoittaa rinteen tasamaan päälle**: se ottaa
 *     vauhdinotosta sen mitä rinne tarvitsee, ja siksi se vaatii
 *     vauhdinottoa `MAX_LIFT` saraketta enemmän kuin kokoaja.
 *
 * Se mikä on yhteistä, on yhteistä oikeasti: portit (`RUNWAY`, `RUN_ROWS`,
 * `LOOSE`, `MAX_LIFT`), rinteen muoto (`rampRows`) ja se peruslause että maa
 * **nousee ja jättää kiven alle**. Vain sauman löytäminen eroaa — palikkalista
 * kertoo saumat, ruudukko on mitattava.
 *
 * Ruudukon korkeutta ei oleteta. Pinta haetaan pohjasta ylöspäin, joten sama
 * funktio kelpaa 15-, 16- ja 45-riviselle ruudukolle.
 */

/** Sarakkeen pinnan rivi: kiinteän pinon ylin rivi, tai -1 jos pohjaa ei ole. */
export function surfaceRow(rows, x) {
  const h = rows.length;
  if (rows[h - 1][x] !== '#') return -1;
  let y = h - 1;
  while (y > 0 && rows[y - 1][x] === '#') y--;
  return y;
}

/** Maata jaloissa ja tilaa vartalolle: sama kysymys kuin `seamReady`illa. */
function plainColumn(rows, x) {
  const top = surfaceRow(rows, x);
  if (top < 0) return -1;
  for (let y = top - (RUN_ROWS - 2); y < top; y++) {
    const ch = y < 0 ? ' ' : rows[y][x];
    if (ch !== ' ' && !LOOSE.has(ch)) return -1;
  }
  return top;
}

/**
 * Kuinka monta laattaa tämä sarake kestää nousta.
 *
 * Samat kaksi porttia kuin palikalla (`liftCap`), kysyttynä sarakkeelta:
 * ylhäällä on oltava tilaa, ja alin rivi kelpaa täytteeksi vain jos siinä on
 * maata tai tyhjää. Ero on että sarake voi olla kuilu — ja kuilu **saa nousta
 * mukana**, koska sen pohja on tyhjä ja kopioituu tyhjänä.
 */
function columnCap(rows, x, keep) {
  const h = rows.length;
  const fill = rows[h - 1][x];
  if (fill !== '#' && fill !== ' ') return 0;
  if (rows[h - 2][x] !== ' ' && fill !== '#') return 0;
  let blank = 0;
  while (blank < MAX_LIFT && rows[keep + blank][x] === ' ') blank++;
  return blank;
}

/** Yksi sarake nostettuna, kuilut ja kaikki. Ks. `liftRows`. */
function liftColumn(rows, x, lift, keep) {
  const h = rows.length;
  const out = [];
  const fill = rows[h - 1][x];
  for (let y = 0; y < h; y++) {
    out.push(y < keep ? rows[y][x] : (y + lift < h ? rows[y + lift][x] : fill));
  }
  return out;
}

/**
 * Valmiin ruudukon maastopassi. Palauttaa uudet rivit.
 *
 * Sauma vaatii `RUNWAY + MAX_LIFT` saraketta samaa tasaista maata kummallekin
 * puolelle: `RUNWAY` on vauhdinotto ja `MAX_LIFT` se osa jonka rinne syö.
 * Jaksot erotellaan `MIN_SPAN`illa, jotta maasto on maisemaa eikä sahalaita.
 */
const MIN_SPAN = 40;

/*
 * A ROOF IS NOT GROUND, AND `keep` IS THE ROW WHERE THAT STOPS BEING OBVIOUS.
 *
 * The pass lifts whole columns: everything in a column moves up with the ground
 * it stands on, which is what makes this terrain and not a tile edit. Under an
 * open sky there is nothing above to damage, and that is why the pass ran on the
 * four outdoor themes only.
 *
 * The factory has a lid and the bone world has a sky that must stay empty
 * (`ruleFactoryCeiling`, `ruleBoneSky`), and both are *absolute* claims about
 * the top rows rather than claims about the ground. Lifting whole columns broke
 * them from two directions at once: the ceiling rode up with the floor, and the
 * ramps at a span's edges — written as complete columns of sky over ground —
 * erased the lid outright. Measured before this: **all 240 seeds** failed for
 * 4-4, 4-5, 4-6, 5-5 and 5-7, every one of them with *tehtaassa ei ole kattoa*.
 *
 * `keep` is how many rows at the top the pass may not touch. The ground below
 * them rises, the roof stays where the theme put it, and the headroom between
 * the two shrinks by exactly the lift — which is the real cost, and is what
 * `columnCap` now measures by counting its blank rows from `keep` rather than
 * from row 0.
 *
 * The cloud world is not on this list and cannot be: `ruleCloudNoLegs` says
 * nothing solid may stand above the floor at all, and lifted ground is solid
 * ground above the floor by definition. That is a theme refusing terrain, not
 * the pass failing to offer it.
 */
export function liftTerrain(rows, seed, keep = 0) {
  const h = rows.length;
  const w = rows[0].length;
  const need = RUNWAY + MAX_LIFT;
  const tops = new Array(w);
  const caps = new Array(w);
  for (let x = 0; x < w; x++) {
    tops[x] = plainColumn(rows, x);
    caps[x] = columnCap(rows, x, keep);
  }

  /* Saumakelpoinen sarake: sen molemmin puolin on `need` saraketta samaa
   * tasaista maata samalla korkeudella. */
  const seamAt = (x) => {
    const top = tops[x];
    if (top < 0) return false;
    for (let i = x - need; i < x + need; i++) {
      if (i < 0 || i >= w || tops[i] !== top) return false;
    }
    return true;
  };
  const seams = [];
  for (let x = need; x + need < w; x++) {
    if (!seamAt(x)) continue;
    if (!seams.length || x - seams[seams.length - 1] >= MIN_SPAN) seams.push(x);
  }
  if (seams.length < 2) return rows.slice();

  /* Jaksot saumojen väliin. Ensimmäinen ja viimeinen jäävät maan tasalle:
   * aloitus ja lippu ovat ne kaksi kohtaa joista kaikki muu on mitattu. */
  const spans = [];
  for (let i = 0; i + 1 < seams.length; i++) spans.push([seams[i], seams[i + 1]]);
  const roll = rollerFrom(seedOf(seed));
  const grid = rows.map((r) => r.split(''));

  for (const [from, to] of spans) {
    let cap = MAX_LIFT;
    for (let x = from; x < to && cap > 0; x++) cap = Math.min(cap, caps[x]);
    const lift = cap > 0 ? Math.floor(roll() * (cap + 1)) : 0;
    if (!lift) continue;
    for (let x = from; x < to; x++) {
      const col = liftColumn(rows, x, lift, keep);
      for (let y = 0; y < h; y++) grid[y][x] = col[y];
    }
    /* Rinne ylös jakson alkuun ja alas sen loppuun, kirjoitettuna tasamaan
     * päälle sen ulkopuolelle — eli siihen vauhdinottoon josta `need` varasi
     * tilaa juuri tätä varten. */
    writeRamp(grid, from, tops[from], lift, -1, keep);
    writeRamp(grid, to - 1, tops[to - 1], lift, +1, keep);
  }
  return grid.map((r) => r.join(''));
}

/**
 * Rinne jakson reunaan: `dir === -1` kirjoittaa nousun jakson vasemmalle
 * puolelle, `+1` laskun sen oikealle puolelle.
 */
function writeRamp(grid, edge, baseTop, lift, dir, keep = 0) {
  const h = grid.length;
  const ramp = rampRows(baseTop, baseTop - lift, h);
  for (let j = 0; j < lift; j++) {
    /* Nouseva rinne luetaan vasemmalta oikealle, ja laskeva on sen peilikuva:
     * `rampRows` antaa nousun, ja alamäki on sama pylväikkö toisin päin. */
    const src = dir < 0 ? j : lift - 1 - j;
    const x = dir < 0 ? edge - lift + j : edge + 1 + j;
    if (x < 0 || x >= grid[0].length) continue;
    /* From `keep` down only: a ramp is a full column of sky over ground, and
     * writing its sky across a factory lid is how the lid disappeared. */
    for (let y = keep; y < h; y++) {
      const ch = ramp[y][src];
      grid[y][x] = dir < 0 ? ch : (ch === RISE ? FALL : ch);
    }
  }
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
