import { hashNoise } from '../core/utils.js';

export const TILE = 16;

/** Level map characters. Anything not listed here is treated as empty air. */
export const T = {
  EMPTY: ' ',
  GROUND: '#',
  HARD: 'X',
  BRICK: 'B',
  QCOIN: '?',
  QPOWER: '!',
  QSTAR: '*',
  USED: 'u',
  COIN: 'o',
  PLATFORM: '-',
  PIPE_TL: '[',
  PIPE_TR: ']',
  PIPE_BL: '{',
  PIPE_BR: '}',
  SPIKE: '^',
  LAVA: 'W',
  CRUMBLE: '%',
  SWITCH: 'S',
  GOAL: 'F',
  DOOR: 'D',
  NOTE: 'N',
  VINE: 'v',
  WARP_L: '(',
  WARP_R: ')',
};

const S = { solid: true };
const SEMI = { semi: true };

export const TILE_INFO = {
  [T.GROUND]: { ...S },
  [T.HARD]: { ...S },
  [T.BRICK]: { ...S, breakable: true, bumpable: true },
  [T.QCOIN]: { ...S, question: 'coin', bumpable: true },
  [T.QPOWER]: { ...S, question: 'power', bumpable: true },
  /* Looks exactly like the other two on purpose. A block that announced what
   * is in it would turn the one big surprise in a level into an errand. */
  [T.QSTAR]: { ...S, question: 'star', bumpable: true },
  [T.USED]: { ...S, bumpable: true },
  [T.NOTE]: { ...S, note: true, bumpable: true },
  [T.PIPE_TL]: { ...S, pipe: true },
  [T.PIPE_TR]: { ...S, pipe: true },
  [T.PIPE_BL]: { ...S, pipe: true },
  [T.PIPE_BR]: { ...S, pipe: true },
  [T.PLATFORM]: { ...SEMI },
  /* The beanstalk. Deliberately not solid: you climb through it, and a vine you
   * could also stand on would be a ladder with leaves painted on. */
  [T.VINE]: { climb: true },
  /* A pipe that leads to another band of the same level. Solid like any pipe;
   * the travelling is in the scene, because only it knows how tall a band is. */
  [T.WARP_L]: { ...S, pipe: true, warp: true },
  [T.WARP_R]: { ...S, pipe: true, warp: true },
  /* Solid until you stand on it. The timer lives on the scene, not here —
   * `TILE_INFO` describes what a character *is*, never what it is doing. */
  [T.CRUMBLE]: { ...S, crumble: true },
  [T.SWITCH]: { ...S, bumpable: true, switch: true },
  [T.COIN]: { coin: true },
  [T.SPIKE]: { hazard: true },
  [T.LAVA]: { hazard: true },
  [T.GOAL]: { goal: true },
  [T.DOOR]: { door: true },
};

/**
 * What a character reads as while a switch is running.
 *
 * One direction only, and that is a decision rather than an omission: bricks
 * become coins, coins do not become bricks. A two-way swap is the classic
 * trick, but it can turn the tile a player is standing in into a wall, and
 * being sealed inside solid rock by a timer is not a puzzle. Everything here
 * only ever makes the level *less* solid, so no state it produces can trap you.
 */
export const SWITCH_MAP = { [T.BRICK]: T.COIN };

export const info = (ch) => TILE_INFO[ch] || {};
export const isSolid = (ch) => !!info(ch).solid;
export const isSemi = (ch) => !!info(ch).semi;

/**
 * `surface` picks how ground tiles are dressed (blades, ripples, rivets…),
 * everything else is straight palette.
 */
export const THEMES = {
  grass: {
    surface: 'grass',
    sky: ['#5c94fc', '#93c3ff'],
    ground: '#a05820', groundDark: '#6b3a12', groundTop: '#3ea23a', groundTopDark: '#25731f',
    brick: '#c8601c', brickDark: '#7a3410', brickLight: '#e8945c',
    hard: '#c8c8d8', hardDark: '#6f6f8a', hardLight: '#eaeaf6',
    pipe: '#3ea23a', pipeDark: '#1c6b1f', pipeLight: '#8fe04a',
    hill: '#2f8f3a', hillDark: '#1d6b28',
    cloud: '#ffffff',
  },
  desert: {
    surface: 'sand',
    sky: ['#f0a860', '#ffd9a0'],
    ground: '#d8a048', groundDark: '#9c6a24', groundTop: '#f0c060', groundTopDark: '#c08c30',
    brick: '#d8a040', brickDark: '#8c5c18', brickLight: '#f4cc84',
    hard: '#e0c090', hardDark: '#8c6a3c', hardLight: '#f6e2be',
    pipe: '#c88030', pipeDark: '#7c4a10', pipeLight: '#f0b060',
    hill: '#c89040', hillDark: '#9c6a24',
    cloud: '#fff0dc',
  },
  night: {
    surface: 'sand',
    sky: ['#0d1030', '#2a2350'],
    ground: '#6a5030', groundDark: '#3e2c18', groundTop: '#8a6a3c', groundTopDark: '#5c4424',
    brick: '#7a5a30', brickDark: '#4a3418', brickLight: '#a8804a',
    hard: '#8a86a0', hardDark: '#4a4660', hardLight: '#b4b0c8',
    pipe: '#7a5220', pipeDark: '#4a3010', pipeLight: '#a87a3a',
    hill: '#3a2f52', hillDark: '#241d38',
    cloud: '#3a3560',
  },
  ice: {
    surface: 'snow',
    sky: ['#2c4c9c', '#8cb8e8'],
    ground: '#a8c8e8', groundDark: '#5c7ca8', groundTop: '#eaf6ff', groundTopDark: '#a8c8e8',
    brick: '#8cb0d8', brickDark: '#4c6c98', brickLight: '#c8e0f8',
    hard: '#dcecff', hardDark: '#7c9cc4', hardLight: '#ffffff',
    pipe: '#4cc0c0', pipeDark: '#1c7878', pipeLight: '#8ce8e8',
    hill: '#7c9cd0', hillDark: '#4c6c98',
    cloud: '#ffffff',
  },
  factory: {
    surface: 'metal',
    sky: ['#2a2438', '#4a3c50'],
    ground: '#6a6478', groundDark: '#3c3848', groundTop: '#9a94ae', groundTopDark: '#5c5670',
    brick: '#b06030', brickDark: '#6c3a18', brickLight: '#e09050',
    hard: '#a8b0c0', hardDark: '#585f70', hardLight: '#d8e0f0',
    pipe: '#c05820', pipeDark: '#7a3410', pipeLight: '#f09040',
    hill: '#3a3450', hillDark: '#282238',
    cloud: '#5a5470',
  },
  fortress: {
    surface: 'stone',
    sky: ['#101018', '#282840'],
    ground: '#8a8aa0', groundDark: '#4a4a60', groundTop: '#a8a8c0', groundTopDark: '#6a6a84',
    brick: '#9a7a9a', brickDark: '#5a3c5a', brickLight: '#c4a4c4',
    hard: '#b0b0c8', hardDark: '#606078', hardLight: '#d8d8ec',
    pipe: '#7a7a98', pipeDark: '#3c3c58', pipeLight: '#a8a8c4',
    hill: '#30304c', hillDark: '#20203a',
    cloud: '#3a3a58',
  },
};

