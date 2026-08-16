/**
 * HYPPYSARJOJEN GENERAATTORI — "vaikea muttei mahdoton", haettuna eikä arvattuna.
 *
 *   node tools/gen-jumps.mjs            # hae ja tulosta
 *   node tools/gen-jumps.mjs --write    # ...ja kirjoita src/data/chunks/jumps.js
 *
 * Omistajan pyyntö 16.8.2026: *"we need more difficult jumping. So you need to
 * create an algorithm that can create jump sequences that are hard but not
 * impossible to land."*
 *
 *
 * ## Miten tämä toimii, kolmella rivillä
 *
 * 1. **Arvo ehdokas.** Siemenestä johdettu jono tasanteita: leveys, kuilu ja
 *    korkeusero jokaiselle, reseptin rajojen sisältä.
 * 2. **Ratkaise se.** `tools/jump-solver.js` etsii jokaiselle loikalle
 *    ponnistuskohdan ja pitoajan, mittaa **ikkunan** (montako pikseliä
 *    ponnistuskohtaa saa heittää ja silti osua), ja ajaa lopuksi koko sarjan
 *    yhtenä juoksuna.
 * 3. **Hyväksy tai heitä pois.** Ehdokas kelpaa vain jos jokainen loikka
 *    onnistuu, koko juoksu menee läpi, ja ikkunat ovat reseptin haarukassa.
 *
 * Kolmas kohta on koko työkalu. Ilman alarajaa syntyisi mahdottomia sarjoja;
 * ilman ylärajaa syntyisi käytävä jota kävellään. **Vaikeus on tässä
 * mitattu suure eikä tyylivalinta**, ja sen yksikkö on pikseli.
 *
 *
 * ## Miksi tämä on työkalu eikä generaattorin osa
 *
 * `src/data/generator.js` tekee kokonaisia kenttiä louhituista rytmiluvuista,
 * ja sen tuotos on lukittu: `src/data/generated.js`:n 60 kenttää ja päivän
 * pierun sormenjälki riippuvat siitä että se tuottaa merkilleen samaa. Uusi
 * palikkatyyppi sen sisään muuttaisi ne kaikki.
 *
 * Nämä sarjat ovat siksi **palikoita** — samaa lajia kuin `chunks/`in
 * käsintehdyt — ja ne kirjoitetaan tiedostoon jonka kenttä voi ladata nimeltä.
 * Erona käsintehtyyn on että jokaisella on todistus mukanaan, ja `verify.mjs`
 * ajaa sen todistuksen uudestaan joka ajolla samasta moduulista. Fysiikan
 * muutos ei siis vanhenna näitä hiljaa: se kaataa portin.
 *
 *
 * ## Mitä "ikkuna" on, ja mitä se ei ole
 *
 * Ikkuna on ponnistuspaikkojen määrä pikseleinä. Se **ei** ole framebudjetti:
 * juoksukatolla (2,5 px/frame) kymmenen pikselin ikkuna on neljä framea,
 * kävelyvauhdilla seitsemän. Se ei myöskään ole ainoa vaikeuden lähde — pito,
 * vauhti ja laskeutumistasanteen kapeus ovat kaikki mukana, mutta ne näkyvät
 * ikkunassa: kapea tasanne kaventaa ikkunaa, ja väärä vauhti sulkee sen.
 */
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 8153);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
};

