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
const CROWN_SPREAD = 0.12;
const CROWN_TOP = 0.5;
const CROWN_SEAT = 0.75;
const CROWN_SPINES = 0.78;
/** Where the crown is drawn out, and how high it is lifted. Sprite pixels. */
const CROWN_REST_Y = 18;
const CROWN_HIGH_Y = -10;
/** Hands, at rest and holding the rim from underneath so the band cannot hide them. */
const HAND_REST_Y = 20;
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

/** Where the hands are this frame — the crown's rim, or back at his sides. */
function handY(py, pose) {
  return py + lerp(HAND_REST_Y, pose.y + HAND_GRIP_DY, pose.grip);
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
    r(bx + 11, py + 11, 3, 3, '#a01820');
    r(bx + 16, py + 11, 3, 3, '#a01820');
    r(bx + 10, py + 13, 10, 6, goldDark);
    r(bx + 11, py + 14, 8, 4, gold);
    r(bx + 14, py + 15, 3, 2, goldDark);
    return;
  }
  if (variant === 2) {
    /* The sceptre, planted at the charger's trailing side. Round on top and
     * **below the line of his own back**, which is the same rule it always
     * obeyed — it just has a lower boss to obey it on now. */
    r(bx + 4, py + 16, 2, 11, goldDark);
    r(bx + 4, py + 16, 1, 11, gold);
    r(bx + 3, py + 13, 4, 4, gold);
    r(bx + 4, py + 14, 2, 1, '#fff0a0');
    return;
  }
  if (variant === 3) {
    // Epaulettes with fringe: the one who has people under him. Set on the
    // curve of the sphere, where shoulders would be if he had any.
    for (const ex of [1, 24]) {
      r(bx + ex, py + 11, 5, 3, gold);
      r(bx + ex, py + 13, 5, 2, goldDark);
      for (let i = 0; i < 3; i++) r(bx + ex + i * 2, py + 15, 1, 3, gold);
    }
    return;
  }
  if (variant === 4) {
    /*
     * Taskukello ketjussa, ja sen viisarit osoittavat kahtatoista.
     *
     * The skeleton's rank is the hour. *Danse macabre* is midnight — the piece
     * opens with twelve strokes, and the level's music opens with them too — so
     * the one thing he wears is the clock that says so, and the two halves of
     * the world's presentation point at the same joke without either of them
     * saying it out loud.
     *
     * Hung off the ribs to one side, because the middle of him is spine and the
     * bottom of him is the gap between two leg bones.
     */
    r(bx + 6, py + 19, 2, 2, goldDark);            // ketju
    r(bx + 5, py + 21, 2, 2, goldDark);
    r(bx + 2, py + 22, 8, 8, goldDark);            // kuori
    r(bx + 3, py + 23, 6, 6, gold);
    r(bx + 5, py + 24, 1, 3, goldDark);            // minuuttiviisari, ylös
    r(bx + 5, py + 25, 2, 1, goldDark);            // tuntiviisari, lyhyt
    return;
  }
  if (variant === 5) {
    /*
     * Ilmapuntari, ja sen neula osoittaa myrskyyn.
     *
     * Sääherran arvomerkki on mittari, ei ase — koko hahmon vitsi on että
     * ilmakehä kuuluu jollekulle, ja omistamisen merkki on se että sen tilan
     * saa lukea. Neula vasemmalle alas, koska mittarissa se on se pää jossa
     * lukee "myrsky".
     *
     * Vasemmalla eikä keskellä, koska keskellä on nyt salama: kaksi pyöreää
     * kultaista asiaa vierekkäin luetaan yhdeksi.
     */
    r(bx + 4, py + 14, 7, 7, goldDark);            // kehys
    r(bx + 5, py + 15, 5, 5, '#e8eef8');           // kellotaulu
    r(bx + 6, py + 16, 3, 1, gold);
    r(bx + 7, py + 17, 2, 2, goldDark);            // akseli
    r(bx + 6, py + 18, 1, 1, goldDark);            // neula alas vasemmalle
    return;
  }
  if (variant === 6) {
    /*
     * Hermeliini, ja se on **valkoinen eikä kultaa**.
     *
     * Kuningas on ainoa pomo jonka arvo on itse asia eikä sen merkki, joten
     * hänellä ei ole mitalia, valtikkaa eikä kelloa — hänellä on se puku josta
     * kuninkaan tunnistaa. Kaulus on jo piirretty (`drawKingBoss`); tämä on se
     * mikä tekee siitä hermeliiniä eikä valkoista kangasta.
     *
     * Valkoinen on luettavuuspäätös: kruunu on kultaa, ja mitä vähemmän muuta
     * kultaa ruudulla on, sitä varmemmin kruunu luetaan.
     */
    r(bx + 6, py + 13, 1, 2, C.ink);
    r(bx + 12, py + 13, 1, 2, C.ink);
    r(bx + 18, py + 13, 1, 2, C.ink);
    r(bx + 23, py + 13, 1, 2, C.ink);
    r(bx + 9, py + 15, 1, 1, C.ink);
    r(bx + 21, py + 15, 1, 1, C.ink);
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
  1: { xs: [0, 24], restY: 16 },
  2: { xs: [2, 12], restY: 20 },
  3: { xs: [0, 24], restY: 17 },
  4: { xs: [2, 22], restY: 20, light: '#e8e0cc', dark: '#7c7a88' },
  5: { xs: [0, 24], restY: 15, light: '#c8d4f0', dark: '#7a86a8' },
  6: { xs: [1, 23], restY: 22, light: '#d8c8a0', dark: '#8c7850' },
};

