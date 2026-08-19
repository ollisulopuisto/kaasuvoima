import { drawText } from '../gfx/font.js';
import { Music, Sfx } from '../core/audio.js';
import { WORLDS, pipsFor } from '../data/worlds.js';
import { DIFFICULTY } from '../data/difficulty.js';
import { TIER_COLORS } from './worldmap.js';
import { clamp } from '../core/utils.js';
import { qMul, qNorm, qSlerp, qApply, qAxis, qBetween } from '../core/quat.js';
import { drawPlayer } from '../gfx/sprites.js';
import { normalizePower } from '../entities/player.js';
import { FACES, HEX_COUNT, onFace, sideAt } from '../data/solid.js';

/**
 * THE POINTY SPHERE YOU WALK ON.
 *
 * Owner: *"it's like a pointy sphere that the player traverses, where one side
 * takes you back to the previous level, one to the next level, and one to the
 * next world… each side that you can enter has a path leading to it. And if
 * you walk down that path, we animate and rotate to the next hex when we cross
 * over."*
 *
 * So: a truncated octahedron (`data/solid.js`), one hexagon per level, roads
 * on the face you are standing on, and **the solid rolls over its own edge**
 * when you walk off one. The roll is the transition — there is no map screen
 * and no menu behind it, because the thing you were reading and the thing that
 * moves are the same object.
 *
 * ## Four spokes, and no arrow ever means two things
 *
 * A hexagon has six sides, and there are four arrow keys. The owner's answer
 * was *"no junction ever needs more than four roads"*, and the geometry hands
 * that over without any junction-splitting at all: three of a hexagon's sides
 * lead to hexagons and three to squares, so opening all three level doors plus
 * one room door is exactly four spokes.
 *
 * They are not bound to fixed keys either. A pressed arrow picks the spoke
 * whose direction **on the screen right now** matches it best, which is the
 * only thing that can be right on a solid that has just rolled: the same road
 * points somewhere else after every turn, and a key that meant "north-east on
 * face three" would be a lie one roll later.
 *
 * ## The roll is a real roll
 *
 * Not a slerp to the next orientation — a rotation about the shared edge
 * itself, which is what a solid on a table does. The axis is the edge, the
 * angle is the one that brings the neighbour's normal to where this face's
 * normal was, and the pawn rides the face down. That it is also the cheapest
 * of the options is a coincidence worth taking.
 */

const VIEW_W = 320;
const VIEW_H = 240;

/** Screen radius of the solid, and how far away the eye is. */
const R = 62;
const CAM_Z = 4.6;
const CX = 160;
const CY = 100;

/**
 * THE ANGLE THE SOLID IS SEEN FROM, and the reason it is not face-on.
 *
 * Turning the face you are standing on dead towards the camera is the
 * obvious thing and it is the one angle at which this shape cannot prove it
 * is a shape: the neighbours fall exactly on the silhouette and read as a rim,
 * so a truncated octahedron becomes a coin with a decorated lid. The die had
 * the same problem for the same reason and the same fix — tip it in **both**
 * directions and three faces come into view around a shared corner.
 *
 * Tipped away rather than towards, so the roads on the face you are reading
 * foreshorten as little as possible while the solid behind them still has a
 * back. Half a radian is as far as that trade goes.
 */
const TILT = 0.46;
const YAW = 0.38;
const tilted = (q) => qNorm(qMul(
  qAxis([0, 1, 0], YAW), qMul(qAxis([1, 0, 0], TILT), q),
));
/** The solid's own circumradius is sqrt(5); this brings it to `R` on screen. */
const SCALE = 1 / Math.sqrt(5);

/* ------------------------------ the roll ------------------------------- */

/** Frames a roll takes, and the beats either side of it. */
const ROLL_FRAMES = 30;
const TIP_FRAMES = 7;
const LAND_FRAMES = 9;

/** How far the pawn walks per frame, in face radii. */
const WALK = 0.022;

/** Three tones per colour, quantised. The die's rule, and for the same reason. */
const TONES = [1, 0.66, 0.42];
const INK = '#12121c';
const GROUND = '#0c0c14';
const SHADOW = '#000000';
const SHADOW_DX = 5;
const SHADOW_DY = 4;

