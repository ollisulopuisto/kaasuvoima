import { Entity } from './entity.js';
import { moveX, moveY, applyGravity, footingAhead } from '../level/physics.js';
import {
  drawWalker, drawShell, drawFlyer, drawPlant, drawBoss,
  drawStinkCloud, drawCorkGuy, drawHeartburn, drawAngrySun,
} from '../gfx/sprites.js';
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

  /** True while the enemy is on screen but can no longer hurt anyone. */
  get harmless() { return false; }

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

  // A flattened walker is scenery for the rest of its animation.
  get harmless() { return this.squash > 0; }

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
  /** Offsets at or beyond this are "down the pipe": not drawn, cannot hurt. */
  static HIDDEN_OFFSET = 24;

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

  /**
   * Half a tile has to be showing before the thing counts as out. Below that
   * it is a two-pixel sliver at the rim of the pipe — technically visible,
   * practically not, and dying to it feels like the game cheated. The same
   * number gates the drawing, so what can hurt you is exactly what you see.
   */
  get exposed() { return this.offset < Plant.HIDDEN_OFFSET; }

  // Down the pipe means out of play. Its box collapses to zero height, but a
  // zero-height box still straddles the player's, so this has to be explicit.
  get harmless() { return !this.exposed; }

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
    if (this.offset >= Plant.HIDDEN_OFFSET) return;
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

/** Ruskea pilvi — drifts through the air and stinks on contact. */
export class StinkCloud extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 20, 14);
    this.score = 200;
    this.homeY = y;
    this.phase = Math.random() * Math.PI * 2;
    this.speed = 0.35;
    this.amplitude = 14;
    // Start on the curve, otherwise the first update teleports it mid-bob.
    this.y = y + Math.sin(this.phase) * this.amplitude;
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();

    const player = this.level.player;
    if (player) {
      const toward = Math.sign(player.cx - this.cx);
      if (toward !== 0) this.facing = toward;
      // drifts slowly toward the player, never in a hurry
      if (Math.abs(player.cx - this.cx) > 24) this.x += this.speed * toward;
    }
    this.phase += 0.045;
    this.y = this.homeY + Math.sin(this.phase) * this.amplitude;

    if (this.tick % 26 === 0) this.level.spawnPuff(this.cx, this.y + this.h, true);
  }

  stomp() {
    this.remove = true;
    this.level.spawnPuff(this.cx, this.cy, true);
    this.level.awardScore(this.score, this.cx, this.y);
    return true;
  }

  draw(ctx) {
    if (this.dying) {
      this.drawFlipped(ctx, () => drawStinkCloud(ctx, this.x, this.y, this.tick, this.facing, true));
      return;
    }
    drawStinkCloud(ctx, this.x, this.y, this.tick, this.facing, true);
  }
}

/**
 * Vihainen aurinko. Hangs in the sky next to the player, then swoops down
 * through them in an arc and climbs back up. Cannot be stomped; three fart
 * balls (or tail whacks) put it out.
 */
export class AngrySun extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 20, 20);
    this.skyY = y;
    this.hp = 3;
    this.score = 1000;
    this.stompable = false;
    this.side = -1;
    this.phase = 'hover';
    this.timer = 150;
    this.diveT = 0;
    this.fromX = x;
    this.toX = x;
    this.diveDepth = 0;
    this.invuln = 0;
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.invuln > 0) this.invuln--;

    const player = this.level.player;
    if (!player) return;

    if (this.phase === 'hover') {
      const target = player.cx + 84 * this.side - this.w / 2;
      this.x += (target - this.x) * 0.035;
      this.y = this.skyY + Math.sin(this.tick / 22) * 5;
      // The sky follows the camera so it never gets left behind.
      this.skyY = Math.min(this.skyY, this.level.cam.y + 18);
      if (--this.timer <= 0) {
        this.phase = 'dive';
        this.diveT = 0;
        this.fromX = this.x;
        this.toX = player.cx - 60 * this.side - this.w / 2;
        this.diveDepth = Math.max(40, player.y - this.skyY + 10);
        Sfx.play('boss');
      }
      return;
    }

    // one smooth arc down through the player's level and back up
    this.diveT = Math.min(1, this.diveT + 0.014);
    this.x = this.fromX + (this.toX - this.fromX) * this.diveT;
    this.y = this.skyY + Math.sin(this.diveT * Math.PI) * this.diveDepth;
    if (this.diveT >= 1) {
      this.phase = 'hover';
      this.timer = 140 + Math.floor(Math.random() * 60);
      this.side *= -1;
    }
  }

  takeHit(dir) {
    if (this.invuln > 0) return;
    this.hp--;
    this.invuln = 30;
    Sfx.play('bump');
    if (this.hp <= 0) this.flipDie(dir);
  }

  hitByProjectile(dir) { this.takeHit(dir); }
  hitByTail(dir) { this.takeHit(dir); }
  hitByShell(dir) { this.takeHit(dir); }

  draw(ctx) {
    if (this.dying) {
      this.drawFlipped(ctx, () => drawAngrySun(ctx, this.x, this.y, this.tick, false, false));
      return;
    }
    drawAngrySun(ctx, this.x, this.y, this.tick, this.phase === 'dive', this.invuln > 0);
  }
}

