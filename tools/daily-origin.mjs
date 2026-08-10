/**
 * Päivän pierun todistus: luetellaan siemenavaruus, tarkistetaan se, ja jätetään
 * repoon pelkkä tuomio.
 *
 *   VGLC_DIR="…" PW_MODULE=… node tools/daily-origin.mjs [--days 1096] [--from 2026-08-10]
 *
 * MIKSI TÄMÄ TYÖKALU ON OLEMASSA
 * ------------------------------
 * Päivän kenttä rakennetaan selaimessa (`src/core/daily.js`), ja selaimessa on
 * kaksi asiaa joita ei voi tehdä:
 *
 *   1. **Verrata korpukseen.** DESIGN.md kohta 3 vaatii että jokainen generoitu
 *      kenttä verrataan lähdekorpukseen kahdeksan sarakkeen ikkunoina, ja kohdan
 *      1 mukaan korpus ei ole repossa eikä julkaisussa. Selaimessa generoitu
 *      kenttä olisi siis merkinnältään `not checked`, mikä ei ole "ei osumia"
 *      vaan vastauksen puuttuminen.
 *   2. **Todistaa maareitti.** DESIGN.md kohta 5: maareitin on oltava
 *      läpäistävissä voimatasolla 0, ja se todistetaan botilla eikä
 *      validaattorilla. Botti ajaa moottoria Nodesta käsin.
 *
 * Ratkaisu ei ole poikkeus kumpaankaan sääntöön vaan se havainto, että **päivän
 * kenttä on funktio päivämäärästä**: siemenavaruus on äärellinen ja
 * lueteltavissa. Joten se luetellaan tässä — jokainen päivä ikkunan sisällä
 * generoidaan, verrataan korpukseen ja pelataan botilla läpi voimatasolla 0 —
 * ja `src/data/daily-origin.js`:ään kirjoitetaan **vain tuomio**: ikkunan rajat,
 * per päivä se yritysnumero joka läpäisi, ja sormenjälki. Korpuksesta ei mene
 * repoon mitään, eikä kentistä mene mitään: yksi 36-kantainen numero päivää
 * kohti ei ole kenttäkartta.
 *
 * SORMENJÄLKI ON TUOMION AIHE, JA SIKSI SE ON KENTTIEN TAVUISTA
 * ------------------------------------------------------------
 * Tuomio on tuomio *joistakin* kentistä. Jos generaattori, rytmiluvut,
 * hyppybudjetti tai päivän resepti muuttuu, pelaaja saa eri kentät kuin ne jotka
 * tarkistettiin — ja tuomio on hiljaa väärä, mikä on pahin mahdollinen tila.
 * Siksi sormenjälki lasketaan siitä mikä on ainoa asia jolla on väliä: ikkunan
 * jokaisen päivän kentän riveistä. `tools/verify.mjs` laskee saman luvun
 * uudestaan ja kaatuu erosta. Kalenteri ei kaada sitä — umpeutuva ikkuna on
 * varoitus, koska pysyvästi punainen portti sammutetaan (DESIGN.md kohta 3).
 *
 * Env: VGLC_DIR (pakollinen), PW_MODULE, PW_BROWSER, PORT
 */
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corpusIndex, hitsAgainst, WINDOW, ORIGIN_CHECKED } from './originality.mjs';
import { dailyBuild, dayNumber, dayLabel } from '../src/core/daily.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 8125);
const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

/**
 * Kolme vuotta, ja se on punnittu eikä pyöristetty.
 *
 * Ikkuna maksaa tasan sen mitä se kestää ajaa (alle minuutti kokonaisuudessaan)
 * ja tasan yhden merkin päivää kohti tiedostossa. Vastapainona on se päivä jona
 * ikkuna loppuu ja tila lakkaa tarjoamasta kenttää: mitä pidempi ikkuna, sitä
 * kauempana se on — mutta myös sitä kauempana se hetki jona joku muistaa ajaa
 * tämän uudestaan. Kolme vuotta on pitkä peliprojektin mittapuulla ja lyhyt
 * sille että portti muistuttaa asiasta ajoissa.
 */
const DAYS = Number(argOf('--days', 1096));

/**
 * Montako siementä päivä saa, ja miksi luku on iso.
 *
 * Hylätty siemen on kenttä joka rikkoi säännön, osui korpukseen tai kaatoi
 * botin. Se ei ole harvinaista eikä se ole vika: `gen-levels.mjs` hakee omat
 * kenttänsä 240 siemenellä ja kirjaa syyn — luumaailmassa **10 siementä 80:stä**
 * rakensi sääntöjä rikkomattoman kentän. Mitattuna tämän tilan omalla
 * reseptillä 200 päivän otoksessa mediaani on kolmas siemen, keskiarvo kuudes,
 * ja kahdella päivällä kahdestasadasta ei ollut kelvollista kenttää ensimmäisen
 * kolmenkymmenenkuuden joukossa. Kapea haku ei siis olisi tiukkuutta vaan
 * päiviä joilta puuttuu kenttä.
 *
 * 1296 = 36², eli yritys mahtuu **kahteen** 36-kantaiseen merkkiin
 * todistuksessa. Se on koko syy juuri tähän lukuun.
 */
