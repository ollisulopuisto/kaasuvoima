/**
 * Jakoruutu — "kerro kaverille".
 *
 * Tarkoitus on yksi asia: saada pelin osoite kaverille puhelimesta, ilman että
 * mitään lähtee mihinkään palvelimelle. Kaikki tässä tiedostossa tapahtuu
 * selaimessa; ainoa asia joka poistuu sivulta on se teksti jonka pelaaja itse
 * painaa lähtemään käyttöjärjestelmän omaan jakovalikkoon tai leikepöydälle.
 * Sama peruste kuin telemetrian palvelinlähetyksen jättämisessä tekemättä
 * (ROADMAP kohta 2): peli on staattinen sivusto ja sitä pelaa lapsi kavereineen.
 *
 * Kolme portaikkoa, tässä järjestyksessä:
 *
 *   1. `navigator.share`      puhelin, ja se on se tapaus jota varten tämä on
 *   2. `navigator.clipboard`  työpöytä, jossa jakovalikkoa harvoin on
 *   3. osoite ruudulla        aina. Tämä ei voi epäonnistua.
 *
 * Ruutu ei koskaan jää jumiin: portaan 3 osoite on näkyvissä koko ajan, ja
 * takaisin pääsee kahdella eri napilla riippumatta siitä mitä jako teki.
 *
 * **Linkki kantaa myös tuloksen** (`?s=45200&n=OLLI&l=2-3`), eli tämä on
 * haasteen lähettävä pää; vastaanottava pää on `src/core/challenge.js` ja
 * alkuruutu. Sekin tapahtuu kokonaan selaimessa: parametrit ovat merkkejä
 * osoitteessa, ei tallennus jossakin. Tyhjä pistetaulu jakaa pelkän osoitteen —
 * `?s=0` olisi haaste jonka voittaa kävelemällä ensimmäisen kolikon ohi.
 */
import { drawText } from '../gfx/font.js';
import { Sfx } from '../core/audio.js';
import { loadScores, GAME_VERSION } from '../core/scores.js';
import { appendChallenge } from '../core/challenge.js';

const W = 320;

/** Sama nimi kuin `og:title`. Tämä on se mitä jakovalikko näyttää otsikkona. */
const SHARE_TITLE = 'Super Fart Bros 3';
const TAGLINE = 'Tasohyppely selaimessa. Ei asennusta, pelaa heti.';

/**
 * Jaettava osoite luetaan `og:url`-metatagista eikä `location.href`:stä.
 *
 * Syy on se mikä tekee linkistä kelvollisen: index.html:n og-tagit ja niistä
 * generoitu `card.png` antavat linkille esikatselukuvan, ja se toimii vain sille
 * osoitteelle jonka tagit ilmoittavat. Sivun oma osoite voi olla `localhost`,
 * esikatselu-URL tai kyselymerkkijonolla varustettu — jaettuna kaikki kolme ovat
 * joko rikki tai rumia. Metatagi on jo olemassa, sitä ylläpidetään, ja se on
 * määritelmällisesti se osoite jonka Slack ja WhatsApp osaavat avata kuvaksi.
 *
 * Varasuunnitelma on sivun oma osoite ilman kyselyä ja ankkuria — huonompi,
 * mutta olemassa myös silloin jos tagi joskus katoaa.
 */
export function shareUrl() {
  try {
    const meta = document.querySelector('meta[property="og:url"]');
    const tagged = meta && meta.getAttribute('content');
    if (tagged) return tagged;
  } catch {
    /* ei dokumenttia — pudotaan alle */
  }
  try {
    return `${location.origin}${location.pathname}`;
  } catch {
    return '';
  }
}

/**
 * Mistä tuloksesta kehutaan. Jos pelaaja juuri pääsi listalle, se rivi on
 * korostettuna pistetaulussa ja se on oikea rivi — muuten listan paras.
 * Nimi tulee mukaan, koska ilman sitä "sain 12000 pistettä" olisi valhe
 * silloin kun rivi ei ole omasi.
 */
export function bragEntry(back) {
  let list = back && Array.isArray(back.scores) ? back.scores : null;
  if (!list || !list.length) list = loadScores();
  if (!list.length) return null;
  const hi = back && typeof back.highlight === 'number' ? back.highlight : -1;
  return list[hi] || list[0] || null;
}

