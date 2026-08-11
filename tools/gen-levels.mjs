/**
 * Builds levels from the mined pacing statistics.
 *
 *   node tools/gen-levels.mjs [--seed 1234] [--world w3] [--telemetry log.json]
 *
 * Every level in `PLAN` at the bottom, across every world that has generated
 * ones. `--world` limits the run to one of them and leaves the rest of
 * `src/data/generated.js` exactly as committed, so two people filling out two
 * different worlds do not regenerate each other's work.
 *
 * This module is importable as well as runnable: `THEME_RULES` and
 * `themeProblems` are what `tools/verify.mjs` uses to prove that each theme's
 * structural rule rejects a level that breaks it. Nothing below the `IS_MAIN`
 * guard runs on import.
 *
 * **Mitä kenttä on, on nyt `src/data/generator.js`:ssä.** Palikat, teemat,
 * `buildLevel` ja `validateGenerated` siirtyivät sinne sanasta sanaan, koska
 * päivän pieru rakentaa kentän selaimessa eikä samasta säännöstä saa olla kahta
 * toteutusta. Tähän jäi se mikä on Nodea ja vain Nodea: `PLAN`, siemenhaku,
 * telemetria, korpustarkistus ja tiedoston kirjoittaminen. Ks. sen tiedoston
 * otsikko — ja se että `src/data/generated.js` tulee siirron jälkeen ulos
 * tavulleen samana on se todiste että siirto oli siirto.
 *
 * What is borrowed and what is not
 * --------------------------------
 * From `tools/pacing-stats.json` this takes RHYTHM: how many columns of calm
 * sit between challenges, how that density ramps across a level, how wide gaps
 * are as a fraction of what a jump can clear, how enemies cluster, how high
 * block rows float, how big a coin group tends to be.
 *
 * It takes no layout. The vocabulary below is this game's own — fart double
 * jumps, ummetus corks, hernekeitto, närästys jets, stink clouds, crumbling
 * catwalks, switch blocks, star blocks and the secrets hiding in ordinary
 * bricks — arranged by rules written against this game's *measured* jump budget
 * (tools/jump-budget.json, produced by tools/measure-jump.mjs), so the geometry
 * follows the physics instead of a number somebody wrote down once. A generated
 * level should read as a Kaasuvoima level that happens to breathe at a
 * classic tempo, not as a copy of anything.
 *
 * That distinction is the whole licence argument (DESIGN.md §3 point 3), so it
 * survives every addition to the vocabulary: a new character may take its
 * *size* from the mined histograms — how long a block run is, how wide a gap
 * is against the jump budget, how much calm precedes it — and nothing else.
 * None of the pieces below reproduces an arrangement from anywhere; where they
 * came from is this game's own hand-made chunks (`dune_crumble`,
 * `switch_wall`), which is a source we own.
 *
 * Every level is checked before it is written: gaps and walls stay inside the
 * jump budget, nothing spawns inside a wall, there is headroom for the tallest
 * power level, the finished grid obeys its own theme's structural rule, and no
 * eight-column stretch matches the source corpus.
 *
 * That last one is the only check that can fail to *happen*. It needs the corpus
 * behind `VGLC_DIR`, which is deliberately not in the repository, so the level
 * written out carries the answer with it — `origin: 'checked'` or
 * `origin: 'not checked'`, and the second is the absence of an answer rather
 * than a clean bill. `tools/originality.mjs` asks the question of the committed
 * data without regenerating it; `tools/verify.mjs` refuses a level whose
 * recorded provenance contradicts the environment it is being checked in.
 *
 * With `--telemetry` it also reads an exported playtest log and lets the data
 * move two knobs: a cluster of deaths lengthens the calm ground in front of the
 * spot, a cluster of stalls takes a tile off the obstacle that stopped them.
 * Nothing else. The thresholds that decide what counts as a cluster live in
 * tools/read-telemetry.mjs, and everything the data was too thin to justify is
 * printed too — silence would be indistinguishable from having no log at all.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildLevel, validateGenerated, hidesSomething, ENEMY, THEME_RULES, themeProblems,
} from '../src/data/generator.js';
import { readTelemetry, RULES } from './read-telemetry.mjs';
import { corpusHits, originWord, CORPUS_DIR } from './originality.mjs';

/*
 * `THEME_RULES` ja `themeProblems` kulkevat läpi tästä tiedostosta, koska
 * `tools/verify.mjs` on hakenut ne täältä siitä asti kun teemasäännöt
 * kirjoitettiin — ja se on yhä oikea osoite: portti kysyy *generaattorilta*
 * mitä se kentästä ajattelee. Uudelleenvienti on yksi rivi ja säästää sen
 * ettei siirto näy portin puolella lainkaan.
 */
export { THEME_RULES, themeProblems };

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const IS_MAIN = !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

/*
 * The default seed is the one world 5 actually ships with, so a bare run
 * rebuilds the file that is in the repository instead of a fourth world nobody
 * has measured. It was not chosen by taste: see the changelog for the sweep.
 */
const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg > 0 ? Number(process.argv[seedArg + 1]) : 44444;

const worldArg = process.argv.indexOf('--world');
const ONLY_WORLD = worldArg > 0 ? process.argv[worldArg + 1] : null;

const telArg = process.argv.indexOf('--telemetry');
const TELEMETRY_FILE = telArg > 0 ? process.argv[telArg + 1] : null;
if (telArg > 0 && !TELEMETRY_FILE) {
  console.error('  --telemetry needs a file: node tools/gen-levels.mjs --telemetry log.json');
  process.exit(1);
}
const TELEMETRY = TELEMETRY_FILE
  ? await readTelemetry(TELEMETRY_FILE).catch((err) => {
    console.error(`  ${err.message}`);
    process.exit(1);
  })
  : null;

/* ------------------------------ telemetry ------------------------------- */

/**
 * How much a death cluster stretches the calm ground leading into it. Rests
 * are three to eight columns, so anything under a doubling rounds away to a
 * tile or two — less than the histogram's own spread, i.e. not a change the
 * player could feel.
 */
const REST_BOOST = 2;

/** The pieces whose difficulty is a height or a distance, i.e. the ones `ease` can lower. */
const EASEABLE = new Set(['gap', 'stinkGap', 'corkGate', 'stairs', 'platforms', 'crumbleWalk']);

