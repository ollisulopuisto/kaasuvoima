import { Entity } from './entity.js';
import {
  moveX, moveY, GRAVITY, GRAVITY_HELD, GRAVITY_HELD_CUTOFF, TERMINAL,
  slopePull as slopeSlide,
} from '../level/physics.js';
import {
  drawPlayer, drawCork, PLAYER_SIZES, PLAYER_DUCK_SIZES, TINTS, STAR_TINTS, GLOWS,
} from '../gfx/sprites.js';
/* Straight from the sprite rather than through the barrel: these two belong to
 * the animation they drive, and there must be exactly one of each. The frame
 * count decides how long a stride is and the dead time decides when the second
 * tier of idle starts — both are the drawing's business, and a copy kept here
 * would go stale the first time either is tuned. */
import { WALK_FRAMES, DEEP_IDLE, DEATH_POP } from '../gfx/sprites/player.js';
import { FartBall } from './items.js';
/* Vauhtimittarin suihku, ks. `ventPlume`. Sama pilvi kuin muuallakin. */
import { Puff } from './effects.js';
import { Sfx } from '../core/audio.js';
import { approach } from '../core/utils.js';
/* Poimitun esineen hinta on pistetaulukon asia, ks. `points.js`. */
import { PTS } from '../core/points.js';
import { surfaceUnder, TILE } from '../gfx/tiles.js';

/*
 * Movement constants from the SMB3 disassembly. Raw bytes are 4.4 fixed point,
 * so the comment gives the original and the value is that byte over 16.
 *
 * Three of these are the ones that actually change how the game feels:
 *   - running does NOT accelerate harder than walking, it only lifts the cap
 *   - there is no air friction at all, so speed carries through a whole jump
 *   - the jump gets a small discrete bonus per whole pixel of ground speed,
 *     not a smooth one, so there are exactly four jump heights
 */
const MAX_WALK = 1.5;          // $18
const MAX_RUN = 2.5;           // $28
const MAX_P = 3.5;             // $38
const MAX_SPEED = 4.0;         // $40, the hard clamp
const ACC = 0.0547;            // $00 + $E0/256, identical with and without B
const FRICTION_SMALL = 0.0391; // -$01 + $60/256
const FRICTION_BIG = 0.0547;   // -$01 + $20/256
const SKID = 0.125;            // $02
const JUMP_BASE = -3.5;        // -$38
/** Player_SpeedJumpInc: extra lift per whole pixel/frame of ground speed. */
const JUMP_SPEED_BONUS = [0, 0.125, 0.25, 0.5];
/**
 * Tallauspomppu, ja se on tarkoituksella **isompi kuin oma hyppy**.
 *
 * Mitattu oikealla moottorilla (`scratchpad/bounce.mjs`, sama tapa kuin
 * `tools/measure-jump.mjs`): lähtönopeudella -4,0 pomppu nousi napin ollessa
 * pohjassa **100 px**, ja pelaajan oma täyden vauhdin juoksuhyppy nousee
 * saman **100 px**. Vihollisen päältä ponnistaminen ei siis antanut mitään
 * mitä hyppy ei antanut jo — se oli vain hyppy jonka aloitti joku muu.
 *
 * -4,5 nostaa sen 134 px:ään eli kolmanneksen oman hypyn yli, ja napin
 * vapaana 24 px:stä 30 px:ään. Ero on nyt luettava ilman mittaria: kaksi
 * vihollista päällekkäin on reitti, yksi vihollinen on oikaisu.
 *
 * -5,0 mitattiin myös (172 px) ja hylättiin: se on käytännössä pelin paras
 * hyppy (174 px), eli se tekisi jokaisesta vihollisesta oven kattoon.
 */
const STOMP_BOUNCE = -4.5;
const TAIL_FLOAT = 1.0;        // PLAYER_TAILWAG_YVEL $10
const FLIGHT_CLIMB = -1.5;     // PLAYER_FLY_YVEL -$18
/*
 * SMB3 has neither coyote time nor jump buffering: a press one frame early or
 * one frame late is simply gone. That is faithful, and on a CRT with a wired
 * pad it is fine. On a modern setup — wireless keyboard, compositor, LCD — the
 * same rule turns into "the game ignored me", so both forgivenesses are here
 * as a deliberate deviation from the original. They are small enough that a
 * frame-perfect player will never notice them.
 */
const COYOTE_FRAMES = 5;
const JUMP_BUFFER_FRAMES = 6;

/**
 * PIERUPOMPUN JÄÄHDYTYS — se yksi luku joka tekee panoksista panoksia.
 *
 * Omistajan päätös 16.8.2026: ilmahypyt ovat **kuluvia panoksia joita ei saa
 * peräkkäin**. Määrä jää voimatasoon kiinni (`airJumpsMax`), eli taso 5 on yhä
 * enemmän kuin taso 1; muuttunut on se ettei niitä voi ladata yhdeksi kaareksi.
 *
 * **Miksi tämä ylipäätään tarvittiin.** Kenttägeometria on hinnoiteltu *yhtä*
 * hyppyä vasten: kuilubudjetti on 6 ruutua eli 96 px, ja mitattu juoksuhypyn
 * kantama on 155 px (PHYSICS.md). Viidellä peräkkäisellä ponnistuksella pelin
 * levein kuilu (`softGapTiles` 9) on lyhyempi kuin yksi ponnistus — eli palkinto
 * ei tehnyt hypystä parempaa vaan poisti kysymyksen. Sitä ei voi hinnoitella
 * kuilun leveydellä, koska kuilu ei tiedä montako ponnistusta pelaajalla on.
 *
 * **Miksi 40 framea, ja miksi se on johdettu eikä valittu.** Pieruhyppy asettaa
 * `vy = -4.3`, ja nousu kestää niin kauan kuin nappi on pohjassa ja `vy` alle
 * `GRAVITY_HELD_CUTOFF`in (-2,0): 2,3 / 0,0625 = 37 framea, ja loput 2,0
 * tavallisella painovoimalla noin 6 framea. Huippu on siis noin 43 framen
 * päässä. Neljäkymmentä framea tarkoittaa että **toinen panos on käytettävissä
 * vasta ensimmäisen huipun tuntumassa** — se voi napata putoamisen kiinni,
 * muttei kasata korkeutta edellisen päälle. Panos on pelastus, ei lento.
 *
 * **Mitä tämä tarkoituksella EI muuta:** yksi pieruhyppy on merkilleen sama
 * kuin ennen. `tools/jump-budget.json`in tapaus "juoksu + pieruhyppy" (174 px
 * nousua, 285 px kantamaa) on se luku josta `softGapTiles` on johdettu ja jota
 * vasten jokainen kenttä on validoitu, joten sen liikkuminen olisi liikuttanut
 * kaikkien kenttien sääntöjä. Jäähdytys alkaa vasta ensimmäisestä panoksesta.
 */
const AIR_JUMP_CD = 40;

/**
 * ...JA SE MITÄ KETJUTTAMINEN MAKSAA, koska jäähdytys yksin ei riittänyt.
 *
 * Jäähdytys kesytti korkeuden mutta ei kantamaa, ja **kantama on se luku jota
 * vasten kentät on hinnoiteltu.** Mitattuna, sama juoksu ja sama napinhakkaus:
 * yhdellä panoksella 124 px ylös ja 205 px sivuun, viidellä 165 px ylös ja
 * **402 px sivuun**. Korkeuseroa 41 px, kantamaeroa 197 px — eli kaksitoista
 * ruutua siinä missä koko kuilubudjetti on kuusi.
 *
 * **Yksi korjausyritys mitattiin ja se oli väärä, ja se kannattaa lukea ennen
 * kuin joku keksii sen uudelleen.** Ensin panokselle annettiin hinnaksi
 * vaakavauhtia (`vx *= 0.55`), perusteluna että alaspäin purkava kaasu ei saa
 * työntää eteenpäin. Se kuulosti oikealta ja teki asian **pahemmaksi**:
 * kantama nousi 402:sta 554:ään. Syy on että tässä pelissä on ilmaohjaus —
 * `ACC` toimii myös ilmassa — joten leikattu vauhti palaa kattoon
 * neljässäkymmenessä framessa, ja ainoa mitä leikkaus sai aikaan oli pidempi
 * kaari (160 framesta 240:een). **Kantaman ajuri ei ole vauhti vaan ilma-aika.**
 *
 * Siksi hinta on nosto: jokainen panos nostaa `AIR_JUMP_DECAY`n verran
 * edellistä vähemmän, eli ketju suppenee eikä jatka kaarta loputtomiin.
 * Ensimmäinen panos on tasan entisensä, ja se on ehto eikä armo: mitattu
 * "juoksu + pieruhyppy" (174 px nousua, 285 px kantamaa) on se tapaus josta
 * `softGapTiles` on johdettu ja jota vasten jokainen kenttä on validoitu.
 * Toisesta eteenpäin ei liikuta mitään, koska mikään mitattu tapaus ei käytä
 * kahta.
 */
const AIR_JUMP_DECAY = 0.5;
/** Ensimmäisen panoksen nosto. Mitattu tapaus "juoksu + pieruhyppy" lepää tässä. */
const FART_LIFT = -4.3;

/*
 * MAAHANISKU — the ground pound. Down + jump in the air, and the gas that
 * normally lifts him instead shoves him at the floor.
 *
 * The whole move is an argument about price, so the constants are the argument.
 * The stomp is this game's basic verb: it kills, it bounces you clear, and you
 * keep every pixel of steering while it happens. A ground pound that was simply
 * bigger would end the stomp's career on the day it shipped, so this one buys
 * its width and its noise with time in which the player is not driving:
 *
 *   POUND_CHARGE  frames hanging still in the air before the drop. It is also
 *                 the telegraph — the one moment anything on screen has to
 *                 read the move and get out from under it.
 *   POUND_SPEED   the dive, and it is a constant rather than gravity because
 *                 the fiction is a push and not a fall. Nearly twice TERMINAL
 *                 (4.0), so it visibly outruns anything else in the level that
 *                 is falling. Well under one tile per frame, so `moveY` cannot
 *                 skip a floor row: at 16 px a frame a dive would start passing
 *                 through planks.
 *   POUND_LAG_*   and then the landing, where he is stuck and — this is the
 *                 part that matters — *not* invulnerable. The window grows with
 *                 the height of the fall, so the version that hits hardest is
 *                 also the version that leaves you standing there longest. A
 *                 flat lag would have made the best case strictly the best.
 *
 * Nothing here is gated on a power level. Requirement, not preference: a
 * power-up opens places, not the level (DESIGN.md §5), so the base move works
 * at power 0 and the level only widens the reach and lowers the bar for the
 * shockwave — see `LevelScene.poundImpact`, which owns everything that happens
 * once the feet arrive.
 */
const POUND_CHARGE = 12;
const POUND_SPEED = 7.5;
const POUND_LAG_MIN = 16;
const POUND_LAG_RANGE = 20;

