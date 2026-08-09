/**
 * GENERATED FILE — do not edit by hand.
 *
 *   node tools/difficulty.mjs --write
 *
 * The measured difficulty of every level, as `tools/difficulty.mjs` scores it.
 * 100 = a world 1 level; the scale and its frozen references live in the tool.
 *
 * This file exists because the map has to show difficulty BEFORE the player
 * commits to a branch, and the game cannot run the tool: the tool is Node, it
 * reads `tools/jump-budget.json` off disk, and the game is a static page. So
 * the numbers are carried across in a data file, the same way
 * `tools/pacing-stats.json` carries pacing to the generator.
 *
 * A carried number can go stale, which is the whole cost of doing it this way.
 * That is caught rather than trusted: `tools/verify.mjs` re-runs the measurement
 * and compares it with this file, and a single changed level fails the gate with
 * the command that fixes it. Writing is a separate flag on purpose — a reporting
 * tool that rewrites its own inputs as a side effect is the trap
 * `measure-jump.mjs` already fell into.
 */

export const DIFFICULTY = {
  '1-1': 70.4,
  '1-2': 122.8,
  '1-3': 101.2,
  '1-F': 219.5,
  '2-1': 115.7,
  '2-2': 126.4,
  '2-N': 124.2,
  '2-3': 156.1,
  '2-M': 110.7,
  '2-F': 222.7,
  '3-1': 161.6,
  '3-2': 133.4,
  '3-3': 174.3,
  '3-F': 220.1,
  '4-1': 187.7,
  '4-2': 141.2,
  '4-3': 226.5,
  '4-F': 202.1,
  '5-1': 214.9,
  '5-2': 185.2,
  '5-3': 279.2,
  '5-F': 345.5,
  '6-1': 242.5,
  '6-2': 147.5,
  '6-3': 271.5,
  '6-F': 395.4,
};
