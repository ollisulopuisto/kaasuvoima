/**
 * Touch controls, in three layouts that are genuinely different rather than
 * three arrangements of the same thing.
 *
 *   rulla     The default. Same d-pad as `napit`, but the right hand gets one
 *             field instead of two buttons: the fart pad fills the corner where
 *             the flat of the thumb rests, and the jump circle sits inside it,
 *             up and left where the tip reaches. Touching anywhere in the field
 *             runs; rolling the tip onto the circle jumps *while still running*.
 *   napit     A visible d-pad and two separate buttons. Familiar, precise, and
 *             holding run while you jump takes a second thumb.
 *   peukalot  Nothing visible. The left half is a stick that appears where your
 *             thumb lands, the right half is jump. More game visible, less
 *             precision.
 *
 * Which one is better is not a question anyone can answer from a desk, so all
 * three ship and the switch is on screen.
 *
 * Why `rulla` exists, since the reasoning is easy to lose: on a phone, run has
 * to be *held* while you steer and jump, and two separate buttons make that a
 * two-thumb job on a one-thumb hand. Moving jump next to run does not fix it —
 * a finger is one point to every touchscreen ever built, so rolling the thumb
 * from one button to the next *releases* the first, which is precisely what
 * makes the d-pad work and precisely what ruins this. Overlapping rectangles
 * fix it: while the point is inside both, both are down.
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
 *      `touch-action: none` on it, or Android turns a jump into a scroll — but
 *      only while the page is at 1:1. A full-screen gesture ban also bans the
 *      pinch that undoes an accidental zoom, and a player stuck at 2x with the
 *      controls holding him there has a worse bug than the one being prevented.
 *      See `_guardZoom` and the `.zoomed` rules in styles.css.
 */

/*
 * The stored value is still a bare layout name, so the version does not move:
 * `rulla` is a new name in the same shape, and every value written by an older
 * build still reads back as itself. Bumping the key would throw away a choice
 * somebody made on purpose, which is the one thing a stored preference exists
 * to prevent. Only the *default* changed, and that is not stored.
 */
const KEY = 'sfb3.touch.v1';
export const LAYOUTS = ['rulla', 'napit', 'peukalot'];
const DEFAULT_LAYOUT = 'rulla';
export const LAYOUT_NAMES = { rulla: 'RULLA', napit: 'NÄPPÄIMET', peukalot: 'PEUKALOT' };

/** Movement thresholds for the floating stick, in CSS pixels. */
const STICK_DEAD = 14;
const STICK_UP = 26;
const STICK_DOWN = 30;

export const Touch = {
  installed: false,
  /** True once a real touch has happened — the overlay stays hidden until then. */
  visible: false,
  /** True while the browser reports the page zoomed in past 1:1. */
  zoomed: false,
  layout: DEFAULT_LAYOUT,
  input: null,
  root: null,
  _zones: [],
  _pointers: new Map(),

  install(input, { force = false } = {}) {
    if (this.installed || typeof document === 'undefined') return false;
    this.input = input;
    this.layout = this.loadLayout();
    this._build();
    this._guardZoom();
    this.installed = true;
    if (force) this.reveal();
    return true;
  },

  loadLayout() {
    try {
      const saved = localStorage.getItem(KEY);
      return LAYOUTS.includes(saved) ? saved : DEFAULT_LAYOUT;
    } catch {
      return DEFAULT_LAYOUT;
    }
  },

  setLayout(name) {
    this.layout = LAYOUTS.includes(name) ? name : DEFAULT_LAYOUT;
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
      <div class="zoomnote">SIVU ON ZOOMATTU<br>NIPISTÄ KAHDELLA SORMELLA PIENEMMÄKSI</div>
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

  /* ---------------------------- selaimen zoom --------------------------- */

  /*
   * Two things, both about the same accident: a double tap beside the canvas
   * zooms the page in, and the control overlay then makes it impossible to
   * zoom back out.
   *
   * The zoom itself is stopped in CSS — `touch-action: manipulation` on the
   * root element, which is the only mechanism that works, since iOS Safari has
   * ignored `user-scalable=no` since iOS 10. What is here is the belt to that
   * pair of braces and the way out if something zooms the page anyway.
   */
  _guardZoom() {
    /*
     * Belt: swallow the second tap of a double tap ourselves. Deliberately
     * narrow — one finger only, within 350 ms and 40 px of the first, and never
     * on the overlay, where the toolbar buttons are ordinary DOM and need the
     * synthetic click that `preventDefault` would eat. Nothing else on the page
     * listens for clicks, so outside the overlay there is nothing to break.
     */
    let lastTap = -Infinity;
    let lastX = 0;
    let lastY = 0;
    addEventListener('touchend', (e) => {
      if (e.touches.length) return;                     // still a pinch, leave it alone
      const t = e.changedTouches[0];
      if (!t) return;
      const el = t.target;
      if (el && el.closest && el.closest('#touch')) return;
      const now = performance.now();
      const near = Math.abs(t.clientX - lastX) < 40 && Math.abs(t.clientY - lastY) < 40;
      if (now - lastTap < 350 && near && e.cancelable) e.preventDefault();
      lastTap = now;
      lastX = t.clientX;
      lastY = t.clientY;
    }, { passive: false });

    /*
     * The way out: watch the visual viewport, and while it is zoomed let the
     * browser have its gestures back (see styles.css). The overlay is a
     * full-screen `touch-action: none`, so without this a page that got zoomed
     * — by an older iOS, by the accessibility zoom, by a build without this fix
     * — stays zoomed for good, and the game is unplayable with no way to say so.
     *
     * The class goes on the root element rather than on <body>, because that is
     * where the `touch-action` it has to override lives.
     */
    const vv = typeof visualViewport === 'undefined' ? null : visualViewport;
    if (!vv) return;
    const sync = () => this.setZoomed(vv.scale > 1.05);
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    sync();
  },

  setZoomed(on) {
    this.zoomed = !!on;
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('zoomed', this.zoomed);
    }
    return this.zoomed;
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
    /*
     * Mukana tuleva juoksu on **pito ilman reunaa**, ks. `Input.setAction`.
     * `rulla`-mallissa hyppyympyrä on juoksukentän sisällä, joten yksi sormi
     * antaa molemmat — se on mallin koko idea. Reunan antaisi vain se sormi
     * joka osui juoksukenttään *yksin*, koska valikoissa `run` on komento ja
     * komento kuuluu sille joka sitä pyysi.
     */
    const rides = next.has('run') && next.has('jump');
    for (const action of next) {
      this.input.setAction(action, true, !(rides && action === 'run'));
    }
    for (const action of before) if (!next.has(action)) this._refresh(action);
  },

  /* --------------------------- napit ja rulla --------------------------- */

  /*
   * Both button layouts run through here, and the difference between them is
   * entirely in the CSS. `_keysAt` returns *every* rectangle under the point,
   * so a layout that overlaps two of them gets both actions for one finger —
   * which is how `rulla` holds run through a jump. Nothing here knows about it.
   */
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
    return {
      layout: this.layout,
      visible: this.visible,
      zoomed: this.zoomed,
      pointers: this._pointers.size,
    };
  },
};
