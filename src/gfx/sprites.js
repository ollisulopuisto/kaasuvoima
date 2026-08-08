/**
 * All artwork is drawn procedurally on the 320x240 back buffer with integer
 * rectangles, so it stays crisp pixel art without shipping any image files.
 */

const C = {
  ink: '#101018',
  skin: '#f0b890',
  skinDark: '#c07850',
  green: '#3ea23a',
  greenDark: '#1f6f26',
  greenLight: '#8fe04a',
  brown: '#8c4c18',
  brownDark: '#5a2c0c',
  tan: '#c88c40',
  white: '#f8f8f8',
  gas: '#a8e04a',
  gasDark: '#5c9c28',
  shell: '#3ea23a',
  shellDark: '#1c6b1f',
  rim: '#f8e8a0',
  purple: '#a04ca0',
  purpleDark: '#6a2c6a',
  gold: '#ffd048',
};

/** Runs `fn` with the horizontal axis mirrored around the sprite box. */
function flip(ctx, x, w, doFlip, fn) {
  if (!doFlip) {
    fn(x);
    return;
  }
  ctx.save();
  ctx.translate(x * 2 + w, 0);
  ctx.scale(-1, 1);
  fn(x);
  ctx.restore();
}

const PALETTES = {
  small: { cap: C.green, shirt: C.green, shirtDark: C.greenDark, pants: C.brown, pantsDark: C.brownDark },
  big: { cap: C.green, shirt: C.green, shirtDark: C.greenDark, pants: C.brown, pantsDark: C.brownDark },
  flower: { cap: C.white, shirt: C.white, shirtDark: '#c8c8d0', pants: C.green, pantsDark: C.greenDark },
  leaf: { cap: C.tan, shirt: C.tan, shirtDark: '#9c6a28', pants: C.brown, pantsDark: C.brownDark },
};

export const PLAYER_BOX = {
  small: { w: 12, h: 16 },
  big: { w: 14, h: 26 },
  duck: { w: 14, h: 16 },
};

function legs(ctx, x, y, w, pal, frame, running) {
  ctx.fillStyle = pal.pants;
  const spread = running ? 4 : 3;
  if (frame === 0) {
    ctx.fillRect(x + 2, y, spread, 3);
    ctx.fillRect(x + w - 2 - spread, y, spread, 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 1, y + 3, spread + 1, 2);
    ctx.fillRect(x + w - 2 - spread, y + 3, spread + 1, 2);
  } else if (frame === 1) {
    ctx.fillRect(x + 3, y, w - 6, 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 2, y + 3, w - 4, 2);
  } else {
    ctx.fillRect(x + 1, y, spread, 3);
    ctx.fillRect(x + w - 3 - spread, y + 1, spread, 2);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x, y + 3, spread + 2, 2);
    ctx.fillRect(x + w - 3 - spread, y + 3, spread, 2);
  }
}

/** Wagging raccoon tail, drawn behind the body (the sprite always faces +x). */
function tail(ctx, x, y, wag) {
  const dx = Math.round(Math.sin(wag) * 2);
  ctx.fillStyle = C.tan;
  ctx.fillRect(x - 4, y + 1, 5, 5);
  ctx.fillRect(x - 8, y - 1 + dx, 5, 5);
  ctx.fillRect(x - 11, y - 4 + dx * 2, 4, 5);
  ctx.fillStyle = C.brownDark;
  ctx.fillRect(x - 8, y + 3 + dx, 5, 1);
  ctx.fillRect(x - 11, y + dx * 2, 4, 1);
  ctx.fillRect(x - 11, y - 4 + dx * 2, 4, 1);
}

function ears(ctx, x, y, w) {
  ctx.fillStyle = C.tan;
  ctx.fillRect(x + 1, y - 2, 2, 3);
  ctx.fillRect(x + w - 3, y - 2, 2, 3);
  ctx.fillStyle = C.brownDark;
  ctx.fillRect(x + 1, y - 2, 1, 1);
  ctx.fillRect(x + w - 2, y - 2, 1, 1);
}

/**
 * @param {object} s  { power, facing, frame, state, ducking, tick, wag }
 */
