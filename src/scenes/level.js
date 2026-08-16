import { arenaColumn, getLevel } from '../data/levels.js';
import {
  TILE, T, info, isSolid, isSemi, drawTile, THEMES, SWITCH_MAP, SPIKE_TOP, themeTint,
} from '../gfx/tiles.js';
/* Vain kuninkaan verhoa varten, ks. `onKingForm`: saapuvan muodon maailma on
 * `WORLDS[i]`, ja sen väri luetaan sen teemasta. */
import { WORLDS } from '../data/worlds.js';
import { drawBackdrop } from '../gfx/backdrop.js';
import { drawGoal, drawItem } from '../gfx/sprites.js';
import { drawText, textWidth } from '../gfx/font.js';
import { Player, P_METER_MAX, MAX_RUN, HURT_FLASH } from '../entities/player.js';
import { ENEMY_CHARS } from '../entities/enemies.js';
import { Item, Beanstalk } from '../entities/items.js';
import { Puff, ScorePop, BrickPiece, CoinPop, PoundWave } from '../entities/effects.js';
import { Music, Sfx, Ambience } from '../core/audio.js';
import { PostFX } from '../gfx/postfx.js';
import { logDeath, logClear, logStuck, levelSummary } from '../core/telemetry.js';
import { noteSecret, tileKey, SKY, CAVE } from '../core/secrets.js';
import { GRAVITY, GRAVITY_HELD_CUTOFF } from '../level/physics.js';
import {
  RACE_SPLITS, SPLIT_FLASH, SPLIT_COLORS, NEW_RECORD, FIRST_TIME, RUN_LABEL, BEST_LABEL,
  bestFor, setBest, raceKey, formatTime, formatDelta,
} from '../core/timeattack.js';
import { clamp, hashNoise, overlaps, padNum } from '../core/utils.js';
/* Yksi merkkijono, ja se tulee sieltä missä se on määritelty — ks. DAILY_TITLE. */
import { DAILY_TITLE } from '../core/daily.js';

export const VIEW_W = 320;
export const VIEW_H = 208;
export const HUD_H = 32;

const GOAL_HEIGHT = 6 * TILE;
/** Seconds left when the music starts pushing. */
const HURRY_TIME = 100;

/*
 * AIKA-AJON JAKO HUD-NAUHASSA. Nauhassa on jo viisi lukemaa — varaesine,
 * P-mittari ja voimapallot vasemmalla, elämät ja kolikot niiden oikealla,
 * maailma ja aika keskellä oikealla, pisteet reunassa — eikä yhtään vapaata
 * riviä. Jako on kuudes, ja sille on tasan yksi aukko:
 *
 *   rivi y+6:  elämärivi `KV *N` alkaa 100:sta ja on 5-8 merkkiä leveä,
 *              eli loppuu viimeistään 153:een; `MAAILMA X-Y` alkaa 196:sta.
 *   levein jako: nuoli 5 px + väli 2 px + `+9999` 29 px = 36 px, eli
 *              156...192, ja käänteisenä vilkkuessaan 155...193.
 *
 * Kolme pikseliä jää molemmin puolin. `tools/verify.mjs` piirtää nauhan
 * pahimmalla mahdollisella tilalla (9999 elämää, 99 kolikkoa, seitsennumeroiset
 * pisteet, tähti päällä) tila päällä ja pois, ja vaatii nollaa peitettyä
 * pikseliä — mitattu, ei silmämääräinen.
 *
 * Kulunutta aikaa **ei** piirretä, vaikka se on juuri se luku jota ajetaan.
 * Se on jo nauhassa: `AIKA` on sama luku toisin päin, `def.time -
 * floor((ajokello - putkiframet) / 24)`, ja portti mittaa kaavan framelleen.
 * Kaksi lukemaa samasta luvusta on juuri se virhe jota DESIGN.md kohta 8
 * varoo.
 */
const SPLIT_X = 156;

/*
 * MAAHANISKUN OSUMA. The dive itself lives in player.js; these are the numbers
 * for what it does when it arrives, and they are the balance of the move.
 *
 * Read them against a stomp, because that is the thing this must not replace:
 * a stomp reaches the width of one body (16 px), kills, and costs nothing. So
 * the pound is wider than a stomp even at its weakest and much wider at its
 * best, but it only *kills* from a height an ordinary jump cannot reach —
 * POUND_KILL_AT is half the room, and a standing jump off the floor of a
 * fifteen-tile level is worth about a third of it. Everything under that mark
 * is a knock-over, which is a different answer and not a cheaper stomp.
 *
 * POUND_REACH_FLOOR is what is left of the reach at zero height, so the number
 * never collapses to nothing on a dive begun a few pixels up.
 *
 * The shockwave threshold is the one place a power level buys something other
 * than width: at power 0 it needs three quarters of the room above the landing,
 * and each level pays back POUND_WAVE_PER_LEVEL of that down to a floor of
 * POUND_WAVE_FLOOR — so a level 5 player still cannot get it from a hop, and a
 * level 0 player still gets it from the ceiling. Strengthened, never unlocked.
 *
 * POUND_LIFT is how far off the floor the blast reaches. One tile and a bit:
 * enough to catch what is standing beside the landing, not enough to swat a
 * flyer out of the sky, which would make the move an anti-air weapon as well.
 */
const POUND_REACH = 30;
const POUND_REACH_FLOOR = 0.5;
const POUND_REACH_PER_LEVEL = 5;
const POUND_KILL_AT = 0.5;
const POUND_WAVE_AT = 0.75;
const POUND_WAVE_PER_LEVEL = 0.09;
const POUND_WAVE_FLOOR = 0.3;
const POUND_LIFT = 20;
const POUND_SHAKE_MIN = 1.5;
const POUND_SHAKE_RANGE = 4.5;

/*
 * MAAHANISKU RIKKOO LATTIAN, JA EHTO ON KATON EHTO YLÖSALAISIN.
 *
 * Kaksi ehtoa, ja ne ovat tarkoituksella eri lajia — toinen on se mitä pelaaja
 * on kerännyt, toinen se mitä hän juuri teki:
 *
 *   - **Kasvanut keho.** `p.big`, eli täsmälleen sama ehto jonka `bumpTile`
 *     asettaa päänpuskulle: pieni Pieruprinssi kolauttaa tiiltä alta eikä se
 *     hajoa, ja nyt hän myös laskeutuu sen päälle eikä se hajoa. Omistajan
 *     pyyntö 16.8.2026 oli tämä symmetria sanasta sanaan — *"if there's a brick
 *     that can be broken from below by jumping, then you should be able to
 *     break it from above by a ground pound"* — ja se on parempi sääntö kuin se
 *     joka tässä ennen oli (voimataso 3), koska se ei ole tämän liikkeen oma
 *     luku lainkaan. Pelaaja on jo oppinut kerran kuka rikkoo tiilen; tämä ei
 *     opeta sitä toiseen kertaan toisella numerolla.
 *
 *     Se on yhä poikkeus `poundImpact`in lupaukseen "voimataso vain vahvistaa",
 *     ja se on kirjoitettu tähän eikä pujahtanut sisään. Poikkeus vain on nyt
 *     yhden askeleen mittainen viiden sijaan, eli se koskee jokaista pelaajaa
 *     joka on koskaan poiminut yhdenkin tehostuksen — ja DESIGN.md kohta 5:n
 *     mielessä se on sama ovi jonka päänpusku jo avasi, ei uusi.
 *   - **POUND_BREAK_AT** on pudotuksen korkeus, ja *tämä* on se ehto joka
 *     maksaa. Se on korkeampi kuin `POUND_KILL_AT`, eli lattian rikkominen on
 *     tiukempi vaatimus kuin tappaminen: syöksy joka tappaa vihollisen ei vielä
 *     riitä tiileen, vaan sen päälle tarvitaan vielä reilusti lisää putoamista.
 *     Omistajan sanoin "maybe you have to do it from pretty far up". Mitattu
 *     `verify.mjs`:ssä molemmista suunnista: tavallisen kentän lattialla tämä
 *     on noin 130 px pudotusta, eli enemmän kuin yksikään hyppy tuottaa
 *     tasamaalta (mitattu paras 100 px, PHYSICS.md) — se on siis aina joko
 *     korokkeelta tai pieruhypyllä ansaittu.
 *
 * Ei siis uutta reittiä tiilen läpi ohi sen sopimuksen jonka `burstBricks`
 * kirjoittaa: mitään muuta kuin `B` tämä ei koske, eikä `B`:tä joka piilottaa
 * jotain. Leveys on iskun oma `reach`, eli sama luku joka päättää ketkä
 * kaatuvat — reikä lattiassa on tasan sen levyinen kuin isku näytti olevan.
 */
const POUND_BREAK_AT = 0.72;

/**
 * KUINKA KAUAN KUPLA KANTAA, frameina. Ks. `collisions` ja `rideBubble`.
 *
 * Kolmasosa sekunnista, ja luku on valittu hypyn mitasta eikä tunnelmasta:
 * lyhin mitattu hyppy tässä pelissä on paikaltaan näpäytetty 22 framea
 * (PHYSICS.md), joten kupla kantaa vähemmän aikaa kuin kestää hypätä sen yli.
 * Se on siis askelma jonka ajoittaa, ei taso jolla odotetaan — ja se on koko
 * ero kuplaloukun ja hissin välillä.
 */
const BUBBLE_CARRY = 18;

/**
 * PONNAHDUSLAUTA, ja sen kaksi lukua ovat koko mekaniikka.
 *
 * IDEAS-synteesi H, tuomio 16.8.2026 "tee": rinteitä ei ole eikä niitä kannata
 * rakentaa, mutta **täysi vauhtimittari voi ostaa korkeutta**. Tämä on se
 * laatta joka myy sitä.
 *
 * Luvut on johdettu nousun kaavasta eikä valittu tunnelmasta. Kun hyppynappi
 * on pohjassa, nousu kuluttaa `GRAVITY_HELD`ia (0,0625) siihen asti kun `vy`
 * ylittää -2,0, ja loppu tavallisella painovoimalla — eli lähtönopeus `v`
 * nostaa `(v² - 4) × 8 + 6,4` pikseliä. Sillä kaavalla:
 *
 *   `SPRING_LOW`  -4,0 → 102 px. Tyhjällä mittarilla lauta on siis suunnilleen
 *                 tallauspomppu (`STOMP_BOUNCE` on sama -4,0), eli se antaa
 *                 jotain aina — laatta joka ei tee mitään ilman mittaria olisi
 *                 pelaajalle rikki eikä ehdollinen.
 *   `SPRING_HIGH` -5,4 → 205 px eli kolmetoista ruutua. Se on enemmän kuin
 *                 mikään muu tässä pelissä nostaa (mitattu paras on juoksu +
 *                 pieruhyppy, 174 px), ja se on tarkoitus: mittarin täyttäminen
 *                 on työtä, ja työn on ostettava jotain jota ei saa muuten.
 *
 * Väli on lineaarinen mittarin täyttöasteessa, koska mittari on jo palkkeina
 * HUDissa: pelaaja näkee mitä hän ostaa, eikä lukua tarvitse opettaa erikseen.
 */
const SPRING_LOW = -4.0;
const SPRING_HIGH = -5.4;

/* Kaasulyhdyn mitat; perustelut ovat `plantLamp`issa ja `lampFooting`issa.
 * `LAMP_EDGE` pitää lyhdyn irti kentän molemmista päistä: alku on jo
 * tarkistuspiste ja loppu on maalitolppa, eikä kumpikaan tarvitse toista. */
/* Pieruhyllyn mitat; perustelut ovat `gasShelf`issa. Kaksi sekuntia ja kolme
 * ruutua: askelma jonka ehtii käyttää kerran, eikä rakennelma. */
const SHELF_LIFE = 120;
const SHELF_TILES = 3;

const LAMP_MIN_COLS = 340;
const LAMP_EDGE = 24;
const LAMP_CLEAR = 2;
const LAMP_RUNUP = 24;

/* Camera feel. The dead zone is what keeps a hop from shaking the screen; the
 * look-ahead is what lets you see the gap you are running at. */
const CAM_DEAD_ZONE = 8;      // px of free movement before the camera follows
const CAM_LOOK_AHEAD = 34;    // px the view leans ahead at full running speed
const CAM_LOOK_GAIN = 0.035;  // how fast the lean builds
const CAM_LOOK_RETURN = 0.07; // and how fast it settles back when you stop
const CAM_BAND_EASE = 0.18;   // how fast the view crosses to another band

/*
 * The vertical camera hangs off the player's **feet**, and the two constants
 * below are where that is expressed.
 *
 * `applySize()` keeps the bottom of the body fixed and changes `h`, so ducking
 * on a pipe moved `p.y` down 13 px in a single frame at power level 3 — and the
 * camera, which was anchored to `p.y`, went with it. The backdrop does not
 * parallax vertically, so the whole ground appeared to jolt for no reason the
 * player could see. Feet do not move when a body changes size, so anchoring
 * there removes the cause instead of smoothing over it, and it also stops the
 * framing sliding around as you collect power-ups.
 *
 * `CAM_STAND` is the standing height the framing was tuned at (the mushroom
 * size, PLAYER_SIZES[1]); subtracting it keeps a standing player's view pixel
 * for pixel what it was before.
 */
const CAM_EYE = 0.55;         // how far down the window the player sits
const CAM_STAND = 26;         // the body height that framing assumes

/*
 * And genuine vertical movement is eased.
 *
 * This is not the inertia rejected below: that argument is about the axis you
 * aim with, and you do not aim upwards. A step down off a ledge as a hard cut
 * reads as the level moving; the same step over a few frames reads as the view
 * following you.
 *
 * 0.25 closes a 16 px step to under a pixel in about thirteen frames. It used
 * to settle a full 4 / 0.25 = 16 px behind a sustained fall at TERMINAL, and
 * that lag is what `CAM_FALL_LEAD` now cancels — see there; the sentence that
 * used to stand here called the lag harmless because the ground you are
 * falling towards stayed on screen, which was true and was not the problem.
 *
 * **AND IT IS THE ONLY RULE ON THIS AXIS. THERE USED TO BE A SECOND ONE.**
 *
 * A `CAM_SNAP = 48` sat here, and past it the view cut instead of easing. The
 * case it named was "the view is somewhere else entirely rather than behind —
 * a respawn, a warp, a pit". That reads perfectly and it was measured, once,
 * and the measurement says it never protected any of the three:
 *
 *   - **a respawn and a warp are not eased at all.** Both build or re-place a
 *     body and then call `centerCamera()`, which assigns `cam.y` outright.
 *     That is the real cut, it has no threshold, and it always did the work
 *     this constant was credited with.
 *   - **a pit is bounded by the level's own clamp.** Walking or jumping off
 *     every ledge four to eight tiles high in 1-1, 2-1, 2-3, 4-1, 5-1 and 1-2,
 *     the furthest the view was ever from where it wanted to be is 14.5 px.
 *   - **a band change never reached this line**, because `updateCamera` tests
 *     for bands first and eases at `CAM_BAND_EASE` — measured, a band change
 *     wants to move 240 px and is the one big vertical move meant to be
 *     watched.
 *
 * And in 26 of the 30 levels the threshold is **arithmetically unreachable**:
 * a 15-row level is 240 px tall in a 208 px window, so `clampCamY` allows 32 px
 * of travel in total and 48 cannot be asked for. The remaining four are the
 * banded ones, which take the other branch. That leaves exactly the two
 * letterboxed levels, 2-1 and 2-3, where the crop buys the camera 80 px of
 * travel — and the only thing that ever reached the threshold there was the
 * bug it was hiding.
 *
 * **The bug: landing on a raised platform.** The anchor is held through a jump
 * and moves on the frame the feet touch (see below), so touching down on a
 * four-tile platform moves it the whole height of the platform at once. In 2-1
 * and 2-3 the desert floor frames at the bottom of the 80 px range and that
 * platform frames at 30, so the view has 50 px to travel — and 50 > 48 cut all
 * of it on one frame. Measured by jumping onto it with the pad at power 0 and
 * power 3: **50.00 px on a single frame, settled in 1 frame.** The identical
 * event in an ordinary level is a 32 px step that glides at 7.10 px on its
 * busiest frame and settles in 12, which is what a landing is supposed to look
 * like and what the letterbox was accidentally opting out of.
 *
 * Removing the threshold makes the two levels behave like the other 28: 50 px
 * eased at 0.25 is **12.50 px on the first frame**, decaying, settled in 13.
 * That is 1.6x the ordinary landing's first frame because the platform is 1.6x
 * the step, which is the ease being consistent rather than the ease being
 * strained — and it is a quarter of what the band ease does on its own first
 * frame with the game's blessing.
 *
 * **Why not a lead here, when both other axes got one.** `CAM_TOP_LEAD` and
 * `CAM_FALL_LEAD` both aim at where the body is going on an axis the view is
 * already following. On this one the view is deliberately *not* following the
 * body: the anchor holds through the arc so the tile you took off from stays
 * on screen (measured, and asserted). Any lead that started the rise before
 * touchdown would be the camera riding the jump — the exact thing the hold
 * exists to prevent — and it would take the take-off ground off the bottom of
 * the frame to buy smoothness at the top. So the rise gets no warning, and
 * because it gets no warning it gets the ease and nothing else.
 */
const CAM_V_EASE = 0.25;

/*
 * ...but it does not follow a jump.
 *
 * The line above is anchored to `camAnchor`, the last feet position the player
 * actually **settled** at, and not to the feet themselves. A jump moves the
 * body and leaves the anchor where it was, so the view stays put and the
 * ground stays on screen; landing, standing, climbing and falling all move the
 * anchor at once, because those are the moments where the player really is
 * somewhere else. Falling in particular has to follow promptly — you must see
 * what you are falling towards — and it does, because the anchor tracks the
 * fall on the frame it happens, aimed a little ahead of the feet rather than
 * at them (`CAM_FALL_LEAD`).
 *
 * Why hysteresis and not a smaller `CAM_EYE`: the complaint is about the
 * letterboxed desert (2-1, 2-3), where the window is 160 rows instead of 208
 * and the camera therefore has 80 px of vertical travel instead of 32. The
 * camera rode the whole jump arc up and took the desert floor with it —
 * measured, the tile the player took off from was off the bottom of the window
 * for **41.6 % of every airborne frame**. `CAM_EYE` applies while standing too,
 * so lowering it would re-frame all 24 levels to fix a mid-jump problem, and it
 * would not fix it in the levels where the camera has less travel; the anchor
 * fixes the cause everywhere and changes nothing about how a standing player is
 * framed.
 *
 * `CAM_TOP_MARGIN` is the one thing that overrides the held line, and it is
 * stated in the window rather than in the world on purpose: the reason to break
 * the hold is that the body is about to leave the top of the picture, so the
 * threshold belongs where that is measured. One tile of headroom, so the head
 * never touches the frame edge. In a 208-row window it is never reached (the
 * standing head sits 106 px below the line and the highest jump in the game
 * rises 100), so a normal level's camera now holds still through every jump;
 * in the letterboxed one it takes over near the apex and the view rises exactly
 * as far as it must, and no further.
 */
const CAM_TOP_MARGIN = 16;

/*
 * ...and how much warning the view gets before it has to.
 *
 * The margin above was applied as a hard clamp **after** the ease, and the
 * owner saw exactly what that is: "when the character is actually high enough
 * for the camera to move, it moves suddenly. It just snaps higher instead of
 * animating." A clamp cannot animate. The frame the head crossed 16 px the view
 * was pinned to `p.y - CAM_TOP_MARGIN` and tracked it exactly from then on, so
 * the camera's speed went from nothing to the body's own rise speed between two
 * frames — measured, **2.92 px on one frame** in 2-1 at power level 3, on a
 * frame where the body itself lifted 2.93. A view that matches the body's speed
 * from a standstill is a cut with extra steps.
 *
 * The answer is not to ease the limit — an eased limit lags, and that lag is
 * the measured 2.6 px of head poking out of the letterbox band that put the
 * clamp there in the first place. **The answer is to start before the limit is
 * reached.** So the limit is aimed at where the head *will be* in
 * `CAM_TOP_LEAD` frames rather than where it is, and the ease has that long to
 * get up to speed. Worst single frame after: **1.95 px**, reached over several
 * frames instead of on the first one, and the clamp below now moves the view
 * 0.00 px because it is never the thing that arrives first.
 *
 * Three frames, and the number is the ease's own rather than a taste:
 * `CAM_V_EASE` of 0.25 chasing a target that moves at v settles exactly
 * `(1 - 0.25) / 0.25 = 3v` behind it, so three frames of lead cancel the lag
 * and the view arrives at the limit instead of chasing it. **Longer leads are
 * worse**, which is not obvious and is the reason this paragraph exists: the
 * lead multiplies a velocity, and a fart jump changes that velocity in a single
 * step, so every extra frame of lead makes the target's own jump on that frame
 * bigger. Worst single-frame rise at leads of 3, 4, 5, 6 and 8 frames: 1.95,
 * 2.21, 2.49, 2.68, 2.88 px. Three is both the cancellation and the minimum.
 *
 * It is spent only while rising. Falling and standing aim at the head itself,
 * which is what they always did.
 *
 * What this does *not* do is start following ordinary jumps, and that is the
 * point of leading by a speed rather than by a distance: at the top of an arc
 * the speed is nothing, so the lead is nothing and the settled framing is the
 * old framing to the pixel — `cameraY()` for a standing body is unchanged, and
 * asserted so.
 *
 * The one ordinary jump this is visible on is worth stating rather than
 * rounding away. A running jump in 2-1 at power level 3 tops out with the head
 * **16.4 px** clear of the frame — 0.4 px from forcing the old clamp — so the
 * anticipation does engage for a frame or two near the apex, and the view
 * drifts a total of **0.93 px over an 85 px jump**, 0.27 of it on its busiest
 * frame. That is a jump which was always going to move the camera, moved
 * smoothly instead of in one step. At power level 0 the same jump has 20.4 px
 * of headroom and the view still does not move at all: 0.00 px, before and
 * after.
 */
const CAM_TOP_LEAD = 3;

/*
 * ...and the one thing three frames of warning cannot buy: a rise that is
 * bigger than the warning.
 *
 * `CAM_TOP_LEAD` cancels the ease's *lag* and nothing else. Three frames of lead
 * against an ease of 0.25 means that once the view is up to speed it sits
 * exactly on `head - CAM_TOP_MARGIN`, and therefore **matches the body's own
 * rise speed** — which is nothing at all when the head only reaches the margin
 * near the apex, and is nearly four pixels a frame when it reaches it early.
 *
 * **And where in the arc the head reaches the margin is decided by the framing,
 * not by the jump.** A player standing on the desert floor of 2-1 is framed with
 * 94 px of headroom, because `rest` wants 94 and the bottom of the level pins
 * the view before it can take any of it back. A player standing on the brick
 * shelf at column 228 of the same level — chunk 14, row 9, in the shipped game
 * and reachable — gets the 80 px `CAM_EYE` actually asks for. Fourteen pixels of
 * difference, and they land in the worst possible place: the margin is crossed
 * 64 px into the jump instead of 78, with the body still climbing at 3.9
 * px/frame instead of coasting into its apex. Measured there, power level 3, one
 * running fart jump: **2.73 px on a single frame**, against a gate that calls
 * 2.5 a snap — and the gate never saw it, because its bot dies in 2-1 long
 * before column 228.
 *
 * **Two obvious repairs were measured and both are dead ends, which is why this
 * one is shaped the way it is.**
 *
 *   - *A longer lead* was already measured above and rejected: 1.95 → 2.88 going
 *     from three frames to eight, because a longer lead starts the view earlier
 *     in the arc where the body is faster and the view still ends up matching
 *     it. A lead moves the event; it cannot shrink it.
 *   - *A ceiling on the view's own speed* fixes the number and pays for it out
 *     of the other promise. Capped at 2.2 px/frame the same jump reads 2.20 —
 *     and the head goes from 16.10 px of clearance to **15.29**, because slowing
 *     the view is the same thing as letting the head catch up. The two gate
 *     assertions pull in opposite directions, and anything that only ever
 *     removes speed can satisfy one of them.
 *
 * The way out is to spend the travel **before** the margin is reached, and the
 * budget for that is stated as a picture rather than as a taste: `slack` is what
 * is left under the player's feet, and `CAM_GROUND_MARGIN` is how much of it has
 * to stay. Two tiles, which is exactly the thickness of the ground every shipped
 * level's floor is built from — so on a level's own floor there is no slack at
 * all and this whole mechanism is arithmetically absent, which is why every
 * number the gate measured down there comes out unchanged to the pixel. On the
 * shelf there are 46 px of picture under the feet and 14 of them are spendable.
 *
 * That slack is then released by two factors, and the second one is the whole
 * reason this is safe:
 *
 *   - `near`, how far into the top of the window the head has actually come,
 *     ramped from `CAM_AIR_MARGIN` (three tiles) down to `CAM_TOP_MARGIN` (one).
 *     A ramp and not a threshold, because a threshold would hand the view the
 *     whole 14 px in one step and that is the snap again, one tile earlier.
 *   - `push`, whether the jump is **still being pushed**. Zero at
 *     `GRAVITY_HELD_CUTOFF`, the speed the physics itself calls the end of a
 *     held jump, and full at twice it, which is TERMINAL. This is not a taste
 *     either, it is the only thing that separates the two cases: the ledge at
 *     column 38 of the same level is framed exactly like the shelf, and an
 *     ordinary power-0 jump off it comes within **45.8 px** of the top of the
 *     frame while needing nothing from the camera — but it arrives there at its
 *     apex, at a standstill. The shelf's fart jump passes the same line at 3.9
 *     px/frame. Position alone cannot tell them apart, and the gate already
 *     promises that jump 0.00 px of movement (*"the view does not creep upward
 *     during a fall"*). Speed tells them apart exactly.
 *
 * Measured at column 228, power 3, one running fart jump: worst frame **2.73 →
 * 2.17** and the head **16.10 → 16.18**, so the smoothness is bought out of the
 * picture under the feet and not out of the headroom. The take-off shelf stays
 * 32 px above the bottom edge for the whole jump, the view settles 0.08 px over
 * 4 frames after touchdown (unchanged), and the same jump at power 0 — which
 * needs none of this — moves the view 0.07 px instead of 0.00. Every ledge in
 * the fall fixture still reads 0.00.
 *
 * What this is **not** is `CAM_SNAP` coming back. That was a rule about the size
 * of an error and it *created* cuts; this is a limit in the same `Math.min` as
 * `CAM_TOP_MARGIN`, continuous in both directions, and it cannot move the view
 * anywhere the view could not already go. It only decides *when*.
 */
const CAM_AIR_MARGIN = 48;
const CAM_GROUND_MARGIN = 32;

/*
 * ...and the same trick going the other way, which is the half that was left.
 *
 * The owner, after the rise was fixed: "vertical camera movement when falling
 * down from a platform that is above the ground is **still** janky."
 *
 * THE ANCHOR USED TO BE THE FEET, AND THE FEET ARE NOT A SETTLED LINE. During
 * a fall they descend at up to TERMINAL while the ease closes only a quarter
 * of the gap per frame, and an exponential ease chasing a target that moves at
 * v settles exactly `(1 - 0.25) / 0.25 = 3v` behind it. So the view ran 12 px
 * in debt the whole way down — and, because the feet stop dead on contact and
 * the view does not, **it paid that debt off after the player had landed.**
 * Measured, walking or jumping off a real ledge: the view kept moving for 10
 * frames and 6.97 px after touchdown in 4-1, 9 frames and 4.30 px in 2-3, 9
 * and 4.12 in 2-1. That is inertia, and `updateCamera` below says in as many
 * words that inertia is the thing that makes a platformer seasick.
 *
 * The ordinary 15-row levels hid it: 1-1 measured 2 frames and 0.71 px, not
 * because the camera behaved but because a 208-row window leaves only 32 px of
 * vertical travel and the level's own limit pinned the target — and paid the
 * debt — before the feet arrived. The owner said "a platform that is above the
 * ground" for a reason: that is the case where the anchor moves by the whole
 * height of the platform and the debt is real.
 *
 * **The fix is the mirror of CAM_TOP_LEAD: aim where the feet are going, not
 * where they are.** The lead is `vy * 3`, three frames again and for exactly
 * the same arithmetic — three frames of lead cancel a three-frame lag — so
 * during a steady fall the view sits level with the feet instead of 12 px
 * above them.
 *
 * **And it is capped at the drop that is actually left underneath.** This is
 * the part that makes it a landing rather than a lead: `dropBelow()` looks at
 * the tiles under the feet, so when the floor comes within the lead the anchor
 * stops at the line the feet will stop at and waits there. The view is then
 * easing at its final value for the last frames of the fall and arrives with
 * the player instead of behind him: 2.94 px over 7 frames in the worst case
 * (4-1), against 6.97 over 10; 1.81 over 6 in 2-3 against 4.30 over 9; and in
 * 1-1 it stops within a frame, 0.36 px.
 *
 * A fall into a pit answers nothing and needs to: with no floor in reach the
 * cap is infinite, the lead stays `vy * 3`, and the fall is followed the way
 * any fall is until the level's own limit stops the view.
 *
 * **The lead may only grow as fast as gravity could grow it**, and that rate
 * limit is the whole reason `camLead` is remembered from frame to frame. A
 * lead multiplies a velocity, so anything that changes the fall speed in one
 * step moves the target by three times that step — the same trap CAM_TOP_LEAD
 * documents for the fart jump, and here it is the ground pound, which goes
 * from a dead hang to 7.5 px/frame between two frames. Ungoverned, the view's
 * own speed then changed by **6.79 px between two frames** at the start of a
 * dive where the old code changed it by 1.87 — a snap by the owner's own
 * definition, a big number on one frame. Governed it is 1.75, which is under
 * what the code it replaces did. An ordinary fall is untouched because a
 * falling body's speed grows by exactly GRAVITY per frame and the limit never
 * binds. The same limit covers the other way a floor can vanish in one frame:
 * a crumbling plank, or sliding off the edge of the thing you were about to
 * land on.
 *
 * The dive pays for that safety in lead and therefore in debt: 8.47 px over 11
 * frames after a pound in 2-3, against 11.51 over 12 before. Better, not gone,
 * and the number is asserted at what it is.
 */
