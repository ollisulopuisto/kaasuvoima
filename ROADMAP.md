# Roadmap ja työlista

Tämä tiedosto on työn muisti: mitä on kesken, mitä seuraavaksi ja miksi.
Päivitä se kun tila muuttuu — älä luota siihen että konteksti muistaa.
Valmistuneet asiat siirtyvät [CHANGELOG.md](CHANGELOG.md):hen perusteluineen.

**Työtapa:** deployaa jokaisen pienenkin korjauksen jälkeen. Peliä pelataan
tuotannosta, joten korjaus joka odottaa committia ei hyödytä ketään. Portti
ennen pushia on `node tools/verify.mjs`.

---

## Tila 10.8.2026 (iltapäivä)

Kaikki alla oleva on tuotannossa ja testattu: **8 maailmaa, 64 kenttää.**
`node tools/verify.mjs` on portti, `node tools/playable.mjs` tarkistaa
geometrian, `node tools/difficulty.mjs` vaikeuskäyrän, ja kaksi uutta mittaria
— `node tools/curriculum.mjs` (milloin asia opetetaan) ja `node tools/variety.mjs`
(kuinka usein se sanotaan uudelleen) — eivät ole portteja vaan mittareita.

**Kahdeksan kentän muoto: kaikki kahdeksan maailmaa, 64 kenttää.** Maailma 8
tuli mittaan 10.8.2026 (seitsemän uusintaa ja megapomo, **8-4 KONEHOLVI** ja
**8-5 SULATTO**), ja **maailma 2** samana päivänä viimeisenä: **2-4 SAVIKUOPPA**
ja **2-5 PAAHDE**, molemmat sen jälkeen kun tiet yhtyvät.

Haarautuvassa maailmassa "kahdeksan kenttää" ei ole sama väite kuin muualla, ja
se on nyt kirjoitettu porttiin eikä tähän (`tools/verify.mjs`, EIGHT_DONE-lohko):
**kahdeksan solmua kartalla, ja jokainen reitti kävelee niistä vähintään kuusi
niin ettei reittien ero ole yhtä suurempi** — mitattuna HIEKKATIE 6 ja LAAVATIE
7. Samalla muototesti siirtyi mittaamaan **kävelyä eikä litistettyä riviä**
(`walksOf`): haarattomassa maailmassa se on merkki merkiltä sama jono kuin
ennen, maailmassa 2 se on kaksi jonoa, ja kummankin on noustava ja
hengähdettävä kahdesti. Juuri se mittaus valitsi uusien kenttien paikan: ennen
risteystä ne olisivat jättäneet LAAVATIEn päättymään 2-M:ään (110,7), joka on
matalampi kuin 2-1 (118,6), eli kävely ei olisi noussut.

**Kaksi pelitilaa on olemassa.** `AIKA-AJO` (v26.08.10.55): kentän oma ennätys,
elävä ero kahdeksassa välipisteessä, tilalataus kielletty. `PÄIVÄN PIERU`
(v26.08.10.57): päivämäärästä generoitu kenttä, sama kaikille, yksi yritys, ja
**1096 päivää tarkistettuna korpusta vastaan etukäteen** (0 osumaa) — selaimessa
generoitu kenttä ei voi olla korpustarkistettu, joten siemenavaruus luetteloitiin
ja toimitetaan vain tuomio. Molemmat ovat alkuvalikon rivejä; lista on nyt viisi
riviä pisimmillään ja portti mittaa että se mahtuu.

**Jokaisella maailmalla on oma linnakesanasto** (v26.08.10.54). `variety.mjs`
mittasi että puolet linnakkeista ei tuonut peliin yhtään uutta muotoa (6-F, 7-F
ja 8-F 0,0 %); nyt jokainen rakentuu omasta sanastostaan ja kierrätyslista on
**7/44 → 2/60**, linnakkeita siinä **4 → 0**.

**Pystykentät ovat tuettuja muttei käytössä** (v26.08.10.52). Sivunvaihtava
kamera, kiipeävä botti, pystysuora `validateLevel` ja rivipohjainen vaikeus ovat
olemassa ja testattuja; **yksikään toimitettu kenttä ei ole vielä pysty**, ja
portti vartioi sitä (`no shipped level ever pages`, 64 kenttää, 0 sivunvaihtoa).

**Käyrä nousee joka maailmassa**, ja luvut ovat linnakkeiden jälkeen
`112,8 · 133,2 · 180,7 · 191,3 · 233,2 · 251,2 · 253,7 · 283,5`.
**Tiukin askel on w6 → w7, +2,5 pistettä**, ja se on koko pelin ohuin kohta:
seuraava kenttämuutos kummassa tahansa maailmassa kääntää sen helposti
laskuksi. 6-F ja 7-F kantavat neljänneksen maailmansa keskiarvosta.

**Alkuperäisyystarkistus on ajettu ja se on nyt oikeasti tarkistus**
(v26.08.10.48). Korpuksen luku oli rekursioton, joten ensimmäinen ajo luki
**nolla tiedostoa ja tulosti 0 osumaa** — vastaus kysymykseen jota ei kysytty.
Korjattuna: **481 korpustiedostoa, 27 generoitua kenttää, 0 osumaa.**

**Mekaniikat:** kuplaloukku (pallo vangitsee, puhkaisu tappaa, karkaava vihu
vihastuu) · supertähti (kuolemattomuus vihollisille ja maan piikeille, ei
kuopalle/laavalle/kellolle) · kytkinruudut · murenevat lavat · murtava tehostus
PAUKKUPAPU, joka rikkoo tiilen ja **vain** tiilen (v26.08.09.14) · **juoksuhiekka**
aavikossa, kahdessa kentässä viidestä (v26.08.09.35) · pavunvarsi ja
warp-putki (45 rivin kenttä maailmoissa 1–4) · salaisuuksia **167 kpl 49
kentässä**, mitattuna `secretKeys`illä eikä muistista: 104 ladattua tiiltä, 31
tähtilohkoa, 24 kytkintä ja 8 sisäänkäyntiä piilokaistalle (luku oli 59/21
ennen kuutta kymmentä kenttää, ja ennen sitä tässä luki pitkään 39, mikä oli
vanhentunut) · piikkiukko · pomon deterministinen piikkisykli.

**Sisältö:** haarautuva kartta maailmassa 2 — `2-2` on risteys, `HIEKKATIE` ja
`LAAVATIE` päätyvät molemmat linnakkeeseen, ja haaran vaikeus ja palkinto lukevat
kartalla ennen valintaa (v26.08.09.13) · minipomo `2-M`, papuparoonit laavatien
varrella, murtavan tehostuksen ainoa lähde (v26.08.09.14) · maailma 5 generoitu
uusiksi niin että aamun mekaniikat näkyvät myös siellä, siemen valittu
mittaamalla (v26.08.09.12) · vaikeuskäyrä nousee joka maailmassa, tasan yksi
notko per maailma · nyrkkeilijäpomo · jäätikkö laavan tilalle jäämaailmassa ·
kaksoisovet · voittoruutu hernekeitolla · sirppikuu · **maailma 6 LUULAAKSO**
(v26.08.09.33): oma teema, oma tausta, yksitoista luupalikkaa, kentät 6-1…6-F,
karttaruudukko ja luurankopomo, jonka jokainen osuma hajottaa ja joka on
`VOICES`-taulun ensimmäinen puhuja pelaajan jälkeen · **maailma 7 KAASUKEHÄ**
(v26.08.09.36): oma teema, oma tausta, kaksitoista pilvipalikkaa, kentät
7-1…7-F, kartta ja sääherra (`bossVariant: 5`), joka nousee ilmaan jokaisesta
osumasta. Maailman kaksi sääntöä ovat portissa eivätkä kommentissa: **mikään ei
seiso maassa** (0 ruutua vastaan luun 44) ja **ohut pilvi ei ole koskaan tyhjän
päällä** (0 vastaan muun pelin 73), ja lattia on mitattu bonushuonetta vasten
(maata 89–97 % vastaan `sky_garden`in 0 %) · **maailma 8 VIIMEINEN LINNAKE**
(v26.08.09.42): ei uutta teemaa vaan uusi *muoto* — kuusi kenttää, kuusi
tappelua, ei yhtään lippua, `chunks/keep.js`, kentät 8-1…8-F ja kartta jolla on
kuusi solmua. Neljä väitettä portissa: **kuusi askelta** (`tiersOf`, muut
neljä), **kattoa 100 %** sarakkeista (lähin kilpailija tehdas, 56,6 % ennen
maailman 4 täyttämistä ja **27,1 %** sen jälkeen — generoidun tehdaskentän
kansi roikkuu rivillä 2, ks. v26.08.10.49), **0
lippua / 6 ovea** (muualla 3/1) ja **jokainen pelin pomovariantti kerran**
(muissa maailmoissa yksi). Lisäksi kaksi rakennesääntöä: **tiili ei kosketa
kiveä** (0 kosketusta vastaan muun pelin 14, koska linnaketeeman tiili ja maa
ovat 7,9 % päässä toisistaan) ja **jokaisen kuilun edessä on yhdeksän saraketta
lattiaa** (ahtain 15 vastaan muun pelin 1).

**Esitys:** kuvaputki varjomaskilla ja vaakavuodolla · kenttäkohtainen tunnelma ·
esittelytila · teemakohtaiset seisonta-animaatiot kentissä ja kartalla · oma
kuvakieli tiilelle, `?`-lohkolle ja putkelle · valojärjestelmä, jossa maailma
kantaa omat valonsa · kosketusohjaus kolmella mallilla · jakoruutu
(`navigator.share`, ei palvelinta) ja tulos jakolinkissä · kartan luettavuus
mitattuna: kalusto ei seiso polulla eikä sen vieressä (sääntö 8
`worldProblems`issa), kenttälaatan jokainen sauma on 2 px, ja polut mutkittelevat
tunnisteesta johdetun käyrän mukaan jota myös nappula kävelee (v26.08.09.30).

**Portit ja työkalut:** playable.mjs · difficulty.mjs, joka kirjoittaa
`src/data/difficulty.js`:n vain lipun takana ja jonka vanhentumisen `verify.mjs`
huomaa johtamalla luvut uudelleen · **käyrän muoto on portti eikä tuloste**
(v26.08.09.33): jokaisen maailman on noustava ja notkahdettava tasan kerran, ja
`verify.mjs` tarkistaa sen · **käyrä nousee myös maailmasta maailmaan**
(v26.08.09.36), mikä on eri väite kuin edellinen: muototesti katsoo yhtä
maailmaa kerrallaan, joten uusi maailma voisi olla sisäisesti moitteeton ja
silti edellistä helpompi · **maareitin lupaus on portti käsintehdyissä
maailmoissa 6 ja 7** (v26.08.09.36), ei enää vain raportti ·
kaistavalidointi, joka kattaa kaikki kolme
kaistaa ja siis myös bonushuoneet (v26.08.09.11) · hyppybudjetin
toistettavuustesti · debug-warp (näppäin 4, kaataa pistetaulun) ·
salaisuuslaskuri debug-ruudussa · telemetria ja sitä lukeva generaattori.

