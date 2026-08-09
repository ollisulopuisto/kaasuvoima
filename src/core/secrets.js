import { getLevel } from '../data/levels.js';
import { T, TILE } from '../gfx/tiles.js';
import { hashNoise } from './utils.js';

/**
 * What a level hides, and how much of it this save has found.
 *
 * The map needs both numbers BEFORE the level is loaded, so nothing here may
 * touch a LevelScene: the count is read straight out of the level data, which
 * is the same ES module the game builds its grids from. That is also why this
 * is not a generated table like `src/data/difficulty.js` — difficulty needs a
 * Node tool and a file off disk, so it has to be carried across and watched for
 * staleness. A secret count is a scan of data the browser already holds, and a
 * carried copy would only add a way for it to be wrong.
 *
 *
 * ONE SECRET IS ONE THING THE GAME HIDES THAT PAYS OUT WHEN YOU FIND IT.
 *
 * That single rule decides every case, and the cases do not agree with the
 * debug overlay's `Game.levelSecrets`, which counts tiles:
 *
 *   - **A hidden area is one secret**, however you get in. A beanstalk is
 *     twenty-two tiles, the pipe down is two, the pipe back is two more, and
 *     between them they are one discovery: "there is a room above this level".
 *     Counting the vine and both pipes would make a player who found the room
 *     once owe the counter three.
 *   - **A star block is one**, because it looks exactly like an ordinary `?`
 *     block until it pays a star.
 *   - **A switch block is one**: the wall it turns into coins is not visible
 *     until it is hit.
 *   - **A brick with something in it is one.** Which bricks those are is a pure
 *     function of position (see `brickHides`), so it is the same brick for
 *     everybody, every time — a thing you can learn and show a friend.
 *
 * Deliberately NOT counted:
 *
 *   - **Crumbling platforms.** They are in plain sight and they are a hazard.
 *     Nothing is found by standing on one, so a player could never reconcile
 *     the number with what happened to them.
 *   - **Vines and warp pipes themselves.** They are the road to a secret, not
 *     the secret, and they are already counted as the area they reach.
 *   - **Ordinary `?` blocks.** Nothing about them is hidden.
 *
 * A count the player cannot reconcile with what they found is worse than no
 * count at all, so the payout is also what makes one FOUND — see `watchSecrets`.
 */

/*
 * Copied from `LevelScene.brickSecret`, and copied on purpose: this module must
 * not import a scene (see `watchSecrets`), and the rates are two numbers rather
 * than a shared unit. `tools/verify.mjs` asserts that the two copies agree,
 * brick for brick, across all 21 levels — the same trick that keeps
 * `gen-levels.mjs`'s third copy safe.
 */
const SECRET_COIN_RATE = 0.07;
const SECRET_POWER_RATE = 0.015;

/** True when an ordinary brick at this position is hiding something. */
export function brickHides(tx, ty) {
  if (hashNoise(tx * 7 + 13, ty * 11 + 5) < SECRET_POWER_RATE) return true;
  return hashNoise(tx * 3 + 1, ty * 5 + 2) < SECRET_COIN_RATE;
}

/** Keys are stable strings, so a save survives everything but a level rewrite. */
export const SKY = 'sky';
export const CAVE = 'cave';
const tileKey = (ch, tx, ty) => `${ch}${tx},${ty}`;

const keyCache = new Map();

const anyInk = (rows, from, to) => {
  for (let y = from; y < to; y++) if (rows[y].trim() !== '') return true;
  return false;
};

/**
 * Every secret in a level, as a sorted-by-nature list of keys.
 *
 * The list is the level's, never the player's: it is what the count is measured
 * against, and it is also the filter that stops a save from claiming a secret
 * that no longer exists (`foundKeys`).
 */
