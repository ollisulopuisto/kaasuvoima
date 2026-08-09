/**
 * The named colour table and the four things every sprite in here is drawn
 * through: an outline, a mirror, a tint and a glow.
 *
 * They live in one file because they are the reason the artwork is written the
 * way it is. Nothing draws its own outline or its own frozen version — a sprite
 * is a function that paints rectangles, and these wrap the surface it paints
 * onto. Split them up and the next sprite added quietly stops matching.
 */

export const C = {
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
export function outlined(ctx, paint, color = 'rgba(16,16,24,0.85)') {
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
export function flip(ctx, x, w, doFlip, fn) {
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
export function recolored(ctx, tint) {
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
export function glowing(ctx, cx, cy, glow, paint) {
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
export const TINTS = {
  frozen: makeTint('#78c0ff', 0.62, 0.55),
  flash: makeTint('#fff0c0', 0.7, 0.45),
  spent: makeTint('#8c8878', 0.5, 0.65),
};

/**
 * The star cycles through these. The drain is high on purpose: a player who
 * only *shifts* colour still reads as the same character in a bad moment, and
 * the whole point of the star is that you can tell at a glance you have it.
 */
export const STAR_TINTS = [
  makeTint('#fff070', 0.85, 0.7),
  makeTint('#ffffff', 0.85, 0.8),
  makeTint('#8fe04a', 0.8, 0.7),
  makeTint('#78c0ff', 0.8, 0.7),
];

export const GLOWS = {
  star: { scale: 1.9, alpha: 0.28, tint: null },
  // Not a full substitution: the halo keeps some of the ball's own colour, so a
  // tinted shot dims its own glow instead of sitting in a bright one.
  fart: { scale: 2.4, alpha: 0.22, tint: makeTint('#d0ff90', 0.4) },
};
