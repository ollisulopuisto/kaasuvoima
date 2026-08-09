import { WORLDS, findNode, startNode, linkPoints } from '../data/worlds.js';
import { drawText } from '../gfx/font.js';
import { drawItem, drawPlayer } from '../gfx/sprites.js';
import { Music, Sfx } from '../core/audio.js';
import { hashNoise, padNum } from '../core/utils.js';
import { normalizePower, powerAfterItem, POWER_NAMES } from '../entities/player.js';

const TILE = 16;
const MAP_Y = 14;
const MAP_H = 144;
const PANEL_Y = MAP_Y + MAP_H;
const WALK_SPEED = 1.4;

const HOUSE_ITEMS = ['shroom', 'flower', 'leaf', 'soup'];

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

  drawLinks(ctx) {
    for (const link of this.world.links) {
      const open = this.isLinkOpen(link);
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
          ctx.fillStyle = open ? '#ffd048' : '#6a6a86';
          ctx.fillRect(x - 2, y - 2, 4, 4);
          ctx.fillStyle = open ? '#c07c20' : '#3a3a50';
          ctx.fillRect(x - 2, y + 1, 4, 1);
        }
      }
    }
  }

  drawNodes(ctx) {
    for (const node of this.world.nodes) {
      const x = node.tx * TILE;
      const y = MAP_Y + node.ty * TILE;
      const cleared = this.isCleared(node.id);
      switch (node.type) {
        case 'start':
          ctx.fillStyle = '#c8c8d8';
          ctx.fillRect(x + 7, y + 2, 2, 12);
          ctx.fillStyle = '#e04040';
          ctx.fillRect(x + 9, y + 3, 6, 4);
          break;
        case 'fortress':
          ctx.fillStyle = '#8a8aa0';
          ctx.fillRect(x + 1, y + 4, 14, 11);
          ctx.fillStyle = '#6a6a84';
          ctx.fillRect(x + 1, y + 2, 3, 3);
          ctx.fillRect(x + 7, y + 1, 3, 4);
          ctx.fillRect(x + 12, y + 2, 3, 3);
          ctx.fillStyle = '#301818';
          ctx.fillRect(x + 6, y + 9, 5, 6);
          if (cleared) {
            ctx.fillStyle = '#8fe04a';
            ctx.fillRect(x + 6, y + 11, 5, 2);
          }
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
          ctx.fillRect(x + 2, y + 3, 12, 11);
          ctx.fillStyle = '#202038';
          ctx.fillRect(x + 2, y + 3, 12, 1);
          ctx.fillRect(x + 2, y + 13, 12, 1);
          ctx.fillRect(x + 2, y + 3, 1, 11);
          ctx.fillRect(x + 13, y + 3, 1, 11);
          const label = node.level ? node.level.split('-')[1] : '?';
          drawText(ctx, label, x + 8, y + 5, {
            color: cleared ? '#8fe04a' : '#202038', align: 'center',
          });
          break;
        }
      }
    }
  }

  drawToken(ctx) {
    const bob = this.mode === 'idle' ? Math.round(Math.sin(this.tick / 12) * 1) : 0;
    const power = normalizePower(this.game.state.power);
    const lift = power.level === 0 ? 12 : 16 + power.level * 4;
    drawPlayer(ctx, this.pos.x - 6, MAP_Y + this.pos.y - lift + bob, {
      type: power.type,
      level: power.level,
      facing: 1,
      frame: Math.floor(this.tick / 8) % 3,
      state: this.mode === 'walk' ? 'walk' : 'idle',
      ducking: false,
      running: false,
      tick: this.tick,
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

    const hint = this.messageTimer > 0 && this.message
      ? this.message
      : 'NUOLET LIIKU   Z ALOITA   ENTER KAYTA ESINE';
    drawText(ctx, hint, 160, PANEL_Y + 40, {
      color: this.messageTimer > 0 ? '#ffd048' : '#8890b0',
      align: 'center',
    });

    const cleared = this.world.nodes.filter((n) => n.level && this.isCleared(n.id)).length;
    const total = this.world.nodes.filter((n) => n.level).length;
    drawText(ctx, `SELVITETTY ${cleared}/${total}`, 160, PANEL_Y + 54, { color: '#8890b0', align: 'center' });
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
