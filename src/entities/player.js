import { Entity } from './entity.js';
import {
  moveX, moveY, GRAVITY, GRAVITY_HELD, GRAVITY_HELD_CUTOFF, TERMINAL,
} from '../level/physics.js';
import { drawPlayer, drawCork, PLAYER_SIZES, PLAYER_DUCK_SIZES, TINTS } from '../gfx/sprites.js';
import { FartBall } from './items.js';
import { Sfx } from '../core/audio.js';
import { approach } from '../core/utils.js';
import { T } from '../gfx/tiles.js';

/*
 * Movement constants from the SMB3 disassembly. Raw bytes are 4.4 fixed point,
 * so the comment gives the original and the value is that byte over 16.
 *
 * Three of these are the ones that actually change how the game feels:
 *   - running does NOT accelerate harder than walking, it only lifts the cap
 *   - there is no air friction at all, so speed carries through a whole jump
 *   - the jump gets a small discrete bonus per whole pixel of ground speed,
 *     not a smooth one, so there are exactly four jump heights
 */
const MAX_WALK = 1.5;          // $18
const MAX_RUN = 2.5;           // $28
const MAX_P = 3.5;             // $38
const MAX_SPEED = 4.0;         // $40, the hard clamp
const ACC = 0.0547;            // $00 + $E0/256, identical with and without B
const FRICTION_SMALL = 0.0391; // -$01 + $60/256
const FRICTION_BIG = 0.0547;   // -$01 + $20/256
const SKID = 0.125;            // $02
const JUMP_BASE = -3.5;        // -$38
/** Player_SpeedJumpInc: extra lift per whole pixel/frame of ground speed. */
const JUMP_SPEED_BONUS = [0, 0.125, 0.25, 0.5];
const STOMP_BOUNCE = -4.0;     // -$40
const TAIL_FLOAT = 1.0;        // PLAYER_TAILWAG_YVEL $10
const FLIGHT_CLIMB = -1.5;     // PLAYER_FLY_YVEL -$18
/*
 * SMB3 has neither coyote time nor jump buffering: a press one frame early or
 * one frame late is simply gone. That is faithful, and on a CRT with a wired
 * pad it is fine. On a modern setup — wireless keyboard, compositor, LCD — the
 * same rule turns into "the game ignored me", so both forgivenesses are here
 * as a deliberate deviation from the original. They are small enough that a
 * frame-perfect player will never notice them.
 */
const COYOTE_FRAMES = 5;
const JUMP_BUFFER_FRAMES = 6;