/**
 * 2-F, JYSKYTTÄJÄ — the one who answers with the floor.
 *
 * His move is a landing shockwave, so he is built as a falling weight: the feet
 * are the widest thing on him, the mass sits low, and the head is small and sunk
 * between the shoulders because a head is not what this fight is about. Read as
 * a silhouette he is a **pyramid**, and nothing else in the seven is.
 *
 * The animation is the same idea in time. He does not walk, he *shifts weight* —
 * the body compresses by a pixel and the shoulders drop into the hips, which is
 * the shape a thing makes just before it drops. Legs that merely swapped would
 * have made him a walker who happens to be fat.
 */
function drawStomperBoss(r, bx, py, body, dark, frame, pose) {
  const squash = Math.floor(frame / 8) % 2 === 0 ? 0 : 1;
  const top = py + 3 + squash * 2;

  // Feet first and widest: they are the weapon, so they are the reading.
  r(bx + 0, py + 25, 13, 7, dark);
  r(bx + 17, py + 25, 13, 7, dark);
  r(bx + 0, py + 30, 13, 2, C.ink);               // the sole: the part that lands
  r(bx + 17, py + 30, 13, 2, C.ink);
  r(bx + 2, py + 24, 9, 2, body);
  r(bx + 19, py + 24, 9, 2, body);

  // Mass, widening all the way down.
  r(bx + 6, top + 11, 18, 6, body);
  r(bx + 3, top + 16, 24, 6, body);
  r(bx + 1, top + 21, 28, 4, body);
  r(bx + 1, py + 22, 28, 4, dark);

  // Head, wide and low. No neck: the shoulders come up past his ears.
  r(bx + 8, top, 14, 12, body);
  r(bx + 8, top + 1, 14, 3, dark);               // heavy brow
  r(bx + 10, top + 4, 4, 4, C.white);
  r(bx + 16, top + 4, 4, 4, C.white);
  r(bx + 11, top + 5, 3, 3, C.ink);
  r(bx + 17, top + 5, 3, 3, C.ink);
  r(bx + 11, top + 9, 8, 2, C.ink);              // a flat, set mouth
  r(bx + 3, top + 10, 5, 6, body);               // shoulders, out at the arms
  r(bx + 22, top + 10, 5, 6, body);

  bossRank(r, bx, py, 1);
}

