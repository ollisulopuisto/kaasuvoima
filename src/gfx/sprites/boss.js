/**
 * The four bosses. They are one file rather than four because they are one
 * drawing with a colour swap — only world 1's boxer is drawn from scratch, and
 * he only exists because the shared body would not read as a boxer.
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
 */
function bossRank(r, bx, py, variant) {
  const gold = '#f0c040';
  const goldDark = '#8c6410';
  if (variant === 1) {
    // a medal on a ribbon, hung under the chin
    r(bx + 12, py + 23, 3, 3, '#a01820');
    r(bx + 17, py + 23, 3, 3, '#a01820');
    r(bx + 11, py + 24, 10, 6, goldDark);
    r(bx + 12, py + 25, 8, 4, gold);
    r(bx + 15, py + 26, 3, 2, goldDark);
    return;
  }
  if (variant === 2) {
    // a sceptre, planted in the lead hand. Round on top and never higher than
    // the head, so it can never be the pointed thing the player is looking for.
    r(bx + 26, py + 6, 3, 22, goldDark);
    r(bx + 26, py + 6, 2, 22, gold);
    r(bx + 25, py + 2, 6, 5, gold);
    r(bx + 26, py + 3, 4, 2, '#fff0a0');
    r(bx + 25, py + 8, 6, 2, goldDark);
    return;
  }
  if (variant === 3) {
    // epaulettes with fringe: the giant is the one who has people under him
    for (const ex of [2, 25]) {
      r(bx + ex, py + 6, 5, 4, gold);
      r(bx + ex, py + 9, 5, 2, goldDark);
      for (let i = 0; i < 3; i++) r(bx + ex + i * 2, py + 11, 1, 3, gold);
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
     * It obeys the rule every mark of rank in this file obeys: round, below the
     * eyeline, and nothing above the head. Anything gold and pointed up there
     * means exactly one thing in this game, and it is not "boss".
     */
    r(bx + 14, py + 22, 2, 2, goldDark);            // ketju
    r(bx + 15, py + 24, 2, 2, goldDark);
    r(bx + 12, py + 25, 8, 8, goldDark);            // kuori
    r(bx + 13, py + 26, 6, 6, gold);
    r(bx + 15, py + 27, 1, 3, goldDark);            // minuuttiviisari, ylös
    r(bx + 15, py + 28, 2, 1, goldDark);            // tuntiviisari, lyhyt
    return;
  }
  if (variant === 5) {
    /*
     * Ilmapuntari, ja sen neula osoittaa myrskyyn.
     *
     * Sääherran arvomerkki on mittari, ei ase — koko hahmon vitsi on että
     * ilmakehä kuuluu jollekulle, ja omistamisen merkki on se että sen tilan
     * saa lukea. Se noudattaa saman säännön kuin jokainen muu arvomerkki tässä
     * tiedostossa: pyöreä, silmien alapuolella, eikä mitään pään yläpuolella.
     *
     * Neula vasemmalle alas, koska mittarissa se on se pää jossa lukee
     * "myrsky". Sitä ei ole kirjoitettu mihinkään eikä tarvitse olla: viisari
     * joka on kaukana pystystä on jokaisessa mittarissa se jonka takia
     * ihmiset katsovat mittaria.
     */
    r(bx + 11, py + 22, 10, 10, goldDark);          // kehys
    r(bx + 12, py + 23, 8, 8, '#e8eef8');           // kellotaulu
    r(bx + 13, py + 24, 6, 1, gold);
    r(bx + 15, py + 27, 2, 2, goldDark);            // akseli
    r(bx + 13, py + 28, 2, 1, goldDark);            // neula alas vasemmalle
    r(bx + 14, py + 29, 1, 1, goldDark);
    return;
  }
  if (variant === 6) {
    /*
     * Hermeliiniviitta, ja se on **valkoinen eikä kultaa**.
     *
     * Kuningas on ainoa pomo jonka arvo on itse asia eikä sen merkki, joten
     * hänellä ei ole mitalia, valtikkaa eikä kelloa — hänellä on se puku josta
     * kuninkaan tunnistaa. Valkoinen on tässä sama luettavuuspäätös kuin
     * vartalon värissä: kruunu on kultaa, ja mitä vähemmän muuta kultaa
     * ruudulla on, sitä varmemmin kruunu luetaan.
     *
     * Olkapäillä eikä rinnalla, koska rinta on jo varattu: `drawStandardBoss`
     * piirtää suun riville py+18. Ja pysyy pään alapuolella niin kuin jokainen
     * muu arvomerkki tässä tiedostossa.
     */
    for (const ex of [1, 25]) {
      r(bx + ex, py + 8, 6, 9, '#f0ece4');
      r(bx + ex, py + 15, 6, 2, '#c0b8ac');
      r(bx + ex + 1, py + 10, 1, 2, C.ink);
      r(bx + ex + 3, py + 13, 1, 2, C.ink);
    }
  }
}

/** Worlds 2-5: one body, four colours, and a different mark of rank on each. */
function drawStandardBoss(r, bx, py, body, dark, frame, variant, pose) {
  r(bx + 2, py + 6, 28, 24, body);
  r(bx + 6, py + 2, 20, 8, body);
  r(bx + 2, py + 25, 28, 5, dark);
  r(bx + 8, py + 8, 7, 6, C.white);
  r(bx + 18, py + 8, 7, 6, C.white);
  r(bx + 11, py + 10, 3, 4, C.ink);
  r(bx + 21, py + 10, 3, 4, C.ink);
  r(bx + 8, py + 6, 7, 2, C.ink);
  r(bx + 18, py + 6, 7, 2, C.ink);
  r(bx + 10, py + 18, 13, 5, '#401040');
  for (let i = 0; i < 4; i++) r(bx + 11 + i * 3, py + 18, 2, 2, C.white);
  const swap = Math.floor(frame / 6) % 2 === 0;
  r(bx + (swap ? 1 : 3), py + 28, 10, 4, dark);
  r(bx + (swap ? 21 : 19), py + 28, 10, 4, dark);
  bossRank(r, bx, py, variant);

  /*
   * Hands last, so they close over the sceptre they are supposed to be holding.
   *
   * White, not body-coloured. Their whole job is to be seen carrying the crown
   * on the frames before it can hurt anybody, and a hand the same colour as the
   * arm it is on disappears at exactly the distance this is read from.
   */
  const hy = handY(py, pose);
  for (const hx of [bx + 2, bx + 24]) {
    r(hx, hy, 6, 6, '#e8e0c0');
    r(hx, hy + 4, 6, 2, '#a89878');
    r(hx + 1, hy + 1, 4, 2, C.white);
  }
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
