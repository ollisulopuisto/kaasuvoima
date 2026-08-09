import { LevelScene } from './level.js';
import { drawText } from '../gfx/font.js';
import { TILE, T, isSolid } from '../gfx/tiles.js';
import { makePower } from '../entities/player.js';

/**
 * Attract mode: after a while on the title screen the cabinet plays itself.
 *
 * Two rules hold the whole thing together.
 *
 *   1. Any input ends it. That check lives in `Game.step`, ahead of every other
 *      key, so the press that takes the machine back cannot also quicksave,
 *      cycle the effects or pick a menu item on its way out.
 *   2. Nothing the demo does may outlive it. The level is handed a stand-in
 *      game object — the real one as a prototype, with its own state and its
 *      own `finishLevel` — so a robot cannot spend a life, write the save,
 *      reach the score table or leave a mark on anything the player owns. It
 *      is not a promise to be careful; the writes land somewhere else.
 */

const DEMO_LEVEL = '1-1';

/**
 * How long the show runs before it hands back. A minute is what an arcade loop
 * was: long enough to watch someone play, short enough that the title screen —
 * which is where the coin slot is — comes back around while you are still
 * standing there. The bot usually dies well before this.
 */
const DEMO_FRAMES = 60 * 60;

const blank = () => ({
  left: false, right: false, up: false, down: false, jump: false, run: false,
  start: false, mute: false, quicksave: false, quickload: false, slot: false,
  debug: false, export: false, fx: false, touch: false,
});

export class DemoScene {
  constructor(game) {
    this.game = game;
    this.tick = 0;
    this.done = false;
    /** Set by the raw listeners below; only the loop acts on it. */
    this.aborted = false;

    // Everything the level writes — score, coins, lives, the reserve item —
    // goes through `game.state`, so the demo gets its own. The prototype link
    // keeps the rest (input, debug flag) pointing at the real game.
    const stand = Object.create(game);
    stand.state = {
      lives: 4, coins: 0, score: 0, reserve: null,
      // One mushroom's worth of power: a demo is a shop window and the mid-air
      // fart jump is the thing in it, so a powerless bot would spend the whole
      // minute demonstrating walking.
      power: makePower('shroom', 2),
      world: 0, node: null, cleared: {}, worldsOpen: 1, cards: [],
    };
    stand.finishLevel = () => { this.done = true; };

    this.level = new LevelScene(stand, DEMO_LEVEL);
    // Telemetry answers "where do people die". A robot is not people, and its
    // deaths would sit on top of the heatmap the levels are tuned from.
    this.level.recordDeath = () => {};
    this.level.recordClear = () => {};
    this.level.updateProgress = () => {};

    // `setScene` reads the theme before it calls `enter`, so the ambience has
    // to be known by the time the constructor returns.
    this.theme = this.level.theme;

    this.pad = {
      held: blank(),
      pressed: blank(),
      released: blank(),
      consume(action) { this.pressed[action] = false; },
    };
    this.prevJump = false;
    this.hold = 0;

    /* Mapped keys already end the demo through `Input`, but an attract mode
     * that argues about which keys count is a broken attract mode. Anything at
     * all, including a tap on the canvas, hands the machine back. */
    this.abort = () => { this.aborted = true; };
  }

  enter() {
    addEventListener('keydown', this.abort);
    addEventListener('pointerdown', this.abort);
    this.level.enter();
  }

  /** Gives back everything the demo borrowed. Safe to call twice. */
  dispose() {
    removeEventListener('keydown', this.abort);
    removeEventListener('pointerdown', this.abort);
  }

  /*
   * The demo ignores the controls on purpose: by the time a frame with input in
   * it reaches a scene, `Game.step` has already ended the demo.
   *
   * The two catches are not decoration. `frame()` asks for the next animation
   * frame *after* updating and drawing, so anything thrown out of here stops
   * the loop for good — and a heuristic bot playing unattended is exactly the
   * thing you cannot promise will never throw. A demo may end badly; the
   * machine may not.
   */
  update() {
    this.tick++;
    try {
      this.level.update(this.drive());
    } catch {
      this.done = true;
    }
    if (this.done || this.tick >= DEMO_FRAMES) this.game.endDemo();
  }

  draw(ctx) {
    try {
      this.level.draw(ctx);
    } catch {
      this.done = true;
    }
    // Top of the sky, above where the action is: a caption nobody can miss and
    // nothing has to be played around.
    drawText(ctx, 'ESITTELY', 160, 6, { color: '#ffd048', align: 'center', shadow: '#101018' });
    if (Math.floor(this.tick / 40) % 2) {
      drawText(ctx, 'PAINA NÄPPÄINTÄ NIIN PÄÄSET PELAAMAAN', 160, 16, {
        color: '#c0c0d0', align: 'center', shadow: '#101018',
      });
    }
  }

  /**
   * One frame of bot input: run right, jump at walls and gaps with a hold that
   * matches how far it is across, and spend an air jump when falling with
   * nothing underneath. This is the bot from tools/playable.mjs, where the
   * reasoning behind each of these numbers is written down at length.
   *
   * It plays a level with the enemies left in, which that one does not, so it
   * dies to things a player would walk around. That is the deal with attract
   * mode: it has to look like play, not be good at it.
   */
  drive() {
    const scene = this.level;
    const p = scene.player;
    const footY = Math.floor((p.y + p.h) / TILE);
    const aheadX = Math.floor((p.x + p.w + 6) / TILE);
    const solid = (tx, ty) => isSolid(scene.tileAt(tx, ty));
    const lethal = (tx, ty) => {
      const ch = scene.tileAt(tx, ty);
      return ch === T.SPIKE || ch === T.LAVA;
    };
    const wall = solid(aheadX, footY - 1) || solid(aheadX, footY - 2);

    let obstacle = -1;
    for (let d = 0; d <= 5 && obstacle < 0; d++) {
      const tx = aheadX + d;
      if (lethal(tx, footY) || lethal(tx, footY - 1)) obstacle = d;
      else if (!solid(tx, footY) && !solid(tx + 1, footY)) obstacle = d;
    }
    const takeOff = p.onGround && (wall || (obstacle >= 0 && obstacle <= 2));

    if (takeOff) {
      let span = 0;
      if (obstacle >= 0) {
        const start = aheadX + obstacle;
        while (span < 14 && (!solid(start + span, footY)
          || lethal(start + span, footY) || lethal(start + span, footY - 1))) span++;
      }
      this.hold = wall ? 16 : Math.max(5, Math.min(16, 3 + span * 1.1)) | 0;
    }

    const groundBelow = solid(Math.floor(p.cx / TILE), footY + 1)
      || solid(Math.floor(p.cx / TILE), footY + 2);
    const airSave = !p.onGround && p.vy > 1.5 && !groundBelow && p.airJumps < p.airJumpsMax;
    const wantJump = takeOff || airSave || (this.hold > 0 && p.vy < 0);
    if (this.hold > 0) this.hold--;

    const pad = this.pad;
    pad.held = blank();
    pad.held.right = true;
    pad.held.run = true;
    pad.held.jump = wantJump;
    pad.pressed = blank();
    pad.pressed.jump = (takeOff || airSave) && !this.prevJump;
    this.prevJump = wantJump;
    return pad;
  }
}
