import { Entity } from './entity.js';
import { moveX, moveY, applyGravity, footingAhead, GRAVITY } from '../level/physics.js';
/* The sand's own numbers. They are imported from the player rather than copied
 * because they are the *sand's* and not his: `QUICKSAND_SINK` is how fast this
 * tile pulls, full stop, and a walker that sank at its own private rate would
 * be teaching the player a second speed for the same picture. They live in
 * player.js because that is where they were first written and where the
 * paragraph explaining each of them still stands; there is nothing about them
 * that is about a Pieruprinssi. */
import { QUICKSAND_SINK, QUICKSAND_WADE, QUICKSAND_GRACE } from './player.js';
import {
  drawWalker, drawShell, drawFlyer, drawPlant, drawBoss, bossSize,
  drawStinkCloud, drawCorkGuy, drawHeartburn, drawAngrySun, drawSpikeGuy,
  drawBeanBaron, drawBeanBomb, drawBubble, bubbleRadius, recolored, TINTS,
  SUN_TRAIL_LIFE, drawKurnuttaja, drawCroak, BOSS_LIMBS,
  drawTorvi, drawTorahdys, drawPaarma, drawPisara, drawYokki, drawKarvapallo,
  drawPaukkupoho, drawPyorre, drawKummitus, drawKuura,
  drawKolikkovaras } from '../gfx/sprites.js';
import { TILE, T, surfaceOf, surfaceUnder } from '../gfx/tiles.js';
import { Sfx, bossSay, killSound } from '../core/audio.js';
import { approach, hashNoise } from '../core/utils.js';
import { Item } from './items.js';

/**
 * Kuinka kovaa tuuli saa kantaa. Sama luku kuin pelaajan kävelykatto
 * (`MAX_WALK` 1,5), ja se on tässä siksi että ilmassa `drift` ei vaimene
 * lainkaan: ilman kattoa 220 framen puuska kiihdyttäisi lentävän vihollisen
 * nopeammaksi kuin pelaaja koskaan juoksee, ja **tuuli kantaa, se ei sinkoa.**
 */
const DRIFT_MAX = 1.5;

/*
 * The bubble trap.
 *
 * Four seconds is long enough to cross most of a screen, jump, and come back
 * for the kill, and short enough that walking past a bubble is a decision with
 * a price rather than a free win. The last one and a bit of those seconds are
 * the warning: longer than the heartburn's beat of warning, because what comes
 * out of a bubble is not a flame you step around but an enemy you now have to
 * live with for the rest of the level.
 */
export const BUBBLE_FRAMES = 240;
const BUBBLE_WARN = 72;
/** How long a fresh bubble climbs before it just hangs there — see updateBubbled. */
const BUBBLE_CLIMB = 48;
/** What breaking out is worth to an enemy. Fast, but still slower than a walk. */
export const ANGRY_SPEED = 1.6;
/** And what popping one is worth to the player, or the trap is a nerf. */
const POP_BONUS = 2;

/**
 * The light an enemy is giving off this frame, in the shared-object idiom the
 * sprite styles already use: the draw loop copies the four numbers out of it
 * and forgets it, so one object serves every lit enemy in the level and no
 * light costs an allocation. Nothing may hold on to what `light()` returns.
 */
const LIGHT = { x: 0, y: 0, r: 0, i: 0 };
function light(x, y, r, i) {
  LIGHT.x = x;
  LIGHT.y = y;
  LIGHT.r = r;
  LIGHT.i = i;
  return LIGHT;
}

export class Enemy extends Entity {
  constructor(level, x, y, w, h) {
    super(level, x, y, w, h);
    this.kind = 'enemy';
    this.stompable = true;
    this.dying = false;
    this.score = 100;
    this.facing = -1;
    this.bubbleTimer = 0;
    this.angry = false;
    /* Frameja jäljellä siitä hetkestä jona pelaaja astui tämän kuplan päälle.
     * Tavallinen luku ja konstruktorissa, samasta syystä kuin `sunk` ja
     * `drift`: `savestate.js` sarjallistaa jokaisen olion jokaisen oman
     * kentän, joten kuplan päällä otettu pikatallennus palautuu kuplan päälle
     * eikä vaadi riviäkään tallennuskoodia. */
    this.carried = 0;
    /*
     * YKSILÖN OMA IHO, ja sama sääntö kuin laatoilla.
     *
     * Omistaja 18.8.2026: *"skin-vaihtelua voisi olla myös vihollisissa,
     * eikö?"* Kyllä — ja vihollisilla ehto on tiukempi kuin laatoilla, koska
     * niiden siluetista luetaan **tallattavuus**. Vaihtelu saa siis koskea vain
     * pintaa laatikon sisällä: tahra, ompeleen paikka, silmien väli. Ei kokoa,
     * ei ääriviivaa, ei väriä joka veisi kontrastin maata vasten (`verify.mjs`
     * mittaa molemmat).
     *
     * Siemen on **syntymäpaikka** eikä juokseva numero: sama otus samassa
     * kentässä näyttää samalta joka kerta, myös pikalatauksen jälkeen — ja
     * koska `savestate.js` tallentaa jokaisen oman kentän, tämä luku palautuu
     * ilman riviäkään tallennuskoodia.
     */
    this.skin = hashNoise(Math.round(x), Math.round(y));
    /* Frames with the whole body under the surface of a quicksand pool — the
     * same counter, the same name and the same units as the player's `sunk`,
     * and a plain number for the same reason his is one: `savestate.js`
     * serialises every own property of every entity, so a snapshot taken while
     * a walker is going under comes back with the walker still going under and
     * the same frames already spent. State parked on the scene, or a clever
     * derived value, would both have needed save code — and the version that
     * needs save code is the version somebody gets wrong. */
    this.sunk = 0;
    /* Ulkopuolinen sivuttaisvauhti: se osa liikkeestä joka ei ole tämän olion
     * omien jalkojen aikaansaamaa. Tuuli kirjoittaa tähän (laki 3), maa
     * vaimentaa sen (laki 1), ja ilmassa se ei vaimene lainkaan.
     *
     * Tavallinen luku eikä johdettu arvo, ja samasta syystä kuin `sunk` on
     * sellainen: `savestate.js` sarjallistaa jokaisen olion jokaisen oman
     * kentän, joten puuskan keskellä otettu pikatallennus palautuu puuskan
     * keskelle ilman riviäkään tallennuskoodia. */
    this.drift = 0;
  }

  /* ==================== MAASTO → OLIO: kaksi funktiota ====================
   *
   * ROADMAP 10.8.2026 veti rajan: **maasto → olio ja olio ↔ olio, ei olio →
   * maastoa.** Nämä kaksi ovat sen ensimmäinen puolisko, ja ne ovat `Enemy`n
   * eivätkä lajin omia täsmälleen samasta syystä kuin `quicksandSurface` on
   * `Entity`n: *maa ei tiedä mitä sen päällä seisoo*. Kaksi kopiota olisi
   * kaksi mahdollisuutta lukea sama sääntö eri tavalla.
   */

  /**
   * Se maa jonka päällä tämä keho seisoo, ks. `SURFACES`.
   *
   * Laatta ensin, teema vasta jos laatta ei sano mitään — ja **teema on yhä
   * tässä**, toisin kuin pelaajalla. Syy on mittaus eikä symmetria: nämä oliot
   * on mitattu jäämaailman `steer`in kanssa siitä asti kun taulu tuli
   * olemaan, ja koko maailma 3 on ajettu läpi sen ehdoilla. Teeman poistaminen
   * täältä muuttaisi kahdeksan kentän vihollisia ilman että kukaan pyysi;
   * pelaajalle sen *lisääminen* olisi tehnyt saman. Kummassakin tapauksessa
   * sääntö on sama: mitattu käytös ei muutu vahingossa.
   */
  get surface() { return surfaceUnder(this.level, this) || surfaceOf(this.level.theme); }

  /**
   * Laji kertoo mihin se pyrkii, maa kertoo kuinka nopeasti se pääsee siihen.
   *
   * Tavallisella maalla `steer` on 8 px/framea², eli enemmän kuin mikään
   * tavoite tässä pelissä on kaukana nykyisestä vauhdista — tulos on sama
   * sijoitus kuin ennen, framelleen. Jäällä se on 0,01, ja silloin kävelijä
   * tarvitsee 55 framea päästäkseen vauhtiinsa ja liukuu käännöksensä yli.
   *
   * Ilmassa vanha käytös sellaisenaan, ja se on päätös: hyppäävä vihollinen on
   * ilmassa suurimman osan ajastaan, ja jos ilma ei antaisi pitoa lainkaan,
   * seinään osunut lentäjä jäisi leijumaan paikalleen kaikissa kahdeksassa
   * maailmassa. Tuuli pääsee siitä huolimatta läpi, koska tuuli ei kulje
   * `vx`:n vaan `drift`in kautta.
   */
  steer(target) {
    if (!this.onGround) { this.vx = target; return; }
    this.vx = approach(this.vx, target, this.surface.steer);
  }

  /**
   * Kantaako tuuli tätä.
   *
   * Oletus on ei, ja se on ahdas tarkoituksella: `drift` on tallennettavaa
   * tilaa, ja tila jota kukaan ei koskaan kuluta on tilaa joka valehtelee
   * tallennuksessa. Ne neljä jotka sanovat kyllä ovat samat neljä jotka
   * kysyvät jalkojensa alta mitä ne voivat tehdä (`moveSideways`) — kävelijä,
   * kuori, lentäjä ja piikkiukko. Pomo, aurinko, kuu, kurnuttaja ja putkeen
   * pultattu nielu eivät ole tuulessa vaan kiinni jossakin, ja lista on yhden
   * rivin mittainen levennettäväksi jos joku joskus haluaa toisin.
   */
  get windborne() { return false; }

  /** Tuulen (tai minkä tahansa ulkopuolisen) työntö tälle framelle. */
  push(dv) {
    this.drift = Math.max(-DRIFT_MAX, Math.min(DRIFT_MAX, this.drift + dv));
  }

  /**
   * Yksi vaakasiirto, oma vauhti ja ulkopuolinen työntö yhdessä.
   *
   * `drift` on erillinen komponentti eikä `vx`:ään laskettu lisä, koska
   * `vx`:ään lisätty työntö kertyisi joka framella — se olisi kiihtyvyys eikä
   * nopeus. Tässä ne lasketaan yhteen siirron ajaksi ja erotetaan heti
   * jälkeen, joten laji näkee yhä oman vauhtinsa.
   *
   * Kun `drift` on nolla, tämä on merkki merkiltä `moveX`. Se on koko syy
   * miksi kaikki kahdeksan maailmaa ovat ennallaan.
   */
  moveSideways() {
    if (this.drift === 0) return moveX(this, this.level);
    const own = this.vx;
    this.vx = own + this.drift;
    const hit = moveX(this, this.level);
    if (hit) {
      // Seinä ottaa työnnön vastaan: se on nimenomaan se asia jota vasten
      // työntää, joten sen jälkeen kannettavaa vauhtia ei ole.
      this.drift = 0;
      this.vx = 0;
    } else {
      this.vx = own;
      if (this.onGround) this.drift = approach(this.drift, 0, this.surface.drift);
    }
    return hit;
  }

  /*
   * JUOKSUHIEKKA, from the other side of it.
   *
   * The tile shipped knowing about exactly one body. Everything else that
   * stands on a floor walked over a pool, fell through it because sand is not
   * `SOLID`, landed on the floor underneath and carried on walking with its
   * whole body below the surface — invisible, still lethal, and looking far
   * more like a joke than like a bug. Nothing in the shipped levels did it,
   * because the banks in 2-1 and 2-3 fence the walkers away from the pools:
   * a placement constraint, held in place by nobody moving anything.
   *
   * **The rule is that the sand does not know what is in it.** `sink()` is the
   * player's frame with his two abilities removed. Same surface scan (on
   * `Entity`, so there is one), same sink rate, same wade cap, same grace, and
   * above all the same *geometric* death: you drown when the whole body is
   * under the surface, never before. That is not a saving of code, it is the
   * whole design — it is what makes the shallow pool in 2-1 provably unable to
   * kill a walker for exactly the reason it cannot kill a power-0 player, and
   * it means a level author who digs a pool learns one rule instead of two.
   *
   * What the enemies do **not** get is the struggle. The player's answer to the
   * sand is the kick, and the kick is the thing the first pool exists to teach;
   * nothing else in the game has a button. So a pool deep enough to bury an
   * enemy always eventually does, and that is what turns a pool from scenery
   * into a place you can herd something into — see `sinks` for who can be
   * herded, and note that the price of using it is real: a shell you push into
   * the sand is a shell you no longer have.
   *
   * **It pays nothing**, and the precedent is not an opinion but an existing
   * line of code: an enemy that walks off the bottom of the level is removed
   * for free, and drowning is the same event with a lid on it. Score in this
   * game is paid for something the player did — a stomp, a kick, a shot, a
   * tail, a burst bubble — and paying for the room's own geometry would make
   * "stand back and let the level do it" the best-scoring answer to an enemy,
   * which prices a puddle above every tool the player was handed.
   *
   * **The picture, and the silence** (DESIGN.md kohta 8). The sign is the grain
   * the sand throws up, which is the same grain it throws for the player,
   * because it is the sand doing it and the sand is in the room. The sound is
   * deliberately *not* shared: `upota` and `kahlaa` are the player's report
   * that he has been caught, the desert is letterboxed, and a pool two screens
   * back that rustles because a walker fell into it teaches him to look down
   * when there is nothing under him. A signal that fires for something you
   * cannot see is worse than no signal, so the enemy's sink is seen and not
   * heard — and the pit, again, is the precedent: nothing sounds when the level
   * swallows an enemy.
   */

  /**
   * What this species is trying to do sideways before the sand caps it.
   *
   * A hook rather than `this.speed` directly, because "what it is trying to do"
   * is not the same question for everything that walks: a shell at rest and a
   * shell in flight both have a walking speed on them and neither is walking.
   */
  get driftSpeed() { return this.speed || 0; }

  /**
   * One frame of being in quicksand.
   *
   * @returns true when the sand took the frame, and the species' own update
   *          must not run — the sand replaces walking, hopping, sliding and
   *          gravity rather than modifying them, and one early return in each
   *          caller is the only way to be sure a later edit cannot hand any of
   *          them back. Same shape as `Player.update`, on purpose.
   */
  sink() {
    if (!this.sinks) return false;
    const surface = this.quicksandSurface();
    if (surface === null) {
      // Out of it: dropped rather than decayed, exactly as the player's is.
      this.sunk = 0;
      return false;
    }

    /* Sideways, capped. A walker walks at 0.55 and the cap is 0.62, so the sand
     * takes nothing from it here and everything from its footing — which is
     * honest: the cap is a speed limit and the things already slower than it
     * are not slowed. What the cap really catches is the kicked shell at 3.4,
     * and catching that is the point. */
    this.vx = Math.min(this.driftSpeed, QUICKSAND_WADE) * this.facing;
    if (moveX(this, this.level)) this.facing *= -1;

    // Down, at the sand's rate and no faster. Up is left alone for the same
    // reason it is for the player: nothing in here should swallow a rise.
    this.vy = Math.min(this.vy + GRAVITY, QUICKSAND_SINK);
    moveY(this, this.level);

    if (this.y >= surface + 1) {
      /* Under. The `+ 1` is not slack — a body resting on the floor of a pool
       * exactly its own height has its top on the rim to the pixel, and that
       * has to read as standing in it up to the neck.
       *
       * `|| 0` because a save state written before enemies could sink carries
       * entities with no counter on them at all, and `undefined + 1` is a NaN
       * that never reaches the grace — an enemy the sand could hold forever and
       * never finish. Same forgiveness `savestate.js` already extends to
       * `crumbles` for the same reason. */
      const under = this.sunk || 0;
      if (under % 12 === 0) this.level.spawnPuff(this.cx, surface + 2, true);
      this.sunk = under + 1;
      if (this.sunk >= QUICKSAND_GRACE) {
        this.level.spawnPuff(this.cx, surface + 2, true);
        this.remove = true;
      }
    } else {
      this.sunk = 0;
    }
    return true;
  }

  /**
   * Whether a fart ball traps this one instead of knocking it over. Anything
   * with hit logic of its own says no — see the overrides. A bubbleable enemy
   * walks on `speed`, which is what breaking out multiplies.
   */
  get bubbleable() { return false; }

  get bubbled() { return this.bubbleTimer > 0; }

  /**
   * Points on top: a stomp lands on them and hurts, rather than counting. Every
   * other way of killing the thing is untouched, which is the whole design —
   * spiky closes one door, it does not make an enemy invincible.
   */
  get spiky() { return false; }

  /** True once the bubble has started warning that it is about to go. */
  get bursting() { return this.bubbleTimer > 0 && this.bubbleTimer < BUBBLE_WARN; }

  get box() {
    if (!this.bubbled) return { x: this.x, y: this.y, w: this.w, h: this.h };
    const r = bubbleRadius(this.w, this.h);
    return { x: this.cx - r, y: this.cy - r, w: r * 2, h: r * 2 };
  }

  /** Goes limp and falls out of the world. */
  tumble(dir) {
    this.dying = true;
    this.noclip = true;
    this.stompable = false;
    this.vy = -4.2;
    this.vx = 0.8 * dir;
  }

  /** Knocked over by a sliding shell or a tail whack. */
  flipDie(dir = 1) {
    if (this.dying) return;
    // While a bubble is up it is the only thing there is to hit, so everything
    // that would have killed the enemy bursts the bubble instead.
    if (this.bubbled) {
      this.popBubble(dir);
      return;
    }
    this.tumble(dir);
    this.level.chainReward(this.score, this.cx, this.y);
    /* Kaatuminen on kuolema kuten tallauskin, ja sen kuuluu tuntua siltä.
     * `kick` jää alle potkun omana äänenä — se kertoo *mikä* osui — ja tapon
     * kuittaus tulee päälle. */
    Sfx.play('kick');
    killSound(this.level.player ? this.level.player.chain || 0 : 0);
  }

  /** Caught by a fart ball: floats, harmless, and worth double to whoever pops it. */
  trap() {
    if (this.dying || this.bubbled) return;
    this.bubbleTimer = BUBBLE_FRAMES;
    this.vx = 0;
    this.vy = 0;
    this.level.spawnPuff(this.cx, this.cy);
    Sfx.play('squeak');
  }

  /** The burst is the kill, and it pays better than the shot on its own did. */
  popBubble(dir = 1) {
    if (!this.bubbled || this.dying) return;
    this.bubbleTimer = 0;
    this.tumble(dir);
    this.level.spawnPuff(this.cx, this.cy);
    this.level.awardScore(this.score * POP_BONUS, this.cx, this.y);
    /* Kuplan puhkeaminen **on tappo**, joten se saa tapon äänen — `pop` yksin
     * oli kalvon ääni eikä palkinnon. Ketjun lenkki tulee pelaajalta, koska
     * puhkaisija on hän myös silloin kun kupla puhkeaa jalkojen alla. */
    Sfx.play('pop');
    killSound(this.level.player ? this.level.player.chain || 0 : 0);
  }

  /** Nobody came: it breaks out faster than it went in, and blinking. */
  escape() {
    this.bubbleTimer = 0;
    if (!this.angry) {
      this.angry = true;
      this.speed *= ANGRY_SPEED;
    }
    this.level.spawnPuff(this.cx, this.cy, true);
    // The same burst as a kill, followed downwards: the bubble went the wrong way.
    Sfx.play('pop');
    Sfx.play('kick');
  }

  /**
   * A bubble rises for a moment and then hangs there swaying. It has to stop
   * climbing: one that kept going would carry the kill up out of jumping range
   * and make escaping the usual outcome instead of the punishment.
   */
  updateBubbled() {
    if (--this.bubbleTimer <= 0) {
      this.escape();
      return;
    }
    const age = BUBBLE_FRAMES - this.bubbleTimer;
    this.vx = Math.sin(this.tick / 22) * 0.4;
    this.vy = age < BUBBLE_CLIMB ? -0.55 : Math.sin(this.tick / 30) * 0.25;
    moveX(this, this.level);
    moveY(this, this.level);
  }

  /** True while the enemy is on screen but can no longer hurt anyone. */
  get harmless() { return this.bubbled; }

  /** An escapee blinks, so a fast one is never mistaken for a fresh one. */
  get tint() { return this.angry && Math.floor(this.tick / 4) % 2 ? TINTS.flash : null; }

  /**
   * Every enemy that can be trapped paints through here, so the bubble and the
   * angry blink are each written once instead of once per species.
   */
  drawSprite(ctx, paint) {
    if (this.bubbled) {
      drawBubble(ctx, this.cx, this.cy, bubbleRadius(this.w, this.h), this.tick, this.bursting,
        (g) => paint(recolored(g, this.tint)));
      return;
    }
    paint(recolored(ctx, this.tint));
  }

  hitByProjectile(dir) {
    if (this.bubbleable && !this.bubbled) this.trap();
    else this.flipDie(dir);
  }

  hitByShell(dir) { this.flipDie(dir); }
  hitByTail(dir) { this.flipDie(dir); }

  /** @returns true when the stomp counted (player should bounce). */
  stomp() {
    this.remove = true;
    this.level.chainReward(this.score, this.cx, this.y);
    return true;
  }

  updateDying() {
    this.vy = Math.min(this.vy + 0.35, 8);
    this.x += this.vx;
    this.y += this.vy;
    if (this.y > this.level.heightPx + 48) this.remove = true;
  }

  drawFlipped(ctx, fn) {
    ctx.save();
    ctx.translate(0, Math.round(this.y) * 2 + this.h);
    ctx.scale(1, -1);
    fn();
    ctx.restore();
  }
}

