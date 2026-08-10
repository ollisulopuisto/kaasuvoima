/**
 * PÄIVÄN PIERU — yksi generoitu kenttä vuorokaudessa, yksi yritys, sama kaikille.
 *
 * Kenttä rakennetaan **tässä selaimessa** samasta `src/data/generator.js`:stä ja
 * samoista louhituista rytmiluvuista kuin pelin 27 generoitua kenttää. Siemen on
 * päivämäärä, joten Helsingissä ja Kaliforniassa pelataan samaa kenttää eikä
 * kahta samannäköistä.
 *
 * Kolme päätöstä joita ei voi lukea koodista, ja siksi ne lukevat tässä.
 *
 * ## 1. Päivä on UTC-vuorokausi
 *
 * "Sama kenttä kaikille samana päivänä" vaatii **yhden kellon**. Paikallinen
 * vuorokausi ei kelpaa: se antaisi Helsingille ja Kalifornialle eri kentän
 * samalla hetkellä, ja silloin jaettu tulosrivi ei vertaa mitään — se olisi
 * kahden eri kentän tulos samalla päivämäärällä.
 *
 * Valittu kello on **UTC**, ja perustelu on kolmiosainen:
 *
 *   - se on ainoa kello jonka jokainen selain osaa ilman aikavyöhyketietokantaa
 *     (`Date.now()` ja `getUTC*`). Suomen aika olisi EET/EEST, eli kesäaikasääntö
 *     — joko riippuvuus tai käsin kirjoitettu sääntö joka vanhenee. DESIGN.md
 *     kohta 7: ei riippuvuuksia.
 *   - vaihtumishetki on Suomessa yöllä (klo 02 tai 03), eli siellä missä pelin
 *     ensisijainen yleisö nukkuu. Se on paras hetki jonka yksi kello voi antaa;
 *     täydellistä ei ole, koska vuorokausi vaihtuu jossain aina keskellä päivää.
 *   - **ruudulla lukeva päivämäärä on sama UTC-päivä**, ei selaimen oma. Peli ei
 *     siis koskaan väitä pelaajalle että tänään on eri päivä kuin se kenttä jota
 *     hän pelaa. Kaksi kelloa olisi pahempi kuin väärä kello.
 *
 * Hinta sanotaan ääneen: suomalainen pelaaja saa klo 00–02 välillä vielä
 * *eilisen* kentän, ja ruudulla lukee eilisen päivämäärä. Se on oikein — kenttä
 * ja päiväys ovat samaa mieltä — mutta se on tarkoituksellinen ero kalenteriin.
 *
 * ## 2. Yritys kuluu kun kenttä alkaa, ja lataus on luovutus
 *
 * Tallennus merkitään heti kun kenttä käynnistyy, ei vasta kun se päättyy.
 * Toisinpäin tehtynä koko tila olisi teatteria: F5 kuoleman jälkeen antaisi
 * uuden yrityksen, eikä jaettu rivi kertoisi mistään.
 *
 * Sivun lataus kesken kentän **ei ole uusi yritys eikä myöskään nolla**: se on
 * luovutus siihen kohtaan johon pääsit. Siksi pisin edetty sarake kirjoitetaan
 * talteen kentän aikana (ks. `dailyProgress`), ja kesken jäänyt merkintä luetaan
 * tulokseksi sellaisenaan. Vaihtoehdot punnittiin ja molemmat ovat huonompia:
 * "lataus ei maksa mitään" on sama asia kuin ei yritysrajaa lainkaan, ja
 * "lataus = 0 %" rankaisisi kaatuneesta välilehdestä ankarammin kuin
 * kuolemasta.
 *
 * ## 3. Alkuperäisyys ja maareitti on tarkistettu ETUKÄTEEN, ei täällä
 *
 * DESIGN.md kohta 3 vaatii että generoitu kenttä verrataan korpukseen, ja kohta
 * 5 että maareitti on läpäistävissä voimatasolla 0. Kumpaakaan ei voi tehdä
 * selaimessa: korpus ei ole repossa eikä julkaisussa, ja botti (`playable.mjs`)
 * ajaa moottoria Nodesta. Selaimessa generoitu kenttä olisi siis sekä
 * `not checked` että todistamaton — kaksi reikää kahdessa säännössä joita tämä
 * projekti pitää ehdottomina.
 *
 * Vastaus on että **siemenavaruus on äärellinen**. Päivän kenttä on funktio
 * päivästä, joten koko ikkuna voidaan luetella etukäteen:
 * `tools/daily-origin.mjs` generoi jokaisen päivän kentän, vertaa sen
 * korpukseen ja pelaa sen botilla läpi voimatasolla 0 — ja repoon jää
 * `src/data/daily-origin.js`, jossa on **pelkkä tuomio**: ikkunan rajat, per
 * päivä se yritysnumero joka läpäisi, ja sormenjälki niiden kenttien tavuista.
 * Korpusta ei kopioida, kenttiä ei kopioida.
 *
 * Ikkunan ulkopuolella tila **ei tarjoa kenttää**. Se on tarkoituksellisesti
 * ankarampi kuin `origin: 'not checked'` toimitetuissa kentissä: päivän kenttä
 * on ainoa sisältö jota pelaaja ei valitse, ja se lähtee jaettuna rivinä
 * eteenpäin muille. Tarkistamaton päivän kenttä olisi huonompi kuin ei päivän
 * kenttää — sama lause kuin läpipääsemättömästä kentästä, ja samasta syystä.
 */
