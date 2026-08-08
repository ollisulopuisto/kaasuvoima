import { Entity } from './entity.js';
import { moveX, moveY, applyGravity, footingAhead } from '../level/physics.js';
import { drawWalker, drawShell, drawFlyer, drawPlant, drawBoss } from '../gfx/sprites.js';
import { TILE } from '../gfx/tiles.js';
import { Sfx } from '../core/audio.js';

export class Enemy extends Entity {
  constructor(level, x, y, w, h) {
    super(level, x, y, w, h);
    this.kind = 'enemy';
    this.stompable = true;
    this.dying = false;
    this.score = 100;
    this.facing = -1;
  }

  /** Knocked over by a fart ball, a sliding shell or a tail whack. */
  flipDie(dir = 1) {
    if (this.dying) return;
    this.dying = true;
    this.noclip = true;
    this.stompable = false;
    this.vy = -4.2;
    this.vx = 0.8 * dir;
    this.level.awardScore(this.score, this.cx, this.y);
    Sfx.play('kick');
  }

  hitByProjectile(dir) { this.flipDie(dir); }
  hitByShell(dir) { this.flipDie(dir); }
  hitByTail(dir) { this.flipDie(dir); }

  /** @returns true when the stomp counted (player should bounce). */
  stomp() {
    this.remove = true;
    this.level.awardScore(this.score, this.cx, this.y);
    return true;
  }

  updateDying() {
    this.vy = Math.min(this.vy + 0.35, 8);
    this.x += this.vx;
    this.y += this.vy;
    if (this.y > this.level.heightPx + 48) this.remove = true;
  }

  drawFlipped(ctx, fn) {
    ctx.save();
    ctx.translate(0, Math.round(this.y) * 2 + this.h);
    ctx.scale(1, -1);
    fn();
    ctx.restore();
  }
}

export class Walker extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    this.speed = 0.55;
    this.squash = 0;
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.squash > 0) {
      if (--this.squash === 0) this.remove = true;
      return;
    }
    this.vx = this.speed * this.facing;
    if (moveX(this, this.level)) this.facing *= -1;
    applyGravity(this, 0.9);
    moveY(this, this.level);
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  stomp() {
    this.squash = 22;
    this.stompable = false;
    this.vx = 0;
    this.level.awardScore(this.score, this.cx, this.y);
    return true;
  }

  draw(ctx) {
    const frame = Math.floor(this.tick / 8);
    if (this.dying) {
      this.drawFlipped(ctx, () => drawWalker(ctx, this.x, this.y, frame, this.facing, false));
    } else {
      drawWalker(ctx, this.x, this.y, frame, this.facing, this.squash > 0);
    }
  }
}

export class ShellGuy extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 14, 24);
    this.mode = 'walk';
    this.speed = 0.5;
    this.reviveTimer = 0;
    this.score = 100;
  }

  toShell() {
    this.mode = 'shell';
    const bottom = this.y + this.h;
    this.h = 14;
    this.y = bottom - this.h;
    this.vx = 0;
    this.reviveTimer = 420;
  }

  toWalking() {
    this.mode = 'walk';
    const bottom = this.y + this.h;
    this.h = 24;
    this.y = bottom - this.h;
    this.vx = 0;
    this.stompable = true;
  }

  kick(dir) {
    this.mode = 'sliding';
    this.vx = 3.4 * dir;
    this.facing = dir;
    this.reviveTimer = 0;
    Sfx.play('kick');
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();

    if (this.mode === 'walk') {
      this.vx = this.speed * this.facing;
      if (moveX(this, this.level)) this.facing *= -1;
      // Unlike the walkers, these are careful about ledges.
      if (this.onGround && !footingAhead(this.level, this.x + this.facing * 2, this.y, this.w, this.h)) {
        this.facing *= -1;
      }
    } else if (this.mode === 'sliding') {
      if (moveX(this, this.level)) {
        this.vx = -this.vx;
        this.facing = Math.sign(this.vx) || 1;
        Sfx.play('bump');
      }
      this.level.shellSweep(this);
    } else {
      this.vx = 0;
      if (this.reviveTimer > 0 && --this.reviveTimer === 0) this.toWalking();
    }

    applyGravity(this, 0.9);
    moveY(this, this.level);
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  stomp() {
    if (this.mode === 'walk') {
      this.toShell();
      this.level.awardScore(this.score, this.cx, this.y);
      return true;
    }
    if (this.mode === 'sliding') {
      this.mode = 'shell';
      this.vx = 0;
      this.reviveTimer = 420;
      return true;
    }
    return true;
  }

  draw(ctx) {
    const frame = this.tick;
    if (this.dying) {
      this.drawFlipped(ctx, () => drawShell(ctx, this.x - 1, this.y, frame, this.facing, this.mode));
      return;
    }
    drawShell(ctx, this.x - 1, this.y, frame, this.facing, this.mode);
  }
}

