import { hashNoise } from '../core/utils.js';
import { TILE } from '../data/worlds.js';

/**
 * WHAT GROWS ON A MAP, AND HOW IT DANCES.
 *
 * Lifted out of `WorldMapScene.drawTerrain` on 20.8.2026, unchanged, when the
 * globe wanted the same trees. It was the second time in two days that a
 * screen needed something the flat map was keeping to itself, and the answer
 * is the same as it was for the gambling rooms: one copy, two maps. A cactus
 * that leans differently depending on which overworld you are looking at is
 * two cacti.
 *
 * Every glyph draws inside its own 16 px tile, measured from the top-left it
 * is handed. That was already true — the scenery clearance rule in
 * `worlds.js` is enforced against the drawn pixels — and it is what makes the
 * code portable at all: the flat map hands it a tile of the grid, and the
 * globe hands it a point on a hexagon, and neither has to explain itself.
 *
 * **The sway is the whole point.** One shared sine offset per tile so
 * neighbours do not move in lockstep, which is the difference between a map
 * that is a place with weather and a map that is a printed picture. `tx`/`ty`
 * are only ever phase here — on the globe they are not tile coordinates at
 * all, just two numbers that keep one bush out of step with the next.
 */
export function drawScenery(ctx, ch, x, y, { theme, tick, tx = 0, ty = 0 }) {
  const th = theme;
  const sway = (a, b, amount) =>
    Math.round(Math.sin(tick / 24 + a * 0.8 + b * 0.5) * amount);
  switch (ch) {
    case '~': {
      const wave = Math.sin((tx * 0.7) + tick / 14) * 1.5;
      ctx.fillStyle = '#2c6cd8';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#6ca8f8';
      ctx.fillRect(x, y + 4 + Math.round(wave), TILE, 2);
      break;
    }
    case 'T': {
      // Everything that grows sways, each tile on its own phase, so the
      // map reads as a place with weather rather than a printed picture.
      const s1 = sway(tx, ty, 1);
      ctx.fillStyle = '#6a4018';
      ctx.fillRect(x + 7, y + 9, 3, 6);
      ctx.fillStyle = '#1f7a2a';
      ctx.fillRect(x + 3 + s1, y + 3, 11, 7);
      ctx.fillRect(x + 5 + s1, y + 1, 7, 4);
      ctx.fillStyle = '#2fa03a';
      ctx.fillRect(x + 5 + s1, y + 3, 6, 4);
      break;
    }
    case 'P': {
      const s1 = sway(tx, ty, 1);
      const s2 = sway(tx, ty, 0.5);
      ctx.fillStyle = '#6a4018';
      ctx.fillRect(x + 7, y + 11, 3, 4);
      ctx.fillStyle = '#1f6a3a';
      ctx.fillRect(x + 4 + s2, y + 8, 9, 4);
      ctx.fillRect(x + 5 + s1, y + 4, 7, 4);
      ctx.fillRect(x + 6 + s1, y + 1, 5, 4);
      if (th === 'ice') {
        ctx.fillStyle = '#f0f8ff';
        ctx.fillRect(x + 6 + s1, y + 1, 5, 2);
        ctx.fillRect(x + 5 + s1, y + 4, 7, 1);
        ctx.fillRect(x + 4 + s2, y + 8, 9, 1);
      }
      break;
    }
    case 'I': {
      // snow drifts and hairline cracks so the ice fields aren't blank
      const n = hashNoise(tx * 3, ty * 5);
      if (n > 0.78) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 2, y + 10, 9, 2);
        ctx.fillRect(x + 4, y + 8, 5, 2);
      } else if (n < 0.16) {
        ctx.fillStyle = '#a8c8e8';
        ctx.fillRect(x + 3, y + 7, 6, 1);
        ctx.fillRect(x + 8, y + 8, 4, 1);
      }
      break;
    }
    case 'M':
      ctx.fillStyle = '#7a7a92';
      for (let i = 0; i < 12; i++) ctx.fillRect(x + i / 1.5, y + 15 - i, TILE - (i * 1.3), 1);
      ctx.fillStyle = '#e8e8f8';
      ctx.fillRect(x + 5, y + 3, 6, 2);
      break;
    case 'C': {
      const s1 = sway(tx, ty, 0.5);
      ctx.fillStyle = '#2f8f3a';
      ctx.fillRect(x + 6, y + 3, 4, 12);
      ctx.fillRect(x + 2 + s1, y + 7, 3, 5);
      ctx.fillRect(x + 11 + s1, y + 5, 3, 6);
      break;
    }
    case 'F': {
      // factory floor plating with rivets
      ctx.fillStyle = '#3f3a55';
      ctx.fillRect(x, y + 15, TILE, 1);
      ctx.fillRect(x + 15, y, 1, TILE);
      if (hashNoise(tx * 9, ty * 7) > 0.7) {
        ctx.fillStyle = '#6a6484';
        ctx.fillRect(x + 3, y + 3, 2, 2);
        ctx.fillRect(x + 11, y + 10, 2, 2);
      }
      break;
    }
    case 'E': {
      // machinery: the valve wheel turns, so the factory looks powered
      const spin = Math.floor(tick / 12) % 4;
      ctx.fillStyle = '#2f2b40';
      ctx.fillRect(x + 2, y + 3, 12, 12);
      ctx.fillStyle = '#7a7498';
      ctx.fillRect(x + 3, y + 4, 10, 10);
      ctx.fillStyle = '#c05820';
      ctx.fillRect(x + 6, y + 1, 4, 4);
      ctx.fillStyle = '#2f2b40';
      if (spin % 2 === 0) {
        ctx.fillRect(x + 5, y + 7, 6, 1);
        ctx.fillRect(x + 7, y + 5, 1, 6);
      } else {
        ctx.fillRect(x + 5, y + 5, 2, 2);
        ctx.fillRect(x + 9, y + 9, 2, 2);
        ctx.fillRect(x + 9, y + 5, 2, 2);
        ctx.fillRect(x + 5, y + 9, 2, 2);
      }
      break;
    }
    case 'S': {
      const n = hashNoise(tx * 5, ty * 3);
      if (n > 0.8) {
        ctx.fillStyle = '#c89c48';
        ctx.fillRect(x + 2, y + 9, 7, 1);
        ctx.fillRect(x + 6, y + 12, 6, 1);
      }
      break;
    }
    case 'R':
      ctx.fillStyle = '#8a8a9a';
      ctx.fillRect(x + 3, y + 8, 10, 6);
      ctx.fillStyle = '#b0b0c0';
      ctx.fillRect(x + 4, y + 8, 6, 3);
      break;
    case 'b': {
      // Paljasta luumaata: murtuneita palasia sinne tänne, ei kuviota.
      // Tämä on tasainen merkki, eli se kuuluu tien alle — mitään mikä
      // nousisi ruudun keskiriveille ei tähän saa piirtää.
      const n = hashNoise(tx * 7, ty * 11);
      if (n > 0.74) {
        ctx.fillStyle = '#8e9080';
        ctx.fillRect(x + 3, y + 11, 5, 2);
        ctx.fillRect(x + 9, y + 13, 3, 1);
      } else if (n < 0.2) {
        ctx.fillStyle = '#3e4038';
        ctx.fillRect(x + 5, y + 12, 6, 1);
      }
      break;
    }
    case 'K': {
      /* Kallo, luulaakson oma kalusto. Piirretty y+4..y+14, eli se osuu
       * polun pisteen musteeseen (y+5..y+10) täsmälleen kuten puu ja
       * vuori — siksi se on `TALL_TERRAIN`issa eikä siksi että se on
       * korkea. Leuka nyökkää hitaasti: kaikki mikä elää tässä pelissä
       * liikkuu, ja tämä on kuollut, joten se liikkuu vähemmän. */
      const nod = Math.round((Math.sin(tick / 30 + tx * 0.9) + 1) / 2);
      ctx.fillStyle = '#ded6c0';
      ctx.fillRect(x + 4, y + 4, 8, 7);
      ctx.fillRect(x + 5, y + 11 + nod, 6, 2);
      ctx.fillStyle = '#2a2820';
      ctx.fillRect(x + 6, y + 6, 2, 3);
      ctx.fillRect(x + 9, y + 6, 2, 3);
      ctx.fillRect(x + 8, y + 9, 1, 2);
      ctx.fillStyle = '#8e8878';
      ctx.fillRect(x + 4, y + 10, 8, 1);
      ctx.fillRect(x + 6, y + 13 + nod, 4, 1);
      break;
    }
    case 'c': {
      // Pilvipintaa. Tasainen merkki, eli se kuuluu tien alle: pyöreitä
      // kuhmuja ja niiden alle sinertävä varjo, ei mitään joka nousisi
      // ruudun keskiriveille missä polun piste on.
      const n = hashNoise(tx * 7, ty * 3);
      if (n > 0.62) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 3, y + 10, 8, 3);
        ctx.fillRect(x + 5, y + 9, 4, 1);
        ctx.fillStyle = '#c2d0ea';
        ctx.fillRect(x + 3, y + 13, 8, 1);
      } else if (n < 0.22) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 8, y + 12, 5, 2);
      }
      break;
    }
    case 'i': {
      /* Repeämä pilvessä, ja kartan puolisko siitä väitteestä jonka
       * kentät tekevät lattiallaan: tämä maailma on jonkin *päällä*.
       * Aukosta näkyy peltoa ja metsää liian kaukaa erottuakseen
       * miksikään — jos siitä tunnistaisi pellon, se olisi maisema; kun
       * siitä ei tunnista mitään, se on korkeus. Tasainen merkki, joten
       * se ei ole `TALL_TERRAIN`issa eikä tarvitse tilaa tien vierestä. */
      ctx.fillStyle = '#5c7a4c';
      ctx.fillRect(x + 3, y + 7, 10, 7);
      ctx.fillStyle = '#7a6a44';
      ctx.fillRect(x + 4, y + 9, 4, 2);
      ctx.fillRect(x + 9, y + 11, 3, 2);
      ctx.fillStyle = '#46603c';
      ctx.fillRect(x + 3, y + 13, 10, 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 1, y + 6, 13, 2);
      ctx.fillRect(x + 2, y + 14, 12, 2);
      break;
    }
    case 'U': {
      /* Ukkospää. Piirretään y+1..y+13, eli se osuu polun pisteen
       * musteeseen (y+5..y+10) kuten puu ja kallo — siksi se on
       * `TALL_TERRAIN`issa. Pohja on leveä, laki on alasin, ja alin
       * kerros on tummin: ukkospilvi on ainoa pilvi jonka silmä lukee
       * uhkana, ja se lukee sen pohjan väristä. */
      const drift = Math.round(Math.sin(tick / 40 + tx * 0.7) * 1);
      ctx.fillStyle = '#f4f8ff';
      ctx.fillRect(x + 2 + drift, y + 1, 12, 3);
      ctx.fillStyle = '#c8d4ec';
      ctx.fillRect(x + 4 + drift, y + 4, 8, 4);
      ctx.fillStyle = '#8e9cc0';
      ctx.fillRect(x + 3, y + 8, 10, 4);
      ctx.fillStyle = '#5c6890';
      ctx.fillRect(x + 4, y + 12, 8, 1);
      if (Math.floor(tick / 9 + tx * 3) % 24 === 0) {
        ctx.fillStyle = '#fff4a0';
        ctx.fillRect(x + 7, y + 12, 1, 3);
      }
      break;
    }
    case '"': {
      const s1 = sway(tx, ty, 1);
      ctx.fillStyle = '#2a8a30';
      ctx.fillRect(x + 3, y + 9, 10, 5);
      ctx.fillRect(x + 5 + s1, y + 6, 6, 4);
      break;
    }
    case 'w': {
      /* Kivilattia: sauma alas ja oikealle, sama tapa kuin tehtaan
       * pellillä. Litteä glyfi eikä `TALL_TERRAIN`issa, joten se menee
       * tien alle kuten kaikki muukin maan pinta. Laatta on limitetty
       * joka toisella rivillä — suora ruudukko lukisi taustapaperina, ja
       * kivi ladotaan limiin siksi ettei sauma jatku. */
      ctx.fillStyle = '#2e2e40';
      ctx.fillRect(x, y + 15, TILE, 1);
      ctx.fillRect(x + (ty % 2 ? 7 : 15), y, 1, TILE);
      if (hashNoise(tx * 7, ty * 11) > 0.78) {
        ctx.fillStyle = '#4a4a5e';
        ctx.fillRect(x + 4, y + 6, 3, 1);
        ctx.fillRect(x + 9, y + 11, 2, 1);
      }
      break;
    }
    case 'A': {
      /* Rintavarustus, y+2..y+14 — eli se osuu tien pisteen musteeseen
       * (y+5..y+10) kuten puu, kallo ja ukkospää, ja on siksi
       * `TALL_TERRAIN`issa.
       *
       * Soihtu palaa aukossa, ja se on kaksi framea eikä sykkivä hehku:
       * kartan muut liikkeet ovat huojuntaa (puut, pilvet, vesi), joten
       * välkkyvä piste erottuu niistä liikelajina eikä vain värinä. Se on
       * myös ainoa lämmin väri koko kartalla — kylmä kivi ja yksi tuli
       * lukee linnakkeena ilman että mitään tarvitsee kirjoittaa. */
      ctx.fillStyle = '#20202e';
      ctx.fillRect(x + 2, y + 5, 12, 9);
      ctx.fillStyle = '#585870';
      ctx.fillRect(x + 3, y + 6, 10, 7);
      ctx.fillStyle = '#20202e';
      ctx.fillRect(x + 2, y + 2, 2, 3);
      ctx.fillRect(x + 7, y + 2, 2, 3);
      ctx.fillRect(x + 12, y + 2, 2, 3);
      ctx.fillStyle = '#6e6e88';
      ctx.fillRect(x + 2, y + 2, 2, 1);
      ctx.fillRect(x + 7, y + 2, 2, 1);
      ctx.fillRect(x + 12, y + 2, 2, 1);
      const lit = Math.floor(tick / 7 + tx * 2 + ty) % 2;
      ctx.fillStyle = lit ? '#ffcc50' : '#e08020';
      ctx.fillRect(x + 7, y + 8, 2, 2 + lit);
      break;
    }
    default:
      break;
  }
}
