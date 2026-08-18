/**
 * Everything the player collects, throws or leaves behind, plus the two props
 * the level itself draws.
 *
 * The goal card is here rather than with the level artwork because it is drawn
 * by `drawItem` — the card in the flag is literally the pickup at rest, and the
 * two have to keep matching or the flag starts promising something it does not
 * hand over.
 */

import { recolored, glowing, GLOWS } from './palette.js';
import { breath } from './enemies.js';

/* ---------------------------- how a pickup is built --------------------- */

/**
 * The seven pickups are drawn to one shape rule, and it is worth stating once
 * here rather than seven times below, because every one of them is bent around
 * it and none of it is decoration.
 *
 * **The 16x16 box is the contract.** `Item` in entities/items.js is 16 wide and
 * 16 tall, and that box is the *only* thing the player actually touches. Two
 * different lies used to live in the gap between the box and the drawing: art
 * outside it (visible, uncollectable, and — because the goal card's frame is
 * exactly 16 wide — spilling over the edge of the card as well), and bands of
 * box with nothing drawn on them (invisible, collected off thin air). So every
 * pickup here paints inside the box, touches all sixteen rows and all sixteen
 * columns, and fills at least 40 % of it on every frame of its cycle.
 *
 * **Which power it is has to survive at 16 px, across a screen, in eight
 * themes.** That splits into two rules the shapes are actually designed to:
 *
 *   - *Shape and colour carry it together, and the split between them is not
 *     an article of faith.* The first version of this file assumed silhouette
 *     did all the work and colour only helped. The game's own artwork says
 *     otherwise: measured inside this same box, the walker and the flyer share
 *     98 % of their silhouette and the walker and the kurnuttaja 88 %, and
 *     nobody has ever confused a kurnuttaja for a walker, because it is
 *     turquoise and nothing else in this game is. So `verify.mjs` measures the
 *     two together — how much of the box actually *looks* different — and each
 *     pickup here is given a shape of its own anyway (a standing sac on three
 *     rootlets, a top-heavy teardrop with a tail, a lopsided funnel, a pair of
 *     offset wings, a wide vessel with a handle sticking out of it, a leaning
 *     kidney, a four-pointed flare) *and* a hue no other pickup uses.
 *   - *Every one of them carries both a dark mass and a pale mass.* No single
 *     colour can stand out from both the fortress's near-black sky and the
 *     cloud world's near-white ground, so each pickup has a dark rim or
 *     underside for the pale themes and a bright core for the dark ones. That
 *     is why the rim is drawn as a shape one pixel larger and not as an
 *     `outlined()` pass: `outlined` paints a pixel *outside* the silhouette,
 *     which for a sprite that fills its box means a pixel outside the box.
 *
 * **They breathe on the shared clock.** Everything alive in this game moves one
 * pixel on `breath` (see sprites/enemies.js), and a pickup that stood
 * dead still among all of it read as a pasted-on icon rather than as a thing
 * lying there. The shape rule above is what makes that awkward and therefore
 * what makes it consistent: if the top row and the bottom row both have to stay
 * covered, the body cannot simply be translated. So every pickup is built as
 * **a nailed crown, a body that rides the breath, and a foot that stretches to
 * absorb it** — exactly the construction the walker uses, for exactly the same
 * reason.
 */

/** Fills a row table: one integer rectangle per row, `[x, width]` from the top. */
function paintRows(ctx, x, y, rows) {
  for (let i = 0; i < rows.length; i++) {
    const [rx, rw] = rows[i];
    if (rw > 0) ctx.fillRect(x + rx, y + i, rw, 1);
  }
}

/**
 * The same shape, one pixel in from every edge.
 *
 * Every pickup is painted twice: once dark from its own table, then once in its
 * real colours from this. That leaves a one pixel dark rim all the way round
 * without a single hand-placed rectangle, which matters because the rim is a
 * legibility requirement (see above) and a hand-drawn one drifts the moment a
 * row of the table is nudged.
 */
function erode(rows) {
  return rows.map(([rx, rw], i) => {
    const up = rows[i - 1];
    const down = rows[i + 1];
    if (!up || !down || rw <= 2) return [rx, 0];
    const x0 = Math.max(rx, up[0], down[0]) + 1;
    const x1 = Math.min(rx + rw, up[0] + up[1], down[0] + down[1]) - 1;
    return [x0, Math.max(0, x1 - x0)];
  });
}

/**
 * PIERUSIENI. A puffball, and specifically not a capped mushroom.
 *
 * A puffball (*Lycoperdon*, and the Latin is literally "wolf fart") is a fungus
 * that is nothing but a bag of spores with a hole in the top, and squeezing one
 * makes it blow a cloud out of that hole. That is the entire power-up in one
 * object: this is the item that gives the player their extra jumps, and every
 * one of those jumps is a puff out of a vent.
 *
 * So there is no cap, no brim and no pale stalk with a face on it. The widest
 * part of it is the **body** rather than an overhanging edge, which is the one
 * silhouette difference a player reads instantly at this size; it is pale
 * because a puffball is pale; and it is speckled with dark **pores** rather
 * than pale spots — spots sit on top of a cap, pores are holes in a sac, and
 * the difference between the two is the difference between decoration and an
 * explanation of what the thing does.
 */
