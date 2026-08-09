import { normalizeRows } from '../core/utils.js';
import { DIFFICULTY } from './difficulty.js';

/**
 * Overworld data. Terrain is pure decoration (20x9 tiles = 320x144);
 * movement happens on the node graph below it.
 *
 * Terrain characters:
 *   . grass  , dark grass  T tree  M mountain  ~ water  S sand
 *   C cactus  R rock  I ice  P pine  " bush  F factory floor  E machinery
 *   b bone ground  K skull  c cloud bank  i tear in the cloud  U thunderhead
 *
 * Nine of those stand up out of the ground (`TALL_TERRAIN`), and where they
 * may stand is not up to whoever edits the grid: `worldProblems` refuses a map
 * that plants one on the road or next to it. See `clearZone`.
 *
 * BRANCHES. A world may declare `branches`: places where two routes leave the
 * same node and rejoin at the same node. The declaration is not decoration —
 * `worldProblems()` refuses a map whose links fork without one, so a fork that
 * nobody described cannot exist in this file. Each route names the nodes that
 * are its own (`via`), and may name a `reward` that only that route pays.
 *
 * Three things the declaration buys, all of them checked rather than promised:
 *   - the routes are real chains of real links, from the fork to the join
 *   - blocking every rewarded route still leaves the fortress reachable, so the
 *     unrewarded way through the game always exists (ROADMAP condition 3)
 *   - the reward sits on the harder route, measured, not asserted
 */
