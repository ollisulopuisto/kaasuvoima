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
  r(bx + (jab ? 4 : 6), py + 27, 9, 5, body);
  r(bx + (jab ? 19 : 17), py + 27, 9, 5, body);

  r(bx + 5, py + 8, 22, 20, body);          // torso
  r(bx + 8, py + 1, 16, 9, body);           // head, no crown — this one fights for it

  // championship belt, the only gold on him
  const gold = '#f0c040';
  r(bx + 5, py + 21, 22, 4, gold);

  // brows down, eyes narrowed: he is not pleased to see you
  r(bx + 10, py + 4, 5, 4, '#ffffff');
  r(bx + 17, py + 4, 5, 4, '#ffffff');
  r(bx + 12, py + 5, 3, 3, '#101018');
  r(bx + 18, py + 5, 3, 3, '#101018');
  r(bx + 9, py + 2, 7, 2, dark);
  r(bx + 16, py + 2, 7, 2, dark);

  // mouthguard
  r(bx + 12, py + 9, 8, 3, '#e8e0c0');

  // Gloves, and the wrists that follow them. Both slide to the rim of the crown
  // as `grip` comes up, so there is one pair of hands rather than a spare pair
  // that appear only for the animation.
  const leadX = lerp(jab ? 26 : 22, 24, g);
  const leadY = lerp(py + 10, py + carryY, g);
  const rearY = lerp(py + 15, py + carryY, g);

  r(bx + lerp(jab ? 25 : 21, 23, g), leadY + 3, 4, 4, '#e8e0c0');
  r(bx + 2, rearY + 2, 4, 4, '#e8e0c0');

  const glove = '#e03828';
  const gloveDark = '#8c1c10';
  r(bx + leadX, leadY, 7, 8, glove);
  r(bx + leadX, leadY + 6, 7, 2, gloveDark);
  r(bx + leadX + 1, leadY + 1, 3, 2, '#f07868');
  r(bx + 1, rearY, 7, 8, glove);
  r(bx + 1, rearY + 6, 7, 2, gloveDark);
  r(bx + 2, rearY + 1, 3, 2, '#f07868');
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
    // A medal on a ribbon, flat on the stomper's broad chest.
    r(bx + 24, py + 14, 3, 4, '#a01820');
    r(bx + 31, py + 14, 3, 4, '#a01820');
    r(bx + 22, py + 17, 14, 8, goldDark);
    r(bx + 23, py + 18, 12, 6, gold);
    r(bx + 27, py + 20, 4, 3, goldDark);
    return;
  }
  if (variant === 2) {
    /* The sceptre, planted at the charger's trailing side. Round on top and
     * below the line of his own back, which is the rule it always obeyed. */
    r(bx + 5, py + 9, 3, 15, goldDark);
    r(bx + 5, py + 9, 2, 15, gold);
    r(bx + 4, py + 5, 5, 5, gold);
    r(bx + 5, py + 6, 3, 2, '#fff0a0');
    return;
  }
  if (variant === 3) {
    // Epaulettes with fringe, on the curve where shoulders would be.
    for (const ex of [0, 29]) {
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
    r(bx + 7, py + 28, 10, 10, goldDark);          // kehys
    r(bx + 8, py + 29, 8, 8, '#e8eef8');           // kellotaulu
    r(bx + 10, py + 31, 4, 1, gold);
    r(bx + 11, py + 32, 2, 2, goldDark);           // akseli
    r(bx + 9, py + 34, 3, 1, goldDark);            // neula alas vasemmalle
    r(bx + 10, py + 35, 1, 2, goldDark);
    return;
  }
  if (variant === 6) {
    /*
     * Hermeliini, ja se on valkoinen eikä kultaa. Kuningas on ainoa pomo jonka
     * arvo on itse asia eikä sen merkki; kaulus on jo piirretty, tämä on se
     * mikä tekee siitä hermeliiniä eikä valkoista kangasta. Kulta on kruunun.
     */
    r(bx + 3, py + 20, 2, 3, C.ink);
    r(bx + 9, py + 20, 2, 3, C.ink);
    r(bx + 39, py + 20, 2, 3, C.ink);
    r(bx + 45, py + 20, 2, 3, C.ink);
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
  2: { xs: [20, 36], restY: 33 },
  3: { xs: [0, 30], restY: 17 },
  4: { xs: [0, 30], restY: 33, light: '#e8e0cc', dark: '#7c7a88' },
  5: { xs: [4, 58], restY: 22, light: '#c8d4f0', dark: '#7a86a8' },
  6: { xs: [2, 42], restY: 36, light: '#d8c8a0', dark: '#8c7850' },
};
/**
 * 2-F, JYSKYTTÄJÄ — 56x48, the one who answers with the floor.
 *
 * A brick with feet. The plating is the point: a hull band across the chest, a
 * dark undercarriage, and bolts along both seams, so the mass reads as
 * *assembled* rather than as a filled rectangle. The face is small and set into
 * the hull the way a cockpit is.
 */
function drawStomperBoss(r, bx, py, body, dark, frame, pose) {
  const squash = Math.floor(frame / 8) % 2 === 0 ? 0 : 1;
  const top = py + 2 + squash * 2;

  // Feet: the widest thing on him and the part that lands.
  r(bx + 0, py + 36, 24, 12, dark);
  r(bx + 32, py + 36, 24, 12, dark);
  r(bx + 0, py + 45, 24, 3, C.ink);
  r(bx + 32, py + 45, 24, 3, C.ink);
  chevrons(r, bx + 2, py + 39, 20, 4, C.ink);
  chevrons(r, bx + 34, py + 39, 20, 4, C.ink);

  // Hull, widening down.
  r(bx + 10, top + 10, 36, 10, body);
  r(bx + 4, top + 18, 48, 10, body);
  r(bx + 1, top + 26, 54, 8, body);
  r(bx + 1, py + 30, 54, 6, dark);               // undercarriage
  rivets(r, bx + 4, top + 20, 8, 6, dark);
  rivets(r, bx + 4, py + 32, 8, 6, C.ink);

  // Head sunk into the shoulders.
  r(bx + 19, top, 18, 16, body);
  r(bx + 19, top + 1, 18, 4, dark);
  r(bx + 22, top + 6, 5, 6, C.white);
  r(bx + 30, top + 6, 5, 6, C.white);
  r(bx + 23, top + 7, 4, 5, C.ink);
  r(bx + 31, top + 7, 4, 5, C.ink);
  r(bx + 23, top + 13, 10, 3, C.ink);
  r(bx + 8, top + 12, 10, 9, body);              // shoulders
  r(bx + 38, top + 12, 10, 9, body);

  bossRank(r, bx, py, 1);
}

/**
 * 3-F, SYÖKSYJÄ — 64x40, the one who charges.
 *
 * Twice reported as elongated, and the second report was right even after the box
 * had been squared up, because **the box was never what was wrong**. A body drawn
 * as one even-height bar with a face bolted to the end reads as a vehicle at any
 * ratio. What arcade chargers do instead is *taper*: everything piles up at the
 * front and falls away behind, so the shape itself says which way it is going.
 *
 * So he is a wedge now, built back to front in three rising blocks — low rump,
 * higher back, tallest shoulder hump — with the head hung off the front under a
 * brow that overhangs it. The neck between them is a dark bolted piston, which
 * is the joint that makes the hump and the head read as two masses rather than
 * as one long one.
 *
 * No horns. A ram wants them and the crown rule will not have them: pointed
 * things at the top of a boss mean one thing in this game. The brow does the
 * work instead, which is what it is for.
 */
function drawChargerBoss(r, bx, py, body, dark, frame, pose) {
  const open = Math.floor(frame / 5) % 2 === 0;
  const step = open ? 1 : 0;

  // Hind quarters: small, low, right at the back. Everything about him is at
  // the other end, and the back end being *undersized* is what says so.
  r(bx + 4 + step, py + 30, 13, 10, dark);
  r(bx + 4 + step, py + 37, 13, 3, C.ink);
  r(bx + 2, py + 22, 20, 10, body);

  /* The hump, built as a staircase rather than a block: each step further
   * forward and eight pixels higher, so the back *slopes* instead of roofing
   * over. A flat top edge across thirty pixels is a locomotive no matter what
   * is drawn under it, and that is the shape he kept coming back as. */
  r(bx + 14, py + 16, 22, 16, body);
  r(bx + 24, py + 9, 24, 23, body);
  r(bx + 34, py + 2, 22, 30, body);
  r(bx + 14, py + 16, 22, 2, dark);              // the tread of each step
  r(bx + 24, py + 9, 24, 2, dark);
  r(bx + 34, py + 2, 22, 2, dark);
  r(bx + 14, py + 28, 42, 4, dark);              // underside in shadow
  rivets(r, bx + 37, py + 7, 3, 6, dark);

  // Forelegs: the ones that do the charging, so they are the heavy pair.
  r(bx + 44 - step, py + 30, 17, 10, dark);
  r(bx + 44 - step, py + 37, 17, 3, C.ink);

  // Head slung low and forward, *under* the hump rather than on top of it.
  r(bx + 44, py + 16, 20, 18, body);
  r(bx + 40, py + 12, 24, 6, dark);              // brow, out past the face
  r(bx + 46, py + 28, 18, 6, dark);              // jaw

  r(bx + 46, py + 19, 7, 7, C.white);
  r(bx + 56, py + 19, 7, 7, C.white);
  r(bx + 49, py + 21, 4, 5, C.ink);
  r(bx + 59, py + 21, 4, 5, C.ink);
  for (let i = 0; i < 3; i++) r(bx + 49 + i * 5, py + 28, 3, 4, C.white);   // tusks

  bossRank(r, bx, py, 2);
}

/**
 * 4-F and 5-F, PÖHÖ — 40x40, the one who inflates.
 *
 * A bolted sphere with limbs too small for it, and the only square box in the
 * seven. Small on purpose: `scale` takes him to three times this.
 */
function drawBalloonBoss(r, bx, py, body, dark, frame, pose) {
  const puff = Math.floor(frame / 10) % 2 === 0 ? 0 : 1;

  r(bx + 8, py + 34, 8, 6, dark);
  r(bx + 24, py + 34, 8, 6, dark);

  r(bx + 12 - puff, py + 2, 16 + puff * 2, 4, body);
  r(bx + 6 - puff, py + 5, 28 + puff * 2, 6, body);
  r(bx + 2 - puff, py + 10, 36 + puff * 2, 16, body);
  r(bx + 5 - puff, py + 25, 30 + puff * 2, 6, body);
  r(bx + 11, py + 30, 18, 5, body);
  r(bx + 5 - puff, py + 27, 30 + puff * 2, 4, dark);
  rivets(r, bx + 6, py + 11, 5, 7, dark);        // bolts round the equator
  rivets(r, bx + 6, py + 22, 5, 7, dark);

  r(bx + 8 - puff, py + 10, 1, 16, dark);
  r(bx + 31 + puff, py + 10, 1, 16, dark);

  r(bx + 11, py + 9, 7, 7, C.white);
  r(bx + 22, py + 9, 7, 7, C.white);
  r(bx + 13, py + 10, 5, 5, C.ink);
  r(bx + 22, py + 10, 5, 5, C.ink);
  r(bx + 11, py + 6, 7, 3, dark);
  r(bx + 22, py + 6, 7, 3, dark);

  r(bx + 37 + puff, py + 17, 5, 6, dark);        // the valve

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
 * He has been a bus twice. The first time it was the ratio; the second time the
 * ratio was fixed and he was still a bus, because **two pale eyes side by side
 * on a wide dark hull are windows** no matter how deep the brow over them is.
 * Two-of-a-thing at that spacing is what a vehicle looks like, and a heavier
 * brow only makes the roof look sturdier.
 *
 * The fix is the one big-boss designs reach for when a shape has to read as a
 * creature and not a machine: **one enormous eye, dead centre.** Nothing with a
 * single eye is a vehicle. Around it the mass is stacked top-heavy — a domed
 * thunderhead overhanging a hull that narrows all the way down to a keel — so
 * the silhouette is a wedge standing on its point, which is also the least
 * stable shape available and therefore the most threatening.
 *
 * **He still has no feet.** The underside is ragged vapour that ends in nothing,
 * and he is the only one of the seven with no flat base.
 */
function drawStormBoss(r, bx, py, body, dark, frame, pose) {
  const bob = Math.floor(frame / 12) % 2 === 0 ? 0 : 1;
  const top = py + 2 + bob;

  // Stacked top-heavy: dome, canopy, then the overhang that shades everything.
  r(bx + 20, top, 28, 5, body);
  r(bx + 10, top + 4, 48, 7, body);
  r(bx + 4, top + 10, 60, 11, body);
  r(bx + 4, top + 18, 60, 3, dark);              // the lip of the overhang
  rivets(r, bx + 6, top + 6, 3, 6, C.ink);       // clear of the eye on both sides
  rivets(r, bx + 46, top + 6, 3, 6, C.ink);

  // Lightning rods out of the flanks, level: the only things that break the
  // outline sideways, and horizontal because upward is the crown's alone.
  r(bx + 0, top + 13, 6, 4, dark);
  r(bx + 62, top + 13, 6, 4, dark);

  // Hull tapering to a keel — every band narrower than the one above it.
  r(bx + 12, top + 20, 44, 10, body);
  r(bx + 20, top + 28, 28, 6, dark);

  /* The underside: vapour, not a hem. Tongues on their own phase so it boils
   * rather than swings — a hem that swung would read as a cloak, and a cloak is
   * something a standing thing wears. */
  for (let i = 0; i < 5; i++) {
    const phase = Math.floor(frame / 6 + i * 1.7) % 3;
    r(bx + 18 + i * 7, top + 32, 6, 4 + phase * 2, dark);
    r(bx + 19 + i * 7, top + 35 + phase * 2, 4, 3, body);
  }

  // The one eye, centred and huge, sunk into the hull.
  r(bx + 24, top + 12, 20, 16, C.ink);
  r(bx + 26, top + 13, 16, 14, '#dfe8ff');
  r(bx + 31, top + 17, 8, 9, '#2a3a6a');
  r(bx + 32, top + 18, 3, 3, C.white);           // one catchlight, so it is wet
  r(bx + 24, top + 10, 20, 3, dark);             // lid

  // The bolt — white rather than gold, so it never competes with the crown.
  // On the hull's right, because the hull's left is where the barometer hangs.
  r(bx + 46, top + 21, 5, 4, '#eaf2ff');
  r(bx + 42, top + 24, 5, 4, '#eaf2ff');

  bossRank(r, bx, py, 5);
}

/**
 * 8-F, PIERUKUNINGAS — 50x52, the one who is all of them.
 *
 * The last thing in the game, and he kept reading as a cabinet: a red rectangle
 * with a white shelf across it. Two things did that. The mantle ran the full
 * width, which draws a horizontal line right through the middle of a silhouette
 * and cuts it into two boxes; and the body had the same width top to bottom, so
 * there was nothing for the eye to climb.
 *
 * Now he is **top-heavy and tapered**: pauldrons out past everything at the
 * shoulders, a chest, a waist narrower than the head, and boots that flare back
 * out at the floor. 50 wide at the shoulders down to 18 at the belt is a real
 * taper, and the fur is only on the pauldron tops so no line ever crosses him.
 *
 * The head is 22 px on a 50 px frame — nearly half his width. That is the
 * proportion arcade finales are drawn in, and it is the opposite of the
 * realistic one on purpose.
 */
function drawKingBoss(r, bx, py, body, dark, frame, pose) {
  const sway = Math.floor(frame / 9) % 2 === 0 ? 0 : 1;

  r(bx + 0 - sway, py + 26, 8, 24, dark);        // cape behind everything
  r(bx + 42 + sway, py + 26, 8, 24, dark);

  r(bx + 9, py + 44, 14, 8, dark);               // boots, flaring back out
  r(bx + 27, py + 44, 14, 8, dark);
  r(bx + 9, py + 49, 14, 3, C.ink);
  r(bx + 27, py + 49, 14, 3, C.ink);

  r(bx + 16, py + 34, 18, 12, body);             // waist, the narrow point
  r(bx + 13, py + 24, 24, 12, body);             // chest
  rivets(r, bx + 17, py + 28, 3, 6, dark);

  r(bx + 0, py + 21, 15, 13, body);              // pauldrons, out past the chest
  r(bx + 35, py + 21, 15, 13, body);
  r(bx + 0, py + 31, 15, 3, dark);
  r(bx + 35, py + 31, 15, 3, dark);
  r(bx + 0, py + 19, 15, 4, '#f0ece4');          // fur on the tops only
  r(bx + 35, py + 19, 15, 4, '#f0ece4');

  r(bx + 11, py + 12, 5, 12, '#f0ece4');         // collar standing up behind
  r(bx + 34, py + 12, 5, 12, '#f0ece4');

  r(bx + 14, py + 0, 22, 22, body);              // head, half his width
  r(bx + 14, py + 1, 22, 5, dark);
  r(bx + 17, py + 7, 6, 8, C.white);
  r(bx + 27, py + 7, 6, 8, C.white);
  r(bx + 19, py + 9, 4, 6, C.ink);
  r(bx + 28, py + 9, 4, 6, C.ink);
  r(bx + 18, py + 17, 14, 5, C.ink);             // a jaw wide enough to mean it

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
