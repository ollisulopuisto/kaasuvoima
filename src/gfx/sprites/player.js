/**
 * The player, from one 14x26 template that gets blitted with nearest-neighbour
 * scaling — which is how the five power levels grow.
 *
 * Everything the character does while standing still is here too. It is the
 * same drawing as the walk cycle seen from one frame further on, so keeping the
 * idle poses next to the body that performs them is the only way a change to
 * one is checked against the other.
 */

import { C, outlined, flip, recolored, glowing } from './palette.js';

/** Body box per power level (0 = no power-up, 5 = fully gassed). */
export const PLAYER_SIZES = [
  { w: 12, h: 16 },
  { w: 14, h: 26 },
  { w: 15, h: 30 },
  { w: 17, h: 34 },
  { w: 19, h: 38 },
  { w: 21, h: 43 },
];

export const PLAYER_DUCK_SIZES = [
  { w: 12, h: 16 },
  { w: 14, h: 16 },
  { w: 15, h: 19 },
  { w: 17, h: 21 },
  { w: 19, h: 24 },
  { w: 21, h: 27 },
];

const BASE_NORMAL = { w: 14, h: 26 };
const BASE_DUCK = { w: 14, h: 16 };

const PALETTES = {
  none: { cap: C.green, shirt: C.green, shirtDark: C.greenDark, pants: C.brown, pantsDark: C.brownDark },
  shroom: { cap: '#e04c3c', shirt: C.green, shirtDark: C.greenDark, pants: C.brown, pantsDark: C.brownDark, spots: true },
  flower: { cap: C.white, shirt: C.white, shirtDark: '#c8c8d0', pants: C.green, pantsDark: C.greenDark },
  leaf: { cap: C.tan, shirt: C.tan, shirtDark: '#9c6a28', pants: C.brown, pantsDark: C.brownDark },
};

function legs(ctx, x, y, w, pal, frame, running) {
  ctx.fillStyle = pal.pants;
  const spread = running ? 4 : 3;
  if (frame === 0) {
    ctx.fillRect(x + 2, y, spread, 3);
    ctx.fillRect(x + w - 2 - spread, y, spread, 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 1, y + 3, spread + 1, 2);
    ctx.fillRect(x + w - 2 - spread, y + 3, spread + 1, 2);
  } else if (frame === 1) {
    ctx.fillRect(x + 3, y, w - 6, 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 2, y + 3, w - 4, 2);
  } else {
    ctx.fillRect(x + 1, y, spread, 3);
    ctx.fillRect(x + w - 3 - spread, y + 1, spread, 2);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x, y + 3, spread + 2, 2);
    ctx.fillRect(x + w - 3 - spread, y + 3, spread, 2);
  }
}

/** Wagging raccoon tail, drawn behind the body (the sprite always faces +x). */
function tail(ctx, x, y, wag) {
  const dx = Math.round(Math.sin(wag) * 2);
  ctx.fillStyle = C.tan;
  ctx.fillRect(x - 4, y + 1, 5, 5);
  ctx.fillRect(x - 8, y - 1 + dx, 5, 5);
  ctx.fillRect(x - 11, y - 4 + dx * 2, 4, 5);
  ctx.fillStyle = C.brownDark;
  ctx.fillRect(x - 8, y + 3 + dx, 5, 1);
  ctx.fillRect(x - 11, y + dx * 2, 4, 1);
  ctx.fillRect(x - 11, y - 4 + dx * 2, 4, 1);
}

function ears(ctx, x, y, w) {
  ctx.fillStyle = C.tan;
  ctx.fillRect(x + 1, y - 2, 2, 3);
  ctx.fillRect(x + w - 3, y - 2, 2, 3);
  ctx.fillStyle = C.brownDark;
  ctx.fillRect(x + 1, y - 2, 1, 1);
  ctx.fillRect(x + w - 2, y - 2, 1, 1);
}

function capSpots(ctx, x, y, w) {
  ctx.fillStyle = C.white;
  ctx.fillRect(x + 4, y, 2, 2);
  ctx.fillRect(x + 8, y + 1, 2, 2);
  ctx.fillRect(x + w - 4, y, 2, 2);
}

/**
 * What the player is doing while doing nothing. A standing sprite that does not
 * move reads as a paused game, so there is always at least a breath, and after
 * a few seconds of genuine idleness the character starts amusing itself.
 *
 * Everything here is a pure function of tick and idle time, so the outline pass
 * replays it identically and a save state restores the same pose.
 */