const WORLD_DEFS = [
  {
    id: 'w1',
    name: 'PAPULAAKSO',
    theme: 'grass',
    terrain: [
      'MMM.T..TT.......MMMM',
      'MM......T....TT...MM',
      '..,..T...T."..T...,.',
      '..T....."......T..T.',
      '...."...T........T..',
      '.,.........,........',
      '............".....T.',
      '~~~.........TT....~~',
      '~~~~~~~~..~~~~~~~~~~',
    ],
    nodes: [
      { id: 'w1-s', tx: 1, ty: 6, type: 'start', name: 'ALKU' },
      { id: 'w1-1', tx: 3, ty: 6, type: 'level', level: '1-1', name: 'PAPUPELTO' },
      { id: 'w1-2', tx: 6, ty: 6, type: 'level', level: '1-2', name: 'MÖNKIJÄNIITTY' },
      { id: 'w1-h', tx: 6, ty: 3, type: 'house', name: 'HERNETALO' },
      { id: 'w1-3', tx: 10, ty: 4, type: 'level', level: '1-3', name: 'TUULINEN HARJU' },
      { id: 'w1-f', tx: 14, ty: 6, type: 'fortress', level: '1-F', name: 'LINNAKE 1' },
    ],
    links: [
      { a: 'w1-s', b: 'w1-1' },
      { a: 'w1-1', b: 'w1-2' },
      { a: 'w1-2', b: 'w1-h' },
      { a: 'w1-2', b: 'w1-3', path: [[10, 6]] },
      { a: 'w1-3', b: 'w1-f', path: [[14, 4]] },
    ],
  },
  {
    id: 'w2',
    name: 'HIKIHIEKKA',
    theme: 'desert',
    terrain: [
      'SSSSSSSSSSSSSSSSSSSS',
      'SSMSSSSSCSSRSMSMMSSS',
      'SSSSSSCSSCSSSSSSSSSS',
      'SSSSSSSRSSSSSSSSSSSS',
      'SSSSSSSSSSSSSSSSSCSS',
      'SSSSSSSSSSSSSCSSSSSS',
      'SSSSSSSSSSSSSSSSSRSS',
      'SSCSSSSSSSSSSSSSSSCS',
      'SSSRSSSSSSSSSSSSSSSS',
    ],
    nodes: [
      { id: 'w2-s', tx: 1, ty: 5, type: 'start', name: 'ALKU' },
      { id: 'w2-1', tx: 3, ty: 5, type: 'level', level: '2-1', name: 'KUUMA DYYNI' },
      { id: 'w2-h', tx: 3, ty: 2, type: 'house', name: 'HERNETALO' },
      { id: 'w2-2', tx: 7, ty: 5, type: 'level', level: '2-2', name: 'HIEKKAMYRSKY' },
      { id: 'w2-n', tx: 9, ty: 7, type: 'level', level: '2-N', name: 'AAVIKON YÖ' },
      { id: 'w2-3', tx: 11, ty: 3, type: 'level', level: '2-3', name: 'LAAVAKUILU' },
      /* The desert mini-boss, on the upper road because that is the measured
       * harder one — 156 against 124. The fight's own author proposed hanging
       * it off 2-N instead, reasoning that the night level is "the harder way";
       * the meter disagrees, and the reward has to sit on the road that
       * actually costs more or `worldProblems` rejects the map. Which is the
       * point of measuring it rather than remembering it. */
      { id: 'w2-m', tx: 13, ty: 3, type: 'level', level: '2-M', name: 'PAROONIEN KUOPPA' },
      { id: 'w2-f', tx: 15, ty: 5, type: 'fortress', level: '2-F', name: 'LINNAKE 2' },
    ],
    links: [
      { a: 'w2-s', b: 'w2-1' },
      { a: 'w2-1', b: 'w2-h' },
      { a: 'w2-1', b: 'w2-2' },
      { a: 'w2-2', b: 'w2-n', path: [[7, 7]] },
      { a: 'w2-n', b: 'w2-f', path: [[15, 7]] },
      { a: 'w2-2', b: 'w2-3', path: [[11, 5]] },
      { a: 'w2-3', b: 'w2-m' },
      { a: 'w2-m', b: 'w2-f', path: [[15, 3]] },
    ],
    /*
     * The first fork in the game. 2-N used to hang off the road with no way
     * back, which is the shape a branch has before somebody finishes it; the
     * link to the fortress is what turns it into a choice.
     *
     * The low road is the gentler one and pays nothing. The lava road is the
     * harder one — measured, 156 against 124 — and it is where the desert
     * mini-boss and the breaking power-up go. Both start at 2-2 and both end at
     * the fortress, so taking the low road all the way still finishes world 2.
     */
    branches: [
      {
        from: 'w2-2',
        to: 'w2-f',
        routes: [
          { name: 'HIEKKATIE', via: ['w2-n'] },
          { name: 'LAAVATIE', via: ['w2-3', 'w2-m'], reward: 'break' },
        ],
      },
    ],
  },
  {
    id: 'w3',
    name: 'JÄÄTÄVÄ VETO',
    theme: 'ice',
    terrain: [
      'IIMIIIIIIIIIIIIIIMII',
      'IIMMIIIPIIIIRIMMIIII',
      'IIIIRIIIPIPIIPIIIRII',
      'IIPIIIRIIIIIIIIPIIII',
      'IIIIIIIIIIIIIIRIIPII',
      'IIIIIIIIIIIIIIIIIIII',
      'IIIIIIIIIIIIIIIIIIII',
      'IIIIIIIIIIPIIIIIIIRI',
      'IIPIIIRIIIIIIIIIIIII',
    ],
    nodes: [
      { id: 'w3-s', tx: 1, ty: 6, type: 'start', name: 'ALKU' },
      { id: 'w3-1', tx: 4, ty: 6, type: 'level', level: '3-1', name: 'KYLMÄ VIIMA' },
      { id: 'w3-2', tx: 8, ty: 4, type: 'level', level: '3-2', name: 'JÄÄPUTOUS' },
      { id: 'w3-h', tx: 12, ty: 4, type: 'house', name: 'HERNETALO' },
      { id: 'w3-3', tx: 12, ty: 7, type: 'level', level: '3-3', name: 'HALKEAMA' },
      { id: 'w3-f', tx: 16, ty: 5, type: 'fortress', level: '3-F', name: 'PIERUKUNINGAS' },
    ],
    links: [
      { a: 'w3-s', b: 'w3-1' },
      { a: 'w3-1', b: 'w3-2', path: [[8, 6]] },
      { a: 'w3-2', b: 'w3-h' },
      { a: 'w3-h', b: 'w3-3' },
      { a: 'w3-3', b: 'w3-f', path: [[16, 7]] },
    ],
  },
  {
    id: 'w4',
    name: 'PIERUTEHDAS',
    theme: 'factory',
    terrain: [
      'FFFFFFFFFFFFFFFFFFFF',
      'FFEFFFFFFFFEEFFFFFFF',
      'FFFFFFEFEFFFFFFFFEFF',
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFFFFFFFFFFFFFFFEF',
      'FFFFFFFFFFFFFFFFFFFF',
      'FEFFFEFFFFFFFFEFFFFF',
      'FFEFFFFEFFFFFFFEFFFF',
      'FFFEFFFFFFFFFFEFFFFF',
    ],
    nodes: [
      { id: 'w4-s', tx: 1, ty: 4, type: 'start', name: 'ALKU' },
      { id: 'w4-1', tx: 4, ty: 4, type: 'level', level: '4-1', name: 'HIHNAKULJETIN' },
      { id: 'w4-h', tx: 4, ty: 1, type: 'house', name: 'HERNETALO' },
      { id: 'w4-2', tx: 8, ty: 6, type: 'level', level: '4-2', name: 'KAASUPUTKISTO' },
      { id: 'w4-3', tx: 12, ty: 3, type: 'level', level: '4-3', name: 'PAINEKATTILA' },
      { id: 'w4-f', tx: 16, ty: 5, type: 'fortress', level: '4-F', name: 'PIERUPRINSSI' },
    ],
    links: [
      { a: 'w4-s', b: 'w4-1' },
      { a: 'w4-1', b: 'w4-h' },
      { a: 'w4-1', b: 'w4-2', path: [[8, 4]] },
      { a: 'w4-2', b: 'w4-3', path: [[12, 6]] },
      { a: 'w4-3', b: 'w4-f', path: [[16, 3]] },
    ],
  },
  {
    id: 'w5',
    name: 'JÄLKIPYYKKI',
    theme: 'grass',
    terrain: [
      'MMM.".TT..T...T..MMM',
      'MM...T..T..TT..T..MM',
      '..,....T......T...,.',
      '.T...."........T."..',
      '..............T...T.',
      '.,........,.........',
      '..........".........',
      '~~..T.....TT.....~~~',
      '~~~~~~~..~~~~~~~~~~~',
    ],
    nodes: [
      { id: 'w5-s', tx: 1, ty: 5, type: 'start', name: 'ALKU' },
      { id: 'w5-1', tx: 4, ty: 5, type: 'level', level: '5-1', name: 'JÄLKIRUOKA' },
      { id: 'w5-h', tx: 4, ty: 2, type: 'house', name: 'HERNETALO' },
      { id: 'w5-2', tx: 8, ty: 3, type: 'level', level: '5-2', name: 'KUIVA KAUSI' },
      { id: 'w5-3', tx: 12, ty: 6, type: 'level', level: '5-3', name: 'VIIMEINEN VETO' },
      { id: 'w5-f', tx: 16, ty: 4, type: 'fortress', level: '5-F', name: 'UUSINTAOTTELU' },
    ],
    links: [
      { a: 'w5-s', b: 'w5-1' },
      { a: 'w5-1', b: 'w5-h' },
      { a: 'w5-1', b: 'w5-2', path: [[8, 5]] },
      { a: 'w5-2', b: 'w5-3', path: [[12, 3]] },
      { a: 'w5-3', b: 'w5-f', path: [[16, 6]] },
    ],
  },
  /*
   * LUULAAKSO, maailma 6 — hautausmaa keskiyöllä.
   *
   * The shape is world 4's, deliberately: start, first level, a house hanging
   * off it, then two bends and the fortress. A new world is not the place to
   * also invent a new road, and the shape is measured to be readable — nodes
   * two tiles apart, links that bend without leaving their own tiles.
   *
   * The scenery is skulls and headstones on bare bone ground, and every one of
   * them was placed by the rule rather than by eye: rule 8 in `worldProblems`
   * refuses anything tall on a path tile or beside one, so the grid was built
   * by taking the road's clear zone out first and planting into what was left.
   * Twenty-one pieces asked for, twenty-one placed, none refused.
   */
  {
    id: 'w6',
    name: 'LUULAAKSO',
    theme: 'bone',
    terrain: [
      'KbbbbbbbbbbbbKbbbbKb',
      'bbRbbbKbbbKbbbbbbbbK',
      'RbbbbbbbbRbbbbbbbbbb',
      'bbbbbbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbbbbbR',
      'bbbbbbbbbbbbbbbbbbbb',
      'bbbKbbRbbbbbbbbbbbKb',
      'bKRbbbbbbbbbbbKbbRbb',
      'bbbbbbKbbKbRbbbRbbbb',
    ],
    nodes: [
      { id: 'w6-s', tx: 1, ty: 4, type: 'start', name: 'ALKU' },
      { id: 'w6-1', tx: 4, ty: 4, type: 'level', level: '6-1', name: 'HAUTAUSMAA' },
      { id: 'w6-h', tx: 4, ty: 1, type: 'house', name: 'HERNETALO' },
      { id: 'w6-2', tx: 8, ty: 6, type: 'level', level: '6-2', name: 'KUUN ALLA' },
      { id: 'w6-3', tx: 12, ty: 3, type: 'level', level: '6-3', name: 'LUUTANSSI' },
      { id: 'w6-f', tx: 16, ty: 5, type: 'fortress', level: '6-F', name: 'LUURANKO' },
    ],
    links: [
      { a: 'w6-s', b: 'w6-1' },
      { a: 'w6-1', b: 'w6-h' },
      { a: 'w6-1', b: 'w6-2', path: [[8, 4]] },
      { a: 'w6-2', b: 'w6-3', path: [[12, 6]] },
      { a: 'w6-3', b: 'w6-f', path: [[16, 3]] },
    ],
  },
  /*
   * KAASUKEHÄ, maailma 7 — pilvikerros auringon puolella.
   *
   * The road runs along the top of a cloud bank, and the scenery is what a
   * cloud bank has: thunderheads standing up out of it (`U`) and the odd tear
   * in it through which the world below shows (`i`). The tear is the map's half
   * of the argument the levels make — this is somewhere *above* somewhere, not
   * a room with a blue wall behind it — and it is a flat glyph, so it goes
   * under the road like every other piece of ground texture.
   *
   * The grid was built from rule 8 outwards rather than by eye, as world 6's
   * was: the road's clear zone was taken out first and the thunderheads planted
   * into what was left. Twenty asked for, twenty placed, none refused.
   */
  {
    id: 'w7',
    name: 'KAASUKEHÄ',
    theme: 'cloud',
    terrain: [
      'ccUccccUcccccUccccUc',
      'ccccUcccicUcccccccUc',
      'UccccccccccccccccccU',
      'cccccccccciccccccccc',
      'UcccccccccccccicccUc',
      'ccUccccccccccccccccU',
      'ccccccUccccccccUcicc',
      'cUccccccccccUccccccc',
      'cccUcciccUccccccUccc',
    ],
    nodes: [
      { id: 'w7-s', tx: 1, ty: 3, type: 'start', name: 'ALKU' },
      { id: 'w7-1', tx: 4, ty: 3, type: 'level', level: '7-1', name: 'NOUSUVIRTAUS' },
      { id: 'w7-h', tx: 4, ty: 6, type: 'house', name: 'HERNETALO' },
      { id: 'w7-2', tx: 8, ty: 5, type: 'level', level: '7-2', name: 'MATALAPAINE' },
      { id: 'w7-3', tx: 12, ty: 2, type: 'level', level: '7-3', name: 'ALASIN' },
      { id: 'w7-f', tx: 16, ty: 4, type: 'fortress', level: '7-F', name: 'SÄÄHERRA' },
    ],
    links: [
      { a: 'w7-s', b: 'w7-1' },
      { a: 'w7-1', b: 'w7-h' },
      { a: 'w7-1', b: 'w7-2', path: [[8, 3]] },
      { a: 'w7-2', b: 'w7-3', path: [[12, 5]] },
      { a: 'w7-3', b: 'w7-f', path: [[16, 2]] },
    ],
  },
];

