import { Entity } from './entity.js';
import { moveX, moveY, applyGravity, footingAhead } from '../level/physics.js';
import {
  drawWalker, drawShell, drawFlyer, drawPlant, drawBoss,
  drawStinkCloud, drawCorkGuy, drawHeartburn, drawAngrySun, drawSpikeGuy,
  drawBubble, bubbleRadius, recolored, TINTS,
} from '../gfx/sprites.js';
import { TILE } from '../gfx/tiles.js';
import { Sfx } from '../core/audio.js';
import { Item } from './items.js';

/*
 * The bubble trap.
 *
 * Four seconds is long enough to cross most of a screen, jump, and come back
 * for the kill, and short enough that walking past a bubble is a decision with
 * a price rather than a free win. The last one and a bit of those seconds are
 * the warning: longer than the heartburn's beat of warning, because what comes
 * out of a bubble is not a flame you step around but an enemy you now have to
 * live with for the rest of the level.
 */
export const BUBBLE_FRAMES = 240;
const BUBBLE_WARN = 72;
/** How long a fresh bubble climbs before it just hangs there — see updateBubbled. */
const BUBBLE_CLIMB = 48;
/** What breaking out is worth to an enemy. Fast, but still slower than a walk. */
export const ANGRY_SPEED = 1.6;
/** And what popping one is worth to the player, or the trap is a nerf. */
const POP_BONUS = 2;

export class Enemy extends Entity {
  constructor(level, x, y, w, h) {
    super(level, x, y, w, h);
    this.kind = 'enemy';
    this.stompable = true;
    this.dying = false;
    this.score = 100;
    this.facing = -1;
    this.bubbleTimer = 0;
    this.angry = false;
  }

  /**
   * Whether a fart ball traps this one instead of knocking it over. Anything
   * with hit logic of its own says no — see the overrides. A bubbleable enemy
   * walks on `speed`, which is what breaking out multiplies.
   */
  get bubbleable() { return false; }

  get bubbled() { return this.bubbleTimer > 0; }

  /**
   * Points on top: a stomp lands on them and hurts, rather than counting. Every
   * other way of killing the thing is untouched, which is the whole design —
   * spiky closes one door, it does not make an enemy invincible.
   */
  get spiky() { return false; }

  /** True once the bubble has started warning that it is about to go. */
  get bursting() { return this.bubbleTimer > 0 && this.bubbleTimer < BUBBLE_WARN; }

  get box() {
    if (!this.bubbled) return { x: this.x, y: this.y, w: this.w, h: this.h };
    const r = bubbleRadius(this.w, this.h);
    return { x: this.cx - r, y: this.cy - r, w: r * 2, h: r * 2 };
  }

  /** Goes limp and falls out of the world. */
  tumble(dir) {
    this.dying = true;
    this.noclip = true;
    this.stompable = false;
    this.vy = -4.2;
    this.vx = 0.8 * dir;
  }

  /** Knocked over by a sliding shell or a tail whack. */
  flipDie(dir = 1) {
    if (this.dying) return;
    // While a bubble is up it is the only thing there is to hit, so everything
    // that would have killed the enemy bursts the bubble instead.
    if (this.bubbled) {
      this.popBubble(dir);
      return;
    }
    this.tumble(dir);
    this.level.awardScore(this.score, this.cx, this.y);
    Sfx.play('kick');
  }

  /** Caught by a fart ball: floats, harmless, and worth double to whoever pops it. */
  trap() {
    if (this.dying || this.bubbled) return;
    this.bubbleTimer = BUBBLE_FRAMES;
    this.vx = 0;
    this.vy = 0;
    this.level.spawnPuff(this.cx, this.cy);
    Sfx.play('squeak');
  }

  /** The burst is the kill, and it pays better than the shot on its own did. */
  popBubble(dir = 1) {
    if (!this.bubbled || this.dying) return;
    this.bubbleTimer = 0;
    this.tumble(dir);
    this.level.spawnPuff(this.cx, this.cy);
    this.level.awardScore(this.score * POP_BONUS, this.cx, this.y);
    Sfx.play('pop');
  }

  /** Nobody came: it breaks out faster than it went in, and blinking. */
  escape() {
    this.bubbleTimer = 0;
    if (!this.angry) {
      this.angry = true;
      this.speed *= ANGRY_SPEED;
    }
    this.level.spawnPuff(this.cx, this.cy, true);
    // The same burst as a kill, followed downwards: the bubble went the wrong way.
    Sfx.play('pop');
    Sfx.play('kick');
  }

  /**
   * A bubble rises for a moment and then hangs there swaying. It has to stop
   * climbing: one that kept going would carry the kill up out of jumping range
   * and make escaping the usual outcome instead of the punishment.
   */
  updateBubbled() {
    if (--this.bubbleTimer <= 0) {
      this.escape();
      return;
    }
    const age = BUBBLE_FRAMES - this.bubbleTimer;
    this.vx = Math.sin(this.tick / 22) * 0.4;
    this.vy = age < BUBBLE_CLIMB ? -0.55 : Math.sin(this.tick / 30) * 0.25;
    moveX(this, this.level);
    moveY(this, this.level);
  }

  /** True while the enemy is on screen but can no longer hurt anyone. */
  get harmless() { return this.bubbled; }

  /** An escapee blinks, so a fast one is never mistaken for a fresh one. */
  get tint() { return this.angry && Math.floor(this.tick / 4) % 2 ? TINTS.flash : null; }

  /**
   * Every enemy that can be trapped paints through here, so the bubble and the
   * angry blink are each written once instead of once per species.
   */
  drawSprite(ctx, paint) {
    if (this.bubbled) {
      drawBubble(ctx, this.cx, this.cy, bubbleRadius(this.w, this.h), this.tick, this.bursting,
        (g) => paint(recolored(g, this.tint)));
      return;
    }
    paint(recolored(ctx, this.tint));
  }

