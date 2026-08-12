/**
 * A bot that climbs, for the tools that have to prove a vertical level is
 * passable at power level 0.
 *
 * ## Why this is a file and not a branch inside `playable.mjs`
 *
 * `tools/playable.mjs` runs right and jumps, and on a level that is twenty
 * columns wide and forty rows tall that is not a weaker bot, it is a bot
 * playing a different game: it walks into the right-hand wall in about two
 * seconds and reports 100 % reach and no exit. "No level may join the failure
 * list" is a hard rule, so a vertical level needs a proof of passability that
 * is as real as the horizontal one — the same engine, the same physics, the
 * same power level 0, an actual playthrough that ends at the actual flag — and
 * not an exemption.
 *
 * It is its own module because two tools need it and they must not hold two
 * opinions. `verify.mjs` proves the climber against a fixture climb (the game
 * has no vertical level yet, and a proof that waits for content is not a
 * proof), and `playable.mjs` uses the same climber on any level that declares
 * itself vertical. One implementation, so the thing that is proved is the
 * thing that runs.
 *
 * ## What it knows and what it works out
 *
 * The route comes from `climbGraph` in `src/data/rules.js` — deliberately the
 * *validator's* graph, not one of its own. If the bot could climb something
 * the rules call impossible the rules would be a formality; if it could not
 * climb what the rules bless it would fail sound levels and get switched off.
 * Sharing the graph is what makes "the validator says this is climbable" and
 * "the bot climbed it" the same claim checked twice rather than two claims.
 *
 * Everything after the route is closed loop and reads the live body, because
 * an open-loop plan (jump on frame 40, hold for 12) is a recording rather than
 * a bot and it breaks on the first platform that is one tile wider. It steers
 * toward the column it is aiming at, jumps from the ground when it is under
 * it, and **releases the jump the moment its feet clear the target's top** —
 * which is also what keeps the arc small enough for the paging camera to keep
 * its head in the frame. A player who holds every jump to full height throws
 * 37 px of their body out of the top of the window (see `CAM_PAGE_EDGE`), and
 * a bot that did the same would measure the camera rather than the level.
 *
 * No runtime dependency and no build step (DESIGN.md §7): plain ES module,
 * loaded from disk by node and over the same http server by the browser.
 */
import { climbGraph } from '../src/data/rules.js';

const TILE = 16;

/**
 * The cheapest route between two platforms, or null.
 *
 * Cheapest and not shortest, and the difference is the whole reason this is
 * Dijkstra rather than four lines of breadth-first search. Fewest hops picks
 * the route a *validator* would accept, which is not the route a player would
 * take: on the fixture climb the fewest-hops answer starts by jumping four
 * tiles onto the one-tile-wide power block, because that is legal and saves
 * nothing, and the bot then spent 4000 frames failing to land on it. Measured,
 * that run climbed 5 % of the level.
 *
 * So a hop costs what it asks of the player: the rise and the sideways
 * distance both squared, in the same shape the difficulty meter prices a gap,
 * plus a flat charge for a landing narrower than a body is wide. The route it
 * picks is the one somebody would actually climb, which is the only route
 * worth proving is there.
 */
function route(platforms, edges, from, to) {
  const cost = new Map([[from, 0]]);
  const prev = new Map([[from, -1]]);
  const seen = new Set();
  for (;;) {
    let at = -1;
    for (const [i, c] of cost) if (!seen.has(i) && (at < 0 || c < cost.get(at))) at = i;
    if (at < 0 || at === to) break;
    seen.add(at);
    const a = platforms[at];
    for (const n of edges[at]) {
      const b = platforms[n];
      const rise = Math.max(0, a.y - b.y);
      const across = b.x0 > a.x1 ? b.x0 - a.x1 - 1 : a.x0 > b.x1 ? a.x0 - b.x1 - 1 : 0;
      const narrow = b.x1 - b.x0 < 1 ? 4 : 0;
      const c = cost.get(at) + 1 + rise * rise + across * across + narrow;
      if (!cost.has(n) || c < cost.get(n)) { cost.set(n, c); prev.set(n, at); }
    }
  }
  if (!prev.has(to)) return null;
  const out = [];
  for (let at = to; at >= 0; at = prev.get(at)) out.push(at);
  return out.reverse();
}