/**
 * 3-F, SYÖKSYJÄ — the one who charges.
 *
 * Everything leans. The head is carried **low and forward** where a charging
 * animal carries it, the back rises behind it into a hump, and the stride is
 * long. Read as a silhouette he is a **wedge pointing the way he is going**,
 * which is the one thing the player needs to know about him.
 *
 * The horns are horizontal and body-coloured, and both of those are the crown
 * rule rather than taste: they sit at eye height, well under the crown line, and
 * carry no gold. Pointed *forward* is a charge; pointed *up* is the one thing
 * only the crown may say.
 *
 * The stride opens and closes rather than the legs merely swapping, because a
 * charger reads from how far apart his feet are.
 */
function drawChargerBoss(r, bx, py, body, dark, frame, pose) {
  const open = Math.floor(frame / 5) % 2 === 0;
  const lean = open ? 1 : 0;

  // Stride: back leg trails, front leg reaches.
  r(bx + (open ? 1 : 4), py + 26, 7, 6, dark);
  r(bx + (open ? 21 : 18), py + 26, 8, 6, dark);

  // Haunch and back, rising to a hump behind the shoulders.
  r(bx + 1, py + 13, 19, 14, body);
  r(bx + 4, py + 7, 15, 8, body);                // the hump, high over the shoulders
  r(bx + 2, py + 23, 18, 4, dark);

  // Neck and head, thrust forward and low.
  r(bx + 15, py + 13, 9, 10, body);
  r(bx + 20 + lean, py + 15, 10, 9, body);
  r(bx + 20 + lean, py + 21, 10, 3, dark);

  // Horns, forward. Never above the crown line — see the note above.
  r(bx + 27 + lean, py + 13, 3, 2, dark);
  r(bx + 25 + lean, py + 12, 3, 2, dark);

  r(bx + 21 + lean, py + 16, 4, 4, C.white);
  r(bx + 26 + lean, py + 16, 3, 4, C.white);
  r(bx + 22 + lean, py + 17, 2, 3, C.ink);
  r(bx + 26 + lean, py + 17, 2, 3, C.ink);

  bossRank(r, bx, py, 2);
}

/**
 * 4-F and 5-F, PÖHÖ — the one who inflates.
 *
 * A sphere with limbs too small for it. The comedy and the warning are the same
 * shape: something this round with feet that little is a thing about to become
 * bigger, and `scale` is the move set doing exactly that. Read as a silhouette
 * he is a **circle**, which is the one shape none of the other six has.
 *
 * He breathes on his own clock as well, a pixel out and back. That is not the
 * same thing as `scale` and both are wanted: the scale is the fight's state, the
 * breath is that he is full of it the whole time.
 */
function drawBalloonBoss(r, bx, py, body, dark, frame, pose) {
  const puff = Math.floor(frame / 10) % 2 === 0 ? 0 : 1;

  // Tiny limbs first, so the body overlaps and swallows them.
  r(bx + 6, py + 27, 6, 5, dark);
  r(bx + 18, py + 27, 6, 5, dark);

  // The sphere, in bands.
  r(bx + 9 - puff, py + 3, 12 + puff * 2, 4, body);
  r(bx + 5 - puff, py + 6, 20 + puff * 2, 4, body);
  r(bx + 2 - puff, py + 9, 26 + puff * 2, 12, body);
  r(bx + 4 - puff, py + 20, 22 + puff * 2, 5, body);
  r(bx + 8, py + 24, 14, 4, body);
  r(bx + 4 - puff, py + 22, 22 + puff * 2, 3, dark);

  // Seams, so the roundness is a shape and not just a wide rectangle.
  r(bx + 6 - puff, py + 9, 1, 12, dark);
  r(bx + 23 + puff, py + 9, 1, 12, dark);

  // Eyes high on the curve, small against all that body.
  r(bx + 9, py + 8, 5, 5, C.white);
  r(bx + 17, py + 8, 5, 5, C.white);
  r(bx + 11, py + 9, 3, 3, C.ink);
  r(bx + 17, py + 9, 3, 3, C.ink);
  r(bx + 9, py + 6, 5, 2, dark);
  r(bx + 17, py + 6, 5, 2, dark);

  // The valve. What goes in has to go in somewhere.
  r(bx + 28 + puff, py + 14, 3, 4, dark);

  bossRank(r, bx, py, 3);
}

