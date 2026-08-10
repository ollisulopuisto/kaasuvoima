/**
 * World 8 — VIIMEINEN LINNAKE, the last keep, and the end of the game.
 *
 * ## The decision this world is, and it is a decision about SHAPE
 *
 * Every world in this game is three levels and a fortress. That shape has been
 * right seven times: it teaches, it breathes, it ends somewhere with a door.
 * It is also the one thing a finale cannot be, because a finale that is shaped
 * like every other world is the same world again with the last palette on the
 * list — and the theme list closed with kaasukehä, so world 8 does not even
 * have a new palette to be the same world in.
 *
 * So the shape is broken on purpose, and it is broken in the direction the room
 * itself suggests:
 *
 *   **the fortress stops being the last level and becomes the whole world.**
 *
 * Six levels, every one of them indoors, and **every one of them ends in a
 * fight**. There is no flagpole anywhere in world 8. Six doors, six bosses —
 * the game's six, one per level, the whole cast the engine has — and the only
 * way out of every room is through whatever is standing in it.
 *
 * Four things follow from that, and all four are measured in `verify.mjs`
 * rather than argued here, because a claim about shape is exactly the kind that
 * can be wrong while everything still looks finished:
 *
 *   - **six steps, not four.** `tiersOf` counts what a player walks. Every
 *     world so far is four steps, including world 2 with its branch and its six
 *     level files; this one is six.
 *   - **no outside.** Stone over every column of every level, 100 % against
 *     10–42 % for the fortress-and-three-fields worlds.
 *   - **no flag, six doors**, against three flags and one door everywhere else.
 *   - **every boss variant, once each.** No other world contains two.
 *
 * ## Why a boss rush, and why it is not a lazy one
 *
 * The alternative shapes were real: a gauntlet level that quotes every
 * mechanic, or four fortresses in the old proportions. The rush was chosen
 * because it is the only one of the three that makes the finale *about the
 * game that came before it* rather than about itself. Every fight here is a
 * fight the player has already won once, in the room where they first won it,
 * and the sentence the world says is that the castle has nothing new to send.
 *
 * What keeps it from being six copies of one level is that the corridor in
 * front of each fight is the level, and each one asks a different question:
 *
 *   8-1  the gate       what a hole in a floor is, when the floor is stone
 *   8-2  the guard      the dip — no gap anywhere in it, and people instead
 *   8-3  the dungeon    two holes, one of them occupied, and the way up
 *   8-4  the forge      lava, and the two jets that decide when you cross it
 *   8-5  the storm      everything the world owns, in one corridor
 *   8-F  the throne     four trenches, nothing else, and then the giant
 *
 * The fights run in the order the player first met them — variants 0, 1, 2, 4,
 * 5 — **except the giant, who is moved to the end.** He was met fourth (4-F)
 * and fought again fifth (5-F), so strict order would have put him in the
 * middle and finished on the weather lord. He is last because he is the only
 * boss in the game who needs a different room: he grows half a size per stomp,
 * the last two hits are outside a power-0 jump, and `boss_arena_big`'s decks
 * are the answer. A finale that ended on a fight the old arena could hold would
 * be ending on a smaller room than it passed through.
 *
 * ## Where the difficulty comes from
 *
 * **Lava, holes and the run-up, in that order.** The world mean is 301,0
 * against world 7's 279,2, and almost none of that is the bosses: the meter
 * prices a boss at 5,0 walkers, which over a 176-column level is worth about
 * twenty points. What carries the number is that every corridor is a corridor —
 * narrow, roofed, and cut by gaps that are lava rather than air.
 *
 * Measured, fortress included: 245 · 117 · 302 · 378 · 386 · 379.
 *
 * **The dip is deeper than any before it, and that is structural rather than
 * careless.** 8-2 is 39 % of its world's mean where luulaakso's breather was
 * 56 % and kaasukehä's 65 %. Gaps are 30 % of what the meter weighs and pit
 * share another 9 %, so in a world whose difficulty is almost entirely gaps, a
 * breather that takes the gaps out has further to fall than one in a world
 * whose difficulty is people. The hand disagrees with the meter here and the
 * hand is worth writing down: 8-2 ends in a boss like every other level in this
 * world, and it is the only room in it where a mistake costs a power level
 * instead of a life.
 *
 * **And the composition rule is a measurement.** Nine columns of unbroken floor
 * in front of every single gap, world-wide, checked in `verify.mjs`. That one
 * number decides the chunk order of all six playlists: the shared `fort_gap`
 * carries only four columns of floor with it and `keep_forge` five, so neither
 * may follow a hole or another gap — a full-floor chunk goes between them,
 * every time. It is the executable form of the thing luulaakso wrote down and
 * kaasukehä repeated: a standing jump carries 0 px sideways, so a landing is
 * only as good as the run-up it leaves. Measured, the tightest gap in world 8
 * has 15 columns in front of it; the tightest in the rest of the game has 1.
 *
 * **And the rule is knowably incomplete, which is worth more than the rule.**
 * 8-3 failed the power-0 bot at column 105 while the measurement read thirty
 * unbroken columns of floor across that very place. The floor was unbroken and
 * nobody was walking on it: the chunk before the trench was `keep_stair`, so
 * the player arrives four tiles up and comes off the top with four columns left
 * before the lava. **The rule reads the floor, not the route.** The fix was the
 * playlist — the stair moved to after the gap — and the next level that lifts
 * the player off the ground just before a gap will fail the same way with
 * nothing in this file to explain it.
 *
 * ## The music, and the one line of engine that pays for it
 *
 * `music: 'autiovuori'` is Mussorgsky's *Night on Bald Mountain* in
 * Rimsky-Korsakov's arrangement (see `TRACKS` and DESIGN.md §1 b). The engine
 * plays the `boss` track while a fight is on, so in a world of six fights that
 * line would decide almost nothing — the piece would be heard in the corridors
 * and nowhere else.
 *
 * Hence `bossMusic` on 8-F, and it exists for exactly one level in the game.
 * The last fight is the only fight in this game whose music is not the boss
 * theme, and it is also the only fight whose music does not change when it
 * ends. The reason is in the piece: it is a night that gets louder until a bell
 * rings and the morning takes the same key in the major. That shape is a boss
 * fight and its door, and cutting it off to play something else at the moment
 * it resolves would be throwing away the ending twice.
 */

