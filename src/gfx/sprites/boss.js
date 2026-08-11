/**
 * THE SEVEN BOSSES, AND WHY THEY ARE SEVEN DRAWINGS RATHER THAN ONE.
 *
 * This file used to say "they are one file rather than four because they are one
 * drawing with a colour swap". That was true and it was the problem. Measured by
 * looking at all seven side by side: identical square head, identical eye pair,
 * identical mouth, identical white gloves, identical body block — what changed
 * between world 1's boss and world 7's was a hue and one small accessory below
 * the chin. At the distance this game is played from, the accessory is gone and
 * the hue is all that is left, so seven fights looked like one fight recoloured.
 *
 * **Silhouette is the only thing that survives that distance**, so each boss is
 * now built shape-first, and the shape is his move set seen from across the room:
 *
 *   0  NYRKKEILIJÄ    wide, gloves forward        — he boxes
 *   1  JYSKYTTÄJÄ     bottom-heavy, huge feet     — he lands on you
 *   2  SYÖKSYJÄ       a wedge leaning forward     — he charges
 *   3  PÖHÖ           a sphere with tiny limbs    — he inflates
 *   4  LUURANKO       tall and full of gaps       — he comes apart
 *   5  SÄÄHERRA       top-heavy, no feet at all   — he leaves the ground
 *   6  PIERUKUNINGAS  broad shoulders, high collar— he is the one in charge
 *
 * Each also animates differently, because a silhouette that only translates is
 * a sticker: the stomper squashes, the charger's stride opens and closes, the
 * balloon breathes, the skeleton's segments drift apart, the storm's underside
 * churns, the king's cape sways. Told apart with the colour removed is the bar,
 * and `verify.mjs` measures exactly that — see "jokainen pomo on oman
 * muotoinen", which compares their silhouettes as bitmaps.
 *
 * ## What did not change, and may not
 *
 * **The crown is the signal and it is the only one.** Gold and pointed above the
 * head means "do not stomp this" and nothing else in this file may look like
 * that — no horns above the crown line, no spikes, no gold anywhere except the
 * marks of rank below the eyeline. That rule was bought with a playtest (see
 * below) and none of these shapes is worth spending it again.
 *
 * **Every boss has hands**, because the crown is picked up and put on with them.
 * `bossHands` is shared so the carry works identically for all seven, and each
 * only chooses what its hands are made of.
 *
 * The spines come from the enemy file: a boss and a piikkiukko say "do not
 * stomp this" with the same row of points on purpose, and two copies of that
 * drawing would eventually stop matching.
 */

import { C, flip } from './palette.js';
import { drawSpines } from './enemies.js';

/*
 * Why none of them wears a crown, and why one of them puts one on.
 *
 * They used to stand in a gold three-pointed crown all day and grow spines out
 * of the top of it when it was time to stop stomping them. Two rows of points,
 * one decoration and one lethal, and the player had to tell them apart in the
 * frame they were deciding whether to jump. Reported from play: they could not.
 *
 * So the crown stopped being decoration and became the signal. Rank is a medal,
 * a sceptre or a pair of epaulettes — nothing pointed, and nothing above the
 * head at all — and the only thing that is ever on a boss's head is the spiked
 * crown he picks up with his own hands when he is about to become dangerous,
 * and takes off again when he is done. "Is there a crown on it" is now one
 * question with one answer.
 *
 * `t` is the whole put-on/take-off clock, 0..1, and every keyframe hangs off it:
 *
 *   0.00  no crown at all, hands at his sides
 *   0.12  drawn out to full width between the hands
 *   0.50  held up above the head
 *   0.75  lowered onto it, hands still on the rim
 *   0.78  the points start coming through
 *   1.00  hands back down, fully spiky
 *
 * Taking it off is the same numbers run backwards, which is the reason there is
 * one clock and not two animations that would have to be kept agreeing.
 */
/**
 * HOW BIG EACH BOSS ACTUALLY IS, IN PIXELS OF HITBOX.
 *
 * All seven were 30x32 — two tiles — and shape alone could not fix that: seven
 * silhouettes inside one box still read as seven things the same size, which is
 * exactly what came back from looking at them at 1:1. A boss should be a set
 * piece, so the box is now per boss and the drawings are authored to it.
 *
 * **The ceiling is 52 px, and it is measured twice.** A power-0 player's *feet*
 * rise 71 px from a standing jump and 100 px from a running one — measured in
 * the engine, and not the same number as the 85 px of *carry* PHYSICS.md quotes,
 * which is a distance across rather than up. So 52 px leaves 19 px of margin on
 * the worst case, the standing jump.
 *
 * That margin is the point. The first draft put the skeleton at 64 and the king
 * at 60, which are both under 71 and both **failed the gate**: `6-F` and `8-F`
 * could not be stomped at power 0. A head you clear by seven pixels is a head
 * you miss the moment the boss bobs, and every one of these bodies breathes.
 * DESIGN.md §5 promises the fight works at the smallest size with no power-up,
 * and that promise is not kept by arithmetic that only just works.
 *
 * Anything taller needs the arena to hand the player a deck, which is what
 * `boss_arena_big` already does for the one that grows.
 *
 * ## AND NOTHING IS A SLAB
 *
 * The first pass at these sizes ran the widths out to 72 and 76 while leaving
 * the heights at 30 and 44, and the result was reported the way it deserved:
 * elongated. A 2.4:1 body with a face at one end is a bus, not a boss — arcade
 * bosses are *mass*, and mass needs both dimensions.
 *
 * So **1.6:1 is the widest ratio anything gets**, and the height budget is spent
 * rather than saved: the ram went 72x30 to 64x40 and the storm 76x44 to 68x46,
 * both of them narrower and much taller. Bulk beat span, which is the whole
 * lesson of every big-boss sprite worth stealing from.
 *
 * **Which is why PÖHÖ is the small one.** He is the giant, and his `scale`
 * climbs to 3 as he takes hits; his arena's decks are measured against
 * `baseH * 3`. Growing his base would grow that product past the room he fights
 * in. His size is his move set, so it is spent there instead.
 */