const MAX_ATTEMPTS = 1296;

const FROM = argOf('--from', null);
const from = FROM ? Math.floor(Date.parse(`${FROM}T00:00:00Z`) / 86400000) : dayNumber();
if (!Number.isInteger(from)) {
  console.error(`\n  --from ${FROM}: ei ole päivämäärä muodossa VVVV-KK-PP\n`);
  process.exit(1);
}
const to = from + DAYS - 1;

/*
 * Ilman korpusta ei tehdä todistusta, ei edes osittaista.
 *
 * Tämä on ainoa työkalu tässä repossa joka kaatuu puuttuvaan `VGLC_DIR`:iin, ja
 * ero muihin on se mitä tämä kirjoittaa: `origin`-merkintä on väite jonka
 * pelaaja näkee ruudulla. `gen-levels.mjs` saa kirjoittaa `not checked`, koska
 * se on rehellinen kuvaus ajosta; tämä ei saa kirjoittaa mitään, koska
 * tarkistamaton päivän kenttä ei ole se mitä tila tarjoaa.
 */
const index = await corpusIndex();
if (!index) {
  console.error('\n  VGLC_DIR asettamatta — todistusta ei voi tehdä eikä sitä teeskennellä.');
  console.error('  Aja: VGLC_DIR="…" node tools/daily-origin.mjs\n');
  process.exit(2);
}

/* -------------------------- ehdokkaat, Nodessa --------------------------- */

/**
 * Ensimmäinen yritys `startAt`:sta eteenpäin joka läpäisee säännöt ja on puhdas
 * korpusta vasten. Botti kysytään erikseen, koska se vaatii selaimen.
 */
const rejected = { saannot: 0, korpus: 0, botti: 0 };

function candidate(day, startAt) {
  for (let attempt = startAt; attempt < MAX_ATTEMPTS; attempt++) {
    const { def, problems } = dailyBuild(day, attempt);
    if (problems.length) { rejected.saannot++; continue; }
    const hits = hitsAgainst(index, def.rows);
    if (hits > 0) { rejected.korpus++; continue; }
    return { attempt, rows: def.rows, theme: def.theme };
  }
  return null;
}

const days = [];
for (let day = from; day <= to; day++) {
  const first = candidate(day, 0);
  if (!first) {
    console.error(`\n  ${dayLabel(day)}: ${MAX_ATTEMPTS} siementä, yksikään ei kelvannut.\n`);
    process.exit(1);
  }
  days.push({ day, ...first });
}

/* ---------------------------- botti, selaimessa -------------------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = await new Promise((resolve) => {
  const s = createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const rel = normalize(url === '/' ? '/index.html' : url).replace(/^(\.\.[/\\])+/, '');
    try {
      const body = await readFile(join(ROOT, rel));
      res.writeHead(200, { 'Content-Type': MIME[extname(rel)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  s.listen(PORT, '127.0.0.1', () => resolve(s));
});

let chromium;
try {
  ({ chromium } = await import(process.env.PW_MODULE || 'playwright'));
} catch {
  console.error('playwright puuttuu:  npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PW_BROWSER ? { executablePath: process.env.PW_BROWSER } : {}),
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

/**
 * Ajaa botin annetuille päiville sivulla. Sama botti kuin `tools/playable.mjs`
 * (`tools/level-bot.js`), sama voimataso 0, samat viholliset ja vaarat pois —
 * kysymys on maastosta.
 *
 * Ja tässä on samalla se väite jota mikään muu ei tekisi: sivu rakentaa kentän
 * itse `dailyBuild`illa, ja Node vertaa sen rivit omiinsa. Jos kaksi ajoympäristöä
 * eroaisivat yhdelläkin tavulla, todistus koskisi eri kenttää kuin peli pelaa.
 */
const runBot = async (list) => page.evaluate(async ({ jobs, frames }) => {
  const { LevelScene } = await import('/src/scenes/level.js');
  const { isSolid } = await import('/src/gfx/tiles.js');
  const { runGround } = await import('/tools/level-bot.js');
  const { dailyBuild: build } = await import('/src/core/daily.js');
  const game = window.sfb3;
  const out = [];
  for (const job of jobs) {
    const { def } = build(job.day, job.attempt);
    game.state = {
      lives: 9, coins: 0, score: 0, power: { type: null, level: 0 }, reserve: null,
      world: 0, node: 'w1-1', cleared: {}, worldsOpen: 1, cards: [],
    };
    let finished = null;
    game.finishLevel = (r) => { finished = r; };
    const scene = new LevelScene(game, def.id, def);
    game.scene = scene;
    scene.entities = scene.entities.filter((e) => e.kind !== 'enemy' && e.kind !== 'hazard');
    scene.time = 9999;
    const r = runGround(scene, isSolid, frames, () => finished);
    out.push({ day: job.day, cleared: r.cleared, reach: r.reach, rows: def.rows.join('\n') });
  }
  return out;
}, { jobs: list, frames: 7000 });

