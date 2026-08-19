# Roadmap ja työlista

Tämä tiedosto on työn muisti: mitä on kesken, mitä seuraavaksi ja miksi.
Päivitä se kun tila muuttuu — älä luota siihen että konteksti muistaa.
Valmistuneet asiat siirtyvät [CHANGELOG.md](CHANGELOG.md):hen perusteluineen.

**Työtapa:** deployaa jokaisen pienenkin korjauksen jälkeen. Peliä pelataan
tuotannosta, joten korjaus joka odottaa committia ei hyödytä ketään. Portti
ennen pushia on `node tools/verify.mjs`.

---

## Tila 17.8.2026 — HUD purettiin, ja mitä siitä seuraa

**Tehty tänään** (yksi erä, `node tools/verify.mjs` vihreä):

- Pisteet ovat neliöitä (`src/core/points.js`), koko pistetaulukko yhdessä
  tiedostossa ja portti joka vaatii jokaiselta arvolta kokonaisen neliöjuuren.
- Kolikkoputkilo vasemmassa reunassa: sisätila on tasan sata kolikkoa, ja
  poimitut kolikot lentävät siihen. `KOLIKOT nn` poistui.
- Aurinko on kentän kello, kentän nimi kirjoitetaan taivaalle savuna,
  vauhtimittari näkyy kaasusuihkuna kehossa, tehostuspallot poistuivat.
- **HUD-nauha purettiin kokonaan.** Ikkuna on 320×240, ja lukemat joko ovat
  maailmassa tai ilmestyvät nurkkaan silloin kun niillä on asiaa
  (`drawOverlay`, piirretään kuvaefektien jälkeen).
- Maahanisku kaataa kumoon (piikikkäät mukaan lukien), kupla jäi kaasupallon
  yksinoikeudeksi, karannut kuori katoaa, ilmassa on korkeintaan kaksi palloa.

### Hyväksytty hinta: 15 riviä näkyvissä

Ikkuna kasvoi 208 → 240 px. **Tavallinen kenttä on 15 riviä eli täsmälleen 240
px**, joten pystysuuntainen kamera ei enää liiku niissä: koko kentän korkeus
näkyy kerralla, myös ne kaksi ylintä riviä jotka ennen jäivät ruudun
ulkopuolelle. Pystykentät (40–50 riviä) ja kirjekuoripalkitetut (2-1, 2-3)
vierivät kuten ennen.

Omistajan päätös 17.8.2026: **hyväksytään tämä nyt.** Se on tietoinen vaihto —
ilmestyvät lukemat ja koko ruudun kuva vastaan pystyvieritys tavallisessa
kentässä — eikä vahinko.

**✔ Isompi refactor tehty 18.8.2026** (v26.08.18.30). Kolme asiaa, ja kaksi
niistä meni toisin kuin tässä arvattiin:

1. ✔ **Kenttädata 15 → 16 riviin.** Pystyvieritys palasi ja se on mitattu:
   kamera liikkuu 1-1:ssä 16 px, letterboxatussa 2-1:ssä 48 px (varaa 64) ja
   kaistoitetun 1-2:n reittikaistan sisällä 14 px. **Rivi tuli päälle eikä alle**, ja se ei ollut
   makuasia: alle lisätty olisi antanut vierityksen muttei yhtään lisää tilaa
   hypylle. Päälle lisätty siirtää lattian alemmas ja kannen kauemmas, joten
   maastopassin `MAX_LIFT` nousi yhdestä kahteen — 30,38 px varaa + 16 px = 46,4,
   ja kahden laatan nosto vie siitä 32.

   Ja se tuli **kokoajaan eikä kenttädataan**, toisin kuin tässä oletettiin:
   palikkatiedostot ovat yhä 15 riviä lattioineen riveillä 13-14 (370
   rivimerkintää kahdessatoista tiedostossa), ja `data/chunks.js` lisää yhden
   rivin. `CHUNK_ROWS` ja `BAND_ROWS` ovat kaksi eri lukua, ja niiden ero on
   koko muutoksen sisältö. Taivasrivi on **kopio ylimmästä** eikä tyhjä, koska
   katot ja pavunvarsi jatkuvat ylöspäin.
2. ✔ **Vaikeusmittarin ruutukorkeus.** `SCREEN_ROWS` 13 → 15, ja portti vertaa
   sen `VIEW_H`iin — leveydellä sellainen oli, korkeudella ei. **Mitattu
   vaikutus vaikeuslukuihin oli nolla**, eli tässä arvattu "ajaa koko taulun
   uusiksi" ei pitänyt paikkaansa: luku vaikuttaa vain kiipeilykenttien
   putoamisiin eikä yksikään putoaminen ollut kahden laatan päässä rajasta.
3. **Ylimmät rivit kenttäsuunnittelussa — jäi tekemättä.** Rivi 0 on nyt
   kokoajan lisäämä taivasrivi eikä kenttäsuunnittelijan käytettävissä, joten
   kysymys siirtyi: se ei ole enää "mitä riveillä 0-1 on" vaan "mitä 16 rivin
   kentän ylimmillä riveillä *kannattaisi* olla". Salaisuuksia ei käyty läpi.

   **Ja yksi asia joka ei ollut tässä listassa lainkaan:** jokainen piilotiili
   koko pelissä arvottiin uudestaan, koska ne ovat sijainnin hajautus ja jokainen
   ruutu siirtyi rivin alaspäin. Mitattuna 98 → 79. Pikatallennuksen versio
   nousi kakkoseen samasta syystä — tilannekuva kantaa koko ruudukon, ja vanha
   15-rivinen palautuisi kenttään jonka alin rivi puuttuu.

---

## Tila 16.8.2026 (ilta)

Omistajan viisi pyyntöä yhtenä eränä (v26.08.16.85): **maahaniskun kyykky**,
**tiilen rikkominen ylhäältä**, **neljä uutta vihollista**, **mitatut
hyppysarjat** ja **supertähden oma raita**. Kaikki perustelut ovat
muutoslokissa; tähän jää se mikä koskee tulevaa työtä eikä näitä viittä.

**Vaikeus on sanastokysymys ennen kuin se on määräkysymys.** Peli oli
normaalilla liian helppo, ja syy ei ollut vihollisten määrä vaan se että
jokainen niistä kysyi samaa kysymystä: milloin hyppään sen yli tai päälle.
`scale.js` pidentää kenttää ja tihentää vihollisia, eli se kysyy sitä samaa
kysymystä useammin — se ei voi tehdä muuta. Uusi kysymys tulee vain uudesta
lajista tai uudesta geometriasta, ja siksi tämä erä toi molempia.

**Vaikeus on mitattava tai se on makuasia.** Hyppysarjojen "vaikea muttei
mahdoton" ratkaistiin kahtena laskettavana väitteenä — ratkaisijan löytämä
syötejono (ei mahdoton) ja niiden ponnistuskohtien määrä jotka osuvat, ikkuna
(vaikea). Sama muoto kelpaa muuhunkin kuin hyppyihin: jokainen "tämä tuntuu
liian helpolta" voidaan kysyä numerona jos joku kirjoittaa sille ratkaisijan.

**Kahdella todistajalla on oltava raja, ja se raja on kirjattava.** Maareitin
botti ei osaa lankkusarjaa, ja hyppyratkaisija osaa. Raja niiden välillä on nyt
koodissa lukuna (tyhjä leveämpi kuin kaksi mitattua hyppyä, vähintään kolme
lankkua) eikä sopimuksena — ja ylitysten määrä tulostetaan joka kentästä, jotta
hiljainen kasvu näkyy. Sama erä paljasti että maailmojen 6–8 portilla oli oma
kopio botista; kopioita ei enää ole.

## Tila 16.8.2026

Kuvaefektit saivat kaksi jonossa ollutta kohtaa (v26.08.16.84): **tärinällä on
suunta** ja **tapahtumilla on väri**. Kumpikin on portissa lukuineen, ja
molempien perustelut ovat muutoslokissa. Yksi asia niistä koskee kaikkea
tulevaa eikä vain näitä kahta:

**Merkki joka kertoo pelistä ei saa asua kuvaefektissä.** Palettisiirto on
`multiply`-veto 2D-puolella eikä varjostimen uniform juuri siksi: varjostin on
olemassa vain kun WebGL saatiin ja vain kun esiasetus ei ole "pois", eli sinne
laitettu vahinkovälähdys katoaisi ajurin ja asetuksen mukana. Sama kysymys
tulee vastaan seuraavallakin efektillä, ja vastaus on tämä.

Ja toinen, joka on turvallisuutta eikä makua: **koko ruudun välkyntä on WCAG
2.3.1:n välähdyskynnyksen tapaus** — alle kolme välähdystä sekunnissa tai alle
10 % suhteellisen luminanssin muutos. Tähden syke mitataan sitä vasten (1,54
Hz, 2,2 %), ja jokainen uusi koko ruudun efekti mitataan samalla tavalla.
Kirkastuvalla vahinkovälähdyksellä sama todistus tulee toisesta suunnasta:
osuman jälkeiset 110 kuolemattomuusframea rajaavat välähdykset 0,25 Hz:iin
silloinkin kun osumaa yritetään joka framella.

