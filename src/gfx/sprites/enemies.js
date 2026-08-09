/**
 * Everything that walks, flies, drifts or erupts at the player, plus the bubble
 * one of them can be sealed in and the spines that say a body cannot be
 * stomped.
 *
 * The bubble lives here rather than with the items because it draws no artwork
 * of its own — it replays whichever enemy is inside it — and the spines are
 * here because the walking one wears them, but the boss file borrows them for
 * exactly the same reason.
 */

import { C, outlined, flip } from './palette.js';

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

/* ------------------------------- bubbles ------------------------------- */

/** How much of itself a trapped enemy keeps once it is sealed in. */
const BUBBLE_SHRINK = 0.7;

/**
 * A bubble is round and wider than the thing inside it, so the hitbox comes
 * from here too — the player is aiming at what they can see, not at the box
 * of an enemy that is no longer where it looks.
 */
export function bubbleRadius(w, h) {
  return Math.round((Math.max(w, h) * BUBBLE_SHRINK) / 2) + 3;
}

/**
 * A trapped enemy, shrunk and sealed in gas. `paint` is the enemy's ordinary
 * artwork: there is no second set of sprites for the inside of a bubble.
 *
 * Once `warning` is on the wobble triples its rate and the skin flashes. A
 * bubble that burst without saying so first would be an enemy appearing out of
 * nowhere, which is the one thing this game does not do to anybody.
 */
export function drawBubble(ctx, cx, cy, radius, tick, warning, paint) {
  // The shrink is a plain scale, like the star's halo: the softened edges read
  // as something seen through a film, which is what it is.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(BUBBLE_SHRINK, BUBBLE_SHRINK);
  ctx.translate(-cx, -cy);
  paint(ctx);
  ctx.restore();

  const wob = Math.sin(tick * (warning ? 0.42 : 0.14)) * (warning ? 2 : 1);
  const rx = radius + wob;
  const ry = radius - wob;
  const flash = warning && Math.floor(tick / 3) % 2 === 0;
  const px = Math.round(cx);
  const py = Math.round(cy);
  const half = (dy, hx, hy) => (
    Math.abs(dy) >= hy ? 0 : Math.round(hx * Math.sqrt(1 - (dy * dy) / (hy * hy))));
  const top = Math.ceil(ry);

  ctx.fillStyle = flash ? 'rgba(255,255,255,0.35)' : 'rgba(160,220,255,0.22)';
  for (let dy = -top; dy <= top; dy++) {
    const inner = half(dy, rx - 2, ry - 2);
    if (inner > 0) ctx.fillRect(px - inner, py + dy, inner * 2, 1);
  }
  ctx.fillStyle = flash ? '#ffffff' : 'rgba(200,240,255,0.85)';
  for (let dy = -top; dy <= top; dy++) {
    const outer = half(dy, rx, ry);
    if (outer <= 0) continue;
    const inner = half(dy, rx - 2, ry - 2);
    ctx.fillRect(px - outer, py + dy, outer - inner, 1);
    ctx.fillRect(px + inner, py + dy, outer - inner, 1);
  }

  // A shaded underside, or the skin disappears into a bright sky — which is
  // exactly the theme where an enemy floating past most needs an outline.
  ctx.fillStyle = 'rgba(48,96,144,0.45)';
  for (let dy = 1; dy <= top; dy++) {
    const outer = half(dy, rx, ry);
    if (outer > 0) ctx.fillRect(px + outer - 2, py + dy, 2, 1);
  }

  // The glint is what makes it a bubble rather than a ring.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(px - Math.round(rx * 0.5), py - Math.round(ry * 0.55), 2, 2);
  ctx.fillRect(px - Math.round(rx * 0.62), py - Math.round(ry * 0.28), 1, 2);
}

/* -------------------------------- spines ------------------------------- */

/**
 * Bone spines along the top edge of a sprite — the one part of a body a stomp
 * ever lands on, so that is where they go.
 *
 * Drawn as actual triangles rather than signalled with a tint, because this is
 * read in the same frame the player decides to jump: a colour has to be learned
 * first, a row of points does not. `out` is 0..1, how far they have pushed
 * through the skin, so a boss winding up to bristle is the same drawing at a
 * fraction of its height rather than a second sprite that has to agree with the
 * first.
 */
export function drawSpines(ctx, x, y, w, out, tick, warning = false, unit = 8) {
  if (out <= 0) return;
  const px = Math.round(x);
  const py = Math.round(y);
  // `unit` is the nominal spacing, so a boss that has swollen to three times
  // its size grows its spines instead of sprouting three times as many.
  const count = Math.max(3, Math.round(w / unit));
  const step = w / count;
  // Half again as tall as they are wide: a spine that is as thick as it is long
  // reads as a battlement, and the fortress bosses already wear a crown.
  const full = Math.max(5, Math.round(step * 1.5));
  const half = Math.max(1, Math.round(step * 0.42));
  const h = Math.max(1, Math.round(full * out));
  // While they are still coming out the tips flash, so the warning reads even
  // on the frames where the points are still short enough to miss.
  const tip = warning && Math.floor(tick / 3) % 2 ? '#fff8e8' : '#e8e0c8';

  ctx.fillStyle = '#5a5040';
  ctx.fillRect(px, py - 1, Math.round(w), 2);
  for (let i = 0; i < count; i++) {
    const sx = Math.round(px + step * (i + 0.5));
    for (let r = 0; r < h; r++) {
      // One pixel at the point, widening all the way to the base.
      const wide = Math.max(1, Math.round((2 * half * (r + 1)) / h));
      ctx.fillStyle = r < h / 2 ? tip : '#a89878';
      ctx.fillRect(sx - (wide >> 1), py - h + r, wide, 1);
    }
  }
}

/**
 * Piikkiukko — the walking one that cannot be stomped. Squat and dark on
 * purpose: the spines are the whole silhouette, and a tall body would put them
 * where a jumping player is not looking.
 */
function spikeGuyBody(ctx, x, y, frame, facing) {
  const px = Math.round(x);
  const py = Math.round(y);
  const bob = Math.floor(frame / 6) % 2;
  flip(ctx, px, 16, facing < 0, (bx) => {
    ctx.fillStyle = '#3c3450';
    ctx.fillRect(bx + 1, py + 5 + bob, 14, 9 - bob);
    ctx.fillStyle = '#584c74';
    ctx.fillRect(bx + 2, py + 6 + bob, 12, 5);
    ctx.fillStyle = C.white;
    ctx.fillRect(bx + 3, py + 8, 4, 4);
    ctx.fillRect(bx + 9, py + 8, 4, 4);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 5, py + 9, 2, 3);
    ctx.fillRect(bx + 10, py + 9, 2, 3);
    // Angry brows: the plant taught us a face reads as a character, and this
    // one is a character you are meant to walk around.
    ctx.fillRect(bx + 3, py + 7, 4, 1);
    ctx.fillRect(bx + 9, py + 7, 4, 1);
    ctx.fillStyle = '#2a2438';
    const swap = frame % 2 === 0;
    ctx.fillRect(bx + (swap ? 1 : 3), py + 13, 5, 3);
    ctx.fillRect(bx + (swap ? 10 : 8), py + 13, 5, 3);
    drawSpines(ctx, bx + 1, py + 5, 14, 1, frame);
  });
}

export function drawSpikeGuy(ctx, x, y, frame, facing) {
  outlined(ctx, (g) => spikeGuyBody(g, x, y, frame, facing));
}
