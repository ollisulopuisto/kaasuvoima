import { getLevel } from '../data/levels.js';
import {
  TILE, T, info, isSolid, isSemi, drawTile, THEMES, SWITCH_MAP, SPIKE_TOP,
} from '../gfx/tiles.js';
import { drawBackdrop } from '../gfx/backdrop.js';
import { drawGoal, drawItem } from '../gfx/sprites.js';
import { drawText, textWidth } from '../gfx/font.js';
import { Player, P_METER_MAX, MAX_RUN } from '../entities/player.js';
import { ENEMY_CHARS } from '../entities/enemies.js';
import { Item } from '../entities/items.js';
import { Puff, ScorePop, BrickPiece, CoinPop } from '../entities/effects.js';
import { Music, Sfx, Ambience } from '../core/audio.js';
import { PostFX } from '../gfx/postfx.js';
import { logDeath, logClear, logStuck, levelSummary } from '../core/telemetry.js';
import { noteSecret, tileKey, SKY, CAVE } from '../core/secrets.js';
import { clamp, hashNoise, overlaps, padNum } from '../core/utils.js';

export const VIEW_W = 320;
export const VIEW_H = 208;
export const HUD_H = 32;

const GOAL_HEIGHT = 6 * TILE;
/** Seconds left when the music starts pushing. */
const HURRY_TIME = 100;

/* Camera feel. The dead zone is what keeps a hop from shaking the screen; the
 * look-ahead is what lets you see the gap you are running at. */
const CAM_DEAD_ZONE = 8;      // px of free movement before the camera follows
const CAM_LOOK_AHEAD = 34;    // px the view leans ahead at full running speed
const CAM_LOOK_GAIN = 0.035;  // how fast the lean builds
const CAM_LOOK_RETURN = 0.07; // and how fast it settles back when you stop
const CAM_BAND_EASE = 0.18;   // how fast the view crosses to another band

/*
 * The vertical camera hangs off the player's **feet**, and the two constants
 * below are where that is expressed.
 *
 * `applySize()` keeps the bottom of the body fixed and changes `h`, so ducking
 * on a pipe moved `p.y` down 13 px in a single frame at power level 3 — and the
 * camera, which was anchored to `p.y`, went with it. The backdrop does not
 * parallax vertically, so the whole ground appeared to jolt for no reason the
 * player could see. Feet do not move when a body changes size, so anchoring
 * there removes the cause instead of smoothing over it, and it also stops the
 * framing sliding around as you collect power-ups.
 *
 * `CAM_STAND` is the standing height the framing was tuned at (the mushroom
 * size, PLAYER_SIZES[1]); subtracting it keeps a standing player's view pixel
 * for pixel what it was before.
 */
const CAM_EYE = 0.55;         // how far down the window the player sits
const CAM_STAND = 26;         // the body height that framing assumes

/*
 * And genuine vertical movement is eased.
 *
 * This is not the inertia rejected below: that argument is about the axis you
 * aim with, and you do not aim upwards. A step down off a ledge as a hard cut
 * reads as the level moving; the same step over a few frames reads as the view
 * following you.
 *
 * 0.25 closes a 16 px step to under a pixel in about thirteen frames, and in a
 * sustained fall at TERMINAL it settles at a lag of 4 / 0.25 = 16 px — one
 * tile, against the ~90 px of window below the player, so the ground you are
 * falling towards is never off the bottom of the screen. Past CAM_SNAP the
 * view is not lagging, it is somewhere else entirely — a respawn, a warp, a
 * pit — and those cut rather than glide.
 */
const CAM_V_EASE = 0.25;
const CAM_SNAP = 48;

/*
 * ...but it does not follow a jump.
 *
 * The line above is anchored to `camAnchor`, the last feet position the player
 * actually **settled** at, and not to the feet themselves. A jump moves the
 * body and leaves the anchor where it was, so the view stays put and the
 * ground stays on screen; landing, standing, climbing and falling all move the
 * anchor at once, because those are the moments where the player really is
 * somewhere else. Falling in particular has to follow promptly — you must see
 * what you are falling towards — and it does, because the anchor tracks any
 * downward move on the frame it happens.
 *
 * Why hysteresis and not a smaller `CAM_EYE`: the complaint is about the
 * letterboxed desert (2-1, 2-3), where the window is 160 rows instead of 208
 * and the camera therefore has 80 px of vertical travel instead of 32. The
 * camera rode the whole jump arc up and took the desert floor with it —
 * measured, the tile the player took off from was off the bottom of the window
 * for **41.6 % of every airborne frame**. `CAM_EYE` applies while standing too,
 * so lowering it would re-frame all 24 levels to fix a mid-jump problem, and it
 * would not fix it in the levels where the camera has less travel; the anchor
 * fixes the cause everywhere and changes nothing about how a standing player is
 * framed.
 *
 * `CAM_TOP_MARGIN` is the one thing that overrides the held line, and it is
 * stated in the window rather than in the world on purpose: the reason to break
 * the hold is that the body is about to leave the top of the picture, so the
 * threshold belongs where that is measured. One tile of headroom, so the head
 * never touches the frame edge. In a 208-row window it is never reached (the
 * standing head sits 106 px below the line and the highest jump in the game
 * rises 100), so a normal level's camera now holds still through every jump;
 * in the letterboxed one it takes over near the apex and the view rises exactly
 * as far as it must, and no further.
 */
const CAM_TOP_MARGIN = 16;

/*
 * ...and how much warning the view gets before it has to.
 *
 * The margin above was applied as a hard clamp **after** the ease, and the
 * owner saw exactly what that is: "when the character is actually high enough
 * for the camera to move, it moves suddenly. It just snaps higher instead of
 * animating." A clamp cannot animate. The frame the head crossed 16 px the view
 * was pinned to `p.y - CAM_TOP_MARGIN` and tracked it exactly from then on, so
 * the camera's speed went from nothing to the body's own rise speed between two
 * frames — measured, **2.92 px on one frame** in 2-1 at power level 3, on a
 * frame where the body itself lifted 2.93. A view that matches the body's speed
 * from a standstill is a cut with extra steps.
 *
 * The answer is not to ease the limit — an eased limit lags, and that lag is
 * the measured 2.6 px of head poking out of the letterbox band that put the
 * clamp there in the first place. **The answer is to start before the limit is
 * reached.** So the limit is aimed at where the head *will be* in
 * `CAM_TOP_LEAD` frames rather than where it is, and the ease has that long to
 * get up to speed. Worst single frame after: **1.95 px**, reached over several
 * frames instead of on the first one, and the clamp below now moves the view
 * 0.00 px because it is never the thing that arrives first.
 *
 * Three frames, and the number is the ease's own rather than a taste:
 * `CAM_V_EASE` of 0.25 chasing a target that moves at v settles exactly
 * `(1 - 0.25) / 0.25 = 3v` behind it, so three frames of lead cancel the lag
 * and the view arrives at the limit instead of chasing it. **Longer leads are
 * worse**, which is not obvious and is the reason this paragraph exists: the
 * lead multiplies a velocity, and a fart jump changes that velocity in a single
 * step, so every extra frame of lead makes the target's own jump on that frame
 * bigger. Worst single-frame rise at leads of 3, 4, 5, 6 and 8 frames: 1.95,
 * 2.21, 2.49, 2.68, 2.88 px. Three is both the cancellation and the minimum.
 *
 * It is spent only while rising. Falling and standing aim at the head itself,
 * which is what they always did.
 *
 * What this does *not* do is start following ordinary jumps, and that is the
 * point of leading by a speed rather than by a distance: at the top of an arc
 * the speed is nothing, so the lead is nothing and the settled framing is the
 * old framing to the pixel — `cameraY()` for a standing body is unchanged, and
 * asserted so.
 *
 * The one ordinary jump this is visible on is worth stating rather than
 * rounding away. A running jump in 2-1 at power level 3 tops out with the head
 * **16.4 px** clear of the frame — 0.4 px from forcing the old clamp — so the
 * anticipation does engage for a frame or two near the apex, and the view
 * drifts a total of **0.93 px over an 85 px jump**, 0.27 of it on its busiest
 * frame. That is a jump which was always going to move the camera, moved
 * smoothly instead of in one step. At power level 0 the same jump has 20.4 px
 * of headroom and the view still does not move at all: 0.00 px, before and
 * after.
 */
const CAM_TOP_LEAD = 3;

/*
 * Cinemascope, for the levels that ask for it (`letterbox: true`).
 *
 * The bars are a **crop, not a mask**. Widescreen is a narrower window on the
 * world, not the same window with paint over its edges, so the camera's
 * vertical range narrows by exactly what the bars cover — see `viewH`. Pasting
 * bars over the usual 208 rows would show the same picture and only take away
 * the part of it you were reading.
 *
 * 24 px a side leaves a 320x160 window: 2.00:1, ten tiles tall. That is as
 * narrow as it can safely go. The highest jump in the game rises **100 px**
 * (measured; see tools/measure-jump.mjs), and standing on the desert floor the
 * player's head sits 102 px below the top of the band — so the apex fits even
 * before the camera rises with it. Any taller a bar and you would be jumping
 * blind out of the top of the frame.
 */
