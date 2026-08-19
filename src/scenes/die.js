/**
 * NOPPA: kahdeksan maailmaa oktaedrin tahkoilla, ja se taittuu auki.
 *
 * Omistaja 19.8.2026: *"I wanted new VISUALS and a new GAME MECHANIC in the
 * overworld, you've only given me one. I want a FOLDING & UNFOLDING ANIMATION
 * in there… maybe pseudo-3D, maybe isometric?"*
 *
 * Mekaniikka oli valmis — maailmat ovat kuution kärkiä ja jokaisesta on kolme
 * ovea (`worldDoors`, `data/worlds.js`) — mutta se näkyi valikkona, ja valikko
 * ei ole maailmankartta. Tämä on se kartta: oikea kappale, oikea kierto, ja
 * taitos joka avaa sen litteäksi verkoksi ja sulkee takaisin.
 *
 * ## Miksi oktaedri eikä kuutio, vaikka verkko on kuutio
 *
 * Kahdeksan maailmaa mahtuu kuution **kärkiin** ja oktaedrin **tahkoihin**, ja
 * ne kaksi ovat sama verkko (oktaedrin duaali on kuutio). Tahko on se joista
 * kahdesta jolla voi seistä: sillä on pinta-ala, sille mahtuu nimi ja sen voi
 * kääntää kameraa kohti. Kärki on piste. Sama matematiikka, katsottavampi puoli.
 *
 * Tahkon indeksi **on** sen etumerkkikolmikko: bitti 0 on x:n merkki, bitti 1
 * y:n ja bitti 2 z:n. Kaksi tahkoa on naapureita kun ne eroavat yhdellä
 * merkillä, eli täsmälleen `i^1`, `i^2`, `i^4` — sama rivi jonka peli jo lukee,
 * eikä tässä tiedostossa ole omaa naapuritaulukkoa joka voisi erota siitä.
 *
 * ## Taitos on kärkien lerppaus, ei saranointi
 *
 * Oikea auki taittaminen kiertäisi jokaisen tahkon sen saranasärmän ympäri
 * virityspuun mukaan. Se on kaunis ja se on myös se kohta jossa tällainen
 * demo yleensä hajoaa: puu pitää valita, kulmat laskea, ja väliasennot ovat
 * helposti solmussa. Tässä jokainen kärki **liukuu** kolmiulotteisesta
 * paikastaan siihen mihin se kuuluu litteässä nauhassa, ja nauha on
 * Gray-koodi — peräkkäiset tahkot eroavat yhdellä bitillä, eli naapuruus
 * näkyy nauhassa yhteisenä särmänä.
 *
 * Lopputulos lukee taittumisena koska se *on* taittuminen: kappale aukeaa
 * nauhaksi ja sulkeutuu takaisin. Väliasennot eivät ole fysikaalisesti oikeita
 * eivätkä yritä olla; ne ovat sulava tie kahden oikean asennon välillä.
 */
import { drawText } from '../gfx/font.js';
import { Music, Sfx } from '../core/audio.js';
import { WORLDS, worldDoors, worldTier, pipsFor } from '../data/worlds.js';
import { DIFFICULTY } from '../data/difficulty.js';
import { TIER_COLORS, PIP_OFF } from './worldmap.js';
import { clamp } from '../core/utils.js';
import { STRIP } from '../data/solid.js';
import { qMul, qNorm, qBetween, qSlerp, qApply } from '../core/quat.js';

const VIEW_W = 320;
const VIEW_H = 240;

/** Kappaleen säde ruudulla, ja kuinka kaukana katsoja on. */
const R = 62;
const CAM_Z = 4.2;
const CX = 160;
const CY = 108;

/* Kuinka kauan kukin vaihe kestää framessa. Auki hitaammin kuin kiinni: auki
 * on esittely ja kiinni on päätös, ja päätöksen kuuluu tuntua nopealta. */
/* Kuinka kauan noppa pyörii umpinaisena ennen kuin se aukeaa.
 *
 * Ilman tätä ruutu alkoi taitoksesta, ja taitos ilman esittelyä on kasa
 * kolmioita: katsoja ei ehdi nähdä että kyseessä **on** kappale ennen kuin se
 * lakkaa olemasta sellainen. Puolitoista sekuntia hidasta pyörintää riittää
 * siihen että silmä lukee tilavuuden, ja se on sama temppu jolla jokainen
 * pelin alkuruutu on aina esitellyt palkintonsa. */
