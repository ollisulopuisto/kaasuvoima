import {
  WORLDS, findNode, startNode, linkPoints, routeByLink, branchAt, nodePips, PIPS, REWARDS,
} from '../data/worlds.js';
import { drawText } from '../gfx/font.js';
import { drawItem, drawPlayer } from '../gfx/sprites.js';
import { Music, Sfx } from '../core/audio.js';
import { hashNoise, padNum } from '../core/utils.js';
import { normalizePower, powerAfterItem, POWER_NAMES } from '../entities/player.js';
import { secretTally } from '../core/secrets.js';

const TILE = 16;
const MAP_Y = 14;
const MAP_H = 144;
const PANEL_Y = MAP_Y + MAP_H;
const WALK_SPEED = 1.4;

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
const TIER_COLORS = ['#8890b0', '#6ad04a', '#c8e048', '#ffd048', '#f09030', '#e05038'];
const TIER_SHADE = ['#3a3a50', '#2f7a24', '#7a8420', '#c07c20', '#8a4c14', '#7a2418'];
const PIP_OFF = '#3a3a52';

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

  update(input) {
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
      const path = forward ? pts : [...pts].reverse();
      const dx = Math.sign(path[1].tx - path[0].tx);
      const dy = Math.sign(path[1].ty - path[0].ty);
      if (dx !== wanted[0] || dy !== wanted[1]) continue;
      if (!this.isLinkOpen(link)) {
        Sfx.play('bump');
        this.showMessage('POLKU ON SULJETTU');
        return;
      }
      this.walk = { path, index: 0 };
      this.mode = 'walk';
      this.targetNode = findNode(this.world, forward ? link.b : link.a);
      Sfx.play('cursor');
      return;
    }
  }

  updateWalk() {
    const next = this.walk.path[this.walk.index + 1];
    const tx = next.tx * TILE + 8;
    const ty = next.ty * TILE + 8;
    const dx = tx - this.pos.x;
    const dy = ty - this.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= WALK_SPEED) {
      this.pos.x = tx;
      this.pos.y = ty;
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
      Sfx.play('powerup');
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

  /** Clouds and birds drifting over the map, on top of the terrain. */
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
    const base = th === 'desert' ? '#e8c070' : th === 'ice' ? '#cfe6ff'
      : th === 'factory' ? '#4a4460' : '#4cb04c';
    const dark = th === 'desert' ? '#c89c48' : th === 'ice' ? '#a8c8e8'
      : th === 'factory' ? '#332f44' : '#348a34';
    ctx.fillStyle = base;
    ctx.fillRect(0, MAP_Y, 320, MAP_H);

    for (let ty = 0; ty < this.world.terrain.length; ty++) {
      const row = this.world.terrain[ty];
      for (let tx = 0; tx < row.length; tx++) {
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
          case '"': {
            const s1 = sway(tx, ty, 1);
            ctx.fillStyle = '#2a8a30';
            ctx.fillRect(x + 3, y + 9, 10, 5);
            ctx.fillRect(x + 5 + s1, y + 6, 6, 4);
            break;
          }
          default:
            break;
        }
      }
    }
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
   */
  drawPips(ctx, x, y, n) {
    ctx.fillStyle = 'rgba(16,14,20,0.85)';
    ctx.fillRect(x - 1, y - 1, PIPS * 3, 5);
    for (let i = 0; i < PIPS; i++) {
      ctx.fillStyle = i < n ? TIER_COLORS[n] : PIP_OFF;
      ctx.fillRect(x + i * 3, y, 2, 3);
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
   * It sits in the plaque's top-left corner, x+3..x+5. That is not decoration:
   * the label glyph starts at x+6 and the plaque border is x+2, so this is the
   * only 3x3 hole in the cell that the difficulty bar (y+11 down) and the level
   * number do not already own.
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

  /** Point `d` tiles along a link's polyline from its `a` end. */
  static pointAlong(pts, d) {
    let left = d * TILE;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].tx * TILE + 8;
      const ay = pts[i].ty * TILE + 8;
      const bx = pts[i + 1].tx * TILE + 8;
      const by = pts[i + 1].ty * TILE + 8;
      const len = Math.hypot(bx - ax, by - ay);
      if (left <= len || i === pts.length - 2) {
        const t = len ? Math.min(1, left / len) : 0;
        return { x: Math.round(ax + (bx - ax) * t), y: Math.round(ay + (by - ay) * t) };
      }
      left -= len;
    }
    return { x: pts[0].tx * TILE + 8, y: pts[0].ty * TILE + 8 };
  }

  drawLinks(ctx) {
    for (const link of this.world.links) {
      const open = this.isLinkOpen(link);
      const route = this.routeLinks.get(link);
      const lit = route ? TIER_COLORS[route.pips] : '#ffd048';
      const shade = route ? TIER_SHADE[route.pips] : '#c07c20';
      const pts = linkPoints(this.world, link);
      for (let i = 0; i < pts.length - 1; i++) {
        const ax = pts[i].tx * TILE + 8;
        const ay = MAP_Y + pts[i].ty * TILE + 8;
        const bx = pts[i + 1].tx * TILE + 8;
        const by = MAP_Y + pts[i + 1].ty * TILE + 8;
        const steps = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 8));
        for (let s = 1; s < steps; s++) {
          const x = Math.round(ax + ((bx - ax) * s) / steps);
          const y = Math.round(ay + ((by - ay) * s) / steps);
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
    }

    /* The prize, marked where the two roads part rather than at the end of the
     * one that pays it. A reward the player only meets after committing is not
     * a choice, it is a surprise — ROADMAP condition 2. */
    for (const route of new Set(this.routeLinks.values())) {
      if (!route.reward || !route.links[0]) continue;
      const pts = linkPoints(this.world, route.links[0]);
      const line = route.links[0].b === route.via[0] ? pts : [...pts].reverse();
      const at = WorldMapScene.pointAlong(line, 1.5);
      this.drawRewardMark(ctx, at.x, MAP_Y + at.y);
    }
  }

  drawNodes(ctx) {
    for (const node of this.world.nodes) {
      const x = node.tx * TILE;
      const y = MAP_Y + node.ty * TILE;
      const cleared = this.isCleared(node.id);
      /* Levels and fortresses were drawn two pixels lower and two taller. They
       * lost those pixels to the difficulty bar, which lives inside the same
       * 16 px cell rather than spilling onto the tile below — nodes sit as
       * close as three tiles apart and a bar that overflowed would land on the
       * neighbouring terrain, or on another node's bar. */
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
          ctx.fillStyle = '#301818';
          ctx.fillRect(x + 6, y + 6, 5, 5);
          if (cleared) {
            ctx.fillStyle = '#8fe04a';
            ctx.fillRect(x + 6, y + 8, 5, 2);
          }
          this.drawSecretMark(ctx, x, y + 3, secrets, true);
          this.drawPips(ctx, x + 1, y + 12, pips);
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
          ctx.fillStyle = cleared ? '#404060' : '#f8f8f8';
          ctx.fillRect(x + 2, y + 1, 12, 10);
          ctx.fillStyle = '#202038';
          ctx.fillRect(x + 2, y + 1, 12, 1);
          ctx.fillRect(x + 2, y + 10, 12, 1);
          ctx.fillRect(x + 2, y + 1, 1, 10);
          ctx.fillRect(x + 13, y + 1, 1, 10);
          const label = node.level ? node.level.split('-')[1] : '?';
          drawText(ctx, label, x + 8, y + 3, {
            color: cleared ? '#8fe04a' : '#202038', align: 'center',
          });
          this.drawSecretMark(ctx, x, y + 2, secrets, cleared);
          this.drawPips(ctx, x + 1, y + 12, pips);
          break;
        }
      }
    }
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
  }

  drawTitleBar(ctx) {
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, 0, 320, MAP_Y);
    drawText(ctx, `MAAILMA ${this.game.state.world + 1}  ${this.world.name}`, 6, 3, {
      color: '#8fe04a',
    });
    drawText(ctx, padNum(this.game.state.score, 7), 314, 3, { color: '#ffffff', align: 'right' });
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

    drawText(ctx, `SFB *${this.game.state.lives}`, 208, PANEL_Y + 10, { color: '#ffffff' });
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
    order.forEach((route, i) => {
      const y = PANEL_Y + 44 + i * 12;
      drawText(ctx, route.name, 14, y, { color: TIER_COLORS[route.pips] });
      this.drawPips(ctx, 120, y + 2, route.pips);
      const prize = route.reward ? (REWARDS[route.reward] || {}).label : 'EI PALKINTOA';
      drawText(ctx, prize, 148, y, { color: route.reward ? '#ffd048' : '#5a5a76' });
      if (route.reward) this.drawRewardMark(ctx, 140, y + 3);
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
