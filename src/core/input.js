/*
 * Both hand positions are live at once, so there is no mode to pick:
 *
 *   arrows + Z/X          steering right hand, actions left hand
 *   WASD + K/L or ,/.     steering left hand, actions right hand
 *   space                 jump, whichever way round you sit
 *
 * Keys are `event.code`, i.e. physical positions, so a Finnish, US or Dvorak
 * layout all land in the same place. That matters most for the comma and
 * period, which move around a lot between layouts.
 */
const KEYMAP = {
  // steering
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
  // jump
  KeyZ: 'jump',
  Space: 'jump',
  KeyL: 'jump',
  Period: 'jump',
  Numpad0: 'jump',
  // run / fart
  KeyX: 'run',
  KeyK: 'run',
  Comma: 'run',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  NumpadEnter: 'run',
  Enter: 'start',
  Escape: 'start',
  // Utility keys live on the number row, well away from anything a thumb
  // reaches for mid-jump. These are `event.code` values, i.e. physical keys,
  // so they land in the same place whatever the keyboard layout says.
  // macOS eats most of the function row, so the F-keys are only a bonus.
  Digit1: 'quicksave',
  Digit2: 'quickload',
  Digit3: 'slot',
  Digit4: 'warp',
  /* Ajat nollaan. Toimii vain AIKA-AJOSSA ja kysyy ensin — ja se lukee sen
   * tilan taukovalikossa, joten tämä ei ole näkymätön näppäin vaan tilan oma. */
  Digit5: 'reset',
  Digit6: 'touch',
  Digit7: 'fx',
  Digit8: 'export',
  Digit9: 'debug',
  Digit0: 'mute',
  Numpad1: 'quicksave',
  Numpad2: 'quickload',
  Numpad3: 'slot',
  KeyM: 'mute',
  /*
   * `Backquote` used to open the developer overlay, and on a Mac ISO keyboard
   * that is the key **between left Shift and Z** — one key from jump. It was
   * being opened by accident mid-jump. On an ANSI board the same code sits
   * under Esc, which is why it looked safe when it was chosen.
   *
   * The lesson generalises: `event.code` is a physical position, but which
   * physical position depends on whether the board is ANSI or ISO, and the two
   * disagree exactly around the bottom-left corner where the action keys live.
   * Utility keys belong on the number row, which does not move.
   */
  F5: 'quicksave',
  F6: 'slot',
  F8: 'quickload',
  F3: 'debug',
};

/*
 * Standard gamepad layout: face buttons, then d-pad.
 *
 * The utility actions are **not** here, and that is on purpose: quicksave,
 * slot, effects, telemetry, mute and the debug overlay live on the number row
 * because a pad has nowhere to put nine more actions that a thumb will not hit
 * by accident mid-jump. A pad plays the game; a keyboard also administers it.
 */
const PADMAP = {
  0: 'jump',
  1: 'jump',
  2: 'run',
  3: 'run',
  9: 'start',
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};

/** How far a stick has to leave the middle before it is a direction. */
const DEADZONE = 0.4;

const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'run', 'start', 'mute',
  'quicksave', 'quickload', 'slot', 'debug', 'export', 'fx', 'touch', 'warp', 'reset'];

function blank() {
  const o = {};
  for (const a of ACTIONS) o[a] = false;
  return o;
}

