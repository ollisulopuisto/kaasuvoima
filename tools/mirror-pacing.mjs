/**
 * Kantaa louhitut luvut selaimen puolelle.
 *
 *   node tools/mirror-pacing.mjs      (kirjoittaa src/data/pacing.js)
 *
 * `tools/pacing-stats.json` ja `tools/jump-budget.json` ovat mittaustuloksia:
 * ensimmäisen kirjoittaa `tools/mine-pacing.mjs` korpuksesta (DESIGN.md kohta 3,
 * pelkkiä aggregaatteja) ja toisen `tools/measure-jump.mjs` pelistä itsestään.
 * Molemmat ovat Node-työkalujen tuotoksia ja molemmat ovat JSONia levyllä.
 *
 * Siihen asti kun generaattori oli pelkkä työkalu, se riitti. **Päivän pieru
 * generoi kentän selaimessa**, eikä staattinen sivu saa hakea JSONia verkosta
 * ennen kuin se voi rakentaa kentän — se olisi asynkroninen lataus ja
 * epäonnistumisen paikka siinä kohdassa jossa peli vain haluaa kentän. Siksi
 * samat luvut kannetaan JS-moduuliin, jonka *sekä* selain *että* työkalu
 * importtaavat.
 *
 * Yksi lähde ja yksi kopio, eikä kopio ole lupaus vaan mitattu:
 *
 *   - `tools/gen-levels.mjs` lukee luvut **tästä kopiosta** eikä JSONista, joten
 *     jos kopio ei vastaa mitattua, se näkyy heti generoitujen kenttien
 *     muuttumisena — ja `src/data/generated.js`:n on tultava ulos tavulleen
 *     samana.
 *   - `tools/verify.mjs` vertaa kopiota molempiin JSONeihin syvävertailuna ja
 *     kaatuu erosta. Se on se portti joka huomaa, kun joku ajaa
 *     `tools/measure-jump.mjs`:n eikä tätä.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const stats = JSON.parse(await readFile(join(ROOT, 'tools/pacing-stats.json'), 'utf8'));
const budget = JSON.parse(await readFile(join(ROOT, 'tools/jump-budget.json'), 'utf8'));

const out = `/**
 * GENERATED FILE — älä muokkaa käsin.
 *
 *   node tools/mirror-pacing.mjs
 *
 * Louhitut rytmiluvut (tools/pacing-stats.json) ja mitattu hyppybudjetti
 * (tools/jump-budget.json) siinä muodossa jonka selain osaa importata
 * synkronisesti. Ks. tools/mirror-pacing.mjs siitä miksi kopio on olemassa ja
 * mikä portti pitää sen samana kuin mittaus.
 */

export const PACING_STATS = ${JSON.stringify(stats, null, 2)};

export const JUMP_BUDGET = ${JSON.stringify(budget, null, 2)};
`;

await writeFile(join(ROOT, 'src/data/pacing.js'), out);
console.log('\n  wrote src/data/pacing.js\n');
