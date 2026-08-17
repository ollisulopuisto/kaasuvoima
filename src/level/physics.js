import { TILE, isSolid, isSemi, slopeTop, slopeDir } from '../gfx/tiles.js';

/*
 * Gravity, straight off the SMB3 disassembly (PRG/prg008.asm). Velocity there
 * is 4.4 fixed point, so a raw byte divided by 16 is pixels per frame at 60 Hz
 * — the same unit this engine already uses.
 *
 * The low gravity is not simply "the jump button is held": it also requires
 * still rising faster than 2 px/frame. Once you slow past that, holding the
 * button stops helping, which is what gives the original its crisp apex.
 */
export const GRAVITY = 0.3125;              // $05
export const GRAVITY_HELD = 0.0625;         // $01
export const GRAVITY_HELD_CUTOFF = -2.0;    // -$20
export const TERMINAL = 4.0;                // $40

/**
 * RINTEEN ALLA OLEVA TÄYTE EI OLE SEINÄ — sille joka on rinteessä.
 *
 * 45° rinne on rakenteena porras: sarakkeessa on rinnelaatta ja sen alla
 * kiinteää täytettä. Ylöspäin kävelevän keho on kesken laattaa **rinteen
 * pinnan tasolla mutta seuraavan sarakkeen täytteen kohdalla**, ja pelkkä
 * ruudukkotörmäys pysäytti sen seinään joka on maan sisällä. Mitattu:
 * juoksija pysähtyi ensimmäiseen rinnelaattaan eikä noussut kertaakaan.
 *
 * Ehto on tarkka eikä ohitus yleisesti: täyte on läpäistävä vain silloin kun
 * (a) sen **päällä on rinnelaatta** — eli se on rinteen omaa täytettä eikä
 * seinä jonka päällä sattuu olemaan rinne muualla — ja (b) keho on rinteen
 * pinnan tuntumassa, korkeintaan laatan verran sen alapuolella. Luolassa
 * rinteen alla kulkeva törmää siihen kuten ennenkin.
 */
function rampFill(entity, level, tx, ty) {
  const dir = slopeDir(level.tileAt(tx, ty - 1));
  if (!dir) return false;
  const surface = (ty - 1) * TILE + slopeTop(level.tileAt(tx, ty - 1), dir > 0 ? 0 : TILE - 1);
  const feet = entity.y + entity.h;
  return feet <= surface + TILE && feet >= surface - entity.h;
}

/**
 * RINTEEN PÄÄSTÄ TASANTEELLE, ja tämä on askelma eikä seinän ohitus.
 *
 * Rinteen ylin sarake päättyy laatan kattoon, ja seuraavan laatan pinta on
 * täsmälleen samassa korkeudessa. Silti keho on lähdön hetkellä muutaman
 * pikselin sen alapuolella — pinta lasketaan kehon keskikohdasta ja keskikohta
 * on framen verran jäljessä reunasta — ja ruudukkotörmäys pysäytti sen
 * tasanteen kulmaan. Mitattu: juoksija jumittui rampin päähän joka kerta.
 *
 * **Askelman korkeus tulee kehon leveydestä eikä vakiosta**, ja se on tämän
 * säännön koko juju. Rinteen pinta luetaan kehon **keskikohdasta**, mutta
 * törmäyksen tekee sen **etureuna** — joka on `w/2` edempänä, ja 45 asteen
 * rinteessä siis `w/2` pikseliä ylempänä. Iso Pieruprinssi on 21 px leveä,
 * eli hänen etureunansa on kymmenen pikseliä korkeammalla kuin se kohta jota
 * moottori mittaa.
 *
 * Tässä luki kiinteä kuusi, ja se riitti pienimmälle keholle (12 px → 6) ja
 * **vain sille**: omistajan raportti 17.8.2026 oli että hahmo pysähtyy 1-1:n
 * rinteen huipulle kuin seinään. Niin se pysähtyikin — tasanteen ensimmäinen
 * laatta oli kahdeksan pikseliä jalkojen yläpuolella, eli kaksi liikaa.
 *
 * `w / 2 + 2` on siis mitattu geometriasta eikä valittu: puolikas leveys on se
 * virhe jonka mittapiste tekee, ja kaksi pikseliä on framen liike sen päälle.
 * Isoimmallakin keholla se on 12 px eli selvästi alle laatan — yksikään seinä
 * tai askelma ei mahdu ikkunaan, eikä tästä siis tule porrasautomaattia. Ehto
 * vaatii yhä että keho on **juuri nyt rinteessä**, joten tasamaalla sääntöä ei
 * ole olemassa.
 */
