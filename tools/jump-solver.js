/**
 * HYPPYSARJAN RATKAISIJA — se joka todistaa että sarja on hypättävissä, ja
 * mittaa kuinka tarkasti.
 *
 * Selaimeen ladattava moduuli samasta syystä kuin `tools/level-bot.js` ja
 * `tools/climb-bot.js`: **tämä ajaa moottoria, ja moottori on sivulla.** Yksi
 * kopio, koska sekä `tools/gen-jumps.mjs` (joka tekee sarjat) että
 * `tools/verify.mjs` (joka vartioi niitä) kysyvät täsmälleen samaa kysymystä,
 * ja kaksi kopiota olisi kaksi eri mielipidettä siitä mitä "hypättävissä"
 * tarkoittaa.
 *
 *
 * ## Miksi tämä on olemassa
 *
 * Omistajan pyyntö 16.8.2026: *"we need more difficult jumping. So you need to
 * create an algorithm that can create jump sequences that are hard but not
 * impossible to land."*
 *
 * Siinä lauseessa on kaksi vaatimusta ja ne osoittavat vastakkaisiin suuntiin,
 * joten kumpaakaan ei voi jättää arvioitavaksi. **"Ei mahdoton" on
 * olemassaoloväite**: jonkin syötejonon on vietävä läpi. **"Vaikea" on
 * niukkuusväite**: niitä jonoja ei saa olla montaa. Molemmat ovat
 * laskettavissa, koska fysiikka on deterministinen — sama lähtötila ja sama
 * nappi tuottavat saman kaaren joka kerta — joten tämä tiedosto ei arvaa
 * kumpaakaan vaan hakee molemmat.
 *
 * Mittayksikkö on **ikkuna**: montako eri ponnistuskohtaa (pikselin välein)
 * vie tältä tasanteelta seuraavalle. Ikkuna 0 on mahdoton, ikkuna 40 on
 * kävelemistä, ja vaikea hyppy on siinä välissä. Koska luku on mitattu,
 * "vaikea" lakkaa olemasta mielipide ja alkaa olla kalibroitavissa.
 *
 * Pikseleinä eikä frameina, ja se on tarkoituksellista: ponnistuskohta on
 * paikka, ja pelaaja näkee paikan mutta ei framea. Juoksukatolla (`MAX_RUN`
 * 2,5 px/frame) kymmenen pikselin ikkuna on neljä framea, kävelyvauhdilla
 * (1,5) seitsemän. Sama ikkuna on siis eri määrä armoa eri vauhdilla, ja
 * juuri niin se on myös pelattuna.
 *
 *
 * ## Kaksi mallia, ja miksi tässä on molemmat
 *
 * `solveHop` mittaa yhden loikan **annetulla tulovauhdilla**. Se on nopea, ja
 * se on se malli jolla ikkuna on mielekäs luku: ikkuna on ominaisuus jonka
 * *tämä* loikka *tällä* vauhdilla omistaa.
 *
 * `solveSequence` ketjuttaa ne ahneesti ja ajaa lopuksi **koko sarjan
 * yhtenä juoksuna** valituilla suunnitelmilla. Vasta se on todiste: yksi
 * loikka kerrallaan mitattu ketju voisi vaatia joka välissä vauhdin jota
 * edellinen loikka ei jätä, ja silloin jokainen osa olisi mahdollinen ja
 * kokonaisuus ei.
 *
 *
 * ## Mitä tämä ratkaisija osaa ja mitä ei
 *
 * Se osaa: juosta oikealle, valita ponnistuskohdan pikselin tarkkuudella ja
 * pitää hyppyä pohjassa valitun ajan.
 *
 * Se ei osaa: kääntyä takaisin, kyykistyä, pierupomppua, häntää, seinää eikä
 * odottaa. Se on rajoitus ja samalla se mikä tekee tuloksesta luotettavan:
 * **kaikki minkä tämä läpäisee on läpäistävissä pelkällä juoksulla ja
 * hypyllä, voimatasolla 0.** Sama lupaus jonka `level-bot.js` antaa kentistä
 * (DESIGN.md kohta 5), tässä yhden hypyn tarkkuudella.
 */

