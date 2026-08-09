/**
 * All artwork is drawn procedurally on the 320x240 back buffer with integer
 * rectangles, so it stays crisp pixel art without shipping any image files.
 *
 * The artwork itself lives in ./sprites/, split by what is drawn, so two people
 * drawing two things are not editing the same file. This one stays the only
 * address anybody imports: a dozen modules already ask it for a sprite by name,
 * and where that sprite is kept is nobody else's business.
 */

export {
  PLAYER_SIZES, PLAYER_DUCK_SIZES, drawPlayer, drawCork,
  /* Re-exported so the screens that draw a walking player outside a level —
   * the title cast, the victory card, the map pawn — drive the cycle from the
   * same constant the engine does. They used a literal 3, which is how they
   * kept the apart→apart wrap after the level fixed it. */
  WALK_FRAMES,
} from './sprites/player.js';
export {
  drawWalker, drawShell, drawFlyer, drawPlant, drawStinkCloud, drawCorkGuy,
  drawAngrySun, drawSunTrail, SUN_TRAIL_LIFE, breath, BREATH_PERIOD,
  drawHeartburn, bubbleRadius, drawBubble, drawSpines, drawSpikeGuy,
  drawBeanBaron, drawBeanBomb,
} from './sprites/enemies.js';
export { drawBoss } from './sprites/boss.js';
export {
  drawItem, drawFart, drawSprout, drawGasPuff, drawGoal, drawBrickShard, CARD_ICONS,
} from './sprites/items.js';
export {
  C as SPRITE_COLORS, TINTS, STAR_TINTS, GLOWS, recolored,
} from './sprites/palette.js';
