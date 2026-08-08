import { drawText } from '../gfx/font.js';
import { drawPlayer, drawItem, drawBoss } from '../gfx/sprites.js';
import { Music, Sfx } from '../core/audio.js';
import { normalizePower, POWER_NAMES } from '../entities/player.js';

/** The "MAAILMA 1-1 / SFB x 4" card shown before every level. */
export class InterludeScene {
  constructor(game, levelId, next) {
    this.game = game;
    this.levelId = levelId;
    this.next = next;
    this.tick = 0;
  }

  enter() {
    Music.stop();
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
    drawText(ctx, `MAAILMA ${this.levelId}`, 160, 84, {
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

export class GameOverScene {
  constructor(game) {
    this.game = game;
    this.tick = 0;
  }

  enter() {
    Music.stop();
    Sfx.play('die');
  }

  update(input) {
    this.tick++;
    if (this.tick > 200 || input.pressed.jump || input.pressed.start) {
      input.consume('jump');
      input.consume('start');
      this.game.finishRun();
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, 0, 320, 240);
    drawText(ctx, 'PELI POIKKI', 160, 100, { color: '#ffffff', align: 'center', shadow: '#303048' });
    drawText(ctx, 'KAASU LOPPUI', 160, 120, { color: '#8fe04a', align: 'center' });
    drawText(ctx, 'Z JATKAAKSESI', 160, 150, { color: '#8890b0', align: 'center' });
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
      frame: Math.floor(this.tick / 8) % 3,
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