export const Input = {
  held: blank(),
  pressed: blank(),
  released: blank(),
  _raw: blank(),
  _latched: blank(),
  _prev: blank(),
  /** Touch controls write here; see src/core/touch.js. */
  _touch: blank(),
  anyKeyPressed: false,
  onFirstInput: null,
  /**
   * Called on **every** real user gesture — a key or a pointer, never a pad.
   * Audio is the only caller and the reason the distinction exists: a browser
   * starts an AudioContext only inside a gesture, and a gamepad button is not
   * one. See src/main.js.
   */
  onGesture: null,
  /** Live pads seen in the last poll, and whether any of them said anything. */
  pads: 0,
  padInput: false,

  /**
   * Sets an action from something that is not a key. Presses are latched the
   * same way keys are, so a tap that starts and ends inside one frame still
   * counts — on a touchscreen that is not an edge case, it is how tapping works.
   */
  setAction(action, down) {
    if (!(action in this._touch)) return;
    this._touch[action] = !!down;
    if (down) this._latched[action] = true;
  },

  /**
   * Forgets every touch action *and* the press latch. Called when the touch
   * layout changes or a gesture is cancelled — cases where the presses that
   * were in flight are no longer meant. Without clearing the latch, switching
   * layout mid-press injects a phantom press on the next frame, which reads as
   * the character twitching for no reason.
   */
  clearTouch() {
    this._touch = blank();
    this._latched = blank();
  },

  install() {
    addEventListener('keydown', (e) => {
      const action = KEYMAP[e.code];
      if (action) {
        e.preventDefault();
        this._raw[action] = true;
        // Latch it as well. A quick tap can go down and up inside a single
        // frame, and without this the poll would look at an already-released
        // key and drop the press entirely.
        this._latched[action] = true;
      }
      // Gesture first, first-input second: the gesture handler is the one that
      // may still be trying to unlock the audio, and it must not find a track
      // already started by `onFirstInput` and restart it for nothing.
      this._fireGesture();
      this._fireFirstInput();
    });
    addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (action) {
        e.preventDefault();
        this._raw[action] = false;
      }
    });
    // A tab switch can swallow the keyup, which would leave a key stuck down.
    addEventListener('blur', () => {
      this._raw = blank();
      this._latched = blank();
      this._touch = blank();
    });
    addEventListener('pointerdown', () => {
      this._fireGesture();
      this._fireFirstInput();
    });
  },

  _fireGesture() {
    if (this.onGesture) this.onGesture();
  },

  _fireFirstInput() {
    if (this.onFirstInput) {
      const cb = this.onFirstInput;
      this.onFirstInput = null;
      cb();
    }
  },

  /** Folds gamepad state in and recomputes edges. Call once per fixed step. */
  poll() {
    const state = { ...this._raw };
    for (const a of ACTIONS) if (this._touch[a]) state[a] = true;
    for (const a of ACTIONS) if (this._latched[a]) state[a] = true;
    this._latched = blank();
    /*
     * `getGamepads()` is a snapshot of slots, not a list of pads: an unplugged
     * slot is `null`, the array can be shorter or longer than the pads on the
     * desk, and a browser without the API at all returns nothing. Everything
     * below therefore assumes the object is a stranger.
     */
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    let live = 0;
    let fromPad = false;
    for (const pad of pads) {
      if (!pad || pad.connected === false) continue;
      live++;
      const buttons = pad.buttons || [];
      for (const [index, action] of Object.entries(PADMAP)) {
        const b = buttons[index];
        // Old implementations exposed a button as a bare number, not an object.
        const down = b && (typeof b === 'object' ? b.pressed : b > 0.5);
        if (down) { state[action] = true; fromPad = true; }
      }
      /*
       * **Axes are read only from a pad that claims the standard mapping.**
       *
       * With `mapping !== 'standard'` the browser is saying it does not know
       * what the axes are. Axis 0 might be a stick, or a hat switch, or a
       * trigger that rests at -1 — and a trigger resting at -1 on axis 0 means
       * the player walks left forever without touching anything. The asymmetry
       * is the whole argument: **a wrong button is silent until you press it, a
       * wrong axis presses itself.** So the buttons above stay (a missing index
       * simply reads `undefined` and is skipped) and the sticks go quiet.
       *
       * Still unsupported, deliberately: hat-switch d-pads reported as an axis,
       * sticks on a non-standard pad, and remapping of any kind. The keyboard is
       * always there and it is always right.
       */
      if (pad.mapping !== 'standard') continue;
      const axes = pad.axes || [];
      const axis = (i) => (typeof axes[i] === 'number' && Number.isFinite(axes[i]) ? axes[i] : 0);
      const ax = axis(0);
      const ay = axis(1);
      if (ax < -DEADZONE) { state.left = true; fromPad = true; }
      if (ax > DEADZONE) { state.right = true; fromPad = true; }
      if (ay < -DEADZONE) { state.up = true; fromPad = true; }
      if (ay > DEADZONE) { state.down = true; fromPad = true; }
    }
    this.pads = live;
    this.padInput = fromPad;

    this.anyKeyPressed = false;
    for (const a of ACTIONS) {
      this.pressed[a] = state[a] && !this._prev[a];
      this.released[a] = !state[a] && this._prev[a];
      this.held[a] = state[a];
      if (this.pressed[a]) this.anyKeyPressed = true;
    }
    this._prev = state;
  },

  /** Consumes an edge so one press cannot trigger two things in a frame. */
  consume(action) {
    this.pressed[action] = false;
  },
};
