import { Entity } from './entity.js';
import { moveX, moveY, applyGravity, footingAhead } from '../level/physics.js';
import {
  drawWalker, drawShell, drawFlyer, drawPlant, drawBoss,
  drawStinkCloud, drawCorkGuy, drawHeartburn, drawAngrySun, drawSpikeGuy,
  drawBeanBaron, drawBeanBomb, drawBubble, bubbleRadius, recolored, TINTS,
} from '../gfx/sprites.js';
import { TILE, T } from '../gfx/tiles.js';
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

/**
 * The light an enemy is giving off this frame, in the shared-object idiom the
 * sprite styles already use: the draw loop copies the four numbers out of it
 * and forgets it, so one object serves every lit enemy in the level and no
 * light costs an allocation. Nothing may hold on to what `light()` returns.
 */
const LIGHT = { x: 0, y: 0, r: 0, i: 0 };
function light(x, y, r, i) {
  LIGHT.x = x;
  LIGHT.y = y;
  LIGHT.r = r;
  LIGHT.i = i;
  return LIGHT;
}

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
    this.spawnGrace = 0;
  }

  get bubbleable() { return true; }

  /*
   * A flattened walker is scenery for the rest of its animation — and a walker
   * that has just been shaken out of a flyer is untouchable for a moment.
   *
   * Reported from play: stomp a flying enemy, it loses its wings, and the same
   * jump kills the walker underneath. `Flyer.stomp` adds the walker to
   * `level.entities` — the very array `collisions()` is iterating — so the new
   * walker is visited later in that same loop, against the same `fallVy`, and
   * is stomped by a jump that has already been spent.
   *
   * Twelve frames: long enough for the bounce (-4.0 px/frame) to carry the
   * player clear of a 16 px body, short enough that nobody waits for it.
   */
  get harmless() { return this.bubbled || this.squash > 0 || this.spawnGrace > 0; }

  update() {
    this.tick++;
    if (this.spawnGrace > 0) this.spawnGrace--;
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

/** How fast a kicked shell travels, and keeps travelling after a bounce. */
const SHELL_SPEED = 3.4;

export class ShellGuy extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 14, 24);
    this.mode = 'walk';
    this.speed = 0.5;
    this.reviveTimer = 0;
    this.kickGrace = 0;
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

  /**
   * Breaks any plain brick the shell is pressed against.
   *
   * A brick hiding something is left alone and bounces the shell like stone:
   * its reward is for a player who bumps it from below, and a shell demolishing
   * it would delete a secret nobody ever saw.
   *
   * @returns true when something broke, so the caller knows not to bounce.
   */
  smashAhead() {
    const level = this.level;
    const ahead = this.vx > 0
      ? Math.floor((this.x + this.w + 1) / TILE)
      : Math.floor((this.x - 1) / TILE);
    const top = Math.floor(this.y / TILE);
    const bottom = Math.floor((this.y + this.h - 1) / TILE);
    let broke = false;
    for (let ty = top; ty <= bottom; ty++) {
      if (level.tileAt(ahead, ty) !== T.BRICK) continue;
      if (level.brickSecret && level.brickSecret(ahead, ty)) continue;
      level.smashBrick(ahead, ty);
      broke = true;
    }
    return broke;
  }

  kick(dir) {
    this.mode = 'sliding';
    this.vx = SHELL_SPEED * dir;
    this.facing = dir;
    this.reviveTimer = 0;
    /*
     * Reported from play: stomp a shell walker, walk into the shell, lose a
     * power level. The kick was landing correctly — and then the shell, which
     * had only moved 3.4 px out of a box it was overlapping by more than that,
     * was still inside the player on the very next frame. A sliding shell hurts
     * you, so it hurt the one who had just kicked it.
     *
     * Ten frames is enough for a shell at 3.4 px/frame to clear the widest
     * player (21 px) from a standing overlap. It only shields the player; the
     * shell mows down everything else from the first frame, which is the whole
     * point of kicking one.
     */
    this.kickGrace = 10;
    Sfx.play('kick');
  }

  /** A shell you have just kicked cannot hurt you on its way out of your box. */
  get harmless() { return this.bubbled || this.kickGrace > 0; }

  update() {
    this.tick++;
    if (this.kickGrace > 0) this.kickGrace--;
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
      // A shell that hits something goes through it or comes back off it, and
      // which one depends on what it hit. Bricks are the soft thing in this
      // game; everything else is masonry.
      if (moveX(this, this.level)) {
        if (!this.smashAhead()) {
          /* Bounce off it, at speed.
           *
           * This used to be `this.vx = -this.vx`, and `moveX` zeroes the
           * velocity when it stops something — so the shell was negating a zero
           * and stopping dead against every wall. Shells have never actually
           * bounced in this game; they parked. Rebuild the speed from the
           * direction instead of from whatever survived the collision. */
          this.facing = -this.facing;
          this.vx = SHELL_SPEED * this.facing;
          Sfx.play('bump');
        }
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
    walker.spawnGrace = 12;
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
 * Piikkiukko — a walker with a back full of spines. Jumping on it is the one
 * thing that does not work; a fart ball, a tail whack and a sliding shell all
 * still do, so it is an enemy that changes which tool you reach for rather than
 * a wall.
 *
 * Careful about ledges, like the shell walkers: an enemy you are not allowed to
 * stomp is one you have to walk around, and one that keeps throwing itself off
 * the platform it was guarding does not guard anything.
 */
export class SpikeGuy extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    // Slower than a walker. It is already the harder one to deal with; making
    // it fast as well would just make it a thing that catches you from behind.
    this.speed = 0.4;
    this.score = 200;
  }

  get spiky() { return true; }

  get bubbleable() { return true; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.bubbled) return this.updateBubbled();
    this.vx = this.speed * this.facing;
    if (moveX(this, this.level)) this.facing *= -1;
    if (this.onGround && !footingAhead(this.level, this.x + this.facing * 2, this.y, this.w, this.h)) {
      this.facing *= -1;
    }
    applyGravity(this, 0.9);
    moveY(this, this.level);
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  draw(ctx) {
    const frame = Math.floor(this.tick / 2);
    if (this.dying) {
      this.drawFlipped(ctx, () => drawSpikeGuy(ctx, this.x, this.y, frame, this.facing));
      return;
    }
    this.drawSprite(ctx, (g) => drawSpikeGuy(g, this.x, this.y, frame, this.facing));
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

  /** It is a burning sun. Put it out and the light goes with it. */
  get light() {
    return this.dying ? null : light(this.cx, this.cy, 72, 0.85);
  }

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

  /**
   * A column of burning gas is a light, and in the dark level it is *the*
   * light: the brightest thing there, visible from further away than anything
   * else, and the only one that tells you what the floor looks like somewhere
   * you are not standing. It is also the thing that kills you if you are
   * standing in it when it goes off. That trade is the point — you wait out a
   * hazard to be shown the route, and the waiting is what costs you the clock.
   *
   * The light follows the flame's own timing, so it is not a second signal to
   * learn: the warning ember is a dim glow, the flare is the flare. It reaches
   * half again as far as the flame is tall, which keeps the *bright* part well
   * inside the killing column — a hazard whose light is wider than the hazard
   * would be teaching the wrong edge.
   */
  get light() {
    if (this.height <= 0) return null;
    const warn = this.phase === 'warn';
    return light(this.x + 8, this.floorY - this.height / 2,
      20 + this.height * 0.85, warn ? 0.3 : 0.95);
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

/*
 * The boss's spine cycle, in frames at 60 Hz. Three beats, always in this
 * order, never random:
 *
 *   open (stompable) -> telegraph (stompable, crown going on, sound) -> spiky
 *
 * The telegraph is the whole reason this is a pattern and not a trap. It is
 * still stompable while the crown is going on, so a jump started on the last
 * open frame is not punished for a decision that was correct when it was made.
 *
 * What tightens as the boss loses health is the length of the open window, and
 * nothing else: same beats, same order, same warning, less room. A cycle that
 * changed shape when you hurt it would have to be learned twice.
 */
const SPIKE_TELEGRAPH = 48;
const SPIKE_ON = 132;
const SPIKE_OPEN = 180;
const SPIKE_OPEN_STEP = 24;
const SPIKE_OPEN_MIN = 120;
/*
 * Taking the crown off again is the first stretch of the open window, not a
 * beat of its own: adding a fourth phase would have lengthened the cycle and
 * quietly changed the fight. Nothing about who can be stomped when moves — the
 * boss is stompable from the first frame of `open`, exactly as before, and this
 * only says how long his hands take to put the thing away.
 *
 * The points themselves are gone within the first quarter of it (see
 * CROWN_SPINES in the sprite), sooner than the eight frames the old retract
 * took, so "visible points mean danger" got tighter rather than looser.
 */
const SPIKE_DOFF = 20;

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
    this.maxHp = this.hp;
    // Starts open, so the first thing the player ever sees this boss do is the
    // thing they are supposed to do back.
    this.spikePhase = 'open';
    this.spikeTimer = SPIKE_OPEN;
    // Counts the take-it-off animation down. Zero at spawn on purpose: a boss
    // that started mid-doff would open the fight wearing the one thing that is
    // supposed to mean "not now".
    this.doffTimer = 0;
  }

  get giant() { return this.variant === 3; }

  /** How long the vulnerable window is at the current health. */
  get openFrames() {
    return Math.max(SPIKE_OPEN_MIN, SPIKE_OPEN - (this.maxHp - this.hp) * SPIKE_OPEN_STEP);
  }

  get spiky() { return this.spikePhase === 'spiky'; }

  /**
   * 0..1 for the drawing: one clock for the whole crown, run up through the
   * telegraph and back down through the doff. The sprite reads every keyframe
   * — hands, band, points — off this single number.
   */
  get crownOn() {
    if (this.spikePhase === 'spiky') return 1;
    if (this.spikePhase === 'telegraph') return 1 - this.spikeTimer / SPIKE_TELEGRAPH;
    return Math.max(0, this.doffTimer / SPIKE_DOFF);
  }

  updateSpikes() {
    if (this.doffTimer > 0) this.doffTimer--;
    if (--this.spikeTimer > 0) return;
    if (this.spikePhase === 'open') {
      this.spikePhase = 'telegraph';
      this.spikeTimer = SPIKE_TELEGRAPH;
      Sfx.play('spikes');
      this.level.shake(1);
    } else if (this.spikePhase === 'telegraph') {
      this.spikePhase = 'spiky';
      this.spikeTimer = SPIKE_ON;
    } else {
      this.spikePhase = 'open';
      this.spikeTimer = this.openFrames;
      this.doffTimer = SPIKE_DOFF;
      Sfx.play('pipe');
    }
  }

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

    this.updateSpikes();

    /*
     * While the spines are out it stops hunting and just barrels along, turning
     * at walls. That is not decoration: a boss that chases with points up can
     * pin a powerless player against the end of the arena with nothing to do
     * about it, and the promise is that this fight is winnable at the smallest
     * size. Blind, it can always be walked around.
     */
    if (player && this.charging <= 0 && !this.spiky) {
      this.facing = player.cx < this.cx ? -1 : 1;
    }

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
    if (this.variant >= 2 && this.onGround && !this.spiky && --this.chargeTimer <= 0) {
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
    drawBoss(ctx, this.x - 1, this.y, frame, this.facing, this.invuln > 0, this.variant,
      this.scale, this.crownOn);
  }
}

/*
 * PAPUPAROONI — the desert mini-boss, and there are always two of them.
 *
 * The barons are the pieruprinssi's tax collectors in the dunes, and what they
 * are collecting is beans. Between them they are sitting on the only
 * paukkupapu in the game (see POWER_TYPES in player.js): beat both, and the
 * last one drops it. Nothing else in the game hands that power-up out, which is
 * why the drop is written here and not in `rollPowerup` — a block that could
 * roll it would make the whole fight optional.
 *
 * What makes it a fight rather than an enemy, in three decisions:
 *
 *   - **Two of them, on separate plinths.** One thrower is a timing puzzle; two
 *     is a crossfire, and the arena has to be read rather than walked through.
 *     They also share one drop, so beating the first one is progress and not a
 *     reward — the fight has a middle.
 *   - **Two health each, and a stomp still works.** Every boss in this game is
 *     beatable at power level 0 and this one is no exception: the default
 *     answer is the right answer, it just has to land twice. Spines would have
 *     closed that door, and the door is the promise.
 *   - **The throw is telegraphed.** The bean goes up over the baron's head for
 *     half a second before it leaves, and the arc is slow. What can hurt you has
 *     to be visible (DESIGN.md 7), and a lobbed thing you cannot destroy has to
 *     be a thing you can read.
 */
/** Frames between lobs, and how long the arm is up before one leaves. */
const BARON_THROW = 132;
const BARON_WINDUP = 34;
/** How close the player has to be to be worth a bean. */
const BARON_RANGE = 210;
/**
 * And how far from its plinth a baron will wander. Measured against the arena
 * rather than picked: a plinth is five tiles (80 px) and a baron is 18 px wide,
 * so 28 px either side of the middle is as far as one can go with its whole
 * body still on the stone. Further than that it teeters over the edge, which
 * looks like a bug in the fight rather than a boss taking a step.
 */
const BARON_PATROL = 28;
/** The lob: rise, gravity, and the ceiling on how hard one can be thrown. */
const BOMB_LIFT = -4.2;
const BOMB_GRAVITY = 0.18;
const BOMB_FLIGHT = (2 * -BOMB_LIFT) / BOMB_GRAVITY;
const BOMB_MAX_VX = 3.0;

/**
 * Papupommi — a bean thrown by a baron, arcing, bouncing once, and bursting.
 *
 * A hazard rather than an enemy, and that is the same call `Heartburn` makes:
 * it cannot be stomped, trapped or killed, so calling it an enemy would put it
 * in every loop that offers the player a way to remove it and then refuse. The
 * answer to it is to not be there.
 */
export class BeanBomb extends Entity {
  constructor(level, x, y, vx) {
    super(level, x, y, 10, 10);
    this.kind = 'hazard';
    this.vx = vx;
    this.vy = BOMB_LIFT;
    this.bounces = 1;
    this.life = 260;
    this.active = true;
    Sfx.play('squeak');
  }

  burst() {
    this.remove = true;
    this.level.spawnPuff(this.cx, this.cy, true);
    Sfx.play('pop');
  }

  update() {
    this.tick++;
    if (--this.life <= 0) {
      this.burst();
      return;
    }
    if (moveX(this, this.level)) {
      this.burst();
      return;
    }
    this.vy = Math.min(this.vy + BOMB_GRAVITY, 5);
    const hit = moveY(this, this.level);
    // One bounce, so a bean that lands short is still a thing to step over for
    // a moment. The second landing is where it goes off.
    if (hit.ground) {
      if (this.bounces-- > 0) this.vy = -2.4;
      else this.burst();
    }
    if (hit.ceiling) this.vy = 0.5;
    if (this.y > this.level.heightPx + 16) this.remove = true;
  }

  draw(ctx) {
    drawBeanBomb(ctx, this.x, this.y, this.tick);
  }
}

export class BeanBaron extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 18, 26);
    this.speed = 0.45;
    this.score = 2000;
    this.hp = 2;
    this.invuln = 0;
    this.throwTimer = BARON_THROW;
    this.windup = 0;
    this.hopTimer = 70 + Math.floor(Math.random() * 60);
    /* Where it was put. A baron that wandered off would take the game's only
     * paukkupapu with it — and, worse, could follow the player to the flag,
     * which turns an arena into an escort. Same reasoning as the boss's
     * out-of-bounds catch, applied before it happens rather than after. */
    this.homeX = x;
    /* Part of the level's state, not scenery near the camera: the drop must not
     * be tidied away because the player backtracked past the arena. */
    this.alwaysActive = true;
    this.active = true;
  }

  /* A bubble would carry a mini-boss off its plinth and hand the player the
   * kill for one shot. It takes its hits like the sun does: two, from
   * anything. */
  get bubbleable() { return false; }

  takeHit(dir) {
    if (this.invuln > 0 || this.dying) return;
    this.hp--;
    this.invuln = 48;
    this.windup = 0;
    this.throwTimer = Math.max(this.throwTimer, 40);
    if (this.hp > 0) {
      Sfx.play('bump');
      return;
    }
    this.defeat(dir);
  }

  hitByProjectile(dir) { this.takeHit(dir); }
  hitByShell(dir) { this.takeHit(dir); }
  hitByTail(dir) { this.takeHit(dir); }

  stomp() {
    this.takeHit(this.facing * -1 || 1);
    return true;
  }

  /**
   * The end of the fight — but only when it is the end of the fight.
   *
   * The prize belongs to the pair and not to either baron, so it is the last
   * one standing that drops it. Checking for a live sibling rather than
   * counting kills means a baron removed some other way (a save state loaded
   * mid-fight, a fall out of the world) cannot leave the drop owed to nobody.
   */
  defeat(dir) {
    this.tumble(dir);
    this.level.awardScore(this.score, this.cx, this.y);
    const other = this.level.entities.some((e) => e instanceof BeanBaron
      && e !== this && !e.dying && !e.remove);
    if (other) {
      Sfx.play('kick');
      return;
    }
    this.level.add(new Item(this.level, this.cx - 8, this.y + 2, 'pop', { emerge: false }));
    this.level.addScorePop(this.cx, this.y - 12, 'PAUKKUPAPU');
    this.level.shake(3);
    Sfx.play('powerup');
  }

  /** Lobs one bean at where the player is standing. @returns the bomb. */
  throwBomb() {
    const player = this.level.player;
    const dx = player ? player.cx - this.cx : 80 * this.facing;
    const aim = Math.max(-BOMB_MAX_VX, Math.min(BOMB_MAX_VX, dx / BOMB_FLIGHT));
    if (aim !== 0) this.facing = Math.sign(aim);
    const bomb = new BeanBomb(this.level, this.cx - 5, this.y - 6, aim);
    this.level.add(bomb);
    return bomb;
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.invuln > 0) this.invuln--;

    const player = this.level.player;
    const near = player && Math.abs(player.cx - this.cx) < BARON_RANGE;

    if (this.windup > 0) {
      // Rooted while the arm is up: the telegraph is a promise about where the
      // throw comes from, and a baron that walked during it would break it.
      this.vx = 0;
      if (--this.windup === 0) this.throwBomb();
    } else {
      if (near && --this.throwTimer <= 0) {
        this.windup = BARON_WINDUP;
        this.throwTimer = BARON_THROW + Math.floor(Math.random() * 50);
        this.facing = player.cx < this.cx ? -1 : 1;
        Sfx.play('boss');
      }
      this.vx = this.speed * this.facing;
      if (moveX(this, this.level)) this.facing *= -1;
      // Careful about ledges like the shell walkers, and kept near home on top
      // of that: the terrain answer alone would let one hop off its plinth.
      if (this.onGround
        && !footingAhead(this.level, this.x + this.facing * 3, this.y, this.w, this.h)) {
        this.facing *= -1;
      }
      if (Math.abs(this.x - this.homeX) > BARON_PATROL) {
        this.facing = Math.sign(this.homeX - this.x) || 1;
      }
      // A hop, so a stomp is a matter of timing rather than of walking up to it.
      if (this.onGround && --this.hopTimer <= 0) {
        this.vy = -3.6;
        this.hopTimer = 80 + Math.floor(Math.random() * 70);
      }
    }

    applyGravity(this, 0.95);
    moveY(this, this.level);
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  draw(ctx) {
    const frame = Math.floor(this.tick / 7);
    const lift = this.windup > 0 ? 1 - this.windup / BARON_WINDUP : 0;
    if (this.dying) {
      this.drawFlipped(ctx, () => drawBeanBaron(ctx, this.x, this.y, frame, this.facing, 0, false));
      return;
    }
    drawBeanBaron(ctx, this.x, this.y, frame, this.facing, lift,
      this.invuln > 0 && Math.floor(this.tick / 3) % 2 === 0);
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
    /*
     * It *drops* the prize, rather than budding one out of its own top.
     * `emerge` is the question-block animation — an item pushing up out of a
     * brick — and a moon hanging in the night sky is not a brick. Spawned just
     * below it and left to fall, which is also where the player already is:
     * they have just bounced off the top of it.
     */
    this.level.add(new Item(this.level, this.x + 2, this.y + 14,
      this.level.rollPowerup(this.level.player), { emerge: false }));
    this.level.spawnPuff(this.cx, this.y + 16);
    this.level.awardScore(this.score, this.cx, this.y);
    Sfx.play('powerup');
    return true;
  }

  hitByProjectile() { /* it is the moon */ }
  hitByShell() { }
  hitByTail() { }

  /**
   * It already draws a halo; a moon that hung in a dark sky without lighting
   * anything would be a picture of a moon. Weak and wide: it is a landmark you
   * steer by from across the level, not a lamp — the ground under it stays dim
   * enough that you still want to be standing in your own light.
   *
   * It breathes on the same beat as the halo, and goes down to almost nothing
   * once it has paid out, so a spent moon stops being a place worth going.
   */
  get light() {
    return light(this.cx, this.cy, 64,
      this.used ? 0.16 : 0.42 + 0.04 * Math.sin(this.tick / 14));
  }

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
  x: (level, tx, ty) => new SpikeGuy(level, tx * TILE, ty * TILE),
  A: (level, tx, ty) => new AngrySun(level, tx * TILE, ty * TILE),
  H: (level, tx, ty) => new Heartburn(level, tx * TILE, (ty + 1) * TILE),
  b: (level, tx, ty, variant) => new Boss(level, tx * TILE, ty * TILE, variant),
  O: (level, tx, ty) => new Moon(level, tx * TILE, ty * TILE),
  /* The baron is taller than a tile, so its marker is the square it *stands
   * in*: the body is hung from the bottom of that square rather than dropped
   * from its top. Chunks then read the way the eye reads them, and the
   * "enemies inside walls" check in verify.mjs — which looks at the tile under
   * the sprite's feet — is asking about the tile the level author meant. */
  P: (level, tx, ty) => new BeanBaron(level, tx * TILE - 1, (ty + 1) * TILE - 26),
};