Ja kolmas, joka syntyi vasta yhdistämisessä: **koko ruudun värejä on nyt kaksi**
— kuninkaan verho (v26.08.10.65) ja palettisiirto. Niitä ei yhdistetty, koska ne
vastaavat eri kysymykseen, mutta ero on portissa muotona eikä sopimuksena:
verho on rengas jonka keskus jätetään koskematta, siirto on tasainen. Kolmas
koko ruudun väri saa saman kohtelun.

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
4. ✔ **Minipomot muihin maailmoihin** — luulaakso sai omansa (v26.08.17.98):
   `6-M LUUVALTAISTUIMET`, kaksi yökkiä korokkeilla ja muurattu holvi heti
   perässä. Koneisto oli olemassa (`2-M`), mutta kenttädata ja karttasolmut
   eivät olleet koko työ — kolme sääntöä sanoi mitä haara saa olla, ja jokainen
   niistä löytyi vasta kun portti kaatui:

   - **Kahdeksan kenttää per maailma on luku eikä tapa.** Yhdeksäs solmu olisi
     tehnyt luulaaksosta muita pidemmän, joten haaran palkittu tie **korvasi**
     kentän (6-5 jää dataan kartan ulkopuolelle; ks. `gen-levels.mjs`, siellä on
     kirjattu miksi sitä ei poistettu myös sieltä).
   - **Haaran kaksi tietä lähtevät eri nuolella.** Kartalla liikutaan yhdellä
     suunnalla kerrallaan, ja ensin valittu ylös oli jo varattu paluulinkille —
     mitattuna `w6-2->w6-3 askel (0,-1)` jäi umpikujaksi.
   - **Palkittu tie on mitatusti vaikeampi.** 6-M 259,2 vastaan 6-K 245,9, ja
     kolme välivedosta (210,0 · 238,6 · 241,8) jäi alle.

   Ja luulaakson oma rakennesääntö sanoi mistä holvi saa olla tehty: `X` ja `#`
   nojaavat aina johonkin suoraan allaan, joten ontto kivihuone on mahdoton.
   Holvi on siis **tiiltä**, ja se on parempi kuva kuin aavikon kalliohylly:
   murtava voima ei avaa ovea vaan syö seinän.
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
   ✔ **demo näyttää tempun** (v26.08.17.93) — alkuruudun esittely pysähtyy
   putken kannelle, painaa alas, katoaa siihen, kerää luolan kolikot ja tulee
   samaa tietä takaisin painamalla ylös katosta roikkuvaa suuta. Verbi
   opetetaan, paikkaa ei: kenttä on **oma esittelykenttä**
   ([src/data/demo-level.js](src/data/demo-level.js)) jota ei ole pelin
   kentissä, joten paljastettavaa paikkaa ei ole olemassa. Kolme hylättyä
   vaihtoehtoa ja niiden perustelut ovat sen tiedoston alussa. Portti mittaa
   **tapahtuman eikä olemassaoloa**: kaistat 1 → 2 → 1, alas framella 389 ja
   ylös framella 546, ja pelaajan oma tallennus koskematon sen jälkeen.

## Omistajan päätökset 16.8.2026 (ilta)

Läpikäynti kohta kerrallaan, [IDEAS.md](IDEAS.md) ja tämä tiedosto. IDEASin
tuomiot ovat siellä omana taulukkonaan; tässä on se mikä koskee tätä tiedostoa.

| kohta | tuomio |
| --- | --- |
| pomo järjestää kentän uusiksi | **pysyy, ja tehdään heti** — ei odota valuvaa hiekkaa |
| salainen alue maailmaan 5 | **tee**, opettamalla generaattorille kolmikerroksinen kokoonpano |
| minipomot muihin maailmoihin | **tee muutamaan**, ei jokaiseen — luulaakso sai omansa (v26.08.17.98) |
| demo näyttää tempun | **tee** |
| aaltoilu veden alla / vedenalaiset kentät | **ei** — kohta poistuu jonosta |
| jokaiselle pomolle oma ääni | **korjaa puhetestit ensin**, sitten äänet — puhetestit korjattu (v26.08.17.93) ja äänet tehty (v26.08.17.96) |
| lisää pomovariaatioita | **kahdeksas variantti**, jotta "jokainen pomo kerran" on totta — tehty (v26.08.17.97), suolimato 8-5:ssä |
| kenttäsäännöt käsintehdyille | vanhentunut merkintä: **jo voimassa** |
| nimen tavaramerkkiriski | vanhentunut merkintä: **nimi on jo vaihdettu** |

### Se yksi järjestysristiriita, kirjattuna eikä siloteltuna

IDEASin kohta E (valuva hiekka) hyväksyttiin sanoilla *"tee, ennen pomoa"* —
perusteena että se on halpa harjoitus muuttuvan ruudukon validoinnista, jonka
areenapomo joutuu joka tapauksessa ratkaisemaan. Areenapomo puolestaan
päätettiin tehtäväksi **heti**, odottamatta sitä.

Nämä eivät ole ristiriidassa lopputuloksesta vaan järjestyksestä, ja se
ratkeaa itsestään: **kumpi tahansa niistä ensin joutuu ratkaisemaan sen saman
asian** — validaattori joka tarkistaa jokaisen mahdollisen ruudukon eikä vain
lähtötilaa — ja jälkimmäinen saa sen valmiina. Järjestys on siis tekijän
valinta eikä suunnittelupäätös, ja se on kirjattu tähän jotta seuraava lukija
ei luule sitä unohdukseksi.

### Vedenalaiset kentät: ei, ja miksi se kannattaa säilyttää

Uinti on genren vakiokalustoa ja siksi vapaata (DESIGN.md kohta 2), eikä sitä
hylätty hinnan takia — hinta on kyllä iso (oma liikemalli pelaajalle, oma
käytös jokaiselle viholliselle, oma validointi). Se hylättiin **sanaston**
takia: maailma on suolisto, ja se mitä siellä virtaa ei ole vettä. Lainattu
verbi on käännettävä tämän pelin sanastolle tai se jää lainaksi, ja tälle
verbille käännöstä ei löytynyt siltä istumalta.

Siksi myös `postfx`-jonon kohta "aaltoilu veden alla" poistuu: se odotti
jotain jota ei tule.

### ✔ Kahdeksas pomovariantti — tehty (v26.08.17.97)

**SUOLIMATO** on 8-5:ssä pöhön toisen esiintymän tilalla, ja maailman väite on
nyt merkilleen tosi: uusinnat ovat `0 1 2 3 7 4 5`, eli seitsemän eri pomoa
seitsemässä huoneessa eikä yhtään kahdesti.

| väite | mitattu |
| --- | --- |
| uusinta on järjestyksessä eikä toista ketään | `samassa kohdassa 6/7, toistoja 0` |
| se kaivautuu kruunun ajaksi | `siirtyi 171 px, vajosi 44 px` |
| maan alla se ei satuta eikä siihen voi osua | `vaaraton true` |
| eikä se nouse jalkojen alta | `nousi 3.1 laatan päähän` |

**Uusi numero ei olisi riittänyt, sen piti olla uusi kysymys.** Jokainen muu
pomo kysyy *milloin* — kruunu nousee, odota, kruunu laskee, lyö. Mato kysyy
*missä*: se kaivautuu lattiaan tasan siksi aikaa kun kruunu on päässä eli kun
siihen ei kuitenkaan voi osua, ja nousee jossain muualla siinä hetkessä kun
siihen taas voi. Pelaajan työ ei ole odottaa ikkunaa vaan **löytää se
uudestaan**.

Siitä seuraa myös se että vanha lupaus pysyy koskemattomana: avoin ikkuna on
kokonaan tallottavaa aikaa jokaisella pomolla, ja liikkuva maali avoimen ikkunan
aikana olisi rikkonut sen hiljaa.

Kaksi poikkeusta jotka on kirjattu nimellä eikä ohitettu: mato on **pelin ainoa
raajaton pomo** (`LIMBLESS_ON_PURPOSE`, ja poikkeus vanhenee itsestään jos sille
joskus piirretään raajat), ja sen ääni on ainoa jolla on `level`-kerroin —
mitattuna sen terävät formantit päästivät läpi 0,065 kun muut tuottivat
0,23…0,40 samalla nimellisellä voimakkuudella.

### Alkuperäinen perustelu: kahdeksas pomovariantti, ja mitä se korjaa

Variantteja on seitsemän — nyrkkeilijä, jyskyttäjä, syöksyjä, pöhö, luuranko,
sääherra, pierukuningas — ja jokaisella on oma kokonsa ja runkokaavansa. Yksi
niistä esiintyy neljästi: **pöhö on 4-F, 5-F, 8-4 ja 8-5**, kun jokainen muu
esiintyy kahdesti.