export function secretKeys(levelId) {
  if (keyCache.has(levelId)) return keyCache.get(levelId);
  const def = getLevel(levelId);
  const rows = def.rows;
  const keys = [];

  if (def.bands) {
    const { rows: band, cave } = def.bands;
    if (anyInk(rows, 0, band)) keys.push(SKY);
    /* The cave band's first row is not the cave: `assembleTall` writes a lid of
     * lava there under every bottomless column, so an empty cave would still
     * look occupied. The room starts on the row below it. */
    if (anyInk(rows, cave + 1, rows.length)) keys.push(CAVE);
  }

  for (let ty = 0; ty < rows.length; ty++) {
    const row = rows[ty];
    for (let tx = 0; tx < row.length; tx++) {
      const ch = row[tx];
      if (ch === T.QSTAR || ch === T.SWITCH) keys.push(tileKey(ch, tx, ty));
      else if (ch === T.BRICK && brickHides(tx, ty)) keys.push(tileKey(ch, tx, ty));
    }
  }

  keyCache.set(levelId, keys);
  return keys;
}

export const secretTotal = (levelId) => secretKeys(levelId).length;

/**
 * What this save has found in that level, filtered against what is there now.
 *
 * The filter is not paranoia: a level edit moves a brick, and a save that
 * remembers the old one would otherwise report 6/5 forever. Filtering makes the
 * stale entry read as "not found", which is the truthful reading — that secret
 * is gone.
 */
export function foundKeys(state, levelId) {
  const mine = state && state.secrets ? state.secrets[levelId] : null;
  if (!mine || !mine.length) return [];
  return secretKeys(levelId).filter((k) => mine.includes(k));
}

/** `{ found, total }` — the only shape the map is allowed to see. */
export const secretTally = (state, levelId) => ({
  found: foundKeys(state, levelId).length,
  total: secretTotal(levelId),
});

/**
 * Writes one find into the save state. Returns true when it was new.
 *
 * It writes and does not persist, deliberately. `Game.finishLevel` persists on
 * both the way out and the way down, so a find survives dying with it; and the
 * attract-mode robot plays with a stand-in state that is never written to disk,
 * so the demo can bump every brick in 1-1 without spending the player's
 * discoveries. Persisting here would have taken that guarantee away.
 */
export function noteSecret(state, levelId, key) {
  if (!state || !secretKeys(levelId).includes(key)) return false;
  if (!state.secrets) state.secrets = {};
  const list = state.secrets[levelId] || (state.secrets[levelId] = []);
  if (list.includes(key)) return false;
  list.push(key);
  return true;
}

const WATCHED = Symbol('sfb3.secrets.watched');

/**
 * WHEN A SECRET BECOMES FOUND: when the game gives you the thing it was hiding.
 *
 * One rule, and it is the same rule in all four cases, because a counter the
 * player cannot predict is a counter that lies:
 *
 *   - a block (star, switch, hidden brick) is found the moment it turns into a
 *     spent block and pops what it held. Not when you see it, not when you
 *     stand under it — when something comes out.
 *   - a hidden area is found the moment your feet are in it. Not when you touch
 *     the vine, which you can do by walking past it, and not when you clear the
 *     level: you are standing in the secret place with the camera on it.
 *
 * WHY THIS IS A WRAPPER AND NOT THREE LINES IN `level.js`: because level.js was
 * not mine to edit in the round that built this. The end state is that
 * `bumpTile` and `tryWarp` call `noteSecret` themselves and this function goes
 * away. That is also why this module must never import `LevelScene` — the class
 * is handed in, so that the day level.js imports *this* there is no cycle to
 * untangle.
 */
export function watchSecrets(LevelScene) {
  const proto = LevelScene.prototype;
  if (proto[WATCHED]) return;
  proto[WATCHED] = true;

  const bumpTile = proto.bumpTile;
  proto.bumpTile = function watchedBumpTile(tx, ty, player) {
    const row = this.grid[ty];
    const before = row ? row[tx] : null;
    bumpTile.call(this, tx, ty, player);
    // The raw grid, not `tileAt`: a running switch reads bricks as coins.
    if (before && before !== T.USED && row[tx] === T.USED) {
      noteSecret(this.game.state, this.id, tileKey(before, tx, ty));
    }
  };

  const update = proto.update;
  proto.update = function watchedUpdate(input) {
    update.call(this, input);
    const bands = this.def.bands;
    if (!bands || !this.player) return;
    // Feet, not head: bumping your head into the sky band is not arriving.
    const band = Math.floor((this.player.y + this.player.h - 1) / (bands.rows * TILE));
    if (band <= 0) noteSecret(this.game.state, this.id, SKY);
    else if (band >= 2) noteSecret(this.game.state, this.id, CAVE);
  };
}