export class Walker extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    this.speed = 0.55;
    this.squash = 0;
    this.spawnGrace = 0;
  }

  get bubbleable() { return true; }

  /** The unit, and the one the whole thing was written for: it walks in. */
  get sinks() { return true; }

  /** Se seisoo jaloillaan maassa, joten puuska saa siitä otteen. */
  get windborne() { return true; }

  /*
   * A flattened walker is scenery for the rest of its animation — and a walker
   * that has just been shaken out of a flyer is untouchable for a moment.
   *
   * Reported from play: stomp a flying enemy, it loses its wings, and the same
   * jump kills the walker underneath. `Flyer.stomp` adds the walker to
   * `level.entities` — the very array `collisions()` is iterating — so the new
   * walker is visited later in that same loop, against the same `fallVy`, and
   * is stomped by a jump that has already been spent.
   *
   * Twelve frames: long enough for the bounce (-4.0 px/frame) to carry the
   * player clear of a 16 px body, short enough that nobody waits for it.
   */
  get harmless() { return this.bubbled || this.squash > 0 || this.spawnGrace > 0; }

  update() {
    this.tick++;
    if (this.spawnGrace > 0) this.spawnGrace--;
    if (this.dying) return this.updateDying();
    if (this.bubbled) return this.updateBubbled();
    if (this.squash > 0) {
      if (--this.squash === 0) this.remove = true;
      return;
    }
    /* After the squash and not before it: a flattened walker is already a
     * corpse on a two-thirds-of-a-second timer, and having it wade first would
     * be the sand taking credit for a stomp that has already been paid for. */
    if (this.sink()) return;
    this.steer(this.speed * this.facing);
    if (this.moveSideways()) this.facing *= -1;
    applyGravity(this, 0.9);
    moveY(this, this.level);
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  stomp() {
    this.squash = 22;
    this.stompable = false;
    this.vx = 0;
    this.level.chainReward(this.score, this.cx, this.y);
    return true;
  }

  draw(ctx) {
    const frame = Math.floor(this.tick / 8);
    if (this.dying) {
      this.drawFlipped(ctx, () => drawWalker(ctx, this.x, this.y, frame, this.facing, false, this.skin));
      return;
    }
    this.drawSprite(ctx, (g) => drawWalker(g, this.x, this.y, frame, this.facing, this.squash > 0, this.skin));
  }
}

/** How fast a kicked shell travels, and keeps travelling after a bounce. */
const SHELL_SPEED = 3.4;

export class ShellGuy extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 14, 24);
    this.mode = 'walk';
    this.speed = 0.5;
    this.reviveTimer = 0;
    this.kickGrace = 0;
    this.score = 100;
  }

  get bubbleable() { return true; }

  /**
   * Yes — and this is the one where sinking changes a rule rather than just
   * removing an enemy.
   *
   * A shell is a tool: the player stomps it, kicks it, and it mows down the row
   * of things behind it. A pool turns that tool into ammunition you can spend,
   * because a shell pushed into sand is a shell that is gone.
   *
   * **This is not hypothetical, it is 2-1.** The level's only shell stands at
   * column 166 and the teaching pool is at columns 149–152, one chunk back, so
   * kicking a shell left is a thing a real player does on a real afternoon:
   * measured, it slides in, stops at column 152 and is gone 238 frames later.
   * That is a fair trade to offer and it is offered in the open — the sand is
   * visible, it is the tile the level has just spent four coins teaching him
   * about, and the shell crawls into it slowly enough to watch. Losing it there
   * costs nothing but the shell, which is the right place to learn it.
   *
   * The careful walkers never wander in by themselves, and that is not luck
   * either: `footingAhead` reads a pool as no footing, so a shell *walker* and
   * a piikkiukko both turn round at the rim. Being careful about a floor that
   * swallows you is exactly what being careful should mean.
   */
  get sinks() { return true; }

  /** Kuori on pelin liikkuvin kappale, ja tuuli on se toinen asia joka voi
   * panna sen liikkeelle ilman että kukaan potkaisi sitä. */
  get windborne() { return true; }

  /**
   * A shell has no legs whichever mode it is in, so only the walking one is
   * trying to go anywhere. A shell kicked into sand therefore stops dead on the
   * frame it touches — the same "it caught me" reading the player gets when the
   * sand takes his terminal velocity away in one frame — and then goes down.
   */
  get driftSpeed() { return this.mode === 'walk' ? this.speed : 0; }

  trap() {
    // A shell caught mid-slide comes out of the bubble at rest. Left sliding it
    // would resume at the zero speed the trap gave it: a shell that mows down
    // whatever it is touching and never moves off it again.
    if (this.mode === 'sliding') {
      this.mode = 'shell';
      this.reviveTimer = 420;
    }
    super.trap();
  }

  toShell() {
    this.mode = 'shell';
    const bottom = this.y + this.h;
    this.h = 14;
    this.y = bottom - this.h;
    this.vx = 0;
    this.reviveTimer = 420;
  }

  toWalking() {
    this.mode = 'walk';
    const bottom = this.y + this.h;
    this.h = 24;
    this.y = bottom - this.h;
    this.vx = 0;
    this.stompable = true;
  }

  /**
   * Breaks any plain brick the shell is pressed against.
   *
   * A brick hiding something is left alone and bounces the shell like stone:
   * its reward is for a player who bumps it from below, and a shell demolishing
   * it would delete a secret nobody ever saw.
   *
   * @returns true when something broke, so the caller knows not to bounce.
   */
  smashAhead() {
    const level = this.level;
    const ahead = this.vx > 0
      ? Math.floor((this.x + this.w + 1) / TILE)
      : Math.floor((this.x - 1) / TILE);
    const top = Math.floor(this.y / TILE);
    const bottom = Math.floor((this.y + this.h - 1) / TILE);
    let broke = false;
    for (let ty = top; ty <= bottom; ty++) {
      if (level.tileAt(ahead, ty) !== T.BRICK) continue;
      if (level.brickSecret && level.brickSecret(ahead, ty)) continue;
      level.smashBrick(ahead, ty);
      broke = true;
    }
    return broke;
  }

  kick(dir) {
    this.mode = 'sliding';
    this.vx = SHELL_SPEED * dir;
    this.facing = dir;
    this.reviveTimer = 0;
    /* Uusi potku, uusi ketju: kuori kantaa omaa laskuriaan (ks. `CHAIN_LADDER`
     * `scenes/level.js`:ssä), ja se alkaa siitä potkusta joka sen lähetti. */
    this.chain = 0;
    /*
     * Reported from play: stomp a shell walker, walk into the shell, lose a
     * power level. The kick was landing correctly — and then the shell, which
     * had only moved 3.4 px out of a box it was overlapping by more than that,
     * was still inside the player on the very next frame. A sliding shell hurts
     * you, so it hurt the one who had just kicked it.
     *
     * Ten frames is enough for a shell at 3.4 px/frame to clear the widest
     * player (21 px) from a standing overlap. It only shields the player; the
     * shell mows down everything else from the first frame, which is the whole
     * point of kicking one.
     */
    this.kickGrace = 10;
    Sfx.play('kick');
  }

  /** A shell you have just kicked cannot hurt you on its way out of your box. */
  get harmless() { return this.bubbled || this.kickGrace > 0; }

  update() {
    this.tick++;
    if (this.kickGrace > 0) this.kickGrace--;
    if (this.dying) return this.updateDying();
    if (this.bubbled) return this.updateBubbled();
    if (this.sink()) return;

    if (this.mode === 'walk') {
      this.steer(this.speed * this.facing);
      if (this.moveSideways()) this.facing *= -1;
      // Unlike the walkers, these are careful about ledges.
      if (this.onGround && !footingAhead(this.level, this.x + this.facing * 2, this.y, this.w, this.h)) {
        this.facing *= -1;
      }
    } else if (this.mode === 'sliding') {
      // A shell that hits something goes through it or comes back off it, and
      // which one depends on what it hit. Bricks are the soft thing in this
      // game; everything else is masonry.
      if (this.moveSideways()) {
        if (!this.smashAhead()) {
          /* Bounce off it, at speed.
           *
           * This used to be `this.vx = -this.vx`, and `moveX` zeroes the
           * velocity when it stops something — so the shell was negating a zero
           * and stopping dead against every wall. Shells have never actually
           * bounced in this game; they parked. Rebuild the speed from the
           * direction instead of from whatever survived the collision. */
          this.facing = -this.facing;
          this.vx = SHELL_SPEED * this.facing;
          Sfx.play('bump');
        }
      }
      this.level.shellSweep(this);
    } else {
      /* Levossa oleva kuori pyrkii pysymään paikallaan, ja `steer` on se joka
       * kertoo pystyykö se siihen. Tavallisella maalla pystyy yhdellä framella
       * — sama nolla kuin ennen — mutta jäällä lepäävä kuori ei ole levossa
       * vaan matkalla, jos jokin on sen kerran työntänyt. */
      this.steer(0);
      this.moveSideways();
      if (this.reviveTimer > 0 && --this.reviveTimer === 0) this.toWalking();
    }

    applyGravity(this, 0.9);
    moveY(this, this.level);
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  stomp() {
    if (this.mode === 'walk') {
      this.toShell();
      this.level.chainReward(this.score, this.cx, this.y);
      return true;
    }
    if (this.mode === 'sliding') {
      this.mode = 'shell';
      this.vx = 0;
      this.reviveTimer = 420;
      return true;
    }
    return true;
  }

  draw(ctx) {
    const frame = this.tick;
    if (this.dying) {
      this.drawFlipped(ctx, () => drawShell(ctx, this.x - 1, this.y, frame, this.facing, this.mode));
      return;
    }
    this.drawSprite(ctx, (g) => drawShell(g, this.x - 1, this.y, frame, this.facing, this.mode));
  }
}

export class Flyer extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    this.speed = 0.5;
    this.hop = -3.4;
    this.score = 200;
  }

  get bubbleable() { return true; }

  /**
   * Yes, and it is the one that looks like a judgement call and is not.
   *
   * A flyer is a hopper: gravity holds it down and it pushes off again on the
   * frame it touches. Sand is not solid, so a flyer that did *not* sink would
   * fall through the surface, find the floor of the pool, and bounce off it
   * from inside the sand — the buried-walker bug wearing a different sprite and
   * popping in and out of the ground. There is no third option here. What it
   * loses by sinking is its hop, which is right: the hop needs a floor to push
   * against and the sand is not one.
   */
  get sinks() { return true; }

  /** Ja tämä on se joka näyttää lain: hyppääjä on ilmassa, eikä ilmassa ole
   * mitään mitä vasten vastustaa puuskaa. */
  get windborne() { return true; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.bubbled) return this.updateBubbled();
    if (this.sink()) return;
    this.steer(this.speed * this.facing);
    if (this.moveSideways()) this.facing *= -1;
    applyGravity(this, 0.85);
    const hit = moveY(this, this.level);
    if (hit.ground) this.vy = this.hop;
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  stomp() {
    // Loses the wings and keeps walking, SMB3 style.
    const walker = new Walker(this.level, this.x, this.y);
    walker.facing = this.facing;
    walker.active = true;
    walker.spawnGrace = 12;
    this.level.add(walker);
    this.remove = true;
    this.level.chainReward(this.score, this.cx, this.y);
    return true;
  }

  draw(ctx) {
    const frame = this.tick;
    if (this.dying) {
      this.drawFlipped(ctx, () => drawFlyer(ctx, this.x, this.y, frame, this.facing));
      return;
    }
    this.drawSprite(ctx, (g) => drawFlyer(g, this.x, this.y, frame, this.facing));
  }
}

/**
 * Piikkiukko — a walker with a back full of spines. Jumping on it is the one
 * thing that does not work; a fart ball, a tail whack and a sliding shell all
 * still do, so it is an enemy that changes which tool you reach for rather than
 * a wall.
 *
 * Careful about ledges, like the shell walkers: an enemy you are not allowed to
 * stomp is one you have to walk around, and one that keeps throwing itself off
 * the platform it was guarding does not guard anything.
 */
export class SpikeGuy extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    // Slower than a walker. It is already the harder one to deal with; making
    // it fast as well would just make it a thing that catches you from behind.
    this.speed = 0.4;
    this.score = 200;
  }

  get spiky() { return true; }

  get bubbleable() { return true; }

  /** It walks on the floor like the unit does, so the floor gets it. It will
   * rarely be seen doing it: like the shell walker it is careful about ledges,
   * and a pool is not footing. */
  get sinks() { return true; }

  get windborne() { return true; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.bubbled) return this.updateBubbled();
    if (this.sink()) return;
    this.steer(this.speed * this.facing);
    if (this.moveSideways()) this.facing *= -1;
    if (this.onGround && !footingAhead(this.level, this.x + this.facing * 2, this.y, this.w, this.h)) {
      this.facing *= -1;
    }
    applyGravity(this, 0.9);
    moveY(this, this.level);
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  draw(ctx) {
    const frame = Math.floor(this.tick / 2);
    if (this.dying) {
      this.drawFlipped(ctx, () => drawSpikeGuy(ctx, this.x, this.y, frame, this.facing));
      return;
    }
    this.drawSprite(ctx, (g) => drawSpikeGuy(g, this.x, this.y, frame, this.facing));
  }
}

/**
 * The one walking-speed enemy a fart ball still kills outright. It is bolted to
 * a pipe — box, drawing and state machine are all measured from the pipe mouth
 * — and a plant that floated away in a bubble would leave that pipe harmless
 * for the rest of the level.
 */
export class Plant extends Enemy {
  /** Offsets at or beyond this are "down the pipe": not drawn, cannot hurt. */
  static HIDDEN_OFFSET = 24;

  /** `pipeTopY` is the y of the pipe mouth; the plant hides one tile below. */
  constructor(level, x, pipeTopY) {
    super(level, x, pipeTopY, 16, 32);
    this.pipeTopY = pipeTopY;
    this.stompable = false;
    this.score = 200;
    this.phase = 'hidden';
    this.timer = 40;
    this.offset = 32;
    this.alwaysActive = false;
  }

  /**
   * Half a tile has to be showing before the thing counts as out. Below that
   * it is a two-pixel sliver at the rim of the pipe — technically visible,
   * practically not, and dying to it feels like the game cheated. The same
   * number gates the drawing, so what can hurt you is exactly what you see.
   */
  get exposed() { return this.offset < Plant.HIDDEN_OFFSET; }

  // Down the pipe means out of play. Its box collapses to zero height, but a
  // zero-height box still straddles the player's, so this has to be explicit.
  get harmless() { return !this.exposed; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();

    const player = this.level.player;
    const nearPlayer = player && Math.abs(player.cx - (this.x + 8)) < 40;

    switch (this.phase) {
      case 'hidden':
        this.offset = 32;
        if (--this.timer <= 0 && !nearPlayer) {
          this.phase = 'rising';
          this.timer = 26;
        }
        break;
      case 'rising':
        this.offset = 32 * (this.timer / 26);
        if (--this.timer <= 0) {
          this.phase = 'out';
          this.timer = 70;
          this.offset = 0;
        }
        break;
      case 'out':
        // Ducks back down when somebody is right on top of it, so clearing
        // the pipe is a matter of timing rather than luck.
        if (nearPlayer && this.timer > 16) this.timer = 16;
        if (--this.timer <= 0) {
          this.phase = 'falling';
          this.timer = 26;
        }
        break;
      default:
        this.offset = 32 * (1 - this.timer / 26);
        if (--this.timer <= 0) {
          this.phase = 'hidden';
          this.timer = 60;
        }
        break;
    }
    this.y = this.pipeTopY + this.offset;
  }

  get box() {
    // Only the part sticking out of the pipe can hurt anybody.
    const visible = Math.max(0, this.h - this.offset);
    return { x: this.x, y: this.y, w: this.w, h: visible };
  }

  draw(ctx) {
    if (this.offset >= Plant.HIDDEN_OFFSET) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x - 2, this.pipeTopY - 40, this.w + 4, 40 + this.h);
    ctx.clip();
    if (this.dying) {
      this.drawFlipped(ctx, () => drawPlant(ctx, this.x, this.y, this.tick));
    } else {
      drawPlant(ctx, this.x, this.y, this.tick);
    }
    ctx.restore();
  }
}

/*
 * KURNUTTAJA — THE THING IN THE CHASM, AND WHY IT IS NOT A SECOND PLANT.
 *
 * `Plant` is this game's creature-in-a-hole and that role is taken. The plant
 * is the thing that makes a **pipe** dangerous: it is bolted to a lid you walk
 * past on the ground, it rises slowly and in full view, and the answer is to
 * keep walking at the right moment. The kurnuttaja is the thing that makes a
 * **pit** dangerous, which is a different question with a different answer,
 * because a pit is not somewhere you walk past — it is somewhere you jump.
 *
 * And that is exactly what makes it the riskiest enemy in the game to get
 * wrong. A pit has been binary until now: you clear it or you die. Putting
 * something in one makes the *air above it* dangerous, and the air above a pit
 * is the one place a player has no control left — mid-jump, committed, with
 * nothing but momentum. Done carelessly this turns a jump the player chose into
 * a death they could not avoid.
 *
 * Four decisions carry the whole thing:
 *
 *  1. **The warning outlasts the flight.** `KURN_WARN` is not a number that
 *     felt right; it is measured against `tools/jump-budget.json`. The longest
 *     jump a power-0 player can be in the air for is 69 frames (P-speed, held),
 *     and the wind-up is longer than that. The consequence is a proof rather
 *     than a hope: if the warning lasts at least as long as the flight, then a
 *     leap that can reach a player in the air *began being announced before
 *     that player left the ground*. `verify.mjs` re-derives both numbers.
 *
 *  2. **The cycle is deterministic.** No `Math.random()` anywhere in it, for
 *     the same reason the boss's spike cycle has none: a hazard over a pit has
 *     to be learnable, and a quicksave has to reload into the same rhythm.
 *     Every field below is an own property, so `savestate.js` carries it.
 *
 *  3. **The leap is vertical.** `x` never changes and `vx` is never set. The
 *     danger is therefore *exactly* the column of air above the hole, and
 *     standing on the rim is always safe — which is what makes waiting a real
 *     answer rather than a guess.
 *
 *  4. **It cannot be stomped.** Landing on something on its way up out of a pit
 *     means landing over the pit, so a stomp would be an answer that kills the
 *     answerer. The game already teaches that "wait" is legitimate — the
 *     heartburn jet cannot be stomped at all — and everything else still works:
 *     a fart ball, a tail whack and a sliding shell all kill it, exactly as
 *     they do the plant.
 *
 * It is deliberately **not** `spiky`. Spines mean "the stomp is closed" and
 * they are drawn as points; this one is closed because it hangs over a hole,
 * which is a fact about the terrain and not about the animal. Making it spiky
 * would have been a second meaning for the same picture.
 */
/** How long it sits quiet at the bottom, in frames. */
export const KURN_WAIT = 54;
/**
 * And how long it croaks before it goes. Longer than the 69 frames the longest
 * power-0 jump spends in the air — see decision 1 above. The margin is small on
 * purpose: a warning much longer than the flight stops being a countdown and
 * becomes background noise.
 */
export const KURN_WARN = 84;
/**
 * The leap itself. -7.8 against 0.4 of gravity is a 76 px rise off a rest
 * position two tiles under the rim, which puts the body 28 px clear of the
 * floor line at the top — high enough to be in the way of a jump rather than
 * something you sail over without noticing, and low enough that it is gone
 * again in 39 frames.
 */
const KURN_LIFT = -7.8;
const KURN_GRAVITY = 0.4;
/**
 * How much of it has to be over the rim before it counts as out.
 *
 * The same argument as `Plant.HIDDEN_OFFSET`: a four-pixel sliver at the edge
 * of a hole is technically visible and practically not, and dying to it feels
 * like the game cheated. Below this it is drawn and harmless, which is also the
 * last beat of the telegraph — you watch it come up before it can touch you.
 */
export const KURN_RIM = 4;

export class Kurnuttaja extends Enemy {
  /** `lipY` is the y of the floor line the pit is cut into. */
  constructor(level, x, lipY) {
    super(level, x, lipY + 32, 16, 16);
    this.lipY = lipY;
    /* Two tiles under the rim, which for a 15-row band is exactly the bottom of
     * the world: at rest the whole body is below anything the camera can show,
     * so "hidden" is a fact about the picture and not a flag. */
    this.restY = lipY + 32;
    this.stompable = false;
    this.score = 400;
    this.phase = 'wait';
    this.timer = KURN_WAIT;
  }

  /* A bubble would carry it up out of its own hole and leave the pit harmless
   * for the rest of the level, and its box, its rest height and its whole state
   * machine are measured from the rim. Same refusal as the plant's, same
   * reason. */
  get bubbleable() { return false; }

  /**
   * 0..1 through the croak, for the drawing — one number, the way the sun reads
   * its whole wind-up off `windUp`. It is already above zero on the frame the
   * sound plays, so the two halves of the warning start together rather than a
   * frame apart (DESIGN.md §8).
   */
  get warning() {
    if (this.phase !== 'warn') return 0;
    return Math.max(0, Math.min(1, (KURN_WARN + 1 - this.timer) / KURN_WARN));
  }

  /**
   * No — declared even though the gate does not ask, because this is the one
   * where the answer is arguable and an unasked question is how the walkers
   * ended up walking along the bottom of a pool in the first place.
   *
   * It integrates its own gravity rather than borrowing `applyGravity`, and it
   * never leaves its column: `restY`, `lipY` and the whole cycle are measured
   * from one fixed line, which is the promise that makes the creature learnable.
   * Sand at the bottom of its pit would delete the level's furniture on the
   * first beat, and it is a placement the validator will not accept anyway —
   * `checkQuicksand` wants a rim within jumping reach of every pool, and the
   * bottom of a kurnuttaja's hole is not that.
   */
  get sinks() { return false; }

  /** True once enough of it is over the rim to be worth being afraid of. */
  get exposed() { return this.y <= this.lipY - KURN_RIM; }