const LETTERBOX_BAR = 24;

/*
 * Going into something, and coming out of it somewhere else.
 *
 * One mechanism serves the warp pipes and the fortress door, because they are
 * the same event: the player stops being an actor, slides out of sight behind a
 * piece of the level, the picture holds for a beat, and then something else
 * happens. Two implementations of that would drift apart on exactly the details
 * that matter — who can hurt you while you are inside, what a quicksave taken
 * mid-slide contains — so there is one, `Player.transit`, and both callers fill
 * in the same fields.
 *
 * Thirty-odd frames in total. Long enough to read as travelling and short
 * enough that a player who knows the pipe is there is not made to watch it.
 */
const TRANSIT_IN = 14;        // sliding into the mouth, until the body is gone
const TRANSIT_HOLD = 5;       // the beat where nothing is on screen
const TRANSIT_OUT = 13;       // and back out at the far end

/*
 * How far above the ground a ceiling pipe's mouth may be and still be enterable.
 *
 * Pressing **down** needs no reach: gravity holds the feet against the tile
 * they are standing on, so the mouth is exactly the tile under the feet.
 * Pressing **up** has no such contact — the player stands on the floor and the
 * mouth hangs from the ceiling some pixels above the head.
 *
 * **Measured from the feet, not from the head, and that is the whole point.**
 * The reach used to be one tile over the head, which reads like "stand under
 * the mouth" and is not: the six bodies are 16, 26, 30, 34, 38 and 43 px tall,
 * so with the floor and the mouth both fixed, the gap over the head is a
 * different number for every power level, and a single tile of slack cannot
 * span 27 px of it. Measured on the shipped rooms: exactly three of the six
 * sizes could enter any given ceiling pipe, and which three depended on how
 * high the mouth was hung. That is "be exactly this tall" wearing the other
 * rule's comment.
 *
 * From the feet it is one number for everybody. Three tiles is the tallest
 * body (43 px, 2.7 tiles) rounded up to a whole row, so the rule is: the mouth
 * hangs no more than a body-height above the ground you are standing on, and
 * it is above your head. Every size then enters the same pipe from the same
 * floor — which is what a pipe in the ceiling looks like it should do.
 */
const WARP_UP_REACH = 3 * TILE;

/*
 * The fortress door, from the boss falling over to the level ending.
 *
 * The door takes half a second to swing. `onBossDefeated` already had a sound
 * for it (`Sfx.play('door')`) and no picture, which is the half of DESIGN.md §8
 * that goes unnoticed; now the leaves actually move.
 *
 * `bossDefeated` stops being `true` and becomes **the tick the boss fell**,
 * because that is a number the save state already carries (so does `tick`), and
 * a swing derived from those two survives a quickload without a new field in
 * `savestate.js` — which this agent may not edit. It stays truthy, so every
 * existing reader is unaffected, and an old snapshot restoring `true` reads as
 * "opened long ago", which is exactly right.
 */
const DOOR_OPEN_FRAMES = 30;

/* Telemetry: "stuck" means no new ground gained for this many frames. Eight
 * seconds is long enough that a careful player lining up a jump is not counted,
 * and short enough that a wall someone cannot pass shows up on the first try. */
const STUCK_FRAMES = 480;
const STUCK_PROGRESS = 8;     // px of new ground that counts as progress

/* How long a crumbling platform holds. Just under a second: long enough to
 * cross two of them at a walk, short enough that standing still is a mistake. */
const CRUMBLE_FRAMES = 52;
/** And how long the hole stays before the tile comes back. */
const CRUMBLE_REGROW = 220;

/* How long a switch runs. Ten seconds is enough to cross a room and get back,
 * and short enough that it is a window rather than a new normal. */
const SWITCH_FRAMES = 600;
/** It starts flashing this long before it ends, so the end is never a surprise. */
const SWITCH_WARN = 150;

/** The star's HUD readout cycles the same colours the player does. */
const STAR_HUD_COLORS = ['#fff070', '#ffffff', '#8fe04a', '#78c0ff'];

/*
 * Some ordinary bricks are hiding something.
 *
 * Which ones is a pure function of the tile's position, so it is the same brick
 * every time anyone plays that level — a secret you can learn and then show a
 * friend, rather than a lottery. It also needs no level data and no save-state
 * field, and it applies to every world at once, including generated ones.
 *
 * The rates were first set at 1-in-40 and 1-in-300, "deliberately mean". That
 * was calibrated for a game with thousands of bricks. This one has **186 in
 * total**, so those rates hid about five surprises in the entire game and one
 * power-up in every other playthrough — a feature nobody would ever meet.
 *
 * These numbers are **calibrated by counting, not by intent**. Brick positions
 * are structured — rows and blocks, not scattered points — and the hash is not
 * uniform over them: a nominal 16 % came out at 30 % when measured across all
 * 186. So the rates were tuned against the real level data until the count was
 * right, and `verify.mjs` asserts the measured share rather than the constants.
 *
 * As set, the whole game holds 23 coin bricks and 6 power bricks — one or two
 * per level. Often enough that hitting a brick is worth a try, rare enough that
 * hitting every brick is still a waste of a clock that is counting down.
 */
const SECRET_COIN_RATE = 0.07;
const SECRET_POWER_RATE = 0.015;

export class LevelScene {
  constructor(game, levelId) {
    this.game = game;
    this.def = getLevel(levelId);
    this.id = levelId;
    this.theme = this.def.theme;

    this.grid = this.def.rows.map((row) => row.split(''));
    this.h = this.grid.length;
    this.w = this.grid[0].length;
    this.widthPx = this.w * TILE;
    this.heightPx = this.h * TILE;

    this.entities = [];
    this.bumps = new Map();
    /* Crumbling platforms: "tx,ty" → frames stood on. Same shape as `bumps`,
     * which is deliberate — the save-state code already knows how to store a
     * per-tile timer map, so this costs one line there instead of a design. */
    this.crumbles = new Map();
    /* A switch is one number, not a rewritten grid — see `tileAt`. That is what
     * makes it impossible for an expiring switch to leave the level in a broken
     * half-state, and what makes the save state need one field instead of a
     * second copy of the map. */
    this.switchTimer = 0;
    this.bar = this.def.letterbox ? LETTERBOX_BAR : 0;
    /** How much level the view actually shows. Everything vertical reads this. */
    this.viewH = VIEW_H - 2 * this.bar;
    this.cam = { x: 0, y: 0 };
    this.camLook = 0;
    /** The feet line the framing hangs from — see CAM_TOP_MARGIN. */
    this.camAnchor = 0;
    this.tick = 0;
    this.time = this.def.time;
    this.timeSub = 0;
    this.state = 'play';
    this.stateTimer = 0;
    this.bossDefeated = false;
    this.shakeAmp = 0;
    this.gust = 0;
    this.goal = null;
    this.cardIndex = 0;
    this.wonCard = null;
    this.spawn = { x: 2 * TILE, y: 12 * TILE };

    // Playtest telemetry, tracked per attempt. `bestX` is the furthest the
    // player has got; `stallFrames` counts how long it has stood still.
    this.bestX = 0;
    this.stallFrames = 0;
    this.stuckLogged = new Set();
    this.telemetryDone = false;

    this.scanGrid();
    this.player = new Player(this, this.spawn.x, this.spawn.y + TILE, game.state.power);
    this.bestX = this.player.x;
    this.centerCamera();
  }

  /* ------------------------------ building ----------------------------- */

