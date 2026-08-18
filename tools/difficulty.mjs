/**
 * Vaikeuskäyrän mittari.
 *
 *   node tools/difficulty.mjs           koko peli
 *   node tools/difficulty.mjs --raw     mitatut suureet ilman painotusta
 *   node tools/difficulty.mjs --json    koneluettava muoto
 *
 * This is a HEURISTIC, and the number it prints is not a fun rating. It reads
 * the level grid and counts things that demonstrably cost players lives in a
 * platformer — gaps against the measured jump budget, enemies by type, lethal
 * tiles, how much of the route hangs over nothing, how long you go without a
 * power block, how much of the footing is narrow. It cannot read pacing, it
 * cannot read whether a jump *feels* fair, and it has never played the game.
 *
 * What it is good for is comparing a level to another level of the same game,
 * which is exactly the question "does world 3 ramp from world 2".
 *
 * Everything is measured off the ROUTE BAND — the 15 rows the player starts in.
 * The sky and cave bands of a tall level are optional bonus rooms; counting
 * their contents as difficulty would say a level got harder because it hid a
 * reward in it.
 *
 * ...unless the level is a CLIMB (`vertical: true`), which is measured per 100
 * rows instead of per 100 columns and has four of its six metrics re-aimed.
 * See `measureClimb`. No level in the game is one today, so nothing any level
 * scores has moved: the whole report, `--raw` and `--json` included, is byte
 * for byte what it was before that branch existed.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getLevel } from '../src/data/levels.js';
import { segmentSlices } from '../src/data/rules.js';
import {
  WORLDS, tiersOf, tierScore, branchesOf, worldProblems, pipsFor, PIPS, REWARDS,
} from '../src/data/worlds.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const RAW = args.includes('--raw');
const JSON_OUT = args.includes('--json');
const WRITE = args.includes('--write');
const IS_MAIN = !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

const budget = JSON.parse(await readFile(join(ROOT, 'tools/jump-budget.json'), 'utf8'));

/*
 * Kaistan korkeus ja lattian rivi, kootussa kentässä. Kasvoivat yhdellä
 * 18.8.2026 (`src/data/chunks.js`, `SKY_PAD`). Erillään `SCREEN_ROWS`ista alla,
 * ja juuri se ero on koko muutoksen tarkoitus: kaista on 16, ruutu on 15.
 */
const ROWS = 16;
const FLOOR = 14;
/**
 * How tall a screen is, in tiles: `VIEW_H` 240 / `TILE` 16. Only the climb
 * measurement uses it, and it uses it as the line between "a fall you can see
 * the bottom of" and "a fall that takes the level off the picture".
 *
 * **Se oli 13, ja se oli väärin 17.8.2026 alkaen.** HUD-nauha purettiin sinä
 * päivänä ja `VIEW_H` kasvoi 208:sta 240:een, mutta tämä luku ei liikkunut
 * mukana — eli jokainen sen jälkeen mitattu kiipeilykenttä (6-K, 7-T, 7-P) on
 * mitattu ruudulla joka on kaksi laattaa liian matala: putoaminen luettiin
 * "kuvan ulkopuolelle vieväksi" kaksi laattaa aikaisemmin kuin se oikeasti
 * vie. Luku on tässä kirjoitettuna eikä johdettuna, koska `VIEW_H` asuu
 * selaimen puolella (`src/scenes/level.js`) eikä tämä tiedosto voi tuoda sitä
 * — ja juuri siksi `tools/verify.mjs` vertaa nämä kaksi keskenään portissa.
 * Sama järjestely kuin leveydellä, joka on ollut portissa jo pitkään.
 */
const SCREEN_ROWS = 15;
/**
 * The rise one jump carries **from a standstill**, in tiles, derived from the
 * same measured case and the same 0.8 safety factor `wallTiles` is derived
 * with (see `tools/measure-jump.mjs`). Derived rather than written down,
 * because the day somebody re-measures physics this has to move with it —
 * "mitattu, ei muistettu" applies to the numbers a tool computes as much as to
 * the ones it reads.
 */
const STAND_TILES = Math.max(1, Math.floor(
  ((budget.cases.find((c) => c.label === 'standing, held') || { height: 0 }).height * 0.8) / 16,
));

/*
 * Enemy cost, in "walkers". The walker is 1.0 because it is the thing every
 * other enemy is a variation on: it walks at you, one stomp removes it.
 *
 * The ordering is behavioural, not cosmetic:
 *   - anything that cannot be stomped costs more, because the default answer
 *     does not work and the player has to have a second one ready
 *   - anything that moves in the air costs more, because you cannot outrun it
 *     along the ground, which is what the ground route is
 *   - anything that survives being hit costs more, because clearing it is two
 *     actions under pressure instead of one
 */
