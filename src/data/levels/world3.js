/**
 * World 3 — ice. The chunk playlists look much like world 2's on paper; what
 * makes them harder is the floor, so the levels here are laid out with more
 * room to stop than the tile count suggests they need.
 *
 * The world's three optional mechanics are one per level on purpose, and which
 * one went where is a claim about the level rather than about the mechanic:
 *
 *   3-1  the star, because the opener is where a reward should be unmissable
 *   3-2  the hidden bands, because the breather is where curiosity is affordable
 *   3-3  the crumbling floor, because that is the level that is about the floor
 *
 * The switch in 3-2 was already here. That makes 3-2 the level with things to
 * find and 3-1/3-3 the levels with things to survive, which reads as an
 * editorial split rather than a pile — and it costs nothing on the curve,
 * because a switch and a secret are both optional and both score at or below
 * zero (see the numbers in the changelog entry).
 *
 * ## Kahdeksan kenttää (9.8.2026)
 *
 * Maailma on nyt kolme käsintehtyä, neljä generoitua (`3-4`…`3-7`) ja linnake.
 * Perustelu tunnisteiden säilyttämiselle on sama kuin maailmassa 1 ja luettavissa
 * sieltä; tässä maailmassa on lisäksi oma syynsä olla siirtämättä `3-2`:ta:
 * siellä on maailman ainoa piilokaista, ja sekä sisään- että uloskäynti on
 * mitattu sarakkeen tarkkuudella.
 *
 * Yksi luku kannattaa jättää tähän seuraavaa maailmaa varten: **generaattorin
 * kuiluraja on tämän maailman oma oppi.** `3-1`:n pitkä perustelu alla kertoo
 * mitä budjetin reunalla olevat kuilut tekivät sille, ja `gen-levels.mjs`:n
 * `maxGap` on suoraan se sääntö numerona — hengähdyskenttä pyytää neljää ruutua
 * kuudesta, huippukenttä kaikki kuusi.
 */

import { GENERATED_LEVELS } from '../generated.js';

/** Which of the generated levels belong to this world — the file holds them all. */
const generated = Object.fromEntries(Object.entries(GENERATED_LEVELS)
  .filter(([id]) => id.startsWith('3-')));

