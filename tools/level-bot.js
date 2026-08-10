/**
 * Se botti joka juoksee oikealle ja hyppää — maareitin todiste, yhtenä kopiona.
 *
 * Tämä koodi oli `tools/playable.mjs`:n sisällä siihen asti kun toinenkin
 * työkalu tarvitsi sen: `tools/daily-origin.mjs` pelaa jokaisen päivän kentän
 * läpi voimatasolla 0 ennen kuin päivä pääsee todistukseen. Kaksi kopiota
 * bottia olisi kaksi eri mielipidettä siitä mitä "läpäistävissä" tarkoittaa, ja
 * juuri se on se lupaus jota DESIGN.md kohta 5 pitää — eli se on viimeinen asia
 * jonka saisi olla kahdessa paikassa.
 *
 * Selaimeen ladattava moduuli samasta syystä kuin `tools/climb-bot.js`: botti
 * ajaa moottoria, ja moottori on sivulla.
 *
 * Mitä tämä botti **ei** osaa, sanottuna ääneen koska se on tuloksen tulkinta:
 * se ei osaa hypätä kelluvalta lavalta toiselle, kyykistyä, mennä putkeen,
 * potkaista kuorta eikä odottaa liikkuvaa. Sen "EI LÄPI" on siksi syy avata
 * kenttä eikä tuomio siitä.
 */

export const blankInput = () => ({
  left: false, right: false, up: false, down: false, jump: false, run: false,
  start: false, mute: false, quicksave: false, quickload: false, slot: false,
});

export const makeInput = () => ({
  held: blankInput(),
  pressed: blankInput(),
  released: blankInput(),
  consume(a) { this.pressed[a] = false; },
});

/**
 * Ajaa kentän läpi vasemmalta oikealle.
 *
 * @param {object} scene   LevelScene, viholliset ja vaarat jo suodatettuina
 * @param {function} isSolid  `src/gfx/tiles.js`:n oma
 * @param {number} frames  kuinka monta framea saa yrittää
 * @param {function} finished  palauttaa `finishLevel`in tuloksen tai null
 */
export function runGround(scene, isSolid, frames, finished) {
  const input = makeInput();
  let prevJump = false;
  let hold = 0;
  let maxX = scene.player.x;
  let stuckAt = null;
  let stuckFor = 0;
  let death = null;

  for (let f = 0; f < frames && !finished(); f++) {
    const p = scene.player;
    const footY = Math.floor((p.y + p.h) / 16);
    const aheadX = Math.floor((p.x + p.w + 6) / 16);
    const solid = (tx, ty) => isSolid(scene.tileAt(tx, ty));
    const lethal = (tx, ty) => '^W'.includes(scene.tileAt(tx, ty));
    const wall = solid(aheadX, footY - 1) || solid(aheadX, footY - 2);

    /* Look several tiles ahead rather than at the next one.
     *
     * The first version of this bot jumped when an obstacle was six pixels
     * away, and then "failed" every level with a four-tile spike bed in it —
     * a jump any player makes without thinking. That was the bot being
     * useless, not the levels being broken, and a test that cries wolf about
     * good levels is worse than no test. */
    let obstacle = -1;
    for (let d = 0; d <= 5 && obstacle < 0; d++) {
      const tx = aheadX + d;
      if (lethal(tx, footY) || lethal(tx, footY - 1)) obstacle = d;
      else if (!solid(tx, footY) && !solid(tx + 1, footY)) obstacle = d;
    }
    // Two tiles of run-up is where a running jump clears the most.
    const takeOff = p.onGround && (wall || (obstacle >= 0 && obstacle <= 2));

    /* How far is it across? A player looks at the gap and jumps roughly that
     * hard. The bot used to hold jump for the full 16 frames every single
     * time, which sails 19 tiles over a 9-tile pit and lands in whatever is
     * on the far side — in 4-2, a lava trench. That looked exactly like a
     * broken level and was not one. */
    if (takeOff) {
      let span = 0;
      if (obstacle >= 0) {
        const start = aheadX + obstacle;
        while (span < 14 && (!solid(start + span, footY)
          || lethal(start + span, footY) || lethal(start + span, footY - 1))) span++;
      }
      hold = wall ? 16 : Math.max(5, Math.min(16, 3 + span * 1.1)) | 0;
    }
    // Spend an air jump when falling with nothing solid below: that is what
    // the mushroom is for, and a bot that never uses it measures the wrong
    // thing.
    const groundBelow = solid(Math.floor(p.cx / 16), footY + 1)
      || solid(Math.floor(p.cx / 16), footY + 2);
    const airSave = !p.onGround && p.vy > 1.5 && !groundBelow
      && p.airJumps < p.airJumpsMax;
    const wantJump = takeOff || airSave || (hold > 0 && p.vy < 0);
    if (hold > 0) hold--;

    input.held = blankInput();
    input.held.right = true;
    input.held.run = true;
    input.held.jump = wantJump;
    input.pressed = blankInput();
    input.pressed.jump = (takeOff || airSave) && !prevJump;
    prevJump = wantJump;
    scene.update(input);

    if (p.x > maxX + 4) {
      maxX = p.x;
      stuckFor = 0;
    } else if (++stuckFor === 240 && stuckAt === null) {
      // Where it first stopped getting anywhere is the useful coordinate;
      // where it eventually died usually is not.
      stuckAt = Math.floor(maxX / 16);
    }
    if (scene.state === 'dead' && !finished()) {
      death = {
        tx: Math.floor(p.cx / 16),
        ty: Math.floor(p.cy / 16),
        // A death below the floor is a gap it could not clear; anything else
        // is terrain it ran into.
        how: p.y > scene.heightPx - 24 ? 'kuilu' : 'maasto',
      };
      break;
    }
  }

  const done = finished();
  return {
    cleared: !!(done && done.cleared),
    reach: Math.round((maxX / (scene.w * 16)) * 100),
    width: scene.w,
    stuckAt,
    death,
    died: scene.state === 'dead',
  };
}