export const ENEMY_COST = {
  g: 1.0,   // walker: the unit
  /*
   * HÖSSÖTIN: 0,8 eli **alle kävelijän**, ja se on väite eikä alennus.
   *
   * Sen kosketus ei satuta — se vie ohjauksen sadaksi frameksi — joten
   * hinnaksi ei kelpaa sama luku kuin sellaiselta joka vie elämän. Mutta
   * nollaa se ei ole: hätä kestää yli sekunnin ja sen aikana kuilu on yhä
   * kuilu ja piikki yhä piikki, eli laji siirtää vaaran *muualle* kentässä.
   * Kahdeksan kymmenesosaa kävelijästä on arvio siitä, ja se on kirjattu tähän
   * arviona eikä mittauksena — jos hössötin joskus osoittautuu tappavammaksi
   * kuin kävelijä sen ympäristön kautta, tämä luku on se paikka jossa se
   * korjataan.
   */
  h: 0.8,
  k: 1.3,   // shell: stomping it leaves a shell that comes back at you
  f: 1.6,   // flyer: hops, and a stomp turns it into a walker — two hits
  p: 1.1,   // pipe plant: telegraphed and stationary, but not stompable
  r: 1.5,   // stink cloud: bobs at head height and drifts toward you
  c: 1.2,   // cork guy: hops unpredictably, but corking is a nuisance not damage
  x: 1.4,   /* spiky walker: it walks at you like the unit does, but the default
             * answer does not work on it — and unlike the plant, which is the
             * other unstompable thing at 1.1, it does not stay where you left
             * it. Slower than a walker (0.4) on purpose, so it is priced below
             * the flyer: it will never catch you from behind, it just refuses
             * to be removed the usual way. It was missing from this table
             * entirely, which meant every one of them scored zero. */
  H: 1.5,   /* heartburn jet: cannot be killed, but it is bolted to one column
             * and fires on a fixed period. Timing a metronome is the cheapest
             * skill on this list — the plant next door is the same deal and
             * costs 1.1; the jet costs more only because it erupts out of open
             * floor instead of a pipe you can see from a screen away. */
  w: 1.2,   /* kuura: kävelee kuin kävelijä ja kuolee kuin kävelijä (1,0), mutta
             * jättää jälkeensä liukkaan lattian. Hinta on siis yksikön hinta
             * plus se että sen ohittaminen ei riitä — maa jolla se kävelee on
             * toisenlaista vielä kuuden sekunnin ajan. Alle piikkikävelijän
             * (1,4), koska tallaus tepsii ja koska jää ei satuta. */
  s: 1.1,   /* kolikkovaras: vaarana se on kävelijä, ja siksi lähellä yhtä. Se
             * mitä se vie ei ole terveyttä vaan kolikoita, ja tallattuna se
             * antaa ne takaisin — vaikeusmittari mittaa vaaraa eikä kiirettä,
             * eikä tämä saa lukea vaarallisemmaksi kuin se on. */
  e: 1.8,   /* pyörre: unkillable by stomp and it is *in the way* — but it is a
             * clock, not a chase. Priced above the heartburn jet (1.5), which
             * is the other bolted-down unkillable thing, because a metronome
             * you jump over is easier than a circle you have to be inside at
             * the right moment; priced below the paarma (2.2), which aims. */
  q: 1.9,   /* kummitus: cannot be killed at all and it never stops coming, which
             * is the angry sun's price (3.0) — except it is slower than a walk,
             * so the answer is always "go on". That is the same deal a stink
             * cloud offers at 1.5 with one difference: this one follows you
             * across the whole level. Between the two, nearer the cloud. */
  A: 3.0,   // angry sun: unkillable by stomp and follows you for the rest of the level
  P: 3.0,   /* bean baron: survives being hit, so clearing it is two actions under
             * pressure — above the flyer's 1.6 — and it throws something that
             * cannot be removed at all, above the plant and the cloud. But it is
             * bolted to its plinth and can be left behind, so it is not the
             * boss's 5.0. Level with the sun, which trades "no stomp answer and
             * it follows you" against "two hits and a crossfire, but it stays
             * put". Added with the enemy rather than after it, because a
             * mini-boss worth zero is the exact bug the spiky walker had. */
  U: 2.1,   /* kurnuttaja: the pit leaper. Priced above the two other unstompable
             * ones — the plant at 1.1 and the heartburn jet at 1.5 — and below
             * the flyer-plus-shell tier, and the reason is *where* it is rather
             * than what it does. The plant and the jet stand on floor you can
             * back away along; this one owns the air over a hole, which is the
             * one place the player has already spent their options. Mistiming
             * the plant costs a power level, mistiming this one costs the jump
             * and therefore the life. Against that, its cycle is a metronome
             * with a 84-frame telegraph and it never leaves its column, which
             * is why it is not priced with the sun. Added with the enemy and
             * not after it: the spiky walker shipped at 0 and every level it
             * was in measured easier than it played — see the gate in
             * verify.mjs that now refuses a marker with no price. */
  /*
   * NELJÄ UUTTA (16.8.2026), ja niiden hinnat on johdettu yhdestä kysymyksestä:
   * **poistuuko uhka kun otukseen on koskettu.**
   *
   * Se on tämän taulun oma jakolinja jo ennen näitä neljää — kävelijä 1,0
   * poistuu tallauksella, nielu 1,1 ei poistu ollenkaan mutta ei myöskään
   * liiku, aurinko 3,0 ei poistu eikä pysy paikallaan. Kaikki neljä uutta
   * asettuvat sille janalle eivätkä oman asteikkonsa varaan.
   */
  T: 2.2,   /* törähdystorvi: tallattava, eli se *voidaan* poistaa — mutta vasta
             * menemällä siihen linjaan johon se ampuu, ja siihen asti se
             * täyttää koko käytävän 150 framen välein. Papuparoonin 3,0
             * yläpuolelle se ei nouse, koska sen ammus on tallattava ja
             * paroonin pommi ei ole; piikkiukon 1,4 yläpuolelle se nousee,
             * koska piikkiukko on yksi este yhdessä paikassa ja tämä on este
             * joka syntyy uudelleen niin kauan kuin lähde on pystyssä. */
  Z: 1.8,   /* paarma: ampuu suoraan alas siihen mihin pelaaja on pysähtynyt, eli
             * se ei ota reittiä vaan **pysähtymispaikat**. Ruskean pilven 1,5
             * yläpuolella koska pilvi vain ajelehtii sinua kohti ja tämän voi
             * ohittaa vain ajoituksella; suihkun 1,5 yläpuolella koska suihku on
             * metronomi yhdessä sarakkeessa ja tämä partioi. Alle torven, koska
             * yksi pisara kerrallaan ja `PAARMA_COOL` on kaksi ja puoli sekuntia. */
  Y: 2.4,   /* yökki: itse otus on hitain ja haurain koko taulussa, ja hinta on
             * silti kolmanneksi korkein. Se on tarkoitus: hinta ei ole otus vaan
             * **sen tuotanto**. Jokainen ohitettu yökki jää selän taakse
             * lähettämään palloja, ja pallo kulkee samaa lattiaa kuin pelaaja —
             * eli tämä on ainoa vihollinen tässä pelissä joka tekee *jo
             * kuljetusta reitistä* uudelleen vaarallisen. Kurnuttajan 2,1
             * yläpuolella juuri siksi, ja auringon 3,0 alapuolella koska tämän
             * voi poistaa yhdellä tallauksella jos siihen asti pääsee. */
  m: 1.9,   /* paukkupöhö: kävelee kuin kävelijä (1,0) mutta pelaajan perusverbi
             * antaa siihen väärän vastauksen — tallaus sytyttää sen. Hinta on
             * kävelijän ja kuoriukon (1,3) yläpuolella siitä, ja piikkiukon
             * (1,4) yläpuolella siitä että piikkiukko vain kieltää yhden
             * vastauksen kun taas tämä rankaisee siitä. Torven alapuolella,
             * koska se on kertakäyttöinen ja koska räjähdys hajottaa myös sen
             * mikä sattuu seisomaan vieressä — se on yhtä usein työkalu kuin
             * este, ja työkalusta ei veloiteta täyttä hintaa. */
  O: 0.0,   // moon: harmless, it is a trampoline with a power-up in it
  b: 5.0,   /* boss: one entity, but it is the level. The real spread between
             * bosses is bossVariant's move set, which is code and not grid, so
             * this single number is the heuristic at its blindest. */
};

/*
 * Counted per COLUMN, not per tile. Lava is written as a two-row slab and
 * spikes as a single row, so counting tiles would say a lava trench is twice
 * the hazard a spike bed of the same width is purely because of how the chunk
 * is spelled. What the player meets is the width of the thing.
 *
 * Kosketushinnat vain: möykky on `LUMP_COST` alempana ja juoksuhiekka
 * `QUICKSAND_COST`, ja silmukat lukevat yhdistetyn `HAZARD_COST`in.
 */
const LETHAL_TILE = { '^': 1.0, W: 1.5 };  // lava has no ledge to land on; spikes do