const SAC = [
  [4, 8], [3, 10], [2, 12], [2, 12], [2, 12],
  [2, 12], [2, 12], [3, 10], [4, 8], [5, 6],
];
const SAC_CORE = erode(SAC);

/*
 * VARAPALLO — poistettu 10.8.2026, ja se kannattaa lukea ennen kuin sitä
 * piirretään takaisin.
 *
 * Tässä oli solmittu ilmapallo: oma muotonsa, oma kuvionsa, oma perustelunsa.
 * Se ei ollut huono piirros. Se oli piirros esineelle **jota mikään pelissä ei
 * koskaan tuottanut** — ei yksikään kentän ruutu, ei yksikään lohko, ei
 * yksikään vihollinen, ei generaattori. `Item`illa oli sille liikemalli,
 * `Player`illa poimintahaara, portilla neljä mittausta ja tällä tiedostolla
 * kuva; ainoa mitä puuttui oli se että pelaaja olisi voinut nähdä sen.
 *
 * Poisto eikä koti, ja perustelu on se että kotia ei ollut mistä ottaa:
 *
 *   - **Tehostuslohkoon se ei sovi.** DESIGN.md kohta 5 lupaa perustehostuksen
 *     lähelle jokaisen kentän alkua. Lohko joka arpoo lisäelämän on lohko joka
 *     ei antanut tehostusta — rangaistus palkinnon muodossa.
 *   - **Salatiileen se sopisi muodoltaan mutta ei määrältään.** `brickSecret`
 *     on paikan funktio, eli salaisuus jonka voi opetella ja näyttää
 *     kaverille — oikea muoto löydettävälle palkinnolle. Mutta koko pelissä on
 *     186 tiiltä, ja luvut on kalibroitu niin että niistä 23 on kolikkotiiltä
 *     ja **6** tehostustiiltä. Tehostustiiltä harvinaisempi varapallo on yksi
 *     tai kaksi kappaletta kuudessakymmenessä kentässä; yleisempi ohittaisi
 *     tehostustiilen, mikä on väärin päin.
 *   - **Kolmatta lähdettä ei kaivattu.** Lisäelämän saa jo sadasta kolikosta ja
 *     maalitangon kolmesta kortista. Molemmat ovat *kertymiä*, molemmat on
 *     viritetty, eikä kukaan ollut päättänyt mitä kolmas tekisi elämätaloudelle.
 *     ROADMAP.md sanoo saman asian omin sanoin haarautuvien reittien kohdalla:
 *     "lisäelämä on laimea".
 *
 * Sama peruste jolla `bone_twin` ja `fort_blocks` lähtivät: **palikka jota
 * kukaan ei saa asettaa on huonompi kuin ei palikkaa.** Ääni (`Sfx.oneup`) jäi,
 * koska se soi yhä sadan kolikon ja korttipotin kohdalla; kuva ja poimittava
 * esine lähtivät, koska ne eivät soineet kenellekään.
 */

/**
 * PAUKKUPAPU. The bean, kept — it was already this game's own shape and the
 * argument for it has not changed: it is the one power-up that does not come
 * out of a block, so a player who reads it as the usual thing will not know
 * what changed about them. Squat, dark, split along one seam.
 *
 * What did change is that it now fills its box, that it leans harder — the
 * shell is widest low and to the left, so the whole thing is a diagonal rather
 * than one more centred lump — and that the seam shows **flesh** and not only a
 * translucent glow. The glow was the only thing on it that stood out from
 * anything, and being translucent it vanished against a dark background exactly
 * when the shell did: four pixels of this sprite were distinguishable from the
 * night world's ground.
 */
const BEAN = [
  [7, 6], [5, 9], [4, 11], [3, 13], [2, 14], [1, 15],
  [0, 15], [0, 14], [0, 12], [1, 10], [3, 8], [5, 5],
];
const BEAN_CORE = erode(BEAN);

/**
 * VIRVATULI, the brief invincibility: swamp gas catching fire.
 *
 * The convention is free and stays — a pickup that makes you untouchable for a
 * few seconds, bouncing around so you have to chase it. The drawing is not the
 * convention. A will-o'-the-wisp is marsh gas igniting over a bog, it is the
 * one thing in Finnish folklore that is made of exactly what this game is made
 * of, and it explains the halo this sprite has always had better than anything
 * else could: it is the only pickup in the game that is a light source.
 *
 * Four points and not five, and blunt ones: **spines mean a body cannot be
 * stomped** everywhere else in this game (`drawSpines`), so a pickup with sharp
 * radiating points would be reading the player the wrong signal at the one
 * moment they are being invited to run at something.
 *
 * **It is blue, and the blue is the physics.** Methane burns blue — a marsh
 * light is a cold pale flame, not a yellow one — so the one colour this game
 * had not used anywhere is also the correct colour for the one object in it
 * that is burning gas. It was drawn gold first, and the measurement is what
 * killed that: cream, bone, gold and pale yellow are all within a fifth of each
 * other, so a gold flare and the pale puffball were only 37 % of a box apart
 * and a player would have had to read the shape to tell a power-up from
 * invincibility. Blue is nothing else's colour here — the same argument the
 * kurnuttaja's turquoise is made from (sprites/enemies.js).
 */
