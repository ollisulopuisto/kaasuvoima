import { drawText } from '../gfx/font.js';
import { drawItem } from '../gfx/sprites.js';
import { drawCoinSprite } from '../gfx/tiles.js';
import { Music, Sfx } from '../core/audio.js';

/**
 * THE HOUSE, AND THE FOUR THINGS THAT HAPPEN IN ONE.
 *
 * Lifted out of `WorldMapScene` on 19.8.2026, unchanged, because the globe
 * needs the same rooms and a second copy of a gambling game is a second set of
 * odds. The flat map now asks this module the same questions the globe does,
 * which is the point: whichever overworld you are looking at, a bet costs what
 * a bet costs.
 *
 * It knows nothing about maps. Give it the node whose house it is and a way to
 * say it is finished, and it draws itself over whatever is behind it — every
 * coordinate in here is screen space and always was.
 */

/** Mitä hernetalo tarjoaa, ja missä järjestyksessä. */
const HOUSE_ITEMS = ['shroom', 'flower', 'leaf', 'soup'];

/** Talon lajit. Tuntematon laji on hernetalo, ks. `enterNode`. */
export const HOUSE_GAMES = ['items', 'coinflip', 'cups', 'bet'];

/** Panokset, pienimmästä alkaen. Isompaa ei tarjota kuin on varaa. */
const STAKES = [5, 15, 30];

const CUP_SHUFFLE = 96;
const CUP_SWAP = 16;

export class House {
  /**
   * @param game   the running game, for coins, the save and `persist`
   * @param node   the house node; its `game` field picks which of the four
   * @param onClose called once, with a message to show or an empty string
   */
  /*
   * THE HOUSE HAS ITS OWN TUNE NOW (20.8.2026), and it is a waltz.
   *
   * Until this pass the four rooms had no music at all: you walked in off the
   * overworld and the overworld's tune kept playing, which is the one thing
   * that makes a room not feel like a room. Every other place in this game
   * announces itself by sound (DESIGN.md kohta 8 — music is the narrator, and
   * the narrator was saying nothing here).
   *
   * A slow waltz rather than something jolly, because three of these four rooms
   * are gambling and the fourth is a raffle. `valssi` is a valse triste with the
   * bass a beat late; it is unhurried and it is not on your side, which is the
   * correct temperature for a room that takes stakes.
   *
   * WHAT PLAYS AFTERWARDS IS REMEMBERED, NOT NAMED. The room does not know it
   * was entered from an overworld — that is the whole point of `house.js`, one
   * copy for two maps — so it restores whatever was playing when it opened
   * instead of asserting `map`. `Music.play` is a no-op when the name has not
   * changed, so a muted game (where `current` is whatever would resume) is
   * unaffected.
   */
  constructor(game, node, onClose) {
    this.game = game;
    this.node = node;
    this.onClose = onClose;
    this.resumeTrack = Music.current;
    Music.play('valssi');
    this.done = false;
    this.tick = 0;
    this.houseGame = HOUSE_GAMES.includes(node.game) ? node.game : 'items';
    this.houseCursor = 0;
    this.housePhase = 'pick';
    this.houseTimer = 0;
    this.houseResult = null;
    this.houseStake = 0;
    this.cups = null;
    this.cupPrize = 0;
    this.cupSwap = null;
  }

  update(input) {
    this.tick++;
    if (this.done) return;
    this.updateHouse(input);
  }

  draw(ctx) {
    this.drawHouse(ctx);
  }