/*
 * JUOKSUHIEKKA, priced by DEPTH rather than by presence, because depth is what
 * decides whether the tile can kill at all.
 *
 * The rule in the engine is geometric: you drown when the whole body is under
 * the surface, so a pool shallower than the smallest body (16 px, one tile)
 * cannot drown anybody however long you stand in one. A one-tile pool costs you
 * a struggle, the clock, and whatever was chasing you; two tiles or more can
 * end the life. Two numbers, and the split is where the physics puts it.
 *
 * Where they sit on the scale is the same argument the enemy table makes. Deep
 * sand is below lava's 1.5 because lava is instant and this gives you about
 * three seconds; it is above the spike bed's 1.0 because a spike bed is one
 * jump and one power level, while a pool has to be climbed out of, and the
 * ordinary jump — the answer to everything else in this game — does not work
 * inside one. Shallow sand at 0.5 is the tax without the risk.
 *
 * Counted per column like every other lethal tile, so a wide pool costs more
 * than a narrow one and a deep one does not cost double for being spelled with
 * two rows.
 *
 * It is deliberately NOT folded into `lethalCol` below, and that is worth
 * saying out loud: doing so would make a pool count a second time as a gap to
 * be jumped, and the whole point of the tile is that it is not a gap. The price
 * is in `hazards` and nowhere else.
 */
const QUICKSAND_COST = { shallow: 0.5, deep: 1.2 };
const QUICKSAND = '~';

/*
 * MÖYKKY (`T.LUMP`, `'C'`) — 0,6, ja tämä luku on koko sen työn suunnittelupäätös.
 *
 * Se asetettiin 4-2:een ja 4-F:ään ja tämä tiedosto ei muuttunut riviäkään:
 * mittari ei tuntenut merkkiä, eikä portti joka olisi huomannut sen katsonut
 * laattoja lainkaan (ks. `verify.mjs`, "laattavaarojen hinta"). Portti on nyt
 * olemassa; tässä on se luku jota se vaatii.
 *
 * **Nolla olisi väärin ja piikin 1,0 olisi väärin, ja syyt ovat eri.**
 *
 * Miksei nolla. Möykky osuu (`LevelScene.lumpImpact` → `p.hurt`), ja huone on
 * rakennettu sen ympärille: molemmissa kentissä se on `BB?BB`-lohkorivin päällä,
 * eli tasan siinä rivissä johon pelaajan on tarkoitus lyödä päätään. Nolla on
 * 2-4:n savikuopan hinta, ja se hinta on ansaittu siksi että kaivanto **ei voi
 * maksaa mitään millään ketjulla** — se on maastoa joka siirtää muuta tavaraa.
 * Möykky voi maksaa, joten se on tuon rajan toisella puolella.
 *
 * Miksei 1,0. Piikki on reitillä: jokainen joka kulkee sarakkeen läpi kohtaa
 * sen, ja pienen pelaajan se tappaa. Möykky ei ole kummankaan puolesta:
 *
 *   - **Se ei putoa ellei pelaaja pudota sitä.** `dropAbove` lähtee siitä että
 *     ruutu tyhjenee, ja tuki saa olla vain tiili (`rules.js`, `checkFalling`,
 *     joka kieltää murenevan laudan). Tiilen rikkoo iso pelaaja päällään,
 *     potkaistu kuori tai papupommi — kaikki pelaajan tekoja. Ohi kävelevä ei
 *     kohtaa sitä lainkaan, mikä ei päde yhteenkään muuhun tämän tiedoston
 *     hinnoittelemaan laattaan.
 *   - **Se ei voi viedä henkeä sillä ketjulla jonka varaan se on rakennettu.**
 *     Voimatasolla 0 tiiltä ei saa rikki, joten möykyn pudottaja on iso ja osuma
 *     maksaa koon eikä henkeä (mitattu 4-F:ssä: 1 → 0). Tämä on tasan se raja
 *     jolla juoksuhiekka jaetaan matalaan ja syvään — "voiko tämä päättää
 *     yrityksen" — ja möykky on sen väärällä puolella niin kuin matala hiekka.
 *   - **Ja se varoittaa.** 12 framea paikallaan täristen, sitten 3,2 px/framea,
 *     mikä on kävelyä nopeampi mutta putoamista hitaampi. Mitattu: paikalleen
 *     jäänyt menettää voimatason, kävelyvauhdissa lähtenyt ei menetä mitään.
 *
 * Miksi silti matalan hiekan 0,5:n **yläpuolella**: matala hiekka ei satuta
 * ollenkaan, se maksaa kellon ja rimpuilun. Möykky vie voimatason, ja DESIGN.md
 * kohta 5 käyttää kokonaisen luvun siihen mitä menetetty voimataso maksaa.
 * Osuma on enemmän kuin vero. Se ei ole paljon enemmän, koska kaksi ylläolevaa
 * alennusta ovat isoja — siksi 0,6 eikä 0,9.
 *
 * Laskettu per sarake niin kuin kaikki muukin tässä taulussa, joten kaksi
 * möykkyä maksaa kaksi ja pino yhdessä sarakkeessa maksaa yhden: pelaaja kohtaa
 * sen leveyden, ei sen korkeuden.
 *
 * MITÄ TÄMÄ LUKU EI KATA, sanottuna ääneen koska sanottu rajoitus on parempi
 * kuin luku joka hiljaa tarkoittaa muuta: potkaistu kuori rikkoo tiilen myös
 * pienen pelaajan puolesta, eli **kuoren ulottuvilla oleva möykky voi tappaa**.
 * Yksikään pelin kahdesta möykystä ei ole sellaisessa huoneessa, eikä mittari
 * osaa kysyä kuoren ulottuvuutta ruudukosta — se lukisi olioiden liikettä eikä
 * lähtötilaa. Jos sellainen huone joskus rakennetaan, tämä luku on liian pieni
 * sille huoneelle, ja se on tämän rivin vika eikä sen huoneen.
 */
const LUMP_COST = 0.6;
const LUMP = 'C';

/**
 * Mitä yksi merkki maksaa sarakkeessaan. `LETHAL_TILE` on se puolisko joka
 * satuttaa pelkästä koskemisesta; möykky vaatii pelaajan teon ensin, ja siksi
 * sillä on oma lukunsa ja omat perustelunsa yllä. Yhdistetty taulu on se jota
 * silmukat lukevat, jotta uusi vaaralaatta lisätään yhteen paikkaan.
 */
const HAZARD_COST = { ...LETHAL_TILE, [LUMP]: LUMP_COST };

/*
 * JÄÄ (`T.ICE`, `'I'`) — eikä yhtään riviä `HAZARD_COST`iin, ja se on väite.
 *
 * Jää ei satuta. Se ei satuta kosketuksesta niin kuin piikki, eikä pelaajan
 * aloittaman ketjun päätteeksi niin kuin möykky: sen päällä voi seistä
 * loputtomiin eikä mitään tapahdu. Vaaralistalla se olisi lisäksi väärässä
 * paikassa mekaanisesti, koska `HAZARD_COST` luetaan sarakkeen **pahimpana**
 * (`Math.max`) — jään ja piikin jakava sarake hinnoittelisi vain piikin, eli
 * jää olisi ilmaista tasan siellä missä se eniten maksaa.
 *
 * Se mitä jää oikeasti tekee on **poistaa tähtäyksen jalansijalta**, ja tälle
 * mittarilla on jo termi: `precision`. Kapea jalansija on vaikea siinä suhteessa
 * kuinka vähän sitä on, ja kolme laattaa on se leveys jolla laskeutuminen
 * lakkaa vaatimasta tähtäystä. Jäällä se leveys ei ole kolme vaan `ICE_BRAKE`,
 * ja se luku on mitattu eikä arvattu (`tools/measure-braking.mjs`, ks.
 * `src/data/rules.js`): P-nopeudesta vastaan kääntyminen syö 68 px eli 4,25
 * laattaa, ylöspäin viisi.
 *
 * Eli jää ei ole uusi termi vaan vanhan termin toinen kynnys, ja se on koko
 * hinnoittelu: viiden laatan jäälautta maksaa saman kuin kolmen laatan lankku,
 * ja kymmenen laatan jääkenttä maksaa puolet siitä. Kertoimet — kuolema alla
 * 2,5x, mureneva 1,5x — pätevät jäähän sellaisenaan, koska ne kertovat mitä
 * ohi ampuminen maksaa eivätkä sitä kuinka vaikea on olla ampumatta ohi.
 */
