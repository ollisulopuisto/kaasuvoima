import { Entity } from './entity.js';
import { drawGasPuff } from '../gfx/sprites.js';
import { drawCoinSprite, drawSplinter, THEMES } from '../gfx/tiles.js';
import { drawText } from '../gfx/font.js';
/* Kolikon arvo tulee pistetaulukosta, ei tästä tiedostosta. */
import { COIN } from '../core/points.js';

export class Puff extends Entity {
  constructor(level, x, y, { spread = 0, size = 4, life = 24, brown = false } = {}) {
    super(level, x - size, y - size, size * 2, size * 2);
    this.kind = 'effect';
    this.alwaysActive = true;
    this.active = true;
    this.maxLife = life;
    this.life = life;
    this.size = size;
    this.brown = brown;
    this.vx = (Math.random() - 0.5) * spread;
    this.vy = -0.3 - Math.random() * 0.4;
  }

  update() {
    this.tick++;
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    if (this.life <= 0) this.remove = true;
  }

  draw(ctx) {
    const t = this.life / this.maxLife;
    drawGasPuff(ctx, this.cx, this.cy, t, this.size * (1.6 - t * 0.6), this.brown);
  }
}

/**
 * The score numbers used to slide up quietly and vanish. Rewards should feel
 * like rewards, so now they punch: a big white pop on the first few frames,
 * settling to normal size, with a burst of sparks for anything worth having.
 * The bigger the number, the bigger the noise it makes.
 */
export class ScorePop extends Entity {
  constructor(level, x, y, text) {
    super(level, x, y, 1, 1);
    this.kind = 'effect';
    this.alwaysActive = true;
    this.active = true;
    this.text = String(text);
    this.maxLife = 52;
    this.life = this.maxLife;
    const value = Number(text);
    // 1UP and four-figure scores are events; 200 for a coin is not.
    this.big = Number.isNaN(value) || value >= 1000;
  }

  get age() { return this.maxLife - this.life; }

  update() {
    this.tick++;
    // Shoots up, then eases as it fades — a flat drift reads as a UI element,
    // an eased one reads as something that happened.
    this.y -= 1.6 * (this.life / this.maxLife) ** 1.5 + 0.15;
    this.life--;
    if (this.life <= 0) this.remove = true;
  }

  draw(ctx) {
    const { age } = this;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const fade = this.life / this.maxLife;

    if (this.big && age < 14) {
      // the burst: sparks flying out, fastest at the start
      const spread = 3 + age * 1.6;
      ctx.fillStyle = age < 6 ? '#ffffff' : '#ffd048';
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + age * 0.08;
        ctx.fillRect(
          Math.round(x + Math.cos(a) * spread), Math.round(y + 3 + Math.sin(a) * spread * 0.7),
          2, 2,
        );
      }
    }

    // Double size for the first few frames, then settle. The font only does
    // whole-number scales, so the pop is a step rather than a smooth zoom.
    const punchy = age < (this.big ? 10 : 5);
    drawText(ctx, this.text, x, y - (punchy ? 4 : 0), {
      color: punchy ? '#ffffff' : (this.big ? '#ffd048' : '#e8e8f4'),
      align: 'center',
      shadow: fade > 0.25 ? '#202030' : null,
      scale: punchy ? 2 : 1,
    });
  }
}

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

/**
 * A piece of a broken plank.
 *
 * The scene spawns four of these on a tidy symmetric cross and it will keep
 * doing that, because the scene is not ours to change — so the variety has to
 * live in the piece. Four identical squares leaving in matched pairs is a
 * diagram of an explosion; wood comes apart in slivers of different lengths
 * that tumble at different rates and fall at different speeds, and one piece in
 * five is a nail, which is the detail that names the material.
 *
 * Each piece is a small cluster rather than a single shard, and that is a
 * measurement rather than a flourish: single shards put 53 lit pixels a frame
 * on screen against the old four squares' 144, and a smash you have to look
 * for is not a smash. The cluster restores the mass and spends it on shapes.
 */
export class BrickPiece extends Entity {
  constructor(level, x, y, dx, dy, theme) {
    super(level, x, y, 8, 8);
    this.kind = 'effect';
    this.alwaysActive = true;
    this.active = true;

    const nail = Math.random() < 0.2;
    this.bits = nail
      ? [
        // A nail does not come out clean; it brings the board it was in.
        { dx: 0, dy: 0, len: 5, thick: 1, phase: 0, nail: true },
        { dx: rnd(2, 4), dy: rnd(1, 3), len: rnd(4, 6), thick: 3, phase: 2 },
      ]
      : [
        { dx: 0, dy: 0, len: rnd(6, 8), thick: 3, phase: 0 },
        { dx: rnd(-5, -2), dy: rnd(1, 3), len: rnd(4, 6), thick: 2, phase: 1 },
        { dx: rnd(2, 4), dy: rnd(-4, -1), len: rnd(4, 6), thick: 2, phase: 3 },
      ];

    // Skew and jitter break the mirror: a splinter that came off cleanly keeps
    // most of the launch it was given, one that tore off keeps rather less.
    this.vx = dx * (0.55 + Math.random() * 1.1) + (Math.random() - 0.5) * 1.6;
    this.vy = dy * (0.7 + Math.random() * 0.6) - Math.random() * 0.9;
    // Slivers hang in the air, chunks and nails drop. Same launch, different arc.
    this.gravity = nail ? 0.42 : 0.22 + Math.random() * 0.2;
    this.spin = (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.26);
    this.frame = Math.random() * 4;
    this.theme = theme;
  }

