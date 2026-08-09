# Roadmap ja työlista

Tämä tiedosto on työn muisti: mitä on kesken, mitä seuraavaksi ja miksi.
Päivitä se kun tila muuttuu — älä luota siihen että konteksti muistaa.
Valmistuneet asiat siirtyvät [CHANGELOG.md](CHANGELOG.md):hen perusteluineen.

**Työtapa:** deployaa jokaisen pienenkin korjauksen jälkeen. Peliä pelataan
tuotannosta, joten korjaus joka odottaa committia ei hyödytä ketään. Portti
ennen pushia on `node tools/verify.mjs`.

---

## Tila 9.8.2026

Kaikki alla oleva on tuotannossa ja testattu. `node tools/verify.mjs` on portti,
`node tools/playable.mjs` tarkistaa geometrian ja `node tools/difficulty.mjs`
vaikeuskäyrän.

**Mekaniikat:** kuplaloukku (pallo vangitsee, puhkaisu tappaa, karkaava vihu
vihastuu) · supertähti (kuolemattomuus vihollisille ja maan piikeille, ei
kuopalle/laavalle/kellolle) · kytkinruudut · murenevat lavat · pavunvarsi ja
warp-putki (45 rivin kenttä) · salaisuudet tavallisissa tiilissä (29 kpl) ·
piikkiukko · pomon determinististä piikkisykli.

**Sisältö:** maailma 5 generoitu uusiksi (siemen valittu mittaamalla) ·
vaikeuskäyrä nousee joka maailmassa, tasan yksi notko per maailma ·
nyrkkeilijäpomo · jäätikkö laavan tilalle jäämaailmassa · kaksoisovet ·
voittoruutu hernekeitolla · sirppikuu.

**Esitys:** kuvaputki varjomaskilla ja vaakavuodolla · kenttäkohtainen tunnelma ·
kosketusohjaus kahdella mallilla · esittelytila · teemakohtaiset
seisonta-animaatiot kentissä ja kartalla.

**Työkalut:** playable.mjs · difficulty.mjs · debug-warp (näppäin 4, kaataa
pistetaulun) · salaisuuslaskuri debug-ruudussa · telemetria ja sitä lukeva
generaattori.

### Seuraava työ, tässä järjestyksessä

1. **Uudet ominaisuudet kaikkiin maailmoihin.** Ne ovat nyt yhdessä kentässä
   kutakin — se on oikein valmiissa pelissä ja väärin nyt, koska niitä ei
   pääse näkemään. **Tämä estää pelitestauksen, joten se on ensimmäisenä.**
2. **Pavunvarsi kasvamaan `?`-lohkosta.** Nyt se on pysyvästi näkyvissä.
3. **Kiipeilyanimaatio** — hahmo selin, ote varresta.
4. **Spritejen animaatiokierrosten tarkistus** kaikilla viidellä voimatasolla.
5. **Murtava tehostus** — tiilet rikki sivusta juosten.
6. **Minipomotaistelut kartalle** — kaksi "vasaraveljeä" aavikkoon, palkintona
   murtava tehostus. Ainoa lähde sille.
7. **Luumaailma** ja luurankopomo tehtaan jälkeen.
8. **Salaisuuksien löydettävyys**: karttaan "salaisuudet 0/1" (kertoo *että*,
   ei *missä*), demo näyttää tempun, kolikkojonot osoittavat.


### Jonossa: ruutuefektit ja neljännen seinän rikkominen

Neljä erillistä ideaa, tahallaan erillään — ne jakavat teeman muttei toteutusta.

**1. Voimakkaampi ruudun tärinä (halpa).** `scene.shake(amount)` on jo olemassa,
katto 6 px, ja linnakkeissa siitä on viitteitä. Pomon laskeutuminen, jättiläisen
askel ja iskuaalto ansaitsevat oman voimakkuutensa, ja tärinän pitäisi olla
*suunnattua* (pystyisku tärisyttää pystyyn) eikä aina samaa ympyrää. Kuvaputken
jälkikäsittely voi vahvistaa sen — se näkee jo valmiin kuvan.