import { buildLevel, validateGenerated, mulberry32, THEME_RULES } from '../data/generator.js';
import { defaultTime, registerLevel } from '../data/levels.js';
import { DAILY_ORIGIN } from '../data/daily-origin.js';

/** Se tunnus jolla kenttä kulkee moottorissa ja telemetriassa. */
export const DAILY_ID = 'PP';

/**
 * Tilan nimi, yhtenä merkkijonona.
 *
 * Sitä lukee neljä paikkaa — alkuruudun valikko, välikortti, HUD ja tämän tilan
 * oma ruutu — ja neljä kirjoitusasua olisi neljä eri tilaa pelaajan silmissä.
 */
export const DAILY_TITLE = 'PÄIVÄN PIERU';

const DAY_MS = 86400000;

/**
 * Vuorokausia epookista UTC:ssä. `Date.now()` on UTC-millisekunteja, joten
 * tässä ei ole aikavyöhykettä eikä kesäaikaa — ks. otsikon kohta 1.
 */
export const dayNumber = (now = Date.now()) => Math.floor(now / DAY_MS);

/** Sama päivä ihmisen luettavana, ja aina UTC:nä samasta syystä. */
export function dayLabel(day) {
  const d = new Date(day * DAY_MS);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
}

/*
 * Ne seitsemän teemaa joita päivän kenttä voi olla, ja se kahdeksas joka ei voi.
 *
 * Linnake puuttuu, eikä se ole unohdus: `THEME_RULES.fortress` on `boss: true`
 * eikä siinä ole lippua — sen uloskäynti on ovi jonka taistelu avaa, eikä
 * generaattorissa ole areenapalikkaa (sen kertoo `THEME_RULES` omin sanoin).
 * Generoitu linnakekenttä olisi siis huone jossa ei ole ulospääsyä.
 */
const DAILY_THEMES = ['grass', 'desert', 'night', 'ice', 'factory', 'bone', 'cloud'];

/** Kunkin teeman oma raita, samat nimet kuin `PLAN`issa `gen-levels.mjs`:ssä. */
const DAILY_MUSIC = { factory: 'factory', bone: 'bone', cloud: 'cloud' };

