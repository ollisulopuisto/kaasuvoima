import {
  WORLDS, findNode, startNode, linkPoints, linkCurve, routeByLink, branchAt, nodePips,
  PIPS, REWARDS, TILE, BEND_MAX,
} from '../data/worlds.js';
import { drawText } from '../gfx/font.js';
import { drawItem, drawPlayer } from '../gfx/sprites.js';
import { Music, Sfx } from '../core/audio.js';
import { clamp, hashNoise, padNum } from '../core/utils.js';
import { normalizePower, powerAfterItem, POWER_NAMES } from '../entities/player.js';
import { secretTally } from '../core/secrets.js';
import { MODE_NAME, SPLIT_COLORS } from '../core/timeattack.js';

/*
 * KARTAN ÄÄNET, LUETTUNA DESIGN.md KOHTAA 8 VASTEN (10.8.2026).
 *
 * Aamun ääniauditointi luki `level.js`:n ja pysähtyi siihen, joten kartan
 * yksitoista `Sfx.play`-kutsua olivat lukematta. Ne on nyt luettu, ja tuomio on
 * kirjattu tähän eikä muistiin — myös niiden kohdalla jotka jäivät ennalleen,
 * koska "tämä on tarkasteltu ja se on oikein" on eri tieto kuin hiljaisuus.
 *
 * Kartta on kertojan puolta: se on **valintalauta**, ei huone. Siksi sen
 * sanasto on valikon sanasto eikä maailman, ja kolme sanaa riittää:
 *
 *   `cursor`  (3) valinta liikkuu — nappula lähtee kävelemään solmulta
 *                 toiselle, ja talon esinevalitsin liikkuu vasemmalle tai
 *                 oikealle. Sama merkitys molemmissa: kohde vaihtui, mitään ei
 *                 ole vielä päätetty.
 *   `select`  (2) valinta lyödään lukkoon — kenttä alkaa, tai talon ovi
 *                 aukeaa. Molemmat ovat "menen tähän", ja niiden erottaminen
 *                 toisistaan vaatisi kaksi ääntä yhdelle asialle.
 *   `bump`    (4) pyyntö ei mene läpi — suljettu polku, tyhjä talo, tyhjä
 *                 varasto, jo täydet kaasut. Neljä eri syytä, yksi merkitys:
 *                 **mitään ei tapahtunut**, ja syyn kertoo ruudulle ilmestyvä
 *                 teksti. Neljä eri ääntä tekisi kieltäytymisestä tapahtuman.
 *
 * `Music.play('map')` on kertojaa sekin, kohdan 8 omalla listalla. Se ei ole
 * ääniefekti eikä sitä lasketa tähän.
 *
 * Ja se yksi joka **ei** ollut oikein: talosta saatu esine soitti `powerup`in
 * mennessään varastoon. Ks. `updateHouse`. Sen jälkeen `powerup` soi kartalla
 * tasan yhdessä paikassa, `useReserve`ssa, jossa voimataso oikeasti nousee —
 * ja `verify.mjs` lukee sen tiedostosta eikä usko tätä kommenttia.
 */

const MAP_Y = 14;
const MAP_H = 144;
const VIEW_W = 320;
const PANEL_Y = MAP_Y + MAP_H;
const WALK_SPEED = 1.4;

/*
 * THE MAP SCROLLS SIDEWAYS, AND ONLY SIDEWAYS.
 *
 * A world's terrain grid used to be exactly the size of the view — 20x9 tiles,
 * 320x144 px — so the map had never had to move. Eight level nodes, the roads
 * between them and the corridor rule 8 keeps clear beside every road do not fit
 * in twenty columns, so the grid is allowed to be wider than the window and the
 * window follows the pawn. A world that is still twenty columns wide is exactly
 * 320 px wide, `maxScroll()` is 0, and every pixel of it is drawn where it was.
 *
 * WHY NOT VERTICALLY, and what would have to be true first. The band is 144 px
 * tall because that is what is left once the title bar (14) and the panel (82)
 * have their rows, and both of those are sized against text that has to be
 * readable — the band did not choose its height, it inherited it. Three things
 * would have to be settled before a second axis could be added, and none of
 * them is settled by this file:
 *
 *   1. A vertical dead zone would have to be smaller than 96 px, because the
 *      band is 144 px and a zone of 96 leaves 48 px of travel. Small dead zones
 *      are where jitter lives, so it would need its own measurement rather than
 *      this one halved.
 *   2. The panel and the title bar would have to stop being the map's frame.
 *      Right now a node's difficulty bar ends at y=143 and the panel starts at
 *      158, and that 15 px is checked; a map that can slide upward has no such
 *      fixed relationship, so the check would have to be rewritten against the
 *      view rather than against the grid.
 *   3. Somebody would have to decide what a map taller than the window MEANS.
 *      A world reads left to right — that is why sideways scrolling needs no
 *      explanation. Up and down is a second dimension of progress, and a map
 *      that has one is a different design, not a bigger picture.
 *
 * WHAT THIS CAMERA INHERITED FROM `level.js`, AND WHAT IT DID NOT.
 *
 * Inherited, and the reasoning is that file's:
 *   - A DEAD ZONE, and the same arithmetic: the view moves only by the amount
 *     the pawn has left the zone, so it can never be more than CAM_DEAD_ZONE
 *     from centre and small moves inside the zone leave the screen still. On
 *     this map that also kills the one wobble a map camera can have: a bend on
 *     a vertical road pushes the pawn's x sideways by up to BEND_MAX px, and a
 *     camera without a zone would sway left and right while the pawn walks
 *     straight down.
 *   - NO INERTIA. The drift is applied whole, on the frame it is measured, so
 *     the view stops on the same frame the pawn does. A view that keeps
 *     drifting after the thing you aim with has stopped is what makes 2D
 *     platformers feel seasick, and it is no better when the thing that stopped
 *     is a pawn arriving at a node.
 *   - THE CUT ON ENTRY. `level.js` has exactly one cut, `centerCamera()`, and
 *     it assigns rather than eases. So does `snapCamera()` here, and for the
 *     same reason: on the frame the scene appears there is no "where the view
 *     was", so there is nothing to ease from.
 *
 * NOT inherited, deliberately:
 *   - LOOK-AHEAD. In a level the view leans the way you are running because you
 *     are aiming at a gap you cannot see yet. On the map you are not aiming:
 *     the move is chosen with one press, the destination is a node that is
 *     already drawn, and the walk is short — a two-tile hop is 23 frames at
 *     1.4 px/frame. A lean that builds over ~30 frames and returns over ~14
 *     would still be settling after the pawn had arrived, which is inertia
 *     wearing a different name.
 *   - THE VERTICAL RULES. `cameraY`, the fall lead, the band clamp: all of them
 *     answer questions this scene does not have. See above.
 *
 * CAM_DEAD_ZONE is 96 and that is measured against the map rather than chosen.
 * The pawn is held within 96 px of the middle of a 320 px window, so there are
 * always at least 64 px of map beyond it on the side it is walking towards. The
 * longest hop between two nodes on any shipped map is three tiles (48 px) and a
 * node stamp reaches 11 px past its centre, so 59 px is what it takes to see
 * the whole of the next node before stepping off the one you are on — and 64
 * clears that with the four pixels a bend can add.
 */
const CAM_DEAD_ZONE = 96;

/*
 * How far a node's stamp reaches past the right edge of its own tile. The
 * difficulty bar is drawn from x-1 and is PIP_BAR_W + 2 = 20 px wide, so it
 * ends 3 px past the tile. The map is that much wider than its grid, or a node
 * in the last column would have its bar clipped by the window at full scroll.
 * No shipped world has a node past column 18, so this widens none of them.
 */
const STAMP_BLEED = 3;

const HOUSE_ITEMS = ['shroom', 'flower', 'leaf', 'soup'];

