import { Input } from './core/input.js';
import { Save } from './core/save.js';
import { Music, Sfx, toggleMute, isMuted, audioDiag } from './core/audio.js';
import { drawText } from './gfx/font.js';
import { WORLDS, startNode, findNode } from './data/worlds.js';
import { TitleScene } from './scenes/title.js';
import { WorldMapScene } from './scenes/worldmap.js';
import { LevelScene } from './scenes/level.js';
import { DemoScene } from './scenes/demo.js';
import { InterludeScene, GameOverScene, EndingScene, VictoryScene } from './scenes/cards.js';
import { makePower } from './entities/player.js';
import { writeSlot, readSlot, restoreState, SLOT_COUNT } from './core/savestate.js';
import { NameEntryScene, HighScoreScene } from './scenes/scores.js';
import { ShareScene } from './scenes/share.js';
import { DailyScene } from './scenes/daily.js';
import { DifficultyScene } from './scenes/difficulty.js';
import { difficultyLabel, modeId } from './data/scale.js';
import { dailyBegin, dailyProgress, dailyFinish, DAILY_TITLE } from './core/daily.js';
import { qualifies, GAME_VERSION } from './core/scores.js';
import { takeChallenge } from './core/challenge.js';
import { downloadExport, eventCount, levelSummary, clearTelemetry } from './core/telemetry.js';
import { PostFX, PRESET_NAMES } from './gfx/postfx.js';
import { Touch, LAYOUT_NAMES } from './core/touch.js';
import {
  PAUSE_TITLE, PAUSE_KEYS, NO_SAVESTATES, CONFIRM_RESET, TIMES_CLEARED,
  NOTHING_TO_CLEAR, bestTimes, clearBestTimes,
} from './core/timeattack.js';

const W = 320;
const H = 240;
const STEP = 1000 / 60;

const CARD_BONUS = { shroom: 2, flower: 3, star: 5 };

/*
 * Kertojan ääni siitä mitä selain ei suostu tekemään. Ks. `updateAudioHint`.
 * Rivi on 38 merkkiä eli 228 pikseliä, mahtuu keskitettynä 320:een.
 */
