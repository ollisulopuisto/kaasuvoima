import { LevelScene } from './level.js';
import { drawText } from '../gfx/font.js';
import { TILE, T, info, isSolid } from '../gfx/tiles.js';
import { makePower } from '../entities/player.js';
import { DEMO_ID, demoLevel } from '../data/demo-level.js';

/**
 * Attract mode: after a while on the title screen the cabinet plays itself.
 *
 * Two rules hold the whole thing together.
 *
 *   1. Any input ends it. That check lives in `Game.step`, ahead of every other
 *      key, so the press that takes the machine back cannot also quicksave,
 *      cycle the effects or pick a menu item on its way out.
 *   2. Nothing the demo does may outlive it. The level is handed a stand-in
 *      game object — the real one as a prototype, with its own state and its
 *      own `finishLevel` — so a robot cannot spend a life, write the save,
 *      reach the score table or leave a mark on anything the player owns. It
 *      is not a promise to be careful; the writes land somewhere else.
 *
 * ## Demo tekee tempun (salaisuuksien löydettävyys, kolmas osa)
 *
 * Kaksi ensimmäistä osaa kertovat *että* salaisuuksia on (kartan laskuri) ja
 * osoittavat yhtä niistä (kolikkojono). Kolmas on tämä: alas painaminen putken
 * päällä on verbi jota peli ei pyydä missään, eikä sitä voi arvata näppäimistä.
 * Demo näyttää sen kerran, molempiin suuntiin — sisään lattian suusta ja ulos
 * katosta roikkuvasta — koska bonushuone josta ei pääse pois on ansa.
 *
 * **Verbi opetetaan, paikkaa ei.** Kenttä jota demo pelaa ei ole pelin
 * kentissä (`src/data/demo-level.js`), joten se putki jonka pelaaja näkee ei
 * ole yhdessäkään kentässä jonka hän pelaa. Se on ainoa tapa näyttää temppu
 * oikeasti — moottori, putki, kaista — ilman että näyttää *minne mennä*.
 *
 * Temppu on **ehdollinen paikkaan eikä kelloon** (`aim()` alla): botti kuolee
 * usein ennen minuutin täyttymistä, ja framelaskuriin sidottu temppu menisi ohi
 * heti kun se viivähtää yhden vihollisen takia. Jos temppu ei onnistu — botti
 * kuolee matkalla, tai putki kieltäytyy — demo jatkaa tavallisena demona eikä
 * keskeytyneenä esityksenä. Sitä varten on `TRICK_PATIENCE`.
 */

const DEMO_LEVEL = DEMO_ID;

/**
 * Kuinka korkealta katosta roikkuva suu vielä niellään, pikseleinä.
 *
 * Sama luku kuin `WARP_UP_REACH` `src/scenes/level.js`:ssä, ja se on **sama
 * kysymys toistettuna eikä uusi sääntö**: jos botti painaisi ylös kauempaa,
 * mitään ei tapahtuisi. Kolme ruutua on se korkeus jossa suurin keho mahtuu ja
 * pienin yltää.
 */
const WARP_REACH = 3 * TILE;

/**
 * Kuinka monta framea suuntaa painetaan ennen kuin suu jätetään rauhaan.
 *
 * Lämpöputki voi kieltäytyä (kiveä nousukohdassa, ei jalansijaa), ja silloin
 * botti seisoisi putken päällä loppuminuutin painamassa alas. Puoli sekuntia
 * on enemmän kuin `tryWarp` tarvitsee — se lukee syötteen joka framella — ja
 * vähemmän kuin katsoja ehtii pitää jumina.
 */
const TRICK_PATIENCE = 30;

/**
 * How long the show runs before it hands back. A minute is what an arcade loop
 * was: long enough to watch someone play, short enough that the title screen —
 * which is where the coin slot is — comes back around while you are still
 * standing there. The bot usually dies well before this.
 */
const DEMO_FRAMES = 60 * 60;

const blank = () => ({
  left: false, right: false, up: false, down: false, jump: false, run: false,
  start: false, mute: false, quicksave: false, quickload: false, slot: false,
  debug: false, export: false, fx: false, touch: false,
});

