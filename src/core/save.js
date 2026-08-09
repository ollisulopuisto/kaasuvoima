const KEY = 'sfb3.save.v2';

export const DEFAULT_SAVE = () => ({
  lives: 4,
  coins: 0,
  score: 0,
  power: { type: null, level: 0 },
  reserve: null,
  world: 0,
  node: null,
  cleared: {},      // nodeId -> true
  worldsOpen: 1,    // how many worlds are reachable
  usedSaveState: false,   // set once a run has been rewound from a save state
  continues: 0,           // continues this run has used; the board shows the count
  /*
   * levelId -> the keys of the secrets found in it (see core/secrets.js).
   *
   * Added WITHOUT raising the key from v2, and that is the argument: an old
   * save simply has no `secrets`, the spread below hands it `{}`, and `{}` is
   * not a guess — it is the truth, because nothing was ever recorded for that
   * player. No existing field changes meaning and nothing is re-read as
   * something else, which is the case DESIGN.md §6 is about. Bumping the
   * version would delete somebody's lives, score and world progress in order to
   * add a counter that starts at zero anyway. `continues` went in the same way.
   */
  secrets: {},
});

export const Save = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULT_SAVE();
      return { ...DEFAULT_SAVE(), ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SAVE();
    }
  },

  write(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        lives: state.lives,
        coins: state.coins,
        score: state.score,
        power: state.power,
        reserve: state.reserve,
        world: state.world,
        node: state.node,
        cleared: state.cleared,
        worldsOpen: state.worldsOpen,
        usedSaveState: !!state.usedSaveState,
        continues: state.continues || 0,
        secrets: state.secrets || {},
      }));
    } catch {
      /* private mode / storage full — the game just won't persist */
    }
  },

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },

  exists() {
    try {
      return !!localStorage.getItem(KEY);
    } catch {
      return false;
    }
  },
};