### Seuraava työ, tässä järjestyksessä

1. ✔ **Pavunvarsi kasvaa `?`-lohkosta** — tehty (v26.08.09.25). Lohko pudottaa
   pavun, papu putoaa lattialle ja varsi kasvaa siitä ruutu kerrallaan
   taivaskaistalle. Kaksi asiaa jäi kirjatuksi muitakin muutoksia varten:
   **validointi ratkaistiin ensin** — kenttädata on kasvanut kenttä ja moottori
   johtaa siitä kasvamattoman, jotta `rules.js` yhä todistaa saumanylityksen ja
   uusi `checkBeanBlocks` todistaa että kasvaminen tapahtuu — ja lohko istuu
   varren *sisällä* eikä sen alla, koska mitattuna varsi joka alkaa vasta
   bumppiriviltä on saavuttamaton voimatasoilla 0 ja 1.
2. ✔ **Kiipeilyanimaatio** — tehty (v26.08.09.22). `state()` palauttaa nyt
   `'climb'`, ja se kahden framen sykli jota köydelle jo laskettiin on vihdoin
   käytössä.
3. ✔ **Spritejen animaatiokierrokset** käyty läpi kaikilla viidellä
   voimatasolla (v26.08.09.18) ja loputkin korjattu (v26.08.09.22): kävely
   kulkee nyt ohitusasennon kautta, ja tarkistus on portissa.
4. **Minipomot muihin maailmoihin**, jos niitä halutaan. Koneisto on olemassa
   (`2-M`, v26.08.09.14), joten tämä on kenttädataa ja karttasolmuja.
5. ✔ **Luumaailma ja luurankopomo** — tehty (v26.08.09.33). Maailma 6
   LUULAAKSO: `THEMES.bone`, `bg: 'bones'`, `chunks/bone.js`, kentät 6-1…6-F,
   kartta ja `bossVariant: 4`. Musiikki on Saint-Saëns'n *Danse macabre*
   (1874, vapautui 1.1.1992) käsin kirjoitettuna `TRACKS`-tauluun, ja
   [DESIGN.md](DESIGN.md):n kohdan 1 b ehto on nyt portti eikä lupaus: raita
   kantaa lähteensä (`source`) ja `verify.mjs` vaatii nimen molempiin
   dokumentteihin. Kolme asiaa jäi kirjatuksi muitakin maailmoja varten:
   **luupalikoiden ehto on tehtaan ehdon peilikuva** (ei kattoa, ei roikkuvaa
   luuta), **kolmijakoisuus on datassa** (jokainen ääni ja rumpukuvio on kuuden
   askeleen monikerta), ja **botti sanelee geometrian** — kolme kertaa peräkkäin
   ketjutettu kuoppa, nelirivinen tiiliseinä ennen kuoppaa ja hautakivi kuopan
   huulella kaatoivat kukin läpäisytestin, ja jokainen niistä on kirjattu siihen
   palikkaan jonka se muutti.
6. ✔ **Luolakaistan oma musiikki** — tehty (v26.08.09.32). Griegin
   *Vuorenkuninkaan luolassa* (1875, vapautui 1.1.1978) on nyt `cave`-raita
   `TRACKS`-taulussa, käsin kirjoitettuina sävelinä, ja luolakaista soittaa sen.
   Neljä asiaa jäi kirjatuksi muitakin muutoksia varten:
   **Kysymys ratkaistiin ennen säveliä** — löytyminen on tapahtuma ja musiikki
   on paikka, mistä seurasi että vaihto johdetaan jaloista joka framella
   (`bandAt`, sama mittaus kuin `noteSecret`illä), ei matkasta, eikä se osu
   kumpaankaan saapumisen omaan hetkeen: mitattuna löytö framella 0, ohjaus
   takaisin framella 31, musiikki framella 54.
   **Moottori ei osannut kiihtyä** vaan vaihtaa vaihdetta; `paceAt` lisäsi
   jatkuvan kiihdytyksen raidan omana ominaisuutena, mitattuna 121,4 → 60,9 ms
   askelta kohti (1,99×) kun kenttäraita pysyy 96,2 ms:ssä.
   **Taivaskaista jätettiin kentän omaan musiikkiin** tarkoituksella: yksi raita
   kahdelle vastakkaiselle paikalle sanoisi "salaisuus" eikä "luola", ja
   silloin musiikki olisi taas löytymisen merkki (§8).
   **Kaksi vartijaa, kaksi testiä** — odotusaika pitää musiikin poissa
   saapumisesta ja kuolemaportti pitää sen poissa kuoppaan putoamisesta, ja
   kumpikin on todistettu erikseen punaisella ettei toinen esitä toista.
   *Yö Autiovuorella* odottaa yhä viimeistä linnaketta.
7. ✔ **Pilvimaailma ja sääherra** — tehty (v26.08.09.36). Maailma 7
   KAASUKEHÄ: `THEMES.cloud`, `bg: 'clouds'`, `chunks/cloud.js`, kentät
   7-1…7-F, kartta ja `bossVariant: 5`. Musiikki on **omaa sävellystä**, ei
   `source`-kenttää — vapautuneesta sävelmistöstä ei löytynyt teosta joka olisi
   ollut *tämä paikka* niin kuin *Danse macabre* oli luulaakso, ja aihevalinta
   on ainoa peruste jolla lainaaminen on tässä pelissä tehty. Neljä asiaa jäi
   kirjatuksi muitakin maailmoja varten:
   **Lattia päätetään ennen palikoita.** Pilvistä tehty maailma on kuoppa koko
   pituudeltaan ellei joku päätä toisin; päätös on "oman painonsa tiivistämä
   pilvi on maata", eli lattia on tavallista `#`:ää ja koko muu tiedosto
   seuraa siitä.
   **Puoliläpäisevä lava kelpaa maailman aineeksi vasta kun sen ansa on
   poistettu rakenteesta.** Sääntö on että jokaisen `-`:n alla on kiinteää
   pilveä (mitattu 0 vastaan muun pelin 73), ja sen hinta on että yksikään
   lauta ei ylitä kuoppaa — mikä nostaa vaikeutta, koska sillattu kuoppa ei
   tuota lainkaan kuiluriskiä.
   **"Ei ole bonushuone" on mitattavissa.** Maaosuus ja lautaosuus, samalla
   koodilla `sky_garden`ista: 89–97 % / 9–10 % vastaan 0 % / 100 %.
   **Vaikeus on ostettava kahdesti.** Ensimmäinen mitoitus antoi w7 261,5 eli
   maailmaa 6 helpomman, ja korjaus oli vihollistiheys ja reikien määrä — ei
   leveämmät kuopat, koska ne rikkoisivat läpäisylupauksen.
8. ✔ **Viimeinen linnake** — tehty (v26.08.09.42). Maailma 8: `THEMES.fortress`
   (ei uutta teemaa, koska lista on täysi), `bg: 'none'`, `chunks/keep.js`,
   kentät 8-1…8-F ja kuuden solmun kartta. Musiikki on Mussorgskin *Yö
   Autiovuorella* Rimski-Korsakovin sovituksena, eli DESIGN.md kohdan 1 b
   taulukon viimeinen rivi on nyt käytössä eikä "tulossa". Neljä asiaa jäi
   kirjatuksi:
   **Ilman uutta teemaa ero on tehtävä muodossa, ja muoto on mitattavissa.**
   Kaava oli seitsemän kertaa kolme kenttää ja linnake; tässä linnake on koko
   maailma, kuusi kenttää ja kuusi tappelua, ja kaikki neljä väitettä ovat
   portissa lukuineen (askelia 6 vs 4, kattoa 100 % vs 57 %, lippuja 0 vs 3,
   pomovariantteja 6 vs 1). "Maailma 8 on olemassa" ei olisi todistanut mitään.
   **Vanha velka maksettiin rakenteella eikä paletilla.** Linnaketeeman tiilen
   ja maan ero on 7,9 % (mitattu uudelleen, yhä toiseksi huonoin), ja koska
   paletin muuttaminen muuttaisi seitsemän valmiin kentän ulkonäön, vastaus on
   ettei tiili ja kivi ole tässä maailmassa koskaan vierekkäin — 0 kosketusta
   vastaan muun pelin 14.
   **Sääntö joka lukee lattiaa ei lue reittiä.** Vauhdinottosääntö (9 saraketta
   ennen jokaista kuilua) päästi läpi kentän jossa botti kuoli sarakkeessa 105,
   koska edellinen palikka oli porras: lattia oli ehjä eikä kukaan kävellyt
   sillä. Korjaus oli palikkajärjestys, ja vajaus on kirjattu — seuraava kenttä
   joka nostaa pelaajan maasta juuri ennen kuilua kaatuu samalla tavalla.
   **Portti joka lukee kaksi kenttää kolmesta ei ole portti.** Lainatun
   sävelmän nimeämistarkistus luki `composer`in ja `work`in; sovittaja olisi
   voinut jäädä nimeämättä. Nyt se lukee jokaisen `source`-kentän. Sama vika oli
   `cave`ssa kerran jo, eli kahdesti tehtynä se ei ole huolimattomuutta.
9. **Salaisuuksien löydettävyys** — kolmesta osasta kaksi tehty:
   ✔ kartta kertoo *että* kentässä on salaisuuksia ja montako niistä on
   löytynyt, **ei koskaan missä** (v26.08.09.17);
   ✔ kolikkojonot osoittavat (v26.08.09.29) — ja osoittavat vain sitä yhtä
   salaisuutta johon ei voi kompastua, warp-putkea, koska lohkosta aukeavat
   salaisuudet avautuu jo tavallisella pelaamisella eikä vihje niiden päällä
   olisi vihje vaan kyltti. Sama kolikkorivi on tavallisella putkella, ja
   koko pelin kuoppakaistan kolikkoriveistä 6,4 % on salaisuuden kohdalla.
   Jäljellä: **demo näyttää tempun**.

## Jonossa

### Ruutuefektit ja neljännen seinän rikkominen

Neljä erillistä ideaa, tahallaan erillään — ne jakavat teeman muttei toteutusta.

**1. Voimakkaampi ruudun tärinä (halpa).** `scene.shake(amount)` on jo olemassa,
katto 6 px, ja linnakkeissa siitä on viitteitä. Pomon laskeutuminen, jättiläisen
askel ja iskuaalto ansaitsevat oman voimakkuutensa, ja tärinän pitäisi olla
*suunnattua* (pystyisku tärisyttää pystyyn) eikä aina samaa ympyrää. Kuvaputken
jälkikäsittely voi vahvistaa sen — se näkee jo valmiin kuvan.

**2. ✔ Auringon palava jälki — tehty** (v26.08.09.18), ja sääntö piti: se meni
`sprites/enemies.js`:ään eikä `postfx.js`:ään, koska jälkikäsittely ei tiedä
mikä pikseli oli aurinko. Samalla korjautui räikkä joka piti auringon
näkymättömissä 2-1:ssä (kokonaan näkyvissä 21,5 % → 98,3 %), sukellus sai
näkyvän ennakkovaroituksen, ja aurinko luovuttaa lipulla eikä seuraa maan alle.