function bevel(ctx, x, y, w, h, light, dark) {
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x + w - 1, y, 1, h);
}

/* -------------------------------- ground -------------------------------- */

/** The dressing on the top edge of a ground tile, one per theme. */
function surfaceCap(ctx, x, y, th, tx, ty) {
  const n = hashNoise(tx, ty);
  switch (th.surface) {
    case 'grass':
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(x, y, TILE, 5);
      // blades poking into the air above the tile
      for (let i = 0; i < 5; i++) {
        const bn = hashNoise(tx * 5 + i, ty);
        if (bn < 0.45) continue;
        const bx = x + Math.floor(bn * 14);
        ctx.fillRect(bx, y - 1, 1, 1);
        if (bn > 0.85) ctx.fillRect(bx, y - 2, 1, 1);
      }
      ctx.fillStyle = th.groundTopDark;
      ctx.fillRect(x, y + 4, TILE, 2);
      for (let i = 0; i < 3; i++) {
        const bn = hashNoise(tx + i * 3, ty * 2);
        ctx.fillRect(x + Math.floor(bn * 13), y + 1, 1, 3);
      }
      break;

    case 'sand':
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(x, y, TILE, 5);
      ctx.fillStyle = th.groundTopDark;
      ctx.fillRect(x, y + 5, TILE, 1);
      // wind ripples
      for (let i = 0; i < 3; i++) {
        const bn = hashNoise(tx * 3 + i, ty + 5);
        ctx.fillRect(x + Math.floor(bn * 11), y + 2 + (i % 2), 4, 1);
      }
      break;

    case 'snow':
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(x, y - 1, TILE, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y - 1, TILE, 2);
      ctx.fillStyle = th.groundTopDark;
      ctx.fillRect(x, y + 5, TILE, 1);
      if (n > 0.72) {                       // an icicle hanging off the lip
        ctx.fillStyle = '#dceeff';
        const ix = x + Math.floor(n * 12);
        ctx.fillRect(ix, y + 6, 1, 3);
        ctx.fillRect(ix, y + 6, 2, 1);
      }
      break;

    case 'metal':
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(x, y, TILE, 4);
      ctx.fillStyle = th.hardLight;
      ctx.fillRect(x, y, TILE, 1);
      ctx.fillStyle = th.groundTopDark;
      ctx.fillRect(x, y + 4, TILE, 2);
      ctx.fillStyle = th.hardDark;
      ctx.fillRect(x + 2, y + 1, 2, 2);
      ctx.fillRect(x + 12, y + 1, 2, 2);
      break;

    default:                                 // stone
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(x, y, TILE, 4);
      ctx.fillStyle = th.groundTopDark;
      ctx.fillRect(x, y + 4, TILE, 2);
      ctx.fillStyle = th.hardLight;
      ctx.fillRect(x, y, TILE, 1);
      break;
  }
}

