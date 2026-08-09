import { Entity } from './entity.js';
import {
  moveX, moveY, GRAVITY, GRAVITY_HELD, GRAVITY_HELD_CUTOFF, TERMINAL,
} from '../level/physics.js';
import {
  drawPlayer, drawCork, PLAYER_SIZES, PLAYER_DUCK_SIZES, TINTS, STAR_TINTS, GLOWS,
} from '../gfx/sprites.js';
/* Straight from the sprite rather than through the barrel: these two belong to
 * the animation they drive, and there must be exactly one of each. The frame
 * count decides how long a stride is and the dead time decides when the second
 * tier of idle starts — both are the drawing's business, and a copy kept here
 * would go stale the first time either is tuned. */
import { WALK_FRAMES, DEEP_IDLE } from '../gfx/sprites/player.js';
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

/*
 * MAAHANISKU — the ground pound. Down + jump in the air, and the gas that
 * normally lifts him instead shoves him at the floor.
 *
 * The whole move is an argument about price, so the constants are the argument.
 * The stomp is this game's basic verb: it kills, it bounces you clear, and you
 * keep every pixel of steering while it happens. A ground pound that was simply
 * bigger would end the stomp's career on the day it shipped, so this one buys
 * its width and its noise with time in which the player is not driving:
 *
 *   POUND_CHARGE  frames hanging still in the air before the drop. It is also
 *                 the telegraph — the one moment anything on screen has to
 *                 read the move and get out from under it.
 *   POUND_SPEED   the dive, and it is a constant rather than gravity because
 *                 the fiction is a push and not a fall. Nearly twice TERMINAL
 *                 (4.0), so it visibly outruns anything else in the level that
 *                 is falling. Well under one tile per frame, so `moveY` cannot
 *                 skip a floor row: at 16 px a frame a dive would start passing
 *                 through planks.
 *   POUND_LAG_*   and then the landing, where he is stuck and — this is the
 *                 part that matters — *not* invulnerable. The window grows with
 *                 the height of the fall, so the version that hits hardest is
 *                 also the version that leaves you standing there longest. A
 *                 flat lag would have made the best case strictly the best.
 *
 * Nothing here is gated on a power level. Requirement, not preference: a
 * power-up opens places, not the level (DESIGN.md §5), so the base move works
 * at power 0 and the level only widens the reach and lowers the bar for the
 * shockwave — see `LevelScene.poundImpact`, which owns everything that happens
 * once the feet arrive.
 */
const POUND_CHARGE = 12;
const POUND_SPEED = 7.5;
const POUND_LAG_MIN = 16;
const POUND_LAG_RANGE = 20;

/**
 * How hard a dive landed, 0…1, and the one number the impact reads.
 *
 * The scale is normalised against something the engine guarantees rather than
 * against a number somebody picked. `LevelScene.tileAt` answers `T.HARD` for
 * every `ty < 0`, so the sky is a lid and no body's top edge can ever be above
 * y = 0. The greatest fall that could possibly end at `toY` is therefore `toY`
 * itself, measured in the same pixels as the fall — which makes 1.0 mean "from
 * the ceiling of this room" in a fifteen-tile level and in a thirty-tile one
 * alike, with no constant to go stale when a level gets taller.
 *
 * Both arguments are the *top* of the body, so the height of the player cancels
 * out of both sides and a big Pieruprinssi and a small one measure the same
 * jump identically.
 */
export function poundScale(fromY, toY) {
  if (!(toY > 0)) return 0;
  return Math.max(0, Math.min(1, (toY - fromY) / toY));
}

/*
 * Beanstalk climbing. Constant speeds, no acceleration and no gravity: a vine
 * is a place where the physics stop, which is what makes it read as climbing
 * rather than as slow flying. Sideways movement is deliberately kept — without
 * it you could climb to the top of a vine and have no way off it but a jump.
 */
const CLIMB_SPEED = 1.1;
const CLIMB_SIDE = 0.75;