**3. Pomo hyökkää pelikentän kimppuun (keskihintainen).** Iskuaalto irrottaa
laattoja, halkeamat leviävät lattiassa. **Tämä on halpa vain siksi että ruudukko
on jo osoitettu muunneltavaksi ja tallennusturvalliseksi**: murenevat lavat ja
kytkinruudut tekivät sen työn, ja tilatallennus tallentaa koko ruudukon.
Riski jonka tiedämme etukäteen: `rules.js` validoi kentän *lähtötilan*, joten
pomo joka rikkoo lattian voi tehdä areenasta läpäisemättömän. Vaatii saman
takaisinkasvun kuin mureneva lava, ja samasta syystä.

**4. Pomo järjestää kentän uusiksi — PÄÄTETTY TEHDÄ 9.8.2026.** Omistaja valitsi
tämän eikä halvempaa kohtaa 3:a. Kolme ehtoa alla eivät ole toiveita vaan
hyväksymiskriteerit, ja niistä **validointi on se joka pitää ratkaista ensin**:
`rules.js` tarkistaa kentän *lähtötilan*, joten areena joka muuttuu kesken
taistelun on juuri se tapaus jota mikään portti ei tällä hetkellä katso.
Kaistavalidointi (v26.08.09.11) antaa siihen mallin — yleiset vs. tilannekohtaiset
säännöt — mutta muuttuvan ruudukon tarkistaminen on uusi asia: jokaisen
*mahdollisen* järjestelyn on kelvattava, ei vain sen jossa taistelu alkaa.

Itse idea: vaihe jossa pomo muokkaa areenaa — nostaa pilareita, avaa kuiluja —
ja pelaajan pitää sopeutua.
Tämä on aito neljännen seinän rikkominen siinä mielessä että vihollinen koskee
siihen mitä pelaaja luuli vakioksi. Vaatii että muutos on **ennakoitu, palautuva
ja validoitu**: pelaaja näkee sen tulevan, areena palautuu jos pomo kaatuu, ja
mikään järjestely ei saa tehdä ovea saavuttamattomaksi. Ilman noita kolmea se on
epäreiluuden generaattori.

### ✘ Peruttu 9.8.2026: ruututyypit teemakohtaisiksi muodoltaan

Omistaja: *"we don't need a theme specific tile shape, the current skinning is
enough."* Kohta oli jonossa siitä asti kun uusi kuvakieli (v26.08.09.7) poisti
sen esteen, eikä sitä koskaan aloitettu.

Perustelu kannattaa säilyttää, koska se on vastaus kysymykseen joka tulee
takaisin: **väri riittää erottamaan maailmat, muoto ei ollut se puuttuva asia.**
`THEMES` antaa jokaiselle teemalle oman palettinsa ja `drawGround`illa on
`surface`-vaihtelu (korret, aallot, niitit), eli maailmat erottuvat jo. Hinta
olisi ollut kuusi teemaa kertaa neljä ruutua eli 24 piirtofunktiota, ja
vastineeksi olisi saanut riskin: pelaaja oppii maailmassa 1 miltä rikottava
lohko näyttää, ja jokainen uusi siluetti on uusi opettelu. Vaihtelu materiaalissa
oli aina oikea puolisko — ja se on jo tehty.

### ✔ Tehty (v26.08.09.35): juoksuhiekka, ja miksi se ei ole joka kentässä

**Tehty.** Omistajan pyyntö oli kaksiosainen — *"aavikkokentissä voisi olla
juoksuhiekkaa. Ei kaikissa, mutta joissakin"* — ja jälkimmäinen puolisko on
suunnittelua eikä aikataulua: uhka joka on joka kentässä on maastoa, ja maasto
ei ole uhka. Aavikon viidestä kentästä kaksi sai hiekkaa: **2-1 opettaa** (yhden
ruudun kuoppa jossa kukaan ei voi hukkua) ja **2-3 testaa** (kahden ruudun
kuoppa joka hukuttaa voimatasot 0–2). 2-2, 2-N ja 2-M jäivät tarkoituksella
ilman, syyt kenttien omissa kommenteissa.

Käytös ratkesi omistajan lauseella *"vetää hitaasti alas, mutta reagoimiseen jää
useita sekunteja"*, ja se on nyt mitattu väite: **182 framea (3,03 s)** pienimmällä
keholla ensimmäisestä kosketuksesta kuolemaan, jos ei tee mitään. Hukkuminen on
geometriaa eikä ajastinta — koko keho pinnan alle — mikä on syy siihen että
matala kuoppa on todistettavasti turvallinen eikä vain lempeä.

Neljä kohtaa jotka olisivat menneet pieleen hiljaa:

1. **`SOLID` ei ole oikea vastaus, eikä `DEADLY` myöskään.** Hiekka on omassa
   joukossaan (`SINK`), koska se on läpäistävää astinta: kiinteänä sen *pinta*
   olisi mennyt lattiaprofiiliin ja pohjaton lammikko olisi mennyt läpi
   tavallisena maana. Oma sääntö (`checkQuicksand`) vaatii pohjan ja reunan.
2. **Vaikeusmittari näkee sen.** Sama virhe jonka piikkikävelijä teki samana
   aamuna. 2-1 115,7 → 117,4 ja 2-3 156,1 → 159,3; maailman muoto ei muuttunut.
3. **Maahanisku hautaa.** Syöksy hiekkaan peruu iskun ja aallon ja jättää
   jälkeensä 20 framea nopeaa uppoamista: varoajasta katoaa **47 %**. Matalassa
   kuopassa sekään ei tapa, koska pohja on pohja.
4. **Tähti ei kanna yli.** Hiekka liittyi listaan *kuoppa, laava, kello* eikä
   listaan *viholliset, piikit*: se ei ole huoneessa oleva asia joka lyö, se on
   huone.

### ✔ Tehty (v26.08.09.31): maahanisku (ground pound)

**Tehty.** Alas + hyppy ilmassa, ja hinta on se osa joka kannattaa lukea:
12 framea latausta paikallaan, ohjaamaton syöksy 7,5 px/frame, ja 16…36 framea
maassa jona pelaaja **ei ole kuolematon**. Mitattu samalta korkeudelta: tallaus
0 framea ilman ohjausta, maahanisku 47, ja sivusuunnassa 16 px vastaan 0 px.

Neljä kohtaa alla, sellaisina kuin ne ratkesivat:

1. **Ei korvaa tallausta** — eikä vain ajan takia. `POUND_KILL_AT` on puolet
   huoneesta ja tavallinen hyppy on mitattuna kolmannes, joten arkinen
   maahanisku **tainnuttaa** ja tallaus on yhä se liike joka tappaa.
2. **Voimataso vahvistaa, ei avaa.** Perusliike toimii voimatasolla 0. Taso
   ostaa sädettä (5 px/taso) ja halvemman kynnyksen iskuaallolle (0,75 → 0,30),
   eikä kumpikaan pää saa aaltoa hyppäämällä paikaltaan.
3. **Piikit voittavat sen.** `poundImpact` ohittaa `e.spiky`-viholliset, jolloin
   alle jäänyt piikkiukko jää seisomaan ja pelaaja ottaa sen tappion jonka
   tallauskin ottaisi. Pomo mitattuna: piikkivaiheessa 0 osumaa ja pelaaja
   menetti tason, avoimena 1 osuma eikä menettänyt mitään.
4. **Korkeus mitataan.** `poundScale` normalisoi pudotuksen laskeutumiskohdan
   omaan y:hyn, koska `ty < 0` on kiinteä eikä minkään kappaleen yläreuna voi
   olla nollan yläpuolella. Kaksi eri korkuista kattoa antavat molemmat 1,000
   (1-1: 192 px, 1-2: 432 px) — vakioon sidottu asteikko ei voi antaa kumpaakin.

Kuva ja ääni tulivat mukana: `dive` kestää 0,55 s ja on `sprout` väärinpäin,
`slam` kestää 0,2 s ja on oktaavin `stomp`in alla, ja `PoundWave` on vihreä ja
kertaluontoinen siinä missä pomon `Shockwave` on ruskea ja välkkyvä (mitattu:
vihreä−punainen +63 vastaan −36, erilaisia ruutuja 12 framessa 12 vastaan 2).

Yksi asia jätettiin tarkoituksella tekemättä: **pelaajan sprite ei muutu.**
Tintit tarkoittavat tässä pelissä "ei voi satuttaa", ja maassa oloaika on juuri
se hetki jona voi.

#### Alkuperäinen kuvaus

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

**Päätetty 9.8.2026: tehdään, ja kohdat 1 ja 3 alla ovat päätettyjä eivätkä
avoimia.** Maahanisku maksaa ohjaamattoman putoamisajan ja haavoittuvan hetken
maassa, ja **piikit voittavat sen** — muuten piikikkyys lakkaa tarkoittamasta
mitään ja juuri rakennettu pomon piikkisykli menettää merkityksensä.

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

### Kahdeksan maailmaa, kahdeksan kenttää kussakin

Nyt on **8 maailmaa ja 64 kenttää**, eli tavoite on täynnä: jokainen maailma on
kahdeksan kentän mittainen, ja viimeisenä tuli maailma 2 (2-4 ja 2-5,
10.8.2026). Mitä "kahdeksan kenttää" tarkoittaa haarautuvassa maailmassa, lukee
portissa — ks. tilannekatsaus tämän tiedoston alussa.

**Muoto ei ole enää auki (v26.08.09.46), ja se on portissa eikä tässä.**
Kahdeksan kenttää on `W-1`…`W-7` ja `W-F`, ja seitsemän askelen kävelyssä on
**kaksi hengähdystä**. Kolme perustelua ovat muutoslokissa; tähän jää se osa joka
koskee tekemättä olevia maailmoja:

- **Haara ja välipomo eivät ole muodon osia** vaan maailman ominaisuuksia. Haaran
  pitää tämän dokumentin oman päätöksen mukaan olla eriarvoinen ja maksaa jotain
  jota ei saa muualta, ja sellaisia palkintoja on pelissä **yksi**, jonka ainoa
  lähde on maailman 2 välipomo. Seitsemän uutta keksittäisiin vain muodon
  täytteeksi. Maailma 2 saa siis olla haarautuva kahdeksankin kentän mitassa —
  muoto puhuu askelista, ja kahdeksan kenttää on seitsemän askelta vain jos
  mikään niistä ei ole haara.
- **Uudet kentät tulevat perään eivätkä väliin.** Tunniste on avain
  tallennukseen ja salaisuuslaskuriin, ja piilotetut tiilet ovat *sijainnin*
  hajautus — kentän siirtäminen arpoisi sen jokaisen salaisuuden uudelleen.
- **Järjestys on: generoi ensin, kytke kartalle vasta sitten.** `gen-levels.mjs`
  lataa vaikeusmittarin, joka kävelee koko pelin, eli se kaatuu jos kartalla on
  solmu kenttään jota ei vielä ole. Aja `--world wN`, niin muut maailmat eivät
  liiku.
