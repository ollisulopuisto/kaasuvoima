/**
 * World 4 — the factory, which is indoors from the first tile to the last.
 * Every chunk in these playlists has a ceiling, so an open-air piece dropped in
 * here reads as a hole in the roof rather than as variety.
 *
 * That rule is also why the world's mechanics wear factory clothes instead of
 * being borrowed whole: `star_block`, `switch_wall` and `beanstalk` are all
 * written for open sky, and the factory versions of them live in
 * chunks/factory.js. One mechanic per level, and no level carries two:
 *
 *   4-1  the crumbling catwalk (already here) and the star
 *   4-2  the hidden bands: the cellar below and the loft on the roof, and —
 *        since 10.8.2026 — the möykky, whose reasoning is written at the level
 *        itself. Two mechanics in one level is a break with the line above and
 *        it is a stated one: the world has three hand-made levels, 4-3 is the
 *        world's peak, and a new verb has to be introduced where there is
 *        attention to spare. The same sentence that bought this level the
 *        hidden bands buys it the möykky.
 *   4-3  the switch
 *   4-F  the möykky again, and this time it costs something
 */

import { GENERATED_LEVELS } from '../generated.js';

/** Which of the generated levels belong to this world — the file holds them all. */
const generated = Object.fromEntries(Object.entries(GENERATED_LEVELS)
  .filter(([id]) => id.startsWith('4-')));