function drawGround(ctx, x, y, th, openAbove, tx, ty) {
  ctx.fillStyle = th.ground;
  ctx.fillRect(x, y, TILE, TILE);

  // body texture: strata for sand, panels for metal, blocks for stone, specks else
  if (th.surface === 'sand') {
    ctx.fillStyle = th.groundDark;
    for (let i = 0; i < 2; i++) {
      const n = hashNoise(tx + i * 7, ty * 3);
      ctx.fillRect(x + Math.floor(n * 6), y + 8 + i * 4, 6 + Math.floor(n * 6), 1);
    }
  } else if (th.surface === 'metal') {
    ctx.fillStyle = th.groundDark;
    ctx.fillRect(x + 7, y, 2, TILE);
    ctx.fillRect(x, y + 10, TILE, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y + 6, TILE, 1);
    if (hashNoise(tx, ty) > 0.8) {                 // rust patch
      ctx.fillStyle = 'rgba(160,70,30,0.35)';
      ctx.fillRect(x + 2, y + 11, 5, 4);
    }
  } else if (th.surface === 'snow') {
    // packed ice: a couple of long cracks instead of dirt specks
    ctx.fillStyle = th.groundDark;
    const n = hashNoise(tx, ty);
    ctx.fillRect(x + 2 + Math.floor(n * 5), y + 8, 1, 5);
    ctx.fillRect(x + 3 + Math.floor(n * 5), y + 10, 4, 1);
    if (n > 0.55) {
      ctx.fillRect(x + 11, y + 7, 1, 4);
      ctx.fillRect(x + 9, y + 9, 3, 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x + 1, y + 7, 3, 1);
  } else if (th.surface === 'stone') {
    ctx.fillStyle = th.groundDark;
    const off = (tx + ty) % 2 ? 0 : 8;
    ctx.fillRect(x, y + 7, TILE, 1);
    ctx.fillRect(x + off, y, 1, 7);
    ctx.fillRect(x + ((off + 8) % 16), y + 8, 1, 8);
  } else {
    ctx.fillStyle = th.groundDark;
    for (let i = 0; i < 5; i++) {
      const n = hashNoise(tx * 7 + i, ty * 13 + i * 3);
      const px = Math.floor(n * 14);
      const py = (openAbove ? 7 : 1) + Math.floor(hashNoise(ty + i, tx - i) * (openAbove ? 8 : 14));
      if (py < TILE - 1) ctx.fillRect(x + px, y + py, 2, 2);
    }
  }

  if (openAbove) surfaceCap(ctx, x, y, th, tx, ty);

  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(x, y + TILE - 1, TILE, 1);
  ctx.fillRect(x + TILE - 1, y, 1, TILE);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x, openAbove ? y + 6 : y, 1, TILE - (openAbove ? 6 : 0));
}

/* -------------------------------- blocks -------------------------------- */

/**
 * A breakable tile is boarded-up timber, not masonry: three upright planks
 * nailed to a cross-batten.
 *
 * Two things make it readable rather than merely different. The planks run
 * *vertically* while every solid surface in the game runs horizontally, so the
 * grain alone separates breakable from ground at speed. And it carries a hard
 * outline on all four sides — ground and hard tile seamlessly into each other,
 * so a framed box is by definition a thing rather than a wall. The material
 * also has to pay off when it goes: wood splinters, and `BrickPiece` does.
 */
function drawBrick(ctx, x, y, th, tx, ty) {
  ctx.fillStyle = th.brick;
  ctx.fillRect(x, y, TILE, TILE);

  // Plank seams, with the lit edge of the next board beside each one. The seam
  // takes a shadow on top of the palette colour: in the night set `brickDark`
  // and the ground brown are nearly the same, and a breakable tile that differs
  // only in silhouette is one you find out about by not finding out about it.
  for (const sx of [5, 10]) {
    ctx.fillStyle = th.brickDark;
    ctx.fillRect(x + sx, y, 1, TILE);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + sx, y, 1, TILE);
    ctx.fillStyle = th.brickLight;
    ctx.fillRect(x + sx + 1, y, 1, TILE);
  }

  // grain: a couple of ticks per tile so a wall is not one stamp repeated
  const n = hashNoise(tx * 3, ty * 5);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x + 1 + Math.floor(n * 3), y + 2, 1, 3);
  ctx.fillRect(x + 12 + Math.floor(n * 2), y + 11, 1, 3);
  if (n > 0.55) ctx.fillRect(x + 7, y + 12, 1, 3);
  if (n > 0.78) {                                   // a knot in one board
    const kx = x + (n > 0.9 ? 12 : 1);
    ctx.fillRect(kx, y + 11, 3, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(kx + 1, y + 11, 1, 2);
  }

  // the batten: a strap laid across the boards, which is what holds them up
  ctx.fillStyle = th.brick;
  ctx.fillRect(x, y + 6, TILE, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x, y + 7, TILE, 2);
  ctx.fillStyle = th.brickLight;
  ctx.fillRect(x, y + 6, TILE, 1);
  ctx.fillStyle = th.brickDark;
  ctx.fillRect(x, y + 9, TILE, 1);

  // nail heads, one per board, where the batten crosses it
  for (const nx of [2, 7, 13]) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + nx, y + 7, 2, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + nx, y + 7, 1, 1);
  }

  // the frame: what says "this is a box on the wall", not more wall
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(x, y, TILE, 1);
  ctx.fillRect(x, y + TILE - 1, TILE, 1);
  ctx.fillRect(x, y, 1, TILE);
  ctx.fillRect(x + TILE - 1, y, 1, TILE);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x + 1, y + 1, TILE - 2, 1);
}

/**
 * The prize block is a pressurised canister: a bolted brass plate with a drum
 * bulging out of it and a pea-green light burning behind the gauge glass.
 *
 * A symbol on the face would only ever be somebody else's symbol. A container
 * that is visibly under pressure says "there is something in here" without one,
 * and the blinking gauge is the part that says "hit me" — nothing else in the
 * game blinks. Its colours are fixed rather than themed on purpose: this is the
 * one tile that must shout on all six backgrounds, and the dark frame keeps it
 * off the sand in the desert as much as off the night sky.
 */