const HOLD_FRAMES = 40;
/**
 * A beat at the isometric angle before the fold starts.
 *
 * Without it the settle handed straight over to the opening and the fixed
 * camera existed for exactly zero frames: the die spun, swung towards the
 * angle, and was already coming apart by the time it got there. The whole
 * point of settling is that the eye gets to see the solid *from the angle the
 * rest of the screen is drawn at* — floor, shadow and all — and that takes a
 * moment of stillness, not just an arrival.
 */
const ISO_BEAT = 16;
const OPEN_FRAMES = 46;
const SHUT_FRAMES = 30;
const TURN_FRAMES = 26;

/* Nauhan järjestys on `data/solid.js`:ssä, koska sama Gray-koodi järjestää
 * pallon tahkot: kaksi kopiota olisi kaksi järjestystä jotka voivat erota. */

/** Tahkon kolme kärkeä yksikköinä: x-, y- ja z-akselin päät merkkeineen. */
function faceVerts(i) {
  const sx = i & 1 ? 1 : -1;
  const sy = i & 2 ? 1 : -1;
  const sz = i & 4 ? 1 : -1;
  return [[sx, 0, 0], [0, sy, 0], [0, 0, sz]];
}

/** Tahkon normaali — sama kolmikko, ja siksi kamera osaa katsoa sitä suoraan. */
function faceNormal(i) {
  const k = 1 / Math.sqrt(3);
  return [(i & 1 ? 1 : -1) * k, (i & 2 ? 1 : -1) * k, (i & 4 ? 1 : -1) * k];
}

/** Se kierto joka kääntää tahkon `i` katsojaa kohti. */
const facing = (i) => qBetween(faceNormal(i), [0, 0, 1]);

/**
 * THE ANGLE THE DIE COMES TO REST AT, and the price of going isometric.
 *
 * An isometric picture has a fixed camera — that is what makes it isometric —
 * and the forty frames of slow rotation that teach the eye this is a solid
 * rather than a paper star cannot survive a fixed camera. Both were worth
 * keeping, so the die does both in order: **it spins, it settles into the
 * isometric angle, and only then does it open.** The spin proves the volume,
 * the settle establishes the camera, and every frame after that obeys it.
 *
 * The tilt is applied in *world* space on top of `facing`, so the world you
 * are standing on still turns to meet you — it is simply met from above,
 * which is where the floor is seen from.
 */
/**
 * Tilt *and* yaw, and the yaw is not decoration — it is the difference
 * between a solid and a kite. An octahedron looked at straight down one of
 * its faces shows exactly **one** face: the three that touch it are at 109°
 * and every one of them points away from you. Face-on is therefore the one
 * angle at which this shape cannot prove it has a volume, which is precisely
 * what the spin before it just spent forty frames proving. Turning off-axis
 * in both directions brings three faces into view, and three faces meeting at
 * a vertex is the picture that says "solid" without any shading at all.
 */
const ISO_TILT = 0.60;
const ISO_YAW = 0.58;
const isoRest = (i) => qNorm(qMul(
  [0, Math.sin(ISO_YAW / 2), 0, Math.cos(ISO_YAW / 2)],
  qMul([Math.sin(ISO_TILT / 2), 0, 0, Math.cos(ISO_TILT / 2)], facing(i)),
));

/** Litteän nauhan kolmiot: sama kolmio ylös ja alas vuorotellen. */
/* Nauhan mitat ovat ruudun mitta jaettuna: kahdeksan kolmiota limittäin vie
 * `x0 + 3.5 * W + W`, ja 320 px kehyksessä se tarkoittaa 62 px kolmiota. Isompi
 * näyttäisi paremmalta ja jäisi reunan taakse, mikä ei näyttäisi miltään. */
const STRIP_W = 62;
/* Taller than the 58 it was drawn at flat against the glass, because the net
 * no longer lies against the glass: it lies on the floor, and the floor eats
 * `FLOOR_SQUASH` of every vertical measurement. 74 × 0.62 is 46 on screen,
 * which is the same triangle the eye used to get. */
const STRIP_H = 74;
function stripTri(k) {
  const up = k % 2 === 0;
  const x = 20 + k * (STRIP_W / 2);
  const y = CY - STRIP_H / 2;
  return up
    ? [[x, y + STRIP_H], [x + STRIP_W, y + STRIP_H], [x + STRIP_W / 2, y]]
    : [[x, y], [x + STRIP_W, y], [x + STRIP_W / 2, y + STRIP_H]];
}

