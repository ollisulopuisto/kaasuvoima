export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const approach = (v, target, step) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);

export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Deterministic small PRNG so decoration never flickers between frames.
 *
 * **PUOLET ARVOALUEESTA PUUTTUI, JA SE MITATTIIN 18.8.2026.**
 *
 * Sekoitin päättyi rivillä `h ^ (h >> 16)`, ja `>>` on etumerkillinen: jos `h`
 * on negatiivinen, myös `h >> 16` on, ja kahden negatiivisen XOR nollaa
 * etumerkkibitin. Tulos oli siis **aina** ei-negatiivinen int32, eli aina alle
 * 2^31, eli jaettuna 2^32:lla **aina alle 0,5**.
 *
 * Mitattu 8000 pisteen otoksella ennen korjausta: keskiarvo 0,254, yli 0,5
 * meni **0,0 %**, ja ylimmät kaksi viidennestä olivat tyhjiä. Sen seuraus ei
 * ole hienovarainen: jokainen `hashNoise(...) > 0.55` -haara koko pelissä oli
 * kuollutta koodia. Tiilen oksankohta, kiven halkeama, hiekan raidat,
 * lumen toinen halkeama — ja **piilotiilet**, jotka arvotaan samalla
 * funktiolla. Puolet siitä vaihtelusta jota peli luuli piirtävänsä ei ollut
 * koskaan olemassa.
 *
 * Korjaus on kaksi merkkiä: etumerkitön siirto molemmissa sekoitusvaiheissa,
 * ja `Math.imul` kertolaskuun jotta 32 bittiä pysyy 32 bittinä (`*` laskee
 * doublella ja pudottaa alimmat bitit hiljaa). Sen jälkeen keskiarvo on 0,50 ja
 * viidennekset ovat tasan.
 */
export function hashNoise(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * SAMA HASH RIKKINÄISENÄ, ja se on tarkoituksellisesti jäädytetty.
 *
 * `hashNoise` päättää kaksi eri lajia asioita: **miltä jokin näyttää** ja
 * **missä jokin on**. Korjaus koskee vain ensimmäistä, koska jälkimmäinen on
 * julkaistua dataa:
 *
 *   - **Piilotiilet** arvotaan tällä (`core/secrets.js`, `data/generator.js`).
 *     Korjattu jakauma siirtää jokaisen salaisuuden koko pelissä — mitattuna
 *     `39/562 tiiltä`, kolme porttia punaisena ja kaksi kenttää ilman yhtään
 *     salaisuutta.
 *   - **Päivän pierun alkuperätodiste** (`data/daily-origin.js`) on sormenjälki
 *     tuhannen päivän generoiduista kentistä, ja se on tarkistettu korpusta
 *     vasten jota ei ole tässä repossa. Sen uudelleen laskeminen ilman korpusta
 *     vaihtaisi `checked`-merkinnän `not checked`iksi — eli korjaus maksaisi
 *     todisteen.
 *
 * Siksi paikka lukee tätä ja koriste lukee korjattua. Nimi sanoo sen ääneen, ja
 * kun korpus joskus on käsillä, tämä poistuu yhdellä ajolla.
 */
export function hashPlace(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

/** Pads every row of an ASCII map to the same width so lookups never go ragged. */
export function normalizeRows(rows) {
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map((r) => r.padEnd(width, ' '));
}

export function padNum(value, digits) {
  return String(Math.max(0, Math.floor(value))).padStart(digits, '0');
}
