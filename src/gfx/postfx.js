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
const BLOOM_ALPHA = 0.45;
const SCANLINE_ALPHA = 0.24;
/**
 * Only pixels brighter than this glow, measured as luminance.
 *
 * Thresholding per channel — which is what `ctx.filter = 'contrast()'` does —
 * cannot tell a bright blue sky from a white sun, because the sky's blue
 * channel is already at 252. The result was the whole picture lifting by ~45
 * levels and going milky. Luminance can tell them apart: this sky is 153, a
 * coin is 179 and the sun is 251, so 168 glows the coin and leaves the sky be.
 */
const BLOOM_THRESHOLD = 168;

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

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  vec2 offset = uv.yx * uv.yx * uCurve;
  uv += uv * offset;
  uv = uv * 0.5 + 0.5;

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

  // One dark line per *source* row, not per screen pixel. Tying this to the
  // display size makes the frequency approach the pixel grid and the whole
  // screen dissolves into moiré rings.
  float line = sin(uv.y * uSource.y * 3.14159);
  color *= 1.0 - uScan * 0.5 * line * line;

  float v = 1.0 - uVignette * dot(uv - 0.5, uv - 0.5) * 1.9;
  color *= clamp(v, 0.0, 1.0);

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
  _gl: null,
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
    if (this.preset === 'pois') return;
    const { source } = this;
    const smoothing = ctx.imageSmoothingEnabled;
    const alpha = ctx.globalAlpha;
    const op = ctx.globalCompositeOperation;

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

    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = BLOOM_ALPHA;
    ctx.drawImage(this._bloom, 0, 0, source.width, source.height);
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
    gl.uniform1f(this._uniforms.curve, crt ? 0.055 : 0);
    gl.uniform1f(this._uniforms.scan, crt ? 0.55 * Math.min(1, Math.max(0, room - 1)) : 0);
    gl.uniform1f(this._uniforms.vignette, crt ? 0.65 : 0);
    gl.uniform1f(this._uniforms.aberration, crt ? 2.2 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  },

  diag() {
    return { mode: this.mode, preset: this.preset, name: PRESET_NAMES[this.preset] };
  },
};