function drawQuestion(ctx, x, y, tick) {
  const phase = Math.floor(tick / 8) % 4;
  const plate = phase === 0 ? '#f0a828' : phase === 2 ? '#c88014' : '#dc941c';
  ctx.fillStyle = '#2a1a06';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = plate;
  ctx.fillRect(x + 1, y + 1, 14, 14);
  ctx.fillStyle = '#ffd478';
  ctx.fillRect(x + 1, y + 1, 14, 1);
  ctx.fillRect(x + 1, y + 1, 1, 14);
  ctx.fillStyle = '#8a5008';
  ctx.fillRect(x + 1, y + 14, 14, 1);
  ctx.fillRect(x + 14, y + 1, 1, 14);

  // corner bolts: the plate is fastened on, so it can be blown off
  for (const [bx, by] of [[2, 2], [12, 2], [2, 12], [12, 12]]) {
    ctx.fillStyle = '#6a3c04';
    ctx.fillRect(x + bx, y + by, 2, 2);
    ctx.fillStyle = '#ffe8b0';
    ctx.fillRect(x + bx, y + by, 1, 1);
  }

  // the drum, straining outwards
  ctx.fillStyle = '#6a3c04';                      // the shadow it casts on the plate
  ctx.fillRect(x + 3, y + 3, 11, 1);
  ctx.fillRect(x + 13, y + 4, 1, 9);
  ctx.fillRect(x + 3, y + 12, 11, 1);
  ctx.fillStyle = '#ffb838';
  ctx.fillRect(x + 3, y + 4, 10, 8);
  ctx.fillStyle = '#ffe8a8';
  ctx.fillRect(x + 3, y + 4, 10, 1);
  ctx.fillRect(x + 3, y + 4, 1, 8);
  ctx.fillStyle = '#9a5c0c';
  ctx.fillRect(x + 3, y + 11, 10, 1);
  ctx.fillRect(x + 12, y + 4, 1, 8);

  // a highlight sweeping across the face every couple of seconds
  const sweep = (tick % 150) / 150;
  if (sweep < 0.18) {
    const sx = Math.round(x + sweep * (TILE / 0.18) - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 3; i++) {
      const px = sx + i;
      if (px > x && px < x + TILE - 1) ctx.fillRect(px, y + 1, 1, TILE - 2);
    }
  }

  // the gauge: the only blinking thing on screen
  ctx.fillStyle = '#241c08';
  ctx.fillRect(x + 5, y + 6, 6, 5);
  const lit = phase === 0 || phase === 1;
  ctx.fillStyle = lit ? '#a8f04a' : '#4c8c1c';
  ctx.fillRect(x + 6, y + 7, 4, 3);
  if (lit) {
    ctx.fillStyle = '#e8ffc0';
    ctx.fillRect(x + 6, y + 7, 2, 1);
  }
}

/** The same canister after it has been emptied: the drum punched inside out. */
function drawUsed(ctx, x, y, th) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = th.brickDark;
  ctx.fillRect(x + 1, y + 1, 14, 14);

  // Inverted bevel on the crater: light on the bottom, dark on the top, which
  // is the whole reason it reads as pressed in rather than merely darker.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 3, y + 3, 10, 10);
  ctx.fillRect(x + 3, y + 3, 10, 1);
  ctx.fillRect(x + 3, y + 3, 1, 10);
  ctx.fillStyle = th.brick;
  ctx.fillRect(x + 3, y + 12, 10, 1);
  ctx.fillRect(x + 12, y + 3, 1, 10);

  // the dead gauge, and two creases where the metal folded
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x + 6, y + 7, 4, 2);
  ctx.fillRect(x + 4, y + 5, 3, 1);
  ctx.fillRect(x + 9, y + 10, 3, 1);

  ctx.fillStyle = th.brick;
  for (const [bx, by] of [[2, 2], [12, 2], [2, 12], [12, 12]]) {
    ctx.fillRect(x + bx, y + by, 2, 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x + 1, y + 1, 14, 1);
}

function drawHard(ctx, x, y, th, tx, ty) {
  ctx.fillStyle = th.hard;
  ctx.fillRect(x, y, TILE, TILE);
  bevel(ctx, x, y, TILE, TILE, th.hardLight, th.hardDark);

  if (th.surface === 'metal') {                    // riveted plate
    ctx.fillStyle = th.hardDark;
    for (const [rx, ry] of [[2, 2], [12, 2], [2, 12], [12, 12]]) {
      ctx.fillRect(x + rx, y + ry, 2, 2);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x + 3, y + 3, 1, 1);
    ctx.fillRect(x + 13, y + 3, 1, 1);
    ctx.fillStyle = th.hardDark;
    ctx.fillRect(x + 5, y + 7, 6, 2);
  } else if (th.surface === 'snow') {              // packed ice with a glint
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x + 3, y + 3, 4, 1);
    ctx.fillRect(x + 3, y + 3, 1, 4);
    ctx.fillStyle = th.hardDark;
    ctx.fillRect(x + 10, y + 9, 3, 1);
    ctx.fillRect(x + 12, y + 6, 1, 4);
  } else {
    ctx.fillStyle = th.hardDark;
    ctx.fillRect(x + 3, y + 3, 2, 2);
    ctx.fillRect(x + 11, y + 11, 2, 2);
    if (hashNoise(tx, ty) > 0.7) ctx.fillRect(x + 10, y + 4, 2, 1);
  }
}

function drawNote(ctx, x, y, tick, bumped) {
  const off = bumped ? 1 : 0;
  ctx.fillStyle = '#e8901c';
  ctx.fillRect(x, y + off, TILE, TILE - off);
  bevel(ctx, x, y + off, TILE, TILE - off, '#ffc060', '#8c4c08');
  const bob = Math.round(Math.sin(tick / 12) * 1);
  ctx.fillStyle = '#fff4d8';
  ctx.fillRect(x + 9, y + 4 + off + bob, 2, 7);
  ctx.fillRect(x + 6, y + 9 + off + bob, 4, 3);
  ctx.fillRect(x + 9, y + 4 + off + bob, 4, 2);
}

/** Where the throat of a pipe starts inside the mouth tile. */
const PIPE_THROAT = 6;