function idlePose(s) {
  const tick = s.tick || 0;
  const idle = s.idle || 0;
  const still = s.state === 'idle' && !s.ducking;
  const pose = {
    breath: 0, eye: 0, blink: false, scratch: 0, tap: 0, look: 0, shiver: 0, sweat: -1,
  };
  if (!still) return pose;

  // Breathing: the torso rises and settles about once every one and a half
  // seconds. One pixel is plenty at this size.
  pose.breath = Math.sin(tick / 26) > 0.55 ? -1 : 0;
  // A blink every couple of seconds, three frames long.
  pose.blink = tick % 150 < 4;

  if (idle < 200) return pose;

  // After a few seconds standing around: look up, look down, scratch, repeat.
  const beat = Math.floor((idle - 200) / 90) % 4;
  const phase = (idle - 200) % 90;
  if (beat === 0 && phase > 20 && phase < 70) pose.look = -1;        // up
  else if (beat === 2 && phase > 20 && phase < 60) pose.look = 1;    // down
  else if (beat === 1 && phase > 15 && phase < 65) {
    pose.scratch = Math.floor(phase / 5) % 2 ? 1 : 2;                // behind, twice a second
  } else if (beat === 3 && phase > 20 && phase < 70) {
    pose.tap = Math.floor(phase / 7) % 2;                            // foot tapping
  }
  pose.eye = pose.look;

  /*
   * Standing about is where a character says what kind of place this is. The
   * ice world makes him shiver and the desert makes him mop his brow, which is
   * the cheapest scenery in the game: it costs a couple of pixels and it tells
   * you the temperature without a word.
   *
   * Layered on top of the ordinary idle beats rather than replacing them, so
   * the character keeps his own habits and only picks up the weather.
   */
  if (s.theme === 'ice') {
    // Shivering comes in bursts. A constant tremble reads as a broken sprite.
    const shake = (idle - 200) % 150;
    if (shake < 46) pose.shiver = Math.floor(tick / 2) % 2 ? 1 : -1;
  } else if (s.theme === 'desert' || s.theme === 'factory') {
    // A bead of sweat, then a wipe. `sweat` is how far down the bead has got,
    // -1 for none; the arm goes up during the wipe, which is `pose.scratch`.
    /* 360 rather than 300: the ordinary idle beats also cycle on 360, so a
     * different period made the wipe drift onto the frames that already
     * scratch, where it added nothing anyone could see. Locked to the same
     * clock, the wipe lands on the "look down" beat and reads as its own move. */
    const beat2 = (idle - 200) % 360;
    if (beat2 > 30 && beat2 < 200) pose.sweat = Math.min(7, Math.floor((beat2 - 30) / 22));
    else if (beat2 >= 200 && beat2 < 250) {
      pose.scratch = 2;
      pose.look = 0;
      pose.eye = 0;
    }
  }
  return pose;
}

/**
 * A bead running down the temple.
 *
 * Drawn with a dark rim rather than as a pale dot: measured against the plain
 * sprite, the first version changed four pixels, which at this size is not an
 * animation, it is a rounding error. The rim is what makes it read against skin.
 */
function sweatBead(ctx, x, y) {
  ctx.fillStyle = '#2a4a6a';
  ctx.fillRect(x - 1, y - 1, 4, 6);
  ctx.fillStyle = '#7fc8f0';
  ctx.fillRect(x, y, 2, 4);
  ctx.fillStyle = '#e8f8ff';
  ctx.fillRect(x, y, 1, 2);
}