  get harmless() { return !this.exposed; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();

    // It watches you. Nothing about the leap depends on this — the cycle is a
    // clock — but a thing in a hole that never turns its head is scenery.
    const player = this.level.player;
    if (player) this.facing = player.cx < this.cx ? -1 : 1;

    if (this.phase === 'wait') {
      this.y = this.restY;
      this.vy = 0;
      if (--this.timer <= 0) {
        this.phase = 'warn';
        this.timer = KURN_WARN;
        Sfx.play('kurnutus');
      }
      return;
    }
    if (this.phase === 'warn') {
      this.y = this.restY;
      if (--this.timer <= 0) {
        this.phase = 'leap';
        this.vy = KURN_LIFT;
        Sfx.play('loikka');
      }
      return;
    }

    /* The leap. Integrated here rather than through `applyGravity`/`moveY`
     * because it must not collide with anything: the rest position is under the
     * floor of the world, and a body that solved tiles on the way past would
     * stop dead on the first one it met. */
    this.vy += KURN_GRAVITY;
    this.y += this.vy;
    if (this.vy > 0 && this.y >= this.restY) {
      this.y = this.restY;
      this.vy = 0;
      this.phase = 'wait';
      this.timer = KURN_WAIT;
    }
  }

  draw(ctx) {
    if (this.dying) {
      this.drawFlipped(ctx, () => drawKurnuttaja(ctx, this.x, this.y, this.tick, this.facing));
      return;
    }
    // The croak is drawn whether or not the body is, because the body is at the
    // bottom of a hole and the croak is the only half of it anybody can see.
    drawCroak(ctx, this.x, this.lipY, this.warning, this.tick);
    if (this.phase === 'leap') this.drawSprite(ctx, (g) => drawKurnuttaja(g, this.x, this.y, this.tick, this.facing));
  }
}

/** Ruskea pilvi — drifts through the air and stinks on contact. */
export class StinkCloud extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 20, 14);
    this.score = 200;
    this.homeY = y;
    this.phase = Math.random() * Math.PI * 2;
    this.speed = 0.35;
    this.amplitude = 14;
    // Start on the curve, otherwise the first update teleports it mid-bob.
    this.y = y + Math.sin(this.phase) * this.amplitude;
  }

  get bubbleable() { return true; }

  escape() {
    // It carries on bobbing from wherever the bubble left it. Keeping the old
    // home line would drop it back into the lane it was in four seconds ago —
    // a teleport, and away from the player who had just failed to reach it.
    this.homeY = this.y - Math.sin(this.phase) * this.amplitude;
    super.escape();
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.bubbled) return this.updateBubbled();

    const player = this.level.player;
    if (player) {
      const toward = Math.sign(player.cx - this.cx);
      if (toward !== 0) this.facing = toward;
      // drifts slowly toward the player, never in a hurry
      if (Math.abs(player.cx - this.cx) > 24) this.x += this.speed * toward;
    }
    this.phase += 0.045;
    this.y = this.homeY + Math.sin(this.phase) * this.amplitude;

    if (this.tick % 26 === 0) this.level.spawnPuff(this.cx, this.y + this.h, true);
  }

  stomp() {
    this.remove = true;
    this.level.spawnPuff(this.cx, this.cy, true);
    this.level.chainReward(this.score, this.cx, this.y);
    return true;
  }

  /**
   * Kulmakarvat kertovat karkulaisen, eivät lajia.
   *
   * Molemmat kutsut antoivat tähän asti kirjaimellisen `true`:n, joten
   * `stinkBody`n rauhallista ilmettä ei piirretty koskaan — ja se ilme oli
   * juuri se paikka johon kuplasta karkatun pilven nopeutuminen (`escape`,
   * `ANGRY_SPEED` 1,6×) kuului. Peli siis kiihdytti vihollisen ja jätti
   * kertomatta sen: pelaaja näki saman naaman ennen ja jälkeen.
   *
   * Myös kuoleva pilvi piirtyy nyt omalla tilallaan eikä vihaisena. Se ei ole
   * siisteyttä vaan §8: kaksi samannäköistä merkkiä opettaa lukemaan väärin,
   * ja kulmakarvat jotka tarkoittavat sekä "nopeutui" että "kaatui" eivät
   * tarkoita kumpaakaan.
   */
  draw(ctx) {
    const face = (g) => drawStinkCloud(g, this.x, this.y, this.tick, this.facing, this.angry);
    if (this.dying) {
      this.drawFlipped(ctx, () => face(ctx));
      return;
    }
    this.drawSprite(ctx, face);
  }
}

/*
 * The angry sun's sky, in numbers.
 *
 * `SUN_SKY_TOP` and `SUN_SKY_LOW` bound where it may rest, and both are
 * measured down from the top of **the band the player can actually see** —
 * `scene.viewH`, never the constant VIEW_H. 2-1 is letterboxed, so its window
 * is 160 rows rather than 208, and anything that positions itself against
 * VIEW_H in that level is aiming at 48 px nobody will ever look at.
 *
 * The lower bound is a share of the window rather than a fixed drop, so the two
 * framings read the same: a third of the way down the picture is a third of the
 * way down in cinemascope too.
 */
const SUN_SKY_TOP = 18;
const SUN_SKY_LOW = 0.3;
/*
 * How fast the resting height corrects, in px per frame.
 *
 * Following has to beat the camera or the sun trails out of the top of the
 * picture on every descent: the view eases a 16 px step at CAM_V_EASE = 0.25,
 * which is 4 px on the first frame. Leaving is deliberately slower than
 * following, because the retreat is the one movement the player is *meant* to
 * watch — it is the picture of having got away.
 */
const SUN_FOLLOW = 6;
const SUN_LEAVE = 2.5;
/*
 * The dive's wind-up, in frames.
 *
 * The same 34 as the barons' throw and for the same reason: half a second is
 * long enough to react to and short enough to be a warning rather than a pause.
 * It is taken **out of** the hover wait and not added to it, so the dive still
 * launches on exactly the frame it always did — the fight's cadence does not
 * move, only the warning is new.
 */
const SUN_WINDUP = 34;
/*
 * The burning wake: how many embers, and how far the sun has to move before it
 * drops another one.
 *
 * A sample only when it has actually moved, so a sun hanging still does not
 * stack fourteen embers on one spot; each one dies of old age
 * (`SUN_TRAIL_LIFE`, a drawing constant, since how long an ember burns is a
 * question about the picture), so a sun that stops leaves no permanent smear.
 */
const SUN_TRAIL = 14;
const SUN_TRAIL_STEP = 3;
/* One screenful, mirroring `VIEW_W` in scenes/level.js. Importing it would
 * close a cycle — level.js imports this file — for the same reason and with
 * the same answer as the fart ball's cull in entities/items.js. */
const SCREEN_W = 320;

/**
 * Vihainen aurinko. Hangs in the sky next to the player, then swoops down
 * through them in an arc and climbs back up. Cannot be stomped; three fart
 * balls (or tail whacks) put it out.
 *
 * It is the game's one enemy that follows you across a whole level, so it is
 * also the one that has to know where it does *not* belong: out of the picture,
 * out of its own band, and past the flag. See `quitReason`.
 */
export class AngrySun extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 20, 20);
    this.skyY = y;
    /** Where the level put it; the resting height is this, clamped into view. */
    this.homeY = y;
    this.hp = 3;
    this.score = 1000;
    this.stompable = false;
    this.side = -1;
    this.phase = 'hover';
    this.timer = 150;
    this.diveT = 0;
    this.fromX = x;
    this.toX = x;
    this.diveDepth = 0;
    this.invuln = 0;
    /** '' while it is hunting, otherwise why it stopped. See `quitReason`. */
    this.quit = '';
    /** The burning wake: {x, y, life}, oldest first. Drawn, never collided. */
    this.trail = [];
  }

  /** The band the sun belongs to — the one the level put it in. */
  get bandTop() {
    const bands = this.level.def.bands;
    if (!bands) return 0;
    const span = bands.rows * TILE;
    return Math.floor(this.homeY / span) * span;
  }

  /**
   * Where it wants to hang while it is hunting, in world pixels.
   *
   * Its own spawn height when that is inside the picture, and the camera's
   * otherwise — **clamped both ways**. What was here before was
   * `Math.min(skyY, cam.y + 18)`, which is a ratchet: `skyY` could only ever
   * rise, so the first time the view panned down the sun kept its old, higher
   * world position and stayed above the top of the frame for the rest of the
   * level. The comment said "so it never gets left behind" and the code could
   * only leave it behind in one of the two directions.
   */
  restY() {
    const { cam, viewH } = this.level;
    return Math.min(cam.y + viewH * SUN_SKY_LOW,
      Math.max(cam.y + SUN_SKY_TOP, this.homeY));
  }

  /**
   * Why it has stopped hunting, or '' while it is still on you.
   *
   * **The flag.** The threshold is what the player can see rather than a column
   * counted out of the level data: the moment the goal is inside the window the
   * chase is over, and the two things then happen in the same picture — the
   * flag comes in from the right, the sun goes up and out. The run-up to the
   * flag is deliberately calm in every level in the game, and a dive that lands
   * on the pole would be a death after the level was already won.
   *
   * **Its own band.** A tall level is sky / route / cave. Following the camera
   * down a warp pipe would park an unkillable, unavoidable thing inside a
   * sealed room, which is nonsense twice over — the sun is the sky's. Which
   * band the player is in is read off the **feet**, the same rule and for the
   * same reason as `LevelScene.cameraY`.
   */
  quitReason() {
    const level = this.level;
    if (level.goal && level.goal.x < level.cam.x + SCREEN_W) return 'flag';
    const bands = level.def.bands;
    if (bands) {
      const span = bands.rows * TILE;
      const p = level.player;
      const feet = Math.floor((p.y + p.h - 1) / span) * span;
      if (feet !== this.bandTop) return 'band';
    }
    return '';
  }

  /**
   * 0..1 through the dive's telegraph, for the drawing — one number, the way
   * the boss's crown reads its whole animation off `crownOn`. It is already
   * above zero on the frame the warning sound plays, so the two halves start
   * together rather than a frame apart.
   */
  get windUp() {
    if (this.phase !== 'hover' || this.quit || this.timer > SUN_WINDUP) return 0;
    return Math.max(0, Math.min(1, (SUN_WINDUP + 1 - this.timer) / SUN_WINDUP));
  }

  /** Moves the resting height toward `target`, at most `speed` px this frame. */
  toward(target, speed) {
    const d = target - this.skyY;
    return Math.abs(d) <= speed ? target : this.skyY + Math.sign(d) * speed;
  }

  /** Lays down the burning wake. See SUN_TRAIL. */
  trace() {
    const trail = this.trail;
    for (const s of trail) s.life--;
    while (trail.length && trail[0].life <= 0) trail.shift();
    const last = trail[trail.length - 1];
    if (last && Math.abs(last.x - this.x) + Math.abs(last.y - this.y) < SUN_TRAIL_STEP) return;
    trail.push({ x: this.x, y: this.y, life: SUN_TRAIL_LIFE });
    if (trail.length > SUN_TRAIL) trail.shift();
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.invuln > 0) this.invuln--;

    const player = this.level.player;
    if (!player) return;

    if (this.phase === 'hover') this.updateHover(player);
    else this.updateDive();
    this.trace();
  }

  updateHover(player) {
    this.quit = this.quitReason();
    const target = player.cx + 84 * this.side - this.w / 2;
    /*
     * A sun waiting out a trip underground keeps station over the player, so it
     * is overhead again the moment they surface — and so the scene's own
     * off-screen cull does not quietly tidy away an enemy that is merely
     * waiting. One that has given up at the flag does not: being left behind is
     * the whole point, and being cleaned up a screen back is the right end.
     */
    if (this.quit !== 'flag') this.x += (target - this.x) * 0.035;
    if (this.quit) {
      /*
       * Giving up is a picture and not a switch. A sun that simply stopped
       * updating would read as a bug; one that climbs out of the top of the
       * frame reads as an ending, and that is the reward for surviving it. It
       * parks just above its own band and waits there, so coming back up the
       * pipe brings it back down — retreating is a state, not a death.
       */
      this.skyY = this.toward(this.bandTop - this.h - 8, SUN_LEAVE);
      this.y = this.skyY + Math.sin(this.tick / 22) * 5;
      // It leaves with a full wait on the clock: coming back into its reach
      // must not buy an instant dive out of a sun that was already counting.
      this.timer = 150;
      return;
    }

    this.skyY = this.toward(this.restY(), SUN_FOLLOW);
    this.y = this.skyY + Math.sin(this.tick / 22) * 5;
    if (--this.timer <= 0) {
      this.phase = 'dive';
      this.diveT = 0;
      this.fromX = this.x;
      this.toX = player.cx - 60 * this.side - this.w / 2;
      this.diveDepth = Math.max(40, player.y - this.skyY + 10);
    } else if (this.timer === SUN_WINDUP) {
      /*
       * The warning, both halves in the same beat — DESIGN.md §8 is explicit
       * that a sound without a picture goes unnoticed in noise and a picture
       * without a sound reads as a glitch. The sound is the one the barons
       * already use to mean "an arm is going up"; the picture is the sun going
       * white-hot and bristling, drawn in sprites/enemies.js off `windUp`.
       *
       * It is a *warning* and not a feint: nothing about the sun's position or
       * hitbox changes during it, so what can hurt you is still exactly what
       * you see, and the dive leaves on the frame it always did.
       */
      Sfx.play('boss');
    }
  }

  /** One smooth arc down through the player's level and back up. */
  updateDive() {
    this.diveT = Math.min(1, this.diveT + 0.014);
    this.x = this.fromX + (this.toX - this.fromX) * this.diveT;
    this.y = this.skyY + Math.sin(this.diveT * Math.PI) * this.diveDepth;
    if (this.diveT >= 1) {
      this.phase = 'hover';
      this.timer = 140 + Math.floor(Math.random() * 60);
      this.side *= -1;
    }
    // A dive that has already been announced finishes, even if the player
    // crosses into the flag's screen while it is in the air. Cancelling a
    // telegraphed attack halfway is the other way to teach the wrong lesson.
  }

  takeHit(dir) {
    if (this.invuln > 0) return;
    this.hp--;
    this.invuln = 30;
    Sfx.play('bump');
    if (this.hp <= 0) this.flipDie(dir);
  }

  hitByProjectile(dir) { this.takeHit(dir); }
  hitByTail(dir) { this.takeHit(dir); }
  hitByShell(dir) { this.takeHit(dir); }

  /** It is a burning sun. Put it out and the light goes with it. */
  get light() {
    return this.dying ? null : light(this.cx, this.cy, 72, 0.85);
  }

  draw(ctx) {
    if (this.dying) {
      this.drawFlipped(ctx, () => drawAngrySun(ctx, this.x, this.y, this.tick, false, false));
      return;
    }
    drawAngrySun(ctx, this.x, this.y, this.tick, this.phase === 'dive', this.invuln > 0,
      { trail: this.trail, windUp: this.windUp });
  }
}

/** Ummetuskorkki — plugs you up instead of hurting you. */
export class CorkGuy extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 14, 16);
    this.score = 200;
    this.corks = true;
    this.speed = 0.7;
    this.hopTimer = 40;
  }

  get bubbleable() { return true; }

  /** It walks and it hops, and neither works in sand. Same reasoning as the
   * flyer: the hop needs something to push against. */
  get sinks() { return true; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.bubbled) return this.updateBubbled();
    if (this.sink()) return;
    this.vx = this.speed * this.facing;
    if (moveX(this, this.level)) this.facing *= -1;
    if (this.onGround && --this.hopTimer <= 0) {
      this.vy = -3.2;
      this.hopTimer = 50 + Math.floor(Math.random() * 40);
    }
    applyGravity(this, 0.9);
    moveY(this, this.level);
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  draw(ctx) {
    if (this.dying) {
      this.drawFlipped(ctx, () => drawCorkGuy(ctx, this.x - 1, this.y, this.tick, this.facing));
      return;
    }
    this.drawSprite(ctx, (g) => drawCorkGuy(g, this.x - 1, this.y, this.tick, this.facing));
  }
}

/** Närästys — a heartburn jet that erupts out of the floor on a timer. */
export class Heartburn extends Entity {
  constructor(level, x, floorY) {
    super(level, x, floorY, 16, 0);
    this.kind = 'hazard';
    this.floorY = floorY;
    this.maxHeight = 44;
    this.height = 0;
    this.phase = 'idle';
    this.timer = 60 + Math.floor(Math.random() * 60);
  }

  get box() {
    return { x: this.x + 3, y: this.floorY - this.height, w: 10, h: this.height };
  }

  /**
   * A column of burning gas is a light, and in the dark level it is *the*
   * light: the brightest thing there, visible from further away than anything
   * else, and the only one that tells you what the floor looks like somewhere
   * you are not standing. It is also the thing that kills you if you are
   * standing in it when it goes off. That trade is the point — you wait out a
   * hazard to be shown the route, and the waiting is what costs you the clock.
   *
   * The light follows the flame's own timing, so it is not a second signal to
   * learn: the warning ember is a dim glow, the flare is the flare. It reaches
   * half again as far as the flame is tall, which keeps the *bright* part well
   * inside the killing column — a hazard whose light is wider than the hazard
   * would be teaching the wrong edge.
   */
  get light() {
    if (this.height <= 0) return null;
    const warn = this.phase === 'warn';
    return light(this.x + 8, this.floorY - this.height / 2,
      20 + this.height * 0.85, warn ? 0.3 : 0.95);
  }

  update() {
    this.tick++;
    switch (this.phase) {
      case 'idle':
        this.height = 0;
        if (--this.timer <= 0) {
          this.phase = 'warn';
          this.timer = 40;   // a beat of warning before it blows
        }
        break;
      case 'warn':
        this.height = 3;
        if (--this.timer <= 0) {
          this.phase = 'up';
          this.timer = 18;
          Sfx.play('fart');
        }
        break;
      case 'up':
        this.height = this.maxHeight * (1 - this.timer / 18);
        if (--this.timer <= 0) {
          this.phase = 'hold';
          this.timer = 34;
          this.height = this.maxHeight;
        }
        break;
      case 'hold':
        if (--this.timer <= 0) {
          this.phase = 'down';
          this.timer = 20;
        }
        break;
      default:
        this.height = this.maxHeight * (this.timer / 20);
        if (--this.timer <= 0) {
          this.phase = 'idle';
          this.timer = 80 + Math.floor(Math.random() * 60);
        }
        break;
    }
  }

  draw(ctx) {
    if (this.phase === 'warn') {
      ctx.fillStyle = Math.floor(this.tick / 3) % 2 ? 'rgba(248,120,24,0.7)' : 'rgba(216,48,24,0.4)';
      ctx.fillRect(Math.round(this.x) + 4, Math.round(this.floorY) - 3, 8, 3);
      return;
    }
    drawHeartburn(ctx, this.x, this.floorY, this.height, this.tick);
  }
}

/** Ground shockwave thrown off by the heavier bosses when they land. */
export class Shockwave extends Enemy {
  constructor(level, x, y, dir) {
    super(level, x, y, 12, 12);
    this.stompable = false;
    this.vx = 2.6 * dir;
    this.life = 90;
    this.score = 0;
    this.alwaysActive = true;
    this.active = true;
  }

  /**
   * No. It is not a body standing on a floor, it is a *front* travelling along
   * one, and it lives a second and a half. Sand that swallowed it would be sand
   * that blocks a boss's attack, which is a fight rule invented by scenery — and
   * boss arenas are stone anyway, so the only way this could ever be asked is
   * by a future arena that had better answer it on purpose.
   */
  get sinks() { return false; }

  update() {
    this.tick++;
    if (--this.life <= 0) this.remove = true;
    if (moveX(this, this.level)) this.remove = true;
    applyGravity(this, 1);
    moveY(this, this.level);
  }

  flipDie() { this.remove = true; }
  hitByProjectile() {}
  hitByShell() {}
  hitByTail() {}

  draw(ctx) {
    const p = Math.floor(this.tick / 3) % 2;
    ctx.fillStyle = p ? 'rgba(200,160,90,0.85)' : 'rgba(150,110,60,0.85)';
    ctx.fillRect(Math.round(this.x), Math.round(this.y) + 2, 12, 10);
    ctx.fillStyle = 'rgba(240,220,170,0.8)';
    ctx.fillRect(Math.round(this.x) + 3, Math.round(this.y) + p, 6, 5);
  }
}

/*
 * The boss's spine cycle, in frames at 60 Hz. Three beats, always in this
 * order, never random:
 *
 *   open (stompable) -> telegraph (stompable, crown going on, sound) -> spiky
 *
 * The telegraph is the whole reason this is a pattern and not a trap. It is
 * still stompable while the crown is going on, so a jump started on the last
 * open frame is not punished for a decision that was correct when it was made.
 *
 * What tightens as the boss loses health is the length of the open window, and
 * nothing else: same beats, same order, same warning, less room. A cycle that
 * changed shape when you hurt it would have to be learned twice.
 */
const SPIKE_TELEGRAPH = 48;
const SPIKE_ON = 132;
const SPIKE_OPEN = 180;
const SPIKE_OPEN_STEP = 24;
const SPIKE_OPEN_MIN = 120;
/*
 * Taking the crown off again is the first stretch of the open window, not a
 * beat of its own: adding a fourth phase would have lengthened the cycle and
 * quietly changed the fight. Nothing about who can be stomped when moves — the
 * boss is stompable from the first frame of `open`, exactly as before, and this
 * only says how long his hands take to put the thing away.
 *
 * The points themselves are gone within the first quarter of it (see
 * CROWN_SPINES in the sprite), sooner than the eight frames the old retract
 * took, so "visible points mean danger" got tighter rather than looser.
 */
const SPIKE_DOFF = 20;