/**
 * Siemen, ja miksi siinä on kaksi termiä.
 *
 * `day` tekee kentästä päivän omansa. `attempt` on se numero jonka
 * `tools/daily-origin.mjs` kirjaa todistukseen: jos päivän ensimmäinen siemen ei
 * läpäissyt sääntöjä, osui korpukseen tai kaatoi botin, todistus osoittaa
 * seuraavaan. Selain ei siis etsi vaan rakentaa sen kentän joka on tarkistettu.
 *
 * Luvut ovat alkulukuja ja samaa kokoluokkaa kuin `gen-levels.mjs`:n omassa
 * `seedFor`issa. Siemenavaruus on tarkoituksella eri kuin toimitettujen kenttien:
 * päivän kenttä ei saa olla sama kenttä kuin 5-3.
 */
export const dailySeed = (day, attempt) => 990001 + day * 104729 + attempt * 7919;

/**
 * Päivän resepti: mistä kenttä tehdään. Puhdas funktio päivästä.
 *
 * Omassa satunnaisvirrassaan (`0xda11y` + päivä) siksi, että teeman ja leveyden
 * pitää pysyä samana vaikka `attempt` vaihtuu — muuten todistuksen "seuraava
 * yritys" vaihtaisi koko maailmaa eikä kenttää.
 *
 * Numerot ovat editorial ja perustelu on kussakin rivissä:
 *   `maxGap` 5   Kuusi on mitatun hyppybudjetin oma reuna ja kuuluu maailmalle 3
 *                ja linnakkeille. Päivän kentässä on yksi yritys, joten se ei
 *                pyydä pelin kovinta hyppyä.
 *   `minIntro`   48 jäällä, 32 muualla. Sama mitattu ero kuin maailmoissa 3 ja 1
 *                (`gen-levels.mjs`): jään kitka vie aloituksen.
 *   `intensity`  1.2 ja `enemiesPer100` 8.0 — pelin keskivaiheilta. Päivän
 *                kenttä ei ole käyrä vaan yksi kenttä, joten se ei nouse
 *                mihinkään eikä notkahda mistään.
 */
export function dailySpec(day) {
  const r = mulberry32(0xda11 + day);
  const theme = DAILY_THEMES[Math.floor(r() * DAILY_THEMES.length)];
  const targetWidth = 260 + Math.floor(r() * 9) * 10;
  return {
    theme,
    targetWidth,
    maxGap: 5,
    minIntro: theme === 'ice' ? 48 : 32,
    intensity: 1.2,
    enemiesPer100: 8,
  };
}

/**
 * Rakentaa päivän kentän annetulla yrityksellä. Ei koske todistukseen — tämä on
 * se funktio jota `tools/daily-origin.mjs` kutsuu kun todistusta vasta tehdään.
 *
 * @returns {{def: object, problems: string[]}} kenttä ja se mitä säännöt siitä
 *   sanovat. Tyhjä `problems` on ainoa hyväksyttävä vastaus.
 */
export function dailyBuild(day, attempt) {
  const spec = dailySpec(day);
  const built = buildLevel({ seed: dailySeed(day, attempt), ...spec });
  const problems = validateGenerated(DAILY_ID, built.rows, built, spec.theme);
  const def = {
    id: DAILY_ID,
    theme: spec.theme,
    bg: THEME_RULES[spec.theme].bg,
    music: DAILY_MUSIC[spec.theme] || 'level',
    rows: built.rows,
    time: defaultTime(built.rows[0].length),
    boss: false,
    bossVariant: 0,
    bands: null,
    /* Tästä lipusta HUD tietää sanoa "PÄIVÄN PIERU" eikä "MAAILMA PP". */
    daily: true,
    day,
    attempt,
  };
  /* Välimuistiin heti, koska `src/core/secrets.js` kysyy kentän `getLevel`illa
   * heti ensimmäisestä tiilestä johon pelaaja koskee. Ks. `registerLevel`. */
  registerLevel(def);
  return { def, problems };
}