**2. Auringon palava jälki (halpa, ei ruutuefekti).** Tämä on entiteettikohtainen
eikä koko ruudun asia, ja siksi se kuuluu `sprites/enemies.js`:ään eikä
`postfx.js`:ään. Sääntö on jo kirjattu: yhtä oliota koskeva efekti kuuluu
piirtokoodiin, koko ruutua koskeva jälkikäsittelyyn, eikä väliin jää mitään.

**3. Pomo hyökkää pelikentän kimppuun (keskihintainen).** Iskuaalto irrottaa
laattoja, halkeamat leviävät lattiassa. **Tämä on halpa vain siksi että ruudukko
on jo osoitettu muunneltavaksi ja tallennusturvalliseksi**: murenevat lavat ja
kytkinruudut tekivät sen työn, ja tilatallennus tallentaa koko ruudukon.
Riski jonka tiedämme etukäteen: `rules.js` validoi kentän *lähtötilan*, joten
pomo joka rikkoo lattian voi tehdä areenasta läpäisemättömän. Vaatii saman
takaisinkasvun kuin mureneva lava, ja samasta syystä.

**4. Pomo järjestää kentän uusiksi (kallis, ja paras idea).** Vaihe jossa pomo
muokkaa areenaa — nostaa pilareita, avaa kuiluja — ja pelaajan pitää sopeutua.
Tämä on aito neljännen seinän rikkominen siinä mielessä että vihollinen koskee
siihen mitä pelaaja luuli vakioksi. Vaatii että muutos on **ennakoitu, palautuva
ja validoitu**: pelaaja näkee sen tulevan, areena palautuu jos pomo kaatuu, ja
mikään järjestely ei saa tehdä ovea saavuttamattomaksi. Ilman noita kolmea se on
epäreiluuden generaattori.


### Päätetty: haarautuva kartta, eriarvoiset haarat

Omistajan päätös 9.8.2026: **haarat ovat eriarvoisia ja vaikeudesta palkitaan.**
Ei siis makuvalintaa samalla vaikeudella, vaan helpompi ja vaikeampi reitti,
joista vaikeampi antaa jotain jota helpommalta ei saa.

Neljä ehtoa, joita ilman tästä tulee ansa eikä valinta:

1. **Vaikeus pitää näkyä kartalla ennen sitoutumista.** Pelaaja ei voi valita
   vaikeampaa reittiä jos hän saa tietää sen vasta kuoltuaan siihen. Meillä on
   `tools/difficulty.mjs`, joka antaa jokaiselle kentälle luvun — kartta voi
   näyttää sen tähtinä tai värinä, ja se on **mitattu eikä käsin arvattu**.
2. **Palkinnon pitää olla tiedossa etukäteen.** "Vaikeampi reitti antaa jotain"
   ei riitä; sen pitää lukea kartalla. Muuten kukaan ei valitse sitä toista
   kertaa.
3. **Helpon reitin pitää viedä läpi peliin.** Vaikeampi reitti saa antaa
   voimaa, oikoteitä ja sisältöä, mutta se ei saa olla ainoa tie loppuun.
   Sama lupaus kuin tehostuksilla: ne avaavat paikkoja, eivät kenttää.
4. **Palkinnon pitää olla sellainen jota ei saa muualta.** Lisäelämä on
   laimea. Murtava tehostus, tähtilohko tai oma kenttä on palkinto.

**Seuraus vaikeuskäyrälle, joka pitää hoitaa samalla:** käyrä on nyt viritetty
jonoon 1→2→3→4→5. Haarautuminen muuttaa sen **tasoiksi**: taso 1 → kaksi tai
kolme saman tason haaraa → taso 2. `difficulty.mjs`:n muototarkistus pitää
kirjoittaa uusiksi tarkistamaan tasot eikä jonoa, tai se alkaa valittaa
oikeasta kartasta.