const AUDIO_HINT = 'OHJAIN EI AVAA ÄÄNTÄ - PAINA NÄPPÄINTÄ';

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.input = Input;
    this.adoptState(Save.load());
    this.scene = null;
    this.paused = false;
    this.pauseBlink = 0;
    /* Valittu rivi taukovalikossa. Ks. `pauseItems`. */
    this.pauseIndex = 0;
    this.accumulator = 0;
    this.lastTime = 0;
    this.slot = 1;
    this.flash = '';
    this.flashTimer = 0;
    /* Onko `flash`-rivillä juuri nyt ääniloukun vihje vai oikea ilmoitus.
     * Ks. `updateAudioHint` — se on koko etuoikeusjärjestys. */
    this.flashIsHint = false;
    this.audioHintWasUp = false;
    /* Pelaaja on kuitannut vihjeen. **Vain muistissa**: tämä ei ole asetus vaan
     * yhden istunnon vastaus yhteen kysymykseen, eikä selaimen muistiin kirjoiteta
     * uutta avainta sen takia. Seuraava lataus kysyy uudestaan, ja kysyy oikein,
     * koska seuraavalla kerralla ensimmäinen ele voi hyvinkin olla näppäin. */
    this.audioHintOff = false;
    this.pendingNode = null;
    /* Käynnissä oleva päivän yritys, tai null. Elää **vain muistissa**: se mikä
     * siitä säilyy on `sfb3.daily.v1`, ja sen kirjoittaa `core/daily.js`. */
    this.dailyRun = null;

    /* AIKA-AJO. **Vain muistissa** ja tarkoituksella: tila on valinta jonka
     * tekee se joka istuu koneen ääressä juuri nyt, ei ominaisuus jonka
     * tallennus muistaa puolesta. Parhaat ajat ovat tallennuksessa, tila ei —
     * eli seuraava lataus alkaa tavallisena pelinä ja ajat ovat silti
     * tallessa. Ks. `startTimeAttack` ja core/timeattack.js. */
    this.timeAttack = false;
    /* Framea joina nollauksen vahvistus on voimassa. Ks. `resetBestTimes`. */
    this.resetArmed = 0;

    /* Kaverin tulos, jos tänne tultiin haastelinkistä. Se asetetaan
     * käynnistyksessä ja elää **vain muistissa**: haasteen vastaanotto ei
     * kirjoita tallennukseen, pistetauluun eikä pelidataan. Sama vaatimus kuin
     * esittelytilalla, ja samasta syystä — vieraan lähettämä linkki ei saa
     * jättää jälkeä siihen mikä on pelaajan omaa. */
    this.challenge = null;

    // Deaths per level in this sitting, so a clear can record what it cost.
    // Deliberately not persisted: it is an input to one telemetry event, not
    // part of the player's save.
    this.attempts = {};

    // 9 / ` toggles the developer overlay.
    this.debug = false;
    this.fps = 0;
    this.frameMs = 0;
    this.workMs = 0;
    this.stepsThisFrame = 0;
    this._fpsFrames = 0;
    this._fpsSince = 0;
  }

  /**
   * VAIKEUSTASO, ja se luetaan täältä eikä mistään globaalista.
   *
   * Se asuu tallennuksessa (`state.mode`), koska se on osa kierrosta eikä
   * istunnon valinta — JATKA PELIÄ jatkaa sitä peliä jota oltiin pelaamassa.
   * Tämä lukija normalisoi puuttuvan ja tuntemattoman arvon oletukseksi, joten
   * vanha tallennus, esittelytilan tekotila ja päivän pierun tilapäinen tila
   * ovat kaikki HELPPO ilman että yksikään niistä tietää tästä mitään.
   */
  get mode() {
    return modeId(this.state && this.state.mode);
  }

  toast(text, frames = 90) {
    this.flash = text;
    this.flashTimer = frames;
    this.flashIsHint = false;
  }

  /* ------------------------------ lifecycle ---------------------------- */

  setScene(scene) {
    this.scene = scene;
    /* A pause happened to a level; it is not a mode the machine is in. Leaving
     * it set across a scene change is a dead end rather than a cosmetic bug:
     * the pause key only answers inside a LevelScene, so a paused world map
     * cannot be un-paused by anything, and `step` skips its update. The debug
     * warp is the easiest way to get there — pause, then jump worlds — but any
     * scene change made while paused does it.
     *
     * Cleared here for the same reason the ambience is: it belongs to the place
     * you were in, and leaving each scene to remember to turn it off is how it
     * got left on in the first place. `quickLoad` clears it by hand too; that
     * line is now redundant, and harmless. */
    this.paused = false;
    // Atmosphere belongs to the place you are in, so it is set from the scene
    // rather than left for each scene to remember to turn off.
    PostFX.setAmbience(scene.theme || null, scene.def || null);
    if (scene.enter) scene.enter();
  }

  toTitle() {
    /* Alkuruutu on se paikka josta tila valitaan, joten se on myös se paikka
     * jossa valinta raukeaa. Ilman tätä peli poikki -ruudun kautta palaava
     * pelaisi seuraavan kierroksen aika-ajossa valitsematta sitä. */
    this.timeAttack = false;
    this.resetArmed = 0;
    this.setScene(new TitleScene(this));
  }

  /**
   * AIKA-AJO päälle ja kentille.
   *
   * Sama peli, samat kentät, sama pistelasku — tila lisää neljä sääntöä eikä
   * muuta mitään olemassa olevaa: jokaisesta kentästä jää paras aika, jako
   * kertoo kesken kentän ollaanko sitä edellä, tilaa ei ladata, ja kello käy
   * myös taukovalikossa.
   */
  startTimeAttack() {
    this.timeAttack = true;
    if (Save.exists()) this.continueGame();
    else this.newGame();
  }

  /**
   * Ajat nollaan, mutta vasta kysymyksen jälkeen.
   *
   * Yksi painallus joka pyyhkii kaikki 60 aikaa on ansa, ja peruutusta ei ole.
   * Toinen painallus on halvempi kuin väärä ensimmäinen. Vahvistus vanhenee
   * itsestään kolmessa sekunnissa, koska aseistettu näppäin joka jää päälle on
   * sama ansa hitaammin.
   *
   * @returns 'off' | 'empty' | 'arm' | 'cleared' — mitä painallus teki.
   */
  resetBestTimes() {
    if (!this.timeAttack) return 'off';
    if (Object.keys(bestTimes(this.state)).length === 0) {
      this.toast(NOTHING_TO_CLEAR);
      Sfx.play('bump');
      return 'empty';
    }
    if (this.resetArmed <= 0) {
      this.resetArmed = 180;
      this.toast(CONFIRM_RESET, 180);
      Sfx.play('cursor');
      return 'arm';
    }
    this.resetArmed = 0;
    const n = clearBestTimes(this.state);
    this.persist();
    this.toast(`${TIMES_CLEARED}  ${n}`);
    Sfx.play('powerdown');
    return 'cleared';
  }

  toWorldMap() {
    this.setScene(new WorldMapScene(this));
  }

  /* ----------------------------- päivän pieru --------------------------- */

  toDaily() {
    this.setScene(new DailyScene(this));
  }

  /**
   * Käynnistää päivän yrityksen — ja kuluttaa sen.
   *
   * Kaksi asiaa tapahtuu tässä eikä missään muualla, ja molemmat ovat
   * päätöksiä (ks. `src/core/daily.js`):
   *
   *   1. **Yritys kuluu nyt**, ei kentän lopussa. `dailyBegin` palauttaa
   *      `false` jos päivä on jo käytetty, ja silloin tästä ei mennä
   *      minnekään: se on tilan koko sääntö yhtenä ehtona.
   *   2. **Oma tila, jota ei kirjoiteta tallennukseen.** Päivän kenttä ei saa
   *      koskea pelaajan elämiin, maailmaan eikä pisteisiin — sama vaatimus
   *      kuin esittelytilalla. Kierroksen tila on tilapäinen olio ja oikea
   *      talletetaan muistiin sellaisenaan, ei `adoptState`n kautta, koska se
   *      tyhjentäisi kesken olevan kierroksen kortit.
   *   3. **Päivän yritys ei ole aika-ajo.** `toTitle` nollaa lipun jo nyt,
   *      joten tämä on käytännössä totta ennestään; se sanotaan silti tässä,
   *      koska seuraava reitti tähän ei välttämättä kulje alkuruudun kautta.
   *      Yksi yritys ja paras aika ovat vastakkaisia ajatuksia — ennätys
   *      syntyy toistamalla — ja `setBest` kirjaisi ajan tunnuksella `PP`,
   *      joka on huomenna eri kenttä. Lippu palautuu tarkalleen entiselleen.
   */
  startDaily(level) {
    if (!dailyBegin(level.day)) return;
    this.dailyRun = {
      day: level.day, saved: this.state, frames: 0, wasTimeAttack: this.timeAttack,
    };
    this.timeAttack = false;
    this.state = {
      lives: 1, coins: 0, score: 0, power: makePower(), reserve: null,
      world: 0, node: null, cleared: {}, worldsOpen: 1, cards: [], secrets: {}, doors: {},
      checks: {}, continues: 0, usedSaveState: false,
      /* Opitut eleet **peritään** eikä nollata: päivän pieru on oma
       * kierroksensa mutta sama pelaaja, ja kerran opittu ele ei saa alkaa
       * vilkkua uudestaan siksi että kierros on kertakäyttöinen. */
      taught: (this.state && this.state.taught) || {},
    };
    this.setScene(new InterludeScene(this, level.def.id, () => {
      this.setScene(new LevelScene(this, level.def.id, level.def));
    }, DAILY_TITLE));
  }

  /** Kuinka suuren osan kentästä pelaaja on ehtinyt kulkea, prosentteina. */
  dailyReach(scene) {
    if (!scene || !scene.widthPx) return 0;
    return Math.max(0, Math.min(100, Math.round((scene.bestX / scene.widthPx) * 100)));
  }

  /**
   * Kentän aikana kirjattu eteneminen, ja se on koko syy siihen että sivun
   * lataus kesken kentän on luovutus eikä nolla.
   *
   * Puolen sekunnin välein: harvemmin kuin framea kohti, koska localStorage on
   * synkroninen kirjoitus, ja tiheämmin kuin kerran kentässä, koska muuten
   * "siihen asti mihin pääsit" olisi karkeampi kuin pelaajan viimeinen hyppy.
   */
  noteDailyProgress() {
    const run = this.dailyRun;
    if (!run || !(this.scene instanceof LevelScene)) return;
    if (++run.frames % 30) return;
    dailyProgress(run.day, {
      reach: this.dailyReach(this.scene),
      score: this.state.score,
      coins: this.state.coins,
    });
  }

  /**
   * Päivän yritys päättyi. Tulos on lopullinen kummallakin tavalla — maaliin
   * tai kuolemaan — koska yrityksiä on yksi.
   */
  finishDaily(result) {
    const run = this.dailyRun;
    const rec = dailyFinish(run.day, {
      cleared: !!result.cleared,
      reach: this.dailyReach(this.scene),
      score: this.state.score,
      coins: this.state.coins,
    });
    this.state = run.saved;
    this.timeAttack = run.wasTimeAttack;
    this.dailyRun = null;
    this.setScene(new DailyScene(this, rec));
  }

  /**
   * `runScore` on juuri päättyneen kierroksen tulos, tai -1 kun taululle
   * tullaan valikosta. Se on erillään `highlight`istä siksi että kierros voi
   * jäädä listan ulkopuolelle ja **silti voittaa haasteen** — kymmenes sija ei
   * ole sama asia kuin kaverin päihittäminen.
   */
  toHighScores(highlight = -1, runScore = -1) {
    this.setScene(new HighScoreScene(this, highlight, null, runScore));
  }

  /* -------------------------------- jako ------------------------------- */

  /**
   * Missä jakoruutu roikkuu: alkuruudussa ja pistetaulussa, ei muualla.
   *
   * Nämä kaksi ovat ne ruudut joissa pelaaja seisoo paikallaan ja päättää
   * jotain, ja pistetaulu on lisäksi jokaisen pelatun kierroksen pääteasema —
   * `finishRun` päätyy sinne aina, pääsi tulos listalle tai ei. Peli poikki
   * -ruutu hylättiin tarkoituksella: se on valikko joka päättää säilyykö
   * kierros, ja sitä painetaan jo nyt vahingossa. Kentästä ei voi jakaa
   * ollenkaan, koska kohtauksen vaihto keskellä kenttää tappaisi juoksun.
   */
  canShareHere() {
    /* Päivän ruutu on kolmas: se on pelatun yrityksen pääteasema ja se ainoa
     * paikka jossa päivän tulosrivi on olemassa. */
    return this.scene instanceof TitleScene || this.scene instanceof HighScoreScene
      || this.scene instanceof DailyScene;
  }

  /** Sama kohtausolio talteen, jotta paluu tuo pistetaulun korostuksineen. */
  toShare() {
    if (this.scene instanceof ShareScene) return;
    this.setScene(new ShareScene(this, this.scene));
  }

  /* ------------------------------- attract ----------------------------- */

  /** The title screen has been left alone: play the game to nobody. */
  startDemo() {
    this.setScene(new DemoScene(this));
  }

  /**
   * Back to the title, from a keypress or from the bot running out of level.
   * Either way the title is where the machine belongs: it is the one screen a
   * player can start from, and it re-arms the idle timer, so the demo comes
   * back around on its own if the room stays empty.
   */
  endDemo() {
    if (!(this.scene instanceof DemoScene)) return;
    this.scene.dispose();
    this.toTitle();
  }

  /**
   * End of a run: onto the board if the score is good enough, then show it.
   * `world` is one-based so the table reads like the level names do.
   */
  finishRun() {
    const result = {
      score: this.state.score,
      world: this.state.world + 1,
      // The level the run actually reached, so the board says 2-3 and not
      // merely "world 2" — the difference between walking in and dying at the
      // castle door is the whole story of a run.
      level: (this.pendingNode && this.pendingNode.level) || '',
      assisted: !!this.state.usedSaveState,
      // Continues are unlimited and cost no points, so the count is the only
      // place the difference between a clean run and a sixth try shows up.
      continues: this.state.continues || 0,
    };
    /* A run that skipped worlds is not a run. No mark would be honest enough.
     * Se ei myöskään voita haastetta: jos kierros ei kelpaa omalle taululle,
     * se ei kelpaa kaverinkaan päihittämiseen. Tilatallennuksella pelattu
     * kierros sen sijaan kelpaa molempiin — taulu merkitsee sen tähdellä, ja
     * haaste seuraa taulua eikä keksi omaa sääntöään. */
    if (this.state.debugWarped) {
      this.toHighScores();
      return;
    }
    if (!qualifies(result.score)) {
      this.toHighScores(-1, result.score);
      return;
    }
    this.setScene(new NameEntryScene(this, result,
      (index) => this.toHighScores(index, result.score)));
  }

  /** Builds a level scene without showing it — used by save-state restore. */
  makeLevelScene(levelId, nodeId) {
    if (nodeId) {
      const world = WORLDS[this.state.world];
      this.pendingNode = (world && findNode(world, nodeId)) || this.pendingNode;
    }
    return new LevelScene(this, levelId);
  }

  /**
   * Takes on a freshly loaded save. Saves written before continues were counted
   * carry no count, so it is normalized to a number here rather than left for
   * the board to guess at — a blank continue column and a zero mean different
   * things and only one of them is true.
   */
  adoptState(state) {
    this.state = state;
    this.state.cards = [];
    if (typeof this.state.continues !== 'number') this.state.continues = 0;
  }

  /**
   * UUSI PELI kysyy ensin, ja `newGame` ei kysy mitään.
   *
   * Jako on tarkoituksellinen ja se on portin takia yhtä paljon kuin pelaajan:
   * `newGame()` tarkoittaa yhä "aloita kierros nyt", eli sen jälkeen ollaan
   * kartalla, ja kymmenen väitettä nojaa juuri siihen. Valinta on siis oma
   * ruutunsa oman napin takana (`scenes/difficulty.js`), ja se päättyy samaan
   * `newGame`iin johon tämä napin painallus ennenkin päättyi.
   */
  chooseDifficulty() {
    this.setScene(new DifficultyScene(this, (mode) => this.newGame(mode)));
  }

  /**
   * `mode` oletuksena se jolla nyt pelataan, ja oletus lasketaan ennen
   * `Save.clear()`iä — parametrin oletusarvo evaluoituu kutsuhetkellä, runko
   * vasta sen jälkeen. Ilman sitä järjestystä `newGame()` ilman argumenttia
   * lukisi juuri tyhjennetyn tallennuksen ja vastaisi aina HELPPO.
   */
  newGame(mode = this.mode) {
    Save.clear();
    this.adoptState(Save.load());
    this.state.mode = modeId(mode);
    this.state.node = startNode(WORLDS[0]).id;
    this.persist();
    this.toWorldMap();
  }

  continueGame() {
    this.adoptState(Save.load());
    if (this.state.lives < 1) this.state.lives = 4;
    this.toWorldMap();
  }

  persist() {
    Save.write(this.state);
  }

  /* -------------------------------- flow ------------------------------- */

  startLevel(node) {
    this.state.node = node.id;
    this.pendingNode = node;
    this.persist();
    this.setScene(new InterludeScene(this, node.level, () => {
      this.setScene(new LevelScene(this, node.level));
    }));
  }

  finishLevel(result) {
    const scene = this.scene;
    const node = this.pendingNode;

    /* Päivän yrityksellä ei ole solmua kartalla eikä sillä ole seuraavaa
     * kenttää: se päättyy omaan ruutuunsa kummallakin tavalla. Haara on ensin,
     * koska kaikki alla oleva puhuu `pendingNode`ista. */
    if (this.dailyRun) {
      this.finishDaily(result);
      return;
    }

    /*
     * VETO RATKEAA TÄSSÄ, ja se on ainoa paikka jossa se voi ratketa:
     * `finishLevel` on se yksi funktio jonka läpi jokainen kentän loppu kulkee
     * — kuolema, maali ja päivän yritys omalla haarallaan. Ks. `updateBet`
     * kartalla.
     *
     * Häviö on hiljainen ja voitto kuuluu: panos on jo maksettu talossa, joten
     * kuolema ei vie mitään enempää kuin sen minkä se muutenkin vei, ja
     * läpäisy tuo tuplat. Veto nollataan kummassakin tapauksessa — se koski
     * *seuraavaa* kenttää, ja seuraava kenttä on nyt takana.
     */
    if (this.state.bet) {
      const stake = this.state.bet;
      this.state.bet = 0;
      if (result.cleared) {
        this.state.coins += stake * 2;
        Sfx.play('payout');
        this.toast(`VETO VOITTI: ${stake * 2} KOLIKKOA`);
      } else {
        this.toast('VETO MENI');
      }
      this.persist();
    }

    if (result.died) {
      this.state.power = makePower();
      this.state.lives--;
      this.persist();
      if (this.state.lives < 0) {
        this.state.lives = 4;
        this.persist();
        this.setScene(new GameOverScene(this));
      } else {
        this.toWorldMap();
      }
      return;
    }

    // cleared
    this.state.power = scene.player ? scene.player.power : this.state.power;
    this.state.cleared[node.id] = true;
    /* Läpäisty kenttä unohtaa lyhtynsä: tarkistuspiste on yhden yrityssarjan
     * muisti eikä pysyvä oikotie (ks. `save.js`, `checks`). Ilman tätä riviä
     * kentän alkupuolisko pelattaisiin kerran eikä koskaan enää. */
    if (this.state.checks) delete this.state.checks[node.id];
    if (result.card) this.collectCard(result.card);
    this.persist();

    if (node.type === 'fortress') {
      // The castle is the hardest thing in the world; the game should say so
      // before it hands out the next map.
      this.setScene(new VictoryScene(this, this.state.world + 1, () => this.completeWorld()));
      return;
    }
    this.toWorldMap();
  }

  collectCard(card) {
    this.state.cards.push(card);
    if (this.state.cards.length < 3) return;
    const [a, b, c] = this.state.cards;
    const bonus = a === b && b === c ? (CARD_BONUS[a] || 1) : 1;
    this.state.lives += bonus;
    this.state.cards = [];
    Sfx.play('oneup');
  }

  completeWorld() {
    const next = this.state.world + 1;
    if (next >= WORLDS.length) {
      this.setScene(new EndingScene(this));
      return;
    }
    this.state.world = next;
    this.state.worldsOpen = Math.max(this.state.worldsOpen, next + 1);
    this.state.node = startNode(WORLDS[next]).id;
    this.persist();
    this.toWorldMap();
  }

  /* ------------------------------ save states -------------------------- */

  /**
   * AIKA-AJOSSA ei ole tilatallennuksia.
   *
   * Pistetaulu merkitsee jo tähdellä kierroksen joka on ladattu tilasta, koska
   * takaisin kelattu kierros ei kuulu samaan sarakkeeseen puhtaan kanssa
   * (core/scores.js). Tämä tila tekee siitä periaatteesta säännön — ja
   * nimenomaan *tässä*, yhdessä kohdassa, eikä kopioimalla tähtilogiikkaa:
   * `usedSaveState` asetetaan yhä vain `quickLoad`in onnistuneessa haarassa,
   * johon ei aika-ajossa päästä, joten merkintä ei voi syntyä eikä sitä
   * tarvitse erikseen estää.
   *
   * Myös tallentaminen kieltäytyy, vaikka pelkkä kelaus on se joka rikkoo ajon.
   * Tilannekuva jota peli lupaa ottaa mutta ei suostu palauttamaan on lupaus
   * jota se ei pidä, ja kaksi eri vastausta samalle näppäinparille on
   * hankalampi muistaa kuin yksi.
   */
  timeAttackRefusesStates() {
    if (!this.timeAttack) return false;
    this.toast(NO_SAVESTATES);
    Sfx.play('bump');
    return true;
  }

  quickSave() {
    if (this.timeAttackRefusesStates()) return;
    const snap = writeSlot(this, this.slot);
    if (!snap) {
      this.toast('TILAA EI VOI TALLENTAA TÄSSÄ');
      Sfx.play('bump');
      return;
    }
    this.toast(`TILA ${this.slot} TALLENNETTU  ${snap.label}`);
    Sfx.play('select');
  }

  quickLoad() {
    if (this.timeAttackRefusesStates()) return;
    const snap = readSlot(this.slot);
    if (!snap) {
      this.toast(`TILA ${this.slot} ON TYHJÄ`);
      Sfx.play('bump');
      return;
    }
    this.paused = false;
    if (restoreState(this, snap)) {
      // The run is now a rewound one. The board marks these with a star.
      this.state.usedSaveState = true;
      this.persist();
      this.toast(`TILA ${this.slot} LADATTU`);
      Sfx.play('powerup');
    } else {
      this.toast('TILAN LATAUS EPÄONNISTUI');
      Sfx.play('bump');
    }
  }

  /* -------------------------------- debug ------------------------------ */

  /**
   * Jumps to the next world, for testing. Only with the developer overlay up,
   * because it is a testing tool and an invisible one would be a cheat code
   * somebody found by accident.
   *
   * The run is marked, and a marked run **cannot reach the high score table at
   * all**. The save-state star says "this was rewound"; there is no honest star
   * for "this player skipped four worlds", so the answer is not a mark on the
   * board but no board.
   */
  debugWarp() {
    if (!this.debug) {
      this.toast('WARP VAATII DEBUG-RUUDUN (9)');
      return;
    }
    /*
     * SAMA NÄPPÄIN TARKOITTAA "OHITA", JA KONTEKSTI PÄÄTTÄÄ MITÄ.
     *
     * Kentässä se ohittaa kentän, kartalla maailman. Numerorivi on täynnä
     * (1–0 ovat kaikki varattuja), ja uusi näppäin olisi joka tapauksessa
     * väärä ratkaisu: kaksi näppäintä joista toinen ohittaa kentän ja toinen
     * maailman on kaksi asiaa muistettavaksi siellä missä yksi riittää.
     *
     * **Kentän ohittaminen on se jota testaaminen oikeasti tarvitsee.** Maailman
     * warppi vie maailman alkusolmuun, ja siitä eteenpäin `isLinkOpen` vaatii
     * että jompikumpi pää on selvitetty — eli päästäkseen kenttään 4-3 piti
     * pelata 4-1 ja 4-2 läpi. Juuri se on mahdotonta silloin kun ohitettava
     * kenttä on se joka on rikki.
     *
     * Ohitus kulkee `finishLevel`in läpi eikä oikoteitä sen ohi: kenttä
     * merkitään selvitetyksi, pelinappula kävelee, seuraava polku aukeaa ja
     * kortti jää saamatta samalla koodilla jolla maali sen antaisi. Oikotie
     * olisi toinen tapa läpäistä kenttä, ja kaksi tapaa eroaa aina lopulta.
     */
    /*
     * `pendingNode` on ehto eikä varmistus. Kenttä voi olla ruudulla ilman
     * karttasolmua kahdessa tapauksessa — päivän yritys ja suoraan rakennettu
     * `LevelScene` (jollaisia portti tekee kymmeniä) — eikä kummallakaan ole
     * kenttää jonka voisi merkitä selvitetyksi. Silloin tämä näppäin tarkoittaa
     * yhä sitä mitä se ennenkin tarkoitti, eli maailmaa.
     *
     * Tämä ehto **löytyi punaisesta**: ilman sitä kaksi vanhaa väitettä kaatui,
     * koska ne rakentavat kentän suoraan ja odottivat maailmawarppia.
     */
    if (this.scene instanceof LevelScene && !this.dailyRun && this.pendingNode) {
      const id = this.scene.id;
      this.state.debugWarped = true;
      this.persist();
      this.toast(`OHITETTU: ${id} (PISTETAULU POIS)`);
      Sfx.play('powerup');
      this.finishLevel({ cleared: true, card: null });
      return;
    }
    const next = (this.state.world + 1) % WORLDS.length;
    this.state.world = next;
    this.state.worldsOpen = Math.max(this.state.worldsOpen, next + 1);
    this.state.node = startNode(WORLDS[next]).id;
    this.state.debugWarped = true;
    this.persist();
    this.toast(`WARP: MAAILMA ${next + 1} (PISTETAULU POIS)`);
    Sfx.play('powerup');
    this.toWorldMap();
  }

  /**
   * What is hidden in the level being played, counted rather than located.
   * The point is to make the new mechanics findable while testing without
   * turning the debug overlay into a map of every answer.
   */
  levelSecrets(scene) {
    if (!scene || !scene.grid) return null;
    const count = { vine: 0, warp: 0, star: 0, aswitch: 0, crumble: 0, brick: 0 };
    for (let ty = 0; ty < scene.h; ty++) {
      for (let tx = 0; tx < scene.w; tx++) {
        const ch = scene.rawTileAt ? scene.rawTileAt(tx, ty) : scene.grid[ty][tx];
        if (ch === 'v') count.vine++;
        else if (ch === '(') count.warp++;
        else if (ch === '*') count.star++;
        else if (ch === 'S') count.aswitch++;
        else if (ch === '%') count.crumble++;
        else if (ch === 'B' && scene.brickSecret && scene.brickSecret(tx, ty)) count.brick++;
      }
    }
    /* A vine is many tiles and one secret; the same for a crumbling catwalk.
     *
     * And a beanstalk that has not been grown yet is not missing, it is waiting
     * in `beanstalks` (see `LevelScene.plantVines`) — the whole level is one
     * block away from having it. Counting only the tiles in the grid would make
     * this overlay say a level has no vine right up until the moment the player
     * finds the thing the overlay exists to help them find. */
    count.vine = (count.vine || (scene.beanstalks ? scene.beanstalks.size : 0)) ? 1 : 0;
    count.bands = scene.def && scene.def.bands ? 1 : 0;
    return count;
  }

  /* ------------------------------ telemetry ---------------------------- */

  /** Hands the local playtest log over as a file. Nothing is sent anywhere. */
  exportTelemetry() {
    const n = eventCount();
    if (!n) {
      this.toast('EI VIELÄ PELIDATAA');
      Sfx.play('bump');
      return;
    }
    downloadExport();
    this.toast(`PELIDATA VIETY  ${n} TAPAHTUMAA`);
    Sfx.play('select');
  }

  /* ------------------------------ ääniloukku --------------------------- */

  /**
   * Mitä selain sanoo ääniluvasta. Yhdessä paikassa siksi että se on ainoa
   * asia tässä tiedostossa jota testi ei voi asettaa itse — se on selaimen oma
   * tila — ja tämän kautta se voi.
   */
  audioState() {
    return audioDiag().state;
  }

  /**
   * Yritetään avata ääni. Turvallinen kutsua niin usein kuin haluaa: ilman
   * käyttäjän elettä se ei onnistu, ja eleen kanssa se onnistuu heti.
   */
  unlockAudio() {
    if (this.audioState() === 'running') return true;
    Sfx.resume();
    if (!isMuted() && Music.current) {
      const track = Music.current;
      Music.current = null;
      Music.play(track);
    }
    return this.audioState() === 'running';
  }

  /** Onko ääniloukun vihje juuri nyt ruudulla. */
  get audioHintVisible() {
    return this.flashTimer > 0 && this.flashIsHint;
  }

  /**
   * Ääniloukku: peliohjaimella pelaava ei saa ääniä ollenkaan, eikä sille voi
   * mitään.
   *
   * Selain avaa AudioContextin vain käyttäjän eleestä, ja **ohjaimen napin
   * painallus ei ole ele** — ei ole, vaikka `Input.anyKeyPressed` on sen
   * jälkeen tosi. `unlockAudio()` kutsutaan silti joka framella, koska se on
   * juuri se joka onnistuu sillä sekunnilla kun oikea ele tulee. Mutta pelkkä
   * yrittäminen ei riitä: pelaaja joka nostaa ohjaimen käteensä eikä koske
   * näppäimistöön pelaisi koko istunnon hiljaisuudessa tietämättä miksi.
   *
   * Siksi asia sanotaan ääneen. Ehto on **syy eikä kello**: vihje näkyy vain
   * kun ohjaimelta oikeasti tulee syötettä ja ääni on silti kiinni. Näppäimistö-
   * tai kosketuspelaaja avaa äänen ensimmäisellä painalluksellaan, joten hän ei
   * näe tätä koskaan — ei edes framen välähdyksenä, koska ehto ei katso hänen
   * syötettään vaan ohjaimen. Nolla väärää hälytystä on koko valinnan pointti.
   *
   * Etuoikeus: oikea ilmoitus voittaa. `TILA 1 LADATTU` on vastaus siihen mitä
   * pelaaja juuri teki, ja vastaus saa tulla ennen huomautusta jonka aihe ei ole
   * mihinkään menossa. Vihje odottaa rivin vapautumista ja palaa itse.
   *
   * Kuittaus: yksi painallus riittää, ohjaimenkin nappi. Näppäimellä kuittaava
   * avaa samalla äänen eikä kuittaus siksi tarkoita mitään; ohjaimella kuittaava
   * on valinnut hiljaisuuden, ja se on hänen valintansa. Kuittaus vaatii että
   * vihje oli ruudulla jo edellisellä framella — muuten sama painallus joka
   * ehdon täytti sulkisi sen ennen kuin kukaan ehtii lukea.
   */
  updateAudioHint() {
    const state = this.audioState();
    if (state === 'running') {
      // Ääni lähti: vihje katoaa samalla framella, ei sekuntia myöhemmin.
      if (this.flashIsHint) { this.flashTimer = 0; this.flashIsHint = false; }
      this.audioHintWasUp = false;
      return;
    }
    /* `none` tarkoittaa ettei AudioContextia ole ollenkaan — selaimessa ei ole
     * Web Audiota. Silloin mikään painallus ei auta eikä siitä sanota mitään. */
    const stuck = (state === 'suspended' || state === 'interrupted')
      && Input.padInput && !isMuted();
    if (!stuck) {
      this.audioHintWasUp = this.audioHintVisible;
      return;
    }
    if (this.audioHintWasUp && Input.anyKeyPressed) {
      this.audioHintOff = true;
      if (this.flashIsHint) { this.flashTimer = 0; this.flashIsHint = false; }
    }
    if (!this.audioHintOff && (this.flashTimer <= 0 || this.flashIsHint)) {
      // Uusitaan joka kerta kun se on umpeutumassa: ilmoitusrivi on tarkoituksella
      // ohimenevä, ja tämä asia ei mene ohi ennen kuin se korjataan.
      this.flash = AUDIO_HINT;
      this.flashTimer = 90;
      this.flashIsHint = true;
    }
    this.audioHintWasUp = this.audioHintVisible;
  }

  /* -------------------------------- loop ------------------------------- */

  step() {
    Input.poll();

    // Keep asking until the browser lets the audio through. One refused or
    // mistimed gesture used to mean silence for the rest of the session.
    const anyInput = Input.anyKeyPressed
      || Input.held.jump || Input.held.left || Input.held.right || Input.held.start;
    if (anyInput && this.audioState() !== 'running') this.unlockAudio();

    /* Attract mode hands the machine back the instant anyone touches it. This
     * sits ahead of every other key on purpose: the press that ends the demo
     * must not also quicksave, cycle the effects or, once the title is back,
     * pick a menu item nobody chose. Whoever pressed it gets a title screen and
     * decides from there. */
    if (this.scene instanceof DemoScene && (Input.anyKeyPressed || this.scene.aborted)) {
      this.endDemo();
      return;
    }

    if (Input.pressed.mute) this.toast(toggleMute() ? 'ÄÄNI POIS' : 'ÄÄNI PÄÄLLE', 60);
    if (Input.pressed.debug) this.debug = !this.debug;
    if (Input.pressed.slot) {
      this.slot = (this.slot % SLOT_COUNT) + 1;
      this.toast(`TALLENNUSPAIKKA ${this.slot}`);
      Sfx.play('cursor');
    }
    if (Input.pressed.quicksave) this.quickSave();
    if (Input.pressed.quickload) this.quickLoad();
    if (Input.pressed.reset) this.resetBestTimes();
    if (this.resetArmed > 0) this.resetArmed--;
    if (Input.pressed.export) this.exportTelemetry();
    if (Input.pressed.warp) this.debugWarp();
    if (Input.pressed.touch) {
      Touch.reveal();
      this.toast(`KOSKETUSOHJAUS: ${LAYOUT_NAMES[Touch.toggleLayout()]}`);
      Sfx.play('cursor');
    }
    if (Input.pressed.fx) {
      this.toast(`KUVAEFEKTIT: ${PRESET_NAMES[PostFX.cyclePreset()]}`);
      Sfx.play('cursor');
    }
    if (this.flashTimer > 0) this.flashTimer--;
    /* Vasta tässä, eli kaikkien oikeiden ilmoitusten jälkeen: tällä framella
     * annettu ilmoitus varaa rivin ja vihje odottaa vuoroaan. */
    this.updateAudioHint();

    /* Jakoruutu avataan juoksunapilla eikä numerolla, ja se on puhelimen takia:
     * numerorivi on siellä missä muutkin apunäppäimet, mutta puhelimessa ei ole
     * numeroriviä. X on molemmissa kosketusmalleissa ja molemmissa
     * käsijärjestyksissä, eikä alkuruutu tai pistetaulu lue sitä mihinkään —
     * kentässä juoksu on juoksu, ja siellä tätä ei ole. */
    if (this.canShareHere() && Input.pressed.run) {
      Input.consume('run');
      Sfx.play('select');
      this.toShare();
    }

    /*
     * ENTER KÄÄNNETÄÄN TÄSSÄ, ja tämä on se yksi paikka jossa se tehdään.
     *
     * `confirm` on se mitä näppäin sanoo; mitä se *tarkoittaa* riippuu siitä
     * mitä ruudulla on, ja kolme tapausta ovat kaikki sitä mitä pelaaja
     * odottaa:
     *
     *   - **taukovalikossa** se on valinta, koska valikko on valikko;
     *   - **kentässä** se on tauko, koska "valitse" ei tarkoita siellä mitään
     *     ja Enter on ollut tauko niin kauan kuin peli on ollut olemassa;
     *   - **muualla** se on valinta, eli sama kuin hyppynappi valikoissa.
     *
     * Käännös on `Input.pressed`issa eikä jokaisessa kohtauksessa, koska
     * kohtauksia on yhdeksän ja käännöksiä olisi silloin yhdeksän. Yksi paikka
     * on myös se ainoa jossa "mitä ruudulla on" tiedetään.
     */
    const pausable = this.scene instanceof LevelScene;
    if (Input.pressed.confirm) {
      Input.consume('confirm');
      if (pausable && !this.paused) Input.pressed.start = true;
      else Input.pressed.jump = true;
    }

    if (pausable && Input.pressed.start) {
      Input.consume('start');
      this.paused = !this.paused;
      /* Kursori alkaa aina JATKAsta. Muistettu LATAA tekisi START+hypystä
       * vahvistamattoman ja tuhoavan pikalatauksen. */
      this.pauseIndex = 0;
      this.pauseSlotFilled = this.paused ? !!readSlot(this.slot) : false;
      Sfx.play('cursor');
    }
    /* Kello käy taukovalikossa, ja tämä rivi on koko toteutus: kohtaus ei
     * päivity, mutta ajokello saa yhden framen. Kenttäkello ei — ks.
     * `LevelScene.tickPaused`. */
    if (this.paused && this.timeAttack && this.scene instanceof LevelScene) {
      this.scene.tickPaused();
    }
    if (this.paused && pausable) this.updatePauseMenu();
    if (!this.paused && this.scene) this.scene.update(Input);
    /* Päivän yrityksen eteneminen talteen kentän aikana, ei vasta lopussa. */
    if (!this.paused) this.noteDailyProgress();
  }

  /**
   * TAUKOVALIKKO, JA MIKSI SE ON VALIKKO EIKÄ NÄPPÄINLISTA.
   *
   * Tässä luki rivi `1 TALLENNA  2 LATAA  3 PAIKKA n`, ja se on ohje eikä
   * käyttöliittymä: se toimii vain näppäimistöllä. `input.js` pitää
   * apunäppäimet **tarkoituksella** poissa ohjaimelta ("a pad plays the game;
   * a keyboard also administers it"), eikä kosketusohjaimessa ole niille
   * paikkaa lainkaan. Peli siis tarjosi turvaverkon vain yhdelle kolmesta
   * ohjaustavasta, ja juuri se on todellinen ero eikä kenttien pituus.
   *
   * Valikko on lisäys eikä korvaus: kaikki vanhat näppäimet toimivat yhä.
   *
   * Aika-ajossa tallennus ja lataus eivät ole listalla, ja se on sama päätös
   * kuin ennenkin — kello käy tauon yli, joten tilan lataaminen tekisi ajasta
   * väitteen jota kukaan ei ole juossut.
   */
  pauseItems() {
    const items = [{ id: 'resume', label: 'JATKA' }];
    if (!this.timeAttack) {
      items.push({ id: 'save', label: 'TALLENNA' });
      /* Luettu kerran taukoa avattaessa eikä joka framella: `readSlot`
       * jäsentää koko tilannekuvan, ja `render` kutsuu tätä 60 kertaa
       * sekunnissa yhden sulkulausekkeen takia. */
      items.push({ id: 'load', label: `LATAA${this.pauseSlotFilled ? '' : ' (TYHJÄ)'}` });
      items.push({ id: 'slot', label: `PAIKKA ${this.slot}` });
    }
    return items;
  }

  /** Ylös/alas valitsee, hyppy vahvistaa — kolme ohjaustapaa, samat napit. */
  updatePauseMenu() {
    const items = this.pauseItems();
    this.pauseIndex = Math.min(this.pauseIndex, items.length - 1);
    if (Input.pressed.up) {
      this.pauseIndex = (this.pauseIndex + items.length - 1) % items.length;
      Sfx.play('cursor');
    }
    if (Input.pressed.down) {
      this.pauseIndex = (this.pauseIndex + 1) % items.length;
      Sfx.play('cursor');
    }
    if (!Input.pressed.jump) return;
    Input.consume('jump');
    const pick = items[this.pauseIndex].id;
    if (pick === 'resume') { this.paused = false; Sfx.play('cursor'); return; }
    if (pick === 'save') {
      this.quickSave();
      /* Paikka jonka juuri kirjoitti ei ole enää tyhjä. Ilman tätä valikko
       * väitti (TYHJÄ) siitä mitä se itse oli tallentanut. */
      this.pauseSlotFilled = !!readSlot(this.slot);
      return;
    }
    if (pick === 'load') { this.quickLoad(); return; }
    if (pick === 'slot') {
      this.slot = (this.slot % SLOT_COUNT) + 1;
      this.toast(`TALLENNUSPAIKKA ${this.slot}`);
      this.pauseSlotFilled = !!readSlot(this.slot);
      Sfx.play('cursor');
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (this.scene) this.scene.draw(ctx);

    if (this.paused) {
      const items = this.pauseItems();
      const boxH = 34 + items.length * 11;
      ctx.fillStyle = 'rgba(8,8,16,0.7)';
      ctx.fillRect(0, 90, W, boxH);
      /* Aika-ajossa otsikko sanoo sen mikä valikossa yllättää: kello käy.
       * Sääntö jota ei kerroteta siinä paikassa jossa se puree on ansa, ja
       * tämä on se paikka. Näppäinrivi vaihtuu samasta syystä — 1 ja 2 eivät
       * tee siellä mitään, ja 5 tekee. */
      /* Vaikeustaso otsikossa, ja tämä on se ruutu jossa se kuuluu lukea:
       * kartan yläpalkissa on tasan yksi paikka ja AIKA-AJO voittaa sen
       * (ks. `WorldMapScene.drawTitleBar`), joten tauko on ainoa paikka jossa
       * molemmat mahtuvat. HELPPO ei lisää mitään — `difficultyLabel` on tyhjä
       * silloin — eli tavallinen tauko lukee `TAUKO` kuten ennenkin.
       *
       * Pisin mahdollinen rivi on `TAUKO - KELLO KÄY  NORMAALI`, 27 merkkiä
       * = 162 px, keskitettynä 320:een eli 79…241. Laatikko on koko ruudun
       * levyinen, joten rivi mahtuu siihen kokonaan. */
      const tier = difficultyLabel(this.mode);
      const title = `${this.timeAttack ? PAUSE_TITLE : 'TAUKO'}${tier ? `  ${tier}` : ''}`;
      drawText(ctx, title, W / 2, 104,
        { color: '#ffffff', align: 'center', shadow: '#303048' });
      items.forEach((it, i) => {
        const on = i === this.pauseIndex;
        drawText(ctx, `${on ? '*' : ' '} ${it.label}`, W / 2, 115 + i * 11,
          { color: on ? '#ffd048' : '#8890b0', align: 'center' });
      });
      /* Näppäinrivi jää, koska näppäimistö on yhä nopein tapa: valikko on
       * lisäys niille joilla ei ole näppäimistöä, ei korvaaja niille joilla on. */
      drawText(ctx, this.timeAttack ? PAUSE_KEYS : `7 EFEKTIT  9 DEBUG`,
        W / 2, 115 + items.length * 11 + 3,
        { color: '#606880', align: 'center' });
    }
    if (this.flashTimer > 0) {
      drawText(ctx, this.flash, W / 2, 6, { color: '#ffd048', align: 'center', shadow: '#101018' });
    }

    // Effects go over the game but under the developer overlay: a CRT filter
    // on top of debug text would make the one thing you are reading unreadable.
    PostFX.apply(ctx);
    /* Ilmestyvät lukemat efektien jälkeen: kertojan kerros ei ole ikkuna
     * maailmaan (DESIGN.md 8), eikä kuumuus siis väreile pistelukeman läpi.
     * Ennen sen takasi 32 px korkea HUD-nauha jonka efektit jättivät rauhaan;
     * nauhaa ei enää ole, joten sen takaa piirtojärjestys. */
    if (this.scene && this.scene.drawOverlay) this.scene.drawOverlay(ctx);
    if (this.debug) this.drawDebug(ctx);
    PostFX.present();
  }

  /** Developer overlay: frame budget, scene contents, player and audio state. */
  drawDebug(ctx) {
    const scene = this.scene;
    const p = scene && scene.player;
    const n = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);

    const lines = [
      // Which build is on screen. Asked more than once, and guessing from
      // which features are visible is a poor way to answer it.
      `KV v${GAME_VERSION}`,
      `FPS ${this.fps}  FRAME ${n(this.frameMs)}MS  WORK ${n(this.workMs)}MS  STEPS ${this.stepsThisFrame}`,
      `SCENE ${(scene ? scene.constructor.name : 'NONE').replace('SCENE', '')}`
        + `${scene && scene.id ? ` ${scene.id}` : ''}  TICK ${scene ? scene.tick || 0 : 0}`,
    ];
    if (scene && scene.entities) {
      const live = scene.entities.filter((e) => e.active).length;
      lines.push(`ENT ${live}/${scene.entities.length}  BUMPS ${scene.bumps ? scene.bumps.size : 0}`
        + `  SHAKE ${n(scene.shakeAmp || 0)}`);
    }
    if (p) {
      lines.push(`POS ${Math.round(p.x)},${Math.round(p.y)}  VEL ${n(p.vx, 2)},${n(p.vy, 2)}`);
      lines.push(`POWER ${(p.type || 'NONE').toUpperCase()} ${p.powerLevel}  P ${Math.round(p.pMeter)}`
        + `  GROUND ${p.onGround ? 1 : 0}  CORK ${Math.ceil((p.corked || 0) / 60)}`);
    }
    if (scene && scene.cam) {
      lines.push(`CAM ${Math.round(scene.cam.x)},${Math.round(scene.cam.y)}`
        + `  MAP ${scene.w || 0}X${scene.h || 0}`);
    }
    const a = audioDiag();
    lines.push(`MUS ${a.track.toUpperCase()} (${Music.variation().toUpperCase()})`
      + `${a.pace > 1 ? `  KIIHTYNYT ${a.pace}X` : ''}`
      + `  MUTE ${a.muted ? 1 : 0}`);
    lines.push(`AUDIO ${a.state.toUpperCase()}  GAIN ${a.master}`
      + `  OHJAIMET ${Input.pads}${Input.padInput ? '*' : ''}`
      + `${this.audioHintOff ? '  VIHJE KUITATTU' : ''}`);
    const fx = PostFX.diag();
    const t = Touch.diag();
    lines.push(`FX ${fx.mode.toUpperCase()} ${fx.preset.toUpperCase()}`
      + `  TUNNELMA ${(fx.ambience || 'EI').toUpperCase()}  (7 VAIHDA)`);
    lines.push(`KOSKETUS ${t.visible ? t.layout.toUpperCase() : 'PIILOSSA'}`
      + `  SORMET ${t.pointers}  (6 VAIHDA)`);
    lines.push(`LIVES ${this.state.lives}  COINS ${this.state.coins}  SCORE ${this.state.score}`);
    if (scene && scene.grid) {
      const c = this.levelSecrets(scene);
      lines.push(`SALAT VARSI ${c.vine}  PUTKI ${c.warp}  TAHTI ${c.star}`
        + `  KYTKIN ${c.aswitch}  LAVA ${c.crumble}  TIILI ${c.brick}  KAISTAT ${c.bands}`);
    }
    if (this.state.debugWarped) lines.push('WARPATTU - EI PISTETAULUA');
    if (scene && scene.id && scene.cam) {
      // Cached: this scans the whole telemetry log, and the overlay is the one
      // thing on screen that must never be the reason the frame is slow.
      if (!this._teleCache || this._teleCache.id !== scene.id
        || this._teleAt === undefined || this.fps === 0
        || (scene.tick - this._teleAt) > 30) {
        this._teleCache = { id: scene.id, data: levelSummary(scene.id), n: eventCount() };
        this._teleAt = scene.tick;
      }
      const t = this._teleCache.data;
      lines.push(`TELE ${t.total} KUOLEMAA  ${t.stuckTotal} JUMIA  ${t.clears} LAPI`
        + `  (8 VIE ${this._teleCache.n})`);
    }

    const width = Math.max(...lines.map((l) => l.length)) * 6 + 8;
    ctx.fillStyle = 'rgba(8,8,16,0.72)';
    ctx.fillRect(2, 2, Math.min(W - 4, width), lines.length * 9 + 6);
    lines.forEach((line, i) => {
      drawText(ctx, line, 6, 6 + i * 9, { color: i === 0 ? '#8fe04a' : '#d0d0e8' });
    });
  }

  frame(now) {
    if (!this.lastTime) this.lastTime = now;
    let delta = now - this.lastTime;
    this.lastTime = now;
    this.frameMs = delta;
    if (delta > 250) delta = STEP;      // tab was in the background
    this.accumulator += delta;

    const started = performance.now();
    let steps = 0;
    while (this.accumulator >= STEP && steps < 5) {
      this.accumulator -= STEP;
      steps++;
      this.step();
    }
    this.render();
    this.stepsThisFrame = steps;
    this.workMs = performance.now() - started;

    this._fpsFrames++;
    if (now - this._fpsSince >= 500) {
      this.fps = Math.round((this._fpsFrames * 1000) / (now - this._fpsSince));
      this._fpsFrames = 0;
      this._fpsSince = now;
    }
    requestAnimationFrame((t) => this.frame(t));
  }
}

