import { Entity } from './entity.js';
import { moveX, moveY, applyGravity } from '../level/physics.js';
import { drawItem, drawFart } from '../gfx/sprites.js';
import { TILE } from '../gfx/tiles.js';
import { Sfx } from '../core/audio.js';

const EMERGE_FRAMES = 26;

export class Item extends Entity {
  /** @param {'bean'|'flower'|'leaf'|'oneup'} itemKind */
  constructor(level, x, y, itemKind, { emerge = true } = {}) {
    super(level, x, y, 16, 16);
    this.kind = 'item';
    this.itemKind = itemKind;
    this.alwaysActive = true;
    this.active = true;
    this.emerging = emerge ? EMERGE_FRAMES : 0;
    this.baseY = y;
    this.facing = 1;
    this.leafPhase = 0;
    if (itemKind === 'leaf' && !emerge) this.vy = -1;
  }

  update() {
    this.tick++;

    if (this.emerging > 0) {
      this.emerging--;
      this.y = this.baseY - (1 - this.emerging / EMERGE_FRAMES) * TILE;
      if (this.emerging === 0 && this.itemKind === 'leaf') this.vy = -2.4;
      return;
    }

    switch (this.itemKind) {
      case 'bean':
      case 'oneup': {
        this.vx = 0.85 * this.facing;
        if (moveX(this, this.level)) this.facing *= -1;
        applyGravity(this, 0.8);
        moveY(this, this.level);
        break;
      }
      case 'leaf': {
        // Flutters down in a lazy zig-zag, exactly the annoying way it should.
        this.leafPhase += 0.06;
        this.vy = Math.min(this.vy + 0.08, 0.8);
        this.vx = Math.sin(this.leafPhase) * 1.1;
        moveX(this, this.level);
        moveY(this, this.level);
        break;
      }
      case 'flower':
      default:
        applyGravity(this, 0.7);
        moveY(this, this.level);
        break;
    }

    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  draw(ctx) {
    drawItem(ctx, this.itemKind, this.x, this.y, this.tick);
  }
}

export class FartBall extends Entity {
  constructor(level, x, y, dir) {
    super(level, x, y, 8, 8);
    this.kind = 'projectile';
    this.alwaysActive = true;
    this.active = true;
    this.vx = 3.2 * dir;
    this.vy = 1;
    this.life = 200;
    Sfx.play('fart');
  }

  update() {
    this.tick++;
    this.life--;
    if (this.life <= 0) {
      this.pop();
      return;
    }
    if (moveX(this, this.level)) {
      this.pop();
      return;
    }
    this.vy = Math.min(this.vy + 0.28, 5);
    const hit = moveY(this, this.level);
    if (hit.ground) this.vy = -2.9;   // bounces along the floor
    if (hit.ceiling) this.vy = 1;
    if (this.y > this.level.heightPx + 16) this.remove = true;
  }

  pop() {
    this.remove = true;
    this.level.spawnPuff(this.cx, this.cy);
  }

  draw(ctx) {
    drawFart(ctx, this.x, this.y, this.tick);
  }
}
