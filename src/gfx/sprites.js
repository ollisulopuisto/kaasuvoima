/**
 * All artwork is drawn procedurally on the 320x240 back buffer with integer
 * rectangles, so it stays crisp pixel art without shipping any image files.
 *
 * The player is drawn from one 14x26 template that gets blitted with
 * nearest-neighbour scaling, which is how the five power levels grow.
 */

const C = {
  ink: '#101018',
  skin: '#f0b890',
  skinDark: '#c07850',
  green: '#3ea23a',
  greenDark: '#1f6f26',
  greenLight: '#8fe04a',
  brown: '#8c4c18',
  brownDark: '#5a2c0c',
  tan: '#c88c40',
  white: '#f8f8f8',
  gas: '#a8e04a',
  gasDark: '#5c9c28',
  shell: '#3ea23a',
  shellDark: '#1c6b1f',
  rim: '#f8e8a0',
  purple: '#a04ca0',
  purpleDark: '#6a2c6a',
  gold: '#ffd048',
  poop: '#8a5a2a',
  poopDark: '#5c3a16',
  cork: '#d8a860',
  corkDark: '#9c6a28',
  flame: '#f87818',
};

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

/* --------------------------- outline helper ---------------------------- */

const OUTLINE_OFFSETS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/**
 * A drawing surface that swallows every colour change, so replaying a sprite
 * through it paints a flat silhouette instead of the real artwork.
 */
function silhouette(ctx) {
  return {
    flat: true,
    set fillStyle(_v) { /* colours are fixed during the outline pass */ },
    get fillStyle() { return ctx.fillStyle; },
    fillRect: (x, y, w, h) => ctx.fillRect(x, y, w, h),
    save: () => ctx.save(),
    restore: () => ctx.restore(),
    translate: (x, y) => ctx.translate(x, y),
    scale: (x, y) => ctx.scale(x, y),
    drawImage: (...args) => ctx.drawImage(...args),
  };
}

/**
 * Draws `paint` four times as a dark silhouette, one pixel out in each
 * direction, then once properly on top. Characters keep their shape against
 * busy scenery this way.
 */
function outlined(ctx, paint, color = 'rgba(16,16,24,0.85)') {
  ctx.save();
  ctx.fillStyle = color;
  const flat = silhouette(ctx);
  for (const [dx, dy] of OUTLINE_OFFSETS) {
    ctx.save();
    ctx.translate(dx, dy);
    paint(flat);
    ctx.restore();
  }
  ctx.restore();
  paint(ctx);
}

/** Runs `fn` with the horizontal axis mirrored around the sprite box. */
function flip(ctx, x, w, doFlip, fn) {
  if (!doFlip) {
    fn(x);
    return;
  }
  ctx.save();
  ctx.translate(x * 2 + w, 0);
  ctx.scale(-1, 1);
  fn(x);
  ctx.restore();
}

/* ------------------------ per-sprite tint and glow --------------------- */