export class DemoScene {
  constructor(game) {
    this.game = game;
    this.tick = 0;
    this.done = false;
    /** Set by the raw listeners below; only the loop acts on it. */
    this.aborted = false;

    // Everything the level writes — score, coins, lives, the reserve item —
    // goes through `game.state`, so the demo gets its own. The prototype link
    // keeps the rest (input, debug flag) pointing at the real game.
    const stand = Object.create(game);
    stand.state = {
      lives: 4, coins: 0, score: 0, reserve: null,
      // One mushroom's worth of power: a demo is a shop window and the mid-air
      // fart jump is the thing in it, so a powerless bot would spend the whole
      // minute demonstrating walking.
      power: makePower('shroom', 2),
      world: 0, node: null, cleared: {}, worldsOpen: 1, cards: [],
    };
    stand.finishLevel = () => { this.done = true; };

    this.level = new LevelScene(stand, DEMO_LEVEL, demoLevel());
    // Telemetry answers "where do people die". A robot is not people, and its
    // deaths would sit on top of the heatmap the levels are tuned from.
    this.level.recordDeath = () => {};
    this.level.recordClear = () => {};
    this.level.updateProgress = () => {};

    // `setScene` reads the theme before it calls `enter`, so the ambience has
    // to be known by the time the constructor returns.
    this.theme = this.level.theme;

    this.pad = {
      held: blank(),
      pressed: blank(),
      released: blank(),
      consume(action) { this.pressed[action] = false; },
    };
    this.prevJump = false;
    this.hold = 0;

    /* Suut luetaan ruudukosta eikä kirjoiteta tähän: demo ei tiedä mitään
     * *paikoista* vaan tunnistaa suun samasta lipusta jonka `tryWarp` lukee.
     * Kenttä saa siis muuttua ilman että tämä tiedosto tietää siitä. */
    this.mouths = this.findMouths();
    /** Suut jotka on jo käytetty tai luovutettu, avaimena `"tx,ty"`. */
    this.usedMouths = new Set();
    /** Se suu jota parhaillaan tavoitellaan, ja montako framea on painettu. */
    this.aimed = null;
    this.press = 0;
    /** Montako kertaa temppu onnistui — `verify.mjs` lukee tämän. */
    this.tricks = 0;

    /* Mapped keys already end the demo through `Input`, but an attract mode
     * that argues about which keys count is a broken attract mode. Anything at
     * all, including a tap on the canvas, hands the machine back. */
    this.abort = () => { this.aborted = true; };
  }

  enter() {
    addEventListener('keydown', this.abort);
    addEventListener('pointerdown', this.abort);
    this.level.enter();
  }

  /** Gives back everything the demo borrowed. Safe to call twice. */
  dispose() {
    removeEventListener('keydown', this.abort);
    removeEventListener('pointerdown', this.abort);
  }

  /*
   * The demo ignores the controls on purpose: by the time a frame with input in
   * it reaches a scene, `Game.step` has already ended the demo.
   *
   * The two catches are not decoration. `frame()` asks for the next animation
   * frame *after* updating and drawing, so anything thrown out of here stops
   * the loop for good — and a heuristic bot playing unattended is exactly the
   * thing you cannot promise will never throw. A demo may end badly; the
   * machine may not.
   */
  update() {
    this.tick++;
    try {
      this.level.update(this.drive());
      /* Onnistuminen luetaan matkasta eikä siitä että nappia painettiin: sen
       * jälkeen tähtäys nollataan, jottei sama suu jää tavoitteeksi kun keho
       * on jo toisessa kaistassa. */
      if (this.aimed && this.level.player.transit) {
        this.usedMouths.add(`${this.aimed.tx},${this.aimed.ty}`);
        this.aimed = null;
        this.press = 0;
        this.tricks++;
      }
    } catch {
      this.done = true;
    }
    if (this.done || this.tick >= DEMO_FRAMES) this.game.endDemo();
  }