export function drawPlayer(ctx, x, y, s) {
  const big = s.power !== 'small';
  const pal = PALETTES[s.power] || PALETTES.small;
  const ducking = s.ducking && big;
  const box = ducking ? PLAYER_BOX.duck : big ? PLAYER_BOX.big : PLAYER_BOX.small;
  const w = box.w;

  flip(ctx, x, w, s.facing < 0, (bx) => {
    const px = Math.round(bx);
    const py = Math.round(y);

    if (s.power === 'leaf') tail(ctx, px + (ducking ? 3 : 2), py + box.h - 9, s.wag || 0);

    if (!big) {
      // --- small (12x16) ---
      ctx.fillStyle = pal.cap;
      ctx.fillRect(px + 2, py, 8, 3);
      ctx.fillRect(px + 2, py + 3, 10, 1);
      ctx.fillStyle = C.skin;
      ctx.fillRect(px + 3, py + 4, 7, 5);
      ctx.fillStyle = C.skinDark;
      ctx.fillRect(px + 3, py + 7, 3, 2);
      ctx.fillStyle = C.ink;
      ctx.fillRect(px + 7, py + 5, 1, 2);
      ctx.fillStyle = pal.shirt;
      ctx.fillRect(px + 2, py + 9, 8, 3);
      ctx.fillStyle = C.skin;
      ctx.fillRect(px, py + 9, 2, 3);
      ctx.fillRect(px + 10, py + 9, 2, 3);
      ctx.fillStyle = pal.pants;
      ctx.fillRect(px + 3, py + 11, 6, 3);
      ctx.fillStyle = pal.pantsDark;
      ctx.fillRect(px + 3, py + 11, 6, 1);
      if (s.power === 'leaf') ears(ctx, px, py, 12);
      if (s.state === 'jump') {
        ctx.fillStyle = pal.pants;
        ctx.fillRect(px + 2, py + 14, 4, 2);
        ctx.fillRect(px + 7, py + 13, 4, 3);
      } else if (s.state === 'walk') {
        legs(ctx, px, py + 14, 12, pal, s.frame % 3, s.running);
      } else {
        ctx.fillStyle = pal.pants;
        ctx.fillRect(px + 3, py + 14, 2, 2);
        ctx.fillRect(px + 7, py + 14, 2, 2);
      }
      return;
    }

    if (ducking) {
      // --- crouching (14x16) ---
      ctx.fillStyle = pal.cap;
      ctx.fillRect(px + 2, py + 1, 9, 3);
      ctx.fillRect(px + 2, py + 4, 12, 1);
      ctx.fillStyle = C.skin;
      ctx.fillRect(px + 3, py + 5, 8, 5);
      ctx.fillStyle = C.ink;
      ctx.fillRect(px + 8, py + 6, 1, 2);
      ctx.fillStyle = pal.shirt;
      ctx.fillRect(px + 1, py + 10, 12, 3);
      ctx.fillStyle = pal.pants;
      ctx.fillRect(px + 2, py + 13, 10, 3);
      if (s.power === 'leaf') ears(ctx, px, py + 1, 14);
      return;
    }

    // --- big (14x26) ---
    ctx.fillStyle = pal.cap;
    ctx.fillRect(px + 3, py, 9, 4);
    ctx.fillRect(px + 2, py + 4, 12, 2);
    ctx.fillStyle = C.skin;
    ctx.fillRect(px + 3, py + 6, 9, 7);
    ctx.fillStyle = C.skinDark;
    ctx.fillRect(px + 3, py + 11, 4, 2);
    ctx.fillStyle = C.ink;
    ctx.fillRect(px + 8, py + 7, 2, 3);
    ctx.fillStyle = pal.shirt;
    ctx.fillRect(px + 2, py + 13, 10, 5);
    ctx.fillStyle = pal.shirtDark;
    ctx.fillRect(px + 2, py + 17, 10, 1);
    ctx.fillStyle = C.skin;
    ctx.fillRect(px - 1, py + 13, 3, 5);
    ctx.fillRect(px + 12, py + 13, 3, 5);
    ctx.fillStyle = pal.pants;
    ctx.fillRect(px + 2, py + 18, 10, 4);
    ctx.fillStyle = pal.pantsDark;
    ctx.fillRect(px + 2, py + 18, 10, 1);
    ctx.fillStyle = C.gold;
    ctx.fillRect(px + 4, py + 19, 1, 1);
    ctx.fillRect(px + 9, py + 19, 1, 1);
    if (s.power === 'leaf') ears(ctx, px + 1, py, 12);

    if (s.state === 'jump') {
      ctx.fillStyle = pal.pants;
      ctx.fillRect(px + 2, py + 22, 4, 3);
      ctx.fillRect(px + 8, py + 21, 5, 4);
      ctx.fillStyle = C.ink;
      ctx.fillRect(px + 1, py + 24, 5, 2);
    } else if (s.state === 'walk') {
      legs(ctx, px, py + 22, 14, pal, s.frame % 3, s.running);
    } else {
      ctx.fillStyle = pal.pants;
      ctx.fillRect(px + 3, py + 22, 3, 2);
      ctx.fillRect(px + 8, py + 22, 3, 2);
      ctx.fillStyle = C.ink;
      ctx.fillRect(px + 2, py + 24, 4, 2);
      ctx.fillRect(px + 8, py + 24, 4, 2);
    }
  });
}

