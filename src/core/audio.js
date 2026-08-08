/**
 * Everything is synthesised at runtime — no audio files to ship.
 * The context stays suspended until the first real user gesture (browser policy).
 *
 * Signal chain:
 *   voices -> musicBus / sfxBus -> master -> limiter -> speakers
 *   musicBus also feeds a short feedback delay so the melodies get some air.
 */

let ctx = null;
let master = null;
let musicBus = null;
let sfxBus = null;
let noiseBuffer = null;
let muted = false;

const MASTER_GAIN = 0.8;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();

  // A gentle limiter keeps a wall of farts from clipping the output.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.22;
  limiter.connect(ctx.destination);

  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER_GAIN;
  master.connect(limiter);

  musicBus = ctx.createGain();
  musicBus.gain.value = 0.5;
  musicBus.connect(master);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.95;
  sfxBus.connect(master);

  // Slapback echo on the music only — a cheap sense of space.
  const echo = ctx.createDelay(0.5);
  echo.delayTime.value = 0.19;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.24;
  const wet = ctx.createGain();
  wet.gain.value = 0.16;
  musicBus.connect(echo);
  echo.connect(feedback).connect(echo);
  echo.connect(wet).connect(master);

  const frames = Math.floor(ctx.sampleRate * 2);
  noiseBuffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

const rnd = (a, b) => a + Math.random() * (b - a);

/* ----------------------------- primitives ------------------------------ */

/**
 * One oscillator with an ADSR-ish envelope. `bend` sweeps the pitch, `vibrato`
 * adds an LFO, `detune` layers a second slightly-off oscillator for thickness.
 */
function tone({
  type = 'square', from, to = from, dur = 0.1, gain = 0.3, delay = 0,
  attack = 0.006, hold = 0.55, detune = 0, vibrato = 0, vibratoRate = 6,
  bus = null, curve = 'exp',
}) {
  if (muted || !ensure()) return;
  const out = bus || sfxBus;
  const t0 = ctx.currentTime + delay;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  env.gain.setValueAtTime(gain, t0 + Math.max(attack, dur * hold));
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  env.connect(out);

  const oscs = [];
  const voices = detune ? [0, detune] : [0];
  for (const cents of voices) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.detune.value = cents;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== from) {
      if (curve === 'lin') osc.frequency.linearRampToValueAtTime(Math.max(1, to), t0 + dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    }
    osc.connect(env);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
    oscs.push(osc);
  }

  if (vibrato > 0) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = vibratoRate;
    const amt = ctx.createGain();
    amt.gain.value = vibrato;
    lfo.connect(amt);
    for (const osc of oscs) amt.connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.03);
  }
}

/** Filtered noise burst — the backbone of every flatulence in this game. */
function noise({
  dur = 0.25, from = 900, to = 120, q = 6, gain = 0.35, delay = 0,
  type = 'bandpass', attack = 0.02, bus = null,
}) {
  if (muted || !ensure()) return;
  const out = bus || sfxBus;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  src.loopStart = rnd(0, 1.5);           // a different slice of noise every time
  src.loopEnd = src.loopStart + 0.4;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(env).connect(out);
  src.start(t0, src.loopStart);
  src.stop(t0 + dur + 0.05);
}

/**
 * The house speciality. A sawtooth whose pitch is chewed up by a fast square
 * LFO gives the flutter; a band of noise on top gives the spray. Every call
 * jitters its own parameters, so no two farts are quite alike.
 */
