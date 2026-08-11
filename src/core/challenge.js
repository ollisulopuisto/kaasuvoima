/**
 * Haaste: kaverin tulos kulkee jakolinkin osoiteparametreissa.
 *
 *     https://kaasuvoima.vercel.app/?s=45200&n=OLLI&l=2-3
 *
 * Tämä on se mitä ROADMAPin "pistetaulu ei mene palvelimelle, tulos menee
 * linkkiin" tarkoittaa käytännössä. Ei palvelinta, ei päätepistettä, ei
 * globaalia taulua — pelkkä osoite, jonka lapsi liimaa viestiin. Kolme
 * parametria, ja jokainen on lyhyt siksi että linkkiä katsotaan puhelimen
 * osoiterivillä:
 *
 *   s  pisteet, kokonaisluku ilman välimerkkejä      pakollinen
 *   n  pistetaulun nimimerkki, enintään kuusi merkkiä valinnainen
 *   l  kenttätunnus jonne kierros ylsi, esim. "2-3"   valinnainen
 *
 * **Versionumeroa linkissä ei ole, ja se on päätös eikä unohdus.** `GAME_VERSION`
 * on pistetaulun rivillä siksi että vanha tulos on eri buildilta ja sen näkeminen
 * on rehellistä. Linkissä sillä ei olisi mitään tehtävää: vastaanottaja ei voi
 * pelata sitä vanhaa buildia, joten tieto olisi neljäs parametri jolla ei voi
 * tehdä mitään. Ja jos versio *olisi* linkissä, joku kirjoittaisi ennen pitkää
 * säännön "eri versiosta tullut haaste ei kelpaa" — mikä olisi suoraan vastoin
 * sitä mitä `scores.js` jo lupaa: pistetaulua ei tyhjennetä version vaihtuessa,
 * koska pelaajaa ei rangaista meidän muokkauksistamme. Sama peruste, sama
 * vastaus.
 *
 * Huijaaminen ei ole ongelma jota tässä ratkaistaan. Allekirjoitettu tulos
 * suojaisi väärentämiseltä, jonka ainoa uhri on väärentäjä itse: oman
 * kehulinkin keksiminen on itseään vastaan.
 *
 * Yksi sääntö kattaa kaiken roskan: **haaste on väite ajosta jonka tämä peli
 * olisi voinut tuottaa.** Jos väite ei ole sellainen, ei ole haastetta, ja
 * alkuruutu on täsmälleen se mikä se olisi ilman linkkiäkin. Puolikas haaste —
 * nimi ilman pisteitä, pisteet joita ei voi voittaa, teksti joka valuu ruudun
 * yli — olisi pahempi kuin ei haastetta lainkaan, koska se näyttää rikkinäiseltä
 * peliltä eikä rikkinäiseltä linkiltä.
 */
import { NAME_LENGTH } from './scores.js';
import { hasLevel } from '../data/levels.js';

/** Ne ja vain ne parametrit jotka tämä moduuli omistaa ja siivoaa pois. */
export const PARAMS = ['s', 'n', 'l'];

/**
 * Suurin tulos jonka pelin oma pistetaulu osaa näyttää (`padNum(score, 7)`).
 * Isompi luku ei ole tästä pelistä, joten se ei ole haaste vaan roskaa.
 */
export const MAX_SCORE = 9999999;

/** Nimetön haastaja. Kuusi merkkiä, eli mahtuu samaan tilaan kuin nimimerkki. */
export const ANON = 'KAVERI';

/**
 * Merkit jotka `NameEntryScene` osaa tuottaa — ja siis ne, ja vain ne, jotka
 * pelin oma fontti osaa piirtää nimeen.
 *
 * Suodatus ei ole turvallisuustoimenpide: teksti piirretään `drawText`illä
 * bittikarttafontista, joten merkkijonoa ei tulkita missään eikä
 * injektiopintaa ole. Suodatus on **mittatoimenpide**. `drawText` hyppää
 * tuntemattoman merkin yli mutta siirtää silti kohdistinta eteenpäin, joten
 * kiinalainen tai emojinimi tuottaisi levyisen palan tyhjää — ja pituusrajan
 * kanssa sekin olisi vielä siedettävää, mutta rivin leveyttä ei voisi laskea
 * merkkimäärästä, ja juuri se lasku pitää haasterivin 320 pikselin sisällä.
 */
const DRAWABLE = /[A-ZÄÖ0-9 ]/;

/**
 * Linkin nimi ruudulle kelpaavaksi: isot kirjaimet, vain piirtyvät merkit,
 * enintään pistetaulun nimen mittainen. Tyhjästä tulee `fallback`.
 */
export function cleanName(raw, fallback = ANON) {
  let out = '';
  for (const ch of String(raw == null ? '' : raw).toUpperCase()) {
    if (out.length >= NAME_LENGTH) break;
    if (DRAWABLE.test(ch)) out += ch;
  }
  return out.trim() || fallback;
}

/**
 * Osoiteparametreista haaste, tai `null`.
 *
 * Pisteet luetaan **merkkijonona säännöllisellä lausekkeella** eikä
 * `Number()`illa, ja se on tarkoituksellista: `Number` hyväksyy `-5`, `1e999`,
 * ` 45200`, `0x1f` ja `Infinity`, ja jokainen niistä pitäisi hylätä erikseen.
 * `^\d{1,7}$` päästää läpi täsmälleen sen mitä pelin oma pistetaulu voi
 * kirjoittaa, eikä mitään muuta — myös yläraja tulee siitä ilmaiseksi.
 */
