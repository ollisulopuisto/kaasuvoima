import { qMul, qNorm, qApply, qAxis } from '../core/quat.js';
import { FACES } from '../data/solid.js';

/**
 * THE COIN CUBE: another world out there, slowly filling with your coins.
 *
 * Owner: *"instead of a tower do a rotating cube! Like it's a different cube
 * world in the distance and it's filling up with coins?!?!?!"* — and that is
 * the better idea by some distance, because it is already the game's own
 * language. This game's worlds are solids you turn over; a gauge that is also
 * a solid, turning, far away, says *another one of those* without a word.
 *
 * ## It is the SAME solid the map is
 *
 * Owner: *"why isn't the cube an eight-sided object like the world map? Make
 * it have the colors of the current slate the player is on."*
 *
 * Both halves finish the sentence this file already opened with. It said the
 * gauge should say *another one of those* — and then drew a cube, which is
 * another of nothing. Now it imports `FACES` straight out of `src/data/solid.js`
 * and is a truncated octahedron: the identical eight hexagons and six squares
 * you walk on the map, one object defined once. A world you have not reached
 * yet, hanging there filling up with what you find.
 *
 * And it wears the level's own ground. The shell takes `groundTop` from the
 * current theme, so on a meadow it is meadow-green and in the dunes it is
 * sand — the same colour as the slate under your feet, which is what makes it
 * read as somewhere you could stand rather than as an instrument.
 *
 * It began as a tower, on the same brief: keep the coin glass but put it in
 * the world, behind the hills, drifting so slowly that it is always in shot.
 * Everything about the placement survived the change — the deep parallax, the
 * hills sweeping across its feet, the red coins floating clear above it. Only
 * the object is different, and it is different in the direction the rest of
 * the game was already going.
 *
 * ## A hundred blocks, one per coin
 *
 * It filled as a liquid first — one horizontal line in screen space with the
 * whole silhouette as the clip — and the owner named the fault before the
 * second look: *"it feels like there's a 2D texture that's been applied to a
 * 3D object."* Measured, the complaint is one number: the gold showed
 * **exactly one tone on every row of every fill level**, because a single
 * flat colour crossed three differently-lit faces without ever changing at an
 * edge. Nothing marked a face boundary, so the eye read a sticker over a
 * shape rather than a substance inside one.
 *
 * So the coins are a **lattice**: 5 by 5 by 4, which is a hundred cells for a
 * hundred coins, one block each. Each block is shaded by its own depth, so
 * the gold now carries the same three tones the shell does and the pile turns
 * with the box instead of sliding across it.
 *
 * One block per coin also makes the gauge countable, and a layer is exactly
 * twenty — so the tape marks the liquid needed are gone. The structure is the
 * scale.
 *
 * ## Why it reads as far away
 *
 * Three signals, all of them: small, hazed toward the sky it hangs in, and
 * drawn between the far ridge and the middle one so the nearer hills pass in
 * front of it. Smaller and paler are guesses the eye can argue with; something
 * passing in front of something else is not.
 */

/** Screen radius of the cube at its usual distance, and the eye's distance. */
/*
 * 16 and not 26. At 26 the cube came out ninety pixels across — a third of the
 * screen — and a thing that size is not in the distance however pale you paint
 * it. Size is the one distance cue the eye will not argue with, so it has to
 * be right before the other two are worth anything.
 */
export const CUBE_R = 16;
const CAM_Z = 5.2;

/** How tall one banked red coin is, floating above. */
const RED_H = 4;

/** Three quantised tones, the same rule the die and the globe are drawn by. */
const TONES = [1, 0.72, 0.5];

/**
 * The coin lattice: 5 by 5 by 4 is a hundred cells for a hundred coins, so a
 * block is a coin and a layer is exactly twenty of them.
 */
const NX = 5, NY = 5, NZ = 4;
const CELLS = NX * NY * NZ;

/** The solid's own circumradius is sqrt(5); this brings it to `r` on screen. */
const SCALE = 1 / Math.sqrt(5);