export class Flyer extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    this.speed = 0.5;
    this.hop = -3.4;
    this.score = 200;
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    this.vx = this.speed * this.facing;
    if (moveX(this, this.level)) this.facing *= -1;
    applyGravity(this, 0.85);
    const hit = moveY(this, this.level);
    if (hit.ground) this.vy = this.hop;
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  stomp() {
    // Loses the wings and keeps walking, SMB3 style.
    const walker = new Walker(this.level, this.x, this.y);
    walker.facing = this.facing;
    walker.active = true;
    this.level.add(walker);
    this.remove = true;
    this.level.awardScore(this.score, this.cx, this.y);
    return true;
  }

  draw(ctx) {
    const frame = this.tick;
    if (this.dying) {
      this.drawFlipped(ctx, () => drawFlyer(ctx, this.x, this.y, frame, this.facing));
    } else {
      drawFlyer(ctx, this.x, this.y, frame, this.facing);
    }
  }
}

export class Plant extends Enemy {
  /** `pipeTopY` is the y of the pipe mouth; the plant hides one tile below. */
  constructor(level, x, pipeTopY) {
    super(level, x, pipeTopY, 16, 32);
    this.pipeTopY = pipeTopY;
    this.stompable = false;
    this.score = 200;
    this.phase = 'hidden';
    this.timer = 40;
    this.offset = 32;
    this.alwaysActive = false;
  }

  get exposed() { return this.offset < 30; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();

    const player = this.level.player;
    const nearPlayer = player && Math.abs(player.cx - (this.x + 8)) < 40;

    switch (this.phase) {
      case 'hidden':
        this.offset = 32;
        if (--this.timer <= 0 && !nearPlayer) {
          this.phase = 'rising';
          this.timer = 26;
        }
        break;
      case 'rising':
        this.offset = 32 * (this.timer / 26);
        if (--this.timer <= 0) {
          this.phase = 'out';
          this.timer = 70;
          this.offset = 0;
        }
        break;
      case 'out':
        // Ducks back down when somebody is right on top of it, so clearing
        // the pipe is a matter of timing rather than luck.
        if (nearPlayer && this.timer > 16) this.timer = 16;
        if (--this.timer <= 0) {
          this.phase = 'falling';
          this.timer = 26;
        }
        break;
      default:
        this.offset = 32 * (1 - this.timer / 26);
        if (--this.timer <= 0) {
          this.phase = 'hidden';
          this.timer = 60;
        }
        break;
    }
    this.y = this.pipeTopY + this.offset;
  }

  get box() {
    // Only the part sticking out of the pipe can hurt anybody.
    const visible = Math.max(0, this.h - this.offset);
    return { x: this.x, y: this.y, w: this.w, h: visible };
  }

  draw(ctx) {
    if (this.offset >= 31) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x - 2, this.pipeTopY - 40, this.w + 4, 40 + this.h);
    ctx.clip();
    if (this.dying) {
      this.drawFlipped(ctx, () => drawPlant(ctx, this.x, this.y, this.tick));
    } else {
      drawPlant(ctx, this.x, this.y, this.tick);
    }
    ctx.restore();
  }
}

export class Boss extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 30, 32);
    this.hp = 3;
    this.score = 5000;
    this.invuln = 0;
    this.jumpTimer = 90;
    this.speed = 0.75;
    this.alwaysActive = true;
    this.active = true;
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();

    const player = this.level.player;
    if (this.invuln > 0) this.invuln--;

    if (player) this.facing = player.cx < this.cx ? -1 : 1;
    this.vx = this.speed * this.facing;
    if (moveX(this, this.level)) this.facing *= -1;

    if (this.onGround && --this.jumpTimer <= 0) {
      this.vy = -5.6;
      this.jumpTimer = 80 + Math.floor(Math.random() * 60);
      Sfx.play('boss');
    }
    applyGravity(this, 1);
    moveY(this, this.level);
  }

  stomp() {
    if (this.invuln > 0) return true;
    this.hp--;
    this.invuln = 70;
    this.speed += 0.35;
    Sfx.play('stomp');
    if (this.hp <= 0) {
      this.dying = true;
      this.noclip = true;
      this.vy = -5;
      this.vx = this.facing * -1.2;
      this.level.awardScore(this.score, this.cx, this.y);
      this.level.onBossDefeated();
    }
    return true;
  }

  hitByProjectile() { /* immune — it is made of the same stuff */ }
  hitByShell(dir) { this.stomp(dir); }
  hitByTail() { /* immune */ }

  draw(ctx) {
    const frame = this.tick;
    if (this.dying) {
      this.drawFlipped(ctx, () => drawBoss(ctx, this.x - 1, this.y, frame, this.facing, false));
      return;
    }
    drawBoss(ctx, this.x - 1, this.y, frame, this.facing, this.invuln > 0);
  }
}

export const ENEMY_CHARS = {
  g: (level, tx, ty) => new Walker(level, tx * TILE, ty * TILE),
  k: (level, tx, ty) => new ShellGuy(level, tx * TILE + 1, ty * TILE - 8),
  f: (level, tx, ty) => new Flyer(level, tx * TILE, ty * TILE),
  p: (level, tx, ty) => new Plant(level, tx * TILE + 8, (ty + 1) * TILE - 32),
  b: (level, tx, ty) => new Boss(level, tx * TILE, ty * TILE),
};
