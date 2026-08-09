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
esittelytila · teemakohtaiset
seisonta-animaatiot kentissä ja kartalla · oma kuvakieli tiilelle, `?`-lohkolle
ja putkelle · valojärjestelmä, jossa maailma kantaa omat valonsa · kosketusohjaus
kolmella mallilla · jakoruutu (`navigator.share`, ei palvelinta).

**Työkalut:** playable.mjs · difficulty.mjs · debug-warp (näppäin 4, kaataa
pistetaulun) · salaisuuslaskuri debug-ruudussa · telemetria ja sitä lukeva
generaattori.

### Seuraava työ, tässä järjestyksessä

1. ✔ **Uudet ominaisuudet kaikkiin maailmoihin** — tehty maailmoihin 2, 3 ja 4
   (v26.08.09.8). Kukin sai sen mitä siltä puuttui ja **tasan yhden** salaisen
   alueen. Käyrä nousee yhä joka maailmassa, notkoja tasan yksi kussakin.

   **Jäljellä maailma 5**, ja se on eri työ: sen numeroidut kentät tulevat
   generaattorista, joten mekaniikat leviävät sinne vain opettamalla
   `gen-levels.mjs`:lle uudet merkit — ja se arpoo maailman uusiksi, eli kolmen
   kentän mitattu vaikeus muuttuu kerralla. Oma päätöksensä, ei tämän erän jatko.
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


### Jonossa: ruututyypit teemakohtaisiksi muodoltaan, ei vain väriltään

Toiminta pysyy samana, ulkonäkö vaihtuu maailman mukaan: aavikossa toisenlaiset
lohkot kuin linnakkeessa, jäässä toisenlaiset kuin tehtaassa.

**Mikä on jo olemassa:** `THEMES` antaa jokaiselle teemalle oman palettinsa, ja
`drawTile` saa teeman nimen, joten ruudut ovat jo teemakohtaisia **väriltään**.
`drawGround`illa on lisäksi `surface`-vaihtelu (korret, aallot, niitit).

**Mikä puuttuu:** muoto. Tiili on sama tiili joka maailmassa, vain eri värisenä,
ja sama koskee `?`-lohkoa ja putkea. Tämä kohta on siis "eri piirtofunktio per
teema" eikä "eri paletti per teema".

Kolme asiaa jotka kannattaa päättää ennen kuin tätä aloitetaan:

1. **Kaikkien pitää lukea samaksi asiaksi.** Pelaaja oppii maailmassa 1 että
   tuo on rikottava lohko, ja maailmassa 4 sen pitää olla tunnistettavissa
   ilman uutta opettelua. Vaihtelu saa olla materiaalissa, ei siluetissa.
   Mitattava sama tapa kuin nyt: uusi ruutu maan ja kovan maan vieressä, ja
   pikseliero raportoituna jokaisessa teemassa.
2. **Kustannus on kuusi kertaa suurempi kuin miltä näyttää.** Kuusi teemaa
   kertaa neljä ruutua on 24 piirtofunktiota ylläpidettäväksi. Halvempi malli
   on yksi funktio joka ottaa muotoparametrit teemataulusta — sama tapa jolla
   `THEMES` hoitaa jo värit.
3. ✔ **Odota kunnes uusi kuvakieli on paikallaan.** Tiili, `?`-lohko, putki ja
   rikkoutuminen on uudistettu (v26.08.09.7), joten tämä ehto on täytetty ja
   teemakohtaiset muodot rakennetaan sen päälle. **Tämä oli ainoa este, eli
   kohta on nyt aloitettavissa** — jäljellä ovat vain ehdot 1 ja 2, jotka ovat
   tekotapaa koskevia eivätkä esteitä.


### Jonossa: maahanisku (ground pound)

