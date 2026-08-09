/**
 * Screen effects: bloom, scanlines, vignette and — where the machine allows it
 * — barrel distortion through a WebGL shader.
 *
 * The shape of this file is the whole design decision. Rewriting the renderer
 * in WebGL was considered and rejected: `src/gfx/` is thousands of lines of
 * rectangles, it costs under a millisecond a frame as it stands, and a rewrite
 * would buy nothing but shaders. So the game keeps drawing in Canvas 2D and
 * this module only *presents* the finished 320x240 image. Nothing above it has
 * to know whether a GPU was involved.
 *
 * Two consequences worth stating outright:
 *
 *   1. **The 2D path is the real path, not a consolation prize.** Bloom,
 *      scanlines and the vignette all run in Canvas 2D. WebGL adds curvature
 *      and chromatic aberration on top, and that is all it adds.
 *   2. **The fallback is mandatory and tested.** `getContext('webgl2')` returns
 *      null on a blocklisted driver, in a VM, on an old Android and whenever
 *      hardware acceleration is switched off — in a completely up-to-date
 *      browser. A fallback nobody tests is not a fallback, so `verify.mjs`
 *      stubs the context away and checks the game still draws.
 */

const KEY = 'sfb3.fx.v1';

/** Presets in cycle order. Off is first: it must always be one press away. */
export const PRESETS = ['pois', 'hehku', 'crt'];
export const PRESET_NAMES = { pois: 'EI EFEKTEJÄ', hehku: 'HEHKU', crt: 'KUVAPUTKI' };

/* Bloom is drawn from a quarter-size copy. Smaller is blurrier and cheaper;
 * this is the point where the halo still follows the shape that made it. */
const BLOOM_W = 80;
const BLOOM_H = 60;
const BLOOM_ALPHA = 0.24;
const SCANLINE_ALPHA = 0.24;
/**
 * Only pixels brighter than this glow, measured as luminance.
 *
 * Thresholding per channel — which is what `ctx.filter = 'contrast()'` does —
 * cannot tell a bright blue sky from a white sun, because the sky's blue
 * channel is already at 252. The result was the whole picture lifting by ~45
 * levels and going milky. Luminance can tell them apart: this sky is 153, a
 * coin is 179 and the sun is 251.
 *
 * Set high on purpose. At 168 the coins glowed, but so did every white letter
 * on screen — and a score you cannot read is a worse trade than a coin that
 * does not sparkle. 206 leaves only the genuinely bright things: the sun, a
 * fireball, a star. The HUD is excluded from the pass entirely; see `_bloomPass`.
 */
const BLOOM_THRESHOLD = 206;

/**
 * Per-level atmosphere, keyed by the level's theme.
 *
 * These belong to the level rather than to the effects setting, which is the
 * whole point: heat haze in the desert says something about where you are,
 * while the same haze sprinkled everywhere would just be a screensaver. A
 * theme with nothing to say gets nothing.
 */
export const THEME_AMBIENCE = {
  desert: 'heat',      // midday air over sand
  factory: 'heat',     // the same trick, from furnaces instead of sun
  ice: 'frost',        // the screen itself freezing over at the edges
};
/** Factory heat is half strength: indoors, and the levels are busy enough. */
const AMBIENCE_STRENGTH = { desert: 1, factory: 0.5, ice: 1 };

/*
 * The lamp, for a level marked `spotlight: true`. It is an ambience like the
 * others — same slot, same WebGL-plus-fallback pair — except that it is asked
 * for by the level rather than by its theme, because being dark is a property
 * of one level and not of everything sharing a palette.
 *
 * **The radius is a safety number, not a taste one.** Darkness may hide the
 * route and the rewards; it may not hide a spike. So the lit core has to be
 * wider than the ground the player covers between seeing a thing and having
 * stopped in front of it, at the fastest they can be moving:
 *
 *   full sprint          MAX_P            3.5 px/frame
 *   noticing it          ~15 frames       52.5 px
 *   skidding to a halt   SKID 0.125       3.5 / 0.125 = 28 frames,
 *                                         mean 1.75 px  ->  49 px
 *                                         ------------------------
 *                                         101.5 px
 *
 * 120 px clears that by a fifth, and it happens to clear the other two ways of
 * arriving somewhere too: the highest jump in the game rises 100 px, and 15
 * frames of falling at TERMINAL is 60 px. One number covers all three.
 *
 * A big lamp is the honest consequence of the rule, and it is not a problem:
 * the camera keeps the player between screen x 126 and 194, so 194 px is the
 * furthest anything can get from the light without leaving the view, and the
 * falloff is done well before that. The level is dark at its edges, not in
 * front of your feet.
 */
