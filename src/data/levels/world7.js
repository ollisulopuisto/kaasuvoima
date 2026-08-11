/**
 * World 7 — KAASUKEHÄ, the atmosphere, and the last world before the castle.
 *
 * ## The two things this world had to get right
 *
 * **It must not read as the bonus room, stretched.** The game has had a sky
 * since world 1: every tall level carries a hidden band above it, reached by a
 * beanstalk, and `sky_garden` is already a place made of planks in the air. A
 * whole world of clouds that felt like that would not merely be dull, it would
 * cheapen a secret that took real work to make findable.
 *
 * The difference is the floor, and it is measured rather than argued
 * (`verify.mjs`, "pilvimaailmassa on lattia, bonushuoneessa ei"). A bonus room
 * has no floor at all and everything you can stand on in it is a plank; the
 * two horizontal levels of this world have packed cloud under nine columns in
 * ten, and the planks are a minority of the footing. In one sentence: **the
 * sky band is somewhere you hop, kaasukehä is somewhere you walk.** The second
 * difference is what is absent — there is no beanstalk and no sky band
 * anywhere in this world, because the whole rhetoric of that secret is
 * climbing out above the world, and there is nothing above this one.
 *
 * The climb, `7-T`, has no row 13 to measure and is therefore outside that
 * gate; it makes the same claim on its own axis and it is asserted there
 * ("pystykentät kentissä" in `verify.mjs`): half of everything you can stand
 * on in it is packed cloud, against the bonus room's nought per cent. The
 * world's sentence survives the change of axis rather than being dropped
 * quietly with it.
 *
 * **And it must be passable at the smallest size, all the way down.** A world
 * of clouds is a pit for its whole length unless somebody decides otherwise;
 * `chunks/cloud.js` decides, in its first paragraph, that packed cloud is
 * ground. Everything below is built on ordinary `#`.
 *
 * ## What each level is for, and what it measures
 *
 *   7-1  the layers: two heights, nothing to fall into, then holes
 *   7-T  the dip, on the other axis: a climb, where falling is a setback
 *   7-3  the anvil: every hole the world owns, and the one place with a roof
 *   7-F  the keep, and the weather lord
 *
 * ## Where the difficulty comes from
 *
 * **Holes and height, never bridges.** Rule 2 in `chunks/cloud.js` — thin cloud
 * is never over nothing — means no plank in this world spans a hole, so every
 * one of them is jumped. That is the opposite trade from luulaakso's
 * `bone_ribs`, and it is why this world scores above world 6 without any hole
 * being wider: a bridged hole scores no gap risk at all, and there are no
 * bridged holes here.
 *
 * **And the decks are not free.** The difficulty meter charges for narrow
 * footing, which is exactly right for a world whose vertical vocabulary is
 * planks: every deck is a landing you have to aim. That term is this world's
 * signature the way gap risk was luulaakso's.
 *
 * Where two holes would otherwise run together, `flat8` — eight columns of
 * nothing — is the cheapest breath the vocabulary has. Never three in a row:
 * that is the arrangement world 6 measured as the one that breaks the promise,
 * because a landing is only as good as the run-up it leaves and a standing jump
 * carries 0 px sideways.
 */

import { GENERATED_LEVELS } from '../generated.js';

/** Which of the generated levels belong to this world — the file holds them all. */
const generated = Object.fromEntries(Object.entries(GENERATED_LEVELS)
  .filter(([id]) => id.startsWith('7-')));