export const WORLDS = WORLD_DEFS.map((w) => ({ ...w, terrain: normalizeRows(w.terrain) }));

export const MAP_W = 20;
export const MAP_H = 9;
export const TILE = 16;

export function findNode(world, id) {
  return world.nodes.find((n) => n.id === id) || null;
}

export function startNode(world) {
  return world.nodes.find((n) => n.type === 'start') || world.nodes[0];
}

/** Waypoint list in tile coordinates, node centres included. */
export function linkPoints(world, link) {
  const a = findNode(world, link.a);
  const b = findNode(world, link.b);
  const mid = (link.path || []).map(([tx, ty]) => ({ tx, ty }));
  return [{ tx: a.tx, ty: a.ty }, ...mid, { tx: b.tx, ty: b.ty }];
}

/* ------------------------- the road, and its verges ----------------------- */

/**
 * THE BEND.
 *
 * A road drawn between two node centres is a ruler line, and a map made of
 * ruler lines reads as a diagram rather than a place. So every straight run
 * gets two control points, at a third and two thirds of its length, pushed
 * sideways by a couple of pixels. Two points rather than one because a single
 * pushed midpoint is a chevron — a road that changes its mind once — while two
 * independent ones give an arc when they agree and a lazy S when they do not.
 *
 * The offsets come out of a hash of the two node ids, never `Math.random()`.
 * The map is redrawn from scratch sixty times a second and rebuilt from a save
 * on every load; a random bend would crawl while you looked at it and would be
 * a different road after a quicksave. A hash of the ids is the same road on
 * every frame, on every machine, forever, and it costs nothing to store.
 *
 * BEND_MAX is 4 px and that number is load-bearing, not taste. A path dot is
 * six pixels across, so it reaches 3 px either side of the line; a tile is 16
 * and the line runs down its middle, 8 px from the edge. 4 + 3 = 7 < 8, so a
 * bent road still cannot leave the tiles the link says it passes through — and
 * those tiles, plus their neighbours, are exactly what `clearZone` keeps free
 * of scenery. Raise BEND_MAX to 5 and the road starts poking into ground that
 * nothing has cleared for it.
 */
