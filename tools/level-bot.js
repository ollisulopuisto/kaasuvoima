/**
 * Se botti joka juoksee oikealle ja hyppää — maareitin todiste, yhtenä kopiona.
 *
 * Tämä koodi oli `tools/playable.mjs`:n sisällä siihen asti kun toinenkin
 * työkalu tarvitsi sen: `tools/daily-origin.mjs` pelaa jokaisen päivän kentän
 * läpi voimatasolla 0 ennen kuin päivä pääsee todistukseen. Kaksi kopiota
 * bottia olisi kaksi eri mielipidettä siitä mitä "läpäistävissä" tarkoittaa, ja
 * juuri se on se lupaus jota DESIGN.md kohta 5 pitää — eli se on viimeinen asia
 * jonka saisi olla kahdessa paikassa.
 *
 * Selaimeen ladattava moduuli samasta syystä kuin `tools/climb-bot.js`: botti
 * ajaa moottoria, ja moottori on sivulla.
 *
 * Mitä tämä botti **ei** osaa, sanottuna ääneen koska se on tuloksen tulkinta:
 * se ei osaa kyykistyä, mennä putkeen, potkaista kuorta eikä odottaa liikkuvaa.
 * Sen "EI LÄPI" on siksi syy avata kenttä eikä tuomio siitä.
 *
 * ## Jää, ja mitä tämän botin LÄPI *ei* siitä sano
 *
 * Botti pitää oikeaa ja juoksua pohjassa joka ikinen frame. Se ei irrota otetta
 * eikä paina vastaan kertaakaan, eli **se ei jarruta koskaan** — ja jarrutus on
 * tasan se ja ainoa asia jonka jää muuttaa (`SURFACES`in `grip` koskee
 * `FRICTION_*`:ää ja `SKID`iä, ei `ACC`:tä).
 *
 * Kaksi seurausta, ja ne osoittavat eri suuntiin:
 *
 *   - **Hyvä:** jää ei voi rikkoa tätä todistusta. Kiihdytys on ennallaan, joten
 *     jäälattian päällä botti mittaa framelleen saman kuin kivilattian päällä,
 *     eikä yhdenkään vanhan kentän LÄPI muutu siksi että jokin muualla muuttui.
 *   - **Ja se hinta:** tämän botin LÄPI **ei ole todiste siitä että jäinen
 *     kohta on reilu.** Se on todiste siitä että sen läpi pääsee juoksemalla
 *     pysähtymättä. Kysymys "ehtiikö tuolle laatalle pysähtyä" on mitattu
 *     muualla ja se on mitattu numerona eikä pelaamalla: `ICE_BRAKE`
 *     (`src/data/rules.js`) tulee `tools/measure-braking.mjs`:n jäätaulusta, ja
 *     `checkIce` on se portti joka sitä vaatii.
 *
 * Tämä on kirjoitettu auki siksi että botin puolikas sanasto on kerran jo
 * alkanut määrätä sisältöä (ks. astinkivi alempana). Toista kertaa ei tarvita
 * sitä että joku lukee LÄPI-sarakkeen lupaukseksi jota se ei anna.
 *
 * ## Astinkivi, ja miksi se on nyt tässä eikä puuttuvien listalla
 *
 * Tuolla listalla luki 10.8.2026 asti myös *"ei osaa hypätä kelluvalta lavalta
 * toiselle"*, ja se lause maksoi enemmän kuin miltä näytti. DESIGN.md kohta 5
 * lupaa että maareitti aukeaa pienimmällä koolla, ja sallii kuilulle **kaksi**
 * vaihtoehtoa: se mahtuu mitattuun juoksuhyppybudjettiin *tai siinä on
 * astinkivi*. Botti tunsi vain ensimmäisen. Seuraus ei jäänyt raporttiin: kun
 * botti ei osaa lankkua, lankullinen kuilu näyttää läpäisemättömältä, ja
 * korjaus tehtiin kenttiin — `generator.js`:n `softGap` kaventaa maailmoja
 * joissa on nimetty `maxGap`, ja `corkGate`in lankku poistettiin kokonaan
 * ("a stepping stone the bot cannot use is worse than no stepping stone").
 * Botin puolikas sanasto oli siis alkanut määrätä sisältöä. 4-3 oli viimeinen
 * käsintehty kenttä joka piti kiinni koko lupauksesta, ja se oli siksi ainoa
 * kenttä koko pelissä jonka läpäistävyyttä ei ollut todistettu.
 *
 * Nyt botti osaa etsiä kuilun sisältä ruudun jolle jalka mahtuu, ja tähtää
 * siihen suljetulla silmukalla samaan tapaan kuin `tools/climb-bot.js`:
 * hyppyä pidetään kunnes jalat ovat astinkiven pinnan yllä **ja** runko sen
 * sarakkeen kohdalla. Pelkkä korkeus päästäisi irti liian aikaisin ja kaari
 * toisi alas lankun kylkeen — ja lankku on puolikiinteä (`isSemi`), eli
 * kyljestä mennään läpi.
 *
 * ## Askelma alas ei ole kuilu
 *
 * Ja tämä oli se toinen puoli, se joka teki 4-3:sta läpäisemättömän. Maasto
 * luettiin siltä riviltä jolla botti **seisoo**. Korokkeen päällä se rivi on
 * tyhjä niin pitkälle kuin silmä kantaa, vaikka alla olisi ehjä lattia, joten
 * botti luki askelman alas pohjattomana kuiluna ja hyppäsi täydellä pidolla —
 * 4-3:ssa kahden ruudun pilarilta sarakkeessa 220, viiden ruudun
 * vauhdinottosuoran yli, suoraan siihen kuiluun jonka se olisi pitänyt mitata.
 * `walkY` on nyt se rivi jolla kohta kävellään, ja kaikki maastoa koskevat
 * kysymykset esitetään siltä.
 *
 * Näiden kahden jälkeen **jokainen kentän 60:stä on läpäistävissä voimatasolla
 * 0** — ei vain 4-3 vaan myös 2-1, joka oli ollut kaiken aikaa samalla listalla
 * ("tuplahypyllä läpi mutta ei ilman") ja jonka kuilu sarakkeessa 259 on
 * kymmenen ruutua leveä ja lankullinen, eli täsmälleen sama muoto.
 */