export const WORLD4_LEVELS = {
  /*
   * The star goes in the world's first level because it is the world's first
   * level: 4-1 is where the factory teaches what its enemies are, and half of
   * them — the heartburn jet, the cork guy — cannot be answered by stomping.
   * Meeting the one item that answers everything in the same level you meet
   * the problem is the pairing world 1 made with `star_block`, and it is worth
   * more here than saved for later.
   *
   * `fac_star` sits between the pit and the heartburn corridor, so what the
   * star is for is on screen while it is still running — and the crumbling
   * catwalk after it is deliberately out of reach of the timer, because
   * invincibility has never had anything to say about a floor that leaves.
   */
  '4-1': {
    theme: 'factory', bg: 'factory', music: 'factory',
    chunks: [
      'start', 'fac_floor', 'fort_power', 'fac_press', 'fac_vents', 'corks',
      'fac_belt', 'cork_gap', 'fac_shaft', 'fac_gap', 'fac_star', 'heartburn',
      'fac_crumble', 'fac_press', 'cloud_run', 'fac_vents', 'steps_up', 'run_up',
      'goal', 'goal_end',
    ],
  },
  /*
   * World 4's hidden level, and the only one in the world — a discovery stops
   * being a discovery if there is one in every corner.
   *
   * It is 4-2 rather than 4-1 or 4-3 on purpose. 4-2 is the world's measured
   * breather (the dip in the curve), and looking around is something a player
   * only does in a level that is not currently trying to kill them. Putting
   * the secret in the peak would mean hiding it where nobody has attention to
   * spare.
   *
   * Two ducts, 112 columns apart, and **two different chunks** because they go
   * different ways: `fac_duct_down` stands on the floor at column 128 and drops
   * into `fac_cellar`, `fac_duct_up` hangs out of the roof at column 240 and
   * climbs into `fac_loft`. It was one chunk used twice while a warp could be
   * entered from either end of it; now the direction you travel has to match
   * the mouth you enter, so the picture and the journey have to agree. Neither
   * is on the way to the flag: the ground route through this level is exactly
   * the route it was, one chunk longer.
   *
   * ## MÖYKKY, ja miksi juuri hengähdyskenttä esittelee sen (10.8.2026)
   *
   * `fac_lump` korvaa `fac_floor`in ja `fort_power` vaihtoi paikkaa sen
   * kanssa. Kenttä on **saman mittainen ja samat palikat** yhtä lukuun
   * ottamatta, eli molemmat putket ovat yhä sarakkeissa 128 ja 240.
   *
   * Kaksi perustelua, ja kumpikin on tämän tiedoston omaa argumenttia
   * jatkettuna:
   *
   *   - **Hengähdyskenttä on se paikka jossa uteliaisuus on varaa.** Sama
   *     lause osti tälle kentälle piilokaistat kaksi kappaletta ylempänä. Uusi
   *     verbi tarvitsee saman: möykky pitää nähdä putoamassa tyhjässä
   *     huoneessa ennen kuin sama liike tehdään 4-F:n suihkujen välissä, ja
   *     4-3 on maailman huippu (226,5) eikä siellä ole tarkkaavaisuutta
   *     liikaa. Pahin mahdollinen lopputulos täällä on yksi voimataso: mitään
   *     mihin pudota ei ole, eikä lattiassa ole reikää neljän sarakkeen
   *     päässä kumpaankaan suuntaan (turvaproxyn POHJA).
   *   - **Tehostuslohko meni möykyn eteen, koska pieni pelaaja ei voi rikkoa
   *     tiiltä.** `bumpTile` hajottaa tiilen vain kun `player.big`, joten
   *     möykky ennen kentän ensimmäistä `!`-lohkoa olisi oppitunti jota
   *     pelaaja ei voi ottaa vastaan. Vaihto ei muuta DESIGN.md kohdan 5
   *     lupausta — lohko oli ja on ensimmäisen neljänneksen sisällä — eikä se
   *     muuta yhtään mitattua lukua: kuivuus (pisin `!`-tön pätkä) on 170
   *     saraketta ennen ja jälkeen, koska se mitataan kentän lopusta.
   *
   * Mitattuna kenttä pysyy **tavun tarkkuudella samana**: 141,2 ennen ja
   * jälkeen. Se ei ole sattuma vaan se mitä vaikeusmittari sanoo itsestään —
   * se mittaa lähtötilan, eikä möykky ole lähtötilassa mitään muuta kuin
   * kiinteä laatta tiilen päällä. Notko pysyy notkona.
   */
  '4-2': {
    theme: 'factory', bg: 'factory', music: 'factory',
    chunks: [
      'start', 'fort_power', 'fac_lump', 'fac_belt', 'heartburn_pair', 'fac_shaft',
      'corks', 'fac_press', 'fac_duct_down', 'fac_gap', 'soup_stop', 'fac_vents',
      'fac_belt', 'clouds', 'fac_shaft', 'fac_duct_up', 'heartburn', 'steps_down',
      'run_up', 'goal', 'goal_end',
    ],
    sky: [[240, 'fac_loft']],
    cave: [[128, 'fac_cellar']],
  },
  /*
   * The switch is placed late, after the level's hardest crossing, for two
   * unrelated reasons that happen to agree. A reward is worth most where the
   * player has already paid for it — and everything before column 256 stays
   * byte for byte what it was, so `playable.mjs`'s known 4-3 failure (a gap at
   * column 235 that the bot cannot cross because it will not use floating
   * platforms) still reports from the same column it always did. Measured:
   * before and after, "kuilu sarakkeessa 235".
   */
  /*
   * 4-3 SAI PELIN ENSIMMÄISEN TEHOSTUSPORTIN, ja se on tietoinen poikkeus.
   *
   * Omistajan päätös 18.8.2026: *"voi olla segmenttejä joissa TARVITAAN
   * powerup, mutta VARMISTA ETTÄ POWERUP on saatavilla sitä ennen."* Portti on
   * kahdeksan laatan kuilu — kaksi yli mitatun kuusi laattaa budjetin — ja sitä
   * edeltää `gate_gift`, jossa pierusieni **makaa maassa** poimittavana.
   *
   * Miksi 4-3 eikä maailma 1: tämä on ensimmäinen kohta pelissä jossa
   * pelaajalla on jo ilmahyppy tuttuna työkaluna (maailmat 1–3 opettavat sen),
   * eli portti kysyy taitoa jonka hän osaa eikä opeta kahta asiaa kerralla.
   *
   * **Ilmoitus on lahja itse**, ei sarakeväli kentän datassa: `rules.js`
   * päästää budjettia leveämmän kuilun läpi vain jos sen edessä on lahja
   * enintään 24 saraketta aiemmin. Ensimmäinen versio kirjoitti rajat
   * `gates`-kenttään ja kaatui heti vaikeustasoon — venytetyssä kentässä sama
   * kuilu oli sarakkeessa 199 eikä 164. Laatta ruudukossa venyy mukana;
   * sarakenumero ei.
   *
   * Ilmoitus ei silti ole lupa vaan lupaus joka mitataan: `verify.mjs` ajaa
   * botin kahdesti, lahjan kanssa (on päästävä läpi) ja ilman (on jäätävä
   * jumiin).
   */
  '4-3': {
    theme: 'factory', bg: 'factory', music: 'factory',
    /*
     * TULIMYRSKY (ks. sääosio `scenes/level.js`:n alussa), ja se on tehtaassa
     * eikä taivaalla siksi että täällä sillä on lähde: uuni käryää, ja kekälesade
     * on koneen oire eikä sään oikku. Sama peruste kuin kuumuuden väreilyllä,
     * joka on jo tämän teeman oma (`postfx.js`).
     *
     * Varoitus on puolitoista sekuntia ja se on **taivaassa** eikä nurkassa:
     * juoksuvauhdilla ehtii yhdeksän laattaa, eli katon alle jos sellainen on
     * kuvassa. Tehdas on ainoa teema jossa kattoa on takuulla — `THEME_RULES`
     * vaatii sen — joten myrsky ja suoja saapuivat samaan kenttään.
     */
    firestorm: true,
    chunks: [
      'start', 'spike_walk', 'fort_power', 'fac_vents', 'fac_belt', 'fac_torvi', 'fac_shaft',
      'heartburn_pair', 'cloud_run', 'gate_leap', 'fac_press', 'corks', 'fac_belt',
      'heartburn', 'fac_torvit', 'fac_shaft', 'cloud_run', 'fac_vents', 'fac_switch', 'cork_gap',
      'steps_up', 'run_up', 'goal', 'goal_end',
    ],
  },
  /* `4-4`…`4-7`, generated; the spread's position is the play order. */
  ...generated,
  /*
   * MYLLYLINNA, ja möykyn toinen kohtaaminen.
   *
   * Jälkimmäinen `mill_duct` on `mill_lump`, ei ensimmäinen, ja järjestys on
   * koko idea: sama huone kahdesti, ja toisella kerralla sen katossa on
   * jotain. Pelaaja on jo kulkenut tämän rivin ali sarakkeessa 32 eikä siellä
   * ollut mitään; sarakkeessa 112 rivi on sama ja `?` on samassa kohdassa,
   * mutta sen vasemmalla naapurilla istuu möykky.
   *
   * Kenttä on saman mittainen ja samat suihkut samoissa sarakkeissa, joten
   * mitään mitattua ei liikkunut: 4-F pysyy 214,1:ssä.
   */
  '4-F': {
    theme: 'factory', bg: 'factory', music: 'fortress', boss: true, bossVariant: 3,
    chunks: [
      'start', 'mill_gate', 'mill_duct', 'mill_press', 'mill_gap', 'mill_belt',
      'mill_press', 'mill_lump', 'boss_arena_big',
    ],
  },
};
