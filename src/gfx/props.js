import { drawText, textWidth } from './font.js';

/**
 * THE BACKDROP PROP LAYER — things that were always there, we swear.
 *
 * The backdrop draws itself procedurally: hills, cacti, pipes and clouds are
 * generated from the camera position every frame, so nothing in it has a
 * position of its own. That is exactly right for scenery — and exactly wrong
 * for anything the game wants to *say* at a particular moment. A road sign
 * that announces the level, or one that reacts to how fast you are going, has
 * to stand still in the world while the world moves past it.
 *
 * So this is the one part of the backdrop with a list. A prop is placed **off
 * the right edge of the screen**, and from then on it is only scenery: it
 * scrolls in at its layer's speed, passes, and is reaped on the left. The
 * player never sees one appear, which is the whole trick — a sign that pops
 * into existence in front of you is a notification, and a sign that slides in
 * from beyond the edge has been standing by that road the entire time.
 *
 * That difference is the reason this is a layer and not a HUD element. The
 * game already says things in the corner of the screen when it must; this is
 * for the things it would rather have the road say.
 */

/**
 * How far past the right edge a prop is born, in layer pixels.
 *
 * It only has to clear the edge — but not by so much that the sign arrives
 * long after the thing it comments on. At `PROP_PAR` and full running speed
 * the camera covers this in well under a second, so the sign is on its way in
 * while the player is still doing whatever summoned it.
 */
export const PROP_AHEAD = 48;

/**
 * The room a prop takes on the road, in layer pixels.
 *
 * The widest thing drawn here is the level-name board: `textWidth` of eleven
 * characters plus its border is about 78 px. 100 clears that with room for
 * the posts and enough air that the two read as separate objects rather than
 * as one long hoarding.
 */
const PROP_CLEAR = 100;

/**
 * The parallax rate of the prop layer.
 *
 * The backdrop's nearest strip runs at 0.5 and the tilemap at 1.0, so 0.6
 * puts these signs just in front of the last row of hills and well behind the
 * ground the player runs on: roadside, not on the road. Anything closer to 1
 * and a sign would keep pace with the tiles and read as something you could
 * hit.
 */
export const PROP_PAR = 0.6;

/** Reaped this far past the left edge, so nothing is ever cut off mid-exit. */
const REAP = 64;

/**
 * Post height above whatever the prop is standing on.
 *
 * It used to be 52, and that was three rows of tiles plus room to spare —
 * a guess at how deep the floor might be, because the prop had no way to ask.
 * It can ask now (`groundAt` in `draw`), so this is back to being a length
 * rather than a clearance: how tall a signpost is. The post still vanishes
 * into the ground it stands on, which is what a post should do.
 */
const POST_H = 26;

export class PropLayer {
  constructor() {
    this.list = [];
  }

  clear() {
    this.list = [];
  }

  /**
   * Places `kind` off the right edge. `camX` is the camera in world pixels,
   * and the prop's own `x` is in **layer** pixels — that is, already divided
   * through by the parallax rate — so drawing is a plain subtraction and a
   * prop never has to know how fast its layer moves.
   */
  place(kind, camX, viewW, data = {}) {
    /*
     * QUEUED BEHIND WHATEVER IS ALREADY WAITING.
     *
     * Owner: *"make sure speed sign and world level sign don't overlap."* —
     * and they could, exactly. Every prop was born at the same spot, `viewW +
     * PROP_AHEAD` in layer space, so two placed near the same moment stood in
     * the same hole: a speed limit inside a name board, both unreadable, and
     * no amount of luck involved because the spawn point is a constant.
     *
     * A new prop is pushed right until it clears everything still off-screen
     * by `PROP_CLEAR`. That is measured against the widest thing this layer
     * draws — a name board is `textWidth('MAAILMA 1-1') + 12`, about 78 px —
     * plus a margin, so the two arrive one after the other instead of
     * together. It costs the second one a moment, which is the correct price:
     * a sign you cannot read is worth less than a sign that is late.
     */
    let x = Math.round(camX * PROP_PAR) + viewW + PROP_AHEAD;
    for (const other of this.list) {
      if (other.x + PROP_CLEAR > x) x = other.x + PROP_CLEAR;
    }
    const prop = { kind, x, ...data };
    this.list.push(prop);
    return prop;
  }

