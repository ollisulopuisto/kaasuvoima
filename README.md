# Super Fart Bros 3

Selaimessa pyörivä tasohyppely: oma **maailmankarttamoottori** (solmut, polut,
avautuvat reitit, hernetalot) ja oma **kenttämoottori** (ruutupohjainen kenttä,
alipikselifysiikka, viholliset, viisiportaiset tehostukset, maalikortti).

Ei riippuvuuksia, ei build-vaihetta, ei kuva- tai äänitiedostoja — kaikki
grafiikka piirretään ja kaikki äänet syntetisoidaan ajossa.

**Pelattavissa: <https://sfb3.vercel.app>**

| Dokumentti | Sisältö |
| --- | --- |
| [DESIGN.md](DESIGN.md) | suunnitteluperiaatteet, kenttäsuunnittelun säännöt ja sisällön alkuperä |
| [CHANGELOG.md](CHANGELOG.md) | muutokset perusteluineen (CalVer) |
| [PHYSICS.md](PHYSICS.md) | liikkeen vakiot ja mitattu hyppybudjetti |

Moottorin kompastuskivet ovat [DESIGN.md](DESIGN.md):n kohdassa 6 — lue ne
ennen kuin muutat moottoria.

---

## Käynnistys

ES-moduulit vaativat http-palvelimen, eli `index.html` suoraan tiedostona ei riitä.

```bash
python3 -m http.server 8000    # tai npm start
# http://localhost:8000
```

## Näppäimet

Molemmat käsijärjestykset ovat käytössä yhtä aikaa, eli mitään tilaa ei tarvitse
valita. Näppäimet luetaan fyysisinä paikkoina (`event.code`), joten
näppäimistöasettelu ei siirrä niitä.

| Toiminto | Ohjaus oikealla kädellä | Ohjaus vasemmalla kädellä |
| --- | --- | --- |
| Liikkuminen | nuolet | W A S D |
| Hyppy | **Z** tai välilyönti | **L** tai **.** tai välilyönti |
| Juoksu / pieru | **X** tai vaihto | **K** tai **,** |

| Näppäin | Toiminto |
| --- | --- |
| hyppy ilmassa uudestaan | **pierupomppu** (pierusieni) |
| juoksunäppäin | pierupallo (kukka) · häntäisku (lehti) |
| alas | kyykky · pudotus puulavan läpi |
| Enter | tauko kentässä · kartalla käytä varastoesine |
| M tai 0 | äänet päälle/pois |
| 1 / 2 | tallenna tila / lataa tila |
| 3 | vaihda tallennuspaikkaa (1–3) |
| 6 | kosketusohjaus esiin / vaihda malli |
| 7 | kuvaefektit: ei efektejä → hehku → kuvaputki |
| 8 | vie pelidata tiedostoon (JSON) |
| 9 | debug-ruutu: fps, framebudjetti, entiteetit, pelaajan tila, soiva raita, lämpökartta |

F5 / F8 / F6 / F3 toimivat myös, jos käyttöjärjestelmä ei vie niitä — macOS vie.

Apuvälineet ovat numerorivillä eivätkä missään muualla. `event.code` on
fyysinen paikka, mutta **mikä fyysinen paikka riippuu siitä onko näppäimistö
ANSI vai ISO**, ja ne eroavat juuri vasemmasta alakulmasta jossa toimintonäppäimet
ovat. Debug oli aiemmin myös `Backquote`illa, joka on Macin ISO-näppäimistöllä
vasemman vaihdon ja Z:n välissä — yhden näppäimen päässä hypystä.
Peliohjain (standard gamepad) toimii.

## Pisteet, kolikot ja mittarit

Mistä pisteitä tulee ja mitä ne tekevät:

| Teko | Pisteet | Muu vaikutus |
| --- | --- | --- |
| Kolikko | 200 | **100 kolikkoa = lisäelämä**, laskuri nollautuu sadalla |
| Mönkijän tallaus | 100 | |
| Kilpikonna | 100 | jää kuoreksi, jonka voi potkaista |
| Lentäjä, ruskea pilvi, ummetuskorkki | 200 | |
| Tiilen rikkominen | 50 | |
| Tehostuksen poiminta | 1000 | täydellä voimalla se menee varastoon |
| Hernekeitto täydellä voimalla | 5000 | |
| Pomon kaato | 5000–8000 | avaa linnakkeen oven |
| Kentän läpäisy | jäljellä oleva **aika × 50** | eli nopeus palkitaan |

