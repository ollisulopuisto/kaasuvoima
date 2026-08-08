import { Input } from './core/input.js';
import { Save } from './core/save.js';
import { Music, Sfx, toggleMute, isMuted, audioDiag } from './core/audio.js';
import { drawText } from './gfx/font.js';
import { WORLDS, startNode, findNode } from './data/worlds.js';
import { TitleScene } from './scenes/title.js';
import { WorldMapScene } from './scenes/worldmap.js';
import { LevelScene } from './scenes/level.js';
import { InterludeScene, GameOverScene, EndingScene } from './scenes/cards.js';
import { makePower } from './entities/player.js';
import { writeSlot, readSlot, restoreState, SLOT_COUNT } from './core/savestate.js';
import { NameEntryScene, HighScoreScene } from './scenes/scores.js';
import { qualifies } from './core/scores.js';

const W = 320;
const H = 240;
const STEP = 1000 / 60;

const CARD_BONUS = { shroom: 2, flower: 3, star: 5 };

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
    this.slot = 1;
    this.flash = '';
    this.flashTimer = 0;
    this.pendingNode = null;

    // 9 / ` toggles the developer overlay.
    this.debug = false;
    this.fps = 0;
    this.frameMs = 0;
    this.workMs = 0;
    this.stepsThisFrame = 0;
    this._fpsFrames = 0;
    this._fpsSince = 0;
  }

  toast(text, frames = 90) {
    this.flash = text;
    this.flashTimer = frames;
  }

  /* ------------------------------ lifecycle ---------------------------- */

  setScene(scene) {
    this.scene = scene;
    if (scene.enter) scene.enter();
  }

  toTitle() {
    this.setScene(new TitleScene(this));
  }

  toWorldMap() {
    this.setScene(new WorldMapScene(this));
  }

  toHighScores(highlight = -1) {
    this.setScene(new HighScoreScene(this, highlight));
  }

  /**
   * End of a run: onto the board if the score is good enough, then show it.
   * `world` is one-based so the table reads like the level names do.
   */
  finishRun() {
    const result = {
      score: this.state.score,
      world: this.state.world + 1,
      assisted: !!this.state.usedSaveState,
    };
    if (!qualifies(result.score)) {
      this.toHighScores();
      return;
    }
    this.setScene(new NameEntryScene(this, result, (index) => this.toHighScores(index)));
  }

  /** Builds a level scene without showing it — used by save-state restore. */
  makeLevelScene(levelId, nodeId) {
    if (nodeId) {
      const world = WORLDS[this.state.world];
      this.pendingNode = (world && findNode(world, nodeId)) || this.pendingNode;
    }
    return new LevelScene(this, levelId);
  }

  newGame() {
    Save.clear();
    this.state = Save.load();
    this.state.cards = [];
    this.state.node = startNode(WORLDS[0]).id;
    this.persist();
    this.toWorldMap();
  }

  continueGame() {
    this.state = Save.load();
    this.state.cards = [];
    if (this.state.lives < 1) this.state.lives = 4;
    this.toWorldMap();
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
      this.state.power = makePower();
      this.state.lives--;
      this.persist();
      if (this.state.lives < 0) {
        this.state.lives = 4;
        this.persist();
        this.setScene(new GameOverScene(this));
      } else {
        this.toWorldMap();
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
    this.toWorldMap();
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
    this.toWorldMap();
  }

  /* ------------------------------ save states -------------------------- */

  quickSave() {
    const snap = writeSlot(this, this.slot);
    if (!snap) {
      this.toast('TILAA EI VOI TALLENTAA TÄSSÄ');
      Sfx.play('bump');
      return;
    }
    this.toast(`TILA ${this.slot} TALLENNETTU  ${snap.label}`);
    Sfx.play('select');
  }

  quickLoad() {
    const snap = readSlot(this.slot);
    if (!snap) {
      this.toast(`TILA ${this.slot} ON TYHJÄ`);
      Sfx.play('bump');
      return;
    }
    this.paused = false;
    if (restoreState(this, snap)) {
      // The run is now a rewound one. The board marks these with a star.
      this.state.usedSaveState = true;
      this.persist();
      this.toast(`TILA ${this.slot} LADATTU`);
      Sfx.play('powerup');
    } else {
      this.toast('TILAN LATAUS EPÄONNISTUI');
      Sfx.play('bump');
    }
  }

  /* -------------------------------- loop ------------------------------- */

  step() {
    Input.poll();

    // Keep asking until the browser lets the audio through. One refused or
    // mistimed gesture used to mean silence for the rest of the session.
    const anyInput = Input.anyKeyPressed
      || Input.held.jump || Input.held.left || Input.held.right || Input.held.start;
    if (anyInput && audioDiag().state !== 'running') {
      Sfx.resume();
      if (!isMuted() && Music.current) {
        const track = Music.current;
        Music.current = null;
        Music.play(track);
      }
    }

    if (Input.pressed.mute) this.toast(toggleMute() ? 'ÄÄNI POIS' : 'ÄÄNI PÄÄLLE', 60);
    if (Input.pressed.debug) this.debug = !this.debug;
    if (Input.pressed.slot) {
      this.slot = (this.slot % SLOT_COUNT) + 1;
      this.toast(`TALLENNUSPAIKKA ${this.slot}`);
      Sfx.play('cursor');
    }
    if (Input.pressed.quicksave) this.quickSave();
    if (Input.pressed.quickload) this.quickLoad();
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
      ctx.fillRect(0, 90, W, 48);
      drawText(ctx, 'TAUKO', W / 2, 104, { color: '#ffffff', align: 'center', shadow: '#303048' });
      drawText(ctx, 'ENTER JATKA', W / 2, 116, { color: '#8890b0', align: 'center' });
      drawText(ctx, `1 TALLENNA  2 LATAA  3 PAIKKA ${this.slot}  9 DEBUG`, W / 2, 126,
        { color: '#8890b0', align: 'center' });
    }
    if (this.flashTimer > 0) {
      drawText(ctx, this.flash, W / 2, 6, { color: '#ffd048', align: 'center', shadow: '#101018' });
    }
    if (this.debug) this.drawDebug(ctx);
  }

  /** Developer overlay: frame budget, scene contents, player and audio state. */
  drawDebug(ctx) {
    const scene = this.scene;
    const p = scene && scene.player;
    const n = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);

    const lines = [
      `FPS ${this.fps}  FRAME ${n(this.frameMs)}MS  WORK ${n(this.workMs)}MS  STEPS ${this.stepsThisFrame}`,
      `SCENE ${(scene ? scene.constructor.name : 'NONE').replace('SCENE', '')}`
        + `${scene && scene.id ? ` ${scene.id}` : ''}  TICK ${scene ? scene.tick || 0 : 0}`,
    ];
    if (scene && scene.entities) {
      const live = scene.entities.filter((e) => e.active).length;
      lines.push(`ENT ${live}/${scene.entities.length}  BUMPS ${scene.bumps ? scene.bumps.size : 0}`
        + `  SHAKE ${n(scene.shakeAmp || 0)}`);
    }
    if (p) {
      lines.push(`POS ${Math.round(p.x)},${Math.round(p.y)}  VEL ${n(p.vx, 2)},${n(p.vy, 2)}`);
      lines.push(`POWER ${(p.type || 'NONE').toUpperCase()} ${p.powerLevel}  P ${Math.round(p.pMeter)}`
        + `  GROUND ${p.onGround ? 1 : 0}  CORK ${Math.ceil((p.corked || 0) / 60)}`);
    }
    if (scene && scene.cam) {
      lines.push(`CAM ${Math.round(scene.cam.x)},${Math.round(scene.cam.y)}`
        + `  MAP ${scene.w || 0}X${scene.h || 0}`);
    }
    const a = audioDiag();
    lines.push(`MUS ${a.track.toUpperCase()} (${Music.variation().toUpperCase()})`
      + `  MUTE ${a.muted ? 1 : 0}`);
    lines.push(`AUDIO ${a.state.toUpperCase()}  GAIN ${a.master}`);
    lines.push(`LIVES ${this.state.lives}  COINS ${this.state.coins}  SCORE ${this.state.score}`);

    const width = Math.max(...lines.map((l) => l.length)) * 6 + 8;
    ctx.fillStyle = 'rgba(8,8,16,0.72)';
    ctx.fillRect(2, 2, Math.min(W - 4, width), lines.length * 9 + 6);
    lines.forEach((line, i) => {
      drawText(ctx, line, 6, 6 + i * 9, { color: i === 0 ? '#8fe04a' : '#d0d0e8' });
    });
  }

  frame(now) {
    if (!this.lastTime) this.lastTime = now;
    let delta = now - this.lastTime;
    this.lastTime = now;
    this.frameMs = delta;
    if (delta > 250) delta = STEP;      // tab was in the background
    this.accumulator += delta;

    const started = performance.now();
    let steps = 0;
    while (this.accumulator >= STEP && steps < 5) {
      this.accumulator -= STEP;
      steps++;
      this.step();
    }
    this.render();
    this.stepsThisFrame = steps;
    this.workMs = performance.now() - started;

    this._fpsFrames++;
    if (now - this._fpsSince >= 500) {
      this.fps = Math.round((this._fpsFrames * 1000) / (now - this._fpsSince));
      this._fpsFrames = 0;
      this._fpsSince = now;
    }
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
