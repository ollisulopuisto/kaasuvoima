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
import { drawScenery } from '../gfx/scenery.js';
import { hashNoise } from '../core/utils.js';
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

/**
 * Screen radius of the solid.
 *
 * Grown from 62 once the labels moved into two bands: the top band ends at 36
 * and the bottom begins at 174, so there are 138 pixels for the solid to be as
 * big as it likes in. 68 fills them. Owner: *"we can make the shape bigger!"*
 */
const R = 68;
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
/**
 * The roads on a face: prev, next, out, and a room where there is one.
 *
 * **Four at most, and never by luck.** A hexagon has three hex edges but the
 * chain uses two of them — the strip neighbours — and the third abuts a face
 * that is nowhere near this one in the level order. Drawing it made five
 * spokes, which is one more than there are arrow keys. It is not a road at
 * all: it is an edge the graph does not use, so it is not drawn.
 *
 * **And the way out is put where there is room for it.** A face's three
 * squares alternate with its three hexes, so taking the *first* free square
 * put all four roads on consecutive sides — 180° of the face, with the other
 * half empty and one road unreachable because no arrow pointed at it. The door
 * now takes whichever free square sits furthest from everything already
 * chosen, which spreads the four roads around the face and gives each of them
 * an arrow of its own.
 *
 * One function answers this for the drawing, the input and the walk, so a road
 * cannot be reachable in one of them and not the others.
 */
function roadsOf(face, rooms, door) {
  const k = STRIP.indexOf(face.index);
  const chain = new Set([STRIP[k - 1], STRIP[k + 1]].filter((n) => n !== undefined));
  const used = [];
  const free = [];
  for (const side of face.sides) {
    if (!side.to) continue;
    if (side.to.kind === 'hex') {
      if (chain.has(side.to.index)) used.push(side.k);
      continue;
    }
    if (rooms && rooms.has(side.to.index)) { used.push(side.k); continue; }
    free.push(side.k);
  }
  let doorAt = null;
  if (door && free.length) {
    const gap = (a, b) => {
      const d = Math.abs(a - b) % 6;
      return Math.min(d, 6 - d);
    };
    /* Judged on the **largest gap** the finished set leaves round the ring,
     * not on distance to the nearest neighbour: sides alternate hex and
     * square, so every free square touches a used hex and "nearest" is always
     * 1. Minimising the biggest hole is what actually spreads them — putting
     * the door at 2 leaves {0,1,2,3}, four roads in a row with a gap of three
     * behind them; putting it at 4 leaves {0,1,3,4} and no gap wider than two. */
    const widest = (set) => {
      const r = [...set].sort((a, b) => a - b);
      let worst = 0;
      for (let n = 0; n < r.length; n++) {
        const d = n + 1 < r.length ? r[n + 1] - r[n] : 6 - r[n] + r[0];
        worst = Math.max(worst, d);
      }
      return worst;
    };
    doorAt = free.reduce((best, k2) => (
      best === null || widest([...used, k2]) < widest([...used, best]) ? k2 : best
    ), null);
    void gap;
    used.push(doorAt);
  }
  return { sides: used.sort((a, b) => a - b), door: doorAt };
}

const spokesOf = (face, rooms, door) => roadsOf(face, rooms, door).sides;
const doorSide = (face, rooms, door) => roadsOf(face, rooms, door).door;

const SCENERY_BY_THEME = {
  grass: 'TTPTR',
  desert: 'CCRCC',
  ice: 'PMPMP',
  factory: 'EERE',
  bone: 'KK"K',
  cloud: 'PTPU',
  fortress: 'AUAA',
};

