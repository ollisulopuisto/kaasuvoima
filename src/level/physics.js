import { TILE, isSolid, isSemi } from '../gfx/tiles.js';

/*
 * Gravity, straight off the SMB3 disassembly (PRG/prg008.asm). Velocity there
 * is 4.4 fixed point, so a raw byte divided by 16 is pixels per frame at 60 Hz
 * — the same unit this engine already uses.
 *
 * The low gravity is not simply "the jump button is held": it also requires
 * still rising faster than 2 px/frame. Once you slow past that, holding the
 * button stops helping, which is what gives the original its crisp apex.
 */
export const GRAVITY = 0.3125;              // $05
export const GRAVITY_HELD = 0.0625;         // $01
export const GRAVITY_HELD_CUTOFF = -2.0;    // -$20
export const TERMINAL = 4.0;                // $40

/**
 * Moves an entity horizontally and pushes it out of solid tiles.
 * @returns true when a wall was hit.
 */
export function moveX(entity, level) {
  entity.x += entity.vx;
  if (entity.noclip) return false;

  const top = Math.floor(entity.y / TILE);
  const bottom = Math.floor((entity.y + entity.h - 1) / TILE);
  let hit = false;

  if (entity.vx > 0) {
    const tx = Math.floor((entity.x + entity.w - 1) / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      if (isSolid(level.tileAt(tx, ty))) {
        entity.x = tx * TILE - entity.w;
        hit = true;
        break;
      }
    }
  } else if (entity.vx < 0) {
    const tx = Math.floor(entity.x / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      if (isSolid(level.tileAt(tx, ty))) {
        entity.x = (tx + 1) * TILE;
        hit = true;
        break;
      }
    }
  }

  // Level edges are always walls.
  if (entity.x < 0) {
    entity.x = 0;
    hit = true;
  }
  const maxX = level.widthPx - entity.w;
  if (entity.x > maxX) {
    entity.x = maxX;
    hit = true;
  }

  if (hit) entity.vx = 0;
  return hit;
}

/**
 * Moves an entity vertically. `onHeadBump(tx, ty)` fires for every solid tile
 * the entity's head runs into.
 * @returns { ground, ceiling }
 */
export function moveY(entity, level, { onHeadBump = null, dropThrough = false } = {}) {
  const prevBottom = entity.y + entity.h;
  entity.y += entity.vy;
  const result = { ground: false, ceiling: false };
  if (entity.noclip) {
    entity.onGround = false;
    return result;
  }

  const left = Math.floor(entity.x / TILE);
  const right = Math.floor((entity.x + entity.w - 1) / TILE);

  if (entity.vy >= 0) {
    const ty = Math.floor((entity.y + entity.h - 1) / TILE);
    for (let tx = left; tx <= right; tx++) {
      const ch = level.tileAt(tx, ty);
      const solid = isSolid(ch);
      const semi = !solid && isSemi(ch) && !dropThrough && prevBottom <= ty * TILE + 1;
      if (solid || semi) {
        entity.y = ty * TILE - entity.h;
        entity.vy = 0;
        result.ground = true;
        break;
      }
    }
  } else {
    const ty = Math.floor(entity.y / TILE);
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(level.tileAt(tx, ty))) {
        entity.y = (ty + 1) * TILE;
        entity.vy = 0;
        result.ceiling = true;
        if (onHeadBump) onHeadBump(tx, ty);
        break;
      }
    }
  }

  /*
   * Being on the ground is a question about where you are, not about whether
   * you happened to land this frame.
   *
   * Resolving a landing puts the feet exactly on the tile boundary, which means
   * the body's last pixel sits one pixel *above* the floor tile. A single frame
   * of gravity moves less than a pixel, so a collision test alone reports "in
   * the air" for three frames out of four while the player is standing still —
   * and every jump pressed on one of those frames silently disappears.
   */
  entity.onGround = result.ground || (entity.vy >= 0 && footingBelow(entity, level, dropThrough));
  return result;
}

/** True when the tile row directly under the entity's feet is standable. */
function footingBelow(entity, level, dropThrough) {
  const ty = Math.floor((entity.y + entity.h) / TILE);
  const left = Math.floor(entity.x / TILE);
  const right = Math.floor((entity.x + entity.w - 1) / TILE);
  for (let tx = left; tx <= right; tx++) {
    const ch = level.tileAt(tx, ty);
    if (isSolid(ch)) return true;
    if (!dropThrough && isSemi(ch) && entity.y + entity.h <= ty * TILE + 1) return true;
  }
  return false;
}

/** True when there is solid or semi-solid footing just below the given box. */
export function footingAhead(level, x, y, w, h) {
  const ty = Math.floor((y + h + 1) / TILE);
  const tx0 = Math.floor(x / TILE);
  const tx1 = Math.floor((x + w - 1) / TILE);
  for (let tx = tx0; tx <= tx1; tx++) {
    const ch = level.tileAt(tx, ty);
    if (isSolid(ch) || isSemi(ch)) return true;
  }
  return false;
}

export function applyGravity(entity, scale = 1) {
  entity.vy = Math.min(entity.vy + GRAVITY * scale, TERMINAL);
}
