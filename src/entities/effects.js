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

export class ScorePop extends Entity {
  constructor(level, x, y, text) {
    super(level, x, y, 1, 1);
    this.kind = 'effect';
    this.alwaysActive = true;
    this.active = true;
    this.text = String(text);
    this.life = 46;
  }

  update() {
    this.tick++;
    this.y -= 0.7;
    this.life--;
    if (this.life <= 0) this.remove = true;
  }

  draw(ctx) {
    drawText(ctx, this.text, Math.round(this.x), Math.round(this.y), {
      color: '#ffffff', align: 'center', shadow: '#202030',
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
