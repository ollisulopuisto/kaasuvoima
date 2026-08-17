import { hashNoise } from '../core/utils.js';

export const TILE = 16;

/** Level map characters. Anything not listed here is treated as empty air. */
export const T = {
  EMPTY: ' ',
  GROUND: '#',
  HARD: 'X',
  BRICK: 'B',
  QCOIN: '?',
  QPOWER: '!',
  QSTAR: '*',
  USED: 'u',
  COIN: 'o',
  PLATFORM: '-',
  PIPE_TL: '[',
  PIPE_TR: ']',
  PIPE_BL: '{',
  PIPE_BR: '}',
  SPIKE: '^',
  LAVA: 'W',
  QUICKSAND: '~',
  CRUMBLE: '%',
  SWITCH: 'S',
  GOAL: 'F',
  DOOR: 'D',
  NOTE: 'N',
  VINE: 'v',
  WARP_L: '(',
  WARP_R: ')',
  LUMP: 'C',
  ICE: 'I',
  /* Tehostus maassa: poimitaan kävelemällä, ei puskemalla. Ks. `LevelScene`in
   * kenttäskannaus ja `rules.js`:n `gates` — tämä on se merkki jolla
   * tehostusportti lunastetaan. */
  GIFT: 'i',
  SPRING: 'J',
  LAMP: 'L',
  LAMP_LIT: 'l',
  SHELF: 'G',
};

const S = { solid: true };
const SEMI = { semi: true };

export const TILE_INFO = {
  [T.GROUND]: { ...S },
  [T.HARD]: { ...S },
  [T.BRICK]: { ...S, breakable: true, bumpable: true },
  [T.QCOIN]: { ...S, question: 'coin', bumpable: true },
  [T.QPOWER]: { ...S, question: 'power', bumpable: true },
  /* Looks exactly like the other two on purpose. A block that announced what
   * is in it would turn the one big surprise in a level into an errand. */
  [T.QSTAR]: { ...S, question: 'star', bumpable: true },
  [T.USED]: { ...S, bumpable: true },
  [T.NOTE]: { ...S, note: true, bumpable: true },
  [T.PIPE_TL]: { ...S, pipe: true },
  [T.PIPE_TR]: { ...S, pipe: true },
  [T.PIPE_BL]: { ...S, pipe: true },
  [T.PIPE_BR]: { ...S, pipe: true },
  [T.PLATFORM]: { ...SEMI },
  /* The beanstalk. Deliberately not solid: you climb through it, and a vine you
   * could also stand on would be a ladder with leaves painted on. */
  [T.VINE]: { climb: true },
  /* A pipe that leads to another band of the same level. Solid like any pipe;
   * the travelling is in the scene, because only it knows how tall a band is. */
  [T.WARP_L]: { ...S, pipe: true, warp: true },
  [T.WARP_R]: { ...S, pipe: true, warp: true },
  /* Solid until you stand on it. The timer lives on the scene, not here —
   * `TILE_INFO` describes what a character *is*, never what it is doing. */
  [T.CRUMBLE]: { ...S, crumble: true },
  [T.SWITCH]: { ...S, bumpable: true, switch: true },
  /*
   * PONNAHDUSLAUTA — kaasusuihku lattiassa, ja se on kiinteä laatta eikä oma
   * lajinsa. Kiinteä siksi että sen päällä *seistään*: se on lattiaa jolla on
   * mielipide siitä mihin suuntaan lattian kuuluu työntää. Kaikki mikä lukee
   * lattiaa — kuiluvalidointi, seinien korkeus, botti, hyppyratkaisija —
   * lukee sen oikein ilman että yhdellekään niistä opetetaan mitään.
   *
   * `spring` on lippu eikä käytös, kuten `crumble`: `TILE_INFO` kertoo mikä
   * laatta *on*, eikä koskaan mitä se juuri nyt tekee. Nosto on
   * `LevelScene.updateSprings`in asia, koska vain se tietää kuka laatan päällä
   * seisoo ja kuinka täynnä hänen vauhtimittarinsa on.
   */
  [T.SPRING]: { ...S, spring: true },
  [T.COIN]: { coin: true },
  [T.SPIKE]: { hazard: true },
  [T.LAVA]: { hazard: true },
  /*
   * JUOKSUHIEKKA. Not solid, not semi-solid, and pointedly **not** `hazard`.
   *
   * All three of those are decisions and each one is the answer to a question
   * somebody will ask again:
   *
   *   - not solid, because you go *into* it. A solid quicksand tile would be a
   *     patch of floor with a scary picture on it, and every rule in the game
   *     that asks "does a body fit here" would answer about a wall that is not
   *     there. Standing on it is exactly what the tile refuses to let you do.
   *   - not semi-solid either. A plank is something you land on from above and
   *     pass through from below; sand is the other way round entirely — you
   *     sink through it downwards and you have to climb out.
   *   - not `hazard`, because `hazard` in this file means "touching it hurts",
   *     which is spikes and lava. Quicksand does not hurt on contact at all: it
   *     takes seconds, it is escapable the whole time, and what kills is going
   *     under rather than touching. Marking it a hazard would have handed it to
   *     `LevelScene.playerTiles`, which knows only how to deal damage.
   *
   * So it carries its own flag and `Player` owns the behaviour — see
   * `quicksandSurface` there, which is the only reader of this line.
   */
  /*
   * MÖYKKY — se yksi laatta joka tottelee painovoimaa.
   *
   * IDEAS.md kohta 10 (Boulder Dash) hyväksyttiin **yhdelle laattatyypille**,
   * ja se mikä laatta se on, on tämän työn koko suunnittelupäätös. Ehto tulee
   * ROADMAPin 10.8.2026 rajasta: putoava laatta on maastoa joka liikkuu, joten
   * se saa olla vain sellainen laatta jonka katoaminen ei voi poistaa reittiä.
   *
   * **Yksikään olemassa oleva laatta ei kelvannut, ja se on mittaustulos eikä
   * mieltymys.** Maa, kova palikka, tiili, puulava, palkintolohko ja putki
   * ovat kaikki lattiaa, seinää, askelmaa tai kattoa jossakin kentässä, ja
   * `playable.mjs`, `validateLevel` ja `difficulty.mjs` lukevat ne kaikki
   * pysyvinä. Mureneva lauta (`%`) oli lähimpänä — se katoaa jo nyt ja kasvaa
   * takaisin — mutta putoava lauta **laskeutuisi jonnekin muualle**, ja
   * laatta uudessa paikassa on kentän muokkaus siinä missä laatta poissa
   * paikastaan: se voi tukkia käytävän tai tehdä askelman jota lähtötilassa ei
   * ollut. Siksi tämä on uusi merkki eikä vanha uudessa virassa.
   *
   * Kolme ehtoa tekee siitä turvallisen, ja kaikki kolme ovat portteja
   * (`src/data/rules.js`, `checkFalling`) eivätkä lupauksia:
   *
   *   1. **Se ei roiku.** Lähtötilassa sen alla on kiinteä ruutu, joten kenttä
   *      ei muokkaa itseään ensimmäisellä framella — muuten jokainen portti
   *      mittaisi kenttää jota ei enää ole.
   *   2. **Sen päällä ei ole mitään.** Ei palkintoa, ei lavaa, ei reittiä.
   *      Laatan päälle rakennettu reitti on reitti joka voi kadota.
   *   3. **Sen tuki ei ole mureneva lauta.** Mureneva lauta on ainoa ruutu
   *      jonka *vihollinen* voi poistaa (laki 2), ja reiluussääntö sanoo että
   *      vain pelaajan aloittama ketju saa satuttaa häntä. Kielto tekee
   *      säännöstä rakenteellisen: kaikki muut tuen poistajat — päänpuski,
   *      potkaistu kuori, kytkin — ovat pelaajan tekoja.
   *
   * Ja se palaa kotiruutuunsa (`LevelScene.updateFalls`), samasta syystä kuin
   * mureneva lauta kasvaa takaisin: palautuva muutos on tilapäinen tapahtuma
   * staattisessa kentässä, palautumaton olisi olio joka muokkaa kenttää.
   *
   * Nimi on tämän pelin sanastoa eikä lainaa: kaasu, ruoansulatus, ummetus.
   * Möykky on kalkkeutunut möhkäle joka on juuttunut suolen seinään, ja
   * ummetuskorkin sukua — se ei ole kivi eikä lohkare, koska tässä pelissä ei
   * ole vuoria vaan sisuskaluja.
   */
  [T.LUMP]: { ...S, falls: true },
  /*
   * JÄÄ — se laatta joka päättää kuinka hyvin sen päällä seisova pysähtyy.
   *
   * `SURFACES` oli 10.8.2026 asti **teemakohtainen**: koko maailma 3 oli
   * liukas, mutta vain vihollisille, koska pelaaja ei lukenut taulua lainkaan.
   * Sen rivin perustelu on yhä `SURFACES`in kommentissa ja se pitää yhä:
   * maailman 3 kahdeksan kenttää on mitoitettu tavallisen kitkan varaan, joten
   * pelaajan kitkan pudottaminen *teeman* perusteella kuluttaisi juuri sen
   * marginaalin jonka DESIGN.md kohta 5 lupaa.
   *
   * Siksi jää on laatta eikä teeman ominaisuus, ja ero on muutoksen hinnassa:
   * teemana se muuttaisi kahdeksan kenttää yhdellä committilla, laattana se ei
   * muuta yhtäkään ennen kuin joku ladotaan jonnekin. Samalla se kantaa
   * maailmaa 3 pidemmälle — jäinen kieleke luumaailmassa, liukas kulkusilta
   * tehtaassa — ja se on koko syy tehdä se näin päin.
   *
   * `surface` **nimeää** rivin `SURFACES`ista eikä kopioi sen lukuja. Laatta
   * sanoo mitä ainetta se on, taulu sanoo mitä se aine tekee, ja kumpaakin on
   * siksi tasan yksi.
   */
  [T.ICE]: { ...S, surface: 'ice' },
  [T.QUICKSAND]: { quicksand: true },
  /*
   * KAASULYHTY — kentän puolivälin tarkistuspiste, ja **kaksi merkkiä eikä
   * yksi**, koska sammunut ja palava lyhty ovat kentän kannalta eri laattoja.
   *
   * Sytytys on siis ruudukon kirjoitus (`L` → `l`) eikä kohtauksen kirjanpitoa,
   * ja se on sama ratkaisu kuin kolikolla ja rikotulla tiilellä. Siitä seuraa
   * kolme asiaa ilmaiseksi:
   *
   *   1. **Pikatallennus muistaa sen.** `savestate.js` tallentaa ruudukon, joten
   *      palautettu tilannekuva palauttaa myös liekin. Kohtauksen omana
   *      muuttujana se olisi pitänyt lisätä erikseen, ja se on juuri se laji
   *      unohdusta jonka `save.js`:n `doors` jo maksoi kerran.
   *   2. **Piirto ei tarvitse tilaa.** `drawTile` saa merkin ja tietää kumpi
   *      kuva piirretään; vaihtoehto olisi ollut kuljettaa kohtauksen tila
   *      `opts`issa asti niin kuin kytkimellä, ja kytkin tekee niin siksi että
   *      se on koko kentän laajuinen — lyhty on yksi ruutu.
   *   3. **Kysymys "onko tämä sytytetty" on merkkivertailu** eikä hakua
   *      listasta, ja `plantLamp` löytää molemmat muodot samasta ruudusta.
   *
   * Kumpikaan ei ole kiinteä eikä vaarallinen: lyhty on koriste jonka läpi
   * kävellään. Se on tahallista. Tarkistuspiste jonka voi *ohittaa hyppäämällä*
   * olisi ansa jota ei näe, ja tarkistuspiste jota vasten törmätään olisi este
   * jonka kenttä sai lahjaksi keskeltä juoksuaan.
   */
  [T.LAMP]: { lamp: true },
  [T.LAMP_LIT]: { lamp: true, lit: true },
  /*
   * PIERUHYLLY — se mitä seinään osunut laukaus jättää jälkeensä.
   *
   * IDEAS-synteesi A, tuomio 16.8.2026 "tee". Kukka antaa pelille sen ainoan
   * rakennusverbin: laukaus joka litistyy seinää vasten jää kolmen ruudun
   * kaasupatjaksi kahdeksi sekunniksi, ja sen päälle voi astua.
   *
   * **Puolikiinteä eikä kiinteä**, ja se on koko laatan turvallisuus. Sen läpi
   * mennään alhaalta ylös ja sen päälle laskeudutaan, joten hylly ei voi
   * sulkea käytävää, tukkia hyppyä eikä puristaa ketään seinää vasten —
   * pahimmillaan se on askelma jota ei tarvinnut. Kiinteänä se olisi ollut
   * ammuttava seinä, ja ammuttava seinä on eri peli.
   *
   * Ja se **katoaa itsestään** (`SHELF_LIFE`), samasta syystä kuin mureneva
   * lauta kasvaa takaisin: tilapäinen tapahtuma staattisessa kentässä on
   * turvallinen, pysyvä muutos maastoon ei ole. Kenttä jonka voi rakentaa
   * umpeen ei ole enää se kenttä jonka portit todistivat läpäistäväksi.
   */
  [T.SHELF]: { ...SEMI, shelf: true },
  [T.GOAL]: { goal: true },
  /* The fortress exit. The flag is what the scene asks — "is this tile a
   * door" — in `playerTiles` and in the edge test that shapes the drawing; it
   * used to be declared here and read nowhere, with `ch === T.DOOR` written
   * out at every call site instead. */
  [T.DOOR]: { door: true },
};