function farty({
  dur = 0.3, base = 150, gain = 0.32, wobble = 24, delay = 0, wet = 0.5, vary = 1,
}) {
  if (muted || !ensure()) return;
  const t0 = ctx.currentTime + delay;
  const f0 = base * rnd(1 - 0.18 * vary, 1 + 0.22 * vary);
  const len = dur * rnd(1 - 0.12 * vary, 1 + 0.18 * vary);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f0 * 1.7, t0);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.5, t0 + len);

  // The flutter: a square LFO shoving the pitch around, slowing as it dies.
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.setValueAtTime(wobble * rnd(0.8, 1.3), t0);
  lfo.frequency.linearRampToValueAtTime(wobble * 0.4, t0 + len);
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.setValueAtTime(f0 * 0.7, t0);
  lfoAmt.gain.linearRampToValueAtTime(f0 * 0.2, t0 + len);
  lfo.connect(lfoAmt).connect(osc.frequency);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2200, t0);
  lp.frequency.exponentialRampToValueAtTime(420, t0 + len);
  lp.Q.value = 3;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  env.gain.setValueAtTime(gain, t0 + len * 0.45);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + len);

  osc.connect(lp).connect(env).connect(sfxBus);
  osc.start(t0);
  osc.stop(t0 + len + 0.03);
  lfo.start(t0);
  lfo.stop(t0 + len + 0.03);

  if (wet > 0) {
    noise({
      dur: len * 0.9, from: f0 * 8, to: f0 * 1.4, q: 4,
      gain: gain * 0.5 * wet, delay, attack: 0.015,
    });
  }
}

/* -------------------------------- drums -------------------------------- */

function kickAt(t0, gain = 0.5) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(155, t0);
  osc.frequency.exponentialRampToValueAtTime(44, t0 + 0.11);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  osc.connect(env).connect(musicBus);
  osc.start(t0);
  osc.stop(t0 + 0.2);
}

function snareAt(t0, gain = 0.28) {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  src.loopStart = rnd(0, 1.5);
  src.loopEnd = src.loopStart + 0.3;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1900;
  bp.Q.value = 0.9;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
  src.connect(bp).connect(env).connect(musicBus);
  src.start(t0, src.loopStart);
  src.stop(t0 + 0.18);

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(210, t0);
  body.frequency.exponentialRampToValueAtTime(120, t0 + 0.09);
  const benv = ctx.createGain();
  benv.gain.setValueAtTime(0.0001, t0);
  benv.gain.exponentialRampToValueAtTime(gain * 0.6, t0 + 0.004);
  benv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  body.connect(benv).connect(musicBus);
  body.start(t0);
  body.stop(t0 + 0.12);
}

function hatAt(t0, gain = 0.12, open = false) {
  if (!ctx) return;
  const dur = open ? 0.16 : 0.035;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  src.loopStart = rnd(0, 1.5);
  src.loopEnd = src.loopStart + 0.2;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7200;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(hp).connect(env).connect(musicBus);
  src.start(t0, src.loopStart);
  src.stop(t0 + dur + 0.02);
}

/* --------------------------------- sfx --------------------------------- */

