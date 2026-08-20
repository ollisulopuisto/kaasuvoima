/**
 * THE GHOST: the run you already did, running the level beside you.
 *
 * Time attack (`src/core/timeattack.js`) already keeps your best run per level
 * and tells you which side of it you are on at eight checkpoints. What it
 * keeps is eight numbers, and eight numbers cannot be *watched*. This file
 * keeps the other thing: the path.
 *
 * ## Why this is not in `telemetry.js`, and why it never can be
 *
 * `telemetry.js` opens with a promise it can actually keep: anonymous **by
 * construction** — a level id, a tile, a cause, a power level, and nothing
 * that ties two records to each other or to a person. That promise is what
 * lets it exist without a consent dialog, and it is what makes ROADMAP §2
 * phase 4 ("send it somewhere one day") a decision that can be taken later.
 *
 * A trace cannot make that promise. It **is** a run id: one continuous record
 * of one person playing one level, hesitations and all — where they stopped to
 * look, where they backed up, how long they stood at the gap before jumping.
 * Kept on the machine it was made on that is harmless, and here it stays. But
 * a death histogram and a movement trace are not the same thing to send, so
 * the two must not be able to leave together by accident:
 *
 *   - **Separate key.** `sfb3.ghost.v1`, never `sfb3.telemetry.v1`.
 *   - **Separate store.** Nothing in this file reads or writes the telemetry
 *     log, and nothing in that file knows this one exists.
 *   - **No exporter here.** `telemetry.js` has `downloadExport` because its
 *     contents are meant to be handed over. This file deliberately has no
 *     equivalent: the sharing half of the ROADMAP entry (ask the player after
 *     a personal best, ship the trace in a link or a file) is a decision the
 *     owner has not taken, and code that is already written is a decision that
 *     has been taken quietly. Whoever builds sharing adds the export *and* the
 *     asking in the same change.
 *
 * ## What is recorded, and what is derived
 *
 * Position alone makes a cursor, not a ghost — a body that slides along the
 * floor at running speed reads as a bug. So each sample also carries the
 * things that make it read as a player: which way it is facing, whether it is
 * airborne, whether it is ducking or climbing, and how big it was.
 *
 * The walk cycle is **derived rather than recorded**, and that is a saving
 * rather than a shortcut: the player's own `animFrame` advances with distance
 * travelled (`Player.update`), so it is already a function of the positions
 * that are in the trace. Replaying it from the interpolated speed gives the
 * same cadence for zero bytes. Everything that cannot be recomputed from the
 * path — facing at a standstill, ducking, climbing, body size — is stored.
 *
 * ## What it costs, measured
 *
 * A minute-long run is 3600 frames. Storing x and y as 16-bit ints every frame
 * is 14.4 KB for one level and roughly 940 KB for a full set of 65, which is
 * the wrong order of magnitude for localStorage once the save, the scores and
 * the telemetry log are also in it.
 *
 * `STEP` 4 with delta coding measures **3.0 bytes per sample** on real runs —
 * a varint each for dx and dy plus one flag byte, and the deltas are small
 * enough that the varints are one byte each essentially always. That is 900
 * samples and 2.7 KB raw for a minute, 3.6 KB once it is base64, and ~236 KB
 * for a ghost on each of the 65 levels. The bot's own run of 1-1 measures 1407
 * frames, 352 samples and 1412 characters.
 *
 * Every one of those numbers is re-measured by `tools/verify.mjs` ("haamu")
 * rather than trusted from here, because a number in a comment goes stale and
 * a number in the gate does not.
 *
 * ## Why `STEP` is 4, measured rather than reasoned
 *
 * The reasoning said the error would be the sag of a parabola across the gap:
 * gravity is 0.3125 px/frame² (`src/level/physics.js`), so a·s²/8 = 0.625 px.
 * That turns out to be the **mean** error and not the worst one. Measured over
 * three levels the linear replay is 0.60–0.62 px average and 2.1–2.3 px at the
 * 95th percentile, but the worst frames are 8–9.4 px out.
 *
 * The outliers are not curvature, they are **impacts**: a landing inside a gap
 * is a velocity discontinuity (4 px/frame straight down, then zero), and no
 * sampling grid catches an event it did not sample. There are 6–14 such frames
 * in a whole run, each of them one or two frames long, on a body that is drawn
 * translucent and behind everything.
 *
 * Two things were tried against those frames and neither is here:
 *
 *   - **Easing the interpolation by the airborne flag** — fast-out into a
 *     landing, slow-in out of a take-off. It changed the worst frame not at
 *     all (still 8.0 px) and made the average *worse*: 0.70 px against 0.62.
 *     The discontinuity is inside the gap, so bending the curve around it
 *     moves the error rather than removing it.
 *   - **Nearest sample instead of interpolation**, i.e. no interpolation at
 *     all. Mean 3.4 px, 95th percentile 8.6 px, and 561 frames of a 1407-frame
 *     run past 4 px. This is the version that reads as a cursor.
 *
 * `STEP` 8 measures 24 px at worst and 16 measures 56 px, so the step could
 * not go up; `STEP` 2 halves the worst error to 3.5 px and doubles the store.
 * 4 is the point where the average is under a pixel and the store fits.
 *
 * ## Failure is silent, always
 *
 * Same rule as telemetry, for a stronger reason: this is a garnish on a mode
 * that works without it. Private mode, a full quota, a corrupt entry written
 * by a future version — every one of them ends with `null` and a level that
 * plays exactly as it did before ghosts existed. Nothing in here is allowed to
 * throw into the game loop.
 */

