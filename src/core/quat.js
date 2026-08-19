/**
 * QUATERNIONS, and why this game turns things with them.
 *
 * A solid in this game is always turned **from one face to another**: there is
 * a shortest way between two orientations and slerp finds it without anybody
 * choosing axes by hand. The same job in Euler angles is three numbers of
 * which two are wrong exactly at the pole.
 *
 * Extracted from `die.js` when the globe needed the same maths. Two copies of
 * a rotation are two rotations that can disagree, which is the plainest case
 * of the rule in DESIGN.md item 8 there is.
 */
import { clamp } from './utils.js';
/* Kierto kvaternioina eikä kulmina, koska kappale käännetään **tahkosta
 * toiseen**: kahden asennon välillä on aina lyhin tie, ja slerp löytää sen
 * ilman että kukaan valitsee akseleita käsin. Eulerin kulmilla sama käännös
 * olisi kolme lukua joista kaksi on väärin juuri navan kohdalla. */
export const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const qNorm = (q) => {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
};
export function qBetween(from, to) {
  const d = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];
  if (d > 0.99999) return [0, 0, 0, 1];
  if (d < -0.99999) {
    /* Vastakkaiset normaalit: akseli on mikä tahansa kohtisuora, ja tämä on
     * se tapaus joka unohtuu — kaksi tahkoa ovat vastakkaiset kolmesti. */
    let ax = [1, 0, 0];
    if (Math.abs(from[0]) > 0.9) ax = [0, 1, 0];
    const c = [
      from[1] * ax[2] - from[2] * ax[1],
      from[2] * ax[0] - from[0] * ax[2],
      from[0] * ax[1] - from[1] * ax[0],
    ];
    const n = Math.hypot(...c) || 1;
    return [c[0] / n, c[1] / n, c[2] / n, 0];
  }
  const c = [
    from[1] * to[2] - from[2] * to[1],
    from[2] * to[0] - from[0] * to[2],
    from[0] * to[1] - from[1] * to[0],
  ];
  return qNorm([c[0], c[1], c[2], 1 + d]);
}
export function qSlerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let e = b;
  if (d < 0) { e = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
  if (d > 0.9995) {
    return qNorm([a[0] + (e[0] - a[0]) * t, a[1] + (e[1] - a[1]) * t,
      a[2] + (e[2] - a[2]) * t, a[3] + (e[3] - a[3]) * t]);
  }
  const th = Math.acos(clamp(d, -1, 1));
  const s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s;
  const wb = Math.sin(t * th) / s;
  return [a[0] * wa + e[0] * wb, a[1] * wa + e[1] * wb,
    a[2] * wa + e[2] * wb, a[3] * wa + e[3] * wb];
}
export function qApply(q, v) {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}

/** A rotation of `angle` about a unit `axis`. */
export function qAxis(axis, angle) {
  const h = angle / 2;
  const s = Math.sin(h);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)];
}
