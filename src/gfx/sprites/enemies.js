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

/* ------------------------------- breathing ------------------------------ */

/**
 * Frames from one breath to the next. Not a new number: the player already
 * breathes on `Math.sin(tick / 26) > 0.55` and nobody has ever said he
 * twitches, so the enemies breathe on the same clock and the same threshold.
 * One game, one breath.
 */
export const BREATH_PERIOD = Math.round(Math.PI * 2 * 26);

/**
 * How much of a breath a pixel of ground is worth. See `breath` for why this
 * is a compromise and not a tuned constant. The vertical one may be larger
 * because a walking enemy's `y` does not change at all.
 */
const BREATH_X = 0.02;
const BREATH_Y = 0.055;

/**
 * One shared breathing cycle for everything in this file that is alive.
 * Returns 0 or 1: the pixel the body is lifted by, this frame.
 *
 * **Why one pixel and never less.** The artwork is integer rectangles on a
 * 320x240 canvas. Anything under a pixel either rounds to a pixel anyway or
 * breaks the grid the whole picture rests on, so the amplitude is fixed and
 * the craft is entirely in the period. A pixel that pops twice a second is a
 * tremor; a pixel that pops every three seconds, held up for the shorter third
 * of the cycle, is a chest. That is the player's rhythm, and it is why the
 * exhale outlasts the inhale here — a breath that is symmetric is a blink.
 *
 * **Why the caller passes its own clock.** Every enemy is drawn from its own
 * `tick`, which starts when the camera wakes it, so two enemies the player
 * walked up to at different moments are already out of phase without anything
 * being done about it. What that does *not* cover is a group that wakes on the
 * same frame — a room the player steps into with three walkers already in it —
 * and in that case a row of them would pulse as one body and read as a
 * rendering fault rather than as life. The offset below is what separates
 * those.
 *
 * **Why the offset is small.** `worldmap.js` offsets its sway by tile, which it
 * can afford because a tile does not walk. An enemy carries its offset along
 * with it, so a spatial phase is also a rate change. Measured at 0.02 rad/px
 * and the walker's own 0.55 px/frame: one breath every 164 frames standing
 * still, 127 walking right and 229 walking left, and two walkers a tile apart
 * pop 8 frames apart. Bigger separates neighbours better and swings the rate
 * further; the ceiling is the value at which a walker heading left stops
 * breathing altogether, and this is comfortably under a third of it. The
 * alternative — snapping the offset to the tile grid, as the map does — was
 * rejected because the phase would then jump every time an enemy crossed a
 * tile boundary.
 */
export function breath(tick, x, y) {
  return Math.sin(tick / 26 + x * BREATH_X + y * BREATH_Y) > 0.55 ? 1 : 0;
}

/* -------------------------------- walkers ------------------------------- */

/**
 * `lift` is 0 or 1: how far the body is up this frame.
 *
 * The crown is nailed to the top of the box and the feet to the bottom of it,
 * and the breath moves everything in between — so the drawing covers all
 * sixteen rows and all sixteen columns in every frame of every cycle. That is
 * deliberate and it is the whole reason this sprite was redrawn: it used to
 * paint x+1..+15 and y+3..+16 inside a 16x16 box, which left a three pixel
 * band above its head that could hurt you without being visible (DESIGN.md
 * §7). The fix grew the art into the box rather than shrinking the box onto
 * the art, because the walker is the enemy every other one is a variation of
 * and its box is the size of a stomp everywhere in the game.
 *
 * It also means the breath cannot be a translation. A body that moves up as a
 * whole leaves the floor line empty and floats; one that moves down as a whole
 * empties the band this sprite was redrawn to fill. So the walker breathes the
 * way the player does: the shoulders rise and the legs stretch after them.
 */