export const BOSS_SIZES = [
  { w: 30, h: 32 },   // 0 nyrkkeilijä — world 1 stays the gentle one
  { w: 56, h: 48 },   // 1 jyskyttäjä  — 1.2:1, a brick
  { w: 64, h: 40 },   // 2 syöksyjä    — 1.6:1, the widest ratio anything gets
  { w: 40, h: 40 },   // 3 pöhö        — square, and small because it triples
  { w: 36, h: 52 },   // 4 luuranko    — 1:1.4, the tall one
  { w: 68, h: 46 },   // 5 sääherra    — 1.5:1, the big one
  { w: 50, h: 52 },   // 6 pierukuningas — square and heavy
];
/**
 * Bolts along a plate's edge — the cheapest thing that turns a filled rectangle
 * into something that was *built*. Two pixels each, because one reads as noise
 * and three reads as a window.
 */
function rivets(r, x, y, n, step, color) {
  for (let i = 0; i < n; i++) r(x + i * step, y, 2, 2, color);
}

/**
 * A warning stripe: chevrons across a band. Arcade shorthand for "this is the
 * part that hits you", and it is body-coloured rather than yellow — yellow is
 * the crown's, and a boss wearing hazard tape would be a second gold signal.
 */
function chevrons(r, x, y, w, h, color) {
  for (let i = 0; i < w; i += 6) r(x + i, y, 3, h, color);
}

/**
 * WHAT KIND OF THING EACH BOSS IS, AND WHY THAT IS DATA RATHER THAN AN OPINION.
 *
 * Stripped of colour, six of the seven used to be a hill, a locomotive, an egg,
 * a splat and an archway. The fault was one thing in five of them: **the head
 * was not in the silhouette.** It was drawn inside the body outline and marked
 * with colour, and colour is the first thing lost at the distance this is
 * played from, so at silhouette level they had no head at all. The skeleton was
 * the only readable one and the only one with a neck gap.
 *
 * The obvious fix — "every boss must have a neck" — is wrong, and trying it is
 * how this table happened. A neck would have made the storm lord a man in a
 * cloud suit and given the balloon a chin. But the opposite move, an OR over
 * every clause, passes literally anything.
 *
 * So **each boss declares what it is, and `verify.mjs` checks it delivered
 * that**. A figure owes a pinch at the neck, a wedge owes an outline that never
 * reverses, a quadruped owes a step down in its top contour, a blob owes a
 * curved outline, and an anvil owes mass held low over a wide base — *and still
 * owes the neck*, because nothing gets to skip the head.
 *
 * "This should be a figure" is a design opinion anyone may argue with. "This
 * drawing is not the thing it says it is" is a fact, and facts are what a gate
 * can hold.
 */
export const BOSS_PLANS = [
  'figure',      // 0 nyrkkeilijä
  'anvil',       // 1 jyskyttäjä — bottom-heavy on purpose; he lands on you
  'quadruped',   // 2 syöksyjä   — his neck runs forward, so no row ever pinches
  'blob',        // 3 pöhö       — the round one, and roundness is his identity
  'figure',      // 4 luuranko
  'wedge',       // 5 sääherra   — an anvil cloud, standing on nothing
  'figure',      // 6 pierukuningas
];

/** The box a variant fights in, before its own `scale`. */
export const bossSize = (variant) => BOSS_SIZES[variant] || BOSS_SIZES[0];

const CROWN_SPREAD = 0.12;
const CROWN_TOP = 0.5;
const CROWN_SEAT = 0.75;
const CROWN_SPINES = 0.78;
/** Where the crown is drawn out, and how high it is lifted. Sprite pixels. */
const CROWN_REST_Y = 18;
const CROWN_HIGH_Y = -10;
/** How far under the crown's rim the hands grip, so the band cannot hide them. */
const HAND_GRIP_DY = 2;

const lerp = (a, b, u) => a + (b - a) * u;
const span = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

/** Everything the clock decides, in sprite pixels relative to the hitbox top. */
function crownPose(t) {
  return {
    y: t < CROWN_TOP
      ? lerp(CROWN_REST_Y, CROWN_HIGH_Y, span(t, 0, CROWN_TOP))
      : lerp(CROWN_HIGH_Y, 0, span(t, CROWN_TOP, CROWN_SEAT)),
    width: span(t, 0, CROWN_SPREAD),
    // Let go once it is seated: the last thing the player sees is a boss
    // wearing the thing, not one still holding it up.
    grip: Math.min(span(t, 0, CROWN_SPREAD), 1 - span(t, CROWN_SEAT, 1)),
    spines: span(t, CROWN_SPINES, 1),
  };
}

