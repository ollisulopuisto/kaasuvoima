/**
 * The player, from one 14x26 template that gets blitted with nearest-neighbour
 * scaling — which is how the five power levels grow.
 *
 * Everything the character does while standing still is here too. It is the
 * same drawing as the walk cycle seen from one frame further on, so keeping the
 * idle poses next to the body that performs them is the only way a change to
 * one is checked against the other.
 *
 * What he *looks* like is one table, `POWER_LOOKS`, and the argument for it is
 * written there. The rest of this file draws shapes and reads its colours out
 * of that table, so the way to disagree with the character's palette is to edit
 * a hex in it — not to unpick the drawing.
 */

import { C, outlined, flip, recolored, glowing } from './palette.js';

/** Body box per power level (0 = no power-up, 5 = fully gassed). */
export const PLAYER_SIZES = [
  { w: 12, h: 16 },
  { w: 14, h: 26 },
  { w: 15, h: 30 },
  { w: 17, h: 34 },
  { w: 19, h: 38 },
  { w: 21, h: 43 },
];

export const PLAYER_DUCK_SIZES = [
  { w: 12, h: 16 },
  { w: 14, h: 16 },
  { w: 15, h: 19 },
  { w: 17, h: 21 },
  { w: 19, h: 24 },
  { w: 21, h: 27 },
];

const BASE_NORMAL = { w: 14, h: 26 };
const BASE_DUCK = { w: 14, h: 16 };

/**
 * The five power looks. **This is the whole colour story of the character, and
 * it is a table so that it can be argued with in one line rather than in a
 * revert.** Four colours and an optional marking per row; nothing below picks a
 * garment colour of its own, so changing `suit` here changes the torso in the
 * standing pose, the ducking pose, the climb, the buffer that the big power
 * levels are scaled out of, the title cast, the map pawn and the victory card,
 * all at once and by construction.
 *
 * **What each colour is.** `hair` is the top of the head. `suit` is the
 * coverall from the shoulders to the belt. `shade` is the belt itself — two
 * rows, the bottom of the coverall and the top of the trousers, which is why
 * one colour does both. `legs` is the trousers. `mark` is what the power-up
 * left on him, drawn on the coverall; only the mushroom has one, and the field
 * is a colour rather than a flag so that the next power-up that wants a marking
 * can have its own without touching the drawing.
 *
 * **Why he is dressed like this, and not the way he was dressed before.** The
 * old table gave him a peaked cap, and at the first mushroom it was red with
 * white spots over a shirt and trousers. That is the single most recognisable
 * costume in this genre and it was not ours to use: DESIGN.md §2 says the genre
 * is free and the expression is not, and a red-capped figure in a shirt is
 * expression. Worse, it was the *only* thing the first mushroom changed, so two
 * of the five tiers were one drawing with the hat repainted.
 *
 * What replaced it comes from what this game is actually about. He goes down
 * into a world of bowels after the PIERUPRINSSI, so he is dressed for the job:
 * a one-piece coverall, a belt with a brass pressure valve on it, and — with
 * the kaasulehti — a gas hose that whips behind him and a pair of valves. He
 * has hair instead of a hat, which is also the honest drawing: the desert idle
 * has always been called `hairFire` in this file and it used to set a cap
 * alight.
 *
 * And the gas shows in him. The tiers are not a wardrobe, they are how much of
 * the stuff he is carrying: drab slate when he has none, gas green at the
 * mushroom with bubbles rising through the cloth, the flower's purple, the
 * leaf's brass under green hair, and the bean's browns. That is why the hair
 * changes colour with the tier and a hat would not have needed to — at 12x16
 * the head is a quarter of the picture, and a tier you cannot name at a glance
 * is not a tier.
 */
const POWER_LOOKS = {
  none: { hair: C.brownDark, suit: '#6a7488', shade: '#39414f', legs: '#4c5666' },
  shroom: { hair: C.greenDark, suit: C.gas, shade: C.greenDark, legs: C.gasDark, mark: '#e8ffc0' },
  flower: { hair: C.purpleDark, suit: C.purple, shade: '#3c1840', legs: C.purpleDark },
  /*
   * KAASULEHTI = PAINEASTIA, ja tämä rivi on omistajan tuomio 16.8.2026:
   * "muuta tanooki-design, keksi jotain pierumaisempaa ja kaasuisempaa".
   *
   * Rivissä luki `suit: C.tan, shade: C.brownDark, legs: C.brown`, eli
   * ruskeanbeige puku vihreiden lehtikorvien alla. Se on tarkalleen sen yhden
   * puvun väriskaala jota tämä genre ei omista, ja kaikki kolme aiempaa
   * korjausta olivat kohdistuneet **muotoon** (korvat → lehdet, häntä → letku)
   * eivätkä väriin — joten taso luki yhä siltä siltä miltä se on aina lukenut.
   *
   * Messinki on tämän pelin oma vastaus, ja se on jo pelissä: vyön
   * paineventtiili, letkun suutin, torven torvi. Tässä tasossa hän ei muutu
   * eläimeksi vaan **laitteeksi** — letku, kaksi venttiiliä (`ventValves`) ja
   * messinkihaalari — ja lentäminen on painetta jota päästetään ulos.
   *
   * Vihreä hiuspohja jää, ja se on tahallista: se on ainoa vihreä tässä
   * tasossa, joten se sitoo laitteen siihen kaasuun jota se käsittelee. Ja
   * messinki on erotettava neljästä muusta tasosta — kivilohkare (liuske),
   * sieni (kaasunvihreä), kukka (violetti), papu (ruoste) — mikä se
   * kylläisyydeltään ja tummuudeltaan on.
   */
  leaf: { hair: C.gasDark, suit: '#b8862c', shade: '#5c3c0c', legs: '#8c6414' },
  /* Paukkupapu. The darkest, heaviest row of the five, because the thing it
   * does is walk through a wall — and it must not be mistaken for the mushroom,
   * which is the one every player learns first. That used to mean "not red";
   * now that the mushroom is the gas green of this game's own signature, it
   * means not green either, so the bean is bean all the way down. */
  pop: { hair: '#4a1c0a', suit: '#8c3c1c', shade: '#4a1c0a', legs: '#c05a24' },
};

/**
 * The order the three leg frames are played in, and therefore how long a
 * stride is. A walk is contact, pass, contact, pass: the two contact poses (0
 * and 2) must never follow one another, or the character puts both feet down
 * twice in a row once per stride and limps.
 *
 * The driver used to run the frames with `% 3`, which wraps 2 straight back to
 * 0 with nothing between them. The frames themselves were always right — this
 * is only their order. Mapping the index through a table rather than
 * renumbering the frames keeps every other caller drawing exactly what it drew
 * before, because 0, 1 and 2 still mean the poses they always meant.
 */
const WALK_ORDER = [0, 1, 2, 1];
export const WALK_FRAMES = WALK_ORDER.length;

