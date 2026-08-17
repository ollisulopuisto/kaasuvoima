/**
 * Päivän pierun oma ruutu: ennen yritystä, ja sen jälkeen.
 *
 * Sama ruutu molemmissa, koska ne ovat sama asia eri hetkellä — päivän tila.
 * Ruutu ei koskaan jää jumiin: ENTER vie takaisin alkuruutuun mitä tahansa
 * ruudulla lukeekin.
 *
 * Se mitä tämä ruutu **ei** näytä on yhtä tärkeää: kentästä ei kerrota mitään
 * ennen kuin se on pelattu. Ei teemaa, ei leveyttä, ei kuvaa. Kaikki pelaavat
 * saman kentän, joten jokainen etukäteistieto olisi juonipaljastus sille joka
 * lukee sen jonkun toisen olan yli.
 */
import { drawText } from '../gfx/font.js';
import { Music, Sfx } from '../core/audio.js';
import {
  dayNumber, dayLabel, dailyLevel, dailyStatus, dailyRecord, dailyForfeit, dailyShareLine,
  DAILY_TITLE,
} from '../core/daily.js';
import { DAILY_ORIGIN } from '../data/daily-origin.js';

const W = 320;

export class DailyScene {
  /** `result` on juuri päättyneen yrityksen merkintä, tai null kun tullaan valikosta. */
  constructor(game, result = null) {
    this.game = game;
    this.tick = 0;
    this.day = dayNumber();
    /* Kesken jäänyt merkintä tarkoittaa että sivu ladattiin kentän aikana. Se
     * on luovutus siihen kohtaan johon pääsit, ei uusi yritys — ks.
     * `src/core/daily.js` kohta 2. Kirjataan lopulliseksi heti kun se nähdään,
     * jotta tulos on sama riippumatta siitä montako kertaa tänne tullaan. */
    if (!result && dailyStatus(this.day) === 'kesken') dailyForfeit(this.day);
    this.record = result || dailyRecord(this.day);
    this.level = dailyLevel(this.day);
    this.done = !!this.record;
  }

  enter() {
    Music.play('title');
  }

  /** Jakoruudun koukku: tämä ruutu kertoo oman rivinsä. Ks. `scenes/share.js`. */
  shareLine() {
    return dailyShareLine(this.record);
  }

  update(input) {
    this.tick++;
    // Sama vartiointi kuin muillakin korteilla: edellisen ruudun viimeinen
    // frame ei saa painaa mitään täällä.
    if (this.tick < 6) return;

    if (input.pressed.start) {
      input.consume('start');
      Sfx.play('select');
      this.game.toTitle();
      return;
    }
    if (input.pressed.jump) {
      input.consume('jump');
      if (this.done || !this.level.ok) {
        Sfx.play('bump');
        return;
      }
      Sfx.play('select');
      this.game.startDaily(this.level);
    }
  }

  draw(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, '#101830');
    grad.addColorStop(1, '#3c2c1c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 240);

    drawText(ctx, DAILY_TITLE, W / 2, 16, {
      color: '#ffd048', align: 'center', shadow: '#303048', scale: 2,
    });
    ctx.fillStyle = '#8fe04a';
    ctx.fillRect(28, 40, 264, 1);
    drawText(ctx, dayLabel(this.day), W / 2, 48, { color: '#ffffff', align: 'center' });
    drawText(ctx, 'YKSI KENTTÄ, YKSI YRITYS, SAMA KAIKILLE', W / 2, 62, {
      color: '#8890b0', align: 'center',
    });

    if (!this.level.ok) {
      /* Ikkuna loppui. Sanotaan se sellaisena kuin se on — kenttä olisi
       * tarkistamaton — eikä tarjota sitä silti. Ks. `src/core/daily.js`. */
      drawText(ctx, 'TÄLLE PÄIVÄLLE EI OLE TARKISTETTUA KENTTÄÄ', W / 2, 92, {
        color: '#ff8040', align: 'center',
      });
      drawText(ctx, `TARKISTETTU ${dayLabel(DAILY_ORIGIN.from)} - ${dayLabel(DAILY_ORIGIN.to)}`,
        W / 2, 106, { color: '#8890b0', align: 'center' });
      drawText(ctx, 'AJA TOOLS/DAILY-ORIGIN.MJS', W / 2, 120, {
        color: '#70708c', align: 'center',
      });
    } else if (this.done) {
      drawText(ctx, 'YRITYS ON KÄYTETTY', W / 2, 92, { color: '#ff8040', align: 'center' });
      const r = this.record;
      drawText(ctx, r.cleared ? 'MAALIIN ASTI' : `${r.reach} PROSENTTIA`, W / 2, 110, {
        color: r.cleared ? '#8fe04a' : '#ffffff', align: 'center', scale: 2,
      });
      drawText(ctx, `${r.score} PISTETTÄ`, W / 2, 132, { color: '#ffd048', align: 'center' });
      if (r.keskeytyi) {
        drawText(ctx, 'KESKEYTYI', W / 2, 146, { color: '#70708c', align: 'center' });
      }
      drawText(ctx, 'X KERRO KAVERILLE', W / 2, 170, { color: '#c0c0d0', align: 'center' });
    } else {
      drawText(ctx, 'Z ALOITA', W / 2, 104, {
        color: Math.floor(this.tick / 16) % 2 ? '#ffd048' : '#ffffff',
        align: 'center',
        scale: 2,
      });
      drawText(ctx, 'YKSI YRITYS. LATAUS EI ANNA UUTTA.', W / 2, 130, {
        color: '#8890b0', align: 'center',
      });
    }

    drawText(ctx, 'PÄIVÄ VAIHTUU KESKIYÖLLÄ UTC', W / 2, 200, {
      color: '#70708c', align: 'center',
    });
    /* Alkuperämerkintä on ruudulla eikä pelkästään datassa, koska se on väite
     * pelaajalle: tämä kenttä on verrattu korpukseen (DESIGN.md kohta 3). */
    if (this.level.ok) {
      drawText(ctx, 'TARKISTETTU KORPUSTA VASTEN', W / 2, 212, {
        color: '#4a6a4a', align: 'center',
      });
    }
    drawText(ctx, 'ESC TAKAISIN', W / 2, 228, { color: '#8890b0', align: 'center' });
  }
}
