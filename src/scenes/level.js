import { getLevel } from '../data/levels.js';
import { TILE, T, info, isSolid, drawTile, THEMES } from '../gfx/tiles.js';
import { drawBackdrop } from '../gfx/backdrop.js';
import { drawGoal, drawItem } from '../gfx/sprites.js';
import { drawText } from '../gfx/font.js';
import { Player, P_METER_MAX } from '../entities/player.js';
import { ENEMY_CHARS } from '../entities/enemies.js';
import { Item } from '../entities/items.js';
import { Puff, ScorePop, BrickPiece, CoinPop } from '../entities/effects.js';
import { Music, Sfx } from '../core/audio.js';
import { clamp, overlaps, padNum } from '../core/utils.js';

export const VIEW_W = 320;
export const VIEW_H = 208;
export const HUD_H = 32;

const GOAL_HEIGHT = 6 * TILE;

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
    this.cam = { x: 0, y: 0 };
    this.tick = 0;
    this.time = this.def.time;
    this.timeSub = 0;
    this.state = 'play';
    this.stateTimer = 0;
    this.bossDefeated = false;
    this.goal = null;
    this.cardIndex = 0;
    this.wonCard = null;
    this.spawn = { x: 2 * TILE, y: 12 * TILE };

    this.scanGrid();
    this.player = new Player(this, this.spawn.x, this.spawn.y + TILE, game.state.power);
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
    Music.play(this.def.music || 'level');
  }

  /* ------------------------------ level API ---------------------------- */

  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.w) return T.HARD;   // solid level edges
    if (ty < 0 || ty >= this.h) return T.EMPTY;
    return this.grid[ty][tx];
  }

  setTile(tx, ty, ch) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
    this.grid[ty][tx] = ch;
  }

  solidAt(tx, ty) {
    return isSolid(this.tileAt(tx, ty));
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
    Sfx.play('brick');
  }

  addScorePop(x, y, text) {
    this.add(new ScorePop(this, x, y, text));
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
    Sfx.play('clear');
    this.addScorePop(this.player.cx, this.player.y - 12, 'OVI AUKI');
  }

  onPlayerDied() {
    this.state = 'dead';
    this.stateTimer = 0;
    Music.stop();
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

    this.updateEntities();
    if (this.state !== 'dead') this.collisions();
    this.updateCamera();
    this.updateBumps();
    if (this.goal && this.state === 'play') this.cardIndex = Math.floor(this.tick / 9) % 3;
  }

  updateTimer() {
    if (++this.timeSub >= 24) {
      this.timeSub = 0;
      this.time--;
      if (this.time <= 0) {
        this.time = 0;
        this.player.die();
      } else if (this.time === 100) {
        Sfx.play('cursor');
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
      if (e.x + e.w < this.cam.x - 240 && e.kind === 'enemy') e.remove = true;
    }
    this.entities = this.entities.filter((e) => !e.remove);
  }

  updateBumps() {
    for (const [key, value] of this.bumps) {
      const next = value + 1;
      if (next > 10) this.bumps.delete(key);
      else this.bumps.set(key, next);
    }
  }

  updateCamera() {
    const targetX = this.player.cx - VIEW_W / 2;
    this.cam.x = clamp(targetX, 0, Math.max(0, this.widthPx - VIEW_W));
    const targetY = this.player.y - VIEW_H * 0.55;
    const maxY = Math.max(0, this.heightPx - VIEW_H);
    this.cam.y = clamp(targetY, 0, maxY);
  }

  centerCamera() {
    this.cam.x = clamp(this.player.cx - VIEW_W / 2, 0, Math.max(0, this.widthPx - VIEW_W));
    this.cam.y = clamp(this.player.y - VIEW_H * 0.55, 0, Math.max(0, this.heightPx - VIEW_H));
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
          p.die();
          return;
        } else if (ch === T.SPIKE) {
          if (p.hurt()) p.vy = -3;
        } else if (ch === T.DOOR && this.bossDefeated) {
          this.completeLevel(null);
          return;
        }
      }
    }

    if (p.y > this.heightPx + 8) p.die();

    if (this.goal && this.state === 'play') {
      const pole = { x: this.goal.x + 4, y: this.goal.y - 8, w: 10, h: GOAL_HEIGHT + 8 };
      if (overlaps(p.box, pole)) this.completeLevel(['shroom', 'flower', 'star'][this.cardIndex]);
    }
  }

  collisions() {
    const p = this.player;
    if (p.dying) return;
    const spin = p.spinBox;

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
        if (e.box.h > 0 && overlaps(p.box, e.box)) p.hurt();
        continue;
      }

      if (e.kind !== 'enemy' || e.dying) continue;

      if (spin && overlaps(spin, e.box)) {
        e.hitByTail(p.facing);
        continue;
      }

      if (!overlaps(p.box, e.box)) continue;

      const stomping = p.vy > 0 && p.y + p.h - p.vy <= e.y + e.h * 0.6;
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

    drawBackdrop(ctx, this.def.bg, this.theme, this.cam.x, VIEW_W, VIEW_H, this.tick);

    const camX = Math.round(this.cam.x);
    const camY = Math.round(this.cam.y);
    ctx.translate(-camX, -camY);

    this.drawTiles(ctx, camX, camY);
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

  drawTiles(ctx, camX, camY) {
    const tx0 = Math.max(0, Math.floor(camX / TILE));
    const tx1 = Math.min(this.w - 1, Math.floor((camX + VIEW_W) / TILE));
    const ty0 = Math.max(0, Math.floor(camY / TILE));
    const ty1 = Math.min(this.h - 1, Math.floor((camY + VIEW_H) / TILE));

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const ch = this.grid[ty][tx];
        if (ch === ' ') continue;
        const bump = this.bumps.get(`${tx},${ty}`);
        const offset = bump === undefined ? 0 : Math.round(Math.sin((bump / 10) * Math.PI) * -6);
        drawTile(ctx, ch, tx * TILE, ty * TILE + offset, this.theme, tx, ty, this.tick,
          this.tileAt(tx, ty - 1));
      }
    }
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
    if (this.player.corked > 0) {
      const secs = Math.ceil(this.player.corked / 60);
      drawText(ctx, `UMMETUS ${secs}`, VIEW_W - 6, y + 17, {
        color: Math.floor(this.tick / 6) % 2 ? '#ff8040' : '#c85820', align: 'right',
      });
    } else if (this.bossDefeated) {
      drawText(ctx, 'OVI AUKI', VIEW_W - 6, y + 17, { color: '#ffd048', align: 'right' });
    }

    if (this.state === 'clear' && this.wonCard) {
      const cx = VIEW_W / 2;
      drawText(ctx, 'KENTTA SELVA!', cx, 60, { color: '#ffffff', align: 'center', shadow: '#202030' });
      drawItem(ctx, this.wonCard, cx - 8, 76, this.tick);
    }
    if (this.state === 'dead') {
      drawText(ctx, 'VOI EI!', VIEW_W / 2, 80, { color: '#ffffff', align: 'center', shadow: '#202030' });
    }
  }
}