/**
 * Se osoite joka oikeasti lähtee: peliosoite ja tulos kyselyparametreina.
 *
 * Tämä on koko haasteen lähettävä pää. Perusosoite tulee edelleen `og:url`
 * -tagista — parametrit **lisätään** siihen eivätkä korvaa sitä, jotta linkin
 * esikatselukuva säilyy: Slack ja WhatsApp lukevat `card.png`:n sen osoitteen
 * tagien perusteella, ja kyselyparametri ei muuta sitä mikä sivu se on.
 *
 * Ja se mitä tässä *ei* ole: mitään mitä osoiteriviltä olisi luettu. Linkki
 * rakennetaan `og:url`-tagista ja tämän selaimen omasta pistetaulusta, joten
 * kaverilta saatu haaste ei voi tarttua mukaan matkalla eteenpäin.
 */
export function bragUrl(entry, base = shareUrl()) {
  return appendChallenge(base, entry);
}

/**
 * Mitä osoitelaatikossa lukee. **Perusosoite, ei haastelinkkiä**, ja se on
 * harkittu ero.
 *
 * Laatikko on porras 3: se osoite jonka pelaaja kirjoittaa ylös tai valokuvaa
 * kun jakovalikkoa ja leikepöytää ei ole. Haastelinkki ei kelpaa siihen
 * kahdesta syystä, ja ensimmäinen on ehdoton:
 *
 *   1. **Pelin oma fontti ei osaa piirtää `&`-merkkiä.** `src/gfx/font.js` on
 *      5x7-bittikartta, jossa on kirjaimet, numerot ja kourallinen välimerkkejä
 *      — ei et-merkkiä. Kyselymerkkijono piirtyisi siis muodossa
 *      `?S=12345 N=PIKKU L=2-3`, ja käsin kopioituna se on rikkinäinen osoite.
 *      Ruudulla lukeva osoite joka ei toimi on pahempi kuin ei osoitetta.
 *   2. Pisimmillään linkki on 64 merkkiä prosenttikoodattuine ääkkösineen
 *      (`?s=9999999&n=%C3%84%C3%84KK%C3%96S&l=5-F`). Sitä ei kirjoita ylös
 *      kukaan, saati lapsi.
 *
 * Jaettu ja kopioitu osoite on silti täysi haastelinkki — se kulkee koneen
 * kautta eikä silmän. Ero sanotaan ääneen ruudulla eikä jätetä arvattavaksi.
 */
export function boxUrl() {
  return shareUrl();
}

/** Se rivi joka lähtee linkin mukana. Osoite ei ole tässä — se menee omanaan. */
export function shareText(entry) {
  if (!entry || !entry.score) return `${SHARE_TITLE} - ${TAGLINE}`;
  const where = entry.level || `maailma ${entry.world || 1}`;
  return `${SHARE_TITLE}: ${entry.name} sai ${entry.score} pistettä (${where}).`
    + ' Pystytkö parempaan?';
}

/**
 * Mikä porras on käytettävissä. Tämä katsotaan kerran ruutua avattaessa, koska
 * napin teksti lupaa sen minkä nappi tekee: "JAA" siellä missä jakovalikko on
 * ja "KOPIOI" siellä missä ei. Nappi joka lupaa väärin on pahempi kuin nappi
 * jota ei ole.
 */
export function shareCapability(nav = typeof navigator === 'undefined' ? null : navigator) {
  if (nav && typeof nav.share === 'function') return 'share';
  if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') return 'clipboard';
  return 'none';
}

/** Rivitys pelin omalle 5x7-fontille: `max` merkkiä, sanat ehjinä. */
export function wrapText(text, max) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > max) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const STATUS = {
  idle: null,
  busy: { text: 'ODOTA...', color: '#8890b0' },
  shared: { text: 'LÄHTI MENEMÄÄN!', color: '#8fe04a' },
  copied: { text: 'OSOITE KOPIOITU - LIITÄ SE VIESTIIN', color: '#8fe04a' },
  cancelled: { text: 'PERUUTIT JAON. VOIT YRITTÄÄ UUDESTAAN.', color: '#ffd048' },
  manual: { text: 'KIRJOITA OSOITE YLÖS TAI OTA KUVA RUUDUSTA', color: '#ffd048' },
};

const HOW = {
  share: { label: 'Z JAA', note: 'PUHELIN AVAA OMAN JAKOVALIKKONSA' },
  clipboard: { label: 'Z KOPIOI OSOITE', note: 'OSOITE MENEE LEIKEPÖYDÄLLE' },
  none: { label: '', note: 'TÄSSÄ SELAIMESSA EI OLE JAKOA EIKÄ LEIKEPÖYTÄÄ' },
};

