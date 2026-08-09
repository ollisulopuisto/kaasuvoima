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

function drawBrick(ctx, x, y, th, tx, ty) {
  ctx.fillStyle = th.brick;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = th.brickDark;
  ctx.fillRect(x, y + 7, TILE, 1);
  ctx.fillRect(x, y + 15, TILE, 1);
  ctx.fillRect(x + 3, y, 1, 7);
  ctx.fillRect(x + 11, y + 8, 1, 7);
  ctx.fillStyle = th.brickLight;
  ctx.fillRect(x, y, TILE, 1);
  ctx.fillRect(x, y + 8, TILE, 1);
  ctx.fillRect(x + 4, y + 1, 1, 6);
  ctx.fillRect(x + 12, y + 9, 1, 6);
  // a hairline crack on some of them, so a wall is not four copies of one tile
  const n = hashNoise(tx * 3, ty * 5);
  if (n > 0.66) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    const cx = x + 5 + Math.floor(n * 6);
    ctx.fillRect(cx, y + 2, 1, 2);
    ctx.fillRect(cx + 1, y + 4, 1, 2);
    if (n > 0.88) ctx.fillRect(cx + 1, y + 10, 1, 4);
  }
}

function drawQuestion(ctx, x, y, tick) {
  const phase = Math.floor(tick / 8) % 4;
  const glow = phase === 0 ? '#ffe070' : phase === 2 ? '#e8a020' : '#f8c030';
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, TILE, TILE);
  bevel(ctx, x, y, TILE, TILE, '#ffe8a0', '#a05c10');

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

  ctx.fillStyle = '#7a3c08';
  ctx.fillRect(x + 5, y + 4, 6, 2);
  ctx.fillRect(x + 9, y + 6, 2, 2);
  ctx.fillRect(x + 7, y + 8, 3, 2);
  ctx.fillRect(x + 7, y + 12, 2, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(x + 5, y + 3, 6, 1);
  ctx.fillStyle = '#a05c10';
  ctx.fillRect(x + 1, y + 1, 1, 1);
  ctx.fillRect(x + 14, y + 1, 1, 1);
  ctx.fillRect(x + 1, y + 14, 1, 1);
  ctx.fillRect(x + 14, y + 14, 1, 1);
}

function drawUsed(ctx, x, y, th) {
  ctx.fillStyle = th.brickDark;
  ctx.fillRect(x, y, TILE, TILE);
  bevel(ctx, x, y, TILE, TILE, th.brick, '#3a1c06');
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + 3, y + 3, 10, 10);
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

function drawPipe(ctx, x, y, ch, th) {
  const top = ch === T.PIPE_TL || ch === T.PIPE_TR;
  const left = ch === T.PIPE_TL || ch === T.PIPE_BL;
  ctx.fillStyle = th.pipe;
  ctx.fillRect(x, y, TILE, TILE);
  if (left) {
    ctx.fillStyle = th.pipeLight;
    ctx.fillRect(x + (top ? 2 : 3), y, 3, TILE);
    ctx.fillStyle = th.pipeDark;
    ctx.fillRect(x, y, 2, TILE);
  } else {
    ctx.fillStyle = th.pipeDark;
    ctx.fillRect(x + TILE - 4, y, 4, TILE);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + TILE - 1, y, 1, TILE);
  }
  if (top) {
    ctx.fillStyle = th.pipe;
    ctx.fillRect(x, y, TILE, 6);
    ctx.fillStyle = left ? th.pipeLight : th.pipeDark;
    ctx.fillRect(left ? x + 2 : x + TILE - 5, y, 4, 6);
    ctx.fillStyle = th.pipeDark;
    ctx.fillRect(x, y, TILE, 1);
    ctx.fillRect(x, y + 5, TILE, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y + 1, TILE, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';           // the dark throat of the pipe
    ctx.fillRect(x, y + 6, TILE, 2);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, y + 7, TILE, 1);
  }
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
  ctx.fillRect(x, y + 6, TILE, 2);
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

function drawDoor(ctx, x, y, th, tick, open) {
  ctx.fillStyle = th.hardDark;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = th.hard;
  ctx.fillRect(x, y, TILE, 1);
  ctx.fillStyle = '#3a2008';
  ctx.fillRect(x + 2, y + 1, 12, 15);
  ctx.fillStyle = '#7a4c20';
  ctx.fillRect(x + 3, y + 2, 10, 14);
  ctx.fillStyle = '#5c3410';
  ctx.fillRect(x + 7, y + 2, 1, 14);
  ctx.fillStyle = '#9c6a30';
  ctx.fillRect(x + 3, y + 2, 10, 1);
  ctx.fillStyle = '#c8c8d8';                      // hinges
  ctx.fillRect(x + 3, y + 4, 2, 1);
  ctx.fillRect(x + 3, y + 12, 2, 1);
  const glow = open && Math.floor(tick / 8) % 2 === 0;
  ctx.fillStyle = glow ? '#fff0a0' : '#ffd048';   // handle
  ctx.fillRect(x + 10, y + 9, 2, 2);
  if (open) {
    ctx.fillStyle = 'rgba(255,224,120,0.12)';
    ctx.fillRect(x - 2, y - 2, TILE + 4, TILE + 4);
  }
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

export function drawTile(ctx, ch, x, y, themeName, tx, ty, tick, above, opts = {}) {
  const th = THEMES[themeName] || THEMES.grass;
  switch (ch) {
    case T.GROUND: drawGround(ctx, x, y, th, !isSolid(above), tx, ty); break;
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
    case T.LAVA: drawLava(ctx, x, y, tick, tx); break;
    case T.DOOR: drawDoor(ctx, x, y, th, tick, !!opts.doorOpen); break;
    default: break;
  }
}