export const BEND_MAX = 4;
const BEND_AT = [1 / 3, 2 / 3];

/** FNV-1a over a string → [0,1). Deterministic, and cheap enough to redo per frame. */
function bendHash(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/**
 * The link as a polyline in map pixels — the ONE geometry the map has.
 *
 * Both the drawing and the walking pawn read this. They used to each build
 * their own points out of `linkPoints`, which was harmless while the road was
 * straight and became a lie the moment it was not: the picture would bend and
 * the pawn would cut the corner. That split is what DESIGN.md 8 is about, so
 * the fix is not "bend both the same way" but "there is only one way".
 *
 * y is measured from the top of the map band, the same frame `this.pos` uses;
 * the scene adds MAP_Y when it draws.
 */
export function linkCurve(world, link) {
  const pts = linkPoints(world, link).map((p) => ({ x: p.tx * TILE + 8, y: p.ty * TILE + 8 }));
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    /* A zero-length hop has no normal to push along, so it keeps its endpoint
     * and skips the bend rather than dividing by zero and vanishing. */
    if (!len) { out.push(b); continue; }
    const nx = -(b.y - a.y) / len;          // unit normal, so the push is sideways
    const ny = (b.x - a.x) / len;
    /* A short run gets a smaller bend than a long one, or a two-tile hop reads
     * as a kink rather than a curve. The shortest run on any map is 32 px. */
    const cap = Math.min(BEND_MAX, Math.max(2, Math.round(len / 12)));
    for (const t of BEND_AT) {
      const key = `${link.a}>${link.b}#${i}#${t}`;
      const amp = 2 + Math.floor(bendHash(key) * (cap - 1) * 0.999999);
      const dir = bendHash(`${key}!`) < 0.5 ? -1 : 1;
      out.push({
        x: Math.round(a.x + (b.x - a.x) * t + nx * amp * dir),
        y: Math.round(a.y + (b.y - a.y) * t + ny * amp * dir),
      });
    }
    out.push(b);
  }
  return out;
}

