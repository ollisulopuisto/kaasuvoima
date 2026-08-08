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
  // Square and sawtooth waves carry harmonics all the way up; rolling off the
  // top takes the glare out without making anything sound muffled.
  const tame = ctx.createBiquadFilter();
  tame.type = 'lowpass';
  tame.frequency.value = 4800;
  tame.Q.value = 0.4;
  musicBus.connect(tame).connect(master);

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
  tame.connect(echo);
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

/**
 * Cartoon vocals, synthesised — no samples, same as everything else here.
 *
 * A voice is a buzzy source shaped by formants: two resonant peaks whose
 * positions are what make an "ee" an "ee" and an "ah" an "ah". Sliding the two
 * filters between vowel targets while the pitch bends gives a recognisable
 * "yeah" without anybody having to record one.
 *
 * Vowel formants (F1, F2) in Hz, rounded from the usual reference values.
 */
const VOWELS = {
  a: [730, 1090],
  e: [530, 1840],
  i: [270, 2290],
  o: [570, 840],
  u: [325, 700],
};

/**
 * @param {object} o
 * @param {string} o.word vowels to glide through, e.g. 'iea' for "yeah"
 * @param {number} o.pitch starting pitch in Hz
 * @param {number} o.bend pitch multiplier at the end
 */
function vox({ word = 'a', dur = 0.32, pitch = 230, bend = 1.2, gain = 0.28, delay = 0 }) {
  if (muted || !ensure()) return;
  const t0 = ctx.currentTime + delay;
  const vowels = [...word].map((v) => VOWELS[v] || VOWELS.a);
  const jitter = rnd(0.92, 1.1);
  const f0 = pitch * jitter;

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, f0 * bend), t0 + dur * 0.8);
  // A little vibrato is most of what separates a voice from a buzzer.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.5;
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = f0 * 0.03;
  lfo.connect(lfoAmt).connect(osc.frequency);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.03);
  env.gain.setValueAtTime(gain, t0 + dur * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  env.connect(sfxBus);

  // Two formants, each sliding through the vowels in turn.
  for (let band = 0; band < 2; band++) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = band === 0 ? 7 : 9;
    filter.frequency.setValueAtTime(vowels[0][band] * jitter, t0);
    vowels.forEach((v, i) => {
      if (i === 0) return;
      filter.frequency.linearRampToValueAtTime(
        v[band] * jitter, t0 + (dur * 0.85 * i) / (vowels.length - 1),
      );
    });
    const level = ctx.createGain();
    level.gain.value = band === 0 ? 1 : 0.6;
    osc.connect(filter).connect(level).connect(env);
  }

  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
  lfo.start(t0);
  lfo.stop(t0 + dur + 0.03);
}

