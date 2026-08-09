import { Entity } from './entity.js';
import { moveX, moveY, applyGravity } from '../level/physics.js';
import { drawItem, drawFart, TINTS, GLOWS } from '../gfx/sprites.js';
import { TILE } from '../gfx/tiles.js';
import { Sfx } from '../core/audio.js';

const EMERGE_FRAMES = 26;

/** Shared so the draw loop is not allocating an options object per shot. */
const FART_STYLE = { glow: GLOWS.fart };
const FART_STYLE_SPENT = { glow: GLOWS.fart, tint: TINTS.spent };

export class Item extends Entity {
  /** @param {'shroom'|'flower'|'leaf'|'soup'|'star'|'oneup'} itemKind */
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
      case 'shroom':
      case 'oneup': {
        this.vx = 0.85 * this.facing;
        if (moveX(this, this.level)) this.facing *= -1;
        applyGravity(this, 0.8);
        moveY(this, this.level);
        break;
      }
      case 'star': {
        // It bounces, and that is the point: a star that plodded along the
        // floor like a mushroom would be a mushroom in a different hat.
        this.vx = 1.2 * this.facing;
        if (moveX(this, this.level)) this.facing *= -1;
        applyGravity(this, 0.6);
        if (moveY(this, this.level).ground) this.vy = -3.4;
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
      case 'soup':
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

/** Comfortably above the player's 3.5 px/frame top speed — see the constructor. */
const FART_SPEED = 5.0;

export class FartBall extends Entity {
  constructor(level, x, y, dir) {
    super(level, x, y, 8, 8);
    this.kind = 'projectile';
    this.alwaysActive = true;
    this.active = true;
    /*
     * Faster than the player can possibly run, and that is a rule rather than a
     * taste: at 3.2 it was slower than `MAX_P` (3.5), so a sprinting player
     * outran their own shot and watched it trail behind them. A projectile you
     * can beat in a footrace is not a weapon.
     */
    this.vx = FART_SPEED * dir;
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

    /*
     * Nothing happens off screen.
     *
     * At 5 px/frame with 200 frames of life the ball travels a thousand pixels
     * — three screens — so it was trapping enemies the player had never seen.
     * The camera would then scroll onto an enemy already sitting in a bubble,
     * which reads as the game having played itself. A shot that leaves the view
     * is spent, the same way it is spent on a wall.
     */
    // 320 mirrors `VIEW_W` in scenes/level.js. Importing it would close a
    // cycle — level.js imports this file — and a cycle that happens to work
    // because the value is read late is still a cycle.
    const camL = this.level.cam.x - 8;
    const camR = this.level.cam.x + 320 + 8;
    if (this.x + this.w < camL || this.x > camR) {
      this.remove = true;
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
    // A shot running out of gas stops looking like fresh gas before it pops.
    drawFart(ctx, this.x, this.y, this.tick,
      this.life > 40 ? FART_STYLE : FART_STYLE_SPENT);
  }
}
