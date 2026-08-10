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
let sfxOut = null;
let bedBus = null;
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

  /*
   * The sfx path is two nodes, not one, and the gap between them is where a
   * room goes. Everything that makes a sound effect connects to `sfxBus`; the
   * dry signal and anything the room sends back both arrive at `sfxOut`, which
   * is the one thing that reaches the master. A send that returned to the
   * master would be a room built on the outside of the mixer, and a send that
   * returned to `sfxBus` would feed itself.
   */
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.95;
  sfxOut = ctx.createGain();
  sfxOut.connect(master);
  sfxBus.connect(sfxOut);

  // The per-level beds ride the sfx bus. Wind and cracking ice are things in
  // the world — the place making a noise — so they are on the diegetic side of
  // the line with the coins and the farts, and whatever the room does to those
  // it does to these. It also means they are muted, limited and *measured* on
  // the same meter as everything else the world makes.
  bedBus = ctx.createGain();
  bedBus.gain.value = 1;
  bedBus.connect(sfxBus);

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
 * Vowels can only ever glide, so for a long time every line in the game was one
 * long moan with a shape. Consonants are what put edges into speech, and they
 * are not one mechanism but three:
 *
 *   - **fricatives** (s, š, f, h) have no pitch at all. They are filtered noise:
 *     a narrow band up at 6 kHz is an "s", a broad low one is an "f" or an "h".
 *     Nothing of the voiced path is involved.
 *   - **plosives** (p, t, k) are *silence* and then a click. The silence is the
 *     consonant — a mouth closing is the only thing the ear has to go on, and a
 *     burst without it is a tap, not a "p". It is scheduled as its own segment
 *     of the plan for exactly that reason: it is a thing, not a gap.
 *   - **nasals** (m, n) are the voiced path with different numbers. The murmur
 *     sits low (F1 ~250 Hz) and almost nothing survives above it, which is what
 *     a closed mouth does. New filter targets, not new machinery.
 *
 * The word is split into segments and each segment is scheduled on its own. A
 * run of consecutive voiced letters is *one* oscillator gliding between its
 * targets, which is precisely what the whole word used to be — so a vowel-only
 * word ('iea', 'ou', 'eo', 'uo') comes out of the new path as one run over the
 * full duration, node for node and ramp for ramp what it was before.
 */

/**
 * The phoneme table. Letters are Finnish, because the game is.
 *
 *   kind 'v'  voiced    [F1, F2] in Hz, `lo`/`hi` the level of each formant
 *                       band, `w` how much of the sung time this target is
 *                       worth next to a vowel.
 *   kind 'f'  fricative [centre, Q] of the noise band, `s` its length in
 *                       seconds, `g` its level next to the other consonants.
 *   kind 'p'  plosive   `gap` seconds of closure, then an `s`-second burst.
 *
 * Consonant lengths are in seconds and vowels share out whatever is left, not
 * the other way round: a consonant is about as long in a slow word as in a fast
 * one, and stretching an "s" to fill a long line just sounds like a leak.
 *
 * The lines this game speaks use a e i o u m n s h p t. `š`, `f` and `k` are in
 * the table and spoken by nothing yet — which is a different thing from a sound
 * nobody triggers: a family here is one mechanism with a frequency in it, so
 * these are three rows of numbers rather than three code paths, and a phoneme
 * missing from the alphabet is a Finnish word that cannot be written.
 */
const PHONEMES = {
  a: { kind: 'v', f: [730, 1090], lo: 1, hi: 0.6, w: 1 },
  e: { kind: 'v', f: [530, 1840], lo: 1, hi: 0.6, w: 1 },
  i: { kind: 'v', f: [270, 2290], lo: 1, hi: 0.6, w: 1 },
  o: { kind: 'v', f: [570, 840], lo: 1, hi: 0.6, w: 1 },
  u: { kind: 'v', f: [325, 700], lo: 1, hi: 0.6, w: 1 },
  // Nasals: same two filters, F1 down in the murmur and the upper band shut
  // down to a tenth. `m` and `n` differ only in F2, which is the whole
  // difference between them in a real mouth too.
  //
  // `lo` is 0.5 and not 1 because it was measured. A bandpass down at 250 Hz
  // sits on the fundamental of a 230 Hz voice and passes it nearly whole, where
  // a vowel's F1 at 730 Hz only catches a harmonic worth a third of it — so at
  // equal level a nasal came out 0.81 against the vowel's 0.58, i.e. *louder*
  // than the mouth it is supposed to be closing. Halved, it sits just under.
  m: { kind: 'v', f: [250, 1100], lo: 0.50, hi: 0.06, w: 0.75 },
  n: { kind: 'v', f: [250, 1700], lo: 0.50, hi: 0.08, w: 0.75 },
  // Fricatives, in order of how high the hiss sits.
  s: { kind: 'f', band: [6200, 2.2], s: 0.075, g: 1 },
  'š': { kind: 'f', band: [2600, 1.6], s: 0.075, g: 1 },
  f: { kind: 'f', band: [1500, 0.7], s: 0.06, g: 0.7 },
  h: { kind: 'f', band: [1300, 0.5], s: 0.055, g: 0.55 },
  // Plosives. Finnish stops are unaspirated, so the burst is all there is
  // after the closure — no puff of breath behind it.
  p: { kind: 'p', gap: 0.035, band: [800, 1.0], s: 0.012, g: 0.8 },
  t: { kind: 'p', gap: 0.035, band: [3600, 1.4], s: 0.011, g: 1 },
  k: { kind: 'p', gap: 0.040, band: [1900, 1.2], s: 0.014, g: 0.9 },
};

/** A word may not spend more than this much of its length on consonants. */
const VOX_CONS_MAX = 0.7;

/**
 * What a line *says*, as a timed list of segments — separate from what it
 * sounds like, which is the voice (below) and is applied when the plan is
 * rendered. Exported because it is the seam the tests measure at: a plan can be
 * asserted exactly, where a waveform can only be measured.
 *
 * Unknown letters are **dropped**, where they used to be replaced with an 'a'.
 * With five-letter vowel words a substituted 'a' was harmless; with real words
 * it is not — "jippii" spelled 'ipii' is right, but a stray letter turning into
 * an extra "ah" adds a syllable that nobody wrote and it sounds like a bug in
 * the game rather than a typo in a word. Dropping degrades in the right
 * direction, because the letters this alphabet is missing are the approximants
 * (j, v, l, r), which are carried by the vowels around them anyway.
 *
 * A word that ends up with nothing in it at all falls back to a single 'a', so
 * a mistyped word is a wrong noise rather than no noise. A sound effect that
 * silently does nothing is the one failure that never gets reported.
 *
 * @param {string} word phonemes, e.g. 'hups' or 'iea'
 * @param {number} dur total length in seconds
 * @returns {Array<object>} segments with `kind` ('run' | 'silence' | 'burst' |
 *   'fric'), `at` seconds from the start of the word, and `dur`.
 */
export function voxPlan(word = 'a', dur = 0.32) {
  let letters = [...String(word)].map((c) => PHONEMES[c]).filter(Boolean);
  if (!letters.length) letters = [PHONEMES.a];

  let fixed = 0;
  let weight = 0;
  for (const p of letters) {
    if (p.kind === 'v') weight += p.w;
    else fixed += (p.gap || 0) + p.s;
  }
  // A short line with a lot of consonants in it must still have a voice in it.
  const squeeze = weight > 0 && fixed > dur * VOX_CONS_MAX
    ? (dur * VOX_CONS_MAX) / fixed
    : 1;
  const unit = weight > 0 ? (dur - fixed * squeeze) / weight : 0;

  const segs = [];
  let run = null;
  let at = 0;
  for (const p of letters) {
    if (p.kind === 'v') {
      if (!run) {
        run = { kind: 'run', at, dur: 0, targets: [] };
        segs.push(run);
      }
      run.targets.push({ f: p.f, lo: p.lo, hi: p.hi, w: p.w, at: 0 });
      run.dur += p.w * unit;
      at += p.w * unit;
      continue;
    }
    run = null;                              // a consonant always breaks the glide
    if (p.kind === 'p') {
      const gap = p.gap * squeeze;
      segs.push({ kind: 'silence', at, dur: gap });
      at += gap;
    }
    segs.push({
      kind: p.kind === 'p' ? 'burst' : 'fric',
      at,
      dur: p.s * squeeze,
      band: p.band,
      gain: p.g,
    });
    at += p.s * squeeze;
  }

  // When each target is reached inside its run. The last one lands at 85% of
  // the run so it is held rather than still moving when the note ends — which
  // is the rule the vowel-only version has always used.
  for (const seg of segs) {
    if (seg.kind !== 'run') continue;
    seg.targets[0].at = seg.at;
    const total = seg.targets.reduce((s, t) => s + t.w, 0) - seg.targets[0].w;
    let cum = 0;
    for (let i = 1; i < seg.targets.length; i++) {
      cum += seg.targets[i].w;
      seg.targets[i].at = seg.at + (seg.dur * 0.85 * cum) / total;
    }
  }
  return segs;
}

/**
 * What a line *sounds like*, as opposed to what it says.
 *
 * Everything in here is a property of the speaker and nothing in here is a
 * property of the line, which is the split that makes per-boss voices a table
 * entry instead of a rewrite: a boss says `vox({ word, voice: VOICES.whoever })`
 * and keeps every other argument. The action sounds — shockwave, landing,
 * spikes — deliberately stay shared, because a warning has to mean the same
 * thing whoever is making it.
 *
 * Two entries. The table sat here with one for as long as there was one
 * speaker — a voice nobody speaks with is the same mistake as a sound nobody
 * triggers — and the skeleton in world 6 is the first character with a reason
 * to have his own: he is the only one who says anything *at* the player.
 */