/**
 * Mitä todistus sanoo tästä päivästä, tai `null` jos päivä on ikkunan ulkopuolella.
 *
 * `attempts` on merkkijono, **kaksi** 36-kantaista merkkiä per päivä ikkunan
 * alusta lukien (eli 0…1295). Kaksi eikä yksi, koska siemenistä kelpaa
 * karkeasti joka kymmenes — sama luku kuin `gen-levels.mjs`:n omassa haussa —
 * ja yhden merkin mahtuisi 36, mikä jättäisi osan päivistä ilman kenttää.
 */
export function dailyCertificate(day) {
  const o = DAILY_ORIGIN;
  if (!o || day < o.from || day > o.to) return null;
  const at = (day - o.from) * 2;
  const attempt = parseInt(o.attempts.slice(at, at + 2), 36);
  if (!Number.isInteger(attempt)) return null;
  return { attempt, origin: o.origin, from: o.from, to: o.to };
}

/**
 * Päivän kenttä pelattavaksi, tai syy siihen miksi sitä ei ole.
 *
 * Kaksi porttia, ja ne ovat eri asioita:
 *   `ikkuna`  todistus ei kata tätä päivää. Kenttä olisi tarkistamaton, joten
 *             sitä ei tarjota lainkaan (ks. otsikon kohta 3).
 *   `saannot` kenttä ei läpäise `validateLevel`ia tässä selaimessa. Ei pitäisi
 *             tapahtua koskaan — todistus on tehty samasta koodista — mutta
 *             porttia ei jätetä pois siksi että se on epätodennäköinen: se on
 *             ainoa lupaus jonka selain voi itse pitää, ja se pidetään.
 */
export function dailyLevel(day = dayNumber()) {
  const cert = dailyCertificate(day);
  if (!cert) return { ok: false, reason: 'ikkuna', day };
  const { def, problems } = dailyBuild(day, cert.attempt);
  if (problems.length) return { ok: false, reason: 'saannot', day, problems };
  def.origin = cert.origin;
  return { ok: true, day, def };
}

/* ------------------------------ se yksi yritys --------------------------- */

/*
 * Oma avain eikä `sfb3.save.v2`, ja se on harkittu.
 *
 * Päivän tulos ei ole pelin edistymistä: se ei kanna elämiä, maailmaa eikä
 * solmuja, se vanhenee vuorokaudessa ja sen saa nollata ilman että kukaan
 * menettää läpipeluutaan. Oma avain antaa sille oman versionumeron (DESIGN.md
 * kohta 6: muodon muuttuessa numero nousee) eikä pakota nostamaan tallennuksen
 * versiota — mikä pyyhkisi jokaiselta pelaajalta elämät ja maailmat sen takia
 * että peliin tuli uusi tila.
 */
const KEY = 'sfb3.daily.v1';

const readRaw = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeRaw = (rec) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* yksityinen tila tai muisti täynnä — tila toimii, tulos ei säily */
  }
};

/** Tämän päivän merkintä, tai `null`. Eilinen merkintä ei ole tämän päivän. */
export function dailyRecord(day = dayNumber()) {
  const rec = readRaw();
  return rec && rec.day === day ? rec : null;
}

/**
 * 'vapaa'  yritystä ei ole käytetty
 * 'kesken' yritys aloitettiin eikä se päättynyt — eli sivu ladattiin kesken
 * 'valmis' tulos on lopullinen
 */
export function dailyStatus(day = dayNumber()) {
  const rec = dailyRecord(day);
  if (!rec) return 'vapaa';
  return rec.state === 'kesken' ? 'kesken' : 'valmis';
}

/**
 * Kuluttaa päivän yrityksen. Palauttaa `false` jos se on jo kulutettu — se on
 * tilan koko sääntö, ja se on tässä yhdessä lauseessa eikä kutsujan muistissa.
 */
export function dailyBegin(day = dayNumber()) {
  if (dailyRecord(day)) return false;
  writeRaw({ day, state: 'kesken', reach: 0, score: 0, coins: 0, cleared: false });
  return true;
}