const ICE = 'I';
const ICE_BRAKE = 5;
/** Kuinka leveä jalansija on ennen kuin laskeutuminen lakkaa vaatimasta tähtäystä. */
const aimWidth = (chars) => (chars.includes(ICE) ? ICE_BRAKE : 3);

const SOLID = new Set(['#', 'X', 'B', '?', '!', '*', 'u', 'N', '[', ']', '{', '}', '%', '(', ')', 'S', 'C', 'I', 'J']);

/**
 * Same band rule as src/data/rules.js: the route is the band the player starts
 * in. Duplicated rather than imported because rules.js keeps it private, and
 * exporting it from there would widen the validator's surface for a reporting
 * tool.
 */
function routeBand(rows) {
  if (rows.length <= ROWS) return rows;
  const start = rows.findIndex((row) => row.includes('1'));
  /* Kiinni ruudukon pohjaan: kaista on `ROWS` riviä, mutta jokainen korkea
   * ruudukko ei ole kaistojen monikerta — 45 rivin kiipeily luettuna vaakana
   * antaisi muuten alle `ROWS` riviä, ja `runs` lukisi olematonta riviä.
   * Ennen 18.8.2026 tätä ei voinut nähdä, koska 45 on tasan kolme kaistaa. */
  const top = Math.min(Math.floor(Math.max(start, 0) / ROWS) * ROWS, rows.length - ROWS);
  return rows.slice(top, top + ROWS);
}

/**
 * Horizontal runs of `chars`, as {y, from, w}. The floor row is included: the
 * crumbling catwalk is written at floor level, and it is footing you have to
 * aim at like any other.
 */
function runs(route, chars) {
  const out = [];
  const w = route[0].length;
  for (let y = 0; y <= FLOOR; y++) {
    let run = 0;
    for (let x = 0; x <= w; x++) {
      if (x < w && chars.has(route[y][x])) { run++; continue; }
      if (run) out.push({ y, from: x - run, w: run });
      run = 0;
    }
  }
  return out;
}

/*
 * THE SAME METER, TURNED NINETY DEGREES.
 *
 * Every number this tool prints is "per hundred columns", and on a climb that
 * is nonsense of a particularly quiet kind: a vertical level is twenty columns
 * wide by definition, so dividing by the width multiplies everything by five
 * and a level with four enemies in it scores like a level with twenty. It
 * would not fail, it would lie — which is exactly what the spiky walker did
 * when it shipped priced at zero, and the reason that story is in `ENEMY_COST`
 * rather than in a commit message.
 *
 * So a climb is measured **per hundred rows of climb**, and the four metrics
 * that name an axis are re-aimed rather than reused:
 *
 *   gaps → **the steps that need a run-up.** The horizontal term is
 *          (span / jump budget)² per hole, because a hole is the exception on
 *          a floor and its width against the jump is what makes it hard. The
 *          naive translation — the same square per step of the ladder — was
 *          tried first and it is wrong by a factor of twenty, for a reason
 *          worth writing down: on a floor a jump is the exception, and in a
 *          climb every single move is one, so summing a cost per step prices
 *          the shape of the level rather than its difficulty. Measured, the
 *          fixture climb scored **1920** that way against a world-1 level's
 *          100, which is not a hard level, it is a broken scale.
 *
 *          What actually varies between two climbs is whether the steps can be
 *          taken **from a standstill**. `tools/jump-budget.json` measures both
 *          jumps: standing-held rises 71 px and running-held 85 px, which at
 *          the same 0.8 safety factor `wallTiles` is derived with are 3 tiles
 *          and 4. A three-tile step is free — you hop it from where you stand,
 *          and a climb's platforms are short enough that standing is usually
 *          all you have. A four-tile step demands a run-up on a platform that
 *          may not be long enough to take one, and *that* is the thing that
 *          kills climbs. So the cost is the excess over the standing jump,
 *          squared against the budget, and a climb built at three tiles scores
 *          zero here — correctly, because it has asked for nothing.
 *   hazards → per **row**, not per column. "What the player meets is the width
 *          of the thing" is why the horizontal one collapses a lava slab to
 *          its columns; on a climb what you meet is its height.
 *   pit → **how far a miss costs you.** There are no bottomless columns in a
 *          climb — the rules refuse them, because falling is a setback and not
 *          a death — so the horizontal "share of the level that is over death"
 *          has nothing to count. What survives is the exposure the horizontal
 *          term is really measuring: the share of the footing from which a
 *          missed landing drops you **more than one screen**, 13 rows, so the
 *          climb you lose leaves the picture entirely. A ladder whose rungs
 *          catch each other scores zero; one built over its own void does not.
 *   drought → the longest stretch **of the climb** with no power block, as a
 *          share of the height rather than the width.
 *
 * The references in `WEIGHTS` stay frozen at world 1's horizontal averages,
 * and that is a decision with a cost worth stating: a climb's score is
 * comparable with other climbs exactly, and with a horizontal level only as
 * far as "per 100 rows" and "per 100 columns" are comparable units of
 * exposure. They are the same unit of *time* — the player crosses about as
 * many tiles a second either way — which is the honest defence, and it is a
 * weaker one than the meter usually has. Re-referencing the scale to a
 * vertical world would be worse: it would renormalise, and the frozen
 * references exist precisely so the scale cannot.
 */