export class ShareScene {
  /** `back` on se kohtausolio johon palataan — sama olio, ei uusi. */
  constructor(game, back = null) {
    this.game = game;
    this.back = back;
    this.tick = 0;
    this.armed = false;
    this.busy = false;
    this.error = '';
    this.entry = bragEntry(back);
    this.text = shareText(this.entry);
    // `url` on se mikä lähtee, `shown` se mikä lukee laatikossa. Ne ovat sama
    // asia silloin kun kehuttavaa ei ole, ja eri asia silloin kun on.
    this.url = bragUrl(this.entry);
    this.shown = boxUrl();
    this.carries = this.url !== this.shown;
    this.how = shareCapability();
    // Ilman jakoa ja leikepöytää ruutu ei ole "valmis odottamaan nappia" vaan
    // valmiiksi siinä tilassa johon muut portaat päätyvät: osoite on ruudulla.
    this.status = this.how === 'none' ? 'manual' : 'idle';
    this.lines = wrapText(this.text, 46);
  }

  /**
   * Jako lähtee napin **noususta**, ei laskusta, ja se on ainoa kohta pelissä
   * jossa näin tehdään.
   *
   * Syy on selaimen käyttäjäeleen laskenta: `navigator.share` vaatii tuoreen
   * käyttäjäeleen, ja kosketuksessa ele kirjataan `pointerup`ista — `pointerdown`
   * ei riitä. Peli lukee syötteen omassa 60 Hz askeleessaan, joten ainoa tapa
   * osua eleen sisään on ajaa kutsu sillä framella joka seuraa sormen nostoa.
   * Painalluksesta laukaistuna jako hylättäisiin puhelimessa juuri siinä
   * tapauksessa jota varten koko ruutu on olemassa.
   *
   * `armed` varmistaa ettei edellisestä ruudusta roikkumaan jäänyt nosto laukaise
   * mitään: jako vaatii että painallus on nähty *tässä* kohtauksessa.
   */
  update(input) {
    this.tick++;
    // Sama vartiointi kuin muillakin korteilla: edellisen ruudun viimeinen
    // frame ei saa painaa mitään täällä.
    if (this.tick < 6) return;

    if (input.pressed.jump) this.armed = true;

    // Kaksi eri poistumistietä, ja molemmat ovat olemassa myös kosketuksessa
    // (X-nappi ja työkalurivin ENTER). Ruutu josta lapsi ei pääse pois olisi
    // pahempi kuin ruutu jota ei ole.
    if (input.pressed.start || input.pressed.run) {
      input.consume('start');
      input.consume('run');
      this.leave();
      return;
    }

    if (this.armed && input.released && input.released.jump) {
      this.armed = false;
      this.act();
    }
  }

  leave() {
    Sfx.play('select');
    if (this.back) this.game.setScene(this.back);
    else this.game.toTitle();
  }

  /** Porras 1 tai 2 sen mukaan mitä selaimessa on. Porras 3 on jo ruudulla. */
  act() {
    if (this.busy) return;
    if (this.how === 'share') {
      this.busy = true;
      this.status = 'busy';
      let promise;
      try {
        promise = navigator.share({ title: SHARE_TITLE, text: this.text, url: this.url });
      } catch (err) {
        // Vanhat toteutukset heittävät synkronisesti eivätkä hylkää lupausta.
        this.busy = false;
        this.fallback(err);
        return;
      }
      Promise.resolve(promise).then(() => {
        this.busy = false;
        this.status = 'shared';
        Sfx.play('powerup');
      }, (err) => {
        this.busy = false;
        /* Peruutus ei ole virhe. Käyttäjä avasi valikon, katsoi sitä ja sulki
         * sen — se on ruudun normaali käyttötapa, ei vika jota pitäisi paikata
         * leikepöydällä tai punaisella tekstillä. */
        if (err && err.name === 'AbortError') {
          this.status = 'cancelled';
          Sfx.play('cursor');
          return;
        }
        this.fallback(err);
      });
      return;
    }
    if (this.how === 'clipboard') {
      this.copy();
      return;
    }
    // Porras 3: ei ole mitään mitä painaa. Sanotaan se ääneen.
    this.status = 'manual';
    Sfx.play('bump');
  }

