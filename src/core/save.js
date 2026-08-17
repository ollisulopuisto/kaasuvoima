/* Viety, jotta portti voi lukea raa'an tallennuksen. `Save.load` levittää
 * oletukset päälle, joten sen kautta luettuna puuttuvaa kenttää ei voi nähdä. */
export const KEY = 'sfb3.save.v2';

export const DEFAULT_SAVE = () => ({
  lives: 4,
  coins: 0,
  score: 0,
  power: { type: null, level: 0 },
  reserve: null,
  world: 0,
  node: null,
  cleared: {},      // nodeId -> true
  worldsOpen: 1,    // how many worlds are reachable
  usedSaveState: false,   // set once a run has been rewound from a save state
  continues: 0,           // continues this run has used; the board shows the count
  /*
   * levelId -> the keys of the secrets found in it (see core/secrets.js).
   *
   * Added WITHOUT raising the key from v2, and that is the argument: an old
   * save simply has no `secrets`, the spread below hands it `{}`, and `{}` is
   * not a guess — it is the truth, because nothing was ever recorded for that
   * player. No existing field changes meaning and nothing is re-read as
   * something else, which is the case DESIGN.md §6 is about. Bumping the
   * version would delete somebody's lives, score and world progress in order to
   * add a counter that starts at zero anyway. `continues` went in the same way.
   */
  secrets: {},
  /*
   * Voimassa oleva veto kolikoina, 0 kun vetoa ei ole (ks. `updateBet`
   * kartalla ja `finishLevel`). Sisään samalla perusteella kuin `secrets` ja
   * `bestTimes`, eli **ilman versionostoa**: vanhassa tallennuksessa ei ole
   * `bet`-kenttää, levitys antaa sille nollan, ja nolla ei ole arvaus vaan
   * totuus — kukaan ei ole lyönyt vetoa siinä pelissä.
   */
  bet: 0,
  /*
   * levelId -> { frames, marks } eli AIKA-AJON paras aika ja sen välipisteet
   * (ks. core/timeattack.js). Sisään samalla perusteella kuin `secrets` ja
   * `continues`, eli **ilman versionostoa**: vanhassa tallennuksessa ei ole
   * `bestTimes`-kenttää, alla oleva levitys antaa sille `{}`, ja `{}` ei ole
   * arvaus vaan totuus — kukaan ei ole ajanut yhtään aikaa siinä pelissä. Yksi
   * kenttä ei muuta merkitystään eikä mitään lueta toisena asiana.
   *
   * Toiseen suuntaan hinta on kirjattava rehellisesti: vanha build lukee
   * tallennuksen ja jättää tuntemattoman avaimen huomiotta, mutta sen oma
   * `write` ei kirjoita sitä takaisin. Vanhalla buildilla pelaaminen siis
   * pyyhkii ajat — ei muuta, ja ajat ovat ainoa kenttä jonka menettäminen ei
   * vie pelaajalta etenemistä.
   */
  bestTimes: {},
  /*
   * levelId -> true, kun linnakkeen areenalle on kerran päästy.
   *
   * Sisään samalla perusteella kuin `secrets`, `continues` ja `bestTimes`, eli
   * **ilman versionostoa**: vanhassa tallennuksessa ei ole `doors`-kenttää,
   * levitys antaa sille `{}`, ja `{}` on totuus eikä arvaus — kukaan ei ollut
   * päässyt yhdellekään ovelle pelissä jossa ovia ei ollut. Yksikään olemassa
   * oleva kenttä ei muuta merkitystään.
   *
   * Toiseen suuntaan hinta on sama kuin `bestTimes`illa ja se on kirjattava:
   * vanha build lukee tallennuksen, jättää tuntemattoman avaimen huomiotta
   * eikä kirjoita sitä takaisin. Vanhalla buildilla pelaaminen siis unohtaa
   * avatut ovet — ei muuta, ja unohtunut ovi maksaa yhden kävelyn eikä
   * etenemistä.
   */
  doors: {},
  /*
   * Mitä pelaajalle on jo opetettu: avain -> true. Toistaiseksi yksi avain,
   * `peek` eli kaistan vilkaisu.
   *
   * Tämä on tallennuksessa eikä muistissa, koska opetus jonka peli unohtaa ei
   * ole opetus vaan vilkkuva valo: kerran opittu ele ei saa alkaa vilkkua
   * uudestaan seuraavalla latauksella. Sisään samalla perusteella kuin
   * `secrets`, `bestTimes` ja `doors`, eli **ilman versionostoa** — vanhassa
   * tallennuksessa ei ole `taught`-kenttää, levitys antaa sille `{}`, ja `{}`
   * on totuus: kukaan ei ollut oppinut elettä pelissä jossa sitä ei ollut.
   *
   * Kartta eikä boolean, jotta seuraava opetettava asia on yksi avain eikä
   * uusi kenttä — ja jotta vanha build, joka ei kirjoita tätä takaisin, unohtaa
   * kerralla kaikki opetukset eikä puolet niistä.
   */
  taught: {},
  /*
   * levelId -> se sarake jossa kentän kaasulyhty palaa (ks.
   * `LevelScene.lightLamp`). Sisään samalla perusteella kuin `doors`, eli ilman
   * versionostoa: puuttuva kenttä saa `{}`, ja `{}` on totuus — sytyttämättä
   * jääneet lyhdyt ovat sytyttämättä.
   *
   * Sarake eikä `true`, koska vaikeustaso venyttää kentän ja sytytetty sarake
   * on eri paikka eri levyisessä kentässä. Ja **läpäisy tyhjentää sen**
   * (`Game.finishLevel`), toisin kuin ovi: ovi on pysyvä oikotie linnakkeen
   * toistuvaan käytävään, lyhty on yhden yrityssarjan muisti. Pysyvä lyhty
   * tarkoittaisi että kentän alkupuolisko pelataan kerran ja sen jälkeen ei
   * koskaan.
   */
  checks: {},
  /*
   * VAIKEUSTASO, ks. `src/data/scale.js`.
   *
   * Sisään samalla perusteella kuin `secrets`, `bestTimes` ja `doors`, eli
   * **ilman versionostoa**: vanhassa tallennuksessa ei ole `mode`-kenttää,
   * levitys antaa sille `'easy'`, ja se on totuus eikä arvaus — HELPPO *on*
   * täsmälleen se peli jota siinä tallennuksessa on pelattu. Yksikään olemassa
   * oleva kenttä ei muuta merkitystään.
   *
   * Tallennuksessa eikä muistissa, toisin kuin aika-ajo: aika-ajo on tila jonka
   * valitsee se joka istuu koneen ääressä juuri nyt, mutta vaikeustaso on osa
   * sitä kierrosta jota JATKA PELIÄ jatkaa. Kesken NORMAALin aloitettu kenttä
   * ei saa olla HELPPO vain siksi että välilehti suljettiin.
   */
  mode: 'easy',
});