export const WORLD8_LEVELS = {
  /*
   * 8-1 PORTTIHOLVI — the gate, and the level that teaches the world.
   *
   * `keep_gate` first, because the first thing this world has to say is where
   * you are, and it says it with the ceiling: a portcullis hangs from the roof
   * and you walk under it. Luulaakso opened on headstones for the same reason
   * and it cost the same nothing.
   *
   * Then the hole, twice, with the world's one trench between them. `keep_hole`
   * is a gap in a stone floor rather than a lava trench, and that distinction is
   * what the whole world runs on: the trench is a hazard somebody built and the
   * hole is the building failing. Both readings are here and nothing else that
   * can kill is, so this level is the vocabulary and not yet the argument — and
   * the second hole is the same hole, which is how this game says "you have seen
   * this before" without putting a word of it on the screen.
   *
   * The fight is variant 0: the boss of 1-F, the first thing this castle ever
   * sent, three hits and no charge. It is the gentlest fight in the game and it
   * is first, so the rush opens on recognition rather than on a wall.
   */
  '8-1': {
    theme: 'fortress', bg: 'none', music: 'autiovuori', boss: true, bossVariant: 0,
    chunks: [
      'keep_start', 'fort_power', 'keep_gate', 'keep_hole', 'keep_teeth',
      'fort_gap', 'keep_vault', 'keep_hole', 'keep_watch', 'boss_arena',
    ],
  },

  /*
   * 8-2 VARTIOKÄYTÄVÄ — the dip, and it is bought the way every dip in this
   * game is bought: by taking the holes out and leaving the inhabitants in.
   *
   * **Not one gap in the level.** No hole, no trench, no lava — the only level
   * in world 8 where the floor is unbroken from the first column to the arena,
   * and the meter reads it at 117 against 245 either side, because gaps are
   * thirty percent of what it counts and pit share another nine. What fills the
   * space is people and spikes: four spike beds, three walkers, two flyers and
   * a shell, every one of which costs a power level rather than a life.
   *
   * That is what a breather is allowed to be in a world of six fights. It
   * cannot be *emptier* — an empty corridor between two boss doors is dead air
   * — so it is survivable instead, which is the same trade luulaakso made at
   * 6-2 and for the same measured reason.
   *
   * It is second and not third or fourth for the same reason 4-2, 6-2 and 7-2
   * are: the breather goes where curiosity is still affordable. In a world of
   * six fights it is also the one place a player who arrived at power 0 can get
   * a size back without paying for it, which is why the vault sits in the
   * middle of it with two tiers of blocks in it.
   *
   * The fight is variant 1 — the boss of 2-F, four hits and a hop on landing.
   */
  '8-2': {
    theme: 'fortress', bg: 'none', music: 'autiovuori', boss: true, bossVariant: 1,
    chunks: [
      'keep_start', 'fort_power', 'keep_watch', 'fort_spikes', 'keep_teeth',
      'keep_vault', 'fort_pillars', 'fort_spikes', 'keep_watch', 'boss_arena',
    ],
  },

  /*
   * 8-3 TYRMÄ — the dungeon, and the level where the hole turns out to be
   * occupied.
   *
   * `keep_hole` and then `keep_croak` in that order and no other, because they
   * are the same five tiles and the second one is only legible as the first one
   * changed. Between them is `keep_watch`, sixteen columns of people and not one
   * hole, which is this world's `flat8`: it is what rule 3 costs and it is also
   * the pause the joke needs.
   *
   * `keep_stair` is where this world admits it has a ceiling — four steps, and
   * then it stops, because three clear rows over the top step is all the roof
   * leaves. It sits **after** the first trench rather than before it, and that
   * order was written by the bot and not chosen: with the stair in front of the
   * gap the power-0 run died at column 105, because coming off the top of a
   * staircase leaves four columns of floor before the lava while the run-up
   * rule was happily measuring floor that nobody was standing on. See the note
   * at the top of this file: it is the one thing rule 3 knowably cannot see.
   *
   * The fight is variant 2: the boss of 3-F, the first one that charges.
   */
  '8-3': {
    theme: 'fortress', bg: 'none', music: 'autiovuori', boss: true, bossVariant: 2,
    chunks: [
      'keep_start', 'fort_power', 'keep_hole', 'keep_watch', 'keep_croak',
      'keep_teeth', 'fort_gap', 'keep_stair', 'keep_vault', 'fort_gap',
      'boss_arena',
    ],
  },

  /*
   * 8-4 AHJO — the forge, and the level about *when* rather than *whether*.
   *
   * `keep_forge` opens it: five tiles of lava with a heartburn jet on each lip.
   * Every other gap in this world is a question about the run-up, and this one
   * is a question about the clock — the jump is easy and the moment is not.
   * Then `fort_gap`, six tiles of open lava with nothing over it and nothing to
   * time, so the two readings sit one after another with a hall between them —
   * and then the pair again as a hole and an occupied hole. Five gaps, four
   * kinds, no two of them adjacent.
   *
   * `fort_hall` between the forge and the trench is rule 3 doing its job in
   * the most visible place in the world: the forge leaves five columns of floor
   * behind it and `fort_gap` brings four, which is nine columns short of what
   * the take-off needs. The hall is not pacing here, it is geometry.
   *
   * The fight is variant 4: the skeleton of 6-F, who comes apart at every hit.
   */
  '8-4': {
    theme: 'fortress', bg: 'none', music: 'autiovuori', boss: true, bossVariant: 4,
    chunks: [
      'keep_start', 'fort_power', 'keep_forge', 'fort_hall', 'fort_gap',
      'keep_hole', 'keep_teeth', 'fort_gap', 'keep_croak', 'boss_arena',
    ],
  },

  /*
   * 8-5 MYRSKYKAMMIO — the storm chamber, and the peak of the walk.
   *
   * Everything the world owns, in one corridor: the gate, three trenches, a
   * hole, the burning catwalk, an occupied hole, the teeth and the guardroom.
   * It is the world's `6-3` and `7-3` — the level that is a list — and like
   * both of those it earns the right to be one by coming after the four levels
   * that taught its parts. At 386 it is the hardest walk in the game.
   *
   * `fort_burn` is the only crumbling floor in world 8 and it is here rather
   * than earlier on purpose. It is the one piece of footing in the world that
   * leaves whether or not the player aimed well, so it belongs where a player
   * has already learned to trust the floor — the joke does not work on somebody
   * who has not yet been given the habit.
   *
   * The fight is variant 5: the weather lord of 7-F, who rises with every hit.
   * He is the last boss before the throne room, and putting the most recent
   * fight last among the recognitions is what makes the giant's arrival at 8-F
   * read as an interruption rather than as the next item.
   */
  '8-5': {
    theme: 'fortress', bg: 'none', music: 'autiovuori', boss: true, bossVariant: 5,
    chunks: [
      'keep_start', 'fort_power', 'keep_gate', 'fort_gap', 'keep_hole',
      'fort_burn', 'keep_teeth', 'fort_gap', 'keep_croak', 'keep_watch',
      'fort_gap', 'boss_arena',
    ],
  },

  /*
   * 8-F VALTAISTUINSALI — pelin viimeinen huone, ja se linnake jonka mittaus
   * yllätti (10.8.2026).
   *
   * Tässä luki aiemmin pitkä perustelu neljälle kourulle, ja se perustelu oli
   * hyvä: sama kysymys neljästi, täysi vauhdinotto jokaisen edessä, ja
   * `keep_croak` kolmantena lopusta. Sen vika oli se mitä `tools/variety.mjs`
   * mittasi: **0,0 % koko pelille uutta muotoa.** Kaikki muut nollan
   * linnakkeet toistivat toisten maailmojen linnakkeita; tämä toisti *omia
   * kenttiään*. `keep_vault`, `keep_teeth`, `keep_watch` ja `keep_croak` on
   * kaikki nähty kentissä 8-1…8-5 ennen kuin tämä ovi aukeaa, joten viimeisellä
   * käytävällä ei ollut mitään sanottavaa — ja jaettu `fort_gap` neljästi
   * huolehti lopusta.
   *
   * Sanasto on nyt `throne_*` (`chunks/fortresses.js`), joka on maailman 8 oma
   * mutta erillinen `keep.js`:stä samasta syystä: finaalin pitää sanoa jotain
   * mitä maailma ei ole jo sanonut. Lause on se ainoa jota `keep.js` ei sano:
   * **huone kutistuu.** `throne_crawl`in katto on rivillä 9, eli jalansijaa on
   * kolme riviä — `HEAD` rules.js:ssä, 48 px ilmaa 43 px:n kroppaa vasten — ja
   * peli jossa kaikki ratkaistaan hyppäämällä päättyy käytävään jossa ei voi
   * hypätä.
   *
   * Maailman kolme sääntöä pätevät jokaiseen uuteen palikkaan ja `verify.mjs`
   * mittaa ne kaikki: joka sarakkeen yllä on kiveä, tiili ei kosketa kiveä
   * (`throne_hoard`in molemmat kerrokset leijuvat), ja jokaisen kuilun edessä
   * on yhdeksän saraketta lattiaa. `throne_moat` kantaa oman vauhdinottonsa
   * mukanaan: yhdeksän kiveä ja yksi mureneva huuli, joka on jalansijaa siihen
   * asti kunnes sille astuu.
   *
   * **Ei `fort_trench`iä, ei täälläkään.** Se mittaus on vanha eikä se muuttunut
   * mihinkään: kouru on yhdeksän ruutua laavaa ja yksi lauta keskellä, ja se on
   * se paikka jossa voimatason 0 botti luovuttaa 5-F:ssä. Viimeinen kenttä jota
   * pienin koko ei läpäise on rikki eikä vaikea (DESIGN.md kohta 5).
   *
   * `boss_arena_big` ja variantti 3: jättiläinen, viisi osumaa, puoli kokoa
   * lisää jokaisesta. Kannet ovat syy siihen miksi hän on täällä eikä muualla —
   * neljännen tallauksen jälkeen hänen päänsä on seisontahypyn ulkopuolella ja
   * viidennen jälkeen jokaisen voimatason 0 hypyn ulkopuolella, joten kaksi
   * viimeistä osumaa tulevat ylhäältä. Areena on jaettu, ja se on nimenomaan se
   * osa jonka jakaminen kannattaa: areena on areena.
   *
   * `bossMusic: 'autiovuori'` on pelin ainoa, ja tiedoston alku kertoo miksi:
   * kappale loppuu jo valmiiksi niin kuin tämän tappelun pitää loppua.
   */
  '8-F': {
    theme: 'fortress', bg: 'none', music: 'autiovuori', boss: true, bossVariant: 3,
    bossMusic: 'autiovuori',
    chunks: [
      'keep_start', 'throne_gate', 'throne_hoard', 'throne_crawl', 'throne_moat',
      'throne_teeth', 'throne_moat', 'throne_watch', 'throne_moat', 'throne_crawl',
      'throne_moat', 'boss_arena_big',
    ],
  },
};