/**
 * THE FLOOR — and the whole of what "isometric 2.5D" means here.
 *
 * The net used to unfold flat against the glass: eight triangles in a row,
 * face-on, in the plane of the screen. That is a diagram. This lays the same
 * eight triangles down on a *plane the camera looks across*, which is the one
 * change that turns a diagram back into a place — you can stand on a floor,
 * and a thing on a floor has a shadow and a near end and a far end.
 *
 * Three numbers, and they were chosen by looking rather than by trigonometry,
 * because a true 2:1 isometric ran a 294-pixel strip 147 pixels down the
 * screen and off the bottom of a 240-pixel frame. Depth is therefore
 * compressed rather than honest:
 *
 *   `FLOOR_SQUASH` 0.62 — how much of a step *away* survives as a step *up*
 *     the screen. 0.42 was tried in the prototype and pressed the open map
 *     into an unreadable band.
 *   `FLOOR_SHEAR` 0.35 — how far a step away also slides left. This is the
 *     part that makes it read as a plane rather than as a squashed diagram.
 *   `FLOOR_TILT` 0.11 — the strip's own slope, so the far end of the road is
 *     higher on the screen than the near end.
 *
 * The projection is deliberately affine — no divide, no vanishing point. A
 * perspective floor would fight the solid's own weak perspective, and two
 * different depth rules in one picture read as a bug even when neither is.
 */
const FLOOR_SQUASH = 0.62;
const FLOOR_SHEAR = 0.35;
const FLOOR_TILT = 0.11;
const FLOOR_Y = 138;

function onFloor(px, py) {
  const d = py - CY;
  return [px - d * FLOOR_SHEAR, FLOOR_Y + (px - CX) * FLOOR_TILT + d * FLOOR_SQUASH];
}

/**
 * THREE TONES, NOT A RAMP.
 *
 * The solid used to be shaded by a continuous function of depth, which is
 * what a renderer does. Three quantised steps is what a person with three
 * pens does, and on a chunky grid the difference between those two is the
 * entire difference between "3D graphics" and "drawn". Everything else in
 * this file — the shadow, the floor, the outline — is support for this one
 * decision.
 */
const TONES = [1, 0.66, 0.42];
const toneAt = (depth) => (depth > 0.3 ? 0 : depth > -0.2 ? 1 : 2);

/** Ink: the outline, and the hole the drop shadow punches in the floor. */
const INK = '#12121c';
const FLOOR_BG = '#0c0c14';
const SHADOW = '#000000';
/** The shadow is offset, hard and unblurred — no light source, just a fact. */
const SHADOW_DX = 5;
const SHADOW_DY = 4;

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

/** Kuinka kaukana kaksi tahkoa on toisistaan: montako merkkiä eroaa. */
const hamming = (a, b) => ((a ^ b) & 1) + (((a ^ b) >> 1) & 1) + (((a ^ b) >> 2) & 1);

/** Renkaiden porrastus, ks. `facePoints`. */
const STAGGER = 0.17;

function worldMedian(i) {
  const lv = (WORLDS[i].nodes || [])
    .filter((n) => n.level && DIFFICULTY[n.level] !== undefined)
    .map((n) => DIFFICULTY[n.level])
    .sort((a, b) => a - b);
  return lv.length ? Math.round(lv[Math.floor(lv.length / 2)]) : 0;
}

export class DieScene {
  constructor(game, from, pick) {
    this.game = game;
    this.from = from;
    this.pickFn = pick;
    this.tick = 0;
    this.rot = facing(from);
    this.rotFrom = this.rot;
    this.rotTo = this.rot;
    this.turn = 1;
    /* `fold` 0 = kappale, 1 = litteä nauha. Ruutu avautuu auki taittamalla,
     * koska ensimmäinen asia jonka pelaajan pitää nähdä on **koko kartta**;
     * vasta sen jälkeen se kokoontuu siihen tahkoon jolla seisotaan. */
    this.fold = 0;
    this.foldTo = 1;
    this.phase = 'solid';
    this.doors = worldDoors(from)
      .map((i) => ({ i, med: worldMedian(i), tier: worldTier(i) }))
      .sort((a, b) => a.med - b.med);
    this.choice = 0;
  }

  /**
   * Suora valinta ilman animaatiota.
   *
   * Portti ja kehittäjän warppi tarvitsevat tavan sanoa "tämä ovi" ilman
   * seitsemääkymmentä framea taitosta, ja se on **sama tie ulos** kuin
   * pelaajan valinnalla — ei toinen reitti maailmanvaihtoon, vaan sama
   * `pickFn` yhtä kutsua aiemmin.
   */
  pick(i) {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.pickFn(i);
  }