import { JUMP_BUDGET } from '../src/data/pacing.js';
import { info, isSemi, slopeDir } from '../src/gfx/tiles.js';

export const blankInput = () => ({
  left: false, right: false, up: false, down: false, jump: false, run: false,
  start: false, mute: false, quicksave: false, quickload: false, slot: false,
});

export const makeInput = () => ({
  held: blankInput(),
  pressed: blankInput(),
  released: blankInput(),
  consume(a) { this.pressed[a] = false; },
});

/**
 * Ajaa kentän läpi vasemmalta oikealle.
 *
 * @param {object} scene   LevelScene, viholliset ja vaarat jo suodatettuina
 * @param {function} isSolid  `src/gfx/tiles.js`:n oma
 * @param {number} frames  kuinka monta framea saa yrittää
 * @param {function} finished  palauttaa `finishLevel`in tuloksen tai null
 */
/**
 * LANKKUREITTI YLI SELLAISEN TYHJÄN JOTA YKSIKÄÄN HYPPY EI YLITÄ.
 *
 * Palauttaa ne sarakevälit joissa **maata ei ole lainkaan** leveämmällä
 * matkalla kuin mitattu hyppy kantaa (`softGapTiles` 9, eli se mitä juoksuhyppy
 * oikeasti tekee eikä suunnittelubudjetti), ja joiden yllä on lankkuja.
 *
 * ## Miksi tämä on olemassa, ja miksi se on botin ominaisuus eikä kentän
 *
 * Tämä botti todistaa yhden asian: **maareitti on kuljettavissa voimatasolla 0
 * juoksemalla ja hyppäämällä.** Se on koko sen tehtävä, ja tiedoston alussa on
 * lista siitä mitä se ei osaa — kyykistyä, mennä putkeen, potkaista kuorta,
 * odottaa liikkuvaa. Tähän listaan tuli 16.8.2026 yksi lisää ja se on tässä
 * kirjoitettu auki: **se ei osaa lankkusarjaa.**
 *
 * Ei siksi että lankku olisi sille tuntematon — se tähtää astinkiveen aivan
 * oikein (ks. `aim` alempana) — vaan siksi että se pitää hyppyä pohjassa
 * kuusitoista framea joka kerta kun se tähtää. Yksi lankku kuilussa menee
 * siitä hyvin; viisi peräkkäistä kahden ruudun lankkua ei, koska täysi kaari
 * ylittää jokaisen niistä. Se on botin karkeus eikä kentän vika.
 *
 * Ja sellaisille paikoille on **oma, vahvempi todistaja**:
 * `tools/jump-solver.js` hakee jokaiselle loikalle ponnistuskohdan pikselin
 * tarkkuudella, mittaa kuinka monta niistä osuu, ja ajaa sarjan läpi yhtenä
 * juoksuna voimatasolla 0 — ja `verify.mjs` ajaa sen todistuksen joka ajolla.
 * Tämä funktio on siis rajanveto kahden todistajan välillä eikä poikkeus
 * kummankaan säännöstä: *maa on minun, lankkureitti on ratkaisijan.*
 *
 * Raja on tarkoituksella tiukka. Kapeampi kuin `softGapTiles` oleva tyhjä on
 * yhden hypyn matka, ja **sen tämä botti hyppää itse** — myös silloin kun
 * siinä on lankku. Ylitysten määrä palautetaan (`bridged`), jotta kutsuja voi
 * sanoa ääneen montako kohtaa jäi toisen todistettavaksi; nolla on se luku
 * jonka koko muu peli antaa.
 */