/*
 * JUOKSUHIEKKA — the desert's own hazard, and it is a *clock* rather than a
 * touch.
 *
 * The owner's decision of 9.8.2026, in his words: "something that slowly pulls
 * you under, but you get, like, several seconds worth of time to react to it."
 * Everything below is that sentence turned into numbers, and the numbers are
 * the design, so they are stated here with what each one buys:
 *
 *   QUICKSAND_SINK    px per frame downwards, and the only speed the sand
 *                     allows. It replaces gravity rather than fighting it, so a
 *                     body arriving at terminal velocity stops dead the frame
 *                     it touches — which is the whole "it caught me" reading.
 *                     0.16 px/frame is 9.6 px/s: visible, and slow enough that
 *                     the eye reads it as being pulled rather than as falling.
 *   QUICKSAND_GRACE   frames the head may stay under before it is over. This is
 *                     the *second* half of the several seconds and it exists so
 *                     that going under is a warning and not a verdict; the
 *                     first half is the sinking itself, which for the smallest
 *                     body is 17 px of travel. Measured end to end in
 *                     `verify.mjs` at roughly 195 frames — 3.2 s — from first
 *                     contact to death for a power-0 player who does nothing.
 *   QUICKSAND_KICK    the struggle. Weaker than JUMP_BASE (-3.5) on purpose:
 *                     the ordinary jump is *gone* in here, and getting out is
 *                     several kicks rather than one press. That is the lesson
 *                     the first pool teaches, and it is why the first pool has
 *                     to be one you cannot drown in.
 *   QUICKSAND_KICK_CD frames between kicks, so mashing has a ceiling and the
 *                     climb rate is a property of the sand and not of the pad.
 *   QUICKSAND_WADE    the horizontal cap. Well under MAX_WALK, so crossing is a
 *                     slog whichever direction you picked.
 *   QUICKSAND_PLUNGE_* what a ground pound costs in here. See `plungeIntoSand`.
 *
 * Death is geometric and not a timer on contact: it happens when the *whole
 * body* is under the surface. That is the one rule which makes the shallow pool
 * provably survivable — a body taller than the pool is deep can never have its
 * top below the rim, whatever it does — and it is why the teaching pool in 2-1
 * is one tile deep and the one in 2-3 is two.
 */
const QUICKSAND_SINK = 0.16;
const QUICKSAND_GRACE = 88;
const QUICKSAND_KICK = -2.6;
const QUICKSAND_KICK_CD = 8;
const QUICKSAND_WADE = 0.62;
const QUICKSAND_WADE_ACC = 0.08;
const QUICKSAND_PLUNGE_FRAMES = 20;
const QUICKSAND_PLUNGE_SINK = 1.7;

/**
 * PUDOTUKSEN PITUUS, JOTA VASTEN MAAHANISKU MITATAAN — 174 px.
 *
 * Se on **mitattu eikä valittu**: pelin pisin hyppy nousee 174 px
 * (PHYSICS.md, `tools/measure-jump.mjs`), eli se on suurin pudotus jonka
 * pelaaja voi omin voimin tuottaa tasamaalla. Täysi isku vaatii siis
 * täyden kaaren, ja tavallinen juoksuhyppy (100 px) tuottaa 0,57.
 */
const POUND_FULL_FALL = 174;

/**
 * How hard a dive landed, 0…1, and the one number the impact reads.
 *
 * **Pudotus pikseleinä, ei osuutena huoneen korkeudesta.** Tässä luki
 * `(toY - fromY) / toY`, ja perustelu oli kaunis: taivas on kansi, joten
 * suurin mahdollinen pudotus on `toY` itse, eikä vakiota tarvita. Se on totta
 * ja se on silti väärä mitta, koska se tekee **samasta hypystä eri iskun sen
 * mukaan missä päin kenttää seisoo**: 100 px pudotus lattialle y=208 antaa
 * 0,48, ja sama hyppy luolakaistassa lattialle y=650 antaa 0,15. Omistaja
 * pyysi iskua joka on sitä voimakkaampi mitä korkeammalta pomppaa; se oli jo
 * olemassa, mutta se mittasi väärää asiaa.
 *
 * Nyt nimittäjä on se mitä pelaaja voi tehdä (`POUND_FULL_FALL`) eikä se missä
 * hän sattuu olemaan. Kynnykset pysyvät siellä missä ne mitattiin: tappaminen
 * 0,5 on 87 px pudotus ja tiilen rikkominen 0,72 on 125 px — jälkimmäinen on
 * sama luku joka `POUND_BREAK_AT`in perustelussa jo lukee (~130 px), eli
 * tavallisen kentän lattialla mikään ei muutu. Muuttunut on se että se pätee
 * nyt myös luolassa ja pystykentässä.
 *
 * Both arguments are the *top* of the body, so the height of the player cancels
 * out of both sides and a big Pieruprinssi and a small one measure the same
 * jump identically.
 */
export function poundScale(fromY, toY) {
  if (!(toY > 0)) return 0;
  return Math.max(0, Math.min(1, (toY - fromY) / POUND_FULL_FALL));
}

/*
 * Beanstalk climbing. Constant speeds, no acceleration and no gravity: a vine
 * is a place where the physics stop, which is what makes it read as climbing
 * rather than as slow flying. Sideways movement is deliberately kept — without
 * it you could climb to the top of a vine and have no way off it but a jump.
 */
const CLIMB_SPEED = 1.1;
const CLIMB_SIDE = 0.75;

export const P_METER_MAX = 112;
const P_SEGMENTS = 7;
/** 7 segments, 8 frames each to fill and 24 each to drain. */
const P_FILL = P_METER_MAX / P_SEGMENTS / 8;
const P_DRAIN = P_METER_MAX / P_SEGMENTS / 24;

/*
 * PAINE NÄKYY KEHOSSA. Vauhtimittari on tähän asti ollut pelkkä nauhan palkki,
 * eli lukema jonka lukeminen vaatii katseen pois kentästä juuri siinä hetkessä
 * jossa katse on tarpeen kentässä. Tämä on sen sama lukema maailman puolella:
 * mitä täydempi mittari, sitä tiheämpi ja isompi kaasusuihku kantapäiden
 * takana.
 *
 * Miksi juuri tämä pelinsisäinen kuva eikä jokin muu: pelin voima **on**
 * kaasua. Suihku ei ole kuvake joka pitää opetella vaan sama asia jonka
 * pelaaja on jo nähnyt pieruhypyssä ja maahaniskussa — mittari ei siis saa
 * uutta kieltä vaan lakkaa olemasta oma kielensä.
 *
 * Kolme rajaa, ja jokainen on päätös:
 *
 *   - **Kävely ei savua.** Suihku alkaa vasta `PLUME_START`ista eli reilusti
 *     yli kolmanneksen mittarista. Alempaa se olisi taustakohinaa, ja mittari
 *     joka näyttää samalta aina ei näytä mitään.
 *   - **Vain maassa.** Ilmassa mittari on jäädytetty (ks. yllä), joten ilmassa
 *     savuava keho valehtelisi kasvavasta paineesta. Lento ja pieruhyppy
 *     tekevät omat pilvensä omista syistään.
 *   - **Ummetus ei savua.** `corked` on tila jossa kaasu ei kulje, ja se on
 *     ensimmäinen paikka jossa se pitää näkyä. Nauhan lähtölaskenta kertoo
 *     kuinka kauan; keho kertoo *mistä* siinä on kyse.
 */
/*
 * RINNE MUUTTAA VAUHTIA, EI KIIHTYVYYTTÄ.
 *
 * Omistajan tuomio 10.8.2026 (IDEAS.md kohta 1, koko listan vahvin): *"Slopes
 * turn into speed is a VERY good idea, because Mario does sliding on slopes and
 * this would be different."* Mariossa rinne on liikkeen laatu — luiskahdus,
 * joka on itsessään palkinto. Tässä rinne on **muunnin**: vaakavauhti
 * vaihdetaan korkeudeksi, ja korkeus on pääsy ylemmälle reitille.
 *
 * Kolme päätöstä, ja kaksi ensimmäistä ovat rajoja jotka olivat olemassa jo
 * ennen rinteitä:
 *
 *   1. **`ACC` ei muutu.** Kiihtyvyys on tässä pelissä yksi vakio sekä
 *      kävelylle että juoksulle (PHYSICS.md: B ei kiihdytä, se nostaa kattoa),
 *      ja sama päätös tehtiin uudestaan jäälle. Rinne ei kosketa siihen: se
 *      lisää **painovoiman komponentin pintaa pitkin**, mikä on eri asia ja
 *      myös se mikä rinne fysiikassa oikeasti on.
 *   2. **Katto on `MAX_P`.** Alamäki voi *lainata* pelin ylimmän nopeuden
 *      (3,5) ilman täyttä mittaria, muttei ylittää sitä. Tämä on se kohta
 *      jossa "ei täysi Sonic" on luku eikä mielipide.
 *   3. **Alamäki maksaa enemmän kuin ylämäki vie** (0,14 vs 0,045), ja
 *      ylämäen luvun on oltava **pienempi kuin `ACC`** (0,0547). Se ei ole
 *      makuasia vaan ehto: yhtä suuri tai suurempi tarkoittaa että kävelijä
 *      hidastuu rinteessä nollaan eikä pääse ylös lainkaan. Ensimmäinen
 *      versio oli 0,06 ja portti löysi sen heti — botti jäi 1-1:n kumpareen
 *      juureen 28 %:iin kentästä. Alamäki on tarkoituksella selvästi isompi:
 *      symmetrinen rinne olisi vero, ja veroa ei kannata juosta alas.
 *
 * Lähtö rinteen huipulta on se varsinainen muunnin: `SLOPE_LAUNCH` kertaa
 * vaakavauhti nousuksi, ja pohjassa pidetty hyppynappi saa saman kevyen
 * painovoiman kuin hypyssä. Siksi lopputulos ei ole lineaarinen vaan
 * portaittainen: juoksuvauhdilla se on hyppy, täydellä mittarilla se on reitti.
 *
 * `SLOPE_LAUNCH_MIN` on 1,8 eikä juoksukatto 2,5, ja se on **mitattu eikä
 * valittu**: nousu maksaa vauhtia (`SLOPE_UP`), joten juoksukatolla rinteeseen
 * tullut on huipulla 2,27 — juoksukattoon sidottu raja ei olisi lauennut
 * kertaakaan ilman täyttä mittaria. 1,8 on kävelykaton (1,5) yläpuolella, eli
 * kävelijää rinne ei heitä minnekään ja se on tarkoitus.
 */
/*
 * Kuinka pitkä tauko lataa laukauksen. 90 framea eli puolitoista sekuntia:
 * pidempi kuin yksikään taistelutauko (kaksi vihollista peräkkäin ammutaan
 * nopeammin) ja lyhyempi kuin yksikään siirtymä, eli ladattu pallo on se jolla
 * *aloitetaan* ja tavallinen se jolla jatketaan.
 */
const CHARGE_FRAMES = 90;

const SLOPE_DOWN = 0.14;
const SLOPE_UP = 0.045;
const SLOPE_LAUNCH = 0.85;
const SLOPE_LAUNCH_MIN = MAX_WALK + 0.3;

const PLUME_START = 0.38;
/** Framen väli suihkun purskeiden välissä, alarajalla ja täydellä mittarilla. */
const PLUME_SLOW = 10;
const PLUME_FAST = 2;