/**
 * 6-F, LUURANKO — the one who comes apart.
 *
 * **The gaps are the character.** Every other boss in this file is a solid mass;
 * this one is drawn as separated pieces with the room showing between them, so
 * the silhouette has holes in it and reads as bone at any distance. That is also
 * why he is the tallest and narrowest of the seven.
 *
 * The animation is the move set as an idle: on alternate beats the skull lifts a
 * pixel and the ribcage sinks one, so he is always slightly coming apart and
 * catching himself. Nothing about him ever moves *sideways*, which is what keeps
 * the rattle from reading as a walk.
 */
function drawSkeletonBoss(r, bx, py, body, dark, frame, pose) {
  const rattle = Math.floor(frame / 5) % 2 === 0 ? 1 : 0;
  const skullY = py - rattle;
  const ribY = py + 13 + rattle;

  // Skull.
  r(bx + 9, skullY, 13, 11, body);
  r(bx + 8, skullY + 3, 15, 6, body);
  r(bx + 10, skullY + 10, 11, 3, body);
  r(bx + 11, skullY + 3, 4, 5, C.ink);           // sockets, deep and square
  r(bx + 17, skullY + 3, 4, 5, C.ink);
  r(bx + 15, skullY + 8, 2, 2, C.ink);           // nasal hole
  for (let i = 0; i < 4; i++) r(bx + 11 + i * 3, skullY + 10, 1, 3, dark);   // teeth

  // Neck, deliberately a gap with two beads in it.
  r(bx + 14, skullY + 13, 3, 2, dark);

  // Ribcage: bands with the background showing between them.
  r(bx + 13, ribY, 5, 9, body);                  // spine
  for (let i = 0; i < 3; i++) {
    const y = ribY + i * 3;
    r(bx + 7, y, 17, 2, body);
    r(bx + 7, y + 1, 17, 1, dark);
  }

  /* Hips and two long bones. The length is measured off the sprite's own foot
   * line rather than written down, so the rattle cannot push a leg through the
   * floor on the frames the ribcage sinks. */
  r(bx + 9, ribY + 9, 13, 3, body);
  const legTop = ribY + 12;
  const legH = Math.max(2, py + 32 - legTop);
  r(bx + 10, legTop, 4, legH, body);
  r(bx + 17, legTop, 4, legH, body);
  r(bx + 9, py + 30, 6, 2, body);                // feet, flat on the line
  r(bx + 16, py + 30, 6, 2, body);

  bossRank(r, bx, py, 4);
}

/**
 * 7-F, SÄÄHERRA — the one who leaves the ground.
 *
 * **He has no feet, and that is the whole design.** His answer to a hit is to
 * take off, so he may never look like something that is standing: the mass is
 * carried high and the bottom of him is ragged vapour that ends in nothing. Read
 * as a silhouette he is the only one of the seven with no flat base, which is
 * legible at any size and in any colour.
 *
 * The underside churns on its own clock and he bobs a pixel, so he is never
 * quite still even before the fight starts moving — the opposite of the
 * stomper, who is only ever still or falling.
 */
function drawStormBoss(r, bx, py, body, dark, frame, pose) {
  const bob = Math.floor(frame / 12) % 2 === 0 ? 0 : 1;
  const top = py + 4 + bob;

  // The mass.
  r(bx + 6, top, 18, 6, body);
  r(bx + 3, top + 5, 24, 13, body);
  r(bx + 5, top + 16, 20, 5, dark);

  /* The underside: vapour, not a hem. Four tongues on their own phase, so it
   * boils rather than swings — a hem that swung would read as a cloak, and a
   * cloak is something a standing thing wears. */
  for (let i = 0; i < 5; i++) {
    const phase = Math.floor(frame / 6 + i * 1.7) % 3;
    r(bx + 3 + i * 5, top + 20, 5, 3 + phase, dark);
    r(bx + 4 + i * 5, top + 22 + phase, 3, 2, body);
  }

  // Eyes: pale and lit, high in the mass.
  r(bx + 8, top + 5, 6, 5, '#dfe8ff');
  r(bx + 17, top + 5, 6, 5, '#dfe8ff');
  r(bx + 10, top + 6, 3, 4, '#2a3a6a');
  r(bx + 18, top + 6, 3, 4, '#2a3a6a');

  // The bolt, pale on dark, because the storm has to be visible on him and not
  // only around him. Never above the head: see the crown rule.
  r(bx + 15, top + 11, 3, 3, '#eaf2ff');
  r(bx + 13, top + 13, 3, 3, '#eaf2ff');
  r(bx + 15, top + 15, 3, 3, '#eaf2ff');

  bossRank(r, bx, py, 5);
}