/**
 * The shaft of a pipe: sheet-metal stovepipe, built out of sections.
 *
 * Two attempts got thrown away here and both are worth recording. A smooth
 * light-to-dark tube is the thing we are trying not to be. Fine corrugation all
 * the way down is not that, but at 16 px it reads as a window shutter, and a
 * shutter is not something you would ever try to climb into. What works is
 * segments: a flat sheet with a riveted lap seam down the front and a joint
 * band where each section meets the next. `bandAt` is the row inside the tile
 * where a joint belongs, so the rhythm is one per tile and cannot drift when
 * the camera scrolls by an odd pixel.
 */
function ductShaft(ctx, x, y, off, h, th, left, bandAt) {
  ctx.fillStyle = th.pipe;
  ctx.fillRect(x, y + off, TILE, h);

  // The folded edge of the sheet: hard steps, no gradient. A square duct, not
  // a cylinder — the tube shading is the most familiar single thing about the
  // pipe this replaces, so it is the first thing to go.
  ctx.fillStyle = th.pipeDark;
  if (left) ctx.fillRect(x, y + off, 2, h);
  else ctx.fillRect(x + TILE - 3, y + off, 3, h);
  if (left) {
    ctx.fillStyle = th.pipeLight;
    ctx.fillRect(x + 2, y + off, 1, h);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + TILE - 1, y + off, 1, h);
  }

  // the riveted lap seam, on the left half only, so a pipe has a front
  if (left) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 6, y + off, 1, h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x + 7, y + off, 1, h);
    for (let i = 2; i < h; i += 5) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x + 6, y + off + i, 2, 1);
    }
  }

  if (bandAt === null || bandAt < off || bandAt + 3 > off + h) return;
  const bx = x + (left ? 2 : 0);
  const bw = TILE - (left ? 2 : 3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(bx, y + bandAt, bw, 1);
  ctx.fillStyle = th.pipeLight;
  ctx.fillRect(bx, y + bandAt + 1, bw, 1);
  ctx.fillStyle = th.pipeDark;
  ctx.fillRect(bx, y + bandAt + 2, bw, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';           // rivets holding the joint
  for (const rx of left ? [4, 11] : [4, 12]) ctx.fillRect(x + rx, y + bandAt + 1, 1, 1);
}

function drawPipe(ctx, x, y, ch, th) {
  const top = ch === T.PIPE_TL || ch === T.PIPE_TR;
  const left = ch === T.PIPE_TL || ch === T.PIPE_BL;
  ctx.fillStyle = th.pipe;
  ctx.fillRect(x, y, TILE, TILE);

  if (!top) {
    ductShaft(ctx, x, y, 0, TILE, th, left, 1);
    return;
  }

  // The mouth: a bolted vent collar sitting flush on the duct. Flush matters —
  // a rim that overhangs the shaft is the other game's pipe in one stroke, and
  // this one has to be enterable without borrowing that silhouette.
  ctx.fillStyle = th.pipe;
  ctx.fillRect(x, y, TILE, PIPE_THROAT);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x, y, TILE, 1);
  ctx.fillStyle = th.pipeLight;
  ctx.fillRect(x, y + 1, TILE, 1);
  ctx.fillStyle = th.pipeDark;
  ctx.fillRect(x, y + 5, TILE, 1);
  // Bolts sit symmetrically about the two-tile mouth: 2 and 11 on the left
  // tile, 4 and 13 on the right.
  for (const bx of left ? [2, 11] : [4, 13]) {
    ctx.fillStyle = th.pipeDark;
    ctx.fillRect(x + bx, y + 2, 2, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + bx, y + 2, 1, 1);
  }

  // The throat: a hole with walls beside it, not a dark stripe across the tile.
  // Inset from the outer edge is what does the work — you can see the thickness
  // of the sheet the opening is cut in, and thickness is what makes it a hole.
  const tx0 = left ? x + 2 : x;
  const tw = TILE - 2;
  ctx.fillStyle = th.pipeDark;
  ctx.fillRect(x, y + PIPE_THROAT, TILE, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(tx0, y + PIPE_THROAT, tw, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(tx0, y + PIPE_THROAT + 3, tw, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';       // far wall catching the light
  ctx.fillRect(tx0, y + PIPE_THROAT + 4, tw, 1);

  ductShaft(ctx, x, y, PIPE_THROAT + 5, TILE - PIPE_THROAT - 5, th, left, null);
}

/**
 * The beanstalk: a plant, not a ladder. The stalk leans a little further with
 * every row and the leaves alternate sides, so a vine forty tiles tall is not
 * one tile stamped forty times. The greens are fixed rather than themed — a
 * beanstalk that turned metallic in the factory would read as machinery.
 */
function drawVine(ctx, x, y, tx, ty, tick) {
  const lean = Math.round(Math.sin(ty * 0.8 + tick / 90) * 2);
  const sx = x + 6 + lean;
  ctx.fillStyle = '#1c6b1f';
  ctx.fillRect(sx - 1, y, 6, TILE);
  ctx.fillStyle = '#3ea23a';
  ctx.fillRect(sx, y, 4, TILE);
  ctx.fillStyle = '#8fe04a';
  ctx.fillRect(sx, y, 1, TILE);

  const right = ty % 2 === 0;
  const lx = right ? sx + 4 : sx - 7;
  const tip = right ? lx + 2 : lx;
  ctx.fillStyle = '#3ea23a';
  ctx.fillRect(lx, y + 5, 7, 3);
  ctx.fillRect(tip, y + 4, 5, 1);
  ctx.fillStyle = '#8fe04a';
  ctx.fillRect(lx + 1, y + 5, 4, 1);
  ctx.fillStyle = '#1c6b1f';
  ctx.fillRect(tip, y + 8, 5, 1);
  // a bean, on some rows only
  if (hashNoise(tx, ty * 3) > 0.72) {
    ctx.fillStyle = '#c8e04a';
    ctx.fillRect(right ? sx - 3 : sx + 5, y + 11, 2, 3);
  }
}

/**
 * A warp pipe looks like a pipe, because finding out that it is not is the
 * whole point. The only tell is a slow shine in the throat: enough to notice
 * if you are looking at it, not enough to announce itself.
 */
function drawWarpPipe(ctx, x, y, ch, th, tick) {
  drawPipe(ctx, x, y, ch === T.WARP_L ? T.PIPE_TL : T.PIPE_TR, th);
  const pulse = 0.1 + 0.12 * Math.sin(tick / 20);
  ctx.fillStyle = `rgba(255,255,255,${pulse})`;
  ctx.fillRect(x, y + PIPE_THROAT, TILE, 3);
}

function drawPlatform(ctx, x, y, th) {
  ctx.fillStyle = th.brickLight;
  ctx.fillRect(x, y, TILE, 2);
  ctx.fillStyle = th.brick;
  ctx.fillRect(x, y + 2, TILE, 3);
  ctx.fillStyle = th.brickDark;
  ctx.fillRect(x, y + 5, TILE, 1);
  ctx.fillRect(x + 5, y + 2, 1, 3);
  ctx.fillRect(x + 11, y + 2, 1, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, TILE, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x, y + 6, TILE, 1);
}

/**
 * The spikes only occupy the bottom of their tile; the rest is air.
 *
 * Exported because the damage box in scenes/level.js is built from it. Drawing
 * and hurting must come from one number, or a jump that visibly clears the
 * points still costs a power level — which is exactly what it did.
 */
export const SPIKE_TOP = 6;

function drawSpike(ctx, x, y, tick) {
  for (let i = 0; i < 4; i++) {
    const bx = x + i * 4;
    ctx.fillStyle = '#c8c8d8';
    ctx.fillRect(bx + 1, y + 12, 2, 4);
    ctx.fillRect(bx + 1, y + 9, 2, 3);
    ctx.fillRect(bx + 1, y + 6, 2, 3);
    ctx.fillStyle = '#f4f4ff';
    ctx.fillRect(bx + 1, y + 6, 1, 6);
  }
  // a glint travelling along the row
  const g = Math.floor(tick / 10) % 8;
  if (g < 4) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + g * 4 + 1, y + 6, 2, 2);
  }
  ctx.fillStyle = '#6f6f8a';
  ctx.fillRect(x, y + 14, TILE, 2);
  ctx.fillStyle = '#4a4a60';
  ctx.fillRect(x, y + 15, TILE, 1);
}

/**
 * A crevasse: the ice world's version of the lava pool.
 *
 * Same tile, same death — molten rock in a glacier was simply absurd, and the
 * fix is what it looks like, not what it does. Meltwater under blue-white ice
 * reads as "do not step here" to anyone who has seen a frozen lake, and the
 * shelf edges say the hole has a bottom a long way down.
 */
function drawCrevasse(ctx, x, y, tick, tx) {
  const wave = Math.sin((x + tick * 0.9) / 11) * 1.2;
  ctx.fillStyle = '#0a1a34';
  ctx.fillRect(x, y + 2, TILE, TILE - 2);
  ctx.fillStyle = '#123a68';
  ctx.fillRect(x, y + 5, TILE, TILE - 5);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x, y + 3 + Math.round(wave), TILE, 3);
  ctx.fillStyle = '#bfe6ff';
  ctx.fillRect(x, y + 3 + Math.round(wave), TILE, 1);

  // broken shelf along the rim, so the edge does not read as a tidy pool
  const seed = hashNoise(tx, 11);
  ctx.fillStyle = '#dff2ff';
  ctx.fillRect(x, y, TILE, 2);
  ctx.fillStyle = '#9fc8e8';
  ctx.fillRect(x + Math.floor(seed * 8), y + 2, 3 + Math.floor(seed * 4), 1);

  // a floe drifting past, on its own clock per column
  const period = 90 + Math.floor(seed * 70);
  const age = (tick + Math.floor(seed * period)) % period;
  if (age < 30) {
    ctx.fillStyle = '#e8f6ff';
    ctx.fillRect(x + 2 + Math.round((age / 30) * 8), y + 7 + Math.round(wave), 4, 2);
  }
}