/*
 * THE GIANT'S GROWTH, SEEN FROM THE ROOM.
 *
 * Every stomp puffs the giant up half a size, and by the fourth one his head is
 * further above the floor than any power-0 jump reaches — the last hits have to
 * come down off the arena's decks (see `boss_arena_big`). The decks are the
 * answer, so the answer has to be *pointed at*, and the growth is the moment to
 * do it: it is the one moment in the fight when the player is certainly looking
 * at the boss and has just been told something changed.
 *
 * So the room answers. He swells, the arena takes it, and dust comes off the
 * planks overhead — up there, where the next hit is going to have to come from.
 *
 * Three deliberate differences from the two telegraphs this game already owns
 * (DESIGN.md §8: a new signal that looks like an old one teaches the player to
 * read the wrong thing):
 *
 *   - **place.** The shockwave runs out along the floor from his feet. This
 *     happens at the ceiling, on the decks, nowhere near him.
 *   - **direction.** The shockwave travels sideways and the sun's dive
 *     telegraph gathers on the sun. Dust falls.
 *   - **colour.** His own gas is brown (`spawnPuff(..., true)`, the same brown
 *     as the stink clouds). Deck dust is the pale puff, so "brown means him"
 *     survives.
 *
 * The sound half is already there and is not new either: `stomp` for the hit
 * and `fart` for the growth, the second of which only the giant plays. Picture
 * and sound together, which is the rule; a third boss sound would have been a
 * fourth thing to learn.
 */
const DUST_FRAMES = 28;
/** One burst every few frames, so it patters rather than flashes. */
const DUST_EVERY = 4;
/** How far along the deck the thump is felt, in tiles either side of him. */
const DUST_REACH = 14;

/*
 * JÄTTILÄISEN ASKEL, kolme lukua. Ks. `Boss.updateStep`.
 *
 *   GIANT_STEP_AT     mistä koosta alkaen kävely tuntuu lattiassa. Kaksi on
 *                     kaksi osumaa, eli tärinä on tieto siitä että hän kasvoi.
 *   GIANT_STEP_PX     pikseliä askelta kohti. 22 px on hieman yli laatan, eli
 *                     kolmen kokoisen pomon kävelyvauhdilla noin joka
 *                     kahdeskymmenes frame — kaukana siitä että kuva täräjäisi
 *                     jatkuvasti, ja tarpeeksi tiheä ollakseen rytmi.
 *   GIANT_STEP_SHAKE  voimakkuus kokoa kohti. Kolmen kokoisena 1,05 px eli
 *                     viidesosa saman pomon laskeutumisesta (2 + koko = 5).
 */
/*
 * SUOLIMADON kaivautuminen, neljä lukua. Ks. `Boss.updateBurrow`.
 *
 *   BURROW_DEPTH  kuinka syvälle runko vajoaa. Yksi laatta yli oman korkeuden,
 *                 eli mitään ei jää näkyviin — pölykasa on ainoa merkki, ja
 *                 sen pitää olla ainoa merkki.
 *   BURROW_SINK   vajoamisvauhti. 2 px/frame eli kaksikymmentä framea alas:
 *                 nopeampi lukisi katoamisena, hitaampi söisi kruunun ajan.
 *   BURROW_SPEED  maanalainen vauhti. Pelaajan kävely on 1,5 ja juoksu 2,5;
 *                 1,9 on siltä väliltä, eli maton voi juosten karistaa muttei
 *                 kävellen.
 *   BURROW_CLEAR  kuinka kaukana pelaajasta se saa nousta, laattoina. Kolme on
 *                 sama turvaväli kuin areenan pilareilla.
 */
const BURROW_DEPTH = 44;
const BURROW_SINK = 2;
const BURROW_SPEED = 1.9;
const BURROW_CLEAR = 3;
/** Ks. `updateBurrow`: yksi askel mahtuu tähän, ja se mitattiin. */
const BURROW_MARGIN = 4;
/** Kuinka usein maanalainen matka jättää pölyä. Rytmi, ei jatkuva pilvi. */
const BURROW_PUFF = 6;

const GIANT_STEP_AT = 2;
const GIANT_STEP_PX = 22;
const GIANT_STEP_SHAKE = 0.35;

/*
 * PIERUKUNINGAS — variantti 6, ja pelin ainoa megapomo.
 *
 * ## Mikä tässä on eri kuin isommassa pomossa
 *
 * Ilmeinen megapomo on isompi sprite ja enemmän osumia, ja se on väärä siitä
 * yksinkertaisesta syystä että se on **sama tappelu pidempänä**. Jokainen pomo
 * tässä pelissä vastaa osumaan kasvattamalla yhtä omaa lukuaan: nopeus +0,35,
 * luurangolla ja sääherralla +0,2, jättiläisellä koko +0,5. Numero nousee,
 * liikesarja pysyy, ja pelaajan työ on tehdä sama asia uudestaan hieman
 * nopeammin. Kuningas on ainoa jonka vastaus **ei ole numero**:
 *
 *     osuma ei kiihdytä häntä — se vaihtaa hänet joksikin toiseksi.
 *
 * Hän ottaa vuorollaan jokaisen seitsemän linnakkeen liikesarjan siinä
 * järjestyksessä kuin linna ne lähetti (maailmat 1–7, `KING_FORMS`), ja
 * seitsemäs osuma kaataa hänet. Pelaajan työ ei siis ole toistaa yhtä
 * opittua rytmiä loppuun asti vaan **tunnistaa kesken tappelun kuka juuri
 * saapui** — ja se on ainoa taito jonka maailma 8 on seitsemässä huoneessaan
 * opettanut. Maailman lause on että linnalla ei ole mitään uutta lähetettävää,
 * ja tämä on se lause yhdessä ruumiissa: **jokainen numero jonka kuningas
 * kantaa on jonkun toisen numero**, ei yhtään uutta mekaniikkaa.
 *
 * ## Se ainoa asia jota hän ei lainaa
 *
 * **Koko.** Jättiläisen liikkeen hän ottaa — nopeuden ja tiheämmän hyppykellon
 * — mutta ei puoltakaan kokoa, ja se on päätös eikä unohdus: koko on se ainoa
 * pomon ominaisuus tässä pelissä joka vaatii *toisen huoneen*. Jättiläisen
 * kannet ovat olemassa siksi että hänen päänsä karkaa voimatason 0 hypyn
 * ulottuvilta (ks. `boss_arena_big`), ja kuningas joka kasvaisi kesken
 * seitsemän muodon sarjan olisi joko saavuttamaton tai kutistuisi takaisin.
 * Hän pysyy yhden kokoisena koko tappelun, ja siksi lupaus voimatasosta 0
 * pysyy sillä mitalla jolla se on kaikille muillekin annettu.
 *
 * ## Miksi hän ei kiristä ikkunaansa
 *
 * `openFrames` kapenee jokaisella osumalla kaikilla muilla — se on niiden
 * toinen numero. Kuninkaalla se ei kapene, koska tappelu vaikeutuu jo
 * muuttumalla, ja kaksi kiristystä yhdestä osumasta on yksi liikaa (sama
 * perustelu kuin luurangon ja sääherran +0,2:lla).
 */
const KING = 6;
/**
 * Seitsemän linnaketta, maailmat 1–7, siinä järjestyksessä kuin linna ne
 * lähetti — jättiläinen kahdesti, koska linna lähetti hänet kahdesti (4-F ja
 * 5-F). Tämä taulu on kuninkaan osumapisteiden määrä: yksi muoto per osuma.
 *
 * Toisto ei ole huolimattomuutta vaan väitteen ainoa rehellinen muoto. Jos
 * tässä lukisi `[0,1,2,3,4,5]`, kuningas olisi *variantit* eikä *linnakkeet*,
 * ja maailma 8:n lause on nimenomaan että linna lähettää sen mitä se on jo
 * lähettänyt — ei sen sanaston josta se on koottu.
 */
const KING_FORMS = [0, 1, 2, 3, 3, 4, 5];

/**
 * Fortress boss. `variant` picks the move set:
 *   0 walk + jump, 1 landing shockwaves, 2 charges, 3 the giant that inflates,
 *   4 the skeleton that comes apart, 5 the weather lord who answers a hit by
 *   taking off, 6 the king who answers a hit by becoming one of the six.
 *
 * `variant` on se **kuka tämä on** ja `form` se **miten tämä liikkuu**. Kaikille
 * muille ne ovat sama luku alusta loppuun; kuninkaalle `variant` pysyy kuutena
 * (väri, arvomerkki, pisteet) ja `form` kiertää `KING_FORMS`in läpi.
 */
export class Boss extends Enemy {
  constructor(level, x, y, variant = 0) {
    super(level, x, y, bossSize(variant).w, bossSize(variant).h);
    this.variant = variant;
    this.king = variant === KING;
    /* Liikesarja. Ei-kuninkaalle sama luku kuin `variant`, joten jokainen
     * `this.form`-haara alla lukee muille täsmälleen sen mitä `this.variant`
     * luki ennen tätä muutosta. */
    this.form = this.king ? KING_FORMS[0] : variant;
    this.formIndex = 0;
    /*
     * Health per variant, and the two special cases are special for opposite
     * reasons. The giant (3) has five because every hit makes him bigger and
     * the fight needs room to change address. The skeleton (4) has four rather
     * than five because his own answer to a hit — coming apart, see `stomp` —
     * already costs the player a couple of seconds of getting off the floor,
     * so a fifth window would be padding rather than a fight.
     *
     * Kuninkaalla luku ei ole valittu vaan **johdettu**: yksi osuma per muoto,
     * eli seitsemän, koska linnakkeita on seitsemän. Jos joku joskus lisää
     * kahdeksannen linnakkeen, tämä luku seuraa perässä itsestään — ja se on
     * tarkoitus, koska käsin kirjoitettu seitsemän olisi juuri se numero joka
     * jää jälkeen.
     */
    this.hp = this.king ? KING_FORMS.length
      : variant === 3 ? 5 : variant === 4 ? 4 : 3 + Math.min(1, variant);
    /* Suolimato: neljä osumaa, sama kuin luurangolla ja samasta syystä toisin
     * päin. Luurangolla on neljä koska hän hajoaa itse; madolla on neljä koska
     * jokainen osuma maksaa yhden etsimisen, ja viides olisi sama etsiminen
     * kerran liikaa. */
    if (variant === 7) this.hp = 4;
    /** Onko runko maan alla. Ks. `updateBurrow`. */
    this.under = false;
    /* Lähtöpisteet talteen: areenapomon toinen vaihe alkaa ensimmäisestä
     * osumasta, ja "onko häneen osuttu" on juuri tämä vertailu. Ks.
     * `wakePillar`. */
    this.hp0 = this.hp;
    /** Onko tulohuuto huudettu. Ks. `update`: se lähtee heräämisestä. */
    this.greeted = false;
    this.score = 5000 + variant * 1000;
    this.invuln = 0;
    this.jumpTimer = 90;
    this.speed = 0.75 + this.form * 0.15;
    this.chargeTimer = 220;
    this.charging = 0;
    this.scale = 1;
    this.targetScale = 1;
    this.alwaysActive = true;
    this.active = true;
    /* Per boss, from the drawing's own table: the picture decides how big the
     * thing is and the hitbox follows, never the other way round. See
     * `BOSS_SIZES` for why **52 px** is the height ceiling — 64 was the number
     * in the first draft, and it is in that table as one of the two heights
     * that *failed* the power-0 stomp gate. A comment quoting a rejected draft
     * next to the constant that rejected it is worse than no comment. */
    /*
     * RIKOTUT RAAJAT, BITTIMASKINA.
     *
     * Numero eikä `Set`, koska pikatallennus sarjallistaa jokaisen oman kentän
     * `JSON.stringify`llä: `Set` katoaisi hiljaa tyhjäksi olioksi ja pelaaja
     * saisi rikkomansa nyrkit takaisin latauksesta. Sama laji vikaa kuin
     * osumalaatikko joka palasi vanhana — johdettu tila on johdettava, ja
     * *ansaittu* tila on sarjallistettava.
     */
    this.brokenLimbs = 0;
    this.baseW = bossSize(variant).w;
    this.baseH = bossSize(variant).h;
    this.spawnX = x;
    this.spawnY = y;
    this.maxHp = this.hp;
    // Starts open, so the first thing the player ever sees this boss do is the
    // thing they are supposed to do back.
    this.spikePhase = 'open';
    this.spikeTimer = SPIKE_OPEN;
    // Counts the take-it-off animation down. Zero at spawn on purpose: a boss
    // that started mid-doff would open the fight wearing the one thing that is
    // supposed to mean "not now".
    this.doffTimer = 0;
    // Counts the deck dust down after a growth. See DUST_FRAMES.
    this.deckDust = 0;
    /** Kuljettu matka viime askeleesta, pikseleinä. Ks. `updateStep`. */
    this.stepDist = 0;
  }

  get giant() { return this.variant === 3; }

  /**
   * No, and the reason is not that it would be hard to draw.
   *
   * The boss **is** the level: one entity worth 5.0 on the difficulty meter
   * against a walker's 1.0, several hit points, and a room built around it. A
   * quicksand pool in a boss arena that could remove it would be an instant win
   * button hidden in the floor, and the fight's own rules — the open window, the
   * spikes, the growth — would be worth nothing next to it. If a future arena
   * ever wants sand in it, the honest way is to make it a hazard the boss uses,
   * not a bin the boss falls into.
   */
  get sinks() { return false; }

  /**
   * How long the vulnerable window is at the current health.
   *
   * Kuninkaalla se ei kapene: hänen tappelunsa vaikeutuu vaihtumalla eikä
   * kiristymällä, ja kaksi kiristystä yhdestä osumasta on yksi liikaa — sama
   * perustelu kuin luurangon ja sääherran pienemmällä kiihdytyksellä.
   */
  get openFrames() {
    if (this.king) return SPIKE_OPEN;
    return Math.max(SPIKE_OPEN_MIN, SPIKE_OPEN - (this.maxHp - this.hp) * SPIKE_OPEN_STEP);
  }

  get spiky() { return this.spikePhase === 'spiky'; }

  /* Maan alla oleva runko ei ole huoneessa: siihen ei voi osua eikä se voi
   * osua. Sama sääntö kuin putkessa olevalla pelaajalla. */
  get harmless() { return this.under; }

  /**
   * 0..1 for the drawing: one clock for the whole crown, run up through the
   * telegraph and back down through the doff. The sprite reads every keyframe
   * — hands, band, points — off this single number.
   */
  get crownOn() {
    if (this.spikePhase === 'spiky') return 1;
    if (this.spikePhase === 'telegraph') return 1 - this.spikeTimer / SPIKE_TELEGRAPH;
    return Math.max(0, this.doffTimer / SPIKE_DOFF);
  }

  updateSpikes() {
    if (this.doffTimer > 0) this.doffTimer--;
    if (--this.spikeTimer > 0) return;
    if (this.spikePhase === 'open') {
      this.spikePhase = 'telegraph';
      this.spikeTimer = SPIKE_TELEGRAPH;
      Sfx.play('spikes');
      this.level.shake(1);
    } else if (this.spikePhase === 'telegraph') {
      this.spikePhase = 'spiky';
      this.spikeTimer = SPIKE_ON;
    } else {
      this.spikePhase = 'open';
      this.spikeTimer = this.openFrames;
      this.doffTimer = SPIKE_DOFF;
      Sfx.play('pipe');
      /*
       * Ja luuranko nauraa.
       *
       * Se on tässä kohdassa eikä kruunua laitettaessa, ja se on koko päätös.
       * Kruunun nouseminen päähän on **varoitus**, ja varoituksella on jo oma
       * äänensä (`spikes`) joka tarkoittaa samaa asiaa jokaisen pomon kohdalla
       * — toinen ääni sen päälle olisi kaksi merkkiä samasta asiasta, mikä on
       * juuri se mitä DESIGN.md kohta 8 kieltää. Kruunun laskeminen sen sijaan
       * on hetki jolloin häneen voi taas osua, ja siihen hetkeen kuuluu
       * ilkkuminen: "tässä olen, tule hakemaan". Se on tieto jonka pelaaja
       * saisi muutenkin kuvasta, ja siksi ääni saa olla luonnetta eikä ohjetta.
       */
      if (this.form === 4) Sfx.play('luuranko');
    }
  }

  /**
   * SUOLIMATO — kahdeksas variantti, ja sen koko idea on **missä** eikä
   * **milloin**.
   *
   * Maailma 8 väittää olevansa "jokainen pomo kerran", ja se oli totta vain jos
   * pöhöä ei laske kahdesti: pöhö on 4-F, 5-F, 8-4 ja 8-5, kun jokainen muu on
   * kahdesti. Tämä on se kahdeksas joka tekee väitteestä toden — mutta uusi
   * numero ei riitä, sen pitää olla uusi kysymys.
   *
   * Jokainen tämän pelin pomo kysyy *milloin*: kruunu nousee päähän, odota,
   * kruunu laskee, lyö. Mato kysyy **missä**. Se kaivautuu lattiaan siksi
   * aikaa kun kruunu on päässä — eli tasan sen ajan jolloin siihen ei kuitenkaan
   * voi osua — ja nousee jossain muualla siinä hetkessä kun siihen taas voi.
   * Pelaajan työ ei ole odottaa ikkunaa vaan **löytää se uudestaan**.
   *
   * Kolme päätöstä, ja jokainen on rajaus:
   *
   *   1. **Se liikkuu vain kruunu päässä.** Avoin ikkuna on siis kokonaan
   *      tallottavaa aikaa, aivan kuten jokaisella muulla pomolla — se lupaus
   *      on portissa lukuna (*"voimataso 0 tallaa yhden ikkunan sisällä"*), ja
   *      liikkuva maali avoimen ikkunan aikana rikkoisi sen hiljaa.
   *   2. **Kulkusuunta näkyy.** Maanalainen matka piirtyy pölykasana lattian
   *      pinnassa joka framella; mato ei siis katoa vaan menee. Ilman sitä tämä
   *      olisi arvontaa eikä seuraamista.
   *   3. **Se ei nouse jalkojen alta.** `BURROW_CLEAR` pitää nousukohdan
   *      vähintään kolmen laatan päässä pelaajasta. Sama sääntö ja sama syy
   *      kuin areenan pilareilla.
   */
  updateBurrow() {
    const p = this.level.player;
    const wantUnder = this.spikePhase !== 'open' && !this.dying;
    if (wantUnder && !this.under) {
      this.under = true;
      this.noclip = true;
      this.surfaceY = this.y;
      this.level.shake(2, 'y');
      Sfx.play('upota');
    }
    if (this.under) {
      /* Alas ensin, sitten sivuttain: kaivautuminen on liike eikä katoaminen,
       * ja pelaajan pitää nähdä kumpi tapahtui. */
      this.y = Math.min(this.surfaceY + BURROW_DEPTH, this.y + BURROW_SINK);
      this.vy = 0;
      const dir = p && p.cx < this.cx ? -1 : 1;
      this.facing = dir;
      this.x += BURROW_SPEED * dir;
      /* Pölykasa siihen kohtaan lattiaa jonka alla se juuri on. */
      if (this.tick % BURROW_PUFF === 0) {
        this.level.spawnPuff(this.cx, this.surfaceY + this.h - 2, this.tick % (BURROW_PUFF * 2) === 0);
      }
      if (!wantUnder) {
        /* Nousu: riittävän kaukana pelaajasta, ja mieluummin sillä puolella
         * jolla se jo on kuin hypäten hänen ylitseen. */
        if (p) {
          /* Turvaväli **plus yksi askel**: runko alkaa kävellä samalla
           * framella kun se nousee, ja mitattuna se söi juuri sen verran —
           * nousukohta oli 2,9 laattaa kun luvattiin kolme. Neljä pikseliä on
           * kaksinkertainen yhden framen liikkeeseen (1,6 px) nähden. */
          const clear = BURROW_CLEAR * TILE + BURROW_MARGIN;
          const dx = this.cx - p.cx;
          if (Math.abs(dx) < clear) this.x += (Math.sign(dx) || 1) * (clear - Math.abs(dx));
        }
        this.x = Math.max(TILE, Math.min(this.x, this.level.widthPx - this.w - TILE));
        this.y = this.surfaceY;
        this.under = false;
        this.noclip = false;
        this.level.shake(3, 'y');
        Sfx.play('jysahdys');
        for (let i = 0; i < 5; i++) {
          this.level.spawnPuff(this.x + 4 + i * 10, this.y + this.h - 2, i % 2 === 0);
        }
      }
    }
  }

  /**
   * Shakes dust off every plank above him. Runs for DUST_FRAMES after a growth
   * and does nothing at all in an arena with no planks in it, which is every
   * arena but the giant's — the signal is made of the thing it points at, so it
   * cannot end up pointing at nothing.
   */
  updateDeckDust() {
    if (--this.deckDust % DUST_EVERY) return;
    const head = Math.floor(this.y / TILE);
    const mid = Math.floor(this.cx / TILE);
    for (let tx = mid - DUST_REACH; tx <= mid + DUST_REACH; tx++) {
      // Every third column, marching sideways burst by burst: a whole plank
      // letting go at once is a collapse, and nothing is collapsing.
      if ((tx + this.deckDust) % 3) continue;
      for (let ty = 0; ty < head; ty++) {
        if (this.level.tileAt(tx, ty) !== T.PLATFORM) continue;
        this.level.spawnPuff(tx * TILE + TILE / 2, (ty + 1) * TILE + 2);
      }
    }
  }