/**
 * Frames of standing perfectly still before the *second* tier of idle starts.
 *
 * Twenty seconds, which is not a guess: it is the same wait the title screen
 * makes before the cabinet starts playing by itself, so the game has one dead
 * time and a player only ever has to learn it once. The dead time is the whole
 * joke — a gag on a short loop stops being a gag inside the first hour — and
 * the breathing that starts immediately stays exactly as it was, as tier one.
 */
export const DEEP_IDLE = 20 * 60;

/**
 * The three-frame leg cycle: apart, together, apart the other way. Five pixels
 * tall from the top of the thigh to the sole, so it is called at the point that
 * leaves the sole on the last row of the body box and not one below it.
 *
 * The stride is capped by the width it has to fit in. A run opens the legs one
 * pixel wider than a walk, which on the 14px body leaves a two pixel gap
 * between them — but on the 12px body of power level 0 it closed the gap
 * completely, so the running frames merged into one block and the small
 * character ran with less motion in his legs than he walked with.
 */
function legs(ctx, x, y, w, pal, frame, running) {
  ctx.fillStyle = pal.legs;
  const spread = Math.min(running ? 4 : 3, (w - 6) >> 1);
  if (frame === 0) {
    ctx.fillRect(x + 2, y, spread, 3);
    ctx.fillRect(x + w - 2 - spread, y, spread, 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 1, y + 3, spread + 1, 2);
    ctx.fillRect(x + w - 2 - spread, y + 3, spread + 1, 2);
  } else if (frame === 1) {
    ctx.fillRect(x + 3, y, w - 6, 3);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 2, y + 3, w - 4, 2);
  } else {
    ctx.fillRect(x + 1, y, spread, 3);
    ctx.fillRect(x + w - 3 - spread, y + 1, spread, 2);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x, y + 3, spread + 2, 2);
    ctx.fillRect(x + w - 3 - spread, y + 3, spread, 2);
  }
}

/*
 * PYÖRIVÄT JALAT: se yksi kuva jonka Sonic keksi ja jota tämä peli tarvitsi.
 *
 * Omistaja 17.8.2026: *"jalat pyörivät vauhdikkaasti kuin Sonicilla alamäkeen
 * mennessä."* Ehto on kirjoitettu `player.js`:ssä yhdeksi lauseeksi — **keho
 * menee kovempaa kuin sen jalat osaavat kävellä** — eli `|vx| > MAX_RUN`. Se
 * on tosi täsmälleen kahdessa tilanteessa: alamäessä (`slopePull` lainaa
 * ylimmän nopeuden) ja täydellä vauhtimittarilla. Rinne on niistä se jonka
 * pelaaja näkee ensin, ja se on myös se joka pyydettiin.
 *
 * Kuva on **kiekko ja kaksi puolaa** eikä kolmas kävelyruutu, ja se on koko
 * idea: kävelyruutuja vaihtamalla nopeammin saa nopeamman kävelyn, ei
 * pyörimistä. Jalat lakkaavat olemasta jalkoja ja muuttuvat pyöräksi, jonka
 * liikkeen lukee **puolista** — kaksi tummaa merkkiä jotka kiertävät kehää.
 * Sama keino kuin sarjakuvassa, ja se toimii samasta syystä: silmä ei seuraa
 * sumeaa muotoa vaan sitä ainoaa kohtaa jossa on kontrastia.
 *
 * Kiekko täyttää laatikon pohjan reunasta reunaan (x+1 … x+w-1) ja koskettaa
 * ylhäältä runkoa. Se ei ole koristeellinen valinta vaan portin ehto: pelaajan
 * piirroksesta luetaan sekä osumalaatikko että se, onko hahmo yhtä kappaletta.
 */
function spinLegs(ctx, x, y, w, pal, tick) {
  const cx = x + w / 2;
  const rx = w / 2 - 1;
  const cy = y + 2;
  ctx.fillStyle = pal.legs;
  for (let dy = -2; dy <= 2; dy++) {
    const k = Math.sqrt(Math.max(0, 1 - (dy / 2.6) ** 2));
    const half = Math.round(rx * k);
    ctx.fillRect(Math.round(cx - half), cy + dy, half * 2, 1);
  }
  /* Pohjarivi läpi laatikon: pyörä koskettaa maata koko leveydeltään, ja
   * silhuetti pysyy samana kuin kävelevällä. */
  ctx.fillStyle = C.ink;
  ctx.fillRect(Math.round(cx - rx), y + 4, Math.round(rx * 2), 1);
  /*
   * Kaksi puolaa vastakkain, kierros noin seitsemässä framessa. Nopeampi
   * kierto olisi välkyntää 60 Hz:n ruudulla eikä liikettä.
   *
   * **Vaaleat eikä tummat**, ja se on mitattu silmällä kuvasta: kiekon oma
   * väri on housut (tumma) ja sen alareuna on musta, joten tumma puola katosi
   * omaan taustaansa. Liike luetaan kontrastista, ja ainoa kontrasti joka
   * tästä kiekosta on saatavilla on valo.
   */
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 3; i++) {
    const a = tick * 0.9 + (i * 2 * Math.PI) / 3;
    for (const r of [0.45, 0.8]) {
      const sx = Math.round(cx + Math.cos(a) * rx * r) - 1;
      const sy = Math.round(cy + Math.sin(a) * 1.7 * r);
      ctx.fillRect(sx, sy, 2, 1);
    }
  }
  /* Ylälaidan valokaari: pyörän yläreuna on se osa joka liikkuu nopeimmin, ja
   * pysyvä vaalea juova siinä on koko sarjakuvakikan toinen puoli — puolat
   * kertovat *että* pyörii, juova kertoo *kuinka kovaa*. */
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(Math.round(cx - rx * 0.8), cy - 2, Math.round(rx * 1.6), 1);
}

/**
 * The kaasulehti's gas hose, drawn behind the body (the sprite always faces
 * +x), swinging on the same sine the leaf power has always swung.
 *
 * It is a hose and not a striped animal tail, and the difference is the whole
 * point of the change: the leaf gives him the tail whip, the glide and the
 * flight, and in a game about gas the thing that does all three is a hose with
 * a brass nozzle on the end of it — he whips with the nozzle and he flies out
 * of it. An animal's tail on a man is a costume, and there is exactly one
 * costume in this genre that it reads as.
 *
 * The three blocks are the ones the wag was built around and they have not
 * moved a pixel, because their overlap at every phase of the swing is what
 * keeps the sprite a single piece — see the audit in `tools/verify.mjs`. What
 * changed is what they are made of: green rubber, a rib across each segment so
 * that the swing has something to read against, and the nozzle at the far end.
 */