/** Yksi ruutu pikseleinä. Sama luku kuin `gfx/tiles.js`:n `TILE`. */
const TILE = 16;

/**
 * Kuinka monta framea yhtä loikkaa simuloidaan ennen kuin se on epäonnistunut.
 * Mitattu pisin hyppy koko pelissä on juoksu + pieruhyppy, 285 px ja noin 100
 * framea (PHYSICS.md); 200 on siitä reilusti yli ja silti niin lyhyt että
 * täysi haku pysyy sekunneissa.
 */
const FLIGHT_CAP = 200;

/**
 * Ponnistuskohtien haku: montako pikseliä tasanteen oikeasta reunasta
 * taaksepäin kokeillaan.
 *
 * Yksi pikseli kerrallaan, koska ikkuna *on* tämän haun tulos: kahden pikselin
 * askel puolittaisi jokaisen mitatun ikkunan ja tekisi luvusta hakuparametrin
 * eikä kentän ominaisuuden.
 */
const TAKEOFF_MAX = 56;

/**
 * Hyppynapin pitoajat, ja niitä on neljä eikä jatkumo.
 *
 * `GRAVITY_HELD` on voimassa vain kun nappi on pohjassa ja keho nousee, joten
 * pito pidempään kuin nousu kestää on sama asia kuin pito nousun loppuun.
 * Neljä pituutta kattaa siis koko korkeusvalikoiman: näpäytys (21 px),
 * kaksi väliä ja täysi (71 px paikaltaan, 100 px P-vauhdilla).
 */
const HOLDS = [3, 9, 17, 30];

/**
 * Tulovauhdit joilla loikkaa kokeillaan, px/frame.
 *
 * Nämä ovat pelaajan omat katot (`MAX_WALK` 1,5 ja `MAX_RUN` 2,5) sekä nolla,
 * eli "seison tässä ja lähden". Ne ovat lukuina eivätkä importattuina siksi
 * että tämä on *koe*, ei moottori: koe kysyy "entä jos hän saapuu tällä
 * vauhdilla", ja se kysymys on mielekäs myös silloin kun joku joskus muuttaa
 * kattoja. Ketjutus (`solveSequence`) käyttää mitattua lähtövauhtia eikä
 * näitä, joten todiste ei nojaa näihin lukuihin.
 */
const ENTRY_SPEEDS = [0, 1.5, 2.5];

export function blankInput() {
  return {
    left: false, right: false, up: false, down: false, jump: false, run: false,
    start: false, mute: false, quicksave: false, quickload: false, slot: false, debug: false,
  };
}

export function makeInput() {
  return {
    held: blankInput(),
    pressed: blankInput(),
    released: blankInput(),
    consume(a) { this.pressed[a] = false; },
  };
}

/**
 * Missä kaikkialla on jalansijaa, sarakkeittain: kunkin sarakkeen ylin rivi
 * jolla seisotaan, tai `null` jos sarake on pohjaton.
 *
 * Lauta (`-`) kelpaa jalansijaksi kuten kivikin, koska sille lasketaan
 * ylhäältä — ja hyppysarja on lautoja.
 */
export function footingMap(scene) {
  const cols = [];
  for (let x = 0; x < scene.w; x++) {
    let top = null;
    for (let y = 0; y < scene.h; y++) {
      if (scene.solidAt(x, y) || scene.semiAt(x, y)) { top = y; break; }
    }
    cols.push(top);
  }
  return cols;
}

/**
 * Tasanteet: peräkkäiset sarakkeet joilla on sama jalansijan rivi.
 *
 * Luetaan kentästä eikä oteta parametrina, ja se on ehto: portin ja
 * generaattorin on kysyttävä samaa kysymystä *siltä ruudukolta joka on
 * toimitettu*, eikä siltä reseptiltä josta se joskus tehtiin.
 */