  hitByProjectile(dir) {
    if (this.bubbleable && !this.bubbled) this.trap();
    else this.flipDie(dir);
  }

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

  get bubbleable() { return true; }

  // A flattened walker is scenery for the rest of its animation.
  get harmless() { return this.bubbled || this.squash > 0; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.bubbled) return this.updateBubbled();
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
      return;
    }
    this.drawSprite(ctx, (g) => drawWalker(g, this.x, this.y, frame, this.facing, this.squash > 0));
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

  get bubbleable() { return true; }

  trap() {
    // A shell caught mid-slide comes out of the bubble at rest. Left sliding it
    // would resume at the zero speed the trap gave it: a shell that mows down
    // whatever it is touching and never moves off it again.
    if (this.mode === 'sliding') {
      this.mode = 'shell';
      this.reviveTimer = 420;
    }
    super.trap();
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
    if (this.bubbled) return this.updateBubbled();

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
    this.drawSprite(ctx, (g) => drawShell(g, this.x - 1, this.y, frame, this.facing, this.mode));
  }
}

export class Flyer extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    this.speed = 0.5;
    this.hop = -3.4;
    this.score = 200;
  }

  get bubbleable() { return true; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.bubbled) return this.updateBubbled();
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
      return;
    }
    this.drawSprite(ctx, (g) => drawFlyer(g, this.x, this.y, frame, this.facing));
  }
}

/**
 * The one walking-speed enemy a fart ball still kills outright. It is bolted to
 * a pipe — box, drawing and state machine are all measured from the pipe mouth
 * — and a plant that floated away in a bubble would leave that pipe harmless
 * for the rest of the level.
 */
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

  get bubbleable() { return true; }

  escape() {
    // It carries on bobbing from wherever the bubble left it. Keeping the old
    // home line would drop it back into the lane it was in four seconds ago —
    // a teleport, and away from the player who had just failed to reach it.
    this.homeY = this.y - Math.sin(this.phase) * this.amplitude;
    super.escape();
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.bubbled) return this.updateBubbled();

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
    this.drawSprite(ctx, (g) => drawStinkCloud(g, this.x, this.y, this.tick, this.facing, true));
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

  get bubbleable() { return true; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.bubbled) return this.updateBubbled();
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
    this.drawSprite(ctx, (g) => drawCorkGuy(g, this.x - 1, this.y, this.tick, this.facing));
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

/**
 * Kuu — hangs in the night sky and bobs. Jump onto it and it hands over a
 * power-up. It cannot hurt you; the challenge is getting up there at all.
 * (Lead designer's request.)
 */
export class Moon extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 20, 20);
    this.skyY = y;
    this.score = 1000;
    this.used = false;
    this.alwaysActive = true;
    this.active = true;
  }

  get harmless() { return true; }

  update() {
    this.tick++;
    this.y = this.skyY + Math.sin(this.tick / 40) * 3;
  }

  stomp() {
    if (this.used) return true;
    this.used = true;
    this.level.add(new Item(this.level, this.x + 2, this.y - 18, this.level.rollPowerup(this.level.player)));
    this.level.awardScore(this.score, this.cx, this.y);
    Sfx.play('powerup');
    return true;
  }

  hitByProjectile() { /* it is the moon */ }
  hitByShell() { }
  hitByTail() { }

  draw(ctx) {
    const cx = Math.round(this.x) + 10;
    const cy = Math.round(this.y) + 10;
    const glow = this.used ? 0.05 : 0.12 + 0.05 * Math.sin(this.tick / 14);
    ctx.fillStyle = `rgba(255,248,200,${glow})`;
    for (let dy = -18; dy <= 18; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, 324 - dy * dy)));
      ctx.fillRect(cx - half, cy + dy, half * 2, 1);
    }
    /*
     * A crescent, not a disc: it is a *moon*, and a plain bright circle in a
     * night sky is a sun with the lights off.
     *
     * Drawn as a disc minus a second disc offset up and to the right, one row
     * at a time. Subtracting spans rather than compositing keeps it a single
     * pass with no canvas state to restore, and keeps the edge pixel-sharp
     * instead of the soft rim a composite operation would leave.
     */
    const R = 10;
    const BITE_R = 9;
    const biteX = 5;
    const biteY = -3;
    ctx.fillStyle = this.used ? '#8a8470' : '#e8d89a';
    for (let dy = -R; dy <= R; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy)));
      if (half <= 0) continue;
      const bd = dy - biteY;
      const bite = bd * bd < BITE_R * BITE_R
        ? Math.round(Math.sqrt(BITE_R * BITE_R - bd * bd)) : -1;
      const left = cx - half;
      const right = cx + half;
      // Where the bite starts, on this row. Everything right of it is gone.
      const cut = bite >= 0 ? cx + biteX - bite : right;
      if (cut > left) ctx.fillRect(left, cy + dy, Math.min(right, cut) - left, 1);
    }

    // The lit inner edge, following the same crescent so it cannot drift off it
    ctx.fillStyle = this.used ? '#a8a290' : '#fff8d8';
    for (let dy = -R + 2; dy <= R - 2; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy)));
      if (half <= 1) continue;
      ctx.fillRect(cx - half, cy + dy, 2, 1);
    }

    // two craters, kept on the thick side of the crescent
    ctx.fillStyle = this.used ? '#8a8470' : '#d8c88a';
    ctx.fillRect(cx - 6, cy - 3, 3, 3);
    ctx.fillRect(cx - 5, cy + 3, 2, 2);
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
  O: (level, tx, ty) => new Moon(level, tx * TILE, ty * TILE),
};