Ilmassa alas + hyppy syöksee hahmon maahan pierun voimalla. Osuma tainnuttaa tai
tappaa lähellä olevat viholliset, ja **mitä korkeammalta pudotaan, sitä kovempaa
se osuu** — sekä vahingoltaan että ruudulla. Ylimmästä mahdollisesta hypystä
tehtynä se on äänivallin rikkominen: pieru työntää alas, ympärille syntyy
iskuaalto.

Ohjaus on jo vapaana: `down` + `jump` yhdessä ei tarkoita ilmassa mitään.
`jumpBuffer` ja `airJumps` ovat pelaajassa, iskuaalto on olemassa (`Shockwave`,
pomon hyökkäys), ja `scene.shake` on olemassa. Suurin osa palasista on siis
paikallaan.

Neljä asiaa jotka pitää ratkaista, ja kaksi niistä on tasapainoa:

1. **Se ei saa korvata tallausta.** Tallaus on pelin perusliike. Maahanisku saa
   olla laajempi ja kovempi mutta sen pitää maksaa jotain — putoamisaika jonka
   aikana ei voi ohjata, ja hetki maassa jonka aikana on haavoittuvainen. Ilman
   hintaa siitä tulee ainoa liike jota kukaan käyttää.
2. **Voimataso saa vahvistaa sitä, ei avata sitä.** Sama lupaus kuin muualla:
   tehostus avaa paikkoja, ei kenttää. Perusliikkeen pitää toimia voimatasolla 0,
   ja korkeampi taso saa laajentaa sädettä tai lisätä iskuaallon.
3. **Piikikkäät viholliset.** Maahanisku ei ole tallaus, joten piikkiukkoon ja
   piikikkääseen pomoon osuminen pitää päättää erikseen. Suositus: **piikit
   voittavat senkin** — muuten piikikkyys lakkaa tarkoittamasta mitään ja juuri
   rakennettu pomosykli menettää merkityksensä.
4. **Korkeuden mittaaminen.** "Mitä korkeammalta, sitä kovempaa" tarvitsee
   lähtökorkeuden muistiin syöksyn alkaessa, ja katon (`ty < 0` on kiinteä)
   takia ylin mahdollinen korkeus on tiedossa — eli asteikko voidaan normalisoida
   eikä arvata.

Audiovisuaalinen puoli kuuluu tähän kokonaan eikä erikseen (DESIGN.md kohta 8):
syöksyn ääni, osuman ääni, tärinä jonka voimakkuus seuraa korkeutta, ja
iskuaalto joka on **eri väriä ja eri rytmiä kuin pomon iskuaalto** — kaksi
samannäköistä "jotain tapahtui" -signaalia opettavat lukemaan väärää.

### Omistajan palaute 9.8.2026

Kuusi asiaa kerralla, omistajan omin sanoin puhelimella pelatessa. Kirjattu
tähän kokonaisuutena, koska ne kertovat yhdessä jotain mitä yksikään niistä ei
kerro yksin: **peli on menossa muiden käsiin.** Jakoruutu, kosketusohjaus ja
törmäystuntuma ovat kaikki sitä samaa — ne eivät haittaa tekijää, joka osaa
pelinsä, vaan sitä joka saa linkin.

1. ✔ **Tauko jäi jumiin** debug-warpin jälkeen. Korjattu (`setScene` nollaa
   tauon). Diagnoosi ei ollut se mitä oire lupasi: tauko- ja debug-ruutu eivät
   kilpailleet mistään, vaan tauko jäi päälle kohtaukseen jossa sitä ei voi
   ottaa pois.
2. **Mobiili-Safari, kaksi vikaa.** Kaksoisnapautus zoomaa sivun eikä siitä
   pääse takaisin — `user-scalable=no` ei ole tehonnut iOS 10:n jälkeen, eli
   korjaus on `touch-action` ja synteettisen kaksoisnapautuksen nieleminen.
   Toinen on ohjaimen asettelu: **juoksu/pierunappia ei voi pitää pohjassa ja
   hypätä samalla.** Omistajan kaksi ehdotusta: pierunappi alas oikealle niin
   että peukalon keskiosa lepää sillä ja kärki nousee hyppynapille, tai kolmas
   virtuaalinappi joka tarkoittaa "pidä juoksu pohjassa". Jälkimmäinen lisää
   tilan, ja tila on asia joka pitää oppia ja johon voi jäädä jumiin.
