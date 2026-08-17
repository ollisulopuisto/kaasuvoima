/**
 * World 6's chunks — luulaakso, the boneyard, and the world that follows the
 * factory.
 *
 * ## The constraint, and it is the factory's rule run backwards
 *
 * `chunks/factory.js` justifies its own existence in one sentence: every chunk
 * in it has a ceiling, because the factory is indoors, and one of its pieces
 * dropped into an open-air level would leave a roof hanging over nothing. This
 * file's rule is the mirror image of that, and the mirror is the point:
 *
 *   **nothing here has a ceiling, and nothing here hangs.**
 *
 * Two halves, both asserted in `verify.mjs` rather than merely written down:
 *
 *   - **the sky is open** — rows 0..4 are empty in every chunk below. That half
 *     is a fence around the *previous* world rather than around this one: a
 *     `fac_*` piece cannot come here, because its roof would cover the moon and
 *     the stars, and the moon is the reason this world reads as midnight at
 *     all. Which is the honest answer to "what stops these mixing": the traffic
 *     that has to be stopped runs factory→boneyard, not boneyard→anywhere, and
 *     saying so is more useful than pretending the fence is symmetrical.
 *   - **bone stands** — every `X` and every `#` above the floor rows rests on
 *     something directly beneath it. A skeleton is by definition a thing that
 *     holds itself up, so this world's vertical interest grows out of the
 *     ground: spines, headstones, rib stumps. Blocks, planks and coins float
 *     here exactly as they do everywhere else, because none of them is bone.
 *
 * The second half is the one that costs something. It rules out the obvious
 * first idea — a rib **arch** over the route — because an arch needs legs, legs
 * on the walking floor are a wall, and a wall taller than the measured
 * `wallTiles` is a level the smallest size cannot pass. So the ribs in this
 * world are stumps standing beside a grave rather than an arch over the road,
 * and what spans the road is a plank, which is not bone and is allowed to
 * float. That is a real design consequence of a written rule, which is the only
 * kind of rule worth writing.
 *
 * ## What is deliberately NOT here
 *
 * The pits, the staircases and the plain flat ground are `common.js`'s, and the
 * levels of world 6 use them by name. A bone-coloured copy of `pit_l` would be
 * five places to fix when the floor changes and would say nothing new — the
 * world's palette already paints them (`THEMES.bone`). Only the pieces that are
 * this world's own idea live here.
 *
 * The fortress, 6-F, is indoors and uses the shared `fort_*` corridors like
 * every other world's fortress. A crypt is not a boneyard, and `bg: 'none'`
 * says so on the screen.
 */

import { ck, G } from './common.js';