  /**
   * Koko luetaan uudelleen `BOSS_SIZES`ista pikatallennusta purettaessa.
   *
   * Osumalaatikko on johdettu piirroksesta, ei tallennettu tosiasia: sama
   * sääntö kuin konstruktorissa, ja tässä se on se sääntö joka pitää vanhan
   * tallennuksen kelvollisena kun taulukko muuttuu. `applyScale` säilyttää
   * jalkojen tason ja keskilinjan, joten pomo ei hyppää palautuksessa.
   */
  /**
   * Raajojen osumalaatikot maailman koordinaateissa, peilaus ja `scale` mukana.
   *
   * Nämä ovat **vahinkoa eivätkä alustoja**: raajaan koskeminen sattuu kuten
   * kylkeen koskeminen, eikä sen päälle voi laskeutua. Laskeutuminen on rungon
   * ja kruunun asia, ja kruunu on se yksi merkki jonka pelaajan on luettava —
   * toinen tallottava pinta tekisi siitä kaksi kysymystä.
   */
  limbBoxes() {
    const limbs = BOSS_LIMBS[this.variant] || [];
    const S = this.scale;
    return limbs.map(([lx, ly, lw, lh], i) => {
      if (this.brokenLimbs & (1 << i)) return { x: 0, y: 0, w: 0, h: 0 };
      /* Peilaus oman leveyden ympäri, samoin kuin piirroksessa: vasemmalle
       * katsova pomo heiluttaa nyrkkiään vasemmalle. */
      const x = this.facing < 0 ? this.baseW - lx - lw : lx;
      return { x: this.x + x * S, y: this.y + ly * S, w: lw * S, h: lh * S };
    });
  }

  /**
   * Raaja katkeaa, ja se on **valinta eikä pakko**.
   *
   * Avoimen ikkunan aikana kruunu on pois, ja silloin koko kooste on
   * tallottavissa: runko maksaa osuman, raaja katkeaa pysyvästi. Vaihtokauppa
   * on ikkuna joka ei mennyt vahinkoon — mutta katkennut raaja vie mukanaan
   * oman vahinkoalueensa, eli loppufight on turvallisempi.
   *
   * DESIGN.md kohta 5 lupaa että pomon voi kaataa voimatasolla 0, ja se lupaus
   * on **vain rungosta**: raaja ei ole koskaan pakollinen, ja talloportti
   * todistaa sen käymällä läpi pelkän rungon.
   */
  breakLimb(i) {
    if (this.brokenLimbs & (1 << i)) return false;
    this.brokenLimbs |= (1 << i);
    /* Hitaampi joka katkenneesta raajasta: palkinto on luettava liikkeestä
     * eikä vain siitä että jotain katosi ruudulta. */
    this.speed = Math.max(0.4, this.speed - 0.12);
    this.level.spawnPuff(this.cx, this.cy, true);
    this.level.shake(1);
    return true;
  }

  rehydrate() {
    const size = bossSize(this.variant);
    this.baseW = size.w;
    this.baseH = size.h;
    this.applyScale();
  }

  applyScale() {
    const bottom = this.y + this.h;
    const cx = this.x + this.w / 2;
    this.w = Math.round(this.baseW * this.scale);
    this.h = Math.round(this.baseH * this.scale);
    this.x = cx - this.w / 2;
    this.y = bottom - this.h;
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();

    const player = this.level.player;
    if (this.invuln > 0) this.invuln--;

    if (this.scale !== this.targetScale) {
      this.scale += Math.sign(this.targetScale - this.scale) * 0.04;
      if (Math.abs(this.targetScale - this.scale) < 0.05) this.scale = this.targetScale;
      this.applyScale();
    }

    if (this.deckDust > 0) this.updateDeckDust();

    this.updateSpikes();

    /* SUOLIMATO kaivautuu, ja se tekee sen tasan silloin kun siihen ei voi
     * osua. Ks. `updateBurrow`. */
    if (this.form === 7) {
      this.updateBurrow();
      if (this.under) return;
    }

    /*
     * While the spines are out it stops hunting and just barrels along, turning
     * at walls. That is not decoration: a boss that chases with points up can
     * pin a powerless player against the end of the arena with nothing to do
     * about it, and the promise is that this fight is winnable at the smallest
     * size. Blind, it can always be walked around.
     */
    if (player && this.charging <= 0 && !this.spiky) {
      this.facing = player.cx < this.cx ? -1 : 1;
    }

    if (this.charging > 0) {
      this.charging--;
      this.vx = 3.4 * this.facing / Math.max(1, this.scale * 0.7);
    } else {
      this.vx = (this.speed / Math.max(1, this.scale * 0.6)) * this.facing;
    }
    if (moveX(this, this.level)) this.facing *= -1;

    /*
     * The boss chases the player, and the arena has open sides, so without this
     * it walks straight out into the corridor and falls down the first pit.
     * That leaves a fortress with no boss and a door that can never open —
     * the level becomes unwinnable with no way for the player to know why.
     * So it turns at ledges, exactly like the shell walkers do.
     */
    if (this.onGround && !footingAhead(this.level, this.x + this.facing * 4, this.y, this.w, this.h)) {
      this.facing *= -1;
      this.charging = 0;
      this.x += this.facing * 2;
    }

    /*
     * Tulohuuto, ja se on tässä eikä kentän aloituksessa.
     *
     * Pomo herää siinä kohtaa kun pelaaja astuu areenaan (`active`), ja juuri
     * se on se hetki jolloin "tässä olen" on tietoa: aiemmin soitettuna se
     * kuuluisi käytävään jossa pelaaja ei vielä näe ketään, ja ääni ilman
     * näkyvää syytä opettaa katsomaan väärään suuntaan.
     */
    if (!this.greeted && this.active) {
      this.greeted = true;
      bossSay(this.variant, 'arrive');
    }

    const fallSpeed = this.onGround ? 0 : this.vy;
    if (this.onGround && --this.jumpTimer <= 0) {
      this.vy = -5.6;
      this.jumpTimer = (this.form === 3 ? 60 : 80) + Math.floor(Math.random() * 60);
      Sfx.play('boss');
    }
    if (this.form >= 2 && this.onGround && !this.spiky && --this.chargeTimer <= 0) {
      this.charging = 45;
      this.chargeTimer = 200 + Math.floor(Math.random() * 120);
    }

    applyGravity(this, 1);
    moveY(this, this.level);

    // Last line of defence: if it ever gets out anyway, put it back rather than
    // let the level quietly become impossible.
    if (this.y > this.level.heightPx) {
      this.x = this.spawnX;
      this.y = this.spawnY;
      this.vx = 0;
      this.vy = 0;
      this.charging = 0;
    }

    // A hard landing sends shockwaves out along the floor. Only after a real
    // fall, and never more than a couple of pairs at a time.
    const live = this.level.entities.filter((e) => e instanceof Shockwave && !e.remove).length;
    if (this.onGround && fallSpeed > 3.5 && live < 4 && (this.form >= 1 || this.scale > 1.5)) {
      /*
       * AREENAPOMO: sama laskeutuminen joka lähettää aallon nostaa myös
       * pilarin — mutta vasta ensimmäisen osuman jälkeen.
       *
       * Kaksi päätöstä, ja molemmat ovat rajauksia.
       *
       * **Kuka.** Tämä on iskuaallon pomon liikettä (`form >= 1`) eikä uusi
       * laji, koska hänen sanansa on jo lattia: aalto juoksee sitä pitkin.
       * Pilarin nostaminen on sama lause voimakkaampana, ja se tarkoittaa myös
       * että **kuningas perii sen** kuudentena muotonaan — maailma 8:n lause on
       * että linna lähettää sen mitä se on jo lähettänyt.
       *
       * **Milloin.** `hp < hp0` eli vasta kun pelaaja on osunut kerran. Huone
       * joka järjestyy uusiksi ennen kuin pelaaja on nähnyt sen entisenä ei
       * ole muutos vaan pohjapiirros; toinen vaihe on vasta muutos.
       */
      if (this.hp < this.hp0 && this.level.wakePillar) this.level.wakePillar();
      this.level.add(new Shockwave(this.level, this.x - 6, this.y + this.h - 12, -1));
      this.level.add(new Shockwave(this.level, this.x + this.w - 6, this.y + this.h - 12, 1));
      // Pystyyn, ja massan verran: putoava paino osuu lattiaan alaspäin, ja se
      // on eri asia kuin siitä lähtevä aalto. Aalto kulkee lattiaa pitkin, ja
      // sen oma suunta näkyy siellä missä aalto tulee ilman laskeutumista —
      // luurangon hajoamisessa (`stomp`).
      this.level.shake(2 + this.scale, 'y');
      Sfx.play('stomp');
    }

    this.updateStep();
  }

  /**
   * JÄTTILÄISEN ASKEL.
   *
   * Kolmanteen kokoonsa puhaltunut pomo painaa niin paljon että sen kävely
   * tuntuu lattiassa. Kolme päätöstä, ja kukin on oma väitteensä:
   *
   *   - **Askel on matkaa, ei kelloa.** `stepDist` kerää kuljetun pikselimäärän,
   *     joten syöksyssä askeleet tihenevät itsestään ja seisova pomo on
   *     hiljaa. Ajastin olisi antanut paikallaan seisovalle jättiläiselle
   *     askelia, ja se olisi lukenut rikkinäiseltä kuvalta.
   *   - **Vain massa tärisyttää.** Alle `GIANT_STEP_AT`:n kokoinen pomo ei
   *     tärisytä lainkaan — myöskään se sama pomo ennen kahta osumaansa. Näin
   *     tärinä on *tieto siitä että hän kasvoi* eikä pomon vakio-ominaisuus.
   *   - **Askel jää laskeutumista pienemmäksi.** Sama olio, kaksi tapahtumaa;
   *     jos ne kuulostaisivat yhtä kovilta, niin kävelevä jättiläinen huutaisi
   *     yhtä lujaa kuin putoava, eikä putoamisesta väistäminen tuntuisi
   *     miltään.
   *
   * Ääntä ei tule. Pomoääniä on kaksi opeteltavaa (`boss`, `stomp`), ja kolmas
   * olisi kolmas — sama perustelu jolla kuninkaan muodonvaihdos jäi olemassa
   * olevan äänen varaan.
   */
  updateStep() {
    if (this.scale < GIANT_STEP_AT || !this.onGround) {
      this.stepDist = 0;
      return;
    }
    this.stepDist = (this.stepDist || 0) + Math.abs(this.vx);
    if (this.stepDist < GIANT_STEP_PX) return;
    this.stepDist = 0;
    this.level.shake(GIANT_STEP_SHAKE * this.scale, 'y');
  }

  stomp() {
    if (this.invuln > 0) return true;
    this.hp--;
    this.invuln = 70;
    this.charging = 0;
    Sfx.play('stomp');
    if (this.king) {
      /*
       * KUNINGAS VAIHTUU.
       *
       * Koko megapomo on tässä yhdessä haarassa, ja se on tarkoituksella
       * lyhyt: `update()` osaa jo jokaisen kuuden liikesarjan, joten ainoa
       * asia joka tässä tapahtuu on että `form` siirtyy seuraavaan. Uutta
       * mekaniikkaa ei synny riviäkään, mikä on koko väite — linnalla ei ole
       * mitään uutta lähetettävää, ja tämä on se lause koodina.
       *
       * Nopeus luetaan uudesta muodosta samalla kaavalla kuin
       * konstruktorissa, eli se voi myös **laskea**. Se on ero jokaiseen
       * muuhun pomoon: heillä numero vain nousee.
       *
       * Signaali on kuva ja ääni yhdessä (DESIGN.md kohta 8), ja molemmat
       * sanovat nyt **kuka** eivätkä *että*: `onKingForm` pukee ruudun sen
       * maailman väriin josta muoto tulee ja soittaa saapumisen oman äänen.
       *
       * Ennen tässä luki `Sfx.play('fart')`, ja se oli lainaa: sama ääni on
       * jättiläisen kasvun ääni kahta riviä alempana. Yksi merkki kahdelle
       * tilanvaihdokselle opettaa lukemaan toisen niistä väärin, ja tässä se
       * oli erityisen kallista — kuningas *ei* kasva, joten ääni lupasi
       * täsmälleen sen mitä hän ainoana pomona ei tee. Ruskea pilvi jää: se on
       * hänen omaa kaasuaan ja se on paikallinen, kun taas verho on ruudun
       * kokoinen.
       */
      const wasIndex = this.formIndex;
      this.formIndex = Math.min(this.formIndex + 1, KING_FORMS.length - 1);
      this.form = KING_FORMS[this.formIndex];
      this.speed = 0.75 + this.form * 0.15;
      this.chargeTimer = 200;
      this.level.spawnPuff(this.cx, this.cy, true);
      this.level.shake(2);
      /*
       * Vain kun joku oikeasti saapui. Viimeinen osuma kaataa hänet eikä
       * vaihda mitään (`formIndex` on jo viimeinen), ja merkki joka laukeaa
       * kun mikään ei muuttunut on nopein tapa opettaa pelaaja sivuuttamaan
       * se — sama perustelu ja sama ehto kuin jättiläisen kansipölyllä alla.
       *
       * Ehto on `formIndex` eikä `form`, ja se on tarkoituksellinen: neljäs ja
       * viides osuma antavat molemmat jättiläisen liikkeet (`KING_FORMS`
       * sisältää kolmosen kahdesti, koska linna lähetti hänet 4-F:ssä ja
       * 5-F:ssä), mutta ne ovat kaksi eri linnaketta ja siis kaksi eri väriä.
       * Juuri se pari on koko maailman lause otettuna kirjaimellisesti.
       */
      if (this.formIndex !== wasIndex) this.level.onKingForm(this.formIndex);
    } else if (this.giant) {
      // Puffs up half a size with every hit, all the way to three times over.
      const before = this.targetScale;
      this.targetScale = Math.min(3, this.targetScale + 0.5);
      Sfx.play('fart');
      // Only when he actually got bigger. At full size the fight has stopped
      // changing address, and a signal that fires when nothing changed is the
      // fastest way to teach a player to ignore it.
      if (this.targetScale > before) this.deckDust = DUST_FRAMES;
    } else if (this.variant === 4) {
      /*
       * LUURANKO HAJOAA JA KOKOAA ITSENSÄ.
       *
       * Every other boss answers a hit by speeding up, which is a number the
       * player feels three seconds later. A skeleton can answer it in the same
       * frame: he comes apart, the bones clatter out along the floor, and he is
       * standing again by the time they are gone. So a hit on this one *pays
       * out in information* — you see that it landed — and it also pays a bill,
       * because the two waves are two things to get away from.
       *
       * `Shockwave` and not a new entity, deliberately. It is the object the
       * player already knows means "get off the floor" (the giant makes them
       * when he lands), and reusing it keeps `REGISTRY` in `savestate.js`
       * exactly as it is — a new entity class here would be a save-state
       * migration for what is, honestly, a puff of bones.
       *
       * He speeds up too, but by less than the others: the clatter is the
       * escalation, and two escalations for one hit is one too many.
       */
      this.level.add(new Shockwave(this.level, this.x - 6, this.y + this.h - 12, -1));
      this.level.add(new Shockwave(this.level, this.x + this.w - 6, this.y + this.h - 12, 1));
      // Sivusuuntaan: tässä ei pudonnut mikään, vaan lattiaa pitkin lähti kaksi
      // aaltoa vastakkaisiin suuntiin — ja juuri se on se asia jonka pelaajan
      // pitää lukea, koska molemmista väistetään ylöspäin eikä sivuun.
      this.level.shake(3, 'x');
      this.speed += 0.2;
    } else if (this.variant === 5) {
      /*
       * SÄÄHERRA NOUSEE.
       *
       * Osuma ei kiihdytä häntä juuri lainkaan; se lähettää hänet ylös. Se on
       * sama kysymys kuin luurangolla — mitä pomo *vastaa* osumaan — mutta
       * vastaus tulee tämän maailman aiheesta: sää väistää ylöspäin, ja
       * ilmakehän herra ei pakene sivulle vaan omaan elementtiinsä.
       *
       * Ja tämä on halpa juuri siksi että koneisto on jo olemassa. `jumpTimer`
       * on hänen oma hyppykellonsa, ja sen nollaaminen tarkoittaa että hän
       * hyppää seuraavalla framella; variantti >= 1 heittää alastulosta
       * iskuaallot, koska pudotus on nopeampi kuin 3,5. Yksi rivi tuottaa siis
       * ketjun — osuma, nousu, alastulo, kaksi aaltoa — eikä `REGISTRY`
       * (savestate.js) muutu, koska mitään uutta entiteettiä ei synny.
       *
       * Nopeus nousee 0,2:lla eikä 0,35:llä samasta syystä kuin luurangolla:
       * nousu on se kiihdytys, ja kaksi kiihdytystä yhdestä osumasta on yksi
       * liikaa.
       */
      this.jumpTimer = 1;
      this.speed += 0.2;
    } else {
      this.speed += 0.35;
    }
    /*
     * Murahdus ja parkaisu, ja **kuningas puhuu sen äänellä joka hän juuri on**.
     *
     * Muille `variant` ja `speaker` ovat sama luku, eli mikään ei muutu. Kuningas
     * ottaa osumasta seuraavan linnakkeen muodon (`KING_FORMS`), ja siitä
     * hetkestä eteenpäin hänen murahduksensa on sen linnakkeen murahdus — sama
     * lause äänenä kuin se mikä hän on. Oman äänensä hän saa takaisin
     * kaatuessaan, koska se on hetki jolloin hän on taas vain oma itsensä.
     */
    if (this.hp <= 0) {
      this.dying = true;
      this.noclip = true;
      this.vy = -5;
      this.vx = this.facing * -1.2;
      bossSay(this.variant, 'die');
      this.level.awardScore(this.score, this.cx, this.y);
      this.level.onBossDefeated();
    } else {
      bossSay(this.variant, 'hurt', this.king ? this.form : this.variant);
    }
    return true;
  }

  hitByProjectile() { /* immune — it is made of the same stuff */ }
  hitByShell(dir) { this.stomp(dir); }
  hitByTail() { /* immune */ }

  draw(ctx) {
    const frame = this.tick;
    if (this.dying) {
      this.drawFlipped(ctx, () =>
        drawBoss(ctx, this.x - 1, this.y, frame, this.facing, false, this.variant,
          this.scale, 0, this.brokenLimbs));
      return;
    }
    drawBoss(ctx, this.x - 1, this.y, frame, this.facing, this.invuln > 0, this.variant,
      this.scale, this.crownOn, this.brokenLimbs);
  }
}

/*
 * PAPUPAROONI — the desert mini-boss, and there are always two of them.
 *
 * The barons are the pieruprinssi's tax collectors in the dunes, and what they
 * are collecting is beans. Between them they are sitting on the only
 * paukkupapu in the game (see POWER_TYPES in player.js): beat both, and the
 * last one drops it. Nothing else in the game hands that power-up out, which is
 * why the drop is written here and not in `rollPowerup` — a block that could
 * roll it would make the whole fight optional.
 *
 * What makes it a fight rather than an enemy, in three decisions:
 *
 *   - **Two of them, on separate plinths.** One thrower is a timing puzzle; two
 *     is a crossfire, and the arena has to be read rather than walked through.
 *     They also share one drop, so beating the first one is progress and not a
 *     reward — the fight has a middle.
 *   - **Two health each, and a stomp still works.** Every boss in this game is
 *     beatable at power level 0 and this one is no exception: the default
 *     answer is the right answer, it just has to land twice. Spines would have
 *     closed that door, and the door is the promise.
 *   - **The throw is telegraphed.** The bean goes up over the baron's head for
 *     half a second before it leaves, and the arc is slow. What can hurt you has
 *     to be visible (DESIGN.md 7), and a lobbed thing you cannot destroy has to
 *     be a thing you can read.
 */
/** Frames between lobs, and how long the arm is up before one leaves. */
const BARON_THROW = 132;
const BARON_WINDUP = 34;
/** How close the player has to be to be worth a bean. */
const BARON_RANGE = 210;
/**
 * And how far from its plinth a baron will wander. Measured against the arena
 * rather than picked: a plinth is five tiles (80 px) and a baron is 18 px wide,
 * so 28 px either side of the middle is as far as one can go with its whole
 * body still on the stone. Further than that it teeters over the edge, which
 * looks like a bug in the fight rather than a boss taking a step.
 */
const BARON_PATROL = 28;
/** The lob: rise, gravity, and the ceiling on how hard one can be thrown. */
const BOMB_LIFT = -4.2;
const BOMB_GRAVITY = 0.18;
const BOMB_FLIGHT = (2 * -BOMB_LIFT) / BOMB_GRAVITY;
const BOMB_MAX_VX = 3.0;

/**
 * Papupommi — a bean thrown by a baron, arcing, bouncing once, and bursting.
 *
 * A hazard rather than an enemy, and that is the same call `Heartburn` makes:
 * it cannot be stomped, trapped or killed, so calling it an enemy would put it
 * in every loop that offers the player a way to remove it and then refuse. The
 * answer to it is to not be there.
 */
export class BeanBomb extends Entity {
  constructor(level, x, y, vx) {
    super(level, x, y, 10, 10);
    this.kind = 'hazard';
    this.vx = vx;
    this.vy = BOMB_LIFT;
    this.bounces = 1;
    this.life = 260;
    this.active = true;
    Sfx.play('squeak');
  }

  burst() {
    this.remove = true;
    this.level.spawnPuff(this.cx, this.cy, true);
    Sfx.play('pop');
  }

  /**
   * Laki 4: **potkaistu kuori tappaa sen mihin osuu**, ja tämä on se osuma
   * jota `shellSweep` ei ollut koskaan katsonut.
   *
   * Papupommi on `kind: 'hazard'` eikä `'enemy'`, ja pyyhkäisy luki vain
   * vihollisia — eli pelin ainoa heitetty ammus oli ainoa asia jonka läpi
   * liukuva kuori meni sanomatta mitään. Se on puhdas olio ↔ olio: maastoa ei
   * ole mukana, kenttä ei muutu, ja pelaaja saa uuden vastauksen papuparoonin
   * kysymykseen. Närästysliekki ei saa tätä metodia eikä se ole unohdus:
   * liekki nousee lattiasta ja on sitä huonetta, ei kappale siinä.
   */
  hitByShell() { this.burst(); }

