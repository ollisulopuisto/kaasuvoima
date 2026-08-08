/**
 * Reads an exported telemetry log (`exportJSON` in src/core/telemetry.js) and
 * turns it into per-level hotspots the generator can act on.
 *
 * Reading the file is the easy half. The hard half is refusing to act on most
 * of it: a handful of events is not a signal, and the failure mode is specific
 * — one player grinding the same jump twenty times produces exactly the shape
 * that a genuinely brutal spot produces. So every cluster has to clear two
 * thresholds, and everything that does not is reported rather than dropped
 * silently, because "the data changed nothing" and "there was no data" look
 * identical in the output otherwise.
 *
 * What the engine already guarantees, and what the thresholds lean on:
 *   - one `die` OR one `clear` per attempt (src/scenes/level.js `telemetryDone`),
 *     so events per level is an exact attempt count, not an estimate;
 *   - one `stuck` per column per attempt (`stuckLogged`), so five stalls in one
 *     column are five separate attempts by construction.
 */
import { readFile } from 'node:fs/promises';

export const RULES = {
  /**
   * Events per cluster. Four attempts ending in the same place is a bad
   * evening; five starts to be a property of the level. It is a judgement
   * call, but it is the number below which the generator does nothing.
   */
  cluster: 5,
  /**
   * Attempts on the same level that ended somewhere else. This is the one that
   * catches practising: a log of twenty deaths on one jump and nothing else
   * says the player chose that jump, not that the jump beats people. Three
   * attempts elsewhere is the cheapest evidence that the log covers actual
   * play-throughs of the level.
   */
  elsewhere: 3,
  /**
   * Columns this far apart still count as the same spot. A wide gap kills
   * people across its whole mouth, and one death per column is not five
   * separate problems.
   */
  span: 3,
};

/** Maximal runs of columns no more than `RULES.span` apart. */
function cluster(counts) {
  const out = [];
  let cur = null;
  for (const col of [...counts.keys()].sort((a, b) => a - b)) {
    const n = counts.get(col);
    if (cur && col - cur.to <= RULES.span) {
      cur.to = col;
      cur.count += n;
    } else {
      cur = { from: col, to: col, at: col, peak: 0, count: n };
      out.push(cur);
    }
    if (n > cur.peak) { cur.peak = n; cur.at = col; }
  }
  return out;
}

/**
 * Ignored clusters come back with a `code`: `thin` for too few events, `grind`
 * for a cluster big enough on its own but with no other attempts around it.
 * The second one is the interesting one and deserves a line of its own in the
 * generator's summary; the first is usually most of the log.
 *
 * @param {string} file  path to a JSON export
 * @returns {Promise<{events: number, levels: Map<string, {deaths: object[],
 *          stalls: object[]}>, ignored: object[]}>}
 */
export async function readTelemetry(file) {
  const raw = JSON.parse(await readFile(file, 'utf8'));
  if (raw.game !== 'sfb3' || !Array.isArray(raw.events)) {
    throw new Error(`${file}: not an sfb3 telemetry export`);
  }
  if (raw.v !== 1) throw new Error(`${file}: telemetry version ${raw.v}, expected 1`);

  const byLevel = new Map();
  for (const ev of raw.events) {
    if (!ev || typeof ev.l !== 'string') continue;
    if (!byLevel.has(ev.l)) byLevel.set(ev.l, []);
    byLevel.get(ev.l).push(ev);
  }

  const levels = new Map();
  const ignored = [];

  for (const [id, events] of byLevel) {
    const deaths = new Map();
    const stalls = new Map();
    for (const ev of events) {
      if (typeof ev.x !== 'number') continue;
      const bucket = ev.e === 'die' ? deaths : ev.e === 'stuck' ? stalls : null;
      if (bucket) bucket.set(ev.x, (bucket.get(ev.x) || 0) + 1);
    }

    const accepted = { deaths: [], stalls: [] };
    for (const [kind, counts] of [['deaths', deaths], ['stalls', stalls]]) {
      for (const hot of cluster(counts)) {
        // Clears carry no column, so they always count as an attempt elsewhere.
        const elsewhere = events.filter(
          (ev) => typeof ev.x !== 'number' || ev.x < hot.from || ev.x > hot.to,
        ).length;
        const note = { level: id, kind, ...hot, elsewhere };
        if (hot.count < RULES.cluster) {
          ignored.push({ ...note, code: 'thin' });
        } else if (elsewhere < RULES.elsewhere) {
          ignored.push({ ...note, code: 'grind' });
        } else {
          accepted[kind].push(note);
        }
      }
    }
    if (accepted.deaths.length || accepted.stalls.length) levels.set(id, accepted);
  }

  return { events: raw.events.length, levels, ignored };
}