/*
 * The difficulty ramp, one colour per pip count.
 *
 * Three at #ffd048 is the gold every ordinary path on this map has always been,
 * so an average branch looks like the rest of the world instead of announcing
 * itself, and the ends of the ramp are what read as unusual.
 *
 * Colour is the WEAKEST channel here (DESIGN.md §8 is about sound, but the same
 * rule runs through the whole map: two signals that look alike teach the player
 * to read the wrong one). So colour never carries this alone. Every level node
 * draws the same count as filled bars, and standing on the fork spells both
 * routes out in words. A player who cannot tell the green path from the red one
 * still counts three bars against five.
 */
export const TIER_COLORS = ['#8890b0', '#6ad04a', '#c8e048', '#ffd048', '#f09030', '#e05038'];
const TIER_SHADE = ['#3a3a50', '#2f7a24', '#7a8420', '#c07c20', '#8a4c14', '#7a2418'];
export const PIP_OFF = '#3a3a52';

/*
 * The secret mark, two states and four colours: gold while something is still
 * hidden in that level, green once it is all found — and a dark shade of each
 * for the white plaque an uncleared level wears, because gold on white is not a
 * colour difference. Both hues are the ones this map already speaks: gold is
 * what is worth having (coins, the branch prize), green is what is done (the
 * cleared label, the fortress flag).
 */
const SECRET_LEFT = ['#c07c20', '#ffd048'];   // [on white plaque, on dark]
const SECRET_DONE = ['#2f7a24', '#8fe04a'];

/*
 * THE LEVEL STAMP, AND WHAT IT COSTS.
 *
 * Three things share one node: the level number, the difficulty bar and the
 * secrets mark. Inside a 16x16 cell they had nothing between them — measured,
 * every gap was 0 px: the mark's right edge touched the number's left column,
 * the plaque's bottom border touched the bar's shadow, and the bar's five pips
 * were one pixel apart. That is what "crammed" was, and no rearrangement inside
 * 16x16 fixes it, because 3 + 5 pixels of content and 2 px of air on each side
 * of each gap does not fit in 16 with the borders on.
 *
 * So the stamp leaves the tile. What that costs, measured on the 320x240 buffer
 * rather than guessed:
 *
 *   - the plaque is 16x13 and starts 2 px ABOVE the cell; the bar is 20x5 and
 *     ends 2 px BELOW it and 2 px past each side. Bounding box 20x21 = 420 px²,
 *     up from 256, which is 0.55% of the buffer per node.
 *   - the two closest nodes on any map are two tiles apart (32 px, w2-3 and
 *     w2-m), so two stamps side by side leave 12 px of map between them, down
 *     from 16. The closest vertical pair is three tiles (48 px) and leaves 27.
 *   - the closest a path comes to a node it does not touch is 28 px from the
 *     centre; the stamp reaches 10 px sideways and 11 up, the path's dot 3, so
 *     14 px of map still separates them.
 *   - the lowest level node sits on row 7, whose bar ends at y=143. The panel
 *     starts at 158, so nothing hangs into it.
 *
 * `verify.mjs` measures all four of those on the shipped maps and on the drawn
 * pixels, so the day somebody moves a node two tiles closer, the gate says so
 * instead of the map quietly growing shut.
 */
const PLAQUE_W = 16;
const PLAQUE_H = 13;
const PLAQUE_TOP = -2;                        // relative to the top of the cell
const PIP_W = 2;
const PIP_PITCH = 4;                          // 2 px of pip, 2 px of air
const PIP_BAR_W = PIPS * PIP_PITCH - (PIP_PITCH - PIP_W);
const PIP_PAD = 1;                            // the dark rim the bar carries
const PIP_TOP = 14;                           // 2 clear rows under the plaque

export class WorldMapScene {
  constructor(game) {
    this.game = game;
    this.tick = 0;
    this.mode = 'idle';        // idle | walk | house | banner
    this.walk = null;
    this.bannerTimer = 0;
    this.message = null;
    this.messageTimer = 0;
    this.houseCursor = 0;
    this.sync();
  }

  sync() {
    this.world = WORLDS[this.game.state.world] || WORLDS[0];
    const nodeId = this.game.state.node;
    this.node = findNode(this.world, nodeId) || startNode(this.world);
    this.game.state.node = this.node.id;
    this.pos = { x: this.node.tx * TILE + 8, y: this.node.ty * TILE + 8 };
    /* Which links belong to which branch route. Measured difficulty, read from
     * the generated table — nothing on this map is a hand-typed guess. */
    this.routeLinks = routeByLink(this.world);
    this.snapCamera();
  }

  /* -------------------------------- camera ----------------------------- */

  /**
   * How wide the map is in pixels — the grid, plus whatever the drawing hangs
   * over its right edge.
   *
   * Read from the data rather than from a constant, because the constant is the
   * thing this change exists to stop believing. `MAP_W` in `worlds.js` says 20
   * and every shipped grid is still 20, but the next one need not be, and a
   * width that is a number somewhere else is a width that goes stale silently.
   * Link waypoints count too: a road may be routed through a column no node
   * stands in, and a road drawn off the end of the map is the same bug as a
   * node drawn off it.
   */
  static mapWidthPx(world) {
    let right = 0;
    for (const row of world.terrain || []) right = Math.max(right, row.length * TILE);
    for (const n of world.nodes) right = Math.max(right, n.tx * TILE + TILE + STAMP_BLEED);
    for (const l of world.links) {
      for (const [tx] of l.path || []) right = Math.max(right, tx * TILE + TILE);
    }
    return right;
  }

  mapWidthPx() {
    return WorldMapScene.mapWidthPx(this.world);
  }

  /** The furthest left edge the window may have. 0 on a map 20 tiles wide. */
  maxScroll() {
    return Math.max(0, this.mapWidthPx() - VIEW_W);
  }

  /**
   * The window's left edge in map pixels, rounded.
   *
   * Rounded because everything on this map is drawn on whole pixels and a
   * fractional translate would soften every edge it moved: the plaque's border,
   * the two-pixel seams inside the stamp, the four-pixel pips. Those gaps are
   * measured from rendered pixels by the gate, so a blurred stamp is not merely
   * uglier — it measures smaller, and the map would fail a rule it had not
   * actually broken. `this.scroll` stays fractional so the follow itself does
   * not quantise; only the drawing rounds.
   *
   * The four map-space drawers each `save()`, `translate()` and `restore()`
   * unconditionally, including on the eight shipped maps where the offset is 0
   * and the transform is the identity. Skipping the transform when it is zero
   * was measured and it saves 0.04 ms of a 16.7 ms frame — and it would mean
   * that the eight maps anybody actually plays are the ones that never execute
   * the new code path, so the first world wide enough to scroll would also be
   * the first to run it. A quarter of a percent is not worth buying that.
   */
  camX() {
    return Math.round(this.scroll);
  }

  /**
   * The cut. Centres the window on the pawn and clamps it to the map.
   *
   * Every arrival on this map comes through here, because every arrival builds
   * a new scene: entering a world, coming back from a level, loading a save,
   * the first frame of a new game. That is the point — the framing on arrival
   * is a pure function of which node you are standing on, so there is nothing
   * to remember and nothing that can arrive wrong and then slide into place.
   *
   * It is also the whole of the answer to "does the scroll belong in the save
   * file". It does not: `sync()` derives it from `state.node`, which is already
   * saved, and a second copy in the file could only ever disagree with the
   * first. See `snapCamera`'s only caller.
   */
  snapCamera() {
    this.scroll = clamp(this.pos.x - VIEW_W / 2, 0, this.maxScroll());
  }

  /**
   * The follow: a dead zone, no easing, no lean. See the note at the top of the
   * file for which half of `level.js`'s camera this is and which half it is not.
   *
   * Written as "move by the drift the pawn has beyond the zone" rather than
   * "ease towards the pawn" on purpose, and it is the same line `level.js`
   * uses. The two are not the same shape: an ease keeps moving after the pawn
   * stops, this cannot, because the drift it is fed is zero on that frame.
   */
  updateCamera() {
    const drift = (this.pos.x - VIEW_W / 2) - this.scroll;
    if (Math.abs(drift) > CAM_DEAD_ZONE) {
      this.scroll += drift - Math.sign(drift) * CAM_DEAD_ZONE;
    }
    this.scroll = clamp(this.scroll, 0, this.maxScroll());
  }

