/**
 * Everything the player collects, throws or leaves behind, plus the two props
 * the level itself draws.
 *
 * The goal card is here rather than with the level artwork because it is drawn
 * by `drawItem` — the card in the flag is literally the pickup at rest, and the
 * two have to keep matching or the flag starts promising something it does not
 * hand over.
 */

import { C, recolored, glowing, GLOWS } from './palette.js';

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

  if (kind === 'pop') {
    /*
     * Paukkupapu: a fat bean under too much pressure, split along one seam with
     * the gas showing through it.
     *
     * It has to read as a *bean* at a glance and not as a mushroom cap, because
     * it is the one power-up you cannot get from a block — a player who mistakes
     * it for the usual thing will not know what changed. So: no cap, no stalk,
     * a squat dark shell, and the seam pulsing brighter than anything else on
     * it. The pulse is the only animated part; a bean that wobbled would read as
     * something alive.
     */
    const beat = 0.5 + 0.5 * Math.sin(tick / 5);
    ctx.fillStyle = '#3c1a0c';
    ctx.fillRect(px + 1, py + 4, 14, 9);
    ctx.fillRect(px + 3, py + 2, 10, 13);
    ctx.fillStyle = '#8c3c1c';
    ctx.fillRect(px + 2, py + 5, 12, 7);
    ctx.fillRect(px + 4, py + 3, 8, 11);
    ctx.fillStyle = '#c05a24';
    ctx.fillRect(px + 3, py + 5, 5, 4);
    // the split seam, running corner to corner
    ctx.fillStyle = `rgba(168,224,74,${0.55 + 0.45 * beat})`;
    for (let i = 0; i < 8; i++) ctx.fillRect(px + 4 + i, py + 11 - i, 2, 1);
    ctx.fillStyle = `rgba(244,255,208,${0.4 + 0.5 * beat})`;
    ctx.fillRect(px + 7, py + 7, 2, 2);
    // and a wisp escaping it
    ctx.fillStyle = `rgba(168,224,74,${0.25 + 0.3 * beat})`;
    ctx.fillRect(px + 11, py + 1 - Math.floor(beat * 2), 3, 2);
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

/**
 * The bean on its way down, and the growing tip of the stalk afterwards.
 *
 * It is emphatically **not** the paukkupapu (`drawItem('pop')`), and the
 * difference is the whole reason it is a sprite of its own rather than that one
 * reused. The paukkupapu is a squat brown shell with a glowing seam and it is a
 * power-up you pick up; this is a pale green seed that plants itself and then
 * climbs, and it cannot be touched at any point. Two things that come out of a
 * `?` block and look alike teach the player one wrong lesson each — DESIGN.md
 * §8.
 *
 * `bare` is the falling half: just the seed, tumbling, with nothing under it
 * yet. Once it lands the same sprite grows a shoot and the seed rides the tip
 * of it, so the thing the player followed down is the thing they follow back
 * up. The greens are the vine's own (`drawVine` in gfx/tiles.js), because in
 * one more frame this is a vine.
 */
export function drawSprout(ctx, x, y, tick, bare = false) {
  const px = Math.round(x);
  const py = Math.round(y);

  if (bare) {
    // tumbling, so the seed leans a different way every few frames
    const lean = Math.floor(tick / 4) % 2;
    ctx.fillStyle = '#4c7a1c';
    ctx.fillRect(px + 5, py + 5, 6, 7);
    ctx.fillStyle = '#8fc03a';
    ctx.fillRect(px + 6, py + 5, 4, 6);
    ctx.fillStyle = '#c8e04a';
    ctx.fillRect(px + 6 + lean, py + 6, 2, 3);
    ctx.fillStyle = '#f4ffd0';
    ctx.fillRect(px + 7 + lean, py + 6, 1, 1);
    return;
  }

  const curl = Math.round(Math.sin(tick / 5) * 2);

  // the stem, still short — it fills the bottom of the tile and no more
  ctx.fillStyle = '#1c6b1f';
  ctx.fillRect(px + 5, py + 6, 6, 10);
  ctx.fillStyle = '#3ea23a';
  ctx.fillRect(px + 6, py + 5, 4, 11);
  ctx.fillStyle = '#8fe04a';
  ctx.fillRect(px + 6, py + 6, 1, 10);

  // the tip, curling over the top of what is not there yet
  ctx.fillStyle = '#3ea23a';
  ctx.fillRect(px + 6, py + 2, 4, 4);
  ctx.fillRect(px + 8, py + 1, 3 + curl, 2);
  ctx.fillStyle = '#8fe04a';
  ctx.fillRect(px + 7, py + 3, 2, 2);
  ctx.fillRect(px + 9, py + 1, 1 + Math.max(0, curl), 1);

  // two young leaves, one either side, opening as the tip turns
  ctx.fillStyle = '#3ea23a';
  ctx.fillRect(px + 1 + curl, py + 8, 5, 3);
  ctx.fillRect(px + 10 - curl, py + 11, 5, 3);
  ctx.fillStyle = '#8fe04a';
  ctx.fillRect(px + 2 + curl, py + 8, 3, 1);
  ctx.fillRect(px + 11 - curl, py + 11, 3, 1);

  // and the seed itself, riding along until the stalk is done with it
  ctx.fillStyle = '#c8e04a';
  ctx.fillRect(px + 10, py + 6, 3, 4);
  ctx.fillStyle = '#f4ffd0';
  ctx.fillRect(px + 11, py + 7, 1, 2);
}

/** @param {object} [opts] { tint, glow } */
export function drawFart(ctx, x, y, tick, opts) {
  const px = Math.round(x);
  const py = Math.round(y);
  const p = Math.floor(tick / 4) % 2;
  const tint = opts && opts.tint;
  /*
   * Opaque, outlined and bright in the middle.
   *
   * It used to be a translucent green blob, and against grass, a green hill or
   * the factory's haze it simply disappeared — an 8x8 sprite has no room to be
   * subtle. The dark rim is the same trick the characters use (`outlined`): it
   * is what makes a small sprite survive a busy background, and it costs four
   * rectangles.
   */
  const body = (surface) => {
    const g = recolored(surface, tint);
    g.fillStyle = '#14300a';
    g.fillRect(px, py + 1, 8, 6);
    g.fillRect(px + 1, py, 6, 8);
    g.fillStyle = '#5ca81e';
    g.fillRect(px + 1, py + 1, 6, 6);
    g.fillStyle = '#a8e04a';
    g.fillRect(px + 1, py + 2, 5, 4);
    g.fillRect(px + 2, py + 1, 4, 6);
    g.fillStyle = '#f4ffd0';
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

export const CARD_ICONS = ['shroom', 'flower', 'star'];

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