/**
 * What a character reads as while a switch is running.
 *
 * One direction only, and that is a decision rather than an omission: bricks
 * become coins, coins do not become bricks. A two-way swap is the classic
 * trick, but it can turn the tile a player is standing in into a wall, and
 * being sealed inside solid rock by a timer is not a puzzle. Everything here
 * only ever makes the level *less* solid, so no state it produces can trap you.
 */
export const SWITCH_MAP = { [T.BRICK]: T.COIN };

export const info = (ch) => TILE_INFO[ch] || {};
export const isSolid = (ch) => !!info(ch).solid;
export const isSemi = (ch) => !!info(ch).semi;

/**
 * MITÄ MAA ANTAA SEN PÄÄLLÄ OLEVALLE — yksi taulu, ja kaikki lukevat sen.
 *
 * ROADMAP 10.8.2026, laki 1: *jää on liukas kaikille*. Laki on yksisuuntainen
 * (maasto → olio) ja siksi turvallinen: kenttä ei muutu, vain se mitä sen
 * päällä oleva keho pystyy tekemään.
 *
 *   `steer`  kuinka kovaa keho voi muuttaa omaa vauhtiaan omilla jaloillaan,
 *            px/framea². Tavallisella maalla se on **8**, mikä on enemmän kuin
 *            mikään tässä pelissä koskaan pyytää (nopein tavoite on kuoren 3,4),
 *            eli tavoite saavutetaan yhdellä framella ja mikään ruohon,
 *            aavikon, tehtaan, luun, pilven tai linnakkeen päällä ei muuttunut.
 *            Se ei ole arvio vaan mitattu: `verify.mjs` ajaa kävelijän 60
 *            framea ruoholla ja saa täsmälleen `speed * 60`.
 *   `drift`  kuinka nopeasti *ulkopuolinen* työntö — tuuli, laki 3 — vaimenee
 *            jalkojen alla. Tavallisella maalla 0,05 px/framea², eli suunnilleen
 *            pelaajan oma kitka (`FRICTION_SMALL` 0,0391, `FRICTION_BIG`
 *            0,0547): maassa seisova keho vastustaa puuskaa yhtä hyvin kuin
 *            pelaaja vastustaa sitä paikallaan seistessä. Ilmassa se ei vaimene
 *            lainkaan, koska ilmassa ei ole mitään mitä vasten työntää — se on
 *            se lause joka tekee "tuuli kantaa" -laista lain eikä koristeen.
 *
 * **Jään luku on `steer` 0,01 ja `drift` 0,01**: neljäsosa pelin pienimmästä
 * kitkasta. Kävelijä tarvitsee 55 framea päästäkseen vauhtiinsa ja liukuu
 * käännöksensä yli, ja jäälle työnnetty asia ei pysähdy jalkoihinsa.
 *
 *   `grip`   kuinka suuri osa kehon **omasta jarrutusvallasta** on jäljellä.
 *            Kerroin eikä kiihtyvyys, koska jarruja on pelaajalla kolme
 *            (`FRICTION_SMALL` 0,0391, `FRICTION_BIG` 0,0547, `SKID` 0,125)
 *            eikä yksi, ja kerroin pitää niiden keskinäiset suhteet ennallaan.
 *
 *            **Vain jarrutus, ei kiihdytys, ja se on tämän erän tärkein
 *            päätös.** `ACC` (0,0547) on se luku josta koko mitattu
 *            hyppybudjetti johtuu (`tools/jump-budget.json`,
 *            `tools/measure-jump.mjs`): jos jää hidastaisi kiihtymistä, jokainen
 *            jään lähellä oleva kuilu olisi mitoitettu vauhdinotolla jota siinä
 *            ei ole, eikä sitä huomaisi mistään. Se on myös oikea tuntuma —
 *            jäällä ei ole vaikeaa lähteä vaan pysähtyä — ja se on se lause
 *            joka pitää `tools/playable.mjs`:n todistuksen voimassa: botti
 *            pitää oikeaa pohjassa eikä koskaan jarruta, joten se mittaa jään
 *            päällä täsmälleen saman kuin ilman jäätä.
 *
 * **Jään luvut ovat `steer` 0,01, `drift` 0,01 ja `grip` 0,4.** Kaksi
 * ensimmäistä ovat neljäsosa pelin pienimmästä kitkasta: kävelijä tarvitsee 55
 * framea päästäkseen vauhtiinsa ja liukuu käännöksensä yli, ja jäälle työnnetty
 * asia ei pysähdy jalkoihinsa. Kolmas on mitattu eikä valittu, ja mitta on
 * `tools/measure-braking.mjs`: ks. PHYSICS.md, jossa molemmat sarakkeet ovat
 * rinnakkain.
 *
 * **Mitä tässä ei enää ole:** teema ei liu'uta pelaajaa. Se rivi luki tässä
 * 10.8.2026 asti, ja `T.ICE`:n kommentti kertoo miksi se vaihtoi paikkaa
 * laatalle — lyhyesti: maailman 3 kahdeksan kenttää on mitoitettu tavallisen
 * kitkan varaan, ja teema muuttaisi ne kaikki kerralla. Vihollisille teema on
 * yhä voimassa (`Enemy.surface`), koska ne on mitattu sen kanssa.
 */
export const SURFACES = {
  default: { steer: 8, drift: 0.05, grip: 1 },
  ice: { steer: 0.01, drift: 0.01, grip: 0.4 },
};

/** The surface a body standing in this theme is standing on. */
export const surfaceOf = (themeName) => SURFACES[themeName] || SURFACES.default;

/**
 * Se maa jonka päällä tämä keho **seisoo**, tai null jos mikään sen jalkojen
 * alla oleva laatta ei nimeä ainetta.
 *
 * Sama rivi ja samat sarakkeet kuin `moveY`:n jalansijahaulla, ja tahallaan:
 * jos "mitä minun alla on" vastattaisiin eri ruuduista kuin "seisonko minä
 * jollakin", ne kaksi erkanisivat juuri reunalla, joka on ainoa paikka jossa
 * kysymyksellä on väliä.
 *
 * **Pienin pito voittaa.** Jalka jää laatalla on jalka jäällä, vaikka toinen
 * olisi kivellä — se on sama valinta kuin `quicksandSurface`in "ylin rivi
 * voittaa": laatta väittää itsestään, eikä naapuri kumoa sitä. Käytännössä se
 * tarkoittaa että pito palaa vasta kun koko keho on ohittanut viimeisen
 * jäälaatan, eli noin laatan myöhemmin kuin silmä odottaa — ja siksi
 * `checkIce`in reunavara mitataan viimeisestä jääsarakkeesta.
 *
 * Palauttaa null eikä oletusta, koska kutsujia on kaksi ja ne haluavat eri
 * varapaikan: vihollinen putoaa teemaan, pelaaja ei. Se ero on päätös ja se on
 * kirjoitettu auki kummallekin kutsupaikalle.
 */
export function surfaceUnder(level, body) {
  const ty = Math.floor((body.y + body.h) / TILE);
  const x0 = Math.floor(body.x / TILE);
  const x1 = Math.floor((body.x + body.w - 1) / TILE);
  let found = null;
  for (let tx = x0; tx <= x1; tx++) {
    const named = SURFACES[info(level.tileAt(tx, ty)).surface];
    if (named && (!found || named.grip < found.grip)) found = named;
  }
  return found;
}

/**
 * `surface` picks how ground tiles are dressed (blades, ripples, rivets…),
 * everything else is straight palette.
 */
export const THEMES = {
  grass: {
    surface: 'grass',
    sky: ['#5c94fc', '#93c3ff'],
    ground: '#a05820', groundDark: '#6b3a12', groundTop: '#3ea23a', groundTopDark: '#25731f',
    brick: '#c8601c', brickDark: '#7a3410', brickLight: '#e8945c',
    hard: '#c8c8d8', hardDark: '#6f6f8a', hardLight: '#eaeaf6',
    pipe: '#3ea23a', pipeDark: '#1c6b1f', pipeLight: '#8fe04a',
    hill: '#2f8f3a', hillDark: '#1d6b28',
    cloud: '#ffffff',
  },
  desert: {
    surface: 'sand',
    sky: ['#f0a860', '#ffd9a0'],
    ground: '#d8a048', groundDark: '#9c6a24', groundTop: '#f0c060', groundTopDark: '#c08c30',
    brick: '#d8a040', brickDark: '#8c5c18', brickLight: '#f4cc84',
    hard: '#e0c090', hardDark: '#8c6a3c', hardLight: '#f6e2be',
    pipe: '#c88030', pipeDark: '#7c4a10', pipeLight: '#f0b060',
    hill: '#c89040', hillDark: '#9c6a24',
    cloud: '#fff0dc',
  },
  /**
   * YÖ — aavikon oma pimeä puoli, ja pelin pitkäaikaisin näkyvyysvirhe.
   *
   * Tiili oli `#7a5a30` ja maa on `#6a5030`: kaksi nimeä samalle ruskealle.
   * `verify.mjs` mittasi parin eroksi **0,4 %**, koko pelin heikoimman, eli
   * 2-N:n rikottava lohko oli lattiaa vasten käytännössä näkymätön. Se ehti
   * ohjata kahta muuta päätöstä ennen kuin se korjattiin — juoksuhiekka jätettiin
   * pois 2-N:stä ja pilviteema rakennettiin 25 %:n kynnykseen — mikä on hyvä
   * muistutus siitä että näkymätön mekaniikka maksaa muualla kuin siinä
   * kentässä jossa se asuu.
   *
   * **Tiili liikkui, maa ei.** Se on omistajan päätös ja sillä on hintansa
   * molempiin suuntiin: 2-N:n lattia näyttää täsmälleen entiseltä, mutta koko
   * ero on ostettava tiilen puolelta yhdessä paletissa joka on tarkoituksella
   * puristettu pimeään päähän.
   *
   * Uusi tiili on **kuunvalon haalistamaa lautaa**: vaaleampi, kuivempi ja
   * hitusen harmaampi kuin maan lämmin multa, eli kaksi eri ainetta eikä saman
   * aineen kaksi sävyä. Sama vastaus kuin luulaaksossa ja pilvikerroksessa,
   * ainoastaan hillitympi, koska tässä maailmassa ei ole päivänvaloa myytävänä.
   * Mitattu ero maahan **17,8 %** (0,4 %:sta), eli yli kaksinkertainen pelin
   * heikoimpaan selviytyneeseen pariin (aavikko 8,6 %) nähden.
   *
   * **Miksi tähän ja ei kirkkaammalle.** Ylärajan antaa mitattu sääntö jota
   * kaikki kahdeksan teemaa noudattavat: kova palikka on teemansa kirkkain
   * kiinteä ruutu. Yön kova palikka on luminanssiltaan 133,1 ja tämä tiili
   * 130,3 — pelivaraa jää 2,8. Sitä kirkkaampi lauta tekisi valonsa itse
   * (yössä ei ole mitään mikä sen valaisisi) ja kääntäisi nurin merkin jonka
   * pelaaja on oppinut viidessä maailmassa: kirkkain on se jota ei voi rikkoa.
   * Jään 22,3 %:iin yltävä lauta mitattiin, ja se vaati luminanssin 142 eli
   * kirkkaamman kuin oma kivi ja yhtä kirkkaan kuin keskipäivän aavikon tiili.
   * Se olisi ollut numero ilman yötä.
   *
   * `brickDark` tummeni samalla maan alle (`#684230` vastaan maan `#6a5030`),
   * joten lankkujen saumat lukevat varjoina eivätkä maan sävynä — ks. `drawBrick`.
   */
  night: {
    surface: 'sand',
    sky: ['#0d1030', '#2a2350'],
    ground: '#6a5030', groundDark: '#3e2c18', groundTop: '#8a6a3c', groundTopDark: '#5c4424',
    brick: '#c88a62', brickDark: '#684230', brickLight: '#f4c4a0',
    hard: '#8a86a0', hardDark: '#4a4660', hardLight: '#b4b0c8',
    pipe: '#7a5220', pipeDark: '#4a3010', pipeLight: '#a87a3a',
    hill: '#3a2f52', hillDark: '#241d38',
    cloud: '#3a3560',
  },
  ice: {
    surface: 'snow',
    sky: ['#2c4c9c', '#8cb8e8'],
    ground: '#a8c8e8', groundDark: '#5c7ca8', groundTop: '#eaf6ff', groundTopDark: '#a8c8e8',
    brick: '#8cb0d8', brickDark: '#4c6c98', brickLight: '#c8e0f8',
    hard: '#dcecff', hardDark: '#7c9cc4', hardLight: '#ffffff',
    pipe: '#4cc0c0', pipeDark: '#1c7878', pipeLight: '#8ce8e8',
    hill: '#7c9cd0', hillDark: '#4c6c98',
    cloud: '#ffffff',
  },
  factory: {
    surface: 'metal',
    sky: ['#2a2438', '#4a3c50'],
    ground: '#6a6478', groundDark: '#3c3848', groundTop: '#9a94ae', groundTopDark: '#5c5670',
    brick: '#b06030', brickDark: '#6c3a18', brickLight: '#e09050',
    hard: '#a8b0c0', hardDark: '#585f70', hardLight: '#d8e0f0',
    pipe: '#c05820', pipeDark: '#7a3410', pipeLight: '#f09040',
    hill: '#3a3450', hillDark: '#282238',
    cloud: '#5a5470',
  },
  /**
   * LUUMAAILMA — maailma 6, tehtaan jälkeen.
   *
   * Kaksi päätöstä, ja molemmat ovat vastaus siihen että teemakohtaiset
   * ruutumuodot on peruttu (ROADMAP ✘ 9.8.2026). Kun siluetti on kaikissa
   * maailmoissa sama, koko ero on aineessa ja värissä, eli aine kantaa sen
   * työn jonka muoto olisi kantanut:
   *
   *   - **maa on luuta ja tiili on hautamultaa.** Ne eivät ole saman värin
   *     kaksi sävyä vaan kaksi eri ainetta, ja `verify.mjs` mittaa eron: tässä
   *     teemassa se on koko pelin suurin. Se ei ole makuasia — tiili hajoaa ja
   *     maa ei, ja se on ainoa erotus jonka pelaaja ehtii tehdä hypyn aikana.
   *   - **taivas on keskiyö.** Danse macabre on kello kaksitoista yöllä, ja
   *     `drawBackdrop` osaa jo tähdet ja kuun — teema vain pyytää niitä.
   *
   * Vihreä putki on tarkoituksella jäänyt pois: luulaakson putki on patinoitua
   * kuparia (`pipe`), koska ruohon vihreä putki hautausmaalla lukisi kasvina.
   */
  bone: {
    surface: 'bone',
    sky: ['#0a0a18', '#2c2440'],
    ground: '#b8b09c', groundDark: '#6e6858', groundTop: '#efe8d4', groundTopDark: '#a8a08c',
    brick: '#4a3020', brickDark: '#281a10', brickLight: '#6e4a30',
    hard: '#e8e0cc', hardDark: '#8a8270', hardLight: '#fffaf0',
    pipe: '#4a8a78', pipeDark: '#1e4a40', pipeLight: '#7cc0a8',
    hill: '#2a2a40', hillDark: '#1a1a2c',
    cloud: '#3c3a52',
  },
  /**
   * KAASUKEHÄ — maailma 7, pilvikerroksen päällä.
   *
   * Tämä teema on se jonka pitäisi kaatua omaan kontrastiporttiinsa: valkoista
   * valkoisella on koko maailman lähtökohta, ja jos tiili sulautuu maahan, se
   * ei näytä bugilta vaan siltä että palikoita ei ole. Yön pari (`#7a5a30` ja
   * `#6a5030`, mitattuna 0,4 %) oli todiste siitä että näin käy vahingossa —
   * tämän teeman kynnys rakennettiin sitä lukua vasten, ja yö on sittemmin
   * korjattu erikseen. Kynnys jää: se on olemassa tämän teeman takia.
   *
   * Vastaus on ettei kumpikaan ole valkoinen samasta syystä: **maa on
   * auringon puolelta valaistua pohjapilveä ja tiili on ukkospilveä.** Kaksi
   * eri pilveä, ei saman pilven kaksi sävyä, ja `verify.mjs` mittaa eron.
   *
   * Messinkinen putki on saman päätöksen kolmas kohta. Ruohon vihreä tai jään
   * turkoosi olisi tässä paletissa haalea, ja valkoinen putki valkoista pilveä
   * vasten ei ole putki vaan aukko — messinki on ainoa lämmin väri koko
   * teemassa ja siksi ainoa asia jonka silmä löytää heti.
   *
   * Taivas on tummempi ylhäällä kuin alhaalla, päinvastoin kuin ruoholla ja
   * aavikolla. Se on korkeuden ainoa ilmainen merkki: ilmakehä ohenee ylöspäin,
   * ja pilvikerroksen päällä horisontti on kirkkaampi kuin zeniitti.
   */
  cloud: {
    surface: 'cloud',
    sky: ['#2a5cc0', '#bcdcf8'],
    ground: '#dfe8f8', groundDark: '#9aa8c8', groundTop: '#ffffff', groundTopDark: '#c2d0ea',
    brick: '#7c86ac', brickDark: '#4e5678', brickLight: '#a8b2d4',
    hard: '#eef4ff', hardDark: '#98a4c0', hardLight: '#ffffff',
    pipe: '#d0a850', pipeDark: '#8a6c20', pipeLight: '#f0d488',
    hill: '#b8c6e4', hillDark: '#8e9cc0',
    cloud: '#ffffff',
  },
  fortress: {
    surface: 'stone',
    sky: ['#101018', '#282840'],
    ground: '#8a8aa0', groundDark: '#4a4a60', groundTop: '#a8a8c0', groundTopDark: '#6a6a84',
    brick: '#9a7a9a', brickDark: '#5a3c5a', brickLight: '#c4a4c4',
    hard: '#b0b0c8', hardDark: '#606078', hardLight: '#d8d8ec',
    pipe: '#7a7a98', pipeDark: '#3c3c58', pipeLight: '#a8a8c4',
    hill: '#30304c', hillDark: '#20203a',
    cloud: '#3a3a58',
  },
};