const CAM_FALL_LEAD = 3;

/*
 * ...and the one kind of level where none of the above is the right answer:
 * a climb (`vertical: true`).
 *
 * A vertical level is exactly one screen wide — 20 columns, because VIEW_W is
 * 320 and TILE is 16 — and many screens tall. The exit is at the top (or, for a
 * level that digs, at the bottom) rather than at the right edge, falling is a
 * setback and not a death, and the whole level is one continuous climb. On that
 * shape the eased follow above is wrong in a way no amount of tuning fixes: it
 * would spend the entire level in motion, because on this axis the player is
 * always going somewhere, and a picture that never holds still is a picture you
 * cannot read a jump off.
 *
 * So the view **holds absolutely still, and then pages**. When the line the
 * framing hangs from leaves a band at the edge of the frame, the view moves in
 * one step and puts the player back near the *opposite* edge, so the ground
 * they are climbing into is already on screen when they arrive. Between pages
 * `cam.y` does not move by a pixel.
 *
 * **THIS IS A HARD CUT, AND IT IS NOT `CAM_SNAP` COMING BACK.** That sentence
 * needs the next four paragraphs, because `CAM_SNAP` was deleted hours before
 * this was written and the next reader deserves to know which of the two they
 * are looking at.
 *
 *   - **`CAM_SNAP` fired on a distance, this fires on a crossing.** `CAM_SNAP`
 *     said "if the view is more than 48 px from where it wants to be, stop
 *     easing and jump" — a rule about the size of an error, which cannot tell a
 *     view that is behind because the player warped from a view that is behind
 *     because the player landed on a tall platform. It could not, and it fired
 *     on the landing. This fires when the player has left a *named band of the
 *     window*: it is a rule about where the body is in the picture, and there
 *     is no error for it to misread.
 *   - **`CAM_SNAP` was a catch-up, this is the only thing that moves the view.**
 *     There is no ease underneath it to outrun. A vertical level's camera is
 *     "still, page, still" and nothing else, so the cut is not the failure mode
 *     of a smooth mechanism, it *is* the mechanism — for legibility, the same
 *     way a comic strip cuts between panels rather than panning.
 *   - **`CAM_SNAP` protected nothing: measured across all 30 levels it fired
 *     zero times.** This fires by construction, several times per climb, and if
 *     it ever stops firing the level has become unreadable rather than smooth.
 *     A gate that never fires and a gate that always fires are not the same
 *     kind of thing, and the measurement is the difference.
 *   - **`CAM_SNAP` applied to every level, this applies to none of the existing
 *     ones.** It is behind `def.vertical`, which no shipped level sets, so the
 *     30 levels that measured `CAM_SNAP` at zero execute not one line of this.
 *     `verify.mjs` records `cam.x`/`cam.y` per frame over a scripted run of
 *     every shipped level at two power levels and compares the whole recording
 *     with the one taken before this landed: identical to the fourth decimal,
 *     900 frames a level.
 *
 * **THE TRIGGER IS `camAnchor`, AND THAT CHOICE IS THE WHOLE DESIGN.** The
 * anchor is the last feet position the player actually *settled* at (see
 * `updateCamAnchor`): it moves the frame the feet touch down, it moves on any
 * downward move because you must see what you are falling towards, and it
 * deliberately does **not** move while a jump is rising. Hanging the page off
 * it buys three things that a page hung off the body itself does not:
 *
 *   1. **A page can never interrupt a jump mid-arc.** The apex of a jump does
 *      not move the anchor, so it cannot reach a band, so it cannot page. This
 *      is the answer to the question the owner asked about freezing the player
 *      during the page: measured over the fixture climb, pages taken while a
 *      jump was still rising = **0 of 5**, at power 0 and at power 5, with the
 *      page as a cut and as a twelve-frame pan alike. There is no mid-arc page
 *      to protect the player from.
 *   2. **It cannot oscillate**, which is the failure mode of every page hung
 *      off the head. Paging up on the head at its apex and then letting the
 *      body fall back to the platform it took off from puts the feet under the
 *      new frame, which pages straight back down — a flicker for a jump that
 *      went nowhere. Arithmetically it is not tunable away: a page of D is
 *      safe only while D ≤ viewH − 32 − h − J, and at the tallest size with
 *      the fart jump (h = 43, J = 174) that is **−41 px**. The anchor holds
 *      through the arc, so the case does not arise at all.
 *   3. **A fall still pages promptly downward**, because the anchor tracks a
 *      fall on the frame it happens. Falling in a climb is ordinary — it is
 *      the level's own way of punishing a miss — so the view has to show what
 *      is underneath while you are still in the air, and it does.
 *
 * `CAM_PAGE_EDGE` is the band at each edge of the window that triggers the
 * page, and `CAM_PAGE_LAND` is how far from the *opposite* edge the page then
 * puts the anchor. Both are stated in the window rather than in the world, for
 * the same reason `CAM_TOP_MARGIN` is: what they describe is a body's place in
 * the picture.
 *
 * **THE PAGE IS NOT A WHOLE SCREEN, AND THAT IS ARITHMETIC RATHER THAN
 * TIMIDITY.** The owner asked for a page of a screen. Three numbers make that
 * impossible in this engine and they are all measured:
 *
 *   - the window is **208 px, 13 tiles** (160 and 10 if the level is
 *     letterboxed),
 *   - a running-held jump rises **85 px, 5.3 tiles**, and the tallest body is
 *     **43 px**,
 *   - the largest step a climb may be built at is `wallTiles` = **4 tiles**,
 *     which is what `src/data/rules.js` measures a climb against.
 *
 * The last one is what fixes `CAM_PAGE_LAND`. After a page the anchor has to
 * come to rest far enough from the *opposite* band that one ordinary hop
 * cannot push it back over — otherwise a player stepping between two platforms
 * either side of a boundary pages the view back and forth for a 48 px move,
 * which is a strobe rather than a camera. So `CAM_PAGE_LAND − CAM_PAGE_EDGE`
 * must exceed one maximal hop: 112 − 32 = **80 px, five tiles, against a
 * four-tile hop**. What is left over is the page itself, `viewH −
 * CAM_PAGE_LAND − CAM_PAGE_EDGE` = **64 px at the least and 96 px in the
 * ordinary case**, four to six tiles of a thirteen-tile window. A page of a
 * whole screen would leave nothing for the hysteresis and the strobe would be
 * the feature.
 *
 * **And the page alone cannot keep the head in the frame** — see
 * `applyPageView`, which is where `CAM_TOP_MARGIN` turns up again and why it
 * has to.
 */
const CAM_PAGE_EDGE = 32;
const CAM_PAGE_LAND = 112;

/*
 * How many frames a page takes, and therefore how long the player is frozen.
 *
 * **Zero, and that is a measurement rather than a preference.** The owner's
 * instinct was a held beat — "you freeze the character while the camera moves,
 * and then play continues" — and it is arcade-correct in the games it comes
 * from. Both were built and both were measured on the same fixture climb, one
 * page length against the other:
 *
 *   | page length | control lost | new ground shows | pages mid-rise | climb |
 *   | 0 frames    | 0 frames     | the same frame   | 0 of 5         |   779 |
 *   | 12 frames   | 60 frames    | 12 frames later  | 0 of 5         |   899 |
 *
 * A freeze buys exactly one thing: it stops the player acting on a picture
 * they have not read yet. The anchor rule above has already bought that — a
 * page only ever happens on a landing or during a fall, never while a jump is
 * rising — so the freeze is paid for and delivers nothing, twice over: the new
 * ground is on screen a whole page *earlier* without it, and a second of the
 * climb is given back.
 *
 * ## JA OMISTAJA KATSOI SITÄ, JA SE OLI VÄÄRIN
 *
 * Se mittaus on yhä tuossa yllä ja se on yhä totta. Mitä se **ei** mitannut on
 * se mitä leikkaus tekee silmälle: 6-K:ta pelatessa raportti kuului *"the
 * vertical camera scroll is too fast; it needs to feel deliberate"*. Nollan
 * framen sivu ei ole nopea vaan **olematon** — kuva vaihtuu kokonaan yhdellä
 * framella, eikä mikään kerro että liikuttiin. Mittarit sanoivat sen hinnaksi
 * nolla, koska ne mittasivat hallinnan menetystä ja uuden maan näkymistä,
 * eivätkä kumpikaan näe leikkausta.
 *
 * **Kuusikymmentä framea, eli sekunti, ja se on omistajan päätös.** Se maksaa
 * täsmälleen sen mitä taulukko sanoo sen maksavan, ja se hinta hyväksytään:
 * pystykenttä on kentän muoto jossa liikkeen suunta on se asia jota pelaaja
 * lukee, ja sivu joka kestää on se joka kertoo suunnan. Kello ei käy sivun
 * aikana (`updateTimer` on freezen takana), joten beat ei maksa aikaa — vain
 * hallintaa, ja vain silloin kun kuva vaihtuu.
 *
 * Musiikki jatkuu, ja se on osa pyyntöä eikä sattuma: `Music` on omalla
 * kellollaan eikä sitä ajeta `update`sta, joten pysähtyvä kuva liikkuvan
 * musiikin päällä lukee kameratyönä eikä kaatuneena pelinä. Sama syy kuin
 * `tick`illä, joka on tarkoituksella freezen ulkopuolella.
 */
const CAM_PAGE_FRAMES = 60;

/*
 * Cinemascope, for the levels that ask for it (`letterbox: true`).
 *
 * The bars are a **crop, not a mask**. Widescreen is a narrower window on the
 * world, not the same window with paint over its edges, so the camera's
 * vertical range narrows by exactly what the bars cover — see `viewH`. Pasting
 * bars over the usual 208 rows would show the same picture and only take away
 * the part of it you were reading.
 *
 * 24 px a side leaves a 320x160 window: 2.00:1, ten tiles tall.
 *
 * **Tässä luki että pelin korkein hyppy nousee 100 px, ja se oli vanhentunut
 * mittaus load-bearing-vakion vieressä.** `tools/jump-budget.json` sanoo 100
 * px P-vauhdin hypystä ja **174 px juoksuhypystä pierupompulla** — pelin
 * korkein on jälkimmäinen. Ja kun aavikon lattialla seisovan pelaajan pää on
 * 102 px nauhan yläreunan alapuolella, oikea luku kääntää koko päätelmän
 * nurin: **huippu ei mahdu ruutuun ennen kuin kamera nousee mukana**, vaan
 * kamera on osa lupausta eikä sen varmistus.
 *
 * Palkki jää 24 px:ään, koska mitattu kamera nostaa näkymää nousun mukana (ks.
 * `camAnchor` ja `CAM_V_EASE`) eikä yksikään mitattu hyppy 2-1:ssä tai
 * 2-3:ssa poistu ruudusta. Mutta perustelu on nyt se mikä sen pitääkin olla:
 * *kamera kantaa 174 px:n hypyn*, ei *hyppy mahtuu paikallaan*. Kumpi tahansa
 * niistä lukee saman vakion vieressä, mutta vain toinen on totta.
 */
const LETTERBOX_BAR = 24;

/** Kova katto tärinälle. Kuusi pikseliä on kuva joka tärähtää; enemmän on rikki. */
const SHAKE_MAX = 6;

/*
 * TÄRINÄN MUOTO SUUNNITTAIN. Painot kertovat mikä osuus voimakkuudesta menee
 * kummallekin akselille, ja `both` on tasan se leveä ellipsi jota koko peli on
 * aina tärissyt (x täysillä, y 60 %) — eli jokainen kutsupaikka joka ei sano
 * suuntaa saa täsmälleen sen mitä se on ennenkin saanut.
 *
 * Suunnatut ovat puhtaita eivätkä painotettuja: pystyisku ei liikuta kuvaa
 * sivuun *lainkaan*. Puolikas sivuliike tekisi pystyiskusta vain kapeamman
 * ympyrän, ja silloin ero olisi taas makuasia eikä merkki.
 */
const SHAKE_AXES = {
  both: { x: 1, y: 0.6 },
  x: { x: 1, y: 0 },
  y: { x: 0, y: 1 },
};

/*
 * PALETTISIIRTO TAPAHTUMIIN. Kolme tapahtumaa, yksi mekanismi, ja luvut tässä
 * eikä kutsupaikoissa — koska niiden *keskinäiset* suhteet ovat koko asia:
 * osuma on nelinkertainen huoneeseen nähden ja kymmenkertainen tähteen.
 *
 *   - `hurt`  Punainen valo koko kuvan yli (`screen`), koska tapahtuman pitää
 *             näkyä myös siellä missä kuva on jo tumma. Kerto olisi tehnyt
 *             sinisestä taivaasta violetin, eikä "taivas muuttui violetiksi"
 *             ole se lause jonka osuman pitää sanoa. Että se ei silti ole
 *             välkkyvä salama, on kahden luvun asia: yksi välähdys per osuma,
 *             ja osumia rajoittaa `invuln` 110 framea eli 0,55 Hz.
 *   - `star`  Lämmin kulta, ja niin pieni että se on tunnelmaa eikä varoitus.
 *             Jakso 46 framea = 1,3 Hz, ja viimeiset 138 framea 23 framen
 *             jaksolla = 2,6 Hz. Molemmat alle kolmen (WCAG 2.3.1), ja 138 on
 *             sekä 46:n että 23:n monikerta, joten tahdin vaihto osuu aallon
 *             pohjalle. Katso `paletteShift`.
 *   - `boss`  Lämmin, hieman tumma huone. Nousee sisään 40 framessa, jotta se
 *             ei ole kentän ensimmäisen framen kohtaus vaan paikan väri.
 */
const PALETTE = {
  hurt: { r: 255, g: 40, b: 30, amount: 0.42, mode: 'screen' },
  star: { r: 255, g: 214, b: 96, peak: 0.14, period: 46, hurried: 23, hurryAt: 138 },
  boss: { r: 255, g: 190, b: 168, amount: 0.3, ramp: 40 },
};

/*
 * Going into something, and coming out of it somewhere else.
 *
 * One mechanism serves the warp pipes and the fortress door, because they are
 * the same event: the player stops being an actor, slides out of sight behind a
 * piece of the level, the picture holds for a beat, and then something else
 * happens. Two implementations of that would drift apart on exactly the details
 * that matter — who can hurt you while you are inside, what a quicksave taken
 * mid-slide contains — so there is one, `Player.transit`, and both callers fill
 * in the same fields.
 *
 * Thirty-odd frames in total. Long enough to read as travelling and short
 * enough that a player who knows the pipe is there is not made to watch it.
 */
const TRANSIT_IN = 14;        // sliding into the mouth, until the body is gone
const TRANSIT_HOLD = 5;       // the beat where nothing is on screen
const TRANSIT_OUT = 13;       // and back out at the far end

/*
 * How far above the ground a ceiling pipe's mouth may be and still be enterable.
 *
 * Pressing **down** needs no reach: gravity holds the feet against the tile
 * they are standing on, so the mouth is exactly the tile under the feet.
 * Pressing **up** has no such contact — the player stands on the floor and the
 * mouth hangs from the ceiling some pixels above the head.
 *
 * **Measured from the feet, not from the head, and that is the whole point.**
 * The reach used to be one tile over the head, which reads like "stand under
 * the mouth" and is not: the six bodies are 16, 26, 30, 34, 38 and 43 px tall,
 * so with the floor and the mouth both fixed, the gap over the head is a
 * different number for every power level, and a single tile of slack cannot
 * span 27 px of it. Measured on the shipped rooms: exactly three of the six
 * sizes could enter any given ceiling pipe, and which three depended on how
 * high the mouth was hung. That is "be exactly this tall" wearing the other
 * rule's comment.
 *
 * From the feet it is one number for everybody. Three tiles is the tallest
 * body (43 px, 2.7 tiles) rounded up to a whole row, so the rule is: the mouth
 * hangs no more than a body-height above the ground you are standing on, and
 * it is above your head. Every size then enters the same pipe from the same
 * floor — which is what a pipe in the ceiling looks like it should do.
 */
const WARP_UP_REACH = 3 * TILE;

/*
 * MUSIIKKI ON PAIKKA, LÖYTYMINEN ON TAPAHTUMA.
 *
 * The hidden cave band gets its own track (`cave` in audio.js — Grieg, and see
 * DESIGN.md kohta 1 b for why an 1875 piece is allowed in here at all). The
 * question that had to be answered before a single note was written is the one
 * DESIGN.md kohta 8 asks: arriving in a hidden band **is** finding the secret,
 * and the find already has its signals — `noteSecret` writes it, the pipe
 * sweeps, the map's secret counter goes up. Two signals saying "something
 * happened" one after the other teach the player to read the wrong one.
 *
 * So the music is not allowed to be a second announcement. It has to say a
 * different kind of thing, and the difference it says is this:
 *
 *   - a find is an EVENT: instantaneous, once ever, and it fires at the moment
 *     the journey is decided — before the player has arrived anywhere.
 *   - the music is a PLACE: it does not sting on arrival, it is simply what
 *     this room sounds like for as long as you are standing in it, it sounds
 *     exactly the same on your fifth visit as on your first, and it stops when
 *     you leave.
 *
 * Three things in the code follow from that, and they are the reason this is
 * not one line in `tryWarp`:
 *
 *   1. It is driven from where the feet are, every frame, by the same
 *      measurement `noteBand` uses (`bandAt`) — not by the warp, not by a flag
 *      set on arrival. A place is a position, so a position is what is asked.
 *   2. Nothing happens while the player is travelling. A track change on the
 *      frame the pipe swallows him would land on top of the find and be exactly
 *      the second signal this is avoiding. The room starts sounding like itself
 *      once he is standing in it, roughly half a second later.
 *   3. `BAND_MUSIC_DWELL` keeps the music off the arrival itself. Waiting for
 *      the transit to finish is not enough on its own: a switch on the frame
 *      the body pops back out of the pipe would simply be the last beat of the
 *      journey, and the journey is the event. The dwell decouples them, so the
 *      room starts sounding like itself while the player is already standing in
 *      it doing something else. It is also what separates a place from a
 *      passage — a place is somewhere you are still in a moment later. Measured
 *      in `verify.mjs`: the find lands on frame 0, control comes back on frame
 *      31, and the music arrives on frame 54.
 *
 * The dwell is symmetric, which also gives leaving a short tail instead of a
 * cut. Twenty-four frames is long enough to be nobody's idea of a sting and
 * short enough that a player walking into the room hears it as the room rather
 * than as a delayed reward.
 *
 * One case the dwell does *not* carry, so that nobody trusts it for the wrong
 * reason: falling into a bottomless pit crosses under the seam into the cave
 * band — measured, for exactly one frame — before the lava lid kills you. What
 * keeps that silent is the death gate below (`state !== 'play'`, `p.dying`),
 * because by the time the check runs the fall has already been fatal. Both
 * guards are tested; neither is standing in for the other.
 */
const BAND_MUSIC_DWELL = 24;

/*
 * The sky band (`sky_garden`, `fac_loft`) keeps the level's own music, and that
 * is a decision rather than an omission.
 *
 * The obvious-looking move is "hidden band → special music", but that is the
 * §8 mistake wearing a disguise: one track for two opposite places would mean
 * "you are in a secret" and not "you are underground", and a sound that means
 * "you found something" is precisely the second find-signal. The cave track
 * says something specific and diegetically-shaped — it is dark down here,
 * something lives in it, do not linger — and a sunlit garden on a beanstalk is
 * none of those things.
 *
 * The picture agrees, which is the other half §8 asks for: the cave band is
 * already washed dark by `drawUnderground`, so the music joins a signal that is
 * continuously there. The sky band has no such wash, because it is sky.
 */
const CAVE_BAND = 2;
const CAVE_TRACK = 'cave';
/** Ks. `trackFor` ja `updateStarMusic`, ja raita itse `core/audio.js`:ssä. */
const STAR_TRACK = 'star';

/*
 * The fortress door, from the boss falling over to the level ending.
 *
 * The door takes half a second to swing. `onBossDefeated` already had a sound
 * for it (`Sfx.play('door')`) and no picture, which is the half of DESIGN.md §8
 * that goes unnoticed; now the leaves actually move.
 *
 * `bossDefeated` stops being `true` and becomes **the tick the boss fell**,
 * because that is a number the save state already carries (so does `tick`), and
 * a swing derived from those two survives a quickload without a new field in
 * `savestate.js` — which this agent may not edit. It stays truthy, so every
 * existing reader is unaffected, and an old snapshot restoring `true` reads as
 * "opened long ago", which is exactly right.
 */
const DOOR_OPEN_FRAMES = 30;

/*
 * VAUHTIMITTARIN KAKSI SYKÄYSTÄ.
 *
 * DESIGN.md kohta 8 nimeää tämän efektin itse — "koko ruutu sykkii kun
 * P-mittari täyttyy" — esimerkkinä siitä milloin ei-diegeettinen kerros saa
 * reagoida maailmaan. Se on tässä otettu kirjaimellisesti, ja kolme päätöstä
 * seuraa siitä suoraan:
 *
 *   - **Pelialue, ei HUD.** Mittari vilkkuu HUDissa jo nyt, ja juuri se on
 *     ongelma: HUD-palkki on 320x240-ruudun alalaidassa ja pelaajan silmä on
 *     kentässä. Toinen merkki samaan palkkiin olisi ollut sama merkki
 *     uudestaan. Sama raja pitää myös yhteen kohdan 8 omista päätöksistä:
 *     kuumuus, huurre ja bloom eivät kosketa HUDia, koska HUD ei ole ikkuna
 *     maailmaan.
 *   - **Väri on mittarin oma.** #f0b000 on se sävy jolla syttynyt pykälä
 *     piirretään, joten kuva osoittaa lähteeseensä sanomatta sitä. Se ei ole
 *     pomon ruskea eikä maahaniskun kaasunvihreä, eli se ei syö kummankaan
 *     lukutapaa.
 *   - **Vastapari on pimeä eikä toinen väri.** Etu tulee ja etu menee ovat
 *     sama tapahtuma kahteen suuntaan, ja tämän tiedoston tapa erottaa
 *     sellainen pari on **napaisuus** eikä sointi (`sprout`/`dive`,
 *     `kurnutus`/`loikka`). Valo tulee, valo menee. Menevä on lyhyempi kuin
 *     tuleva, koska se soi useammin.
 */
const SPEED_PULSE_FULL = 14;
const SPEED_PULSE_SPENT = 9;

/* Telemetry: "stuck" means no new ground gained for this many frames. Eight
 * seconds is long enough that a careful player lining up a jump is not counted,
 * and short enough that a wall someone cannot pass shows up on the first try. */
const STUCK_FRAMES = 480;
const STUCK_PROGRESS = 8;     // px of new ground that counts as progress

/* How long a crumbling platform holds. Just under a second: long enough to
 * cross two of them at a walk, short enough that standing still is a mistake. */
const CRUMBLE_FRAMES = 52;
/** And how long the hole stays before the tile comes back. */
const CRUMBLE_REGROW = 220;

/*
 * PUTOAVA LAATTA — möykky (`T.LUMP`), ks. `src/gfx/tiles.js`.
 *
 * `FALL_HANG` on varoitus ja se on ensin: möykky tärisee paikallaan 12 framea
 * ennen ensimmäistä askeltaan, samalla liikkeellä kuin mureneva lauta, koska
 * pelaaja on jo oppinut lukemaan sen. **Mikä voi satuttaa, sen pitää näkyä.**
 *
 * `FALL_STEP` on ruutu viittä framea kohti eli 3,2 px/framea. Se on nopeampi
 * kuin kävely (1,5) ja hitaampi kuin pelaajan putoamisen huippunopeus
 * (TERMINAL 4,0), eli sen alta ehtii pois jos lähtee heti — ja juuri se on
 * mitattava ero varoituksen ja ansan välillä. Askelittain eikä pikselettäin,
 * koska laatta on ruudukossa: puolikkaassa ruudussa oleva maastopala olisi
 * ruutu jota `tileAt` ei osaa vastata.
 *
 * `FALL_REGROW` on 240 framea lepäämisen alusta, hitusen enemmän kuin
 * murenevan laudan 220. Sen jälkeen möykky on takaisin kotiruudussaan ja
 * kenttä on merkki merkiltä se jonka `playable.mjs` mittasi.
 */
const FALL_HANG = 12;
const FALL_STEP = 5;
const FALL_REGROW = 240;

/*
 * VALUVA HIEKKA — juoksuhiekka (`T.QUICKSAND`) tottelee painovoimaa.
 *
 * IDEAS-synteesi E, tuomio 16.8.2026 "tee, ennen pomoa". Riko lammikon alta
 * tuki ja hiekka valuu alas ja täyttää sen mihin se putoaa.
 *
 * **Miksi hiekka eikä möykky, vaikka möykky putoaa jo.** Möykky on yksi laatta
 * joka putoaa ja **palaa kotiin**, ja paluu on koko sen turvallisuus: kenttä on
 * hetken toisenlainen ja sitten taas se kenttä jonka portit todistivat. Hiekka
 * ei palaa. Se on tämän ominaisuuden koko idea (*"täyttää sen mihin se
 * putoaa"*) ja samalla se ainoa asia joka tässä on oikeasti uutta pelin
 * moottorille: **lopputila on eri kenttä kuin lähtötila**, ja siksi
 * `verify.mjs` validoi nyt lopputilan eikä vain lähtötilaa (ks. IDEAS.md kohta
 * "emergenssi saa koskea vain sitä mikä ei ole reitti").
 *
 * Se on turvallista tasan siksi että **hiekka ei ole reitti**. Se ei ole
 * kiinteä eikä puolikiinteä; sen päällä ei seistä ja sen läpi ei kuljeta.
 * Poistuva hiekka ei voi siis poistaa askelmaa, ja saapuva hiekka ei voi
 * tukkia käytävää — se voi tehdä yhden asian, upottaa siihen mihin se tuli, ja
 * juuri sen portti mittaa.
 *
 * `POUR_STEP` on ruutu neljää framea kohti eli 4,0 px/frame. Nopeampi kuin
 * möykky (3,2), ja se on ero jonka pitää näkyä: möykky on massa joka uhkaa,
 * hiekka on aine joka valuu. Se on myös tasan pelaajan putoamisen
 * huippunopeus, eli hiekan mukana pudotessa se pysyy jalkojen tasalla.
 *
 * Ja varoitusta (`FALL_HANG`) ei ole, mikä on päätös eikä unohdus: möykky
 * lähtee liikkeelle **pelaajan alta** ja tarvitsee sen puolen sekunnin, hiekka
 * lähtee liikkeelle vasta kun joku on rikkonut sen tuen — eli hiekan varoitus
 * on se lyönti jonka pelaaja itse teki.
 */
const POUR_STEP = 4;

/* How long a switch runs. Ten seconds is enough to cross a room and get back,
 * and short enough that it is a window rather than a new normal. */
const SWITCH_FRAMES = 600;
/** It starts flashing this long before it ends, so the end is never a surprise. */
const SWITCH_WARN = 150;

/**
 * How far above its floor a beanstalk's bean block hangs, in tiles.
 *
 * Four is the bump row: three clear rows over the floor, which is exactly the
 * tallest body (`RULE_CONSTANTS.HEAD`), so every size can stand under it and
 * every size can put its head into it. It is exported because `rules.js` keeps
 * its own copy — the validator may not import a scene — and `verify.mjs`
 * asserts that the two agree, the same arrangement the secret-brick rates have.
 */
