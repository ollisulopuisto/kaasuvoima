import { drawText } from '../gfx/font.js';
import { drawPlayer, drawItem, drawBoss, WALK_FRAMES } from '../gfx/sprites.js';
import { Music, Sfx } from '../core/audio.js';
import { hashNoise } from '../core/utils.js';
import { normalizePower, POWER_NAMES } from '../entities/player.js';

/** The "MAAILMA 1-1 / KV x 4" card shown before every level. */
export class InterludeScene {
  /**
   * @param {string} [label] mitä kortissa lukee, kun "MAAILMA <tunnus>" ei ole
   *   totta. Päivän pierun kenttä ei ole missään maailmassa eikä sen tunnus ole
   *   kenttänumero, joten se kertoo nimensä itse.
   */
  constructor(game, levelId, next, label = null) {
    this.game = game;
    this.levelId = levelId;
    this.next = next;
    this.label = label;
    this.tick = 0;
  }

  enter() {
    Music.stop();
    // The one moment in the game with no other sound competing, which is the
    // only place a synthesised voice has a chance of being heard as one.
    Sfx.play('letsgo');
  }

  update(input) {
    this.tick++;
    if (this.tick > 110 || input.pressed.jump || input.pressed.start) {
      input.consume('jump');
      input.consume('start');
      this.next();
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, 0, 320, 240);
    drawText(ctx, this.label || `MAAILMA ${this.levelId}`, 160, 84, {
      color: '#ffffff', align: 'center', shadow: '#303048',
    });
    const power = normalizePower(this.game.state.power);
    drawPlayer(ctx, 122, 134 - (power.level === 0 ? 16 : 26), {
      type: power.type,
      level: Math.min(1, power.level),
      facing: 1,
      frame: 0,
      state: 'idle',
      ducking: false,
      running: false,
      tick: this.tick,
      wag: this.tick / 20,
    });
    drawText(ctx, `*  ${this.game.state.lives}`, 158, 122, { color: '#ffffff' });
    if (this.game.state.reserve) drawItem(ctx, this.game.state.reserve, 186, 112, this.tick);
    if (power.level > 0) {
      drawText(ctx, `${POWER_NAMES[power.type]} ${power.level}/5`, 160, 150,
        { color: '#8fe04a', align: 'center' });
    }
  }
}

/**
 * Game over, with an actual choice.
 *
 * It used to say "Z jatkaaksesi" and then end the run regardless — the word
 * said continue and the button did not. Now there are two options and the
 * selected one is unmistakable: an arrow, a colour, and a line saying what it
 * will do. A menu whose selection you have to squint at is a menu that gets
 * pressed by accident, and this one decides whether a run survives.
 */
export class GameOverScene {
  constructor(game) {
    this.game = game;
    this.tick = 0;
    this.choice = 0;
  }

  enter() {
    Music.stop();
    Sfx.play('die');
  }

  update(input) {
    this.tick++;
    if (this.tick < 30) return;      // no accidental press on the way in

    if (input.pressed.left || input.pressed.up) {
      this.choice = 0;
      Sfx.play('cursor');
    }
    if (input.pressed.right || input.pressed.down) {
      this.choice = 1;
      Sfx.play('cursor');
    }
    if (input.pressed.jump || input.pressed.start) {
      input.consume('jump');
      input.consume('start');
      Sfx.play('select');
      if (this.choice === 0) {
        // The run goes on, so nothing is banked: the board is for finished runs.
        // Nothing is taken away either — no points, no cap on how often. The
        // continue is counted instead, and the count rides to the board with
        // the score, which is why the option below says so before it is picked.
        this.game.state.continues = (this.game.state.continues || 0) + 1;
        this.game.persist();
        this.game.toWorldMap();
      } else {
        this.game.finishRun();
      }
    }
  }