/**
 * Turns hotspots into per-iteration adjustments.
 *
 * This is why a level is built twice. The log indexes the columns of the level
 * people actually played, and widening anything shifts every column after it —
 * compare a hotspot against the shifted layout and it points at the next piece
 * along. So the first build is the map, and the second build is the one that
 * moves: same seed, same pieces in the same order (nothing here draws from the
 * generator's RNG), only their widths and heights differ.
 *
 * A stall lands either in the calm before an obstacle or on the obstacle
 * itself, and in both cases the obstacle to lower is the one in that same
 * iteration — the rest always comes first.
 */
function planTuning(hot, trace) {
  const tuning = new Map();
  const notes = [];
  const where = (h) => (h.from === h.to ? `col ${h.from}` : `cols ${h.from}-${h.to}`);
  const step = (i) => {
    if (!tuning.has(i)) tuning.set(i, { restScale: 1, ease: 0 });
    return tuning.get(i);
  };
  const index = (col) => trace.findIndex((t) => col >= t.from && col < t.to);

  for (const h of hot.deaths) {
    const i = index(h.at);
    if (i < 0) {
      notes.push(`deaths ${where(h)} (${h.count})  ->  outside any set piece, left alone`);
      continue;
    }
    step(i).restScale = REST_BOOST;
    notes.push(`deaths ${where(h)} (${h.count})  ->  rest before ${trace[i].name} x${REST_BOOST}`);
  }

  for (const h of hot.stalls) {
    const i = index(h.at);
    if (i < 0) {
      notes.push(`stalls ${where(h)} (${h.count})  ->  outside any set piece, left alone`);
      continue;
    }
    const name = trace[i].name;
    if (!EASEABLE.has(name)) {
      notes.push(`stalls ${where(h)} (${h.count})  ->  ${name} has no height to give, left alone`);
      continue;
    }
    // A cluster at twice the threshold is not twice as bad, but it is bad
    // enough that one tile is unlikely to be the difference.
    const ease = h.count >= 2 * RULES.cluster ? 2 : 1;
    step(i).ease = ease;
    notes.push(`stalls ${where(h)} (${h.count})  ->  ${name} lowered by ${ease}`);
  }

  return { tuning, notes };
}
/* --------------------------------- main --------------------------------- */

/*
 * THE PLAN: every generated level in the game, in one table.
 *
 * It used to be world 5's three, and the file said `intensity` per level with a
 * paragraph about how world 5 had come out easier than world 4. That paragraph
 * is still true of world 5 and its three rows are unchanged; what is new is that
 * the table now spans worlds, because the answer to "how do 36 levels become 64"
 * is this table growing rather than eight generators appearing.
 *
 * Each row is editorial numbers and nothing else:
 *
 *   `width`          how long the level is
 *   `enemiesPer100`  the world's own measured density (see `buildLevel`)
 *   `maxGap`         the widest jump this world asks for, in tiles
 *   `minIntro`       floor before the first challenge, in columns
 *   `intensity`      how tight the calm between challenges is
 *   `drop`/`species` what this world deliberately leaves out (subtractive)
 *   `aim`            what `tools/difficulty.mjs` should measure afterwards
 *   `attempts`       how many seeds the search may look at (see `ATTEMPTS`)
 *
 * `aim` is the one that needs defending, because "generate until the number
 * comes out right" is a short walk from tuning the number instead of the level.
 * Two things keep it honest and both are structural:
 *
 *   - **The aim is the curve, and the curve is a design decision made first.**
 *     A world's shape — which level is the breather, where the peak is — is
 *     decided as a shape and written here as numbers; the generator is then
 *     asked to hit them. That is the opposite of measuring afterwards and
 *     calling whatever came out the plan.
 *   - **The seed is the only thing the search moves.** Width, density and gap
 *     cap are fixed by the row above; the search tries seeds and keeps the level
 *     whose measured score lands closest to `aim`. Every candidate is a level
 *     that already passed every rule, so the search chooses between levels that
 *     are all shippable — it cannot buy a number with a level that is worse.
 *
 * World 5's rows keep `intensity` and no `aim`: they are the levels that are
 * already measured, shipped and referenced by the changelog, and re-aiming them
 * would silently rewrite a world nobody asked to change.
 *
 * ## Poistuneet ankkurit
 *
 * Jokainen alla oleva resepti perustelee lukunsa **käsintehdyillä kentillä**:
 * maailman kolme ensimmäistä ovat se mitta, johon neljä generoitua asetetaan.
 * Käsintehty kenttä voi kuitenkin vaihtua, ja silloin perustelu jää osoittamaan
 * tyhjään ilman että mikään punastuu — generaattoria ei ajeta joka päivä ja
 * `src/data/generated.js` on committoitu, joten mitään ei riko *tänään*. Se
 * rikkoutuu vasta seuraavassa ajossa, ja silloin väärästä syystä.
 *
 * Siksi tässä on taulu, ja se on **ainoa paikka koko tiedostossa jossa saa
 * lukea kentän jota peli ei toimita**:
 *
 *   POISTUNUT 6-3 -> 6-K
 *   POISTUNUT 7-2 -> 7-T
 *
 * `tools/verify.mjs` lukee tämän tiedoston tekstinä, laajentaa välit
 * (`6-1…6-3` on väite jokaisesta päiden välissä olevasta kentästä) ja vaatii
 * että jokainen nimetty kenttä on pelissä. Näille kahdelle riville se kääntyy
 * toisin päin: **vasemman puolen ei saa olla pelissä ja oikean puolen on
 * oltava.** Merkintä vanhenee siis itsestään punaiseksi jos poistunut kenttä
 * palaa — se ei ole poikkeuslista johon lisätään vaan väite joka voi olla
 * väärässä. Kumpikin puoli on tarkoituksellinen: viereinen palikkaväite
 * opetti samana päivänä mitä nimetystä poikkeuksesta seuraa.
 *
 * Mitä poistuminen maksoi lukuina, on kirjoitettu niiden maailmojen omiin
 * resepteihin (maailmat 6 ja 7). Lyhyesti: **lukuja ei mitattu uudelleen**,
 * koska korvaajat ovat pystykenttiä eivätkä ole samalla akselilla — tiheys on
 * merkkejä sadalla *sarakkeella* ja `measureClimb` mittaa *rivejä* — ja koska
 * uudelleenmittaus joka liikuttaisi yhtäkään reseptin lukua generoisi
 * toimitetun ja korpustarkistetun kentän uudelleen.
 *
 * Always run this with the corpus behind VGLC_DIR (DESIGN.md kohta 3, alakohta
 * 4). Without it the similarity check cannot run at all, and the report below
 * says `not checked` rather than pretending; regenerating that way would quietly
 * drop the one safeguard that makes the whole approach defensible.
 *
 *   VGLC_DIR="…" node tools/gen-levels.mjs [--seed N] [--world w1]
 *
 * and re-run tools/difficulty.mjs to see what it did.
 */

