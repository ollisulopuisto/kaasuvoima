/**
 * World 2's chunks: the heat, the things that come out of the floor, and the
 * night level's two pieces. Grouped by the world that introduces them rather
 * than by the tile they use, because that is the level someone is editing when
 * they change one.
 */

import { ck, withVine, G } from './common.js';

export const DESERT_CHUNKS = {
  /* --------------------- ilmavaivat: uudet uhat ------------------------ */
  heartburn: ck(16, {
    9: '    o o o',
    12: '      H',
    13: G,
    14: G,
  }),
  heartburn_pair: ck(16, {
    9: '     ooo',
    10: '   ------',
    12: '  H        H',
    13: G,
    14: G,
  }),
  cork_gap: ck(16, {
    12: '   c        c',
    13: '#####      #####',
    14: '#####      #####',
  }),
  /** Wakes the angry sun. One per level is plenty — it follows you after that. */
  sun: ck(16, {
    2: '       A',
    9: '   o o o',
    13: G,
    14: G,
  }),
  soup_stop: ck(16, {
    9: '      !',
    12: '   g       c',
    13: G,
    14: G,
  }),

  /* ------------------------------ night ------------------------------- */
  // The moon sits above a staircase, so it is reachable without the fart jump
  // but still asks for a climb.
  moon_night: ck(16, {
    3: '        O',
    9: '   XX',
    10: '  XXXX',
    11: ' XXXXXX',
    12: 'XXXXXXXX',
    13: G,
    14: G,
  }),
  dune_night: ck(16, { 9: '     o o o', 12: '        g', 13: G, 14: G }),

  /**
   * A boardwalk of dry planks over the dunes, and world 2's crumbling floor.
   *
   * Two things decide that it belongs to the night level rather than the main
   * line. The first is the palette: in the night theme brick and ground are
   * nearly the same brown — the weakest pair of the six themes, and a known
   * open problem — so anything that announces itself by *colour* is exactly
   * what will not read in 2-N. A crumbling plank announces itself by shaking,
   * cracking and dropping out from under you. Motion survives a bad palette.
   *
   * The second is what a mistake costs. There is sand under every plank, so
   * falling costs the coin line and the climb back and nothing else. That is
   * deliberate in a level lit by one lamp: you cannot see how far a drop goes,
   * so the drop must not be the punishment. The factory owns the version with
   * nothing underneath (`fac_crumble`), and by then the player has met the
   * tile and knows what the shaking means.
   *
   * The piers at both ends are solid on purpose. Somewhere safe to stand and
   * look is what makes stopping in the middle a decision rather than an
   * accident — the same reason the coins sit over the planks and not over the
   * piers, so the greedy line and the fast line are the same line.
   *
   * Row 9 and not row 10, and that is the validator's choice rather than mine:
   * `%` counts as solid, so a plank at row 10 is a ceiling three tiles over the
   * sand and the headroom rule rejects it. Which raises the real question —
   * can the smallest player get up there at all? Measured in the engine: the
   * jump lifts the feet 77.8 px at a walk and 85.1 px at a run, identical at
   * every power level, and the planks are 64 px above the sand. At power 0 a
   * running jump lands on them from five of eight take-off distances. So it is
   * a bonus that asks for a run-up, not one that asks for a mushroom.
   */
  dune_crumble: ck(16, {
    8: '    o o o o o',
    9: '   X%%%%%%%%X',
    13: G,
    14: G,
  }),

  /**
   * The desert's timed switch: hit the button and the wall buried over your
   * head reads as coins for ten seconds.
   *
   * Same promise as every other switch in the game — it opens a reward and
   * never the route, and you can walk straight under this having ignored it.
   * The floor is `#` and never `B`, for the reason `switch_wall` gives: a
   * switch that dissolves the ground you are standing on is a different and
   * much meaner idea.
   *
   * What is new is the height, and it is a framing problem rather than a
   * taste. 2-3 is shot in cinemascope, which is a *crop*: the window is 160 px
   * and the player sits 55 % down it, so from the desert floor the level shows
   * rows 6 to 13 and no higher. `switch_wall` hangs its slab at rows 5-7, so
   * in a letterboxed level its top row would turn to coins outside the frame.
   * This slab hangs at 6-8 and is read from the floor without moving.
   *
   * Dropping it a row also buys the smallest player a bigger share of it, and
   * that was measured rather than assumed: one jump from the floor carries the
   * body through rows 8 and 7 but not row 6, so this slab gives two of its
   * three coin rows at power level 0 where `switch_wall`'s gives one. The rest
   * is what a power level is for.
   *
   * The slab sits directly over the button instead of beside it because ten
   * seconds is a window, not an errand.
   */
  dune_switch: ck(16, {
    6: '     BBBBBB',
    7: '     BBBBBB',
    8: '     BBBBBB',
    9: '  o  S',
    13: G,
    14: G,
  }),

  /* ---------------------------- juoksuhiekka --------------------------- */
  /**
   * The first quicksand in the game, and it is built so that it **cannot kill
   * anybody**.
   *
   * One tile deep with sand under it, and that is the whole safety argument
   * rather than a kindness: the engine drowns you when the *whole body* is
   * below the surface, and the smallest body is 16 px — exactly one tile. A
   * player standing on the floor of this pool has his head on the rim to the
   * pixel, so there is no input, no power level and no ground pound that puts
   * him under. Verified rather than reasoned: `verify.mjs` drops a power-0
   * player in, does nothing for 900 frames, and asserts he is still there.
   *
   * That is what makes it a lesson. What it teaches is the one thing about the
   * tile that a player cannot guess — **the jump button is not a jump in
   * here**. Falling in takes your speed away in a single frame, the sand
   * rustles, and the button you have relied on for two worlds gives you a
   * feeble kick instead. Learning that costs a couple of seconds off the clock
   * here, and it is what keeps the two-tile pool in 2-3 fair.
   *
   * The coins are directly over the pool on purpose, and they are the same four
   * the `coins` chunk this replaces had. The greedy line and the safe line are
   * the same line — a running jump takes all four and lands past the sand —
   * and the player who stops to jump straight up for them falls in, which is
   * precisely the harmless mistake this chunk exists to hand out.
   *
   * Four wide against a measured jump budget of six, so it is cleared without
   * thinking by anyone who sees it coming. It is not a gap and the validator
   * does not read it as one (see `checkQuicksand` in rules.js); the width is
   * about the player, not the rule.
   */
  dune_sink: ck(16, {
    9: '     oooo',
    13: '#####~~~~#######',
    14: '################',
  }),

  /**
   * And the one that can. Two tiles deep, dug into a low sand bank.
   *
   * **The depth is the entire design and it is arithmetic, not taste.** The
   * pool is 32 px; the bodies in this game are 16, 26, 30, 34, 38 and 43 px
   * tall. So power levels 0, 1 and 2 can be pulled under it and 3, 4 and 5
   * cannot — their heads stay over the rim standing on the bottom. That is the
   * same bargain every other hazard in the game strikes, said in geometry
   * instead of in hit points: being bigger is worth something, and it is worth
   * exactly what it looks like it is worth.
   *
   * **Why it needs a bank at all.** A band is fifteen rows and the ground is
   * the bottom two, so a pool dug into the ordinary floor can only ever be one
   * tile deep before it runs out of level to have a bottom in — and a pool with
   * no bottom is a pit with sand painted on it, which is the failure
   * `checkQuicksand` reports by name. Raising the floor one row buys the second
   * tile of depth honestly. The step up is one tile, against a measured wall
   * budget of four.
   *
   * The banks were also the fence, and **they are not load-bearing any more.**
   * The paragraph that stood here said the two walkers had to be kept out of
   * the pool because a walker that wandered in would sink to the bottom and
   * keep walking, invisible — a bug that looks like a joke. That was true, and
   * relying on placement to prevent it was a constraint held in place by
   * nobody moving anything. The engine now knows: `Enemy.sink()` gives a
   * walker the same sand the player gets, so one that wandered in would wade,
   * go under and be gone in 185 frames instead of patrolling the bottom.
   *
   * The walkers stay where they are all the same, and that is a level-design
   * choice rather than a safety measure. They are the same two walkers as the
   * `walkers` chunk this replaces, in the same places, so this level's enemy
   * count, its difficulty reading and its rhythm are all the ones that were
   * measured. Moving one into the sand would be redesigning a shipped level to
   * show off a fix, which is the wrong order to do those two things in.
   *
   * Three columns wide, with the coins two rows over the bank so the jump that
   * takes them is the jump that clears the sand. Same trick as the shallow one
   * and for the same reason: the reward is on the safe line, and the sand is
   * what you get for being greedy in the wrong direction.
   */
  dune_sink_deep: ck(16, {
    10: '       ooo',
    12: ' g  XXX~~~XXXX g',
    13: '####XXX~~~XXXX##',
    14: '################',
  }),

  /* ------------------------ savikuoppa: 2-4:n kaivanto ------------------ */
  /**
   * KUOPPA JOHON KÄVELLÄÄN, EIKÄ JONKA YLI HYPÄTÄÄN.
   *
   * Tähän asti peli on opettanut kuopan yhdellä tavalla: se on reikä, sen yli
   * mennään, ja sen pohja on kuolema. `pit_s`, `pit_l`, `pit_twin` ja
   * `pit_croak` ovat kaikki sama lause eri leveyksillä. Tämä on sen vastakohta
   * ja se maksaa yhden rivin: **lattian yläpinta puuttuu, alapinta ei**. Rivi
   * 14 on ehjä, joten kaivanto ei ole kuilu vaan käytävä jonka pohjalla
   * kävellään ruutu alempana kuin reunalla.
   *
   * Mitä se ostaa, sanottuna niin että sen voi tarkistaa:
   *
   *   - **Validaattori lukee sen oikein ilman poikkeusta.** `checkGaps` etsii
   *     saraketta jossa kumpikaan lattiarivi ei ole kiinteä; tässä alempi on,
   *     joten kaivanto ei ole kuilu eikä sitä mitata hyppybudjettia vasten.
   *     `checkWalls` näkee sisään yhden ruudun laskun ja ulos yhden ruudun
   *     nousun, mitattua neljää vastaan.
   *   - **Vaikeusmittari ei anna siitä pistettä**, ja se on oikein: kaivanto ei
   *     ole vaara vaan maasto. Se mitä se muuttaa on **mihin muu tavara
   *     asettuu** — kävelijä pohjalla on silmien tasalla, korkki reunalla on
   *     pään yläpuolella, ja kolikot ovat neljän rivin päässä eivätkä kolmen.
   *   - **Ja se on ainoa paikka koko pelissä jossa horisontti on lähellä.**
   *     Aavikko on kaukaisuutta joka kentässä; savikuoppa on se kohta jossa
   *     maa nousee molemmin puolin, ja siksi 2-4 on ainoa aavikkokenttä joka
   *     ei ole kinemascopessa (ks. levels/world2.js).
   *
   * Kaksi versiota eikä yksi kolmesti, koska kolmesti toistettu palikka on
   * `tools/variety.mjs`:lle sama ruutu kolmesti. Leveä ja kapea kaivanto
   * kantavat eri asiat: leveässä on kävelijä, kapeassa närästysliekki jonka
   * suihku nousee reunan yli.
   */
  clay_cut: ck(16, {
    10: '     o o o o',
    12: '  c',
    13: '####   g    ####',
    14: '################',
  }),
  clay_rim: ck(16, {
    9: '        o o',
    12: '            k',
    13: '###  H   #######',
    14: '################',
  }),

  /**
   * LAUDOITETTU KAIVANTO — ja koko pelin ainoa palkinto joka on **alempana**
   * kuin reitti.
   *
   * Puulava on tässä pelissä aina ollut tie ylöspäin: sen päälle noustaan ja
   * sen päällä on kolikot. Tässä se on kansi. Savikuopan yli on lyöty lankut
   * penkereen pinnan tasalle, joten reitti kulkee suoraan yli eikä pelaajan
   * tarvitse tietää kaivannosta mitään — ja koska `-` on yksisuuntainen, sen
   * läpi pääsee alas painamalla alas ja takaisin ylös hyppäämällä.
   *
   * Penger on nostettu rivin verran (`dune_sink_deep`in temppu, sama syy):
   * kaivannon pohja on rivi 14, joten kansi mahtuu riville 12 ja väliin jää
   * yksi rivi joka on juuri sen kokoinen että siellä on jotain. Ilman
   * pengertä lankku olisi kaivannon pohjalla eikä sen päällä.
   *
   * **Kolikot ovat molemmin puolin lautaa, ja se on sääntö eikä anteliaisuus.**
   * Validaattorin "ei portaita tyhjään" katsoo lavarivin *yläpuolelle* neljän
   * ruudun sisään, joten kansi ilman mitään ylhäällä on kenttä jonka se
   * hylkää — aivan oikein, koska yli kävelevä pelaaja ei saisi mitään. Ylhäällä
   * olevat kaksi merkitsevät ylityksen, alla oleva rivi on se mitä uteliaisuus
   * maksaa.
   */
  clay_boards: ck(16, {
    9: '     o   o',
    12: '####--------####',
    13: '####oooooooo####',
    14: '################',
  }),

  /**
   * TIILIHOLVI SAVIKUOPAN POHJASSA — ja ensimmäinen paikka jossa paukkupavun
   * voi käyttää sen jälkeen kun sen on voittanut.
   *
   * `baron_vault` on sama ajatus (muurattu ovi, palkinto takana) ja se on
   * neljä sekuntia palkinnon jälkeen, eli oppitunti. Tämä on käyttö: se on
   * yhteisellä tiellä, kaksi kenttää minipomon jälkeen, ja se on siellä
   * *nimenomaan siksi* että kaksi uutta kenttää tulivat risteyksen jälkeen
   * eivätkä ennen sitä (perustelu on worlds.js:ssä).
   *
   * Muoto on eri kuin `baron_vault`illa eikä vain peilikuva. Se on hylly
   * johon kiivetään; tämä on **maan tasossa**, holvi jonka katto on se sama
   * kansi jota pitkin reitti kulkee yli. Neljän ruudun tiilipilari on ainoa
   * ovi, sen yli pääsee mitatulla nousulla (4 laattaa, sama kuin
   * `brick_wall`illa jonka pelaaja on ylittänyt 2-2:ssa), ja katto on kolme
   * riviä holvin lattian yllä — tasan se korkeus jonka isoin keho tarvitsee,
   * eli sisään murtautunut pelaaja ei jää kattoon kiinni.
   *
   * **Se on palkinto eikä reitti**, ja se on rakenteessa eikä lupauksessa:
   * kansi on kuljettava, holvissa on vain kolikoita, eikä maali ole sen
   * takana. Palkitsematonta reittiä kulkeva pelaaja kävelee tästä yli
   * huomaamatta mitään puuttuvan.
   */
  clay_vault: ck(16, {
    9: '     XXXXXXX',
    10: '     B     X',
    11: '     B ooo X',
    12: '     B ooo X',
    13: G,
    14: G,
  }),

  /* --------------------------- paahde: 2-5:n kuumuus -------------------- */
  /**
   * KOLME LIEKKIÄ, JA NE OVAT RYTMI EIVÄTKÄ ESTE.
   *
   * Närästysliekki on esitelty 2-2:ssa yksittäisenä ja käytetty 2-N:ssä
   * lyhtynä. Tässä sitä käytetään kolmantena asiana: **metronomina**. Kolme
   * suihkua kuuden sarakkeen välein on kentän mitassa sama kuin
   * `heartburn_pair`in kaksi yhdessä palikassa, mutta ero on se että
   * jokaisella on oma laskurinsa (`Heartburn` käynnistyy satunnaisesta
   * arvosta), joten kolmea ei voi ohittaa yhdellä opitulla tahdilla. Se on
   * juuri se lause jonka linnake sanoo seuraavaksi.
   *
   * Kolikot ovat suihkujen *välissä* eivätkä niiden päällä, koska ahne linja
   * ja turvallinen linja ovat tässä sama linja: kolikko on siinä missä on
   * turvallista seistä ja odottaa.
   */
  heat_row: ck(16, {
    9: '   o o   o o',
    12: '  H     H     H',
    13: G,
    14: G,
  }),

  /**
   * PAAHTEEN PENGER: kahden ruudun terassi jolla kuljetaan linnaketta kohti.
   *
   * Maailman 2 maa on ollut yhtä tasoa kahdeksassa kentässä; viimeisellä
   * yhteisellä matkalla se nousee. Penger on kaksi laattaa eli puolet
   * mitatusta noususta, joten se on kuljettava eikä este — ja se on
   * kokonaisen ruudun mittainen, joten se muuttaa horisontin eikä ole askelma.
   *
   * Kolikot ovat pengerryksen päällä kolme riviä ylhäällä: sama hyppy joka
   * nousee terassille ottaa ne, eli nousu on itsessään palkittu.
   */
  heat_step: ck(16, {
    8: '        o o o',
    11: '       XXXXXXXXX',
    12: '       XXXXXXXXX',
    13: G,
    14: G,
  }),

  /**
   * Sama penger toisin päin: hylly joka **alkaa** korkealta ja päättyy
   * pudotukseen, ja jonka reunalla seisoo liekki. Kolme kolikkoa hyllyn päällä
   * ovat se rivi joka kertoo mihin asti sillä kannattaa kävellä.
   *
   * Liekki on hyllyn *jälkeen* eikä sen päällä, koska hyllyn päällä se olisi
   * este (kaksi laattaa kapealla tasanteella) ja sen jälkeen se on ajoitus:
   * pudotus antaa vauhdin, ja vauhdin kanssa liekin ohi mennään tai ei mennä.
   */
  heat_ledge: ck(16, {
    9: '   o o o',
    11: '   XXXXXXXX',
    12: '   XXXXXXXX H',
    13: G,
    14: G,
  }),

  /**
   * Ja kahdessa portaassa ylös, tämän maailman viimeinen nousu ennen ovea.
   *
   * Kaksi laattaa ja sitten kolmas: kumpikaan askel ei ole mitatun nousun
   * (neljä laattaa) rajoilla, joten tämä ei kysy mitään uutta — se **näyttää**
   * jotain. Linnake on kartalla ylempänä kuin mikään muu maailman 2 solmu, ja
   * tämä on ainoa paikka jossa sen näkee kentän sisältä: maa nousee kolme
   * riviä eikä laske enää ennen maalitolppaa.
   */
  heat_ramp: ck(16, {
    8: '          o o',
    10: '        XXXXXXXX',
    11: '    XXXXXXXXXXXX',
    12: '    XXXXXXXXXXXX',
    13: G,
    14: G,
  }),

  /* --------------------------- minipomoareena -------------------------- */
  /**
   * The papuparoonit's arena: two stone plinths in a sand bowl, one baron on
   * each, and nine columns of open floor between them to be shot at across.
   *
   * Thirty-two columns, like `boss_arena`, and for the same reason: a fight
   * needs to fit on the screen at once. The window is 320 px — twenty tiles —
   * so a 32-column arena is a screen and a half, which is enough that the two
   * throwers cannot both be dealt with from one spot and little enough that
   * neither is ever off-screen while the other is being fought.
   *
   * **The plinths are two tiles tall and that is measured, not chosen.** Their
   * tops sit 32 px over the sand; a standing jump lifts the feet 71 px at power
   * level 0, so the smallest player gets on top of one — and, more to the point,
   * over a baron's head (its own head is 26 px above the plinth) — without a
   * power-up. The fight is winnable at the smallest size or it is not a fight
   * in this game.
   *
   * They are connected to the ground rather than floating, which is what keeps
   * the headroom rule honest here: the tallest player needs three clear rows
   * over anything it can walk on, and rows 8-10 above each plinth are empty.
   *
   * **Nothing in here is a wall.** The floor runs unbroken from edge to edge,
   * so the arena is passable at the smallest size with the fight ignored
   * entirely — which is the same promise every other chunk makes, and the
   * reason the reward can be a power-up rather than a key.
   */
  baron_arena: ck(32, {
    9: '            o o o o',
    10: '        P            P',
    11: '      XXXXX        XXXXX',
    12: '      XXXXX        XXXXX',
    13: G + G,
    14: G + G,
  }),

  /**
   * And what the paukkupapu is *for*, put where it is won.
   *
   * A sealed vault on a mesa shelf: brick on the left, rock on the right, a rock
   * lid over the top, coins inside. There is no way in over it and no way in
   * round it — the brick pillar reaches the lid — so the only way in is through,
   * at a run, which is the one thing the new power-up does. A player who has
   * just beaten the barons meets it four seconds later, which is where a lesson
   * belongs.
   *
   * **It is a reward and never the route.** The sand below runs unbroken past
   * the whole thing; the shelf is a place you climb to on purpose.
   *
   * The shelf is at row 9 rather than row 11, and that is the same measurement
   * `dune_crumble` had to make: `X` is solid, so a shelf two rows over the sand
   * is a ceiling three tiles above ground the player walks on and the headroom
   * rule rejects it. At row 9 it is 64 px up, which a running jump clears at
   * power level 0 — the same climb the boardwalk in 2-N already asks for.
   */
  baron_vault: ck(16, {
    5: '       XXXXXXX',
    6: '       B     X',
    7: '       B ooo X',
    8: '       B ooo X',
    9: '   XXXXXXXXXXX',
    13: G,
    14: G,
  }),

  /* ------------------------- salaiset alueet -------------------------- */
  /**
   * The room at the top of world 2's beanstalk.
   *
   * Sixteen columns wide and not thirty-two, and that width is the whole
   * safety argument. The room is exactly as wide as the chunk that carries the
   * vine, so every edge you can walk off is over that chunk's own floor — and
   * walking off the edge is how you leave, because a bonus area you cannot
   * leave is a trap. A wider room would hang over whatever chunk happens to
   * come next; in 2-2 the next one along is `pit_bridge`, so the generous
   * version of this room would drop you into a pit, and it would do it only
   * for the players who explored.
   *
   * The vine runs three rows past the planks so you step off sideways instead
   * of guessing where to let go, and the landing is planks and not ground for
   * the reason the grass one gives: anything solid beside the vine is a
   * ceiling that stops the biggest power level climbing past it.
   */
  mesa_sky: ck(16, withVine({
    5: '       ?!?',
    8: '        ooooo',
    9: '       ---------',
  }, 6, 6, 14)),

  /**
   * And the room under the warp pipe: a tomb under the sand.
   *
   * Same width trick as the sky room, for a harder reason. The exit pipe is
   * the one thing in a hidden area that can genuinely strand somebody: the
   * biggest power level is 21x43 px, so if the surface above the exit is not
   * three tiles of clear air the warp simply refuses, and the biggest player
   * is sealed in a bonus room. Making this room exactly as wide as the chunk
   * that holds the entry pipe puts the exit under that same chunk's own floor
   * — clear by construction, not by inspection, and it cannot be broken later
   * by somebody editing the chunk next door.
   *
   * The entry lands in the left half and the exit hangs in the right, so the
   * room is crossed rather than looked at. Nothing solid sits in rows 8-11 of
   * the arrival columns: that is the box the falling player occupies, and rock
   * in it would make the pipe refuse from above instead.
   *
   * **The exit hangs from the ceiling rather than standing on the sand**, and
   * the two rows it had are the two rows it has — turned upside down. You leave
   * this room upwards, and `tryWarp` asks that the mouth you enter faces the
   * way you are going. Row 9 is the mouth for the reason `cave_room` gives:
   * three empty rows over the floor is the one height that clears the tallest
   * body and stays within reach of the smallest.
   */
  tomb_cave: ck(16, {
    5: 'XXXXXXXXXXXXXXXX',
    6: 'X          {}  X',
    7: 'X  ?B!B?   {}  X',
    8: 'X          {}  X',
    9: 'X   oooooo ()  X',
    10: 'X   oooooo     X',
    11: 'X              X',
    12: 'X              X',
    13: 'XXXXXXXXXXXXXXXX',
    14: 'XXXXXXXXXXXXXXXX',
  }),
};