export const BONE_CHUNKS = {
  /**
   * Hautakivet. One-tile stumps standing out of the floor, and the world's
   * cheapest sentence: this is a place where things have been buried.
   *
   * They are `X` and not `B` on purpose. A headstone that breaks when a big
   * player runs into it would teach that the scenery of this world is a
   * material, and the material of this world is the *floor* — the thing you are
   * walking on is the thing they are made of, and it does not break either.
   */
  bone_stones: ck(16, {
    12: '  X  g X  k  X',
    13: G,
    14: G,
  }),

  /**
   * Selkäranka: a spine coming up out of the ground, stepped so that no single
   * column asks for more rise than the measured jump carries. The coins over it
   * are the shape of the hop that takes it, which is this game's one pointing
   * device — and they are also what keeps this from being a climb to nothing.
   */
  bone_spine: ck(16, {
    8: '      oooo',
    10: '       x',
    11: '      XXXX',
    12: '    XXXXXXXX  g',
    13: G,
    14: G,
  }),

  /**
   * Avattu hauta: viisi ruutua tyhjää ja kolikkokaari sen yli.
   *
   * Five and not six, and that is the number the whole world's geometry is cut
   * to. The measured running jump carries six tiles (`tools/jump-budget.json`),
   * and `tools/playable.mjs`'s power-0 bot — which is the design promise made
   * executable — is not reliable at six. Every hole in luulaakso is therefore
   * one under the budget, and there are simply more of them.
   *
   * **Nothing at all stands on the run-up side**, and that is the third time
   * this world learned the same lesson: a headstone two tiles before the lip
   * reads as a wall, so the jump starts early, lands on the stone and goes into
   * the hole from a standstill. Measured, with the stone at column 2: "kuilu
   * sarakkeessa 56" in 6-1 and "kuilu sarakkeessa 104" in 6-2. The coin arc is
   * the marker — it is what this game marks jumps with — and the one headstone
   * left is past the landing, where it is scenery instead of a starting gate.
   */
  /**
   * YÖKIN ENSIESITTELY, ja tässä ruudussa ei ole muuta.
   *
   * Yökki itse on hidas ja vaaraton; opeteltava asia on **se mikä siitä
   * tulee**, ja karvapallo tarvitsee lattiaa kulkeakseen. Siksi tämä on
   * maailman tasaisin ruutu: koko 16 saraketta on maata, jotta ensimmäinen
   * pallo ehtii lähteä, kiihtyä ja tulla vastaan siinä missä sen yli myös
   * pääsee.
   *
   * Se seisoo ruudun oikeassa laidassa eikä keskellä, koska `YOKKI_RANGE` on
   * 180 px eli yksitoista ruutua: pelaaja astuu ruutuun juuri sen rajan
   * ulkopuolelta ja näkee siis yökkäyksen alusta asti. Ruudun vasempaan päähän
   * pantuna ensimmäinen pallo olisi jo matkalla ennen kuin sen lähde on
   * näkynyt, ja se on eri asia opittavaksi.
   */
  bone_yokki: ck(16, {
    9: '   o o o',
    12: '            Y',
    13: G,
    14: G,
  }),

  /**
   * YÖKKI TOISEN KERRAN, ja nyt korokkeella.
   *
   * Karvapallo seuraa maastoa, joten korokkeelta lähtevä pallo **putoaa
   * reunalta alas ja jatkaa matkaansa** — se tulee siis ylhäältä eikä
   * edestä, ja ensimmäisen kerran opetus ("hyppää sen yli") ei enää yksin
   * riitä. Yökki itse on kahden ruudun päässä ylempänä eli tallattavissa, ja
   * se on tämän ruudun toinen puoli: lähde on saavutettavissa jos sinne
   * uskaltaa mennä.
   */
  bone_yokki_ledge: ck(16, {
    9: '        X  o o',
    10: '       XX',
    11: '      XXX',
    12: '  g  XXXXY',
    13: G,
    14: G,
  }),

  bone_grave: ck(16, {
    7: '             f',
    9: '          o o o',
    12: ' X  g',
    13: '#########     ##',
    14: '#########     ##',
  }),

  /**
   * Kylkiluut haudan yllä — the same hole as `bone_grave`, with a plank across
   * it. Bone may not float, so what spans the road is a plank and not an arch;
   * the ribs standing on the run-up side are what the arch became.
   *
   * A plank over a gap is its own reward (DESIGN.md §5), so nothing is hung
   * above it. What it costs the level is measured and worth knowing: the
   * difficulty meter cuts a gap at every column with a plank over it, so a
   * bridged hole scores **no gap risk at all**. It buys exposure and aim, not
   * danger — which is exactly what a bridge should buy.
   */
  bone_ribs: ck(16, {
    7: '          r',
    10: '        ------',
    12: ' X  g',
    13: '#########     ##',
    14: '#########     ##',
  }),

  /**
   * Leuat: kaksi hammasriviä, lauta ensimmäisen yli.
   *
   * This is the chunk world 6's breather is built out of, and it is what a
   * breather in the *last* world is allowed to be: the floor is full of teeth
   * and there is nothing to fall into. A mistake costs a power level, which is
   * why 6-2 can be dense without being lethal — and the density is the point,
   * because the world after world 5 cannot rest by being empty.
   *
   * **Two beds of four rather than one of eight, and a bridge over only one of
   * them.** Both halves of that are measured. The bot reads a spike bed as one
   * obstacle and holds a jump proportional to its width, so eight tiles of
   * teeth is a ten-tile hop against a 155 px running carry; and a five-wide bed
   * under a full-width bridge is what killed it in 6-3 ("maasto sarakkeessa
   * 130"), because the bridge is where it lands and the bed is where the
   * bridge ends. Four wide, bridged once, is the shape that walks.
   */
  bone_jaws: ck(16, {
    8: '    ooo',
    9: '  -------',
    12: '   ^^^^   ^^^^',
    13: G,
    14: G,
  }),

  /** Hautamultaa, eli tämän maailman tiili. Ivory ground, dark earth blocks —
   *  the pair `verify.mjs` measures as the most legible in the game. */
  bone_marrow: ck(16, {
    9: '  BB?BB',
    12: '   g       x',
    13: G,
    14: G,
  }),

  /**
   * Tanssi. Three walkers, evenly spaced, on empty ground.
   *
   * Nothing else is in it, and that is the whole chunk: *Danse macabre* is a
   * waltz, the track is in three, and three enemies at the same spacing is the
   * one thing a level can do that the music is already doing. It is also the
   * cheapest kind of difficulty there is — no gap, no hazard, no aim — which is
   * why it can be used generously without turning the world into a gauntlet.
   */
  bone_dance: ck(16, {
    12: '  g     g     g',
    13: G,
    14: G,
  }),

  /**
   * Virvatuli kuopan yllä. The stink cloud bobs around its spawn height, so it
   * may never be placed on the ground (DESIGN.md §6) — here it hangs over a
   * grave, which is the one place in this world where being pushed sideways
   * costs a life rather than a power level.
   *
   * Same floor as `bone_grave`, to the column. That is not laziness: nine tiles
   * of run-up, five of hole, two of landing is the one profile this world's
   * holes are cut to, so two of them can stand side by side in a playlist and
   * the second still gets its run-up. Measured the other way round — three of
   * them in a row is where the power-0 bot falls in ("kuilu sarakkeessa 93"),
   * which is why the levels below never chain more than two.
   */
  bone_wisp: ck(16, {
    6: '           r',
    9: '          o o o',
    12: '  k',
    13: '#########     ##',
    14: '#########     ##',
  }),

  /**
   * Kalmanharju: a two-step climb onto a bone shelf with a spiky walker on top
   * of it. The shelf is `X` sitting on its own stack all the way to the floor,
   * so it is a hill and not a platform — and the spiky walker up there cannot
   * be answered by the move that answers everything else, which is what the
   * height is for. Nothing to fall into: this is a question about the enemy.
   */
  bone_ridge: ck(16, {
    9: '       x',
    10: '     XXXXXXX',
    11: '   XXXXXXXXX',
    12: '   XXXXXXXXXXX g',
    13: G,
    14: G,
  }),

  /**
   * Ruumisarkkuja pinossa. Grave earth stacked into a wall with a `?` over it
   * and a walker behind it.
   *
   * **Three tiles tall and not four**, which is one under the measured
   * `wallTiles` budget, and the reason is the same as everywhere else in this
   * file: at four the power-0 bot climbed it and then could not cross the next
   * hole ("kuilu sarakkeessa 215" in 6-1), because a four-tile wall is a
   * full-height jump and it lands on top with nothing left. `brick_wall` in
   * common.js keeps its four — world 1 has room around it — and this world,
   * which has a hole every second chunk, does not.
   */
  bone_coffins: ck(16, {
    6: '      B?B',
    10: '      BBB',
    11: '      BBB',
    12: '      BBB   g',
    13: G,
    14: G,
  }),

  /* -------------------------- minipomo 6-M --------------------------- */
  /**
   * LUUVALTAISTUIMET — luulaakson minipomotaistelu, ja se on `baron_arena`n
   * sisar eikä sen kopio.
   *
   * Rakenne on sama ja **tarkoituksella sama**: kaksi kahden laatan koroketta,
   * yksi ampuja kummallakin, ja väliä sen verran ettei molempia voi hoitaa
   * yhdestä paikasta. Papuparoonit opettivat tuon muodon maailmassa 2, ja
   * minipomotaistelu on siitä lähtien ollut tunnistettava kuva; uusi pohjakaava
   * olisi uusi asia opeteltavaksi juuri siinä hetkessä jossa palkinto on
   * pelissä.
   *
   * Mikä on eri, on **kuka siellä seisoo**. Yökki sylkee kaaressa ja
   * paroonit heittävät suoraan, joten koroke tekee tässä eri työn: kaari
   * lyhenee korkeuden myötä, ja kahden ruudun koroke on juuri se korkeus jolta
   * sylky yltää korokkeiden väliin muttei niiden yli. Korokkeelle pääsee
   * voimatasolla 0 (paikaltaan hyppy nostaa 71 px, koroke on 32 px), eli sama
   * lupaus kuin paroonien kuopassa: taistelun voi voittaa pienimpänä.
   *
   * **Mikään tässä ei ole seinä.** Lattia kulkee katkeamatta reunasta reunaan,
   * eli areenan läpi pääsee myös taistelematta — ja juuri siksi palkinto saa
   * olla tehostus eikä avain.
   */
  bone_arena: ck(32, {
    9: '            o o o o',
    10: '        Y            Y',
    11: '      XXXXX        XXXXX',
    12: '      XXXXX  g   g XXXXX',
    13: G + G,
    14: G + G,
  }),

  /**
   * Ja mihin murtava voima on: muurattu holvi hyllyllä, kolikot sisällä.
   *
   * Sama ajatus kuin `baron_vault`illa ja samat mitat, koska oppitunti on sama:
   * palkinto voitetaan neljä sekuntia aiemmin, ja tässä se pääsee heti
   * käyttöön. Tiilipilari yltää kanteen asti, joten yli ei pääse eikä ympäri —
   * ainoa tie on läpi, juoksuvauhdilla, ja se on tasan se mitä uusi voima tekee.
   *
   * Hylly on rivillä 9 eikä 11: kiinteä laatta kahden rivin päässä maasta on
   * katto kolmen laatan päässä siitä lattiasta jolla kävellään, ja
   * kattosääntö hylkää sen. Rivillä 9 se on 64 px ylhäällä, minkä juoksuhyppy
   * nousee voimatasolla 0.
   */
  /*
   * Holvi on **tiiltä eikä luuta**, ja sen määräsi tämän maailman oma sääntö.
   *
   * `baron_vault` on aavikossa kalliohylly ilmassa; täällä jokainen `X` ja `#`
   * nojaa johonkin suoraan allaan, koska luuranko on määritelmän mukaan asia
   * joka kannattaa itsensä. Kivikansi kaatoi portin kahdesti — ensin hyllynä
   * (viisi laattaa ilmassa), sitten seinien päällä lepäävänä kantena (samat
   * viisi) — ja molemmilla kerroilla vika oli sama: **ontto huone ei voi olla
   * luuta.** Lohkot sen sijaan saavat leijua kuten kaikkialla muuallakin, eli
   * holvi on muurattu umpeen joka puolelta.
   *
   * Se muuttaa myös lupauksen paremmaksi kuin aavikossa: siellä muurin läpi oli
   * ainoa tie **sisään**, tässä koko rakennus on sitä samaa tiiltä. Murtava
   * voima ei siis avaa ovea vaan syö seinän, ja se on tarkempi kuva siitä mitä
   * se tekee.
   */
  bone_vault: ck(16, {
    9: '      BBBBBBB',
    10: '      B     B',
    11: '      B ooo B',
    12: '      B ooo B',
    13: G,
    14: G,
  }),

};

/*
 * THE ONE THAT IS NOT HERE, AND WHY.
 *
 * There was a `bone_twin` — two graves with an island between them, the way
 * `pit_twin` is built — and it is gone rather than merely unused, because a
 * chunk nobody may place is worse than no chunk. Three attempts, all measured
 * against `tools/playable.mjs` at power level 0:
 *
 *   5+5 with a two-tile island   kuilu sarakkeessa 125 (6-3)
 *   5+5 with a three-tile island kuilu sarakkeessa 165 (6-1)
 *   4+4 with a four-tile island  kuilu sarakkeessa 140 (6-3)
 *
 * The second hop is the one that fails every time, and the reason is in
 * `jump-budget.json` rather than in the bot: a standing jump carries **0 px**
 * horizontally, so a landing island is only as good as the run-up it leaves,
 * and no island narrow enough to be interesting leaves one. `pit_twin` gets
 * away with it in worlds 1-3 where the neighbouring geometry is calm; here
 * every chunk either side of it is a hole or a hazard.
 *
 * So world 6 spends its difficulty on **more single holes** instead. It is the
 * same lesson `pit_twin`'s own comment teaches from the other side — the
 * measured budget is what levels are cut to, not what they are cut against.
 */