/** Ummetuskorkki — plugs you up instead of hurting you. */
export class CorkGuy extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 14, 16);
    this.score = 200;
    this.corks = true;
    this.speed = 0.7;
    this.hopTimer = 40;
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    this.vx = this.speed * this.facing;
    if (moveX(this, this.level)) this.facing *= -1;
    if (this.onGround && --this.hopTimer <= 0) {
      this.vy = -3.2;
      this.hopTimer = 50 + Math.floor(Math.random() * 40);
    }
    applyGravity(this, 0.9);
    moveY(this, this.level);
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  draw(ctx) {
    if (this.dying) {
      this.drawFlipped(ctx, () => drawCorkGuy(ctx, this.x - 1, this.y, this.tick, this.facing));
      return;
    }
    drawCorkGuy(ctx, this.x - 1, this.y, this.tick, this.facing);
  }
}

/** Närästys — a heartburn jet that erupts out of the floor on a timer. */
export class Heartburn extends Entity {
  constructor(level, x, floorY) {
    super(level, x, floorY, 16, 0);
    this.kind = 'hazard';
    this.floorY = floorY;
    this.maxHeight = 44;
    this.height = 0;
    this.phase = 'idle';
    this.timer = 60 + Math.floor(Math.random() * 60);
  }

  get box() {
    return { x: this.x + 3, y: this.floorY - this.height, w: 10, h: this.height };
  }

  update() {
    this.tick++;
    switch (this.phase) {
      case 'idle':
        this.height = 0;
        if (--this.timer <= 0) {
          this.phase = 'warn';
          this.timer = 40;   // a beat of warning before it blows
        }
        break;
      case 'warn':
        this.height = 3;
        if (--this.timer <= 0) {
          this.phase = 'up';
          this.timer = 18;
          Sfx.play('fart');
        }
        break;
      case 'up':
        this.height = this.maxHeight * (1 - this.timer / 18);
        if (--this.timer <= 0) {
          this.phase = 'hold';
          this.timer = 34;
          this.height = this.maxHeight;
        }
        break;
      case 'hold':
        if (--this.timer <= 0) {
          this.phase = 'down';
          this.timer = 20;
        }
        break;
      default:
        this.height = this.maxHeight * (this.timer / 20);
        if (--this.timer <= 0) {
          this.phase = 'idle';
          this.timer = 80 + Math.floor(Math.random() * 60);
        }
        break;
    }
  }

  draw(ctx) {
    if (this.phase === 'warn') {
      ctx.fillStyle = Math.floor(this.tick / 3) % 2 ? 'rgba(248,120,24,0.7)' : 'rgba(216,48,24,0.4)';
      ctx.fillRect(Math.round(this.x) + 4, Math.round(this.floorY) - 3, 8, 3);
      return;
    }
    drawHeartburn(ctx, this.x, this.floorY, this.height, this.tick);
  }
}

/** Ground shockwave thrown off by the heavier bosses when they land. */
export class Shockwave extends Enemy {
  constructor(level, x, y, dir) {
    super(level, x, y, 12, 12);
    this.stompable = false;
    this.vx = 2.6 * dir;
    this.life = 90;
    this.score = 0;
    this.alwaysActive = true;
    this.active = true;
  }

  update() {
    this.tick++;
    if (--this.life <= 0) this.remove = true;
    if (moveX(this, this.level)) this.remove = true;
    applyGravity(this, 1);
    moveY(this, this.level);
  }

  flipDie() { this.remove = true; }
  hitByProjectile() {}
  hitByShell() {}
  hitByTail() {}

  draw(ctx) {
    const p = Math.floor(this.tick / 3) % 2;
    ctx.fillStyle = p ? 'rgba(200,160,90,0.85)' : 'rgba(150,110,60,0.85)';
    ctx.fillRect(Math.round(this.x), Math.round(this.y) + 2, 12, 10);
    ctx.fillStyle = 'rgba(240,220,170,0.8)';
    ctx.fillRect(Math.round(this.x) + 3, Math.round(this.y) + p, 6, 5);
  }
}

/**
 * Fortress boss. `variant` picks the move set:
 *   0 walk + jump, 1 landing shockwaves, 2 charges, 3 the giant that inflates.
 */
export class Boss extends Enemy {
  constructor(level, x, y, variant = 0) {
    super(level, x, y, 30, 32);
    this.variant = variant;
    this.hp = variant === 3 ? 5 : 3 + Math.min(1, variant);
    this.score = 5000 + variant * 1000;
    this.invuln = 0;
    this.jumpTimer = 90;
    this.speed = 0.75 + variant * 0.15;
    this.chargeTimer = 220;
    this.charging = 0;
    this.scale = 1;
    this.targetScale = 1;
    this.alwaysActive = true;
    this.active = true;
    this.baseW = 30;
    this.baseH = 32;
    this.spawnX = x;
    this.spawnY = y;
  }