export const WORLD3_LEVELS = {
  /*
   * `ice_star` sits between the plain spike bed and `cork_gap`, and that order
   * is the point. The level teaches the spiky walker in chunk 2 on empty
   * ground, meets a spike bed unarmed at column 192, and only then hands over
   * the tool — and what follows the star is a gap with cork guys standing
   * either side of it. The star deletes the cork guys and does nothing at all
   * about the gap, which is the whole lesson: it is protection from the
   * inhabitants, never from the level.
   *
   * The pits are `ice_pit` and `ice_twin` and not the common `pit_s` and
   * `pit_twin`, which is the one thing about this level that was changed on
   * evidence rather than on taste. Correcting `tools/jump-budget.json`
   * (9.8.2026 — the file had claimed a 200 px running carry since the commit
   * that wrote it, measured 155) dropped the gap budget from eight tiles to
   * six, and the difficulty meter, which prices a gap as (span / budget)²,
   * then read this level at 204 against 3-2's 133 and 3-3's 174. **The
   * world's opening level was its hardest**, and the single reason was that
   * three of its gaps sat at or one tile under the budget: `pit_s` at six of
   * six, `pit_twin` at five and five with a two-tile island between them.
   *
   * That was true before the file was corrected — the stale number was hiding
   * it, not causing it. So the fix is the level and not the meter: 3-1 lost
   * the two gaps that had no argument for being that wide, and kept
   * `cork_gap`, which does have one (it is the star's lesson, above). Why the
   * gaps and not the enemies: the meter reads 3-1 as the world's *gentlest*
   * level for enemies (24.9 against 3-2's 36.7), so widening the difference
   * there would have flattened the level rather than shaped it.
   *
   * Deliberately not done: making 3-3 harder. It would have produced the same
   * "rises overall" verdict out of the same measurements, and would have been
   * tuning the number instead of the level.
   *
   * After: 3-1 162 → 3-2 133 → 3-3 174, which is the shape the world was
   * always supposed to have.
   */
  '3-1': {
    theme: 'ice', bg: 'peaks', music: 'jaatie',
    /* Maastopassi, ks. `data/terrain.js`. Maailman 3 kahdesta käsintehdystä
     * ulkoilmakentästä tämä; 3-3 jäi ilman, syy sen omassa kommentissa. */
    terrain: true,
    chunks: [
      'start', 'spike_walk', 'power', 'ice_first', 'walkers', 'ice_pit', 'qrow',
      /* `plat_hi` → `kaksitie`: sama nousu ylemmälle tasolle, mutta nyt ylempi
       * ja alempi reitti kulkevat saman matkan limittäin ja yhtyvät takaisin.
       * Vaihto eikä lisäys, kuten aina maailmojen käyrän takia. */
      'flyer', 'kaksitie', 'shell', 'pit_l', 'heartburn_pair', 'ice_twin',
      'spikes', 'ice_star', 'cork_gap', 'sky_run', 'spring_jet', 'pit_plat', 'power_hi',
      /* `plat_steps` → `pitkarinne`: sama nousu portaina, mutta alas tullaan
       * kahdeksan laatan rinnettä. Vaihto eikä lisäys, koska maailman käyrä on
       * portti — ks. sama perustelu maailmassa 1. Ja juuri jäämaailmaan,
       * koska se on ainoa jonka maa on jo valmiiksi vauhdista. */
      'pitkarinne', 'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * World 3's hidden level, and the only one in the world: a discovery stops
   * being a discovery if there is one in every corner. The beanstalk at column
   * 112 climbs into the sky band, the warp pipe at column 228 drops into the
   * cave band, and neither is on the way to the flag — the ground route is
   * exactly the level it was before, one chunk of coins and one pipe longer.
   *
   * The cave room's exit pipe lands at columns 254-255, which is the middle of
   * a `flyer` chunk: bare floor, nothing overhead for eleven rows. That is a
   * measurement and not a coincidence — the biggest power level is 21x43 px, so
   * a brick two columns over on the *surface* would be enough for the warp to
   * refuse and seal the largest player into the bonus room.
   *
   * Why this level and not 3-1 or 3-3: 3-2 is the world's deliberate dip, and a
   * hidden area needs a player with attention to spare. Somewhere the level is
   * already pressing is where a secret goes unfound.
   *
   * **`spikes` -> `pipe_short` at chunk 13, one chunk before the warp**, and it
   * is the same argument 2-2 made when it added its decoy: a pipe that goes
   * somewhere only reads as a discovery in a level that also has pipes that do
   * not. This level had a warp and no ordinary pipe at all, which made its one
   * pipe a signpost — and across the whole game four of six two-tile floor
   * pipes were warps, so the habit "press down on any short pipe with coins
   * over it" paid two times in three. `verify.mjs` now caps that at one in
   * three; measured 4/13 = 30,8 %.
   *
   * The spike bed is what paid for it, and it could: the spike row's first
   * appearance is 1-3, so nothing is introduced or lost, and this is the
   * world's dip by design (133.4 -> 130.3, world shape 162 -> 130 -> 187,
   * still one dip). Two other slots were tried first and the reason this one
   * won is `tools/playable.mjs`: putting the pipe at chunk 6 in place of
   * `clouds` left the power-0 bot stuck at column 170 on the plank bridge —
   * a two-tile obstacle 60 columns earlier is enough to change what it arrives
   * with. The ground route stays passable at the smallest size (DESIGN.md §5)
   * and that is checked, not assumed.
   */
  '3-2': {
    theme: 'ice', bg: 'peaks', music: 'jaatie',
    /* Tämän teeman kennokenttä. Perustelu rajaukselle ja sille mitä lippu
     * koskee on 1-3:ssa (`world1.js`) — se on se kenttä josta tämä lähti. */
    skin: 'hexgrid',
    chunks: [
      'start_high', 'sky_run', 'power', 'plat_steps', 'flyer', 'pit_l',
      'clouds', 'beanstalk', 'switch_wall', 'cloud_run', 'pit_bridge', 'shell',
      'plat_float', 'pipe_short', 'warp_pipe', 'flyer', 'pit_plat', 'heartburn_pair',
      /* `corks` → `ice_kuura`: kuuran ensiesittely siirtyi 8-1:stä tänne, ja
       * tämä on se maailma jonka oma aihe se on — laji joka jättää jäätä
       * jälkeensä kuuluu jäämaailmaan. Vaihto eikä lisäys, kuten aina. */
      'ice_kuura', 'walkers', 'ledge', 'power', 'run_up', 'goal', 'goal_end',
    ],
    sky: [[112, 'sky_garden']],
    cave: [[228, 'cave_room']],
  },
  /*
   * `ice_crumble` goes between `corks` and `brick_wall`, and both neighbours
   * were chosen rather than accepted. `corks` is flat, so the player arrives at
   * whatever speed they like and the catwalk (columns 244-252) is the first
   * thing that is not ground. `brick_wall` is what the run-off empties into,
   * and it opens with six tiles of floor and then a stack of bricks — because
   * the one way to spend twelve tiles of run-off and still be moving is to jump
   * off the end at P-speed, which carries 245 px, and the thing waiting fifteen
   * tiles away had better be a wall you bump into rather than a hole you fall
   * down. The chunk's own run-off already covers letting go (measured: rest at
   * column 262, run-off ends at 264); this is the belt for the braces.
   */
  /*
   * KURNUTTAJA, TOINEN JA VIIMEINEN KOKO PELISSÄ.
   *
   * `pit_l` becomes `pit_croak`, and it swaps places with `plat_float` so that
   * the occupied hole comes *after* a flat chunk instead of directly after the
   * brick wall. 2-1 introduces the creature in the one place a bare pit already
   * stood; this is the second and last one in the game, because a hazard that
   * turns up in every hole stops being a hazard and becomes terrain — and
   * terrain is something a player looks at once.
   *
   * Why 3-3 and not 3-1 or 3-2: this is world 3's last level and its measured
   * peak, and the other two already carry the world's own new ideas (3-1 the
   * star, 3-2 the hidden bands and the switch). 3-1's long comment above also
   * explains why that level was deliberately *softened*, which settles it.
   *
   * THE REORDER IS THE INTERESTING PART, and it was found by the tools rather
   * than by looking. Left where `pit_l` was, the chunk before this one is
   * `brick_wall`: a four-tile stack you clear with a full sixteen-frame hold
   * and come down off with the run spent. `pit_l` survived that because it
   * carries a stepping stone; a bare hole did not, and `tools/playable.mjs`
   * drowned in it at power level 0 — a level the smallest size cannot pass is
   * broken rather than hard (DESIGN.md §5). Widening or narrowing the hole was
   * the wrong lever, because the fault was the *approach*: what this chunk
   * needs is ground to build speed on, and `plat_float` is sixteen tiles of
   * exactly that. Both chunks are still here and the level is the same length.
   *
   * Measured after: 174.3 -> 186.5, and the world's shape is unchanged at
   * 162 -> 133 -> 187, still one dip. Most of that rise is the lost stepping
   * stone rather than the creature — `tools/difficulty.mjs` prices a plank over
   * a pit and cannot tell "a different pit" from "a harder one".
   */
  /*
   * Chunk 1 is `pipe_short` where it was `flat`: sixteen columns of empty
   * ground became sixteen columns of empty ground with an ordinary two-tile
   * pipe and its three coins on it. It is the cheapest chunk in the level to
   * pay with and it buys one more pipe that goes nowhere, which is what stops
   * the coined short pipe from being a reliable warp oracle — see 3-2 above and
   * levels/world1.js for the whole argument. The score does not move (186.5
   * before and after): the meter prices enemies, gaps and hazards, and a pipe
   * on flat ground is none of the three.
   */
  /*
   * EI MAASTOPASSIA, ja syy on mitattu botilla eikä arvattu. Ks.
   * `data/terrain.js`. Tämän kentän `sky_run` on **tasan kuuden laatan kuilu**
   * eli tarkalleen hyppybudjetin mitta (`gapTiles` 6), ja sellaisen yli
   * päästään vain lähtemällä sen viimeiseltä laatalta. Maasto ei muuta kuilua
   * eikä sen vauhdinottoa — mutta rinteet sen edellä muuttavat sitä *mistä
   * kohtaa* juoksija sen kohtaa, ja `tools/playable.mjs` kuoli siihen kuiluun
   * jokaisella kokeillulla siemenellä. Kuilu joka on tasan budjetin mittainen
   * on kenttäsuunnittelua eikä kokoajan päätettävissä.
   *
   * MEASURED AGAIN 18.8.2026, after the two changes that answered every other
   * refusal in the game — the grid grew to sixteen rows and `MAX_LIFT` rose to
   * two — and the answer did not move. Seven seeds (`true` and `3-3a`…`3-3f`);
   * `tools/playable.mjs` died in the same gap every time, at column 237-241 of
   * roughly 433. Ten other hand-made levels took the pass in that same pass of
   * work and this one is the only refusal, which is what makes it the level's
   * own geometry rather than a bad roll.
   */
  '3-3': {
    theme: 'ice', bg: 'peaks', music: 'jaatie',
    chunks: [
      'start', 'pipe_short', 'power', 'lava_gap', 'walkers', 'ice_pommi', 'plat_steps',
      'shell', 'lava_wide', 'clouds', 'cork_gap', 'heartburn_pair', 'pipe_plant',
      'lava_gap', 'sky_run', 'corks', 'ice_pommi_gap', 'ice_crumble', 'brick_wall', 'plat_float',
      'pit_croak', 'power_hi', 'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  /* `3-4`…`3-7`, generated; the spread's position is the play order. */
  ...generated,
  /*
   * JÄÄLINNA, ja se linnake jonka mittaus nimesi (10.8.2026).
   *
   * `tools/variety.mjs` antoi tälle kentälle **3,0 %** koko pelille uutta
   * muotoa — omalle maailmalleen 100 %, mikä on juuri se ero jonka takia
   * kumpikin luku tulostetaan. Kenttä oli uusi maailmalle 3 ja ei kenellekään
   * muulle, koska se oli `fort_pillars`, `fort_gap` ja `fort_spikes` kolmatta
   * kertaa peräkkäin: samat palikat samassa tehtävässä kuin 1-F:ssä ja 2-F:ssä.
   *
   * Sanasto on nyt `frost_*` (`chunks/fortresses.js`) ja sen lause on se osa
   * jäämaailmasta joka toimii myös kivellä: **lattia ei kanna.** Liukkautta
   * täällä ei ole — teema vaihtuu ovella eikä sitä muuteta — mutta mureneva
   * lava jäätikön yllä, kolmen ruudun halkeamat ja neljän ruudun saarekkeet
   * kysyvät saman asian ilman fysiikkaa.
   *
   * Kuilut ovat kolme ja neljä saraketta eivätkä kuusi, ja se on `ice_pit`in
   * mittaus eikä uusi: kuuden budjetti olettaa että pelaaja saapuu juosten.
   * Kenttä ei siis ole entistä helpompi siksi että kuilut kapenivat, vaan siksi
   * mitattu että niitä on enemmän.
   */
  '3-F': {
    theme: 'fortress', bg: 'none', music: 'fortress', boss: true, bossVariant: 2,
    chunks: [
      'start', 'frost_gate', 'frost_rift', 'frost_hall', 'frost_vault',
      'frost_twin', 'frost_shelf', 'frost_gate', 'frost_hall', 'frost_shelf',
      'frost_vault', 'boss_arena',
    ],
  },
};
