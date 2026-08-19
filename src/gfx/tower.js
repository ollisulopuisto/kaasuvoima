import { qMul, qNorm, qApply, qAxis } from '../core/quat.js';

/**
 * THE COIN CUBE: another world out there, slowly filling with your coins.
 *
 * Owner: *"instead of a tower do a rotating cube! Like it's a different cube
 * world in the distance and it's filling up with coins?!?!?!"* — and that is
 * the better idea by some distance, because it is already the game's own
 * language. This game's worlds are solids you turn over; a gauge that is also
 * a solid, turning, far away, says *another one of those* without a word.
 *
 * It began as a tower, on the same brief: keep the coin glass but put it in
 * the world, behind the hills, drifting so slowly that it is always in shot.
 * Everything about the placement survived the change — the deep parallax, the
 * hills sweeping across its feet, the red coins floating clear above it. Only
 * the object is different, and it is different in the direction the rest of
 * the game was already going.
 *
 * ## The liquid is the trick
 *
 * The gold is drawn as a **level**, not as a fill of each face: one horizontal
 * line in screen space, the same for every face, with the cube's whole
 * silhouette as the clip. So the surface stays flat while the cube turns
 * under it, which is what a liquid in a rotating glass does and what nothing
 * else in this picture does. It is also why the reading survives the rotation
 * — the height of the line is the number of coins, and the turning cannot
 * change a horizontal.
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

const VERTS = [];
for (let i = 0; i < 8; i++) VERTS.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]);
/** The six faces, as vertex indices wound the same way round. */
const FACES = [
  [0, 2, 6, 4], [1, 5, 7, 3],
  [0, 4, 5, 1], [2, 3, 7, 6],
  [0, 1, 3, 2], [4, 6, 7, 5],
];

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
  sky = [150, 190, 240], r = CUBE_R, phase = 0, rising = 1 } = {}) {
  const q = spin(phase);
  const pts = VERTS.map((v) => {
    const p = qApply(q, v);
    const s = CAM_Z / (CAM_Z - p[2]);
    return { x: x + p[0] * r * s, y: y - p[1] * r * s, z: p[2] };
  });

  const seen = FACES.map((f) => ({
    f,
    depth: f.reduce((t, i) => t + pts[i].z, 0) / 4,
  })).filter((d) => d.depth > -0.05).sort((a, b) => a.depth - b.depth);

  const path = (f) => {
    ctx.beginPath();
    ctx.moveTo(pts[f[0]].x, pts[f[0]].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[f[i]].x, pts[f[i]].y);
    ctx.closePath();
  };

  ctx.lineJoin = 'round';
  for (const d of seen) {
    const step = d.depth > 0.35 ? 0 : d.depth > -0.02 ? 1 : 2;
    path(d.f);
    ctx.fillStyle = faded(shade('#3a4a6e', TONES[step]), haze, sky);
    ctx.fill();
    ctx.strokeStyle = faded('#20263a', haze * 0.8, sky);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /*
   * THE LEVEL, drawn once for the whole solid rather than per face.
   *
   * Clipped to every visible face at once and filled below one horizontal
   * line, so the surface stays flat while the cube turns beneath it. Hazed
   * far less than the shell: atmospheric perspective washes out what reflects
   * the light and barely touches what carries it, and a gold that receded as
   * hard as the walls came out grey-green against the sky and stopped being
   * readable at all.
   */
  const top = y - r * 1.35;
  const bottom = y + r * 1.35;
  const lineY = Math.round(bottom - (bottom - top) * Math.max(0, Math.min(1, fill / 100)));
  if (fill > 0) {
    ctx.save();
    ctx.beginPath();
    for (const d of seen) {
      ctx.moveTo(pts[d.f[0]].x, pts[d.f[0]].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[d.f[i]].x, pts[d.f[i]].y);
      ctx.closePath();
    }
    ctx.clip();
    ctx.fillStyle = faded('#f0b000', haze * 0.3, sky);
    ctx.fillRect(x - r * 2, lineY, r * 4, bottom - lineY + 2);
    /* Every tenth coin a brighter line, the measure-tape trick the corner
     * glass used: the surface says "past halfway" at a glance and the marks
     * give the exact number to anybody who wants to count. */
    for (let n = 10; n < 100; n += 10) {
      const ly = Math.round(bottom - (bottom - top) * (n / 100));
      if (ly < lineY) break;
      ctx.fillStyle = faded('#c88800', haze * 0.3, sky);
      ctx.fillRect(x - r * 2, ly, r * 4, 1);
    }
    ctx.fillStyle = faded('#ffe070', haze * 0.25, sky);
    ctx.fillRect(x - r * 2, lineY, r * 4, 1);
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
  for (let i = 0; i < Math.min(lives, 6); i++) {
    const bob = Math.round(Math.sin(phase / 26 + i * 1.1) * 2);
    const home = top - 8 - i * (RED_H + 2) + bob;
    const newest = i === Math.min(lives, 6) - 1 && climb < 1;
    /* Out of the middle of the cube, not off its lid: it was in there. */
    const cy = Math.round(newest ? y + (home - y) * eased : home);
    if (newest) ctx.globalAlpha = Math.min(1, eased * 2.2);
    ctx.fillStyle = faded('#5c0c0c', haze * 0.3, sky);
    ctx.fillRect(Math.round(x - 6), cy, 12, RED_H);
    ctx.fillStyle = faded('#d83030', haze * 0.3, sky);
    ctx.fillRect(Math.round(x - 6), cy, 11, RED_H - 1);
    ctx.fillStyle = faded('#ff6060', haze * 0.3, sky);
    ctx.fillRect(Math.round(x - 5), cy + 1, 8, 1);
    ctx.globalAlpha = 1;
  }
}