export const WORLD7_LEVELS = {
  /*
   * The world opens on `cloud_bank`, which is the grammar with nothing at
   * stake: two standable heights, one of them thin enough to fall through, and
   * nothing at all to fall into. Only then a hole.
   *
   * `cloud_updraft` comes third because the climb is what makes this world
   * vertical rather than merely high, and it is worth teaching while the floor
   * underneath is still unbroken — a player who learns the four-tile step here
   * reads `cloud_anvil` in 7-3 without being told.
   */
  '7-1': {
    theme: 'cloud', bg: 'clouds', music: 'cloud',
    chunks: [
      'start', 'cloud_bank', 'power', 'cloud_hole', 'cloud_squall', 'cloud_updraft',
      'cloud_hole_wisp', 'cloud_blocks', 'cloud_hail', 'cloud_hole', 'cloud_bank',
      'cloud_hole_deck', 'cloud_gate', 'cloud_lattice', 'cloud_hole_wisp',
      'cloud_squall', 'cloud_hole', 'cloud_flock', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * TERMIIKKI — pelin toinen pystykenttä, ja se seisoo maailman
   * hengähdyspaikalla, koska juuri se paikka on tässä pelissä varattu uudelle
   * asialle.
   *
   * Omistajan pyyntö sanatarkasti: *"pilvimaailmaan pystykenttä, sellainen
   * jossa hypitään lavalta lavalle ylöspäin eikä putoaminen tapa, vähän kuin
   * Rainbow Islands."*
   *
   * ## Miksi tämä korvaa juuri 7-2:n
   *
   * Vanha 7-2 oli tämän maailman notko: samat palikat kuin 7-1:ssä, reiät pois.
   * `node tools/variety.mjs` mittaa sen, ja luku on syy eikä jälkiperustelu:
   * **7-2 oli maailman 7 vähiten uusi kenttä, uutuus 17,6 %**, ja 82,4 % sen
   * muodoista oli 7-1:n muotoja. Se ei sanonut mitään mitä edeltäjänsä ei ollut
   * jo sanonut. Toiseksi vähiten uusi oli 7-3 (18,4 %), eli ero on ohut — ja
   * silloin ratkaisee toinen mittaus: 7-3 on maailman ainoa katollinen paikka
   * ja sen `cloud_anvil`in kansi on se ylin lauta jolta `verify.mjs` mittaa
   * maahaniskun tappavuuden. Sen purkaminen olisi purkanut mittauksen; 7-2:n
   * purkaminen ei purkanut mitään.
   *
   * Ja vanhan kentän oma perustelu jää voimaan sanasta sanaan — se vain koskee
   * nyt eri sisältöä: *"hengähdys on siellä missä uteliaisuuteen on varaa."*
   * Se on täsmälleen se argumentti jonka nojalla **uusi akseli** kuuluu juuri
   * tähän kohtaan maailmaa eikä sen huipulle: pelaaja tapaa ensimmäisen kerran
   * kentän jota kuljetaan ylöspäin siinä kohdassa käyrää jossa virheellä on
   * pienin hinta. Mitattu: 7-2 oli 180,2 ja tämä on 202,5, eli notko pysyy
   * notkona — maailman seuraavaksi helpoin on 233,7.
   *
   * ## Kaksi asiaa omistajan lauseesta, ja molemmat ovat rakenteessa
   *
   * **1. Putoaminen on takaisku, ei kuolema.** Tässä kentässä ei ole yhtään
   * tappavaa ruutua, ja lisäksi *jokaisen* tasanteen jokaisen sarakkeen alla on
   * jotain enintään seitsemän rivin päässä, eli aina alle yhden ruudullisen
   * (13 riviä). Pudotus maksaa siis enintään sen mitä kamera näyttää kerralla
   * — yhden sivullisen kiipeämistä — eikä koskaan kenttää. Vaikeusmittarin
   * `KUILU%` lukee sen nollana, ja se nolla on tämän kentän koko lupaus lukuna:
   * mittari kysyy juuri "mistä osasta jalansijaa pudotus vie yli ruudullisen".
   *
   * **2. Tämä ei ole bonushuone venytettynä**, ja se on sama väite jonka varaan
   * koko maailma on rakennettu (ks. tiedoston alku). Bonushuoneessa ei ole
   * lattiaa lainkaan ja sen jokainen jalansija on lautaa; täällä **73 %
   * jalansijasta on pakattua pilveä** (`#`) — samaa maata kuin maailman 1 nurmi
   * — ja loput ohutta (`-`). Se on mitattu portissa ("pystykentässäkin
   * kaasukehällä on lattia, bonushuoneella ei").
   *
   * `chunks/cloud.js`:n sääntö 1 sanoo että tässä maailmassa ei seiso mikään,
   * eikä yhtään `#`:ää ole lattiarivien yläpuolella. Sääntö on kirjoitettu
   * kentälle jota kuljetaan sivuttain, ja siellä se on oikea: pilvikukkula
   * tyhjän päällä olisi mäki joka ei kanna itseään. Pystykentässä koko kenttä
   * **on** taivas, eikä pilvipankki korkeudella ole mäki vaan pankki — se ei
   * kannattele mitään, se kelluu, mikä on tasan se mitä pilvi tekee. Sääntö
   * kääntyy siis samaksi lauseeksi toisella akselilla eikä katoa hiljaa.
   *
   * ## Muoto: kaksi pankkia ja sauma, ja sauma on ohut mitatusta syystä
   *
   * Vasen pankki on sarakkeet 0–10, oikea 9–19, ja **ne menevät päällekkäin
   * sarakkeissa 9 ja 10**. Käärme nousee vuorotellen vasemmalle ja oikealle, ja
   * päällekkäisyys on se mikä tekee siitä kiivettävän: sen ansiosta on aina
   * sarake joka kuuluu sekä siihen pankkiin jolla seisot että siihen jolle olet
   * menossa, eli hyppy otetaan omalta lavalta eikä sen reunan yli.
   *
   * **Ja sauma — sarakkeet 8–11 — on ohutta pilveä, koska pakattu pilvi on
   * katto.** Tämä on kentän ainoa kohta joka on kirjoitettu botin punaisesta:
   * ensimmäinen versio oli pankkia laidasta laitaan, ja `tools/playable.mjs`
   * sanoi **JUMISSA, 2 % kiivetty, rivi 48** — kiipeilijä hyppää suoraan sen
   * lavan alta jolle se on menossa, ja `#`:n alapinta pysäytti hypyn 16
   * pikselin jälkeen. Ohuen pilven läpi noustaan; pakatun päälle noustaan.
   * Kentän jokainen puola on siis ohut siitä sarakkeesta josta se otetaan ja
   * pakattu siitä mille lasketaan — mikä on samalla se lause jonka tämä maailma
   * on koko ajan sanonut sivusuunnassa, luettuna pystyyn.
   *
   * Yksi puola on kokonaan ohutta, ja sekin on botin sanelema eikä koriste:
   * **alin, rivin 45 puola.** Kaikki muut otetaan toiselta puolalta, jolloin
   * lähtösarake on aina se kahden pankin päällekkäisyys; tämä otetaan
   * pilvipankin pohjalta, joka on kaksikymmentä saraketta leveä, eikä
   * lähtösaraketta voi siis rajata mihinkään. Se on ainoa puola jonka jokainen
   * sarake on lähtösarake, joten sen jokainen sarake on ohut.
   *
   * Askelmat ovat 3 ja 4 ruutua (korpuksen mediaani 4, p90 6; meidän mitattu
   * `wallTiles` 4). **Kolmen ruudun askelma otetaan paikaltaan, neljän vaatii
   * vauhdin**, ja juuri sen eron vaikeusmittari laskee: neljän ruudun askelmia
   * on neljä, ja ne ovat tämän kentän vaikeus.
   *
   * ## PANKIT EIVÄT ENÄÄ MENE PÄÄLLEKKÄIN, JA SE OLI VIKA EIKÄ TYYLI
   *
   * Tässä luki *"päällekkäiset pankit tekevät sivusiirtymästä nollan"*, ja se
   * oli totta: puolat olivat `########---` ja `---########`, ja ne jakoivat
   * sarakkeet 9–10. Se tarkoitti sitä että **oli sarake jolla oli jalansija
   * joka ikisellä askelmalla** — eli kentän saattoi läpäistä hyppimällä
   * paikallaan, koskematta ohjaimen sivusuuntiin kertaakaan. Raportoitu
   * pelaamalla, ei mistään portista.
   *
   * Nyt vasen pankki loppuu sarakkeeseen 9 ja oikea alkaa sarakkeesta 11, eli
   * **sivusiirtymä on yksi sarake eikä nolla**. Yksi eikä kaksi, ja se on
   * mitattu eikä valittu: neljän ruudun nousulla mitattu hyppy kantaa tasan
   * yhden sarakkeen (`climbCarry`), joten kaksi olisi tehnyt joka toisesta
   * askelmasta mahdottoman — ensimmäinen yritys teki, ja `checkClimb` sanoi sen
   * heti. Sääntö on nyt `checkClimbTraverse`, ja se kaatoi tämän kentän,
   * 6-K:n ja `verify.mjs`:n oman koekentän samalla lauseella.
   *
   * **Rivin 44 hylly on umpiperä, ja se on siellä tarkoituksella.** Kolmen
   * ruudun lauta pohjapankin yllä, josta ei pääse ylemmäs — lähin lava on
   * neljä saraketta sivussa ja nouseva hyppy kantaa kolme. DESIGN.md kohdan 5
   * pystymuoto vaatii että sellainen kantaa palkinnon neljän rivin sisällä, ja
   * tässä se on kolme kolikkoa rivillä 43. Se on kentän ainoa paikka jossa
   * sääntö oikeasti laukeaa, ja siksi se on tässä: sääntö jota mikään
   * toimitettu kenttä ei koettele on sääntö jota ei ole koeteltu.
   *
   * Väki on säätä, ja sekin seuraa säännöstä eikä mausta: `rules.js` vaatii
   * että kävelevä vihollinen seisoo *kiinteän* päällä (`checkEnemyFooting`),
   * eikä lauta ole kiinteä. Saumassa ei siis voi seistä kukaan, ja koko kentän
   * väki on niitä jotka eivät seiso: ruskea pilvi (`r`), tämän maailman oma, ja
   * lentäjä (`f`).
   *
   * `time: 400` eikä oletus 300. Oletus tulee kentän *leveydestä*, joka on
   * pystykentässä 20 saraketta eli aina se pienin mahdollinen luku, ja se olisi
   * hiljainen virhe: putoaminen on tämän kentän mekaniikka, ja kello on ainoa
   * asia joka voi muuttaa takaiskun tappioksi.
   */
  '7-T': {
    theme: 'cloud', bg: 'clouds', music: 'cloud', vertical: true, time: 400,
    rows: [
      '                    ',
      '                    ',
      '                    ',
      '                    ',
      '    F               ',
      '#######---          ',
      '                    ',
      '            oo      ',
      '           ---######',
      '                    ',
      '                r   ',
      '   oo               ',
      '#######---          ',
      '                    ',
      '                    ',
      '           ---######',
      '                    ',
      '                    ',
      '#######---          ',
      '                    ',
      '                    ',
      '            oo      ',
      '           ---######',
      '                    ',
      '                    ',
      '#######---          ',
      '                    ',
      '                    ',
      '           ---######',
      '                    ',
      '    f               ',
      '   oo               ',
      '#######---          ',
      '                    ',
      '                    ',
      '           ---######',
      '                    ',
      '                    ',
      '#######---          ',
      '                    ',
      '                    ',
      '                    ',
      '           ---######',
      '  ooo               ',
      '  ---         !     ',
      '-----------         ',
      '                    ',
      '  1                 ',
      '####################',
      '####################',
    ],
  },
  /*
   * The peak, and the only level in the world with a roof over part of it.
   *
   * `cloud_anvil` sits in the middle, where a player has already met every
   * piece it is made of: the four-tile step from `cloud_updraft`, the deck from
   * `cloud_bank`, the walkers from everywhere. What it adds is the one thing
   * this world has that no other world has — enough air above the floor for the
   * ground pound to land lethal — and it adds it as a place to go rather than a
   * thing to do, because the ground route walks underneath it and the bot that
   * proves this level at power 0 does exactly that.
   *
   * Both `flat8`s sit where three holes would otherwise have run together.
   */
  '7-3': {
    theme: 'cloud', bg: 'clouds', music: 'cloud',
    chunks: [
      'start', 'cloud_bank', 'power', 'cloud_hole', 'cloud_hole_deck', 'flat8',
      'cloud_hole_wisp', 'cloud_hail', 'cloud_anvil', 'cloud_hole', 'cloud_hole_deck',
      'flat8', 'cloud_hole_wisp', 'cloud_lattice', 'cloud_flock', 'cloud_hole',
      'cloud_squall', 'cloud_blocks', 'cloud_hole_deck', 'cloud_hole', 'cloud_gate',
      'cloud_updraft', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * The keep. `bg: 'none'` is the shared fortress room, drawn in the cloud
   * palette, and the corridors are the shared `fort_*` pieces like every other
   * world's fortress.
   *
   * That is a deliberate reversal and the one thing this level says: **a wall
   * is the one thing cloud cannot make.** Every other room in this world is
   * open on all six sides, so arriving somewhere with a ceiling and a floor and
   * two ends is arriving somewhere that was *built* — and what is holding the
   * weather down is not weather.
   *
   * **Five `fort_gap`s and no `fort_trench`**, both halves measured rather than
   * chosen. The trench is nine tiles of lava with one plank in the middle and it
   * is where the power-0 bot gives up in 5-F; `fort_gap` is six tiles of open
   * lava with nothing over it, harder to read and easier to cross, and the
   * meter agrees with the hands for once because a bridged hole scores no gap
   * risk while a bare one scores the maximum. None of the five is adjacent to
   * another.
   *
   * `music: 'cloud'` and not `'fortress'`, following 6-F: the engine plays the
   * `boss` track until the fight ends, so this line only decides what comes
   * back afterwards, and after the weather lord falls the weather should.
   */
  /* `7-4`…`7-7`, generated; the spread's position is the play order. */
  ...generated,
  '7-F': {
    theme: 'cloud', bg: 'none', music: 'cloud', boss: true, bossVariant: 5,
    chunks: [
      'start', 'spire_gate', 'spire_climb', 'spire_hail', 'spire_hole', 'spire_hail',
      'spire_hole', 'spire_lattice', 'spire_hole', 'spire_hail', 'spire_hole', 'spire_hail',
      'boss_arena',
    ],
  },
};
