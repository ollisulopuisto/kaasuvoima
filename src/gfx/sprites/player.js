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
  /* Paukkupapu. The darkest, heaviest palette of the four, because the thing it
   * does is walk through a wall — and it must not be mistaken for the mushroom,
   * whose red is the one every player learns first. Bean brown over gas green. */
  pop: { cap: '#c05a24', shirt: '#8c3c1c', shirtDark: '#4a1c0a', pants: C.gasDark, pantsDark: '#2c4c14' },
};

/**
 * The order the three leg frames are played in, and therefore how long a
 * stride is. A walk is contact, pass, contact, pass: the two contact poses (0
 * and 2) must never follow one another, or the character puts both feet down
 * twice in a row once per stride and limps.
 *
 * The driver used to run the frames with `% 3`, which wraps 2 straight back to
 * 0 with nothing between them. The frames themselves were always right — this
 * is only their order. Mapping the index through a table rather than
 * renumbering the frames keeps every other caller drawing exactly what it drew
 * before, because 0, 1 and 2 still mean the poses they always meant.
 */
const WALK_ORDER = [0, 1, 2, 1];
export const WALK_FRAMES = WALK_ORDER.length;

/**
 * Frames of standing perfectly still before the *second* tier of idle starts.
 *
 * Twenty seconds, which is not a guess: it is the same wait the title screen
 * makes before the cabinet starts playing by itself, so the game has one dead
 * time and a player only ever has to learn it once. The dead time is the whole
 * joke — a gag on a short loop stops being a gag inside the first hour — and
 * the breathing that starts immediately stays exactly as it was, as tier one.
 */
export const DEEP_IDLE = 20 * 60;

/**
 * The three-frame leg cycle: apart, together, apart the other way. Five pixels
 * tall from the top of the thigh to the sole, so it is called at the point that
 * leaves the sole on the last row of the body box and not one below it.
 *
 * The stride is capped by the width it has to fit in. A run opens the legs one
 * pixel wider than a walk, which on the 14px body leaves a two pixel gap
 * between them — but on the 12px body of power level 0 it closed the gap
 * completely, so the running frames merged into one block and the small
 * character ran with less motion in his legs than he walked with.
 */