function measureClimb(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w ? ' ' : rows[y][x]);

  let enemyCost = 0;
  const enemies = {};
  let hazardCost = 0;
  for (let y = 0; y < h; y++) {
    let worst = 0;
    for (let x = 0; x < w; x++) {
      const ch = at(x, y);
      if (ENEMY_COST[ch] !== undefined) {
        enemyCost += ENEMY_COST[ch];
        enemies[ch] = (enemies[ch] || 0) + 1;
      }
      worst = Math.max(worst, HAZARD_COST[ch] || 0);
    }
    hazardCost += worst;
  }

  /* The ladder. A platform is a run of footing with open sky over it, and a
   * step is the rise from one to the cheapest thing above it — the same
   * "nearest reachable" the climb graph works with, spelled here rather than
   * imported because this tool measures the grid as written and the validator
   * measures it against the engine. */
  const stands = (x, y) => (SOLID.has(at(x, y)) || at(x, y) === '-') && !SOLID.has(at(x, y - 1));
  const tops = [];
  for (let y = 0; y < h; y++) {
    let from = -1;
    for (let x = 0; x <= w; x++) {
      if (x < w && stands(x, y)) { if (from < 0) from = x; continue; }
      if (from >= 0) tops.push({ y, x0: from, x1: x - 1 });
      from = -1;
    }
  }
  let climbRisk = 0;
  const spans = [];
  for (const p of tops) {
    let best = null;
    for (const q of tops) {
      if (q.y >= p.y) continue;
      const across = q.x0 > p.x1 ? q.x0 - p.x1 - 1 : p.x0 > q.x1 ? p.x0 - q.x1 - 1 : 0;
      if (across > budget.gapTiles) continue;
      if (!best || q.y > best.y) best = q;
    }
    if (!best) continue;
    const rise = p.y - best.y;
    climbRisk += (Math.max(0, rise - STAND_TILES) / budget.wallTiles) ** 2;
    spans.push(rise);
  }

  /* How far a miss costs: footing with more than one screen of nothing under
   * it. Measured straight down from every column of the platform, because
   * that is where a body that missed the next rung goes. */
  let exposed = 0;
  for (const p of tops) {
    for (let x = p.x0; x <= p.x1; x++) {
      let d = 1;
      while (p.y + d < h && !SOLID.has(at(x, p.y + d)) && at(x, p.y + d) !== '-') d++;
      if (d > SCREEN_ROWS) { exposed++; break; }
    }
  }
  const pitShare = tops.length ? (exposed / tops.length) * 100 : 0;

  let drought = 0;
  let sinceP = 0;
  for (let y = h - 1; y >= 0; y--) {
    const power = Array.from({ length: w }, (_, x) => at(x, y)).includes('!');
    sinceP = power ? 0 : sinceP + 1;
    drought = Math.max(drought, sinceP);
  }

  /* Precision, unchanged in meaning: narrow footing is hard in proportion to
   * how little of it there is. Every plank in a climb is over a drop, so the
   * "over death" multiplier is read from the drop under it rather than from a
   * floor row that does not exist here. */
  let precision = 0;
  for (const p of tops) {
    const width = p.x1 - p.x0 + 1;
    const chars = Array.from({ length: width }, (_, i) => at(p.x0 + i, p.y));
    if (!chars.some((ch) => ch === '-' || ch === '%' || ch === ICE)) continue;
    let over = false;
    for (let x = p.x0; x <= p.x1; x++) {
      let d = 1;
      while (p.y + d < h && !SOLID.has(at(x, p.y + d)) && at(x, p.y + d) !== '-') d++;
      if (d > SCREEN_ROWS) over = true;
    }
    const crumbles = chars.includes('%');
    precision += Math.min(1, aimWidth(chars) / width) * (over ? 2.5 : 1) * (crumbles ? 1.5 : 1);
  }

  const per100 = (n) => (n / h) * 100;
  return {
    cols: w,
    rows: h,
    vertical: true,
    enemies,
    spans,
    metrics: {
      enemies: per100(enemyCost),
      gaps: per100(climbRisk),
      hazards: per100(hazardCost),
      pit: pitShare,
      drought: (drought / h) * 100,
      precision: per100(precision),
    },
  };
}

/*
 * OSIOITU KENTTÄ: SAMA MITTARI, OSIO KERRALLAAN, MATKALLA PAINOTETTUNA.
 *
 * Osioitu kenttä mitattuna yhtenä kaistana on mittausvirhe eikä epätarkkuus:
 * `routeBand` ottaa ne viisitoista riviä joilla aloitusmerkki on, ja 7-P:ssä
 * kolme neljäsosaa kentästä asuu muualla — ne luettaisiin tyhjänä ilmana, eli
 * yhtenä kuudenkymmenen sarakkeen pohjattomana kuiluna. Luku olisi järjetön ja
 * mikään ei sanoisi niin.
 *
 * Palat tulevat `segmentSlices`iltä, samalta funktiolta jolta säännöstökin
 * ottaa ne, ja kumpikin mittari mittaa sen palan omalla akselillaan. Ne
 * lasketaan yhteen `travel`illä painottaen: molemmat mittarit ovat "sataa
 * yksikköä kohti", joten vaakaosion sarakkeet ja pystyosion rivit ovat sama
 * valuutta. Kenttä jonka puolet on nousua saa siis puolet luvustaan nousun
 * mittarilta, mikä on täsmälleen se mitä pelaaja siitä kentästä pelaa.
 */
function measureSegments(rows, segments) {
  const { slices, error } = segmentSlices(rows, segments);
  if (error || !slices.length) return measure(rows);
  const parts = slices.map((s) => ({ s, m: measure(s.rows, { vertical: s.vertical }) }));
  const weight = (p) => Math.max(1, p.s.travel);
  const total = parts.reduce((a, p) => a + weight(p), 0);
  const metrics = {};
  for (const key of Object.keys(WEIGHTS)) {
    metrics[key] = parts.reduce((a, p) => a + p.m.metrics[key] * weight(p), 0) / total;
  }
  const enemies = {};
  for (const p of parts) {
    for (const [k, n] of Object.entries(p.m.enemies)) enemies[k] = (enemies[k] || 0) + n;
  }
  return {
    cols: total,
    rows: rows.length,
    segmented: true,
    enemies,
    spans: parts.flatMap((p) => p.m.spans),
    metrics,
  };
}

