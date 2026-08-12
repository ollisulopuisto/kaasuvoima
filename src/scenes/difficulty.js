/**
 * VAIKEUSTASON VALINTA, ja se on oma ruutunsa eikä alkuruudun kuudes rivi.
 *
 * Alkuruudun valikko on täynnä. `scenes/title.js` sanoo sen mitatusti: viisi
 * riviä on todellinen maksimi, ja `tools/verify.mjs` piirtää alkuruudun 280
 * pikselin korkealle alustalle ja katsoo alimman piirtyvän rivin juuri siksi.
 * Kuudes rivi olisi maksettu ohjerivillä, joka on ainoa paikka jossa hyppy- ja
 * juoksunäppäin lukevat.
 *
 * Mutta perustelu ei ole tilanpuute vaan se mikä valinta on. **Vaikeustaso on
 * osa kierrosta eikä valikkorivi**: se valitaan kun kierros alkaa, se kulkee
 * tallennuksen mukana, ja JATKA PELIÄ jatkaa sitä kierrosta jota oltiin
 * pelaamassa — kysymättä uudestaan. Siksi tämä ruutu on tasan yhden napin
 * takana, sen napin jolla uusi peli alkaa, eikä missään muualla.
 *
 * Kolme riviä, kuvaus valitun alla, ja peruutus takaisin alkuruutuun. Sama
 * kolme ohjaustapaa kuin taukovalikossa: nuolet valitsevat, hyppy vahvistaa.
 */
import { drawText } from '../gfx/font.js';
import { Music, Sfx } from '../core/audio.js';
import { MODES } from '../data/scale.js';

const W = 320;

export const DIFFICULTY_TITLE = 'VAIKEUSTASO';

export class DifficultyScene {
  /**
   * @param {object} game
   * @param {(mode: string) => void} onPick what to do with the answer. The
   *   scene does not start the game itself: the caller knows whether this is a
   *   new game or a time attack, and this one only knows which of three.
   */
  constructor(game, onPick) {
    this.game = game;
    this.onPick = onPick;
    this.tick = 0;
    /* Se taso jolla viimeksi pelattiin on kursorin paikka, ei aina ensimmäinen.
     * Pelaaja joka on valinnut VAIKEAn kerran on valitsemassa sitä uudestaan. */
    const at = MODES.findIndex((m) => m.id === (game.state && game.state.mode));
    this.cursor = at < 0 ? 0 : at;
  }

  enter() {
    Music.play('title');
  }

  update(input) {
    this.tick++;
    // Sama vartiointi kuin korteilla: edellisen ruudun viimeinen frame ei saa
    // painaa mitään täällä.
    if (this.tick < 6) return;

    if (input.pressed.up || input.pressed.left) {
      this.cursor = (this.cursor + MODES.length - 1) % MODES.length;
      Sfx.play('cursor');
    }
    if (input.pressed.down || input.pressed.right) {
      this.cursor = (this.cursor + 1) % MODES.length;
      Sfx.play('cursor');
    }
    if (input.pressed.start) {
      input.consume('start');
      Sfx.play('cursor');
      this.game.toTitle();
      return;
    }
    if (input.pressed.jump) {
      input.consume('jump');
      Sfx.play('select');
      this.onPick(MODES[this.cursor].id);
    }
  }

  draw(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, '#101830');
    grad.addColorStop(1, '#2c5c2c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 240);

    ctx.fillStyle = '#0e0e18';
    ctx.fillRect(30, 40, 260, 22);
    drawText(ctx, DIFFICULTY_TITLE, W / 2, 46, {
      color: '#ffd048', align: 'center', shadow: '#101018', scale: 2,
    });

    MODES.forEach((mode, i) => {
      const on = i === this.cursor;
      const y = 92 + i * 22;
      drawText(ctx, mode.title, W / 2, y, {
        color: on ? '#ffd048' : '#c0c0d0', align: 'center', shadow: '#101018', scale: on ? 2 : 1,
      });
    });

    /* Kuvaus vain valitusta. Kolme kuvausta yhtä aikaa olisi kolme riviä
     * luettavaa siinä missä kysymys on yksi, ja rivi vaihtuu kursorin mukana
     * eli se on vastaus siihen mitä juuri nyt katsotaan. */
    ctx.fillStyle = 'rgba(8,8,16,0.65)';
    ctx.fillRect(0, 172, W, 14);
    drawText(ctx, MODES[this.cursor].blurb, W / 2, 175, {
      color: '#8fe04a', align: 'center', shadow: '#101018',
    });

    drawText(ctx, 'HYPPY VALITSEE   ENTER PERUU', W / 2, 210, {
      color: '#8890b0', align: 'center',
    });
  }
}
