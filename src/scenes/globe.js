import { drawText } from '../gfx/font.js';
import { Music, Sfx } from '../core/audio.js';
import {
  WORLDS, pipsFor, nodePips, startNode, fortressNode, branchAt, REWARDS,
} from '../data/worlds.js';
import { DIFFICULTY } from '../data/difficulty.js';
import { TIER_COLORS } from './worldmap.js';
import { secretTally } from '../core/secrets.js';
import { clamp } from '../core/utils.js';
import { House } from './house.js';
import { qMul, qNorm, qSlerp, qApply, qAxis, qBetween } from '../core/quat.js';
import { drawPlayer } from '../gfx/sprites.js';
import { normalizePower } from '../entities/player.js';
import { FACES, HEX_COUNT, STRIP, onFace, sideAt } from '../data/solid.js';

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
const CY = 106;

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

/**
 * ARRIVING IN A WORLD: he is dropped on the first level.
 *
 * The flat map had a start node — a plaque saying MATKA ALKAA TASTA that you
 * stood on, walked off, and never used again. It was a node so that the road
 * had somewhere to begin, and on a solid the road begins in the middle of a
 * face, so there is nothing left for it to be.
 *
 * Which is an opportunity rather than a hole. A world can *start* instead of
 * merely being entered: he falls out of the sky onto level one, the solid
 * takes the hit, and the dust rings out from where he landed. It says the same
 * thing the plaque said — this is where it begins — and it says it once,
 * without occupying a square of the map forever afterwards.
 *
 * `DROP_FALL` accelerates (the height goes as one minus t squared, which is
 * what falling does); `DROP_LAND` is the beat afterwards where nothing happens
 * except the consequences.
 */
const DROP_FALL = 26;
const DROP_LAND = 18;
/* 110 and not 150: he has to *be seen* falling. From 150 the first third of
 * the fall happened above the top of the screen, which reads as the scene
 * hesitating before it starts rather than as a drop. */
const DROP_HIGH = 110;

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
/**
 * The roads on a face: a hub in the middle and a spoke to every open side.
 *
 * The three level doors are always open. A room door is open only where there
 * **is** a room, which is at most one square per world today — so a face has
 * three or four spokes, never more, and the four-arrow budget is never spent.
 */
function spokesOf(face, rooms) {
  const open = [];
  for (const side of face.sides) {
    if (!side.to) continue;
    if (side.to.kind === 'hex') { open.push(side.k); continue; }
    if (rooms && rooms.has(side.to.index)) open.push(side.k);
  }
  return open;
}

/**
 * THE EIGHT LEVELS OF A WORLD, ON THE EIGHT FACES.
 *
 * Not eight *worlds* — that is the outer solid, and `die.js` is already it.
 * Every world in this game has exactly eight level-bearing nodes (seven levels
 * and a fortress), which is the number of hexagons, so the fit is exact rather
 * than a scheme the content is bent into.
 *
 * The order is the world's own chain from its start to its fortress, laid
 * along `STRIP` — the Gray code — so level `k + 1` is always one edge away
 * from level `k`. Walking forward is therefore a walk, and the fortress ends
 * up at the far end of the path with a spare edge to leave the world by.
 *
 * The nodes that carry no level — the start marker and the house — are not
 * faces. The house is a **room**, and a room is a square: three of a
 * hexagon's six sides lead to them, and a square touches four hexagons, so a
 * house is a place four levels share instead of a stub hanging off one.
 */