  drawOption(ctx, index, label, hint, y) {
    const on = this.choice === index;
    const blink = on && Math.floor(this.tick / 8) % 2 === 0;
    if (on) {
      ctx.fillStyle = '#24243c';
      ctx.fillRect(40, y - 5, 240, 26);
      ctx.fillStyle = blink ? '#ffd048' : '#8fe04a';
      ctx.fillRect(40, y - 5, 240, 1);
      ctx.fillRect(40, y + 20, 240, 1);
    }
    drawText(ctx, on ? '>' : ' ', 52, y, { color: '#ffd048' });
    drawText(ctx, label, 68, y, {
      color: on ? '#ffffff' : '#70708c', shadow: on ? '#101018' : null,
    });
    drawText(ctx, hint, 68, y + 11, { color: on ? '#8fe04a' : '#50506a' });
  }

  draw(ctx) {
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, 0, 320, 240);
    drawText(ctx, 'PELI POIKKI', 160, 40, {
      color: '#ffffff', align: 'center', shadow: '#303048', scale: 2,
    });
    drawText(ctx, 'KAASU LOPPUI', 160, 66, { color: '#8fe04a', align: 'center' });

    const used = this.game.state.continues || 0;
    if (used) {
      drawText(ctx, `JATKOJA KAYTETTY ${used}`, 160, 84, { color: '#c88040', align: 'center' });
    }

    this.drawOption(ctx, 0, 'JATKA', 'PISTEET SAILYVAT, JATKOT LASKETAAN', 110);
    this.drawOption(ctx, 1, 'ALOITA ALUSTA', 'PISTEET PISTETAULUUN', 150);

    drawText(ctx, 'NUOLET VALITSE   ENTER HYVAKSY', 160, 200, {
      color: '#8890b0', align: 'center',
    });
  }
}

export class EndingScene {
  constructor(game) {
    this.game = game;
    this.tick = 0;
  }

  enter() {
    Music.play('map');
    Sfx.play('clear');
  }

  update(input) {
    this.tick++;
    if (this.tick > 60 && (input.pressed.jump || input.pressed.start)) {
      input.consume('jump');
      input.consume('start');
      this.game.finishRun();
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#101830';
    ctx.fillRect(0, 0, 320, 240);
    drawText(ctx, 'ONNEKSI OLKOON!', 160, 50, { color: '#ffd048', align: 'center', shadow: '#303048' });
    drawText(ctx, 'PIERUKUNINGAS ON KUKISTETTU', 160, 68, { color: '#ffffff', align: 'center' });
    drawText(ctx, 'JA KAASUT VAPAUTETTU', 160, 80, { color: '#ffffff', align: 'center' });

    drawBoss(ctx, 150, 116, this.tick, -1, true, 3, 1.6);
    drawPlayer(ctx, 90, 128, {
      type: 'leaf',
      level: 1,
      facing: 1,
      frame: Math.floor(this.tick / 8) % WALK_FRAMES,
      state: 'walk',
      ducking: false,
      running: false,
      tick: this.tick,
      wag: this.tick / 6,
    });
    drawText(ctx, `PISTEET ${this.game.state.score}`, 160, 180, { color: '#8fe04a', align: 'center' });
    drawText(ctx, 'Z PALAA ALKUUN', 160, 210, { color: '#8890b0', align: 'center' });
  }
}

/**
 * The reward for beating a fortress.
 *
 * Before this, clearing a castle put the player on the right-hand edge of the
 * arena and left them standing there while the world map loaded. The fight was
 * the hardest thing in the world and the game said nothing about it. So: he
 * walks off, and we cut to him sitting down to a bowl of pea soup, which is the
 * one food this game has an opinion about.
 *
 * It is a card, not a cutscene: a few seconds, skippable, and it never blocks
 * progress. A celebration you have to sit through twice stops being one.
 */
export class VictoryScene {
  constructor(game, world, next) {
    this.game = game;
    this.world = world;
    this.next = next;
    this.tick = 0;
    this.power = game.state.power;
  }

  enter() {
    Sfx.play('clear');
    Music.play('title');
  }