export const P_METER_MAX = 112;
const P_SEGMENTS = 7;
/** 7 segments, 8 frames each to fill and 24 each to drain. */
const P_FILL = P_METER_MAX / P_SEGMENTS / 8;
const P_DRAIN = P_METER_MAX / P_SEGMENTS / 24;

/*
 * Supertähti. Long enough to be worth having — about twelve seconds, three or
 * four chunks at a run — and short enough that the level is not handed over.
 *
 * It is not a power level and never touches one: it protects you from enemies
 * and from nothing else, so losing it costs you nothing you had before.
 */
export const STAR_FRAMES = 700;

export const MAX_POWER_LEVEL = 5;
/*
 * The fourth type is PAUKKUPAPU, the breaking power-up: a bean fermented so
 * hard that the pressure inside carries through a shoulder, and a brick wall
 * run into from the side bursts instead of stopping you.
 *
 * It is deliberately NOT in `LevelScene.rollPowerup`, so no question block, no
 * secret brick and no moon can ever hand it over. The only thing in the game
 * that gives it is the pair of papuparoonit in 2-M — see enemies.js. That is a
 * rule and not a coincidence: a reward you can also stumble into is not a
 * reason to take the harder branch of the map, and the branch is the whole
 * point of the fight existing.
 *
 * The key is 'pop' rather than 'bean' because `normalizePower` already spends
 * 'bean' on old saves, where it meant the plain mushroom.
 */