const WISP = [
  [6, 4], [6, 4], [5, 6], [5, 6], [3, 10], [0, 16],
  [0, 16], [3, 10], [5, 6], [5, 6], [6, 4], [6, 4],
];
const WISP_CORE = erode(WISP);

/** @param {object} [opts] { tint } */
export function drawItem(ctx, kind, x, y, tick, opts) {
  if (opts && opts.tint) {
    drawItem(recolored(ctx, opts.tint), kind, x, y, tick);
    return;
  }
  const px = Math.round(x);
  const py = Math.round(y);
  // One game, one breath: the same function and the same 163-frame cycle the
  // walkers and the player run on, offset by position so a shelf of pickups
  // does not pulse as one body.
  const b = breath(tick, px, py);

  if (kind === 'shroom') {
    // The vent is the crown: nailed to the top row, and lit from the inside so
    // that the one part of the sprite that explains the power is also the part
    // that survives being small.
    ctx.fillStyle = '#6e2e10';
    ctx.fillRect(px + 5, py, 6, 3);
    ctx.fillStyle = '#3a1a0c';
    ctx.fillRect(px + 6, py, 4, 2);
    ctx.fillStyle = '#a8e04a';
    ctx.fillRect(px + 6, py + 1, 4, 1);
    ctx.fillStyle = '#d8ff90';
    ctx.fillRect(px + 7, py + 1, 2, 1);

    const t = py + 3 - b;
    ctx.fillStyle = '#6e2e10';
    paintRows(ctx, px, t, SAC);
    ctx.fillStyle = '#f0dcb4';
    paintRows(ctx, px, t, SAC_CORE);
    // The sac's underside, so it reads as a bag hanging under its own weight
    // rather than as a flat disc.
    ctx.fillStyle = '#c8a074';
    ctx.fillRect(px + 3, t + 8, 10, 1);
    ctx.fillRect(px + 4, t + 9, 8, 1);
    // Pores. Not spots: holes, scattered off the grid so they do not line up
    // into a pattern the eye reads as a face.
    ctx.fillStyle = '#7a3a1c';
    ctx.fillRect(px + 4, t + 3, 2, 1);
    ctx.fillRect(px + 9, t + 2, 1, 2);
    ctx.fillRect(px + 11, t + 5, 2, 1);
    ctx.fillRect(px + 3, t + 6, 1, 2);
    ctx.fillRect(px + 8, t + 6, 2, 1);
    ctx.fillRect(px + 6, t + 4, 1, 1);

    /*
     * Rootlets, and they are the foot: nailed to the bottom row and stretching
     * by the pixel the sac rises. Three thin ones rather than two thick ones,
     * because two legs under a body is a creature — the first version of this
     * had a pair of stumps and read as something standing there looking at you,
     * which is the one thing a pickup must not do.
     *
     * They also reach the two bottom corners, and that is why the sac itself is
     * only twelve pixels across. Something has to touch every column of the box
     * (see the note at the top of the file); doing it with the roots instead of
     * the body leaves the sac a narrow standing shape rather than one more
     * 16-wide blob, and the pot two functions down is 16 wide at its rim — two
     * bulges of the same width in the same rows are two pickups a player has to
     * read the colour of.
     */
    ctx.fillStyle = '#6e2e10';
    ctx.fillRect(px + 2, py + 13 - b, 2, 1 + b);
    ctx.fillRect(px + 7, py + 13 - b, 2, 1 + b);
    ctx.fillRect(px + 12, py + 13 - b, 2, 1 + b);
    ctx.fillRect(px, py + 14, 3, 2);
    ctx.fillRect(px + 6, py + 14, 4, 2);
    ctx.fillRect(px + 13, py + 14, 3, 2);
    ctx.fillStyle = '#8c5c28';
    ctx.fillRect(px, py + 14, 2, 1);
    ctx.fillRect(px + 7, py + 14, 2, 1);
    ctx.fillRect(px + 14, py + 14, 2, 1);

    // The puff, translucent because it is vapour and not the thing you touch —
    // which is also why it is allowed to leave the box.
    const jet = 0.3 + 0.3 * Math.sin(tick / 6);
    ctx.fillStyle = `rgba(168,224,74,${jet})`;
    ctx.fillRect(px + 6, py - 2 - Math.floor(jet * 4), 4, 3);
    return;
  }

  if (kind === 'soup') {
    /*
     * HERNEKEITTO, and the pot is new even though the soup was always ours.
     *
     * The old drawing was a shallow white bowl, which failed the box twice
     * over: eight of the sixteen rows had nothing on them, and against a pale
     * sky the crockery was the sky. A pot is taller, so it fills the box; it is
     * darker, so it survives the cloud world; and the ladle standing in it is
     * both the thing that nails the top row of the box and the fastest way of
     * saying *food* at this size.
     *
     * Everything above the foot rides the breath, so the whole pot heaves like
     * something on a stove rather than sitting there being an icon.
     */
    ctx.fillStyle = '#5a3a12';
    ctx.fillRect(px + 10, py, 2, 3);
    ctx.fillRect(px + 9, py + 3, 2, 2);
    ctx.fillRect(px + 8, py + 5, 2, 2);
    ctx.fillStyle = '#9c6a28';
    ctx.fillRect(px + 10, py, 1, 3);
    ctx.fillRect(px + 9, py + 3, 1, 2);
    ctx.fillRect(px + 8, py + 5, 1, 2);

    // the heap of soup standing above the rim, and the pea skins on it
    ctx.fillStyle = '#4c7a1c';
    ctx.fillRect(px + 4, py + 5 - b, 8, 1);
    ctx.fillRect(px + 2, py + 6 - b, 12, 2);
    ctx.fillStyle = '#6a9c2a';
    ctx.fillRect(px + 3, py + 6 - b, 10, 1);
    ctx.fillStyle = '#8fc03a';
    ctx.fillRect(px + 5, py + 5 - b, 4, 1);
    ctx.fillRect(px + 10, py + 6 - b, 2, 1);

    // the rim, which is the widest thing on the sprite and covers every column
    ctx.fillStyle = '#22243a';
    ctx.fillRect(px, py + 7 - b, 16, 2);
    ctx.fillStyle = '#b0b4c8';
    ctx.fillRect(px, py + 7 - b, 16, 1);

    // the pot itself, tapering, with a dark band round it so there is a big
    // dark mass on a sprite that is otherwise pale steel
    ctx.fillStyle = '#22243a';
    paintRows(ctx, px, py + 9 - b, [[1, 14], [1, 14], [1, 14], [2, 12], [3, 10]]);
    ctx.fillStyle = '#b0b4c8';
    paintRows(ctx, px, py + 9 - b, [[2, 12], [2, 12], [2, 12], [3, 10], [0, 0]]);
    ctx.fillStyle = '#1f6f26';
    ctx.fillRect(px + 2, py + 10 - b, 12, 2);
    ctx.fillStyle = '#8fc03a';
    ctx.fillRect(px + 6, py + 10 - b, 4, 1);
    ctx.fillStyle = '#e8ecf8';
    ctx.fillRect(px + 3, py + 9 - b, 2, 1);

    ctx.fillStyle = '#22243a';
    ctx.fillRect(px + 3, py + 14 - b, 10, 2 + b);
    ctx.fillStyle = '#6a6e88';
    ctx.fillRect(px + 4, py + 14 - b, 8, 1);

    // steam, translucent for the same reason the puffball's puff is
    const s = Math.floor(tick / 8) % 3;
    ctx.fillStyle = 'rgba(200,240,160,0.75)';
    ctx.fillRect(px + 3 + s, py + 2, 2, 3);
    ctx.fillRect(px + 6 - s, py, 2, 4);
    return;
  }

  if (kind === 'flower') {
    /*
     * PIERUKUKKA, and it is a trumpet: a bloom shaped like the bell of a horn,
     * leaning off to one side on a bent stem with a gas bladder at its foot.
     *
     * The power it gives is the only one in the game that leaves the player's
     * body — you throw it — so the pickup is built round an opening that points
     * somewhere. It is deliberately lopsided, and that is measurable rather
     * than decorative: it is the most different pickup in the set from every
     * other one (65–72 % of the box, against a 40 % floor, where the next best
     * is the pot at 52–72 %), because leaning is the cheapest thing a shape can
     * do that a standing shape cannot copy.
     *
     * It has no eyes. Eyes belong to the things that walk at the player
     * (sprites/enemies.js), and a pickup that looks back is a pickup a player
     * hesitates over for a tenth of a second — which is the entire budget.
     */
    const flare = Math.floor(tick / 8) % 2;
    /*
     * The bell, nailed to the top of the box and tipped so the mouth faces up
     * and to the right. It is drawn as three things and the order matters: the
     * dark ring of the rim, the pink lip on the far side of it, and then the
     * hole, which is painted last and darkest so that the widest part of the
     * sprite is an *opening* and not a lid. A trumpet the player cannot see
     * into is a hat.
     */
    ctx.fillStyle = '#58184a';
    paintRows(ctx, px, py, [[4, 12], [3, 13], [3, 12], [4, 10]]);
    ctx.fillStyle = '#d8409c';
    ctx.fillRect(px + 4, py, 12, 1);
    ctx.fillRect(px + 3, py + 1, 2, 2);
    ctx.fillRect(px + 14, py + 1, 2, 2);
    ctx.fillStyle = '#ffa8d8';
    ctx.fillRect(px + 6, py, 5, 1);
    // the hole, and the gas already gathering in it
    ctx.fillStyle = '#3a0c30';
    ctx.fillRect(px + 6, py + 1, 8, 2);
    ctx.fillStyle = flare ? '#a8e04a' : '#8cc038';
    ctx.fillRect(px + 7, py + 1, 6, 1);
    ctx.fillStyle = '#f4ffd0';
    ctx.fillRect(px + 9, py + 1, 2, 1);

    // the throat of the bell, riding the breath
    ctx.fillStyle = '#58184a';
    paintRows(ctx, px, py + 4 - b, [[4, 10], [4, 9], [4, 7], [4, 6], [4, 5]]);
    ctx.fillStyle = '#d8409c';
    paintRows(ctx, px, py + 4 - b, [[5, 8], [5, 7], [5, 5], [5, 4], [5, 3]]);
    ctx.fillStyle = '#ffa8d8';
    ctx.fillRect(px + 5, py + 4 - b, 4, 1);
    ctx.fillRect(px + 5, py + 5 - b, 3, 1);
    ctx.fillRect(px + 5, py + 6 - b, 2, 1);
    // the stem
    ctx.fillStyle = '#1f6f26';
    ctx.fillRect(px + 4, py + 9 - b, 4, 2);
    ctx.fillStyle = '#3ea23a';
    ctx.fillRect(px + 5, py + 9 - b, 2, 2);

    /*
     * The bladder and one leaf, and they ride the breath with everything above
     * them rather than staying put.
     *
     * They used to be nailed and only the cone moved, which measured at *minus*
     * 0.05 px of lift — the stem stretching downwards to reach them was adding
     * more weight at the bottom than the cone was taking off the top, so the
     * bloom's centre of mass drifted the wrong way and the sprite read as
     * sagging on the inhale. The tap root below is what is nailed now, and it
     * is one rectangle.
     */
    ctx.fillStyle = '#1f6f26';
    paintRows(ctx, px, py + 11 - b, [[1, 8], [0, 10], [0, 10], [1, 8]]);
    ctx.fillStyle = '#3ea23a';
    paintRows(ctx, px, py + 11 - b, [[2, 6], [1, 8], [1, 8], [0, 0]]);
    ctx.fillStyle = '#8fe04a';
    ctx.fillRect(px + 2, py + 12 - b, 3, 1);
    ctx.fillRect(px + 1, py + 13 - b, 2, 1);
    ctx.fillStyle = '#1f6f26';
    ctx.fillRect(px + 10, py + 11 - b, 6, 1);
    ctx.fillRect(px + 11, py + 12 - b, 5, 1);
    ctx.fillRect(px + 12, py + 13 - b, 4, 1);
    ctx.fillStyle = '#3ea23a';
    ctx.fillRect(px + 11, py + 11 - b, 4, 1);
    ctx.fillRect(px + 12, py + 12 - b, 3, 1);

    ctx.fillStyle = '#1f6f26';
    ctx.fillRect(px + 7, py + 15 - b, 2, 1 + b);
    return;
  }

  if (kind === 'leaf') {
    /*
     * KAASULEHTI: two leaflets on one stalk, which is what a bean plant's leaf
     * actually looks like — and this game is already full of beans (the
     * beanstalk, the paukkupapu, the papuparooni), so the leaf that carries the
     * player into the air comes off the same plant as everything else.
     *
     * Two lobes rather than one, because the power it gives is flight and a
     * pair of anything reads as wings. The two sit three rows apart, which is
     * doing two jobs at once: a level pair reads as a butterfly pinned to a
     * card, and — measured — a level pair is also a single centred blob that
     * shares three quarters of its area with the pot and with the bean. The
     * offset turns the whole sprite into a diagonal, which is the one
     * arrangement none of the others use.
     *
     * The old drawing was a single tan blade with a curled stalk, which is the
     * shape this genre has used for a flying power-up since 1988; it was also,
     * measured, invisible against desert sand. This one is green going amber at
     * the tips with a pale swollen vein down each lobe: a leaf full of gas.
     */
    ctx.fillStyle = '#16300a';
    ctx.fillRect(px + 7, py, 3, 4);
    ctx.fillStyle = '#8cc038';
    ctx.fillRect(px + 8, py + 1, 1, 3);

    /*
     * Each lobe is a lens rather than a fan, so it only meets the stalk over
     * its middle rows and the notch between the two is visible as a notch. The
     * first version had both lobes running the full height of the stalk and the
     * pair merged into one bush; the gap is what makes it two of something.
     */
    const left = [[3, 5], [1, 7], [0, 8], [0, 8], [0, 8], [0, 8], [1, 7], [3, 5], [5, 3]];
    const right = [[8, 5], [8, 7], [8, 8], [8, 8], [8, 8], [8, 8], [8, 7], [8, 5], [8, 3]];
    ctx.fillStyle = '#16300a';
    ctx.fillRect(px + 7, py + 3 - b, 2, 12 + b);
    paintRows(ctx, px, py + 3 - b, left);
    paintRows(ctx, px, py + 6 - b, right);
    // The far lobe is a shade darker than the near one. One flat green over
    // both of them is a single leaf with a line drawn on it.
    ctx.fillStyle = '#74a028';
    paintRows(ctx, px, py + 3 - b, erode(left));
    ctx.fillStyle = '#8cc038';
    paintRows(ctx, px, py + 6 - b, erode(right));
    // the tips go amber, which is the only warm colour on it and the reason it
    // does not disappear into a green hill
    ctx.fillStyle = '#e0a838';
    ctx.fillRect(px + 1, py + 6 - b, 2, 2);
    ctx.fillRect(px + 13, py + 9 - b, 2, 2);
    // one swollen vein per lobe, pale, running out from the stalk
    ctx.fillStyle = '#d8e878';
    ctx.fillRect(px + 3, py + 6 - b, 3, 1);
    ctx.fillRect(px + 2, py + 7 - b, 3, 1);
    ctx.fillRect(px + 10, py + 10 - b, 3, 1);
    ctx.fillRect(px + 11, py + 11 - b, 3, 1);

    // the stalk's foot, which is what the box's bottom row is made of
    ctx.fillStyle = '#16300a';
    ctx.fillRect(px + 6, py + 15 - b, 4, 1 + b);
    return;
  }

  if (kind === 'pop') {
    const beat = 0.5 + 0.5 * Math.sin(tick / 5);
    // the sprout scar, nailed to the top row, showing the same flesh as the split
    const t = py + 2 - b;
    ctx.fillStyle = '#3c1a0c';
    ctx.fillRect(px + 6, py, 4, 3);
    ctx.fillStyle = '#b8e030';
    ctx.fillRect(px + 7, py + 1, 3, 2);

    ctx.fillStyle = '#3c1a0c';
    paintRows(ctx, px, t, BEAN);
    ctx.fillStyle = '#8c3c1c';
    paintRows(ctx, px, t, BEAN_CORE);
    ctx.fillStyle = '#d87c34';
    ctx.fillRect(px + 5, t + 2, 6, 2);
    ctx.fillRect(px + 2, t + 4, 4, 1);
    /*
     * The split, and the flesh inside it.
     *
     * It used to be a translucent glow and nothing else, which meant the whole
     * bean was four shades of the same brown: measured against the night
     * world's ground, four pixels of this sprite were distinguishable from the
     * floor it was lying on. Flesh is opaque and wide enough to be the thing
     * the eye lands on, and it is also simply what a split bean shows.
     *
     * It is green rather than cream, and that is a measurement too: cream flesh
     * put the bean within a fifth of the puffball's whole body, so the two were
     * only 43 % of a box apart. A broad bean is green inside, this one is full
     * of gas, and the game's own gas is that colour everywhere else.
     */
    ctx.fillStyle = '#b8e030';
    for (let i = 0; i < 8; i++) ctx.fillRect(px + 2 + i, t + 8 - i, 5, 1);
    ctx.fillStyle = '#e8ff90';
    for (let i = 0; i < 8; i++) ctx.fillRect(px + 4 + i, t + 8 - i, 2, 1);
    // and the gas coming out of it, which is the only thing that pulses
    ctx.fillStyle = `rgba(168,224,74,${0.35 + 0.45 * beat})`;
    for (let i = 0; i < 8; i++) ctx.fillRect(px + 3 + i, t + 10 - i, 2, 1);
    ctx.fillStyle = `rgba(244,255,208,${0.3 + 0.5 * beat})`;
    ctx.fillRect(px + 11, py - 1 - Math.floor(beat * 3), 3, 2);

    // the split lip, nailed to the floor of the box and stretching for the breath
    ctx.fillStyle = '#3c1a0c';
    ctx.fillRect(px + 5, py + 14 - b, 8, 2 + b);
    ctx.fillStyle = '#8c3c1c';
    ctx.fillRect(px + 6, py + 14 - b, 6, 1);
    return;
  }

  if (kind === 'star') {
    // The one pickup that is literally a light source, so it gets the halo.
    glowing(ctx, px + 8, py + 8, GLOWS.star, (g) => {
      const lit = Math.floor(tick / 4) % 2;
      // the two blunt points that nail the top and bottom rows of the box
      g.fillStyle = '#14385c';
      g.fillRect(px + 6, py, 4, 2);
      g.fillRect(px + 6, py + 14 - b, 4, 2 + b);
      g.fillStyle = '#3a86c8';
      g.fillRect(px + 7, py, 2, 2);
      g.fillRect(px + 7, py + 14 - b, 2, 2 + b);

      const t = py + 2 - b;
      g.fillStyle = '#14385c';
      paintRows(g, px, t, WISP);
      g.fillStyle = '#3a86c8';
      paintRows(g, px, t, WISP_CORE);
      // paler towards the middle and white at the very centre: a flame is
      // hottest in its heart, and the heart is the part that blinks
      g.fillStyle = '#8ccaf8';
      g.fillRect(px + 3, t + 4, 10, 4);
      g.fillRect(px + 6, t + 2, 4, 8);
      g.fillStyle = lit ? '#ffffff' : '#d8f0ff';
      g.fillRect(px + 6, t + 5, 4, 2);
      g.fillRect(px + 7, t + 4, 2, 4);
    });
  }
}