3. **Jakoruutu, kevyt toteutus.** Syy on aikataulullinen eikä tekninen: peliä
   ollaan antamassa kavereille testattavaksi. Kevyt tarkoittaa tässä
   **selainpuolta ja vain sitä** — `navigator.share` ja leikepöytä, ei
   palvelinta. Sama peruste kuin telemetrian kohdassa 4, ja täällä vielä
   painavampi: pelaajat ovat lapsia. Linkin esikatselukortti on jo olemassa,
   joten vaikein osa on tehty.
4. **Törmäystuntuma.** "Laskeutuessa liikkuu vielä sivuttain, eikä ehdi
   väistää vihollista jota kohti on menossa." Tämä on **diagnoosi ennen
   korjausta**: oire nimeää kaksi eri epäiltyä (osumalaatikot ja liikemäärä),
   eikä kumpikaan ole vielä mitattu. `PHYSICS.md`:n vakiot eivät ole vapaasti
   säädettävissä — ne mitoittavat koko pelin vaikeuskäyrän — joten "toimii
   kuten suunniteltu, tässä luku" on kelvollinen lopputulos.
5. **Kahdeksan maailmaa ja kahdeksan kenttää kussakin.** Oma kohtansa alla.

### Jonossa: kahdeksan maailmaa, kahdeksan kenttää kussakin

Nyt on 5 maailmaa ja 21 kenttää. Tavoite on 64, eli **kolminkertainen määrä
sisältöä** — ja se on se luku josta tämän kohdan suunnittelu pitää aloittaa,
koska kaikki muu seuraa siitä.

Neljä asiaa jotka pitää ratkaista ennen kuin yhtäkään uutta kenttää kirjoitetaan:

1. **Käsin ei tehdä 43 uutta kenttää.** Nykyiset käsintehdyt ovat maailman
   parasta sisältöä, mutta ne ovat myös hidas tapa. Generaattori on olemassa
   ja tekee jo maailman 5:n, telemetria syöttää sitä, ja tässä mittakaavassa
   se lakkaa olemasta bonusmaailman kikka ja alkaa olla se tapa jolla peli
   tehdään. Päätös jota tämä vaatii: **mikä osuus tehdään käsin.** Suositus:
   maailman ensimmäinen ja viimeinen kenttä käsin, väli generoiden ja käsin
   viimeistellen — käsi opettaa ja päättää, generaattori täyttää.
2. **Kuusi teemaa ei riitä kahdeksalle maailmalle.** Nyt: ruoho, aavikko, yö,
   jää, tehdas, linnake. Luumaailma on jo jonossa. Kaksi maailmaa tarvitsee
   siis vielä oman teemansa, ja teema on paletti + taustat + palikat +
   musiikki, ei pelkkä väri.
3. **Vaikeuskäyrä on viritetty viidelle maailmalle.** Kahdeksan porrasta samaan
   väliin tarkoittaa loivempaa nousua tai korkeampaa kattoa, ja
   `difficulty.mjs`:n muototarkistus mittaa nykyään jonoa. **Tämä on sama
   uudelleenkirjoitus jonka haarautuva kartta jo vaatii** — kaksi kohtaa,
   yksi työ, ja ne kannattaa tehdä yhdessä eikä peräkkäin.
4. **Kahdeksan kenttää maailmassa on eri muoto kuin neljä.** Nykyinen kaava on
   kolme kenttää ja linnake. Kahdeksan ei ole "sama kaksi kertaa" vaan tila
   välipomolle, haaralle ja hengähdyskentälle — eli juuri ne kohdat jotka ovat
   jo erikseen jonossa (minipomot, haarautuva kartta). Tämä kohta on siis se
   joka **antaa niille tilan**, ei kilpaile niiden kanssa.