const BATCH = 60;
let pending = days;
let round = 0;
const mismatch = [];
while (pending.length) {
  round++;
  const failed = [];
  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    const results = await runBot(slice.map(({ day, attempt }) => ({ day, attempt })));
    for (const r of results) {
      const entry = pending.find((d) => d.day === r.day);
      if (r.rows !== entry.rows.join('\n')) mismatch.push(dayLabel(entry.day));
      if (r.cleared) { entry.cleared = true; continue; }
      rejected.botti++;
      const next = candidate(entry.day, entry.attempt + 1);
      if (!next) {
        console.error(`\n  ${dayLabel(entry.day)}: yksikään ${MAX_ATTEMPTS} siemenestä ei mennyt läpi botilla.\n`);
        process.exit(1);
      }
      Object.assign(entry, next);
      failed.push(entry);
    }
  }
  process.stdout.write(`  kierros ${round}: ${pending.length - failed.length} läpi, ${failed.length} uudelleen\n`);
  pending = failed;
  if (round > MAX_ATTEMPTS) break;
}

await browser.close();
server.close();

if (mismatch.length) {
  console.error(`\n  Node ja selain rakensivat eri kentän: ${mismatch.slice(0, 5).join(', ')}\n`);
  process.exit(1);
}

/* ------------------------------- tuomio ---------------------------------- */

const hash = createHash('sha256');
for (const d of days) hash.update(`${d.day}:${d.attempt}\n${d.rows.join('\n')}\n`);
const fingerprint = hash.digest('hex').slice(0, 16);

const attempts = days.map((d) => d.attempt.toString(36).padStart(2, '0')).join('');
const stamp = new Date().toISOString().slice(0, 10);

const out = `/**
 * GENERATED FILE — do not edit by hand.
 *
 *   VGLC_DIR="…" node tools/daily-origin.mjs
 *
 * Päivän pierun todistus. Tässä on **vain tuomio**: ei korpusta, ei kenttiä.
 *
 *   \`from\`/\`to\`      se päiväväli jonka jokainen kenttä on tarkistettu,
 *                    UTC-vuorokausina epookista (ks. src/core/daily.js)
 *   \`origin\`         '${ORIGIN_CHECKED}' — korpus luettiin ja jokainen
 *                    ${WINDOW} sarakkeen ikkuna verrattiin, osumia 0
 *   \`attempts\`       kaksi 36-kantaista merkkiä per päivä: se siemenyritys joka
 *                    läpäisi säännöt, korpuksen ja botin
 *   \`fingerprint\`    sha256 ikkunan jokaisen päivän riveistä, 16 merkkiä.
 *                    Tämä on se luku joka tekee tuomiosta tuomion *näistä*
 *                    kentistä; \`tools/verify.mjs\` laskee sen uudestaan.
 *
 * Ikkunan ulkopuolella päivän pieru ei tarjoa kenttää — tarkistamaton päivän
 * kenttä olisi huonompi kuin ei päivän kenttää. Uusi ikkuna: aja tämä työkalu.
 */

export const DAILY_ORIGIN = {
  from: ${from},
  to: ${to},
  origin: '${ORIGIN_CHECKED}',
  attempts: '${attempts}',
  fingerprint: '${fingerprint}',
  window: ${WINDOW},
  corpusFiles: ${index.files},
  checked: '${stamp}',
};
`;

await writeFile(join(ROOT, 'src/data/daily-origin.js'), out);

const retried = days.filter((d) => d.attempt > 0).length;
console.log(`\nPäivän pieru — todistus ${dayLabel(from)} … ${dayLabel(to)} (${days.length} päivää)\n`);
console.log(`  korpus            ${index.files} tiedostoa, ${WINDOW} sarakkeen ikkuna, 0 osumaa`);
console.log(`  botti             ${days.length} kenttää läpi voimatasolla 0`);
console.log(`  hylätyt siemenet  ${rejected.saannot} sääntöihin, ${rejected.korpus} korpukseen, `
  + `${rejected.botti} bottiin  (${retried} päivää tarvitsi muun kuin ensimmäisen siemenen)`);
console.log(`  sormenjälki       ${fingerprint}`);
console.log('\n  wrote src/data/daily-origin.js\n');