function sceneryOf(face, theme, rooms, door) {
  const glyphs = SCENERY_BY_THEME[theme] || SCENERY_BY_THEME.grass;
  const spokes = spokesOf(face, rooms, door).map((k) => sideAt(face, k));
  const out = [];
  /* Twenty-six candidates and a low gate, because two filters run after this
   * one and they are not gentle: the road corridor alone rejected six of
   * fourteen on face 0 and left it bare. Counted rather than eyeballed —
   * a face that grows nothing is the one outcome this is for. */
  for (let i = 0; i < 26; i++) {
    const n = hashNoise(face.index * 31 + i, i * 7 + 3);
    if (n < 0.30) continue;
    const th = (i / 26) * Math.PI * 2 + n;
    /* Out to 0.66 of the radius and no further: a glyph is 16 px wide and
     * drawn from its middle, so anything planted nearer the rim than this
     * hangs over onto the face next door. */
    const rad = 0.34 + ((n * 97) % 1) * 0.32;
    const u = Math.cos(th) * rad;
    const v = Math.sin(th) * rad;
    /* Clear of every spoke, measured to the line rather than to its ends: a
     * bush beside the middle of a road is as much in the way as one at the
     * junction. */
    const onRoad = spokes.some((sd) => {
      const len = Math.hypot(sd.u, sd.v) || 1;
      const along = (u * sd.u + v * sd.v) / len;
      if (along < -0.1 || along > len + 0.1) return false;
      return Math.abs(u * (sd.v / len) - v * (sd.u / len)) < 0.20;
    });
    if (onRoad) continue;
    out.push({ u, v, ch: glyphs[Math.floor(n * 613) % glyphs.length], i });
  }
  return out;
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

/**
 * WHICH FACES ARE OPEN, AND WHY IT IS NOT ALL OF THEM.
 *
 * Owner: *"it's not like EVERY facet is instantly available! At first you can
 * only access 1-1, and after unlocking that you can move to 1-2… there's still
 * unlocking to be done, but you don't necessarily have to unlock EVERYTHING."*
 *
 * He was right and this was a regression rather than a decision: when the
 * faces became levels I opened all three hex doors on every face, so the solid
 * handed out the whole world at once. The flat map had never done that —
 * `isLinkOpen` says a road is open when **either end has been cleared**, which
 * is what makes a world unfold ahead of you instead of arriving finished.
 *
 * **Along the chain, not around the neighbourhood.** Reading the rule as "any
 * face sharing an edge" was the first attempt and it opened three at a time,
 * because a hexagon has three level doors — one clear and a quarter of the
 * world arrived at once. The owner's rhythm is one at a time: *"after
 * unlocking that you can move to 1-2, after that you got 1-1, 1-2 and 2-1."*
 * So the gate follows `STRIP`, the Gray path that laid the levels out in the
 * first place: the next level along it opens, and the one behind stays open
 * because you have already stood there.
 *
 * Which leaves the **spare edges** — the five of the cube's twelve that the
 * path does not use, one on each middle face and two at each end. They are
 * shut here and they are where the ways out of the world belong; see ROADMAP.
 */
function faceOpen(byFace, cleared, face) {
  const k = STRIP.indexOf(face);
  if (k <= 0) return true;
  const node = byFace[face];
  if (!node) return false;
  if (cleared[node.id]) return true;
  /* Backwards is always open once you have been there, so a cleared world can
   * be walked over again — the chain gates what is *ahead*, not where you have
   * already stood. */
  const at = (i) => (i >= 0 && i < STRIP.length ? byFace[STRIP[i]] : null);
  const done = (n) => !!(n && cleared[n.id]);
  return done(at(k - 1)) || done(at(k + 1));
}

/**
 * THE TRANSPOSE: level n of world w is the door to world n, entered at level w.
 *
 * Owner, 20.8.2026: *"you can go 1-1 to 1-2, 1-2 to 1-3 etc OR 1-1 to 1-2,
 * then to 2-1, 2-2, 2-3… or you can diverge from 2-3 to 3-2 etc. But! I think
 * those paths go in both directions. You can ALWAYS go back and select a
 * different route if you're blocked on your current one."*
 *
 * `w-n ↔ n-w`, and the amount that falls out of that one line is the reason it
 * is worth building rather than tuning:
 *
 * - **Self-inverse.** The door works from both ends, so nothing is authored
 *   twice and "you can always go back" is not a feature, it is the same edge
 *   read the other way. 8 × 7 ÷ 2 is 28 doors, the edge count of the complete
 *   graph on eight worlds.
 * - **The depth prices itself.** From world w you always arrive at level w of
 *   wherever you go, so leaving early lands you shallow in a hard world and
 *   leaving late lands you deep. Nobody tunes that; the numbering does it.
 * - **One level per world has no door** — the one numbered like its own world.
 *   1-1, 2-2, 3-3. A quiet room in each, for free.
 *
 * The degree works out exactly. A level needs three ways off it: back along
 * the chain, on along the chain, and out. A hexagon has three hex edges, which
 * is where the chain lives, and three square edges, which is where **out**
 * lives — because a square touches four faces, so *where an interchange takes
 * you depending on which face you walked in from* is honest geometry rather
 * than an edge that abuts one face and secretly leads somewhere else.
 */
function worldDoorOf(worldIndex, faceIndex) {
  const n = STRIP.indexOf(faceIndex) + 1;      // this face's level number
  const w = worldIndex + 1;                    // this world's number
  if (n < 1 || n === w || n > WORLDS.length) return null;
  return { world: n - 1, face: STRIP[w - 1], level: n, from: w };
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
    this.grown = new Map();
    this.leaving = null;
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
  /**
   * WHICH ROAD EACH ARROW MEANS, decided as a **whole** rather than one arrow
   * at a time.
   *
   * Scoring each arrow independently was the first version and it loses roads:
   * four spokes on a hexagon are never at ninety degrees to each other, so two
   * of them can be the best answer to the same key while a third is the best
   * answer to none, and that third road becomes unreachable. The way out of
   * world 1 was unreachable for exactly this reason.
   *
   * So it is an assignment: every road is scored against every arrow, the
   * strongest pairing is taken, both are struck out, and it repeats. Four
   * roads and four arrows means every road ends up with a key of its own, and
   * the pairing is recomputed each time it is asked because the solid turns —
   * a key that meant "the road to 2-1" on one face means nothing on the next.
   */
  /** This face's way out of the world, or null on the one level per world
   *  that is numbered like the world itself. */
  doorHere() {
    return worldDoorOf(this.world, this.face);
  }

  /**
   * What is on the other side of spoke `k`, as one word. The colours, the
   * refusal and the walk all read it, so a road cannot look walkable and then
   * not be.
   */
  spokeLeads(k) {
    const side = this.here.sides[k];
    if (!side.to) return 'none';
    if (side.to.kind === 'square') {
      const node = this.rooms.get(side.to.index);
      if (node) return this.game.state.cleared[node.id] ? 'spent' : 'room';
      const door = this.doorHere();
      if (!door || k !== doorSide(this.here, this.rooms, door)) return 'none';
      /* Open from **either end**, exactly as `isLinkOpen` reads a road on the
       * flat map. That is the whole of "you can always go back": the door you
       * came through is the same edge, and it does not shut behind you. */
      const here = this.byFace[this.face];
      const there = (WORLDS[door.world].nodes || [])
        .filter((n) => n.level)[door.from - 1];
      const done = (n) => !!(n && this.game.state.cleared[n.id]);
      return done(here) || done(there) ? 'out' : 'shut';
    }
    if (!faceOpen(this.byFace, this.game.state.cleared, side.to.index)) return 'locked';
    const node = this.byFace[side.to.index];
    return node && this.game.state.cleared[node.id] ? 'cleared' : 'open';
  }

  spokeOpen(k) {
    const lead = this.spokeLeads(k);
    return lead !== 'locked' && lead !== 'shut' && lead !== 'none';
  }

  arrowMap() {
    const hub = this.onHere(0, 0);
    const arrows = ['left', 'right', 'up', 'down'];
    const pairs = [];
    for (const k of spokesOf(this.here, this.rooms, this.doorHere())) {
      const sd = sideAt(this.here, k);
      const p = this.onHere(sd.u, sd.v);
      const dx = p.x - hub.x;
      const dy = p.y - hub.y;
      const len = Math.hypot(dx, dy) || 1;
      for (const a of arrows) {
        const score = a === 'right' ? dx / len : a === 'left' ? -dx / len
          : a === 'up' ? -dy / len : dy / len;
        pairs.push({ k, a, score });
      }
    }
    pairs.sort((x, y) => y.score - x.score);
    const out = {};
    const taken = new Set();
    for (const p of pairs) {
      if (out[p.a] !== undefined || taken.has(p.k)) continue;
      out[p.a] = p.k;
      taken.add(p.k);
    }
    return out;
  }

  spokeFor(want) {
    const k = this.arrowMap()[want];
    return k === undefined ? null : k;
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
        /* Refused here rather than at the far end of the road: walking the
         * length of a spoke to be told no is the same information delivered
         * late and with a wasted second attached to it. */
        if (!this.spokeOpen(k)) {
          this.message = 'LUKOSSA';
          this.messageTimer = 70;
          Sfx.play('bump');
          break;
        }
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
      if (!node) {
        /*
         * OUT OF THE WORLD, and the arrival is the one this game already has:
         * the new world's solid gets a fresh scene with `arriving` set, so he
         * falls onto the face he lands on exactly as he does at the start of
         * a world. Walking through a door and being dropped in are the same
         * event from two sides, so they get the same animation.
         */
        const door = this.doorHere();
        if (!door) { this.walkOut = false; return; }
        const levels = (WORLDS[door.world].nodes || []).filter((n) => n.level);
        const land = levels[door.from - 1];
        if (!land) { this.walkOut = false; return; }
        Sfx.play('pipe');
        this.game.state.world = door.world;
        this.game.state.node = land.id;
        this.game.persist();
        const next = new GlobeScene(this.game, door.world, door.face);
        next.arriving = true;
        this.game.setScene(next);
        return;
      }
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
    this.grown = new Map();
    this.leaving = null;
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
      this.spoke = k >= 0 ? k : spokesOf(this.here, this.rooms, this.doorHere())[0];
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
      /* A locked face is a tone deeper than the depth alone would make it, so
       * the solid shows how much of the world is still shut from any angle. */
      const shut = d.f.kind === 'hex'
        && !faceOpen(this.byFace, this.game.state.cleared, d.f.index);
      const step = here ? 0
        : Math.min(2, (d.depth > 0.55 ? 1 : 2) + (shut ? 1 : 0));
      poly(ctx, d.pts, 0, 0);
      ctx.fillStyle = shade(base, TONES[step]);
      ctx.fill();
      ctx.strokeStyle = here ? '#ffd048' : INK;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    this.drawGrowth(ctx);
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

/* eslint-disable-next-line class-methods-use-this */
  /**
   * The scenery of the face you are standing on, drawn as billboards.
   *
   * Only this face: a hexagon seen edge-on is four pixels of colour, and a
   * tree standing on it would be a tree standing in the air beside the solid.
   * The face you are reading is the one with room for detail, which is also
   * the only one you can do anything with.
   *
   * `i` becomes the sway phase, so no two of them lean together — the same
   * trick the flat map plays with tile coordinates, which is all `tx`/`ty`
   * ever were to `drawScenery`.
   */
  drawGrowth(ctx) {
    if (!this.grown.has(this.face)) {
      this.grown.set(this.face, sceneryOf(this.here, WORLDS[this.world].theme, this.rooms, this.doorHere()));
    }
    for (const g of this.grown.get(this.face)) {
      const p = this.onHere(g.u, g.v);
      drawScenery(ctx, g.ch, Math.round(p.x) - 8, Math.round(p.y) - 14, {
        theme: WORLDS[this.world].theme,
        tick: this.tick,
        tx: g.i * 3,
        ty: this.face * 5,
      });
    }
  }

  drawRoads(ctx) {
    const hub = this.onHere(0, 0);
    for (const k of spokesOf(this.here, this.rooms, this.doorHere())) {
      const s = sideAt(this.here, k);
      const end = this.onHere(s.u * 0.92, s.v * 0.92);
      const steps = Math.max(2, Math.round(Math.hypot(end.x - hub.x, end.y - hub.y) / 7));
      /*
       * THE ROAD SAYS WHERE IT GOES.
       *
       * Owner: *"could the colours of the sides or the paths give you a hint
       * about where you're going?"* — and the geometry had already sorted the
       * doors into the categories the answer needs, so this is only a matter
       * of printing what it knows. Gold is somewhere new, green is somewhere
       * you have been, grey is not yet, and the room doors take the colour of
       * the square they lead to so the road and its destination match.
       */
      const lead = this.spokeLeads(k);
      const ink = lead === 'locked' || lead === 'shut' ? '#4a4a5e'
        : lead === 'cleared' ? '#8fe04a'
          : lead === 'room' ? '#c8b0e8'
            : lead === 'spent' ? '#5a5a76'
              /* The way out of the world is its own colour and not a brighter
               * gold: it is not a longer step along this world, it is a
               * different kind of move. */
              : lead === 'out' ? '#40d0f0' : '#ffd048';
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = Math.round(hub.x + (end.x - hub.x) * t);
        const y = Math.round(hub.y + (end.y - hub.y) * t);
        ctx.fillStyle = 'rgba(24,20,16,0.72)';
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.fillStyle = ink;
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