  updateCoinflip(input) {
    if (this.housePhase === 'spin') {
      if (--this.houseTimer > 0) return;
      const won = this.houseResult;
      if (won) {
        this.game.state.coins += this.houseStake * 2;
        Sfx.play('payout');
      } else {
        Sfx.play('bump');
      }
      this.closeHouse(won ? `VOITIT ${this.houseStake * 2} KOLIKKOA` : 'MENI SIVU SUUN');
      return;
    }
    const stakes = this.stakesHere();
    if (!stakes.length) {
      Sfx.play('bump');
      this.closeHouse('EI KOLIKOITA PANOKSEKSI');
      return;
    }
    const n = stakes.length;
    if (input.pressed.left) {
      this.houseCursor = (this.houseCursor + n - 1) % n;
      Sfx.play('cursor');
    }
    if (input.pressed.right) {
      this.houseCursor = (this.houseCursor + 1) % n;
      Sfx.play('cursor');
    }
    if (input.pressed.jump || input.pressed.start) {
      input.consume('jump');
      input.consume('start');
      this.houseStake = stakes[this.houseCursor % n];
      this.game.state.coins -= this.houseStake;
      this.houseResult = Math.random() < 0.5;
      this.housePhase = 'spin';
      this.houseTimer = 40;
      Sfx.play('coin');
    }
  }

  /*
   * KOLME KUPPIA. Yhden alla on elämä, kupit sekoitetaan.
   *
   * Sekoitus on **näkyvä** (`CUP_SHUFFLE` framea, vaihto `CUP_SWAP` välein), ja
   * se on tämän pelin ainoa taito-osuus: katse riittää siihen jos jaksaa
   * seurata, eikä riitä jos ei. Panosta ei ole — hinta on käynti, ja jokainen
   * talo on kerran.
   *
   * Kupit ovat taulukko `[0,1,2]` jossa alkio on kupin *alla* oleva paikka;
   * vaihto vaihtaa kaksi vierekkäistä. Voitto on elämä, koska se on ainoa
   * palkinto joka ei mahdu varalokeroon eikä muutu turhaksi.
   */
  updateCups(input) {
    if (!this.cups) {
      this.cups = [0, 1, 2];
      this.cupPrize = Math.floor(Math.random() * 3);
      this.housePhase = 'shuffle';
      this.houseTimer = CUP_SHUFFLE;
      this.cupSwap = null;
    }
    if (this.housePhase === 'shuffle') {
      this.houseTimer--;
      if (this.houseTimer % CUP_SWAP === 0 && this.houseTimer > 0) {
        const i = Math.random() < 0.5 ? 0 : 1;
        const tmp = this.cups[i];
        this.cups[i] = this.cups[i + 1];
        this.cups[i + 1] = tmp;
        if (this.cupPrize === i) this.cupPrize = i + 1;
        else if (this.cupPrize === i + 1) this.cupPrize = i;
        this.cupSwap = i;
        Sfx.play('cursor');
      }
      if (this.houseTimer <= 0) this.housePhase = 'pick';
      return;
    }
    if (this.housePhase === 'show') {
      if (--this.houseTimer > 0) return;
      const won = this.houseCursor === this.cupPrize;
      if (won) {
        this.game.state.lives++;
        Sfx.play('oneup');
      } else {
        Sfx.play('bump');
      }
      this.closeHouse(won ? 'ELAMA LOYTYI' : 'VAARA KUPPI');
      return;
    }
    if (input.pressed.left) {
      this.houseCursor = (this.houseCursor + 2) % 3;
      Sfx.play('cursor');
    }
    if (input.pressed.right) {
      this.houseCursor = (this.houseCursor + 1) % 3;
      Sfx.play('cursor');
    }
    if (input.pressed.jump || input.pressed.start) {
      input.consume('jump');
      input.consume('start');
      this.housePhase = 'show';
      this.houseTimer = 50;
    }
  }