/** Says something roughly `chance` of the time, so it never gets tiresome. */
function maybeVox(chance, opts) {
  if (Math.random() < chance) vox(opts);
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
    // Only now and then: a grunt on every single jump would be unbearable.
    maybeVox(0.18, { word: 'u', dur: 0.16, pitch: 300, bend: 0.8, gain: 0.14 });
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
    vox({ word: 'iea', dur: 0.36, pitch: 250, bend: 1.35, gain: 0.22, delay: 0.18 });
  },
  yeah: () => vox({ word: 'iea', dur: 0.4, pitch: 255, bend: 1.35, gain: 0.26 }),
  oof: () => vox({ word: 'ou', dur: 0.3, pitch: 240, bend: 0.6, gain: 0.24 }),
  letsgo: () => {
    vox({ word: 'eo', dur: 0.22, pitch: 250, bend: 1.1, gain: 0.24 });
    vox({ word: 'ou', dur: 0.26, pitch: 300, bend: 1.3, gain: 0.24, delay: 0.24 });
  },
  powerdown: () => {
    [784, 587, 440, 330].forEach((f, i) =>
      tone({ type: 'square', from: f, dur: 0.13, gain: 0.18, delay: i * 0.06 }));
    farty({ dur: 0.3, base: 110, gain: 0.16, wobble: 14, delay: 0.1, wet: 0.4 });
    maybeVox(0.5, { word: 'ou', dur: 0.28, pitch: 245, bend: 0.65, gain: 0.2, delay: 0.05 });
  },
  oneup: () => {
    [659, 784, 1047, 1319].forEach((f, i) =>
      tone({ type: 'triangle', from: f, dur: 0.13, gain: 0.2, delay: i * 0.08, detune: 6 }));
    vox({ word: 'uo', dur: 0.42, pitch: 280, bend: 1.5, gain: 0.24, delay: 0.24 });
  },
  die: () => {
    vox({ word: 'ou', dur: 0.5, pitch: 260, bend: 0.45, gain: 0.26 });
    tone({ from: 440, to: 700, dur: 0.14, gain: 0.22, hold: 0.4 });
    tone({ from: 700, to: 90, dur: 0.75, gain: 0.24, delay: 0.16, hold: 0.2, vibrato: 12 });
    farty({ dur: 0.6, base: 130, gain: 0.24, wobble: 11, delay: 0.16, wet: 0.9, vary: 0.4 });
  },
  clear: () => {
    vox({ word: 'iea', dur: 0.45, pitch: 260, bend: 1.4, gain: 0.26 });
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

/** What the audio engine is actually doing, for the debug overlay. */
export function audioDiag() {
  return {
    state: ctx ? ctx.state : 'none',
    master: master ? Number(master.gain.value.toFixed(2)) : 0,
    muted,
    track: Music.current || 'none',
  };
}

export const Sfx = {
  play(name) {
    const fn = SFX[name];
    if (fn) fn();
  },
  has: (name) => Object.prototype.hasOwnProperty.call(SFX, name),
  names: () => Object.keys(SFX),
  /**
   * Browsers only let audio start inside a user gesture, and a gesture can be
   * refused (or arrive before the context exists). So this is safe to call on
   * every input, and main.js does exactly that until the context is running —
   * one swallowed gesture must not mean a silent game for the whole session.
   */
  resume() {
    if (!ensure()) return false;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx.state === 'running';
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

  /*
   * A minor, swung hard. The harmonic frame is two bars: i (Am7) then iv (Dm7)
   * turning to V7 (E7) at the end, which is what makes the loop want to come
   * round again instead of just stopping.
   *
   * Bass and comp share that 32-step cycle deliberately. Earlier they ran at
   * different lengths, which put chords over the wrong roots — a phasing
   * melody is a different piece of music from a swinging one. The polyrhythm
   * now lives where it belongs, in the cymbals: a 12-step ride against the
   * 16-step bar, three against four, coming back round every four bars.
   *
   * The lead carries four phrases. The G# in every fourth bar is the raised
   * leading tone over the E7 — that one note is most of what separates this
   * from a modal vamp that never resolves.
   */
  map: {
    tempo: 138,
    swing: 0.22,
    lead: {
      wave: 'triangle', gain: 0.13, detune: 6, vibrato: 3, staccato: 0.75,
      // An octave below where this started. Square and triangle leads up around
      // C6 are genuinely piercing over a small speaker, and the tune was living
      // there permanently — the two "octave up" sections now reach that register
      // for a couple of passes instead of it being the default.
      octave: -12,
      phrases: [
        // statement
        [[0, 2], [3, 2], [5, 2], [7, 2],
          [10, 4], [7, 2], [5, 2],
          [3, 2], [5, 2], [8, 2], [7, 2],
          [5, 2], [2, 2], [11, 2], [0, 2]],
        // answer, an octave up and busier
        [[12, 2], [10, 2], [12, 2], [15, 2],
          [14, 4], [12, 2], [10, 2],
          [8, 2], [10, 2], [12, 2], [10, 2],
          [7, 2], [5, 2], [11, 2], [12, 2]],
        // riff: same shape three times, answered differently each bar
        [[7, 2], [null, 2], [7, 2], [10, 2],
          [7, 2], [null, 2], [5, 2], [3, 2],
          [5, 2], [null, 2], [8, 2], [5, 2],
          [3, 2], [null, 2], [11, 2], [0, 2]],
        // long notes, for contrast after all that movement
        [[0, 4], [7, 4],
          [10, 6], [7, 2],
          [8, 4], [5, 4],
          [2, 4], [11, 2], [0, 2]],
      ],
      notes: [[0, 2], [3, 2], [5, 2], [7, 2], [10, 4], [7, 2], [5, 2],
        [3, 2], [5, 2], [8, 2], [7, 2], [5, 2], [2, 2], [11, 2], [0, 2]],
    },
    comp: {
      wave: 'square', gain: 0.055, octave: -12, staccato: 0.28, attack: 0.006, hold: 0.2,
      notes: [
        [null, 3], [[0, 3, 7, 10], 1], [null, 2], [[0, 3, 7, 10], 1], [null, 3],
        [null, 2], [[0, 3, 7, 10], 1], [null, 3],
        [null, 3], [[-7, -4, 0, 3], 1], [null, 2], [[-7, -4, 0, 3], 1], [null, 3],
        [null, 2], [[-5, -1, 2, 5], 1], [null, 3],
      ],
    },
    bass: {
      wave: 'triangle', gain: 0.19, staccato: 0.55, attack: 0.005, hold: 0.35,
      accent: 'x..x..x.x..x..x.',
      notes: [
        [-24, 2], [-24, 1], [-17, 1], [-24, 2], [-22, 2],
        [-19, 2], [-17, 1], [-18, 1], [-19, 2], [-24, 2],
        [-19, 2], [-19, 1], [-12, 1], [-19, 2], [-17, 2],
        [-14, 2], [-12, 1], [-13, 1], [-14, 2], [-17, 2],
      ],
    },
    drums: {
      kick: 'x..x..x...x.x...',
      snare: '..g.x..g..g.x..g',
      hat: '..x...x...x...x.',
      ride: 'x..x.xx..x.x',
    },
  },

  /*
   * Same harmonic frame, driven harder: the bass walks in straight eighths so
   * the groove never lets up, and the phrases are shorter and more insistent.
   */
  level: {
    tempo: 156,
    swing: 0.2,
    lead: {
      wave: 'square', gain: 0.12, detune: 8, staccato: 0.7,
      octave: -12,
      phrases: [
        [[7, 2], [7, 1], [10, 1], [12, 2], [10, 2],
          [7, 2], [5, 2], [3, 2], [5, 2],
          [8, 2], [8, 1], [10, 1], [12, 2], [8, 2],
          [5, 2], [2, 2], [11, 2], [0, 2]],
        [[12, 4], [10, 2], [12, 2],
          [15, 2], [14, 2], [12, 2], [10, 2],
          [8, 4], [10, 2], [12, 2],
          [7, 2], [5, 2], [11, 2], [12, 2]],
        [[0, 2], [null, 2], [3, 2], [5, 2],
          [7, 2], [null, 2], [10, 2], [7, 2],
          [5, 2], [null, 2], [8, 2], [5, 2],
          [2, 2], [null, 2], [11, 2], [0, 2]],
        [[10, 2], [12, 2], [10, 2], [7, 2],
          [5, 4], [7, 2], [10, 2],
          [12, 2], [10, 2], [8, 2], [5, 2],
          [3, 2], [5, 2], [11, 2], [12, 2]],
      ],
      notes: [[7, 2], [7, 1], [10, 1], [12, 2], [10, 2], [7, 2], [5, 2], [3, 2], [5, 2],
        [8, 2], [8, 1], [10, 1], [12, 2], [8, 2], [5, 2], [2, 2], [11, 2], [0, 2]],
    },
    comp: {
      wave: 'sawtooth', gain: 0.04, octave: -12, staccato: 0.25, attack: 0.005, hold: 0.2,
      notes: [
        [null, 2], [[0, 3, 7, 10], 1], [null, 2], [[0, 3, 7, 10], 1], [null, 4],
        [[0, 3, 7, 10], 1], [null, 5],
        [null, 2], [[-7, -4, 0, 3], 1], [null, 2], [[-7, -4, 0, 3], 1], [null, 4],
        [[-5, -1, 2, 5], 1], [null, 5],
      ],
    },
    bass: {
      wave: 'triangle', gain: 0.2, staccato: 0.5, attack: 0.004, hold: 0.3,
      accent: 'x...x...x...x...',
      notes: [
        [-24, 1], [-24, 1], [-17, 1], [-24, 1], [-22, 1], [-24, 1], [-17, 1], [-20, 1],
        [-24, 1], [-24, 1], [-17, 1], [-24, 1], [-22, 1], [-19, 1], [-17, 1], [-22, 1],
        [-19, 1], [-19, 1], [-12, 1], [-19, 1], [-17, 1], [-19, 1], [-12, 1], [-15, 1],
        [-19, 1], [-19, 1], [-12, 1], [-14, 1], [-17, 1], [-17, 1], [-13, 1], [-17, 1],
      ],
    },
    drums: {
      kick: 'x...x..x..x.x...',
      snare: '..g.x..g..g.x.gg',
      hat: 'x.x.x.x.x.x.x.x.',
      ride: 'x..x.xx..x.x',
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
/** Belt and braces: one wake-up may never build more than this many steps. */
const MAX_STEPS_PER_TICK = 32;
/** One bar of build before a section change. */
const LEAD_IN_STEPS = 16;

/**
 * Every pass through a track picks the next arrangement off this list, so the
 * same eight bars never come back sounding the same twice in a row: parts drop
 * out and return, the lead jumps an octave, the key steps up, one pass runs at
 * double time. Straight out of the NES playbook.
 */
const VARIATIONS = [
  { label: 'full' },
  { label: 'no harmony', drop: ['harm'] },
  { label: 'breakdown', drop: ['lead'], busyHats: true },   // the only one without a tune
  { label: 'lead octave up', leadOctave: 12 },
  { label: 'stripped', drop: ['comp', 'drums'], swingBoost: 0.06 },
  { label: 'thin comp', drop: ['harm', 'drums'] },
  { label: 'double time', speed: 2, drop: ['harm'] },
  { label: 'shout chorus', leadOctave: 12, swingBoost: 0.08 },
];

/**
 * Where the key goes, one entry per pass, and it is not arbitrary.
 *
 * Every move is to a closely related key — one step around the circle of
 * fifths, so the old and new keys share all but one note — and every one
 * resolves straight back to the tonic instead of drifting upwards forever:
 *
 *   I → I → IV → I → V → I → II → I
 *
 * The subdominant (+5) relaxes, the dominant (+7) lifts, and the one distant
 * move, the whole-tone step (+2), is the old pop "truck driver" lift, kept for
 * a single pass and then dropped. Two modulations never sit back to back.
 *
 * A key change is also prepared rather than lurched into: the fill bar before
 * one sounds the dominant of the key it is about to land in, which is the
 * oldest trick there is for making a new tonic sound inevitable.
 */
const KEY_PLAN = [0, 0, 5, 0, 7, 0, 2, 0];

/**
 * The arrangement, as sections rather than one-pass flips.
 *
 * A change that lasts a single pass sounds like a mistake being corrected: the
 * ear has barely registered the new tempo or key before it is gone. Give the
 * same change two or three passes and it reads as a decision. So every section
 * below holds for at least two passes, the key rides with the section instead
 * of flipping under it, and the bar before a change is a lead-in — a snare
 * build, and, when the tempo is about to move, a ramp into it rather than a
 * jump cut.
 */
/*
 * The arrangement. `phrase` picks which lead melody plays, so the tune itself
 * changes across the piece instead of the same eight bars coming back in a new
 * hat every time. No (phrase, key, variation) combination appears more than
 * twice in a full cycle, and a phrase never runs more than two passes in a row
 * — an identical loop is heard at most twice before something moves.
 *
 * Only one section drops the lead entirely (the breakdown). A tune that keeps
 * vanishing stops being the tune.
 */
const SECTIONS = [
  { variation: 0, passes: 2, key: 0, phrase: 0 },   // head
  { variation: 1, passes: 2, key: 0, phrase: 1 },   // answer phrase, thinner
  { variation: 3, passes: 2, key: 5, phrase: 2 },   // third tune, over to IV
  { variation: 0, passes: 2, key: 0, phrase: 0 },   // head again, home
  { variation: 2, passes: 2, key: 0, phrase: 0 },   // breakdown: no lead at all
  { variation: 5, passes: 2, key: 7, phrase: 3 },   // fourth tune, over to V
  { variation: 6, passes: 2, key: 2, phrase: 1 },   // double time, whole-tone lift
  { variation: 7, passes: 2, key: 0, phrase: 2 },   // shout chorus, back home
  { variation: 1, passes: 2, key: 0, phrase: 3 },   // last tune, thinned out
  { variation: 4, passes: 2, key: 0, phrase: 0 },   // strip it and breathe
];
const TOTAL_PASSES = SECTIONS.reduce((sum, s) => sum + s.passes, 0);

/** Which section a pass belongs to, and how many passes of it are left. */
function sectionAt(cycle) {
  let left = ((cycle % TOTAL_PASSES) + TOTAL_PASSES) % TOTAL_PASSES;
  for (let i = 0; i < SECTIONS.length; i++) {
    if (left < SECTIONS[i].passes) {
      return { section: SECTIONS[i], last: left === SECTIONS[i].passes - 1, index: i };
    }
    left -= SECTIONS[i].passes;
  }
  return { section: SECTIONS[0], last: false, index: 0 };
}

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
  _transpose: 0,
  _nextTranspose: 0,
  _nextStepDur: 0,
  _changing: false,
  _section: null,
  _loopLen: 16,
  _cycle: 0,
  _variation: VARIATIONS[0],
  _hurry: false,

  has: (name) => Object.prototype.hasOwnProperty.call(TRACKS, name),
  names: () => Object.keys(TRACKS),
  variation: () => Music._variation.label + (Music._changing ? ' >>' : ''),

  play(name) {
    if (this.current === name) return;
    this.stop();
    this.current = name;
    this._hurry = false;          // a fresh track always starts calm
    const track = TRACKS[name];
    if (muted || !track || !ensure()) return;

    this._track = track;
    this._voices = ['lead', 'harm', 'comp', 'bass']
      .filter((key) => track[key])
      .map((key) => ({ name: key, ...track[key], ...compile(track[key].notes) }));
    // A lead can carry several melodies; the section picks which one is on.
    const lead = this._voices.find((v) => v.name === 'lead');
    this._phrases = lead && lead.phrases
      ? lead.phrases.map((notes) => compile(notes))
      : null;
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
    const here = sectionAt(this._cycle);
    const next = sectionAt(this._cycle + 1);
    const v = VARIATIONS[here.section.variation];

    this._variation = v;
    this._section = here.section;
    // A lead-in only happens on the last pass of a section, and only when
    // something is actually about to change.
    this._changing = here.last && next.index !== here.index;
    this._transpose = here.section.key;
    if (this._phrases) {
      const lead = this._voices.find((v) => v.name === 'lead');
      const phrase = this._phrases[here.section.phrase % this._phrases.length];
      lead.map = phrase.map;
      lead.len = phrase.len;
    }
    this._nextTranspose = this._changing ? next.section.key : here.section.key;

    const rate = (speedOf) => 60 / (this._track.tempo * speedOf * (this._hurry ? HURRY_SPEED : 1)) / 4;
    this._stepDur = rate(v.speed || 1);
    this._nextStepDur = this._changing
      ? rate(VARIATIONS[next.section.variation].speed || 1)
      : this._stepDur;
    this._swing = (this._track.swing || 0) + (v.swingBoost || 0);
  },

  /**
   * Schedules everything that starts inside the lookahead window.
   *
   * The important part is the catch-up guard. `setTimeout` is throttled hard in
   * a background tab, so this can wake up seconds or minutes behind the audio
   * clock. Playing that backlog would mean building thousands of oscillators in
   * one turn of the event loop — the main thread stalls, and the whole game
   * stops responding to the keyboard for as long as it takes. Music that has
   * already gone past is music nobody can hear, so we drop it and resync to the
   * next bar instead.
   */
  _tick() {
    if (!this._voices || muted || !ctx) return;
    const now = ctx.currentTime;

    if (this._nextTime < now) {
      const behind = now - this._nextTime;
      const skipped = Math.ceil(behind / this._stepDur);
      // Land on a bar line so the arrangement and the drums stay in phase.
      const toBar = (this._loopLen - ((this._step + skipped) % this._loopLen)) % this._loopLen;
      this._step += skipped + toBar;
      this._nextTime = now + 0.05;
      this._cycle = Math.floor(this._step / this._loopLen);
      this._applyVariation();
    }

    const horizon = now + LOOKAHEAD_S;
    let scheduled = 0;
    while (this._nextTime < horizon && scheduled < MAX_STEPS_PER_TICK) {
      if (this._step > 0 && this._step % this._loopLen === 0) {
        this._cycle++;
        this._applyVariation();
      }
      const local = this._step % this._loopLen;
      // Inside the lead-in bar the step length slides toward the next section's
      // tempo, so a change of gear is heard coming instead of just happening.
      const leadFrom = this._loopLen - LEAD_IN_STEPS;
      const inLead = this._changing && local >= leadFrom;
      const dur = inLead
        ? this._stepDur + (this._nextStepDur - this._stepDur) * ((local - leadFrom) / LEAD_IN_STEPS)
        : this._stepDur;
      const swing = this._step % 2 ? this._swing * dur : 0;
      this._emit(this._step, this._nextTime + swing, inLead, dur);
      this._step++;
      this._nextTime += dur;
      scheduled++;
    }
    this._timer = setTimeout(() => this._tick(), TICK_MS);
  },

  _emit(step, rawAt, inLead = false, stepDur = this._stepDur) {
    // Never hand the audio clock a time that has already gone by: some browsers
    // throw on it, and the rest fire everything at once.
    const at = Math.max(ctx.currentTime, rawAt);
    const v = this._variation;
    const drop = v.drop || [];
    const local = step % this._loopLen;
    const delay = Math.max(0, at - ctx.currentTime);

    for (const voice of this._voices) {
      // The bass is never dropped and never transposed out of its riff: the
      // groove is the one thing every variation is allowed to lean on.
      if (voice.name !== 'bass' && drop.includes(voice.name)) continue;
      const note = voice.map.get(step % voice.len);
      if (!note) continue;
      const [semi, len] = note;
      const dur = len * stepDur;
      const octave = (voice.octave || 0) + (voice.name === 'lead' ? (v.leadOctave || 0) : 0);
      const accent = voice.accent && voice.accent[(step % voice.len) % voice.accent.length] === 'x';
      const chord = Array.isArray(semi) ? semi : [semi];
      for (const note of chord) {
        tone({
          type: voice.wave,
          from: freq(note + octave + this._transpose),
          dur: dur * (voice.staccato || 0.98),
          gain: voice.gain * (accent ? 1.5 : 1) / Math.sqrt(chord.length),
          attack: voice.attack || 0.012,
          hold: voice.hold || 0.62,
          detune: voice.detune || 0,
          vibrato: voice.vibrato || 0,
          vibratoRate: voice.vibratoRate || 6,
          bus: musicBus,
          delay,
        });
      }
    }

    const d = this._drums;
    if (!d || drop.includes('drums')) return;

    /*
     * The lead-in: a whole bar of snare building in density and volume, so the
     * section change lands on something instead of arriving out of nowhere. A
     * pass that is not changing anything gets the short half-bar fill instead.
     */
    if (inLead) {
      const t = (local - (this._loopLen - LEAD_IN_STEPS)) / LEAD_IN_STEPS;
      const dense = t > 0.5 || step % 2 === 0;
      if (dense) snareAt(at, 0.1 + t * 0.22);
      if (step % 4 === 0) kickAt(at, 0.34);
      if (local === this._loopLen - 1) hatAt(at, 0.18, true);
      if (this._nextTranspose !== this._transpose && t > 0.75) {
        const dominant = this._nextTranspose + 7 - 24;      // V of the target key
        tone({
          type: 'triangle',
          from: freq(dominant),
          dur: stepDur * 2,
          gain: 0.15,
          attack: 0.01,
          hold: 0.5,
          bus: musicBus,
          delay,
        });
      }
      return;
    }
    if (local >= this._loopLen - 2) {
      snareAt(at, local % 2 ? 0.14 : 0.2);
      return;
    }
    // Patterns are read modulo their own length, so a 12-step ride over a
    // 16-step bar is a 3-against-4 that walks around the beat for four bars
    // before it lines up again. That is where the polyrhythm comes from.
    const at_ = (pattern, mark) => pattern && pattern[step % pattern.length] === mark;
    if (at_(d.kick, 'x')) kickAt(at, 0.46);
    if (at_(d.snare, 'x')) snareAt(at, 0.24);
    if (at_(d.snare, 'g')) snareAt(at, 0.07);            // ghost note
    if (at_(d.hat, 'x') || (v.busyHats && step % 2 === 0)) hatAt(at, step % 4 === 0 ? 0.12 : 0.07);
    if (at_(d.hat, 'o')) hatAt(at, 0.11, true);
    if (at_(d.ride, 'x')) hatAt(at, 0.055, true);
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
