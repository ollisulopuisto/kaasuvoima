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
  USED: 'u',
  COIN: 'o',
  PLATFORM: '-',
  PIPE_TL: '[',
  PIPE_TR: ']',
  PIPE_BL: '{',
  PIPE_BR: '}',
  SPIKE: '^',
  LAVA: 'W',
  GOAL: 'F',
  DOOR: 'D',
  NOTE: 'N',
};

const S = { solid: true };
const SEMI = { semi: true };

export const TILE_INFO = {
  [T.GROUND]: { ...S },
  [T.HARD]: { ...S },
  [T.BRICK]: { ...S, breakable: true, bumpable: true },
  [T.QCOIN]: { ...S, question: 'coin', bumpable: true },
  [T.QPOWER]: { ...S, question: 'power', bumpable: true },
  [T.USED]: { ...S, bumpable: true },
  [T.NOTE]: { ...S, note: true, bumpable: true },
  [T.PIPE_TL]: { ...S, pipe: true },
  [T.PIPE_TR]: { ...S, pipe: true },
  [T.PIPE_BL]: { ...S, pipe: true },
  [T.PIPE_BR]: { ...S, pipe: true },
  [T.PLATFORM]: { ...SEMI },
  [T.COIN]: { coin: true },
  [T.SPIKE]: { hazard: true },
  [T.LAVA]: { hazard: true },
  [T.GOAL]: { goal: true },
  [T.DOOR]: { door: true },
};

export const info = (ch) => TILE_INFO[ch] || {};
export const isSolid = (ch) => !!info(ch).solid;
export const isSemi = (ch) => !!info(ch).semi;