/** Draws the player at template scale. `s.type` picks the palette. */
function drawPlayerBase(ctx, x, y, s, small) {
  const pal = PALETTES[s.type || 'none'] || PALETTES.none;
  const ducking = s.ducking && !small;
  const w = small ? 12 : 14;
  const pose = idlePose(s);

  flip(ctx, x, w, s.facing < 0, (bx) => {
    // The shiver moves the whole body, so it is applied to the origin rather
    // than to each part — a character whose head trembles out of step with his
    // shoulders looks broken, not cold.
    const px = Math.round(bx) + pose.shiver;
    const py = Math.round(y);

    if (s.type === 'leaf') {
      tail(ctx, px + (ducking ? 3 : 2), py + (small ? 7 : ducking ? 7 : 17), s.wag || 0);
    }

    if (small) {
      const b = pose.breath;
      ctx.fillStyle = pal.cap;
      ctx.fillRect(px + 2, py + b, 8, 3);
      ctx.fillRect(px + 2, py + 3 + b, 10, 1);
      if (pal.spots) capSpots(ctx, px + 2, py + b, 8);
      ctx.fillStyle = C.skin;
      ctx.fillRect(px + 3, py + 4 + b, 7, 5);
      ctx.fillStyle = C.skinDark;
      ctx.fillRect(px + 3, py + 7 + b, 3, 2);
      ctx.fillStyle = C.ink;
      if (pose.blink) ctx.fillRect(px + 7, py + 6 + b, 2, 1);
      else ctx.fillRect(px + 7, py + 5 + b + pose.eye, 1, 2);
      ctx.fillStyle = pal.shirt;
      ctx.fillRect(px + 2, py + 9 + b, 8, 3);
      ctx.fillStyle = C.skin;
      ctx.fillRect(px, py + 9 + b, 2, 3);
      ctx.fillRect(px + 10 - pose.scratch, py + 9 + b + pose.scratch, 2, 3);
      ctx.fillStyle = pal.pants;
      ctx.fillRect(px + 3, py + 11, 6, 3);
      ctx.fillStyle = pal.pantsDark;
      ctx.fillRect(px + 3, py + 11, 6, 1);
      if (s.type === 'leaf') ears(ctx, px, py, 12);
      if (pose.sweat >= 0) sweatBead(ctx, px + 11, py + 2 + pose.sweat);
      if (s.state === 'jump') {
        ctx.fillStyle = pal.pants;
        ctx.fillRect(px + 2, py + 14, 4, 2);
        ctx.fillRect(px + 7, py + 13, 4, 3);
      } else if (s.state === 'walk') {
        legs(ctx, px, py + 14, 12, pal, s.frame % 3, s.running);
      } else {
        /* Standing still uses the walk cycle's closed-legs frame rather than a
         * pose of its own. The pose of its own was two 2x2 stubs of trouser
         * colour with no boots, against a walk cycle that is five pixels tall
         * and ends in a dark sole — so the legs appeared to vanish the moment
         * you stopped, on the small size where two pixels is the whole leg. */
        legs(ctx, px, py + 14, 12, pal, 1, false);
      }
      return;
    }

    if (ducking) {
      ctx.fillStyle = pal.cap;
      ctx.fillRect(px + 2, py + 1, 9, 3);
      ctx.fillRect(px + 2, py + 4, 12, 1);
      if (pal.spots) capSpots(ctx, px + 2, py + 1, 9);
      ctx.fillStyle = C.skin;
      ctx.fillRect(px + 3, py + 5, 8, 5);
      ctx.fillStyle = C.ink;
      ctx.fillRect(px + 8, py + 6, 1, 2);
      ctx.fillStyle = pal.shirt;
      ctx.fillRect(px + 1, py + 10, 12, 3);
      ctx.fillStyle = pal.pants;
      ctx.fillRect(px + 2, py + 13, 10, 3);
      if (s.type === 'leaf') ears(ctx, px, py + 1, 14);
      return;
    }

    const b = pose.breath;
    ctx.fillStyle = pal.cap;
    ctx.fillRect(px + 3, py + b, 9, 4);
    ctx.fillRect(px + 2, py + 4 + b, 12, 2);
    if (pal.spots) capSpots(ctx, px + 3, py + b, 9);
    ctx.fillStyle = C.skin;
    ctx.fillRect(px + 3, py + 6 + b, 9, 7);
    ctx.fillStyle = C.skinDark;
    ctx.fillRect(px + 3, py + 11 + b, 4, 2);
    ctx.fillStyle = C.ink;
    if (pose.blink) ctx.fillRect(px + 8, py + 9 + b, 3, 1);
    else ctx.fillRect(px + 8, py + 7 + b + pose.eye, 2, 3);
    ctx.fillStyle = pal.shirt;
    ctx.fillRect(px + 2, py + 13 + b, 10, 5);
    ctx.fillStyle = pal.shirtDark;
    ctx.fillRect(px + 2, py + 17 + b, 10, 1);
    ctx.fillStyle = C.skin;
    ctx.fillRect(px - 1, py + 13 + b, 3, 5);
    // The front arm reaches round the back during the scratch.
    ctx.fillRect(px + 12 - pose.scratch * 2, py + 13 + b + pose.scratch * 2, 3, 5);
    ctx.fillStyle = pal.pants;
    ctx.fillRect(px + 2, py + 18, 10, 4);
    ctx.fillStyle = pal.pantsDark;
    ctx.fillRect(px + 2, py + 18, 10, 1);
    ctx.fillStyle = C.gold;
    ctx.fillRect(px + 4, py + 19, 1, 1);
    ctx.fillRect(px + 9, py + 19, 1, 1);
    if (s.type === 'leaf') ears(ctx, px + 1, py, 12);
    if (pose.sweat >= 0) sweatBead(ctx, px + 12, py + 3 + pose.sweat);

    if (s.state === 'jump') {
      ctx.fillStyle = pal.pants;
      ctx.fillRect(px + 2, py + 22, 4, 3);
      ctx.fillRect(px + 8, py + 21, 5, 4);
      ctx.fillStyle = C.ink;
      ctx.fillRect(px + 1, py + 24, 5, 2);
    } else if (s.state === 'walk') {
      legs(ctx, px, py + 22, 14, pal, s.frame % 3, s.running);
    } else {
      ctx.fillStyle = pal.pants;
      ctx.fillRect(px + 3, py + 22, 3, 2);
      ctx.fillRect(px + 8, py + 22 - pose.tap, 3, 2);
      ctx.fillStyle = C.ink;
      ctx.fillRect(px + 2, py + 24, 4, 2);
      ctx.fillRect(px + 8, py + 24 - pose.tap, 4, 2);
    }
  });
}