function facesOfWorld(world) {
  const chain = [];
  const seen = new Set();
  const next = new Map();
  for (const l of world.links) {
    if (!next.has(l.a)) next.set(l.a, []);
    next.get(l.a).push(l.b);
  }
  const walk = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = world.nodes.find((n) => n.id === id);
    if (node && node.level) chain.push(node);
    for (const to of next.get(id) || []) walk(to);
  };
  const start = startNode(world);
  walk(start ? start.id : world.nodes[0].id);
  /* Depth-first from the start reaches a branch's own nodes in order, and
   * anything the links somehow miss is appended rather than dropped: a level
   * with no face is a level you cannot play. */
  for (const n of world.nodes) if (n.level && !chain.includes(n)) chain.push(n);
  const fort = fortressNode(world);
  if (fort && chain.includes(fort)) {
    chain.splice(chain.indexOf(fort), 1);
    chain.push(fort);
  }
  const byFace = new Array(HEX_COUNT).fill(null);
  chain.slice(0, HEX_COUNT).forEach((node, k) => { byFace[STRIP[k]] = node; });

  /*
   * THE HOUSE IS A ROOM, AND A ROOM IS A SQUARE.
   *
   * On the flat map a house was a node hanging off one level by one link. Here
   * it is one of the squares the cut corners left behind, and a square touches
   * **four** hexagons — so the same house is a door from four different levels
   * instead of a stub only one of them can see. That is the whole reason the
   * truncation was worth having, and it costs nothing: the house was always
   * attached to a level in the data, so which square it is follows from where
   * that level ended up.
   */
  const rooms = new Map();
  for (const node of world.nodes) {
    if (node.level || node.type === 'start') continue;
    const link = world.links.find((l) => l.a === node.id || l.b === node.id);
    const hostId = link ? (link.a === node.id ? link.b : link.a) : null;
    const host = byFace.findIndex((n) => n && n.id === hostId);
    const face = FACES[host >= 0 ? host : STRIP[0]];
    const side = face.sides.find((sd) => sd.to && sd.to.kind === 'square'
      && !rooms.has(sd.to.index));
    if (side) rooms.set(side.to.index, node);
  }
  return { byFace, rooms };
}

