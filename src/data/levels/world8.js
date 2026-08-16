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
 * Kahdeksan kenttää, jokainen sisätilaa, ja **jokainen niistä päättyy
 * tappeluun**. Maailmassa 8 ei ole yhtään lippua. Kahdeksan ovea — seitsemän
 * uusintaa ja kuningas — eikä yhdestäkään huoneesta pääse ulos muuten kuin
 * sen läpi mikä siinä seisoo.
 *
 * Neljä asiaa seuraa tästä, ja kaikki neljä mitataan `verify.mjs`:ssä eikä
 * perustella tässä, koska väite muodosta on juuri sitä lajia joka voi olla
 * väärä samalla kun kaikki näyttää valmiilta:
 *
 *   - **jokainen askel on tappelu**, muualla vain viimeinen. Mitattuna 8/8 =
 *     100 % ja jokainen muu 1/n.
 *   - **ei ulkopuolta.** Kiveä joka kentän joka sarakkeen yllä, 100 % vastaan
 *     10–57 % niissä maailmoissa joissa on linnake ja kolme kenttää.
 *   - **ei lippua, ovi joka askeleella**, vastaan kolme lippua ja yksi ovi
 *     kaikkialla muualla.
 *   - **maailmojen 1–7 linnakepomot siinä järjestyksessä kuin ne tulivat**, ja
 *     kahdeksantena variantti jota ei ole missään muualla.
 *
 * ## Miksi pomoralli, ja miksi se ei ole laiska
 *
 * Vaihtoehtoiset muodot olivat todellisia: yksi juoksuhauta joka lainaa
 * jokaista mekaniikkaa, tai neljä linnaketta vanhoissa mittasuhteissa. Ralli
 * valittiin koska se on niistä kolmesta ainoa joka tekee finaalista väitteen
 * *siitä pelistä joka tuli ennen sitä* eikä itsestään. Jokainen tappelu tässä
 * on tappelu jonka pelaaja on jo kerran voittanut, ja maailman lause on että
 * linnalla ei ole mitään uutta lähetettävää.
 *
 * **Seitsemän uusintaa eikä kuusi, ja se on omistajan päätös 10.8.2026.**
 * Vanha muoto oli kuusi kenttää ja väite "jokainen pomovariantti kerran". Se
 * piti paikkansa vain sattumalta: varianttien joukko ja linnakkeiden joukko
 * ovat eri joukot, koska **jättiläinen on kahden linnakkeen pomo** (4-F ja
 * 5-F). Uusi muoto laskee linnakkeita eikä variantteja — seitsemän
 * linnaketta, seitsemän uusintaa, jättiläinen kahdesti — ja se on ainoa
 * laskutapa joka tekee maailman lauseesta kirjaimellisen. Linna lähettää sen
 * mitä se on lähettänyt, myös silloin kun se lähetti saman kahdesti.
 *
 * Se mikä estää tätä olemasta kahdeksan kopiota yhdestä kentästä on se että
 * käytävä jokaisen tappelun edessä *on* se kenttä, ja jokainen niistä kysyy
 * eri kysymyksen:
 *
 *   8-1  portti      mikä reikä lattiassa on, kun lattia on kiveä      (1-F)
 *   8-2  vartio      notko — ei yhtään kuilua, asukkaita sen sijaan    (2-F)
 *   8-3  tyrmä       kaksi reikää, toisessa asutaan, ja tie ylös       (3-F)
 *   8-4  koneholvi   toinen notko: katto laskeutuu, missä saa hypätä   (4-F)
 *   8-5  sulatto     neljä ylitystä, kaikki laavaa, ei yhtään reikää   (5-F)
 *   8-6  ahjo        laava, ja ne kaksi suihkua jotka päättävät milloin (6-F)
 *   8-7  myrskykammio kaikki mitä maailma omistaa, yhdessä käytävässä  (7-F)
 *   8-F  valtaistuinsali  neljä kourua, ei muuta, ja sitten kuningas
 *
 * Tappelut kulkevat siinä järjestyksessä kuin pelaaja ne ensi kerran kohtasi —
 * variantit 0, 1, 2, 3, 3, 4, 5 — **eikä yksikään ole siirretty.** Vanha
 * kuuden kentän versio joutui siirtämään jättiläisen loppuun, koska hän oli
 * ainoa pomo joka tarvitsee toisen huoneen ja koska muuten finaali olisi
 * päättynyt sääherraan. Nyt siirtoa ei tarvita: hän on kohdissa 8-4 ja 8-5
 * omine kannellisine areenoineen, ja finaalin viimeinen ovi on jonkun muun.
 *
 * ## Where the difficulty comes from
 *
 * **Lava, holes and the run-up, in that order.** Almost none of it is the
 * bosses: the meter prices a boss at 5,0 walkers, which over a 176-column
 * level is worth about twenty points. What carries the number is that every
 * corridor is a corridor — narrow, roofed, and cut by gaps that are lava
 * rather than air.
 *
 * Mitattuna, linnake mukaan lukien:
 * 245 · 117 · 302 · 169 · 354 · 378 · 386 · 318, keskiarvo **283,5**.
 * Maailma 7 on 253,7, eli askel on **+29,8** — ja se kannattaa suhteuttaa
 * pelin ohuimpaan askeleeseen, joka on w6 → w7 ja **+2,5**.
 *
 * **The dip is deeper than any before it, and that is structural rather than
 * careless.** 8-2 is 41 % of its world's mean where luulaakso's breather was
 * 59 % and kaasukehä's 71 %. Gaps are 30 % of what the meter weighs and pit
 * share another 9 %, so in a world whose difficulty is almost entirely gaps, a
 * breather that takes the gaps out has further to fall than one in a world
 * whose difficulty is people. The hand disagrees with the meter here and the
 * hand is worth writing down: 8-2 ends in a boss like every other level in this
 * world, and it is the only room in it where a mistake costs a power level
 * instead of a life.
 *
 * **And the composition rule is a measurement.** Nine columns of unbroken floor
 * in front of every single gap, world-wide, checked in `verify.mjs`. That one
 * number decides the chunk order of all eight playlists: the shared `fort_gap`
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
 * plays the `boss` track while a fight is on, so in a world of eight fights
 * that line would decide almost nothing — the piece would be heard in the
 * corridors and nowhere else.
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
      'keep_vault', 'fort_pillars', 'fort_spikes', 'keep_watch', 'boss_arena_big',
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
   * 8-4 KONEHOLVI — se huone jossa kattoon voi koskea, ja maailman toinen
   * hengähdys.
   *
   * **Miksi tämä kenttä on olemassa.** Maailma 8 oli kuusi kenttää ja sen
   * väite oli "jokainen pomo kerran". Omistajan päätös vaihtoi väitteen:
   * linnakkeita on seitsemän, joten uusintoja on seitsemän — ja jättiläinen on
   * kahden linnakkeen pomo (4-F ja 5-F), joten hän tulee kahdesti. Kenttä 8-4
   * on maailman 4 linnakkeen uusinta ja 8-5 maailman 5:n, ja **sama tappelu
   * kahdesti peräkkäin on tämän maailman koko idea kirjaimellisesti otettuna**:
   * linna lähettää sen mitä se on lähettänyt, myös silloin kun se lähetti
   * saman kahdesti.
   *
   * Toisto ei siis ole tässä vahinko vaan se kohta jossa se pitää lunastaa, ja
   * lunastus on huoneissa. **8-4 on huone jossa jättiläinen on ainoa vaara ja
   * 8-5 se jossa hän on pienin niistä.** Toinen on hengähdys, toinen on
   * maailman toiseksi vaikein käytävä, ja väliin ei mahdu kysymystä siitä
   * miksi hänet nähdään kahdesti.
   *
   * **Hengähdyksen resepti on 8-2:n, mutta ei sama annos.** 8-2:ssa ei ole
   * yhtään kuilua; tässä on kaksi reikää eikä tippaakaan laavaa, eli lattia
   * pettää muttei kukaan ole kaivanut mitään. Mitattuna 117 ja 169 maailman
   * keskiarvoa 285 vasten — 41 % ja 60 % — eli kaksi hengähdystä eri syvyyksillä
   * eikä sama kenttä kahdesti. Luulaakson toinen notko on 59 % omastaan, joten
   * tämä on se mitta jossa muut maailmat jo ovat.
   *
   * Se on toinen notko kahdeksan kentän muodossa (`verify.mjs`: kahdeksan
   * kentän maailmassa on kaksi hengähdystä), ja se on tässä kohdassa samasta
   * syystä kuin 6-4 ja 7-4 omissa maailmoissaan.
   *
   * Se mikä on uutta on `keep_yoke` ja `keep_grind`: **katto laskeutuu.** Koko
   * maailma on tähän asti käyttänyt kattoa väitteenä — sitä on ollut joka
   * sarakkeen yllä, ja `keep_gate` roikuttaa portin juuri korkeimman hypyn
   * yläpuolelle — eli se on ollut asia jonka näkee. Tässä siihen törmää, ja
   * kysymys on ensimmäistä kertaa **missä saa hypätä** eikä *kuinka pitkälle*.
   * Se on myös se yksi asia jonka finaali tarvitsee: `throne_crawl` vie saman
   * ajatuksen loppuun (katto rivillä 9, ei hyppyä lainkaan), ja se lause osuu
   * kovempaa jos pelaaja on lukenut sen alkusoiton kerran.
   *
   * `boss_arena_big` eikä `boss_arena`, ja se on jättiläisen oma ehto eikä
   * tämän kentän: hän kasvaa puoli kokoa jokaisesta osumasta, ja neljännen
   * jälkeen hänen päänsä on voimatason 0 hypyn ulkopuolella. Kannet ovat se
   * vastaus. `verify.mjs` väittää sen nyt datasta: jokainen kenttä jonka pomo
   * kasvaa loppuu kannelliseen areenaan.
   */
  '8-4': {
    theme: 'fortress', bg: 'none', music: 'autiovuori', boss: true, bossVariant: 3,
    chunks: [
      'keep_start', 'fort_power', 'keep_yoke', 'keep_hole', 'keep_grind',
      'keep_teeth', 'keep_watch', 'keep_hole', 'keep_yoke', 'boss_arena_big',
    ],
  },

  /*
   * 8-5 SULATTO — maailman 5 linnakkeen uusinta, ja käytävä jossa jokainen
   * kuilu on laavaa.
   *
   * Sama pomo kuin 8-4:ssä ja tarkoituksella: linna lähetti jättiläisen
   * kahdesti. Ero on huoneessa, ja se on mitattavissa yhtenä lukuna —
   * **8-4:ssä on yksi kuilu, tässä neljä** — mutta se ei ole vielä lause. Lause
   * on tämä: **täällä ei ole yhtään reikää.**
   *
   * Ero on koko maailman oma. `keep_hole` on lattia joka ei enää ole siinä,
   * eli rakennus pettämässä; `fort_gap` ja `keep_pour` ovat kouruja, eli
   * jotain minkä joku on kaivanut. 8-1 kysyy ensimmäisen, 8-6 kysyy neljä
   * lajia peräkkäin, ja tämä kenttä kysyy toisen ja vain sen: neljä ylitystä,
   * kaikki laavaa, ei yhtään lattian pettämistä. Loppupuolen linnake on
   * pidetty kunnossa.
   *
   * `keep_pour` on kentän oma uusi kysymys ja se on `throne_moat`in peilikuva:
   * mureneva lava **laskeutumispuolella** eikä lähtöpuolella. Lähtöpuolella se
   * muuttaa hetken jolloin lähdet; laskeutumispuolella hyppy on jo tehty, ja
   * kysymys on siitä pysähdytkö. Sama laatta, toinen kysymys — sama tapa jolla
   * `keep_hole` ja `keep_croak` ovat sama viisi ruutua.
   *
   * **Ei `keep_forge`ia, vaikka se on maailman tunnetuin kouru, ja se on
   * mittaus eikä maku.** Ensimmäinen versio avasi tällä kentällä ahjolla, ja
   * `tools/variety.mjs` kertoi mitä se maksoi: 8-6 — se kenttä jonka *oma*
   * ensimmäinen lause ahjo on — putosi **23,8 %:sta 5,9 %:iin** uutta muotoa
   * ja olisi ollut koko pelin toistavin kenttä. Kaksi uutta kenttää voi siis
   * tehdä vanhan kentän tyhjäksi kirjoittamatta siihen riviäkään, ja se
   * tapahtuu juuri sillä palikalla joka oli sen paras. Suihkut jäävät 8-6:n
   * omiksi.
   *
   * Kahta kourua ei ole peräkkäin, ja se on sääntö 3 eikä rytmi: `keep_pour`
   * jättää taakseen murenevan huulen ja kaksi saraketta kiveä ja `fort_gap`
   * tuo neljä. Jokaisen väliin menee täysi lattia, joka kerta — ahtain koko
   * maailmassa on tässä kentässä, 15 saraketta.
   */
  '8-5': {
    theme: 'fortress', bg: 'none', music: 'autiovuori', boss: true, bossVariant: 3,
    chunks: [
      'keep_start', 'fort_power', 'keep_pour', 'keep_watch', 'hyppy_harjoitus', 'fort_gap',
      'keep_teeth', 'keep_pour', 'keep_yoke', 'fort_gap', 'boss_arena_big',
    ],
  },

  /*
   * 8-6 AHJO — the forge, and the level about *when* rather than *whether*.
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
  '8-6': {
    theme: 'fortress', bg: 'none', music: 'autiovuori', boss: true, bossVariant: 4,
    chunks: [
      'keep_start', 'fort_power', 'keep_forge', 'fort_hall', 'hyppy_kampi', 'fort_gap',
      'keep_hole', 'keep_teeth', 'fort_gap', 'keep_croak', 'boss_arena',
    ],
  },

  /*
   * 8-7 MYRSKYKAMMIO — the storm chamber, and the peak of the walk.
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
  '8-7': {
    theme: 'fortress', bg: 'none', music: 'autiovuori', boss: true, bossVariant: 5,
    chunks: [
      'keep_start', 'fort_power', 'keep_gate', 'fort_gap', 'keep_hole',
      'fort_burn', 'keep_teeth', 'fort_gap', 'keep_croak', 'keep_watch', 'hyppy_neula',
      'fort_gap', 'keep_teeth', 'fort_gap', 'boss_arena_big',
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
   * kaikki nähty kentissä 8-1…8-7 ennen kuin tämä ovi aukeaa, joten viimeisellä
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
   * ## MEGAPOMO, ja miksi hän ei ole isompi pomo
   *
   * Tässä seisoi jättiläinen (variantti 3), ja se oli oikein niin kauan kuin
   * maailma oli kuusi kenttää ja sen väite oli "jokainen pomo kerran".
   * Seitsemän uusinnan jälkeen se ei ole enää oikein kahdesta syystä: hänet on
   * jo nähty kahdesti tässä maailmassa (8-4 ja 8-5, koska linna lähetti hänet
   * 4-F:ssä ja 5-F:ssä), ja finaalin pitää olla se kohta jossa maailma tekee
   * jotain muuta kuin toistaa.
   *
   * Kahdeksas ovi on siksi **PIERUKUNINGAS**, `bossVariant: 6`, ja hän on
   * pelin ainoa megapomo. Ilmeinen megapomo on isompi sprite ja enemmän
   * osumapisteitä, ja se on väärä ratkaisu siitä yhdestä syystä että se on
   * *sama tappelu pidempänä*: jokainen tämän pelin pomo vastaa osumaan
   * kasvattamalla yhtä omaa lukuaan — nopeus +0,35, luurangolla ja sääherralla
   * +0,2, jättiläisellä koko +0,5 — ja pelaajan työ pysyy samana hieman
   * nopeampana. Kuningas on ainoa jonka vastaus ei ole numero:
   *
   *     osuma ei kiihdytä häntä, se vaihtaa hänet joksikin toiseksi.
   *
   * Hän ottaa vuorollaan jokaisen seitsemän linnakkeen liikesarjan siinä
   * järjestyksessä kuin linna ne lähetti — nyrkkeilijä, hyppääjä, syöksyjä,
   * jättiläinen, jättiläinen, luuranko, sääherra — ja seitsemäs osuma kaataa
   * hänet. Pelaajan työ ei siis ole toistaa yhtä opittua rytmiä loppuun asti
   * vaan **tunnistaa kesken tappelun kuka juuri saapui**, ja se on tasan se
   * taito jonka maailma 8 on seitsemässä huoneessaan opettanut. Maailman lause
   * — linnalla ei ole mitään uutta lähetettävää, se lähettää kaiken minkä se
   * on jo lähettänyt — on tässä yhdessä ruumiissa: **jokainen numero jonka
   * kuningas kantaa on jonkun toisen numero**, eikä yhtään uutta mekaniikkaa
   * synny. `src/entities/enemies.js` (`KING_FORMS`) on koko toteutus.
   *
   * **Se yksi asia jota hän ei lainaa on koko**, ja se on päätös. Koko on ainoa
   * pomon ominaisuus tässä pelissä joka vaatii toisen huoneen: jättiläisen
   * kannet ovat olemassa siksi että hänen päänsä karkaa voimatason 0 hypyn
   * ulottuvilta. Kuningas joka kasvaisi kesken seitsemän muodon sarjan olisi
   * joko saavuttamaton tai kutistuisi takaisin, ja DESIGN.md kohdan 5 lupaus
   * annetaan tässä samalla mitalla kuin muillekin: `verify.mjs` ajaa
   * voimatason 0 tallauksen yhden ikkunan sisällä myös 8-F:ssä.
   *
   * `boss_arena_big` jää silti, ja syy vaihtuu hänen mukanaan. Ennen kannet
   * olivat *pakko*, koska jättiläisen päähän ei muuten yltänyt; nyt ne ovat
   * **paikka jossa lukea**. Tappelussa jonka säännöt vaihtuvat joka osumalla
   * pelaaja tarvitsee hetken nähdäkseen kumpi saapui, ja kannet ovat pelin
   * ainoa jalansija jolle pomo ei yllä — se on mitattu jättiläisen omalla
   * hypyllä, joka on nopein kuudesta.
   *
   * `time: 480` eikä oletus 300, ja se on johdettu eikä valittu: kellon on
   * pidettävä sisällään reilusti enemmän ikkunoita kuin pomolla on osumia
   * (`verify.mjs` vaatii neljä per osuma jokaiselta pomolta), ja seitsemän
   * osumaa on kaksi enemmän kuin pelin siihenastinen ennätys. Kuninkaan ikkuna
   * ei myöskään kapene osumien myötä niin kuin muilla — tappelu vaikeutuu
   * vaihtumalla, ja kaksi kiristystä yhdestä osumasta on yksi liikaa.
   *
   * `bossMusic: 'autiovuori'` on pelin ainoa, ja tiedoston alku kertoo miksi:
   * kappale loppuu jo valmiiksi niin kuin tämän tappelun pitää loppua.
   */
  '8-F': {
    theme: 'fortress', bg: 'none', music: 'autiovuori', boss: true, bossVariant: 6,
    bossMusic: 'autiovuori', time: 480,
    chunks: [
      'keep_start', 'throne_gate', 'throne_hoard', 'throne_crawl', 'throne_moat',
      'throne_teeth', 'throne_moat', 'throne_watch', 'throne_moat', 'throne_crawl',
      'throne_moat', 'boss_arena_big',
    ],
  },
};