  get giant() { return this.variant === 3; }

  applyScale() {
    const bottom = this.y + this.h;
    const cx = this.x + this.w / 2;
    this.w = Math.round(this.baseW * this.scale);
    this.h = Math.round(this.baseH * this.scale);
    this.x = cx - this.w / 2;
    this.y = bottom - this.h;
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();

    const player = this.level.player;
    if (this.invuln > 0) this.invuln--;

    if (this.scale !== this.targetScale) {
      this.scale += Math.sign(this.targetScale - this.scale) * 0.04;
      if (Math.abs(this.targetScale - this.scale) < 0.05) this.scale = this.targetScale;
      this.applyScale();
    }

    if (player && this.charging <= 0) this.facing = player.cx < this.cx ? -1 : 1;

    if (this.charging > 0) {
      this.charging--;
      this.vx = 3.4 * this.facing / Math.max(1, this.scale * 0.7);
    } else {
      this.vx = (this.speed / Math.max(1, this.scale * 0.6)) * this.facing;
    }
    if (moveX(this, this.level)) this.facing *= -1;

    /*
     * The boss chases the player, and the arena has open sides, so without this
     * it walks straight out into the corridor and falls down the first pit.
     * That leaves a fortress with no boss and a door that can never open —
     * the level becomes unwinnable with no way for the player to know why.
     * So it turns at ledges, exactly like the shell walkers do.
     */
    if (this.onGround && !footingAhead(this.level, this.x + this.facing * 4, this.y, this.w, this.h)) {
      this.facing *= -1;
      this.charging = 0;
      this.x += this.facing * 2;
    }

    const fallSpeed = this.onGround ? 0 : this.vy;
    if (this.onGround && --this.jumpTimer <= 0) {
      this.vy = -5.6;
      this.jumpTimer = (this.giant ? 60 : 80) + Math.floor(Math.random() * 60);
      Sfx.play('boss');
    }
    if (this.variant >= 2 && this.onGround && --this.chargeTimer <= 0) {
      this.charging = 45;
      this.chargeTimer = 200 + Math.floor(Math.random() * 120);
    }

    applyGravity(this, 1);
    moveY(this, this.level);

    // Last line of defence: if it ever gets out anyway, put it back rather than
    // let the level quietly become impossible.
    if (this.y > this.level.heightPx) {
      this.x = this.spawnX;
      this.y = this.spawnY;
      this.vx = 0;
      this.vy = 0;
      this.charging = 0;
    }

    // A hard landing sends shockwaves out along the floor. Only after a real
    // fall, and never more than a couple of pairs at a time.
    const live = this.level.entities.filter((e) => e instanceof Shockwave && !e.remove).length;
    if (this.onGround && fallSpeed > 3.5 && live < 4 && (this.variant >= 1 || this.scale > 1.5)) {
      this.level.add(new Shockwave(this.level, this.x - 6, this.y + this.h - 12, -1));
      this.level.add(new Shockwave(this.level, this.x + this.w - 6, this.y + this.h - 12, 1));
      this.level.shake(2 + this.scale);
      Sfx.play('stomp');
    }
  }

  stomp() {
    if (this.invuln > 0) return true;
    this.hp--;
    this.invuln = 70;
    this.charging = 0;
    Sfx.play('stomp');
    if (this.giant) {
      // Puffs up half a size with every hit, all the way to three times over.
      this.targetScale = Math.min(3, this.targetScale + 0.5);
      Sfx.play('fart');
    } else {
      this.speed += 0.35;
    }
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
      this.drawFlipped(ctx, () =>
        drawBoss(ctx, this.x - 1, this.y, frame, this.facing, false, this.variant, this.scale));
      return;
    }
    drawBoss(ctx, this.x - 1, this.y, frame, this.facing, this.invuln > 0, this.variant, this.scale);
  }
}

export const ENEMY_CHARS = {
  g: (level, tx, ty) => new Walker(level, tx * TILE, ty * TILE),
  k: (level, tx, ty) => new ShellGuy(level, tx * TILE + 1, ty * TILE - 8),
  f: (level, tx, ty) => new Flyer(level, tx * TILE, ty * TILE),
  p: (level, tx, ty) => new Plant(level, tx * TILE + 8, (ty + 1) * TILE - 32),
  r: (level, tx, ty) => new StinkCloud(level, tx * TILE, ty * TILE),
  c: (level, tx, ty) => new CorkGuy(level, tx * TILE + 1, ty * TILE),
  A: (level, tx, ty) => new AngrySun(level, tx * TILE, ty * TILE),
  H: (level, tx, ty) => new Heartburn(level, tx * TILE, (ty + 1) * TILE),
  b: (level, tx, ty, variant) => new Boss(level, tx * TILE, ty * TILE, variant),
};