/**
 * SCENERY THAT STANDS UP.
 *
 * These seven glyphs draw above the ground rather than on it, so a path drawn
 * across one is a path with a tree in it. Measured out of `drawTerrain`, in
 * pixels from the top of the tile:
 *
 *   T tree 1..14 · P pine 1..14 · M mountain 3..15 · C cactus 3..14
 *   R rock 8..13 · " bush 6..13 · E machinery 1..14 · K skull 4..14
 *   U thunderhead 1..13
 *
 * The path dot's own ink is y+5..y+10 inside the tile, so every one of them
 * collides head-on. The flat glyphs — grass, dark grass, sand, ice, factory
 * plating, bone ground, water — are ground texture and belong under the road.
 */
export const TALL_TERRAIN = 'TPMCR"EKU';

/** Every tile a link crosses, node centres included. */
export function pathTiles(world) {
  const out = new Set(world.nodes.map((n) => `${n.tx},${n.ty}`));
  for (const link of world.links) {
    const pts = linkPoints(world, link);
    for (let i = 0; i < pts.length - 1; i++) {
      let { tx, ty } = pts[i];
      const dx = Math.sign(pts[i + 1].tx - tx);
      const dy = Math.sign(pts[i + 1].ty - ty);
      out.add(`${tx},${ty}`);
      while (tx !== pts[i + 1].tx || ty !== pts[i + 1].ty) {
        if (tx !== pts[i + 1].tx) tx += dx;
        if (ty !== pts[i + 1].ty) ty += dy;
        out.add(`${tx},${ty}`);
      }
    }
  }
  return out;
}

/**
 * The corridor that has to stay empty: every path tile AND its four orthogonal
 * neighbours.
 *
 * Why the neighbours and not just the tile the road is in — this was measured
 * rather than argued, by drawing both maps and counting the empty pixels
 * between the road and the nearest scenery. Clear only the road's own tiles,
 * put a mountain range in the rows above and below it, and **2 px** of map is
 * all that is left: a mountain fills down to the last row of its tile, a road
 * bent 4 px upward reaches y+5 of its own, and the dark outline every dot
 * carries is then all but resting on the mountain's foot. Clearing the four
 * neighbours as well pushes the nearest possible scenery two tiles off the
 * centreline, and the tightest place on the five shipped maps measures **7 px**
 * — the width of the dot itself. Both numbers are asserted in `verify.mjs`, so
 * this paragraph cannot quietly stop being true.
 *
 * The diagonals are deliberately NOT listed, and they do not need to be: the
 * tile diagonally off a straight run is the orthogonal neighbour of the next
 * path tile along, so a straight road already clears its own diagonals. Only
 * the outside of a corner is left, and a corner is the one place where the road
 * turns away from the tile rather than past it.
 */