function walkerBody(ctx, x, y, frame, facing, squashed, lift = 0) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (squashed) {
    ctx.fillStyle = '#8c5c28';
    ctx.fillRect(px + 1, py + 11, 14, 5);
    ctx.fillStyle = '#5a3410';
    ctx.fillRect(px + 1, py + 14, 14, 2);
    return;
  }
  const b = lift;
  flip(ctx, px, 16, facing < 0, (bx) => {
    ctx.fillStyle = '#a06828';
    ctx.fillRect(bx + 3, py, 10, 3);
    ctx.fillRect(bx + 1, py + 2 - b, 14, 10);
    ctx.fillRect(bx, py + 5 - b, 16, 6);
    ctx.fillStyle = '#7a4c18';
    ctx.fillRect(bx + 1, py + 10 - b, 14, 2);
    ctx.fillStyle = C.white;
    ctx.fillRect(bx + 3, py + 6 - b, 4, 4);
    ctx.fillRect(bx + 9, py + 6 - b, 4, 4);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 5, py + 7 - b, 2, 3);
    ctx.fillRect(bx + 10, py + 7 - b, 2, 3);
    ctx.fillRect(bx + 3, py + 4 - b, 4, 2);
    ctx.fillRect(bx + 9, py + 4 - b, 4, 2);
    const swap = frame % 2 === 0;
    ctx.fillStyle = '#4c2c08';
    ctx.fillRect(bx + (swap ? 0 : 2), py + 12 - b, 6, 4 + b);
    ctx.fillRect(bx + (swap ? 10 : 8), py + 12 - b, 6, 4 + b);
    ctx.fillStyle = 'rgba(168,224,74,0.5)';
    const puff = (frame % 4) + 1;
    ctx.fillRect(bx - 3 - puff, py + 9 - b, puff + 2, 3);
  });
}

export function drawWalker(ctx, x, y, frame, facing, squashed) {
  // `frame` is the walker's tick divided by eight; the breath wants frames.
  const lift = breath(frame * 8, x, y);
  outlined(ctx, (g) => walkerBody(g, x, y, frame, facing, squashed, lift));
}

/**
 * The head is the top of this one's box, so the head is what stays put and the
 * shell rides up and down behind it — a turtle's breath rather than a walker's.
 * A shell with nobody in it does not breathe: it is a rolling object, and the
 * spin is its animation.
 */
function shellBody(ctx, x, y, frame, facing, mode, lift = 0) {
  const px = Math.round(x);
  const py = Math.round(y);
  const b = lift;
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
    ctx.fillRect(bx + 1, py + 8 - b, 12, 12);
    ctx.fillStyle = C.shellDark;
    ctx.fillRect(bx + 2, py + 12 - b, 10, 3);
    ctx.fillStyle = C.rim;
    ctx.fillRect(bx + 1, py + 18 - b, 12, 3);
    ctx.fillStyle = '#f0d060';
    ctx.fillRect(bx + 8, py + 1, 7, 7);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 12, py + 3, 2, 2);
    ctx.fillStyle = '#c8a030';
    ctx.fillRect(bx + 8, py + 6, 6, 2);
    ctx.fillStyle = '#f0d060';
    const swap = Math.floor(frame / 4) % 2 === 0;
    ctx.fillRect(bx + (swap ? 1 : 3), py + 20 - b, 5, 4 + b);
    ctx.fillRect(bx + (swap ? 8 : 6), py + 20 - b, 5, 4 + b);
  });
}

export function drawShell(ctx, x, y, frame, facing, mode) {
  const lift = mode === 'walk' ? breath(frame, x, y) : 0;
  outlined(ctx, (g) => shellBody(g, x, y, frame, facing, mode, lift));
}

/**
 * No breath on this one: it bounces off the floor every time it lands, which is
 * as much vertical motion as any body needs, and a second cycle underneath a
 * hop only fights it.
 *
 * It is drawn from the enemy's raw tick rather than from every eighth frame the
 * way the walker is, so the walk cycle had to be divided down here — passing
 * the tick straight through swapped its legs on every single frame, which is
 * not a gait but a 30 Hz flicker.
 */
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
    walkerBody(g, px, py, Math.floor(frame / 8), facing, false, 0);
  });
}

/**
 * The plant is bolted to a pipe, so its breath is the one part of it that can
 * move without moving the pipe: the head draws itself up off the stem and
 * settles back down onto it. Its crown is the top of its box — that is what
 * a stomp lands on — so the crown is exactly what may not move.
 */
