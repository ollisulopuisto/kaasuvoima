import { getLevel } from '../data/levels.js';
import { TILE, T, info, isSolid, isSemi, drawTile, THEMES, SWITCH_MAP } from '../gfx/tiles.js';
import { drawBackdrop } from '../gfx/backdrop.js';
import { drawGoal, drawItem } from '../gfx/sprites.js';
import { drawText, textWidth } from '../gfx/font.js';
import { Player, P_METER_MAX, MAX_RUN } from '../entities/player.js';
import { ENEMY_CHARS } from '../entities/enemies.js';
import { Item } from '../entities/items.js';
import { Puff, ScorePop, BrickPiece, CoinPop } from '../entities/effects.js';
import { Music, Sfx } from '../core/audio.js';
import { logDeath, logClear, logStuck, levelSummary } from '../core/telemetry.js';
import { clamp, overlaps, padNum } from '../core/utils.js';

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
    this.cam = { x: 0, y: 0 };
    this.camLook = 0;
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
  }

  /** Kicks the camera for a frame or two. Purely cosmetic. */
  shake(amount) {
    this.shakeAmp = Math.min(6, Math.max(this.shakeAmp, amount));
  }

  /* ------------------------------ level API ---------------------------- */

  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.w) return T.HARD;   // solid level edges
    if (ty < 0 || ty >= this.h) return T.EMPTY;
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

  onBossDefeated() {
    this.bossDefeated = true;
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

  /**
   * Warp pipes. The bands of a tall level are a fixed number of rows apart, so
   * travelling between them is an addition and nothing else: no second scene,
   * no transition, no save logic of its own. Down goes down a band, up goes up.
   *
   * Two things can refuse: rock where you would arrive, and a band with no
   * ground under the arrival. The second is what stops the surface pipe from
   * being a way to drop yourself out of the sky onto your own head.
   */
  tryWarp(input) {
    const bands = this.def.bands;
    const p = this.player;
    if (!bands || p.dying || !p.onGround || p.warpLock > 0) return;
    const dir = input.held.down ? 1 : input.held.up ? -1 : 0;
    if (!dir) return;

    const under = Math.floor((p.y + p.h) / TILE);
    const x0 = Math.floor(p.x / TILE);
    const x1 = Math.floor((p.x + p.w - 1) / TILE);
    let onPipe = false;
    for (let tx = x0; tx <= x1; tx++) if (info(this.tileAt(tx, under)).warp) onPipe = true;
    if (!onPipe) return;

    const shift = dir * bands.rows * TILE;
    if (!this.fits(p.x, p.y + shift, p.w, p.h)) return;
    const feet = Math.floor((p.y + shift + p.h) / TILE);
    const bandEnd = (Math.floor(feet / bands.rows) + 1) * bands.rows - 1;
    if (!this.footingWithin(p.x, p.w, feet, bandEnd)) return;

    p.y += shift;
    p.vy = 0;
    p.climbing = false;
    p.warpLock = 24;
    this.centerCamera();
    this.spawnPuff(p.cx, p.y + p.h);
    Sfx.play('door');
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

  bumpTile(tx, ty, player) {
    const ch = this.tileAt(tx, ty);
    const meta = info(ch);
    if (!meta.bumpable) return;

    const key = `${tx},${ty}`;
    if (this.bumps.has(key)) return;
    this.bumps.set(key, 0);
    this.flipEnemiesAbove(tx, ty);

    if (meta.question) {
      this.setTile(tx, ty, T.USED);
      if (ch === T.QCOIN) {
        this.add(new CoinPop(this, tx * TILE, ty * TILE - TILE));
        this.addCoin(tx * TILE + 8, ty * TILE);
      } else {
        this.add(new Item(this, tx * TILE, ty * TILE - TILE, this.rollPowerup(player)));
        Sfx.play('bump');
      }
      return;
    }

    if (ch === T.BRICK) {
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
    if (this.shakeAmp > 0) this.shakeAmp = Math.max(0, this.shakeAmp - 0.4);
    this.updateEntities();
    if (this.state !== 'dead') this.collisions();
    this.updateCamera();
    this.updateBumps();
    this.updateCrumbles();
    this.updateSwitch();
    if (this.goal && this.state === 'play') this.cardIndex = Math.floor(this.tick / 9) % 3;
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
   */
  updateCamera() {
    const p = this.player;
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
    // Inside a band there is barely anywhere to go, so the ease is invisible;
    // it is there for the moment the band under the player changes.
    this.cam.y = this.def.bands ? this.cam.y + (want - this.cam.y) * CAM_BAND_EASE : want;
  }

  /**
   * Where the view wants to sit vertically.
   *
   * A tall level is bands of the same 15 rows a short level has, and the camera
   * stays inside the one the player is in. That is not a detail: without it the
   * view would follow every jump over 208 pixels of free travel, which is the
   * seasickness the horizontal camera goes to such lengths to avoid — and it
   * would show the secret above or below while you walked past underneath.
   */
  cameraY() {
    const p = this.player;
    const target = p.y - VIEW_H * 0.55;
    const bands = this.def.bands;
    if (!bands) return clamp(target, 0, Math.max(0, this.heightPx - VIEW_H));
    // The view holds still while you die: following the body down would pan it
    // straight through whatever is under the pit you just fell into.
    if (p.dying) return this.cam.y;
    /* Which band you are in is decided by your feet, not your middle. Falling
     * into a pit puts your middle in the band below for the few frames before
     * the lava under the pit gets you, and that was enough to lurch the view
     * down and show the secret to someone who was only dying. */
    const span = bands.rows * TILE;
    const feet = Math.floor((p.y + p.h - 1) / span) * span;
    const top = clamp(feet, 0, this.heightPx - span);
    return clamp(target, top, top + span - VIEW_H);
  }

  centerCamera() {
    this.camLook = 0;
    this.cam.x = clamp(this.player.cx - VIEW_W / 2, 0, Math.max(0, this.widthPx - VIEW_W));
    this.cam.y = this.cameraY();
  }

  /* ------------------------------ collisions --------------------------- */

  playerTiles() {
    const p = this.player;
    if (p.dying) return;
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
        } else if (ch === T.SPIKE) {
          if (p.hurt('spike')) p.vy = -3;
        } else if (ch === T.DOOR && this.bossDefeated) {
          this.completeLevel(null);
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
    if (p.dying) return;
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

      if (e.kind !== 'enemy' || e.dying || e.harmless) continue;

      if (spin && overlaps(spin, e.box)) {
        e.hitByTail(p.facing);
        continue;
      }

      if (!overlaps(p.box, e.box)) continue;

      const stomping = fallVy > 0 && p.y + p.h - fallVy <= e.y + e.h * 0.6;
      if (stomping && e.stompable) {
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
    Sfx.play('clear');
  }

  /* --------------------------------- draw ------------------------------ */

  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    ctx.clip();

    /* The scenery belongs to the ground band. Once the camera is above it —
     * up the beanstalk — the hills have to get out of the way, or a platform
     * twenty tiles in the air looks like it is standing on them. */
    const bandDrop = this.def.bands
      ? Math.max(0, (this.def.bands.main * TILE - this.cam.y) * 0.6) : 0;
    drawBackdrop(ctx, this.def.bg, this.theme, this.cam.x, VIEW_W, VIEW_H, this.tick, bandDrop);

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

    for (const e of this.entities) {
      if (!e.active) continue;
      if (e.x + e.w < camX - 32 || e.x > camX + VIEW_W + 32) continue;
      e.draw(ctx);
    }
    this.player.draw(ctx);

    ctx.restore();
    this.drawHud(ctx);
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
        ctx.fillRect(tx * TILE, camY, TILE, VIEW_H);
      }
      if (stuck) {
        ctx.fillStyle = `rgba(64,160,255,${0.1 + 0.4 * (stuck / heat.worst)})`;
        ctx.fillRect(tx * TILE, camY + VIEW_H - 6, TILE, 6);
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
    if (camY + VIEW_H <= top) return;
    ctx.fillStyle = '#150e1c';
    ctx.fillRect(camX, top, VIEW_W, this.heightPx - top);
  }

  drawTiles(ctx, camX, camY) {
    const tx0 = Math.max(0, Math.floor(camX / TILE));
    const tx1 = Math.min(this.w - 1, Math.floor((camX + VIEW_W) / TILE));
    const ty0 = Math.max(0, Math.floor(camY / TILE));
    const ty1 = Math.min(this.h - 1, Math.floor((camY + VIEW_H) / TILE));

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
            doorOpen: this.bossDefeated,
            crumble: this.crumbleProgress(tx, ty),
            switchOn: this.switchTimer > 0,
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
    if (this.switchTimer > 0) {
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