  /*
   * VETOTALO. Panos siitä että läpäiset seuraavan kentän kuolematta.
   *
   * Veto elää `game.state`issa eikä tässä kohtauksessa, ja se on ainoa oikea
   * paikka: kohtaus katoaa kun kenttä alkaa, ja veto on olemassa juuri sen
   * ajan. `finishLevel` maksaa sen — voitto tuplana, häviö vie panoksen — ja
   * koska tallennus kantaa `state`n, veto selviää myös sulkemisesta kesken
   * kaiken.
   *
   * Tämä on ainoa talo jossa taito on mukana, ja siksi se maksaa eniten. Se on
   * myös ainoa jossa palkinto tulee vasta myöhemmin, eli se muuttaa *seuraavan
   * kentän merkitystä* — sen jälkeen kun veto on lyöty, tavallinen kenttä on
   * eri kenttä.
   */
  updateBet(input) {
    const stakes = this.stakesHere();
    if (!stakes.length) {
      Sfx.play('bump');
      this.closeHouse('EI KOLIKOITA PANOKSEKSI');
      return;
    }
    const n = stakes.length;
    if (input.pressed.left) {
      this.houseCursor = (this.houseCursor + n - 1) % n;
      Sfx.play('cursor');
    }
    if (input.pressed.right) {
      this.houseCursor = (this.houseCursor + 1) % n;
      Sfx.play('cursor');
    }
    if (input.pressed.jump || input.pressed.start) {
      input.consume('jump');
      input.consume('start');
      const stake = stakes[this.houseCursor % n];
      this.game.state.coins -= stake;
      this.game.state.bet = stake;
      Sfx.play('select');
      this.closeHouse(`VETO ${stake}: SELVITA KENTTA KUOLEMATTA`);
    }
  }

  /* -------------------------------- camera ----------------------------- */

  /**
   * How wide the map is in pixels — the grid, plus whatever the drawing hangs
   * over its right edge.
   *
   * Read from the data rather than from a constant, because the constant is the
   * thing this change exists to stop believing. `MAP_W` in `worlds.js` says 20
   * and every shipped grid is still 20, but the next one need not be, and a
   * width that is a number somewhere else is a width that goes stale silently.
   * Link waypoints count too: a road may be routed through a column no node
   * stands in, and a road drawn off the end of the map is the same bug as a
   * node drawn off it.
   */
  static mapWidthPx(world) {
    let right = 0;
    for (const row of world.terrain || []) right = Math.max(right, row.length * TILE);
    for (const n of world.nodes) right = Math.max(right, n.tx * TILE + TILE + STAMP_BLEED);
    for (const l of world.links) {
      for (const [tx] of l.path || []) right = Math.max(right, tx * TILE + TILE);
    }
    return right;
  }

  updateHouse(input) {
    if (this.houseGame === 'coinflip') return this.updateCoinflip(input);
    if (this.houseGame === 'cups') return this.updateCups(input);
    if (this.houseGame === 'bet') return this.updateBet(input);
    return this.updateItems(input);
  }

  /** Kuinka monta kolikkoa panokseksi kelpaa juuri nyt. */
  stakesHere() {
    const coins = this.game.state.coins;
    return STAKES.filter((v) => v <= coins);
  }

  /** Talo on käyty: solmu merkitään ja tallennus kirjoitetaan. */
  closeHouse(message) {
    this.game.state.cleared[this.node.id] = true;
    this.game.persist();
    this.done = true;
    if (this.resumeTrack) Music.play(this.resumeTrack);
    this.onClose(message || '');
  }