export function landingsOf(scene) {
  const cols = footingMap(scene);
  const out = [];
  let run = null;
  for (let x = 0; x < cols.length; x++) {
    const row = cols[x];
    if (row === null) { run = null; continue; }
    if (run && run.row === row && run.x1 === x - 1) { run.x1 = x; continue; }
    run = { row, x0: x, x1: x };
    out.push(run);
  }
  return out;
}

/** Ne tasanneparit joiden välissä on tyhjää, eli se mikä sarjassa on loikkia. */
export function hopsOf(scene) {
  const pads = landingsOf(scene);
  const hops = [];
  for (let i = 0; i + 1 < pads.length; i++) {
    if (pads[i + 1].x0 === pads[i].x1 + 1) continue;
    hops.push({ from: pads[i], to: pads[i + 1] });
  }
  return hops;
}

/** Pelaaja seisomaan annettuun kohtaan annetulla vauhdilla. */
export function place(scene, px, row, vx) {
  const p = scene.player;
  p.x = px;
  p.y = row * TILE - p.h;
  p.vx = vx;
  p.vy = 0;
  p.onGround = true;
  p.climbing = false;
  p.cancelPound();
  scene.centerCamera();
}

/**
 * Yksi loikka: juokse ponnistuskohtaan, hyppää, ja katso mihin päädyit.
 *
 * @returns {{col:number, row:number, landed:boolean, vx:number, frames:number}}
 */
function flight(scene, fromX, hold, running) {
  const i = makeInput();
  const p = scene.player;

  let guard = 0;
  while (p.x < fromX && guard < 400) {
    i.held = blankInput();
    i.held.right = true;
    i.held.run = running;
    i.pressed = blankInput();
    scene.update(i);
    guard++;
    if (!p.onGround) break;      // tasanne loppui kesken vauhdinoton
  }

  i.held = blankInput();
  i.held.right = true;
  i.held.run = running;
  i.held.jump = true;
  i.pressed = blankInput();
  i.pressed.jump = true;
  scene.update(i);

  let frames = 1;
  while (frames < FLIGHT_CAP) {
    i.held = blankInput();
    i.held.right = true;
    i.held.run = running;
    i.held.jump = frames < hold;
    i.pressed = blankInput();
    scene.update(i);
    frames++;
    const col = Math.floor((p.x + p.w / 2) / TILE);
    const row = Math.floor((p.y + p.h) / TILE);
    if (p.dying || p.y > scene.heightPx) return { col, row, landed: false, vx: p.vx, frames };
    if (p.onGround && frames > 3) return { col, row, landed: true, vx: p.vx, frames };
  }
  return { col: -1, row: -1, landed: false, vx: 0, frames };
}

/**
 * Mittaa yhden loikan ikkunan annetulla tulovauhdilla.
 *
 * ## Miksi ikkuna on yhden pidon ikkuna eikä pitojen summa
 *
 * Neljä pitoaikaa ovat neljä eri hyppyä, eivät neljä armoa samalle hypylle:
 * pelaaja valitsee pidon ennen kuin näkee laskeutuvansa, joten hyppy jonka
 * saa läpi vain vaihtamalla pitoa kesken kaaren ei ole helpompi vaan
 * mahdoton. Ikkuna on siis **parhaan yksittäisen pidon** ikkuna, ja se on
 * tarkoituksella pessimistinen luku.
 *
 * @param {function} mk  palauttaa tuoreen kohtauksen jossa pelaaja on jo
 *                       paikallaan lähtötasanteella
 */
export function solveHop(mk, from, to, entry) {
  const edge = (from.x1 + 1) * TILE;
  let best = { ok: false, window: 0, plan: null, exit: 0, tried: 0 };
  let tried = 0;
  for (const hold of HOLDS) {
    for (const running of [false, true]) {
      let win = 0;
      let first = null;
      let exit = 0;
      for (let back = 0; back <= TAKEOFF_MAX; back++) {
        const fromX = edge - back;
        if (fromX < from.x0 * TILE) break;
        const scene = mk();
        tried++;
        const end = flight(scene, fromX, hold, running);
        const hit = end.landed && end.col >= to.x0 && end.col <= to.x1 && end.row === to.row;
        if (!hit) continue;
        win++;
        if (first === null) {
          first = { takeoff: back, hold, running, entry };
          exit = end.vx;
        }
      }
      if (win > best.window) best = { ok: true, window: win, plan: first, exit, tried };
    }
  }
  best.tried = tried;
  return best;
}

