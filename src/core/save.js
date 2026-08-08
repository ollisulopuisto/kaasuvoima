const KEY = 'sfb3.save.v1';

export const DEFAULT_SAVE = () => ({
  lives: 4,
  coins: 0,
  score: 0,
  power: 'small',
  reserve: null,
  world: 0,
  node: null,
  cleared: {},      // nodeId -> true
  worldsOpen: 1,    // how many worlds are reachable
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
