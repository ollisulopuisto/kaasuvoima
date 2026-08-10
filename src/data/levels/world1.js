/**
 * World 1 — the grass world, and the only one that has to teach. Every level
 * here is short on ideas by design: one new thing at a time, on ground with
 * nothing to fall into.
 *
 * **"Short on ideas by design" is now a measured claim rather than an
 * intention** (9.8.2026). `tools/curriculum.mjs` counts what each level is the
 * first place in the game to meet, and it found this world's opening sentence
 * to be false of exactly one level: 1-2 introduced **seven** things at once —
 * the beanstalk, the warp pipe, the hidden bands, the note block, the flyer,
 * the pipe plant and the stink cloud — where no other level in the game
 * introduced more than three. As the game's *second* level that is the worst
 * possible place for it, so the four that had no business being there were
 * moved on and the world now reads:
 *
 *   1-1  planks you can jump up through, the walker, the shell
 *   1-2  the beanstalk, the warp pipe, and what they lead to
 *   1-3  the cork guy, the super star, the spike bed
 *   1-F  lava, the flyer, the boss
 *
 * Four each, three each, and nothing anywhere within one screen of another
 * introduction — `tools/verify.mjs` asserts both, so this list cannot quietly
 * stop being true. Where the four went is recorded at each level below.
 *
 * Nothing was deleted to get there. Every change is a chunk swapped for another
 * chunk of the same width, which is also why not one hidden brick moved: those
 * are a hash of position (`src/core/secrets.js`), so an *inserted* chunk would
 * have re-rolled every secret after it in the level.
 *
 * ## Kahdeksan kenttää, ja miksi kolme ensimmäistä eivät liikkuneet (9.8.2026)
 *
 * Maailma on nyt kahdeksan kenttää: nämä kolme, neljä generoitua (`1-4`…`1-7`,
 * `tools/gen-levels.mjs`) ja linnake. Muoto ja sen perustelu ovat portissa
 * (`tools/verify.mjs`, "kahdeksan kentän maailmassa on kaksi hengähdystä"), ja
 * yksi asia kannattaa lukea täältä: **uudet kentät tulivat perään eivätkä
 * väliin, ja se on tämän tiedoston takia.**
 *
 * Numeroiden uudelleenjärjestäminen olisi ollut siistimpää ja se olisi maksanut
 * kolme asiaa joista mikään ei ole kosmeettinen. Yllä oleva opetusjärjestys on
 * mitattu tunnisteittain (`tools/curriculum.mjs`), tallennus ja salaisuuslaskuri
 * on avainnettu tunnisteella, ja **piilotetut tiilet ovat sijainnin hajautus** —
 * eli kentän siirtäminen olisi arponut sen jokaisen salaisuuden uudelleen. Sama
 * peruste kuin ylempänä: siksi tässäkin vaihdetaan, ei lisätä väliin.
 *
 * Neljä uutta kenttää eivät esittele mitään: ne ovat maailman toinen kaari, ja
 * kolme ensimmäistä ovat yhä se osa joka opettaa.
 */

import { GENERATED_LEVELS } from '../generated.js';

/** Which of the generated levels belong to this world — the file holds them all. */
const generated = Object.fromEntries(Object.entries(GENERATED_LEVELS)
  .filter(([id]) => id.startsWith('1-')));