/**
 * The bean on its way down, and the growing tip of the stalk afterwards.
 *
 * It is emphatically **not** the paukkupapu (`drawItem('pop')`), and the
 * difference is the whole reason it is a sprite of its own rather than that one
 * reused. The paukkupapu is a squat brown shell with a glowing seam and it is a
 * power-up you pick up; this is a pale green seed that plants itself and then
 * climbs, and it cannot be touched at any point. Two things that come out of a
 * `?` block and look alike teach the player one wrong lesson each — DESIGN.md
 * §8.
 *
 * `bare` is the falling half: just the seed, tumbling, with nothing under it
 * yet. Once it lands the same sprite grows a shoot and the seed rides the tip
 * of it, so the thing the player followed down is the thing they follow back
 * up. The greens are the vine's own (`drawVine` in gfx/tiles.js), because in
 * one more frame this is a vine.
 */
export function drawSprout(ctx, x, y, tick, bare = false) {
  const px = Math.round(x);
  const py = Math.round(y);

  if (bare) {
    // tumbling, so the seed leans a different way every few frames
    const lean = Math.floor(tick / 4) % 2;
    ctx.fillStyle = '#4c7a1c';
    ctx.fillRect(px + 5, py + 5, 6, 7);
    ctx.fillStyle = '#8fc03a';
    ctx.fillRect(px + 6, py + 5, 4, 6);
    ctx.fillStyle = '#c8e04a';
    ctx.fillRect(px + 6 + lean, py + 6, 2, 3);
    ctx.fillStyle = '#f4ffd0';
    ctx.fillRect(px + 7 + lean, py + 6, 1, 1);
    return;
  }

  const curl = Math.round(Math.sin(tick / 5) * 2);

  // the stem, still short — it fills the bottom of the tile and no more
  ctx.fillStyle = '#1c6b1f';
  ctx.fillRect(px + 5, py + 6, 6, 10);
  ctx.fillStyle = '#3ea23a';
  ctx.fillRect(px + 6, py + 5, 4, 11);
  ctx.fillStyle = '#8fe04a';
  ctx.fillRect(px + 6, py + 6, 1, 10);

  // the tip, curling over the top of what is not there yet
  ctx.fillStyle = '#3ea23a';
  ctx.fillRect(px + 6, py + 2, 4, 4);
  ctx.fillRect(px + 8, py + 1, 3 + curl, 2);
  ctx.fillStyle = '#8fe04a';
  ctx.fillRect(px + 7, py + 3, 2, 2);
  ctx.fillRect(px + 9, py + 1, 1 + Math.max(0, curl), 1);

  // two young leaves, one either side, opening as the tip turns
  ctx.fillStyle = '#3ea23a';
  ctx.fillRect(px + 1 + curl, py + 8, 5, 3);
  ctx.fillRect(px + 10 - curl, py + 11, 5, 3);
  ctx.fillStyle = '#8fe04a';
  ctx.fillRect(px + 2 + curl, py + 8, 3, 1);
  ctx.fillRect(px + 11 - curl, py + 11, 3, 1);

  // and the seed itself, riding along until the stalk is done with it
  ctx.fillStyle = '#c8e04a';
  ctx.fillRect(px + 10, py + 6, 3, 4);
  ctx.fillStyle = '#f4ffd0';
  ctx.fillRect(px + 11, py + 7, 1, 2);
}