/** Pisin edetty osuus ja sen hetkinen tulos. Vain kasvaa, ks. otsikon kohta 2. */
export function dailyProgress(day, { reach = 0, score = 0, coins = 0 } = {}) {
  const rec = dailyRecord(day);
  if (!rec || rec.state !== 'kesken') return;
  rec.reach = Math.max(rec.reach, Math.min(100, Math.round(reach)));
  rec.score = Math.max(rec.score, Math.round(score));
  rec.coins = Math.max(rec.coins, Math.round(coins));
  writeRaw(rec);
}

/** Kenttä päättyi pelaamalla: tulos on lopullinen. */
export function dailyFinish(day, { cleared = false, reach = 0, score = 0, coins = 0 } = {}) {
  const rec = dailyRecord(day) || { day, reach: 0, score: 0, coins: 0 };
  rec.state = 'valmis';
  rec.cleared = !!cleared;
  rec.reach = cleared ? 100 : Math.max(rec.reach, Math.min(100, Math.round(reach)));
  rec.score = Math.max(rec.score, Math.round(score));
  rec.coins = Math.max(rec.coins, Math.round(coins));
  writeRaw(rec);
  return rec;
}

/**
 * Kesken jäänyt yritys lopullisena tuloksena. Kutsutaan silloin kun tilaan
 * palataan ja merkintä on yhä 'kesken', eli sivu ladattiin kentän aikana.
 */
export function dailyForfeit(day = dayNumber()) {
  const rec = dailyRecord(day);
  if (!rec || rec.state !== 'kesken') return rec;
  rec.state = 'valmis';
  rec.keskeytyi = true;
  writeRaw(rec);
  return rec;
}

/* --------------------------------- jakorivi ------------------------------ */

/**
 * Se rivi joka lähtee kaverille — ja se mitä siinä **ei** ole.
 *
 * Rivi kertoo päivän ja tuloksen eikä yhtään mitään kentästä: ei teemaa, ei
 * leveyttä, ei sitä mihin jäit kiinni. Se on koko tilan idea: kaikki pelaavat
 * samaa kenttää, joten rivi joka kuvailee kenttää on juoni kerrottuna sille
 * joka ei ole vielä pelannut.
 *
 * Ja koska "ei paljasta" on mielipide, se on tehty mitattavaksi: rivi on
 * funktio **pelkästä tuloksesta ja päivästä**, joten kahden eri päivän kentät
 * samalla tuloksella tuottavat rivin joka eroaa vain päiväyksestä.
 * `tools/verify.mjs` mittaa juuri sen.
 */
export function dailyShareLine(rec) {
  if (!rec) return null;
  const how = rec.cleared ? 'MAALIIN ASTI' : `${rec.reach} PROSENTTIA`;
  const kesken = rec.keskeytyi ? ' (KESKEYTYI)' : '';
  return `${DAILY_TITLE} ${dayLabel(rec.day)}: ${how}${kesken}, ${rec.score} PISTETTÄ.`;
}

/** Kaikki tämän tilan piirtämät merkkijonot, fonttiportille. */
export function dailyStrings() {
  return [
    DAILY_TITLE,
    'YKSI KENTTÄ, YKSI YRITYS, SAMA KAIKILLE',
    'Z ALOITA',
    'YKSI YRITYS. LATAUS EI ANNA UUTTA.',
    'ENTER TAKAISIN',
    'X KERRO KAVERILLE',
    'YRITYS ON KÄYTETTY',
    'PÄIVÄ VAIHTUU KESKIYÖLLÄ UTC',
    'TÄLLE PÄIVÄLLE EI OLE TARKISTETTUA KENTTÄÄ',
    'AJA TOOLS/DAILY-ORIGIN.MJS',
    'TARKISTETTU KORPUSTA VASTEN',
    'MAALIIN ASTI',
    'PROSENTTIA',
    'KESKEYTYI',
    'PISTETTÄ',
    dailyShareLine({ day: dayNumber(), reach: 63, score: 12345, cleared: false }),
    dailyShareLine({ day: dayNumber(), reach: 100, score: 12345, cleared: true }),
    dayLabel(dayNumber()),
  ];
}