function stepUp(entity, level, tx, ty) {
  if (!entity.onSlope || !entity.onGround) return false;
  void level;
  void tx;
  const feet = entity.y + entity.h;
  const top = ty * TILE;
  return feet > top && feet - top <= entity.w / 2 + 2;
}

/**
 * Moves an entity horizontally and pushes it out of solid tiles.
 * @returns true when a wall was hit.
 */
export function moveX(entity, level) {
  entity.x += entity.vx;
  if (entity.noclip) return false;

  const top = Math.floor(entity.y / TILE);
  const bottom = Math.floor((entity.y + entity.h - 1) / TILE);
  let hit = false;

  if (entity.vx > 0) {
    const tx = Math.floor((entity.x + entity.w - 1) / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      if (isSolid(level.tileAt(tx, ty)) && !rampFill(entity, level, tx, ty)
          && !stepUp(entity, level, tx, ty)) {
        entity.x = tx * TILE - entity.w;
        hit = true;
        break;
      }
    }
  } else if (entity.vx < 0) {
    const tx = Math.floor(entity.x / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      if (isSolid(level.tileAt(tx, ty)) && !rampFill(entity, level, tx, ty)
          && !stepUp(entity, level, tx, ty)) {
        entity.x = (tx + 1) * TILE;
        hit = true;
        break;
      }
    }
  }

  // Level edges are always walls.
  if (entity.x < 0) {
    entity.x = 0;
    hit = true;
  }
  const maxX = level.widthPx - entity.w;
  if (entity.x > maxX) {
    entity.x = maxX;
    hit = true;
  }

  if (hit) entity.vx = 0;
  return hit;
}

/*
 * RINTEET, ja miksi ne ovat oma ratkaisunsa eivätkä uusi laatikko.
 *
 * Kaikki muu maasto tässä moottorissa on ruudukkoa: `moveX` ja `moveY` kysyvät
 * "onko tämä laatta kiinteä" ja työntävät kehon ulos laatan reunasta. Rinne ei
 * mahdu siihen kysymykseen, koska sen pinta on **eri korkeudella jokaisessa
 * sarakkeessa**. Siksi rinne ei ole `solid` lainkaan (ks. `T.SLOPE_R`), ja
 * pystyratkaisu kysyy siltä yhden asian: millä korkeudella maa on tässä
 * kohtaa.
 *
 * **Yksi mittapiste, kehon keskikohta.** Ei molemmat jalat: kaksi mittapistettä
 * rinteessä antavat kaksi eri korkeutta, ja se korkeampi voittaisi — jolloin
 * keho nousisi rinteeseen jo silloin kun vasta varpaat koskettavat sitä, ja
 * rinteen vieressä seisova nytkähtäisi ylös ilman että kukaan liikkui.
 * Keskikohta on sama ratkaisu jota genre on käyttänyt aina, ja se on myös se
 * piste jonka pelaaja kokee olevansa.
 *
 * **Alamäki tarttuu.** Rinnettä alas kävelevä on joka framella hetken ilmassa
 * — maa katosi askeleen verran alaspäin — ja ilman tarttumista se olisi sarja
 * pieniä putoamisia: keho tärisisi ja `onGround` vilkkuisi, mikä katkaisisi
 * hypyn puskurin ja vauhtimittarin. `SLOPE_SNAP` on se etäisyys jolta maa
 * vielä haetaan alta, ja se on mitoitettu suurimman vaakavauhdin mukaan:
 * 4 px/frame 45° rinteessä laskee 4 px, ja kahdeksan pikseliä kattaa senkin
 * framen jolla kamera ja keho eivät ole samaa mieltä pyöristyksestä.
 */