/** @param {object} [opts] { tint, glow } */
export function drawFart(ctx, x, y, tick, opts) {
  const px = Math.round(x);
  const py = Math.round(y);
  const p = Math.floor(tick / 4) % 2;
  const tint = opts && opts.tint;
  /*
   * Opaque, outlined and bright in the middle.
   *
   * It used to be a translucent green blob, and against grass, a green hill or
   * the factory's haze it simply disappeared — an 8x8 sprite has no room to be
   * subtle. The dark rim is the same trick the characters use (`outlined`): it
   * is what makes a small sprite survive a busy background, and it costs four
   * rectangles.
   */
  const body = (surface) => {
    const g = recolored(surface, tint);
    g.fillStyle = '#14300a';
    g.fillRect(px, py + 1, 8, 6);
    g.fillRect(px + 1, py, 6, 8);
    g.fillStyle = '#5ca81e';
    g.fillRect(px + 1, py + 1, 6, 6);
    g.fillStyle = '#a8e04a';
    g.fillRect(px + 1, py + 2, 5, 4);
    g.fillRect(px + 2, py + 1, 4, 6);
    g.fillStyle = '#f4ffd0';
    g.fillRect(px + 2 + p, py + 2, 2, 2);
  };
  if (opts && opts.glow) glowing(ctx, px + 4, py + 4, opts.glow, body);
  else body(ctx);
}

