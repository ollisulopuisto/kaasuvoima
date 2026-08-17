import { Entity } from './entity.js';
import { moveX, moveY, applyGravity } from '../level/physics.js';
import { drawItem, drawFart, drawSprout, TINTS, GLOWS } from '../gfx/sprites.js';
import { TILE, T } from '../gfx/tiles.js';
import { Sfx } from '../core/audio.js';

const EMERGE_FRAMES = 26;

/** Shared so the draw loop is not allocating an options object per shot. */
const FART_STYLE = { glow: GLOWS.fart };
const FART_STYLE_SPENT = { glow: GLOWS.fart, tint: TINTS.spent };

/**
 * The light a shot carries, in the same shared-object idiom as the styles
 * above: the scene reads it, copies four numbers out of it and forgets it, so
 * one object serves every ball in flight.
 */
const FART_LIGHT = { x: 0, y: 0, r: 0, i: 0 };
/**
 * Small on purpose. The point of a burning shot is that you have to *follow* it
 * to see by it — a shot that lit as much ground as the player's own lamp would
 * just be a second lamp you can throw, and the dark level would stop being
 * dark. 44 px lights the tile it is bouncing along and the two either side.
 */
const FART_LIGHT_R = 44;
/**
 * It never lifts the ground all the way back to daylight the way the lamp does.
 * A shot shows you that there is a ledge there; it does not read the sign.
 */
const FART_LIGHT_I = 0.78;

export class Item extends Entity {
  /** @param {'shroom'|'flower'|'leaf'|'pop'|'soup'|'star'} itemKind */
  constructor(level, x, y, itemKind, { emerge = true, still = false } = {}) {
    super(level, x, y, 16, 16);
    this.kind = 'item';
    this.itemKind = itemKind;
    this.alwaysActive = true;
    this.active = true;
    this.emerging = emerge ? EMERGE_FRAMES : 0;
    /*
     * PAIKALLAAN PYSYVÄ TEHOSTUS, ja se on tehostusportin ehto eikä optio.
     *
     * Sieni **vierii** (0,85 px/frame), koska palkinto joka jää sinne mihin
     * viimeinen vihollinen kaatui voi jäädä hankalaan paikkaan. Se on oikein
     * palkinnolle ja väärin lupaukselle: maassa makaava tehostus joka lunastaa
     * kuilun on **se ainoa tapa päästä yli**, eikä se saa vieriä siihen samaan
     * kuiluun ennen kuin pelaaja ehtii paikalle. Mitattu: 13 laattaa lahjasta
     * kuilun huulelle on 245 framea vierimistä, ja botti saapui myöhemmin —
     * sieni oli ehtinyt pudota, ja portti luki "kuilu sarakkeessa 171".
     */
    this.still = still;
    this.baseY = y;
    this.facing = 1;
    this.leafPhase = 0;
    if (itemKind === 'leaf' && !emerge) this.vy = -1;
  }

  update() {
    this.tick++;

    if (this.emerging > 0) {
      this.emerging--;
      this.y = this.baseY - (1 - this.emerging / EMERGE_FRAMES) * TILE;
      if (this.emerging === 0 && this.itemKind === 'leaf') this.vy = -2.4;
      return;
    }

    switch (this.itemKind) {
      case 'shroom':
      /* The paukkupapu rolls like a mushroom rather than sitting still like a
       * flower. It is dropped in the middle of an arena the player is still
       * moving through, and a prize that stays exactly where the last enemy
       * fell can land somewhere awkward — a rolling one comes to meet you. */
      case 'pop': {
        this.vx = this.still ? 0 : 0.85 * this.facing;
        if (moveX(this, this.level)) this.facing *= -1;
        applyGravity(this, 0.8);
        moveY(this, this.level);
        break;
      }
      case 'star': {
        // It bounces, and that is the point: a star that plodded along the
        // floor like a mushroom would be a mushroom in a different hat.
        this.vx = 1.2 * this.facing;
        if (moveX(this, this.level)) this.facing *= -1;
        applyGravity(this, 0.6);
        if (moveY(this, this.level).ground) this.vy = -3.4;
        break;
      }
      case 'leaf': {
        // Flutters down in a lazy zig-zag, exactly the annoying way it should.
        this.leafPhase += 0.06;
        this.vy = Math.min(this.vy + 0.08, 0.8);
        this.vx = Math.sin(this.leafPhase) * 1.1;
        moveX(this, this.level);
        moveY(this, this.level);
        break;
      }
      case 'soup':
      case 'flower':
      default:
        applyGravity(this, 0.7);
        moveY(this, this.level);
        break;
    }

    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  draw(ctx) {
    drawItem(ctx, this.itemKind, this.x, this.y, this.tick);
  }
}

/**
 * How fast the bean falls out of the block, and how long a tile of stalk takes.
 *
 * The fall is its own number rather than the engine's gravity because the bean
 * is not in the world while it drops: it comes out of the **underside** of the
 * block, and a block is solid, so anything that collided would land on the one
 * thing it just came out of. Four pixels a frame crosses the four tiles to the
 * floor in sixteen frames — a drop you can follow with your eye, which is the
 * whole job, since the point of it is to say *where* the stalk is about to
 * start.
 *
 * Four frames a tile is the one number here with a feel in it. The shipped
 * beanstalk is twenty-two tiles, so the growing itself takes about a second and
 * a half — long enough to read as growing rather than as a level redrawing
 * itself, short enough that the player who hit the block is still standing
 * there when the top of it arrives.
 */
const BEAN_FALL = 4;
const GROW_FRAMES = 4;

/**
 * The bean, and then the beanstalk it turns into.
 *
 * The tiles it writes were taken out of the grid by `LevelScene.plantVines`, so
 * this does not decide where the vine goes — it only decides *when*, and it
 * hands back exactly the run the level data drew and `src/data/rules.js`
 * validated, bottom tile first. The last of those tiles is the cell the spent
 * block is sitting in: the stalk grows through the block it came out of, which
 * is what lets the finished vine run unbroken from the floor to the sky.
 *
 * The sprout rides the row above the newest tile, so the picture always shows
 * where the next one is about to be.
 *
 * It is an entity and not a timer on the scene for two reasons: the bean and
 * the growing tip are things you can see, so they belong where the drawing is,
 * and `savestate.js` already serialises every own property of every entity — so
 * a quicksave halfway up comes back halfway up with no new field anywhere.
 */
export class Beanstalk extends Entity {
  /** @param {{tx:number, ty:number}[]} tiles the run, bottom tile first */
  constructor(level, tx, ty, tiles) {
    super(level, tx * TILE, ty * TILE, TILE, TILE);
    this.kind = 'prop';
    /* The vine crosses a whole band, so most of it grows off the top of the
     * screen. A tip that went to sleep when the camera lost it would leave the
     * level half a beanstalk. */
    this.alwaysActive = true;
    this.active = true;
    this.noclip = true;
    this.tiles = tiles;
    this.grown = 0;
    this.timer = 0;
    /** Where the bean is headed: the row the stalk starts in. */
    this.landY = tiles[0].ty * TILE;
    this.falling = true;
  }