function drawLava(ctx, x, y, tick, tx) {
  const wave = Math.sin((x + tick * 1.6) / 9) * 1.5;
  ctx.fillStyle = '#8c1808';
  ctx.fillRect(x, y + 2, TILE, TILE - 2);
  ctx.fillStyle = '#d83018';
  ctx.fillRect(x, y + 4, TILE, TILE - 4);
  ctx.fillStyle = '#f87818';
  ctx.fillRect(x, y + 2 + Math.round(wave), TILE, 3);
  ctx.fillStyle = '#ffd048';
  ctx.fillRect(x, y + 2 + Math.round(wave), TILE, 1);

  // bubbles surfacing at their own pace per column
  const seed = hashNoise(tx, 3);
  const period = 70 + Math.floor(seed * 60);
  const age = (tick + Math.floor(seed * period)) % period;
  if (age < 22) {
    const t = age / 22;
    const bx = x + 3 + Math.floor(seed * 9);
    const by = y + 12 - Math.round(t * 9);
    const s = t > 0.75 ? 1 : 2;
    ctx.fillStyle = t > 0.75 ? '#ffe89a' : '#ffb040';
    ctx.fillRect(bx, by, s, s);
  }
  ctx.fillStyle = 'rgba(255,140,40,0.18)';
  ctx.fillRect(x, y, TILE, 2);
}