/*
 * Supertähti. Long enough to be worth having — about twelve seconds, three or
 * four chunks at a run — and short enough that the level is not handed over.
 *
 * It is not a power level and never touches one: it protects you from enemies
 * and from nothing else, so losing it costs you nothing you had before.
 */
export const STAR_FRAMES = 700;

/**
 * VAHINKOVÄLÄHDYKSEN PITUUS, frameina.
 *
 * Kymmenen framea eli kuudesosasekunti: pitkä tarpeeksi nähtäväksi, lyhyt
 * tarpeeksi ollakseen tapahtuma eikä tila. Kentän puoli lukee tämän
 * (`scenes/level.js`, `PALETTE`) eikä kirjoita omaa lukuaan — välähdys joka
 * kestäisi eri ajan kuin laskuri olisi kahdesta paikasta mitattu sama asia.
 */
export const HURT_FLASH = 10;

export const MAX_POWER_LEVEL = 5;
/*
 * The fourth type is PAUKKUPAPU, the breaking power-up: a bean fermented so
 * hard that the pressure inside carries through a shoulder, and a brick wall
 * run into from the side bursts instead of stopping you.
 *
 * It is deliberately NOT in `LevelScene.rollPowerup`, so no question block, no
 * secret brick and no moon can ever hand it over. The only thing in the game
 * that gives it is the pair of papuparoonit in 2-M — see enemies.js. That is a
 * rule and not a coincidence: a reward you can also stumble into is not a
 * reason to take the harder branch of the map, and the branch is the whole
 * point of the fight existing.
 *
 * The key is 'pop' rather than 'bean' because `normalizePower` already spends
 * 'bean' on old saves, where it meant the plain mushroom.
 */
export const POWER_TYPES = ['shroom', 'flower', 'leaf', 'pop'];
export const POWER_NAMES = {
  shroom: 'PIERUSIENI',
  flower: 'PIERUKUKKA',
  leaf: 'KAASULEHTI',
  pop: 'PAUKKUPAPU',
};

/** Power-ups stack: the level drives both body size and ability strength. */
export const makePower = (type = null, level = 0) => ({ type, level });

/** Accepts old string saves as well as the current {type, level} shape. */
export function normalizePower(power) {
  if (!power) return makePower();
  if (typeof power === 'string') {
    if (power === 'small') return makePower();
    if (power === 'big' || power === 'bean' || power === 'shroom') return makePower('shroom', 1);
    return makePower(power, 1);
  }
  const level = Math.max(0, Math.min(MAX_POWER_LEVEL, power.level | 0));
  return makePower(level === 0 ? null : power.type, level);
}

/** Pure power-up rule, shared by the level and the world map inventory. */
export function powerAfterItem(power, kind) {
  const p = normalizePower(power);
  if (kind === 'soup') {
    return makePower(p.type || 'shroom', Math.min(MAX_POWER_LEVEL, p.level + 1));
  }
  if (POWER_TYPES.includes(kind)) {
    return makePower(kind, Math.min(MAX_POWER_LEVEL, p.level + 1));
  }
  return p;
}

export class Player extends Entity {
  constructor(level, x, y, power) {
    super(level, x, y, PLAYER_SIZES[0].w, PLAYER_SIZES[0].h);
    this.kind = 'player';
    this.alwaysActive = true;
    this.active = true;
    this.power = normalizePower(power);
    this.facing = 1;
    this.ducking = false;
    this.pMeter = 0;
    /* Minkä suuntaisessa rinteessä keho on juuri nyt (1 nousee oikealle, -1
     * vasemmalle, 0 ei rinnettä). `moveY` kirjoittaa, `slopePull` lukee. */
    this.onSlope = 0;
    /* Frameja jäljellä hätää, ks. `panicking` yllä. Tavallinen kenttä, joten
     * `savestate.js` kantaa sen ilman omaa riviä. */
    this.panic = 0;
    /* Ks. `update`: mittari framen alussa, ja vain vilkaisu lukee sitä. */
    this.pFullEntry = false;
    /* Onko täyden mittarin etu voimassa juuri nyt — ja tämä on kenttä eikä
     * johdannainen, koska se on **edellisen framen** vastaus: merkki syntyy
     * reunasta eikä tilasta. Tavallinen oma ominaisuus, joten `savestate.js`
     * kantaa sen mukanaan eikä pikalataus soita merkkiä uudestaan. */
    this.pBoost = false;
    this.idle = 0;
    this.jumpBuffer = 0;
    this.flying = 0;
    this.spin = 0;
    this.invuln = 0;
    /*
     * SUUSSA OLEVA KYKY, kaksi tavallista kenttää eikä oliota.
     *
     * `swallowKind` on mikä ja `swallowTimer` kuinka kauan. Kaksi lukua eikä
     * `{ kind, frames }`, koska `savestate.js` sarjallistaa jokaisen oman
     * kentän sellaisenaan — pikatallennus keskellä kykyä palauttaa sen
     * jäljellä olevine frameineen ilman riviäkään tallennuskoodia, ja juuri se
     * on tässä tiedostossa jo kolmesti todettu halvin tapa.
     */
    this.swallowKind = null;
    this.swallowTimer = 0;
    this.frozen = 0;
    this.corked = 0;
    this.star = 0;
    /* Vahinkovälähdyksen laskuri. Puhtaasti kuvaa, ja siksi sama laskuri
     * kelpaa myös palautetulle tallennukselle: nolla tarkoittaa "ei mitään
     * juuri nyt", mikä on tosi jokaisella latauksella. */
    this.hurtFlash = 0;
    this.airJumps = 0;
    /* Frameja seuraavaan panokseen. Tavallinen luku ja konstruktorissa, kuten
     * `sunk` ja `drift` viholliselle: `savestate.js` sarjallistaa sen itse. */
    this.airJumpCd = 0;
    this.dying = false;
    /** Kuoleman oma kello, ks. `die` ja `deathPose`. */
    this.deathT = 0;
    this.animTimer = 0;
    this.animFrame = 0;
    this.wag = 0;
    this.autoWalk = false;
    this.controllable = true;
    this.jumpHeld = false;
    this.coyote = 0;
    /* The size change is already frozen for a few frames; this is what those
     * frames are for. `morphFrom` is the body he had a moment ago, and the
     * drawing alternates between the two so the change reads as a change
     * rather than as a sprite that was swapped while nobody was looking. */
    this.morphFrom = 0;
    this.morphTimer = 0;
    this.climbing = false;
    /* The ground pound, as three plain fields rather than one clever one.
     *
     * `poundPhase` is '' | 'charge' | 'dive' | 'lag', `poundTimer` counts the
     * two phases that end on a clock, and `poundFromY` is the height the dive
     * was committed at — the thing the roadmap says has to be remembered,
     * because without it "the higher the fall, the harder it hits" has nothing
     * to measure. Numbers and a string on purpose: `savestate.js` serialises
     * every own property of every entity, so a snapshot taken in mid-dive comes
     * back in mid-dive without a line of save code, and the restored player
     * finishes the same dive from the same remembered height. */
    this.poundPhase = '';
    this.poundTimer = 0;
    this.poundFromY = 0;
    /* Juoksuhiekka, as three plain numbers for the same reason the dive above
     * is three: `savestate.js` serialises every own property of every entity,
     * so a snapshot taken mid-sink comes back mid-sink with the same frames
     * already spent under the surface and the same dive still burying him. A
     * clever single field, or state parked on the scene, would both have needed
     * save code — and the version that needs save code is the version that gets
     * it wrong the first time somebody quicksaves in the wrong second.
     *
     * `sunk` counts frames with the whole body under the surface; `kickCd` is
     * the struggle cooldown; `plunge` is what is left of a ground pound's extra
     * burial. */
    this.sunk = 0;
    this.kickCd = 0;
    this.plunge = 0;
    /* Frames before a warp pipe will take this player anywhere again. Without
     * it, holding the button on arrival sends you straight back.
     *
     * It is **not** the thing that stops you acting mid-warp and never was —
     * it counts down while you are running around perfectly in control. That
     * is `transit`, below, and the two are separate because they answer
     * different questions: one is "may this pipe fire", the other is "is there
     * a player in the room at all". */
    this.warpLock = 0;
    /* Set while the body is inside something — a pipe, the fortress door. The
     * scene drives it (`LevelScene.updateTransit`); this class only stands
     * aside. A plain object of numbers on purpose: `savestate.js` serialises
     * every own property of every entity, so a snapshot taken mid-transit
     * carries it without a line of save code. */
    this.transit = null;
    this.applySize();
    this.y = y - this.h;   // spawn standing on the given tile top
  }

  // NB: `this.level` is the LevelScene (from Entity) — the power level lives here.
  get powerLevel() { return this.power.level; }
  get type() { return this.power.type; }
  get big() { return this.power.level > 0; }
  get pFull() { return this.pMeter >= P_METER_MAX; }
  get pBars() { return Math.min(P_SEGMENTS, Math.floor(this.pMeter / (P_METER_MAX / P_SEGMENTS))); }

  /** Extra mid-air jumps granted by the fart mushroom, one per level. */
  /*
   * VERBI 6: NIELTY VIHOLLINEN ON TYÖKALU — ja tässä on se yksi rivi jolla se
   * koskee hyppyyn.
   *
   * IDEAS kohta 6 (tuomio "kyllä"): *"syö vihollinen, saat kyvyn — piikkiukko
   * tekee piikikkääksi, lentäjä antaa hypyn — eli jokaisesta lajista tulee
   * työkalu."* Siivet ovat se osa jonka lentävät lajit antavat, ja se on
   * **yksi ilmahyppy lisää** eikä uusi lentotila: pierupompun talous on
   * mitattu ja hinnoiteltu (`AIR_JUMP_CD`), ja uusi hyppytapa olisi uusi
   * talous. Lisäys nollan päälle on kuitenkin sekin lisäys — voimatasolla 0
   * nielty lentäjä antaa siis sen ainoan ilmahypyn, mikä on juuri se hetki
   * jolloin lahja tuntuu eniten.
   */
  get airJumpsMax() {
    const base = this.type === 'shroom' && !this.corked ? this.power.level : 0;
    return base + (this.swallowed === 'siivet' && !this.corked ? 1 : 0);
  }

  /** Mikä kyky suussa on juuri nyt, tai `null`. Ks. `swallow`. */
  get swallowed() { return this.swallowTimer > 0 ? this.swallowKind : null; }

  /** True from the moment down + jump is taken until he can steer again. */
  get pounding() { return this.poundPhase !== ''; }

  /** Reported for the tests and the HUD-less picture; the physics use the y. */
  get inQuicksand() { return this.quicksandSurface() !== null; }

  /* `quicksandSurface()` is on `Entity` — it used to be here, and it moved the
   * day the enemies had to sink too. The comment on it says why. */