- ✔ **Maailma 8 oli eri työ kuin muut** — tehty 10.8.2026. Kaksi kenttää lisää,
  molemmat pomohuoneita (ei lippua, katto joka sarakkeen yllä), ja ne tehtiin
  käsin: generaattorissa **ei ole areenapalikkaa**, ja se on yhä nimetty puute
  eikä yllätys. Kaksi asiaa jäi kirjatuksi: **uusintoja on seitsemän eikä
  kuusi**, koska linnakkeita on seitsemän ja jättiläinen on niistä kahden pomo
  (4-F ja 5-F) — vanha portti "jokainen variantti kerran" oli tosi vain
  sattumalta — ja **megapomo vaihtaa verbin eikä numeroa**: pierukuningas
  (variantti 6) vastaa osumaan ottamalla seuraavan linnakkeen liikesarjan, eli
  jokainen numero jonka hän kantaa on jonkun toisen numero.
- ✔ **Maailma 4 oli ahtain paikka kahdesta suunnasta** — tehty (v26.08.10.49).
  Käyrässä sen ylä- ja alapuolella oli +17,5 ja +66,8, ja molemmat varoitukset
  osuivat. Katto-osuus: generoitu tehdaskenttä **kattoi rivin 0** (`ceilingPass`
  maalasi rivistä 3 ylöspäin), maailma 4 nousi 56,6 %:sta **79,4 %:iin** ja
  maailman 8 portti kaatui. Kansi roikkuu nyt riveillä 2–3 ja osuus on 27,1 %.

Alla oleva teksti on kirjoitettu ennen tätä päätöstä; kohdat 1–3 pitävät yhä,
kohta 4 on tehty. Se on eri tilanne kuin se jossa tämä kohta
kirjoitettiin (6 maailmaa, 26 kenttää), ja ero kannattaa lukea tarkkaan:
**maailmojen tekeminen ei ollut se kallis puoli, ja se on nyt tehty.**
Jäljellä oleva työ on kenttiä olemassa oleviin maailmoihin, mikä on täsmälleen
se työ jota varten generaattori on olemassa — ja se tekee kohdan 1 päätöksestä
helpomman eikä vaikeamman.

**Luumaailma (v26.08.09.33) on ensimmäinen mittapiste tälle kohdalle**, ja sen
hinta kannattaa lukea ennen kuin seuraavia luvataan: yksi maailma käsin on
teema (paletti, taustat, palikat, musiikki), yksitoista palikkaa, kolme
kenttää, linnake, karttaruudukko ja pomo. Se on tehtävissä, mutta kohdan 1
suositus — käsin vain ensimmäinen ja viimeinen kenttä — näyttää sen jälkeen
oikeammalta eikä vähemmän oikealta.

**Pilvimaailma (v26.08.09.36) on toinen mittapiste, ja se maksoi saman.**
Kaksitoista palikkaa, kolme kenttää, linnake, kartta, pomo ja oma sävellys.
Kaksi mittausta kannattaa säilyttää: **hinta ei laskenut toisella kerralla**
(sama työ, sama määrä osia), ja **kaksi maailmaa peräkkäin käsin nosti
vaikeuskäyrää +8,0 ja +14,9**, eli käsityö ei automaattisesti tuota isoa
askelta. Kolme jäljellä olevaa maailmaa samalla tavalla on siis noin kolme
kertaa tämä työ, ja kohdan 1 suositus on yhä lukematta ratkaisematta.

**Viimeinen linnake (v26.08.09.42) on kolmas mittapiste, ja se maksoi
vähemmän — koska se ei ostanut teemaa.** Yhdeksän palikkaa, kuusi kenttää,
kartta, ei uutta pomoa ja lainattu sävelmä. Kaksi mittausta säilytettäväksi:
**teema on se kallis puoli**, ei kenttien määrä — kuusi kenttää valmiilla
paletilla ja valmiilla pomoilla oli halvempi urakka kuin kolme kenttää uudella
teemalla — ja **maailma jonka ero on muodossa on yhtä mitattavissa kuin
maailma jonka ero on paletissa**, kunhan väitteet kirjoitetaan lukuina
(askelia 6 vs 4, kattoa 100 % vs 57 %, lippuja 0 vs 3, pomoja 6 vs 1).
Vaikeuskäyrä nousi +21,8, eli enemmän kuin kummallakaan käsintehdyllä
teemamaailmalla (+8,0 ja +14,9).

**Tilanne muuttui 9.8.2026: neljästä esteestä kaksi on poissa ja yksi halpeni.**
Kohta 3 (vaikeuskäyrän mittari) on tehty — muototarkistus lukee nyt tasoja eikä
jonoa, koska haarautuva kartta vaati saman. Kohta 4:n edellyttämät palaset ovat
olemassa: minipomo ja haarautuva kartta ovat tuotannossa, eli kahdeksan kentän
maailmalle on nyt oikeasti jotain laitettavaksi. Ja kohta 1 halpeni, koska
generaattori osaa nyt koko ruutusanaston (`%`, `S`, `*`, salaisuudet) eikä enää
tuota mekaniikattomia kenttiä.

**Jäljellä on siis yksi:** paljonko tehdään käsin. Teemat ovat kasassa
(v26.08.09.36) ja kahdeksas maailma on tehty (v26.08.09.42), joten tämä kohta
ei enää koske maailmoja lainkaan — se koskee sitä, miten kahdeksasta neljän
kentän maailmasta tulee kahdeksan kahdeksan kentän maailmaa. Maailma 8 on
samalla ensimmäinen todiste siitä että maailman ei tarvitse olla neljä kenttää:
se on kuusi, eikä mikään moottorissa vastustanut sitä.

Alkuperäiset neljä, tila merkittynä:

1. ✔ **Ratkaistu 9.8.2026: uudet kentät generoidaan, käsin ei tehdä enää
   yhtään.** Omistajan päätös, ja suositus "ensimmäinen ja viimeinen käsin"
   jäi käyttämättä siitä syystä että käsintehdyt kentät ovat jo olemassa —
   maailmoissa 1 ja 3 ne kolme opettavaa kenttää ja linnake ovat se käden osuus,
   ja generaattori täyttää välin. Alkuperäinen teksti alla, koska sen
   kustannusarvio pitää yhä.

   **Käsin ei tehdä 38 uutta kenttää.** (Luku oli 42 ennen luumaailmaa.)
   Nykyiset käsintehdyt ovat maailman
   parasta sisältöä, mutta ne ovat myös hidas tapa. Generaattori on olemassa
   ja tekee jo maailman 5:n, telemetria syöttää sitä, ja tässä mittakaavassa
   se lakkaa olemasta bonusmaailman kikka ja alkaa olla se tapa jolla peli
   tehdään. Päätös jota tämä vaatii: **mikä osuus tehdään käsin.** Suositus:
   maailman ensimmäinen ja viimeinen kenttä käsin, väli generoiden ja käsin
   viimeistellen — käsi opettaa ja päättää, generaattori täyttää.
2. ✔ **Teemalista on täynnä** (v26.08.09.36). Kahdeksan teemaa kahdeksalle
   maailmalle: ruoho, aavikko, yö, jää, tehdas, luu (v26.08.09.33), **pilvi**
   (v26.08.09.36) ja linnake. Omistaja valitsi viimeisen teeman 9.8.2026, ja se
   on **pilvet**; maailma 7 on KAASUKEHÄ ja se on tehty samalla listalla kuin
   luulaakso — teema on paletti + taustat + palikat + musiikki, ei pelkkä väri
   — eli `THEMES.cloud`, `bg: 'clouds'`, `chunks/cloud.js` ja `TRACKS.cloud`.

   ✔ **Maailma 8 on viimeinen linnake, eikä se tarvinnut uutta teemaa** — tehty
   (v26.08.09.42). Linnake on ollut teemana `THEMES.fortress` alusta asti, ja
   viimeinen maailma on se paikka jossa siitä tuli koko maailma eikä yhden
   kentän huone. Musiikki on *Yö Autiovuorella* (Mussorgski 1867,
   Rimski-Korsakovin sovitus 1886), eli [DESIGN.md](DESIGN.md):n kohdan 1 b
   taulukossa ei ole enää yhtään "tulossa"-riviä.

   Molemmat tänne kirjatut varoitukset osuivat, ja molemmat maksettiin.
   **Kahden säveltäjän rivi oli kaksi tarkistusta eikä yksi**, ja portti luki
   niistä vain toisen: se vaati `composer`in ja `work`in, joten sovittaja olisi
   voinut jäädä nimeämättä ilman että mikään sanoo mitään. Portti lukee nyt
   jokaisen `source`-kentän. Ja **linnaketeeman tiilen ja maan 7,9 %** ratkesi
   rakenteella eikä paletilla: tiili ja kivi eivät ole maailmassa 8 koskaan
   vierekkäin (0 kosketusta vastaan muun pelin 14), koska kahta lähes
   samanväristä ruutua ei tarvitse erottaa toisistaan jos ne eivät kosketa.
3. **Vaikeuskäyrä on viritetty viidelle maailmalle.** Kahdeksan porrasta samaan
   väliin tarkoittaa loivempaa nousua tai korkeampaa kattoa, ja se on yhä
   päättämättä — mutta yksi mittaus on nyt tehty ja se osoittaa toiseen suuntaan
   kuin kysymys olettaa. **Kahdeksan kentän maailma 1 mittautuu helpommaksi kuin
   neljän kentän maailma 1** (125,6 → 111,3), koska sen sanasto on neljä
   mekaniikkaa leveä eikä kenttä yllä yli 112:n. Portaan korkeus ei siis ole
   pelkkä valinta: **maailman katto on sen sanaston ominaisuus**, ja
   opetusmaailmassa se on matala tarkoituksella. Mittarin puoli on sen sijaan tehty: `difficulty.mjs`:n
   muototarkistus lukee nyt tasoja eikä jonoa (v26.08.09.13), koska haarautuva
   kartta vaati saman uudelleenkirjoituksen. Ennuste piti paikkansa — kaksi
   kohtaa, yksi työ.
4. ✔ **Kahdeksan kenttää maailmassa on eri muoto kuin neljä** — päätetty ja
   tehty (v26.08.09.46), ks. tämän kohdan alku. Muoto on murrettu nyt kahdesti: maailma 8 on **kuusi** kenttää (v26.08.09.42), ja
   `tiersOf`, kartta, vaikeusmittari ja tallennus veivät sen ilman yhtä riviä
   muutosta. Se poistaa tästä kohdasta epävarmimman osan — kysymys ei ole enää
   "kestääkö moottori", vaan mitä niihin kenttiin laitetaan.
   Maailmasta 8 kannattaa lainata kaksi asiaa eikä sen sisältöä: **jokainen
   ylimääräinen kenttä tarvitsee oman kysymyksensä** (siellä ne ovat kuusi eri
   pomoa, muualla ne olisivat jotain muuta), ja **hengähdyskenttä putoaa
   syvemmälle kuin luulisi** — 8-2 on 39 % maailmansa keskiarvosta, kun
   luulaakson notko oli 56 %, koska kuilut ovat 39 % mittarin painosta ja
   niiden poistaminen vie sen kaiken kerralla.

### Salainen alue maailmaan 5

