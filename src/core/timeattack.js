/**
 * AIKA-AJO. Kenttä on rata, ja radalla on vain yksi vastustaja: sinä viime
 * kerralla.
 *
 * Tila ei keksi peliin nopeutta, se sanoo ääneen sen mitä peli on aina
 * ajatellut. Maali maksaa `jäljellä oleva aika × 50`, eli pistelasku on jo
 * ollut sitä mieltä että nopeus on pointti — mutta se sanoo sen vasta kentän
 * jälkeen, kertaluvulla, ja sekoitettuna kolikoihin ja vihollisiin. Jako sanoo
 * saman asian kesken kentän ja pelkkänä.
 *
 * **Kentän kello ei kelpaa tavoiteajaksi**, ja se on mittaus eikä mielipide:
 * `defaultTime` antaa kentälle noin 1,3 aikayksikköä sarakkeelta eli 31,2
 * framea, kun täysi juoksuvauhti (`MAX_RUN` 2,5 px/frame) vie sarakkeen 6,4
 * framessa. Budjetti on siis noin **4,9-kertainen** siihen nähden mitä rata
 * kestäisi pysähtymättä — `tools/verify.mjs` mittaa suhteen kaikista 60
 * kentästä, pienin 4,8x. Se on määräaika, ei tavoiteaika: sitä vasten jokainen
 * pelaaja olisi minuutin edellä joka kentässä eikä lukema opettaisi mitään.
 * Siksi vertailukohta on pelaajan oma ennätys ja "ei ennätystä" on oikea tila
 * eikä puuttuva arvo.
 *
 * Aika mitataan **frameina**, koska koko moottori mittaa frameina (PHYSICS.md:
 * kaikki nopeudet ovat pikseliä per frame). Kellotettu sekunti rankaisisi
 * hitaasta koneesta: 30 framea sekunnissa pyörittävä selain pelaa saman radan
 * samoilla frameilla mutta kaksinkertaisella seinäkellolla, ja se olisi eri
 * aika samasta pelistä.
 *
 * **Ja siitä seuraa aukko, joka on parempi kirjoittaa kuin peittää.** Kello käy
 * taukovalikossa, mutta se ei käy silloin kun selainvälilehti on taustalla:
 * `requestAnimationFrame` ei aja mitään, joten frameja ei kulu. Aukkoa ei
 * suljeta seinäkellolla, eikä syy ole periaatteellinen vaan mitattu:
 * `Game.frame` leikkaa yli 250 ms:n askeleen yhteen 16,7 ms:n askeleeseen, ja
 * vaikka leikkaus poistettaisiin, silmukka ajaa enintään **viisi askelta
 * framessa**. Viiden sekunnin taustalla olo maksaisi siis nykyisellään 1 framen
 * ja leikkauksen ilman 5 — ei 300:aa. Seinäkelloon siirtyminen ei ole
 * viritys vaan koko aika-askeleen uudelleenrakentaminen, ja se rakentaisi sen
 * niin että hidas kone häviää nopeammalle samasta pelistä.
 *
 * Tila siis lupaa sen minkä voi pitää: **valikko maksaa, ja peli ei pysähdy
 * siitä että pelaaja katsoo kenttää.** Alt-tab on rehellisyyskysymys pelaajan
 * ja hänen oman ennätyksensä välillä, ja tässä pelissä ne ovat sama ihminen.
 */

import { isBaseMode, modeId } from '../data/scale.js';

/**
 * Montako välipistettä radalla on. Jako on elävä vain jos sillä on mihin
 * verrata *kesken* kentän, ja pelkkä loppuaika ei sitä anna. Kahdeksan on
 * ruudullinen matkaa kerrallaan pelin lyhyimmässäkin kentässä (200 saraketta /
 * 8 = 25 saraketta eli reilu ruutu), eli lukema ehtii vaihtua monta kertaa
 * mutta ei värähdellä.
 */
export const RACE_SPLITS = 8;

/** Framea, joina juuri vaihtunut jako näkyy käänteisenä. */
export const SPLIT_FLASH = 24;

/**
 * Jaon värit. Nämä eivät ole makuasia vaan DESIGN.md kohta 8: kaksi
 * samannäköistä signaalia opettaa väärän luennan, ja HUD-nauhassa on jo
 * punainen kello, oranssi ummetus, keltaiset kolikot ja vihreä maailma.
 * `tools/verify.mjs` mittaa etäisyyden jokaiseen niistä.
 *
 * `none` on tarkoituksella himmeämpi kuin yksikään palava lukema: "ei tietoa"
 * saa lukea sammuneena, samalla tavalla kuin sammunut voimapallo.
 */
export const SPLIT_COLORS = {
  ahead: '#40e0a0',
  behind: '#e070ff',
  none: '#5a5a76',
};

/** Mitä jaon paikalla lukee kun vertailukohtaa ei ole. */
export const NO_DATA = '--.-';