const SLOPE_SNAP = 8;

/**
 * Maan pinta annetussa maailman x:ssä, jos siinä sarakkeessa on rinne.
 *
 * @returns maailman y jossa pinta on, tai `null` kun rinnettä ei ole.
 */
export function slopeSurface(level, worldX, ty) {
  const tx = Math.floor(worldX / TILE);
  const ch = level.tileAt(tx, ty);
  const top = slopeTop(ch, worldX - tx * TILE);
  if (top === null) return null;
  return ty * TILE + top;
}

/**
 * Rinne kehon jalkojen tuntumassa, tai `null`.
 *
 * **Kolme riviä eikä yksi**, ja jokainen niistä on mitattu tilanne:
 *
 *   - rivi jalkojen yläpuolella: rinteen alin sarake on laatan pohjassa, eli
 *     tasamaalta rinteeseen astuvan jalat ovat vielä edellisessä rivissä kun
 *     pinta on jo seuraavassa. Ilman tätä riviä juoksija pysähtyi rinteen
 *     juureen eikä noussut kertaakaan (mitattu).
 *   - rivi jossa jalat ovat: tavallinen tapaus.
 *   - rivi jalkojen alapuolella: rinteen ylin sarake on laatan katossa, eli
 *     alas kävelevän jalat ovat jo seuraavassa rivissä.
 *
 * Ja `SLOPE_SNAP`in ikkuna on se joka tekee kolmesta rivistä turvallisen:
 * hyväksytään vain pinta joka on kahdeksan pikselin sisällä jaloista. Ilman
 * sitä rinteen ali kävelevä olisi teleportattu sen päälle.
 */
export function slopeUnder(entity, level) {
  const cx = entity.x + entity.w / 2;
  const feet = entity.y + entity.h;
  const row = Math.floor(feet / TILE);
  let best = null;
  for (const ty of [row - 1, row, row + 1]) {
    const y = slopeSurface(level, cx, ty);
    if (y === null) continue;
    if (y < feet - SLOPE_SNAP || y > feet + SLOPE_SNAP) continue;
    if (best === null || Math.abs(y - feet) < Math.abs(best.y - feet)) {
      best = { y, dir: slopeDir(level.tileAt(Math.floor(cx / TILE), ty)) };
    }
  }
  return best;
}

/**
 * Moves an entity vertically. `onHeadBump(tx, ty)` fires for every solid tile
 * the entity's head runs into.
 * @returns { ground, ceiling }
 */