### Päätetty: pistetaulu ei mene palvelimelle, tulos menee linkkiin

Kysymys 9.8.2026: voisiko pistetaulu olla globaali? **Ei — tulos kulkee
jakolinkissä.** Tekninen puoli on helppo (Vercel on jo alla), eli päätös
tehdään muilla perusteilla, ja niitä on kolme:

1. **Pistetaulussa on nimi.** `NameEntryScene` kysyy sen, ja lapsi kirjoittaa
   siihen etunimensä. Globaali taulu lähettäisi sen ulos ja **näyttäisi sen
   vieraille** — eli sama päätös kuin telemetrian kohdassa 4, mutta raskaampi,
   koska julkisuus on tässä koko idea. Korjaus on sanalistasta valittava nimi,
   ja se on isompi työ kuin palvelin.
2. **Pisteet laskee selain**, joten globaali taulu on kunniajärjestelmä jossa
   on POST-osoite. Peli välittää taulun rehellisyydestä jo nyt: tilatallennus
   antaa tähden ja warpattu kierros ei pääse taululle lainkaan. Globaali taulu
   tekisi noista tarkistuksista koristeita.
3. **Se olisi ensimmäinen ajonaikainen riippuvuus** (DESIGN.md kohta 7) — eli
   ensimmäinen tapa jolla peli voi olla rikki ilman että kukaan koski koodiin.

**Tehdään sen sijaan:** tulos jakolinkin osoiteparametreihin
(`?s=45200&n=OLLI&l=2-3`), ja vastaanottajan alkuruutu kertoo mihin pitää yltää.
Ei palvelinta, ei tallennettuja nimiä, eikä huijaaminen ole ongelma jota
kannattaisi ratkaista — oman kehulinkin väärentäminen on itseään vastaan.
Jakoruutu on jo olemassa ja lukee osoitteen `og:url`-tagista, joten tämä on
laajennus eikä uusi ruutu. Jos globaali taulu joskus tehdään, se tehdään tämän
jälkeen ja paremmin tiedoin.

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
- **Hyppybudjetti on vanhentunut, ja se on ollut sitä alusta asti.**
  `tools/jump-budget.json` ja `PHYSICS.md`:n taulukko lupaavat 121 px nousun ja
  200 px kantaman; mitattuna nyt 71 ja 155. Vakiot eivät ole muuttuneet sitten
  sen commitin joka kirjoitti tiedoston viimeksi (`src/level/physics.js`), ja
  vakioista laskettuna tulee ~72 px — eli **tiedosto oli väärässä jo
  syntyessään**: fysiikkamuutos ja budjettitiedosto tulivat samassa commitissa,
  eikä budjettia mitattu uudelleen muutoksen jälkeen.

  **Mikään ei ole rikki:** validaattori ajettiin kaikille 21 kentälle sekä
  tallennetulla (8/13/6) että mitatulla (6/9/4) budjetilla, ja rikkeitä on
  molemmilla nolla. Yksikään kuilu ei siis ole liian leveä.

  Seuraus on silti konkreettinen: **kohdan 3 (d) peruste on väärä.** Se sanoo
  että kuilut on mitoitettu kuudelle ruudulle vaikka juoksuhyppy kantaa 12,5 —
  kantama on 9,7. Kohta on jäljellä olevan listan ainoa, joten se voi hyvinkin
  olla tarpeeton. **Päätä tämä ennen kuin budjettitiedosto generoidaan uusiksi**,
  koska maailma 5 on generoitu vanhoilla luvuilla.

  Ansa jonka tämä paljasti: **`measure-jump.mjs` kirjoittaa
  `jump-budget.json`in sivuvaikutuksena**, eli pelkkä mittaaminen muuttaa sitä
  tiedostoa jota generaattori lukee.