/**
 * World 1's boss, to the lead designer's specification: a boxer.
 *
 * The gloves are the whole character, so they are drawn biggest, brightest and
 * furthest forward, and they alternate — one guarding the chin, one cocked to
 * throw. Everything else (bare head, mouthguard, taped wrists) exists to make
 * the gloves read as gloves rather than as red blobs. The gloves are also his
 * hands, so they are what carries the crown; the jab stops while he is holding
 * it, which is its own warning.
 */
function drawBoxerBoss(r, bx, py, body, dark, frame, pose) {
  const jab = Math.floor(frame / 6) % 2 === 0;
  const g = pose.grip;
  const carryY = pose.y + HAND_GRIP_DY;

  // stance: knees bent, one foot back
  r(bx + (jab ? 3 : 5), py + 27, 10, 5, body);
  r(bx + (jab ? 18 : 16), py + 27, 10, 5, body);

  r(bx + 4, py + 13, 23, 14, body);         // torso
  r(bx + 11, py + 11, 9, 3, dark);          // neck — see below
  r(bx + 8, py + 0, 15, 11, body);          // head, no crown: he fights for it

  // championship belt, the only gold on him
  const gold = '#f0c040';
  r(bx + 4, py + 20, 23, 4, gold);

  // brows down, eyes narrowed: he is not pleased to see you
  r(bx + 10, py + 3, 5, 4, '#ffffff');
  r(bx + 16, py + 3, 5, 4, '#ffffff');
  r(bx + 12, py + 4, 3, 3, '#101018');
  r(bx + 17, py + 4, 3, 3, '#101018');
  r(bx + 9, py + 1, 6, 2, dark);
  r(bx + 15, py + 1, 6, 2, dark);

  // mouthguard
  r(bx + 12, py + 8, 7, 3, '#e8e0c0');

  /*
   * Hanskat lepäävät **kaulan alapuolella**, ja se on mitta eikä maku.
   *
   * Ne olivat riveillä 10 ja 15, eli ylempi täytti tasan sen kahden pikselin
   * raon jonka takia päätä ylipäänsä näkee: siluettina kurouma oli 1,00 ja
   * portti sanoi suoraan ettei kaulaa ole. Kaksi riviä alemmas ja sama piirros
   * lukee mieheksi. Muotoportti löysi tämän maailman 1 pomosta, joka on ainoa
   * jota ei tässä erässä piirretty uusiksi — eli juuri siitä johon kukaan ei
   * katsonut.
   */
  const leadX = lerp(jab ? 25 : 21, 24, g);
  const leadY = lerp(py + 13, py + carryY, g);
  const rearY = lerp(py + 16, py + carryY, g);

  r(bx + lerp(jab ? 24 : 20, 23, g), leadY + 3, 4, 4, '#e8e0c0');
  r(bx + 2, rearY + 2, 4, 4, '#e8e0c0');

  const glove = '#e03828';
  const gloveDark = '#8c1c10';
  r(bx + leadX, leadY, 7, 8, glove);
  r(bx + leadX, leadY + 6, 7, 2, gloveDark);
  r(bx + leadX + 1, leadY + 1, 3, 2, '#f07868');
  r(bx + 0, rearY, 7, 8, glove);
  r(bx + 0, rearY + 6, 7, 2, gloveDark);
  r(bx + 1, rearY + 1, 3, 2, '#f07868');
}

/**
 * The mark of rank, one per variant. All of them below the eyeline, none of
 * them pointed: anything gold and spiky above the head has exactly one meaning
 * and this is not it.
 *
 * The marks survived the redesign unchanged in *idea* and re-sited in
 * *position*, because they were never the problem — a medal, a sceptre, a pair
 * of epaulettes, a pocket watch, a barometer and an ermine collar are six
 * different claims about who somebody is, and they were simply too small to
 * carry seven identities on their own. Now they are the second thing you read
 * about a boss instead of the only thing.
 */