Se on juuri se väite jonka maailma 8 tekee itsestään ("jokainen pomo kerran",
kuusi varianttia yhtä vastaan, portissa lukuna). Kahdeksas variantti toiselle
maailman 8 esiintymälle tekee väitteestä merkilleen toden sen sijaan että se
on totta vain jos pöhöä ei lasketa kahdesti.

### Pomoäänet: este on poistunut (18.8.2026)

Päätös 9.8.2026 on voimassa sellaisenaan: **oma ääni, jaetut toimintaäänet.**
Este oli mittauksessa, ja se on nyt korjattu — kuusi uutta ääntä voi rakentaa.

Este oli puhesynteesin testeissä (`a spoken line is loud enough to hear`, `every
consonant makes a sound of its own`, `a fricative is audible…`), jotka kaatuivat
satunnaisesti ja aina eri lukemin. **Vika ei ollut kynnyksissä eikä
odotusajoissa** — molempia oli jo kerran säädetty eikä kumpikaan auttanut —
vaan siinä että mittaus mittasi ympäristöä. Kaksi mitattua syytä:

* **Väylällä oli 24,25 ennen kuin lohko soitti mitään**, ja `Ambience.current`
  oli `wind`. Tuulipeti on jatkuvaa kohinaa, ja juuri sen muotoinen oli kaatunut
  ajo: *ikkunat … 5.62 5.62 5.62*, kolme peräkkäistä täsmälleen yhtä suurta
  lukemaa. Vaimeneva häntä ei tee sitä. Peti herää joka kerta kun elossa oleva
  näyttämö kutsuu `hold()`ia, eli portti riippui siitä mikä näyttämö sattui
  olemaan pystyssä edellisen lohkon jäljiltä.
* **Nimikkösivulle palaaminen yksin ei riitä.** Parkkeerattuna väylä oli puhdas
  (*ennen 0.00*) ja sitten houkutusdemo lähti kesken odotuksen — *pitäjät
  TitleScene/… DemoScene/m:level/…*, ikkunat 282,65 viisi kertaa peräkkäin,
  19,4 sekuntia. `game.toTitle()` *ostaa* kaksikymmentä sekuntia; se ei takaa
  mitään, ja hitaalla renderöijällä lohko kestää kauemmin.

Korjaus on `tools/verify.mjs`:n `park()`: näyttämö nimikkösivulle, `Music.stop()`,
`Ambience.stop()` ja **`startDemo` irrotettuna** mittauksen ajaksi, kaikki
takaisin sen jälkeen. Kynnyksiin ja odotusaikoihin ei koskettu. Todistettu
kolmella peräkkäisellä ajolla: *ääni 0,614 / 0,609 / 0,612, tausta 0,000 joka
kerta*, eikä yhdessäkään ollut muuta pitäjää kuin nimikkösivu.

**Mitä jäi jäljelle, ja se on eri vika.** Konsonanttilohkon kaksi porttia
(`every consonant makes a sound of its own`, `a fricative is audible…`)
raportoivat yhä noin kahdessa ajossa kolmesta *"ei mitattu (äänikello seisoi)"*,
eli ne menevät läpi tyhjinä. Syy on mitattu ja se on toinen kuin yllä: **päätön
Chromium renderöi ääntä ryöppyinä** — mitattu *äänikello 3,39 s / seinäkello
1,56 s*, eli äänikello ehti yli kaksinkertaista vauhtia — ja yhden ryöpyn väliin
mahtuu enemmän ääntä kuin analysaattorin 743 ms:n muistiin. Silloin ääntä
oikeasti menee ohi, joten `meterFor`in `stalled` kertoo totuuden eikä ole liian
tiukka. Korjaus ei siis ole kynnyksen säätö vaan mittaustapa joka ei voi
menettää näytteitä: `AudioWorkletNode`, joka näkee jokaisen näytteen
äänisäikeessä. Kokeiltu erillisellä koeajolla ja se toimii — sadan äänen ryöppy
vaimeni siinä puhtaasti nollaan ilman yhtään menetettyä ikkunaa — mutta se on
`meterFor`in vaihto kuudessa kutsupaikassa eikä mahtunut tähän erään.

## Jonossa

### ✔ The overworld goes isometric 2.5D — built 19.8.2026

*(Owner, 19.8.2026, having compared four renderings of the world die:
"I think for the map I prefer iso 2.5D." The comparison is the artifact
"Four Dice"; the four looks were the deployed one, chunky contours, isometric,
and both together.)*

All five pieces are in `src/scenes/die.js` now. The decision was the **look**,
and the pieces it needed were prototyped cheapest first, in this order:

1. **Three quantised tones per tier colour** instead of a continuous depth ramp.
   This single change is most of the look: a ramp reads as a render, three steps
   read as something drawn by hand.
2. **A hard drop shadow** — the silhouette, flat, offset down and right, no
   blur. On a black ground it does more for depth than shading does.
3. **A floor of chunky dots.** Without a floor there is nothing for the shadow
   to fall on and nothing to fix the camera angle.
4. **The net lies down on that floor** when the die opens, in the same
   projection, rather than lying flat against the glass. That is the whole idea
   in one move: a solid becomes a map without becoming a different object. The
   squash is 0.62 — 0.42 was tried and pressed the open map into an unreadable
   band.
5. **A thick silhouette outline**, two or three chunks of the darkest tone,
   which reads as extrusion without the geometry. Extruding an octahedron's
   faces for real leaves gaps where they meet.

**The price, and it is real:** isometric means a fixed camera, and the forty
frames of slow rotation that teach the eye this is a solid cannot survive one.
Resolved the way the note guessed — spin, settle, then open — with one thing
the note did not foresee: the settle needs a **beat of stillness at the end of
it** (`ISO_BEAT`, 16 frames). Without it the die arrived at the isometric angle
and started coming apart on the same frame, so the fixed camera the whole look
is built on existed for exactly zero frames.

The second surprise was geometry rather than timing. An octahedron looked at
straight down one of its faces shows **one** face — the three that touch it sit
at 109° and all point away — so the resting orientation could not be `facing()`
alone. `ISO_TILT` 0.60 and `ISO_YAW` 0.58 turn it off-axis in both directions,
which brings three faces and a shared vertex into view. That is what says
"solid" without any shading at all, and it is why the tone quantisation could
be taken as far as three steps without the shape going flat.

Chunky contour bands were prototyped alongside and are **not** part of this
decision. If they come back, note what made them work: the small buffer has to
be quantised — alpha snapped to 0 or 255 and colour snapped to the palette —
because canvas antialiases every polygon and scaling that up gives a blurred
render rather than pixel art.

### The ghost car, and where it belongs: telemetry

*(Owner, 19.8.2026: "we've been talking about telemetry, but we definitely
gotta include a ghost car run mechanic in there, right? So you can compete
against yourself, and maybe that'll unlock something as well." — and yes, the
frame is telemetry, not time attack. That is the useful part.)*

Two halves of this are already built and they are in **different** places,
which is the thing to notice before anyone starts.

Time attack (`startRace` in `level.js`) already stores your best run per level
and mode, compares against it at `RACE_SPLITS` checkpoints, and says which
side of it you are on with a flash and two sounds (`edella` / `jaljessa`).
What it stores is eight numbers. A ghost needs a path.

Telemetry (`src/core/telemetry.js`) already records where you were when
something happened — level id, tile coordinate, cause, power level — capped at
`MAX_EVENTS` 800 and never leaving the browser. It is the right machinery and
the wrong *shape*: it records events, and a ghost is the continuous line
between them.

So the ghost is a third thing built out of both, and the design question it
forces is worth writing down now rather than discovering later:

- **A trace is not anonymous the way an event log is.** `telemetry.js` opens
  by promising anonymity *by construction* — no run id, no wall clock, nothing
  that ties two records together. A path is a run id: it is one continuous
  record of one person playing one level, with their hesitations in it. Kept
  local it is harmless, and it must stay local — but ROADMAP §2 phase 4
  contemplates sending telemetry somewhere one day, and a death histogram and
  a movement trace are not the same thing to send. **Separate store, separate
  key, and the sending decision never inherits the ghost.**
- **What is recorded.** Position per frame is enough to be a ghost, not enough
  to be *you* — a ghost that slides is a cursor. Facing, animation phase and
  airborne-or-not make it read as a player.
- **What it costs.** A minute-long run is 3600 frames; x and y as 16-bit ints
  is 14 KB per level, times sixty-five levels. Sampling every fourth frame and
  interpolating brings the set to roughly 230 KB, which localStorage holds.
  Every frame for the whole game does not.
- **What it unlocks.** The owner's "maybe that'll unlock something" is the
  open half. Beating your own ghost is a *personal* achievement while the
  world die's completeness bonuses are **global** ones, so a door hung on it
  opens at a different real difficulty for every player — which is either the
  best thing about it or the reason not to do it. Decide before building.

Save compatibility (DESIGN.md item 6): a trace is new data, so it is additive
and absent-tolerant. An old save has no ghost and the level plays exactly as
it does today.

### A speed skill that pays while you are already fast

*(Owner, 19.8.2026, on the pumping rhythm: "is the whole mechanism overwrought,
maybe?" — it was, and it was removed the same day. This is the door it left
open.)*