  update() {
    this.tick++;
    if (--this.life <= 0) {
      this.burst();
      return;
    }
    if (moveX(this, this.level)) {
      this.burst();
      return;
    }
    this.vy = Math.min(this.vy + BOMB_GRAVITY, 5);
    const hit = moveY(this, this.level);
    // One bounce, so a bean that lands short is still a thing to step over for
    // a moment. The second landing is where it goes off.
    if (hit.ground) {
      if (this.bounces-- > 0) this.vy = -2.4;
      else this.burst();
    }
    if (hit.ceiling) this.vy = 0.5;
    if (this.y > this.level.heightPx + 16) this.remove = true;
  }

  draw(ctx) {
    drawBeanBomb(ctx, this.x, this.y, this.tick);
  }
}

export class BeanBaron extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 18, 26);
    this.speed = 0.45;
    this.score = 2000;
    this.hp = 2;
    this.invuln = 0;
    this.throwTimer = BARON_THROW;
    this.windup = 0;
    this.hopTimer = 70 + Math.floor(Math.random() * 60);
    /* Where it was put. A baron that wandered off would take the game's only
     * paukkupapu with it — and, worse, could follow the player to the flag,
     * which turns an arena into an escort. Same reasoning as the boss's
     * out-of-bounds catch, applied before it happens rather than after. */
    this.homeX = x;
    /* Part of the level's state, not scenery near the camera: the drop must not
     * be tidied away because the player backtracked past the arena. */
    this.alwaysActive = true;
    this.active = true;
  }

  /* A bubble would carry a mini-boss off its plinth and hand the player the
   * kill for one shot. It takes its hits like the sun does: two, from
   * anything. */
  get bubbleable() { return false; }

  /**
   * No, and it is the same sentence as `bubbleable` in a different tile.
   *
   * It is bolted to its plinth on purpose — `homeX` exists so it cannot wander
   * off — and a mini-boss that could be walked into a puddle would be a
   * two-hit fight with a one-step answer. It also carries the game's only
   * paukkupapu, so removing it for free removes the reward for the harder
   * branch, which is the whole point of 2-M.
   */
  get sinks() { return false; }

  takeHit(dir) {
    if (this.invuln > 0 || this.dying) return;
    this.hp--;
    this.invuln = 48;
    this.windup = 0;
    this.throwTimer = Math.max(this.throwTimer, 40);
    if (this.hp > 0) {
      Sfx.play('bump');
      return;
    }
    this.defeat(dir);
  }

  hitByProjectile(dir) { this.takeHit(dir); }
  hitByShell(dir) { this.takeHit(dir); }
  hitByTail(dir) { this.takeHit(dir); }

  stomp() {
    this.takeHit(this.facing * -1 || 1);
    return true;
  }

  /**
   * The end of the fight — but only when it is the end of the fight.
   *
   * The prize belongs to the pair and not to either baron, so it is the last
   * one standing that drops it. Checking for a live sibling rather than
   * counting kills means a baron removed some other way (a save state loaded
   * mid-fight, a fall out of the world) cannot leave the drop owed to nobody.
   */
  defeat(dir) {
    this.tumble(dir);
    this.level.awardScore(this.score, this.cx, this.y);
    const other = this.level.entities.some((e) => e instanceof BeanBaron
      && e !== this && !e.dying && !e.remove);
    if (other) {
      Sfx.play('kick');
      return;
    }
    this.level.add(new Item(this.level, this.cx - 8, this.y + 2, 'pop', { emerge: false }));
    this.level.addScorePop(this.cx, this.y - 12, 'PAUKKUPAPU');
    this.level.shake(3);
    /* `payout` eikä `powerup`: parooni pudottaa jotain, mutta kukaan ei ole
     * vielä poiminut sitä. Sama jako kuin lohkoilla (`scenes/level.js`) —
     * `powerup` on se hetki jolloin pelaaja kasvaa, ja lainattuna se lupaa
     * kasvun jota ei tapahtunut. Nämä kaksi kohtaa olivat viimeiset joissa
     * jako ei ollut vielä tehty. */
    Sfx.play('payout');
  }

  /** Lobs one bean at where the player is standing. @returns the bomb. */
  throwBomb() {
    const player = this.level.player;
    const dx = player ? player.cx - this.cx : 80 * this.facing;
    const aim = Math.max(-BOMB_MAX_VX, Math.min(BOMB_MAX_VX, dx / BOMB_FLIGHT));
    if (aim !== 0) this.facing = Math.sign(aim);
    const bomb = new BeanBomb(this.level, this.cx - 5, this.y - 6, aim);
    this.level.add(bomb);
    return bomb;
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.invuln > 0) this.invuln--;

    const player = this.level.player;
    const near = player && Math.abs(player.cx - this.cx) < BARON_RANGE;

    if (this.windup > 0) {
      // Rooted while the arm is up: the telegraph is a promise about where the
      // throw comes from, and a baron that walked during it would break it.
      this.vx = 0;
      if (--this.windup === 0) this.throwBomb();
    } else {
      if (near && --this.throwTimer <= 0) {
        this.windup = BARON_WINDUP;
        this.throwTimer = BARON_THROW + Math.floor(Math.random() * 50);
        this.facing = player.cx < this.cx ? -1 : 1;
        Sfx.play('boss');
      }
      this.vx = this.speed * this.facing;
      if (moveX(this, this.level)) this.facing *= -1;
      // Careful about ledges like the shell walkers, and kept near home on top
      // of that: the terrain answer alone would let one hop off its plinth.
      if (this.onGround
        && !footingAhead(this.level, this.x + this.facing * 3, this.y, this.w, this.h)) {
        this.facing *= -1;
      }
      if (Math.abs(this.x - this.homeX) > BARON_PATROL) {
        this.facing = Math.sign(this.homeX - this.x) || 1;
      }
      // A hop, so a stomp is a matter of timing rather than of walking up to it.
      if (this.onGround && --this.hopTimer <= 0) {
        this.vy = -3.6;
        this.hopTimer = 80 + Math.floor(Math.random() * 70);
      }
    }

    applyGravity(this, 0.95);
    moveY(this, this.level);
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  draw(ctx) {
    const frame = Math.floor(this.tick / 7);
    const lift = this.windup > 0 ? 1 - this.windup / BARON_WINDUP : 0;
    if (this.dying) {
      this.drawFlipped(ctx, () => drawBeanBaron(ctx, this.x, this.y, frame, this.facing, 0, false));
      return;
    }
    drawBeanBaron(ctx, this.x, this.y, frame, this.facing, lift,
      this.invuln > 0 && Math.floor(this.tick / 3) % 2 === 0);
  }
}

/**
 * Kuu — hangs in the night sky and bobs. Jump onto it and it hands over a
 * power-up. It cannot hurt you; the challenge is getting up there at all.
 * (Lead designer's request.)
 */
export class Moon extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 20, 20);
    this.skyY = y;
    this.score = 1000;
    this.used = false;
    this.alwaysActive = true;
    this.active = true;
  }

  get harmless() { return true; }

  update() {
    this.tick++;
    this.y = this.skyY + Math.sin(this.tick / 40) * 3;
  }

  stomp() {
    if (this.used) return true;
    this.used = true;
    /*
     * It *drops* the prize, rather than budding one out of its own top.
     * `emerge` is the question-block animation — an item pushing up out of a
     * brick — and a moon hanging in the night sky is not a brick. Spawned just
     * below it and left to fall, which is also where the player already is:
     * they have just bounced off the top of it.
     */
    this.level.add(new Item(this.level, this.x + 2, this.y + 14,
      this.level.rollPowerup(this.level.player), { emerge: false }));
    this.level.spawnPuff(this.cx, this.y + 16);
    this.level.awardScore(this.score, this.cx, this.y);
    /* `payout`, ks. `BeanBaron.defeat`: kuu antoi jotain, se ei kasvattanut
     * ketään. Poimiminen soittaa `powerup`in omalla vuorollaan. */
    Sfx.play('payout');
    return true;
  }

  hitByProjectile() { /* it is the moon */ }
  hitByShell() { }
  hitByTail() { }

  /**
   * It already draws a halo; a moon that hung in a dark sky without lighting
   * anything would be a picture of a moon. Weak and wide: it is a landmark you
   * steer by from across the level, not a lamp — the ground under it stays dim
   * enough that you still want to be standing in your own light.
   *
   * It breathes on the same beat as the halo, and goes down to almost nothing
   * once it has paid out, so a spent moon stops being a place worth going.
   */
  get light() {
    return light(this.cx, this.cy, 64,
      this.used ? 0.16 : 0.42 + 0.04 * Math.sin(this.tick / 14));
  }

  draw(ctx) {
    const cx = Math.round(this.x) + 10;
    const cy = Math.round(this.y) + 10;
    const glow = this.used ? 0.05 : 0.12 + 0.05 * Math.sin(this.tick / 14);
    ctx.fillStyle = `rgba(255,248,200,${glow})`;
    for (let dy = -18; dy <= 18; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, 324 - dy * dy)));
      ctx.fillRect(cx - half, cy + dy, half * 2, 1);
    }
    /*
     * A crescent, not a disc: it is a *moon*, and a plain bright circle in a
     * night sky is a sun with the lights off.
     *
     * Drawn as a disc minus a second disc offset up and to the right, one row
     * at a time. Subtracting spans rather than compositing keeps it a single
     * pass with no canvas state to restore, and keeps the edge pixel-sharp
     * instead of the soft rim a composite operation would leave.
     */
    const R = 10;
    const BITE_R = 9;
    const biteX = 5;
    const biteY = -3;
    ctx.fillStyle = this.used ? '#8a8470' : '#e8d89a';
    for (let dy = -R; dy <= R; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy)));
      if (half <= 0) continue;
      const bd = dy - biteY;
      const bite = bd * bd < BITE_R * BITE_R
        ? Math.round(Math.sqrt(BITE_R * BITE_R - bd * bd)) : -1;
      const left = cx - half;
      const right = cx + half;
      // Where the bite starts, on this row. Everything right of it is gone.
      const cut = bite >= 0 ? cx + biteX - bite : right;
      if (cut > left) ctx.fillRect(left, cy + dy, Math.min(right, cut) - left, 1);
    }

    // The lit inner edge, following the same crescent so it cannot drift off it
    ctx.fillStyle = this.used ? '#a8a290' : '#fff8d8';
    for (let dy = -R + 2; dy <= R - 2; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy)));
      if (half <= 1) continue;
      ctx.fillRect(cx - half, cy + dy, 2, 1);
    }

    // two craters, kept on the thick side of the crescent
    ctx.fillStyle = this.used ? '#8a8470' : '#d8c88a';
    ctx.fillRect(cx - 6, cy - 3, 3, 3);
    ctx.fillRect(cx - 5, cy + 3, 2, 2);
  }
}

/* ========================= NELJÄ UUTTA VIHOLLISTA =========================
 *
 * Omistajan tilaus 16.8.2026: peli on normaalilla liian helppo, ja syy ei ole
 * määrä vaan **sanasto**. Siihen asti jokainen vihollinen tässä tiedostossa
 * vastasi samaan kysymykseen — *milloin hyppään sen yli tai päälle* — ja kun
 * yksi kysymys osataan, kenttien pidentäminen kysyy sitä useammin eikä
 * vaikeammin. Neljä alla olevaa kysyvät kukin eri kysymyksen, ja ne on valittu
 * niin että ne peittävät neljä eri **etäisyyttä**:
 *
 *   TÖRÄHDYSTORVI  kaukaa vaakasuoraan — reitti täyttyy, vauhti on ainoa vara
 *   PAARMA         ylhäältä alas — turvallinen paikka ei ole enää paikka
 *   YÖKKI          lattiaa pitkin — este tulee sinne missä jalat ovat
 *   PAUKKUPÖHÖ     lähietäisyydeltä, ja vasta kun siihen on koskettu
 *
 * Kaikki neljä ovat tämän pelin omia otuksia (DESIGN.md kohta 1 c): mekaniikat
 * ovat genren yhteistä omaisuutta ja siksi vapaita, mutta se *mikä* ne ovat on
 * kirjoitettu tämän pelin omasta rekisteristä — kaasua, ruoansulatusta ja
 * sisuskaluja — samasta sanastosta kuin pöhö, pönttö, nielu ja kurnuttaja.
 *
 * Ja kaikki neljä noudattavat sitä yhtä sääntöä joka pitää tämän pelin kasassa:
 * **jokaisella on vastaus jonka pelaaja jo osaa.** Yksikään ei ole seinä.
 */

/* --------------------------- törähdystorvi ------------------------------- */

/**
 * Framet laukausten välillä, ja se osa siitä joka on varoitusta.
 *
 * `TORVI_PERIOD` on mitoitettu ammuksen omasta vauhdista: 2,2 px/frame kantaa
 * 145 framessa yhden ruudun leveyden (320 px), joten tällä välillä ruudulla on
 * kerrallaan korkeintaan yksi ja puoli törähdystä samasta torvesta. Tiheämpi
 * olisi seinä eikä este.
 *
 * `TORVI_WARN` on se aika jona torvi on jo pullollaan muttei vielä päästänyt.
 * Puoli sekuntia on sama varoitus kuin närästysliekillä (40 framea), ja se on
 * tässä samasta syystä: ammus lähtee vaakasuoraan eikä pelaaja voi nähdä sitä
 * tulevan ennen kuin se on jo matkalla, joten se hetki jona liikkeen voi vielä
 * peruuttaa on ostettava ennen laukausta eikä sen jälkeen.
 *
 * `TORVI_NEAR` on lähiraja. Torvi ei ammu pelaajaa joka seisoo sen kyljessä:
 * ammus syntyy 16 px sivuun, eli sitä lähempänä se syntyisi pelaajan sisään.
 * Se on myös se seikka joka tekee torvesta *paikan* eikä ansan — sen viereen
 * pääsee, ja sen päälle voi hypätä.
 */
const TORVI_PERIOD = 150;
const TORVI_WARN = 40;
const TORVI_NEAR = 40;
const TORVI_RANGE = 200;
/**
 * Ammuksen vauhti ja ikä. 2,2 px/frame on nopeampi kuin mikään mikä tässä
 * pelissä kävelee (kuori 3,4 on ainoa nopeampi, ja se on pelaajan potkaisema)
 * ja hitaampi kuin pelaajan juoksu 2,5 — eli **siitä pääsee karkuun eteenpäin
 * juoksemalla**, mikä on koko sen tasapaino: se painostaa reittiä pitkin eikä
 * pysäytä sitä.
 */
const TORAHDYS_SPEED = 2.2;
const TORAHDYS_LIFE = 400;

/**
 * TÖRÄHDYS — se mikä torvesta tulee. Tiivistettyä suolikaasua teräksisessä
 * kuoressa, ja se kulkee suoraan: ei painovoimaa, ei ohjausta, ei väsymistä.
 *
 * Se on `Enemy` eikä `hazard`, ja se on tämän olion koko suunnittelupäätös.
 * Papupommi ja happopisara ovat vaaroja — niitä väistetään ja siinä kaikki —
 * mutta törähdys on **tallattava**, eli se on samalla kertaa este ja askelma.
 * Juuri se tekee siitä pelin ensimmäisen vihollisen joka *auttaa* pelaajaa:
 * kuilun yli lentävä törähdys on silta jos sen päälle uskaltaa hypätä.
 *
 * Ei kuplaan (`bubbleable`), koska se ei ole elävä: kupla on ansa jossa jotain
 * odottaa pääsyä ulos, ja tämä on ammus jolla ei ole aikomuksia. Ei hiekkaan
 * (`sinks`), koska se ei koskaan koske maahan. Ei tuuleen (`windborne`), koska
 * se on ammuttu eikä kannettu — puuska joka kääntäisi luodin tekisi torvesta
 * arpapelin sillä puolella kenttää jossa tuulee.
 */
export class Torahdys extends Enemy {
  constructor(level, x, y, dir) {
    super(level, x, y, 16, 12);
    this.facing = dir;
    this.vx = TORAHDYS_SPEED * dir;
    this.life = TORAHDYS_LIFE;
    this.score = 200;
    /* Ammuttu on ammuttu: se ei odota kameraa herätäkseen. Ilman tätä torven
     * laukaus ruudun reunalla jäisi leijumaan paikalleen siihen asti kunnes
     * pelaaja tulee katsomaan, ja saapuisi silloin päin naamaa. */
    this.active = true;
  }

  get bubbleable() { return false; }

  get sinks() { return false; }

  get windborne() { return false; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (--this.life <= 0) {
      this.burst();
      return;
    }
    /* `moveX` eikä `x += vx`: seinä pysäyttää sen. Ammus joka menisi kiven
     * läpi opettaisi että kivi ei ole este, ja se on kalliimpi valhe kuin
     * yksikään yksittäinen osuma. */
    if (moveX(this, this.level)) {
      this.burst();
      return;
    }
    // Kaasuvana perässä, joka kolmas frame — sama tiheys kuin maahaniskun
    // syöksyllä, koska se on sama asia: paine joka työntää.
    if (this.tick % 3 === 0) this.level.spawnPuff(this.cx - this.facing * 8, this.cy);
  }

  burst() {
    this.remove = true;
    this.level.spawnPuff(this.cx, this.cy, true);
    Sfx.play('pop');
  }

  draw(ctx) {
    if (this.dying) {
      this.drawFlipped(ctx, () => drawTorahdys(ctx, this.x, this.y, this.tick, this.facing));
      return;
    }
    this.drawSprite(ctx, (g) => drawTorahdys(g, this.x, this.y, this.tick, this.facing));
  }
}

/**
 * TÖRÄHDYSTORVI — messinkinen venttiili joka on ruuvattu kiinni siihen mihin se
 * on pantu, ja joka päästää paineen ulos vaakasuoraan.
 *
 * **Se on tallattava, ja se on päätös eikä unohdus.** Torvi joka ei kuole olisi
 * kello jonka rytmiä pelaaja vain sietää; tallattava torvi on *kohde*, ja koko
 * kysymys muuttuu siitä "milloin pääsen ohi" siihen "kannattaako minun mennä
 * sen päälle". Vastaus ei ole ilmainen: sen päälle pääsee vain siitä suunnasta
 * josta ammukset tulevat, ja hyppy sen päälle on hyppy suoraan siihen linjaan.
 * Palkkio on 500 — enemmän kuin mikään muu tallaus tässä pelissä — koska se on
 * ainoa tallaus joka sammuttaa lähteen eikä yhtä otusta.
 *
 * Se ei kuple eikä uppoa: se on pultattu paikalleen, samoin perustein kuin
 * nielu on pultattu putkeensa. Papuparoonin `homeX`-perustelu sanoo saman
 * asian toisesta suunnasta — laite joka voidaan kävelyttää pois paikaltaan ei
 * enää vartioi mitään.
 */
export class Torvi extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    this.score = 500;
    this.timer = TORVI_PERIOD;
    this.charge = 0;
    /* Osa kentän tilaa eikä kameran lähellä olevaa maisemaa: torvi on rakenne,
     * ja rakenne ei katoa siksi että pelaaja peruutti sen ohi. Ammukset sen
     * sijaan ovat lyhytikäisiä ja siivoutuvat itse. */
    this.alwaysActive = true;
    this.active = true;
  }

  get bubbleable() { return false; }

  get sinks() { return false; }

  get windborne() { return false; }

  /** Kummalle puolelle ammutaan, tai 0 kun ei kummallekaan. */
  aim() {
    const p = this.level.player;
    if (!p || p.dying || p.transit) return 0;
    const dx = p.cx - this.cx;
    if (Math.abs(dx) < TORVI_NEAR || Math.abs(dx) > TORVI_RANGE) return 0;
    // Samassa kerroksessa: ammus kulkee vaakasuoraan, joten kaksi ruutua
    // ylempänä juokseva pelaaja ei ole tämän torven asia.
    if (Math.abs(p.cy - this.cy) > 40) return 0;
    return Math.sign(dx);
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    const dir = this.aim();
    if (dir === 0) {
      /* Tähtäyksen katketessa lataus purkautuu takaisin, muttei ajastin. Ilman
       * tätä pelaaja voisi seisoa rajan takana kunnes torvi on täynnä ja astua
       * sitten sisään valmiiseen laukaukseen. */
      this.charge = 0;
      this.timer = Math.max(this.timer, TORVI_WARN);
      return;
    }
    this.facing = dir;
    if (--this.timer > TORVI_WARN) return;
    this.charge = 1 - this.timer / TORVI_WARN;
    if (this.timer > 0) return;
    this.fire(dir);
  }

  fire(dir) {
    this.timer = TORVI_PERIOD;
    this.charge = 0;
    const slug = new Torahdys(this.level, this.cx + dir * 8 - 8, this.y + 2, dir);
    this.level.add(slug);
    this.level.spawnPuff(this.cx + dir * 10, this.cy);
    Sfx.play('torvi');
  }

  draw(ctx) {
    if (this.dying) {
      this.drawFlipped(ctx, () => drawTorvi(ctx, this.x, this.y, this.tick, this.facing, 0));
      return;
    }
    this.drawSprite(ctx, (g) => drawTorvi(g, this.x, this.y, this.tick, this.facing, this.charge));
  }
}

/* ------------------------------- paarma ---------------------------------- */

/**
 * Paarman luvut, ja ne ovat kaikki samasta lauseesta: **se ampuu sinne missä
 * seisot, ei sinne minne olet menossa.**
 *
 * `PAARMA_AIM` on se pystysuora käytävä jonka yli lentäessään se sitoutuu
 * laukaukseen, ja se on kapea (yksi ruutu ja vähän) juuri siksi että pisara
 * putoaa suoraan alas: leveämpi käytävä tarkoittaisi ammusta joka osuu paikkaan
 * jossa pelaaja *oli*, ja sellainen on arpaa eikä ansaa.
 *
 * `PAARMA_WARN` on se puoli sekuntia jona se pysähtyy paikalleen ja kerää.
 * Pysähtyminen on koko varoitus — lentävä hyönteinen on pelin ainoa asia joka
 * liikkuu tasaisesti, joten sen pysähtyminen erottuu ilman että sitä tarvitsee
 * opetella. Sen jälkeen `PAARMA_COOL` estää sitä seuraamasta pelaajaa
 * pisaraputkena: yhden pisaran jälkeen sen on lennettävä kierroksensa loppuun.
 */
