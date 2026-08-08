/**
 * Touch controls, in two layouts that are genuinely different rather than two
 * arrangements of the same thing.
 *
 *   napit     A visible d-pad and two buttons. Familiar, precise, and it eats
 *             the bottom third of the screen.
 *   peukalot  Nothing visible. The left half is a stick that appears where your
 *             thumb lands, the right half is jump. More game visible, less
 *             precision.
 *
 * Which one is better is not a question anyone can answer from a desk, so both
 * ship and the switch is on screen.
 *
 * Design rules this file follows, in order of how much trouble they save:
 *
 *   1. **Hit-testing is ours, not the DOM's.** Buttons are `<div>`s for looks
 *      only; every pointer is tested against rectangles by hand. Browsers do
 *      not send a button `pointerleave` when a thumb slides off it mid-press,
 *      and a d-pad you cannot roll your thumb across is not a d-pad.
 *   2. **Every pointer is tracked by id.** Jump while running while steering is
 *      three fingers, and dropping any of them is a bug the player will feel as
 *      the game "sticking".
 *   3. **Nothing appears until a finger appears.** Plenty of laptops report
 *      touch support they never use; the overlay shows on the first real touch.
 *   4. **The overlay is above the game canvas and swallows its own gestures.**
 *      `touch-action: none` everywhere, or Android turns a jump into a scroll.
 */

const KEY = 'sfb3.touch.v1';
export const LAYOUTS = ['napit', 'peukalot'];
export const LAYOUT_NAMES = { napit: 'NÄPPÄIMET', peukalot: 'PEUKALOT' };

/** Movement thresholds for the floating stick, in CSS pixels. */
const STICK_DEAD = 14;
const STICK_UP = 26;
const STICK_DOWN = 30;