  enter() {
    Music.play('map');
    Sfx.play('doorin');
  }

  get target() { return this.doors[this.choice].i; }

  update(input) {
    this.tick++;
    if (this.phase === 'solid') {
      /* Hidas kierto y-akselin ympäri: pieni kvaternioni joka framelle, ja
       * `qMul` sen eteen niin että kierto tapahtuu **maailman** akselin ympäri
       * eikä kappaleen, jolloin se näyttää pyörivältä eikä kieppuvalta. */
      const a = 0.012;
      this.rot = qNorm(qMul([0, Math.sin(a), 0, Math.cos(a)], this.rot));
      if (this.tick >= HOLD_FRAMES) {
        /* Spin over, camera not yet fixed. See `isoRest`: the settle is the
         * handover between the two, and it is a slerp rather than a cut
         * because a cut would throw away the volume the spin just proved. */
        this.phase = 'settling';
        this.rotFrom = this.rot;
        this.rotTo = isoRest(this.from);
        this.turn = 0;
      }
      return;
    }
    if (this.phase === 'settling') {
      this.turn = Math.min(1, this.turn + 1 / TURN_FRAMES);
      this.rot = qSlerp(this.rotFrom, this.rotTo, ease(this.turn));
      if (this.turn >= 1 && this.tick >= HOLD_FRAMES + TURN_FRAMES + ISO_BEAT) {
        this.phase = 'opening';
      }
      return;
    }
    const step = this.phase === 'opening' ? 1 / OPEN_FRAMES : 1 / SHUT_FRAMES;
    if (this.fold < this.foldTo) this.fold = Math.min(this.foldTo, this.fold + step);
    else if (this.fold > this.foldTo) this.fold = Math.max(this.foldTo, this.fold - step);

    if (this.phase === 'opening' && this.fold >= 1) this.phase = 'choosing';

    if (this.turn < 1) {
      this.turn = Math.min(1, this.turn + 1 / TURN_FRAMES);
      this.rot = qSlerp(this.rotFrom, this.rotTo, ease(this.turn));
    }

    if (this.phase === 'choosing') {
      if (input.pressed.left || input.pressed.up) {
        input.consume('left'); input.consume('up');
        this.choice = (this.choice + this.doors.length - 1) % this.doors.length;
        Sfx.play('cursor');
      }
      if (input.pressed.right || input.pressed.down) {
        input.consume('right'); input.consume('down');
        this.choice = (this.choice + 1) % this.doors.length;
        Sfx.play('cursor');
      }
      if (this.tick > 20 && (input.pressed.jump || input.pressed.start)) {
        input.consume('jump'); input.consume('start');
        Sfx.play('select');
        /* Valinta sulkee nopan ja kääntää valitun tahkon eteen: sama liike
         * kahdesti, ensin taitos ja sitten kierto, jotta pelaaja näkee mihin
         * hän on menossa ennen kuin kenttä alkaa. */
        this.phase = 'shutting';
        this.foldTo = 0;
        this.rotFrom = this.rot;
        this.rotTo = isoRest(this.target);
        this.turn = 0;
      }
    }

    if (this.phase === 'shutting' && this.fold <= 0 && this.turn >= 1) {
      this.phase = 'done';
      this.pickFn(this.target);
    }
  }