/**
 * MAAILMAN VÄRI YHTENÄ SÄVYNÄ, johdettuna paletista eikä kirjoitettuna toiseen
 * kertaan.
 *
 * Kuninkaan muodonvaihto (`Boss.stomp`, `LevelScene.onKingForm`) pukee ruudun
 * sen maailman väriin josta saapuva muoto tulee, ja ainoa tapa jolla se voi
 * mennä pieleen hiljaa on että väri kopioidaan toiseen tauluun ja paletti
 * siirtyy myöhemmin ilman sitä. Siksi tämä lukee `THEMES`iä eikä lisää yhtään
 * uutta sävyä: mitään ei ole keksitty, kaikki on jo ruudulla.
 *
 * **Kuusi maata, ei koko palettia ja ei yhtä ruutua.** Teemassa on myös tiili,
 * kova palikka, putki ja pilvi, mutta ne ovat *kalustoa* — sama tiili seisoo
 * kolmessa maailmassa lähes samanvärisenä, ja niiden mukaan laskettu keskiarvo
 * kutistaa kaikki kahdeksan teemaa samaan harmaaseen (mitattuna heikoin pari
 * 5,5 % koko paletista, 6,5 % ilman taivasta). Yksi kenttä yksinään taas
 * kaatuu toiseen suuntaan: pelkkä `groundTop` on jäällä, luulla ja pilvellä
 * kolme kertaa lähes valkoinen (heikoin pari 3,9 %). Maa, sen varjo, sen pinta
 * ja taustan kukkulat ovat se osa palettia joka **on** se paikka, ja niiden
 * keskiarvona heikoin pari on 12,7 % eli reilusti yli sen 8,6 %:n jonka peli
 * jo sietää (aavikon maa vastaan aavikon tiili).
 *
 * Taivas on jätetty pois tarkoituksella vaikka se erottaisi hyvin: verho
 * piirretään pomohuoneeseen jonka yllä ei ole taivasta, ja väri jota ei voi
 * nähdä siinä maailmassa jota se nimeää olisi arvoitus eikä muistutus.
 */
const TINT_KEYS = ['ground', 'groundDark', 'groundTop', 'groundTopDark', 'hill', 'hillDark'];

/** @returns [r,g,b] 0..255, or null for a theme that does not exist. */
export function themeTint(name) {
  const th = THEMES[name];
  if (!th) return null;
  const acc = [0, 0, 0];
  for (const key of TINT_KEYS) {
    const c = th[key];
    for (let i = 0; i < 3; i++) acc[i] += parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  }
  return acc.map((v) => Math.round(v / TINT_KEYS.length));
}

function bevel(ctx, x, y, w, h, light, dark) {
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x + w - 1, y, 1, h);
}

/* -------------------------------- ground -------------------------------- */

/** The dressing on the top edge of a ground tile, one per theme. */
function surfaceCap(ctx, x, y, th, tx, ty) {
  const n = hashNoise(tx, ty);
  switch (th.surface) {
    case 'grass':
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(x, y, TILE, 5);
      // blades poking into the air above the tile
      for (let i = 0; i < 5; i++) {
        const bn = hashNoise(tx * 5 + i, ty);
        if (bn < 0.45) continue;
        const bx = x + Math.floor(bn * 14);
        ctx.fillRect(bx, y - 1, 1, 1);
        if (bn > 0.85) ctx.fillRect(bx, y - 2, 1, 1);
      }
      ctx.fillStyle = th.groundTopDark;
      ctx.fillRect(x, y + 4, TILE, 2);
      for (let i = 0; i < 3; i++) {
        const bn = hashNoise(tx + i * 3, ty * 2);
        ctx.fillRect(x + Math.floor(bn * 13), y + 1, 1, 3);
      }
      break;

    case 'sand':
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(x, y, TILE, 5);
      ctx.fillStyle = th.groundTopDark;
      ctx.fillRect(x, y + 5, TILE, 1);
      // wind ripples
      for (let i = 0; i < 3; i++) {
        const bn = hashNoise(tx * 3 + i, ty + 5);
        ctx.fillRect(x + Math.floor(bn * 11), y + 2 + (i % 2), 4, 1);
      }
      break;

    case 'snow':
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(x, y - 1, TILE, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y - 1, TILE, 2);
      ctx.fillStyle = th.groundTopDark;
      ctx.fillRect(x, y + 5, TILE, 1);
      if (n > 0.72) {                       // an icicle hanging off the lip
        ctx.fillStyle = '#dceeff';
        const ix = x + Math.floor(n * 12);
        ctx.fillRect(ix, y + 6, 1, 3);
        ctx.fillRect(ix, y + 6, 2, 1);
      }
      break;

    case 'metal':
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(x, y, TILE, 4);
      ctx.fillStyle = th.hardLight;
      ctx.fillRect(x, y, TILE, 1);
      ctx.fillStyle = th.groundTopDark;
      ctx.fillRect(x, y + 4, TILE, 2);
      ctx.fillStyle = th.hardDark;
      ctx.fillRect(x + 2, y + 1, 2, 2);
      ctx.fillRect(x + 12, y + 1, 2, 2);
      break;

    /*
     * Luu: kalkkikuori, jonka alla on tummempi sauma, ja siitä nousee silloin
     * tällöin sirpale. Sirpale on sama idea kuin ruohon korsi ja jään puikko —
     * yksi pikseli ruudun ulkopuolella, jotta reuna ei ole viivotinsuora — mutta
     * se osoittaa YLÖS eikä alas: jään puikko roikkuu, luunsirpale seisoo.
     * Muotoa tämä ei muuta, koska muoto on yhä 16x16 laatta.
     */
    case 'bone':
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(x, y, TILE, 4);
      ctx.fillStyle = th.hardLight;
      ctx.fillRect(x, y, TILE, 1);
      ctx.fillStyle = th.groundTopDark;
      ctx.fillRect(x, y + 4, TILE, 2);
      if (n > 0.66) {
        const sx = x + 2 + Math.floor(n * 11);
        ctx.fillStyle = th.hardLight;
        ctx.fillRect(sx, y - 2, 1, 2);
        ctx.fillRect(sx, y - 3, 1, 1);
        ctx.fillStyle = th.groundTopDark;
        ctx.fillRect(sx + 1, y - 1, 1, 1);
      }
      break;

    /*
     * Pilven harja. Sama idea kuin ruohon korrella, jään puikolla ja luun
     * sirpaleella — yksi asia ruudun ulkopuolella, jottei reuna ole
     * viivotinsuora — mutta se on **pyöreä ja leveä** eikä terävä ja kapea.
     * Kuhmu ylöspäin, ei piikkiä: pilven yläreuna on ainoa reuna tässä pelissä
     * jonka pitää lukea pehmeänä, ja terävä yksityiskohta samassa paikassa
     * lukisi rakeena eli vaarana. Muotoa tämä ei muuta, koska muoto on yhä
     * 16x16 laatta.
     */
    case 'cloud':
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(x, y, TILE, 5);
      ctx.fillStyle = th.hardLight;
      ctx.fillRect(x, y, TILE, 2);
      ctx.fillStyle = th.groundTopDark;
      ctx.fillRect(x, y + 5, TILE, 1);
      if (n > 0.55) {
        const bx = x + 1 + Math.floor(n * 8);
        ctx.fillStyle = th.hardLight;
        ctx.fillRect(bx, y - 2, 5, 2);
        ctx.fillRect(bx + 1, y - 3, 3, 1);
      }
      break;

    default:                                 // stone
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(x, y, TILE, 4);
      ctx.fillStyle = th.groundTopDark;
      ctx.fillRect(x, y + 4, TILE, 2);
      ctx.fillStyle = th.hardLight;
      ctx.fillRect(x, y, TILE, 1);
      break;
  }
}