export const VOICES = {
  player: {
    wave: 'sawtooth',
    pitchScale: 1,          // transposes the speaker, not the line
    formant: 1,             // <1 is a bigger head: every formant target moves down
    q: [7, 9],              // how sharp the two formants are
    vibRate: 5.5,
    vibDepth: 0.03,
    hiss: 1,                // consonant level relative to the voiced path
    jitter: [0.92, 1.1],    // so no two takes are identical
  },
  /**
   * Luuranko, maailman 6 pomo. Every number here is the same number the player
   * has, moved in the direction "this is not a person":
   *
   *   - **kanttiaalto** eikä saha. A square wave is hollow where a sawtooth is
   *     rich, and hollow is exactly the thing being described.
   *   - **puoli sävelkorkeudesta.** Not "a lower man" but an octave down, which
   *     is far enough that nobody hears the player in it.
   *   - **loivat formantit** (q 3.5/4.5 vastaan 7/9). Sharp formants are what a
   *     mouth with soft tissue in it does; a skull has no soft tissue, so the
   *     resonances are broad and the vowels come out barely distinguishable.
   *     This is the one that makes it read as bone rather than as a big man.
   *   - **kaksinkertainen konsonantti** (hiss 2). The clatter is the point:
   *     what is loud about a skeleton is the parts that knock together.
   *   - **nopea ja matala vibrato**, ja leveämpi jitter: a rattle rather than a
   *     wobble, and no two takes alike.
   */
  luuranko: {
    wave: 'square',
    pitchScale: 0.5,
    formant: 0.82,
    q: [3.5, 4.5],
    vibRate: 9,
    vibDepth: 0.018,
    hiss: 2,
    jitter: [0.86, 1.18],
  },
};

/**
 * Makeup gain for the formant filters.
 *
 * `gain` is applied *after* two bandpass filters at Q 7 and 9, which throw away
 * most of a sawtooth's energy — so the number never meant what it said. Measured
 * on the sfx bus: a nominal 0.44 came out at a peak of 0.109, against 0.32 for a
 * coin and 0.57 for the death sound. Voices were a third the loudness of the
 * smallest sound effect in the game, which is why nobody could hear them.
 *
 * This is the measured ratio, not a guess. Re-measure it if the filters change.
 */
const VOX_MAKEUP = 4.0;

/**
 * The same question again for the noise path, and it does not have the same
 * answer — which is the whole reason there are two constants and not one.
 *
 * A vowel is a sawtooth squeezed through two very narrow peaks and loses almost
 * everything, hence the 4x above. A fricative is broadband noise through one
 * wide band and loses far less. Guessing which way that lands is exactly the
 * mistake the comment above was written about, so it was measured.
 *
 * On the sfx bus at a nominal gain of 0.44, three takes each, against a coin at
 * 0.32 and the death sound at 0.57:
 *
 *   vowel 'a'  0.584      (the voiced path, VOX_MAKEUP already in it)
 *   's' 0.320   'š' 0.242   'f' 0.192   'h' 0.162
 *   't' 0.279   'k' 0.258   'p' 0.139
 *   'm' 0.476   'n' 0.473
 *
 * Medians of five takes. The voiced ones repeat to three decimals; the noisy
 * ones wander some 15% either side, because every one of them takes a different
 * slice of the shared noise buffer, which is the whole point of taking one.
 *
 * The hiss constant came out at **1.0, and that is a measurement rather than a
 * default**: the noise path lands about 6 dB under the boosted vowel path on its
 * own, and noise has roughly three times the crest factor of a resonance, so in
 * RMS that is some 10 dB under — about the ratio a real /s/ has to the vowel
 * beside it. The click needed 1.4 to bring a burst up to the level of a coin,
 * and a burst can carry it: eleven milliseconds is far quieter than its peak.
 *
 * Re-measure both if the bands, their Q, or the noise buffer change.
 */
const VOX_HISS = 1.0;
const VOX_CLICK = 1.4;

/**
 * One noise segment: a fricative, or the burst that follows a plosive's silence.
 *
 * Three nodes, and the buffer is the shared one — a voice never allocates.
 */
function voxNoise(t0, dur, band, gain, attack, holdTo) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  src.loopStart = rnd(0, 1.5);             // a different slice of noise every time
  src.loopEnd = src.loopStart + 0.4;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = band[0];
  bp.Q.value = band[1];
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  env.gain.setValueAtTime(gain, t0 + Math.max(attack, dur * holdTo));
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(env).connect(sfxBus);
  src.start(t0, src.loopStart);
  src.stop(t0 + dur + 0.02);
}

/**
 * @param {object} o
 * @param {string} o.word phonemes to speak, e.g. 'hups' — see `voxPlan`
 * @param {number} o.pitch starting pitch in Hz
 * @param {number} o.bend pitch multiplier at the end
 * @param {object} o.voice who is speaking — see `VOICES`
 */
