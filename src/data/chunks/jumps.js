/**
 * GENERATED FILE — älä muokkaa käsin.
 *
 *   node tools/gen-jumps.mjs --write
 *
 * Hyppysarjat: palikoita joissa ei ole muuta kuin lautoja ja tyhjää, ja joista
 * jokaisella on todistus mukanaan. Todistus on kahdessa osassa ja molemmat
 * ovat mitattuja eivätkä väitettyjä:
 *
 *   **Ei mahdoton** — `tools/jump-solver.js` löytää jokaiselle loikalle
 *   ponnistuskohdan ja pitoajan, ja ajaa koko sarjan läpi yhtenä juoksuna
 *   voimatasolla 0, pelkällä juoksulla ja hypyllä.
 *
 *   **Vaikea** — jokaisen loikan *ikkuna* eli niiden ponnistuskohtien määrä
 *   pikseleinä jotka vievät perille, on reseptin haarukassa. Leveä ikkuna on
 *   käytävä, nolla on seinä, ja nämä ovat siinä välissä.
 *
 * Ikkunat on kirjoitettu kunkin palikan kommenttiin. Ne ovat sen palikan
 * ominaisuus samalla tavalla kuin leveys, ja ne vanhenevat samalla tavalla:
 * fysiikan muutos muuttaa ne, ja `tools/verify.mjs` mittaa ne uudestaan joka
 * ajolla ja kaatuu jos jokin sarja on muuttunut mahdottomaksi tai kävelyksi.
 */

import { ck } from './common.js';

export const JUMP_CHUNKS = {
  /**
   * HARJOITUS — siemen 7, 5 loikkaa,
   * ikkunat 40–49 px.
   *
   *   kuilu 4, nousu +1, tasanne 3 → ikkuna 49 px
   *   kuilu 5, nousu +0, tasanne 4 → ikkuna 48 px
   *   kuilu 4, nousu +0, tasanne 3 → ikkuna 40 px
   *   kuilu 5, nousu +0, tasanne 3 → ikkuna 47 px
   *   kuilu 5, nousu -1, tasanne 5 → ikkuna 49 px
   *
   * Ratkaistu ja ajettu läpi `tools/jump-solver.js`:llä voimatasolla 0, pelkällä
   * juoksulla ja hypyllä. `verify.mjs` ajaa saman todistuksen uudestaan.
   */
  hyppy_harjoitus: ck(47, {
    0: '###############################################',
    1: '###############################################',
    12: '          ---     ----    ---     ---',
    13: '######                                    #####',
    14: '######                                    #####',
  }),

  /**
   * KAMPI — siemen 2, 6 loikkaa,
   * ikkunat 28–49 px.
   *
   *   kuilu 5, nousu +1, tasanne 2 → ikkuna 33 px
   *   kuilu 5, nousu +1, tasanne 3 → ikkuna 33 px
   *   kuilu 4, nousu +1, tasanne 2 → ikkuna 28 px
   *   kuilu 4, nousu -1, tasanne 3 → ikkuna 33 px
   *   kuilu 4, nousu +0, tasanne 3 → ikkuna 36 px
   *   kuilu 4, nousu -2, tasanne 5 → ikkuna 49 px
   *
   * Ratkaistu ja ajettu läpi `tools/jump-solver.js`:llä voimatasolla 0, pelkällä
   * juoksulla ja hypyllä. `verify.mjs` ajaa saman todistuksen uudestaan.
   */
  hyppy_kampi: ck(50, {
    0: '##################################################',
    1: '##################################################',
    10: '                         --',
    11: '                  ---          ---    ---',
    12: '           --',
    13: '######                                       #####',
    14: '######                                       #####',
  }),

  /**
   * NEULA — siemen 7, 6 loikkaa,
   * ikkunat 9–33 px.
   *
   *   kuilu 5, nousu +2, tasanne 1 → ikkuna 18 px
   *   kuilu 5, nousu +0, tasanne 2 → ikkuna 17 px
   *   kuilu 5, nousu +0, tasanne 1 → ikkuna 15 px
   *   kuilu 5, nousu -1, tasanne 1 → ikkuna 9 px
   *   kuilu 5, nousu +0, tasanne 2 → ikkuna 17 px
   *   kuilu 5, nousu -1, tasanne 5 → ikkuna 33 px
   *
   * Ratkaistu ja ajettu läpi `tools/jump-solver.js`:llä voimatasolla 0, pelkällä
   * juoksulla ja hypyllä. `verify.mjs` ajaa saman todistuksen uudestaan.
   */
  hyppy_neula: ck(48, {
    0: '################################################',
    1: '################################################',
    11: '           -     --     -',
    12: '                              -     --',
    13: '######                                     #####',
    14: '######                                     #####',
  }),
};