function plantBody(ctx, x, y, frame, lift = 0) {
  const px = Math.round(x);
  const py = Math.round(y);
  const b = lift;
  ctx.fillStyle = C.greenDark;
  ctx.fillRect(px + 5, py + 10 - b, 6, 22 + b);
  ctx.fillStyle = C.green;
  ctx.fillRect(px + 6, py + 10 - b, 3, 22 + b);
  const open = Math.floor(frame / 12) % 2 === 0;
  ctx.fillStyle = '#e04040';
  ctx.fillRect(px + 1, py, 14, 11 - b);
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
    ctx.fillRect(px + 3, py + 5 - b, 10, 4);
    ctx.fillStyle = C.white;
    for (let i = 0; i < 4; i++) ctx.fillRect(px + 3 + i * 3, py + 5 - b, 2, 2);
  } else {
    ctx.fillStyle = '#a02020';
    ctx.fillRect(px + 2, py + 6 - b, 12, 3);
  }
}

export function drawPlant(ctx, x, y, frame) {
  outlined(ctx, (g) => plantBody(g, x, y, frame, breath(frame, x, y)));
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

/**
 * Ummetuskorkki — corks you up instead of hurting you.
 *
 * This one used to jog its whole body a pixel down every six frames, feet and
 * all, which put its soles a pixel below the box it is hit with and read as a
 * vibration rather than as a body. Now it breathes on the shared cycle: the
 * body lifts and the stubby feet stretch after it, so the soles stay on the
 * floor line where the collision is.
 */
function corkGuyBody(ctx, x, y, frame, facing, lift = 0) {
  const px = Math.round(x);
  const py = Math.round(y);
  const b = lift;
  flip(ctx, px, 16, facing < 0, (bx) => {
    ctx.fillStyle = C.corkDark;
    ctx.fillRect(bx + 2, py + 2 - b, 12, 12);
    ctx.fillStyle = C.cork;
    ctx.fillRect(bx + 3, py + 3 - b, 10, 10);
    ctx.fillStyle = C.corkDark;
    ctx.fillRect(bx + 3, py + 6 - b, 10, 1);
    ctx.fillRect(bx + 3, py + 10 - b, 10, 1);
    ctx.fillStyle = C.white;
    ctx.fillRect(bx + 4, py + 7 - b, 3, 3);
    ctx.fillRect(bx + 9, py + 7 - b, 3, 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 5, py + 8 - b, 2, 2);
    ctx.fillRect(bx + 10, py + 8 - b, 2, 2);
    ctx.fillStyle = '#7a4c18';
    ctx.fillRect(bx + 4, py + 14 - b, 3, 2 + b);
    ctx.fillRect(bx + 9, py + 14 - b, 3, 2 + b);
  });
}

export function drawCorkGuy(ctx, x, y, frame, facing) {
  outlined(ctx, (g) => corkGuyBody(g, x, y, frame, facing, breath(frame, x, y)));
}

/* ------------------------------ kurnuttaja ------------------------------ */

/**
 * KURNUTTAJA — the thing that lives at the bottom of a chasm and springs out of
 * it. Its name is on it in exactly four places: this function, the class in
 * entities/enemies.js, the `REGISTRY` entry in core/savestate.js, and the
 * `ENEMY_CHARS` line that spawns it. Renaming it is those four edits and
 * nothing else — the game never prints the name anywhere.
 *
 * Two decisions the drawing makes, and both are about the *hole* rather than
 * about the creature:
 *
 *   - **The eyes are on top of the head, and they are the top of the box.** A
 *     frog's eyes are where they are because a frog looks up out of water; this
 *     one looks up out of a pit, at the player standing on the rim. It is the
 *     one part of the silhouette that arrives first when it comes up, so it is
 *     the part that has to say what this is.
 *   - **Turquoise, which nothing else in this game is.** The walker is brown,
 *     the shell green, the spiky one purple-grey, the cork tan, the plant red.
 *     A new species that borrowed one of those would be read as a variant of it
 *     from across a screen, which is the one distance that matters here — you
 *     are meant to recognise an occupied pit before you are standing on its rim.
 *
 * The breath is the walker's: eyes nailed to the top of the box, feet nailed to
 * the bottom, and the body drawn up between them. That is not a style choice —
 * it is the only shape that keeps art on all four edges of a 16x16 box in every
 * frame of the cycle, which is what `verify.mjs` measures.
 */
function kurnuttajaBody(ctx, x, y, frame, facing, lift = 0) {
  const px = Math.round(x);
  const py = Math.round(y);
  const b = lift;
  flip(ctx, px, 16, facing < 0, (bx) => {
    // The two eye turrets, and they do not move: they are the box's ceiling.
    ctx.fillStyle = '#1e5a4c';
    ctx.fillRect(bx, py, 6, 5);
    ctx.fillRect(bx + 10, py, 6, 5);
    // The body, which is the part that breathes.
    ctx.fillRect(bx, py + 4 - b, 16, 9);
    ctx.fillStyle = '#348c6e';
    ctx.fillRect(bx + 1, py + 5 - b, 14, 6);
    // A throat sac, pale and low, so the belly is the brightest thing on it and
    // the eye is dragged to the bottom of the sprite where the mouth is.
    ctx.fillStyle = '#6cc8a0';
    ctx.fillRect(bx + 3, py + 8 - b, 10, 4);
    ctx.fillStyle = '#123c34';
    ctx.fillRect(bx + 3, py + 7 - b, 10, 2);
    ctx.fillStyle = C.white;
    ctx.fillRect(bx + 1, py + 1, 4, 3);
    ctx.fillRect(bx + 11, py + 1, 4, 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 2, py + 2, 2, 2);
    ctx.fillRect(bx + 12, py + 2, 2, 2);
    /* The hind legs, and they only paddle. A leaper's legs *want* to kick out
     * at take-off, and that was tried and thrown away: a silhouette that grows
     * on the frame it starts moving is a silhouette that stops agreeing with
     * the box it hurts you with, exactly once, at the worst possible moment. */
    ctx.fillStyle = '#1e5a4c';
    const swap = Math.floor(frame / 8) % 2 === 0;
    ctx.fillRect(bx + (swap ? 0 : 1), py + 12 - b, 6, 4 + b);
    ctx.fillRect(bx + (swap ? 10 : 9), py + 12 - b, 6, 4 + b);
  });
}

export function drawKurnuttaja(ctx, x, y, frame, facing) {
  outlined(ctx, (g) => kurnuttajaBody(g, x, y, frame, facing, breath(frame, x, y)));
}

/** How many bubbles are in the air over the hole at once. */
const CROAK_BUBBLES = 5;

/**
 * KURNUTUS — the warning, and it is drawn in the air above the pit rather than
 * on the creature, because the creature is at the bottom of the hole where a
 * running player cannot see it.
 *
 * `t` is 0..1 through the wind-up and `lipY` is the floor line the pit is cut
 * into, so the bubbles start exactly where the ground stops and climb from
 * there. Three deliberate differences from the two warnings this game already
 * owns (DESIGN.md §8 — a new signal that looks like an old one teaches the
 * player to read the wrong thing):
 *
 *   - **place.** The heartburn jet's warning ember sits *on* the floor and the
 *     sun's swell gathers *on* the sun. This happens over a hole, in the one
 *     part of the picture that has no floor in it at all.
 *   - **colour.** The ember is fire, orange over red. The gas the player's own
 *     jumps leak is yellow-green (`C.gas`). This is a pale blue-green, which is
 *     neither, and it is the creature's own colour lightened rather than a new
 *     one to learn.
 *   - **rhythm.** The ember flickers between two colours every three frames —
 *     a flicker, which reads as "on". This is a rising column whose bubbles get
 *     faster and reach higher as the leap approaches, so it reads as "soon" and
 *     says *how* soon. That is the difference the whole design rests on.
 */
export function drawCroak(ctx, x, lipY, t, tick) {
  if (t <= 0) return;
  const alpha = ctx.globalAlpha;
  const cx = Math.round(x) + 8;
  const base = Math.round(lipY);
  // How far up the column reaches, and how fast one bubble travels it. The rate
  // is squared so the last third of the warning is visibly hurrying: a linear
  // ramp reads as a decoration that happens to be there, not as a countdown.
  const reach = 6 + Math.round(26 * t);
  const rate = 0.05 + 0.11 * t * t;
  for (let i = 0; i < CROAK_BUBBLES; i++) {
    const u = ((tick * rate) + i / CROAK_BUBBLES) % 1;
    const r = Math.max(1, 3 - Math.round(u * 2));
    const sway = Math.round(Math.sin((tick + i * 9) / 7) * 3 * u);
    ctx.globalAlpha = (0.25 + 0.55 * (1 - u)) * (0.35 + 0.65 * t);
    ctx.fillStyle = '#5cc8a0';
    ctx.fillRect(cx + sway - r, base - Math.round(u * reach) - r, r * 2, r * 2);
    ctx.fillStyle = '#d8fff0';
    ctx.fillRect(cx + sway - r, base - Math.round(u * reach) - r, r, 1);
  }
  ctx.globalAlpha = alpha;
}

/**
 * How long one ember of the sun's wake burns, in frames. It lives here rather
 * than with the entity because how long a spark stays lit is a question about
 * the picture; the entity only counts it down.
 */
export const SUN_TRAIL_LIFE = 26;

/**
 * The sun's burning wake.
 *
 * ROADMAP lists this under the queued screen effects with the rule attached:
 * an effect on **one object** belongs in the drawing code, an effect on the
 * **whole screen** belongs in postfx.js, and nothing falls in between. Post
 * sees only the finished picture and cannot tell which pixel was the sun.
 *
 * Two techniques, both already sanctioned by the changelog: `'lighter'` for the
 * glow and `globalAlpha` for the fade. Not `ctx.filter = 'drop-shadow()'` —
 * per sprite that costs more than the entire post-processing pass and is banned
 * by name. Both are put back before this returns; verify.mjs asserts that for
 * every sprite in the game.
 *
 * It costs at most 28 integer rectangles, which is what makes an effect like
 * this cheap here at all: the sprites are procedural, so a spark is two
 * fillRects and not a second copy of the artwork.
 */
export function drawSunTrail(ctx, trail) {
  if (!trail || trail.length === 0) return;
  const op = ctx.globalCompositeOperation;
  const alpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  for (const s of trail) {
    const t = Math.max(0, Math.min(1, s.life / SUN_TRAIL_LIFE));
    const ex = Math.round(s.x) + 10;
    const ey = Math.round(s.y) + 10;
    // Cubed rather than linear: an ember should be gone well before its slot
    // is reused, or the wake reads as a solid bar rather than as sparks.
    const r = Math.max(1, Math.round(1 + 5 * t));
    ctx.globalAlpha = 0.34 * t * t;
    ctx.fillStyle = '#ff6810';
    ctx.fillRect(ex - r, ey - r, r * 2, r * 2);
    const c = Math.max(1, r - 2);
    ctx.globalAlpha = 0.5 * t * t * t;
    ctx.fillStyle = '#ffd048';
    ctx.fillRect(ex - c, ey - c, c * 2, c * 2);
  }
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = op;
}

/** A filled circle in the row-at-a-time idiom the disc below already uses. */
function hotDisc(ctx, cx, cy, radius) {
  for (let dy = -radius; dy <= radius; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, radius * radius - dy * dy)));
    if (half > 0) ctx.fillRect(cx - half, cy + dy, half * 2, 1);
  }
}