  /**
   * Tahkon kolme kulmaa ruudulla, taitoksen `fold` mukaan.
   *
   * **Porrastettuna etäisyyden mukaan**, ja tämä oli ensimmäisen version
   * ainoa oikea vika: kun kaikki kahdeksan tahkoa lähtivät liikkeelle samalla
   * framella, väliasennot olivat räjähdys eivätkä taitos — kolmiot lensivät
   * ristiin toistensa läpi matkalla nauhapaikkoihin jotka ovat ruudun toisella
   * puolella. Paperimalli ei aukea niin. Se aukeaa **siitä mihin sormi on
   * jäänyt**: ensin naapurit, sitten naapurien naapurit.
   *
   * `STAGGER` on se osuus koko liikkeestä jonka kukin rengas odottaa. Kolme
   * rengasta kertaa 0,17 jättää yli puolet matkasta itse liikkeelle, eli
   * jokainen tahko ehtii liikkua sulavasti eikä nykäisten.
   */
  facePoints(i) {
    const k = STRIP.indexOf(i);
    const flat = stripTri(k).map(([x, y]) => onFloor(x, y));
    const ring = hamming(i, this.from);
    const span = 1 - STAGGER * 3;
    const t = ease(clamp((this.fold - ring * STAGGER) / span, 0, 1));
    const solid = faceVerts(i).map((v) => {
      const r = qApply(this.rot, v);
      /* Heikko perspektiivi: kaukainen kärki kutistuu sen verran että kappale
       * lukee kappaleena eikä paperitähtenä. */
      const s = CAM_Z / (CAM_Z - r[2]);
      return [CX + r[0] * R * s, CY - r[1] * R * s, r[2]];
    });
    /* Kaari eikä jana: keskellä matkaa piste nousee hiukan irti suorasta,
     * jolloin liike lukee kääntymisenä eikä liukumisena. Nousu on suurin
     * puolivälissä ja nolla kummassakin päässä. */
    const lift = Math.sin(t * Math.PI) * 18;
    const pts = solid.map((p, n) => [
      p[0] + (flat[n][0] - p[0]) * t,
      p[1] + (flat[n][1] - p[1]) * t - lift,
    ]);
    const depth = (solid[0][2] + solid[1][2] + solid[2][2]) / 3;
    return { pts, depth, front: depth > -0.02 };
  }