export const THEMES = {
  grass: {
    sky: ['#5c94fc', '#93c3ff'],
    ground: '#a05820', groundDark: '#6b3a12', groundTop: '#3ea23a', groundTopDark: '#25731f',
    brick: '#c8601c', brickDark: '#7a3410', brickLight: '#e8945c',
    hard: '#c8c8d8', hardDark: '#6f6f8a', hardLight: '#eaeaf6',
    pipe: '#3ea23a', pipeDark: '#1c6b1f', pipeLight: '#8fe04a',
    hill: '#2f8f3a', hillDark: '#1d6b28',
    cloud: '#ffffff',
  },
  desert: {
    sky: ['#f0a860', '#ffd9a0'],
    ground: '#d8a048', groundDark: '#9c6a24', groundTop: '#f0c060', groundTopDark: '#c08c30',
    brick: '#d8a040', brickDark: '#8c5c18', brickLight: '#f4cc84',
    hard: '#e0c090', hardDark: '#8c6a3c', hardLight: '#f6e2be',
    pipe: '#c88030', pipeDark: '#7c4a10', pipeLight: '#f0b060',
    hill: '#c89040', hillDark: '#9c6a24',
    cloud: '#fff0dc',
  },
  ice: {
    sky: ['#2c4c9c', '#8cb8e8'],
    ground: '#a8c8e8', groundDark: '#5c7ca8', groundTop: '#eaf6ff', groundTopDark: '#a8c8e8',
    brick: '#8cb0d8', brickDark: '#4c6c98', brickLight: '#c8e0f8',
    hard: '#dcecff', hardDark: '#7c9cc4', hardLight: '#ffffff',
    pipe: '#4cc0c0', pipeDark: '#1c7878', pipeLight: '#8ce8e8',
    hill: '#7c9cd0', hillDark: '#4c6c98',
    cloud: '#ffffff',
  },
  fortress: {
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

function drawGround(ctx, x, y, th, openAbove, tx, ty) {
  if (openAbove) {
    ctx.fillStyle = th.groundTop;
    ctx.fillRect(x, y, TILE, 5);
    ctx.fillStyle = th.groundTopDark;
    ctx.fillRect(x, y + 4, TILE, 2);
    ctx.fillStyle = th.ground;
    ctx.fillRect(x, y + 6, TILE, TILE - 6);
  } else {
    ctx.fillStyle = th.ground;
    ctx.fillRect(x, y, TILE, TILE);
  }
  ctx.fillStyle = th.groundDark;
  for (let i = 0; i < 5; i++) {
    const n = hashNoise(tx * 7 + i, ty * 13 + i * 3);
    const px = Math.floor(n * 14);
    const py = (openAbove ? 7 : 1) + Math.floor(hashNoise(ty + i, tx - i) * (openAbove ? 8 : 14));
    if (py < TILE - 1) ctx.fillRect(x + px, y + py, 2, 2);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(x, y + TILE - 1, TILE, 1);
  ctx.fillRect(x + TILE - 1, y, 1, TILE);
}

function drawBrick(ctx, x, y, th) {
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
}

function drawQuestion(ctx, x, y, tick) {
  const phase = Math.floor(tick / 8) % 4;
  const glow = phase === 0 ? '#ffe070' : phase === 2 ? '#e8a020' : '#f8c030';
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, TILE, TILE);
  bevel(ctx, x, y, TILE, TILE, '#ffe8a0', '#a05c10');
  ctx.fillStyle = '#7a3c08';
  // question mark
  ctx.fillRect(x + 5, y + 4, 6, 2);
  ctx.fillRect(x + 9, y + 6, 2, 2);
  ctx.fillRect(x + 7, y + 8, 3, 2);
  ctx.fillRect(x + 7, y + 12, 2, 2);
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
}

function drawHard(ctx, x, y, th) {
  ctx.fillStyle = th.hard;
  ctx.fillRect(x, y, TILE, TILE);
  bevel(ctx, x, y, TILE, TILE, th.hardLight, th.hardDark);
  ctx.fillStyle = th.hardDark;
  ctx.fillRect(x + 3, y + 3, 2, 2);
  ctx.fillRect(x + 11, y + 11, 2, 2);
}

function drawNote(ctx, x, y, tick, bumped) {
  const off = bumped ? 1 : 0;
  ctx.fillStyle = '#e8901c';
  ctx.fillRect(x, y + off, TILE, TILE - off);
  bevel(ctx, x, y + off, TILE, TILE - off, '#ffc060', '#8c4c08');
  ctx.fillStyle = '#fff4d8';
  ctx.fillRect(x + 9, y + 4 + off, 2, 7);
  ctx.fillRect(x + 6, y + 9 + off, 4, 3);
  ctx.fillRect(x + 9, y + 4 + off, 4, 2);
  void tick;
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
  }
  if (top) {
    ctx.fillStyle = th.pipe;
    ctx.fillRect(x, y, TILE, 6);
    ctx.fillStyle = left ? th.pipeLight : th.pipeDark;
    ctx.fillRect(left ? x + 2 : x + TILE - 5, y, 4, 6);
    ctx.fillStyle = th.pipeDark;
    ctx.fillRect(x, y, TILE, 1);
    ctx.fillRect(x, y + 5, TILE, 1);
  }
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
}

function drawSpike(ctx, x, y) {
  ctx.fillStyle = '#c8c8d8';
  for (let i = 0; i < 4; i++) {
    const bx = x + i * 4;
    ctx.fillRect(bx + 1, y + 12, 2, 4);
    ctx.fillRect(bx + 1, y + 9, 2, 3);
    ctx.fillRect(bx + 1, y + 6, 2, 3);
  }
  ctx.fillStyle = '#6f6f8a';
  ctx.fillRect(x, y + 14, TILE, 2);
}

function drawLava(ctx, x, y, tick) {
  const wave = Math.sin((x + tick * 1.6) / 9) * 1.5;
  ctx.fillStyle = '#d83018';
  ctx.fillRect(x, y + 2, TILE, TILE - 2);
  ctx.fillStyle = '#f87818';
  ctx.fillRect(x, y + 2 + Math.round(wave), TILE, 3);
  ctx.fillStyle = '#ffd048';
  ctx.fillRect(x, y + 2 + Math.round(wave), TILE, 1);
}

function drawDoor(ctx, x, y, th) {
  ctx.fillStyle = th.hardDark;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#4a2c10';
  ctx.fillRect(x + 2, y + 2, 12, 14);
  ctx.fillStyle = '#7a4c20';
  ctx.fillRect(x + 3, y + 3, 10, 13);
  ctx.fillStyle = '#ffd048';
  ctx.fillRect(x + 10, y + 9, 2, 2);
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
  }
}

/**
 * Draws a single map tile. `above` lets ground know whether to grow grass.
 */
export function drawTile(ctx, ch, x, y, themeName, tx, ty, tick, above) {
  const th = THEMES[themeName] || THEMES.grass;
  switch (ch) {
    case T.GROUND: drawGround(ctx, x, y, th, !isSolid(above), tx, ty); break;
    case T.HARD: drawHard(ctx, x, y, th); break;
    case T.BRICK: drawBrick(ctx, x, y, th); break;
    case T.QCOIN:
    case T.QPOWER: drawQuestion(ctx, x, y, tick); break;
    case T.USED: drawUsed(ctx, x, y, th); break;
    case T.NOTE: drawNote(ctx, x, y, tick, false); break;
    case T.PIPE_TL:
    case T.PIPE_TR:
    case T.PIPE_BL:
    case T.PIPE_BR: drawPipe(ctx, x, y, ch, th); break;
    case T.PLATFORM: drawPlatform(ctx, x, y, th); break;
    case T.COIN: drawCoinSprite(ctx, x, y, tick); break;
    case T.SPIKE: drawSpike(ctx, x, y); break;
    case T.LAVA: drawLava(ctx, x, y, tick); break;
    case T.DOOR: drawDoor(ctx, x, y, th); break;
    default: break;
  }
}
