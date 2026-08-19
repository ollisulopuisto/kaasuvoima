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
const OPEN_FRAMES = 46;
const SHUT_FRAMES = 30;
const TURN_FRAMES = 26;

/** Nauhan järjestys: Gray-koodi, eli peräkkäisillä on yhteinen särmä. */
const STRIP = [0, 1, 3, 2, 6, 7, 5, 4];

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

/* --------------------------- kvaternionit ----------------------------- */
/* Kierto kvaternioina eikä kulmina, koska kappale käännetään **tahkosta
 * toiseen**: kahden asennon välillä on aina lyhin tie, ja slerp löytää sen
 * ilman että kukaan valitsee akseleita käsin. Eulerin kulmilla sama käännös
 * olisi kolme lukua joista kaksi on väärin juuri navan kohdalla. */
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qNorm = (q) => {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
};
function qBetween(from, to) {
  const d = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];
  if (d > 0.99999) return [0, 0, 0, 1];
  if (d < -0.99999) {
    /* Vastakkaiset normaalit: akseli on mikä tahansa kohtisuora, ja tämä on
     * se tapaus joka unohtuu — kaksi tahkoa ovat vastakkaiset kolmesti. */
    let ax = [1, 0, 0];
    if (Math.abs(from[0]) > 0.9) ax = [0, 1, 0];
    const c = [
      from[1] * ax[2] - from[2] * ax[1],
      from[2] * ax[0] - from[0] * ax[2],
      from[0] * ax[1] - from[1] * ax[0],
    ];
    const n = Math.hypot(...c) || 1;
    return [c[0] / n, c[1] / n, c[2] / n, 0];
  }
  const c = [
    from[1] * to[2] - from[2] * to[1],
    from[2] * to[0] - from[0] * to[2],
    from[0] * to[1] - from[1] * to[0],
  ];
  return qNorm([c[0], c[1], c[2], 1 + d]);
}
function qSlerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let e = b;
  if (d < 0) { e = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
  if (d > 0.9995) {
    return qNorm([a[0] + (e[0] - a[0]) * t, a[1] + (e[1] - a[1]) * t,
      a[2] + (e[2] - a[2]) * t, a[3] + (e[3] - a[3]) * t]);
  }
  const th = Math.acos(clamp(d, -1, 1));
  const s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s;
  const wb = Math.sin(t * th) / s;
  return [a[0] * wa + e[0] * wb, a[1] * wa + e[1] * wb,
    a[2] * wa + e[2] * wb, a[3] * wa + e[3] * wb];
}
function qApply(q, v) {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}

/** Se kierto joka kääntää tahkon `i` katsojaa kohti. */
const facing = (i) => qBetween(faceNormal(i), [0, 0, 1]);

/** Litteän nauhan kolmiot: sama kolmio ylös ja alas vuorotellen. */
/* Nauhan mitat ovat ruudun mitta jaettuna: kahdeksan kolmiota limittäin vie
 * `x0 + 3.5 * W + W`, ja 320 px kehyksessä se tarkoittaa 62 px kolmiota. Isompi
 * näyttäisi paremmalta ja jäisi reunan taakse, mikä ei näyttäisi miltään. */
const STRIP_W = 62;
const STRIP_H = 58;
function stripTri(k) {
  const up = k % 2 === 0;
  const x = 13 + k * (STRIP_W / 2);
  const y = CY - STRIP_H / 2;
  return up
    ? [[x, y + STRIP_H], [x + STRIP_W, y + STRIP_H], [x + STRIP_W / 2, y]]
    : [[x, y], [x + STRIP_W, y], [x + STRIP_W / 2, y + STRIP_H]];
}

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
      if (this.tick >= HOLD_FRAMES) this.phase = 'opening';
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
        this.rotTo = facing(this.target);
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
    const flat = stripTri(k);
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

  draw(ctx) {
    ctx.fillStyle = '#0c0c14';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const faces = [];
    for (let i = 0; i < 8; i++) faces.push({ i, ...this.facePoints(i) });
    /* Maalarin algoritmi: takimmaiset ensin. Litteänä syvyys on nolla ja
     * järjestys on nauhan järjestys, mikä on juuri se mitä halutaan. */
    faces.sort((a, b) => a.depth - b.depth);

    const flatT = ease(this.fold);
    for (const f of faces) {
      const isHere = f.i === this.from;
      const isTarget = this.phase !== 'opening' && f.i === this.target;
      const door = this.doors.some((d) => d.i === f.i);
      /* Takatahkot piirretään vain litteänä: kappaleena ne ovat kappaleen
       * sisällä, ja läpi näkyvä noppa on lasia eikä noppaa. */
      if (!f.front && flatT < 0.5) continue;
      const tier = worldTier(f.i);
      const lit = isHere || isTarget;
      ctx.beginPath();
      ctx.moveTo(f.pts[0][0], f.pts[0][1]);
      ctx.lineTo(f.pts[1][0], f.pts[1][1]);
      ctx.lineTo(f.pts[2][0], f.pts[2][1]);
      ctx.closePath();
      /* Syvyysvarjostus: takana oleva tahko on tummempi. Yksi kerroin, ei
       * valonlähdettä — tämä on pikselitaide eikä renderöijä. */
      const shade = clamp(0.55 + (f.depth + 1) * 0.3, 0.35, 1);
      const base = TIER_COLORS[Math.max(1, pipsFor(worldMedian(f.i)))];
      ctx.globalAlpha = door || isHere ? 1 : 0.55;
      ctx.fillStyle = lit ? base : shadeHex(base, shade * (door ? 0.85 : 0.55));
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isTarget ? '#ffffff' : isHere ? '#ffd048' : '#20202e';
      ctx.lineWidth = lit ? 2 : 1;
      ctx.stroke();

      /* Kappaleena nimen saa **vain lähin tahko**. Ilman tätä takatahkojen
       * nimet vuotivat etutahkon läpi ja noppa luki lasilta. */
      const nearest = faces[faces.length - 1];
      if (flatT > 0.4 || f === nearest) {
        const cx = (f.pts[0][0] + f.pts[1][0] + f.pts[2][0]) / 3;
        const cy = (f.pts[0][1] + f.pts[1][1] + f.pts[2][1]) / 3;
        const name = WORLDS[f.i].name;
        const short = name.length > 8 ? `${name.slice(0, 7)}.` : name;
        ctx.globalAlpha = flatT > 0.4 ? clamp((flatT - 0.4) * 3, 0, 1) : 0.95;
        drawText(ctx, short, cx, cy - 3, {
          color: lit ? '#101018' : '#0c0c14', align: 'center',
        });
        const pips = Math.max(1, pipsFor(worldMedian(f.i)));
        for (let n = 0; n < 5; n++) {
          ctx.fillStyle = n < pips ? '#101018' : 'rgba(16,16,24,0.35)';
          ctx.fillRect(Math.round(cx - 10 + n * 4), Math.round(cy + 6), 2, 3);
        }
        ctx.globalAlpha = 1;
        void tier;
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
      const label = this.phase === 'solid' ? 'MAAILMOJA KAHDEKSAN'
        : this.phase === 'opening' ? 'NOPPA AUKEAA' : 'NOPPA SULKEUTUU';
      drawText(ctx, label, 160, 210, { color: '#50506a', align: 'center' });
    }
  }
}

/** Hex-värin himmennys kertoimella. Pikselitaiteen ainoa valaistus. */
function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}