const PAARMA_SPEED = 0.75;
const PAARMA_RANGE = 72;
const PAARMA_AIM = 20;
const PAARMA_WARN = 30;
const PAARMA_COOL = 150;
const PISARA_GRAVITY = 0.28;
const PISARA_MAX = 4;

/**
 * HAPPOPISARA — se mikä paarmasta tulee. Ei elävä, ei tallattava, ei
 * poistettava: se putoaa, ja siitä on väistyttävä.
 *
 * `kind: 'hazard'` on tässä sama valinta kuin papupommilla ja samoin perustein:
 * pelaajan törmäystarkistus kohtelee vaaroja yhtenä asiana (`p.hurt('hazard')`,
 * ja tähti suojaa siltä koska se osuu sinuun eikä ole paikka johon menet).
 * Erona papupommiin on että tällä ei ole `hitByShell`iä — pisaraa ei voi
 * pyyhkiä pois kuorella, koska se on nestettä eikä kappale, ja koska paarman
 * vastaus on lentää sen alta pois eikä ampua sitä alas.
 */
export class Happopisara extends Entity {
  constructor(level, x, y) {
    super(level, x, y, 6, 8);
    this.kind = 'hazard';
    this.active = true;
  }

  update() {
    this.tick++;
    this.vy = Math.min(this.vy + PISARA_GRAVITY, PISARA_MAX);
    const hit = moveY(this, this.level);
    if (hit.ground || this.y > this.level.heightPx + 16) this.splash();
  }

  splash() {
    this.remove = true;
    this.level.spawnPuff(this.cx, this.y + this.h, true);
  }

  draw(ctx) {
    drawPisara(ctx, this.x, this.y, this.tick);
  }
}

/**
 * PAARMA — turvonnut paarma joka partioi ilmassa ja pudottaa happopisaran sen
 * päälle joka kävelee sen ali.
 *
 * Se on pelin ensimmäinen vihollinen joka **muuttaa lattian merkitystä**.
 * Kaikki muu tässä tiedostossa on jotain mitä kohdataan reitillä; tämä tekee
 * reitistä paikan jossa ei voi seisoa. Sen vastaus on siksi myös uusi: ei
 * ajoitus vaan *sijainti* — mene sivuun, tai nouse sen tasolle ja talloo se.
 *
 * Tallattava, koska se lentää: se on jo pelaajan yläpuolella olevassa
 * korkeudessa, ja tallaus vaatii nousemisen sinne. Lentäjän (`Flyer`)
 * tallausperintöä se ei kuitenkaan saa — lentäjästä tulee tallattaessa
 * kävelijä, koska se on maaotus jolla on siivet. Tämä on ilmaotus, ja
 * ilmaotuksesta ei jää maahan mitään.
 */
export class Paarma extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 16, 12);
    this.speed = PAARMA_SPEED;
    this.score = 200;
    this.homeX = x;
    this.homeY = y;
    this.warn = 0;
    this.cool = 0;
  }

  get bubbleable() { return true; }

  /**
   * Ei. Se ei koskaan koske maahan — se leijuu `homeY`:n korkeudella koko
   * ikänsä — joten hiekkaan uppoaminen olisi tapahtuma jota ei voi tuottaa.
   * Lentäjä vastaa tähän kyllä siksi että lentäjä on hyppääjä ja hyppy tarvitsee
   * lattian; tällä ei ole lattiaa missään suunnitelmassaan.
   */
  get sinks() { return false; }

  get windborne() { return true; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.bubbled) return this.updateBubbled();
    if (this.cool > 0) this.cool--;

    if (this.warn > 0) {
      // Paikallaan ja täristen. Ei `steer`iä: pysähtyminen on varoitus, ja
      // varoitus joka liukuu sivuun ei ole pysähtyminen.
      this.vx = 0;
      if (--this.warn === 0) this.spit();
      return;
    }

    if (this.cool === 0 && this.aiming()) {
      this.warn = PAARMA_WARN;
      this.vx = 0;
      return;
    }

    this.vx = this.speed * this.facing;
    const wall = this.moveSideways();
    if (wall || Math.abs(this.x - this.homeX) > PAARMA_RANGE) {
      this.facing *= -1;
      // Takaisin rajan sisään heti, tai käännös toistuisi joka framella.
      this.x = Math.max(this.homeX - PAARMA_RANGE, Math.min(this.homeX + PAARMA_RANGE, this.x));
    }
    // Leijunta. Sama sinikäyrä kuin ruskealla pilvellä, matalampana: siivet
    // kannattavat, ne eivät nosta.
    this.y = this.homeY + Math.sin(this.tick / 18) * 2;
  }

  /** Onko pelaaja juuri nyt tämän alla ja tähtäysetäisyydellä. */
  aiming() {
    const p = this.level.player;
    if (!p || p.dying || p.transit) return false;
    if (Math.abs(p.cx - this.cx) > PAARMA_AIM) return false;
    return p.cy > this.cy && p.cy - this.cy < 176;
  }

  spit() {
    this.cool = PAARMA_COOL;
    this.level.add(new Happopisara(this.level, this.cx - 3, this.y + this.h));
    Sfx.play('sylkaisy');
  }

  draw(ctx) {
    const charge = this.warn > 0 ? 1 - this.warn / PAARMA_WARN : 0;
    if (this.dying) {
      this.drawFlipped(ctx, () => drawPaarma(ctx, this.x, this.y, this.tick, this.facing, 0));
      return;
    }
    this.drawSprite(ctx, (g) => drawPaarma(g, this.x, this.y, this.tick, this.facing, charge));
  }
}

/* -------------------------------- yökki ---------------------------------- */

/**
 * Yökin luvut. `YOKKI_PERIOD` on pitkä ja `YOKKI_WARN` on pitkä, ja molemmat
 * ovat pitkiä samasta syystä: karvapallo on este joka jää huoneeseen, ja
 * huone jossa niitä on kolme yhtä aikaa ei ole enää huone vaan käytävä.
 *
 * Pallon vauhti alkaa kävelyä hitaampana ja päätyy juoksun tuntumaan
 * (`KARVA_MAX` 2,6 vastaan pelaajan juoksukatto 2,5), eli **siltä ei voi
 * juosta karkuun loputtomiin muttei tarvitsekaan**: sen ikä on rajattu, ja se
 * hajoaa ensimmäiseen seinään. Kiihtyvyys on se osa joka tekee siitä lukemisen
 * arvoisen — pallo joka on kaukana on hidas ja pallo joka on lähellä on nopea,
 * eli sama pallo kysyy eri kysymyksen sen mukaan milloin sen kohtaa.
 */
const YOKKI_PERIOD = 210;
const YOKKI_WARN = 45;
const YOKKI_RANGE = 180;
const KARVA_SPEED = 0.9;
const KARVA_ACC = 0.014;
const KARVA_MAX = 2.6;
const KARVA_LIFE = 360;

/**
 * KARVAPALLO — tiivistynyt karvakerä, ja se on tämän pelin oma vastaus siihen
 * vanhaan ideaan jossa vihollinen ei tule itse vaan lähettää jotain edellään.
 *
 * Se ei ole tallattava (`spiky`), ja tässä `spiky` tarkoittaa kirjaimellisesti
 * sitä mitä se sanoo: pinta on karvaa ja luuta, eikä sen päälle lasketa jalkaa.
 * Se on kuitenkin nimenomaan **este eikä seinä**, ja ero on kolmessa asiassa,
 * jotka kaikki ovat pelaajan tiedossa ennen kuin hän kohtaa toisen:
 *
 *   - sen yli hypätään, ja se on matala (12 px) juuri siksi;
 *   - pierupallo, potkaistu kuori ja häntä hajottavat sen kuten minkä tahansa;
 *   - se hajoaa itsestään seinään, kuoppaan ja aikaan.
 *
 * Se seuraa maastoa `moveY`llä eikä leiju: pallo joka menisi kuopan yli olisi
 * ammus, ja tämän koko idea on että se kulkee samaa lattiaa kuin pelaaja.
 */
export class Karvapallo extends Enemy {
  constructor(level, x, y, dir) {
    super(level, x, y, 12, 12);
    this.facing = dir;
    this.speed = KARVA_SPEED;
    this.roll = KARVA_SPEED;
    this.life = KARVA_LIFE;
    this.score = 100;
    this.spin = 0;
    this.active = true;
  }

  get spiky() { return true; }

  get bubbleable() { return false; }

  get sinks() { return true; }

  get windborne() { return true; }

  get driftSpeed() { return this.roll; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.sink()) return;
    if (--this.life <= 0) {
      this.burst();
      return;
    }
    this.roll = Math.min(KARVA_MAX, this.roll + KARVA_ACC);
    this.vx = this.roll * this.facing;
    // Pyörimiskulma kuljetusta matkasta eikä kellosta: hidastuva pallo pyörii
    // hitaammin, ja se on ainoa tapa jolla vieritys näyttää vieritykseltä.
    this.spin += this.roll;
    if (this.moveSideways()) {
      this.burst();
      return;
    }
    applyGravity(this, 1);
    moveY(this, this.level);
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  burst() {
    this.remove = true;
    this.level.spawnPuff(this.cx, this.cy, true);
    Sfx.play('pop');
  }

  draw(ctx) {
    if (this.dying) {
      this.drawFlipped(ctx, () => drawKarvapallo(ctx, this.x, this.y, this.spin, this.facing));
      return;
    }
    this.drawSprite(ctx, (g) => drawKarvapallo(g, this.x, this.y, this.spin, this.facing));
  }
}

/**
 * YÖKKI — kumara otus joka ei tule perääsi vaan lähettää jotain edellään.
 *
 * Se on hidas (0,3) ja tallattava ja arvoton yksinään, ja se on tarkoitus: koko
 * uhka on karvapallossa, ja karvapallo tulee niin kauan kuin lähdettä ei ole
 * kaadettu. Se tekee siitä pelin ensimmäisen vihollisen jonka kohdalla
 * **kannattaa mennä eteenpäin** — jokainen ohitettu yökki on pallo lisää siellä
 * mistä pelaaja juuri tuli, ja pallot eivät katoa sillä että niistä juoksee
 * karkuun.
 *
 * Se yökkää vain kun pelaaja on `YOKKI_RANGE`n sisällä ja samassa kerroksessa.
 * Yökki joka syöksisi palloja tyhjään huoneeseen täyttäisi kentän esineillä
 * joita kukaan ei ole nähnyt syntyvän — ja pallo jonka syntymää ei nähnyt on
 * ansa eikä este.
 */
export class Yokki extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    this.speed = 0.3;
    this.score = 200;
    this.timer = YOKKI_PERIOD;
    this.warn = 0;
  }

  get bubbleable() { return true; }

  get sinks() { return true; }

  get windborne() { return true; }

  /** Onko pelaaja niin lähellä ja niin samassa tasossa että pallo kannattaa. */
  target() {
    const p = this.level.player;
    if (!p || p.dying || p.transit) return 0;
    const dx = p.cx - this.cx;
    if (Math.abs(dx) > YOKKI_RANGE || Math.abs(p.cy - this.cy) > 48) return 0;
    return Math.sign(dx) || 1;
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.bubbled) return this.updateBubbled();
    if (this.sink()) return;

    if (this.warn > 0) {
      this.steer(0);
      this.moveSideways();
      if (--this.warn === 0) this.retch();
    } else {
      const dir = this.target();
      if (dir !== 0 && --this.timer <= 0) {
        this.facing = dir;
        this.warn = YOKKI_WARN;
      }
      this.steer(this.speed * this.facing);
      if (this.moveSideways()) this.facing *= -1;
      // Varovainen reunoista, kuten kuorikävelijä ja piikkiukko: yökki on
      // lähde, ja lähde joka heittäytyy kuoppaan ei ole lähde.
      if (this.onGround && !footingAhead(this.level, this.x + this.facing * 2, this.y, this.w, this.h)) {
        this.facing *= -1;
      }
    }
    applyGravity(this, 0.9);
    moveY(this, this.level);
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  retch() {
    this.timer = YOKKI_PERIOD;
    const dir = this.facing;
    this.level.add(new Karvapallo(this.level, this.cx + dir * 10 - 6, this.y + 4, dir));
    this.level.spawnPuff(this.cx + dir * 10, this.cy, true);
    Sfx.play('sylkaisy');
  }

  draw(ctx) {
    const heave = this.warn > 0 ? 1 - this.warn / YOKKI_WARN : 0;
    const frame = Math.floor(this.tick / 8);
    if (this.dying) {
      this.drawFlipped(ctx, () => drawYokki(ctx, this.x, this.y, frame, this.facing, 0));
      return;
    }
    this.drawSprite(ctx, (g) => drawYokki(g, this.x, this.y, frame, this.facing, heave));
  }
}

/* ----------------------------- paukkupöhö -------------------------------- */

/**
 * Sytytetyn pöhön luvut.
 *
 * `FUSE_FRAMES` on 48 eli neljä viidesosaa sekunnista, ja se on mitattu
 * pelaajan omasta vauhdista eikä valittu tunnelmasta: juoksukatolla (2,5
 * px/frame) siinä ajassa kulkee 120 px, eli **kolme kertaa räjähdyksen säde**.
 * Sytytetystä pöhöstä siis ehtii aina pois jos lähtee heti, eikä koskaan jos
 * jää katsomaan. Se on täsmälleen se sopimus jonka räjähtävä vihollinen saa
 * tehdä.
 *
 * `BLAST_R` 40 px on kaksi ja puoli ruutua, eli selvästi enemmän kuin
 * maahaniskun paras säde (30 + voimataso) — ja se on oikein: maahanisku on
 * pelaajan liike jonka hän valitsee, tämä on hänen päälleen sytytetty pommi.
 */
const FUSE_FRAMES = 48;
const BLAST_R = 40;
/**
 * Kuinka korkealle räjähdys yltää **pelaajaan**, ja miksi se on eri luku.
 *
 * Tallauspomppu kasvoi -4,0:sta -4,5:een (ks. `STOMP_BOUNCE`), ja se rikkoi
 * tämän vihollisen ilman että kukaan koski siihen: pommin päällä pomppiva
 * pelaaja on räjähdyshetkellä mitatusti **42 px** sen keskipisteen yläpuolella
 * (kaaren huippu 47 px), eli kahden pikselin päässä 40:n ulkopuolella. Osuma
 * jäi tulematta, ja portti kertoi sen — mutta se ei ole se vastaus jonka peli
 * haluaa: pommin päällä pomppiminen on juuri se teko jonka pitää olla
 * vaarallinen.
 *
 * Krateri **ei** kasva mukana, ja se on tarkoituksellinen ero: sivusuunta ja
 * tiilet ovat kentän geometriaa, jota yksi hyppyvakio ei saa liikuttaa. Tämä
 * luku koskee vain sitä kysymystä osuiko se sinuun.
 */
const BLAST_UP = 56;

/**
 * PAUKKUPÖHÖ — pöhö joka on täyttynyt liikaa, ja jonka ainoa mahdollinen loppu
 * on se että se hajoaa.
 *
 * **Tallaus ei tapa sitä, se sytyttää sen.** Se on pelin ensimmäinen otus jolla
 * pelaajan perusverbi antaa väärän vastauksen — tai tarkemmin: oikean vastauksen
 * jonka hinta maksetaan vasta puolen sekunnin päästä. Jokainen muu vihollinen
 * tässä pelissä on käsitelty sillä hetkellä kun siihen on koskettu; tämä alkaa
 * siitä.
 *
 * Ja se on samalla **työkalu**. Räjähdys rikkoo tiiliä `burstBricks`in omalla
 * sopimuksella (vain `B`, eikä sellaista `B`:tä joka piilottaa jotain), joten
 * paukkupöhö on tapa avata seinä ilman voimatasoa, ilman häntää ja ilman
 * maahaniskun korkeutta. Se on myös tapa tappaa se mikä sen vieressä sattuu
 * seisomaan — mukaan lukien pelaaja itse, jolle se ei tee poikkeusta.
 *
 * Kaikki neljä tapaa koskea siihen sytyttävät sen, ja se on tahallinen
 * yksinkertaistus: tallaus, pierupallo, kuori ja häntä johtavat samaan sytykkeeseen
 * eikä yksikään niistä poista sitä huoneesta. "Miten tämän saa pois" on tässä
 * väärä kysymys, ja peli vastaa siihen aina samalla tavalla.
 */
export class Paukkupoho extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    this.speed = 0.4;
    this.score = 400;
    this.fuse = 0;
  }

  get bubbleable() { return false; }

  get sinks() { return true; }

  get windborne() { return true; }

  get lit() { return this.fuse > 0; }

  /** Sytytys, mistä tahansa suunnasta ja millä tahansa aseella. */
  light() {
    if (this.dying || this.lit) return;
    this.fuse = FUSE_FRAMES;
    this.vx = 0;
    Sfx.play('squeak');
  }

  stomp() {
    this.light();
    // `true` eli pelaaja pomppaa. Tallaus *onnistui* — se vain ei tappanut,
    // ja pomppu on juuri se liike jolla siitä pääsee pois.
    return true;
  }

  hitByProjectile() { this.light(); }

  hitByShell() { this.light(); }

  hitByTail() { this.light(); }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.sink()) return;

    if (this.lit) {
      this.steer(0);
      this.moveSideways();
      if (--this.fuse <= 0) {
        this.blast();
        return;
      }
    } else {
      this.steer(this.speed * this.facing);
      if (this.moveSideways()) this.facing *= -1;
      if (this.onGround && !footingAhead(this.level, this.x + this.facing * 2, this.y, this.w, this.h)) {
        this.facing *= -1;
      }
    }
    applyGravity(this, 0.9);
    moveY(this, this.level);
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  /**
   * Se mitä paine tekee kun se pääsee kerralla ulos.
   *
   * Järjestys on sama kuin maahaniskulla ja samasta syystä: **oliot ensin,
   * lattia viimeisenä.** Katoava tiili tiputtaa sen mikä sen päällä seisoo, ja
   * putoaminen kuuluu räjähdykseen eikä sen jälkeiseen frameen.
   *
   * Pelaajaa se ei säästä. `hurt` itse tarkistaa kuolemattomuusframet ja
   * `star` tarkistetaan tässä samalla rajalla kuin kaikella muullakin joka
   * *osuu sinuun* — papupommi, närästysliekki, piikki (ks. `collisions`).
   */
  blast() {
    this.remove = true;
    const { level } = this;
    /* `spawnPuff` eikä oma `Puff`: tämä tiedosto ei tunne tehostetiedostoa
     * lainkaan, ja kahdeksan pilveä säteen levyisessä rivissä on sama kuva kuin
     * maahaniskun kuusi — sen leveämpänä. */
    for (let i = 0; i < 8; i++) {
      level.spawnPuff(this.cx + ((i - 3.5) / 3.5) * BLAST_R, this.cy, i % 2 === 0);
    }
    for (const e of level.entities) {
      if (e.kind !== 'enemy' || e === this || e.dying || e.remove) continue;
      if (Math.abs(e.cx - this.cx) > BLAST_R || Math.abs(e.cy - this.cy) > BLAST_R) continue;
      /* `hitByShell` eikä `hitByProjectile`, samasta syystä kuin tappavalla
       * maahaniskulla: sitkeät pysyvät sitkeinä, eikä räjähdys ole kupla. */
      e.hitByShell(Math.sign(e.cx - this.cx) || 1);
    }
    const p = level.player;
    const above = this.cy - (p ? p.cy : 0);
    if (p && !p.dying && p.star <= 0
      && Math.abs(p.cx - this.cx) < BLAST_R
      && (above > 0 ? above < BLAST_UP : -above < BLAST_R)) {
      p.hurt('hazard');
    }
    const tiles = [];
    const x0 = Math.floor((this.cx - BLAST_R) / TILE);
    const x1 = Math.floor((this.cx + BLAST_R) / TILE);
    const y0 = Math.floor((this.cy - BLAST_R) / TILE);
    const y1 = Math.floor((this.cy + BLAST_R) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const dx = (tx + 0.5) * TILE - this.cx;
        const dy = (ty + 0.5) * TILE - this.cy;
        if (dx * dx + dy * dy <= BLAST_R * BLAST_R) tiles.push([tx, ty]);
      }
    }
    level.burstBricks(tiles);
    level.awardScore(this.score, this.cx, this.y);
    level.shake(4);
    Sfx.play('jysahdys');
  }

  draw(ctx) {
    const fuse = this.lit ? 1 - this.fuse / FUSE_FRAMES : 0;
    const frame = Math.floor(this.tick / 8);
    if (this.dying) {
      this.drawFlipped(ctx, () => drawPaukkupoho(ctx, this.x, this.y, frame, this.facing, 0));
      return;
    }
    this.drawSprite(ctx, (g) => drawPaukkupoho(g, this.x, this.y, frame, this.facing, fuse));
  }
}