function measure(rows, opts = {}) {
  if (Array.isArray(opts.segments) && opts.segments.length) return measureSegments(rows, opts.segments);
  if (opts.vertical) return measureClimb(rows);
  const route = routeBand(rows);
  const w = route[0].length;
  /* Raja luetaan **kaistasta itsestään** eikä `ROWS`ista, ja se on korjaus eikä
   * varovaisuutta: kun kenttädata kasvoi 15 rivistä 16:een (18.8.2026), vakio
   * ja committoitu data olivat hetken eri mieltä — ja `route[y]` oli
   * `undefined` juuri sillä rivillä jota vakio lupasi. Mittari joka lukee
   * ruudukkoa lukekoon sen omat mitat. */
  const h = route.length;
  const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w ? ' ' : route[y][x]);

  let enemyCost = 0;
  const enemies = {};
  let hazardCost = 0;
  for (let x = 0; x < w; x++) {
    let worst = 0;
    let sand = 0;
    for (let y = 0; y < ROWS; y++) {
      const ch = at(x, y);
      if (ENEMY_COST[ch] !== undefined) {
        enemyCost += ENEMY_COST[ch];
        enemies[ch] = (enemies[ch] || 0) + 1;
      }
      if (ch === QUICKSAND) sand++;
      worst = Math.max(worst, HAZARD_COST[ch] || 0);
    }
    if (sand) worst = Math.max(worst, sand > 1 ? QUICKSAND_COST.deep : QUICKSAND_COST.shallow);
    hazardCost += worst;
  }

  /*
   * A column is lethal if standing in it kills: no floor at all, or lava where
   * the floor should be. Lava counts because a lava trench is a pit that the
   * engine happens to have put a lid on — it is not somewhere you land. Lava on
   * the lower floor row counts only when the upper one is open, so a solid
   * catwalk with lava beneath it reads as the catwalk it is; a crumbling one
   * does not, because it will not be there.
   */
  const lethalCol = [];
  for (let x = 0; x < w; x++) {
    const stands = (y) => SOLID.has(at(x, y)) && at(x, y) !== '%';
    const grounded = stands(FLOOR) || stands(FLOOR + 1);
    const lava = at(x, FLOOR) === 'W' || (!SOLID.has(at(x, FLOOR)) && at(x, FLOOR + 1) === 'W');
    lethalCol.push(!grounded || lava);
  }

  /*
   * Gap risk. The thing that makes a gap hard is not its width but its width
   * *relative to what the jump carries* — six tiles out of an eight-tile budget
   * is a jump you take without thinking, and nine is a death. So the span is
   * divided by the measured budget and squared: the cost climbs steeply as the
   * gap approaches the budget, which is how the failure rate behaves too.
   *
   * Stepping stones are honoured, because a player crosses to the stone and not
   * to the far side. A gap is therefore cut at every column that has a platform
   * over it, and each resulting hop is scored on its own — which is why an
   * eight-wide pit with a plank in it scores half of what a bare one does.
   */
  const landable = [];
  for (let x = 0; x < w; x++) {
    const plank = Array.from({ length: FLOOR + 1 }, (_, y) => at(x, y)).some((ch) => ch === '-' || ch === '%');
    landable.push(!lethalCol[x] || plank);
  }
  let gapRisk = 0;
  let span = 0;
  const spans = [];
  for (let x = 0; x <= w; x++) {
    if (x < w && !landable[x]) { span++; continue; }
    if (span) { gapRisk += (span / budget.gapTiles) ** 2; spans.push(span); }
    span = 0;
  }

  /*
   * How much of the level is over death, regardless of how it is divided up.
   * A level can be all narrow gaps — cheap by the rule above — and still spend
   * a third of its length somewhere a mistake is fatal, which is a different
   * kind of pressure and worth its own number.
   */
  const pitShare = (lethalCol.filter(Boolean).length / w) * 100;

  /*
   * The longest stretch with no power block. This is not difficulty on its own,
   * it is an amplifier: the design promise is that the route works at the
   * smallest size, so a drought never makes a level impossible — it only means
   * that if you get hit at the start of it, you play all of it small.
   */
  let drought = 0;
  let sinceP = 0;
  for (let x = 0; x < w; x++) {
    const power = Array.from({ length: ROWS }, (_, y) => at(x, y)).includes('!');
    sinceP = power ? 0 : sinceP + 1;
    drought = Math.max(drought, sinceP);
  }

  /*
   * Forced precision. Narrow footing is hard in proportion to how little of it
   * there is — three tiles is about where a landing stops needing aim, so the
   * cost is 3/width and capped at 1. Footing over a lethal column counts far
   * more (2.5x): missing a plank over grass costs a climb, missing one over a
   * pit costs a life. Crumbling tiles get a further 1.5x because the platform
   * is leaving whether or not you aimed well.
   *
   * Jää on mukana samalla termillä mutta omalla kynnyksellään: sillä "riittävän
   * leveä" ei ole kolme laattaa vaan mitattu `ICE_BRAKE`. Ks. `aimWidth`.
   */
  let precision = 0;
  for (const r of runs(route, new Set(['-', '%', ICE]))) {
    const chars = Array.from({ length: r.w }, (_, i) => at(r.from + i, r.y));
    const overDeath = Array.from({ length: r.w }, (_, i) => lethalCol[r.from + i]).some(Boolean);
    const crumbles = chars.includes('%');
    precision += Math.min(1, aimWidth(chars) / r.w) * (overDeath ? 2.5 : 1) * (crumbles ? 1.5 : 1);
  }

  const per100 = (n) => (n / w) * 100;
  return {
    cols: w,
    enemies,
    spans,
    metrics: {
      enemies: per100(enemyCost),
      gaps: per100(gapRisk),
      hazards: per100(hazardCost),
      pit: pitShare,
      drought: (drought / w) * 100,
      precision: per100(precision),
    },
  };
}

/*
 * Weights, and the reference each metric is divided by.
 *
 * `ref` is world 1's measured average of that metric — the four levels the game
 * opens with, fortress included — so a term reading 100·w means "as much of
 * this as the gentlest world in the game has". World 1 therefore averages 100
 * by construction, and every other world is a percentage of it.
 *
 * The references are FROZEN measurements, not a running average. That is the
 * point: if the whole game is made harder the scores must all rise, and a scale
 * that renormalised itself would report no change at all. Re-measure them (and
 * say so in the changelog) only if world 1 itself is redesigned.
 *
 * `w` sums to 1 and is the editorial half — the claim about what makes a
 * platformer hard, in order:
 *   gaps       0.30  the only thing here that kills with no warning and no
 *                    recovery, and the hardest skill to acquire
 *   enemies    0.25  the constant tax; every level has it, so it sets the floor
 *   precision  0.18  aiming a landing is the second skill, and it fails silently
 *   hazards    0.12  lethal but static: learnable in one attempt
 *   pit        0.09  exposure rather than a challenge in itself
 *   drought    0.06  an amplifier, not a source — see the promise in DESIGN.md §5
 */
const WEIGHTS = {
  enemies: { w: 0.25, ref: 3.57 },
  gaps: { w: 0.30, ref: 0.30 },
  hazards: { w: 0.12, ref: 3.82 },
  pit: { w: 0.09, ref: 6.35 },
  drought: { w: 0.06, ref: 65.08 },
  precision: { w: 0.18, ref: 1.62 },
};

/** 100 = a world 1 level. Linear in every term, so a 20% rise is 20% more of something. */
function score(metrics) {
  let total = 0;
  const parts = {};
  for (const [key, { w, ref }] of Object.entries(WEIGHTS)) {
    parts[key] = 100 * w * (metrics[key] / ref);
    total += parts[key];
  }
  return { total, parts };
}

/* Play order, straight off the map graph, so the sequence is the one a player
 * actually walks and not the order the definitions happen to be written in. */
const playOrder = WORLDS.map((world) => ({
  id: world.id,
  world,
  levels: world.nodes.filter((n) => n.level).map((n) => ({ id: n.level, fortress: n.type === 'fortress' })),
}));

const rows = [];
for (const world of playOrder) {
  for (const { id, fortress } of world.levels) {
    /* The level says which axis it is on; the tool does not guess from the row
     * count, because a tall level is three stacked rooms and a climb is one
     * tall room and no grid can tell those apart. Inert for every level in the
     * game today — none of them carries the flag. */
    const def = getLevel(id);
    const m = measure(def.rows, { vertical: !!def.vertical, segments: def.segments });
    rows.push({
      id, world: world.id, fortress, ...m, ...score(m.metrics),
    });
  }
}

/**
 * The same measurement, applied to rows that are not a level in the game.
 *
 * It exists for one job and the job is worth stating: a hazard the meter cannot
 * see scores zero, every level containing it is measured as easier than it
 * plays, and nothing anywhere says so — that is exactly what happened to the
 * spiky walker. `verify.mjs` builds two identical fixtures that differ by one
 * tile and asserts the number moves, which is a test of the *table above*
 * rather than of any level, and there is no other way to write it.
 */
