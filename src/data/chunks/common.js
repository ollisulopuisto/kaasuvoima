/**
 * The chunk vocabulary every world is built from, and the helpers that make a
 * chunk. It lives apart from the themed files because these pieces belong to no
 * world in particular: `flat`, a pit and a staircase turn up in the grass and in
 * the factory alike, and copying them per theme would mean five places to fix
 * when the floor changes.
 *
 * The helpers are here rather than in a file of their own so a themed chunk file
 * has exactly one import.
 */

export const CHUNK_ROWS = 15;

export const G = '################';
export const G8 = '########';

/**
 * Threads a beanstalk down a column of a chunk spec, `top`..`bottom` inclusive.
 * Merged rather than written, so the vine can pass through rows that already
 * have something in them — and twenty near-identical `'      v'` lines are not
 * a level map, they are a copy-paste.
 */
export function withVine(spec, col, top, bottom) {
  for (let y = top; y <= bottom; y++) {
    const row = (spec[y] || '').padEnd(col + 1, ' ');
    spec[y] = row.slice(0, col) + 'v' + row.slice(col + 1);
  }
  return spec;
}

export function ck(w, spec) {
  const rows = [];
  for (let y = 0; y < CHUNK_ROWS; y++) {
    const raw = spec[y] || '';
    if (raw.length > w) {
      throw new Error(`chunk row ${y} is ${raw.length} wide, expected max ${w}: "${raw}"`);
    }
    rows.push(raw.padEnd(w, ' '));
  }
  return { w, rows };
}