  /** The branch that starts where the player is standing, if any. */
  branchHere() {
    return branchAt(this.world, this.node.id);
  }

  enter() {
    this.sync();
    Music.play('map');
    this.mode = 'banner';
    this.bannerTimer = 80;
  }

  /* ------------------------------ progress ----------------------------- */

  isCleared(id) {
    return !!this.game.state.cleared[id];
  }

  isLinkOpen(link) {
    const a = findNode(this.world, link.a);
    const b = findNode(this.world, link.b);
    if (a.type === 'start' || b.type === 'start') return true;
    return this.isCleared(link.a) || this.isCleared(link.b);
  }

  linksFrom(nodeId) {
    return this.world.links.filter((l) => l.a === nodeId || l.b === nodeId);
  }

  /* -------------------------------- input ------------------------------ */

  /**
   * The camera runs after whatever moved the pawn, on every frame and in every
   * mode, which is why the scene's own step is a separate method.
   *
   * Every mode: the banner, the house menu and the idle state cannot move the
   * pawn, so on those frames `updateCamera` measures a drift of zero and does
   * nothing at all — but "cannot move" is a claim about today's code, and a
   * camera that only runs in the mode somebody remembered is how a view ends up
   * one frame behind the thing it is following.
   */
  update(input) {
    this.step(input);
    this.updateCamera();
  }

  step(input) {
    this.tick++;
    if (this.messageTimer > 0) this.messageTimer--;

    if (this.mode === 'banner') {
      if (--this.bannerTimer <= 0 || input.pressed.start || input.pressed.jump) {
        this.mode = 'idle';
      }
      return;
    }

    if (this.mode === 'walk') return this.updateWalk();
    if (this.mode === 'house') return this.updateHouse(input);

    const dir = input.pressed.left ? 'left'
      : input.pressed.right ? 'right'
        : input.pressed.up ? 'up'
          : input.pressed.down ? 'down' : null;
    if (dir) this.tryMove(dir);

    if (input.pressed.jump) {
      input.consume('jump');
      this.enterNode();
    }
    if (input.pressed.start) {
      input.consume('start');
      this.useReserve();
    }
  }

  tryMove(dir) {
    const wanted = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
    for (const link of this.linksFrom(this.node.id)) {
      const pts = linkPoints(this.world, link);
      const forward = link.a === this.node.id;
      /* Which way the arrow key has to point is read from the TILE waypoints,
       * not from the bent curve. A bend makes the first step of a road slightly
       * diagonal, and asking `Math.sign` about that would turn "right" into
       * "right and a bit down" and stop matching any key. The road leans; where
       * it goes does not. */
      const head = forward ? pts : [...pts].reverse();
      const dx = Math.sign(head[1].tx - head[0].tx);
      const dy = Math.sign(head[1].ty - head[0].ty);
      if (dx !== wanted[0] || dy !== wanted[1]) continue;
      if (!this.isLinkOpen(link)) {
        Sfx.play('bump');
        this.showMessage('POLKU ON SULJETTU');
        return;
      }
      /* The pawn walks the drawn curve, vertex by vertex — the same list of
       * points `drawLinks` steps along. One geometry, two readers. */
      const curve = linkCurve(this.world, link);
      this.walk = { path: forward ? curve : [...curve].reverse(), index: 0 };
      this.mode = 'walk';
      this.targetNode = findNode(this.world, forward ? link.b : link.a);
      Sfx.play('cursor');
      return;
    }
  }