function bossRank(r, bx, py, variant) {
  const gold = '#f0c040';
  const goldDark = '#8c6410';
  if (variant === 1) {
    /* Mitali nauhassa, ja se roikkuu ikeen alta rintaan eikä ikeen päälle:
     * uusi kaula on 8 px leveä ja vanha nauha olisi peittänyt sen, eli juuri
     * sen kohdan jonka takia päätä ylipäänsä näkee. */
    r(bx + 25, py + 26, 3, 4, '#a01820');
    r(bx + 30, py + 26, 3, 4, '#a01820');
    r(bx + 22, py + 29, 14, 8, goldDark);
    r(bx + 23, py + 30, 12, 6, gold);
    r(bx + 27, py + 32, 4, 3, goldDark);
    return;
  }
  if (variant === 2) {
    /*
     * Satulalaatta kyljessä, eikä enää valtikkaa selässä.
     *
     * Valtikka seisoi pystyssä matalan takapään päällä, ja se on savupiipun
     * paikka ja savupiipun muoto: siluettina koko eläin luki veturina, ja se
     * luki veturina vielä senkin jälkeen kun runko oli piirretty uusiksi.
     * Arvomerkki ei saa olla se yksi pystysuora asia matalimman kohdan päällä.
     */
    r(bx + 6, py + 16, 16, 6, goldDark);
    r(bx + 7, py + 17, 14, 4, gold);
    r(bx + 10, py + 18, 3, 2, goldDark);
    r(bx + 16, py + 18, 3, 2, goldDark);
    return;
  }
  if (variant === 3) {
    // Epaulettes with fringe, on the curve where shoulders would be.
    for (const ex of [0, 33]) {
      r(bx + ex, py + 11, 7, 4, gold);
      r(bx + ex, py + 14, 7, 2, goldDark);
      for (let i = 0; i < 3; i++) r(bx + ex + i * 3, py + 16, 1, 4, gold);
    }
    return;
  }
  if (variant === 4) {
    /*
     * Taskukello ketjussa, ja sen viisarit osoittavat kahtatoista.
     *
     * The skeleton's rank is the hour. *Danse macabre* is midnight — the piece
     * opens with twelve strokes and the level's music opens with them too — so
     * the one thing he wears is the clock that says so. Hung off the ribs to one
     * side, because his middle is spine and his bottom is a gap between bones.
     */
    r(bx + 6, py + 26, 2, 3, goldDark);            // ketju
    r(bx + 4, py + 29, 2, 3, goldDark);
    r(bx + 0, py + 31, 10, 10, goldDark);          // kuori
    r(bx + 1, py + 32, 8, 8, gold);
    r(bx + 4, py + 33, 1, 4, goldDark);            // minuuttiviisari, ylös
    r(bx + 4, py + 35, 3, 1, goldDark);            // tuntiviisari, lyhyt
    return;
  }
  if (variant === 5) {
    /*
     * Ilmapuntari, ja sen neula osoittaa myrskyyn. Sääherran arvomerkki on
     * mittari eikä ase: koko hahmon vitsi on että ilmakehä kuuluu jollekulle,
     * ja omistamisen merkki on se että sen tilan saa lukea. Vasemmalla eikä
     * keskellä, koska keskellä on se yksi silmä — ja **alempana ja pienempänä
     * kuin se silmä**, koska vaalea neliö kultakehyksessä silmän korkeudella on
     * toinen silmä, ja kaksisilmäisyys oli juuri se mikä teki hänestä bussin.
     */
    r(bx + 28, py + 28, 9, 9, goldDark);           // kehys
    r(bx + 29, py + 29, 7, 7, '#e8eef8');          // kellotaulu
    r(bx + 31, py + 31, 3, 1, gold);
    r(bx + 32, py + 32, 2, 2, goldDark);           // akseli
    r(bx + 30, py + 34, 3, 1, goldDark);           // neula alas vasemmalle
    return;
  }
  if (variant === 6) {
    /*
     * Hermeliini, ja se on valkoinen eikä kultaa. Kuningas on ainoa pomo jonka
     * arvo on itse asia eikä sen merkki; kaulus on jo piirretty, tämä on se
     * mikä tekee siitä hermeliiniä eikä valkoista kangasta. Kulta on kruunun.
     */
    r(bx + 3, py + 22, 2, 3, C.ink);
    r(bx + 9, py + 22, 2, 3, C.ink);
    r(bx + 39, py + 22, 2, 3, C.ink);
    r(bx + 45, py + 22, 2, 3, C.ink);
  }
}

/**
 * The hands, and they are shared by all seven on purpose.
 *
 * The crown is picked up and put on with them, so a boss without hands is a
 * boss who cannot perform the one animation the whole warning system rests on.
 * Only the material is a per-boss choice — bone for the skeleton, vapour for the
 * storm — and the geometry is one copy, so the carry reads identically whoever
 * is doing it.
 *
 * Pale rather than body-coloured, always. Their job is to be seen carrying the
 * crown on the frames before it can hurt anybody, and a hand the same colour as
 * the arm it is on disappears at exactly the distance this is read from.
 */
function bossHands(r, bx, py, pose, spec) {
  const hy = py + lerp(spec.restY, pose.y + HAND_GRIP_DY, pose.grip);
  for (const hx of spec.xs) {
    r(bx + hx, hy, 6, 6, spec.light || '#e8e0c0');
    r(bx + hx, hy + 4, 6, 2, spec.dark || '#a89878');
    r(bx + hx + 1, hy + 1, 4, 2, C.white);
  }
}

/**
 * Where each boss's hands rest, and what they are made of.
 *
 * A table rather than six calls, because the *rest* position is the thing that
 * differs and the carry is the thing that must not. `restY` is per boss for a
 * blunt reason found by looking: one shared height put a pale six-pixel block
 * across the charger's face and the king's collar. A hand that covers the face
 * is worse than no hand, and the face is the second thing after silhouette.
 */
const HANDS = {
  1: { xs: [0, 50], restY: 18 },
  2: { xs: [22, 38], restY: 32 },
  3: { xs: [0, 34], restY: 15 },
  4: { xs: [0, 30], restY: 33, light: '#e8e0cc', dark: '#7c7a88' },
  5: { xs: [12, 50], restY: 19, light: '#c8d4f0', dark: '#7a86a8' },
  6: { xs: [3, 41], restY: 32, light: '#d8c8a0', dark: '#8c7850' },
};
/**
 * 2-F, JYSKYTTÄJÄ — 56x48, the one who answers with the floor.
 *
 * Built to the armature: **a small head on a visible neck, a yoke three times
 * the head's width, a narrow torso, and feet wider than anything above them.**
 *
 * The neck is the whole repair. The old drawing sank his head into the
 * shoulders and marked it with colour, and colour is the first thing the eye
 * loses at playing distance — as a mask he was a hill. Four pixels of gap turn
 * the same head into a shape the outline can show.
 *
 * He is the one boss whose mass belongs **low** (`plan: 'anvil'`), because
 * landing on you is his whole character, and the gate measures that claim
 * rather than exempting him from the usual one.
 */