export function plankBridges(scene, isSolid) {
  /* Jalansija on pinta jonka **yllä on ilmaa**, eikä vain kiinteä ruutu. Ero on
   * katto: linnakkeen holvissa ylimmät rivit ovat kiveä koko leveydeltä, joten
   * pelkkää kiinteyttä katsova haku lukee jokaisesta sarakkeesta maata eikä
   * löydä yhtään tyhjää — mitattuna se oli tasan se, ja katetun sarjan
   * lankkureitti jäi löytymättä vaikka sen alla ei ole mitään. Sama sääntö ja
   * sama syy kuin `tools/jump-solver.js`:n `footingMap`issa. */
  const stands = [];
  for (let x = 0; x < scene.w; x++) {
    let ground = false;
    let plank = false;
    for (let y = 0; y < scene.h; y++) {
      const ch = scene.tileAt(x, y);
      /* Rinne on maata: sen päällä kävellään, ja sarake jossa on rinne ei ole
       * kuilu. Ilman tätä botti luki `kumpare`en reiäksi ja hyppäsi päin
       * mäkeä kunnes kello loppui (mitattu: 1-1 jäi 28 %:iin sarakkeeseen
       * 103, eli rinteen ensimmäiseen laattaan). */
      const solid = isSolid(ch) || !!slopeDir(ch);
      if (!solid && !isSemi(ch)) continue;
      if (isSolid(scene.tileAt(x, y - 1))) continue;
      if (solid) ground = true;
      else plank = true;
    }
    stands.push({ ground, plank });
  }
  const out = [];
  let run = -1;
  for (let x = 0; x <= scene.w; x++) {
    const bare = x < scene.w && !stands[x].ground;
    if (bare) { if (run < 0) run = x; continue; }
    if (run >= 0) {
      /*
       * Kaksi ehtoa, ja molemmat ovat tiukkoja tarkoituksella.
       *
       * **Leveys yli kahden mitatun hypyn** (`softGapTiles` × 2). Yksi
       * astinkivi kuilussa on tavallista kenttäkalustoa — 4-1:ssä ja 4-3:ssa
       * on juuri sellainen — ja *sen tämä botti hyppää itse*. Ensimmäinen
       * versio tästä rajasta oli yksi hyppy, ja se söi 4-1:n oman lankkukuilun:
       * botti astui sen yli eikä hypännyt, laskeutui väärään paikkaan ja kuoli
       * kaksi ruutua myöhemmin. Portin pitää kaventua tämän muutoksen myötä,
       * ei laveta.
       *
       * **Vähintään kolme lankkua.** Kaksi lankkua on kuilu jossa on
       * astinkivi; kolme tai enemmän on sarja. Ero on juuri se joka erottaa
       * tämän botin osaamattomuuden (peräkkäiset lyhyet laskeutumiset) siitä
       * mitä se osaa hyvin (yksi tähdätty hyppy kiveä kohti).
       */
      const wide = x - run > JUMP_BUDGET.softGapTiles * 2;
      let planks = 0;
      for (let i = run; i < x; i++) if (stands[i].plank) planks++;
      if (wide && planks >= 3) out.push([run, x - 1]);
      run = -1;
    }
  }
  return out;
}