export const POWER_TYPES = ['shroom', 'flower', 'leaf', 'pop'];
export const POWER_NAMES = {
  shroom: 'PIERUSIENI',
  flower: 'PIERUKUKKA',
  leaf: 'KAASULEHTI',
  pop: 'PAUKKUPAPU',
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
    this.star = 0;
    this.airJumps = 0;
    this.dying = false;
    this.animTimer = 0;
    this.animFrame = 0;
    this.wag = 0;
    this.autoWalk = false;
    this.controllable = true;
    this.jumpHeld = false;
    this.coyote = 0;
    /* The size change is already frozen for a few frames; this is what those
     * frames are for. `morphFrom` is the body he had a moment ago, and the
     * drawing alternates between the two so the change reads as a change
     * rather than as a sprite that was swapped while nobody was looking. */
    this.morphFrom = 0;
    this.morphTimer = 0;
    this.climbing = false;
    /* The ground pound, as three plain fields rather than one clever one.
     *
     * `poundPhase` is '' | 'charge' | 'dive' | 'lag', `poundTimer` counts the
     * two phases that end on a clock, and `poundFromY` is the height the dive
     * was committed at — the thing the roadmap says has to be remembered,
     * because without it "the higher the fall, the harder it hits" has nothing
     * to measure. Numbers and a string on purpose: `savestate.js` serialises
     * every own property of every entity, so a snapshot taken in mid-dive comes
     * back in mid-dive without a line of save code, and the restored player
     * finishes the same dive from the same remembered height. */
    this.poundPhase = '';
    this.poundTimer = 0;
    this.poundFromY = 0;
    /* Frames before a warp pipe will take this player anywhere again. Without
     * it, holding the button on arrival sends you straight back.
     *
     * It is **not** the thing that stops you acting mid-warp and never was —
     * it counts down while you are running around perfectly in control. That
     * is `transit`, below, and the two are separate because they answer
     * different questions: one is "may this pipe fire", the other is "is there
     * a player in the room at all". */
    this.warpLock = 0;
    /* Set while the body is inside something — a pipe, the fortress door. The
     * scene drives it (`LevelScene.updateTransit`); this class only stands
     * aside. A plain object of numbers on purpose: `savestate.js` serialises
     * every own property of every entity, so a snapshot taken mid-transit
     * carries it without a line of save code. */
    this.transit = null;
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

  /** True from the moment down + jump is taken until he can steer again. */
  get pounding() { return this.poundPhase !== ''; }

  /**
   * Whether running into a brick from the side breaks it. Ummetus stops it for
   * the same reason it stops the gas jump and the tail: the charge is pressure,
   * and a cork is a cork. It costs nothing to be blocked — see `smashThrough`,
   * where every tile this does not touch is listed.
   */
  get breaker() { return this.type === 'pop' && !this.corked; }
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
    if (this.morphTimer > 0) this.morphTimer--;
    if (this.star > 0) this.star--;
    if (this.warpLock > 0) this.warpLock--;
    if (this.wag !== 0 || this.type === 'leaf') this.wag += this.flying > 0 ? 0.5 : 0.12;

    if (this.dying) {
      this.vy = Math.min(this.vy + 0.32, 9);
      this.y += this.vy;
      return;
    }

    /* Inside a pipe or a doorway. No physics, no input, no attack, no size
     * change — the scene moves the body and nothing else does. The timers
     * above still run, because a star burning down while you take a shortcut
     * is the same star. */
    if (this.transit) {
      this.vx = 0;
      this.vy = 0;
      this.jumpBuffer = 0;
      this.flying = 0;
      this.spin = 0;
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
    const up = this.controllable ? input.held.up : false;
    const down = this.controllable ? input.held.down : false;
    const run = this.controllable ? input.held.run : false;
    // A press is remembered for a few frames, so asking for a jump just before
    // landing gets you a jump on landing instead of nothing at all.
    if (this.controllable && input.pressed.jump) this.jumpBuffer = JUMP_BUFFER_FRAMES;
    else if (this.jumpBuffer > 0) this.jumpBuffer--;
    const jumpPressed = this.jumpBuffer > 0;
    const jumpHeld = this.controllable ? input.held.jump : false;

    /* ------------------------------ maahanisku ------------------------ */
    /*
     * Ahead of everything else, and it returns rather than falls through. A
     * dive is not a jump with a different velocity: while it runs, the player's
     * own walking, ducking, climbing, gravity, tail, gun and animation are
     * simply not happening, and that is exactly the price the move charges.
     * Expressing it as one early return is also the only way to be sure a later
     * edit further down cannot quietly hand steering back.
     *
     * Above the beanstalk in particular, because `down` is held throughout a
     * dive and mid-air `down` is also what grabs a vine. A dive that could be
     * caught halfway by a passing vine would end with the move stuck in its
     * dive phase for the rest of the level.
     */
    if (this.pounding) {
      this.updatePound();
      return;
    }
    if (this.canPound(down, jumpPressed)) {
      this.startPound();
      return;
    }

    /* ------------------------------- climbing ------------------------- */
    const vine = this.level.climbAt(this);
    if (this.climbing && jumpPressed) {
      /* Letting go is a jump from where you hang. It is handed to the ordinary
       * jump code rather than done here, so a vine cannot quietly become a
       * second kind of jump with its own height and its own sound. */
      this.climbing = false;
      this.coyote = COYOTE_FRAMES;
    } else if (this.climbing && !vine) {
      this.climbing = false;
    } else if (!this.climbing && vine && (up || (down && !this.onGround))) {
      // Up grabs; down only grabs in mid-air, or ducking at the foot of a vine
      // would climb instead.
      this.grabVine(vine);
    }

    if (this.climbing) {
      this.vy = (down ? CLIMB_SPEED : 0) - (up ? CLIMB_SPEED : 0);
      this.vx = ((right ? 1 : 0) - (left ? 1 : 0)) * CLIMB_SIDE;
      if (this.vx !== 0) this.facing = Math.sign(this.vx);
      moveX(this, this.level);
      // A vine passes through planks. Only rock stops a climb, or a platform
      // beside the vine would catch you on the way down and never let go.
      moveY(this, this.level, { dropThrough: true });
      // Climbing down onto solid ground is arriving, not still climbing.
      if (this.onGround) this.climbing = false;
      // Hands over hands, at the speed you are actually moving.
      if (this.vy !== 0) this.animFrame = Math.floor(this.tick / 8) % 2;
      return;
    }

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
      /*
       * The skid rate is not a ground rule. In the disassembly the branch that
       * picks it (PRG008_ABB8: "Player is pressing left/right", INY INY, then
       * `AND Player_MoveLR` -> "suddenly reversed direction") never looks at
       * `Player_InAir`. The two things that *are* gated on being airborne are
       * both still below: plain friction with no direction held, and the bleed
       * back down to the speed cap.
       *
       * Requiring `onGround` here was measured as the reason a jump at speed
       * felt unavoidable. At the run cap the arc carries 155 px through the
       * air and only 24 px after landing, so nearly all of the reaction
       * happens mid-air — and mid-air was braking at 0.0547 instead of 0.125,
       * less than half the authority the same player has with his feet down.
       */
      const skidding = Math.sign(this.vx) === -dir && Math.abs(this.vx) > 0.2;
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
    if (this.breaker && Math.abs(chargeVx) > 1.4 && this.vx === 0) this.smashThrough(chargeVx);
    moveY(this, this.level, {
      onHeadBump: (tx, ty) => this.level.bumpTile(tx, ty, this),
      dropThrough: down && !this.onGround,
    });

    /* ------------------------------ animation ------------------------- */
    // How long the player has been standing perfectly still, which is what
    // drives the idle performance in the sprite.
    if (this.onGround && Math.abs(this.vx) < 0.05 && dir === 0 && !this.ducking) this.idle++;
    else this.idle = 0;
    /* …and the second tier of that performance ends the moment anything comes
     * near, in one frame and mid-cycle, exactly as the attract demo hands the
     * machine back. It adds particles and takes the eye, so a player who looks
     * up to find an enemy arriving must never also have to wait for a gag to
     * finish. Only asked once the clock is nearly up, so the ordinary case
     * costs nothing. */
    if (this.idle >= DEEP_IDLE - 60 && this.threatNear()) this.idle = 0;

    const speed = Math.abs(this.vx);
    if (this.onGround && speed > 0.1) {
      /*
       * `* WALK_FRAMES / 3` keeps the cadence the frame order changed. Contacts
       * used to fall 1 and 2 advances apart in a three-frame cycle — 1.5 on
       * average, and uneven, which is the stutter — and fall 2 apart in the
       * four-frame one. Left alone that is a third fewer steps for the same
       * ground speed: measured at the walk cap it is 6.8 px of travel per step
       * against a 7 px gap between the boot prints, which is as close to not
       * sliding as this sprite gets, and 9.1 px against the same 7 px if the
       * rate is not scaled with the cycle.
       */
      this.animTimer += (0.12 + speed * 0.14) * (WALK_FRAMES / 3);
      if (this.animTimer >= 1) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % WALK_FRAMES;
      }
    } else if (this.onGround) {
      this.animFrame = 0;
    }
  }

  /**
   * Anything in the room that could be on top of him shortly. Six tiles is
   * about a second and a half of walker at full tilt — far enough that the
   * performance is over before the thing that ended it arrives, close enough
   * that it does not fire at everything on the screen.
   */
  threatNear() {
    const list = this.level && this.level.entities;
    if (!list) return false;
    for (const e of list) {
      if (e === this || e.remove || !e.active) continue;
      if (e.kind !== 'enemy' && e.kind !== 'hazard' && e.kind !== 'projectile') continue;
      if (Math.abs(e.cx - this.cx) < 96 && Math.abs(e.cy - this.cy) < 64) return true;
    }
    return false;
  }

  /**
   * Takes hold of a beanstalk. Snapping to the middle of the column is what
   * makes a vine feel like one thing instead of a strip you keep sliding off.
   */
  grabVine(vine) {
    this.climbing = true;
    if (this.ducking) {
      this.ducking = false;
      this.applySize();
    }
    this.x = vine.tx * 16 + (16 - this.w) / 2;
    this.vx = 0;
    this.vy = 0;
    this.flying = 0;
    this.onGround = false;
  }

  /**
   * Whether down + jump starts a dive this frame.
   *
   * The airborne test is what keeps the move from stealing the duck: on the
   * ground the same two buttons are still crouch-and-jump, which is where they
   * have always been. Climbing is excluded because a vine is a place where the
   * physics stop and `down` there means "climb down".
   *
   * Ummetus blocks it for the same reason it blocks the gas jump, the tail and
   * the shoulder charge: the dive is a fart, and a cork is a cork. That is not
   * a power gate and does not touch the promise in DESIGN.md §5 — a cork is a
   * timer somebody put on you, not a level you failed to collect, and the move
   * works at power 0 the moment it runs out.
   */
  canPound(down, jumpPressed) {
    if (!this.controllable || !down || !jumpPressed) return false;
    if (this.onGround || this.climbing || this.frozen > 0 || this.corked) return false;
    return true;
  }

  /**
   * Commits to the dive: hangs, and remembers how high the hanging happened.
   *
   * The height is taken here rather than when the drop starts even though the
   * body does not move in between, because *this* is the frame the player chose
   * — and if a later change ever lets something nudge him during the wind-up,
   * the measurement should still be the height he was looking at when he
   * pressed, not the one the nudge left him at.
   */
  startPound() {
    this.poundPhase = 'charge';
    this.poundTimer = POUND_CHARGE;
    this.poundFromY = this.y;
    this.vx = 0;
    this.vy = 0;
    // Everything else the gas was doing stops. A tail float or a flight that
    // survived into the dive would be a way of steering it.
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    this.flying = 0;
    this.spin = 0;
    Sfx.play('dive');
  }

  updatePound() {
    /* A press held or repeated through the unsteerable window must not be
     * waiting when it ends: the buffer exists so a jump asked for just before
     * landing is not lost, and the whole point here is that this landing costs
     * you the frames. */
    this.jumpBuffer = 0;
    this.vx = 0;

    if (this.poundPhase === 'charge') {
      // Held exactly still, not slowed: a body that drifted during the wind-up
      // would make the remembered height a lie by the time it is used.
      this.y = this.poundFromY;
      this.vy = 0;
      if (--this.poundTimer <= 0) {
        this.poundPhase = 'dive';
        this.level.spawnPuff(this.cx, this.y + this.h);
      }
      return;
    }

    if (this.poundPhase === 'dive') {
      this.vy = POUND_SPEED;
      /*
       * `dropThrough` is deliberately false even though `down` is certainly
       * held — it is what started this. Planks are dropped through by holding
       * down while falling, and a dive that kept that rule would sail through
       * the first platform under it every time, which makes the move unaimable
       * and hands the player a hole they did not ask for.
       */
      moveY(this, this.level, { dropThrough: false });
      // The gas he is riding down on, one puff every third frame: enough to
      // read as a jet, cheap enough that a long fall is not a particle storm.
      if (this.tick % 3 === 0) this.level.spawnPuff(this.cx, this.y + this.h - 2);
      if (this.onGround) this.landPound();
      return;
    }

    /* The landing. Stuck, and pointedly not invulnerable: `invuln` is not
     * touched here and no tint is drawn, because a tint in this game means
     * "cannot be hurt" and this is the one moment the move promises you can
     * be. Gravity still runs so that pounding onto a crumbling plank drops
     * with it rather than leaving him standing on air. */
    this.vy = Math.min(this.vy + GRAVITY, TERMINAL);
    moveY(this, this.level);
    if (--this.poundTimer <= 0) this.poundPhase = '';
  }

  /** Feet down. The scene owns everything that happens next. */
  landPound() {
    const strength = poundScale(this.poundFromY, this.y);
    this.poundPhase = 'lag';
    this.poundTimer = Math.round(POUND_LAG_MIN + POUND_LAG_RANGE * strength);
    this.vy = 0;
    this.level.poundImpact(this, strength);
  }

  /** Drops the move on the floor wherever it was. */
  cancelPound() {
    this.poundPhase = '';
    this.poundTimer = 0;
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

  /**
   * The breaking power-up: a wall run into at speed bursts.
   *
   * This used to be a perk of power level 4 and above, with no power-up behind
   * it, and that had to go rather than sit alongside the new one. Two doors to
   * the same ability would have made the fight in 2-M optional in the only way
   * that matters — a bowl of pea soup would have handed you the reward for
   * beating the papuparoonit — and "the fight is the only source" is a rule the
   * roadmap states, not a description of how things happen to be.
   *
   * **What it breaks, and why nothing else:**
   *   - `B` brick — yes. It is the one tile the game has always called soft: a
   *     bump from below breaks it and a sliding shell breaks it, so breaking it
   *     from the side adds a third way into an existing contract.
   *   - a brick that is hiding something — no, exactly as `ShellGuy.smashAhead`
   *     leaves it alone. Its reward belongs to whoever bumps it, and a charge
   *     that deleted a secret nobody ever saw would make the power-up a way of
   *     losing things.
   *   - `?` `!` `*` question blocks — no. They are containers, and the reward
   *     comes out of the top when you hit the bottom. Bursting one sideways
   *     would destroy what it holds.
   *   - `u` a spent block — no. It is masonry once it has paid out, and it is
   *     also frequently the ceiling somebody is standing on.
   *   - `X` hard ground and `#` ground — no. These are the level's structure:
   *     the validator reads exactly these two as the floor profile every route
   *     rule is measured against, so a player who could delete them could open
   *     a hole in the ground route that no check would ever have seen.
   *   - `%` crumbling platform — no. Its whole contract is a timer; a plank you
   *     can also punch out is a plank with no timer, and the tile grows back,
   *     which fights an empty square written over it.
   *   - `S` switch — no. It is a button, and a level has exactly one; smashing
   *     it would delete the only way to open what the switch opens.
   *   - `N` note block, `[ ] { }` pipe — no. A bouncer and a doorway are not
   *     walls, and a pipe with a hole in its side is a warp with a hole in it.
   */
  smashThrough(dirVx) {
    const dir = Math.sign(dirVx);
    const tx = Math.floor((dir > 0 ? this.x + this.w + 1 : this.x - 1) / 16);
    const y0 = Math.floor(this.y / 16);
    const y1 = Math.floor((this.y + this.h - 1) / 16);
    let smashed = false;
    for (let ty = y0; ty <= y1; ty++) {
      if (this.level.tileAt(tx, ty) !== T.BRICK) continue;
      if (this.level.brickSecret && this.level.brickSecret(tx, ty)) continue;
      this.level.smashBrick(tx, ty);
      smashed = true;
    }
    if (smashed) {
      this.vx = dirVx * 0.6;
      // The wall going down is its own event, louder and lower than the single
      // brick `smashBrick` already popped: one charge, one report, however many
      // tiles it took out.
      Sfx.play('burst');
      this.level.shake(2.5);
    }
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
    /* A dive that found something to land on before it found the floor is a
     * stomp, and a stomp gives the controls straight back. Leaving the pound
     * running would have pinned the player in mid-air with a bounce underneath
     * him, and it would also have let one dive collect a stomp *and* the ground
     * blast on the way through. One landing, one answer. */
    this.cancelPound();
  }

  /** Ummetus: corks the gas off for a while. Not damage, but it stings. */
  cork(frames = 380) {
    if (this.invuln > 0 || this.dying || this.transit) return false;
    this.corked = Math.max(this.corked, frames);
    this.flying = 0;
    this.spin = 0;
    Sfx.play('cork');
    this.level.addScorePop(this.cx, this.y - 8, 'UMMETUS');
    return true;
  }

  /** @returns true when the hit actually landed (i.e. not invulnerable). */
  hurt(cause = 'enemy') {
    // A body inside a pipe is not in the room; nothing in the room reaches it.
    if (this.invuln > 0 || this.dying || this.frozen > 0 || this.transit) return false;
    if (this.power.level === 0) {
      this.die(cause);
      return true;
    }
    this.startMorph(this.power.level);
    this.power = makePower(this.power.level - 1 === 0 ? null : this.power.type,
      this.power.level - 1);
    this.ducking = false;
    // A dive that ran into spines on the way down is over: the freeze and the
    // knock-back below own the body now, and a pound still counting frames
    // underneath them would take the controls again the moment they end.
    this.cancelPound();
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
      case 'leaf':
      case 'pop': {
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
          this.startMorph(this.power.level);
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
      case 'star': {
        // Restarted, not extended: the timer is the promise on the HUD, and a
        // second star that added twelve seconds to nine would make it a lie.
        this.star = STAR_FRAMES;
        Sfx.play('yeah');
        this.level.awardScore(1000, this.cx, this.y);
        break;
      }
      case 'oneup':
        this.level.gainLife(this.cx, this.y);
        break;
      default:
        break;
    }
  }

  /**
   * Steps out of the world for a moment. The scene decides where the body goes
   * and when it comes back — see `LevelScene.updateTransit`.
   */
  beginTransit(spec) {
    this.transit = {
      phase: 'in',
      f: 0,
      fromX: this.x,
      fromY: this.y,
      hide: null,
      hideDir: 1,
      /* Remembered rather than assumed true on the way out. A transit is not
       * the only thing that takes the controls away — the clear sequence does
       * too — and handing them back unconditionally would be a warp that
       * cancelled a cutscene. */
      wasControllable: this.controllable,
      ...spec,
    };
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.climbing = false;
    // A dive interrupted by a pipe does not resume on the far side: the body
    // that comes out is somewhere else entirely, and the height it remembered
    // belongs to a room it has left.
    this.cancelPound();
    this.controllable = false;
  }

  /** Remembers the body he is leaving, for the size-change flicker. */
  startMorph(fromLevel) {
    this.morphFrom = fromLevel;
    this.morphTimer = 20;
  }

  /** `cause` is only carried through to telemetry; it changes nothing in play. */
  die(cause = 'enemy') {
    if (this.dying) return;
    /* Nothing in the level can kill a travelling player — the clock stops, the
     * collisions stand aside and `hurt` refuses — so this only fires for a
     * death forced from outside (the debug keys, a test). Dropping the transit
     * is the right answer there: the death animation is the thing to watch,
     * and a half-finished slide is not. */
    this.transit = null;
    this.cancelPound();
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
    /* Before `ducking` and before `onGround`: a body on a vine is neither
     * standing nor falling, and reporting `jump` here was the whole reason the
     * hand-over-hand counter below was computed every frame and thrown away. */
    if (this.climbing) return 'climb';
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
    // The star wins over both: it lasts longer than either and it is the one
    // state where being hard to read is actually dangerous.
    if (this.star > 0) tint = STAR_TINTS[Math.floor(this.tick / 3) % STAR_TINTS.length];
    else if (this.frozen > 0) tint = TINTS.frozen;
    else if (this.invuln > 0 && Math.floor(this.tick / 2) % 2 === 0) tint = TINTS.flash;
    const spinning = this.spin > 0;
    drawPlayer(ctx, this.x, this.y, {
      type: this.power.type,
      // Flickering between the old body and the new one. The hitbox is already
      // the new size — only the picture alternates, so nothing about the change
      // is decided by which frame you are on.
      level: this.morphTimer > 0 && Math.floor(this.tick / 3) % 2
        ? this.morphFrom : this.power.level,
      facing: spinning ? (Math.floor(this.spin / 3) % 2 ? -this.facing : this.facing) : this.facing,
      frame: this.animFrame,
      state: this.state(),
      ducking: this.ducking,
      running: Math.abs(this.vx) > MAX_WALK,
      tick: this.tick,
      wag: this.wag,
      idle: this.idle,
      // Where he is standing changes how he stands there; see idlePose.
      theme: this.level.theme,
      tint,
      glow: this.star > 0 ? GLOWS.star : null,
    });
    if (this.corked > 0) {
      drawCork(ctx, this.x + this.w / 2 - 4, this.y - 10, this.tick);
    }
  }
}

/* The two ground-pound constants leave the module for the same reason
 * `WALK_FRAMES` comes into it: whoever reports the price of the move has to
 * read the price, not remember it. A number copied into a test is a number
 * that goes stale the first time the move is tuned. */
export { MAX_WALK, MAX_RUN, MAX_P, POUND_CHARGE, POUND_SPEED };
