/**
 * World 6 — luulaakso, the boneyard, and the world after the factory.
 *
 * The factory was indoors from the first tile to the last; this world is
 * outdoors from the first tile to the last, and the two are neighbours on
 * purpose. Coming out of a roofed world into a sky full of stars is the one
 * transition the game can make for free, and `chunks/bone.js` is built to
 * protect it: nothing in these three playlists has a ceiling over it.
 *
 * ## What each level is for, and what it measures
 *
 *   6-1  242,5  the graves: one hole shape, over and over, with everything else
 *               arranged around it
 *   6-2  147,5  the dip — teeth in the floor, blocks over it, and only two
 *               holes in the whole level
 *   6-K  247,3  the dig: the world's one level that goes down, where the
 *               punishment is in the terrain because the fall is not one
 *   6-F  395,4  the crypt, and a boss made of the floor he is standing on
 *
 * World mean 264,2, which is +8,0 on world 5 — the smallest step on the curve,
 * and worth saying out loud rather than hiding. World 5's levels are generated
 * and short (205–245 columns) and the meter counts everything per hundred
 * columns, so world 5 sits higher on the scale than it does in the hand. A
 * hand-made world cannot out-score it without turning into a gauntlet.
 *
 * ## Where the difficulty comes from, and where it does not
 *
 * **More holes, never wider ones.** Every gap in this world is five tiles
 * against a measured budget of six, because `tools/playable.mjs`'s power-0 bot
 * — the design promise in DESIGN.md §5 made executable — is not reliable at
 * six. A world that bought its number with seven-tile gaps would score well and
 * fail the promise, which is the wrong trade in both directions.
 *
 * **And never more than two holes in a row.** Chaining three of them is exactly
 * where the bot falls in ("kuilu sarakkeessa 93"), because a landing is only as
 * good as the run-up it leaves and a standing jump carries 0 px sideways. Where
 * two holes have to sit close, `flat8` — eight columns of nothing — is the
 * cheapest breath the vocabulary has.
 *
 * The rest is people. `bone_dance` puts three walkers on empty ground at even
 * spacing and turns up in every level: a waltz is three beats and it repeats,
 * so is this, and it is the cheapest kind of difficulty for a player to read.
 */

import { GENERATED_LEVELS } from '../generated.js';

/** Which of the generated levels belong to this world — the file holds them all. */
const generated = Object.fromEntries(Object.entries(GENERATED_LEVELS)
  .filter(([id]) => id.startsWith('6-')));