Pisteet näkyvät HUDissa, kartalla ja lopputekstissä, ja pelin päätyttyä ne
menevät **pistetauluun** (10 parasta, oma nimi). Jos ajon aikana on ladattu
tilatallennus, nimen perässä on tähti — kelattu suoritus ei kuulu samaan
sarakkeeseen kelaamattoman kanssa ilman merkintää.

**Maalikortit:** jokaisesta läpäistystä kentästä saa kortin. Kolme korttia
laukeaa: kolme samaa antaa 2 (sieni), 3 (kukka) tai 5 (tähti) lisäelämää,
sekalainen kolmikko yhden.

**Vauhtimittari (P)** täyttyy kun juokset maassa täydellä juoksuvauhdilla:
seitsemän pykälää, kukin kahdeksan framea, eli alle sekunnissa. Ilmassa mittari
jäätyy — paitsi lehden lennon aikana, jolloin se valuu ja lento loppuu kun se
tyhjenee. Maassa se valuu hitaammin kuin täyttyy (24 framea per pykälä). Täysi
mittari tekee kaksi asiaa:

1. **Nopeuskatto nousee** juoksuvauhdista 2,5 → 3,5 pikseliin per frame.
2. **Kaasulehdellä se avaa lennon** — täydellä mittarilla hyppy lähtee lentoon.

Mittari ei vaikuta pierupomppuun: se tulee voimatasosta, ei vauhdista.

**Aika** kuluu yhden yksikön 24 framessa. Kentän kello lasketaan kentän
pituudesta, joten pitkä kenttä saa pidemmän ajan. Alle sadassa musiikki alkaa
kiirehtiä.

## Voimatasot 1–5

Tehostukset kasautuvat: jokainen kerätty tehostus nostaa tasoa yhdellä (max 5),
ja **jokainen taso kasvattaa hahmoa ja vahvistaa sitä ominaisuutta**, jonka
tehostus antaa. Osuma pudottaa yhden tason — tasolla 0 osuma tappaa.

| Tehostus | Ominaisuus | Mitä taso tekee |
| --- | --- | --- |
| **Pierusieni** | tuplahyppy: hyppää ilmassa uudelleen ja pieru nostaa ylemmäs | tasoja vastaava määrä ilmahyppyjä (taso 5 = 5 kpl) |
| **Pierukukka** | ammu pierupalloja | enemmän palloja kerralla ja yhtä aikaa ilmassa |
| **Kaasulehti** | häntäisku, liito ja lento täydellä vauhtimittarilla | pidempi lento, pidempi häntäisku |
| **Hernekeitto** | +1 taso nykyiseen voimaan | parantaa myös ummetuksen |

Ilmapierun purkaus kaataa alapuolella olevat viholliset, ja tasolta 4 ylöspäin
hahmo jyrää tiiliä juoksemalla niiden läpi.

Tehostus ei ole koskaan pakollinen: **maareitti on läpäistävissä pienimmällä
koolla**, ja pierupomppu avaa korkeat reitit ja palkinnot. Generoiduissa
kentissä tämä on koneellisesti tarkistettu; käsintehdyissä se on
suunnitteluperiaate, ei automaattinen takuu. Ks. [DESIGN.md](DESIGN.md) kohta 5.

## Vaarat

* **Ummetuskorkki** ei vahingoita vaan **korkkaa**: kaikki kaasuvoimat
  (tuplahyppy, pierupallot, lento, häntä) menevät poikki muutamaksi sekunniksi.
  HUD näyttää laskurin. Hernekeitto tai mikä tahansa tehostus avaa korkin heti.
* **Närästys** on lattiasta purkautuva liekkisuihku. Se varoittaa välähdyksellä
  ennen syöksyä, joten se on ajoituspulma — osuma polttaa yhden voimatason.
* **Ruskeat pilvet** leijuvat ilmassa ja ajelehtivat pelaajaa kohti.
* **Vihainen aurinko** roikkuu aavikon taivaalla ja syöksyy kaaressa pelaajan
  lävitse. Sitä ei voi tömäyttää; kolme pierupalloa tai häntäiskua sammuttaa sen.
