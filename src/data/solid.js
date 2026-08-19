/**
 * THE POINTY SPHERE: a truncated octahedron, and why it is the right one.
 *
 * Owner: *"what if they're hex shaped? So they have six edges… this gives room
 * for more connections, and not every side has to be connected. And each side
 * that you can enter has a path leading to it. If you walk down that path, we
 * animate and rotate to the next hex when we cross over."*
 *
 * The solid that does this is **the die with its corners cut off**. Truncate
 * the octahedron and every triangular face opens into a hexagon, which is the
 * whole trick: nothing already decided has to change. The eight hexagons *are*
 * the eight faces the game already has, with the same indices and the same
 * neighbours — face `i` still borders `i^1`, `i^2` and `i^4`, which is
 * `worldDoors` in `worlds.js`, unchanged and now verified against the
 * geometry rather than asserted next to it.
 *
 * What truncation buys is the other three edges. A hexagon's six sides
 * **alternate**: three lead to hexagons and three to the squares that the cut
 * corners left behind. So the old three-way adjacency is still the level
 * chain, and the three new sides are doors into rooms — and a square touches
 * four hexagons, so a room is a place four levels share rather than a node
 * hanging off one of them.
 *
 * ## The coordinates
 *
 * Every vertex is a permutation of `(0, ±1, ±2)`; there are 24 of them. A
 * hexagon is the six vertices satisfying `v · s = 3` for a sign triple `s`,
 * and its index is that triple read as bits — the same encoding `die.js` uses
 * for the octahedron's faces, because it is the same face. A square is the
 * four vertices with `±2` on one axis.
 *
 * Nothing here is hand-tabulated. The adjacency, the winding and the edge
 * midpoints are all derived from those 24 points, so there is no table that
 * can drift away from the shape it describes.
 */

/** All permutations of (0, ±1, ±2): the 24 corners. */
function corners() {
  const out = new Map();
  for (let zero = 0; zero < 3; zero++) {
    const rest = [0, 1, 2].filter((i) => i !== zero);
    for (const a of [1, -1]) {
      for (const b of [2, -2]) {
        for (const swap of [false, true]) {
          const v = [0, 0, 0];
          v[zero] = 0;
          v[rest[0]] = swap ? b : a;
          v[rest[1]] = swap ? a : b;
          out.set(v.join(','), v);
        }
      }
    }
  }
  return [...out.values()];
}

const VERTS = corners();

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => {
  const n = Math.hypot(...a) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** The sign triple of hexagon `i`, bit 0 = x, bit 1 = y, bit 2 = z. */
export const hexSigns = (i) => [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1];

/**
 * Sorts a face's vertices into a ring, counter-clockwise seen from outside.
 *
 * Winding is not decoration here: the road on a face is authored against the
 * ring, so "the next edge round" has to mean the same thing on every face or
 * a junction laid out on one would come out mirrored on its neighbour.
 */
function ring(vs, normal) {
  const centre = mul(vs.reduce(add, [0, 0, 0]), 1 / vs.length);
  const u = norm(sub(vs[0], centre));
  const v = cross(normal, u);
  return [...vs].sort((a, b) => {
    const pa = sub(a, centre);
    const pb = sub(b, centre);
    return Math.atan2(dot(pa, v), dot(pa, u)) - Math.atan2(dot(pb, v), dot(pb, u));
  });
}

function faceOf(kind, index, normal, vs) {
  const verts = ring(vs, normal);
  const centre = mul(verts.reduce(add, [0, 0, 0]), 1 / verts.length);
  /* The face's own two axes. `u` points at the first vertex of the ring and
   * `v` is a right angle from it, so a face-local (u, v) is stable for as long
   * as the ring is — which is what lets a road be authored in 2D. */
  const u = norm(sub(verts[0], centre));
  const v = cross(normal, u);
  return { kind, index, normal, centre, verts, u, v, radius: Math.hypot(...sub(verts[0], centre)) };
}

const HEXES = [];
for (let i = 0; i < 8; i++) {
  const s = hexSigns(i);
  const n = norm(s);
  HEXES.push(faceOf('hex', i, n, VERTS.filter((p) => dot(p, s) === 3)));
}

const SQUARES = [];
for (let axis = 0; axis < 3; axis++) {
  for (const sign of [1, -1]) {
    const n = [0, 0, 0];
    n[axis] = sign;
    SQUARES.push(faceOf('square', SQUARES.length, n, VERTS.filter((p) => p[axis] === sign * 2)));
  }
}

/** Every face, hexagons first so a hexagon's index is its world/level index. */
export const FACES = [...HEXES, ...SQUARES];
export const HEX_COUNT = HEXES.length;

const keyOf = (v) => v.join(',');

/**
 * The six sides of hexagon `i`, in ring order.
 *
 * Each carries the face on the other side of it, the two corners it runs
 * between, and its midpoint — which is where a road arrives, and the axis the
 * solid turns about when you walk over it.
 */
function sidesOf(face) {
  const out = [];
  for (let k = 0; k < face.verts.length; k++) {
    const a = face.verts[k];
    const b = face.verts[(k + 1) % face.verts.length];
    const pair = new Set([keyOf(a), keyOf(b)]);
    const other = FACES.find((f) => f !== face
      && f.verts.filter((p) => pair.has(keyOf(p))).length === 2);
    out.push({
      k,
      a,
      b,
      mid: mul(add(a, b), 0.5),
      to: other ? { kind: other.kind, index: other.index } : null,
    });
  }
  return out;
}

for (const f of FACES) f.sides = sidesOf(f);

/** Hexagon `i`'s six sides. Three lead to hexagons, three to squares. */
export const sidesOfHex = (i) => HEXES[i].sides;

/** The three hexagons bordering hexagon `i`. Identical to `worldDoors`. */
export const hexDoors = (i) => HEXES[i].sides
  .filter((s) => s.to && s.to.kind === 'hex').map((s) => s.to.index);

/**
 * THE GRAY-CODE WALK: the order the faces are visited in.
 *
 * Consecutive entries differ by exactly one bit, so consecutive faces share an
 * edge — which makes this a Hamiltonian path over all eight, and therefore the
 * natural order to lay a world's levels out in: level `k` sits on face
 * `STRIP[k]`, and level `k + 1` is one edge away.
 *
 * The cube has 12 edges and the path uses 7, so **five are left over**. Those
 * are the spare doors: each of the six faces in the middle of the path has
 * exactly one, and the two at the ends have two. That is where a room, a
 * secret or the way out of the world goes, and it is a count that falls out of
 * the shape rather than one anybody chose.
 */
export const STRIP = [0, 1, 3, 2, 6, 7, 5, 4];

/**
 * A face-local point in 3D. `u` and `v` are in units of the face's own radius,
 * so (0,0) is the middle of the face and anything with `hypot(u,v) <= 1` is on
 * it. This is the whole interface the road layout needs.
 */
export function onFace(face, u, v) {
  return add(face.centre, add(mul(face.u, u * face.radius), mul(face.v, v * face.radius)));
}

/** Where side `k`'s midpoint falls in face-local units. */
export function sideAt(face, k) {
  const p = sub(face.sides[k].mid, face.centre);
  return { u: dot(p, face.u) / face.radius, v: dot(p, face.v) / face.radius };
}
