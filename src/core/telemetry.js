/**
 * Playtest telemetry, phase 1: local only.
 *
 * The point is to answer questions the designer cannot answer by playing his
 * own levels — where do people actually die, and where do they stop making
 * progress. A level that reads fine on the grid can still have one column that
 * eats half the attempts, and only the data shows it.
 *
 * Two rules this module is built around:
 *
 *   1. **Anonymous by construction.** We store a level id, a tile coordinate, a
 *      cause and a power level. No name, no wall-clock timestamp, no run id.
 *      There is nothing here to tie back to a person, so this needs no consent
 *      dialog and no privacy promise we would have to keep.
 *   2. **Nothing leaves the browser.** No network calls anywhere in this file.
 *      Sending is a separate, later decision (ROADMAP §1 phase 3); export is a
 *      file the player chooses to hand over.
 *
 * Coordinates are stored as tiles, not pixels. It is the resolution the level
 * is actually authored at, it makes the buckets line up for free, and it keeps
 * the log an order of magnitude smaller.
 */

const KEY = 'sfb3.telemetry.v1';

/**
 * Old events fall off the front. 800 is roughly a few weeks of a kid playing
 * daily, and bounding it means a long-lived browser profile can never grow a
 * log big enough to make `localStorage.setItem` start throwing.
 */
const MAX_EVENTS = 800;

/** Causes of death, kept as short tags so the log stays small and greppable. */
export const CAUSES = ['enemy', 'pit', 'lava', 'spike', 'time', 'hazard'];

let log = null;

function read() {
  if (log) return log;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    log = parsed && Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    log = [];
  }
  return log;
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, events: log }));
  } catch {
    /* private mode or a full quota — telemetry is never worth breaking play over */
  }
}

function push(event) {
  read().push(event);
  if (log.length > MAX_EVENTS) log.splice(0, log.length - MAX_EVENTS);
  write();
}

/**
 * A death. `frames` is how long the attempt lasted, which is the cheapest
 * possible signal for "did they die on the way in or after a long fight".
 */
export function logDeath({ level, tx, ty, cause = 'enemy', power = 0, frames = 0 }) {
  push({ e: 'die', l: level, x: tx, y: ty, c: cause, p: power, f: frames });
}

/** A level finished. `deaths` counts the attempts it took to get here. */
export function logClear({ level, frames = 0, deaths = 0, power = 0 }) {
  push({ e: 'clear', l: level, f: frames, d: deaths, p: power });
}

/**
 * The player stopped getting anywhere. Distinct from a death: a wall you
 * cannot climb produces no deaths at all, which is exactly why "where do they
 * die" is not enough on its own.
 */
export function logStuck({ level, tx, ty, frames = 0 }) {
  push({ e: 'stuck', l: level, x: tx, y: ty, f: frames });
}

export function allEvents() {
  return read().slice();
}

/**
 * Per-column counts for one level, for the debug heatmap.
 * @returns {{deaths: Map<number, number>, stuck: Map<number, number>,
 *            total: number, stuckTotal: number, clears: number, worst: number}}
 */
export function levelSummary(levelId) {
  const deaths = new Map();
  const stuck = new Map();
  let total = 0;
  let stuckTotal = 0;
  let clears = 0;

  for (const ev of read()) {
    if (ev.l !== levelId) continue;
    if (ev.e === 'die') {
      deaths.set(ev.x, (deaths.get(ev.x) || 0) + 1);
      total++;
    } else if (ev.e === 'stuck') {
      stuck.set(ev.x, (stuck.get(ev.x) || 0) + 1);
      stuckTotal++;
    } else if (ev.e === 'clear') {
      clears++;
    }
  }

  const worst = Math.max(1, ...deaths.values(), ...stuck.values());
  return { deaths, stuck, total, stuckTotal, clears, worst };
}

/**
 * Phase 2: the whole log as a JSON string, for handing to `gen-levels.mjs`.
 * Includes a version tag so an old export stays readable after the shape moves.
 */
export function exportJSON() {
  return JSON.stringify({ v: 1, game: 'sfb3', events: read() }, null, 1);
}

/** Offers the log as a download. Browser-only; no-op if the DOM is missing. */
export function downloadExport(name = 'sfb3-telemetria.json') {
  if (typeof document === 'undefined') return false;
  const blob = new Blob([exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export function clearTelemetry() {
  log = [];
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function eventCount() {
  return read().length;
}
