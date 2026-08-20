import { TILE } from '../data/worlds.js';

/**
 * MOVING PLATFORMS, and the two decisions that make them possible at all.
 *
 * Owner, having asked a long time ago: *"also we maybe need… moving platforms?"*
 *
 * **They are not tiles.** Every piece of terrain in this engine lives on a
 * 16-pixel grid and `moveX`/`moveY` resolve against that grid, so a platform
 * made of tiles could only ever move in whole-tile jumps — sixteen pixels at a
 * time, which is a teleport rather than a ride. A lift is therefore an object
 * with its own pixel position, and the collision has to learn about it.
 *
 * **They are not entities either.** They are kept in their own list rather than
 * in `this.entities`, because everything in that list can be stomped, bubbled,
 * shelled, kicked and killed, and a lift is none of those things. Putting it
 * there would mean auditing every one of those interactions to say "except
 * this"; keeping it out means none of them ever see it.
 *
 * ## The speed is constant, and that is a design choice
 *
 * A sine would ease into its turns and look better standing still. It is the
 * wrong curve for this game: every jump in it is measured against a budget
 * (`gapTiles` 6, `wallTiles` 4) and a platform whose speed depends on where it
 * is in its cycle makes the same jump different every time you try it. A
 * constant speed with a hard reversal is predictable, and predictable is what
 * a moving floor has to be.
 */

/** How far a lift travels from where it was placed, in tiles. */
const SPAN_TILES = 4;

/** Pixels per frame. Slower than a walk, so a lift is never a way to outrun. */
const SPEED = 0.55;

/** Frames it rests at each end. Long enough to step on without timing it. */
const DWELL = 22;

export class Lift {
  /** `axis` is 'x' for a lift that shuttles sideways, 'y' for one that climbs. */
  constructor(tx, ty, axis) {
    this.axis = axis;
    this.w = TILE * 3;
    this.h = 8;
    this.homeX = tx * TILE - TILE;
    this.homeY = ty * TILE + TILE - this.h;
    this.x = this.homeX;
    this.y = this.homeY;
    this.dx = 0;
    this.dy = 0;
    this.dir = 1;
    this.dwell = 0;
    this.span = SPAN_TILES * TILE;
    /*
     * A SIDEWAYS LIFT RUNS RIGHT FROM WHERE IT IS PLACED; A CLIMBING ONE RUNS
     * UP.
     *
     * Both are the direction with somewhere to go. A level's floor is below,
     * so a vertical lift placed at its high point spends its run sinking into
     * the ground — and the engine is right to hand the rider to real terrain
     * when that happens, which means the marker would author a platform that
     * stops working half way through its own cycle. Placed at the low point it
     * rises into the air the level actually has.
     */
    this.way = axis === 'y' ? -1 : 1;
  }

  /** Where it is along its run, 0…1, for anything that wants to draw a track. */
  get along() {
    const at = this.axis === 'x' ? this.x - this.homeX : this.y - this.homeY;
    return Math.max(0, Math.min(1, at / this.span));
  }

  update() {
    const before = this.axis === 'x' ? this.x : this.y;
    if (this.dwell > 0) {
      this.dwell--;
    } else {
      let at = before + SPEED * this.dir * this.way;
      const home = this.axis === 'x' ? this.homeX : this.homeY;
      const far = home + this.span * this.way;
      const lo = Math.min(home, far);
      const hi = Math.max(home, far);
      if (at >= hi) { at = hi; this.dir = this.way > 0 ? -1 : 1; this.dwell = DWELL; }
      if (at <= lo) { at = lo; this.dir = this.way > 0 ? 1 : -1; this.dwell = DWELL; }
      if (this.axis === 'x') this.x = at; else this.y = at;
    }
    const after = this.axis === 'x' ? this.x : this.y;
    /* The delta is kept rather than recomputed, because a rider is carried by
     * exactly what the lift moved — asking again after the fact would answer
     * about a different frame. */
    this.dx = this.axis === 'x' ? after - before : 0;
    this.dy = this.axis === 'y' ? after - before : 0;
  }

  /** True when `box` is over the lift's deck and would cross it going down. */
  catches(box, prevBottom) {
    if (box.x + box.w <= this.x + 1 || box.x >= this.x + this.w - 1) return false;
    const top = this.y;
    /* The sweep, not the overlap: a body falling faster than the deck is thick
     * would pass through it in one frame if we only asked where it is now. */
    return prevBottom <= top + 1 && box.y + box.h >= top;
  }

  /** True when `box` is resting on the deck right now. */
  carries(box) {
    if (box.x + box.w <= this.x + 1 || box.x >= this.x + this.w - 1) return false;
    const feet = box.y + box.h;
    return feet >= this.y - 1 && feet <= this.y + 3;
  }
}

/**
 * Drawn as a machine and not as a creature: a plated deck, bolt heads, and a
 * bracket underneath. ROADMAP's breathing note draws the line and this is on
 * the far side of it — *what is alive breathes, what is a mechanism moves*, and
 * a lift may move but must never look like it is drawing breath.
 */
export function drawLift(ctx, lift, tick) {
  const x = Math.round(lift.x);
  const y = Math.round(lift.y);
  ctx.fillStyle = '#20202e';
  ctx.fillRect(x, y, lift.w, lift.h);
  ctx.fillStyle = '#8c8ca8';
  ctx.fillRect(x, y, lift.w, lift.h - 2);
  ctx.fillStyle = '#c0c0d8';
  ctx.fillRect(x, y, lift.w, 1);
  ctx.fillStyle = '#5c5c74';
  for (let i = 4; i < lift.w - 2; i += 8) ctx.fillRect(x + i, y + 3, 2, 2);
  /* A bracket under the middle, and a spark on it every so often: the one
   * moving part, so the eye is told the deck is being driven rather than
   * floating. */
  ctx.fillStyle = '#3a3a50';
  ctx.fillRect(x + lift.w / 2 - 3, y + lift.h - 2, 6, 3);
  if (Math.floor(tick / 8) % 4 === 0) {
    ctx.fillStyle = '#ffd048';
    ctx.fillRect(x + lift.w / 2 - 1, y + lift.h, 2, 1);
  }
}