  update() {
    this.tick++;
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= 0.985;                 // drag, so the two halves drift apart
    this.frame += this.spin;
    if (this.y > this.level.heightPx + 24) this.remove = true;
  }

  draw(ctx) {
    const th = THEMES[this.theme] || THEMES.grass;
    const x = Math.round(this.x);
    const y = Math.round(this.y);

    // Sawdust, only for the first moments: the burst is what sells the smash,
    // and a shard trailing dust for its whole flight would read as smoke.
    if (this.tick < 9) {
      ctx.fillStyle = th.brickLight;
      ctx.fillRect(x - Math.round(this.vx * 2), y - Math.round(this.vy * 2), 1, 1);
      ctx.fillStyle = th.brick;
      ctx.fillRect(x - Math.round(this.vx * 3.5) + 1, y - Math.round(this.vy * 3), 1, 1);
    }

    // The cluster opens out as it flies, so a smash keeps growing for a moment
    // instead of being one shape that merely travels.
    const spread = 1 + Math.min(this.tick, 22) * 0.09;
    const bits = this.bits || [{ dx: 0, dy: 0, len: 6, thick: 3, phase: 0 }];
    for (const b of bits) {
      const f = (((Math.floor(this.frame) + b.phase) % 4) + 4) % 4;
      const bx = x + Math.round(b.dx * spread);
      const by = y + Math.round(b.dy * spread);
      if (b.nail) drawSplinter(ctx, bx, by, b.len, 1, f, th.hardDark, th.hardLight, th.hardDark);
      else drawSplinter(ctx, bx, by, b.len, b.thick, f, th.brick, th.brickLight, th.brickDark);
    }
  }
}

/**
 * MAAHANISKUN ISKUAALTO — the ring a hard ground pound leaves on the floor.
 *
 * It is not the boss's `Shockwave` and it must never be mistaken for one.
 * DESIGN.md §8 is explicit that a new "something happened" signal which looks
 * like an old one teaches the player to read the wrong thing, and this game
 * already spends the boss's shockwave on a specific promise: a tan-brown blob
 * that *runs along the floor at you* and will hurt you if it arrives. So the
 * three things that carry a signal are all different here, on purpose:
 *
 *   - **colour.** Gas green, the same `rgba(150,220,90)` family every fart in
 *     the game is drawn in, against the boss's tan-brown. That keeps the
 *     existing reading intact — brown is his, green is yours.
 *   - **rhythm.** His flickers between two pictures every three frames and
 *     keeps going for ninety. This swells outward once, smoothly, and is gone:
 *     no two frames of it are ever the same picture.
 *   - **shape and errand.** His is a body that travels and collides. This is a
 *     ring that opens around a point and touches nothing — the damage was
 *     already dealt at the moment of impact by `LevelScene.poundImpact`. It is
 *     a report of something that has happened, not a thing that is coming, and
 *     therefore an `effect` and not an `enemy`.
 *
 * `reach` is the blast's own radius, so what the player sees is the size of
 * what actually hit: DESIGN.md §7, what can hurt should be what is shown.
 */
export class PoundWave extends Entity {
  constructor(level, x, y, reach) {
    super(level, x - reach, y - 8, reach * 2, 8);
    this.kind = 'effect';
    this.alwaysActive = true;
    this.active = true;
    this.originX = x;
    this.originY = y;
    this.reach = reach;
    /* Short. A ring that lingers stops being an impact and starts being a
     * pool of gas lying on the floor, and the impact is the whole message. */
    this.maxLife = 22;
    this.life = this.maxLife;
  }

  update() {
    this.tick++;
    if (--this.life <= 0) this.remove = true;
  }

  draw(ctx) {
    // 0 at the moment of impact, 1 as it dies. Eased out, because a ring that
    // opens at a constant rate reads as a drawn circle growing and one that
    // opens fastest at the start reads as something having been released.
    const t = 1 - Math.max(0, this.life) / this.maxLife;
    const ease = 1 - (1 - t) ** 2;
    const r = Math.round(6 + (this.reach - 6) * ease);
    const fade = 1 - t;
    const y = Math.round(this.originY);
    const x = Math.round(this.originX);
    // Two arms leaving the landing spot, each a low bar that thins as it goes:
    // the gas is being squeezed out sideways along the ground, which is what a
    // ring seen edge-on in a side-scroller actually looks like.
    const h = Math.max(1, Math.round(5 * fade));
    ctx.fillStyle = `rgba(150,220,90,${(0.55 * fade).toFixed(3)})`;
    ctx.fillRect(x - r, y - h, r * 2, h);
    ctx.fillStyle = `rgba(210,255,150,${(0.7 * fade).toFixed(3)})`;
    // The bright leading edge — three pixels at each end, which is the part
    // the eye actually tracks outwards.
    ctx.fillRect(x - r, y - h - 1, 3, h + 1);
    ctx.fillRect(x + r - 3, y - h - 1, 3, h + 1);
  }
}

/** The coin that pops out of a bumped block. */
export class CoinPop extends Entity {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    this.kind = 'effect';
    this.alwaysActive = true;
    this.active = true;
    this.vy = -4.4;
    this.life = 32;
  }

  update() {
    this.tick++;
    this.y += this.vy;
    this.vy += 0.32;
    this.life--;
    if (this.life <= 0) {
      this.level.addScorePop(this.cx, this.y, COIN);
      this.remove = true;
    }
  }

  draw(ctx) {
    drawCoinSprite(ctx, this.x, this.y, this.tick * 2);
  }
}
