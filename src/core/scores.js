/**
 * The high score table. Stored in localStorage, so it belongs to whoever's
 * browser it is — good enough for a sofa full of kids taking turns.
 *
 * An entry carries an `assisted` flag, set when the run used a save state.
 * That is not cheating exactly, but a rewound run and a clean one do not
 * belong in the same column without a mark, so those show a star.
 *
 * `continues` is the third time this project has answered the same question the
 * same way. A rewound run gets a star; a warped run is kept off the board
 * altogether (main.js); a continued run carries its count. Continues stay
 * unlimited and keep their score on purpose — locking a child out of their own
 * game, or wiping a hundred thousand points over one bad jump, punishes harder
 * than losing a world does. A run with no continues and a run with six are
 * different achievements, and saying which is the board's job. The game does
 * not punish; the board is honest.
 */

const KEY = 'sfb3.scores.v1';

/**
 * Stamped onto every entry. Scores are NOT reset when this changes: wiping the
 * board every time the game is tuned would punish players for our edits, and
 * the kids would lose their names for no reason they can see. Showing which
 * build a score was set on is honest without being destructive — an old score
 * from before a physics change is comparable-ish, and now you can tell.
 */
export const GAME_VERSION = '26.08.09';
export const MAX_ENTRIES = 10;
export const NAME_LENGTH = 6;

export function loadScores() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((e) => e && typeof e.score === 'number')
      .map((e) => ({
        name: String(e.name || '').slice(0, NAME_LENGTH) || '???',
        score: Math.max(0, Math.floor(e.score)),
        world: Number(e.world) || 1,
        // The level id the run reached, e.g. "2-3". Older rows have none.
        level: typeof e.level === 'string' ? e.level.slice(0, 4) : '',
        assisted: !!e.assisted,
        // Rows saved before continues were counted have none, and zero is the
        // honest thing to say about a run from a build that never asked.
        continues: Math.max(0, Math.floor(Number(e.continues) || 0)),
        version: typeof e.version === 'string' ? e.version : '',
        at: Number(e.at) || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function writeScores(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode / storage full — the table just won't persist */
  }
}

/** A score gets on the board if the board has room or it beats the last row. */
export function qualifies(score) {
  if (score <= 0) return false;
  const list = loadScores();
  return list.length < MAX_ENTRIES || score > list[list.length - 1].score;
}

/**
 * Inserts an entry and returns its index in the saved table, or -1 if it
 * did not make the cut. Ties keep the older entry ahead — you have to beat
 * a score, not match it.
 */
export function addScore({
  name, score, world = 1, level = '', assisted = false, continues = 0,
}) {
  const entry = {
    name: (name || '???').slice(0, NAME_LENGTH),
    score: Math.max(0, Math.floor(score)),
    world,
    level: String(level || '').slice(0, 4),
    assisted: !!assisted,
    continues: Math.max(0, Math.floor(Number(continues) || 0)),
    version: GAME_VERSION,
    at: Date.now(),
  };
  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score || a.at - b.at);
  const trimmed = list.slice(0, MAX_ENTRIES);
  writeScores(trimmed);
  return trimmed.indexOf(entry);
}

export function clearScores() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