function gasHose(ctx, x, y, wag) {
  const dx = Math.round(Math.sin(wag) * 2);
  ctx.fillStyle = C.gasDark;
  ctx.fillRect(x - 4, y + 1, 5, 5);
  ctx.fillRect(x - 8, y - 1 + dx, 5, 5);
  ctx.fillRect(x - 11, y - 4 + dx * 2, 4, 5);
  ctx.fillStyle = C.greenDark;
  ctx.fillRect(x - 4, y + 3, 5, 1);
  ctx.fillRect(x - 8, y + 1 + dx, 5, 1);
  ctx.fillRect(x - 11, y - 2 + dx * 2, 4, 1);
  // Brass, and only at the tip: a hose that is brass all along is a pipe.
  ctx.fillStyle = C.cork;
  ctx.fillRect(x - 11, y - 3 + dx * 2, 2, 3);
  ctx.fillStyle = C.corkDark;
  ctx.fillRect(x - 11, y - 2 + dx * 2, 1, 1);
}

/**
 * KAKSI VENTTIILIÄ PÄÄN PÄÄLLÄ, ja ne ovat se toinen puoli siitä mitä
 * kaasulehti tekee hänelle.
 *
 * Tässä oli ensin pesukarhun korvat, sitten kaksi lehteä. Lehdet olivat jo
 * korjaus — korvat ovat lainaa siitä yhdestä puvusta jota tämä genre ei
 * omista — mutta ne olivat korjaus **muotoon eivätkä asiaan**: ne istuivat
 * korvien paikalla, korvien kokoisina, ja pari pystyä töpöttiä pään päällä
 * lukee korviksi maalattiin ne miksi tahansa. Omistaja luki ne niin, ja se on
 * ainoa mittari joka tässä pätee.
 *
 * Nyt siinä on kaksi messinkistä venttiiliä: sama laite kuin vyön paineventtiili
 * ja letkun suutin, eli tämän pelin oma metalli. Se on myös se selitys jota
 * puku kaipasi — hän ei muutu eläimeksi vaan **paineastiaksi**, ja lentäminen
 * on sitä että hän päästää painetta ulos hallitusti.
 *
 * Kolme ratkaisua, joista kaksi on rajoitteita eikä makua:
 *
 *   1. **Samat kaksi 2x3-palikkaa, samoissa pikseleissä.** Ne koskettavat pään
 *      yläreunaa täsmälleen kuten ennen, ja se vierekkäisyys on se mikä pitää
 *      hahmon yhtenä kappaleena (`verify.mjs`, `comps`). Vaihtui väri ja
 *      sisärakenne, ei silhuetti.
 *   2. **Vaalea laippa alas, tumma rako ylös.** Rako ylöspäin on se yksi
 *      yksityiskohta joka tekee tolpasta venttiilin: siitä tulee ulos.
 *   3. **Messinki eikä vihreä.** Vihreä on jo kaasun väri tässä pelissä ja
 *      sienitason oma puku; venttiili on laite eikä kaasu.
 */
function ventValves(ctx, x, y, w) {
  ctx.fillStyle = C.corkDark;
  ctx.fillRect(x + 1, y - 2, 2, 3);
  ctx.fillRect(x + w - 3, y - 2, 2, 3);
  ctx.fillStyle = C.cork;
  ctx.fillRect(x + 1, y, 2, 1);
  ctx.fillRect(x + w - 3, y, 2, 1);
  ctx.fillStyle = C.ink;
  ctx.fillRect(x + 1, y - 2, 1, 1);
  ctx.fillRect(x + w - 3, y - 2, 1, 1);
}

/**
 * The marking the power-up left on the wearer, drawn on the coverall: gas
 * rising through the cloth in three bubbles.
 *
 * The idea is inherited from the spots the mushroom used to put on the cap, and
 * it is worth inheriting — a power-up whose markings appear on the person who
 * took it is a thing this game does and nobody owns. What is not inherited is
 * where they went: the old helper put two of its three spots in the same place
 * and the third one a pixel off the side of the cap, which is a blob and not a
 * marking, and it hung off the head at every power level for as long as it
 * existed.
 *
 * Sized from the panel it is given rather than fixed, because the same three
 * bubbles have to land on a 10x4 chest and on a ducking 12x3 one. They are
 * placed off the panel's own corners so that the breath, which lifts the top of
 * the chest by a pixel and leaves the belt where it is, cannot drag them.
 */
function gasMarks(ctx, col, x, y, w, h) {
  ctx.fillStyle = col;
  const s = h >= 4 ? 2 : 1;
  ctx.fillRect(x + 1, y + h - 1 - s, s, s);
  ctx.fillRect(x + (w >> 1) - 1, y, s, s);
  ctx.fillRect(x + w - 2 - s, y + h - 1 - s, s, s);
}

/**
 * The head: a skull with hair on it, at whichever size the pose needs. `x` and
 * `w` are the head's own left edge and width — not the body's, because that is
 * the difference this whole change is about.
 *
 * **A brim is what a cap has and a head does not.** The drawing this replaces
 * was a crown and a brim, and the brim was as wide as the entire character: 12
 * pixels across a 14 pixel body, 10 across a 12 pixel one. That silhouette is
 * the borrowed one, and it is borrowed whatever colour it is painted, which is
 * why `tools/verify.mjs` now measures the head's *width* against the hitbox and
 * not its colour. The head here is the skull and never more: 9 wide on the big
 * body, 7 on the small one, where the profile is genuinely narrower than the
 * three-quarter view of the same head seen from behind on a vine.
 *
 * One function rather than the four copies the cap was drawn in, because four
 * copies is how a hat gets left behind in one pose after being taken off in the
 * other three. `back` is the climb: from behind there is no face, so the hair
 * runs a row further down and the skin under it is the nape.
 *
 * The head always ends on the row the shoulders begin, at every size and with
 * the nod applied — a head that stops a pixel short comes away from the body
 * the moment the sprite is flood-filled, which is the check that owns this.
 */
function head(ctx, x, y, pal, w, hair, skin, back) {
  ctx.fillStyle = pal.hair;
  ctx.fillRect(x + 1, y, w - 2, 1);          // the crown, a pixel in on each side
  ctx.fillRect(x, y + 1, w, hair - 1);
  ctx.fillStyle = C.skin;
  ctx.fillRect(x, y + hair, w, skin);
  ctx.fillStyle = pal.hair;
  // Down the back of the head, and — facing forward — over the brow.
  ctx.fillRect(x, y + hair, 2, back ? skin - 2 : Math.min(4, skin - 1));
  if (!back) ctx.fillRect(x + w - 3, y + hair, 3, 1);
}

/**
 * Which second-tier idle is running and how far into it we are, or null.
 *
 * One function rather than a flag on the pose, because two different layers ask
 * the same question: the body, which draws the icicles and the flame, and
 * `drawPlayer`, which draws the ZZZ beside the body rather than on it.
 *
 * **The ZZZ is a symbol, and that was a decision.** The icicle breath and the
 * burning hair are the room acting on the character — cold and heat doing what
 * cold and heat do — so they are diegetic in the sense DESIGN.md §8 gives, they
 * are drawn by the body and they grow with it. A ZZZ is not in the room; it is
 * a comic-book convention, and this game had not used one.
 *
 * It is in anyway, and the reason is that the convention is not actually new
 * here: `LevelScene.addScorePop` already floats words and numbers over the
 * world, attached to whoever earned them — 'UMMETUS' pops out of the player's
 * own head. The ZZZ joins that layer rather than starting one. The boundary
 * that comes with it, so the next person knows where it stops: a symbol may
 * hang off the player at rest, it may never carry information the player needs
 * to act on, and it never goes on an enemy — a '!' over a guard's head is a
 * game telling you what it should have shown you.
 *
 * Which is also why it is drawn where it is drawn: not by `drawPlayerBase`,
 * because it is not part of the body, and at a fixed size, because a thought
 * does not get bigger when the thinker eats a mushroom.
 */