const KEY = 'sfb3.ghost.v1';

/**
 * Frames between samples. See the module header for the measurement that chose
 * it. The number is written into every stored trace (`s`), so changing it later
 * does not have to invalidate anybody's ghosts.
 */
export const STEP = 4;

/**
 * The longest run that gets a ghost, in samples.
 *
 * 2700 samples is 10800 frames, i.e. three minutes. The widest level in the
 * game is 3-1 at 428 columns, which is 6848 px, which is 4565 frames — 76
 * seconds — walked end to end at the walk cap without ever running. The cap is
 * therefore 2.4× the slowest honest traverse of the biggest level.
 *
 * It exists because the race clock keeps ticking in the pause menu
 * (`LevelScene.tickPaused`), so a first run — which is also a first *best*, and
 * therefore stored — can otherwise be an afternoon of standing in a menu
 * recorded at 15 samples a second. A run past the cap keeps its time and gets
 * no ghost, which is a state every level is in before it has been raced once.
 */
export const MAX_SAMPLES = 2700;

/**
 * Ceiling on the whole store, in characters of serialised JSON.
 *
 * A full set is 65 ghosts, and at the 3.6 KB a minute-long run measures that
 * is ~236 000 characters. 320 000 is that plus a third, which is the room a
 * player who races some levels for longer than a minute needs. localStorage is
 * 5 MB per origin in every browser this game runs in, so the ceiling is ~6 % of
 * it (~13 % counted as the UTF-16 the quota is actually measured in), and it is
 * a ceiling rather than a growth rate.
 *
 * It is deliberately not big enough for every level at every difficulty —
 * `raceKey` files NORMAALI apart from HELPPO, so that would be 195 ghosts and
 * most of a megabyte. A player who races two difficulties keeps ghosts for the
 * levels they have raced recently and loses the ones they have not, which is
 * the right thing to lose: the times, which are the record, are in the save and
 * are not touched by any of this.
 *
 * Over the ceiling, the least recently written ghost is dropped. Order is kept
 * as a list rather than a timestamp **on purpose**: a wall clock in this file
 * would be exactly the field `telemetry.js` refuses to store, and eviction
 * needs an order, not a date.
 */
export const MAX_CHARS = 320000;

/** The poses a ghost can be drawn in. Index is what the flag byte carries. */
export const STATES = ['idle', 'walk', 'jump', 'duck', 'climb'];

/* --------------------------------- codec --------------------------------- */

/*
 * Zigzag varints, because the deltas are small and signed. At `STEP` 4 and a
 * top speed of 2.5 px/frame a horizontal delta is at most ~11 px and a
 * vertical one at most ~16 (terminal velocity 4.0), so both fit the one-byte
 * range of ±63 that a single zigzag varint buys. The first sample is stored
 * as a delta from zero, which costs two bytes once and keeps the decoder a
 * single loop with no special case.
 */
const zig = (n) => (n < 0 ? (-n << 1) - 1 : n << 1);
const zag = (n) => (n & 1 ? -((n + 1) >> 1) : n >> 1);

function putVarint(out, n) {
  let v = n;
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
}