  /*
   * HERNETALO. Kolme tuttua ja yksi arpa, ks. `HOUSE_GAMES`.
   */
  updateItems(input) {
    const n = HOUSE_ITEMS.length;
    if (input.pressed.left) {
      this.houseCursor = (this.houseCursor + n - 1) % n;
      Sfx.play('cursor');
    }
    if (input.pressed.right) {
      this.houseCursor = (this.houseCursor + 1) % n;
      Sfx.play('cursor');
    }
    if (input.pressed.jump || input.pressed.start) {
      input.consume('jump');
      input.consume('start');
      /*
       * NELJÄS LUUKKU ON ARPA (17.8.2026). Kolme ensimmäistä ovat se mitä ne
       * ovat lukeneet aina; neljäs arvotaan vasta valittaessa, ja sen jakauma
       * on tarkoituksella epäreilu kumpaankin suuntaan: kolmasosa tähti (paras
       * mitä talo voi antaa), kolmasosa hernekeitto (parempi kuin mikään
       * varmoista) ja kolmasosa tyhjä.
       *
       * Odotusarvo on siis noin varman veroinen, ja se on koko idea: arpa ei
       * ole ansa eikä ilmaislounas vaan **valinta jonka pelaaja saa tehdä
       * itse**. Varma vaihtoehto ei kadonnut mihinkään.
       */
      const picked = HOUSE_ITEMS[this.houseCursor];
      let got = picked;
      if (this.houseCursor === HOUSE_ITEMS.length - 1) {
        const roll = Math.random();
        got = roll < 0.34 ? 'star' : roll < 0.67 ? 'soup' : null;
      }
      if (got) this.game.state.reserve = got;
      /* Through `closeHouse` rather than repeating its body, which is what this
       * used to do: the room now also has music to put back (see the
       * constructor), and a second exit that forgets to would leave the waltz
       * playing over the world map. The message is the only thing that differed
       * between the two paths. */
      this.closeHouse(got ? 'SAIT ESINEEN VARASTOON' : 'ARPA OLI TYHJA');
      /*
       * `reserve` eikä `powerup`, ja se on aamun korjaus loppuun asti.
       *
       * Talosta saatu esine menee lokeroon: voimataso ei liiku, keho ei kasva,
       * eikä ruudulla tapahdu mitään muuta kuin että HUDin lokero täyttyy.
       * `powerup` sanoi tässä "kasvoit" — sama valhe jonka `level.js` lakkasi
       * kertomasta aamulla — ja merkki joka valehtelee opitaan uskomaan
       * (DESIGN.md kohta 8: yksi tilanvaihdos, yksi merkki).
       *
       * Kartta ja kenttä soittavat nyt samasta tapahtumasta saman äänen. Se on
       * väitteen toinen puolisko eikä koristelu: kaksi murretta samalle asialle
       * opettaisi pelaajan lukemaan lokeron täyttymistä kahtena eri asiana sen
       * mukaan missä hän sattuu seisomaan.
       */
      Sfx.play('reserve');
    }
  }

  houseFrame(ctx, title, line) {
    ctx.fillStyle = 'rgba(8,8,16,0.82)';
    ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = '#202038';
    ctx.fillRect(50, 66, 220, 96);
    ctx.fillStyle = '#50506e';
    ctx.fillRect(50, 66, 220, 1);
    ctx.fillRect(50, 161, 220, 1);
    drawText(ctx, title, 160, 76, { color: '#8fe04a', align: 'center' });
    drawText(ctx, line, 160, 88, { color: '#ffffff', align: 'center' });
    drawText(ctx, `KOLIKOT ${this.game.state.coins}`, 160, 152,
      { color: '#ffd048', align: 'center' });
  }

  /** Panosrivi: kolme lukua, valittu korostettuna. Ks. `STAKES`. */
  drawStakes(ctx, y) {
    const stakes = this.stakesHere();
    stakes.forEach((v, i) => {
      const x = 160 + (i - (stakes.length - 1) / 2) * 56;
      const on = i === this.houseCursor % Math.max(1, stakes.length);
      ctx.fillStyle = on ? '#f8f8f8' : '#3a3a52';
      ctx.fillRect(x - 22, y, 44, 20);
      ctx.fillStyle = '#101018';
      ctx.fillRect(x - 20, y + 2, 40, 16);
      drawText(ctx, `${v}`, x, y + 7, { color: on ? '#ffd048' : '#8890b0', align: 'center' });
    });
  }

