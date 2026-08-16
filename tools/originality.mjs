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
 *
 * `'C'` — möykky — joined it on 10.8.2026, the day the tile was first placed in
 * a level, and the gap it closed is worth stating because it was the harmless
 * kind. `canonOurs` folds anything it does not know into `'-'`, i.e. air, so a
 * level containing a möykky would have been compared against the corpus **with
 * a hole where the tile is** — a comparison that answers a question about a
 * level nobody plays. It cost nothing while no level had one, which is exactly
 * why it had to be fixed in the same change that gave the tile a home rather
 * than left as a note.
 *
 * The tile is `X` here like every other solid, and that is the whole point of
 * canonicalising: the question is "is this the same arrangement", and in the
 * starting state — which is what is committed and what is compared — a möykky
 * is a solid tile standing on something.
 */
const SOLID = new Set(['#', 'X', 'B', '?', '!', '*', 'u', 'N', '[', ']', '{', '}', '%', '(', ')', 'S', 'C', 'I']);
/** Juoksuhiekka: not air and not rock, so it folds to a letter of its own. */
const SINK = new Set(['~']);
const ENEMY = new Set(['g', 'k', 'f', 'p', 'r', 'c', 'A', 'H', 'O', 'x', 'P', 'U', 'b',
  'T', 'Z', 'Y', 'm']);

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
/**
 * Every `.txt` under `dir`, however deep.
 *
 * **Se ettei tätä ollut on tämän tiedoston oma varoitus toteutuneena.** Ylempänä
 * lukee että tarkistuksen koko syy on olla "safeguard that quietly stops being
 * true", ja juuri niin kävi: luku oli `readdir(CORPUS_DIR)` ilman rekursiota,
 * ja korpuksen juuressa ei ole yhtään `.txt`-tiedostoa — siellä on pelikansiot,
 * ja kentät ovat niiden sisällä (`Super Mario Bros/Processed/…`). Ensimmäinen
 * oikealla korpuksella tehty ajo luki siis **nolla tiedostoa, löysi nolla
 * osumaa ja palautti nollan**, eli näytti täydeltä puhtaalta paperilta.
 *
 * Nolla osumaa nollaa tiedostoa vasten ei ole tulos vaan tuloksen puute, ja se
 * on vaarallisempi kuin punainen: se vastaa kysymykseen jota ei kysytty.
 */
async function corpusFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await corpusFiles(p));
    else if (e.name.endsWith('.txt')) out.push(p);
  }
  return out;
}

/**
 * Koko korpus yhtenä ikkunajoukkona, luettuna kerran.
 *
 * `corpusHits` lukee 481 tiedostoa **joka kutsulla**, mikä on täsmälleen oikein
 * silloin kun kysymys esitetään kahdellekymmenelleseitsemälle kentälle. Päivän
 * pierun todistus (`tools/daily-origin.mjs`) kysyy sen tuhannelle kentälle, ja
 * silloin sama luku on tuhat kertaa sama työ.
 *
 * Sama kanonisointi, sama kahdeksan sarakkeen ikkuna, sama neljätoista alinta
 * riviä — eli sama kysymys. Ainoa ero on suunta: `corpusHits` laskee montako
 * *korpuksen* ikkunaa osuu meihin, tämä montako *meidän* ikkunaamme osuu
 * korpukseen. Lukuina ne eroavat toisintojen verran; nollana ne ovat sama asia,
 * ja nolla on se ainoa vastaus joka kelpaa.
 *
 * Korpuksesta ei jää tähän kenttiä vaan kanonisoituja ikkunoita — neljän
 * kirjaimen aakkosto, josta ei rekonstruoi mitään — eikä mitään kirjoiteta
 * levylle.
 */
export async function corpusIndex() {
  if (!CORPUS_DIR) return null;
  const list = await corpusFiles(CORPUS_DIR);
  if (!list.length) {
    throw new Error(`VGLC_DIR=${CORPUS_DIR} ei sisällä yhtään .txt-kenttää — `
      + 'osoittaako se korpuksen juureen?');
  }
  const keys = new Set();
  for (const file of list) {
    const grid = (await readFile(file, 'utf8')).split('\n').filter((r) => r.length);
    for (const key of windows(grid.slice(-14), canonCorpus)) keys.add(key);
  }
  return { keys, files: list.length };
}

/** Montako kentän ikkunaa löytyy valmiiksi luetusta korpuksesta. */
export function hitsAgainst(index, rows) {
  let hits = 0;
  for (const key of windows(rows, canonOurs)) if (index.keys.has(key)) hits++;
  return hits;
}

export async function corpusHits(rows) {
  if (!CORPUS_DIR) return { checked: false, hits: 0, files: 0 };
  const mine = windows(rows, canonOurs);
  const list = await corpusFiles(CORPUS_DIR);
  /* Hakemisto joka on olemassa muttei sisällä yhtään kenttää ei ole korpus.
   * Se on **eri asia kuin puuttuva korpus**, ja siksi se ei palaudu
   * `checked: false`:na vaan kaataa: väärään paikkaan osoittava `VGLC_DIR` on
   * virhe jonka tekijä haluaa kuulla heti, eikä hiljainen "ei tarkistettu"
   * jonka voi luulla tarkoittavan ettei korpusta ollut. */
  if (!list.length) {
    throw new Error(`VGLC_DIR=${CORPUS_DIR} ei sisällä yhtään .txt-kenttää — `
      + 'osoittaako se korpuksen juureen?');
  }
  let hits = 0;
  for (const file of list) {
    const grid = (await readFile(file, 'utf8')).split('\n').filter((r) => r.length);
    // Both grids are trimmed to the same 14 bottom rows before comparing.
    for (const key of windows(grid.slice(-14), canonCorpus)) if (mine.has(key)) hits++;
  }
  return { checked: true, hits, files: list.length };
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