/**
 * One tile of a door. Doors are built several tiles wide and tall, and each
 * tile draws only its own slice — `edges` says which sides are the outside of
 * the door, so the stone surround, the hinges and the centre seam land on the
 * real boundaries instead of being repeated on every tile.
 *
 * The reason it is drawn this way at all: a one-tile door is 16 px tall and the
 * largest player is 43. Walking into a doorway you tower over does not read as
 * going through a door, it reads as a bug.
 */
function drawDoor(ctx, x, y, th, tick, open, edges) {
  const e = edges || { l: true, r: true, t: true, b: true };
  ctx.fillStyle = th.hardDark;
  ctx.fillRect(x, y, TILE, TILE);
  if (e.t) {
    ctx.fillStyle = th.hard;
    ctx.fillRect(x, y, TILE, 1);
  }

  const ix = x + (e.l ? 2 : 0);
  const iw = TILE - (e.l ? 2 : 0) - (e.r ? 2 : 0);
  const iy = y + (e.t ? 1 : 0);
  const ih = TILE - (e.t ? 1 : 0) - (e.b ? 1 : 0);
  ctx.fillStyle = '#3a2008';
  ctx.fillRect(ix, iy, iw, ih);
  ctx.fillStyle = '#7a4c20';
  ctx.fillRect(ix + 1, iy + 1, iw - 2, ih - (e.b ? 1 : 0));

  // planks, so a three-tile leaf does not read as one flat slab
  ctx.fillStyle = '#5c3410';
  for (let px = ix + 4; px < ix + iw - 2; px += 5) ctx.fillRect(px, iy + 1, 1, ih - 1);
  if (e.t) {
    ctx.fillStyle = '#9c6a30';
    ctx.fillRect(ix + 1, iy + 1, iw - 2, 1);
  }

  // The seam between the two leaves runs down the inside edge of each half.
  if (!e.r) {
    ctx.fillStyle = '#2a1806';
    ctx.fillRect(x + TILE - 1, iy, 1, ih);
  }

  ctx.fillStyle = '#c8c8d8';
  if (e.l) {
    ctx.fillRect(x + 3, y + 4, 2, 1);
    ctx.fillRect(x + 3, y + 11, 2, 1);
  }
  if (e.r) {
    ctx.fillRect(x + TILE - 5, y + 4, 2, 1);
    ctx.fillRect(x + TILE - 5, y + 11, 2, 1);
  }

  // Handles sit at the seam, and only on the middle row of a tall door.
  const glow = open && Math.floor(tick / 8) % 2 === 0;
  const middle = !e.t && !e.b;
  if (middle || (e.t && e.b)) {
    ctx.fillStyle = glow ? '#fff0a0' : '#ffd048';
    if (!e.r) ctx.fillRect(x + TILE - 4, y + 7, 2, 3);
    if (!e.l) ctx.fillRect(x + 2, y + 7, 2, 3);
    if (e.l && e.r) ctx.fillRect(x + 10, y + 9, 2, 2);
  }

  if (open) {
    ctx.fillStyle = 'rgba(255,224,120,0.12)';
    ctx.fillRect(x - 2, y - 2, TILE + 4, TILE + 4);
  }
}


/**
 * One splinter off a broken plank, in whichever of four orientations it is
 * currently tumbling through.
 *
 * The tumble is four stamped shapes rather than a real rotation because
 * `ctx.rotate` would hand us anti-aliased mush at this size, and everything
 * else in the game is whole pixels. `len` and `thick` are the caller's, so no
 * two shards off the same plank are the same piece of wood.
 */
export function drawSplinter(ctx, x, y, len, thick, frame, body, light, dark) {
  if (frame === 0 || frame === 2) {
    const w = frame === 0 ? len : thick;
    const h = frame === 0 ? thick : len;
    ctx.fillStyle = body;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = light;
    ctx.fillRect(x, y, frame === 0 ? w : 1, frame === 0 ? 1 : h);
    ctx.fillStyle = dark;
    ctx.fillRect(frame === 0 ? x : x + w - 1, frame === 0 ? y + h - 1 : y,
      frame === 0 ? w : 1, frame === 0 ? 1 : h);
    return;
  }
  // Edge-on: a staircase, shortened so a diagonal shard is not visibly bigger
  // than the same shard lying flat.
  const d = Math.max(2, Math.round(len * 0.7));
  ctx.fillStyle = body;
  for (let i = 0; i < d; i++) {
    ctx.fillRect(x + i, y + (frame === 1 ? i : d - 1 - i), 2, 2);
  }
  ctx.fillStyle = light;
  ctx.fillRect(x, y + (frame === 1 ? 0 : d - 1), 1, 1);
  ctx.fillStyle = dark;
  ctx.fillRect(x + d, y + (frame === 1 ? d - 1 : 0) + 1, 1, 1);
}

export function drawCoinSprite(ctx, x, y, tick) {
  const frames = [10, 6, 2, 6];
  const w = frames[Math.floor(tick / 6) % 4];
  const cx = x + 8;
  const left = cx - Math.floor(w / 2);
  ctx.fillStyle = '#a06800';
  ctx.fillRect(left, y + 1, w, 14);
  ctx.fillStyle = '#f0b000';
  ctx.fillRect(left, y + 2, w, 12);
  if (w > 3) {
    ctx.fillStyle = '#ffe070';
    ctx.fillRect(left + 1, y + 3, w - 2, 10);
    ctx.fillStyle = '#c88800';
    ctx.fillRect(left + Math.floor(w / 2), y + 5, 1, 6);
    ctx.fillStyle = '#fff8d0';
    ctx.fillRect(left + 1, y + 3, 1, 3);
  }
  // a sparkle that pops on the widest frame
  if (w === 10 && Math.floor(tick / 6) % 8 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx + 4, y + 1, 1, 3);
    ctx.fillRect(cx + 3, y + 2, 3, 1);
  }
}

