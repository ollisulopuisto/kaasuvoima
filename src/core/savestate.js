import { Player } from '../entities/player.js';
import {
  Walker, ShellGuy, Flyer, Plant, StinkCloud, CorkGuy, Heartburn, Shockwave, Boss, AngrySun,
  Moon, SpikeGuy, BeanBaron, BeanBomb, Kurnuttaja,
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
  /* The pit leaper's whole promise is that its cycle is learnable, and a
   * quicksave that reloaded it into a different beat would break that promise
   * in the one moment the player is standing on the rim counting. Its phase and
   * timer are plain own properties, so listing the class here is all it takes. */
  Kurnuttaja,
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
  /*
   * JOHDETTU TILA JOHDETAAN UUDELLEEN, EI PALAUTETA.
   *
   * `entityToJSON` kopioi jokaisen oman kentän, eikä tässä kutsuta konstruktoria
   * — `Object.create` + `Object.assign` — joten kaikki mitä olio tiesi itsestään
   * tallennushetkellä palaa sellaisenaan, myös se mikä oli *laskettu* jostain
   * taulukosta. Niin kauan kuin taulukko ei muutu, se on sama asia.
   *
   * Pomojen koot muuttuivat (30x32 → seitsemän eri kokoa), ja siinä hetkessä ne
   * kaksi lakkasivat olemasta sama asia: ennen päivitystä otettu pikatallennus
   * herättää pomon **vanhalla osumalaatikolla uuden piirroksen alla**, eli
   * 36x52 luuranko jonka päätä ei voi tallata. Tallennusversio on yhä `v: 1`,
   * joten mikään ei hylkää sitä.
   *
   * Ratkaisu ei ole version nosto (se heittäisi pelaajan tallennukset menemään)
   * vaan se että olio saa kertoa mikä sen tilasta on johdettua ja johtaa sen
   * uudelleen. `rehydrate` on valinnainen, joten tämä koskee vain niitä joilla
   * on jotain johdettavaa.
   */
  if (typeof entity.rehydrate === 'function') entity.rehydrate();
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
        /* The climb's page line. It is not derivable from `cam.y`, because
         * `cam.y` is the page line with the headroom net possibly subtracted,
         * and a snapshot taken at the apex of a jump would restore the page
         * one jump too high and never page back. Always written, always a
         * number, zero and unread in every horizontal level. */
        camPageY: scene.camPageY,
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
        /* Pieruhyllyt. Sama muoto ja sama syy kuin murenevilla laudoilla:
         * hylly on kentän tilaa jolla on kello, ja ruudukko yksin palauttaisi
         * sen ikuisena. Kello on se mikä tekee siitä liikkeen. */
        shelves: [...scene.shelves.entries()],
        /* Liikkeellä olevat möykyt. Sama muoto kuin `crumbles` ja samasta
         * syystä: maasto joka on kesken jotain on kentän tilaa, ja
         * pikatallennus joka palauttaisi kentän lähtömuotoonsa mutta pelaajan
         * putoamisen alle olisi juuri se ansa jota tallennus on vastaan. */
        falls: [...scene.falls.entries()],
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
  /* Osioidussa kentässä `vertical` on muuttuva eikä kentän ominaisuus, joten
   * se on johdettava takaisin sijainnista — ja **vasta kun pelaaja on
   * palautettu**. Ensimmäinen versio luki `scene.player`ia riviä ennen sen
   * sijoitusta, eli johti osion aloituspaikasta ja päätyi aina ensimmäiseen
   * osioon: no-op joka jätti juuri sen turhan sivunvaihdon jonka se lupasi
   * estää. */
  if (scene.segments && scene.player) {
    scene.vertical = !!scene.segmentAt(Math.floor(scene.player.cx / 16)).vertical;
  }
  scene.cam = { ...data.cam };
  // An older snapshot has no page line; the view it was taken at is the honest
  // fallback, and in a horizontal level nothing ever reads it.
  scene.camPageY = data.camPageY === undefined ? data.cam.y : data.camPageY;
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
  scene.shelves = new Map(data.shelves || []);
  // Ja vanhempi tilannekuva on otettu ennen kuin yksikään laatta putosi.
  scene.falls = new Map(data.falls || []);
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