/*
 * MAAILMA 1, PAPULAAKSO — neljä kenttää niiden kolmen perään jotka opettavat.
 *
 * The three hand-made ones keep their ids, their order and their contents. That
 * is not caution, it is the only correct answer: `1-1`…`1-3` are the game's
 * teaching sequence, `tools/curriculum.mjs` measures the order they introduce
 * things in, save data and the secrets hash are keyed by level id, and the
 * hidden bricks are a hash of *position* — so renumbering would have re-rolled
 * every secret in the world for the sake of tidier numbers.
 *
 * So the new four are `1-4`…`1-7` and they are the world's second half: the
 * three teaching levels are the first arc, and these carry the world past what
 * they taught without introducing anything. That is a claim the one-screen rule
 * can check and does — it cares about *first* encounters, and there is nothing
 * in this vocabulary the first three levels have not already shown.
 *
 * The numbers come from world 1 and not from the corpus:
 *   density   1-1…1-3 carry **1.42 / 2.25 / 2.45 enemy markers per 100
 *             columns**, measured off the assembled grids. The rows below ask
 *             for 1.6…2.4, i.e. inside that band and never above its top.
 *   maxGap    three to five tiles of a measured six-tile budget, never six.
 *             World 1 is where a player learns that a gap is jumpable; the
 *             budget's own edge belongs to world 3, and `levels/world3.js`
 *             records what asking for it did to 3-1.
 *   minIntro  32 columns of floor before the first challenge. Measured: with
 *             the mined opening (15 columns) the power-0 bot died in 1-4's
 *             first four-tile hole at column 19. World 1's own hand-made
 *             opener spends 160 columns before its first pit.
 *   aim       70 → 115 → 98 → **104 → 78 → 96 → 112**, i.e. the shape decision:
 *             rise, breather, rise, breather, rise, peak. Measured after:
 *             104 / 77 / 95 / 112, every one inside two points of its aim.
 *
 * AND ONE MEASUREMENT WORTH KEEPING FOR THE OTHER WORLDS: with this vocabulary
 * world 1 tops out around **112**, against the 220 of its own fortress. That is
 * not the generator being weak, it is the teaching world being four mechanics
 * wide — the difficulty meter's two biggest terms are gaps and precision, and
 * world 1 caps the first and has no crumbling deck to feed the second. An
 * eight-level world 1 is therefore a *longer* world 1 and not a harder one: the
 * mean falls from 125.6 to 111.3, which is still the game's lowest and still
 * below world 2's 148.7.
 */
/*
 * WORLD 1'S VOCABULARY IS THE ONE ITS FIRST THREE LEVELS TEACH, AND NOTHING
 * ELSE. This is the one line in this file that was written by a gate rather
 * than by a plan.
 *
 * The first draft of these four used the full grass palette, and
 * `tools/curriculum.mjs` measured what that did: `1-4` became the first place in
 * the game to meet the **switch block** (column 119), the **flyer** (130) and
 * the **stink cloud** (108) — two pairs of them inside one 20-tile screen, which
 * is the one curriculum condition that is a gate. `1-5` became the first
 * crumbling deck and the first note block, and `1-7` the first pipe plant.
 *
 * Six mechanics moved into world 1 by accident, and four of them are the exact
 * four that `levels/world1.js` had deliberately moved *out* of 1-2 that morning,
 * with a paragraph each explaining why. A generator that quietly undoes the
 * day's editorial work is worse than one that cannot reach those worlds at all.
 *
 * So world 1 drops them. What is left is what 1-1…1-3 already taught: planks,
 * the walker, the shell, the cork guy, the star, the spike bed, pipes, bricks,
 * blocks and coins. Measured after: **zero new introductions in 1-4…1-6**, and
 * 1-7 introduces one thing, a place where the ground pound pays — which is
 * geometry the meter finds rather than a mechanic anybody placed.
 */
const WORLD1_DROP = ['switchWall', 'stinkGap', 'notes', 'crumbleWalk', 'plant'];
const WORLD1_SPECIES = ['g', 'g', 'k', 'c'];
const WORLD1 = [
  {
    id: '1-4', world: 'w1', theme: 'grass', width: 340, enemiesPer100: 2.4, maxGap: 5, aim: 104,
    drop: WORLD1_DROP, species: WORLD1_SPECIES, minIntro: 32,
  },
  {
    id: '1-5', world: 'w1', theme: 'grass', width: 300, enemiesPer100: 1.6, maxGap: 3, aim: 78,
    drop: WORLD1_DROP, species: WORLD1_SPECIES, minIntro: 32,
  },
  {
    id: '1-6', world: 'w1', theme: 'grass', width: 320, enemiesPer100: 2.2, maxGap: 5, aim: 96,
    drop: WORLD1_DROP, species: WORLD1_SPECIES, minIntro: 32,
  },
  {
    id: '1-7', world: 'w1', theme: 'grass', width: 340, enemiesPer100: 2.4, maxGap: 5, aim: 112,
    drop: WORLD1_DROP, species: WORLD1_SPECIES, minIntro: 32,
  },
];

/*
 * MAAILMA 3, JÄÄTÄVÄ VETO — samat neljä paikkaa, kovempi maailma, ja yksi asia
 * joka on oikeasti eri: tämän maailman lattia liukuu.
 *
 * The engine does that, not the level data, so nothing here spells it. What it
 * changes is the *shape* of the numbers: `levels/world3.js` says these levels
 * are laid out with more room to stop than the tile count suggests they need,
 * which in this generator's vocabulary is a lower density and a wider rest, not
 * a different piece list.
 *
 *   density   3-1…3-3 carry 2.72 / 3.96 / 3.82 markers per 100 columns; the
 *             rows below ask for 2.8…3.9, inside that band.
 *   maxGap    five tiles, one under the measured budget, in all four. Six was
 *             tried and taken back out: `tools/playable.mjs` measured the
 *             power-0 bot failing on the ice at columns 71, 18 and 70.
 *   minIntro  48 columns, three chunks' worth, and this is the ice's own
 *             number. Ice has its own friction, so a player who has just
 *             started walking is nowhere near running speed after the mined
 *             fifteen columns — measured, the bot reached 5 % and 7 % of two
 *             levels whose grass-floored twins cleared at 100 %. World 3's
 *             hand-made opener spends 64 columns before its first pit.
 *   aim       162 → 130 → 187 → **135 → 165 → 180 → 198**. The second breather
 *             is 3-4 and not a later level, which is the shape falling out of a
 *             measurement rather than a preference: 3-3 is the hand-made peak at
 *             186.5 and the ice vocabulary that survives the bot cannot beat it
 *             from a standing start, so the breather goes where the drop already
 *             is. Measured after: 134 / 166 / 178 / 198.
 */