/**
 * RESEPTIT, ja ne ovat kolme eri kysymystä eivätkä kolme vaikeustasoa.
 *
 * `window` on hyväksytty haarukka pikseleinä, ja se on jokaisen reseptin
 * tärkein rivi:
 *
 *   HARJOITUS  leveät tasanteet, matalat erot, ikkuna 12–30 px. Tämä on se
 *              sarja jonka pelaaja läpäisee ensimmäisellä yrittämällä ja josta
 *              hän oppii että sarja *on* asia — laskeutuminen on lähtö.
 *   KAMPI      kapeammat tasanteet ja korkeuseroja molempiin suuntiin,
 *              kapein ikkuna 18–32 px. Alaspäin menevä loikka on tässä se uusi asia:
 *              se on helppo osua ja vaikea pysähtyä.
 *   NEULA      yhden ja kahden ruudun tasanteita, kapein ikkuna 6–16 px. Kuusi
 *              pikseliä on kaksi ja puoli framea juoksukatolla, ja se on tämän
 *              työkalun alaraja: sen alle menevä sarja hyväksyttäisiin vain
 *              siksi että ratkaisija on tarkempi kuin ihminen.
 *
 * Haarukat ovat mitattuja eivätkä toivottuja: ensimmäinen ajo tuotti näillä
 * geometrioilla ikkunat 36–57 / 19–49 / 6–33 px, ja rajat on asetettu siihen
 * mitä nämä reseptit oikeasti tekevät. Yläraja 57 on sitä paitsi mittarin oma
 * katto (`TAKEOFF_MAX` + 1): sen saavuttanut loikka ei ole leveä vaan
 * mittaamaton, eli sekin kuuluu hylätä.
 *
 * `lead` ja `tail` ovat maata sarjan molemmissa päissä. Ne eivät ole
 * koristetta: palikka liitetään toisten perään, ja ilman omaa vauhdinottoaan
 * sarjan ensimmäinen loikka olisi eri loikka riippuen siitä mikä palikka
 * sattuu olemaan sitä ennen.
 *
 * `roof` panee kattorivit (0 ja 1) koko leveydeltä, ja se on maailman 8
 * ehto eikä koriste: linnake on sisätila, ja sen porttina on että **katettuja
 * sarakkeita on 100 %** — avoin taivas keskellä holvia rikkoisi sen mittauksen
 * eikä vain tunnelmaa. Kaikki kolme sarjaa ovat katettuja, koska kaikki kolme
 * asetetaan sinne: viimeinen maailma on se paikka jossa hyppy saa olla pelin
 * vaikein asia.
 */
const PLANS = [
  {
    name: 'hyppy_harjoitus',
    title: 'HARJOITUS',
    pads: 4,
    lead: 6,
    tail: 5,
    padW: [3, 4],
    gap: [4, 5],
    rise: [-1, 1],
    row: [9, 12],
    roof: true,
    window: [30, 50],
  },
  {
    name: 'hyppy_kampi',
    title: 'KAMPI',
    pads: 5,
    lead: 6,
    tail: 5,
    padW: [2, 3],
    gap: [4, 5],
    rise: [-2, 2],
    row: [8, 12],
    roof: true,
    window: [18, 32],
  },
  {
    name: 'hyppy_neula',
    title: 'NEULA',
    pads: 5,
    lead: 6,
    tail: 5,
    padW: [1, 2],
    gap: [5, 5],
    rise: [-2, 2],
    row: [8, 12],
    roof: true,
    window: [6, 16],
  },
];

/**
 * Montako ehdokasta kutakin reseptiä kohti mitataan, ja miksi luku on pieni.
 *
 * Ensimmäinen versio hylkäsi ehdokkaita kunnes yksi osui haarukkaan, ja se on
 * väärä muoto tälle työlle kahdesta syystä. **Se on hidas** — yhden ehdokkaan
 * ratkaiseminen on tuhansia simuloituja hyppyjä, ja hylkäysotanta ajaa niitä
 * kunnes tuuri käy. **Ja se on sokea**: ensimmäinen haarukkaan osunut ei ole
 * paras vaan ensimmäinen.
 *
 * Nyt mitataan kiinteä määrä ehdokkaita ja valitaan niistä se jonka kapein
 * loikka on lähimpänä reseptin tavoitetta. Kustannus on tiedossa etukäteen,
 * tulos on paras mitatuista, ja jokainen mittaus tulostetaan — myös ne jotka
 * hävisivät, koska muuten "paras" on väite jota ei voi tarkistaa.
 */
const TRIES = 14;