/**
 * 8-F, PIERUKUNINGAS — the one who is all of them.
 *
 * His body must stay his through all seven forms, because that is the fight:
 * `variant` stays 6 for the picture while `form` cycles the move sets, and a
 * king who looked like whoever he was imitating would have removed the very
 * thing the player is asked to read. So his silhouette is the one shape none of
 * the six can produce — **a high collar with the head standing out of it, over
 * shoulders wider than his hips**.
 *
 * The ermine is his mark of rank and it is white rather than gold, for the same
 * reason his body is dark: gold on this screen means crown, and a king whose
 * crown you cannot pick out of his own outfit is a king missing his one signal.
 */
function drawKingBoss(r, bx, py, body, dark, frame, pose) {
  const sway = Math.floor(frame / 9) % 2 === 0 ? 0 : 1;

  // Cape behind everything, swaying.
  r(bx + 1 - sway, py + 10, 6, 20, dark);
  r(bx + 23 + sway, py + 10, 6, 20, dark);

  // Royal shoes, narrow — he does not stand like the stomper.
  r(bx + 6, py + 28, 8, 4, dark);
  r(bx + 16, py + 28, 8, 4, dark);

  // Body: narrow at the waist, so the shoulders read as shoulders.
  r(bx + 9, py + 18, 12, 11, body);
  r(bx + 7, py + 12, 16, 8, body);

  /* The collar: the identifying shape. It flares up and out at the shoulders
   * and stops well clear of the middle, because a collar that met in front is
   * a bib — and because the head has to stand out of it, not sit in it. */
  r(bx + 8, py + 2, 3, 8, '#f0ece4');            // collar, standing up behind
  r(bx + 19, py + 2, 3, 8, '#f0ece4');
  r(bx + 3, py + 12, 24, 5, '#f0ece4');          // the mantle, across the shoulders
  r(bx + 3, py + 16, 24, 2, '#c0b8ac');

  // Head standing clear of the collar, and narrow: the shoulders are the width.
  r(bx + 11, py + 1, 8, 11, body);
  r(bx + 11, py + 2, 8, 2, dark);                // a level, unimpressed brow
  r(bx + 11, py + 4, 3, 4, C.white);
  r(bx + 15, py + 4, 3, 4, C.white);
  r(bx + 12, py + 5, 2, 3, C.ink);
  r(bx + 15, py + 5, 2, 3, C.ink);
  r(bx + 12, py + 9, 6, 2, dark);                // a thin, unamused mouth

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

  ctx.save();
  flip(ctx, px, 32 * S, facing < 0, (bx) => {
    ctx.translate(bx - bx * S, py - py * S);   // scale about the sprite origin
    if (variant === 0) drawBoxerBoss(r, bx, py, body, dark, frame, pose);
    else drawStandardBoss(r, bx, py, body, dark, frame, variant, pose);
  });
  ctx.restore();
  bossCrown(ctx, px, py, S, pose, frame);
}

/**
 * The crown itself: band, rim and points, as wide as the boss's *hitbox* rather
 * than as wide as its head, so what the player can see is exactly what a stomp
 * would land on.
 *
 * Deliberately not flashed with the hurt colour, unlike everything the boss is
 * made of. It is the one thing that has to stay readable while he is being hit,
 * and a crown that vanished into the flash every other frame would take the
 * answer away exactly when the fight is busiest.
 */
function bossCrown(ctx, px, py, scale, pose, frame) {
  const full = Math.round(30 * scale);
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