export function clearZone(world) {
  const zone = new Set();
  for (const key of pathTiles(world)) {
    const [tx, ty] = key.split(',').map(Number);
    zone.add(key);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) zone.add(`${tx + dx},${ty + dy}`);
  }
  return zone;
}

/* ======================= measured difficulty on the map =================== */

/**
 * What the harder branch pays. The label is what the map prints, so it has to
 * be spellable in the 5x7 font — `verify.mjs` draws every one of these strings
 * a character at a time and fails on a glyph that leaves no ink. A missing
 * glyph does not throw, it leaves a hole and moves the cursor anyway, so a
 * width test would happily pass on a label that renders wrong.
 */
export const REWARDS = {
  break: { label: 'MURTAVA VOIMA' },
};

export const PIPS = 5;

/**
 * Measured score → pips. The score is already normalised so that 100 is one
 * world 1 level, so one pip is half of one: a single pip up to 100, then a pip
 * per 50 points, five from 250 up. Nothing in here is an opinion about how a
 * level feels — it is the measured scale rounded to what a 16 px node can draw.
 *
 * The bands are fixed rather than quantiles of the current game on purpose. A
 * quantile scale would repaint world 1's nodes because somebody regenerated
 * world 5, and a difficulty display that moves when you did not touch the level
 * teaches the player to stop reading it.
 */
export function pipsFor(score) {
  if (!(score > 0)) return 0;
  return Math.max(1, Math.min(PIPS, Math.ceil(score / 50) - 1));
}

export function nodePips(node, scores = DIFFICULTY) {
  return node && node.level ? pipsFor(scores[node.level]) : 0;
}

function linkBetween(world, a, b) {
  return world.links.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a)) || null;
}

/** [fork, ...own nodes, join] — the nodes a player walks taking this route. */
export function routeChain(branch, route) {
  return [branch.from, ...route.via, branch.to];
}

/**
 * A route's number is the HARDEST level on it, not the average. What ends a run
 * is the worst thing on the way; an average lets one gentle level hide one
 * lethal one, which is exactly the lie this display exists to prevent.
 *
 * The shared endpoints — the fork and the join — are deliberately left out.
 * Both routes carry them, so they cannot tell the two apart, and counting the
 * fortress on both sides would flatten every branch toward the fortress score.
 */
export function routeInfo(world, branch, route, scores = DIFFICULTY) {
  const nodes = route.via.map((id) => findNode(world, id));
  const levels = nodes.filter((n) => n && n.level).map((n) => n.level);
  const score = levels.reduce((m, id) => Math.max(m, scores[id] || 0), 0);
  const chain = routeChain(branch, route);
  const links = [];
  for (let i = 0; i < chain.length - 1; i++) links.push(linkBetween(world, chain[i], chain[i + 1]));
  return {
    ...route, nodes, levels, links, score, pips: pipsFor(score),
  };
}

export function branchesOf(world, scores = DIFFICULTY) {
  return (world.branches || []).map((branch) => {
    const routes = branch.routes.map((r) => routeInfo(world, branch, r, scores));
    const byScore = [...routes].sort((a, b) => a.score - b.score);
    return {
      ...branch, routes, easiest: byScore[0], hardest: byScore[byScore.length - 1],
    };
  });
}

export function branchAt(world, nodeId, scores = DIFFICULTY) {
  return branchesOf(world, scores).find((b) => b.from === nodeId) || null;
}

/** Link object → the branch route it belongs to. Used to colour the path. */
export function routeByLink(world, scores = DIFFICULTY) {
  const out = new Map();
  for (const branch of branchesOf(world, scores)) {
    for (const route of branch.routes) {
      for (const link of route.links) if (link) out.set(link, route);
    }
  }
  return out;
}

/* ---------------------------- the node graph ----------------------------- */

export function fortressNode(world) {
  return world.nodes.find((n) => n.type === 'fortress') || null;
}

/** Nodes `from` can walk to, following links in the direction they are written. */
function forwardFrom(world, fromId, blocked = new Set()) {
  const next = new Map();
  for (const l of world.links) {
    if (blocked.has(l.a) || blocked.has(l.b)) continue;
    if (!next.has(l.a)) next.set(l.a, []);
    next.get(l.a).push(l.b);
  }
  const seen = new Set([fromId]);
  const stack = [fromId];
  while (stack.length) {
    for (const id of next.get(stack.pop()) || []) if (!seen.has(id)) { seen.add(id); stack.push(id); }
  }
  return seen;
}

