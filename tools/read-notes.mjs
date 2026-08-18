/**
 * Reads a note file from the playtest desk.
 *
 * The desk (published as an artifact, one canvas silhouette per level) lets a
 * person drag a column range and say one of three things about it: make this
 * *easier*, make this *harder*, or put a named *shape* here. This file turns
 * that into something `tools/gen-levels.mjs` can act on, and refuses everything
 * it cannot act on rather than quietly dropping it.
 *
 *   node tools/gen-levels.mjs --notes notes.json
 *
 * ## Why this is a sibling of `read-telemetry.mjs` and not part of it
 *
 * Telemetry and notes arrive in the same shape — a level, a column range, a
 * direction — and they feed the same two knobs. They are still two files
 * because they answer to different standards of evidence:
 *
 *   - **Telemetry is a measurement, and it needs a threshold.** One death at
 *     column 90 is a person having a bad jump; nine deaths at column 90 is the
 *     level. `read-telemetry.mjs` is mostly the rules that decide which is
 *     which, and every one of them exists because a single sample is noise.
 *   - **A note is a judgement, and it needs none.** Somebody played the level,
 *     decided the middle was flat, and said so. There is no cluster to find and
 *     no threshold to clear: one note is one opinion, and the opinion is the
 *     data. Making a note wait for a second note would be inventing a quorum
 *     for something that never claimed to be a measurement.
 *
 * They also fail differently, which is the practical half of the argument: bad
 * telemetry is thin data and gets ignored, bad notes are a typo — a level that
 * does not exist, a shape the generator has never heard of, or "easier" and
 * "harder" typed over the same stretch — and every one of those is refused by
 * name below. Silence would make a misspelt level id look exactly like a level
 * nobody had anything to say about.
 *
 * ## What the file looks like
 *
 *     {
 *       "game": "sfb3", "v": 1,
 *       "notes": [
 *         { "level": "1-4", "from": 120, "to": 150, "want": "harder" },
 *         { "level": "5-2", "from": 40,  "to": 66,  "want": "easier" },
 *         { "level": "2-4", "from": 88,  "to": 100, "want": "shape:hill" }
 *       ]
 *     }
 *
 * Columns are the built level's own columns, which is what the desk draws and
 * what the telemetry log already records, so the two sources index the same
 * thing and a note can be compared against a death cluster by eye.
 */
import { readFile } from 'node:fs/promises';
import { PIECES } from '../src/data/generator.js';

/** The two directions, and the prefix that names a piece instead of a direction. */
export const DIRECTIONS = new Set(['easier', 'harder']);
export const SHAPE = 'shape:';

/** Every shape a note may ask for, which is every piece the generator can build. */
export const SHAPES = Object.keys(PIECES).sort();

/**
 * Parses and validates a note file.
 *
 * Returns `{ levels, refused }`: a `Map` from level id to its notes in file
 * order, and the list of notes that were thrown out with the reason for each.
 * The caller prints `refused` — see the header for why none of it is silent.
 */
export async function readNotes(file) {
  const raw = JSON.parse(await readFile(file, 'utf8'));
  if (raw.game !== 'sfb3' || !Array.isArray(raw.notes)) {
    throw new Error(`${file}: not an sfb3 note export`);
  }
  if (raw.v !== 1) throw new Error(`${file}: note version ${raw.v}, expected 1`);

  const levels = new Map();
  const refused = [];
  const where = (n) => `${n && n.level}:${n && n.from}-${n && n.to}`;

  for (const n of raw.notes) {
    if (!n || typeof n.level !== 'string' || !/^\d-[\dA-Z]$/.test(n.level)) {
      refused.push(`${where(n)}  ->  not a level id`);
      continue;
    }
    const from = Number(n.from);
    const to = Number(n.to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) {
      refused.push(`${where(n)}  ->  not a column range`);
      continue;
    }
    const want = String(n.want || '');
    const shape = want.startsWith(SHAPE) ? want.slice(SHAPE.length) : null;
    if (shape !== null && !PIECES[shape]) {
      refused.push(`${where(n)}  ->  no such shape "${shape}" (have: ${SHAPES.join(', ')})`);
      continue;
    }
    if (shape === null && !DIRECTIONS.has(want)) {
      refused.push(`${where(n)}  ->  "${want}" is neither easier, harder nor ${SHAPE}something`);
      continue;
    }
    if (!levels.has(n.level)) levels.set(n.level, []);
    levels.get(n.level).push({ from, to, want, shape });
  }

  /*
   * TWO NOTES THAT PULL THE SAME STRETCH TWO WAYS ARE BOTH WRONG.
   *
   * Whichever one ran last would win by file order, and file order is not an
   * opinion anybody holds — it is the order two people happened to click. So
   * the pair is refused and named, which is the only outcome that gets a human
   * to go and decide. Two notes that agree are fine and stack.
   *
   * It is the same argument for two directions and for two shapes, and the rule
   * covers both: "easier" against "harder" over one stretch is no more decidable
   * than "put a hill here" against "put lava here". A direction and a shape over
   * the same stretch is not a contradiction at all — *a wider hill* is a
   * coherent thing to ask for — and `planTuning` builds exactly that.
   */
  for (const [id, list] of levels) {
    const kept = [];
    for (const note of list) {
      const clash = list.find((o) => o !== note
        && o.from <= note.to && note.from <= o.to
        && ((DIRECTIONS.has(o.want) && DIRECTIONS.has(note.want) && o.want !== note.want)
          || (o.shape && note.shape && o.shape !== note.shape)));
      if (clash) {
        refused.push(`${id}:${note.from}-${note.to}  ->  "${note.want}" contradicts `
          + `"${clash.want}" at ${clash.from}-${clash.to}`);
        continue;
      }
      kept.push(note);
    }
    if (kept.length) levels.set(id, kept);
    else levels.delete(id);
  }

  return { levels, refused };
}
