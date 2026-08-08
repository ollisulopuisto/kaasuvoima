let nextId = 1;

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

  update() { this.tick++; }

  draw() {}
}