/* Scratch buffer for the scaled-up power levels. */
const PAD = { x: 14, y: 6 };
const BUF_W = PAD.x + BASE_NORMAL.w + PAD.x;
const BUF_H = PAD.y + BASE_NORMAL.h + PAD.y;
let buffer = null;
let bufferCtx = null;

function scratch() {
  if (!buffer) {
    buffer = document.createElement('canvas');
    buffer.width = BUF_W;
    buffer.height = BUF_H;
    bufferCtx = buffer.getContext('2d');
    bufferCtx.imageSmoothingEnabled = false;
  }
  return bufferCtx;
}

/**
 * @param {object} s { type, level, facing, frame, state, ducking, running, wag, tint, glow }
 */
export function drawPlayer(ctx, x, y, s) {
  const level = Math.max(0, Math.min(5, s.level ?? 0));
  if (s.glow) {
    // The halo is what carries across a busy screen; the tint alone is easy to
    // lose against bright scenery. Drawn by replaying the sprite, so it is the
    // character that glows and not a blob behind it.
    const box = (s.ducking ? PLAYER_DUCK_SIZES : PLAYER_SIZES)[level];
    glowing(ctx, x + box.w / 2, y + box.h / 2, s.glow,
      (g) => drawPlayer(g, x, y, { ...s, glow: null }));
    return;
  }
  if (level === 0) {
    outlined(ctx, (g) => drawPlayerBase(recolored(g, s.tint), x, y, s, true));
    return;
  }
  if (level === 1) {
    outlined(ctx, (g) => drawPlayerBase(recolored(g, s.tint), x, y, s, false));
    return;
  }

  const box = (s.ducking ? PLAYER_DUCK_SIZES : PLAYER_SIZES)[level];
  const base = s.ducking ? BASE_DUCK : BASE_NORMAL;
  const sx = box.w / base.w;
  const sy = box.h / base.h;

  const b = scratch();
  b.clearRect(0, 0, BUF_W, BUF_H);
  outlined(b, (g) => drawPlayerBase(recolored(g, s.tint), PAD.x, PAD.y, s, false));

  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, BUF_W, BUF_H,
    Math.round(x - PAD.x * sx), Math.round(y - PAD.y * sy),
    Math.round(BUF_W * sx), Math.round(BUF_H * sy));
  ctx.imageSmoothingEnabled = prev;
}

/** The cork stuck in a constipated player. */
export function drawCork(ctx, x, y, tick) {
  const bob = Math.round(Math.sin(tick / 6) * 1);
  ctx.fillStyle = C.corkDark;
  ctx.fillRect(x, y + bob, 8, 7);
  ctx.fillStyle = C.cork;
  ctx.fillRect(x + 1, y + 1 + bob, 6, 5);
  ctx.fillStyle = C.corkDark;
  ctx.fillRect(x + 1, y + 3 + bob, 6, 1);
}