function deepIdle(s) {
  const idle = s.idle || 0;
  if (idle < DEEP_IDLE || s.state !== 'idle' || s.ducking) return null;
  const kind = s.theme === 'ice' ? 'frost'
    : s.theme === 'desert' || s.theme === 'factory' ? 'fire' : 'sleep';
  return { kind, d: idle - DEEP_IDLE };
}

/**
 * The second-tier performance itself. Three of them, one per theme, all pure
 * functions of how long the player has been standing there — so a save state
 * restores the same frame of the same gag, and letting go of the pad twice in
 * the same place does not produce two different animations.
 */
function deepPose(pose, deep) {
  const d = deep.d;

  if (deep.kind === 'sleep') {
    /* Falling asleep is a droop and a jerk, not a nod: the head sinks over four
     * seconds and comes back up in one frame, which is the shape of the joke.
     * The eyes are shut for the sinking and open for the fright. */
    const k = d % 120;
    pose.nod = k < 105 ? Math.min(3, Math.floor(k / 26)) : 0;
    pose.blink = k < 105;
    // A slower, deeper breath than the standing one — he is asleep.
    pose.breath = Math.sin(d / 40) > 0.2 ? -1 : 0;
    return;
  }

  if (deep.kind === 'frost') {
    /* Draw the air in, then breathe out three icicles one after another. Each
     * one is its own age in frames, so they leave the mouth in single file and
     * fall away instead of appearing as a block. */
    const k = d % 150;
    pose.breath = k < 40 ? -1 : 0;
    const out = [];
    for (let i = 0; i < 3; i++) {
      const t = k - (40 + i * 8);
      if (t >= 0 && t < 24) out.push(t);
    }
    pose.puffs = out;
    return;
  }

  /* Fire. Catches first — a beat where nothing else happens, so the player sees
   * it before the character does — then the panic, then it is out, and there is
   * a rest before it can possibly happen again. It does not hurt him, it does
   * not touch the hitbox, and it never blocks input. */
  const k = d % 200;
  const flail = Math.floor(k / 6) % 2 ? 1 : 2;
  if (k < 24) pose.burn = 1 + (k > 11 ? 1 : 0);
  else if (k < 120) { pose.burn = 3 + (Math.floor(k / 4) % 2); pose.panic = flail; }
  else if (k < 150) { pose.burn = Math.max(1, 4 - Math.floor((k - 120) / 8)); pose.panic = flail; }
  else if (k < 168) { pose.smoke = true; pose.blink = true; }
  /* The arms alone were not panic — from any distance they read as a stretch.
   * The body goes with them, one pixel either way on the same beat, which is
   * the shiver's trick borrowed for the opposite temperature. */
  if (pose.panic) pose.shiver = pose.panic === 1 ? 1 : -1;
}

/**
 * What the player is doing while doing nothing. A standing sprite that does not
 * move reads as a paused game, so there is always at least a breath, and after
 * a few seconds of genuine idleness the character starts amusing itself.
 *
 * Everything here is a pure function of tick and idle time, so the outline pass
 * replays it identically and a save state restores the same pose.
 */
function idlePose(s) {
  const tick = s.tick || 0;
  const idle = s.idle || 0;
  const still = s.state === 'idle' && !s.ducking;
  const pose = {
    breath: 0, eye: 0, blink: false, scratch: 0, tap: 0, look: 0, shiver: 0, sweat: -1,
    nod: 0, burn: 0, smoke: false, panic: 0, puffs: null,
  };
  if (!still) return pose;

  /*
   * Breathing: the torso rises and settles about once every one and a half
   * seconds. One pixel is plenty at this size.
   *
   * `breath` lifts the *shoulders* and stretches the shirt down to the belt,
   * and it moves nothing else. It used to be added to the head and the shirt
   * together, which broke the character twice over: the cap left the top of the
   * hitbox for a third of every breath, and since the trousers stayed put, a
   * one pixel gap opened at the waist and the whole lower half came away as a
   * separate piece at every power level above 0. A chest that expands is what
   * the animation was always described as; a body that separates is not.
   */
  pose.breath = Math.sin(tick / 26) > 0.55 ? -1 : 0;
  // A blink every couple of seconds, three frames long.
  pose.blink = tick % 150 < 4;

  /* Twenty seconds in, the ordinary beats hand over to the big one. They stop
   * rather than layer: a man scratching his neck while his hair burns is two
   * animations arguing, and the shiver would drag the icicles sideways with
   * the body it displaces. */
  const deep = deepIdle(s);
  if (deep) {
    deepPose(pose, deep);
    return pose;
  }

  if (idle < 200) return pose;

  // After a few seconds standing around: look up, look down, scratch, repeat.
  const beat = Math.floor((idle - 200) / 90) % 4;
  const phase = (idle - 200) % 90;
  if (beat === 0 && phase > 20 && phase < 70) pose.look = -1;        // up
  else if (beat === 2 && phase > 20 && phase < 60) pose.look = 1;    // down
  else if (beat === 1 && phase > 15 && phase < 65) {
    pose.scratch = Math.floor(phase / 5) % 2 ? 1 : 2;                // behind, twice a second
  } else if (beat === 3 && phase > 20 && phase < 70) {
    pose.tap = Math.floor(phase / 7) % 2;                            // foot tapping
  }
  pose.eye = pose.look;

  /*
   * Standing about is where a character says what kind of place this is. The
   * ice world makes him shiver and the desert makes him mop his brow, which is
   * the cheapest scenery in the game: it costs a couple of pixels and it tells
   * you the temperature without a word.
   *
   * Layered on top of the ordinary idle beats rather than replacing them, so
   * the character keeps his own habits and only picks up the weather.
   */
  if (s.theme === 'ice') {
    // Shivering comes in bursts. A constant tremble reads as a broken sprite.
    const shake = (idle - 200) % 150;
    if (shake < 46) pose.shiver = Math.floor(tick / 2) % 2 ? 1 : -1;
  } else if (s.theme === 'desert' || s.theme === 'factory') {
    // A bead of sweat, then a wipe. `sweat` is how far down the bead has got,
    // -1 for none; the arm goes up during the wipe, which is `pose.scratch`.
    /* 360 rather than 300: the ordinary idle beats also cycle on 360, so a
     * different period made the wipe drift onto the frames that already
     * scratch, where it added nothing anyone could see. Locked to the same
     * clock, the wipe lands on the "look down" beat and reads as its own move. */
    const beat2 = (idle - 200) % 360;
    if (beat2 > 30 && beat2 < 200) pose.sweat = Math.min(7, Math.floor((beat2 - 30) / 22));
    else if (beat2 >= 200 && beat2 < 250) {
      pose.scratch = 2;
      pose.look = 0;
      pose.eye = 0;
    }
  }
  return pose;
}

