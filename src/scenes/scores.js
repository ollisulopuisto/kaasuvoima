import { drawText } from '../gfx/font.js';
import { drawItem } from '../gfx/sprites.js';
import { Music, Sfx } from '../core/audio.js';
import { loadScores, addScore, NAME_LENGTH, GAME_VERSION } from '../core/scores.js';
import { padNum } from '../core/utils.js';

/** `YYYY-MM-DD` in local time, which is the day the player would call it. */
function isoDay(stamp) {
  const d = new Date(stamp);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Where each field of a score row starts, `score` and `continues` measured
 * from their right edge. The row is narrow and has had an overlap bug in it
 * before, so the whole budget lives here instead of as numbers spread through
 * draw(). Worst case is a six-letter name, a star, a four-character level id,
 * a ten-character date, "J99+" and a seven-digit score — 190 of the 260 pixels
 * between the margins. The tightest boundary is the star hard against the end
 * of a full-length name, at 3px; everything else has 5px or more.
 */
const COL = {
  rank: 30,
  name: 52,
  star: 52 + NAME_LENGTH * 6 + 2,
  level: 100,
  date: 128,
  continues: 232,
  score: 290,
};

/** Letters a name can be built from. The last two slots are edit commands. */
const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖ0123456789 '];

/**
 * Arcade initials entry: up and down change the letter, left and right move
 * along the name, X rubs one out and ENTER stores it.
 */
export class NameEntryScene {
  constructor(game, result, next) {
    this.game = game;
    this.result = result;               // { score, world, level, assisted, continues }
    this.next = next;
    this.tick = 0;
    this.letters = ['A', ' ', ' ', ' ', ' ', ' '];
    this.cursor = 0;
    this.repeat = 0;
  }

  enter() {
    Music.play('title');
  }

  get name() {
    return this.letters.join('').trimEnd() || 'SFB';
  }

  step(delta) {
    const current = this.letters[this.cursor];
    const index = Math.max(0, ALPHABET.indexOf(current));
    const next = (index + delta + ALPHABET.length) % ALPHABET.length;
    this.letters[this.cursor] = ALPHABET[next];
    Sfx.play('cursor');
  }

  update(input) {
    this.tick++;

    // Held up/down scrolls the alphabet, because typing a name one press at a
    // time with a d-pad gets old fast.
    const holdingV = (input.held.up ? -1 : 0) + (input.held.down ? 1 : 0);
    if (input.pressed.up) this.step(-1);
    else if (input.pressed.down) this.step(1);
    else if (holdingV !== 0 && ++this.repeat > 18 && this.repeat % 5 === 0) this.step(holdingV);
    if (holdingV === 0) this.repeat = 0;

    if (input.pressed.left) {
      this.cursor = (this.cursor + NAME_LENGTH - 1) % NAME_LENGTH;
      Sfx.play('cursor');
    }
    if (input.pressed.right) {
      this.cursor = (this.cursor + 1) % NAME_LENGTH;
      Sfx.play('cursor');
    }
    if (input.pressed.run) {
      this.letters[this.cursor] = ' ';
      if (this.cursor > 0) this.cursor--;
      Sfx.play('bump');
    }
    if (input.pressed.jump) {
      input.consume('jump');
      if (this.cursor < NAME_LENGTH - 1) {
        this.cursor++;
        Sfx.play('cursor');
      } else {
        this.submit();
      }
    }
    if (input.pressed.start) {
      input.consume('start');
      this.submit();
    }
  }

  submit() {
    Sfx.play('powerup');
    const index = addScore({ ...this.result, name: this.name });
    this.next(index);
  }

  draw(ctx) {
    ctx.fillStyle = '#101830';
    ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = '#1a2444';
    ctx.fillRect(0, 40, 320, 2);

    drawText(ctx, 'PÄÄSIT LISTALLE!', 160, 22, {
      color: '#ffd048', align: 'center', shadow: '#303048',
    });
    drawText(ctx, `PISTEET ${padNum(this.result.score, 7)}`, 160, 56, {
      color: '#8fe04a', align: 'center',
    });
    // What the row is about to say about this run, said before it is filed.
    let noteY = 70;
    if (this.result.assisted) {
      drawText(ctx, '* TILATALLENNUS KÄYTÖSSÄ', 160, noteY, { color: '#c88040', align: 'center' });
      noteY += 12;
    }
    if (this.result.continues > 0) {
      drawText(ctx, `J JATKOT ${this.result.continues}`, 160, noteY, {
        color: '#c88040', align: 'center',
      });
    }

    drawText(ctx, 'NIMI:', 160, 96, { color: '#ffffff', align: 'center' });

    const slotW = 24;
    const left = 160 - (NAME_LENGTH * slotW) / 2;
    for (let i = 0; i < NAME_LENGTH; i++) {
      const x = left + i * slotW;
      const active = i === this.cursor;
      ctx.fillStyle = active ? '#2c3c68' : '#1a2038';
      ctx.fillRect(x + 2, 112, slotW - 4, 26);
      ctx.fillStyle = active && Math.floor(this.tick / 8) % 2 ? '#ffd048' : '#40506a';
      ctx.fillRect(x + 2, 136, slotW - 4, 2);
      drawText(ctx, this.letters[i], x + slotW / 2, 118, {
        color: active ? '#ffffff' : '#c0c0d0', align: 'center', scale: 2,
      });
      if (active) {
        drawText(ctx, '+', x + slotW / 2, 104, { color: '#8890b0', align: 'center' });
        drawText(ctx, '-', x + slotW / 2, 142, { color: '#8890b0', align: 'center' });
      }
    }

    drawText(ctx, 'YLÖS/ALAS KIRJAIN   VASEN/OIKEA PAIKKA', 160, 176, {
      color: '#8890b0', align: 'center',
    });
    drawText(ctx, 'X PYYHI   ENTER VALMIS', 160, 190, { color: '#8890b0', align: 'center' });
  }
}

/** The board itself. `highlight` flashes the row that was just added. */
export class HighScoreScene {
  constructor(game, highlight = -1, next = null) {
    this.game = game;
    this.highlight = highlight;
    this.next = next || (() => this.game.toTitle());
    this.tick = 0;
    this.scores = loadScores();
  }

  enter() {
    Music.play('title');
  }

  update(input) {
    this.tick++;
    if (this.tick > 8 && (input.pressed.jump || input.pressed.start)) {
      input.consume('jump');
      input.consume('start');
      Sfx.play('select');
      this.next();
    }
  }

  draw(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, '#101830');
    grad.addColorStop(1, '#20304c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 320, 240);

    drawText(ctx, 'PARHAAT PIERUT', 160, 16, {
      color: '#ffd048', align: 'center', shadow: '#303048', scale: 2,
    });
    ctx.fillStyle = '#8fe04a';
    ctx.fillRect(28, 36, 264, 1);

    if (!this.scores.length) {
      drawText(ctx, 'EI VIELÄ TULOKSIA', 160, 100, { color: '#c0c0d0', align: 'center' });
      drawText(ctx, 'PELAA YKSI PELI LÄPI', 160, 114, { color: '#8890b0', align: 'center' });
    }

    this.scores.forEach((entry, i) => {
      const y = 46 + i * 16;
      const lit = i === this.highlight && Math.floor(this.tick / 8) % 2 === 0;
      const color = lit ? '#ffffff' : i === this.highlight ? '#ffd048' : '#c8c8dc';
      drawText(ctx, `${i + 1}`.padStart(2), COL.rank, y, { color: '#8890b0' });
      drawText(ctx, entry.name, COL.name, y, { color });
      if (entry.assisted) drawText(ctx, '*', COL.star, y, { color: '#c88040' });
      /* World and level, because "world 3" says nothing about whether they died
       * walking in or on the castle door. Older rows have no level and fall
       * back to the world alone rather than showing a blank. */
      drawText(ctx, entry.level || `M${entry.world}`, COL.level, y, { color: '#8fe04a' });
      /* The day the score was set, ISO order: year, month, day. It sorts the
       * same way it reads, and there is no continent on which it means
       * something else. The build version is still stored on the entry — it is
       * just not what anyone wants to read off a scoreboard. */
      if (entry.at) {
        drawText(ctx, isoDay(entry.at), COL.date, y, {
          color: entry.version === GAME_VERSION ? '#6a7a9a' : '#8a6a4a',
        });
      }
      /* How many continues the run took. Right-aligned so a growing number
       * grows away from the score, and blank at zero: an unmarked row is the
       * clean run, the same way an unstarred one is. */
      if (entry.continues > 0) {
        const n = entry.continues > 99 ? '99+' : `${entry.continues}`;
        drawText(ctx, `J${n}`, COL.continues, y, { color: '#c88040', align: 'right' });
      }
      drawText(ctx, padNum(entry.score, 6), COL.score, y, { color, align: 'right' });
    });

    /* One legend line, and only for the marks the board is actually showing —
     * a key to symbols nobody's row carries is just clutter. */
    const marks = [];
    if (this.scores.some((e) => e.assisted)) marks.push('* TILATALLENNUS KÄYTÖSSÄ');
    if (this.scores.some((e) => e.continues > 0)) marks.push('J JATKOT');
    if (marks.length) {
      drawText(ctx, marks.join('   '), 160, 212, { color: '#c88040', align: 'center' });
    }
    drawText(ctx, 'ENTER JATKA', 160, 228, { color: '#8890b0', align: 'center' });

    // a little decoration so the screen is not just a spreadsheet
    drawItem(ctx, 'star', 34, 12, this.tick);
    drawItem(ctx, 'star', 272, 12, this.tick);
  }
}
