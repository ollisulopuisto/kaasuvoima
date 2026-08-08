import { THEMES } from './tiles.js';
import { hashNoise } from '../core/utils.js';

/**
 * Parallax scenery behind the tilemap. `bg` picks the silhouette style,
 * the palette follows the level theme.
 */
export function drawBackdrop(ctx, bg, theme, camX, viewW, viewH, tick) {
  const th = THEMES[theme] || THEMES.grass;
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, th.sky[0]);
  grad.addColorStop(1, th.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);

  if (bg === 'none') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, viewW, viewH);
    // faint torch glow columns
    for (let i = 0; i < 6; i++) {
      const x = ((i * 96 - camX * 0.5) % (viewW + 96) + viewW + 96) % (viewW + 96) - 48;
      const flicker = 0.05 + 0.02 * Math.sin(tick / 7 + i);
      ctx.fillStyle = `rgba(255,180,80,${flicker})`;
      ctx.fillRect(x - 10, 0, 20, viewH);
    }
    return;
  }

  const near = -camX * 0.45;
  const far = -camX * 0.22;

  if (bg === 'factory') {
    // Pipe stacks and slow gears behind the machinery.
    ctx.fillStyle = th.hillDark;
    for (let i = -1; i < 8; i++) {
      const x = Math.round(far + i * 120);
      ctx.fillRect(x, viewH - 96, 26, 96);
      ctx.fillRect(x - 4, viewH - 100, 34, 6);
      ctx.fillRect(x + 44, viewH - 64, 20, 64);
      ctx.fillRect(x + 40, viewH - 68, 28, 6);
    }
    ctx.fillStyle = th.hill;
    for (let i = -1; i < 9; i++) {
      const cxg = Math.round(near + i * 104 + 40);
      const cyg = viewH - 58;
      const spin = tick * 0.02 + i;
      for (let t = 0; t < 8; t++) {
        const a = spin + (t * Math.PI) / 4;
        ctx.fillRect(Math.round(cxg + Math.cos(a) * 16) - 3, Math.round(cyg + Math.sin(a) * 16) - 3, 6, 6);
      }
      ctx.fillRect(cxg - 11, cyg - 11, 22, 22);
      ctx.fillStyle = th.hillDark;
      ctx.fillRect(cxg - 4, cyg - 4, 8, 8);
      ctx.fillStyle = th.hill;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, viewH - 26, viewW, 26);
    return;
  }

  if (bg === 'hills' || bg === 'dunes') {
    const round = bg === 'dunes';
    ctx.fillStyle = th.hillDark;
    for (let i = -1; i < 8; i++) {
      const x = Math.round(far + i * 128);
      hillShape(ctx, x, viewH - 40, 96, 44, round);
    }
    ctx.fillStyle = th.hill;
    for (let i = -1; i < 10; i++) {
      const x = Math.round(near + i * 96 + 24);
      hillShape(ctx, x, viewH - 24, 72, 30, round);
    }
  } else if (bg === 'peaks') {
    ctx.fillStyle = th.hillDark;
    for (let i = -1; i < 9; i++) {
      const x = Math.round(far + i * 112);
      peak(ctx, x, viewH - 30, 84, 74);
    }
    ctx.fillStyle = th.hill;
    for (let i = -1; i < 10; i++) {
      const x = Math.round(near + i * 88 + 30);
      peak(ctx, x, viewH - 18, 62, 52);
    }
  }

  // Clouds drift slowly and independently of the camera.
  ctx.fillStyle = th.cloud;
  for (let i = 0; i < 7; i++) {
    const seed = hashNoise(i * 13, 7);
    const y = 12 + Math.floor(seed * 52);
    const span = viewW + 120;
    const x = Math.round(((-camX * 0.12 - tick * 0.08 + i * 74 + seed * 60) % span + span) % span - 60);
    cloud(ctx, x, y, 1 + Math.floor(seed * 2));
  }
}

function hillShape(ctx, x, baseY, w, h, round) {
  if (round) {
    for (let i = 0; i < h; i++) {
      const t = i / h;
      const width = Math.round(w * (1 - t * t));
      ctx.fillRect(x + (w - width) / 2, baseY - i, width, 1);
    }
  } else {
    for (let i = 0; i < h; i++) {
      const width = Math.round(w * (1 - i / h) ** 0.7);
      ctx.fillRect(x + (w - width) / 2, baseY - i, width, 1);
    }
  }
}

function peak(ctx, x, baseY, w, h) {
  for (let i = 0; i < h; i++) {
    const width = Math.round(w * (1 - i / h));
    ctx.fillRect(x + (w - width) / 2, baseY - i, width, 1);
  }
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = Math.floor(h * 0.78); i < h; i++) {
    const width = Math.round(w * (1 - i / h));
    ctx.fillRect(x + (w - width) / 2, baseY - i, width, 1);
  }
  ctx.restore();
}

function cloud(ctx, x, y, size) {
  const s = size;
  ctx.fillRect(x, y + 3 * s, 26 * s, 5 * s);
  ctx.fillRect(x + 5 * s, y, 10 * s, 6 * s);
  ctx.fillRect(x + 14 * s, y + 2 * s, 8 * s, 4 * s);
}