const WORLD3 = [
  { id: '3-4', world: 'w3', theme: 'ice', width: 320, enemiesPer100: 3.0, maxGap: 5, aim: 135, minIntro: 48 },
  { id: '3-5', world: 'w3', theme: 'ice', width: 330, enemiesPer100: 3.6, maxGap: 5, aim: 165, minIntro: 48 },
  { id: '3-6', world: 'w3', theme: 'ice', width: 300, enemiesPer100: 2.8, maxGap: 5, aim: 180, minIntro: 48 },
  { id: '3-7', world: 'w3', theme: 'ice', width: 340, enemiesPer100: 3.9, maxGap: 5, aim: 198, minIntro: 48 },
];

/*
 * KOLMESATAA SIEMENTÄ KAHDEKSANKYMMENEN SIJAAN, ja se on mittaus eikä into.
 *
 * Kaikki neljä maailmaa alla hakevat `SEARCH` siemenellä. Perustelu on
 * `ATTEMPTS`in kommentissa kokonaisuudessaan; tässä on se luku joka sen
 * aiheutti: luumaailmassa **10 siementä 80:stä** rakensi säännöt läpäisevän
 * kentän, eli kahdeksankymmenen haku oli kymmenen kentän haku. Jokainen
 * ehdokas on yhä kenttä joka on läpäissyt kaikki säännöt, joten leveämpi haku
 * ei voi ostaa lukua huonommalla kentällä — se voi vain löytää useamman
 * kelvollisen kentän joista valita.
 */
const SEARCH = 240;

/*
 * MAAILMA 4, PIERUTEHDAS — ja pelin ahtain laatikko käyrällä.
 *
 * Maailman 4 ylä- ja alapuolella on **+17,5 ja +66,8**: se on kiinni maailmassa
 * 3 (171,8) alhaalta ja maailmassa 5 (256,2) ylhäältä, eli neljä uutta kenttää
 * eivät saa nostaa keskiarvoa yli maailman 5:n eivätkä päästää sitä maailman 3
 * alle. Maailmoissa 1 ja 3 oli tilaa yhteen suuntaan; täällä ei kumpaankaan.
 *
 *   density   4-1…4-F kantavat 6,8 / 7,1 / 8,4 / 6,8 vihollismerkkiä sadalla
 *             sarakkeella. Rivit alla pyytävät 7,0…8,4, eli maailman omalta
 *             väliltä eivätkä sen yli.
 *   maxGap    viisi ruutua mitatusta kuudesta. Kuusi on hyppybudjetin oma
 *             reuna ja se kuuluu linnakkeille; tehtaan lattia on tavallista
 *             maata, mutta `tools/playable.mjs` mittaa kulun voimatasolla 0 ja
 *             maailman 3 historia sanoo mitä budjetin reunaan asettuminen
 *             maksaa.
 *   minIntro  32 saraketta, sama kuin maailmassa 1: tehtaan lattia on
 *             kitkaltaan tavallinen, joten jään 48:aa ei tarvita, mutta
 *             louhittu 15 riittää vain siihen että botti kuolee ensimmäiseen
 *             kuoppaan.
 *   aim       188 → 141 → 227 → **175 → 195 → 215 → 240**. Muoto on: käsintehty
 *             notko 4-2:ssa, käsintehty huippu 4-3:ssa, sitten toinen
 *             hengähdys ja kolmen askelen nousu maailman omaan huippuun. Kolme
 *             on pelin pisin sallittu nousuputki, eli tämä maailma käyttää sen
 *             loppuun eikä yli.
 *
 * **Katto on rivillä 2 eikä rivillä 0, ja se on maailman 8 väitteen ehto.**
 * Finaalin väite "joka sarakkeen yllä on kiveä" mitataan riveiltä 0–1, ja sen
 * lähin kilpailija on tämä maailma 56,6 %:lla. Generoitu tehdaskenttä joka
 * kattaisi rivin 0 nostaisi maailman 4 osuuden kohti sataa ja veisi finaalilta
 * sen eron — ei siksi että maailma 8 muuttui vaan siksi että joku täytti
 * maailman 4. Ks. `ceilingPass` ja sen portti `verify.mjs`:ssä.
 */
const WORLD4 = [
  {
    id: '4-4', world: 'w4', theme: 'factory', music: 'factory', width: 320,
    enemiesPer100: 7.0, maxGap: 5, aim: 168, minIntro: 32, intensity: 1.05, attempts: SEARCH,
  },
  {
    id: '4-5', world: 'w4', theme: 'factory', music: 'factory', width: 340,
    enemiesPer100: 7.6, maxGap: 5, aim: 181, minIntro: 32, intensity: 1.30, attempts: SEARCH,
  },
  {
    id: '4-6', world: 'w4', theme: 'factory', music: 'factory', width: 300,
    enemiesPer100: 8.0, maxGap: 5, aim: 197, minIntro: 32, intensity: 1.35, attempts: SEARCH,
  },
  {
    id: '4-7', world: 'w4', theme: 'factory', music: 'factory', width: 350,
    enemiesPer100: 8.4, maxGap: 5, aim: 212, minIntro: 32, intensity: 1.55, attempts: SEARCH,
  },
];

