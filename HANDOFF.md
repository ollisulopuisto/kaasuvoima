# Handoff

Tämä dokumentti on seuraavalle kehittäjälle (ihmiselle tai agentille), joka
jatkaa työtä. `README.md` kertoo mitä peli on ja miten sitä ajetaan — tämä
kertoo missä työ on kesken ja mihin on helppo kompastua.

## Missä työ on

| | |
| --- | --- |
| Haara | `claude/super-fart-bros-3-wmbbku` |
| Pull request | [#1](https://github.com/ollisulopuisto/sfb3/pull/1) — auki, ei mergattu, ei konflikteja |
| Pohja | `main` (pelkkä alkuperäinen commit) |
| Tila | 4 committia, 29 tiedostoa, peli pelattava päästä päähän |

```bash
git fetch origin
git checkout claude/super-fart-bros-3-wmbbku   # tai: git pull, jos olet jo siinä
python3 -m http.server 8000                    # http://localhost:8000
node tools/verify.mjs                          # headless-tarkistus (ks. README)
```

Jatka samalle haaralle ja samaan PR:ään, ellei ole syytä muuhun. **Vain yksi
agentti kerrallaan pushaa tähän haaraan** — aja `git pull --rebase` ennen kuin
aloitat, ja kerro käyttäjälle jos joudut force-pushaamaan.

## Mitä on tehty ja todennettu

Kaikki alla oleva on ajettu headless-Chromiumilla eikä konsolissa ole virheitä.
`node tools/verify.mjs` toistaa tarkistukset ja palauttaa nollasta poikkeavan
paluuarvon jos jokin hajoaa.

- **Maailmankarttamoottori**: solmuverkko, kulmikkaat polut, polkujen avautuminen,
  hernetalon esinevalinta, varastoesine, neljä maailmaa.
- **Kenttämoottori**: 16 kenttää, alipikselifysiikka, kiinteä 60 Hz askel,
  viholliset, tehostukset, maalikortti, linnakkeen ovi.
- **Voimatasot 1–5**: koko kasvaa 12x16 → 21x43, ominaisuus vahvistuu tason mukaan.
- **Ilmavaivateema**: ummetuskorkki, närästysliekki, ruskeat pilvet, vihainen
  aurinko aavikolla.
- **Pomot**: neljä varianttia, viimeisenä 3-kertaiseksi pullistuva PIERUPRINSSI.
- **Tilatallennus**: F5/F8/F6, palautuu täsmälleen ja peli jatkuu vedoksesta.

## Kesken tai auki

1. ~~Vercel-julkaisu~~ — tehty: peli on tuotannossa osoitteessa
   <https://sfb3.vercel.app>. `main` deployautuu automaattisesti pushista.
   `vercel.json` ohittaa asennusvaiheen (`installCommand`), joten
   `package.json`in devDependency (playwright) ei hidasta julkaisua.
2. ~~PR #1~~ — mergattu `main`-haaraan.
3. Peli ei ole tasapainotettu ihmispelaajalla — vain botilla ja käsin. Vaikeus
   erityisesti maailmassa 4 (kolme närästysliekkiä samassa palikassa) kannattaa
   tarkistaa oikealla pelaajalla.
4. Ei tarkistuspisteitä kenttien sisällä, ei warp-putkia, ei kosketusohjausta.

## Kompastuskivet

Nämä on opittu kantapään kautta — lue ennen kuin muutat moottoria.

- **`entity.level` on LevelScene, ei voimataso.** Pelaajan voimataso on
  `player.power.level` / `player.powerLevel`. Jos lisäät `Player`-luokkaan
  `level`-getterin, `Entity`-konstruktorin `this.level = level` heittää strict
  modessa ja koko peli hajoaa.
- **Uusi entiteettiluokka pitää lisätä `REGISTRY`-tauluun** tiedostossa
  `src/core/savestate.js`, muuten tilatallennus pudottaa sen hiljaa pois.
- **Uusi spawn-merkki** lisätään `ENEMY_CHARS`-tauluun (`src/entities/enemies.js`)
  eikä se saa törmätä ruutumerkkeihin (`T` tiedostossa `src/gfx/tiles.js`).
- **Palikan rivi ei saa ylittää ilmoitettua leveyttä** — `ck()` heittää heti
  latauksessa. Tämä on tarkoituksellista: se pitää sarakkeet kohdallaan.
- **Hyppybudjetti**: täysi juoksuhyppy nousee noin **75 px** (4,5 ruutua) ja
  kantaa noin **124 px** (7,5 ruutua). Yli 4 ruudun seinä tai yli 6 ruudun kuoppa
  tarvitsee lavan väliin. Tämä luku ratkaisee lähes kaikki kenttäsuunnittelubugit.
- **Kaikki nopeudet ovat pikseliä per frame** 60 Hz askeleella, eivät sekunnissa.
- **Taustakerrokset piirretään kerran välimuistiin.** `src/gfx/backdrop.js`
  maalaa vuoret, kukkulat ja linnakkeen seinän offscreen-nauhoiksi ja toistaa
  ne. Jos muutat nauhan sisältöä, muuta myös sen avainta — muuten vanha kuva
  jää elämään välimuistiin.
- **Sään hiukkasilla pitää olla eri siemen x- ja y-akselille.** Sama siemen
  molempiin latoo hiukkaset siistiin diagonaaliin ruudun poikki.
- **Ei kuvatiedostoja eikä build-vaihetta.** Kaikki grafiikka piirretään
  proseduraalisesti ja äänet syntetisoidaan WebAudiolla. Pidä se niin: se on
  syy miksi repo deployautuu staattisena ilman mitään työkaluketjua.
- **ES-moduulit vaativat http-palvelimen**, `file://` ei toimi.
- **localStorage-avaimet**: `sfb3.save.v2` (edistyminen) ja `sfb3.savestate.1..3`
  (pikatallennukset). Jos muutat tallennuksen muotoa, nosta versionumeroa —
  `normalizePower()` hoitaa vanhat merkkijonomuotoiset voimat.
- **`window.sfb3` on elävä Game-olio.** Konsolista pääsee käsiksi kaikkeen, ja
  testit ajavat peliä juuri sen kautta (`window.sfb3.scene.player` jne.).

## Mistä mitäkin löytyy

Tarkempi kartta on README:n lopussa. Lyhyesti:

```
src/main.js              pelisilmukka, kohtausvaihdot, pikatallennusnäppäimet
src/scenes/level.js      kenttämoottori: ruudukko, törmäykset, HUD
src/scenes/worldmap.js   maailmankarttamoottori
src/entities/player.js   voimamalli, fysiikka, kyvyt
src/entities/enemies.js  viholliset, vaarat, pomovariantit
src/data/chunks.js       kenttäpalikat (ASCII)
src/data/levels.js       kentät = lista palikoita
src/data/worlds.js       kartat, solmut, polut
src/core/savestate.js    tilatallennus + entiteettirekisteri
tools/verify.mjs         headless-tarkistus
```
