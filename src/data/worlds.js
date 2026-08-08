import { normalizeRows } from '../core/utils.js';

/**
 * Overworld data. Terrain is pure decoration (20x9 tiles = 320x144);
 * movement happens on the node graph below it.
 *
 * Terrain characters:
 *   . grass  , dark grass  T tree  M mountain  ~ water  S sand
 *   C cactus  R rock  I ice  P pine  " bush  F factory floor  E machinery
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
      { id: 'w2-3', tx: 11, ty: 3, type: 'level', level: '2-3', name: 'LAAVAKUILU' },
      { id: 'w2-f', tx: 15, ty: 5, type: 'fortress', level: '2-F', name: 'LINNAKE 2' },
    ],
    links: [
      { a: 'w2-s', b: 'w2-1' },
      { a: 'w2-1', b: 'w2-h' },
      { a: 'w2-1', b: 'w2-2' },
      { a: 'w2-2', b: 'w2-3', path: [[11, 5]] },
      { a: 'w2-3', b: 'w2-f', path: [[15, 3]] },
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
    name: 'JALKIPYYKKI',
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
      { id: 'w5-1', tx: 4, ty: 5, type: 'level', level: '5-1', name: 'JALKIRUOKA' },
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