function parseColor(css) {
  if (typeof css !== 'string') return null;
  if (css[0] === '#') {
    if (css.length === 7) {
      return [parseInt(css.slice(1, 3), 16), parseInt(css.slice(3, 5), 16),
        parseInt(css.slice(5, 7), 16), 1];
    }
    if (css.length === 4) {
      return [parseInt(css[1] + css[1], 16), parseInt(css[2] + css[2], 16),
        parseInt(css[3] + css[3], 16), 1];
    }
    return null;
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(css);
  if (!m) return null;
  const p = m[1].split(',');
  if (p.length < 3) return null;
  return [+p[0], +p[1], +p[2], p.length > 3 ? +p[3] : 1];
}

/**
 * `drain` pulls a colour towards its own brightness first, so a tint reads as
 * the sprite changing material rather than as a coloured sheet over it.
 */
function makeTint(color, amount, drain = 0) {
  const [r, g, b] = parseColor(color);
  return { r, g, b, amount, drain, cache: new Map() };
}

function tintColor(tint, css) {
  const hit = tint.cache.get(css);
  if (hit !== undefined) return hit;
  const src = parseColor(css);
  let out = css;
  if (src) {
    let [r, g, b] = src;
    const a = src[3];
    if (tint.drain > 0) {
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      r += (lum - r) * tint.drain;
      g += (lum - g) * tint.drain;
      b += (lum - b) * tint.drain;
    }
    r = Math.round(r + (tint.r - r) * tint.amount);
    g = Math.round(g + (tint.g - g) * tint.amount);
    b = Math.round(b + (tint.b - b) * tint.amount);
    out = a >= 1
      ? `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
      : `rgba(${r},${g},${b},${a})`;
  }
  // A couple of sprites build their colour out of a sine, so the key space is
  // not really finite. Drop the table rather than let it grow all session.
  if (tint.cache.size > 256) tint.cache.clear();
  tint.cache.set(css, out);
  return out;
}

/**
 * The same trick as `silhouette`, except the colours survive — remapped. This is
 * the whole reason the artwork is drawn from a named colour table: a frozen or
 * flashing sprite is a substitution as it paints, not a pass over pixels, so it
 * stays pixel-exact and costs one map lookup per colour change.
 */
function recolored(ctx, tint) {
  if (!tint || ctx.flat) return ctx;
  return {
    set fillStyle(v) { ctx.fillStyle = tintColor(tint, v); },
    get fillStyle() { return ctx.fillStyle; },
    set globalAlpha(v) { ctx.globalAlpha = v; },
    get globalAlpha() { return ctx.globalAlpha; },
    set globalCompositeOperation(v) { ctx.globalCompositeOperation = v; },
    get globalCompositeOperation() { return ctx.globalCompositeOperation; },
    fillRect: (x, y, w, h) => ctx.fillRect(x, y, w, h),
    save: () => ctx.save(),
    restore: () => ctx.restore(),
    translate: (x, y) => ctx.translate(x, y),
    scale: (x, y) => ctx.scale(x, y),
    drawImage: (...args) => ctx.drawImage(...args),
  };
}

/**
 * Draws the sprite once larger and additive behind itself. Light spilling off an
 * object looks like a screen effect but cannot be one: the post pass only sees
 * the finished picture and has no idea which pixel was the star.
 */
function glowing(ctx, cx, cy, glow, paint) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = glow.alpha;
  ctx.translate(cx, cy);
  ctx.scale(glow.scale, glow.scale);
  ctx.translate(-cx, -cy);
  paint(recolored(ctx, glow.tint));
  ctx.restore();
  paint(ctx);
}

/** Named states a sprite can be drawn in. Pass one as `tint`. */
const TINTS = {
  frozen: makeTint('#78c0ff', 0.62, 0.55),
  flash: makeTint('#fff0c0', 0.7, 0.45),
  spent: makeTint('#8c8878', 0.5, 0.65),
};

const GLOWS = {
  star: { scale: 1.9, alpha: 0.28, tint: null },
  fart: { scale: 2.4, alpha: 0.22, tint: makeTint('#d0ff90', 1) },
};

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
  const pose = { breath: 0, eye: 0, blink: false, scratch: 0, tap: 0, look: 0 };
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
  return pose;
}

/** Draws the player at template scale. `s.type` picks the palette. */
function drawPlayerBase(ctx, x, y, s, small) {
  const pal = PALETTES[s.type || 'none'] || PALETTES.none;
  const ducking = s.ducking && !small;
  const w = small ? 12 : 14;
  const pose = idlePose(s);

  flip(ctx, x, w, s.facing < 0, (bx) => {
    const px = Math.round(bx);
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
      if (s.state === 'jump') {
        ctx.fillStyle = pal.pants;
        ctx.fillRect(px + 2, py + 14, 4, 2);
        ctx.fillRect(px + 7, py + 13, 4, 3);
      } else if (s.state === 'walk') {
        legs(ctx, px, py + 14, 12, pal, s.frame % 3, s.running);
      } else {
        ctx.fillStyle = pal.pants;
        ctx.fillRect(px + 3, py + 14, 2, 2);
        ctx.fillRect(px + 7, py + 14, 2, 2);
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
 * @param {object} s { type, level, facing, frame, state, ducking, running, wag, tint }
 */
export function drawPlayer(ctx, x, y, s) {
  const level = Math.max(0, Math.min(5, s.level ?? 0));
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

/* ------------------------------- enemies ------------------------------- */

function walkerBody(ctx, x, y, frame, facing, squashed) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (squashed) {
    ctx.fillStyle = '#8c5c28';
    ctx.fillRect(px + 1, py + 11, 14, 5);
    ctx.fillStyle = '#5a3410';
    ctx.fillRect(px + 1, py + 14, 14, 2);
    return;
  }
  // A slow squash keeps the walker alive even when it is just plodding along.
  const bob = Math.floor(frame / 2) % 2;
  flip(ctx, px, 16, facing < 0, (bx) => {
    ctx.fillStyle = '#a06828';
    ctx.fillRect(bx + 2, py + 3 + bob, 12, 9 - bob);
    ctx.fillRect(bx + 1, py + 5, 14, 6);
    ctx.fillStyle = '#7a4c18';
    ctx.fillRect(bx + 2, py + 10, 12, 2);
    ctx.fillStyle = C.white;
    ctx.fillRect(bx + 3, py + 6, 4, 4);
    ctx.fillRect(bx + 9, py + 6, 4, 4);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 5, py + 7, 2, 3);
    ctx.fillRect(bx + 10, py + 7, 2, 3);
    ctx.fillRect(bx + 3, py + 4, 4, 2);
    ctx.fillRect(bx + 9, py + 4, 4, 2);
    const swap = frame % 2 === 0;
    ctx.fillStyle = '#4c2c08';
    ctx.fillRect(bx + (swap ? 0 : 2), py + 12, 6, 4);
    ctx.fillRect(bx + (swap ? 10 : 8), py + 12, 6, 4);
    ctx.fillStyle = 'rgba(168,224,74,0.5)';
    const puff = (frame % 4) + 1;
    ctx.fillRect(bx - 3 - puff, py + 9, puff + 2, 3);
  });
}

export function drawWalker(ctx, x, y, frame, facing, squashed) {
  outlined(ctx, (g) => walkerBody(g, x, y, frame, facing, squashed));
}

function shellBody(ctx, x, y, frame, facing, mode) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (mode === 'shell' || mode === 'sliding') {
    const spin = mode === 'sliding' ? Math.floor(frame / 2) % 4 : 0;
    ctx.fillStyle = C.shell;
    ctx.fillRect(px + 1, py + 2, 14, 11);
    ctx.fillStyle = C.shellDark;
    ctx.fillRect(px + 1, py + 10, 14, 3);
    ctx.fillStyle = C.rim;
    ctx.fillRect(px, py + 11, 16, 3);
    ctx.fillStyle = C.shellDark;
    for (let i = 0; i < 3; i++) {
      const sx = px + 3 + ((i * 4 + spin) % 11);
      ctx.fillRect(sx, py + 5, 2, 3);
    }
    return;
  }
  flip(ctx, px, 16, facing < 0, (bx) => {
    ctx.fillStyle = C.shell;
    ctx.fillRect(bx + 1, py + 8, 12, 12);
    ctx.fillStyle = C.shellDark;
    ctx.fillRect(bx + 2, py + 12, 10, 3);
    ctx.fillStyle = C.rim;
    ctx.fillRect(bx + 1, py + 18, 12, 3);
    ctx.fillStyle = '#f0d060';
    ctx.fillRect(bx + 8, py + 1, 7, 7);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 12, py + 3, 2, 2);
    ctx.fillStyle = '#c8a030';
    ctx.fillRect(bx + 8, py + 6, 6, 2);
    ctx.fillStyle = '#f0d060';
    const swap = Math.floor(frame / 4) % 2 === 0;
    ctx.fillRect(bx + (swap ? 1 : 3), py + 20, 5, 4);
    ctx.fillRect(bx + (swap ? 8 : 6), py + 20, 5, 4);
  });
}

export function drawShell(ctx, x, y, frame, facing, mode) {
  outlined(ctx, (g) => shellBody(g, x, y, frame, facing, mode));
}

export function drawFlyer(ctx, x, y, frame, facing) {
  const px = Math.round(x);
  const py = Math.round(y);
  const flap = Math.floor(frame / 4) % 2;
  outlined(ctx, (g) => {
    g.fillStyle = C.white;
    g.fillRect(px - 4, py + (flap ? 1 : 5), 6, 5);
    g.fillRect(px + 14, py + (flap ? 1 : 5), 6, 5);
    g.fillStyle = '#c8c8d8';
    g.fillRect(px - 4, py + (flap ? 5 : 9), 6, 1);
    g.fillRect(px + 14, py + (flap ? 5 : 9), 6, 1);
    walkerBody(g, px, py, frame, facing, false);
  });
}

function plantBody(ctx, x, y, frame) {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = C.greenDark;
  ctx.fillRect(px + 5, py + 10, 6, 22);
  ctx.fillStyle = C.green;
  ctx.fillRect(px + 6, py + 10, 3, 22);
  const open = Math.floor(frame / 12) % 2 === 0;
  ctx.fillStyle = '#e04040';
  ctx.fillRect(px + 1, py, 14, 11);
  // Polka dots, not eyes. The plant is a plant; giving it a face made it read
  // as a character rather than a hazard. (Lead designer's call.)
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(px + 2, py + 1, 2, 2);
  ctx.fillRect(px + 11, py + 2, 3, 2);
  ctx.fillRect(px + 6, py + 0, 2, 2);
  ctx.fillStyle = '#a02020';
  ctx.fillRect(px + 1, py, 14, 1);
  if (open) {
    ctx.fillStyle = '#701010';
    ctx.fillRect(px + 3, py + 5, 10, 4);
    ctx.fillStyle = C.white;
    for (let i = 0; i < 4; i++) ctx.fillRect(px + 3 + i * 3, py + 5, 2, 2);
  } else {
    ctx.fillStyle = '#a02020';
    ctx.fillRect(px + 2, py + 6, 12, 3);
  }
}

export function drawPlant(ctx, x, y, frame) {
  outlined(ctx, (g) => plantBody(g, x, y, frame));
}

/** Ruskea pilvi — a drifting brown stink cloud. */
function stinkBody(ctx, x, y, frame, facing, angry) {
  const px = Math.round(x);
  const py = Math.round(y);
  const puff = Math.floor(frame / 8) % 2;
  flip(ctx, px, 20, facing < 0, (bx) => {
    ctx.fillStyle = C.poopDark;
    ctx.fillRect(bx + 1, py + 5, 18, 8);
    ctx.fillRect(bx + 4, py + 2, 12, 6);
    ctx.fillStyle = C.poop;
    ctx.fillRect(bx + 2, py + 5, 16, 6);
    ctx.fillRect(bx + 5, py + 3, 10, 5);
    ctx.fillRect(bx + 3 + puff, py + 1, 6, 3);
    ctx.fillStyle = C.white;
    ctx.fillRect(bx + 6, py + 5, 4, 4);
    ctx.fillRect(bx + 12, py + 5, 4, 4);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 8, py + 6, 2, 3);
    ctx.fillRect(bx + 13, py + 6, 2, 3);
    if (angry) {
      ctx.fillRect(bx + 6, py + 4, 4, 1);
      ctx.fillRect(bx + 12, py + 4, 4, 1);
    }
    ctx.fillStyle = 'rgba(120,80,40,0.45)';
    ctx.fillRect(bx + 2, py + 12, 16, 2 + puff);
  });
}

export function drawStinkCloud(ctx, x, y, frame, facing, angry) {
  outlined(ctx, (g) => stinkBody(g, x, y, frame, facing, angry));
}

/** Ummetuskorkki — corks you up instead of hurting you. */
function corkGuyBody(ctx, x, y, frame, facing) {
  const px = Math.round(x);
  const py = Math.round(y);
  const hop = Math.floor(frame / 6) % 2;
  flip(ctx, px, 16, facing < 0, (bx) => {
    ctx.fillStyle = C.corkDark;
    ctx.fillRect(bx + 2, py + 2 + hop, 12, 12);
    ctx.fillStyle = C.cork;
    ctx.fillRect(bx + 3, py + 3 + hop, 10, 10);
    ctx.fillStyle = C.corkDark;
    ctx.fillRect(bx + 3, py + 6 + hop, 10, 1);
    ctx.fillRect(bx + 3, py + 10 + hop, 10, 1);
    ctx.fillStyle = C.white;
    ctx.fillRect(bx + 4, py + 7 + hop, 3, 3);
    ctx.fillRect(bx + 9, py + 7 + hop, 3, 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 5, py + 8 + hop, 2, 2);
    ctx.fillRect(bx + 10, py + 8 + hop, 2, 2);
    ctx.fillStyle = '#7a4c18';
    ctx.fillRect(bx + 4, py + 14 + hop, 3, 2);
    ctx.fillRect(bx + 9, py + 14 + hop, 3, 2);
  });
}

export function drawCorkGuy(ctx, x, y, frame, facing) {
  outlined(ctx, (g) => corkGuyBody(g, x, y, frame, facing));
}

/** Vihainen aurinko — hovers over the desert and dive-bombs the player. */
export function drawAngrySun(ctx, x, y, tick, diving, hurt) {
  const cx = Math.round(x) + 10;
  const cy = Math.round(y) + 10;
  const hot = diving || hurt;
  const disc = hurt && Math.floor(tick / 2) % 2 ? '#ffffff' : hot ? '#ff9820' : '#ffd048';
  const rayColor = hot ? '#ff6810' : '#f8a820';

  // eight rays, slowly turning
  const rot = tick * 0.035;
  ctx.fillStyle = rayColor;
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    for (let r = 8; r <= 12; r++) {
      const w = 13 - r;
      ctx.fillRect(
        Math.round(cx + Math.cos(a) * r - w / 2),
        Math.round(cy + Math.sin(a) * r - w / 2), w, w);
    }
  }

  // disc
  ctx.fillStyle = disc;
  for (let dy = -8; dy <= 8; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, 64 - dy * dy)));
    ctx.fillRect(cx - half, cy + dy, half * 2, 1);
  }
  ctx.fillStyle = hot ? '#ffd048' : '#fff0a0';
  for (let dy = -6; dy <= 2; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, 36 - dy * dy)) * 0.7);
    ctx.fillRect(cx - half, cy + dy, half * 2, 1);
  }

  // furious face
  ctx.fillStyle = '#101018';
  ctx.fillRect(cx - 6, cy - 4, 4, 2);
  ctx.fillRect(cx - 5, cy - 2, 3, 3);
  ctx.fillRect(cx + 2, cy - 4, 4, 2);
  ctx.fillRect(cx + 2, cy - 2, 3, 3);
  ctx.fillRect(cx - 5, cy + 3, 10, 3);
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(cx - 4, cy + 3, 2, 2);
  ctx.fillRect(cx - 1, cy + 3, 2, 2);
  ctx.fillRect(cx + 2, cy + 3, 2, 2);
}

/** Närästys — a heartburn flame jet erupting from the floor. */
export function drawHeartburn(ctx, x, y, height, tick) {
  if (height <= 0) return;
  const px = Math.round(x);
  const base = Math.round(y);
  for (let i = 0; i < height; i += 4) {
    const t = i / Math.max(1, height);
    const wobble = Math.round(Math.sin((tick + i) / 4) * 2 * t);
    const w = Math.max(2, Math.round(12 * (1 - t * 0.7)));
    ctx.fillStyle = t > 0.65 ? '#ffe070' : t > 0.3 ? C.flame : '#d83018';
    ctx.fillRect(px + 8 - Math.floor(w / 2) + wobble, base - i - 4, w, 5);
  }
  ctx.fillStyle = 'rgba(248,120,24,0.35)';
  ctx.fillRect(px + 2, base - 3, 12, 4);
}

export function drawBoss(ctx, x, y, frame, facing, hurt, variant = 0, scale = 1) {
  const px = Math.round(x);
  const py = Math.round(y);
  const bodyColors = ['#a04ca0', '#3c7ad0', '#2fa06a', '#c85a20'];
  const darkColors = ['#6a2c6a', '#24528c', '#1c6a46', '#8c3a0c'];
  const body = hurt && Math.floor(frame / 2) % 2 ? '#e07070' : bodyColors[variant % 4];
  const dark = darkColors[variant % 4];
  const S = scale;
  const r = (rx, ry, rw, rh) => ctx.fillRect(
    Math.round(rx * S), Math.round(ry * S), Math.round(rw * S), Math.round(rh * S));

  ctx.save();
  flip(ctx, px, 32 * S, facing < 0, (bx) => {
    ctx.translate(bx - bx * S, py - py * S);   // scale about the sprite origin
    ctx.fillStyle = body;
    r(bx + 2, py + 6, 28, 24);
    r(bx + 6, py + 2, 20, 8);
    ctx.fillStyle = dark;
    r(bx + 2, py + 25, 28, 5);
    ctx.fillStyle = C.white;
    r(bx + 8, py + 8, 7, 6);
    r(bx + 18, py + 8, 7, 6);
    ctx.fillStyle = C.ink;
    r(bx + 11, py + 10, 3, 4);
    r(bx + 21, py + 10, 3, 4);
    r(bx + 8, py + 6, 7, 2);
    r(bx + 18, py + 6, 7, 2);
    ctx.fillStyle = '#401040';
    r(bx + 10, py + 18, 13, 5);
    ctx.fillStyle = C.white;
    for (let i = 0; i < 4; i++) r(bx + 11 + i * 3, py + 18, 2, 2);
    ctx.fillStyle = C.gold;
    r(bx + 8, py - 2, 16, 4);
    r(bx + 8, py - 5, 3, 3);
    r(bx + 15, py - 6, 3, 4);
    r(bx + 21, py - 5, 3, 3);
    const swap = Math.floor(frame / 6) % 2 === 0;
    ctx.fillStyle = dark;
    r(bx + (swap ? 1 : 3), py + 28, 10, 4);
    r(bx + (swap ? 21 : 19), py + 28, 10, 4);
  });
  ctx.restore();
}

/* -------------------------------- items -------------------------------- */

/** @param {object} [opts] { tint } */
export function drawItem(ctx, kind, x, y, tick, opts) {
  if (opts && opts.tint) {
    drawItem(recolored(ctx, opts.tint), kind, x, y, tick);
    return;
  }
  const px = Math.round(x);
  const py = Math.round(y);

  if (kind === 'shroom' || kind === 'oneup') {
    const cap = kind === 'oneup' ? '#40c840' : '#e04c3c';
    const capDark = kind === 'oneup' ? '#1c7c1c' : '#a02c20';
    ctx.fillStyle = capDark;
    ctx.fillRect(px + 1, py + 3, 14, 7);
    ctx.fillStyle = cap;
    ctx.fillRect(px + 2, py + 3, 12, 5);
    ctx.fillRect(px + 4, py + 1, 8, 3);
    ctx.fillStyle = C.white;
    ctx.fillRect(px + 3, py + 4, 3, 3);
    ctx.fillRect(px + 10, py + 3, 3, 3);
    ctx.fillRect(px + 7, py + 6, 2, 2);
    ctx.fillStyle = '#f0e0c0';
    ctx.fillRect(px + 4, py + 10, 8, 5);
    ctx.fillStyle = '#c8b08c';
    ctx.fillRect(px + 4, py + 13, 8, 2);
    ctx.fillStyle = C.ink;
    ctx.fillRect(px + 5, py + 11, 1, 2);
    ctx.fillRect(px + 10, py + 11, 1, 2);
    // a little escaping gas, because of course
    ctx.fillStyle = `rgba(168,224,74,${0.35 + 0.25 * Math.sin(tick / 6)})`;
    ctx.fillRect(px - 2, py + 11, 4, 3);
    return;
  }

  if (kind === 'soup') {
    // hernekeitto: a bowl of pea soup with steam
    ctx.fillStyle = '#e8e8f0';
    ctx.fillRect(px + 1, py + 8, 14, 3);
    ctx.fillStyle = '#c8c8d8';
    ctx.fillRect(px + 2, py + 11, 12, 4);
    ctx.fillRect(px + 5, py + 15, 6, 1);
    ctx.fillStyle = '#6a9c2a';
    ctx.fillRect(px + 2, py + 8, 12, 2);
    ctx.fillStyle = '#8fc03a';
    ctx.fillRect(px + 3, py + 8, 5, 1);
    ctx.fillStyle = '#4c7a1c';
    ctx.fillRect(px + 6, py + 9, 2, 1);
    ctx.fillRect(px + 10, py + 8, 2, 1);
    const s = Math.floor(tick / 8) % 3;
    ctx.fillStyle = 'rgba(200,240,160,0.75)';
    ctx.fillRect(px + 4 + s, py + 4, 2, 3);
    ctx.fillRect(px + 9 - s, py + 2, 2, 4);
    return;
  }

  if (kind === 'flower') {
    const phase = Math.floor(tick / 8) % 2;
    ctx.fillStyle = C.greenDark;
    ctx.fillRect(px + 7, py + 9, 2, 7);
    ctx.fillStyle = C.green;
    ctx.fillRect(px + 2, py + 11, 5, 2);
    ctx.fillStyle = phase ? C.gas : C.greenLight;
    ctx.fillRect(px + 4, py + 1, 8, 8);
    ctx.fillRect(px + 2, py + 3, 12, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 6, py + 3, 4, 4);
    ctx.fillStyle = C.ink;
    ctx.fillRect(px + 6, py + 4, 1, 1);
    ctx.fillRect(px + 9, py + 4, 1, 1);
    return;
  }

  if (kind === 'leaf') {
    const sway = Math.round(Math.sin(tick / 10) * 2);
    const ox = px + sway;
    const rows = [[1, 8, 4], [2, 6, 7], [3, 5, 9], [4, 4, 10], [5, 3, 11],
      [6, 3, 10], [7, 3, 9], [8, 4, 7], [9, 5, 5], [10, 6, 3]];
    ctx.fillStyle = '#9c6a28';
    for (const [ry, rx, rw] of rows) ctx.fillRect(ox + rx - 1, py + ry, rw + 2, 1);
    ctx.fillStyle = C.tan;
    for (const [ry, rx, rw] of rows) ctx.fillRect(ox + rx, py + ry, rw, 1);
    ctx.fillStyle = '#e8b870';
    ctx.fillRect(ox + 7, py + 3, 4, 1);
    ctx.fillRect(ox + 6, py + 4, 4, 1);
    ctx.fillStyle = '#9c6a28';
    for (let i = 0; i < 8; i++) ctx.fillRect(ox + 5 + Math.floor(i * 0.7), py + 9 - i, 1, 1);
    ctx.fillRect(ox + 5, py + 10, 2, 4);
    return;
  }

  if (kind === 'star') {
    // The one item that is literally a light source, so it gets the halo.
    glowing(ctx, px + 8, py + 8, GLOWS.star, (g) => {
      g.fillStyle = Math.floor(tick / 4) % 2 ? '#fff070' : '#ffb020';
      g.fillRect(px + 6, py + 1, 4, 14);
      g.fillRect(px + 1, py + 6, 14, 4);
      g.fillRect(px + 3, py + 3, 10, 10);
    });
  }
}

/** @param {object} [opts] { tint, glow } */
export function drawFart(ctx, x, y, tick, opts) {
  const px = Math.round(x);
  const py = Math.round(y);
  const p = Math.floor(tick / 4) % 2;
  const tint = opts && opts.tint;
  const body = (surface) => {
    const g = recolored(surface, tint);
    g.fillStyle = 'rgba(140,220,80,0.9)';
    g.fillRect(px + 1, py + 1, 6, 6);
    g.fillRect(px, py + 2, 8, 4);
    g.fillRect(px + 2, py, 4, 8);
    g.fillStyle = 'rgba(232,255,180,0.9)';
    g.fillRect(px + 2 + p, py + 2, 2, 2);
  };
  if (opts && opts.glow) glowing(ctx, px + 4, py + 4, opts.glow, body);
  else body(ctx);
}

export function drawGasPuff(ctx, x, y, life, size, brown) {
  const a = Math.max(0, Math.min(1, life));
  ctx.fillStyle = brown ? `rgba(150,110,60,${0.5 * a})` : `rgba(150,220,90,${0.5 * a})`;
  const s = Math.round(size);
  ctx.fillRect(Math.round(x) - s, Math.round(y) - s, s * 2, s * 2);
  ctx.fillStyle = brown ? `rgba(200,160,100,${0.4 * a})` : `rgba(210,255,150,${0.4 * a})`;
  ctx.fillRect(Math.round(x) - s + 1, Math.round(y) - s + 1, s, s);
}

/* ------------------------------ level props ---------------------------- */

const CARD_ICONS = ['shroom', 'flower', 'star'];

export function drawGoal(ctx, x, y, height, cardIndex, held) {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = '#c8c8d8';
  ctx.fillRect(px + 6, py, 4, height);
  ctx.fillStyle = '#8a8aa0';
  ctx.fillRect(px + 9, py, 1, height);
  ctx.fillStyle = '#f0f0ff';
  ctx.fillRect(px + 2, py - 4, 12, 4);
  if (!held) {
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(px, py + 6, 16, 16);
    ctx.fillStyle = '#303048';
    ctx.fillRect(px, py + 6, 16, 1);
    ctx.fillRect(px, py + 21, 16, 1);
    ctx.fillRect(px, py + 6, 1, 16);
    ctx.fillRect(px + 15, py + 6, 1, 16);
    drawItem(ctx, CARD_ICONS[cardIndex % 3], px, py + 6, 0);
  }
}

export function drawBrickShard(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), 6, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(Math.round(x), Math.round(y) + 4, 6, 2);
}

export { C as SPRITE_COLORS, CARD_ICONS, TINTS, GLOWS };