function drawStomperBoss(r, bx, py, body, dark, frame, pose) {
  const t = Math.floor(frame / 8) % 2 === 0 ? 0 : 1;

  // Feet: the widest thing he owns, and the part that arrives.
  /* 24 leveät eivätkä 22, koska `anvil` lupaa jalustan joka on vähintään 0,8
   * leveimmästä kohdasta — ja leveimmäksi kohdaksi osoittautui *kädet*, jotka
   * kurkottavat ikeen ohi. 22 px jalat antoivat 0,79 ja portti oli oikeassa:
   * se jonka koko luonne on laskeutua päällesi ei saa olla kapeampi alhaalta
   * kuin ylhäältä. */
  r(bx + 0, py + 35, 24, 13, dark);
  r(bx + 32, py + 35, 24, 13, dark);
  r(bx + 0, py + 45, 24, 3, C.ink);
  r(bx + 32, py + 45, 24, 3, C.ink);
  chevrons(r, bx + 2, py + 38, 20, 4, C.ink);
  chevrons(r, bx + 34, py + 38, 20, 4, C.ink);

  // Torso, narrow enough that the yoke above and the feet below both overhang.
  r(bx + 13, py + 26 + t, 30, 10, body);
  r(bx + 13, py + 32 + t, 30, 4, dark);

  // The yoke.
  r(bx + 2, py + 16 + t, 52, 10, body);
  r(bx + 2, py + 23 + t, 52, 3, dark);
  rivets(r, bx + 5, py + 18 + t, 8, 6, dark);

  // Neck, then head.
  r(bx + 24, py + 13 + t, 8, 4, dark);
  r(bx + 20, py + 0 + t, 16, 14, body);
  r(bx + 20, py + 1 + t, 16, 4, dark);
  r(bx + 22, py + 5 + t, 5, 6, C.white);
  r(bx + 29, py + 5 + t, 5, 6, C.white);
  r(bx + 23, py + 6 + t, 4, 5, C.ink);
  r(bx + 30, py + 6 + t, 4, 5, C.ink);
  r(bx + 24, py + 11 + t, 8, 2, C.ink);

  bossRank(r, bx, py, 1);
}

/**
 * 3-F, SYÖKSYJÄ — 64x40, the one who charges.
 *
 * `plan: 'quadruped'`, and the plan exists because **row widths cannot see this
 * animal at all.** His neck runs forward rather than upward, so no row anywhere
 * pinches; measured by the figure test he scores nothing, and he is not a
 * figure. What separates a bull from a locomotive lives entirely in the *top
 * contour* — a hump, a step down, then the head — so that is what is measured,
 * and the gate calls it `crest`.
 *
 * Three attempts at this body all failed the same way, and the last two failed
 * after the box had been fixed: **a top edge that runs flat is a vehicle at any
 * ratio.** The head therefore hangs eleven pixels below the hump line, and the
 * sceptre that used to stand up out of his back is gone — a vertical thing
 * above the lowest part of him is a smokestack, whatever it is drawn as.
 */
function drawChargerBoss(r, bx, py, body, dark, frame, pose) {
  const open = Math.floor(frame / 5) % 2 === 0;
  const step = open ? 1 : 0;

  r(bx + 6 + step, py + 30, 14, 10, dark);
  r(bx + 44 - step, py + 30, 16, 10, dark);
  r(bx + 6 + step, py + 36, 14, 4, C.ink);
  r(bx + 44 - step, py + 36, 16, 4, C.ink);

  // Rump low at the back, hump high over the shoulders.
  r(bx + 4, py + 13, 20, 17, body);
  r(bx + 20, py + 2, 26, 28, body);
  r(bx + 20, py + 2, 26, 3, dark);
  r(bx + 4, py + 26, 42, 4, dark);
  rivets(r, bx + 24, py + 8, 4, 6, dark);

  // Head, forward and low. The step between hump and head is the crest.
  r(bx + 40, py + 13, 6, 9, dark);               // the joint back to the hump
  r(bx + 44, py + 13, 20, 21, body);
  r(bx + 44, py + 28, 20, 6, dark);
  r(bx + 46, py + 16, 7, 7, C.white);
  r(bx + 55, py + 16, 7, 7, C.white);
  r(bx + 49, py + 18, 4, 5, C.ink);
  r(bx + 58, py + 18, 4, 5, C.ink);
  for (let i = 0; i < 3; i++) r(bx + 48 + i * 5, py + 28, 3, 4, C.white);

  bossRank(r, bx, py, 2);
}

/**
 * 4-F and 5-F, PÖHÖ — 40x40, the one who inflates.
 *
 * `plan: 'blob'`, and what a blob owes is **roundness**, measured as the number
 * of distinct widths in its outline. A box changes width twice. The first
 * version of him was two big rectangles and scored four, which is to say he was
 * an egg-shaped box; six bands take him to eight and the outline curves.
 *
 * Small on purpose: `scale` takes him to three times this, and his arena's
 * decks are measured against `baseH * 3`.
 */
