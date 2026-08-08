import { Entity } from './entity.js';
import { drawGasPuff, drawBrickShard } from '../gfx/sprites.js';
import { drawCoinSprite, THEMES } from '../gfx/tiles.js';
import { drawText } from '../gfx/font.js';

export class Puff extends Entity {
  constructor(level, x, y, { spread = 0, size = 4, life = 24, brown = false } = {}) {
    super(level, x - size, y - size, size * 2, size * 2);
    this.kind = 'effect';
    this.alwaysActive = true;
    this.active = true;
    this.maxLife = life;
    this.life = life;
    this.size = size;
    this.brown = brown;
    this.vx = (Math.random() - 0.5) * spread;
    this.vy = -0.3 - Math.random() * 0.4;
  }

  update() {
    this.tick++;
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    if (this.life <= 0) this.remove = true;
  }

  draw(ctx) {
    const t = this.life / this.maxLife;
    drawGasPuff(ctx, this.cx, this.cy, t, this.size * (1.6 - t * 0.6), this.brown);
  }
}

/**
 * The score numbers used to slide up quietly and vanish. Rewards should feel
 * like rewards, so now they punch: a big white pop on the first few frames,
 * settling to normal size, with a burst of sparks for anything worth having.
 * The bigger the number, the bigger the noise it makes.
 */
export class ScorePop extends Entity {
  constructor(level, x, y, text) {
    super(level, x, y, 1, 1);
    this.kind = 'effect';
    this.alwaysActive = true;
    this.active = true;
    this.text = String(text);
    this.maxLife = 52;
    this.life = this.maxLife;
    const value = Number(text);
    // 1UP and four-figure scores are events; 200 for a coin is not.
    this.big = Number.isNaN(value) || value >= 1000;
  }

  get age() { return this.maxLife - this.life; }

  update() {
    this.tick++;
    // Shoots up, then eases as it fades — a flat drift reads as a UI element,
    // an eased one reads as something that happened.
    this.y -= 1.6 * (this.life / this.maxLife) ** 1.5 + 0.15;
    this.life--;
    if (this.life <= 0) this.remove = true;
  }

  draw(ctx) {
    const { age } = this;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const fade = this.life / this.maxLife;

    if (this.big && age < 14) {
      // the burst: sparks flying out, fastest at the start
      const spread = 3 + age * 1.6;
      ctx.fillStyle = age < 6 ? '#ffffff' : '#ffd048';
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + age * 0.08;
        ctx.fillRect(
          Math.round(x + Math.cos(a) * spread), Math.round(y + 3 + Math.sin(a) * spread * 0.7),
          2, 2,
        );
      }
    }

    // Double size for the first few frames, then settle. The font only does
    // whole-number scales, so the pop is a step rather than a smooth zoom.
    const punchy = age < (this.big ? 10 : 5);
    drawText(ctx, this.text, x, y - (punchy ? 4 : 0), {
      color: punchy ? '#ffffff' : (this.big ? '#ffd048' : '#e8e8f4'),
      align: 'center',
      shadow: fade > 0.25 ? '#202030' : null,
      scale: punchy ? 2 : 1,
    });
  }
}

export class BrickPiece extends Entity {
  constructor(level, x, y, dx, dy, theme) {
    super(level, x, y, 6, 6);
    this.kind = 'effect';
    this.alwaysActive = true;
    this.active = true;
    this.vx = dx;
    this.vy = dy;
    this.color = (THEMES[theme] || THEMES.grass).brick;
  }

  update() {
    this.tick++;
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.35;
    if (this.y > this.level.heightPx + 24) this.remove = true;
  }

  draw(ctx) {
    drawBrickShard(ctx, this.x, this.y, this.color);
  }
}

/** The coin that pops out of a bumped block. */
export class CoinPop extends Entity {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    this.kind = 'effect';
    this.alwaysActive = true;
    this.active = true;
    this.vy = -4.4;
    this.life = 32;
  }

  update() {
    this.tick++;
    this.y += this.vy;
    this.vy += 0.32;
    this.life--;
    if (this.life <= 0) {
      this.level.addScorePop(this.cx, this.y, 200);
      this.remove = true;
    }
  }

  draw(ctx) {
    drawCoinSprite(ctx, this.x, this.y, this.tick * 2);
  }
}
