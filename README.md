# Super Fart Bros 3

Selaimessa pyörivä tasohyppelypeli Super Mario Bros. 3:n hengessä: oma
**maailmankarttamoottori** (solmut, polut, avautuvat reitit, papu­talot) ja oma
**kenttämoottori** (ruutupohjainen kenttä, fysiikka, viholliset, tehostukset,
maalikortti). Ei riippuvuuksia, ei buildia, ei kuvatiedostoja — kaikki grafiikka
ja äänet syntyvät ajossa.

## Käynnistys

ES-moduulit vaativat http-palvelimen, eli pelkkä `index.html` tiedostona ei riitä.

```bash
python3 -m http.server 8000
# avaa selaimessa http://localhost:8000
```

Mikä tahansa staattinen palvelin käy (`npx http-server`, `php -S`, ...).

## Näppäimet

| Näppäin | Toiminto |
| --- | --- |
| Nuolet / WASD | liikkuminen, kartalla solmusta toiseen |
| Z tai välilyönti | hyppy · kartalla mene kenttään |
| X tai vaihto | juoksu · pierupallo (kukka) · häntäisku (lehti) |
| Alas | kyykky · pudotus läpi puulavan |
| Enter | tauko kentässä · kartalla käytä varastoesine |
| M | äänet päälle/pois |

Peliohjain (standard gamepad) toimii myös.

## Pelin idea

* **Maailmoja on kolme** ja jokaisessa kolme kenttää, papu­talo ja linnake.
  Kentän läpäisy avaa siitä lähtevät polut; linnakkeen pomon kaato avaa
  seuraavan maailman.
* **Vauhtimittari (P)** täyttyy juostessa täyttä vauhtia. Täydellä mittarilla
  juokset nopeammin, ja lehtivoimalla pääset **lentoon**: hyppää, paina hyppyä
  uudelleen ilmassa ja räpyttele. Mittari tyhjenee lennon aikana.
* **Tehostukset**: papu (iso), pierukukka (ammu pierupalloja), kaasulehti
  (häntä, liito ja lento). Osuma pudottaa yhden tason kerrallaan ja pudottaa
  samalla varastoesineen kentälle.
* **Papu­talosta** valitset yhden esineen varastoon. Varastoesineen voi käyttää
  kartalla Enterillä.
* **Maalikortti**: kolme korttia antaa lisäelämiä, kolme samaa antaa enemmän.
* Sata kolikkoa = lisäelämä. Edistyminen tallentuu selaimen localStorageen.

## Koodin rakenne

```
index.html          canvas 320x240, skaalataan kokonaisluvuilla
src/main.js         pelisilmukka (kiinteä 60 Hz askel), tilat, tallennus
src/core/           syöte, ääni (WebAudio-syntetisaattori + musiikki), tallennus
src/gfx/            bittikarttafontti, ruudut, spritet, taustat
src/data/           kenttäpalikat, kentät, maailmankartat
src/entities/       pelaaja, viholliset, esineet, efektit
src/level/          fysiikka ja törmäykset
src/scenes/         alkuruutu, maailmankartta, kenttä, välikortit
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

Kenttä on lista palikoiden nimiä (`src/data/levels.js`):

```js
'1-1': {
  theme: 'grass', bg: 'hills', music: 'level', time: 300,
  chunks: ['start', 'flat', 'walker', 'qrow', /* ... */ 'goal', 'goal_end'],
},
```

Merkit: `#` maa, `X` kova palikka, `B` tiili, `?` kolikkolaatikko, `!`
tehostelaatikko, `o` kolikko, `-` puulava, `[] {}` putki, `^` piikit, `W` laava,
`N` nuottilaatikko, `F` maali, `D` linnakkeen ovi. Viholliset: `g` mönkijä,
`k` kilpikonna, `f` lentäjä, `p` putkikasvi, `b` pomo. Pelaajan aloituspaikka on `1`.

### Maailmankartan muokkaus

`src/data/worlds.js` sisältää jokaisen maailman maaston (20x9 ruutua),
solmut (`start`, `level`, `house`, `fortress`) ja niiden väliset polut.
Polulle voi antaa välipisteitä, jolloin siitä tulee kulmikas:

```js
{ a: 'w1-2', b: 'w1-3', path: [[10, 6]] },
```

Polku on kuljettavissa, kun jompikumpi pää on selvitetty.
