/**
 * The four bosses. They are one file rather than four because they are one
 * drawing with a colour swap — only world 1's boxer is drawn from scratch, and
 * he only exists because the shared body would not read as a boxer.
 *
 * The spines come from the enemy file: a boss and a piikkiukko say "do not
 * stomp this" with the same row of points on purpose, and two copies of that
 * drawing would eventually stop matching.
 */

import { C, flip } from './palette.js';
import { drawSpines } from './enemies.js';

/**
 * World 1's boss, to the lead designer's specification: a boxer.
 *
 * The gloves are the whole character, so they are drawn biggest, brightest and
 * furthest forward, and they alternate — one guarding the chin, one cocked to
 * throw. Everything else (crownless head, mouthguard, taped wrists) exists to
 * make the gloves read as gloves rather than as red blobs.
 */
function drawBoxerBoss(r, bx, py, body, dark, frame) {
  const jab = Math.floor(frame / 6) % 2 === 0;

  // stance: knees bent, one foot back
  r(bx + (jab ? 4 : 6), py + 27, 9, 5);
  r(bx + (jab ? 19 : 17), py + 27, 9, 5);

  r(bx + 5, py + 8, 22, 20);          // torso
  r(bx + 8, py + 1, 16, 9);           // head, no crown — this one fights for it

  // championship belt, the only gold on him
  const gold = '#f0c040';
  r(bx + 5, py + 21, 22, 4, gold);

  // brows down, eyes narrowed: he is not pleased to see you
  r(bx + 10, py + 4, 5, 4, '#ffffff');
  r(bx + 17, py + 4, 5, 4, '#ffffff');
  r(bx + 12, py + 5, 3, 3, '#101018');
  r(bx + 18, py + 5, 3, 3, '#101018');
  r(bx + 9, py + 2, 7, 2, dark);
  r(bx + 16, py + 2, 7, 2, dark);

  // mouthguard
  r(bx + 12, py + 9, 8, 3, '#e8e0c0');

  // taped wrists, then the gloves themselves
  r(bx + (jab ? 25 : 21), py + 13, 4, 4, '#e8e0c0');
  r(bx + 2, py + 17, 4, 4, '#e8e0c0');

  const glove = '#e03828';
  const gloveDark = '#8c1c10';
  // lead glove: out in front when jabbing, tucked when guarding
  r(bx + (jab ? 26 : 22), py + 10, 7, 8, glove);
  r(bx + (jab ? 26 : 22), py + 16, 7, 2, gloveDark);
  r(bx + (jab ? 27 : 23), py + 11, 3, 2, '#f07868');
  // rear glove, held at the chin
  r(bx + 1, py + 15, 7, 8, glove);
  r(bx + 1, py + 21, 7, 2, gloveDark);
  r(bx + 2, py + 16, 3, 2, '#f07868');
}

/**
 * `spines` is 0..1: how far the boss's back spines are out. Drawn here rather
 * than by the entity so a boss is one picture — the spines have to scale and
 * flash with the body they belong to, and the giant scales by three.
 */
export function drawBoss(ctx, x, y, frame, facing, hurt, variant = 0, scale = 1, spines = 0) {
  const px = Math.round(x);
  const py = Math.round(y);
  const bodyColors = ['#a04ca0', '#3c7ad0', '#2fa06a', '#c85a20'];
  const darkColors = ['#6a2c6a', '#24528c', '#1c6a46', '#8c3a0c'];
  const body = hurt && Math.floor(frame / 2) % 2 ? '#e07070' : bodyColors[variant % 4];
  const dark = darkColors[variant % 4];
  const S = scale;
  const r = (rx, ry, rw, rh, color) => {
    if (color) ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(rx * S), Math.round(ry * S), Math.round(rw * S), Math.round(rh * S));
  };

  if (variant === 0) {
    ctx.save();
    flip(ctx, px, 32 * S, facing < 0, (bx) => {
      ctx.translate(bx - bx * S, py - py * S);
      ctx.fillStyle = body;
      drawBoxerBoss((rx, ry, rw, rh, color) => {
        // The hurt flash has to win over every local colour, or a boss taking a
        // hit would flash everywhere except his gloves.
        r(rx, ry, rw, rh, hurt && Math.floor(frame / 2) % 2 ? body : color);
      }, bx, py, body, dark, frame);
    });
    ctx.restore();
    bossSpines(ctx, px, py, S, spines, frame);
    return;
  }

  ctx.save();
  flip(ctx, px, 32 * S, facing < 0, (bx) => {
    ctx.translate(bx - bx * S, py - py * S);   // scale about the sprite origin
    ctx.fillStyle = body;
    r(bx + 2, py + 6, 28, 24);
    r(bx + 6, py + 2, 20, 8);
    ctx.fillStyle = dark;
    r(bx + 2, py + 25, 28, 5);
    ctx.fillStyle = C.white;
    r(bx + 8, py + 8, 7, 6);
    r(bx + 18, py + 8, 7, 6);
    ctx.fillStyle = C.ink;
    r(bx + 11, py + 10, 3, 4);
    r(bx + 21, py + 10, 3, 4);
    r(bx + 8, py + 6, 7, 2);
    r(bx + 18, py + 6, 7, 2);
    ctx.fillStyle = '#401040';
    r(bx + 10, py + 18, 13, 5);
    ctx.fillStyle = C.white;
    for (let i = 0; i < 4; i++) r(bx + 11 + i * 3, py + 18, 2, 2);
    ctx.fillStyle = C.gold;
    r(bx + 8, py - 2, 16, 4);
    r(bx + 8, py - 5, 3, 3);
    r(bx + 15, py - 6, 3, 4);
    r(bx + 21, py - 5, 3, 3);
    const swap = Math.floor(frame / 6) % 2 === 0;
    ctx.fillStyle = dark;
    r(bx + (swap ? 1 : 3), py + 28, 10, 4);
    r(bx + (swap ? 21 : 19), py + 28, 10, 4);
  });
  ctx.restore();
  bossSpines(ctx, px, py, S, spines, frame);
}

/**
 * Along the top of the boss's *hitbox*, not the top of its artwork: what the
 * player can see is then exactly what a stomp would land on.
 */
function bossSpines(ctx, px, py, scale, out, frame) {
  drawSpines(ctx, px + 1, py, Math.round(30 * scale), out, frame, out < 1, 8 * scale);
}
