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
  '1-2': 114.6,
  '1-3': 98.0,
  '1-4': 103.7,
  '1-5': 77.2,
  '1-6': 95.4,
  '1-7': 111.8,
  '1-F': 231.4,
  '2-1': 118.6,
  '2-2': 126.4,
  '2-N': 124.2,
  '2-3': 159.3,
  '2-M': 110.7,
  '2-4': 138.6,
  '2-5': 128.1,
  '2-F': 140.4,
  '3-1': 152.1,
  '3-2': 130.3,
  '3-3': 197.4,
  '3-4': 133.6,
  '3-5': 166.3,
  '3-6': 178.2,
  '3-7': 198.2,
  '3-F': 291.2,
  '4-1': 187.7,
  '4-2': 141.7,
  '4-3': 223.1,
  '4-4': 168.3,
  '4-5': 180.7,
  '4-6': 197.3,
  '4-7': 214.7,
  '4-F': 215.2,
  '5-1': 214.9,
  '5-2': 185.2,
  '5-3': 279.2,
  '5-4': 200.9,
  '5-5': 226.1,
  '5-6': 245.2,
  '5-7': 303.1,
  '5-F': 211.2,
  '6-1': 242.5,
  '6-2': 146.4,
  '6-K': 245.9,
  '6-4': 215.7,
  '6-5': 232.5,
  '6-6': 256.2,
  '6-7': 282.0,
  '6-F': 361.9,
  '7-1': 252.5,
  '7-T': 214.3,
  '7-3': 282.4,
  '7-4': 233.7,
  '7-5': 240.3,
  '7-6': 271.7,
  '7-P': 293.0,
  '7-F': 294.6,
  '8-1': 245.1,
  '8-2': 123.2,
  '8-3': 301.8,
  '8-4': 169.4,
  '8-5': 475.6,
  '8-6': 522.2,
  '8-7': 534.0,
  '8-F': 317.5,
};