export const BEAN_BLOCK_OVER_FLOOR = 4;

/** The star's HUD readout cycles the same colours the player does. */
const STAR_HUD_COLORS = ['#fff070', '#ffffff', '#8fe04a', '#78c0ff'];

/*
 * Some ordinary bricks are hiding something.
 *
 * Which ones is a pure function of the tile's position, so it is the same brick
 * every time anyone plays that level — a secret you can learn and then show a
 * friend, rather than a lottery. It also needs no level data and no save-state
 * field, and it applies to every world at once, including generated ones.
 *
 * The rates were first set at 1-in-40 and 1-in-300, "deliberately mean". That
 * was calibrated for a game with thousands of bricks. This one has **186 in
 * total**, so those rates hid about five surprises in the entire game and one
 * power-up in every other playthrough — a feature nobody would ever meet.
 *
 * These numbers are **calibrated by counting, not by intent**. Brick positions
 * are structured — rows and blocks, not scattered points — and the hash is not
 * uniform over them: a nominal 16 % came out at 30 % when measured across all
 * 186. So the rates were tuned against the real level data until the count was
 * right, and `verify.mjs` asserts the measured share rather than the constants.
 *
 * As set, the whole game holds 23 coin bricks and 6 power bricks — one or two
 * per level. Often enough that hitting a brick is worth a try, rare enough that
 * hitting every brick is still a waste of a clock that is counting down.
 */
const SECRET_COIN_RATE = 0.07;
const SECRET_POWER_RATE = 0.015;

export class LevelScene {
  /**
   * @param {object} game
   * @param {string} levelId
   * @param {object} [def] a level definition to build instead of looking the id
   *   up. The one caller is `tools/verify.mjs`, and it is the same seam and the
   *   same reason as `scoreRows` in `tools/difficulty.mjs`: a rule proved only
   *   against shipped content is a rule proved against content that happens to
   *   be right, and a fixture for a level *shape the game does not have yet*
   *   cannot be a shipped level without shipping it. Omitted everywhere else,
   *   so the lookup is what the game does.
   */
  constructor(game, levelId, def) {
    this.game = game;
    /* Vaikeustaso luetaan pelistä eikä kentästä, ja se annetaan `getLevel`ille
     * eikä asetettu mihinkään globaaliin: kartan salaisuuslaskuri ja portti
     * kysyvät samaa kenttää ilman tasoa ja saavat sen mitä datatiedostossa
     * lukee. Ks. `src/data/scale.js`. */
    this.mode = (game && game.mode) || undefined;
    this.def = def || getLevel(levelId, this.mode);
    this.id = levelId;
    this.theme = this.def.theme;

    this.grid = this.def.rows.map((row) => row.split(''));
    this.h = this.grid.length;
    this.w = this.grid[0].length;
    this.widthPx = this.w * TILE;
    this.heightPx = this.h * TILE;

    this.entities = [];
    this.bumps = new Map();
    /* Crumbling platforms: "tx,ty" → frames stood on. Same shape as `bumps`,
     * which is deliberate — the save-state code already knows how to store a
     * per-tile timer map, so this costs one line there instead of a design. */
    this.crumbles = new Map();
    /* Pieruhyllyt: avain "tx,ty" → jäljellä olevat framet. Ks. `gasShelf`. */
    this.shelves = new Map();
    /* Liikkeellä oleva hiekka: avaimet "tx,ty". Ks. `updatePours`. */
    this.pours = new Set();
    /* Liikkeellä olevat möykyt: kotiruutu "ox,oy" → missä se nyt on ja kuinka
     * kauan se on ollut matkalla. Avain on **kotiruutu eikä nykyinen paikka**,
     * koska se on se ainoa asia joka ei muutu — ja se on myös se paikka johon
     * laatta palaa, eli koko turvallisuusargumentti mahtuu avaimeen. */
    this.falls = new Map();
    /* A switch is one number, not a rewritten grid — see `tileAt`. That is what
     * makes it impossible for an expiring switch to leave the level in a broken
     * half-state, and what makes the save state need one field instead of a
     * second copy of the map. */
    this.switchTimer = 0;
    /* Which band the music is currently the sound of, and how long the feet
     * have disagreed with it. Derived, never saved: `enter` re-reads both from
     * the player's feet, so a restored snapshot cannot come back believing it
     * is somewhere it is not. See BAND_MUSIC_DWELL. */
    this.placeBand = 1;
    this.bandHold = 0;
    /* Onko tähtiraita se joka soi. Johdettu ja tallentamaton kuten `placeBand`:
     * `enter` lukee sen pelaajan tähdestä, joten pikatallennus kesken tähden
     * palaa kesken tähteä eikä jää soittamaan huoneen raitaa. */
    this.starMusic = false;
    this.bar = this.def.letterbox ? LETTERBOX_BAR : 0;
    /** How much level the view actually shows. Everything vertical reads this. */
    this.viewH = VIEW_H - 2 * this.bar;
    this.cam = { x: 0, y: 0 };
    this.camLook = 0;
    /** The feet line the framing hangs from — see CAM_TOP_MARGIN. */
    this.camAnchor = 0;
    /** How far ahead of the feet that line is aimed — see CAM_FALL_LEAD. */
    this.camLead = 0;
    /** A climb, and therefore a paging camera. See CAM_PAGE_EDGE. */
    /*
     * OSIOITU KENTTÄ: KAMERAN KIELI VAIHTUU MATKAN VARRELLA.
     *
     * Kaksi kameratilaa puhuvat tarkoituksella vastakkaista kieltä —
     * vaakakenttä seuraa pehmeästi ja liikkuu koko ajan, pystykenttä seisoo
     * paikallaan ja **leikkaa** sivun kerrallaan. Jos ne vain yhdistäisi,
     * tulos olisi kamera joka liukuu sivulle ja nykii ylös, ja se lukee
     * rikkinäisenä eikä tyylikkäänä.
     *
     * Siksi kenttä ilmoittaa osionsa (`segments`), ja **käänne on sivunvaihdon
     * lyönti**: se beat on jo olemassa ja se on jo maksettu — omistaja pyysi
     * sen pystykenttiin, kello pysähtyy sen ajaksi eikä musiikki. Käänteestä
     * tulee siis tapahtuma eikä saumaa, ja kumpikin kieli säilyy omanaan.
     *
     * `vertical` pysyy tavallisena kenttänä koska koko muu tiedosto lukee
     * sitä; osioitu kenttä vain kirjoittaa sen uudelleen rajan ylittyessä.
     */
    /* Tyhjä lista ei ole osiointi: `Array.isArray([])` on tosi, ja
     * `segments[0].vertical` kaatuisi siihen. */
    this.segments = Array.isArray(this.def.segments) && this.def.segments.length
      ? this.def.segments : null;
    this.vertical = this.segments ? !!this.segments[0].vertical : !!this.def.vertical;
    /** Frames a page takes, 0 for a cut. See CAM_PAGE_FRAMES. */
    this.camPageFrames = CAM_PAGE_FRAMES;
    /** Frames left of a page in flight; while it runs the player is frozen. */
    this.camPage = 0;
    this.camPageFrom = 0;
    this.camPageTo = 0;
    /** The line the page holds the view at, before the headroom net. */
    this.camPageY = 0;
    /** How many pages this climb has taken. Reported, never played on. */
    this.camPages = 0;
    this.tick = 0;
    this.time = this.def.time;
    this.timeSub = 0;
    this.state = 'play';
    this.stateTimer = 0;
    this.bossDefeated = false;
    this.shakeAmp = 0;
    /** Mihin suuntaan tämä tärähdys menee; ks. `shake`. */
    this.shakeAxis = 'both';
    /* Vauhtimittarin sykäys ja sen suunta. Puhtaasti kosmeettinen ja siksi
     * `savestate.js`:n ulkopuolella samasta syystä kuin `shakeAmp`: pikalataus
     * ei ole se hetki jolla mittari täyttyi. Reuna itse on pelaajan päällä
     * (`Player.pBoost`), joten palautettu tallennus ei myöskään keksi sitä. */
    this.speedPulse = 0;
    this.speedPulseUp = false;
    /* What the last ground pound measured, or null if there has not been one.
     * A report of something that already finished, not state the level runs on
     * — which is why it is not in `savestate.js`: a restored snapshot has no
     * impact in flight, and the next one writes this again. */
    this.lastPound = null;
    this.gust = 0;
    this.goal = null;
    this.cardIndex = 0;
    this.wonCard = null;
    this.spawn = { x: 2 * TILE, y: 12 * TILE };

    /*
     * LINNAKKEEN OVI — mistä kuolema palauttaa, kun areenalle on kerran päästy.
     *
     * Kuolema vie karttaruutuun eikä suoraan takaisin kenttään, joten tämä ei
     * ole "kentän sisäinen tarkistuspiste" vaan **se kohta josta kenttä alkaa
     * kun siihen astuu uudelleen**. Siksi se on `game.state`issa ja
     * tallennuksessa eikä kohtauksen omassa muistissa.
     *
     * Vain linnakkeissa, ja se on koko idea. Tavallinen kenttä kestää mitattuna
     * ~31 s parhaimmillaan, ja SMB3-idiomissa se on lyhyt tarpeeksi ilman
     * välipisteitä. Linnakkeen käytävä on 19–24 s, ja se kävellään uudelleen
     * *joka kerta kun pomo voittaa* — eli useammin kuin mikään muu matka
     * pelissä. Ero ei ole pituus vaan toisto.
     *
     * Kello ei nollaudu eikä voimataso palaudu: ovi säästää kävelyn, ei
     * kenttää. Aika-ajo ei siis muutu, koska se mittaa yhtä yhtäjaksoista
     * juoksua eikä sitä montako kertaa siihen on yritetty.
     */
    /*
     * Vain linnake, ja vain kun kelloa ei mitata.
     *
     * `def.boss` ei ole "linnake": maailmassa 8 **jokainen** kenttä 8-1…8-7 on
     * pomokenttä, ja ovi olisi ohittanut niistä ~144 saraketta tavallista
     * kenttää. Perustelu koski linnakkeen toistuvaa käytävää, ei jokaista
     * kenttää jossa sattuu olemaan pomo, joten ehto on linnaketunnus.
     *
     * Ja aika-ajossa ovea ei ole lainkaan: uusinta alkaisi pomon vierestä,
     * `startRace` ankkuroisi lähdön sinne ja `recordRace` kirjoittaisi kentän
     * rehellisen ennätyksen yli kymmenen sekunnin ajalla. Sama päätös kuin
     * taukovalikon tallennuksella, ja samasta syystä.
     */
    const fortress = this.def.boss && /-F$/.test(levelId);
    this.arenaCol = fortress && !game.timeAttack ? arenaColumn(this.def) : null;
    /* `arenaReached` eikä `doorOpen`: `doorOpen` on jo varattu, ja se tarkoittaa
     * *uloskäyntiä* joka aukeaa pomon kaaduttua. Kaksi eri ovea. */
    this.arenaReached = this.arenaCol !== null
      && !!(game.state.doors && game.state.doors[this.id]);

    // Playtest telemetry, tracked per attempt. `bestX` is the furthest the
    // player has got; `stallFrames` counts how long it has stood still.
    this.bestX = 0;
    this.stallFrames = 0;
    this.stuckLogged = new Set();
    this.telemetryDone = false;

    this.scanGrid();
    /* Vasta `scanGrid`in jälkeen, ja se on koko vika ensimmäisessä yrityksessä:
     * `scanGrid` lukee aloitusmerkin ruudukosta ja kirjoittaa `spawn`in yli.
     * Ovi on siis viimeinen sana eikä ensimmäinen. */
    if (this.arenaReached) this.spawn = { x: (this.arenaCol + 2) * TILE, y: 12 * TILE };
    this.plantVines();
    this.plantWarpExits();
    this.plantLamp();
    /*
     * Sytytetty lyhty on lähtöruutu, ja vertailu on saraketta vasten eikä
     * pelkkää "on käyty" — ks. `lightLamp`. Jos vaikeustaso on vaihtunut, tämä
     * ei täsmää ja kenttä alkaa alusta, mikä on oikea vastaus: sarake 190 on
     * eri paikka eri levyisessä kentässä.
     */
    const lampSaved = game.state.checks ? game.state.checks[this.id] : undefined;
    if (this.lampCol !== null && lampSaved === this.lampCol) {
      const lampRow = this.grid.findIndex((row) => row[this.lampCol] === T.LAMP);
      if (lampRow >= 0) {
        this.grid[lampRow][this.lampCol] = T.LAMP_LIT;
        this.spawn = { x: this.lampCol * TILE, y: (lampRow - 2) * TILE };
      }
    }
    this.player = new Player(this, this.spawn.x, this.spawn.y + TILE, game.state.power);
    this.bestX = this.player.x;
    this.centerCamera();

    /*
     * AIKA-AJO on tila johon mennään erikseen, eikä tavallinen kierros saa
     * maksaa siitä mitään. Siksi `race` on `null` aina kun tilaa ei ole
     * valittu: jokainen alla oleva kysely on silloin yksi vertailu eikä
     * mitään lasketa, mitata tai piirretä. Portti ajaa saman kentän saman
     * syötteen samalla arvontasiemenellä tila päällä ja pois, ja vaatii
     * framejonot identtisiksi.
     */
    this.race = null;
    this.raceResult = null;
    if (game.timeAttack) this.startRace();
  }

  /* ------------------------------ aika-ajo ----------------------------- */

  /**
   * Radan alku ja loppu. Vaakakentässä akseli on x ja maali lipputanko;
   * pomokentässä lippua ei ole, joten loppu on kentän oikea reuna, koska ovi
   * aukeaa siellä. Pystykentässä akseli on y ja etumerkki hoitaa suunnan:
   * ylöspäin kiipeävässä `raceTo < raceFrom`, ja osamäärä kääntyy itsestään.
   */
  startRace() {
    const p = this.player;
    this.raceFrom = this.vertical ? p.cy : p.cx;
    this.raceTo = this.vertical
      ? (this.goal ? this.goal.y : 0)
      : (this.goal ? this.goal.x : (this.w - 2) * TILE);
    if (this.raceTo === this.raceFrom) this.raceTo = this.raceFrom + TILE;
    this.race = {
      /** Framea kentän alusta. Kasvaa myös taukovalikossa — ks. `tickPaused`. */
      frames: 0,
      /** Millä framella kukin välipiste ohitettiin, 0 = ei vielä. */
      marks: new Array(RACE_SPLITS).fill(0),
      /** Seuraava ohittamaton välipiste. */
      next: 0,
      /** Ero ennätykseen viimeisellä välipisteellä, null = ei vertailukohtaa. */
      delta: null,
      /** Framea käänteisenä sen jälkeen kun lukema vaihtui. */
      flash: 0,
      best: bestFor(this.game.state, raceKey(this.id, this.mode)),
    };
  }

  /** Kuljettu osuus radasta, 0...1. */
  raceProgress() {
    const cur = this.vertical ? this.player.cy : this.player.cx;
    const span = this.raceTo - this.raceFrom;
    if (!span) return 0;
    return clamp((cur - this.raceFrom) / span, 0, 1);
  }

  /**
   * Ajokello ja jako.
   *
   * Jako liikkuu **vain välipisteillä**, ei joka framella. Jatkuvasti laskettu
   * ero olisi kohinaa: se hyppäisi joka kerta kun pelaaja pysähtyy hetkeksi
   * tähtäämään, ja lukema jota ei ehdi lukea ei ole lukema. Välipisteellä
   * kysymys on täsmällinen — *tässä kohdassa rataa olin viimeksi tällä
   * framella* — ja vastaus pysyy ruudulla siihen asti kun seuraava saapuu.
   *
   * Ääni tulee kuvan kanssa (DESIGN.md kohta 8): kuva yksin jää huomaamatta
   * silloin kun katse on kuilussa, ja juuri silloin jako vaihtuu.
   */
  updateRace() {
    const r = this.race;
    r.frames++;
    if (r.flash > 0) r.flash--;
    while (r.next < RACE_SPLITS && this.raceProgress() >= (r.next + 1) / RACE_SPLITS) {
      r.marks[r.next] = r.frames;
      if (r.best && r.best.marks[r.next] > 0) {
        r.delta = r.frames - r.best.marks[r.next];
        r.flash = SPLIT_FLASH;
        Sfx.play(r.delta <= 0 ? 'edella' : 'jaljessa');
      }
      r.next++;
    }
  }

  /**
   * Kello käy myös taukovalikossa, ja se on tilan koko lupaus: aikaa ei saa
   * ostaa pysäyttämällä peli ja katsomalla kenttä rauhassa.
   *
   * **Kenttäkello ei käy.** Se on eri kello ja se tappaa, ja `updateTimer`
   * sanoo jo miksi sellaista ei tehdä: kello joka voi tappaa pelaajan
   * paikassa jossa asialle ei voi tehdä mitään. Taukovalikko on täsmälleen
   * sellainen paikka. Tauko maksaa siis jaossa muttei hengessä, ja
   * `TAUKO - KELLO KÄY` lukee valikossa, koska sääntö jota ei kerrota on ansa.
   */
  tickPaused() {
    if (!this.race || this.state !== 'play') return;
    this.race.frames++;
    if (this.race.flash > 0) this.race.flash--;
  }

  /** Maali: aika talteen, jos se oli nopeampi. */
  recordRace() {
    const r = this.race;
    if (!r) return;
    const before = r.best;
    const record = setBest(this.game.state, raceKey(this.id, this.mode),
      { frames: r.frames, marks: r.marks });
    if (record) this.game.persist();
    this.raceResult = { frames: r.frames, best: before ? before.frames : null, record };
    if (record && before) Sfx.play('yeah');
  }

  /* ------------------------------ building ----------------------------- */