/**
 * Koko sarja: ketjuta loikat, ja aja lopuksi yksi juoksu läpi valituilla
 * suunnitelmilla.
 *
 * Ahne ja ketjuttava: kunkin loikan tulovauhti on edellisen mitattu
 * lähtövauhti, ja ensimmäisen loikan tulovauhdit kokeillaan kaikki
 * (`ENTRY_SPEEDS`). Ahneus on tässä turvallista, koska `replay` alla on se
 * joka lopulta hyväksyy tai hylkää — ahne valinta joka ei ketjuudu näkyy
 * siinä eikä jää huomaamatta.
 *
 * @param {function} mkScene palauttaa tuoreen kohtauksen
 * @returns {{ok:boolean, hops:Array, tried:number, walked:boolean}}
 */
export function solveSequence(mkScene) {
  const probe = mkScene();
  const hops = hopsOf(probe);
  if (!hops.length) return { ok: false, hops: [], tried: 0, walked: false };

  const out = [];
  let tried = 0;
  let entry = null;
  for (let i = 0; i < hops.length; i++) {
    const { from, to } = hops[i];
    const speeds = entry === null ? ENTRY_SPEEDS : [entry];
    let got = { ok: false, window: 0, plan: null, exit: 0 };
    for (const speed of speeds) {
      const mk = () => {
        const scene = mkScene();
        place(scene, from.x0 * TILE, from.row, speed);
        return scene;
      };
      const one = solveHop(mk, from, to, speed);
      tried += one.tried;
      if (one.window > got.window) got = one;
    }
    out.push({
      gap: to.x0 - from.x1 - 1,
      rise: from.row - to.row,
      pad: to.x1 - to.x0 + 1,
      window: got.window,
      ok: got.ok,
      plan: got.plan,
    });
    if (!got.ok) return { ok: false, hops: out, tried, walked: false };
    entry = got.exit;
  }

  return { ok: true, hops: out, tried, walked: replay(mkScene, hops, out) };
}

/**
 * YKSI JUOKSU ALUSTA LOPPUUN, ja tämä on se rivi joka tekee tästä todisteen.
 *
 * Ketjutettu mittaus antaa jokaiselle loikalle vauhdin jonka edellinen
 * *mittauksessa* jätti; tässä ne ajetaan peräkkäin ilman että mitään
 * asetetaan käsin. Ero on juuri se jossa sarja voi hajota: laskeutuminen
 * lyhyelle tasanteelle syö vauhtia eri tavalla kuin siihen kohtaan
 * pysäytetty koe olettaa.
 */
export function replay(mkScene, hops, plans) {
  const scene = mkScene();
  const p = scene.player;
  const i = makeInput();
  const last = hops[hops.length - 1].to;
  let at = 0;
  let held = 0;
  for (let f = 0; f < 3000; f++) {
    const plan = plans[at] && plans[at].plan;
    const edge = (hops[at] ? (hops[at].from.x1 + 1) * TILE : 0);
    const takeoffX = plan ? edge - plan.takeoff : Infinity;
    i.held = blankInput();
    i.held.right = true;
    i.held.run = !!(plan && plan.running);
    i.pressed = blankInput();
    if (held > 0) {
      i.held.jump = true;
      held--;
    } else if (plan && p.onGround && p.x >= takeoffX) {
      i.pressed.jump = true;
      i.held.jump = true;
      held = plan.hold;
      at = Math.min(at + 1, plans.length - 1);
    }
    scene.update(i);
    if (p.dying || p.y > scene.heightPx) return false;
    const col = Math.floor((p.x + p.w / 2) / TILE);
    if (p.onGround && col >= last.x0) return true;
  }
  return false;
}