/* ------------------------------- enemies ------------------------------- */

export function drawWalker(ctx, x, y, frame, facing, squashed) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (squashed) {
    ctx.fillStyle = '#8c5c28';
    ctx.fillRect(px + 1, py + 11, 14, 5);
    ctx.fillStyle = '#5a3410';
    ctx.fillRect(px + 1, py + 14, 14, 2);
    return;
  }
  flip(ctx, px, 16, facing < 0, (bx) => {
    ctx.fillStyle = '#a06828';
    ctx.fillRect(bx + 2, py + 3, 12, 9);
    ctx.fillRect(bx + 1, py + 5, 14, 6);
    ctx.fillStyle = '#7a4c18';
    ctx.fillRect(bx + 2, py + 10, 12, 2);
    ctx.fillStyle = C.white;
    ctx.fillRect(bx + 3, py + 6, 4, 4);
    ctx.fillRect(bx + 9, py + 6, 4, 4);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 5, py + 7, 2, 3);
    ctx.fillRect(bx + 10, py + 7, 2, 3);
    ctx.fillRect(bx + 3, py + 4, 4, 2);
    ctx.fillRect(bx + 9, py + 4, 4, 2);
    // feet
    const swap = frame % 2 === 0;
    ctx.fillStyle = '#4c2c08';
    ctx.fillRect(bx + (swap ? 0 : 2), py + 12, 6, 4);
    ctx.fillRect(bx + (swap ? 10 : 8), py + 12, 6, 4);
    // trailing gas
    ctx.fillStyle = 'rgba(168,224,74,0.5)';
    const puff = (frame % 4) + 1;
    ctx.fillRect(bx - 3 - puff, py + 9, puff + 2, 3);
  });
}

export function drawShell(ctx, x, y, frame, facing, mode) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (mode === 'shell' || mode === 'sliding') {
    const spin = mode === 'sliding' ? Math.floor(frame / 2) % 4 : 0;
    ctx.fillStyle = C.shell;
    ctx.fillRect(px + 1, py + 2, 14, 11);
    ctx.fillStyle = C.shellDark;
    ctx.fillRect(px + 1, py + 10, 14, 3);
    ctx.fillStyle = C.rim;
    ctx.fillRect(px, py + 11, 16, 3);
    ctx.fillStyle = C.shellDark;
    for (let i = 0; i < 3; i++) {
      const sx = px + 3 + ((i * 4 + spin) % 11);
      ctx.fillRect(sx, py + 5, 2, 3);
    }
    return;
  }
  flip(ctx, px, 16, facing < 0, (bx) => {
    // shell
    ctx.fillStyle = C.shell;
    ctx.fillRect(bx + 1, py + 8, 12, 12);
    ctx.fillStyle = C.shellDark;
    ctx.fillRect(bx + 2, py + 12, 10, 3);
    ctx.fillStyle = C.rim;
    ctx.fillRect(bx + 1, py + 18, 12, 3);
    // head
    ctx.fillStyle = '#f0d060';
    ctx.fillRect(bx + 8, py + 1, 7, 7);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 12, py + 3, 2, 2);
    ctx.fillStyle = '#c8a030';
    ctx.fillRect(bx + 8, py + 6, 6, 2);
    // feet
    ctx.fillStyle = '#f0d060';
    const swap = Math.floor(frame / 4) % 2 === 0;
    ctx.fillRect(bx + (swap ? 1 : 3), py + 20, 5, 4);
    ctx.fillRect(bx + (swap ? 8 : 6), py + 20, 5, 4);
  });
}

export function drawFlyer(ctx, x, y, frame, facing) {
  const px = Math.round(x);
  const py = Math.round(y);
  const flap = Math.floor(frame / 4) % 2;
  ctx.fillStyle = C.white;
  ctx.fillRect(px - 4, py + (flap ? 1 : 5), 6, 5);
  ctx.fillRect(px + 14, py + (flap ? 1 : 5), 6, 5);
  ctx.fillStyle = '#c8c8d8';
  ctx.fillRect(px - 4, py + (flap ? 5 : 9), 6, 1);
  ctx.fillRect(px + 14, py + (flap ? 5 : 9), 6, 1);
  drawWalker(ctx, px, py, frame, facing, false);
}