export class GlobeScene {
  constructor(game, world = 0, face = null) {
    this.game = game;
    this.world = world;
    const laid = facesOfWorld(WORLDS[world]);
    this.byFace = laid.byFace;
    this.rooms = laid.rooms;
    this.house = null;
    this.message = null;
    this.messageTimer = 0;
    this.dust = 0;
    this.dropT = 0;
    this.landed = false;
    /* Start on the face of the node the save is standing on, so coming back
     * from a level puts you where you left rather than at the beginning. */
    const here = this.byFace.findIndex((n) => n && n.id === game.state.node);
    this.face = face !== null ? face : (here >= 0 ? here : STRIP[0]);
    /* Nothing to stand on yet means the world has not been entered: the save
     * knows no node of it, so this is an arrival and not a return. Asked of
     * the save rather than remembered in a flag, so reloading mid-world does
     * not drop him out of the sky a second time. */
    this.arriving = face === null && here < 0;
    this.tick = 0;
    this.rot = tilted(qBetween(FACES[this.face].normal, [0, 0, 1]));
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
    for (const k of spokesOf(this.here, this.rooms)) {
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
    if (this.messageTimer > 0) this.messageTimer--;
    if (this.dust > 0) this.dust = Math.max(0, this.dust - 1 / 16);
    if (this.arriving) { this.updateDrop(); return; }
    if (this.mode === 'house') { this.house.update(input); return; }
    if (this.mode === 'roll') { this.updateRoll(); return; }
    if (this.squash !== 0) this.squash *= 0.82;

    if (this.mode === 'idle') {
      if (input.pressed.jump || input.pressed.start) {
        input.consume('jump');
        input.consume('start');
        const node = this.byFace[this.face];
        if (node) {
          Sfx.play('select');
          /* The one door out of this scene, and it is the map's own door: the
           * globe decides *which* node and `startLevel` does the rest, so
           * there is no second way into a level that could drift from the
           * first. See `toWorldMap` for the way back. */
          this.game.overworld = 'globe';
          this.game.startLevel(node);
          return;
        }
        Sfx.play('bump');
      }
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

  /**
   * The fall, the hit, and the beat after it.
   *
   * The landing is the only frame that does anything: it stamps the save with
   * the node he came down on, so a reload afterwards is a return rather than
   * another arrival, and it hands the solid a positive squash — the bounce,
   * the same one the roll lands with, because a thing landing on a thing
   * should look the same however it got there.
   */
  updateDrop() {
    this.dropT += 1 / (DROP_FALL + DROP_LAND);
    const fall = DROP_FALL / (DROP_FALL + DROP_LAND);
    if (this.dropT < fall) return;
    /* No anticipation before this one, unlike the roll: the solid cannot flinch
     * at something it has no way of knowing is coming. All of the reaction is
     * on the far side of the impact. */
    if (!this.landed) {
      this.landed = true;
      this.squash = 0.8;
      this.dust = 1;
      const node = this.byFace[this.face];
      if (node) {
        this.game.state.node = node.id;
        this.game.persist();
      }
      Sfx.play('jysahdys');
    }
    this.squash *= 0.84;
    if (this.dropT >= 1) {
      this.arriving = false;
      this.squash = 0;
      this.mode = 'idle';
    }
  }

  /** How far above the face he still is, in screen pixels. 0 once landed. */
  dropHeight() {
    if (!this.arriving) return 0;
    const fall = DROP_FALL / (DROP_FALL + DROP_LAND);
    const t = Math.min(1, this.dropT / fall);
    return Math.round(DROP_HIGH * (1 - t * t));
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
    if (!side.to) { this.mode = 'idle'; return; }
    /*
     * A room is stepped into, not rolled onto. The solid does not turn for a
     * square: you are still standing on the same level, having gone in a door
     * beside it — which is what a house has always been, and is why the walk
     * back out puts you where you were rather than somewhere new.
     */
    if (side.to.kind === 'square') {
      const node = this.rooms.get(side.to.index);
      if (!node) { this.walkOut = false; return; }
      if (this.game.state.cleared[node.id]) {
        this.message = 'TALO ON JO TYHJA';
        this.messageTimer = 90;
        Sfx.play('bump');
        this.walkOut = false;
        return;
      }
      Sfx.play('select');
      this.house = new House(this.game, node, (text) => {
        this.house = null;
    this.message = null;
    this.messageTimer = 0;
    this.dust = 0;
    this.dropT = 0;
    this.landed = false;
        this.mode = 'walk';
        this.walkOut = false;
        if (text) { this.message = text; this.messageTimer = 110; }
      });
      this.mode = 'house';
      return;
    }
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
      this.spoke = k >= 0 ? k : spokesOf(this.here, this.rooms)[0];
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
      const node = d.f.kind === 'hex' ? this.byFace[d.f.index] : null;
      /* A face is the colour of its level's difficulty, so the solid is a
       * difficulty chart you can turn over — the same five tiers the map's
       * plaques use, from the same `nodePips`. */
      const base = room ? '#8890b0'
        : node ? TIER_COLORS[Math.max(1, nodePips(node))]
          : TIER_COLORS[Math.max(1, pipsFor(worldMedian(this.world)))];
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
    /* The room is drawn over everything, because you are inside it. */
    if (this.house) this.house.draw(ctx);
    if (this.messageTimer > 0 && this.message) {
      drawText(ctx, this.message, 160, 190, {
        color: '#ffffff', align: 'center', shadow: '#101018',
      });
    }
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
    for (const k of spokesOf(this.here, this.rooms)) {
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
    const drop = this.dropHeight();
    if (this.dust > 0) {
      /* A ring rather than a cloud: four pixels walking outwards along the
       * face, which is the only direction dust can go on a surface you are
       * looking across. It fades as it widens. */
      const r = Math.round(4 + (1 - this.dust) * 26);
      ctx.fillStyle = `rgba(240,240,248,${Math.min(1, this.dust * 1.2).toFixed(3)})`;
      for (let a = 0; a < 10; a++) {
        const th = (a / 10) * Math.PI * 2;
        const k = 3 - Math.round((1 - this.dust) * 2);
        ctx.fillRect(Math.round(p.x + Math.cos(th) * r) - 1,
          Math.round(p.y + Math.sin(th) * r * 0.45) - 1, k, k);
      }
    }
    const power = normalizePower(this.game.state.power);
    /* Lifted by the sprite's own height, the same measurement the map makes:
     * the feet belong on the road, not the middle of the body. */
    const lift = power.level === 0 ? 10 : 16 + power.level * 4;
    const bob = this.mode === 'idle' ? Math.round(Math.sin(this.tick / 12)) : 0;
    /* The shadow stays on the ground and shrinks as he falls towards it: a
     * shadow that rode down with him would say he was never in the air. */
    const near = 1 - Math.min(1, drop / DROP_HIGH);
    ctx.fillStyle = `rgba(8,8,16,${(0.15 + 0.35 * near).toFixed(3)})`;
    const w = Math.round(3 + 6 * near);
    ctx.fillRect(Math.round(p.x) - Math.round(w / 2), Math.round(p.y) - 1, w, 3);
    drawPlayer(ctx, p.x - 6, p.y - lift + bob - drop, {
      type: power.type,
      level: power.level,
      facing: 1,
      frame: Math.floor(this.tick / 8) % 3,
      state: drop > 0 ? 'jump' : this.mode === 'idle' ? 'idle' : 'walk',
      ducking: false,
      running: false,
    });
  }

  /**
   * Two bands, and the solid gets everything between them.
   *
   * Where you are goes **above** — world, then level, then its difficulty —
   * because that is what you read on arrival and never need again. What the
   * face offers goes **below**, where it can grow: a branch board is two lines
   * when there is one and nothing at all when there is not. The solid is wide
   * enough at its middle to eat anything printed across it, so nothing is.
   */
  drawLabels(ctx) {
    drawText(ctx, WORLDS[this.world].name, 160, 8, {
      color: '#ffffff', align: 'center', shadow: '#303048',
    });
    const node = this.byFace[this.face];
    if (node) {
      const cleared = !!this.game.state.cleared[node.id];
      drawText(ctx, node.name || node.level, 160, 20, {
        color: cleared ? '#8fe04a' : '#ffd048', align: 'center', shadow: '#101018',
      });
      /* The difficulty bar, drawn rather than typed — the bitmap font has no
       * pip glyph, and a missing glyph leaves a hole and moves on. */
      const pips = Math.max(1, nodePips(node));
      for (let n = 0; n < 5; n++) {
        ctx.fillStyle = n < pips ? TIER_COLORS[pips] : '#3a3a52';
        ctx.fillRect(150 + n * 4, 31, 2, 3);
      }
    }
    /* Stacked from one cursor rather than each at its own fixed row: a branch
     * board is two lines when there is one and nothing at all when there is
     * not, so anything printed under it has to know where it actually ended.
     * Fixed rows had the secret count landing inside the second route. */
    let y = this.drawBranch(ctx, 174);
    this.drawSecrets(ctx, y);
    drawText(ctx, this.mode === 'roll' ? 'KIERII' : 'NUOLET KULJE   ENTER PELAA', 160, 226, {
      color: '#50506a', align: 'center',
    });
  }

  /**
   * WHAT IS HIDDEN IN THE FACE YOU ARE STANDING ON, counted and never located.
   *
   * The flat map says this with a three-pixel sparkle in the plaque's gutter,
   * because a plaque is 16 px wide and there was nowhere else. A face is not a
   * plaque and has room to say it in words, so it does — but it says the same
   * two numbers from the same `secretTally`, and it still never says *where*.
   * One count, two readers.
   */
  drawSecrets(ctx, y) {
    const node = this.byFace[this.face];
    if (!node || !node.level) return y;
    const tally = secretTally(this.game.state, node.level, this.game.mode);
    if (!tally || !tally.total) return y;
    const all = tally.found >= tally.total;
    drawText(ctx, `SALAISUUDET ${tally.found}/${tally.total}`, 160, y, {
      color: all ? '#8fe04a' : '#8890b0', align: 'center',
    });
    return y + 10;
  }

  /**
   * THE FORK, WHERE THERE IS ONE. Returns the row after it.
   *
   * A branch on the flat map was two roads leaving one node; here it is two
   * hexagons you can roll onto from the one you are on, which is the same
   * choice made of geometry instead of lines. What the geometry cannot say is
   * which of the two is harder and which pays — the thing ROADMAP condition 2
   * exists for, that a reward met only after committing is a surprise and not
   * a choice — so the board still has to be printed, and it is printed from
   * `branchAt`, measured, exactly as the panel's was.
   *
   * Three columns, and they are measured rather than eyeballed: the longest
   * route name in the game is 13 characters (77 px), so the pips clear it at
   * 96 and the prize at 126 still leaves the longest label, `MURTAVA VOIMA`,
   * finishing at 203 inside a 320 px screen.
   */
  drawBranch(ctx, y) {
    const node = this.byFace[this.face];
    if (!node) return y;
    const branch = branchAt(WORLDS[this.world], node.id);
    if (!branch) return y;
    drawText(ctx, 'HAARA', 8, y, { color: '#8890b0' });
    [...branch.routes].sort((a, b) => a.score - b.score).forEach((route, i) => {
      const row = y + 10 + i * 9;
      drawText(ctx, route.name, 8, row, { color: TIER_COLORS[route.pips] });
      for (let n = 0; n < 5; n++) {
        ctx.fillStyle = n < route.pips ? TIER_COLORS[route.pips] : '#3a3a52';
        ctx.fillRect(96 + n * 4, row + 2, 2, 3);
      }
      const prize = route.reward ? (REWARDS[route.reward] || {}).label : 'EI PALKINTOA';
      drawText(ctx, prize, 126, row, { color: route.reward ? '#ffd048' : '#5a5a76' });
    });
    return y + 10 + branch.routes.length * 9 + 3;
  }
}

function poly(ctx, pts, dx, dy) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x + dx, pts[0].y + dy);
  for (const p of pts.slice(1)) ctx.lineTo(p.x + dx, p.y + dy);
  ctx.closePath();
}