const SPOT_LIT = 120;
const SPOT_EDGE = 48;
/**
 * And the floor: outside the beam the picture drops to this and stops there,
 * so a spike bed is dim rather than absent. Measured rather than chosen — at
 * the darkest a hazard can legitimately reach, with the CRT vignette dimming
 * that same edge again, spikes still stand ~35 luminance levels clear of the
 * air above them. Twenty is where a thing stops being visible on a bad screen.
 */
const SPOT_DIM = 0.24;

/**
 * Height of the HUD strip along the bottom, mirroring `HUD_H` in
 * scenes/level.js. Atmosphere stops here: the HUD is not air and not a window,
 * and a wobbling timer is just a hard-to-read timer.
 */
const HUD_H = 32;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/*
 * One pass, one triangle. The curvature is applied to the sample coordinate
 * rather than the geometry, so there is no mesh and no seam; anything that
 * lands outside the tube after bending is drawn as the bezel, which is what
 * stops the edge pixels from smearing.
 */
const FRAG = `
precision mediump float;
varying vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uSize;        // display size, for the aberration offset
uniform vec2 uSource;      // 320x240, the resolution the scanlines belong to
uniform float uCurve;
uniform float uScan;
uniform float uVignette;
uniform float uAberration;
uniform float uHeat;
uniform float uFrost;
uniform float uDark;       // spotlight strength
uniform vec2 uFocus;       // where the lamp is, in texture coords
uniform float uTime;
uniform float uFloor;      // top edge of the HUD, in texture coords from below
uniform float uMask;       // aperture grille strength
uniform float uBleed;      // horizontal smear, i.e. composite bandwidth
uniform float uGain;       // puts back the light the beam and mask remove

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  vec2 offset = uv.yx * uv.yx * uCurve;
  uv += uv * offset;
  uv = uv * 0.5 + 0.5;

  // Heat rises: the shimmer is strongest along the ground and dies out towards
  // the sky. A uniform wobble reads as a broken screen, not as hot air.
  if (uHeat > 0.0 && uv.y > uFloor) {
    float ground = 1.0 - (uv.y - uFloor) / (1.0 - uFloor);
    uv.x += sin(uv.y * 74.0 + uTime * 2.7) * 0.0022 * uHeat * ground * ground;
    uv.y += sin(uv.x * 41.0 + uTime * 1.9) * 0.0009 * uHeat * ground;
    uv.y = max(uv.y, uFloor);          // never drag the HUD up into the picture
  }

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.02, 0.02, 0.03, 1.0);
    return;
  }

  // The red and blue channels miss the mark by a hair towards the edges, the
  // way a real tube does. Constant aberration just looks like a broken image.
  float edge = length(vUV - 0.5);
  vec2 shift = vec2(uAberration * edge / uSize.x, 0.0);
  vec3 color = vec3(
    texture2D(uTex, uv + shift).r,
    texture2D(uTex, uv).g,
    texture2D(uTex, uv - shift).b
  );

  /* Composite bleed: a tube fed over one wire cannot change colour as fast as
   * the pixels do, so neighbouring pixels smear into each other horizontally.
   * This is the "mushing" that makes the picture look like a television rather
   * than a grid — and it is horizontal only, because the vertical direction is
   * scanlines, not bandwidth. */
  if (uBleed > 0.0) {
    float texel = 1.0 / uSource.x;
    vec3 near = texture2D(uTex, uv + vec2(texel, 0.0)).rgb
              + texture2D(uTex, uv - vec2(texel, 0.0)).rgb;
    vec3 far = texture2D(uTex, uv + vec2(texel * 2.0, 0.0)).rgb
             + texture2D(uTex, uv - vec2(texel * 2.0, 0.0)).rgb;
    vec3 smeared = color * 0.44 + near * 0.20 + far * 0.08;
    color = mix(color, smeared, uBleed);
  }

  /* The lamp. Distance is measured in source pixels, so the radius means the
   * same thing here as it does in the Canvas 2D pass — and it is measured in
   * the *curved* uv, so the light stays on the player rather than on the flat
   * screen the player is no longer at. Multiplied before the gamma work below
   * because the fallback paints the same falloff as a black gradient, and a
   * gradient multiplies in exactly this space. */
  if (uDark > 0.0 && uv.y > uFloor) {
    float lit = 1.0 - smoothstep(${SPOT_LIT.toFixed(1)}, ${(SPOT_LIT + SPOT_EDGE).toFixed(1)},
                                 length((uv - uFocus) * uSource));
    color *= mix(1.0, mix(${SPOT_DIM.toFixed(3)}, 1.0, lit), uDark);
  }

  // One dark line per *source* row, not per screen pixel. Tying this to the
  // display size makes the frequency approach the pixel grid and the whole
  // screen dissolves into moiré rings.
  /*
   * Beam, mask and gamma, in the spirit of RetroArch's crt-lottes: the three
   * things that separate "dark stripes over the picture" from something that
   * reads as a tube.
   *
   *   1. Work in linear light. Scanlines multiply, and multiplying gamma-
   *      encoded values is what makes naive CRT filters come out muddy.
   *   2. The beam widens with brightness. On a real tube a bright line blooms
   *      over its neighbours and the gap between lines closes; a fixed-width
   *      line makes everything uniformly dim instead.
   *   3. The mask only appears when there are real pixels to draw it with.
   *      An aperture grille needs three device pixels per source pixel; below
   *      that it is not a mask, it is a 30% brightness cut.
   */
  color = pow(color, vec3(2.2));

  if (uScan > 0.0) {
    float pos = uv.y * uSource.y;
    float d = fract(pos) - 0.5;
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    float width = mix(0.30, 0.62, clamp(lum * 1.4, 0.0, 1.0));
    float beam = exp(-(d * d) / (2.0 * width * width));
    color *= mix(1.0, beam, uScan);
  }

  if (uMask > 0.0) {
    float phase = mod(gl_FragCoord.x, 3.0);
    vec3 grille = phase < 1.0 ? vec3(1.0, 0.62, 0.62)
                : phase < 2.0 ? vec3(0.62, 1.0, 0.62)
                              : vec3(0.62, 0.62, 1.0);
    color *= mix(vec3(1.0), grille, uMask);
  }

  // Both of the above only ever remove light, so the gain puts back what an
  // actual tube would have been driven harder to produce.
  color *= uGain;
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));

  float v = 1.0 - uVignette * dot(uv - 0.5, uv - 0.5) * 1.9;
  color *= clamp(v, 0.0, 1.0);

  /* Frost creeps in from the top and bottom edges with a sawtooth line, the
   * way ice actually grows on a window: in spikes, not in a smooth band. The
   * sides are left clear so the frost never eats the part of the screen you
   * are running through. */
  if (uFrost > 0.0 && uv.y > uFloor) {
    float saw = abs(fract(uv.x * 7.0 + sin(uv.x * 3.0) * 0.2) - 0.5) * 2.0;
    float reach = (0.05 + saw * 0.07) * uFrost;
    // Half reach along the bottom: that is the row being run along, and frost
    // that hides a spike stops being decoration and starts being a hazard.
    float d = min((uv.y - uFloor) * 2.0, 1.0 - uv.y);
    float f = smoothstep(reach, 0.0, d);
    float sparkle = step(0.985, fract(sin(uv.x * 431.0 + uv.y * 917.0) * 4371.0));
    color = mix(color, vec3(0.80, 0.92, 1.0), f * 0.62);
    color += sparkle * f * 0.35;
  }

  gl_FragColor = vec4(color, 1.0);
}`;

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export const PostFX = {
  /** 'webgl' when a context was obtained, '2d' when we fell back. */
  mode: '2d',
  /** Default is the full tube. It is the look the game is meant to have; the
   * key that turns it off is one press away for anyone who disagrees. */
  preset: 'crt',
  source: null,
  /** The canvas that should actually be on screen and sized by the page. */
  displayCanvas: null,
  scale: 1,
  /** Set from the level's theme or its flags; see THEME_AMBIENCE. */
  ambience: null,
  ambienceAmount: 0,
  /** Where the spotlight points, in source pixels. */
  focus: { x: 160, y: 120 },
  tick: 0,
  _gl: null,
  _copy: null,
  _copyCtx: null,
  _bloomCtx: null,
  _program: null,
  _tex: null,
  _uniforms: null,
  _bloom: null,
  _vignette: null,
  _scanline: null,

  /**
   * @param {HTMLCanvasElement} source the 320x240 canvas the game draws into
   * @returns the canvas that belongs in the page
   */
  init(source) {
    this.source = source;
    this.preset = this.loadPreset();
    this._bloom = makeCanvas(BLOOM_W, BLOOM_H);
    this._bloomCtx = this._bloom.getContext('2d', { willReadFrequently: true });
    // Own properties, always: a re-init must not inherit or keep a stale
    // context, or a failed second attempt would quietly present through the
    // first one's canvas.
    this._gl = null;
    this._program = null;
    this._tex = null;
    this._uniforms = null;
    this.displayCanvas = null;
    this.mode = this._initGL() ? 'webgl' : '2d';
    return this.displayCanvas || source;
  },

  loadPreset() {
    try {
      const saved = localStorage.getItem(KEY);
      return PRESETS.includes(saved) ? saved : 'crt';
    } catch {
      return 'crt';
    }
  },

  setPreset(name) {
    this.preset = PRESETS.includes(name) ? name : 'pois';
    try {
      localStorage.setItem(KEY, this.preset);
    } catch {
      /* private mode — the preset just won't stick between sessions */
    }
    return this.preset;
  },

  /**
   * Sets the level atmosphere from a theme name and, where there is one, the
   * level definition. Anything unknown — the title screen, the world map, a
   * theme with nothing to say — clears it.
   *
   * A level flag outranks the theme table: `spotlight` belongs to the one level
   * that is dark, not to every level that shares its palette.
   */
  setAmbience(theme, def = null) {
    const kind = def && def.spotlight ? 'spotlight' : (THEME_AMBIENCE[theme] || null);
    this.ambience = kind;
    this.ambienceAmount = kind === 'spotlight' ? 1 : (kind ? (AMBIENCE_STRENGTH[theme] || 1) : 0);
    // Centre it again, so a leftover position from the last level cannot put
    // the light somewhere nobody is standing on the first frame of the next.
    this.setFocus(this.source ? this.source.width / 2 : 160,
      this.source ? this.source.height / 2 : 120);
    return kind;
  },

  /**
   * Aims the spotlight, in source pixels. Pushed in by the scene rather than
   * pulled out of the game: the scene is the only place that already knows the
   * camera rounding, the screen shake and the letterbox offset, and anything
   * that re-derived them would light where the player was, not where they are.
   */
  setFocus(x, y) {
    // Assigned rather than mutated: `Object.create(PostFX)` is how the tests
    // make an instance, and mutating an inherited object would write through
    // to every one of them.
    this.focus = { x, y };
  },

  cyclePreset() {
    return this.setPreset(PRESETS[(PRESETS.indexOf(this.preset) + 1) % PRESETS.length]);
  },

  /**
   * Every failure path here ends in `false`, and `false` means the game runs
   * exactly as it did before this file existed.
   */
  _initGL() {
    try {
      const canvas = makeCanvas(this.source.width, this.source.height);
      canvas.id = 'screen';
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
        || canvas.getContext('webgl', { antialias: false, alpha: false });
      if (!gl) return false;

      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
      gl.useProgram(program);

      // One oversized triangle covers the screen with no index buffer and no
      // diagonal seam down the middle.
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // NEAREST throughout: this is pixel art, and a bilinear filter would undo
      // the entire art style on the way to the screen.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // A canvas is top-down and a GL texture is bottom-up. Without this the
      // whole game arrives upside down — which is exactly what it did.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      this._gl = gl;
      this._program = program;
      this._tex = tex;
      this._uniforms = {
        size: gl.getUniformLocation(program, 'uSize'),
        source: gl.getUniformLocation(program, 'uSource'),
        curve: gl.getUniformLocation(program, 'uCurve'),
        scan: gl.getUniformLocation(program, 'uScan'),
        vignette: gl.getUniformLocation(program, 'uVignette'),
        aberration: gl.getUniformLocation(program, 'uAberration'),
        floor: gl.getUniformLocation(program, 'uFloor'),
        mask: gl.getUniformLocation(program, 'uMask'),
        bleed: gl.getUniformLocation(program, 'uBleed'),
        gain: gl.getUniformLocation(program, 'uGain'),
        heat: gl.getUniformLocation(program, 'uHeat'),
        frost: gl.getUniformLocation(program, 'uFrost'),
        dark: gl.getUniformLocation(program, 'uDark'),
        focus: gl.getUniformLocation(program, 'uFocus'),
        time: gl.getUniformLocation(program, 'uTime'),
      };
      this.displayCanvas = canvas;
      // The source canvas keeps drawing, it just stops being the thing on
      // screen. `drawImage` and `toDataURL` still work on a hidden canvas,
      // which is what keeps tools/make-card.mjs working unchanged.
      this.source.style.display = 'none';
      this.source.after(canvas);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Sizes the presentation canvas in *device* pixels, not CSS pixels.
   *
   * This matters more than it sounds. A phone at 1x CSS scale gives a 320x240
   * backing store, and 240 scanlines drawn onto 240 pixels means every second
   * pixel is black — which the display then resamples into moiré curtains.
   * Rendering at the device resolution gives each scanline two or three real
   * pixels to live on, and the pattern comes out as a pattern.
   */
  resize(scale) {
    this.scale = Math.max(1, scale);
    const canvas = this.displayCanvas;
    if (!canvas || !this._gl) return;
    const dpr = Math.min(devicePixelRatio || 1, 3);
    const w = Math.round(this.source.width * this.scale * dpr);
    const h = Math.round(this.source.height * this.scale * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      this._gl.viewport(0, 0, w, h);
    }
  },

  /* ------------------------------ 2D layer ----------------------------- */

  /**
   * Draws the effects that live in Canvas 2D straight onto the game canvas.
   * In WebGL mode only the bloom is done here; the shader owns the rest.
   *
   * Every piece of context state this touches is put back. A filter or a
   * composite mode left set would silently wreck the next frame's tiles, and
   * that kind of bug looks like a graphics glitch rather than a leak.
   */
  apply(ctx) {
    this.tick++;
    if (this.preset === 'pois') return;
    const { source } = this;
    const smoothing = ctx.imageSmoothingEnabled;
    const alpha = ctx.globalAlpha;
    const op = ctx.globalCompositeOperation;

    // Atmosphere is the level talking, not the filter, so it is done in 2D as
    // well. Without WebGL you lose the curved glass — you should not also lose
    // the desert being hot.
    if (this.mode !== 'webgl' && this.ambience && this.ambienceAmount > 0) {
      if (this.ambience === 'heat') this._heatPass(ctx, source);
      else if (this.ambience === 'frost') this._frostPass(ctx, source);
      else if (this.ambience === 'spotlight') this._spotlightPass(ctx, source);
    }

    this._bloomPass(ctx, source);
    if (this.preset === 'crt' && this.mode !== 'webgl') {
      this._scanlinePass(ctx, source);
      this._vignettePass(ctx, source);
    }

    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = smoothing;
    if ('filter' in ctx) ctx.filter = 'none';
  },

  /**
   * Bloom on the cheap: shrink, keep only what is genuinely bright, add the
   * blurry result back. The shrinking *is* the blur — an 80x60 copy stretched
   * back over 320x240 is a box blur we get for free from the hardware.
   *
   * The threshold is done in JavaScript over 4800 pixels, which measures at
   * well under a tenth of a millisecond. `willReadFrequently` is set on this
   * canvas precisely because we read it every frame; that flag would be the
   * wrong call on the game canvas, which is written far more than it is read.
   */
  _bloomPass(ctx, source) {
    const g = this._bloomCtx;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.imageSmoothingEnabled = true;
    g.clearRect(0, 0, BLOOM_W, BLOOM_H);
    g.drawImage(source, 0, 0, BLOOM_W, BLOOM_H);

    const img = g.getImageData(0, 0, BLOOM_W, BLOOM_H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      // Rec. 709 luminance in fixed point: green carries most of the weight,
      // which is why a saturated blue sky reads darker than it looks.
      const luma = (d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8;
      if (luma <= BLOOM_THRESHOLD) {
        d[i] = 0;
        d[i + 1] = 0;
        d[i + 2] = 0;
        continue;
      }
      // Soft knee: something just over the line glows faintly, not fully.
      const k = (luma - BLOOM_THRESHOLD) / (255 - BLOOM_THRESHOLD);
      d[i] *= k;
      d[i + 1] *= k;
      d[i + 2] *= k;
    }
    g.putImageData(img, 0, 0);

    /* Only the playfield glows. The HUD is text on a flat dark strip, and
     * additive light on small white letters is the fastest way to make a game
     * unreadable — the score is not scenery. */
    const playH = source.height - HUD_H;
    const bandH = Math.round((BLOOM_H * playH) / source.height);
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = BLOOM_ALPHA;
    ctx.drawImage(this._bloom, 0, 0, BLOOM_W, bandH, 0, 0, source.width, playH);
  },

  /**
   * Heat haze without a shader: copy the frame aside, then paint it back in
   * horizontal bands, each nudged sideways by a travelling sine. Twenty bands
   * is where it stops reading as bands and starts reading as air.
   *
   * The copy is not optional. Shifting a canvas onto itself reads pixels that
   * the same pass has already moved, and the smear compounds every frame.
   */
  _heatPass(ctx, source) {
    const w = source.width;
    const h = source.height;
    if (!this._copy || this._copy.width !== w) {
      this._copy = makeCanvas(w, h);
      this._copyCtx = this._copy.getContext('2d');
    }
    this._copyCtx.clearRect(0, 0, w, h);
    this._copyCtx.drawImage(source, 0, 0);

    // Only the playfield shimmers. In canvas coordinates y grows downwards, so
    // the ground — where the hot air is — is the *bottom* of the play area.
    const play = h - HUD_H;
    const bands = 20;
    const band = play / bands;
    const t = this.tick / 60;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < bands; i++) {
      const y = i * band;
      const ground = y / play;
      const dx = Math.sin(y * 0.42 + t * 2.7) * 1.8 * this.ambienceAmount * ground * ground;
      ctx.drawImage(this._copy, 0, y, w, band, Math.round(dx), y, w, band);
    }
  },

  /**
   * Frost creeping in from the top and bottom edges in spikes rather than a
   * smooth band — ice on a window grows in points. The sides stay clear so the
   * frost never covers the lane you are running down.
   */
  _frostPass(ctx, source) {
    const w = source.width;
    const h = source.height - HUD_H;      // the HUD stays clear of the ice
    const teeth = 14;
    const step = w / teeth;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;

    for (const top of [true, false]) {
      ctx.beginPath();
      ctx.moveTo(0, top ? 0 : h);
      for (let i = 0; i <= teeth; i++) {
        const x = i * step;
        // Half reach along the bottom, for the same reason as in the shader.
        const spike = (i % 2 === 0 ? 16 : 7) * this.ambienceAmount * (top ? 1 : 0.5);
        ctx.lineTo(x, top ? spike : h - spike);
      }
      ctx.lineTo(w, top ? 0 : h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, top ? 0 : h, 0, top ? 22 : h - 22);
      grad.addColorStop(0, 'rgba(214,238,255,0.78)');
      grad.addColorStop(1, 'rgba(214,238,255,0.05)');
      ctx.fillStyle = grad;
      ctx.fill();
    }
  },

  /**
   * The lamp without a shader: one radial gradient of black over the
   * playfield. `rgba(0,0,0,a)` over the picture is a multiply by `1-a`, which
   * is the same operation the shader does, so both paths dim by the same
   * amount — and a canvas gradient carries its last stop out to infinity, so
   * the corners are covered without a second fill.
   *
   * The HUD is left out, exactly as the heat and the frost leave it out.
   */
  _spotlightPass(ctx, source) {
    const { x, y } = this.focus;
    const grad = ctx.createRadialGradient(x, y, SPOT_LIT, x, y, SPOT_LIT + SPOT_EDGE);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${(1 - SPOT_DIM) * this.ambienceAmount})`);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, source.width, source.height - HUD_H);
  },

  _scanlinePass(ctx, source) {
    if (!this._scanline) {
      const c = makeCanvas(1, 2);
      const g = c.getContext('2d');
      g.fillStyle = `rgba(0,0,0,${SCANLINE_ALPHA})`;
      g.fillRect(0, 1, 1, 1);
      this._scanline = ctx.createPattern(c, 'repeat');
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = this._scanline;
    ctx.fillRect(0, 0, source.width, source.height);
  },

  _vignettePass(ctx, source) {
    const w = source.width;
    const h = source.height;
    if (!this._vignette || this._vignette.width !== w) {
      this._vignette = makeCanvas(w, h);
      const g = this._vignette.getContext('2d');
      const grad = g.createRadialGradient(w / 2, h / 2, h * 0.34, w / 2, h / 2, h * 0.78);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this._vignette, 0, 0);
  },

  /* ------------------------------ present ------------------------------ */

  /** Puts the finished frame on screen. A no-op unless WebGL is in play. */
  present() {
    const gl = this._gl;
    if (!gl) return false;
    const crt = this.preset === 'crt';
    gl.bindTexture(gl.TEXTURE_2D, this._tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source);
    gl.uniform2f(this._uniforms.size, this.displayCanvas.width, this.displayCanvas.height);
    gl.uniform2f(this._uniforms.source, this.source.width, this.source.height);
    // Scanlines need at least two real pixels each; below that they alias into
    // moiré instead of reading as lines, so they fade out rather than fight it.
    const room = this.displayCanvas.height / this.source.height;
    const scan = crt ? Math.min(1, Math.max(0, room - 1)) : 0;
    // The aperture grille is a three-pixel pattern, so it needs three real
    // pixels per source pixel to be a pattern at all. Below that it would only
    // dim the picture by a third and call it authenticity.
    const roomX = this.displayCanvas.width / this.source.width;
    const mask = crt ? Math.min(1, Math.max(0, (roomX - 2) / 2)) * 0.55 : 0;
    gl.uniform1f(this._uniforms.curve, crt ? 0.055 : 0);
    gl.uniform1f(this._uniforms.scan, 0.85 * scan);
    gl.uniform1f(this._uniforms.mask, mask);
    gl.uniform1f(this._uniforms.bleed, crt ? 0.55 : 0);
    // Beam and mask only ever subtract light. Roughly what they took, put back.
    gl.uniform1f(this._uniforms.gain, 1 + 0.55 * scan + 0.42 * mask);
    gl.uniform1f(this._uniforms.vignette, crt ? 0.65 : 0);
    gl.uniform1f(this._uniforms.aberration, crt ? 2.2 : 0);
    gl.uniform1f(this._uniforms.floor, HUD_H / this.source.height);
    gl.uniform1f(this._uniforms.heat, this.ambience === 'heat' ? this.ambienceAmount : 0);
    gl.uniform1f(this._uniforms.frost, this.ambience === 'frost' ? this.ambienceAmount : 0);
    gl.uniform1f(this._uniforms.dark, this.ambience === 'spotlight' ? this.ambienceAmount : 0);
    // The texture is uploaded flipped, so the lamp's y has to be flipped too.
    gl.uniform2f(this._uniforms.focus, this.focus.x / this.source.width,
      1 - this.focus.y / this.source.height);
    gl.uniform1f(this._uniforms.time, this.tick / 60);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  },

  diag() {
    return {
      mode: this.mode,
      preset: this.preset,
      name: PRESET_NAMES[this.preset],
      ambience: this.ambience,
    };
  },
};
