export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const approach = (v, target, step) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);

export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Deterministic small PRNG so decoration never flickers between frames. */
export function hashNoise(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

/** Pads every row of an ASCII map to the same width so lookups never go ragged. */
export function normalizeRows(rows) {
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map((r) => r.padEnd(width, ' '));
}

export function padNum(value, digits) {
  return String(Math.max(0, Math.floor(value))).padStart(digits, '0');
}
