/**
 * Everything is synthesised at runtime — no audio files to ship.
 * The context stays suspended until the first real user gesture (browser policy).
 */

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);

  const frames = Math.floor(ctx.sampleRate * 0.5);
  noiseBuffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

function tone({ type = 'square', from, to = from, dur = 0.1, gain = 0.3, delay = 0 }) {
  if (muted || !ensure()) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Filtered noise burst — the backbone of every flatulence in this game. */
function noise({ dur = 0.25, from = 900, to = 120, q = 6, gain = 0.35, delay = 0, type = 'bandpass' }) {
  if (muted || !ensure()) return;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(env).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

const SFX = {
  jump: () => tone({ from: 320, to: 720, dur: 0.14, gain: 0.22 }),
  bigjump: () => tone({ from: 260, to: 640, dur: 0.2, gain: 0.24 }),
  fart: () => noise({ dur: 0.28, from: 1200, to: 90, q: 9, gain: 0.34 }),
  flight: () => noise({ dur: 0.18, from: 500, to: 1400, q: 4, gain: 0.18 }),
  coin: () => {
    tone({ type: 'square', from: 988, dur: 0.06, gain: 0.2 });
    tone({ type: 'square', from: 1319, dur: 0.14, gain: 0.2, delay: 0.06 });
  },
  stomp: () => noise({ dur: 0.12, from: 600, to: 140, q: 2, gain: 0.3 }),
  bump: () => tone({ type: 'triangle', from: 180, to: 110, dur: 0.08, gain: 0.25 }),
  brick: () => noise({ dur: 0.18, from: 2400, to: 400, q: 1.2, gain: 0.3, type: 'highpass' }),
  kick: () => tone({ type: 'sawtooth', from: 500, to: 160, dur: 0.12, gain: 0.2 }),
  powerup: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ from: f, dur: 0.1, gain: 0.2, delay: i * 0.06 }));
  },
  powerdown: () => {
    [784, 587, 440].forEach((f, i) => tone({ from: f, dur: 0.12, gain: 0.2, delay: i * 0.07 }));
  },
  oneup: () => {
    [659, 784, 1047, 1319].forEach((f, i) =>
      tone({ type: 'triangle', from: f, dur: 0.12, gain: 0.22, delay: i * 0.08 }));
  },
  die: () => {
    tone({ from: 440, to: 700, dur: 0.14, gain: 0.24 });
    tone({ from: 700, to: 90, dur: 0.7, gain: 0.26, delay: 0.16 });
    noise({ dur: 0.5, from: 800, to: 60, q: 7, gain: 0.2, delay: 0.16 });
  },
  clear: () => {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
      tone({ from: f, dur: 0.16, gain: 0.22, delay: i * 0.12 }));
  },
  cursor: () => tone({ from: 600, dur: 0.05, gain: 0.16 }),
  select: () => tone({ from: 700, to: 1000, dur: 0.12, gain: 0.2 }),
  pipe: () => tone({ type: 'sawtooth', from: 400, to: 80, dur: 0.35, gain: 0.2 }),
  boss: () => noise({ dur: 0.4, from: 300, to: 60, q: 5, gain: 0.4 }),
  card: () => tone({ from: 880, dur: 0.06, gain: 0.16 }),
};

export const Sfx = {
  play(name) {
    const fn = SFX[name];
    if (fn) fn();
  },
  resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  },
};

/* --------------------------------------------------------------------- */
/* Tiny note sequencer for the background tracks.                         */
/* Notes are [semitoneOffsetFromA4 | null for rest, sixteenths].          */
/* --------------------------------------------------------------------- */

const freq = (semi) => 440 * Math.pow(2, semi / 12);