export const MODE_NAME = 'AIKA-AJO';
export const PAUSE_TITLE = 'TAUKO - KELLO KÄY';
export const PAUSE_KEYS = '5 NOLLAA AJAT  7 EFEKTIT  9 DEBUG';
export const NO_SAVESTATES = 'AIKA-AJOSSA EI TILATALLENNUKSIA';
export const CONFIRM_RESET = 'PAINA 5 UUDESTAAN';
export const TIMES_CLEARED = 'AJAT NOLLATTU';
export const NOTHING_TO_CLEAR = 'EI AIKOJA NOLLATTAVAKSI';
export const NEW_RECORD = 'UUSI ENNÄTYS';
export const FIRST_TIME = 'AIKA KIRJATTU';
export const RUN_LABEL = 'AJO';
export const BEST_LABEL = 'PARAS';

/**
 * Parhaat ajat tallennuksessa. Aina tämän kautta, koska kutsujia on kolme
 * erilaista lähtökohtaa: uusi tallennus, vanha tallennus jossa kenttää ei ole,
 * ja `restoreState`n asettama tila joka ei kulje `adoptState`n läpi. Yksikään
 * niistä ei saa kaataa lukijaa.
 */
export function bestTimes(state) {
  if (!state) return {};
  if (!state.bestTimes || typeof state.bestTimes !== 'object') state.bestTimes = {};
  return state.bestTimes;
}

/**
 * Ennätyksen avain: kenttätunnus HELPOLLA, vaikeustaso edessä muuten.
 *
 * NORMAALIn 2-3 on kaksi kertaa pidempi rata kuin HELPON 2-3, ja sama nimi
 * niille tarkoittaisi että toisella tasolla ajettu aika "voittaa" toisella
 * ajetun tai jää sen alle. Ennätys on lupaus siitä että sama rata ajettiin
 * nopeammin, ja se lupaus pitää vain jos avain tuntee radan.
 *
 * HELPPO pitää paljaan tunnuksen, jotta jo ajetut ajat ovat yhä omistajansa —
 * sama peruste kuin `DEFAULT_SAVE`n `mode: 'easy'`illa.
 */
export const raceKey = (id, mode) => (isBaseMode(mode) ? id : `${modeId(mode)} ${id}`);

/** Yhden kentän ennätys, tai null. Välipisteet aina täyteen mittaan. */
export function bestFor(state, id) {
  const row = bestTimes(state)[id];
  if (!row || typeof row.frames !== 'number' || !(row.frames > 0)) return null;
  const raw = Array.isArray(row.marks) ? row.marks : [];
  const marks = [];
  for (let i = 0; i < RACE_SPLITS; i++) {
    marks.push(typeof raw[i] === 'number' && raw[i] > 0 ? Math.round(raw[i]) : 0);
  }
  return { frames: Math.round(row.frames), marks };
}

/**
 * Kirjaa ajon, jos se oli nopeampi. Ehto on täällä eikä kutsujassa siksi että
 * kutsujia tulee lisää ja ehto on koko lupaus: ennätys ei saa huonontua.
 *
 * @returns true jos ennätys vaihtui.
 */
export function setBest(state, id, run) {
  if (!run || !(run.frames > 0)) return false;
  const cur = bestFor(state, id);
  if (cur && cur.frames <= run.frames) return false;
  const marks = [];
  for (let i = 0; i < RACE_SPLITS; i++) {
    marks.push(Array.isArray(run.marks) && run.marks[i] > 0 ? Math.round(run.marks[i]) : 0);
  }
  bestTimes(state)[id] = { frames: Math.round(run.frames), marks };
  return true;
}

/** @returns montako aikaa nollattiin. */
export function clearBestTimes(state) {
  const n = Object.keys(bestTimes(state)).length;
  state.bestTimes = {};
  return n;
}

/** `M:SS.S` — aina saman levyinen kunnes kymmenen minuuttia täyttyy. */
export function formatTime(frames) {
  const t = Math.max(0, Math.round(Number(frames) || 0)) / 60;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

/**
 * Ero ennätykseen sekunteina, etumerkki aina näkyvissä. Alle sadan sekunnin
 * kymmenyksen tarkkuudella, sen yli kokonaisina — kymmenys ei ole kolmen
 * minuutin erossa tietoa vaan levyttä.
 */
export function formatDelta(frames) {
  if (frames === null || frames === undefined || Number.isNaN(Number(frames))) return NO_DATA;
  const s = Number(frames) / 60;
  const sign = s < 0 ? '-' : '+';
  const a = Math.min(9999, Math.abs(s));
  return a < 100 ? `${sign}${a.toFixed(1)}` : `${sign}${Math.round(a)}`;
}

/**
 * Kaikki mitä tila kirjoittaa ruudulle, myös numeromuodot ääripäissään.
 * `tools/verify.mjs` piirtää jokaisen merkin erikseen ja etsii mustetta:
 * puuttuva merkki ei heitä, se jättää reiän ja siirtää kohdistinta.
 */
export const MODE_STRINGS = [
  MODE_NAME, PAUSE_TITLE, PAUSE_KEYS, NO_SAVESTATES, CONFIRM_RESET, TIMES_CLEARED,
  NOTHING_TO_CLEAR, NEW_RECORD, FIRST_TIME, RUN_LABEL, BEST_LABEL, NO_DATA,
  formatTime(0), formatTime(59 * 60 + 59), formatTime(9 * 3600 * 60),
  formatDelta(0), formatDelta(-5999), formatDelta(6000), formatDelta(-600000),
];
