import { THEMES } from './tiles.js';
import { hashNoise } from '../core/utils.js';
import { drawTower } from './tower.js';

/**
 * Parallax scenery behind the tilemap. `bg` picks the silhouette style,
 * the palette follows the level theme.
 *
 * The still layers (mountains, hills, treelines, walls) are painted once into
 * offscreen strips and then tiled — only the sky, the weather and the moving
 * props are redrawn every frame.
 */

const strips = new Map();

/** Builds (once) a repeating strip and returns the canvas. */
function strip(key, w, h, paint) {
  let c = strips.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    paint(g, w, h);
    strips.set(key, c);
  }
  return c;
}

/** Draws a strip repeatedly across the view, wrapped at `offset`. */
function tileStrip(ctx, canvas, offset, y, viewW) {
  const w = canvas.width;
  let x = -(((Math.round(offset) % w) + w) % w);
  while (x < viewW) {
    ctx.drawImage(canvas, x, Math.round(y));
    x += w;
  }
}

const hex = (c) => [
  parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16),
];

/** Blends two #rrggbb colours; t=0 keeps `a`. */
function mix(a, b, t) {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const to = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${to(ar + (br - ar) * t)}${to(ag + (bg - ag) * t)}${to(ab + (bb - ab) * t)}`;
}

/* ------------------------------ silhouettes ---------------------------- */

function ridge(g, x, baseY, w, h, shape) {
  for (let i = 0; i < h; i++) {
    const t = i / h;
    let width;
    if (shape === 'dome') width = Math.round(w * Math.sqrt(Math.max(0, 1 - t * t)));
    else if (shape === 'round') width = Math.round(w * (1 - t * t));
    else if (shape === 'peak') width = Math.round(w * (1 - t * 0.98));
    else width = Math.round(w * (1 - t ** 0.7));
    if (width <= 0) continue;
    g.fillRect(Math.round(x + (w - width) / 2), baseY - i, width, 1);
  }
}

function snowCap(g, x, baseY, w, h, color) {
  g.fillStyle = color;
  for (let i = Math.floor(h * 0.72); i < h; i++) {
    const width = Math.round(w * (1 - i / h));
    if (width <= 0) continue;
    const jag = (i % 3 === 0) ? 1 : 0;
    g.fillRect(Math.round(x + (w - width) / 2) - jag, baseY - i, width + jag * 2, 1);
  }
}

/** Pine tree, used on the grass and ice treelines. */
function pine(g, x, baseY, h, body, dark) {
  const half = Math.round(h * 0.44);
  g.fillStyle = dark;
  g.fillRect(x + half - 1, baseY - 4, 3, 4);
  for (let i = 0; i < h - 4; i++) {
    const t = i / (h - 4);
    const w = Math.round(half * 2 * (1 - t) * (0.55 + 0.45 * ((i % 7) / 7)));
    if (w <= 0) continue;
    g.fillStyle = i % 7 === 6 ? dark : body;
    g.fillRect(x + half - Math.floor(w / 2), baseY - 4 - i, w, 1);
  }
}

function cactus(g, x, baseY, h, body, dark) {
  g.fillStyle = body;
  g.fillRect(x + 2, baseY - h, 4, h);
  g.fillRect(x, baseY - Math.round(h * 0.7), 2, 2);
  g.fillRect(x, baseY - Math.round(h * 0.7), 1, Math.round(h * 0.35));
  g.fillRect(x + 6, baseY - Math.round(h * 0.55), 2, 2);
  g.fillRect(x + 7, baseY - Math.round(h * 0.55), 1, Math.round(h * 0.28));
  g.fillStyle = dark;
  g.fillRect(x + 5, baseY - h, 1, h);
}

/**
 * Kylkiluut, luulaakson horisontin oma kasvi.
 *
 * Piirretään samalla `plant`-koneistolla kuin männyt ja kaktukset, koska se on
 * juuri se paikka jossa maailma saa oman kasvustonsa — ja koska kylkiluut ovat
 * täsmälleen sitä: jotain joka on kasvanut kukkulan rinteeseen ja jäänyt
 * sinne. Selkäranka pystyyn, luut siitä ulos pareittain ja kaartuen alaspäin,
 * ylin pari lyhin. Ei kalloa: kallo tekisi tästä hahmon, ja horisontti ei ole
 * hahmo.
 */
function ribcage(g, x, baseY, h, body, dark) {
  const pairs = Math.max(3, Math.round(h / 5));
  g.fillStyle = dark;
  g.fillRect(x, baseY - h, 2, h);                    // selkäranka
  for (let i = 0; i < pairs; i++) {
    const t = i / (pairs - 1);
    const y = Math.round(baseY - h + 2 + t * (h - 5));
    const w = Math.max(2, Math.round(3 + (1 - Math.abs(t - 0.55) * 1.6) * (h * 0.28)));
    g.fillStyle = i % 2 ? dark : body;
    g.fillRect(x - w, y, w, 1);
    g.fillRect(x + 2, y, w, 1);
    g.fillRect(x - w, y + 1, 1, 2);                  // kaarre alaspäin kummassakin päässä
    g.fillRect(x + 1 + w, y + 1, 1, 2);
  }
}

function deadTree(g, x, baseY, h, color) {
  g.fillStyle = color;
  g.fillRect(x + 3, baseY - h, 2, h);
  g.fillRect(x, baseY - h + 3, 3, 1);
  g.fillRect(x, baseY - h + 1, 1, 3);
  g.fillRect(x + 5, baseY - h + 6, 3, 1);
  g.fillRect(x + 7, baseY - h + 3, 1, 4);
}

/* ------------------------------- the sky ------------------------------- */

function sky(ctx, th, themeName, viewW, viewH, camX, tick, clock) {
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, th.sky[0]);
  grad.addColorStop(0.62, mix(th.sky[0], th.sky[1], 0.75));
  grad.addColorStop(1, th.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);

  const night = themeName === 'factory' || themeName === 'fortress' || themeName === 'night'
    || themeName === 'bone';
  if (night) {
    for (let i = 0; i < 44; i++) {
      const sx = hashNoise(i, 3);
      const sy = hashNoise(i, 11);
      const tw = (Math.sin(tick / 18 + i * 2.1) + 1) / 2;
      if (tw < 0.25) continue;
      ctx.fillStyle = `rgba(255,255,255,${0.18 + tw * 0.4})`;
      const x = Math.round(((sx * (viewW + 60) - camX * 0.04) % (viewW + 60) + viewW + 60)
        % (viewW + 60) - 30);
      ctx.fillRect(x, Math.round(sy * viewH * 0.5), 1, 1);
    }
  }

  /*
   * AURINKO ON KELLO.
   *
   * `clock` on kentän jäljellä oleva aika osuutena (1 alussa, 0 kun aika on
   * loppu). Kun se annetaan, aurinko nousee vasemmalta idästä, käy korkeimmillaan
   * puolivälissä ja **koskettaa horisonttia täsmälleen silloin kun aika loppuu**.
   * Se on sama luku kuin `AIKA`-lukema, mutta maailman puolella: kellon voi
   * lukea nostamatta katsetta kentästä.
   *
   * Parallaksi jää tästä pois eikä se ole tappio. Aurinko liikkui ennen kameran
   * mukana 0,03:n kertoimella, eli hitusen — nyt se liikkuu ajan mukana, ja
   * kaksi eri syytä liikkua samalle kappaleelle tekisi kummastakin lukukelvottoman.
   *
   * Ilman `clock`ia (kartta, esittely, mikä tahansa muu piirtäjä) vanha
   * parallaksi jää voimaan: aurinko on silloin maisemaa eikä mittari.
   */
  const timed = clock !== null && clock !== undefined;
  const gone = timed ? Math.min(1, Math.max(0, 1 - clock)) : 0;
  const cx = timed
    ? Math.round(24 + (viewW - 48) * gone)
    : Math.round(((238 - camX * 0.03) % (viewW + 120) + viewW + 120) % (viewW + 120) - 60);
  const cy = timed
    ? Math.round(viewH * 0.66 - Math.sin(gone * Math.PI) * viewH * 0.52)
    : 34;
  if (themeName === 'desert') disc(ctx, cx, cy, 15, '#fff2c0', '#ffd070', tick, true);
  else if (themeName === 'grass') disc(ctx, cx, cy, 12, '#fffde0', '#ffe98c', tick, true);
  else if (themeName === 'ice') disc(ctx, cx, cy, 11, '#ffffff', '#cfe6ff', tick, false);
  else if (themeName === 'night') disc(ctx, cx, cy, 13, '#fff8d8', '#e8d89a', tick, false);
  // Luulaakson kuu on pelin suurin ja kylmin: Danse macabre on keskiyö, ja
  // keskiyö on tässä maailmassa kellonaika eikä tunnelma.
  else if (themeName === 'bone') disc(ctx, cx, cy, 16, '#f4f0e0', '#b0b4c8', tick, false);
  // Kaasukehän aurinko on pelin ainoa jolla on sädekehä ilman lämmintä
  // taivasta: pilvikerroksen päällä valo tulee suoraan eikä ilmakehän läpi,
  // joten se on valkoinen ja terävä eikä keltainen ja utuinen.
  else if (themeName === 'cloud') disc(ctx, cx, cy, 13, '#ffffff', '#ffe8a0', tick, true);
  else disc(ctx, cx, cy, 10, '#e8e8ff', '#9a9ac8', tick, false);
}

/**
 * The coin cube's own parallax, and it is the slowest thing in the picture.
 *
 * 0.06 against the far ridge's 0.14: over a level's worth of running it
 * crosses about a third of the screen, which is the "veeeeeerrryyy slowly"
 * the owner asked for. It is a **rate** and not a fraction of the level's
 * length, deliberately — tying it to progress would have made it a second
 * answer to the question the sun already answers, and DESIGN.md item 8 forbids
 * the game two ways of saying the same thing. A rate says only *far away*.
 *
 * It hangs above the far ridge rather than standing on the tilemap: it is
 * behind the hills, and something behind the hills whose feet are on the
 * player's floor is a thing the size of a house pretending to be a world.
 */
function drawSkyTower(ctx, tower, camX, groundY, th) {
  if (!tower) return;
  const span = 640;
  const x = Math.round(((tower.at - camX * 0.06) % span + span) % span - 90);
  const sky = hex(th.sky[1]);
  drawTower(ctx, x, groundY - 118, {
    fill: tower.fill,
    lives: tower.lives,
    haze: 0.5,
    sky,
    phase: tower.tick || 0,
    rising: tower.rising === undefined ? 1 : tower.rising,
  });
}

function disc(ctx, cx, cy, r, core, rim, tick, rays) {
  if (rays) {
    /*
     * THE GLOW FALLS OFF, and before it did it was being read as a second sun.
     *
     * Owner, from play: *"why does level KUUMA DYYNI have two suns? That feels
     * like an error."* — it is one sun. Scanned across the whole of 2-1 by the
     * sun's exact core colour, sixty camera positions, exactly one disc in
     * every frame. What the second one was is **this**: a hard-edged circle at
     * twice the radius and six per cent alpha, which is not a glow, it is a
     * faint disc with a rim. A rim is an edge and an edge is an object.
     *
     * Drawn now as concentric bands whose alpha falls to nothing at the
     * outside, so the halo has no border to be mistaken for one. Same light,
     * same size, no second object.
     */
    const bands = 7;
    const outer = r * 2;
    for (let b = bands; b >= 1; b--) {
      const rr = (outer * b) / bands;
      const fade = 1 - (b - 1) / bands;
      const a = (0.055 + 0.018 * Math.sin(tick / 30)) * fade * fade;
      ctx.fillStyle = `rgba(255,236,160,${a.toFixed(4)})`;
      for (let dy = -rr; dy <= rr; dy++) {
        const half = Math.round(Math.sqrt(Math.max(0, rr * rr - dy * dy)));
        ctx.fillRect(cx - half, cy + Math.round(dy), half * 2, 1);
      }
    }
  }
  ctx.fillStyle = rim;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    ctx.fillRect(cx - half, cy + dy, half * 2, 1);
  }
  ctx.fillStyle = core;
  const ri = r - 2;
  for (let dy = -ri; dy <= ri; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, ri * ri - dy * dy)));
    ctx.fillRect(cx - half + 1, cy + dy - 1, half * 2, 1);
  }
}

/* ------------------------------- weather ------------------------------- */

function weather(ctx, themeName, camX, viewW, viewH, tick) {
  if (themeName === 'ice') {
    // snow: two depths, the near flakes bigger and faster
    for (let layerIndex = 0; layerIndex < 2; layerIndex++) {
      const count = layerIndex ? 22 : 34;
      const speed = layerIndex ? 1.15 : 0.6;
      const size = layerIndex ? 2 : 1;
      ctx.fillStyle = layerIndex ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)';
      for (let i = 0; i < count; i++) {
        // x and y need independent seeds, or every flake lines up on a diagonal
        const sx = hashNoise(i, layerIndex * 7 + 1);
        const sy = hashNoise(i * 31 + 5, layerIndex * 13 + 2);
        const span = viewW + 40;
        const drift = Math.sin((tick + i * 30) / 40) * 8;
        const x = ((sx * span - camX * (0.2 + layerIndex * 0.2) + drift) % span + span) % span - 20;
        const y = ((sy * viewH + tick * speed) % viewH + viewH) % viewH;
        ctx.fillRect(Math.round(x), Math.round(y), size, size);
      }
    }
    return;
  }

  if (themeName === 'desert' || themeName === 'night') {
    // sand streaking past on the wind
    for (let i = 0; i < 26; i++) {
      const seed = hashNoise(i, 5);
      const sy = hashNoise(i * 17 + 3, 23);
      const span = viewW + 60;
      const x = ((seed * span - tick * (1.8 + seed * 2.2) - camX * 0.3) % span + span) % span - 30;
      const y = 60 + sy * (viewH - 70) + Math.sin((tick + i * 20) / 26) * 3;
      ctx.fillStyle = themeName === 'night'
        ? `rgba(200,200,255,${0.10 + seed * 0.14})`
        : `rgba(255,228,180,${0.12 + seed * 0.18})`;
      ctx.fillRect(Math.round(x), Math.round(y), 3 + Math.round(seed * 4), 1);
    }
    return;
  }

  if (themeName === 'bone') {
    /*
     * Virvatulia: kylmiä valopisteitä jotka nousevat maasta ja sammuvat.
     *
     * Sama hiukkasmoottori kuin tehtaan kekäleillä ja tarkoituksella: molemmat
     * nousevat, joten ero on väri ja tahti eikä liike. Kekäle on oranssi ja
     * nopea, virvatuli sinivalkoinen ja hidas — ja se sykkii matkalla, mikä on
     * se yksi asia jota kuumasta noussut hiukkanen ei tee.
     */
    for (let i = 0; i < 16; i++) {
      const seed = hashNoise(i, 61);
      const phase = hashNoise(i * 29 + 7, 71);
      const cycle = 260 + Math.floor(phase * 160);
      const age = (tick + Math.floor(phase * cycle)) % cycle;
      const t = age / cycle;
      const span = viewW + 40;
      const x = ((seed * span - camX * 0.3 + Math.sin((tick + i * 17) / 34) * 9) % span + span)
        % span - 20;
      const y = viewH - 12 - t * (viewH * 0.7);
      const pulse = 0.55 + 0.45 * Math.sin((tick + i * 40) / 9);
      const a = (1 - t) * 0.7 * pulse;
      ctx.fillStyle = `rgba(190,235,255,${a})`;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      if (seed > 0.7) ctx.fillStyle = `rgba(140,200,230,${a * 0.5})`;
      ctx.fillRect(Math.round(x) - 1, Math.round(y) + 1, 3, 1);
    }
    return;
  }

  if (themeName === 'cloud') {
    /*
     * Viima: pitkiä ohuita repaleita jotka kiitävät ohi vaakasuoraan.
     *
     * Sama hiukkasmoottori kuin aavikon hiekalla ja tarkoituksella, koska se on
     * sama ilmiö: tuulessa kulkeva aine. Ero on että nämä ovat **valkoisia ja
     * pidempiä** ja että ne kulkevat molempiin suuntiin — ylempi kerros
     * nopeammin kuin alempi. Se on ainoa asia ruudulla joka kertoo että
     * kerrosten välillä on liikettä, ja se on myös syy miksi tämä maailma
     * kuulostaa aavikolta: `THEME_AMBIENCE` antaa sille saman tuulen, koska
     * tuuli on tuulta.
     */
    for (let layerIndex = 0; layerIndex < 2; layerIndex++) {
      for (let i = 0; i < 18; i++) {
        const seed = hashNoise(i, 51 + layerIndex * 13);
        const sy = hashNoise(i * 23 + 5, 67 + layerIndex);
        const span = viewW + 80;
        const speed = layerIndex ? 2.6 + seed * 2.4 : 0.9 + seed * 1.1;
        const x = ((seed * span - tick * speed - camX * (0.2 + layerIndex * 0.25)) % span + span)
          % span - 40;
        const y = 24 + sy * (viewH - 60) + Math.sin((tick + i * 30) / 60) * 2;
        ctx.fillStyle = `rgba(255,255,255,${(layerIndex ? 0.22 : 0.10) + seed * 0.16})`;
        ctx.fillRect(Math.round(x), Math.round(y), 6 + Math.round(seed * (layerIndex ? 14 : 7)), 1);
      }
    }
    return;
  }

  if (themeName === 'factory' || themeName === 'fortress') {
    // embers rising off the machinery / torches
    for (let i = 0; i < 20; i++) {
      const seed = hashNoise(i, 9);
      const phase = hashNoise(i * 23 + 11, 37);
      const cycle = 150 + Math.floor(phase * 90);
      const age = (tick + Math.floor(phase * cycle)) % cycle;
      const t = age / cycle;
      const span = viewW + 40;
      const x = ((seed * span - camX * 0.35 + Math.sin((tick + i * 11) / 18) * 6) % span + span)
        % span - 20;
      const y = viewH - t * (viewH * 0.85);
      const a = (1 - t) * 0.8;
      ctx.fillStyle = t > 0.6 ? `rgba(255,120,40,${a})` : `rgba(255,210,90,${a})`;
      ctx.fillRect(Math.round(x), Math.round(y), 1, seed > 0.6 ? 2 : 1);
    }
    return;
  }

  // grass: pollen and the odd distant bird
  for (let i = 0; i < 14; i++) {
    const seed = hashNoise(i, 21);
    const sy = hashNoise(i * 19 + 7, 43);
    const span = viewW + 40;
    const x = ((seed * span - tick * (0.25 + seed * 0.35) - camX * 0.25) % span + span) % span - 20;
    const y = 40 + sy * (viewH - 90) + Math.sin((tick + i * 40) / 50) * 6;
    ctx.fillStyle = `rgba(255,255,220,${0.2 + seed * 0.25})`;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  for (let i = 0; i < 3; i++) {
    const seed = hashNoise(i, 33);
    const span = viewW + 120;
    const x = ((seed * span + tick * (0.28 + seed * 0.2) - camX * 0.1) % span + span) % span - 60;
    const y = 26 + seed * 34 + Math.sin((tick + i * 60) / 70) * 4;
    const flap = Math.floor(tick / 9 + i) % 2;
    ctx.fillStyle = 'rgba(40,50,70,0.5)';
    ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - flap, 2, 1);
    ctx.fillRect(Math.round(x) + 2, Math.round(y) - flap, 2, 1);
  }
}

/* ------------------------------- fortress ------------------------------ */

function fortressRoom(ctx, th, camX, viewW, viewH, tick) {
  ctx.fillStyle = '#0b0b14';
  ctx.fillRect(0, 0, viewW, viewH);

  const wall = strip(`wall:${th.hillDark}`, 128, 208, (g, w, h) => {
    g.fillStyle = mix(th.hillDark, '#000000', 0.35);
    g.fillRect(0, 0, w, h);
    // coursed stone with a little variation per block
    for (let row = 0; row * 16 < h; row++) {
      const off = row % 2 ? 16 : 0;
      for (let col = -1; col * 32 + off < w + 32; col++) {
        const x = col * 32 + off;
        const y = row * 16;
        const n = hashNoise(col + row * 3, row);
        g.fillStyle = mix(th.hillDark, n > 0.5 ? '#ffffff' : '#000000', 0.06 + n * 0.05);
        g.fillRect(x + 1, y + 1, 30, 14);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x, y + 15, 32, 1);
        g.fillRect(x + 31, y, 1, 16);
      }
    }
  });
  tileStrip(ctx, wall, -camX * 0.25, 0, viewW);

  // barred windows with cold light spilling through
  const period = 192;
  const first = Math.floor((camX * 0.25) / period) - 1;
  for (let i = first; i < first + 4; i++) {
    const x = Math.round(i * period - camX * 0.25);
    if (x < -40 || x > viewW + 40) continue;
    ctx.fillStyle = '#1b2340';
    ctx.fillRect(x, 18, 22, 40);
    ctx.fillStyle = '#38507e';
    ctx.fillRect(x + 2, 20, 18, 36);
    ctx.fillStyle = '#0d0d18';
    for (let b = 0; b < 3; b++) ctx.fillRect(x + 5 + b * 6, 20, 2, 36);
    ctx.fillStyle = 'rgba(90,120,190,0.07)';
    ctx.fillRect(x - 6, 58, 34, viewH - 58);
  }

  // torches: bracket, flame and a pool of light
  for (let i = 0; i < 6; i++) {
    const span = viewW + 96;
    const x = Math.round(((i * 96 - camX * 0.5) % span + span) % span - 48);
    const y = 84;
    const flick = 0.72 + 0.28 * Math.sin(tick / 5 + i * 2) + 0.1 * Math.sin(tick / 2.3 + i);
    ctx.fillStyle = `rgba(255,170,70,${0.05 + 0.025 * flick})`;
    ctx.fillRect(x - 26, 0, 52, viewH);
    ctx.fillStyle = '#3a3a4e';
    ctx.fillRect(x - 2, y, 4, 12);
    ctx.fillStyle = '#22222e';
    ctx.fillRect(x - 4, y + 10, 8, 3);
    const fh = Math.round(9 * flick);
    for (let f = 0; f < fh; f++) {
      const t = f / Math.max(1, fh);
      const w = Math.max(1, Math.round(6 * (1 - t)));
      const sway = Math.round(Math.sin(tick / 4 + i + f / 2) * (t * 1.6));
      ctx.fillStyle = t > 0.7 ? '#fff0a0' : t > 0.35 ? '#ffb020' : '#f06010';
      ctx.fillRect(x - Math.floor(w / 2) + sway, y - 2 - f, w, 1);
    }
  }

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, viewH - 18, viewW, 18);
  weather(ctx, 'fortress', camX, viewW, viewH, tick);
}

/* -------------------------------- factory ------------------------------ */

function factoryYard(ctx, th, camX, viewW, viewH, tick) {
  const far = -camX * 0.18;
  const near = -camX * 0.45;

  const skyline = strip(`skyline:${th.hillDark}`, 240, 120, (g) => {
    g.fillStyle = mix(th.hillDark, '#000000', 0.2);
    for (let i = 0; i < 7; i++) {
      const n = hashNoise(i, 2);
      const x = i * 34 + Math.floor(n * 6);
      const h = 40 + Math.floor(n * 60);
      g.fillRect(x, 120 - h, 26, h);
      g.fillRect(x - 2, 120 - h - 4, 30, 4);
    }
  });
  tileStrip(ctx, skyline, far, viewH - 120, viewW);

  // smoke curling out of the stacks
  for (let i = 0; i < 5; i++) {
    const span = 240;
    const baseX = ((i * 68 + far) % (span + viewW) + span + viewW) % (span + viewW) - span;
    for (let p = 0; p < 6; p++) {
      const age = ((tick * 0.5 + p * 22 + i * 13) % 132) / 132;
      const y = viewH - 96 - age * 70;
      const x = baseX + 12 + Math.sin((tick / 40) + p + i) * (6 + age * 14);
      const s = 3 + Math.round(age * 6);
      ctx.fillStyle = `rgba(90,84,110,${0.5 * (1 - age)})`;
      ctx.fillRect(Math.round(x), Math.round(y), s, s);
    }
  }

  const pipes = strip(`pipes:${th.hill}`, 120, 110, (g) => {
    g.fillStyle = mix(th.hill, '#000000', 0.12);
    g.fillRect(10, 20, 24, 90);
    g.fillRect(6, 14, 32, 7);
    g.fillRect(70, 44, 18, 66);
    g.fillRect(66, 38, 26, 7);
    g.fillStyle = mix(th.hill, '#ffffff', 0.12);
    g.fillRect(12, 22, 5, 88);
    g.fillRect(72, 46, 4, 64);
    g.fillStyle = mix(th.hill, '#000000', 0.35);
    for (let y = 26; y < 110; y += 18) {
      g.fillRect(9, y, 26, 3);
      if (y > 46) g.fillRect(69, y, 20, 3);
    }
  });
  tileStrip(ctx, pipes, near, viewH - 110, viewW);

  // turning gears, the one thing that has to stay animated
  ctx.fillStyle = th.hill;
  for (let i = -1; i < 9; i++) {
    const gx = Math.round(near + i * 104 + 40);
    if (gx < -30 || gx > viewW + 30) continue;
    const gy = viewH - 58;
    const spin = tick * 0.02 + i;
    for (let t = 0; t < 8; t++) {
      const a = spin + (t * Math.PI) / 4;
      ctx.fillStyle = th.hill;
      ctx.fillRect(Math.round(gx + Math.cos(a) * 16) - 3, Math.round(gy + Math.sin(a) * 16) - 3, 6, 6);
    }
    ctx.fillStyle = th.hill;
    ctx.fillRect(gx - 11, gy - 11, 22, 22);
    ctx.fillStyle = th.hillDark;
    ctx.fillRect(gx - 4, gy - 4, 8, 8);
    ctx.fillStyle = mix(th.hill, '#ffffff', 0.2);
    ctx.fillRect(gx - 11, gy - 11, 22, 1);
  }

  // warning lamps blinking along the gantry
  for (let i = -1; i < 8; i++) {
    const lx = Math.round(near + i * 104 + 92);
    if (lx < -8 || lx > viewW + 8) continue;
    const on = Math.floor(tick / 24 + i) % 2 === 0;
    ctx.fillStyle = on ? '#ff5030' : '#5a2418';
    ctx.fillRect(lx, viewH - 34, 3, 3);
    if (on) {
      ctx.fillStyle = 'rgba(255,80,48,0.15)';
      ctx.fillRect(lx - 3, viewH - 37, 9, 9);
    }
  }

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, viewH - 26, viewW, 26);
  weather(ctx, 'factory', camX, viewW, viewH, tick);
}

/* -------------------------------- clouds ------------------------------- */

function cloud(ctx, x, y, size, color, shade) {
  const s = size;
  ctx.fillStyle = shade;
  ctx.fillRect(x, y + 5 * s, 26 * s, 3 * s);
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 3 * s, 26 * s, 3 * s);
  ctx.fillRect(x + 5 * s, y, 10 * s, 6 * s);
  ctx.fillRect(x + 14 * s, y + 2 * s, 8 * s, 4 * s);
  ctx.fillRect(x + 2 * s, y + 2 * s, 5 * s, 3 * s);
}

/* ------------------------------- kaasukehä ------------------------------ */

/**
 * PILVIMEREN TAUSTA, ja se yksi asia jonka sen on sanottava.
 *
 * Maailma 7:n koko ongelma on ettei se saa lukea bonushuoneena. Kentät
 * vastaavat siihen lattialla (`levels/world7.js`), ja tausta vastaa siihen
 * yhdellä asialla jota taivaskaistan tausta ei koskaan tee: **täällä näkyy
 * alas.** Lähimmän pilvikerroksen repeämistä pilkottaa maailma, jonka päällä
 * tämä on — vihreää ja ruskeaa, liian kaukana erottuakseen miksikään. Se on
 * ero paikan ja huoneen välillä siinä muodossa jonka silmä lukee ilman että
 * kukaan selittää: bonushuoneen takana on taivas, tämän takana on matka.
 *
 * Kolme kerrosta kuten muillakin taustoilla, mutta ne ovat pilviä eivätkä
 * kukkuloita, ja siksi ne ovat **vaakaan venytettyjä**. Vuoren siluetti on
 * pystysuuntainen tapahtuma; pilvikerros on vaakasuuntainen, ja jos sen
 * piirtää `ridge()`:llä siitä tulee lumeton vuori.
 *
 * Ukkospäät seisovat kaukaisimmalla kerroksella eivätkä lähimmällä. Ne ovat
 * tämän maailman ainoa pystysuora asia, ja lähellä ne peittäisivät juuri sen
 * repeämän jonka takia tausta on olemassa.
 */
function cloudSea(ctx, th, camX, viewW, viewH, tick, groundY) {
  const bank = (key, w, h, paint) => strip(key, w, h, paint);

  /* Far: a flat shelf of cloud with thunderheads standing on it. Washed most of
   * the way to the sky colour, because distance in air is haze and nothing
   * else. */
  const FAR_H = 132;
  const farColor = mix(th.cloud, th.sky[1], 0.55);
  const farTop = mix(th.cloud, th.sky[1], 0.3);
  const farStrip = bank(`cloudfar:${th.sky[1]}`, 288, FAR_H, (g, w, h) => {
    for (let i = 0; i < 5; i++) {
      const n = hashNoise(i, 71);
      const cx = i * 62 + Math.floor(n * 20);
      const ch = Math.round(46 + n * 54);
      // A thunderhead: a column that widens as it rises and then flattens off
      // into an anvil, which is the one silhouette a cloud has that a hill
      // cannot borrow.
      g.fillStyle = farColor;
      for (let k = 0; k < ch; k++) {
        const t = k / ch;
        const wide = Math.round(16 + t * 26 + (t > 0.78 ? (t - 0.78) * 120 : 0));
        g.fillRect(cx - Math.floor(wide / 2), h - 26 - k, wide, 1);
      }
      g.fillStyle = farTop;
      g.fillRect(cx - 20, h - 26 - ch, 40, 2);
    }
    g.fillStyle = farColor;
    g.fillRect(0, h - 26, w, 26);
    g.fillStyle = farTop;
    for (let x = 0; x < w; x += 8) {
      const n = hashNoise(x, 13);
      g.fillRect(x, h - 26 - Math.round(n * 3), 8, 2 + Math.round(n * 3));
    }
  });
  tileStrip(ctx, farStrip, -camX * 0.12, groundY - FAR_H, viewW);

  /* Mid: fat cumulus, drifting on their own on top of the parallax. Clouds are
   * the one piece of scenery in this game that has a reason to move while the
   * camera stands still. */
  const midColor = mix(th.cloud, th.sky[1], 0.22);
  const midShade = mix(th.cloud, th.sky[1], 0.5);
  for (let i = 0; i < 9; i++) {
    const seed = hashNoise(i * 17, 29);
    const span = viewW + 180;
    const x = Math.round(((-camX * 0.3 - tick * 0.14 + i * 92 + seed * 70) % span + span)
      % span - 90);
    const y = groundY - 96 + Math.floor(seed * 46);
    cloud(ctx, x, y, 1 + Math.floor(seed * 2), midColor, midShade);
  }

  /* Near: the cloud floor the road is standing on, with tears in it. */
  const NEAR_H = 74;
  const nearStrip = bank(`cloudnear:${th.cloud}`, 224, NEAR_H, (g, w, h) => {
    g.fillStyle = mix(th.cloud, th.sky[1], 0.08);
    g.fillRect(0, 22, w, h - 22);
    // lobes along the top edge, so the seam with the sky is not a ruler line
    for (let x = 0; x < w; x += 6) {
      const n = hashNoise(x * 3, 91);
      const lobe = Math.round(n * 20);
      g.fillRect(x, 22 - lobe, 7, lobe + 2);
    }
    g.fillStyle = mix(th.cloud, th.sky[1], 0.34);
    for (let x = 0; x < w; x += 4) {
      const n = hashNoise(x, 37);
      if (n > 0.6) g.fillRect(x, 30 + Math.round(n * 20), 10, 2);
    }

    /*
     * Repeämät, ja tässä on koko taustan syy olla olemassa. Aukon läpi näkyy
     * maailma jonka päällä ollaan: vihreää ja ruskeaa laikkua, liian kaukana
     * erottuakseen miksikään yksittäiseksi asiaksi. Sen ei pidäkään erottua —
     * jos siitä tunnistaisi pellon, se olisi maisema; kun siitä ei tunnista
     * mitään, se on korkeus.
     */
    for (let i = 0; i < 3; i++) {
      const n = hashNoise(i, 101);
      const gx = Math.round(20 + i * 74 + n * 20);
      const gw = 22 + Math.round(n * 18);
      g.fillStyle = '#5c7a4c';
      g.fillRect(gx, 44, gw, 10);
      g.fillStyle = '#7a6a44';
      g.fillRect(gx + 3, 46, Math.round(gw * 0.4), 4);
      g.fillRect(gx + Math.round(gw * 0.6), 49, Math.round(gw * 0.3), 3);
      g.fillStyle = '#46603c';
      g.fillRect(gx + 2, 51, gw - 5, 2);
      // the torn lip, lighter than the sheet so the hole reads as a hole
      g.fillStyle = th.cloud;
      g.fillRect(gx - 3, 40, gw + 6, 4);
      g.fillRect(gx - 3, 54, gw + 6, 4);
    }
  });
  tileStrip(ctx, nearStrip, -camX * 0.52, groundY - NEAR_H, viewW);

  // Haze into the tilemap, brighter than anywhere else: air lit from above.
  const haze = ctx.createLinearGradient(0, groundY - 26, 0, groundY);
  haze.addColorStop(0, 'rgba(255,255,255,0)');
  haze.addColorStop(1, 'rgba(255,255,255,0.38)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, groundY - 26, viewW, 26);
}

/* --------------------------------- main -------------------------------- */

/**
 * `drop` pushes the scenery down the screen without moving the sky, for the
 * moments when the camera is above the ground band of a tall level: hills at
 * the player's feet twenty tiles up in the air would say the climb never
 * happened. Zero — every ordinary level — is the picture this always drew.
 */
export function drawBackdrop(ctx, bg, theme, camX, viewW, viewH, tick, drop = 0,
  clock = null, tower = null) {
  const th = THEMES[theme] || THEMES.grass;

  if (bg === 'none') {
    fortressRoom(ctx, th, camX, viewW, viewH, tick);
    return;
  }

  sky(ctx, th, theme, viewW, viewH, camX, tick, clock);

  if (bg === 'factory') {
    factoryYard(ctx, th, camX, viewW, viewH, tick);
    return;
  }

  if (bg === 'clouds') {
    cloudSea(ctx, th, camX, viewW, viewH, tick, viewH + drop);
    weather(ctx, theme, camX, viewW, viewH, tick);
    return;
  }

  const groundY = viewH + drop;

  const shape = bg === 'dunes' ? 'round' : bg === 'peaks' ? 'peak' : 'dome';
  const farColor = mix(th.hillDark, th.sky[1], 0.62);
  const capColor = theme === 'ice' ? '#ffffff' : 'rgba(255,255,255,0.8)';

  // Far ridge — washed out towards the sky colour so it reads as distance.
  // The ridges are tall because the tilemap floor covers the bottom third.
  const FAR_H = 150;
  const farStrip = strip(`far:${bg}:${theme}`, 288, FAR_H, (g) => {
    g.fillStyle = farColor;
    for (let i = 0; i < 4; i++) {
      const n = hashNoise(i, 41);
      const w = Math.round((shape === 'peak' ? 104 : 138) + n * 52);
      const h = Math.round((shape === 'peak' ? 96 : 70) + n * 22);
      ridge(g, i * 72 - 24, FAR_H - 1, w, h, shape);
      if (shape === 'peak') snowCap(g, i * 72 - 24, FAR_H - 1, w, h, capColor);
    }
  });
  tileStrip(ctx, farStrip, -camX * 0.14, groundY - FAR_H, viewW);

  /*
   * THE COIN TOWER GOES HERE, and where is the whole point.
   *
   * Owner: *"make sure the bottom part of the tower integrates nicely with
   * the other layers, maybe the layers reveal and hide some parts of the
   * bottom at times?"* — and this is the one line that does it. Between the
   * far ridge and the middle one, the tower is behind everything that scrolls
   * faster than it, so the middle and near crests **sweep across its feet as
   * you run**: sometimes you see it standing on the hills, sometimes only its
   * lit top over a treeline.
   *
   * That changing occlusion is the strongest depth cue a flat picture has.
   * Smaller and paler are guesses the eye can argue with; something passing in
   * front of something else is not.
   */
  drawSkyTower(ctx, tower, camX, groundY, th);

  // Clouds sit between the far and mid ridges.
  const cloudShade = mix(th.cloud, th.sky[1], 0.45);
  for (let i = 0; i < 7; i++) {
    const seed = hashNoise(i * 13, 7);
    const y = 12 + Math.floor(seed * 52) + drop * 0.55;
    const span = viewW + 140;
    const x = Math.round(((-camX * 0.12 - tick * 0.08 + i * 74 + seed * 60) % span + span) % span - 70);
    cloud(ctx, x, y, 1 + Math.floor(seed * 2), th.cloud, cloudShade);
  }

  // Mid ridge.
  const MID_H = 124;
  const midStrip = strip(`mid:${bg}:${theme}`, 256, MID_H, (g) => {
    g.fillStyle = th.hillDark;
    for (let i = 0; i < 4; i++) {
      const n = hashNoise(i, 17);
      const w = Math.round((shape === 'peak' ? 90 : 118) + n * 40);
      const h = Math.round((shape === 'peak' ? 74 : 56) + n * 18);
      ridge(g, i * 64 - 12, MID_H - 1, w, h, shape);
      if (shape === 'peak') snowCap(g, i * 64 - 12, MID_H - 1, w, h, capColor);
    }
  });
  tileStrip(ctx, midStrip, -camX * 0.28, groundY - MID_H, viewW);

  // Near ridge, with a treeline / cactus field planted along each crest.
  const NEAR_H = 104;
  const nearStrip = strip(`near:${bg}:${theme}`, 232, NEAR_H, (g) => {
    const hills = [];
    for (let i = 0; i < 3; i++) {
      const n = hashNoise(i, 29);
      hills.push({
        x: i * 78 - 6,
        w: Math.round(96 + n * 40),
        h: Math.round((shape === 'peak' ? 56 : 42) + n * 16),
      });
    }
    g.fillStyle = th.hill;
    for (const hl of hills) ridge(g, hl.x, NEAR_H - 1, hl.w, hl.h, shape === 'peak' ? 'bump' : shape);

    // Anything growing goes on the upper slope, where the tilemap cannot hide it.
    // Mountain levels stay bare: the near hills hide behind the peaks, so trees
    // planted on them would look like they are floating in mid-air.
    const plant = (fn, count, spread) => {
      if (shape === 'peak') return;
      for (const hl of hills) {
        for (let k = 0; k < count; k++) {
          const n = hashNoise(hl.x + k * 7, 53);
          const off = (k - (count - 1) / 2) * spread + (n - 0.5) * 10;
          const t = Math.abs(off) / (hl.w / 2);
          const baseY = NEAR_H - 1 - Math.round(hl.h * (1 - t) * 0.82);
          fn(Math.round(hl.x + hl.w / 2 + off), baseY, n);
        }
      }
    };

    if (theme === 'grass' || theme === 'ice') {
      const body = theme === 'ice' ? mix(th.hill, '#0a2a3a', 0.5) : mix(th.hill, '#0a2a12', 0.45);
      const dark = mix(body, '#000000', 0.35);
      plant((x, y, n) => {
        const h = Math.round(19 + n * 14);
        pine(g, x, y, h, body, dark);
        if (theme === 'ice') {
          g.fillStyle = 'rgba(255,255,255,0.55)';
          g.fillRect(x + 1, y - h, 6, 1);
          g.fillRect(x, y - h + 5, 8, 1);
        }
      }, 3, 30);
    } else if (theme === 'desert') {
      const body = mix(th.hill, '#1a6a2a', 0.55);
      const dark = mix(body, '#000000', 0.35);
      plant((x, y, n) => {
        if (n > 0.55) cactus(g, x, y, Math.round(13 + n * 11), body, dark);
        else deadTree(g, x, y, Math.round(11 + n * 8), mix(th.hill, '#000000', 0.45));
      }, 3, 28);
    } else if (theme === 'bone') {
      /* Vaaleaa luuta tummaa kukkulaa vasten, eli päinvastoin kuin muualla,
       * missä kasvusto on maisemaa tummempaa. Se on tarkoitus: keskiyön
       * siluetti erottuu vain jos se on taustaansa VAALEAMPI. */
      const body = mix(th.hill, '#e8e0cc', 0.62);
      const dark = mix(th.hill, '#e8e0cc', 0.3);
      plant((x, y, n) => {
        if (n > 0.5) ribcage(g, x, y, Math.round(16 + n * 12), body, dark);
        else deadTree(g, x, y, Math.round(12 + n * 9), body);
      }, 3, 30);
    }
  });
  tileStrip(ctx, nearStrip, -camX * 0.5, groundY - NEAR_H, viewW);

  // Haze where the scenery meets the tilemap, so the seam is not a hard line.
  const haze = ctx.createLinearGradient(0, groundY - 30, 0, groundY);
  haze.addColorStop(0, 'rgba(0,0,0,0)');
  haze.addColorStop(1, theme === 'ice' ? 'rgba(200,225,255,0.35)'
    : theme === 'desert' ? 'rgba(240,190,120,0.3)'
      // Hautausmaan sumu makaa maassa: kylmä ja selvästi paksumpi kuin muualla,
      // koska se on ainoa asia joka erottaa keskiyön taustan mustasta ruudusta.
      : theme === 'bone' ? 'rgba(150,160,190,0.34)' : 'rgba(20,30,20,0.22)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, groundY - 30, viewW, 30);

  weather(ctx, theme, camX, viewW, viewH, tick);
}
