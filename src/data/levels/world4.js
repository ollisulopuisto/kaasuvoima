/**
 * World 4 — the factory, which is indoors from the first tile to the last.
 * Every chunk in these playlists has a ceiling, so an open-air piece dropped in
 * here reads as a hole in the roof rather than as variety.
 *
 * That rule is also why the world's mechanics wear factory clothes instead of
 * being borrowed whole: `star_block`, `switch_wall` and `beanstalk` are all
 * written for open sky, and the factory versions of them live in
 * chunks/factory.js. One mechanic per level, and no level carries two:
 *
 *   4-1  the crumbling catwalk (already here) and the star
 *   4-2  the hidden bands: the cellar below and the loft on the roof
 *   4-3  the switch
 */

export const WORLD4_LEVELS = {
  /*
   * The star goes in the world's first level because it is the world's first
   * level: 4-1 is where the factory teaches what its enemies are, and half of
   * them — the heartburn jet, the cork guy — cannot be answered by stomping.
   * Meeting the one item that answers everything in the same level you meet
   * the problem is the pairing world 1 made with `star_block`, and it is worth
   * more here than saved for later.
   *
   * `fac_star` sits between the pit and the heartburn corridor, so what the
   * star is for is on screen while it is still running — and the crumbling
   * catwalk after it is deliberately out of reach of the timer, because
   * invincibility has never had anything to say about a floor that leaves.
   */
  '4-1': {
    theme: 'factory', bg: 'factory', music: 'factory',
    chunks: [
      'start', 'fac_floor', 'fort_power', 'fac_press', 'fac_vents', 'corks',
      'fac_belt', 'cork_gap', 'fac_shaft', 'fac_gap', 'fac_star', 'heartburn',
      'fac_crumble', 'fac_press', 'cloud_run', 'fac_vents', 'steps_up', 'run_up',
      'goal', 'goal_end',
    ],
  },
  /*
   * World 4's hidden level, and the only one in the world — a discovery stops
   * being a discovery if there is one in every corner.
   *
   * It is 4-2 rather than 4-1 or 4-3 on purpose. 4-2 is the world's measured
   * breather (the dip in the curve), and looking around is something a player
   * only does in a level that is not currently trying to kill them. Putting
   * the secret in the peak would mean hiding it where nobody has attention to
   * spare.
   *
   * Two ducts, the same chunk twice, 112 columns apart. The first goes down
   * into `fac_cellar` and the second up into `fac_loft`; pressing the other
   * direction on either does nothing at all, because the band it would arrive
   * in has no floor under it and `tryWarp` refuses. Neither is on the way to
   * the flag: the ground route through this level is exactly the route it was,
   * one chunk longer.
   */
  '4-2': {
    theme: 'factory', bg: 'factory', music: 'factory',
    chunks: [
      'start', 'fac_floor', 'fort_power', 'fac_belt', 'heartburn_pair', 'fac_shaft',
      'corks', 'fac_press', 'fac_duct', 'fac_gap', 'soup_stop', 'fac_vents',
      'fac_belt', 'clouds', 'fac_shaft', 'fac_duct', 'heartburn', 'steps_down',
      'run_up', 'goal', 'goal_end',
    ],
    sky: [[240, 'fac_loft']],
    cave: [[128, 'fac_cellar']],
  },
  /*
   * The switch is placed late, after the level's hardest crossing, for two
   * unrelated reasons that happen to agree. A reward is worth most where the
   * player has already paid for it — and everything before column 256 stays
   * byte for byte what it was, so `playable.mjs`'s known 4-3 failure (a gap at
   * column 235 that the bot cannot cross because it will not use floating
   * platforms) still reports from the same column it always did. Measured:
   * before and after, "kuilu sarakkeessa 235".
   */
  '4-3': {
    theme: 'factory', bg: 'factory', music: 'factory',
    chunks: [
      'start', 'spike_walk', 'fort_power', 'fac_vents', 'fac_belt', 'fac_shaft',
      'heartburn_pair', 'cloud_run', 'fac_gap', 'fac_press', 'corks', 'fac_belt',
      'heartburn', 'fac_shaft', 'cloud_run', 'fac_vents', 'fac_switch', 'cork_gap',
      'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  '4-F': {
    theme: 'factory', bg: 'factory', music: 'fortress', boss: true, bossVariant: 3,
    chunks: [
      'start', 'fac_floor', 'fort_power', 'fac_vents', 'fac_gap', 'fac_shaft',
      'fac_belt', 'fac_vents', 'boss_arena_big',
    ],
  },
};