const worldMedian = (i) => {
  const lv = (WORLDS[i].nodes || [])
    .filter((n) => n.level && DIFFICULTY[n.level] !== undefined)
    .map((n) => DIFFICULTY[n.level])
    .sort((a, b) => a - b);
  return lv.length ? Math.round(lv[Math.floor(lv.length / 2)]) : 0;
};

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * k)},`
    + `${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
};

/**
 * The roads on a face: a hub in the middle and a spoke to every open side.
 *
 * Which sides are open is a world's business and not this file's, so until the
 * data says otherwise every hexagon opens its three level doors and the first
 * of its three room doors — four spokes, which is the budget.
 */
function spokesOf(face) {
  const open = [];
  let rooms = 0;
  for (const side of face.sides) {
    if (!side.to) continue;
    if (side.to.kind === 'hex') { open.push(side.k); continue; }
    if (rooms === 0) { open.push(side.k); rooms++; }
  }
  return open;
}

export class GlobeScene {
  constructor(game, face = 0, onEnter = null) {
    this.game = game;
    this.onEnter = onEnter;
    this.face = face;
    this.tick = 0;
    this.rot = tilted(qBetween(FACES[face].normal, [0, 0, 1]));
    this.mode = 'idle';
    /* Face-local position of the pawn, in radii. The hub is the middle. */
    this.at = { u: 0, v: 0 };
    this.spoke = null;
    this.walkOut = true;
    this.roll = null;
    this.squash = 0;
  }

  enter() {
    Music.play('map');
    Sfx.play('doorin');
  }

  get here() { return FACES[this.face]; }

  /* ------------------------------ projection --------------------------- */

  /** A solid-local point on the screen, plus its depth for painter order. */
  project(p) {
    const r = qApply(this.rot, [p[0] * SCALE, p[1] * SCALE, p[2] * SCALE]);
    /* A squash on the way in, so the roll can flinch before it goes and land
     * with a bounce. It is the one thing in this file that is not geometry,
     * and it is the difference between a solid turning and a solid moving. */
    const s = (CAM_Z / (CAM_Z - r[2])) * (1 + this.squash * 0.06);
    return {
      x: CX + r[0] * R * s,
      y: CY - r[1] * R * s * (1 - this.squash * 0.16),
      z: r[2],
    };
  }

  /** A point on the face you are standing on, in face-local radii. */
  onHere(u, v) { return this.project(onFace(this.here, u, v)); }

  /* -------------------------------- input ------------------------------ */

  /**
   * The spoke a pressed arrow means, decided **on the screen**.
   *
   * Scored by how much of the arrow's direction the spoke actually points
   * along, so a road leaning up-and-right answers `up` and `right` equally
   * well and the closer of the two wins. On four spokes ninety degrees apart
   * that is never a coin toss.
   */
  spokeFor(want) {
    const hub = this.onHere(0, 0);
    let best = null;
    for (const k of spokesOf(this.here)) {
      const s = sideAt(this.here, k);
      const p = this.onHere(s.u, s.v);
      const dx = p.x - hub.x;
      const dy = p.y - hub.y;
      const len = Math.hypot(dx, dy) || 1;
      const score = want === 'right' ? dx / len : want === 'left' ? -dx / len
        : want === 'up' ? -dy / len : dy / len;
      if (score > 0.35 && (!best || score > best.score)) best = { k, score };
    }
    return best ? best.k : null;
  }

  update(input) {
    this.tick++;
    if (this.mode === 'roll') { this.updateRoll(); return; }
    if (this.squash !== 0) this.squash *= 0.82;

    if (this.mode === 'idle') {
      for (const key of ['left', 'right', 'up', 'down']) {
        if (!input.pressed[key]) continue;
        input.consume(key);
        const k = this.spokeFor(key);
        if (k === null) { Sfx.play('bump'); break; }
        this.spoke = k;
        this.walkOut = true;
        this.mode = 'walk';
        break;
      }
      return;
    }

    if (this.mode === 'walk') this.updateWalk();
  }