  /** Jako kaatui oikeasti (esim. NotAllowedError): kokeillaan leikepöytää. */
  fallback(err) {
    this.error = (err && err.name) || 'VIRHE';
    const clip = typeof navigator !== 'undefined' && navigator.clipboard;
    if (clip && typeof clip.writeText === 'function') {
      this.copy();
      return;
    }
    this.status = 'manual';
    Sfx.play('bump');
  }

  copy() {
    this.busy = true;
    this.status = 'busy';
    // Leikepöydälle menee molemmat: pelkkä osoite ilman riviä on tylsä liite,
    // ja pelkkä rivi ilman osoitetta on hyödytön.
    const payload = `${this.text}\n${this.url}`;
    let promise;
    try {
      promise = navigator.clipboard.writeText(payload);
    } catch (err) {
      this.busy = false;
      this.error = (err && err.name) || 'VIRHE';
      this.status = 'manual';
      Sfx.play('bump');
      return;
    }
    Promise.resolve(promise).then(() => {
      this.busy = false;
      this.status = 'copied';
      Sfx.play('powerup');
    }, (err) => {
      /* Leikepöytä vaatii suojatun yhteyden ja joissakin selaimissa oman
       * luvan. Kun se kieltäytyy, jäljellä on se porras joka ei voi kaatua. */
      this.busy = false;
      this.error = (err && err.name) || 'VIRHE';
      this.status = 'manual';
      Sfx.play('bump');
    });
  }

  draw(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, '#101830');
    grad.addColorStop(1, '#20304c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 240);

    drawText(ctx, 'KERRO KAVERILLE', W / 2, 12, {
      color: '#ffd048', align: 'center', shadow: '#303048', scale: 2,
    });
    ctx.fillStyle = '#8fe04a';
    ctx.fillRect(28, 36, 264, 1);

    drawText(ctx, 'TÄMÄ LÄHTEE MUKAAN:', W / 2, 46, { color: '#8890b0', align: 'center' });
    this.lines.slice(0, 3).forEach((line, i) => {
      drawText(ctx, line, W / 2, 60 + i * 11, { color: '#ffffff', align: 'center' });
    });

    // Osoite omassa laatikossaan. Tämä on se porras joka toimii aina, myös
    // silloin kun selaimessa ei ole jakoa eikä leikepöytää — siksi se on isoin
    // ja kirkkain asia ruudulla eikä alaviite.
    const boxY = 104;
    ctx.fillStyle = '#0c1224';
    ctx.fillRect(24, boxY, 272, 22);
    ctx.fillStyle = '#2c3c68';
    ctx.fillRect(24, boxY, 272, 1);
    ctx.fillRect(24, boxY + 21, 272, 1);
    drawText(ctx, this.shown, W / 2, boxY + 8, { color: '#8fe04a', align: 'center' });

    /* Se mitä laatikko *ei* kerro. Jaettuna ja kopioituna linkki kantaa
     * tuloksen; ylös kirjoitettuna ei. Ero on pieni mutta se on olemassa, ja
     * arvattavaksi jätettynä se olisi juuri sellainen hiljainen pettymys jota
     * kukaan ei osaa raportoida. */
    if (this.carries) {
      drawText(ctx, 'KÄSIN KIRJOITETTUNA TULOS EI KULJE MUKANA', W / 2, 130, {
        color: '#70708c', align: 'center',
      });
    }

    const state = STATUS[this.status];
    if (state) {
      wrapText(state.text, 46).slice(0, 2).forEach((line, i) => {
        drawText(ctx, line, W / 2, 142 + i * 11, { color: state.color, align: 'center' });
      });
    }

    const how = HOW[this.how] || HOW.none;
    if (how.label) {
      drawText(ctx, how.label, W / 2, 176, { color: '#ffffff', align: 'center', shadow: '#101018' });
    }
    wrapText(how.note, 46).slice(0, 2).forEach((line, i) => {
      drawText(ctx, line, W / 2, 190 + i * 11, { color: '#70708c', align: 'center' });
    });

    drawText(ctx, 'ENTER TAI X TAKAISIN', W / 2, 216, { color: '#8890b0', align: 'center' });
    // Testaajalle: mitä versiota hän juuri pelasi. Kysytään joka kerta.
    drawText(ctx, `VERSIO ${GAME_VERSION}`, W - 6, 230, { color: '#40506a', align: 'right' });
  }
}
