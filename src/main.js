import { Input } from './core/input.js';
import { Save } from './core/save.js';
import { Music, Sfx, toggleMute, isMuted, audioDiag } from './core/audio.js';
import { drawText } from './gfx/font.js';
import { WORLDS, startNode, findNode } from './data/worlds.js';
import { TitleScene } from './scenes/title.js';
import { WorldMapScene } from './scenes/worldmap.js';
import { LevelScene } from './scenes/level.js';
import { DemoScene } from './scenes/demo.js';
import { InterludeScene, GameOverScene, EndingScene, VictoryScene } from './scenes/cards.js';
import { makePower } from './entities/player.js';
import { writeSlot, readSlot, restoreState, SLOT_COUNT } from './core/savestate.js';
import { NameEntryScene, HighScoreScene } from './scenes/scores.js';
import { qualifies } from './core/scores.js';
import { downloadExport, eventCount, levelSummary, clearTelemetry } from './core/telemetry.js';
import { PostFX, PRESET_NAMES } from './gfx/postfx.js';
import { Touch, LAYOUT_NAMES } from './core/touch.js';

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
    this.adoptState(Save.load());
    this.scene = null;
    this.paused = false;
    this.pauseBlink = 0;
    this.accumulator = 0;
    this.lastTime = 0;
    this.slot = 1;
    this.flash = '';
    this.flashTimer = 0;
    this.pendingNode = null;

    // Deaths per level in this sitting, so a clear can record what it cost.
    // Deliberately not persisted: it is an input to one telemetry event, not
    // part of the player's save.
    this.attempts = {};

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
    // Atmosphere belongs to the place you are in, so it is set from the scene
    // rather than left for each scene to remember to turn off.
    PostFX.setAmbience(scene.theme || null, scene.def || null);
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

  /* ------------------------------- attract ----------------------------- */

  /** The title screen has been left alone: play the game to nobody. */
  startDemo() {
    this.setScene(new DemoScene(this));
  }

  /**
   * Back to the title, from a keypress or from the bot running out of level.
   * Either way the title is where the machine belongs: it is the one screen a
   * player can start from, and it re-arms the idle timer, so the demo comes
   * back around on its own if the room stays empty.
   */
  endDemo() {
    if (!(this.scene instanceof DemoScene)) return;
    this.scene.dispose();
    this.toTitle();
  }

  /**
   * End of a run: onto the board if the score is good enough, then show it.
   * `world` is one-based so the table reads like the level names do.
   */
  finishRun() {
    const result = {
      score: this.state.score,
      world: this.state.world + 1,
      // The level the run actually reached, so the board says 2-3 and not
      // merely "world 2" — the difference between walking in and dying at the
      // castle door is the whole story of a run.
      level: (this.pendingNode && this.pendingNode.level) || '',
      assisted: !!this.state.usedSaveState,
      // Continues are unlimited and cost no points, so the count is the only
      // place the difference between a clean run and a sixth try shows up.
      continues: this.state.continues || 0,
    };
    // A run that skipped worlds is not a run. No mark would be honest enough.
    if (this.state.debugWarped) {
      this.toHighScores();
      return;
    }
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

  /**
   * Takes on a freshly loaded save. Saves written before continues were counted
   * carry no count, so it is normalized to a number here rather than left for
   * the board to guess at — a blank continue column and a zero mean different
   * things and only one of them is true.
   */
  adoptState(state) {
    this.state = state;
    this.state.cards = [];
    if (typeof this.state.continues !== 'number') this.state.continues = 0;
  }

  newGame() {
    Save.clear();
    this.adoptState(Save.load());
    this.state.node = startNode(WORLDS[0]).id;
    this.persist();
    this.toWorldMap();
  }

  continueGame() {
    this.adoptState(Save.load());
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
      // The castle is the hardest thing in the world; the game should say so
      // before it hands out the next map.
      this.setScene(new VictoryScene(this, this.state.world + 1, () => this.completeWorld()));
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

  /* -------------------------------- debug ------------------------------ */

  /**
   * Jumps to the next world, for testing. Only with the developer overlay up,
   * because it is a testing tool and an invisible one would be a cheat code
   * somebody found by accident.
   *
   * The run is marked, and a marked run **cannot reach the high score table at
   * all**. The save-state star says "this was rewound"; there is no honest star
   * for "this player skipped four worlds", so the answer is not a mark on the
   * board but no board.
   */
  debugWarp() {
    if (!this.debug) {
      this.toast('WARP VAATII DEBUG-RUUDUN (9)');
      return;
    }
    const next = (this.state.world + 1) % WORLDS.length;
    this.state.world = next;
    this.state.worldsOpen = Math.max(this.state.worldsOpen, next + 1);
    this.state.node = startNode(WORLDS[next]).id;
    this.state.debugWarped = true;
    this.persist();
    this.toast(`WARP: MAAILMA ${next + 1} (PISTETAULU POIS)`);
    Sfx.play('powerup');
    this.toWorldMap();
  }

  /**
   * What is hidden in the level being played, counted rather than located.
   * The point is to make the new mechanics findable while testing without
   * turning the debug overlay into a map of every answer.
   */
  levelSecrets(scene) {
    if (!scene || !scene.grid) return null;
    const count = { vine: 0, warp: 0, star: 0, aswitch: 0, crumble: 0, brick: 0 };
    for (let ty = 0; ty < scene.h; ty++) {
      for (let tx = 0; tx < scene.w; tx++) {
        const ch = scene.rawTileAt ? scene.rawTileAt(tx, ty) : scene.grid[ty][tx];
        if (ch === 'v') count.vine++;
        else if (ch === '(') count.warp++;
        else if (ch === '*') count.star++;
        else if (ch === 'S') count.aswitch++;
        else if (ch === '%') count.crumble++;
        else if (ch === 'B' && scene.brickSecret && scene.brickSecret(tx, ty)) count.brick++;
      }
    }
    // A vine is many tiles and one secret; the same for a crumbling catwalk.
    count.vine = count.vine ? 1 : 0;
    count.bands = scene.def && scene.def.bands ? 1 : 0;
    return count;
  }

  /* ------------------------------ telemetry ---------------------------- */

  /** Hands the local playtest log over as a file. Nothing is sent anywhere. */
  exportTelemetry() {
    const n = eventCount();
    if (!n) {
      this.toast('EI VIELÄ PELIDATAA');
      Sfx.play('bump');
      return;
    }
    downloadExport();
    this.toast(`PELIDATA VIETY  ${n} TAPAHTUMAA`);
    Sfx.play('select');
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

    /* Attract mode hands the machine back the instant anyone touches it. This
     * sits ahead of every other key on purpose: the press that ends the demo
     * must not also quicksave, cycle the effects or, once the title is back,
     * pick a menu item nobody chose. Whoever pressed it gets a title screen and
     * decides from there. */
    if (this.scene instanceof DemoScene && (Input.anyKeyPressed || this.scene.aborted)) {
      this.endDemo();
      return;
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
    if (Input.pressed.export) this.exportTelemetry();
    if (Input.pressed.warp) this.debugWarp();
    if (Input.pressed.touch) {
      Touch.reveal();
      this.toast(`KOSKETUSOHJAUS: ${LAYOUT_NAMES[Touch.toggleLayout()]}`);
      Sfx.play('cursor');
    }
    if (Input.pressed.fx) {
      this.toast(`KUVAEFEKTIT: ${PRESET_NAMES[PostFX.cyclePreset()]}`);
      Sfx.play('cursor');
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
      ctx.fillRect(0, 90, W, 48);
      drawText(ctx, 'TAUKO', W / 2, 104, { color: '#ffffff', align: 'center', shadow: '#303048' });
      drawText(ctx, 'ENTER JATKA', W / 2, 116, { color: '#8890b0', align: 'center' });
      drawText(ctx, `1 TALLENNA  2 LATAA  3 PAIKKA ${this.slot}  7 EFEKTIT  9 DEBUG`, W / 2, 126,
        { color: '#8890b0', align: 'center' });
    }
    if (this.flashTimer > 0) {
      drawText(ctx, this.flash, W / 2, 6, { color: '#ffd048', align: 'center', shadow: '#101018' });
    }

    // Effects go over the game but under the developer overlay: a CRT filter
    // on top of debug text would make the one thing you are reading unreadable.
    PostFX.apply(ctx);
    if (this.debug) this.drawDebug(ctx);
    PostFX.present();
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
    const fx = PostFX.diag();
    const t = Touch.diag();
    lines.push(`FX ${fx.mode.toUpperCase()} ${fx.preset.toUpperCase()}`
      + `  TUNNELMA ${(fx.ambience || 'EI').toUpperCase()}  (7 VAIHDA)`);
    lines.push(`KOSKETUS ${t.visible ? t.layout.toUpperCase() : 'PIILOSSA'}`
      + `  SORMET ${t.pointers}  (6 VAIHDA)`);
    lines.push(`LIVES ${this.state.lives}  COINS ${this.state.coins}  SCORE ${this.state.score}`);
    if (scene && scene.grid) {
      const c = this.levelSecrets(scene);
      lines.push(`SALAT VARSI ${c.vine}  PUTKI ${c.warp}  TAHTI ${c.star}`
        + `  KYTKIN ${c.aswitch}  LAVA ${c.crumble}  TIILI ${c.brick}  KAISTAT ${c.bands}`);
    }
    if (this.state.debugWarped) lines.push('WARPATTU - EI PISTETAULUA');
    if (scene && scene.id && scene.cam) {
      // Cached: this scans the whole telemetry log, and the overlay is the one
      // thing on screen that must never be the reason the frame is slow.
      if (!this._teleCache || this._teleCache.id !== scene.id
        || this._teleAt === undefined || this.fps === 0
        || (scene.tick - this._teleAt) > 30) {
        this._teleCache = { id: scene.id, data: levelSummary(scene.id), n: eventCount() };
        this._teleAt = scene.tick;
      }
      const t = this._teleCache.data;
      lines.push(`TELE ${t.total} KUOLEMAA  ${t.stuckTotal} JUMIA  ${t.clears} LAPI`
        + `  (8 VIE ${this._teleCache.n})`);
    }

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

// The game always draws into `canvas`. What ends up on screen may be another
// one — see src/gfx/postfx.js. If WebGL is unavailable this returns `canvas`
// itself and nothing below changes.
const display = PostFX.init(canvas);

/*
 * Integer scaling is what keeps pixel art honest, but on a phone the honest
 * answer is a postage stamp: a 844x390 landscape screen fits exactly 1x, and
 * 1x on a modern display is unplayable. So integer scaling applies whenever
 * there is room for 2x or more, and below that the picture is stretched to fit.
 * The device pixel ratio does the smoothing work at those sizes anyway.
 */
function resize() {
  // The keyboard hint strip only exists while there is a keyboard in the story.
  const reserve = document.body.classList.contains('touching') ? 10 : 56;
  const fit = Math.min(window.innerWidth / W, (window.innerHeight - reserve) / H);
  const scale = fit >= 2 ? Math.floor(fit) : Math.max(1, fit);
  display.style.width = `${Math.round(W * scale)}px`;
  display.style.height = `${Math.round(H * scale)}px`;
  PostFX.resize(scale);
}

window.addEventListener('resize', resize);
resize();

Input.install();
// `?touch=1` forces the overlay up on a desktop, which is the only way to work
// on it without holding a phone.
Touch.install(Input, { force: new URLSearchParams(location.search).has('touch') });
Input.onFirstInput = () => {
  Sfx.resume();
  if (!isMuted()) Music.play(Music.current || 'map');
};

game.toTitle();
requestAnimationFrame((t) => game.frame(t));

// Handy while tuning: `window.sfb3.state` in the console.
window.sfb3 = game;
// …and `window.sfb3.telemetry.summary('1-1')` to see where a level is killing
// people without having to squint at the heatmap.
game.telemetry = { summary: levelSummary, count: eventCount, clear: clearTelemetry };
game.fx = PostFX;
game.touch = Touch;