export function drawPlant(ctx, x, y, frame) {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = C.greenDark;
  ctx.fillRect(px + 5, py + 10, 6, 22);
  ctx.fillStyle = C.green;
  ctx.fillRect(px + 6, py + 10, 3, 22);
  const open = Math.floor(frame / 12) % 2 === 0;
  ctx.fillStyle = '#e04040';
  ctx.fillRect(px + 1, py, 14, 11);
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(px + 3, py + 2, 3, 3);
  ctx.fillRect(px + 10, py + 2, 3, 3);
  if (open) {
    ctx.fillStyle = '#701010';
    ctx.fillRect(px + 3, py + 5, 10, 4);
    ctx.fillStyle = C.white;
    for (let i = 0; i < 4; i++) ctx.fillRect(px + 3 + i * 3, py + 5, 2, 2);
  } else {
    ctx.fillStyle = '#a02020';
    ctx.fillRect(px + 2, py + 6, 12, 3);
  }
}

export function drawBoss(ctx, x, y, frame, facing, hurt) {
  const px = Math.round(x);
  const py = Math.round(y);
  const body = hurt && Math.floor(frame / 2) % 2 ? '#e07070' : C.purple;
  flip(ctx, px, 32, facing < 0, (bx) => {
    ctx.fillStyle = body;
    ctx.fillRect(bx + 2, py + 6, 28, 24);
    ctx.fillRect(bx + 6, py + 2, 20, 8);
    ctx.fillStyle = C.purpleDark;
    ctx.fillRect(bx + 2, py + 25, 28, 5);
    ctx.fillStyle = C.white;
    ctx.fillRect(bx + 8, py + 8, 7, 6);
    ctx.fillRect(bx + 18, py + 8, 7, 6);
    ctx.fillStyle = C.ink;
    ctx.fillRect(bx + 11, py + 10, 3, 4);
    ctx.fillRect(bx + 21, py + 10, 3, 4);
    ctx.fillRect(bx + 8, py + 6, 7, 2);
    ctx.fillRect(bx + 18, py + 6, 7, 2);
    // mouth
    ctx.fillStyle = '#401040';
    ctx.fillRect(bx + 10, py + 18, 13, 5);
    ctx.fillStyle = C.white;
    for (let i = 0; i < 4; i++) ctx.fillRect(bx + 11 + i * 3, py + 18, 2, 2);
    // crown
    ctx.fillStyle = C.gold;
    ctx.fillRect(bx + 8, py - 2, 16, 4);
    ctx.fillRect(bx + 8, py - 5, 3, 3);
    ctx.fillRect(bx + 15, py - 6, 3, 4);
    ctx.fillRect(bx + 21, py - 5, 3, 3);
    // feet
    const swap = Math.floor(frame / 6) % 2 === 0;
    ctx.fillStyle = C.purpleDark;
    ctx.fillRect(bx + (swap ? 1 : 3), py + 28, 10, 4);
    ctx.fillRect(bx + (swap ? 21 : 19), py + 28, 10, 4);
  });
}

/* -------------------------------- items -------------------------------- */