export const P_METER_MAX = 112;
const P_SEGMENTS = 7;
/** 7 segments, 8 frames each to fill and 24 each to drain. */
const P_FILL = P_METER_MAX / P_SEGMENTS / 8;
const P_DRAIN = P_METER_MAX / P_SEGMENTS / 24;

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
    this.idle = 0;
    this.jumpBuffer = 0;
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
    // A press is remembered for a few frames, so asking for a jump just before
    // landing gets you a jump on landing instead of nothing at all.
    if (this.controllable && input.pressed.jump) this.jumpBuffer = JUMP_BUFFER_FRAMES;
    else if (this.jumpBuffer > 0) this.jumpBuffer--;
    const jumpPressed = this.jumpBuffer > 0;
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
    const friction = this.big ? FRICTION_BIG : FRICTION_SMALL;

    if (this.ducking) {
      this.vx = approach(this.vx, 0, friction * 1.4);
    } else if (dir !== 0) {
      const skidding = this.onGround && Math.sign(this.vx) === -dir && Math.abs(this.vx) > 0.2;
      this.vx = approach(this.vx, cap * dir, skidding ? SKID : ACC);
      if (Math.abs(this.vx) > cap && this.onGround) this.vx = approach(this.vx, cap * dir, 0.06);
      this.facing = dir;
    } else if (this.onGround) {
      // No air friction: let go of everything mid-jump and you keep your speed.
      this.vx = approach(this.vx, 0, friction);
    }
    this.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.vx));

    /* ------------------------------- P-meter -------------------------- */
    const atSpeed = Math.abs(this.vx) >= MAX_RUN - 0.05 && run;
    if (this.onGround) {
      this.pMeter = atSpeed
        ? Math.min(P_METER_MAX, this.pMeter + P_FILL)
        : Math.max(0, this.pMeter - P_DRAIN);
    } else if (this.flying > 0) {
      this.pMeter = Math.max(0, this.pMeter - P_DRAIN);   // flight burns the gauge
    }
    // Otherwise the gauge is frozen: SMB3 leaves it alone while you are airborne.

    /* -------------------------------- jump ---------------------------- */
    if (this.onGround) {
      this.coyote = COYOTE_FRAMES;
      this.airJumps = 0;
    } else if (this.coyote > 0) this.coyote--;

    const canFly = this.type === 'leaf' && this.pFull && !this.corked;
    if (jumpPressed && (this.onGround || this.coyote > 0)) {
      this.jumpBuffer = 0;
      this.vy = JUMP_BASE - JUMP_SPEED_BONUS[Math.min(3, Math.floor(Math.abs(this.vx)))];
      this.onGround = false;
      this.coyote = 0;
      this.jumpHeld = true;
      Sfx.play(this.big ? 'bigjump' : 'jump');
    } else if (jumpPressed && canFly && this.flying <= 0) {
      this.jumpBuffer = 0;
      this.flying = 180 + this.power.level * 30;     // take off
      this.vy = -2.6;
      Sfx.play('flight');
    } else if (jumpPressed && this.flying > 0) {
      this.vy = Math.max(FLIGHT_CLIMB, this.vy - 2.6);
      Sfx.play('flight');
    } else if (jumpPressed && this.airJumps < this.airJumpsMax) {
      this.jumpBuffer = 0;
      this.fartJump();
    }

    if (!jumpHeld) this.jumpHeld = false;

    if (this.flying > 0) {
      this.flying--;
      // Flight ends on landing or when the gauge runs dry.
      if (this.onGround || this.pMeter <= 0) this.flying = 0;
    }

    /* ------------------------------- gravity -------------------------- */
    let g = this.jumpHeld && this.vy < GRAVITY_HELD_CUTOFF ? GRAVITY_HELD : GRAVITY;
    if (this.flying > 0) g *= 0.45;
    this.vy = Math.min(this.vy + g, TERMINAL);
    // The tail lets you float down gently.
    if (this.type === 'leaf' && !this.corked && jumpHeld && this.vy > 1.1 && this.flying <= 0) {
      this.vy = Math.min(this.vy, TAIL_FLOAT);
      this.wag += 0.4;
    }

    /* -------------------------------- attack -------------------------- */
    if (this.controllable && input.pressed.run && !this.corked) {
      if (this.type === 'flower') this.shoot();
      else if (this.type === 'leaf') {
        this.spin = 18;
        Sfx.play('squeak');
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
    // How long the player has been standing perfectly still, which is what
    // drives the idle performance in the sprite.
    if (this.onGround && Math.abs(this.vx) < 0.05 && dir === 0 && !this.ducking) this.idle++;
    else this.idle = 0;

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
    Sfx.play(this.power.level >= 3 ? 'bigfart' : 'fart');
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

  bounce() {
    // Flat in SMB3; holding the button pays off through the low ascent gravity.
    this.vy = STOMP_BOUNCE;
    this.onGround = false;
    this.airJumps = 0;
  }

  /** Ummetus: corks the gas off for a while. Not damage, but it stings. */
  cork(frames = 380) {
    if (this.invuln > 0 || this.dying) return false;
    this.corked = Math.max(this.corked, frames);
    this.flying = 0;
    this.spin = 0;
    Sfx.play('cork');
    this.level.addScorePop(this.cx, this.y - 8, 'UMMETUS');
    return true;
  }

  /** @returns true when the hit actually landed (i.e. not invulnerable). */
  hurt(cause = 'enemy') {
    if (this.invuln > 0 || this.dying || this.frozen > 0) return false;
    if (this.power.level === 0) {
      this.die(cause);
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
          // Swapping to a different power banks the one you were wearing.
          // Losing a tail just because you walked into a mushroom is the kind
          // of thing that feels like the game cheated you.
          if (this.power.type && this.power.type !== itemKind) {
            this.level.storeReserve(this.power.type);
          }
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
        Sfx.play('soup');
        break;
      }
      case 'oneup':
        this.level.gainLife(this.cx, this.y);
        break;
      default:
        break;
    }
  }

  /** `cause` is only carried through to telemetry; it changes nothing in play. */
  die(cause = 'enemy') {
    if (this.dying) return;
    this.dying = true;
    this.noclip = true;
    this.controllable = false;
    this.vy = -6.6;
    this.vx = 0;
    this.flying = 0;
    Sfx.play('die');
    this.level.onPlayerDied(cause);
  }

  state() {
    if (this.dying) return 'jump';
    if (this.ducking) return 'duck';
    if (!this.onGround) return 'jump';
    if (Math.abs(this.vx) > 0.1) return 'walk';
    return 'idle';
  }

  draw(ctx) {
    // Being frozen and being invulnerable used to look identical, because
    // neither had a picture: the sprite just vanished every other frame. The
    // flicker still reads as i-frames, but the character stays on screen and
    // the freeze after a power change is now its own colour.
    let tint = null;
    if (this.frozen > 0) tint = TINTS.frozen;
    else if (this.invuln > 0 && Math.floor(this.tick / 2) % 2 === 0) tint = TINTS.flash;
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
      idle: this.idle,
      tint,
    });
    if (this.corked > 0) {
      drawCork(ctx, this.x + this.w / 2 - 4, this.y - 10, this.tick);
    }
  }
}

export { MAX_WALK, MAX_RUN, MAX_P };