/*
 * MAAILMA 5, JÄLKIPYYKKI — ja ainoa maailma jonka vanhat kentät eivät saa
 * liikkua tuumaakaan.
 *
 * Kolme ensimmäistä riviä alla ovat entisellään: sama siemenen laskukaava, sama
 * `intensity`, samat kentät tavu tavulta. Ne ovat pelin ainoat generoidut kentät
 * joihin muutosloki ja ROADMAP viittaavat nimeltä, ja uusi generointiajo arpoisi
 * maailman uusiksi ilman että kukaan on sitä pyytänyt. Uusilla riveillä on `aim`,
 * ja `seedFor` lisää maailman numeron summaan **vain** silloin kun rivillä on
 * `aim` — eli vanha polku kulkee entistä reittiä eikä uusi koske siihen.
 *
 * **Teemat ovat ne jotka pelaaja on jo nähnyt, eikä yhtään enempää.** Maailma 5
 * on jälkipyykki: se on maailmojen 1–4 uusintaotto, ja sen kolme ensimmäistä
 * kenttää kantavat ruohon, aavikon ja jään. Toinen kaari täydentää setin —
 * **yö** on aavikon toinen puoli (`2-N`) ja **tehdas** on maailma 4 — ja
 * kiipeää sitten takaisin niiden kahden läpi joilla on maailman kovin sanasto:
 * jään liukas lattia ja tehtaan murenevat lavat. Luu ja pilvi loistavat
 * poissaolollaan ja se on päätös eikä unohdus: ne ovat maailmoissa 6 ja 7, eli
 * tästä eteenpäin, ja bonusmaailma joka näyttää tulevan on juonipaljastus.
 *
 *   density   5-1…5-3 kantavat 9,8 / 9,0 / 10,6 merkkiä sadalla sarakkeella.
 *             Uudet rivit pyytävät 9,0…10,6, eli maailman omalta väliltä.
 *   maxGap    kuusi ruutua — mitattu budjetti kokonaan — paitsi jäällä viisi,
 *             mikä on maailman 3 oma mitattu luku ja sama syy: jäällä ei ehdi
 *             pysähtyä. Vanhat kolme eivät nimeä `maxGap`ia lainkaan, joten ne
 *             pitävät vanhan sillatun yhdeksän ruudun kuilunsa.
 *   minIntro  32 tavallisella lattialla, 48 jäällä.
 *   aim       215 → 185 → 279 → **200 → 235 → 260 → 275**. Muoto: käsintehty
 *             notko 5-2:ssa, generoitu huippu 5-3:ssa, hengähdys 5-4:ssä ja
 *             kolmen askelen nousu. Kolmen askelen nousu on pelin pisin
 *             sallittu, ja kaksi notkoa on kahdeksan kentän maailman muoto —
 *             eli tässä maailmassa muoto on **pakotettu** eikä valittu:
 *             ensimmäinen notko on jo 5-2:ssa ja 5-3:n 279 on korkeampi kuin
 *             mihin generoitu kenttä tällä sanastolla yltää, joten toisen
 *             notkon paikka on 5-4 ja loput on nousua.
 */
const WORLD5 = [
  { id: '5-1', world: 'w5', theme: 'grass', bg: 'hills', width: 210, intensity: 1.3 },
  { id: '5-2', world: 'w5', theme: 'desert', width: 230, intensity: 1.0 },
  { id: '5-3', world: 'w5', theme: 'ice', width: 240, intensity: 1.35 },
  {
    id: '5-4', world: 'w5', theme: 'night', width: 260,
    enemiesPer100: 9.0, maxGap: 6, aim: 200, minIntro: 32, intensity: 1.15, attempts: SEARCH,
  },
  {
    id: '5-5', world: 'w5', theme: 'factory', music: 'factory', width: 250,
    enemiesPer100: 9.6, maxGap: 6, aim: 228, minIntro: 32, intensity: 1.35, attempts: SEARCH,
  },
  {
    id: '5-6', world: 'w5', theme: 'ice', width: 240,
    enemiesPer100: 10.2, maxGap: 5, aim: 245, minIntro: 48, intensity: 1.45, attempts: SEARCH,
  },
  {
    id: '5-7', world: 'w5', theme: 'factory', music: 'factory', width: 265,
    enemiesPer100: 10.6, maxGap: 6, aim: 300, minIntro: 32, intensity: 1.55, attempts: SEARCH,
  },
];

/*
 * MAAILMA 6, LUULAAKSO — ja maailma jonka oma sanasto on jo kirjoitettu
 * ruudukkoon eikä palikoihin.
 *
 * Luun kaksi ehtoa (`ruleBoneSky`, `ruleBoneStands`) tekevät tästä maailmasta
 * generaattorin ahtaimman: taivas on auki **viisi riviä** kuun ja tähtien takia,
 * eikä mikään roiku ilmassa. Sanastosta putoaa siksi `highReward` (sen palkinto
 * istuu rivillä 4, eli suoraan kuun läpi) ja teemalla ei ole laavaa, torvia
 * eikä nuottipalikoita. Se on vähemmän tavaraa kuin tehtaalla, ja luku näkyy:
 * ilman tehtaan laavaa ja putkia tämän maailman kentät nojaavat kuiluun,
 * piikkipetiin ja murenevaan lavaan.
 *
 *   density   6-1 ja 6-2 kantavat 9,8 ja 8,3 merkkiä sadalla sarakkeella.
 *             Uudet rivit pyytävät 8,4…9,8, eli maailman omalta väliltä.
 *             Kolmas ankkuri oli 6-3:n 8,7 ja se on poistunut; kahdesta
 *             jäljellä olevasta mitattu väli on **8,3…9,8**, eli se sisältää
 *             yhä jokaisen pyydetyn luvun. Tämä perustelu selvisi
 *             ankkurin menetyksestä sellaisenaan.
 *   maxGap    **viisi, ja se on maailman oma mitattu luku eikä valinta**:
 *             6-1:n ja 6-2:n jokainen kuilu on tasan viisi ruutua leveä —
 *             kaksi kenttää, **yhdeksän kuilua**, ei yhtään poikkeusta.
 *             Mittaus oli kolme kenttää ja kahdeksantoista kuilua niin kauan
 *             kuin 6-3 oli olemassa: puolet todistuksesta lähti sen mukana,
 *             mutta jäljelle jäänyt puolisko ei sano mitään muuta kuin ennen.
 *             Käsi päätti tämän maailman hypyn jo kerran.
 *   minIntro  32. Luun lattia on kitkaltaan tavallista maata.
 *   aim       243 → 148 → 247 → **215 → 245 → 272 → 296**. Muoto on sama
 *             pakotettu kuin maailmoissa 4 ja 5: ensimmäinen notko on
 *             käsintehty (6-2), käsintehty huippu on korkeampi kuin mihin
 *             ensimmäinen generoitu kenttä yltää, joten toinen notko osuu
 *             6-4:ään ja loput kolme askelta ovat nousua — täsmälleen se kolme
 *             joka on pelin pisin sallittu.
 *
 *             Kolmas luku oli 271,5 (6-3) ja on nyt **247,3** (6-K). Se on
 *             pystykentän luku eli mitattu riveinä eikä sarakkeina
 *             (`measureClimb`), joten se ei ole sama mitta vaikka se on sama
 *             asteikko — ja juuri siksi se **luetaan tässä eikä syötetä
 *             tähän**. Se mitä perustelu tarvitsee, pitää silti: 247,3 on
 *             korkeampi kuin 6-4:n mitattu 215,7.
 */