/**
 * Vihainen aurinko — hovers over the desert and dive-bombs the player.
 *
 * `fx.windUp` is 0..1 through the dive's telegraph and `fx.trail` is the
 * burning wake; both are optional, so a caller that only wants the sun (the
 * death tumble, a test) can leave them out.
 *
 * The telegraph must not be mistaken for the boss's own effects — DESIGN.md §8:
 * two similar "something is happening" signals teach the player to read the
 * wrong one. The shockwave is a tan-brown blob on the floor flickering every
 * three frames; this is orange-white, in the sky, and a smooth swell whose
 * throb *accelerates* as the dive gets closer. Different colour, different
 * place, different rhythm.
 */
export function drawAngrySun(ctx, x, y, tick, diving, hurt, fx) {
  if (fx && fx.trail) drawSunTrail(ctx, fx.trail);
  const wind = fx && fx.windUp ? Math.max(0, Math.min(1, fx.windUp)) : 0;
  const cx = Math.round(x) + 10;
  const cy = Math.round(y) + 10;
  // Halfway through the wind-up it goes hot: one step the eye cannot miss,
  // under a continuous swell that says how much longer you have.
  const hot = diving || hurt || wind > 0.5;
  const disc = hurt && Math.floor(tick / 2) % 2 ? '#ffffff' : hot ? '#ff9820' : '#ffd048';
  const rayColor = hot ? '#ff6810' : '#f8a820';

  if (wind > 0) {
    const op = ctx.globalCompositeOperation;
    const alpha = ctx.globalAlpha;
    // A heartbeat that speeds up. `wind * wind` keeps it continuous in wind —
    // scaling the *frequency* by a changing number would jump the phase.
    const beat = 0.55 + 0.45 * Math.sin(wind * wind * 18);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.10 + 0.30 * wind * beat;
    ctx.fillStyle = '#ff6810';
    hotDisc(ctx, cx, cy, 11 + Math.round(9 * wind));
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = op;
  }

  // eight rays, slowly turning, reaching further as it charges
  const reach = 12 + Math.round(4 * wind);
  const rot = tick * 0.035;
  ctx.fillStyle = rayColor;
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    for (let r = 8; r <= reach; r++) {
      const w = reach + 1 - r;
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
function spikeGuyBody(ctx, x, y, frame, facing, lift = 0) {
  const px = Math.round(x);
  const py = Math.round(y);
  // The spines ride on the back, so they go up and down with it. The rest pose
  // is the low one on purpose: the points already reach above the box (they
  // are art that cannot hurt you, which is the harmless half of the rule), and
  // breathing upwards from the old rest height would have reached further.
  const b = lift;
  flip(ctx, px, 16, facing < 0, (bx) => {
    ctx.fillStyle = '#3c3450';
    ctx.fillRect(bx + 1, py + 6 - b, 14, 8 + b);
    ctx.fillStyle = '#584c74';
    ctx.fillRect(bx + 2, py + 7 - b, 12, 5);
    ctx.fillStyle = C.white;
    ctx.fillRect(bx + 3, py + 9 - b, 4, 4);
    ctx.fillRect(bx + 9, py + 9 - b, 4, 4);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 5, py + 10 - b, 2, 3);
    ctx.fillRect(bx + 10, py + 10 - b, 2, 3);
    // Angry brows: the plant taught us a face reads as a character, and this
    // one is a character you are meant to walk around.
    ctx.fillRect(bx + 3, py + 8 - b, 4, 1);
    ctx.fillRect(bx + 9, py + 8 - b, 4, 1);
    ctx.fillStyle = '#2a2438';
    const swap = frame % 2 === 0;
    ctx.fillRect(bx + (swap ? 1 : 3), py + 13, 5, 3);
    ctx.fillRect(bx + (swap ? 10 : 8), py + 13, 5, 3);
    drawSpines(ctx, bx + 1, py + 6 - b, 14, 1, frame);
  });
}

export function drawSpikeGuy(ctx, x, y, frame, facing) {
  // `frame` is the enemy's tick halved; the breath wants frames.
  const lift = breath(frame * 2, x, y);
  outlined(ctx, (g) => spikeGuyBody(g, x, y, frame, facing, lift));
}

/**
 * Papupommi — the bean a baron throws. 10x10 and it has to read against sand,
 * so it is the same trick the fart ball uses: a dark rim, a bright core, and a
 * lit fuse-seam that blinks on a beat of its own. Nothing about it rotates —
 * a spinning 10 px sprite is a smudge.
 */
export function drawBeanBomb(ctx, x, y, tick) {
  const px = Math.round(x);
  const py = Math.round(y);
  const beat = Math.floor(tick / 4) % 2;
  ctx.fillStyle = '#2a1206';
  ctx.fillRect(px, py + 1, 10, 8);
  ctx.fillRect(px + 1, py, 8, 10);
  ctx.fillStyle = '#8c3c1c';
  ctx.fillRect(px + 1, py + 2, 8, 6);
  ctx.fillRect(px + 2, py + 1, 6, 8);
  ctx.fillStyle = '#c05a24';
  ctx.fillRect(px + 2, py + 2, 3, 3);
  ctx.fillStyle = beat ? '#f4ffd0' : '#a8e04a';
  ctx.fillRect(px + 3, py + 4, 4, 2);
  ctx.fillStyle = `rgba(168,224,74,${beat ? 0.55 : 0.3})`;
  ctx.fillRect(px + 3, py - 2, 3, 3);
}

/**
 * PAPUPAROONI — the desert mini-boss. 18x26, so it stands a head taller than
 * anything else that walks in this game and reads as a boss from across the
 * arena before it has done anything.
 *
 * The silhouette carries the fight: a wide sash-belly, a flat-brimmed sun hat,
 * and — the part that matters — a bean held up over the hat while it winds up.
 * `lift` runs 0..1 through the wind-up, so the arm going up *is* the telegraph
 * rather than a separate flash to learn. `hurt` blinks it after a stomp lands,
 * which is the only way to tell a two-hit enemy from a one-hit one.
 */
function baronBody(ctx, x, y, frame, facing, lift, hurt) {
  const px = Math.round(x);
  const py = Math.round(y);
  const bob = Math.floor(frame / 2) % 2;
  const skin = hurt ? '#f8e0c0' : '#c8a058';
  const coat = hurt ? '#f0c8a0' : '#6a3c58';
  const coatDark = hurt ? '#c89870' : '#3c2032';
  flip(ctx, px, 18, facing < 0, (bx) => {
    // legs, short and planted wide
    ctx.fillStyle = coatDark;
    const swap = frame % 2 === 0;
    ctx.fillRect(bx + (swap ? 1 : 3), py + 22, 6, 4);
    ctx.fillRect(bx + (swap ? 11 : 9), py + 22, 6, 4);
    // the belly, which is most of him
    ctx.fillStyle = coat;
    ctx.fillRect(bx + 1, py + 11 + bob, 16, 11 - bob);
    ctx.fillRect(bx + 2, py + 9, 14, 4);
    ctx.fillStyle = coatDark;
    ctx.fillRect(bx + 1, py + 19, 16, 3);
    // sash
    ctx.fillStyle = C.gold;
    ctx.fillRect(bx + 2, py + 16, 14, 2);
    // head under the brim
    ctx.fillStyle = skin;
    ctx.fillRect(bx + 4, py + 4, 10, 6);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 6, py + 6, 2, 2);
    ctx.fillRect(bx + 10, py + 6, 2, 2);
    ctx.fillRect(bx + 5, py + 5, 3, 1);
    ctx.fillRect(bx + 10, py + 5, 3, 1);
    // moustache, because the face has to have one thing that is his
    ctx.fillStyle = coatDark;
    ctx.fillRect(bx + 5, py + 9, 8, 2);
    // the hat: flat brim, low crown
    ctx.fillStyle = '#4a2c18';
    ctx.fillRect(bx, py + 3, 18, 2);
    ctx.fillRect(bx + 4, py, 10, 3);
    ctx.fillStyle = '#6a4424';
    ctx.fillRect(bx + 5, py + 1, 8, 1);
    // the arm, and the bean it is winding up
    if (lift > 0) {
      const rise = Math.round(lift * 7);
      ctx.fillStyle = skin;
      ctx.fillRect(bx + 14, py + 10 - rise, 3, 6);
      ctx.fillStyle = '#8c3c1c';
      ctx.fillRect(bx + 13, py + 5 - rise, 6, 5);
      ctx.fillStyle = lift > 0.6 ? '#f4ffd0' : '#a8e04a';
      ctx.fillRect(bx + 15, py + 6 - rise, 2, 2);
    } else {
      ctx.fillStyle = skin;
      ctx.fillRect(bx + 15, py + 12, 3, 6);
    }
    // a slow leak, so he is unmistakably of this game
    ctx.fillStyle = 'rgba(168,224,74,0.45)';
    const puff = (frame % 4) + 1;
    ctx.fillRect(bx - 2 - puff, py + 17, puff + 2, 3);
  });
}

export function drawBeanBaron(ctx, x, y, frame, facing, lift = 0, hurt = false) {
  outlined(ctx, (g) => baronBody(g, x, y, frame, facing, lift, hurt));
}