/**
 * Draws a single map tile. `above` lets ground know whether to grow grass.
 */
/**
 * A crumbling platform. `progress` runs 0→1 while the player stands on it.
 *
 * The warning has to be *visible*, not merely fair — same rule as the piranha
 * plant: anything that can hurt you must show itself first. So it shakes harder
 * and the cracks open wider the closer it is to going, and by the end it is
 * obviously about to fail rather than technically signposted.
 */
function drawCrumble(ctx, x, y, th, tx, ty, progress) {
  const shake = progress > 0 ? Math.round(Math.sin(progress * 44) * progress * 1.6) : 0;
  const px = x + shake;
  ctx.fillStyle = th.brick;
  ctx.fillRect(px, y, TILE, TILE);
  ctx.fillStyle = th.brickLight;
  ctx.fillRect(px, y, TILE, 1);
  ctx.fillStyle = th.brickDark;
  ctx.fillRect(px, y + 15, TILE, 1);

  // Two cracks that open outwards from the middle as the timer runs down.
  const spread = Math.round(progress * 5);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(px + 7 - spread, y + 2, 1, 12);
  ctx.fillRect(px + 8 + spread, y + 4, 1, 10);
  if (progress > 0.55) {
    ctx.fillRect(px + 2, y + 6, 4, 1);
    ctx.fillRect(px + 11, y + 9, 3, 1);
  }
  // Dust from underneath once it is genuinely about to go.
  if (progress > 0.75) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px + 3, y + TILE, 2, 1);
    ctx.fillRect(px + 10, y + TILE, 3, 1);
  }
}

/** The switch block itself: a big button that stays pressed once it is hit. */
function drawSwitch(ctx, x, y, th, tick, pressed) {
  const drop = pressed ? 4 : 0;
  ctx.fillStyle = th.brickDark;
  ctx.fillRect(x, y + 10, TILE, 6);
  ctx.fillStyle = pressed ? '#5a6a8c' : '#7080b0';
  ctx.fillRect(x + 1, y + 4 + drop, TILE - 2, 10 - drop);
  ctx.fillStyle = pressed ? '#8090b8' : '#b0c0e8';
  ctx.fillRect(x + 1, y + 4 + drop, TILE - 2, 2);
  if (!pressed) {
    // A pulse, because a block you are supposed to hit has to ask for it.
    const lit = Math.floor(tick / 8) % 2 === 0;
    ctx.fillStyle = lit ? '#ffd048' : '#c08020';
    ctx.fillRect(x + 6, y + 7, 4, 4);
  }
}

/**
 * Hazard stripes painted into the lip of the ground tile beside a spike bed.
 *
 * Spikes sit flush in the floor and are the same pale grey as half the tilesets,
 * so at running speed the first thing that tells you they are there is losing a
 * power level. That is a surprise, not a puzzle — a hazard you can only learn by
 * dying is the one kind this game is not supposed to have. `side` is -1 when the
 * spikes are to the left, +1 to the right, so the marking sits on the edge you
 * are about to cross.
 */
function drawHazardEdge(ctx, x, y, side) {
  const sx = side > 0 ? x + TILE - 5 : x;
  ctx.fillStyle = '#f0c020';
  ctx.fillRect(sx, y, 5, 3);
  ctx.fillStyle = '#201808';
  for (let i = 0; i < 3; i++) ctx.fillRect(sx + (side > 0 ? i * 2 : i * 2 + 1), y, 1, 3);
}

export function drawTile(ctx, ch, x, y, themeName, tx, ty, tick, above, opts = {}) {
  const th = THEMES[themeName] || THEMES.grass;
  switch (ch) {
    case T.GROUND:
      drawGround(ctx, x, y, th, !isSolid(above), tx, ty);
      if (opts.warn) drawHazardEdge(ctx, x, y, opts.warn);
      break;
    case T.HARD: drawHard(ctx, x, y, th, tx, ty); break;
    case T.BRICK: drawBrick(ctx, x, y, th, tx, ty); break;
    case T.QCOIN:
    case T.QPOWER:
    case T.QSTAR: drawQuestion(ctx, x, y, tick); break;
    case T.USED: drawUsed(ctx, x, y, th); break;
    case T.NOTE: drawNote(ctx, x, y, tick, false); break;
    case T.PIPE_TL:
    case T.PIPE_TR:
    case T.PIPE_BL:
    case T.PIPE_BR: drawPipe(ctx, x, y, ch, th); break;
    case T.WARP_L:
    case T.WARP_R: drawWarpPipe(ctx, x, y, ch, th, tick); break;
    case T.VINE: drawVine(ctx, x, y, tx, ty, tick); break;
    case T.PLATFORM: drawPlatform(ctx, x, y, th); break;
    case T.CRUMBLE: drawCrumble(ctx, x, y, th, tx, ty, opts.crumble || 0); break;
    case T.SWITCH: drawSwitch(ctx, x, y, th, tick, opts.switchOn); break;
    case T.COIN: drawCoinSprite(ctx, x, y, tick); break;
    case T.SPIKE: drawSpike(ctx, x, y, tick); break;
    case T.LAVA:
      // The hazard is the same everywhere; only the ice world's picture of it
      // differs, because lava in a glacier is a joke the level did not intend.
      if (themeName === 'ice') drawCrevasse(ctx, x, y, tick, tx);
      else drawLava(ctx, x, y, tick, tx);
      break;
    case T.DOOR: drawDoor(ctx, x, y, th, tick, !!opts.doorOpen, opts.doorEdges); break;
    default: break;
  }
}