* **Putkikasvi** nousee putkesta. Se ei nouse jos seisot putken päällä, ja se voi
  satuttaa vasta kun siitä on vähintään puoli ruutua näkyvissä.

## Maailmat

| Maailma | Teema | Pomo |
| --- | --- | --- |
| 1 PAPULAAKSO | niityt | linnakkeen pomo: kävelee ja hyppii |
| 2 HIKIHIEKKA | aavikko | sama pomo uutena versiona: laskeutuminen synnyttää maa-aaltoja |
| 3 JÄÄTÄVÄ VETO | jää | nopeampi versio, joka syöksyy pelaajaa kohti |
| 4 PIERUTEHDAS | tehdas | **PIERUPRINSSI**, joka pullistuu jokaisesta osumasta 3-kertaiseksi |
| 5 JÄLKIPYYKKI | sekateema | uusintaottelu prinssin kanssa |

Jokaisessa maailmassa on kolme kenttää, hernetalo ja linnake. Kentän läpäisy avaa
siitä lähtevät polut; linnakkeen pomon kaato avaa seuraavan maailman.

Maailman 5 kentät 5-1…5-3 ovat **generoituja**: rytmi tulee mitatuista
tilastoista, palikat pelin omasta sanastosta. Linnake 5-F on käsintehty kuten
muutkin linnakkeet. Ks. [DESIGN.md](DESIGN.md) kohta 3.

## Työkalut

```bash
npm i -D playwright && npx playwright install chromium   # kerran

node tools/verify.mjs        # headless-tarkistus: kaikki kentät + mekaniikat
node tools/playable.mjs      # pelkkä geometria: onko kentät läpäistävissä ilman tehostuksia
node tools/measure-jump.mjs  # mittaa hyppybudjetin ajamalla hypyt moottorissa
node tools/gen-levels.mjs    # generoi maailman 5 kentät tilastoista
node tools/gen-levels.mjs --telemetry loki.json   # ...ja säätää niitä pelidatan mukaan
node tools/make-card.mjs     # päivittää linkkien esikatselukuvan card.png
```

`verify.mjs` tarjoilee sivuston itse, ajaa botin läpi jokaisen kentän ja
tarkistaa mekaniikat, tilatallennuksen, pistetaulun, grafiikan ja äänet. Se
palauttaa nollasta poikkeavan paluuarvon jos jokin menee rikki. Botti osaa vain
juosta ja hypätä, joten sen kuolemat vihollisiin ovat normaalia — merkitseviä
ovat FAILURES-listan rivit.

**Generoitujen kenttien siemen valitaan mittaamalla.** Aja generaattori usealla
siemenellä ja päästä läpi vain se jolla kaikki kentät menevät `playable.mjs`:ssä
läpi voimatasolla 0 — muuten "uudet kentät" tarkoittaa tuntemattoman laatuisia
kenttiä. Maailman 5 nykyinen siemen on **60606**, ja se valittiin näin.

`playable.mjs` kysyy yhden asian: onko *maasto* läpäistävissä. Se poistaa kaikki
viholliset ja vaarat ja ajaa botin läpi kahdesti — kerran voimatasolla 0
(suunnittelulupaus: maareitin pitää aueta pienimmällä koolla) ja kerran
tuplahypyllä. Ero näiden välillä kertoo onko kenttä rikki vai vain vaativa.

Se **ei kaada ajoa** ilman `--strict`-lippua, ja syy on tärkeä: botti osaa vain
juosta oikealle ja hypätä. Se ei osaa hypellä kelluvalta lavalta toiselle, mennä
kyykkyyn, käyttää putkia, potkia kuorta eikä odottaa liikkuvaa lavaa. Useampi
kenttä on rakennettu juuri niiden varaan, ja silloin botin "umpikuja" on botin
rajoitus. Heuristiikka joka kaataisi ajon johtaisi käsintehtyjen kenttien
korjaamiseen huonon botin mieliksi — se on väärinpäin.

Rytmitilastojen louhinta vaatii ulkoisen korpuksen, jota **ei säilytetä
repossa**:

```bash
git clone --depth 1 https://github.com/TheVGLC/TheVGLC /tmp/vglc
VGLC_DIR="/tmp/vglc/Super Mario Bros/Processed" node tools/mine-pacing.mjs
```

## Salaisuudet