const WORLD6 = [
  {
    id: '6-4', world: 'w6', theme: 'bone', music: 'bone', width: 300,
    enemiesPer100: 8.4, maxGap: 5, aim: 215, minIntro: 32, intensity: 1.2, attempts: SEARCH,
  },
  {
    id: '6-5', world: 'w6', theme: 'bone', music: 'bone', width: 330,
    enemiesPer100: 9.0, maxGap: 5, aim: 232, minIntro: 32, intensity: 1.45, attempts: SEARCH,
  },
  {
    id: '6-6', world: 'w6', theme: 'bone', music: 'bone', width: 310,
    enemiesPer100: 9.4, maxGap: 5, aim: 262, minIntro: 32, intensity: 1.62, attempts: SEARCH,
  },
  {
    id: '6-7', world: 'w6', theme: 'bone', music: 'bone', width: 350,
    enemiesPer100: 9.8, maxGap: 5, aim: 282, minIntro: 32, intensity: 1.7, attempts: SEARCH,
  },
];

/*
 * MAAILMA 7, KAASUKEHÄ — ja se maailma jossa jokainen kuoppa on pohjaton.
 *
 * Pilven kaksi ehtoa ovat luun peilikuva: **mikään ei seiso maassa** ja
 * **yksikään ohut pilvi ei ole tyhjän päällä**. Ensimmäinen vie portaat
 * (`stairs` on `X`-pyramidi), toinen vie kaiken mikä silloittaa kuopan laudalla
 * — eli torviportin ja laavan. Jäljelle jää maailma jonka koko sanasto on
 * hyppy, murtuva kansi ja se mitä lentää vastaan, ja maailman 7 oma lause
 * sanoo sen jo: **jokainen kuoppa hypätään eikä yhtäkään silloiteta.**
 *
 *   density   7-1 ja 7-3 kantavat 9,5 ja 9,4 merkkiä sadalla sarakkeella.
 *             Uudet rivit pyytävät 9,4…10,1, ja **ylin luku on velkaa**: 10,1
 *             oli 7-2:n, eikä 7-2 ole enää pelissä. Kahdesta jäljellä olevasta
 *             mitattu väli on **9,4…9,5**, joten 7-7:n 10,1 ei ole enää
 *             maailman omalta väliltä — se on korkeampi kuin yksikään kenttä
 *             jonka maailma yhä toimittaa.
 *
 *             Sitä ei lasketa alas, ja hinta sanotaan tässä ääneen: 7-7 on
 *             toimitettu, mitattu ja korpustarkistettu kenttä, ja rivin luvun
 *             muuttaminen generoi sen uudelleen. Yhden lauseen tarkkuus ei ole
 *             sen arvoinen että 27 generoidun kentän tavuista tulee liikkuvia.
 *             Velka luetaan siis reseptistä eikä muistilapusta, ja seuraava
 *             joka ajaa generaattorin näkee sen ennen kuin ajaa.
 *   maxGap    viisi. Sama mittaus kuin luussa: 7-1:n ja 7-3:n kuilut ovat
 *             neljä tai viisi ruutua, ei kertaakaan kuutta. **Tämä rivi ei
 *             menettänyt mitään**: se ei koskaan nojannut poistuneeseen
 *             kenttään, ja uudelleen mitattuna se on 15 kuilua kahdessa
 *             kentässä, leveydet 4 ja 5.
 *   minIntro  32.
 *   aim       253 → 203 → 279 → **230 → 262 → 288 → 310**. Sama pakotettu muoto
 *             kolmatta kertaa, ja huippu 310 on maailman oma: se on maailman 8
 *             keskiarvon (301,0) yläpuolella yhtenä kenttänä mutta maailman
 *             keskiarvo jää sen alle, mikä on juuri se ero jonka finaalin pitää
 *             pitää — viimeinen maailma ei ole yksi kova kenttä vaan kuusi.
 *
 *             Keskimmäinen luku oli 180,2 (7-2) ja on nyt **202,5** (7-T),
 *             pystykentän luku samalla varauksella kuin luussa. Notko on yhä
 *             notko — 252,5 → 202,5 → 278,7 — ja käsintehty huippu 278,7 on
 *             yhä korkeammalla kuin ensimmäinen generoitu kenttä 7-4 (233,7),
 *             eli molemmat lauseet joita muoto tarvitsee ovat yhä totta.
 */
const WORLD7 = [
  {
    id: '7-4', world: 'w7', theme: 'cloud', music: 'cloud', width: 300,
    enemiesPer100: 9.4, maxGap: 5, aim: 230, minIntro: 32, intensity: 1.2, attempts: SEARCH,
  },
  {
    id: '7-5', world: 'w7', theme: 'cloud', music: 'cloud', width: 330,
    enemiesPer100: 9.6, maxGap: 5, aim: 250, minIntro: 32, intensity: 1.35, attempts: SEARCH,
  },
  {
    id: '7-6', world: 'w7', theme: 'cloud', music: 'cloud', width: 320,
    enemiesPer100: 9.8, maxGap: 5, aim: 265, minIntro: 32, intensity: 1.6, attempts: SEARCH,
  },
  {
    id: '7-7', world: 'w7', theme: 'cloud', music: 'cloud', width: 350,
    enemiesPer100: 10.1, maxGap: 5, aim: 273, minIntro: 32, intensity: 1.75, attempts: SEARCH,
  },
];

const PLAN = [...WORLD1, ...WORLD3, ...WORLD4, ...WORLD5, ...WORLD6, ...WORLD7];