  update(input) {
    this.tick++;
    // Held from the previous scene's last frame would skip it instantly.
    if (this.tick > 20 && (input.pressed.jump || input.pressed.start)) {
      input.consume('jump');
      input.consume('start');
      this.finish();
      return;
    }
    if (this.tick > 460) this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.next();
  }

  /** Steam that rises, spreads and fades — the only thing on screen that moves slowly. */
  drawSteam(ctx, x, y) {
    for (let i = 0; i < 5; i++) {
      const age = (this.tick * 1.6 + i * 26) % 130;
      const t = age / 130;
      const px = x + Math.round(Math.sin(age / 11 + i) * (2 + t * 6));
      const py = y - Math.round(age * 0.34);
      const size = 3 - Math.floor(t * 2);
      if (size <= 0) continue;
      ctx.fillStyle = `rgba(232,240,255,${0.5 * (1 - t)})`;
      ctx.fillRect(px, py, size, size);
    }
  }

  draw(ctx) {
    const t = this.tick;
    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, '#1a1030');
    grad.addColorStop(1, '#40243c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 320, 240);

    /* Confetti. Two independent seeds per piece — one seed driving both axes
     * lays them out along a tidy diagonal, which is the documented mistake in
     * DESIGN.md §6 and which this scene reproduced first time out. */
    for (let i = 0; i < 34; i++) {
      const sx = hashNoise(i * 3 + 1, 7);
      const sy = hashNoise(i * 5 + 2, 19);
      const x = Math.round(sx * 320);
      const y = Math.round(((t * (0.6 + sy) + sy * 260) % 260) - 10);
      const sway = Math.round(Math.sin(t / 14 + i) * 3);
      ctx.fillStyle = ['#ffd048', '#8fe04a', '#ff8080', '#8fd0ff'][i % 4];
      ctx.fillRect(x + sway, y, 2, 3);
    }

    // Hero first, table second: the table hides his legs, and a man whose legs
    // you cannot see behind a table is sitting at it rather than standing on it.
    const tableY = 168;
    drawPlayer(ctx, 128, tableY - 30, {
      type: this.power.type,
      level: Math.min(2, this.power.level),
      facing: 1,
      frame: 0,
      state: 'idle',
      tick: t,
      wag: t / 20,
      idle: 0,
    });

    ctx.fillStyle = '#5a3a1c';
    ctx.fillRect(96, tableY, 128, 6);
    ctx.fillStyle = '#3c2410';
    ctx.fillRect(104, tableY + 6, 8, 26);
    ctx.fillRect(208, tableY + 6, 8, 26);

    // the bowl, and the spoon going in and out of it
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(168, tableY - 8, 22, 8);
    ctx.fillStyle = '#c8bca8';
    ctx.fillRect(168, tableY - 2, 22, 2);
    ctx.fillStyle = '#6f8c34';                      // pea soup, obviously
    ctx.fillRect(170, tableY - 7, 18, 3);
    const dip = Math.round(Math.sin(t / 16) * 5);
    ctx.fillStyle = '#c8c8d8';
    ctx.fillRect(176, tableY - 16 - dip, 2, 9);
    ctx.fillRect(174, tableY - 18 - dip, 6, 3);
    this.drawSteam(ctx, 178, tableY - 12);

    const punch = t < 10 ? 3 : 2;
    drawText(ctx, `MAAILMA ${this.world} SELVÄ!`, 160, 40, {
      color: ['#ffd048', '#ffffff', '#8fe04a'][Math.floor(t / 7) % 3],
      align: 'center', shadow: '#101018', scale: punch,
    });
    drawText(ctx, 'HERNEKEITTOA SANKARILLE', 160, 74, {
      color: '#e8e0c0', align: 'center',
    });
    drawItem(ctx, 'soup', 148, 96, t);

    if (t > 90 && Math.floor(t / 20) % 2) {
      drawText(ctx, 'Z JATKA', 160, 214, { color: '#8890b0', align: 'center' });
    }
  }
}
