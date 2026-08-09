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
   */
  '2-1': {
    theme: 'desert', bg: 'dunes', music: 'level', letterbox: true,
    chunks: [
      'start', 'flat', 'power', 'walkers', 'sun', 'corks',
      'pipe_plant', 'pit_s', 'heartburn', 'coins', 'shell', 'plat_steps',
      'pit_l', 'flyer', 'bricks', 'ledge', 'pit_plat', 'star_block',
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
   * next. It is the same chunk 2-1 and 2-2 already taught in daylight, and both
   * of them come before this one on the map — the flame is a tool here, never
   * the first lesson. Same sixteen columns and the same flat floor as the
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
   */
  '2-N': {
    theme: 'night', bg: 'dunes', music: 'level', wind: true, spotlight: true,
    chunks: [
      'start', 'flat', 'power', 'dune_night', 'walkers', 'pit_s',
      'moon_night', 'dune_crumble', 'shell', 'plat_steps', 'pit_l', 'corks',
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
   */
  '2-3': {
    theme: 'desert', bg: 'peaks', music: 'level', letterbox: true,
    chunks: [
      'start', 'power', 'walkers', 'lava_gap', 'walker',
      'plat_steps', 'flyer', 'pipe_plant', 'lava_wide', 'lava_gap', 'dune_switch',
      'soup_stop', 'sky_run', 'cork_gap', 'heartburn', 'plat_float', 'walkers', 'power',
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
  '2-F': {
    theme: 'fortress', bg: 'none', music: 'fortress', boss: true, bossVariant: 1,
    chunks: [
      'start', 'fort_hall', 'fort_power', 'fort_spikes', 'fort_gap', 'fort_blocks',
      'fort_pillars', 'fort_spikes', 'fort_gap', 'fort_pillars', 'boss_arena',
    ],
  },
};