function drawBalloonBoss(r, bx, py, body, dark, frame, pose) {
  const p = Math.floor(frame / 10) % 2 === 0 ? 0 : 1;

  r(bx + 8, py + 33, 9, 7, dark);
  r(bx + 23, py + 33, 9, 7, dark);

  r(bx + 12, py + 1, 16, 4, body);
  r(bx + 7 - p, py + 5, 26 + p * 2, 4, body);
  r(bx + 3 - p, py + 9, 34 + p * 2, 6, body);
  r(bx + 2 - p, py + 15, 36 + p * 2, 8, body);
  r(bx + 4 - p, py + 23, 32 + p * 2, 6, body);
  r(bx + 9, py + 29, 22, 4, body);
  r(bx + 4 - p, py + 25, 32 + p * 2, 4, dark);
  rivets(r, bx + 7, py + 11, 5, 6, dark);
  rivets(r, bx + 7, py + 20, 5, 6, dark);

  r(bx + 0, py + 14, 6, 8, dark);                // arms too small for him
  r(bx + 34, py + 14, 6, 8, dark);

  r(bx + 11, py + 10, 7, 7, C.white);
  r(bx + 22, py + 10, 7, 7, C.white);
  r(bx + 13, py + 11, 5, 5, C.ink);
  r(bx + 22, py + 11, 5, 5, C.ink);
  r(bx + 11, py + 7, 7, 3, dark);
  r(bx + 22, py + 7, 7, 3, dark);
  r(bx + 16, py + 20, 8, 3, C.ink);

  bossRank(r, bx, py, 3);
}

/**
 * 6-F, LUURANKO — 36x52, the one who comes apart.
 *
 * The gaps are the character: every other boss is a solid mass, this one is
 * separated pieces with the room showing between them.
 *
 * What that cost him was bulk, and the first draft spent the extra height on
 * *length* — long thin femurs, thin ribs — which is how you draw a skeleton and
 * not how you draw a heavy. So the proportion is inverted now: **a skull nearly
 * as wide as he is, on femurs six pixels tall.** Big head, short thick legs is
 * what every arcade heavy is built from, and bone is the one material that can
 * carry a head that size without looking wrong.
 *
 * The ribs taper 34→24 down to the hips, so the cage is a barrel rather than a
 * ladder, and the shoulder blades stick out past it on both sides.
 */
function drawSkeletonBoss(r, bx, py, body, dark, frame, pose) {
  const rattle = Math.floor(frame / 5) % 2 === 0 ? 1 : 0;
  const skullY = py - rattle;
  const ribY = py + 24 + rattle;

  r(bx + 4, skullY, 28, 16, body);               // cranium
  r(bx + 2, skullY + 4, 32, 10, body);           // cheekbones, out past it
  r(bx + 7, skullY + 15, 22, 7, body);           // jaw, heavy
  r(bx + 6, skullY + 4, 9, 9, C.ink);            // sockets, deep
  r(bx + 20, skullY + 4, 9, 9, C.ink);
  r(bx + 15, skullY + 12, 5, 3, C.ink);          // nasal
  for (let i = 0; i < 6; i++) r(bx + 8 + i * 4, skullY + 15, 2, 6, dark);

  r(bx + 14, skullY + 21, 8, 3, dark);           // neck: a gap with beads

  r(bx + 0, ribY - 1, 10, 6, body);              // shoulder blades, out past the cage
  r(bx + 26, ribY - 1, 10, 6, body);
  r(bx + 14, ribY, 8, 15, body);                 // spine
  const ribW = [34, 32, 28, 24];
  for (let i = 0; i < 4; i++) {
    const y = ribY + i * 4;
    const x = (36 - ribW[i]) / 2;
    r(bx + x, y, ribW[i], 3, body);
    r(bx + x, y + 2, ribW[i], 1, dark);
  }

  r(bx + 6, ribY + 15, 24, 6, body);             // hips, a wide plate
  r(bx + 7, py + 44, 9, 6, body);                // femurs: thick and short
  r(bx + 20, py + 44, 9, 6, body);
  r(bx + 9, py + 46, 5, 3, dark);
  r(bx + 22, py + 46, 5, 3, dark);
  r(bx + 3, py + 49, 14, 3, body);               // and wide feet under them
  r(bx + 19, py + 49, 14, 3, body);

  bossRank(r, bx, py, 4);
}

/**
 * 7-F, SÄÄHERRA — 68x46, the one who leaves the ground.
 *
 * `plan: 'wedge'`, and he is an **anvil cloud**: widest at the very top,
 * narrowing every band down to a keel, ending in vapour instead of feet. An
 * inverted triangle is the one outline none of the other six has, and it is
 * also the only shape here that says "this is not standing on anything".
 *
 * He was reported as a bus twice, and the second time was *after* the ratio had
 * been fixed, which is the useful half of the story: **two pale eyes side by
 * side on a wide dark hull are lit windows**, and no amount of brow over them
 * changes that. One enormous eye, dead centre. Nothing with one eye is a
 * vehicle. The barometer went with it — a pale square in a gold frame at eye
 * height was the second eye — and now hangs small under the keel.
 */