function drawGround(ctx, x, y, th, openAbove, tx, ty) {
  ctx.fillStyle = th.ground;
  ctx.fillRect(x, y, TILE, TILE);

  // body texture: strata for sand, panels for metal, blocks for stone, specks else
  if (th.surface === 'sand') {
    ctx.fillStyle = th.groundDark;
    for (let i = 0; i < 2; i++) {
      const n = hashNoise(tx + i * 7, ty * 3);
      ctx.fillRect(x + Math.floor(n * 6), y + 8 + i * 4, 6 + Math.floor(n * 6), 1);
    }
  } else if (th.surface === 'metal') {
    ctx.fillStyle = th.groundDark;
    ctx.fillRect(x + 7, y, 2, TILE);
    ctx.fillRect(x, y + 10, TILE, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y + 6, TILE, 1);
    if (hashNoise(tx, ty) > 0.8) {                 // rust patch
      ctx.fillStyle = 'rgba(160,70,30,0.35)';
      ctx.fillRect(x + 2, y + 11, 5, 4);
    }
  } else if (th.surface === 'snow') {
    // packed ice: a couple of long cracks instead of dirt specks
    ctx.fillStyle = th.groundDark;
    const n = hashNoise(tx, ty);
    ctx.fillRect(x + 2 + Math.floor(n * 5), y + 8, 1, 5);
    ctx.fillRect(x + 3 + Math.floor(n * 5), y + 10, 4, 1);
    if (n > 0.55) {
      ctx.fillRect(x + 11, y + 7, 1, 4);
      ctx.fillRect(x + 9, y + 9, 3, 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x + 1, y + 7, 3, 1);
  } else if (th.surface === 'bone') {
    /*
     * Huokoinen luu: pystysuora ydinontelo ja sen ympärillä huokosia. Tämä on
     * ainoa maapinta pelissä jonka kuvio on PYSTY — hiekan kerrokset, metallin
     * paneelit ja kiven saumat ovat kaikki vaakaan — ja se on koko syy miksi
     * luulaakso erottuu kävellessä eikä vain paikallaan seistessä: vaakakuvio
     * liukuu kameran mukana, pystykuvio pilkkoutuu sarakkeisiin.
     */
    const n = hashNoise(tx, ty);
    ctx.fillStyle = th.groundDark;
    ctx.fillRect(x + 4 + Math.floor(n * 3), y + 6, 2, TILE - 6);
    ctx.fillRect(x + 11, y + 8, 1, TILE - 8);
    for (let i = 0; i < 4; i++) {
      const hn = hashNoise(tx * 5 + i, ty * 9 + i * 2);
      ctx.fillRect(x + 1 + Math.floor(hn * 13), y + 7 + Math.floor(hn * 7), 1, 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x + 2, y + 9, 1, 4);
    ctx.fillRect(x + 13, y + 7, 1, 5);
  } else if (th.surface === 'cloud') {
    /*
     * Tiivistynyttä pilveä, ja koko kuvion tehtävä on sanoa **mihin suuntaan
     * tämä on painunut kasaan**: kaaret ovat vaakaan ja alareuna hajoaa.
     *
     * Se on maailman koko fiktio yhdessä laatassa. Pilvi on maata siksi että
     * oma paino on pakannut sen, joten yläpinta on kiinteä ja alapinta on
     * hilseilevä — pisteet harvenevat ylhäältä alas, eli laatta on sitä
     * vähemmän ainetta mitä kauempana sen kannesta ollaan. Ainoa maapinta
     * pelissä jonka kuvio on epäsymmetrinen pystysuunnassa: hiekan kerrokset
     * ja kiven saumat näyttävät samalta kummin päin tahansa, tämä ei.
     */
    const n = hashNoise(tx, ty);
    ctx.fillStyle = th.groundDark;
    for (let i = 0; i < 3; i++) {
      const an = hashNoise(tx * 3 + i, ty * 7);
      ctx.fillRect(x + 1 + Math.floor(an * 5), y + 7 + i * 3, 5 + Math.floor(an * 5), 1);
    }
    // The underside frays: a scatter that thins upward, so the bottom row of
    // the tile is the loosest and the top of the tile is the packed part.
    for (let i = 0; i < 7; i++) {
      const fn = hashNoise(tx * 11 + i, ty * 5 + i * 3);
      const py = y + 8 + Math.floor(fn * 8);
      if (fn * 8 < (py - y - 8) * 0.6) continue;
      ctx.fillRect(x + Math.floor(hashNoise(i, tx + ty) * 15), py, 1, 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + 2, y + 6, 6, 1);
    if (n > 0.6) ctx.fillRect(x + 9, y + 9, 4, 1);
  } else if (th.surface === 'stone') {
    ctx.fillStyle = th.groundDark;
    const off = (tx + ty) % 2 ? 0 : 8;
    ctx.fillRect(x, y + 7, TILE, 1);
    ctx.fillRect(x + off, y, 1, 7);
    ctx.fillRect(x + ((off + 8) % 16), y + 8, 1, 8);
  } else {
    ctx.fillStyle = th.groundDark;
    for (let i = 0; i < 5; i++) {
      const n = hashNoise(tx * 7 + i, ty * 13 + i * 3);
      const px = Math.floor(n * 14);
      const py = (openAbove ? 7 : 1) + Math.floor(hashNoise(ty + i, tx - i) * (openAbove ? 8 : 14));
      if (py < TILE - 1) ctx.fillRect(x + px, y + py, 2, 2);
    }
  }

  if (openAbove) surfaceCap(ctx, x, y, th, tx, ty);

  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(x, y + TILE - 1, TILE, 1);
  ctx.fillRect(x + TILE - 1, y, 1, TILE);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x, openAbove ? y + 6 : y, 1, TILE - (openAbove ? 6 : 0));
}

/* -------------------------------- blocks -------------------------------- */

/**
 * A breakable tile is boarded-up timber, not masonry: three upright planks
 * nailed to a cross-batten.
 *
 * Two things make it readable rather than merely different. The planks run
 * *vertically* while every solid surface in the game runs horizontally, so the
 * grain alone separates breakable from ground at speed. And it carries a hard
 * outline on all four sides — ground and hard tile seamlessly into each other,
 * so a framed box is by definition a thing rather than a wall. The material
 * also has to pay off when it goes: wood splinters, and `BrickPiece` does.
 */
function drawBrick(ctx, x, y, th, tx, ty) {
  ctx.fillStyle = th.brick;
  ctx.fillRect(x, y, TILE, TILE);

  // Plank seams, with the lit edge of the next board beside each one. The seam
  // takes a shadow on top of the palette colour rather than trusting
  // `brickDark` alone, because a palette is free to put its shadow tone within
  // a few levels of its own ground — the night set did exactly that until its
  // brick was lightened — and a seam that lands on the ground colour is a seam
  // you find out about by not finding out about it.
  for (const sx of [5, 10]) {
    ctx.fillStyle = th.brickDark;
    ctx.fillRect(x + sx, y, 1, TILE);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + sx, y, 1, TILE);
    ctx.fillStyle = th.brickLight;
    ctx.fillRect(x + sx + 1, y, 1, TILE);
  }

  // grain: a couple of ticks per tile so a wall is not one stamp repeated
  const n = hashNoise(tx * 3, ty * 5);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x + 1 + Math.floor(n * 3), y + 2, 1, 3);
  ctx.fillRect(x + 12 + Math.floor(n * 2), y + 11, 1, 3);
  if (n > 0.55) ctx.fillRect(x + 7, y + 12, 1, 3);
  if (n > 0.78) {                                   // a knot in one board
    const kx = x + (n > 0.9 ? 12 : 1);
    ctx.fillRect(kx, y + 11, 3, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(kx + 1, y + 11, 1, 2);
  }

  // the batten: a strap laid across the boards, which is what holds them up
  ctx.fillStyle = th.brick;
  ctx.fillRect(x, y + 6, TILE, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x, y + 7, TILE, 2);
  ctx.fillStyle = th.brickLight;
  ctx.fillRect(x, y + 6, TILE, 1);
  ctx.fillStyle = th.brickDark;
  ctx.fillRect(x, y + 9, TILE, 1);

  // nail heads, one per board, where the batten crosses it
  for (const nx of [2, 7, 13]) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + nx, y + 7, 2, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + nx, y + 7, 1, 1);
  }

  // the frame: what says "this is a box on the wall", not more wall
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(x, y, TILE, 1);
  ctx.fillRect(x, y + TILE - 1, TILE, 1);
  ctx.fillRect(x, y, 1, TILE);
  ctx.fillRect(x + TILE - 1, y, 1, TILE);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x + 1, y + 1, TILE - 2, 1);
}

/**
 * The prize block is a pressurised canister: a bolted brass plate with a drum
 * bulging out of it and a pea-green light burning behind the gauge glass.
 *
 * A symbol on the face would only ever be somebody else's symbol. A container
 * that is visibly under pressure says "there is something in here" without one,
 * and the blinking gauge is the part that says "hit me" — nothing else in the
 * game blinks. Its colours are fixed rather than themed on purpose: this is the
 * one tile that must shout on all six backgrounds, and the dark frame keeps it
 * off the sand in the desert as much as off the night sky.
 */
function drawQuestion(ctx, x, y, tick) {
  const phase = Math.floor(tick / 8) % 4;
  const plate = phase === 0 ? '#f0a828' : phase === 2 ? '#c88014' : '#dc941c';
  ctx.fillStyle = '#2a1a06';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = plate;
  ctx.fillRect(x + 1, y + 1, 14, 14);
  ctx.fillStyle = '#ffd478';
  ctx.fillRect(x + 1, y + 1, 14, 1);
  ctx.fillRect(x + 1, y + 1, 1, 14);
  ctx.fillStyle = '#8a5008';
  ctx.fillRect(x + 1, y + 14, 14, 1);
  ctx.fillRect(x + 14, y + 1, 1, 14);

  // corner bolts: the plate is fastened on, so it can be blown off
  for (const [bx, by] of [[2, 2], [12, 2], [2, 12], [12, 12]]) {
    ctx.fillStyle = '#6a3c04';
    ctx.fillRect(x + bx, y + by, 2, 2);
    ctx.fillStyle = '#ffe8b0';
    ctx.fillRect(x + bx, y + by, 1, 1);
  }

  // the drum, straining outwards
  ctx.fillStyle = '#6a3c04';                      // the shadow it casts on the plate
  ctx.fillRect(x + 3, y + 3, 11, 1);
  ctx.fillRect(x + 13, y + 4, 1, 9);
  ctx.fillRect(x + 3, y + 12, 11, 1);
  ctx.fillStyle = '#ffb838';
  ctx.fillRect(x + 3, y + 4, 10, 8);
  ctx.fillStyle = '#ffe8a8';
  ctx.fillRect(x + 3, y + 4, 10, 1);
  ctx.fillRect(x + 3, y + 4, 1, 8);
  ctx.fillStyle = '#9a5c0c';
  ctx.fillRect(x + 3, y + 11, 10, 1);
  ctx.fillRect(x + 12, y + 4, 1, 8);

  // a highlight sweeping across the face every couple of seconds
  const sweep = (tick % 150) / 150;
  if (sweep < 0.18) {
    const sx = Math.round(x + sweep * (TILE / 0.18) - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 3; i++) {
      const px = sx + i;
      if (px > x && px < x + TILE - 1) ctx.fillRect(px, y + 1, 1, TILE - 2);
    }
  }

  // the gauge: the only blinking thing on screen
  ctx.fillStyle = '#241c08';
  ctx.fillRect(x + 5, y + 6, 6, 5);
  const lit = phase === 0 || phase === 1;
  ctx.fillStyle = lit ? '#a8f04a' : '#4c8c1c';
  ctx.fillRect(x + 6, y + 7, 4, 3);
  if (lit) {
    ctx.fillStyle = '#e8ffc0';
    ctx.fillRect(x + 6, y + 7, 2, 1);
  }
}

/** The same canister after it has been emptied: the drum punched inside out. */
function drawUsed(ctx, x, y, th) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = th.brickDark;
  ctx.fillRect(x + 1, y + 1, 14, 14);

  // Inverted bevel on the crater: light on the bottom, dark on the top, which
  // is the whole reason it reads as pressed in rather than merely darker.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 3, y + 3, 10, 10);
  ctx.fillRect(x + 3, y + 3, 10, 1);
  ctx.fillRect(x + 3, y + 3, 1, 10);
  ctx.fillStyle = th.brick;
  ctx.fillRect(x + 3, y + 12, 10, 1);
  ctx.fillRect(x + 12, y + 3, 1, 10);

  // the dead gauge, and two creases where the metal folded
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x + 6, y + 7, 4, 2);
  ctx.fillRect(x + 4, y + 5, 3, 1);
  ctx.fillRect(x + 9, y + 10, 3, 1);

  ctx.fillStyle = th.brick;
  for (const [bx, by] of [[2, 2], [12, 2], [2, 12], [12, 12]]) {
    ctx.fillRect(x + bx, y + by, 2, 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x + 1, y + 1, 14, 1);
}

function drawHard(ctx, x, y, th, tx, ty) {
  ctx.fillStyle = th.hard;
  ctx.fillRect(x, y, TILE, TILE);
  bevel(ctx, x, y, TILE, TILE, th.hardLight, th.hardDark);

  if (th.surface === 'metal') {                    // riveted plate
    ctx.fillStyle = th.hardDark;
    for (const [rx, ry] of [[2, 2], [12, 2], [2, 12], [12, 12]]) {
      ctx.fillRect(x + rx, y + ry, 2, 2);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x + 3, y + 3, 1, 1);
    ctx.fillRect(x + 13, y + 3, 1, 1);
    ctx.fillStyle = th.hardDark;
    ctx.fillRect(x + 5, y + 7, 6, 2);
  } else if (th.surface === 'snow') {              // packed ice with a glint
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x + 3, y + 3, 4, 1);
    ctx.fillRect(x + 3, y + 3, 1, 4);
    ctx.fillStyle = th.hardDark;
    ctx.fillRect(x + 10, y + 9, 3, 1);
    ctx.fillRect(x + 12, y + 6, 1, 4);
  } else if (th.surface === 'bone') {              // hiottu luu, halkeama pituussuuntaan
    ctx.fillStyle = th.hardDark;
    ctx.fillRect(x + 7, y + 2, 1, 12);
    ctx.fillRect(x + 5, y + 5, 2, 1);
    ctx.fillRect(x + 8, y + 9, 2, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x + 3, y + 3, 2, 9);
    if (hashNoise(tx, ty) > 0.6) {
      ctx.fillStyle = th.hardDark;
      ctx.fillRect(x + 11, y + 4, 2, 2);
    }
  } else {
    ctx.fillStyle = th.hardDark;
    ctx.fillRect(x + 3, y + 3, 2, 2);
    ctx.fillRect(x + 11, y + 11, 2, 2);
    if (hashNoise(tx, ty) > 0.7) ctx.fillRect(x + 10, y + 4, 2, 1);
  }
}