/** Nodes that can walk to `target`. */
function backwardTo(world, targetId, blocked = new Set()) {
  const prev = new Map();
  for (const l of world.links) {
    if (blocked.has(l.a) || blocked.has(l.b)) continue;
    if (!prev.has(l.b)) prev.set(l.b, []);
    prev.get(l.b).push(l.a);
  }
  const seen = new Set([targetId]);
  const stack = [targetId];
  while (stack.length) {
    for (const id of prev.get(stack.pop()) || []) if (!seen.has(id)) { seen.add(id); stack.push(id); }
  }
  return seen;
}

/**
 * The world as TIERS rather than a chain. A tier is one step of progress: one
 * level, or one branch whose routes are alternatives to each other and so
 * occupy the same step. This is the shape the curve has to be measured against
 * now — a branching map walked as a chain reports a correct world as broken,
 * because it reads two alternatives as two consecutive steps.
 *
 * Houses are walked through but do not become tiers: they are not progress,
 * and in world 3 the route to 3-3 runs through one.
 */
export function tiersOf(world) {
  const fort = fortressNode(world);
  const onward = fort ? backwardTo(world, fort.id) : new Set();
  const branchFrom = new Map((world.branches || []).map((b) => [b.from, b]));
  const tiers = [];
  const seen = new Set();
  let cur = (startNode(world) || {}).id;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const node = findNode(world, cur);
    if (node && node.level) {
      tiers.push({
        id: cur, branch: null, levels: [node.level], fortress: node.type === 'fortress',
      });
    }
    const branch = branchFrom.get(cur);
    if (branch) {
      tiers.push({
        id: `${branch.from}>${branch.to}`,
        branch,
        levels: branch.routes.flatMap((r) => r.via
          .map((id) => (findNode(world, id) || {}).level).filter(Boolean)),
        fortress: false,
      });
      cur = branch.to;
      continue;
    }
    cur = world.links
      .filter((l) => l.a === cur && onward.has(l.b) && !seen.has(l.b))
      .map((l) => l.b)[0];
  }
  return tiers;
}

/**
 * A tier's number. Within a route: the hardest level (see routeInfo). Across
 * the routes of a branch: the EASIEST route, because that is the one every
 * player is guaranteed — the harder route is opt-in, so charging the world's
 * curve for it would report a ramp nobody has to walk.
 */
export function tierScore(world, tier, scores = DIFFICULTY) {
  if (!tier.branch) return tier.levels.reduce((m, id) => Math.max(m, scores[id] || 0), 0);
  const routes = tier.branch.routes.map((r) => routeInfo(world, tier.branch, r, scores));
  return Math.min(...routes.map((r) => r.score));
}

/* ---------------------------- structural rules --------------------------- */

/**
 * Everything about a world's shape that must be true for the map to mean what
 * it draws. Returns a list of human-readable problems; empty is good.
 *
 * These are structural on purpose. ROADMAP's third condition — "the easy route
 * has to lead all the way through the game" — is not a thing to remember while
 * editing data, it is rule 6 below: block every rewarded route and the fortress
 * must still be reachable. Data that breaks the promise cannot be written here
 * without the gate saying so.
 *
 * Rule 8 is the same idea applied to the picture rather than the graph: scenery
 * may not stand where the road goes. It reads the terrain grid, which is the
 * only rule here that does — but "the map has to mean what it draws" covers a
 * tree in the road exactly as much as it covers a level nobody can reach.
 */
