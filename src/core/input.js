const KEYMAP = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyZ: 'jump',
  Space: 'jump',
  KeyX: 'run',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  Enter: 'start',
  Escape: 'start',
  KeyM: 'mute',
  // macOS grabs most of the function row (Mission Control, brightness, and so
  // on), so the letters are the real bindings and the F-keys are a bonus for
  // whoever has them free.
  KeyK: 'quicksave',
  KeyL: 'quickload',
  KeyJ: 'slot',
  KeyI: 'debug',
  Backquote: 'debug',
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
  'quicksave', 'quickload', 'slot', 'debug'];

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
  _prev: blank(),
  anyKeyPressed: false,
  onFirstInput: null,

  install() {
    addEventListener('keydown', (e) => {
      const action = KEYMAP[e.code];
      if (action) {
        e.preventDefault();
        this._raw[action] = true;
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