function drawNote(ctx, x, y, tick, bumped) {
  const off = bumped ? 1 : 0;
  ctx.fillStyle = '#e8901c';
  ctx.fillRect(x, y + off, TILE, TILE - off);
  bevel(ctx, x, y + off, TILE, TILE - off, '#ffc060', '#8c4c08');
  const bob = Math.round(Math.sin(tick / 12) * 1);
  ctx.fillStyle = '#fff4d8';
  ctx.fillRect(x + 9, y + 4 + off + bob, 2, 7);
  ctx.fillRect(x + 6, y + 9 + off + bob, 4, 3);
  ctx.fillRect(x + 9, y + 4 + off + bob, 4, 2);
}

/** Where the throat of a pipe starts inside the mouth tile. */
const PIPE_THROAT = 6;

/**
 * The shaft of a pipe: sheet-metal stovepipe, built out of sections.
 *
 * Two attempts got thrown away here and both are worth recording. A smooth
 * light-to-dark tube is the thing we are trying not to be. Fine corrugation all
 * the way down is not that, but at 16 px it reads as a window shutter, and a
 * shutter is not something you would ever try to climb into. What works is
 * segments: a flat sheet with a riveted lap seam down the front and a joint
 * band where each section meets the next. `bandAt` is the row inside the tile
 * where a joint belongs, so the rhythm is one per tile and cannot drift when
 * the camera scrolls by an odd pixel.
 */
/*
 * SAMA ELEMENTTI, ERI YKSILÖ — putken oma iho.
 *
 * Omistajan pyyntö 18.8.2026: *"eka putki ei näytä täsmälleen samalta kuin 2.
 * putki… etsi tasapaino, jossa pelaaja tunnistaa heti elementin samaksi, mutta
 * niissä on kuitenkin pieni vivahde-ero."* Tasapaino on tässä sääntönä eikä
 * makuna, ja se on kolme kieltoa:
 *
 *   1. **Siluetti ei muutu.** Vaihtelu on pelkkää pintaa laatan sisällä; yksi
 *      pikseli reunaa vähemmän tekisi putkesta eri kokoisen, ja koko on
 *      hyppybudjetin asia eikä koristeen.
 *   2. **Pohjaväri ei muutu.** Tunnistaminen tapahtuu värillä ja muodolla
 *      yhdellä silmäyksellä; vaihtelu saa liikuttaa vain yksityiskohtia jotka
 *      ovat jo valmiiksi pintakuviota — niittejä, saumoja, kolhuja.
 *   3. **Vaihtelu on paikan funktio eikä kellon.** Sama putki näyttää samalta
 *      joka kerta kun sen näkee, myös pikalatauksen jälkeen. Satunnaisluku
 *      framella olisi kohinaa; hash paikasta on käsityötä.
 *
 * **Siemen on sarake eikä laatta**, ja se on koko putken ehto: kaksi laattaa
 * vierekkäin ja N päällekkäin ovat *yksi esine*, joten niiden on saatava sama
 * yksilöllisyys. Vasen puolisko on ankkuri, ja oikea kysyy samalta sarakkeelta.
 *
 * `verify.mjs` mittaa kolme asiaa: että vaihtelua **on** (kaksi putkea eroaa),
 * että sitä on **vähän** (ero on prosenteissa eikä kymmenissä), ja että se on
 * **sama joka kerta**.
 */
const PIPE_SKINS = 4;

function pipeSkin(tx, left) {
  /* Ankkuri on parin vasen sarake: oikea puolisko kysyy vasemmalta, jolloin
   * saman putken molemmat puoliskot saavat saman ihon. Ilman tätä putken
   * puolikkaat olisivat kahdesta eri putkesta. */
  const anchor = left ? tx : tx - 1;
  const n = hashNoise(anchor, 17);
  const m = hashNoise(anchor, 53);
  return {
    /* Niittiväli: 5 tai 6 pikseliä. Yksi pikseli riittää tekemään kahdesta
     * putkesta eri putket lähietäisyydeltä, eikä sitä huomaa kaukaa. */
    pitch: 5 + (n > 0.5 ? 1 : 0),
    /* Nokipilkku saumalle: yksi kolmesta korkeudesta tai ei lainkaan. Tämä on
     * se joka nostaa vaihtoehtojen määrän kahdesta kahdeksaan — mitattuna
     * pelkkä niittiväli teki 12 putkesta 2 erilaista, mikä on yhtä hyvä kuin
     * ei mitään. Vaihtoehtojen määrä on vaihtelun koko kysymys. */
    soot: m > 0.35 ? { dy: 2 + Math.floor(m * 11), h: m > 0.75 ? 3 : 2 } : null,
    /* Kolhu: pieni tumma laikku jonka paikka vaihtelee. Kolme neljästä
     * putkesta saa sellaisen, eli myös ehjä putki on yksi yksilö. */
    dent: n > 0.25 ? { dy: 3 + Math.floor(hashNoise(anchor, 31) * 8), w: 2 + (n > 0.7 ? 1 : 0) } : null,
    /* Kiilto laskeutuu saumaa pitkin kerran seitsemässä sekunnissa, ja vaihe on
     * yksilön oma — kaksi putkea vierekkäin eivät välähdä yhdessä, mikä olisi
     * konemainen. Yksi pikseli, yksi sävy: se ei saa lukea merkkinä (kohta 8),
     * vaan sen kuuluu näkyä vasta kun katsoo. */
    phase: Math.floor(n * 420),
  };
}

/** Kiillon paikka tässä putkessa juuri nyt, tai `null`. */
function pipeGlint(skin, tick) {
  const t = ((tick + skin.phase) % 420);
  return t < 24 ? Math.floor(t / 1.5) : null;
}

function ductShaft(ctx, x, y, off, h, th, left, bandAt, skin = null, tick = 0) {
  ctx.fillStyle = th.pipe;
  ctx.fillRect(x, y + off, TILE, h);

  // The folded edge of the sheet: hard steps, no gradient. A square duct, not
  // a cylinder — the tube shading is the most familiar single thing about the
  // pipe this replaces, so it is the first thing to go.
  ctx.fillStyle = th.pipeDark;
  if (left) ctx.fillRect(x, y + off, 2, h);
  else ctx.fillRect(x + TILE - 3, y + off, 3, h);
  if (left) {
    ctx.fillStyle = th.pipeLight;
    ctx.fillRect(x + 2, y + off, 1, h);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + TILE - 1, y + off, 1, h);
  }

  // the riveted lap seam, on the left half only, so a pipe has a front
  if (left) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 6, y + off, 1, h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x + 7, y + off, 1, h);
    const pitch = skin ? skin.pitch : 5;
    for (let i = 2; i < h; i += pitch) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x + 6, y + off + i, 2, 1);
    }
    /* Noki: himmeä läiskä sauman vieressä, ei koskaan sen päällä — sauma on se
     * josta putken suunnan lukee, ja lika ei saa peittää rakennetta. */
    if (skin && skin.soot && skin.soot.dy >= off && skin.soot.dy + skin.soot.h <= off + h) {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(x + 3, y + skin.soot.dy, 3, skin.soot.h);
    }
    /* Kiilto: yksi pikseli saumassa, matkalla alas. Ks. `pipeSkin`. */
    const g = skin ? pipeGlint(skin, tick) : null;
    if (g !== null && g >= off && g < off + h) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x + 7, y + g, 1, 2);
    }
  }
  /* Kolhu on oikealla puoliskolla, koska sauma on vasemmalla: kaksi
   * yksityiskohtaa samassa sarakkeessa lukisi virheenä eikä pintana. */
  if (!left && skin && skin.dent && skin.dent.dy >= off && skin.dent.dy < off + h - 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + 3, y + skin.dent.dy, skin.dent.w, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 3, y + skin.dent.dy - 1, skin.dent.w, 1);
  }

  if (bandAt === null || bandAt < off || bandAt + 3 > off + h) return;
  const bx = x + (left ? 2 : 0);
  const bw = TILE - (left ? 2 : 3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(bx, y + bandAt, bw, 1);
  ctx.fillStyle = th.pipeLight;
  ctx.fillRect(bx, y + bandAt + 1, bw, 1);
  ctx.fillStyle = th.pipeDark;
  ctx.fillRect(bx, y + bandAt + 2, bw, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';           // rivets holding the joint
  for (const rx of left ? [4, 11] : [4, 12]) ctx.fillRect(x + rx, y + bandAt + 1, 1, 1);
}

/**
 * One tile of pipe. `hanging` turns the mouth over.
 *
 * A pipe you climb into upwards has to look like one, or the rule `tryWarp`
 * enforces — travel the way the mouth faces — is invisible and reads as the
 * warp being broken. The mouth is drawn once and mirrored about the tile's
 * middle, rather than written out twice: the collar, the throat and the shaft
 * under it are the same object seen from the other end, and two copies would
 * drift the first time one of them was touched.
 *
 * A vertical mirror and not a rotation, so the left-hand tile of a mouth stays
 * the left-hand tile — the lap seam and the bolt spacing are what make the two
 * halves join, and rotating would swap them.
 */
function drawPipe(ctx, x, y, ch, th, hanging = false, tx = 0, tick = 0) {
  const top = ch === T.PIPE_TL || ch === T.PIPE_TR;
  const left = ch === T.PIPE_TL || ch === T.PIPE_BL;
  /* Only the mouth turns over. A length of shaft is the same object either way
   * up — the joint band is one per tile whichever end it is measured from — so
   * flipping it would change every pipe in the game to no visible end. */
  if (hanging && top) {
    ctx.save();
    ctx.translate(x, y + TILE);
    ctx.scale(1, -1);
    drawPipe(ctx, 0, 0, ch, th, false, tx, tick);
    ctx.restore();
    return;
  }
  const skin = pipeSkin(tx, left);
  ctx.fillStyle = th.pipe;
  ctx.fillRect(x, y, TILE, TILE);

  if (!top) {
    ductShaft(ctx, x, y, 0, TILE, th, left, 1, skin, tick);
    return;
  }

  // The mouth: a bolted vent collar sitting flush on the duct. Flush matters —
  // a rim that overhangs the shaft is the other game's pipe in one stroke, and
  // this one has to be enterable without borrowing that silhouette.
  ctx.fillStyle = th.pipe;
  ctx.fillRect(x, y, TILE, PIPE_THROAT);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x, y, TILE, 1);
  ctx.fillStyle = th.pipeLight;
  ctx.fillRect(x, y + 1, TILE, 1);
  ctx.fillStyle = th.pipeDark;
  ctx.fillRect(x, y + 5, TILE, 1);
  // Bolts sit symmetrically about the two-tile mouth: 2 and 11 on the left
  // tile, 4 and 13 on the right.
  /* Pultit siirtyvät yksilön mukana yhden pikselin, ja **molemmat puoliskot
   * siirtyvät yhdessä**, koska ne kysyvät saman ankkurin ihoa. Yksi pikseli on
   * se määrä joka näkyy vierekkäin muttei kaukaa — tasan se raja jota tässä
   * haettiin. */
  const boltShift = skin.pitch === 6 ? 1 : 0;
  for (const bx of left ? [2, 11] : [4, 13]) {
    ctx.fillStyle = th.pipeDark;
    ctx.fillRect(x + bx + boltShift, y + 2, 2, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + bx + boltShift, y + 2, 1, 1);
  }

  // The throat: a hole with walls beside it, not a dark stripe across the tile.
  // Inset from the outer edge is what does the work — you can see the thickness
  // of the sheet the opening is cut in, and thickness is what makes it a hole.
  const tx0 = left ? x + 2 : x;
  const tw = TILE - 2;
  ctx.fillStyle = th.pipeDark;
  ctx.fillRect(x, y + PIPE_THROAT, TILE, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(tx0, y + PIPE_THROAT, tw, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(tx0, y + PIPE_THROAT + 3, tw, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';       // far wall catching the light
  ctx.fillRect(tx0, y + PIPE_THROAT + 4, tw, 1);

  ductShaft(ctx, x, y, PIPE_THROAT + 5, TILE - PIPE_THROAT - 5, th, left, null, skin, tick);
}

/**
 * The beanstalk: a plant, not a ladder. The stalk leans a little further with
 * every row and the leaves alternate sides, so a vine forty tiles tall is not
 * one tile stamped forty times. The greens are fixed rather than themed — a
 * beanstalk that turned metallic in the factory would read as machinery.
 */
function drawVine(ctx, x, y, tx, ty, tick) {
  const lean = Math.round(Math.sin(ty * 0.8 + tick / 90) * 2);
  const sx = x + 6 + lean;
  ctx.fillStyle = '#1c6b1f';
  ctx.fillRect(sx - 1, y, 6, TILE);
  ctx.fillStyle = '#3ea23a';
  ctx.fillRect(sx, y, 4, TILE);
  ctx.fillStyle = '#8fe04a';
  ctx.fillRect(sx, y, 1, TILE);

  const right = ty % 2 === 0;
  const lx = right ? sx + 4 : sx - 7;
  const tip = right ? lx + 2 : lx;
  ctx.fillStyle = '#3ea23a';
  ctx.fillRect(lx, y + 5, 7, 3);
  ctx.fillRect(tip, y + 4, 5, 1);
  ctx.fillStyle = '#8fe04a';
  ctx.fillRect(lx + 1, y + 5, 4, 1);
  ctx.fillStyle = '#1c6b1f';
  ctx.fillRect(tip, y + 8, 5, 1);
  // a bean, on some rows only
  if (hashNoise(tx, ty * 3) > 0.72) {
    ctx.fillStyle = '#c8e04a';
    ctx.fillRect(right ? sx - 3 : sx + 5, y + 11, 2, 3);
  }
}

/**
 * A warp pipe looks like a pipe, because finding out that it is not is the
 * whole point. The only tell is a slow shine in the throat: enough to notice
 * if you are looking at it, not enough to announce itself.
 *
 * The shine is inside the flip with the throat it belongs to, which is the
 * reason this is one transform around both and not two mouths and two shines.
 */
function drawWarpPipe(ctx, x, y, ch, th, tick, hanging, tx = 0) {
  if (hanging) {
    ctx.save();
    ctx.translate(x, y + TILE);
    ctx.scale(1, -1);
    drawWarpPipe(ctx, 0, 0, ch, th, tick, false, tx);
    ctx.restore();
    return;
  }
  /* Lämpöputki saa saman yksilöllisen ihon kuin tavallinen putki, ja se on
   * salaisuuden kannalta pakollista: jos vain lämpöputkilla olisi kolhuja,
   * kolho olisi kyltti. Sen oma merkki on hidas kiilto suulla, ei pinta. */
  drawPipe(ctx, x, y, ch === T.WARP_L ? T.PIPE_TL : T.PIPE_TR, th, false, tx, tick);
  const pulse = 0.1 + 0.12 * Math.sin(tick / 20);
  ctx.fillStyle = `rgba(255,255,255,${pulse})`;
  ctx.fillRect(x, y + PIPE_THROAT, TILE, 3);
}

function drawPlatform(ctx, x, y, th) {
  ctx.fillStyle = th.brickLight;
  ctx.fillRect(x, y, TILE, 2);
  ctx.fillStyle = th.brick;
  ctx.fillRect(x, y + 2, TILE, 3);
  ctx.fillStyle = th.brickDark;
  ctx.fillRect(x, y + 5, TILE, 1);
  ctx.fillRect(x + 5, y + 2, 1, 3);
  ctx.fillRect(x + 11, y + 2, 1, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, TILE, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x, y + 6, TILE, 1);
}

/**
 * The spikes only occupy the bottom of their tile; the rest is air.
 *
 * Exported because the damage box in scenes/level.js is built from it. Drawing
 * and hurting must come from one number, or a jump that visibly clears the
 * points still costs a power level — which is exactly what it did.
 */
export const SPIKE_TOP = 6;

function drawSpike(ctx, x, y, tick) {
  for (let i = 0; i < 4; i++) {
    const bx = x + i * 4;
    ctx.fillStyle = '#c8c8d8';
    ctx.fillRect(bx + 1, y + 12, 2, 4);
    ctx.fillRect(bx + 1, y + 9, 2, 3);
    ctx.fillRect(bx + 1, y + 6, 2, 3);
    ctx.fillStyle = '#f4f4ff';
    ctx.fillRect(bx + 1, y + 6, 1, 6);
  }
  // a glint travelling along the row
  const g = Math.floor(tick / 10) % 8;
  if (g < 4) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + g * 4 + 1, y + 6, 2, 2);
  }
  ctx.fillStyle = '#6f6f8a';
  ctx.fillRect(x, y + 14, TILE, 2);
  ctx.fillStyle = '#4a4a60';
  ctx.fillRect(x, y + 15, TILE, 1);
}

/**
 * A crevasse: the ice world's version of the lava pool.
 *
 * Same tile, same death — molten rock in a glacier was simply absurd, and the
 * fix is what it looks like, not what it does. Meltwater under blue-white ice
 * reads as "do not step here" to anyone who has seen a frozen lake, and the
 * shelf edges say the hole has a bottom a long way down.
 */
function drawCrevasse(ctx, x, y, tick, tx) {
  const wave = Math.sin((x + tick * 0.9) / 11) * 1.2;
  ctx.fillStyle = '#0a1a34';
  ctx.fillRect(x, y + 2, TILE, TILE - 2);
  ctx.fillStyle = '#123a68';
  ctx.fillRect(x, y + 5, TILE, TILE - 5);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x, y + 3 + Math.round(wave), TILE, 3);
  ctx.fillStyle = '#bfe6ff';
  ctx.fillRect(x, y + 3 + Math.round(wave), TILE, 1);

  // broken shelf along the rim, so the edge does not read as a tidy pool
  const seed = hashNoise(tx, 11);
  ctx.fillStyle = '#dff2ff';
  ctx.fillRect(x, y, TILE, 2);
  ctx.fillStyle = '#9fc8e8';
  ctx.fillRect(x + Math.floor(seed * 8), y + 2, 3 + Math.floor(seed * 4), 1);

  // a floe drifting past, on its own clock per column
  const period = 90 + Math.floor(seed * 70);
  const age = (tick + Math.floor(seed * period)) % period;
  if (age < 30) {
    ctx.fillStyle = '#e8f6ff';
    ctx.fillRect(x + 2 + Math.round((age / 30) * 8), y + 7 + Math.round(wave), 4, 2);
  }
}