- **Kuusi kohtaa joissa isoin koko ei mahdu seisomaan**, kaikki samaa muotoa:
  `fort_blocks`in tiilihylly (rivi 9) ja sen yllä oleva holvi (rivi 6) jättävät
  väliin kaksi riviä kun tarvitaan kolme. Osuu kenttiin 1-F, 2-F ja 3-F.
  Validaattori ei huomauta siitä syystä joka on myös vastaus siihen onko se
  bugi: **hylly ei ole maareitillä**, alla oleva lattia on kuljettava, eikä
  kenttä ole missään koossa mahdoton. Isoin pelaaja vain törmää näkymättömään
  kattoon jos kiipeää sinne.
- **Bonushuoneita ei validoi mikään.** `rules.js` lukee vain sen kaistan jossa
  aloitusmerkki on, joten taivas- ja luolakaistan huoneet menevät läpi
  tarkistamatta — ja juuri siellä liian matala katto olisi pahin, koska
  `secrets.js`:n oma sääntö on että bonus josta ei pääse pois on ansa.
  Maailmojen 2–4 uudet huoneet on tarkistettu ajamalla moottoria kaikilla
  kuudella koolla, mutta se oli käsityötä eikä portti.
- **Yön paletissa tiili ja maa ovat lähes sama ruskea** (27,8 / 34 %, heikoin
  pari kaikista kuudesta teemasta). Uusi kuvakieli paransi eron joka teemassa,
  mutta tämä jäljelle jäänyt on **paletti eikä muoto**, joten se ei korjaannu
  teemakohtaisilla muodoilla vaan `night.brick`in ja `night.ground`in väreillä.

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
4. **Palvelinlähetys: päätetty jättää tekemättä toistaiseksi** (9.8.2026).

   Kaksi syytä, joista jälkimmäinen on painavampi. Se rikkoisi "ei ajonaikaisia
   riippuvuuksia" -periaatteen: peli on staattinen sivusto, ja lähetys tarkoittaa
   funktiota ja tallennusta. Ja **oletuksena päällä oleva lähetys ei kelpaa
   tässä tapauksessa**: koko syy siihen ettei nykyinen keräys tarvitse
   suostumusikkunaa on se että data ei poistu selaimesta eikä sitä voi yhdistää
   kehenkään. Siirto palvelimelle muuttaa sen, EU:ssa valmiiksi rastitettu ruutu
   ei ole pätevä suostumus, ja peliä pelaa lapsi kavereineen.

   Käytännön puoli ratkaisi asian: **data ei ole pullonkaula.** Kourallinen
   pelaajia tuottaa generaattorin kynnyksen ylittävän aineiston paikallisesti
   muutamassa illassa, ja näppäin 8 saa sen ulos tiedostona ilman infraa ja
   ilman kysymystä. Jos peli leviää perheen ulkopuolelle, tämä harkitaan
   uudelleen — ja silloin **kysyen, oletus ei**.

Vaiheet 1–3 ovat käytössä ja riittävät: kirjaus, vienti ja generaattorin
luenta toimivat ilman että mitään lähtee selaimesta.

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

Kohdat a–c on tehty ja **validaattori on puhdas kaikille 21 kentälle** — tästä
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

**Kytkinruudut** (P-switch-tyyliin) ✔ **tehty** (v26.08.09.2) juuri niin kuin
tähän kirjattiin: ruudukkoa ei kirjoiteta uusiksi, vaan `tileAt()`:ssa on
käännöstaulu — kun kytkin on päällä, tietyt merkit luetaan toisina (tiili ↔
kolikko). Ruudukko pysyy muuttumattomana, tilatallennus tarvitsee vain yhden
totuusarvon, eikä kytkimen loppuminen voi jättää kenttää rikkinäiseen
välitilaan. Käytössä 3-2:n `switch_wall`-palikassa.

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