  update() {
    this.tick++;

    if (this.falling) {
      // Out of the bottom of the block, which is the one thing here that no
      // other `?` block does — every other payout rises out of the top. Two
      // events that look alike teach one wrong lesson each (DESIGN.md §8).
      this.y = Math.min(this.landY, this.y + BEAN_FALL);
      if (this.y >= this.landY) this.falling = false;
      return;
    }

    if (++this.timer < GROW_FRAMES) return;
    this.timer = 0;
    const tile = this.tiles[this.grown++];
    this.level.setTile(tile.tx, tile.ty, T.VINE);
    if (this.grown >= this.tiles.length) {
      this.remove = true;
      return;
    }
    this.y = (tile.ty - 1) * TILE;
  }

  draw(ctx) {
    drawSprout(ctx, this.x, this.y, this.tick, this.falling);
  }
}

/** Comfortably above the player's 3.5 px/frame top speed — see the constructor. */
const FART_SPEED = 5.0;

export class FartBall extends Entity {
  constructor(level, x, y, dir) {
    super(level, x, y, 8, 8);
    this.kind = 'projectile';
    this.alwaysActive = true;
    this.active = true;
    /*
     * Faster than the player can possibly run, and that is a rule rather than a
     * taste: at 3.2 it was slower than `MAX_P` (3.5), so a sprinting player
     * outran their own shot and watched it trail behind them. A projectile you
     * can beat in a footrace is not a weapon.
     */
    this.vx = FART_SPEED * dir;
    this.vy = 1;
    this.life = 200;
    Sfx.play('fart');
  }

  update() {
    this.tick++;
    this.life--;
    if (this.life <= 0) {
      this.pop();
      return;
    }

    /*
     * Nothing happens off screen.
     *
     * At 5 px/frame with 200 frames of life the ball travels a thousand pixels
     * — three screens — so it was trapping enemies the player had never seen.
     * The camera would then scroll onto an enemy already sitting in a bubble,
     * which reads as the game having played itself. A shot that leaves the view
     * is spent, the same way it is spent on a wall.
     */
    // 320 mirrors `VIEW_W` in scenes/level.js. Importing it would close a
    // cycle — level.js imports this file — and a cycle that happens to work
    // because the value is read late is still a cycle.
    const camL = this.level.cam.x - 8;
    const camR = this.level.cam.x + 320 + 8;
    if (this.x + this.w < camL || this.x > camR) {
      this.remove = true;
      return;
    }
    if (moveX(this, this.level)) {
      /* Seinään litistynyt laukaus jättää askelman, ks. `LevelScene.gasShelf`.
       * Se on tässä eikä `pop`issa, koska `pop` on myös se mitä loppuun palanut
       * laukaus tekee keskellä ilmaa — ja ilmaan jäävä hylly olisi eri asia ja
       * eri lupaus. Seinä on ehto. */
      this.level.gasShelf(this);
      this.pop();
      return;
    }
    this.vy = Math.min(this.vy + 0.28, 5);
    const hit = moveY(this, this.level);
    if (hit.ground) this.vy = -2.9;   // bounces along the floor
    if (hit.ceiling) this.vy = 1;
    if (this.y > this.level.heightPx + 16) this.remove = true;
  }

  /**
   * Burning gas gives off light, and the shot is the only light in the level
   * that goes where the player is not. Chasing your own shot into the dark to
   * see what is ahead is the whole idea.
   *
   * It dims as it runs out of gas on the same 40-frame tail the sprite already
   * fades on, so the light and the picture agree about when the shot is spent.
   */
  get light() {
    FART_LIGHT.x = this.cx;
    FART_LIGHT.y = this.cy;
    FART_LIGHT.r = FART_LIGHT_R;
    FART_LIGHT.i = FART_LIGHT_I * Math.min(1, this.life / 40);
    return FART_LIGHT;
  }

  pop() {
    this.remove = true;
    this.level.spawnPuff(this.cx, this.cy);
  }

  draw(ctx) {
    // A shot running out of gas stops looking like fresh gas before it pops.
    drawFart(ctx, this.x, this.y, this.tick,
      this.life > 40 ? FART_STYLE : FART_STYLE_SPENT);
  }
}