/**
 * How far out the coin lattice reaches, as a fraction of the circumradius.
 *
 * The solid's insphere is only 0.775 of its circumradius, so a box that fits
 * entirely inside is small enough to rattle. This one is deliberately larger:
 * its corners poke through the hexagons and the silhouette clip cuts them off,
 * which is what a container filled to the brim actually looks like.
 */
const PILE = 0.72;

function faded(hex, k, sky) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return `rgb(${c.map((v, i) => Math.round(v + (sky[i] - v) * k)).join(',')})`;
}

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => Math.round(v * k).toString(16).padStart(2, '0')).join('')}`;
};

/**
 * THE BRIGHTEST THE SHELL MAY BE, and it is a measurement rather than a taste.
 *
 * Wearing the level's colours is the point, but the coins have to survive it.
 * The surface tile (`groundTop`) was the first try and it fails on the bright
 * half of the game: desert's sand is `#f0c060` against a gold of `#f0b000`,
 * and ice, bone and cloud are brighter still — a gold shape on a gold shape,
 * the same failure the spikes had on ice. An object drawn correctly and
 * invisible anyway.
 *
 * Darkening those was the second try and it fails differently: scaling a
 * near-white leaves GREY, so ice and cloud kept their luminance rule and lost
 * the very thing the colour was for. There is no hue in white to preserve.
 *
 * So the shell is the theme's HILL colour, which is what the thing is floating
 * among anyway, and which carries real hue in every theme — ice stays blue,
 * bone stays violet, desert stays tan. Only the two brightest need capping at
 * all, and capping a hued colour keeps the hue.
 */
const SHELL_LUMA = 122;
const GOLD = '#f0b000';

export const luma = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};

/** The level's ground colour, darkened just enough that gold reads on it. */
export function shellOf(tint) {
  const l = luma(tint);
  return l <= SHELL_LUMA ? tint : shade(tint, SHELL_LUMA / l);
}

/** The gold the coins are drawn in, so the gate can compare the two. */
export const COIN_GOLD = GOLD;

/**
 * A red coin coming apart, `t` running 0 to 1.
 *
 * Ten fragments on fixed angles, thrown out along a square root so they leave
 * fast and coast — the opposite of the eased arcs everywhere else in this
 * file, because everything else here is *carried* and this is the one thing
 * that is *released*. They sag as they go: a little gravity is what separates
 * an explosion from a starburst.
 *
 * The colour runs the way a spark actually cools, pale to red to dark, so the
 * fragments read as ONE thing losing its heat rather than ten things being
 * drawn. And they are drawn full size at the start and small at the end, so
 * the first frame still looks like a coin — the explosion has to be a coin
 * exploding, not a puff appearing where a coin was.
 */
function bang(ctx, o, t, haze, sky) {
  const reach = Math.sqrt(t) * 26;
  const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
  /* The flash: two frames of white where the coin was, which is what makes
   * the eye look up in the first place. Everything after it is aftermath. */
  if (t < 0.2) {
    const k = 1 - t / 0.2;
    const rad = Math.round(4 + (1 - k) * 16);
    ctx.globalAlpha = k * 0.85;
    ctx.fillStyle = '#fff0c0';
    ctx.fillRect(Math.round(o.x - rad), Math.round(o.y - 1), rad * 2, 3);
    ctx.fillRect(Math.round(o.x - 1), Math.round(o.y - rad), 3, rad * 2);
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = fade;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.31;
    /* alternating throw distances, or ten fragments on a circle read as a
     * ring rather than as debris */
    const far = reach * (k % 2 ? 1 : 0.62);
    const fx = o.x + Math.cos(a) * far;
    const fy = o.y + Math.sin(a) * far * 0.8 + t * t * 11;
    const size = Math.max(1, Math.round(3.4 - t * 2.6));
    ctx.fillStyle = faded(t < 0.25 ? '#ffd0a0' : t < 0.6 ? '#ff6060' : '#a01c1c',
      haze * 0.3, sky);
    ctx.fillRect(Math.round(fx - size / 2), Math.round(fy - size / 2), size, size);
  }
  ctx.globalAlpha = 1;
}