Rakenne on jo lähellä: kartta on solmuja ja linkkejä, ja `isLinkOpen` päättää
polun avoimuuden. Lukitut polut ja oikoreitit ovat pääosin dataa. Kallista on
vain vaikeuden näyttäminen kartalla ja käyrän mittarin muuttaminen.

### Avoimet kysymykset

- `playable.mjs`: 4-3 ei mene läpi botilla, ja 2-1, 3-F sekä 5-F vaativat
  tuplahypyn. **4-3 on tarkistettu käsin eikä ole rikki** — kuilun yli mennään
  kelluvia lavoja pitkin, joita botti ei osaa käyttää. Muita ei ole tarkistettu.
- **5-F sai vaikeuspisteet 295**, selvästi muita korkeammalle. Suurin yksittäinen
  tulkinta vaikeuskäyrätyössä, ja ansaitsee ihmisen silmät.
- **Jättiläispomo kasvaa ulottumattomiin.** Voimatason 0 hyppy kantaa ~71 px;
  kahden osuman jälkeen jättiläisen pää on lattiatasolta saavuttamattomissa, ja
  loput osumat vaativat areenan yläkannen lavoja. Vanha suunnittelu, ei uusi
  bugi, mutta se on nyt kirjattu.
- **Vaikeusheuristiikka ei näe pomon liikesarjaa** (`b` on aina 5,0) eikä
  rytmiä. Suurin mallintamaton termi.

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
3. ✔ **Kuumuuden väreily ja huurre** tehty teemakohtaisina (v26.08.08.23), ja
   molemmat toimivat myös ilman WebGL:ää. Veden alla ei ole vielä kenttiä, joten
   aaltoilu odottaa niitä.
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
3. ✔ Generaattori lukee viedyn lokin: `--telemetry loki.json`. Kynnys on 5
   tapahtumaa samassa kohdassa JA 3 yritystä jotka päättyivät muualla.
   Kolme asiaa jotka tämä paljasti ja jotka vaihe 4 rikkoisi hiljaa: lokin
   sarakenumerot eivät tarkoita mitään muutoksen jälkeen (kenttä rakennetaan
   siksi kahdesti), kaikilla esteillä ei ole korkeutta jota madaltaa, ja
   säädetyt kentät lyhenevät koska levennetty lepo syö sisältöä.
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

**Mureneva lava** (`%`) ✔ **tehty** (v26.08.08.24). Kiinteä kunnes sen päälle
astuu, tärisee ja halkeaa 52 framea, putoaa, kasvaa takaisin 220 framen jälkeen.
Takaisinkasvu ei ole koristetta: ilman sitä kuolema puolivälissä jättäisi kentän
mahdottomaksi loppuyritykseksi. Käytössä 4-1:n `fac_crumble`-palikassa.

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

**Tehty maailmaan 1** (v26.08.09.1). Jäljellä maailmat 2–5: yksi kenttä kussakin.
`assembleTall` ja kaistajako ovat valmiina, joten seuraava on kenttädataa.

**Se mitä tämä kohta sanoi väärin:** validaattori ei hylännyt korkeita kenttiä —
se hyväksyi ne tarkistamatta mitään, koska se luki taivaskaistan lattiarivit
eikä löytänyt maata mistään. Ratkaisu: reittisäännöt katsovat sitä kaistaa jossa
aloitusmerkki `1` on. Lisäksi kaistojen pinoaminen rikkoi kaksi asiaa joita tämä
kohta ei maininnut: pohjaton kuilu sai kellarin alleen (kansitetaan laavalla) ja
pystykamera olisi vierittänyt joka hypyllä (kamera pysyy jalkojen kaistassa).

## Myöhemmin

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