export const Save = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULT_SAVE();
      return { ...DEFAULT_SAVE(), ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SAVE();
    }
  },

  /*
   * Kenttälista on käsin kirjoitettu, ja se on tämän tiedoston ansa.
   *
   * `doors` lisättiin `DEFAULT_SAVE`en muttei tänne, ja seuraus oli että ovi
   * toimi istunnon sisällä ja katosi jokaisesta latauksesta — eli ominaisuus
   * oli olemassa vain niin kauan kuin kukaan ei sulkenut välilehteä. Sama laji
   * vikaa kuin `verify.mjs`:n `reset()`issa: kaksi paikkaa jotka kuvaavat
   * samaa muotoa, ja vain toinen päivittyy.
   *
   * Portti vaatii nyt että jokainen `DEFAULT_SAVE`n avain selviää kierroksesta
   * `write` → `load`, joten seuraava lisäys kaatuu tähän eikä pelaajan
   * tallennukseen.
   */
  write(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        lives: state.lives,
        coins: state.coins,
        score: state.score,
        power: state.power,
        reserve: state.reserve,
        world: state.world,
        node: state.node,
        cleared: state.cleared,
        worldsOpen: state.worldsOpen,
        usedSaveState: !!state.usedSaveState,
        continues: state.continues || 0,
        secrets: state.secrets || {},
        bestTimes: state.bestTimes || {},
        bet: state.bet || 0,
        doors: state.doors || {},
        taught: state.taught || {},
        checks: state.checks || {},
        mode: state.mode || 'easy',
      }));
    } catch {
      /* private mode / storage full — the game just won't persist */
    }
  },

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },

  exists() {
    try {
      return !!localStorage.getItem(KEY);
    } catch {
      return false;
    }
  },
};
