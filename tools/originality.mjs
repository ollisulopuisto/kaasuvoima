/**
 * The similarity check, on its own, so that everyone who needs it runs the same
 * one.
 *
 *   VGLC_DIR="…" node tools/originality.mjs
 *
 * DESIGN.md §3 point 4 is the whole reason this file exists: *"Nykyiset kentät
 * on generoitu tarkistus päällä, osumia 0 — aja generaattori aina `VGLC_DIR`
 * asetettuna."* That is an instruction, and an instruction is the one kind of
 * safeguard that quietly stops being true — the corpus is deliberately not in
 * the repository (§3 point 1), so a contributor without it gets `not checked`
 * and no other consequence.
 *
 * So the check is separated from the thing that produces levels. Before, it
 * lived inside `tools/gen-levels.mjs` and could only be run by generating, which
 * meant the question "is what is committed right now original?" could not be
 * asked at all without also replacing the answer. Now it can:
 *
 *   - `tools/gen-levels.mjs` calls it while building, and refuses a level that
 *     hits, exactly as before
 *   - `tools/verify.mjs` calls it on the levels **as committed**, so a
 *     maintainer with the corpus gets a yes/no on the shipped data without
 *     regenerating anything
 *   - and run bare, it prints one line per level and exits non-zero on a hit,
 *     which is the one command the owner was promised
 *
 * WHAT IT COMPARES, AND WHY IT CANONICALISES. Neither grid is compared as
 * written. Both are folded onto the same four-letter alphabet — solid, sinking,
 * enemy, coin, air — because the question is not "are these the same
 * characters" but "is this the same arrangement". A level that copied a corpus
 * arrangement and renamed every tile would be just as much a copy, and a level
 * that happens to share our own tile names with the corpus is not one. Eight
 * columns is the window: shorter and any flat floor matches everything, longer
 * and a copy could hide by moving one tile.
 *
 * Nothing from the corpus is stored, returned or printed — only a count.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const IS_MAIN = !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

/** Where the corpus is, or null. Read once so every caller sees the same answer. */
export const CORPUS_DIR = process.env.VGLC_DIR || null;

/** How many columns have to line up before it counts as a match. */
export const WINDOW = 8;

/**
 * Kept identical to `src/data/rules.js`'s own SOLID, and it has to be: a solid
 * character missing from here is folded into air, and then the comparison is
 * looking at a grid with a hole where the tile is. `tools/verify.mjs` compares
 * the two lines as strings.
 */
const SOLID = new Set(['#', 'X', 'B', '?', '!', '*', 'u', 'N', '[', ']', '{', '}', '%', '(', ')', 'S']);
/** Juoksuhiekka: not air and not rock, so it folds to a letter of its own. */
const SINK = new Set(['~']);
const ENEMY = new Set(['g', 'k', 'f', 'p', 'r', 'c', 'A', 'H', 'O', 'x', 'P', 'U', 'b']);

const canonOurs = (ch) => (SOLID.has(ch) ? 'X' : SINK.has(ch) ? '~'
  : ENEMY.has(ch) ? 'E' : ch === 'o' ? 'o' : '-');
const canonCorpus = (ch) => ('XSQ?<>[]'.includes(ch) ? 'X' : ch === 'E' ? 'E' : ch === 'o' ? 'o' : '-');

/** The set of canonicalised WINDOW-column slices of a grid. */
function windows(grid, canon) {
  const w = grid.reduce((m, row) => Math.max(m, row.length), 0);
  const cols = [];
  for (let x = 0; x < w; x++) cols.push(grid.map((row) => canon(row[x] || ' ')).join(''));
  const out = new Set();
  for (let x = 0; x + WINDOW <= w; x++) out.add(cols.slice(x, x + WINDOW).join('|'));
  return out;
}

/**
 * How many of a level's windows appear in the corpus. `{ checked: false }` when
 * there is no corpus to compare against — never zero, because zero is an answer
 * and this is the absence of one.
 */
export async function corpusHits(rows) {
  if (!CORPUS_DIR) return { checked: false, hits: 0, files: 0 };
  const mine = windows(rows, canonOurs);
  let hits = 0;
  let files = 0;
  for (const file of (await readdir(CORPUS_DIR)).filter((f) => f.endsWith('.txt'))) {
    files++;
    const grid = (await readFile(join(CORPUS_DIR, file), 'utf8')).split('\n').filter((r) => r.length);
    // Both grids are trimmed to the same 14 bottom rows before comparing.
    for (const key of windows(grid.slice(-14), canonCorpus)) if (mine.has(key)) hits++;
  }
  return { checked: true, hits, files };
}

/**
 * The word a generated level carries in `src/data/generated.js`.
 *
 * It is a string and not a boolean on purpose: it is written into a data file
 * that a human reads, and `origin: 'not checked'` says what happened where
 * `origin: false` would only say that something did not.
 */
export const ORIGIN_CHECKED = 'checked';
export const ORIGIN_UNCHECKED = 'not checked';
export const originWord = (result) => (result.checked ? ORIGIN_CHECKED : ORIGIN_UNCHECKED);

if (IS_MAIN) {
  const { GENERATED_LEVELS } = await import(join(ROOT, 'src/data/generated.js'));
  const ids = Object.keys(GENERATED_LEVELS);
  if (!CORPUS_DIR) {
    console.error('\n  VGLC_DIR asettamatta — tarkistusta ei voi tehdä.\n');
    console.error(`  ${ids.length} generoitua kenttää: ${ids.join(' ')}`);
    console.error('  Aja: VGLC_DIR="…" node tools/originality.mjs\n');
    process.exit(2);
  }
  console.log(`\nAlkuperäisyys, ${WINDOW} sarakkeen ikkuna, korpus ${CORPUS_DIR}:\n`);
  let total = 0;
  for (const id of ids) {
    const r = await corpusHits(GENERATED_LEVELS[id].rows);
    total += r.hits;
    console.log(`  ${id.padEnd(6)}${String(r.hits).padStart(4)} osumaa   `
      + `(${r.files} korpustiedostoa, merkintä tiedostossa "${GENERATED_LEVELS[id].origin}")`);
  }
  console.log(total === 0
    ? `\n  ${ids.length} kenttää, 0 osumaa.\n`
    : `\n  ${total} OSUMAA — nämä kentät eivät kelpaa. Generoi uudella siemenellä.\n`);
  process.exit(total === 0 ? 0 : 1);
}