export function worldProblems(world, scores = DIFFICULTY) {
  const out = [];
  const ids = new Set(world.nodes.map((n) => n.id));
  const say = (msg) => out.push(`${world.id}: ${msg}`);

  for (const l of world.links) {
    if (!ids.has(l.a)) say(`linkki tuntemattomaan solmuun ${l.a}`);
    if (!ids.has(l.b)) say(`linkki tuntemattomaan solmuun ${l.b}`);
  }
  const start = startNode(world);
  const fort = fortressNode(world);
  if (!start) say('ei aloitussolmua');
  if (!fort) say('ei linnaketta');
  if (!start || !fort || out.length) return out;

  const fromStart = forwardFrom(world, start.id);
  const toFort = backwardTo(world, fort.id);

  // 3. every level is on some way from the start to the fortress
  for (const n of world.nodes) {
    if (!n.level) continue;
    if (!fromStart.has(n.id)) say(`${n.level} ei ole saavutettavissa alusta`);
    else if (!toFort.has(n.id)) say(`${n.level} on umpikuja — siitä ei pääse linnakkeeseen`);
  }

  // 4. no undeclared fork: two ways onward must be described as a branch
  const declared = new Map((world.branches || []).map((b) => [b.from, b]));
  for (const n of world.nodes) {
    const onward = world.links.filter((l) => l.a === n.id && toFort.has(l.b)).map((l) => l.b);
    if (onward.length < 2) continue;
    const branch = declared.get(n.id);
    if (!branch) { say(`${n.id} haarautuu ilmoittamatta (${onward.join(', ')})`); continue; }
    const firsts = branch.routes.map((r) => r.via[0]);
    const missing = onward.filter((id) => !firsts.includes(id));
    if (missing.length) say(`${n.id}:n haarailmoitus ei kata reittiä ${missing.join(', ')}`);
  }

  // 5. every declared branch is a real pair of chains
  for (const branch of (world.branches || [])) {
    const where = `haara ${branch.from}→${branch.to}`;
    if (!ids.has(branch.from) || !ids.has(branch.to)) { say(`${where}: tuntematon pää`); continue; }
    if (branch.routes.length < 2) { say(`${where}: alle kaksi reittiä`); continue; }
    const ownSeen = new Set();
    for (const route of branch.routes) {
      if (!route.via.length) { say(`${where}: reitillä ${route.name} ei ole omia solmuja`); continue; }
      const chain = routeChain(branch, route);
      for (let i = 0; i < chain.length - 1; i++) {
        if (!linkBetween(world, chain[i], chain[i + 1])) {
          say(`${where}: reitiltä ${route.name} puuttuu linkki ${chain[i]}→${chain[i + 1]}`);
        }
      }
      for (const id of route.via) {
        if (id === branch.from || id === branch.to) say(`${where}: ${id} on sekä pää että reitin oma`);
        if (ownSeen.has(id)) say(`${where}: ${id} on kahdella reitillä`);
        ownSeen.add(id);
      }
      const levels = route.via.map((id) => (findNode(world, id) || {}).level).filter(Boolean);
      if (!levels.length) say(`${where}: reitillä ${route.name} ei ole yhtään kenttää`);
      if (route.reward && !REWARDS[route.reward]) say(`${where}: tuntematon palkinto ${route.reward}`);
    }
  }

  // 6. the unrewarded way through must exist — ROADMAP condition 3
  const paywalled = new Set((world.branches || [])
    .flatMap((b) => b.routes.filter((r) => r.reward).flatMap((r) => r.via)));
  if (paywalled.size && !forwardFrom(world, start.id, paywalled).has(fort.id)) {
    say('helppo reitti ei vie linnakkeeseen — palkittu haara on ainoa tie');
  }

  // 7. the reward sits on the harder route, measured
  for (const branch of branchesOf(world, scores)) {
    const rewarded = branch.routes.filter((r) => r.reward);
    const plain = branch.routes.filter((r) => !r.reward);
    for (const r of rewarded) {
      for (const p of plain) {
        if (r.score <= p.score) {
          say(`haara ${branch.from}→${branch.to}: palkittu reitti ${r.name} (${r.score.toFixed(1)}) `
            + `ei ole vaikeampi kuin ${p.name} (${p.score.toFixed(1)})`);
        }
      }
    }
  }

  // 8. nothing tall stands on the road or beside it
  /*
   * The owner played the map and said the trees were on top of the paths. They
   * were not, in z-order — `drawTerrain` runs before `drawLinks`, so the line
   * was always painted over the tree — and that is exactly why this is a data
   * rule and not a draw-order fix. A road that has been painted over a tree is
   * still a road you cannot follow: the eye reads the canopy, the trunk and the
   * dots as one busy patch. The line has to have somewhere to be.
   *
   * So it is a rule with the same standing as the branch rules above: a tree
   * planted on the road is not "a thing we have not done", it is a thing the
   * file refuses to hold. Turning it on displaced 36 pieces of scenery across
   * the five shipped maps; every one of them was decoration, and every one was
   * replanted somewhere the road does not go.
   */
  const zone = clearZone(world);
  for (let ty = 0; ty < (world.terrain || []).length; ty++) {
    const row = world.terrain[ty] || '';
    for (let tx = 0; tx < row.length; tx++) {
      if (TALL_TERRAIN.includes(row[tx]) && zone.has(`${tx},${ty}`)) {
        say(`${row[tx]} ruudussa ${tx},${ty} seisoo polun päällä tai sen vieressä`);
      }
    }
  }
  return out;
}

/** Every string this file asks the map to print. */
export function mapStrings(world) {
  return [
    world.name,
    ...world.nodes.map((n) => n.name).filter(Boolean),
    ...(world.branches || []).flatMap((b) => b.routes.map((r) => r.name)),
    ...Object.values(REWARDS).map((r) => r.label),
  ];
}