function drawLava(ctx, x, y, tick, tx) {
  const wave = Math.sin((x + tick * 1.6) / 9) * 1.5;
  ctx.fillStyle = '#8c1808';
  ctx.fillRect(x, y + 2, TILE, TILE - 2);
  ctx.fillStyle = '#d83018';
  ctx.fillRect(x, y + 4, TILE, TILE - 4);
  ctx.fillStyle = '#f87818';
  ctx.fillRect(x, y + 2 + Math.round(wave), TILE, 3);
  ctx.fillStyle = '#ffd048';
  ctx.fillRect(x, y + 2 + Math.round(wave), TILE, 1);

  // bubbles surfacing at their own pace per column
  const seed = hashNoise(tx, 3);
  const period = 70 + Math.floor(seed * 60);
  const age = (tick + Math.floor(seed * period)) % period;
  if (age < 22) {
    const t = age / 22;
    const bx = x + 3 + Math.floor(seed * 9);
    const by = y + 12 - Math.round(t * 9);
    const s = t > 0.75 ? 1 : 2;
    ctx.fillStyle = t > 0.75 ? '#ffe89a' : '#ffb040';
    ctx.fillRect(bx, by, s, s);
  }
  ctx.fillStyle = 'rgba(255,140,40,0.18)';
  ctx.fillRect(x, y, TILE, 2);
}

/**
 * JUOKSUHIEKKA, and nearly every stroke in it is "not the thing it could be
 * mistaken for".
 *
 * It has three neighbours in the eye and it has to lose to none of them:
 *
 *   - **the desert ground it is dug into.** Sand is lit from above and gets
 *     *lighter* towards its cap (`surfaceCap`'s `groundTop`, plus wind
 *     ripples). This gets *darker* towards its rim and has no cap at all, which
 *     is what makes a pool read as a hole in the floor rather than as a patch
 *     of floor. Measured in `verify.mjs`: the separation has to beat the
 *     desert's own ground/brick pair, which is one of the weakest in the game.
 *   - **lava, and the ice world's crevasse.** Both of those are a *crest*: one
 *     bright line running the width of the tile, offset by a sine, travelling
 *     sideways. A crest is therefore the one shape this may not have. Instead
 *     it churns — two small rings turning in opposite directions, which goes
 *     nowhere and reads as something being stirred from underneath.
 *   - **a pit.** A pit is empty air with the backdrop showing through it and no
 *     movement at all; this is opaque, textured and never still.
 *
 * Fixed colours rather than themed, for the same reason the prize block has
 * them: a themed quicksand would by definition be painted in the palette of the
 * ground it is hiding in, which is precisely the mistake. It only occurs in the
 * desert today, and that is where it must not blend.
 *
 * The body stays drawn **on top** of the sand rather than under it, because
 * `drawTiles` runs before the entities and it is left that way on purpose. A
 * player who has gone under is the one moment the hazard is a clock counting
 * down, and hiding him behind the tile would take away the only reading of how
 * far there is to climb — "mikä voi satuttaa, sen pitää näkyä", applied to the
 * thing being hurt. The grains thrown up from the surface are what says he is
 * beneath it; the picture of being buried is the rim above his head.
 *
 * `surface` is true for the top tile of a pool and comes from the neighbour the
 * caller already has in hand — the same trick as the grass on a ground tile.
 * Only the surface churns and only the surface throws grains; the rows under it
 * are dead weight, which is what gives a two-tile pool a visible depth.
 */
const QS = {
  body: '#5c4620',
  deep: '#3a2c14',
  mid: '#77592a',
  sheen: '#94733c',
  grain: '#c6a868',
  rim: '#2a2010',
};

function drawQuicksand(ctx, x, y, tick, tx, surface) {
  ctx.fillStyle = QS.body;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = QS.deep;
  ctx.fillRect(x, y + 9, TILE, 7);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x, y + 13, TILE, 3);

  const n = hashNoise(tx, 7);

  // The churn. Two rings, opposite directions, different periods, so a row of
  // pool tiles is never the same stamp repeated and never drifts one way.
  for (let r = 0; r < 2; r++) {
    const dir = r === 0 ? 1 : -1;
    const phase = (tick / (46 + r * 19) + n * 6.28 + r * 2.1) * dir;
    const cx = x + 8 + Math.round(Math.cos(phase) * (4 - r));
    const cy = y + 7 + Math.round(Math.sin(phase) * (3 - r));
    ctx.fillStyle = r === 0 ? QS.mid : QS.sheen;
    ctx.fillRect(cx - 3 + r, cy, 6 - r * 2, 1);
    ctx.fillRect(cx - 2 + r, cy - 1, 4 - r * 2, 1);
  }

  if (!surface) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, y, TILE, 1);
    return;
  }

  // The rim is a dark seam and not a highlight. Ordinary sand has the highlight;
  // borrowing it here would put the two tiles a pixel apart at running speed.
  ctx.fillStyle = QS.rim;
  ctx.fillRect(x, y, TILE, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x, y, TILE, 1);

  /* Grains lifted and sucked back, on their own clock per column. They never
   * leave the tile: sand does not splash, and a particle crossing the rim would
   * be the spray that says "liquid". */
  const period = 96 + Math.floor(n * 60);
  const age = (tick + Math.floor(n * period)) % period;
  if (age < 34) {
    const t = age / 34;
    const gx = x + 3 + Math.floor(hashNoise(tx, 3) * 10);
    const gy = y + 6 - Math.round(Math.sin(t * Math.PI) * 4);
    ctx.fillStyle = QS.grain;
    ctx.fillRect(gx, gy, 1, 1);
    if (t > 0.3 && t < 0.8) ctx.fillRect(gx + 2, gy + 1, 1, 1);
  }
}

/**
 * One tile of a door. Doors are built several tiles wide and tall, and each
 * tile draws only its own slice — `edges` says which sides are the outside of
 * the door, so the stone surround, the hinges and the centre seam land on the
 * real boundaries instead of being repeated on every tile.
 *
 * The reason it is drawn this way at all: a one-tile door is 16 px tall and the
 * largest player is 43. Walking into a doorway you tower over does not read as
 * going through a door, it reads as a bug.
 */
function drawDoor(ctx, x, y, th, tick, open, edges) {
  const e = edges || { l: true, r: true, t: true, b: true };
  /*
   * `open` is **how far**, 0…1, and not whether. It used to be a boolean and
   * it only ever reached a blinking handle and a faint halo, so the door the
   * whole fortress is built around never actually moved — the promise was
   * plumbed all the way here and then dropped. See `LevelScene.doorOpen`.
   */
  const o = Math.max(0, Math.min(1, Number(open) || 0));
  ctx.fillStyle = th.hardDark;
  ctx.fillRect(x, y, TILE, TILE);
  if (e.t) {
    ctx.fillStyle = th.hard;
    ctx.fillRect(x, y, TILE, 1);
  }

  const ix = x + (e.l ? 2 : 0);
  const iw = TILE - (e.l ? 2 : 0) - (e.r ? 2 : 0);
  const iy = y + (e.t ? 1 : 0);
  const ih = TILE - (e.t ? 1 : 0) - (e.b ? 1 : 0);

  /* What is behind the leaves, painted across the whole opening first. Whatever
   * the leaves uncover has to be the way out and not the wall the door is set
   * into, or opening it would read as the door being deleted. */
  ctx.fillStyle = '#0d0710';
  ctx.fillRect(ix, iy, iw, ih);
  if (o > 0) {
    /* An even veil over the whole opening and a bright line on the threshold.
     * The first version shaded the bottom half of *each tile*, which drew one
     * stripe per row of a three-tile door — a ladder, not a corridor. A tile
     * does not know how far down the door it is, but it does know whether it
     * is the bottom one, and that is the only row where light on the floor
     * means anything. */
    ctx.fillStyle = `rgba(255,186,84,${(0.06 + 0.10 * o).toFixed(3)})`;
    ctx.fillRect(ix, iy, iw, ih);
    if (e.b) {
      ctx.fillStyle = `rgba(255,206,120,${(0.10 + 0.20 * o).toFixed(3)})`;
      ctx.fillRect(ix, iy + ih - 3, iw, 3);
    }
  }

  /*
   * One leaf, swinging back onto its hinge — which is the outer edge of the
   * door, so the gap opens down the middle and widens outwards. Returns the x
   * of its free edge, which is where the seam and the handle belong; they
   * travel with the leaf rather than staying painted on the frame.
   */
  const leaf = (lx, lw, hingeLeft) => {
    const w = Math.round(lw * (1 - o));
    if (w <= 0) return null;
    const px = hingeLeft ? lx : lx + lw - w;
    ctx.fillStyle = '#3a2008';
    ctx.fillRect(px, iy, w, ih);
    ctx.fillStyle = '#7a4c20';
    ctx.fillRect(px + 1, iy + 1, Math.max(0, w - 2), ih - (e.b ? 1 : 0));
    // planks, so a three-tile leaf does not read as one flat slab
    ctx.fillStyle = '#5c3410';
    for (let cx = px + 3; cx < px + w - 2; cx += 5) ctx.fillRect(cx, iy + 1, 1, ih - 1);
    if (e.t) {
      ctx.fillStyle = '#9c6a30';
      ctx.fillRect(px + 1, iy + 1, Math.max(0, w - 2), 1);
    }
    // The seam runs down the free edge of each leaf.
    ctx.fillStyle = '#2a1806';
    ctx.fillRect(hingeLeft ? px + w - 1 : px, iy, 1, ih);
    return hingeLeft ? px + w : px;
  };

  /* Which half of the door this tile is, read off the same `edges` the frame
   * is drawn from: an outer left edge means a left-hung leaf, an outer right
   * edge a right-hung one, both means the whole door fits in this one tile. */
  let freeL = null;
  let freeR = null;
  if (e.l && e.r) {
    freeL = leaf(ix, Math.ceil(iw / 2), true);
    freeR = leaf(ix + Math.ceil(iw / 2), Math.floor(iw / 2), false);
  } else if (e.r) {
    freeR = leaf(ix, iw, false);
  } else {
    freeL = leaf(ix, iw, true);
  }

  ctx.fillStyle = '#c8c8d8';
  if (e.l) {
    ctx.fillRect(x + 3, y + 4, 2, 1);
    ctx.fillRect(x + 3, y + 11, 2, 1);
  }
  if (e.r) {
    ctx.fillRect(x + TILE - 5, y + 4, 2, 1);
    ctx.fillRect(x + TILE - 5, y + 11, 2, 1);
  }

  // Handles sit at the seam, and only on the middle row of a tall door.
  const glow = o >= 1 && Math.floor(tick / 8) % 2 === 0;
  const middle = !e.t && !e.b;
  if (middle || (e.t && e.b)) {
    ctx.fillStyle = glow ? '#fff0a0' : '#ffd048';
    if (freeL !== null) ctx.fillRect(freeL - 3, y + 7, 2, 3);
    if (freeR !== null) ctx.fillRect(freeR + 1, y + 7, 2, 3);
  }

  /* Light spilling onto the wall, and only where there is wall: painting the
   * halo around every tile of the door stacked it on every internal seam and
   * made a plaid of it. */
  if (o > 0) {
    ctx.fillStyle = `rgba(255,224,120,${(0.14 * o).toFixed(3)})`;
    if (e.l) ctx.fillRect(x - 2, y, 2, TILE);
    if (e.r) ctx.fillRect(x + TILE, y, 2, TILE);
    if (e.t) ctx.fillRect(x, y - 2, TILE, 2);
    if (e.b) ctx.fillRect(x, y + TILE, TILE, 2);
  }
}