export function vox({
  word = 'a', dur = 0.32, pitch = 230, bend = 1.2, gain = 0.44, delay = 0,
  voice = VOICES.player,
}) {
  if (muted || !ensure()) return;
  const v = voice || VOICES.player;
  const t0 = ctx.currentTime + delay;
  const plan = voxPlan(word, dur);
  const jitter = rnd(v.jitter[0], v.jitter[1]);
  const f0 = pitch * v.pitchScale * jitter;
  const peak = gain * VOX_MAKEUP;
  // The pitch contour belongs to the line, not to any one segment of it: a word
  // broken by a stop picks the bend up where the closure interrupted it.
  const knee = dur * 0.8;
  const pitchAt = (x) => Math.max(40, f0 * Math.pow(bend, Math.min(1, x / knee)));

  // A little vibrato is most of what separates a voice from a buzzer. One LFO
  // for the whole line however many pieces it is made of.
  let lfoAmt = null;
  if (plan.some((seg) => seg.kind === 'run')) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = v.vibRate;
    lfoAmt = ctx.createGain();
    lfoAmt.gain.value = f0 * v.vibDepth;
    lfo.connect(lfoAmt);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.03);
  }

  plan.forEach((seg, index) => {
    const s = t0 + seg.at;
    const e = s + seg.dur;
    if (seg.kind === 'silence') return;      // the point of it is that nothing runs
    if (seg.kind !== 'run') {
      const isBurst = seg.kind === 'burst';
      voxNoise(
        s, seg.dur, seg.band,
        gain * seg.gain * v.hiss * (isBurst ? VOX_CLICK : VOX_HISS),
        isBurst ? 0.0015 : Math.min(0.012, seg.dur * 0.2),
        isBurst ? 0.25 : 0.7,
      );
      return;
    }

    const osc = ctx.createOscillator();
    osc.type = v.wave;
    osc.frequency.setValueAtTime(pitchAt(seg.at), s);
    const rampTo = Math.min(seg.at + seg.dur, knee);
    if (rampTo > seg.at) osc.frequency.exponentialRampToValueAtTime(pitchAt(rampTo), t0 + rampTo);
    if (lfoAmt) lfoAmt.connect(osc.frequency);

    /*
     * Both ends of a run are decided by what is next to it, not by the clock.
     *
     * A run that opens a word fades in over 30 ms, which is what a mouth
     * starting to make a sound does. A run that follows a consonant does not:
     * the mouth is already open and the consonant *is* the onset, so it takes
     * 8 ms. That is not a detail — a 30 ms fade after a stop burst smears the
     * one edge the burst exists to provide, and it is measurable: with the slow
     * attack, the closure detector in verify.mjs could not tell a plosive from a
     * vowel coming up slowly, and passed a build with the silence deleted.
     *
     * At the other end, the last run of a word dies away over its final 40%,
     * which is what a word ending does. A run followed by anything else is cut
     * short instead: before a plosive that cut *is* the closure, and a voice
     * ringing on into the silence would take the consonant away with it.
     */
    const last = index === plan.length - 1;
    const attack = Math.min(index === 0 ? 0.03 : 0.008, seg.dur * 0.25);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, s);
    env.gain.exponentialRampToValueAtTime(peak, s + attack);
    if (last) {
      env.gain.setValueAtTime(peak, Math.max(s + attack, s + seg.dur * 0.6));
      env.gain.exponentialRampToValueAtTime(0.0001, e);
    } else {
      const rel = Math.min(0.022, seg.dur * 0.35);
      env.gain.setValueAtTime(peak, Math.max(s + attack, e - rel));
      env.gain.linearRampToValueAtTime(0.0001, e);
    }
    env.connect(sfxBus);

    // Two formants, each sliding through this run's targets in turn. The band
    // levels slide with them, because that is where a nasal lives: same filters,
    // low first formant, next to nothing left above it.
    for (let band = 0; band < 2; band++) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = v.q[band];
      const level = ctx.createGain();
      seg.targets.forEach((tg, i) => {
        const hz = tg.f[band] * jitter * v.formant;
        const amp = band === 0 ? tg.lo : tg.hi;
        if (i === 0) {
          filter.frequency.setValueAtTime(hz, s);
          level.gain.setValueAtTime(amp, s);
        } else {
          filter.frequency.linearRampToValueAtTime(hz, t0 + tg.at);
          level.gain.linearRampToValueAtTime(amp, t0 + tg.at);
        }
      });
      osc.connect(filter).connect(level).connect(env);
    }

    osc.start(s);
    osc.stop(e + 0.03);
  });
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
    // "HUP" — the breath in front of it and the stop behind it are what make it
    // an effort rather than a vowel.
    maybeVox(0.18, { word: 'hup', dur: 0.2, pitch: 300, bend: 0.8, gain: 0.26 });
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
  burst: () => {
    /* A wall going down under a shoulder, not a brick popping off a bump.
     *
     * `brick` is already the sound of one tile letting go, and the charge fires
     * it once per tile — so this is the layer that says "that was a wall", and
     * it has to sit *under* the rubble rather than compete with it: a low
     * thump with a long gassy tail, where `brick` is a short bright crack.
     * Playing the same sound louder would only have sounded like a bug. */
    tone({ type: 'triangle', from: 150, to: 44, dur: 0.3, gain: 0.3, hold: 0.35, curve: 'lin' });
    noise({ dur: 0.34, from: 900, to: 160, q: 1.3, gain: 0.24 });
    farty({ dur: 0.26, base: 84, gain: 0.2, wobble: 10, wet: 0.6, delay: 0.05 });
  },
  sprout: () => {
    /*
     * A beanstalk leaving a block, and it has to be a *rising* sound that lasts
     * as long as the growing does.
     *
     * The three payouts a `?` block already has are all over in a tenth of a
     * second — `coin` chimes, `powerup` runs its arpeggio, `bump` thuds — and
     * every one of them says "here, take it". A beanstalk is not handed over;
     * it climbs for a second and a half, most of it above the top of the
     * screen, and the player has to know that what they started is still going
     * on up there. So this is the one block sound with a length to it: a wooden
     * knock as the bean pops out, then a filtered rustle and a glide that climb
     * together for the 1.4 s the eighteen tiles take (GROW_FRAMES in
     * entities/items.js). Nothing else on this bus rises and holds, which is
     * the point — DESIGN.md §8, a second signal that sounds like a first one is
     * worse than no signal.
     */
    tone({ type: 'square', from: 620, to: 300, dur: 0.07, gain: 0.2, hold: 0.2, curve: 'lin' });
    tone({
      type: 'triangle', from: 170, to: 560, dur: 1.35, gain: 0.11, hold: 0.7,
      delay: 0.05, curve: 'lin', vibrato: 5, vibratoRate: 7,
    });
    noise({ dur: 1.3, from: 260, to: 2600, q: 4, gain: 0.13, delay: 0.06, attack: 0.22 });
  },
  dive: () => {
    /*
     * MAAHANISKU, the fall. A dive lasts, so this lasts — the same argument
     * `sprout` makes above, run the other way up.
     *
     * `sprout` is the one block sound with a length to it because a beanstalk
     * climbs for a second and a half and the player has to know it is still
     * going on up there. A ground pound is the same shape of event and the
     * opposite motion: a wind-up you cannot cancel, then a drop you cannot
     * steer, and both of them are time the player spends waiting for something
     * they have already committed to. A short bark would have said "done" at
     * the moment nothing is done yet.
     *
     * So it is deliberately built as `sprout` inverted, and that is what keeps
     * the two apart in the ear rather than a difference in timbre: the glide
     * falls where the beanstalk's rises, the filter closes where the
     * beanstalk's opens, and the whole thing tightens instead of blooming. The
     * short attack at the front is the gas letting go; the fall is the ride.
     */
    farty({ dur: 0.22, base: 210, gain: 0.24, wobble: 30, wet: 0.3 });
    tone({
      type: 'triangle', from: 520, to: 120, dur: 0.55, gain: 0.12, hold: 0.6,
      delay: 0.04, curve: 'lin', vibrato: 6, vibratoRate: 9,
    });
    noise({ dur: 0.5, from: 2400, to: 300, q: 3.5, gain: 0.14, delay: 0.05, attack: 0.1 });
  },
  slam: () => {
    /*
     * MAAHANISKU, the arrival — and an arrival does not last.
     *
     * Fifth of a second against the dive's half, and everything about it is
     * front-loaded: the point of the pair is that the ear can tell the moment
     * the falling stops, which it can only do if the second sound is the shape
     * the first one is not.
     *
     * It also has to be distinguishable from `stomp`, which is the move this
     * one is not allowed to replace and which is playing constantly. `stomp` is
     * a 700→130 Hz brush with a 200 Hz body; this sits a whole octave under it
     * (110→34 Hz) and carries a wide low thud instead of a brush, so the two
     * read as "landed on something" versus "the floor took it". The farty layer
     * on the tail is what says whose floor it was.
     */
    tone({ type: 'triangle', from: 110, to: 34, dur: 0.2, gain: 0.34, hold: 0.3, curve: 'lin' });
    noise({ dur: 0.16, from: 520, to: 70, q: 0.9, gain: 0.3, attack: 0.004 });
    farty({ dur: 0.2, base: 70, gain: 0.22, wobble: 9, wet: 0.7, delay: 0.02 });
  },
  kurnutus: () => {
    /*
     * KURNUTTAJAN VAROITUS, ja se on ääni jolla on pituus — samasta syystä kuin
     * `sprout`illa.
     *
     * `sprout` on ainoa palikkaääni jolla on mittaa, koska pavunvarsi kasvaa
     * puolitoista sekuntia ja pelaajan pitää tietää että se on yhä käynnissä
     * jossain ruudun yläpuolella. Tässä on sama muoto ja eri asia: kuilun
     * pohjalta kuuluva kurnutus kestää 84 framea (`KURN_WARN`) ja koko sen ajan
     * se tarkoittaa "vielä ei, mutta pian". Lyhyt haukahdus olisi sanonut "nyt"
     * hetkellä jolloin mitään ei vielä tapahdu, ja se on juuri se valhe jota
     * varoitus ei saa kertoa.
     *
     * Mutta se ei ole `sprout` eikä `dive`, ja ero on **rytmissä eikä
     * sointivärissä**. Molemmat noista ovat yksi yhtenäinen liu'utus — toinen
     * ylös, toinen alas. Tämä on **kiihtyvä pulssijono**: seitsemän lyhyttä
     * kurahdusta joiden väli kutistuu 0,20 sekunnista 0,09:ään, eli ääni kertoo
     * paitsi että jotain tulee, myös *kuinka pian*. Mikään muu tällä väylällä ei
     * ole jono jonka tiheys muuttuu, ja juuri se on se piirre jonka korva
     * poimii melun seasta ilman että sitä tarvitsee opetella.
     *
     * Matala ja märkä, koska se tulee kolosta: perussävel putoaa 150 hertsistä
     * 96:een jonon mittaan, mikä on syvemmällä kuin `spikes` (140 -> 720,
     * nouseva) ja tukkoisempi kuin `boss` (yksi pitkä pieru). Sama sana kuin
     * pelin nimessä: kurnuttaa on kurnia, ja kurnia on vatsa.
     */
    let at = 0;
    for (let i = 0; i < 7; i++) {
      const f = 150 - i * 9;
      tone({
        type: 'triangle', from: f, to: f * 0.72, dur: 0.075, gain: 0.17,
        delay: at, hold: 0.35, curve: 'lin',
      });
      farty({ dur: 0.09, base: f * 1.35, gain: 0.1, wobble: 34, wet: 0.85, delay: at, vary: 0.2 });
      at += 0.20 - i * 0.018;
    }
    // A gulp of water under the whole run, so the pulses read as one animal
    // rather than as seven separate taps.
    noise({ dur: 1.25, from: 210, to: 90, q: 5, gain: 0.09, attack: 0.4 });
  },
  loikka: () => {
    /*
     * JA SE LÄHTEE. Varoitus kesti 1,4 sekuntia; tämä kestää 0,12, ja se on
     * pariskunnan koko idea — korva erottaa hetken jolloin odottaminen loppuu
     * vain jos jälkimmäinen ääni on sen muotoinen mitä edellinen ei ole.
     *
     * Se ei saa kuulostaa hypyltä (`jump`, siniliu'utus 300 -> 760) eikä
     * piikeiltä (`spikes`, saha 140 -> 720 puolen sekunnin mitassa). Tämä
     * lähtee 170:stä ja on 900:ssa kahdeksassa sadasosassa, eli se on sama
     * suunta mutta nelinkertainen kiire, ja sen alla on märkä läiskähdys jota
     * kummassakaan noista ei ole: se on se ääni jonka kuilun pohja päästää kun
     * jokin irtoaa siitä.
     */
    farty({ dur: 0.1, base: 250, gain: 0.26, wobble: 48, wet: 0.95, vary: 0.3 });
    tone({ type: 'square', from: 170, to: 900, dur: 0.08, gain: 0.2, hold: 0.2, curve: 'lin' });
    noise({ dur: 0.14, from: 320, to: 2400, q: 2.2, gain: 0.15, attack: 0.012 });
  },
  kick: () => tone({ type: 'sawtooth', from: 520, to: 150, dur: 0.13, gain: 0.2, hold: 0.2 }),
  spikes: () => {
    // Bone sliding out of a back. Rising, so it reads as a warning rather than
    // as something that has already happened, and scratchy enough to be heard
    // over the fortress track.
    tone({ type: 'sawtooth', from: 140, to: 720, dur: 0.42, gain: 0.16, hold: 0.35, detune: 11 });
    noise({ dur: 0.4, from: 600, to: 3000, q: 7, gain: 0.12, attack: 0.06 });
  },
  pop: () => {
    // A bubble skin letting go. Nothing already here is a pop: `cork` is a bung
    // going in and everything else is a fart, and this one fires often enough
    // to need its own short, dry sound.
    tone({ type: 'sine', from: 1500, to: 420, dur: 0.06, gain: 0.28, hold: 0.2, curve: 'lin' });
    noise({ dur: 0.07, from: 3400, to: 900, q: 1.2, gain: 0.16, type: 'highpass', attack: 0.004 });
  },
  upota: () => {
    /*
     * JUOKSUHIEKKA, the moment the sand takes hold — and the whole design of it
     * is "not a sweep and not wet".
     *
     * DESIGN.md §8: a second signal that sounds like a first one is worse than
     * no signal, and there are two first ones standing next to this. Lava and
     * meltwater are both *sweeps*: one filter sliding across a continuous band
     * of noise, which is exactly the shape `dive` and `flight` already use here
     * (`dive` runs 2400 → 300 Hz over half a second and would have been the
     * near-miss). Anything wet would come out of `farty`, which is the house
     * sound for gas through liquid, so `farty` is banned from this line and
     * `verify.mjs` reads the source to keep it banned.
     *
     * What is left is what sand actually is: **grains**. Six short bursts at
     * seventy milliseconds, each one narrow (Q 9, so it rings rather than
     * hisses) and each one lower than the last. Six of them make a rustle that
     * falls, nothing else on this bus is a train of anything, and the ear reads
     * a train as a *material* rather than as a movement.
     *
     * Under it, one very low body with no glide worth hearing (78 → 44 Hz over
     * nearly half a second). It is the weight of the stuff, and it is the part
     * that says the sound is about something big and slow — the same job the
     * long tail does in `slam`, at a fifth of the level, because this is not an
     * impact and must not land like one.
     */
    for (let i = 0; i < 6; i++) {
      noise({
        dur: 0.09, from: 1800 - i * 230, to: 900 - i * 120, q: 9,
        gain: 0.11, delay: i * 0.07, attack: 0.012,
      });
    }
    tone({ type: 'triangle', from: 78, to: 44, dur: 0.45, gain: 0.1, hold: 0.5, curve: 'lin' });
  },
  kahlaa: () => {
    /*
     * …and one struggle out of it. This one is allowed to be gas, because it
     * *is* gas — the same push that carries the fart jump — but it is muffled
     * by everything on top of it, and that is what keeps it from reading as the
     * jump it is not: `fart` is 0.3 s at 150 Hz and half wet, this is 0.13 s at
     * 118 Hz and almost dry. Short, low, choked. One grain on top of it ties it
     * back to `upota`, so the two read as one place rather than two events.
     */
    farty({ dur: 0.13, base: 118, gain: 0.2, wobble: 14, wet: 0.15 });
    noise({ dur: 0.1, from: 900, to: 320, q: 6, gain: 0.1, attack: 0.01 });
  },
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
    // "NAM" — the mouth is full, so the line is a nasal at both ends.
    vox({ word: 'nam', dur: 0.36, pitch: 250, bend: 1.35, gain: 0.44, delay: 0.18 });
  },
  /*
   * The game is Finnish and now it can say so. Every one of these was a vowel
   * glide before, which is why they all sounded like the same person going
   * "oooaaa" at different speeds — the words below are what tells them apart,
   * not the pitch. Spelling is phonetic: Finnish `j` is a glide out of an `i`,
   * so "JES" is 'ies' and "JIPPII" is 'ipii'.
   *
   * The `gain` numbers differ between these lines by more than a factor of two,
   * and that is a measurement rather than carelessness. `gain` never meant what
   * it said (see VOX_MAKEUP) and it means less than ever now: a word's peak
   * lands wherever its formant sweep happens to cross a harmonic, and a
   * five-target word samples more positions than a two-target one, so it wins
   * the maximum. Left at one number the lines came out between 0.31 and 0.81 —
   * eight decibels apart, which is one shouting and one mumbling. Measured on
   * the sfx bus, against a coin at 0.32 and the death sound at 0.57:
   *
   *   JES 0.56   AUTS 0.56   NO 0.47 / NIIN 0.50   NAM 0.56
   *   JIPPII 0.53   OHHOH 0.55   HIENOA 0.54
   *
   * HIENOA needed 0.28 to get there and NO needed 0.62. HUPS (0.40) and HUP
   * (0.36) are under the rest deliberately: one is a layer inside the powerdown
   * jingle and the other is a grunt on one jump in five.
   *
   * `oof` is still called from nowhere. It stays because it is the one line the
   * game is missing a place for rather than a word — see the report.
   */
  yeah: () => vox({ word: 'ies', dur: 0.4, pitch: 255, bend: 1.35, gain: 0.37 }),   // JES
  oof: () => vox({ word: 'auts', dur: 0.34, pitch: 240, bend: 0.6, gain: 0.39 }),   // AUTS
  letsgo: () => {
    vox({ word: 'no', dur: 0.22, pitch: 250, bend: 1.1, gain: 0.62 });              // NO
    vox({ word: 'nii', dur: 0.3, pitch: 300, bend: 1.3, gain: 0.62, delay: 0.24 }); // NIIN
  },
  powerdown: () => {
    [784, 587, 440, 330].forEach((f, i) =>
      tone({ type: 'square', from: f, dur: 0.13, gain: 0.18, delay: i * 0.06 }));
    farty({ dur: 0.3, base: 110, gain: 0.16, wobble: 14, delay: 0.1, wet: 0.4 });
    // "HUPS" — an oops, not a scream: the power is gone, the player is not.
    maybeVox(0.5, { word: 'hups', dur: 0.34, pitch: 245, bend: 0.65, gain: 0.34, delay: 0.05 });
  },
  oneup: () => {
    [659, 784, 1047, 1319].forEach((f, i) =>
      tone({ type: 'triangle', from: f, dur: 0.13, gain: 0.2, delay: i * 0.08, detune: 6 }));
    // "JIPPII" — the stop in the middle is what makes it two syllables.
    vox({ word: 'ipii', dur: 0.46, pitch: 280, bend: 1.5, gain: 0.38, delay: 0.24 });
  },
  die: () => {
    // "OHHOH", falling. The `h` breaks the moan in two, which is the difference
    // between a person and a siren.
    vox({ word: 'ohoo', dur: 0.5, pitch: 260, bend: 0.45, gain: 0.41 });
    tone({ from: 440, to: 700, dur: 0.14, gain: 0.22, hold: 0.4 });
    tone({ from: 700, to: 90, dur: 0.75, gain: 0.24, delay: 0.16, hold: 0.2, vibrato: 12 });
    farty({ dur: 0.6, base: 130, gain: 0.24, wobble: 11, delay: 0.16, wet: 0.9, vary: 0.4 });
  },
  clear: () => {
    // "HIENOA" — six phonemes over the jingle's first half, which is as long a
    // line as this synth stays intelligible for.
    vox({ word: 'hienoa', dur: 0.55, pitch: 260, bend: 1.4, gain: 0.28 });
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
      tone({ from: f, dur: 0.17, gain: 0.2, delay: i * 0.12, detune: 8 }));
    [1, 3, 5].forEach((i) => hatAt2(i * 0.12));
  },
  cursor: () => tone({ from: 620, dur: 0.05, gain: 0.14, hold: 0.4 }),
  select: () => tone({ from: 700, to: 1050, dur: 0.13, gain: 0.18, detune: 10 }),
  /*
   * AIKA-AJON välipiste. Kuva ilman ääntä jää huomaamatta juuri silloin kun
   * katse on kuilussa — ja jako vaihtuu nimenomaan silloin (DESIGN.md kohta 8).
   *
   * Ero on **suunnassa eikä sävyssä**: edellä nousee, jäljessä laskee, samalla
   * tavalla kuin nuoli osoittaa ylös tai alas. Molemmat ovat lyhyempiä ja
   * hiljaisempia kuin `coin` ja `select`, koska tämä on kertojan kuiskaus eikä
   * tapahtuma maailmassa: HUD ei ole ikkuna huoneeseen.
   */
  edella: () => tone({ from: 760, to: 1140, dur: 0.07, gain: 0.12, hold: 0.3 }),
  jaljessa: () => tone({ type: 'triangle', from: 600, to: 360, dur: 0.1, gain: 0.13, hold: 0.3 }),
  pipe: () => tone({ type: 'sawtooth', from: 400, to: 80, dur: 0.36, gain: 0.18, vibrato: 8 }),
  /**
   * Luurangon nauru, ja sen kaksi puoliskoa.
   *
   * "HEHHEH" puhuttuna omalla äänellään (`VOICES.luuranko`), ja sen alla
   * neljä lyhyttä kolmiosävelen naksausta jotka putoavat: se on se osa joka
   * kalisee. Nauru yksinään olisi vain matala mies; naksaukset yksinään
   * olisivat rekvisiittaa. Yhdessä ne ovat luuranko.
   *
   * Soitetaan silloin kun kruunu lähtee päästä eli kun pomoon voi taas osua —
   * ei sitä laitettaessa, koska varoituksella on jo äänensä ja kaksi merkkiä
   * samasta asiasta opettaa lukemaan väärää (DESIGN.md kohta 8).
   */
  luuranko: () => {
    vox({
      word: 'hehheh', dur: 0.5, pitch: 250, bend: 0.8, gain: 0.4, voice: VOICES.luuranko,
    });
    [1180, 980, 860, 760].forEach((f, i) => tone({
      type: 'triangle', from: f, to: f * 0.9, dur: 0.05, gain: 0.1,
      hold: 0.05, delay: 0.06 + i * 0.085,
    }));
  },
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

