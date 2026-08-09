/**
 * World 8's chunks — the last keep, and the one world that is made of a room.
 *
 * ## Why this file exists at all, when `fortress.js` already does
 *
 * `chunks/fortress.js` is the corridor every world ends in: a hall, a gap, some
 * pillars, and it is deliberately the same five pieces in a different order
 * seven times over. That is right for a room you visit for ninety seconds at
 * the end of a world. It is not enough to *be* a world, and reshuffling those
 * five pieces into six levels is precisely the thing world 8 must not be —
 * "world 7 with a different palette" spelled in stone instead of cloud.
 *
 * So this file is the fortress's own vocabulary rather than a second copy of
 * the shared one, and the levels use both: `fort_*` is the castle a player
 * already knows, `keep_*` is what the castle turns out to have been hiding.
 *
 * ## Three rules, and every one of them is measured in `verify.mjs`
 *
 * Luulaakso justifies itself in one sentence (*bone stands*) and kaasukehä in
 * its opposite (*nothing stands*). This world has no new theme to argue about —
 * the theme list closed with world 7 — so its rules are about **construction**,
 * which is the only place a world with a borrowed palette can be different.
 *
 *   1. **There is no outside.** Every column of every level in this world has
 *      stone over it, from the first tile to the last. That is why `keep_start`
 *      exists: the shared `start` has two empty rows at the top, so every
 *      fortress in the game has in fact opened on sixteen columns of sky. In a
 *      one-room level nobody notices; in a world that claims to be indoors it
 *      is a hole through the claim.
 *
 *   2. **Brick never touches stone.** The fortress palette's brick and ground
 *      measure **7,9 %** apart — the second worst pair in the game after the
 *      night palette's 0,4 % — and ROADMAP wrote that down as the debt world 8
 *      would have to pay. A new palette is not available and would not be right
 *      anyway: `THEMES.fortress` is what the last level of seven worlds already
 *      looks like, so repainting it repaints finished levels. The answer is
 *      therefore structural. Two nearly identical colours that are never
 *      adjacent never have to be told apart: in this world the brick floats and
 *      the stone does not, and that difference is read from position instead of
 *      hue. It costs something real, which is what makes it a rule — a brick
 *      stack rising out of the floor (`brick_wall`) is a forbidden shape here.
 *
 *   3. **Every gap has nine columns of run-up.** Luulaakso measured the reason
 *      and wrote it in a comment: a standing jump carries **0 px** sideways, so
 *      a landing is only as good as the run-up it leaves. A world whose every
 *      level is a corridor and whose every hole is lava is exactly where that
 *      stops being advice: the shared `fort_gap` brings only four columns of
 *      floor with it, so two of them in a row is a jump nobody can take. Nine
 *      is `keep_hole`'s own profile — the same profile kaasukehä cut its holes
 *      to — and in this world it is the composition rule for all six playlists.
 *
 * ## What is deliberately NOT here
 *
 * **Quicksand.** It would have been easy and it would have been wrong:
 * `levels/world2.js` already ruled on it in one line — *a fortress has stone
 * floors and no sand in it* — and a rule that is abandoned the moment it is
 * inconvenient was never a rule. The tile stays in the desert.
 *
 * **A new boss.** The finale's fights are the game's own six, one per level,
 * and that is the argument (see `levels/world8.js`): the last castle has
 * nothing new to send, it sends everything it has already sent.
 *
 * **A second arena.** `boss_arena` and `boss_arena_big` live in `fortress.js`
 * because they are shared, and six more copies of them in the keep's palette
 * would say nothing that the corridors leading to them do not already say.
 */

import { ck, G } from './common.js';