/**
 * The cube's orientation at `phase` frames.
 *
 * Turning about a tilted axis rather than a straight one, so the same three
 * faces do not come round forever: a cube spun about its own vertical shows
 * two faces and a silhouette that never changes, which is a hexagon with a
 * seam in it and not a solid at all.
 */
function spin(phase) {
  const a = qAxis([0.42, 1, 0.18], phase * 0.0042);
  return qNorm(qMul(a, qAxis([1, 0, 0], 0.5)));
}

/**
 * Draws the cube with its centre at `x, y`.
 *
 * `fill` is coins out of a hundred and `lives` the red coins floating above,
 * which are the two numbers the corner glass used to read. `haze` is 0 for
 * something you are standing next to and about 0.42 for something on the
 * horizon.
 */
export function drawTower(ctx, x, y, { fill = 0, lives = 0, haze = 0.42,
  sky = [150, 190, 240], r = CUBE_R, phase = 0, rising = 1, burst = 0,
  tint = '#3a4a6e' } = {}) {
  const shell = shellOf(tint);
  const q = spin(phase);
  const at = (v) => {
    const p = qApply(q, [v[0] * SCALE, v[1] * SCALE, v[2] * SCALE]);
    const s = CAM_Z / (CAM_Z - p[2]);
    return { x: x + p[0] * r * s, y: y - p[1] * r * s, z: p[2] };
  };

  /* Faces carry 6 or 4 corners now, so nothing may assume four. */
  const seen = FACES.map((face) => {
    const poly = face.verts.map(at);
    return { poly, depth: poly.reduce((t, p) => t + p.z, 0) / poly.length };
  }).filter((d) => d.depth > -0.05).sort((a, b) => a.depth - b.depth);

  const path = (poly) => {
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
  };

  ctx.lineJoin = 'round';
  for (const d of seen) {
    /* Fourteen faces on a sixteen-pixel solid, and still only THREE tones.
     * More would be more accurate and less legible: the whole game quantises
     * its shading to three steps, and a face that is nearly the tone of its
     * neighbour reads as a smudge rather than as an edge. */
    const step = d.depth > 0.35 ? 0 : d.depth > -0.02 ? 1 : 2;
    d.step = step;
    path(d.poly);
    ctx.fillStyle = faded(shade(shell, TONES[step]), haze, sky);
    ctx.fill();
    ctx.strokeStyle = faded(shade(shell, 0.34), haze * 0.8, sky);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /*
   * THE PILE.
   *
   * Cells are filled bottom layer first, and scrambled within a layer by a
   * stride coprime with its size — otherwise a layer grows as a row at a time
   * and the pile reads as stripes appearing rather than as coins landing.
   *
   * Painted back to front and clipped to the silhouette, because a block near
   * the near-bottom corner projects a little outside the outline and a coin
   * hanging off the edge of the box is the one thing that would break the
   * illusion completely.
   */
  const coins = Math.max(0, Math.min(CELLS, Math.round(fill)));
  if (coins > 0) {
    /* Derived from the lattice spacing rather than from `r`, because the pile
     * no longer fills the whole radius: a block sized against `r` overlapped
     * its neighbours and the pile tiled into one gold sheet. 0.82 of the gap
     * leaves the seam that makes them read as separate coins. */
    const w = Math.max(2, Math.round((2 / NX) * PILE * r * 0.82));
    const blocks = [];
    for (let iy = 0; iy < NY; iy++) {
      for (let k = 0; k < NX * NZ; k++) {
        /* 7 and NX*NZ share no factor, so this visits every cell of the layer */
        const cell = (k * 7) % (NX * NZ);
        if (iy * NX * NZ + k >= coins) break;
        const p = qApply(q, [
          (((cell % NX) + 0.5) / NX * 2 - 1) * PILE,
          ((iy + 0.5) / NY * 2 - 1) * PILE,
          ((Math.floor(cell / NX) + 0.5) / NZ * 2 - 1) * PILE,
        ]);
        const s2 = CAM_Z / (CAM_Z - p[2]);
        blocks.push({ x: x + p[0] * r * s2, y: y - p[1] * r * s2, z: p[2] });
      }
    }
    blocks.sort((a, b) => a.z - b.z);

    ctx.save();
    ctx.beginPath();
    for (const d of seen) {
      ctx.moveTo(d.poly[0].x, d.poly[0].y);
      for (let i = 1; i < d.poly.length; i++) ctx.lineTo(d.poly[i].x, d.poly[i].y);
      ctx.closePath();
    }
    ctx.clip();
    /*
     * The six colours are built ONCE, not once per block.
     *
     * There are only three depth steps and two tones each, but `faded` parses
     * a hex string, maps three channels and joins them, so doing it inside the
     * loop is two hundred string allocations every frame for six distinct
     * answers. Measured, that alone pushed the whole effect pass past its
     * frame budget — the drawing was never the cost, the arithmetic about the
     * drawing was.
     *
     * Hazed far less than the shell: atmospheric perspective washes out what
     * reflects the light and barely touches what carries it, and a gold that
     * receded as hard as the walls came out grey-green against the sky and
     * stopped being readable at all.
     */
    const face = TONES.map((t) => faded(shade(GOLD, t), haze * 0.3, sky));
    const foot = TONES.map((t) => faded(shade(GOLD, t * 0.6), haze * 0.3, sky));
    for (const b of blocks) {
      const step = b.z > 0.35 ? 0 : b.z > -0.02 ? 1 : 2;
      const bx = Math.round(b.x - w / 2);
      const by = Math.round(b.y - w / 2);
      ctx.fillStyle = face[step];
      ctx.fillRect(bx, by, w, w);
      /* one dark row along the foot: without it the blocks tile into a sheet */
      ctx.fillStyle = foot[step];
      ctx.fillRect(bx, by + w - 1, w, 1);
    }
    ctx.restore();
  }

  /*
   * THE RED COINS FLOAT ABOVE IT.
   *
   * Owner: *"if the red coins are hidden occasionally, we could lift them up
   * high. Maybe they become something that bobbles up?"* — and the reason is
   * occlusion. The hills sweep across the bottom of this thing, which is the
   * whole point of where it hangs, but a life is the one reading you cannot
   * afford to lose to a passing treeline. Above the solid is the only part of
   * the picture nothing ever passes in front of.
   *
   * They bob, each on its own phase, because a life is the only number here
   * that can be taken away, and a number that moves is one you keep half an
   * eye on.
   */
  /*
   * THE NEWEST RED CLIMBS OUT OF THE CUBE.
   *
   * Owner: *"rethink the yellow/red cohabitation… yellow coins running out in
   * the current/old version feels good, I don't wanna lose that affordance."*
   *
   * The draining was never in danger — the level falls whether the glass is a
   * corner or a cube. What the corner glass had and this did not is the
   * **conversion**: sixty-four yellows turning into one red *in the same
   * column*, so you watched the substance change rather than watching one
   * number fall and another appear somewhere else.
   *
   * So the conversion is an ascent. `rising` runs 0 to 1 over the flush: the
   * gold drains out of the cube and the new red rises out of the top of it to
   * take its place in the stack. It is the old event with its two halves
   * further apart, which is what putting the gauge in the sky cost — and
   * paying it back this way makes the moment bigger than it was, because now
   * the coins visibly *go somewhere*.
   */
  const climb = Math.max(0, Math.min(1, rising));
  const eased = climb < 0.5 ? 2 * climb * climb : 1 - ((-2 * climb + 2) ** 2) / 2;

  /*
   * The ring's centre sits a clear margin above the cube's top vertex, and it
   * is tilted rather than face-on. That is the whole design: at this tilt the
   * far half of the orbit rides ABOVE the solid instead of behind it, so no
   * coin is ever occluded by the cube at any point in the revolution — while
   * the near half still dips forward far enough to read as an orbit and not a
   * row. Owner asked whether they could circle it; they can, as long as the
   * circle never puts one behind anything.
   */
  const top = y - r * 1.35;
  /*
   * The clearance is not a guess. A vertex of a cube of radius r reaches
   * 1.73 r above centre when it points straight up, so the ring's centre has
   * to clear THAT and not the flat `top` used for layout — and the near half
   * of the orbit dips by RING_R * TILT below the centre, which has to come
   * out of the same budget. Measured through a whole revolution with the
   * gold switched off, 16 px of lift left the lowest red 2 px BELOW the
   * highest shell pixel — nearly right is not right, so 22.
   */
  const RING_Y = top - 22;
  const RING_R = r * 1.3;
  const TILT = 0.3;
  const n = Math.min(lives, 6);
  const orbit = [];
  for (let i = 0; i < n; i++) {
    /* evenly spaced round the ring, so a gained life slots in rather than
     * piling on the end: the spacing itself says how many there are */
    const a = phase * 0.021 + (i / Math.max(1, n)) * Math.PI * 2;
    const oz = Math.sin(a);
    const s2 = CAM_Z / (CAM_Z - oz * 0.7);
    orbit.push({
      i,
      x: x + Math.cos(a) * RING_R * s2,
      y: RING_Y + oz * RING_R * TILT * s2 + Math.sin(phase / 26 + i * 1.1) * 1.5,
      z: oz,
      s: s2,
    });
  }
  orbit.sort((a, b) => a.z - b.z);

  const blast = Math.max(0, Math.min(1, burst));
  for (const o of orbit) {
    /*
     * ONE OF THEM VISIBLY EXPLODES. Owner: *"when the player dies, have one
     * of the rotating red coins VISIBLY explode!"*
     *
     * The last one on the ring, and it is the right one without any
     * bookkeeping: a life is not deducted until the level hands its result
     * back, so through the whole death animation the stock on screen still
     * INCLUDES the coin that is about to be lost. The one that dies is
     * therefore simply the last one drawn, and when the blast finishes and it
     * stops being drawn, the number the game keeps has caught up with the
     * number the sky is showing.
     *
     * It happens up there rather than over the body on purpose. Every other
     * thing that marks a death is at the player — the sound, the flip, the
     * fall — and one more of those is a louder death, not a clearer one.
     * A life is spent from the stock, so the stock is where it has to be seen
     * leaving, and the eye is dragged up to the number that just changed.
     */
    if (blast > 0 && o.i === n - 1) {
      if (blast >= 1) continue;                       // spent: gone from the ring
      bang(ctx, o, blast, haze, sky);
      continue;
    }
    const newest = o.i === n - 1 && climb < 1;
    /* Out of the middle of the cube, not off its lid: it was in there. */
    const cy = Math.round(newest ? y + (o.y - y) * eased : o.y);
    const cx = Math.round(newest ? x + (o.x - x) * eased : o.x);
    /* smaller at the back, which is the depth cue the row above never had */
    const w = Math.max(7, Math.round(12 * o.s * 0.92));
    const h = Math.max(3, Math.round(RED_H * o.s * 0.92));
    if (newest) ctx.globalAlpha = Math.min(1, eased * 2.2);
    ctx.fillStyle = faded('#5c0c0c', haze * 0.3, sky);
    ctx.fillRect(Math.round(cx - w / 2), cy, w, h);
    ctx.fillStyle = faded('#d83030', haze * 0.3, sky);
    ctx.fillRect(Math.round(cx - w / 2), cy, w - 1, h - 1);
    ctx.fillStyle = faded('#ff6060', haze * 0.3, sky);
    ctx.fillRect(Math.round(cx - w / 2) + 1, cy + 1, Math.max(1, w - 4), 1);
    ctx.globalAlpha = 1;
  }
}