const SFX = {
  jump: () => tone({ from: 300, to: 760, dur: 0.15, gain: 0.2, hold: 0.3, detune: 9 }),
  bigjump: () => {
    tone({ from: 240, to: 660, dur: 0.22, gain: 0.22, hold: 0.3, detune: 12 });
    farty({ dur: 0.16, base: 120, gain: 0.14, wobble: 30, wet: 0.3 });
  },
  fart: () => farty({ dur: 0.3, base: 150, gain: 0.32, wobble: 24 }),
  bigfart: () => farty({ dur: 0.46, base: 92, gain: 0.38, wobble: 17, wet: 0.8 }),
  squeak: () => farty({ dur: 0.14, base: 320, gain: 0.2, wobble: 42, wet: 0.35 }),
  flight: () => noise({ dur: 0.2, from: 420, to: 1600, q: 3, gain: 0.16, attack: 0.05 }),
  coin: () => {
    tone({ type: 'square', from: 988, dur: 0.06, gain: 0.18, hold: 0.7 });
    tone({ type: 'square', from: 1319, dur: 0.16, gain: 0.18, delay: 0.055, hold: 0.35, detune: 7 });
  },
  stomp: () => {
    noise({ dur: 0.13, from: 700, to: 130, q: 2, gain: 0.28 });
    tone({ type: 'triangle', from: 200, to: 60, dur: 0.12, gain: 0.24, hold: 0.2, curve: 'lin' });
  },
  land: () => noise({ dur: 0.07, from: 420, to: 120, q: 1.4, gain: 0.12 }),
  bump: () => tone({ type: 'triangle', from: 180, to: 110, dur: 0.09, gain: 0.24, hold: 0.25 }),
  brick: () => {
    noise({ dur: 0.2, from: 2600, to: 380, q: 1.1, gain: 0.28, type: 'highpass' });
    tone({ type: 'square', from: 260, to: 90, dur: 0.1, gain: 0.14, hold: 0.2 });
  },
  kick: () => tone({ type: 'sawtooth', from: 520, to: 150, dur: 0.13, gain: 0.2, hold: 0.2 }),
  cork: () => {
    // the pop of a bung going in, then the muffled protest of a blocked player
    tone({ type: 'sine', from: 900, to: 260, dur: 0.07, gain: 0.3, hold: 0.15, curve: 'lin' });
    farty({ dur: 0.22, base: 90, gain: 0.16, wobble: 12, wet: 0.15, delay: 0.06 });
  },
  soup: () => {
    [392, 523, 659].forEach((f, i) =>
      tone({ type: 'triangle', from: f, dur: 0.13, gain: 0.18, delay: i * 0.05 }));
    noise({ dur: 0.3, from: 300, to: 900, q: 5, gain: 0.1, delay: 0.1, attack: 0.12 });
  },
  powerup: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      tone({ from: f, dur: 0.11, gain: 0.18, delay: i * 0.055, hold: 0.5, detune: 8 }));
  },
  powerdown: () => {
    [784, 587, 440, 330].forEach((f, i) =>
      tone({ type: 'square', from: f, dur: 0.13, gain: 0.18, delay: i * 0.06 }));
    farty({ dur: 0.3, base: 110, gain: 0.16, wobble: 14, delay: 0.1, wet: 0.4 });
  },
  oneup: () => {
    [659, 784, 1047, 1319].forEach((f, i) =>
      tone({ type: 'triangle', from: f, dur: 0.13, gain: 0.2, delay: i * 0.08, detune: 6 }));
  },
  die: () => {
    tone({ from: 440, to: 700, dur: 0.14, gain: 0.22, hold: 0.4 });
    tone({ from: 700, to: 90, dur: 0.75, gain: 0.24, delay: 0.16, hold: 0.2, vibrato: 12 });
    farty({ dur: 0.6, base: 130, gain: 0.24, wobble: 11, delay: 0.16, wet: 0.9, vary: 0.4 });
  },
  clear: () => {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
      tone({ from: f, dur: 0.17, gain: 0.2, delay: i * 0.12, detune: 8 }));
    [1, 3, 5].forEach((i) => hatAt2(i * 0.12));
  },
  cursor: () => tone({ from: 620, dur: 0.05, gain: 0.14, hold: 0.4 }),
  select: () => tone({ from: 700, to: 1050, dur: 0.13, gain: 0.18, detune: 10 }),
  pipe: () => tone({ type: 'sawtooth', from: 400, to: 80, dur: 0.36, gain: 0.18, vibrato: 8 }),
  boss: () => {
    farty({ dur: 0.5, base: 62, gain: 0.36, wobble: 9, wet: 0.9, vary: 0.5 });
    tone({ type: 'sawtooth', from: 120, to: 46, dur: 0.45, gain: 0.16, detune: 14, hold: 0.5 });
  },
  card: () => tone({ from: 880, dur: 0.07, gain: 0.15, hold: 0.5 }),
  timewarn: () => {
    tone({ from: 1568, dur: 0.06, gain: 0.16 });
    tone({ from: 1568, dur: 0.06, gain: 0.16, delay: 0.12 });
  },
  door: () => {
    noise({ dur: 0.5, from: 200, to: 1200, q: 2, gain: 0.14, attack: 0.2 });
    tone({ type: 'triangle', from: 130, to: 240, dur: 0.5, gain: 0.12, hold: 0.6 });
  },
};