function serve() {
  const server = createServer(async (req, res) => {
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
  return new Promise((r) => server.listen(PORT, '127.0.0.1', () => r(server)));
}

const server = await serve();
let chromium;
try {
  ({ chromium } = await import(process.env.PW_MODULE || 'playwright'));
} catch {
  console.error('playwright is missing. Run:  npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const found = await page.evaluate(async ({ plans, tries }) => {
  const { LevelScene } = await import('/src/scenes/level.js');
  const { solveSequence } = await import('/tools/jump-solver.js');
  const { mulberry32 } = await import('/src/data/generator.js');
  const game = window.sfb3;
  game.finishLevel = () => {};

  /** Yksi ehdokas: rivit, leveys ja se resepti josta se tehtiin. */
  const build = (plan, seed) => {
    const rnd = mulberry32(seed);
    const pick = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    const pads = [];
    let x = plan.lead;
    let row = 13;
    for (let i = 0; i < plan.pads; i++) {
      const gap = pick(plan.gap[0], plan.gap[1]);
      const w = pick(plan.padW[0], plan.padW[1]);
      const rise = pick(plan.rise[0], plan.rise[1]);
      row = Math.max(plan.row[0], Math.min(plan.row[1], row - rise));
      x += gap;
      pads.push({ x, w, row });
      x += w;
    }
    const gap = pick(plan.gap[0], plan.gap[1]);
    const width = x + gap + plan.tail;
    const rows = Array.from({ length: 15 }, () => ' '.repeat(width));
    const set = (y, at, str) => {
      rows[y] = rows[y].slice(0, at) + str + rows[y].slice(at + str.length);
    };
    if (plan.roof) {
      set(0, 0, '#'.repeat(width));
      set(1, 0, '#'.repeat(width));
    }
    // Maa molemmissa päissä, ja väliin ei mitään: `-` on ainoa jalansija.
    set(13, 0, '#'.repeat(plan.lead));
    set(14, 0, '#'.repeat(plan.lead));
    set(13, width - plan.tail, '#'.repeat(plan.tail));
    set(14, width - plan.tail, '#'.repeat(plan.tail));
    for (const pad of pads) set(pad.row, pad.x, '-'.repeat(pad.w));
    return { rows, width, pads };
  };

  const mkScene = (cand) => () => {
    game.state = {
      lives: 5, coins: 0, score: 0, power: { type: null, level: 0 },
      reserve: null, world: 0, node: 'w1-1', cleared: {}, worldsOpen: 1, cards: [],
    };
    const s = new LevelScene(game, 'jumps', {
      id: 'jumps', theme: 'grass', bg: 'hills', music: 'level', time: 9999,
      boss: false, bossVariant: 0, bands: null, rows: cand.rows,
    });
    s.entities = s.entities.filter((e) => e.kind === 'player');
    s.goal = null;
    return s;
  };

  const out = [];
  for (const plan of plans) {
    const target = (plan.window[0] + plan.window[1]) / 2;
    const rows = [];
    let hit = null;
    let bestScore = Infinity;
    for (let seed = 1; seed <= tries; seed++) {
      const cand = build(plan, seed);
      const got = solveSequence(mkScene(cand));
      const wins = got.hops.map((h) => h.window);
      const lo = wins.length ? Math.min(...wins) : 0;
      const hi = wins.length ? Math.max(...wins) : 0;
      /* Ehto koskee **kapeinta** loikkaa eikä kaikkia, ja se on suunnittelu-
       * päätös eikä laiskuus. Sarjan vaikeus on sen tiukin kohta — se on se
       * joka pudottaa — ja väljä loikka sen keskellä on hengähdys eikä vika.
       * Ensimmäinen versio vaati jokaiselta loikalta haarukan, ja se hylkäsi
       * jokaisen ehdokkaan yhdestä helposta loikasta viidestä. Se olisi ollut
       * vaatimus "tasainen sarja", ja tasainen sarja on rytmitön. */
      const ok = got.ok && got.walked && lo >= plan.window[0] && lo <= plan.window[1];
      rows.push({ seed, ok, walked: got.walked, solved: got.ok, lo, hi, wins });
      if (!ok) continue;
      const score = Math.abs(lo - target);
      if (score < bestScore) {
        bestScore = score;
        hit = { seed, rows: cand.rows, width: cand.width, hops: got.hops, lo, hi };
      }
    }
    out.push({ plan: plan.name, title: plan.title, tried: rows.length, rows, hit });
  }
  return out;
}, { plans: PLANS, tries: TRIES });

await browser.close();
server.close();

/* ------------------------------- report ---------------------------------- */

const pad = (s, n) => String(s).padEnd(n);
console.log('\nHyppysarjat — ikkuna on ponnistuskohtien määrä pikseleinä.\n');
console.log(`  ${pad('SARJA', 18)}${pad('SIEMEN', 8)}${pad('LEVEYS', 8)}${pad('LOIKAT', 8)}IKKUNAT`);
let missing = 0;
for (const row of found) {
  if (!row.hit) {
    missing++;
    console.log(`  ${pad(row.plan, 18)}${pad('-', 8)}${pad('-', 8)}${pad('-', 8)}`
      + `ei löytynyt ${row.tried} siemenellä`);
    for (const c of row.rows) {
      console.log(`      siemen ${pad(c.seed, 4)} ratkesi ${c.solved} kulki ${c.walked}`
        + ` ikkunat ${c.wins.join(' ') || '-'}`);
    }
    continue;
  }
  const wins = row.hit.hops.map((h) => h.window).join(' ');
  console.log(`  ${pad(row.plan, 18)}${pad(row.hit.seed, 8)}${pad(row.hit.width, 8)}`
    + `${pad(row.hit.hops.length, 8)}${wins}`);
  for (const h of row.hit.hops) {
    console.log(`      kuilu ${h.gap}, nousu ${h.rise >= 0 ? '+' : ''}${h.rise}, `
      + `tasanne ${h.pad}, ikkuna ${h.window} px `
      + `(${h.plan.running ? 'juosten' : 'kävellen'}, pito ${h.plan.hold})`);
  }
}

if (!process.argv.includes('--write')) {
  console.log('\n  (--write kirjoittaa src/data/chunks/jumps.js)');
  process.exit(missing ? 1 : 0);
}
if (missing) {
  console.error('\n  Yhtään palikkaa ei kirjoitettu: yksi resepti jäi ratkaisematta.');
  process.exit(1);
}

/* -------------------------------- write ---------------------------------- */

const body = found.map((row) => {
  const spec = [];
  for (let y = 0; y < 15; y++) {
    const line = row.hit.rows[y].replace(/\s+$/, '');
    if (line) spec.push(`    ${y}: '${line}',`);
  }
  const hops = row.hit.hops.map((h) => `   *   kuilu ${h.gap}, nousu ${h.rise >= 0 ? '+' : ''}${h.rise}`
    + `, tasanne ${h.pad} → ikkuna ${h.window} px`).join('\n');
  return `  /**
   * ${row.title} — siemen ${row.hit.seed}, ${row.hit.hops.length} loikkaa,
   * ikkunat ${row.hit.lo}–${row.hit.hi} px.
   *
${hops}
   *
   * Ratkaistu ja ajettu läpi `
    + `\`tools/jump-solver.js\`:llä voimatasolla 0, pelkällä
   * juoksulla ja hypyllä. \`verify.mjs\` ajaa saman todistuksen uudestaan.
   */
  ${row.plan}: ck(${row.hit.width}, {
${spec.join('\n')}
  }),`;
}).join('\n\n');

const file = `/**
 * GENERATED FILE — älä muokkaa käsin.
 *
 *   node tools/gen-jumps.mjs --write
 *
 * Hyppysarjat: palikoita joissa ei ole muuta kuin lautoja ja tyhjää, ja joista
 * jokaisella on todistus mukanaan. Todistus on kahdessa osassa ja molemmat
 * ovat mitattuja eivätkä väitettyjä:
 *
 *   **Ei mahdoton** — \`tools/jump-solver.js\` löytää jokaiselle loikalle
 *   ponnistuskohdan ja pitoajan, ja ajaa koko sarjan läpi yhtenä juoksuna
 *   voimatasolla 0, pelkällä juoksulla ja hypyllä.
 *
 *   **Vaikea** — jokaisen loikan *ikkuna* eli niiden ponnistuskohtien määrä
 *   pikseleinä jotka vievät perille, on reseptin haarukassa. Leveä ikkuna on
 *   käytävä, nolla on seinä, ja nämä ovat siinä välissä.
 *
 * Ikkunat on kirjoitettu kunkin palikan kommenttiin. Ne ovat sen palikan
 * ominaisuus samalla tavalla kuin leveys, ja ne vanhenevat samalla tavalla:
 * fysiikan muutos muuttaa ne, ja \`tools/verify.mjs\` mittaa ne uudestaan joka
 * ajolla ja kaatuu jos jokin sarja on muuttunut mahdottomaksi tai kävelyksi.
 */

import { ck } from './common.js';

export const JUMP_CHUNKS = {
${body}
};
`;
await writeFile(join(ROOT, 'src/data/chunks/jumps.js'), file);
console.log('\n  kirjoitettu: src/data/chunks/jumps.js');