  updateWalk() {
    const s = sideAt(this.here, this.spoke);
    const len = Math.hypot(s.u, s.v) || 1;
    const now = Math.hypot(this.at.u, this.at.v);
    const next = this.walkOut ? now + WALK * len : now - WALK * len;
    if (next >= len) {
      this.at = { u: s.u, v: s.v };
      this.beginRoll();
      return;
    }
    if (next <= 0) {
      this.at = { u: 0, v: 0 };
      this.mode = 'idle';
      return;
    }
    this.at = { u: (s.u / len) * next, v: (s.v / len) * next };
  }

  /**
   * Rolling over the edge.
   *
   * The axis is the shared edge, in solid-local coordinates, and the angle is
   * the one that brings the neighbour's normal to where this face's normal is
   * now. Both signs are tried and the one that actually lands is kept — that
   * is two dot products against deriving a winding rule that would have to be
   * right for all thirty-six edges at once.
   */
  beginRoll() {
    const side = this.here.sides[this.spoke];
    if (!side.to || side.to.kind !== 'hex') { this.mode = 'idle'; return; }
    const to = FACES[side.to.index];
    const axis = (() => {
      const d = [side.b[0] - side.a[0], side.b[1] - side.a[1], side.b[2] - side.a[2]];
      const n = Math.hypot(...d) || 1;
      return [d[0] / n, d[1] / n, d[2] / n];
    })();
    const dotN = this.here.normal[0] * to.normal[0] + this.here.normal[1] * to.normal[1]
      + this.here.normal[2] * to.normal[2];
    const angle = Math.acos(clamp(dotN, -1, 1));
    let best = null;
    for (const sign of [1, -1]) {
      const q = qAxis(axis, angle * sign);
      const n = qApply(q, to.normal);
      const err = Math.hypot(n[0] - this.here.normal[0], n[1] - this.here.normal[1],
        n[2] - this.here.normal[2]);
      if (!best || err < best.err) best = { err, q };
    }
    this.roll = {
      from: this.rot,
      to: qNorm(qMul(this.rot, best.q)),
      t: 0,
      toFace: side.to.index,
      entry: side.to.index,
      sideKey: `${side.a.join(',')}|${side.b.join(',')}`,
    };
    this.mode = 'roll';
    this.squash = 1;
    Sfx.play('cursor');
  }

  updateRoll() {
    const r = this.roll;
    r.t += 1 / ROLL_FRAMES;
    /* Anticipation, travel, landing. The squash goes negative for the flinch
     * before the tip and positive for the bounce after it, which is the whole
     * of the "happy" in this animation. */
    const tip = TIP_FRAMES / ROLL_FRAMES;
    const land = 1 - LAND_FRAMES / ROLL_FRAMES;
    if (r.t < tip) this.squash = -0.5 * Math.sin((r.t / tip) * Math.PI);
    else if (r.t > land) this.squash = 0.6 * Math.sin(((r.t - land) / (1 - land)) * Math.PI);
    else this.squash = 0;

    const e = r.t < tip ? 0 : Math.min(1, (r.t - tip) / (land - tip));
    const eased = e < 0.5 ? 2 * e * e : 1 - ((-2 * e + 2) ** 2) / 2;
    this.rot = qSlerp(r.from, r.to, eased);

    if (r.t >= 1) {
      this.rot = r.to;
      this.face = r.toFace;
      /* You arrive standing on the edge you came over, and walk in. The pawn
       * never teleports to the middle: crossing an edge is a step, and a step
       * has a far side you are standing on. */
      const k = this.here.sides.findIndex((s) => `${s.a.join(',')}|${s.b.join(',')}` === r.sideKey
        || `${s.b.join(',')}|${s.a.join(',')}` === r.sideKey);
      this.spoke = k >= 0 ? k : spokesOf(this.here)[0];
      const s = sideAt(this.here, this.spoke);
      this.at = { u: s.u, v: s.v };
      this.walkOut = false;
      this.mode = 'walk';
      this.squash = 0.35;
      this.roll = null;
      Sfx.play('select');
    }
  }

  /* -------------------------------- drawing ---------------------------- */