export function parseChallenge(search = '') {
  const params = new URLSearchParams(String(search || ''));
  const raw = params.get('s');
  if (!raw || !/^\d{1,7}$/.test(raw)) return null;
  const score = Number(raw);
  if (score <= 0) return null;          // s=0 ei ole tulos jonka voi hävitä
  const level = String(params.get('l') || '');
  return {
    score,
    name: cleanName(params.get('n')),
    /* Kenttätunnus on kuvateksti eikä haasteen ehto. Tuntematon tunnus
     * jätetään pois — koko haasteen hylkääminen kirjoitusvirheen takia veisi
     * pelaajalta sen mitä hän tuli katsomaan. */
    level: hasLevel(level) ? level : '',
    /** Istunnon aikana asetettava merkintä siitä että tämä on jo voitettu. */
    beaten: false,
  };
}

/** Pistetaulun rivistä linkin kyselyosa, tai tyhjä jos kehuttavaa ei ole. */
export function challengeParams(entry) {
  if (!entry) return '';
  const score = Math.floor(Number(entry.score) || 0);
  // Tyhjä taulu ei saa tuottaa `?s=0`. Nollan kehuminen on huonompi kuin
  // kehumatta jättäminen, ja vastaanottaja saisi haasteen jonka voittaa
  // kävelemällä ensimmäisen kolikon ohi.
  if (score <= 0) return '';
  const params = new URLSearchParams();
  params.set('s', String(Math.min(score, MAX_SCORE)));
  const name = cleanName(entry.name, '');
  if (name) params.set('n', name);
  const level = String(entry.level || '');
  if (hasLevel(level)) params.set('l', level);
  return params.toString();
}

/**
 * Osoite ja tulos yhteen. Perusosoite tulee `og:url`-tagista (ks. share.js),
 * joten se saattaa jo kantaa omaa kyselyään tai ankkuriaan — kumpikaan ei ole
 * tänään totta, mutta tagia ylläpidetään käsin ja rikkoutuminen olisi hiljaista.
 */
export function appendChallenge(base, entry) {
  const query = challengeParams(entry);
  if (!query) return base;
  const cut = String(base).indexOf('#');
  const head = cut < 0 ? String(base) : String(base).slice(0, cut);
  const tail = cut < 0 ? '' : String(base).slice(cut);
  return `${head}${head.includes('?') ? '&' : '?'}${query}${tail}`;
}

/**
 * 45 200 eikä 45200. Kolmen ryhmät ovat ainoa syy siihen että ruudulta näkee
 * yhdellä silmäyksellä onko luku kymmeniä vai satojatuhansia — ja haasterivi
 * on juuri se paikka jossa lukua vilkaistaan eikä lueta.
 */
export function groupThousands(value) {
  return String(Math.max(0, Math.floor(Number(value) || 0)))
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Alkuruudun rivi. Yksi rivi, koska sen leveys pitää pystyä takaamaan. */
export function challengeLine(ch) {
  if (!ch) return '';
  const where = ch.level ? ` (${ch.level})` : '';
  const score = groupThousands(ch.score);
  return ch.beaten
    ? `VOITIT HAASTEEN! ${ch.name} SAI ${score}${where}`
    : `${ch.name} HAASTAA SINUT: ${score} PISTETTÄ${where}`;
}

/**
 * Voittiko tämä tulos haasteen. Sama sääntö kuin pistetaululla: pisteet pitää
 * *voittaa*, ei tasata (`scores.js`, tasapelissä vanhempi rivi pitää paikkansa).
 */
export function beats(score, ch) {
  return !!ch && Number(score) > ch.score;
}

/** Istunnon haaste. Muistissa, ei levyllä — vastaanotto ei kirjoita mitään. */
let current = null;

export function challenge() {
  return current;
}

/**
 * Luetaan kerran käynnistyksessä ja **poistetaan osoiteriviltä saman tien**.
 *
 * Poistolla on kaksi syytä, ja jälkimmäinen on se joka ratkaisee:
 *
 *   1. Päivitys ei saa herättää vanhentunutta haastetta. Kierros pelataan,
 *      haaste voitetaan, F5 — ja sama haaste olisi taas ruudulla voittamatta.
 *   2. **Vastaanottaja ei saa lähettää lähettäjän tulosta eteenpäin.** Kun hän
 *      avaa oman jakoruutunsa, linkki rakennetaan `og:url`-tagista ja hänen
 *      omasta pistetaulustaan — mutta jos alkuperäiset parametrit jäisivät
 *      osoiteriville, mikä tahansa myöhempi "jaa tämä sivu" -tie kantaisi ne
 *      mukanaan. Silloin linkki muuttuisi matkalla ja kaveripiiri jakaisi yhtä
 *      ja samaa pistemäärää ristiin, kukaan tietämättä kenen se on.
 *
 * `replaceState` eikä `pushState`: paluunappi ei saa viedä takaisin haasteeseen,
 * koska se olisi sama vanhentunut haaste toista tietä. Muut parametrit jäävät
 * paikoilleen — `?touch=1` on kehitystyökalu joka asuu samassa kyselyssä eikä
 * kuulu tälle moduulille.
 */
export function takeChallenge(loc = location, hist = history) {
  current = parseChallenge(loc.search);
  const params = new URLSearchParams(loc.search || '');
  let found = false;
  for (const key of PARAMS) {
    if (params.has(key)) {
      params.delete(key);
      found = true;
    }
  }
  if (found) {
    const query = params.toString();
    try {
      hist.replaceState(hist.state, '', `${loc.pathname}${query ? `?${query}` : ''}${loc.hash}`);
    } catch {
      /* Sivu ei ole palvelimelta (file://) tai historia on kiellettu. Haaste on
       * jo muistissa, joten peli toimii; vain osoiterivi jää siivoamatta. */
    }
  }
  return current;
}