/**
 * A bead running down the temple.
 *
 * Drawn with a dark rim rather than as a pale dot: measured against the plain
 * sprite, the first version changed four pixels, which at this size is not an
 * animation, it is a rounding error. The rim is what makes it read against skin.
 */
function sweatBead(ctx, x, y) {
  ctx.fillStyle = '#2a4a6a';
  ctx.fillRect(x - 1, y - 1, 4, 6);
  ctx.fillStyle = '#7fc8f0';
  ctx.fillRect(x, y, 2, 4);
  ctx.fillStyle = '#e8f8ff';
  ctx.fillRect(x, y, 1, 2);
}

/**
 * Both arms lifted, each to its own height, drawn as one band from the hand
 * down to the shoulder so the arm is attached to the body it belongs to.
 *
 * Shared by the climb and by the panic over the burning hair, because they are
 * the same drawing problem: the arms leave the sides of the shirt and must not
 * leave the columns the hanging arms already occupy — those columns are the one
 * pixel of overhang the hitbox has always allowed on each side, and widening
 * them would mean moving PLAYER_SIZES, which moves every collision in the game.
 */
function armsUp(ctx, px, py, backTop, frontTop, pal, small) {
  const shoulder = small ? py + 12 : py + 18;
  const w = small ? 2 : 3;
  const bx = small ? px : px - 1;
  const fx = small ? px + 10 : px + 12;
  ctx.fillStyle = C.skin;
  ctx.fillRect(bx, backTop, w, shoulder - backTop);
  ctx.fillRect(fx, frontTop, w, shoulder - frontTop);
  ctx.fillStyle = C.skinDark;
  // Knuckles, so a raised arm ends in a hand rather than in a stump.
  ctx.fillRect(bx, backTop, w, 1);
  ctx.fillRect(fx, frontTop, w, 1);
  /* …and a shaded inner edge, which is the only thing that keeps the arm from
   * being part of the head. On the 14px body the head is nine of them, so a
   * raised arm stands directly against it with no gap, and drawn flat the two
   * merged into one slab of skin with a hat on: the pose read as a man with no
   * arms rather than a man reaching up. One pixel of shadow separates them at
   * every size, and it is on the arm rather than the head because the arm is
   * the thing in front. */
  if (!small) {
    ctx.fillRect(bx + w - 1, backTop, 1, shoulder - backTop);
    ctx.fillRect(fx, frontTop, 1, shoulder - frontTop);
  }
  ctx.fillStyle = pal.suit;
}

/**
 * Up a vine, seen from behind, gripping the stalk: no face, the nape in shadow,
 * both arms up and the legs climbing opposite them. Two frames, driven by the
 * hand-over-hand counter the engine was already keeping and throwing away.
 *
 * Read from behind rather than from the side because the sprite has exactly one
 * profile and a side view of a climb is a jump pose with the arms moved — which
 * is what it looked like for as long as `state()` said `jump`. Turning him
 * round costs one eye and one shadow and it is unmistakable at every size.
 */
function climbPose(ctx, px, py, pal, s, small) {
  const frame = (s.frame || 0) % 2;
  if (small) {
    head(ctx, px + 2, py, pal, 8, 4, 5, true);
    ctx.fillStyle = C.skinDark;      // the nape, where the face is not
    ctx.fillRect(px + 2, py + 7, 8, 2);
    ctx.fillStyle = pal.suit;
    ctx.fillRect(px + 2, py + 9, 8, 3);
    if (pal.mark) gasMarks(ctx, pal.mark, px + 2, py + 9, 8, 3);
    armsUp(ctx, px, py, frame ? py + 4 : py + 7, frame ? py + 7 : py + 4, pal, true);
    ctx.fillStyle = pal.legs;
    ctx.fillRect(px + 3, py + 11, 6, 3);
    ctx.fillStyle = pal.shade;
    ctx.fillRect(px + 3, py + 11, 6, 1);
    ctx.fillStyle = C.ink;
    ctx.fillRect(px + 2, frame ? py + 12 : py + 14, 4, 2);
    ctx.fillRect(px + 6, frame ? py + 14 : py + 12, 4, 2);
    return;
  }
  head(ctx, px + 3, py, pal, 9, 6, 7, true);
  ctx.fillStyle = C.skinDark;
  ctx.fillRect(px + 3, py + 11, 9, 2);
  ctx.fillStyle = pal.suit;
  ctx.fillRect(px + 2, py + 13, 10, 5);
  if (pal.mark) gasMarks(ctx, pal.mark, px + 2, py + 13, 10, 4);
  ctx.fillStyle = pal.shade;
  ctx.fillRect(px + 2, py + 17, 10, 1);
  armsUp(ctx, px, py, frame ? py + 6 : py + 11, frame ? py + 11 : py + 6, pal, false);
  ctx.fillStyle = pal.legs;
  ctx.fillRect(px + 2, py + 18, 10, 4);
  ctx.fillStyle = pal.shade;
  ctx.fillRect(px + 2, py + 18, 10, 1);
  // Opposite the arms: the leg on the side of the low hand is the one drawn up.
  const backLift = frame ? 3 : 0;
  const frontLift = frame ? 0 : 3;
  ctx.fillStyle = pal.legs;
  ctx.fillRect(px + 3, py + 22 - backLift, 3, 2);
  ctx.fillRect(px + 8, py + 22 - frontLift, 3, 2);
  ctx.fillStyle = C.ink;
  ctx.fillRect(px + 2, py + 24 - backLift, 4, 2);
  ctx.fillRect(px + 8, py + 24 - frontLift, 4, 2);
}

/**
 * Frames of the landing lag left when the body starts getting up again, and how
 * far it comes up. The number is the drawing's own and not the move's: the lag
 * is 16 to 36 frames (`entities/player.js`) and it is not this file's business
 * how long it is — only that the last few of them look like standing up rather
 * than like the crouch ending on a cut.
 */
const POUND_RISE_AT = 7;
const POUND_RISE = 2;