function legs(ctx, x, y, w, pal, frame, running) {
  ctx.fillStyle = pal.pants;
  const spread = Math.min(running ? 4 : 3, (w - 6) >> 1);
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
 * Which second-tier idle is running and how far into it we are, or null.
 *
 * One function rather than a flag on the pose, because two different layers ask
 * the same question: the body, which draws the icicles and the flame, and
 * `drawPlayer`, which draws the ZZZ beside the body rather than on it.
 *
 * **The ZZZ is a symbol, and that was a decision.** The icicle breath and the
 * burning hair are the room acting on the character — cold and heat doing what
 * cold and heat do — so they are diegetic in the sense DESIGN.md §8 gives, they
 * are drawn by the body and they grow with it. A ZZZ is not in the room; it is
 * a comic-book convention, and this game had not used one.
 *
 * It is in anyway, and the reason is that the convention is not actually new
 * here: `LevelScene.addScorePop` already floats words and numbers over the
 * world, attached to whoever earned them — 'UMMETUS' pops out of the player's
 * own head. The ZZZ joins that layer rather than starting one. The boundary
 * that comes with it, so the next person knows where it stops: a symbol may
 * hang off the player at rest, it may never carry information the player needs
 * to act on, and it never goes on an enemy — a '!' over a guard's head is a
 * game telling you what it should have shown you.
 *
 * Which is also why it is drawn where it is drawn: not by `drawPlayerBase`,
 * because it is not part of the body, and at a fixed size, because a thought
 * does not get bigger when the thinker eats a mushroom.
 */
function deepIdle(s) {
  const idle = s.idle || 0;
  if (idle < DEEP_IDLE || s.state !== 'idle' || s.ducking) return null;
  const kind = s.theme === 'ice' ? 'frost'
    : s.theme === 'desert' || s.theme === 'factory' ? 'fire' : 'sleep';
  return { kind, d: idle - DEEP_IDLE };
}

/**
 * The second-tier performance itself. Three of them, one per theme, all pure
 * functions of how long the player has been standing there — so a save state
 * restores the same frame of the same gag, and letting go of the pad twice in
 * the same place does not produce two different animations.
 */
function deepPose(pose, deep) {
  const d = deep.d;

  if (deep.kind === 'sleep') {
    /* Falling asleep is a droop and a jerk, not a nod: the head sinks over four
     * seconds and comes back up in one frame, which is the shape of the joke.
     * The eyes are shut for the sinking and open for the fright. */
    const k = d % 120;
    pose.nod = k < 105 ? Math.min(3, Math.floor(k / 26)) : 0;
    pose.blink = k < 105;
    // A slower, deeper breath than the standing one — he is asleep.
    pose.breath = Math.sin(d / 40) > 0.2 ? -1 : 0;
    return;
  }

  if (deep.kind === 'frost') {
    /* Draw the air in, then breathe out three icicles one after another. Each
     * one is its own age in frames, so they leave the mouth in single file and
     * fall away instead of appearing as a block. */
    const k = d % 150;
    pose.breath = k < 40 ? -1 : 0;
    const out = [];
    for (let i = 0; i < 3; i++) {
      const t = k - (40 + i * 8);
      if (t >= 0 && t < 24) out.push(t);
    }
    pose.puffs = out;
    return;
  }

  /* Fire. Catches first — a beat where nothing else happens, so the player sees
   * it before the character does — then the panic, then it is out, and there is
   * a rest before it can possibly happen again. It does not hurt him, it does
   * not touch the hitbox, and it never blocks input. */
  const k = d % 200;
  const flail = Math.floor(k / 6) % 2 ? 1 : 2;
  if (k < 24) pose.burn = 1 + (k > 11 ? 1 : 0);
  else if (k < 120) { pose.burn = 3 + (Math.floor(k / 4) % 2); pose.panic = flail; }
  else if (k < 150) { pose.burn = Math.max(1, 4 - Math.floor((k - 120) / 8)); pose.panic = flail; }
  else if (k < 168) { pose.smoke = true; pose.blink = true; }
  /* The arms alone were not panic — from any distance they read as a stretch.
   * The body goes with them, one pixel either way on the same beat, which is
   * the shiver's trick borrowed for the opposite temperature. */
  if (pose.panic) pose.shiver = pose.panic === 1 ? 1 : -1;
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
    nod: 0, burn: 0, smoke: false, panic: 0, puffs: null,
  };
  if (!still) return pose;

  /*
   * Breathing: the torso rises and settles about once every one and a half
   * seconds. One pixel is plenty at this size.
   *
   * `breath` lifts the *shoulders* and stretches the shirt down to the belt,
   * and it moves nothing else. It used to be added to the head and the shirt
   * together, which broke the character twice over: the cap left the top of the
   * hitbox for a third of every breath, and since the trousers stayed put, a
   * one pixel gap opened at the waist and the whole lower half came away as a
   * separate piece at every power level above 0. A chest that expands is what
   * the animation was always described as; a body that separates is not.
   */
  pose.breath = Math.sin(tick / 26) > 0.55 ? -1 : 0;
  // A blink every couple of seconds, three frames long.
  pose.blink = tick % 150 < 4;

  /* Twenty seconds in, the ordinary beats hand over to the big one. They stop
   * rather than layer: a man scratching his neck while his hair burns is two
   * animations arguing, and the shiver would drag the icicles sideways with
   * the body it displaces. */
  const deep = deepIdle(s);
  if (deep) {
    deepPose(pose, deep);
    return pose;
  }

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

/**
 * Both arms lifted, each to its own height, drawn as one band from the hand
 * down to the shoulder so the arm is attached to the body it belongs to.
 *
 * Shared by the climb and by the panic over the burning hair, because they are
 * the same drawing problem: the arms leave the sides of the shirt and must not
 * leave the columns the hanging arms already occupy — those columns are the one
 * pixel of overhang the hitbox has always allowed on each side, and widening
 * them would mean moving PLAYER_SIZES, which moves every collision in the game.
 */
function armsUp(ctx, px, py, backTop, frontTop, pal, small) {
  const shoulder = small ? py + 12 : py + 18;
  const w = small ? 2 : 3;
  const bx = small ? px : px - 1;
  const fx = small ? px + 10 : px + 12;
  ctx.fillStyle = C.skin;
  ctx.fillRect(bx, backTop, w, shoulder - backTop);
  ctx.fillRect(fx, frontTop, w, shoulder - frontTop);
  ctx.fillStyle = C.skinDark;
  // Knuckles, so a raised arm ends in a hand rather than in a stump.
  ctx.fillRect(bx, backTop, w, 1);
  ctx.fillRect(fx, frontTop, w, 1);
  /* …and a shaded inner edge, which is the only thing that keeps the arm from
   * being part of the head. On the 14px body the head is nine of them, so a
   * raised arm stands directly against it with no gap, and drawn flat the two
   * merged into one slab of skin with a hat on: the pose read as a man with no
   * arms rather than a man reaching up. One pixel of shadow separates them at
   * every size, and it is on the arm rather than the head because the arm is
   * the thing in front. */
  if (!small) {
    ctx.fillRect(bx + w - 1, backTop, 1, shoulder - backTop);
    ctx.fillRect(fx, frontTop, 1, shoulder - frontTop);
  }
  ctx.fillStyle = pal.shirt;
}

/**
 * Up a vine, seen from behind, gripping the stalk: no face, the nape in shadow,
 * both arms up and the legs climbing opposite them. Two frames, driven by the
 * hand-over-hand counter the engine was already keeping and throwing away.
 *
 * Read from behind rather than from the side because the sprite has exactly one
 * profile and a side view of a climb is a jump pose with the arms moved — which
 * is what it looked like for as long as `state()` said `jump`. Turning him
 * round costs one eye and one shadow and it is unmistakable at every size.
 */
function climbPose(ctx, px, py, pal, s, small) {
  const frame = (s.frame || 0) % 2;
  if (small) {
    ctx.fillStyle = pal.cap;
    ctx.fillRect(px + 2, py, 8, 3);
    ctx.fillRect(px + 2, py + 3, 10, 1);
    if (pal.spots) capSpots(ctx, px + 2, py, 8);
    ctx.fillStyle = C.skin;
    ctx.fillRect(px + 3, py + 4, 7, 5);
    ctx.fillStyle = C.skinDark;      // the nape, where the face is not
    ctx.fillRect(px + 3, py + 7, 7, 2);
    ctx.fillStyle = pal.shirt;
    ctx.fillRect(px + 2, py + 9, 8, 3);
    armsUp(ctx, px, py, frame ? py + 4 : py + 7, frame ? py + 7 : py + 4, pal, true);
    ctx.fillStyle = pal.pants;
    ctx.fillRect(px + 3, py + 11, 6, 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(px + 2, frame ? py + 12 : py + 14, 4, 2);
    ctx.fillRect(px + 6, frame ? py + 14 : py + 12, 4, 2);
    return;
  }
  ctx.fillStyle = pal.cap;
  ctx.fillRect(px + 3, py, 9, 4);
  ctx.fillRect(px + 2, py + 4, 12, 2);
  if (pal.spots) capSpots(ctx, px + 3, py, 9);
  ctx.fillStyle = C.skin;
  ctx.fillRect(px + 3, py + 6, 9, 7);
  ctx.fillStyle = C.skinDark;
  ctx.fillRect(px + 3, py + 11, 9, 2);
  ctx.fillStyle = pal.shirt;
  ctx.fillRect(px + 2, py + 13, 10, 5);
  ctx.fillStyle = pal.shirtDark;
  ctx.fillRect(px + 2, py + 17, 10, 1);
  armsUp(ctx, px, py, frame ? py + 6 : py + 11, frame ? py + 11 : py + 6, pal, false);
  ctx.fillStyle = pal.pants;
  ctx.fillRect(px + 2, py + 18, 10, 4);
  ctx.fillStyle = pal.pantsDark;
  ctx.fillRect(px + 2, py + 18, 10, 1);
  // Opposite the arms: the leg on the side of the low hand is the one drawn up.
  const backLift = frame ? 3 : 0;
  const frontLift = frame ? 0 : 3;
  ctx.fillStyle = pal.pants;
  ctx.fillRect(px + 3, py + 22 - backLift, 3, 2);
  ctx.fillRect(px + 8, py + 22 - frontLift, 3, 2);
  ctx.fillStyle = C.ink;
  ctx.fillRect(px + 2, py + 24 - backLift, 4, 2);
  ctx.fillRect(px + 8, py + 24 - frontLift, 4, 2);
}

/**
 * Hair on fire. Gold core, red edge, and it grows and shrinks from the bottom
 * up, so `burn` is simply how many of the four rows are alight. It sits on the
 * cap and touches it — a flame floating a pixel clear of the head is a separate
 * object, and the check that says the player is one piece would be right.
 */
function hairFire(ctx, c, y, burn) {
  /* [row, edge spans, gold span] — four rows tapering to a point. */
  const edge = ['#e04c3c'];
  for (let i = 0; i < Math.min(4, burn); i++) {
    const ry = y - 1 - i;
    ctx.fillStyle = edge[0];
    if (i === 0) { ctx.fillRect(c - 3, ry, 1, 1); ctx.fillRect(c + 3, ry, 1, 1); }
    if (i === 1) { ctx.fillRect(c - 2, ry, 1, 1); ctx.fillRect(c + 2, ry, 1, 1); }
    if (i === 2) ctx.fillRect(c - 1, ry, 3, 1);
    if (i === 3) ctx.fillRect(c, ry, 1, 1);
    ctx.fillStyle = C.gold;
    if (i === 0) ctx.fillRect(c - 2, ry, 5, 1);
    if (i === 1) ctx.fillRect(c - 1, ry, 3, 1);
  }
}

/** What is left of it: two puffs, still touching the head they came off. */
function hairSmoke(ctx, c, y) {
  ctx.fillStyle = '#c8c8d0';
  ctx.fillRect(c - 2, y - 2, 3, 2);
  ctx.fillRect(c, y - 4, 3, 2);
}

/**
 * One icicle of frozen breath. Same three blues as the sweat bead, and for the
 * same reason: a pale dot on its own is a rounding error at this size, and the
 * dark rim is what makes it read against the sky as well as against the face.
 */
function icicle(ctx, x, y) {
  ctx.fillStyle = '#2a4a6a';
  ctx.fillRect(x, y, 3, 4);
  ctx.fillRect(x + 1, y + 4, 1, 1);
  ctx.fillStyle = '#7fc8f0';
  ctx.fillRect(x, y, 2, 3);
  ctx.fillStyle = '#e8f8ff';
  ctx.fillRect(x, y, 1, 1);
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
      if (s.state === 'climb') {
        climbPose(ctx, px, py, pal, s, true);
        if (s.type === 'leaf') ears(ctx, px, py, 12);
        return;
      }
      const b = pose.breath;
      // Nodding off drops the head into the shoulders; nothing else moves.
      const hy = py + Math.min(2, pose.nod);
      ctx.fillStyle = pal.cap;
      ctx.fillRect(px + 2, hy, 8, 3);
      ctx.fillRect(px + 2, hy + 3, 10, 1);
      if (pal.spots) capSpots(ctx, px + 2, hy, 8);
      ctx.fillStyle = C.skin;
      ctx.fillRect(px + 3, hy + 4, 7, 5);
      ctx.fillStyle = C.skinDark;
      ctx.fillRect(px + 3, hy + 7, 3, 2);
      ctx.fillStyle = C.ink;
      if (pose.blink) ctx.fillRect(px + 7, hy + 6, 2, 1);
      else ctx.fillRect(px + 7, hy + 5 + pose.eye, 1, 2);
      if (pose.puffs) ctx.fillRect(px + 9, hy + 7, 2, 1);   // the mouth it comes out of
      ctx.fillStyle = pal.shirt;
      ctx.fillRect(px + 2, py + 9 + b, 8, 3 - b);
      if (pose.panic) {
        armsUp(ctx, px, py, pose.panic === 1 ? py + 4 : py + 7,
          pose.panic === 1 ? py + 7 : py + 4, pal, true);
      } else {
        ctx.fillStyle = C.skin;
        ctx.fillRect(px, py + 9 + b, 2, 3 - b);
        ctx.fillRect(px + 10 - pose.scratch, py + 9 + b + pose.scratch, 2, 3 - b);
      }
      ctx.fillStyle = pal.pants;
      ctx.fillRect(px + 3, py + 11, 6, 3);
      ctx.fillStyle = pal.pantsDark;
      ctx.fillRect(px + 3, py + 11, 6, 1);
      // The ears belong to the head, so they nod with it.
      if (s.type === 'leaf') ears(ctx, px, hy, 12);
      if (pose.sweat >= 0) sweatBead(ctx, px + 11, hy + 2 + pose.sweat);
      if (pose.burn) hairFire(ctx, px + 6, hy, pose.burn);
      if (pose.smoke) hairSmoke(ctx, px + 6, hy);
      for (const t of pose.puffs || []) {
        icicle(ctx, px + 10 + Math.floor(t / 2), hy + 6 + Math.floor(t / 6));
      }
      if (s.state === 'jump') {
        ctx.fillStyle = pal.pants;
        ctx.fillRect(px + 2, py + 14, 4, 2);
        ctx.fillRect(px + 7, py + 13, 4, 3);
      } else if (s.state === 'walk') {
        // 16 - 5: the sole lands on the last row of the box. At py+14 the whole
        // small body was 19px tall in a 16px box, so he walked and stood with
        // his boots three pixels down in the floor at every power level 0 —
        // idle as well as walking, since standing borrows the same cycle.
        legs(ctx, px, py + 11, 12, pal, WALK_ORDER[s.frame % WALK_FRAMES], s.running);
      } else {
        /* Standing still uses the walk cycle's closed-legs frame rather than a
         * pose of its own. The pose of its own was two 2x2 stubs of trouser
         * colour with no boots, against a walk cycle that is five pixels tall
         * and ends in a dark sole — so the legs appeared to vanish the moment
         * you stopped, on the small size where two pixels is the whole leg. */
        legs(ctx, px, py + 11, 12, pal, 1, false);
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

    if (s.state === 'climb') {
      climbPose(ctx, px, py, pal, s, false);
      if (s.type === 'leaf') ears(ctx, px + 1, py, 12);
      return;
    }

    const b = pose.breath;
    const hy = py + pose.nod;
    ctx.fillStyle = pal.cap;
    ctx.fillRect(px + 3, hy, 9, 4);
    ctx.fillRect(px + 2, hy + 4, 12, 2);
    if (pal.spots) capSpots(ctx, px + 3, hy, 9);
    ctx.fillStyle = C.skin;
    ctx.fillRect(px + 3, hy + 6, 9, 7);
    ctx.fillStyle = C.skinDark;
    ctx.fillRect(px + 3, hy + 11, 4, 2);
    ctx.fillStyle = C.ink;
    if (pose.blink) ctx.fillRect(px + 8, hy + 9, 3, 1);
    else ctx.fillRect(px + 8, hy + 7 + pose.eye, 2, 3);
    if (pose.puffs) ctx.fillRect(px + 10, hy + 11, 2, 1);   // the mouth it comes out of
    ctx.fillStyle = pal.shirt;
    ctx.fillRect(px + 2, py + 13 + b, 10, 5 - b);
    ctx.fillStyle = pal.shirtDark;
    ctx.fillRect(px + 2, py + 17, 10, 1);
    if (pose.panic) {
      armsUp(ctx, px, py, pose.panic === 1 ? py + 6 : py + 11,
        pose.panic === 1 ? py + 11 : py + 6, pal, false);
    } else {
      ctx.fillStyle = C.skin;
      ctx.fillRect(px - 1, py + 13 + b, 3, 5 - b);
      // The front arm reaches round the back during the scratch.
      ctx.fillRect(px + 12 - pose.scratch * 2, py + 13 + b + pose.scratch * 2, 3, 5 - b);
    }
    ctx.fillStyle = pal.pants;
    ctx.fillRect(px + 2, py + 18, 10, 4);
    ctx.fillStyle = pal.pantsDark;
    ctx.fillRect(px + 2, py + 18, 10, 1);
    ctx.fillStyle = C.gold;
    ctx.fillRect(px + 4, py + 19, 1, 1);
    ctx.fillRect(px + 9, py + 19, 1, 1);
    if (s.type === 'leaf') ears(ctx, px + 1, hy, 12);
    if (pose.sweat >= 0) sweatBead(ctx, px + 12, hy + 3 + pose.sweat);
    if (pose.burn) hairFire(ctx, px + 7, hy, pose.burn);
    if (pose.smoke) hairSmoke(ctx, px + 7, hy);
    for (const t of pose.puffs || []) {
      icicle(ctx, px + 13 + Math.floor(t / 2), hy + 10 + Math.floor(t / 6));
    }

    if (s.state === 'jump') {
      ctx.fillStyle = pal.pants;
      ctx.fillRect(px + 2, py + 22, 4, 3);
      ctx.fillRect(px + 8, py + 21, 5, 4);
      ctx.fillStyle = C.ink;
      ctx.fillRect(px + 1, py + 24, 5, 2);
    } else if (s.state === 'walk') {
      // 26 - 5, for the same reason, and it lines the walking sole up with the
      // standing one below — those were a pixel apart, so the feet twitched
      // down every time he started moving.
      legs(ctx, px, py + 21, 14, pal, WALK_ORDER[s.frame % WALK_FRAMES], s.running);
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

/*
 * A Z, four pixels square: two bars and a real diagonal between them.
 *
 * Three was tried first and three is not enough. At 3x3 the diagonal is the
 * middle pixel, which is also what an I is, and with the outline around it the
 * glyph came out as a white dumbbell that could have been anything. The fourth
 * row is what makes it a letter rather than a blob, and all three are drawn at
 * that one size — the far one used to double, and the frame it doubled on read
 * as a glitch rather than as distance.
 *
 * The diagonal is two pixels wide rather than one because a one-pixel diagonal
 * only touches itself at the corners, and the check that counts how many pieces
 * the drawing is in walks edges, not corners: the letter came apart into a top
 * half and a bottom half. It is the same rule the body obeys and there is no
 * reason a letter should be exempt from it.
 */
const Z_ROWS = [[0, 4], [2, 2], [1, 2], [0, 4]];

/**
 * Three Z's leaving a sleeping head, one behind the other, drifting up and
 * forward and doubling in size as they go.
 *
 * Not drawn by `drawPlayerBase`, and that is the point rather than an
 * accident — see `deepIdle`. It is not part of the body, so it does not go
 * through the body's scratch buffer, it does not grow with the power level and
 * it does not take the body's tint: a star can flash the man without recolouring
 * what he is dreaming. It does get the same outline as everything else, because
 * the outline is what makes a thing legible over scenery, and a symbol nobody
 * can read is worse than no symbol.
 *
 * Exactly three, always: they are phase-shifted thirds of one loop, so one pops
 * in at the head on the frame another pops out at the top and the count never
 * changes. A varying count is the sort of thing that looks like a dropped frame.
 */
function sleepZs(ctx, x, y, box, facing, d) {
  const dir = facing < 0 ? -1 : 1;
  const edge = facing < 0 ? x : x + box.w;
  ctx.fillStyle = C.white;
  for (let i = 0; i < 3; i++) {
    const t = ((d + i * 40) % 120) / 120;
    /* Fifteen pixels of climb and six of drift, and the fifteen is not a taste:
     * three Z's a third of a loop apart are five pixels apart on a fifteen
     * pixel run, which is one clear pixel between four-pixel letters. On a
     * shorter run they overlapped into a single ribbon, which is a smudge and
     * not a word. The drift stays small so the trail leans rather than walks. */
    const rise = Math.round(t * 15);
    const out = 2 + Math.round(t * 6);
    const gy = y - 2 - rise - 4;
    const gx = dir > 0 ? edge + out : edge - out - 4;
    for (let r = 0; r < 4; r++) {
      ctx.fillRect(gx + Z_ROWS[r][0], gy + r, Z_ROWS[r][1], 1);
    }
  }
}

/**
 * @param {object} s { type, level, facing, frame, state, ducking, running, wag, tint, glow }
 */
export function drawPlayer(ctx, x, y, s) {
  const level = Math.max(0, Math.min(5, s.level ?? 0));
  const box = (s.ducking ? PLAYER_DUCK_SIZES : PLAYER_SIZES)[level];
  if (s.glow) {
    // The halo is what carries across a busy screen; the tint alone is easy to
    // lose against bright scenery. Drawn by replaying the sprite, so it is the
    // character that glows and not a blob behind it.
    glowing(ctx, x + box.w / 2, y + box.h / 2, s.glow,
      (g) => drawPlayer(g, x, y, { ...s, glow: null }));
    return;
  }
  if (level === 0) {
    outlined(ctx, (g) => drawPlayerBase(recolored(g, s.tint), x, y, s, true));
  } else if (level === 1) {
    outlined(ctx, (g) => drawPlayerBase(recolored(g, s.tint), x, y, s, false));
  } else {
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

  const nap = deepIdle(s);
  if (nap && nap.kind === 'sleep') {
    outlined(ctx, (g) => sleepZs(g, x, y, box, s.facing, nap.d));
  }
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