if (IS_MAIN) {
  /*
   * The measurement the aim is aimed at, imported rather than reimplemented.
   *
   * It is imported here and not at the top of the file because
   * `tools/difficulty.mjs` walks the whole game as it loads, which means it
   * throws if `src/data/worlds.js` names a level that does not exist yet. That
   * is the order this work has to happen in anyway — **generate, then wire** —
   * and the message below says so instead of leaving a stack trace to interpret.
   */
  let scoreRows = null;
  try {
    ({ scoreRows } = await import('./difficulty.mjs'));
  } catch (err) {
    console.error(`\n  tools/difficulty.mjs ei latautunut: ${err.message}`);
    console.error('  Todennäköinen syy: kartalla on solmu kenttään jota ei ole vielä generoitu.');
    console.error('  Järjestys on: generoi ensin, kytke kartalle vasta sitten.\n');
    process.exit(1);
  }

  const plan = ONLY_WORLD ? PLAN.filter((spec) => spec.world === ONLY_WORLD) : PLAN;
  if (!plan.length) {
    console.error(`\n  --world ${ONLY_WORLD}: ei generoitavia kenttiä.\n`);
    process.exit(1);
  }
  /* A partial run still has to write the whole file, or the worlds it did not
   * touch would vanish from `src/data/generated.js` and take their levels with
   * them. So the untouched ones are read back from what is committed. */
  const keep = plan.length === PLAN.length ? {}
    : (await import(join(ROOT, 'src/data/generated.js'))).GENERATED_LEVELS;

  const built = [];
  const failures = [];

  /*
   * HOW MANY SEEDS, AND WHY THE SEARCH KEEPS THE BEST RATHER THAN THE FIRST.
   *
   * Before, the loop stopped at the first seed whose level passed every rule,
   * because "passes" was the only question. With an `aim` there are two
   * questions and they are answered in this order: a level that breaks a rule is
   * not a candidate at any score, and among the candidates the closest to the
   * aim wins. So the loop never trades a rule for a number.
   *
   * HOW MANY IS A NUMBER ON THE ROW AND NOT A CONSTANT, and the reason is a
   * measurement rather than a preference.
   *
   * Eighty seeds is not eighty candidates. Every seed that breaks a rule is
   * thrown away before it is scored, and in the tightest theme most of them do:
   * measured in the bone world, **10 of 80** built a legal `6-4` and 7 of 80 a
   * legal `6-5`. A search over seven or ten levels is not a search, and it
   * shows as a range rather than as an error — `6-4`'s pool topped out at 325
   * and `6-7`'s at 214 with identical knobs, which is the seed pool talking and
   * not the level design.
   *
   * The default stays 80 and that is the whole point of making it a row. Worlds
   * 1 and 3 shipped their eight levels off an 80-seed search; widening it would
   * find a seed a fraction closer to an aim they already hit within 1.8 points,
   * and rewrite eight measured, committed levels for that fraction. Same
   * argument as world 5's seed formula: the search is part of how a level was
   * made, so a level that is already made keeps the search it was made with.
   */
  const ATTEMPTS = 80;

  /*
   * THE SEED, AND THE ONE TERM THAT IS THERE FOR HISTORY.
   *
   * World 5's three levels are in the repository, measured, and referenced by
   * the changelog and by ROADMAP; regenerating them is a decision nobody has
   * made ("uusi generointiajo arpoo maailman uusiksi"). So their seed is derived
   * by the *exact* expression that produced them — attempt, and the level's
   * digit — and that expression cannot be extended, because extending it moves
   * them.
   *
   * It also cannot be reused as it stands, and this is the trap worth naming:
   * it reads `id.charCodeAt(2)`, the digit after the dash, so `1-4` and `3-4`
   * would have drawn **the same seed and therefore the same level**. Two worlds
   * would have shipped an identical level with different tiles painted on it.
   * The world's own digit joins the sum for everything with an `aim`, which is
   * everything that was not already built.
   */
  const seedFor = (spec, attempt) => SEED + attempt * 7919 + spec.id.charCodeAt(2) * 104729
    + (spec.aim === undefined ? 0 : spec.id.charCodeAt(0) * 15485863);

  for (const spec of plan) {
    let best = null;
    const seen = [];
    const attempts = spec.attempts || ATTEMPTS;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const seed = seedFor(spec, attempt);
      const build = {
        seed,
        theme: spec.theme,
        targetWidth: spec.width,
        intensity: spec.intensity || 1,
        enemiesPer100: spec.enemiesPer100 === undefined ? null : spec.enemiesPer100,
        maxGap: spec.maxGap === undefined ? null : spec.maxGap,
        drop: spec.drop || [],
        species: spec.species || null,
        minIntro: spec.minIntro || 0,
      };
      const plain = buildLevel(build);
      let made = plain;
      let rows = plain.rows;
      let notes = [];

      const hot = TELEMETRY?.levels.get(spec.id);
      if (hot) {
        const tune = planTuning(hot, plain.trace);
        notes = tune.notes;
        if (tune.tuning.size) {
          made = buildLevel({ ...build, tuning: tune.tuning });
          rows = made.rows;
        }
      }
      const problems = validateGenerated(spec.id, rows, made, spec.theme);
      if (problems.length) { seen.push(problems[0]); continue; }
      const score = scoreRows(rows);
      const miss = spec.aim === undefined ? 0 : Math.abs(score - spec.aim);
      if (!best || miss < best.miss) best = { rows, notes, score, miss, seed };
      if (spec.aim === undefined) break;      // world 5: first valid seed, as before
    }
    if (!best) {
      failures.push(`${spec.id}: ${attempts} siementä, yksikään ei kelvannut `
        + `(esim. ${seen[0] || 'ei syytä'})`);
      continue;
    }
    const orig = await corpusHits(best.rows);
    if (orig.checked && orig.hits > 0) {
      failures.push(`${spec.id}: ${orig.hits} eight-column windows match the corpus`);
      continue;
    }
    built.push({ spec, ...best, orig });
  }

  /*
   * Coverage, asked of the world and not of the level.
   *
   * The hand-made worlds hand out mechanics one per level — the star in 2-1, the
   * secret in 2-2, the switch in 2-3 — because a thing you meet in every level
   * is scenery. So the promise here is the world's: somewhere in its generated
   * levels there is a crumbling deck and somewhere there is a switch, and which
   * level got which is the weighting's business.
   *
   * It is a hard failure rather than a warning for the same reason the rule
   * checks are: a seed that builds a world with no switch block in it is a seed
   * we do not ship, and the run should say so instead of leaving it to whoever
   * reads the numbers afterwards. Pick another seed.
   *
   * Asked per world and not once over everything, which is the change eight
   * worlds forced: one pooled check would have let world 1 borrow world 3's
   * switch block and report a world that has none as covered.
   *
   * AND WHAT IS ASKED FOR IS PER WORLD TOO, which is the second change and the
   * one that needs a reason rather than an explanation. The list used to be
   * three characters for everybody. It cannot be: world 1's generated levels are
   * deliberately built out of the vocabulary its first three levels teach (see
   * `WORLD1_DROP`), and that vocabulary contains no crumbling deck and no switch
   * block — so demanding them there would demand exactly the thing the world was
   * measured to not want. The list is therefore declared next to the levels it
   * describes, where the reason for its contents is visible, and the default is
   * still all three.
   */
  const COVERS = {
    /* World 1 has one, and it is the one 1-3 already teaches. */
    w1: [['*', 'star block']],
  };
  const COVERS_DEFAULT = [['%', 'crumbling platform'], ['S', 'switch block'], ['*', 'star block']];
  for (const world of new Set(plan.map((spec) => spec.world))) {
    const mine = built.filter((b) => b.spec.world === world);
    if (mine.length !== plan.filter((spec) => spec.world === world).length) continue;
    const grid = mine.map(({ rows }) => rows.join('')).join('');
    for (const [ch, name] of COVERS[world] || COVERS_DEFAULT) {
      if (!grid.includes(ch)) failures.push(`${world}: no ${name} anywhere in the world`);
    }
  }

  if (failures.length) {
    console.error('\nGeneration failed:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  const entry = (id, def) => {
    const lines = def.rows.map((r) => `      ${JSON.stringify(r)},`).join('\n');
    return `  '${id}': {
    theme: '${def.theme}', bg: '${def.bg}', music: '${def.music}', origin: '${def.origin}',
    rows: [
${lines}
    ],
  },`;
  };
  const madeDefs = Object.fromEntries(built.map(({ spec, rows, orig }) => [spec.id, {
    theme: spec.theme,
    bg: spec.bg || THEME_RULES[spec.theme].bg,
    music: spec.music || 'level',
    origin: originWord(orig),
    rows,
  }]));
  const all = { ...keep, ...madeDefs };
  const order = PLAN.map((spec) => spec.id).filter((id) => all[id]);
  const body = order.map((id) => entry(id, all[id])).join('\n');

  const out = `/**
 * GENERATED FILE — do not edit by hand.
 *
 *   node tools/mine-pacing.mjs     (once, with VGLC_DIR set)
 *   node tools/gen-levels.mjs      (rebuilds this file)
 *
 * The pacing comes from tools/pacing-stats.json; every set piece in here is
 * this game's own. See the header of tools/gen-levels.mjs for the reasoning.
 *
 * \`origin\` on every level is the ONE field in this file that is about where the
 * level came from rather than what is in it, and the generator writes it rather
 * than a person:
 *
 *   'checked'      the corpus was behind VGLC_DIR and every eight-column window
 *                  of this level was compared against it, with zero matches
 *   'not checked'  there was no corpus, so the comparison did not happen — which
 *                  is not "no matches" but the absence of an answer
 *
 * \`tools/verify.mjs\` reads it and refuses the two ways it could lie: a level
 * marked checked in an environment where nothing could have checked it, and a
 * level marked unchecked in an environment where the corpus is right there.
 * \`VGLC_DIR=… node tools/originality.mjs\` answers the question directly for the
 * data as committed, without regenerating anything.
 *
 * Seed: ${SEED}${TELEMETRY ? `
 * Shaped by playtest telemetry: ${TELEMETRY_FILE}, ${TELEMETRY.events} events` : ''}
 */

export const GENERATED_LEVELS = {
${body}
};
`;

  await writeFile(join(ROOT, 'src/data/generated.js'), out);

  console.log(`\nGenerated ${built.length} levels with seed ${SEED}:\n`);
  for (const { spec, rows, orig, score } of built) {
    const cols = rows[0].length;
    const grid = rows.join('');
    const enemies = grid.split('').filter((ch) => ENEMY.has(ch)).length;
    const coins = grid.split('').filter((ch) => ch === 'o').length;
    const n = (ch) => grid.split(ch).length - 1;
    // The new vocabulary, counted out loud: a mechanic that is in the engine and
    // absent from the content is the failure mode this line exists to catch.
    const bricks = n('B');
    const secrets = rows.flatMap((row, y) => [...row]
      .map((ch, x) => (ch === 'B' && hidesSomething(x, y) ? 1 : 0))).reduce((a, b) => a + b, 0);
    console.log(`  ${spec.id}  ${String(cols).padStart(3)} cols   ${
      String(enemies).padStart(2)} enemies   ${String(coins).padStart(2)} coins   `
      + `originality ${orig.checked ? `${orig.hits} corpus matches` : 'not checked (set VGLC_DIR)'}`);
    console.log(`        ${n('%')} crumbling  ${n('S')} switch  ${n('*')} star  `
      + `${bricks} bricks of which ${secrets} hide something`);
    if (spec.aim !== undefined) {
      console.log(`        vaikeus ${score.toFixed(1)}, tavoite ${spec.aim} `
        + `(ero ${(score - spec.aim).toFixed(1)})`);
    }
  }

  if (TELEMETRY) {
    console.log(`\nTelemetry: ${TELEMETRY_FILE}, ${TELEMETRY.events} events`
      + `  (cluster >= ${RULES.cluster}, attempts elsewhere >= ${RULES.elsewhere})\n`);
    let acted = 0;
    for (const { spec, notes } of built) {
      for (const note of notes) console.log(`  ${spec.id}  ${note}`);
      acted += notes.length;
    }
    for (const id of TELEMETRY.levels.keys()) {
      if (!PLAN.some((spec) => spec.id === id)) {
        console.log(`  ignored  ${id}  hotspots found, but this level is not generated here`);
      }
    }
    // A near-miss is worth a line each; the long tail of one-off deaths is not,
    // so it gets counted instead of listed.
    for (const ig of TELEMETRY.ignored.filter((i) => i.code === 'grind')) {
      const where = ig.from === ig.to ? `col ${ig.from}` : `cols ${ig.from}-${ig.to}`;
      console.log(`  ignored  ${ig.level}  ${ig.kind} ${where} (${ig.count})  —  only `
        + `${ig.elsewhere} attempts ended elsewhere, want ${RULES.elsewhere}`);
    }
    const thin = TELEMETRY.ignored.filter((i) => i.code === 'thin');
    for (const id of new Set(thin.map((i) => i.level))) {
      const mine = thin.filter((i) => i.level === id);
      console.log(`  ignored  ${id}  ${mine.length} more spot${mine.length === 1 ? '' : 's'} under the `
        + `${RULES.cluster}-event threshold (biggest ${Math.max(...mine.map((i) => i.count))})`);
    }
    if (!acted && !TELEMETRY.ignored.length) console.log('  nothing in the log to act on');
  }

  console.log(CORPUS_DIR
    ? `\n  alkuperäisyys tarkistettu korpusta vasten (${CORPUS_DIR})`
    : '\n  ALKUPERÄISYYTTÄ EI TARKISTETTU — VGLC_DIR asettamatta (DESIGN.md kohta 3)');
  console.log('\n  wrote src/data/generated.js\n');
}