Maailman 1 kenttä 1-2 on **45 riviä korkea**: pilvien yllä on taivaskaista ja
maan alla suljettu luolahuone. Kumpaankaan ei tarvita kohtausvaihtoja — sama
ruudukko, korkeampi kenttä, ja kamera pysyy siinä kaistassa jossa pelaajan jalat
ovat.

- **Pavunvarsi** (`v`) sarakkeessa 150: pidä ylös pohjassa kiivetäksesi. Hyppy
  irrottaa. Takaisin pääsee kävelemällä lavan reunan yli.
- **Lämpöputki** (`(` `)`) sarakkeessa 229: paina alas seistessäsi sen päällä.
  Luolan poistumisputkesta pääsee ylös painamalla ylös.

Kumpikaan ei ole matkalla maaliin, ja `tools/playable.mjs` vahvistaa että 1-2
menee yhä läpi pienimmällä koolla ilman kumpaakaan.

## Kosketusohjaus

Ohjaimet ilmestyvät **vasta ensimmäisestä oikeasta kosketuksesta** — moni
kannettava ilmoittaa kosketustuen jota kukaan ei käytä, eikä sellaiselle
koneelle kannata piirtää ristiohjainta pelin päälle. Työpöydällä ne saa esiin
näppäimellä **6** tai osoitteella `?touch=1`.

Kaksi mallia, ja **6** (tai OHJAUS-painike) vaihtaa niiden välillä:

| Malli | Miten |
| --- | --- |
| `näppäimet` | Näkyvä ristiohjain vasemmalla, Z ja X oikealla. Tarkka, mutta vie ruudun alaosan. |
| `peukalot` | Ei näkyviä nappeja. Vasen puoli on sauva joka ilmestyy siihen mihin peukalo osuu, oikean puolen alaosa hyppää ja yläosa pieruttaa. |

Kumpi on parempi, ei ratkea pöydän ääressä, joten molemmat ovat mukana ja
valinta muistetaan.

Toteutuksen kolme sääntöä, jotka säästävät eniten harmia:
- **Osumatarkistus on omaa koodia**, ei DOM-nappeja. Selain ei lähetä
  `pointerleave`ia kun peukalo liukuu napilta pois, eikä ristiohjain jolla ei
  voi rullata peukaloa ole ristiohjain.
- **Jokainen sormi seurataan `pointerId`:llä.** Ohjaus + juoksu + hyppy on kolme
  sormea, ja yhdenkin pudottaminen tuntuu pelin jumittumiselta.
- **`touch-action: none`**, tai Android tekee hypystä sivun vierityksen.

## Kuvaefektit

Näppäin **7** kiertää kolme esiasetusta:

| Esiasetus | Mitä tekee |
| --- | --- |
| `pois` | ei mitään — sama kuva kuin ennen efektejä |
| `hehku` | bloom: kirkkaat asiat (aurinko, kolikot, tulipallot) hehkuvat |
| `kuvaputki` | bloom + juovat + vinjetti, ja WebGL:llä myös kaareva ruutu ja värivirhe |

Peli **piirtää edelleen Canvas 2D:llä**. WebGL:ää käytetään vain valmiin
320×240-kuvan esittämiseen shaderin läpi, eikä `src/gfx/` tiedä siitä mitään.
Koko renderöijän kirjoittaminen WebGL:llä harkittiin ja hylättiin: piirtokoodi
maksaa alle millisekunnin framessa, joten uudelleenkirjoitus ei toisi muuta kuin
shaderit — ja shaderit saa näinkin.

**Jos WebGL ei ole käytettävissä, peli toimii silti.** `getContext('webgl2')`
palauttaa nullin estolistatulla näytönohjaimella, virtuaalikoneessa ja aina kun
laitteistokiihdytys on pois päältä — myös täysin ajantasaisessa selaimessa.
Silloin bloom, juovat ja vinjetti piirretään Canvas 2D:llä ja vain kaarevuus
jää pois. `verify.mjs` tynkää WebGL-kontekstin pois ja tarkistaa tämän joka
ajolla: fallback jota ei testata ei ole fallback.

Efektipassi mitataan samalla: budjetti on 2,5 ms framessa, toteuma ~0,35 ms.

## Pelidata ja yksityisyys

Peli kirjaa **selaimen omaan muistiin** (localStorage) sen mihin pelaaja kuolee,
missä hän jää jumiin ja kuinka kauan kenttä kesti. Tarkoitus on yksi: nähdä missä
kentät oikeasti kaatavat pelaajan — sitä ei näe pelaamalla omia kenttiään.