/** Base64 without `btoa`, so the codec is the same in node and in the browser. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    s += B64[a >> 2];
    s += B64[((a & 3) << 4) | ((b || 0) >> 4)];
    s += b === undefined ? '=' : B64[((b & 15) << 2) | ((c || 0) >> 6)];
    s += c === undefined ? '=' : B64[c & 63];
  }
  return s;
}

function fromBase64(str) {
  const out = [];
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < str.length; i++) {
    const v = B64.indexOf(str[i]);
    if (v < 0) continue;              // padding and anything else: skip
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return out;
}

/**
 * One sample's non-positional state, packed into a byte:
 *
 *   bits 0-2  pose index into `STATES`
 *   bit  3    facing right
 *   bits 4-6  power level 0…5 (`PLAYER_SIZES`) — the body it was at the time
 *   bit  7    unused; a ghost that needs an eighth bit gets `v: 2`
 */
export function packFlags({ state = 'idle', facing = 1, level = 0 }) {
  const s = Math.max(0, STATES.indexOf(state));
  return (s & 7) | (facing >= 0 ? 8 : 0) | ((Math.max(0, Math.min(5, level)) & 7) << 4);
}

export function unpackFlags(b) {
  return {
    state: STATES[b & 7] || 'idle',
    facing: b & 8 ? 1 : -1,
    level: (b >> 4) & 7,
  };
}

/**
 * @param {{x: number[], y: number[], flags: number[]}} rec
 * @returns {string} base64, or '' if there is nothing worth keeping.
 */
export function encodeTrace(rec) {
  if (!rec || !rec.x || rec.x.length === 0) return '';
  const bytes = [];
  let px = 0;
  let py = 0;
  for (let i = 0; i < rec.x.length; i++) {
    const x = Math.round(rec.x[i]);
    const y = Math.round(rec.y[i]);
    putVarint(bytes, zig(x - px));
    putVarint(bytes, zig(y - py));
    bytes.push(rec.flags[i] & 0xff);
    px = x;
    py = y;
  }
  return toBase64(bytes);
}

/**
 * @returns {{n: number, x: Int16Array, y: Int16Array, flags: Uint8Array}|null}
 */
export function decodeTrace(str) {
  if (typeof str !== 'string' || str.length === 0) return null;
  const bytes = fromBase64(str);
  const x = [];
  const y = [];
  const flags = [];
  let i = 0;
  let px = 0;
  let py = 0;
  const varint = () => {
    let v = 0;
    let shift = 0;
    while (i < bytes.length) {
      const b = bytes[i++];
      v |= (b & 0x7f) << shift;
      if (!(b & 0x80)) return v;
      shift += 7;
      if (shift > 28) return v;       // corrupt: stop growing rather than spin
    }
    return v;
  };
  while (i < bytes.length) {
    const dx = zag(varint());
    const dy = zag(varint());
    if (i >= bytes.length) break;     // truncated tail: drop the half sample
    px += dx;
    py += dy;
    x.push(px);
    y.push(py);
    flags.push(bytes[i++]);
  }
  if (x.length === 0) return null;
  return {
    n: x.length,
    x: Int16Array.from(x),
    y: Int16Array.from(y),
    flags: Uint8Array.from(flags),
  };
}

/* --------------------------------- store --------------------------------- */

let store = null;

function blank() {
  return { v: 1, order: [], runs: {} };
}

function read() {
  if (store) return store;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.v === 1 && parsed.runs && typeof parsed.runs === 'object') {
      store = {
        v: 1,
        order: Array.isArray(parsed.order) ? parsed.order.filter((k) => k in parsed.runs) : [],
        runs: parsed.runs,
      };
      /* An entry with no place in `order` would be unevictable, so the list is
       * repaired on read rather than trusted. Cheap, and it means a hand-edited
       * or half-written store cannot grow past the ceiling for ever. */
      for (const k of Object.keys(store.runs)) {
        if (!store.order.includes(k)) store.order.push(k);
      }
    } else {
      store = blank();
    }
  } catch {
    store = blank();
  }
  return store;
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode or a full quota — a ghost is never worth breaking play over,
     * and the in-memory store keeps working for the rest of the session */
  }
}

/** Drops the oldest ghosts until the serialised store fits `MAX_CHARS`. */
function trim() {
  let json = JSON.stringify(store);
  while (json.length > MAX_CHARS && store.order.length > 1) {
    const old = store.order.shift();
    delete store.runs[old];
    json = JSON.stringify(store);
  }
  return json.length;
}