export const COMMON_CHUNKS = {
  /* ------------------------------ openings ----------------------------- */
  start: ck(16, {
    12: '  1',
    13: G,
    14: G,
  }),
  start_high: ck(16, {
    8: '   o',
    9: '  1',
    10: '  ---',
    13: G,
    14: G,
  }),

  /* ------------------------------- ground ------------------------------ */
  flat: ck(16, { 13: G, 14: G }),
  flat8: ck(8, { 13: G8, 14: G8 }),
  walker: ck(16, { 12: '        g', 13: G, 14: G }),
  walkers: ck(16, { 12: '   g        g', 13: G, 14: G }),
  shell: ck(16, { 12: '      k', 13: G, 14: G }),
  flyer: ck(16, { 8: '       f', 13: G, 14: G }),

  /* ------------------------------- blocks ------------------------------ */
  coins: ck(16, { 9: '   o o o o', 13: G, 14: G }),
  qrow: ck(16, { 9: '    ?B?B?', 13: G, 14: G }),
  power: ck(16, { 9: '      !', 13: G, 14: G }),
  // Same block, but for the chunks that have a ceiling.
  fort_power: ck(16, { 0: G, 1: G, 9: '      !', 13: G, 14: G }),
  power_hi: ck(16, { 5: '      !', 9: '   BB?BB', 13: G, 14: G }),
  bricks: ck(16, { 9: '  BBBB?BBBB', 13: G, 14: G }),
  // Four tiles tall: clearable with a running jump, awkward from a standstill.
  brick_wall: ck(16, {
    5: '      B?B',
    9: '      BBB',
    10: '      BBB',
    11: '      BBB',
    12: '      BBB   g',
    13: G,
    14: G,
  }),
  note_pair: ck(16, { 9: '     NN', 12: '            g', 13: G, 14: G }),
  coin_stack: ck(16, {
    6: '     oo',
    7: '     oo',
    8: '     oo',
    9: '  ?  oo  ?',
    13: G,
    14: G,
  }),

  /* -------------------------------- pits ------------------------------- */
  pit_s: ck(16, { 13: '#####      #####', 14: '#####      #####' }),
  // Eight tiles wide — too far in one hop, so there is a stepping stone.
  pit_l: ck(16, {
    9: '       ooo',
    10: '       ---',
    13: '####        ####',
    14: '####        ####',
  }),
  pit_plat: ck(16, {
    9: '     o o o',
    10: '    -----',
    13: '###          ###',
    14: '###          ###',
  }),
  pit_bridge: ck(16, {
    11: '   ---------',
    12: '        k',
    13: '##          ####',
    14: '##          ####',
  }),
  /**
   * Two gaps and two tiles of ground between them. Each jump on its own is
   * shorter than the one in `pit_s`; what is hard is that the first one has to
   * *stop*, because the landing is two tiles wide and the next gap starts
   * immediately after it.
   *
   * This is deliberately not one wide gap. The measured budget says eight tiles
   * fit, but `tools/playable.mjs` — which is the design promise made
   * executable — does not clear seven at power level 0, and a level the
   * smallest size cannot pass is broken rather than hard. Difficulty here has
   * to come from asking for two accurate jumps, not one enormous one.
   */
  pit_twin: ck(16, {
    9: '  o o     o o',
    13: '##     ##     #',
    14: '##     ##     #',
  }),
  /**
   * KUILU JOSSA ASUU JOKU.
   *
   * Tile for tile this is `pit_s` — five floor columns, six of nothing, five
   * more — and keeping it identical is the whole idea. The player has been
   * crossing that exact hole since 1-1, so the only thing they have to read
   * anew is the thing living in it. A different width would have asked them to
   * re-read the terrain at the same moment, and somebody who dies could not
   * tell which of the two questions killed them.
   *
   * It also keeps `tools/difficulty.mjs` honest, which is not a side benefit
   * but the reason this width survived a rewrite. A narrower hole was tried
   * (five tiles, on a "one question at a time" argument) and the meter then read
   * 2-1 as **easier with a monster in it than without** — 115.7 down to 111.0,
   * because a tile off the gap is worth more to the score than the enemy is.
   * A hazard that measures as a discount is exactly the failure the spiky walker
   * shipped with. At six the difference is the creature and nothing else:
   * 115.7 -> 119.7.
   *
   * The one thing the six-tile version cost was real and is worth recording: it
   * would not clear at power level 0 where it was first put in 3-3, because the
   * approach there was a four-tile brick wall you come off with the run spent.
   * `tools/playable.mjs` found it, and the fix was the level's chunk order
   * rather than this chunk — see levels/world3.js.
   *
   * The marker sits on the first floor row (13) near the middle of the gap,
   * because that row's top edge is the rim — the line the creature measures its
   * rest height, its hitbox and its bubbles from. The cell itself is empty
   * ground, so `rules.js` still reads a plain six-tile gap, which is what it is.
   *
   * No coins over it. A coin arc is this game's way of drawing a jump, and
   * drawing the arc here would be pointing the player *into* the one column of
   * air that is sometimes occupied.
   */
  /*
   * MERKKI ON KUILUN LÄHIREUNALLA EIKÄ SEN KESKELLÄ, JA SE ON MITTAUS.
   *
   * Merkki oli sarakkeessa 7, kuilun keskellä. Voimatason 0 jarrutusmatka on
   * **56 px eli 4 laattaa**, joten jarrutusikkuna on `[merkki−4, merkki−1]` —
   * ja keskeltä laskettuna sen **kaksi viimeistä saraketta olivat jo ilman
   * päällä**. Pelaaja joka reagoi oikein ei silti ehtinyt pysähtyä: 2/4
   * ikkunan sarakkeesta oli maata. Lähireunalla mitattuna 4/4.
   *
   * Kuilu on yhä kuusi laattaa leveä eikä yhtään saraketta liikkunut, joten
   * `pit_s`:n kanssa mitattu vaikeusvastaavuus säilyy ja olento on yhä
   * lattiattomassa sarakkeessa — eli `hazard`-lippu on yhä rehellinen.
   *
   * Se on myös parempaa peliä. Loikka on pystysuora, joten vaara on tasan yksi
   * sarake; lähireunalla se sarake osuu **ponnistukseen**, jota pelaaja yhä
   * ohjaa, eikä lakipisteeseen, jota kukaan ei ohjaa.
   */
  pit_croak: ck(16, {
    13: '#####U     #####',
    14: '#####      #####',
  }),

  /* ------------------------------- stairs ------------------------------ */
  steps_up: ck(16, {
    9: '            XX',
    10: '          XXXX',
    11: '        XXXXXX',
    12: '      XXXXXXXX',
    13: G,
    14: G,
  }),
  // Three tiles at the tall end, so it can be climbed from the left too.
  steps_down: ck(16, {
    10: 'XX',
    11: 'XXXX',
    12: 'XXXXXX',
    13: G,
    14: G,
  }),
  ledge: ck(16, {
    10: '    XXXXXXXX',
    11: '    XXXXXXXX',
    12: '    XXXXXXXX g',
    13: G,
    14: G,
  }),

  /* -------------------------------- pipes ------------------------------ */
  /**
   * The two-tile pipe, and the reason it carries coins.
   *
   * A warp pipe is drawn as this pipe with a slow shine in its throat, so this
   * is the tile a player compares against when they wonder whether a pipe goes
   * anywhere. That comparison is the whole discoverability problem: the hint
   * that gets somebody to stand on a warp pipe and press down has to be a hint
   * about *pipes*, or it is a sign about one pipe. So `warp_pipe` carries this
   * exact coin row — same three coins, same three columns — and the coins say
   * "a pipe", never "this pipe".
   *
   * Which makes the coins here the load-bearing half, not the decoration: 1-1
   * is where the habit is taught, and 1-1 hides nothing at all, so the first
   * pipe a player is paid for standing on is one that leads nowhere. `verify.mjs`
   * asserts the two chunks' coin rows are identical, because the way this
   * breaks is somebody hinting the secret one and forgetting its twin.
   *
   * **And how OFTEN this chunk appears is part of the same promise.** Identical
   * coins on identical pipes prove nothing if nearly every such pipe turns out
   * to be a warp — which is where the game was: six two-tile floor pipes, four
   * of them warps, so "press down on a coined short pipe" was right two times
   * in three. This chunk is the answer to that and there is no such thing as
   * too many of it, so `verify.mjs` caps the warps at one pipe in three rather
   * than capping these. Nine of the thirteen in the game are this chunk.
   *
   * The row is the ordinary bump row, offset left rather than centred: the run
   * approaches from the way you are walking and its last coin sits over the
   * pipe's own left column, so the jump that takes it lands you on the lid.
   * Centred coins either side of a thing is the oldest map marking there is.
   */
  pipe_short: ck(16, {
    9: '  o o o',
    11: '     []',
    12: '     {}',
    13: G,
    14: G,
  }),
  pipe_tall: ck(16, {
    9: '      []',
    10: '      {}',
    11: '      {}',
    12: '      {}',
    13: G,
    14: G,
  }),
  pipe_plant: ck(16, {
    8: '     p',
    9: '     []',
    10: '     {}',
    11: '     {}',
    12: '     {}',
    13: G,
    14: G,
  }),
  pipe_pair: ck(16, {
    10: ' []       []',
    11: ' {}       {}',
    12: ' {}       {} ',
    13: G,
    14: G,
  }),

  /* ----------------------------- platforms ----------------------------- */
  plat_hi: ck(16, {
    5: '     o o',
    6: '    ------',
    7: '     o o',
    13: G,
    14: G,
  }),
  plat_steps: ck(16, {
    4: '         oo',
    5: '        ----',
    7: '   oo',
    8: '  ----',
    10: '       ooo',
    11: '       ---',
    13: G,
    14: G,
  }),
  plat_float: ck(16, {
    6: '    ooo',
    7: '   -----',
    8: '    ooo',
    12: '            g',
    13: G,
    14: G,
  }),
  sky_run: ck(16, {
    4: '  --------',
    5: '   o o o',
    8: '            o',
    9: '           ---',
    13: '######      ####',
    14: '######      ####',
  }),

  /* ------------------------------- hazards ----------------------------- */
  spikes: ck(16, { 12: '     ^^^^', 13: G, 14: G }),
  /**
   * A spike bed too long to hop, and a bridge over it. The bridge is the route
   * and the spikes are what a badly judged landing costs — the ground under
   * them is still ground, so the level does not become a pit, it becomes a
   * question about height.
   */
  spike_bridge: ck(16, {
    8: '      ooo',
    9: '   ---------',
    12: '     ^^^^',
    13: G,
    14: G,
  }),
  lava_gap: ck(16, {
    10: '   ------',
    13: '####WWWWWW######',
    14: '####WWWWWW######',
  }),
  lava_wide: ck(16, {
    9: '   ----',
    10: '        ----',
    13: '##WWWWWWWWWWWW##',
    14: '##WWWWWWWWWWWW##',
  }),

  /* -------------------------------- goal ------------------------------- */
  /**
   * KAASUSUIHKU LATTIASSA — ponnahduslauta, ja ainoa laatta pelissä joka lukee
   * vauhtimittaria.
   *
   * Ruutu on rakennettu niin että **mittari näkyy palkintona eikä ohjeena**.
   * Laudan päältä nousee tyhjällä mittarilla 102 px ja täydellä 205 px
   * (`SPRING_LOW`/`SPRING_HIGH`, `scenes/level.js`), eli kuudesta ruudusta
   * kolmeentoista. Lauta on rivillä 12, ja palkinto — kolikot laudan yllä
   * rivillä 3 — on kolmentoista ruudun päässä: sinne yltää vain se joka tulee
   * täydellä vauhdilla.
   *
   * Puolikas mittari ei siis jää ilman mitään, se jää **lähelle**, ja se on
   * koko opetus. Lauta rivillä 4 on se paikka johon vajaakin nousu laskeutuu,
   * joten yritys näkyy matkana eikä epäonnistumisena.
   *
   * Vauhdinottoa on seitsemän saraketta ennen lautaa ja palikka liitetään
   * toisten perään, joten mittari ehtii täyttyä vain jos edellinen ruutu on
   * ollut juostava. Se on tarkoitus: tämä laatta myy sitä työtä.
   *
   * Yhteisessä sanastossa eikä yhden maailman omassa, koska laatta ei ole
   * minkään maailman aihetta: se on mekaniikka, ja mekaniikka piirtyy sen
   * teeman väreillä johon se pannaan. Ainoa rajoitus on avoin taivas —
   * kolmentoista ruudun nousu ei mahdu katolliseen huoneeseen, joten tehdas ja
   * linnake eivät ole tämän palikan paikkoja.
   */
  spring_jet: ck(16, {
    3: '      ooo',
    4: '     -----',
    /* Lauta on **lattiarivissä** eikä sen päällä, ja se on ehto eikä
     * asettelua: laatta on kiinteä, joten lattian päälle pantuna se olisi
     * yhden ruudun seinä jota vasten juostaan — ei ritilä jonka yli
     * juostaan. Mitattu: ensimmäinen versio nosti 0 px, koska kukaan ei
     * koskaan seissyt sen päällä. */
    13: '#######J########',
    14: G,
  }),

  run_up: ck(16, { 9: '     o o o', 13: G, 14: G }),
  goal: ck(16, {
    12: '      F',
    13: G,
    14: G,
  }),
  goal_end: ck(16, { 13: G, 14: G }),
};
