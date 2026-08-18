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
  '1-1': 67.3,
  '1-2': 114.6,
  '1-3': 91.4,
  '1-4': 101.2,
  '1-5': 62.3,
  '1-6': 96.8,
  '1-7': 111.5,
  '1-F': 231.4,
  '2-1': 118.6,
  '2-2': 126.4,
  '2-N': 123.5,
  '2-3': 154.3,
  '2-M': 109.4,
  '2-4': 137.1,
  '2-5': 125.9,
  '2-F': 140.4,
  '3-1': 138.7,
  '3-2': 127.7,
  '3-3': 197.4,
  '3-4': 150.2,
  '3-5': 160.6,
  '3-6': 162.6,
  '3-7': 167.7,
  '3-F': 291.2,
  '4-1': 187.7,
  '4-2': 141.7,
  '4-3': 241.7,
  '4-4': 168.3,
  '4-5': 180.7,
  '4-6': 197.3,
  '4-7': 214.7,
  '4-F': 215.2,
  '5-1': 186.0,
  '5-2': 163.8,
  '5-3': 168.5,
  '5-4': 200.6,
  '5-5': 190.3,
  '5-6': 245.2,
  '5-7': 303.1,
  '5-F': 211.2,
  '6-1': 242.5,
  '6-2': 84.1,
  '6-K': 245.9,
  '6-4': 215.7,
  '6-M': 259.2,
  '6-6': 256.2,
  '6-7': 259.5,
  '6-F': 361.9,
  '7-1': 226.9,
  '7-T': 214.3,
  '7-3': 287.6,
  '7-4': 233.7,
  '7-5': 250.2,
  '7-6': 271.7,
  '7-P': 289.9,
  '7-F': 294.6,
  '8-1': 235.5,
  '8-2': 123.2,
  '8-3': 301.8,
  '8-4': 169.4,
  '8-5': 475.6,
  '8-6': 522.2,
  '8-7': 534.0,
  '8-F': 317.5,
};
