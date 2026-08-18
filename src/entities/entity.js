import { TILE, info } from '../gfx/tiles.js';

let nextId = 1;

/**
 * Nostaa tunnuslaskurin annetun luvun yli.
 *
 * `savestate.js` kutsuu tätä palautuksen jälkeen, ja syy on hiljainen vika:
 * tunnukset kopioituvat tallennukseen omina kenttinään, mutta laskuri ei —
 * joten sivun latauksen jälkeen ladattu tallennus toisi takaisin olion
 * tunnuksella 57, ja seuraava syntyvä olio saisi saman. Yksikään olio ei
 * viittaa toiseen suoraan (ks. `savestate.js`), joten viittaukset ovat
 * tunnuksia — ja kaksi samaa tunnusta on kaksi eri oliota jotka luulevat
 * olevansa sama.
 */
export function claimIds(upTo) {
  if (Number.isFinite(upTo) && upTo >= nextId) nextId = Math.floor(upTo) + 1;
}

export class Entity {
  constructor(level, x, y, w, h) {
    this.id = nextId++;
    this.level = level;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.onGround = false;
    this.noclip = false;
    this.remove = false;
    this.tick = 0;
    this.kind = 'entity';
    this.active = false;      // wakes up when the camera gets close
    this.alwaysActive = false;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  get box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  /**
   * The y of the surface of the quicksand this body is in, or null.
   *
   * **It lives on `Entity` and not on `Player` because the sand does not know
   * what is in it.** It started life next to the player's own sinking code, and
   * for one afternoon that was the only body the tile could catch; the moment
   * enemies had to sink as well, a second copy of this scan would have been two
   * chances to read a different tile and call it the same rule. Everything that
   * can be pulled under asks this one method, and the geometry that decides
   * whether a pool is survivable is therefore literally the same geometry for a
   * walker as for a Pieruprinssi.
   *
   * The *surface* and not merely "yes": every question quicksand asks is about
   * a height. Whether the head is under is the surface against `this.y`, how
   * far there is to climb is the surface against the feet, and where the grains
   * are thrown from is the surface again. Returning a boolean and looking the
   * height up again at each of those would have been three chances to look up a
   * different tile.
   *
   * The highest quicksand row the body overlaps wins, because a two-tile pool
   * has two rows of it and only the top one has air over it. Reading the tile
   * above rather than tracking pool extents keeps this a question about the
   * body's own box, which is the only thing that stays true when a pool is
   * dug into a slope or a chunk boundary.
   */
  quicksandSurface() {
    const x0 = Math.floor(this.x / TILE);
    const x1 = Math.floor((this.x + this.w - 1) / TILE);
    const y0 = Math.floor(this.y / TILE);
    const y1 = Math.floor((this.y + this.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!info(this.level.tileAt(tx, ty)).quicksand) continue;
        let top = ty;
        while (top > 0 && info(this.level.tileAt(tx, top - 1)).quicksand) top--;
        return top * TILE;
      }
    }
    return null;
  }

  update() { this.tick++; }

  draw() {}
}
