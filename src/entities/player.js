import { Entity } from './entity.js';
import { moveX, moveY, GRAVITY, GRAVITY_HELD, TERMINAL } from '../level/physics.js';
import { drawPlayer, drawCork, PLAYER_SIZES, PLAYER_DUCK_SIZES } from '../gfx/sprites.js';
import { FartBall } from './items.js';
import { Sfx } from '../core/audio.js';
import { approach } from '../core/utils.js';
import { T } from '../gfx/tiles.js';

const MAX_WALK = 1.55;
const MAX_RUN = 2.70;
const MAX_P = 3.30;
const ACC_WALK = 0.085;
const ACC_RUN = 0.125;
const FRICTION = 0.10;
const SKID = 0.30;
const JUMP_BASE = -4.75;

export const P_METER_MAX = 112;
const P_SEGMENTS = 7;

export const MAX_POWER_LEVEL = 5;
export const POWER_TYPES = ['shroom', 'flower', 'leaf'];
export const POWER_NAMES = {
  shroom: 'PIERUSIENI',
  flower: 'PIERUKUKKA',
  leaf: 'KAASULEHTI',
};

/** Power-ups stack: the level drives both body size and ability strength. */
export const makePower = (type = null, level = 0) => ({ type, level });

/** Accepts old string saves as well as the current {type, level} shape. */
export function normalizePower(power) {
  if (!power) return makePower();
  if (typeof power === 'string') {
    if (power === 'small') return makePower();
    if (power === 'big' || power === 'bean' || power === 'shroom') return makePower('shroom', 1);
    return makePower(power, 1);
  }
  const level = Math.max(0, Math.min(MAX_POWER_LEVEL, power.level | 0));
  return makePower(level === 0 ? null : power.type, level);
}

/** Pure power-up rule, shared by the level and the world map inventory. */
export function powerAfterItem(power, kind) {
  const p = normalizePower(power);
  if (kind === 'soup') {
    return makePower(p.type || 'shroom', Math.min(MAX_POWER_LEVEL, p.level + 1));
  }
  if (POWER_TYPES.includes(kind)) {
    return makePower(kind, Math.min(MAX_POWER_LEVEL, p.level + 1));
  }
  return p;
}

export class Player extends Entity {
  constructor(level, x, y, power) {
    super(level, x, y, PLAYER_SIZES[0].w, PLAYER_SIZES[0].h);
    this.kind = 'player';
    this.alwaysActive = true;
    this.active = true;
    this.power = normalizePower(power);
    this.facing = 1;
    this.ducking = false;
    this.pMeter = 0;
    this.flying = 0;
    this.spin = 0;
    this.invuln = 0;
    this.frozen = 0;
    this.corked = 0;
    this.airJumps = 0;
    this.dying = false;
    this.animTimer = 0;
    this.animFrame = 0;
    this.wag = 0;
    this.autoWalk = false;
    this.controllable = true;
    this.jumpHeld = false;
    this.coyote = 0;
    this.applySize();
    this.y = y - this.h;   // spawn standing on the given tile top
  }

  // NB: `this.level` is the LevelScene (from Entity) — the power level lives here.
  get powerLevel() { return this.power.level; }
  get type() { return this.power.type; }
  get big() { return this.power.level > 0; }
  get pFull() { return this.pMeter >= P_METER_MAX; }
  get pBars() { return Math.min(P_SEGMENTS, Math.floor(this.pMeter / (P_METER_MAX / P_SEGMENTS))); }

  /** Extra mid-air jumps granted by the fart mushroom, one per level. */
  get airJumpsMax() { return this.type === 'shroom' && !this.corked ? this.power.level : 0; }
  get shotsPerPress() { return this.power.level >= 5 ? 3 : this.power.level >= 3 ? 2 : 1; }
  get maxLiveShots() { return 2 + this.power.level; }
  get tailReach() { return 10 + this.power.level * 2; }