export function drawGasPuff(ctx, x, y, life, size, brown) {
  const a = Math.max(0, Math.min(1, life));
  ctx.fillStyle = brown ? `rgba(150,110,60,${0.5 * a})` : `rgba(150,220,90,${0.5 * a})`;
  const s = Math.round(size);
  ctx.fillRect(Math.round(x) - s, Math.round(y) - s, s * 2, s * 2);
  ctx.fillStyle = brown ? `rgba(200,160,100,${0.4 * a})` : `rgba(210,255,150,${0.4 * a})`;
  ctx.fillRect(Math.round(x) - s + 1, Math.round(y) - s + 1, s, s);
}

/* ------------------------------ level props ---------------------------- */

/**
 * The three faces of the goal card.
 *
 * The list is unchanged and deliberately so: which three pickups the roulette
 * shows is a rule the level scene reads too (`completeLevel` in
 * scenes/level.js), and the three of them being the growing one, the shooting
 * one and the invincible one is a *mechanic*, which DESIGN.md §2 says is not
 * anybody's to own. What was borrowed about this card was never the list — it
 * was the three drawings on it, and those are now this game's own.
 */
export const CARD_ICONS = ['shroom', 'flower', 'star'];

export function drawGoal(ctx, x, y, height, cardIndex, held) {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = '#c8c8d8';
  ctx.fillRect(px + 6, py, 4, height);
  ctx.fillStyle = '#8a8aa0';
  ctx.fillRect(px + 9, py, 1, height);
  ctx.fillStyle = '#f0f0ff';
  ctx.fillRect(px + 2, py - 4, 12, 4);
  if (!held) {
    /*
     * The card is 20x20 around a 16x16 pickup, and it grew from 16 to 20 the
     * day the pickups started filling their own boxes.
     *
     * A pickup is exactly 16 wide. A card that was also exactly 16 wide had the
     * picture painted over its own border, so the frame that makes it read as a
     * *card* disappeared the moment the artwork stopped being a small thing
     * floating in the middle of its box. Four pixels of margin is the same
     * relationship the HUD's reserve slot already has (`drawHud`,
     * scenes/level.js): a 20x20 well with the pickup inset by two.
     */
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(px - 2, py + 4, 20, 20);
    ctx.fillStyle = '#303048';
    ctx.fillRect(px - 2, py + 4, 20, 1);
    ctx.fillRect(px - 2, py + 23, 20, 1);
    ctx.fillRect(px - 2, py + 4, 1, 20);
    ctx.fillRect(px + 17, py + 4, 1, 20);
    drawItem(ctx, CARD_ICONS[cardIndex % 3], px, py + 6, 0);
  }
}