/**
 * MAAHANISKU — the tuck. One drawing for all three phases of the dive, and the
 * argument for that is the move itself.
 *
 * The ground pound already charged for the frames it takes (`POUND_CHARGE`
 * hanging still, then the drop, then `POUND_LAG_*` stuck on the floor), and
 * until this pose existed the player paid all of it while looking exactly as he
 * looks in an ordinary jump: `state()` says `jump` in the air and `idle` on the
 * ground, so the wind-up looked like hanging, the dive looked like falling and
 * the lag looked like standing there for no reason. **The one thing the whole
 * move is built around — that it costs you time you are not driving — was the
 * one thing the picture did not say.**
 *
 * So the body balls up, and it stays balled up until the move lets go:
 *
 *   - **charge**: tucked in the air, and this is the telegraph. It is the only
 *     moment anything on screen has to read the move and get out from under it,
 *     which is exactly what those twelve frames were bought for.
 *   - **dive**: the same tuck, moving. He is a cannonball and not a man falling
 *     — the gas he rides down on is already drawn by the scene.
 *   - **lag**: the same tuck, arrived, and for the last `POUND_RISE_AT` frames
 *     of it he begins to come up. That rise is the whole animation: it says the
 *     controls are about to come back before they do.
 *
 * **The hitbox does not move.** `drawPlayer` picks the box from `PLAYER_SIZES`
 * as always, because `ducking` is the flag that resizes a body and this pose
 * deliberately does not set it — a dive that shrank the box would change what a
 * dive collides with, and every measured thing about the move (verify.mjs's
 * maahanisku block) is measured on the box it has always had. What changes is
 * only where the art sits inside that box: at the bottom of it, with air over
 * his head, which is what a crouch looks like.
 *
 * On the big body this is the ducking drawing, moved down to stand on the floor
 * line of the taller box. Not a coincidence and not laziness: a crouch is a
 * crouch, and two drawings of it would be two ways for the same posture to
 * drift apart. The small body has never had a ducking pose — `wantDuck` is
 * gated on `big` — so its crouch is drawn here, at the same proportions.
 */
function poundPose(ctx, px, py, pal, s, small) {
  const rise = s.pound === 'lag' && (s.poundT || 0) <= POUND_RISE_AT ? POUND_RISE : 0;

  if (small) {
    const hy = py + 4 - rise;
    if (s.type === 'leaf') gasHose(ctx, px + 3, hy + 6, s.wag || 0);
    head(ctx, px + 3, hy, pal, 7, 3, 4, false);
    ctx.fillStyle = C.ink;
    ctx.fillRect(px + 8, hy + 4, 1, 2);
    ctx.fillStyle = pal.suit;
    ctx.fillRect(px + 1, hy + 7, 10, 3);
    if (pal.mark) gasMarks(ctx, pal.mark, px + 1, hy + 7, 10, 3);
    ctx.fillStyle = pal.legs;
    ctx.fillRect(px + 2, hy + 10, 8, 2);
    ctx.fillStyle = pal.shade;
    ctx.fillRect(px + 2, hy + 10, 8, 1);
    if (s.type === 'leaf') ventValves(ctx, px + 1, hy, 10);
    return;
  }

  const hy = py + 10 - rise;
  if (s.type === 'leaf') gasHose(ctx, px + 3, hy + 7, s.wag || 0);
  head(ctx, px + 3, hy + 1, pal, 8, 3, 6, false);
  ctx.fillStyle = C.ink;
  ctx.fillRect(px + 8, hy + 6, 1, 2);
  ctx.fillStyle = pal.suit;
  ctx.fillRect(px + 1, hy + 10, 12, 3);
  if (pal.mark) gasMarks(ctx, pal.mark, px + 1, hy + 10, 12, 3);
  ctx.fillStyle = pal.legs;
  ctx.fillRect(px + 2, hy + 13, 10, 3);
  ctx.fillStyle = pal.shade;
  ctx.fillRect(px + 2, hy + 13, 10, 1);
  if (s.type === 'leaf') ventValves(ctx, px + 1, hy + 1, 12);
}

/**
 * Hair on fire. Gold core, red edge, and it grows and shrinks from the bottom
 * up, so `burn` is simply how many of the four rows are alight. It sits on the
 * head and touches it — a flame floating a pixel clear of the head is a separate
 * object, and the check that says the player is one piece would be right.
 *
 * This function has been called `hairFire` since the day it was written, and
 * until the cap came off it was setting fire to a hat. The drawing is unchanged;
 * it is the head under it that finally matches the name.
 */
function hairFire(ctx, c, y, burn) {
  /* [row, edge spans, gold span] — four rows tapering to a point. */
  const edge = ['#e04c3c'];
  for (let i = 0; i < Math.min(4, burn); i++) {
    const ry = y - 1 - i;
    ctx.fillStyle = edge[0];
    if (i === 0) { ctx.fillRect(c - 3, ry, 1, 1); ctx.fillRect(c + 3, ry, 1, 1); }
    if (i === 1) { ctx.fillRect(c - 2, ry, 1, 1); ctx.fillRect(c + 2, ry, 1, 1); }
    if (i === 2) ctx.fillRect(c - 1, ry, 3, 1);
    if (i === 3) ctx.fillRect(c, ry, 1, 1);
    ctx.fillStyle = C.gold;
    if (i === 0) ctx.fillRect(c - 2, ry, 5, 1);
    if (i === 1) ctx.fillRect(c - 1, ry, 3, 1);
  }
}

/** What is left of it: two puffs, still touching the head they came off. */
function hairSmoke(ctx, c, y) {
  ctx.fillStyle = '#c8c8d0';
  ctx.fillRect(c - 2, y - 2, 3, 2);
  ctx.fillRect(c, y - 4, 3, 2);
}

/**
 * One icicle of frozen breath. Same three blues as the sweat bead, and for the
 * same reason: a pale dot on its own is a rounding error at this size, and the
 * dark rim is what makes it read against the sky as well as against the face.
 */
function icicle(ctx, x, y) {
  ctx.fillStyle = '#2a4a6a';
  ctx.fillRect(x, y, 3, 4);
  ctx.fillRect(x + 1, y + 4, 1, 1);
  ctx.fillStyle = '#7fc8f0';
  ctx.fillRect(x, y, 2, 3);
  ctx.fillStyle = '#e8f8ff';
  ctx.fillRect(x, y, 1, 1);
}

