# Roadmap ja työlista

Tämä tiedosto on työn muisti: mitä on kesken, mitä seuraavaksi ja miksi.
Päivitä se kun tila muuttuu — älä luota siihen että konteksti muistaa.
Valmistuneet asiat siirtyvät [CHANGELOG.md](CHANGELOG.md):hen perusteluineen.

**Työtapa:** deployaa jokaisen pienenkin korjauksen jälkeen. Peliä pelataan
tuotannosta, joten korjaus joka odottaa committia ei hyödytä ketään. Portti
ennen pushia on `node tools/verify.mjs`.

---

## Työn alla

- [x] **Kamera**: kuollut alue + katse juoksusuuntaan. Ei inertiaa jarrutuksessa
      — se on se mikä tekee 2D-tasohyppelystä pahoinvoivan.
- [x] **Vokaalit** ("jee!", "hup", "oof") formanttisynteesillä, hyppyäänet
      satunnaistettuna 18 %:iin.
- [ ] **Telemetria** (ks. alla) — seuraava työ.

## Seuraavaksi

### 1. Telemetria ja palautesilmukka

Pelaajalta kysytään game overissa haluaako hän lähettää pelidatan kenttien
säätämiseen. Kerätään **vain anonyymiä**: kuolinpaikat, jumipaikat, ajat per
kenttä, voimataso kuollessa. Ei nimeä, ei pistetaulun nimimerkkiä — silloin
yksityisyyslupauksia ei tarvitse kirjoittaa, koska dataa ei voi yhdistää
kehenkään.

Vaiheet:
1. Paikallinen kirjaus localStorageen + lämpökartta debug-ruutuun. Nolla infraa.
2. Vientinappi (JSON), jonka voi syöttää generaattorille käsin.
3. Vercel-funktio + KV vastaanottoon, cron joka ajaa `gen-levels.mjs`:n
   päivitetyillä painoilla.

Vaihe 3 rikkoo "ei ajonaikaisia riippuvuuksia" -periaatteen, joten se on oma
päätöksensä. Vaiheet 1–2 eivät riko mitään.

### 2. Maailmojen 1–4 uudistus uudelle hyppybudjetille

`node tools/verify.mjs` tulostaa työlistan (SUUNNITTELUSAANNOT). Tilanne nyt:

| Rike | Missä |
| --- | --- |
| Ei tehostusta ensimmäisessä neljänneksessä | kaikissa 17 käsintehdyssä kentässä |
| Laattapolku johtaa tyhjään | 1–5 kpl per kenttä |
| Ei pääntilaa isoimmalle koolle | vain tehtaassa: 4-1 (4), 4-2 (8), 4-3 (8), 4-F (4) |

Huom: **yhtään kuilu- tai seinäriketta ei ole.** Uusi hyppybudjetti teki vanhoista
kentistä helpompia, ei rikkinäisiä — eli tämä on tasapainotustyötä. Ainoa aito
bugi on tehtaan pääntila: isoimmalla voimatasolla siellä on kohtia joihin ei
mahdu. **Korjaa se ensin.**

Järjestys: (a) tehtaan pääntila ✔, (b) tehostuspalikka jokaisen kentän alkuun ✔,
(c) tyhjät laattapolut ✔, (d) kuilujen levennys uudelle budjetille — **kesken**.

Kohdat a–c on tehty ja validaattori on puhdas kaikille 20 kentälle. Jäljellä on
vain tasapainotus: kuilut on mitoitettu vanhalle budjetille (6 ruutua), kun
juoksuhyppy kantaa nyt 12,5. Se ei riko mitään, mutta tekee kentistä helppoja.

### 3. Uudet ruututyypit: murenevat lavat ja kytkimet

Moottorissa on jo kaikki tarvittava, joten tämä on halpaa:

- **Ruudukko on muokattava** (`setTile`), ja `TILE_INFO` kartoittaa merkin
  ominaisuuksiksi — uusi tyyppi on yksi merkki ja yksi rivi taulukkoon.
- **`scene.bumps` on jo per-ruutu-ajastin** (Map avaimella `"tx,ty"`), ja
  **tilatallennus tallentaa sekä ruudukon että ajastimet** (`savestate.js:59,71`).
  Sama rakenne kelpaa murenemisajastimeksi sellaisenaan.

**Mureneva lava** (`%`): kiinteä ruutu, joka käynnistää ajastimen kun pelaaja
seisoo sen päällä. Ajastimen loppuessa `setTile(EMPTY)` ja `BrickPiece`-sirpaleet.
Piirto tärisyttää ruutua ajastimen edetessä, jotta varoitus on näkyvä — sama
periaate kuin putkikasvilla: *mikä voi satuttaa, sen pitää näkyä*.

**Kytkinruudut** (P-switch-tyyliin): **älä kirjoita ruudukkoa uusiksi.** Puhtaampi
tapa on käännöstaulu `tileAt()`:ssa: kun kytkin on päällä, tietyt merkit
luetaan toisina (esim. tiili ↔ kolikko). Silloin ruudukko pysyy muuttumattomana,
tilatallennus tarvitsee vain yhden totuusarvon, eikä kytkimen loppuminen voi
jättää kenttää rikkinäiseen välitilaan.

**Ylläpitokustannus, joka on syytä tietää etukäteen:** uusi merkki pitää lisätä
myös `src/data/rules.js`:n `SOLID`-joukkoon ja generaattorin sanastoon, tai
validaattori pitää murenevaa lavaa kuiluna ja generoi mahdottomia kenttiä.

## Myöhemmin

- **Kosketusohjaus.** Tietoisesti pöydällä: työpöytäkokemus ensin.
- **Lisää pomovariaatioita** — nyt neljä, ja 5-F on uusinta 4-F:stä.
- **Kenttäsäännöt käsintehdyille kentille pakollisiksi.** Nyt ne kaatavat ajon
  vain generoiduissa; kun maailmat 1–4 on korjattu, kytke sama koko peliin.
- **Nimen tavaramerkkiriski** ([DESIGN.md](DESIGN.md) kohta 2), jos peliä
  levitetään laajemmin tai siitä otetaan rahaa.

## Tiedossa olevat rajoitukset

- Botti `verify.mjs`:ssä osaa vain juosta ja hypätä, joten sen kuolemat
  vihollisiin ovat normaalia. Vain FAILURES-rivit merkitsevät.
- Pistetaulu on selainkohtainen (localStorage), ei jaettu laitteiden kesken.
- Rytmitilastojen louhinta vaatii ulkoisen korpuksen (`VGLC_DIR`), jota ei
  säilytetä repossa. Aja generaattori aina `VGLC_DIR` asetettuna, jotta
  samankaltaisuustarkistus on päällä.
