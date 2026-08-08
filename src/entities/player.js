import { Entity } from './entity.js';
import { moveX, moveY, GRAVITY, GRAVITY_HELD, TERMINAL } from '../level/physics.js';
import { drawPlayer, PLAYER_BOX } from '../gfx/sprites.js';
import { FartBall } from './items.js';
import { Sfx } from '../core/audio.js';
import { approach, clamp } from '../core/utils.js';

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

export class Player extends Entity {
  constructor(level, x, y, power = 'small') {
    super(level, x, y, PLAYER_BOX.small.w, PLAYER_BOX.small.h);
    this.kind = 'player';
    this.alwaysActive = true;
    this.active = true;
    this.power = power;
    this.facing = 1;
    this.ducking = false;
    this.pMeter = 0;
    this.flying = 0;
    this.spin = 0;
    this.invuln = 0;
    this.frozen = 0;
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

  get big() { return this.power !== 'small'; }
  get pFull() { return this.pMeter >= P_METER_MAX; }
  get pBars() { return Math.min(P_SEGMENTS, Math.floor(this.pMeter / (P_METER_MAX / P_SEGMENTS))); }

  applySize() {
    const box = this.ducking && this.big ? PLAYER_BOX.duck : this.big ? PLAYER_BOX.big : PLAYER_BOX.small;
    const bottom = this.y + (this.h || box.h);
    this.w = box.w;
    this.h = box.h;
    this.y = bottom - this.h;
  }

  /** Extra reach of the tail spin, used for enemy hits. */
  get spinBox() {
    if (this.spin <= 0) return null;
    const reach = 10;
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
    if (this.wag !== 0 || this.power === 'leaf') this.wag += this.flying > 0 ? 0.5 : 0.12;

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
    if (this.onGround) this.coyote = 5;
    else if (this.coyote > 0) this.coyote--;

    if (jumpPressed && (this.onGround || this.coyote > 0)) {
      this.vy = JUMP_BASE - Math.abs(this.vx) * 0.28;
      this.onGround = false;
      this.coyote = 0;
      this.jumpHeld = true;
      Sfx.play(this.big ? 'bigjump' : 'jump');
    } else if (jumpPressed && this.power === 'leaf' && this.pFull && this.flying <= 0) {
      this.flying = 260;                       // take off
      this.vy = -2.6;
      Sfx.play('flight');
    } else if (jumpPressed && this.flying > 0) {
      this.vy = Math.max(-3.0, this.vy - 2.6); // flap
      Sfx.play('flight');
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
    if (this.power === 'leaf' && jumpHeld && this.vy > 1.1 && this.flying <= 0) {
      this.vy = 1.1;
      this.wag += 0.4;
    }

    /* -------------------------------- attack -------------------------- */
    if (this.controllable && input.pressed.run) {
      if (this.power === 'flower') this.shoot();
      else if (this.power === 'leaf') {
        this.spin = 18;
        Sfx.play('fart');
      }
    }

    /* -------------------------------- move ---------------------------- */
    moveX(this, this.level);
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

  headBlocked() {
    const saved = this.h;
    this.h = PLAYER_BOX.big.h;
    const y = this.y - (PLAYER_BOX.big.h - saved);
    const ty = Math.floor(y / 16);
    const x0 = Math.floor(this.x / 16);
    const x1 = Math.floor((this.x + this.w - 1) / 16);
    this.h = saved;
    for (let tx = x0; tx <= x1; tx++) {
      if (this.level.solidAt(tx, ty)) return true;
    }
    return false;
  }

  shoot() {
    const live = this.level.entities.filter((e) => e instanceof FartBall && !e.remove).length;
    if (live >= 2) return;
    const x = this.facing > 0 ? this.x + this.w : this.x - 8;
    this.level.add(new FartBall(this.level, x, this.y + this.h * 0.45, this.facing));
  }

  bounce(strong) {
    this.vy = strong ? -5.4 : -3.6;
    this.onGround = false;
  }

  /** @returns true when the hit actually landed (i.e. not invulnerable). */
  hurt() {
    if (this.invuln > 0 || this.dying || this.frozen > 0) return false;
    if (!this.big) {
      this.die();
      return true;
    }
    this.power = this.power === 'big' ? 'small' : 'big';
    this.ducking = false;
    this.applySize();
    this.invuln = 110;
    this.frozen = 20;
    Sfx.play('powerdown');
    this.level.dropReserve();
    return true;
  }

  collect(itemKind) {
    switch (itemKind) {
      case 'bean':
        if (!this.big) {
          this.power = 'big';
          this.applySize();
          this.frozen = 18;
          Sfx.play('powerup');
        } else {
          this.level.storeReserve('bean');
          Sfx.play('powerup');
        }
        this.level.awardScore(1000, this.cx, this.y);
        break;
      case 'flower':
        if (this.power === 'flower') this.level.storeReserve('flower');
        else {
          this.power = 'flower';
          this.applySize();
          this.frozen = 18;
        }
        Sfx.play('powerup');
        this.level.awardScore(1000, this.cx, this.y);
        break;
      case 'leaf':
        if (this.power === 'leaf') this.level.storeReserve('leaf');
        else {
          this.power = 'leaf';
          this.applySize();
          this.frozen = 18;
        }
        Sfx.play('powerup');
        this.level.awardScore(1000, this.cx, this.y);
        break;
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
      power: this.power,
      facing: spinning ? (Math.floor(this.spin / 3) % 2 ? -this.facing : this.facing) : this.facing,
      frame: this.animFrame,
      state: this.state(),
      ducking: this.ducking,
      running: Math.abs(this.vx) > MAX_WALK,
      tick: this.tick,
      wag: this.wag,
    });
  }
}

export { MAX_WALK, MAX_RUN, MAX_P };