function drawStormBoss(r, bx, py, body, dark, frame, pose) {
  const t = py + (Math.floor(frame / 12) % 2 === 0 ? 0 : 1);

  r(bx + 2, t + 0, 64, 9, body);
  r(bx + 2, t + 0, 64, 3, dark);                 // lit crown of the thunderhead
  r(bx + 9, t + 9, 50, 9, body);
  r(bx + 9, t + 15, 50, 3, dark);
  r(bx + 19, t + 18, 30, 10, body);
  r(bx + 25, t + 28, 18, 7, dark);               // keel
  rivets(r, bx + 6, t + 4, 4, 6, C.ink);
  rivets(r, bx + 46, t + 4, 4, 6, C.ink);

  /* Vapour, boiling on its own phase rather than swinging: a hem that swings is
   * a cloak, and a cloak is worn by something that stands. */
  for (let i = 0; i < 3; i++) {
    const phase = Math.floor(frame / 6 + i * 1.7) % 3;
    r(bx + 27 + i * 5, t + 35, 5, 6 + phase * 2, dark);
  }

  r(bx + 24, t + 4, 20, 3, dark);                // lid
  /* Kulmat sisään: täysi neliö kultakehyksettäkin luki ruutuna, ja ruutu on
   * yhtä lailla ajoneuvon osa kuin ikkunakin. Kaksi pikseliä joka kulmasta
   * riittää tekemään siitä silmän. */
  r(bx + 24, t + 6, 20, 14, C.ink);
  r(bx + 26, t + 7, 16, 12, '#dfe8ff');
  r(bx + 26, t + 7, 2, 2, C.ink);
  r(bx + 40, t + 7, 2, 2, C.ink);
  r(bx + 26, t + 17, 2, 2, C.ink);
  r(bx + 40, t + 17, 2, 2, C.ink);
  r(bx + 31, t + 10, 8, 8, '#2a3a6a');
  r(bx + 32, t + 11, 3, 3, C.white);             // one catchlight, so it is wet

  bossRank(r, bx, py, 5);
}

/**
 * 8-F, PIERUKUNINGAS — 50x52, the one who is all of them.
 *
 * As a mask he was an **archway**: two rectangles and a doorway between the
 * legs. Three things did that, and all three are fixed here — the mantle ran
 * the full width and cut the silhouette into two boxes, the head sat straight
 * on the shoulders with nothing to separate it, and the boots were level so the
 * gap under him had a flat lintel.
 *
 * Now: head nearly half his width, a neck you can see, pauldrons out past
 * everything, a waist of 16 px, and boots offset by two rows.
 */
function drawKingBoss(r, bx, py, body, dark, frame, pose) {
  const sway = Math.floor(frame / 9) % 2 === 0 ? 0 : 1;

  r(bx + 0 - sway, py + 30, 8, 20, dark);        // cape behind everything
  r(bx + 42 + sway, py + 30, 8, 20, dark);

  r(bx + 5, py + 44, 19, 8, dark);               // boots, staggered
  r(bx + 28, py + 46, 18, 6, dark);
  r(bx + 5, py + 49, 19, 3, C.ink);
  r(bx + 28, py + 49, 18, 3, C.ink);

  r(bx + 17, py + 38, 16, 8, body);              // waist, the narrow point
  r(bx + 12, py + 22, 26, 16, body);             // chest
  rivets(r, bx + 16, py + 27, 4, 6, dark);

  r(bx + 0, py + 22, 16, 11, body);              // pauldrons, out past the chest
  r(bx + 34, py + 22, 16, 11, body);
  r(bx + 0, py + 30, 16, 3, dark);
  r(bx + 34, py + 30, 16, 3, dark);
  r(bx + 0, py + 21, 16, 4, '#f0ece4');          // fur on the tops only
  r(bx + 34, py + 21, 16, 4, '#f0ece4');

  r(bx + 21, py + 18, 9, 5, dark);               // neck: the pinch

  r(bx + 15, py + 0, 20, 18, body);
  r(bx + 15, py + 1, 20, 5, dark);
  r(bx + 18, py + 6, 6, 7, C.white);
  r(bx + 27, py + 6, 6, 7, C.white);
  r(bx + 20, py + 8, 4, 5, C.ink);
  r(bx + 28, py + 8, 4, 5, C.ink);
  r(bx + 18, py + 14, 14, 4, C.ink);             // a jaw wide enough to mean it

  bossRank(r, bx, py, 6);
}

/**
 * Which drawing is which boss, and the one thing they all share.
 *
 * **The hands go on twice, and that is the fix rather than a trick.** At rest
 * they belong *behind* the body — a hand at your side is occluded by your own
 * shoulder — so drawing them first lets them peek out at the silhouette's edge
 * without ever landing on a face. The moment they are carrying the crown they
 * have to be in front of everything, because the whole point of that animation
 * is watching them do it. `pose.grip` is exactly the number that distinguishes
 * the two cases, so it is the number that decides the second pass.
 */
function drawStandardBoss(r, bx, py, body, dark, frame, variant, pose) {
  const hands = HANDS[variant] || HANDS[6];
  bossHands(r, bx, py, pose, hands);
  if (variant === 1) drawStomperBoss(r, bx, py, body, dark, frame, pose);
  else if (variant === 2) drawChargerBoss(r, bx, py, body, dark, frame, pose);
  else if (variant === 3) drawBalloonBoss(r, bx, py, body, dark, frame, pose);
  else if (variant === 4) drawSkeletonBoss(r, bx, py, body, dark, frame, pose);
  else if (variant === 5) drawStormBoss(r, bx, py, body, dark, frame, pose);
  else drawKingBoss(r, bx, py, body, dark, frame, pose);
  if (pose.grip > 0) bossHands(r, bx, py, pose, hands);
}