export function scoreRows(rows, opts = {}) {
  return score(measure(rows, opts).metrics).total;
}

/** The one number per level that leaves this tool. One decimal, and no more:
 *  the heuristic does not have a second one, and printing it would suggest it
 *  does. */
export function difficultyTable() {
  return Object.fromEntries(rows.map((r) => [r.id, Number(r.total.toFixed(1))]));
}

const SCORES = difficultyTable();

/**
 * Worlds as tiers. A tier is one step of progress — one level, or one branch
 * whose routes are alternatives — and its number is `tierScore`: hardest level
 * within a route, easiest route across a branch. The world's number is the mean
 * over its tiers, fortress included, which is what it always was for a world
 * with no branches and stays comparable across the change.
 */
const worldShape = playOrder.map(({ id, world }) => {
  const tiers = tiersOf(world).map((t) => ({ ...t, score: tierScore(world, t, SCORES) }));
  const mean = tiers.reduce((s, t) => s + t.score, 0) / (tiers.length || 1);
  return {
    id,
    world,
    tiers,
    mean,
    branches: branchesOf(world, SCORES),
    levels: rows.filter((r) => r.world === id),
  };
});

const problems = WORLDS.flatMap((w) => worldProblems(w, SCORES));

/**
 * The generated file the game reads. Written only when asked: a reporting tool
 * that rewrites its own inputs as a side effect is exactly the trap
 * `measure-jump.mjs` fell into, and this one is read by the world map.
 */
function renderDataFile(table) {
  const header = `/**
 * GENERATED FILE — do not edit by hand.
 *
 *   node tools/difficulty.mjs --write
 *
 * The measured difficulty of every level, as \`tools/difficulty.mjs\` scores it.
 * 100 = a world 1 level; the scale and its frozen references live in the tool.
 *
 * This file exists because the map has to show difficulty BEFORE the player
 * commits to a branch, and the game cannot run the tool: the tool is Node, it
 * reads \`tools/jump-budget.json\` off disk, and the game is a static page. So
 * the numbers are carried across in a data file, the same way
 * \`tools/pacing-stats.json\` carries pacing to the generator.
 *
 * A carried number can go stale, which is the whole cost of doing it this way.
 * That is caught rather than trusted: \`tools/verify.mjs\` re-runs the measurement
 * and compares it with this file, and a single changed level fails the gate with
 * the command that fixes it. Writing is a separate flag on purpose — a reporting
 * tool that rewrites its own inputs as a side effect is the trap
 * \`measure-jump.mjs\` already fell into.
 */

export const DIFFICULTY = {
`;
  const body = Object.entries(table)
    .map(([id, v]) => `  '${id}': ${v.toFixed(1)},`).join('\n');
  return `${header}${body}\n};\n`;
}

/** Stored vs measured, as a list of human-readable differences. */
export function compareTable(stored, measured) {
  const out = [];
  for (const [id, v] of Object.entries(measured)) {
    if (!(id in stored)) out.push(`${id}: puuttuu tiedostosta (mitattu ${v.toFixed(1)})`);
    else if (Math.abs(stored[id] - v) > 0.05) {
      out.push(`${id}: tiedostossa ${Number(stored[id]).toFixed(1)}, mitattu ${v.toFixed(1)}`);
    }
  }
  for (const id of Object.keys(stored)) {
    if (!(id in measured)) out.push(`${id}: tiedostossa mutta ei enää pelissä`);
  }
  return out;
}

if (WRITE && IS_MAIN) {
  await writeFile(join(ROOT, 'src/data/difficulty.js'), renderDataFile(SCORES));
  console.log('\n  kirjoitettu src/data/difficulty.js\n');
}

if (!IS_MAIN) {
  // imported by verify.mjs for the freshness check; it wants the numbers, not
  // the report.
} else if (JSON_OUT) {
  console.log(JSON.stringify({
    levels: rows,
    worlds: worldShape.map((w) => ({
      id: w.id,
      mean: w.mean,
      tiers: w.tiers.map((t) => ({ id: t.id, levels: t.levels, score: t.score })),
    })),
    problems,
  }, null, 2));
  process.exit(0);
} else {
  report();
}