  drawHouse(ctx) {
    if (this.houseGame === 'coinflip') return this.drawCoinflip(ctx);
    if (this.houseGame === 'cups') return this.drawCups(ctx);
    if (this.houseGame === 'bet') return this.drawBet(ctx);
    return this.drawItems(ctx);
  }

  drawCoinflip(ctx) {
    this.houseFrame(ctx, 'KRUUNA VAI PIERU', this.housePhase === 'spin'
      ? 'ILMASSA...' : 'PANOS?');
    if (this.housePhase === 'spin') {
      /* Kolikko nousee ja laskee: sinikäyrä, koko kaari yhdessä lennossa. */
      const t = 1 - this.houseTimer / 40;
      const y = 128 - Math.round(Math.sin(t * Math.PI) * 34);
      drawCoinSprite(ctx, 152, y, this.tick * 3);
      return;
    }
    this.drawStakes(ctx, 108);
    drawText(ctx, 'Z HEITA', 160, 136, { color: '#8890b0', align: 'center' });
  }

  drawCups(ctx) {
    const showing = this.housePhase === 'show';
    this.houseFrame(ctx, 'KOLME KUPPIA', this.housePhase === 'shuffle'
      ? 'KATSO TARKKAAN' : showing ? '...' : 'MISSA SE ON?');
    for (let i = 0; i < 3; i++) {
      const x = 160 + (i - 1) * 54;
      const lift = showing && (i === this.cupPrize || i === this.houseCursor) ? 10 : 0;
      const wobble = this.housePhase === 'shuffle' && this.cupSwap !== null
        && (i === this.cupSwap || i === this.cupSwap + 1)
        ? Math.round(Math.sin(this.tick / 2) * 3) : 0;
      if (showing && i === this.cupPrize) {
        ctx.fillStyle = '#ffd048';
        ctx.fillRect(x - 6, 128, 12, 6);
        drawText(ctx, '1UP', x, 118, { color: '#8fe04a', align: 'center' });
      }
      ctx.fillStyle = i === this.houseCursor && this.housePhase === 'pick'
        ? '#f8f8f8' : '#c86038';
      ctx.fillRect(x - 12 + wobble, 104 - lift, 24, 26);
      ctx.fillStyle = '#7a3820';
      ctx.fillRect(x - 12 + wobble, 126 - lift, 24, 4);
    }
    if (this.housePhase === 'pick') {
      drawText(ctx, 'Z NOSTA KUPPI', 160, 138, { color: '#8890b0', align: 'center' });
    }
  }

  drawBet(ctx) {
    this.houseFrame(ctx, 'VETOTALO', 'SELVITA KENTTA KUOLEMATTA');
    this.drawStakes(ctx, 108);
    drawText(ctx, 'VOITTO ON TUPLAT', 160, 136, { color: '#8890b0', align: 'center' });
  }

  drawItems(ctx) {
    this.houseFrame(ctx, 'HERNETALO', 'VALITSE YKSI');

    HOUSE_ITEMS.forEach((item, i) => {
      const x = 72 + i * 46;
      const selected = i === this.houseCursor;
      ctx.fillStyle = selected ? '#f8f8f8' : '#3a3a52';
      ctx.fillRect(x - 4, 104, 26, 26);
      ctx.fillStyle = '#101018';
      ctx.fillRect(x - 2, 106, 22, 22);
      /* Neljäs luukku on arpa: kysymysmerkki eikä esine, koska esine olisi
       * lupaus. Ks. `updateItems`. */
      if (i === HOUSE_ITEMS.length - 1) {
        drawText(ctx, '?', x + 8, 114, { color: '#ffd048', align: 'center' });
      } else {
        drawItem(ctx, item, x + 1, 108, this.tick);
      }
      if (selected && Math.floor(this.tick / 8) % 2) {
        drawText(ctx, '*', x + 8, 134, { color: '#ffd048', align: 'center' });
      }
    });
    drawText(ctx, 'Z VALITSE', 160, 140, { color: '#8890b0', align: 'center' });
  }
}