/** Standalone hi-hat for jingles (the sequencer's hat needs a start time). */
function hatAt2(delay) {
  if (muted || !ensure()) return;
  hatAt(ctx.currentTime + delay, 0.1, false);
}

export const Sfx = {
  play(name) {
    const fn = SFX[name];
    if (fn) fn();
  },
  has: (name) => Object.prototype.hasOwnProperty.call(SFX, name),
  names: () => Object.keys(SFX),
  resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  },
};

/* --------------------------------------------------------------------- */
/* Step sequencer for the background tracks.                              */
/* Notes are [semitoneOffsetFromA4 | null for rest, lengthInSixteenths].  */
/* Drum patterns are one character per sixteenth: x = hit, . = rest.      */
/* --------------------------------------------------------------------- */

const freq = (semi) => 440 * Math.pow(2, semi / 12);

/** Expands a note list into a step -> note map plus its total length. */
function compile(notes) {
  const map = new Map();
  let step = 0;
  for (const [semi, len] of notes) {
    if (semi !== null) map.set(step, [semi, len]);
    step += len;
  }
  return { map, len: step };
}

const TRACKS = {
  title: {
    tempo: 128,
    lead: {
      wave: 'square', gain: 0.15, detune: 9, octave: 12,
      notes: [
        [0, 2], [4, 2], [7, 2], [12, 6], [11, 2], [7, 2],
        [9, 2], [12, 2], [16, 2], [14, 6], [12, 2], [9, 2],
        [5, 2], [9, 2], [12, 2], [17, 6], [16, 2], [12, 2],
        [7, 4], [11, 4], [12, 8],
      ],
    },
    harm: {
      wave: 'triangle', gain: 0.07, octave: 0,
      notes: [
        [4, 4], [7, 4], [7, 4], [4, 4],
        [5, 4], [9, 4], [9, 4], [5, 4],
        [0, 4], [4, 4], [4, 4], [0, 4],
        [-1, 8], [0, 8],
      ],
    },
    bass: {
      wave: 'triangle', gain: 0.16, octave: 0,
      notes: [
        [-24, 4], [-24, 4], [-17, 4], [-24, 4],
        [-19, 4], [-19, 4], [-12, 4], [-19, 4],
        [-17, 4], [-17, 4], [-10, 4], [-17, 4],
        [-22, 4], [-19, 4], [-24, 8],
      ],
    },
    drums: {
      kick: 'x.......x...x...',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
    },
  },

  map: {
    tempo: 132,
    swing: 0.14,
    lead: {
      wave: 'triangle', gain: 0.15, detune: 7, vibrato: 3,
      notes: [
        [0, 2], [4, 2], [7, 2], [12, 2], [7, 2], [4, 2], [5, 4],
        [2, 2], [5, 2], [9, 2], [14, 2], [9, 2], [5, 2], [7, 4],
        [0, 2], [4, 2], [7, 2], [12, 4], [11, 2], [9, 2], [7, 2],
        [5, 2], [4, 2], [2, 2], [0, 4], [null, 4],
      ],
    },
    harm: {
      wave: 'square', gain: 0.05, octave: 12,
      notes: [
        [null, 4], [4, 2], [null, 2], [7, 2], [null, 6],
        [null, 4], [5, 2], [null, 2], [9, 2], [null, 6],
        [null, 4], [4, 2], [null, 2], [7, 2], [null, 6],
        [null, 8], [null, 8],
      ],
    },
    bass: {
      wave: 'triangle', gain: 0.16,
      notes: [
        [-24, 4], [-17, 4], [-24, 4], [-17, 4],
        [-22, 4], [-15, 4], [-22, 4], [-15, 4],
        [-24, 4], [-17, 4], [-24, 4], [-17, 4],
        [-19, 4], [-12, 4], [-24, 8],
      ],
    },
    drums: {
      kick: 'x.......x.......',
      snare: '....x.......x...',
      hat: '..x...x...x...x.',
    },
  },

  level: {
    tempo: 152,
    swing: 0.1,
    lead: {
      wave: 'square', gain: 0.13, detune: 8,
      notes: [
        [7, 2], [7, 2], [null, 2], [7, 2], [null, 2], [4, 2], [7, 4],
        [12, 4], [null, 4], [0, 4], [null, 4],
        [4, 4], [null, 2], [0, 2], [null, 2], [-3, 4], [null, 2],
        [2, 2], [4, 2], [null, 2], [3, 2], [2, 4],
        [0, 2], [7, 2], [9, 2], [5, 2], [7, 2], [null, 2], [4, 2], [2, 2],
      ],
    },
    harm: {
      wave: 'triangle', gain: 0.06, octave: 12,
      notes: [
        [null, 8], [4, 2], [null, 2], [7, 4],
        [null, 8], [0, 2], [null, 2], [4, 4],
        [null, 8], [-3, 2], [null, 2], [0, 4],
        [null, 8], [2, 2], [null, 2], [7, 4],
      ],
    },
    bass: {
      wave: 'triangle', gain: 0.17,
      notes: [
        [-24, 4], [-24, 4], [-17, 4], [-24, 4],
        [-20, 4], [-20, 4], [-13, 4], [-20, 4],
        [-22, 4], [-22, 4], [-15, 4], [-22, 4],
        [-24, 4], [-17, 4], [-24, 4], [-12, 4],
      ],
    },
    drums: {
      kick: 'x...x.....x.x...',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.xxx.',
    },
  },

  factory: {
    tempo: 168,
    lead: {
      wave: 'square', gain: 0.11, detune: 12,
      notes: [
        [0, 2], [null, 2], [0, 2], [3, 2], [0, 2], [null, 2], [-2, 2], [0, 2],
        [5, 2], [null, 2], [5, 2], [7, 2], [5, 2], [null, 2], [3, 2], [5, 2],
        [7, 2], [10, 2], [7, 2], [5, 2], [3, 2], [0, 2], [3, 4],
        [-2, 4], [0, 4], [null, 8],
      ],
    },
    harm: {
      wave: 'sawtooth', gain: 0.045, octave: -12,
      notes: [
        [0, 8], [3, 8], [5, 8], [7, 8],
        [3, 8], [0, 8], [-2, 8], [0, 8],
      ],
    },
    bass: {
      wave: 'square', gain: 0.14,
      notes: [
        [-24, 2], [-24, 2], [-12, 4], [-24, 2], [-24, 2], [-17, 4],
        [-19, 2], [-19, 2], [-7, 4], [-19, 2], [-19, 2], [-12, 4],
        [-22, 2], [-22, 2], [-10, 4], [-24, 4], [-24, 4],
      ],
    },
    drums: {
      // machine-shop stomp: heavy on the downbeat, metallic sixteenths
      kick: 'x...x...x..xx...',
      snare: '....x.......x..x',
      hat: 'xxxxxxxxxxxxxxxx',
    },
  },

  fortress: {
    tempo: 116,
    lead: {
      wave: 'sawtooth', gain: 0.1, vibrato: 5, vibratoRate: 5,
      notes: [
        [0, 2], [1, 2], [0, 2], [-2, 2], [0, 4], [null, 4],
        [-5, 2], [-4, 2], [-5, 2], [-7, 2], [-5, 4], [null, 4],
        [3, 2], [2, 2], [1, 2], [0, 2], [-1, 4], [-2, 4],
        [0, 8], [null, 8],
      ],
    },
    harm: {
      wave: 'triangle', gain: 0.05, octave: -12,
      notes: [
        [0, 8], [-5, 8], [-1, 8], [-5, 8],
        [0, 8], [-6, 8], [0, 16],
      ],
    },
    bass: {
      wave: 'triangle', gain: 0.15,
      notes: [
        [-24, 8], [-25, 8], [-24, 8], [-29, 8],
        [-24, 8], [-23, 8], [-24, 8], [-24, 8],
      ],
    },
    drums: {
      // slow ceremonial thuds, no hats — it should feel empty in here
      kick: 'x.......x.......',
      snare: '........x.......',
      hat: '................',
    },
  },

  boss: {
    tempo: 176,
    lead: {
      wave: 'sawtooth', gain: 0.12, detune: 16, vibrato: 4,
      notes: [
        [0, 2], [0, 2], [12, 2], [0, 2], [11, 2], [0, 2], [10, 2], [0, 2],
        [-2, 2], [-2, 2], [10, 2], [-2, 2], [8, 2], [-2, 2], [7, 2], [-2, 2],
        [-4, 2], [-4, 2], [8, 2], [-4, 2], [7, 2], [-4, 2], [5, 2], [-4, 2],
        [-5, 4], [7, 4], [6, 4], [5, 4],
      ],
    },
    harm: {
      wave: 'square', gain: 0.05, octave: 12,
      notes: [
        [null, 16], [null, 16], [null, 16],
        [0, 2], [null, 2], [0, 2], [null, 2], [-1, 2], [null, 2], [-2, 2], [null, 2],
      ],
    },
    bass: {
      wave: 'sawtooth', gain: 0.15,
      notes: [
        [-24, 2], [-24, 2], [-24, 2], [-12, 2], [-24, 2], [-24, 2], [-22, 2], [-20, 2],
        [-26, 2], [-26, 2], [-26, 2], [-14, 2], [-26, 2], [-26, 2], [-24, 2], [-22, 2],
        [-28, 2], [-28, 2], [-28, 2], [-16, 2], [-28, 2], [-28, 2], [-26, 2], [-24, 2],
        [-29, 4], [-29, 4], [-27, 4], [-26, 4],
      ],
    },
    drums: {
      kick: 'x..x..x.x..x..x.',
      snare: '....x.......x...',
      hat: 'xxxxxxxxxxxxxxxx',
    },
  },
};