export function runGround(scene, isSolid, frames, finished) {
  const input = makeInput();
  /* Lankkureitit luetaan kerran ja sarakkeittain, ks. `plankBridges`. */
  const bridges = plankBridges(scene, isSolid);
  let bridged = 0;
  let prevJump = false;
  let hold = 0;
  /** Astinkivi jota kohti ollaan hyppäämässä, tai null. */
  let aim = null;
  let maxX = scene.player.x;
  let stuckAt = null;
  let stuckFor = 0;
  let onGroundFor = 0;
  let death = null;

  for (let f = 0; f < frames && !finished(); f++) {
    const p = scene.player;
    /*
     * Lankkureitin yli, ja se on askel eikä hyppy: keho siirretään sen
     * jälkimmäiselle rannalle sille riville jolla siellä seistään, ja frame
     * jatkuu sieltä.
     *
     * **Ennen kaikkea muuta tässä silmukassa**, ja jalat maassa. Ensimmäinen
     * versio kysyi tätä vasta `aheadX`in laskemisen jälkeen ja vain silloin kun
     * kurkistus osui ylityksen ensimmäiseen sarakkeeseen — ja se ei laukennut
     * kertaakaan, koska botti on siinä vaiheessa jo ilmassa: `takeOff` irrottaa
     * kaksi saraketta ennen reunaa. Kysytään siis neljän sarakkeen päähän ja
     * vain maasta.
     */
    if (p.onGround && bridges.length) {
      const here = Math.floor((p.x + p.w / 2) / 16);
      const cross = bridges.find(([x0]) => here < x0 && x0 - here <= 4);
      if (cross) {
        const land = cross[1] + 1;
        let row = -1;
        for (let ty = 1; ty < scene.h; ty++) {
          if (!isSolid(scene.tileAt(land, ty)) || isSolid(scene.tileAt(land, ty - 1))) continue;
          row = ty;
          break;
        }
        if (row > 0) {
          p.x = land * 16;
          p.y = row * 16 - p.h;
          /* Vauhti säilyy, ja se on osa väitettä: pelaaja joka on juuri
           * hypännyt sarjan läpi saapuu rannalle juosten eikä seisten.
           * Nollattuna botti aloitti vauhdinoton alusta viiden sarakkeen
           * hännällä ja putosi seuraavaan kuiluun — se olisi ollut mittaus
           * tämän siirron omasta hinnasta eikä kentästä. */
          p.vy = 0;
          bridged++;
          if (p.x > maxX) maxX = p.x;
          scene.centerCamera();
          continue;
        }
      }
    }
    const footY = Math.floor((p.y + p.h) / 16);
    const aheadX = Math.floor((p.x + p.w + 6) / 16);
    const solid = (tx, ty) => isSolid(scene.tileAt(tx, ty));
    /* Maa jonka päällä voi seistä: kiinteä laatta **tai rinne**. Erillään
     * `solid`ista, koska seinäksi rinne ei kelpaa — sitä pitkin kävellään
     * ylös eikä siihen törmätä. */
    const walkable = (tx, ty) => solid(tx, ty) || !!slopeDir(scene.tileAt(tx, ty));
    const lethal = (tx, ty) => '^W'.includes(scene.tileAt(tx, ty));
    /* Jalansija on kiinteä ruutu **tai lankku**. Lankku on puolikiinteä: sen
     * päälle laskeudutaan ja alta mennään läpi, eli se on jalansija täsmälleen
     * siinä suunnassa jossa botti sitä tarvitsee. */
    const stand = (tx, ty) => {
      const ch = scene.tileAt(tx, ty);
      return isSolid(ch) || isSemi(ch) || !!slopeDir(ch);
    };
    /**
     * Mille riville jalka laskeutuisi sarakkeessa `tx`, jos siitä käveltäisiin
     * suoraan eteenpäin — tai null jos sarake ei ole askelma vaan kuilu.
     *
     * Kaksi rajaa, ja molemmat ovat mitattuja eivätkä makuasioita:
     *
     *   - **Alaspäin katsotaan `wallTiles` riviä**, eli täsmälleen niin
     *       syvälle kuin mitattu hyppy nostaa takaisin. Syvempi pudotus ei ole
     *       askelma vaan päätös, eikä sitä kuljeta huomaamatta. Sama raja
     *       pitää kolmikaistaiset kentät (1-2, 2-2, 3-2, 4-2) erossa toisistaan:
     *       kaista on 15 riviä, joten alempi kaista ei näy tästä.
     *   - **Askelman läpi on astuttava ilmaa.** Laavaoja jonka rivi 14 on `W`
     *       on kuilu eikä askelma, ja juoksuhiekan alla oleva lattia ei ole
     *       lattia lainkaan: hiekka ei ole kiinteä eikä tappava vaan omassa
     *       joukossaan (`SINK`, ks. `rules.js`), joten pelkkää kiinteyttä
     *       katsova haku putoaa sen läpi ja lukee upottavan kuopan askelmaksi.
     *       Mitattuna se oli 2-3:n sarake 263: kaksi ruutua hiekkaa kahden
     *       kivilohkon välissä, alla ehjä lattia, ja botti käveli sisään.
     */
    const stepDown = (tx) => {
      for (let ty = footY; ty <= footY + JUMP_BUDGET.wallTiles; ty++) {
        const t = info(scene.tileAt(tx, ty));
        if (t.hazard || t.quicksand) return null;
        if (t.solid || t.semi || t.slope) return ty;
      }
      return null;
    };
    /* Maasto luetaan tältä riviltä; `wall` ei, koska seinä on este *omalla*
     * korkeudella eikä sen lattian korkeudella jolle ollaan astumassa.
     *
     * Kolme saraketta eikä yksi, ja syy on mitattu: 2-1:ssä korokkeen reuna on
     * niin lähellä että pelkkä yhden ruudun kurkistus osuu vielä korokkeeseen
     * itseensä, jolloin rivi ei vaihdu ja botti irtoaa korokkeelta täydellä
     * pidolla — sama vika ja sama kuolema kuin 4-3:ssa, sarakkeessa 264.
     * Syvin löytyvä lattia kolmen sarakkeen sisällä on se jolla kohta
     * kävellään. */
    let walkY = footY;
    for (let d = 0; d <= 2; d++) {
      const row = stepDown(aheadX + d);
      if (row !== null && row > walkY) walkY = row;
    }
    const wall = solid(aheadX, footY - 1) || solid(aheadX, footY - 2);
    onGroundFor = p.onGround ? onGroundFor + 1 : 0;
    if (p.onGround) aim = null;

    /* Look several tiles ahead rather than at the next one.
     *
     * The first version of this bot jumped when an obstacle was six pixels
     * away, and then "failed" every level with a four-tile spike bed in it —
     * a jump any player makes without thinking. That was the bot being
     * useless, not the levels being broken, and a test that cries wolf about
     * good levels is worse than no test. */
    let obstacle = -1;
    for (let d = 0; d <= 5 && obstacle < 0; d++) {
      const tx = aheadX + d;
      if (lethal(tx, walkY) || lethal(tx, walkY - 1)) obstacle = d;
      else if (!walkable(tx, walkY) && !walkable(tx + 1, walkY)) obstacle = d;
    }
    /* Two tiles of run-up is where a running jump clears the most.
     *
     * Laskeutumisframeella ei irrota, ja se on saman lauseen toinen puoli.
     * Botti otti hypyn siltä frameelta jolla se osui maahan, sillä vauhdilla
     * jonka edellinen kaari sattui jättämään — eli ilman sitä vauhdinottoa
     * jonka tämä rivi sanoo tarvittavan. Mitattuna se oli 8-2:n sarake 117:
     * kahden ruudun piikkipari, kaksi ja puoli ruutua vauhtia, ja hyppy joka
     * jäi ruudun vajaaksi. Kaksi framea maata ennen irtoamista maksaa
     * kuilussa nolla, koska `obstacle === 0` on yhä irtoamisen viimeinen
     * hetki eikä sitä hetkeä siirretä. */
    const takeOff = p.onGround
      && (wall || (obstacle >= 0 && obstacle <= 2 && (obstacle === 0 || onGroundFor >= 2)));

    /* How far is it across? A player looks at the gap and jumps roughly that
     * hard. The bot used to hold jump for the full 16 frames every single
     * time, which sails 19 tiles over a 9-tile pit and lands in whatever is
     * on the far side — in 4-2, a lava trench. That looked exactly like a
     * broken level and was not one. */
    if (takeOff) {
      let span = 0;
      if (obstacle >= 0) {
        const start = aheadX + obstacle;
        let deadly = false;
        while (span < 14 && (!solid(start + span, walkY)
          || lethal(start + span, walkY) || lethal(start + span, walkY - 1))) {
          if (lethal(start + span, walkY) || lethal(start + span, walkY - 1)) deadly = true;
          span++;
        }
        /* Tappava este maksaa yhden ruudun enemmän kuin saman levyinen kuoppa,
         * ja perustelu on jo kirjoitettu auki `generator.js`:ään: kuopan
         * takareuna on kieleke jolle voi raapia itsensä hyppy jo käytettynä,
         * piikkipedin takareuna on lattiaa jonka **yli** on laskeuduttava.
         * Sama luku ja sama syy — se oli vain kenttien mitoituksessa eikä
         * siinä botissa joka niitä koettelee. */
        if (deadly) span++;
        /* Onko kuilussa astinkivi?
         *
         * Kysytään vasta kun kuilu on **mitattua kantamaa** leveämpi, ja se
         * kynnys on `softGapTiles` eikä `gapTiles`. Ero on se mitä kumpikin
         * luku tarkoittaa: `gapTiles` (6) on suunnittelubudjetti marginaaleineen,
         * `softGapTiles` (9) on se mitä juoksuhyppy oikeasti kantaa. Botti ei
         * suunnittele kenttää vaan yrittää päästä yli, joten sen kysymys on
         * jälkimmäinen — ja mitattuna se on myös ainoa joka toimii: `gapTiles`
         * -kynnyksellä botti alkoi tähdätä lankkuihin joiden **yli** se olisi
         * hypännyt, ja 4-3:n oma yhdeksän ruudun kuilu sarakkeessa 115 muuttui
         * suorasta hypystä laskeutumiseksi lankulle ja kuolemaksi seuraavaan
         * laavaojaan sarakkeessa 135.
         *
         * Lähin sarake ensin ja siinä alin yletettävä ruutu, koska helpoin
         * hyppy on se jonka pelaajakin ottaisi. Nousun yläraja on mitattu eikä
         * arvattu: `wallTiles` on sama luku jolla kenttäsäännöt päättävät
         * kuinka korkealle hyppy nostaa. Katon pitää olla auki, tai tähdätään
         * seinään. */
        for (let i = 0; span > JUMP_BUDGET.softGapTiles && i < span && !aim; i++) {
          for (let ty = walkY - 1; ty >= footY - JUMP_BUDGET.wallTiles && !aim; ty--) {
            if (stand(start + i, ty) && !stand(start + i, ty - 1)) aim = { tx: start + i, ty };
          }
        }
      }
      hold = wall || aim ? 16 : Math.max(5, Math.min(16, 3 + span * 1.1)) | 0;
    }
    // Spend an air jump when falling with nothing solid below: that is what
    // the mushroom is for, and a bot that never uses it measures the wrong
    // thing.
    const groundBelow = walkable(Math.floor(p.cx / 16), footY + 1)
      || walkable(Math.floor(p.cx / 16), footY + 2);
    const airSave = !p.onGround && p.vy > 1.5 && !groundBelow
      && p.airJumps < p.airJumpsMax;
    /* Suljettu silmukka astinkiveä kohti: pidetään kunnes jalat ovat sen
     * pinnan yllä JA runko sen sarakkeen kohdalla. Kumpikin ehto yksin
     * riittäisi päästämään irti liian aikaisin — pelkkä korkeus tuo alas
     * lankun kylkeen, pelkkä sarake alittaa sen. */
    const reaching = !!aim && !p.onGround
      && (p.y + p.h > aim.ty * 16 || p.cx < aim.tx * 16);
    const wantJump = takeOff || airSave
      || (hold > 0 && p.vy < 0 && (!aim || reaching));
    if (hold > 0) hold--;

    input.held = blankInput();
    input.held.right = true;
    input.held.run = true;
    input.held.jump = wantJump;
    input.pressed = blankInput();
    input.pressed.jump = (takeOff || airSave) && !prevJump;
    prevJump = wantJump;
    scene.update(input);

    if (p.x > maxX + 4) {
      maxX = p.x;
      stuckFor = 0;
    } else if (++stuckFor === 240 && stuckAt === null) {
      // Where it first stopped getting anywhere is the useful coordinate;
      // where it eventually died usually is not.
      stuckAt = Math.floor(maxX / 16);
    }
    if (scene.state === 'dead' && !finished()) {
      death = {
        tx: Math.floor(p.cx / 16),
        ty: Math.floor(p.cy / 16),
        // A death below the floor is a gap it could not clear; anything else
        // is terrain it ran into.
        how: p.y > scene.heightPx - 24 ? 'kuilu' : 'maasto',
      };
      break;
    }
  }

  const done = finished();
  return {
    cleared: !!(done && done.cleared),
    reach: Math.round((maxX / (scene.w * 16)) * 100),
    width: scene.w,
    stuckAt,
    death,
    died: scene.state === 'dead',
    /* Montako lankkureittiä jäi toisen todistettavaksi. Nolla on se luku jonka
     * koko muu peli antaa, ja siksi se kannattaa tulostaa aina. */
    bridged,
  };
}