/* ---------------------------- rooms and beds ---------------------------- */

/**
 * Per-level audio treatment, keyed by the level's theme.
 *
 * The same idea as `THEME_AMBIENCE` in gfx/postfx.js, and deliberately the same
 * shape: what you hear belongs to the place you are in, not to a settings menu,
 * and a theme with nothing to say gets nothing. Grass is silent because there
 * is nothing to say about a field, and the factory is silent because its drum
 * track is already a machine shop.
 */
export const THEME_AMBIENCE = {
  fortress: 'hall',      // a big stone room — which is a reverb, not a sound
  desert: 'wind',        // a long way off, and never quite the same twice
  ice: 'crackle',        // something giving, somewhere you cannot see
  /* Kaasukehä saa saman tuulen kuin aavikko, ja se on uudelleenkäyttöä siinä
   * mielessä että tuuli on tuulta. Ilmavirta pilvikerroksen päällä ja ilmavirta
   * dyynin yllä ovat sama ilmiö samalla äänellä; oma synteesi niille olisi
   * kaksi tapaa sanoa sama asia, ja se on juuri se mitä DESIGN.md kohta 8
   * kieltää — huone värittää sen mikä on huoneessa, ja tässä huoneessa on
   * liikkuvaa ilmaa. Sama päätös kuin viimalla `backdrop.js`:ssä: hiukkaset
   * ovat aavikon hiukkasmoottori valkoisena, koska ne ovat sama asia. */
  cloud: 'wind',
};

/*
 * The stone hall, as a ConvolverNode over an impulse response generated here.
 *
 * The alternative was to grow the existing feedback delay into a reverb, and it
 * was rejected on the arithmetic. A hall's late tail is *dense* — thousands of
 * reflections a second — and getting that out of delay lines means eight or
 * more of them plus allpass diffusers, every length picked by ear until the
 * flutter stops, and it still rings on one note somewhere. An impulse response
 * is four lines of arithmetic, and it is tuned by number rather than by ear:
 * decay time, pre-delay, how fast the top comes off. One node instead of twenty
 * and no modes to chase.
 *
 * The slapback in `ensure()` stays exactly where it is. That is a 190 ms echo on
 * the music for a bit of air, which is a different job in every level.
 *
 * ---------------------------------------------------------------------------
 * IT HANGS OFF THE SFX PATH AND NOTHING ELSE. THIS IS THE RULE.
 *
 * The music is **non-diegetic**: nothing in the castle is playing it. It is the
 * narrator, and the narrator is not standing in the room — a film score does not
 * echo when the scene moves into a cave. So the room may not touch it, in this
 * level or any other, and the answer to "should X get the reverb too" is always
 * decided the same way: is X something in the world making a noise?
 *
 * Sound effects are **diegetic**: a coin, a stomp, a fart ball, a boss coming
 * down. Those are made by things standing on the stone, and the stone is exactly
 * what should colour them. The per-level beds are on the same side of the line —
 * the wind and the ice *are* the place — so they are in the room too.
 * ---------------------------------------------------------------------------
 */
const HALL_SECONDS = 0.95;
const HALL_PREDELAY = 0.018;
/**
 * How much room there is — one knob, because the convolver normalises the
 * impulse response, so this does not move when the decay time does.
 *
 * Deliberately modest. The first version was a cathedral — twice this wet over
 * twice the decay — and a cathedral is the wrong room for a game where a coin,
 * a stomp, a kick and a brick all fire inside one second: every one of them was
 * still ringing over the next three. Measured on the sfx path, as the time a
 * sound stays above a hundredth of its own peak:
 *
 *   stomp    ~95 ms dry ->  ~360 ms   (~910 ms as a cathedral)
 *   brick   ~135 ms dry ->  ~330 ms
 *   coin    ~190 ms dry ->  ~590 ms
 *
 * Roughly three times the ring, not ten. Long enough to hear the walls, short
 * enough that the next sound still arrives on its own.
 */