  /**
   * THE FLOOR, drawn as chunky dots rather than as a surface.
   *
   * Nothing here is decoration. Without a floor there is nothing for the drop
   * shadow to fall on, and without the shadow the isometric angle is a claim
   * the picture never backs up — eight triangles over black are a diagram
   * again the moment the ground disappears. The dots also do the job a
   * perspective grid would do, at a fraction of the ink: they are laid out on
   * the same plane by the same `onFloor`, so their rows lean by exactly the
   * amount everything else leans by, and the eye takes the angle from them.
   *
   * Two tones, near and far, quantised like everything else.
   */
  drawFloor(ctx) {
    for (let py = CY - 132; py <= CY + 132; py += 16) {
      const far = py < CY - 20;
      ctx.fillStyle = far ? '#1a1a28' : '#26263a';
      for (let px = -160; px <= 480; px += 20) {
        const [x, y] = onFloor(px, py);
        if (x < -2 || x > VIEW_W || y < 0 || y > VIEW_H) continue;
        ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
    }
  }

  draw(ctx) {
    ctx.fillStyle = FLOOR_BG;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.drawFloor(ctx);

    const flatT = ease(this.fold);
    const faces = [];
    for (let i = 0; i < 8; i++) faces.push({ i, ...this.facePoints(i) });
    /* Maalarin algoritmi, ja järjestysluku vaihtuu taitoksen mukana: pystyssä
     * "takana" on pieni syvyys, lattialla se on ylempänä ruudulla. Kahden
     * säännön sekoitus `flatT`:llä pitää järjestyksen jatkuvana koko taitoksen
     * yli sen sijaan että se napsahtaisi puolivälissä. */
    for (const f of faces) {
      const mid = (f.pts[0][1] + f.pts[1][1] + f.pts[2][1]) / 3;
      f.order = f.depth * (1 - flatT) + ((mid - CY) / 40) * flatT;
    }
    faces.sort((a, b) => a.order - b.order);

    const visible = faces.filter((f) => f.front || flatT >= 0.5);

    /* THE DROP SHADOW, and the trick that makes it work on a black ground:
     * it is not a dark shape drawn *on* the floor, it is a hole punched *in*
     * it. The dots stop where the die is, offset down and to the right, hard
     * edged and unblurred. One pass before any face, so a shadow can never
     * land on top of the thing casting it. */
    ctx.fillStyle = SHADOW;
    for (const f of visible) {
      tri(ctx, f.pts, SHADOW_DX, SHADOW_DY);
      ctx.fill();
    }

    ctx.lineJoin = 'round';
    const nearest = faces[faces.length - 1];
    for (const f of visible) {
      const isHere = f.i === this.from;
      const isTarget = this.phase !== 'opening' && f.i === this.target;
      const door = this.doors.some((d) => d.i === f.i);
      const k = STRIP.indexOf(f.i);
      /* Kolme sävyä, ei ramppia. Pystyssä sävy tulee syvyydestä; lattialla
       * syvyyttä ei ole, joten se tulee kolmion suunnasta — ylös ja alas
       * vuorotellen, jolloin litteä nauha lukee taitettuna peltinä eikä
       * yhtenä maalattuna kaistana.
       *
       * Saavuttamaton maailma on **yhden sävyn syvemmällä** eikä
       * läpikuultava. Läpikuultavuus oli tässä ennen, ja se toi takaisin juuri
       * sen portaattoman liu'un jonka kolmeen sävyyn siirtyminen poisti. */
      let step = flatT > 0.5 ? k % 2 : toneAt(f.depth);
      if (!door && !isHere) step = Math.min(TONES.length - 1, step + 1);
      const lit = isHere || isTarget;
      const base = TIER_COLORS[Math.max(1, pipsFor(worldMedian(f.i)))];

      tri(ctx, f.pts, 0, 0);
      ctx.fillStyle = lit ? shadeHex(base, TONES[0]) : shadeHex(base, TONES[step]);
      ctx.fill();
      /* Paksu reunus on se joka lukee pursotuksena ilman geometriaa:
       * oktaedrin tahkojen oikea pursotus jättää raot särmiin, kolmen
       * pikselin muste ei. */
      ctx.strokeStyle = isTarget ? '#ffffff' : isHere ? '#ffd048' : INK;
      ctx.lineWidth = 3;
      ctx.stroke();

      /* Kappaleena nimen saa **vain lähin tahko**. Ilman tätä takatahkojen
       * nimet vuotivat etutahkon läpi ja noppa luki lasilta. */
      if (flatT > 0.4 || f === nearest) {
        const cx = (f.pts[0][0] + f.pts[1][0] + f.pts[2][0]) / 3;
        /* A centroid is the middle of the *area*, not the middle of the room:
         * two thirds of the way towards the apex, a 62-wide triangle is only
         * 41 wide, and an eight-letter name is 47. So the label steps towards
         * the base — down for the triangles that point up, up for the ones
         * that point down — which is where the width it needs actually is. */
        const towardsBase = flatT > 0.5 ? (STRIP.indexOf(f.i) % 2 ? -6 : 6) : 0;
        const cy = (f.pts[0][1] + f.pts[1][1] + f.pts[2][1]) / 3 + towardsBase;
        const name = WORLDS[f.i].name;
        const short = name.length > 7 ? `${name.slice(0, 6)}.` : name;
        // Dark ink on the two light tones, light ink on the deepest one.
        const ink = lit || step < 2 ? '#101018' : '#d8d8e8';
        ctx.globalAlpha = flatT > 0.4 ? clamp((flatT - 0.4) * 3, 0, 1) : 0.95;
        drawText(ctx, short, cx, cy - 3, { color: ink, align: 'center' });
        const pips = Math.max(1, pipsFor(worldMedian(f.i)));
        for (let n = 0; n < 5; n++) {
          ctx.fillStyle = n < pips ? ink : 'rgba(16,16,24,0.35)';
          ctx.fillRect(Math.round(cx - 10 + n * 4), Math.round(cy + 6), 2, 3);
        }
        ctx.globalAlpha = 1;
      }
    }

    drawText(ctx, 'MAAILMANNOPPA', 160, 12, {
      color: '#ffffff', align: 'center', shadow: '#303048',
    });
    if (this.phase === 'choosing') {
      const d = this.doors[this.choice];
      drawText(ctx, WORLDS[d.i].name, 160, 198, {
        color: TIER_COLORS[Math.max(1, pipsFor(d.med))], align: 'center', shadow: '#101018',
      });
      drawText(ctx, this.game.state.visited && this.game.state.visited[d.i] ? 'KAYTY' : 'UUSI',
        160, 210, { color: '#8890b0', align: 'center' });
      drawText(ctx, 'NUOLET VALITSE   ENTER HYVAKSY', 160, 226, {
        color: '#50506a', align: 'center',
      });
    } else {
      const label = this.phase === 'solid' || this.phase === 'settling' ? 'MAAILMOJA KAHDEKSAN'
        : this.phase === 'opening' ? 'NOPPA AUKEAA' : 'NOPPA SULKEUTUU';
      drawText(ctx, label, 160, 210, { color: '#50506a', align: 'center' });
    }
  }
}

/** One triangle as a path. `dx`/`dy` is how the drop shadow is offset. */
function tri(ctx, pts, dx, dy) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
  ctx.lineTo(pts[1][0] + dx, pts[1][1] + dy);
  ctx.lineTo(pts[2][0] + dx, pts[2][1] + dy);
  ctx.closePath();
}

/** Hex-värin himmennys kertoimella. Pikselitaiteen ainoa valaistus. */
function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}