/**
 * The platform a body at `x` with its feet on `feetY` is standing on.
 *
 * Feet, and a one-pixel tolerance, because that is how the engine decides it
 * too: `onGround` is set by a body whose feet are resting on the row below.
 */
function standingOn(platforms, x, feetY) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(feetY / TILE);
  let best = null;
  for (const p of platforms) {
    if (p.y !== ty || tx < p.x0 - 1 || tx > p.x1 + 1) continue;
    if (!best) best = p;
  }
  return best;
}

/**
 * A climbing bot for one scene.
 *
 * @param {object} scene a live `LevelScene`
 * @param {string[]} rows the level as written (the scene eats its own markers)
 * @param {object} budget parsed `tools/jump-budget.json`
 */
export function makeClimber(scene, rows, budget) {
  const graph = climbGraph(rows, budget);
  const w = rows[0].length;
  const h = rows.length;
  const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w ? ' ' : rows[y][x]);

  let goalX = 0;
  let goalY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y) === 'F') { goalX = x; goalY = y; }
  /* The platform under the flag, found the way a dropped body finds it: the
   * highest standing surface at or below the flag's own column. */
  let goalPlat = null;
  for (const p of graph.platforms) {
    if (p.y < goalY || goalX < p.x0 || goalX > p.x1) continue;
    if (!goalPlat || p.y < goalPlat.y) goalPlat = p;
  }

  let plan = null;
  let planFrom = -1;
  let hold = false;
  /* Pidetäänkö tähtäys sellaisenaan ilmassa. Ks. `keepAim` alempana. */
  let keepAim = false;
  /* Ollaanko juuri nyt hyppäämässä jonkin tappavan yli. Ks. `run` alempana. */
  let hazardJump = false;
  let aimX = goalX * TILE + TILE / 2;
  let aimTop = goalY * TILE;

  return {
    graph,
    goalPlat,
    /** @returns {{left:boolean,right:boolean,jump:boolean,press:boolean}} */
    step() {
      const p = scene.player;
      const feet = p.y + p.h;
      const here = standingOn(graph.platforms, p.cx, feet);

      /* Re-plan whenever the feet come down somewhere the last plan did not.
       * That covers the two things that actually happen: a missed jump that
       * drops the bot a screen, and a landing on a platform the route skipped
       * because it was a shortcut. Replanning from where you are is cheaper
       * and far more robust than trying to get back to where you meant to be. */
      if (p.onGround && here && here.i !== planFrom) {
        planFrom = here.i;
        plan = goalPlat ? route(graph.platforms, graph.edges, here.i, goalPlat.i) : null;
        hold = false;
      }

      if (p.onGround) { keepAim = false; hazardJump = false; }

      const next = plan && plan.length > 1 ? graph.platforms[plan[1]] : goalPlat;
      /*
       * **Ilmassa tähtäystä ei lasketa uudelleen, kun ollaan matkalla alas.**
       *
       * `standingOn` palauttaa nollan heti kun jalat irtoavat, ja ilman tätä
       * ehtoa alaspäin-haara (`next.y > here.y`) lakkasi silloin pätemästä
       * kesken hypyn: sarake putosi takaisin siihen "lähimpään" arvoon, joka on
       * suoraan kehon alla, `dx` meni nollaan ja botti lakkasi ohjaamasta
       * ilmalennon puolivälissä. Mitattuna se oli 6-K:n frame 499 — hyppy
       * piikkien yli lähti oikein ja pysähtyi ilmaan sarakkeeseen 7, ja
       * seuraavalla framella se laskeutui piikkiin sarakkeessa 8.
       */
      if (next && !keepAim && !(p.onGround && here && next.i === here.i)) {
        /* Aim at the end of the target nearest the body: over an overlap you
         * go straight up, off to one side you go to the edge you can reach. */
        const cx = Math.floor(p.cx / TILE);
        let col = Math.max(next.x0, Math.min(next.x1, cx));
        /*
         * ALASPÄIN MENNÄÄN REIÄSTÄ, EI KOHTISUORAAN ALAS.
         *
         * Tämä puuttui, ja sen puuttuminen oli syy siihen että 6-K oli
         * ratkaistavissa putoamalla: botti tähtäsi *lähimpään* sarakkeeseen
         * kohdetasanteella, ja laskeutuvassa kentässä se sarake on melkein aina
         * suoraan jalkojen alla — sen lattian alla jolla botti seisoo. Se käveli
         * sinne, seisoi kiinteän laatan päällä ja jäi siihen.
         *
         * Vanhassa 6-K:ssa se ei haitannut, koska koko kentän läpi meni yksi
         * avoin sarake: botti tarvitsi vain suunnan. Toisin sanoen **botti
         * läpäisi kentän täsmälleen sillä vialla jota se oli tarkoitettu
         * mittaamaan** — ja kun vika korjattiin, se jäi ensimmäiselle lattialle.
         *
         * Kun kohde on alempana, kelvollisia sarakkeita ovat ne jotka ovat
         * kohteen päällä mutta **eivät** sen tasanteen päällä jolla nyt seistään.
         * Ne ovat ne paikat joista oikeasti putoaa. Lähin niistä voittaa, koska
         * lyhin kävely on se jonka pelaajakin ottaisi.
         */
        if (here && next.y > here.y) {
          let bestCol = -1;
          for (let c = next.x0; c <= next.x1; c++) {
            if (c >= here.x0 && c <= here.x1) continue;
            if (bestCol < 0 || Math.abs(c - cx) < Math.abs(bestCol - cx)) bestCol = c;
          }
          if (bestCol >= 0) { col = bestCol; keepAim = true; }
        }
        aimX = col * TILE + TILE / 2;
        aimTop = next.y * TILE;
      } else if (here && goalPlat && here.i === goalPlat.i) {
        aimX = goalX * TILE + TILE / 2;
        aimTop = goalY * TILE;
      }

      const dx = aimX - p.cx;
      /* Six pixels of dead band: narrower and the bot shuffles on the spot
       * instead of committing to a jump, which reads as a stuck level. */
      const left = dx < -6;
      const right = dx > 6;

      const above = aimTop < feet - 2;
      /*
       * YLÖS PÄÄSTÄÄN MYÖS SIVUUN, JA SE PUUTTUI.
       *
       * Ehto oli `|dx| <= TILE`, eli **hyppy lähti vain kun kohde oli suoraan
       * pään päällä.** Se toimi 7-T:ssä täsmälleen siksi että sen lankut menivät
       * päällekkäin sarakkeissa 9–10: oli sarake joka kuului molempiin
       * tasanteisiin, joten jokainen nousu oli pystyhyppy. Se on sama lause kuin
       * "kentän voi läpäistä hyppimällä paikallaan" — eli botti läpäisi kentän
       * sillä vialla jota sen piti mitata, ja kun lankut erotettiin, se käveli
       * reunan yli ja putosi.
       *
       * Nyt hyppy lähtee myös **tasanteen reunalta** kun kohde on ylhäällä ja
       * sivussa: kaari kantaa sivuun, ja `climbGraph` on jo todennut että se
       * kantaa tarpeeksi (`across` mahtuu mitattuun `carry`yn tuolla nousulla).
       * Reunaa mitataan siitä tasanteesta jolla seistään eikä kohteesta, koska
       * ponnistuspaikka on se joka ratkaisee milloin irrotaan.
       */
      const dir = right ? 1 : left ? -1 : 0;
      let atEdge = false;
      if (here && dir !== 0) {
        const edgePx = dir > 0 ? (here.x1 + 1) * TILE : here.x0 * TILE;
        atEdge = Math.abs(p.cx - edgePx) <= TILE;
      }

      /*
       * PIIKIT OVAT MAASTOA, JA TÄMÄ BOTTI EI TUNTENUT NIITÄ LAINKAAN.
       *
       * `playable.mjs` suodattaa viholliset ja vaarat pois ennen ajoa, mutta
       * piikki ja laava ovat **ruudukossa** eivätkä olioita: ne jäävät. Vaakabotti
       * on osannut väistää ne alusta asti (`lethal`, ks. `level-bot.js`); tämä ei,
       * ja niin kauan kuin pystykentissä ei ollut piikkejä kävelylinjalla, sitä ei
       * huomannut kukaan.
       *
       * Kaksi laattaa eteenpäin sillä rivillä jolla jalat ovat, ja hyppy jos
       * siellä on jotain tappavaa. Vaakabotti katsoo viisi, ja **tämä ei saa**:
       * se kulkee kävelyvauhtia, jolloin kaari kantaa mitattuna 3–4 laattaa, ja
       * kolmen laatan varoitus vei ponnistuksen niin aikaisin että laskeutuminen
       * osui täsmälleen piikkiin. Kahdella ponnistus lähtee piikin vierestä ja
       * kaari tuo alas sen taakse. Luku on siis kaaren pituuden funktio eikä
       * varovaisuutta — ja se on syy siihen että pystykentän piikit mitoitetaan
       * *kävelyhypyn* mukaan, samalla perusteella kuin `ice_pit`in kuilut.
       */
      let hazardAhead = false;
      let hazardNear = false;
      if (p.onGround && dir !== 0) {
        const standRow = Math.floor(feet / TILE);
        const cxT = Math.floor(p.cx / TILE);
        for (let d = 1; d <= 5; d++) {
          if (!'^W'.includes(at(cxT + dir * d, standRow - 1))) continue;
          hazardNear = true;
          if (d <= 2) hazardAhead = true;
        }
      }
      /*
       * KUILU EI OLE ILMAINEN, VAIKKA VERKKO SANOO NIIN.
       *
       * `climbGraph` antaa samantasoisten tasanteiden välille kaaren ilman
       * ehtoja `gapTiles`in sisällä, ja se on kiipeilykentässä oikein: siellä
       * "samalla tasolla ja vieressä" tarkoittaa käytännössä samaa lattiaa.
       * Osioidussa kentässä se ei tarkoita — 7-P:n ensimmäisessä osiossa on
       * neljän laatan reikä lattiassa, verkko ylittää sen kaarella eikä botti
       * hypännyt kertaakaan, koska kohde ei ollut *ylhäällä*. Mitattuna: kuoli
       * framella 138 sarakkeessa 14, eli ensimmäiseen reikään.
       *
       * Ponnistus lähtee siis myös reunalta silloin kun kohde on **samalla
       * rivillä mutta eri tasanne**. Alaspäin tätä ei kysytä, ja se on rajaus
       * eikä unohdus: kaivautumiskentässä reunan yli käveleminen on se tapa
       * jolla edetään, ja tämä ehto siellä estäisi jokaisen pudotuksen.
       */
      const gapJump = p.onGround && !!here && !!next
        && next.i !== here.i && next.y === here.y && atEdge;

      /* Jump when there is something above to get to and the body is under it —
       * or at the lip it has to leave from. `press` is the edge the engine
       * reads; `jump` held is what buys height, and it is let go the moment the
       * feet clear the target. */
      const press = p.onGround
        && (hazardAhead || gapJump || (above && (Math.abs(dx) <= TILE || atEdge)));
      /* The release is asked only on the frames after the press, and that is
       * not tidiness. `vy` is not yet negative on the frame the button goes
       * down — the engine applies the jump inside the update that follows — so
       * a release tested on the same frame fires immediately, the hold never
       * happens, and every jump is a tapped one. Measured, that is 32 px of
       * rise against the 71 px a held standing jump gives, which is short of
       * the three-tile rung the climb is built at, and the bot spent the whole
       * run bouncing under the first platform. */
      /*
       * Irrotus vain kun kohde on **ylhäällä**, ja se puuttui.
       *
       * `feet <= aimTop - 2` kysyy "ovatko jalat jo kohteen pinnan yläpuolella",
       * ja se on oikea kysymys nousussa. Laskeutuvalla kohteella `aimTop` on
       * kaukana alhaalla, joten ehto on tosi heti — hyppy irtosi seuraavalla
       * framella ja jokainen piikkien yli otettu ponnistus oli näpäytys. Kun
       * kohde ei ole ylhäällä, ainoa oikea irrotushetki on huippu.
       */
      if (press && (hazardAhead || gapJump)) hazardJump = true;
      if (press) hold = true;
      else if (hold && ((above && feet <= aimTop - 2) || p.vy > 0)) hold = false;
      /*
       * **JUOKSU, JA VAIN PIIKIN YLI.**
       *
       * Tämä botti ei ole koskaan juossut, ja se oli sen kaaren mitta: 1,5
       * px/framea kantaa mitattuna 3–3,5 laattaa, joten yhden laatan piikki
       * kahden laatan päässä kuitattiin *juuri ja juuri* — laskeutuminen osui
       * piikin sarakkeeseen sillä puolikkaalla laatalla jolla keho vielä
       * roikkui sen päällä. Ihminen painaa juoksua eikä edes huomaa kohtaa.
       *
       * **Juoksu alkaa viisi laattaa ennen, hyppy kaksi.** Nämä ovat eri lukuja
       * eivätkä epähuomiossa: `ACC` on 0,0547, joten kävelykatosta 1,5
       * juoksukattoon 2,5 menee noin 18 framea, ja jos juoksu syttyisi vasta
       * ponnistusframella keho olisi ilmassa yhä kävelyvauhtia. Mitattuna se oli
       * tasan tämä vika — ponnistus sarakkeesta 7, laskeutuminen sarakkeeseen 9
       * ja piikki sarakkeessa 9. Viisi laattaa on vaakabotin oma katse, ja se on
       * juuri se matka jolla vauhti ehtii nousta ennen ponnistusta.
       *
       * Juostaan silti vain silloin kun edessä on jotain tappavaa, eikä aina.
       * Syy on tämän tiedoston oma: kiipeilykaaret pidetään pieninä jotta
       * sivuava kamera pitää pään ruudussa (ks. `CAM_PAGE_EDGE`), ja jos botti
       * juoksisi joka hypyn se mittaisi kameraa eikä kenttää. Piikin yli
       * hypättäessä sitä kysymystä ei ole: se hyppy on vaakasuora eikä nouse
       * tasanteelle.
       */
      return { left, right, jump: hold || press, press, run: hazardNear || hazardJump };
    },
  };
}

