/**
 * World 3's chunks. Ice adds fewer pieces than the other worlds because most of
 * its difficulty comes from the floor being slippery, which is a physics change
 * and not a chunk — so what is here is what the world has to teach with geometry
 * instead.
 *
 * Two of these are the same mechanics other worlds already own, rebuilt rather
 * than copied, because sliding changes what they mean. `ice_star` picks a
 * different payoff from grass's `star_block` since the star does nothing about
 * the glacier, and `ice_crumble` is mostly run-off where `fac_crumble` is mostly
 * catwalk. If either is ever tuned, tune it here — the argument for the numbers
 * is the world's floor, not the mechanic.
 */

import { ck, G } from './common.js';

export const ICE_CHUNKS = {
  cloud_run: ck(16, {
    4: '   r',
    7: '        r',
    9: '      ooo',
    10: '     ----',
    13: '###         ####',
    14: '###         ####',
  }),

  /**
   * JÄÄ, ensimmäinen kerta — ja se on rakennettu niin ettei se voi tappaa.
   *
   * Tämä chunk on `T.ICE`:n ensiesittely koko pelissä, ja ensiesittelyltä
   * vaaditaan kolme asiaa (`tools/curriculum.mjs`, POHJA): alla on lattiaa,
   * ympärillä ei ole kuilua, eikä samalla ruudulla ole toista uutta asiaa.
   * Kaikki kolme ovat tässä rakenteessa eivätkä lupauksessa — rivi 14 on
   * yhtenäistä maata reunasta reunaan, joten jäältä ei voi pudota mihinkään.
   *
   * **Miksi jäätä on kahdeksan laattaa eikä kolme.** Kolmen laatan jäätä ei
   * huomaa: juoksuvauhdilla sen yli menee kuudessa framessa, eikä kuudessa
   * framessa ehdi tapahtua mitään joka olisi opetus. Kahdeksan laattaa on 51
   * framea juosten, mikä on pidempään kuin otteen irrottaminen kestää — eli se
   * on ensimmäinen paikka jossa pelaaja voi *kokeilla* mitä irrottaminen tekee
   * ja nähdä vastauksen ennen kuin jää loppuu.
   *
   * **Miksi lopussa on tiilipari.** Liukas lattia jolla ei ole mitään mihin
   * liukua on tyhjä väite: pelaaja kävelee sen yli eikä huomaa mitään. Tiili on
   * se seinä johon liu'un loppu näkyy, ja se on tiili eikä piikki juuri siksi
   * että **hinta on nolla** — kylkeen törmääminen pysäyttää (`moveX` nollaa
   * `vx`:n) eikä satuta. Se on tämän maailman oma versio siitä mitä 2-1:n matala
   * juoksuhiekka tekee: mekaniikka opetetaan tilanteessa jossa sen kohtaaminen
   * on ilmaista, ja hinta peritään vasta myöhemmin.
   *
   * Neljä laattaa tavallista maata jään jälkeen ennen tiiltä, ja se on mitattu
   * eikä silmämääräinen: `tools/measure-braking.mjs` sanoo että jäältä
   * tavalliselle maalle tullut voimatason 0 pelaaja pysähtyy juoksuvauhdista
   * 4,9 laatassa. Eli neljä on juuri sen verran vähän että täyttä vauhtia tullut
   * *osuu* tiileen — mikä on koko opetus — ja kävellen tullut pysähtyy ennen
   * sitä. Kumpikin lopputulos on oikea, ja kumpikaan ei maksa mitään.
   *
   * Kolikot jään päällä eivätkä sen jälkeen: palkinto on ylityksestä, ei
   * pysähtymisestä. Ei vihollisia, koska tällä ruudulla on jo yksi uusi asia.
   */
  ice_first: ck(18, {
    9: '     o o o o',
    12: '                B',
    13: '####IIIIIIII######',
    14: '##################',
  }),

  /**
   * The spiky walker, on open flat ground on purpose.
   *
   * The lesson is "reach for another tool", not "die to a surprise": there is
   * room to back off, nothing to fall into, and a power block earlier in the
   * level answers the question. Pairing it with a forced jump or a narrow ledge
   * would teach the wrong thing.
   */
  spike_walk: ck(16, { 9: '   o o o', 12: '        x', 13: G, 14: G }),

  /**
   * The world's own pit, and the reason it is not `pit_s`.
   *
   * A gap is scored — and played — against what the jump carries, and the
   * measured budget (`tools/jump-budget.json`) sizes a gap at 70 % of the
   * *running* jump: 155 px carry, so six tiles. That number assumes the player
   * arrives running. On every other floor that is a choice; on this one it is
   * not. Ice does not let you set up a jump, it hands you whatever speed the
   * approach happened to leave you with, and a six-tile gap taken at a walk is
   * a death with no tell.
   *
   * So this world's pits are sized to the *walking* jump instead, by the same
   * 70 % rule and the same measured file: 87 px carry × 0.7 = 61 px, which is
   * three tiles and change. Four tiles is what that rounds to and what is
   * written here — a gap that clears from a walk, and clears from a run with
   * more room than the budget asks for.
   *
   * That is not a softer world, it is the same world measured honestly. What
   * makes world 3 hard is the floor, and the floor's tax is paid on every tile
   * of the level; pits at the edge of a budget the floor will not let you meet
   * charge for it a second time.
   */
  /**
   * PAUKKUPÖHÖN ENSIESITTELY, ja se on tasaisella jäällä eikä missään muualla.
   *
   * Kaikki mitä tämä ruutu opettaa on yksi asia: **tallaus ei poistanut sitä.**
   * Siksi tässä ei ole kuoppaa, ei toista vihollista eikä kattoa — jos
   * ensimmäinen sytytetty paukkupöhö olisi kuilun huulella, pelaaja oppisi
   * "kuolin kuoppaan" eikä sitä mitä tapahtui.
   *
   * Kolikot ovat siinä missä hyppy laskeutuu, eli tasan siellä missä sytyttäjä
   * seisoisi katsomassa. Se ei ole ansa vaan opetus: kolikkorivi on tämän pelin
   * ainoa osoitin, ja tässä se osoittaa siihen kohtaan josta pitää lähteä pois.
   *
   * Jäällä, ja se on maailman oma lisä: sytytetty pöhö jää paikalleen, mutta
   * pelaaja ei jää — poistuminen on liukas, ja se on tämän maailman versio
   * samasta lauseesta.
   */
  ice_pommi: ck(16, {
    9: '     o o o',
    12: '       m',
    13: G,
    14: G,
  }),

  /**
   * PAUKKUPÖHÖ TOISEN KERRAN, ja nyt sillä on lattiaa vähemmän.
   *
   * Sama otus, eri huone: kuoppa ensin, ja sen takana kapea jäätasanne jolla
   * pöhö kävelee. Ensimmäisellä kerralla vastaus oli "älä tallaa sitä" ja
   * tämä kysyy sen uudestaan tilanteessa jossa tallaus on se mitä käsi tekee
   * itsestään — hyppy kuilun yli laskeutuu suoraan sen päälle.
   *
   * Tasanne on `ICE_BRAKE`n verran leveä (viisi laattaa), eli sillä ehtii
   * pysähtyä myös liukkaalla. Se ei ole armo vaan ehto: kuilun toisella
   * puolella oleva räjähtävä otus on kysymys, ja kysymys jolla ei ole
   * vastausta on ansa.
   */
  ice_pommi_gap: ck(16, {
    9: '  o o',
    12: '           m',
    13: '#####     ######',
    14: '#####     ######',
  }),

  ice_pit: ck(16, { 13: '######    ######', 14: '######    ######' }),

  /**
   * `pit_twin` rebuilt, and this one is a correction rather than a variation.
   *
   * The common chunk's own note says what it is for: "the first one has to
   * *stop*, because the landing is two tiles wide and the next gap starts
   * immediately after it." That is a fine idea in the grass and in the desert.
   * Here it asks for the one thing this world is built to refuse — a power-0
   * player released at P-speed coasts 9.7 tiles (measured; see `ice_crumble`
   * below), so a two-tile island between two gaps is not a landing, it is a
   * slide into the second gap at whatever speed the first one gave you.
   *
   * Same shape, therefore, with the two numbers the floor decides: the island
   * is four tiles instead of two, and each gap is three instead of five. The
   * skill asked for is still two jumps in a row rather than one big one, which
   * was the point of the original; what is gone is the requirement to brake on
   * ice between them.
   *
   * Coins over the gaps and not over the island, the same way round as
   * `ice_crumble`: the line that pays and the line that survives are one line.
   */
  ice_twin: ck(16, {
    9: '    o o    o o',
    13: '####   ####   ##',
    14: '####   ####   ##',
  }),

  /**
   * Supertähti, and the two things in this world it actually answers.
   *
   * Grass has `star_block` and this is deliberately not a copy of it. The star
   * replaces exactly one thing — the hit an inhabitant would land — and the ice
   * world's two inhabitants worth spending it on are the spiky walker, which is
   * the one enemy here a stomp does not remove, and a bed of ground spikes.
   * Both are covered; the glacier is not, and neither is a pit. That is why
   * there is no `W` anywhere near this chunk: standing a star in front of the
   * glacier would promise something it does not do, and the player would only
   * find that out by dying in it.
   *
   * Skippable, like every reward here. Without the star the walker is jumped
   * and the spike bed is jumped, on flat open ground with six tiles of landing
   * between them — the same "room to back off" `spike_walk` is built around,
   * and the reason the spikes sit at the very end of the chunk rather than in
   * the middle of it.
   */
  ice_star: ck(16, {
    9: '  *',
    12: '      x      ^^^',
    13: G,
    14: G,
  }),

  /**
   * The floor that leaves, on the world whose whole idea is that you cannot
   * stop on the floor. Nine crumbling tiles at ground level, nothing under
   * them, four tiles of ground before and **twelve after**.
   *
   * The inversion worth writing down, because it is the opposite of what it
   * looks like: ice makes the catwalk itself *easier*, not harder. A crumbling
   * floor only kills people who stand still — each tile gives 52 frames from
   * the moment it is stepped on, so anyone still moving is always ahead of the
   * hole — and standing still is the one thing this world will not let you do.
   * The factory version of this is a test of nerve. Here it is barely a test at
   * all.
   *
   * What ice adds is at the far end, and that is where the whole design went.
   * You come off the catwalk carrying whatever speed got you across, and the
   * run-off has to be long enough that letting go of everything still works.
   * The worst case is not the one it looks like — it is the *smallest* player,
   * because small has less friction than big, not more:
   *
   *   fastest ground speed anyone can reach   MAX_P 3.5 px/frame
   *   deceleration on release, small          FRICTION_SMALL 0.0391 px/frame²
   *   deceleration on release, big            FRICTION_BIG   0.0547 px/frame²
   *   distance to a standstill, small         3.5² / (2 × 0.0391) = 157 px
   *   distance to a standstill, big           3.5² / (2 × 0.0547) = 112 px
   *
   * Measured in the engine rather than trusted: released at MAX_P a power-0
   * player coasts 154.9 px in 90 frames — 9.68 tiles — and a power-1 one
   * 110.2 px. Twelve tiles is what the run-off gets, so the worst case anyone
   * can produce lands with two tiles to spare, and the first draft's nine would
   * have been two thirds of a tile short of it. Run in 3-3: let go the moment
   * the catwalk ends at column 253 and a power-0 player comes to rest at column
   * 262, with the run-off ending at 264. (Skidding instead of releasing stops
   * in 49 px, so the player who reacts is never the one at risk.)
   *
   * The run-off is bare ground on purpose: a coin, a block or an enemy in it
   * would turn the spare tiles into a reason to be somewhere precise, and the
   * spare tiles are the entire safety argument. It is also self-contained on
   * purpose — the guarantee must not depend on which chunk the playlist happens
   * to put next.
   *
   * The entry side gets four tiles and no more, and that is also deliberate.
   * Four tiles is not enough to stop in from any real speed, so arriving fast
   * means arriving committed — and committed is the safe state here. A long
   * approach would only invite the player to stop and think on the one surface
   * that punishes thinking.
   *
   * Things tried and thrown out:
   *   - a solid tile in the middle of the catwalk, as a place to rest. Ice does
   *     not let you rest on it, so it is a promise the floor cannot keep.
   *   - the glacier underneath instead of open air. Lava has no ledge to land
   *     on — that is why the difficulty meter prices it above spikes — and a
   *     floor that leaves over a surface with no recovery is two unfair things
   *     stacked, not one interesting one.
   *
   * The coins sit over the crumbling tiles rather than the safe ends, the same
   * way round as `fac_crumble`: the greedy line and the safe line are one line,
   * so the tension is pace and never a choice made before you start.
   */
  ice_crumble: ck(25, {
    9: '     o o o o',
    13: '####%%%%%%%%%############',
    14: '####         ############',
  }),
};
