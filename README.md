# Super Fart Bros 3

Selaimessa pyörivä tasohyppelypeli Super Mario Bros. 3:n hengessä: oma
**maailmankarttamoottori** (solmut, polut, avautuvat reitit, hernetalot) ja oma
**kenttämoottori** (ruutupohjainen kenttä, fysiikka, viholliset, viisiportaiset
tehostukset, maalikortti). Ei riippuvuuksia, ei buildia, ei kuvatiedostoja —
kaikki grafiikka ja äänet syntyvät ajossa.

## Käynnistys

ES-moduulit vaativat http-palvelimen, eli pelkkä `index.html` tiedostona ei riitä.

```bash
python3 -m http.server 8000
# avaa selaimessa http://localhost:8000
```

Mikä tahansa staattinen palvelin käy (`npx http-server`, `php -S`, ...).

## Julkaisu Verceliin

Repo on staattinen sivusto ilman build-vaihetta, ja `vercel.json` kertoo sen
Vercelille. Julkaisu onnistuu suoraan repon juuresta:

```bash
git fetch origin && git checkout claude/super-fart-bros-3-wmbbku
python3 -m http.server 8000   # tarkista paikallisesti ensin

vercel          # ensimmäinen ajo luo projektin ja antaa esikatselu-URLin
vercel --prod   # tuotantoon
```

Ensimmäisellä kerralla CLI kysyy muutaman asian. Vastaukset:

| Kysymys | Vastaus |
| --- | --- |
| Set up and deploy? | **Y** |
| Link to existing project? | **N** |
| Project name | `sfb3` (tai mikä tahansa) |
| In which directory is your code located? | `./` |
| Want to modify these settings? | **N** — `vercel.json` hoitaa asetukset |

`vercel` lataa työhakemiston sellaisenaan, joten haaralla ei ole väliä: voit
julkaista suoraan kehityshaarasta. CLI luo paikallisen `.vercel/`-hakemiston,
joka on `.gitignore`ssa.

Jos haluat automaattiset julkaisut jokaisesta pushista (ja esikatselu-URLit
pull requesteille), kytke repo Vercelin hallinnasta: Add New → Project →
import `sfb3`. Frameworkiksi **Other**, build-komento tyhjäksi ja
output-hakemistoksi `.`.

## Jatkokehitys

`HANDOFF.md` kertoo missä työ on kesken, mitä on jo todennettu ja mihin
moottorissa on helppo kompastua.

## Testit

Repossa on headless-tarkistus, joka tarjoilee sivuston itse, ajaa botin läpi
jokaisen kentän ja tarkistaa mekaniikat ja tilatallennuksen:

```bash
npm i -D playwright && npx playwright install chromium
node tools/verify.mjs
```

Se listaa jokaisen kentän, kuinka pitkälle botti pääsi ja mihin se kaatui, ja
palauttaa nollasta poikkeavan paluuarvon jos jokin menee rikki (konsolivirhe,
kenttä ei lataudu, aloituspaikka seinän sisällä, mekaniikkatesti pettää).
Botti osaa vain juosta ja hypätä, joten sen kuolemat vihollisiin ovat normaalia
— merkitseviä ovat FAILURES-listan rivit.

## Näppäimet

