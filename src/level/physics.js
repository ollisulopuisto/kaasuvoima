import { TILE, isSolid, isSemi } from '../gfx/tiles.js';

export const GRAVITY = 0.42;
export const GRAVITY_HELD = 0.20;
export const TERMINAL = 7.0;

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

  entity.onGround = result.ground;
  return result;
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