export const WORLD6_LEVELS = {
  /*
   * The world opens on `bone_stones` rather than on the flag-side vocabulary,
   * because the first thing this world has to say is where you are. Headstones
   * are the cheapest sentence it has and they cost nothing to walk past.
   *
   * The hole is taught in the order it can be learned. `bone_grave` first — the
   * coin arc over it is the shape of the jump — then `bone_wisp`, which is the
   * same hole with something bobbing over it, then `bone_ribs`, which is the
   * same hole with a plank across it. One geometry, three readings, and by the
   * third the player is looking at what is *above* the hole rather than at the
   * hole.
   */
  '6-1': {
    theme: 'bone', bg: 'bones', music: 'bone',
    chunks: [
      'start', 'bone_stones', 'power', 'bone_grave', 'bone_wisp', 'bone_dance',
      'bone_spine', 'bone_marrow', 'bone_wisp', 'bone_grave', 'bone_ribs',
      'bone_dance', 'bone_jaws', 'bone_marrow', 'bone_grave', 'bone_wisp',
      'bone_dance', 'bone_ridge', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * The dip, and it is bought the way every dip in this game is bought: by
   * taking the holes out rather than the inhabitants. Two graves in the whole
   * level against 6-1's five, and what fills the space is `bone_jaws` — teeth
   * standing in the floor, which cost a power level and not a life.
   *
   * That is what a breather is allowed to be in the *last* world. Measured, it
   * is 147,5 against 242,5 and 247,3 either side of it, and almost all of the
   * difference is gaps: 48 against 124 either side. The enemies barely move
   * (66 against 82), which is the point — the level is not emptier, it is
   * survivable.
   *
   * It is 6-2 rather than 6-1 or 6-3 for the same reason 4-2 is: the breather
   * is where curiosity is affordable.
   */
  '6-2': {
    theme: 'bone', bg: 'bones', music: 'bone',
    chunks: [
      'start', 'bone_stones', 'power', 'bone_jaws', 'bone_dance', 'bone_marrow',
      'bone_grave', 'bone_dance', 'bone_coffins', 'bone_marrow', 'bone_jaws',
      'bone_dance', 'bone_grave', 'bone_stones', 'bone_ridge', 'run_up',
      'goal', 'goal_end',
    ],
  },
  /*
   * KAIVAUTUMINEN — pelin ensimmäinen alaspäin menevä kenttä, ja se seisoo
   * sen kentän paikalla jolla oli koko pelin heikoin peruste.
   *
   * Omistajan pyyntö: *"kun pystykentät toimivat, olisi hauskaa saada
   * kaivautumiskenttä jonnekin luumaailman tapaiseen, sellainen jossa mennään
   * oikeasti alaspäin."*
   *
   * ## Miksi tämä korvaa juuri 6-3:n
   *
   * Vanha 6-3 oli maailman huippu ja kahdeksan kuoppaa: sama viiden ruudun
   * kuoppa kahdeksan kertaa, ja lista siitä mitä maailmassa on. `node
   * tools/variety.mjs` mittaa sen, ja luku ei ole mielipide: **6-3 oli koko
   * pelin vähiten uusi kenttä, uutuus 11,7 % omalle maailmalleen ja 10,5 %
   * pelille**, ja 84,6 % sen muodoista oli 6-1:n muotoja. Se oli niin
   * yksiselitteisesti pelin toistavin kenttä, että `variety.mjs` valitsi sen
   * itse oman ansankokeensa koekentäksi.
   *
   * Mitä siitä jää voimaan: kaksi asiaa, ja molemmat elävät edelleen
   * naapureissaan. **Kuoppa on aina viisi ruutua** mitattua kuuden budjettia
   * vasten (6-1, 6-2) ja **kolmea kuoppaa ei ketjuteta** — se `flat8`in koko
   * perustelu, "kuilu sarakkeessa 93". Kumpikaan ei ollut 6-3:n oma keksintö
   * vaan maailman sääntö, ja maailma pitää ne ilman sitä.
   *
   * ## Miksi tämä ei ole pilvikenttä ylösalaisin (IDEAS.md I)
   *
   * **Ylöspäin virhe maksaa sivun; alaspäin se kantaa eteenpäin, väärään
   * paikkaan.** Kiipeilyssä pudotus vie takaisin sinne mistä tulit ja
   * kiivetään uudestaan, joten rangaistusta ei tarvitse rakentaa: se on
   * matkassa. Kaivautuessa painovoima on *puolellasi* ja vie sinut eteenpäin
   * joka tapauksessa — pudotus ei siis maksa mitään, ellei maasto maksata.
   * Siksi tämän kentän rangaistus on maastossa eikä putoamisessa, ja se on
   * mitattavissa: **4 riviä piikkejä** siellä minne kuljetaan, kun
   * pilvikentässä on nolla tappavaa ruutua (`verify.mjs` vaatii kummankin).
   *
   * ## Muoto: kaksi kuilua jotka eivät ole sama kuilu
   *
   * Kerrokset ovat neljän rivin välein, ja jokaisessa lattiassa on **kolmen
   * laatan aukko joka vaihtaa puolta**: oikea seinä, vasen seinä, oikea, vasen.
   * Reitti alas on siis sahalaita — putoat, kävelet kerroksen poikki, putoat —
   * ja se kävely on kentän koko sisältö: siellä ovat kolikot, hampaat ja se
   * yksi piikki jonka yli on hypättävä.
   *
   * Neljän rivin väli ei ole sisustusta vaan kaksi mitattua ehtoa yhdessä:
   * käytävän on oltava kolme riviä korkea (isoin keho on kolme riviä, `HEAD`),
   * ja neljän ruudun askelma on tasan se mitä mitattu hyppy nousee
   * (`wallTiles`). **Jokaisesta kerroksesta pääsee siis vielä takaisin
   * ylempään**, mikä on koko rangaistus sanottuna geometriana: väärä pudotus ei
   * maksa kenttää vaan kiipeämisen takaisin. Ainoa poikkeus on ensimmäinen
   * huone, joka on rivin korkeampi — `!` tarvitsee neljä vapaata riviä
   * lattiansa yllä ollakseen puskettava (`BEAN_BLOCK_OVER_FLOOR`), eikä kolmen
   * rivin käytävään mahdu lohkoa jonka alta iso keho kävelee.
   *
   * ## KAKSI VIKAA JOTKA OLIVAT TÄSSÄ KENTÄSSÄ TUOTANNOSSA
   *
   * Molemmat löytyivät pelaamalla, kumpaakaan ei nähnyt yksikään portti, ja ne
   * ovat syy siihen että tämä kenttä on piirretty uudelleen.
   *
   *   1. **Kentän läpi meni yksi avoin sarake.** Sarake 3 oli auki riviltä 5
   *      riville 43 ja maali oli sen pohjalla: kävele vasemmalle, pidä alas,
   *      olet perillä. Kaikki kahdeksan käytävää olivat koristetta.
   *   2. **Ja se sarake oli yhden laatan levyinen.** Aukko on 16 px ja levein
   *      keho on 21 (`PLAYER_SIZES`), joten voimatasolla 3–5 kentästä **ei
   *      päässyt alas lainkaan**. Kyykky ei auta: se madaltaa eikä kavenna.
   *      Jokainen portti mittaa voimatasoa 0 — tasan sitä kokoa joka mahtui.
   *
   * Kummallekin on nyt sääntö (`checkClimbTraverse`, `checkClimbWidth`), ja
   * molemmat säännöt kaatoivat myös 7-T:n ja `verify.mjs`:n oman koekentän
   * samalla lauseella. Se on niiden paras suositus: vika ei ollut tämän kentän
   * oma vaan pystykenttien, eikä sitä nähnyt kukaan ennen kuin se mitattiin.
   *
   * `!` on ensimmäisen huoneen katossa rivillä 6, eli korkeuden ensimmäisessä
   * neljänneksessä lähdöstä kulkusuuntaan mitattuna. Kolikko rivillä 2 maksaa
   * saman lähtötasanteen harjalle.
   */
  '6-K': {
    theme: 'bone', bg: 'bones', music: 'bone', vertical: true, time: 400,
    rows: [
      '                    ',
      '                    ',
      '   oo               ',
      '                    ',
      '  1                 ',
      '#################   ',
      '      !             ',
      '                    ',
      '           o        ',
      '                    ',
      '   #################',
      '                    ',
      '        oo          ',
      '         ^          ',
      '#################   ',
      '                    ',
      '      oo            ',
      '        g           ',
      '   #################',
      '                    ',
      '            o       ',
      '          ^         ',
      '#################   ',
      '                    ',
      '       oo           ',
      '           g        ',
      '   #################',
      '                    ',
      '         o          ',
      '          ^         ',
      '#################   ',
      '                    ',
      '        oo          ',
      '         ^          ',
      '   #################',
      '                    ',
      '       o            ',
      '                F   ',
      '####################',
      '####################',
    ],
  },
  /*
   * The crypt. `bg: 'none'` is the fortress room, drawn in the bone palette —
   * the same torch-lit hall every world ends in, in ivory and grave earth — and
   * the corridors are the shared `fort_*` pieces, because a fortress is the one
   * level type that repeats unchanged across worlds and this one has no reason
   * to be the exception.
   *
   * `music: 'bone'` and not `'fortress'`, and that is the one deliberate break
   * from the pattern. The engine plays the `boss` track until the fight is over,
   * so what this line actually decides is what plays *after* he falls — and
   * after the skeleton falls, the dance should come back. The joke in the piece
   * is that the dancing stops at dawn, not that it ends.
   *
   * **Four `fort_gap`s and no `fort_trench`**, and both halves of that are
   * measured rather than chosen. The trench is nine tiles of lava with one plank
   * in the middle, and it is where the power-0 bot gives up in 5-F ("VAATII
   * TUPLAHYPYN", maasto sarakkeessa 67) — 6-F did exactly the same until it came
   * out. `fort_gap` is six tiles of open lava with nothing over it: harder to
   * read, easier to cross, and the meter agrees with the hands for once, because
   * a hole with a plank over it scores no gap risk at all while a bare one
   * scores the maximum. Four of them are most of why this is the hardest level
   * in the game at 395,4.
   */
  /* `6-4`…`6-7`, generated; the spread's position is the play order. */
  ...generated,
  '6-F': {
    theme: 'bone', bg: 'none', music: 'bone', boss: true, bossVariant: 4,
    chunks: [
      'start', 'crypt_gate', 'crypt_nave', 'crypt_pit', 'crypt_ash', 'crypt_jaws',
      'crypt_pit', 'crypt_ash', 'crypt_pit', 'crypt_ash', 'boss_arena',
    ],
  },
};