/**
 * Keeps the trace of a run, under the same key the best time is filed under
 * (`raceKey`).
 *
 * `frames` is the run's own length, and it is stored so playback can check
 * that this ghost is *the* best run rather than an older one: an old build
 * writing the save back drops `bestTimes` (DESIGN.md §6) while this store,
 * being its own key, survives — and a ghost that does not match the time on
 * screen would be a quiet lie about which run you are chasing.
 *
 * @returns true if it was stored.
 */
export function putGhost(key, { frames, x, y, flags }) {
  if (!key || !(frames > 0) || !x || x.length === 0) return false;
  if (x.length > MAX_SAMPLES) return false;
  const d = encodeTrace({ x, y, flags });
  if (!d) return false;
  read();
  store.runs[key] = { f: Math.round(frames), s: STEP, d };
  store.order = store.order.filter((k) => k !== key);
  store.order.push(key);
  trim();
  /* Trimming can evict the ghost that was just stored if it is alone and still
   * too big; saying so is better than pretending it is on disk. */
  if (!store.runs[key]) return false;
  write();
  return true;
}

/**
 * @returns {{frames: number, step: number, n: number, x: Int16Array,
 *            y: Int16Array, flags: Uint8Array}|null}
 */
export function getGhost(key) {
  if (!key) return null;
  const row = read().runs[key];
  if (!row || !(row.f > 0)) return null;
  let trace = null;
  try {
    trace = decodeTrace(row.d);
  } catch {
    trace = null;
  }
  if (!trace) return null;
  return { frames: row.f, step: row.s > 0 ? row.s : STEP, ...trace };
}

export function dropGhost(key) {
  read();
  if (!(key in store.runs)) return false;
  delete store.runs[key];
  store.order = store.order.filter((k) => k !== key);
  write();
  return true;
}

/** Wipes every trace. Called wherever the best times are wiped — see `Game.resetBestTimes`. */
export function clearGhosts() {
  store = blank();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function ghostKeys() {
  return read().order.slice();
}

/** Serialised size of the whole store, for the size gate. */
export function ghostChars() {
  return JSON.stringify(read()).length;
}

/* -------------------------------- playback ------------------------------- */

/**
 * The ghost's pose at race frame `t` (0 = the frame the level started).
 *
 * Position is interpolated between samples and everything else is taken from
 * the sample before, which is the honest split: a body's position between two
 * known points is on the line between them, but it does not turn round or
 * start ducking halfway through a gap it was never asked about.
 *
 * `walk` is the derived animation phase (see the header): it advances with
 * distance covered, the same way the player's own does, so the legs move at
 * the speed the ghost is actually moving.
 *
 * @returns {{x, y, facing, state, level, walk, done}|null}
 */
export function poseAt(trace, t, walkFrames = 4) {
  if (!trace || trace.n === 0) return null;
  const step = trace.step || STEP;
  const k = Math.floor(t / step);
  if (k < 0) return null;
  const last = trace.n - 1;
  const i = Math.min(k, last);
  const j = Math.min(k + 1, last);
  const f = i === j ? 0 : (t - k * step) / step;
  const x = trace.x[i] + (trace.x[j] - trace.x[i]) * f;
  const y = trace.y[i] + (trace.y[j] - trace.y[i]) * f;
  const flags = unpackFlags(trace.flags[i]);
  /*
   * Ground covered so far, in pixels, divided by the length of one step.
   *
   * 7 px is not a taste: `Player.update` cites its own measurement for the
   * same cycle — "6.8 px of travel per step against a 7 px gap between the
   * boot prints, which is as close to not sliding as this sprite gets" — so
   * the ghost's legs are driven by the number the player's legs were tuned to.
   * Deriving the phase from distance rather than from time is the whole point:
   * a ghost sprinting past moves its legs faster than one edging along a
   * ledge, for zero stored bytes.
   *
   * Horizontal travel only. In a vertical level the body is climbing, and
   * `state` says so — driving the walk cycle off a fall would spin the legs of
   * somebody who is not touching anything.
   */
  const dx = Math.abs(x - trace.x[0]) / 7;
  return {
    x,
    y,
    facing: flags.facing,
    state: flags.state,
    level: flags.level,
    walk: Math.floor(dx) % walkFrames,
    done: t >= last * step,
  };
}
