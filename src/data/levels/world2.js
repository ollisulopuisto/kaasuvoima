/**
 * World 2 — the desert, and the first world that branches: 2-N sits off the
 * direct route, so anything unkind can go there instead of on the main line.
 *
 * One mechanic per level, and no level gets two. World 1 owns the star block,
 * world 3 the switch, world 4 the crumbling floor and 1-2 the hidden areas —
 * which was right for a finished game and wrong while nobody can see them, so
 * the desert now takes one of each: the star in 2-1, the secret in 2-2, the
 * crumbling boardwalk in 2-N and the switch in 2-3. Exactly one level in the
 * world hides anything, because a discovery stops being a discovery if there
 * is one in every corner.
 *
 * Everything below is a reward and none of it is the route. Each one is paid
 * for by a chunk it replaces rather than added on top — one decoy pipe is the
 * single exception — so the difficulty curve barely moves: measured, the world
 * average went 124.2 -> 123.5, the per-level shape 94 -> 111 -> 98 -> 140
 * became 94 -> 105 -> 100 -> 141, and the world still has exactly one dip.
 *
 * **What this world took over from world 1, 9.8.2026.** 1-2 was measured as
 * introducing seven things at once and was cut back to the three it is about
 * (see levels/world1.js). Two of the four it shed landed here, and neither is
 * new content — both species already appeared in these levels and simply became
 * the first place anybody meets them:
 *
 *   2-1  the pipe plant, at column 101, where it already stood
 *   2-2  the stink cloud at column 146 and the note block at column 309
 *
 * "One mechanic per level, and no level gets two" is still the rule for the
 * *optional* mechanics named above. Enemy species are not mechanics in that
 * sense and there is no world in which they are one per level; what they have
 * to obey is the one-screen rule, and `tools/verify.mjs` now asserts it.
 *
 * **Ja 10.8.2026 se sääntö puri tähän maailmaan.** `tools/curriculum.mjs` sai
 * rivin kurnuttajalle — laji oli ollut mittarin ulkopuolella siitä asti kun se
 * tuli peliin — ja 2-1 oli koko pelin ainoa kenttä joka esitteli **neljä**
 * uutta asiaa, kolme niistä saman ruudun sisällä. Mitattu ennen: putkikasvi
 * 101, kurnuttaja 119 (18 päässä), närästysliekki 134 (15 päässä). Sen jälkeen
 * närästysliekki opetetaan 2-2:ssa ja tämän maailman ensiesittelyt ovat:
 *
 *   2-1  aurinko 71, putkikasvi 101, kurnuttaja 197
 *   2-2  ruskea pilvi 146, närästysliekki 194, nuottipalikka 309
 *
 * Se on kolme kenttää kohti, ja tiukin pari koko maailmassa on 2-1:n aurinko ja
 * kasvi 30 saraketta erillään — puolitoista ruutua. Perustelut ovat kenttien
 * omissa kommenteissa.
 */


/*
 * KURNUTTAJAN KUOPPA ON NYT JAETTU PALIKKA, EIKÄ TÄMÄN TIEDOSTON OMA.
 *
 * Tässä oli hetken oma `pit_croak_rim` ja oma `assembleLocal`, koska merkki oli
 * siirrettävä kuilun keskeltä sen lähireunalle mutta `chunks/common.js` oli
 * toisen työn alla. Korjaus on nyt siellä minne se kuuluu, joten sekä palikka
 * että koostaja on poistettu ja 2-1 on taas tavallinen soittolista.
 *
 * Se oli koko kohdan elinkaari, ja se on kirjattu tähän siksi että väliaikaisen
 * ratkaisun arvo on nolla jos kukaan ei tiedä milloin se saa poistua.
 */