  draw(ctx) {
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.drawFloor(ctx);

    const drawn = FACES.map((f) => {
      const pts = f.verts.map((v) => this.project(v));
      const depth = pts.reduce((s, p) => s + p.z, 0) / pts.length;
      return { f, pts, depth };
    }).filter((d) => d.depth > 0.05).sort((a, b) => a.depth - b.depth);

    ctx.fillStyle = SHADOW;
    for (const d of drawn) {
      poly(ctx, d.pts, SHADOW_DX, SHADOW_DY);
      ctx.fill();
    }

    ctx.lineJoin = 'round';
    for (const d of drawn) {
      const here = d.f === this.here;
      const room = d.f.kind === 'square';
      const base = room ? '#8890b0'
        : TIER_COLORS[Math.max(1, pipsFor(worldMedian(d.f.index % HEX_COUNT)))];
      const step = here ? 0 : Math.min(2, d.depth > 0.55 ? 1 : 2);
      poly(ctx, d.pts, 0, 0);
      ctx.fillStyle = shade(base, TONES[step]);
      ctx.fill();
      ctx.strokeStyle = here ? '#ffd048' : INK;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    this.drawRoads(ctx);
    this.drawPawn(ctx);
    this.drawLabels(ctx);
  }

  /** The floor of chunky dots, so the shadow has somewhere to land. */
  drawFloor(ctx) {
    for (let y = 150; y < VIEW_H; y += 12) {
      ctx.fillStyle = y < 176 ? '#1a1a28' : '#26263a';
      for (let x = -8; x < VIEW_W; x += 16) {
        ctx.fillRect(x + ((y / 12) % 2 ? 8 : 0), y, 2, 2);
      }
    }
  }

  drawRoads(ctx) {
    const hub = this.onHere(0, 0);
    for (const k of spokesOf(this.here)) {
      const s = sideAt(this.here, k);
      const end = this.onHere(s.u * 0.92, s.v * 0.92);
      const steps = Math.max(2, Math.round(Math.hypot(end.x - hub.x, end.y - hub.y) / 7));
      const room = this.here.sides[k].to.kind === 'square';
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = Math.round(hub.x + (end.x - hub.x) * t);
        const y = Math.round(hub.y + (end.y - hub.y) * t);
        ctx.fillStyle = 'rgba(24,20,16,0.72)';
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.fillStyle = room ? '#8fe04a' : '#ffd048';
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    ctx.fillStyle = '#f4f4f0';
    ctx.fillRect(Math.round(hub.x) - 3, Math.round(hub.y) - 3, 6, 6);
    ctx.fillStyle = INK;
    ctx.fillRect(Math.round(hub.x) - 2, Math.round(hub.y) - 2, 4, 4);
  }

  drawPawn(ctx) {
    const p = this.onHere(this.at.u, this.at.v);
    const power = normalizePower(this.game.state.power);
    /* Lifted by the sprite's own height, the same measurement the map makes:
     * the feet belong on the road, not the middle of the body. */
    const lift = power.level === 0 ? 10 : 16 + power.level * 4;
    const bob = this.mode === 'idle' ? Math.round(Math.sin(this.tick / 12)) : 0;
    ctx.fillStyle = 'rgba(8,8,16,0.5)';
    ctx.fillRect(Math.round(p.x) - 4, Math.round(p.y) - 1, 9, 3);
    drawPlayer(ctx, p.x - 6, p.y - lift + bob, {
      type: power.type,
      level: power.level,
      facing: 1,
      frame: Math.floor(this.tick / 8) % 3,
      state: this.mode === 'idle' ? 'idle' : 'walk',
      ducking: false,
      running: false,
    });
  }

  drawLabels(ctx) {
    const i = this.face % HEX_COUNT;
    drawText(ctx, WORLDS[i].name, 160, 12, {
      color: '#ffffff', align: 'center', shadow: '#303048',
    });
    drawText(ctx, this.mode === 'roll' ? 'KIERII' : 'NUOLET KULJE', 160, 226, {
      color: '#50506a', align: 'center',
    });
  }
}

function poly(ctx, pts, dx, dy) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x + dx, pts[0].y + dy);
  for (const p of pts.slice(1)) ctx.lineTo(p.x + dx, p.y + dy);
  ctx.closePath();
}