  scanGrid() {
    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        const ch = this.grid[ty][tx];
        if (ch === '1') {
          this.spawn = { x: tx * TILE, y: ty * TILE };
          this.grid[ty][tx] = ' ';
        } else if (ENEMY_CHARS[ch]) {
          this.entities.push(ENEMY_CHARS[ch](this, tx, ty, this.def.bossVariant || 0));
          this.grid[ty][tx] = ' ';
        } else if (ch === T.GOAL) {
          this.goal = { tx, ty, x: tx * TILE, y: ty * TILE + TILE - GOAL_HEIGHT };
          this.grid[ty][tx] = ' ';
        }
      }
    }
  }

  /**
   * Takes every planted beanstalk back out of the grid and leaves the block
   * that grows it in the vine's place.
   *
   * The level data draws the vine whole — see `chunks/secrets.js` — and that is
   * the level `src/data/rules.js` validates, because a validator handed a grid
   * with no vine in it would quietly stop proving that the sky band can be
   * reached. So the grown level is the written one and the ungrown one is
   * derived here, rather than the other way round: one source of truth, and the
   * thing the gate checks is the thing the player ends up standing on.
   *
   * **A vine is planted when it stands on something.** The tile under its
   * lowest one has to be solid; then the whole run comes out of the grid and a
   * `?` goes into the cell `BEAN_BLOCK_OVER_FLOOR` rows over that floor, which
   * is the bump row and is inside the vine's own column. A vine that ends in
   * mid-air is left exactly where it is drawn — nothing in the game is built
   * that way, and this is the difference between deriving a level and quietly
   * deleting somebody's tiles. `rules.js` asks the same question from the other
   * side and reports a seam-crossing vine that is not rooted.
   *
   * **The vine has to reach the floor and not stop at the block**, and that is
   * a measurement rather than a preference. You take hold of a beanstalk by
   * standing at the bottom of it and pressing up; with the vine starting at the
   * bump row instead — the first thing tried, because a stalk growing out of
   * the top of the block is the obvious picture — the block itself is in the
   * way of the jump, and no power level below 3 could get onto the vine at all.
   * So the block sits *in* the stalk rather than under it, and the growth
   * writes a vine tile straight over the spent block on its way past.
   *
   * The map is rebuilt from the level data by every constructor, which is why
   * it is not in `savestate.js`: a restored snapshot overwrites `grid` with the
   * grid it saved, and this is derived from data that cannot have changed. A
   * vine caught half-grown comes back half-grown because those tiles are in the
   * saved grid and the `Beanstalk` entity carries its own progress.
   */
  plantVines() {
    /** block key "tx,ty" → the run it owns, bottom tile first. */
    this.beanstalks = new Map();
    for (let tx = 0; tx < this.w; tx++) {
      for (let ty = 0; ty < this.h; ty++) {
        if (this.grid[ty][tx] !== T.VINE) continue;
        let foot = ty;
        while (foot + 1 < this.h && this.grid[foot + 1][tx] === T.VINE) foot++;
        const by = foot + 1 - BEAN_BLOCK_OVER_FLOOR;
        if (foot + 1 < this.h && isSolid(this.grid[foot + 1][tx]) && by >= ty) {
          const tiles = [];
          for (let y = foot; y >= ty; y--) {
            tiles.push({ tx, ty: y });
            this.grid[y][tx] = T.EMPTY;
          }
          this.grid[by][tx] = T.QCOIN;
          this.beanstalks.set(`${tx},${by}`, tiles);
        }
        ty = foot;
      }
    }
  }

  /*
   * PUTKESTA TULLAAN ULOS PUTKESTA, ja tämä pystyttää sen toisen pään.
   *
   * Omistajan havainto 16.8.2026: luolasta noustessa hahmo "ilmestyy tyhjästä".
   * Se oli totta ja se oli mitattavissa — **pelin jokainen kymmenestä
   * kaistamatkasta päättyi paljaaseen ilmaan**, eikä yhdenkään päässä ollut
   * putkea. Pahimmillaan neljä ruutua lattian yläpuolelle (1-2, sarake 250:
   * saapuminen rivillä 24, lattia rivillä 28), josta pelaaja tipahti maahan
   * kuin pudotettuna.
   *
   * Syy on `tryWarp`in vanhassa laskussa: se säilyttää **suhteellisen
   * korkeuden** kaistan sisällä (`arriveY = p.y + shift`) ja tarkistaa vain
   * että keho mahtuu ja että jotain kiinteää on jossain alla. Kumpikaan ei ole
   * väärin, mutta yhdessä ne tarkoittavat että matkan pää on se kohta johon
   * lähtökorkeus sattuu osoittamaan — ei paikka.
   *
   * **Ratkaisu on pari, ja se johdetaan datasta eikä kirjoiteta siihen.** Joka
   * suulle etsitään kohdekaistasta se lattiarivi jolle matka päättyy, ja siihen
   * upotetaan putken suu. Pelaaja nousee siitä ylös (ks. `tryWarp`in
   * `farHide`), eli molemmat päät ovat putkia ja matka näyttää matkalta.
   *
   * Kolme päätöstä, ja jokainen on rajaus:
   *
   *   1. **Suu upotetaan lattiaan, ei rakenneta sen päälle.** Kiinteä laatta
   *      vaihtuu kiinteään laattaan, joten kentän geometria ei muutu
   *      pikseliäkään: yksikään reitti, hyppy tai kuilubudjetti ei tiedä että
   *      tässä tapahtui mitään. Kaksi ruutua korkea putki lattian päällä olisi
   *      ollut uusi este keskellä todistettua reittiä.
   *   2. **Uloskäynti on tavallinen putki eikä lämpöputki.** Se ei vie
   *      minnekään, ja juuri siksi se ei saa näyttää siltä että veisi:
   *      lämpöputken oma piirros (`drawWarpPipe`) tarkoittaa tässä pelissä
   *      "tästä pääsee", ja alimmasta kaistasta ei pääse alaspäin mihinkään.
   *      Tavallisia putkia kenttä on täynnä, eikä yksikään niistä lupaa
   *      matkaa. DESIGN.md kohta 8.
   *   3. **Vain kohtauksessa, kuten kaasulyhty.** Kenttädata ja sen
   *      validaattorit näkevät saman kentän kuin ennen; tämä on johdettua
   *      maisemaa jonka kiinteys on identtinen sen kanssa mitä se korvasi.
   */
  plantWarpExits() {
    /** avain `"tx,ty"` (suun vasen ruutu) → se rivi jolle matka päättyy. */
    this.warpExits = new Map();
    const bands = this.def.bands;
    if (!bands) return;
    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        if (!info(this.grid[ty][tx]).warp) continue;
        // Suun suunta on se puoli jolla on ilmaa: lattiassa oleva suu vie alas,
        // katosta roikkuva ylös. Sama kysymys kuin `tryWarp`issa, toisin päin.
        const up = ty > 0 && this.grid[ty - 1][tx] === T.EMPTY;
        const down = ty + 1 < this.h && this.grid[ty + 1][tx] === T.EMPTY;
        if (up === down) continue;              // umpiputken keskiosa
        const dir = up ? 1 : -1;                // ilmaa päällä = matka alaspäin
        const to = ty + dir * bands.rows;
        if (to < 0 || to >= this.h) continue;
        const bandEnd = (Math.floor(to / bands.rows) + 1) * bands.rows - 1;
        let floor = -1;
        for (let y = to; y <= bandEnd; y++) {
          if (isSolid(this.grid[y][tx])) { floor = y; break; }
        }
        if (floor < 0) continue;
        // Suu on kaksi ruutua leveä, kuten jokainen putki tässä pelissä.
        const left = info(this.grid[ty][tx - 1]).warp ? tx - 1 : tx;
        for (const [x, ch] of [[left, T.PIPE_TL], [left + 1, T.PIPE_TR]]) {
          if (x < 0 || x >= this.w) continue;
          // Vain tavallinen maa vaihdetaan. Palkintolohko, mureneva lauta tai
          // toinen putki on jonkun muun päätös, eikä sitä kirjoiteta yli.
          const at = this.grid[floor][x];
          if (at === T.GROUND || at === T.HARD || at === T.ICE) this.grid[floor][x] = ch;
        }
        this.warpExits.set(`${tx},${ty}`, floor);
      }
    }
  }

  /*
   * KAASULYHTY — kentän puolivälin tarkistuspiste, ja se pystytetään tässä
   * eikä kirjoiteta kenttädataan.
   *
   * Perustelu on sama kuin pavunvarrella, mutta toisin päin: varsi on
   * *piirretty* kenttään ja `plantVines` ottaa sen pois, koska validaattorin
   * pitää nähdä se reitti jonka varsi avaa. Lyhty ei avaa mitään — se ei ole
   * kiinteä, ei vaarallinen, eikä se muuta yhtään hyppyä, kuilua tai kattoa —
   * joten yksikään portti ei tarvitse sitä nähdäkseen kentän oikein. Sen
   * kirjoittaminen 17 kentän palikkalistaan olisi maksanut 17 muutosta
   * kenttädataan, uuden vaikeustaulun ja uuden opetusjärjestyksen tarkistuksen,
   * eikä yksikään niistä olisi mitannut mitään uutta.
   *
   * **Kolme ehtoa, ja jokainen on mitattu eikä valittu.**
   *
   *   1. **`LAMP_MIN_COLS` = 340 saraketta.** Täydellä juoksuvauhdilla (2,5
   *      px/frame = 9,4 laattaa sekunnissa) 340 laattaa on ~36 s, eli
   *      puoliväliin kävelee ~18 s. Se on se aika joka kuolemasta menee
   *      uudelleen, ja 18 s on jo pitempi kuin koko linnakkeen käytävä (19–24
   *      s), jonka toisto perusteli oven. Mediaanikenttä on 314 saraketta ja
   *      jää siis ilman lyhtyä tarkoituksella: lyhty ei ole palkinto vaan
   *      korjaus pituuteen. Rajan yli menee 17 kenttää 64:stä.
   *   2. **Vain kerran, ja puolivälissä.** Kaksi lyhtyä tekisi kentästä
   *      jonon huoneita, ja se on eri peli. Puoliväli on ainoa piste joka ei
   *      ole mielipide: se puolittaa pisimmän mahdollisen uusinnan.
   *   3. **Ei pomokentissä.** Siellä on jo ovi, ja ovella on oma perustelunsa
   *      (`arenaCol`). Kaksi tarkistuspistettä samassa kentässä olisi kaksi
   *      vastausta samaan kysymykseen.
   *
   * Ja se mitä lyhty **ei** tee, on yhtä tärkeää: kuolema vie yhä karttaan,
   * maksaa yhä elämän ja pudottaa yhä voimatason. Lyhty säästää kävelyn, ei
   * kenttää — sama lause kuin linnakkeen ovella, ja samasta syystä.
   */
  plantLamp() {
    this.lampCol = null;
    if (this.w < LAMP_MIN_COLS || this.def.boss || this.game.timeAttack) return;
    const mid = Math.floor(this.w / 2);
    /* Ulospäin puolivälistä, ja ensimmäinen kelpaava voittaa. Reunat on
     * rajattu pois: alku on jo tarkistuspiste ja loppu on maalitolppa. */
    for (let d = 0; d < Math.floor(this.w / 2) - LAMP_EDGE; d++) {
      for (const tx of d === 0 ? [mid] : [mid - d, mid + d]) {
        if (tx < LAMP_EDGE || tx >= this.w - LAMP_EDGE) continue;
        const ty = this.lampFooting(tx);
        if (ty === null) continue;
        this.grid[ty - 1][tx] = T.LAMP;
        this.lampCol = tx;
        return;
      }
    }
  }

  /**
   * The row a lamp post can stand on in column `tx`, or null.
   *
   * Ehdot ovat sen paikan ehtoja johon *herätään*, eivät koristeen. Pelaaja
   * ilmestyy tähän ruutuun **paikaltaan, vauhdittomana**, ja siitä seuraa se
   * vaatimus jonka ensimmäinen versio jätti pois ja jonka botti mittasi:
   *
   * **Herätyspaikan edessä pitää olla rauhallista, ja pitkälti.** Ensimmäinen
   * versio vaati kaksi laattaa tasaista molempiin suuntiin, ja portti kaatui
   * viiteen kenttään: 3-3:n lyhty oli kolme laattaa ennen kuuden laatan
   * laavalampea, 3-1:n kolme laattaa ennen kuilua, 3-7:n neljä ennen piikkejä.
   * Kentän alusta juostessa ne kaikki ylitetään täydellä vauhdilla;
   * seisaaltaan ei yhtäkään.
   *
   * `LAMP_RUNUP` = 24 laattaa oikealle, ja luku on mitattu botilla eikä
   * johdettu kiihtyvyydestä. Kiihtyvyys sanoo että täyteen juoksuvauhtiin
   * (`MAX_RUN` 2,5 px/frame, `ACC` 0,0547) menee 46 framea ja 57 px eli 3,6
   * laattaa — ja se osoittautui vääräksi kysymykseksi. Kahdeksalla laatalla
   * neljä viidestä kentästä korjaantui ja 2-1 ei: sen kuilu on kuusi laattaa
   * eli kuilubudjetin maksimi, ja se ylitetään vain oikealla irtoamishetkellä.
   * Lyhdyltä lähtevä juoksu osuu siihen eri vaiheessa kuin kentän alusta
   * lähtevä, ja mitattuna se putosi. 24 laattaa siirtää lyhdyn niin kauas
   * seuraavasta kuilusta ettei vaihe ratkaise.
   *
   * Sama luku on myös oikea pelaajalle eikä vain botille: paikka johon
   * herätään ilman muistia siitä mitä edessä on, ei saa olla kuilun reunalla.
   * Vasemmalle riittää `LAMP_CLEAR`, koska taaksepäin ei tarvitse ottaa
   * vauhtia mihinkään — se suunta on jo pelattu.
   *
   * Hinta on kirjattava: lyhty ei ole enää puolivälissä vaan **lähimmässä
   * rauhallisessa paikassa** puolivälin ympärillä, ja mitattuna se on 35–72 %
   * kentästä. Rajattu haku (±15 % puolivälistä) olisi pitänyt luvun siistinä,
   * mutta se olisi jättänyt pelin pisimmän kentän (3-3, 425 saraketta) kokonaan
   * ilman tarkistuspistettä. Se on väärä vaihtokauppa: siisti luku ei auta
   * ketään, tarkistuspiste auttaa.
   *
   * Kolme riviä ilmaa ylöspäin: iso pelaaja on 26 px eli kaksi laattaa, ja
   * kolmas rivi on se jossa hypätään.
   */
  lampFooting(tx) {
    // Rivistä 3 alkaen, koska kolme riviä ilmaa luetaan ylöspäin: rivi 2 luki
    // `grid[-1]`ia, ja kaatui ensimmäiseen kenttään jonka katto oli ylhäällä.
    for (let ty = 3; ty < this.h; ty++) {
      if (!isSolid(this.grid[ty][tx])) continue;
      for (let y = ty - 3; y < ty; y++) if (this.grid[y][tx] !== T.EMPTY) return null;
      for (let x = tx - LAMP_CLEAR; x <= tx + LAMP_RUNUP; x++) {
        if (x < 0 || x >= this.w) return null;
        // Sama lattiarivi koko matkalta, ja mitään ei roiku sen päällä.
        if (!isSolid(this.grid[ty][x])) return null;
        if (info(this.grid[ty - 1][x]).hazard || info(this.grid[ty][x]).hazard) return null;
        if (info(this.grid[ty][x]).crumble || info(this.grid[ty][x]).falls) return null;
        // Eikä seinää vasten juoksemista: kaksi alinta riviä ovat sitä tilaa
        // jonka keho vie, ja kolikko niissä on eri asia kuin palikka.
        if (isSolid(this.grid[ty - 1][x]) || isSolid(this.grid[ty - 2][x])) return null;
      }
      return ty;
    }
    return null;
  }

  /**
   * Sytyttää lyhdyn, kerran.
   *
   * Tallennus on `game.state`issa eikä kohtauksessa, koska kuolema tuhoaa
   * kohtauksen — sama syy kuin linnakkeen ovella. Talteen menee **sarake**
   * eikä `true`, ja se on tahallinen turvalukko: vaikeustaso venyttää kentän
   * (`scale.js`), joten HELPOSSA sytytetty sarake ei ole NORMAALIssa sama
   * paikka. Sisääntulo vertaa lukua tämänhetkiseen lyhtyyn ja unohtaa
   * tarkistuspisteen jos ne eivät täsmää: menetetty lyhty maksaa yhden
   * kävelyn, väärään paikkaan herätetty pelaaja maksaisi kentän.
   */
  lightLamp(tx, ty) {
    this.setTile(tx, ty, T.LAMP_LIT);
    const st = this.game.state;
    if (st.checks) {
      st.checks[this.id] = tx;
      if (this.game.persist) this.game.persist();
    }
    /* Ääni ja kuva samasta tapahtumasta, ja molemmat kertovat "päällä": liekki
     * jää palamaan ruudulle, sytytys kuuluu kerran. Tärinää ei ole — tärinä on
     * tässä pelissä iskun sana (ks. `shake`), eikä lyhty osu mihinkään. */
    Sfx.play('lamp');
    for (let i = 0; i < 5; i++) {
      this.spawnPuff(tx * TILE + 2 + i * 3, ty * TILE + 2 + (i % 2) * 4);
    }
    this.addScorePop(tx * TILE + 8, ty * TILE - 2, 'PUOLIVÄLI');
  }

  enter() {
    /* Where the player already is, with no dwell: entering a scene is not
     * arriving anywhere, it is being somewhere. This is also the whole of what
     * a quicksave taken in the cave needs — `restoreState` rebuilds the scene
     * and `setScene` calls this, so the snapshot comes back sounding like the
     * place it was taken in without the save format carrying a track name.
     * A boss level gets its own theme until the thing is beaten. */
    this.placeBand = this.player ? this.bandAt(this.player.y + this.player.h) : 1;
    this.bandHold = 0;
    this.starMusic = !!(this.player && this.player.star > 0);
    Music.play(this.trackFor(this.placeBand));
    Music.setHurry(this.time <= HURRY_TIME);
    // The room and the weather, from the theme — the audio half of what
    // PostFX.setAmbience does to the picture.
    Ambience.set(this.theme, this.def);
  }

  /**
   * Kicks the camera for a frame or two. Purely cosmetic — but not shapeless.
   *
   * **Suunta on osa viestiä.** Yksi ja sama ympyrä kaikelle tarkoittaa että
   * maahanisku, lattiaa pitkin lähtevä iskuaalto ja jättiläisen askel
   * näyttävät samalta, ja kaksi samannäköistä "jotain tapahtui" -signaalia
   * opettavat lukemaan väärää — sama perustelu joka on jo kirjattu maahaniskun
   * ääneen ja pomoäänten jakoon (DESIGN.md kohta 8). Pystyisku tärisyttää
   * pystyyn, lattiaa pitkin kulkeva aalto sivuttain.
   *
   * `axis` on `'both'` (vanha leveä ympyrä, ja yhä oletus), `'y'` tai `'x'`.
   *
   * **Kuka valitsee suunnan, kun kaksi asiaa osuu samaan frameen.** Kovempi.
   * Se on sama järjestys jolla voimakkuus itse on aina valittu — `Math.max` —
   * eikä sitä siksi tarvitse opetella erikseen: pomon laskeutuminen kuuluu
   * kovempaa kuin aalto joka siitä lähti, joten frame on laskeutumisen
   * näköinen. Tasapeli palaa ympyrään, koska kaksi yhtä kovaa iskua eri
   * suunnista *on* ympyrä.
   */
  shake(amount, axis = 'both') {
    const next = Math.min(SHAKE_MAX, amount);
    if (next > this.shakeAmp) {
      this.shakeAxis = axis;
    } else if (next === this.shakeAmp && axis !== this.shakeAxis) {
      this.shakeAxis = 'both';
    }
    this.shakeAmp = Math.max(this.shakeAmp, next);
  }

  /**
   * Tämän framen tärähdys pikseleinä.
   *
   * Omana metodinaan eikä `draw`in sisällä, koska tämä on se numero jonka
   * suunta *on*: ilman erillistä lukua "tärinä on pystysuuntainen" olisi
   * väite kahdesta sinistä eikä mitattava asia.
   */
  shakeOffset() {
    if (this.shakeAmp <= 0) return { x: 0, y: 0 };
    const w = SHAKE_AXES[this.shakeAxis] || SHAKE_AXES.both;
    return {
      x: Math.round(Math.sin(this.tick * 2.1) * this.shakeAmp * w.x),
      y: Math.round(Math.cos(this.tick * 3.3) * this.shakeAmp * w.y),
    };
  }

  /**
   * PALETTISIIRTO: mitä väriä tämä frame on, ja miksi.
   *
   * Kolme tapahtumaa jakaa yhden mekanismin (`PostFX.setTint`), joten
   * järjestys on osa määrittelyä eikä sattuma: **uusin tieto voittaa.** Osuma
   * kesti kymmenen framea, tähti yksitoista sekuntia ja pomohuone koko kentän
   * — mitä lyhyempi, sitä tuoreempi, ja sitä tärkeämpi juuri nyt.
   *
   * Kello on joka kohdassa pelilogiikan oma laskuri (`hurtFlash`, `star`,
   * `tick`) eikä seinäkello, joten siirto osuu framen tarkkuudella siihen
   * tapahtumaan jota se selittää — ja sama kenttä pelattuna uudestaan näyttää
   * samalta.
   *
   * Kuolema ei välähdä. Sillä on jo oma kuvansa — musiikki lakkaa, keho
   * kaartuu ruudun alle — ja välähdys olisi siinä toinen merkki asiasta josta
   * ei ole epäselvyyttä. Välähdys on nimenomaan sen osuman merkki jonka
   * jälkeen peli jatkuu.
   */
  paletteShift() {
    const p = this.player;
    if (p && p.hurtFlash > 0) {
      const t = p.hurtFlash / HURT_FLASH;
      return { ...PALETTE.hurt, amount: PALETTE.hurt.amount * t, reason: 'hurt' };
    }
    if (p && p.star > 0) {
      /*
       * Sykkii, muttei välky. Koko ruudun välkkyminen on juuri se asia jota
       * WCAG 2.3.1:n välähdyskynnys koskee — alle kolme välähdystä sekunnissa
       * ja alle 10 % suhteellisen luminanssin muutosta — ja tätä peliä pelaa
       * lapsi kavereineen. Nappulan oma väri vaihtuu kolmen framen välein
       * (`STAR_TINTS`), koska se on pieni pinta-ala; ruutu hengittää.
       *
       * Kello on tähden oma laskuri, joka laskee nollaan: siirto päättyy
       * tasan siihen framiin jolla tähti päättyy. Ja tiheämpi jakso alkaa
       * `hurryAt`issa, joka on molempien jaksojen monikerta — vaihto osuu
       * aallon pohjalle, joten se ei ole askel vaan pelkkä tahdin muutos.
       */
      const { star } = PALETTE;
      const period = p.star <= star.hurryAt ? star.hurried : star.period;
      const phase = (1 - Math.cos((p.star % period) / period * Math.PI * 2)) / 2;
      return { ...star, amount: star.peak * phase, reason: 'star' };
    }
    if (this.def.boss) {
      /* Huone on sen väristä niin kauan kuin tappelu on kesken, ja se palaa
       * ennalleen samaa tahtia kuin ovi aukeaa. Voitto on siis myös väri. */
      const fade = this.bossDefeated
        ? 1 - this.doorOpen
        : Math.min(1, this.tick / PALETTE.boss.ramp);
      if (fade > 0) {
        return { ...PALETTE.boss, amount: PALETTE.boss.amount * fade, reason: 'boss' };
      }
    }
    return null;
  }

  /**
   * TÄYSI VAUHTI. Seitsemän pykälää, kahdeksan framea kukin, ja perillä kaksi
   * asiaa on toisin: nopeuskatto on 2,5:n sijaan 3,5 px/frame ja kaasulehdellä
   * hypystä on tullut lento. Kumpikaan ei ole ennen sanonut itsestään mitään.
   *
   * Kuva ja ääni ovat tässä samassa metodissa, eivät kahdessa — DESIGN.md
   * kohta 8 vaatii molemmat puolet, ja puoliksi tehty pari on juuri se vika
   * jonka linnakkeen ovi teki ennen kuin sen lehdet alkoivat liikkua.
   *
   * Vaimenee kun kenttä on ohi: voittojingle ja kuolinääni omistavat ruudun
   * kumpikin omalla hetkellään, eikä mittari saa puhua niiden päälle.
   */
  onSpeedFull() {
    if (this.state !== 'play') return;
    this.speedPulse = SPEED_PULSE_FULL;
    this.speedPulseUp = true;
    Sfx.play('pfull');
  }

  /**
   * ...JA SE MENI, mikä on sama tapahtuma takaperin ja tarvitsee merkin
   * kipeämmin kuin täyttyminen: menetyksen huomaa muuten vasta siitä että
   * hyppy ei kanna. Ilmassa se on vieläkin selvempää — lento loppuu kun
   * mittari on tyhjä, ja putoaminen on huono tapa saada tietää.
   *
   * Yksi merkki molemmille, koska ne ovat sama asia: etu meni. Kaksi merkkiä
   * yhdelle tilanvaihdokselle olisi kohdan 8 virhe ihan yhtä lailla kuin yksi
   * merkki kahdelle.
   */
  onSpeedSpent() {
    if (this.state !== 'play') return;
    this.speedPulse = SPEED_PULSE_SPENT;
    this.speedPulseUp = false;
    Sfx.play('pspent');
  }

  /**
   * KUNINGAS VAIHTUI JOKSIKIN TOISEKSI, ja ruutu sanoo **kuka** saapui.
   *
   * Jokainen muu pomo vastaa osumaan nostamalla yhtä omaa numeroaan;
   * PIERUKUNINGAS vaihtaa liikevalikoimansa seuraavan linnakkeen valikoimaksi
   * (`KING_FORMS`, `src/entities/enemies.js`). Se ero on koko finaalin idea, ja
   * se lunastuu vain jos pelaaja tunnistaa kesken tappelun kenet hän juuri sai
   * vastaansa — mikä on tasan se taito jonka maailman 8 seitsemän uusintaa
   * opettivat. Yleinen välähdys sanoisi *että* jotain vaihtui; se on juuri se
   * tieto joka pelaajalla jo on, koska hän tallasi.
   *
   * Väri on siis se maailma josta muoto tulee, ja se luetaan sen maailman
   * paletista (`themeTint`). Uutta sävyä ei keksitä eikä vanhaa kirjoiteta
   * toiseen kertaan: toinen kopio ajautuisi erilleen ensimmäisestä sinä
   * päivänä kun jotakin palettia siirretään, ja se ero näkyisi vain tässä
   * yhdessä tappelussa.
   *
   * Kuva ja ääni yhdessä (DESIGN.md kohta 8). Ääni on `saapuu` eikä `stomp`:
   * osuma ja saapuminen ovat kaksi eri tilanvaihdosta samalla framella, ja
   * yksi merkki kahdelle asialle opettaa lukemaan toisen niistä väärin.
   * Tärähdys jää sille mitä se on aina ollut — sen kertominen että osuma osui
   * — eikä verho lainaa sitä, koska silloin saapumisella olisi merkki jonka
   * osuma jo omistaa.
   *
   * @param {number} index kohta `KING_FORMS`issa, eli maailma `index + 1`
   */
  onKingForm(index) {
    const world = WORLDS[index];
    if (world) PostFX.flash(themeTint(world.theme));
    Sfx.play('saapuu');
  }

  /* ------------------------------ level API ---------------------------- */

  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.w) return T.HARD;   // solid level edges
    /*
     * The sky is a lid, for the same reason the sides are walls.
     *
     * Reported from play: in 1-F the opening screen has no ceiling, so you can
     * jump up beside where the ceiling starts, land on top of it, and run the
     * whole level along the roof — past the boss, with no way down and no way
     * to win. The level was not broken; the world simply had no top, and any
     * level whose ceiling does not reach its own start edge has the same hole.
     *
     * Closing it here fixes every level at once, including generated ones, and
     * it cannot be forgotten the next time somebody writes a chunk.
     */
    if (ty < 0) return T.HARD;
    if (ty >= this.h) return T.EMPTY;
    const ch = this.grid[ty][tx];
    if (this.switchTimer > 0) return SWITCH_MAP[ch] || ch;
    return ch;
  }

  /** The character actually stored, ignoring any running switch. */
  rawTileAt(tx, ty) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return T.EMPTY;
    return this.grid[ty][tx];
  }

  setTile(tx, ty, ch) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
    this.grid[ty][tx] = ch;
    /*
     * Maasto tottelee painovoimaa, ja se herää **tässä** eikä joka framen
     * pyyhkäisyssä koko ruudukon yli.
     *
     * Kaksi syytä, ja jälkimmäinen on se joka ratkaisi. Pyyhkäisy maksaisi
     * jokaisessa kentässä jossa yhtään möykkyä ei ole, eli lähes kaikissa. Ja
     * tapahtumapohjaisena putoaminen on **kertaluontoinen ja jäljitettävä**:
     * se alkaa siitä hetkestä jona joku tyhjensi ruudun, joten kotiin
     * palannut möykky ei lähde saman tien uudestaan matkaan sillä perusteella
     * että sen tuki on yhä poissa. Jatkuva tuentarkistus olisi tehnyt
     * palaamisesta silmukan, ja silmukka on se muoto jossa "palautuva" lakkaa
     * tarkoittamasta mitään.
     *
     * `this.falls` tarkistetaan, koska `setTile`iä kutsutaan myös ennen kuin
     * konstruktori on ehtinyt luoda sen.
     */
    if (ch === T.EMPTY && this.falls) this.dropAbove(tx, ty);
    /* Sama tapahtuma, toinen aine: tyhjentynyt ruutu herättää myös sen päällä
     * olevan hiekan. Erillinen kutsu eikä `dropAbove`in haara, koska hiekka ei
     * ole möykky missään muussakaan kohdassa — ks. `POUR_STEP`. */
    if (ch === T.EMPTY && this.pours) this.pourAbove(tx, ty);
  }

  /**
   * Ruutu tyhjeni: jos sen päällä lepäsi möykky, se lähtee liikkeelle.
   *
   * Kaikki kutsujat ovat pelaajan tekoja — päänpuski (`smashBrick`), potkaistu
   * kuori (`ShellGuy.smashAhead`) ja mureneva lauta jonka päällä pelaaja
   * seisoi — paitsi yksi: mureneva lauta vihollisen alla (laki 2). Se on
   * kielletty möykyn tueksi `rules.js`:ssä, ja **se kielto on koko
   * reiluussääntö**: ilman sitä vihollinen voisi pudottaa möykyn pelaajan
   * päähän ilman että pelaaja teki mitään.
   */
  dropAbove(tx, ty) {
    const oy = ty - 1;
    if (this.rawTileAt(tx, oy) !== T.LUMP) return;
    const key = `${tx},${oy}`;
    if (this.falls.has(key)) return;
    this.falls.set(key, { ox: tx, oy, x: tx, y: oy, t: 0, rest: -1 });
  }

  solidAt(tx, ty) {
    return isSolid(this.tileAt(tx, ty));
  }

  /** The climbable tile an entity is inside, or null. */
  climbAt(entity) {
    const x0 = Math.floor(entity.x / TILE);
    const x1 = Math.floor((entity.x + entity.w - 1) / TILE);
    const y0 = Math.floor(entity.y / TILE);
    const y1 = Math.floor((entity.y + entity.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (info(this.tileAt(tx, ty)).climb) return { tx, ty };
      }
    }
    return null;
  }

  add(entity) {
    this.entities.push(entity);
    return entity;
  }

  spawnPuff(x, y, brown = false) {
    for (let i = 0; i < 4; i++) {
      this.add(new Puff(this, x, y, { spread: 1.6, size: 3, brown }));
    }
  }

  /** The blast under a mid-air fart jump: knocks over anything just below. */
  fartBlast(x, y, radius, source) {
    for (let i = 0; i < 5; i++) {
      this.add(new Puff(this, x + (i - 2) * 3, y, { spread: 2.2, size: 4, life: 20 }));
    }
    for (const e of this.entities) {
      if (e.kind !== 'enemy' || e.dying || e.remove || e === source) continue;
      if (Math.abs(e.cx - x) < radius && e.cy > y - 10 && e.cy < y + radius) {
        // Same rules as a fart ball, so tough customers stay tough.
        e.hitByProjectile(Math.sign(e.cx - x) || 1);
      }
    }
  }

  /**
   * PONNAHDUSLAUTA: se frame jolla jalat osuvat ritilään.
   *
   * Sama muoto kuin `updateCrumbles`illa ja samasta syystä: laatta jonka päällä
   * seistään luetaan jalkojen alta eikä kehon sisältä, ja `p.onGround` on se
   * yksi ehto joka erottaa seisomisen ohi lentämisestä. Alta puskeminen tai
   * kyljestä koskeminen ei siis laukaise mitään — lauta on lattia, ja lattia
   * työntää vain sitä joka seisoo sillä.
   *
   * Nosto luetaan vauhtimittarista sillä framella jolla se tapahtuu, eikä
   * mittaria kuluteta: lauta myy korkeutta vauhdista, ja vauhti on jo maksettu
   * juoksemalla. Mittarin nollaaminen tekisi laudasta toisen `pSpent`-tapahtuman
   * ja veisi pelaajalta sen edun jonka hän juuri osti — ja se etu (`MAX_P`,
   * lento kaasulehdellä) on olemassa erikseen tästä laatasta.
   *
   * `jumpHeld` asetetaan, kuten pieruhypyssäkin: nousu on `GRAVITY_HELD`in
   * varassa, ja ilman tätä lauta antaisi kolmanneksen siitä mitä se lupaa
   * sille pelaajalle joka ei satu pitämään nappia pohjassa laskeutuessaan.
   */
  updateSprings() {
    const p = this.player;
    if (p.dying || p.transit || !p.onGround) return;
    const ty = Math.floor((p.y + p.h) / TILE);
    const x0 = Math.floor(p.x / TILE);
    const x1 = Math.floor((p.x + p.w - 1) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      if (!info(this.tileAt(tx, ty)).spring) continue;
      const fill = Math.min(1, p.pMeter / P_METER_MAX);
      p.vy = SPRING_LOW + (SPRING_HIGH - SPRING_LOW) * fill;
      p.onGround = false;
      p.jumpHeld = true;
      p.airJumps = 0;
      p.airJumpCd = 0;
      this.shake(1 + fill * 2, 'y');
      Sfx.play(fill >= 1 ? 'bigfart' : 'fart');
      for (let i = 0; i < 4; i++) {
        this.spawnPuff(tx * TILE + 4 + i * 3, ty * TILE + 8);
      }
      return;
    }
  }

  /**
   * Yksi frame kuplan päällä seisomista.
   *
   * Pelaaja istutetaan kuplan katolle joka framella eikä kerran, ja se on
   * tarkoituksellista: kupla liikkuu itse (`updateBubbled` keinuttaa sitä ja
   * tuore kupla vielä nousee), joten uudelleenistutus on se mikä tekee tästä
   * *kannettavana olemisen* eikä paikallaan seisomisen. Se on myös ainoa
   * tapa saada tämä toimimaan ilman että moottorille opetetaan olio jonka
   * päällä voi seistä — `moveY` tuntee laatat eikä olioita, ja sen
   * opettaminen olisi ollut fysiikkaremontti yhden kuplan takia.
   *
   * `onGround` asetetaan, ja siitä seuraa että ilmahypyt ja coyote-framet
   * palautuvat kuten lattialla. Se on päätös eikä sivuvaikutus: kuplan päällä
   * **seisotaan**, ja jalansija joka ei kelpaa jalansijaksi olisi toinen
   * sääntö opeteltavaksi. Hinta on pieni, koska ikkuna on 18 framea.
   *
   * Kannon voi katkaista mikä tahansa mikä katkaisee kuplan: aika loppuu
   * kesken (`escape`), joku ampuu sen, tai vihollinen kuolee muuten. Siksi
   * tila tarkistetaan ennen istuttamista eikä sen jälkeen.
   */
  rideBubble(p, e) {
    if (!e.bubbled || e.dying || e.remove) {
      e.carried = 0;
      return;
    }
    const box = e.box;
    p.y = box.y - p.h;
    p.vy = 0;
    p.onGround = true;
    if (--e.carried > 0) return;
    /* Ja sitten se puhkeaa. `popBubble` on sama kaato kuin kosketuksellakin,
     * eli myös sama tuplapisteinen palkinto — kuplan puhkaisu maksaa saman
     * riippumatta siitä puhkaisiko sen kädellä vai jalalla. */
    e.popBubble(e.cx >= p.cx ? 1 : -1);
    p.bounce();
  }

  /**
   * MAAHANISKU: what happens the moment the dive's feet arrive.
   *
   * `strength` is the normalised height of the fall, 0…1, and it is the only
   * input besides the power level — see `poundScale` in player.js for why that
   * number can be trusted across levels of different heights. Everything below
   * is either the fall or the power level, and the split between the two is the
   * promise from DESIGN.md §5:
   *
   *   - **the fall decides what the hit does.** Below POUND_KILL_AT it knocks
   *     enemies over the way a fart ball does — a bubble for whatever can be
   *     bubbled, a tumble for whatever cannot. That is not a weak version of a
   *     stomp, it is a *different* answer, and it is deliberately the answer
   *     you get from an ordinary jump's worth of height: the everyday ground
   *     pound stuns, and the stomp is still the move that kills. Only a fall
   *     with real room above it turns the impact lethal.
   *   - **the power level strengthens, and gates exactly one thing.** It widens
   *     the reach and it lowers the bar the shockwave needs, and neither of
   *     those is ever unavailable: at power 0 a dive from the ceiling of the
   *     room throws the wave exactly as it does at power 5, it just has to be
   *     earned with the whole height instead of half of it.
   *
   *     The one exception is **breaking the floor**, and it is written as an
   *     exception rather than smuggled in as a stronger version of something:
   *     a small Pieruprinssi lands a lethal dive on a brick and stays on it,
   *     exactly as he bumps that brick from below and stays under it. What buys
   *     the hole is the fall — `POUND_BREAK_AT`, and it is a harder bar than the
   *     one that makes the dive lethal at all. See the constants for both.
   *
   * And spines beat all of it. `e.spiky` is skipped outright rather than merely
   * doing nothing, so a spiky walker under the landing is left standing and the
   * ordinary collision pass then hurts the player for having landed on it — the
   * same loss a stomp takes, which is the point. If a ground pound could clear
   * spines the boss's spike cycle would stop being a cycle and spikiness would
   * stop meaning anything.
   */
  poundImpact(p, strength) {
    const t = clamp(strength, 0, 1);
    const reach = Math.round(POUND_REACH * (POUND_REACH_FLOOR + (1 - POUND_REACH_FLOOR) * t))
      + p.powerLevel * POUND_REACH_PER_LEVEL;
    const kills = t >= POUND_KILL_AT;
    const waveAt = Math.max(POUND_WAVE_FLOOR, POUND_WAVE_AT - p.powerLevel * POUND_WAVE_PER_LEVEL);
    const wave = t >= waveAt;
    const shake = POUND_SHAKE_MIN + t * POUND_SHAKE_RANGE;
    const breaks = p.big && t >= POUND_BREAK_AT;
    const feet = p.y + p.h;

    /* The numbers, kept where they can be read back. The sound, the shake, the
     * wave and the blast all have to be the same measurement or the screen and
     * the damage stop agreeing, and a measurement nobody can check is exactly
     * what "mitattu, ei muistettu" is about. */
    this.lastPound = {
      x: p.cx, y: feet, fromY: p.poundFromY, fall: p.y - p.poundFromY, room: p.y,
      strength: t, reach, kills, wave, shake, breaks, broke: 0,
    };

    for (let i = 0; i < 6; i++) {
      this.add(new Puff(this, p.cx + ((i - 2.5) / 2.5) * reach, feet,
        { spread: 2.4, size: 4, life: 20 }));
    }
    if (wave) this.add(new PoundWave(this, p.cx, feet, reach));

    for (const e of this.entities) {
      if (e.kind !== 'enemy' || e === p || e.dying || e.remove) continue;
      if (e.spiky) continue;
      /*
       * Whatever he landed on top of is always in range, however the reach came
       * out. A shallow dive whose radius fell short of the body directly under
       * it would lose to that body on the very next line of `collisions()`, and
       * losing to the thing you landed on is the one outcome this move may not
       * have — that is what the stomp is for.
       */
      const near = overlaps(p.box, e.box)
        || (Math.abs(e.cx - p.cx) <= reach
          && e.cy > feet - POUND_LIFT && e.cy < feet + POUND_LIFT);
      if (!near) continue;
      const dir = Math.sign(e.cx - p.cx) || 1;
      // `hitByShell` rather than `flipDie` for the lethal tier, so the tough
      // customers stay tough: the boss still spends one of his three, the sun
      // still needs her hits, and one path serves every species.
      if (kills) e.hitByShell(dir);
      else e.hitByProjectile(dir);
    }

    /*
     * Lattia viimeisenä, ja **jalkojen alta** eikä ympäriltä.
     *
     * Rivi on se johon jalat juuri osuivat, `feet` on siinä rivissä tai sen
     * ylärajalla, joten `feet / TILE` osoittaa siihen laattaan jonka päällä
     * seistään. Reikä syntyy siis siihen mihin isku näyttää osuneen, ja pelaaja
     * putoaa sen läpi — mikä on koko liikkeen paras palkinto ja samalla sen
     * hinta, koska alla voi olla mitä tahansa.
     *
     * Viimeisenä siksi että viholliset on jo käsitelty: tiilen katoaminen
     * tiputtaa sen päällä seisovan, ja kaatuminen kuuluu iskuun eikä
     * putoamiseen.
     */
    if (breaks) {
      const row = Math.floor(feet / TILE);
      const from = Math.floor((p.cx - reach) / TILE);
      const to = Math.floor((p.cx + reach) / TILE);
      const tiles = [];
      for (let tx = from; tx <= to; tx++) tiles.push([tx, row]);
      this.lastPound.broke = this.burstBricks(tiles);
      if (this.lastPound.broke) Sfx.play('burst');
    }

    // Pystyyn: koko liike on pystysuora, ja tämä on se frame jolla se osuu.
    this.shake(shake, 'y');
    Sfx.play('slam');
  }

  /**
   * MITÄ PELAAJAN ISKU RIKKOO, YHDESSÄ PAIKASSA.
   *
   * Kolme liikettä osuu nyt tiileen kyljestä tai päältä — pusku (`smashThrough`,
   * `entities/player.js`), hännänpyörähdys (`tailSwipe`) ja maahanisku
   * (`poundImpact`) — ja ne kysyvät kaikki tästä. Sopimus on se joka
   * `smashThrough`in yllä on kirjoitettu auki tiili tiileltä, ja se on
   * lyhyesti: **vain `B`, eikä sellainen `B` joka piilottaa jotain.**
   *
   * Yhtenä metodina eikä kolmena kopiona, koska kolme kopiota on kolme tapaa
   * olla eri mieltä siitä mikä on rikottava tiili — ja se erimielisyys näkyisi
   * pelaajalle vasta siinä että yksi liike söi salaisuuden jonka toinen jätti.
   * Piilottava tiili on kaikille sama ei: sen palkinto kuuluu sille joka puskee
   * sen alta, eikä isku saa olla tapa hävittää asioita.
   *
   * @returns montako tiiltä hajosi.
   */
  burstBricks(tiles) {
    let broken = 0;
    for (const [tx, ty] of tiles) {
      if (this.tileAt(tx, ty) !== T.BRICK) continue;
      if (this.brickSecret && this.brickSecret(tx, ty)) continue;
      this.smashBrick(tx, ty);
      broken++;
    }
    return broken;
  }

  /**
   * HÄNNÄNPYÖRÄHDYS RIKKOO TIILEN KYLJESTÄ.
   *
   * Häntä oli tähän asti pelkkä ase: se kaatoi vihollisen ja lensi seinän läpi
   * kuin sitä ei olisi. Se on kolmas tapa rikkoa tiili (`B`) päänpuskun ja
   * potkaistun kuoren jälkeen, ja se sopii samaan sopimukseen kuin puskukin —
   * ks. `burstBricks`.
   *
   * Kutsutaan `collisions()`ista eikä pelaajan omasta päivityksestä, koska
   * pyörähdyksen laatikko lasketaan siellä jo kerran ja kaksi lukijaa samalle
   * geometrialle on kaksi tapaa saada eri vastaus. Kerran pyörähdystä kohti
   * riittää ilman erillistä lippua: rikottu tiili ei ole enää tiili, joten
   * seuraava frame ei löydä siitä mitään rikottavaa.
   */
  tailSwipe(p) {
    const box = p.tailBox;
    if (!box) return;
    const x0 = Math.floor(box.x / TILE);
    const x1 = Math.floor((box.x + box.w - 1) / TILE);
    const y0 = Math.floor(box.y / TILE);
    const y1 = Math.floor((box.y + box.h - 1) / TILE);
    const tiles = [];
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) tiles.push([tx, ty]);
    }
    if (this.burstBricks(tiles)) {
      Sfx.play('burst');
      this.shake(2);
    }
  }

  smashBrick(tx, ty) {
    if (this.tileAt(tx, ty) !== T.BRICK) return;
    this.setTile(tx, ty, T.EMPTY);
    const px = tx * TILE;
    const py = ty * TILE;
    this.add(new BrickPiece(this, px, py, -1.4, -3.4, this.theme));
    this.add(new BrickPiece(this, px + 8, py, 1.4, -3.4, this.theme));
    this.add(new BrickPiece(this, px, py + 8, -1.1, -2.2, this.theme));
    this.add(new BrickPiece(this, px + 8, py + 8, 1.1, -2.2, this.theme));
    this.awardScore(50);
    // Tiili hajoaa nyrkiltä alhaalta: liike on pystyssä.
    this.shake(1.5, 'y');
    Sfx.play('brick');
  }

  addScorePop(x, y, text) {
    // Two numbers in the same spot read as one unreadable smudge, and a big
    // one drawn over a small one is worse. Nudge a new pop clear of any that
    // is already there.
    let ny = y;
    for (let tries = 0; tries < 6; tries++) {
      const clash = this.entities.some((e) => e instanceof ScorePop && !e.remove
        && Math.abs(e.x - x) < 26 && Math.abs(e.y - ny) < 12);
      if (!clash) break;
      ny -= 13;
    }
    this.add(new ScorePop(this, x, ny, text));
  }

  awardScore(points, x, y) {
    this.game.state.score += points;
    if (x !== undefined) this.addScorePop(x, y, points);
  }

  gainLife(x, y) {
    this.game.state.lives++;
    Sfx.play('oneup');
    if (x !== undefined) this.addScorePop(x, y, '1UP');
  }

  addCoin(x, y) {
    this.game.state.coins++;
    this.game.state.score += 200;
    Sfx.play('coin');
    if (this.game.state.coins >= 100) {
      this.game.state.coins -= 100;
      this.gainLife(x, y);
    }
  }

  storeReserve(kind) {
    if (!this.game.state.reserve) this.game.state.reserve = kind;
    else this.awardScore(1000);
  }

  dropReserve() {
    const kind = this.game.state.reserve;
    if (!kind) return;
    this.game.state.reserve = null;
    this.add(new Item(this, this.player.cx - 8, this.player.y - 20, kind, { emerge: false }));
  }

  /**
   * A sliding shell mows down everything it touches.
   *
   * LAKI 4, ja se on tässä yhden ehdon levennys: pyyhkäisy luki
   * `kind === 'enemy'`, eli papupommi — pelin ainoa heitetty ammus, `hazard` —
   * oli asia jonka läpi liukuva kuori meni sanomatta mitään. Ehto on nyt
   * *"osaako tämä ottaa kuoriosuman vastaan"*, ja se on eri kysymys kuin
   * *"onko tämä vihollinen"*: närästysliekillä ei ole `hitByShell`iä eikä sitä
   * ole unohdettu, koska liekki nousee lattiasta ja on sitä huonetta.
   *
   * **Pelaaja ei ole tässä silmukassa eikä koskaan ole ollut**, ja se on
   * reiluussäännön puoliskoista se ilmainen: olioiden kesken syntyvä isku ei
   * voi rakenteellisesti osua häneen. Se ainoa kuori joka häneen osuu on se
   * jonka hän itse potkaisi, `collisions`issa — ja sen hän omistaa.
   */
  shellSweep(shell) {
    for (const e of this.entities) {
      if (e === shell || e.dying || e.remove) continue;
      if (e.kind !== 'enemy' && e.kind !== 'hazard') continue;
      if (typeof e.hitByShell !== 'function') continue;
      if (overlaps(shell.box, e.box)) e.hitByShell(Math.sign(shell.vx) || 1);
    }
  }

  /**
   * How far the fortress door has swung, 0…1. Derived from two numbers the
   * save state already carries rather than kept in a field of its own — see
   * DOOR_OPEN_FRAMES. A snapshot from before this change restores
   * `bossDefeated === true`, and `tick - true` is `tick - 1`, which reads as
   * fully open the way it should.
   */
  get doorOpen() {
    if (!this.bossDefeated) return 0;
    return clamp((this.tick - this.bossDefeated) / DOOR_OPEN_FRAMES, 0, 1);
  }

  /**
   * Pomo kaatui, ja tämä on pelin suurin hetki — joten sen merkit on päätetty
   * eikä kasattu.
   *
   * Tässä soi `clear` ja `door` samalla framella, päälle musiikin
   * uudelleenkäynnistys, tärähdys ja pistepomppu. Se raportoitiin aamulla
   * kohdan 8 liikamerkitsemiseksi eikä siihen koskettu, koska purkaminen
   * muuttaisi juuri tätä hetkeä. Nyt se on mitattu, ja mittaus sanoo eri asian
   * kuin "liikaa merkkejä": **kaksi näistä merkeistä oli lainassa muualta ja
   * molemmat soivat uudestaan sekunnin sisällä.** Sama ajo kaikissa kolmessa
   * linnakkeessa (1-F, 2-F, 8-F), pomo kaadettuna framella 10 ja pelaaja
   * ovelle asti:
   *
   *     f10  stomp + clear + door        f47  door        f65  clear
   *
   * `door` uudestaan 37 framen päästä, kun ovesta kävellään sisään, ja `clear`
   * uudestaan 55 framen päästä, kun kenttä oikeasti päättyy. Jälkimmäiset ovat
   * 0,5 s ja 0,72 s pitkiä, joten kumpikin pari melkein koskettaa toisiaan.
   * Pelaaja kuulee siis saman jinglen kahdesti ja saman oven kahdesti, ja
   * kahdesta parista kumpikaan ei tarkoita samaa asiaa kummallakin kerralla.
   * Se ei ole kerroksellisuutta vaan juuri se väärään lukemiseen opettava
   * merkki jota kohta 8 varoo.
   *
   * Ratkaisu on siis vähentäminen eikä lisääminen, ja se koskee **vain
   * lainattua puoliskoa**:
   *
   *   - `clear` on kentän loppumisen jingle. Kenttä ei lopu tässä — pelaajan on
   *     vielä käveltävä ovesta sisään — joten se lähtee pois täältä ja jää
   *     `completeLevel`iin, missä se tarkoittaa yhtä asiaa.
   *   - `door` **jää**, koska se on nimenomaan tämän hetken oma ääni: pitkä
   *     pehmeästi avautuva kohina, ja sen kuva on olemassa (`doorOpen`, lehdet
   *     kääntyvät). Sisään kävelemiselle tehtiin oma äänensä (`doorin`).
   *
   * Mitä hetkelle jää: `stomp` (isku joka kaatoi hänet), `door` (tie ulos
   * aukeaa), tärähdys, pistepomppu OVI AUKI, kääntyvät lehdet ja musiikin
   * uudelleenkäynnistys. Kaksi ääntä, ja ne ovat kahdesta eri tilanvaihdoksesta
   * — yksi merkki kutakin kohti, mikä on koko sääntö. Hetki ei siis ohene:
   * siitä lähtee se merkki joka kuului toiselle hetkelle.
   */
  onBossDefeated() {
    // The tick, not `true`. Still truthy for every existing reader.
    this.bossDefeated = this.tick + 1;
    Music.play(this.def.music || 'fortress');
    Sfx.play('door');
    this.shake(4);
    this.addScorePop(this.player.cx, this.player.y - 12, 'OVI AUKI');
  }

  onPlayerDied(cause = 'enemy') {
    this.state = 'dead';
    this.stateTimer = 0;
    this.recordDeath(cause);
    Music.stop();
    Ambience.stop();
  }

  /* ----------------------------- telemetry ----------------------------- */

  /**
   * One event per attempt, guarded by `telemetryDone`. Without the guard a
   * save-state rewind would log the same death twice and the heatmap would
   * quietly overweight whichever spot someone was practising.
   */
  recordDeath(cause) {
    if (this.telemetryDone) return;
    this.telemetryDone = true;
    this.game.attempts[this.id] = (this.game.attempts[this.id] || 0) + 1;
    logDeath({
      level: this.id,
      tx: Math.floor(this.player.cx / TILE),
      ty: Math.floor(this.player.cy / TILE),
      cause,
      power: this.player.powerLevel,
      frames: this.tick,
    });
  }

  recordClear() {
    if (this.telemetryDone) return;
    this.telemetryDone = true;
    logClear({
      level: this.id,
      frames: this.tick,
      deaths: this.game.attempts[this.id] || 0,
      power: this.player.powerLevel,
    });
    this.game.attempts[this.id] = 0;
  }

  /**
   * Watches for a player who is alive but getting nowhere. Only the first stall
   * per column is logged: a player who gives up and stands there for a minute
   * should count once, not six times.
   */
  updateProgress() {
    const p = this.player;
    if (p.x > this.bestX + STUCK_PROGRESS) {
      this.bestX = p.x;
      this.stallFrames = 0;
      return;
    }
    if (++this.stallFrames < STUCK_FRAMES) return;
    this.stallFrames = 0;
    const tx = Math.floor(this.bestX / TILE);
    if (this.stuckLogged.has(tx)) return;
    this.stuckLogged.add(tx);
    logStuck({ level: this.id, tx, ty: Math.floor(p.cy / TILE), frames: this.tick });
  }

  /* -------------------------------- warping ---------------------------- */

  /** True when any column the body covers holds a warp mouth on row `ty`. */
  warpMouthAt(ty) {
    const p = this.player;
    const x0 = Math.floor(p.x / TILE);
    const x1 = Math.floor((p.x + p.w - 1) / TILE);
    for (let tx = x0; tx <= x1; tx++) if (info(this.tileAt(tx, ty)).warp) return true;
    return false;
  }

  /**
   * Warp pipes. The bands of a tall level are a fixed number of rows apart, so
   * travelling between them is an addition and nothing else: no second scene,
   * no transition, no save logic of its own. Down goes down a band, up goes up.
   *
   * **The direction you travel has to match the mouth you enter.** Stand on a
   * pipe whose mouth faces up and press down; stand under a pipe that hangs
   * from the ceiling and press up. Both directions used to test the same tile —
   * the one under the feet — so an upward warp was entered by standing on top
   * of a pipe and pressing up, which is the genre's rule backwards and reads,
   * correctly, as a bug: the pipe you are standing on is capped at the bottom.
   *
   * There is no compatibility path left. `WARP_COMPAT.upFromFloor` carried the
   * shipped rooms while their exits still stood on the floor; every upward warp
   * in the game hangs from a ceiling now (`cave_room`, `tomb_cave`,
   * `fac_cellar`, `fac_duct_up`), and `fac_loft`'s exit never needed to move
   * because leaving a loft is a downward journey.
   *
   * Two things can still refuse: rock where you would arrive, and a band with
   * no ground under the arrival. The second is what stops the surface pipe from
   * being a way to drop yourself out of the sky onto your own head.
   */
  tryWarp(input) {
    const bands = this.def.bands;
    const p = this.player;
    if (!bands || p.dying || p.transit || !p.onGround || p.warpLock > 0) return;
    const dir = input.held.down ? 1 : input.held.up ? -1 : 0;
    if (!dir) return;

    /** The world edge the body disappears behind: the mouth's own near lip. */
    let hide;
    /** The row of the mouth being entered — the key its far end is filed under. */
    let mouthRow;
    if (dir > 0) {
      const under = Math.floor((p.y + p.h) / TILE);
      if (!this.warpMouthAt(under)) return;
      hide = under * TILE;                       // the mouth's top edge
      mouthRow = under;
    } else {
      /* Every row that lies wholly above the head and whose lower lip is within
       * reach of the ground being stood on. The lowest lip wins: the mouth of a
       * hanging pipe is its bottom tile and everything above that is shaft. See
       * WARP_UP_REACH for why the reach is measured from the feet. */
      let mouth = -1;
      const first = Math.max(0, Math.ceil((p.y + p.h - WARP_UP_REACH) / TILE) - 1);
      const last = Math.floor(p.y / TILE) - 1;
      for (let ty = first; ty <= last; ty++) if (this.warpMouthAt(ty)) mouth = ty;
      if (mouth < 0) return;
      hide = (mouth + 1) * TILE;                 // the ceiling mouth's bottom edge
      mouthRow = mouth;
    }

    const shift = dir * bands.rows * TILE;
    if (!this.fits(p.x, p.y + shift, p.w, p.h)) return;
    const feet = Math.floor((p.y + shift + p.h) / TILE);
    const bandEnd = (Math.floor(feet / bands.rows) + 1) * bands.rows - 1;
    if (!this.footingWithin(p.x, p.w, feet, bandEnd)) return;

    /*
     * Matkan pää on se putki jonka `plantWarpExits` pystytti, ja siitä
     * noustaan ylös — myös alaspäin kuljetulta matkalta.
     *
     * **Ylös molemmissa suunnissa, ja se on tahallista.** Meno ja tulo ovat
     * saman matkan päät eivätkä saman liikkeen jatko: kaista vaihtuu leikkauksena
     * (`updateTransit`, 'hold'), eikä leikkauksen yli kuljeteta liikesuuntaa.
     * Molemmissa päissä tapahtuu siis sama luettava asia — keho häviää suuhun,
     * keho nousee suusta — ja se on tämän genren oma kielioppi. Alaspäin
     * tuleminen olisi vaatinut katosta roikkuvan putken jokaiseen määränpäähän,
     * eikä sellaista kattoa ole kuin osassa niistä.
     *
     * Jos paria ei jostain syystä ole (`exitRow === undefined`), matka menee
     * vanhalla tavalla: suhteellinen korkeus säilyy. Se on huonompi mutta ei
     * rikki, ja se on oikea vara kentälle jonka lattiaa ei voinut vaihtaa.
     */
    let exitRow;
    for (let tx = Math.floor(p.x / TILE); tx <= Math.floor((p.x + p.w - 1) / TILE); tx++) {
      const at = this.warpExits ? this.warpExits.get(`${tx},${mouthRow}`) : undefined;
      if (at !== undefined) { exitRow = at; break; }
    }
    const arriveY = exitRow === undefined ? p.y + shift : exitRow * TILE - p.h;
    const rise = p.h + 4;

    p.beginTransit({
      kind: 'warp',
      axis: 'y',
      slide: dir * (p.h + 4),
      out: exitRow === undefined ? dir * (p.h + 4) : -rise,
      arriveX: p.x,
      arriveY,
      hide,
      hideDir: dir,
      // Kaukopään oma leikkuri: keho nousee lattialinjan alta näkyviin, eikä
      // ole hetkeäkään maalattuna maan päälle. Ks. `drawPlayerInto`.
      farHide: exitRow === undefined ? null : exitRow * TILE,
    });
    /* Arriving in a hidden band *is* finding the secret, so the find is written
     * here, where the journey is decided, rather than by something watching the
     * scene from outside. `noteSecret` filters against the level's own key
     * list, so this writes nothing in a level that has no hidden band. */
    this.noteBand(arriveY + p.h);
    /* Going in gets the falling sweep and coming out gets the rising one, so
     * the two ends of the journey do not sound like the same event happening
     * twice (DESIGN.md §8). Ne ovat nyt oikeasti pari: ulostulo soitti pitkään
     * `door`ia, eli lupaus piti paikkansa vain puoliksi. Ks. `updateTransit`. */
    Sfx.play('pipe');
  }

  /**
   * Walking into the fortress door once it has swung open.
   *
   * It is the same transit as a pipe, turned on its side: the body slides its
   * own width further in and is not drawn past the line it was already
   * standing at, so it goes *into* the doorway rather than stopping in front
   * of it. Nothing arrives at the far end, because the far end of this one is
   * the end of the level — see the 'hold' branch of `updateTransit`.
   */
  enterDoor(tx, ty) {
    const p = this.player;
    if (p.transit || this.state !== 'play') return;
    let left = tx;
    let right = tx;
    while (left > 0 && info(this.tileAt(left - 1, ty)).door) left--;
    while (right < this.w - 1 && info(this.tileAt(right + 1, ty)).door) right++;
    const middle = (left + right + 1) * TILE / 2;
    const dirX = middle >= p.cx ? 1 : -1;

    p.vx = 0;
    p.vy = 0;
    p.ducking = false;
    p.facing = dirX;
    p.beginTransit({
      kind: 'door',
      axis: 'x',
      slide: dirX * (p.w + 4),
      /* The edge the body disappears behind is where its leading edge already
       * is, not the door's own boundary: the player is inside the frame by the
       * time this runs, and clipping at the frame would chop them on the first
       * frame instead of taking them in. */
      hide: dirX > 0 ? p.x + p.w : p.x,
      hideDir: dirX,
    });
    /* `doorin` eikä `door`: oven aukeaminen ja siitä sisään käveleminen olivat
     * sama ääni, ja mitattuna ne soivat 37 framen välein samassa kentässä. Sama
     * vika ja sama korjaus kuin putkella aamulla — ks. `onBossDefeated` ja
     * audio.js. */
    Sfx.play('doorin');
  }

  /* -------------------------------- transit ---------------------------- */

  /**
   * Drives whatever the player is currently disappearing into — see the
   * TRANSIT_* constants for why there is only one of these.
   *
   * Nothing can reach the player while it runs: `playerTiles`, `collisions`
   * and the clock all step aside, and `Player.hurt` refuses. That is not
   * belt-and-braces, it is the answer to the death question — a transit cannot
   * outlive the scene's own liveness because it cannot start after a death
   * (`state === 'play'` and `p.dying` both gate it) and it cannot cause or
   * survive one. `Player.die` still clears it, for a death forced from outside
   * the level (the debug keys, a test).
   *
   * A quicksave taken mid-transit is a **valid** save and is not refused. The
   * whole of the state lives on the player as plain numbers, and
   * `savestate.js` serialises every own property of every entity, so a snapshot
   * carries the phase, the frame counter and the arrival — and `cam` is saved
   * beside it, so the held picture comes back held. Refusing the save was the
   * alternative and it is worse: the player has no way to know these thirty
   * frames are special, and a quicksave key that silently does nothing is a
   * bug report.
   */
  updateTransit() {
    const p = this.player;
    const t = p.transit;
    if (!t || t.phase === 'gone') return;
    t.f++;

    if (t.phase === 'in') {
      const k = Math.min(1, t.f / TRANSIT_IN);
      if (t.axis === 'x') p.x = t.fromX + t.slide * k;
      else p.y = t.fromY + t.slide * k;
      if (t.f >= TRANSIT_IN) { t.phase = 'hold'; t.f = 0; }
      return;
    }

    if (t.phase === 'hold') {
      if (t.f < TRANSIT_HOLD) return;
      t.phase = 'out';
      t.f = 0;
      if (t.kind === 'door') {
        /* The door is the end of the level, so the far end of this transit is
         * the clear sequence itself. It starts **here**, on the frame the body
         * is gone, and not on the frame the player touched the door: the jingle
         * is the reward for finishing, finishing is going through the door, and
         * a jingle that plays while the player is still visibly walking says
         * the level is over while the picture says it is not. That is the
         * mismatch DESIGN.md §8 is about, and the price is 19 frames.
         *
         * The transit is not cleared, it goes to 'gone': `completeLevel` sets
         * `autoWalk`, which is right for the flagpole and would have the
         * player stroll back out of the door he just went into. Held here he
         * stays inside it, out of sight, for the whole clear sequence — which
         * is the third of the owner's three complaints. */
        t.phase = 'gone';
        this.completeLevel(null);
        return;
      }
      // Cross to the far band out of sight, and take the view with us.
      p.x = t.arriveX;
      p.y = t.arriveY;
      p.vy = 0;
      p.climbing = false;
      this.centerCamera();
      p.y = t.arriveY - t.out;
      /* Kaukopäässä on oma leikkuri jos matkan päässä on putki: keho nousee
       * sen suusta ylös eikä ole hetkeäkään maalattuna lattian päälle. Ilman
       * paria leikkuria ei ole, ja silloin `null` on oikea vastaus — sama kuin
       * ennen. */
      t.hide = t.farHide === undefined ? null : t.farHide;
      t.hideDir = 1;
      this.spawnPuff(p.cx, t.arriveY + p.h);
      /* Putken oma ulostuloääni, ei oven laina. Tässä soi `door` siihen asti
       * kunnes se huomattiin: sama ääni tarkoitti oven aukeamista, ovesta
       * kävelemistä ja putkesta ulos tulemista, eli yksi merkki kolmea asiaa
       * — juuri se väärin lukemaan opettava merkki jota DESIGN.md kohta 8
       * varoo. Kuva on ollut kunnossa koko ajan (keho nousee, kamera leikkaa,
       * neljä kaasupilveä jää jalkojen alle); ääni oli lainassa. */
      Sfx.play('pipeout');
      return;
    }

    // 'out': back into the world, still not in charge of it.
    const k = Math.min(1, t.f / TRANSIT_OUT);
    p.y = (t.arriveY - t.out) + t.out * k;
    if (t.f >= TRANSIT_OUT) {
      p.y = t.arriveY;
      p.controllable = t.wasControllable;
      p.transit = null;
      p.vy = 0;
      // Its own job, and not this one: it stops the button you are still
      // holding from sending you straight back.
      p.warpLock = 24;
    }
  }

  /** True when a box that size has no solid tile in it at (x, y). */
  fits(x, y, w, h) {
    if (y < 0 || y + h > this.heightPx) return false;
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 1) / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.floor((y + h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) if (this.solidAt(tx, ty)) return false;
    }
    return true;
  }

  /** True when rows `from`..`to` hold anything a box that wide could land on. */
  footingWithin(x, w, from, to) {
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 1) / TILE);
    for (let ty = from; ty <= to; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = this.tileAt(tx, ty);
        if (isSolid(ch) || isSemi(ch)) return true;
      }
    }
    return false;
  }

  /* ------------------------------- bumping ----------------------------- */

  /**
   * Records having found a hidden band, from the height of a pair of feet.
   *
   * Standing in the room is the find — not touching the vine, which you can do
   * by walking past it, and not clearing the level. `noteSecret` filters
   * against the level's own keys, so this writes nothing in a level with only
   * one band.
   */
  noteBand(feetY) {
    if (!this.def.bands || !this.game.state) return;
    const band = this.bandAt(feetY);
    if (band <= 0) noteSecret(this.game.state, this.id, SKY, this.mode);
    else if (band >= CAVE_BAND) noteSecret(this.game.state, this.id, CAVE, this.mode);
  }

  /**
   * Which band a pair of feet is in: 0 sky, 1 the route, 2 the cave.
   *
   * One measurement, used by everything that cares. The find (`noteBand`) and
   * the music (`updateBandMusic`) have to agree about where the player is even
   * though they do completely different things with the answer — two different
   * ways of deciding it would eventually disagree by a pixel, and the bug would
   * be a room that is found but does not sound like itself.
   *
   * A level with one band answers 1: it is all route.
   */
  bandAt(feetY) {
    const bands = this.def.bands;
    if (!bands) return 1;
    return Math.floor((feetY - 1) / (bands.rows * TILE));
  }

  /**
   * What the place the player is standing in sounds like. See BAND_MUSIC_DWELL.
   *
   * `bossMusic` overrides the shared boss theme for one fight, and it exists
   * for one level in the game (8-F). The general rule stays what it was — a
   * fight sounds like a fight, everywhere — but the last fight of the last
   * world is scored by the world's own piece, which is a night that ends when
   * a bell rings and the morning comes back in the major. Cutting that off to
   * play something else at the moment it resolves would throw away the ending
   * twice, and the piece is only in this game because it has that shape.
   *
   * Written as `||` rather than as a branch on purpose: a level without the
   * field behaves exactly as it did, so this line changes one level and not
   * seven.
   */
  trackFor(band) {
    /*
     * SUPERTÄHTI VOITTAA KAIKEN, MYÖS POMON.
     *
     * Ensimmäisenä, ja se on koko sääntö: jokainen muu rivi tässä metodissa
     * vastaa kysymykseen *missä olen* — kenttä, luola, linnake, pomohuone — ja
     * tähti vastaa kysymykseen *mitä minulle tapahtuu*. Kun molemmilla on
     * sanottavaa, jälkimmäinen on aina uudempi tieto, ja uudempi tieto voittaa.
     * Se on täsmälleen sama järjestys jonka ruudun väri jo noudattaa
     * (`PALETTE`: osuma > tähti > huone), ja kahden signaalin eri järjestys
     * olisi kaksi eri väitettä samasta hetkestä.
     *
     * Nimenomaan **myös pomon**, koska se on se kohta joka näyttää
     * kyseenalaiselta ja on silti ainoa johdonmukainen: tähti pomohuoneessa on
     * juuri se hetki jona pelaaja tekee sen mitä tähti lupaa, eli kävelee
     * suoraan päin. Raita joka jättäisi sen kertomatta olisi vaiti pelin
     * harvinaisimmasta asiasta.
     */
    if (this.player && this.player.star > 0) return STAR_TRACK;
    if (this.def.boss && !this.bossDefeated) return this.def.bossMusic || 'boss';
    const own = this.def.music || 'level';
    return band >= CAVE_BAND ? CAVE_TRACK : own;
  }

  /**
   * Tähden alku ja loppu, kuultuna.
   *
   * Oma metodinsa ja oma lippunsa eikä `updateBandMusic`in kylkeen kirjoitettu
   * ehto, ja syy on se että ne kaksi mittaavat eri asiaa eri tarkkuudella.
   * Kaistanvaihto on *paikka*, ja paikka vaatii `BAND_MUSIC_DWELL` framea
   * viivettä ettei putkesta kurkkaaminen vaihda raitaa; tähti on *tapahtuma*,
   * ja tapahtuma kuuluu sillä framella jolla se tapahtuu. Sama pari, sama ero
   * kuin `noteBand`illa ja `updateBandMusic`illa vierekkäin.
   *
   * Lippu eikä `Music.current`in vertailu, koska mykistetty peli ei aseta
   * `current`ia lainkaan siihen mitä soisi: mykkänä pelattu tähti jättäisi
   * silloin raidan vaihtamatta silloinkin kun ääni palaa.
   *
   * `Music.play` on tyhjä kutsu kun nimi ei muutu, joten kaistanvaihto tähden
   * aikana ei katkaise raitaa — ja kun tähti loppuu, tämä palauttaa sen raidan
   * joka *nyt* kuuluu tähän paikkaan eikä sitä joka kuului siihen mistä tähti
   * alkoi. Kiire pannaan takaisin päälle samasta syystä kuin kaistanvaihdossa:
   * tuore raita alkaa aina rauhallisena.
   */
  updateStarMusic() {
    if (this.state !== 'play' || !this.player) return;
    const on = this.player.star > 0;
    if (on === this.starMusic) return;
    this.starMusic = on;
    Music.play(this.trackFor(this.placeBand));
    Music.setHurry(this.time <= HURRY_TIME);
  }

  /**
   * The music follows the feet — slowly enough that only a place can move it.
   *
   * Called from `update` on the same frame and from the same pair of feet as
   * `noteBand`, so the event and the place are measured together and can be
   * read side by side. Everything about the timing is in BAND_MUSIC_DWELL.
   *
   * `Music.play` is a no-op when the name has not changed, so crossing between
   * the sky and the route — which share a track — does not restart the tune;
   * only a real change of place is heard. The hurry is re-applied because a
   * fresh track always starts calm, and losing the clock's push on the way into
   * a room would throw away a signal the player has already earned.
   */
  updateBandMusic() {
    if (!this.def.bands || this.state !== 'play') return;
    const p = this.player;
    if (!p || p.dying || p.transit) { this.bandHold = 0; return; }
    const band = this.bandAt(p.y + p.h);
    if (band === this.placeBand) { this.bandHold = 0; return; }
    if (++this.bandHold < BAND_MUSIC_DWELL) return;
    this.bandHold = 0;
    this.placeBand = band;
    Music.play(this.trackFor(band));
    Music.setHurry(this.time <= HURRY_TIME);
  }

  /**
   * A block that has been hit.
   *
   * The find is written where the block is spent, and the key is built from the
   * **raw** tile rather than `tileAt`: while a switch is running, a brick reads
   * as a coin, and a secret recorded under the character the player happened to
   * see would not match the level's own key list. A block that hides nothing
   * writes nothing — `noteSecret` filters — so this does not have to know which
   * bricks are the interesting ones.
   */
  bumpTile(tx, ty, player) {
    const ch = this.tileAt(tx, ty);
    const meta = info(ch);
    if (!meta.bumpable) return;
    const raw = this.rawTileAt(tx, ty);
    const found = () => noteSecret(this.game.state, this.id, tileKey(raw, tx, ty), this.mode);

    const key = `${tx},${ty}`;
    if (this.bumps.has(key)) return;
    this.bumps.set(key, 0);
    this.flipEnemiesAbove(tx, ty);

    if (meta.question) {
      this.setTile(tx, ty, T.USED);
      found();
      const seed = this.beanstalks.get(key);
      if (seed) {
        /* The bean, and the reason this branch is inside `meta.question` rather
         * than in front of it: the block is spent on the way past, so a second
         * hit — or a quickload onto a block that has already been hit — reads
         * as the used block it is and cannot grow a second vine out of it. */
        this.beanstalks.delete(key);
        this.add(new Beanstalk(this, tx, ty, seed));
        Sfx.play('sprout');
      } else if (ch === T.QCOIN) {
        this.add(new CoinPop(this, tx * TILE, ty * TILE - TILE));
        this.addCoin(tx * TILE + 8, ty * TILE);
      } else {
        // A star block promises a star; everything else rolls.
        const kind = meta.question === 'star' ? 'star' : this.rollPowerup(player);
        this.add(new Item(this, tx * TILE, ty * TILE - TILE, kind));
        /* Tämä soitti `bump`ia, joka on se ääni jonka pieni pelaaja saa kun
         * tiili **ei** anna mitään. Kaksi vastakkaista tapahtumaa samalla
         * merkillä on sama vika kuin lainattu `powerup` alempana, ja korjaus on
         * yksi ääni yhdelle tilanvaihdokselle: lohko antoi jotain -> `payout`,
         * lohko ei antanut -> `bump`. */
        Sfx.play('payout');
      }
      return;
    }

    if (ch === T.BRICK) {
      const secret = this.brickSecret(tx, ty);
      if (secret) {
        // A brick with something in it behaves like a question block: it never
        // smashes, whatever size you are, so the reward cannot be lost by
        // being too strong.
        this.setTile(tx, ty, T.USED);
        found();
        if (secret === 'coin') {
          this.add(new CoinPop(this, tx * TILE, ty * TILE - TILE));
          this.addCoin(tx * TILE + 8, ty * TILE);
        } else {
          this.add(new Item(this, tx * TILE, ty * TILE - TILE, this.rollPowerup(player)));
          /* `payout` eikä `powerup`: lohko antoi jotain, mutta kukaan ei vielä
           * kasvanut. Sama ääni molemmissa tarkoitti että yhden mansikan
           * kohdalla soi sama merkki kahdesti — ks. audio.js. */
          Sfx.play('payout');
        }
        return;
      }
      if (player.big) {
        this.bumps.delete(key);
        this.smashBrick(tx, ty);
      } else {
        Sfx.play('bump');
      }
      return;
    }

    if (meta.switch) {
      this.setTile(tx, ty, T.USED);
      found();
      this.startSwitch();
      return;
    }

    if (ch === T.NOTE) {
      player.vy = -6.2;
      player.onGround = false;
      Sfx.play('kick');
      return;
    }

    Sfx.play('bump');
  }

  /** @returns 'coin' | 'power' | null — see SECRET_COIN_RATE for the reasoning. */
  brickSecret(tx, ty) {
    // Offset the two draws so a brick can never be both, and so the two rates
    // stay independent of each other.
    if (hashNoise(tx * 7 + 13, ty * 11 + 5) < SECRET_POWER_RATE) return 'power';
    if (hashNoise(tx * 3 + 1, ty * 5 + 2) < SECRET_COIN_RATE) return 'coin';
    return null;
  }

  /**
   * A power block gives the first mushroom to a powerless player, then mixes
   * types and pea soup so the level can be pushed toward the top tier.
   */
  rollPowerup(player) {
    if (player.powerLevel === 0) return 'shroom';
    const roll = Math.random();
    if (roll < 0.3) return 'soup';
    if (roll < 0.53) return 'shroom';
    if (roll < 0.77) return 'flower';
    return 'leaf';
  }

  flipEnemiesAbove(tx, ty) {
    const box = { x: tx * TILE, y: ty * TILE - 16, w: TILE, h: 16 };
    for (const e of this.entities) {
      if (e.kind === 'enemy' && !e.dying && overlaps(e.box, box)) e.flipDie(1);
    }
  }

  /**
   * Missä osiossa keho on, ja mitä se tarkoittaa kameralle.
   *
   * Raja on sarake, koska kenttä etenee sarakkeittain myös silloin kun se
   * nousee: pystyosio on yhtä leveä kuin ruutu, joten sen sisällä sarake ei
   * juuri muutu ja vaihto tapahtuu vasta kun siitä kävellään ulos.
   */
  segmentAt(col) {
    const segs = this.segments;
    for (const seg of segs) if (col < seg.toCol) return seg;
    return segs[segs.length - 1];
  }

  updateSegment() {
    const seg = this.segmentAt(Math.floor(this.player.cx / TILE));
    const want = !!seg.vertical;
    if (want === this.vertical) return;
    this.vertical = want;
    /* Käänne saa saman lyönnin kuin sivunvaihto: kello ja viholliset seisovat,
     * musiikki ei. `camPageFrames` on sama luku molemmille, koska se on sama
     * ele — kuva vaihtuu, pelaaja odottaa. */
    if (this.camPageFrames <= 0) return;
    /* Sama kohdelinja kuin pystykentän omalla sivunvaihdolla, eikä uutta
     * kaavaa: nouseva keho kehystetään alareunaan ja laskeutuva yläreunaan,
     * jotta se maa johon ollaan menossa on jo ruudulla kun sinne saavutaan. */
    const climbing = this.camAnchor > this.heightPx / 2;
    const line = this.camAnchor - (climbing ? this.viewH - CAM_PAGE_LAND : CAM_PAGE_LAND);
    /* Lähtölinja on `cam.y` eikä `camPageY`: jälkimmäistä ylläpitää vain
     * pystykamera, joten vaakaosiosta tultaessa se on siinä missä viimeksi
     * sivunvaihdettiin — mahdollisesti satoja pikseleitä sitten. Käänne olisi
     * napsahtanut siihen ensimmäisellä framella. */
    this.camPageY = this.cam.y;
    this.camPageFrom = this.cam.y;
    this.camPageTo = this.clampCamY(line);
    this.camPage = this.camPageFrames;
  }

  /* -------------------------------- update ----------------------------- */

  update(input) {
    this.tick++;

    /* A page in flight is the one moment the world holds still, and it is the
     * whole of the freeze the owner asked about: the picture moves, nothing
     * else does. Enemies stop with the player rather than only the player,
     * because a walker that keeps walking while you cannot answer is the
     * freeze charging you for itself.
     *
     * `tick` is deliberately outside it. It drives the breathing clock every
     * sprite shares, and a picture that stops breathing reads as the game
     * having crashed rather than as the camera having moved.
     *
     * Dead code in every shipped level: `camPage` can only be non-zero in a
     * vertical level, and only when `camPageFrames` has been raised off its
     * measured default of 0. See CAM_PAGE_FRAMES for the measurement that put
     * it there. */
    if (this.camPage > 0) {
      this.updateCameraPage();
      return;
    }

    /* Osioidun kentän käänne. Tarkistus on ennen pelaajan päivitystä, jotta
     * lyönti alkaa siitä framesta jolla raja ylittyy eikä yhtä myöhemmin. */
    if (this.segments && this.state === 'play') this.updateSegment();

    if (this.state === 'play') {
      this.updateTimer();
      this.player.update(input);
      this.playerTiles();
      this.tryWarp(input);
      this.updateTransit();
      this.updateProgress();
      if (this.race) this.updateRace();
    } else if (this.state === 'clear') {
      this.player.update(input);
      this.stateTimer++;
      if (this.stateTimer > 170) {
        this.game.finishLevel({ cleared: true, card: this.wonCard });
        return;
      }
    } else if (this.state === 'dead') {
      this.player.update(input);
      this.stateTimer++;
      if (this.stateTimer > 140) {
        this.game.finishLevel({ died: true });
        return;
      }
    }

    /* Ovi aukeaa saapumisesta eikä pomon näkemisestä: raja on areenapalikan
     * ensimmäinen sarake, ja se ylitetään kävellen. `state === 'play'` sulkee
     * pois kuolinanimaation, jonka aikana pelaaja voi liukua rajan yli. */
    if (this.arenaCol !== null && !this.arenaReached && this.state === 'play'
        && this.player.x >= this.arenaCol * TILE) {
      this.arenaReached = true;
      const st = this.game.state;
      if (st.doors) {
        st.doors[this.id] = true;
        if (this.game.persist) this.game.persist();
      }
    }

    if (this.def.wind) this.updateWind();
    /* The bed sounds while the level is being played, and only then. This one
     * line is also how it stops: pausing, dying, clearing and every scene
     * change all stop calling it. See Ambience.hold. */
    if (this.state === 'play') Ambience.hold(this.gust);
    if (this.shakeAmp > 0) {
      this.shakeAmp = Math.max(0, this.shakeAmp - 0.4);
      // Vaimennut tärinä ei jätä suuntaansa perinnöksi: seuraava isku saa
      // valita omansa, eikä edellisen suunta odota sitä valmiina.
      if (this.shakeAmp === 0) this.shakeAxis = 'both';
    }
    if (this.speedPulse > 0) this.speedPulse--;
    this.updateEntities();
    if (this.state !== 'dead') this.collisions();
    this.updateCamera();
    this.updateBumps();
    this.updateCrumbles();
    this.updateShelves();
    this.updatePours();
    this.updateSprings();
    this.updateFalls();
    this.updateSwitch();
    if (this.goal && this.state === 'play') this.cardIndex = Math.floor(this.tick / 9) % 3;
    /* Feet, not head: bumping your head into the sky band is not arriving. The
     * pipe records its own arrival the moment the journey is committed, but a
     * beanstalk has no such moment — climbing into the sky is a position and
     * not an event, so the position is what is asked, every frame.
     *
     * The music is asked on the same frame from the same feet, and answers a
     * different question: not "has this been found" but "what does it sound
     * like here". They are next to each other on purpose — see
     * BAND_MUSIC_DWELL for why the two answers must not arrive together. */
    if (this.player) {
      this.noteBand(this.player.y + this.player.h);
      this.updateBandMusic();
      this.updateStarMusic();
    }
  }

  /**
   * Desert wind: long calm stretches broken by gusts that shove the player
   * sideways. It has to be intermittent — a constant push is just a changed
   * control scheme, while a gust you can see coming is a thing to play around.
   */
  updateWind() {
    const cycle = this.tick % 600;
    this.gust = cycle > 380 ? Math.sin(((cycle - 380) / 220) * Math.PI) : 0;
    if (this.gust <= 0.05 || this.state !== 'play') return;
    const push = this.gust * 0.055;
    this.player.vx -= push * (this.player.onGround ? 0.5 : 1);
    /*
     * LAKI 3: **tuuli kantaa kaikkea, ei vain pelaajaa.**
     *
     * Sama luku, sama puolitus maassa. Puolitus oli tähän asti pelaajan
     * erikoisjärjestely ja se on nyt fysiikkaa: jalat maassa on jotain mitä
     * vasten työntää, ilmassa ei ole. Juuri siksi tämä laki näkyy nimenomaan
     * hyppäävässä ja lentävässä — ja siksi puuska on ensimmäistä kertaa asia
     * jota voi *käyttää* eikä vain kestää.
     *
     * `push` menee `drift`iin eikä `vx`:ään, koska kävelijä kirjoittaa `vx`:n
     * uusiksi joka framella: `vx`:ään lisätty tuuli olisi pyyhkiytynyt pois
     * ennen kuin mikään ehti liikkua. Ks. `Enemy.moveSideways`.
     *
     * Vain hereillä olevat: ruudun ulkopuolella nukkuvaa vihollista ei
     * simuloida, eikä sitä siis myöskään kanneta. Se on sama raja jonka
     * `updateEntities` jo vetää, ja se on myös se raja joka pitää tämän lain
     * pois ruudun ulkopuolisesta kirjanpidosta.
     */
    for (const e of this.entities) {
      if (!e.active || e.remove || e.dying || !e.windborne) continue;
      e.push(-push * (e.onGround ? 0.5 : 1));
    }
  }

  updateTimer() {
    // Nothing counts down while you are between places. Thirty frames is not a
    // gift worth arguing about, and the alternative is a clock that can kill
    // the player inside a pipe, where nothing can be done about it.
    if (this.player.transit) return;
    if (++this.timeSub >= 24) {
      this.timeSub = 0;
      this.time--;
      if (this.time <= 0) {
        this.time = 0;
        this.player.die('time');
      } else if (this.time === HURRY_TIME) {
        Sfx.play('timewarn');
        Music.setHurry(true);
      }
    }
  }

  updateEntities() {
    const camL = this.cam.x - 64;
    const camR = this.cam.x + VIEW_W + 96;
    for (const e of this.entities) {
      if (!e.active) {
        if (e.alwaysActive || (e.x < camR && e.x + e.w > camL)) e.active = true;
        else continue;
      }
      e.update();
      // `alwaysActive` means the entity is part of the level's state, not just
      // scenery near the camera — a boss must never be tidied away.
      if (!e.alwaysActive && e.x + e.w < this.cam.x - 240 && e.kind === 'enemy') e.remove = true;
    }
    this.entities = this.entities.filter((e) => !e.remove);
  }

  /**
   * Crumbling platforms. A tile starts its timer the moment the player's feet
   * are on it, keeps counting whether or not they stay, and then drops out.
   *
   * It grows back after a while, and that is not decoration: without it, dying
   * halfway across a row of them would leave the level permanently impassable
   * for the rest of the attempt, and the player would have no way to know why.
   */
  updateCrumbles() {
    const p = this.player;
    if (!p.dying && p.onGround) {
      const ty = Math.floor((p.y + p.h) / TILE);
      const x0 = Math.floor(p.x / TILE);
      const x1 = Math.floor((p.x + p.w - 1) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (this.tileAt(tx, ty) !== T.CRUMBLE) continue;
        const key = `${tx},${ty}`;
        if (!this.crumbles.has(key)) {
          this.crumbles.set(key, 0);
          Sfx.play('bump');
        }
      }
    }

    /*
     * LAKI 2: **lauta pettää myös vihollisen alta.**
     *
     * Lauta ei tiedä mikä sen päällä seisoo — sama lause kuin juoksuhiekalla,
     * ja sama ratkaisu: yksi geometria, ei kahta. Kentän tekijä oppii yhden
     * säännön eikä kahta, ja luulaakson lankku lakkaa olemasta laatta joka
     * kantaa mitä tahansa paitsi pelaajaa.
     *
     * **Ääntä ei tule**, ja se on päätös eikä unohdus. `bump` on pelaajan
     * raportti siitä että hän astui johonkin; kaksi ruutua taaksepäin
     * naksahtava lauta jonka alle jäi kävelijä opettaisi katsomaan taakse
     * silloin kun siellä ei ole mitään. Sama perustelu kuin sillä että
     * juoksuhiekkaan uppoava vihollinen nähdään eikä kuulla.
     *
     * Ja koko lain turvallisuus on siinä että lauta **kasvaa takaisin**
     * (`CRUMBLE_REGROW`, alla): olio ei muokkaa kenttää vaan aiheuttaa
     * tilapäisen tapahtuman staattisessa kentässä. Ilman paluuta reitti voisi
     * kadota, ja silloin tämä laki olisi rajan väärällä puolella.
     */
    for (const e of this.entities) {
      if (e.kind !== 'enemy' || !e.active || e.dying || e.remove || !e.onGround) continue;
      const ty = Math.floor((e.y + e.h) / TILE);
      const x0 = Math.floor(e.x / TILE);
      const x1 = Math.floor((e.x + e.w - 1) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (this.tileAt(tx, ty) !== T.CRUMBLE) continue;
        const key = `${tx},${ty}`;
        if (!this.crumbles.has(key)) this.crumbles.set(key, 0);
      }
    }

    for (const [key, value] of this.crumbles) {
      const next = value + 1;
      const [tx, ty] = key.split(',').map(Number);
      if (next === CRUMBLE_FRAMES) {
        this.setTile(tx, ty, T.EMPTY);
        const px = tx * TILE;
        const py = ty * TILE;
        this.add(new BrickPiece(this, px, py, -1.2, -2.6, this.theme));
        this.add(new BrickPiece(this, px + 8, py, 1.2, -2.6, this.theme));
        // Lava murenee jalkojen alta — pystyyn, kuten kaikki putoava.
        this.shake(1.2, 'y');
        Sfx.play('brick');
      } else if (next > CRUMBLE_FRAMES + CRUMBLE_REGROW) {
        // Never rebuild a tile inside the player: that would be a wall
        // appearing out of nowhere, and it would be our fault, not theirs.
        const box = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
        if (overlaps(this.player.box, box)) continue;
        this.setTile(tx, ty, T.CRUMBLE);
        this.crumbles.delete(key);
        continue;
      }
      this.crumbles.set(key, next);
    }
  }

  /**
   * Tyhjentynyt ruutu herättää sen päällä olevan hiekan. Ks. `POUR_STEP`.
   *
   * Joukko eikä kartta, ja siinä on ero möykkyyn: möykky kantaa mukanaan
   * kotiruutunsa, koska se palaa sinne. Hiekka ei palaa, joten ainoa asia joka
   * siitä pitää muistaa on **että se on liikkeellä** — sijainti on ruudukossa,
   * ja ruudukko on jo tallennuksessa.
   */
  pourAbove(tx, ty) {
    const oy = ty - 1;
    if (oy < 0 || this.rawTileAt(tx, oy) !== T.QUICKSAND) return;
    this.pours.add(`${tx},${oy}`);
  }

  /**
   * Valuvan hiekan askel, ruutu kerrallaan.
   *
   * Silmukka on tahallaan tyhmä: jokainen liikkeellä oleva ruutu katsoo vain
   * omaa alapuoltaan. Ketju syntyy siitä että vapautuva ruutu menee `setTile`n
   * kautta, joka herättää sen päällä olevan hiekan — eli pino tulee alas
   * pinona ilman että kukaan laskee pinon korkeutta. Sama tapa kuin möykyllä,
   * ja samasta syystä: yksi sääntö jota sovelletaan monta kertaa on
   * tarkistettavissa, monta sääntöä ei ole.
   *
   * Pysähtymisen ehto on **ilma**, ei kiinteys: hiekka pysähtyy myös toisen
   * hiekan päälle, jolloin lammikko laskeutuu kasaan omalla pohjallaan eikä
   * mene itsensä läpi.
   */
  updatePours() {
    if (this.pours.size === 0) return;
    if (this.tick % POUR_STEP !== 0) return;
    for (const key of [...this.pours]) {
      const [tx, ty] = key.split(',').map(Number);
      if (this.rawTileAt(tx, ty) !== T.QUICKSAND) { this.pours.delete(key); continue; }
      const ny = ty + 1;
      if (ny >= this.h || this.rawTileAt(tx, ny) !== T.EMPTY) {
        this.pours.delete(key);
        continue;
      }
      this.pours.delete(key);
      this.grid[ny][tx] = T.QUICKSAND;
      this.pours.add(`${tx},${ny}`);
      // Vasta tämän jälkeen, ja `setTile`n kautta: se herättää sen mikä jää
      // ilmaan tähän ruutuun — hiekan tai möykyn.
      this.setTile(tx, ty, T.EMPTY);
      /* Ääni on hiekan omaa eikä lainaa: valuminen on jatkuvaa, joten se soi
       * kerran ruutua kohti ja vaimeana. `hiekka` on tehty tähän, ks.
       * `core/audio.js`. */
      if (this.pours.size <= 2 || ny % 2 === 0) Sfx.play('hiekka');
    }
  }

  /**
   * PIERUHYLLY: seinään litistynyt laukaus jää askelmaksi kahdeksi sekunniksi.
   *
   * IDEAS-synteesi A, tuomio 16.8.2026 "tee". Kukka on pelin ainoa ase, ja
   * ampuminen oli tähän asti vain vahinkoa: tämä antaa sille **rakennusverbin**
   * ilman että pelistä tulee rakennuspeli.
   *
   * Neljä ehtoa, ja jokainen niistä on raja eikä koriste:
   *
   *   1. **Vain seinä laukaisee sen.** Pallo pomppii lattiaa pitkin koko
   *      matkansa (`FartBall.update`, `hit.ground`), joten lattiaosumasta
   *      syntyvä hylly tarkoittaisi hyllyä joka toinen ruutu koko juoksun ajan.
   *      Seinä on se harvinainen ja tahallinen osuma — ja se on myös se paikka
   *      jossa askelma on jotain: seinän vieressä.
   *   2. **Hylly kasvaa seinästä poispäin**, eli sitä kohti josta ammuttiin.
   *      Se on ainoa suunta jossa se on saavutettavissa: seinän toisella
   *      puolella oleva askelma on toisen huoneen askelma.
   *   3. **Vain tyhjään ruutuun.** Mitään ei kirjoiteta yli — ei palkintolohkoa,
   *      ei lavaa, ei toista hyllyä. Kolmen ruudun leveys on maksimi eikä
   *      lupaus; yksikin ruutu riittää hyllyksi.
   *   4. **Ja se katoaa itsestään.** `SHELF_LIFE` on kaksi sekuntia, mikä on
   *      mitattu eikä valittu: juoksuhypyn koko kaari on ~50 framea, joten 120
   *      framea riittää ampumiseen, kääntymiseen ja yhteen hyppyyn — muttei
   *      siihen että pelaaja kävelee pois ja tulee takaisin. Hylly on liike,
   *      ei rakennelma.
   */
  gasShelf(ball) {
    const dir = ball.vx >= 0 ? 1 : -1;
    const ty = Math.floor(ball.cy / TILE);
    const wallX = Math.floor((dir > 0 ? ball.x + ball.w : ball.x) / TILE);
    let made = 0;
    for (let i = 1; i <= SHELF_TILES; i++) {
      const tx = wallX - dir * i;
      if (tx < 0 || tx >= this.w) break;
      if (this.tileAt(tx, ty) !== T.EMPTY) break;
      this.setTile(tx, ty, T.SHELF);
      this.shelves.set(`${tx},${ty}`, SHELF_LIFE);
      made++;
    }
    if (!made) return false;
    /* Ääni on `sylkaisy` eikä `fart`: pallo lähti jo pieruäänellä, ja sama ääni
     * matkan molemmissa päissä olisi yksi merkki kahdelle tapahtumalle
     * (DESIGN.md kohta 8). Tämä on litsahdus seinää vasten. */
    Sfx.play('sylkaisy');
    for (let i = 0; i < made * 2; i++) {
      this.spawnPuff(wallX * TILE - dir * i * 6, ty * TILE + 8);
    }
    return true;
  }

  /**
   * Hyllyjen kello. Sama muoto kuin murenevalla laudalla, ja sama turvallisuus:
   * ruutu palautetaan tyhjäksi vain jos se on yhä hylly — jokin muu on voinut
   * kirjoittaa siihen sillä välin, eikä tämän kellon tehtävä ole pyyhkiä sitä.
   *
   * Pelaajan sisään ei tarvitse varoa mitään: hylly on puolikiinteä, joten
   * poistuva hylly ei voi jättää ketään seinän sisään. Se on sama ero joka
   * teki `updateCrumbles`ista varovaisen ja tästä yksinkertaisen.
   */
  updateShelves() {
    if (this.shelves.size === 0) return;
    for (const [key, left] of this.shelves) {
      const [tx, ty] = key.split(',').map(Number);
      if (this.tileAt(tx, ty) !== T.SHELF) { this.shelves.delete(key); continue; }
      if (left <= 1) {
        this.setTile(tx, ty, T.EMPTY);
        this.shelves.delete(key);
        this.spawnPuff(tx * TILE + 8, ty * TILE + 8);
        continue;
      }
      this.shelves.set(key, left - 1);
    }
  }

  /** 1→0 sen mukaan kuinka paljon hyllyä on jäljellä, piirtoa varten. */
  shelfLeft(tx, ty) {
    const left = this.shelves.get(`${tx},${ty}`);
    return left === undefined ? 1 : Math.min(1, left / SHELF_LIFE);
  }

  startSwitch() {
    this.switchTimer = SWITCH_FRAMES;
    this.shake(2);
    /* `kytkin` eikä `powerup`: kytkin ei kasvata ketään, se muuttaa huoneen
     * määräajaksi. Kuva on jo kolminkertainen — jokainen tiili ruudulla
     * vaihtuu, ruutu tärähtää ja pistepomppu lukee sen ääneen — joten tästä
     * puuttui vain se ääni joka sanoo saman asian. Ks. audio.js. */
    Sfx.play('kytkin');
    this.addScorePop(this.player.cx, this.player.y - 12, 'TIILET KOLIKOIKSI');
  }

  /**
   * Runs the switch down. The only tricky part is the last frame: a brick that
   * comes back while the player is standing inside it would seal them in solid
   * rock, which is a bug wearing a puzzle's clothes. So the timer simply
   * refuses to reach zero until they are clear — bounded, invisible when it is
   * not needed, and it makes the trap impossible rather than unlikely.
   */
  updateSwitch() {
    if (this.switchTimer <= 0) return;
    if (this.switchTimer > 1) {
      this.switchTimer--;
      return;
    }
    if (this.playerInsideReturningTile()) return;
    this.switchTimer = 0;
    Sfx.play('bump');
  }

  playerInsideReturningTile() {
    const p = this.player;
    if (p.dying) return false;
    const x0 = Math.floor(p.x / TILE);
    const x1 = Math.floor((p.x + p.w - 1) / TILE);
    const y0 = Math.floor(p.y / TILE);
    const y1 = Math.floor((p.y + p.h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (isSolid(this.rawTileAt(tx, ty))) return true;
      }
    }
    return false;
  }

  /** 0→1 while a crumbling tile is counting down, for the drawing code. */
  crumbleProgress(tx, ty) {
    const value = this.crumbles.get(`${tx},${ty}`);
    return value === undefined ? 0 : Math.min(1, value / CRUMBLE_FRAMES);
  }

  /**
   * PUTOAVAT LAATAT. Yksi askel ruutua kohti, ja kotiin lopuksi.
   *
   * Koko silmukka on kirjoitettu sen ehdon ympärille joka tekee tästä
   * turvallista: **möykky palaa kotiruutuunsa.** Niin kauan kuin se palaa,
   * kenttä on lyhyen hetken toisenlainen ja sitten taas täsmälleen se kenttä
   * jonka `playable.mjs` pelasi läpi voimatasolla 0. Jos joku joskus poistaa
   * paluun, tämä laatta muuttuu olioksi joka muokkaa kenttää — ja se on tasan
   * se asia jota ROADMAPin 10.8.2026 raja kieltää.
   */
  updateFalls() {
    if (this.falls.size === 0) return;
    for (const [key, f] of this.falls) {
      f.t++;

      if (f.rest < 0) {
        if (f.t < FALL_HANG) continue;                     // varoitus ensin
        if ((f.t - FALL_HANG) % FALL_STEP !== 0) continue;
        const ny = f.y + 1;
        const below = this.tileAt(f.x, ny);
        if (ny >= this.h || isSolid(below) || isSemi(below)) {
          f.rest = f.t;
          this.shake(1.4, 'y');            // möykky tuli ylhäältä
          Sfx.play('bump');
          this.lumpImpact(f.x, f.y);
          continue;
        }
        /* Vapautuva ruutu menee `setTile`n kautta, koska sen päällä voi olla
         * toinen möykky: pino tulee alas pinona eikä ylin jää roikkumaan. */
        this.setTile(f.x, f.y, T.EMPTY);
        f.y = ny;
        this.grid[f.y][f.x] = T.LUMP;
        this.lumpImpact(f.x, f.y);
        continue;
      }

      if (f.t - f.rest <= FALL_REGROW) continue;

      /* Kotiin. Kaksi ehtoa, ja ne ovat eri asioita:
       *
       *   - **pelaajan sisään ei rakenneta seinää.** Sama sääntö kuin
       *     murenevalla laudalla ja kytkimellä, ja samasta syystä: umpikiveen
       *     sinetöityminen ajastimen takia olisi meidän vikamme eikä hänen.
       *     Odotetaan, koska pelaaja liikkuu.
       *   - **vihollinen ei voi lykätä paluuta.** Se joka seisoo kotiruudussa
       *     nielaistaan ja se maksaa nolla, aivan kuten juoksuhiekkaan uponnut
       *     — koska odottaminen tarkoittaisi että yksi kävelijä voi pitää
       *     kentän muuttuneena loputtomiin, ja silloin "palautuva" on lupaus
       *     jonka olio voi rikkoa.
       */
      const home = { x: f.ox * TILE, y: f.oy * TILE, w: TILE, h: TILE };
      if (this.player && !this.player.dying && overlaps(this.player.box, home)) continue;
      for (const e of this.entities) {
        if (e.kind !== 'enemy' || e.dying || e.remove) continue;
        if (!overlaps(e.box, home)) continue;
        this.spawnPuff(e.cx, e.cy, true);
        e.remove = true;
      }
      this.setTile(f.x, f.y, T.EMPTY);
      this.setTile(f.ox, f.oy, T.LUMP);
      this.falls.delete(key);
    }
  }

  /**
   * Mitä möykky tekee sille mikä on sen tiellä — olio ↔ olio, ei maastoa.
   *
   * `hitByShell` eikä `flipDie`, samasta syystä kuin maahaniskulla: sitkeät
   * pysyvät sitkeinä ja yksi polku palvelee jokaista lajia. Ja se maksaa,
   * toisin kuin juoksuhiekka: **pelaaja aloitti tämän ketjun** rikkomalla
   * tuen, joten kaatuminen on hänen ansiotaan samalla tavalla kuin potkaistun
   * kuoren kaatamat.
   *
   * Pelaajaan se osuu iskuna, ei paikkana, joten tähti suojaa siltä — sama
   * raja jonka piikki ja närästysliekki jo vetävät (ks. `collisions`).
   */
  lumpImpact(tx, ty) {
    const box = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
    for (const e of this.entities) {
      if (e.kind !== 'enemy' && e.kind !== 'hazard') continue;
      if (e.dying || e.remove || typeof e.hitByShell !== 'function') continue;
      if (overlaps(box, e.box)) e.hitByShell(1);
    }
    const p = this.player;
    if (p && !p.dying && p.star <= 0 && overlaps(box, p.box)) p.hurt('hazard');
  }

  /** How hard a hanging lump is shaking, 0…1, for the drawing code. */
  fallWobble(tx, ty) {
    if (this.falls.size === 0) return 0;
    for (const f of this.falls.values()) {
      if (f.x !== tx || f.y !== ty || f.rest >= 0) continue;
      return Math.min(1, f.t / FALL_HANG);
    }
    return 0;
  }

  updateBumps() {
    for (const [key, value] of this.bumps) {
      const next = value + 1;
      if (next > 10) this.bumps.delete(key);
      else this.bumps.set(key, next);
    }
  }

  /*
   * Camera: a dead zone plus look-ahead, not inertia.
   *
   * Inertia — a camera that keeps drifting after the player stops — is what
   * makes 2D platformers feel seasick, because the view moves while the thing
   * you are aiming with does not. What actually helps is showing more of where
   * you are going: the view shifts ahead in the direction you are running, and
   * eases back when you stop. Inside the dead zone the camera does not move at
   * all, so small hops and turns leave the screen still.
   *
   * The vertical axis is a different problem and gets a different answer: it is
   * not the axis you aim with, so a short glide there costs nothing and saves
   * every step down from reading as a cut. See CAM_V_EASE.
   */
  /**
   * Moves the line the view hangs from — and, far more often, does not.
   *
   * Three things count as being somewhere else: going down (any downward move
   * at all, on the frame it happens, because you must see what you are falling
   * towards), standing on something, and hanging off a vine. A jump is none of
   * them, so the anchor sits still through the whole arc and the ground stays
   * where it was. Landing on a platform above the old line is `onGround` on the
   * frame the feet touch, and `CAM_V_EASE` then glides the view up to it — the
   * whole height of the platform in one step of the anchor and a dozen frames
   * of the view, in every level and not only in the ones whose step happened to
   * be small enough. See `CAM_V_EASE`.
   *
   * While falling the line is not the feet but where the feet are **going**:
   * three frames ahead of them, or the floor they are about to stop on,
   * whichever comes first. See `CAM_FALL_LEAD` for why both halves of that are
   * needed and why the lead is rate-limited.
   *
   * The lead is only ever allowed to push the anchor *down*, which the
   * comparison below already guarantees: as the floor comes up the cap shrinks
   * the lead, and a shrinking lead simply leaves the anchor parked on the
   * landing line rather than dragging the view back up.
   *
   * Dying and travelling both freeze it: in both the body is going somewhere
   * the view has no business following.
   */
  updateCamAnchor() {
    const p = this.player;
    if (p.dying || p.transit) return;
    const feet = p.y + p.h;
    const falling = !p.onGround && !p.climbing && p.vy > 0;
    const wanted = falling ? Math.min(p.vy * CAM_FALL_LEAD, this.dropBelow(p)) : 0;
    this.camLead = falling
      ? Math.min(wanted, this.camLead + GRAVITY * CAM_FALL_LEAD) : 0;
    const target = feet + this.camLead;
    if (target > this.camAnchor || p.onGround || p.climbing) this.camAnchor = target;
  }

  /**
   * Free pixels under the feet before the first thing they could land on.
   *
   * The same rule `moveY` lands by, so the answer is the line the feet will
   * actually stop at and not an approximation of it: the first row holding a
   * solid or a plank, anywhere across the width of the body. Planks count
   * because this is only ever asked while falling, which is the direction they
   * are solid from.
   *
   * Four rows is not a guess about level design, it is all the question can
   * ever need: the longest lead is the ground pound's 7.5 * 3 = 22.5 px, and
   * four rows reach at least 33 px below the feet however they are aligned.
   * `Infinity` for a pit is the honest answer and the caller's `Math.min`
   * takes it — nothing is coming, so nothing caps the lead.
   */
  dropBelow(p) {
    const feet = p.y + p.h;
    const from = Math.floor(feet / TILE);
    const x0 = Math.floor(p.x / TILE);
    const x1 = Math.floor((p.x + p.w - 1) / TILE);
    for (let ty = from; ty <= from + 3; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = this.tileAt(tx, ty);
        if (isSolid(ch) || isSemi(ch)) return Math.max(0, ty * TILE - feet);
      }
    }
    return Infinity;
  }

  /**
   * The climb's camera: still, page, still. See `CAM_PAGE_EDGE` for the whole
   * argument, including why a hard cut here is not the threshold that was
   * deleted this morning.
   *
   * Two jobs and they are in this order on purpose. A page already in flight
   * finishes before anything else is asked, because the freeze — when there is
   * one — is defined as "the picture is moving and the player is not", and a
   * page that could be re-triggered while it ran would be a page that never
   * ends.
   *
   * `cam.x` never appears here. A vertical level is exactly one screen wide,
   * so `widthPx - VIEW_W` is zero and the horizontal clamp in `updateCamera`
   * pins the view at 0 for the whole level; the dead zone and the look-ahead
   * are computed and thrown away rather than skipped, which keeps one code
   * path instead of two and costs two multiplications a frame.
   *
   * @returns {boolean} true when a page is in flight and the world is held.
   */
  updateCameraPage() {
    const p = this.player;
    if (this.camPage > 0) {
      this.camPage--;
      const t = 1 - this.camPage / this.camPageFrames;
      /* Kiihtyvä ja hidastuva, ei tasainen. Tasainen sivu sekunnin mitassa
       * lukee hissiltä: se lähtee ja pysähtyy ilman että kumpikaan hetki
       * tarkoittaa mitään. Smoothstep antaa liikkeelle alun ja lopun, ja juuri
       * se tekee siitä *harkitun* eikä hitaan — mikä oli se sana jolla tätä
       * pyydettiin. Kaava on sama `t*t*(3-2t)` jota `postfx` käyttää
       * häivytyksiinsä, eikä uusi käyrä ansaitse omaa toteutustaan. */
      const e = t * t * (3 - 2 * t);
      this.camPageY = this.camPageFrom + (this.camPageTo - this.camPageFrom) * e;
      this.applyPageView();
      return this.camPage > 0;
    }
    /* Dying and travelling freeze the view for the same reason they freeze the
     * anchor: the body is going somewhere the picture has no business
     * following, and a page taken off a corpse's flight would show the room
     * above the pit to somebody who was only dying. */
    if (p.dying || p.transit) return false;

    const top = this.camPageY + CAM_PAGE_EDGE;
    const bottom = this.camPageY + this.viewH - CAM_PAGE_EDGE;
    let want = null;
    /* The settled line, not the body: `camAnchor` holds through a rising arc
     * and tracks a fall on the frame it happens, which is exactly the
     * asymmetry a climb needs. See CAM_PAGE_EDGE, point 1.
     *
     * Compared against the page's own line and not against `cam.y`, because
     * `cam.y` is the page line *plus the headroom net below*, and a trigger
     * that read the net's lift would page early on a jump, which is the one
     * thing the anchor is here to prevent. */
    if (this.camAnchor < top) want = this.camAnchor - (this.viewH - CAM_PAGE_LAND);
    else if (this.camAnchor > bottom) want = this.camAnchor - CAM_PAGE_LAND;
    if (want === null) { this.applyPageView(); return false; }

    /* Placed relative to the player rather than by a fixed step, which is what
     * makes "you arrive at the opposite edge" true however far outside the
     * frame the anchor got — a long fall moves it by more than a page in one
     * frame, and a fixed step would need several pages to catch up with a body
     * that is already past them. */
    const to = this.clampCamY(want);
    if (Math.abs(to - this.camPageY) < 0.5) { this.applyPageView(); return false; }
    this.camPages++;
    if (this.camPageFrames <= 0) {
      this.camPageY = to;
      this.applyPageView();
      return false;
    }
    this.camPageFrom = this.camPageY;
    this.camPageTo = to;
    this.camPage = this.camPageFrames;
    this.applyPageView();
    return true;
  }

  /**
   * The page line, and the one thing allowed to override it.
   *
   * **`CAM_TOP_MARGIN` is here too, and it has to be, and the arithmetic that
   * says so is worth keeping.** A page fires on the settled feet, so the last
   * platform before a page can be `CAM_PAGE_EDGE` from the top of the frame,
   * and the jump *off* it rises a rung plus its overshoot plus a body — 77 px
   * at the smallest size on three-tile spacing. To contain that inside the
   * page alone the edge band would have to be 77 px at each end, which with
   * one rung of hysteresis leaves `208 − 2×77 − 48` = **−90 px** for the page
   * itself. It does not fit, and no choice of the two constants makes it fit:
   * the window is 13 tiles and a jump is 5.
   *
   * So the climb borrows the answer the ordinary camera already gives, in that
   * camera's own words — *"a limit, not a destination… it only ever moves the
   * view up, and only as far as the band allows"*. It engages near the apex of
   * a jump taken high in the frame, follows the head exactly as far as it must,
   * and lets go on the way down. It is continuous in both directions, so it is
   * not a second cut, and between pages it is the *only* thing that can move
   * the view — measured on the fixture climb, and asserted as such rather than
   * described.
   *
   * Without it the fixture climb put the head **45.31 px** above the top of the
   * frame on the last jump before each page. With it, 0.00.
   */
  applyPageView() {
    const p = this.player;
    const held = p.dying || p.transit
      ? this.camPageY : Math.min(this.camPageY, p.y - CAM_TOP_MARGIN);
    this.cam.y = this.clampCamY(held);
  }

  updateCamera() {
    const p = this.player;
    this.updateCamAnchor();
    /* The climb takes the whole vertical axis and leaves the horizontal one
     * alone. Nothing below this line touches `cam.y` in a vertical level, and
     * nothing above it touches `cam.x` in any level. */
    if (this.vertical) {
      this.updateCameraPage();
      this.cam.x = clamp(this.player.cx - VIEW_W / 2, 0, Math.max(0, this.widthPx - VIEW_W));
      return;
    }
    const speed = Math.abs(p.vx);
    const wanted = speed > 0.4 ? Math.sign(p.vx) * CAM_LOOK_AHEAD * Math.min(1, speed / MAX_RUN) : 0;
    this.camLook += (wanted - this.camLook) * (Math.abs(wanted) > Math.abs(this.camLook)
      ? CAM_LOOK_GAIN : CAM_LOOK_RETURN);

    const centre = p.cx + this.camLook - VIEW_W / 2;
    const drift = centre - this.cam.x;
    if (Math.abs(drift) > CAM_DEAD_ZONE) {
      this.cam.x += drift - Math.sign(drift) * CAM_DEAD_ZONE;
    }
    this.cam.x = clamp(this.cam.x, 0, Math.max(0, this.widthPx - VIEW_W));

    /* Two eases and no cut. A band change is the one vertical move that is a
     * whole change of room — 240 px of it — so it gets its own slower rate and
     * is meant to be watched; everything else is a step down off a ledge or up
     * onto one, and those get `CAM_V_EASE`. Nothing here is ever assigned: the
     * moments where the view really is somewhere else are cuts made by
     * `centerCamera`, which does not come through this function at all. See
     * `CAM_V_EASE` for the measurement that retired the threshold that used to
     * sit between these two lines. */
    const want = this.cameraY();
    const fall = want - this.cam.y;
    this.cam.y += fall * (this.def.bands ? CAM_BAND_EASE : CAM_V_EASE);

    /* And the headroom is a limit, not a destination: the ease does its work
     * and then this has the last word. It only ever moves the view up, and
     * only as far as the band allows.
     *
     * **It is a safety net and no longer a mechanism.** It used to be the
     * thing that moved the camera at all — the ease was still on its way and
     * this arrived, which is the snap the owner reported. `CAM_TOP_LEAD` gives
     * the ease its warning, so by the time the head is 16 px from the frame
     * the view is already there and this line finds nothing to do: measured
     * over fart jumps in 2-1, 2-3 and 1-1, it moves the camera 0.00 px. It
     * stays because "already there" is a measurement and not a proof, and the
     * head touching the top of the frame is not a thing to find out about in
     * the wild. */
    if (!p.dying && !p.transit) {
      this.cam.y = this.clampCamY(Math.min(this.cam.y, p.y - CAM_TOP_MARGIN));
    }

  }

  /**
   * Where the view wants to sit vertically.
   *
   * A tall level is bands of the same 15 rows a short level has, and the camera
   * stays inside the one the player is in. That is not a detail: without it the
   * view would follow every jump over 208 pixels of free travel, which is the
   * seasickness the horizontal camera goes to such lengths to avoid — and it
   * would show the secret above or below while you walked past underneath.
   *
   * Measured from the feet — see CAM_STAND for why that is not a detail.
   */
  cameraY() {
    const p = this.player;
    /*
     * A climb has no settled line to ease towards — it has pages, and this is
     * only ever asked of it by `centerCamera`, i.e. at a cut: level entry, a
     * respawn, the far end of a warp. So the answer is where a page would have
     * put the body had it arrived from the direction it is about to travel in.
     *
     * Which direction that is, is read off the level rather than declared:
     * a body placed in the lower half of a tall level is at the bottom of a
     * climb and is going up, so it is framed near the bottom edge and sees
     * what is above it; one placed in the upper half is about to go down and
     * is framed near the top. That covers the digging level as well as the
     * climbing one without either of them having to say so twice.
     */
    if (this.vertical) {
      const climbing = this.camAnchor > this.heightPx / 2;
      return this.clampCamY(this.camAnchor
        - (climbing ? this.viewH - CAM_PAGE_LAND : CAM_PAGE_LAND));
    }
    /* The settled line, then the two things allowed to override it: the head
     * must not leave the top of the window, and a jump that is still being
     * pushed into that window is leaned into rather than met at the last tile.
     * Frozen bodies get the line alone — a dying player flies upwards and a
     * travelling one is not in the room. */
    const rest = this.camAnchor - this.viewH * CAM_EYE - CAM_STAND;
    /* The head, or where it is heading. A rise is aimed three frames ahead so
     * the ease is already up to speed by the time the margin matters; anything
     * else is aimed at the body itself. See CAM_TOP_LEAD. */
    const head = p.vy < 0 ? p.y + p.vy * CAM_TOP_LEAD : p.y;
    /* ...and the lean: the picture under the feet, spent early. Three factors
     * and each answers a different question — how much is there to spend, how
     * far in has the head come, and is this jump still going somewhere. Aimed at
     * the body itself and not at `head`, because this one is about where you
     * *are*; the anticipation is the line above. See CAM_AIR_MARGIN. */
    const slack = Math.max(0, rest - (this.camAnchor + CAM_GROUND_MARGIN - this.viewH));
    const near = clamp((CAM_AIR_MARGIN - (p.y - rest))
      / (CAM_AIR_MARGIN - CAM_TOP_MARGIN), 0, 1);
    const push = clamp((-p.vy + GRAVITY_HELD_CUTOFF) / -GRAVITY_HELD_CUTOFF, 0, 1);
    const lean = rest - slack * near * push;
    const target = p.dying || p.transit
      ? rest : Math.min(rest, lean, head - CAM_TOP_MARGIN);
    // The view holds still while you die: following the body down would pan it
    // straight through whatever is under the pit you just fell into.
    if (p.dying && this.def.bands) return this.cam.y;
    return this.clampCamY(target);
  }

  /** The vertical range the view is allowed, level or band. */
  clampCamY(y) {
    const bands = this.def.bands;
    if (!bands) return clamp(y, 0, Math.max(0, this.heightPx - this.viewH));
    /* Which band you are in is decided by your feet, not your middle. Falling
     * into a pit puts your middle in the band below for the few frames before
     * the lava under the pit gets you, and that was enough to lurch the view
     * down and show the secret to someone who was only dying. */
    const span = bands.rows * TILE;
    const p = this.player;
    const feet = Math.floor((p.y + p.h - 1) / span) * span;
    const top = clamp(feet, 0, this.heightPx - span);
    return clamp(y, top, top + span - this.viewH);
  }

  centerCamera() {
    /* A cut is the one moment the held line is simply wrong: wherever the body
     * has been put, that is where it has settled.
     *
     * **And this is the only cut there is.** Level entry, a respawn and the far
     * end of a warp all arrive here and all assign outright, with no threshold
     * to clear and no ease to outrun — which is why `updateCamera` needs no
     * rule for "the view is somewhere else entirely". It never sees one. */
    this.camAnchor = this.player.y + this.player.h;
    this.camLead = 0;
    this.camLook = 0;
    /* A cut outranks a page: whatever the climb's camera was in the middle of,
     * the body is somewhere else now and the picture goes there whole. */
    this.camPage = 0;
    this.cam.x = clamp(this.player.cx - VIEW_W / 2, 0, Math.max(0, this.widthPx - VIEW_W));
    this.cam.y = this.cameraY();
    this.camPageY = this.cam.y;
  }

  /* ------------------------------ collisions --------------------------- */

  playerTiles() {
    const p = this.player;
    if (p.dying || p.transit) return;
    const x0 = Math.floor(p.x / TILE);
    const x1 = Math.floor((p.x + p.w - 1) / TILE);
    const y0 = Math.floor(p.y / TILE);
    const y1 = Math.floor((p.y + p.h - 1) / TILE);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = this.tileAt(tx, ty);
        if (ch === T.COIN) {
          this.setTile(tx, ty, T.EMPTY);
          this.addCoin(tx * TILE + 8, ty * TILE);
        } else if (ch === T.LAVA) {
          p.die('lava');
          return;
        } else if (ch === T.SPIKE && !(p.star > 0)) {
          /* Only the part with points on it hurts. Testing the whole tile made
           * the top six pixels — plain air, above the tips — just as lethal as
           * the spikes, so a jump that cleared them by sight still cost you.
           *
           * The star covers spikes too: it is protection from the things in the
           * level that hit you, and a spike bed is one of those. What it still
           * does not cover is the level itself — a pit, lava, the clock. */
          const box = {
            x: tx * TILE, y: ty * TILE + SPIKE_TOP, w: TILE, h: TILE - SPIKE_TOP,
          };
          if (overlaps(p.box, box) && p.hurt('spike')) p.vy = -3;
        } else if (ch === T.LAMP && this.state === 'play') {
          this.lightLamp(tx, ty);
        } else if (info(ch).door && this.doorOpen >= 1) {
          this.enterDoor(tx, ty);
          return;
        }
      }
    }

    if (p.y > this.heightPx + 8) p.die('pit');

    if (this.goal && this.state === 'play') {
      const pole = { x: this.goal.x + 4, y: this.goal.y - 8, w: 10, h: GOAL_HEIGHT + 8 };
      if (overlaps(p.box, pole)) this.completeLevel(['shroom', 'flower', 'star'][this.cardIndex]);
    }
  }

  collisions() {
    const p = this.player;
    if (p.dying || p.transit) return;
    const spin = p.spinBox;
    /* Tiilet ensin ja vihollisilta erikseen: sama pyörähdys tekee molemmat, ja
     * ehto kummallekin on `p.spin > 0` eikä toistensa lopputulos. Seinän takana
     * seisova vihollinen kaatuu samalla pyörähdyksellä joka seinän avasi, mikä
     * on juuri se mitä ruudulla näyttää tapahtuvan. */
    if (spin) this.tailSwipe(p);
    // The stomp test has to use the speed the player *arrived* with. Bouncing
    // off the first enemy flips vy upwards, and without this snapshot every
    // other enemy landed on in the same frame would read as a side-on hit.
    const fallVy = p.vy;

    for (const e of this.entities) {
      if (e.remove) continue;

      if (e.kind === 'item') {
        if (e.emerging > 0) continue;
        if (overlaps(p.box, e.box)) {
          p.collect(e.itemKind);
          e.remove = true;
        }
        continue;
      }

      if (e.kind === 'projectile') {
        for (const other of this.entities) {
          if (other.kind !== 'enemy' || other.dying || other.remove) continue;
          if (overlaps(e.box, other.box)) {
            other.hitByProjectile(Math.sign(e.vx) || 1);
            e.pop();
            break;
          }
        }
        continue;
      }

      /*
       * VAARA ON ISKU, JA TÄHTI SUOJAA ISKULTA.
       *
       * Tämä haara ei lukenut tähteä lainkaan, ja se oli epäjohdonmukaisuus
       * eikä päätös: **lattian piikki tarkistaa tähden** (`T.SPIKE &&
       * !(p.star > 0)`), joten tähti suojasi piikiltä lattiassa muttei
       * liekiltä joka nousee samasta lattiasta. Omistaja löysi sen 4-1:ssä.
       *
       * Raja jonka tähti vetää ei ole "vihollinen vastaan kenttä" vaan
       * **isku vastaan paikka**: sen voi ottaa vastaan siltä mikä osuu sinuun,
       * eikä siltä mihin sinä menet. Kuoppa, laava ja kello ovat paikkoja ja
       * jäävät ulkopuolelle; piikki, närästysliekki ja papupommi osuvat, ja ne
       * ovat sisällä. Se on sama raja jonka piikki jo veti — tässä se vain
       * kirjoitettiin loppuun.
       *
       * Kaksi kommenttia tässä tiedostossa oli eri mieltä keskenään, ja
       * toinen niistä oli väärässä koodia vasten. Se on korjattu alempana.
       */
      if (e.kind === 'hazard') {
        if (e.box.h > 0 && p.star <= 0 && overlaps(p.box, e.box)) p.hurt('hazard');
        continue;
      }

      // An empty box is not a hitbox, whatever `overlaps` thinks of it.
      if (e.box.h <= 0 || e.box.w <= 0) continue;

      if (e.kind !== 'enemy' || e.dying) continue;

      /*
       * KUPLA ON KOHDE, EI UHKA — JA NYT MYÖS ASKELMA.
       *
       * Kosketus sivulta tai alta on yhä koko kaato: kupla puhkeaa ja
       * vihollinen kuolee. Muuttunut on se mitä tapahtuu **päältä**.
       *
       * Kuplaan vangittu vihollinen on jo leijuva ja jo vaarataon, eli kaikki
       * mitä askelma tarvitsee oli valmiina — puuttui vain se että kuplalla
       * saisi seistä hetken. Nyt saa: `BUBBLE_CARRY` framea, joiden ajan
       * pelaaja istuu kuplan katolla ja **kulkee sen mukana**, ja sitten se
       * puhkeaa alta. Vihollinen kuolee, pelaaja on ruutua ylempänä.
       *
       * Kolme asiaa jotka tämä ratkaisee tarkoituksella tietyllä tavalla:
       *
       *   - **Astuminen on päätös eikä vahinko.** Ehto on `fallVy > 0` ja
       *     jalat kuplan keskiviivan yläpuolella, eli sama muoto kuin raajan
       *     `onTop` alempana. Kyljestä tullut kosketus ei ala kannatella.
       *   - **Kupla ei jää.** Kerran astuttu kupla on menossa rikki, vaikka
       *     pelaaja kävelisi siltä pois — se on kaasukupla jonka päälle
       *     astuttiin, ei lautta. Siksi `carried` juoksee loppuun myös
       *     ilman kosketusta.
       *   - **Vain se hetki.** `BUBBLE_CARRY` on kolmasosa sekunnista, eli
       *     lyhyempi kuin yksikään hyppy tässä pelissä (lyhin mitattu 22
       *     framea). Kupla on siis askelma jonka *ajoittaa*, ei taso jolla
       *     odotetaan — pitempi kantaminen tekisi kuplaloukusta hissin.
       */
      if (e.bubbled) {
        if (e.carried > 0) {
          this.rideBubble(p, e);
          continue;
        }
        if (overlaps(p.box, e.box)) {
          const box = e.box;
          const onTop = fallVy > 0 && p.y + p.h - fallVy <= box.y + box.h * 0.5;
          if (onTop) {
            e.carried = BUBBLE_CARRY;
            this.rideBubble(p, e);
            continue;
          }
          e.popBubble(e.cx >= p.cx ? 1 : -1);
          if (fallVy > 0) p.bounce();
        }
        continue;
      }

      /*
       * RAAJA SATUTTAA, EIKÄ SEN PÄÄLLE VOI LASKEUTUA.
       *
       * Piirretty raaja jonka läpi kävelee on sama valhe kuin piikki joka ei
       * satuta, ja tämä peli kieltäytyy jo siitä. Raajat ovat siis osa
       * vahinkoaluetta — mutta **vain vahinkoa**: laskeutuminen on rungon ja
       * kruunun asia, ja kruunu on se yksi merkki jonka pelaajan on luettava
       * ennen hyppyä. Tallottava nyrkki tekisi siitä kaksi kysymystä.
       *
       * Tähti suojaa, kuten kaikelta muultakin joka osuu sinuun, ja kupla
       * ohittaa tämän kokonaan ylempänä.
       */
      if (e.limbBoxes) {
        const boxes = e.limbBoxes();
        const idx = boxes.findIndex((b) => b.h > 0 && b.w > 0 && overlaps(p.box, b));
        if (idx >= 0) {
          /*
           * KRUUNU VASTAA KOKO KOOSTEESTA, EI PELKÄSTÄ RUNGOSTA.
           *
           * Kruunu päällä: mihinkään ei saa koskea, ei runkoon eikä raajaan.
           * Kruunu pois: kaikki on tallottavissa. Yksi merkki, yksi vastaus —
           * ja juuri se on syy miksi raajalla ei ole omaa varoitustaan.
           * Kruunusääntö ostettiin aikoinaan playtestillä jossa pelaajat eivät
           * ehtineet erottaa kahta piikkiriviä toisistaan, eikä sitä makseta
           * uudelleen.
           *
           * Valinta on ikkunan sisällä: runko maksaa osuman, raaja katkeaa.
           */
          /*
           * Sama ehto kuin rungolla, kahdesti.
           *
           * **Vaihe:** `!e.spiky` eikä `spikePhase === 'open'`. Runko käyttää
           * ensimmäistä, ja telegraph-vaiheessa ne erosivat: vartalo oli
           * tallottavissa mutta raaja satutti, mikä on tasan päinvastoin kuin
           * yllä oleva lause "kruunu pois: kaikki on tallottavissa".
           *
           * **Asento:** jalat raajan yläpuolella. Pelkkä `fallVy > 0` antoi
           * ilmaisen pompun ja katkaisun myös kyljestä osuvasta kosketuksesta
           * — sama kosketus vartaloon maksoi osuman.
           */
          const b = boxes[idx];
          const onTop = fallVy > 0 && p.y + p.h - fallVy <= b.y + b.h * 0.6;
          if (!e.spiky && onTop && e.breakLimb && e.breakLimb(idx)) {
            p.bounce();
            Sfx.play('stomp');
            continue;
          }
          if (p.star <= 0 && !p.invuln) { p.hurt('enemy'); continue; }
        }
      }

      if (e.harmless) continue;

      if (spin && overlaps(spin, e.box)) {
        e.hitByTail(p.facing);
        continue;
      }

      if (!overlaps(p.box, e.box)) continue;

      const stomping = fallVy > 0 && p.y + p.h - fallVy <= e.y + e.h * 0.6;

      /*
       * Spines beat the stomp, and they beat it the way the floor spikes do: a
       * hit and a shove back off the points, never a stomp that quietly did
       * nothing. The star is deliberately not covered here — it falls through
       * to the shell hit below, because protection from the inhabitants is
       * exactly what it promises.
       */
      if (stomping && e.spiky && p.star <= 0) {
        if (p.hurt('spike')) p.vy = -3;
        continue;
      }

      if (stomping && e.stompable && !e.spiky) {
        if (e.stomp()) {
          p.bounce(this.game.input.held.jump);
          Sfx.play('stomp');
        }
        continue;
      }

      if (e.mode === 'shell') {
        e.kick(e.cx >= p.cx ? 1 : -1);
        continue;
      }

      /*
       * Supertähti. It replaces exactly one thing — the hit an enemy would
       * land — and nothing else, which is why it lives here and not in
       * `hurt`.
       *
       * **Tämä kappale sanoi pitkään että piikki ja närästysliekki eivät ole
       * suojattuja, ja se oli väärässä samassa tiedostossa olevaa koodia
       * vasten:** piikki on lukenut tähteä aina (`T.SPIKE && !(p.star > 0)`).
       * Kaksi kommenttia oli siis eri mieltä, ja pelaaja löysi eron 4-1:ssä
       * kuolemalla liekkiin tähti päällä.
       *
       * Raja on **isku vastaan paikka**, ei vihollinen vastaan kenttä: kuoppa,
       * laava ja kello ovat paikkoja joihin sinä menet, eivätkä ne ole
       * suojattuja; piikki, närästysliekki ja papupommi osuvat sinuun, ja ne
       * ovat. Se on yhä yksi lause, se on vain eri lause kuin tässä luki.
       *
       * Delivered as a shell hit rather than a `flipDie` so the tough
       * customers stay tough — the boss still needs his three, the sun still
       * needs her three — and so one death path serves every enemy type.
       */
      if (p.star > 0) {
        e.hitByShell(e.cx >= p.cx ? 1 : -1);
        continue;
      }

      if (e.corks) p.cork();
      else p.hurt();
    }
  }

  completeLevel(card) {
    if (this.state !== 'play') return;
    this.state = 'clear';
    this.stateTimer = 0;
    this.recordClear();
    this.wonCard = card;
    this.player.controllable = false;
    this.player.autoWalk = true;
    this.player.ducking = false;
    this.awardScore(Math.max(0, this.time) * 50);
    this.recordRace();
    Music.stop();
    Ambience.stop();
    Sfx.play('clear');
  }

  /* --------------------------------- draw ------------------------------ */

  draw(ctx) {
    /*
     * Palettisiirto työnnetään framen alussa, samasta syystä kuin lamppu
     * (`PostFX.setFocus`): kohtaus on ainoa joka tietää mitä juuri tapahtui.
     * Siirto elää yhden framen ja kuluu piirtoon, joten se on pyydettävä joka
     * kerta uudestaan — kartta, valikko ja pistetaulu eivät pyydä sitä
     * koskaan, eikä edellisen kentän osuma siksi voi värjätä niitä.
     */
    const shift = this.paletteShift();
    if (shift) PostFX.setTint(shift.r, shift.g, shift.b, shift.amount, shift.mode);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.bar, VIEW_W, this.viewH);
    ctx.clip();
    // From here down the origin is the top-left of the *window*, so nothing
    // below has to know a bar is there.
    ctx.translate(0, this.bar);

    /* The scenery belongs to the ground band. Once the camera is above it —
     * up the beanstalk — the hills have to get out of the way, or a platform
     * twenty tiles in the air looks like it is standing on them. */
    const bandDrop = this.def.bands
      ? Math.max(0, (this.def.bands.main * TILE - this.cam.y) * 0.6) : 0;
    drawBackdrop(ctx, this.def.bg, this.theme, this.cam.x, VIEW_W, this.viewH, this.tick, bandDrop);

    const jitter = this.shakeOffset();
    const camX = Math.round(this.cam.x) + jitter.x;
    const camY = Math.round(this.cam.y) + jitter.y;
    ctx.translate(-camX, -camY);

    if (this.def.bands) this.drawUnderground(ctx, camX, camY);
    this.drawTiles(ctx, camX, camY);
    if (this.game.debug) this.drawHeatmap(ctx, camX, camY);
    if (this.goal) {
      drawGoal(ctx, this.goal.x, this.goal.y, GOAL_HEIGHT, this.cardIndex, this.state !== 'play');
    }

    /* The lamp follows the player, and this is the only place its screen
     * position is already known: the camera rounding, the shake jitter and the
     * letterbox offset have all been applied by now. Working it out anywhere
     * else would mean deriving the same three numbers a second time, and the
     * light would sit a shake behind the thing it is lighting.
     *
     * Aiming it also clears last frame's world lights, so it has to come before
     * the entities offer theirs. */
    const lit = !!this.def.spotlight;
    if (lit) PostFX.setFocus(this.player.cx - camX, this.player.cy - camY + this.bar);

    for (const e of this.entities) {
      if (!e.active) continue;
      if (e.x + e.w < camX - 32 || e.x > camX + VIEW_W + 32) continue;
      e.draw(ctx);
      // Gathered in the draw loop rather than in a pass of its own: whatever is
      // close enough to be worth lighting is exactly what is close enough to be
      // worth drawing, and the cull is already written here.
      const glow = lit ? e.light : null;
      if (glow) PostFX.addLight(glow.x - camX, glow.y - camY + this.bar, glow.r, glow.i);
    }
    this.drawPlayerInto(ctx, camX, camY);

    ctx.restore();
    this.drawSpeedPulse(ctx);
    if (this.bar) this.drawLetterbox(ctx);
    this.drawHud(ctx);
  }

  /**
   * Vauhtimittarin sykäys, ruutukoordinaateissa ja HUDiin koskematta.
   *
   * Piirretään `restore`n jälkeen, koska tämä ei ole maailmassa: kamera, tärinä
   * ja kirjekuoripalkit on jo purettu, ja efekti on kertojan puolella siinä
   * missä musiikki ja HUD. Yksi suorakulmio, ja se rajautuu itse ikkunaan
   * (`bar`…`viewH`) — kirjekuoripalkit ja HUD jäävät sen ulkopuolelle.
   *
   * Verho neliöidään: isku on edessä ja häntä pitkä. Tasaisesti hiipuva verho
   * lukisi himmennykseksi, ja etupainoinen lukee tapahtumaksi — sama muotoilu
   * kuin `PoundWave`n renkaassa ja samasta syystä. Perustelut väreille ja
   * kestoille ovat SPEED_PULSE_FULLin kommentissa.
   */
  drawSpeedPulse(ctx) {
    if (this.speedPulse <= 0) return;
    const span = this.speedPulseUp ? SPEED_PULSE_FULL : SPEED_PULSE_SPENT;
    const k = clamp(this.speedPulse / span, 0, 1) ** 2;
    ctx.fillStyle = this.speedPulseUp
      ? `rgba(240,176,0,${(0.30 * k).toFixed(3)})`
      : `rgba(8,8,22,${(0.34 * k).toFixed(3)})`;
    ctx.fillRect(0, this.bar, VIEW_W, this.viewH);
  }

  /**
   * The player, and the reason a pipe swallows him instead of being painted
   * over.
   *
   * Tiles are drawn before entities, so a body sliding into a mouth would sit
   * on top of the pipe it is supposed to be inside. There is no depth here and
   * there should not be one for a single case: a clip to the half of the world
   * on the near side of `transit.hide` costs one rectangle and does exactly
   * what a sprite behind a tile would look like. The 8 px slack on the other
   * three sides is so nothing gets clipped that was not meant to be — the
   * shake jitter can push a frame a couple of pixels either way.
   */
  drawPlayerInto(ctx, camX, camY) {
    const t = this.player.transit;
    if (!t || t.hide === null || t.hide === undefined) {
      this.player.draw(ctx);
      return;
    }
    ctx.save();
    ctx.beginPath();
    const l = camX - 8;
    const top = camY - 8;
    const r = camX + VIEW_W + 8;
    const b = camY + this.viewH + 8;
    if (t.axis === 'x') {
      if (t.hideDir > 0) ctx.rect(l, top, t.hide - l, b - top);
      else ctx.rect(t.hide, top, r - t.hide, b - top);
    } else if (t.hideDir > 0) ctx.rect(l, top, r - l, t.hide - top);
    else ctx.rect(l, t.hide, r - l, b - t.hide);
    ctx.clip();
    this.player.draw(ctx);
    ctx.restore();
  }

  /**
   * The bars. Playfield only — the HUD is not part of the picture, and a
   * widescreen score readout is just a score readout with a slice missing.
   */
  drawLetterbox(ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, VIEW_W, this.bar);
    ctx.fillRect(0, VIEW_H - this.bar, VIEW_W, this.bar);
  }

  /**
   * The playtest heatmap, drawn under the entities so it never hides anything
   * you might need to see. Red columns are deaths, blue ones are stalls — the
   * two mean different things and a single colour would blur them together.
   *
   * Recomputed on a timer rather than every frame: it is a whole-log scan, and
   * a debug overlay has no business costing frame time.
   */
  drawHeatmap(ctx, camX, camY) {
    if (!this._heat || this.tick - this._heatAt > 30) {
      this._heat = levelSummary(this.id);
      this._heatAt = this.tick;
    }
    const heat = this._heat;
    if (!heat.total && !heat.stuckTotal) return;

    const tx0 = Math.max(0, Math.floor(camX / TILE));
    const tx1 = Math.min(this.w - 1, Math.floor((camX + VIEW_W) / TILE));
    for (let tx = tx0; tx <= tx1; tx++) {
      const deaths = heat.deaths.get(tx) || 0;
      const stuck = heat.stuck.get(tx) || 0;
      if (!deaths && !stuck) continue;
      if (deaths) {
        ctx.fillStyle = `rgba(255,48,48,${0.12 + 0.5 * (deaths / heat.worst)})`;
        ctx.fillRect(tx * TILE, camY, TILE, this.viewH);
      }
      if (stuck) {
        ctx.fillStyle = `rgba(64,160,255,${0.1 + 0.4 * (stuck / heat.worst)})`;
        ctx.fillRect(tx * TILE, camY + this.viewH - 6, TILE, 6);
      }
    }
  }

  /**
   * The backdrop is sky, and sky has no business being visible from inside the
   * cave. One wash over the bottom band is all it takes — the tiles are drawn
   * on top of it — so underground reads as underground without a second
   * backdrop, a second theme or a second scene.
   */
  drawUnderground(ctx, camX, camY) {
    const top = this.def.bands.cave * TILE;
    if (camY + this.viewH <= top) return;
    ctx.fillStyle = '#150e1c';
    ctx.fillRect(camX, top, VIEW_W, this.heightPx - top);
  }

  drawTiles(ctx, camX, camY) {
    const tx0 = Math.max(0, Math.floor(camX / TILE));
    const tx1 = Math.min(this.w - 1, Math.floor((camX + VIEW_W) / TILE));
    const ty0 = Math.max(0, Math.floor(camY / TILE));
    const ty1 = Math.min(this.h - 1, Math.floor((camY + this.viewH) / TILE));

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        /* Draw what the tile currently *is*, switch and all — otherwise the
         * bricks you can walk through would still look like bricks. Near the
         * end the two flicker against each other, which is how a player is
         * told to get off them without being told anything. */
        const warning = this.switchTimer > 0 && this.switchTimer < SWITCH_WARN
          && Math.floor(this.tick / 6) % 2 === 0;
        const ch = warning ? this.rawTileAt(tx, ty) : this.tileAt(tx, ty);
        if (ch === ' ') continue;
        const bump = this.bumps.get(`${tx},${ty}`);
        const offset = bump === undefined ? 0 : Math.round(Math.sin((bump / 10) * Math.PI) * -6);
        drawTile(ctx, ch, tx * TILE, ty * TILE + offset, this.theme, tx, ty, this.tick,
          this.tileAt(tx, ty - 1),
          {
            // How far, not whether: the leaves swing. See DOOR_OPEN_FRAMES.
            doorOpen: this.doorOpen,
            crumble: this.crumbleProgress(tx, ty),
            shelf: ch === T.SHELF ? this.shelfLeft(tx, ty) : undefined,
            /* Möykyn varoitustärinä. Sama kanava kuin murenevalla laudalla,
             * koska se on sama lupaus: se mikä on lähdössä, näyttää siltä. */
            fall: this.fallWobble(tx, ty),
            switchOn: this.switchTimer > 0,
            // A door is several tiles; each slice needs to know which of its
            // sides are the outside of the whole door.
            /* A ground tile beside a spike bed gets a hazard stripe on that
             * edge. Computed here because the drawing code sees one tile at a
             * time and this is a question about the tile next door. */
            warn: ch === T.GROUND
              ? (this.tileAt(tx - 1, ty - 1) === T.SPIKE ? -1
                : this.tileAt(tx + 1, ty - 1) === T.SPIKE ? 1 : 0)
              : 0,
            /* `info(ch).door` and not `ch === T.DOOR`: the flag existed and was
             * read nowhere, which is a thing that looks live and is not. It is
             * the question being asked here, so it is the thing to ask. */
            doorEdges: info(ch).door ? {
              l: !info(this.tileAt(tx - 1, ty)).door,
              r: !info(this.tileAt(tx + 1, ty)).door,
              t: !info(this.tileAt(tx, ty - 1)).door,
              b: !info(this.tileAt(tx, ty + 1)).door,
            } : null,
          });
      }
    }
  }

  /**
   * A banner with some swagger: it punches in from oversized, rocks gently,
   * and cycles colour. A flat line of white text is an error message, not a
   * moment.
   */
  drawBanner(ctx, text, y, colors) {
    const age = this.stateTimer;
    const punch = age < 8;
    const scale = punch ? 3 : 2;
    const rock = Math.round(Math.sin(age / 7) * 2);
    const color = colors[Math.floor(age / 6) % colors.length];
    const cx = VIEW_W / 2;
    const width = textWidth(text, scale);

    ctx.fillStyle = 'rgba(8,8,16,0.55)';
    ctx.fillRect(cx - width / 2 - 8, y - 6, width + 16, scale * 7 + 12);
    ctx.fillStyle = color;
    ctx.fillRect(cx - width / 2 - 8, y - 6, width + 16, 2);
    ctx.fillRect(cx - width / 2 - 8, y + scale * 7 + 4, width + 16, 2);

    drawText(ctx, text, cx + rock, y, {
      color, align: 'center', shadow: '#101018', scale,
    });
  }

  /**
   * Jako. Nuoli ja etumerkillinen luku, ks. SPLIT_X yllä laatikkolaskusta.
   *
   * Kaksi kanavaa samasta signaalista, ei kahta signaalia: nuoli osoittaa ylös
   * kun ollaan edellä ja alas kun jäljessä, ja luvun etumerkki sanoo saman.
   * Väri on kolmas, ja se on valittu etäisyydellä muihin HUDin väreihin.
   *
   * **Ei ennätystä on oikea tila eikä puuttuva arvo**, ja se on uuden pelaajan
   * tavallisin tila — 60 kentästä 59 on ajamatta. Silloin paikalla lukee
   * `--.-` himmeänä: se varaa saman tilan kuin oikea lukema, joten mitään ei
   * ilmesty tyhjästä sillä hetkellä kun ensimmäinen ennätys syntyy, ja se
   * sanoo suoraan ettei vertailukohtaa ole. Kellon jäännöstä tai kulunutta
   * aikaa ei laiteta tilalle, koska kumpikin on jo nauhassa toisin päin.
   */
  drawSplit(ctx, y) {
    const r = this.race;
    const ty = y + 6;
    const has = r.delta !== null;
    const ahead = has && r.delta <= 0;
    const color = has ? (ahead ? SPLIT_COLORS.ahead : SPLIT_COLORS.behind) : SPLIT_COLORS.none;
    const text = formatDelta(has ? r.delta : null);
    const flash = has && r.flash > 0;
    if (flash) {
      ctx.fillStyle = color;
      ctx.fillRect(SPLIT_X - 1, ty - 1, 8 + textWidth(text), 9);
    }
    const ink = flash ? '#101018' : color;
    if (has) this.drawSplitArrow(ctx, SPLIT_X, ty, ahead, ink);
    drawText(ctx, text, SPLIT_X + 7, ty, { color: ink });
  }

  /** Viiden pikselin kärki ja varsi, samassa 7 pikselin rivissä kuin teksti. */
  drawSplitArrow(ctx, x, y, up, color) {
    ctx.fillStyle = color;
    if (up) {
      ctx.fillRect(x + 2, y, 1, 1);
      ctx.fillRect(x + 1, y + 1, 3, 1);
      ctx.fillRect(x, y + 2, 5, 1);
      ctx.fillRect(x + 2, y + 3, 1, 4);
    } else {
      ctx.fillRect(x + 2, y, 1, 4);
      ctx.fillRect(x, y + 4, 5, 1);
      ctx.fillRect(x + 1, y + 5, 3, 1);
      ctx.fillRect(x + 2, y + 6, 1, 1);
    }
  }

  /**
   * Maalin jälkeen yksi rivi, koska ensimmäisen kentän jälkeen jaon paikalla on
   * lukenut `--.-` koko ajan eikä pelaaja muuten näe mitä hän juuri kirjasi.
   *
   * Rivi on **korttikuvan alapuolella**, ei sen yläpuolella. Väli lipputekstin
   * ja kortin välissä näyttää tyhjältä mutta ei ole: `drawBanner` piirtää
   * alareunaviivansa kohtaan `y + scale*7 + 4`, ja `scale` on ensimmäiset
   * kahdeksan framea 3 eikä 2 — eli se rako on kahdeksan framen ajan 7
   * pikseliä matalampi kuin miltä se näyttää. Kortti loppuu 100:aan, joten
   * 104 on ensimmäinen rivi joka ei ole kenenkään.
   */
  drawRaceResult(ctx) {
    const r = this.raceResult;
    const line = r.best === null
      ? `${FIRST_TIME}  ${formatTime(r.frames)}`
      : (r.record
        ? `${NEW_RECORD}  ${formatTime(r.frames)}`
        : `${RUN_LABEL} ${formatTime(r.frames)}   ${BEST_LABEL} ${formatTime(r.best)}`);
    drawText(ctx, line, VIEW_W / 2, 104, {
      color: r.record ? SPLIT_COLORS.ahead : '#ffffff', align: 'center', shadow: '#101018',
    });
  }

  drawHud(ctx) {
    const th = THEMES[this.theme] || THEMES.grass;
    const y = VIEW_H;
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, y, VIEW_W, HUD_H);
    ctx.fillStyle = th.hardDark;
    ctx.fillRect(0, y, VIEW_W, 1);

    // reserve item box
    ctx.fillStyle = '#202038';
    ctx.fillRect(6, y + 6, 20, 20);
    ctx.fillStyle = '#50506e';
    ctx.fillRect(6, y + 6, 20, 1);
    ctx.fillRect(6, y + 25, 20, 1);
    ctx.fillRect(6, y + 6, 1, 20);
    ctx.fillRect(25, y + 6, 1, 20);
    if (this.game.state.reserve) drawItem(ctx, this.game.state.reserve, 8, y + 8, this.tick);

    // P-meter
    drawText(ctx, 'P', 34, y + 6, { color: '#ffffff' });
    const bars = this.player.pBars;
    const full = this.player.pMeter >= P_METER_MAX;
    for (let i = 0; i < 7; i++) {
      const lit = i < bars;
      const blink = full && Math.floor(this.tick / 4) % 2 === 0;
      ctx.fillStyle = lit ? (full && blink ? '#ffffff' : '#f0b000') : '#3a3a52';
      const bx = 42 + i * 7;
      ctx.fillRect(bx, y + 6, 5, 7);
      ctx.fillStyle = '#101018';
      ctx.fillRect(bx + 5, y + 6, 2, 7);
    }
    // power level pips — one per collected power-up, colour shows the type
    const p = this.player;
    const typeColor = { shroom: '#e04c3c', flower: '#f8f8f8', leaf: '#c88c40' }[p.type] || '#3a3a52';
    for (let i = 0; i < 5; i++) {
      const bx = 34 + i * 7;
      ctx.fillStyle = i < p.powerLevel ? typeColor : '#2a2a3e';
      ctx.fillRect(bx, y + 18, 5, 5);
      if (i < p.powerLevel) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(bx, y + 18, 5, 1);
      }
    }
    drawText(ctx, `KV *${this.game.state.lives}`, 100, y + 6, { color: '#ffffff' });
    drawText(ctx, `KOLIKOT ${padNum(this.game.state.coins, 2)}`, 100, y + 17, { color: '#ffd048' });

    /* Päivän kenttä ei ole missään maailmassa, joten se kertoo nimensä. Mitattu
     * että se mahtuu: 12 merkkiä * 6 px = 72 px, 196 + 72 = 268, ja oikealle
     * tasattu 7-numeroinen pistelukema alkaa 272:sta. */
    drawText(ctx, this.def.daily ? DAILY_TITLE : `MAAILMA ${this.id}`, 196, y + 6, { color: '#8fe04a' });
    const timeColor = this.time <= 100 ? (Math.floor(this.tick / 8) % 2 ? '#ff6060' : '#ffffff') : '#ffffff';
    drawText(ctx, `AIKA ${padNum(this.time, 3)}`, 196, y + 17, { color: timeColor });
    if (this.race) this.drawSplit(ctx, y);

    drawText(ctx, padNum(this.game.state.score, 7), VIEW_W - 6, y + 6, {
      color: '#ffffff', align: 'right',
    });
    if (this.player.star > 0) {
      // Top of the pile: it is the shortest-lived of the three and the only one
      // whose ending gets you killed.
      const secs = Math.ceil(this.player.star / 60);
      drawText(ctx, `TÄHTI ${secs}`, VIEW_W - 6, y + 17, {
        color: STAR_HUD_COLORS[Math.floor(this.tick / 4) % STAR_HUD_COLORS.length],
        align: 'right',
      });
    } else if (this.switchTimer > 0) {
      const secs = Math.ceil(this.switchTimer / 60);
      drawText(ctx, `KYTKIN ${secs}`, VIEW_W - 6, y + 17, {
        color: this.switchTimer < SWITCH_WARN && Math.floor(this.tick / 6) % 2
          ? '#ff8040' : '#8fd0ff',
        align: 'right',
      });
    } else if (this.player.corked > 0) {
      const secs = Math.ceil(this.player.corked / 60);
      drawText(ctx, `UMMETUS ${secs}`, VIEW_W - 6, y + 17, {
        color: Math.floor(this.tick / 6) % 2 ? '#ff8040' : '#c85820', align: 'right',
      });
    } else if (this.bossDefeated) {
      drawText(ctx, 'OVI AUKI', VIEW_W - 6, y + 17, { color: '#ffd048', align: 'right' });
    }

    if (this.state === 'clear' && this.wonCard) {
      this.drawBanner(ctx, 'KENTTÄ SELVÄ!', 54, ['#ffd048', '#ffffff', '#8fe04a']);
      drawItem(ctx, this.wonCard, VIEW_W / 2 - 8, 84, this.tick);
    }
    if (this.state === 'clear' && this.raceResult) this.drawRaceResult(ctx);
    if (this.state === 'dead') {
      this.drawBanner(ctx, 'VOI EI!', 74, ['#ff6060', '#ffffff', '#ffb040']);
    }
  }
}