/**
 * `crown` is 0..1: the put-on/take-off clock above. Drawn here rather than by
 * the entity so a boss is one picture — the crown has to scale and travel with
 * the body it belongs to, and the giant scales by three.
 */
export function drawBoss(ctx, x, y, frame, facing, hurt, variant = 0, scale = 1, crown = 0) {
  const px = Math.round(x);
  const py = Math.round(y);
  /*
   * Kuusi väriä, ja kaksi viimeistä ovat luuvalkoinen ja myrskynsininen.
   *
   * `% 4` oli tässä ennen ja se olisi antanut varianttille 4 nyrkkeilijän
   * violetin — eli uusi pomo olisi näyttänyt maailman 1 pomolta ilman että
   * mikään olisi kertonut siitä. Modulo lasketaan nyt taulukon pituudesta,
   * joten seuraava variantti joko saa oman värinsä tai kiertää tarkoituksella.
   *
   * Luurangon tumma sävy on **kylmä harmaa eikä ruskea**: luu vanhenee
   * kellertäväksi, mutta ruudulla ruskea varjo vaalean päällä lukee likaisena
   * puuna. Sama valinta kuin `THEMES.bone`issa, ja samasta syystä.
   *
   * Sääherra (5) on **tumma eikä vaalea**, vaikka hänen maailmansa on
   * valkoinen, ja se on tarkoitus kahdesti: hänen areenansa on linnakehuone
   * eikä pilvi, ja kruunu on kullanvärinen. Vaalea pomo kultaisella kruunulla
   * on pomo jonka kruunua ei näe — ja kruunu on se yksi asia jonka pelaajan on
   * luettava, koska se kertoo milloin häneen ei saa koskea. Väri on siis
   * luettavuuspäätös eikä makuasia, ja se on sama päätös kuin maailman
   * paletissa toisin päin.
   */
  /*
   * Ja seitsemäs on kuningas (6), **tumma viininpunainen eikä kultainen**.
   *
   * Kulta on tässä pelissä varattu: kruunu on ainoa kultainen asia pomossa, ja
   * se on se yksi merkki jonka pelaajan on luettava. Kultainen kuningas
   * kultaisella kruunulla olisi kuningas jonka kruunua ei näe — sama päätös
   * kuin sääherralla (5), joka on tumma vaikka hänen maailmansa on valkoinen,
   * ja samasta syystä.
   */
  const bodyColors = ['#a04ca0', '#3c7ad0', '#2fa06a', '#c85a20', '#e8e0cc', '#3a4472', '#8c1830'];
  const darkColors = ['#6a2c6a', '#24528c', '#1c6a46', '#8c3a0c', '#7c7a88', '#1e2444', '#54101e'];
  const flashing = hurt && Math.floor(frame / 2) % 2 === 1;
  const body = flashing ? '#e07070' : bodyColors[variant % bodyColors.length];
  const dark = flashing ? body : darkColors[variant % darkColors.length];
  const S = scale;
  const pose = crownPose(crown);
  // The hurt flash has to win over every local colour, or a boss taking a hit
  // would flash everywhere except his gloves, his medal and his sceptre.
  const r = (rx, ry, rw, rh, color) => {
    ctx.fillStyle = flashing ? body : color;
    ctx.fillRect(
      Math.round(rx * S), Math.round(ry * S), Math.round(rw * S), Math.round(rh * S));
  };

  const size = bossSize(variant);
  ctx.save();
  /* Mirrored about the boss's **own** width. This was `32 * S` for everybody,
   * which was right only while everybody was 30 wide: a 76 px storm mirrored
   * about 32 lands 44 px from where it should. */
  flip(ctx, px, size.w * S, facing < 0, (bx) => {
    ctx.translate(bx - bx * S, py - py * S);   // scale about the sprite origin
    if (variant === 0) drawBoxerBoss(r, bx, py, body, dark, frame, pose);
    else drawStandardBoss(r, bx, py, body, dark, frame, variant, pose);
  });
  ctx.restore();
  bossCrown(ctx, px, py, S, pose, frame, size.w);
}

/**
 * The crown itself: band, rim and points, as wide as the boss's *hitbox* rather
 * than as wide as its head, so what the player can see is exactly what a stomp
 * would land on.
 *
 * `boxW` is passed in rather than assumed, and that is the whole of what made
 * per-boss sizes safe. The width was the constant 30 while every boss was 30
 * wide; the moment one of them became 76, a crown still drawn at 30 would have
 * promised a landing strip less than half the width of the thing under it —
 * which is the one promise in this file that may not be broken.
 *
 * Deliberately not flashed with the hurt colour, unlike everything the boss is
 * made of. It is the one thing that has to stay readable while he is being hit,
 * and a crown that vanished into the flash every other frame would take the
 * answer away exactly when the fight is busiest.
 */
function bossCrown(ctx, px, py, scale, pose, frame, boxW) {
  const full = Math.round(boxW * scale);
  const w = Math.round(full * pose.width);
  if (w <= 0) return;
  const x = px + 1 + Math.round((full - w) / 2);
  const y = py + Math.round(pose.y * scale);
  const h = Math.max(2, Math.round(4 * scale));
  const rim = Math.max(1, Math.round(scale));
  drawSpines(ctx, x, y, w, pose.spines, frame, pose.spines < 1, 8 * scale);
  ctx.fillStyle = C.gold;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#8c6410';
  ctx.fillRect(x, y + h - rim, w, rim);
}