Yksi kenttä per maailma saa salaisen alueen: pavunvarsi ylös taivaalle ja putki
alas maan alle. Ei joka kenttään — löytö lakkaa olemasta löytö jos sellainen on
joka nurkassa. Maailmoissa 1–4 se on tehty (`1-2`, `2-2`, `3-2`, `4-2`;
v26.08.09.1 ja v26.08.09.8), ja `assembleTall`, kaistajako ja kaistojen
validointi ovat valmiina.

Jäljellä on maailma 5, ja se on eri työ kuin muut: sen numeroidut kentät tulevat
generaattorista, joten kaista syntyy sinne vain opettamalla `gen-levels.mjs`:lle
kolmikerroksinen kokoonpano — ja uusi generointiajo arpoo maailman uusiksi, eli
kolmen kentän mitattu vaikeus muuttuu kerralla. Oma päätöksensä.

### ✔ Tehty (v26.08.09.21): kaikki elävä hengittää

**Tehty.** Maasta kävelevät viholliset hengittävät nyt 163 framen jaksolla,
vaihesiirto oliokohtaisesti, 1 px:n amplitudi laatikon sisällä. Kuvaus alla on
jätetty siksi että se kertoo *miksi* luvut ovat mitä ovat.

#### Alkuperäinen kuvaus

Omistajan pyyntö, hänen sanoinaan: *yleinen läpikäynti joka saa kaiken elävän
hengittämään vähän, samaan tapaan kuin karttasolmut jo tekevät — niin että
spritet eivät liiku pelkästään sivusuunnassa vaan niissä on hitunen
pystyliikettä.*

Pyyntö on vanha, sitä ei kirjattu mihinkään, ja tänään se piti kysyä toista
kertaa. Se on toinen kerta kun kirjaamaton pyyntö ajelehtii — jakoruutu oli
ensimmäinen. Tämän tiedoston oma otsikko sanoo miksi se sattuu: älä luota siihen
että konteksti muistaa.

**Malli on jo olemassa, eikä sitä tarvitse keksiä.** `src/scenes/worldmap.js`
huojuttaa kaikkea kasvavaa yhdellä yhteisellä huojunnalla, jonka vaihe on
siirretty ruutukohtaisesti *"jotta naapurit eivät liiku tahdissa"*. Juuri se
siirtymä on koko temppu. Ilman sitä rivi kävelijöitä sykkii kuin tanssikuoro, ja
se ei lue elämänä vaan piirtovirheenä.

**Mikä hengittää jo, jottei sama tehdä kahdesti:** pelaajan seisonta-animaatio,
ummetuskorkki, hajupilven vaiheen ja voimakkuuden ajelehtiminen, vihaisen
auringon leijunta, kuun huojunta, esineiden huojunta ja kolikon ja tähden syke,
kuplaan vangittu vihollinen, ja karttasolmut. **Mikä ei:** kävelijät, kuoriukot,
korkkiukot, piikkiukot ja kasvit — eli juuri ne maanpinnan viholliset joita
omistaja katsoo kun hän sanoo että spritet liikkuvat vain sivuttain.

Neljä asiaa jotka tekevät tästä muuta kuin `Math.sin`in lisäämisen:

1. **Pikseliruudukko on kova reunaehto.** Spritet piirretään
   kokonaislukusuorakaiteina 320×240-ruudukolle. Alle pikselin huojunta joko
   pyöristyy — jolloin se on 1 px:n napsahdus, ja nopea napsahdus lukee
   tärinänä eikä hengityksenä — tai rikkoo sen pikseliruudukon jonka varassa
   koko kuvakieli on. Amplitudi on siis 1 px, ja **käsityö on jaksonpituudessa**:
   tarpeeksi hidas että napsahdus lukee vartalon asettumisena, tarpeeksi nopea
   että olio on elossa. Se luku löydetään katsomalla, ei valitsemalla.
2. **Se ei saa valehdella osumalaatikoista.** DESIGN.md kohta 7: mikä voi
   satuttaa, sen pitää näkyä. Jos vihollisen piirros huojuu eikä laatikko, ne
   ovat eri mieltä — ja se on täsmälleen se vika joka `Walker`ista tänään
   päätettiin korjata **kasvattamalla piirros laatikkoon eikä kutistamalla
   laatikkoa piirrokseen**. Hengitys ei saa tuoda sitä takaisin. Vaihtoehtoja on
   kaksi: huojunta pysyy laatikon sisällä, tai laatikko liikkuu mukana ja
   **jokainen törmäys pelissä muuttuu**. Ensimmäinen on lähes varmasti oikein,
   ja syy on sama kuin `Walker`in kohdalla: kävelijä on se olio jonka
   muunnelmia kaikki muut ovat, joten sen laatikon liikuttaminen mitoittaa
   tallauksen uusiksi kaikkialla.
3. **Yhteinen huojunta, siirretty vaihe.** Sama funktio kaikille, olion
   sijainnista tai id:stä johdettu vaihesiirto. Kaksi vierekkäistä kävelijää ei
   saa olla samassa vaiheessa, ja saman olion vaihe ei saa hypätä kun se
   liikkuu.
4. **Kaikki elävä ei ole vihollinen, eikä kaikki liikkuva ole elävää.** Tiili ei
   hengitä. Raja vedetään siihen: hengitys kuuluu olioille jotka esittävät
   elävää — vihollisille, kasveille, pelaajalle — eikä ruuduille, lavoille tai
   koneille. Tehtaan koneisto saa liikkua, mutta se on mekanismi eikä henki, ja
   sen liike kuuluu palikan omaan animaatioon.

Suositus: yksi jaettu apufunktio piirtokoodin puolelle (`src/gfx/sprites.js`),
1 px:n amplitudi, vaihesiirto oliokohtaisesti, laatikot koskematta — ja
jaksonpituus säädettynä silmällä ennen kuin se kirjataan vakioksi.

### ✔ Tehty (v26.08.09.22): toisen tason seisonta-animaatiot

**Tehty.** Nukahtaminen, jääpuikkohengitys ja palava tukka, laukeavat 1200
framen jälkeen (sama kuollut aika kuin esittelytilalla) ja katkeavat yhdessä
framessa. ZZZ:n symboliluonne ratkaistiin: se kuuluu samaan kerrokseen kuin
`addScorePop`, eikä skaalaudu voimatason mukana.

#### Alkuperäinen kuvaus

Pelaajalla on jo seisonta-animaatio (hengitys) ja teemakohtaiset lisät
(väristys jäässä, hiki aavikossa). Omistaja haluaa **toisen tason**: isomman,
hitaammin laukeavan ja hauskan.

| teema | mitä tapahtuu |
| --- | --- |
| tavallinen | hahmo **nukahtaa**: pää nyökkii, animoitu ZZZ nousee |
| jää | hahmo **hengittää ulos jääpuikkoja** |
| aavikko | hahmon **tukka syttyy**, ja hän sammuttaa sen paniikissa |

Viisi asiaa jotka ratkaisevat onko tästä hauska vai rasittava:

1. **Kuollut aika ennen laukeamista on koko vitsi.** Lyhyellä silmukalla gägi
   lakkaa olemasta gägi ensimmäisen tunnin jälkeen. Mittatikku on jo olemassa:
   esittelytila odottaa alkuruudulla **20 sekuntia** ennen kuin kone alkaa
   pelata itselleen. Toisen tason seisonta saa olla vähintään sitä luokkaa, ja
   nykyinen hengitys jää ensimmäiseksi tasoksi joka alkaa heti.
2. **Sen pitää katketa yhdessä framessa.** Nämä lisäävät hiukkasia ja vievät
   katseen; jos vihollinen lähestyy nukkuvaa pelaajaa, animaation pitää loppua
   *heti* eikä sykliään loppuun. Sama vaatimus kuin esittelytilalla, joka antaa
   koneen takaisin yhdessä framessa, ja samasta syystä: pelaaja ei saa koskaan
   joutua tappelemaan animaation kanssa.
3. **Kolme ideaa eivät ole samaa lajia, ja se pitää päättää.** Jääpuikkohengitys
   ja syttyvä tukka ovat **huoneen tekoja hahmolle** — kylmä ja kuumuus
   toimivat, eli ne ovat diegeettisiä siinä merkityksessä jonka DESIGN.md kohta
   8 antaa. **ZZZ on symboli**, sarjakuvan konventio jota tämä peli ei ole
   toistaiseksi käyttänyt kertaakaan. Se on hyvä idea, mutta se on *uusi
   kuvakielen laji*, ei uusi animaatio — päätä se tietoisesti äläkä vahingossa.
4. **Ei saa vaikuttaa pelattavuuteen.** Osumalaatikko ei muutu, haavoittuvuus ei
   muutu, tukan palaminen ei vahingoita. Se on esitystä ja vain esitystä.
5. **Toimittava kaikilla viidellä voimatasolla ja neljällä tehostustyypillä.**
   Sama vaatimus jonka takia animaatiokierrokset ylipäätään käydään läpi: mikä
   näyttää oikealta yhdessä koossa hajoaa toisessa.

## Seuraavaksi

### 1. Kuvaefektit: jäljellä olevat efektit

Jälkikäsittely on tuotannossa (`src/gfx/postfx.js`, v26.08.08.21): bloom
luminanssikynnyksellä, skanviivat, vinjetti, kaareva kuvaputki ja värivirhe
shaderissa, esiasetukset näppäimessä 7, fallback testattuna ja efektipassin
aikabudjetti vahdittuna (2,5 ms, toteuma 0,35 ms). Miksi hybridi eikä koko
renderöijän uudelleenkirjoitus WebGL:llä, ks. muutosloki.

Jäljellä on makuasioita ja kohdistettuja efektejä:

1. **Palettisiirto tapahtumiin**: vahinkovälähdys, pomon huoneen sävy, tähden
   välkyntä. Shaderiin yksi uniform lisää; 2D-tilassa `globalCompositeOperation`.
   Vaatii että efekti voidaan ajastaa framen tarkkuudella pelilogiikasta.
2. **Aaltoilu veden alla** odottaa vedenalaisia kenttiä. Kuumuuden väreily ja
   huurre on tehty teemakohtaisina (v26.08.08.23), ja molemmat toimivat myös
   ilman WebGL:ää.
3. **Spritekohtaiset efektit eivät kuulu tähän tiedostoon.** Jälkikäsittely näkee
   vain valmiin kuvan eikä tiedä mikä pikseli oli mikäkin olio, joten kaikki
   "vain tämä sprite" -efektit tehdään piirtokoodissa. Meillä on tähän
   epätavallisen hyvä lähtökohta: spritet ovat proseduraalisia, eli ne piirretään
   kokonaislukusuorakaiteina nimetyillä väreillä eikä bittikartoista, joten värin
   vaihtaminen on parametri eikä kuvankäsittelyä.

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

## Päätökset jotka sitovat

Nämä eivät ole tehtäviä vaan rajoja. Ne ovat täällä siksi että ne koskevat työtä
jota ei ole vielä tehty: jos joku ehdottaa ensi kuussa globaalia pistetaulua tai
kuilujen levennystä, perustelu löytyy täältä eikä muutoslokin arkistosta.