/** Draws the player at template scale. `s.type` picks the row of POWER_LOOKS. */
function drawPlayerBase(ctx, x, y, s, small) {
  const pal = POWER_LOOKS[s.type || 'none'] || POWER_LOOKS.none;
  const ducking = s.ducking && !small;
  const w = small ? 12 : 14;
  const pose = idlePose(s);

  flip(ctx, x, w, s.facing < 0, (bx) => {
    // The shiver moves the whole body, so it is applied to the origin rather
    // than to each part — a character whose head trembles out of step with his
    // shoulders looks broken, not cold.
    const px = Math.round(bx) + pose.shiver;
    const py = Math.round(y);

    /* Ahead of everything, including the hose, because the tuck draws its own:
     * a hose left at the standing shoulder would hang in the air a body-length
     * above the man it comes out of. Same shape of early return as the dive
     * itself has in `Player.update`, and for the same reason — while it runs,
     * nothing else about the body is happening. */
    if (s.pound) {
      poundPose(ctx, px, py, pal, s, small);
      return;
    }

    if (s.type === 'leaf') {
      gasHose(ctx, px + (ducking ? 3 : 2), py + (small ? 7 : ducking ? 7 : 17), s.wag || 0);
    }

    if (small) {
      if (s.state === 'climb') {
        climbPose(ctx, px, py, pal, s, true);
        if (s.type === 'leaf') ventValves(ctx, px, py, 12);
        return;
      }
      const b = pose.breath;
      // Nodding off drops the head into the shoulders; nothing else moves.
      const hy = py + Math.min(2, pose.nod);
      head(ctx, px + 3, hy, pal, 7, 3, 6, false);
      ctx.fillStyle = C.skinDark;
      ctx.fillRect(px + 3, hy + 7, 3, 2);
      ctx.fillStyle = C.ink;
      if (pose.blink) ctx.fillRect(px + 7, hy + 6, 2, 1);
      else ctx.fillRect(px + 7, hy + 5 + pose.eye, 1, 2);
      if (pose.puffs) ctx.fillRect(px + 9, hy + 7, 2, 1);   // the mouth it comes out of
      ctx.fillStyle = pal.suit;
      ctx.fillRect(px + 2, py + 9 + b, 8, 3 - b);
      if (pal.mark) gasMarks(ctx, pal.mark, px + 2, py + 9, 8, 3);
      if (pose.panic) {
        armsUp(ctx, px, py, pose.panic === 1 ? py + 4 : py + 7,
          pose.panic === 1 ? py + 7 : py + 4, pal, true);
      } else {
        ctx.fillStyle = C.skin;
        ctx.fillRect(px, py + 9 + b, 2, 3 - b);
        ctx.fillRect(px + 10 - pose.scratch, py + 9 + b + pose.scratch, 2, 3 - b);
      }
      ctx.fillStyle = pal.legs;
      ctx.fillRect(px + 3, py + 11, 6, 3);
      ctx.fillStyle = pal.shade;
      ctx.fillRect(px + 3, py + 11, 6, 1);
      /* The leaves belong to the head, so they nod with it. A pixel further in
       * than the raccoon ears were: this head is the narrower profile one and
       * they have to touch it, or the flood fill counts three characters. */
      if (s.type === 'leaf') ventValves(ctx, px + 1, hy, 10);
      if (pose.sweat >= 0) sweatBead(ctx, px + 11, hy + 2 + pose.sweat);
      if (pose.burn) hairFire(ctx, px + 6, hy, pose.burn);
      if (pose.smoke) hairSmoke(ctx, px + 6, hy);
      for (const t of pose.puffs || []) {
        icicle(ctx, px + 10 + Math.floor(t / 2), hy + 6 + Math.floor(t / 6));
      }
      if (s.state === 'jump') {
        ctx.fillStyle = pal.legs;
        ctx.fillRect(px + 2, py + 14, 4, 2);
        ctx.fillRect(px + 7, py + 13, 4, 3);
      } else if (s.state === 'walk') {
        // 16 - 5: the sole lands on the last row of the box. At py+14 the whole
        // small body was 19px tall in a 16px box, so he walked and stood with
        // his boots three pixels down in the floor at every power level 0 —
        // idle as well as walking, since standing borrows the same cycle.
        if (s.spinLegs) spinLegs(ctx, px, py + 11, 12, pal, s.tick || 0);
        else legs(ctx, px, py + 11, 12, pal, WALK_ORDER[s.frame % WALK_FRAMES], s.running);
      } else {
        /* Standing still uses the walk cycle's closed-legs frame rather than a
         * pose of its own. The pose of its own was two 2x2 stubs of trouser
         * colour with no boots, against a walk cycle that is five pixels tall
         * and ends in a dark sole — so the legs appeared to vanish the moment
         * you stopped, on the small size where two pixels is the whole leg. */
        legs(ctx, px, py + 11, 12, pal, 1, false);
      }
      return;
    }

    if (ducking) {
      head(ctx, px + 3, py + 1, pal, 8, 3, 6, false);
      ctx.fillStyle = C.ink;
      ctx.fillRect(px + 8, py + 6, 1, 2);
      ctx.fillStyle = pal.suit;
      ctx.fillRect(px + 1, py + 10, 12, 3);
      if (pal.mark) gasMarks(ctx, pal.mark, px + 1, py + 10, 12, 3);
      ctx.fillStyle = pal.legs;
      ctx.fillRect(px + 2, py + 13, 10, 3);
      ctx.fillStyle = pal.shade;
      ctx.fillRect(px + 2, py + 13, 10, 1);
      if (s.type === 'leaf') ventValves(ctx, px + 1, py + 1, 12);
      return;
    }

    if (s.state === 'climb') {
      climbPose(ctx, px, py, pal, s, false);
      if (s.type === 'leaf') ventValves(ctx, px + 1, py, 12);
      return;
    }

    const b = pose.breath;
    const hy = py + pose.nod;
    head(ctx, px + 3, hy, pal, 9, 5, 8, false);
    ctx.fillStyle = C.skinDark;
    ctx.fillRect(px + 3, hy + 11, 4, 2);
    ctx.fillStyle = C.ink;
    if (pose.blink) ctx.fillRect(px + 8, hy + 9, 3, 1);
    else ctx.fillRect(px + 8, hy + 7 + pose.eye, 2, 3);
    if (pose.puffs) ctx.fillRect(px + 10, hy + 11, 2, 1);   // the mouth it comes out of
    ctx.fillStyle = pal.suit;
    ctx.fillRect(px + 2, py + 13 + b, 10, 5 - b);
    if (pal.mark) gasMarks(ctx, pal.mark, px + 2, py + 13, 10, 4);
    ctx.fillStyle = pal.shade;
    ctx.fillRect(px + 2, py + 17, 10, 1);
    if (pose.panic) {
      armsUp(ctx, px, py, pose.panic === 1 ? py + 6 : py + 11,
        pose.panic === 1 ? py + 11 : py + 6, pal, false);
    } else {
      ctx.fillStyle = C.skin;
      ctx.fillRect(px - 1, py + 13 + b, 3, 5 - b);
      // The front arm reaches round the back during the scratch.
      ctx.fillRect(px + 12 - pose.scratch * 2, py + 13 + b + pose.scratch * 2, 3, 5 - b);
    }
    ctx.fillStyle = pal.legs;
    ctx.fillRect(px + 2, py + 18, 10, 4);
    ctx.fillStyle = pal.shade;
    ctx.fillRect(px + 2, py + 18, 10, 1);
    /* The pressure valve on his belt, and the reason there is one is that the
     * two gold pixels it replaces were a pair of buttons on a bib — the second
     * half of the costume the cap was the first half of. A brass valve with a
     * hole through it is the same two pixels of shine in the same place, doing
     * the work of saying what this man does for a living: he goes down into a
     * world of bowels with something on his belt to let the pressure out. */
    ctx.fillStyle = C.gold;
    ctx.fillRect(px + 6, py + 17, 3, 2);
    ctx.fillStyle = C.ink;
    ctx.fillRect(px + 7, py + 18, 1, 1);
    if (s.type === 'leaf') ventValves(ctx, px + 1, hy, 12);
    if (pose.sweat >= 0) sweatBead(ctx, px + 12, hy + 3 + pose.sweat);
    if (pose.burn) hairFire(ctx, px + 7, hy, pose.burn);
    if (pose.smoke) hairSmoke(ctx, px + 7, hy);
    for (const t of pose.puffs || []) {
      icicle(ctx, px + 13 + Math.floor(t / 2), hy + 10 + Math.floor(t / 6));
    }

    if (s.state === 'jump') {
      ctx.fillStyle = pal.legs;
      ctx.fillRect(px + 2, py + 22, 4, 3);
      ctx.fillRect(px + 8, py + 21, 5, 4);
      ctx.fillStyle = C.ink;
      ctx.fillRect(px + 1, py + 24, 5, 2);
    } else if (s.state === 'walk') {
      // 26 - 5, for the same reason, and it lines the walking sole up with the
      // standing one below — those were a pixel apart, so the feet twitched
      // down every time he started moving.
      if (s.spinLegs) spinLegs(ctx, px, py + 21, 14, pal, s.tick || 0);
      else legs(ctx, px, py + 21, 14, pal, WALK_ORDER[s.frame % WALK_FRAMES], s.running);
    } else {
      ctx.fillStyle = pal.legs;
      ctx.fillRect(px + 3, py + 22, 3, 2);
      ctx.fillRect(px + 8, py + 22 - pose.tap, 3, 2);
      ctx.fillStyle = C.ink;
      ctx.fillRect(px + 2, py + 24, 4, 2);
      ctx.fillRect(px + 8, py + 24 - pose.tap, 4, 2);
    }
  });
}