  applySize() {
    const table = this.ducking && this.power.level > 0 ? PLAYER_DUCK_SIZES : PLAYER_SIZES;
    const box = table[this.power.level];
    const bottom = this.y + (this.h || box.h);
    this.w = box.w;
    this.h = box.h;
    this.y = bottom - this.h;
  }

  /** Extra reach of the tail spin, used for enemy hits. */
  get spinBox() {
    if (this.spin <= 0) return null;
    const reach = this.tailReach;
    return {
      x: this.facing > 0 ? this.x + this.w - 2 : this.x - reach + 2,
      y: this.y + this.h * 0.4,
      w: reach,
      h: this.h * 0.6,
    };
  }

  update(input) {
    this.tick++;
    if (this.invuln > 0) this.invuln--;
    if (this.spin > 0) this.spin--;
    if (this.corked > 0) this.corked--;
    if (this.wag !== 0 || this.type === 'leaf') this.wag += this.flying > 0 ? 0.5 : 0.12;

    if (this.dying) {
      this.vy = Math.min(this.vy + 0.32, 9);
      this.y += this.vy;
      return;
    }

    if (this.frozen > 0) {
      this.frozen--;
      this.vx = 0;
      this.vy = Math.min(this.vy + GRAVITY, TERMINAL);
      moveY(this, this.level);
      return;
    }

    const left = this.controllable ? input.held.left : false;
    const right = this.controllable ? input.held.right || this.autoWalk : this.autoWalk;
    const down = this.controllable ? input.held.down : false;
    const run = this.controllable ? input.held.run : false;
    const jumpPressed = this.controllable ? input.pressed.jump : false;
    const jumpHeld = this.controllable ? input.held.jump : false;

    /* -------------------------------- ducking ------------------------- */
    const wantDuck = this.big && down && this.onGround;
    if (wantDuck !== this.ducking) {
      const wasDucking = this.ducking;
      this.ducking = wantDuck;
      if (wasDucking && this.headBlocked()) this.ducking = true;
      else this.applySize();
    }

    /* ------------------------------ horizontal ------------------------ */
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    const cap = this.pFull ? MAX_P : run ? MAX_RUN : MAX_WALK;
    const airControl = this.onGround ? 1 : 0.75;

    if (this.ducking) {
      this.vx = approach(this.vx, 0, FRICTION * 1.4);
    } else if (dir !== 0) {
      const skidding = this.onGround && Math.sign(this.vx) === -dir && Math.abs(this.vx) > 0.2;
      const acc = skidding ? SKID : (run ? ACC_RUN : ACC_WALK) * airControl;
      this.vx = approach(this.vx, cap * dir, acc);
      if (Math.abs(this.vx) > cap && this.onGround) this.vx = approach(this.vx, cap * dir, 0.06);
      this.facing = dir;
    } else if (this.onGround) {
      this.vx = approach(this.vx, 0, FRICTION);
    }

    /* ------------------------------- P-meter -------------------------- */
    const atSpeed = Math.abs(this.vx) >= MAX_RUN - 0.15 && run;
    if (this.onGround) {
      this.pMeter = atSpeed
        ? Math.min(P_METER_MAX, this.pMeter + 2)
        : Math.max(0, this.pMeter - 1.6);
    } else if (this.flying > 0) {
      this.pMeter = Math.max(0, this.pMeter - 0.5);   // flight burns the gauge
    } else if (this.pFull) {
      // Stays pinned in mid-air so the take-off window survives the jump.
    } else {
      this.pMeter = Math.max(0, this.pMeter - 0.9);
    }

    /* -------------------------------- jump ---------------------------- */
    if (this.onGround) {
      this.coyote = 5;
      this.airJumps = 0;
    } else if (this.coyote > 0) this.coyote--;

    const canFly = this.type === 'leaf' && this.pFull && !this.corked;
    if (jumpPressed && (this.onGround || this.coyote > 0)) {
      this.vy = JUMP_BASE - Math.abs(this.vx) * 0.28;
      this.onGround = false;
      this.coyote = 0;
      this.jumpHeld = true;
      Sfx.play(this.big ? 'bigjump' : 'jump');
    } else if (jumpPressed && canFly && this.flying <= 0) {
      this.flying = 180 + this.power.level * 30;     // take off
      this.vy = -2.6;
      Sfx.play('flight');
    } else if (jumpPressed && this.flying > 0) {
      this.vy = Math.max(-3.0 - this.power.level * 0.1, this.vy - 2.6);
      Sfx.play('flight');
    } else if (jumpPressed && this.airJumps < this.airJumpsMax) {
      this.fartJump();
    }

    if (!jumpHeld) this.jumpHeld = false;

    if (this.flying > 0) {
      this.flying--;
      // Flight ends on landing or when the gauge runs dry.
      if (this.onGround || this.pMeter <= 0) this.flying = 0;
    }

    /* ------------------------------- gravity -------------------------- */
    let g = this.jumpHeld && this.vy < 0 ? GRAVITY_HELD : GRAVITY;
    if (this.flying > 0) g *= 0.45;
    this.vy = Math.min(this.vy + g, TERMINAL);
    // The tail lets you float down gently.
    if (this.type === 'leaf' && !this.corked && jumpHeld && this.vy > 1.1 && this.flying <= 0) {
      this.vy = Math.max(0.6, 1.2 - this.power.level * 0.1);
      this.wag += 0.4;
    }

    /* -------------------------------- attack -------------------------- */
    if (this.controllable && input.pressed.run && !this.corked) {
      if (this.type === 'flower') this.shoot();
      else if (this.type === 'leaf') {
        this.spin = 18;
        Sfx.play('fart');
      }
    }

    /* -------------------------------- move ---------------------------- */
    const chargeVx = this.vx;
    moveX(this, this.level);
    if (this.power.level >= 4 && Math.abs(chargeVx) > 1.4 && this.vx === 0) this.smashThrough(chargeVx);
    moveY(this, this.level, {
      onHeadBump: (tx, ty) => this.level.bumpTile(tx, ty, this),
      dropThrough: down && !this.onGround,
    });

    /* ------------------------------ animation ------------------------- */
    const speed = Math.abs(this.vx);
    if (this.onGround && speed > 0.1) {
      this.animTimer += 0.12 + speed * 0.14;
      if (this.animTimer >= 1) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 3;
      }
    } else if (this.onGround) {
      this.animFrame = 0;
    }
  }

  /** Mid-air fart jump: a burst of gas that also knocks out whatever is below. */
  fartJump() {
    this.airJumps++;
    this.vy = -4.3;
    this.jumpHeld = true;
    this.onGround = false;
    Sfx.play('fart');
    this.level.fartBlast(this.cx, this.y + this.h, 20 + this.power.level * 3, this);
  }

  /** Level 4+ is heavy enough to plough straight through bricks. */
  smashThrough(dirVx) {
    const dir = Math.sign(dirVx);
    const tx = Math.floor((dir > 0 ? this.x + this.w + 1 : this.x - 1) / 16);
    const y0 = Math.floor(this.y / 16);
    const y1 = Math.floor((this.y + this.h - 1) / 16);
    let smashed = false;
    for (let ty = y0; ty <= y1; ty++) {
      if (this.level.tileAt(tx, ty) === T.BRICK) {
        this.level.smashBrick(tx, ty);
        smashed = true;
      }
    }
    if (smashed) this.vx = dirVx * 0.6;
  }

  headBlocked() {
    const target = PLAYER_SIZES[this.power.level].h;
    const top = this.y + this.h - target;
    const ty = Math.floor(top / 16);
    const x0 = Math.floor(this.x / 16);
    const x1 = Math.floor((this.x + this.w - 1) / 16);
    for (let tx = x0; tx <= x1; tx++) {
      if (this.level.solidAt(tx, ty)) return true;
    }
    return false;
  }

  shoot() {
    const live = this.level.entities.filter((e) => e instanceof FartBall && !e.remove).length;
    if (live >= this.maxLiveShots) return;
    const x = this.facing > 0 ? this.x + this.w : this.x - 8;
    const spread = this.shotsPerPress;
    for (let i = 0; i < spread; i++) {
      const ball = new FartBall(this.level, x, this.y + this.h * 0.45, this.facing);
      if (i === 1) ball.vy = -2.2;
      if (i === 2) ball.vy = 2.4;
      this.level.add(ball);
    }
  }

  bounce(strong) {
    this.vy = strong ? -5.4 : -3.6;
    this.onGround = false;
    this.airJumps = 0;
  }

  /** Ummetus: corks the gas off for a while. Not damage, but it stings. */
  cork(frames = 380) {
    if (this.invuln > 0 || this.dying) return false;
    this.corked = Math.max(this.corked, frames);
    this.flying = 0;
    this.spin = 0;
    Sfx.play('bump');
    this.level.addScorePop(this.cx, this.y - 8, 'UMMETUS');
    return true;
  }

  /** @returns true when the hit actually landed (i.e. not invulnerable). */
  hurt() {
    if (this.invuln > 0 || this.dying || this.frozen > 0) return false;
    if (this.power.level === 0) {
      this.die();
      return true;
    }
    this.power = makePower(this.power.level - 1 === 0 ? null : this.power.type,
      this.power.level - 1);
    this.ducking = false;
    this.applySize();
    this.invuln = 110;
    this.frozen = 20;
    this.flying = 0;
    Sfx.play('powerdown');
    this.level.dropReserve();
    return true;
  }

  collect(itemKind) {
    switch (itemKind) {
      case 'shroom':
      case 'flower':
      case 'leaf': {
        const maxed = this.power.level >= MAX_POWER_LEVEL && this.power.type === itemKind;
        if (maxed) {
          this.level.storeReserve(itemKind);
        } else {
          this.power = powerAfterItem(this.power, itemKind);
          this.applySize();
          this.frozen = 18;
          this.corked = 0;
        }
        Sfx.play('powerup');
        this.level.awardScore(1000, this.cx, this.y);
        break;
      }
      case 'soup': {
        // Hernekeitto: one more level of whatever you are, and it cures ummetus.
        if (this.power.level >= MAX_POWER_LEVEL) {
          this.level.awardScore(5000, this.cx, this.y);
        } else {
          this.power = powerAfterItem(this.power, 'soup');
          this.applySize();
          this.frozen = 18;
          this.level.awardScore(1000, this.cx, this.y);
        }
        this.corked = 0;
        Sfx.play('powerup');
        break;
      }
      case 'oneup':
        this.level.gainLife(this.cx, this.y);
        break;
      default:
        break;
    }
  }

  die() {
    if (this.dying) return;
    this.dying = true;
    this.noclip = true;
    this.controllable = false;
    this.vy = -6.6;
    this.vx = 0;
    this.flying = 0;
    Sfx.play('die');
    this.level.onPlayerDied();
  }

  state() {
    if (this.dying) return 'jump';
    if (this.ducking) return 'duck';
    if (!this.onGround) return 'jump';
    if (Math.abs(this.vx) > 0.1) return 'walk';
    return 'idle';
  }

  draw(ctx) {
    if (this.invuln > 0 && Math.floor(this.tick / 2) % 2 === 0) return;
    const spinning = this.spin > 0;
    drawPlayer(ctx, this.x, this.y, {
      type: this.power.type,
      level: this.power.level,
      facing: spinning ? (Math.floor(this.spin / 3) % 2 ? -this.facing : this.facing) : this.facing,
      frame: this.animFrame,
      state: this.state(),
      ducking: this.ducking,
      running: Math.abs(this.vx) > MAX_WALK,
      tick: this.tick,
      wag: this.wag,
    });
    if (this.corked > 0) {
      drawCork(ctx, this.x + this.w / 2 - 4, this.y - 10, this.tick);
    }
  }
}

export { MAX_WALK, MAX_RUN, MAX_P };
