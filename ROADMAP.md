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
- [x] **Telemetria, vaiheet 1–2**: paikallinen kirjaus, lämpökartta, JSON-vienti.
- [x] **Kuvaefektit**: bloom, juovat, vinjetti ja WebGL-kuvaputki, esiasetukset
      näppäimessä 7, fallback testattuna. Jäljellä vain makuasiat, ks. kohta 1.

## Seuraavaksi

### 1. Kuvaefektit: WebGL-jälkikäsittely, ei uudelleenkirjoitusta

Kysymys oli "olisiko WebGL-rewrite liikaa". **Kokonaan uusi renderöijä on
liikaa** — piirtokoodia on tuhansia rivejä (`src/gfx/`, jokainen ruutu, sprite ja
tausta suorakaiteina) ja se pitäisi kirjoittaa uusiksi teksuuriatlaksena ja
verteksipuskureina saamatta yhtään uutta ominaisuutta. Nykyinen 320×240-piirto
maksaa mitatusti alle millisekunnin framessa, joten nopeusongelmaa ei ole,
ja shaderit ovat ainoa asia jota WebGL toisi.

**Hybridi on halpa ja antaa juuri sen shaderin.** Canvas 2D piirtää kuten nyt,
mutta näkyvä canvas onkin WebGL, joka lataa 2D-canvasin tekstuuriksi ja piirtää
sen yhtenä täysruudun kolmiona fragment-shaderin läpi. Työ on ~150 riviä ja yksi
tiedosto; koko `src/gfx/` pysyy koskemattomana. Efektit joita se antaa:

- CRT: skanviivat, varjomaski, reunan kaarevuus, vinjetti
- palettisiirto (yökenttä, vahinkovälähdys, pomon huoneen sävy)
- kuumuuden väreily aavikossa, aaltoilu veden alla, tärinä pomon iskuun
- vaalean hehkun bloom kolikoista ja tulipalloista

Ehdot: **fallback pakollinen** — jos `getContext('webgl2')` palauttaa nullin,
näytetään sama 2D-canvas suoraan. Peli ei saa mennä mustaksi ajurin takia.
`willReadFrequently` on käytössä vain 80×60-bloomkopiossa, jota luetaan joka
frame; pelin omalle canvasille se olisi väärä valinta, koska sitä kirjoitetaan
paljon enemmän kuin luetaan.

**Selaintuki.** WebGL 1 on käytännössä kaikkialla (Chrome, Firefox, Safari, Edge,
mobiiliselaimet) — se on ollut mukana vuodesta 2011. WebGL 2 on tuettu kaikissa
nykyselaimissa; viimeinen puuttuja oli Safari, joka sai sen iOS/macOS 15:ssä
(2021). Tälle pelille kumpikin riittää, koska tarvittava on yksi tekstuuri ja
yksi fragment-shader — WebGL 1 tekee sen ilman muuta.

Se mikä *oikeasti* kaataa WebGL:n ei ole selaimen versio vaan ajuri: estolistalle
joutunut näytönohjain, virtuaalikone ilman kiihdytystä, vanha Android, tai
selainasetus jossa laitteistokiihdytys on pois päältä. Silloin `getContext`
palauttaa nullin täysin ajantasaisessakin selaimessa. Siksi fallback ei ole
kohteliaisuus vanhoja selaimia kohtaan vaan pakollinen — ja siksi se testataan.

WebGPU sen sijaan olisi liian aikaista: Safarilla se tuli vasta 2025 ja Firefoxin
tuki on yhä osittainen. Se ei toisi tähän mitään mitä WebGL ei tekisi.

**Tehty** (v26.08.08.21, `src/gfx/postfx.js`): bloom luminanssikynnyksellä,
skanviivat, vinjetti, kaareva kuvaputki ja värivirhe shaderissa, esiasetukset
näppäimessä 7, valinta muistissa, fallback testattuna ja efektipassin
aikabudjetti vahdittuna (2,5 ms, toteuma 0,35 ms).