export const Touch = {
  installed: false,
  /** True once a real touch has happened — the overlay stays hidden until then. */
  visible: false,
  layout: 'napit',
  input: null,
  root: null,
  _zones: [],
  _pointers: new Map(),

  install(input, { force = false } = {}) {
    if (this.installed || typeof document === 'undefined') return false;
    this.input = input;
    this.layout = this.loadLayout();
    this._build();
    this.installed = true;
    if (force) this.reveal();
    return true;
  },

  loadLayout() {
    try {
      const saved = localStorage.getItem(KEY);
      return LAYOUTS.includes(saved) ? saved : 'napit';
    } catch {
      return 'napit';
    }
  },

  setLayout(name) {
    this.layout = LAYOUTS.includes(name) ? name : 'napit';
    try {
      localStorage.setItem(KEY, this.layout);
    } catch {
      /* private mode — the choice just won't stick */
    }
    if (this.root) this.root.dataset.layout = this.layout;
    this._releaseAll();
    return this.layout;
  },

  toggleLayout() {
    return this.setLayout(LAYOUTS[(LAYOUTS.indexOf(this.layout) + 1) % LAYOUTS.length]);
  },

  /** Shows the controls. Called on the first genuine touch. */
  reveal() {
    if (this.visible) return;
    this.visible = true;
    if (this.root) this.root.classList.add('on');
    // The keyboard hints under the canvas are worse than useless on a phone:
    // they take the space the thumbs need to tell you about keys you do not
    // have. The class hides them and frees the height for the picture.
    document.body.classList.add('touching');
    dispatchEvent(new Event('resize'));
  },

  /* ------------------------------ building ----------------------------- */

  _build() {
    const root = document.createElement('div');
    root.id = 'touch';
    root.dataset.layout = this.layout;
    root.innerHTML = `
      <div class="pad">
        <div class="key" data-act="left">◀</div>
        <div class="key" data-act="right">▶</div>
        <div class="key" data-act="up">▲</div>
        <div class="key" data-act="down">▼</div>
      </div>
      <div class="acts">
        <div class="key big" data-act="run">X<small>pieru</small></div>
        <div class="key big" data-act="jump">Z<small>hyppy</small></div>
      </div>
      <div class="stick" hidden><i></i></div>
      <div class="bar">
        <button type="button" class="tool" data-tool="layout">OHJAUS</button>
        <button type="button" class="tool" data-tool="start">ENTER</button>
        <button type="button" class="tool" data-tool="full">KOKO RUUTU</button>
      </div>`;
    document.body.appendChild(root);
    this.root = root;
    this.stick = root.querySelector('.stick');

    // The toolbar is ordinary DOM: these are one-shot commands, not held
    // actions, so there is nothing to hit-test and nothing to slide across.
    for (const button of root.querySelectorAll('.tool')) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this._tool(button.dataset.tool);
      });
    }

    root.addEventListener('pointerdown', (e) => this._down(e));
    root.addEventListener('pointermove', (e) => this._move(e));
    root.addEventListener('pointerup', (e) => this._up(e));
    root.addEventListener('pointercancel', (e) => this._up(e));
    root.addEventListener('contextmenu', (e) => e.preventDefault());

    // The overlay only starts existing when a finger says it should.
    addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') this.reveal();
    }, { capture: true });
  },

  _tool(name) {
    if (name === 'layout') {
      this.toggleLayout();
      if (this.onLayoutChange) this.onLayoutChange(this.layout);
    } else if (name === 'start') {
      // A tap, not a hold: press it now and let go on the next frame.
      this.input.setAction('start', true);
      setTimeout(() => this.input.setAction('start', false), 60);
    } else if (name === 'full') {
      const el = document.documentElement;
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    }
  },

  /* ---------------------------- hit testing ---------------------------- */

  /** Rectangles are re-read per press: an orientation change moves them all. */
  _keysAt(x, y) {
    const hits = [];
    for (const key of this.root.querySelectorAll('.key')) {
      const r = key.getBoundingClientRect();
      if (r.width === 0) continue;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hits.push(key.dataset.act);
    }
    return hits;
  },

  _down(e) {
    if (e.target.closest && e.target.closest('.tool')) return;
    e.preventDefault();
    this.reveal();
    if (this.layout === 'peukalot') this._thumbDown(e);
    else this._padDown(e);
  },

  _move(e) {
    if (!this._pointers.has(e.pointerId)) return;
    e.preventDefault();
    // Sliding a thumb onto the next key is a press of that key — this is the
    // whole reason the hit-testing is done by hand.
    if (this.layout === 'peukalot') this._thumbMove(e);
    else this._padDown(e);
  },

  _up(e) {
    const held = this._pointers.get(e.pointerId);
    if (!held) return;
    this._pointers.delete(e.pointerId);
    for (const action of held.actions) this._refresh(action);
    if (held.stick) this.stick.hidden = true;
  },

  /** An action stays down while *any* pointer still asks for it. */
  _refresh(action) {
    let down = false;
    for (const p of this._pointers.values()) if (p.actions.has(action)) down = true;
    this.input.setAction(action, down);
  },

  _assign(pointerId, actions, extra = {}) {
    const previous = this._pointers.get(pointerId);
    const before = previous ? previous.actions : new Set();
    const next = new Set(actions);
    this._pointers.set(pointerId, { actions: next, ...extra });
    for (const action of next) this.input.setAction(action, true);
    for (const action of before) if (!next.has(action)) this._refresh(action);
  },

  /* ------------------------------- napit ------------------------------- */

  _padDown(e) {
    this._assign(e.pointerId, this._keysAt(e.clientX, e.clientY));
  },

  /* ----------------------------- peukalot ------------------------------ */

  /*
   * The stick is placed where the thumb lands rather than at a fixed spot.
   * A fixed stick on a phone means looking down to find it, and looking down
   * is the one thing a platformer cannot spare attention for.
   */
  _thumbDown(e) {
    const leftHalf = e.clientX < innerWidth / 2;
    if (leftHalf) {
      this.stick.hidden = false;
      this.stick.style.left = `${e.clientX}px`;
      this.stick.style.top = `${e.clientY}px`;
      this.stick.firstElementChild.style.transform = 'translate(-50%,-50%)';
      this._assign(e.pointerId, [], { stick: true, ox: e.clientX, oy: e.clientY });
    } else {
      // Right half: the lower two thirds jump, the top strip is the fart
      // button. Jump is the bigger target because it is pressed ten times
      // as often.
      const action = e.clientY < innerHeight * 0.34 ? 'run' : 'jump';
      this._assign(e.pointerId, [action]);
    }
  },

  _thumbMove(e) {
    const p = this._pointers.get(e.pointerId);
    if (!p || !p.stick) return;
    const dx = e.clientX - p.ox;
    const dy = e.clientY - p.oy;
    const actions = [];
    if (dx < -STICK_DEAD) actions.push('left');
    else if (dx > STICK_DEAD) actions.push('right');
    if (dy < -STICK_UP) actions.push('up');
    else if (dy > STICK_DOWN) actions.push('down');
    this._assign(e.pointerId, actions, { stick: true, ox: p.ox, oy: p.oy });

    const clamp = (v, n) => Math.max(-n, Math.min(n, v));
    this.stick.firstElementChild.style.transform =
      `translate(calc(-50% + ${clamp(dx, 30)}px), calc(-50% + ${clamp(dy, 30)}px))`;
  },

  _releaseAll() {
    this._pointers.clear();
    this.input.clearTouch();
    if (this.stick) this.stick.hidden = true;
  },

  diag() {
    return { layout: this.layout, visible: this.visible, pointers: this._pointers.size };
  },
};