export function drawBrickShard(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), 6, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(Math.round(x), Math.round(y) + 4, 6, 2);
}

/** Elämäkolikon koko ruudulla, ja kuinka monta niistä piirretään yksitellen. */
export const LIFE_PIP = 5;
export const LIFE_PIPS = 5;

/**
 * ELÄMÄT PUNAISINA KOLIKOINA.
 *
 * Owner, 18.8.2026: *"red coins = lives"*. A life is minted by the coin tube
 * (`RED_COST` yellow ones leave and one red one arrives), so the counter for it
 * is the coin itself rather than `KV *4` — a label, a star and a digit standing
 * in for a thing the player owns. Drawn at the same size as the yellow coins in
 * the tube, so the exchange rate is a picture rather than a rule.
 *
 * Over `LIFE_PIPS` lives the row would run out of its corner — `verify.mjs`
 * measures that the readouts stay in the top corners — so the rest is a plus.
 * Same bargain as the tube's tenth-marks: the meter gives the magnitude and the
 * exact number lives where somebody needs it.
 */
export function drawLifeCoins(ctx, x, y, lives, shadow) {
  const shown = Math.max(0, Math.min(LIFE_PIPS, lives));
  for (let i = 0; i < shown; i++) {
    const cx = x + i * (LIFE_PIP + 2);
    /* The drop shadow the text beside these uses, and for the same reason: the
     * level HUD is drawn over whatever the level happens to be, and a dark
     * coin on a dark cave wall is a coin nobody can count. Callers that draw
     * on a known ground (the map panel, the game-over screen) pass null. */
    if (shadow) {
      ctx.fillStyle = shadow;
      ctx.fillRect(cx + 1, y + 1, LIFE_PIP, LIFE_PIP);
    }
    ctx.fillStyle = '#8c1414';
    ctx.fillRect(cx, y, LIFE_PIP, LIFE_PIP);
    ctx.fillStyle = '#d83030';
    ctx.fillRect(cx, y, LIFE_PIP - 1, LIFE_PIP - 1);
    ctx.fillStyle = '#ff8a8a';
    ctx.fillRect(cx + 1, y + 1, 1, LIFE_PIP - 3);
  }
  return { end: x + shown * (LIFE_PIP + 2), over: lives > LIFE_PIPS };
}