/**
 * One splinter off a broken plank, in whichever of four orientations it is
 * currently tumbling through.
 *
 * The tumble is four stamped shapes rather than a real rotation because
 * `ctx.rotate` would hand us anti-aliased mush at this size, and everything
 * else in the game is whole pixels. `len` and `thick` are the caller's, so no
 * two shards off the same plank are the same piece of wood.
 */
export function drawSplinter(ctx, x, y, len, thick, frame, body, light, dark) {
  if (frame === 0 || frame === 2) {
    const w = frame === 0 ? len : thick;
    const h = frame === 0 ? thick : len;
    ctx.fillStyle = body;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = light;
    ctx.fillRect(x, y, frame === 0 ? w : 1, frame === 0 ? 1 : h);
    ctx.fillStyle = dark;
    ctx.fillRect(frame === 0 ? x : x + w - 1, frame === 0 ? y + h - 1 : y,
      frame === 0 ? w : 1, frame === 0 ? 1 : h);
    return;
  }
  // Edge-on: a staircase, shortened so a diagonal shard is not visibly bigger
  // than the same shard lying flat.
  const d = Math.max(2, Math.round(len * 0.7));
  ctx.fillStyle = body;
  for (let i = 0; i < d; i++) {
    ctx.fillRect(x + i, y + (frame === 1 ? i : d - 1 - i), 2, 2);
  }
  ctx.fillStyle = light;
  ctx.fillRect(x, y + (frame === 1 ? 0 : d - 1), 1, 1);
  ctx.fillStyle = dark;
  ctx.fillRect(x + d, y + (frame === 1 ? d - 1 : 0) + 1, 1, 1);
}

export function drawCoinSprite(ctx, x, y, tick) {
  const frames = [10, 6, 2, 6];
  const w = frames[Math.floor(tick / 6) % 4];
  const cx = x + 8;
  const left = cx - Math.floor(w / 2);
  ctx.fillStyle = '#a06800';
  ctx.fillRect(left, y + 1, w, 14);
  ctx.fillStyle = '#f0b000';
  ctx.fillRect(left, y + 2, w, 12);
  if (w > 3) {
    ctx.fillStyle = '#ffe070';
    ctx.fillRect(left + 1, y + 3, w - 2, 10);
    ctx.fillStyle = '#c88800';
    ctx.fillRect(left + Math.floor(w / 2), y + 5, 1, 6);
    ctx.fillStyle = '#fff8d0';
    ctx.fillRect(left + 1, y + 3, 1, 3);
  }
  // a sparkle that pops on the widest frame
  if (w === 10 && Math.floor(tick / 6) % 8 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx + 4, y + 1, 1, 3);
    ctx.fillRect(cx + 3, y + 2, 3, 1);
  }
}

/**
 * Draws a single map tile. `above` lets ground know whether to grow grass.
 */
/**
 * A crumbling platform. `progress` runs 0→1 while the player stands on it.
 *
 * The warning has to be *visible*, not merely fair — same rule as the piranha
 * plant: anything that can hurt you must show itself first. So it shakes harder
 * and the cracks open wider the closer it is to going, and by the end it is
 * obviously about to fail rather than technically signposted.
 */
function drawCrumble(ctx, x, y, th, tx, ty, progress) {
  const shake = progress > 0 ? Math.round(Math.sin(progress * 44) * progress * 1.6) : 0;
  const px = x + shake;
  ctx.fillStyle = th.brick;
  ctx.fillRect(px, y, TILE, TILE);
  ctx.fillStyle = th.brickLight;
  ctx.fillRect(px, y, TILE, 1);
  ctx.fillStyle = th.brickDark;
  ctx.fillRect(px, y + 15, TILE, 1);

  // Two cracks that open outwards from the middle as the timer runs down.
  const spread = Math.round(progress * 5);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(px + 7 - spread, y + 2, 1, 12);
  ctx.fillRect(px + 8 + spread, y + 4, 1, 10);
  if (progress > 0.55) {
    ctx.fillRect(px + 2, y + 6, 4, 1);
    ctx.fillRect(px + 11, y + 9, 3, 1);
  }
  // Dust from underneath once it is genuinely about to go.
  if (progress > 0.75) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px + 3, y + TILE, 2, 1);
    ctx.fillRect(px + 10, y + TILE, 3, 1);
  }
}

/**
 * MÖYKKY, ja jokainen veto siinä vastaa kysymykseen "miksei se ole tiili".
 *
 * Se on pelin ainoa laatta joka voi lähteä liikkeelle, joten sen on erotuttava
 * kolmesta naapuristaan yhdellä silmäyksellä ja täydessä vauhdissa:
 *
 *   - **tiilestä**, joka on kehystetty laatikko ja jonka syy on pystysuora
 *     lankku. Tässä ei ole kehystä eikä lankkua: kulmat on syöty pois, joten
 *     silhuetti on pyöreä siinä missä kaikki muu kiinteä tässä pelissä on
 *     suorakulmainen. Pyöreä on se muoto joka lukee irrallisena — se ei ole
 *     kiinni missään, ja juuri siksi se voi pudota.
 *   - **kovasta palikasta**, joka on teemansa kirkkain kiinteä ruutu. Tämä on
 *     tummempi kuin maansa ja kantaa oman varjonsa alareunassa, eli se lukee
 *     kappaleena joka **lepää** jonkin päällä eikä pintana joka jatkuu.
 *   - **maasta**, jonka kuvio on aina joko vaaka (hiekka, metalli, kivi) tai
 *     luun pysty. Tämä on rakeinen ja suunnaton: kalkkeutunutta kamaa, ei
 *     kerroksia.
 *
 * Värit ovat teeman omat mutta väärin päin — `brickDark` runkona ja `ground`
 * kuorena — koska möykky on samaa ainetta kuin se maailma jossa se on, mutta
 * pakkautuneena. Yksi laatta, joka toimii kahdeksassa paletissa.
 *
 * `wobble` on 0…1 sen ajan minkä möykky roikkuu ennen ensimmäistä askeltaan.
 * Se ei ole koristetta: **mikä voi satuttaa, sen pitää näkyä** (DESIGN.md
 * kohta 7), ja tämä on koko varoitus. Sama liike kuin murenevalla laudalla ja
 * tarkoituksella, koska pelaaja on jo oppinut lukemaan sen.
 */
function drawLump(ctx, x, y, th, tx, ty, wobble) {
  const shake = wobble > 0 ? Math.round(Math.sin(wobble * 44) * wobble * 1.8) : 0;
  const px = x + shake;

  ctx.fillStyle = th.brickDark;
  ctx.fillRect(px + 1, y, TILE - 2, TILE);
  ctx.fillRect(px, y + 1, TILE, TILE - 2);

  // The crust, one row in, so the dark body reads as an outline all round.
  ctx.fillStyle = th.ground;
  ctx.fillRect(px + 2, y + 1, TILE - 4, TILE - 3);
  ctx.fillRect(px + 1, y + 2, TILE - 2, TILE - 5);

  // Grit: no direction at all, unlike every ground surface in the game.
  ctx.fillStyle = th.groundDark;
  for (let i = 0; i < 6; i++) {
    const n = hashNoise(tx * 5 + i, ty * 11 + i * 3);
    const gx = px + 2 + Math.floor(n * 11);
    const gy = y + 3 + Math.floor(hashNoise(ty + i, tx - i) * 9);
    ctx.fillRect(gx, gy, 2, 1);
  }
  ctx.fillStyle = th.groundTop;
  ctx.fillRect(px + 4, y + 3, 4, 1);
  ctx.fillRect(px + 3, y + 4, 2, 1);

  // The shadow it casts on itself: it is resting on something, not built in.
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(px + 2, y + TILE - 3, TILE - 4, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(px + 1, y + TILE - 4, TILE - 2, 1);
}

/** The switch block itself: a big button that stays pressed once it is hit. */
function drawSwitch(ctx, x, y, th, tick, pressed) {
  const drop = pressed ? 4 : 0;
  ctx.fillStyle = th.brickDark;
  ctx.fillRect(x, y + 10, TILE, 6);
  ctx.fillStyle = pressed ? '#5a6a8c' : '#7080b0';
  ctx.fillRect(x + 1, y + 4 + drop, TILE - 2, 10 - drop);
  ctx.fillStyle = pressed ? '#8090b8' : '#b0c0e8';
  ctx.fillRect(x + 1, y + 4 + drop, TILE - 2, 2);
  if (!pressed) {
    // A pulse, because a block you are supposed to hit has to ask for it.
    const lit = Math.floor(tick / 8) % 2 === 0;
    ctx.fillStyle = lit ? '#ffd048' : '#c08020';
    ctx.fillRect(x + 6, y + 7, 4, 4);
  }
}

/**
 * PONNAHDUSLAUTA: ritilä lattiassa ja kaasua sen läpi.
 *
 * Laatta ei tiedä kuka sen päällä seisoo eikä kuinka täynnä kenenkään mittari
 * on — se tieto on kohtauksella — joten piirros ei yritä kertoa nostoa vaan
 * sen että **tästä tulee kaasua**. Suihku sykkii jaetulla kellolla samaan
 * tahtiin kuin muukin pelin kaasu, ja ritilä on terästä samasta syystä kuin
 * pönttö ja törähdystorvi ovat: tämä on tehty eikä kasvanut.
 *
 * Suihku piirretään laatan **sisään** eikä sen yli. Laatan ulkopuolelle
 * vuotava piirros olisi kuva siitä että jotain tapahtuu jossain missä mitään
 * ei ole, ja ruudukossa se tarkoittaa naapurilaatan päälle maalaamista.
 */
function drawSpring(ctx, x, y, th, tick) {
  // Kotelo: sama teräs kuin muillakin tehdyillä esineillä.
  ctx.fillStyle = '#10306c';
  ctx.fillRect(x, y + 6, TILE, 10);
  ctx.fillStyle = '#2050c0';
  ctx.fillRect(x + 1, y + 7, TILE - 2, 8);
  ctx.fillStyle = '#a8c8f0';
  ctx.fillRect(x + 1, y + 7, TILE - 2, 1);
  // Ritilä: kolme rakoa joista kaasu tulee.
  ctx.fillStyle = '#10306c';
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 3 + i * 4, y + 8, 2, 6);
  // Ja kaasu, kolmessa vaiheessa: matala, korkea, matala.
  const phase = Math.floor(tick / 6) % 3;
  const tall = phase === 1;
  ctx.fillStyle = tall ? '#a8e04a' : '#5c9c28';
  for (let i = 0; i < 3; i++) {
    const h = tall ? 6 : 3;
    ctx.fillRect(x + 3 + i * 4, y + 8 - h, 2, h);
  }
  if (tall) {
    ctx.fillStyle = '#f4ffd0';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 3 + i * 4, y + 2, 2, 2);
  }
  // Ja laatan oma pohja, jotta se istuu lattiaan eikä leiju siinä.
  ctx.fillStyle = th.groundDark || '#3a2a18';
  ctx.fillRect(x, y + 15, TILE, 1);
}