const HALL_WET = 0.55;
const HALL_FADE = 0.5;

let hall = null;

function hallImpulse() {
  const rate = ctx.sampleRate;
  const pre = Math.floor(rate * HALL_PREDELAY);
  const len = Math.floor(rate * HALL_SECONDS);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    // Independent noise per channel, so the tail is wide rather than a mono
    // blob sitting on top of the tune.
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      // A one-pole lowpass that closes as the tail dies. Air and stone eat the
      // top first; without it this is hiss with an envelope on it.
      lp += ((Math.random() * 2 - 1) - lp) * (0.5 - 0.42 * t);
      d[i] = lp * Math.exp(-6.2 * t);            // ~-54 dB by the end
    }
  }
  return buf;
}

function buildHall() {
  const conv = ctx.createConvolver();
  conv.buffer = hallImpulse();
  /*
   * What goes into a room decides whether it is a room or a mess. The bass is
   * cut because a tail built out of the kick and the bassline is the definition
   * of mush, and the top because half the sounds in this game are filtered
   * noise and they would come back as a wash of hiss.
   */
  const cut = ctx.createBiquadFilter();
  cut.type = 'highpass';
  cut.frequency.value = 240;
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 2600;
  const wet = ctx.createGain();
  wet.gain.value = 0.0001;
  cut.connect(damp).connect(conv).connect(wet).connect(sfxOut);
  return { in: cut, wet, sending: false };
}

/**
 * Opens and closes the send. Closing it rather than only turning the wet down
 * matters: a convolver with nothing connected to it stops costing anything once
 * its tail has run out, and a level with no stone in it should not be paying
 * for a convolution it cannot hear.
 */
function hallSend(on) {
  if (!hall || hall.sending === on) return;
  hall.sending = on;
  if (on) sfxBus.connect(hall.in);
  else sfxBus.disconnect(hall.in);
}

/**
 * Measured on the master sum, against a coin at 0.256: the wind peaks between
 * 0.018 and 0.045 depending on where the swell is, so 15 to 23 dB under the
 * smallest sound effect in the game and 17 dB under the music. The swell used
 * to reach further down than this and the bed simply vanished for half a minute
 * at a time — a different failure from being too loud, but just as much one.
 */
const WIND_GAIN = 0.062;

/**
 * Distant desert wind: two noise loops through a lowpass, with slow LFOs on the
 * colour and on the level.
 *
 * Ten nodes, started once and stopped once. The LFO rates do not divide into
 * each other and the two loops run at unrelated speeds, because one two-second
 * noise loop on its own starts to sound like a two-second noise loop.
 */
function buildWind() {
  const out = ctx.createGain();
  out.gain.value = WIND_GAIN;
  out.connect(bedBus);
  const swell = ctx.createGain();
  swell.gain.value = 0.8;
  swell.connect(out);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 520;
  lp.Q.value = 0.9;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 170;              // out of the way of the bassline
  hp.connect(lp).connect(swell);

  const nodes = [];
  for (const rate of [0.61, 1]) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    src.playbackRate.value = rate;
    src.connect(hp);
    nodes.push(src);
  }
  const lfo = (rate, amount, target) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = rate;
    const amt = ctx.createGain();
    amt.gain.value = amount;
    osc.connect(amt).connect(target);
    nodes.push(osc);
  };
  lfo(0.071, 230, lp.frequency);
  lfo(0.043, 0.24, swell.gain);

  const t0 = ctx.currentTime;
  for (const n of nodes) n.start(t0);
  return { out, nodes };
}

/**
 * Ice giving somewhere out of sight.
 *
 * A handful of nodes for a tenth of a second, once every ten seconds or so.
 * That is four orders of magnitude away from the per-frame oscillator problem,
 * and it is the only shape this can take: a crack is an event, and an event
 * held open is a drone.
 *
 * The gap is random inside a wide range on purpose. Anything regular turns into
 * a tick, and a tick is a second metronome for the music to fight.
 */
const CRACK_GAP = [6.5, 16];

function crack() {
  const near = rnd(0.45, 1);             // some of them are much further off
  noise({
    dur: 0.05, from: 1900 * near, to: 320, q: 6,
    gain: 0.085 * near, attack: 0.002, bus: bedBus,
  });
  // The groan under it. Distance takes the snap away long before it takes this.
  tone({
    type: 'triangle', from: 150 * near, to: 62, dur: 0.55, gain: 0.05 * near,
    hold: 0.1, curve: 'lin', bus: bedBus,
  });
  // A crack that runs: a sheet failing in more than one place at once.
  if (Math.random() < 0.4) {
    noise({
      dur: 0.035, from: 2400 * near, to: 500, q: 7,
      gain: 0.06 * near, attack: 0.002, delay: rnd(0.09, 0.26), bus: bedBus,
    });
  }
}

/** How long a bed keeps sounding after the last `hold`, and how often we look. */
const BED_HOLD_MS = 320;
const BED_WATCH_MS = 90;

export const Ambience = {
  /** The bed the current level asked for, or null. */
  current: null,
  live: false,
  _held: 0,
  _timer: null,
  _wind: null,
  _nextCrack: 0,
  _gust: 0,

  /**
   * Chooses the bed from the level's theme, exactly as `PostFX.setAmbience`
   * chooses the picture's — and a level flag outranks the table here for the
   * same reason it does there: the night level is windy because *that level* is
   * windy, not because everything sharing its palette is.
   */
  set(theme, def = null) {
    const kind = (def && def.wind ? 'wind' : null) || THEME_AMBIENCE[theme] || null;
    if (kind !== this.current) {
      this.stop();
      this.current = kind;
    }
    this.hold();
    return kind;
  },

  /**
   * The scene saying "I am still here", once a frame.
   *
   * This is a dead man's switch, and that is the whole point. A bed that had to
   * be *told* to stop would outlive the first exit path somebody forgot about,
   * and there are several: dying, the clear jingle, the pause key, a save-state
   * load, a demo handing the machine back, the title screen. None of those runs
   * the level's `update`, so all of them silence the bed without knowing it
   * exists. This project has already shipped one drone that survived a scene
   * change; the fix for the second one should not be a list of call sites.
   *
   * @param {number} gust 0..1 — the wind the level is currently pushing with.
   */
  hold(gust = 0) {
    if (!this.current) return;
    this._held = performance.now();
    this._gust = gust;
    if (!this.live) this._start();
    if (!this._timer && this.live) this._timer = setTimeout(() => this._watch(), BED_WATCH_MS);
  },

  /** Immediate and final: the level is over, not merely paused. */
  stop() {
    this.current = null;
    this._silence();
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  },

  _start() {
    if (!ensure()) return;
    this.live = true;
    if (this.current === 'hall') {
      if (!hall) hall = buildHall();
      hallSend(true);
      const t = ctx.currentTime;
      hall.wet.gain.cancelScheduledValues(t);
      hall.wet.gain.setValueAtTime(Math.max(0.0001, hall.wet.gain.value), t);
      hall.wet.gain.exponentialRampToValueAtTime(HALL_WET, t + HALL_FADE);
    } else if (this.current === 'wind') {
      this._wind = buildWind();
    } else if (this.current === 'crackle') {
      // Not on the first frame: a crack the instant a level starts reads as a
      // sound effect the player caused.
      this._nextCrack = ctx.currentTime + rnd(2, 5);
    }
  },

  /** Stops the nodes but remembers what we are, so unpausing brings it back. */
  _silence() {
    if (!this.live) return;
    this.live = false;
    if (!ctx) return;
    const t = ctx.currentTime;
    if (hall) {
      hall.wet.gain.cancelScheduledValues(t);
      hall.wet.gain.setValueAtTime(Math.max(0.0001, hall.wet.gain.value), t);
      hall.wet.gain.exponentialRampToValueAtTime(0.0001, t + HALL_FADE);
      hallSend(false);
    }
    const w = this._wind;
    if (w) {
      this._wind = null;
      // Ramped, not cut. A looping noise source stopped on a whim is a click.
      w.out.gain.cancelScheduledValues(t);
      w.out.gain.setValueAtTime(w.out.gain.value, t);
      w.out.gain.linearRampToValueAtTime(0, t + 0.3);
      for (const n of w.nodes) n.stop(t + 0.35);
    }
  },

  _watch() {
    this._timer = null;
    if (!this.live) return;
    if (performance.now() - this._held > BED_HOLD_MS) {
      this._silence();
      return;
    }
    this._pump();
    this._timer = setTimeout(() => this._watch(), BED_WATCH_MS);
  },

  /**
   * Everything a live bed does over time. Eleven times a second, not sixty:
   * the gust takes two seconds to build and a crack is ten seconds away, so
   * there is nothing here that a frame rate would improve.
   */
  _pump() {
    if (this._wind) {
      // The wind you hear is the wind pushing the player — the level already
      // knows when it is gusting, so it says so rather than us guessing.
      this._wind.out.gain.setTargetAtTime(
        WIND_GAIN * (1 + this._gust * 1.1), ctx.currentTime, 0.2,
      );
    }
    if (this.current === 'crackle' && ctx.currentTime >= this._nextCrack) {
      crack();
      this._nextCrack = ctx.currentTime + rnd(CRACK_GAP[0], CRACK_GAP[1]);
    }
  },
};

/** What the audio engine is actually doing, for the debug overlay. */
/**
 * Taps for measuring loudness from a test harness.
 *
 * `bus` is the end of the sfx path — dry plus whatever the room sent back, so a
 * reverb tail is visible there. `music` is the music path on its own, which is
 * how you prove the room never touched it. `master` is the sum, and it is the
 * only place a coin and the music can honestly be compared against each other.
 */
export function audioTap() {
  return ensure() ? { ctx, bus: sfxOut, music: musicBus, master } : null;
}