  /**
   * The ground a prop stands on, decided **once, when it is planted**.
   *
   * Asking every frame was the first version and it is wrong in a way only
   * motion shows: a prop is on a parallax layer, so the tilemap column beneath
   * it changes as the world scrolls past, and the sign rose and sank and its
   * post grew and shrank while it crossed a ledge. Owner: *"the speed signs
   * change their size when the screen scrolls. They should always keep their
   * original height."*
   *
   * A signpost is driven into the ground once. Where it was driven in is a
   * property of the sign, not of what happens to be under it later.
   */
  plant(prop, base) {
    if (base !== null && base !== undefined) prop.base = base;
    return prop;
  }

  /** True while a prop of that kind is still somewhere in the world. */
  has(kind) {
    return this.list.some((p) => p.kind === kind);
  }

  /**
   * Drops what has left on the left. Note this is the only way a prop dies:
   * there is no timer, because a sign the player ran away from and came back
   * to should still be there. Backing up therefore keeps everything alive.
   */
  update(camX, viewW) {
    if (!this.list.length) return;
    this.list = this.list.filter((p) => p.x - camX * PROP_PAR > -REAP);
    // `viewW` is unused here today, and named because the reaping edge is a
    // screen fact: if the view ever widens, this is where it would be read.
    void viewW;
  }

  /**
   * Props stand at the height they were planted at (`plant`), falling back to
   * the backdrop's ground line for anything planted over a pit — the
   * alternative there being a signpost standing on nothing.
   */
  draw(ctx, camX, viewW, groundY) {
    for (const p of this.list) {
      const x = Math.round(p.x - camX * PROP_PAR);
      if (x > viewW + REAP) continue;
      const base = p.base === undefined ? groundY : p.base;
      if (p.kind === 'speed') drawSpeedSign(ctx, x, base, p.limit);
      else if (p.kind === 'card') drawNameBoard(ctx, x, base, p.text);
    }
  }
}

/** A post, drawn from the ground up. Returns the y of its top. */
function post(ctx, x, groundY, h) {
  ctx.fillStyle = '#8c8c94';
  ctx.fillRect(x - 1, groundY - h, 3, h);
  ctx.fillStyle = '#5c5c66';
  ctx.fillRect(x + 1, groundY - h, 1, h);
  return groundY - h;
}

/**
 * A speed limit sign: white disc, red ring, black numerals. `limit` 0 draws
 * the end-of-restrictions sign — the grey disc with diagonal slashes — which
 * is the joke's punchline and the reason the numerals are worth escalating
 * towards. The road tries 30, then 50, then 80, and eventually stops trying.
 */
function drawSpeedSign(ctx, x, groundY, limit) {
  const R = 13;
  const top = post(ctx, x, groundY, POST_H);
  const cy = top - R;

  ctx.beginPath();
  ctx.arc(x, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = limit ? '#d02020' : '#9aa0a8';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, cy, R - 3, 0, Math.PI * 2);
  ctx.fillStyle = '#f4f4f0';
  ctx.fill();

  if (limit) {
    drawText(ctx, String(limit), x - textWidth(String(limit)) / 2 + 1, cy - 3,
      { color: '#181820' });
    return;
  }

  // Four slashes, clipped to the white field: the sign says nothing at all,
  // which after three escalating numbers is the loudest thing it could say.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, cy, R - 3, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#3a3a44';
  for (let i = -3; i <= 3; i++) {
    for (let k = 0; k < R * 2; k++) {
      ctx.fillRect(x - R + k + i * 5, cy - R + k, 1, 1);
    }
  }
  ctx.restore();
}

/**
 * The level name on a roadside board. The name used to be smoke writing high
 * in the sky, and it still is in the levels where the camera climbs instead
 * of running — but where there is a road, the road can say it, and a sign you
 * pass is a place you arrived at rather than a caption over the picture.
 */
function drawNameBoard(ctx, x, groundY, text) {
  const label = String(text).toUpperCase();
  const w = textWidth(label) + 12;
  const h = 15;
  const left = x - Math.round(w / 2);
  post(ctx, left + 5, groundY, POST_H);
  post(ctx, left + w - 5, groundY, POST_H);
  const top = groundY - POST_H - h;

  ctx.fillStyle = '#f4f4f0';
  ctx.fillRect(left, top, w, h);
  ctx.fillStyle = '#1f5c34';
  ctx.fillRect(left + 1, top + 1, w - 2, h - 2);
  drawText(ctx, label, left + 6, top + 4, { color: '#f4f4f0' });
}