### Päätetty 10.8.2026: emergenssi ulottuu olioiden välille, muttei maastoon

Omistaja kävi läpi [IDEAS.md](IDEAS.md):n kaksitoista lainattavaa verbiä ja
päätti kohdasta 12 (*kaikki reagoi kaikkeen*, Spelunky) neljä asiaa. Ne ovat
rajoja eivätkä tehtäviä, ja tärkein niistä on se mitä **ei** oteta.

**1. Ulottuvuus: maasto → olio ja olio ↔ olio. Ei olio → maasto.**
Jää on liukas kävelijälle, tuuli kantaa kuorta, potkaistu kuori tappaa sen mihin
osuu. Mutta olio ei muokkaa kenttää. Tämä rajaus on koko turvallisuus: **kenttä
pysyy staattisena**, joten `playable.mjs`, `validateLevel` ja `difficulty.mjs`
mittaavat yhä sitä kenttää joka pelataan. Se on tasan se ehto joka kirjattiin
IDEAS.md:n läpiajossa, ja tämä päätös vetää rajan sen turvalliselle puolelle.

**2. Reiluus: pelaajaa saa satuttaa vain ketju jonka hän itse aloitti.**
Potkaisit kuoren, joten omistat sen mitä seuraa. Kaksi vihollista jotka
törmäävät keskenään voivat tappaa toisensa muttei sinua. Sääntö pitää jokaisen
kuoleman jäljitettävissä johonkin mitä pelaaja teki, mikä on sama vaatimus jonka
muu peli jo täyttää — eikä se tarvitse ruudun ulkopuolen kirjanpitoa.

**3. Vaikeusmittari mittaa yhä lähtötilan, ja sanoo sen ääneen.**
Luku pysyy vertailukelpoisena kaikkien 60 kentän ja kaiken ajan yli, mikä on
koko syy siihen että siihen luotetaan. `difficulty.mjs` tulostaa rivin joka
kertoo että emergentit lopputulokset ovat sen mittauksen ulkopuolella.
**Sanottu rajoitus on parempi kuin luku joka hiljaa tarkoittaa uutta asiaa.**

**4. Ensimmäinen erä, jokainen omalla punaisellaan:**

| laki | mitä muuttuu |
| --- | --- |
| jää on liukas kaikille | maailman 3 kitka koskee myös kävelijää ja kuorta |
| ↑ **täydennetty 10.8.2026** | ks. alla: *jää on nyt laatta* |
| murenevat lavat murenevat vihollisen alta | luumaailman lankku ei enää kanna ketä tahansa |
| tuuli kantaa kuoria ja vihollisia | pilvimaailman tuuli koskee kaikkea |
| potkaistu kuori tappaa sen mihin osuu | puhdas olio ↔ olio, ei maastoa |

**Omistajan lisäehto murenevaan lavaan: lankun on kasvettava takaisin.**
Se on tarkka ja se on syy miksi tämä laki mahtuu kohtaan 1: lava joka putoaa
vihollisen alta eikä palaa olisi olio joka muokkaa kenttää, ja silloin reitti
voisi kadota. Palautuvana se on tilapäinen tapahtuma staattisessa kentässä.

### Päätetty 11.8.2026: pomon laatikko on pomokohtainen, ja katto on 52 px (v26.08.11.70)

Kaikki seitsemän pomoa olivat 30x32 eli kaksi laattaa, ja pelkkä siluetti ei sitä
korjaa: seitsemän muotoa samassa laatikossa on seitsemän samankokoista asiaa.
`BOSS_SIZES` on nyt pomokohtainen ja piirrokset on kirjoitettu siihen.

**Katto on 52 px, ja se on mitattu eikä arvattu.** Voimatason 0 jalat nousevat
71 px paikaltaan ja 100 px vauhdista; ensimmäinen luonnos laittoi luurangon
64:ään ja kuninkaan 60:een, ja molemmat kaatoivat portin. Tätä korkeampi pomo
vaatii areenalta kannen, mikä on `boss_arena_big`in tehtävä.

**Ja 1,6:1 on levein sallittu suhde.** Ensimmäinen kokoluonnos venytti leveydet
72:een ja 76:een korkeuksien pysyessä 30:ssä ja 44:ssä, ja palaute oli oikea:
venytetty. Arcade-pomo on massaa, ja massa tarvitsee molemmat mitat. Kolme
erillistä havaintoa samasta asiasta, kaikki säilytettäviä:

- **tasakorkea palkki on ajoneuvo** millä tahansa suhteella — syöksyjän selkä on
  siksi portaikko eikä laatikko;
- **kaksi vaaleaa silmää rinnakkain tummalla rungolla on valaistut ikkunat**, eli
  bussi; sääherralla on siksi yksi valtava silmä, ja arvomerkki siirtyi pois
  silmän korkeudelta ettei siitä tule toista;
- **täysleveä vaakaviiva leikkaa siluetin kahdeksi laatikoksi** — kuninkaan
  vaippa on siksi olkapanssarit eikä mantteli.

Siluettiportin marginaali kapeni 0,771:stä 0,802:een (kynnys 0,82). Se pitää,
mutta se on ohut, ja seuraava pomomuutos mittaa sen ensimmäisenä.

### Löydetty 11.8.2026: talloportti mittasi hyppyä vain leveydestä (v26.08.11.70)

Pomokoot kaatoivat seitsemän linnaketta kahdeksasta testissä *"voimatason 0
talloo yhden avoimen ikkunan sisällä"*, ja kumpikaan syy ei ollut koko sinänsä.

**Lämmittely oli 90 framea ja työ vaatii viisitoista.** Loput 75 pomo käveli, ja
koska pelaaja asetetaan suhteessa pomoon, pelaaja asetettiin areenan
ulkopuolelle — 7-F:ssä edeltävän käytävän piikkipenkkiin. Ehto on nyt
`boss.onGround`.

**Ja lähestymismatka luettiin vain leveydestä.** Tärkeämpi puolikas oli korkeus:
**tallominen lasketaan vain laskeutuessa**, joten korkean pomon kohdalle
saapuminen nousevassa liikkeessä on törmäys eikä tallominen. Matka on nyt
`w / 2 + 25 + h`, joka palauttaa vanhat luvut 30x32:lla.

Yleistys jonka tämä ansaitsee: **portin apuluvut vanhenevat hiljaa.** Kumpikaan
näistä ei ollut väärin kirjoitettu — molemmat olivat oikein sille ainoalle
koolle joka pelissä silloin oli. Kun vakio kuvaa jotain mitattavaa, se
kirjoitetaan mitasta eikä luvusta.

### Löydetty 10.8.2026: pystykentän portit todistivat väärää asiaa (v26.08.10.69)

Molemmat pystykentät olivat ratkaistavissa **liikkumatta sivuun** — 6-K
putoamalla yhtä avointa saraketta, 7-T hyppimällä paikallaan päällekkäisten
lankkujen sarakkeessa — ja 6-K oli lisäksi voimatasolla 3–5 läpäisemätön, koska
sen ainoa reitti alas oli yhden laatan levyinen ja levein keho on 21 px.

Kaksi uutta sääntöä (`checkClimbTraverse`, `checkClimbWidth`) kattaa molemmat, ja
ne kaatoivat kolme kenttää samalla lauseella — myös `verify.mjs`:n oman
koekentän. **Kiipeilybotti oli kuitenkin läpäissyt kentät täsmälleen niillä
vioilla:** se ei osannut astua reiästä alas, hypätä sivuun ylöspäin eikä väistää
piikkejä, joten se tarvitsi avoimen sarakkeen, päällekkäiset lankut ja piikittömän
kävelylinjan. Kaikki kolme korjattiin bottiin eikä kenttiin.

**Jäljelle jäi tiedossa oleva rajaus:** `measureClimb` hinnoittelee nousut myös
laskeutuvassa kentässä, eli se mittaa kiipeämistä jota kukaan ei tee. 6-K
pidettiin neljän rivin kerroksissa osittain siksi, ja se on kierto eikä korjaus —
oikea korjaus on mitata laskeutuminen laskeutumisena.

### Päätetty 10.8.2026: jää on laatta eikä teema (v26.08.10.68)

Laki 1 kuului *"jää on liukas kaikille"* ja se oli tosi puolittain: pelaaja ei
lukenut `SURFACES`ia lainkaan, joten maailma 3 oli liukas vain vihollisille.
Vaihtoehtoja oli kaksi ja ne erosivat hinnaltaan, eivät vaikeudeltaan:

- **teemana** — pelaaja lukee teeman kuten vihollinen. Yksi rivi, ja maailman 3
  kahdeksan kenttää muuttuu kerralla. Ne on mitoitettu tavallisen kitkan varaan,
  joten se olisi ollut kahdeksan kentän uudelleensäätö yhdessä committissa.
- **laattana** — `T.ICE`, jonka saa ladota mihin tahansa. Enemmän koneistoa,
  mutta se ei muuta yhtäkään olemassa olevaa kenttää ennen kuin jäätä ladotaan
  jonnekin, ja se kantaa maailmaa 3 pidemmälle.

**Valittiin laatta.** Koneisto on sama muoto kuin juoksuhiekalla ja möykyllä:
laatta, sääntö (`checkIce`), hinta mittarissa (`precision`in toinen kynnys),
opetuspaikka opetussuunnitelmassa. Teema jäi voimaan vihollisille, koska ne on
mitattu sen kanssa — mitattu käytös ei muutu vahingossa kumpaankaan suuntaan.

**Yhä tekemättä ja tahallaan:** maailmaa 3 ei ole jäädytetty. `ice_crumble`,
`ice_pit` ja `ice_twin` on kirjoitettu ikään kuin lattia olisi liukas, mikä ei
ole koskaan ollut pelaajalle totta — ja niiden luvut on mitoitettu tavallisen
maan liu'ulle, joten jään latominen niihin on eri työ ja mitattava erikseen.
Nyt se voidaan tehdä yksi kenttä kerrallaan, mikä oli koko syy valita laatta.

### Päätetty 10.8.2026: kaistan vilkaisu on katsomista, ei kulkemista

Kohta 4 ([IDEAS.md](IDEAS.md), *litteä maailma käännetään*, Super Paper Mario),
kolme päätöstä.

**1. Vain näkeminen — läpi ei astuta.** Naapurikaista näkyy hetken
läpikuultavana, mutta sinne pääsee yhä vain putkella tai varrella. Tämä on
halvin versio validoida, ja se on koko syy valintaan: **kenttägraafi ei muutu
lainkaan**, joten `rules.js` todistaa yhä yhden kaistan eikä kaistojen välistä
graafia. Se raskaampi versio on sama ongelma kuin areenaa muokkaavalla pomolla.

**2. Hinta: täysi vauhtimittari, ja se tyhjenee.** Mittari on jo varattu
kahteen asiaan (nopeuskatto 2,5 → 3,5 ja kaasulehden lento), joten katsominen
maksaa juoksemisen tai lentämisen. Ilman hintaa tämä ei olisi kyky vaan tutka,
ja silloin koko salaisuusrakenne — kartta kertoo *että* niitä on muttei
*missä* — kuolisi kertakäytöllä.