**Jäljellä — makuasiat ja kohdistetut efektit:**

1. **Kysy lapselta mikä esiasetus on oletus.** Hän on pääsuunnittelija, ja
   kuvaputki on makuasia jota kukaan ei voi päättää hänen puolestaan.
2. **Palettisiirto tapahtumiin**: vahinkovälähdys, pomon huoneen sävy, tähden
   välkyntä. Shaderiin yksi uniform lisää; 2D-tilassa `globalCompositeOperation`.
   Vaatii että efekti voidaan ajastaa framen tarkkuudella pelilogiikasta.
3. **Kuumuuden väreily aavikkoon ja aaltoilu veden alle.** Nämä ovat ne kaksi
   asiaa joita 2D-tila *ei* voi tehdä, eli ensimmäiset joissa WebGL näkyy
   sisältönä eikä pelkkänä suotimena. Silloin tarvitaan myös päätös siitä miltä
   sama kohta näyttää ilman WebGL:ää — mieluiten samalta, vain ilman väreilyä.
4. **Spritekohtaiset efektit eivät kuulu tähän tiedostoon.** Jälkikäsittely näkee
   vain valmiin kuvan eikä tiedä mikä pikseli oli mikäkin olio, joten kaikki
   "vain tämä sprite" -efektit tehdään piirtokoodissa.

   **Meillä on tähän epätavallisen hyvä lähtökohta: spritet ovat proseduraalisia.**
   Ne piirretään kokonaislukusuorakaiteina nimetyillä väreillä, ei bittikartoista,
   joten värin vaihtaminen on parametri eikä kuvankäsittelyä. Se mikä
   bittikarttapelissä vaatisi valmiiksi värjätyt kopiot jokaisesta ruudusta, on
   täällä yksi ylimääräinen argumentti `drawPlayer`/`drawEnemy`-funktioille:

   - **palettivaihto** (jäätynyt sininen, myrkytetty vihreä, pomon toinen väri):
     `tint`-parametri, joka korvaa väritaulun. Ilmainen ja pikselintarkka.
   - **hehkukehä** (tähti, tulipallo): sama sprite piirrettynä kerran isompana
     ja `globalCompositeOperation = 'lighter'` -tilassa taakse.
   - **läpikuultavuus** (haamu, vahingoittumattomuus): `globalAlpha`. Käytössä jo
     osittain vilkkumisessa.
   - **`ctx.filter = 'drop-shadow()'` per sprite: älä.** Se on framekohtainen
     suodin jokaiselle piirrolle, ja se maksaa moninkertaisesti sen mitä koko
     jälkikäsittelypassi.

   Sääntö: jos efekti koskee **yhtä oliota**, se kuuluu `src/gfx/sprites.js`:ään;
   jos se koskee **koko ruutua**, se kuuluu `postfx.js`:ään. Väliin ei jää mitään.

### 2. Telemetria ja palautesilmukka

Kerätään **vain anonyymiä**: kuolinpaikat, jumipaikat, ajat per kenttä, voimataso
kuollessa. Ei nimeä, ei pistetaulun nimimerkkiä — silloin yksityisyyslupauksia ei
tarvitse kirjoittaa, koska dataa ei voi yhdistää kehenkään.

Vaiheet:
1. ✔ Paikallinen kirjaus localStorageen + lämpökartta debug-ruutuun. Nolla infraa.
2. ✔ Vienti (näppäin 8) JSON-tiedostoksi, jonka voi syöttää generaattorille.
3. **Kesken:** generaattori lukee viedyn lokin ja säätää painoja sen mukaan.
   Tähän tarvitaan `gen-levels.mjs`:ään lippu `--telemetry tiedosto.json` ja
   sääntö sille *mitä* data muuttaa: kuolemakeskittymä leventää edeltävää
   lepotasannetta, jumikeskittymä madaltaa seuraavaa estettä. Huom: dataa pitää
   olla riittävästi ennen kuin se on signaalia — yhden pelaajan kymmenen kuolemaa
   samassa paikassa voi olla vain se että hän harjoitteli siinä kohtaa.