  /**
   * Whether running into a brick from the side breaks it. Ummetus stops it for
   * the same reason it stops the gas jump and the tail: the charge is pressure,
   * and a cork is a cork. It costs nothing to be blocked — see `smashThrough`,
   * where every tile this does not touch is listed.
   */
  get breaker() { return this.type === 'pop' && !this.corked; }
  get shotsPerPress() { return this.power.level >= 5 ? 3 : this.power.level >= 3 ? 2 : 1; }
  /*
   * KAKSI PALLOA ILMASSA, EI ENEMPÄÄ (17.8.2026).
   *
   * Katto oli `2 + power.level`, eli täydellä tasolla seitsemän — ja kolme per
   * painallus. Se teki kukasta ruiskun: ruudulla oli pysyvästi pallomatto, ja
   * kun kaikki kuolee ilman että mitään tarvitsee tähdätä, aseesta tulee
   * painike jolla huone tyhjenee. Sama vika kuin karkaavassa kuoressa, eri
   * kulmasta.
   *
   * Kaksi on luku jolla ase on yhä ase: yksi lentää, yksi on lähdössä. Taso ei
   * enää osta *määrää* vaan `shotsPerPress`in eli sen millaisen kuvion yksi
   * painallus tekee — ja se kuvio mahtuu nyt kattoon, eli korkeampi taso
   * tarkoittaa hajontaa eikä ruiskua.
   */
  get maxLiveShots() { return 2; }
  get tailReach() { return 10 + this.power.level * 2; }

  applySize() {
    const table = this.ducking && this.power.level > 0 ? PLAYER_DUCK_SIZES : PLAYER_SIZES;
    const box = table[this.power.level];
    const bottom = this.y + (this.h || box.h);
    this.w = box.w;
    this.h = box.h;
    this.y = bottom - this.h;
  }

  /** Extra reach of the tail spin, used for enemy hits. */
  get spinBox() {
    if (this.spin <= 0) return null;
    const reach = this.tailReach;
    return {
      x: this.facing > 0 ? this.x + this.w - 2 : this.x - reach + 2,
      y: this.y + this.h * 0.4,
      w: reach,
      h: this.h * 0.6,
    };
  }

  /**
   * The same swipe, measured against **tiles** instead of bodies.
   *
   * Same side, same reach, and the only difference is the height: an enemy is
   * caught by the part of the arc that would knock it over, and a wall is hit
   * by all of it. `spinBox` is deliberately the lower 60 % of the body, which
   * is right for a creature standing on the floor beside you and wrong for the
   * brick column you are standing next to — measured, a big player's spin box
   * covers exactly one row of `brick_wall`'s four, so a tail that used that box
   * would have taken the wall down one brick per spin and read as a bug.
   *
   * Kept as a second getter rather than by widening the first, because widening
   * it would also have widened what the tail *kills*, and that is a balance
   * change nobody asked for hiding inside a tile change.
   */
  get tailBox() {
    if (this.spin <= 0) return null;
    const reach = this.tailReach;
    return {
      x: this.facing > 0 ? this.x + this.w - 2 : this.x - reach + 2,
      y: this.y,
      w: reach,
      h: this.h,
    };
  }