**3. Suunta: aina luolakaista, alaspäin.** Yksi nappi, yksi merkitys. Perustelu
on tuore ja kallis: kartan nuolissa oli tasan tänään vika jossa yksi syöte ei
osunut mihinkään suuntaan ja pelaaja jäi jumiin. Luolakaista on lisäksi se jossa
salaisuudet ovat, eli se jonka katsominen on täyden mittarin arvoista.
Laajentaminen ylöspäin on myöhemmin halpaa; kahden napin järjestelmän
peruuttaminen ei ole.

**Kumpikaan näistä kahdesta ei ole vielä aikataulussa.** Ne ovat päätöksiä
siitä *mitä* rakennetaan jos rakennetaan, eivät lupauksia siitä että
rakennetaan.

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

**Ehdot 1–3 ovat nyt graafin ominaisuuksia eivätkä muistettavia** (v26.08.09.13):
`worldProblems` hylkää kartan jossa jokin kenttä ei ole millään reitillä, jossa
haara on ilmoittamatta, jossa palkitsematon reitti ei vie läpi, tai jossa
palkinto ei ole mitatusti vaikeammalla reitillä.

**Jäljellä:** muut maailmat ovat yhä haarattomia. Koneisto on yleinen, ja rakenne
oli jo valmiiksi lähellä — kartta on solmuja ja linkkejä, ja `isLinkOpen` päättää
polun avoimuuden — joten lukitut polut ja oikoreitit ovat muuallakin pääosin
kenttädataa.

### Päätetty 9.8.2026: haaran palkinto ja vaikeuden näyttäminen

Vastaukset ehtoihin yllä, ja ne kytkevät kolme roadmapin kohtaa yhdeksi työksi:

- **Palkinto on murtava tehostus, jonka pudottaa minipomotaistelu**, ja
  **minipomo on sen ainoa lähde.** Taistelun sijoittaminen vaikeampaan haaraan ei
  siis luo ristiriitaa vaan poistaa sen: murtava tehostus, minipomo ja haarautuva
  kartta ovat yksi työ kolmen kilpailevan sijaan. Taistelu on myös helppo näyttää
  kartalla ennen sitoutumista.
- **Vaikeus näytetään kahdella tavalla yhtä aikaa:** haaran polku värjätään ja
  jokainen kenttäsolmu saa pisteet. Polku vastaa kysymykseen "kumpi on
  vaikeampi" siinä hetkessä kun valinta tehdään, pisteet kysymykseen "kuinka
  vaikea tämä on" kun perille tullaan. Väri yksin on heikoin kanava, joten
  pisteet ovat se mikä tekee värin turvalliseksi.
- **Haaran vaikeus on sen vaikein kenttä**, ei keskiarvo: kierroksen kaataa
  reitin pahin kenttä eikä sen keskiarvo. Haaran oma luku on sen sijaan helpoimman
  reitin luku — perustelut molemmille suunnille v26.08.09.13.

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
jälkeen ja paremmin tiedoin. Toteutettu v26.08.09.10.

### Peruttu 9.8.2026: kuilujen levennys uudelle hyppybudjetille

Maailmojen 1–4 uudistuksessa oli neljäs kohta, kuilujen levennys, ja se
peruttiin. Peruste oli lause "kuilut on mitoitettu vanhalle budjetille (6
ruutua), kun juoksuhyppy kantaa nyt 12,5". **Juoksuhyppy kantaa 9,7 ruutua.**
Luku 12,5 tuli `tools/jump-budget.json`ista, joka oli väärässä siitä commitista
asti joka sen kirjoitti.

Kentät eivät siis ole liian helppoja sillä perusteella jonka tämä kohta esitti,
eikä 22 kentän kuilujen levennys ole tasapainotusta vaan tuntemattoman suuruinen
muutos tuntemattomaan suuntaan. **Jos kentät joskus tuntuvat helpoilta, se
korjataan pelaamalla ja mittaamalla eikä laskutoimituksella joka on jo kerran
osoittautunut vääräksi.**

Muut kolme kohtaa on tehty (tehtaan pääntila, tehostuspalikka jokaisen kentän
alkuun, tyhjät laattapolut; v26.08.08.15), ja validaattori on puhdas kaikille
kentille — tästä eteenpäin sääntörikkeen ilmestyminen on regressio.

### Päätetty 9.8.2026: kuvaputki on oletusefekti

Pääsuunnittelijan valinta, ja **se oli jo oletus** (`postfx.js:333`, sama varalla
rivillä 387) — eli koodiin ei tarvittu muutosta, mutta valinta on nyt tehty eikä
peritty. Ero on se että sitä ei enää muuteta vahingossa.

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
2. ✔ **Mobiili-Safari, kaksi vikaa.** Zoomiloukku ja ohjainten asettelu,
   molemmat korjattu (v26.08.09.8): kaksoisnapautuksen zoom kiinni ilman että
   nipistys menee mukana, ja uusi `rulla`-malli. **Kumpikaan omistajan
   ehdotuksista ei toiminut sellaisenaan**, ja jälkimmäisestä jää sääntö
   voimaan: kolmas virtuaalinappi olisi lisännyt tilan, ja tila on asia joka
   pitää oppia ja johon voi jäädä jumiin.
3. ✔ **Jakoruutu, kevyt toteutus** (v26.08.09.8). Kevyt tarkoitti tässä
   **selainpuolta ja vain sitä** — `navigator.share` ja leikepöytä, ei
   palvelinta. Sama peruste kuin telemetrian kohdassa 4, ja täällä vielä
   painavampi: pelaajat ovat lapsia.
4. ✔ **Törmäystuntuma.** "Laskeutuessa liikkuu vielä sivuttain, eikä ehdi
   väistää vihollista jota kohti on menossa." Mitattiin ennen kuin korjattiin,
   ja mittaus osoitti muualle kuin oire: syy oli ilmassa jarruttamisen ehto
   (v26.08.09.8). Sääntö joka jää voimaan: `PHYSICS.md`:n vakiot eivät ole
   vapaasti säädettävissä — ne mitoittavat koko pelin vaikeuskäyrän — joten
   "toimii kuten suunniteltu, tässä luku" on kelvollinen lopputulos
   pelituntumaa koskevaan valitukseen.
5. **Kahdeksan maailmaa ja kahdeksan kenttää kussakin.** Ks. *Kahdeksan
   maailmaa, kahdeksan kenttää kussakin* kohdassa Jonossa.

### Muut sitovat päätökset ovat omissa kohdissaan

- **Maahanisku tehdään, ja piikit voittavat sen** — tehty (v26.08.09.31), ja
  piikit voittavat sen. Ks. *Maahanisku* kohdassa Jonossa.
- **Pomo järjestää areenan uusiksi**, ei halvempaa laattojen irrottamista — ks.
  *Ruutuefektit ja neljännen seinän rikkominen*, kohta 4.
- **Telemetriaa ei lähetetä palvelimelle** — ks. kohta 2, vaihe 4.
- **Jokaiselle pomolle oma ääni, jaetut toimintaäänet** — ks. Myöhemmin.

## Kuolleiden lippujen auditointi 9.8.2026

Kolme kuollutta lippua löytyi päivän mittaan vahingossa, joten koko koodi
käytiin läpi (commit `1353654`). Työkalut jäivät istunnon mukana, mutta
löydökset ovat tässä.

**Oikaisu ensin, koska se oli minun virheeni:** `note`-lippu on kuollut, mutta
**nuottipalikka ei ole**. `bumpTile` kysyy `ch === T.NOTE` pitkin kirjaimin ja
asettaa `vy = -6.2` sekä soittaa `kick`in — palikka siis **pomppauttaa**.
Todennettu pomppaamalla kaikki neljä selaimessa. Se on sama tarina kuin ovella:
ilmoitettu lippu, pitkin kirjaimin kysytty kysymys, toimiva mekaniikka. Aiempi
väite "ei tee mitään" oli väärä.

### Taso A — kyky joka koodissa on ja jota peli ei koskaan pyydä

1. ✔ **Korjattu (v26.08.09.24): ruskea pilvi oli pysyvästi vihainen.**
   `drawStinkCloud(…, angry)` sai molemmilta kutsupaikoilta kirjaimellisen
   `true`:n, joten rauhallista naamaa ei piirretty koskaan eikä olion *oikea*
   `angry`-tila (kuplasta karannut, `ANGRY_SPEED` 1,6×) ohjannut sitä. Naama
   seuraa nyt oliota, ja kuolevakin pilvi piirtyy omalla tilallaan — §8, ei
   siisteys: kaksi samannäköistä merkkiä opettaa lukemaan väärin. Mitattu ero
   kahden muuten identtisen pilven välillä **0 px → 8 px**.
2. `drawNote(…, bumped)` saa kovakoodatun `false`:n. Kuollut haara elävän
   mekanismin takana — `drawTiles` siirtää palikkaa yleisellä bump-siirtymällä,
   joten liike näkyy silti.
3. `drawItem(…, opts)`:n `tint` ei tule yhdeltäkään pelin 11 kutsupaikasta,
   vain `verify.mjs`:stä.

### Taso B — seitsemän lippua lisää oven kaavassa

`TILE_INFO`:n oikeat kuluttajat ovat `solid, semi, climb, warp, door, bumpable,
question, switch`. Kuolleita: `note`, `breakable`, `pipe` (×6), `crumble`,
`coin`, `hazard` (×2), `goal`. Jokainen niiden nimeämä käyttäytyminen on
olemassa `ch === T.X`:nä. Pelaajaan ei vaikuta; hinta on se että ne näyttävät
elävältä.

### Taso C — siivousta (16 kpl)

`Game.pauseBlink`, tilatallennuksen `stamp`, `slotLabel` (ei yhtään kutsujaa),
`Music._section`, `KEY_PLAN`, `PostFX._program`, `Touch._zones`, `C.purple`,
`flat8` (ainoa kuollut palikka 88:sta), `CAUSES`, `RULE_CONSTANTS`, `MAP_W`,
`TRACK_NAMES`, `drawCrumble`in `tx/ty`, `warpLands`in `w`, `Sfx.oof`.

**Koe:** kaikki 34 ehdokasta poistettiin kerralla ja portti pysyi vihreänä.

### Mitä tällainen auditointi ei voi tietää

Repossa on 736 dynaamisen avaimen käyttöä ja `savestate.js` käy läpi jokaisen
olion jokaisen oman kentän, joten nimien törmäys eri olioiden välillä on se
vaikea osa — juuri se piilotti `note`n. Vihreä portti ei ole kattavuus, eikä
lukemalla erota "hylättyä" ja "ei vielä kytkettyä".

Ja auditointi teki itse sen virheen jota vastaan se varoitti: ensimmäinen
versio työkalusta luuli `this.life / this.maxLife`-lauseketta sijoitukseksi,
eikä käynyt oikeaa puolta läpi — kuusi itsevarmaa väärää löydöstä, kaikki
kenttiä joita luetaan joka framessa.

## Avoimet kysymykset

### Tilanne 10.8.2026 illalla: kymmenen avointa kysymystä, kaikki suljettu

