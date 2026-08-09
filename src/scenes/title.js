import { drawText, textWidth } from '../gfx/font.js';
import { drawPlayer, drawWalker, drawGasPuff } from '../gfx/sprites.js';
import { Music, Sfx } from '../core/audio.js';
import { Save } from '../core/save.js';
import { challengeLine } from '../core/challenge.js';

/*
 * Silence this long and the cabinet starts playing by itself. Twenty seconds is
 * a couple of passes over the menu at reading speed: long enough that nobody
 * still making up their mind gets interrupted, short enough that a machine left
 * alone in the room is showing the game rather than a still picture.
 */
const DEMO_AFTER = 20 * 60;

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.tick = 0;
    this.cursor = 0;
    this.options = [];
    this.puffs = [];
    this.idle = 0;
  }

  enter() {
    Music.play('title');
    this.options = Save.exists()
      ? ['JATKA PELIÄ', 'UUSI PELI', 'PARHAAT PIERUT']
      : ['UUSI PELI', 'PARHAAT PIERUT'];
    this.cursor = 0;
    this.idle = 0;
  }

  update(input) {
    this.tick++;

    // A held key is somebody deciding as much as a fresh press is, so both
    // count: only real silence runs the clock down.
    const busy = input.anyKeyPressed || Object.values(input.held).some(Boolean);
    this.idle = busy ? 0 : this.idle + 1;
    if (this.idle >= DEMO_AFTER) {
      this.game.startDemo();
      return;
    }

    if (this.tick % 9 === 0) {
      this.puffs.push({ x: 20 + Math.random() * 280, y: 250, r: 3 + Math.random() * 5, v: 0.4 + Math.random() * 0.6 });
    }
    this.puffs = this.puffs.filter((p) => {
      p.y -= p.v;
      p.x += Math.sin((this.tick + p.r * 10) / 30) * 0.3;
      return p.y > -12;
    });

    if (input.pressed.up || input.pressed.left) {
      this.cursor = (this.cursor + this.options.length - 1) % this.options.length;
      Sfx.play('cursor');
    }
    if (input.pressed.down || input.pressed.right) {
      this.cursor = (this.cursor + 1) % this.options.length;
      Sfx.play('cursor');
    }
    if (input.pressed.jump || input.pressed.start) {
      input.consume('jump');
      input.consume('start');
      Sfx.play('select');
      const choice = this.options[this.cursor];
      if (choice === 'JATKA PELIÄ') this.game.continueGame();
      else if (choice === 'PARHAAT PIERUT') this.game.toHighScores();
      else this.game.newGame();
    }
  }

  draw(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, '#101830');
    grad.addColorStop(1, '#2c5c2c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 320, 240);

    for (const p of this.puffs) drawGasPuff(ctx, p.x, p.y, 0.8, p.r);

    /* Haaste ensin, koska haastelinkistä tullut pelaaja tuli lukemaan juuri
     * tämän. Se piirretään taivaskaistaan rivien 11 ja 23 väliin: siihen
     * mahtuu yksi rivi pelin omaa fonttia, ja se on ainoa vaakasuora kaista
     * jossa ei ole jo logolaatikkoa (rivi 26), hahmoja tai valikkoa.
     *
     * Yksi rivi eikä kaksi, koska rivin leveys pitää pystyä **takaamaan**:
     * nimi on suodatettu ja katkaistu kuuteen piirtyvään merkkiin, pisteet
     * ovat enintään seitsemän numeroa ja kenttätunnus neljä, eli pisin
     * mahdollinen rivi on 46 merkkiä = 275 px. Ilman katkaisua tähän riittäisi
     * yksi pitkä nimi kaatamaan koko ruudun luettavuuden. */
    const ch = this.game && this.game.challenge;
    if (ch) {
      const line = challengeLine(ch);
      ctx.fillStyle = 'rgba(8,8,16,0.72)';
      ctx.fillRect(0, 11, 320, 12);
      drawText(ctx, line, 160, 13, {
        color: ch.beaten ? '#8fe04a' : '#ffd048', align: 'center', shadow: '#101018',
      });
    }

    ctx.fillStyle = '#0e0e18';
    ctx.fillRect(20, 26, 280, 86);
    ctx.fillStyle = '#8fe04a';
    ctx.fillRect(20, 26, 280, 2);
    ctx.fillRect(20, 110, 280, 2);

    drawText(ctx, 'SUPER', 160, 34, { color: '#ffffff', align: 'center', shadow: '#2c5c2c', scale: 2 });
    drawText(ctx, 'FART BROS', 160, 54, { color: '#8fe04a', align: 'center', shadow: '#204020', scale: 3 });
    ctx.fillStyle = '#ffd048';
    ctx.fillRect(140, 80, 40, 26);
    ctx.fillStyle = '#101018';
    ctx.fillRect(143, 83, 34, 20);
    drawText(ctx, '3', 160, 85, { color: '#ffd048', align: 'center', scale: 2 });

    // strolling cast
    const walkX = ((this.tick * 0.6 + 120) % 400) - 40;
    drawWalker(ctx, walkX + 40, 156, Math.floor(this.tick / 8), 1, false);
    drawPlayer(ctx, walkX, 146, {
      type: 'leaf',
      level: 1,
      facing: 1,
      frame: Math.floor(this.tick / 6) % 3,
      state: 'walk',
      ducking: false,
      running: false,
      tick: this.tick,
      wag: this.tick / 8,
    });
    ctx.fillStyle = '#3ea23a';
    ctx.fillRect(0, 172, 320, 6);
    ctx.fillStyle = '#8c4c18';
    ctx.fillRect(0, 178, 320, 62);

    // The menu grows with the number of options, so its box is measured rather
    // than hard-coded — that is how it ended up under the control hints before.
    const panelH = this.options.length * 13 + 6;
    const panelY = 184;
    ctx.fillStyle = 'rgba(8,8,16,0.65)';
    ctx.fillRect(72, panelY, 176, panelH);
    this.options.forEach((option, i) => {
      const selected = i === this.cursor;
      const y = panelY + 4 + i * 13;
      drawText(ctx, option, 160, y, {
        color: selected ? '#ffd048' : '#c0c0d0',
        align: 'center',
        shadow: '#101018',
      });
      if (selected && Math.floor(this.tick / 8) % 2) {
        drawText(ctx, '*', 160 - textWidth(option) / 2 - 12, y, { color: '#ffd048' });
      }
    });

    drawText(ctx, 'NUOLET/WASD  HYPPY Z/L/VÄLI  JUOKSU X/K', 160, panelY + panelH + 2, {
      color: '#8890b0', align: 'center',
    });
    /* Ominaisuus jota kukaan ei löydä ei ole olemassa, ja jaon koko tarkoitus on
     * että linkki lähtee eteenpäin. Vihje piirretään täällä eikä `Game.render`
     * issä, koska se kuuluu tähän ruutuun: kohtaus piirtää oman opasteensa, ja
     * silmukka joka tuntee kaksi kohtausta nimeltä on se tapa jolla piirtokoodi
     * valuu väärään paikkaan. */
    drawText(ctx, 'X KERRO KAVERILLE', 316, 2, { color: '#6a7a9a', align: 'right' });
  }
}