  scanGrid() {
    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        const ch = this.grid[ty][tx];
        if (ch === '1') {
          this.spawn = { x: tx * TILE, y: ty * TILE };
          this.grid[ty][tx] = ' ';
        } else if (ENEMY_CHARS[ch]) {
          this.entities.push(ENEMY_CHARS[ch](this, tx, ty, this.def.bossVariant || 0));
          this.grid[ty][tx] = ' ';
        } else if (ch === T.GOAL) {
          this.goal = { tx, ty, x: tx * TILE, y: ty * TILE + TILE - GOAL_HEIGHT };
          this.grid[ty][tx] = ' ';
        }
      }
    }
  }

  enter() {
    // A boss level gets its own theme until the thing is beaten.
    const track = this.def.boss && !this.bossDefeated ? 'boss' : (this.def.music || 'level');
    Music.play(track);
    Music.setHurry(this.time <= HURRY_TIME);
    // The room and the weather, from the theme — the audio half of what
    // PostFX.setAmbience does to the picture.
    Ambience.set(this.theme, this.def);
  }

  /** Kicks the camera for a frame or two. Purely cosmetic. */
  shake(amount) {
    this.shakeAmp = Math.min(6, Math.max(this.shakeAmp, amount));
  }

  /* ------------------------------ level API ---------------------------- */

  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.w) return T.HARD;   // solid level edges
    /*
     * The sky is a lid, for the same reason the sides are walls.
     *
     * Reported from play: in 1-F the opening screen has no ceiling, so you can
     * jump up beside where the ceiling starts, land on top of it, and run the
     * whole level along the roof — past the boss, with no way down and no way
     * to win. The level was not broken; the world simply had no top, and any
     * level whose ceiling does not reach its own start edge has the same hole.
     *
     * Closing it here fixes every level at once, including generated ones, and
     * it cannot be forgotten the next time somebody writes a chunk.
     */
    if (ty < 0) return T.HARD;
    if (ty >= this.h) return T.EMPTY;
    const ch = this.grid[ty][tx];
    if (this.switchTimer > 0) return SWITCH_MAP[ch] || ch;
    return ch;
  }

  /** The character actually stored, ignoring any running switch. */
  rawTileAt(tx, ty) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return T.EMPTY;
    return this.grid[ty][tx];
  }

  setTile(tx, ty, ch) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
    this.grid[ty][tx] = ch;
  }

  solidAt(tx, ty) {
    return isSolid(this.tileAt(tx, ty));
  }

  /** The climbable tile an entity is inside, or null. */
  climbAt(entity) {
    const x0 = Math.floor(entity.x / TILE);
    const x1 = Math.floor((entity.x + entity.w - 1) / TILE);
    const y0 = Math.floor(entity.y / TILE);
    const y1 = Math.floor((entity.y + entity.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (info(this.tileAt(tx, ty)).climb) return { tx, ty };
      }
    }
    return null;
  }

  add(entity) {
    this.entities.push(entity);
    return entity;
  }

  spawnPuff(x, y, brown = false) {
    for (let i = 0; i < 4; i++) {
      this.add(new Puff(this, x, y, { spread: 1.6, size: 3, brown }));
    }
  }

  /** The blast under a mid-air fart jump: knocks over anything just below. */
  fartBlast(x, y, radius, source) {
    for (let i = 0; i < 5; i++) {
      this.add(new Puff(this, x + (i - 2) * 3, y, { spread: 2.2, size: 4, life: 20 }));
    }
    for (const e of this.entities) {
      if (e.kind !== 'enemy' || e.dying || e.remove || e === source) continue;
      if (Math.abs(e.cx - x) < radius && e.cy > y - 10 && e.cy < y + radius) {
        // Same rules as a fart ball, so tough customers stay tough.
        e.hitByProjectile(Math.sign(e.cx - x) || 1);
      }
    }
  }

  smashBrick(tx, ty) {
    if (this.tileAt(tx, ty) !== T.BRICK) return;
    this.setTile(tx, ty, T.EMPTY);
    const px = tx * TILE;
    const py = ty * TILE;
    this.add(new BrickPiece(this, px, py, -1.4, -3.4, this.theme));
    this.add(new BrickPiece(this, px + 8, py, 1.4, -3.4, this.theme));
    this.add(new BrickPiece(this, px, py + 8, -1.1, -2.2, this.theme));
    this.add(new BrickPiece(this, px + 8, py + 8, 1.1, -2.2, this.theme));
    this.awardScore(50);
    this.shake(1.5);
    Sfx.play('brick');
  }

  addScorePop(x, y, text) {
    // Two numbers in the same spot read as one unreadable smudge, and a big
    // one drawn over a small one is worse. Nudge a new pop clear of any that
    // is already there.
    let ny = y;
    for (let tries = 0; tries < 6; tries++) {
      const clash = this.entities.some((e) => e instanceof ScorePop && !e.remove
        && Math.abs(e.x - x) < 26 && Math.abs(e.y - ny) < 12);
      if (!clash) break;
      ny -= 13;
    }
    this.add(new ScorePop(this, x, ny, text));
  }

  awardScore(points, x, y) {
    this.game.state.score += points;
    if (x !== undefined) this.addScorePop(x, y, points);
  }

  gainLife(x, y) {
    this.game.state.lives++;
    Sfx.play('oneup');
    if (x !== undefined) this.addScorePop(x, y, '1UP');
  }

  addCoin(x, y) {
    this.game.state.coins++;
    this.game.state.score += 200;
    Sfx.play('coin');
    if (this.game.state.coins >= 100) {
      this.game.state.coins -= 100;
      this.gainLife(x, y);
    }
  }

  storeReserve(kind) {
    if (!this.game.state.reserve) this.game.state.reserve = kind;
    else this.awardScore(1000);
  }

  dropReserve() {
    const kind = this.game.state.reserve;
    if (!kind) return;
    this.game.state.reserve = null;
    this.add(new Item(this, this.player.cx - 8, this.player.y - 20, kind, { emerge: false }));
  }

  /** A sliding shell mows down everything it touches. */
  shellSweep(shell) {
    for (const e of this.entities) {
      if (e === shell || e.kind !== 'enemy' || e.dying || e.remove) continue;
      if (overlaps(shell.box, e.box)) e.hitByShell(Math.sign(shell.vx) || 1);
    }
  }

  /**
   * How far the fortress door has swung, 0…1. Derived from two numbers the
   * save state already carries rather than kept in a field of its own — see
   * DOOR_OPEN_FRAMES. A snapshot from before this change restores
   * `bossDefeated === true`, and `tick - true` is `tick - 1`, which reads as
   * fully open the way it should.
   */
  get doorOpen() {
    if (!this.bossDefeated) return 0;
    return clamp((this.tick - this.bossDefeated) / DOOR_OPEN_FRAMES, 0, 1);
  }

  onBossDefeated() {
    // The tick, not `true`. Still truthy for every existing reader.
    this.bossDefeated = this.tick + 1;
    Music.play(this.def.music || 'fortress');
    Sfx.play('clear');
    Sfx.play('door');
    this.shake(4);
    this.addScorePop(this.player.cx, this.player.y - 12, 'OVI AUKI');
  }

  onPlayerDied(cause = 'enemy') {
    this.state = 'dead';
    this.stateTimer = 0;
    this.recordDeath(cause);
    Music.stop();
    Ambience.stop();
  }

  /* ----------------------------- telemetry ----------------------------- */

  /**
   * One event per attempt, guarded by `telemetryDone`. Without the guard a
   * save-state rewind would log the same death twice and the heatmap would
   * quietly overweight whichever spot someone was practising.
   */
  recordDeath(cause) {
    if (this.telemetryDone) return;
    this.telemetryDone = true;
    this.game.attempts[this.id] = (this.game.attempts[this.id] || 0) + 1;
    logDeath({
      level: this.id,
      tx: Math.floor(this.player.cx / TILE),
      ty: Math.floor(this.player.cy / TILE),
      cause,
      power: this.player.powerLevel,
      frames: this.tick,
    });
  }

  recordClear() {
    if (this.telemetryDone) return;
    this.telemetryDone = true;
    logClear({
      level: this.id,
      frames: this.tick,
      deaths: this.game.attempts[this.id] || 0,
      power: this.player.powerLevel,
    });
    this.game.attempts[this.id] = 0;
  }

  /**
   * Watches for a player who is alive but getting nowhere. Only the first stall
   * per column is logged: a player who gives up and stands there for a minute
   * should count once, not six times.
   */
  updateProgress() {
    const p = this.player;
    if (p.x > this.bestX + STUCK_PROGRESS) {
      this.bestX = p.x;
      this.stallFrames = 0;
      return;
    }
    if (++this.stallFrames < STUCK_FRAMES) return;
    this.stallFrames = 0;
    const tx = Math.floor(this.bestX / TILE);
    if (this.stuckLogged.has(tx)) return;
    this.stuckLogged.add(tx);
    logStuck({ level: this.id, tx, ty: Math.floor(p.cy / TILE), frames: this.tick });
  }

  /* -------------------------------- warping ---------------------------- */

  /** True when any column the body covers holds a warp mouth on row `ty`. */
  warpMouthAt(ty) {
    const p = this.player;
    const x0 = Math.floor(p.x / TILE);
    const x1 = Math.floor((p.x + p.w - 1) / TILE);
    for (let tx = x0; tx <= x1; tx++) if (info(this.tileAt(tx, ty)).warp) return true;
    return false;
  }

  /**
   * Warp pipes. The bands of a tall level are a fixed number of rows apart, so
   * travelling between them is an addition and nothing else: no second scene,
   * no transition, no save logic of its own. Down goes down a band, up goes up.
   *
   * **The direction you travel has to match the mouth you enter.** Stand on a
   * pipe whose mouth faces up and press down; stand under a pipe that hangs
   * from the ceiling and press up. Both directions used to test the same tile —
   * the one under the feet — so an upward warp was entered by standing on top
   * of a pipe and pressing up, which is the genre's rule backwards and reads,
   * correctly, as a bug: the pipe you are standing on is capped at the bottom.
   *
   * There is no compatibility path left. `WARP_COMPAT.upFromFloor` carried the
   * shipped rooms while their exits still stood on the floor; every upward warp
   * in the game hangs from a ceiling now (`cave_room`, `tomb_cave`,
   * `fac_cellar`, `fac_duct_up`), and `fac_loft`'s exit never needed to move
   * because leaving a loft is a downward journey.
   *
   * Two things can still refuse: rock where you would arrive, and a band with
   * no ground under the arrival. The second is what stops the surface pipe from
   * being a way to drop yourself out of the sky onto your own head.
   */
  tryWarp(input) {
    const bands = this.def.bands;
    const p = this.player;
    if (!bands || p.dying || p.transit || !p.onGround || p.warpLock > 0) return;
    const dir = input.held.down ? 1 : input.held.up ? -1 : 0;
    if (!dir) return;

    /** The world edge the body disappears behind: the mouth's own near lip. */
    let hide;
    if (dir > 0) {
      const under = Math.floor((p.y + p.h) / TILE);
      if (!this.warpMouthAt(under)) return;
      hide = under * TILE;                       // the mouth's top edge
    } else {
      /* Every row that lies wholly above the head and whose lower lip is within
       * reach of the ground being stood on. The lowest lip wins: the mouth of a
       * hanging pipe is its bottom tile and everything above that is shaft. See
       * WARP_UP_REACH for why the reach is measured from the feet. */
      let mouth = -1;
      const first = Math.max(0, Math.ceil((p.y + p.h - WARP_UP_REACH) / TILE) - 1);
      const last = Math.floor(p.y / TILE) - 1;
      for (let ty = first; ty <= last; ty++) if (this.warpMouthAt(ty)) mouth = ty;
      if (mouth < 0) return;
      hide = (mouth + 1) * TILE;                 // the ceiling mouth's bottom edge
    }

    const shift = dir * bands.rows * TILE;
    if (!this.fits(p.x, p.y + shift, p.w, p.h)) return;
    const feet = Math.floor((p.y + shift + p.h) / TILE);
    const bandEnd = (Math.floor(feet / bands.rows) + 1) * bands.rows - 1;
    if (!this.footingWithin(p.x, p.w, feet, bandEnd)) return;

    p.beginTransit({
      kind: 'warp',
      axis: 'y',
      slide: dir * (p.h + 4),
      out: dir * (p.h + 4),
      arriveX: p.x,
      arriveY: p.y + shift,
      hide,
      hideDir: dir,
    });
    /* Arriving in a hidden band *is* finding the secret, so the find is written
     * here, where the journey is decided, rather than by something watching the
     * scene from outside. `noteSecret` filters against the level's own key
     * list, so this writes nothing in a level that has no hidden band. */
    this.noteBand(p.y + shift + p.h);
    /* Going in gets the falling sweep and coming out gets the rising one, so
     * the two ends of the journey do not sound like the same event happening
     * twice (DESIGN.md §8). */
    Sfx.play('pipe');
  }

  /**
   * Walking into the fortress door once it has swung open.
   *
   * It is the same transit as a pipe, turned on its side: the body slides its
   * own width further in and is not drawn past the line it was already
   * standing at, so it goes *into* the doorway rather than stopping in front
   * of it. Nothing arrives at the far end, because the far end of this one is
   * the end of the level — see the 'hold' branch of `updateTransit`.
   */
  enterDoor(tx, ty) {
    const p = this.player;
    if (p.transit || this.state !== 'play') return;
    let left = tx;
    let right = tx;
    while (left > 0 && info(this.tileAt(left - 1, ty)).door) left--;
    while (right < this.w - 1 && info(this.tileAt(right + 1, ty)).door) right++;
    const middle = (left + right + 1) * TILE / 2;
    const dirX = middle >= p.cx ? 1 : -1;

    p.vx = 0;
    p.vy = 0;
    p.ducking = false;
    p.facing = dirX;
    p.beginTransit({
      kind: 'door',
      axis: 'x',
      slide: dirX * (p.w + 4),
      /* The edge the body disappears behind is where its leading edge already
       * is, not the door's own boundary: the player is inside the frame by the
       * time this runs, and clipping at the frame would chop them on the first
       * frame instead of taking them in. */
      hide: dirX > 0 ? p.x + p.w : p.x,
      hideDir: dirX,
    });
    Sfx.play('door');
  }

  /* -------------------------------- transit ---------------------------- */

  /**
   * Drives whatever the player is currently disappearing into — see the
   * TRANSIT_* constants for why there is only one of these.
   *
   * Nothing can reach the player while it runs: `playerTiles`, `collisions`
   * and the clock all step aside, and `Player.hurt` refuses. That is not
   * belt-and-braces, it is the answer to the death question — a transit cannot
   * outlive the scene's own liveness because it cannot start after a death
   * (`state === 'play'` and `p.dying` both gate it) and it cannot cause or
   * survive one. `Player.die` still clears it, for a death forced from outside
   * the level (the debug keys, a test).
   *
   * A quicksave taken mid-transit is a **valid** save and is not refused. The
   * whole of the state lives on the player as plain numbers, and
   * `savestate.js` serialises every own property of every entity, so a snapshot
   * carries the phase, the frame counter and the arrival — and `cam` is saved
   * beside it, so the held picture comes back held. Refusing the save was the
   * alternative and it is worse: the player has no way to know these thirty
   * frames are special, and a quicksave key that silently does nothing is a
   * bug report.
   */
  updateTransit() {
    const p = this.player;
    const t = p.transit;
    if (!t || t.phase === 'gone') return;
    t.f++;

    if (t.phase === 'in') {
      const k = Math.min(1, t.f / TRANSIT_IN);
      if (t.axis === 'x') p.x = t.fromX + t.slide * k;
      else p.y = t.fromY + t.slide * k;
      if (t.f >= TRANSIT_IN) { t.phase = 'hold'; t.f = 0; }
      return;
    }

    if (t.phase === 'hold') {
      if (t.f < TRANSIT_HOLD) return;
      t.phase = 'out';
      t.f = 0;
      if (t.kind === 'door') {
        /* The door is the end of the level, so the far end of this transit is
         * the clear sequence itself. It starts **here**, on the frame the body
         * is gone, and not on the frame the player touched the door: the jingle
         * is the reward for finishing, finishing is going through the door, and
         * a jingle that plays while the player is still visibly walking says
         * the level is over while the picture says it is not. That is the
         * mismatch DESIGN.md §8 is about, and the price is 19 frames.
         *
         * The transit is not cleared, it goes to 'gone': `completeLevel` sets
         * `autoWalk`, which is right for the flagpole and would have the
         * player stroll back out of the door he just went into. Held here he
         * stays inside it, out of sight, for the whole clear sequence — which
         * is the third of the owner's three complaints. */
        t.phase = 'gone';
        this.completeLevel(null);
        return;
      }
      // Cross to the far band out of sight, and take the view with us.
      p.x = t.arriveX;
      p.y = t.arriveY;
      p.vy = 0;
      p.climbing = false;
      this.centerCamera();
      p.y = t.arriveY - t.out;
      t.hide = null;
      this.spawnPuff(p.cx, t.arriveY + p.h);
      Sfx.play('door');
      return;
    }

    // 'out': back into the world, still not in charge of it.
    const k = Math.min(1, t.f / TRANSIT_OUT);
    p.y = (t.arriveY - t.out) + t.out * k;
    if (t.f >= TRANSIT_OUT) {
      p.y = t.arriveY;
      p.controllable = t.wasControllable;
      p.transit = null;
      p.vy = 0;
      // Its own job, and not this one: it stops the button you are still
      // holding from sending you straight back.
      p.warpLock = 24;
    }
  }

  /** True when a box that size has no solid tile in it at (x, y). */
  fits(x, y, w, h) {
    if (y < 0 || y + h > this.heightPx) return false;
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 1) / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.floor((y + h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) if (this.solidAt(tx, ty)) return false;
    }
    return true;
  }

  /** True when rows `from`..`to` hold anything a box that wide could land on. */
  footingWithin(x, w, from, to) {
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 1) / TILE);
    for (let ty = from; ty <= to; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = this.tileAt(tx, ty);
        if (isSolid(ch) || isSemi(ch)) return true;
      }
    }
    return false;
  }

  /* ------------------------------- bumping ----------------------------- */

  /**
   * Records having found a hidden band, from the height of a pair of feet.
   *
   * Standing in the room is the find — not touching the vine, which you can do
   * by walking past it, and not clearing the level. `noteSecret` filters
   * against the level's own keys, so this writes nothing in a level with only
   * one band.
   */
  noteBand(feetY) {
    const bands = this.def.bands;
    if (!bands || !this.game.state) return;
    const band = Math.floor((feetY - 1) / (bands.rows * TILE));
    if (band <= 0) noteSecret(this.game.state, this.id, SKY);
    else if (band >= 2) noteSecret(this.game.state, this.id, CAVE);
  }

  /**
   * A block that has been hit.
   *
   * The find is written where the block is spent, and the key is built from the
   * **raw** tile rather than `tileAt`: while a switch is running, a brick reads
   * as a coin, and a secret recorded under the character the player happened to
   * see would not match the level's own key list. A block that hides nothing
   * writes nothing — `noteSecret` filters — so this does not have to know which
   * bricks are the interesting ones.
   */
  bumpTile(tx, ty, player) {
    const ch = this.tileAt(tx, ty);
    const meta = info(ch);
    if (!meta.bumpable) return;
    const raw = this.rawTileAt(tx, ty);
    const found = () => noteSecret(this.game.state, this.id, tileKey(raw, tx, ty));

    const key = `${tx},${ty}`;
    if (this.bumps.has(key)) return;
    this.bumps.set(key, 0);
    this.flipEnemiesAbove(tx, ty);

    if (meta.question) {
      this.setTile(tx, ty, T.USED);
      found();
      if (ch === T.QCOIN) {
        this.add(new CoinPop(this, tx * TILE, ty * TILE - TILE));
        this.addCoin(tx * TILE + 8, ty * TILE);
      } else {
        // A star block promises a star; everything else rolls.
        const kind = meta.question === 'star' ? 'star' : this.rollPowerup(player);
        this.add(new Item(this, tx * TILE, ty * TILE - TILE, kind));
        Sfx.play('bump');
      }
      return;
    }

    if (ch === T.BRICK) {
      const secret = this.brickSecret(tx, ty);
      if (secret) {
        // A brick with something in it behaves like a question block: it never
        // smashes, whatever size you are, so the reward cannot be lost by
        // being too strong.
        this.setTile(tx, ty, T.USED);
        found();
        if (secret === 'coin') {
          this.add(new CoinPop(this, tx * TILE, ty * TILE - TILE));
          this.addCoin(tx * TILE + 8, ty * TILE);
        } else {
          this.add(new Item(this, tx * TILE, ty * TILE - TILE, this.rollPowerup(player)));
          Sfx.play('powerup');
        }
        return;
      }
      if (player.big) {
        this.bumps.delete(key);
        this.smashBrick(tx, ty);
      } else {
        Sfx.play('bump');
      }
      return;
    }

    if (meta.switch) {
      this.setTile(tx, ty, T.USED);
      found();
      this.startSwitch();
      return;
    }

    if (ch === T.NOTE) {
      player.vy = -6.2;
      player.onGround = false;
      Sfx.play('kick');
      return;
    }

    Sfx.play('bump');
  }

  /** @returns 'coin' | 'power' | null — see SECRET_COIN_RATE for the reasoning. */
  brickSecret(tx, ty) {
    // Offset the two draws so a brick can never be both, and so the two rates
    // stay independent of each other.
    if (hashNoise(tx * 7 + 13, ty * 11 + 5) < SECRET_POWER_RATE) return 'power';
    if (hashNoise(tx * 3 + 1, ty * 5 + 2) < SECRET_COIN_RATE) return 'coin';
    return null;
  }

  /**
   * A power block gives the first mushroom to a powerless player, then mixes
   * types and pea soup so the level can be pushed toward the top tier.
   */
  rollPowerup(player) {
    if (player.powerLevel === 0) return 'shroom';
    const roll = Math.random();
    if (roll < 0.3) return 'soup';
    if (roll < 0.53) return 'shroom';
    if (roll < 0.77) return 'flower';
    return 'leaf';
  }

  flipEnemiesAbove(tx, ty) {
    const box = { x: tx * TILE, y: ty * TILE - 16, w: TILE, h: 16 };
    for (const e of this.entities) {
      if (e.kind === 'enemy' && !e.dying && overlaps(e.box, box)) e.flipDie(1);
    }
  }

  /* -------------------------------- update ----------------------------- */

  update(input) {
    this.tick++;

    if (this.state === 'play') {
      this.updateTimer();
      this.player.update(input);
      this.playerTiles();
      this.tryWarp(input);
      this.updateTransit();
      this.updateProgress();
    } else if (this.state === 'clear') {
      this.player.update(input);
      this.stateTimer++;
      if (this.stateTimer > 170) {
        this.game.finishLevel({ cleared: true, card: this.wonCard });
        return;
      }
    } else if (this.state === 'dead') {
      this.player.update(input);
      this.stateTimer++;
      if (this.stateTimer > 140) {
        this.game.finishLevel({ died: true });
        return;
      }
    }

    if (this.def.wind) this.updateWind();
    /* The bed sounds while the level is being played, and only then. This one
     * line is also how it stops: pausing, dying, clearing and every scene
     * change all stop calling it. See Ambience.hold. */
    if (this.state === 'play') Ambience.hold(this.gust);
    if (this.shakeAmp > 0) this.shakeAmp = Math.max(0, this.shakeAmp - 0.4);
    this.updateEntities();
    if (this.state !== 'dead') this.collisions();
    this.updateCamera();
    this.updateBumps();
    this.updateCrumbles();
    this.updateSwitch();
    if (this.goal && this.state === 'play') this.cardIndex = Math.floor(this.tick / 9) % 3;
    /* Feet, not head: bumping your head into the sky band is not arriving. The
     * pipe records its own arrival the moment the journey is committed, but a
     * beanstalk has no such moment — climbing into the sky is a position and
     * not an event, so the position is what is asked, every frame. */
    if (this.player) this.noteBand(this.player.y + this.player.h);
  }

  /**
   * Desert wind: long calm stretches broken by gusts that shove the player
   * sideways. It has to be intermittent — a constant push is just a changed
   * control scheme, while a gust you can see coming is a thing to play around.
   */
  updateWind() {
    const cycle = this.tick % 600;
    this.gust = cycle > 380 ? Math.sin(((cycle - 380) / 220) * Math.PI) : 0;
    if (this.gust > 0.05 && this.state === 'play') {
      const push = this.gust * 0.055 * (this.player.onGround ? 0.5 : 1);
      this.player.vx -= push;
    }
  }

  updateTimer() {
    // Nothing counts down while you are between places. Thirty frames is not a
    // gift worth arguing about, and the alternative is a clock that can kill
    // the player inside a pipe, where nothing can be done about it.
    if (this.player.transit) return;
    if (++this.timeSub >= 24) {
      this.timeSub = 0;
      this.time--;
      if (this.time <= 0) {
        this.time = 0;
        this.player.die('time');
      } else if (this.time === HURRY_TIME) {
        Sfx.play('timewarn');
        Music.setHurry(true);
      }
    }
  }

  updateEntities() {
    const camL = this.cam.x - 64;
    const camR = this.cam.x + VIEW_W + 96;
    for (const e of this.entities) {
      if (!e.active) {
        if (e.alwaysActive || (e.x < camR && e.x + e.w > camL)) e.active = true;
        else continue;
      }
      e.update();
      // `alwaysActive` means the entity is part of the level's state, not just
      // scenery near the camera — a boss must never be tidied away.
      if (!e.alwaysActive && e.x + e.w < this.cam.x - 240 && e.kind === 'enemy') e.remove = true;
    }
    this.entities = this.entities.filter((e) => !e.remove);
  }

  /**
   * Crumbling platforms. A tile starts its timer the moment the player's feet
   * are on it, keeps counting whether or not they stay, and then drops out.
   *
   * It grows back after a while, and that is not decoration: without it, dying
   * halfway across a row of them would leave the level permanently impassable
   * for the rest of the attempt, and the player would have no way to know why.
   */
  updateCrumbles() {
    const p = this.player;
    if (!p.dying && p.onGround) {
      const ty = Math.floor((p.y + p.h) / TILE);
      const x0 = Math.floor(p.x / TILE);
      const x1 = Math.floor((p.x + p.w - 1) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (this.tileAt(tx, ty) !== T.CRUMBLE) continue;
        const key = `${tx},${ty}`;
        if (!this.crumbles.has(key)) {
          this.crumbles.set(key, 0);
          Sfx.play('bump');
        }
      }
    }

    for (const [key, value] of this.crumbles) {
      const next = value + 1;
      const [tx, ty] = key.split(',').map(Number);
      if (next === CRUMBLE_FRAMES) {
        this.setTile(tx, ty, T.EMPTY);
        const px = tx * TILE;
        const py = ty * TILE;
        this.add(new BrickPiece(this, px, py, -1.2, -2.6, this.theme));
        this.add(new BrickPiece(this, px + 8, py, 1.2, -2.6, this.theme));
        this.shake(1.2);
        Sfx.play('brick');
      } else if (next > CRUMBLE_FRAMES + CRUMBLE_REGROW) {
        // Never rebuild a tile inside the player: that would be a wall
        // appearing out of nowhere, and it would be our fault, not theirs.
        const box = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
        if (overlaps(this.player.box, box)) continue;
        this.setTile(tx, ty, T.CRUMBLE);
        this.crumbles.delete(key);
        continue;
      }
      this.crumbles.set(key, next);
    }
  }

  startSwitch() {
    this.switchTimer = SWITCH_FRAMES;
    this.shake(2);
    Sfx.play('powerup');
    this.addScorePop(this.player.cx, this.player.y - 12, 'TIILET KOLIKOIKSI');
  }

  /**
   * Runs the switch down. The only tricky part is the last frame: a brick that
   * comes back while the player is standing inside it would seal them in solid
   * rock, which is a bug wearing a puzzle's clothes. So the timer simply
   * refuses to reach zero until they are clear — bounded, invisible when it is
   * not needed, and it makes the trap impossible rather than unlikely.
   */
  updateSwitch() {
    if (this.switchTimer <= 0) return;
    if (this.switchTimer > 1) {
      this.switchTimer--;
      return;
    }
    if (this.playerInsideReturningTile()) return;
    this.switchTimer = 0;
    Sfx.play('bump');
  }

  playerInsideReturningTile() {
    const p = this.player;
    if (p.dying) return false;
    const x0 = Math.floor(p.x / TILE);
    const x1 = Math.floor((p.x + p.w - 1) / TILE);
    const y0 = Math.floor(p.y / TILE);
    const y1 = Math.floor((p.y + p.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (isSolid(this.rawTileAt(tx, ty))) return true;
      }
    }
    return false;
  }

  /** 0→1 while a crumbling tile is counting down, for the drawing code. */
  crumbleProgress(tx, ty) {
    const value = this.crumbles.get(`${tx},${ty}`);
    return value === undefined ? 0 : Math.min(1, value / CRUMBLE_FRAMES);
  }

  updateBumps() {
    for (const [key, value] of this.bumps) {
      const next = value + 1;
      if (next > 10) this.bumps.delete(key);
      else this.bumps.set(key, next);
    }
  }

  /*
   * Camera: a dead zone plus look-ahead, not inertia.
   *
   * Inertia — a camera that keeps drifting after the player stops — is what
   * makes 2D platformers feel seasick, because the view moves while the thing
   * you are aiming with does not. What actually helps is showing more of where
   * you are going: the view shifts ahead in the direction you are running, and
   * eases back when you stop. Inside the dead zone the camera does not move at
   * all, so small hops and turns leave the screen still.
   *
   * The vertical axis is a different problem and gets a different answer: it is
   * not the axis you aim with, so a short glide there costs nothing and saves
   * every step down from reading as a cut. See CAM_V_EASE.
   */
  /**
   * Moves the line the view hangs from — and, far more often, does not.
   *
   * Three things count as being somewhere else: going down (any downward move
   * at all, on the frame it happens, because you must see what you are falling
   * towards), standing on something, and hanging off a vine. A jump is none of
   * them, so the anchor sits still through the whole arc and the ground stays
   * where it was. Landing on a platform above the old line is `onGround` on the
   * frame the feet touch, and `CAM_V_EASE` then glides the view up to it.
   *
   * Dying and travelling both freeze it: in both the body is going somewhere
   * the view has no business following.
   */
  updateCamAnchor() {
    const p = this.player;
    if (p.dying || p.transit) return;
    const feet = p.y + p.h;
    if (feet > this.camAnchor || p.onGround || p.climbing) this.camAnchor = feet;
  }

  updateCamera() {
    const p = this.player;
    this.updateCamAnchor();
    const speed = Math.abs(p.vx);
    const wanted = speed > 0.4 ? Math.sign(p.vx) * CAM_LOOK_AHEAD * Math.min(1, speed / MAX_RUN) : 0;
    this.camLook += (wanted - this.camLook) * (Math.abs(wanted) > Math.abs(this.camLook)
      ? CAM_LOOK_GAIN : CAM_LOOK_RETURN);

    const centre = p.cx + this.camLook - VIEW_W / 2;
    const drift = centre - this.cam.x;
    if (Math.abs(drift) > CAM_DEAD_ZONE) {
      this.cam.x += drift - Math.sign(drift) * CAM_DEAD_ZONE;
    }
    this.cam.x = clamp(this.cam.x, 0, Math.max(0, this.widthPx - VIEW_W));

    const want = this.cameraY();
    const fall = want - this.cam.y;
    if (this.def.bands) {
      // A band change is the one big vertical move that is meant to be watched
      // rather than cut, so it is the one that is never snapped.
      this.cam.y += fall * CAM_BAND_EASE;
    } else if (Math.abs(fall) > CAM_SNAP) {
      this.cam.y = want;
    } else {
      this.cam.y += fall * CAM_V_EASE;
    }

    /* And the headroom is a limit, not a destination: the ease does its work
     * and then this has the last word. It only ever moves the view up, and
     * only as far as the band allows.
     *
     * **It is a safety net and no longer a mechanism.** It used to be the
     * thing that moved the camera at all — the ease was still on its way and
     * this arrived, which is the snap the owner reported. `CAM_TOP_LEAD` gives
     * the ease its warning, so by the time the head is 16 px from the frame
     * the view is already there and this line finds nothing to do: measured
     * over fart jumps in 2-1, 2-3 and 1-1, it moves the camera 0.00 px. It
     * stays because "already there" is a measurement and not a proof, and the
     * head touching the top of the frame is not a thing to find out about in
     * the wild. */
    if (!p.dying && !p.transit) {
      this.cam.y = this.clampCamY(Math.min(this.cam.y, p.y - CAM_TOP_MARGIN));
    }
  }

  /**
   * Where the view wants to sit vertically.
   *
   * A tall level is bands of the same 15 rows a short level has, and the camera
   * stays inside the one the player is in. That is not a detail: without it the
   * view would follow every jump over 208 pixels of free travel, which is the
   * seasickness the horizontal camera goes to such lengths to avoid — and it
   * would show the secret above or below while you walked past underneath.
   *
   * Measured from the feet — see CAM_STAND for why that is not a detail.
   */
  cameraY() {
    const p = this.player;
    /* The settled line, then the one thing allowed to override it: the head
     * must not leave the top of the window. Frozen bodies get the line alone —
     * a dying player flies upwards and a travelling one is not in the room. */
    const rest = this.camAnchor - this.viewH * CAM_EYE - CAM_STAND;
    /* The head, or where it is heading. A rise is aimed three frames ahead so
     * the ease is already up to speed by the time the margin matters; anything
     * else is aimed at the body itself. See CAM_TOP_LEAD. */
    const head = p.vy < 0 ? p.y + p.vy * CAM_TOP_LEAD : p.y;
    const target = p.dying || p.transit ? rest : Math.min(rest, head - CAM_TOP_MARGIN);
    // The view holds still while you die: following the body down would pan it
    // straight through whatever is under the pit you just fell into.
    if (p.dying && this.def.bands) return this.cam.y;
    return this.clampCamY(target);
  }

  /** The vertical range the view is allowed, level or band. */
  clampCamY(y) {
    const bands = this.def.bands;
    if (!bands) return clamp(y, 0, Math.max(0, this.heightPx - this.viewH));
    /* Which band you are in is decided by your feet, not your middle. Falling
     * into a pit puts your middle in the band below for the few frames before
     * the lava under the pit gets you, and that was enough to lurch the view
     * down and show the secret to someone who was only dying. */
    const span = bands.rows * TILE;
    const p = this.player;
    const feet = Math.floor((p.y + p.h - 1) / span) * span;
    const top = clamp(feet, 0, this.heightPx - span);
    return clamp(y, top, top + span - this.viewH);
  }

  centerCamera() {
    // A cut is the one moment the held line is simply wrong: wherever the body
    // has been put, that is where it has settled.
    this.camAnchor = this.player.y + this.player.h;
    this.camLook = 0;
    this.cam.x = clamp(this.player.cx - VIEW_W / 2, 0, Math.max(0, this.widthPx - VIEW_W));
    this.cam.y = this.cameraY();
  }

  /* ------------------------------ collisions --------------------------- */

  playerTiles() {
    const p = this.player;
    if (p.dying || p.transit) return;
    const x0 = Math.floor(p.x / TILE);
    const x1 = Math.floor((p.x + p.w - 1) / TILE);
    const y0 = Math.floor(p.y / TILE);
    const y1 = Math.floor((p.y + p.h - 1) / TILE);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = this.tileAt(tx, ty);
        if (ch === T.COIN) {
          this.setTile(tx, ty, T.EMPTY);
          this.addCoin(tx * TILE + 8, ty * TILE);
        } else if (ch === T.LAVA) {
          p.die('lava');
          return;
        } else if (ch === T.SPIKE && !(p.star > 0)) {
          /* Only the part with points on it hurts. Testing the whole tile made
           * the top six pixels — plain air, above the tips — just as lethal as
           * the spikes, so a jump that cleared them by sight still cost you.
           *
           * The star covers spikes too: it is protection from the things in the
           * level that hit you, and a spike bed is one of those. What it still
           * does not cover is the level itself — a pit, lava, the clock. */
          const box = {
            x: tx * TILE, y: ty * TILE + SPIKE_TOP, w: TILE, h: TILE - SPIKE_TOP,
          };
          if (overlaps(p.box, box) && p.hurt('spike')) p.vy = -3;
        } else if (info(ch).door && this.doorOpen >= 1) {
          this.enterDoor(tx, ty);
          return;
        }
      }
    }

    if (p.y > this.heightPx + 8) p.die('pit');

    if (this.goal && this.state === 'play') {
      const pole = { x: this.goal.x + 4, y: this.goal.y - 8, w: 10, h: GOAL_HEIGHT + 8 };
      if (overlaps(p.box, pole)) this.completeLevel(['shroom', 'flower', 'star'][this.cardIndex]);
    }
  }

  collisions() {
    const p = this.player;
    if (p.dying || p.transit) return;
    const spin = p.spinBox;
    // The stomp test has to use the speed the player *arrived* with. Bouncing
    // off the first enemy flips vy upwards, and without this snapshot every
    // other enemy landed on in the same frame would read as a side-on hit.
    const fallVy = p.vy;

    for (const e of this.entities) {
      if (e.remove) continue;

      if (e.kind === 'item') {
        if (e.emerging > 0) continue;
        if (overlaps(p.box, e.box)) {
          p.collect(e.itemKind);
          e.remove = true;
        }
        continue;
      }

      if (e.kind === 'projectile') {
        for (const other of this.entities) {
          if (other.kind !== 'enemy' || other.dying || other.remove) continue;
          if (overlaps(e.box, other.box)) {
            other.hitByProjectile(Math.sign(e.vx) || 1);
            e.pop();
            break;
          }
        }
        continue;
      }

      if (e.kind === 'hazard') {
        if (e.box.h > 0 && overlaps(p.box, e.box)) p.hurt('hazard');
        continue;
      }

      // An empty box is not a hitbox, whatever `overlaps` thinks of it.
      if (e.box.h <= 0 || e.box.w <= 0) continue;

      if (e.kind !== 'enemy' || e.dying) continue;

      /* A bubble is a target, not a threat: touching it is the whole kill.
       * Popping one from above still bounces the player, or a jump onto a
       * bubble would read as a stomp that did not take. */
      if (e.bubbled) {
        if (overlaps(p.box, e.box)) {
          e.popBubble(e.cx >= p.cx ? 1 : -1);
          if (fallVy > 0) p.bounce();
        }
        continue;
      }

      if (e.harmless) continue;

      if (spin && overlaps(spin, e.box)) {
        e.hitByTail(p.facing);
        continue;
      }

      if (!overlaps(p.box, e.box)) continue;

      const stomping = fallVy > 0 && p.y + p.h - fallVy <= e.y + e.h * 0.6;

      /*
       * Spines beat the stomp, and they beat it the way the floor spikes do: a
       * hit and a shove back off the points, never a stomp that quietly did
       * nothing. The star is deliberately not covered here — it falls through
       * to the shell hit below, because protection from the inhabitants is
       * exactly what it promises.
       */
      if (stomping && e.spiky && p.star <= 0) {
        if (p.hurt('spike')) p.vy = -3;
        continue;
      }

      if (stomping && e.stompable && !e.spiky) {
        if (e.stomp()) {
          p.bounce(this.game.input.held.jump);
          Sfx.play('stomp');
        }
        continue;
      }

      if (e.mode === 'shell') {
        e.kick(e.cx >= p.cx ? 1 : -1);
        continue;
      }

      /*
       * Supertähti. It replaces exactly one thing — the hit an enemy would
       * land — and nothing else, which is why it lives here and not in
       * `hurt`. Pits, lava, spikes, heartburn and the clock all reach the
       * player down their own paths and are untouched by it: the star is
       * protection from the inhabitants, never from the level.
       *
       * Delivered as a shell hit rather than a `flipDie` so the tough
       * customers stay tough — the boss still needs his three, the sun still
       * needs her three — and so one death path serves every enemy type.
       */
      if (p.star > 0) {
        e.hitByShell(e.cx >= p.cx ? 1 : -1);
        continue;
      }

      if (e.corks) p.cork();
      else p.hurt();
    }
  }

  completeLevel(card) {
    if (this.state !== 'play') return;
    this.state = 'clear';
    this.stateTimer = 0;
    this.recordClear();
    this.wonCard = card;
    this.player.controllable = false;
    this.player.autoWalk = true;
    this.player.ducking = false;
    this.awardScore(Math.max(0, this.time) * 50);
    Music.stop();
    Ambience.stop();
    Sfx.play('clear');
  }

  /* --------------------------------- draw ------------------------------ */

  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.bar, VIEW_W, this.viewH);
    ctx.clip();
    // From here down the origin is the top-left of the *window*, so nothing
    // below has to know a bar is there.
    ctx.translate(0, this.bar);

    /* The scenery belongs to the ground band. Once the camera is above it —
     * up the beanstalk — the hills have to get out of the way, or a platform
     * twenty tiles in the air looks like it is standing on them. */
    const bandDrop = this.def.bands
      ? Math.max(0, (this.def.bands.main * TILE - this.cam.y) * 0.6) : 0;
    drawBackdrop(ctx, this.def.bg, this.theme, this.cam.x, VIEW_W, this.viewH, this.tick, bandDrop);

    const jitter = this.shakeAmp > 0
      ? { x: Math.round(Math.sin(this.tick * 2.1) * this.shakeAmp),
        y: Math.round(Math.cos(this.tick * 3.3) * this.shakeAmp * 0.6) }
      : { x: 0, y: 0 };
    const camX = Math.round(this.cam.x) + jitter.x;
    const camY = Math.round(this.cam.y) + jitter.y;
    ctx.translate(-camX, -camY);

    if (this.def.bands) this.drawUnderground(ctx, camX, camY);
    this.drawTiles(ctx, camX, camY);
    if (this.game.debug) this.drawHeatmap(ctx, camX, camY);
    if (this.goal) {
      drawGoal(ctx, this.goal.x, this.goal.y, GOAL_HEIGHT, this.cardIndex, this.state !== 'play');
    }

    /* The lamp follows the player, and this is the only place its screen
     * position is already known: the camera rounding, the shake jitter and the
     * letterbox offset have all been applied by now. Working it out anywhere
     * else would mean deriving the same three numbers a second time, and the
     * light would sit a shake behind the thing it is lighting.
     *
     * Aiming it also clears last frame's world lights, so it has to come before
     * the entities offer theirs. */
    const lit = !!this.def.spotlight;
    if (lit) PostFX.setFocus(this.player.cx - camX, this.player.cy - camY + this.bar);

    for (const e of this.entities) {
      if (!e.active) continue;
      if (e.x + e.w < camX - 32 || e.x > camX + VIEW_W + 32) continue;
      e.draw(ctx);
      // Gathered in the draw loop rather than in a pass of its own: whatever is
      // close enough to be worth lighting is exactly what is close enough to be
      // worth drawing, and the cull is already written here.
      const glow = lit ? e.light : null;
      if (glow) PostFX.addLight(glow.x - camX, glow.y - camY + this.bar, glow.r, glow.i);
    }
    this.drawPlayerInto(ctx, camX, camY);

    ctx.restore();
    if (this.bar) this.drawLetterbox(ctx);
    this.drawHud(ctx);
  }

  /**
   * The player, and the reason a pipe swallows him instead of being painted
   * over.
   *
   * Tiles are drawn before entities, so a body sliding into a mouth would sit
   * on top of the pipe it is supposed to be inside. There is no depth here and
   * there should not be one for a single case: a clip to the half of the world
   * on the near side of `transit.hide` costs one rectangle and does exactly
   * what a sprite behind a tile would look like. The 8 px slack on the other
   * three sides is so nothing gets clipped that was not meant to be — the
   * shake jitter can push a frame a couple of pixels either way.
   */
  drawPlayerInto(ctx, camX, camY) {
    const t = this.player.transit;
    if (!t || t.hide === null || t.hide === undefined) {
      this.player.draw(ctx);
      return;
    }
    ctx.save();
    ctx.beginPath();
    const l = camX - 8;
    const top = camY - 8;
    const r = camX + VIEW_W + 8;
    const b = camY + this.viewH + 8;
    if (t.axis === 'x') {
      if (t.hideDir > 0) ctx.rect(l, top, t.hide - l, b - top);
      else ctx.rect(t.hide, top, r - t.hide, b - top);
    } else if (t.hideDir > 0) ctx.rect(l, top, r - l, t.hide - top);
    else ctx.rect(l, t.hide, r - l, b - t.hide);
    ctx.clip();
    this.player.draw(ctx);
    ctx.restore();
  }

  /**
   * The bars. Playfield only — the HUD is not part of the picture, and a
   * widescreen score readout is just a score readout with a slice missing.
   */
  drawLetterbox(ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, VIEW_W, this.bar);
    ctx.fillRect(0, VIEW_H - this.bar, VIEW_W, this.bar);
  }

  /**
   * The playtest heatmap, drawn under the entities so it never hides anything
   * you might need to see. Red columns are deaths, blue ones are stalls — the
   * two mean different things and a single colour would blur them together.
   *
   * Recomputed on a timer rather than every frame: it is a whole-log scan, and
   * a debug overlay has no business costing frame time.
   */
  drawHeatmap(ctx, camX, camY) {
    if (!this._heat || this.tick - this._heatAt > 30) {
      this._heat = levelSummary(this.id);
      this._heatAt = this.tick;
    }
    const heat = this._heat;
    if (!heat.total && !heat.stuckTotal) return;

    const tx0 = Math.max(0, Math.floor(camX / TILE));
    const tx1 = Math.min(this.w - 1, Math.floor((camX + VIEW_W) / TILE));
    for (let tx = tx0; tx <= tx1; tx++) {
      const deaths = heat.deaths.get(tx) || 0;
      const stuck = heat.stuck.get(tx) || 0;
      if (!deaths && !stuck) continue;
      if (deaths) {
        ctx.fillStyle = `rgba(255,48,48,${0.12 + 0.5 * (deaths / heat.worst)})`;
        ctx.fillRect(tx * TILE, camY, TILE, this.viewH);
      }
      if (stuck) {
        ctx.fillStyle = `rgba(64,160,255,${0.1 + 0.4 * (stuck / heat.worst)})`;
        ctx.fillRect(tx * TILE, camY + this.viewH - 6, TILE, 6);
      }
    }
  }

  /**
   * The backdrop is sky, and sky has no business being visible from inside the
   * cave. One wash over the bottom band is all it takes — the tiles are drawn
   * on top of it — so underground reads as underground without a second
   * backdrop, a second theme or a second scene.
   */
  drawUnderground(ctx, camX, camY) {
    const top = this.def.bands.cave * TILE;
    if (camY + this.viewH <= top) return;
    ctx.fillStyle = '#150e1c';
    ctx.fillRect(camX, top, VIEW_W, this.heightPx - top);
  }

  drawTiles(ctx, camX, camY) {
    const tx0 = Math.max(0, Math.floor(camX / TILE));
    const tx1 = Math.min(this.w - 1, Math.floor((camX + VIEW_W) / TILE));
    const ty0 = Math.max(0, Math.floor(camY / TILE));
    const ty1 = Math.min(this.h - 1, Math.floor((camY + this.viewH) / TILE));

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        /* Draw what the tile currently *is*, switch and all — otherwise the
         * bricks you can walk through would still look like bricks. Near the
         * end the two flicker against each other, which is how a player is
         * told to get off them without being told anything. */
        const warning = this.switchTimer > 0 && this.switchTimer < SWITCH_WARN
          && Math.floor(this.tick / 6) % 2 === 0;
        const ch = warning ? this.rawTileAt(tx, ty) : this.tileAt(tx, ty);
        if (ch === ' ') continue;
        const bump = this.bumps.get(`${tx},${ty}`);
        const offset = bump === undefined ? 0 : Math.round(Math.sin((bump / 10) * Math.PI) * -6);
        drawTile(ctx, ch, tx * TILE, ty * TILE + offset, this.theme, tx, ty, this.tick,
          this.tileAt(tx, ty - 1),
          {
            // How far, not whether: the leaves swing. See DOOR_OPEN_FRAMES.
            doorOpen: this.doorOpen,
            crumble: this.crumbleProgress(tx, ty),
            switchOn: this.switchTimer > 0,
            // A door is several tiles; each slice needs to know which of its
            // sides are the outside of the whole door.
            /* A ground tile beside a spike bed gets a hazard stripe on that
             * edge. Computed here because the drawing code sees one tile at a
             * time and this is a question about the tile next door. */
            warn: ch === T.GROUND
              ? (this.tileAt(tx - 1, ty - 1) === T.SPIKE ? -1
                : this.tileAt(tx + 1, ty - 1) === T.SPIKE ? 1 : 0)
              : 0,
            /* `info(ch).door` and not `ch === T.DOOR`: the flag existed and was
             * read nowhere, which is a thing that looks live and is not. It is
             * the question being asked here, so it is the thing to ask. */
            doorEdges: info(ch).door ? {
              l: !info(this.tileAt(tx - 1, ty)).door,
              r: !info(this.tileAt(tx + 1, ty)).door,
              t: !info(this.tileAt(tx, ty - 1)).door,
              b: !info(this.tileAt(tx, ty + 1)).door,
            } : null,
          });
      }
    }
  }

  /**
   * A banner with some swagger: it punches in from oversized, rocks gently,
   * and cycles colour. A flat line of white text is an error message, not a
   * moment.
   */
  drawBanner(ctx, text, y, colors) {
    const age = this.stateTimer;
    const punch = age < 8;
    const scale = punch ? 3 : 2;
    const rock = Math.round(Math.sin(age / 7) * 2);
    const color = colors[Math.floor(age / 6) % colors.length];
    const cx = VIEW_W / 2;
    const width = textWidth(text, scale);

    ctx.fillStyle = 'rgba(8,8,16,0.55)';
    ctx.fillRect(cx - width / 2 - 8, y - 6, width + 16, scale * 7 + 12);
    ctx.fillStyle = color;
    ctx.fillRect(cx - width / 2 - 8, y - 6, width + 16, 2);
    ctx.fillRect(cx - width / 2 - 8, y + scale * 7 + 4, width + 16, 2);

    drawText(ctx, text, cx + rock, y, {
      color, align: 'center', shadow: '#101018', scale,
    });
  }

  drawHud(ctx) {
    const th = THEMES[this.theme] || THEMES.grass;
    const y = VIEW_H;
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, y, VIEW_W, HUD_H);
    ctx.fillStyle = th.hardDark;
    ctx.fillRect(0, y, VIEW_W, 1);

    // reserve item box
    ctx.fillStyle = '#202038';
    ctx.fillRect(6, y + 6, 20, 20);
    ctx.fillStyle = '#50506e';
    ctx.fillRect(6, y + 6, 20, 1);
    ctx.fillRect(6, y + 25, 20, 1);
    ctx.fillRect(6, y + 6, 1, 20);
    ctx.fillRect(25, y + 6, 1, 20);
    if (this.game.state.reserve) drawItem(ctx, this.game.state.reserve, 8, y + 8, this.tick);

    // P-meter
    drawText(ctx, 'P', 34, y + 6, { color: '#ffffff' });
    const bars = this.player.pBars;
    const full = this.player.pMeter >= P_METER_MAX;
    for (let i = 0; i < 7; i++) {
      const lit = i < bars;
      const blink = full && Math.floor(this.tick / 4) % 2 === 0;
      ctx.fillStyle = lit ? (full && blink ? '#ffffff' : '#f0b000') : '#3a3a52';
      const bx = 42 + i * 7;
      ctx.fillRect(bx, y + 6, 5, 7);
      ctx.fillStyle = '#101018';
      ctx.fillRect(bx + 5, y + 6, 2, 7);
    }
    // power level pips — one per collected power-up, colour shows the type
    const p = this.player;
    const typeColor = { shroom: '#e04c3c', flower: '#f8f8f8', leaf: '#c88c40' }[p.type] || '#3a3a52';
    for (let i = 0; i < 5; i++) {
      const bx = 34 + i * 7;
      ctx.fillStyle = i < p.powerLevel ? typeColor : '#2a2a3e';
      ctx.fillRect(bx, y + 18, 5, 5);
      if (i < p.powerLevel) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(bx, y + 18, 5, 1);
      }
    }
    drawText(ctx, `SFB *${this.game.state.lives}`, 100, y + 6, { color: '#ffffff' });
    drawText(ctx, `KOLIKOT ${padNum(this.game.state.coins, 2)}`, 100, y + 17, { color: '#ffd048' });

    drawText(ctx, `MAAILMA ${this.id}`, 196, y + 6, { color: '#8fe04a' });
    const timeColor = this.time <= 100 ? (Math.floor(this.tick / 8) % 2 ? '#ff6060' : '#ffffff') : '#ffffff';
    drawText(ctx, `AIKA ${padNum(this.time, 3)}`, 196, y + 17, { color: timeColor });

    drawText(ctx, padNum(this.game.state.score, 7), VIEW_W - 6, y + 6, {
      color: '#ffffff', align: 'right',
    });
    if (this.player.star > 0) {
      // Top of the pile: it is the shortest-lived of the three and the only one
      // whose ending gets you killed.
      const secs = Math.ceil(this.player.star / 60);
      drawText(ctx, `TÄHTI ${secs}`, VIEW_W - 6, y + 17, {
        color: STAR_HUD_COLORS[Math.floor(this.tick / 4) % STAR_HUD_COLORS.length],
        align: 'right',
      });
    } else if (this.switchTimer > 0) {
      const secs = Math.ceil(this.switchTimer / 60);
      drawText(ctx, `KYTKIN ${secs}`, VIEW_W - 6, y + 17, {
        color: this.switchTimer < SWITCH_WARN && Math.floor(this.tick / 6) % 2
          ? '#ff8040' : '#8fd0ff',
        align: 'right',
      });
    } else if (this.player.corked > 0) {
      const secs = Math.ceil(this.player.corked / 60);
      drawText(ctx, `UMMETUS ${secs}`, VIEW_W - 6, y + 17, {
        color: Math.floor(this.tick / 6) % 2 ? '#ff8040' : '#c85820', align: 'right',
      });
    } else if (this.bossDefeated) {
      drawText(ctx, 'OVI AUKI', VIEW_W - 6, y + 17, { color: '#ffd048', align: 'right' });
    }

    if (this.state === 'clear' && this.wonCard) {
      this.drawBanner(ctx, 'KENTTÄ SELVÄ!', 54, ['#ffd048', '#ffffff', '#8fe04a']);
      drawItem(ctx, this.wonCard, VIEW_W / 2 - 8, 84, this.tick);
    }
    if (this.state === 'dead') {
      this.drawBanner(ctx, 'VOI EI!', 74, ['#ff6060', '#ffffff', '#ffb040']);
    }
  }
}