Kaksi asiaa, joiden varaan koko kirjaus on rakennettu:

- **Anonyymi rakenteeltaan.** Tallennettuna on kentän tunnus, ruutukoordinaatti,
  kuolinsyy ja voimataso. Ei nimeä, ei kellonaikaa, ei tunnistetta. Dataa ei siis
  voi yhdistää kehenkään, joten mitään lupausta ei tarvitse antaa eikä pitää.
- **Mikään ei lähde selaimesta.** `src/core/telemetry.js`:ssä ei ole yhtään
  verkkokutsua, ja `verify.mjs` tarkistaa sen jokaisella ajolla. Vienti on
  tiedosto, jonka pelaaja itse antaa eteenpäin.

Debug-ruudussa (**9**) kentän päälle piirtyy lämpökartta: punaiset pylväät ovat
kuolemia, siniset viivat alalaidassa jumipaikkoja. **8** vie datan JSON-tiedostoon.
Konsolista: `sfb3.telemetry.summary('1-1')` ja `sfb3.telemetry.clear()`.

## Julkaisu

Repo on staattinen sivusto ilman build-vaihetta. `main`-haaran push julkaisee
automaattisesti Verceliin; `vercel.json` asettaa frameworkin tyhjäksi ja ohittaa
asennusvaiheen, koska `package.json` on olemassa vain kehitystyökaluja varten.

```bash
vercel --prod   # käsin, jos automaattinen julkaisu ei ole käytössä
```

## Koodin rakenne

```
index.html          canvas 320x240, skaalataan kokonaisluvuilla
src/main.js         pelisilmukka (kiinteä 60 Hz askel), tilat, debug-ruutu
src/core/           syöte, kosketus, ääni (WebAudio), tallennus, tilatallennus, pistetaulu, telemetria
src/gfx/            bittikarttafontti, ruudut, spritet, taustat, kuvaefektit
src/data/           kenttäpalikat, kentät, generoidut kentät, maailmankartat
src/entities/       pelaaja, viholliset, esineet, efektit
src/level/          fysiikka ja törmäykset
src/scenes/         alkuruutu, maailmankartta, kenttä, välikortit, pistetaulu
tools/              verify, hyppymittaus, tilastolouhinta, kenttägenerointi
```

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

Kenttä on lista palikoiden nimiä (`src/data/levels.js`). `time` on valinnainen —
ilman sitä kello lasketaan kentän pituudesta:

```js
'1-1': {
  theme: 'grass', bg: 'hills', music: 'level',
  chunks: ['start', 'flat', 'walker', 'qrow', /* ... */ 'goal', 'goal_end'],
},
```

Merkit: `#` maa, `X` kova palikka, `B` tiili, `?` kolikkolaatikko, `!`
tehostelaatikko, `o` kolikko, `-` puulava, `[] {}` putki, `^` piikit, `W` laava,
`N` nuottilaatikko, `F` maali, `D` linnakkeen ovi. Viholliset ja vaarat: `g`
mönkijä, `k` kilpikonna, `f` lentäjä, `p` putkikasvi, `r` ruskea pilvi, `c`
ummetuskorkki, `A` vihainen aurinko, `H` närästys, `b` pomo. Aloituspaikka on `1`.

Linnakkeen pomon liikesarja tulee kentän `bossVariant`-kentästä (0–3).

### Maailmankartan muokkaus

`src/data/worlds.js` sisältää jokaisen maailman maaston (20x9 ruutua), solmut
(`start`, `level`, `house`, `fortress`) ja niiden väliset polut. Polulle voi
antaa välipisteitä, jolloin siitä tulee kulmikas:

```js
{ a: 'w1-2', b: 'w1-3', path: [[10, 6]] },
```

Polku on kuljettavissa, kun jompikumpi pää on selvitetty.

### Tilatallennus

`src/core/savestate.js` ottaa tilannevedoksen koko pelistä: kenttäruudukko,
kaikki entiteetit, pelaaja, kamera, kello ja pelitila. Entiteetit sarjallistuvat
yleisesti ja herätetään `REGISTRY`-taulun avulla — uusi vihollistyyppi tarvitsee
vain rivin siihen tauluun.