export const KEEP_CHUNKS = {
  /**
   * Sisäänkäynti, ja rule 1 in a single chunk.
   *
   * Tile for tile this is `common.js`'s `start` with a ceiling on it, and that
   * is the whole difference: the player spawns under stone. The shared chunk
   * cannot simply be given one, because every non-fortress level in the game
   * opens with it and the sky is the point there.
   */
  keep_start: ck(16, {
    0: G,
    1: G,
    12: '  1',
    13: G,
    14: G,
  }),

  /**
   * Portti: nostoristikko joka on jäänyt auki.
   *
   * The first sentence of the world, and it is about the ceiling rather than
   * the floor. Everything in `bone.js` grows out of the ground and everything
   * in `cloud.js` floats free of it; here the vertical interest **hangs**, from
   * a rail bolted to the roof, and a player who walks under it has been told
   * where the weight in this world is without a word.
   *
   * It is `X` and not `B` for both of rule 2's reasons at once. A portcullis
   * that a running body could shoulder through is not a portcullis — and a
   * brick here would be brick against stone at the one moment the world is
   * asking to be read, which is the pair the palette cannot separate.
   *
   * The teeth stop at row 5. The tallest jump in the game rises 100 px, which
   * from the floor puts a head at about row 4, so the gate is something you can
   * be hit by rather than scenery hung out of reach — and the walker at the far
   * end is there so the first thing under it is somebody else's problem.
   */
  keep_gate: ck(16, {
    0: G,
    1: G,
    2: '  XXXXXXXXXXXX',
    3: '  X  X  X  X',
    4: '  X  X  X  X',
    5: '  X  X  X  X',
    9: '      o o',
    12: '            g',
    13: G,
    14: G,
  }),

  /**
   * Reikä kivessä: viisi ruutua ja kolikkokaari sen yli.
   *
   * **Nine columns of run-up, five of hole, two of landing** — inherited from
   * `cloud_hole` rather than rediscovered, and the nine is rule 3's number.
   * Everything in this world is cut to this profile so that two holes can stand
   * near each other in a playlist and the second one still gets its approach.
   *
   * A hole and not lava, in a castle where every other gap is a lava trench,
   * and that is the point of it: `fort_gap` puts a lid on the pit and the lid
   * is what you read. This is the floor simply not being there any more, which
   * is what a building does when it is old rather than when it is defended.
   *
   * Nothing at all on the run-up side. World 6 measured three separate falls
   * into a hole whose lip had a headstone two tiles before it — a body two
   * tiles up reads as a wall, the jump starts early, lands on the obstacle and
   * goes in from a standstill, where the jump carries 0 px sideways. The coin
   * arc is the only marking, and it starts over the lip rather than before it.
   */
  keep_hole: ck(16, {
    0: G,
    1: G,
    9: '         o o o',
    12: '  g',
    13: '#########     ##',
    14: '#########     ##',
  }),

  /**
   * Sama reikä, ja siinä asuu joku.
   *
   * Column for column `keep_hole`, and keeping it identical is the entire idea —
   * the same decision `pit_croak` made against `pit_s`. The player crossed that
   * exact hole two chunks ago, so the only new thing to read is the thing in
   * it. A different width would have asked them to re-read the terrain at the
   * same moment, and somebody who dies could not say which of the two questions
   * killed them.
   *
   * **No coins over it**, and that is `pit_croak`'s rule rather than a
   * decoration removed: a coin arc is how this game draws a jump, and drawing
   * one here would be pointing the player into the one column of air that is
   * sometimes occupied. The marker sits on the first floor row in the middle of
   * the gap, because that row's top edge is the rim the creature measures its
   * rest height, its hitbox and its warning from.
   *
   * The kurnuttaja (v26.08.09.37) is in this world at all because the finale's
   * job is to ask the game's own questions again rather than to invent one
   * more, and because a pit leaper indoors is the version of it the desert
   * could not build: there is a ceiling over this hole, so the answer that
   * works everywhere else — jump early and high — has less room in it.
   */
  keep_croak: ck(16, {
    0: G,
    1: G,
    13: '#########  U  ##',
    14: '#########     ##',
  }),

  /**
   * Hampaat: kaksi piikkipetiä kolmen ruudun levyisinä ja kuori niiden välissä.
   *
   * Two beds of three and not one of six, which is luulaakson measurement and
   * not a new one: the bot reads a spike bed as one obstacle and holds a jump
   * proportional to its width, so a wide bed is a long hop taken from whatever
   * run-up happens to be left. Two short ones ask the same skill twice, which
   * is the kind of difficulty a player can learn between the first attempt and
   * the second.
   *
   * The shell walks the two tiles between them. That is the whole design of
   * this chunk: the spikes decide where you may land and the shell decides
   * when, and neither of them is dangerous on its own.
   */
  keep_teeth: ck(16, {
    0: G,
    1: G,
    9: '   o o o',
    12: '   ^^^  k  ^^^',
    13: G,
    14: G,
  }),

  /**
   * Vahtihuone: kolme asukasta ja ei yhtään reikää.
   *
   * This world's `bone_dance`, and it is here for the same reason luulaakso
   * needed one. Almost everything else in the keep kills outright — lava,
   * holes, the thing living in one — and a world built only out of those is a
   * world where every mistake is the same mistake. People are the cheap kind of
   * difficulty: a walker costs a power level, and a power level is a resource
   * the player can spend and get back.
   *
   * That is also what makes 8-2 possible. A breather in this world cannot be
   * emptier, because an empty corridor in a boss rush is dead air; it has to be
   * *survivable* instead, which means taking the gaps out and leaving the
   * inhabitants in. This chunk is the room that costs nothing but attention,
   * and it is the only piece of the world with no lethal tile in it at all.
   *
   * The flyer is at row 7, where a jump is already committed, and the two
   * walkers are on the floor either side of the coins — so the choice is which
   * of the two to land next to, which is the same question `cloud_flock` asks
   * and the cheapest question this game knows how to ask.
   */
  keep_watch: ck(16, {
    0: G,
    1: G,
    7: '        f',
    9: '   o o o',
    12: '   g         g',
    13: G,
    14: G,
  }),

  /**
   * Ahjo: laavakouru ja närästyssuihku kummallakin huulella.
   *
   * Five tiles of lava against a measured budget of six, and a jet on each lip.
   * The jet is the cheapest honest difficulty this game has — it is bolted to
   * one column and fires on a fixed period, so it is a metronome and timing a
   * metronome is a skill that rewards patience rather than reflexes — and here
   * it is doing something it has never done: standing where the run-up is.
   *
   * That is a deliberate exception to this world's own rule about the run-up
   * side, and it is allowed for the reason `cloud_hole_deck` was allowed. The
   * rule forbids **terrain** before a lip, because terrain makes the jump start
   * early and land on the obstacle. A jet is not terrain: it does not stop a
   * body, it does not change where the jump begins, and it can be waited out
   * from a standstill. What it costs is the one resource this world otherwise
   * hands out free — the moment you choose to leave.
   *
   * The near jet sits at column 1 and the far one at column 12, i.e. neither of
   * them is inside the four columns of floor the take-off actually uses.
   */
  keep_forge: ck(16, {
    0: G,
    1: G,
    9: '      o o o',
    12: ' H          H',
    13: '#####     ######',
    14: '#####WWWWW######',
  }),

  /**
   * Porras: neljä askelmaa ylös ja lohkorivi niiden päällä.
   *
   * The one place in the world where the floor rises, and it rises to the only
   * height the ceiling leaves room for. Three clear rows over anything walkable
   * is the tallest power level's headroom (`HEAD` in rules.js), and the roof is
   * rows 0 and 1, so a step whose top is row 9 is the highest step this world
   * can hold — one tile taller and the largest size could not stand on it.
   * That is not a limitation being worked around, it is the sentence the world
   * is built to say: **the way up runs out.**
   *
   * The block row sits four rows over the top step, the same bump row as
   * everywhere else in the game measured from the surface you are standing on,
   * and DESIGN.md §5 is why there is one at all: a climb that leads to nothing
   * teaches the player to stop climbing, and one empty climb loses every later
   * one.
   *
   * Every rise is one tile, so the stair is walkable rather than jumpable, and
   * the drop at the far end is the level handing the run-up back.
   */
  keep_stair: ck(16, {
    0: G,
    1: G,
    5: '        B?B',
    9: '          XX',
    10: '        XXXX',
    11: '      XXXXXX',
    12: '    XXXXXXXX',
    13: G,
    14: G,
  }),

  /**
   * Holvi: kaksi kerrosta tiiltä ilmassa, eikä kumpikaan koske kiveen.
   *
   * This is rule 2 written as a place rather than as a prohibition. The world's
   * bricks are here, there are eight of them, and every one is floating: the
   * lower row is the ordinary bump row four tiles over the floor, the upper one
   * is four over *that*, reachable by standing on what you have just bumped.
   *
   * Two tiers rather than one wide row because the rule has to buy something
   * and not only forbid something. A brick wall grown out of the floor is the
   * shape this world cannot have; a brick ceiling you climb into is the shape
   * it gets instead, and it happens to be the better use of a room with a roof.
   */
  keep_vault: ck(16, {
    0: G,
    1: G,
    5: '     B?B',
    9: '   BB?BB',
    12: '            k',
    13: G,
    14: G,
  }),
};