  updateWalk() {
    const next = this.walk.path[this.walk.index + 1];
    const dx = next.x - this.pos.x;
    const dy = next.y - this.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= WALK_SPEED) {
      this.pos.x = next.x;
      this.pos.y = next.y;
      this.walk.index++;
      if (this.walk.index >= this.walk.path.length - 1) {
        this.node = this.targetNode;
        this.game.state.node = this.node.id;
        this.game.persist();
        this.mode = 'idle';
      }
      return;
    }
    this.pos.x += (dx / dist) * WALK_SPEED;
    this.pos.y += (dy / dist) * WALK_SPEED;
  }

  enterNode() {
    const node = this.node;
    if (node.type === 'level' || node.type === 'fortress') {
      Sfx.play('select');
      this.game.startLevel(node);
      return;
    }
    if (node.type === 'house') {
      if (this.isCleared(node.id)) {
        this.showMessage('TALO ON JO TYHJA');
        Sfx.play('bump');
        return;
      }
      this.mode = 'house';
      this.houseCursor = 0;
      Sfx.play('select');
      return;
    }
    this.showMessage('MATKA ALKAA TASTA');
  }

  updateHouse(input) {
    const n = HOUSE_ITEMS.length;
    if (input.pressed.left) {
      this.houseCursor = (this.houseCursor + n - 1) % n;
      Sfx.play('cursor');
    }
    if (input.pressed.right) {
      this.houseCursor = (this.houseCursor + 1) % n;
      Sfx.play('cursor');
    }
    if (input.pressed.jump || input.pressed.start) {
      input.consume('jump');
      input.consume('start');
      this.game.state.reserve = HOUSE_ITEMS[this.houseCursor];
      this.game.state.cleared[this.node.id] = true;
      this.game.persist();
      this.mode = 'idle';
      this.showMessage('SAIT ESINEEN VARASTOON');
      /*
       * `reserve` eikä `powerup`, ja se on aamun korjaus loppuun asti.
       *
       * Talosta saatu esine menee lokeroon: voimataso ei liiku, keho ei kasva,
       * eikä ruudulla tapahdu mitään muuta kuin että HUDin lokero täyttyy.
       * `powerup` sanoi tässä "kasvoit" — sama valhe jonka `level.js` lakkasi
       * kertomasta aamulla — ja merkki joka valehtelee opitaan uskomaan
       * (DESIGN.md kohta 8: yksi tilanvaihdos, yksi merkki).
       *
       * Kartta ja kenttä soittavat nyt samasta tapahtumasta saman äänen. Se on
       * väitteen toinen puolisko eikä koristelu: kaksi murretta samalle asialle
       * opettaisi pelaajan lukemaan lokeron täyttymistä kahtena eri asiana sen
       * mukaan missä hän sattuu seisomaan.
       */
      Sfx.play('reserve');
    }
  }

  useReserve() {
    const item = this.game.state.reserve;
    if (!item) {
      this.showMessage('VARASTO ON TYHJA');
      Sfx.play('bump');
      return;
    }
    const before = normalizePower(this.game.state.power);
    if (before.level >= 5) {
      this.showMessage('OLET JO TAYSISSA KAASUISSA');
      Sfx.play('bump');
      return;
    }
    this.game.state.reserve = null;
    this.game.state.power = powerAfterItem(before, item);
    this.game.persist();
    const p = this.game.state.power;
    this.showMessage(`${POWER_NAMES[p.type] || 'VOIMA'} TASO ${p.level}`);
    Sfx.play('powerup');
  }

  showMessage(text) {
    this.message = text;
    this.messageTimer = 110;
  }

  /* --------------------------------- draw ------------------------------ */

  draw(ctx) {
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, 0, 320, 240);

    this.drawTerrain(ctx);
    this.drawSky(ctx);
    this.drawLinks(ctx);
    this.drawNodes(ctx);
    this.drawToken(ctx);
    this.drawTitleBar(ctx);
    this.drawPanel(ctx);

    if (this.mode === 'house') this.drawHouse(ctx);
    if (this.mode === 'banner') this.drawBanner(ctx);
  }

  /**
   * Clouds and birds drifting over the map, on top of the terrain.
   *
   * The one thing on this map drawn in SCREEN pixels rather than map pixels,
   * and it stays that way now the map scrolls. A cloud has no tile it belongs
   * to: it is weather over the window, it already moves on its own, and it
   * wraps at 320 + 60 px because that is the width of the window and not of the
   * world. Scrolling it 1:1 with the ground would make it a painted cloud stuck
   * to a hillside; scrolling it at some fraction is parallax, which is a real
   * thing to want and a different change — it would need the wrap span to
   * become the map's width so the same cloud did not reappear twice on a wide
   * map, and it would need somebody to decide how far away the sky is.
   */
  drawSky(ctx) {
    const th = this.world.theme;
    if (th === 'factory') return;                 // that sky is full of smoke
    const color = th === 'ice' ? 'rgba(255,255,255,0.75)'
      : th === 'desert' ? 'rgba(255,244,224,0.6)' : 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 5; i++) {
      const seed = hashNoise(i * 17, 5);
      const span = 320 + 60;
      const x = Math.round(((seed * span + this.tick * (0.10 + seed * 0.14)) % span + span)
        % span - 40);
      const y = MAP_Y + 6 + Math.round(seed * (MAP_H - 40));
      const s = seed > 0.6 ? 2 : 1;
      ctx.fillStyle = color;
      ctx.fillRect(x, y + 3 * s, 22 * s, 3 * s);
      ctx.fillRect(x + 4 * s, y, 9 * s, 5 * s);
      ctx.fillRect(x + 12 * s, y + 2 * s, 7 * s, 3 * s);
    }
    if (th === 'grass') {
      for (let i = 0; i < 3; i++) {
        const seed = hashNoise(i * 29, 13);
        const span = 320 + 80;
        const x = Math.round(((seed * span - this.tick * (0.3 + seed * 0.2)) % span + span)
          % span - 40);
        const y = MAP_Y + 10 + Math.round(seed * 26) + Math.round(Math.sin(this.tick / 40 + i) * 3);
        const flap = Math.floor(this.tick / 8 + i) % 2;
        ctx.fillStyle = 'rgba(30,40,60,0.55)';
        ctx.fillRect(x, y, 2, 1);
        ctx.fillRect(x - 2, y - flap, 2, 1);
        ctx.fillRect(x + 2, y - flap, 2, 1);
      }
    }
  }

  drawTerrain(ctx) {
    const th = this.world.theme;
    // One shared sway, offset per tile so neighbours do not move in lockstep.
    const sway = (tx, ty, amount) =>
      Math.round(Math.sin(this.tick / 24 + tx * 0.8 + ty * 0.5) * amount);
    /* Linnakkeen maa on koko pelin tummin, ja se on tarkoitus eikä sattuma:
     * viimeinen kartta on ainoa jolla ei ole taivasta eikä maisemaa, vaan
     * kivilattia soihtujen valossa. Tehtaan pari (#4a4460 / #332f44) on
     * lähinnä, ja siksi tämä on siitä viilennetty ja tummennettu — sisätila
     * kahdesti peräkkäin näyttäisi muuten samalta paikalta. */
    const base = th === 'desert' ? '#e8c070' : th === 'ice' ? '#cfe6ff'
      : th === 'factory' ? '#4a4460' : th === 'bone' ? '#5a5c50'
        : th === 'cloud' ? '#e6eefc' : th === 'fortress' ? '#3a3a4c' : '#4cb04c';
    const dark = th === 'desert' ? '#c89c48' : th === 'ice' ? '#a8c8e8'
      : th === 'factory' ? '#332f44' : th === 'bone' ? '#3e4038'
        : th === 'cloud' ? '#b6c6e4' : th === 'fortress' ? '#26263a' : '#348a34';
    ctx.fillStyle = base;
    ctx.fillRect(0, MAP_Y, VIEW_W, MAP_H);

    /*
     * Only the columns the window is over.
     *
     * Every glyph in the switch below draws inside its own 16 px tile — that is
     * checked by the scenery clearance test, which measures from the drawn
     * pixels — so the visible columns are exactly the columns the window
     * overlaps, and a column of bleed on each side is insurance rather than
     * need. Twenty columns is what this loop used to run and what it still runs
     * at scroll 0 on a 20-tile map, so a narrow world draws the same tiles in
     * the same order as before; a map twice as wide costs the same, which is
     * the point of doing this at all rather than trusting that 270 tiles is
     * cheap enough.
     */
    const cam = this.camX();
    const from = Math.max(0, Math.floor(cam / TILE) - 1);
    const to = Math.floor((cam + VIEW_W - 1) / TILE) + 1;
    ctx.save();
    ctx.translate(-cam, 0);

    for (let ty = 0; ty < this.world.terrain.length; ty++) {
      const row = this.world.terrain[ty];
      const last = Math.min(to, row.length - 1);
      for (let tx = from; tx <= last; tx++) {
        const x = tx * TILE;
        const y = MAP_Y + ty * TILE;
        const ch = row[tx];
        if (hashNoise(tx, ty) > 0.72) {
          ctx.fillStyle = dark;
          ctx.fillRect(x + Math.floor(hashNoise(ty, tx) * 10), y + 4, 4, 2);
        }
        switch (ch) {
          case '~': {
            const wave = Math.sin((tx * 0.7) + this.tick / 14) * 1.5;
            ctx.fillStyle = '#2c6cd8';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = '#6ca8f8';
            ctx.fillRect(x, y + 4 + Math.round(wave), TILE, 2);
            break;
          }
          case 'T': {
            // Everything that grows sways, each tile on its own phase, so the
            // map reads as a place with weather rather than a printed picture.
            const s1 = sway(tx, ty, 1);
            ctx.fillStyle = '#6a4018';
            ctx.fillRect(x + 7, y + 9, 3, 6);
            ctx.fillStyle = '#1f7a2a';
            ctx.fillRect(x + 3 + s1, y + 3, 11, 7);
            ctx.fillRect(x + 5 + s1, y + 1, 7, 4);
            ctx.fillStyle = '#2fa03a';
            ctx.fillRect(x + 5 + s1, y + 3, 6, 4);
            break;
          }
          case 'P': {
            const s1 = sway(tx, ty, 1);
            const s2 = sway(tx, ty, 0.5);
            ctx.fillStyle = '#6a4018';
            ctx.fillRect(x + 7, y + 11, 3, 4);
            ctx.fillStyle = '#1f6a3a';
            ctx.fillRect(x + 4 + s2, y + 8, 9, 4);
            ctx.fillRect(x + 5 + s1, y + 4, 7, 4);
            ctx.fillRect(x + 6 + s1, y + 1, 5, 4);
            if (th === 'ice') {
              ctx.fillStyle = '#f0f8ff';
              ctx.fillRect(x + 6 + s1, y + 1, 5, 2);
              ctx.fillRect(x + 5 + s1, y + 4, 7, 1);
              ctx.fillRect(x + 4 + s2, y + 8, 9, 1);
            }
            break;
          }
          case 'I': {
            // snow drifts and hairline cracks so the ice fields aren't blank
            const n = hashNoise(tx * 3, ty * 5);
            if (n > 0.78) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(x + 2, y + 10, 9, 2);
              ctx.fillRect(x + 4, y + 8, 5, 2);
            } else if (n < 0.16) {
              ctx.fillStyle = '#a8c8e8';
              ctx.fillRect(x + 3, y + 7, 6, 1);
              ctx.fillRect(x + 8, y + 8, 4, 1);
            }
            break;
          }
          case 'M':
            ctx.fillStyle = '#7a7a92';
            for (let i = 0; i < 12; i++) ctx.fillRect(x + i / 1.5, y + 15 - i, TILE - (i * 1.3), 1);
            ctx.fillStyle = '#e8e8f8';
            ctx.fillRect(x + 5, y + 3, 6, 2);
            break;
          case 'C': {
            const s1 = sway(tx, ty, 0.5);
            ctx.fillStyle = '#2f8f3a';
            ctx.fillRect(x + 6, y + 3, 4, 12);
            ctx.fillRect(x + 2 + s1, y + 7, 3, 5);
            ctx.fillRect(x + 11 + s1, y + 5, 3, 6);
            break;
          }
          case 'F': {
            // factory floor plating with rivets
            ctx.fillStyle = '#3f3a55';
            ctx.fillRect(x, y + 15, TILE, 1);
            ctx.fillRect(x + 15, y, 1, TILE);
            if (hashNoise(tx * 9, ty * 7) > 0.7) {
              ctx.fillStyle = '#6a6484';
              ctx.fillRect(x + 3, y + 3, 2, 2);
              ctx.fillRect(x + 11, y + 10, 2, 2);
            }
            break;
          }
          case 'E': {
            // machinery: the valve wheel turns, so the factory looks powered
            const spin = Math.floor(this.tick / 12) % 4;
            ctx.fillStyle = '#2f2b40';
            ctx.fillRect(x + 2, y + 3, 12, 12);
            ctx.fillStyle = '#7a7498';
            ctx.fillRect(x + 3, y + 4, 10, 10);
            ctx.fillStyle = '#c05820';
            ctx.fillRect(x + 6, y + 1, 4, 4);
            ctx.fillStyle = '#2f2b40';
            if (spin % 2 === 0) {
              ctx.fillRect(x + 5, y + 7, 6, 1);
              ctx.fillRect(x + 7, y + 5, 1, 6);
            } else {
              ctx.fillRect(x + 5, y + 5, 2, 2);
              ctx.fillRect(x + 9, y + 9, 2, 2);
              ctx.fillRect(x + 9, y + 5, 2, 2);
              ctx.fillRect(x + 5, y + 9, 2, 2);
            }
            break;
          }
          case 'S': {
            const n = hashNoise(tx * 5, ty * 3);
            if (n > 0.8) {
              ctx.fillStyle = '#c89c48';
              ctx.fillRect(x + 2, y + 9, 7, 1);
              ctx.fillRect(x + 6, y + 12, 6, 1);
            }
            break;
          }
          case 'R':
            ctx.fillStyle = '#8a8a9a';
            ctx.fillRect(x + 3, y + 8, 10, 6);
            ctx.fillStyle = '#b0b0c0';
            ctx.fillRect(x + 4, y + 8, 6, 3);
            break;
          case 'b': {
            // Paljasta luumaata: murtuneita palasia sinne tänne, ei kuviota.
            // Tämä on tasainen merkki, eli se kuuluu tien alle — mitään mikä
            // nousisi ruudun keskiriveille ei tähän saa piirtää.
            const n = hashNoise(tx * 7, ty * 11);
            if (n > 0.74) {
              ctx.fillStyle = '#8e9080';
              ctx.fillRect(x + 3, y + 11, 5, 2);
              ctx.fillRect(x + 9, y + 13, 3, 1);
            } else if (n < 0.2) {
              ctx.fillStyle = '#3e4038';
              ctx.fillRect(x + 5, y + 12, 6, 1);
            }
            break;
          }
          case 'K': {
            /* Kallo, luulaakson oma kalusto. Piirretty y+4..y+14, eli se osuu
             * polun pisteen musteeseen (y+5..y+10) täsmälleen kuten puu ja
             * vuori — siksi se on `TALL_TERRAIN`issa eikä siksi että se on
             * korkea. Leuka nyökkää hitaasti: kaikki mikä elää tässä pelissä
             * liikkuu, ja tämä on kuollut, joten se liikkuu vähemmän. */
            const nod = Math.round((Math.sin(this.tick / 30 + tx * 0.9) + 1) / 2);
            ctx.fillStyle = '#ded6c0';
            ctx.fillRect(x + 4, y + 4, 8, 7);
            ctx.fillRect(x + 5, y + 11 + nod, 6, 2);
            ctx.fillStyle = '#2a2820';
            ctx.fillRect(x + 6, y + 6, 2, 3);
            ctx.fillRect(x + 9, y + 6, 2, 3);
            ctx.fillRect(x + 8, y + 9, 1, 2);
            ctx.fillStyle = '#8e8878';
            ctx.fillRect(x + 4, y + 10, 8, 1);
            ctx.fillRect(x + 6, y + 13 + nod, 4, 1);
            break;
          }
          case 'c': {
            // Pilvipintaa. Tasainen merkki, eli se kuuluu tien alle: pyöreitä
            // kuhmuja ja niiden alle sinertävä varjo, ei mitään joka nousisi
            // ruudun keskiriveille missä polun piste on.
            const n = hashNoise(tx * 7, ty * 3);
            if (n > 0.62) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(x + 3, y + 10, 8, 3);
              ctx.fillRect(x + 5, y + 9, 4, 1);
              ctx.fillStyle = '#c2d0ea';
              ctx.fillRect(x + 3, y + 13, 8, 1);
            } else if (n < 0.22) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(x + 8, y + 12, 5, 2);
            }
            break;
          }
          case 'i': {
            /* Repeämä pilvessä, ja kartan puolisko siitä väitteestä jonka
             * kentät tekevät lattiallaan: tämä maailma on jonkin *päällä*.
             * Aukosta näkyy peltoa ja metsää liian kaukaa erottuakseen
             * miksikään — jos siitä tunnistaisi pellon, se olisi maisema; kun
             * siitä ei tunnista mitään, se on korkeus. Tasainen merkki, joten
             * se ei ole `TALL_TERRAIN`issa eikä tarvitse tilaa tien vierestä. */
            ctx.fillStyle = '#5c7a4c';
            ctx.fillRect(x + 3, y + 7, 10, 7);
            ctx.fillStyle = '#7a6a44';
            ctx.fillRect(x + 4, y + 9, 4, 2);
            ctx.fillRect(x + 9, y + 11, 3, 2);
            ctx.fillStyle = '#46603c';
            ctx.fillRect(x + 3, y + 13, 10, 1);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x + 1, y + 6, 13, 2);
            ctx.fillRect(x + 2, y + 14, 12, 2);
            break;
          }
          case 'U': {
            /* Ukkospää. Piirretään y+1..y+13, eli se osuu polun pisteen
             * musteeseen (y+5..y+10) kuten puu ja kallo — siksi se on
             * `TALL_TERRAIN`issa. Pohja on leveä, laki on alasin, ja alin
             * kerros on tummin: ukkospilvi on ainoa pilvi jonka silmä lukee
             * uhkana, ja se lukee sen pohjan väristä. */
            const drift = Math.round(Math.sin(this.tick / 40 + tx * 0.7) * 1);
            ctx.fillStyle = '#f4f8ff';
            ctx.fillRect(x + 2 + drift, y + 1, 12, 3);
            ctx.fillStyle = '#c8d4ec';
            ctx.fillRect(x + 4 + drift, y + 4, 8, 4);
            ctx.fillStyle = '#8e9cc0';
            ctx.fillRect(x + 3, y + 8, 10, 4);
            ctx.fillStyle = '#5c6890';
            ctx.fillRect(x + 4, y + 12, 8, 1);
            if (Math.floor(this.tick / 9 + tx * 3) % 24 === 0) {
              ctx.fillStyle = '#fff4a0';
              ctx.fillRect(x + 7, y + 12, 1, 3);
            }
            break;
          }
          case '"': {
            const s1 = sway(tx, ty, 1);
            ctx.fillStyle = '#2a8a30';
            ctx.fillRect(x + 3, y + 9, 10, 5);
            ctx.fillRect(x + 5 + s1, y + 6, 6, 4);
            break;
          }
          case 'w': {
            /* Kivilattia: sauma alas ja oikealle, sama tapa kuin tehtaan
             * pellillä. Litteä glyfi eikä `TALL_TERRAIN`issa, joten se menee
             * tien alle kuten kaikki muukin maan pinta. Laatta on limitetty
             * joka toisella rivillä — suora ruudukko lukisi taustapaperina, ja
             * kivi ladotaan limiin siksi ettei sauma jatku. */
            ctx.fillStyle = '#2e2e40';
            ctx.fillRect(x, y + 15, TILE, 1);
            ctx.fillRect(x + (ty % 2 ? 7 : 15), y, 1, TILE);
            if (hashNoise(tx * 7, ty * 11) > 0.78) {
              ctx.fillStyle = '#4a4a5e';
              ctx.fillRect(x + 4, y + 6, 3, 1);
              ctx.fillRect(x + 9, y + 11, 2, 1);
            }
            break;
          }
          case 'A': {
            /* Rintavarustus, y+2..y+14 — eli se osuu tien pisteen musteeseen
             * (y+5..y+10) kuten puu, kallo ja ukkospää, ja on siksi
             * `TALL_TERRAIN`issa.
             *
             * Soihtu palaa aukossa, ja se on kaksi framea eikä sykkivä hehku:
             * kartan muut liikkeet ovat huojuntaa (puut, pilvet, vesi), joten
             * välkkyvä piste erottuu niistä liikelajina eikä vain värinä. Se on
             * myös ainoa lämmin väri koko kartalla — kylmä kivi ja yksi tuli
             * lukee linnakkeena ilman että mitään tarvitsee kirjoittaa. */
            ctx.fillStyle = '#20202e';
            ctx.fillRect(x + 2, y + 5, 12, 9);
            ctx.fillStyle = '#585870';
            ctx.fillRect(x + 3, y + 6, 10, 7);
            ctx.fillStyle = '#20202e';
            ctx.fillRect(x + 2, y + 2, 2, 3);
            ctx.fillRect(x + 7, y + 2, 2, 3);
            ctx.fillRect(x + 12, y + 2, 2, 3);
            ctx.fillStyle = '#6e6e88';
            ctx.fillRect(x + 2, y + 2, 2, 1);
            ctx.fillRect(x + 7, y + 2, 2, 1);
            ctx.fillRect(x + 12, y + 2, 2, 1);
            const lit = Math.floor(this.tick / 7 + tx * 2 + ty) % 2;
            ctx.fillStyle = lit ? '#ffcc50' : '#e08020';
            ctx.fillRect(x + 7, y + 8, 2, 2 + lit);
            break;
          }
          default:
            break;
        }
      }
    }
    ctx.restore();
  }

  /**
   * Five bars, `n` of them lit. The difficulty display, everywhere it appears:
   * under a level node, on the fork's route board, and nowhere else.
   *
   * Drawn rather than typed. The 5x7 font is missing glyphs (`&` is the one
   * that got caught), and a missing glyph does not throw — it leaves a hole and
   * advances the cursor anyway, so a text pip could pass every width test and
   * still render as nothing. `*` was the other candidate and it is spoken for:
   * on the high-score table it means "save state used".
   *
   * The pitch used to be 3 — two pixels of pip and one of air — and at that
   * spacing five pips read as one striped block rather than five things you can
   * count, which is the whole job. It is 4 now: the same 2 px pip with 2 px of
   * air, 18 px of bar instead of 14. `x, y` is the top-left of the pips
   * themselves; the dark rim is drawn one pixel outside them.
   */
  drawPips(ctx, x, y, n) {
    ctx.fillStyle = 'rgba(16,14,20,0.85)';
    ctx.fillRect(x - PIP_PAD, y - PIP_PAD, PIP_BAR_W + PIP_PAD * 2, 3 + PIP_PAD * 2);
    for (let i = 0; i < PIPS; i++) {
      ctx.fillStyle = i < n ? TIER_COLORS[n] : PIP_OFF;
      ctx.fillRect(x + i * PIP_PITCH, y, PIP_W, 3);
    }
  }

  /** `{ found, total }` for a node that is a level, or null for the rest. */
  secretsAt(node) {
    return node.level ? secretTally(this.game.state, node.level) : null;
  }

  /**
   * A three-pixel sparkle saying "something is hidden in here" — and, once it
   * turns green, "not any more". It never says where, and it cannot: it is
   * drawn from two counts, and the pixel test in `verify.mjs` holds it to that.
   *
   * Why a sparkle and not a second row of bars: the bars under every node are
   * the difficulty, and two bar readings in one 16 px cell would be read as one
   * (DESIGN.md §8 — two signals that look alike teach the player to read the
   * wrong one). The exact count is spelled out in words in the panel instead,
   * the same two-channel split the branch already uses.
   *
   * It sits in the plaque's left gutter, and that gutter is why the plaque now
   * fills the whole tile width. The mark is 3 px, the number is 5, and each of
   * them wants 2 px of air on both sides: 2 + 3 + 2 + 5 + 2 = 14 of interior,
   * which needs a 16 px plaque once the border is on. In the old 12 px plaque
   * the mark's last column and the number's first were neighbours — the reader
   * saw one four-pixel-wide smudge, and a signal you cannot separate from the
   * one next to it is the DESIGN.md 8 mistake made in pixels instead of sound.
   */
  drawSecretMark(ctx, x, y, tally, dark) {
    if (!tally || tally.total === 0) return;
    const done = tally.found >= tally.total;
    ctx.fillStyle = (done ? SECRET_DONE : SECRET_LEFT)[dark ? 1 : 0];
    ctx.fillRect(x + 4, y + 0, 1, 3);
    ctx.fillRect(x + 3, y + 1, 3, 1);
  }

  /** The prize on a rewarded route, marked on the path itself. */
  drawRewardMark(ctx, cx, cy) {
    ctx.fillStyle = 'rgba(24,20,16,0.8)';
    ctx.fillRect(cx - 4, cy - 4, 9, 9);
    ctx.fillStyle = '#ffd048';
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - 3 + i, cy - 3 + Math.abs(i - 3), 1, 7 - 2 * Math.abs(i - 3));
    for (let i = 0; i < 3; i++) ctx.fillRect(cx + 1 + i, cy - 1 + i, 1, 5 - 2 * i);
    ctx.fillStyle = '#fff8d0';
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }

  /** Total length of a pixel polyline. */
  static polyLength(line) {
    let total = 0;
    for (let i = 0; i < line.length - 1; i++) {
      total += Math.hypot(line[i + 1].x - line[i].x, line[i + 1].y - line[i].y);
    }
    return total;
  }

  /** Point `d` PIXELS along a polyline from its first end. */
  static pointAlong(line, d) {
    let left = d;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (left <= len || i === line.length - 2) {
        const t = len ? Math.min(1, left / len) : 0;
        return { x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) };
      }
      left -= len;
    }
    return { x: line[0].x, y: line[0].y };
  }

  /**
   * Is any of this on screen? `span` is a pair of map-x pixels.
   *
   * Everything the map draws is culled through this one predicate rather than
   * each drawer inventing its own margin, because a cull is a claim about where
   * a thing is drawn and two claims that drift apart is how something vanishes
   * a frame before it leaves the window. Half a tile of slack on each side is
   * there so the callers may pass tile edges and let this worry about the ink
   * that hangs over them.
   */
  onView(x0, x1) {
    const cam = this.camX();
    return x1 >= cam - TILE / 2 && x0 <= cam + VIEW_W + TILE / 2;
  }

  /**
   * The map-x range a link's drawing can occupy: the tiles it passes through,
   * plus the bend that may push it sideways and the dark rim every dot carries.
   *
   * Measured from `linkPoints` and not from `linkCurve`, so the question can be
   * asked before the curve is built — the curve is the expensive half and the
   * point of asking is to not build it. That is safe because the bend is capped
   * at BEND_MAX by construction (see `linkCurve`), which is the same reason
   * rule 8 can reason about a road in whole tiles.
   */
  linkSpan(link) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of linkPoints(this.world, link)) {
      lo = Math.min(lo, p.tx * TILE + 8);
      hi = Math.max(hi, p.tx * TILE + 8);
    }
    return [lo - BEND_MAX - 3, hi + BEND_MAX + 3];
  }

  drawLinks(ctx) {
    ctx.save();
    ctx.translate(-this.camX(), 0);
    for (const link of this.world.links) {
      const span = this.linkSpan(link);
      if (!this.onView(span[0], span[1])) continue;
      const open = this.isLinkOpen(link);
      const route = this.routeLinks.get(link);
      const lit = route ? TIER_COLORS[route.pips] : '#ffd048';
      const shade = route ? TIER_SHADE[route.pips] : '#c07c20';
      /*
       * Dots spaced along the WHOLE road rather than restarted at every corner.
       *
       * The bend subdivides each straight run into thirds, and the old loop
       * counted its steps per segment: a third of a two-tile hop is eleven
       * pixels, `round(11/8)` is 1, and a loop that runs from 1 to below 1
       * draws nothing at all. Measuring the road once and stepping along it by
       * arc length also spaces the dots evenly through the curve, which is the
       * thing that makes a bend read as a road and not as a dotted corner.
       */
      const line = linkCurve(this.world, link);
      const total = WorldMapScene.polyLength(line);
      const steps = Math.max(2, Math.round(total / 8));
      for (let s = 1; s < steps; s++) {
        const at = WorldMapScene.pointAlong(line, (total * s) / steps);
        const x = at.x;
        const y = MAP_Y + at.y;
        /* Outline first, then the dot.
         *
         * Without it the ice world was unreadable: the open path is #f8e0a0
         * and the ice terrain is #cfe6ff, whose luminances are 225 and 227.
         * Two levels out of 255 is not a colour difference, it is the same
         * colour. Picking a different gold would only move the problem to
         * whichever theme it collided with next, so the dot carries its own
         * dark edge and stops depending on what is behind it. */
        ctx.fillStyle = 'rgba(24,20,16,0.72)';
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.fillStyle = open ? lit : '#6a6a86';
        ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = open ? shade : '#3a3a50';
        ctx.fillRect(x - 2, y + 1, 4, 1);
      }
    }

    /* The prize, marked where the two roads part rather than at the end of the
     * one that pays it. A reward the player only meets after committing is not
     * a choice, it is a surprise — ROADMAP condition 2. */
    for (const route of new Set(this.routeLinks.values())) {
      if (!route.reward || !route.links[0]) continue;
      const span = this.linkSpan(route.links[0]);
      if (!this.onView(span[0], span[1])) continue;
      const curve = linkCurve(this.world, route.links[0]);
      const line = route.links[0].b === route.via[0] ? curve : [...curve].reverse();
      const at = WorldMapScene.pointAlong(line, 1.5 * TILE);
      this.drawRewardMark(ctx, at.x, MAP_Y + at.y);
    }
    ctx.restore();
  }

  drawNodes(ctx) {
    ctx.save();
    ctx.translate(-this.camX(), 0);
    for (const node of this.world.nodes) {
      const x = node.tx * TILE;
      /* The stamp starts one pixel left of the tile and ends three past it —
       * see STAMP_BLEED — and `onView` adds half a tile on top of that. */
      if (!this.onView(x - 1, x + TILE + STAMP_BLEED)) continue;
      const y = MAP_Y + node.ty * TILE;
      const cleared = this.isCleared(node.id);
      /* The bar used to be squeezed inside the same 16 px cell as the plaque,
       * on the grounds that a bar which overflowed would land on neighbouring
       * terrain or on another node's bar. That was the right worry and the
       * wrong conclusion: it was never measured, and measuring it says the
       * closest two nodes on any map are 32 px apart, so a 20 px stamp still
       * leaves 12 px of map between them. See the layout note at the top of the
       * file for the rest of the bill. */
      const pips = nodePips(node);
      const secrets = this.secretsAt(node);
      switch (node.type) {
        case 'start':
          ctx.fillStyle = '#c8c8d8';
          ctx.fillRect(x + 7, y + 2, 2, 12);
          ctx.fillStyle = '#e04040';
          ctx.fillRect(x + 9, y + 3, 6, 4);
          break;
        case 'fortress':
          ctx.fillStyle = '#8a8aa0';
          ctx.fillRect(x + 1, y + 2, 14, 9);
          ctx.fillStyle = '#6a6a84';
          ctx.fillRect(x + 1, y + 1, 3, 2);
          ctx.fillRect(x + 7, y + 0, 3, 3);
          ctx.fillRect(x + 12, y + 1, 3, 2);
          /* The gate lost a pixel off its left jamb so the secrets mark could
           * have the same 2 px of air the level plaque gives it. A five-wide
           * door with the mark beside it left one pixel between them, and the
           * two read as a single blot on the wall. */
          ctx.fillStyle = '#301818';
          ctx.fillRect(x + 7, y + 6, 4, 5);
          if (cleared) {
            ctx.fillStyle = '#8fe04a';
            ctx.fillRect(x + 7, y + 8, 4, 2);
          }
          this.drawSecretMark(ctx, x - 1, y + 3, secrets, true);
          this.drawPips(ctx, x - 1, y + PIP_TOP, pips);
          break;
        case 'house':
          ctx.fillStyle = cleared ? '#9a6a6a' : '#e04040';
          ctx.fillRect(x + 1, y + 3, 14, 7);
          ctx.fillStyle = '#f8f8f8';
          ctx.fillRect(x + 3, y + 4, 3, 3);
          ctx.fillRect(x + 10, y + 5, 3, 3);
          ctx.fillStyle = '#f0d8b0';
          ctx.fillRect(x + 3, y + 10, 10, 5);
          ctx.fillStyle = '#6a4018';
          ctx.fillRect(x + 6, y + 11, 4, 4);
          break;
        default: {
          /* Plaque, mark, number, bar — top to bottom, and every seam between
           * them is two pixels wide. The interior runs x+1..x+14 and y-1..y+9;
           * the mark takes x+3..x+5, the 5x7 number x+8..x+12, and both keep
           * two rows of air above and below inside the border. */
          const py = y + PLAQUE_TOP;
          ctx.fillStyle = cleared ? '#404060' : '#f8f8f8';
          ctx.fillRect(x, py, PLAQUE_W, PLAQUE_H);
          ctx.fillStyle = '#202038';
          ctx.fillRect(x, py, PLAQUE_W, 1);
          ctx.fillRect(x, py + PLAQUE_H - 1, PLAQUE_W, 1);
          ctx.fillRect(x, py, 1, PLAQUE_H);
          ctx.fillRect(x + PLAQUE_W - 1, py, 1, PLAQUE_H);
          const label = node.level ? node.level.split('-')[1] : '?';
          drawText(ctx, label, x + 10, y + 1, {
            color: cleared ? '#8fe04a' : '#202038', align: 'center',
          });
          this.drawSecretMark(ctx, x, y + 1, secrets, cleared);
          this.drawPips(ctx, x - 1, y + PIP_TOP, pips);
          break;
        }
      }
    }
    ctx.restore();
  }

  drawToken(ctx) {
    const bob = this.mode === 'idle' ? Math.round(Math.sin(this.tick / 12) * 1) : 0;
    const power = normalizePower(this.game.state.power);
    /* 10 and not 12: this was hand-fitted back when the smallest sprite drew
     * three pixels below its own hitbox, so the constant was quietly paying for
     * that bug. The art was shrunk to the box (v26.08.09.18) and the token rose
     * with it — 10 puts its feet back level with every other power level's. */
    const lift = power.level === 0 ? 10 : 16 + power.level * 4;

    /*
     * The map used to pass no `idle` count at all, so `idlePose` never got past
     * its "standing about for a few seconds" gate and the token did the same two
     * frames forever. Feeding it the counter reuses every idle beat the levels
     * already have — looking around, scratching, tapping a foot — for free, and
     * passing the theme brings the weather with it: he shivers on the ice map.
     */
    if (this.mode === 'walk') this.standing = 0;
    else this.standing = (this.standing || 0) + 1;

    /* Turning to look behind him. The sprite has no back view, so the turn is
     * the flip itself — brief, and only while standing, which is exactly how it
     * reads: a glance over the shoulder rather than a change of mind. */
    const glance = this.standing > 260 && (this.standing % 420) > 300
      && (this.standing % 420) < 360;

    /* The pawn is drawn in map pixels like everything else on the map, so the
     * camera reaches it the same way — and so the two things that move at once
     * while it walks a bend, the pawn and the window, cannot disagree about
     * where the road is. `this.pos.x` stays fractional; the translate is whole,
     * so the sprite lands exactly where it did before the camera existed. */
    ctx.save();
    ctx.translate(-this.camX(), 0);
    drawPlayer(ctx, this.pos.x - 6, MAP_Y + this.pos.y - lift + bob, {
      type: power.type,
      level: power.level,
      facing: glance ? -1 : 1,
      frame: Math.floor(this.tick / 8) % 3,
      state: this.mode === 'walk' ? 'walk' : 'idle',
      ducking: false,
      running: false,
      tick: this.tick,
      idle: this.mode === 'walk' ? 0 : this.standing,
      theme: this.world.theme,
      wag: this.tick / 20,
    });
    ctx.restore();
  }

  drawTitleBar(ctx) {
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, 0, 320, MAP_Y);
    drawText(ctx, `MAAILMA ${this.game.state.world + 1}  ${this.world.name}`, 6, 3, {
      color: '#8fe04a',
    });
    drawText(ctx, padNum(this.game.state.score, 7), 314, 3, { color: '#ffffff', align: 'right' });
    /* Tila näkyy siinä ruudussa jossa kenttä valitaan, koska sieltä siihen
     * mennään. Paikka on mitattu eikä arvattu: pisin maailmannimi on
     * `MAAILMA 8  VIIMEINEN LINNAKE` eli 28 merkkiä = 167 px kuudesta
     * alkaen, ja pisteet vievät oikean reunan 273:sta. Kahdeksan merkkiä
     * oikeaan reunustettuna 268:aan mahtuu väliin 48 pikselin marginaalilla. */
    if (this.game.timeAttack) {
      drawText(ctx, MODE_NAME, 268, 3, { color: SPLIT_COLORS.ahead, align: 'right' });
    }
  }

  drawPanel(ctx) {
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, PANEL_Y, 320, 240 - PANEL_Y);
    ctx.fillStyle = '#3a3a52';
    ctx.fillRect(0, PANEL_Y, 320, 1);

    // node plaque
    ctx.fillStyle = '#202038';
    ctx.fillRect(8, PANEL_Y + 8, 190, 20);
    drawText(ctx, this.node.name, 14, PANEL_Y + 14, { color: '#ffffff' });

    // reserve box
    ctx.fillStyle = '#202038';
    ctx.fillRect(286, PANEL_Y + 6, 24, 24);
    ctx.fillStyle = '#50506e';
    ctx.fillRect(286, PANEL_Y + 6, 24, 1);
    ctx.fillRect(286, PANEL_Y + 29, 24, 1);
    ctx.fillRect(286, PANEL_Y + 6, 1, 24);
    ctx.fillRect(309, PANEL_Y + 6, 1, 24);
    if (this.game.state.reserve) drawItem(ctx, this.game.state.reserve, 290, PANEL_Y + 10, this.tick);

    drawText(ctx, `KV *${this.game.state.lives}`, 208, PANEL_Y + 10, { color: '#ffffff' });
    drawText(ctx, `KOLIKOT ${padNum(this.game.state.coins, 2)}`, 208, PANEL_Y + 20, { color: '#ffd048' });
    this.drawSecretCount(ctx);

    const branch = this.branchHere();
    const hint = this.messageTimer > 0 && this.message
      ? this.message
      : 'NUOLET LIIKU   Z ALOITA   ENTER KAYTA ESINE';
    drawText(ctx, hint, 160, PANEL_Y + (branch ? 68 : 40), {
      color: this.messageTimer > 0 ? '#ffd048' : '#8890b0',
      align: 'center',
    });

    if (branch) {
      this.drawRouteBoard(ctx, branch);
      return;
    }

    const cleared = this.world.nodes.filter((n) => n.level && this.isCleared(n.id)).length;
    const total = this.world.nodes.filter((n) => n.level).length;
    drawText(ctx, `SELVITETTY ${cleared}/${total}`, 160, PANEL_Y + 54, { color: '#8890b0', align: 'center' });
  }

  /**
   * The number, in words, for the level the player is standing on.
   *
   * "EI SALAISUUKSIA" is spelled out rather than left blank, for the reason the
   * route board spells out "EI PALKINTOA": a blank line reads as "not known
   * yet", and this is known. It is also the difference the player most needs —
   * between a level with nothing in it and a level with three things in it and
   * none of them found — and that difference must not be one character wide.
   *
   * The counts are all it says. It never names a secret and never says where
   * one is, because that is the only mystery this game has, and a map that
   * answers it has ended it.
   *
   * Under the coin line, below the reserve box, at a row that survives the
   * branch board too — the fork in world 2 is a level with six secrets in it,
   * so this is exactly the node where the readout must not vanish.
   */
  drawSecretCount(ctx) {
    const tally = this.secretsAt(this.node);
    if (!tally) return;
    const done = tally.total > 0 && tally.found >= tally.total;
    drawText(ctx,
      tally.total === 0 ? 'EI SALAISUUKSIA' : `SALAISUUDET ${tally.found}/${tally.total}`,
      208, PANEL_Y + 30,
      { color: tally.total === 0 ? '#5a5a76' : (done ? '#8fe04a' : '#ffd048') });
  }

  /**
   * Both roads, side by side, while the player is still standing on the fork.
   *
   * This is the whole point of the branch: a route you learn about by dying on
   * it is not a choice. So the board is not a hint that fades — it is on screen
   * for as long as the player stands where the roads part, and it says three
   * things per route in three different channels: a name, a bar count, and what
   * it pays. "EI PALKINTOA" is spelled out rather than left blank, because a
   * blank reads as "not known yet" and this is known.
   */
  drawRouteBoard(ctx, branch) {
    drawText(ctx, 'HAARA - VALITSE REITTI', 10, PANEL_Y + 32, { color: '#8890b0' });
    const order = [...branch.routes].sort((a, b) => a.score - b.score);
    /* The columns moved right with the bar: 18 px of pips instead of 14 means
     * the prize mark and its label have to start four pixels later, or the mark
     * lands on the fifth pip. 'MURTAVA VOIMA' is 77 px wide, so from 152 it
     * still finishes at 229 with ninety pixels of panel to spare. */
    order.forEach((route, i) => {
      const y = PANEL_Y + 44 + i * 12;
      drawText(ctx, route.name, 14, y, { color: TIER_COLORS[route.pips] });
      this.drawPips(ctx, 118, y + 2, route.pips);
      const prize = route.reward ? (REWARDS[route.reward] || {}).label : 'EI PALKINTOA';
      drawText(ctx, prize, 152, y, { color: route.reward ? '#ffd048' : '#5a5a76' });
      if (route.reward) this.drawRewardMark(ctx, 144, y + 3);
    });
  }

  drawHouse(ctx) {
    ctx.fillStyle = 'rgba(8,8,16,0.82)';
    ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = '#202038';
    ctx.fillRect(50, 66, 220, 96);
    ctx.fillStyle = '#50506e';
    ctx.fillRect(50, 66, 220, 1);
    ctx.fillRect(50, 161, 220, 1);
    drawText(ctx, 'HERNETALO', 160, 76, { color: '#8fe04a', align: 'center' });
    drawText(ctx, 'VALITSE YKSI', 160, 88, { color: '#ffffff', align: 'center' });

    HOUSE_ITEMS.forEach((item, i) => {
      const x = 72 + i * 46;
      const selected = i === this.houseCursor;
      ctx.fillStyle = selected ? '#f8f8f8' : '#3a3a52';
      ctx.fillRect(x - 4, 104, 26, 26);
      ctx.fillStyle = '#101018';
      ctx.fillRect(x - 2, 106, 22, 22);
      drawItem(ctx, item, x + 1, 108, this.tick);
      if (selected && Math.floor(this.tick / 8) % 2) {
        drawText(ctx, '*', x + 8, 134, { color: '#ffd048', align: 'center' });
      }
    });
    drawText(ctx, 'Z VALITSE', 160, 146, { color: '#8890b0', align: 'center' });
  }

  drawBanner(ctx) {
    ctx.fillStyle = 'rgba(8,8,16,0.72)';
    ctx.fillRect(0, 88, 320, 56);
    drawText(ctx, `MAAILMA ${this.game.state.world + 1}`, 160, 100, {
      color: '#ffffff', align: 'center', shadow: '#202030',
    });
    drawText(ctx, this.world.name, 160, 118, { color: '#8fe04a', align: 'center', shadow: '#202030' });
  }
}
