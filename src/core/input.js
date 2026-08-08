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
  Digit7: 'fx',
  Digit8: 'export',
  Digit9: 'debug',
  Digit0: 'mute',
  Numpad1: 'quicksave',
  Numpad2: 'quickload',
  Numpad3: 'slot',
  Backquote: 'debug',
  KeyM: 'mute',
  F5: 'quicksave',
  F6: 'slot',
  F8: 'quickload',
  F3: 'debug',
};

// Standard gamepad layout: face buttons, then d-pad.
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

const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'run', 'start', 'mute',
  'quicksave', 'quickload', 'slot', 'debug', 'export', 'fx'];

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
  anyKeyPressed: false,
  onFirstInput: null,

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
    });
    addEventListener('pointerdown', () => this._fireFirstInput());
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
    for (const a of ACTIONS) if (this._latched[a]) state[a] = true;
    this._latched = blank();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      for (const [index, action] of Object.entries(PADMAP)) {
        if (pad.buttons[index] && pad.buttons[index].pressed) state[action] = true;
      }
      const [ax, ay] = pad.axes;
      if (ax < -0.4) state.left = true;
      if (ax > 0.4) state.right = true;
      if (ay < -0.4) state.up = true;
      if (ay > 0.4) state.down = true;
    }

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