export function drawItem(ctx, kind, x, y, tick) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (kind === 'bean' || kind === 'oneup') {
    const base = kind === 'oneup' ? '#40c840' : '#c8e858';
    const dark = kind === 'oneup' ? '#1c7c1c' : '#88a828';
    const light = kind === 'oneup' ? '#90e890' : '#e8f8a0';
    // fat kidney bean
    const rows = [[4, 4, 8], [5, 2, 12], [6, 1, 14], [7, 1, 14],
      [8, 1, 14], [9, 2, 12], [10, 2, 12], [11, 3, 10], [12, 5, 6]];
    ctx.fillStyle = dark;
    for (const [ry, rx, rw] of rows) ctx.fillRect(px + rx - 1, py + ry + 1, rw + 2, 1);
    ctx.fillStyle = base;
    for (const [ry, rx, rw] of rows) ctx.fillRect(px + rx, py + ry, rw, 1);
    ctx.fillStyle = light;
    ctx.fillRect(px + 4, py + 6, 4, 2);
    ctx.fillRect(px + 3, py + 8, 2, 1);
    ctx.fillStyle = dark;
    ctx.fillRect(px + 9, py + 9, 4, 2);
    return;
  }
  if (kind === 'flower') {
    const phase = Math.floor(tick / 8) % 2;
    ctx.fillStyle = C.greenDark;
    ctx.fillRect(px + 7, py + 9, 2, 7);
    ctx.fillStyle = C.green;
    ctx.fillRect(px + 2, py + 11, 5, 2);
    ctx.fillStyle = phase ? C.gas : C.greenLight;
    ctx.fillRect(px + 4, py + 1, 8, 8);
    ctx.fillRect(px + 2, py + 3, 12, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 6, py + 3, 4, 4);
    ctx.fillStyle = C.ink;
    ctx.fillRect(px + 6, py + 4, 1, 1);
    ctx.fillRect(px + 9, py + 4, 1, 1);
    return;
  }
  if (kind === 'leaf') {
    const sway = Math.round(Math.sin(tick / 10) * 2);
    const ox = px + sway;
    // A pointed leaf leaning right, with a stem and a midrib.
    const rows = [[1, 8, 4], [2, 6, 7], [3, 5, 9], [4, 4, 10], [5, 3, 11],
      [6, 3, 10], [7, 3, 9], [8, 4, 7], [9, 5, 5], [10, 6, 3]];
    ctx.fillStyle = '#9c6a28';
    for (const [ry, rx, rw] of rows) ctx.fillRect(ox + rx - 1, py + ry, rw + 2, 1);
    ctx.fillStyle = C.tan;
    for (const [ry, rx, rw] of rows) ctx.fillRect(ox + rx, py + ry, rw, 1);
    ctx.fillStyle = '#e8b870';
    ctx.fillRect(ox + 7, py + 3, 4, 1);
    ctx.fillRect(ox + 6, py + 4, 4, 1);
    ctx.fillStyle = '#9c6a28';
    for (let i = 0; i < 8; i++) ctx.fillRect(ox + 5 + Math.floor(i * 0.7), py + 9 - i, 1, 1);
    ctx.fillRect(ox + 5, py + 10, 2, 4);
    return;
  }
  if (kind === 'star') {
    ctx.fillStyle = Math.floor(tick / 4) % 2 ? '#fff070' : '#ffb020';
    ctx.fillRect(px + 6, py + 1, 4, 14);
    ctx.fillRect(px + 1, py + 6, 14, 4);
    ctx.fillRect(px + 3, py + 3, 10, 10);
  }
}

export function drawFart(ctx, x, y, tick) {
  const px = Math.round(x);
  const py = Math.round(y);
  const p = Math.floor(tick / 4) % 2;
  ctx.fillStyle = 'rgba(140,220,80,0.9)';
  ctx.fillRect(px + 1, py + 1, 6, 6);
  ctx.fillRect(px, py + 2, 8, 4);
  ctx.fillRect(px + 2, py, 4, 8);
  ctx.fillStyle = 'rgba(232,255,180,0.9)';
  ctx.fillRect(px + 2 + p, py + 2, 2, 2);
}

export function drawGasPuff(ctx, x, y, life, size) {
  const a = Math.max(0, Math.min(1, life));
  ctx.fillStyle = `rgba(150,220,90,${0.5 * a})`;
  const s = Math.round(size);
  ctx.fillRect(Math.round(x) - s, Math.round(y) - s, s * 2, s * 2);
  ctx.fillStyle = `rgba(210,255,150,${0.4 * a})`;
  ctx.fillRect(Math.round(x) - s + 1, Math.round(y) - s + 1, s, s);
}

/* ------------------------------ level props ---------------------------- */

const CARD_ICONS = ['bean', 'flower', 'star'];

export function drawGoal(ctx, x, y, height, cardIndex, held) {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = '#c8c8d8';
  ctx.fillRect(px + 6, py, 4, height);
  ctx.fillStyle = '#8a8aa0';
  ctx.fillRect(px + 9, py, 1, height);
  ctx.fillStyle = '#f0f0ff';
  ctx.fillRect(px + 2, py - 4, 12, 4);
  if (!held) {
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(px, py + 6, 16, 16);
    ctx.fillStyle = '#303048';
    ctx.fillRect(px, py + 6, 16, 1);
    ctx.fillRect(px, py + 21, 16, 1);
    ctx.fillRect(px, py + 6, 1, 16);
    ctx.fillRect(px + 15, py + 6, 1, 16);
    drawItem(ctx, CARD_ICONS[cardIndex % 3], px, py + 6, 0);
  }
}

export function drawCardIcon(ctx, kind, x, y) {
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(x, y, 16, 16);
  ctx.fillStyle = '#303048';
  ctx.fillRect(x, y, 16, 1);
  ctx.fillRect(x, y + 15, 16, 1);
  ctx.fillRect(x, y, 1, 16);
  ctx.fillRect(x + 15, y, 1, 16);
  drawItem(ctx, kind, x, y, 0);
}

export function drawBrickShard(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), 6, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(Math.round(x), Math.round(y) + 4, 6, 2);
}

export { C as SPRITE_COLORS };