The measurement that killed pumping is also the specification for whatever
replaces it. Perfect rhythm bought **1533 px against 1511 px over eight
seconds** — 1.5 % more distance — while being two frames late halved it. And the
reason is structural rather than a tuning failure: the P-meter's only job is to
reach P-speed, P-speed is a hard cap, so *anything that only changes fill time
is bounded by the 1.6 seconds you spend below the cap* in a level that lasts a
minute. No window, tempo or cue could have saved it.

So a speed skill has to pay **while you are already at the cap**, not on the way
to it. The shape worth trying: pumping (or any input flourish) *holds* P-speed
through the things that normally cost it — a landing, an uphill slope, a bump, a
turn. That inverts the maths: instead of buying 1.6 seconds of ramp once, it
pays every time the level would otherwise slow you down, which in a level built
of slopes and jumps is continuous.

Two things it must not do, both already measured:

- **It must not raise the cap.** `gapTiles` 6 and `wallTiles` 4 are measured at
  P-speed and every level's clearability is proved against them.
- **It must not punish ignoring it.** The vent made a miss five times worse than
  never trying, so the rational play was to not engage — a mechanic nobody
  should attempt is worse than no mechanic.

Everything the removal left behind is still in git: the beat clock, the window,
the tick and the rising hit sound, and `Music.beatFrames`, which locked the
period to the playing track's own tempo. If a rhythm ever comes back, it comes
back on the music.

### Generative level design worth stealing from