  update(input) {
    this.tick++;
    /*
     * Mittari sellaisena kuin se oli framen alkaessa.
     *
     * Tämä on olemassa yhtä asiaa varten ja se asia on kaistan vilkaisu
     * (`LevelScene.tryPeek`): **se painallus joka maksaa mittarin myös jarruttaa
     * kehon**. Alas painaminen isolla keholla aloittaa kyykyn, kyykky jarruttaa
     * 1,4-kertaisella kitkalla, ja mittari luetaan vasta jarrutuksen jälkeen —
     * eli täyttä vauhtia juossut iso pelaaja olisi framen lopussa 2,38:ssa eikä
     * 2,5:ssä, mittari valuisi askeleen, ja vilkaisu ei lähtisi koskaan. Pieni
     * keho ei kyykisty, joten vika olisi ollut näkyvissä vain isona.
     *
     * Luetaan siis se mikä oli totta silloin kun nappi painettiin. Muut mittarin
     * lukijat (nopeuskatto, kaasulehden lento) lukevat elävää arvoa niin kuin
     * ennenkin — ne kysyvät "nytkö", tämä kysyy "silloinko".
     */
    this.pFullEntry = this.pFull;
    if (this.invuln > 0) this.invuln--;
    if (this.spin > 0) this.spin--;
    if (this.corked > 0) this.corked--;
    if (this.hurtFlash > 0) this.hurtFlash--;
    if (this.morphTimer > 0) this.morphTimer--;
    if (this.star > 0) this.star--;
    if (this.warpLock > 0) this.warpLock--;
    if (this.wag !== 0 || this.type === 'leaf') this.wag += this.flying > 0 ? 0.5 : 0.12;

    if (this.dying) {
      /* Kuoleman oma kello, ja se on erillinen `tick`istä samasta syystä kuin
       * `poundTimer`: piirros lukee vaihetta eikä ikää, ja kuolema alkaa
       * nollasta silloinkin kun keho on ollut kentässä kaksi minuuttia. */
      this.deathT++;
      if (this.deathT === DEATH_POP) this.popGas();
      this.vy = Math.min(this.vy + 0.32, 9);
      this.y += this.vy;
      return;
    }

    /* Inside a pipe or a doorway. No physics, no input, no attack, no size
     * change — the scene moves the body and nothing else does. The timers
     * above still run, because a star burning down while you take a shortcut
     * is the same star. */
    if (this.transit) {
      this.vx = 0;
      this.vy = 0;
      this.jumpBuffer = 0;
      this.flying = 0;
      this.spin = 0;
      return;
    }

    if (this.frozen > 0) {
      this.frozen--;
      this.vx = 0;
      this.vy = Math.min(this.vy + GRAVITY, TERMINAL);
      moveY(this, this.level);
      return;
    }

    /*
     * HÄTÄ VIE OHJAUKSEN MUTTEI PELIÄ (17.8.2026).
     *
     * Omistaja: *"tee monster, johon osuessaan pelaajahahmo menettää kontrolit
     * hetkiseksi: juostaan eteenpäin automaattisesti, pelaaja voi vain hyppiä
     * tai ampua kuplia."*
     *
     * `panic` on siis **osittainen** ohjauksen menetys, ja se on eri asia kuin
     * `controllable = false` (maali, kuolema, putki) jossa mitään ei voi tehdä.
     * Jalat menevät eteenpäin itsestään eikä suuntaa saa vaihtaa, mutta hyppy
     * ja laukaus toimivat — eli pelaajalla on kaksi työkalua ja ei jarrua.
     *
     * Se tekee vahingosta *tilanteen* eikä tappiota: hätä ei vie elämää eikä
     * voimatasoa, se vie sen mitä pelaaja juuri nyt aikoi tehdä. Ja koska
     * eteenpäin juokseminen on tässä pelissä aina suunta johon halutaan, hätä
     * ei ole rangaistus jota odotetaan vaan hetki jota kiirehditään.
     */
    if (this.panic > 0) this.panic--;
    const panicking = this.panic > 0 && this.controllable;
    const left = this.controllable && !panicking ? input.held.left : false;
    const right = this.controllable
      ? (panicking ? true : input.held.right || this.autoWalk)
      : this.autoWalk;
    const up = this.controllable ? input.held.up : false;
    const down = this.controllable ? input.held.down : false;
    /* Hädässä juostaan, ei kävellä: pakokauhu ei valitse vauhtia. */
    const run = this.controllable ? (panicking || input.held.run) : false;
    // A press is remembered for a few frames, so asking for a jump just before
    // landing gets you a jump on landing instead of nothing at all.
    if (this.controllable && input.pressed.jump) this.jumpBuffer = JUMP_BUFFER_FRAMES;
    else if (this.jumpBuffer > 0) this.jumpBuffer--;
    const jumpPressed = this.jumpBuffer > 0;
    const jumpHeld = this.controllable ? input.held.jump : false;

    /* ------------------------------ maahanisku ------------------------ */
    /*
     * Ahead of everything else, and it returns rather than falls through. A
     * dive is not a jump with a different velocity: while it runs, the player's
     * own walking, ducking, climbing, gravity, tail, gun and animation are
     * simply not happening, and that is exactly the price the move charges.
     * Expressing it as one early return is also the only way to be sure a later
     * edit further down cannot quietly hand steering back.
     *
     * Above the beanstalk in particular, because `down` is held throughout a
     * dive and mid-air `down` is also what grabs a vine. A dive that could be
     * caught halfway by a passing vine would end with the move stuck in its
     * dive phase for the rest of the level.
     */
    /* ------------------------------ juoksuhiekka ---------------------- */
    /*
     * Ahead of the dive and ahead of everything else, and it returns for the
     * same reason the dive does: in the sand the player's walking, jumping,
     * ducking, climbing and gravity are all replaced rather than modified, and
     * one early return is the only way to be sure a later edit further down
     * cannot quietly hand any of them back.
     *
     * Ahead of the dive *in particular*, because the dive is the interesting
     * case: a body that is already in the sand may not keep diving through it,
     * and a dive that reaches the sand is turned into a burial by
     * `plungeIntoSand` rather than being allowed to land.
     */
    const sand = this.quicksandSurface();
    if (sand !== null) {
      if (this.pounding) this.plungeIntoSand();
      this.updateQuicksand(sand, left, right, jumpPressed);
      return;
    }
    /* Out of it: the counters are dropped rather than decayed. Getting your
     * head back into the air is meant to be the whole answer, and a residue
     * that carried over from the last pool would make the second one unfair by
     * an amount nobody could see. */
    this.sunk = 0;
    this.plunge = 0;
    if (this.kickCd > 0) this.kickCd--;

    if (this.pounding) {
      this.updatePound();
      return;
    }
    if (this.canPound(down, jumpPressed)) {
      this.startPound();
      return;
    }

    /* ------------------------------- climbing ------------------------- */
    const vine = this.level.climbAt(this);
    if (this.climbing && jumpPressed) {
      /* Letting go is a jump from where you hang. It is handed to the ordinary
       * jump code rather than done here, so a vine cannot quietly become a
       * second kind of jump with its own height and its own sound. */
      this.climbing = false;
      this.coyote = COYOTE_FRAMES;
    } else if (this.climbing && !vine) {
      this.climbing = false;
    } else if (!this.climbing && vine && (up || (down && !this.onGround))) {
      // Up grabs; down only grabs in mid-air, or ducking at the foot of a vine
      // would climb instead.
      this.grabVine(vine);
    }

    if (this.climbing) {
      this.vy = (down ? CLIMB_SPEED : 0) - (up ? CLIMB_SPEED : 0);
      this.vx = ((right ? 1 : 0) - (left ? 1 : 0)) * CLIMB_SIDE;
      if (this.vx !== 0) this.facing = Math.sign(this.vx);
      moveX(this, this.level);
      // A vine passes through planks. Only rock stops a climb, or a platform
      // beside the vine would catch you on the way down and never let go.
      moveY(this, this.level, { dropThrough: true });
      // Climbing down onto solid ground is arriving, not still climbing.
      if (this.onGround) this.climbing = false;
      // Hands over hands, at the speed you are actually moving.
      if (this.vy !== 0) this.animFrame = Math.floor(this.tick / 8) % 2;
      return;
    }

    /* -------------------------------- ducking ------------------------- */
    const wantDuck = this.big && down && this.onGround;
    if (wantDuck !== this.ducking) {
      const wasDucking = this.ducking;
      this.ducking = wantDuck;
      if (wasDucking && this.headBlocked()) this.ducking = true;
      else this.applySize();
    }

    /* ------------------------------ horizontal ------------------------ */
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    const cap = this.pFull ? MAX_P : run ? MAX_RUN : MAX_WALK;
    /*
     * JÄÄ, pelaajan puolelta: maa kertoo kuinka paljon jarrua on jäljellä.
     *
     * **Laatta ja vain laatta.** `Enemy.surface` putoaa teemaan kun jalkojen
     * alla ei ole nimettyä ainetta; tämä ei putoa. Ero on tahallinen ja se on
     * koko syy siihen että jää on laatta: maailman 3 kahdeksan kenttää on
     * mitoitettu tavallisen kitkan varaan (`chunks/ice.js` laskee
     * `ice_crumble`n pysähtymismatkan luvuista 0,0391 ja 0,0547), joten teema
     * joka liu'uttaisi pelaajaa muuttaisi ne kaikki kerralla ja söisi juuri sen
     * marginaalin jonka DESIGN.md kohta 5 lupaa. Jää muuttaa ne kentät silloin
     * kun jäätä ladotaan niihin, ei ennen.
     *
     * Vain maassa, ja se on toinen puoli samaa lausetta: ilmassa `grip` on 1,
     * joten jäältä ponnistettu hyppy ohjautuu täsmälleen kuten mikä tahansa
     * hyppy. Ilmassa ei ole jäätä jota vasten liukua.
     */
    const ground = this.onGround ? surfaceUnder(this.level, this) : null;
    const grip = ground ? ground.grip : 1;
    const friction = (this.big ? FRICTION_BIG : FRICTION_SMALL) * grip;

    if (this.ducking) {
      this.vx = approach(this.vx, 0, friction * 1.4);
    } else if (dir !== 0) {
      /*
       * The skid rate is not a ground rule. In the disassembly the branch that
       * picks it (PRG008_ABB8: "Player is pressing left/right", INY INY, then
       * `AND Player_MoveLR` -> "suddenly reversed direction") never looks at
       * `Player_InAir`. The two things that *are* gated on being airborne are
       * both still below: plain friction with no direction held, and the bleed
       * back down to the speed cap.
       *
       * Requiring `onGround` here was measured as the reason a jump at speed
       * felt unavoidable. At the run cap the arc carries 155 px through the
       * air and only 24 px after landing, so nearly all of the reaction
       * happens mid-air — and mid-air was braking at 0.0547 instead of 0.125,
       * less than half the authority the same player has with his feet down.
       */
      const skidding = Math.sign(this.vx) === -dir && Math.abs(this.vx) > 0.2;
      /* `SKID` on jarru ja `ACC` ei, joten `grip` koskee vain edellistä. Se on
       * `SURFACES`in oma sääntö kirjoitettuna siihen yhteen kohtaan jossa
       * molemmat luvut ovat näkyvissä: jäällä ei ole vaikeaa lähteä vaan
       * kääntyä, ja kääntyminen on juuri tämä haara. */
      this.vx = approach(this.vx, cap * dir, skidding ? SKID * grip : ACC);
      if (Math.abs(this.vx) > cap && this.onGround) this.vx = approach(this.vx, cap * dir, 0.06);
      this.facing = dir;
    } else if (this.onGround) {
      // No air friction: let go of everything mid-jump and you keep your speed.
      this.vx = approach(this.vx, 0, friction);
    }
    this.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.vx));

    /* ------------------------------- P-meter -------------------------- */
    const atSpeed = Math.abs(this.vx) >= MAX_RUN - 0.05 && run;
    if (this.onGround) {
      this.pMeter = atSpeed
        ? Math.min(P_METER_MAX, this.pMeter + P_FILL)
        : Math.max(0, this.pMeter - P_DRAIN);
    } else if (this.flying > 0) {
      this.pMeter = Math.max(0, this.pMeter - P_DRAIN);   // flight burns the gauge
    }
    // Otherwise the gauge is frozen: SMB3 leaves it alone while you are airborne.
    this.ventPlume();

    /* -------------------------------- jump ---------------------------- */
    if (this.onGround) {
      this.coyote = COYOTE_FRAMES;
      this.airJumps = 0;
      /* Jäähdytys nollautuu maassa, ei vain laskuri. Muuten kaari joka alkaa
       * heti edellisen perään olisi rangaistu siitä mitä edellisessä tehtiin,
       * ja panos on tarkoitettu kuluvaksi kaarta kohti eikä sekuntia kohti. */
      this.airJumpCd = 0;
    } else if (this.coyote > 0) this.coyote--;
    if (this.airJumpCd > 0) this.airJumpCd--;

    const canFly = this.type === 'leaf' && this.pFull && !this.corked;
    if (jumpPressed && (this.onGround || this.coyote > 0)) {
      this.jumpBuffer = 0;
      this.vy = JUMP_BASE - JUMP_SPEED_BONUS[Math.min(3, Math.floor(Math.abs(this.vx)))];
      this.onGround = false;
      this.coyote = 0;
      this.jumpHeld = true;
      Sfx.play(this.big ? 'bigjump' : 'jump');
    } else if (jumpPressed && canFly && this.flying <= 0) {
      this.jumpBuffer = 0;
      this.flying = 180 + this.power.level * 30;     // take off
      this.vy = -2.6;
      Sfx.play('flight');
    } else if (jumpPressed && this.flying > 0) {
      this.vy = Math.max(FLIGHT_CLIMB, this.vy - 2.6);
      Sfx.play('flight');
    } else if (jumpPressed && this.airJumps < this.airJumpsMax && this.airJumpCd === 0) {
      this.jumpBuffer = 0;
      this.fartJump();
    }

    if (!jumpHeld) this.jumpHeld = false;

    if (this.flying > 0) {
      this.flying--;
      // Flight ends on landing or when the gauge runs dry.
      if (this.onGround || this.pMeter <= 0) this.flying = 0;
    }

    /* --------------------------- vauhdin reuna ------------------------ */
    /*
     * Kaksi asiaa muuttuu oikeasti kun mittari täyttyy — nopeuskatto MAX_RUN
     * -> MAX_P ja kaasulehdellä hypystä tulee lento — ja kumpikin oli tähän
     * asti asia jonka sai selville kokeilemalla. Reuna luetaan vasta täältä
     * eikä mittarin päivityksestä, ja **`flying` on osa etua eikä sen
     * jälkiä**: nousu tyhjentää mittaria heti, joten pelkkä `pFull`-reuna
     * olisi huutanut "meni" täsmälleen sillä framella jolla etu otettiin
     * käyttöön. Sama merkki kuuluu siis vasta kun lento loppuu, mikä on myös
     * se hetki jolla peli lakkaa kannattelemasta.
     *
     * Kuva ja ääni ovat yhdessä kohtauksen päässä (`LevelScene.onSpeedFull`),
     * koska DESIGN.md kohta 8 vaatii ne yhdessä ja vierekkäin kirjoitettu
     * pari ei unohdu puoliksi.
     */
    const boost = this.pFull || this.flying > 0;
    if (boost !== this.pBoost) {
      this.pBoost = boost;
      if (boost) this.level.onSpeedFull();
      else this.level.onSpeedSpent();
    }

    /* ------------------------------- gravity -------------------------- */
    let g = this.jumpHeld && this.vy < GRAVITY_HELD_CUTOFF ? GRAVITY_HELD : GRAVITY;
    if (this.flying > 0) g *= 0.45;
    this.vy = Math.min(this.vy + g, TERMINAL);
    // The tail lets you float down gently.
    if (this.type === 'leaf' && !this.corked && jumpHeld && this.vy > 1.1 && this.flying <= 0) {
      this.vy = Math.min(this.vy, TAIL_FLOAT);
      this.wag += 0.4;
    }

    /* -------------------------------- attack -------------------------- */
    if (this.controllable && input.pressed.run && !this.corked) {
      /*
       * Sylky ennen omaa asetta, ja se on tarkoituksellinen järjestys: nielty
       * ammus on **lainassa ja kuluu**, joten sen pitää lähteä ensin. Kukalla
       * on oma laukauksensa takaisin heti kun suu on tyhjä, eikä pelaaja voi
       * hukata sylkyään painamalla väärään aikaan.
       */
      if (this.swallowed === 'sylky') this.shoot();
      else if (this.type === 'flower') this.shoot();
      else if (this.type === 'leaf') {
        this.spin = 18;
        Sfx.play('squeak');
      }
    }

    /* -------------------------------- move ---------------------------- */
    /* Rinteen veto **ennen** liikettä ja lähtö sen jälkeen: veto on osa tätä
     * framea, lähtö on vastaus siihen mitä liike löysi. Ks. `SLOPE_DOWN`. */
    this.slopePull();
    const wasSlope = this.onSlope || 0;
    const chargeVx = this.vx;
    moveX(this, this.level);
    if (this.breaker && Math.abs(chargeVx) > 1.4 && this.vx === 0) this.smashThrough(chargeVx);
    moveY(this, this.level, {
      onHeadBump: (tx, ty) => this.level.bumpTile(tx, ty, this),
      dropThrough: down && !this.onGround,
    });
    this.slopeLaunch(wasSlope);

    /*
     * Nielty kyky kuluu ajassa, ja **kylmä maksaa jäljen jokaisesta
     * laskeutumisesta**: kuura jättää jälkeensä liukasta maata kävellessään,
     * ja se joka on niellyt kuuran tekee saman hyppiessään. Sama laki, sama
     * kello, sama sulaminen — kyky on lainattu eikä keksitty.
     */
    if (this.swallowTimer > 0) {
      this.swallowTimer--;
      if (this.swallowKind === 'kylmä' && this.onGround && this.level.frostTile) {
        this.level.frostTile(Math.floor(this.cx / TILE), Math.floor((this.y + this.h) / TILE));
      }
      if (this.swallowKind === 'magneetti' && this.level.pullCoins) this.level.pullCoins(this);
    }

    /* Ketju katkeaa maakosketukseen, ja se luetaan **liikkeen jälkeen**: se on
     * ainoa hetki jolla `onGround` kertoo tämän framen totuuden. Kohtauksesta
     * kysyttynä vastaus oli edellisen framen, ja mitattuna ketju jatkui yli
     * laskeutumisen (1. 100, 2. 200, maahan käynnin jälkeen 400).
     * Ks. `CHAIN_LADDER` `scenes/level.js`:ssä. */
    if (this.onGround) this.chain = 0;

    /* ------------------------------ animation ------------------------- */
    // How long the player has been standing perfectly still, which is what
    // drives the idle performance in the sprite.
    if (this.onGround && Math.abs(this.vx) < 0.05 && dir === 0 && !this.ducking) this.idle++;
    else this.idle = 0;
    /* …and the second tier of that performance ends the moment anything comes
     * near, in one frame and mid-cycle, exactly as the attract demo hands the
     * machine back. It adds particles and takes the eye, so a player who looks
     * up to find an enemy arriving must never also have to wait for a gag to
     * finish. Only asked once the clock is nearly up, so the ordinary case
     * costs nothing. */
    if (this.idle >= DEEP_IDLE - 60 && this.threatNear()) this.idle = 0;

    const speed = Math.abs(this.vx);
    if (this.onGround && speed > 0.1) {
      /*
       * `* WALK_FRAMES / 3` keeps the cadence the frame order changed. Contacts
       * used to fall 1 and 2 advances apart in a three-frame cycle — 1.5 on
       * average, and uneven, which is the stutter — and fall 2 apart in the
       * four-frame one. Left alone that is a third fewer steps for the same
       * ground speed: measured at the walk cap it is 6.8 px of travel per step
       * against a 7 px gap between the boot prints, which is as close to not
       * sliding as this sprite gets, and 9.1 px against the same 7 px if the
       * rate is not scaled with the cycle.
       */
      this.animTimer += (0.12 + speed * 0.14) * (WALK_FRAMES / 3);
      if (this.animTimer >= 1) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % WALK_FRAMES;
      }
    } else if (this.onGround) {
      this.animFrame = 0;
    }
  }

  /**
   * Anything in the room that could be on top of him shortly. Six tiles is
   * about a second and a half of walker at full tilt — far enough that the
   * performance is over before the thing that ended it arrives, close enough
   * that it does not fire at everything on the screen.
   */
  threatNear() {
    const list = this.level && this.level.entities;
    if (!list) return false;
    for (const e of list) {
      if (e === this || e.remove || !e.active) continue;
      if (e.kind !== 'enemy' && e.kind !== 'hazard' && e.kind !== 'projectile') continue;
      if (Math.abs(e.cx - this.cx) < 96 && Math.abs(e.cy - this.cy) < 64) return true;
    }
    return false;
  }

  /**
   * Takes hold of a beanstalk. Snapping to the middle of the column is what
   * makes a vine feel like one thing instead of a strip you keep sliding off.
   */
  grabVine(vine) {
    this.climbing = true;
    if (this.ducking) {
      this.ducking = false;
      this.applySize();
    }
    this.x = vine.tx * 16 + (16 - this.w) / 2;
    this.vx = 0;
    this.vy = 0;
    this.flying = 0;
    this.onGround = false;
  }

  /**
   * Whether down + jump starts a dive this frame.
   *
   * The airborne test is what keeps the move from stealing the duck: on the
   * ground the same two buttons are still crouch-and-jump, which is where they
   * have always been. Climbing is excluded because a vine is a place where the
   * physics stop and `down` there means "climb down".
   *
   * Ummetus blocks it for the same reason it blocks the gas jump, the tail and
   * the shoulder charge: the dive is a fart, and a cork is a cork. That is not
   * a power gate and does not touch the promise in DESIGN.md §5 — a cork is a
   * timer somebody put on you, not a level you failed to collect, and the move
   * works at power 0 the moment it runs out.
   */
  canPound(down, jumpPressed) {
    if (!this.controllable || !down || !jumpPressed) return false;
    if (this.onGround || this.climbing || this.frozen > 0 || this.corked) return false;
    return true;
  }

  /**
   * Commits to the dive: hangs, and remembers how high the hanging happened.
   *
   * The height is taken here rather than when the drop starts even though the
   * body does not move in between, because *this* is the frame the player chose
   * — and if a later change ever lets something nudge him during the wind-up,
   * the measurement should still be the height he was looking at when he
   * pressed, not the one the nudge left him at.
   */
  startPound() {
    this.poundPhase = 'charge';
    this.poundTimer = POUND_CHARGE;
    this.poundFromY = this.y;
    this.vx = 0;
    this.vy = 0;
    // Everything else the gas was doing stops. A tail float or a flight that
    // survived into the dive would be a way of steering it.
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    this.flying = 0;
    this.spin = 0;
    Sfx.play('dive');
  }

  updatePound() {
    /* A press held or repeated through the unsteerable window must not be
     * waiting when it ends: the buffer exists so a jump asked for just before
     * landing is not lost, and the whole point here is that this landing costs
     * you the frames. */
    this.jumpBuffer = 0;
    this.vx = 0;

    if (this.poundPhase === 'charge') {
      // Held exactly still, not slowed: a body that drifted during the wind-up
      // would make the remembered height a lie by the time it is used.
      this.y = this.poundFromY;
      this.vy = 0;
      if (--this.poundTimer <= 0) {
        this.poundPhase = 'dive';
        this.level.spawnPuff(this.cx, this.y + this.h);
      }
      return;
    }

    if (this.poundPhase === 'dive') {
      this.vy = POUND_SPEED;
      /*
       * `dropThrough` is deliberately false even though `down` is certainly
       * held — it is what started this. Planks are dropped through by holding
       * down while falling, and a dive that kept that rule would sail through
       * the first platform under it every time, which makes the move unaimable
       * and hands the player a hole they did not ask for.
       */
      moveY(this, this.level, { dropThrough: false });
      // The gas he is riding down on, one puff every third frame: enough to
      // read as a jet, cheap enough that a long fall is not a particle storm.
      if (this.tick % 3 === 0) this.level.spawnPuff(this.cx, this.y + this.h - 2);
      /* Checked here and not only at the top of `update`, because the dive is
       * the one thing that can cross a whole tile of sand and reach the floor
       * under it inside a single frame. One frame late would mean a shockwave
       * thrown from the bottom of a pool, which is the sand failing to swallow
       * exactly the thing it is supposed to swallow. */
      if (this.quicksandSurface() !== null) {
        this.plungeIntoSand();
        return;
      }
      if (this.onGround) this.landPound();
      return;
    }

    /* The landing. Stuck, and pointedly not invulnerable: `invuln` is not
     * touched here and no tint is drawn, because a tint in this game means
     * "cannot be hurt" and this is the one moment the move promises you can
     * be. Gravity still runs so that pounding onto a crumbling plank drops
     * with it rather than leaving him standing on air. */
    this.vy = Math.min(this.vy + GRAVITY, TERMINAL);
    moveY(this, this.level);
    if (--this.poundTimer <= 0) this.poundPhase = '';
  }

  /** Feet down. The scene owns everything that happens next. */
  landPound() {
    const strength = poundScale(this.poundFromY, this.y);
    this.poundPhase = 'lag';
    this.poundTimer = Math.round(POUND_LAG_MIN + POUND_LAG_RANGE * strength);
    this.vy = 0;
    this.level.poundImpact(this, strength);
  }

  /**
   * One frame of being in the sand. Nothing else in `update` runs while this
   * does, so this is the whole player.
   *
   * @param {number} surface y of the top of the pool, from `quicksandSurface`
   */
  updateQuicksand(surface, left, right, jumpPressed) {
    const entering = this.sunk === 0 && this.vy > QUICKSAND_SINK;
    if (this.plunge > 0) this.plunge--;
    if (this.kickCd > 0) this.kickCd--;
    this.climbing = false;
    if (this.ducking) {
      this.ducking = false;
      this.applySize();
    }
    /* The picture and the sound of arriving, together (DESIGN.md §8), and only
     * on the frame the sand actually takes the speed away — walking in off a
     * rim at a crawl is not an event and must not fire one. */
    if (entering) {
      Sfx.play('upota');
      this.level.spawnPuff(this.cx, surface + 2, true);
    }

    /* Sideways. Slower than a walk and with its own acceleration, so the sand
     * is thick in both axes: a cap alone would let you reach it instantly and
     * the wading would only *look* slow. */
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (dir !== 0) {
      this.vx = approach(this.vx, QUICKSAND_WADE * dir, QUICKSAND_WADE_ACC);
      this.facing = dir;
    } else {
      this.vx = approach(this.vx, 0, QUICKSAND_WADE_ACC * 2);
    }

    /* The struggle, and it is the *only* thing the jump button does in here.
     * Replacing the jump rather than weakening it is the point: the move you
     * have relied on for two worlds is gone, and finding out what replaced it
     * is what the first pool is for. */
    if (jumpPressed && this.kickCd === 0) {
      this.jumpBuffer = 0;
      this.vy = QUICKSAND_KICK;
      this.kickCd = QUICKSAND_KICK_CD;
      this.plunge = 0;                       // one kick cancels a dive's burial
      Sfx.play('kahlaa');
      this.level.spawnPuff(this.cx, this.y + this.h, true);
    }

    /* Gravity still runs, but the sand decides how fast down is allowed to be.
     * Upwards is left alone: a kick has to carry, or the last one — the one
     * that has to put the feet over the rim — would be swallowed too. */
    const cap = this.plunge > 0 ? QUICKSAND_PLUNGE_SINK : QUICKSAND_SINK;
    this.vy = Math.min(this.vy + GRAVITY, cap);
    moveX(this, this.level);
    moveY(this, this.level);

    /*
     * And the one thing that kills. Under means the top of the body is below
     * the surface — geometry, not a timer on contact — so a pool shallower than
     * the body cannot ever do it, however long you stand in one. The `+ 1` is
     * not slack: a body resting on the floor of a pool exactly its own height
     * has its top on the rim to the pixel, and that must read as "standing in
     * it up to the neck" rather than as drowning.
     */
    if (this.y >= surface + 1) {
      if (++this.sunk >= QUICKSAND_GRACE) this.die('quicksand');
      // Grains thrown up from where he went under: the only sign left once the
      // body is below the rim, and the reason the surface keeps churning.
      if (this.sunk % 12 === 0) this.level.spawnPuff(this.cx, surface + 2, true);
    } else {
      this.sunk = 0;
    }
  }

  /**
   * A ground pound that reached the sand.
   *
   * The move's premise is that the higher you fall the harder you arrive, and
   * the honest reading of that over quicksand is the unkind one: you arrive
   * harder, so you go in deeper. So the dive is dropped where it is — no
   * shockwave, no lag, no landing, because the sand swallowed all of it — and
   * what is left of it is `plunge`, a few frames during which the sand's grip
   * is ten times weaker and the body drops the way it meant to.
   *
   * That is a real price and it is measured rather than described: in the deep
   * pool it takes roughly two fifths off the time between falling in and going
   * under, which is most of the reacting time the hazard promises. It is also
   * bounded by the level rather than by a number here — the plunge is speed and
   * not teleportation, so the floor of the pool still stops it, and the pool in
   * 2-1 stays one that cannot kill you even if you dive into it head first.
   *
   * A struggle cancels it (see `updateQuicksand`), because a player who reacts
   * has to get the reaction he paid for.
   */
  plungeIntoSand() {
    this.cancelPound();
    this.plunge = QUICKSAND_PLUNGE_FRAMES;
    this.vy = 0;
    Sfx.play('upota');
    this.level.spawnPuff(this.cx, this.y + this.h, true);
    this.level.shake(1.5);
  }

  /** Drops the move on the floor wherever it was. */
  cancelPound() {
    this.poundPhase = '';
    this.poundTimer = 0;
  }

  /** Mid-air fart jump: a burst of gas that also knocks out whatever is below. */
  fartJump() {
    this.airJumps++;
    this.airJumpCd = AIR_JUMP_CD;
    // Ensimmäinen panos on -4,3 kuten aina; jokainen seuraava puolet
    // edellisestä, jolloin ketju suppenee. Ks. `AIR_JUMP_DECAY`.
    this.vy = FART_LIFT * (AIR_JUMP_DECAY ** (this.airJumps - 1));
    this.jumpHeld = true;
    this.onGround = false;
    Sfx.play(this.power.level >= 3 ? 'bigfart' : 'fart');
    this.level.fartBlast(this.cx, this.y + this.h, 20 + this.power.level * 3, this);
  }

  /**
   * The breaking power-up: a wall run into at speed bursts.
   *
   * This used to be a perk of power level 4 and above, with no power-up behind
   * it, and that had to go rather than sit alongside the new one. Two doors to
   * the same ability would have made the fight in 2-M optional in the only way
   * that matters — a bowl of pea soup would have handed you the reward for
   * beating the papuparoonit — and "the fight is the only source" is a rule the
   * roadmap states, not a description of how things happen to be.
   *
   * **What it breaks, and why nothing else:**
   *   - `B` brick — yes. It is the one tile the game has always called soft: a
   *     bump from below breaks it and a sliding shell breaks it, so breaking it
   *     from the side adds a third way into an existing contract.
   *   - a brick that is hiding something — no, exactly as `ShellGuy.smashAhead`
   *     leaves it alone. Its reward belongs to whoever bumps it, and a charge
   *     that deleted a secret nobody ever saw would make the power-up a way of
   *     losing things.
   *   - `?` `!` `*` question blocks — no. They are containers, and the reward
   *     comes out of the top when you hit the bottom. Bursting one sideways
   *     would destroy what it holds.
   *   - `u` a spent block — no. It is masonry once it has paid out, and it is
   *     also frequently the ceiling somebody is standing on.
   *   - `X` hard ground and `#` ground — no. These are the level's structure:
   *     the validator reads exactly these two as the floor profile every route
   *     rule is measured against, so a player who could delete them could open
   *     a hole in the ground route that no check would ever have seen.
   *   - `%` crumbling platform — no. Its whole contract is a timer; a plank you
   *     can also punch out is a plank with no timer, and the tile grows back,
   *     which fights an empty square written over it.
   *   - `S` switch — no. It is a button, and a level has exactly one; smashing
   *     it would delete the only way to open what the switch opens.
   *   - `N` note block, `[ ] { }` pipe — no. A bouncer and a doorway are not
   *     walls, and a pipe with a hole in its side is a warp with a hole in it.
   */
  smashThrough(dirVx) {
    const dir = Math.sign(dirVx);
    const tx = Math.floor((dir > 0 ? this.x + this.w + 1 : this.x - 1) / 16);
    const y0 = Math.floor(this.y / 16);
    const y1 = Math.floor((this.y + this.h - 1) / 16);
    /* The list above is `LevelScene.burstBricks`, and the charge asks it rather
     * than repeating it: the tail and the ground pound break tiles too now, and
     * four copies of "which tile is soft" is four chances for one of them to
     * quietly disagree about a brick with a coin in it. */
    const tiles = [];
    for (let ty = y0; ty <= y1; ty++) tiles.push([tx, ty]);
    const smashed = this.level.burstBricks(tiles) > 0;
    if (smashed) {
      this.vx = dirVx * 0.6;
      // The wall going down is its own event, louder and lower than the single
      // brick `smashBrick` already popped: one charge, one report, however many
      // tiles it took out.
      Sfx.play('burst');
      this.level.shake(2.5);
    }
  }

  headBlocked() {
    const target = PLAYER_SIZES[this.power.level].h;
    const top = this.y + this.h - target;
    const ty = Math.floor(top / 16);
    const x0 = Math.floor(this.x / 16);
    const x1 = Math.floor((this.x + this.w - 1) / 16);
    for (let tx = x0; tx <= x1; tx++) {
      if (this.level.solidAt(tx, ty)) return true;
    }
    return false;
  }

  /**
   * Laukaus. Katto on `maxLiveShots`, ja se **ei kieltäydy** vaan tekee tilaa:
   * vanhin ruudulla oleva pallo katoaa.
   *
   * Kieltäytyminen oli se mitä tässä ennen tehtiin, ja se on huonompi kahdesta
   * syystä. Nappi joka ei tee mitään lukee rikkinäiseksi ohjaukseksi — pelaaja
   * ei näe kattoa, hän näkee että peli ei vastannut — ja katto on juuri se
   * hetki jossa vastaamattomuus sattuu, koska silloin ruudulla on kiire.
   * Vanhin pallo on myös se joka on jo tehnyt työnsä tai ohittanut kohteensa,
   * eli se on halvin poistettava. Omistajan ehdotus 17.8.2026, alun perin
   * vaikeimmalle tasolle; se on tässä kaikille, koska sääntö jonka pelaaja
   * oppii yhdellä tasolla ei saa vaihtua toisella.
   */
  shoot() {
    /* Lataus on aika ilman laukausta, ks. `FartBall`. Kello nollataan tässä
     * eikä `update`ssa, koska se mittaa nimenomaan laukausten väliä. */
    const charged = this.tick - (this.lastShot || -999) >= CHARGE_FRAMES;
    this.lastShot = this.tick;
    const live = this.level.entities.filter((e) => e instanceof FartBall && !e.remove);
    const spread = Math.min(this.shotsPerPress, this.maxLiveShots);
    const over = live.length + spread - this.maxLiveShots;
    for (let i = 0; i < over && i < live.length; i++) {
      live[i].remove = true;
      this.level.spawnPuff(live[i].cx, live[i].cy);
    }
    const x = this.facing > 0 ? this.x + this.w : this.x - 8;
    for (let i = 0; i < spread; i++) {
      /* Ladattu on aina yksi: iso pallo *on* se hajonta. Kolme isoa yhdellä
       * painalluksella olisi ollut ruisku takaisin toisessa muodossa. */
      const big = charged && i === 0;
      const ball = new FartBall(this.level, x, this.y + this.h * 0.45 - (big ? 4 : 0),
        this.facing, big);
      if (!big && i === 1) ball.vy = -2.2;
      if (!big && i === 2) ball.vy = 2.4;
      this.level.add(ball);
      if (big) break;
    }
  }

  bounce() {
    // Flat in SMB3; holding the button pays off through the low ascent gravity.
    this.vy = STOMP_BOUNCE;
    this.onGround = false;
    this.airJumps = 0;
    // Ja jäähdytys, samasta syystä kuin laskeutuminen nollaa sen: pomppu on
    // uuden kaaren alku, ja panos kuluu kaarta kohti.
    this.airJumpCd = 0;
    /* A dive that found something to land on before it found the floor is a
     * stomp, and a stomp gives the controls straight back. Leaving the pound
     * running would have pinned the player in mid-air with a bounce underneath
     * him, and it would also have let one dive collect a stomp *and* the ground
     * blast on the way through. One landing, one answer. */
    this.cancelPound();
  }

  /** Ummetus: corks the gas off for a while. Not damage, but it stings. */
  cork(frames = 380) {
    if (this.invuln > 0 || this.dying || this.transit) return false;
    this.corked = Math.max(this.corked, frames);
    this.flying = 0;
    this.spin = 0;
    Sfx.play('cork');
    this.level.addScorePop(this.cx, this.y - 8, 'UMMETUS');
    return true;
  }

  /** @returns true when the hit actually landed (i.e. not invulnerable). */
  hurt(cause = 'enemy') {
    // A body inside a pipe is not in the room; nothing in the room reaches it.
    if (this.invuln > 0 || this.dying || this.frozen > 0 || this.transit) return false;
    /*
     * LÄPÄISTY KENTTÄ EI VOI ENÄÄ SATUTTAA.
     *
     * Omistajan raportti pelistä: potkaistu kuori kimposi takaisin ja osui
     * **maalin jälkeen**, kesken sen kävelyn jota pelaaja ei enää ohjaa.
     * Se on rakenteellisesti epäreilu — `completeLevel` ottaa ohjaimet pois
     * (`controllable = false`, `autoWalk = true`), joten mitään väistöä ei
     * ole olemassa — ja `collisions()` jatkoi silti ajamistaan, koska sen
     * ehto on `state !== 'dead'`.
     *
     * Sääntö on tässä eikä siellä, ja se on tarkoituksellista: vahinkoa
     * jaetaan kymmenestä paikasta (kuori, piikit, laava, raajat, viholliset),
     * ja yksi tarkistus jokaisen edellä on lista joka vanhenee. Keho joka ei
     * ole enää pelissä ei ota vastaan mitään, olipa lähettäjä mikä tahansa.
     */
    if (this.level.state !== 'play') return false;
    /* Kuori ottaa yhden osuman ja katoaa. Se on nielty kuoriukko, ja se tekee
     * saman minkä sen oma kuori teki: kestää kerran. */
    if (this.swallowed === 'kuori') {
      this.swallowTimer = 0;
      this.invuln = 90;
      Sfx.play('kick');
      this.level.addScorePop(this.cx, this.y - 8, 'KUORI MENI');
      return false;
    }
    if (this.power.level === 0) {
      this.die(cause);
      return true;
    }
    this.startMorph(this.power.level);
    this.power = makePower(this.power.level - 1 === 0 ? null : this.power.type,
      this.power.level - 1);
    this.ducking = false;
    // A dive that ran into spines on the way down is over: the freeze and the
    // knock-back below own the body now, and a pound still counting frames
    // underneath them would take the controls again the moment they end.
    this.cancelPound();
    this.applySize();
    this.invuln = 110;
    this.frozen = 20;
    this.flying = 0;
    /* Koko ruutu välähtää punaisena. Kuva ja ääni yhdessä (DESIGN.md kohta 8):
     * `powerdown` kertoo mitä tapahtui, väri kertoo *milloin*, ja kumpikaan ei
     * ole toisen toisinto — ääni kuuluu vaikka katse oli muualla, väri näkyy
     * vaikka peli on mykistettynä. Ks. `scenes/level.js`, `paletteShift`. */
    this.hurtFlash = HURT_FLASH;
    Sfx.play('powerdown');
    this.level.dropReserve();
    return true;
  }

  /**
   * Painovoiman komponentti rinteen pintaa pitkin. Ks. `SLOPE_DOWN` ja
   * `physics.js`:n `slopePull`, jossa itse sääntö asuu — pelaaja antaa sille
   * omat rajansa (P-nopeus kattona) ja kuori omansa.
   */
  slopePull() {
    slopeSlide(this, SLOPE_DOWN, SLOPE_UP, MAX_P);
  }

  /**
   * Rinteen huipulta lähtö: vaakavauhti nousuksi. Ks. `SLOPE_LAUNCH`.
   *
   * Ehto on että keho **oli** rinteessä, ei ole enää, on menossa ylöspäin
   * rinteen nousun suuntaan ja liikkuu vähintään juoksuvauhtia. Alaspäin
   * kävelevä ei lennä — se olisi rinne joka sinkoaa väärään suuntaan — eikä
   * kävelijää heitetä lainkaan.
   */
  slopeLaunch(wasSlope) {
    if (!wasSlope || this.onSlope || this.vy < 0 || this.transit) return;
    if (Math.sign(this.vx) !== Math.sign(wasSlope)) return;
    const speed = Math.abs(this.vx);
    if (speed < SLOPE_LAUNCH_MIN) return;
    this.vy = -speed * SLOPE_LAUNCH;
    this.onGround = false;
    /* Sama kevyt painovoima kuin hypyssä niin kauan kuin nappi on pohjassa:
     * rinne antaa lähdön, pelaaja päättää kuinka pitkälle sitä venyttää. Ilman
     * tätä nousu olisi 12 px eikä 40, eli sama liike ilman sitä osaa joka
     * tekee siitä reitin. */
    this.jumpHeld = true;
    this.level.spawnPuff(this.cx, this.y + this.h);
    Sfx.play('jump');
  }

  /**
   * Vauhtimittari maailman puolella: ks. `PLUME_START` yllä.
   *
   * Yksi pilvi kerrallaan eikä `spawnPuff`in neljä, koska tämä toistuu joka
   * toinen frame täydellä mittarilla — neljä kerrallaan olisi sadan hiukkasen
   * myrsky sekunnissa siinä missä tarkoitus on jälki. Purskeen väli kiihtyy
   * `PLUME_SLOW`ista `PLUME_FAST`iin ja koko kasvaa kahdesta neljään, eli
   * *tiheys ja koko* kertovat saman asian kahdella kanavalla samaan tapaan
   * kuin aika-ajon jako (nuoli ja etumerkki).
   */
  ventPlume() {
    if (!this.onGround || this.corked > 0 || this.dying) return;
    const t = this.pMeter / P_METER_MAX;
    if (t < PLUME_START) return;
    const heat = (t - PLUME_START) / (1 - PLUME_START);
    const every = Math.max(PLUME_FAST, Math.round(PLUME_SLOW - heat * (PLUME_SLOW - PLUME_FAST)));
    if (this.tick % every !== 0) return;
    /* Kantapäiden takaa, ei jalkojen alta: suihku on se mistä ollaan tultu. */
    const back = this.cx - this.facing * (this.w / 2 + 1);
    this.level.add(new Puff(this.level, back, this.y + this.h - 3, {
      spread: 0.9, size: 2 + Math.round(heat * 2), life: 14 + Math.round(heat * 10),
    }));
  }

  collect(itemKind) {
    switch (itemKind) {
      case 'shroom':
      case 'flower':
      case 'leaf':
      case 'pop': {
        const maxed = this.power.level >= MAX_POWER_LEVEL && this.power.type === itemKind;
        if (maxed) {
          this.level.storeReserve(itemKind);
          /* Oma äänensä, ja perustelu on `SFX.reserve`in kommentissa: täydellä
           * tasolla poimittu tehostus ei muuta kehossa mitään, joten `powerup`
           * sanoi "kasvoit" hetkellä jolla mikään ei kasvanut. Kuva on jo
           * olemassa — lokero on HUDissa juuri tätä varten — eikä sitä ole
           * kahta. Vaihtohaara alla saa yhä `powerup`in, koska siinä keho
           * oikeasti muuttuu ja lokerointi on sivutuote. */
          Sfx.play('reserve');
        } else {
          // Swapping to a different power banks the one you were wearing.
          // Losing a tail just because you walked into a mushroom is the kind
          // of thing that feels like the game cheated you.
          if (this.power.type && this.power.type !== itemKind) {
            this.level.storeReserve(this.power.type);
          }
          this.startMorph(this.power.level);
          this.power = powerAfterItem(this.power, itemKind);
          this.applySize();
          this.frozen = 18;
          this.corked = 0;
          Sfx.play('powerup');
        }
        this.level.awardScore(PTS.prize, this.cx, this.y);
        break;
      }
      case 'soup': {
        // Hernekeitto: one more level of whatever you are, and it cures ummetus.
        if (this.power.level >= MAX_POWER_LEVEL) {
          this.level.awardScore(PTS.jackpot, this.cx, this.y);
        } else {
          this.power = powerAfterItem(this.power, 'soup');
          this.applySize();
          this.frozen = 18;
          this.level.awardScore(PTS.prize, this.cx, this.y);
        }
        this.corked = 0;
        Sfx.play('soup');
        break;
      }
      case 'star': {
        // Restarted, not extended: the timer is the promise on the HUD, and a
        // second star that added twelve seconds to nine would make it a lie.
        this.star = STAR_FRAMES;
        Sfx.play('yeah');
        this.level.awardScore(PTS.prize, this.cx, this.y);
        break;
      }
      default:
        break;
    }
  }

  /**
   * Steps out of the world for a moment. The scene decides where the body goes
   * and when it comes back — see `LevelScene.updateTransit`.
   */
  beginTransit(spec) {
    this.transit = {
      phase: 'in',
      f: 0,
      fromX: this.x,
      fromY: this.y,
      hide: null,
      hideDir: 1,
      /* Remembered rather than assumed true on the way out. A transit is not
       * the only thing that takes the controls away — the clear sequence does
       * too — and handing them back unconditionally would be a warp that
       * cancelled a cutscene. */
      wasControllable: this.controllable,
      ...spec,
    };
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.climbing = false;
    // A dive interrupted by a pipe does not resume on the far side: the body
    // that comes out is somewhere else entirely, and the height it remembered
    // belongs to a room it has left.
    this.cancelPound();
    this.controllable = false;
  }

  /** Remembers the body he is leaving, for the size-change flicker. */
  startMorph(fromLevel) {
    this.morphFrom = fromLevel;
    this.morphTimer = 20;
  }

  /** `cause` is only carried through to telemetry; it changes nothing in play. */
  /**
   * POKSAHDUS: kaasu ulos, kerralla ja joka suuntaan.
   *
   * Kuoleva keho on `noclip`, eli tämä on ainoa hetki jolloin kaasupilvi ei
   * ole minkään merkki vaan tapahtuma itse. Ääni on `pop` eikä oma uusi ääni,
   * ja se on DESIGN.md kohta 8 luettuna oikein päin: `pop` on tässä pelissä jo
   * *kalvo joka pettää* (kuplan puhkaisu), ja tämä on täsmälleen sama asia
   * isompana. Kaksi ääntä samalle tapahtumalle olisi se mitä kohta 8 kieltää.
   */
  popGas() {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.level.spawnPuff(this.cx + Math.cos(a) * 6, this.cy + Math.sin(a) * 6);
    }
    Sfx.play('pop');
  }

  die(cause = 'enemy') {
    if (this.dying) return;
    /* Nothing in the level can kill a travelling player — the clock stops, the
     * collisions stand aside and `hurt` refuses — so this only fires for a
     * death forced from outside (the debug keys, a test). Dropping the transit
     * is the right answer there: the death animation is the thing to watch,
     * and a half-finished slide is not. */
    this.transit = null;
    this.cancelPound();
    this.dying = true;
    this.deathT = 0;
    this.noclip = true;
    this.controllable = false;
    this.vy = -6.6;
    this.vx = 0;
    this.flying = 0;
    Sfx.play('die');
    this.level.onPlayerDied(cause);
  }

  state() {
    if (this.dying) return 'jump';
    /* Before `ducking` and before `onGround`: a body on a vine is neither
     * standing nor falling, and reporting `jump` here was the whole reason the
     * hand-over-hand counter below was computed every frame and thrown away. */
    if (this.climbing) return 'climb';
    if (this.ducking) return 'duck';
    if (!this.onGround) return 'jump';
    if (Math.abs(this.vx) > 0.1) return 'walk';
    return 'idle';
  }

  draw(ctx) {
    // Being frozen and being invulnerable used to look identical, because
    // neither had a picture: the sprite just vanished every other frame. The
    // flicker still reads as i-frames, but the character stays on screen and
    // the freeze after a power change is now its own colour.
    let tint = null;
    // The star wins over both: it lasts longer than either and it is the one
    // state where being hard to read is actually dangerous.
    if (this.star > 0) tint = STAR_TINTS[Math.floor(this.tick / 3) % STAR_TINTS.length];
    else if (this.frozen > 0) tint = TINTS.frozen;
    else if (this.invuln > 0 && Math.floor(this.tick / 2) % 2 === 0) tint = TINTS.flash;
    const spinning = this.spin > 0;
    drawPlayer(ctx, this.x, this.y, {
      type: this.power.type,
      // Flickering between the old body and the new one. The hitbox is already
      // the new size — only the picture alternates, so nothing about the change
      // is decided by which frame you are on.
      level: this.morphTimer > 0 && Math.floor(this.tick / 3) % 2
        ? this.morphFrom : this.power.level,
      facing: spinning ? (Math.floor(this.spin / 3) % 2 ? -this.facing : this.facing) : this.facing,
      frame: this.animFrame,
      state: this.state(),
      ducking: this.ducking,
      /* MAAHANISKU. Two plain fields rather than a pose name, for the same
       * reason the move itself is three plain fields: the drawing decides what
       * a tuck looks like and how long the getting-up lasts, and this side
       * decides nothing but which phase is running and how much of it is left.
       * `state()` is left alone — it answers "standing, walking, jumping or
       * climbing", and a dive is none of those. */
      pound: this.poundPhase || null,
      poundT: this.poundTimer,
      /* KUOLEMA. Kaksi kenttää kuten iskullakin, ja samasta syystä: tämä puoli
       * tietää vain että keho on kuollut ja kuinka kauan, ja piirros päättää
       * miltä jäykistyminen, paisuminen ja poksahdus näyttävät. `state()` jää
       * rauhaan — se vastaa kysymykseen "seisooko, kävelee, hyppää vai
       * kiipeää", eikä kuolema ole mikään niistä. */
      dead: this.dying,
      deadT: this.deathT,
      running: Math.abs(this.vx) > MAX_WALK,
      /* Pyörivät jalat: keho menee kovempaa kuin sen jalat osaavat kävellä.
       * Ks. `spinLegs` sprite-puolella — ehto on tässä yhtenä lauseena, jotta
       * piirros ei joudu arvaamaan mitä "vauhdikkaasti" tarkoittaa. Maassa
       * eikä ilmassa: lentävällä ei ole maata jota vasten pyöriä. */
      spinLegs: this.onGround && Math.abs(this.vx) > MAX_RUN && !this.ducking,
      tick: this.tick,
      wag: this.wag,
      idle: this.idle,
      // Where he is standing changes how he stands there; see idlePose.
      theme: this.level.theme,
      tint,
      glow: this.star > 0 ? GLOWS.star : null,
    });
    if (this.corked > 0) {
      drawCork(ctx, this.x + this.w / 2 - 4, this.y - 10, this.tick);
    }
  }
}

/* The two ground-pound constants leave the module for the same reason
 * `WALK_FRAMES` comes into it: whoever reports the price of the move has to
 * read the price, not remember it. A number copied into a test is a number
 * that goes stale the first time the move is tuned. */
export { MAX_WALK, MAX_RUN, MAX_P, POUND_CHARGE, POUND_SPEED };

/* And the quicksand numbers, for exactly the same reason. "Several seconds" is
 * a claim about `QUICKSAND_SINK` and `QUICKSAND_GRACE` together; a test that
 * remembered either of them would keep passing after somebody halved one. */
export {
  QUICKSAND_SINK, QUICKSAND_GRACE, QUICKSAND_KICK, QUICKSAND_WADE,
  QUICKSAND_PLUNGE_FRAMES,
};