export function moveY(entity, level, { onHeadBump = null, dropThrough = false } = {}) {
  const prevBottom = entity.y + entity.h;
  entity.y += entity.vy;
  const result = { ground: false, ceiling: false };
  if (entity.noclip) {
    entity.onGround = false;
    return result;
  }

  const left = Math.floor(entity.x / TILE);
  const right = Math.floor((entity.x + entity.w - 1) / TILE);

  if (entity.vy >= 0) {
    /* Rinne ensin: se on maata joka ei ole laatan reunassa, ja jos keho on sen
     * pinnan alapuolella se nostetaan pintaan. Tarttuminen (`SLOPE_SNAP`)
     * koskee vain sitä joka oli jo maassa — ilmasta tuleva laskeutuu vasta kun
     * se osuu. */
    const slope = slopeUnder(entity, level);
    if (slope !== null) {
      const feet = entity.y + entity.h;
      const grounded = entity.onGround && feet >= slope.y - SLOPE_SNAP;
      if (feet >= slope.y || grounded) {
        entity.y = slope.y - entity.h;
        entity.vy = 0;
        entity.onGround = true;
        entity.onSlope = slope.dir;
        result.ground = true;
        return result;
      }
    }
    entity.onSlope = 0;
    /*
     * Probe the tile the feet are *touching*, not the last pixel inside the
     * body. With `- 1` a resting entity sits one pixel above the floor tile, so
     * a sub-pixel of gravity never reaches it: it sinks for three frames and
     * snaps back on the fourth. On screen that is a character vibrating in
     * place. Using the bottom edge makes the landing re-detect every frame, so
     * resting is genuinely still.
     */
    const ty = Math.floor((entity.y + entity.h) / TILE);
    for (let tx = left; tx <= right; tx++) {
      const ch = level.tileAt(tx, ty);
      const solid = isSolid(ch);
      const semi = !solid && isSemi(ch) && !dropThrough && prevBottom <= ty * TILE + 1;
      if (solid || semi) {
        entity.y = ty * TILE - entity.h;
        entity.vy = 0;
        result.ground = true;
        break;
      }
    }
  } else {
    entity.onSlope = 0;
    const ty = Math.floor(entity.y / TILE);
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(level.tileAt(tx, ty))) {
        entity.y = (ty + 1) * TILE;
        entity.vy = 0;
        result.ceiling = true;
        if (onHeadBump) onHeadBump(tx, ty);
        break;
      }
    }
  }

  /*
   * Being on the ground is a question about where you are, not about whether
   * you happened to land this frame.
   *
   * Resolving a landing puts the feet exactly on the tile boundary, which means
   * the body's last pixel sits one pixel *above* the floor tile. A single frame
   * of gravity moves less than a pixel, so a collision test alone reports "in
   * the air" for three frames out of four while the player is standing still —
   * and every jump pressed on one of those frames silently disappears.
   */
  entity.onGround = result.ground || (entity.vy >= 0 && footingBelow(entity, level, dropThrough));
  return result;
}

/** True when the tile row directly under the entity's feet is standable. */
function footingBelow(entity, level, dropThrough) {
  const ty = Math.floor((entity.y + entity.h) / TILE);
  const left = Math.floor(entity.x / TILE);
  const right = Math.floor((entity.x + entity.w - 1) / TILE);
  for (let tx = left; tx <= right; tx++) {
    const ch = level.tileAt(tx, ty);
    if (isSolid(ch)) return true;
    if (!dropThrough && isSemi(ch) && entity.y + entity.h <= ty * TILE + 1) return true;
  }
  /* Rinne on maata vaikkei se ole laatikko: ilman tätä rinteessä seisova on
   * moottorin mielestä ilmassa joka toisella framella, eikä hyppy lähde. */
  const slope = slopeUnder(entity, level);
  return slope !== null && entity.y + entity.h >= slope.y - 1;
}

/** True when there is solid or semi-solid footing just below the given box. */
export function footingAhead(level, x, y, w, h) {
  const ty = Math.floor((y + h + 1) / TILE);
  const tx0 = Math.floor(x / TILE);
  const tx1 = Math.floor((x + w - 1) / TILE);
  for (let tx = tx0; tx <= tx1; tx++) {
    const ch = level.tileAt(tx, ty);
    if (isSolid(ch) || isSemi(ch)) return true;
    /* Rinne kelpaa jalansijaksi kummassakin rivissä jonka läpi se kulkee:
     * varovainen kävelijä (`ShellGuy`) kääntyi muuten ympäri rinteen reunalla
     * kuin kuilun reunalla. */
    if (slopeDir(ch)) return true;
    if (slopeDir(level.tileAt(tx, ty - 1))) return true;
  }
  return false;
}

export function applyGravity(entity, scale = 1) {
  entity.vy = Math.min(entity.vy + GRAVITY * scale, TERMINAL);
}