| Näppäin | Toiminto |
| --- | --- |
| Nuolet / WASD | liikkuminen, kartalla solmusta toiseen |
| Z tai välilyönti | hyppy · **ilmassa uudestaan = pierupomppu** · kartalla mene kenttään |
| X tai vaihto | juoksu · pierupallo (kukka) · häntäisku (lehti) |
| Alas | kyykky · pudotus läpi puulavan |
| Enter | tauko kentässä · kartalla käytä varastoesine |
| M | äänet päälle/pois |
| K / L | tallenna tila / lataa tila (kuten emulaattorissa); myös F5 / F8 |
| J | vaihda tallennuspaikkaa (1–3); myös F6 |
| I tai ` | debug-ruutu: fps, entiteetit, pelaajan tila |

Peliohjain (standard gamepad) toimii myös.

## Voimatasot 1–5

Tehostukset kasautuvat: jokainen kerätty tehostus nostaa tasoa yhdellä (max 5),
ja **jokainen taso kasvattaa hahmoa ja vahvistaa sitä ominaisuutta**, jonka
tehostus antaa. Osuma pudottaa yhden tason kerrallaan — tasolla 0 osuma tappaa.

| Tehostus | Ominaisuus | Mitä taso tekee |
| --- | --- | --- |
| **Pierusieni** | tuplahyppy: hyppää ilmassa uudelleen ja pieru nostaa ylemmäs | tasoja vastaava määrä ilmahyppyjä (taso 5 = 5 kpl) |
| **Pierukukka** | ammu pierupalloja | enemmän palloja kerralla (3+) ja enemmän yhtä aikaa ilmassa |
| **Kaasulehti** | häntäisku, liito ja lento täydellä vauhtimittarilla | pidempi lento, pidempi häntä, hitaampi liito |
| **Hernekeitto** | +1 taso nykyiseen voimaan | parantaa myös ummetuksen |

Ilmapierun purkaus kaataa myös alapuolella olevat viholliset, ja tasolta 4
ylöspäin hahmo jyrää tiiliä juoksemalla niiden läpi.

## Vaarat: ummetus ja närästys

* **Ummetuskorkki** ei vahingoita vaan **korkkaa**: kaikki kaasuvoimat (tuplahyppy,
  pierupallot, lento, häntä) menevät poikki muutamaksi sekunniksi. HUD näyttää
  laskurin. Hernekeitto tai mikä tahansa tehostus avaa korkin heti.
* **Närästys** on lattiasta purkautuva liekkisuihku. Se varoittaa välähdyksellä
  ennen syöksyä, joten se on ajoituspulma — mutta osuma polttaa yhden voimatason.
* **Ruskeat pilvet** leijuvat ilmassa ja ajelehtivat pelaajaa kohti. Ne voi
  tömäyttää tai pierupallottaa pois.
* **Vihainen aurinko** roikkuu aavikon taivaalla pelaajan vieressä ja syöksyy
  aika ajoin kaaressa hänen lävitseen. Sitä ei voi tömäyttää, mutta kolme
  pierupalloa tai häntäiskua sammuttaa sen.

## Maailmat

| Maailma | Teema | Pomo |
| --- | --- | --- |
| 1 PAPULAAKSO | niityt | Linnakkeen pomo — kävelee ja hyppii |
| 2 HIKIHIEKKA | aavikko | sama pomo uutena versiona: laskeutuminen synnyttää maa-aaltoja |
| 3 JÄÄTÄVÄ VETO | jää | nopeampi versio, joka syöksyy pelaajaa kohti |
| 4 PIERUTEHDAS | tehdas | **PIERUPRINSSI**, joka pullistuu jokaisesta osumasta aina 3-kertaiseksi |

Jokaisessa maailmassa on kolme kenttää, hernetalo ja linnake. Kentän läpäisy avaa
siitä lähtevät polut; linnakkeen pomon kaato avaa seuraavan maailman.

Muuta: vauhtimittari (P) täyttyy juostessa, sata kolikkoa on lisäelämä, kolme
maalikorttia antaa lisäelämiä ja edistyminen tallentuu localStorageen.

## Koodin rakenne

```
index.html          canvas 320x240, skaalataan kokonaisluvuilla
vercel.json         staattinen julkaisu ilman buildia
src/main.js         pelisilmukka (kiinteä 60 Hz askel), tilat, pikatallennus
src/core/           syöte, ääni (WebAudio), tallennus, tilatallennus
src/gfx/            bittikarttafontti, ruudut, spritet, taustat
src/data/           kenttäpalikat, kentät, maailmankartat
src/entities/       pelaaja, viholliset, esineet, efektit
src/level/          fysiikka ja törmäykset
src/scenes/         alkuruutu, maailmankartta, kenttä, välikortit
```

### Tilatallennus

`src/core/savestate.js` ottaa tilannevedoksen koko pelistä: kenttäruudukko,
kaikki entiteetit, pelaaja, kamera, kello ja pelitila. Entiteetit sarjallistuvat
yleisesti (kaikki omat kentät paitsi viittaus kenttäolioon) ja herätetään
tiedoston `REGISTRY`-taulun avulla — uusi vihollistyyppi tarvitsee vain rivin
siihen tauluun.

### Kenttien tekeminen

Kentät kootaan 15 rivin **palikoista** (`src/data/chunks.js`), jolloin sarakkeet
osuvat aina kohdalleen. Palikka kirjoitetaan harvana rivikarttana:

```js
pipe_short: ck(16, {
  11: '     []',
  12: '     {}',
  13: '################',
  14: '################',
}),
```

Kenttä on lista palikoiden nimiä (`src/data/levels.js`):

```js
'1-1': {
  theme: 'grass', bg: 'hills', music: 'level', time: 300,
  chunks: ['start', 'flat', 'walker', 'qrow', /* ... */ 'goal', 'goal_end'],
},
```

Merkit: `#` maa, `X` kova palikka, `B` tiili, `?` kolikkolaatikko, `!`
tehostelaatikko, `o` kolikko, `-` puulava, `[] {}` putki, `^` piikit, `W` laava,
`N` nuottilaatikko, `F` maali, `D` linnakkeen ovi. Viholliset ja vaarat: `g`
mönkijä, `k` kilpikonna, `f` lentäjä, `p` putkikasvi, `r` ruskea pilvi, `c`
ummetuskorkki, `A` vihainen aurinko, `H` närästys, `b` pomo. Pelaajan aloituspaikka on `1`.

Linnakkeen pomon liikesarja tulee kentän `bossVariant`-kentästä (0–3).

### Maailmankartan muokkaus

`src/data/worlds.js` sisältää jokaisen maailman maaston (20x9 ruutua),
solmut (`start`, `level`, `house`, `fortress`) ja niiden väliset polut.
Polulle voi antaa välipisteitä, jolloin siitä tulee kulmikas:

```js
{ a: 'w1-2', b: 'w1-3', path: [[10, 6]] },
```

Polku on kuljettavissa, kun jompikumpi pää on selvitetty.