/**
 * PIERUHYLLY: kaasupatja jolla on kiinteä pinta ja haihtuva ruumis.
 *
 * Kaksi asiaa pitää lukea yhdellä silmäyksellä, ja ne ovat vastakkaisia:
 * **tämän päällä voi seistä** ja **tämä on menossa pois**. Ratkaisu on jako
 * ylä- ja alaosaan. Ylin rivi on vaalea ja tiivis pinta joka pysyy paikallaan
 * koko keston ajan — se on se viiva jolle jalka osuu, ja jos se ohenisi
 * mukana, hylly näyttäisi pettävän ennen kuin se pettää. Sen alla oleva kaasu
 * sen sijaan ohenee ja kuplii, ja se on kello.
 *
 * `k` on jäljellä oleva osuus (1 → 0), ja se tulee kohtaukselta samalla tavalla
 * kuin murenevan laudan oma eteneminen: laatta ei tiedä kelloaan, `TILE_INFO`
 * kertoo mikä laatta *on* eikä mitä se juuri nyt tekee.
 *
 * Kiinteät värit eivätkä teeman omat, kuten jäällä ja lyhdyllä: hylly on
 * pelaajan tekemä esine eikä maastoa, ja pelaajan tekemän esineen pitää näkyä
 * jokaisessa maailmassa samana.
 */
function drawShelf(ctx, x, y, tick, k) {
  const fade = Math.min(1, Math.max(0, k));
  // Pinta: vaalea, tiivis, ja aina yhtä leveä.
  ctx.fillStyle = '#e8ffc0';
  ctx.fillRect(x, y, TILE, 2);
  ctx.fillStyle = '#a8e04a';
  ctx.fillRect(x, y + 2, TILE, 2);
  // Ruumis: ohenee kellon mukana, ja kuplii kahdessa vaiheessa.
  const body = Math.round(4 * fade);
  if (body > 0) {
    ctx.fillStyle = '#5c9c28';
    ctx.fillRect(x, y + 4, TILE, body);
    ctx.fillStyle = '#a8e04a';
    const phase = Math.floor(tick / 5) % 2;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + 2 + i * 5 + phase, y + 4, 2, Math.max(1, body - 1));
    }
  }
}

/**
 * KAASULYHTY, sammuneena ja palavana.
 *
 * Kiinteät värit eivätkä teeman omat, ja samasta syystä kuin jäällä ja
 * juoksuhiekalla: lyhty tarkoittaa joka maailmassa täsmälleen samaa asiaa, eikä
 * merkki joka *tarkoittaa* samaa saa *näyttää* joka maailmassa eri asialta.
 * Teeman paletilla maalattu lyhty olisi luumaailmassa luunvärinen tolppa ja
 * tehtaassa yksi teräsputki muiden joukossa.
 *
 * Ero sammuneen ja palavan välillä on tahallisen iso — tumma lasi vs. valkoinen
 * ydin, ja kaksi kertaa leveämpi pää — koska tämä on ainoa laatta pelissä joka
 * kertoo *jotain jonka pelaaja saa vasta kuollessaan*. Sen pitää näkyä
 * ruudulla myös silloin kun se on jo takana ja kamera vetää sitä pois: siksi
 * liekki on kirkkain piste koko laatassa eikä varjoisa yksityiskohta.
 *
 * Muoto on lyhty eikä lippu, ja se on lajivalinta: lippu tässä pelissä on jo
 * varattu (maalitolppa), ja kaksi eri asiaa jotka molemmat ovat "tolppa jossa
 * on jotain päällä" olisi tasan se sekaannus jota DESIGN.md kohta 8 kieltää.
 * Kaasu palaa liekkinä, ja liekki on tämän pelin oma kuva siitä että jokin on
 * *päällä*.
 */
function drawLamp(ctx, x, y, lit, tick) {
  // Tolppa: sama teräs kuin ponnahduslaudalla, koska molemmat ovat rakennettuja
  // esineitä kentässä eivätkä maastoa.
  ctx.fillStyle = '#10306c';
  ctx.fillRect(x + 6, y + 7, 4, 9);
  ctx.fillStyle = '#2050c0';
  ctx.fillRect(x + 7, y + 7, 2, 9);
  // Jalka, jotta tolppa seisoo eikä pääty ilmaan.
  ctx.fillStyle = '#10306c';
  ctx.fillRect(x + 4, y + 14, 8, 2);

  if (!lit) {
    // Sammunut: umpinainen tumma lasi ja yksi vaalea heijastus, jotta se lukee
    // lyhdyksi eikä tolpan päähän jääneeksi mustaksi ruuduksi.
    ctx.fillStyle = '#3a4356';
    ctx.fillRect(x + 4, y + 2, 8, 6);
    ctx.fillStyle = '#5a6478';
    ctx.fillRect(x + 5, y + 3, 6, 4);
    ctx.fillStyle = '#8a94a8';
    ctx.fillRect(x + 5, y + 3, 2, 1);
    return;
  }

  // Palava: kotelo aukeaa ja liekki hengittää kahdessa vaiheessa.
  const tall = Math.floor(tick / 8) % 2 === 1;
  ctx.fillStyle = '#f07818';
  ctx.fillRect(x + 3, y + 1, 10, 8);
  ctx.fillStyle = '#ffc040';
  ctx.fillRect(x + 4, y + 2, 8, 6);
  ctx.fillStyle = '#fffbe0';
  ctx.fillRect(x + 6, y + (tall ? 1 : 3), 4, tall ? 6 : 4);
  // Ja kipinät, jotka kertovat että liekki elää eikä ole maalattu.
  ctx.fillStyle = '#ffc040';
  if (tall) {
    ctx.fillRect(x + 2, y, 2, 2);
    ctx.fillRect(x + 12, y + 1, 2, 2);
  }
}

/**
 * Hazard stripes painted into the lip of the ground tile beside a spike bed.
 *
 * Spikes sit flush in the floor and are the same pale grey as half the tilesets,
 * so at running speed the first thing that tells you they are there is losing a
 * power level. That is a surprise, not a puzzle — a hazard you can only learn by
 * dying is the one kind this game is not supposed to have. `side` is -1 when the
 * spikes are to the left, +1 to the right, so the marking sits on the edge you
 * are about to cross.
 */
function drawHazardEdge(ctx, x, y, side) {
  const sx = side > 0 ? x + TILE - 5 : x;
  ctx.fillStyle = '#f0c020';
  ctx.fillRect(sx, y, 5, 3);
  ctx.fillStyle = '#201808';
  for (let i = 0; i < 3; i++) ctx.fillRect(sx + (side > 0 ? i * 2 : i * 2 + 1), y, 1, 3);
}

/**
 * JÄÄ, ja se on kiinteä laatta joka näyttää siltä että sen päällä luistaa.
 *
 * Kiinteät värit eivätkä teeman omat, ja samasta syystä kuin juoksuhiekalla ne
 * ovat: jää on mekaniikka jota saa ladata mihin tahansa maailmaan, ja teeman
 * paletilla maalattu jää olisi luumaailmassa luunvärinen ja tehtaassa
 * teräksenvärinen — eli täsmälleen se laatta jonka pelaaja lakkaa näkemästä.
 * Se mitä laatta *tekee* on sama kaikkialla, joten sen on myös näytettävä
 * samalta kaikkialla.
 *
 * Muoto on valittu erottumaan niistä neljästä joita se muuten muistuttaisi, ja
 * jokainen ero on väite:
 *
 *   - **kova palikka lumiteemassa** (`drawHard`, `surface === 'snow'`) on
 *     läpinäkymätön ja tasainen, yksi pieni kimallus kulmassa. Tässä on
 *     pystyjuovat ja kirkas yläreuna, eli se lukee lasilta eikä kiveltä.
 *   - **halkeama** (`drawCrevasse`, jäämaailman `W`) on reikä: tumma, ja sillä
 *     on liikkuva harja. Tämä on vaalea ja **liikkumaton**. Liike on tässä
 *     pelissä varattu sille mikä on nestettä tai tappavaa, joten paikallaan
 *     pysyminen on se yksi ominaisuus joka sanoo "tämä on maastoa".
 *   - **puulava** (`drawPlatform`) on ohut ja sen alta mennään läpi. Tämä
 *     täyttää ruudun reunasta reunaan, koska se on kiinteä.
 *   - **juoksuhiekka** tummenee reunaansa kohti eikä sillä ole kantta. Tällä on
 *     kansi ja se on ruudun kirkkain rivi: se on se pinta jolla seistään.
 *
 * `above` ratkaisee kannen samalla tavalla kuin ruoho ratkaistaan maalaatalla —
 * jään sisällä oleva jää ei kiillä, vain se pinta joka on ilmaa vasten.
 */
function drawIce(ctx, x, y, capped, tx, ty) {
  ctx.fillStyle = '#12a0b4';
  ctx.fillRect(x, y, TILE, TILE);

  /* Pystyjuovat: jäätynyt vesi on kerroksissa, ja pystysuora juova on se mitä
   * vaakasuora harja ei ole. Vaihe laatasta, ei tikistä — kuvio ei liiku. */
  ctx.fillStyle = '#22c0d0';
  const phase = Math.floor(hashNoise(tx, ty) * 4);
  for (let i = 0; i < 3; i++) ctx.fillRect(x + ((phase + i * 5) % TILE), y + 1, 2, TILE - 1);

  bevel(ctx, x, y, TILE, TILE, '#5ce0e8', '#0a5c68');

  if (capped) {
    // Se pinta jolla seistään, ja ruudun kirkkain rivi.
    ctx.fillStyle = '#7cf0ec';
    ctx.fillRect(x, y, TILE, 1);
    ctx.fillStyle = '#38ccd4';
    ctx.fillRect(x, y + 1, TILE, 1);
  }

  /* Yksi vino kiilto per laatta, arvottuna mutta pysyvänä. Vino siksi että
   * kaikki muu tässä ruudussa on joko pysty tai vaaka: se on ainoa viiva jota
   * ei voi lukea rakenteeksi, joten se lukee heijastukseksi. */
  if (hashNoise(tx + 7, ty) > 0.45) {
    const gx = x + 3 + Math.floor(hashNoise(tx, ty + 3) * 7);
    const gy = y + 5 + Math.floor(hashNoise(tx + 1, ty) * 4);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 3; i++) ctx.fillRect(gx + i, gy - i, 1, 1);
  }
}

export function drawTile(ctx, ch, x, y, themeName, tx, ty, tick, above, opts = {}) {
  const th = THEMES[themeName] || THEMES.grass;
  switch (ch) {
    case T.GROUND:
      drawGround(ctx, x, y, th, !isSolid(above), tx, ty);
      if (opts.warn) drawHazardEdge(ctx, x, y, opts.warn);
      break;
    case T.HARD: drawHard(ctx, x, y, th, tx, ty); break;
    case T.BRICK: drawBrick(ctx, x, y, th, tx, ty); break;
    case T.QCOIN:
    case T.QPOWER:
    case T.QSTAR: drawQuestion(ctx, x, y, tick); break;
    case T.USED: drawUsed(ctx, x, y, th); break;
    case T.NOTE: drawNote(ctx, x, y, tick, false); break;
    /* Which way up a mouth goes is a question about the tile above it, and the
     * tile above it is already in hand: `above` is passed for the ground tile's
     * grass and answers this too. A mouth with pipe over it is the bottom end
     * of something hanging from a ceiling, so it faces down; a mouth with air
     * over it is standing on the floor and faces up. Same trick as `doorEdges`
     * — a picture that depends on a neighbour is settled by the caller, which
     * is the only one holding the grid. */
    case T.PIPE_TL:
    case T.PIPE_TR:
    case T.PIPE_BL:
    case T.PIPE_BR: drawPipe(ctx, x, y, ch, th, info(above).pipe, tx, tick); break;
    case T.WARP_L:
    case T.WARP_R: drawWarpPipe(ctx, x, y, ch, th, tick, info(above).pipe, tx); break;
    case T.VINE: drawVine(ctx, x, y, tx, ty, tick); break;
    case T.PLATFORM: drawPlatform(ctx, x, y, th); break;
    case T.CRUMBLE: drawCrumble(ctx, x, y, th, tx, ty, opts.crumble || 0); break;
    case T.LUMP: drawLump(ctx, x, y, th, tx, ty, opts.fall || 0); break;
    case T.ICE: drawIce(ctx, x, y, !isSolid(above), tx, ty); break;
    case T.SWITCH: drawSwitch(ctx, x, y, th, tick, opts.switchOn); break;
    case T.SPRING: drawSpring(ctx, x, y, th, tick); break;
    case T.LAMP: drawLamp(ctx, x, y, false, tick); break;
    case T.LAMP_LIT: drawLamp(ctx, x, y, true, tick); break;
    case T.SHELF: drawShelf(ctx, x, y, tick, opts.shelf === undefined ? 1 : opts.shelf); break;
    case T.COIN: drawCoinSprite(ctx, x, y, tick); break;
    case T.SPIKE: drawSpike(ctx, x, y, tick); break;
    case T.LAVA:
      // The hazard is the same everywhere; only the ice world's picture of it
      // differs, because lava in a glacier is a joke the level did not intend.
      if (themeName === 'ice') drawCrevasse(ctx, x, y, tick, tx);
      else drawLava(ctx, x, y, tick, tx);
      break;
    /* Only the top tile of a pool churns; the ones under it are the depth. The
     * neighbour is already in hand for exactly this class of question — see the
     * pipe mouths and the grass above. */
    case T.QUICKSAND: drawQuicksand(ctx, x, y, tick, tx, above !== T.QUICKSAND); break;
    // Passed through as a number: `drawDoor` swings, it does not toggle.
    case T.DOOR: drawDoor(ctx, x, y, th, tick, opts.doorOpen, opts.doorEdges); break;
    default: break;
  }
}