const LOOKAHEAD_S = 0.15;
const TICK_MS = 45;

/**
 * Every pass through a track picks the next arrangement off this list, so the
 * same eight bars never come back sounding the same twice in a row: parts drop
 * out and return, the lead jumps an octave, the key steps up, one pass runs at
 * double time. Straight out of the NES playbook.
 */
const VARIATIONS = [
  { label: 'full' },
  { label: 'no harmony', drop: ['harm'] },
  { label: 'breakdown', drop: ['lead'], busyHats: true },
  { label: 'lead octave up', leadOctave: 12 },
  { label: 'stripped', drop: ['drums'], swingBoost: 0.06 },
  { label: 'up a tone', transpose: 2 },
  { label: 'double time', speed: 2, drop: ['harm'] },
  { label: 'up a fourth', transpose: 5, leadOctave: 12, swingBoost: 0.08 },
];

/** How much the tempo lifts once the level clock gets scary. */
const HURRY_SPEED = 1.4;

export const Music = {
  current: null,
  _timer: null,
  _voices: null,
  _drums: null,
  _track: null,
  _step: 0,
  _nextTime: 0,
  _stepDur: 0,
  _swing: 0,
  _loopLen: 16,
  _cycle: 0,
  _variation: VARIATIONS[0],
  _hurry: false,

  has: (name) => Object.prototype.hasOwnProperty.call(TRACKS, name),
  names: () => Object.keys(TRACKS),
  variation: () => Music._variation.label,

  play(name) {
    if (this.current === name) return;
    this.stop();
    this.current = name;
    this._hurry = false;          // a fresh track always starts calm
    const track = TRACKS[name];
    if (muted || !track || !ensure()) return;

    this._track = track;
    this._voices = ['lead', 'harm', 'bass']
      .filter((key) => track[key])
      .map((key) => ({ name: key, ...track[key], ...compile(track[key].notes) }));
    this._drums = track.drums || null;
    // One pass = the longest voice, rounded up to whole bars so the parts that
    // loop faster still land on the downbeat when the arrangement changes.
    const longest = Math.max(16, ...this._voices.map((v) => v.len));
    this._loopLen = Math.ceil(longest / 16) * 16;
    this._step = 0;
    this._cycle = 0;
    this._applyVariation();
    this._nextTime = ctx.currentTime + 0.08;
    this._tick();
  },

  stop() {
    this.current = null;
    this._voices = null;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  },

  /** Time-is-running-out mode: same tune, driven harder. */
  setHurry(on) {
    if (this._hurry === !!on) return;
    this._hurry = !!on;
    if (this._voices) this._applyVariation();
  },

  _applyVariation() {
    const v = VARIATIONS[this._cycle % VARIATIONS.length];
    this._variation = v;
    const speed = (v.speed || 1) * (this._hurry ? HURRY_SPEED : 1);
    this._stepDur = 60 / (this._track.tempo * speed) / 4;
    this._swing = (this._track.swing || 0) + (v.swingBoost || 0);
  },

  /** Schedules everything that starts inside the lookahead window. */
  _tick() {
    if (!this._voices || muted || !ctx) return;
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    while (this._nextTime < horizon) {
      if (this._step > 0 && this._step % this._loopLen === 0) {
        this._cycle++;
        this._applyVariation();
      }
      const swing = this._step % 2 ? this._swing * this._stepDur : 0;
      this._emit(this._step, this._nextTime + swing);
      this._step++;
      this._nextTime += this._stepDur;
    }
    this._timer = setTimeout(() => this._tick(), TICK_MS);
  },

  _emit(step, at) {
    const v = this._variation;
    const drop = v.drop || [];
    const local = step % this._loopLen;
    const delay = Math.max(0, at - ctx.currentTime);

    for (const voice of this._voices) {
      if (drop.includes(voice.name)) continue;
      const note = voice.map.get(step % voice.len);
      if (!note) continue;
      const [semi, len] = note;
      const dur = len * this._stepDur;
      const octave = (voice.octave || 0) + (voice.name === 'lead' ? (v.leadOctave || 0) : 0);
      tone({
        type: voice.wave,
        from: freq(semi + octave + (v.transpose || 0)),
        dur: dur * 0.98,
        gain: voice.gain,
        attack: 0.012,
        hold: 0.62,
        detune: voice.detune || 0,
        vibrato: voice.vibrato || 0,
        vibratoRate: voice.vibratoRate || 6,
        bus: musicBus,
        delay,
      });
    }

    const d = this._drums;
    if (!d || drop.includes('drums')) return;

    // The last half-bar of a pass turns into a fill announcing the change.
    if (local >= this._loopLen - 4) {
      snareAt(at, local % 2 ? 0.16 : 0.26);
      if (local === this._loopLen - 1) hatAt(at, 0.16, true);
      return;
    }
    const hit = (pattern) => pattern && pattern[step % pattern.length] === 'x';
    if (hit(d.kick)) kickAt(at, 0.42);
    if (hit(d.snare)) snareAt(at, 0.24);
    if (hit(d.hat) || (v.busyHats && step % 2 === 0)) hatAt(at, step % 4 === 0 ? 0.12 : 0.07);
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
    master.gain.value = MASTER_GAIN;
    Music.current = null;
    Music.play(wanted);
  }
  return muted;
}

export const isMuted = () => muted;
export const TRACK_NAMES = Object.keys(TRACKS);