/* Scratch buffer for the scaled-up power levels. */
const PAD = { x: 14, y: 6 };
const BUF_W = PAD.x + BASE_NORMAL.w + PAD.x;
const BUF_H = PAD.y + BASE_NORMAL.h + PAD.y;
let buffer = null;
let bufferCtx = null;

function scratch() {
  if (!buffer) {
    buffer = document.createElement('canvas');
    buffer.width = BUF_W;
    buffer.height = BUF_H;
    bufferCtx = buffer.getContext('2d');
    bufferCtx.imageSmoothingEnabled = false;
  }
  return bufferCtx;
}

/*
 * A Z, four pixels square: two bars and a real diagonal between them.
 *
 * Three was tried first and three is not enough. At 3x3 the diagonal is the
 * middle pixel, which is also what an I is, and with the outline around it the
 * glyph came out as a white dumbbell that could have been anything. The fourth
 * row is what makes it a letter rather than a blob, and all three are drawn at
 * that one size — the far one used to double, and the frame it doubled on read
 * as a glitch rather than as distance.
 *
 * The diagonal is two pixels wide rather than one because a one-pixel diagonal
 * only touches itself at the corners, and the check that counts how many pieces
 * the drawing is in walks edges, not corners: the letter came apart into a top
 * half and a bottom half. It is the same rule the body obeys and there is no
 * reason a letter should be exempt from it.
 */
const Z_ROWS = [[0, 4], [2, 2], [1, 2], [0, 4]];

/**
 * Three Z's leaving a sleeping head, one behind the other, drifting up and
 * forward and doubling in size as they go.
 *
 * Not drawn by `drawPlayerBase`, and that is the point rather than an
 * accident — see `deepIdle`. It is not part of the body, so it does not go
 * through the body's scratch buffer, it does not grow with the power level and
 * it does not take the body's tint: a star can flash the man without recolouring
 * what he is dreaming. It does get the same outline as everything else, because
 * the outline is what makes a thing legible over scenery, and a symbol nobody
 * can read is worse than no symbol.
 *
 * Exactly three, always: they are phase-shifted thirds of one loop, so one pops
 * in at the head on the frame another pops out at the top and the count never
 * changes. A varying count is the sort of thing that looks like a dropped frame.
 */
function sleepZs(ctx, x, y, box, facing, d) {
  const dir = facing < 0 ? -1 : 1;
  const edge = facing < 0 ? x : x + box.w;
  ctx.fillStyle = C.white;
  for (let i = 0; i < 3; i++) {
    const t = ((d + i * 40) % 120) / 120;
    /* Fifteen pixels of climb and six of drift, and the fifteen is not a taste:
     * three Z's a third of a loop apart are five pixels apart on a fifteen
     * pixel run, which is one clear pixel between four-pixel letters. On a
     * shorter run they overlapped into a single ribbon, which is a smudge and
     * not a word. The drift stays small so the trail leans rather than walks. */
    const rise = Math.round(t * 15);
    const out = 2 + Math.round(t * 6);
    const gy = y - 2 - rise - 4;
    const gx = dir > 0 ? edge + out : edge - out - 4;
    for (let r = 0; r < 4; r++) {
      ctx.fillRect(gx + Z_ROWS[r][0], gy + r, Z_ROWS[r][1], 1);
    }
  }
}

/**
 * @param {object} s { type, level, facing, frame, state, ducking, pound, poundT,
 *                     running, wag, tint, glow }
 */
export function drawPlayer(ctx, x, y, s) {
  const level = Math.max(0, Math.min(5, s.level ?? 0));
  const box = (s.ducking ? PLAYER_DUCK_SIZES : PLAYER_SIZES)[level];
  if (s.glow) {
    // The halo is what carries across a busy screen; the tint alone is easy to
    // lose against bright scenery. Drawn by replaying the sprite, so it is the
    // character that glows and not a blob behind it.
    glowing(ctx, x + box.w / 2, y + box.h / 2, s.glow,
      (g) => drawPlayer(g, x, y, { ...s, glow: null }));
    return;
  }
  if (level === 0) {
    outlined(ctx, (g) => drawPlayerBase(recolored(g, s.tint), x, y, s, true));
  } else if (level === 1) {
    outlined(ctx, (g) => drawPlayerBase(recolored(g, s.tint), x, y, s, false));
  } else {
    const base = s.ducking ? BASE_DUCK : BASE_NORMAL;
    const sx = box.w / base.w;
    const sy = box.h / base.h;

    const b = scratch();
    b.clearRect(0, 0, BUF_W, BUF_H);
    outlined(b, (g) => drawPlayerBase(recolored(g, s.tint), PAD.x, PAD.y, s, false));

    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buffer, 0, 0, BUF_W, BUF_H,
      Math.round(x - PAD.x * sx), Math.round(y - PAD.y * sy),
      Math.round(BUF_W * sx), Math.round(BUF_H * sy));
    ctx.imageSmoothingEnabled = prev;
  }

  const nap = deepIdle(s);
  if (nap && nap.kind === 'sleep') {
    outlined(ctx, (g) => sleepZs(g, x, y, box, s.facing, nap.d));
  }
}

/** The cork stuck in a constipated player. */
export function drawCork(ctx, x, y, tick) {
  const bob = Math.round(Math.sin(tick / 6) * 1);
  ctx.fillStyle = C.corkDark;
  ctx.fillRect(x, y + bob, 8, 7);
  ctx.fillStyle = C.cork;
  ctx.fillRect(x + 1, y + 1 + bob, 6, 5);
  ctx.fillStyle = C.corkDark;
  ctx.fillRect(x + 1, y + 3 + bob, 6, 1);
}