  /**
   * Jokaisen lämpöputken suu ruudukosta, ja kumpaan suuntaan siitä mennään.
   *
   * Suunta on se puoli jolla on ilmaa — sama kysymys kuin `tryWarp`issa ja
   * `plantWarpExits`issa, ja se on kysyttävä samalla tavalla: lattiaan upotettu
   * suu niellään alas painamalla, katosta roikkuva ylös. Vain suun vasen ruutu
   * otetaan talteen, koska suu on aina kaksi ruutua leveä.
   */
  findMouths() {
    const g = this.level.grid;
    const out = [];
    for (let ty = 0; ty < g.length; ty++) {
      for (let tx = 0; tx < g[ty].length; tx++) {
        if (!info(g[ty][tx]).warp) continue;
        if (tx > 0 && info(g[ty][tx - 1]).warp) continue;
        const above = ty > 0 ? g[ty - 1][tx] : ' ';
        out.push({ tx, ty, dir: isSolid(above) ? -1 : 1 });
      }
    }
    return out;
  }

  /**
   * Lähin käyttämätön suu samassa kaistassa, joka ei ole jo takanapäin.
   *
   * Kaista on ehto eikä koriste: kentässä on kolme päällekkäistä huonetta, ja
   * pinnan suu on luolasta katsottuna viisitoista riviä ylempänä samassa
   * sarakkeessa. Ilman kaistaehtoa botti jarruttaisi luolassa sen putken
   * kohdalla jota se juuri käytti.
   */
  aim() {
    const p = this.level.player;
    const bands = this.level.def.bands;
    if (!bands) return null;
    const band = Math.floor(Math.floor((p.y + p.h - 1) / TILE) / bands.rows);
    let best = null;
    for (const m of this.mouths) {
      if (this.usedMouths.has(`${m.tx},${m.ty}`)) continue;
      if (Math.floor(m.ty / bands.rows) !== band) continue;
      const right = (m.tx + 2) * TILE;
      if (right <= p.x) continue;                      // jo ohitettu
      if (!best || m.tx < best.tx) best = m;
    }
    return best;
  }

  draw(ctx) {
    try {
      this.level.draw(ctx);
    } catch {
      this.done = true;
    }
    // Top of the sky, above where the action is: a caption nobody can miss and
    // nothing has to be played around.
    drawText(ctx, 'ESITTELY', 160, 6, { color: '#ffd048', align: 'center', shadow: '#101018' });
    if (Math.floor(this.tick / 40) % 2) {
      drawText(ctx, 'PAINA NÄPPÄINTÄ NIIN PÄÄSET PELAAMAAN', 160, 16, {
        color: '#c0c0d0', align: 'center', shadow: '#101018',
      });
    }
  }

  /**
   * One frame of bot input: run right, jump at walls and gaps with a hold that
   * matches how far it is across, and spend an air jump when falling with
   * nothing underneath. This is the bot from tools/playable.mjs, where the
   * reasoning behind each of these numbers is written down at length.
   *
   * It plays a level with the enemies left in, which that one does not, so it
   * dies to things a player would walk around. That is the deal with attract
   * mode: it has to look like play, not be good at it.
   */
  drive() {
    const scene = this.level;
    const p = scene.player;
    const footY = Math.floor((p.y + p.h) / TILE);
    const aheadX = Math.floor((p.x + p.w + 6) / TILE);
    const solid = (tx, ty) => isSolid(scene.tileAt(tx, ty));
    const lethal = (tx, ty) => {
      const ch = scene.tileAt(tx, ty);
      return ch === T.SPIKE || ch === T.LAVA;
    };
    const wall = solid(aheadX, footY - 1) || solid(aheadX, footY - 2);

    let obstacle = -1;
    for (let d = 0; d <= 5 && obstacle < 0; d++) {
      const tx = aheadX + d;
      if (lethal(tx, footY) || lethal(tx, footY - 1)) obstacle = d;
      else if (!solid(tx, footY) && !solid(tx + 1, footY)) obstacle = d;
    }
    const takeOff = p.onGround && (wall || (obstacle >= 0 && obstacle <= 2));

    if (takeOff) {
      let span = 0;
      if (obstacle >= 0) {
        const start = aheadX + obstacle;
        while (span < 14 && (!solid(start + span, footY)
          || lethal(start + span, footY) || lethal(start + span, footY - 1))) span++;
      }
      this.hold = wall ? 16 : Math.max(5, Math.min(16, 3 + span * 1.1)) | 0;
    }

    const groundBelow = solid(Math.floor(p.cx / TILE), footY + 1)
      || solid(Math.floor(p.cx / TILE), footY + 2);
    const airSave = !p.onGround && p.vy > 1.5 && !groundBelow && p.airJumps < p.airJumpsMax;
    const wantJump = takeOff || airSave || (this.hold > 0 && p.vy < 0);
    if (this.hold > 0) this.hold--;

    const pad = this.pad;
    pad.held = blank();
    pad.held.right = true;
    pad.held.run = true;
    pad.held.jump = wantJump;
    pad.pressed = blank();
    pad.pressed.jump = (takeOff || airSave) && !this.prevJump;
    this.prevJump = wantJump;
    return this.perform(pad);
  }