export const WORLD1_LEVELS = {
  /*
   * The last `flat` chunk is a second `pipe_short`, and that is a claim about
   * the warp pipe rather than about this level.
   *
   * A warp pipe is drawn as an ordinary two-tile pipe with a slow shine in its
   * throat, and the coin hint over it is deliberately the *ordinary* pipe's
   * coin row, tile for tile — the hint has to say "a pipe", never "this pipe".
   * That only works if ordinary short pipes are the common case. They were not:
   * four of the game's six two-tile floor pipes were warps, so "press down on
   * any short pipe with coins over it" paid off two times in three, and a
   * secret you can guess two times in three is a routine. 1-1 is where the
   * habit of running over a pipe lid for its coins is taught and 1-1 hides
   * nothing at all, so it is the right place for one more pipe that goes
   * nowhere. `tools/verify.mjs` now holds the whole game to at most one warp in
   * three.
   */
  '1-1': {
    theme: 'grass', bg: 'hills', music: 'level',
    chunks: [
      'start', 'flat', 'power', 'walker', 'qrow', 'coins',
      'walker', 'pipe_short', 'flat', 'power', 'pit_s', 'plat_hi',
      'walkers', 'pipe_tall', 'coin_stack', 'pit_plat', 'shell', 'steps_up',
      'pipe_short', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * World 1's hidden level, and the only one in the world: a discovery stops
   * being a discovery if there is one in every corner. The beanstalk at column
   * 150 climbs into the sky band, the pipe at column 229 drops into the cave
   * band, and neither is on the way to the flag — the ground route is exactly
   * the level it was before.
   *
   * **AND NOW IT IS THAT AND NOTHING ELSE.** Measured, this level used to be
   * the first place in the game to meet seven separate things; the next worst
   * level in the game managed three. The four that had no argument for being
   * here were paid out to levels that did, chunk for chunk and width for width:
   *
   *   - `note_pair` -> `coins`. The note block's first appearance is now 2-2,
   *     which already had one, and 2-3 took a second so the mechanic still
   *     turns up twice. Two bouncing blocks were never this level's lesson and
   *     they sat 65 columns before the beanstalk, i.e. in the run-up to it.
   *   - `pipe_plant` -> `pipe_short` (moved on to chunk 12, see below). The
   *     plant's first appearance is now 2-1, where it already stood next to the
   *     kurnuttaja for a reason that file argues at length. Here it was worse
   *     than surplus: at column 165 it was **fifteen columns from the
   *     beanstalk**, so the one screen that introduces the way into the sky
   *     also introduced a new enemy species. That pair is one of the six the
   *     one-screen rule now forbids.
   *   - `flyer` -> `walkers`. The flyer's first appearance is now 1-F, which
   *     already has one between the pillars on flat floor with nothing else in
   *     the window.
   *   - `clouds` -> `coin_stack`. The stink cloud's first appearance is now
   *     2-2. It bobs at head height and drifts at you, which is a thing to
   *     learn on its own screen and not on the screen after a warp pipe.
   *
   * What arrived instead is one thing, and it belongs here: **`pipe_short` at
   * chunk 12, one chunk before the warp pipe.** 2-2 already does exactly this
   * and says why — a pipe that goes somewhere is only a discovery in a level
   * that also has pipes that do not, or the single pipe in the level is a
   * signpost. 1-2 was the level that most needed it and did not have it: its
   * only two-tile floor pipe was the warp itself.
   *
   * It sits at chunk 12 rather than chunk 10 because of the beanstalk's own
   * coins. `verify.mjs` asserts that every two-tile floor pipe in the game
   * carries an identical coin row, and at chunk 10 the vine chunk's last coin
   * fell eight columns to the pipe's left — inside the window the check reads,
   * so the decoy would have measured as a differently-hinted pipe. Two chunks
   * later there is nothing overhead for sixteen columns either side.
   *
   * Measured: 122.8 -> 114.6 on the difficulty meter, which keeps the world's
   * shape (70 -> 115 -> 98, one dip) and is the honest price of taking three
   * enemies out of a teaching level.
   */
  '1-2': {
    theme: 'grass', bg: 'hills', music: 'level',
    chunks: [
      'start', 'flat', 'power', 'plat_float', 'pit_s', 'coins',
      'walkers', 'brick_wall', 'pit_plat', 'beanstalk', 'walkers', 'pit_bridge',
      'pipe_short', 'plat_steps', 'warp_pipe', 'power_hi', 'coin_stack', 'pit_l',
      'ledge', 'shell', 'sky_run', 'steps_down', 'run_up', 'goal', 'goal_end',
    ],
    sky: [[144, 'sky_garden']],
    cave: [[224, 'cave_room']],
  },
  /*
   * `corks` and `pipe_pair` changed places, and that swap is the whole fix for
   * the second of the three crowded screens.
   *
   * The star block does not only hand out a star: `chunks/grass.js` puts a
   * walker and a cork guy in the same sixteen columns on purpose, because "a
   * nuisance normally and a straight run with a star" is the lesson. That
   * argument still holds — and it only holds if the cork guy is a nuisance the
   * player has already met. It was not: the cork in `star_block` at column 204
   * WAS the first cork guy in the game, nine columns from the first super star,
   * so the level introduced the tool and the thing the tool answers on one
   * screen and taught neither.
   *
   * Moving `corks` from chunk 13 to chunk 9 puts the first cork guy at column
   * 149 on flat open ground with nothing else in the window, 46 columns before
   * the star. The star block's own cork is then the third one the player has
   * seen and reads as the level intended. `pipe_pair` takes the vacated slot;
   * it is scenery either way, and swapping these two rather than moving
   * `bricks` is deliberate — `bricks` is the level's only brick row and hidden
   * bricks are a hash of position, so moving it would have re-rolled which of
   * them hide anything.
   *
   * The other two changes are the flyer and the stink cloud leaving world 1's
   * middle levels for 1-F and 2-2 (see 1-2 above): `coins` -> `pipe_short`
   * at chunk 4 and `flyer` -> `plat_float` at chunk 5 keep the coin reward and
   * add the world's fourth ordinary short pipe, and `clouds` -> `ledge` at
   * chunk 18 trades two floating enemies for a shelf and a walker. 101.2 ->
   * 98.0, still the world's dip and still above 1-1.
   */
  '1-3': {
    theme: 'grass', bg: 'peaks', music: 'level',
    chunks: [
      'start_high', 'plat_hi', 'power', 'sky_run', 'pipe_short', 'plat_float',
      'pit_plat', 'plat_steps', 'walkers', 'corks', 'bricks', 'pit_l',
      'star_block', 'pipe_pair', 'shell', 'coin_stack', 'spikes', 'steps_up', 'ledge',
      'power', 'run_up', 'goal', 'goal_end',
    ],
  },
  /* `1-4`…`1-7`, generated. They sit here rather than at the top of the object
   * because `levelIds()` hands its key order straight to the world map, so this
   * spread is also the play order. */
  ...generated,
  /*
   * JUURILINNA, ja pelin ensimmäinen linnake joka on tämän maailman oma
   * (10.8.2026).
   *
   * Tämä kenttä oli aiemmin `fort_hall`, `fort_power`, `fort_blocks`,
   * `fort_gap`, `fort_spikes`, `fort_pillars` — eli täsmälleen samat palikat
   * samassa tehtävässä kuin 2-F, 3-F, 6-F ja 7-F. `tools/variety.mjs` mittasi
   * mitä se maksoi: puolet pelin linnakkeista ei tuonut peliin yhtään uutta
   * kahdeksan sarakkeen muotoa, ja `fort_gap` yksinään oli kahdessakymmenessä
   * paikassa seitsemässä maailmassa. Sanasto on nyt tämän maailman oma
   * (`chunks/fortresses.js`, `root_*`) ja sen lause on maailman 1 oma lause:
   * **käytävällä on parvi.**
   *
   * Kolme ensiesittelyä säilyy ja niiden välimatkat kasvoivat. Lava on nyt
   * sarakkeessa 105, lentäjä 55:ssä ja pomo 156:ssa — eli kaikki kolme ovat yli
   * viidenkymmenen sarakkeen päässä toisistaan, kun ennen lava ja lentäjä
   * olivat 34:n. Portti vaatii kaksikymmentä.
   *
   * **Ja se yksi tunnettu vika korjaantui sivutuotteena.** Vanha 1-F reputti
   * SEURA-ehdon lavan kohdalla, koska `fort_gap` pani kuoren kolme saraketta
   * kouruun; `root_moat` ei pane kuiluun mitään ja sen vauhdinottopuolella on
   * yhdeksän saraketta lattiaa. Se ei ollut tämän työn tavoite eikä sitä
   * kirjata voitoksi — se kertoo vain että jaettu käytävä oli myös se paikka
   * johon vika oli jäänyt asumaan.
   */
  '1-F': {
    theme: 'fortress', bg: 'none', music: 'fortress', boss: true, bossVariant: 0,
    chunks: [
      'start', 'root_gate', 'root_pantry', 'root_drop', 'root_scale',
      'root_vault', 'root_moat', 'root_drop', 'root_moat', 'boss_arena',
    ],
  },
};