export const WORLD2_LEVELS = {
  /*
   * The two open desert levels are shot in Cinemascope. It is the one place in
   * the game where the picture is nothing but sky, dunes and distance, which is
   * the only thing a wider frame is actually good for — and the same bars over
   * a fortress corridor would just be a smaller fortress corridor.
   */
  /*
   * The star block is at chunk 18, and it is in this level rather than in 2-3
   * for a reason that only the desert has.
   *
   * The angry sun wakes at chunk 5 and follows you for the rest of the level.
   * It is the one enemy in the game a stomp has no answer to — and the star
   * turns contact into a shell hit, which is the answer: three touches and the
   * sun goes out. So the reward is not "a walker and a cork are easier for ten
   * seconds", it is "the thing that has been hounding you since the second
   * screen can be put out". It replaces the second `corks` patch, so the level
   * is the same length and the same floor; what used to be two corks is now a
   * block, a walker and one cork.
   *
   * 2-3 was the other candidate and it is the wrong one: that level's killer is
   * lava, the star covers enemies and spikes and pointedly not the level
   * itself, and a power-up that reads as invulnerability standing next to the
   * one hazard it does not cover teaches the lesson backwards.
   *
   * JUOKSUHIEKKA ALKAA TÄSTÄ, ja tämä kenttä on se joka opettaa sen.
   *
   * `dune_sink` replaces the `coins` chunk and carries the same four coins, so
   * the level is the same length, the same floor and the same reward — only
   * what is under the coins is new. (Se `coins` on 10.8.2026 alkaen takaisin
   * kentässä chunk 8:ssa, `heartburn`in tilalla, eli kolikkorivejä on kaksi
   * eikä yksi. Perustelu on kurnuttajan kommentissa alempana.) It is one tile
   * deep with sand under
   * it, which is not a soft first draft but the whole point: the smallest body
   * is exactly one tile tall, so nobody can be pulled under it at any power
   * level, doing anything, including diving into it head first. Measured in
   * `verify.mjs` rather than promised.
   *
   * The first one has to be survivable and the level has to teach before it
   * tests, and here the teaching is a specific thing the player cannot guess:
   * the jump button stops being a jump inside sand. Finding that out costs a
   * few seconds off the clock in 2-1 and nothing else. The two-tile pool that
   * can actually drown you is in 2-3, which is later on the map and on the
   * other branch — so nobody meets the lethal one first.
   *
   * And the star is why it is worth saying where the sand sits in that promise.
   * The star covers enemies and spikes and pointedly not the level itself — a
   * pit, lava, the clock. **Quicksand joins that second list**, deliberately: it
   * is not a thing in the room that hits you, it is the room. A star that
   * carried you across sand would also make the hazard invisible for twelve
   * seconds, which in the one level that hands out the star is the last place
   * anybody should be learning it wrong.
   */
  /*
   * KURNUTTAJA TULEE TÄHÄN, JA VAIN TÄHÄN KOKO MAAILMASSA.
   *
   * Chunk 12 is `pit_croak`, which is the same six-tile hole with something
   * living at the bottom of it. Three reasons this pit and not another:
   *
   *   - **World 1 has to keep its promise first.** Every bare pit in world 1
   *     stays empty on purpose. A pit means "a pit" for a whole world, and 2-1
   *     is the first level after that world ends — the earliest place where
   *     "the hole you already know how to cross" is a thing the player owns
   *     well enough to have it taken away.
   *   - **A hazard in every hole is terrain, and terrain is not a hazard.** So
   *     there is one in the level and one more in the whole rest of the game
   *     (3-3), and the other two pits in this very level — `pit_l` and
   *     `pit_plat` with their stepping stones — are still empty and still
   *     carry their planks. Meeting an empty pit right after an occupied one is
   *     what makes the occupied one mean anything, and the order the level now
   *     reads in is planks first: `pit_l` at 112 you cross by stepping on
   *     something, this one at 192 you cross with nothing under you, and
   *     `pit_plat` at 256 is planks again.
   *   - **It is a swap, not an addition.** Same chunk count, same floor, same
   *     gap width, so the level's shape does not move and the measured
   *     difference is the creature and nothing else: 115.7 -> 119.5.
   *
   * PUTKIKASVIN JA KURNUTTAJAN VIERUSTOVERUUS: MITÄ USKOTTIIN, MITÄ MITATTIIN,
   * MIKÄ MUUTTUI. Tässä luki 9.8.2026 asti argumentti sille että kasvin (chunk
   * 6, sarake 101) ja kurnuttajan **pitää** olla samalla ruudulla: ne ovat pelin
   * ainoat tallaamattomat viholliset jotka varoittavat ennen iskuaan, ja
   * DESIGN.md kohta 8 pelkää kahta signaalia jotka opettavat yhden lukutavan —
   * joten ne pantiin vierekkäin, jotta *ero* näkyisi. Kasvi nousee kannesta jonka
   * ohi kävellään maata pitkin ja vetäytyy kun tullaan lähelle; kurnuttaja nousee
   * kuilusta jonka yli ollaan ilmassa eikä välitä siitä missä kukaan seisoo.
   * Vierekkäin luettuna ne olisivat vastakohta, ruudun päässä toisinto.
   *
   * Se argumentti on nyt kumottu, ja kumoaja on mittaus eikä makuasia. Kun
   * `tools/curriculum.mjs` sai rivin kurnuttajalle 10.8.2026, tämä kenttä oli
   * koko pelin ainoa joka esitteli neljä uutta asiaa — kasvi 101, kurnuttaja
   * 119, närästysliekki 134 — eli kaksi paria yhden ruudun (20 laattaa) sisällä
   * 18 ja 15 sarakkeen etäisyydellä. Vastakkain oli siis "kahden vihollisen ero
   * näkyy parhaiten vierekkäin" ja "yhdellä ruudulla opetetaan yksi asia", ja
   * omistaja ratkaisi sen jälkimmäisen hyväksi: sääntö on ehdoton eikä siihen
   * kirjoiteta poikkeusta, koska poikkeuksellinen sääntö on mitattavissa vain
   * poikkeuksen kohdalla.
   *
   * Ja argumentti oli myös heikompi kuin miltä se näytti. Se väitti että
   * vertailun pitää tapahtua *yhtä aikaa*, mutta pelaaja ei lue kahta
   * vihollista rinnakkain kuin taulukosta — hän kohtaa ensimmäisen, kuolee tai
   * ei kuole siihen, ja kohtaa toisen. Vertailu tapahtuu muistissa, ja
   * muistiin mahtuu 96 saraketta yhtä hyvin kuin 18. Se mitä ero vaatii, on
   * että molemmat ehtii lukea; sitä nimenomaan yhden asian ruutu antaa.
   *
   * Kasvi ei liikkunut mihinkään: se on yhä chunk 6 sarakkeessa 101, ja se on
   * yhä pelin **ensimmäinen**, koska 1-2 luopui omastaan. Se on parempi
   * ensimmäinen kasvi kuin 1-2:n oli: siellä se seisoi viidentoista sarakkeen
   * päässä pavunvarresta ja joutui jakamaan ruudun sen kanssa, täällä sillä on
   * kolmekymmentä saraketta puhdasta maata takanaan ja vihainen aurinko on jo
   * kaukana. Liikkui kurnuttaja, ja liikkui 80 saraketta.
   *
   * MITEN KENTTÄ MUUTTUI, PALIKKA PALIKALTA. Yksi vaihto ja yksi
   * paikanvaihdos, ei yhtään lisäystä: kenttä on yhä 23 palikkaa ja 368
   * saraketta, ja jokainen sen palikka paitsi `heartburn` on yhä siinä.
   *
   *   chunk 7 ja 12  `pit_croak` ja `pit_l` vaihtoivat paikkaa. Kurnuttaja on
   *            nyt sarakkeessa 197, 96 saraketta kasvista, ja astinkivellinen
   *            kuilu on siinä missä miehitetty oli. Tämän siirron ehdotti
   *            `tools/curriculum.mjs`:n oma kommentti silloin kun se vielä
   *            kirjasi tämän riidaksi ("swapping `pit_croak` with `pit_l` puts
   *            the creature at 197 and clears the rule"), ja se on kaikista
   *            vaihtoehdoista se joka ei siirrä mitään muuta: aurinko, kasvi,
   *            hiekka ja kuori jäävät sarakkeilleen.
   *   chunk 8  `heartburn` -> `coins`. Sama tasainen lattia kuin liekillä oli,
   *            eli hiekan vauhdinotto (21 saraketta) ei muuttunut — ja se on
   *            mitattu eikä oletettu, koska `tools/playable.mjs` kaatuu
   *            hiekkaan jos vauhtia ei ole: hiekassa hyppy ei ole hyppy. Palikka
   *            on juuri se `coins` jonka `dune_sink` aikanaan syrjäytti, eli
   *            kenttä sai takaisin oman kolikkorivinsä.
   *
   * Ja `pit_croak`in merkki on nyt kuilun lähireunalla, eli sama kuilu jossa merkki on kuilun
   * etureunassa eikä keskellä. Se on POHJAn korjaus eikä kosmetiikkaa, ja koko
   * perustelu on palikan omassa kommentissa tämän tiedoston alussa: mitattu
   * jarrutusikkuna 193–196 on nyt kokonaan maata, ennen se oli kaksi saraketta
   * ilman päällä.
   *
   * NÄRÄSTYSLIEKKI MUUTTI 2-2:EEN, ja se on tämän korjauksen hinta sanottuna
   * ääneen. Kenttä ei saa esitellä yli kolmea uutta asiaa (`verify.mjs`), ja
   * aurinko, kasvi ja kurnuttaja ovat jo kolme — aurinko siksi että sitä ei ole
   * missään muualla koko pelissä, kasvi siksi että 1-2 juuri luovutti sen
   * tänne, kurnuttaja siksi että tämä on ensimmäinen kenttä maailman 1 lupauksen
   * jälkeen. Liekki oli neljäs ja ainoa jonka siirto ei maksa mitään: se
   * esiintyy kuudessa muussa kentässä, ja niistä ensimmäinen — 2-2 — tulee
   * heti tämän jälkeen **molemmilla reiteillä**, joten kukaan ei kohtaa sitä
   * myöhemmin kuin ennenkään paitsi yhden kentän verran. Se on ainoa
   * ensiesittely tässä korjauksessa joka vaihtoi kenttää, ja se vaihtoi
   * kentän eikä haaraa.
   *
   * Chunk 1 is `pipe_short` and not `flat`, and it costs nothing: the chunk it
   * replaced was sixteen columns of empty ground. What it buys is one more
   * ordinary two-tile pipe in a game where two thirds of them used to be warps
   * (see 1-1 in levels/world1.js for the whole argument). The three coins over
   * the lid are the same three coins every such pipe carries, and this level
   * has no warp for them to point at.
   */
  '2-1': {
    theme: 'desert', bg: 'dunes', music: 'level', letterbox: true,
    chunks: [
      'start', 'pipe_short', 'power', 'walkers', 'sun', 'corks',
      'pipe_plant', 'pit_l', 'coins', 'dune_sink', 'shell', 'plat_steps',
      'pit_croak', 'flyer', 'bricks', 'ledge', 'pit_plat', 'star_block',
      'power', 'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * World 2's hidden level, and the only one in the world. The beanstalk at
   * chunk 8 (column 128) climbs into the sky band and the warp pipe at chunk
   * 14 (column 224) drops into the cave band; neither is on the way to the
   * flag, and the ground route is the level it was before.
   *
   * Why this level and not 2-1 or 2-3: those two are shot in cinemascope, and
   * the bars are a crop rather than a mask — the window is 160 px instead of
   * 208. A hidden area is the one thing in this game that is *vertical*, so
   * hiding one behind a letterbox is asking the level to work against its own
   * framing. 2-2 is the desert's only unletterboxed daylight level, and it
   * sits where 1-2 sits in its world, which is the shape a player has already
   * learned once.
   *
   * The rooms are `mesa_sky` and `tomb_cave` rather than the grass world's
   * pair, and both are sixteen columns wide instead of thirty-two so that each
   * sits exactly over (or under) the chunk that leads to it — see the reasons
   * in chunks/desert.js.
   *
   * `clouds` and `pit_bridge` changed places for the same reason, and this one
   * was found by measuring rather than by looking. Leaving the sky room is a
   * walk off the edge and a fall of some three hundred pixels, and you can
   * hold a direction the whole way down — so the question is not whether there
   * is ground *directly* under the room but how far you can drift before the
   * ground runs out. With `pit_bridge` immediately after the beanstalk the
   * answer was two tiles to the right, which is a bonus that ends in a pit for
   * anyone who walks out of it the way they came in, and only for the players
   * who explored. Swapping the two chunks costs nothing — same chunks, same
   * count, so the difficulty score does not move — and buys 18 tiles to the
   * right and 12 to the left. 1-2's shipped sky garden measures 18 and 10.
   *
   * `pipe_short` at chunk 13 is a decoy and is the only chunk that was added
   * rather than swapped. A warp pipe is drawn as an ordinary pipe with a slow
   * shine in the throat, which is only a discovery if the level has ordinary
   * pipes to compare it with; before this the level had none at all and the
   * one pipe in it would have been a signpost. `coin_stack` paid for the
   * beanstalk (the vine chunk carries its own coins) and `plat_hi` paid for
   * the warp pipe — its coins were a bonus platform, and the room below is a
   * much larger one.
   *
   * That decoy turned out to be the first of nine rather than a one-off: the
   * same argument applies to every level with a warp in it, and 1-2, 3-2 and
   * 1-1 have since been given their own ordinary short pipes for the same
   * reason. The ratio is the point and it is now a gate — at most one warp in
   * three two-tile floor pipes, measured 4/13 = 30,8 %.
   *
   * **This level is also where the stink cloud and the note block are first
   * met**, since 9.8.2026, and neither is a new chunk here: `clouds` at chunk 9
   * and `note_pair` at chunk 19 were both already in this playlist, and 1-2
   * simply stopped coming first. Their columns are 146 and 309 — 163 apart,
   * which is eight screens, so the level introduces them one at a time by a
   * wide margin. The cloud arriving on the screen right after the beanstalk is
   * not a problem the one-screen rule sees, because the beanstalk is not new
   * here; it is the same vine the player climbed in 1-2.
   *
   * **JA 10.8.2026 ALKAEN MYÖS NÄRÄSTYSLIEKKI**, samalla tavalla: `heartburn_pair`
   * chunk 12:ssa oli tässä soittolistassa jo, ja 2-1 vain lakkasi tulemasta
   * ensin (perustelu on 2-1:n kommentissa — se kenttä esitteli neljä uutta
   * asiaa ja raja on kolme). Kenttä ei siis saanut riviäkään uutta sisältöä,
   * eikä sen vaikeuslukema liikkunut: 126.4 ennen ja jälkeen.
   *
   * Kolme ensiesittelyä on tämän kentän ja koko pelin maksimi, ja ne ovat
   * sarakkeissa 146, 194 ja 309 — lähimmät kaksi 48 saraketta erillään eli
   * kaksi ja puoli ruutua. Liekki on niistä keskimmäinen ja se seisoo tasaisella
   * maalla: `tools/curriculum.mjs` mittaa ensiesittelyn POHJAn, SEURAn ja
   * YKSINin, ja liekki läpäisee kaikki kolme.
   *
   * Kaksi liekkiä samassa palikassa (`heartburn_pair`, sarakkeet 194 ja 203) on
   * ensiesittelyksi kelvollinen eikä huolimattomuus, ja sen sanoo mittari eikä
   * maku: SEURA laskee toisen kappaleen samaa lajia yhdeksi oppitunniksi, koska
   * se on yksi asia opittavaksi eikä kaksi. Pari on tässä myös se mitä liekistä
   * on opittavaa — se on ajoitus eikä este — ja `Heartburn`in oma laskuri
   * käynnistyy satunnaisesta arvosta, joten kaksi liekkiä ei käy tahdissa: pelkkä
   * rytmin opettelu ei riitä, on katsottava kumpaa odottaa.
   */
  '2-2': {
    theme: 'desert', bg: 'dunes', music: 'level',
    chunks: [
      'start', 'plat_float', 'power', 'sun', 'spikes', 'pit_twin',
      'walkers', 'sky_run', 'beanstalk', 'clouds', 'pit_bridge', 'brick_wall',
      'heartburn_pair', 'pipe_short', 'warp_pipe', 'shell', 'pit_l', 'power_hi',
      'walkers', 'note_pair', 'steps_down', 'run_up', 'goal', 'goal_end',
    ],
    sky: [[128, 'mesa_sky']],
    cave: [[224, 'tomb_cave']],
  },
  /*
   * The desert world's night level: windy, and there is a moon to jump on.
   *
   * It is also the one level lit by a lamp. That is not a coin toss: it is
   * already night, so the darkness is the level agreeing with itself rather
   * than an effect laid over it; its theme asks for no other atmosphere, so
   * nothing is displaced; and it is off the direct route through world 2, so a
   * player who does not get on with it can go round. It stays out of world 1
   * on principle — the first world is where the game teaches, and a lesson in
   * the dark is not a lesson.
   *
   * The `heartburn` before the spike bridge is there for its *light*: a flame
   * is the brightest thing in the level and the only one that shows you ground
   * you are not standing on, so waiting one out buys you a look at what comes
   * next. It is the same species 2-2 already taught in daylight, and 2-2 comes
   * before this one on both routes — the flame is a tool here, never the first
   * lesson. (Se luki tässä pitkään muodossa "2-1 ja 2-2 opettivat sen", ja se
   * piti paikkansa 10.8.2026 asti: silloin liekki lähti 2-1:stä, koska se kenttä
   * esitteli neljä uutta asiaa ja raja on kolme. Väite ei silti heikentynyt,
   * koska se lepää järjestyksellä eikä lukumäärällä — ja 2-2 on yhä ennen tätä
   * kenttää molemmilla reiteillä.) Same sixteen columns and the same flat floor as the
   * `dune_night` it replaced, so the route through the level is unchanged.
   *
   * The crumbling boardwalk took the place of the `coins` chunk, and it is the
   * same coin row it always was — the reward has not moved, only the floor
   * under it is new, and there is still sand under that. It is here rather
   * than on the main line because this is the level where a mechanic has to
   * read by shape and motion instead of colour (brick and ground are almost
   * the same brown in the night palette), and because a floor that leaves is
   * exactly the kind of unkindness this world put off the direct route. What
   * it must not become is a reason to skip the level: the planks carry coins
   * and nothing else, the sand under them is the route, and the crumbling row
   * is four tiles above it.
   *
   * **It moved four chunks to the right on 9.8.2026, and that is the third of
   * the three crowded screens.** The boardwalk stood at column 116 and the moon
   * at column 104 — twelve columns apart, so the level's two new ideas were on
   * one screen and the player was asked to work out a floor that leaves and a
   * jumpable moon at the same time. Neither was in the other's way physically;
   * they were simply both new. `dune_crumble` and `corks` changed places, which
   * costs nothing (same chunks, same count, 124.2 either way) and puts the
   * planks at column 180, 76 columns clear of the moon, in the second half of
   * the level where they read as a variation instead of a second headline.
   *
   * The chunk it now follows is `pit_l` and that is fine rather than lucky: the
   * boardwalk's own floor rows are solid ground, so the planks are a bonus
   * overhead and never the route, and the four columns of ground between the
   * pit's far lip and the first pier are the same landing they always were.
   *
   * Chunk 1 is `pipe_short` in place of `flat` for the reason given in 2-1.
   */
  '2-N': {
    theme: 'night', bg: 'dunes', music: 'level', wind: true, spotlight: true,
    chunks: [
      'start', 'pipe_short', 'power', 'dune_night', 'walkers', 'pit_s',
      'moon_night', 'corks', 'shell', 'plat_steps', 'pit_l', 'dune_crumble',
      'heartburn', 'spike_bridge', 'flyer', 'pit_plat', 'shell', 'steps_up',
      'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * The switch sits at chunk 11, straight after the long lava stretch, and it
   * is the level's breather: the button is a reward for having crossed the
   * lava, and standing under a wall of coins is the opposite of standing over
   * a trench. It is `dune_switch` and not `switch_wall` because this level is
   * letterboxed and the original's slab hangs one row too high to be seen from
   * the floor — the reasoning is in chunks/desert.js.
   *
   * It was paid for by the `flat` chunk that used to be second in the list, so
   * the level is still 352 columns and its difficulty score did not move at
   * all. That is the right trade for a reward: a switch you can ignore should
   * not make the walk to the flag longer for the people who ignore it.
   *
   * JA TÄSSÄ HIEKKA TESTAA. `dune_sink_deep` at chunk 16 takes the place of the
   * second `walkers` patch and keeps both of its walkers, so the enemy count,
   * the length and the floor are all what they were and the only new thing in
   * the level is two tiles of sand.
   *
   * This level and not 2-2, 2-N or 2-M, and each of those is a decision:
   *
   *   - **2-3**, because a player arrives here already reading the floor. It is
   *     the lava level, so "the ground can kill" is a sentence this level has
   *     been saying for fourteen chunks — and quicksand is the second reading of
   *     it, which is the interesting one. Lava is instant and unrecoverable and
   *     the answer is never to touch it; sand gives you three seconds and the
   *     answer is to do something about it. Two hazards that look nothing alike
   *     and behave nothing alike, teaching opposite responses, in the level
   *     built to be read carefully. The pool sits after the last lava and
   *     before the final power block, so it is not a second lava trench in a
   *     row and it is not the last thing before the flag.
   *   - **not 2-2.** That level's one job is the hidden areas, and it is the
   *     only level in the world that hides anything. A new hazard in its route
   *     band would be a second thing to notice in the one place where noticing
   *     is the mechanic.
   *   - **not 2-N**, and the reason has since been repaired underneath this
   *     paragraph, which is worth recording rather than quietly rewriting.
   *     When the sand was placed, the night palette's brick and ground
   *     measured **0,4 % apart** — the weakest pair in the game and a known
   *     open problem — so 2-N was the one level where a tile that has to be
   *     recognised by *colour* must not make its debut. That fault was fixed
   *     the same evening (v26.08.09.40, brick lightened, ground untouched:
   *     **0,4 % → 17,8 %**), so the original objection no longer holds.
   *
   *     The placement stands anyway, on the argument that outlived it: 2-N
   *     already owns the mechanic that answers this one — the crumbling
   *     boardwalk announces itself by *moving* — and two hazards whose whole
   *     point is "the floor is not what it looks like" in one level is one
   *     lesson taught twice. If a later round wants sand in the night, the
   *     palette is no longer the thing standing in the way.
   *   - **not 2-M.** Its walk exists to hand out a power-up and give the arena a
   *     horizon, and the file says why: padding it makes losing the fight more
   *     expensive to retry. A hazard in the run-up to a fight you are meant to
   *     want to retry is the same mistake spelled differently.
   *   - **not 2-F.** A fortress has stone floors and no sand in it.
   *
   * Chunk 4 is `note_pair` where it was `walker`, and it is a swap in the
   * strictest sense: `note_pair` carries a walker of its own, so the level has
   * the same enemy in the same chunk and two bouncing blocks it did not have.
   * The reason is arithmetic rather than taste — 1-2 gave up its note blocks in
   * the same change, and one appearance in the whole game is too thin a life
   * for a mechanic. 2-2 stays the level that introduces it (it comes first on
   * both branches); this is the second place it turns up.
   */
  '2-3': {
    theme: 'desert', bg: 'peaks', music: 'level', letterbox: true,
    chunks: [
      'start', 'power', 'walkers', 'lava_gap', 'note_pair',
      'plat_steps', 'flyer', 'pipe_plant', 'lava_wide', 'lava_gap', 'dune_switch',
      'soup_stop', 'sky_run', 'cork_gap', 'heartburn', 'plat_float', 'dune_sink_deep', 'power',
      'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * 2-M — the papuparoonit, and the game's only paukkupapu.
   *
   * This is the reward at the end of the harder branch: 2-N is already off the
   * direct route through the desert, and 2-M hangs off 2-N, so nobody arrives
   * here who did not choose to twice. What they get for it is the breaking
   * power-up, which no block in the game can roll (see POWER_TYPES in
   * player.js). That is the whole shape of the owner's decision of 9.8.2026:
   * branches are unequal, the harder one gives something the easier one cannot.
   *
   * **Short on purpose — 160 columns against the world's usual 352.** It is a
   * fight and not a trek, and the walk in front of it exists to do exactly
   * three things: hand out the mandatory early power-up, let a player who
   * arrived at power 0 get back to a size where a hit is not the end, and give
   * the arena a horizon to appear over. Padding it out with more desert would
   * only make losing the fight more expensive to retry, and a fight you can
   * lose has to be a fight you want to try again.
   *
   * **How it can be lost, and how it is won.** Two barons on two plinths lob
   * beans across the bowl between them; the beans arc, bounce once and burst,
   * and there is nothing to do about one but not be there. A hit at power 0 is
   * a death and the level restarts — that is the retry. Winning is two stomps
   * each, at any size, and the second baron to fall drops the bean.
   *
   * **The vault is the lesson.** `baron_vault` comes straight after the arena:
   * a sealed shelf whose only door is a brick wall, off the route, full of
   * coins. It is the first thing the new power-up is pointed at, and it is
   * pointed at it while the player still has it.
   *
   * Not letterboxed, unlike 2-1 and 2-3. The bars are a crop rather than a
   * mask, and this is the one level in the world where things are thrown *over*
   * the player — a narrower window would hide the top of every arc.
   */
  '2-M': {
    theme: 'desert', bg: 'peaks', music: 'level',
    chunks: [
      'start', 'power', 'walkers', 'pit_s',
      'baron_arena', 'baron_vault', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * 2-4 SAVIKUOPPA — ensimmäinen kenttä sen jälkeen kun tiet yhtyvät.
   *
   * Maailma 2 kasvoi kahdeksaan kenttään 10.8.2026, ja molemmat uudet kentät
   * tulivat **risteyksen jälkeen**. Perustelu on kartalla (worlds.js) ja se on
   * mitattu eikä valittu; tässä on se puoli joka koskee kenttää itseään.
   *
   * **Tämä on ensimmäinen kenttä koko pelissä jonka kaksi eri pelaajaa pelaa
   * eri asiat mukanaan.** Hiekkatietä tullut on nähnyt yön ja murenevan
   * lankun; laavatietä tullut on nähnyt laavan, kytkimen ja voittanut
   * paukkupavun. Kentän on siis oltava kokonaan pelattavissa ilman pavusta,
   * ja silti sellainen että pavun kanssa siinä on jotain: `clay_vault` on
   * juuri se, ja se on kolikoita eikä reittiä.
   *
   * **Yksi idea: kuoppa johon kävellään.** Palikan oma kommentti
   * (chunks/desert.js, `clay_cut`) kertoo miksi lattian yläpinnan poistaminen
   * on eri asia kuin kuilu. Kentän kannalta olennaista on että se on ainoa
   * aavikkokenttä jossa maa nousee pelaajan molemmin puolin — ja siksi ainoa
   * joka **ei ole kinemascopessa**: 2-1 ja 2-3 ovat rajattuja koska niissä on
   * pelkkää etäisyyttä, ja tässä rajaus söisi juuri sen reunan jonka takia
   * kaivanto on kaivanto.
   *
   * Neljä kaivantoa, kolme eri muotoa, ja järjestys on opetusjärjestys:
   *
   *   32   `clay_cut`     leveä, kävelijä pohjalla ja korkki reunalla — tämä
   *                       kertoo mikä kaivanto on
   *   80   `clay_vault`   muurattu holvi maan tasossa, kansi kuljettava
   *   160  `clay_rim`     kapea, närästysliekki pohjalla: sama muoto, nyt se
   *                       kysyy takaisin
   *   192  `clay_boards`  laudoitettu: kansi on reitti ja palkinto on **alla**
   *   256  `clay_cut`     ja vielä kerran ilman mitään uutta, ennen loppunousua
   *
   * Holvi on aikaisin — sarakkeessa 80 — eikä lopussa, ja se on tarkoitus:
   * paukkupavun kanssa saapunut pelaaja ei ole vielä ehtinyt menettää sitä,
   * ja ilman papua saapunut näkee sen niin aikaisin että ehtii ihmetellä sitä
   * koko loppukentän. `clay_boards` on sen vastapari sarakkeessa 192: siellä
   * palkinto on alhaalla eikä muurin takana, eli sen saa kuka tahansa joka
   * huomaa lankkujen olevan lankkuja.
   */
  '2-4': {
    theme: 'desert', bg: 'dunes', music: 'level',
    chunks: [
      'start', 'power', 'clay_cut', 'walkers', 'pit_twin', 'clay_vault',
      'shell', 'spikes', 'flyer', 'pit_plat', 'clay_rim', 'plat_steps',
      'clay_boards', 'pit_l', 'heartburn_pair', 'note_pair', 'clay_cut', 'power',
      'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  /*
   * 2-5 PAAHDE — viimeinen kenttä ennen linnaketta, ja maailman toinen
   * hengähdys.
   *
   * **Se on mitattuna helpompi kuin 2-4, ja se on muoto eikä laiskuus.**
   * Kahdeksan kentän maailmassa on kaksi notkoa (`verify.mjs`), ja
   * haarautuvassa maailmassa ensimmäinen niistä on lyöty lukkoon ennen kuin
   * kukaan kirjoittaa riviäkään: haaran luku on sen helpomman reitin luku
   * (124,2), joka on pienempi kuin 2-2:n (126,4). Toinen notko ei siis voi
   * olla 2-4 — kaksi notkoa peräkkäin on kielletty — joten se on tämä kenttä.
   * Ja se on hyvä paikka: linnake on 160,7 eli koko maailman huippu, ja
   * muototesti jättää linnakkeen tarkoituksella pois juuri siksi, ettei
   * viimeisen numeroidun kentän tarvitse olla maailman vaikein. Sisäänhengitys
   * ennen ovea.
   *
   * **Yksi idea: kuumuus rytminä.** Kolme närästysliekkiä (`heat_row`,
   * sarakkeet 32 ja 224) eivät ole este vaan metronomi, ja koska jokaisella on
   * oma laskurinsa, kolmea ei ohiteta yhdellä opitulla tahdilla. Se on sama
   * taito jota linnakkeen pomo kysyy heti perään, ja tämä on ainoa kenttä
   * jossa se kysytään ilman että sen alla on kuilu.
   *
   * Toinen puoli on maasto, ja se nousee kolmessa muodossa: `heat_step` (80)
   * nostaa kaksi laattaa, `heat_ledge` (112) tuo saman hyllyn toisin päin ja
   * pudottaa liekin eteen, `heat_ramp` (176) menee kahdessa portaassa kolme
   * riviä ylös. Maailman 2 lattia on ollut yhtä tasoa kahdeksassa kentässä, ja
   * viimeinen yhteinen matka nousee linnaketta kohti — halvin tapa sanoa että
   * ollaan menossa jonnekin.
   *
   * Kinemascope on takaisin (2-1 ja 2-3 ovat rajattuja, 2-4 ei), ja se on
   * ehto eikä koriste: rajattu ikkuna näyttää rivit 6–13, joten mitattuna
   * **tämän kentän ylin rivi jolla on mitään on 8** ja 2-4:n on 4. Siksi
   * tässä ei ole `plat_steps`iä eikä `power_hi`ta — ne olisivat kehyksen
   * ulkopuolella, ja rajaus on **crop eikä maski**.
   */
  '2-5': {
    theme: 'desert', bg: 'peaks', music: 'level', letterbox: true,
    chunks: [
      'start', 'power', 'heat_row', 'walkers', 'pit_s', 'heat_step',
      'shell', 'heat_ledge', 'coins', 'pit_l', 'corks', 'heat_ramp',
      'flyer', 'spike_bridge', 'heat_row', 'power', 'pit_plat', 'walker',
      'run_up', 'goal', 'goal_end',
    ],
  },
  '2-F': {
    theme: 'fortress', bg: 'none', music: 'fortress', boss: true, bossVariant: 1,
    chunks: [
      'start', 'kiln_gate', 'kiln_hearth', 'kiln_bellows', 'kiln_flue', 'kiln_grate',
      'kiln_bellows', 'kiln_flue', 'kiln_gate', 'boss_arena_big',
    ],
  },
};