function report() {
const pad = (s, n) => String(s).padEnd(n);
const num = (v, n, d = 1) => String(v.toFixed(d)).padStart(n);
const meter = (n) => '●'.repeat(n) + '○'.repeat(PIPS - n);

console.log('\nVaikeusmittari — heuristiikka, ei totuus. Perusluku 100 = maailman 1 taso.\n');

if (RAW) {
  console.log(`  ${pad('KENTTÄ', 8)}${pad('SAR.', 6)}${pad('VIHUT', 8)}${pad('KUILUT', 8)}`
    + `${pad('VAARAT', 8)}${pad('KUILU%', 8)}${pad('KUIVUUS', 9)}TARKKUUS`);
  for (const r of rows) {
    const m = r.metrics;
    console.log(`  ${pad(r.id, 8)}${pad(r.cols, 6)}${num(m.enemies, 6)}  ${num(m.gaps, 6)}  `
      + `${num(m.hazards, 6)}  ${num(m.pit, 6)}  ${num(m.drought, 7)}  ${num(m.precision, 6)}`);
  }
  console.log('\n  Yksiköt: kaikki per 100 saraketta, paitsi KUILU% ja KUIVUUS jotka ovat');
  console.log('  osuuksia kentän pituudesta. KUILUT on (hyppyväli / hyppybudjetti)² summattuna.\n');
}

console.log(`  ${pad('KENTTÄ', 8)}${pad('PISTEET', 9)}${pad('VIHUT', 7)}${pad('KUILUT', 8)}`
  + `${pad('VAARAT', 8)}${pad('KUILU%', 8)}${pad('KUIVUUS', 9)}${pad('TARKKUUS', 10)}KARTALLA`);
for (const world of worldShape) {
  for (const r of world.levels) {
    const p = r.parts;
    console.log(`  ${pad(r.id, 8)}${num(r.total, 6)}   ${num(p.enemies, 5)}  ${num(p.gaps, 6)}  `
      + `${num(p.hazards, 6)}  ${num(p.pit, 6)}  ${num(p.drought, 7)}  ${num(p.precision, 6)}`
      + `    ${meter(pipsFor(r.total))}`);
  }
  console.log(`  ${pad(world.id, 8)}${num(world.mean, 6)}   ← tasojen keskiarvo, helpoin reitti\n`);
}

/* Across worlds: strictly increasing, no ties. */
let monotonic = true;
console.log('  Maailmojen käyrä:');
for (let i = 0; i < worldShape.length; i++) {
  const prev = i ? worldShape[i - 1].mean : null;
  const delta = prev === null ? null : worldShape[i].mean - prev;
  const mark = delta === null ? '   ' : delta > 0 ? ' ↑ ' : ' ↓ ';
  if (delta !== null && delta <= 0) monotonic = false;
  console.log(`    ${pad(worldShape[i].id, 5)}${num(worldShape[i].mean, 6)}${mark}`
    + `${delta === null ? '' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}`);
}
console.log(monotonic
  ? '\n  Käyrä nousee joka maailmassa.'
  : '\n  KÄYRÄ EI NOUSE — jokin maailma on edellistä helpompi.');

/*
 * The shape of a world, measured in TIERS rather than along a chain.
 *
 * The old walk was the world's levels in the order they happen to be listed,
 * and it was right only as long as the map was a queue. A branching map breaks
 * it in a way that looks like a content bug: two alternatives get read as two
 * consecutive steps, so an easy branch after a hard one reports as a dip that
 * nobody plays, and a hard branch reports as a spike nobody has to survive.
 * The tool would then complain about a correct map, and a gate that complains
 * about correct data gets switched off.
 *
 * So a tier is one step of progress: one level, or one whole branch. Two levels
 * inside one branch are one tier because a player plays one of them, and the
 * tier's number is the EASIEST route's — that is what everybody walks. The
 * branch's own inequality is a separate question, checked below.
 *
 * Unchanged, and still the point: generally up, with at least one deliberate
 * breather, because a straight line has no shape. The fortress stays out of the
 * walk — it is always the peak and always last, so counting it would make every
 * world "rises overall" for free.
 */
console.log('\n  Maailman muoto tasoittain, linnake pois lukien:');
for (const world of worldShape) {
  const walk = world.tiers.filter((t) => !t.fortress);
  const seq = walk.map((t) => t.score);
  const dips = seq.slice(1).filter((v, i) => v < seq[i]).length;
  const rises = seq[seq.length - 1] > seq[0];
  const shape = walk.map((t) => {
    if (!t.branch) return t.score.toFixed(0);
    const routes = world.branches.find((b) => b.from === t.branch.from);
    return `[${[...routes.routes].sort((a, b) => a.score - b.score)
      .map((r) => r.score.toFixed(0)).join('|')}]`;
  }).join(' → ');
  const verdict = rises && dips > 0 ? 'ok'
    : !rises ? 'ei nouse kokonaisuutena'
      : 'suora viiva, ei hengähdystä';
  console.log(`    ${pad(world.id, 5)}${pad(shape, 30)}${pad(`${dips} notkoa`, 12)}${verdict}`);
}
console.log('    Hakasulje on haara: sen reitit helpoimmasta vaikeimpaan, ja tason');
console.log('    luku on niistä ensimmäinen.');

/*
 * The branches themselves. A route's number is its hardest level, because a run
 * dies on the worst thing on the way and an average would let one gentle level
 * hide one lethal one. The reward has to be on the harder route or the choice
 * is a punishment, and that is checked, not assumed.
 */
const branched = worldShape.filter((w) => w.branches.length);
if (branched.length) {
  console.log('\n  Haarat — reitin luku on sen vaikein kenttä, ei keskiarvo:');
  for (const world of branched) {
    for (const branch of world.branches) {
      console.log(`    ${world.id}  ${branch.from} → ${branch.to}`);
      for (const r of [...branch.routes].sort((a, b) => a.score - b.score)) {
        const prize = r.reward ? (REWARDS[r.reward] || {}).label || r.reward : 'ei palkintoa';
        console.log(`      ${pad(r.name, 14)}${num(r.score, 6)}  ${meter(r.pips)}  `
          + `${pad(r.levels.join(' '), 12)}${prize}`);
      }
    }
  }
}

if (problems.length) {
  console.log('\n  KARTAN RAKENNE — korjattavaa:');
  for (const p of problems) console.log(`    ${p}`);
} else {
  console.log('\n  Kartan rakenne kunnossa: jokainen kenttä on jollain reitillä alusta');
  console.log('  linnakkeeseen, jokainen haara on ilmoitettu, palkitsematon reitti vie');
  console.log('  läpi, ja palkinto on vaikeammalla reitillä.');
}

console.log('\n  Heuristiikka lukee ruudukkoa. Se ei tiedä mitään rytmistä, pomon');
console.log('  liikesarjasta eikä siitä miltä hyppy tuntuu.');
/*
 * ROADMAP 10.8.2026, kohta 3. Emergenssin ensimmäinen erä tuli sisään sinä
 * päivänä — jää liukastaa kävelijän, tuuli kantaa vihollista, lauta pettää
 * niiden alta, potkaistu kuori tappaa sen mihin osuu — ja mikään niistä ei näy
 * tässä luvussa. Se on päätös eikä puute: **luku mittaa lähtötilan**, ja juuri
 * se tekee siitä vertailukelpoisen kaikkien 64 kentän ja kaiken ajan yli, mikä
 * on koko syy siihen että siihen luotetaan (kartan tähdet, haaran palkinto,
 * maailman muoto).
 *
 * Rivi on tässä siksi että **sanottu rajoitus on parempi kuin luku joka
 * hiljaa tarkoittaa uutta asiaa.** Jos joku joskus haluaa mitata sen mitä
 * kentässä *tapahtuu*, se on eri mittari eikä tämän uusi versio — ja tämä rivi
 * on se paikka josta hän huomaa ettei tämä ole se.
 *
 * MÖYKKY ON NYT TÄSSÄ RAJASSA MOLEMMIN PUOLIN, ja rivi luki sen väärin siihen
 * asti kunnes se hinnoiteltiin: "putoava laatta" oli tässä listassa niiden
 * joukossa jotka *eivät nosta yhtään lukua*, ja se lause oli epätosi sinä
 * hetkenä kun laatta asetettiin kenttään. Raja kulkee laatan ja sen
 * putoamisen välissä: **laatta on lähtötilaa** ja siitä maksetaan
 * (`LUMP_COST`), koska se on ruudukossa ennen kuin kukaan koskee mihinkään.
 * Putoaminen on lopputulos — mihin se päätyy, minkä se tukkii, kenet se
 * osuessaan kaataa — ja se on yhä ulkopuolella niin kuin tuuli.
 *
 * JA JÄÄ ON NYT SAMASSA RAJASSA, samasta syystä ja samalla korjauksella. Kun
 * jää oli teeman ominaisuus, se oli kokonaan tämän rivin ulkopuolella: koko
 * maailma 3 oli liukas eikä yksikään merkki ruudukossa sanonut niin, joten
 * mitattavaa ei ollut. `T.ICE` siirsi puolet siitä sisään. **Laatta on
 * lähtötilaa** ja siitä maksetaan (`aimWidth`: jäisellä jalansijalla "riittävän
 * leveä" on viisi laattaa kolmen sijaan), koska se on ruudukossa ennen kuin
 * kukaan koskee mihinkään. Liukuminen itse — kuinka pitkälle kukin pelaaja
 * kullakin vauhdilla oikeasti liukuu — on lopputulos ja yhä ulkopuolella.
 */
console.log('  Se mittaa myös vain LÄHTÖTILAN: emergentit lopputulokset — tuuli,');
console.log('  murtuva lauta, putoavan möykyn matka, liu\'un pituus, kuoriketju —');
console.log('  ovat tämän mittauksen ulkopuolella. Möykky itse on lähtötilaa ja');
console.log('  maksaa 0,6 sarakkeeltaan; jäälaatta on lähtötilaa ja maksaa');
console.log('  tarkkuutena. Kumpikaan ei maksa siitä mitä se sitten tekee.\n');
}