/* --------------------------------- boot -------------------------------- */

const canvas = document.getElementById('game');
const game = new Game(canvas);

// The game always draws into `canvas`. What ends up on screen may be another
// one — see src/gfx/postfx.js. If WebGL is unavailable this returns `canvas`
// itself and nothing below changes.
const display = PostFX.init(canvas);

/*
 * Integer scaling is what keeps pixel art honest, but on a phone the honest
 * answer is a postage stamp: a 844x390 landscape screen fits exactly 1x, and
 * 1x on a modern display is unplayable. So integer scaling applies whenever
 * there is room for 2x or more, and below that the picture is stretched to fit.
 * The device pixel ratio does the smoothing work at those sizes anyway.
 */
function resize() {
  // The keyboard hint strip only exists while there is a keyboard in the story.
  const reserve = document.body.classList.contains('touching') ? 10 : 56;
  const fit = Math.min(window.innerWidth / W, (window.innerHeight - reserve) / H);
  const scale = fit >= 2 ? Math.floor(fit) : Math.max(1, fit);
  display.style.width = `${Math.round(W * scale)}px`;
  display.style.height = `${Math.round(H * scale)}px`;
  PostFX.resize(scale);
}

window.addEventListener('resize', resize);
resize();

Input.install();
// `?touch=1` forces the overlay up on a desktop, which is the only way to work
// on it without holding a phone.
Touch.install(Input, { force: new URLSearchParams(location.search).has('touch') });
/* Ääni avataan tapahtumasta eikä pollatusta tilasta, koska juuri tapahtuma
 * kantaa käyttäjän eleen: `keydown` ja `pointerdown` ajetaan selaimen mielestä
 * eleen sisällä, `requestAnimationFrame` ei. Askeleen oma yritys jää silti
 * paikalleen — se on se joka hoitaa tapaukset joissa konteksti syntyi liian
 * myöhään ensimmäiseen eleeseen nähden. */
Input.onGesture = () => game.unlockAudio();
Input.onFirstInput = () => {
  Sfx.resume();
  if (!isMuted()) Music.play(Music.current || 'map');
};

/* Haastelinkin parametrit luetaan kerran ja pyyhitään osoiteriviltä. Tämä on
 * `Touch.install`in jälkeen mutta ennen ensimmäistä kohtausta: `?touch=1`
 * ehtii lukea omansa (ja jää osoiteriville, koska se ei ole meidän), ja
 * alkuruutu näkee haasteen jo ensimmäisellä framella. */
game.challenge = takeChallenge();

game.toTitle();
requestAnimationFrame((t) => game.frame(t));

// Handy while tuning: `window.sfb3.state` in the console.
window.sfb3 = game;
// …and `window.sfb3.telemetry.summary('1-1')` to see where a level is killing
// people without having to squint at the heatmap.
game.telemetry = { summary: levelSummary, count: eventCount, clear: clearTelemetry };
game.fx = PostFX;
game.touch = Touch;