/**
 * Is this a level the climber should be driving at all?
 *
 * **Osioitu kenttä kuuluu tänne, vaikkei se ole pystykenttä**, ja syy on se
 * mikä tämän tiedoston ensimmäisessä kappaleessa jo lukee: oikealle juokseva
 * botti kävelee nousun juurelle ja raportoi kentän loppuneen sinne. 7-P:n
 * ensimmäinen osio on kaksikymmentä saraketta vaakaa, ja se on juuri se pituus
 * jonka `playable.mjs` ehtii juosta ennen kuin kenttä kääntyy ylöspäin.
 *
 * Kiipeilijä ei tarvitse siihen mitään uutta. Se ajaa `climbGraph`ia, joka
 * lukee koko ruudukkoa eikä osioita: nousut ovat mitattuja hyppyjä ja
 * vaakapätkät ovat samantasoisia kaaria `gapTiles`in sisällä. Osioitu kenttä
 * on siis sille tavallinen kenttä joka sattuu olemaan kahdeksankymmentä
 * saraketta leveä ja neljäkymmentäviisi riviä korkea — ja tämä on yksi rivi
 * juuri siksi, ettei kukaan päättele akselia kentän nimestä.
 */
export const isClimb = (def) => !!def.vertical
  || (Array.isArray(def.segments) && def.segments.length > 0);
