import { Input } from './core/input.js';
import { Save } from './core/save.js';
import { Music, Sfx, toggleMute, isMuted } from './core/audio.js';
import { drawText } from './gfx/font.js';
import { WORLDS, startNode } from './data/worlds.js';
import { TitleScene } from './scenes/title.js';
import { WorldMapScene } from './scenes/worldmap.js';
import { LevelScene } from './scenes/level.js';
import { InterludeScene, GameOverScene, EndingScene } from './scenes/cards.js';

const W = 320;
const H = 240;
const STEP = 1000 / 60;

const CARD_BONUS = { bean: 2, flower: 3, star: 5 };

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.input = Input;
    this.state = Save.load();
    this.state.cards = [];
    this.scene = null;
    this.paused = false;
    this.pauseBlink = 0;
    this.accumulator = 0;
    this.lastTime = 0;
  }

  /* ------------------------------ lifecycle ---------------------------- */

  setScene(scene) {
    this.scene = scene;
    if (scene.enter) scene.enter();
  }

  toTitle() {
    this.setScene(new TitleScene(this));
  }

  newGame() {
    Save.clear();
    this.state = Save.load();
    this.state.cards = [];
    this.state.node = startNode(WORLDS[0]).id;
    this.persist();
    this.setScene(new WorldMapScene(this));
  }

  continueGame() {
    this.state = Save.load();
    this.state.cards = [];
    if (this.state.lives < 1) this.state.lives = 4;
    this.setScene(new WorldMapScene(this));
  }

  persist() {
    Save.write(this.state);
  }

  /* -------------------------------- flow ------------------------------- */

  startLevel(node) {
    this.state.node = node.id;
    this.pendingNode = node;
    this.persist();
    this.setScene(new InterludeScene(this, node.level, () => {
      this.setScene(new LevelScene(this, node.level));
    }));
  }

  finishLevel(result) {
    const scene = this.scene;
    const node = this.pendingNode;

    if (result.died) {
      this.state.power = 'small';
      this.state.lives--;
      this.persist();
      if (this.state.lives < 0) {
        this.state.lives = 4;
        this.persist();
        this.setScene(new GameOverScene(this));
      } else {
        this.setScene(new WorldMapScene(this));
      }
      return;
    }

    // cleared
    this.state.power = scene.player ? scene.player.power : this.state.power;
    this.state.cleared[node.id] = true;
    if (result.card) this.collectCard(result.card);
    this.persist();

    if (node.type === 'fortress') {
      this.completeWorld();
      return;
    }
    this.setScene(new WorldMapScene(this));
  }

  collectCard(card) {
    this.state.cards.push(card);
    if (this.state.cards.length < 3) return;
    const [a, b, c] = this.state.cards;
    const bonus = a === b && b === c ? (CARD_BONUS[a] || 1) : 1;
    this.state.lives += bonus;
    this.state.cards = [];
    Sfx.play('oneup');
  }

  completeWorld() {
    const next = this.state.world + 1;
    if (next >= WORLDS.length) {
      this.setScene(new EndingScene(this));
      return;
    }
    this.state.world = next;
    this.state.worldsOpen = Math.max(this.state.worldsOpen, next + 1);
    this.state.node = startNode(WORLDS[next]).id;
    this.persist();
    this.setScene(new WorldMapScene(this));
  }

  /* -------------------------------- loop ------------------------------- */

  step() {
    Input.poll();

    if (Input.pressed.mute) {
      const m = toggleMute();
      this.flash = m ? 'AANI POIS' : 'AANI PAALLE';
      this.flashTimer = 60;
    }
    if (this.flashTimer > 0) this.flashTimer--;

    const pausable = this.scene instanceof LevelScene;
    if (pausable && Input.pressed.start) {
      Input.consume('start');
      this.paused = !this.paused;
      Sfx.play('cursor');
    }
    if (!this.paused && this.scene) this.scene.update(Input);
  }

  render() {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (this.scene) this.scene.draw(ctx);

    if (this.paused) {
      ctx.fillStyle = 'rgba(8,8,16,0.7)';
      ctx.fillRect(0, 90, W, 44);
      drawText(ctx, 'TAUKO', W / 2, 104, { color: '#ffffff', align: 'center', shadow: '#303048' });
      drawText(ctx, 'ENTER JATKA', W / 2, 118, { color: '#8890b0', align: 'center' });
    }
    if (this.flashTimer > 0) {
      drawText(ctx, this.flash, W / 2, 6, { color: '#ffd048', align: 'center', shadow: '#101018' });
    }
  }

  frame(now) {
    if (!this.lastTime) this.lastTime = now;
    let delta = now - this.lastTime;
    this.lastTime = now;
    if (delta > 250) delta = STEP;      // tab was in the background
    this.accumulator += delta;

    let steps = 0;
    while (this.accumulator >= STEP && steps < 5) {
      this.accumulator -= STEP;
      steps++;
      this.step();
    }
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }
}

/* --------------------------------- boot -------------------------------- */

const canvas = document.getElementById('game');
const game = new Game(canvas);

function resize() {
  const scale = Math.max(1, Math.min(
    Math.floor(window.innerWidth / W),
    Math.floor((window.innerHeight - 56) / H),
  ));
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
}

window.addEventListener('resize', resize);
resize();

Input.install();
Input.onFirstInput = () => {
  Sfx.resume();
  if (!isMuted()) Music.play(Music.current || 'map');
};

game.toTitle();
requestAnimationFrame((t) => game.frame(t));

// Handy while tuning: `window.sfb3.state` in the console.
window.sfb3 = game;