4. Vercel-funktio + KV vastaanottoon, cron joka ajaa generaattorin.

Vaihe 4 rikkoo "ei ajonaikaisia riippuvuuksia" -periaatteen ja vaatii sen
suostumuskysymyksen, jota vaiheet 1–3 eivät tarvitse. Se on oma päätöksensä.

### 3. Maailmojen 1–4 uudistus uudelle hyppybudjetille

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

Kohdat a–c on tehty ja **validaattori on puhdas kaikille 20 kentälle** — tästä
eteenpäin sääntörikkeen ilmestyminen on regressio, joten `verify.mjs`:n voi
kytkeä kaatamaan ajon myös käsintehdyistä kentistä. Jäljellä on
vain tasapainotus: kuilut on mitoitettu vanhalle budjetille (6 ruutua), kun
juoksuhyppy kantaa nyt 12,5. Se ei riko mitään, mutta tekee kentistä helppoja.

### 4. Uudet ruututyypit: murenevat lavat ja kytkimet

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

### 5. Pavunvarret ja piilotetut alueet

Yksi kenttä per maailma saa salaisen alueen: **pavunvarsi ylös taivaalle** ja
**putki alas maan alle**. Ei joka kenttään — löytö lakkaa olemasta löytö jos
sellainen on joka nurkassa.

**Avainoivallus: tähän ei tarvita kohtausvaihtoja.** Salainen alue mahtuu samaan
ruudukkoon, kunhan kenttä on korkeampi. Kamera osaa jo vierittää pystysuunnassa
(`cam.y` rajataan `heightPx - VIEW_H`:hon), joten 15 rivin sijaan 30 rivin kenttä
antaa yläpuolelle taivasalueen ja alapuolelle maanalaisen ilman yhtään uutta
kohtausta, uutta tallennuslogiikkaa tai siirtymäanimaatiota. Se on murto-osa siitä
työstä mitä erillinen bonushuone vaatisi — ja tilatallennus toimii sellaisenaan,
koska se tallentaa koko ruudukon.

Toteutusjärjestys:

1. **Kiipeilyruutu** `v` (pavunvarsi). `TILE_INFO`: `{ climb: true }`, ei kiinteä.
   Pelaajan `update`:een kiipeilytila: kun ruutu on `climb` ja ylös/alas on
   pohjassa, painovoima pois ja pystyliike vakionopeudella. Hyppy irrottaa.
2. **Palikoiden pinoaminen.** `assemble()` rakentaa nyt 15 riviä. Lisätään
   `assembleTall(main, sky, cave)`, joka liimaa kolme 15 rivin kaistaa
   päällekkäin ja palauttaa 45 riviä. Kentän `rows` vain kasvaa — moottori ei
   tiedä eroa.
3. **Pavunvarsipalikka**: `?`-lohko joka pudottaa pavun, ja pavusta kasvava
   varsi (animoitu ruudun kirjoitus `setTile`illä ylöspäin). Yksinkertaisempi
   ensiversio: varsi on valmiiksi kentässä.
4. **Putki alas**: `pipe_down`-merkki joka teleporttaa pelaajan luolakaistan
   vastaavaan kohtaan. Sama ruudukko, joten se on pelkkä `player.y += 15 * TILE`.

**Muista** (ks. [DESIGN.md](DESIGN.md) kohta 6): uusi merkki pitää lisätä `src/data/rules.js`:n
tauluihin, tai validaattori pitää taivasaluetta yhtenä valtavana kuiluna ja
hylkää jokaisen kentän. Todennäköisesti sääntöjen pitää katsoa vain
pääkaistaa — se on tämän työn kiperin kohta ja kannattaa ratkaista ensin.

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