/*
 * PYÖRRE — kaasukehän ainoa vihollinen joka ei liiku minnekään.
 *
 * Maailma 7 on se jossa jokainen kuoppa on pohjaton ja jokainen lauta lyhyt,
 * ja siitä seuraa yksi asia jota mikään muu maailma ei vaadi: **joskus on
 * pakko seistä paikallaan.** Paarma tehtiin sitä vastaan — se ampuu alas
 * siihen mihin joku pysähtyi — ja tämä on sama kysymys toisin päin: se ei
 * rankaise odottamisesta vaan **ajoituksesta**. Kehä pyörii, ja siitä pääsee
 * läpi vain oikealla hetkellä.
 *
 * Kolme päätöstä, ja jokainen on rajaus:
 *
 *   1. **Se ei jätä kehäänsä koskaan.** Ei painovoimaa, ei maastotörmäystä,
 *      ei jahtaamista. Vihollinen joka pysyy ympyrällään on luettavissa
 *      yhdellä silmäyksellä, ja se on ainoa tapa tehdä ajoituksesta reilu.
 *   2. **Sitä ei voi tallata.** Piikikäs, koska pyörivän kappaleen päälle
 *      laskeutuminen olisi arpapeli sen kulmasta — ja tässä pelissä
 *      tallattavuuden näkee kruunusta tai piikeistä.
 *   3. **Se ei tuki reittiä.** Säde on kaksi laattaa ja akseli on ilmassa,
 *      joten lattiatasolla on aina se hetki jolloin pallo on ylhäällä.
 *      `verify.mjs` mittaa sen botilla eikä usko tätä kappaletta.
 */
const WHIRL_RADIUS = 32;
/** Kierros 150 framessa eli kahdessa ja puolessa sekunnissa. */
const WHIRL_TURN = (Math.PI * 2) / 150;

export class Pyorre extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 12, 12);
    /* Akseli on se ruutu johon merkki pantiin. Keskipiste talteen erikseen,
     * koska `x`/`y` ovat laatikon nurkka ja kehä lasketaan keskiöstä. */
    this.ax = x + 8;
    this.ay = y + 8;
    this.angle = 0;
    this.score = 200;
    this.noclip = true;
    this.alwaysActive = true;
    this.active = true;
    this.place();
  }

  get spiky() { return true; }

  get bubbleable() { return false; }

  /** Akselissa kiinni: ei uppoa hiekkaan eikä lennä tuulessa. */
  get sinks() { return false; }

  get windborne() { return false; }

  place() {
    this.x = this.ax + Math.cos(this.angle) * WHIRL_RADIUS - this.w / 2;
    this.y = this.ay + Math.sin(this.angle) * WHIRL_RADIUS - this.h / 2;
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    this.angle += WHIRL_TURN;
    this.place();
  }

  draw(ctx) {
    drawPyorre(ctx, this.x, this.y, this.ax, this.ay, this.angle);
  }
}

/*
 * KUMMITUS — se joka etenee vain kun et katso.
 *
 * Genren vanha temppu ja siksi vapaa (DESIGN.md kohta 2), mutta käännettynä
 * tämän pelin sanastolle: kummitus on **kaasua**, se kulkee pilven läpi, ja se
 * hyytyy paikalleen sillä hetkellä kun sitä katsotaan.
 *
 * Miksi juuri kaasukehään: maailman 7 lauta on lyhyt ja kuoppa pohjaton, joten
 * pelaajan on pakko **kääntyä katsomaan** ennen jokaista hyppyä. Kummitus tekee
 * siitä valinnan — katso taakse ja se pysähtyy, katso eteen ja se lähestyy — ja
 * se on pelin ainoa vihollinen joka mittaa *mihin pelaaja katsoo* eikä sitä
 * missä hän on.
 *
 * Kolme rajausta:
 *
 *   1. **Tallaus ei tepsi.** Se on kaasua; jalka menee läpi. Tähti ja häntä
 *      tepsivät, koska ne tepsivät kaikkeen.
 *   2. **Se ei voi tukkia reittiä**, koska se kulkee maaston läpi (`noclip`)
 *      eikä siis voi jäädä seinäksi kapealle laudalle.
 *   3. **Se on hitaampi kuin kävely.** 0,55 px/frame vastaan pelaajan 1,5:
 *      siitä pääsee aina eroon eteenpäin menemällä. Kiirehtijä, ei ansa.
 */
const GHOST_SPEED = 0.55;

export class Kummitus extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    this.score = 200;
    this.noclip = true;
    this.shy = 0;
    this.bob = 0;
  }

  get bubbleable() { return false; }

  get sinks() { return false; }

  get windborne() { return false; }

  /** Kaasu ei tallaudu, ja piikit ovat se merkki jolla se sanotaan. */
  get spiky() { return true; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    const p = this.level.player;
    if (!p) return;
    const dx = p.cx - this.cx;
    const dy = p.cy - this.cy;
    /* "Katsooko pelaaja tänne" on **suunta eikä näkökenttä**: `facing` on se
     * mikä ruudulla näkyy, ja mikä tahansa kartiolasku olisi sääntö jota ei
     * näe. Sama peruste kuin kruunulla — merkki on se mitä katsotaan. */
    const looked = dx === 0 || Math.sign(dx) === -p.facing;
    this.shy = looked ? Math.min(1, this.shy + 0.12) : Math.max(0, this.shy - 0.12);
    this.facing = dx < 0 ? -1 : 1;
    if (looked) {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    const len = Math.hypot(dx, dy) || 1;
    this.vx = (dx / len) * GHOST_SPEED;
    this.vy = (dy / len) * GHOST_SPEED;
    this.x += this.vx;
    this.y += this.vy;
    this.bob += 0.06;
  }

  draw(ctx) {
    drawKummitus(ctx, this.x, this.y + Math.sin(this.bob) * 1.5, this.facing, this.shy, this.tick);
  }
}

/*
 * KUURA — se joka jättää jälkeensä toisenlaisen lattian.
 *
 * Omistaja 18.8.2026: *"olisi kiva että oliot voisivat reagoida pelaajaan /
 * maailmaan / vaikuttaa maailmaan, se olisi dynaamista."* Se oli tarkka
 * havainto ja se oli mitattavissa: `ENEMY_VERBS`-taulun `maailma`-sarakkeessa
 * luki **"ei" jokaisella yhdeksällätoista lajilla**. Vain pomo koski kenttään.
 *
 * Kuura on ensimmäinen tavallinen vihollinen joka muuttaa kenttää, ja se
 * muuttaa sitä siihen suuntaan johon tämä peli osaa jo: **jää on laatta eikä
 * teema** (päätetty 10.8.2026), joten jäädytetty maa on olemassa oleva ruutu
 * eikä uusi mekaniikka. Kuura kävelee, ja sen jäljessä maa on liukas.
 *
 * Kolme rajausta, ja jokainen tekee muutoksesta turvallisen:
 *
 *   1. **Kiinteä pysyy kiinteänä.** `T.ICE` on yhtä kiinteä kuin `T.GROUND`,
 *      joten yksikään reitti, hyppy tai kuilubudjetti ei muutu. Muuttuva on
 *      kitka, ja kitkalla on jo oma sanansa pelissä.
 *   2. **Se sulaa.** `FROST_LIFE` framen jälkeen ruutu palaa siksi mitä se oli,
 *      eli kentän lopputila on sen lähtötila — sama vaatimus jonka valuva
 *      hiekka ja areenan pilarit jo täyttävät.
 *   3. **Se ei jäädytä sitä mitä ei voi jäädyttää.** Vain tavallinen maa ja
 *      kivi; lohkot, laudat, putket ja hiekka jäävät rauhaan, koska niillä on
 *      oma merkityksensä ja jäinen lohko lukisi uutena palikkana.
 */
const FROST_LIFE = 360;
const KUURA_SPEED = 0.42;

export class Kuura extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 16, 16);
    this.speed = KUURA_SPEED;
    this.facing = -1;
    this.score = 200;
  }

  get bubbleable() { return true; }

  get sinks() { return true; }

  get windborne() { return true; }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.sink()) return;
    this.vx = this.speed * this.facing;
    if (this.moveSideways()) this.facing *= -1;
    applyGravity(this, 1);
    moveY(this, this.level);
    /* Jälki jätetään **jalkojen alle** eikä siihen ruutuun jossa keho on: se on
     * se ruutu jolla pelaaja seisoo, ja se on myös se jonka näkee muuttuvan
     * kuuran takaa. */
    if (this.onGround && this.level.frostTile) {
      this.level.frostTile(Math.floor(this.cx / TILE), Math.floor((this.y + this.h) / TILE));
    }
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  draw(ctx) {
    drawKuura(ctx, this.x, this.y, this.tick, this.facing);
  }
}

/*
 * KOLIKKOVARAS — se joka ottaa sen mitä olit hakemassa.
 *
 * Toinen puoli samaa vastausta: tämä **reagoi maailmaan** eikä pelaajaan. Se
 * etsii lähimmän kolikon, juoksee sen luo ja syö sen, ja se on koko laji.
 *
 * Miksi juuri kolikko: se on ainoa asia kentässä jonka poistaminen ei voi
 * rikkoa mitään. Kolikko ei ole kiinteä eikä puolikiinteä, se ei kannattele
 * ketään eikä sen puuttuminen sulje reittiä — eli maailmaan vaikuttava
 * vihollinen saadaan **ilman yhtäkään uutta läpäisykysymystä**. Sama peruste
 * kuin pieruhyllyllä: turvallisuus rakenteesta eikä varovaisuudesta.
 *
 * Ja se antaa takaisin. Tallattuna se pudottaa kaiken syömänsä kolikkoina,
 * joten kilpajuoksun hävinnytkään ei menetä mitään pysyvästi — hän vain saa
 * palkintonsa myöhemmin ja työllä. Vihollinen joka veisi lopullisesti olisi
 * rangaistus siitä ettei ehtinyt, ja tämä peli ei rankaise hitaudesta.
 */
const THIEF_SPEED = 1.15;
const THIEF_REACH = 10;

export class Kolikkovaras extends Enemy {
  constructor(level, x, y) {
    super(level, x, y, 14, 14);
    this.speed = THIEF_SPEED;
    this.facing = 1;
    this.score = 400;
    this.loot = 0;
    this.hunt = 0;
  }

  get bubbleable() { return true; }

  get sinks() { return true; }

  get windborne() { return true; }

  /** Lähin kolikko `THIEF_REACH`in sisällä, tai `null`. */
  target() {
    const level = this.level;
    const cx = Math.floor(this.cx / TILE);
    const cy = Math.floor(this.cy / TILE);
    let best = null;
    for (let ty = cy - 2; ty <= cy + 2; ty++) {
      for (let tx = cx - THIEF_REACH; tx <= cx + THIEF_REACH; tx++) {
        if (level.tileAt(tx, ty) !== T.COIN) continue;
        const d = Math.abs(tx - cx);
        if (!best || d < best.d) best = { tx, ty, d };
      }
    }
    return best;
  }

  update() {
    this.tick++;
    if (this.dying) return this.updateDying();
    if (this.sink()) return;
    /* Kohde haetaan kolmasti sekunnissa eikä joka framella: kolikkorivi on
     * rivi, ja jokaisen framen uudelleenvalinta saisi varkaan värisemään
     * kahden yhtä lähellä olevan välissä. */
    if (this.tick % 20 === 0 || this.hunt === 0) {
      const t = this.target();
      this.hunt = t ? t.tx : 0;
      if (t) this.facing = t.tx * TILE + 8 < this.cx ? -1 : 1;
    }
    this.vx = this.speed * this.facing;
    if (this.moveSideways()) this.facing *= -1;
    applyGravity(this, 1);
    moveY(this, this.level);
    /* Syöminen on ruudun poisto, ja se tehdään kohtauksen kautta jotta
     * naapurit (valuva hiekka, murenevat laatat) saavat tietää siitä samalla
     * tavalla kuin kaikesta muustakin. */
    const tx = Math.floor(this.cx / TILE);
    const ty = Math.floor(this.cy / TILE);
    if (this.level.tileAt(tx, ty) === T.COIN) {
      this.level.setTile(tx, ty, T.EMPTY);
      this.loot++;
      Sfx.play('coin');
    }
    if (this.y > this.level.heightPx + 32) this.remove = true;
  }

  /** Tallattuna se pudottaa kaiken minkä ehti. Ks. luokan perustelu. */
  stomp() {
    this.remove = true;
    this.level.chainReward(this.score, this.cx, this.y);
    for (let i = 0; i < this.loot; i++) {
      this.level.addCoin(this.cx, this.y - 4 - i * 3);
    }
    return true;
  }

  draw(ctx) {
    drawKolikkovaras(ctx, this.x, this.y, this.tick, this.facing, this.loot);
  }
}

/**
 * MIKÄ TÄSSÄ LAJISSA ON UUTTA — taulukkona, koska muuten se on mielipide.
 *
 * Omistajan kysymys 18.8.2026: *"onhan niiden liikkeissä ja projektiileissa /
 * damagessa jotain uutta?"* Se on oikea kysymys ja se ansaitsee mitatun
 * vastauksen: uusi sprite vanhalla verbillä on sanaston kasvattamista
 * numerona eikä pelinä, ja juuri sitä tämä taulu estää.
 *
 * Viisi akselia, ja jokainen niistä on jotain jonka pelaaja **huomaa**:
 *
 *   liike     miten se kulkee
 *   ammus     mitä se lähettää (jos mitään)
 *   osuma     miten se satuttaa
 *   tallaus   mitä tallaaminen tekee
 *   maailma   muuttaako se kenttää
 *
 * `tools/verify.mjs` vaatii kaksi asiaa: **jokaisella lajilla on rivi**, ja
 * **kahdella lajilla ei ole samaa viisikkoa**. Jälkimmäinen on se joka pitää
 * lupauksen: jos uusi laji täsmää vanhaan joka sarakkeessa, se ei ole uusi
 * laji vaan uusi väri.
 */
export const ENEMY_VERBS = {
  g: { move: 'kävely', shot: 'ei', hurt: 'kosketus', stomp: 'kuolee', world: 'ei' },
  k: { move: 'kävely', shot: 'ei', hurt: 'kosketus', stomp: 'jää kuoreksi', world: 'ei' },
  f: { move: 'loikkalento', shot: 'ei', hurt: 'kosketus', stomp: 'menettää siivet', world: 'ei' },
  p: { move: 'putkesta esiin', shot: 'ei', hurt: 'kosketus', stomp: 'ei tepsi', world: 'ei' },
  r: { move: 'keinuva ajelehdus', shot: 'ei', hurt: 'kosketus', stomp: 'kuolee', world: 'ei' },
  c: { move: 'hyppely', shot: 'korkki', hurt: 'ummetus', stomp: 'kuolee', world: 'ei' },
  x: { move: 'kävely', shot: 'ei', hurt: 'piikki', stomp: 'ei tepsi', world: 'ei' },
  A: { move: 'kaartava syöksy', shot: 'ei', hurt: 'kosketus', stomp: 'ei tepsi', world: 'ei' },
  H: { move: 'paikallaan', shot: 'suihku ylös', hurt: 'liekki', stomp: 'ei tepsi', world: 'ei' },
  P: { move: 'kävely tasanteella', shot: 'kaaripommi', hurt: 'kosketus', stomp: 'kestää osuman', world: 'ei' },
  O: { move: 'kiertorata', shot: 'ei', hurt: 'kosketus', stomp: 'pudottaa esineen', world: 'ei' },
  U: { move: 'loikka kuopasta', shot: 'ei', hurt: 'kosketus', stomp: 'kuolee', world: 'ei' },
  T: { move: 'paikallaan', shot: 'törähdys', hurt: 'kosketus', stomp: 'kuolee', world: 'ei' },
  Z: { move: 'partiolento', shot: 'tähdätty pisara', hurt: 'kosketus', stomp: 'kuolee', world: 'ei' },
  Y: { move: 'kävely', shot: 'sylky', hurt: 'kosketus', stomp: 'kuolee', world: 'ei' },
  m: { move: 'vieriminen', shot: 'ei', hurt: 'piikki', stomp: 'ei tepsi', world: 'ei' },
  b: { move: 'pomon oma', shot: 'iskuaalto', hurt: 'kosketus', stomp: 'kestää osuman', world: 'nostaa pilarit' },
  /*
   * Ja nämä ovat ne uudet. Kumpikin tuo yhden sarakkeen jota ei ollut:
   * pyörteen **kehä** on ainoa suljettu rata jolla mikään ei kulje, ja
   * kummituksen liike on ainoa joka lukee sitä **mihin pelaaja katsoo**.
   *
   * Yhtä rehellisesti: kumpikaan ei tuo uutta ammusta eikä uutta vahingon
   * lajia. Se on kirjattu tähän eikä kaunisteltu, ja se on myös seuraavan erän
   * tehtävänanto — ks. `ROADMAP.md`, uudet lajit.
   */
  e: { move: 'kehä akselin ympäri', shot: 'ei', hurt: 'piikki', stomp: 'ei tepsi', world: 'ei' },
  q: { move: 'seuraa kun et katso', shot: 'ei', hurt: 'piikki', stomp: 'ei tepsi', world: 'ei' },
  /*
   * Ja nämä kaksi ovat vastaus siihen mitä taulu näytti: `maailma`-sarakkeessa
   * luki "ei" jokaisella rivillä paitsi pomolla. Kuura muuttaa lattian
   * kitkan, kolikkovaras vie sen mitä olit hakemassa — ja kumpikin palauttaa
   * jälkensä, toinen sulamalla ja toinen tallattuna.
   */
  w: { move: 'kävely', shot: 'ei', hurt: 'kosketus', stomp: 'kuolee', world: 'jäädyttää maan' },
  s: { move: 'juoksu kolikolle', shot: 'ei', hurt: 'kosketus', stomp: 'pudottaa saaliin', world: 'syö kolikot' },
};

export const ENEMY_CHARS = {
  g: (level, tx, ty) => new Walker(level, tx * TILE, ty * TILE),
  k: (level, tx, ty) => new ShellGuy(level, tx * TILE + 1, ty * TILE - 8),
  f: (level, tx, ty) => new Flyer(level, tx * TILE, ty * TILE),
  p: (level, tx, ty) => new Plant(level, tx * TILE + 8, (ty + 1) * TILE - 32),
  r: (level, tx, ty) => new StinkCloud(level, tx * TILE, ty * TILE),
  c: (level, tx, ty) => new CorkGuy(level, tx * TILE + 1, ty * TILE),
  x: (level, tx, ty) => new SpikeGuy(level, tx * TILE, ty * TILE),
  A: (level, tx, ty) => new AngrySun(level, tx * TILE, ty * TILE),
  H: (level, tx, ty) => new Heartburn(level, tx * TILE, (ty + 1) * TILE),
  /*
   * The marker says **a boss stands here**, and that has to mean the same thing
   * whatever size the boss is.
   *
   * This used to place the sprite's top-left corner on the marker tile, which
   * was indistinguishable from "stands here" only while every boss was the same
   * 30x32. The moment the sizes became per boss, a 44-tall one reached twelve
   * pixels deeper and spawned **inside the arena floor**, and a 76-wide one
   * spilled out of the room to the right. Measured: every fortress whose boss
   * had changed size failed its power-0 stomp, and none of them failed for the
   * reason it looked like — they were sunk into the ground, not out of reach.
   *
   * So the feet are pinned to where a 30x32 boss's feet were, and the body is
   * centred on the same column. Every arena in the game keeps its meaning and
   * not one of them had to move.
   */
  b: (level, tx, ty, variant) => {
    const { w, h } = bossSize(variant);
    return new Boss(level, tx * TILE + 15 - w / 2, ty * TILE + 32 - h, variant);
  },
  O: (level, tx, ty) => new Moon(level, tx * TILE, ty * TILE),
  /* The baron is taller than a tile, so its marker is the square it *stands
   * in*: the body is hung from the bottom of that square rather than dropped
   * from its top. Chunks then read the way the eye reads them, and the
   * "enemies inside walls" check in verify.mjs — which looks at the tile under
   * the sprite's feet — is asking about the tile the level author meant. */
  P: (level, tx, ty) => new BeanBaron(level, tx * TILE - 1, (ty + 1) * TILE - 26),
  /* The kurnuttaja's marker is the pit's own rim: it goes in the first floor
   * row of the chunk, in a column where that row is empty, and the top of that
   * row is the line the creature measures everything from. Written that way so
   * the chunk reads as what it is — a hole with something at the bottom of it —
   * rather than as an enemy floating in a gap. */
  U: (level, tx, ty) => new Kurnuttaja(level, tx * TILE, ty * TILE),
  /*
   * Neljä uutta merkkiä, ja niiden kirjaimet ovat muistisääntöjä eivätkä
   * lyhenteitä: `T` torvi, `Z` sen surina, `Y` yökki, `m` miina. Isot kirjaimet
   * ovat tässä taulussa niitä jotka eivät kävele tavallista kävelyä (`A`, `H`,
   * `O`, `P`, `U`), ja kolme näistä neljästä kuuluu siihen joukkoon.
   *
   * Kaikki neljä asetetaan sen ruudun *ylänurkasta* johon ne on kirjoitettu,
   * paitsi paarma, joka on 12 px korkea ja keskitetään ruutuunsa: se leijuu, ja
   * leijuva otus jonka piirros roikkuu ruudun ylälaidasta lukisi kentässä
   * rivin verran ylempänä kuin se on.
   */
  /* Pyörre: merkki on **akseli**, eli se ruutu jonka ympäri pallo kiertää —
   * ei se paikka jossa pallo on. Palikka lukee siis samalla tavalla kuin
   * kurnuttajan kuoppa: merkki kertoo mistä ilmiö lähtee. */
  w: (level, tx, ty) => new Kuura(level, tx * TILE, ty * TILE),
  s: (level, tx, ty) => new Kolikkovaras(level, tx * TILE + 1, ty * TILE + 2),
  e: (level, tx, ty) => new Pyorre(level, tx * TILE, ty * TILE),
  q: (level, tx, ty) => new Kummitus(level, tx * TILE, ty * TILE),
  T: (level, tx, ty) => new Torvi(level, tx * TILE, ty * TILE),
  Z: (level, tx, ty) => new Paarma(level, tx * TILE, ty * TILE + 2),
  Y: (level, tx, ty) => new Yokki(level, tx * TILE, ty * TILE),
  m: (level, tx, ty) => new Paukkupoho(level, tx * TILE, ty * TILE),
};