export function audioDiag() {
  return {
    state: ctx ? ctx.state : 'none',
    master: master ? Number(master.gain.value.toFixed(2)) : 0,
    muted,
    track: Music.current || 'none',
    // Measured, not remembered: the cave track's accelerando is the reason it
    // was chosen, so the overlay shows where it has got to rather than trusting
    // that it moved at all.
    pace: Number(Music.pace().toFixed(2)),
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

  /*
   * THE HIDDEN CAVE BAND.
   *
   * Edvard Grieg (1843–1907), *I Dovregubbens hall* — "In the Hall of the
   * Mountain King" — from the incidental music to *Peer Gynt*, 1875. The
   * composition entered the public domain on 1.1.1978 (author's life + 70
   * years, counted from the end of the year of death). Named here and in
   * DESIGN.md kohta 1 b and CHANGELOG.md, which is the condition on which
   * expired music is allowed into this game at all.
   *
   * **Written out by hand as note numbers, the way every other track in this
   * table is.** That is not a stylistic choice: what expired is the *work*. A
   * particular recording and a particular printed edition are separate works
   * with rights of their own, and they are where "but it's old music" usually
   * goes wrong. Nothing was sampled, ripped, scanned or converted; this is a
   * transcription of a theme from memory into the same [semitone, length]
   * pairs the rest of this file uses, and it is synthesised at run time.
   *
   * WHY THIS PIECE AND NOT A NICER ONE. Because it accelerates. A bonus room
   * with no urgency is a bonus room the player just stands in, and the tune
   * says "don't linger" without a word of it being written on the screen. See
   * `accel` below — the acceleration is the reason the piece is here, so it is
   * a property of the track and not a decoration on top of it.
   *
   * The theme itself is also, conveniently, exactly what this sequencer is
   * built for: Grieg's piece is one melody stated over and over, each time
   * louder, faster and differently scored. That is what SECTIONS and VARIATIONS
   * already do to every track in this table, so the arrangement machinery is
   * not fighting the material for once.
   *
   * B minor. The lead sits an octave down, where the piece starts — low
   * strings and bassoons, under everything — and the engine's "lead octave up"
   * sections are what lifts it into the register the strings take over in.
   * Phrase 0 is the statement, which leaves off on the fifth and wants to come
   * round again; phrase 1 is the same tune an octave higher, landing home on
   * the tonic. Two phrases and not four, because the piece has one tune.
   */
  cave: {
    /* Sama ehto kuin `bone`illa, ja tämä raita on syy sanoa se ääneen: `cave`
     * kirjoitettiin tuntia ennen kuin nimeämisestä tuli portti, joten se oli
     * hetken ajan juuri se tapaus jota kohta 1 b pelkää — lainattu sävelmä
     * jonka nimeäminen on kiinni siitä että joku muistaa. `TRACK_SOURCES` ei
     * nähnyt sitä lainkaan, eli portti raportoi "1 lainattua raitaa" kun niitä
     * oli kaksi. Portti joka kattaa puolet tapauksista on huonompi kuin
     * puuttuva portti, koska se näyttää kattavan kaikki. */
    source: {
      composer: 'Edvard Grieg',
      work: 'Vuorenkuninkaan luolassa',
    },
    tempo: 88,
    /*
     * The accelerando, as a rate rather than a switch: `per` is how much of the
     * starting tempo is added per pass through the loop, and `max` is where it
     * stops. 0.18 per pass to a ceiling of double speed means the room takes
     * about half a minute to become frantic and then stays there, breathless.
     *
     * It is measured from the step counter, so it is continuous — every step is
     * a hair shorter than the one before it rather than the tempo jumping a
     * notch each lap, which would read as a mistake being corrected (the same
     * reasoning as SECTIONS above). And because `play` resets the step counter,
     * the acceleration is a clock on *this* visit: leave the room and come back
     * and it starts calm again. It measures how long you have stayed, which is
     * the only thing it is supposed to be saying.
     */
    accel: { per: 0.18, max: 2 },
    lead: {
      wave: 'triangle', gain: 0.13, octave: -12, staccato: 0.62,
      phrases: [
        // The statement, low: B C# D E, D, up to F#, and back down.
        [[-10, 2], [-8, 2], [-7, 2], [-5, 2], [-7, 2], [-3, 2], [-5, 2], [-8, 2],
          [-10, 2], [-8, 2], [-7, 2], [-5, 2], [-7, 2], [-10, 2], [-10, 4]],
        // The same tune an octave up, the way the strings take it over.
        [[2, 2], [4, 2], [5, 2], [7, 2], [5, 2], [9, 2], [7, 2], [4, 2],
          [2, 2], [4, 2], [5, 2], [7, 2], [5, 2], [2, 2], [2, 4]],
      ],
      notes: [[-10, 2], [-8, 2], [-7, 2], [-5, 2], [-7, 2], [-3, 2], [-5, 2], [-8, 2],
        [-10, 2], [-8, 2], [-7, 2], [-5, 2], [-7, 2], [-10, 2], [-10, 4]],
    },
    harm: {
      // Two bars of harmony under a two-bar tune: home, then the dominant,
      // which is what makes the loop lean into its own repeat.
      wave: 'sawtooth', gain: 0.04, octave: -12,
      notes: [[[-10, -7, -3], 24], [[-3, 1, 4], 8]],
    },
    bass: {
      /* A pedal that never lets go. Twelve eighths of the tonic and four of the
       * dominant, accented on every downbeat: it is the marching under the
       * floor, and it is the part that gets frightening when the tempo climbs. */
      wave: 'triangle', gain: 0.2, staccato: 0.45, attack: 0.004, hold: 0.3,
      accent: 'x.......x.......',
      notes: [
        [-22, 2], [-22, 2], [-22, 2], [-22, 2], [-22, 2], [-22, 2], [-22, 2], [-22, 2],
        [-22, 2], [-22, 2], [-22, 2], [-22, 2], [-27, 2], [-27, 2], [-27, 2], [-27, 2],
      ],
    },
    drums: {
      // A march, not a groove: a stomp on the beat, one snare a bar, and the
      // hats on every eighth standing in for the pizzicato strings.
      kick: 'x.......x.......',
      snare: '............x...',
      hat: 'x.x.x.x.x.x.x.x.',
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

  /*
   * LUULAAKSO — Camille Saint-Saëns, *Danse macabre* op. 40 (1874).
   *
   * Säveltäjä kuoli 1921, joten teos vapautui 1.1.1992 (tekijänoikeus =
   * elinaika + 70 vuotta). DESIGN.md kohta 1 b päästää vapautuneen sävellyksen
   * sisään yhdellä ehdolla, ja ehto on tässä täytetty kahdesti: **sävelet on
   * kirjoitettu käsin tähän tauluun** ja syntetisoidaan ajossa, joten repoon ei
   * tule sampleja, MIDI-rippiä eikä skannattua nuottia — vapautuminen koskee
   * sävellystä, ja yksittäinen äänite tai nuottilaitos on eri teos omine
   * oikeuksineen. Ja lähde **nimetään**: `source` alla, DESIGN.md:n taulukossa
   * ja muutoslokissa, ja `verify.mjs` tarkistaa että kaikki kolme sanovat saman.
   *
   * Rehellisyyden nimissä yksi asia sanottava ääneen: tämä on **sovitus, ei
   * transkriptio**. Kolme ääntä ja rummut eivät ole orkesteri, ja nuotit on
   * kirjoitettu korvakuulolta teoksen aiheista — ei mistään laitoksesta, mikä
   * on nimenomaan se mitä sääntö vaatii.
   *
   * Miksi juuri tämä teos: se ei ole tyylivalinta vaan aihevalinta. Teos *on*
   * tanssivia luurankoja keskiyöllä, ja sen kuuluisin yksityiskohta —
   * ksylofonin kalisteleva kuvio — on nimenomaan luut. Saint-Saëns käytti
   * saman vitsin uudestaan "Fossiles"-osassa, eli hän piti sitä itsekin luiden
   * äänenä.
   *
   * Neljä fraasia, ja jokainen on yksi teoksen ajatuksista:
   *
   *   0  **keskiyö**: kaksitoista lyöntiä D:tä, sitten viulun tritonus A–Es.
   *      Teos alkaa kellonlyönneillä ja sävelletyllä väärinviritetyllä
   *      viululla; kaksitoista on siis kellonaika eikä koriste, ja
   *      `verify.mjs` laskee ne.
   *   1  **tanssi**: valssin pääajatus, laskeva d-molli, jossa nouseva
   *      johtosävel (cis) kääntää seitsemännen tahdin dominantiksi. Se yksi
   *      sävel erottaa valssin moodivampista.
   *   2  **ksylofoni**: kalisevat luut. Kuudestoistaosapareja kromaattisesti
   *      alas, ja se soitetaan kolmiolla lyhyellä soinnilla eikä kanttiaallolla
   *      — lyömäsoitin on isku ja vaimeneminen, ei ääni joka jää päälle.
   *   3  **laulava teema**: pitkiä nuotteja, vastapaino fraasille 2.
   *
   * Kaikki kolmijakoista: tahti on kuusi kuudestoistaosaa. Sekvensserin oma
   * tahti on 16 askelta, joten jokainen ääni ja jokainen rumpukuvio on kuuden
   * monikerta — muuten valssi vaeltaisi tahtilajia vasten. Se on väite jonka
   * `verify.mjs` tarkistaa, koska sen rikkoo yhdellä nuotilla.
   */
  bone: {
    source: {
      composer: 'Camille Saint-Saëns',
      work: 'Danse macabre',
    },
    tempo: 96,
    lead: {
      // Ksylofoni: kolmioaalto, lyhyt kesto ja melkein olematon pito. Isku ja
      // vaimeneminen, ei jatkuva sävel — se on koko ero soittimeen.
      wave: 'triangle', gain: 0.15, staccato: 0.34, attack: 0.003, hold: 0.08,
      octave: 0,
      phrases: [
        // 0 — keskiyö: kaksitoista lyöntiä, sitten tritonus A–Es
        [[-7, 2], [-7, 2], [-7, 2], [-7, 2], [-7, 2], [-7, 2],
          [-7, 2], [-7, 2], [-7, 2], [-7, 2], [-7, 2], [-7, 2],
          [0, 3], [6, 3], [0, 3], [6, 3],
          [0, 6], [6, 6]],
        // 1 — tanssi
        [[5, 2], [3, 2], [1, 2],
          [0, 4], [1, 2],
          [3, 2], [1, 2], [0, 2],
          [-2, 6],
          [1, 2], [0, 2], [-2, 2],
          [-4, 4], [-2, 2],
          [0, 2], [4, 2], [-2, 2],
          [-7, 6]],
        // 2 — ksylofoni, kalisevat luut
        [[5, 1], [5, 1], [4, 1], [4, 1], [3, 1], [3, 1],
          [1, 1], [1, 1], [0, 1], [0, 1], [-1, 1], [-1, 1],
          [-2, 1], [-2, 1], [-4, 1], [-4, 1], [-5, 1], [-5, 1],
          [-7, 3], [-7, 3],
          [5, 1], [5, 1], [4, 1], [4, 1], [3, 1], [3, 1],
          [1, 1], [1, 1], [0, 1], [0, 1], [-1, 1], [-1, 1],
          [-2, 1], [-2, 1], [-4, 1], [-4, 1], [-5, 1], [-5, 1],
          [0, 3], [6, 3]],
        // 3 — laulava teema
        [[5, 4], [3, 2],
          [1, 4], [0, 2],
          [-2, 6],
          [0, 6],
          [8, 4], [5, 2],
          [3, 4], [1, 2],
          [0, 4], [4, 2],
          [5, 6]],
      ],
      notes: [[5, 2], [3, 2], [1, 2], [0, 4], [1, 2], [3, 2], [1, 2], [0, 2], [-2, 6],
        [1, 2], [0, 2], [-2, 2], [-4, 4], [-2, 2], [0, 2], [4, 2], [-2, 2], [-7, 6]],
    },
    harm: {
      // Yksi sointu per tahti, oktaavia alempaa: i i iv i V7 i V7 i.
      wave: 'sawtooth', gain: 0.038, octave: -12, staccato: 0.9, attack: 0.02, hold: 0.7,
      notes: [
        [[-7, -4, 0], 6], [[-7, -4, 0], 6],
        [[-2, 1, 5], 6], [[-7, -4, 0], 6],
        [[0, 4, 7, 10], 6], [[-7, -4, 0], 6],
        [[0, 4, 7, 10], 6], [[-7, -4, 0], 6],
      ],
    },
    bass: {
      // Um-pa-pa: pohja iskulle yksi, soinnun sävelet kahdelle ja kolmelle.
      // Se on valssisäestys sellaisenaan, ja se on myös ainoa ääni jota mikään
      // variaatio ei saa pudottaa — siksi tanssi ei lakkaa missään kohdassa.
      wave: 'triangle', gain: 0.18, staccato: 0.6, attack: 0.004, hold: 0.3,
      accent: 'x.....',
      notes: [
        [-19, 2], [-12, 2], [-16, 2],
        [-19, 2], [-12, 2], [-16, 2],
        [-26, 2], [-19, 2], [-23, 2],
        [-19, 2], [-12, 2], [-16, 2],
        [-24, 2], [-17, 2], [-20, 2],
        [-19, 2], [-12, 2], [-16, 2],
        [-24, 2], [-17, 2], [-20, 2],
        [-19, 2], [-12, 2], [-16, 2],
      ],
    },
    drums: {
      // Kuuden askeleen kuviot: kuvioita luetaan oman pituutensa modulona, joten
      // kuusi on tässä kokonainen 3/4-tahti eikä kolme neljäsosaa neljästä.
      kick: 'x.....',
      snare: '..x..x',
      hat: 'x.x.x.',
    },
  },

  /*
   * KAASUKEHÄ — maailma 7, ja tämä on **omaa sävellystä**.
   *
   * Ei `source`-kenttää eikä sitä kysytä miltään: DESIGN.md kohdan 1 b sääntö
   * koskee lainattua eikä kaikkea, ja oma sävelmä on tässä pelissä oletus.
   * Vapautuneesta sävelmistöstä ei etsimälläkään löytynyt teosta joka olisi
   * ollut *tämä paikka* samalla tavalla kuin Danse macabre oli luulaakso —
   * pilviaiheista klassikkoa on, mutta jokainen niistä on sään kuvaus ulkoa
   * käsin, ja tämä maailma on sään sisällä. Aihevalinta on ainoa peruste jolla
   * lainaaminen on tässä pelissä tehty, ja kun sitä ei ole, ei lainata.
   *
   * ## D-lyydinen, ja se on väite eikä tunnelma
   *
   * Lyydinen on duuriasteikko jonka **neljäs sävel on korotettu** (D E F# G#
   * A B C#), ja juuri se yksi sävel on syy valita se tähän. Tavallisessa
   * duurissa neljäs sävel vetää alaspäin subdominanttiin — se on se voima joka
   * saa musiikin laskeutumaan kotiin. Korota se puolisävelaskeleella ja koko
   * vetosuunta katoaa: harmonia ei enää kallistu mihinkään, se leijuu. Se on
   * kirjaimellisesti sen soundi ettei mikään putoa, ja tämä maailma on tehty
   * siitä ettei mikään putoa.
   *
   * Se on myös tarkistettavissa datasta, ja siksi `verify.mjs` laskee kaksi
   * lukua: korotettu kvartti (G#) soi, alennettua (G) ei ole kertaakaan. Yksi
   * ainoa G ja moodi on jälleen tavallinen D-duuri — se kuulostaisi vain
   * hieman tavallisemmalta, mikä on täsmälleen se vika jota kukaan ei osaa
   * etsiä.
   *
   * Sointukierto on D — E — D — Bm. **E-duuri on koko juttu**: se on toinen
   * aste duurina, mikä on mahdollista vain lyydisessä, ja se on ainoa sointu
   * jonka soidessa korotettu kvartti on soinnun oma sävel eikä ohisävel.
   *
   * Neljä fraasia, ja jokainen on yksi asia jonka ilma tekee:
   *   0  **nousuvirtaus** — nouseva kuvio joka ratkeaa ylöspäin eikä alas
   *   1  **leijunta** — pitkiä nuotteja, vastapaino kaikelle muulle
   *   2  **viima** — kuudestoistaosajuoksuja alas ja takaisin ylös
   *   3  **teema** — se laulettava, ja fraasi jonka `notes` toistaa
   */
  cloud: {
    tempo: 104,
    lead: {
      // Kolmioaalto ja pitkä pito: puhallinmainen ääni, ei kanttiaallon terä.
      // Vibrato on hidas ja kapea, koska se on kannattelua eikä väristystä.
      wave: 'triangle', gain: 0.13, vibrato: 3, vibratoRate: 4.5, staccato: 0.92,
      phrases: [
        // 0 — nousuvirtaus
        [[-7, 2], [-5, 2], [-3, 2], [-1, 2], [0, 4], [2, 2], [4, 2],
          [5, 2], [4, 2], [2, 2], [-1, 2], [0, 8]],
        // 1 — leijunta
        [[0, 6], [-1, 2], [0, 8],
          [2, 4], [4, 4], [5, 8]],
        // 2 — viima
        [[9, 1], [7, 1], [5, 1], [4, 1], [2, 1], [0, 1], [-1, 1], [-3, 1],
          [-5, 1], [-3, 1], [-1, 1], [0, 1], [2, 1], [4, 1], [5, 1], [7, 1],
          [9, 1], [11, 1], [12, 1], [11, 1], [9, 1], [7, 1], [5, 1], [4, 1],
          [2, 2], [-1, 2], [0, 4]],
        // 3 — teema
        [[5, 4], [4, 2], [2, 2], [0, 4], [-1, 4],
          [0, 2], [2, 2], [4, 4], [5, 2], [9, 2], [7, 4]],
      ],
      notes: [[5, 4], [4, 2], [2, 2], [0, 4], [-1, 4],
        [0, 2], [2, 2], [4, 4], [5, 2], [9, 2], [7, 4]],
    },
    harm: {
      /* D — E — D — Bm, kahdeksan askelta kukin. E on toinen aste duurina, eli
       * lyydisen oma sointu: se on ainoa hetki jolloin G# on soinnun sävel. */
      wave: 'sawtooth', gain: 0.04, octave: -12, staccato: 0.95, attack: 0.03, hold: 0.8,
      notes: [
        [[-7, -3, 0], 8],
        [[-5, -1, 2], 8],
        [[-7, -3, 0], 8],
        [[-10, -7, -3], 8],
      ],
    },
    bass: {
      /* Ei kävelevää bassoa vaan urkupiste joka nousee kerran tahdissa
       * oktaavin. Lyydisen koko idea kaatuu jos basso kulkee: liikkuva basso
       * tekee soinnuista käännöksiä ja käännökset kuulostavat siltä että
       * jonnekin ollaan menossa. */
      wave: 'triangle', gain: 0.16, staccato: 0.7, attack: 0.006, hold: 0.4,
      accent: 'x.......x.......',
      notes: [
        [-19, 2], [-19, 2], [-12, 2], [-19, 2],
        [-17, 2], [-17, 2], [-10, 2], [-17, 2],
        [-19, 2], [-19, 2], [-12, 2], [-19, 2],
        [-22, 2], [-22, 2], [-15, 2], [-13, 2],
      ],
    },
    drums: {
      /* Ei takapotkua. Virveli kakkosella ja nelosella on se kuvio joka sitoo
       * musiikin lattiaan, ja tässä maailmassa ei ole lattiaa siinä mielessä.
       * Yksi virveli tahtia kohti kolmannella iskulla, harvat bassorummut, ja
       * hi-hat kahdeksasosina — se on se kuvio joka kuulostaa tuulelta eikä
       * marssilta. */
      kick: 'x.....x...x.....',
      snare: '........x.......',
      hat: 'x.x.x.x.x.x.x.x.',
    },
  },

  /*
   * VIIMEINEN LINNAKE — Modest Mussorgski, *Yö Autiovuorella* (1867),
   * Nikolai Rimski-Korsakovin sovituksena (1886).
   *
   * **Kaksi tekijää yhdellä rivillä ei ole huolimattomuutta, ja se on tämän
   * raidan tärkein yksityiskohta.** Mussorgski kuoli 1881, joten sävellys
   * vapautui 1.1.1952; Rimski-Korsakov kuoli 1908, joten sovitus vapautui
   * 1.1.1979. Teos tunnetaan lähes yksinomaan jälkimmäisenä, ja **sovitus on
   * oma teoksensa omine suoja-aikoineen** — juuri se on se kohta jossa
   * "tämähän on vanhaa musiikkia" menee useimmiten pieleen. Molemmat ovat
   * vapaita, mutta se on kaksi tarkistusta eikä yksi, ja siksi `source`issa on
   * kolme kenttää ja `verify.mjs` lukee niistä jokaisen: kumpikin nimi on
   * oltava sekä DESIGN.md:ssä (kohta 1 b) että muutoslokissa.
   *
   * DESIGN.md kohdan 1 b muu ehto täyttyy samalla tavalla kuin `bone`illa ja
   * `cave`lla: **sävelet on kirjoitettu käsin tähän tauluun** ja
   * syntetisoidaan ajossa. Repoon ei tule sampleja, MIDI-rippiä eikä
   * skannattua nuottia — vapautuminen koskee sävellystä, ja yksittäinen äänite
   * tai nuottilaitos on eri teos omine oikeuksineen. Ja rehellisyyden nimissä
   * sama varaus kuin luulaaksossa: tämä on **sovitus eikä transkriptio**.
   * Kolme ääntä ja rummut eivät ole orkesteri, ja aiheet on kirjoitettu
   * korvakuulolta eikä mistään laitoksesta.
   *
   * Miksi juuri tämä teos: aihevalinta, kuten aina tässä pelissä. Teos *on*
   * yö pahojen vuorella, se kestää yhden yön, ja se loppuu siihen että kello
   * soi ja aamu tulee. Viimeinen linnake on kuusi tappelua peräkkäin ja sen
   * jälkeen peli loppuu; sama muoto, eri väline.
   *
   * ## Se yksi asia joka on datassa: yö on mollissa, aamu on duurissa
   *
   * Teoksen koko dramaturgia on yksi käänne, ja se on kirjoitettavissa
   * numeroina, joten `verify.mjs` laskee sen:
   *
   *   - fraasit 0–2 ovat yö, eikä yhdessäkään niistä ole duuriterssiä (F#)
   *   - fraasi 3 on aamu, eikä siinä ole molliterssiä (F) kertaakaan
   *
   * Yksi F# yössä ja käänne on koriste, koska duuri oli jo käynyt. Yksi F
   * aamussa ja aamu on vain hiljaisempi yö. Kumpikaan ei kuulostaisi
   * rikkinäiseltä — ne kuulostaisivat *vähemmän hyvältä*, mikä on täsmälleen
   * se vika jota kukaan ei osaa etsiä.
   *
   * **Harmonia on paljaita kvinttejä, ja se on tämän ratkaisun hinta.**
   * Sekvensseri vaihtaa fraasia joka kierroksella mutta soittaa saman
   * säestyksen läpi koko raidan, joten mollisointu aamun alla rikkoisi
   * käänteen samalla nuotilla jolla se tehdään. Ilman terssiä sama säestys
   * kantaa molemmat, ja moodi asuu sävelmässä — mikä on lisäksi juuri se
   * sointi jota tällä musiikilla on: avoin kvintti on vanhempi ja karumpi ääni
   * kuin kolmisointu. Sekin on portissa: `harm`issa ei ole yhtään F:ää eikä
   * F#:ää.
   *
   * Neljä fraasia, ja jokainen on yksi asia jonka yö tekee:
   *   0  **kohina** — se juokseva kuudestoistaosakuvio jolla teos alkaa
   *   1  **kutsu** — matala, raskas pääaihe: vuoren oma teema
   *   2  **tanssi** — sapatti, ajava ja tasainen
   *   3  **aamu** — kellonlyönnit ja sama sävellaji suurena
   *
   * Kellonlyöntejä on kuusi, ja se luku on **meidän** eikä teoksen: partituuri
   * vain toistaa lyönnin, joten kuusi on se mikä mahtuu tahtiin. Luulaakson
   * kaksitoista on eri asia — siellä luku on kellonaika ja siksi se lasketaan
   * portissa nimellä. Suunta on myös vastakkainen ja se on koko vitsi: siellä
   * lyönnit *aloittavat* tanssin, täällä ne *lopettavat* yön.
   */
  autiovuori: {
    source: {
      composer: 'Modest Mussorgski',
      arranger: 'Nikolai Rimski-Korsakov',
      work: 'Yö Autiovuorella',
    },
    tempo: 132,
    lead: {
      /* Kanttiaalto ja kapea detune: tämä on ainoa raita jonka pitää kuulostaa
       * siltä että se huutaa. Staccato on pitkä, koska jouset eivät irrota. */
      wave: 'sawtooth', gain: 0.12, detune: 10, staccato: 0.86, vibrato: 3, vibratoRate: 5,
      phrases: [
        // 0 — kohina: d-molli ylös ja alas, kuudestoistaosina
        [[-7, 1], [-5, 1], [-4, 1], [-2, 1], [0, 1], [-2, 1], [-4, 1], [-5, 1],
          [-7, 1], [-5, 1], [-4, 1], [-2, 1], [0, 1], [1, 1], [0, 1], [-2, 1],
          [-4, 1], [-5, 1], [-4, 1], [-2, 1], [0, 1], [1, 1], [4, 1], [5, 1],
          [4, 2], [1, 2], [0, 2], [-2, 2], [-4, 4], [-7, 4]],
        // 1 — kutsu: vuoren teema, oktaavia alempaa ja pisteellisenä
        [[-19, 4], [-16, 2], [-19, 2], [-14, 4], [-16, 2], [-19, 2],
          [-12, 4], [-16, 4], [-19, 8],
          [-19, 4], [-16, 2], [-19, 2], [-14, 4], [-11, 2], [-12, 2],
          [-8, 4], [-12, 4], [-19, 8]],
        // 2 — tanssi: sapatti, tasaisina kahdeksasosina
        [[-7, 2], [-7, 1], [-4, 1], [-2, 2], [-4, 2],
          [-7, 2], [-4, 2], [-2, 2], [0, 2],
          [1, 2], [0, 2], [-2, 2], [-4, 2],
          [-2, 2], [0, 2], [4, 2], [5, 4]],
        // 3 — aamu: kuusi lyöntiä, ja sitten D-duuri
        [[5, 4], [5, 4], [5, 4], [5, 4], [5, 4], [5, 4],
          [0, 4], [2, 2], [4, 2], [5, 8],
          [9, 4], [7, 2], [5, 2], [4, 4], [2, 4],
          [0, 2], [2, 2], [4, 2], [5, 2], [9, 8]],
      ],
      notes: [[-19, 4], [-16, 2], [-19, 2], [-14, 4], [-16, 2], [-19, 2],
        [-12, 4], [-16, 4], [-19, 8],
        [-19, 4], [-16, 2], [-19, 2], [-14, 4], [-11, 2], [-12, 2],
        [-8, 4], [-12, 4], [-19, 8]],
    },
    harm: {
      /* D5 — C5 — G5 — D5. Ei yhtään terssiä, ks. yllä: sama säestys kantaa
       * sekä yön että aamun, koska se ei ota kantaa kumpaankaan. */
      wave: 'sawtooth', gain: 0.045, octave: -12, staccato: 0.95, attack: 0.02, hold: 0.7,
      notes: [
        [[-7, 0], 8],
        [[-9, -2], 8],
        [[-14, -7], 8],
        [[-7, 0], 8],
      ],
    },
    bass: {
      /* Juokseva pohja eikä urkupiste: teos on liikettä alusta loppuun, ja
       * tämä on se ääni joka ei pysähdy. Sävelet ovat pohjia ja kvinttejä,
       * samasta syystä kuin harmoniassa. */
      wave: 'triangle', gain: 0.19, staccato: 0.5, attack: 0.004, hold: 0.25,
      accent: 'x...x...x...x...',
      notes: [
        [-31, 2], [-24, 2], [-31, 2], [-24, 2], [-31, 2], [-24, 2], [-31, 2], [-19, 2],
        [-33, 2], [-26, 2], [-33, 2], [-26, 2], [-33, 2], [-26, 2], [-33, 2], [-21, 2],
        [-38, 2], [-31, 2], [-38, 2], [-31, 2], [-38, 2], [-31, 2], [-38, 2], [-26, 2],
        [-31, 2], [-24, 2], [-31, 2], [-24, 2], [-31, 4], [-31, 4],
      ],
    },
    drums: {
      /* Sapatti eikä marssi: bassorumpu joka iskulle ja vielä yksi väliin,
       * virveli kakkoselle ja neloselle, hi-hat kuudestoistaosina. Se on
       * tarkoituksella tiheämpi kuin linnakkeen oma raita, jossa ei ole
       * hi-hattia lainkaan — se huone on tyhjä, tämä on täynnä. */
      kick: 'x..x..x.x..x..x.',
      snare: '....x.......x...',
      hat: 'xxxxxxxxxxxxxxxx',
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

/**
 * How much faster a track is playing by a given step — its accelerando.
 *
 * This is the second of the two ways the tempo can move, and the two are
 * deliberately different shapes. `HURRY_SPEED` and a section's `speed` are
 * *gears*: they change once, they are heard changing, and the lead-in bar ramps
 * into them. An accelerando is not a gear, it is a slope — nothing announces
 * it, and no single step is audibly faster than the one before it. That is the
 * whole effect: the player notices they are hurrying without noticing when they
 * started.
 *
 * So it is a function of the absolute step index rather than of the pass or the
 * section, which also means it needs no state of its own. A track with no
 * `accel` gets 1 and pays nothing.
 */
function paceAt(track, step, loopLen) {
  const a = track && track.accel;
  if (!a) return 1;
  return Math.min(a.max, 1 + a.per * (step / Math.max(1, loopLen)));
}

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
  /** Where the accelerando has got to, as a multiple of the written tempo. */
  pace: () => paceAt(Music._track, Music._step, Music._loopLen),

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
      const geared = inLead
        ? this._stepDur + (this._nextStepDur - this._stepDur) * ((local - leadFrom) / LEAD_IN_STEPS)
        : this._stepDur;
      // The accelerando rides on top of whatever gear the arrangement is in,
      // rather than replacing it: a track that both accelerates and hits a
      // double-time section should do both.
      const dur = geared / paceAt(this._track, this._step, this._loopLen);
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

/**
 * Lainatut sävelmät ja niiden lähteet, raidan nimen mukaan.
 *
 * Tämä on DESIGN.md kohdan 1 b ehto koneluettavassa muodossa: vapautunut
 * sävellys saa tulla sisään, jos lähde **nimetään**. `verify.mjs` lukee tämän
 * ja vaatii että sekä säveltäjä että teoksen nimi lukevat DESIGN.md:ssä ja
 * CHANGELOG.md:ssä — eli ehto ei ole enää lupaus vaan portti.
 *
 * Raita ilman `source`-kenttää on tätä peliä varten sävelletty eikä se näy
 * täällä. Sääntö koskee lainattua, ei kaikkea.
 */
export const TRACK_SOURCES = Object.fromEntries(
  Object.entries(TRACKS).filter(([, t]) => t.source).map(([name, t]) => [name, t.source]),
);
