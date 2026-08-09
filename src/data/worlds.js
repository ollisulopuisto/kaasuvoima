import { normalizeRows } from '../core/utils.js';
import { DIFFICULTY } from './difficulty.js';

/**
 * Overworld data. Terrain is pure decoration (20x9 tiles = 320x144);
 * movement happens on the node graph below it.
 *
 * Terrain characters:
 *   . grass  , dark grass  T tree  M mountain  ~ water  S sand
 *   C cactus  R rock  I ice  P pine  " bush  F factory floor  E machinery
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
      'MMM....TT.......MMMM',
      'MM......T....TT...MM',
      '..,..TT.......T...,.',
      '..T....."......T....',
      '...."...T....."..T..',
      '.,.........,........',
      '....T.......".....T.',
      '~~~..T......TT....~~',
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
      'SSMMSSSSCSSSSSSMMSSS',
      'SSSSSSSSSSSCSSSSSSSS',
      'SSCSSSSRSSSSSSSSCSSS',
      'SSSSSSSSSSSSRSSSSSSS',
      'SSSSSRSSSSSSSSSSSSSS',
      'SSSSSSSSCSSSSSSSSRSS',
      'SSCSSSSSSSSSSSCSSSSS',
      'SSSSSSSSSSSSSSSSSSSS',
    ],
    nodes: [
      { id: 'w2-s', tx: 1, ty: 5, type: 'start', name: 'ALKU' },
      { id: 'w2-1', tx: 3, ty: 5, type: 'level', level: '2-1', name: 'KUUMA DYYNI' },
      { id: 'w2-h', tx: 3, ty: 2, type: 'house', name: 'HERNETALO' },
      { id: 'w2-2', tx: 7, ty: 5, type: 'level', level: '2-2', name: 'HIEKKAMYRSKY' },
      { id: 'w2-n', tx: 9, ty: 7, type: 'level', level: '2-N', name: 'AAVIKON YÖ' },
      { id: 'w2-3', tx: 11, ty: 3, type: 'level', level: '2-3', name: 'LAAVAKUILU' },
      /* Tile 13,3 on the upper road is kept free for the desert mini-boss.
       * Dropping a node there splits w2-3 → w2-f into two links and needs
       * nothing else: it is already inside the rewarded route's `via`. */
      { id: 'w2-f', tx: 15, ty: 5, type: 'fortress', level: '2-F', name: 'LINNAKE 2' },
    ],
    links: [
      { a: 'w2-s', b: 'w2-1' },
      { a: 'w2-1', b: 'w2-h' },
      { a: 'w2-1', b: 'w2-2' },
      { a: 'w2-2', b: 'w2-n', path: [[7, 7]] },
      { a: 'w2-n', b: 'w2-f', path: [[15, 7]] },
      { a: 'w2-2', b: 'w2-3', path: [[11, 5]] },
      { a: 'w2-3', b: 'w2-f', path: [[15, 3]] },
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
          { name: 'LAAVATIE', via: ['w2-3'], reward: 'break' },
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
      'IIIIIIIIIIPIIIIIIRII',
      'IIPIIIRIIIIIIIIPIIII',
      'IIIIIIIIIIIIIIIIIIII',
      'IIIIPIIIIIRIIIIIIPII',
      'IIRIIIIIPIIIIIIIIIII',
      'IIPIIIIIIIIIIPIIIRII',
      'IIIIIIRIIIIIIIIIIIII',
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
      'FFEEFFFFFFFEEFFFFFFF',
      'FFFFFFFFEFFFFFFFFEFF',
      'FFEFFFFFFFFFFEFFFFFF',
      'FFFFFFFEFFFFFFFFFFFF',
      'FFFEFFFFFFFFFFFEFFFF',
      'FFFFFFFFFFEFFFFFFFFF',
      'FFEFFFFFEFFFFFFEFFFF',
      'FFFFFFFFFFFFFFFFFFFF',
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
      'MMM...TT......T..MMM',
      'MM..T......TT.....MM',
      '..,....T......T...,.',
      '.T...."....T....."..',
      '...."....T......T...',
      '.,........,......T..',
      '...T......"......T..',
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
];

export const WORLDS = WORLD_DEFS.map((w) => ({ ...w, terrain: normalizeRows(w.terrain) }));

export const MAP_W = 20;
export const MAP_H = 9;

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