const TRACKS = {
  map: {
    tempo: 132,
    wave: 'triangle',
    gain: 0.13,
    lead: [
      [0, 2], [4, 2], [7, 2], [12, 2], [7, 2], [4, 2], [5, 4],
      [2, 2], [5, 2], [9, 2], [14, 2], [9, 2], [5, 2], [7, 4],
      [0, 2], [4, 2], [7, 2], [12, 4], [11, 2], [9, 2], [7, 2],
      [5, 2], [4, 2], [2, 2], [0, 4], [null, 4],
    ],
    bass: [
      [-24, 4], [-17, 4], [-24, 4], [-17, 4],
      [-22, 4], [-15, 4], [-22, 4], [-15, 4],
      [-24, 4], [-17, 4], [-24, 4], [-17, 4],
      [-19, 4], [-12, 4], [-24, 8],
    ],
  },
  level: {
    tempo: 152,
    wave: 'square',
    gain: 0.11,
    lead: [
      [7, 2], [7, 2], [null, 2], [7, 2], [null, 2], [4, 2], [7, 4],
      [12, 4], [null, 4], [0, 4], [null, 4],
      [4, 4], [null, 2], [0, 2], [null, 2], [-3, 4], [null, 2],
      [2, 2], [4, 2], [null, 2], [3, 2], [2, 4],
      [0, 2], [7, 2], [9, 2], [5, 2], [7, 2], [null, 2], [4, 2], [2, 2],
    ],
    bass: [
      [-24, 4], [-24, 4], [-17, 4], [-24, 4],
      [-20, 4], [-20, 4], [-13, 4], [-20, 4],
      [-22, 4], [-22, 4], [-15, 4], [-22, 4],
      [-24, 4], [-17, 4], [-24, 4], [-12, 4],
    ],
  },
  factory: {
    tempo: 168,
    wave: 'square',
    gain: 0.1,
    lead: [
      [0, 2], [null, 2], [0, 2], [3, 2], [0, 2], [null, 2], [-2, 2], [0, 2],
      [5, 2], [null, 2], [5, 2], [7, 2], [5, 2], [null, 2], [3, 2], [5, 2],
      [7, 2], [10, 2], [7, 2], [5, 2], [3, 2], [0, 2], [3, 4],
      [-2, 4], [0, 4], [null, 8],
    ],
    bass: [
      [-24, 2], [-24, 2], [-12, 4], [-24, 2], [-24, 2], [-17, 4],
      [-19, 2], [-19, 2], [-7, 4], [-19, 2], [-19, 2], [-12, 4],
      [-22, 2], [-22, 2], [-10, 4], [-24, 4], [-24, 4],
    ],
  },
  fortress: {
    tempo: 116,
    wave: 'sawtooth',
    gain: 0.1,
    lead: [
      [0, 2], [1, 2], [0, 2], [-2, 2], [0, 4], [null, 4],
      [-5, 2], [-4, 2], [-5, 2], [-7, 2], [-5, 4], [null, 4],
      [3, 2], [2, 2], [1, 2], [0, 2], [-1, 4], [-2, 4],
      [0, 8], [null, 8],
    ],
    bass: [
      [-24, 8], [-25, 8], [-24, 8], [-29, 8],
      [-24, 8], [-23, 8], [-24, 8], [-24, 8],
    ],
  },
};

export const Music = {
  current: null,
  _timer: null,

  play(name) {
    if (this.current === name) return;
    this.stop();
    this.current = name;
    if (muted || !TRACKS[name] || !ensure()) return;
    this._schedule();
  },

  stop() {
    this.current = null;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  },

  _schedule() {
    const name = this.current;
    const track = TRACKS[name];
    if (!track || muted || !ctx) return;
    const beat = 60 / track.tempo / 4; // one sixteenth
    const t0 = ctx.currentTime + 0.06;

    const voice = (notes, wave, gain, detune) => {
      let at = 0;
      for (const [semi, len] of notes) {
        const dur = len * beat;
        if (semi !== null) {
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = wave;
          osc.frequency.value = freq(semi) * detune;
          env.gain.setValueAtTime(0.0001, t0 + at);
          env.gain.exponentialRampToValueAtTime(gain, t0 + at + 0.01);
          env.gain.setValueAtTime(gain, t0 + at + dur * 0.6);
          env.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur * 0.95);
          osc.connect(env).connect(master);
          osc.start(t0 + at);
          osc.stop(t0 + at + dur);
        }
        at += dur;
      }
      return at;
    };

    const leadLen = voice(track.lead, track.wave, track.gain, 1);
    const bassLen = voice(track.bass, 'triangle', track.gain * 1.1, 1);
    const loop = Math.max(leadLen, bassLen);

    this._timer = setTimeout(() => {
      if (this.current === name) this._schedule();
    }, loop * 1000 - 40);
  },
};

export function toggleMute() {
  const wanted = Music.current;
  muted = !muted;
  if (muted) {
    Music.stop();
    Music.current = wanted; // remember what should resume on unmute
    if (master) master.gain.value = 0;
  } else if (ensure()) {
    master.gain.value = 0.35;
    Music.current = null;
    Music.play(wanted);
  }
  return muted;
}

export const isMuted = () => muted;