`MEGABOSS`, `maailma 2 kahdeksaan`, `pystykenttä maailmaan 7`, `kaivautuva
kenttä luumaailmaan`, `kamera 2-1:ssä`, `4-3 voimatasolla 0`, `kuollut
fort_*-sanasto`, `äänten kaksoismerkitykset`, `neljä vihollista
kontrastikynnyksen alla` ja `oneup joka ei ilmesty` — kaikki tehty samana
päivänä, kukin omalla punaisellaan. Perustelut ovat muutoslokin merkinnöissä
v26.08.10.58 … .62.

**Peli on siis valmis siinä mielessä että sillä ei ole enää velkaa.** Kaikki
alla oleva on lisäystä eikä korjausta.

### Jäljelle jääneet rippeet, kaikki pieniä ja kaikki mitattuja

Nämä löytyivät päivän töiden sivutuotteina, eikä yksikään ole rikki — ne ovat
epäsiisteyksiä joilla on numero.

1. **Neljä orpoa palikkaa** `src/data/chunks/fortresses.js`:ssä
   (`pyre_ledge`, `crypt_ossuary`, `crypt_stair`, `spire_squall`) — samaa
   velkaa kuin `fort_blocks`/`fort_trench`, jotka poistettiin. Portti nimeää ne
   yksitellen, joten viides orpo punastuttaa heti.
2. **`powerup` soi yhä kahdessa väärässä paikassa:** kartalla kun esine menee
   varastoon (kentän puolella sama korjattiin `reserve`llä), ja kahdessa
   esineenpudotuskohdassa `entities/enemies.js`:ssä (molemmat ovat `payout`).
3. **`LETTERBOX_BAR`:n kommentti väittää korkeimman hypyn nousevan 100 px.**
   Mitattu budjetti sanoo **174** juoksevalle pieruhypylle. Vanhentunut väite
   kantavan vakion vieressä.
4. **`gen-levels.mjs`:n reseptiproosa siteeraa `6-3`:a ja `7-2`:ta** niinä
   käsintehtyinä ankkureina joista maailmojen 6 ja 7 `density`, `maxGap` ja
   `aim` on mitattu. Kumpikaan ei enää toimiteta (ne korvattiin pystykentillä).
   Mikään ei ole rikki tänään, mutta generaattorin uusinta-ajo mittaisi
   olemattomasta.
5. **Maailmat 2 ja 8 eivät esittele uusia asioita loppupäässään** (`MYKKIÄ` 2
   kummassakin). Rakenteellista: kummankin sanasto on jo täynnä, joten uusi
   mekaniikka olisi lainattava toisesta maailmasta ja rikkoisi
   opetusjärjestyksen.
6. **Notko `2-4 → 2-5` on 13,1 pistettä** ja portti lukee etumerkin, joten
   kumman tahansa kentän muokkaus voi kääntää sen.
7. **Päivän pierun todistettu ikkuna päättyy 9.8.2029.** Portti varoittaa alle
   90 päivässä; uusiminen on yksi komento.

### Päätetty muttei aikataulutettu

Nämä ovat päätöksiä siitä *mitä* rakennetaan jos rakennetaan, ja ne ovat
omissa kohdissaan ylempänä: **emergenssin ensimmäinen erä** (neljä lakia:
jää kaikille, murenevat lavat vihollisen alta lankku palautuen, tuuli kantaa
kuoria, potkaistu kuori tappaa) ja **kaistan vilkaisu** (vain näkeminen, hinta
täysi vauhtimittari, aina luolakaista alaspäin).

[IDEAS.md](IDEAS.md):ssä on lisäksi omistajan tuomiot kaikkiin kahteentoista
lainattavaan verbiin: **kyllä** kohdille 1 (vauhti korkeudeksi), 6 (syö
vihollinen, saat kyvyn) ja 10 (putoavat lohkot yhdelle laattatyypille), ja
**harkintaan** kohdalle 11 (ammuksen voi ratsastaa).

### Päätetty 10.8.2026: kuutta pelitilaa ei rakenneta

Kahdeksan pelitilaa suunniteltiin ja esitettiin kortteina työarvioineen.
Omistaja valitsi kaksi, ja ne on tehty: **AIKA-AJO** (v26.08.10.55) ja
**PÄIVÄN PIERU** (v26.08.10.57). Lopuista kuudesta hän päätti samana päivänä:
**näitä ei rakenneta.**

Merkintä on tässä siksi että **hylätty idea ilman kirjausta palaa takaisin
samana ideana**, ja nämä kuusi ovat kaikki riittävän houkuttelevia palatakseen.
Suunnittelutyö on tehty ja se on tässä valmiina jos päätös joskus kääntyy, mutta
se ei ole jonossa eikä sitä pidä ehdottaa uudelleen ilman uutta syytä.

| tila | mitä se on | työarvio |
| --- | --- | --- |
| **PIKKUINEN** | koko peli voimatasolla 0, jokainen tehostus kolikkona | 1 |
| **YHDELLÄ HENGELLÄ** | yksi elämä, ei jatkoja, ei tilalatauksia | 1 |
| **POMOKIERROS** | kahdeksan pomoa peräkkäin, yhteinen elämäpotti | 2 |
| **AARTEENETSINTÄ** | maali ei ole päämäärä, löytäminen on | 2 |
| **ARVOTTU MATKA** | kartta arvotaan joka ajolle mitatusta vaikeudesta | 3 |
| **PIERUMARATONI** | loputon kenttä, palikat liitetään edellä | 5 |

Yksi niistä kannattaa tietää erikseen jos päätös joskus kääntyy: **PIKKUINEN on
ainoa jonka läpäistävyys on jo todistettu.** Kohta 5 vaatii että maareitti on
läpäistävissä pienimmällä koolla, `tools/playable.mjs` mittaa sen joka ajolla, ja
10.8.2026 alkaen se on tosi **kaikista 64 kentästä**. Tila olisi siis kytkin
olemassa olevan invariantin päällä eikä uusi lupaus.

Ja yksi hylättiin jo suunnitteluvaiheessa, perusteluineen: **PEILI** (kentät
vaakasuunnassa käännettyinä). `tools/playable.mjs` juoksee ja hyppää vain
**oikealle**, joten peilatuista kentistä se ei voisi todistaa mitään, ja kohdan 5
takuu lakkaisi hiljaa koskemasta koko peliä. **Tila joka maksaa turvaverkkonsa
on kalliimpi kuin diffinsä.**

## Myöhemmin

- **Päätetty 9.8.2026: jokaiselle pomolle oma ääni.** Nyt niitä on yksi:
  `Sfx.play('boss')` soi kaikille neljälle linnakevariantille, nyrkkeilijälle ja
  jättiläiselle.

  **Ääni voi kertoa kuka tämä on tai mitä juuri tapahtui, ja ne ovat eri työt.**
  Päätös: **oma ääni, jaetut toimintaäänet.** Jokainen pomo saa oman äänensä —
  tulon huudon, murahduksen osumasta, kuolinparkaisun — omalla korkeudellaan,
  omilla formanteillaan ja omilla sanoillaan. Mutta iskuaalto, laskeutuminen ja
  piikit kuulostavat samalta joka pomolla, jotta "tuo tarkoittaa iskuaaltoa"
  opitaan kerran eikä kuutta kertaa. Tämä on sama sääntö joka on jo kirjattu
  maahaniskun kohdalla: kaksi samannäköistä "jotain tapahtui" -signaalia
  opettavat lukemaan väärää.

  Rakentuu konsonanttien päälle (ks. muutosloki): puheääni jolla on vain
  vokaaleja ei voi sanoa eri asioita, se voi vain huutaa eri korkeuksilla.
- **Lisää pomovariaatioita** — nyt neljä, ja 5-F on uusinta 4-F:stä.
- **Kenttäsäännöt käsintehdyille kentille pakollisiksi.** Nyt ne kaatavat ajon
  vain generoiduissa; kun maailmat 1–4 on korjattu, kytke sama koko peliin.
- **Nimen tavaramerkkiriski** ([DESIGN.md](DESIGN.md) kohta 2), jos peliä
  levitetään laajemmin tai siitä otetaan rahaa.

## Tiedossa olevat rajoitukset

- Botti `verify.mjs`:ssä osaa vain juosta ja hypätä, joten sen kuolemat
  vihollisiin ovat normaalia. Vain FAILURES-rivit merkitsevät.
- ✔ **4-3 ei ollutkaan rikki, botti oli** — selvitetty 10.8.2026. Kenttä ei
  liikkunut ruutuakaan. Botti luki maastoa siltä riviltä jolla se *seisoi*,
  joten kahden ruudun pilarilta sarakkeessa 220 askelma alas näytti 14 ruudun
  kuilulta; se hyppäsi täydellä pidolla, lensi viiden ruudun
  vauhdinottosuoran yli ja putosi siihen kuiluun jonka se olisi pitänyt
  mitata. Samalla korjauksella aukesi **2-1**, joka oli ollut listalla
  "tuplahypyllä läpi mutta ei ilman" ilman että kukaan oli sitä maininnut.
  Kaikki 60 kenttää ovat nyt läpäistävissä voimatasolla 0, ja se on portti
  `verify.mjs`:ssä eikä raportti.
- **Ajastettua ääntä ei voi mitata kellolla.** `sprout`in sisällä on tauko,
  joten "onko väylä hiljaa" pitää kysyä kahdelta peräkkäiseltä ikkunalta ja
  samalta ikkunalta jolla tulos mitataan (v26.08.09.26). Jos uusia pitkiä
  ääniä tulee lisää, tämä on se kohta joka pettää ensimmäisenä.
- Pistetaulu on selainkohtainen (localStorage), ei jaettu laitteiden kesken.
- Rytmitilastojen louhinta vaatii ulkoisen korpuksen (`VGLC_DIR`), jota ei
  säilytetä repossa. Aja generaattori aina `VGLC_DIR` asetettuna, jotta
  samankaltaisuustarkistus on päällä.
- **Uusi ruutumerkki on neljä paikkaa eikä yksi.** `TILE_INFO`in lisäksi se pitää
  lisätä `src/data/rules.js`:n `SOLID`-joukkoon ja generaattorin sanastoon, tai
  validaattori lukee esimerkiksi murenevan lavan kuiluna ja generoi mahdottomia
  kenttiä. **Neljäs on `tools/difficulty.mjs`** (v26.08.09.35): ruutu jota
  mittari ei tunne maksaa nolla, jolloin jokainen sen sisältävä kenttä mitataan
  helpommaksi kuin se on — ja koska maailman käyrän muoto on nyt portti
  `verify.mjs`:ssä, väärä luku ei ole vain väärä raportti. Piikkikävelijä teki
  tämän virheen ja juoksuhiekka olisi tehnyt sen perässä.
  Ja kaikki neljä eivät ole sama päätös: ruutu voi olla jotain muuta kuin
  kiinteä tai ilma. Juoksuhiekka ei ole kummassakaan joukossa vaan omassaan
  (`SINK`), koska se on **läpäistävää astinta** — perustelu on kirjoitettu auki
  `rules.js`:ään sen joukon viereen.