  /**
   * Onko suu siinä asennossa jossa `tryWarp` sen nielee.
   *
   * Sama kysymys kuin siellä, ja se kysytään tässä siksi että vastaus ratkaisee
   * mitä botin pitää tehdä: lattian suulle **noustaan** (siihen asti tavallinen
   * seinähyppy hoitaa homman), katon suun alle vain kävellään. Ilman tätä
   * botti jarruttaisi putken viereen maassa ja painaisi alas siinä kohtaa
   * missä jalkojen alla on maata — eli tekisi tempun väärässä paikassa ja
   * näyttäisi rikkinäiseltä.
   */
  reaches(m) {
    const p = this.level.player;
    const feet = Math.floor((p.y + p.h) / TILE);
    if (m.dir > 0) return feet === m.ty;
    const head = Math.floor(p.y / TILE);
    return m.ty < head && (p.y + p.h) - (m.ty + 1) * TILE <= WARP_REACH;
  }

  /**
   * Temppu: pysähdy suulle ja paina sitä suuntaa johon suu aukeaa.
   *
   * Tämä on ainoa kohta jossa demo tekee jotain mitä `tools/playable.mjs`:n
   * botti ei tee, ja se on tarkoituksella **päällekirjoitus eikä uusi botti**:
   * juokseminen, hyppääminen ja ilmapelastus tulevat yhä samasta heuristiikasta
   * kuin kenttien läpäisytodistuksissa, joten esittely ei ole eri peli kuin se
   * jota mitataan.
   *
   * Kolme ehtoa, ja jokainen on rajaus:
   *
   *   1. **Kaista ja sarake, ei kello.** Ks. `aim()`.
   *   2. **Asento ratkaisee, ei etäisyys.** Ks. `reaches()`. Tässä oli ensin
   *      mitattu jarrutus (juoksusta 19 px vastaan kääntymällä, 56 px otetta
   *      irrottamalla) — ja se oli vastaus väärään kysymykseen: botti jarrutti
   *      putken *viereen* maahan ja painoi alas siinä, missä jalkojen alla oli
   *      maata. Mitattu: temppu epäonnistui 30 framea putkea vasten
   *      seisottuaan, sarakkeessa 52 kun suu on 53. Kannen päälle noustaan
   *      tavallisella seinähypyllä, ja siihen botti osaa itse.
   *   3. **Luovutus on osa temppua.** Jos suu ei niele `TRICK_PATIENCE`in
   *      sisällä, se merkitään käytetyksi ja demo jatkaa matkaa. Katsoja näkee
   *      silloin tavallisen demon eikä jumittunutta esitystä.
   */
  perform(pad) {
    const p = this.level.player;
    if (p.transit || p.dying) return pad;
    const m = this.aim();
    if (!m) { this.aimed = null; this.press = 0; return pad; }

    const left = m.tx * TILE;
    const right = (m.tx + 2) * TILE;
    const over = p.x + p.w > left && p.x < right;
    if (!over || !p.onGround || !this.reaches(m)) { this.aimed = null; this.press = 0; return pad; }

    // Suulla ollaan: ei juoksua eteenpäin eikä hyppyä pois siitä.
    pad.held.right = false;
    pad.held.run = false;
    pad.held.jump = false;
    pad.pressed.jump = false;
    this.prevJump = false;

    this.aimed = m;
    this.press++;
    if (this.press > TRICK_PATIENCE) {
      this.usedMouths.add(`${m.tx},${m.ty}`);
      this.aimed = null;
      this.press = 0;
      return pad;
    }
    if (m.dir > 0) pad.held.down = true;
    else pad.held.up = true;
    return pad;
  }
}