*(Owner, 19.8.2026: "search GitHub and the web for generative level creation
mechanisms. The current levels still feel too… flat, not just literally but
there's not enough variation. Something fractal, generative, organic, genetic?")*

Not started — a research task, and the brief is **variation** rather than
novelty for its own sake. What the generator does today is honest and narrow: it
samples mined pacing histograms for rhythm and arranges this game's own set
pieces against a measured jump budget. Every level therefore has the same
*grammar*, and that is exactly what "not enough variation" means — the pieces
differ, the sentence structure does not.

Worth reading up on before writing anything: search-based procedural generation
with a fitness function (the difficulty meter is already a fitness function),
genetic approaches that breed and mutate whole levels, cellular automata for
cave systems, WaveFunctionCollapse for local-constraint tiling, grammar-based
expansion. The measuring rig this repo already has — `difficulty.mjs`,
`playable.mjs`, `variety.mjs`, `curriculum.mjs` — is the expensive half of any
search-based method, and it exists.

### Trouble jumping in 1-1 (19.8.2026, unresolved)

Owner, playing the deployed build: *"I had trouble jumping in 1-1!"*

**First suspect, and it is ours.** The slope catapult cleared `coyote` on launch
(v26.08.19.42), on the grounds that a body thrown by a ramp did not walk off an
edge. That removed a free full jump that had existed, untimed, since slopes did
— and 1-1 has slopes now, because it took `terrain: '1-1a'` in the terrain pass
(v26.08.19.35). So the level most people play most has both a new ground profile
and one fewer forgiving jump, and both arrived within a day.

`playable.mjs` still clears 1-1 at power 0, so nothing is impossible — this is
about feel, which is the thing the gates cannot measure. Check in this order:
whether the coyote clear is what changed it, whether the terrain seed `1-1a`
put a ramp where the first jumps are, and only then anything about the jump
itself.

### Two overworld ideas from play, not yet built

*(Owner, 19.8.2026.)*

**Speed limit signs in the parallax.** The owner's idea, and stated exactly:
when the player crosses speed X, a road sign is placed into the backdrop
**off-screen**, scrolls into view as they run, and leaves. Nothing flashes and
nothing is posted on the HUD — the sign reads as scenery that was always
standing there, while actually being a reaction to how fast they are going.

A joke first, and useful second: it would be the only place the game ever names
its three speed tiers (walk 1.5, run 2.5, P 3.5).

Two things to get right when building it. The sign has to be inserted far enough
ahead that its arrival is never seen — the whole trick dies if it pops in. And
the backdrop draws procedurally per theme rather than from level data, so this
needs a small list of live props with world positions, which the backdrop does
not have today.

**The world-level card scrolls through instead of being posted.** Same trick
applied to `MAAILMA 1-1`: it enters from one side, passes, and leaves as the
player moves, rather than appearing and fading in place.

Both share one idea worth keeping: a readout that arrives *through the world*
is furniture, and furniture is the direction every HUD element in this game has
already gone.

### Render audio offline instead of listening to it live

*(Owner, 18.8.2026: "should we do audio testing in some other way, if headless
chrome is so slow and unreliable?" — queued, not started.)*

**The measured problem.** Headless Chromium renders audio in bursts, not
smoothly: measured at `äänikello 3.39 s / seinäkello 1.56 s`. An `AnalyserNode`
remembers 743 ms, so a single burst can be longer than the window and whole
sounds are genuinely missed. That is why `every consonant makes a sound of its
own` and `a fricative is audible…` report *"ei mitattu"* in roughly two runs of
three. They are not lying — the samples really were lost — but a gate that
measures nothing two times in three is a gate that is one bad day from being
deleted.

Live listening also costs the two things that make the suite slow: waiting for
the bus to fall silent, and waiting in real time for a 420 ms sample.

**The fix is already half-built.** `tone` was split into `buildTone(ac, dest,
…)` on 18.8.2026 so the graph can be constructed in *any* context, and
`renderTone` renders it into an `OfflineAudioContext`. That is faster than real
time, deterministic, and returns every sample — no analyser, no missed burst,
no waiting for silence. Six of the SID gates already work this way.

**So the rule should be inverted: offline is the default, live is the
exception that has to justify itself.** Most audio claims are about the signal
and not about time — ring-modulation sidebands, hard-sync harmonics, portamento
arriving mid-note, vibrato depth, whether a spoken line is louder than the
floor. None of those needs a live context.

What genuinely stays live, and why, has to be listed rather than assumed:
anything scheduled against the wall clock (the `live` PWM path), the sequencer
if its clock is real, and the ambience beds, which ramp with `setTargetAtTime`
over seconds. For that residue the fix is an `AudioWorkletNode` meter instead
of an `AnalyserNode` — a worklet sees every block and cannot miss a burst. It
was prototyped in a scratch harness and worked (a 100-sound burst decayed to
zero with no missed window); it replaces `meterFor` at six call sites.

**What not to do.** Do not move audio testing to a Node-side WebAudio
implementation. It would be fast and deterministic and it would be testing a
different synthesiser than the one the player hears, which is the one thing
this suite exists to avoid. And do not hash rendered output as a golden file:
it catches regressions but says nothing about *why*, and every deliberate
tuning change would look like a failure. Assert measured properties, as
everything else here does.

**Pairs well with the split above.** Offline gates run in milliseconds, so
`--only audio` would turn an eight-minute loop into a couple of seconds — which
is what makes the remaining live gates worth fixing at all.

### Split `tools/verify.mjs` into modules

*(Owner, 18.8.2026: "if verify is twenty six thousand lines, shouldn't we make
that part itself modular?" — queued, not started. Written in English because
that is the language for new prose from here on; the older Finnish stays as it
is.)*

**The file's own shape already says where the seams are.** Measured:

| | |
| --- | --- |
| lines | 26,400 |
| `page.evaluate` blocks | **32** |
| locally redefined `expect` helpers | **20** |
| checks produced per run | **802** |
| wall time for one run | ~8 min |

Thirty-two is the number that decides this. The file is not one enormous
browser function — it is already thirty-two independently evaluated units with
Node-side glue between them. Splitting recognises a structure that exists; it
does not invent one. Twenty copies of `expect` is the same duplication this
repo has removed elsewhere (`seedOf`, `routeBand`, the five copies of `SOLID`).

**Why it is worth doing, in costs actually paid rather than tidiness.**

1. **Every question costs eight minutes.** Chasing the row numbers after the
   15 → 16 change took about a dozen full runs. `--only audio` would have made
   most of them seconds.
2. **Two people cannot work in it at once.** That change had to be serialised
   behind a subagent purely because both halves of the work would otherwise
   have been edits to this one file. That is a throughput limit, not a
   hypothesis.

**The condition, and it is this repo's own recurring lesson.** A split must
prove it did not silently drop a gate. The failure mode to fear is not a crash,
it is 780 checks quietly passing where there were 802. So: snapshot the check
*names* to a file first, split, then require the name set to be identical
before and after. Same trick as the difficulty table and the daily fingerprint
— the proof is a comparison, not a promise.

**Shape.**

- `tools/verify.mjs` stays the runner: serves the repo, launches Chromium,
  collects `report.checks` / `report.failures`, prints, exits non-zero.
- `tools/gates/*.js` for the browser-side blocks, imported by URL exactly the
  way the gates already import game modules.
- `tools/gates/harness.js` for the shared `expect`, the input builders, the
  scene builders and the audio tap.
- `--only <name>` and `--list` on the runner.

Do it as its own change, on a green suite, with the name snapshot as its proof.

### Kenttien varianssi: mitattu tila ja se mitä se vaatii

Omistaja 17.8.2026: *"kentissä on edelleen liian vähän varianssia! Ne tuntuvat
tasaisilta ja toisteisilta … löytyisikö jostain hyvää kaksiulotteista
kenttädataa, jota soveltaa? … ehkä Sonicin 2D-kentistä voisi ottaa
inspiraatiota? Ja kiva olisi jos niissä vois mennä limittäin."*

**Ulkopuolisesta kenttädatasta, ensin se raja.** Reitti on olemassa ja se on jo
rakennettu: `tools/mine-pacing.mjs` louhii **tilastoja** ulkoisesta korpuksesta
(`VGLC_DIR`) ja `tools/gen-levels.mjs` rakentaa niistä. DESIGN.md kohta 3 sanoo
sen yhtenä lauseena — **rytmi kyllä, layout ei** — ja kohta 1 kieltää
yhdenkään olemassa olevan pelin kenttäkartat. Sonic-korpuksesta saa siis ottaa
sen mitä Sonicista kannattaakin ottaa: **mitattua rytmiä** (kuinka pitkiä
suoria, kuinka usein korkeus vaihtuu, minkä mittaisia kaaria) — ei ruudukoita.

**Mitattu tila** (`node tools/variety.mjs`): neljä maailmaa kahdeksasta toistaa
itseään mediaania enemmän (w1 w2 w3 w8), ja **kuudessa kahdeksasta loppupuoli
on alkupuolta toistavampi** (w1 58→51, w3 59→47, w8 45→31). Uutuus vaihtelee
38 %:sta (w8) 82 %:iin (w5). Mittari sanoo suoraan mistä on kyse: *kapea
sanasto ei ole vika; sen kaluaminen samoiksi ruuduiksi on.*

**Se yksi rakenteellinen syy joka selittää tasaisuuden.** Lähes jokaisessa
palikassa rivit 13-14 ovat `G` — eli **maan pinta on samalla korkeudella koko
pelin ajan**. Kaikki vaihtelu on sen yläpuolella olevaa tavaraa. Rinteet
(v26.08.18.13) ovat ensimmäinen kerta kun maa itse liikkuu, ja niitä on tällä
hetkellä kolmessa palikassa.

Kolme askelta, halvimmasta kalleimpaan:

1. **Limittäiset reitit palikkasanastoon** (aloitettu: `kaksitie`, 3-1).
   Ylempi ja alempi reitti kulkevat saman matkan päällekkäin ja yhtyvät;
   ylempi ostetaan vauhdilla, alempi on aina auki. Halpa, koska se on
   pelkkää sanastoa — ei moottoria eikä portteja.
2. **Rinteet generaattorin sanastoon.** Generaattori ei tunne `/`- ja
   `\`-merkkejä lainkaan, joten 26 generoitua kenttää ovat rakenteellisesti
   tasamaata. Tämä on se muutos jolla varianssi kasvaa eniten työtä kohti.
3. ✔ **Maastopassi: maan korkeus vaihtelee palikoiden välillä — tehty
   18.8.2026** (v26.08.18.25, `src/data/terrain.js`). Kokoaja päättää kullekin
   palikalle lattiatason ja kirjoittaa siirtymät rinteinä; kuusi kenttää sai
   maaston, neljä jäi ilman ja jokaisen syy on sen omassa kommentissa.

   **Kalleusarvio oli oikea toisesta toteutuksesta.** Yksikään lueteltu
   tiedosto ei muuttunut, koska passi ei siirrä maata vaan **nostaa pintaa ja
   jättää kiven alle**: rivit 13-14 pysyvät kiinteinä, ja `floorProfile` on
   osannut vaihtelevan korkeuden koko ajan — vain sen siemen oli rivissä 13, ja
   siemen osuu edelleen.

   **Nosto oli aluksi yksi laatta ja on nyt kaksi** (18.8.2026): kenttädata
   kasvoi kuuteentoista riviin ja kansi nousi laatan verran. Kolme ei mahdu —
   30,38 px varaa + 16 px lisärivi = 46,4, ja kolmen laatan nosto on 48.
   Jokainen seuraava rivi kenttädataan ostaa tasan yhden laatan lisää.

   ✔ **Generoidut kentät saivat maaston 18.8.2026.** Passi on toinen toteutus
   eikä toisinto: kokoaja voi työntää rinteen palikoiden väliin, generaattori ei
   (leveys on siellä mitoitettu luku), joten se kirjoittaa rinteen tasamaan
   päälle ja vaatii vauhdinottoa `MAX_LIFT` saraketta enemmän. Portit ja rinteen
   muoto ovat yhteisiä. 26 kenttää generoitiin uusiksi korpus käsillä.

   **Laskeva maasto on nyt mahdollinen muttei tehty.** Lisärivi tuli päälle,
   joten ruudukon pohja on yhä lattia — mutta lisääntynyt korkeus sallisi
   valita perustason ylempää ja notkot siitä alas. Se on suunnittelukysymys eikä
   este.

### Ääni: SID-sanasto — ✔ LOPPUUN TEHTY 18.8.2026 (v26.08.18.29)

`tone` osasi pulssin, leveysmodulaation, arpeggion, rengasmodulaation ja
suodinpyyhkäisyn (v26.08.18.14), ja JÄÄTIE käytti niistä kolmea. Neljä
Galway/Hubbard-tekniikkaa oli kirjattuina eikä tehtyinä; kaikki neljä ovat nyt
tehtyjä, ja kolme niistä päätyi eri paikkaan tai eri muotoon kuin tässä luki.
Se mikä muuttui on kirjattuna, koska se on ainoa osa joka ei ollut arvattavissa.

1. ✔ **Kanavan varastaminen rummulle** (`level`, maailmojen yleisraita).
   Sekvensserissä on nyt käsite "tämä ääni on varattu": `steal` varaa kanavan
   PAL-ruuduissa mitatuksi ajaksi, varattu ääni vaikenee, ja pitkä nuotti
   **katkaistaan** varauksen alkuun (`_spanOf`) — muuten varaus olisi ollut
   pelkkä kirjanpitomerkintä. Varastetun kanavan rumpu on äänen oma aalto ja
   oma sävel pudotettuna alas, eli sama tapa jolla se tehtiin sirulla.

   **Kaksi framea oli väärä luku, ja se on mitattu.** 50 Hz:n ruutu on 20 ms,
   ja `level`in kuudestoistaosa on 96 ms: kahden ruudun reikä katoaisi nuotin
   oman vaimenemisen sisään. Kuusi ruutua (120 ms) nielee varastetun nuotin ja
   seuraavan, eli reikä on kaksi kuudestoistaosaa. Portti lukee `audioDiag`ista
   neljä osumaa ja neljä vaiennettua nuottia 32 askelta kohti — molemmat, koska
   osumat ilman vaikenemista olisi pelkkä lisätty rumpuraita.

   Koti on `level` eikä mikään muu siksi että sen basso soittaa kuudestoistaosia
   keskeytyksettä: se on pelin ainoa basso jonka vaikeneminen on tapahtuma.

2. ✔ **Rengasmodulaatio käyttöön** — **tehtaassa (maailma 4), ei luulaaksossa.**
   Tämä kohta ehdotti luulaaksoa, ja se oli väärä ehdotus kahdesta syystä
   joista kumpikin riittää yksin.

   **`bone` on lainattu raita** (Saint-Saëns, *Danse macabre*, DESIGN.md kohta
   1 b), eikä lainattua sävelmää järjestellä uusiksi tekniikan takia. Sääntö on
   kirjoitettu täsmälleen tätä painetta vastaan: tekniikkalista on se voima
   joka saa lainatun aineiston liukumaan huomaamatta joksikin muuksi.

   **Ja vaikka ei olisi, se olisi sama asia kahdesti sanottuna.** `bone`in
   ksylofoni on jo kirjoitettu ulos — kolmioaalto, `staccato` 0,34, `hold` 0,08
   — ja rengasmoduloitu kello sen viereen olisi toinen tapa sanoa "luut
   kalisevat". DESIGN.md kohta 8 on tehty sen estämiseksi.

   Tehdas on se paikka jossa ääni on uutta tietoa: raidan rummuissa luki jo
   "metallic sixteenths", mutta hi-hat on suodatettua kohinaa eli metallin pinta
   eikä metalli. Alasin (`comp`, suhde 2,41) mitattiin renderöimällä: kantoaalto
   vaimenee 7597-kertaisesti ja tilalle tulee kaksi sivunauhaa kohtiin 1,41× ja
   3,41× perustaajuutta — kumpikaan ei ole lähelläkään kokonaislukumonikertaa,
   ja juuri se on ero kellon ja äänen välillä.

3. ✔ **Hard sync — jaksotettuna uudelleenkäynnistyksenä, ja se toimii.**
   Tässä luki että se vaatisi joko `AudioWorklet`in tai jaksotetun
   uudelleenkäynnistyksen. Jälkimmäinen riitti, eikä se ole approksimaatio:
   koska `OscillatorNode` alkaa aina vaiheesta nolla, isäntäjakson mittainen
   oskillaattori joka käynnistetään joka jakson alussa **on** vaiheen nollaus.

   Ja koska "melkein hard sync" kuulostaisi vain kirkkaammalta nuotilta, väite
   on kolme lukua signaalista eikä yksi parametri taulusta:

   | väite | mitattu |
   | --- | --- |
   | sointiväri seuraa orjaa | spektrin huippu isännän 1. osaäänestä 4:nteen kun suhde 1 → 4 |
   | sävelkorkeus ei liiku | perustaajuus 0,0114 synkronoituna, **0,0000** nelinkertaisella nuotilla |
   | jakso on isännän | energiaa isännän monikerroilla 19× välien verran |

   **Hinta on se joka ratkaisi paikan.** Yksi oskillaattori isäntäjaksoa kohti
   tarkoittaa että hinta kaksinkertaistuu oktaavia kohti: pomoraidan lyijyn
   iskut olisivat 147 solmua nuottia kohti ja `lead octave up` -osiossa 294.
   Basson oktaavihyppy on 37 (pahimmillaan 56), joten sync meni bassoon — mikä
   on lisäksi se ääni jonka Hubbard tästä oikeasti teki. Neljä merkittyä
   nuottia koko pelissä, ja portti laskee sekä niiden määrän että kalleimman.

4. ✔ **Vibrato- ja portamento-taulukot nuottikohtaisesti** (`marks`, kaasukehä).
   Nuotin kolmas kenttä on avain äänen `marks`-tauluun: soitin antaa
   oletuksen, nuotti poikkeuksen, kuten SID-ajurissa. Taulu kantaa syvyyden,
   nopeuden, **viiveen** ja portamenton — ja samaa taulua käyttää kohta 3, eli
   kaksi tekniikkaa jakavat yhden mekanismin eivätkä kaksi.

   Kaasukehä siksi että raidan koko ajatus on ettei mikään putoa (D-lyydinen),
   ja portamento on sama väite melodian puolella. Mitattu: liuku on perillä
   nuotin puolivälissä (227 → 330 Hz) ja pysyy siellä; viivästetty vibrato on
   alussa 8,4 Hz leveä ja lopussa 28,0 Hz, kun viiveetön on 28,0 Hz alusta asti.
   Fraasi 2 (viima) on kokonaan merkitsemätön, ja se on se todiste ettei tämä
   ole äänen ominaisuus.

**Mitä tästä jäi.** `renderTone` (offline-renderöinti porttia varten) näkee
kaiken paitsi pulssin leveysmodulaation, koska se aikataulutetaan
`setTimeout`illa seinäkellon mukaan eikä äänikellon. Se ei ole kiireellistä —
leveysmodulaatio on jo mitattu suoraan osaäänistä (`pulseHarmonics`) — mutta se
on ainoa kohta `tone`ssa jonka lopputulosta portti ei kuule. `AudioWorklet`
korjaisi sekä sen että hard syncin hinnan yhdellä kertaa, ja se on ainoa syy
jonka takia sen vielä joskus voisi tehdä.

### Omistajan pyynnöt 17.8.2026 — vielä tekemättä

1. ✔ **Vinot kentät — tehty 17.8.2026** (v26.08.18.13). 45° rinteet, oma
   pystyratkaisu, vauhti korkeudeksi. Perustelut ja luvut: PHYSICS.md ja
   CHANGELOG. **Mitä rinteistä jäi tekemättä:** loivempi 30° rinne (kaksi
   laattaa yhtä korkeuseroa kohti). Se vaatisi neljä uutta laattamerkkiä ja
   puolikkaan askeleen `slopeTop`iin, eikä sitä ole aloitettu.

   ✔ **Rinteet generaattorin sanastoon — tehty 17.8.2026** (`hill`, v26.08.18.24)
   ja maastopassina 18.8.2026 (`liftTerrain`).

   ✔ **Vihollisten oma suhde rinteeseen — tehty 18.8.2026.** Sääntö on yksi
   lause ja se on nyt `physics.js`:n `slopePull`in kommentissa: **se mikä liukuu
   tai vierii tottelee rinnettä, se mikä kävelee ei.** Kävelijä kävelee omaa
   vauhtiaan ja se on sen koko sopimus pelaajan kanssa; potkaistu kuori ja
   karvapallo ovat kappaleita joita on työnnetty. Sama funktio pelaajalle ja
   kuorelle, rajat kutsujalta.
2. ✔ **Hirviö joka vie ohjauksen — tehty 17.8.2026** (HÖSSÖTIN, v26.08.18.23).
3. ✔ **Latautuva iso tulipallo — tehty 17.8.2026.** Nappiongelma ratkesi
   kiertämällä se: lataus on aika ilman laukausta eikä pohjassa pidetty nappi.

### Ruutuefektit ja neljännen seinän rikkominen

Neljä erillistä ideaa, tahallaan erillään — ne jakavat teeman muttei toteutusta.

**1. ✔ Suunnattu ruudun tärinä — tehty** (v26.08.16.84). `shake(amount, axis)`,
ja kolme nimettyä tapahtumaa saivat omansa: pomon laskeutuminen pystyyn massan
verran (koko 1 → 3, koko 3 → 5), jättiläisen askel pystyyn (7 askelta 160
px:llä, kevyellä pomolla 0) ja iskuaalto sivuttain. Kolme asiaa jäi kirjatuksi
muitakin muutoksia varten:

- **Suunnatut ovat puhtaita eivätkä painotettuja** (`0x/6y`). Puolikas
  sivuliike olisi tehnyt pystyiskusta vain kapeamman ellipsin, ja silloin ero
  olisi ollut makuasia eikä merkki.
- **Kovempi valitsee suunnan** kun kaksi tärähdystä osuu samaan frameen. Sitä
  tapahtuu joka kerta kun pomo laskeutuu ja aalto lähtee, joten sääntö on
  pakollinen; tasapeli palaa ympyrään, ja vaimennut tärinä nollaa suuntansa.
- **Askel on matkaa eikä kelloa**, ja se alkaa vasta koosta 2 — eli tärinä on
  tieto siitä että jättiläinen kasvoi, ei pomon vakio-ominaisuus.

Kuvaputken jälkikäsittely voisi yhä vahvistaa tärinää; se ei ollut tarpeen,
koska suunta teki sen työn jota voimakkuudelta odotettiin.

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

**4. Pomo järjestää kentän uusiksi — ✔ TEHTY (v26.08.17.95).** Iskuaallon pomo
(`form >= 1`, eli 2-F ja 8-2, ja kuningas perii sen kuudentena muotonaan) nostaa
**ensimmäisen osuman jälkeen** areenan lattiasta pilareita: sama laskeutuminen
joka lähettää aallon herättää lähimmän paikan, se pölisee 45 framea, ja sitten
kaksi laattaa kiveä nousee.

Kolme hyväksymiskriteeriä, kolme mittausta:

| kriteeri | mitattu |
| --- | --- |
| ennakoitu | `2-F: varoitus framella 13, nousi framella 59` |
| palautuva | `8/8 linnaketta palautui laatta laatalta` |
| validoitu | `1-F:3 2-F:5 3-F:3 4-F:5 5-F:5 6-F:3 7-F:5 8-F:5 paikkaa, kaikki kelpaavat` |
| ja pahin tapaus | `kaikki pilarit pystyssä: 8 linnaketta läpi voimatasolla 0` |

**Validointi ratkaistiin muodolla eikä laskemalla.** Kaikkien 2^n järjestelyn
ajaminen botilla olisi ollut sekä hidasta että hauras; sen sijaan pilari on
**yksi sarake leveä ja kaksi laattaa korkea**, ja mitattu hyppybudjetti on 6
laattaa kuilua ja 4 laattaa seinää — kaksi laattaa on askelma eikä este.
Yksikään osajoukko ei siis voi tehdä ovesta saavuttamatonta, koska yksikään
yksittäinen pilari ei voi. Portti mittaa silti sekä ehdot että pahimman
tapauksen, koska rakenteellinen argumentti ilman mittausta on mielipide.

Paikat ovat **johdettuja** (`plantPillars`) eikä kenttädatassa: tasainen lattia,
kolme tyhjää riviä yllä, kuusi laattaa väliä oveen, areenan alkuun ja toisiinsa.
Se löytyi vasta mittaamalla: ensimmäinen versio etsi lattiaa ylhäältä alas ja
löysi areenan **katon**, eli nolla paikkaa jokaisessa linnakkeessa.

Alkuperäinen päätösteksti oli:

**Päätetty tehdä 9.8.2026.** Omistaja valitsi
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

### Salainen alue maailmaan 5 — YRITETTY 17.8.2026, ja hinta on nyt mitattu

Yksi kenttä per maailma saa salaisen alueen: pavunvarsi ylös taivaalle ja putki
alas maan alle. Ei joka kenttään — löytö lakkaa olemasta löytö jos sellainen on
joka nurkassa. Maailmoissa 1–4 se on tehty (`1-2`, `2-2`, `3-2`, `4-2`;
v26.08.09.1 ja v26.08.09.8), ja `assembleTall`, kaistajako ja kaistojen
validointi ovat valmiina.

Jäljellä on maailma 5, ja se on eri työ kuin muut: sen numeroidut kentät tulevat
generaattorista, joten kaista syntyy sinne vain opettamalla `gen-levels.mjs`:lle
kolmikerroksinen kokoonpano — ja uusi generointiajo arpoo maailman uusiksi.

**Halpa reitti kokeiltiin ja se ei kelpaa, ja se on nyt mitattu eikä arveltu.**
Ajatus oli tehdä sama asia yhtä askelta myöhemmin: pinota kaista valmiin
ruudukon ympärille ja **johtaa putken suu kentästä** samalla tavalla kuin
lämpöputkien uloskäynnit, kaasulyhty ja areenan pilarit. Se toimi pelinä —
suu syntyi sarakkeeseen 112 ja matka vei luolaan — ja kaatui neljään eri
sääntöön, jotka kaikki sanovat saman asian eri sanoin: **salaisuus ei ole
maisemaa, se on kentän dataa.**

| portti | mitattu |
| --- | --- |
| kaistavalidointi lukee dataa, ei kohtausta | `5-3: nothing leads into the cave band` |
| kolikkovihje puuttuu johdetulta suulta | `vihjeettä: 5-3 putki@112` |
| lyhyt lattiaputki ei saa olla warpin synonyymi | `9/20 = 45,0 %, katto 33,3 %` |
| ja kaistojen pinoaminen **arpoo piilotiilet uusiksi** | `5-3: 0/5 salaista` |

Se viimeinen on niistä opettavaisin eikä kukaan olisi arvannut sitä: piilotiili
on paikan tiiviste, ja kaistan lisääminen siirtää koko pääkaistan viisitoista
riviä alas — eli **jokainen tiili kentässä on eri tiili kuin ennen**.

Jäljelle jää siis alkuperäinen reitti (opeta generaattorille kolmikerroksinen
kokoonpano) ja sen oma hinta, joka sekin on nyt mitattu toisessa yhteydessä:
generointiajo ilman `VGLC_DIR`iä vaihtaa jokaisen uudelleen kirjoitetun kentän
`origin: 'checked'` -merkinnän merkintään `not checked` (ks.
`tools/gen-levels.mjs`, 6-5:n kohta). **Maailma 5 kannattaa siis generoida
korpus kädessä tai ei ollenkaan**, ja se on omistajan päätös eikä tekijän.

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

1. ✔ **Palettisiirto tapahtumiin** — tehty (v26.08.16.84): vahinkovälähdys,
   pomohuoneen sävy ja tähden syke, kaikki `PostFX.setTint`in kautta ja kaikki
   ajastettuna pelilogiikan omista laskureista (`hurtFlash`, `star`, `tick`).
   Kolme asiaa jäi kirjatuksi:
   **Se ei mennyt varjostimeen** vaikka tässä niin arveltiin. Varjostin on
   olemassa vain kun WebGL saatiin ja vain kun esiasetus ei ole "pois", eli
   siellä asuva vahinkovälähdys katoaisi ajurin ja asetuksen mukana.
   Kuvaefektit saa sammuttaa; merkkiä joka kertoo osumasta ei. Sama veto
   molemmilla ajoteillä on samalla yksi mittaus.
   **Vetoja on kaksi, koska merkityksiä on kaksi.** Kerto vie väriä ja on
   *paikan* väri (pomohuone); lisäys tuo valoa ja on *tapahtuman* väri
   (osuma), koska sen on näyttävä myös tummassa kuvassa — mitattu tumma 32
   nousee lisäyksellä 126:een ja pysyy kerrolla 32:ssa. Ensimmäinen versio
   käytti kertoa myös osumaan, ja kuvakaappaus kertoi miksi ei: kerto tekee
   sinisestä taivaasta violetin eikä punaista.
   **Tähti sykkii muttei välky.** Nappulan oma väri vaihtuu 20 Hz:ssä; sama
   koko ruudulle olisi ollut WCAG 2.3.1:n välähdyskynnyksen tapaus, ja peliä
   pelaa lapsi. Ruutu hengittää 1,3 Hz:ssä ja 2,6 Hz:ssä (mitattu 1,54 Hz,
   luminanssia 2,2 %), ja nopeampi jakso on samalla merkki tähden lopusta.
   **Järjestys on osa määrittelyä**: osuma > tähti > huone, eli lyhyin voittaa.
   Kuolema ei välähdä — sillä on jo oma kuvansa.
2. ✘ **Aaltoilu veden alla — poistettu 16.8.2026.** Se odotti vedenalaisia
   kenttiä, ja ne päätettiin samana päivänä jättää tekemättä: uinti on genren
   vapaata kalustoa muttei käännettävissä tämän pelin sanastolle, koska maailma
   on suolisto eikä siellä virtaa vesi. Kuumuuden väreily ja huurre jäävät —
   ne on tehty teemakohtaisina (v26.08.08.23) ja toimivat myös ilman WebGL:ää.
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
| ↑ **täydennetty 18.8.2026** | ks. alla: *maa heittää, ja pallo kerää* |

**Toinen erä 18.8.2026, ja molemmat ovat lakeja jotka mahtuvat kohtaan 1.**

| laki | mitä muuttuu |
| --- | --- |
| maanjäristys nytkäyttää sitä mikä on maassa | `quakeborne`, oletus **kyllä** — tuuli kantaa valikoiden, maa päästää irti kaikesta |
| pyörremyrsky vetää ja nostaa | kulkee tuulen `push`-tietä, eli laki 3 pätee sellaisenaan |
| karvapallo kerää sen minkä yli se vierii | ensimmäinen laki jossa **olio tarttuu olioon**: kyyti on lainaa, kyytiläisellä ei ole laatikkoa, ja pallo päästää irti puhjetessaan |

Karvapallon kolmas kohta on se joka piti kirjoittaa ennen koodia: kyytiläinen
on ketju jonka *pallo* aloitti, joten laki 2 kieltää sitä koskemasta pelaajaan.
Tyhjä laatikko sanoo sen rakenteellisesti — kieltoa ei tarvitse muistaa
yhdessäkään törmäyssilmukassa.

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

### Peruttu 11.8.2026: "jättiläinen täyttää kiipeilyaskelmansa" oli mittausvirhe

Katselmoinnissa raportoitu, tähän kirjattu mittauksineen — ja **väärin**. Se on
kirjattu tänne perumisena eikä poistettu, koska virheellinen mittaus jonka
jälki katoaa on virheellinen mittaus joka tehdään uudelleen.

Väite oli että pöhö täyttää `boss_arena_big`in rivin 9 lankun kasvaessaan, ja
että sillä seisova pelaaja ottaa osuman. Koetin sitä molemmilla puolilla ja sain
taulukon jossa raja oli mainissa scale 2,5 ja haarassa 2,0. Taulukko oli tosi;
se vain ei mitannut lankulla seisomista.

**Koe asetti pelaajan pomon omaan keskisarakkeeseen** rivin 9 korkeudelle. Siellä
ei ole lankkua — siellä on pomon merkki `b`. Pelaaja siis pantiin ilmaan pomon
sisään ja hän putosi siihen, mikä on oikea lopputulos väärästä asetelmasta.

Oikeat luvut, kun lankut haetaan `isSemi`illä eikä `isSolid`illa (lankku on
yksisuuntainen, joten `isSolid` ei löydä sitä lainkaan — se oli kokeen toinen
vika, ja se sai ensimmäisen korjausyrityksen seisomaan kentän muilla kiinteillä
ruuduilla kaukana areenasta):

| | sarake | pomon sarake | tulos scale 1/2/3 |
| --- | --- | --- | --- |
| rivin 6 kansi | 140 | 148 | turvassa / turvassa / turvassa |
| rivin 9 askelma | 135 | 148 | turvassa / turvassa / turvassa |

Pomo on 120 px eli 7,5 laattaa leveä täydessä koossa, eli sarakkeet 144–152.
Molemmat lankut ovat sen ulkopuolella joka koolla. **Vikaa ei ole.**

Läksy on se joka toistuu tässä tiedostossa: koe joka asettaa kappaleen itse on
koe joka voi asettaa sen paikkaan jota pelissä ei ole olemassa. Kaksi kertaa
tässä erässä — ensin talloportin pelaaja piikkipenkkiin, nyt tämä — ja
molemmilla kerroilla tulos näytti uskottavalta vialta.

### Löydetty 18.8.2026: alkuperäisyystarkistus ei ollut koskaan verrannut mitään

Tämä on tämän repon oma pahin virhelaji — **vihreä portti joka ei mittaa
mitään** — ja se eli DESIGN.md:n kohdan 3 ytimessä.

`tools/originality.mjs` trimmasi korpuksen neljääntoista riviin muttei meidän
ruudukkoa. Vertailuavain on ikkunan sarakkeet merkkijonoina, ja sarakkeen
pituus on ruudukon korkeus: meillä 15 merkkiä, korpuksella 14. Kaksi eri
pituista merkkijonoa ei voi olla sama merkkijono, joten osumia oli aina nolla.
Jokainen `origin: 'checked'` ja päivän kenttien sormenjälki oli tyhjä väite —
ja koodin oma kommentti väitti nimenomaan sitä mitä koodi ei tehnyt: *"Both
grids are trimmed to the same 14 bottom rows before comparing."*

**Se mikä korjattuna paljastui, on hyvä uutinen kahdesti.** Osumia tulee, mutta
kahdeksan sarakkeen ikkunassa ne ovat tasamaata, portaita ja yksi kävelijä
tasaisella lattialla — lajityypin aakkosia, jotka kohta 2 vapauttaa. Mitattuna
26 kenttää 481 korpustiedostoa vasten: 640 osumaa kahdeksalla sarakkeella, 95
kahdellatoista, 8 kuudellatoista, **0 kahdellakymmenellä**. Ja sama nolla
saadaan toista tietä: jättämällä pelkkää maata ja ilmaa sisältävät ikkunat
vertaamatta, koska lattia ei ole sommitelma. Kaksi eri sääntöä, sama tulos.

Omistajan päätös 18.8.2026 (kolmesta vaihtoehdosta): **korjaa vertailu ja nosta
ikkuna mitatulle rajalle**, 8 → 20. Kentät eivät muuttuneet; väite muuttui
mitatuksi.

**Mitä tästä kannattaa ottaa opiksi muualle.** Vika ei ollut logiikassa vaan
siinä että kaksi puolta valmisteltiin eri paikoissa — korpus trimmattiin
lukusilmukassa, meidän ruudukko ei trimmattu missään. Trimmaus on nyt yhdessä
funktiossa jota molemmat kutsuvat. Sama kysymys kannattaa esittää jokaiselle
vertailulle tässä repossa: **kumpi puoli valmistellaan ja missä.**

### Löydetty 17.8.2026: puhetestit mittasivat seinäkellolla ääntä (v26.08.17.93)

Neljä puhetestiä kaatui satunnaisesti noin joka toisessa ajossa, ja vikaa
etsittiin **kolme kertaa testin omista luvuista**: kiinteä 900 ms:n odotus
vaihdettiin hiljaisuuden odottamiseen, yksi ikkuna kahdeksi peräkkäiseksi.
Kumpikin korjasi oikean asian, kumpikaan ei auttanut.

Syy oli se ettei kysytty **mittasiko kone ollenkaan**:

```
hiljeni 465 ms, äänikello 0.00 s / seinäkello 0.47 s, ikkunat 0.00 0.00
```

Seinäkello eteni puoli sekuntia ja äänikello ei lainkaan; `ctx.state` sanoi
koko ajan `running`. Ja vihreässäkin ajossa renderöijä laahasi — **2,65 s ääntä
6,14 s:ssa, eli 43 % nopeudella**, jolloin 420 ms:n ikkuna on 180 ms ääntä ja
400 ms pitkä puhuttu rivi mitataan puolikkaana.

Seissyt renderöijä tuottaa kaikki kolme oiretta yhdellä syyllä: analysaattori
palauttaa saman vanhan puskurin (siitä *täsmälleen* yhtä suuret lukemat
`s 24.82 š 24.82 f 24.82`), sillä välin soitetut äänet ajastuvat samaan
jäätyneeseen hetkeen ja soivat yhtä aikaa kun renderöijä herää (siitä
mahdottomat pohjakohinat 15,3 · 25,1 · 46,0), ja juuri soitettu ääni lukee
0,000. Kolme neljästä testistä oli siis koko ajan **oire eikä oma vikansa**.

Korjaus on kaksiosainen eikä kumpikaan osa löysää kynnystä: mittausikkuna
odottaa **äänikellossa** sen verran soitettua ääntä kuin siltä pyydettiin, ja
väylällä pidetään mittausten ajan äänetön oskillaattori joka pitää renderöijän
töissä. Jos renderöijä silti seisoo, rivi sanoo *"ei mitattu"* — ja erillinen
tarkistus kaatuu jos **yksikään** äänimittaus ei toteutunut, jottei portti voi
kadota huomaamatta.

**Peli ei vuoda ääntä.** Tämä on headless-Chromiumin renderöijä; oikealla
koneella äänilaite pyytää näytteitä riippumatta siitä mitä sivu tekee.

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
`w / 2 + 25 + h`.

**Ja tämä kohta sanoi ensin että kaava palauttaa vanhat luvut 30x32:lla, mikä ei
pidä paikkaansa:** 15 + 25 + 32 = 72, kun vanha vakio oli 40. Ponnistus on siis
32 px aikaisemmin *myös* pienimmällä pomolla. Testi menee silti läpi, ja sekin
on tulos: 40 px ei ollut alaraja vaan yksi toimiva arvo, ja aikaisempi ponnistus
toimii yhtä lailla. Väite \"tämä ei muuta vanhaa käytöstä\" on kuitenkin eri
väite kuin \"tämä toimii\", eikä ensimmäinen ollut totta.

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

**Tehty 17.8.2026 (v26.08.18.9), kaikki kolme päätöstä sellaisenaan.** Täydellä
mittarilla alas näyttää alemman kaistan 96 framea läpikuultavana, mittari
tyhjenee, eikä kentässä muutu mitään muuta — `tools/verify.mjs` lukee ruudukon
ennen ja jälkeen juuri siksi. Ks. `LevelScene.tryPeek` ja `drawPeek`.

**Opetus tehty 17.8.2026 (v26.08.18.10), ja se on ele eikä paikka.** Nuoli
pelaajan pään päällä silloin kun vilkaisu on mahdollinen — sama ehtofunktio
(`peekReady`) kuin itse kyvyllä, joten opetus ei voi valehdella — ja
ensimmäinen vilkaisu lopettaa sen lopullisesti (`taught.peek` tallennuksessa).
Ratkaisu on ele eikä opetuskenttä, koska mittarin täyttäminen tapahtuu joka
tapauksessa jokaisessa pitkässä suorassa: opetus tulee vastaan siellä missä
pelaaja jo on, eikä yhtäkään kenttädataa tarvinnut koskea.

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

Neljä ensimmäistä on tehty (v26.08.10.63 ja .64), ja kukin niistä on nyt
portissa eikä tällä listalla: **orvot palikat** poistettiin ja poikkeuslista
meni nollaan, **`powerup`** soi kartalla ja esineenpudotuksissa oikein
(`reserve`, `payout`), **`LETTERBOX_BAR`:n perustelu** kertoo mitatun 174 px:n
hypyn ja sen että kamera kantaa sen, ja **generaattorin resepti** nimeää vain
kenttiä jotka peli toimittaa. Jäljellä on kolme, ja ne ovat kaikki sellaisia
joita ei *korjata* vaan tiedetään:

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

- ✔ **Jokaiselle pomolle oma ääni** — tehty (v26.08.17.96). Seitsemän ääntä,
  kolme tilannetta kullakin (tulo, osuma, kaatuminen), ja mitattuna seitsemän
  eri vahvinta taajuutta: `0: 498 Hz · 1: 281 · 2: 735 · 3: 352 · 4: 396 ·
  5: 208 · 6: 243`, huiput 0,23…0,40 eli kolikon (0,32) luokassa.
  **Kuningas puhuu sen äänellä joka hän juuri on**: osuma vaihtaa hänet
  seuraavaksi linnakkeeksi, ja murahdus vaihtuu mukana — oman äänensä hän saa
  takaisin kaatuessaan. Toimintaäänet (iskuaalto, laskeutuminen, piikit) jäivät
  jaetuiksi, kuten päätettiin.

  Ensimmäinen versio mitattiin liian kovaksi: nimellinen 0,5 tuotti väylällä
  0,68…1,17 eli **kaksi kertaa pelin kovimman äänen** (kuolema 0,57). Ääni joka
  on kovempi kuin kuolema opettaa väärän tärkeysjärjestyksen.

  Alkuperäinen päätösteksti oli: niitä on yksi,
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
- **Kahdeksas pomovariantti** (päätetty 16.8.2026) — variantteja on seitsemän,
  mutta pöhö esiintyy neljästi (4-F, 5-F, 8-4, 8-5). Ks. päätösosio ylempänä.
- ✔ **Kenttäsäännöt käsintehdyille kentille pakollisiksi** — tehty, ja merkintä
  oli vanhentunut 16.8.2026 asti. Portti kaatoi sinä päivänä käsintehdyn 4-3:n
  (`T at 96,12 is standing on nothing`) ja sen jokaisella vaikeustasolla, eli
  säännöt koskevat koko peliä eivätkä vain generoituja.
- ✔ **Nimen tavaramerkkiriski** — omistaja 16.8.2026: *"nimi on jo vaihdettu."*
  Merkintä jää tänne historiana, ja [DESIGN.md](DESIGN.md) kohdan 2 riskikappale
  kannattaa lukea uudelleen sitä vasten — se puhuu yhä nimestä sanaleikkinä.

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
