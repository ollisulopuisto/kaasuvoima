import { Player } from '../entities/player.js';
import {
  Walker, ShellGuy, Flyer, Plant, StinkCloud, CorkGuy, Heartburn, Shockwave, Boss, AngrySun,
  Moon, SpikeGuy, BeanBaron, BeanBomb,
} from '../entities/enemies.js';
import { Item, FartBall, Beanstalk } from '../entities/items.js';
import { Puff, ScorePop, BrickPiece, CoinPop, PoundWave } from '../entities/effects.js';

/**
 * Emulator-style save states: a whole snapshot of the running game, taken and
 * restored at any moment. Entities are serialised generically — every own
 * property except the back-reference to the scene — and revived against this
 * registry, so new entity types only need to be listed here.
 */
const REGISTRY = {
  Player, Walker, ShellGuy, Flyer, Plant, StinkCloud, CorkGuy, Heartburn,
  Shockwave, Boss, AngrySun, Moon, SpikeGuy, BeanBaron, BeanBomb, Item, FartBall,
  /* A beanstalk caught halfway up is state and not scenery: the tiles it has
   * already written are in the saved grid, and the ones it has not are only in
   * this entity's own list. Leaving it out would restore a level with half a
   * vine in it and nothing left to finish the job. */
  Beanstalk,
  Puff, ScorePop, BrickPiece, CoinPop, PoundWave,
};

export const SLOT_COUNT = 3;
const KEY = (slot) => `sfb3.savestate.${slot}`;

function entityToJSON(entity) {
  const out = { t: entity.constructor.name };
  for (const [k, v] of Object.entries(entity)) {
    if (k === 'level' || typeof v === 'function') continue;
    out[k] = v;
  }
  return out;
}

function entityFromJSON(scene, data) {
  const Ctor = REGISTRY[data.t];
  if (!Ctor) return null;
  const entity = Object.create(Ctor.prototype);
  Object.assign(entity, data);
  delete entity.t;
  entity.level = scene;
  return entity;
}

/** @returns a plain object, or null when the current scene can't be snapshotted. */
export function captureState(game) {
  const scene = game.scene;
  if (!scene) return null;
  const base = {
    v: 1,
    stamp: new Date().toISOString(),
    gameState: JSON.parse(JSON.stringify(game.state)),
  };

  if (scene.constructor.name === 'LevelScene') {
    return {
      ...base,
      kind: 'level',
      label: `${scene.id}  ${Math.max(0, scene.time)}`,
      node: game.pendingNode ? game.pendingNode.id : null,
      level: {
        id: scene.id,
        grid: scene.grid.map((row) => row.join('')),
        entities: scene.entities.map(entityToJSON),
        player: entityToJSON(scene.player),
        cam: { x: scene.cam.x, y: scene.cam.y },
        tick: scene.tick,
        time: scene.time,
        timeSub: scene.timeSub,
        state: scene.state,
        stateTimer: scene.stateTimer,
        bossDefeated: scene.bossDefeated,
        cardIndex: scene.cardIndex,
        wonCard: scene.wonCard,
        bumps: [...scene.bumps.entries()],
        crumbles: [...scene.crumbles.entries()],
        switchTimer: scene.switchTimer,
      },
    };
  }

  if (scene.constructor.name === 'WorldMapScene') {
    return {
      ...base,
      kind: 'map',
      label: `KARTTA ${game.state.world + 1}`,
      node: game.state.node,
    };
  }

  return null;
}

export function restoreState(game, snap) {
  if (!snap || snap.v !== 1) return false;
  game.state = { cards: [], ...snap.gameState };

  if (snap.kind === 'map') {
    game.toWorldMap();
    game.scene.mode = 'idle';
    return true;
  }

  if (snap.kind !== 'level') return false;

  const scene = game.makeLevelScene(snap.level.id, snap.node);
  const data = snap.level;
  scene.grid = data.grid.map((row) => row.split(''));
  scene.entities = data.entities.map((e) => entityFromJSON(scene, e)).filter(Boolean);
  scene.player = entityFromJSON(scene, data.player);
  scene.cam = { ...data.cam };
  scene.tick = data.tick;
  scene.time = data.time;
  scene.timeSub = data.timeSub;
  scene.state = data.state;
  scene.stateTimer = data.stateTimer;
  scene.bossDefeated = data.bossDefeated;
  scene.cardIndex = data.cardIndex;
  scene.wonCard = data.wonCard;
  scene.bumps = new Map(data.bumps);
  // Older snapshots predate crumbling platforms; an absent list is not an error.
  scene.crumbles = new Map(data.crumbles || []);
  scene.switchTimer = data.switchTimer || 0;
  game.setScene(scene);
  return true;
}

export function writeSlot(game, slot) {
  const snap = captureState(game);
  if (!snap) return null;
  try {
    localStorage.setItem(KEY(slot), JSON.stringify(snap));
    return snap;
  } catch {
    return null;
  }
}

export function readSlot(slot) {
  try {
    const raw = localStorage.getItem(KEY(slot));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function slotLabel(slot) {
  const snap = readSlot(slot);
  return snap ? snap.label : null;
}
